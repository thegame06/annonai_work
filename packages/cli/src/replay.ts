import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TraceStep } from '@annona/core';

const read = (root: string): TraceStep[] => {
  const file = join(root, '.annona', 'telemetry.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as TraceStep);
};

const describe = (s: TraceStep): string => {
  const bits: string[] = [];
  if (s.task) bits.push(s.task);
  if (s.verdict) bits.push(s.verdict);
  if (typeof s.tokens === 'number') bits.push(`${s.tokens} tokens`);
  if (typeof s.nodes === 'number') bits.push(`${s.nodes} nodes`);
  if (typeof s.entities === 'number') bits.push(`${s.entities} entities`);
  if (s.cacheHit === true) bits.push('cached');
  if (s.ok === false) bits.push(`FAILED${s.detail ? `: ${s.detail}` : ''}`);
  return bits.join('  ');
};

/**
 * Reconstructed from persisted records alone (REQ-0011). No live tailing and no
 * in-memory state: if the process died, the trace is still readable.
 */
export const replay = (root: string, which: string | undefined, json: boolean): number => {
  const all = read(root);
  if (all.length === 0) { console.error('no traces recorded yet'); return 1; }

  const sessions = [...new Set(all.map((s) => s.session))];
  const target = which ?? sessions[sessions.length - 1]!;
  const steps = all.filter((s) => s.session === target).sort((a, b) => a.step - b.step);
  if (steps.length === 0) { console.error(`unknown session: ${target}`); return 1; }

  if (json) {
    console.log(JSON.stringify({ session: target, steps }, null, 2));
    return 0;
  }

  const start = new Date(steps[0]!.ts).getTime();
  const callers = [...new Set(steps.map((s) => s.caller).filter(Boolean))];
  const tasks = [...new Set(steps.map((s) => s.task).filter(Boolean))];
  const totalMs = new Date(steps[steps.length - 1]!.ts).getTime() - start;

  console.log(`session ${target}`);
  console.log(`caller  ${callers.length > 0 ? callers.join(', ') : 'cli'}`);
  console.log(`tasks   ${tasks.length > 0 ? tasks.join(', ') : '-'}`);
  console.log(`steps   ${steps.length} over ${totalMs} ms\n`);

  for (const s of steps) {
    const at = new Date(s.ts).getTime() - start;
    console.log(`  +${String(at).padStart(6)} ms  ${s.command.padEnd(18)} ${describe(s)}`);
  }
  console.log(`\nsessions available: ${sessions.length} (newest last: ${sessions.slice(-3).join(', ')})`);
  return 0;
};
