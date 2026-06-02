import type { SpaceRegionKind } from "@/world/space"
import type { TraceType } from "@/world/trace"

import type { ButlerRuntimeDecision, ButlerRuntimeMotivationType } from "./butler-runtime-motivation-schema"
import type { WorldRuntimeSaveRecord, WorldRuntimeTickResult } from "./world-runtime-schema"

export type ButlerRuntimeIntentKind =
  | "construction"
  | "maintenance"
  | "observation"
  | "resource_wait"

export type ButlerRuntimeIntentTarget = {
  kind: "world" | "region"
  regionKind?: SpaceRegionKind
  reason: string
}

export type ButlerRuntimeIntent = {
  id: string
  tick: number
  motivation: ButlerRuntimeMotivationType
  kind: ButlerRuntimeIntentKind
  target: ButlerRuntimeIntentTarget
  allowsHomeMapDiff: boolean
  requestedTraceTypes: TraceType[]
  requestedEventSource: "butler" | "safe_apply" | "construction"
  reason: string
  createdAt: string
  tags: string[]
}

export type ButlerWorldRuleValidation = {
  id: string
  tick: number
  intentId: string
  ok: boolean
  safeApplyRequired: boolean
  homeMapDiffAllowed: boolean
  traceWriteAllowed: boolean
  eventWriteAllowed: boolean
  memorySeedAllowed: boolean
  blockingWarnings: string[]
  warnings: string[]
  tags: string[]
}

export function buildButlerRuntimeIntent(input: {
  saveRecord: WorldRuntimeSaveRecord
  decision: ButlerRuntimeDecision
  nextTick: number
  createdAt: string
  acceptedDiffCount: number
}): ButlerRuntimeIntent {
  const kind = resolveIntentKind(input.decision.selectedMotivation)
  const target = resolveIntentTarget(input)
  const allowsHomeMapDiff =
    input.decision.selectedMotivation === "continue_construction" ||
    input.decision.selectedMotivation === "maintain_home"
  const requestedTraceTypes = resolveRequestedTraceTypes({
    motivation: input.decision.selectedMotivation,
    acceptedDiffCount: input.acceptedDiffCount,
  })

  return {
    id: `butler_intent_${input.saveRecord.worldId}_${input.nextTick}`,
    tick: input.nextTick,
    motivation: input.decision.selectedMotivation,
    kind,
    target,
    allowsHomeMapDiff,
    requestedTraceTypes,
    requestedEventSource: input.acceptedDiffCount > 0 ? "safe_apply" : "butler",
    reason: buildIntentReason({
      decision: input.decision,
      acceptedDiffCount: input.acceptedDiffCount,
      target,
    }),
    createdAt: input.createdAt,
    tags: [
      "butler_runtime_intent",
      "butler_trace_closure",
      `intent_kind:${kind}`,
      `motivation:${input.decision.selectedMotivation}`,
      allowsHomeMapDiff ? "home_map_diff_may_be_requested" : "home_map_diff_not_requested",
      target.regionKind ? `target_region:${target.regionKind}` : "target_world",
      ...requestedTraceTypes.map((traceType) => `requested_trace:${traceType}`),
    ],
  }
}

export function validateButlerRuntimeIntent(input: {
  intent: ButlerRuntimeIntent
  decision: ButlerRuntimeDecision
  runtimeTick: WorldRuntimeTickResult["runtimeTick"]
  acceptedDiffCount: number
}): ButlerWorldRuleValidation {
  const blockingWarnings = [
    input.acceptedDiffCount > 0 && !input.intent.allowsHomeMapDiff
      ? "Intent attempted to accept HomeMapState diffs without diff permission."
      : "",
    input.acceptedDiffCount > 0 && !input.runtimeTick
      ? "Accepted diffs were reported without a runtime tick."
      : "",
    input.decision.selectedMotivation === "observe_world" && input.acceptedDiffCount > 0
      ? "Observation intent must not write HomeMapState diffs."
      : "",
    input.decision.selectedMotivation === "wait_for_resources" && input.acceptedDiffCount > 0
      ? "Resource wait intent must not write HomeMapState diffs."
      : "",
  ].filter(Boolean)
  const warnings = [
    input.intent.requestedTraceTypes.length === 0
      ? "Intent did not request any trace type."
      : "",
    input.decision.traceContext.warnings.length > 0
      ? `Trace context warnings: ${input.decision.traceContext.warnings.join(" | ")}`
      : "",
  ].filter(Boolean)
  const ok = blockingWarnings.length === 0

  return {
    id: `butler_world_rule_validation_${input.intent.tick}`,
    tick: input.intent.tick,
    intentId: input.intent.id,
    ok,
    safeApplyRequired: input.intent.allowsHomeMapDiff,
    homeMapDiffAllowed: ok && input.intent.allowsHomeMapDiff,
    traceWriteAllowed: ok,
    eventWriteAllowed: ok,
    memorySeedAllowed: ok,
    blockingWarnings,
    warnings,
    tags: [
      "butler_world_rule_validation",
      "butler_trace_closure",
      ok ? "world_rule_validation_passed" : "world_rule_validation_blocked",
      input.intent.allowsHomeMapDiff ? "safe_apply_required_for_home_map_diff" : "home_map_diff_forbidden",
      input.acceptedDiffCount > 0 ? "safe_apply_accepted_diffs" : "no_home_map_diff_written",
      "trace_write_requires_validation",
      "event_write_requires_validation",
      "memory_seed_requires_trace_quality",
    ],
  }
}

function resolveIntentKind(
  motivation: ButlerRuntimeMotivationType
): ButlerRuntimeIntentKind {
  if (motivation === "continue_construction") return "construction"
  if (motivation === "maintain_home") return "maintenance"
  if (motivation === "wait_for_resources") return "resource_wait"
  return "observation"
}

function resolveIntentTarget(input: {
  saveRecord: WorldRuntimeSaveRecord
  decision: ButlerRuntimeDecision
}): ButlerRuntimeIntentTarget {
  const focusRegion = input.decision.traceContext.memorySeedFocusRegions
    .map(coerceRegionKind)
    .find((regionKind): regionKind is SpaceRegionKind => Boolean(regionKind))
  const observationRegion = coerceRegionKind(
    input.decision.traceContext.preferredObservationRegions[0] ?? ""
  )
  const activePlan = input.saveRecord.homeMapState.constructionPlans.find(
    (plan) => plan.status === "active" || plan.status === "planned"
  )
  const planRegion = activePlan ? zoneTypeToRegionKind(activePlan.targetZoneType) : undefined
  const regionKind: SpaceRegionKind = focusRegion ?? observationRegion ?? planRegion ?? "home"

  return {
    kind: "region",
    regionKind,
    reason: focusRegion
      ? "Trace memory seed focus selected the intent region."
      : observationRegion
        ? "Trace influence selected a preferred observation region."
        : activePlan
          ? "Active construction plan selected the intent region."
          : "Default home region selected for stable butler intent.",
  }
}

function resolveRequestedTraceTypes(input: {
  motivation: ButlerRuntimeMotivationType
  acceptedDiffCount: number
}): TraceType[] {
  if (input.motivation === "continue_construction") {
    return input.acceptedDiffCount > 0
      ? ["construction_maintenance", "spatial_use"]
      : ["behavior_activity", "spatial_use"]
  }

  if (input.motivation === "maintain_home") {
    return ["construction_maintenance", "ecology_change"]
  }

  if (input.motivation === "wait_for_resources") {
    return ["time_passage", "spatial_use"]
  }

  return ["emotion_attention", "behavior_activity"]
}

function buildIntentReason(input: {
  decision: ButlerRuntimeDecision
  acceptedDiffCount: number
  target: ButlerRuntimeIntentTarget
}): string {
  return [
    `Selected motivation: ${input.decision.selectedMotivation}.`,
    input.acceptedDiffCount > 0
      ? `SafeApply accepted ${input.acceptedDiffCount} HomeMapState diff(s).`
      : "No HomeMapState diff was accepted for this intent.",
    input.target.reason,
  ].join(" ")
}

function coerceRegionKind(value: string): SpaceRegionKind | undefined {
  const allowed: SpaceRegionKind[] = [
    "home",
    "yard",
    "nature",
    "structure",
    "town_connection",
    "blocked",
    "boundary",
    "unopened",
    "locked",
    "unknown",
  ]

  return allowed.find((regionKind) => regionKind === value)
}

function zoneTypeToRegionKind(zoneType: string): SpaceRegionKind {
  if (zoneType === "natural_boundary") return "nature"
  if (zoneType === "entry_area") return "yard"
  if (zoneType === "temporary_shelter") return "structure"
  if (zoneType === "storage_tools") return "structure"

  return "home"
}
