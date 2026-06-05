import type {
  SpaceRegionKind,
} from "@/world/space"
import type {
  TraceFact,
  TraceField,
  TraceLifecyclePhase,
  TraceTargetRef,
  TraceType,
} from "./trace-schema"
import { clamp } from "@/shared/math/clamp"

const MAX_MEMORY_SEEDS_PER_FIELD = 3
const FULL_SEED_STRENGTH_THRESHOLD = 55
const FULL_SEED_CONFIDENCE_THRESHOLD = 45
const EARLY_HINT_STRENGTH_THRESHOLD = 30
const EARLY_HINT_CONFIDENCE_THRESHOLD = 35
const EARLY_HINT_MIN_AGE = 2

export type TraceMemorySeedKind =
  | "world_memory_seed"
  | "butler_memory_hint"
  | "region_memory_hint"
  | "ecology_memory_hint"
  | "relationship_memory_hint"

export type TraceMemorySeed = {
  id: string
  kind: TraceMemorySeedKind
  traceId: string
  worldId: string
  target: TraceTargetRef
  sourceTraceType: TraceType
  sourceLifecyclePhase: TraceLifecyclePhase
  strength: number
  memoryWeight: number
  stability: number
  regionKinds: SpaceRegionKind[]
  relatedCellIds: string[]
  relatedPlacementIds: string[]
  suggestedMemoryTags: string[]
  summary: string
  createdAtTick: number
  updatedAtTick: number
  audit: {
    sourceReliability: string
    evidenceLevel: string
    reason: string
    warnings: string[]
    tags: string[]
  }
  tags: string[]
}

export type TraceMemorySeedFieldSummary = {
  totalSeeds: number
  worldMemorySeeds: number
  butlerMemoryHints: number
  regionMemoryHints: number
  ecologyMemoryHints: number
  relationshipMemoryHints: number
  averageMemoryWeight: number
  averageStability: number
  skippedTraceCount: number
  skipReasons: string[]
}

export type TraceMemorySeedField = {
  id: string
  worldId: string
  seeds: TraceMemorySeed[]
  summary: TraceMemorySeedFieldSummary
  warnings: string[]
  tags: string[]
}

export function buildTraceMemorySeedFieldFromTraceField(input: {
  traceField?: TraceField
  currentTick: number
}): TraceMemorySeedField {
  const traceField = input.traceField

  if (!traceField) {
    return emptySeedField({
      worldId: "unknown",
      reason: "TraceField is missing.",
    })
  }

  const seedCandidates = traceField.traces.map((trace) =>
    buildSeedCandidate({ trace, worldId: traceField.worldId })
  )
  const acceptedSeeds = seedCandidates.filter(
    (candidate): candidate is TraceMemorySeed => Boolean(candidate)
  )
  const seeds = acceptedSeeds
    .slice(0, MAX_MEMORY_SEEDS_PER_FIELD)
    .map((seed) => ({
      ...seed,
      updatedAtTick: input.currentTick,
    }))
  const skipReasons = [
    ...traceField.traces
      .filter((trace) => !buildSeedCandidate({ trace, worldId: traceField.worldId }))
      .map((trace) => `trace:${trace.id}:quality_below_seed_threshold`),
    ...acceptedSeeds
      .slice(MAX_MEMORY_SEEDS_PER_FIELD)
      .map((seed) => `trace:${seed.traceId}:seed_cap_deferred`),
  ]

  return {
    id: `trace_memory_seed_field_${traceField.worldId}`,
    worldId: traceField.worldId,
    seeds,
    summary: summarizeSeeds({
      seeds,
      skippedTraceCount: traceField.traces.length - seeds.length,
      skipReasons,
    }),
    warnings:
      seeds.length === 0
        ? ["No TraceFact met memory seed quality thresholds."]
        : [],
    tags: [
      "trace_memory_seed_field",
      "derived_from_persisted_trace_field",
      "threshold_tuned_low_volume_seed_hint",
      "not_persisted_memory_system",
    ],
  }
}

function buildSeedCandidate(input: {
  trace: TraceFact
  worldId: string
}): TraceMemorySeed | null {
  const quality = evaluateTraceSeedQuality(input.trace)
  if (!quality.accepted) return null

  const memoryWeight = calculateMemoryWeight(input.trace)

  return {
    id: `trace_memory_seed_${input.trace.id}`,
    kind: resolveSeedKind(input.trace),
    traceId: input.trace.id,
    worldId: input.worldId,
    target: input.trace.target,
    sourceTraceType: input.trace.type,
    sourceLifecyclePhase: input.trace.lifecyclePhase,
    strength: input.trace.strength,
    memoryWeight,
    stability: calculateStability(input.trace),
    regionKinds: input.trace.regionKinds,
    relatedCellIds: input.trace.relatedCellIds,
    relatedPlacementIds: input.trace.relatedPlacementIds,
    suggestedMemoryTags: uniqueStrings([
      `trace_type:${input.trace.type}`,
      `lifecycle:${input.trace.lifecyclePhase}`,
      `target:${input.trace.target.kind}`,
      quality.reason,
      ...input.trace.regionKinds.map((regionKind) => `region:${regionKind}`),
    ]),
    summary: `Memory seed candidate from ${input.trace.type} trace.`,
    createdAtTick: input.trace.createdAtTick,
    updatedAtTick: input.trace.updatedAtTick,
    audit: {
      sourceReliability: input.trace.sourceReliability,
      evidenceLevel: input.trace.evidenceLevel,
      reason: quality.reason,
      warnings: [
        input.trace.sourceReliability === "fallback"
          ? "Fallback source kept at reduced memory weight."
          : "",
        quality.reason === "trace_meets_early_memory_hint_threshold"
          ? "Early hint only; not promoted to persisted memory."
          : "",
      ].filter(Boolean),
      tags: ["trace_memory_seed_audit", "seed_not_persisted_memory", quality.reason],
    },
    tags: [
      "trace_memory_seed",
      quality.reason,
      "not_butler_memory",
      "butler_memory_only",
      "not_world_learning",
    ],
  }
}

function evaluateTraceSeedQuality(trace: TraceFact): {
  accepted: boolean
  reason: string
} {
  const stablePhases: TraceLifecyclePhase[] = [
    "accumulating",
    "strengthened",
    "repaired",
    "transformed",
    "deposited",
  ]

  if (!stablePhases.includes(trace.lifecyclePhase)) {
    return { accepted: false, reason: "lifecycle_not_stable_enough" }
  }

  if (trace.relatedCellIds.length === 0) {
    return { accepted: false, reason: "no_related_cells" }
  }

  if (trace.strength >= FULL_SEED_STRENGTH_THRESHOLD) {
    if (trace.confidence < FULL_SEED_CONFIDENCE_THRESHOLD) {
      return { accepted: false, reason: "confidence_below_full_seed_threshold" }
    }

    if (trace.evidenceLevel === "low" && trace.age < 3) {
      return { accepted: false, reason: "low_evidence_not_stable_yet" }
    }

    return { accepted: true, reason: "trace_meets_memory_seed_threshold" }
  }

  if (trace.strength < EARLY_HINT_STRENGTH_THRESHOLD) {
    return { accepted: false, reason: "strength_below_early_hint_threshold" }
  }

  if (trace.confidence < EARLY_HINT_CONFIDENCE_THRESHOLD) {
    return { accepted: false, reason: "confidence_below_early_hint_threshold" }
  }

  if (trace.age < EARLY_HINT_MIN_AGE) {
    return { accepted: false, reason: "trace_too_young_for_early_hint" }
  }

  if (trace.sourceReliability === "fallback") {
    return { accepted: false, reason: "fallback_trace_not_promoted_to_early_hint" }
  }

  return { accepted: true, reason: "trace_meets_early_memory_hint_threshold" }
}

function calculateMemoryWeight(trace: TraceFact): number {
  const lifecycleBonus =
    trace.lifecyclePhase === "strengthened"
      ? 12
      : trace.lifecyclePhase === "deposited"
        ? 10
        : trace.lifecyclePhase === "repaired"
          ? 8
          : 4
  const reliabilityPenalty = trace.sourceReliability === "fallback" ? 18 : 0
  const earlyHintPenalty = trace.strength < FULL_SEED_STRENGTH_THRESHOLD ? 8 : 0
  const ageBonus = clamp(Math.round(trace.age * 0.25), 0, 12)

  return clamp(
    Math.round(
      trace.strength * 0.46 +
        trace.confidence * 0.28 +
        trace.effects.memoryWeightDelta +
        lifecycleBonus +
        ageBonus -
        reliabilityPenalty -
        earlyHintPenalty
    ),
    0,
    100
  )
}

function calculateStability(trace: TraceFact): number {
  const reinforcementAge =
    trace.lastReinforcedTick === undefined
      ? 0
      : Math.max(0, trace.updatedAtTick - trace.createdAtTick)

  return clamp(
    Math.round(trace.confidence * 0.42 + trace.strength * 0.34 + reinforcementAge),
    0,
    100
  )
}

function resolveSeedKind(trace: TraceFact): TraceMemorySeedKind {
  if (trace.type === "ecology_change") return "ecology_memory_hint"
  if (trace.type === "relationship_interaction") return "relationship_memory_hint"
  if (trace.type === "construction_maintenance") return "butler_memory_hint"
  if (trace.target.kind === "region") return "region_memory_hint"

  return "world_memory_seed"
}

function summarizeSeeds(input: {
  seeds: TraceMemorySeed[]
  skippedTraceCount: number
  skipReasons: string[]
}): TraceMemorySeedFieldSummary {
  return {
    totalSeeds: input.seeds.length,
    worldMemorySeeds: countKind(input.seeds, "world_memory_seed"),
    butlerMemoryHints: countKind(input.seeds, "butler_memory_hint"),
    regionMemoryHints: countKind(input.seeds, "region_memory_hint"),
    ecologyMemoryHints: countKind(input.seeds, "ecology_memory_hint"),
    relationshipMemoryHints: countKind(input.seeds, "relationship_memory_hint"),
    averageMemoryWeight: roundMetric(
      average(input.seeds.map((seed) => seed.memoryWeight))
    ),
    averageStability: roundMetric(
      average(input.seeds.map((seed) => seed.stability))
    ),
    skippedTraceCount: input.skippedTraceCount,
    skipReasons: uniqueStrings(input.skipReasons).slice(0, 12),
  }
}

function emptySeedField(input: {
  worldId: string
  reason: string
}): TraceMemorySeedField {
  return {
    id: `trace_memory_seed_field_${input.worldId}`,
    worldId: input.worldId,
    seeds: [],
    summary: summarizeSeeds({
      seeds: [],
      skippedTraceCount: 0,
      skipReasons: [input.reason],
    }),
    warnings: [input.reason],
    tags: ["trace_memory_seed_field", "empty", "not_persisted_memory_system"],
  }
}

function countKind(
  seeds: TraceMemorySeed[],
  kind: TraceMemorySeedKind
): number {
  return seeds.filter((seed) => seed.kind === kind).length
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((total, value) => value + total, 0) / values.length
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2))
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}
