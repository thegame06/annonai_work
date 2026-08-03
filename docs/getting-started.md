# Getting Started

From an empty repository to one finished task. About fifteen minutes.

Every CLI output shown below was captured from a real run. The conversation with your
agent is the designed flow and depends on your agent following the generated
instructions — if yours diverges, that is worth telling us about.

## 1. Install

Node 22.18 or newer. Nothing to build.

```bash
git clone https://github.com/thegame06/annonai_work.git
cd annonai_work
npm install
npm link          # puts `annona` on your PATH
```

Check it:

```bash
annona --help
```

## 2. Init

```bash
cd your-project
annona init
```

```
initialized. next: annona compile
```

It created:

```
annona.yaml          project config: format version and name
annona/              your knowledge — commit this
  features/  architecture/  adrs/  rules/  glossary/
.gitignore           gains a line for .annona/
```

**Open `annona.yaml` and set the name.** It defaults to `untitled`, and that name ends
up at the top of every file your agent reads.

## 3. Compile

```bash
annona compile
```

On an empty project this produces `0 entities` and four files at the repo root:
`CLAUDE.md`, `AGENTS.md`, `CODEX.md`, `GEMINI.md`. Those are generated instructions that
teach any AI agent how to drive Annona. They are gitignored and rebuilt on every
compile — never edit them.

## 4. How this actually works

**You do not write YAML.** Your agent does, after interviewing you.

The knowledge lives in `annona/` as small YAML files, but authoring them is the agent's
job: you describe the work in plain language, it looks around, asks what it could not
work out for itself, shows you what it concluded, and writes the files once you confirm.

Everything below is one task done that way. Step 6 shows what the agent wrote, so you
can recognise the model — not because you are expected to type it.

## 5. Your first task

Open your AI agent in this repository and describe what you want to build.

> I need to hash passwords when a user registers. Right now we store them in plaintext.

The agent reads `CLAUDE.md` and takes it from there:

**It looks first.** `annona list feature`, `annona list component`, `annona get` on
anything related, plus your code. It should not ask you about anything already recorded.

**It asks at most five questions**, only where real uncertainty remains — which service
owns this, whether an existing requirement covers it, what the component is called.

**It shows you a brief** before writing anything, with its conclusions separated:

```
CONFIRMED   passwords are currently stored in plaintext
INFERRED    auth lives in auth-service (from the repo layout)
UNKNOWN     whether an existing requirement already covers hashing

Component:   auth-service
Change type: fix
Impact:      medium
```

You confirm or correct it. **Only then does it write knowledge.**

## 6. What the agent wrote

Four entities, which is the minimum for a compilable task. A `kind:` field is what makes
a file an entity — the folder is only for humans.

```yaml
# annona/features/FEAT-0001/feature.yaml
id: FEAT-0001
kind: feature
title: User authentication
status: in_progress
summary: Let a user sign in with email and password.
```

```yaml
# annona/features/FEAT-0001/REQ-0001.yaml
id: REQ-0001
kind: requirement
title: Passwords are stored hashed
status: accepted
feature: FEAT-0001
summary: A plaintext password is never persisted.
```

```yaml
# annona/architecture/CMP-0001.yaml
id: CMP-0001
kind: component
title: auth-service
status: active
summary: Authentication service.
```

```yaml
# annona/features/FEAT-0001/TASK-0001.yaml
id: TASK-0001
kind: task
title: Hash passwords on registration
status: ready
implements: [REQ-0001]
touches: [CMP-0001]
```

`implements` and `touches` are not decoration. They are what makes the context
compilable — without them the task is unreachable from anything else.

## 7. What happens next, and what it looks like

The agent runs these itself. You can run them too if you want to see what it sees.

```bash
annona compile
annona check
```

```
compiled 4 entities, 3 edges in 74ms
```

`check` enforces five invariants: no dangling references, every requirement has a
feature, every task implements something, no cycles, no conflicting accepted decisions.
Errors block. Warnings advise.

```bash
annona context TASK-0001
```

```
TASK-0001 [task/ready] Hash passwords on registration
...
--- COMPLETE  95/8000 tokens  4 nodes  compiled
```

That is what the agent works from instead of searching your repository.

`COMPLETE` means the required kinds are present: requirement, feature, component. It
does **not** mean the knowledge is sufficient — see the [FAQ](faq.md).

Exit codes: `0` success, `1` error, `2` usage, `3` halt.

Then it presents a plan — steps, files it expects to change, risks, assumptions — and
waits for your approval before writing code.

## 8. Close the task

When you accept the work, the agent asks one question: *did we learn anything another
engineer should know even if this code changes?* If yes, that becomes a rule or a
decision. If no, nothing is recorded — Git already has the history.

Then it closes it:

```bash
annona done TASK-0001 --touches=CMP-0001
```

```
TASK-0001 marked done
  updated annona/features/FEAT-0001/TASK-0001.yaml
  recompiled: ok
```

## 9. Commit

```bash
git add annona.yaml annona/ && git commit -m "TASK-0001: hash passwords"
```

Commit `annona.yaml` and `annona/`. Never commit `.annona/` or the generated `*.md` at
the root.

## Typical daily workflow

Seven things you do. The agent does the rest.

1. Open your agent.
2. Describe the task.
3. Answer its questions — at most five.
4. Confirm the brief.
5. Approve the plan.
6. Review the result.
7. Accept, and answer what you learned.

You normally run no Annona commands at all. If you find yourself typing them during a
normal task, either your agent is not reading the generated instructions, or you have
found friction worth reporting.

→ [Working with Annona](working-with-annona.md) for the day to day.

## What to expect on an existing codebase

On a repository that already exists, the first tasks return `MISSING_CONTEXT` until its
knowledge is modelled. Annona will not guess architecture it was never told about.

Model the feature you are working on, not the whole system.
