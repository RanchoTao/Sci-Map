// Request authorization is enforced here, before every private data route.
import express, { Request, Response, NextFunction } from "express";
import { fileURLToPath } from "node:url";
import { Config, Fault } from "./config.js";
import { Auth, Session } from "./auth.js";
import { Sync } from "./sync.js";
import { Store } from "./store.js";
import { unseal } from "./store.js";
import { hash } from "./model.js";
import { randomUUID } from "node:crypto";
export function application(
  deps: () => { cfg: Config; auth: Auth; sync: Sync; store: Store },
) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=31536000",
    });
    if (req.query.code) res.set("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  const withSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const d = deps();
      const sid = d.auth.readCookie(req.headers.cookie, "session");
      res.locals.session = await d.auth.session(sid);
      res.locals.sid = sid;
      next();
    } catch (e) {
      next(e);
    }
  };
  app.get("/api/auth/login", async (req, res) => {
    const d = deps(),
      flow = await d.auth.begin();
    res.setHeader("Set-Cookie", flow.cookie);
    res.redirect(302, flow.url);
  });
  app.get("/api/auth/callback", async (req, res) => {
    const d = deps();
    try {
      const s = await d.auth.callback(
        d.auth.readCookie(req.headers.cookie, "oauth"),
        String(req.query.state ?? ""),
        String(req.query.code ?? ""),
      );
      res.setHeader("Set-Cookie", [s.cookie, d.auth.cookie("oauth", "", 0)]);
      res.redirect(303, "/");
    } catch (e) {
      res.setHeader("Set-Cookie", d.auth.cookie("oauth", "", 0));
      throw e;
    }
  });
  // Missing cookie is rejected before configuration or storage lookup.
  app.use(
    "/api",
    (req, res, next) => {
      if (
        !req.headers.cookie
          ?.split(";")
          .some((x) =>
            /^\s*(?:__Host-)?atlas-session=[A-Za-z0-9_-]{43}$/.test(x),
          )
      ) {
        res.status(401).json({ error: "LOGIN_REQUIRED" });
        return;
      }
      next();
    },
    withSession,
  );
  app.get("/api/session", (req, res) => {
    const s = res.locals.session as Session;
    res.json({ user: s.user, csrf: s.csrf });
  });
  app.post("/api/auth/logout", async (req, res) => {
    const d = deps();
    d.auth.csrf(
      req.headers.origin,
      req.get("X-CSRF-Token"),
      res.locals.session,
    );
    res.setHeader("Set-Cookie", await d.auth.logout(res.locals.sid));
    res.setHeader("Clear-Site-Data", '"cache", "cookies", "storage"');
    res.json({ ok: true });
  });
  app.get("/api/overview", async (req, res) =>
    res.json(await deps().sync.refresh()),
  );
  app.get("/api/sync/errors", async (req, res) => {
    const d = deps(),
      keys = (await d.store.keys("sync-errors/")).sort().reverse().slice(0, 20),
      events = [];
    for (const key of keys) {
      const value = await d.store.read(key);
      if (value) events.push(unseal(value, d.cfg.secret));
    }
    res.json({ events });
  });
  const page = (req: Request) => {
    const p = Number(req.query.page ?? 1),
      n = Number(req.query.limit ?? 30);
    if (
      !Number.isInteger(p) ||
      p < 1 ||
      p > 100000 ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > 40
    )
      throw new Fault("INVALID_PAGINATION", 400);
    return { p, n };
  };
  app.get("/api/records", async (req, res) => {
    const d = deps();
    await d.sync.refresh();
    const { p, n } = page(req),
      q = String(req.query.q ?? "");
    if (q.length > 512) throw new Fault("QUERY_TOO_LONG", 400);
    res.json(
      d.sync.current!.index.query(
        q,
        String(req.query.machine ?? ""),
        String(req.query.status ?? ""),
        req.query.failure === "1",
        p,
        n,
        String(req.query.domain ?? ""),
        String(req.query.tag ?? ""),
      ),
    );
  });
  app.get("/api/records/:id", async (req, res) => {
    const d = deps();
    await d.sync.refresh();
    const r = d.sync.current!.index.byId.get(String(req.params.id));
    if (!r) throw new Fault("RECORD_NOT_FOUND", 404);
    res.json(r);
  });
  app.get("/api/related", async (req, res) => {
    const d = deps();
    await d.sync.refresh();
    res.json(d.sync.current!.index.related(String(req.query.id ?? "")));
  });
  app.get("/api/graph", async (req, res) => {
    const d = deps();
    await d.sync.refresh();
    const limit = Number(req.query.limit ?? 80);
    if (!Number.isInteger(limit) || limit < 3 || limit > 80)
      throw new Fault("INVALID_GRAPH_LIMIT", 400);
    const index = d.sync.current!.index;
    if (req.query.id) {
      res.json(index.graph(String(req.query.id), limit));
      return;
    }
    const nodes: any[] = [],
      edges: any[] = [];
    for (const r of index.query(
      String(req.query.q ?? ""),
      String(req.query.machine ?? ""),
      String(req.query.status ?? ""),
      req.query.failure === "1",
      1,
      10,
      String(req.query.domain ?? ""),
      String(req.query.tag ?? ""),
    ).records) {
      if (limit - nodes.length < 3) break;
      const g = index.graph(r.id, limit - nodes.length);
      nodes.push(...g.nodes);
      edges.push(...g.edges);
    }
    res.json({
      nodes,
      edges,
      bounded: true,
      semantics: "SOURCE_ASSOCIATION_ONLY; co-occurrence is not causation",
    });
  });
  app.get("/api/timeline", async (req, res) => {
    const d = deps();
    await d.sync.refresh();
    const i = d.sync.current!.index;
    const selected = req.query.record
      ? [i.byId.get(String(req.query.record))]
      : i.query(
          String(req.query.q ?? ""),
          String(req.query.machine ?? ""),
          String(req.query.status ?? ""),
          req.query.failure === "1",
          1,
          40,
          String(req.query.domain ?? ""),
          String(req.query.tag ?? ""),
        ).records;
    if (!selected[0]) {
      if (req.query.record) throw new Fault("RECORD_NOT_FOUND", 404);
      res.json({ events: [] });
      return;
    }
    const events = selected.flatMap((r) => [
      {
        date: r!.date,
        title: r!.title,
        date_provenance: i.byId.get(r!.id)?.date_provenance,
        machine: r!.machine,
        status: r!.status,
        scope: r!.scope,
        record_id: r!.id,
      },
      ...(i.byId.get(r!.id)?.source_status_history ?? []).map((x: any) => ({
        ...x,
        record_id: r!.id,
      })),
    ]);
    res.json({ events: events.slice(0, 200), bounded: true });
  });
  app.get("/api/reviews", async (req, res) => {
    const d = deps();
    await d.sync.refresh();
    const { p, n } = page(req),
      items = d.sync.current!.index.reviews.slice((p - 1) * n, p * n);
    const annotations = [];
    for (const item of items) {
      for (const key of await d.store.keys("reviews/" + hash(item.id) + "/")) {
        const value = await d.store.read(key);
        if (value) annotations.push(JSON.parse(value.toString("utf8")));
      }
    }
    res.json({
      items,
      total: d.sync.current!.index.reviews.length,
      annotations,
    });
  });
  app.post("/api/reviews/:id", async (req, res) => {
    const d = deps();
    d.auth.csrf(
      req.headers.origin,
      req.get("X-CSRF-Token"),
      res.locals.session,
    );
    await d.sync.refresh();
    const id = String(req.params.id);
    if (!d.sync.current!.index.reviews.some((x) => x.id === id))
      throw new Fault("REVIEW_NOT_FOUND", 404);
    const { decision, note = "" } = req.body ?? {};
    if (
      !["DUPLICATE", "VERSION", "UPDATE", "CONFLICT", "UNRELATED"].includes(
        decision,
      ) ||
      typeof note !== "string" ||
      note.length > 2000
    )
      throw new Fault("INVALID_ANNOTATION", 400);
    const annotation = {
      id: randomUUID(),
      review_id: id,
      decision,
      note,
      actor_id: res.locals.session.user.id,
      createdAt: new Date().toISOString(),
      snapshot: d.sync.current!.version.snapshot,
      commit: d.sync.current!.version.commit,
      source_unchanged: true,
    };
    await d.store.write(
      "reviews/" + hash(id) + "/" + annotation.id + ".json",
      Buffer.from(JSON.stringify(annotation)),
    );
    res.status(201).json(annotation);
  });
  app.use("/api", (req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  // Only these generic static files can be served; no filesystem/catalog routes.
  const root = fileURLToPath(new URL("../public/", import.meta.url));
  for (const [route, file] of [
    ["/", "index.html"],
    ["/app.js", "app.js"],
    ["/style.css", "style.css"],
  ])
    app.get(route, (req, res) => res.sendFile(file, { root }));
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const e = err instanceof Fault ? err : new Fault("REQUEST_FAILED");
    res.status(e.status).json({ error: e.code });
  });
  return app;
}
