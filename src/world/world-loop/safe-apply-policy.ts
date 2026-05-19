/**
 * 当前文件职责：定义 MVP 世界闭环正式写入前的 SafeApply 策略。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { MapDiffValidationResult } from "@/world/map-state/map-diff-validator"
import type { WorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import type { WorldEvolutionExecutionResult } from "@/world/world-evolution-executor/world-evolution-executor-gateway"
import type { WorldDiffProposal } from "@/world/world-evolution/world-evolution-gateway"

import type {
  WorldLoopStageRecord,
  WorldLoopStepStatus,
} from "./world-loop-schema"

export type SafeApplyDecisionStatus =
  | "allow_apply"
  | "skip_no_diff"
  | "block_audit"
  | "block_validation"
  | "block_execution"
  | "block_state_mismatch"

export type SafeApplyDecision = {
  status: SafeApplyDecisionStatus
  canUseNextHomeMapState: boolean
  nextHomeMapState: HomeMapState
  appliedMapDiffCount: number
  reasons: string[]
  blockers: string[]
  warnings: string[]
  stageRecord: WorldLoopStageRecord
  tags: string[]
}

export type BuildSafeApplyDecisionInput = {
  previousHomeMapState: HomeMapState
  proposal: WorldDiffProposal
  validation: MapDiffValidationResult
  audit: WorldEvolutionAuditReport
  execution: WorldEvolutionExecutionResult
}

export function buildSafeApplyDecision(
  input: BuildSafeApplyDecisionInput
): SafeApplyDecision {
  if (input.proposal.mapDiffs.length === 0) {
    return buildSkippedDecision(input.previousHomeMapState)
  }

  if (input.validation.rejectedDiffs.length > 0) {
    return buildBlockedDecision({
      previousHomeMapState: input.previousHomeMapState,
      status: "block_validation",
      reason: "SafeApply 阻止：MapDiff validation 存在 rejectedDiffs。",
      blockers: input.validation.rejectedDiffs.map((item) => item.reason),
      warnings: input.validation.warnings,
      message: "SafeApply 阻止：MapDiff validation 未通过。",
      tags: ["block_validation"],
    })
  }

  if (input.audit.summary.canApplySafely !== true) {
    return buildBlockedDecision({
      previousHomeMapState: input.previousHomeMapState,
      status: "block_audit",
      reason: "SafeApply 阻止：WorldEvolutionAudit 未允许正式写入。",
      blockers: [input.audit.blockers, input.audit.rejectedReasons],
      warnings: input.audit.warnings,
      message: "SafeApply 阻止：审计未通过。",
      tags: ["block_audit"],
    })
  }

  if (input.execution.status !== "applied") {
    return buildBlockedDecision({
      previousHomeMapState: input.previousHomeMapState,
      status: "block_execution",
      reason: "SafeApply 阻止：执行器没有产生 applied 结果。",
      blockers: input.execution.blockedReasons,
      warnings: input.execution.messages,
      message: "SafeApply 阻止：execution.status 不是 applied。",
      tags: ["block_execution"],
    })
  }

  if (input.execution.appliedMapDiffCount !== input.proposal.mapDiffs.length) {
    return buildStateMismatchDecision({
      previousHomeMapState: input.previousHomeMapState,
      reason:
        "SafeApply 阻止：execution 应用数量与 proposal MapDiff 数量不一致。",
      blockers: [
        `execution.appliedMapDiffCount=${input.execution.appliedMapDiffCount}`,
        `proposal.mapDiffs.length=${input.proposal.mapDiffs.length}`,
      ],
      warnings: input.execution.messages,
      message: "SafeApply 阻止：执行结果与提案不一致。",
    })
  }

  if (
    input.execution.nextHomeMapState.worldId !==
    input.previousHomeMapState.worldId
  ) {
    return buildStateMismatchDecision({
      previousHomeMapState: input.previousHomeMapState,
      reason:
        "SafeApply 阻止：nextHomeMapState.worldId 与 previousHomeMapState.worldId 不一致。",
      blockers: [
        `nextHomeMapState.worldId=${input.execution.nextHomeMapState.worldId}`,
        `previousHomeMapState.worldId=${input.previousHomeMapState.worldId}`,
      ],
      warnings: input.execution.messages,
      message: "SafeApply 阻止：执行结果与前置世界不一致。",
    })
  }

  if (
    input.execution.nextHomeMapState.ownerId !==
    input.previousHomeMapState.ownerId
  ) {
    return buildStateMismatchDecision({
      previousHomeMapState: input.previousHomeMapState,
      reason:
        "SafeApply 阻止：nextHomeMapState.ownerId 与 previousHomeMapState.ownerId 不一致。",
      blockers: [
        `nextHomeMapState.ownerId=${input.execution.nextHomeMapState.ownerId}`,
        `previousHomeMapState.ownerId=${input.previousHomeMapState.ownerId}`,
      ],
      warnings: input.execution.messages,
      message: "SafeApply 阻止：执行结果与前置世界不一致。",
    })
  }

  return buildAllowedDecision(input)
}

function buildSkippedDecision(
  previousHomeMapState: HomeMapState
): SafeApplyDecision {
  return {
    status: "skip_no_diff",
    canUseNextHomeMapState: false,
    nextHomeMapState: previousHomeMapState,
    appliedMapDiffCount: 0,
    reasons: ["SafeApply 跳过：proposal 没有 MapDiff。"],
    blockers: [],
    warnings: [],
    stageRecord: buildStageRecord({
      status: "skipped",
      message: "SafeApply 跳过：没有可应用的 MapDiff。",
      tags: ["safe_apply_skipped"],
    }),
    tags: ["safe_apply_v0", "safe_apply_skipped", "skip_no_diff"],
  }
}

function buildBlockedDecision(input: {
  previousHomeMapState: HomeMapState
  status: Exclude<SafeApplyDecisionStatus, "allow_apply" | "skip_no_diff">
  reason: string
  blockers: string[] | string[][]
  warnings: string[] | string[][]
  message: string
  tags: string[]
}): SafeApplyDecision {
  return {
    status: input.status,
    canUseNextHomeMapState: false,
    nextHomeMapState: input.previousHomeMapState,
    appliedMapDiffCount: 0,
    reasons: [input.reason],
    blockers: flattenUnique(input.blockers),
    warnings: flattenUnique(input.warnings),
    stageRecord: buildStageRecord({
      status: "blocked",
      message: input.message,
      tags: ["safe_apply_blocked", ...input.tags],
    }),
    tags: ["safe_apply_v0", "safe_apply_blocked", ...input.tags],
  }
}

function buildStateMismatchDecision(input: {
  previousHomeMapState: HomeMapState
  reason: string
  blockers: string[] | string[][]
  warnings: string[] | string[][]
  message: string
}): SafeApplyDecision {
  return buildBlockedDecision({
    previousHomeMapState: input.previousHomeMapState,
    status: "block_state_mismatch",
    reason: input.reason,
    blockers: input.blockers,
    warnings: input.warnings,
    message: input.message,
    tags: ["block_state_mismatch"],
  })
}

function buildAllowedDecision(
  input: BuildSafeApplyDecisionInput
): SafeApplyDecision {
  return {
    status: "allow_apply",
    canUseNextHomeMapState: true,
    nextHomeMapState: input.execution.nextHomeMapState,
    appliedMapDiffCount: input.execution.appliedMapDiffCount,
    reasons: ["SafeApply 允许：validation、audit、execution 均通过。"],
    blockers: [],
    warnings: flattenUnique([
      input.validation.warnings,
      input.audit.warnings,
      input.execution.messages,
    ]),
    stageRecord: buildStageRecord({
      status: "applied",
      message: "SafeApply 允许正式使用 execution.nextHomeMapState。",
      tags: ["safe_apply_applied"],
    }),
    tags: ["safe_apply_v0", "safe_apply_applied", "allow_apply"],
  }
}

function buildStageRecord(input: {
  status: WorldLoopStepStatus
  message: string
  tags: string[]
}): WorldLoopStageRecord {
  return {
    stage: "safe_apply",
    status: input.status,
    message: input.message,
    tags: ["safe_apply_stage", ...input.tags],
  }
}

function flattenUnique(values: string[][] | string[]): string[] {
  const flattened = values.flat()

  return Array.from(
    new Set(flattened.map((value) => value.trim()).filter(Boolean))
  )
}
