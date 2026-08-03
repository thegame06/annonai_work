import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Workspace } from '../src/index.ts';
import { cleanup, project, FEATURE, REQUIREMENT, TASK } from './helpers.ts';

/**
 * The workflow lives in the generated instructions, so the instructions are now
 * behaviour and must be tested like behaviour. The failure this guards against:
 * telling an agent to run a command that does not exist.
 */

const CLI_MAIN = join(import.meta.dirname, '../../cli/src/main.ts');
const MCP_SERVER = join(import.meta.dirname, '../../mcp/src/server.ts');

const implementedCommands = (): Set<string> => {
  const src = readFileSync(CLI_MAIN, 'utf8');
  const out = new Set<string>();
  for (const m of src.matchAll(/case '([a-z]+)':/g)) out.add(m[1]!);
  for (const m of src.matchAll(/cmd === '([a-z]+)'/g)) out.add(m[1]!);
  return out;
};

const implementedTools = (): Set<string> =>
  new Set([...readFileSync(MCP_SERVER, 'utf8').matchAll(/^\s+name: '([a-z_]+)',$/gm)].map((m) => m[1]!));

/** The template hard-wraps, so assertions run against whitespace-normalised text. */
const flat = (s: string): string => s.replace(/\s+/g, ' ');

const generate = (): string => {
  const root = project({
    'f.yaml': FEATURE, 'r.yaml': REQUIREMENT, 't.yaml': TASK,
    'c.yaml': 'id: CMP-0001\nkind: component\ntitle: engine\nstatus: active\nsummary: Does things.\n',
    'rule.yaml': 'id: RULE-0001\nkind: rule\ntitle: A rule\nstatus: active\napplies_to: [CMP-0001]\nsummary: Applies.\n',
  });
  const ws = Workspace.load(root);
  assert.ok(ws.ok);
  ws.value.compile();
  const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  ws.value.close();
  cleanup(root);
  return text;
};

test('every annona command named in the instructions is implemented', () => {
  const text = generate();
  const implemented = implementedCommands();
  const named = new Set([...text.matchAll(/`annona ([a-z]+)/g)].map((m) => m[1]!));
  assert.ok(named.size > 0, 'the instructions should name commands');
  for (const c of named)
    assert.ok(implemented.has(c), `instructions tell the agent to run "annona ${c}", which does not exist`);
});

test('every MCP tool named in the instructions is implemented', () => {
  const text = generate();
  const tools = implementedTools();
  const named = new Set([...text.matchAll(/`annona_([a-z_]+)`/g)].map((m) => m[1]!));
  for (const t of named)
    assert.ok(tools.has(t), `instructions name the MCP tool "annona_${t}", which does not exist`);
});

test('the instructions forbid depending on a specific implementation', () => {
  const text = flat(generate());
  assert.match(text, /which of your available tools can supply it/i);
  assert.match(text, /Use what is there. Work without what is not/i);
});

test('the instructions describe the full loop', () => {
  const text = generate();
  for (const stage of ['Discovery', 'The interview', 'Engineering brief', 'Plan', 'Implement', 'Review', 'Knowledge update', 'Done'])
    assert.match(text, new RegExp(stage, 'i'), `the workflow is missing the ${stage} stage`);
});

test('the instructions state what COMPLETE does not mean', () => {
  const text = generate();
  // H3 measured that 24.4% of a corpus can vanish with every verdict unchanged.
  // An agent that reads COMPLETE as "the knowledge is sufficient" is misled.
  assert.match(flat(text), /does \*\*not\*\* mean the knowledge is sufficient/);
});

test('the instructions cap the interview and forbid redundant questions', () => {
  const text = generate();
  assert.match(flat(text), /Maximum five questions/i);
  assert.match(flat(text), /Never ask a generic question/i);
  assert.match(flat(text), /already recorded tells the developer you did not look/i);
});

test('the project rules and components reach the agent', () => {
  const text = generate();
  assert.match(text, /RULE-0001/);
  assert.match(text, /CMP-0001/);
});

test('the instructions name no third-party tool', () => {
  const text = generate();
  // The environment decides which tools exist, not this file. Naming one couples
  // the workflow to an integration the project may not have.
  for (const tool of ['git', 'codegraph', 'jira', 'github', 'azure devops', 'confluence', 'gitlab', 'bitbucket'])
    assert.doesNotMatch(text, new RegExp(`\\b${tool}\\b`, 'i'), `the instructions name "${tool}"`);
});

test('every command the instructions give is an annona command', () => {
  const text = generate();
  // Anything else would be an instruction to run something that may not exist.
  const commands = [...text.matchAll(/`([a-z][a-z0-9_ .<>=,-]*)`/g)]
    .map((m) => m[1]!.trim().split(' ')[0]!)
    // field names and file names are not commands
    .filter((c) => !['implements', 'touches', 'missing'].includes(c) && !c.includes('.'));
  assert.ok(commands.length > 0);
  for (const c of new Set(commands))
    assert.equal(c, 'annona', `the instructions tell the agent to run "${c}", which the environment may not provide`);
});

test('the agent is told to take stock of its environment first', () => {
  const text = flat(generate());
  assert.match(text, /Know your environment/i);
  assert.match(text, /Annona is always present/i);
  assert.match(text, /Never announce that something is missing/i);
});

test('an absent integration never changes the workflow', () => {
  const text = flat(generate());
  assert.match(text, /identical whether you have Annona alone/i);
  assert.match(text, /never make it different/i);
});

test('discovery is four steps, not a list of tools', () => {
  const text = generate();
  for (const step of ['**Search.**', '**Infer.**', '**Correlate.**', '**Ask.**'])
    assert.ok(text.includes(step), `discovery is missing the step ${step}`);
  assert.match(flat(text), /Discovery is not a checklist of tools/i);
});

test('knowledge levels beyond Annona are explicitly optional', () => {
  const text = flat(generate());
  assert.match(text, /depend entirely on what your environment exposes/i);
  assert.match(text, /Never name a source you have not confirmed/i);
});

test('the interview is gated by all five filters', () => {
  const text = generate();
  for (const filter of ['no available source can answer it', 'cannot be inferred',
    'cannot be correlated', 'changes an engineering decision', 'reduces implementation uncertainty'])
    assert.ok(text.includes(filter), `missing interview filter: ${filter}`);
});

test('the brief separates confirmed, inferred and unknown', () => {
  const text = generate();
  for (const group of ['CONFIRMED', 'INFERRED', 'UNKNOWN'])
    assert.ok(text.includes(group), `the engineering brief must separate ${group}`);
});

test('knowledge economy is stated: task over requirement over feature', () => {
  const text = generate();
  assert.match(flat(text), /prefer a \*\*task\*\* over a new requirement/i);
  assert.match(flat(text), /prefer a \*\*requirement\*\* over a new feature/i);
});

test('review checks both directions, not just the code', () => {
  const text = generate();
  assert.match(flat(text), /Does the implementation still satisfy the knowledge/i);
  assert.match(flat(text), /Does the knowledge still describe the implementation/i);
});

test('an invalidated plan stops the work', () => {
  const text = generate();
  assert.match(flat(text), /If implementation invalidates the plan, stop/i);
});

test('the knowledge update question asks for durability', () => {
  const text = generate();
  assert.match(flat(text), /even if this code changes/i);
  assert.match(flat(text), /Never record what happened/i);
});

test('instructions regenerate identically', () => {
  assert.equal(generate(), generate());
});
