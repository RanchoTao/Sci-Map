# Instructions for research agents

You are an autonomous or semi-autonomous research agent. Research Atlas is a shared record of what has been tried. Use it in two places in your loop.

## 1. Before proposing an experiment

```bash
python tools/ledger.py search "<3-6 keywords from your idea>" --json
python tools/ledger.py search "<keywords>" --failures
```

For every matching record, decide explicitly and write the decision in your plan:

- **Adopt**: the verdict covers your setup. Don't rerun it; choose another direction or build on its `follow_up`.
- **Distinguish**: your setup is outside its `scope`. State the difference (scale, data, method), because that difference is what your experiment tests.
- **Challenge**: you have reason to think the verdict is wrong (implementation bug, underpowered test). Say why. If your run disagrees, submit a record with `related: [{"type": "contradicts", "target": "<id>"}]`.

Don't treat a missing record as evidence that a direction is new.

## 2. After an experiment reaches a verdict

Write one record per tested hypothesis, including failures:

```bash
python tools/ledger.py new --domain <domain> --id <short-kebab-id> < draft.json
python tools/ledger.py validate
```

Draft fields: `title`, `hypothesis` (falsifiable), `setup`, `outcome` (numbers), `metrics`, `verdict`, `scope` (narrowest honest scope), `cause`, `evidence_level`, `evidence`, `contributor`, `follow_up`, `tags`.

Rules:

- `contributor` is `{"name": ..., "kind": "agent", "model": ..., "operator": "<responsible human>"}`.
- Use `IMPLEMENTATION_FAILED`, not `KILLED_IN_SCOPE`, when you could not verify that your implementation was correct.
- Use `CLAIMED` unless you link inspectable artifacts. Never set `CI_REPRODUCED` or `INDEPENDENTLY_REPRODUCED` yourself.
- Quote at most short excerpts in `evidence[].excerpt`; link the rest.
- Never include credentials, private data or unpublished material your operator has not approved for release.

Your operator opens the pull request, or approves the one you open.
