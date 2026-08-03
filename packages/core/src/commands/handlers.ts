import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckReport, CompiledContext, CompileReport, Entity, HealthReport, Relation, Result, TraceInput } from '../api.ts';
import { health } from '../execution/health.ts';
import { record, sessionId, setCaller } from '../execution/telemetry.ts';

import { compileContext } from '../execution/compiler.ts';
import { ContextCache, cacheKey } from '../execution/cache.ts';
import { load } from '../knowledge/compile.ts';
import { SUPPORTED_FORMAT } from '../config.ts';
import { validate } from '../knowledge/validate.ts';
import type { KnowledgeStore, StoredNode } from '../store/store.ts';
import { ensureDir, replaceFile } from '../util/fsx.ts';
import { AGENT_FILES, renderInstructions } from '../execution/instructions.ts';
import { err, ok } from '../util/result.ts';
import type { Command, CommandResult } from './index.ts';

export type Ctx = {
  root: string;
  projectName: string;
  store: KnowledgeStore;
  /** replaces the store handle after an atomic runtime swap */
  reopen: (path: string) => KnowledgeStore;
  set: (store: KnowledgeStore) => void;
};

const SOURCE_DIR = 'annona';
const RUNTIME_DIR = '.annona';
const DB = 'runtime.db';
/** Re-exported so Workspace never reaches into Execution directly. */
export const session = (): string => sessionId();
export const attribute = (name: string): void => { setCaller(name); };
export const trace = (root: string, input: TraceInput): void => {
  record(join(root, RUNTIME_DIR), input);
};


export const view = (n: StoredNode): Entity => ({
  id: n.id, kind: n.kind as Entity['kind'], title: n.title, status: n.status,
  owner: n.owner, created: n.created, source: n.source, tags: n.tags,
  summary: n.summary, body: n.body, bytes: n.bytes,
});

const compile = (ctx: Ctx, clean: boolean): Result<CompileReport> => {
  const started = Date.now();
  const runtime = join(ctx.root, RUNTIME_DIR);
  const loaded = load(join(ctx.root, SOURCE_DIR));
  const fatal = loaded.problems.filter((p) => p.severity === 'error');
  if (fatal.length > 0)
    return err('INVALID_KNOWLEDGE', fatal.map((p) => `${p.rule}: ${p.message}`).join('\n'));

  const previous = clean ? undefined : ctx.store.meta('source_hash');
  if (previous === loaded.sourceHash && existsSync(join(runtime, DB)))
    return ok({
      entities: loaded.nodes.length, edges: loaded.edges.length,
      sourceHash: loaded.sourceHash, changed: 0, durationMs: Date.now() - started,
    });

  const tmp = join(runtime, `${DB}.tmp`);
  rmSync(tmp, { force: true });
  const staging = ctx.reopen(tmp);
  staging.put(loaded.nodes, loaded.edges);
  staging.setMeta('source_hash', loaded.sourceHash);
  staging.setMeta('format', String(SUPPORTED_FORMAT));
  staging.close();
  ctx.store.close();
  replaceFile(tmp, join(runtime, DB));
  ctx.set(ctx.reopen(join(runtime, DB)));

  // Generated agent instruction files. Written into the disposable runtime and
  // materialised at the root, where the tools that consume them require them.
  // They are gitignored: nothing generated is ever committed (RULE-0003).
  const generated = join(runtime, 'generated');
  ensureDir(generated);
  const rules = ctx.store.list('rule').filter((r) => r.status === 'active');
  const terms = ctx.store.list('term');
  const components = ctx.store.list('component');
  for (const { file, preamble } of AGENT_FILES) {
    const text = renderInstructions(ctx.projectName, preamble, rules, terms, components);
    writeFileSync(join(generated, file), text);
    writeFileSync(join(ctx.root, file), text);
  }

  const durationMs = Date.now() - started;
  record(runtime, { command: 'compile', durationMs, entities: loaded.nodes.length, ok: true });
  return ok({
    entities: loaded.nodes.length, edges: loaded.edges.length,
    sourceHash: loaded.sourceHash, changed: loaded.nodes.length, durationMs,
  });
};

const doctor = (ctx: Ctx): Result<HealthReport> => {
  const started = Date.now();
  if (ctx.store.meta('source_hash') === undefined)
    return err('STALE_RUNTIME', 'no compiled runtime', 'run: annona compile');
  const report = health(ctx.store);
  record(join(ctx.root, RUNTIME_DIR), {
    command: 'doctor', durationMs: Date.now() - started,
    entities: report.entities, nodes: report.findings.length, ok: true,
  });
  return ok(report);
};

const context = (ctx: Ctx, task: string, budget: number, noCache: boolean): Result<CompiledContext> => {
  const sourceHash = ctx.store.meta('source_hash');
  if (sourceHash === undefined)
    return err('STALE_RUNTIME', 'no compiled runtime', 'run: annona compile');

  const cache = new ContextCache(join(ctx.root, RUNTIME_DIR));
  const key = cacheKey(task, budget, sourceHash);
  if (!noCache) {
    const hit = cache.read(key);
    if (hit) {
      record(join(ctx.root, RUNTIME_DIR), {
        command: 'context', task, durationMs: 0, verdict: hit.verdict, nodes: hit.nodes,
        cacheHit: true, missing: hit.missing.length, budget: hit.budget, tokens: hit.used, ok: true,
      });
      return ok({ ...hit, cacheHit: true });
    }
  }
  const compiled = compileContext({ store: ctx.store, task, budget, sourceHash });
  cache.write(key, compiled);
  record(join(ctx.root, RUNTIME_DIR), {
    command: 'context', task, durationMs: compiled.timings.totalMs,
    verdict: compiled.verdict, nodes: compiled.nodes, cacheHit: false,
    missing: compiled.missing.length, budget: compiled.budget, tokens: compiled.used, ok: true,
  });
  return ok(compiled);
};

const check = (ctx: Ctx, strict: boolean): Result<CheckReport> => {
  const loaded = load(join(ctx.root, SOURCE_DIR));
  const problems = [...loaded.problems, ...validate(loaded.nodes, loaded.edges)];
  const promoted = strict ? problems.map((p) => ({ ...p, severity: 'error' as const })) : problems;
  return ok({
    problems: promoted,
    errors: promoted.filter((p) => p.severity === 'error').length,
    warnings: promoted.filter((p) => p.severity === 'warning').length,
  });
};

/** Explicit dispatch. No auto-discovery, no reflection, greppable. */
export const dispatch = <T extends Command['type']>(
  ctx: Ctx,
  cmd: Extract<Command, { type: T }>,
): Result<CommandResult[T]> => {
  type R = Result<CommandResult[T]>;
  switch (cmd.type) {
    case 'knowledge.get': return ok(ctx.store.get(cmd.ids, cmd.detail).map(view)) as R;
    case 'knowledge.list': return ok(ctx.store.list(cmd.kind).map(view)) as R;
    case 'knowledge.search':
      return ok(ctx.store.get(ctx.store.search(cmd.query, { kinds: cmd.kinds, limit: cmd.limit }), 'summary').map(view)) as R;
    case 'knowledge.related':
      return ok(ctx.store.neighbors(cmd.id, cmd.edge).map((e): Relation =>
        e.src === cmd.id ? { id: e.dst, kind: e.kind, direction: 'out' } : { id: e.src, kind: e.kind, direction: 'in' })) as R;
    case 'compile': return compile(ctx, cmd.clean) as R;
    case 'check': return check(ctx, cmd.strict) as R;
    case 'context': return context(ctx, cmd.task, cmd.budget, cmd.noCache) as R;
    case 'doctor': return doctor(ctx) as R;
    default: return err('IO', 'unknown command') as R;
  }
};
