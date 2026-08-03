import { readdirSync, statSync, renameSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Determinism invariant: directory order differs between ext4, APFS and NTFS.
 * Sorting here is what keeps the compiled runtime identical across platforms.
 */
export const listFilesSorted = (dir: string, ext: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(ext)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
};

export const ensureDir = (dir: string): void => { mkdirSync(dir, { recursive: true }); };

/** Atomic publish: an interrupted compile must never leave a readable half-runtime. */
export const replaceFile = (tmp: string, final: string): void => {
  if (existsSync(final)) rmSync(final, { force: true });
  renameSync(tmp, final);
};
