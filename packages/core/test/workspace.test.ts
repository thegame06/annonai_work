import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace } from '../src/index.ts';
import { cleanup, project, FEATURE, REQUIREMENT, TASK } from './helpers.ts';

const files = { 'f.yaml': FEATURE, 'r.yaml': REQUIREMENT, 't.yaml': TASK };

test('load fails clearly outside a workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'empty-'));
  const r = Workspace.load(dir);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, 'NOT_A_WORKSPACE');
    assert.equal(r.error.resolveWith, 'run: annona init');
  }
});

test('an unknown format is a hard error, never best-effort parsing', () => {
  const root = project(files);
  writeFileSync(join(root, 'annona.yaml'), 'format: 99\nname: test\n');
  const r = Workspace.load(root);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'UNKNOWN_FORMAT');
  cleanup(root);
});

test('an empty project compiles and reads as empty, it does not crash', () => {
  const root = mkdtempSync(join(tmpdir(), 'annona-'));
  writeFileSync(join(root, 'annona.yaml'), 'format: 1\nname: test\n');
  mkdirSync(join(root, 'annona'), { recursive: true });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  const c = ws.value.compile();
  assert.ok(c.ok);
  assert.equal(c.value.entities, 0);
  const list = ws.value.knowledge().list('feature');
  assert.ok(list.ok);
  assert.deepEqual(list.value, []);
  ws.value.close();
  cleanup(root);
});

test('load never writes a runtime: it is read-only', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  assert.equal(ws.value.sourceHash(), undefined, 'no compile has happened yet');
  ws.value.close();
  cleanup(root);
});

test('compile is incremental: unchanged source does no work', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  assert.equal(ws.value.compile().ok && ws.value.compile().value.changed, 0);
  ws.value.close();
  cleanup(root);
});

test('invalid knowledge never produces a runtime', () => {
  const root = project({ 'r.yaml': REQUIREMENT });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  const c = ws.value.compile();
  assert.equal(c.ok, true, 'dangling refs are a check concern, not a parse failure');
  const bad = project({ 'x.yaml': 'id: X\nkind: nonsense\ntitle: t\nstatus: s\n' });
  const ws2 = Workspace.load(bad);
  assert.ok(ws2.ok);
  const c2 = ws2.value.compile();
  assert.equal(c2.ok, false);
  if (!c2.ok) assert.equal(c2.error.code, 'INVALID_KNOWLEDGE');
  ws.value.close(); ws2.value.close();
  cleanup(root); cleanup(bad);
});

test('knowledge sub-object is memoized', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  assert.equal(ws.value.knowledge(), ws.value.knowledge());
  ws.value.close();
  cleanup(root);
});

test('search and related work over the compiled runtime', () => {
  const root = project(files);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const found = ws.value.knowledge().search('requirement');
  assert.ok(found.ok);
  assert.ok(found.value.some((e) => e.id === 'REQ-0001'));
  const rel = ws.value.knowledge().related('REQ-0001');
  assert.ok(rel.ok);
  assert.deepEqual(rel.value.sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'FEAT-0001', kind: 'refines', direction: 'out' },
    { id: 'TASK-0001', kind: 'implements', direction: 'in' },
  ]);
  ws.value.close();
  cleanup(root);
});
