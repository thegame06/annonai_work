import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Workspace, type Result } from '@annona/core';
import { benchContext } from './bench.ts';
import { metrics } from './metrics.ts';
import { replay } from './replay.ts';
import { done } from './done.ts';
import { benchAgent } from './agentbench.ts';

/** Frozen: 0 success, 1 error, 2 usage, 3 halt / incomplete knowledge. */
const EXIT = { ok: 0, error: 1, usage: 2, halt: 3 } as const;

const USAGE = `annona <command>

  init                 scaffold annona.yaml and annona/
  compile [--clean]    source -> runtime. the only lifecycle command
  check [--strict]     validate knowledge
  get <id>             read one entity
  list <kind>          list entities of a kind
  context <task>       compile the context for a task
  doctor               knowledge health report (read-only)
  done <task>          mark a task complete and resync knowledge
  replay [session]     reconstruct an execution timeline
  metrics              dogfooding metrics from local telemetry
  bench context        run the golden dataset benchmark
  bench agent          compare repo-only against Annona context

  --json               machine-readable output on any command`;

const out = (json: boolean, human: string, data: unknown): void => {
  console.log(json ? JSON.stringify(data, null, 2) : human);
};

const fail = (json: boolean, r: Extract<Result<unknown>, { ok: false }>): number => {
  if (json) console.error(JSON.stringify(r.error, null, 2));
  else {
    console.error(`error [${r.error.code}]: ${r.error.message}`);
    if (r.error.resolveWith) console.error(`  ${r.error.resolveWith}`);
  }
  return EXIT.error;
};

const init = (root: string, json: boolean): number => {
  if (existsSync(join(root, 'annona.yaml'))) {
    console.error('already a workspace');
    return EXIT.error;
  }
  writeFileSync(join(root, 'annona.yaml'), 'format: 1\nname: untitled\n');
  for (const d of ['annona/features', 'annona/architecture', 'annona/adrs', 'annona/rules', 'annona/glossary'])
    mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, '.gitignore'), '.annona/\n', { flag: 'a' });
  out(json, 'initialized. next: annona compile', { initialized: true });
  return EXIT.ok;
};

export const main = async (argv: string[]): Promise<number> => {
  const json = argv.includes('--json');
  const args = argv.filter((a) => !a.startsWith('--'));
  const cmd = args[0];
  const root = process.cwd();

  if (!cmd || cmd === 'help') { console.log(USAGE); return cmd ? EXIT.ok : EXIT.usage; }
  if (cmd === 'init') return init(root, json);
  if (cmd === 'bench') {
    if (args[1] !== 'context' && args[1] !== 'agent') { console.error('usage: annona bench context|agent'); return EXIT.usage; }
    const budgetArg = argv.find((a) => a.startsWith('--budget='));
    const golden = argv.find((a) => a.startsWith('--dataset='))?.split('=')[1]
      ?? join(root, 'bench', 'golden');
    if (args[1] === 'agent') {
      const tasksArg = argv.find((a) => a.startsWith('--tasks='))?.split('=')[1];
      const taskList = tasksArg
        ? tasksArg.split(',')
        : Object.keys(JSON.parse(readFileSync(join(golden, 'expectations.json'), 'utf8')) as Record<string, unknown>).sort().slice(0, 10);
      return benchAgent(golden, taskList, argv.find((a) => a.startsWith('--runner='))?.split('=')[1], json);
    }
    return benchContext(golden, budgetArg ? Number(budgetArg.split('=')[1]) : 8000, json);
  }

  const ws = Workspace.load(root);
  if (!ws.ok) return fail(json, ws);
  const w = ws.value;
  try {
    switch (cmd) {
      case 'compile': {
        const r = w.compile(argv.includes('--clean'));
        if (!r.ok) return fail(json, r);
        out(json, `compiled ${r.value.entities} entities, ${r.value.edges} edges in ${r.value.durationMs}ms` +
          (r.value.changed === 0 ? ' (unchanged)' : ''), r.value);
        return EXIT.ok;
      }
      case 'check': {
        const r = w.check(argv.includes('--strict'));
        if (!r.ok) return fail(json, r);
        const lines = r.value.problems.map((p) => `${p.severity} ${p.rule} ${p.id ?? ''} ${p.message}`);
        out(json, lines.length ? lines.join('\n') : 'no problems', r.value);
        return r.value.errors > 0 ? EXIT.error : EXIT.ok;
      }
      case 'get': {
        const id = args[1];
        if (!id) { console.error('usage: annona get <id>'); return EXIT.usage; }
        const r = w.knowledge().get([id], 'full');
        if (!r.ok) return fail(json, r);
        if (r.value.length === 0) { console.error(`not found: ${id}`); return EXIT.halt; }
        const e = r.value[0]!;
        out(json, `${e.id}  ${e.title}\nkind: ${e.kind}  status: ${e.status}\n${e.summary ?? ''}`, e);
        return EXIT.ok;
      }
      case 'context': {
        const task = args[1];
        if (!task) { console.error('usage: annona context <task>'); return EXIT.usage; }
        const budgetArg = argv.find((a) => a.startsWith('--budget='));
        const r = w.context(task, budgetArg ? Number(budgetArg.split('=')[1]) : 8000);
        if (!r.ok) return fail(json, r);
        const c = r.value;
        if (json) { console.log(JSON.stringify(c, null, 2)); }
        else {
          console.log(c.text);
          console.log(`\n--- ${c.verdict}  ${c.used}/${c.budget} tokens  ${c.nodes} nodes  ${c.cacheHit ? 'cached' : 'compiled'}`);
          for (const m of c.missing) console.log(`missing ${m.kind}: ${m.message}`);
        }
        return c.verdict === 'COMPLETE' ? EXIT.ok : EXIT.halt;
      }
      case 'doctor': {
        const r = w.doctor();
        if (!r.ok) return fail(json, r);
        const lines = r.value.findings.map((f) => `${f.check.padEnd(22)} ${f.id.padEnd(11)} ${f.message}`);
        out(json, [
          `${r.value.entities} entities, ${r.value.findings.length} findings`,
          ...lines,
        ].join('\n'), r.value);
        return EXIT.ok;
      }
      case 'metrics': return metrics(root, json);
      case 'replay': return replay(root, args[1], json);
      case 'done': {
        const task = args[1];
        if (!task) { console.error('usage: annona done <task> [--touches=CMP-1,CMP-2]'); return EXIT.usage; }
        const t = argv.find((a) => a.startsWith('--touches='))?.split('=')[1];
        return done(root, task, t ? t.split(',').map((x) => x.trim()).filter(Boolean) : [], json);
      }
      case 'list': {
        const kind = args[1];
        if (!kind) { console.error('usage: annona list <kind>'); return EXIT.usage; }
        const r = w.knowledge().list(kind);
        if (!r.ok) return fail(json, r);
        out(json, r.value.map((e) => `${e.id}  ${e.status.padEnd(12)} ${e.title}`).join('\n') || `no ${kind}s`, r.value);
        return EXIT.ok;
      }
      default:
        console.error(`unknown command: ${cmd}\n\n${USAGE}`);
        return EXIT.usage;
    }
  } finally {
    w.close();
  }
};
