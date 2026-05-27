/**
 * Runs one live-world tick from an existing HomeMapState.
 */

import { buildButlerMvpProfile } from "@/world/butler/butler-personality-adapter"
import { runMvpWorldRuntimeTick } from "@/world/mvp-core/mvp-world-runtime-tick"
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import {
  buildTraceFieldFromWorld,
  buildTraceMemorySeedFieldFromTraceField,
  runTraceLifecycleTick,
} from "@/world/trace"

import { selectButlerRuntimeMotivation } from "./butler-runtime-motivation-selector"
import type { ButlerRuntimeDecision } from "./butler-runtime-motivation-schema"
import { auditWorldRuntimeTick } from "./world-runtime-audit"
import { auditWorldRuntimeContinuity } from "./world-runtime-continuity-audit"
import type {
  WorldRuntimeActionSummary,
  WorldRuntimeEventLog,
  WorldRuntimeSaveRecord,
  WorldRuntimeTickInput,
  WorldRuntimeTickResult,
} from "./world-runtime-schema"

const DEFAULT_BIRTH_INPUT = {
  birthYear: 1991,
  birthMonth: 6,
  birthDay: 18,
  birthHour: 8,
  timezone: "Asia/Shanghai",
}

export function runOneRuntimeTick(
  input: WorldRuntimeTickInput
): Omit<WorldRuntimeTickResult, "persisted"> {
  const nextTick = input.saveRecord.tick + 1
  const nowIso = new Date(input.now).toISOString()
  const decision = selectButlerRuntimeMotivation({
    saveRecord: input.saveRecord,
    nextTick,
    now: input.now,
  })
  const butlerBuildResult = buildButlerMvpProfile({
    playerId: input.saveRecord.ownerId,
    ownerId: input.saveRecord.ownerId,
    worldId: input.saveRecord.worldId,
    seed: input.saveRecord.homeMapState.seed,
    ...DEFAULT_BIRTH_INPUT,
    tags: ["world_runtime_tick_butler_profile"],
  })
  const runtimeTick = decision.shouldRunConstructionTick
    ? runMvpWorldRuntimeTick({
        homeMapState: input.saveRecord.homeMapState,
        butlerProfile: butlerBuildResult.profile,
        constructionStyle: butlerBuildResult.profile.constructionStyle,
        worldDay: nextTick,
        now: input.now,
        tickReason:
          decision.selectedMotivation === "maintain_home"
            ? "maintenance_check"
            : "scheduled_tick",
        persistenceMode: "proposal_only",
        visualMode: "signal_only",
        tags: [
          "live_world_runtime_tick",
          "server_side_runtime",
          "safe_apply_required",
          `motivation:${decision.selectedMotivation}`,
          ...input.tags,
        ],
      })
    : null
  const acceptedDiffCount =
    runtimeTick?.constructionResult.fullPipelineAudit.acceptedDiffIds.length ?? 0
  const runtimeWarnings = runtimeTick?.audit.warnings ?? []
  const event = buildRuntimeEvent({
    tick: nextTick,
    createdAt: nowIso,
    acceptedDiffCount,
    warningCount: runtimeWarnings.length,
    decision,
  })
  const actionSummary = runtimeTick
    ? buildRuntimeActionSummaryFromTick({
    tick: nextTick,
    createdAt: nowIso,
    runtimeTick,
      })
    : buildRuntimeActionSummaryFromDecision({
        tick: nextTick,
        createdAt: nowIso,
        decision,
      })
  const recentEvents = [...input.saveRecord.recentEvents, event].slice(-20)
  const recentActionSignatures = [
    ...(input.saveRecord.recentActionSignatures ?? []),
    actionSummary.actionSignature,
  ].slice(-10)
  const nextHomeMapState =
    runtimeTick?.nextHomeMapState ?? input.saveRecord.homeMapState
  const spaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState: nextHomeMapState,
  })
  const derivedTraceField = buildTraceFieldFromWorld({
    homeMapState: nextHomeMapState,
    spaceGrid,
  })
  const traceLifecycleResult = runTraceLifecycleTick({
    previousTraceField: input.saveRecord.traceField,
    derivedTraceField,
    currentTick: nextTick,
    homeMapState: nextHomeMapState,
    spaceGrid,
  })
  const traceInfluencedSpaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState: nextHomeMapState,
    traceField: traceLifecycleResult.nextTraceField,
  })
  const traceMemorySeedField = buildTraceMemorySeedFieldFromTraceField({
    traceField: traceLifecycleResult.nextTraceField,
    currentTick: nextTick,
  })
  const nextSaveRecord: WorldRuntimeSaveRecord = {
    version: "v2.6-runtime-00",
    worldId: input.saveRecord.worldId,
    ownerId: input.saveRecord.ownerId,
    tick: nextTick,
    savedAt: nowIso,
    homeMapState: nextHomeMapState,
    recentEvents,
    recentActionSignatures,
    lastRuntimeAction: actionSummary,
    recentMotivationTypes: [
      ...(input.saveRecord.recentMotivationTypes ?? []),
      decision.selectedMotivation,
    ].slice(-10),
    lastButlerRuntimeDecision: decision,
    traceField: traceLifecycleResult.nextTraceField,
    traceMemorySeedField,
    traceInfluenceSummary: traceInfluencedSpaceGrid.traceInfluenceSummary,
    tags: [
      "world_runtime_save_record",
      runtimeTick ? "safe_apply_output" : "butler_observe_or_wait_output",
      runtimeTick
        ? "home_map_state_persisted_after_tick"
        : "home_map_state_kept_stable_after_tick",
    ],
  }
  const audit = auditWorldRuntimeTick({
    nextHomeMapState: nextSaveRecord.homeMapState,
    events: [event],
  })
  const continuityAudit = auditWorldRuntimeContinuity({
    previousSaveRecord: input.saveRecord,
    nextSaveRecord,
    runtimeTick,
  })
  const combinedAudit = {
    ok: audit.ok && continuityAudit.blockingWarnings.length === 0,
    warnings: [
      ...audit.warnings,
      ...continuityAudit.warnings,
      ...continuityAudit.blockingWarnings,
    ],
    tags: [...audit.tags, ...continuityAudit.tags],
  }

  return {
    previousSaveRecord: input.saveRecord,
    nextSaveRecord,
    runtimeTick,
    events: [event],
    audit: combinedAudit,
    messages: [
      "Live world runtime tick completed.",
      ...decision.reasons,
      ...(runtimeTick?.messages ?? []),
      ...traceLifecycleResult.messages,
      ...traceLifecycleResult.warnings,
      `Trace influence projected for ${
        traceInfluencedSpaceGrid.traceInfluenceSummary?.totalInfluencedCells ?? 0
      } cells.`,
      `Trace memory seeds available: ${traceMemorySeedField.summary.totalSeeds}.`,
      ...combinedAudit.warnings,
    ],
    tags: [
      "world_runtime_tick_result",
      runtimeTick ? "map_diff_safe_apply_driven" : "butler_motivation_only_tick",
      "no_pet_fact_created",
      `motivation:${decision.selectedMotivation}`,
      ...traceLifecycleResult.tags,
      "trace_influence_summary_persisted",
      "trace_memory_seed_field_persisted",
      ...continuityAudit.tags,
    ],
  }
}

function buildRuntimeActionSummaryFromTick(input: {
  tick: number
  createdAt: string
  runtimeTick: NonNullable<WorldRuntimeTickResult["runtimeTick"]>
}): WorldRuntimeActionSummary {
  const protocolResult =
    input.runtimeTick.constructionResult.runtimeCycleResult
      .worldLoopProtocolResult
  const selectedPlan = protocolResult.selectedPlan
  const acceptedDiffIds =
    input.runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds
  const acceptedDiffs = protocolResult.safeApplyResult
    ? protocolResult.executionResult?.mapDiffs.filter((diff) =>
        acceptedDiffIds.includes(diff.id)
      ) ?? []
    : []
  const placementTokens = acceptedDiffs
    .map((diff) => `${diff.operation}:${diff.placementId}`)
    .sort()
  const actionSignature = [
    `project:${selectedPlan?.id ?? "none"}`,
    `target:${selectedPlan?.targetZoneType ?? "none"}`,
    `stage:${selectedPlan?.currentStage ?? "none"}`,
    `placements:${placementTokens.join("+") || "none"}`,
  ].join("|")

  return {
    tick: input.tick,
    actionSignature,
    projectId: selectedPlan?.id,
    targetZoneType: selectedPlan?.targetZoneType,
    stage: selectedPlan?.currentStage,
    acceptedDiffCount: acceptedDiffIds.length,
    resourceTransactionCount:
      protocolResult.executionResult?.resourceTransactions.length ?? 0,
    createdAt: input.createdAt,
    tags: [
      "world_runtime_action_summary",
      acceptedDiffIds.length > 0 ? "safe_apply_action" : "observe_or_wait_action",
    ],
  }
}

function buildRuntimeActionSummaryFromDecision(input: {
  tick: number
  createdAt: string
  decision: ButlerRuntimeDecision
}): WorldRuntimeActionSummary {
  return {
    tick: input.tick,
    actionSignature: [
      `motivation:${input.decision.selectedMotivation}`,
      `tick:${input.tick}`,
      "state:no_safe_construction",
    ].join("|"),
    acceptedDiffCount: 0,
    resourceTransactionCount: 0,
    createdAt: input.createdAt,
    tags: [
      "world_runtime_action_summary",
      "butler_motivation_only",
      `motivation:${input.decision.selectedMotivation}`,
    ],
  }
}

function buildRuntimeEvent(input: {
  tick: number
  createdAt: string
  acceptedDiffCount: number
  warningCount: number
  decision: ButlerRuntimeDecision
}): WorldRuntimeEventLog {
  const changedText = buildRuntimeEventBody(input)

  return {
    id: `runtime-event-${input.tick}`,
    tick: input.tick,
    title: "World runtime continued",
    body: `${changedText} Audit warnings: ${input.warningCount}.`,
    source: input.acceptedDiffCount > 0 ? "safe_apply" : "butler",
    createdAt: input.createdAt,
    tags: [
      "world_runtime_event",
      "butler_autonomous_action",
      "safe_apply_checked",
      "no_pet_fact_created",
      `motivation:${input.decision.selectedMotivation}`,
    ],
  }
}

function buildRuntimeEventBody(input: {
  acceptedDiffCount: number
  warningCount: number
  decision: ButlerRuntimeDecision
}): string {
  if (input.acceptedDiffCount > 0) {
    return [
      `The butler chose ${input.decision.selectedMotivation}.`,
      `This tick wrote ${input.acceptedDiffCount} world change(s) through SafeApply.`,
    ].join(" ")
  }

  if (input.decision.selectedMotivation === "wait_for_resources") {
    return "The butler judged current resources insufficient and waited without forcing a HomeMapState change."
  }

  if (input.decision.selectedMotivation === "observe_world") {
    return "The butler observed world state without writing new facts to HomeMapState."
  }

  return "The butler kept the home stable without forcing a world change."
}
