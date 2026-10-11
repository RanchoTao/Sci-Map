import { Fault } from "./config.js";
import { Store, seal, unseal } from "./store.js";
import { GitHub } from "./github.js";
import { hash, Index } from "./model.js";
import { randomUUID } from "node:crypto";
export type Version = {
  snapshot: string;
  commit: string;
  commitDate: string;
  sha256: string;
  catalogKey: string;
  syncedAt: string;
  pointer: any;
};
const policyErrors = new Set([
  "APP_PERMISSIONS_NOT_MINIMAL",
  "REPOSITORY_NOT_PRIVATE",
]);
export class Sync {
  current?: { version: Version; index: Index };
  error: string | null = null;
  checked = 0;
  private pending?: Promise<void>;
  constructor(
    private gh: GitHub,
    private store: Store,
    private secret: string,
  ) {}
  async immutable(key: string, value: Buffer) {
    const old = await this.store.read(key);
    if (old) {
      if (hash(old) !== hash(value))
        throw new Fault("IMMUTABLE_OBJECT_CONFLICT");
      return;
    }
    try {
      await this.store.write(key, value);
    } catch {
      const after = await this.store.read(key);
      if (!after || hash(after) !== hash(value))
        throw new Fault("PERSISTENCE_FAILED");
    }
  }
  async loadLastGood() {
    const keys = (await this.store.keys("verified/")).sort().reverse();
    for (const key of keys) {
      try {
        const b = await this.store.read(key);
        if (!b) continue;
        const v = unseal<Version>(b, this.secret),
          raw = await this.store.read(v.catalogKey);
        if (!raw || hash(raw) !== v.sha256) continue;
        this.current = {
          version: v,
          index: new Index(JSON.parse(raw.toString("utf8"))),
        };
        return;
      } catch {
        /* Reject corrupted saved versions; never emit their contents. */
      }
    }
  }
  async refresh(force = false) {
    if (this.pending) {
      await this.pending;
      return this.view();
    }
    if (!force && this.current && Date.now() - this.checked < 60000)
      return this.view();
    this.pending = this.run();
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
    }
    return this.view();
  }
  private async run() {
    try {
      if (!this.current) await this.loadLastGood();
      const token = await this.gh.installationToken(),
        head = await this.gh.head(token);
      if (this.current?.version.commit === head.sha) {
        this.checked = Date.now();
        this.error = null;
        return;
      }
      const pointer = JSON.parse(
        (await this.gh.file("CURRENT.json", head.sha, token)).toString("utf8"),
      );
      if (
        typeof pointer.snapshot !== "string" ||
        !/^snapshots\/[A-Za-z0-9_-]+$/.test(pointer.snapshot)
      )
        throw new Fault("INVALID_SNAPSHOT_POINTER");
      const sums = JSON.parse(
        (
          await this.gh.file(
            pointer.snapshot + "/SHA256SUMS.json",
            head.sha,
            token,
          )
        ).toString("utf8"),
      );
      if (
        sums.snapshot !== pointer.snapshot ||
        sums.format !== "compact-knowledge-sha256-v1"
      )
        throw new Fault("INVALID_CHECKSUM_LEDGER");
      const expected = sums.files?.["compact-catalog.json"];
      if (
        !expected ||
        !/^[a-f0-9]{64}$/.test(expected.sha256) ||
        !Number.isSafeInteger(expected.bytes) ||
        expected.bytes > 100000000
      )
        throw new Fault("INVALID_CATALOG_CHECKSUM");
      const bindKey = "bindings/" + hash(pointer.snapshot) + ".json",
        bind = await this.store.read(bindKey);
      if (
        bind &&
        unseal<{ sha256: string }>(bind, this.secret).sha256 !== expected.sha256
      )
        throw new Fault("IMMUTABLE_SNAPSHOT_CHANGED");
      const catalogKey = "catalogs/" + expected.sha256 + ".json";
      let raw = await this.store.read(catalogKey);
      if (!raw || hash(raw) !== expected.sha256)
        raw = await this.gh.file(
          pointer.snapshot + "/compact-catalog.json",
          head.sha,
          token,
        );
      if (raw.length !== expected.bytes || hash(raw) !== expected.sha256)
        throw new Fault("SNAPSHOT_INTEGRITY_FAILED");
      const index = new Index(JSON.parse(raw.toString("utf8")));
      if (pointer.source_occurrences !== index.records.length)
        throw new Fault("RECORD_COUNT_MISMATCH");
      if (this.current && head.date < this.current.version.commitDate)
        throw new Fault("SNAPSHOT_ROLLBACK_REJECTED");
      await this.immutable(catalogKey, raw);
      if (!bind) {
        try {
          await this.store.write(
            bindKey,
            seal({ sha256: expected.sha256 }, this.secret),
          );
        } catch {
          const raced = await this.store.read(bindKey);
          if (
            !raced ||
            unseal<{ sha256: string }>(raced, this.secret).sha256 !==
              expected.sha256
          )
            throw new Fault("IMMUTABLE_SNAPSHOT_CHANGED");
        }
      }
      const version: Version = {
        snapshot: pointer.snapshot,
        commit: head.sha,
        commitDate: head.date,
        sha256: expected.sha256,
        catalogKey,
        syncedAt: new Date().toISOString(),
        pointer,
      };
      const receiptKey =
        "verified/" +
        head.date.replace(/[:.]/g, "-") +
        "-" +
        head.sha +
        ".json";
      const existing = await this.store.read(receiptKey);
      if (!existing) {
        try {
          await this.store.write(receiptKey, seal(version, this.secret));
        } catch {
          const raced = await this.store.read(receiptKey);
          if (
            !raced ||
            unseal<Version>(raced, this.secret).sha256 !== version.sha256
          )
            throw new Fault("PERSISTENCE_FAILED");
        }
      }
      this.current = { version, index };
      this.checked = Date.now();
      this.error = null;
    } catch (e) {
      this.error = e instanceof Fault ? e.code : "SYNC_FAILED";
      this.checked = Date.now();
      try {
        await this.store.write(
          "sync-errors/" +
            new Date().toISOString().replace(/[:.]/g, "-") +
            "-" +
            randomUUID() +
            ".json",
          seal(
            {
              code: this.error,
              createdAt: new Date().toISOString(),
              lastVerifiedSnapshot: this.current?.version.snapshot ?? null,
            },
            this.secret,
          ),
        );
      } catch {
        /* A failed storage service cannot persist its own outage. The API still reports the safe code. */
      }
      if (policyErrors.has(this.error)) throw new Fault(this.error, 403);
      if (!this.current) throw new Fault(this.error);
    }
  }
  view() {
    if (this.error && policyErrors.has(this.error))
      throw new Fault(this.error, 403);
    if (!this.current) throw new Fault("NO_VERIFIED_SNAPSHOT");
    const { version, index } = this.current;
    return {
      snapshot: version.snapshot,
      commit: version.commit,
      syncedAt: version.syncedAt,
      checkedAt: new Date(this.checked).toISOString(),
      stale: !!this.error,
      error: this.error,
      archiveGate: version.pointer.ARCHIVE_GATE ?? "BLOCKED",
      statistics: index.statistics,
      counts: {
        records: index.records.length,
        machines: index.statistics.by_machine,
      },
      reviewCount: index.reviews.length,
      crossMachineReviewCount: index.reviews.filter(
        (r) =>
          (r.record_ids ?? []).some(
            (id: string) => index.byId.get(id)?.machine === "RANCHO",
          ) &&
          (r.record_ids ?? []).some(
            (id: string) => index.byId.get(id)?.machine === "TAO",
          ),
      ).length,
      scientific_unique_problem_count: null,
    };
  }
}
