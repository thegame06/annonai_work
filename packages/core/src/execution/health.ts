import type { HealthFinding, HealthReport, NodeId } from '../api.ts';
import type { KnowledgeStore, StoredEdge, StoredNode } from '../store/store.ts';

const KINDS = ['feature', 'requirement', 'task', 'adr', 'component', 'rule', 'test', 'term'] as const;

/**
 * Health is advisory. check enforces the five invariants and blocks the build;
 * doctor reports decay and blocks nothing (ADR-0004). Strictly read-only.
 */
export const health = (store: KnowledgeStore): HealthReport => {
  const nodes: StoredNode[] = KINDS.flatMap((k) => store.list(k));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: StoredEdge[] = nodes.flatMap((n) => store.neighbors(n.id));
  const seen = new Set<string>();
  const allEdges = edges.filter((e) => {
    const key = `${e.src}|${e.dst}|${e.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const out = new Map<NodeId, StoredEdge[]>();
  const inc = new Map<NodeId, StoredEdge[]>();
  for (const e of allEdges) {
    out.set(e.src, [...(out.get(e.src) ?? []), e]);
    inc.set(e.dst, [...(inc.get(e.dst) ?? []), e]);
  }

  const findings: HealthFinding[] = [];
  const add = (check: HealthFinding['check'], n: StoredNode, message: string): void => {
    findings.push({ check, id: n.id, kind: n.kind as HealthFinding['kind'], message });
  };

  for (const n of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const outgoing = out.get(n.id) ?? [];
    const incoming = inc.get(n.id) ?? [];

    for (const e of outgoing)
      if (!byId.has(e.dst)) add('broken-reference', n, `references ${e.dst}, which does not exist`);

    if (outgoing.length === 0 && incoming.length === 0 && n.kind !== 'term')
      add('orphan', n, 'connected to nothing: no relationship declares why it exists');

    if (n.kind === 'rule' && outgoing.filter((e) => e.kind === 'constrains').length === 0)
      add('unused-rule', n, 'constrains nothing: dead knowledge that still costs maintenance');

    if (n.kind === 'adr' && outgoing.filter((e) => e.kind === 'decides').length === 0)
      add('unused-decision', n, 'decides nothing: no requirement or component is governed by it');

    if (n.kind === 'requirement' && incoming.filter((e) => e.kind === 'verifies').length === 0)
      add('missing-relationship', n, 'no test verifies this requirement');

    if (n.kind === 'requirement' && incoming.filter((e) => e.kind === 'implements').length === 0)
      add('missing-relationship', n, 'no task implements this requirement');

    if (n.kind === 'component' && incoming.filter((e) => e.kind === 'touches').length === 0)
      add('missing-relationship', n, 'no task touches this component');

    if (n.kind === 'feature' && incoming.filter((e) => e.kind === 'refines').length === 0)
      add('missing-relationship', n, 'no requirement refines this feature');

    if (n.status === 'proposed' || n.source.startsWith('agent:'))
      add('unreviewed', n, `authored by ${n.source} with status ${n.status}: awaiting human acceptance`);
  }

  // --- drift: knowledge that contradicts the state it describes (REQ-0013) ---
  const passing = new Set(
    nodes.filter((n) => n.kind === 'test' && n.status === 'passing')
      .flatMap((t) => (out.get(t.id) ?? []).filter((e) => e.kind === 'verifies').map((e) => e.dst)),
  );

  for (const n of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    if (n.kind === 'task' && n.status !== 'done') {
      const implemented = (out.get(n.id) ?? []).filter((e) => e.kind === 'implements').map((e) => e.dst);
      if (implemented.length > 0 && implemented.every((r) => passing.has(r)))
        add('stale-status', n, `still ${n.status}, but every requirement it implements is verified by a passing test`);
    }
    if (n.kind === 'task' && n.status === 'done' && (out.get(n.id) ?? []).filter((e) => e.kind === 'touches').length === 0)
      add('missing-touches', n, 'done but declares no touched component: the code it changed is unrecorded');
    if (n.kind === 'term') {
      const mention = nodes.some((o) => o.id !== n.id &&
        [o.title, o.summary ?? '', o.body ?? ''].join(' ').toLowerCase().includes(n.title.toLowerCase()));
      if (!mention) add('dead-term', n, 'defined in the glossary but named nowhere else in the knowledge');
    }
  }

  const byCheck: Record<string, number> = {};
  for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
  return { entities: nodes.length, findings, byCheck };
};
