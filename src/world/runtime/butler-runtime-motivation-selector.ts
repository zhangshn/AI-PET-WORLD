/**
 * Scores the butler's next live-runtime motivation before a world tick.
 */

import type { WorldRuntimeSaveRecord } from "./world-runtime-schema"
import type {
  ButlerRuntimeDecision,
  ButlerRuntimeMotivationScore,
  ButlerRuntimeMotivationType,
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
  const scores = buildMotivationScores(input)
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
    reasons: selected.reasons,
    createdAt: new Date(input.now).toISOString(),
    tags: [
      "butler_runtime_decision",
      `motivation:${selectedMotivation}`,
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
  const traceContext = buildTraceContext(input.saveRecord)
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
      traceContextScore: traceContext.highMaintenanceTraceCount > 0 ? 4 : 0,
      riskPenalty: repeatedActionRisk ? 28 : 0,
      reasons: [
        hasConstructionPlans
          ? "There is an active construction chain to consider."
          : "No active construction chain is visible.",
        lastAction && lastAction.acceptedDiffCount > 0
          ? "The previous runtime action changed the world through SafeApply."
          : "The previous runtime action did not write a world change.",
        traceContext.highMaintenanceTraceCount > 0
          ? "Trace context reports maintained or stressed areas, but it remains advisory."
          : "Trace context does not require construction continuity.",
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
      traceContextScore: Math.min(10, traceContext.highMaintenanceTraceCount * 2),
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
      ],
      tags: ["butler_motivation_score", "maintain_home", ...traceContext.tags],
    }),
    buildScore({
      type: "wait_for_resources",
      baseScore: 24,
      resourceScore: resourcePressure,
      continuityScore: denseTransactions ? 12 : 0,
      traceContextScore: traceContext.tracePressure > 60 ? 4 : 0,
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
      ],
      tags: ["butler_motivation_score", "wait_for_resources", ...traceContext.tags],
    }),
    buildScore({
      type: "observe_world",
      baseScore: 22,
      resourceScore: resourcePressure > 30 ? 8 : 0,
      continuityScore: repeatedActionRisk ? 30 : 6,
      traceContextScore: traceContext.familiarRegionCount > 0 ? 6 : 0,
      riskPenalty: 0,
      reasons: [
        repeatedActionRisk
          ? "Recent action signatures repeat, so observation is safer."
          : "Observation remains available as the stable fallback.",
        "Observation does not force a new HomeMapState fact.",
        traceContext.familiarRegionCount > 0
          ? "Trace influence offers familiar regions for observation context only."
          : "No familiar trace region is available for observation context.",
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

function buildTraceContext(saveRecord: WorldRuntimeSaveRecord): {
  tracePressure: number
  familiarRegionCount: number
  highMaintenanceTraceCount: number
  tags: string[]
} {
  const summary = saveRecord.traceInfluenceSummary

  if (!summary) {
    return {
      tracePressure: 0,
      familiarRegionCount: 0,
      highMaintenanceTraceCount: 0,
      tags: ["trace_context:not_available"],
    }
  }

  return {
    tracePressure: Math.round(summary.averageTraceInfluenceStrength),
    familiarRegionCount: summary.familiarRegionCount,
    highMaintenanceTraceCount: summary.highMaintenanceTraceCount,
    tags: [
      "trace_context:read_only",
      `trace_pressure:${Math.round(summary.averageTraceInfluenceStrength)}`,
      `familiar_regions:${summary.familiarRegionCount}`,
      `maintenance_trace_hints:${summary.highMaintenanceTraceCount}`,
    ],
  }
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
