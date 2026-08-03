import type { Detail, EdgeKind, NodeId } from '../api.ts';

/**
 * INTERNAL. Not exported from index.ts.
 * Two first-party implementations exist; publishing this would freeze the graph
 * representation for the benefit of a third-party store nobody has requested.
 * Publishing later is additive. Unpublishing is not possible.
 */
export type StoredNode = {
  id: NodeId; kind: string; title: string; status: string;
  owner?: string; created?: string; source: string; tags: string[];
  summary?: string; body?: string; bytes: number; subject?: string;
};

export type StoredEdge = { src: NodeId; dst: NodeId; kind: EdgeKind };

export type SearchOpts = { kinds?: readonly string[]; limit: number };

export interface KnowledgeStore {
  put(nodes: readonly StoredNode[], edges: readonly StoredEdge[]): void;
  get(ids: readonly NodeId[], detail: Detail): StoredNode[];
  list(kind: string): StoredNode[];
  neighbors(id: NodeId, kind?: EdgeKind): StoredEdge[];
  search(query: string, opts: SearchOpts): NodeId[];
  meta(key: string): string | undefined;
  setMeta(key: string, value: string): void;
  close(): void;
}
