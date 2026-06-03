import type { TraceFact } from "@/world/trace"

import type {
  ButlerRuntimeDecision,
  ButlerRuntimeMotivationType,
} from "./butler-runtime-motivation-schema"
import type {
  ButlerRuntimeIntent,
  ButlerRuntimeIntentKind,
  ButlerWorldRuleValidation,
} from "./butler-runtime-intent"

export type ButlerRuntimeHomeMapWriteStatus =
  | "not_requested"
  | "blocked_by_world_rule"
  | "safe_apply_no_diff"
  | "safe_apply_written"

export type ButlerRuntimeTraceWriteStatus =
  | "created"
  | "skipped"
  | "blocked_by_world_rule"

export type ButlerRuntimeAuditSummary = {
  id: string
  tick: number
  motivation: ButlerRuntimeMotivationType
  intentKind: ButlerRuntimeIntentKind
  validationStatus: "passed" | "blocked"
  safeApplyRequired: boolean
  homeMapWriteStatus: ButlerRuntimeHomeMapWriteStatus
  acceptedDiffCount: number
  traceWriteStatus: ButlerRuntimeTraceWriteStatus
  traceId?: string
  traceType?: string
  memorySeedCount: number
  reason: string
  userFacingSummary: string
  safeguards: string[]
  createdAt: string
  tags: string[]
}

export function buildButlerRuntimeAuditSummary(input: {
  tick: number
  createdAt: string
  decision: ButlerRuntimeDecision
  intent: ButlerRuntimeIntent
  validation: ButlerWorldRuleValidation
  acceptedDiffCount: number
  createdTrace: TraceFact | null
  memorySeedCount: number
}): ButlerRuntimeAuditSummary {
  const homeMapWriteStatus = resolveHomeMapWriteStatus({
    validation: input.validation,
    acceptedDiffCount: input.acceptedDiffCount,
    safeApplyRequired: input.intent.allowsHomeMapDiff,
  })
  const traceWriteStatus = resolveTraceWriteStatus({
    validation: input.validation,
    createdTrace: input.createdTrace,
  })
  const safeguards = buildSafeguards({
    intent: input.intent,
    validation: input.validation,
    homeMapWriteStatus,
    traceWriteStatus,
  })
  const reason = buildReason({
    decision: input.decision,
    intent: input.intent,
    validation: input.validation,
    acceptedDiffCount: input.acceptedDiffCount,
    createdTrace: input.createdTrace,
    memorySeedCount: input.memorySeedCount,
  })

  return {
    id: `butler_runtime_audit_summary_${input.tick}`,
    tick: input.tick,
    motivation: input.decision.selectedMotivation,
    intentKind: input.intent.kind,
    validationStatus: input.validation.ok ? "passed" : "blocked",
    safeApplyRequired: input.validation.safeApplyRequired,
    homeMapWriteStatus,
    acceptedDiffCount: input.acceptedDiffCount,
    traceWriteStatus,
    traceId: input.createdTrace?.id,
    traceType: input.createdTrace?.type,
    memorySeedCount: input.memorySeedCount,
    reason,
    userFacingSummary: buildUserFacingSummary({
      intent: input.intent,
      validation: input.validation,
      homeMapWriteStatus,
      traceWriteStatus,
      createdTrace: input.createdTrace,
      memorySeedCount: input.memorySeedCount,
    }),
    safeguards,
    createdAt: input.createdAt,
    tags: [
      "butler_runtime_audit_summary",
      "butler_trace_closure",
      input.validation.ok
        ? "world_rule_validation_passed"
        : "world_rule_validation_blocked",
      `motivation:${input.decision.selectedMotivation}`,
      `intent_kind:${input.intent.kind}`,
      `home_map_write:${homeMapWriteStatus}`,
      `trace_write:${traceWriteStatus}`,
      "no_pet_fact",
      "safe_apply_boundary_recorded",
      "memory_seed_count_recorded",
    ],
  }
}

function resolveHomeMapWriteStatus(input: {
  validation: ButlerWorldRuleValidation
  acceptedDiffCount: number
  safeApplyRequired: boolean
}): ButlerRuntimeHomeMapWriteStatus {
  if (!input.validation.ok) return "blocked_by_world_rule"
  if (!input.safeApplyRequired) return "not_requested"
  if (input.acceptedDiffCount > 0) return "safe_apply_written"

  return "safe_apply_no_diff"
}

function resolveTraceWriteStatus(input: {
  validation: ButlerWorldRuleValidation
  createdTrace: TraceFact | null
}): ButlerRuntimeTraceWriteStatus {
  if (!input.validation.ok || !input.validation.traceWriteAllowed) {
    return "blocked_by_world_rule"
  }

  return input.createdTrace ? "created" : "skipped"
}

function buildSafeguards(input: {
  intent: ButlerRuntimeIntent
  validation: ButlerWorldRuleValidation
  homeMapWriteStatus: ButlerRuntimeHomeMapWriteStatus
  traceWriteStatus: ButlerRuntimeTraceWriteStatus
}): string[] {
  return [
    "管家意图必须先经过世界规则验证。",
    input.intent.allowsHomeMapDiff
      ? "家园事实变化必须经过 SafeApply。"
      : "本轮意图不请求改写 HomeMapState。",
    input.homeMapWriteStatus === "not_requested"
      ? "本轮没有改写 HomeMapState。"
      : "本轮已记录 HomeMapState 写入边界。",
    input.traceWriteStatus === "created"
      ? "本轮行为只沉淀为管家行为痕迹。"
      : "本轮没有强行创建行为痕迹。",
    "管家痕迹闭环不默认生成伴生对象事实。",
    input.validation.memorySeedAllowed
      ? "记忆种子只来自可审计的痕迹结果。"
      : "记忆种子写入被世界规则限制。",
  ]
}

function buildReason(input: {
  decision: ButlerRuntimeDecision
  intent: ButlerRuntimeIntent
  validation: ButlerWorldRuleValidation
  acceptedDiffCount: number
  createdTrace: TraceFact | null
  memorySeedCount: number
}): string {
  return [
    `Selected motivation: ${input.decision.selectedMotivation}.`,
    `Intent kind: ${input.intent.kind}.`,
    input.validation.ok
      ? "World rule validation passed."
      : `World rule validation blocked: ${input.validation.blockingWarnings.join(" | ")}.`,
    input.acceptedDiffCount > 0
      ? `SafeApply accepted ${input.acceptedDiffCount} HomeMapState diff(s).`
      : "No HomeMapState diff was written by this tick.",
    input.createdTrace
      ? `Trace closure created ${input.createdTrace.type} trace ${input.createdTrace.id}.`
      : "Trace closure did not create a new trace.",
    `Trace memory seed count after tick: ${input.memorySeedCount}.`,
  ].join(" ")
}

function buildUserFacingSummary(input: {
  intent: ButlerRuntimeIntent
  validation: ButlerWorldRuleValidation
  homeMapWriteStatus: ButlerRuntimeHomeMapWriteStatus
  traceWriteStatus: ButlerRuntimeTraceWriteStatus
  createdTrace: TraceFact | null
  memorySeedCount: number
}): string {
  if (!input.validation.ok) {
    return "管家这次的行动没有通过世界规则验证，因此没有强行改变家园。"
  }

  const intentText = intentKindToText(input.intent.kind)
  const writeText = homeMapWriteStatusToText(input.homeMapWriteStatus)
  const traceText = input.createdTrace
    ? `本轮留下了${traceTypeToText(input.createdTrace.type)}。`
    : input.traceWriteStatus === "skipped"
      ? "本轮没有形成新的可见行为痕迹。"
      : "本轮痕迹写入被限制。"
  const memoryText =
    input.memorySeedCount > 0
      ? `当前有 ${input.memorySeedCount} 条记忆种子可供后续判断参考。`
      : "当前还没有稳定记忆种子。"

  return `管家选择${intentText}。${writeText}${traceText}${memoryText}`
}

function intentKindToText(kind: ButlerRuntimeIntentKind): string {
  if (kind === "resource_wait") return "等待资源稳定"
  if (kind === "observation") return "继续观察世界"
  if (kind === "maintenance") return "维护家园"

  return "评估建设"
}

function homeMapWriteStatusToText(
  status: ButlerRuntimeHomeMapWriteStatus
): string {
  if (status === "not_requested") {
    return "它没有改写 HomeMapState，只记录了经过验证的行为结果。"
  }

  if (status === "safe_apply_written") {
    return "这次有家园变化通过 SafeApply 写入。"
  }

  if (status === "safe_apply_no_diff") {
    return "虽然本轮需要 SafeApply 边界，但没有新的家园变化被写入。"
  }

  return "这次家园变化被世界规则拦下，没有写入。"
}

function traceTypeToText(type: string): string {
  if (type === "time_passage") return "等待留下的时间痕迹"
  if (type === "spatial_use") return "空间使用痕迹"
  if (type === "construction_maintenance") return "维护痕迹"
  if (type === "ecology_change") return "生态变化痕迹"
  if (type === "emotion_attention") return "注意力痕迹"
  if (type === "behavior_activity") return "行为活动痕迹"
  if (type === "movement") return "移动痕迹"

  return "世界事件痕迹"
}
