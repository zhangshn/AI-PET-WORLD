/**
 * 当前文件职责：审计 Construction SafeApply 的输入与输出边界。
 */

import type {
  HomeMapState,
  MapDiff,
} from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionSafeApplyAudit,
  ConstructionSafeApplyInput,
  ConstructionSafeApplyResult,
} from "./construction-schema"

export function auditConstructionSafeApplyResult(input: {
  safeApplyInput: ConstructionSafeApplyInput
  resultWithoutAudit: Omit<ConstructionSafeApplyResult, "audit">
}): ConstructionSafeApplyAudit {
  const acceptedDiffIds = input.resultWithoutAudit.acceptedDiffIds
  const rejectedDiffIds = input.resultWithoutAudit.rejectedDiffs.map(
    (diff) => diff.diffId
  )
  const warnings = [
    ...auditDiffIdCoverage({
      inputDiffs: input.safeApplyInput.executionResult.mapDiffs,
      acceptedDiffIds,
      rejectedDiffIds,
    }),
    ...auditDuplicateAcceptedDiffIds(acceptedDiffIds),
    ...auditStableHomeMapIdentity(input),
    ...auditUpdatedAt(input),
    ...auditActorPlacementUpdates(input),
  ]

  return {
    stableSafeApplyFingerprint: buildStableSafeApplyFingerprint(input),
    sourcePlanId: input.safeApplyInput.executionResult.audit.planId,
    acceptedDiffIds,
    rejectedDiffIds,
    warnings,
    tags: [
      "construction_safe_apply_audit",
      warnings.length === 0
        ? "construction_safe_apply_valid"
        : "construction_safe_apply_warning",
      "home_map_state_identity_checked",
      "map_diff_coverage_checked",
    ],
  }
}

function auditDiffIdCoverage(input: {
  inputDiffs: MapDiff[]
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
}): string[] {
  const inputIds = input.inputDiffs.map((diff) => diff.id)
  const inputIdSet = new Set(inputIds)
  const outputIds = [...input.acceptedDiffIds, ...input.rejectedDiffIds]
  const outputIdSet = new Set(outputIds)
  const warnings: string[] = []

  input.acceptedDiffIds.forEach((diffId) => {
    if (!inputIdSet.has(diffId)) {
      warnings.push(`acceptedDiffIds 包含非输入 diff：${diffId}`)
    }
  })

  input.rejectedDiffIds.forEach((diffId) => {
    if (!inputIdSet.has(diffId)) {
      warnings.push(`rejectedDiffIds 包含非输入 diff：${diffId}`)
    }
  })

  inputIds.forEach((diffId) => {
    if (!outputIdSet.has(diffId)) {
      warnings.push(`SafeApply 未覆盖输入 diff：${diffId}`)
    }
  })

  outputIds.forEach((diffId) => {
    const appearedInAccepted = input.acceptedDiffIds.includes(diffId)
    const appearedInRejected = input.rejectedDiffIds.includes(diffId)

    if (appearedInAccepted && appearedInRejected) {
      warnings.push(`同一 diff 不能同时 accepted 与 rejected：${diffId}`)
    }
  })

  return warnings
}

function auditDuplicateAcceptedDiffIds(acceptedDiffIds: string[]): string[] {
  const seen = new Set<string>()
  const warnings: string[] = []

  acceptedDiffIds.forEach((diffId) => {
    if (seen.has(diffId)) {
      warnings.push(`acceptedDiffIds 存在重复 diff：${diffId}`)
    }
    seen.add(diffId)
  })

  return warnings
}

function auditStableHomeMapIdentity(input: {
  safeApplyInput: ConstructionSafeApplyInput
  resultWithoutAudit: Omit<ConstructionSafeApplyResult, "audit">
}): string[] {
  const warnings: string[] = []
  const before = input.safeApplyInput.homeMapState
  const after = input.resultWithoutAudit.nextHomeMapState

  if (after.worldId !== before.worldId) {
    warnings.push("SafeApply 不能修改 HomeMapState.worldId。")
  }
  if (after.ownerId !== before.ownerId) {
    warnings.push("SafeApply 不能修改 HomeMapState.ownerId。")
  }
  if (after.seed !== before.seed) {
    warnings.push("SafeApply 不能修改 HomeMapState.seed。")
  }

  return warnings
}

function auditUpdatedAt(input: {
  safeApplyInput: ConstructionSafeApplyInput
  resultWithoutAudit: Omit<ConstructionSafeApplyResult, "audit">
}): string[] {
  return input.resultWithoutAudit.nextHomeMapState.updatedAt ===
    input.safeApplyInput.now
    ? []
    : ["SafeApply 后 nextHomeMapState.updatedAt 必须等于 input.now。"]
}

function auditActorPlacementUpdates(input: {
  safeApplyInput: ConstructionSafeApplyInput
  resultWithoutAudit: Omit<ConstructionSafeApplyResult, "audit">
}): string[] {
  const placementById = new Map(
    input.safeApplyInput.homeMapState.placements.map((placement) => [
      placement.id,
      placement,
    ])
  )

  return input.resultWithoutAudit.acceptedDiffIds.flatMap((diffId) => {
    const diff = input.safeApplyInput.executionResult.mapDiffs.find(
      (item) => item.id === diffId
    )
    const placement = diff ? placementById.get(diff.placementId) : undefined

    return placement?.layer === "actor"
      ? [`SafeApply 不能把 actor placement 当成建设更新对象：${diffId}`]
      : []
  })
}

function buildStableSafeApplyFingerprint(input: {
  safeApplyInput: ConstructionSafeApplyInput
  resultWithoutAudit: Omit<ConstructionSafeApplyResult, "audit">
}): string {
  const acceptedDiffIds = input.resultWithoutAudit.acceptedDiffIds
    .slice()
    .sort()
    .join("+")
  const rejectedDiffIds = input.resultWithoutAudit.rejectedDiffs
    .map((diff) => diff.diffId)
    .sort()
    .join("+")

  return [
    input.safeApplyInput.homeMapState.worldId,
    input.safeApplyInput.homeMapState.ownerId,
    input.safeApplyInput.homeMapState.seed,
    input.safeApplyInput.executionResult.audit.planId,
    String(input.safeApplyInput.now),
    `accepted:${acceptedDiffIds}`,
    `rejected:${rejectedDiffIds}`,
    fingerprintPlacements(input.resultWithoutAudit.nextHomeMapState),
    fingerprintMapDiffs(input.resultWithoutAudit.nextHomeMapState.mapDiffs),
  ].join("::")
}

function fingerprintPlacements(homeMapState: HomeMapState): string {
  return homeMapState.placements
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
    .join("|")
}

function fingerprintMapDiffs(mapDiffs: MapDiff[]): string {
  return mapDiffs
    .map((diff) =>
      [
        diff.id,
        diff.operation,
        diff.placementId,
        String(diff.createdAt),
        diff.tags.slice().sort().join("+"),
      ].join(":")
    )
    .sort()
    .join("|")
}
