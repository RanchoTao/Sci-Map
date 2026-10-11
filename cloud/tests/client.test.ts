import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

// DOM + Mock tests use the actual public HTML/JS and synthetic records only.
// They do not authenticate GitHub, render browser pixels, or prove deployment.
const html = await readFile(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const script = await readFile(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
const records = Array.from({ length: 35 }, (_, i) => ({
  id: "mock-" + i,
  source_ids: [i === 0 ? "H33" : i === 1 ? "CF-001001" : "MOCK-" + i],
  title:
    i === 0
      ? 'Synthetic <img src=x onerror="window.pwned=1"> question'
      : "Synthetic question " + i,
  summary: "Synthetic fixture; no real research information.",
  question: "Fixture question " + i,
  kind: "problem",
  project: "Synthetic fixture",
  machine: i % 2 ? "TAO" : "RANCHO",
  domain: i % 2 ? "Test B" : "Test A",
  tags: ["synthetic", i % 2 ? "peer" : "local"],
  status: i === 0 ? "KILL_CONDITIONAL" : "NEEDS_REVIEW",
  historical_verdict: i === 1 ? "GO" : "HOLD",
  historical_status_group: i === 1 ? "GO" : "HOLD",
  verification: i === 0 ? "SOURCE_DOCUMENTED" : "UNREVIEWED",
  result_verified: i === 0,
  scope: "Synthetic condition A only; not a universal scientific claim.",
  validation_boundary:
    "Synthetic receipt checks only; no scientific reproduction.",
  date: "2026-01-01",
  date_provenance: "SYNTHETIC_SOURCE_DATE",
  evidence: [
    {
      label: "mock source",
      path: "mock.md",
      sha256: "a".repeat(64),
      excerpt: "Literal <script>window.pwned=2</script> source text.",
    },
  ],
  source_status_history: [
    { date: "2025-12-31", status: "HOLD" },
    {
      date: "2026-01-01",
      status: i === 0 ? "KILL_CONDITIONAL" : "NEEDS_REVIEW",
    },
  ],
}));
type Call = { url: URL; options: RequestInit };
async function waitFor(condition: () => boolean) {
  const end = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > end) throw Error("DOM + Mock condition timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
function fixture(sessionStatus = 200) {
  const dom = new JSDOM(html, {
    url: "https://synthetic.invalid/",
    runScripts: "outside-only",
  });
  const w = dom.window;
  const calls: Call[] = [];
  let active = true,
    snapshot = "synthetic-1";
  let poll: (() => Promise<void>) | null = null;
  let pendingList: ((r: Response) => void) | null = null;
  let delayList = false;
  let storageWrites = 0;
  const annotations: any[] = [];
  Object.defineProperty(w.document, "hidden", { value: false });
  w.AbortController = AbortController as any;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  w.Storage.prototype.setItem = function () {
    storageWrites++;
    throw Error("Persistent private browser writes forbidden");
  };
  w.setInterval = ((fn: () => Promise<void>, ms: number) => {
    assert.equal(ms, 60000);
    poll = fn;
    return 1;
  }) as any;
  w.clearInterval = (() => {
    poll = null;
  }) as any;
  const overview = () => ({
    snapshot,
    syncedAt: "2026-01-01T00:00:00Z",
    stale: false,
    error: null,
    archiveGate: "BLOCKED",
    reviewCount: 1,
    counts: { records: 35, machines: { RANCHO: 18, TAO: 17 } },
    statistics: {
      source_occurrences: 35,
      source_documented_records: 1,
      historical_result_receipts_checked: 1,
      independently_reproduced_results: 0,
      by_status: { KILL_CONDITIONAL: 1, NEEDS_REVIEW: 34 },
      by_domain: { "Test A": 18, "Test B": 17 },
      tags: ["synthetic", "peer", "local"],
    },
  });
  const respond = (value: any, status = 200) =>
    Response.json(value, { status });
  w.fetch = (async (input: string, options: RequestInit = {}) => {
    const url = new URL(input, w.location.href);
    calls.push({ url, options });
    if (url.pathname === "/api/session")
      return !active
        ? respond({ error: "LOGIN_REQUIRED" }, 401)
        : sessionStatus === 200
          ? respond({
              user: { id: 42, login: "SYNTHETIC_TEST" },
              csrf: "synthetic-csrf",
            })
          : respond(
              {
                error:
                  sessionStatus === 503
                    ? "SETUP_REQUIRED"
                    : sessionStatus === 403
                      ? "USER_NOT_ALLOWED"
                      : "LOGIN_REQUIRED",
              },
              sessionStatus,
            );
    if (!active) return respond({ error: "LOGIN_REQUIRED" }, 401);
    if (url.pathname === "/api/overview") return respond(overview());
    if (url.pathname === "/api/records") {
      const q = url.searchParams.get("q")?.toLowerCase() || "",
        machine = url.searchParams.get("machine"),
        status = url.searchParams.get("status"),
        domain = url.searchParams.get("domain"),
        tag = url.searchParams.get("tag");
      const selected = records.filter(
        (r) =>
          (!q || JSON.stringify(r).toLowerCase().includes(q)) &&
          (!machine || r.machine === machine) &&
          (!status || r.status === status) &&
          (!domain || r.domain === domain) &&
          (!tag || r.tags.includes(tag)) &&
          (url.searchParams.get("failure") !== "1" ||
            r.status.startsWith("KILL")),
      );
      const page = Number(url.searchParams.get("page") || 1),
        limit = Number(url.searchParams.get("limit") || 30);
      const data = {
        records: selected.slice((page - 1) * limit, page * limit),
        total: selected.length,
        page,
      };
      if (delayList) {
        delayList = false;
        return new Promise<Response>((resolve) => {
          pendingList = resolve;
        });
      }
      return respond(data);
    }
    if (url.pathname.startsWith("/api/records/"))
      return respond(
        records.find(
          (r) =>
            r.id ===
            decodeURIComponent(url.pathname.slice("/api/records/".length)),
        )!,
      );
    if (url.pathname === "/api/related")
      return respond({
        records: [
          { ...records[1], match_basis: "UNREVIEWED_RELATION_PROPOSAL" },
        ],
        semantics: "Synthetic association only; no automatic merge",
      });
    if (url.pathname === "/api/graph")
      return respond({
        nodes: Array.from({ length: 125 }, (_, i) => ({
          id: "n" + i,
          type: "Evidence",
          label: "Synthetic source " + i,
          record_id: "mock-0",
          provenance: [{ label: "mock.md" }],
        })),
        edges: Array.from({ length: 124 }, (_, i) => ({
          source: "n" + i,
          target: "n" + (i + 1),
          type: "documented-by",
          provenance: [{ label: "mock.md" }],
        })),
      });
    if (url.pathname === "/api/timeline")
      return respond({
        events: [
          {
            date: "2025-12-31",
            title: "Synthetic hold",
            status: "HOLD",
            record_id: "mock-0",
            date_provenance: "SYNTHETIC_SOURCE_DATE",
          },
          {
            date: "2026-01-01",
            title: "Synthetic scoped termination",
            status: "KILL_CONDITIONAL",
            record_id: "mock-0",
            date_provenance: "SYNTHETIC_SOURCE_DATE",
          },
        ],
      });
    if (url.pathname === "/api/reviews")
      return respond({
        items: [
          {
            id: "mock-review",
            title: "Synthetic version candidate",
            record_ids: ["mock-0", "mock-1"],
            reason: "No automatic merge",
          },
        ],
        total: 1,
        annotations,
      });
    if (url.pathname === "/api/reviews/mock-review") {
      assert.equal((options.headers as any)["X-CSRF-Token"], "synthetic-csrf");
      const body = JSON.parse(String(options.body));
      assert.ok(
        ["DUPLICATE", "VERSION", "UPDATE", "CONFLICT", "UNRELATED"].includes(
          body.decision,
        ),
      );
      assert.ok(body.note.length <= 2000);
      const annotation = {
        id: "mock-annotation",
        review_id: "mock-review",
        ...body,
        source_unchanged: true,
      };
      annotations.push(annotation);
      return respond(annotation, 201);
    }
    if (url.pathname === "/api/auth/logout") {
      assert.equal((options.headers as any)["X-CSRF-Token"], "synthetic-csrf");
      active = false;
      return respond({ ok: true });
    }
    throw Error("Unexpected synthetic API route " + url.pathname);
  }) as any;
  w.eval(script + "\n;globalThis.__stateForTest=state;");
  const element = (id: string) => w.document.getElementById(id)!;
  const input = (id: string, value: string) => {
    (element(id) as HTMLInputElement).value = value;
    element(id).dispatchEvent(new w.Event(id === "query" ? "input" : "change"));
  };
  const nav = (view: string) =>
    (
      w.document.querySelector(
        'nav button[data-view="' + view + '"]',
      ) as HTMLElement
    ).click();
  return {
    dom,
    w,
    calls,
    element,
    input,
    nav,
    get annotations() {
      return annotations;
    },
    get storageWrites() {
      return storageWrites;
    },
    get poll() {
      return poll;
    },
    set snapshot(value: string) {
      snapshot = value;
    },
    delayList() {
      delayList = true;
    },
    get pendingList() {
      return pendingList;
    },
    resolveList(status = 200) {
      pendingList?.(
        status === 200
          ? respond({ records: [records[0]], total: 1, page: 1 })
          : respond({ error: "LOGIN_REQUIRED" }, status),
      );
    },
    reauthorize() {
      active = true;
    },
    close() {
      dom.window.close();
    },
  };
}

test("DOM + Mock: actual shell exposes login, denied user and unconfigured service without private content", async () => {
  for (const [status, heading] of [
    [401, "登录私有研究地图"],
    [403, "此账号尚未获得访问权限"],
    [503, "私有地图服务尚未配置"],
  ] as const) {
    const f = fixture(status);
    try {
      await waitFor(
        () => !f.element("auth-panel").classList.contains("hidden"),
      );
      assert.equal(f.element("auth-title").textContent, heading);
      assert.equal(f.element("results").textContent, "");
      assert.equal(f.calls.length, 1);
      assert.ok(f.element("workspace").classList.contains("hidden"));
      if (status === 503)
        assert.ok(f.element("login-link").classList.contains("hidden"));
    } finally {
      f.close();
    }
  }
});
test("DOM + Mock: list pagination, ID search, source/domain/tag/status/failure filters use bounded authenticated API", async () => {
  const f = fixture();
  try {
    await waitFor(
      () => f.element("result-count").textContent === "35 条匹配记录",
    );
    assert.equal(f.w.document.querySelectorAll(".record").length, 30);
    (f.element("next") as HTMLElement).click();
    await waitFor(() => f.element("page-number").textContent === "2 / 2");
    assert.equal(f.w.document.querySelectorAll(".record").length, 5);
    f.input("query", "CF-001001");
    await waitFor(
      () => f.element("result-count").textContent === "1 条匹配记录",
    );
    assert.match(f.element("results").textContent!, /Synthetic question 1/);
    f.input("status", "KILL_CONDITIONAL");
    await waitFor(
      () => f.element("result-count").textContent === "0 条匹配记录",
    );
    f.input("status", "");
    f.input("query", "");
    await waitFor(
      () => f.element("result-count").textContent === "35 条匹配记录",
    );
    f.input("machine", "TAO");
    await waitFor(
      () => f.element("result-count").textContent === "17 条匹配记录",
    );
    f.input("domain", "Test A");
    await waitFor(
      () => f.element("result-count").textContent === "0 条匹配记录",
    );
    f.input("domain", "Test B");
    f.input("tag", "peer");
    await waitFor(
      () => f.element("result-count").textContent === "17 条匹配记录",
    );
    f.input("machine", "");
    f.input("domain", "");
    f.input("tag", "");
    (f.element("failure") as HTMLInputElement).checked = true;
    f.element("failure").dispatchEvent(new f.w.Event("change"));
    await waitFor(
      () => f.element("result-count").textContent === "1 条匹配记录",
    );
    for (const call of f.calls) {
      assert.equal(call.options.credentials, "same-origin");
      assert.equal(call.options.cache, "no-store");
      if (call.url.pathname === "/api/records")
        assert.ok(Number(call.url.searchParams.get("limit")) <= 40);
    }
    assert.equal(f.storageWrites, 0);
  } finally {
    f.close();
  }
});
test("DOM + Mock: source text is inert, detail boundaries and related records preserve separate histories", async () => {
  const f = fixture();
  try {
    await waitFor(
      () => f.element("result-count").textContent === "35 条匹配记录",
    );
    assert.equal(
      f.w.document.querySelectorAll("img,script:not([src])").length,
      0,
    );
    (f.w.document.querySelector(".record") as HTMLElement).click();
    await waitFor(() =>
      f
        .element("detail-body")
        .textContent!.includes("Synthetic association only"),
    );
    assert.match(
      f.element("detail-body").textContent!,
      /Literal <script>window.pwned=2<\/script>/,
    );
    assert.match(f.element("detail-body").textContent!, /HOLD/);
    assert.match(f.element("detail-body").textContent!, /KILL_CONDITIONAL/);
    assert.match(
      f.element("detail-body").textContent!,
      /UNREVIEWED_RELATION_PROPOSAL/,
    );
    assert.equal((f.w as any).pwned, undefined);
    assert.equal(
      f.element("detail-body").querySelectorAll("img,script").length,
      0,
    );
    assert.match(f.element("metrics").textContent!, /独立科学复现结果/);
    assert.match(f.element("detail-body").textContent!, /不代表独立科学复现/);
  } finally {
    f.close();
  }
});
test("DOM + Mock: bounded graph, source timeline, cross-machine counts and append-only review CSRF submission", async () => {
  const f = fixture();
  try {
    await waitFor(
      () => f.element("result-count").textContent === "35 条匹配记录",
    );
    f.nav("graph");
    await waitFor(() => !!f.element("results").querySelector("svg"));
    assert.equal(
      f.element("results").querySelectorAll(".graph-node").length,
      80,
    );
    assert.equal(
      f.calls
        .find((c) => c.url.pathname === "/api/graph")!
        .url.searchParams.get("limit"),
      "80",
    );
    f.nav("timeline");
    await waitFor(
      () =>
        f.element("results").querySelectorAll(".timeline-event").length === 2,
    );
    assert.match(f.element("results").textContent!, /SYNTHETIC_SOURCE_DATE/);
    f.nav("machines");
    await waitFor(
      () => f.element("results").querySelectorAll(".machine-card").length === 2,
    );
    assert.match(f.element("results").textContent!, /18 条目录记录/);
    assert.match(f.element("results").textContent!, /17 条目录记录/);
    f.nav("reviews");
    await waitFor(
      () => !!f.element("results").querySelector(".review-controls"),
    );
    const controls = f.element("results").querySelector(".review-controls")!;
    const select = controls.querySelector("select")!,
      note = controls.querySelector("textarea")!,
      save = controls.querySelector("button")!;
    assert.equal(note.maxLength, 2000);
    select.value = "CONFLICT";
    note.value =
      "Synthetic condition difference <script>not executable</script>";
    save.click();
    await waitFor(
      () =>
        f.annotations.length === 1 &&
        controls.textContent!.includes("审核意见已保存"),
    );
    assert.equal(f.annotations[0].source_unchanged, true);
    assert.equal(controls.querySelector("script"), null);
    assert.equal((f.w as any).__stateForTest.reviews.length, 1);
    f.nav("list");
    await waitFor(
      () => f.element("result-count").textContent === "35 条匹配记录",
    );
    assert.equal((f.w as any).__stateForTest.total, 35);
  } finally {
    f.close();
  }
});
test("DOM + Mock: snapshot polling refreshes active views; logout clears private DOM and rejects late replies", async () => {
  const f = fixture();
  try {
    await waitFor(() => f.poll !== null);
    const before = f.calls.filter(
      (c) => c.url.pathname === "/api/records",
    ).length;
    await f.poll!();
    assert.equal(
      f.calls.filter((c) => c.url.pathname === "/api/records").length,
      before,
    );
    f.snapshot = "synthetic-2";
    await f.poll!();
    assert.ok(
      f.calls.filter((c) => c.url.pathname === "/api/records").length > before,
    );
    assert.match(f.element("sync-banner").textContent!, /synthetic-2/);
    f.delayList();
    f.input("status", "NEEDS_REVIEW");
    await waitFor(() => f.pendingList !== null);
    (f.element("logout") as HTMLElement).click();
    await waitFor(() => (f.w as any).__stateForTest.user === null);
    f.resolveList();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(f.element("results").textContent, "");
    assert.equal(f.element("detail-body").textContent, "");
    assert.equal(f.element("metrics").textContent, "");
    assert.equal((f.w as any).__stateForTest.csrf, null);
    assert.equal((f.w as any).__stateForTest.records.length, 0);
    assert.equal((f.w as any).__stateForTest.reviews.length, 0);
    assert.equal(f.poll, null);
    assert.ok(f.element("workspace").classList.contains("hidden"));
    assert.equal(f.storageWrites, 0);
  } finally {
    f.close();
  }
});
test("DOM + Mock: stale authorization failures cannot clear a newly authorized session", async () => {
  const f = fixture();
  try {
    await waitFor(() => f.poll !== null);
    f.delayList();
    f.input("status", "NEEDS_REVIEW");
    await waitFor(() => f.pendingList !== null);
    (f.element("logout") as HTMLElement).click();
    await waitFor(() => (f.w as any).__stateForTest.user === null);
    f.reauthorize();
    (f.element("retry") as HTMLElement).click();
    await waitFor(
      () => f.element("result-count").textContent === "35 条匹配记录",
    );
    f.resolveList(401);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal((f.w as any).__stateForTest.user.login, "SYNTHETIC_TEST");
    assert.equal(f.element("result-count").textContent, "35 条匹配记录");
    assert.ok(!f.element("workspace").classList.contains("hidden"));
  } finally {
    f.close();
  }
});
