import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import { Config, config, Fault } from "../src/config.js";
import { Auth } from "../src/auth.js";
import { Store, seal, unseal } from "../src/store.js";
import { GitHub } from "../src/github.js";
import { Sync } from "../src/sync.js";
import { hash, Index, failure } from "../src/model.js";
import { application } from "../src/application.js";
class Memory implements Store {
  data = new Map<string, Buffer>();
  async read(k: string) {
    return this.data.get(k) ?? null;
  }
  async write(k: string, b: Buffer) {
    if (this.data.has(k)) throw Error("exists");
    this.data.set(k, b);
  }
  async remove(k: string) {
    this.data.delete(k);
  }
  async keys(p: string) {
    return [...this.data.keys()].filter((x) => x.startsWith(p));
  }
}
const secret = randomBytes(32).toString("base64"),
  cfg: Config = {
    origin: "http://127.0.0.1",
    secret,
    allowedIds: new Set([42]),
    appId: "1",
    clientId: "client",
    clientSecret: "private-secret-canary",
    privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString(),
    installationId: "123",
    repo: "RanchoTao/Research-Archive",
  };
const raw = Buffer.from(
  JSON.stringify({
    records: [
      {
        id: "r1",
        title: "Conditional test",
        machine: "RANCHO",
        domain: "Math",
        status: "NEEDS_REVIEW",
        verification: "UNREVIEWED",
        historical_verdict: "KILL",
        scope: "only conditionA",
        evidence: [
          {
            path: "a.md",
            sha256: "a".repeat(64),
            excerpt: "untrusted <script>",
          },
        ],
        source_status_history: [{ status: "HOLD", machine: "TAO" }],
      },
      {
        id: "r2",
        title: "Second",
        machine: "TAO",
        domain: "Math",
        status: "GO",
        verification: "SOURCE_DOCUMENT_REVIEWED",
        scope: "pilot only",
        result_verified: true,
      },
    ],
    semantic_review: Array.from({ length: 127 }, (_, i) => ({
      type: "POSSIBLE_CONFLICT",
      record_ids: ["r1", "r2"],
      key: i,
    })),
  }),
);
function fixtures() {
  const store = new Memory();
  let id = 42,
    breakData = false,
    badHash = false,
    commit = "a".repeat(40),
    snapshot = "snapshots/v1",
    codeCalls = 0;
  const paths: string[] = [];
  const req: typeof fetch = async (url, options) => {
    const u = String(url);
    paths.push(u);
    if (u.includes("/login/oauth/access_token")) {
      codeCalls++;
      const b = JSON.parse(String(options?.body));
      assert.ok(b.code_verifier);
      return Response.json({
        access_token: "ghu_mock_private_token",
        expires_in: 28800,
        scope: "",
      });
    }
    if (u.endsWith("/user")) return Response.json({ id, login: "mock-user" });
    if (u.includes("/user/installations/"))
      return Response.json({
        repositories: [{ full_name: cfg.repo, private: true }],
      });
    if (u.endsWith("/access_tokens"))
      return Response.json({ token: "ghs_mock_installation_token" });
    if (u.endsWith("/app/installations/123"))
      return Response.json({
        repository_selection: "selected",
        account: { login: "RanchoTao" },
        permissions: { contents: "read", metadata: "read" },
      });
    if (u.endsWith("/repos/" + cfg.repo))
      return Response.json({ private: true, default_branch: "main" });
    if (u.includes("/commits/"))
      return Response.json({
        sha: commit,
        commit: { committer: { date: "2026-10-11T01:00:00Z" } },
      });
    if (breakData) throw Error("network details sensitive");
    if (u.includes("/contents/"))
      return Response.json({
        type: "file",
        sha: u.includes("CURRENT.json")
          ? "current"
          : u.includes("SHA256SUMS.json")
            ? "sums"
            : "catalog",
      });
    if (u.endsWith("/git/blobs/current"))
      return new Response(
        JSON.stringify({
          snapshot,
          source_occurrences: 2,
          ARCHIVE_GATE: "BLOCKED",
        }),
      );
    if (u.endsWith("/git/blobs/sums"))
      return new Response(
        JSON.stringify({
          snapshot,
          format: "compact-knowledge-sha256-v1",
          files: {
            "compact-catalog.json": {
              sha256: badHash ? "b".repeat(64) : hash(raw),
              bytes: raw.length,
            },
          },
        }),
      );
    if (u.endsWith("/git/blobs/catalog")) return new Response(raw);
    throw Error("unexpected mocked path");
  };
  const gh = new GitHub(cfg, req),
    sync = new Sync(gh, store, secret),
    auth = new Auth(cfg, store, gh);
  return {
    store,
    gh,
    sync,
    auth,
    paths,
    get codeCalls() {
      return codeCalls;
    },
    set id(v: number) {
      id = v;
    },
    set breakData(v: boolean) {
      breakData = v;
    },
    set badHash(v: boolean) {
      badHash = v;
    },
    set commit(v: string) {
      commit = v;
    },
    set snapshot(v: string) {
      snapshot = v;
    },
  };
}
test("Mock: config rejects missing secrets, broad username allowlists and production HTTP", () => {
  assert.throws(() => config({}));
  assert.throws(() => config({ APP_ORIGIN: "http://localhost" }));
});
test("Mock: session encryption tamper rejection and plaintext token absence", () => {
  const b = seal({ token: "private-token" }, secret);
  assert.equal(b.includes("private-token"), false);
  assert.equal(unseal<any>(b, secret).token, "private-token");
  b[30] ^= 1;
  assert.throws(() => unseal(b, secret));
});
test("Mock: PKCE/state standard auth flow, opaque cookie and single use callback", async () => {
  const f = fixtures(),
    flow = await f.auth.begin(),
    url = new URL(flow.url);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.has("scope"), false);
  const nonce = flow.cookie.split(";")[0].split("=")[1];
  const s = await f.auth.callback(
    nonce,
    url.searchParams.get("state")!,
    "code",
  );
  assert.equal(s.cookie.includes("ghu_"), false);
  assert.match(s.cookie, /HttpOnly; SameSite=Lax/);
  await assert.rejects(() =>
    f.auth.callback(nonce, url.searchParams.get("state")!, "code"),
  );
});
test("Mock: bad OAuth state rejected before token exchange", async () => {
  const f = fixtures(),
    flow = await f.auth.begin();
  await assert.rejects(() =>
    f.auth.callback(flow.cookie.split(";")[0].split("=")[1], "bad", "code"),
  );
  assert.equal(f.codeCalls, 0);
});
test("Mock: unauthorized numeric user 403 even with repository access", async () => {
  const f = fixtures();
  f.id = 666;
  await assert.rejects(
    () => f.gh.identity("ghu_test"),
    (e: any) => e.status === 403,
  );
});
test("Mock: App and user repository intersection required", async () => {
  const gh = new GitHub(cfg, async (u) =>
    String(u).endsWith("/user")
      ? Response.json({ id: 42, login: "user" })
      : Response.json({ repositories: [] }),
  );
  await assert.rejects(
    () => gh.identity("t"),
    (e: any) => e.status === 403,
  );
});
test("Mock: scoped installation token only contents read on one repository", async () => {
  let body: any;
  const gh = new GitHub(cfg, async (u, o) => {
    if (!o?.body)
      return Response.json({
        repository_selection: "selected",
        account: { login: "RanchoTao" },
        permissions: { contents: "read", metadata: "read" },
      });
    body = JSON.parse(String(o?.body));
    return Response.json({ token: "x" });
  });
  await gh.installationToken();
  assert.deepEqual(body, {
    repositories: ["Research-Archive"],
    permissions: { contents: "read" },
  });
});
test("Mock: broad App permissions rejected without obtaining installation token", async () => {
  let calls = 0;
  const gh = new GitHub(cfg, async () => {
    calls++;
    return Response.json({
      repository_selection: "all",
      account: { login: "RanchoTao" },
      permissions: { contents: "write", metadata: "read" },
    });
  });
  await assert.rejects(
    () => gh.installationToken(),
    /APP_PERMISSIONS_NOT_MINIMAL/,
  );
  assert.equal(calls, 1);
});
test("Mock: missing installation access is403, not a cached authorization grant", async () => {
  const gh = new GitHub(cfg, async (u) =>
    String(u).endsWith("/user")
      ? Response.json({ id: 42, login: "allowed" })
      : new Response("", { status: 404 }),
  );
  await assert.rejects(
    () => gh.identity("t"),
    (e: any) => e.status === 403,
  );
});
test("Mock: scoped compound failure status remains searchable without promoting history", () => {
  const r = {
    id: "x",
    title: "candidate",
    status: "NEEDS_REVIEW",
    historical_verdict: "EARLY_KILL_COLLISION",
    scope: "only the original assumption",
  };
  assert.equal(failure(r), true);
  assert.equal(r.status, "NEEDS_REVIEW");
});
test("Mock: policy error never serves last-good cache, including repeated requests", async () => {
  const f = fixtures();
  await f.sync.refresh();
  f.gh.checkInstallation = async () => {
    throw new Fault("APP_PERMISSIONS_NOT_MINIMAL", 403);
  };
  await assert.rejects(
    () => f.sync.refresh(true),
    (e: any) => e.status === 403,
  );
  await assert.rejects(
    () => f.sync.refresh(),
    (e: any) => e.status === 403,
  );
  assert.equal(f.sync.current!.index.records.length, 2);
});
test("Mock: session rechecks minimum App policy even during fresh snapshot cache", async () => {
  const f = fixtures(),
    sid = randomBytes(32).toString("base64url");
  await f.store.write(
    "sessions/" + hash(sid),
    seal(
      {
        user: { id: 42, login: "mock-user" },
        token: "ghu_mock_private_token",
        expires: Date.now() + 100000,
        csrf: "csrf",
      },
      secret,
    ),
  );
  await f.sync.refresh();
  f.gh.checkInstallation = async () => {
    throw new Fault("APP_PERMISSIONS_NOT_MINIMAL", 403);
  };
  await assert.rejects(
    () => f.auth.session(sid),
    (e: any) => e.status === 403,
  );
});
test("Mock: first verified sync, 127 reviews retained, source versions unchanged", async () => {
  const f = fixtures(),
    v = await f.sync.refresh();
  assert.equal(v.counts.records, 2);
  assert.equal(v.archiveGate, "BLOCKED");
  assert.equal(f.sync.current!.index.reviews.length, 127);
  assert.deepEqual(
    f.sync.current!.index.byId.get("r1")!.source_status_history,
    [{ status: "HOLD", machine: "TAO" }],
  );
  assert.ok(f.paths.some((x) => x.includes("/git/blobs/catalog")));
  assert.ok(
    f.paths
      .filter((x) => x.includes("/contents/"))
      .every((x) => x.includes("?ref=" + "a".repeat(40))),
  );
});
test("Mock: repeat sync idempotent, same record count and durable object count", async () => {
  const f = fixtures();
  await f.sync.refresh();
  const count = f.store.data.size;
  await f.sync.refresh(true);
  assert.equal(f.store.data.size, count);
  assert.equal(f.sync.current!.index.records.length, 2);
});
test("Mock: first corrupt checksum rejects snapshot entirely", async () => {
  const f = fixtures();
  f.badHash = true;
  await assert.rejects(() => f.sync.refresh(), /SNAPSHOT_INTEGRITY_FAILED/);
  assert.equal(f.sync.current, undefined);
});
test("Mock: changed corrupt snapshot retains last verified data and reports safe error", async () => {
  const f = fixtures();
  await f.sync.refresh();
  f.commit = "b".repeat(40);
  f.snapshot = "snapshots/v2";
  f.badHash = true;
  const v = await f.sync.refresh(true);
  assert.equal(v.snapshot, "snapshots/v1");
  assert.equal(v.stale, true);
  assert.equal(v.error, "SNAPSHOT_INTEGRITY_FAILED");
});
test("Mock: mutation of immutable snapshot refused", async () => {
  const f = fixtures();
  await f.sync.refresh();
  f.commit = "b".repeat(40);
  f.badHash = true;
  const v = await f.sync.refresh(true);
  assert.equal(v.error, "IMMUTABLE_SNAPSHOT_CHANGED");
});
test("Mock: data outage retains durable last verified version across cold starts", async () => {
  const f = fixtures();
  await f.sync.refresh();
  f.commit = "b".repeat(40);
  f.breakData = true;
  const cold = new Sync(f.gh, f.store, secret),
    v = await cold.refresh();
  assert.equal(v.snapshot, "snapshots/v1");
  assert.equal(v.stale, true);
  assert.equal(v.counts.records, 2);
});
test("Mock: rate limit and expired token errors safe and recoverable", async () => {
  for (const [status, code] of [
    [429, "GITHUB_RATE_OR_PERMISSION"],
    [401, "TOKEN_EXPIRED"],
  ] as const) {
    const g = new GitHub(
      cfg,
      async () => new Response("secret response", { status }),
    );
    await assert.rejects(
      () => g.api("/user", "secret"),
      (e: any) => e.code === code && !e.message.includes("secret"),
    );
  }
  await fixtures().gh.identity("newtoken");
});
test("Mock: historical GO is not independent science; conditional KILL query", () => {
  const i = new Index(JSON.parse(raw.toString()));
  assert.equal(i.statistics.independently_reproduced_results, 0);
  assert.equal(
    i.query("", "", "", true, 1, 30).records[0].scope,
    "only conditionA",
  );
  assert.equal(failure(i.records[0]), true);
  assert.equal(
    i.graph("r1", 8).nodes.some((x) => x.type === "Verdict"),
    false,
  );
  assert.ok(i.graph("r1", 8).nodes.every((x) => Array.isArray(x.provenance)));
});
test("Mock: canonical Python source vocabulary includes aggregate receipts, not scientific reruns", () => {
  const i = new Index({
    records: [
      {
        id: "aggregate",
        title: "Scoped arithmetic check",
        verification: "HISTORICAL_AGGREGATE_RECEIPT_INTEGRITY_VERIFIED",
        result_verified: true,
        status: "KILL",
        scope: "original protocol only",
      },
    ],
  });
  assert.equal(i.statistics.source_documented_records, 1);
  assert.equal(i.statistics.independently_reproduced_results, 0);
});
test("Mock: HTTPS host cookie requires Secure and logout invalidates durable session", () => {
  const f = fixtures(),
    auth = new Auth(
      { ...cfg, origin: "https://example.vercel.app" },
      f.store,
      f.gh,
    );
  assert.match(
    auth.cookie("session", "opaque", 600),
    /^__Host-atlas-session=opaque; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/,
  );
  assert.throws(
    () =>
      auth.csrf("https://evil.example", "csrf", {
        user: { id: 42, login: "x" },
        token: "t",
        expires: 9999999999999,
        csrf: "csrf",
      }),
    (e: any) => e.status === 403,
  );
});
test("Mock: duplicate IDs refuse overwrite, maxgraph and 100k pagination", () => {
  assert.throws(
    () =>
      new Index({
        records: [
          { id: "x", title: "x" },
          { id: "x", title: "y" },
        ],
      }),
  );
  const i = new Index({
    records: Array.from({ length: 100000 }, (_, n) => ({
      id: "r" + n,
      title: "question" + n,
      status: "HOLD",
      machine: n % 2 ? "RANCHO" : "TAO",
      scope: "conditional",
    })),
  });
  assert.equal(i.query("question99999", "", "", false, 1, 30).total, 1);
  assert.equal(i.query("", "", "", false, 10, 30).records.length, 30);
});
test("HTTP integration with MOCK GitHub: 401, authorized session, CSRF, append review, logout, 403 other user", async () => {
  const f = fixtures(),
    sid = randomBytes(32).toString("base64url");
  await f.store.write(
    "sessions/" + hash(sid),
    seal(
      {
        user: { id: 42, login: "mock-user" },
        token: "ghu_mock_private_token",
        expires: Date.now() + 3600000,
        csrf: "csrf-value",
      },
      secret,
    ),
  );
  const app = application(() => ({
      cfg,
      auth: f.auth,
      sync: f.sync,
      store: f.store,
    })),
    s = app.listen(0, "127.0.0.1");
  await once(s, "listening");
  const port = (s.address() as any).port,
    base = "http://127.0.0.1:" + port,
    headers = { Cookie: "atlas-session=" + sid };
  try {
    const a = await fetch(base + "/api/overview");
    assert.equal(a.status, 401);
    assert.equal(a.headers.get("cache-control"), "no-store");
    const b = await fetch(base + "/api/overview", { headers });
    assert.equal(b.status, 200);
    assert.equal((await b.json()).counts.records, 2);
    const id = f.sync.current!.index.reviews[0].id;
    assert.equal(
      (
        await fetch(base + "/api/reviews/" + id, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: '{"decision":"CONFLICT"}',
        })
      ).status,
      403,
    );
    const c = await fetch(base + "/api/reviews/" + id, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Origin: cfg.origin,
        "X-CSRF-Token": "csrf-value",
      },
      body: '{"decision":"CONFLICT","note":"condition differs"}',
    });
    assert.equal(c.status, 201);
    assert.equal(f.sync.current!.index.reviews.length, 127);
    assert.equal(
      (await fetch(base + "/api/records?limit=99999", { headers })).status,
      400,
    );
    const html = await (await fetch(base + "/")).text();
    assert.equal(html.includes("ghu_mock_private_token"), false);
    assert.equal(html.includes("Conditional test"), false);
    f.id = 666;
    assert.equal(
      (await fetch(base + "/api/overview", { headers })).status,
      403,
    );
    f.id = 42;
    assert.equal(
      (
        await fetch(base + "/api/auth/logout", {
          method: "POST",
          headers: {
            ...headers,
            Origin: cfg.origin,
            "X-CSRF-Token": "csrf-value",
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(base + "/api/overview", { headers })).status,
      401,
    );
  } finally {
    s.close();
  }
});
test("HTTP integration: unconfigured app serves generic shell and API401; login503", async () => {
  const s = application(() => {
    throw new Fault("SETUP_REQUIRED");
  }).listen(0, "127.0.0.1");
  await once(s, "listening");
  const b = "http://127.0.0.1:" + (s.address() as any).port;
  try {
    assert.equal((await fetch(b + "/")).status, 200);
    assert.equal((await fetch(b + "/api/records")).status, 401);
    assert.equal((await fetch(b + "/api/auth/login")).status, 503);
    assert.equal((await fetch(b + "/CURRENT.json")).status, 404);
  } finally {
    s.close();
  }
});
