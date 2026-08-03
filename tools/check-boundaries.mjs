// Freeze condition 5: dependency direction.
// Explicit allow-list. No tool config, no plugins, no options nobody reads.
// Direction: cli -> core(index) ; index -> api,workspace ; workspace -> commands
//            commands -> execution,knowledge,store ; execution -> knowledge,store,util
//            knowledge -> util ; store -> util ; api and config are importable by all
// Knowledge must never import execution, plugins, MCP, tokens or any AI concept.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** module group -> groups it may import from ('' = same group) */
const ALWAYS = ['core/src/api', 'core/src/config'];

const ALLOWED = {
  'core/src/api':       [],
  'core/src/config':    [],
  'core/src/index':     ['core/src/workspace'],
  'core/src/workspace': ['core/src/commands', 'core/src/store', 'core/src/util'],
  'core/src/commands':  ['core/src/execution', 'core/src/knowledge', 'core/src/store', 'core/src/util'],
  'core/src/execution': ['core/src/knowledge', 'core/src/store', 'core/src/util', 'core/src/execution'],
  'core/src/knowledge': ['core/src/api', 'core/src/util', 'core/src/knowledge'],
  'core/src/store':     ['core/src/api', 'core/src/util', 'core/src/store'],
  'core/src/util':      ['core/src/util'],
  'cli/src':            ['core/src/index', 'cli/src'],
  'mcp/src':            ['core/src/index', 'mcp/src'],
  'mcp/bin':            ['mcp/src'],
  'cli/bin':            ['cli/src'],
};

/** substrings forbidden anywhere under knowledge/ - the isolation rule */
const KNOWLEDGE_FORBIDDEN = ['token', 'mcp', 'agent', 'prompt', 'provider', 'jira', 'github', 'codegraph', 'llm'];

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === 'node_modules' || e === '.annona') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts') || p.endsWith('.mjs')) files.push(p);
  }
})(join(ROOT, 'packages'));

const groupOf = (file) => {
  const r = relative(join(ROOT, 'packages'), file).replaceAll('\\', '/');
  if (r.startsWith('core/src/')) {
    const rest = r.slice('core/src/'.length);
    return rest.includes('/') ? `core/src/${rest.split('/')[0]}` : `core/src/${rest.replace(/\.ts$/, '')}`;
  }
  if (r.startsWith('cli/src/')) return 'cli/src';
  if (r.startsWith('mcp/src/')) return 'mcp/src';
  if (r.startsWith('mcp/bin/')) return 'mcp/bin';
  if (r.startsWith('cli/bin/')) return 'cli/bin';
  return null;
};

const violations = [];
for (const file of files) {
  if (file.includes('/test/')) continue;
  const from = groupOf(file);
  if (from === null) continue;
  const src = readFileSync(file, 'utf8');

  if (from === 'core/src/knowledge') {
    for (const word of KNOWLEDGE_FORBIDDEN) {
      const re = new RegExp(`\\b${word}`, 'i');
      if (re.test(src)) violations.push(`${relative(ROOT, file)}: knowledge must not mention "${word}" (isolation rule)`);
    }
  }

  for (const m of src.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) {
      if (from.startsWith('core/src') && !['zod', 'yaml', 'node:'].some((ok) => spec.startsWith(ok)))
        violations.push(`${relative(ROOT, file)}: core may not depend on "${spec}"`);
      if (from.startsWith('mcp/') && !['@annona/core', 'node:'].some((ok) => spec.startsWith(ok)))
        violations.push(`${relative(ROOT, file)}: the mcp adapter may only use the public Workspace API, not "${spec}"`);
      continue;
    }
    const target = groupOf(resolve(dirname(file), spec));
    if (target === null) continue;
    const allowed = [...(ALLOWED[from] ?? []), ...(from === 'core/src/api' ? [] : ALWAYS)];
    if (target !== from && !allowed.includes(target))
      violations.push(`${relative(ROOT, file)}: ${from} -> ${target} is not an allowed direction`);
  }
}

if (violations.length) {
  console.error('Boundary violations:\n' + violations.map((v) => '  ' + v).join('\n'));
  process.exit(1);
}
console.log(`boundaries ok (${files.length} files)`);
