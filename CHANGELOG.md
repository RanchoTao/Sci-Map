# Changelog

## 0.1.0 (unreleased)

- Public verdict ledger: one JSON record per tested hypothesis under `ledger/<domain>/`, with mandatory scope, typed verdicts and graded evidence.
- `tools/ledger.py`: validate, search, new, build, repro, import-nk.
- CI validates records and re-runs cheap repro commands on pull requests; evidence levels are never upgraded automatically.
- English/Chinese web interface; GitHub Pages publishes the public ledger.
- MIT license for code, CC BY 4.0 for ledger data; contribution, agent, conduct and security guides.
- Renamed from Research Atlas to Sci-Map.

## Before 0.1.0

- Private, provenance-preserving research catalog built from hash-verified machine archives (`build_index.py`).
