import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionFullPipelineAudit,
  ConstructionMemoryPersistenceMockResult,
  ConstructionRuntimeAdapterInput,
  ConstructionRuntimeCycleResult,
  ConstructionPainterRefreshBridgeResult,
} from "./construction-schema"

export function auditConstructionFullPipeline(input: {
  adapterInput: ConstructionRuntimeAdapterInput
  runtimeCycleResult: ConstructionRuntimeCycleResult
  memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
  painterRefreshBridgeResult: ConstructionPainterRefreshBridgeResult
}): ConstructionFullPipelineAudit {
  const acceptedDiffIds = input.runtimeCycleResult.audit.acceptedDiffIds
  const rejectedDiffIds = input.runtimeCycleResult.audit.rejectedDiffIds
  const warnings = [
    ...auditRuntimeLineage(input),
    ...auditMockPersistence(input),
    ...auditPainterRefreshBridge(input),
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
    shouldRefresh: input.painterRefreshBridgeResult.shouldRequestRefresh,
    warnings,
    tags: [
      "construction_full_pipeline_audit",
      warnings.length === 0
        ? "construction_full_pipeline_valid"
        : "construction_full_pipeline_warning",
      "vertical_slice_only",
      "no_external_runtime_loop_registration",
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
    warnings.push("完整建设流水线不能修改 worldId。")
  }
  if (before.ownerId !== after.ownerId) {
    warnings.push("完整建设流水线不能修改 ownerId。")
  }
  if (before.seed !== after.seed) {
    warnings.push("完整建设流水线不能修改 seed。")
  }
  if (input.runtimeCycleResult.audit.warnings.length > 0) {
    warnings.push("RuntimeCycle 审计仍然存在 warning。")
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
      ? ["没有 persistenceProposal 时，memory mock 不能执行存储。"]
      : []
  }

  if (
    input.memoryPersistenceMockResult.mode === "memory_commit" &&
    proposal.shouldPersist !== input.memoryPersistenceMockResult.didStore
  ) {
    return ["memory mock 的 didStore 必须与 proposal.shouldPersist 对齐。"]
  }

  if (
    input.memoryPersistenceMockResult.mode !== "memory_commit" &&
    input.memoryPersistenceMockResult.didStore
  ) {
    return ["memory mock 只有在 memory_commit 模式下才能存储。"]
  }

  return []
}

function auditPainterRefreshBridge(input: {
  runtimeCycleResult: ConstructionRuntimeCycleResult
  painterRefreshBridgeResult: ConstructionPainterRefreshBridgeResult
}): string[] {
  const signal = input.runtimeCycleResult.painterRefreshSignal

  if (!signal) {
    return input.painterRefreshBridgeResult.shouldRequestRefresh
      ? ["没有 painterRefreshSignal 时，Painter 刷新桥不能请求刷新。"]
      : []
  }

  if (signal.shouldRefresh !== input.painterRefreshBridgeResult.shouldRequestRefresh) {
    return ["Painter 刷新桥的 shouldRequestRefresh 必须与 signal.shouldRefresh 对齐。"]
  }

  return signal.changedPlacementIds.flatMap((placementId) =>
    input.painterRefreshBridgeResult.changedPlacementIds.includes(placementId)
      ? []
      : [`Painter 刷新桥缺少 changedPlacementId：${placementId}`]
  )
}

function buildStablePipelineFingerprint(input: {
  input: {
    adapterInput: ConstructionRuntimeAdapterInput
    runtimeCycleResult: ConstructionRuntimeCycleResult
    memoryPersistenceMockResult: ConstructionMemoryPersistenceMockResult
    painterRefreshBridgeResult: ConstructionPainterRefreshBridgeResult
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
    input.input.painterRefreshBridgeResult.bridgeId,
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
