// The single public entry point. package.json "exports" resolves only this file.
export { Workspace } from './workspace.ts';
export type {
  NodeId, NodeKind, EdgeKind, Detail,
  ErrorCode, CoreError, Result,
  Entity, Relation, Problem, KnowledgeApi,
  CompileReport, CheckReport,
  HealthFinding, HealthReport, TraceInput, TraceStep,
  Verdict, ContextLayer, IncludedNode, ExcludedNode, MissingItem, CompiledContext,
} from './api.ts';
