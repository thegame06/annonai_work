/**
 * H8 — does `chars / 4` distort the conclusions?
 *
 * Both benchmark arms are measured with the same estimator, so the ratio between
 * them is what matters, not the absolute numbers. This checks whether that ratio
 * survives a real tokenizer. Lives in bench/: the Core keeps its estimator and
 * takes no dependency.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { encode } from 'gpt-tokenizer';
import { Workspace } from '@annona/core';

const estimate = (t: string): number => (t.length === 0 ? 0 : Math.ceil(t.length / 4));
const real = (t: string): number => encode(t).length;

const listYaml = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.yaml')) out.push(p);
    }
  };
  walk(dir);
  return out;
};

const pct = (n: number): number => Number(n.toFixed(1));

const root = process.argv[2] ?? process.cwd();
const ws = Workspace.load(root);
if (!ws.ok) { console.error(ws.error.message); process.exit(1); }
const w = ws.value;
w.compile(true);

// Arm A material: the raw knowledge files an agent would read.
const files = listYaml(join(root, 'annona'));
const corpus = files.map((f) => `--- ${f}\n${readFileSync(f, 'utf8')}`).join('\n\n');

// Arm B material: compiled contexts for every task in the corpus.
const tasks = w.knowledge().list('task');
if (!tasks.ok) { console.error('no tasks'); process.exit(1); }
const contexts: string[] = [];
for (const t of tasks.value) {
  const c = w.context(t.id, 8000, true);
  if (c.ok) contexts.push(c.value.text);
}
w.close();

const armA = { est: estimate(corpus), real: real(corpus) };
const armB = {
  est: contexts.reduce((s, c) => s + estimate(c), 0) / contexts.length,
  real: contexts.reduce((s, c) => s + real(c), 0) / contexts.length,
};

const ratioEst = pct((1 - armB.est / armA.est) * 100);
const ratioReal = pct((1 - armB.real / armA.real) * 100);

// Per-context error, to see whether the two arms drift in the same direction.
const errors = contexts.map((c) => (estimate(c) - real(c)) / real(c) * 100);
const meanErr = pct(errors.reduce((a, b) => a + b, 0) / errors.length);
const worstErr = pct(Math.max(...errors.map(Math.abs)));

console.log(JSON.stringify({
  tokenizer: 'gpt-tokenizer (cl100k_base)',
  contextsMeasured: contexts.length,
  armA_wholeCorpus: { estimated: armA.est, real: armA.real, errorPct: pct((armA.est - armA.real) / armA.real * 100) },
  armB_meanContext: { estimated: Math.round(armB.est), real: Math.round(armB.real), errorPct: pct((armB.est - armB.real) / armB.real * 100) },
  reduction: { withEstimator: ratioEst, withRealTokenizer: ratioReal, deltaPoints: pct(Math.abs(ratioEst - ratioReal)) },
  perContextError: { meanPct: meanErr, worstAbsPct: worstErr },
  // Two failure conditions, both from the roadmap: the ratio moving more than
  // 5 points, OR the two arms deviating in opposite directions. The second was
  // missing from this check and is the one that actually fired.
  verdict: Math.abs(ratioEst - ratioReal) <= 5 && Math.sign(armA.est - armA.real) === Math.sign(armB.est - armB.real)
    ? 'PASS'
    : 'FAIL: recompute published figures with a real tokenizer',
}, null, 2));
