import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { CompiledContext, NodeId } from '../api.ts';

/**
 * Content-addressed. sourceHash is part of the key, so a stale entry is not
 * possible and invalidation is not a subsystem.
 */
export const cacheKey = (task: NodeId, budget: number, sourceHash: string): string =>
  createHash('sha256').update([task, String(budget), sourceHash].join('|'), 'utf8').digest('hex').slice(0, 32);

export class ContextCache {
  readonly #dir: string;
  constructor(runtimeDir: string) {
    this.#dir = join(runtimeDir, 'cache', 'context');
    mkdirSync(this.#dir, { recursive: true });
  }
  read(key: string): CompiledContext | undefined {
    const p = join(this.#dir, `${key}.json`);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, 'utf8')) as CompiledContext;
  }
  write(key: string, ctx: CompiledContext): void {
    writeFileSync(join(this.#dir, `${key}.json`), JSON.stringify(ctx));
  }
}
