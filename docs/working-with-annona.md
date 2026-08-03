# Working with Annona

Day to day. Assumes you have finished [Getting Started](getting-started.md).

## The loop

```
discovery → brief → knowledge → plan → implement → review → done
                                 ↑                    │
                                 └────────────────────┘
```

The agent drives it. You confirm the brief, approve the plan, and accept the work.

> **Designed, not yet observed.** The loop is specified in the generated instruction
> files and the commands behind it are tested, but no external agent has yet completed a
> task end to end with them. If yours behaves differently, that is a finding — tell us.

If you find yourself typing Annona commands during a normal task, something is wrong —
either the agent is not reading the generated instructions, or that is friction worth
recording.

## When to compile

Whenever `annona/` changes. `annona done` does it for you, so in practice: rarely by
hand. Compile is incremental — unchanged source does no work.

`annona compile --clean` forces a full rebuild. You need it almost never; it is for when
you suspect the runtime is wrong, and the runtime is disposable anyway.

## Working with Git

| Commit | Ignore |
|---|---|
| `annona.yaml` | `.annona/` |
| `annona/**` | `CLAUDE.md`, `AGENTS.md`, `CODEX.md`, `GEMINI.md` |

Knowledge changes belong in the same commit as the code they describe. A reviewer should
see the decision and its implementation together.

Two people editing different features never collide: entities are one file each, under
their own feature folder. Two people creating an entity at the same time can pick the
same id — `annona check` reports it as a duplicate and the fix is a rename.

`git log --follow annona/adrs/ADR-0007.yaml` tells you who decided something and when.
Annona does not store that: Git already does it better.

## Working with an issue tracker

There is no integration. Deliberately, for now.

Paste the ticket into the conversation, or let your agent fetch it if it has a tool for
that. Either way the agent takes it from there. Put the ticket key in the task so the
link survives:

```yaml
id: TASK-0042
kind: task
title: Add refund endpoint
status: ready
tags: [PAY-1204]
implements: [REQ-0018]
touches: [CMP-0003]
```

The tracker owns scheduling, assignment and status for the business. Annona owns why the
work exists and what governs it. Do not try to mirror one in the other.

## Onboarding a new developer

```bash
git clone <your-project> && cd <your-project> && annona compile
```

That is the whole setup. Compile regenerates the runtime and the agent instructions from
what is in Git.

Then, instead of reading a wiki:

```bash
annona list feature          # what this system does
annona list rule             # what the team decided to always do
annona get ADR-0001          # why something is the way it is
annona doctor                # where the knowledge is thin
```

`annona doctor` is a fair first read: it shows orphan entities, rules that constrain
nothing, decisions that decide nothing, and requirements no test verifies.

## When MISSING_CONTEXT appears

It means a required kind is absent. The output names which:

```
--- MISSING_CONTEXT  0/8000 tokens  0 nodes
missing requirement: TASK-0042 implements no requirement
```

| Message | What it means |
|---|---|
| `implements no requirement` | The task declares no `implements`, or it points at something that does not exist |
| `no feature governs this work` | The requirement it implements has no parent feature |
| `touches no known component` | The task declares no `touches` |
| `task not found` | The id does not exist — check for a typo |
| `X was retrieved but does not fit in budget` | Knowledge exists but the budget is too small; raise `--budget` |

**This is not an error to work around.** It is Annona refusing to let an agent invent
architecture it was never told about. The fix is to add the missing knowledge, or to
decide it does not exist yet and say so.

If it fires constantly on an existing codebase, that is the cold start, not a defect —
see below.

## Closing a task

```bash
annona done TASK-0042 --touches=CMP-0003,CMP-0005
```

`--touches` should list the components you actually changed, which is often not what you
predicted. It updates the status, recompiles, and reports any test still marked pending
that verifies what the task implemented. It never marks a test as passing — whether a
test passes is a fact about running it, not about closing a task.

Before that, answer the one question honestly: *did we learn something another engineer
should know even if this code changes?* A decision and the alternatives you rejected, a
rule the team will keep, a requirement that was implicit. **Not** what you did — Git has
that.

## Adopting on an existing codebase

Model the feature you are working on. Not the system.

The order that works: the component you are touching → the requirement your task
implements → its parent feature → the decision that governs it, if there is one. Four
entities gets you a compilable task. Everything else can wait until a task needs it.

Expect `MISSING_CONTEXT` on the first few tasks. It stops once the area you work in is
modelled, and it stays quiet for the areas you never touch.

## Health

```bash
annona check     # invariants; errors block
annona doctor    # decay; advisory
annona metrics   # your own usage, from local telemetry
```

`doctor` finds knowledge that has drifted from the code: tasks still open whose tests
already pass, tasks closed with no components recorded, rules constraining nothing,
glossary terms nobody mentions.

`metrics` reads `.annona/telemetry.jsonl` only. Nothing leaves your machine.
