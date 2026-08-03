// Freeze condition 4: public API snapshot.
// The public surface is exactly two files. Changing them fails CI until the
// snapshot is updated in the same commit, which makes the change deliberate.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCES = ['packages/core/src/api.ts', 'packages/core/src/index.ts'];
const SNAPSHOT = join(ROOT, 'packages/core/api/core.api.txt');

const normalize = (s) =>
  s.replaceAll('\r\n', '\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && l.trim() !== '')
    .join('\n');

const current = SOURCES.map((f) => `=== ${f} ===\n${normalize(readFileSync(join(ROOT, f), 'utf8'))}`).join('\n\n');

if (process.argv.includes('--update') || !existsSync(SNAPSHOT)) {
  writeFileSync(SNAPSHOT, current);
  console.log('api snapshot written');
  process.exit(0);
}
if (readFileSync(SNAPSHOT, 'utf8') !== current) {
  console.error('Public API changed. Review the diff, then run: npm run check:api:update');
  process.exit(1);
}
console.log('api snapshot ok');
