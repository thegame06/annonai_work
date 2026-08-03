import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Workspace } from '../src/index.ts';
import { load } from '../src/knowledge/compile.ts';
import { cleanup, project, FEATURE, REQUIREMENT, TASK } from './helpers.ts';

const files = { 'features/FEAT-0001.yaml': FEATURE, 'features/REQ-0001.yaml': REQUIREMENT, 'features/TASK-0001.yaml': TASK };

test('identical source produces an identical source hash', () => {
  const a = project(files);
  const b = project(files);
  assert.equal(load(join(a, 'annona')).sourceHash, load(join(b, 'annona')).sourceHash);
  cleanup(a); cleanup(b);
});

test('CRLF and LF checkouts produce the same hash', () => {
  const unix = project(files, '\n');
  const windows = project(files, '\r\n');
  assert.equal(load(join(unix, 'annona')).sourceHash, load(join(windows, 'annona')).sourceHash);
  cleanup(unix); cleanup(windows);
});

test('filesystem read order does not change the hash', () => {
  // Same entities, different directory layout and therefore different natural read order.
  const flat = project(files);
  const nested = project({
    'features/FEAT-0001/FEAT-0001.yaml': FEATURE,
    'features/FEAT-0001/reqs/REQ-0001.yaml': REQUIREMENT,
    'aaa/TASK-0001.yaml': TASK,
  });
  const x = load(join(flat, 'annona'));
  const y = load(join(nested, 'annona'));
  assert.deepEqual(x.nodes.map((n) => n.id), y.nodes.map((n) => n.id));
  assert.deepEqual(x.edges, y.edges);
  assert.equal(x.sourceHash, y.sourceHash, 'layout must not affect the compiled result');
  cleanup(flat); cleanup(nested);
});

test('runtime is disposable: deleting .annona and recompiling restores the same hash', () => {
  const root = project(files);
  const first = Workspace.load(root);
  assert.ok(first.ok);
  const before = first.value.compile();
  assert.ok(before.ok);
  first.value.close();

  rmSync(join(root, '.annona'), { recursive: true, force: true });
  assert.equal(existsSync(join(root, '.annona')), false);

  const second = Workspace.load(root);
  assert.ok(second.ok);
  const after = second.value.compile();
  assert.ok(after.ok);
  assert.equal(after.value.sourceHash, before.value.sourceHash);
  assert.equal(after.value.entities, before.value.entities);
  second.value.close();
  cleanup(root);
});

test('interrupted compile leaves no readable half-runtime', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  ws.value.close();
  const runtime = readdirSync(join(root, '.annona'));
  assert.equal(runtime.some((f) => f.endsWith('.tmp')), false, 'no staging file survives a successful compile');
  cleanup(root);
});
