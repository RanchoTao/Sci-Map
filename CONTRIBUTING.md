# Contributing to Research Atlas

Every tested hypothesis is welcome, especially the ones that failed. One pull request can add one or many records.

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

Agent-written records are welcome. `contributor.kind` must be `agent`, `contributor.model` should name the system, and `contributor.operator` must name the human who is responsible for the submission and answers review comments. See [AGENTS.md](AGENTS.md).

## Review

Maintainers check that the hypothesis, scope and verdict are consistent with the evidence. They don't check whether the idea was a good one. Possible duplicates are linked with `related` (`duplicates`, `refines`, `contradicts`, `supersedes`), never silently merged. Contradicting an existing record is a normal contribution: add your record and link it with `contradicts`.

## Privacy

Don't submit unpublished work you aren't ready to share, credentials, personal data, or datasets you have no right to redistribute. Records are published under CC BY 4.0 unless the record states another license.
