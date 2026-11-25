# Contributing to Sci-Map

Every tested hypothesis is welcome, especially the ones that failed. One pull request can add one or many records.

> 欢迎提交任何被检验过的假设，尤其是失败的。失败也是贡献。

## Four ways in

| You want to… | Do this |
|---|---|
| Add a result you already have | Open a PR with `ledger/<domain>/<id>.json` (start from `python tools/ledger.py new --template`) |
| Add a result but can't open a PR | Open a **Propose a record** issue; paste a JSON draft if you can and a bot checks it |
| Work on an open question | Open a **Claim an open question** issue first (see *Claims* below) |
| Dispute a verdict | Open a **Challenge a verdict** issue, or submit a contradicting record with `related: contradicts` |

## Claims

Before spending compute on a problem from the map or an `OPEN` record, claim it so two people (or two agents) don't run the same thing.

1. Open a *Claim an open question* issue naming the problem node or record id, your falsifiable hypothesis and plan.
2. Post a short status update in that issue **at least every 7 days**: what ran, what died, what's next. A claim with no activity for 7 days is labeled `claim-stale` automatically and anyone may take the question.
3. A claim is complete when you submit a record for it, with **any** verdict. `KILLED_IN_SCOPE`, `IMPLEMENTATION_FAILED` and `RESOURCE_LIMITED` all close a claim. If you stop, say so in the issue and release it; that is also a useful signal.
4. Agents can claim, but the issue names the responsible human operator, who answers questions.

## What makes a good record

1. **A falsifiable hypothesis.** "X improves Y by at least Z under setup S," not "explored X."
2. **A scope.** The conditions under which your verdict holds: data, scale, budget, seeds, baselines. Reviewers will push back on scopes broader than the evidence.
3. **The right verdict.**
   | Verdict | Use when |
   |---|---|
   | `KILLED_IN_SCOPE` | A correct implementation was tested and the hypothesis did not hold within the stated scope |
   | `IMPLEMENTATION_FAILED` | You could not get a correct implementation working; says nothing about the idea |
   | `LITERATURE_COLLISION` | Prior work already covers it (cite it in `evidence[].url`) |
   | `INVALIDATED` | An earlier positive result turned out to be wrong (leak, bug, bad eval) |
   | `RESOURCE_LIMITED` | Stopped for compute, time or data reasons before a verdict |
   | `INCONCLUSIVE` | Ran, but the test lacked the power to decide |
   | `SUPPORTED` | The hypothesis held within scope |
   | `OPEN` | Registered but not yet tested |
4. **A cause** for any kill, invalidation or failed implementation: as far as the evidence shows, why?
5. **An honest evidence level.**
   | Level | Meaning |
   |---|---|
   | `CLAIMED` | Your statement, no linked artifact |
   | `SOURCE_DOCUMENTED` | Backed by a log, notebook or excerpt you quote |
   | `ARTIFACT_LINKED` | Links to code, data or run logs others can inspect |
   | `CI_REPRODUCED` | Has a `repro` block that CI ran and matched (set by a maintainer) |
   | `INDEPENDENTLY_REPRODUCED` | Someone else confirmed it (`reproductions[]`) |

## Repro blocks

If the core observation can be checked in under 20 minutes on a CPU, add one:

```json
"repro": {
  "command": "python repro/my_check.py --seed 0",
  "timeout_minutes": 5,
  "expect": [{"metric": "val_loss_delta", "op": ">=", "value": 0.0}]
}
```

The command runs from the repository root without a shell or network secrets, and must print one JSON object of metrics as its **last** stdout line. Put small scripts under `repro/<domain>/`. Heavy experiments should link artifacts instead (`ARTIFACT_LINKED`).

## Agents

Agent-written records are welcome. Agents submit through one command that takes JSON and returns JSON:

```bash
python tools/ledger.py submit draft.json            # check only: errors, privacy problems, similar records
python tools/ledger.py submit draft.json --write    # write ledger/<domain>/<id>.json if it passes
python tools/ledger.py submit draft.json --open-pr  # also branch, commit and open a PR with the operator's gh login
```

`submit` refuses records that set `CI_REPRODUCED` or `INDEPENDENTLY_REPRODUCED` from an agent, ids that already exist, and anything the privacy gate flags. It returns `nearby` records the agent must adopt, distinguish or challenge. `contributor.kind` must be `agent`, `contributor.model` should name the system, and `contributor.operator` must name the human who is responsible for the submission and answers review comments. See [AGENTS.md](AGENTS.md).

## Review

Maintainers check that the hypothesis, scope and verdict are consistent with the evidence. They don't check whether the idea was a good one. Possible duplicates are linked with `related` (`duplicates`, `refines`, `contradicts`, `supersedes`), never silently merged. Contradicting an existing record is a normal contribution: add your record and link it with `contradicts`.

## Privacy

`validate` rejects records containing credentials, e-mail addresses, phone numbers or absolute local paths (`D:\\…`, `/home/<user>/…`); point evidence at https URLs or repository-relative paths. Don't submit unpublished work you aren't ready to share, credentials, personal data, or datasets you have no right to redistribute. Records are published under CC BY 4.0 unless the record states another license.
