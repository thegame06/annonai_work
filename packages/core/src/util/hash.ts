import { createHash } from 'node:crypto';

/**
 * Determinism invariant: hash content only, never mtime, size or path metadata,
 * and normalize line endings first. Without normalization a Windows checkout
 * produces different hashes than Linux CI for identical commits.
 */
export const normalize = (text: string): string => text.replaceAll('\r\n', '\n');

export const hashText = (text: string): string =>
  createHash('sha256').update(normalize(text), 'utf8').digest('hex');

export const hashParts = (parts: readonly string[]): string => {
  const h = createHash('sha256');
  for (const p of parts) h.update(p, 'utf8').update(' ');
  return h.digest('hex');
};
