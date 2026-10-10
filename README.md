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
python pipeline.py --review-catalog /private/review/derived-reviewed.json --site web
python serve.py --site web --port 8765
```

Open http://127.0.0.1:8765. No public demo records enter the real catalog. Copy `data/catalog.json` to `web/data/merged.json` for an empty UI. The server accepts only five static file routes, with no directory listing or archive download. Raw previews remain disabled unless explicitly enabled for a separately authorized use.

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

## GitHub Pages: local-only private catalog import

The publicly deployed Pages artifact is allowlisted to `index.html`, `app.js`, `style.css`, `data/merged.json` (an **empty, generated** catalog), and `.nojekyll`. Neither the private Research-Archive repository nor its contents are accessed by the public build.

1. From an authorized computer, recover the private compact snapshot according to `Research-Archive/RECOVERY.md` and verify its SHA-256 ledger.
2. Use `build_index.py --review-catalog <path-to-compact-catalog.json> --output <private-dir>/merged.json` or use a previously generated local `web/data/merged.json` after checking it has schema `atlas-catalog-v0.2`.
3. Visit the HTTPS Pages site and choose the local `merged.json` in the import panel. The browser parses it **in memory**. Refresh or click “清空内存中的私有地图” to discard the active catalog; the original file stays on disk.

This is not GitHub login, automatic cloud synchronization, or a remotely hosted private dashboard. It requires manual retrieval/transfer of the JSON to each device. Do not choose the archive itself, source manifests, secrets, or private datasets. Import is refused on non-HTTPS remote origins. Data is never intentionally posted, cached in browser storage, or included in the public Pages artifact. Avoid untrusted browser extensions, shared devices, and untrusted copies of the public website; the hosting party can change the served JavaScript.

For one-click authenticated sync later, use a separately authenticated backend (GitHub OAuth + server-side scoped access or a dedicated authenticated database with row-level security). Never embed a GitHub PAT, Supabase service-role key, or private repository content in this public client.
