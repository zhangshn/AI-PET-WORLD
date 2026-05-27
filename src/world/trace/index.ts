export type {
  TraceArea,
  TraceAnchor,
  TraceAudit,
  TraceEffects,
  TraceEvidenceLevel,
  TraceFact,
  TraceField,
  TraceFieldSummary,
  TraceLifecyclePhase,
  TraceScope,
  TraceScopeKind,
  TraceSourceKind,
  TraceSourceReliability,
  TraceStrengthLevel,
  TraceTargetKind,
  TraceTargetRef,
  TraceType,
  TraceVisualHints,
  TraceVisualKind,
} from "./trace-schema"
export type {
  TraceVisualIntensity,
  TraceVisualLayer,
  TraceVisualProjection,
  TraceVisualProjectionItem,
  TraceVisualProjectionSummary,
  TraceVisualSource,
} from "./trace-visual-projection"
export {
  buildTraceFieldFromWorld,
  type BuildTraceFieldFromWorldInput,
} from "./trace-field-builder"
export {
  normalizeTraceStrength,
  resolveTraceAge,
  resolveTraceLifecyclePhase,
  resolveTraceStrengthLevel,
} from "./trace-lifecycle"
export { summarizeTraceField } from "./trace-summary"
export {
  adaptTraceFieldToSceneTraceFacts,
  adaptTraceFieldToTraceVisualProjection,
} from "./trace-scene-adapter"
export {
  runTraceLifecycleTick,
  type TraceLifecycleTickResult,
} from "./trace-tick"
export {
  buildTraceMemorySeedFieldFromTraceField,
  type TraceMemorySeed,
  type TraceMemorySeedField,
  type TraceMemorySeedFieldSummary,
  type TraceMemorySeedKind,
} from "./trace-memory-seed"
export { buildTraceVisualProjectionFromTraceField } from "./trace-visual-projection"
