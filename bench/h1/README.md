# H1 benchmark — does an agent perform better with compiled context?

Two arms, one hole, one oracle.

| | Arm A | Arm B |
|---|---|---|
| Input | ticket + repository | ticket + `annona context <task>` |
| Instruction | "explore the repository" | compiled context inline |
| Oracle | existing test suite | existing test suite |

The oracle is `npm test`. Not a rubric, not a judge model, not an opinion: the hole is
opened, the agent fills it, the suite decides.

## Run it

```bash
node bench/h1/run.ts \
  --repo=. \
  --runner=/path/to/agent-runner.sh \
  --reps=3
```

**Runner contract** — Annona never calls a model (ADR-0006):

- invoked as `<runner> <promptFile>` with `cwd` set to an isolated work copy
- may write `bench-usage.json` = `{ inputTokens, outputTokens, iterations }`
- if that file is absent those fields are reported as `null`, never estimated

Without `--runner` the harness still opens every hole, verifies each one breaks the
suite, and builds both prompts. It reports `runnerConfigured: false` and says the
success rates are meaningless.

## Dataset

Five items, 382 lines of real source, from `annona/` tasks that own code covered by the
suite. `bench/golden` is **not** used here: it contains 83 YAML files and no executable
code, so it cannot score whether a task was completed.

| Task | Hole | Lines |
|---|---|---|
| TASK-0001 | `core/src/execution/instructions.ts` | 69 |
| TASK-0002 | `mcp/src/server.ts` | 157 |
| TASK-0003 | `core/src/execution/health.ts` | 90 |
| TASK-0004 | `core/src/execution/telemetry.ts` | 65 |
| TASK-0006 | one line in `core/src/knowledge/graph.ts` | 1 |

Excluded: TASK-0009 (`replay`) and TASK-0011 (`done`). Removing their source leaves the
suite green, so there is no oracle. They are not in the dataset rather than being scored
by a weaker criterion.

The set grows on its own: any future task closed with `annona done` that owns tested
source becomes an item.

## Harness verification

Before measuring an agent, the harness was measured. Results in `verification.json`.

| Control | Runner | Result |
|---|---|---|
| Negative | does nothing | **0%** across 5 items, 10 runs |
| Positive | writes correct source | **100%** across 4 items, 8 runs |

Every hole was confirmed to break the suite before the agent was invoked
(`holesVerified: true`). A real run therefore measures the agent, not the harness.

## Prompt cost, measured

| Task | Arm A | Arm B |
|---|---|---|
| TASK-0001 | 79 | 1,001 |
| TASK-0002 | 77 | 1,000 |
| TASK-0003 | 78 | 1,141 |
| TASK-0004 | 72 | 923 |
| TASK-0006 | 71 | 622 |

Arm B's prompt is roughly 12× larger, which is the point: Annona spends tokens up front
so the agent does not spend them searching. Whether that trade pays is H1, and it is
decided by `inputTokens + outputTokens` reported by the runner, never by prompt size
alone.

## What this does not do

- It does not call a model. No key, no SDK, no retries, no streaming.
- It does not judge partial credit. A task passes or it does not.
- It does not measure the agent's own file reads unless the runner reports them.
