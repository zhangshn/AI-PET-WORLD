/**
 * 当前文件职责：审计 ConstructionExecutor 输出的 MapDiff 候选。
 */

import type { MapDiff } from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionExecutionAudit,
  ConstructionExecutionInput,
  ConstructionExecutionResult,
} from "./construction-schema"

export function auditConstructionExecutionResult(input: {
  executionInput: ConstructionExecutionInput
  resultWithoutAudit: Omit<ConstructionExecutionResult, "audit">
}): ConstructionExecutionAudit {
  const warnings = [
    ...auditDuplicateMapDiffIds(input.resultWithoutAudit.mapDiffs),
    ...auditMapDiffPlacementReferences(input),
    ...auditMapDiffCreatedAt(input),
    ...auditMapDiffTags(input.resultWithoutAudit.mapDiffs),
    ...auditResourceTransactions(input.resultWithoutAudit),
    ...auditNextPlan(input),
  ]

  return {
    stableExecutionFingerprint: buildConstructionExecutionFingerprint(input),
    planId: input.executionInput.plan.id,
    mapDiffIds: input.resultWithoutAudit.mapDiffs.map((diff) => diff.id),
    warnings,
    tags: [
      "construction_execution_audit",
      warnings.length === 0
        ? "construction_execution_valid"
        : "construction_execution_warning",
      "map_diff_candidate_only",
      "no_direct_home_map_state_mutation",
    ],
  }
}

function auditResourceTransactions(
  result: Omit<ConstructionExecutionResult, "audit">
): string[] {
  if (result.nextPlan.resourceRequests.length === 0) {
    return [`ConstructionExecutionResult 缺少资源交易计划：${result.nextPlan.id}`]
  }

  if (result.resourceTransactions.length === 0) {
    return [`ConstructionExecutionResult 缺少资源交易结果：${result.nextPlan.id}`]
  }

  return result.resourceTransactions.flatMap((transaction) => {
    const warnings: string[] = []

    if (!transaction.transactionId.trim()) warnings.push("资源交易缺少 transactionId。")
    if (!transaction.reason.trim()) warnings.push("资源交易缺少 reason。")
    if (transaction.after < 0) {
      warnings.push(`资源交易不能扣成负数：${transaction.transactionId}`)
    }

    return warnings
  })
}

function auditDuplicateMapDiffIds(mapDiffs: MapDiff[]): string[] {
  const seen = new Set<string>()
  const warnings: string[] = []

  mapDiffs.forEach((diff) => {
    if (seen.has(diff.id)) {
      warnings.push(`重复 MapDiff id：${diff.id}`)
    }
    seen.add(diff.id)
  })

  return warnings
}

function auditMapDiffPlacementReferences(input: {
  executionInput: ConstructionExecutionInput
  resultWithoutAudit: Omit<ConstructionExecutionResult, "audit">
}): string[] {
  const knownPlacementIds = new Set(
    input.executionInput.homeMapState.placements.map((placement) => placement.id)
  )

  return input.resultWithoutAudit.mapDiffs.flatMap((diff) => {
    if (diff.operation === "add") {
      return diff.placement ? [] : [`add MapDiff 缺少 placement：${diff.id}`]
    }

    return knownPlacementIds.has(diff.placementId)
      ? []
      : [`MapDiff 引用了不存在的 placement：${diff.id} / ${diff.placementId}`]
  })
}

function auditMapDiffCreatedAt(input: {
  executionInput: ConstructionExecutionInput
  resultWithoutAudit: Omit<ConstructionExecutionResult, "audit">
}): string[] {
  return input.resultWithoutAudit.mapDiffs.flatMap((diff) =>
    diff.createdAt === input.executionInput.now
      ? []
      : [`MapDiff.createdAt 必须等于 input.now：${diff.id}`]
  )
}

function auditMapDiffTags(mapDiffs: MapDiff[]): string[] {
  return mapDiffs.flatMap((diff) =>
    diff.tags.includes("construction_execution_candidate")
      ? []
      : [`MapDiff 缺少 construction_execution_candidate tag：${diff.id}`]
  )
}

function auditNextPlan(input: {
  executionInput: ConstructionExecutionInput
  resultWithoutAudit: Omit<ConstructionExecutionResult, "audit">
}): string[] {
  return input.resultWithoutAudit.nextPlan.id === input.executionInput.plan.id
    ? []
    : [
        `nextPlan.id 必须等于输入 plan.id：${input.resultWithoutAudit.nextPlan.id}`,
      ]
}

function buildConstructionExecutionFingerprint(input: {
  executionInput: ConstructionExecutionInput
  resultWithoutAudit: Omit<ConstructionExecutionResult, "audit">
}): string {
  return [
    input.executionInput.homeMapState.worldId,
    input.executionInput.plan.id,
    input.executionInput.plan.projectType,
    input.executionInput.plan.targetZoneType,
    input.executionInput.plan.currentStage,
    String(input.executionInput.now),
    fingerprintPlan(input.resultWithoutAudit.nextPlan),
    input.resultWithoutAudit.resourceTransactions
      .map((transaction) =>
        [
          transaction.transactionId,
          transaction.resourceKey,
          transaction.amount,
          transaction.before,
          transaction.after,
          transaction.status,
        ].join(":")
      )
      .sort()
      .join("|"),
    input.resultWithoutAudit.mapDiffs.map(fingerprintMapDiff).sort().join("|"),
    input.resultWithoutAudit.tags.slice().sort().join("+"),
  ].join("::")
}

function fingerprintPlan(plan: ConstructionExecutionResult["nextPlan"]): string {
  return [
    plan.id,
    plan.status,
    plan.currentStage,
    String(plan.updatedAt),
    plan.stages
      .map((stage) =>
        [
          stage.id,
          stage.type,
          String(stage.progress),
          stage.completed ? "completed" : "pending",
          stage.mapDiffIds.slice().sort().join("+"),
        ].join(":")
      )
      .join("|"),
  ].join("::")
}

function fingerprintMapDiff(diff: MapDiff): string {
  return [
    diff.id,
    diff.operation,
    diff.placementId,
    String(diff.createdAt),
    diff.reason,
    diff.patch?.alpha === undefined ? "alpha:none" : `alpha:${diff.patch.alpha}`,
    diff.patch?.tags ? diff.patch.tags.slice().sort().join("+") : "tags:none",
    diff.tags.slice().sort().join("+"),
  ].join(":")
}
