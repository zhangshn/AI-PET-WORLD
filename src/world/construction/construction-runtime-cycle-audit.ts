/**
 * 当前文件职责：审计建设 runtime 调用边界输出。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type {
  HomeMapState,
  MapDiff,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionRuntimeCycleAudit,
  ConstructionRuntimeCycleInput,
  ConstructionRuntimeCycleResult,
} from "./construction-schema"

// These tokens are only used for V2.6 redline audit scans. They do not mean the current product supports these old routes.
const FORBIDDEN_RUNTIME_CYCLE_TOKENS = [
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

export function auditConstructionRuntimeCycle(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
}): ConstructionRuntimeCycleAudit {
  const acceptedDiffIds =
    input.resultWithoutAudit.worldLoopProtocolResult.safeApplyResult
      ?.acceptedDiffIds ?? []
  const rejectedDiffIds =
    input.resultWithoutAudit.worldLoopProtocolResult.safeApplyResult
      ?.rejectedDiffs.map((diff) => diff.diffId) ?? []
  const warnings = [
    ...auditStableHomeMapIdentity(input),
    ...auditProtocolLineage(input),
    ...auditPersistenceProposal(input),
    ...auditVisualRefreshSignal(input),
    ...auditAcceptedDiffLineage({ input, acceptedDiffIds }),
    ...auditChangedPlacementLineage(input),
    ...auditForbiddenTokens(input),
  ]

  return {
    stableRuntimeFingerprint: buildStableRuntimeFingerprint({
      input,
      acceptedDiffIds,
      rejectedDiffIds,
    }),
    sourceWorldId: input.runtimeInput.homeMapState.worldId,
    sourceOwnerId: input.runtimeInput.homeMapState.ownerId,
    selectedPlanId:
      input.resultWithoutAudit.worldLoopProtocolResult.audit.selectedPlanId,
    acceptedDiffIds,
    rejectedDiffIds,
    persistenceProposalId:
      input.resultWithoutAudit.persistenceProposal?.proposalId ?? null,
    visualRefreshSignalId:
      input.resultWithoutAudit.visualRefreshSignal?.signalId ?? null,
    warnings,
    tags: [
      "construction_runtime_cycle_audit",
      warnings.length === 0
        ? "construction_runtime_cycle_valid"
        : "construction_runtime_cycle_warning",
      "runtime_boundary_only",
      "no_direct_persistence",
      "no_ui_integration",
    ],
  }
}

function auditStableHomeMapIdentity(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
}): string[] {
  const before = input.runtimeInput.homeMapState
  const after = input.resultWithoutAudit.nextHomeMapState
  const warnings: string[] = []

  if (after.worldId !== before.worldId) {
    warnings.push("RuntimeCycle 不能修改 HomeMapState.worldId。")
  }
  if (after.ownerId !== before.ownerId) {
    warnings.push("RuntimeCycle 不能修改 HomeMapState.ownerId。")
  }
  if (after.seed !== before.seed) {
    warnings.push("RuntimeCycle 不能修改 HomeMapState.seed。")
  }

  return warnings
}

function auditProtocolLineage(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
}): string[] {
  const result = input.resultWithoutAudit
  const warnings: string[] = []

  if (result.nextHomeMapState !== result.worldLoopProtocolResult.nextHomeMapState) {
    warnings.push("RuntimeCycle.nextHomeMapState 必须来自 worldLoopProtocolResult。")
  }

  return warnings
}

function auditPersistenceProposal(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
}): string[] {
  const proposal = input.resultWithoutAudit.persistenceProposal
  const protocolWarnings =
    input.resultWithoutAudit.worldLoopProtocolResult.audit.warnings.length
  const warnings: string[] = []

  if (input.runtimeInput.persistenceMode === "proposal_only" && !proposal) {
    warnings.push("persistenceMode 为 proposal_only 时必须生成 persistenceProposal。")
  }

  if (input.runtimeInput.persistenceMode === "disabled" && proposal) {
    warnings.push("persistenceMode 为 disabled 时 persistenceProposal 必须为 null。")
  }

  if (proposal?.shouldPersist && protocolWarnings > 0) {
    warnings.push("worldLoopProtocolResult 有 warning 时 proposal 不能 shouldPersist。")
  }

  return warnings
}

function auditVisualRefreshSignal(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
}): string[] {
  const signal = input.resultWithoutAudit.visualRefreshSignal
  const protocolWarnings =
    input.resultWithoutAudit.worldLoopProtocolResult.audit.warnings.length
  const warnings: string[] = []

  if (input.runtimeInput.visualRefreshMode === "signal_only" && !signal) {
    warnings.push("visualRefreshMode 为 signal_only 时必须生成 visualRefreshSignal。")
  }

  if (input.runtimeInput.visualRefreshMode === "disabled" && signal) {
    warnings.push("visualRefreshMode 为 disabled 时 visualRefreshSignal 必须为 null。")
  }

  if (signal?.shouldRefresh && protocolWarnings > 0) {
    warnings.push("worldLoopProtocolResult 有 warning 时 signal 不能 shouldRefresh。")
  }

  return warnings
}

function auditAcceptedDiffLineage(input: {
  input: {
    runtimeInput: ConstructionRuntimeCycleInput
    resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
  }
  acceptedDiffIds: string[]
}): string[] {
  const safeApplyAcceptedDiffIds = new Set(
    input.input.resultWithoutAudit.worldLoopProtocolResult.safeApplyResult
      ?.acceptedDiffIds ?? []
  )

  return input.acceptedDiffIds.flatMap((diffId) =>
    safeApplyAcceptedDiffIds.has(diffId)
      ? []
      : [`acceptedDiffIds 必须来自 safeApplyResult：${diffId}`]
  )
}

function auditChangedPlacementLineage(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
}): string[] {
  const signal = input.resultWithoutAudit.visualRefreshSignal
  if (!signal) return []

  const changedPlacementIds = new Set(
    buildChangedPlacementIds(input.resultWithoutAudit)
  )

  return signal.changedPlacementIds.flatMap((placementId) =>
    changedPlacementIds.has(placementId)
      ? []
      : [`changedPlacementIds 必须来自 accepted diff 对应 placementId：${placementId}`]
  )
}

function buildChangedPlacementIds(
  result: Omit<ConstructionRuntimeCycleResult, "audit">
): string[] {
  const acceptedDiffIds = new Set(
    result.worldLoopProtocolResult.safeApplyResult?.acceptedDiffIds ?? []
  )

  return uniqueTags(
    (result.worldLoopProtocolResult.executionResult?.mapDiffs ?? [])
      .filter((diff) => acceptedDiffIds.has(diff.id))
      .map((diff) => diff.placementId)
  )
}

function auditForbiddenTokens(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
}): string[] {
  const tokens = [
    input.runtimeInput.runReason,
    ...input.runtimeInput.tags,
    ...input.resultWithoutAudit.tags,
    ...input.resultWithoutAudit.messages,
    ...(input.resultWithoutAudit.persistenceProposal
      ? [
          input.resultWithoutAudit.persistenceProposal.proposalId,
          input.resultWithoutAudit.persistenceProposal.reason,
          ...input.resultWithoutAudit.persistenceProposal.tags,
        ]
      : []),
    ...(input.resultWithoutAudit.visualRefreshSignal
      ? [
          input.resultWithoutAudit.visualRefreshSignal.signalId,
          input.resultWithoutAudit.visualRefreshSignal.reason,
          ...input.resultWithoutAudit.visualRefreshSignal.tags,
        ]
      : []),
    ...input.resultWithoutAudit.nextHomeMapState.placements.flatMap(
      collectPlacementTokens
    ),
    ...input.resultWithoutAudit.nextHomeMapState.mapDiffs.flatMap(
      collectMapDiffTokens
    ),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_RUNTIME_CYCLE_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`ConstructionRuntimeCycleResult 包含禁止 token：${token}`]
      : []
  )
}

function buildStableRuntimeFingerprint(input: {
  input: {
    runtimeInput: ConstructionRuntimeCycleInput
    resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit">
  }
  acceptedDiffIds: string[]
  rejectedDiffIds: string[]
}): string {
  const runtimeInput = input.input.runtimeInput
  const result = input.input.resultWithoutAudit

  return [
    runtimeInput.homeMapState.worldId,
    runtimeInput.homeMapState.ownerId,
    runtimeInput.homeMapState.seed,
    String(runtimeInput.now),
    runtimeInput.runReason,
    result.worldLoopProtocolResult.audit.selectedPlanId ?? "none",
    input.acceptedDiffIds.slice().sort().join("+"),
    input.rejectedDiffIds.slice().sort().join("+"),
    result.persistenceProposal?.proposalId ?? "none",
    result.visualRefreshSignal?.signalId ?? "none",
    fingerprintPlacements(result.nextHomeMapState),
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

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
