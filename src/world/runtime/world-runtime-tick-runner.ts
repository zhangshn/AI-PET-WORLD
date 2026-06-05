/**
 * Runs one live-world tick from an existing HomeMapState.
 */

import { runWorldRuntimeConstructionTick } from "@/world/runtime-core/world-runtime-construction-tick"
import { buildSpaceGridFromHomeMapState } from "@/world/space"
import {
  buildTraceFieldFromWorld,
  buildTraceMemorySeedFieldFromTraceField,
  runTraceLifecycleTick,
} from "@/world/trace"

import {
  buildButlerRuntimeIntent,
  validateButlerRuntimeIntent,
  type ButlerRuntimeIntent,
  type ButlerWorldRuleValidation,
} from "./butler-runtime-intent"
import { applyButlerRuntimeTraceClosure } from "./butler-runtime-trace-closure"
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
  const runtimeTick = decision.shouldRunConstructionTick
    ? runWorldRuntimeConstructionTick({
        homeMapState: input.saveRecord.homeMapState,
        butlerProfile: input.saveRecord.butlerRuntimeProfile,
        constructionStyle: input.saveRecord.butlerConstructionStyle,
        worldDay: nextTick,
        now: input.now,
        tickReason:
          decision.selectedMotivation === "maintain_home"
            ? "maintenance_check"
            : "scheduled_tick",
        persistenceMode: "proposal_only",
        painterMode: "signal_only",
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
  const intent = buildButlerRuntimeIntent({
    saveRecord: input.saveRecord,
    decision,
    nextTick,
    createdAt: nowIso,
    acceptedDiffCount,
  })
  const worldRuleValidation = validateButlerRuntimeIntent({
    intent,
    decision,
    runtimeTick,
    acceptedDiffCount,
  })
  const event = buildRuntimeEvent({
    tick: nextTick,
    createdAt: nowIso,
    acceptedDiffCount,
    warningCount:
      runtimeWarnings.length +
      worldRuleValidation.warnings.length +
      worldRuleValidation.blockingWarnings.length,
    decision,
    intent,
    worldRuleValidation,
  })
  const actionSummary = runtimeTick
    ? buildRuntimeActionSummaryFromTick({
        tick: nextTick,
        createdAt: nowIso,
        runtimeTick,
        intent,
        worldRuleValidation,
      })
    : buildRuntimeActionSummaryFromDecision({
        tick: nextTick,
        createdAt: nowIso,
        decision,
        intent,
        worldRuleValidation,
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
  const traceClosureResult = applyButlerRuntimeTraceClosure({
    traceField: traceLifecycleResult.nextTraceField,
    spaceGrid,
    decision,
    intent,
    validation: worldRuleValidation,
    currentTick: nextTick,
  })
  const traceInfluencedSpaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState: nextHomeMapState,
    traceField: traceClosureResult.nextTraceField,
  })
  const traceMemorySeedField = buildTraceMemorySeedFieldFromTraceField({
    traceField: traceClosureResult.nextTraceField,
    currentTick: nextTick,
  })
  const nextSaveRecord: WorldRuntimeSaveRecord = {
    version: "v2.6-runtime-00",
    worldId: input.saveRecord.worldId,
    ownerId: input.saveRecord.ownerId,
    tick: nextTick,
    savedAt: nowIso,
    butlerProfile: input.saveRecord.butlerProfile,
    butlerRuntimeProfile: input.saveRecord.butlerRuntimeProfile,
    butlerBirthInput: input.saveRecord.butlerBirthInput,
    butlerMappingMode: input.saveRecord.butlerMappingMode,
    butlerConstructionStyle: input.saveRecord.butlerConstructionStyle,
    worldCreationStyleSource: input.saveRecord.worldCreationStyleSource,
    homeMapState: nextHomeMapState,
    recentEvents,
    recentActionSignatures,
    lastRuntimeAction: actionSummary,
    recentMotivationTypes: [
      ...(input.saveRecord.recentMotivationTypes ?? []),
      decision.selectedMotivation,
    ].slice(-10),
    lastButlerRuntimeDecision: decision,
    lastButlerRuntimeIntent: intent,
    lastButlerWorldRuleValidation: worldRuleValidation,
    traceField: traceClosureResult.nextTraceField,
    traceMemorySeedField,
    traceInfluenceSummary: traceInfluencedSpaceGrid.traceInfluenceSummary,
    tags: [
      "world_runtime_save_record",
      runtimeTick ? "safe_apply_output" : "butler_observe_or_wait_output",
      runtimeTick
        ? "home_map_state_persisted_after_tick"
        : "home_map_state_kept_stable_after_tick",
      "butler_trace_closure",
      worldRuleValidation.ok
        ? "butler_world_rule_validation_passed"
        : "butler_world_rule_validation_blocked",
      traceClosureResult.createdTrace
        ? "butler_trace_fact_persisted"
        : "butler_trace_fact_not_created",
    ],
  }
  const audit = auditWorldRuntimeTick({
    nextHomeMapState: nextSaveRecord.homeMapState,
    events: [event],
    expectedTick: nextSaveRecord.tick,
  })
  const continuityAudit = auditWorldRuntimeContinuity({
    previousSaveRecord: input.saveRecord,
    nextSaveRecord,
    runtimeTick,
  })
  const combinedAudit = {
    ok:
      audit.ok &&
      continuityAudit.blockingWarnings.length === 0 &&
      worldRuleValidation.blockingWarnings.length === 0,
    warnings: [
      ...audit.warnings,
      ...continuityAudit.warnings,
      ...continuityAudit.blockingWarnings,
      ...worldRuleValidation.warnings,
      ...worldRuleValidation.blockingWarnings,
      ...traceClosureResult.warnings,
    ],
    tags: [
      ...audit.tags,
      ...continuityAudit.tags,
      ...worldRuleValidation.tags,
      ...traceClosureResult.tags,
    ],
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
      intent.reason,
      ...worldRuleValidation.warnings,
      ...worldRuleValidation.blockingWarnings,
      ...(runtimeTick?.messages ?? []),
      ...traceLifecycleResult.messages,
      ...traceLifecycleResult.warnings,
      ...traceClosureResult.messages,
      ...traceClosureResult.warnings,
      `Trace influence projected for ${
        traceInfluencedSpaceGrid.traceInfluenceSummary?.totalInfluencedCells ?? 0
      } cells.`,
      `Trace memory seeds available: ${traceMemorySeedField.summary.totalSeeds}.`,
      ...combinedAudit.warnings,
    ],
    tags: [
      "world_runtime_tick_result",
      runtimeTick ? "map_diff_safe_apply_driven" : "butler_motivation_only_tick",
      "butler_trace_closure",
      "butler_intent_world_rule_validated",
      traceClosureResult.createdTrace
        ? "butler_trace_closure_persisted"
        : "butler_trace_closure_skipped",
      "no_unplanned_life_fact_created",
      `motivation:${decision.selectedMotivation}`,
      ...traceLifecycleResult.tags,
      ...traceClosureResult.tags,
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
  intent: ButlerRuntimeIntent
  worldRuleValidation: ButlerWorldRuleValidation
}): WorldRuntimeActionSummary {
  const protocolResult =
    input.runtimeTick.constructionResult.runtimeCycleResult
      .runtimeCommitResult
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
    `tick:${input.tick}`,
    `project:${selectedPlan?.id ?? "none"}`,
    `stage:${selectedPlan?.currentStage ?? "none"}`,
    `intent:${input.intent.kind}`,
    `world_rule:${input.worldRuleValidation.ok ? "passed" : "blocked"}`,
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
      "butler_trace_closure",
      acceptedDiffIds.length > 0 ? "safe_apply_action" : "observe_or_wait_action",
      `intent_kind:${input.intent.kind}`,
      input.worldRuleValidation.ok
        ? "world_rule_validation_passed"
        : "world_rule_validation_blocked",
    ],
  }
}

function buildRuntimeActionSummaryFromDecision(input: {
  tick: number
  createdAt: string
  decision: ButlerRuntimeDecision
  intent: ButlerRuntimeIntent
  worldRuleValidation: ButlerWorldRuleValidation
}): WorldRuntimeActionSummary {
  return {
    tick: input.tick,
    actionSignature: [
      `motivation:${input.decision.selectedMotivation}`,
      `intent:${input.intent.kind}`,
      `world_rule:${input.worldRuleValidation.ok ? "passed" : "blocked"}`,
      `tick:${input.tick}`,
      "state:no_safe_construction",
    ].join("|"),
    acceptedDiffCount: 0,
    resourceTransactionCount: 0,
    createdAt: input.createdAt,
    tags: [
      "world_runtime_action_summary",
      "butler_motivation_only",
      "butler_trace_closure",
      `motivation:${input.decision.selectedMotivation}`,
      `intent_kind:${input.intent.kind}`,
      input.worldRuleValidation.ok
        ? "world_rule_validation_passed"
        : "world_rule_validation_blocked",
    ],
  }
}

function buildRuntimeEvent(input: {
  tick: number
  createdAt: string
  acceptedDiffCount: number
  warningCount: number
  decision: ButlerRuntimeDecision
  intent: ButlerRuntimeIntent
  worldRuleValidation: ButlerWorldRuleValidation
}): WorldRuntimeEventLog {
  const changedText = buildRuntimeEventBody(input)

  return {
    id: `runtime-event-${input.tick}`,
    tick: input.tick,
    title: "世界继续运行",
    body: `${changedText} 本轮规则提示：${input.warningCount} 条。`,
    source: input.acceptedDiffCount > 0 ? "safe_apply" : "butler",
    createdAt: input.createdAt,
    tags: [
      "world_runtime_event",
      "butler_autonomous_action",
      "safe_apply_checked",
      "butler_trace_closure",
      input.worldRuleValidation.ok
        ? "world_rule_validation_passed"
        : "world_rule_validation_blocked",
      "no_unplanned_life_fact_created",
      `motivation:${input.decision.selectedMotivation}`,
      `intent_kind:${input.intent.kind}`,
    ],
  }
}

function buildRuntimeEventBody(input: {
  acceptedDiffCount: number
  warningCount: number
  decision: ButlerRuntimeDecision
  intent: ButlerRuntimeIntent
  worldRuleValidation: ButlerWorldRuleValidation
}): string {
  if (!input.worldRuleValidation.ok) {
    return `管家产生了 ${input.decision.selectedMotivation} 动机，但世界规则校验阻止了这次意图写入。`
  }

  if (input.acceptedDiffCount > 0) {
    return [
      `管家选择了 ${input.decision.selectedMotivation}。`,
      `本轮有 ${input.acceptedDiffCount} 个世界变化通过 SafeApply 写入家园。`,
      "已接受的行动也被转化为经过校验的世界痕迹。",
    ].join(" ")
  }

  if (input.decision.selectedMotivation === "wait_for_resources") {
    return "管家判断当前资源不足，因此没有强行改写家园事实，只留下经过校验的等待痕迹。"
  }

  if (input.decision.selectedMotivation === "observe_world") {
    return "管家先观察世界状态，没有写入新的家园事实，只留下经过校验的关注痕迹。"
  }

  return `管家通过 ${input.intent.kind} 维持家园稳定，没有强行制造不安全的世界变化。`
}
