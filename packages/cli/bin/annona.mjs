#!/usr/bin/env node
// node:sqlite is stable from Node 24 and experimental in 22. The warning is
// noise on every invocation, so it is filtered explicitly rather than globally.
const emit = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const name = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
  if (name === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
  return emit.call(process, warning, ...rest);
};
const { main } = await import('../src/main.ts');
process.exit(await main(process.argv.slice(2)));
