/**
 * 当前文件职责：审计建设系统可运行纵向闭环输出。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type {
  HomeMapState,
  MapDiff,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionFullPipelineAudit,
  ConstructionMemoryPersistenceMockResult,
  ConstructionRuntimeAdapterInput,
  ConstructionRuntimeCycleResult,
  ConstructionVisualRefreshBridgeResult,
} from "./construction-schema"

const FORBIDDEN_FULL_PIPELINE_TOKENS = [
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

export function auditConstructionFullPipeline(input: {
  adapterInput: ConstructionRuntimeAdapterInput
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
}): ConstructionFullPipelineAudit {
  const acceptedDiffIds =
    input.runtimeCycleResult.audit.acceptedDiffIds
  const rejectedDiffIds =
    input.runtimeCycleResult.audit.rejectedDiffIds
  const warnings = [
    ...auditRuntimeLineage(input),
    ...auditMockPersistence(input),
    ...auditVisualBridge(input),
    ...auditForbiddenTokens(input),
  ]

  return {
    stablePipelineFingerprint: buildStablePipelineFingerprint({
      input,
      acceptedDiffIds,
      rejectedDiffIds,
    }),
    worldId: input.adapterInput.homeMapState.worldId,
    ownerId: input.adapterInput.homeMapState.ownerId,
    selectedPlanId: input.runtimeCycleResult.audit.selectedPlanId,
    acceptedDiffIds,
    rejectedDiffIds,
    shouldPersist: input.memoryPersistenceMockResult.didStore,
    shouldRefresh: input.visualRefreshBridgeResult.shouldRequestRefresh,
    warnings,
    tags: [
      "construction_full_pipeline_audit",
      warnings.length === 0
        ? "construction_full_pipeline_valid"
        : "construction_full_pipeline_warning",
      "vertical_slice_only",
      "no_real_world_loop_registration",
      "no_real_persistence",
      "no_ui_render",
    ],
  }
}

function auditRuntimeLineage(input: {
  adapterInput: ConstructionRuntimeAdapterInput
  runtimeCycleResult: ConstructionRuntimeCycleResult
}): string[] {
  const warnings: string[] = []
  const before = input.adapterInput.homeMapState
  const after = input.runtimeCycleResult.nextHomeMapState

  if (before.worldId !== after.worldId) {
    warnings.push("FullPipeline 不能修改 worldId。")
  }
  if (before.ownerId !== after.ownerId) {
    warnings.push("FullPipeline 不能修改 ownerId。")
  }
  if (before.seed !== after.seed) {
    warnings.push("FullPipeline 不能修改 seed。")
  }
  if (input.runtimeCycleResult.audit.warnings.length > 0) {
    warnings.push("RuntimeCycle audit 仍有 warning。")
  }

  return warnings
}

function auditMockPersistence(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
}): string[] {
  const proposal = input.runtimeCycleResult.persistenceProposal

  if (!proposal) {
    return input.memoryPersistenceMockResult.didStore
      ? ["没有 persistenceProposal 时 memory mock 不能 didStore。"]
      : []
  }

  if (
    input.memoryPersistenceMockResult.mode === "memory_commit" &&
    proposal.shouldPersist !== input.memoryPersistenceMockResult.didStore
  ) {
    return ["memory mock didStore 必须与 proposal.shouldPersist 对齐。"]
  }

  if (
    input.memoryPersistenceMockResult.mode !== "memory_commit" &&
    input.memoryPersistenceMockResult.didStore
  ) {
    return ["memory mock 只有 memory_commit 模式可以 didStore。"]
  }

  return []
}

function auditVisualBridge(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
}): string[] {
  const signal = input.runtimeCycleResult.visualRefreshSignal

  if (!signal) {
    return input.visualRefreshBridgeResult.shouldRequestRefresh
      ? ["没有 visualRefreshSignal 时 bridge 不能 shouldRequestRefresh。"]
      : []
  }

  if (signal.shouldRefresh !== input.visualRefreshBridgeResult.shouldRequestRefresh) {
    return ["visual bridge shouldRequestRefresh 必须与 signal.shouldRefresh 对齐。"]
  }

  return signal.changedPlacementIds.flatMap((placementId) =>
    input.visualRefreshBridgeResult.changedPlacementIds.includes(placementId)
      ? []
      : [`visual bridge 缺少 changedPlacementId：${placementId}`]
  )
}

function auditForbiddenTokens(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
}): string[] {
  const tokens = [
    ...input.runtimeCycleResult.tags,
    ...input.runtimeCycleResult.messages,
    ...input.memoryPersistenceMockResult.tags,
    input.memoryPersistenceMockResult.reason,
    ...input.visualRefreshBridgeResult.tags,
    input.visualRefreshBridgeResult.reason,
    ...input.runtimeCycleResult.nextHomeMapState.placements.flatMap(
      collectPlacementTokens
    ),
    ...input.runtimeCycleResult.nextHomeMapState.mapDiffs.flatMap(
      collectMapDiffTokens
    ),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_FULL_PIPELINE_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`Construction full pipeline 包含禁止 token：${token}`]
      : []
  )
}

function buildStablePipelineFingerprint(input: {
  input: {
    adapterInput: ConstructionRuntimeAdapterInput
    runtimeCycleResult: ConstructionRuntimeCycleResult
    memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
    visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
  }
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
}): string {
  return [
    input.input.adapterInput.homeMapState.worldId,
    input.input.adapterInput.homeMapState.ownerId,
    input.input.adapterInput.homeMapState.seed,
    String(input.input.adapterInput.now),
    input.input.adapterInput.runReason,
    input.input.runtimeCycleResult.audit.selectedPlanId ?? "none",
    input.acceptedDiffIds.slice().sort().join("+"),
    input.rejectedDiffIds.slice().sort().join("+"),
    input.input.memoryPersistenceMockResult.mockPersistenceId,
    input.input.visualRefreshBridgeResult.bridgeId,
    fingerprintPlacements(input.input.runtimeCycleResult.nextHomeMapState),
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

function collectPlacementTokens(placement: MapPlacement): string[] {
  return [
    placement.id,
    placement.assetId,
    placement.layer,
    placement.label,
    ...placement.tags,
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
