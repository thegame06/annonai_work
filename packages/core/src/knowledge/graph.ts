import type { EdgeKind, NodeId } from '../api.ts';
import type { Entity } from './schema.ts';
import { compareIds } from './ids.ts';

export type Edge = { src: NodeId; dst: NodeId; kind: EdgeKind };

export type Node = {
  id: NodeId;
  kind: Entity['kind'];
  title: string;
  status: string;
  owner: string | undefined;
  created: string | undefined;
  source: string;
  tags: string[];
  summary: string | undefined;
  body: string | undefined;
  bytes: number;
  subject: string | undefined;
};

const text = (e: Entity): string =>
  [e.title, e.summary ?? '', e.body ?? '', 'definition' in e ? e.definition : ''].join('\n');

export const toNode = (e: Entity): Node => ({
  id: e.id,
  kind: e.kind,
  title: e.title,
  status: e.status,
  owner: e.owner,
  created: e.created,
  source: e.source,
  tags: [...e.tags].sort(),
  // A term's definition is its summary. Without this the definition never
  // reaches the runtime and every glossary entry renders empty.
  summary: e.kind === 'term' ? e.definition : e.summary,
  body: e.body,
  // Byte length of the rendered text. Deliberately a neutral size, not an
  // estimate of anything model-specific: this module may not know such concepts.
  bytes: Buffer.byteLength(text(e), 'utf8'),
  subject: e.kind === 'adr' ? e.subject : undefined,
});

/** Edges are derived from declared fields. No inference, no heuristics. */
export const toEdges = (e: Entity): Edge[] => {
  const out: Edge[] = [];
  const add = (dsts: readonly string[], kind: EdgeKind): void => {
    for (const dst of dsts) out.push({ src: e.id, dst, kind });
  };
  switch (e.kind) {
    case 'requirement': add([e.feature], 'refines'); break;
    case 'task': add(e.implements, 'implements'); add(e.touches, 'touches'); break;
    case 'adr': add(e.decides, 'decides'); break;
    case 'component': add(e.depends_on, 'depends_on'); break;
    case 'rule': add(e.applies_to, 'constrains'); break;
    case 'test': add(e.verifies, 'verifies'); break;
    default: break;
  }
  if (e.supersedes) out.push({ src: e.id, dst: e.supersedes, kind: 'supersedes' });
  return out;
};

export const sortNodes = (nodes: Node[]): Node[] => [...nodes].sort((a, b) => compareIds(a.id, b.id));

export const sortEdges = (edges: Edge[]): Edge[] =>
  [...edges].sort((a, b) => compareIds(a.src, b.src) || a.kind.localeCompare(b.kind) || compareIds(a.dst, b.dst));
