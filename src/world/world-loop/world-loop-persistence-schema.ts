/**
 * 当前文件职责：定义 MVP 世界闭环持久化状态协议与摘要裁剪 helper。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type { SafeApplyDecisionStatus } from "./safe-apply-policy"
import type {
  RuntimeWorldState,
  WorldLoopAuditTrail,
  WorldLoopStageName,
  WorldLoopStepResult,
  WorldLoopStepStatus,
} from "./world-loop-schema"

export const WORLD_LOOP_PERSISTENCE_VERSION = "world_loop_persistence_v0"

export const WORLD_LOOP_AUDIT_TRAIL_RECENT_LIMIT = 10

export const WORLD_LOOP_AUDIT_TEXT_ITEM_LIMIT = 6

export type PersistedAuditStageSummary = {
  stage: WorldLoopStageName
  status: WorldLoopStepStatus
}

export type PersistedAuditTrailSummary = {
  tickId: string
  checkedAt: number
  status: WorldLoopStepStatus
  blockers: string[]
  warnings: string[]
  notes: string[]
  stageSummary: PersistedAuditStageSummary[]
  tags: string[]
}

export type PersistedLastAppliedTickSummary = {
  tickId: string
  status: WorldLoopStepStatus
  safeApplyStatus: SafeApplyDecisionStatus
  appliedMapDiffCount: number
  checkedAt: number
  tags: string[]
}

export type PersistedWorldLoopState = {
  version: typeof WORLD_LOOP_PERSISTENCE_VERSION
  worldId: string
  ownerId: string
  tickIndex: number
  currentHomeMapState: HomeMapState
  lastAppliedTick?: PersistedLastAppliedTickSummary
  auditTrailSummary: {
    totalCount: number
    recent: PersistedAuditTrailSummary[]
  }
  savedAt: number
  tags: string[]
}

export type BuildPersistedWorldLoopStateInput = {
  runtimeState: RuntimeWorldState
  savedAt: number
}

export type PersistedWorldLoopStateValidationResult = {
  isValid: boolean
  reasons: string[]
  tags: string[]
}

export type ValidatePersistedWorldLoopStateInput = {
  persistedState: PersistedWorldLoopState
  expectedWorldId: string
  expectedOwnerId: string
}

export function buildPersistedWorldLoopState(
  input: BuildPersistedWorldLoopStateInput
): PersistedWorldLoopState {
  const lastStepResult = input.runtimeState.lastStepResult

  return {
    version: WORLD_LOOP_PERSISTENCE_VERSION,
    worldId: input.runtimeState.worldId,
    ownerId: input.runtimeState.ownerId,
    tickIndex: input.runtimeState.tickIndex,
    currentHomeMapState: input.runtimeState.currentHomeMapState,
    lastAppliedTick: lastStepResult
      ? buildPersistedLastAppliedTickSummary(lastStepResult)
      : undefined,
    auditTrailSummary: {
      totalCount: input.runtimeState.auditTrail.length,
      recent: input.runtimeState.auditTrail
        .slice(-WORLD_LOOP_AUDIT_TRAIL_RECENT_LIMIT)
        .map(buildPersistedAuditTrailSummary),
    },
    savedAt: input.savedAt,
    tags: [
      "world_loop_persistence_v0",
      "persisted_world_loop_state",
      `world:${input.runtimeState.worldId}`,
      `owner:${input.runtimeState.ownerId}`,
    ],
  }
}

export function buildPersistedAuditTrailSummary(
  auditTrail: WorldLoopAuditTrail
): PersistedAuditTrailSummary {
  const status = resolveAuditTrailStatus(auditTrail)

  return {
    tickId: auditTrail.tickId,
    checkedAt: auditTrail.checkedAt,
    status,
    blockers: trimTextItems(auditTrail.blockers),
    warnings: trimTextItems(auditTrail.warnings),
    notes: trimTextItems(auditTrail.notes),
    stageSummary: auditTrail.stages.map((stage) => ({
      stage: stage.stage,
      status: stage.status,
    })),
    tags: [
      "persisted_audit_trail_summary",
      `status:${status}`,
      ...auditTrail.tags,
    ],
  }
}

export function buildPersistedLastAppliedTickSummary(
  stepResult: WorldLoopStepResult
): PersistedLastAppliedTickSummary {
  const safeApplyStatus = resolveSafeApplyStatusFromTags(
    stepResult.auditTrail.tags
  )

  return {
    tickId: stepResult.context.tickId,
    status: stepResult.status,
    safeApplyStatus,
    appliedMapDiffCount:
      stepResult.worldEvolutionExecution.appliedMapDiffCount,
    checkedAt: stepResult.context.now,
    tags: [
      "persisted_last_applied_tick_summary",
      `status:${stepResult.status}`,
      `safe_apply:${safeApplyStatus}`,
    ],
  }
}

export function validatePersistedWorldLoopState(
  input: ValidatePersistedWorldLoopStateInput
): PersistedWorldLoopStateValidationResult {
  const reasons: string[] = []

  if (input.persistedState.version !== WORLD_LOOP_PERSISTENCE_VERSION) {
    reasons.push("持久化版本不匹配。")
  }

  if (input.persistedState.worldId !== input.expectedWorldId) {
    reasons.push("持久化 worldId 与当前世界不匹配。")
  }

  if (input.persistedState.ownerId !== input.expectedOwnerId) {
    reasons.push("持久化 ownerId 与当前世界不匹配。")
  }

  if (
    input.persistedState.currentHomeMapState.worldId !== input.expectedWorldId
  ) {
    reasons.push("持久化 HomeMapState.worldId 与当前世界不匹配。")
  }

  if (
    input.persistedState.currentHomeMapState.ownerId !== input.expectedOwnerId
  ) {
    reasons.push("持久化 HomeMapState.ownerId 与当前世界不匹配。")
  }

  if (input.persistedState.tickIndex < 0) {
    reasons.push("持久化 tickIndex 非法。")
  }

  if (
    input.persistedState.auditTrailSummary.totalCount <
    input.persistedState.auditTrailSummary.recent.length
  ) {
    reasons.push("持久化 auditTrailSummary.totalCount 小于 recent 数量。")
  }

  return {
    isValid: reasons.length === 0,
    reasons,
    tags: [
      "persisted_world_loop_state_validation",
      reasons.length === 0 ? "valid" : "invalid",
    ],
  }
}

export function trimTextItems(items: string[]): string[] {
  const seenItems = new Set<string>()
  const trimmedItems: string[] = []

  items.forEach((item) => {
    const trimmedItem = item.trim()

    if (trimmedItem.length === 0 || seenItems.has(trimmedItem)) {
      return
    }

    seenItems.add(trimmedItem)
    trimmedItems.push(trimmedItem)
  })

  return trimmedItems.slice(0, WORLD_LOOP_AUDIT_TEXT_ITEM_LIMIT)
}

export function resolveAuditTrailStatus(
  auditTrail: WorldLoopAuditTrail
): WorldLoopStepStatus {
  const statusTag = auditTrail.tags.find((tag) => tag.startsWith("status:"))
  const statusValue = statusTag?.slice("status:".length)

  if (statusValue && isWorldLoopStepStatus(statusValue)) {
    return statusValue
  }

  if (auditTrail.stages.some((stage) => stage.status === "blocked")) {
    return "blocked"
  }

  if (auditTrail.stages.some((stage) => stage.status === "applied")) {
    return "applied"
  }

  if (auditTrail.stages.some((stage) => stage.status === "rendered")) {
    return "rendered"
  }

  if (auditTrail.stages.some((stage) => stage.status === "skipped")) {
    return "skipped"
  }

  return "not_started"
}

export function resolveSafeApplyStatusFromTags(
  tags: string[]
): SafeApplyDecisionStatus {
  const safeApplyTag = tags.find((tag) => tag.startsWith("safe_apply:"))
  const safeApplyValue = safeApplyTag?.slice("safe_apply:".length)

  if (safeApplyValue && isSafeApplyDecisionStatus(safeApplyValue)) {
    return safeApplyValue
  }

  return "block_state_mismatch"
}

function isWorldLoopStepStatus(value: string): value is WorldLoopStepStatus {
  return (
    value === "not_started" ||
    value === "skipped" ||
    value === "blocked" ||
    value === "applied" ||
    value === "rendered"
  )
}

function isSafeApplyDecisionStatus(
  value: string
): value is SafeApplyDecisionStatus {
  return (
    value === "allow_apply" ||
    value === "skip_no_diff" ||
    value === "block_audit" ||
    value === "block_validation" ||
    value === "block_execution" ||
    value === "block_state_mismatch"
  )
}
