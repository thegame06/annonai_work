import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Workspace } from '../src/index.ts';
import { TELEMETRY_FIELDS } from '../src/execution/telemetry.ts';
import { cleanup, project, FEATURE, REQUIREMENT, TASK } from './helpers.ts';

const files = { 'f.yaml': FEATURE, 'r.yaml': REQUIREMENT, 't.yaml': TASK };

const events = (root: string): Record<string, unknown>[] =>
  readFileSync(join(root, '.annona', 'telemetry.jsonl'), 'utf8').trim().split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>);

test('every trace record carries a session and an increasing step', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  ws.value.context('TASK-0001');
  ws.value.doctor();
  const recorded = events(root);
  const session = ws.value.session();
  assert.ok(recorded.length >= 3);
  for (const e of recorded) assert.equal(e['session'], session);
  const steps = recorded.map((e) => e['step'] as number);
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b), 'steps must be ordered');
  assert.equal(new Set(steps).size, steps.length, 'steps must be unique');
  ws.value.close(); cleanup(root);
});

test('a session is replayable from the file alone, after close', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  ws.value.context('TASK-0001');
  const session = ws.value.session();
  ws.value.close();
  // nothing in memory: read the file as a later process would
  const steps = events(root).filter((e) => e['session'] === session);
  assert.ok(steps.length >= 2);
  assert.ok(steps.some((e) => e['command'] === 'context' && e['task'] === 'TASK-0001'));
  cleanup(root);
});

test('an attributed caller appears on every subsequent record', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.attribute('Claude Code');
  ws.value.compile();
  ws.value.context('TASK-0001');
  for (const e of events(root)) assert.equal(e['caller'], 'Claude Code');
  ws.value.close(); cleanup(root);
});

test('trace records never contain fields outside the permitted set', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.attribute('Claude Code');
  ws.value.compile();
  ws.value.context('TASK-0001');
  ws.value.trace({ command: 'custom', durationMs: 3, ok: true, task: 'TASK-0001' });
  for (const e of events(root))
    for (const k of Object.keys(e))
      assert.ok((TELEMETRY_FIELDS as readonly string[]).includes(k), `unexpected telemetry field: ${k}`);
  ws.value.close(); cleanup(root);
});

test('doctor detects a task still open whose tests already pass', () => {
  const root = project({
    ...files,
    'x.yaml': 'id: TEST-0001\nkind: test\ntitle: Covered\nstatus: passing\nverifies: [REQ-0001]\n',
  });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const r = ws.value.doctor();
  assert.ok(r.ok);
  const drift = r.value.findings.find((f) => f.check === 'stale-status');
  assert.ok(drift, 'expected stale-status drift');
  assert.equal(drift?.id, 'TASK-0001');
  ws.value.close(); cleanup(root);
});

test('doctor detects a completed task that records no touched component', () => {
  const root = project({ ...files, 't.yaml': `${TASK.replace('status: draft', 'status: done')}touches: []\n` });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const r = ws.value.doctor();
  assert.ok(r.ok);
  assert.ok(r.value.findings.some((f) => f.check === 'missing-touches'));
  ws.value.close(); cleanup(root);
});

test('doctor detects a glossary term named nowhere else', () => {
  const root = project({ ...files, 'g.yaml': 'id: TERM-0001\nkind: term\ntitle: Zorbulator\nstatus: active\ndefinition: A word used by nobody.\n' });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const r = ws.value.doctor();
  assert.ok(r.ok);
  assert.ok(r.value.findings.some((f) => f.check === 'dead-term' && f.id === 'TERM-0001'));
  ws.value.close(); cleanup(root);
});
