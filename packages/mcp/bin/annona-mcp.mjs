#!/usr/bin/env node
const emit = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const name = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
  if (name === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
  return emit.call(process, warning, ...rest);
};
const { serve } = await import('../src/server.ts');
serve(process.cwd());
