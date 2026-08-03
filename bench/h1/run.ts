/**
 * H1 — does an agent perform better with compiled context?
 *
 * Two arms, same hole, same oracle:
 *   A  repo-only: the agent gets the ticket and the repository, and explores.
 *   B  annona:    the agent gets the ticket and `annona context <task>`.
 *
 * The oracle is the existing test suite. It is not an opinion, not a rubric and
 * not a judge model: the hole is opened, the agent fills it, the suite decides.
 *
 * Annona never calls a model. The runner is an external command (ADR-0006).
 * Runner contract:
 *   invoked as:  <runner> <promptFile>   with cwd = the work copy
 *   may write:   bench-usage.json  { inputTokens, outputTokens, iterations }
 *   if absent, those fields are reported as null rather than estimated.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Item = {
  task: string;
  lines: number;
  remove?: string[];
  revert?: { file: string; from: string; to: string }[];
};
type Dataset = { oracle: { command: string; args: string[] }; items: Item[] };
type Usage = { inputTokens: number | null; outputTokens: number | null; iterations: number | null };
type Run = {
  task: string; arm: 'A' | 'B'; rep: number;
  promptTokens: number; passed: boolean; elapsedMs: number;
  usage: Usage; holeVerified: boolean;
};

const estimate = (t: string): number => (t.length === 0 ? 0 : Math.ceil(t.length / 4));

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const openHole = (root: string, item: Item): void => {
  for (const f of item.remove ?? []) rmSync(join(root, f), { force: true });
  for (const r of item.revert ?? []) {
    const p = join(root, r.file);
    const text = readFileSync(p, 'utf8');
    if (!text.includes(r.from)) throw new Error(`revert anchor not found in ${r.file}`);
    writeFileSync(p, text.replace(r.from, r.to));
  }
};

const suitePasses = (root: string, ds: Dataset): boolean => {
  try {
    execFileSync(ds.oracle.command, ds.oracle.args, { cwd: root, stdio: 'pipe', timeout: 300_000, shell: true });
    return true;
  } catch {
    return false;
  }
};

const ticket = (root: string, task: string): string => {
  // What a plain issue tracker would show. Identical for both arms.
  const dir = join(root, 'annona');
  const find = (d: string): string | null => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { const hit = find(p); if (hit) return hit; }
      else if (e.name.endsWith('.yaml') && readFileSync(p, 'utf8').includes(`id: ${task}\n`)) return p;
    }
    return null;
  };
  const file = find(dir);
  if (!file) throw new Error(`task not found: ${task}`);
  const text = readFileSync(file, 'utf8');
  const title = /^title: (.*)$/m.exec(text)?.[1] ?? task;
  const summary = /^summary: \|\n((?:  .*\n)+)/m.exec(text)?.[1]?.replace(/^ {2}/gm, '').trim()
    ?? /^summary: (.*)$/m.exec(text)?.[1] ?? '';
  return `${task}: ${title}\n\n${summary}`;
};

const annonaContext = (root: string, task: string): string => {
  const cli = join(root, 'packages/cli/bin/annona.mjs');
  execFileSync('node', ['--experimental-strip-types', cli, 'compile'], { cwd: root, stdio: 'pipe' });
  const out = execFileSync('node', ['--experimental-strip-types', cli, 'context', task], { cwd: root, stdio: 'pipe' });
  return out.toString();
};

const prompt = (arm: 'A' | 'B', tick: string, ctx: string): string =>
  arm === 'A'
    ? [
      'You are working in this repository. Implement the following task.',
      'Explore the repository to find what you need.',
      '', tick, '',
      'The work is complete when the existing test suite passes.',
    ].join('\n')
    : [
      'You are working in this repository. Implement the following task.',
      'The engineering context below was compiled for this task and contains the',
      'requirements, decisions, rules and components that govern it.',
      '', tick, '', '--- COMPILED CONTEXT ---', ctx, '--- END CONTEXT ---', '',
      'The work is complete when the existing test suite passes.',
    ].join('\n');

const main = (): number => {
  const repo = arg('repo') ?? process.cwd();
  const runner = arg('runner');
  const reps = Number(arg('reps') ?? '1');
  const only = arg('tasks')?.split(',');
  const ds = JSON.parse(readFileSync(join(repo, 'bench/h1/tasks.json'), 'utf8')) as Dataset;
  const items = ds.items.filter((i) => (only ? only.includes(i.task) : true));

  const runs: Run[] = [];
  for (const item of items) {
    for (const arm of ['A', 'B'] as const) {
      for (let rep = 1; rep <= reps; rep++) {
        const work = mkdtempSync(join(tmpdir(), `h1-${item.task}-${arm}-`));
        cpSync(repo, work, { recursive: true, dereference: false });
        rmSync(join(work, '.annona'), { recursive: true, force: true });

        const tick = ticket(work, item.task);
        const ctx = arm === 'B' ? annonaContext(work, item.task) : '';
        openHole(work, item);

        // The hole must actually break the suite, or the item measures nothing.
        const holeVerified = !suitePasses(work, ds);

        const text = prompt(arm, tick, ctx);
        const promptFile = join(work, 'PROMPT.txt');
        writeFileSync(promptFile, text);

        let passed = false;
        let elapsedMs = 0;
        let usage: Usage = { inputTokens: null, outputTokens: null, iterations: null };

        if (runner) {
          const started = Date.now();
          try {
            execFileSync(runner, [promptFile], { cwd: work, stdio: 'pipe', timeout: 900_000, shell: true });
          } catch { /* a failing agent is a result, not an error */ }
          elapsedMs = Date.now() - started;
          passed = suitePasses(work, ds);
          const usageFile = join(work, 'bench-usage.json');
          if (existsSync(usageFile)) usage = { ...usage, ...JSON.parse(readFileSync(usageFile, 'utf8')) as Usage };
        }

        runs.push({
          task: item.task, arm, rep,
          promptTokens: estimate(text), passed, elapsedMs, usage, holeVerified,
        });
        rmSync(work, { recursive: true, force: true });
      }
    }
  }

  const byArm = (a: 'A' | 'B') => runs.filter((r) => r.arm === a);
  const rate = (a: 'A' | 'B') => {
    const rs = byArm(a);
    return rs.length === 0 ? 0 : Number(((rs.filter((r) => r.passed).length / rs.length) * 100).toFixed(1));
  };
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : Math.round(xs.reduce((x, y) => x + y, 0) / xs.length));

  const summary = {
    items: items.length,
    repetitions: reps,
    runs: runs.length,
    runnerConfigured: Boolean(runner),
    holesVerified: runs.every((r) => r.holeVerified),
    armA: { successPct: rate('A'), meanPromptTokens: mean(byArm('A').map((r) => r.promptTokens)), meanElapsedMs: mean(byArm('A').map((r) => r.elapsedMs)) },
    armB: { successPct: rate('B'), meanPromptTokens: mean(byArm('B').map((r) => r.promptTokens)), meanElapsedMs: mean(byArm('B').map((r) => r.elapsedMs)) },
    note: runner
      ? 'model arm executed'
      : 'NO RUNNER: holes verified and prompts built, but nothing was solved. Success rates are meaningless without --runner.',
  };

  console.log(JSON.stringify({ summary, runs }, null, 2));
  writeFileSync(join(repo, 'bench/h1/last-run.json'), JSON.stringify({ summary, runs }, null, 2));
  return summary.holesVerified ? 0 : 1;
};

process.exit(main());
