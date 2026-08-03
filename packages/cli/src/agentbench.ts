import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace } from '@annona/core';
import { listYaml } from './yamlfiles.ts';

/**
 * Two arms, one question: does an agent need less to do the same work?
 *
 * Arm A (repo-only) simulates what an agent without Annona must read. It is a
 * lower bound, not an upper one: a real agent also reads files that turn out to
 * be irrelevant, so the true cost is higher than reported here.
 *
 * Arm B is Annona's compiled context.
 *
 * The model is invoked through a configured command, never from the Core
 * (REQ-0012, ADR-0006). Without --runner the harness reports the deterministic
 * half and marks the model half as not run, rather than estimating it.
 */

const estimateTokens = (text: string): number => (text.length === 0 ? 0 : Math.ceil(text.length / 4));

type Arm = { tokens: number; filesRead: number; searches: number };

/**
 * A repo-only agent has no index. To answer "what governs TASK-0018" it must
 * grep, then open each hit, then follow the references it finds and open those.
 * Two rounds, which is generous: it assumes the agent never opens a wrong file.
 */
const repoOnlyArm = (knowledgeDir: string, task: string): Arm => {
  const files = listYaml(knowledgeDir);
  const contents = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
  let searches = 0;
  const read = new Set<string>();

  const grep = (needle: string): string[] => {
    searches += 1;
    // A grep scans every file: the agent pays to look, even where it finds nothing.
    return files.filter((f) => contents.get(f)!.includes(needle));
  };

  for (const f of grep(task)) read.add(f);
  const refs = new Set<string>();
  for (const f of read)
    for (const m of contents.get(f)!.matchAll(/\b((?:FEAT|REQ|TASK|ADR|CMP|RULE|TEST|TERM)-\d+)\b/g)) refs.add(m[1]!);
  for (const ref of [...refs].sort()) for (const f of grep(ref)) read.add(f);

  const tokens = [...read].sort().reduce((sum, f) => sum + estimateTokens(contents.get(f)!), 0);
  return { tokens, filesRead: read.size, searches };
};

type Row = {
  task: string;
  repoTokens: number; repoFiles: number; repoSearches: number;
  annonaTokens: number; annonaNodes: number;
  reductionPct: number; verdict: string;
  modelRun: boolean; iterations?: number; elapsedMs?: number; success?: boolean;
};

const round = (n: number, d = 1): number => Number(n.toFixed(d));

export const benchAgent = (goldenDir: string, tasks: string[], runner: string | undefined, json: boolean): number => {
  const work = mkdtempSync(join(tmpdir(), 'annona-agentbench-'));
  cpSync(goldenDir, work, { recursive: true });
  rmSync(join(work, '.annona'), { recursive: true, force: true });

  const ws = Workspace.load(work);
  if (!ws.ok) { console.error(ws.error.message); return 1; }
  const w = ws.value;
  if (!w.compile(true).ok) { console.error('compile failed'); return 1; }

  const rows: Row[] = [];
  for (const task of tasks) {
    const a = repoOnlyArm(join(work, 'annona'), task);
    const ctx = w.context(task, 8000, true);
    if (!ctx.ok) { console.error(`${task}: ${ctx.error.message}`); return 1; }

    const row: Row = {
      task,
      repoTokens: a.tokens, repoFiles: a.filesRead, repoSearches: a.searches,
      annonaTokens: ctx.value.used, annonaNodes: ctx.value.nodes,
      reductionPct: round((1 - ctx.value.used / a.tokens) * 100),
      verdict: ctx.value.verdict,
      modelRun: false,
    };

    if (runner) {
      // The model is a subprocess with a prompt file. Annona never holds
      // credentials, never streams, never retries.
      for (const [arm, text] of [['A', 'REPO-ONLY'], ['B', ctx.value.text]] as const) {
        const promptFile = join(work, `prompt-${task}-${arm}.txt`);
        writeFileSync(promptFile, text);
        const started = Date.now();
        try {
          execFileSync(runner, [promptFile], { cwd: work, stdio: 'pipe', timeout: 120_000 });
          row.elapsedMs = Date.now() - started;
          row.success = true;
        } catch {
          row.elapsedMs = Date.now() - started;
          row.success = false;
        }
      }
      row.modelRun = true;
    }
    rows.push(row);
  }
  w.close();
  rmSync(work, { recursive: true, force: true });

  const n = rows.length;
  const sum = (f: (r: Row) => number): number => rows.reduce((acc, r) => acc + f(r), 0);
  const summary = {
    tasks: n,
    meanRepoTokens: Math.round(sum((r) => r.repoTokens) / n),
    meanAnnonaTokens: Math.round(sum((r) => r.annonaTokens) / n),
    meanReductionPct: round(sum((r) => r.reductionPct) / n),
    meanFilesRead: round(sum((r) => r.repoFiles) / n),
    meanSearches: round(sum((r) => r.repoSearches) / n),
    completeVerdicts: rows.filter((r) => r.verdict === 'COMPLETE').length,
    modelArmRun: rows.every((r) => r.modelRun),
    note: runner
      ? 'model arm executed through the configured runner'
      : 'model arm NOT run: no --runner configured. Token and search columns are measured; completion quality and iterations are unmeasured.',
  };

  if (json) console.log(JSON.stringify({ summary, rows }, null, 2));
  else {
    console.table(rows.map((r) => ({
      task: r.task, 'repo tok': r.repoTokens, files: r.repoFiles, greps: r.repoSearches,
      'annona tok': r.annonaTokens, nodes: r.annonaNodes, 'cut %': r.reductionPct, verdict: r.verdict,
    })));
    console.log(JSON.stringify(summary, null, 2));
  }
  return 0;
};
