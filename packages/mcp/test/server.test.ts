import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Workspace } from '@annona/core';
import { handleRequest, TOOLS } from '../src/server.ts';
import { cleanup, project, FEATURE, REQUIREMENT, TASK } from '../../core/test/helpers.ts';

const open = () => {
  const root = project({ 'f.yaml': FEATURE, 'r.yaml': REQUIREMENT, 't.yaml': TASK });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  return { root, w: ws.value };
};

test('the tool catalog stays at seven', () => {
  assert.equal(TOOLS.length, 7);
  assert.deepEqual(TOOLS.map((t) => t.name).sort(),
    ['check', 'compile', 'context', 'get_feature', 'get_task', 'review', 'search']);
});

test('no tool writes authoritative knowledge', () => {
  for (const t of TOOLS)
    assert.ok(!/propose|create|update|delete|write/.test(t.name), `${t.name} looks like a write tool`);
});

test('tools/call context returns the same result as the Workspace API', () => {
  const { root, w } = open();
  const direct = w.context('TASK-0001');
  assert.ok(direct.ok);
  const res = handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'context', arguments: { task: 'TASK-0001' } } }, w);
  const payload = JSON.parse((res as { result: { content: { text: string }[] } }).result.content[0]!.text) as { hash: string; verdict: string };
  assert.equal(payload.hash, direct.value.hash);
  assert.equal(payload.verdict, direct.value.verdict);
  w.close(); cleanup(root);
});

test('an unknown tool is a protocol error, not a crash', () => {
  const { root, w } = open();
  const res = handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'nope', arguments: {} } }, w) as { error?: { message: string } };
  assert.match(res.error?.message ?? '', /unknown tool/);
  w.close(); cleanup(root);
});

test('a missing argument returns isError instead of throwing', () => {
  const { root, w } = open();
  const res = handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'context', arguments: {} } }, w) as { result: { isError?: boolean } };
  assert.equal(res.result.isError, true);
  w.close(); cleanup(root);
});
