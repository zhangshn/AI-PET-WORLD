/**
 * Runs one live-world tick from an existing HomeMapState.
 */

import { buildButlerMvpProfile } from "@/world/butler/butler-personality-adapter"
import { runMvpWorldRuntimeTick } from "@/world/mvp-core/mvp-world-runtime-tick"

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
  const butlerBuildResult = buildButlerMvpProfile({
    playerId: input.saveRecord.ownerId,
    ownerId: input.saveRecord.ownerId,
    worldId: input.saveRecord.worldId,
    seed: input.saveRecord.homeMapState.seed,
    ...DEFAULT_BIRTH_INPUT,
    tags: ["world_runtime_tick_butler_profile"],
  })
  const runtimeTick = runMvpWorldRuntimeTick({
    homeMapState: input.saveRecord.homeMapState,
    butlerProfile: butlerBuildResult.profile,
    constructionStyle: butlerBuildResult.profile.constructionStyle,
    worldDay: nextTick,
    now: input.now,
    tickReason: "scheduled_tick",
    persistenceMode: "proposal_only",
    visualMode: "signal_only",
    tags: [
      "live_world_runtime_tick",
      "server_side_runtime",
      "safe_apply_required",
      ...input.tags,
    ],
  })
  const event = buildRuntimeEvent({
    tick: nextTick,
    createdAt: nowIso,
    acceptedDiffCount:
      runtimeTick.constructionResult.fullPipelineAudit.acceptedDiffIds.length,
    warningCount: runtimeTick.audit.warnings.length,
  })
  const actionSummary = buildRuntimeActionSummary({
    tick: nextTick,
    createdAt: nowIso,
    runtimeTick,
  })
  const recentEvents = [...input.saveRecord.recentEvents, event].slice(-20)
  const recentActionSignatures = [
    ...(input.saveRecord.recentActionSignatures ?? []),
    actionSummary.actionSignature,
  ].slice(-10)
  const nextSaveRecord: WorldRuntimeSaveRecord = {
    version: "v2.6-runtime-00",
    worldId: input.saveRecord.worldId,
    ownerId: input.saveRecord.ownerId,
    tick: nextTick,
    savedAt: nowIso,
    homeMapState: runtimeTick.nextHomeMapState,
    recentEvents,
    recentActionSignatures,
    lastRuntimeAction: actionSummary,
    tags: [
      "world_runtime_save_record",
      "safe_apply_output",
      "home_map_state_persisted_after_tick",
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
      ...runtimeTick.messages,
      ...combinedAudit.warnings,
    ],
    tags: [
      "world_runtime_tick_result",
      "map_diff_safe_apply_driven",
      "no_pet_fact_created",
      ...continuityAudit.tags,
    ],
  }
}

function buildRuntimeActionSummary(input: {
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

function buildRuntimeEvent(input: {
  tick: number
  createdAt: string
  acceptedDiffCount: number
  warningCount: number
}): WorldRuntimeEventLog {
  const changedText =
    input.acceptedDiffCount > 0
      ? `This tick wrote ${input.acceptedDiffCount} world change(s) through SafeApply.`
      : "The butler observed resources, space, and construction state without forcing a world change."

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
    ],
  }
}
