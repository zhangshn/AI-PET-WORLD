/**
 * 当前文件职责：定义管家运行时状态协议与基础校验 helper。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

export const BUTLER_RUNTIME_CONTEXT_VERSION = "butler_runtime_context_v0"

export type ButlerRuntimeMood =
  | "calm"
  | "focused"
  | "busy"
  | "protective"
  | "curious"
  | "tired"
  | "uncertain"

export type ButlerRuntimeTask =
  | "observe_home"
  | "maintain_home"
  | "plan_building"
  | "care_pet"
  | "inspect_environment"
  | "organize_space"
  | "rest"
  | "idle"

export type ButlerRuntimeAttentionTargetType =
  | "pet"
  | "home"
  | "resource"
  | "path"
  | "nature"
  | "facility"
  | "unknown"

export type ButlerRuntimeConcernLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical"

export type ButlerRuntimeObservationType =
  | "world_state"
  | "pet_state"
  | "resource_state"
  | "construction_state"
  | "environment_state"
  | "unknown"

export type ButlerRuntimeAttentionTarget = {
  type: ButlerRuntimeAttentionTargetType
  targetId?: string
  label: string
  priority: number
  reason: string
  tags: string[]
}

export type ButlerRuntimeObservation = {
  id: string
  observedAt: number
  type: ButlerRuntimeObservationType
  message: string
  source: "world_loop" | "runtime" | "manual" | "system"
  tags: string[]
}

export type ButlerRuntimeNeedSignal = {
  id: string
  type:
    | "pet_care"
    | "home_maintenance"
    | "space_organization"
    | "resource_review"
    | "environment_review"
    | "rest"
  urgency: ButlerRuntimeConcernLevel
  score: number
  reason: string
  tags: string[]
}

export type ButlerRuntimeProfileLink = {
  source: "player_birth_profile" | "default_profile" | "runtime_generated"
  profileId?: string
  summary: string
  tags: string[]
}

export type ButlerRuntimeContext = {
  version: typeof BUTLER_RUNTIME_CONTEXT_VERSION
  butlerId: string
  worldId: string
  ownerId: string
  tickIndex: number

  mood: ButlerRuntimeMood
  currentTask: ButlerRuntimeTask
  concernLevel: ButlerRuntimeConcernLevel

  constructionStyle: ButlerConstructionStyleVector
  attentionTargets: ButlerRuntimeAttentionTarget[]
  observations: ButlerRuntimeObservation[]
  needSignals: ButlerRuntimeNeedSignal[]

  profileLink: ButlerRuntimeProfileLink

  updatedAt: number
  tags: string[]
}

export type BuildDefaultButlerRuntimeContextInput = {
  worldId: string
  ownerId: string
  tickIndex: number
  now: number
  constructionStyle: ButlerConstructionStyleVector
}

export type ButlerRuntimeContextValidationResult = {
  isValid: boolean
  reasons: string[]
  warnings: string[]
  tags: string[]
}

export type ValidateButlerRuntimeContextInput = {
  context: ButlerRuntimeContext
  expectedWorldId: string
  expectedOwnerId: string
}

export type ButlerRuntimeContextSummary = {
  butlerId: string
  worldId: string
  ownerId: string
  tickIndex: number
  mood: ButlerRuntimeMood
  currentTask: ButlerRuntimeTask
  concernLevel: ButlerRuntimeConcernLevel
  attentionTargetCount: number
  observationCount: number
  needSignalCount: number
  topNeedSignal?: {
    type: ButlerRuntimeNeedSignal["type"]
    urgency: ButlerRuntimeConcernLevel
    score: number
    reason: string
  }
  updatedAt: number
  tags: string[]
}

export function buildDefaultButlerRuntimeContext(
  input: BuildDefaultButlerRuntimeContextInput
): ButlerRuntimeContext {
  return {
    version: BUTLER_RUNTIME_CONTEXT_VERSION,
    butlerId: `butler-${input.worldId}`,
    worldId: input.worldId,
    ownerId: input.ownerId,
    tickIndex: input.tickIndex,
    mood: "focused",
    currentTask: "observe_home",
    concernLevel: "low",
    constructionStyle: input.constructionStyle,
    attentionTargets: [
      {
        type: "home",
        label: "初始家园",
        priority: 50,
        reason: "管家正在观察第一幕家园状态。",
        tags: ["default_attention_target", "home"],
      },
    ],
    observations: [
      {
        id: `butler-observation-${input.worldId}-${input.tickIndex}`,
        observedAt: input.now,
        type: "world_state",
        message: "管家已进入家园运行态，正在观察当前世界状态。",
        source: "runtime",
        tags: ["default_observation", "world_state"],
      },
    ],
    needSignals: [
      {
        id: `butler-need-${input.worldId}-${input.tickIndex}`,
        type: "home_maintenance",
        urgency: "low",
        score: 30,
        reason: "初始阶段仅需要基础观察与轻量维护。",
        tags: ["default_need_signal", "home_maintenance"],
      },
    ],
    profileLink: {
      source: "default_profile",
      summary:
        "当前使用默认管家运行时画像；后续可接入玩家生命数据生成的管家人格摘要。",
      tags: ["default_profile_link"],
    },
    updatedAt: input.now,
    tags: [
      "butler_runtime_context_v0",
      "default_butler_runtime_context",
      `world:${input.worldId}`,
      `owner:${input.ownerId}`,
    ],
  }
}

export function validateButlerRuntimeContext(
  input: ValidateButlerRuntimeContextInput
): ButlerRuntimeContextValidationResult {
  const reasons: string[] = []
  const warnings: string[] = []
  const { context } = input

  if (context.version !== BUTLER_RUNTIME_CONTEXT_VERSION) {
    reasons.push("管家 runtime context 版本不匹配。")
  }

  if (context.worldId !== input.expectedWorldId) {
    reasons.push("管家 runtime context worldId 不匹配。")
  }

  if (context.ownerId !== input.expectedOwnerId) {
    reasons.push("管家 runtime context ownerId 不匹配。")
  }

  if (context.tickIndex < 0) {
    reasons.push("管家 runtime context tickIndex 非法。")
  }

  if (context.butlerId.trim().length === 0) {
    reasons.push("管家 runtime context butlerId 不能为空。")
  }

  if (context.updatedAt < 0) {
    reasons.push("管家 runtime context updatedAt 非法。")
  }

  if (context.attentionTargets.length === 0) {
    warnings.push("管家 runtime context 当前没有 attention target。")
  }

  if (context.observations.length === 0) {
    warnings.push("管家 runtime context 当前没有 observation。")
  }

  if (context.needSignals.length === 0) {
    warnings.push("管家 runtime context 当前没有 need signal。")
  }

  if (
    context.needSignals.some(
      (needSignal) => needSignal.score < 0 || needSignal.score > 100
    )
  ) {
    reasons.push("管家 runtime context need signal score 必须在 0 到 100 之间。")
  }

  if (
    context.attentionTargets.some(
      (attentionTarget) =>
        attentionTarget.priority < 0 || attentionTarget.priority > 100
    )
  ) {
    reasons.push(
      "管家 runtime context attention target priority 必须在 0 到 100 之间。"
    )
  }

  return {
    isValid: reasons.length === 0,
    reasons,
    warnings,
    tags: [
      "butler_runtime_context_validation",
      reasons.length === 0 ? "valid" : "invalid",
    ],
  }
}

export function buildButlerRuntimeContextSummary(
  context: ButlerRuntimeContext
): ButlerRuntimeContextSummary {
  const topNeedSignal = findTopNeedSignal(context.needSignals)

  return {
    butlerId: context.butlerId,
    worldId: context.worldId,
    ownerId: context.ownerId,
    tickIndex: context.tickIndex,
    mood: context.mood,
    currentTask: context.currentTask,
    concernLevel: context.concernLevel,
    attentionTargetCount: context.attentionTargets.length,
    observationCount: context.observations.length,
    needSignalCount: context.needSignals.length,
    topNeedSignal: topNeedSignal
      ? {
          type: topNeedSignal.type,
          urgency: topNeedSignal.urgency,
          score: topNeedSignal.score,
          reason: topNeedSignal.reason,
        }
      : undefined,
    updatedAt: context.updatedAt,
    tags: [
      "butler_runtime_context_summary",
      `mood:${context.mood}`,
      `task:${context.currentTask}`,
      `concern:${context.concernLevel}`,
    ],
  }
}

export function findTopNeedSignal(
  needSignals: ButlerRuntimeNeedSignal[]
): ButlerRuntimeNeedSignal | undefined {
  return [...needSignals].sort((leftNeedSignal, rightNeedSignal) => {
    if (rightNeedSignal.score !== leftNeedSignal.score) {
      return rightNeedSignal.score - leftNeedSignal.score
    }

    return (
      getButlerConcernWeight(rightNeedSignal.urgency) -
      getButlerConcernWeight(leftNeedSignal.urgency)
    )
  })[0]
}

export function getButlerConcernWeight(
  concernLevel: ButlerRuntimeConcernLevel
): number {
  if (concernLevel === "critical") return 5
  if (concernLevel === "high") return 4
  if (concernLevel === "medium") return 3
  if (concernLevel === "low") return 2

  return 1
}
