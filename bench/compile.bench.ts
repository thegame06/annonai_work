/**
 * Measurement before optimization. Every optimization must reference a number
 * from this file. Nothing here is optimized yet, deliberately.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { Workspace } from '../packages/core/src/index.ts';

const listAll = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listAll(p));
    else if (p.endsWith('.yaml')) out.push(p);
  }
  return out;
};

const build = (features: number, perFeature: number): string => {
  const root = mkdtempSync(join(tmpdir(), 'annona-bench-'));
  writeFileSync(join(root, 'annona.yaml'), 'format: 1\nname: bench\n');
  for (let f = 1; f <= features; f++) {
    const dir = join(root, 'annona', 'features', `FEAT-${String(f).padStart(4, '0')}`);
    mkdirSync(dir, { recursive: true });
    const fid = `FEAT-${String(f).padStart(4, '0')}`;
    writeFileSync(join(dir, 'feature.yaml'),
      `id: ${fid}\nkind: feature\ntitle: Feature ${f}\nstatus: in_progress\nsummary: ${'x'.repeat(200)}\n`);
    for (let r = 1; r <= perFeature; r++) {
      const rid = `REQ-${String(f * 100 + r).padStart(5, '0')}`;
      writeFileSync(join(dir, `${rid}.yaml`),
        `id: ${rid}\nkind: requirement\ntitle: Requirement ${r} of ${f}\nstatus: accepted\nfeature: ${fid}\nsummary: ${'y'.repeat(300)}\n`);
      writeFileSync(join(dir, `TASK-${String(f * 100 + r).padStart(5, '0')}.yaml`),
        `id: TASK-${String(f * 100 + r).padStart(5, '0')}\nkind: task\ntitle: Task ${r}\nstatus: done\nimplements: [${rid}]\ntouches: []\n`);
    }
  }
  return root;
};

const ms = (fn: () => void): number => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };

const rows: Record<string, string | number>[] = [];
for (const [features, per] of [[10, 5], [50, 10], [200, 10]] as const) {
  const root = build(features, per);
  const entities = features * (1 + per * 2);

  const openMs = ms(() => { const w = Workspace.load(root); if (w.ok) w.value.close(); });
  const w = Workspace.load(root);
  if (!w.ok) throw new Error(w.error.message);
  const coldMs = ms(() => { w.value.compile(true); });
  const warmMs = ms(() => { w.value.compile(false); });
  const searchMs = ms(() => { w.value.knowledge().search('requirement', 20); });
  // The claim under test: naive context grows with the corpus, Annona's does not.
  const naiveTokens = Math.ceil(
    listAll(join(root, 'annona')).map((f) => readFileSync(f, 'utf8')).join('').length / 4,
  );
  const ctx = w.value.context('TASK-00101', 8000, true);
  const ctxTokens = ctx.ok ? ctx.value.used : -1;
  const getMs = ms(() => { w.value.knowledge().get(['REQ-00101'], 'full'); });
  const relatedMs = ms(() => { w.value.knowledge().related('REQ-00101'); });
  w.value.close();

  rows.push({
    entities,
    'load(ms)': openMs.toFixed(1),
    'compile cold(ms)': coldMs.toFixed(0),
    'compile warm(ms)': warmMs.toFixed(1),
    'search(ms)': searchMs.toFixed(2),
    'get(ms)': getMs.toFixed(2),
    'related(ms)': relatedMs.toFixed(2),
    'naive tokens': naiveTokens,
    'annona tokens': ctxTokens,
    'cut %': (100 * (1 - ctxTokens / naiveTokens)).toFixed(1),
  });
  rmSync(root, { recursive: true, force: true });
}
console.table(rows);
