import type { SpaceCell, SpaceGrid, SpaceRegionKind } from "@/world/space"
import {
  normalizeTraceStrength,
  resolveTraceLifecyclePhase,
  resolveTraceStrengthLevel,
  summarizeTraceField,
  type TraceFact,
  type TraceField,
  type TraceType,
  type TraceVisualKind,
} from "@/world/trace"

import type { ButlerRuntimeDecision } from "./butler-runtime-motivation-schema"
import type {
  ButlerRuntimeIntent,
  ButlerWorldRuleValidation,
} from "./butler-runtime-intent"

export type ButlerRuntimeTraceClosureResult = {
  nextTraceField: TraceField
  createdTrace: TraceFact | null
  messages: string[]
  warnings: string[]
  tags: string[]
}

export function applyButlerRuntimeTraceClosure(input: {
  traceField: TraceField
  spaceGrid: SpaceGrid
  decision: ButlerRuntimeDecision
  intent: ButlerRuntimeIntent
  validation: ButlerWorldRuleValidation
  currentTick: number
}): ButlerRuntimeTraceClosureResult {
  if (!input.validation.ok || !input.validation.traceWriteAllowed) {
    return {
      nextTraceField: input.traceField,
      createdTrace: null,
      messages: ["Butler trace closure skipped because world rule validation blocked trace writing."],
      warnings: input.validation.blockingWarnings,
      tags: [
        "m7_butler_trace_closure",
        "butler_trace_closure_skipped",
        "world_rule_validation_blocked",
      ],
    }
  }

  const trace = buildButlerRuntimeTrace(input)
  const existingTraces = input.traceField.traces.filter(
    (existingTrace) => existingTrace.id !== trace.id
  )
  const traceFieldWithoutSummary = {
    ...input.traceField,
    traces: [...existingTraces, trace],
    projectedCellIds: uniqueStrings([
      ...input.traceField.projectedCellIds,
      ...trace.relatedCellIds,
    ]),
  }
  const nextTraceField = {
    ...traceFieldWithoutSummary,
    summary: summarizeTraceField(traceFieldWithoutSummary),
  }

  return {
    nextTraceField,
    createdTrace: trace,
    messages: [
      `Butler runtime trace created: ${trace.type}.`,
      `Butler intent ${input.intent.kind} was validated before trace closure.`,
    ],
    warnings: [],
    tags: [
      "m7_butler_trace_closure",
      "butler_trace_fact_created",
      "world_rule_validation_passed",
      `trace_type:${trace.type}`,
      `motivation:${input.decision.selectedMotivation}`,
    ],
  }
}

function buildButlerRuntimeTrace(input: {
  traceField: TraceField
  spaceGrid: SpaceGrid
  decision: ButlerRuntimeDecision
  intent: ButlerRuntimeIntent
  validation: ButlerWorldRuleValidation
  currentTick: number
}): TraceFact {
  const traceType = resolvePrimaryTraceType(input.intent)
  const cells = resolveIntentCells({
    spaceGrid: input.spaceGrid,
    regionKind: input.intent.target.regionKind,
  })
  const strength = resolveIntentTraceStrength({
    intent: input.intent,
    decision: input.decision,
    validation: input.validation,
  })
  const area = buildTraceArea(cells)
  const regionKind = input.intent.target.regionKind ?? cells[0]?.regionKind ?? "home"
  const lifecyclePhase = resolveTraceLifecyclePhase({
    strength,
    age: 0,
    sourceKind: "butler_behavior",
  })
  const visualKind = resolveVisualKind(traceType)
  const confidence = resolveTraceConfidence(input.validation)
  const generationReason = [
    "Butler runtime intent passed world rule validation.",
    input.intent.reason,
  ].join(" ")

  return {
    id: `trace_${input.traceField.worldId}_butler_${input.intent.kind}_${input.currentTick}`,
    type: traceType,
    sourceKind: "butler_behavior",
    lifecyclePhase,
    strength,
    strengthLevel: resolveTraceStrengthLevel(strength),
    age: 0,
    confidence,
    area,
    target: {
      kind: "region",
      id: `region:${regionKind}`,
      label: regionKind,
    },
    anchor: {
      primary: {
        kind: "region",
        id: `region:${regionKind}`,
        label: regionKind,
      },
      secondary: [],
      fallback: cells.length === 0,
      reason: generationReason,
    },
    scope: {
      kind: "region_level",
      targetKinds: ["region"],
      cellIds: cells.map((cell) => cell.id),
      placementIds: [],
      regionKinds: [regionKind],
      terrainKinds: uniqueStrings(cells.map((cell) => cell.terrainKind)),
    },
    relatedCellIds: cells.map((cell) => cell.id),
    relatedPlacementIds: [],
    regionKinds: [regionKind],
    terrainKinds: uniqueStrings(cells.map((cell) => cell.terrainKind)),
    effects: buildTraceEffects({ traceType, strength }),
    visualHints: {
      visualKind,
      intensity: strength,
      opacityHint: Number(Math.max(0.12, Math.min(0.48, strength / 220)).toFixed(2)),
      layerHint: visualKind === "attention_glow" ? "atmosphere" : "surface",
      textureHint: `butler_${input.intent.kind}`,
      colorMoodHint: input.intent.kind,
      animationHint: visualKind === "attention_glow" ? "pulse" : "none",
      displayPriority: 58,
      userFacingLabel: "管家行动痕迹",
      productSafeDescription: "管家经过世界规则验证后留下的行动痕迹。",
    },
    evidenceLevel: confidence >= 72 ? "high" : "medium",
    sourceReliability: "observed",
    derivedFrom: [
      input.intent.id,
      input.validation.id,
      `motivation:${input.decision.selectedMotivation}`,
    ],
    createdAtTick: input.currentTick,
    updatedAtTick: input.currentTick,
    lastReinforcedTick: input.currentTick,
    generationReason,
    warnings: input.validation.warnings,
    audit: {
      evidenceLevel: confidence >= 72 ? "high" : "medium",
      sourceReliability: "observed",
      derivedFrom: [input.intent.id, input.validation.id],
      generationReason,
      warnings: input.validation.warnings,
      tags: [
        "trace_audit",
        "butler_runtime_trace",
        "world_rule_validation_passed",
      ],
    },
    tags: uniqueStrings([
      "butler_runtime_trace",
      "m7_butler_trace_closure",
      "world_rule_validation_passed",
      "not_pet_trace",
      `intent_kind:${input.intent.kind}`,
      `motivation:${input.decision.selectedMotivation}`,
      `type:${traceType}`,
      `region:${regionKind}`,
    ]),
  }
}

function resolvePrimaryTraceType(intent: ButlerRuntimeIntent): TraceType {
  return intent.requestedTraceTypes[0] ?? "behavior_activity"
}

function resolveIntentCells(input: {
  spaceGrid: SpaceGrid
  regionKind?: SpaceRegionKind
}): SpaceCell[] {
  const regionCells = input.regionKind
    ? input.spaceGrid.cells.filter((cell) => cell.regionKind === input.regionKind)
    : []
  const selectedCells = regionCells.length > 0
    ? regionCells
    : input.spaceGrid.cells.filter((cell) => cell.passable)

  return selectedCells.slice(0, 160)
}

function resolveIntentTraceStrength(input: {
  intent: ButlerRuntimeIntent
  decision: ButlerRuntimeDecision
  validation: ButlerWorldRuleValidation
}): number {
  const base = input.intent.kind === "maintenance" ? 56 : input.intent.kind === "construction" ? 62 : 42
  const tracePressure = input.decision.traceContext.tracePressure
  const validationBonus = input.validation.ok ? 8 : -24
  const memoryBonus = Math.min(10, input.decision.traceContext.memorySeedConsumeScore)

  return normalizeTraceStrength(base + tracePressure * 0.18 + validationBonus + memoryBonus)
}

function resolveTraceConfidence(validation: ButlerWorldRuleValidation): number {
  return validation.ok ? 78 : 34
}

function resolveVisualKind(traceType: TraceType): TraceVisualKind {
  if (traceType === "construction_maintenance") return "maintained_area"
  if (traceType === "ecology_change") return "repaired_ground"
  if (traceType === "time_passage") return "faded_area"
  if (traceType === "spatial_use") return "waiting_spot"
  if (traceType === "emotion_attention") return "attention_glow"
  if (traceType === "movement") return "flattened_grass"

  return "comfort_spot"
}

function buildTraceArea(cells: SpaceCell[]) {
  if (cells.length === 0) {
    return {
      x: 0,
      y: 0,
      radius: 24,
    }
  }

  const minX = Math.min(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y))
  const maxX = Math.max(...cells.map((cell) => cell.x))
  const maxY = Math.max(...cells.map((cell) => cell.y))

  return {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2),
    radius: Math.max(16, Math.round(Math.hypot(maxX - minX, maxY - minY) / 2)),
    minX,
    minY,
    maxX,
    maxY,
  }
}

function buildTraceEffects(input: { traceType: TraceType; strength: number }) {
  const weight = Number((input.strength / 100).toFixed(2))

  if (input.traceType === "construction_maintenance") {
    return emptyEffects({
      maintenancePriorityDelta: 9 * weight,
      ecologyHealthDelta: 3 * weight,
      memoryWeightDelta: 7 * weight,
      visualIntensityDelta: 10 * weight,
    })
  }

  if (input.traceType === "ecology_change") {
    return emptyEffects({
      ecologyHealthDelta: 6 * weight,
      memoryWeightDelta: 5 * weight,
      visualIntensityDelta: 8 * weight,
    })
  }

  if (input.traceType === "time_passage") {
    return emptyEffects({
      familiarityDelta: 3 * weight,
      memoryWeightDelta: 3 * weight,
      visualIntensityDelta: 5 * weight,
    })
  }

  if (input.traceType === "emotion_attention") {
    return emptyEffects({
      safetyFeelingDelta: 4 * weight,
      behaviorProbabilityDelta: 4 * weight,
      memoryWeightDelta: 5 * weight,
      visualIntensityDelta: 7 * weight,
    })
  }

  return emptyEffects({
    familiarityDelta: 5 * weight,
    behaviorProbabilityDelta: 3 * weight,
    memoryWeightDelta: 4 * weight,
    visualIntensityDelta: 6 * weight,
  })
}

function emptyEffects(overrides: Partial<TraceFact["effects"]> = {}): TraceFact["effects"] {
  return {
    movementCostDelta: 0,
    familiarityDelta: 0,
    ecologyHealthDelta: 0,
    safetyFeelingDelta: 0,
    maintenancePriorityDelta: 0,
    behaviorProbabilityDelta: 0,
    memoryWeightDelta: 0,
    visualIntensityDelta: 0,
    relationshipWeightDelta: 0,
    ...overrides,
  }
}

function uniqueStrings<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values))
}
