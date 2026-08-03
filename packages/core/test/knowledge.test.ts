import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Workspace } from '../src/index.ts';
import { load } from '../src/knowledge/compile.ts';
import { validate } from '../src/knowledge/validate.ts';
import { compareIds, nextId } from '../src/knowledge/ids.ts';
import { cleanup, project, FEATURE, REQUIREMENT, TASK } from './helpers.ts';

const problems = (files: Record<string, string>) => {
  const root = project(files);
  const l = load(join(root, 'annona'));
  const out = [...l.problems, ...validate(l.nodes, l.edges)];
  cleanup(root);
  return out.filter((p) => p.severity === 'error').map((p) => p.rule);
};

test('invariant 1: dangling references are errors', () => {
  assert.deepEqual(problems({ 'a.yaml': REQUIREMENT }), ['dangling-reference', 'orphan-requirement']);
});

test('invariant 2: a requirement without a feature is an error', () => {
  const r = problems({ 'f.yaml': FEATURE, 'r.yaml': REQUIREMENT.replace('FEAT-0001', 'FEAT-0009') });
  assert.ok(r.includes('orphan-requirement'));
});

test('invariant 3: a task implementing nothing is an error', () => {
  const r = problems({ 'f.yaml': FEATURE, 'r.yaml': REQUIREMENT, 't.yaml': TASK.replace('implements: [REQ-0001]', 'implements: []') });
  assert.deepEqual(r, ['unlinked-task']);
});

test('invariant 4: cycles in supersedes are errors', () => {
  const a = 'id: ADR-0001\nkind: adr\ntitle: A\nstatus: accepted\nsupersedes: ADR-0002\n';
  const b = 'id: ADR-0002\nkind: adr\ntitle: B\nstatus: accepted\nsupersedes: ADR-0001\n';
  assert.deepEqual(problems({ 'a.yaml': a, 'b.yaml': b }), ['cycle']);
});

test('invariant 5: two accepted decisions on one subject need supersedes', () => {
  const a = 'id: ADR-0001\nkind: adr\ntitle: A\nstatus: accepted\nsubject: storage\n';
  const b = 'id: ADR-0002\nkind: adr\ntitle: B\nstatus: accepted\nsubject: storage\n';
  assert.deepEqual(problems({ 'a.yaml': a, 'b.yaml': b }), ['conflicting-decision']);
  const linked = b.replace('subject: storage', 'subject: storage\nsupersedes: ADR-0001');
  assert.deepEqual(problems({ 'a.yaml': a, 'b.yaml': linked }), []);
});

test('a valid project has no errors', () => {
  assert.deepEqual(problems({ 'f.yaml': FEATURE, 'r.yaml': REQUIREMENT, 't.yaml': TASK }), []);
});

test('unknown fields are rejected, not ignored', () => {
  const r = problems({ 'f.yaml': FEATURE + 'priority: high\n' });
  assert.deepEqual(r, ['schema']);
});

test('ids sort numerically, not lexicographically', () => {
  assert.deepEqual(['FEAT-0010', 'FEAT-0009', 'FEAT-0002'].sort(compareIds), ['FEAT-0002', 'FEAT-0009', 'FEAT-0010']);
  assert.equal(nextId('feature', ['FEAT-0009', 'FEAT-0010']), 'FEAT-0011');
  assert.equal(nextId('feature', []), 'FEAT-0001');
});

test('ids of any digit length parse', () => {
  assert.equal(compareIds('FEAT-9', 'FEAT-10') < 0, true);
  assert.equal(nextId('feature', ['FEAT-99999']), 'FEAT-100000');
});
