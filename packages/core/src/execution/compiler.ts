import { createHash } from 'node:crypto';
import type {
  CompiledContext, ContextLayer, Detail, ExcludedNode, IncludedNode, MissingItem, NodeId, Verdict,
} from '../api.ts';
import type { KnowledgeStore, StoredNode } from '../store/store.ts';
import { GraphRetriever, type Ref } from './retriever.ts';
import { estimateTokens } from './tokens.ts';

/** Layer assignment by kind. Slow-changing first, so prompt caches hit. */
const LAYER: Record<string, ContextLayer> = {
  term: 'L0', component: 'L1', adr: 'L1', feature: 'L2',
  requirement: 'L2', rule: 'L3', test: 'L4', task: 'L5',
};

/** Pinned kinds must be present at >= summary detail or the context is incomplete. */
const PINNED = new Set(['task', 'requirement', 'feature', 'component']);

/** Declared priors, integers. No learned weights, no similarity, no recency. */
const PRIOR: Record<string, number> = {
  task: 1000, requirement: 900, feature: 800, adr: 700,
  rule: 650, component: 600, test: 300, term: 200,
};

const DETAILS: readonly Detail[] = ['title', 'summary', 'full'];

const render = (n: StoredNode, detail: Detail): string => {
  const head = `${n.id} [${n.kind}/${n.status}] ${n.title}`;
  if (detail === 'title') return head;
  const parts = [head];
  if (n.summary) parts.push(n.summary);
  if (detail === 'full' && n.body) parts.push(n.body);
  return parts.join('\n');
};

/**
 * Framing the renderer adds: one blank-line separator per node, plus a header
 * per layer. The allocator must pay for what it renders, otherwise `used` can
 * exceed the budget the caller set.
 */
const SEPARATOR_TOKENS = 1;
const LAYER_HEADER_TOKENS = 3;
const FRAME_RESERVE = 6 * LAYER_HEADER_TOKENS;

const cost = (n: StoredNode, detail: Detail): number =>
  estimateTokens(render(n, detail)) + SEPARATOR_TOKENS;

type Candidate = { node: StoredNode; ref: Ref; layer: ContextLayer; pinned: boolean; score: number };

export type CompileContextInput = {
  store: KnowledgeStore;
  task: NodeId;
  budget: number;
  sourceHash: string;
};

export const compileContext = (input: CompileContextInput): CompiledContext => {
  const t0 = Date.now();
  const { store, task, budget } = input;

  // ---- 1. retrieve --------------------------------------------------------
  const refs = new GraphRetriever(store).retrieve(task);
  const tRetrieve = Date.now();

  const nodes = new Map(store.get(refs.map((r) => r.id), 'full').map((n) => [n.id, n]));
  const candidates: Candidate[] = refs
    .map((ref) => {
      const node = nodes.get(ref.id);
      if (!node) return null;
      return {
        node, ref,
        layer: LAYER[node.kind] ?? 'L4',
        pinned: PINNED.has(node.kind),
        // integer arithmetic only: prior, minus a fixed decay per hop
        score: (PRIOR[node.kind] ?? 100) - ref.depth * 50,
      } satisfies Candidate;
    })
    .filter((c): c is Candidate => c !== null);

  // ---- 2. validation ------------------------------------------------------
  const missing: MissingItem[] = [];
  const has = (kind: string): boolean => candidates.some((c) => c.node.kind === kind);
  const seedNode = nodes.get(task);

  if (!seedNode) {
    missing.push({ kind: 'requirement', message: `task ${task} not found`, searched: [task] });
  } else {
    if (!has('requirement'))
      missing.push({ kind: 'requirement', message: `${task} implements no requirement`, searched: ['implements'] });
    if (!has('feature'))
      missing.push({ kind: 'feature', message: 'no feature governs this work', searched: ['implements', 'refines'] });
    if (!has('component'))
      missing.push({ kind: 'architecture', message: `${task} touches no known component`, searched: ['touches'] });
  }

  // ---- 3. selection -------------------------------------------------------
  const ordered = [...candidates].sort(
    (a, b) => b.score - a.score || a.layer.localeCompare(b.layer) || a.node.id.localeCompare(b.node.id),
  );
  const pinned = ordered.filter((c) => c.pinned);
  const optional = ordered.filter((c) => !c.pinned);
  const tSelect = Date.now();

  // ---- 4. budget allocation ----------------------------------------------
  // Pinned nodes are admitted at the highest detail that fits, never below
  // summary. If they cannot fit at summary, the context is incomplete and says so.
  const chosen = new Map<NodeId, { c: Candidate; detail: Detail; tokens: number }>();
  let used = FRAME_RESERVE;

  for (const c of pinned) {
    const summaryCost = cost(c.node, 'summary');
    if (used + summaryCost > budget) {
      missing.push({
        kind: 'budget',
        message: `budget ${budget} cannot hold required ${c.node.kind} ${c.node.id} (needs ${summaryCost} more)`,
        searched: [c.node.id],
      });
      continue;
    }
    chosen.set(c.node.id, { c, detail: 'summary', tokens: summaryCost });
    used += summaryCost;
  }

  const excluded: ExcludedNode[] = [];
  for (const c of optional) {
    const summaryCost = cost(c.node, 'summary');
    if (used + summaryCost > budget) {
      excluded.push({ id: c.node.id, kind: c.node.kind as ExcludedNode['kind'] extends never ? never : IncludedNode['kind'], reason: 'budget', tokens: summaryCost });
      continue;
    }
    chosen.set(c.node.id, { c, detail: 'summary', tokens: summaryCost });
    used += summaryCost;
  }

  // ---- 5. compression -----------------------------------------------------
  // Spend the remainder upgrading detail, highest score first. Deterministic:
  // fixed order, fixed steps, no randomness and no partial text anywhere.
  for (const level of ['full'] as const) {
    for (const c of ordered) {
      const current = chosen.get(c.node.id);
      if (!current) continue;
      const at = DETAILS.indexOf(current.detail);
      const target = DETAILS.indexOf(level);
      if (target <= at) continue;
      const upgraded = cost(c.node, level);
      const delta = upgraded - current.tokens;
      if (delta <= 0 || used + delta > budget) continue;
      current.detail = level;
      current.tokens = upgraded;
      used += delta;
    }
  }
  const tCompress = Date.now();

  // ---- 6. render ----------------------------------------------------------
  const layers: ContextLayer[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  const blocks: string[] = [];
  const included: IncludedNode[] = [];

  for (const layer of layers) {
    const inLayer = [...chosen.values()]
      .filter((x) => x.c.layer === layer)
      .sort((a, b) => b.c.score - a.c.score || a.c.node.id.localeCompare(b.c.node.id));
    if (inLayer.length === 0) continue;
    blocks.push(`## ${layer}`);
    for (const x of inLayer) {
      blocks.push(render(x.c.node, x.detail));
      included.push({
        id: x.c.node.id, kind: x.c.node.kind as IncludedNode['kind'], layer,
        via: x.c.ref.via, depth: x.c.ref.depth, detail: x.detail,
        tokens: x.tokens, pinned: x.c.pinned,
      });
    }
  }

  // Anything retrieved and then dropped for budget is engineering knowledge the
  // agent will not see. Reporting it only in excluded[] and still returning
  // COMPLETE would be exactly the silent omission the contract forbids.
  for (const x of excluded) {
    missing.push({
      kind: x.kind === 'rule' || x.kind === 'adr' ? 'rule' : 'budget',
      message: `${x.kind} ${x.id} was retrieved but does not fit in budget ${budget} (needs ${x.tokens} tokens)`,
      searched: [x.id],
    });
  }

  const text = blocks.join('\n\n');
  const verdict: Verdict = missing.length === 0 ? 'COMPLETE' : 'MISSING_CONTEXT';
  const hash = createHash('sha256').update(text, 'utf8').digest('hex');
  const contextId = createHash('sha256')
    .update([input.sourceHash, task, String(budget), 'graph-retriever-1'].join('|'), 'utf8')
    .digest('hex').slice(0, 16);
  const t1 = Date.now();

  return {
    contextId, task, verdict, budget,
    used: estimateTokens(text),
    nodes: included.length,
    included, excluded, missing, text, hash,
    cacheHit: false,
    timings: {
      retrieveMs: tRetrieve - t0, selectMs: tSelect - tRetrieve,
      compressMs: tCompress - tSelect, renderMs: t1 - tCompress, totalMs: t1 - t0,
    },
  };
};
