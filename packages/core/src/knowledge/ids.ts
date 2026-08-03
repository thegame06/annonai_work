import type { NodeId, NodeKind } from '../api.ts';

/** Frozen: PREFIX-<digits>, any length. Padding is formatting, not format. */
const PATTERN = /^([A-Z]+)-(\d+)$/;

export const PREFIX: Record<NodeKind, string> = {
  feature: 'FEAT', requirement: 'REQ', task: 'TASK', adr: 'ADR',
  component: 'CMP', rule: 'RULE', test: 'TEST', term: 'TERM',
};

export const parseId = (id: string): { prefix: string; num: number } | null => {
  const m = PATTERN.exec(id);
  return m && m[1] && m[2] ? { prefix: m[1], num: Number(m[2]) } : null;
};

export const isId = (id: string): boolean => PATTERN.test(id);

/** Numeric, never lexicographic: FEAT-9 sorts before FEAT-10. */
export const compareIds = (a: NodeId, b: NodeId): number => {
  const pa = parseId(a);
  const pb = parseId(b);
  if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0;
  return pa.prefix === pb.prefix ? pa.num - pb.num : pa.prefix < pb.prefix ? -1 : 1;
};

export const nextId = (kind: NodeKind, existing: readonly string[]): NodeId => {
  const p = PREFIX[kind];
  const max = existing.reduce((acc, id) => {
    const parsed = parseId(id);
    return parsed && parsed.prefix === p ? Math.max(acc, parsed.num) : acc;
  }, 0);
  return `${p}-${String(max + 1).padStart(4, '0')}`;
};
