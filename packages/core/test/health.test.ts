import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Workspace } from '../src/index.ts';
import { cleanup, project, FEATURE, REQUIREMENT, TASK } from './helpers.ts';

const base = { 'f.yaml': FEATURE, 'r.yaml': REQUIREMENT, 't.yaml': TASK };

const fingerprint = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else out.push(`${p}:${s.size}`);
    }
  };
  walk(dir);
  return out;
};

test('doctor writes nothing to the knowledge source', () => {
  const root = project(base);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const before = fingerprint(join(root, 'annona'));
  assert.ok(ws.value.doctor().ok);
  assert.deepEqual(fingerprint(join(root, 'annona')), before, 'doctor must not modify the project');
  ws.value.close(); cleanup(root);
});

test('doctor reports a rule that constrains nothing', () => {
  const root = project({ ...base, 'rule.yaml': 'id: RULE-0001\nkind: rule\ntitle: Dead rule\nstatus: active\napplies_to: []\n' });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const r = ws.value.doctor();
  assert.ok(r.ok);
  assert.ok(r.value.findings.some((f) => f.check === 'unused-rule' && f.id === 'RULE-0001'));
  ws.value.close(); cleanup(root);
});

test('doctor reports a decision that decides nothing', () => {
  const root = project({ ...base, 'a.yaml': 'id: ADR-0001\nkind: adr\ntitle: Orphan decision\nstatus: accepted\ndecides: []\n' });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const r = ws.value.doctor();
  assert.ok(r.ok);
  assert.ok(r.value.findings.some((f) => f.check === 'unused-decision'));
  ws.value.close(); cleanup(root);
});

test('doctor reports missing relationships without blocking', () => {
  const root = project(base);
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const r = ws.value.doctor();
  assert.ok(r.ok);
  assert.ok(r.value.findings.some((f) => f.check === 'missing-relationship'));
  // check enforces, doctor advises: the same project still validates
  assert.equal(ws.value.check().ok && ws.value.check().value.errors, 0);
  ws.value.close(); cleanup(root);
});

test('a term definition reaches the runtime', () => {
  const root = project({ ...base, 'g.yaml': 'id: TERM-0001\nkind: term\ntitle: Minor units\nstatus: active\ndefinition: The smallest indivisible unit of a currency.\n' });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const r = ws.value.knowledge().get(['TERM-0001'], 'full');
  assert.ok(r.ok);
  assert.equal(r.value[0]?.summary, 'The smallest indivisible unit of a currency.');
  ws.value.close(); cleanup(root);
});
