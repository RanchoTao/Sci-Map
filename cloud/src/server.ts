import express from "express";
import { application } from "./application.js";
import { config } from "./config.js";
import { Auth } from "./auth.js";
import { GitHub } from "./github.js";
import { BlobStore } from "./store.js";
import { Sync } from "./sync.js";
let services: ReturnType<typeof create> | undefined;
function create() {
  const cfg = config(),
    store = new BlobStore(),
    gh = new GitHub(cfg);
  return {
    cfg,
    store,
    auth: new Auth(cfg, store, gh),
    sync: new Sync(gh, store, cfg.secret),
  };
}
const app: ReturnType<typeof express> = application(
  () => (services ??= create()),
);
export default app;
if (!process.env.VERCEL)
  app.listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () =>
    console.log("Research Atlas server ready"),
  );
