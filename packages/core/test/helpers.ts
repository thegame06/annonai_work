import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const project = (entities: Record<string, string>, eol: '\n' | '\r\n' = '\n'): string => {
  const root = mkdtempSync(join(tmpdir(), 'annona-'));
  writeFileSync(join(root, 'annona.yaml'), 'format: 1\nname: test\n');
  for (const [path, body] of Object.entries(entities)) {
    const full = join(root, 'annona', path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body.replaceAll('\n', eol));
  }
  return root;
};

export const cleanup = (root: string): void => rmSync(root, { recursive: true, force: true });

export const FEATURE = `id: FEAT-0001
kind: feature
title: A feature
status: draft
summary: Something
`;
export const REQUIREMENT = `id: REQ-0001
kind: requirement
title: A requirement
status: draft
feature: FEAT-0001
`;
export const TASK = `id: TASK-0001
kind: task
title: A task
status: draft
implements: [REQ-0001]
`;
