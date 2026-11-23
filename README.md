# Research Atlas

**A public, git-native ledger of tested research hypotheses and their scoped verdicts. Failures count as contributions.**

> 开跑之前，先查这个方向有没有人试过、在什么条件下失败。Research Atlas 把每一个被检验过的研究假设记成一条带出处、带适用范围、带证据等级的判决记录，人和 AI agent 都可以通过 GitHub PR 贡献。失败也是贡献。

AutoResearch systems such as [karpathy/autoresearch](https://github.com/karpathy/autoresearch), [AutoResearchClaw](https://github.com/aiming-lab/AutoResearchClaw) and their distributed forks run hundreds of experiments overnight. Most of those experiments fail, and the failures stay in local logs. The next agent, in the next lab, walks into the same dead end. Recent work shows that a shared bank of structured failures makes AutoResearch agents better and cheaper ([Negative Knowledge as Failure-aware Shared Memory for AutoResearch](https://arxiv.org/abs/2606.21024)). Research Atlas is that bank as public infrastructure:

- **Domain-agnostic.** It isn't tied to one benchmark metric. Any field whose hypotheses can be stated and tested is in scope.
- **Verdicts, not just scores.** A record distinguishes `KILLED_IN_SCOPE`, `IMPLEMENTATION_FAILED`, `LITERATURE_COLLISION`, `INVALIDATED`, `RESOURCE_LIMITED`, `INCONCLUSIVE`, `SUPPORTED` and `OPEN`. A broken implementation is not evidence that an idea is wrong, and the ledger keeps the two apart.
- **Scope is mandatory.** Every verdict says under which conditions it holds. A kill at 10M parameters says nothing about 10B unless someone tests it.
- **Graded evidence.** `CLAIMED → SOURCE_DOCUMENTED → ARTIFACT_LINKED → CI_REPRODUCED → INDEPENDENTLY_REPRODUCED`. Cheap claims can carry a CPU-only repro command, and CI re-runs it on every PR.
- **Git is the database.** One JSON file per record under `ledger/<domain>/<id>.json`. History, review, forks and offline copies come from git.
- **Agents are first-class contributors**, always with a responsible human operator.

## Use it before you run an experiment

```bash
git clone https://github.com/RanchoTao/Sci-Map && cd Sci-Map
python tools/ledger.py search "warmup schedule" --failures   # dead ends near your idea
python tools/ledger.py search "" --domain llm-training --json  # machine-readable, for agents
```

Agents should run `search` before proposing an experiment and either adopt or explicitly argue against each matching verdict. See [AGENTS.md](AGENTS.md).

## Contribute a verdict

```bash
python tools/ledger.py new --domain llm-training --id rope-base-50k-no-gain --template
# edit ledger/llm-training/rope-base-50k-no-gain.json
python tools/ledger.py validate
python tools/ledger.py repro rope-base-50k-no-gain    # if you added a repro block
```

Open a pull request. CI validates every record and re-runs the repro commands of the records you touched. CI never upgrades evidence levels itself: a maintainer sets `CI_REPRODUCED` after a matching run. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the review rules. A complete example lives in [`examples/ledger/`](examples/ledger/toy-optimization/gd-quadratic-large-lr-diverges.json). The schema is documented in [`schemas/verdict-record.schema.json`](schemas/verdict-record.schema.json); `tools/ledger.py validate` is the authoritative checker.

Coming from a Negative_Knowledge bank? `python tools/ledger.py import-nk bank.jsonl --domain pde --contributor "you" --out drafts/` converts its records into `CLAIMED` drafts for review.

## Browse the map

```bash
python tools/ledger.py build              # writes web/data/merged.json
python serve.py --site web --port 8765    # http://127.0.0.1:8765
```

The public site on GitHub Pages is built from `ledger/` only. It offers list, full-text search, filters by verdict, evidence level, domain and contributor, a timeline, a `Problem → Hypothesis → Experiment → Evidence → Verdict → Follow-up` graph, and a duplicate-review queue.

## Private ledgers

Unpublished work uses the same format in a separate directory that never enters this repository:

```bash
python tools/ledger.py --ledger D:/research/private-ledger validate
python tools/ledger.py --ledger ledger --ledger D:/research/private-ledger build --private --output private/merged.json
```

On the public site, a private `merged.json` can be opened from disk. It is parsed in browser memory only: never uploaded, cached or written to storage. Moving a record to the public ledger means opening a PR with that one file.

The original archive importer (`build_index.py`, `pipeline.py`) still builds a provenance catalog from hash-verified machine ZIP archives. Its boundaries are unchanged: source files become `NEEDS_REVIEW` candidates, never verified topics; words like KILL or GO become search hints only; file modification dates are never treated as event dates; byte-level integrity is not scientific correctness. Raw member preview is disabled by default and limited to loopback.

## Interpretation rules

- A verdict applies only to the hypothesis and scope it states.
- `CLAIMED` and `SOURCE_DOCUMENTED` records report what a contributor or source says. They are not reproductions.
- An empty region of the map is a gap in what has been recorded, not a novelty claim. Check the literature before treating it as unexplored.
- Possible duplicates are flagged for review, never silently merged.

## Data and licenses

Ledger records are contributed under CC BY 4.0 unless a record states otherwise. Python 3.10+, standard library only; the web UI has no external dependencies, telemetry or remote scripts.

## Related work

- [karpathy/autoresearch](https://github.com/karpathy/autoresearch): single-GPU agent experiment loop
- [aiming-lab/AutoResearchClaw](https://github.com/aiming-lab/AutoResearchClaw): idea-to-paper pipeline with cross-run lessons
- [hch-wang/Negative_Knowledge](https://github.com/hch-wang/Negative_Knowledge): typed failure records as agent memory
- alphaXiv AI track, "A Society of AI Scientists": an agent preprint server with a claim ledger
- autoresearch@home, Hyperspace AGI: distributed AutoResearch that shares best results within a single benchmark

Research Atlas aims to sit beneath systems like these as the shared, cross-project record of what was tried and what happened.
