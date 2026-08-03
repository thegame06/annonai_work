import type { Detail, EdgeKind, NodeId } from '../api.ts';
import type { KnowledgeStore, SearchOpts, StoredEdge, StoredNode } from './store.ts';

/** Used by Core's own tests. Internal, like the interface it implements. */
export class MemoryStore implements KnowledgeStore {
  #nodes = new Map<NodeId, StoredNode>();
  #edges: StoredEdge[] = [];
  #meta = new Map<string, string>();

  put(nodes: readonly StoredNode[], edges: readonly StoredEdge[]): void {
    this.#nodes = new Map(nodes.map((n) => [n.id, n]));
    this.#edges = [...edges];
  }
  get(ids: readonly NodeId[], detail: Detail): StoredNode[] {
    return ids.map((id) => this.#nodes.get(id)).filter((n): n is StoredNode => n !== undefined)
      .map((n) => ({ ...n, summary: detail === 'title' ? undefined : n.summary, body: detail === 'full' ? n.body : undefined }));
  }
  list(kind: string): StoredNode[] {
    return [...this.#nodes.values()].filter((n) => n.kind === kind).sort((a, b) => a.id.localeCompare(b.id));
  }
  neighbors(id: NodeId, kind?: EdgeKind): StoredEdge[] {
    return this.#edges.filter((e) => (e.src === id || e.dst === id) && (kind === undefined || e.kind === kind));
  }
  search(query: string, opts: SearchOpts): NodeId[] {
    const q = query.toLowerCase();
    return [...this.#nodes.values()]
      .filter((n) => (opts.kinds?.length ? opts.kinds.includes(n.kind) : true))
      .filter((n) => [n.title, n.summary ?? '', n.body ?? ''].join(' ').toLowerCase().includes(q))
      .slice(0, opts.limit).map((n) => n.id);
  }
  meta(key: string): string | undefined { return this.#meta.get(key); }
  setMeta(key: string, value: string): void { this.#meta.set(key, value); }
  close(): void {}
}
