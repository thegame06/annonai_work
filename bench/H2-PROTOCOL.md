# H2 — execution protocol

**Question:** can an engineer who did not design the schema model a real feature and
obtain a `COMPLETE` context without guidance?

No code. Three people, one hour each, a stopwatch. This protocol exists so it can be
run **without the designer in the room** — that is the whole point.

---

## What this measures

Two things, and the second matters as much as the first.

**Can they do it?** Reach a `COMPLETE` context, unaided.

**Did they understand what they were doing?** A participant who finishes the task while
believing Annona works some other way has still been failed by the onboarding — they
will hit the wall on task three, alone, and conclude the product is broken. A correct
outcome from a wrong mental model is a deferred failure, not a success.

## Success and failure, fixed before running

- **Success:** 2 of 3 participants reach a `COMPLETE` context in under 60 minutes, with
  `annona check` reporting 0 errors and no help from the designer, **and** 2 of 3 answer
  the mental-model questions in line with the design.
- **Failure:** 1 or fewer complete the task, or the median time exceeds 90 minutes, or 2
  of 3 hold a mental model that contradicts the design.

Do not adjust these after seeing the results.

---

## Participants

Three engineers who have never used Annona. Requirements: they can read YAML and run a
CLI. Do **not** pick people who watched the project being built.

## Materials given

1. The repository, compiled (`annona compile` already run).
2. `README.md` and the generated `CLAUDE.md` at the root.
3. One sentence: *"Model this feature so an AI agent can implement it, then run
   `annona context <your-task-id>`."*
4. A feature from **their own** current project — not from the golden dataset. It must
   be work they already understand, so the experiment measures the model and not the
   domain.

Nothing else. No walkthrough, no examples chosen for them, no answering questions about
what a field means.

## Rules for the facilitator

- **Do not answer questions about the model.** Record the question and say "whatever the
  documentation says". Every question asked is a finding.
- **Do not correct mistakes.** A participant heading somewhere wrong is the most valuable
  data in the session.
- Stop at 90 minutes regardless of progress.

---

## Record per participant

| Field | How |
|---|---|
| Minutes to first `COMPLETE` | stopwatch; blank if not reached |
| `annona check` errors at the end | `annona check --json` |
| Questions asked | verbatim, in order |
| Documentation lookups | count |
| Entities created, by kind | `annona list <kind>` |
| Relations declared | count from the files |
| Moments of visible hesitation | note the timestamp and what they were doing |

## Four things to watch for specifically

These come from friction already observed while dogfooding. They are predictions, and
the point is to find out whether they hold for someone else:

1. **Do they assume the folder determines the meaning?** `annona/tests/` contains test
   *entities*, not tests; `annona/architecture/` contains `component` entities. This
   defect is **deliberately unfixed** so the session can measure whether a newcomer
   trips on it.
2. **Do they know what `status` should be?** There are three different vocabularies
   (`done`, `accepted`, `active`) and nothing says which applies to what.
3. **Do they declare relations, or only write entities?** The relations are the product.
   An entity with no edges means the model was not understood.
4. **What do they do at `MISSING_CONTEXT`?** Do they read what `missing[]` names and act
   on it, or do they get stuck?

---

## Mental-model questions

Ask these **at the end, before explaining anything**, and write the answers down
verbatim. The point is not whether they are right — it is what the documentation put in
their head.

1. **Who did you think writes the YAML files?**
   Design: the agent, after interviewing you. If they answer "me", the onboarding taught
   them that Annona is a manual filing system.
2. **What did you think Annona does?**
   Design: it stores engineering knowledge and compiles the minimum slice a task needs.
   Watch for "it's an AI", "it generates code", "it's documentation".
3. **What did you think the agent does?**
   Design: it drives the workflow — discovery, brief, plan, implementation, review — and
   calls Annona when it needs to.
4. **What did you think your own job was?**
   Design: answer questions, confirm the brief, approve the plan, accept the work.
   Watch for "keep the graph up to date", which means they read maintenance as their
   burden rather than a by-product.
5. **What would you do next, on a task we have not discussed?**
   The most revealing of the five. It shows whether the model transferred or whether they
   only followed the tutorial.

Record each answer as **matches / partially / contradicts** the design, and keep the
wording. The wording is the finding; a summary is an interpretation.

## Afterwards

Publish only: three times, three error counts, the full list of questions the
participants asked, their five mental-model answers verbatim, and the success/failure
verdict against the criteria above.

Do not publish an interpretation of why someone struggled. The questions they asked are
the finding; explanations added afterwards are opinion.

---

## Why this is worth an hour of three people's time

H2 is one of the two hypotheses that decide whether Annona is a product or a technique
that works in its author's hands. It is also the cheapest of the two: **it requires no
model, no key, and no code**, and it can run today, in parallel with everything else.

Of the two critical hypotheses, this is the one nothing is blocking.
