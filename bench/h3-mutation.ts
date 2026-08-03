/**
 * H3 — what is the word COMPLETE worth?
 *
 * Deletes one class of entity at a time, recompiles, and counts how many
 * compiled contexts change their verdict. A class that can vanish without any
 * verdict changing is knowledge the system cannot notice losing.
 *
 * Measures. Does not fix.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace } from '@annona/core';

const KINDS = ['adr', 'rule', 'test', 'term', 'component', 'requirement', 'feature'] as const;

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

type Baseline = { task: string; verdict: string; nodes: number; tokens: number };

const measure = (root: string, tasks: string[]): Baseline[] | null => {
  const ws = Workspace.load(root);
  if (!ws.ok) return null;
  const w = ws.value;
  if (!w.compile(true).ok) { w.close(); return null; }
  const out: Baseline[] = [];
  for (const t of tasks) {
    const c = w.context(t, 8000, true);
    if (c.ok) out.push({ task: t, verdict: c.value.verdict, nodes: c.value.nodes, tokens: c.value.used });
  }
  w.close();
  return out;
};

const source = process.argv[2]!;
const taskIds = JSON.parse(readFileSync(join(source, 'expectations.json'), 'utf8')) as Record<string, unknown>;
const tasks = Object.keys(taskIds).sort();

const base = measure(source, tasks);
if (!base) { console.error('baseline failed'); process.exit(1); }

const rows = KINDS.map((kind) => {
  const work = mkdtempSync(join(tmpdir(), `h3-${kind}-`));
  cpSync(source, work, { recursive: true });
  rmSync(join(work, '.annona'), { recursive: true, force: true });

  const files = listYaml(join(work, 'annona'));
  let deleted = 0;
  for (const f of files) {
    if (new RegExp(`^kind: ${kind}$`, 'm').test(readFileSync(f, 'utf8'))) { rmSync(f); deleted += 1; }
  }

  const after = measure(work, tasks);
  rmSync(work, { recursive: true, force: true });
  if (!after) return { kind, entitiesDeleted: deleted, compiles: false, verdictChanged: 0, tokensLostPct: 0, silent: false };

  const byTask = new Map(after.map((a) => [a.task, a]));
  const changed = base.filter((b) => byTask.get(b.task)?.verdict !== b.verdict).length;
  const baseTokens = base.reduce((s, b) => s + b.tokens, 0);
  const afterTokens = after.reduce((s, a) => s + a.tokens, 0);

  return {
    kind,
    entitiesDeleted: deleted,
    compiles: true,
    verdictChanged: changed,
    ofTasks: base.length,
    tokensLostPct: Number((((baseTokens - afterTokens) / baseTokens) * 100).toFixed(1)),
    // The dangerous case: knowledge disappeared, context shrank, verdict unchanged.
    silent: changed === 0 && afterTokens < baseTokens,
  };
});

const totalEntities = listYaml(join(source, 'annona')).length;
const silentClasses = rows.filter((r) => r.silent);
const silentEntities = silentClasses.reduce((s, r) => s + r.entitiesDeleted, 0);

console.log(JSON.stringify({
  corpus: { entities: totalEntities, tasks: tasks.length },
  rows,
  summary: {
    classesThatVanishSilently: silentClasses.map((r) => r.kind),
    entitiesDeletableWithoutAnyVerdictChange: silentEntities,
    pctOfCorpusDeletableSilently: Number(((silentEntities / totalEntities) * 100).toFixed(1)),
  },
}, null, 2));
