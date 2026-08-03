import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace, type CompiledContext } from '@annona/core';

/**
 * The same estimator Core uses, restated here on purpose: the baseline is
 * benchmark-only code and must not live in the Core, and both sides must be
 * measured with one formula for the ratio to mean anything.
 */
const estimateTokens = (text: string): number => (text.length === 0 ? 0 : Math.ceil(text.length / 4));

/** The comparison point: hand the model every document and let it sort it out. */
const naiveContext = (knowledgeDir: string): { tokens: number; files: number } => {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.yaml')) files.push(p);
    }
  };
  walk(knowledgeDir);
  const text = files.map((f) => `--- ${f}\n${readFileSync(f, 'utf8').replaceAll('\r\n', '\n')}`).join('\n\n');
  return { tokens: estimateTokens(text), files: files.length };
};

type Expectation = { category: string; required: string[] };
type Row = {
  task: string; category: string; nodes: number;
  coldMs: number; warmMs: number; retrieveMs: number;
  contextTokens: number; naiveTokens: number; reductionPct: number;
  cacheHit: boolean; verdict: string; missing: number;
  quality: 'complete' | 'missing' | 'invalid'; lost: string[];
};

const round = (n: number, d = 1): number => Number(n.toFixed(d));

export const benchContext = (goldenDir: string, budget: number, json: boolean): number => {
  const expectations = JSON.parse(readFileSync(join(goldenDir, 'expectations.json'), 'utf8')) as Record<string, Expectation>;

  // Run against a temp copy so every run starts from a cold cache and the
  // repository dataset is never mutated by benchmarking.
  const work = mkdtempSync(join(tmpdir(), 'annona-bench-'));
  cpSync(goldenDir, work, { recursive: true });
  rmSync(join(work, '.annona'), { recursive: true, force: true });

  const ws = Workspace.load(work);
  if (!ws.ok) { console.error(ws.error.message); return 1; }
  const w = ws.value;
  const compiled = w.compile(true);
  if (!compiled.ok) { console.error(compiled.error.message); return 1; }

  const naive = naiveContext(join(work, 'annona'));
  const rows: Row[] = [];
  const hashes = new Map<string, string>();
  const coldMs = new Map<string, number>();

  for (const pass of [0, 1]) {
    for (const task of Object.keys(expectations).sort()) {
      const started = process.hrtime.bigint();
      const r = w.context(task, budget);
      const totalMs = Number(process.hrtime.bigint() - started) / 1e6;
      if (!r.ok) { console.error(`${task}: ${r.error.message}`); return 1; }
      const ctx: CompiledContext = r.value;

      if (pass === 0) { hashes.set(task, ctx.hash); coldMs.set(task, round(totalMs, 2)); continue; }
      if (hashes.get(task) !== ctx.hash) {
        console.error(`DETERMINISM FAILURE: ${task} produced two different contexts`);
        return 1;
      }

      const required = expectations[task]!.required;
      const includedIds = new Set(ctx.included.map((i) => i.id));
      const lost = required.filter((id) => !includedIds.has(id));
      // invalid means a silent omission: knowledge the task needed is absent
      // AND the compiler did not say so. Reported absence is 'missing', which is
      // an acceptable, honest outcome. Only silence is a failure.
      const reported = new Set(ctx.missing.flatMap((m) => m.searched));
      const unreported = lost.filter((id) => !reported.has(id));
      const quality: Row['quality'] =
        lost.length === 0 && ctx.verdict === 'COMPLETE' ? 'complete'
          : unreported.length === 0 ? 'missing'
            : 'invalid';

      rows.push({
        task, category: expectations[task]!.category, nodes: ctx.nodes,
        coldMs: coldMs.get(task) ?? 0, warmMs: round(totalMs, 2), retrieveMs: ctx.timings.retrieveMs,
        contextTokens: ctx.used, naiveTokens: naive.tokens,
        reductionPct: round((1 - ctx.used / naive.tokens) * 100),
        cacheHit: ctx.cacheHit, verdict: ctx.verdict, missing: ctx.missing.length,
        quality, lost: unreported,
      });
    }
  }
  w.close();
  rmSync(work, { recursive: true, force: true });

  const n = rows.length;
  const sum = (f: (r: Row) => number): number => rows.reduce((a, r) => a + f(r), 0);
  const summary = {
    tasks: n,
    corpusEntities: compiled.value.entities,
    naiveTokens: naive.tokens,
    naiveFiles: naive.files,
    budget,
    meanContextTokens: Math.round(sum((r) => r.contextTokens) / n),
    meanReductionPct: round(sum((r) => r.reductionPct) / n),
    minReductionPct: round(Math.min(...rows.map((r) => r.reductionPct))),
    maxContextTokens: Math.max(...rows.map((r) => r.contextTokens)),
    meanNodes: round(sum((r) => r.nodes) / n),
    meanColdMs: round(sum((r) => r.coldMs) / n, 2),
    meanWarmMs: round(sum((r) => r.warmMs) / n, 2),
    cacheHitRatioSecondPass: round(rows.filter((r) => r.cacheHit).length / n, 2),
    complete: rows.filter((r) => r.quality === 'complete').length,
    missing: rows.filter((r) => r.quality === 'missing').length,
    invalid: rows.filter((r) => r.quality === 'invalid').length,
    deterministic: true,
  };

  if (json) {
    console.log(JSON.stringify({ summary, rows }, null, 2));
  } else {
    console.table(rows.map((r) => ({
      task: r.task, cat: r.category, nodes: r.nodes,
      ctx: r.contextTokens, naive: r.naiveTokens, 'cut%': r.reductionPct,
      cold: r.coldMs, warm: r.warmMs, verdict: r.verdict, quality: r.quality,
    })));
    console.log(JSON.stringify(summary, null, 2));
  }
  writeFileSync(join(goldenDir, '..', 'last-run.json'), JSON.stringify({ summary, rows }, null, 2));
  return summary.invalid > 0 ? 1 : 0;
};
