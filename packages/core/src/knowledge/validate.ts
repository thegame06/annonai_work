import type { Problem } from '../api.ts';
import type { Edge, Node } from './graph.ts';

/**
 * Five invariants. Deliberately five: a validator that blocks builds for style
 * gets disabled, and then the real invariants stop being checked too.
 * Anything advisory is a warning.
 */
export const validate = (nodes: readonly Node[], edges: readonly Edge[]): Problem[] => {
  const problems: Problem[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 1. no dangling references
  for (const e of edges) {
    if (!byId.has(e.dst))
      problems.push({ severity: 'error', rule: 'dangling-reference', id: e.src, message: `references unknown ${e.dst}` });
  }

  // 2. every requirement refines exactly one existing feature
  for (const n of nodes) {
    if (n.kind !== 'requirement') continue;
    const parents = edges.filter((e) => e.src === n.id && e.kind === 'refines');
    const feature = parents.find((p) => byId.get(p.dst)?.kind === 'feature');
    if (!feature)
      problems.push({ severity: 'error', rule: 'orphan-requirement', id: n.id, message: 'has no parent feature' });
  }

  // 3. every task implements at least one requirement
  for (const n of nodes) {
    if (n.kind !== 'task') continue;
    const impl = edges.some((e) => e.src === n.id && e.kind === 'implements');
    if (!impl)
      problems.push({ severity: 'error', rule: 'unlinked-task', id: n.id, message: 'implements nothing' });
  }

  // 4. no cycles in refines / supersedes
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (e.kind !== 'refines' && e.kind !== 'supersedes') continue;
    adj.set(e.src, [...(adj.get(e.src) ?? []), e.dst]);
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): string | null => {
    const s = state.get(id) ?? 0;
    if (s === 1) return id;
    if (s === 2) return null;
    state.set(id, 1);
    for (const next of adj.get(id) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    state.set(id, 2);
    return null;
  };
  for (const id of [...adj.keys()].sort()) {
    const cycle = visit(id);
    if (cycle) {
      problems.push({ severity: 'error', rule: 'cycle', id: cycle, message: 'cycle in refines/supersedes' });
      break;
    }
  }

  // 5. two accepted ADRs on the same subject need an explicit supersedes
  const accepted = nodes.filter((n) => n.kind === 'adr' && n.status === 'accepted' && n.subject);
  const bySubject = new Map<string, Node[]>();
  for (const a of accepted) bySubject.set(a.subject!, [...(bySubject.get(a.subject!) ?? []), a]);
  for (const [subject, group] of [...bySubject.entries()].sort()) {
    if (group.length < 2) continue;
    const linked = group.some((a) => edges.some((e) => e.src === a.id && e.kind === 'supersedes'));
    if (!linked)
      problems.push({
        severity: 'error', rule: 'conflicting-decision', id: group[0]!.id,
        message: `${group.length} accepted decisions on "${subject}" without supersedes`,
      });
  }

  // advisory only
  for (const n of nodes) {
    if (n.kind !== 'requirement') continue;
    if (!edges.some((e) => e.dst === n.id && e.kind === 'verifies'))
      problems.push({ severity: 'warning', rule: 'untested-requirement', id: n.id, message: 'no test verifies this' });
  }

  return problems;
};
