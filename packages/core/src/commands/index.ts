import type { CheckReport, CompiledContext, CompileReport, Detail, EdgeKind, Entity, HealthReport, NodeId, Relation, Result } from '../api.ts';

/**
 * INTERNAL. Commands are the representation of a Workspace call, never a public
 * surface. CLI and any future adapter call Workspace, not this.
 */
export type Command =
  | { type: 'knowledge.get'; ids: NodeId[]; detail: Detail }
  | { type: 'knowledge.list'; kind: string }
  | { type: 'knowledge.search'; query: string; kinds?: string[]; limit: number }
  | { type: 'knowledge.related'; id: NodeId; edge?: EdgeKind }
  | { type: 'compile'; clean: boolean }
  | { type: 'check'; strict: boolean }
  | { type: 'context'; task: NodeId; budget: number; noCache: boolean }
  | { type: 'doctor' };

export type CommandResult = {
  'knowledge.get': Entity[];
  'knowledge.list': Entity[];
  'knowledge.search': Entity[];
  'knowledge.related': Relation[];
  compile: CompileReport;
  check: CheckReport;
  context: CompiledContext;
  doctor: HealthReport;
};

export type Handler<T extends Command['type']> = (
  cmd: Extract<Command, { type: T }>,
) => Result<CommandResult[T]>;
