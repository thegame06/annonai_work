import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * Engineering metrics only, appended locally, never transmitted (REQ-0007).
 * One file rather than a table, because a table in runtime.db disappears on
 * every compile, and rather than a directory, because the runtime holds three
 * entries and a fourth needs justification (ADR-0003).
 *
 * Every record carries a session id so an execution can be reconstructed after
 * the process has exited (REQ-0009, REQ-0011).
 */
export type TelemetryEvent = {
  ts: string;
  session: string;
  step: number;
  command: string;
  durationMs: number;
  caller?: string;
  task?: string;
  verdict?: string;
  nodes?: number;
  entities?: number;
  cacheHit?: boolean;
  missing?: number;
  budget?: number;
  tokens?: number;
  ok?: boolean;
  detail?: string;
};

/** Fields permitted on disk. Anything else is a privacy defect, not a feature. */
export const TELEMETRY_FIELDS = [
  'ts', 'session', 'step', 'command', 'durationMs', 'caller', 'task', 'verdict',
  'nodes', 'entities', 'cacheHit', 'missing', 'budget', 'tokens', 'ok', 'detail',
] as const;

/**
 * Derived from the process, never configured (ADR-0005): a trace exists even
 * when nobody asked for one, and it cannot depend on caller discipline.
 */
const SESSION = createHash('sha256')
  .update(`${process.pid}|${Date.now()}`, 'utf8').digest('hex').slice(0, 12);

let step = 0;
let caller: string | undefined;

/** Set once by an adapter that knows who is calling, e.g. the MCP handshake. */
export const setCaller = (name: string): void => { caller = name; };
export const sessionId = (): string => SESSION;

export const record = (runtimeDir: string, event: Omit<TelemetryEvent, 'session' | 'step' | 'ts'>): void => {
  try {
    step += 1;
    const full: TelemetryEvent = {
      ts: new Date().toISOString(), session: SESSION, step,
      ...(caller ? { caller } : {}), ...event,
    };
    appendFileSync(join(runtimeDir, 'telemetry.jsonl'), `${JSON.stringify(full)}\n`);
  } catch {
    // Telemetry must never break a command. Losing a measurement is acceptable;
    // failing an engineer's compile because of one is not.
  }
};
