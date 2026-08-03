# Cookbook

Six situations, two minutes each. In real use the agent writes these files; they are
shown so you can recognise what it is doing.

The YAML shown is real and compiles. The agent authoring it is the designed flow and has
not yet been observed end to end with an external agent.

---

## New feature

Nothing exists yet. Four entities, one compilable task.

```yaml
# annona/features/FEAT-0007/feature.yaml
id: FEAT-0007
kind: feature
title: Scheduled reports
status: in_progress
summary: Let a customer receive a weekly usage report by email.
```
```yaml
# annona/features/FEAT-0007/REQ-0031.yaml
id: REQ-0031
kind: requirement
title: Reports are generated from the read model
status: accepted
feature: FEAT-0007
summary: Report generation never queries the transactional tables.
```
```yaml
# annona/features/FEAT-0007/TASK-0110.yaml
id: TASK-0110
kind: task
title: Add the weekly report job
status: ready
implements: [REQ-0031]
touches: [CMP-0004]
```

`annona compile && annona context TASK-0110`

**The one thing to get right:** the requirement says *why*, not *how*. "Generated from
the read model" is a constraint that survives the implementation changing.

---

## Bug fix

A bug is a task like any other. The interesting part is what you record when it is done.

```yaml
id: TASK-0111
kind: task
title: Refund allows more than the captured amount
status: ready
implements: [REQ-0004]
touches: [CMP-0002]
summary: |
  The balance check runs in the API layer, so two concurrent refunds both pass.
```

Fix it, then at `done` ask whether the fix revealed something durable. Here it did — the
check belonged inside the aggregate — so it becomes a rule:

```yaml
id: RULE-0002
kind: rule
title: Aggregates enforce their own invariants
status: active
applies_to: [CMP-0002]
summary: A domain rule is validated inside the aggregate, never in a controller alone.
```

**What not to record:** "fixed the refund bug". That is the commit message.

---

## Refactor

Nothing about the system changes, so no new requirement. One task, and the components it
moves between.

```yaml
id: TASK-0112
kind: task
title: Move persistence behind a repository
status: ready
implements: [REQ-0002]
touches: [CMP-0002, CMP-0003]
```

Refactors are where `touches` is most often wrong: you predict two components and change
four. Correct it at `done` — `annona doctor` will otherwise report components no task has
touched, which is the same information arriving later.

---

## API change

The change is visible outside the system, so it needs a decision, not just a task.

```yaml
id: ADR-0009
kind: adr
title: Version the payments API by URL path
status: accepted
subject: api-versioning
decides: [REQ-0033]
body: |
  Header-based versioning was rejected: our gateway routes on path and cannot
  route on headers without a rewrite. The cost is uglier URLs.
```

The `body` is the whole point — the rejected alternative and why. In two years the code
will show `/v2/` and nothing will explain the header option unless it is written here.

---

## Adding an event

Two components, and a requirement about ordering or delivery — the parts that are easy
to get wrong and invisible in the code.

```yaml
id: REQ-0034
kind: requirement
title: Consumers tolerate duplicate delivery
status: accepted
feature: FEAT-0004
summary: The broker may deliver the same event more than once; handlers are idempotent.
```
```yaml
id: TASK-0113
kind: task
title: Publish PaymentCaptured
status: ready
implements: [REQ-0034]
touches: [CMP-0001, CMP-0005]
```

**The one thing to get right:** the requirement belongs to the consumer's guarantee, not
to the publisher's code. It survives the publisher being rewritten.

---

## Adding a service

A new component, and its dependencies declared.

```yaml
id: CMP-0009
kind: component
title: notification-service
status: active
summary: Sends transactional email and SMS.
body: |
  Owns templates and delivery. Holds no customer data beyond an address, by decision.
depends_on: [CMP-0003]
```

Then the first task that touches it. Do not model the whole service up front: add
requirements as tasks need them.

**A useful check:** run `annona doctor` afterwards. A brand new component that no task
touches will be reported, which is correct — it exists in the graph before it exists in
the code.
