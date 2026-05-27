/**
 * Scores the butler's next live-runtime motivation before a world tick.
 */

import type { TraceMemorySeed } from "@/world/trace"

import type { WorldRuntimeSaveRecord } from "./world-runtime-schema"
import type {
  ButlerRuntimeDecision,
  ButlerRuntimeMotivationScore,
  ButlerRuntimeMotivationType,
  ButlerTraceMotivationContext,
} from "./butler-runtime-motivation-schema"

const MOTIVATION_PRIORITY: Record<ButlerRuntimeMotivationType, number> = {
  wait_for_resources: 4,
  observe_world: 3,
  maintain_home: 2,
  continue_construction: 1,
}

export function selectButlerRuntimeMotivation(input: {
  saveRecord: WorldRuntimeSaveRecord
  nextTick: number
  now: number
}): ButlerRuntimeDecision {
  const traceContext = buildTraceContext(input.saveRecord)
  const scores = buildMotivationScores({
    ...input,
    traceContext,
  })
  const selected = [...scores].sort(sortScores)[0]
  const selectedMotivation = selected.type

  return {
    tick: input.nextTick,
    selectedMotivation,
    shouldRunConstructionTick:
      selectedMotivation === "continue_construction" ||
      selectedMotivation === "maintain_home",
    tickReason: selectedMotivation,
    scores,
    traceContext,
    reasons: selected.reasons,
    createdAt: new Date(input.now).toISOString(),
    tags: [
      "butler_runtime_decision",
      `motivation:${selectedMotivation}`,
      ...traceContext.tags,
      selectedMotivation === "continue_construction" ||
      selectedMotivation === "maintain_home"
        ? "construction_tick_allowed"
        : "construction_tick_skipped",
    ],
  }
}

function buildMotivationScores(input: {
  saveRecord: WorldRuntimeSaveRecord
  nextTick: number
  now: number
  traceContext: ButlerTraceMotivationContext
}): ButlerRuntimeMotivationScore[] {
  const resources = input.saveRecord.homeMapState.resources
  const recentTransactions = resources.recentTransactions ?? []
  const recentActionSignatures = input.saveRecord.recentActionSignatures ?? []
  const repeatedActionRisk = hasRepeatedRecentSignature(recentActionSignatures)
  const hasConstructionPlans = input.saveRecord.homeMapState.constructionPlans.some(
    (plan) => plan.status !== "completed"
  )
  const hasPlacements = input.saveRecord.homeMapState.placements.length > 0
  const lastAction = input.saveRecord.lastRuntimeAction
  const lowMaterial = resources.materialReadiness < 10
  const lowCare = resources.careReadiness < 18
  const lowGround = resources.groundHealth < 35
  const denseTransactions = recentTransactions.length >= 12
  const recentHeavyCost = recentTransactions
    .slice(-3)
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0)
  const traceContext = input.traceContext
  const resourcePressure =
    (lowMaterial ? 24 : 0) +
    (lowCare ? 18 : 0) +
    (lowGround ? 14 : 0) +
    (denseTransactions ? 10 : 0) +
    (recentHeavyCost >= 18 ? 10 : 0)

  return [
    buildScore({
      type: "continue_construction",
      baseScore: 36,
      resourceScore: resourcePressure > 24 ? -18 : 8,
      continuityScore:
        lastAction && lastAction.acceptedDiffCount > 0 && !repeatedActionRisk
          ? 26
          : hasConstructionPlans
            ? 12
            : 0,
      traceContextScore:
        resourcePressure > 24
          ? 0
          : Math.min(5, traceContext.butlerMemoryHintCount + traceContext.butlerMemoryWeight),
      riskPenalty: repeatedActionRisk ? 28 : 0,
      reasons: [
        hasConstructionPlans
          ? "There is an active construction chain to consider."
          : "No active construction chain is visible.",
        lastAction && lastAction.acceptedDiffCount > 0
          ? "The previous runtime action changed the world through SafeApply."
          : "The previous runtime action did not write a world change.",
        traceContext.butlerMemoryHintCount > 0
          ? "Trace memory seeds are consumed as construction continuity hints only."
          : "Trace memory seeds do not require construction continuity.",
      ],
      tags: [
        "butler_motivation_score",
        "continue_construction",
        ...traceContext.tags,
      ],
    }),
    buildScore({
      type: "maintain_home",
      baseScore: 30,
      resourceScore: lowCare || lowGround ? 10 : 4,
      continuityScore: hasPlacements ? 18 : 0,
      traceContextScore: Math.min(
        14,
        traceContext.maintenanceHintScore +
          traceContext.ecologyMemoryHintCount * 2 +
          traceContext.ecologyMemoryWeight
      ),
      riskPenalty: repeatedActionRisk ? 8 : 0,
      reasons: [
        hasPlacements
          ? "Existing home placements can be stabilized or maintained."
          : "There are not enough placements to maintain yet.",
        lowCare || lowGround
          ? "Care or ground condition suggests a lower-risk maintenance posture."
          : "Home condition is stable enough for light maintenance.",
        traceContext.highMaintenanceTraceCount > 0
          ? "Trace influence provides maintenance hints without creating a world fact."
          : "No persisted trace maintenance hint is available.",
        traceContext.ecologyMemoryHintCount > 0
          ? "Trace memory seeds are consumed as ecological maintenance hints only."
          : "Trace memory seeds do not add ecological maintenance pressure.",
      ],
      tags: ["butler_motivation_score", "maintain_home", ...traceContext.tags],
    }),
    buildScore({
      type: "wait_for_resources",
      baseScore: 24,
      resourceScore: resourcePressure,
      continuityScore: denseTransactions ? 12 : 0,
      traceContextScore:
        traceContext.tracePressure > 60 ||
        traceContext.highTraceMovementCostRegions.length > 0
          ? 5
          : 0,
      riskPenalty: 0,
      reasons: [
        resourcePressure > 0
          ? "Resources or transaction pressure suggest waiting."
          : "Resources do not require waiting.",
        denseTransactions
          ? "Recent transactions are dense enough to avoid forcing another change."
          : "Recent transaction density is acceptable.",
        traceContext.tracePressure > 60
          ? "Trace influence pressure suggests avoiding forced changes."
          : "Trace influence pressure does not require waiting.",
        traceContext.highTraceMovementCostRegions.length > 0
          ? "High trace movement cost regions support a cautious wait posture."
          : "Trace movement costs do not add waiting pressure.",
      ],
      tags: ["butler_motivation_score", "wait_for_resources", ...traceContext.tags],
    }),
    buildScore({
      type: "observe_world",
      baseScore: 22,
      resourceScore: resourcePressure > 30 ? 8 : 0,
      continuityScore: repeatedActionRisk ? 30 : 6,
      traceContextScore: Math.min(
        10,
        traceContext.observationHintScore + traceContext.regionMemoryWeight
      ),
      riskPenalty: 0,
      reasons: [
        repeatedActionRisk
          ? "Recent action signatures repeat, so observation is safer."
          : "Observation remains available as the stable fallback.",
        "Observation does not force a new HomeMapState fact.",
        traceContext.familiarRegionCount > 0
          ? "Trace influence offers familiar regions for observation context only."
          : "No familiar trace region is available for observation context.",
        traceContext.memorySeedCount > 0
          ? "Trace memory seeds are consumed as observation bias, not formal memory."
          : "No trace memory seed is available for observation context.",
      ],
      tags: ["butler_motivation_score", "observe_world", ...traceContext.tags],
    }),
  ]
}

function buildScore(input: Omit<ButlerRuntimeMotivationScore, "finalScore">) {
  return {
    ...input,
    finalScore:
      input.baseScore +
      input.resourceScore +
      input.continuityScore +
      input.traceContextScore -
      input.riskPenalty,
  }
}

function buildTraceContext(
  saveRecord: WorldRuntimeSaveRecord
): ButlerTraceMotivationContext {
  const influenceSummary = saveRecord.traceInfluenceSummary
  const seedField = saveRecord.traceMemorySeedField
  const seedSummary = seedField?.summary
  const seeds = seedField?.seeds ?? []
  const tracePressure = Math.round(
    influenceSummary?.averageTraceInfluenceStrength ?? 0
  )
  const familiarRegionCount = influenceSummary?.familiarRegionCount ?? 0
  const highMaintenanceTraceCount =
    influenceSummary?.highMaintenanceTraceCount ?? 0
  const memorySeedCount = seedSummary?.totalSeeds ?? seeds.length
  const butlerMemoryHintCount = seedSummary?.butlerMemoryHints ?? countSeedKind(seeds, "butler_memory_hint")
  const ecologyMemoryHintCount = seedSummary?.ecologyMemoryHints ?? countSeedKind(seeds, "ecology_memory_hint")
  const relationshipMemoryHintCount = seedSummary?.relationshipMemoryHints ?? countSeedKind(seeds, "relationship_memory_hint")
  const memorySeedWeight = normalizeSeedWeight(seeds)
  const butlerMemoryWeight = normalizeSeedWeight(
    seeds.filter((seed) => seed.kind === "butler_memory_hint")
  )
  const ecologyMemoryWeight = normalizeSeedWeight(
    seeds.filter((seed) => seed.kind === "ecology_memory_hint")
  )
  const regionMemoryWeight = normalizeSeedWeight(
    seeds.filter(
      (seed) => seed.kind === "region_memory_hint" || seed.regionKinds.length > 0
    )
  )
  const relationshipMemoryWeight = normalizeSeedWeight(
    seeds.filter((seed) => seed.kind === "relationship_memory_hint")
  )
  const memorySeedConsumeScore = clampScore(
    Math.round(memorySeedWeight / 2) + Math.min(4, memorySeedCount)
  )
  const traceAttentionScore = clampScore(
    Math.round(tracePressure / 20) + memorySeedCount + memorySeedConsumeScore
  )
  const maintenanceHintScore = clampScore(
    Math.min(8, highMaintenanceTraceCount * 2) +
      Math.min(4, ecologyMemoryHintCount * 2) +
      Math.min(3, butlerMemoryHintCount) +
      ecologyMemoryWeight
  )
  const observationHintScore = clampScore(
    Math.min(6, familiarRegionCount * 2) +
      Math.min(3, relationshipMemoryHintCount) +
      Math.min(4, regionMemoryWeight)
  )
  const warnings = [
    influenceSummary ? "" : "Trace influence summary is not persisted yet.",
    seedField ? "" : "Trace memory seed field is not persisted yet.",
  ].filter(Boolean)

  return {
    tracePressure,
    familiarRegionCount,
    highMaintenanceTraceCount,
    preferredObservationRegions:
      influenceSummary?.preferredObservationRegions ?? [],
    highTraceMovementCostRegions:
      influenceSummary?.highTraceMovementCostRegions ?? [],
    memorySeedCount,
    butlerMemoryHintCount,
    ecologyMemoryHintCount,
    relationshipMemoryHintCount,
    memorySeedWeight,
    butlerMemoryWeight,
    ecologyMemoryWeight,
    regionMemoryWeight,
    relationshipMemoryWeight,
    memorySeedConsumeScore,
    memorySeedFocusKinds: resolveMemorySeedFocusKinds(seeds),
    memorySeedFocusRegions: resolveMemorySeedFocusRegions(seeds),
    traceAttentionScore,
    maintenanceHintScore,
    observationHintScore,
    warnings,
    tags: [
      "trace_context_read",
      "trace_influence_scoring_hint",
      "trace_memory_seed_hint",
      "trace_memory_seed_consumed_as_bias",
      "trace_seed_not_formal_memory",
      "trace_not_direct_action",
      "safe_apply_still_required",
      `trace_pressure:${tracePressure}`,
      `familiar_regions:${familiarRegionCount}`,
      `maintenance_trace_hints:${highMaintenanceTraceCount}`,
      `memory_seeds:${memorySeedCount}`,
      `memory_seed_weight:${memorySeedWeight}`,
      warnings.length > 0 ? "trace_context_incomplete" : "trace_context_complete",
    ],
  }
}

function normalizeSeedWeight(seeds: TraceMemorySeed[]): number {
  if (seeds.length === 0) return 0

  const averageWeight = seeds.reduce((total, seed) => total + seed.memoryWeight, 0) / seeds.length

  return clampScore(Math.round(averageWeight / 10))
}

function countSeedKind(
  seeds: TraceMemorySeed[],
  kind: TraceMemorySeed["kind"]
): number {
  return seeds.filter((seed) => seed.kind === kind).length
}

function resolveMemorySeedFocusKinds(seeds: TraceMemorySeed[]): string[] {
  return Array.from(new Set(seeds.map((seed) => seed.kind))).slice(0, 4)
}

function resolveMemorySeedFocusRegions(seeds: TraceMemorySeed[]): string[] {
  return Array.from(new Set(seeds.flatMap((seed) => seed.regionKinds))).slice(0, 6)
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(12, value))
}

function sortScores(
  left: ButlerRuntimeMotivationScore,
  right: ButlerRuntimeMotivationScore
): number {
  if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore

  return MOTIVATION_PRIORITY[right.type] - MOTIVATION_PRIORITY[left.type]
}

function hasRepeatedRecentSignature(signatures: string[]): boolean {
  const recent = signatures.slice(-3)

  return recent.length === 3 && recent.every((signature) => signature === recent[0])
}
