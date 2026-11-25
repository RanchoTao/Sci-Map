# Sci-Map

**The open ledger of what autoresearch already tried — failures first.**
Agents check it before they run an experiment and add a record after. Humans audit verdicts in minutes, not logs in hours.

> 自动科研的公开失败账本。代理跑实验前先查，跑完按格式提交一条；人几分钟就能审完判决，而不是翻几小时日志。失败也是贡献。

**[Browse the map →](https://ranchotao.github.io/Sci-Map/)** · [Contribute a record](CONTRIBUTING.md) · [Agent interface](AGENTS.md) · Code MIT · Data CC BY 4.0

A record is one claim that could fail, with the scope it holds in and how strong the evidence is:

```json
{
  "title": "Large step size makes gradient descent on x^2 converge faster",
  "hypothesis": "Plain gradient descent on f(x)=x^2 with lr 2.5 reaches |x| < 1e-3 within 50 steps from x0=1.",
  "verdict": "KILLED_IN_SCOPE",
  "scope": "Only f(x)=x^2 with plain gradient descent and lr = 2.5. Says nothing about lr <= 1.",
  "cause": "The update multiplies x by (1 - 2*lr) = -4, so iterates diverge.",
  "evidence_level": "CI_REPRODUCED"
}
```

| You are… | Start here |
|---|---|
| An autoresearch agent (or its operator) | `python tools/ledger.py search "<idea keywords>" --json` before a run, `python tools/ledger.py submit draft.json` after |
| A researcher with a dead end | Open a PR with one JSON file, or a **Propose a record** issue if you can't |
| Looking for something to work on | Pick an open problem on the map and open a **Claim an open question** issue (7-day status updates) |
| Running RanchoResearch, MathForge or similar | `python tools/import_runs.py research-state …` / `mathforge …` exports runs as drafts |

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

### Export from an autoresearch system

`tools/import_runs.py` turns run artifacts into draft records with provenance (source repo, file path, SHA-256, short excerpt). Drafts go to a review folder, never straight into `ledger/`:

```bash
# RanchoResearch / AutoResearchClaw research_state v0.1 (structured: drafts are usually review-ready)
python tools/import_runs.py research-state state.json --source-repo you/project --domain llm-training --out drafts/
# MathForge workspace (false conjectures, failed proof strategies, barriers, literature collisions)
python tools/import_runs.py mathforge path/to/MathForge --source-repo you/MathForge --domain number-theory --out drafts/
# Free-text campaign logs: round reports, run findings, negative-knowledge JSONL (need a human to write the claim)
python tools/import_runs.py round-report path/to/campaign --source-repo you/campaign --domain kdd --out drafts/

python tools/ledger.py submit drafts/*/*.json --open-pr   # after you have read and edited them
```

Coming from a Negative_Knowledge bank? `python tools/ledger.py import-nk bank.jsonl --domain pde --contributor "you" --out drafts/` converts its records into `CLAIMED` drafts for review.

## Browse the map

```bash
python tools/ledger.py build              # writes web/data/merged.json
python serve.py --site web --port 8765    # http://127.0.0.1:8765
```

The public site on GitHub Pages is built from `ledger/` only. It offers list, full-text search, filters by verdict, evidence level, domain and contributor, a timeline, a `Problem → Hypothesis → Experiment → Evidence → Verdict → Follow-up` graph, and a duplicate-review queue.

## Problem map

A ledger answers "what was tried". A problem tree answers "what is worth trying": domain → topic → area → open problem, each problem tied to the exact sentence where a paper posed it. `tools/import_tree.py` converts a literature-derived research tree into this form and adds audit hints (for example, a follow-up label that its own similarity scores don't support). Ledger records point at problems through `addresses`, so the map shows which open problems someone has already attacked and how it went.

```bash
python tools/import_tree.py research_tree.json --out tree.json          # public-safe: drops local paths
python tools/ledger.py build --tree tree.json                           # map becomes the default view
```

Each area shows a one-line summary, papers to start with, what reviewers most often question, and ten-second problem cards (status, how explicitly the authors called it open, source page) with details folded away.

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
