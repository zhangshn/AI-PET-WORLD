import type {
  TraceArea,
  TraceFact,
  TraceField,
  TraceLifecyclePhase,
  TraceTargetRef,
  TraceType,
  TraceVisualHints,
  TraceVisualKind,
} from "./trace-schema"

export type TraceVisualLayer = TraceVisualHints["layerHint"]

export type TraceVisualIntensity = number

export type TraceVisualSource =
  | "trace_field"
  | "trace_visual_hints"
  | "trace_influence_summary"
  | "space_grid_trace_influence"

export type TraceVisualProjectionItem = {
  id: string
  traceId: string
  traceType: TraceType
  lifecyclePhase: TraceLifecyclePhase
  visualKind: TraceVisualKind
  intensity: TraceVisualIntensity
  opacityHint: number
  layerHint: TraceVisualLayer
  textureHint?: string
  colorMoodHint?: string
  animationHint?: TraceVisualHints["animationHint"]
  displayPriority: number
  target: TraceTargetRef
  area: TraceArea
  cellIds: string[]
  regionKinds: string[]
  sourceReliability: string
  evidenceLevel: string
  productSafeDescription: string
  visible: boolean
  source: TraceVisualSource
  tags: string[]
}

export type TraceVisualProjectionSummary = {
  totalItems: number
  visibleItems: number
  highPriorityItems: number
  byVisualKind: Partial<Record<TraceVisualKind, number>>
  byTraceType: Partial<Record<TraceType, number>>
  averageIntensity: number
  warnings: string[]
}

export type TraceVisualProjection = {
  id: string
  worldId: string
  items: TraceVisualProjectionItem[]
  summary: TraceVisualProjectionSummary
  warnings: string[]
  tags: string[]
}

export function buildTraceVisualProjectionFromTraceField(input: {
  traceField?: TraceField
  includeHidden?: boolean
}): TraceVisualProjection {
  if (!input.traceField) {
    return {
      id: "trace_visual_projection_empty",
      worldId: "unknown",
      items: [],
      summary: summarizeProjectionItems([]),
      warnings: ["TraceField is missing; projection is empty."],
      tags: [
        "trace_visual_projection",
        "read_only_projection",
        "empty_trace_field",
      ],
    }
  }

  const items = input.traceField.traces
    .map((trace) => buildProjectionItem(trace))
    .filter((item) => input.includeHidden || item.visible)
    .sort(compareProjectionItems)
  const summary = summarizeProjectionItems(items)

  return {
    id: `trace_visual_projection_${input.traceField.worldId}`,
    worldId: input.traceField.worldId,
    items,
    summary,
    warnings: summary.warnings,
    tags: [
      "trace_visual_projection",
      "read_only_projection",
      "world_visual_projection_input",
      "no_world_fact_generation",
    ],
  }
}

function buildProjectionItem(trace: TraceFact): TraceVisualProjectionItem {
  const visible =
    trace.visualHints.visualKind !== "none" && trace.visualHints.intensity > 0
  const lifecycleOpacity = resolveLifecycleOpacityMultiplier(trace)
  const lifecyclePriority = resolveLifecyclePriorityDelta(trace)

  return {
    id: `trace_visual_projection_item_${trace.id}`,
    traceId: trace.id,
    traceType: trace.type,
    lifecyclePhase: trace.lifecyclePhase,
    visualKind: trace.visualHints.visualKind,
    intensity: Math.max(
      0,
      Math.min(100, Math.round((trace.visualHints.intensity + trace.strength) / 2))
    ),
    opacityHint: roundMetric(
      Math.max(0, Math.min(1, trace.visualHints.opacityHint * lifecycleOpacity))
    ),
    layerHint: trace.visualHints.layerHint,
    textureHint: trace.visualHints.textureHint,
    colorMoodHint: trace.visualHints.colorMoodHint,
    animationHint: trace.visualHints.animationHint,
    displayPriority: Math.max(
      0,
      trace.visualHints.displayPriority + lifecyclePriority
    ),
    target: trace.target,
    area: trace.area,
    cellIds: trace.scope.cellIds.length > 0
      ? trace.scope.cellIds
      : trace.relatedCellIds,
    regionKinds: trace.regionKinds,
    sourceReliability: trace.sourceReliability,
    evidenceLevel: trace.evidenceLevel,
    productSafeDescription: trace.visualHints.productSafeDescription,
    visible,
    source: "trace_visual_hints",
    tags: [
      "trace_visual_projection_item",
      `trace_type:${trace.type}`,
      `visual_kind:${trace.visualHints.visualKind}`,
      `lifecycle:${trace.lifecyclePhase}`,
      `evidence:${trace.evidenceLevel}`,
      `reliability:${trace.sourceReliability}`,
      visible ? "visible" : "hidden",
    ],
  }
}

function compareProjectionItems(
  left: TraceVisualProjectionItem,
  right: TraceVisualProjectionItem
): number {
  if (right.displayPriority !== left.displayPriority) {
    return right.displayPriority - left.displayPriority
  }

  if (right.intensity !== left.intensity) {
    return right.intensity - left.intensity
  }

  return left.id.localeCompare(right.id)
}

function summarizeProjectionItems(
  items: TraceVisualProjectionItem[]
): TraceVisualProjectionSummary {
  return {
    totalItems: items.length,
    visibleItems: items.filter((item) => item.visible).length,
    highPriorityItems: items.filter((item) => item.displayPriority >= 16).length,
    byVisualKind: countBy(items, (item) => item.visualKind),
    byTraceType: countBy(items, (item) => item.traceType),
    averageIntensity: roundMetric(average(items.map((item) => item.intensity))),
    warnings:
      items.length === 0
        ? ["Trace visual projection has no visible items."]
        : [],
  }
}

function resolveLifecycleOpacityMultiplier(trace: TraceFact): number {
  if (trace.lifecyclePhase === "strengthened") return 1
  if (trace.lifecyclePhase === "accumulating") return 0.92
  if (trace.lifecyclePhase === "repaired") return 0.78
  if (trace.lifecyclePhase === "transformed") return 0.72
  if (trace.lifecyclePhase === "covered") return 0.52
  if (trace.lifecyclePhase === "decaying") return 0.48
  if (trace.lifecyclePhase === "deposited") return 0.36

  return 0.82
}

function resolveLifecyclePriorityDelta(trace: TraceFact): number {
  if (trace.lifecyclePhase === "strengthened") return 4
  if (trace.lifecyclePhase === "accumulating") return 2
  if (trace.lifecyclePhase === "repaired") return 1
  if (trace.lifecyclePhase === "deposited") return -3
  if (trace.lifecyclePhase === "decaying") return -4
  if (trace.lifecyclePhase === "covered") return -5

  return 0
}

function countBy<T extends string>(
  items: TraceVisualProjectionItem[],
  keyForItem: (item: TraceVisualProjectionItem) => T
): Partial<Record<T, number>> {
  return items.reduce<Partial<Record<T, number>>>((result, item) => {
    const key = keyForItem(item)

    return {
      ...result,
      [key]: (result[key] ?? 0) + 1,
    }
  }, {})
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2))
}
