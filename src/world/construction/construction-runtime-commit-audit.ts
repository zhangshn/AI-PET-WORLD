/**
 * 当前文件负责：审计建设循环接入前协议输出。
 */

import type {
  ConstructionRuntimeCommitAudit,
  ConstructionRuntimeCommitInput,
  ConstructionRuntimeCommitResult,
} from "./construction-schema"

export function auditConstructionRuntimeCommit(input: {
  protocolInput: ConstructionRuntimeCommitInput
  resultWithoutAudit: Omit<ConstructionRuntimeCommitResult, "audit">
}): ConstructionRuntimeCommitAudit {
  const plannerWarningCount = input.resultWithoutAudit.plannerInputResult.audit.warnings.length
  const candidateWarningCount = input.resultWithoutAudit.candidateResult.audit.warnings.length
  const executionWarningCount = input.resultWithoutAudit.executionResult?.audit.warnings.length ?? 0
  const safeApplyWarningCount = input.resultWithoutAudit.safeApplyResult?.audit.warnings.length ?? 0
  const warnings = [
    ...auditStableHomeMapIdentity(input),
    ...auditSelectedPlan(input),
    ...auditSafeApplyLineage(input),
    ...buildNestedWarningSummaries({
      plannerWarningCount,
      candidateWarningCount,
      executionWarningCount,
      safeApplyWarningCount,
    }),
  ]

  return {
    stableRuntimeCommitFingerprint: buildRuntimeCommitFingerprint(input),
    selectedPlanId: input.resultWithoutAudit.selectedPlan?.id ?? null,
    plannerWarningCount,
    candidateWarningCount,
    executionWarningCount,
    safeApplyWarningCount,
    acceptedDiffIds: input.resultWithoutAudit.safeApplyResult?.acceptedDiffIds ?? [],
    rejectedDiffIds:
      input.resultWithoutAudit.safeApplyResult?.rejectedDiffs.map((diff) => diff.diffId) ?? [],
    warnings,
    tags: [
      "construction_runtime_commit_audit",
      warnings.length === 0
        ? "construction_runtime_commit_valid"
        : "construction_runtime_commit_warning",
      "pre_runtime_commit_only",
      "no_ui_integration",
      "no_unplanned_life_entry",
    ],
  }
}

function auditStableHomeMapIdentity(input: {
  protocolInput: ConstructionRuntimeCommitInput
  resultWithoutAudit: Omit<ConstructionRuntimeCommitResult, "audit">
}): string[] {
  const before = input.protocolInput.homeMapState
  const after = input.resultWithoutAudit.nextHomeMapState
  const warnings: string[] = []

  if (before.worldId !== after.worldId) {
    warnings.push("Construction loop 协议不能修改 worldId。")
  }
  if (before.ownerId !== after.ownerId) {
    warnings.push("Construction loop 协议不能修改 ownerId。")
  }
  if (before.seed !== after.seed) {
    warnings.push("Construction loop 协议不能修改 seed。")
  }

  return warnings
}

function auditSelectedPlan(input: {
  protocolInput: ConstructionRuntimeCommitInput
  resultWithoutAudit: Omit<ConstructionRuntimeCommitResult, "audit">
}): string[] {
  const selectedPlan = input.resultWithoutAudit.selectedPlan

  if (!selectedPlan) return []

  const candidatePlanIds = input.resultWithoutAudit.candidateResult.plans.map(
    (plan) => plan.id
  )

  if (!candidatePlanIds.includes(selectedPlan.id)) {
    return [`selectedPlan 必须来自候选计划：${selectedPlan.id}`]
  }

  if (
    input.protocolInput.preferredPlanId &&
    input.protocolInput.preferredPlanId !== selectedPlan.id &&
    candidatePlanIds.includes(input.protocolInput.preferredPlanId)
  ) {
    return [
      `preferredPlanId 可用时应优先选择：${input.protocolInput.preferredPlanId}`,
    ]
  }

  return []
}

function auditSafeApplyLineage(input: {
  protocolInput: ConstructionRuntimeCommitInput
  resultWithoutAudit: Omit<ConstructionRuntimeCommitResult, "audit">
}): string[] {
  const selectedPlan = input.resultWithoutAudit.selectedPlan
  const executionResult = input.resultWithoutAudit.executionResult
  const safeApplyResult = input.resultWithoutAudit.safeApplyResult
  const warnings: string[] = []

  if (!selectedPlan && (executionResult || safeApplyResult)) {
    warnings.push("没有 selectedPlan 时不能生成 executionResult 或 safeApplyResult。")
  }

  if (selectedPlan && !executionResult) {
    warnings.push("存在 selectedPlan 时必须生成 executionResult。")
  }

  if (executionResult && !safeApplyResult) {
    warnings.push("存在 executionResult 时必须生成 safeApplyResult。")
  }

  if (executionResult && selectedPlan && executionResult.audit.planId !== selectedPlan.id) {
    warnings.push("executionResult.audit.planId 必须等于 selectedPlan.id。")
  }

  if (
    safeApplyResult &&
    executionResult &&
    safeApplyResult.audit.sourcePlanId !== executionResult.audit.planId
  ) {
    warnings.push("safeApplyResult.audit.sourcePlanId 必须来自 executionResult.audit.planId。")
  }

  return warnings
}

function buildNestedWarningSummaries(input: {
  plannerWarningCount: number
  candidateWarningCount: number
  executionWarningCount: number
  safeApplyWarningCount: number
}): string[] {
  const warnings: string[] = []

  if (input.plannerWarningCount > 0) {
    warnings.push(`planner input audit 有 ${input.plannerWarningCount} 个 warning。`)
  }
  if (input.candidateWarningCount > 0) {
    warnings.push(`candidate audit 有 ${input.candidateWarningCount} 个 warning。`)
  }
  if (input.executionWarningCount > 0) {
    warnings.push(`execution audit 有 ${input.executionWarningCount} 个 warning。`)
  }
  if (input.safeApplyWarningCount > 0) {
    warnings.push(`safeApply audit 有 ${input.safeApplyWarningCount} 个 warning。`)
  }

  return warnings
}

function buildRuntimeCommitFingerprint(input: {
  protocolInput: ConstructionRuntimeCommitInput
  resultWithoutAudit: Omit<ConstructionRuntimeCommitResult, "audit">
}): string {
  return [
    input.protocolInput.homeMapState.worldId,
    input.protocolInput.homeMapState.ownerId,
    input.protocolInput.homeMapState.seed,
    `worldDay:${input.protocolInput.worldDay}`,
    `now:${input.protocolInput.now}`,
    `selectedPlan:${input.resultWithoutAudit.selectedPlan?.id ?? "none"}`,
    `planner:${input.resultWithoutAudit.plannerInputResult.audit.stableInputFingerprint}`,
    `candidate:${input.resultWithoutAudit.candidateResult.audit.stableOutputFingerprint}`,
    `execution:${
      input.resultWithoutAudit.executionResult?.audit.stableExecutionFingerprint ?? "none"
    }`,
    `safeApply:${
      input.resultWithoutAudit.safeApplyResult?.audit.stableSafeApplyFingerprint ?? "none"
    }`,
    fingerprintHomeMapState(input.resultWithoutAudit.nextHomeMapState),
  ].join("::")
}

function fingerprintHomeMapState(homeMapState: ConstructionRuntimeCommitResult["nextHomeMapState"]): string {
  return [
    homeMapState.worldId,
    homeMapState.ownerId,
    homeMapState.seed,
    String(homeMapState.updatedAt),
    homeMapState.placements
      .map((placement) =>
        [
          placement.id,
          placement.layer,
          String(placement.x),
          String(placement.y),
          String(placement.alpha),
          placement.tags.slice().sort().join("+"),
        ].join(":")
      )
      .sort()
      .join("|"),
    homeMapState.mapDiffs
      .map((diff) => [diff.id, diff.operation, diff.placementId].join(":"))
      .sort()
      .join("|"),
  ].join("::")
}
