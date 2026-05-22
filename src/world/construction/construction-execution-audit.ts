/**
 * 当前文件职责：审计 ConstructionExecutor 输出的 MapDiff 候选。
 */

import type { MapDiff } from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionExecutionAudit,
  ConstructionExecutionInput,
  ConstructionExecutionResult,
} from "./construction-schema"

const FORBIDDEN_CONSTRUCTION_EXECUTION_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet-near-arrival-point",
  "pet-bed",
  "pet_actor",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

export function auditConstructionExecutionResult(input: {
  executionInput: ConstructionExecutionInput
  resultWithoutAudit: Omit<ConstructionExecutionResult, "audit">
}): ConstructionExecutionAudit {
  const warnings = [
    ...auditDuplicateMapDiffIds(input.resultWithoutAudit.mapDiffs),
    ...auditMapDiffPlacementReferences(input),
    ...auditMapDiffCreatedAt(input),
    ...auditMapDiffTags(input.resultWithoutAudit.mapDiffs),
    ...auditNextPlan(input),
    ...auditForbiddenTokens(input),
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
      return auditAddDiffBoundary(diff)
    }

    return knownPlacementIds.has(diff.placementId)
      ? []
      : [`MapDiff 引用了不存在的 placement：${diff.id} / ${diff.placementId}`]
  })
}

function auditAddDiffBoundary(diff: MapDiff): string[] {
  const warnings: string[] = []

  if (!diff.placement) {
    warnings.push(`add MapDiff 缺少 placement：${diff.id}`)
  }
  if (containsForbiddenToken(collectMapDiffTokens(diff))) {
    warnings.push(`add MapDiff 包含旧路线 token：${diff.id}`)
  }

  return warnings
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

function auditForbiddenTokens(input: {
  executionInput: ConstructionExecutionInput
  resultWithoutAudit: Omit<ConstructionExecutionResult, "audit">
}): string[] {
  const tokens = [
    input.executionInput.plan.id,
    input.executionInput.plan.projectType,
    input.executionInput.plan.title,
    input.executionInput.plan.reason,
    input.executionInput.plan.targetZoneType,
    ...input.executionInput.plan.tags,
    ...input.resultWithoutAudit.tags,
    ...input.resultWithoutAudit.messages,
    ...input.resultWithoutAudit.mapDiffs.flatMap(collectMapDiffTokens),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_CONSTRUCTION_EXECUTION_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`ConstructionExecutionResult 包含禁止 token：${token}`]
      : []
  )
}

function containsForbiddenToken(tokens: string[]): boolean {
  const normalizedTokens = tokens.map((token) => token.toLowerCase())

  return FORBIDDEN_CONSTRUCTION_EXECUTION_TOKENS.some((token) =>
    normalizedTokens.some((item) => item.includes(token))
  )
}

function collectMapDiffTokens(diff: MapDiff): string[] {
  return [
    diff.id,
    diff.operation,
    diff.placementId,
    diff.reason,
    ...diff.tags,
    ...(diff.patch?.label ? [diff.patch.label] : []),
    ...(diff.patch?.tags ?? []),
    ...(diff.placement
      ? [
          diff.placement.id,
          diff.placement.assetId,
          diff.placement.layer,
          diff.placement.label,
          ...diff.placement.tags,
        ]
      : []),
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
