# M1 Benchmark & Product Validation Report

**Date:** 2026-07-31 · **Dataset:** `bench/golden` (82 entities, 24 tasks) · **Budget:** 8,000 tokens
**Reproduce:** `npm run bench:context`

---

## Verdict: hypothesis validated

| Criterion | Target | Result |
|---|---|---|
| Fewer tokens than naive | significant | **92.6% mean reduction** (88.8% worst case) |
| Deterministic compilation | mandatory | **Identical hashes across runs, all 24 tasks** |
| Engineering knowledge preserved | no silent loss | **24/24 complete, 0 invalid at any budget tested** |
| Acceptable latency | usable | **0.81 ms cold, 0.09 ms warm** |

---

## 1. Token reduction on the golden dataset

| Metric | Value |
|---|---|
| Corpus | 82 entities / 82 files |
| Naive context | 8,115 tokens (every file, every time) |
| Annona context, mean | 604 tokens |
| Annona context, worst case | 909 tokens |
| **Mean reduction** | **92.6%** |
| **Worst-case reduction** | **88.8%** |
| Mean nodes retrieved | 9.2 of 82 |

By task category — the reduction is uniform, not driven by a favourable subset:

| Category | n | Mean cut |
|---|---|---|
| security | 2 | 94.8% |
| mongodb | 1 | 93.9% |
| react | 3 | 93.0% |
| performance | 1 | 93.0% |
| architecture | 2 | 92.8% |
| bugfix | 2 | 92.5% |
| refactor | 2 | 92.5% |
| integration | 3 | 92.4% |
| testing | 2 | 91.8% |
| feature | 6 | 91.6% |

## 2. The result that matters more: context size is independent of corpus size

Same task, same retriever, three synthetic corpora:

| Corpus entities | Naive tokens | Annona tokens | Reduction |
|---|---|---|---|
| 110 | 6,852 | 161 | 97.7% |
| 1,050 | 65,201 | 161 | 99.8% |
| 4,200 | 261,153 | **161** | **99.9%** |

Naive context grows linearly with the project. Annona's is a function of the task's
subgraph, so it stays flat. On a 4,200-entity project the naive approach does not
merely cost more — at 261k tokens it does not fit in most context windows at all.

This is the actual product claim, and it holds.

## 3. Determinism

Every task compiled twice per run; the harness fails if any hash differs.

- 24/24 identical `hash`, identical `contextId`, identical node ordering
- 48 compilations, 0 divergences
- No embeddings, no similarity, no recency, no learned weights, no wall-clock reads
- Integer arithmetic only: `score = prior(kind) − 50 × depth`

## 4. Quality: nothing is lost silently

Ground truth is hand-declared per task in `expectations.json` — the requirement, its
feature, the components touched, the ADR governing the requirement, and the rules
constraining those components. It is authored independently of the retriever's
traversal plan and includes nodes reachable only through reverse edges.

Classification: **complete** (verdict COMPLETE, nothing lost) · **missing** (knowledge
absent but explicitly reported) · **invalid** (absent and *not* reported — a silent
omission, the only real failure).

| Budget | Complete | Missing | Invalid | Mean tokens |
|---|---|---|---|---|
| 8,000 | 24 | 0 | 0 | 604 |
| 400 | 22 | 2 | 0 | 385 |
| 150 | 2 | 22 | 0 | 148 |

**Zero invalid at every budget.** As the budget tightens the compiler degrades into
honest refusal, never into quiet truncation.

## 5. Latency

| Stage | Mean |
|---|---|
| Cold compile (retrieve → verdict) | 0.81 ms |
| Warm (cache hit) | 0.09 ms |
| Cache hit ratio, second pass | 1.00 |

Cache key is `hash(task, budget, sourceHash)`, so a stale entry is impossible and
invalidation is not a subsystem.

---

## Defects the benchmark found

Three, all fixed. This is the argument for building the harness alongside the
compiler rather than after it.

**1. Silent omission under budget pressure.** Retrieved rules and ADRs dropped for
budget were recorded in `excluded[]` while the verdict still read `COMPLETE`. That is
precisely the behaviour the contract forbids. Anything retrieved and then dropped now
produces a `missing[]` entry and flips the verdict.

**2. Budget overrun by framing.** `used` measured the rendered text including layer
headers and separators, which the allocator never paid for — a 100-token budget
produced 105 tokens. The allocator now reserves framing cost. A test asserts
`used <= budget` across four budgets.

**3. Runtime unusable on FUSE and network filesystems.** `node:sqlite` failed with a
bare `disk I/O error`. WAL is now attempted and falls back, and the failure returns a
`CoreError` naming the cause instead of a stack trace.

## One correction to the dataset, disclosed

`TASK-0024` was authored in the `FEAT-0007` directory but implements a requirement of
`FEAT-0001`. The generated ground truth expected `FEAT-0007` because of the folder;
the retriever returned `FEAT-0001` because of the declared `implements → refines`
path. The expectation was wrong: directory placement carries no meaning by design.

Corrected — and reported here rather than quietly, because adjusting ground truth to
match output is how benchmarks become worthless. It also exposes a genuine usability
trap: humans will read folder placement as ownership. A task has no explicit feature
link; it is inferred through the requirement it implements. Worth a `check` warning in
M2, not a Core change.

## Limitations

1. **Tokens are estimated at 4 characters each**, not counted by a model tokenizer.
   Both sides use the same formula, so the ratio holds; absolute figures are
   approximate.
2. **The dataset is authored, not harvested.** It is realistic and domain-varied, but
   it is not evidence about how a real team's knowledge base behaves.
3. **The corpus is small** (82 entities). The scale test addresses this, but with
   synthetic entities.
4. **This measures context size, not task success.** Whether an agent given Annona's
   604 tokens performs as well as one given 8,115 is untested. It requires a model in
   the loop and belongs in a later milestone.

Limitation 4 is the one that matters. The hypothesis as stated — *smaller,
deterministic, complete context* — is validated. The stronger claim, that this makes
agents perform better, is not yet evidence.
