/**
 * 当前文件职责：验证并安全应用建设 MapDiff 候选。
 */

import type {
  HomeMapState,
  MapDiff,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import {
  auditResourcePoolState,
  resourcePoolToHomeResourceSnapshot,
} from "@/world/resource-cycle/resource-cycle"

import { auditConstructionSafeApplyResult } from "./construction-safe-apply-audit"
import type {
  ConstructionPlan,
  ConstructionSafeApplyInput,
  ConstructionSafeApplyRejectedDiff,
  ConstructionSafeApplyResult,
} from "./construction-schema"

const FORBIDDEN_SAFE_APPLY_TOKENS = [
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

export function buildConstructionSafeApplyResult(
  input: ConstructionSafeApplyInput
): ConstructionSafeApplyResult {
  const validationResults = input.executionResult.mapDiffs.map((diff) =>
    validateMapDiffForSafeApply({ input, diff })
  )
  const acceptedDiffs = validationResults.flatMap((result) =>
    result.acceptedDiff ? [result.acceptedDiff] : []
  )
  const rejectedDiffs = validationResults.flatMap((result) =>
    result.rejectedDiff ? [result.rejectedDiff] : []
  )
  const nextHomeMapState = applyAcceptedMapDiffs({
    homeMapState: input.homeMapState,
    acceptedDiffs,
    nextPlan: input.executionResult.nextPlan,
    resourceCycleResult: input.executionResult.resourceCycleResult,
    now: input.now,
  })
  const resultWithoutAudit: Omit<ConstructionSafeApplyResult, "audit"> = {
    nextHomeMapState,
    acceptedDiffIds: acceptedDiffs.map((diff) => diff.id),
    rejectedDiffs,
    messages: buildSafeApplyMessages({
      acceptedDiffs,
      rejectedDiffs,
    }),
    tags: [
      "construction_safe_apply_result",
      "map_diff_validated",
      "home_map_state_immutable_update",
      "no_ui_integration",
      "no_world_loop_integration",
      "no_default_companion_entry",
    ],
  }
  const audit = auditConstructionSafeApplyResult({
    safeApplyInput: input,
    resultWithoutAudit,
  })

  return {
    ...resultWithoutAudit,
    audit,
  }
}

function validateMapDiffForSafeApply(input: {
  input: ConstructionSafeApplyInput
  diff: MapDiff
}): {
  acceptedDiff?: MapDiff
  rejectedDiff?: ConstructionSafeApplyRejectedDiff
} {
  const rejectionReason = getMapDiffRejectionReason(input)

  if (rejectionReason) {
    return {
      rejectedDiff: buildRejectedDiff({
        diff: input.diff,
        reason: rejectionReason,
      }),
    }
  }

  return {
    acceptedDiff: input.diff,
  }
}

function getMapDiffRejectionReason(input: {
  input: ConstructionSafeApplyInput
  diff: MapDiff
}): string | null {
  if (!input.input.executionResult.audit.tags.includes("construction_execution_audit")) {
    return "MapDiff 必须来自已审计的 ConstructionExecutionResult。"
  }

  if (input.input.executionResult.audit.warnings.length > 0) {
    return "ConstructionExecutionResult audit 存在 warning，SafeApply 暂不接受。"
  }

  if (!input.input.executionResult.audit.mapDiffIds.includes(input.diff.id)) {
    return "MapDiff 不在 ConstructionExecutionAudit.mapDiffIds 中。"
  }

  if (input.diff.operation === "add") {
    return "CONSTRUCTION-03 暂不允许 add MapDiff，避免绕过世界生成与 PlacementRules。"
  }

  if (input.diff.operation === "remove") {
    return "CONSTRUCTION-03 暂不允许 remove MapDiff，避免误删世界事实。"
  }

  if (input.diff.operation !== "update") {
    return `CONSTRUCTION-03 暂不允许 ${input.diff.operation} MapDiff。`
  }

  if (!input.diff.placementId.trim()) {
    return "update MapDiff 缺少 placementId。"
  }

  if (!input.diff.tags.includes("construction_execution_candidate")) {
    return "MapDiff 缺少 construction_execution_candidate tag。"
  }

  const placement = input.input.homeMapState.placements.find(
    (item) => item.id === input.diff.placementId
  )

  if (!placement) {
    return "update MapDiff 引用了不存在的 placement。"
  }

  if (placement.layer === "actor") {
    return "CONSTRUCTION-03 不允许把 actor placement 当成建设更新对象。"
  }

  if (containsForbiddenToken(collectMapDiffTokens(input.diff))) {
    return "MapDiff 包含当前正式链路禁止 token。"
  }

  return validatePatch({
    homeMapState: input.input.homeMapState,
    diff: input.diff,
  })
}

function validatePatch(input: {
  homeMapState: HomeMapState
  diff: MapDiff
}): string | null {
  const patch = input.diff.patch

  if (!patch) return null

  if (patch.alpha !== undefined && !isWithinRange(patch.alpha, 0, 1)) {
    return "patch.alpha 必须在 0 到 1。"
  }

  if (patch.scale !== undefined && patch.scale <= 0) {
    return "patch.scale 必须大于 0。"
  }

  if (
    patch.x !== undefined &&
    !isWithinRange(patch.x, 0, input.homeMapState.mapSize.columns)
  ) {
    return "patch.x 超出 mapSize 范围。"
  }

  if (
    patch.y !== undefined &&
    !isWithinRange(patch.y, 0, input.homeMapState.mapSize.rows)
  ) {
    return "patch.y 超出 mapSize 范围。"
  }

  if (patch.tags && containsForbiddenToken(patch.tags)) {
    return "patch.tags 包含当前正式链路禁止 token。"
  }

  if (patch.label && containsForbiddenToken([patch.label])) {
    return "patch.label 包含当前正式链路禁止 token。"
  }

  return null
}

function applyAcceptedMapDiffs(input: {
  homeMapState: HomeMapState
  acceptedDiffs: MapDiff[]
  nextPlan: ConstructionPlan
  resourceCycleResult: ConstructionSafeApplyInput["executionResult"]["resourceCycleResult"]
  now: number
}): HomeMapState {
  const acceptedResourceState = buildAcceptedResourceState(input)

  return {
    ...input.homeMapState,
    placements: input.homeMapState.placements.map((placement) =>
      applyUpdateMapDiffsToPlacement({
        placement,
        acceptedDiffs: input.acceptedDiffs,
      })
    ),
    constructionPlans: input.homeMapState.constructionPlans.map((plan) =>
      plan.id === input.nextPlan.id
        ? {
            ...plan,
            status: input.nextPlan.status,
            progress: calculatePlanProgress(input.nextPlan),
            reason: input.nextPlan.reason,
            tags: uniqueTags([
              ...plan.tags,
              ...input.nextPlan.tags,
              "construction_safe_apply_updated",
            ]),
          }
        : plan
    ),
    mapDiffs: [...input.homeMapState.mapDiffs, ...input.acceptedDiffs],
    resources: acceptedResourceState,
    updatedAt: input.now,
    tags: uniqueTags([
      ...input.homeMapState.tags,
      "construction_safe_apply_v0",
      "map_diff_validated",
    ]),
  }
}

function buildAcceptedResourceState(input: {
  homeMapState: HomeMapState
  acceptedDiffs: MapDiff[]
  nextPlan: ConstructionPlan
  resourceCycleResult: ConstructionSafeApplyInput["executionResult"]["resourceCycleResult"]
}): HomeMapState["resources"] {
  if (input.acceptedDiffs.length === 0) {
    return input.homeMapState.resources
  }

  const resourcePoolState = input.resourceCycleResult?.resourcePool
  const resourceTransactions = input.resourceCycleResult?.transactions ?? []

  if (!resourcePoolState || input.nextPlan.status === "paused") {
    return input.homeMapState.resources
  }

  return {
    ...input.homeMapState.resources,
    ...resourcePoolToHomeResourceSnapshot(resourcePoolState),
    resourcePoolState,
    recentTransactions: [
      ...(input.homeMapState.resources.recentTransactions ?? []),
      ...resourceTransactions,
    ].slice(-20),
    resourceAudit: auditResourcePoolState(resourcePoolState),
    tags: uniqueTags([
      ...input.homeMapState.resources.tags,
      "construction_resource_transaction_applied",
      `construction_plan:${input.nextPlan.id}`,
    ]),
  }
}

function applyUpdateMapDiffsToPlacement(input: {
  placement: MapPlacement
  acceptedDiffs: MapDiff[]
}): MapPlacement {
  return input.acceptedDiffs
    .filter((diff) => diff.operation === "update")
    .filter((diff) => diff.placementId === input.placement.id)
    .reduce(applyUpdateMapDiff, input.placement)
}

function applyUpdateMapDiff(placement: MapPlacement, diff: MapDiff): MapPlacement {
  const patch = diff.patch

  if (!patch) return placement

  return {
    ...placement,
    x: patch.x ?? placement.x,
    y: patch.y ?? placement.y,
    scale: patch.scale ?? placement.scale,
    alpha: patch.alpha ?? placement.alpha,
    label: patch.label ?? placement.label,
    tags: patch.tags ? uniqueTags(patch.tags) : placement.tags,
  }
}

function calculatePlanProgress(plan: ConstructionPlan): number {
  if (plan.stages.length === 0) return 0

  const totalProgress = plan.stages.reduce(
    (total, stage) => total + stage.progress,
    0
  )

  return Math.round(totalProgress / plan.stages.length)
}

function buildRejectedDiff(input: {
  diff: MapDiff
  reason: string
}): ConstructionSafeApplyRejectedDiff {
  return {
    diffId: input.diff.id,
    reason: input.reason,
    tags: [
      "construction_safe_apply_rejected",
      `operation:${input.diff.operation}`,
      `placement:${input.diff.placementId}`,
    ],
  }
}

function buildSafeApplyMessages(input: {
  acceptedDiffs: MapDiff[]
  rejectedDiffs: ConstructionSafeApplyRejectedDiff[]
}): string[] {
  return [
    `SafeApply 接受 ${input.acceptedDiffs.length} 个 MapDiff。`,
    `SafeApply 拒绝 ${input.rejectedDiffs.length} 个 MapDiff。`,
  ]
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

function containsForbiddenToken(tokens: string[]): boolean {
  const normalizedTokens = tokens.map((token) => token.toLowerCase())

  return FORBIDDEN_SAFE_APPLY_TOKENS.some((token) =>
    normalizedTokens.some((item) => item.includes(token))
  )
}

function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
