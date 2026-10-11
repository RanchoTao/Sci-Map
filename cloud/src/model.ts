import { createHash } from "node:crypto";
import { Fault } from "./config.js";
export type RecordData = { id: string; title: string; [key: string]: any };
export const hash = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
export const sourceReviewed = (r: RecordData) =>
  /^(SOURCE_DOCUMENTED|SOURCE_DOCUMENT_REVIEWED)/.test(r.verification ?? "") ||
  [
    "REVIEWED",
    "HISTORICAL_RECEIPT_INTEGRITY_VERIFIED",
    "HISTORICAL_AGGREGATE_RECEIPT_INTEGRITY_VERIFIED",
    "TAO_SOURCE_ARITHMETIC_CHECKED_PEER_RECEIPT",
  ].includes(r.verification);
export const failures = new Set([
  "KILL",
  "FAILED_REPLICATION",
  "INVALIDATED",
  "INCONCLUSIVE",
  "HOLD",
  "BLOCKED",
  "LITERATURE_COLLISION",
  "RESOURCE_LIMIT",
]);
export function failure(r: RecordData) {
  return [
    r.status,
    r.historical_verdict,
    r.historical_status_group,
    r.cause,
  ].some(
    (v) =>
      typeof v === "string" &&
      [...failures].some((f) =>
        new RegExp("(^|[\\s/_|,;])" + f + "($|[\\s/_|,;])").test(v),
      ),
  );
}
export class Index {
  records: RecordData[];
  byId: Map<string, RecordData>;
  search: Map<string, string>;
  reviews: any[];
  statistics: any;
  constructor(public catalog: any) {
    if (!Array.isArray(catalog.records) || catalog.records.length > 100000)
      throw new Fault("CATALOG_SCHEMA_INVALID");
    this.records = catalog.records;
    this.byId = new Map();
    this.search = new Map();
    for (const r of this.records) {
      if (
        typeof r.id !== "string" ||
        typeof r.title !== "string" ||
        this.byId.has(r.id)
      )
        throw new Fault("DUPLICATE_OR_INVALID_RECORD");
      this.byId.set(r.id, r);
      this.search.set(r.id, JSON.stringify(r).toLocaleLowerCase());
    }
    this.reviews = (catalog.semantic_review ?? []).map((r: any) => ({
      ...r,
      id: "review-" + hash(JSON.stringify(r)).slice(0, 32),
    }));
    const counts = (key: string) =>
      this.records.reduce((o: any, r) => {
        const value = String(r[key] ?? "UNSPECIFIED");
        o[value] = (o[value] ?? 0) + 1;
        return o;
      }, {});
    this.statistics = {
      scoped_topic_records: this.records.filter(
        (r) => r.kind !== "source-document" && r.kind !== "history-question",
      ).length,
      source_occurrences: this.records.length,
      history_question_leads: this.records.filter(
        (r) => r.kind === "history-question",
      ).length,
      source_documented_records: this.records.filter(sourceReviewed).length,
      historical_result_receipts_checked: this.records.filter(
        (r) => r.result_verified === true,
      ).length,
      independently_reproduced_results: this.records.filter(
        (r) => r.verification === "INDEPENDENTLY_REPRODUCED",
      ).length,
      unreviewed: this.records.filter((r) => !sourceReviewed(r)).length,
      by_status: counts("status"),
      by_domain: counts("domain"),
      by_machine: counts("machine"),
      by_verification: counts("verification"),
      tags: [...new Set(this.records.flatMap((r) => r.tags ?? []))].sort(),
    };
  }
  query(
    q: string,
    machine: string,
    status: string,
    failed: boolean,
    page: number,
    limit: number,
    domain = "",
    tag = "",
  ) {
    const matches = this.records.filter(
      (r) =>
        (!q || this.search.get(r.id)!.includes(q.toLocaleLowerCase())) &&
        (!machine ||
          r.machine === machine ||
          (r.origin_machines ?? []).includes(machine)) &&
        (!status || r.status === status) &&
        (!domain || r.domain === domain) &&
        (!tag || (r.tags ?? []).includes(tag)) &&
        (!failed || failure(r)),
    );
    return {
      total: matches.length,
      page,
      records: matches.slice((page - 1) * limit, page * limit).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        historical_verdict: r.historical_verdict,
        verification: r.verification,
        machine: r.machine,
        domain: r.domain,
        scope: r.scope,
        summary: String(r.summary ?? "").slice(0, 700),
        result_verified: r.result_verified,
        date: r.date,
      })),
    };
  }
  related(id: string) {
    const r = this.byId.get(id);
    if (!r) throw new Fault("RECORD_NOT_FOUND", 404);
    const candidates = new Set<string>();
    for (const review of this.reviews) {
      if (review.record_ids?.includes(id))
        for (const rid of review.record_ids) candidates.add(rid);
    }
    const ids = new Set<string>(r.source_ids ?? []);
    const records = this.records
      .filter(
        (x) =>
          x.id !== id &&
          (candidates.has(x.id) ||
            (x.source_ids ?? []).some((s: string) => ids.has(s))),
      )
      .slice(0, 40)
      .map((x) => ({
        id: x.id,
        title: x.title,
        machine: x.machine,
        status: x.status,
        verification: x.verification,
        scope: x.scope,
        match_basis: candidates.has(x.id)
          ? "UNREVIEWED_RELATION_PROPOSAL"
          : "EXPLICIT_SOURCE_ID_ASSOCIATION",
      }));
    return {
      records,
      semantics:
        "Review proposals and source ID associations; histories remain separate",
    };
  }
  graph(id: string, limit: number) {
    const r = this.byId.get(id);
    if (!r) throw new Fault("RECORD_NOT_FOUND", 404);
    const nodes: any[] = [],
      edges: any[] = [];
    const evs = (r.evidence ?? []).map((e: any) =>
      Object.fromEntries(
        Object.entries(e).filter(([k]) =>
          [
            "path",
            "source_path",
            "sha256",
            "machine",
            "source_origin",
            "line_start",
            "line_end",
            "label",
          ].includes(k),
        ),
      ),
    );
    const add = (kind: string, value: any, provenance = evs) => {
      if (!value || nodes.length >= limit) return null;
      const nid =
        kind.toLowerCase() +
        "-" +
        hash(id + ":" + kind + ":" + JSON.stringify(value)).slice(0, 24);
      nodes.push({
        id: nid,
        type: kind,
        label:
          typeof value === "string"
            ? value.slice(0, 500)
            : JSON.stringify(value).slice(0, 500),
        record_id: id,
        provenance,
        scope: r.scope,
        verification: r.verification,
      });
      return nid;
    };
    const area = add("Research Area", r.domain ?? "UNCLASSIFIED"),
      problem = add("Problem", r.title);
    edges.push({
      source: area,
      target: problem,
      type: "contains",
      provenance: evs,
    });
    for (const [kind, value] of [
      ["Hypothesis", r.hypothesis],
      ["Experiment", r.experiment],
      ["Verdict", sourceReviewed(r) ? r.status : undefined],
      ["Follow-up", r.follow_up ?? r.next_step],
    ]) {
      const child = add(kind, value);
      if (child)
        edges.push({
          source: problem,
          target: child,
          type: "source-recorded-" + kind.toLowerCase(),
          provenance: evs,
        });
    }
    for (const e of evs) {
      const evidence = add("Evidence", e.label ?? e.path ?? "Source", [e]);
      if (evidence)
        edges.push({
          source: problem,
          target: evidence,
          type: "documented-by",
          provenance: [e],
        });
    }
    for (const rel of r.relations ?? []) {
      const target = this.byId.get(rel.target);
      if (target && nodes.length < limit) {
        const nid = add("Related Problem", target.title, rel.provenance ?? evs);
        nodes[nodes.length - 1].record_id = target.id;
        edges.push({
          source: problem,
          target: nid,
          type: rel.type,
          provenance: rel.provenance ?? evs,
        });
      }
    }
    return {
      nodes,
      edges,
      semantics: "SOURCE_ASSOCIATION_ONLY; co-occurrence is not causation",
    };
  }
}
