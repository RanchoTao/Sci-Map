# Research Atlas

Local, provenance-preserving Research Map. The public repository contains only generic software and an empty catalog. Private machine evidence and derived indexes are never committed here.

The current migration scope is **research topics and source-supported results only**. Procedure files, datasets, experiment binaries and raw session archives are excluded. The compact catalog contains scoped judgments, concise result metrics, provenance excerpts and file hashes. Source-documented historical conclusions do not imply independently rerun experiments.

```powershell
python pipeline.py --review-catalog /private/review/derived-reviewed.json --site web
python serve.py --site web --port 8765
```

Raw member preview is disabled by default. Portable embedded excerpts are sufficient for reviewing the archived knowledge; restoring the full original experimental environment is outside this compact archive's scope.

## Build and run

Python 3.10+; no third-party packages or remote scripts required.

```powershell
python -m unittest discover -s tests -v
python build_index.py --archive /private/RANCHO-part0001.zip --archive /private/TAO-part0001.zip --manifest /private/RANCHO_ARCHIVE_MANIFEST.jsonl --seed /private/derived-reviewed.json --output web/data/merged.json
python serve.py --site web --evidence-dir /private/evidence --manifest /private/RANCHO_ARCHIVE_MANIFEST.jsonl --manifest /private/TAO_ARCHIVE_MANIFEST.jsonl --port 8765
```

Open http://127.0.0.1:8765. `--seed` is optional and explicit; no public demo records enter the real catalog. Copy `data/catalog.json` to `web/data/merged.json` for an empty UI.

The local server exposes only five static file routes and two bounded APIs. Optional raw evidence preview requires explicit `--enable-raw-preview`, an exact catalog record, archive name, manifest member and matching SHA-256. No generic directory listing, ZIP download or arbitrary local file route is provided. Sensitive filenames and Git internals cannot be previewed; derived text and previews redact common credential patterns. Original private ZIP content remains unchanged.

## Model and review boundaries

`Research Area → Problem → Hypothesis → Experiment → Evidence → Verdict → Follow-up`

Every node and relation carries original provenance. Source files generate **NEEDS_REVIEW** candidates, not verified scientific topics. A matching section heading creates an explicitly unreviewed section node. Words such as KILL or GO become search hints only. File modification dates carry `FILE_MTIME` provenance and are not inferred event dates. Verified integrity proves that bytes match a manifest, not that the scientific claim is correct.

Review records may supply `kind`, `status`, `scope`, `cause`, `verification: SOURCE_DOCUMENTED`, source lines and explicit historical dates. A scoped KILL, failed implementation, literature collision, invalidated result, resource limit and inconclusive assay must remain distinct. Duplicate byte contents share one document record but preserve all source paths and machines. Identical titles with different content create review proposals; neither file nor conclusion is silently merged.

List, full-text query, domain/project/status/machine/tag filters, pagination, source timeline, graph, duplicate review and global file inventory work without external dependencies. Graph views show at most 100 source nodes on the current page. The unknown area of the map is an inventory gap, not a novelty claim; new literature verification is required before exploring a purported blank area.

## Incremental imports and portability

Re-run the same `build_index.py` command on the same archive set. Content-addressed IDs are stable. An explicit seed can preserve curated records; evidence origins are appended idempotently. `--manifest` adds logical paths that reference duplicate content in earlier shards. Multiple shards of one machine retain independent source archive metadata.

Version v0.1 indexes migrate additively to v0.2; missing verification defaults to UNREVIEWED and missing dates to UNSPECIFIED. Do not replace original evidence when migrating the derived index.

For a new machine or account in compact mode: clone the private knowledge repository, verify downloaded catalog/report hashes against its ledger, clone this generic software, rebuild the index from `derived-reviewed.json`, run tests and launch the loopback server. Embedded short excerpts, scoped topic IDs and source hashes restore the knowledge catalog independently of old absolute paths. External credentials and remote permissions need independent restoration. Compact mode does not preserve full experimental code/data/history. A private repository URL alone is not proof that remote objects remain downloadable: keep download-and-hash receipts and explicit BLOCKED gaps.

This map does not start or schedule AutoResearch. Scientific restart requires an independently verified ARCHIVE_GATE=PASS, both machine manifests, restored remote evidence and a verified scheduler.
