import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from '../src/index.ts';
import { cleanup, project } from './helpers.ts';

const files = {
  'f.yaml': 'id: FEAT-0001\nkind: feature\ntitle: Payments\nstatus: active\nsummary: Payment handling.\n',
  'r.yaml': 'id: REQ-0001\nkind: requirement\ntitle: Money is integer minor units\nstatus: accepted\nfeature: FEAT-0001\nsummary: No floating point for money.\nbody: Applies to every layer including the portal.\n',
  'c.yaml': 'id: CMP-0001\nkind: component\ntitle: payments-domain\nstatus: active\nsummary: DDD domain layer.\n',
  'a.yaml': 'id: ADR-0001\nkind: adr\ntitle: Money as minor units\nstatus: accepted\nsubject: money\ndecides: [REQ-0001]\nsummary: Integer minor units.\n',
  'rule.yaml': 'id: RULE-0001\nkind: rule\ntitle: No floating point money\nstatus: active\napplies_to: [CMP-0001]\nsummary: Use the Money value object.\n',
  'x.yaml': 'id: TEST-0001\nkind: test\ntitle: Money keeps cents\nstatus: passing\nverifies: [REQ-0001]\n',
  't.yaml': 'id: TASK-0001\nkind: task\ntitle: Introduce Money\nstatus: ready\nimplements: [REQ-0001]\ntouches: [CMP-0001]\n',
  // unrelated knowledge that must never appear in the context
  'noise1.yaml': 'id: FEAT-0009\nkind: feature\ntitle: Unrelated\nstatus: active\nsummary: Nothing to do with payments.\n',
  'noise2.yaml': 'id: REQ-0009\nkind: requirement\ntitle: Unrelated requirement\nstatus: accepted\nfeature: FEAT-0009\n',
};

const open = (extra: Record<string, string> = {}) => {
  const root = project({ ...files, ...extra });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  assert.ok(ws.value.compile().ok);
  return { root, w: ws.value };
};

test('retrieval is bounded: unrelated knowledge is never included', () => {
  const { root, w } = open();
  const r = w.context('TASK-0001');
  assert.ok(r.ok);
  const ids = r.value.included.map((i) => i.id);
  assert.ok(!ids.includes('FEAT-0009'));
  assert.ok(!ids.includes('REQ-0009'));
  assert.deepEqual(ids.sort(), ['ADR-0001', 'CMP-0001', 'FEAT-0001', 'REQ-0001', 'RULE-0001', 'TASK-0001', 'TEST-0001']);
  w.close(); cleanup(root);
});

test('compiling twice produces an identical context, hash and ordering', () => {
  const { root, w } = open();
  const a = w.context('TASK-0001', 8000, true);
  const b = w.context('TASK-0001', 8000, true);
  assert.ok(a.ok && b.ok);
  assert.equal(a.value.hash, b.value.hash);
  assert.equal(a.value.text, b.value.text);
  assert.deepEqual(a.value.included.map((i) => i.id), b.value.included.map((i) => i.id));
  assert.equal(a.value.contextId, b.value.contextId);
  w.close(); cleanup(root);
});

test('verdict is COMPLETE when requirement, feature and component are present', () => {
  const { root, w } = open();
  const r = w.context('TASK-0001');
  assert.ok(r.ok);
  assert.equal(r.value.verdict, 'COMPLETE');
  assert.deepEqual(r.value.missing, []);
  w.close(); cleanup(root);
});

test('missing architecture is reported, never assumed', () => {
  const { root, w } = open({ 't.yaml': 'id: TASK-0001\nkind: task\ntitle: Introduce Money\nstatus: ready\nimplements: [REQ-0001]\ntouches: []\n' });
  const r = w.context('TASK-0001');
  assert.ok(r.ok);
  assert.equal(r.value.verdict, 'MISSING_CONTEXT');
  assert.ok(r.value.missing.some((m) => m.kind === 'architecture'));
  w.close(); cleanup(root);
});

test('a budget too small reports MISSING_CONTEXT and never truncates silently', () => {
  const { root, w } = open();
  const r = w.context('TASK-0001', 60, true);
  assert.ok(r.ok);
  assert.equal(r.value.verdict, 'MISSING_CONTEXT');
  assert.ok(r.value.missing.length > 0);
  // every dropped node is named, so nothing disappears without a record
  const named = new Set(r.value.missing.flatMap((m) => m.searched));
  for (const e of r.value.excluded) assert.ok(named.has(e.id), `${e.id} dropped without being reported`);
  w.close(); cleanup(root);
});

test('the context never exceeds its budget', () => {
  const { root, w } = open();
  for (const budget of [100, 200, 400, 8000]) {
    const r = w.context('TASK-0001', budget, true);
    assert.ok(r.ok);
    assert.ok(r.value.used <= budget, `used ${r.value.used} > budget ${budget}`);
  }
  w.close(); cleanup(root);
});

test('the cache returns the same context and reports the hit', () => {
  const { root, w } = open();
  const cold = w.context('TASK-0001', 8000);
  const warm = w.context('TASK-0001', 8000);
  assert.ok(cold.ok && warm.ok);
  assert.equal(cold.value.cacheHit, false);
  assert.equal(warm.value.cacheHit, true);
  assert.equal(cold.value.hash, warm.value.hash);
  w.close(); cleanup(root);
});

test('context on an uncompiled runtime is a clear error, not a crash', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  const r = ws.value.context('TASK-0001');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'STALE_RUNTIME');
  ws.value.close(); cleanup(root);
});

test('an unknown task reports what is missing instead of returning an empty context', () => {
  const { root, w } = open();
  const r = w.context('TASK-9999');
  assert.ok(r.ok);
  assert.equal(r.value.verdict, 'MISSING_CONTEXT');
  assert.equal(r.value.included.length, 0);
  w.close(); cleanup(root);
});
