import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { parse } from 'yaml';
import type { Problem } from '../api.ts';
import { listFilesSorted } from '../util/fsx.ts';
import { hashParts, hashText, normalize } from '../util/hash.ts';
import { entitySchema, type Entity } from './schema.ts';
import { sortEdges, sortNodes, toEdges, toNode, type Edge, type Node } from './graph.ts';
import { compareIds } from './ids.ts';

export type Loaded = {
  nodes: Node[];
  edges: Edge[];
  sourceHash: string;
  /** per-entity content hash, for incremental compilation */
  hashes: Map<string, string>;
  problems: Problem[];
};

/**
 * The only place in the system that reads YAML. Every other operation reads the
 * compiled runtime, which is what keeps parsing to exactly once per compile.
 */
export const load = (knowledgeDir: string): Loaded => {
  const files = listFilesSorted(knowledgeDir, '.yaml');
  const entities: Entity[] = [];
  const problems: Problem[] = [];
  const hashes = new Map<string, string>();
  const parts: string[] = [];

  for (const file of files) {
    const raw = normalize(readFileSync(file, 'utf8'));
    let parsed: unknown;
    try {
      parsed = parse(raw);
    } catch (e) {
      problems.push({ severity: 'error', rule: 'parse', message: `${relative(knowledgeDir, file)}: ${(e as Error).message}` });
      continue;
    }
    const result = entitySchema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.issues[0];
      problems.push({
        severity: 'error', rule: 'schema',
        message: `${relative(knowledgeDir, file)}: ${first ? `${first.path.join('.')} ${first.message}` : 'invalid'}`,
      });
      continue;
    }
    entities.push(result.data);
    hashes.set(result.data.id, hashText(raw));
  }

  const seen = new Set<string>();
  for (const e of entities) {
    if (seen.has(e.id))
      problems.push({ severity: 'error', rule: 'duplicate-id', id: e.id, message: 'declared more than once' });
    seen.add(e.id);
  }

  // The source hash identifies the knowledge, not the file layout. Hashing in
  // path order would invalidate every cache when a file is moved between
  // directories, even though the compiled graph is byte-identical.
  for (const id of [...hashes.keys()].sort(compareIds)) parts.push(id, hashes.get(id)!);

  return {
    nodes: sortNodes(entities.map(toNode)),
    edges: sortEdges(entities.flatMap(toEdges)),
    sourceHash: hashParts(parts),
    hashes,
    problems,
  };
};
