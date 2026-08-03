import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Event = {
  ts: string; session: string; step: number; command: string; durationMs: number;
  caller?: string; task?: string; verdict?: string; nodes?: number; entities?: number;
  cacheHit?: boolean; missing?: number; tokens?: number; ok?: boolean;
};

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)));

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Number(((s[mid - 1]! + s[mid]!) / 2).toFixed(2)) : s[mid]!;
};

const top = (counts: Map<string, number>, n: number): string[] =>
  [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k, v]) => `${k}(${v})`);

/** Reads only the local telemetry file. Nothing is transmitted, ever. */
export const metrics = (root: string, json: boolean): number => {
  const file = join(root, '.annona', 'telemetry.jsonl');
  if (!existsSync(file)) { console.error('no telemetry yet: run some commands first'); return 1; }

  const events = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Event);
  const contexts = events.filter((e) => e.command === 'context');
  const compiles = events.filter((e) => e.command === 'compile');
  const complete = contexts.filter((e) => e.verdict === 'COMPLETE');
  const hits = contexts.filter((e) => e.cacheHit === true);

  const sessions = new Set(events.map((e) => e.session).filter(Boolean));
  const callers = new Map<string, number>();
  for (const e of events) if (e.caller) callers.set(e.caller, (callers.get(e.caller) ?? 0) + 1);
  const taskCounts = new Map<string, number>();
  for (const e of contexts) if (e.task) taskCounts.set(e.task, (taskCounts.get(e.task) ?? 0) + 1);
  const doctors = events.filter((e) => e.command === 'doctor');
  const dones = events.filter((e) => e.command === 'done');
  const mcpCalls = events.filter((e) => e.command.startsWith('mcp.'));
  const durations = contexts.filter((e) => e.cacheHit !== true).map((e) => e.durationMs);

  const summary = {
    events: events.length,
    sessions: sessions.size,
    agentCalls: mcpCalls.length,
    callers: top(callers, 5),
    tasksCompleted: dones.length,
    driftScans: doctors.length,
    driftEventsLastScan: doctors[doctors.length - 1]?.nodes ?? 0,
    medianContextMs: median(durations),
    mostRequestedTasks: top(taskCounts, 5),
    compiles: compiles.length,
    contexts: contexts.length,
    // Knowledge coverage: share of context compilations returning COMPLETE.
    knowledgeCoveragePct: contexts.length === 0 ? 0 : Number(((complete.length / contexts.length) * 100).toFixed(1)),
    contextsMissingKnowledge: contexts.length - complete.length,
    cacheHitRatio: contexts.length === 0 ? 0 : Number((hits.length / contexts.length).toFixed(2)),
    meanContextMs: mean(contexts.filter((e) => e.cacheHit !== true).map((e) => e.durationMs)),
    meanCompileMs: mean(compiles.map((e) => e.durationMs)),
    meanContextTokens: Math.round(mean(contexts.map((e) => e.tokens ?? 0))),
    meanNodesRetrieved: mean(contexts.map((e) => e.nodes ?? 0)),
    failures: events.filter((e) => e.ok === false).length,
    firstEvent: events[0]?.ts,
    lastEvent: events[events.length - 1]?.ts,
  };

  if (json) console.log(JSON.stringify(summary, null, 2));
  else {
    for (const [k, v] of Object.entries(summary)) console.log(`${k.padEnd(24)} ${String(v)}`);
  }
  return 0;
};
