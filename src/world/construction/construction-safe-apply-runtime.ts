/**
 * 当前文件职责：验证并安全应用建设 MapDiff 候选，支持管家建设 add/update。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import { buildWorldEcologyState } from "@/world/ecology/world-ecology-state"
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

// These tokens are only used for V2.6 redline audit scans. They do not mean the current product supports these old routes.
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
      "world_ecology_state_refreshed",
      "butler_construction_add_supported",
      "no_ui_integration",
      "no_world_loop_integration",
      "no_default_adoption_entry",
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

  if (!input.diff.tags.includes("construction_execution_candidate")) {
    return "MapDiff 缺少 construction_execution_candidate tag。"
  }

  if (containsForbiddenToken(collectMapDiffTokens(input.diff))) {
    return "MapDiff 包含当前正式链路禁止 token。"
  }

  if (input.diff.operation === "add") {
    return validateAddDiff({
      homeMapState: input.input.homeMapState,
      diff: input.diff,
    })
  }

  if (input.diff.operation === "update") {
    return validateUpdateDiff({
      homeMapState: input.input.homeMapState,
      diff: input.diff,
    })
  }

  if (input.diff.operation === "remove") {
    return "SafeApply 暂不允许 remove MapDiff，避免误删世界事实。"
  }

  return `SafeApply 暂不允许 ${input.diff.operation} MapDiff。`
}

function validateAddDiff(input: {
  homeMapState: HomeMapState
  diff: MapDiff
}): string | null {
  if (!input.diff.placement) {
    return "add MapDiff 必须包含 placement。"
  }

  if (!input.diff.placementId.trim()) {
    return "add MapDiff 缺少 placementId。"
  }

  if (input.diff.placement.id !== input.diff.placementId) {
    return "add MapDiff 的 placement.id 必须等于 placementId。"
  }

  if (!input.diff.tags.includes("butler_adds_construction_fact")) {
    return "add MapDiff 必须来自管家建设事实写入链路。"
  }

  if (input.diff.placement.source !== "construction_plan") {
    return "add placement 必须来自 construction_plan。"
  }

  if (!input.diff.placement.tags.includes("butler_construction_result")) {
    return "add placement 必须标记为 butler_construction_result。"
  }

  if (input.diff.placement.tags.includes("not_initial_world_fact") === false) {
    return "add placement 必须标记为 not_initial_world_fact。"
  }

  if (input.diff.placement.layer === "actor") {
    return "SafeApply 不允许通过建设 add actor placement。"
  }

  if (
    input.homeMapState.placements.some(
      (placement) => placement.id === input.diff.placementId
    )
  ) {
    return "add MapDiff 的 placementId 已存在。"
  }

  return validatePlacement(input.homeMapState, input.diff.placement)
}

function validateUpdateDiff(input: {
  homeMapState: HomeMapState
  diff: MapDiff
}): string | null {
  if (!input.diff.placementId.trim()) {
    return "update MapDiff 缺少 placementId。"
  }

  const placement = input.homeMapState.placements.find(
    (item) => item.id === input.diff.placementId
  )

  if (!placement) {
    return "update MapDiff 引用了不存在的 placement。"
  }

  if (placement.layer === "actor") {
    return "SafeApply 不允许把 actor placement 当成建设更新对象。"
  }

  return validatePatch({
    homeMapState: input.homeMapState,
    diff: input.diff,
  })
}

function validatePlacement(
  homeMapState: HomeMapState,
  placement: MapPlacement
): string | null {
  if (!isWithinRange(placement.x, 0, homeMapState.mapSize.columns)) {
    return "add placement.x 超出 mapSize 范围。"
  }

  if (!isWithinRange(placement.y, 0, homeMapState.mapSize.rows)) {
    return "add placement.y 超出 mapSize 范围。"
  }

  if (placement.scale <= 0) {
    return "add placement.scale 必须大于 0。"
  }

  if (!isWithinRange(placement.alpha, 0, 1)) {
    return "add placement.alpha 必须在 0 到 1。"
  }

  if (containsForbiddenToken(collectPlacementTokens(placement))) {
    return "add placement 包含当前正式链路禁止 token。"
  }

  return null
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
  const updatedPlacements = input.homeMapState.placements.map((placement) =>
    applyUpdateMapDiffsToPlacement({
      placement,
      acceptedDiffs: input.acceptedDiffs,
    })
  )
  const addedPlacements = input.acceptedDiffs.flatMap((diff) =>
    diff.operation === "add" && diff.placement ? [diff.placement] : []
  )
  const nextHomeMapStateWithoutEcology: HomeMapState = {
    ...input.homeMapState,
    placements: [...updatedPlacements, ...addedPlacements],
    constructionPlans: input.homeMapState.constructionPlans.map((plan) =>
      plan.id === input.nextPlan.id
        ? {
            ...plan,
            status: input.nextPlan.status,
            progress: calculatePlanProgress(input.nextPlan),
            reason: input.nextPlan.reason,
            houseStyle: input.nextPlan.houseStyle,
            styleReason: input.nextPlan.styleReason,
            styleTags: input.nextPlan.styleTags,
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
    houseStyle:
      input.acceptedDiffs.length > 0
        ? input.nextPlan.houseStyle
        : input.homeMapState.houseStyle,
    houseStyleHistory:
      input.acceptedDiffs.length > 0
        ? [
            ...(input.homeMapState.houseStyleHistory ?? []),
            input.nextPlan.houseStyle,
          ].slice(-12)
        : input.homeMapState.houseStyleHistory,
    updatedAt: input.now,
    tags: uniqueTags([
      ...input.homeMapState.tags,
      "construction_safe_apply_v1",
      "map_diff_validated",
      addedPlacements.length > 0
        ? "butler_construction_fact_added"
        : "construction_safe_apply_no_add",
    ]),
  }
  const ecologyState = buildWorldEcologyState({
    homeMapState: nextHomeMapStateWithoutEcology,
    generatedAt: input.now,
  })

  return {
    ...nextHomeMapStateWithoutEcology,
    ecologyState,
    tags: uniqueTags([
      ...nextHomeMapStateWithoutEcology.tags,
      "world_ecology_state_refreshed",
      ecologyState.status,
      ecologyState.biomeType,
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
  const addCount = input.acceptedDiffs.filter((diff) => diff.operation === "add")
    .length
  const updateCount = input.acceptedDiffs.filter(
    (diff) => diff.operation === "update"
  ).length

  return [
    `SafeApply 接受 ${input.acceptedDiffs.length} 个 MapDiff。`,
    `其中新增 ${addCount} 个，更新 ${updateCount} 个。`,
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
    ...(diff.placement ? collectPlacementTokens(diff.placement) : []),
  ]
}

function collectPlacementTokens(placement: MapPlacement): string[] {
  return [
    placement.id,
    placement.assetId,
    placement.layer,
    placement.label,
    placement.source,
    ...placement.tags,
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
