/**
 * H5 — does Annona work when most of the knowledge is missing?
 *
 * The two projects measured so far had their knowledge written first and in full,
 * which is the most favourable case possible and describes no existing codebase.
 * This deletes most of the corpus and asks whether what remains is usable.
 *
 * The question is not coverage. It is whether the halts are ACTIONABLE or merely
 * FREQUENT. A halt the team learns to ignore is worse than no halt at all.
 *
 * DEFINITION, CORRECTED AFTER A DEGENERATE FIRST RUN:
 *   The first definition counted a halt as actionable if `searched` held an id OR a
 *   relation name. Every missing item the compiler can emit holds one or the other,
 *   so it always returned 100%. A metric that cannot fail measures nothing.
 *
 *   Two tiers instead:
 *     SPECIFIC   names a concrete entity id: the developer knows exactly what to fix
 *     STRUCTURAL names only the relation missing: they know the shape, not the target
 *     NOISE      neither
 *
 *   SPECIFIC is what "actionable" was meant to capture. STRUCTURAL is honest but
 *   costs the developer a search.
 *
 * Tasks deleted by the sampler are excluded: you cannot ask about a task you do
 * not have. The realistic case is asking about a task you own while the knowledge
 * around it is partial.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace, type MissingItem } from '@annona/core';

const ID = /^[A-Z]+-\d+$/;
const CONCRETE_RELATIONS = ['implements', 'touches', 'refines'];

type Tier = 'specific' | 'structural' | 'noise';
const tierOf = (m: MissingItem): Tier =>
  m.searched.some((s) => ID.test(s)) ? 'specific'
    : m.searched.some((s) => CONCRETE_RELATIONS.includes(s)) ? 'structural'
      : 'noise';

/** Deterministic PRNG so the experiment is reproducible from the seed alone. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

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

const source = process.argv[2]!;
const deletePct = Number(process.argv[3] ?? '70');
const seed = Number(process.argv[4] ?? '42');

const allTasks = Object.keys(
  JSON.parse(readFileSync(join(source, 'expectations.json'), 'utf8')) as Record<string, unknown>,
).sort();

const work = mkdtempSync(join(tmpdir(), 'h5-'));
cpSync(source, work, { recursive: true });
rmSync(join(work, '.annona'), { recursive: true, force: true });

// Delete a fixed fraction of the corpus, chosen deterministically.
const files = listYaml(join(work, 'annona'));
const next = rng(seed);
const survivors = new Set<string>();
let deleted = 0;
for (const f of files) {
  if (next() * 100 < deletePct) { rmSync(f); deleted += 1; }
  else survivors.add(readFileSync(f, 'utf8').match(/^id: (\S+)$/m)?.[1] ?? '');
}

const ws = Workspace.load(work);
if (!ws.ok) { console.error(ws.error.message); process.exit(1); }
const w = ws.value;
const compiled = w.compile(true);
if (!compiled.ok) { console.error(`compile failed: ${compiled.error.message}`); process.exit(1); }

const tasks = allTasks.filter((t) => survivors.has(t));
let complete = 0;
const tally: Record<Tier, number> = { specific: 0, structural: 0, noise: 0 };
const perTask = tasks.map((t) => {
  const c = w.context(t, 8000, true);
  if (!c.ok) return { task: t, verdict: 'ERROR', halts: 0, actionable: 0 };
  if (c.value.verdict === 'COMPLETE') complete += 1;
  for (const m of c.value.missing) tally[tierOf(m)] += 1;
  return {
    task: t, verdict: c.value.verdict, halts: c.value.missing.length,
    specific: c.value.missing.filter((m) => tierOf(m) === 'specific').length,
    sample: c.value.missing[0]?.message.slice(0, 80),
  };
});
w.close();
rmSync(work, { recursive: true, force: true });

const totalItems = tally.specific + tally.structural + tally.noise;
const pct = (n: number): number => Number(n.toFixed(1));
const specificPct = totalItems === 0 ? 0 : pct((tally.specific / totalItems) * 100);

console.log(JSON.stringify({
  setup: { seed, deletePct, corpusBefore: files.length, deleted, corpusAfter: files.length - deleted,
           tasksAsked: tasks.length, tasksDeleted: allTasks.length - tasks.length },
  results: {
    completePct: pct((complete / Math.max(tasks.length, 1)) * 100),
    haltsPerTask: pct(totalItems / Math.max(tasks.length, 1)),
    specific: tally.specific, structural: tally.structural, noise: tally.noise, specificPct,
  },
  verdict: specificPct >= 80 ? 'PASS: halts name what to fix'
    : specificPct < 50 ? 'FAIL: halts name only the shape of what is missing'
    : 'INCONCLUSIVE: between the thresholds',
  perTask,
}, null, 2));
