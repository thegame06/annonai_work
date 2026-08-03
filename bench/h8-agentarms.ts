/**
 * H8 applied to the figure that matters: the 37.6% against a competent grep agent.
 * Reproduces both arms of `bench agent` and measures each with both tokenizers.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { encode } from 'gpt-tokenizer';
import { Workspace } from '@annona/core';

const estimate = (t: string): number => (t.length === 0 ? 0 : Math.ceil(t.length / 4));
const real = (t: string): number => encode(t).length;
const pct = (n: number): number => Number(n.toFixed(1));

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

/** Same simulation as bench/agent arm A: grep the id, open hits, follow refs, open those. */
const repoOnlyText = (knowledgeDir: string, task: string): string => {
  const files = listYaml(knowledgeDir);
  const contents = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
  const read = new Set<string>();
  const grep = (needle: string): string[] => files.filter((f) => contents.get(f)!.includes(needle));
  for (const f of grep(task)) read.add(f);
  const refs = new Set<string>();
  for (const f of read)
    for (const m of contents.get(f)!.matchAll(/\b((?:FEAT|REQ|TASK|ADR|CMP|RULE|TEST|TERM)-\d+)\b/g)) refs.add(m[1]!);
  for (const r of [...refs].sort()) for (const f of grep(r)) read.add(f);
  return [...read].sort().map((f) => contents.get(f)!).join('\n');
};

const root = process.argv[2]!;
const ws = Workspace.load(root);
if (!ws.ok) { console.error(ws.error.message); process.exit(1); }
const w = ws.value;
w.compile(true);

const expectations = JSON.parse(readFileSync(join(root, 'expectations.json'), 'utf8')) as Record<string, unknown>;
const tasks = Object.keys(expectations).sort().slice(0, 10);

let estA = 0, realA = 0, estB = 0, realB = 0;
const rows = tasks.map((t) => {
  const a = repoOnlyText(join(root, 'annona'), t);
  const c = w.context(t, 8000, true);
  const b = c.ok ? c.value.text : '';
  const ea = estimate(a), ra = real(a), eb = estimate(b), rb = real(b);
  estA += ea; realA += ra; estB += eb; realB += rb;
  return { task: t, estCut: pct((1 - eb / ea) * 100), realCut: pct((1 - rb / ra) * 100) };
});
w.close();

const estRatio = pct((1 - estB / estA) * 100);
const realRatio = pct((1 - realB / realA) * 100);
const errA = pct((estA - realA) / realA * 100);
const errB = pct((estB - realB) / realB * 100);
const oppositeDirections = Math.sign(errA) !== Math.sign(errB);

console.log(JSON.stringify({
  tasks: tasks.length,
  armA_repoOnly: { estimated: estA, real: realA, errorPct: errA },
  armB_annona: { estimated: estB, real: realB, errorPct: errB },
  publishedFigure: 37.6,
  recomputed: { withEstimator: estRatio, withRealTokenizer: realRatio, deltaPoints: pct(Math.abs(estRatio - realRatio)) },
  armsDeviateInOppositeDirections: oppositeDirections,
  worstTask: rows.reduce((w2, r) => (r.realCut < w2.realCut ? r : w2)),
  perTask: rows,
}, null, 2));
