import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type {
  CheckReport, CompiledContext, CompileReport, HealthReport, KnowledgeApi, NodeId, Result, TraceInput,
} from './api.ts';
import { attribute, dispatch, session, trace, type Ctx } from './commands/handlers.ts';
import { configSchema, SUPPORTED_FORMAT } from './config.ts';
import { SqliteStore } from './store/sqlite.ts';
import { ensureDir } from './util/fsx.ts';
import { err, ok } from './util/result.ts';

const CONFIG = 'annona.yaml';
const RUNTIME_DIR = '.annona';
const DB = 'runtime.db';

/**
 * The only public entry point. Every operation starts here.
 *
 * load() is read-only. It never compiles: auto-compiling would make a read take
 * unbounded time and would race between concurrent processes. A stale runtime
 * is reported, not silently repaired.
 */
export class Workspace {
  readonly #ctx: Ctx;
  #knowledge: KnowledgeApi | undefined;

  private constructor(root: string, projectName: string) {
    let store = new SqliteStore(join(root, RUNTIME_DIR, DB));
    this.#ctx = {
      root,
      projectName,
      get store() { return store; },
      reopen: (path: string) => new SqliteStore(path),
      set: (s) => { store = s as SqliteStore; },
    } as Ctx;
  }

  /** Constant time: opens a handle and reads config. Never loads the graph. */
  static load(root: string = process.cwd()): Result<Workspace> {
    const configPath = join(root, CONFIG);
    if (!existsSync(configPath))
      return err('NOT_A_WORKSPACE', `no ${CONFIG} in ${root}`, 'run: annona init');

    const parsed = configSchema.safeParse(parse(readFileSync(configPath, 'utf8')));
    if (!parsed.success) return err('INVALID_ENTITY', `${CONFIG} is invalid`);
    if (parsed.data.format !== SUPPORTED_FORMAT)
      return err(
        'UNKNOWN_FORMAT',
        `${CONFIG} declares format ${parsed.data.format}; this build supports ${SUPPORTED_FORMAT}`,
        'upgrade annona, or check out a matching revision',
      );

    ensureDir(join(root, RUNTIME_DIR));
    try {
      return ok(new Workspace(root, parsed.data.name));
    } catch (e) {
      return err(
        'IO',
        `cannot open the runtime at ${join(root, RUNTIME_DIR)}: ${(e as Error).message}`,
        'the runtime needs a filesystem that supports file locking; network and FUSE mounts often do not',
      );
    }
  }

  compile(clean = false): Result<CompileReport> { return dispatch(this.#ctx, { type: 'compile', clean }); }
  check(strict = false): Result<CheckReport> { return dispatch(this.#ctx, { type: 'check', strict }); }

  /** Read-only knowledge health. Reports; never modifies. */
  doctor(): Result<HealthReport> { return dispatch(this.#ctx, { type: 'doctor' }); }

  /** The one question Annona answers. */
  context(task: NodeId, budget = 8000, noCache = false): Result<CompiledContext> {
    return dispatch(this.#ctx, { type: 'context', task, budget, noCache });
  }

  /** Memoized and cheap: accessing it opens nothing. */
  knowledge(): KnowledgeApi {
    this.#knowledge ??= {
      get: (ids, detail = 'summary') => dispatch(this.#ctx, { type: 'knowledge.get', ids, detail }),
      list: (kind) => dispatch(this.#ctx, { type: 'knowledge.list', kind }),
      search: (query, limit = 20, kinds) => dispatch(this.#ctx, { type: 'knowledge.search', query, kinds, limit }),
      related: (id, edge) => dispatch(this.#ctx, { type: 'knowledge.related', id, edge }),
    };
    return this.#knowledge;
  }

  sourceHash(): string | undefined { return this.#ctx.store.meta('source_hash'); }

  /** Groups every record of one execution. Derived, never configured. */
  session(): string { return session(); }

  /** Attribution for adapters that know who is calling, e.g. the MCP handshake. */
  attribute(callerName: string): void { attribute(callerName); }

  /** Record one step of an execution. Used by adapters to attribute their calls. */
  trace(input: TraceInput): void { trace(this.#ctx.root, input); }
  close(): void { this.#ctx.store.close(); }
  [Symbol.dispose](): void { this.close(); }
}
