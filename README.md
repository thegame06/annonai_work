# Annona Work

Your AI agent has your code. It does not have the reasoning behind it — the decision
someone made two years ago, the rule everyone knows but nobody wrote down, the
requirement that explains why this looks wrong but is right.

Annona keeps that reasoning as a graph and compiles the smallest complete slice of it
for the task at hand.

```bash
annona context TASK-0042
```

```
## L1
ADR-0001 [adr/accepted] Money as integer minor units
  Decimal is not uniformly supported across MongoDB, JSON and JavaScript...
## L2
REQ-0001 [requirement/accepted] Amounts are stored in minor units
## L3
RULE-0001 [rule/active] Money never uses floating point
## L5
TASK-0042 [task/ready] Add refund endpoint

--- COMPLETE  604/8000 tokens  9 nodes
```

Your agent reads that instead of grepping the repository. Fewer tokens, and — unlike a
search — identical on every run.

## What it is not

Not an agent. Not an IDE. Not a model. Not a replacement for Git or your issue tracker.
It holds engineering knowledge and hands the right piece to whatever agent you use.

## Status

**Working, unproven.** The documentation separates what has been observed from what has
been designed, because hiding the difference would be the fastest way to lose your
trust.

**Observed — measured on real runs**

| | |
|---|---|
| Tokens vs. an agent grepping the repo | **49% fewer** (real tokenizer, 10 tasks) |
| Context size on a 4,200-entity project | **161 tokens** — same as on a 110-entity one |
| Determinism | 48 compilations, 0 divergences |
| Context latency | 0.8 ms cold, 0.09 ms cached |
| Every CLI command and output in these docs | captured from a real run |

**Designed, not yet observed**

| | |
|---|---|
| An agent driving the full loop end to end | the instructions are generated and tested; no external agent has completed a task with them |
| The five-question interview and the brief | specified in the generated instructions, exercised only by the team |
| That agents produce **better work** with compiled context | the central claim. No model-in-the-loop experiment has run |

Everything in the second table is what we are now measuring. See
`docs/HIPOTESIS-NO-VALIDADAS.md`.

## Install

Requires **Node 22.18 or newer**. Not on npm yet, so clone it:

```bash
git clone https://github.com/thegame06/annonai_work.git
cd annonai_work && npm install && npm link
```

That puts `annona` on your PATH. No build step and nothing to compile: Node 22.18+
strips TypeScript types on its own.

## First use

```bash
cd your-project
annona init         # creates annona.yaml and annona/
annona compile      # builds the runtime and CLAUDE.md / AGENTS.md
```

Then open your AI agent and describe what you want to build. It reads the generated
instructions, interviews you, records the knowledge and compiles the context. You talk
about engineering; it drives Annona.

→ **[Getting Started](docs/getting-started.md)** — empty repo to first finished task
→ **[Working with Annona](docs/working-with-annona.md)** — day to day
→ **[Cookbook](docs/cookbook.md)** — short worked examples
→ **[FAQ](docs/faq.md)**

## How it works

```
annona.yaml + annona/**   →   annona compile   →   .annona/
   your knowledge, in Git        deterministic       runtime, disposable
```

Delete `.annona/` whenever you like; `annona compile` rebuilds it. Nothing generated is
authoritative, and nothing generated should be committed.

Apache-2.0.
