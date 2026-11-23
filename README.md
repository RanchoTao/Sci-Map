# Sci-Map

**Make AI-driven research auditable by humans.** Sci-Map turns the hundreds of experiments an autoresearch system runs overnight into a map a person can read in minutes: what was tried, what died and why, what still stands, and which conclusions deserve a second look.

> 让人能看懂、能审计 AI 做的研究。AI 一夜能跑几百个实验，人却读不完日志。Sci-Map 把每个被检验过的假设变成一条带适用范围、带证据等级的判决，再画成一张人能快速扫过的地图：哪些方向已经死了、为什么死、哪些还活着、哪些结论最值得复查。失败也是贡献。

## Why

Autoresearch systems such as [karpathy/autoresearch](https://github.com/karpathy/autoresearch) and [AutoResearchClaw](https://github.com/aiming-lab/AutoResearchClaw) now produce results faster than anyone can review them. The bottleneck has moved from running experiments to *understanding and trusting* them. Reading raw logs or generated papers doesn't scale, and most failures never leave the machine they ran on, so the next agent walks into the same dead end ([recent work](https://arxiv.org/abs/2606.21024) shows that sharing structured failures makes agents better and cheaper).

Sci-Map takes a cognitive-load-first approach to this oversight problem:

- **Small, structured units.** Every result becomes one verdict: hypothesis, scope, verdict, cause, evidence. You review claims, not transcripts.
- **Verdicts that keep distinctions humans care about.** `KILLED_IN_SCOPE` is not `IMPLEMENTATION_FAILED`; a literature collision is not a negative result; `INCONCLUSIVE` stays inconclusive.
- **Scope is mandatory.** A kill at 10M parameters says nothing about 10B unless someone tests it.
- **Evidence strength is visible.** `CLAIMED → SOURCE_DOCUMENTED → ARTIFACT_LINKED → CI_REPRODUCED → INDEPENDENTLY_REPRODUCED`. Cheap claims carry a repro command that CI re-runs.
- **A map, not a log.** Records are linked into `Problem → Hypothesis → Experiment → Evidence → Verdict → Follow-up` and browsed visually, so the state of a research direction is visible at a glance.
- **Git is the database.** One JSON file per record under `ledger/<domain>/<id>.json`; review, history and forks come from git. Humans and agents both contribute, and an agent always names a responsible human operator.

The interface is under active redesign around audit workflows: what changed since you last looked, ten-second audit cards, and highlighting weakly supported verdicts that block large parts of the map.

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

## Licenses

Code: [MIT](LICENSE). Ledger data: [CC BY 4.0](ledger/LICENSE.md) unless a record states otherwise. Python 3.10+, standard library only; the web UI has no external dependencies, telemetry or remote scripts. To cite Sci-Map, see [CITATION.cff](CITATION.cff).

## Related work

- [karpathy/autoresearch](https://github.com/karpathy/autoresearch): single-GPU agent experiment loop
- [aiming-lab/AutoResearchClaw](https://github.com/aiming-lab/AutoResearchClaw): idea-to-paper pipeline with cross-run lessons
- [hch-wang/Negative_Knowledge](https://github.com/hch-wang/Negative_Knowledge): typed failure records as agent memory
- alphaXiv AI track, "A Society of AI Scientists": an agent preprint server with a claim ledger
- autoresearch@home, Hyperspace AGI: distributed AutoResearch that shares best results within a single benchmark

Sci-Map aims to sit beside systems like these as the human-facing layer: a shared, auditable record of what was tried and what happened.
