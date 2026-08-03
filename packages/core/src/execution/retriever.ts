import type { EdgeKind, NodeId } from '../api.ts';
import type { KnowledgeStore, StoredEdge } from '../store/store.ts';

/**
 * A retrieved reference. Deliberately not a node: the retriever decides what is
 * relevant, the compiler decides how much of it to include. Keeping this to
 * three primitive fields is what stops the extension point from being welded to
 * the internal graph representation.
 */
export type Ref = { id: NodeId; via: EdgeKind | 'seed'; depth: number };

type Step = { edge: EdgeKind; direction: 'out' | 'in'; from: readonly string[] };

/**
 * Bounded traversal plan. Every step is declared: there is no generic graph
 * query, no full scan, and no way to express unbounded expansion.
 * Order of steps is fixed, which is one half of the determinism guarantee.
 */
const PLAN: readonly Step[] = [
  { edge: 'implements', direction: 'out', from: ['task'] },        // task    -> requirement
  { edge: 'touches', direction: 'out', from: ['task'] },           // task    -> component
  { edge: 'refines', direction: 'out', from: ['requirement'] },    // req     -> feature
  { edge: 'decides', direction: 'in', from: ['requirement', 'component'] },   // adr  -> req/cmp
  { edge: 'constrains', direction: 'in', from: ['requirement', 'component', 'feature'] }, // rule -> *
  { edge: 'verifies', direction: 'in', from: ['requirement'] },    // test    -> requirement
  { edge: 'depends_on', direction: 'out', from: ['component'] },   // cmp     -> cmp
];

const MAX_DEPTH = 3;

export class GraphRetriever {
  readonly #store: KnowledgeStore;
  constructor(store: KnowledgeStore) { this.#store = store; }

  /**
   * Deterministic: identical store + seed always yields the same array, in the
   * same order. Bounded: at most MAX_DEPTH rounds over a fixed plan.
   */
  retrieve(seed: NodeId): Ref[] {
    const seedNode = this.#store.get([seed], 'title')[0];
    if (!seedNode) return [];

    const found = new Map<NodeId, Ref>([[seed, { id: seed, via: 'seed', depth: 0 }]]);
    const kindOf = new Map<NodeId, string>([[seed, seedNode.kind]]);
    let frontier: NodeId[] = [seed];

    for (let depth = 1; depth <= MAX_DEPTH && frontier.length > 0; depth++) {
      const next: NodeId[] = [];
      for (const step of PLAN) {
        const sources = frontier.filter((id) => step.from.includes(kindOf.get(id) ?? ''));
        for (const src of [...sources].sort()) {
          const edges: StoredEdge[] = this.#store.neighbors(src, step.edge);
          const matching = edges
            .filter((e) => (step.direction === 'out' ? e.src === src : e.dst === src))
            .map((e) => (step.direction === 'out' ? e.dst : e.src))
            .sort();
          for (const id of matching) {
            if (found.has(id)) continue;
            const node = this.#store.get([id], 'title')[0];
            if (!node) continue;
            found.set(id, { id, via: step.edge, depth });
            kindOf.set(id, node.kind);
            next.push(id);
          }
        }
      }
      frontier = next.sort();
    }

    return [...found.values()].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  }
}
