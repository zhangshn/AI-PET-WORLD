/**
 * 当前文件职责：根据建设协议结果生成视觉刷新前信号。
 */

import type {
  ConstructionRuntimeCycleInput,
  ConstructionVisualRefreshSignal,
  ConstructionWorldLoopProtocolResult,
} from "./construction-schema"

export function buildConstructionVisualRefreshSignal(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  worldLoopProtocolResult: ConstructionWorldLoopProtocolResult
}): ConstructionVisualRefreshSignal | null {
  if (input.runtimeInput.visualRefreshMode === "disabled") {
    return null
  }

  const safeApplyResult = input.worldLoopProtocolResult.safeApplyResult
  const acceptedDiffIds = safeApplyResult?.acceptedDiffIds ?? []
  const sourcePlanId = input.worldLoopProtocolResult.selectedPlan?.id ?? null
  const changedPlacementIds = buildChangedPlacementIds(input.worldLoopProtocolResult)
  const shouldRefresh =
    input.worldLoopProtocolResult.audit.warnings.length === 0 &&
    Boolean(safeApplyResult) &&
    (safeApplyResult?.audit.warnings.length ?? 0) === 0 &&
    acceptedDiffIds.length > 0

  return {
    signalId: buildVisualRefreshSignalId({
      worldId: input.runtimeInput.homeMapState.worldId,
      now: input.runtimeInput.now,
      sourcePlanId,
    }),
    worldId: input.runtimeInput.homeMapState.worldId,
    ownerId: input.runtimeInput.homeMapState.ownerId,
    sourcePlanId,
    shouldRefresh,
    acceptedDiffIds,
    changedPlacementIds,
    reason: buildVisualRefreshReason({
      shouldRefresh,
      acceptedDiffIds,
      protocolWarnings: input.worldLoopProtocolResult.audit.warnings.length,
      safeApplyWarnings: safeApplyResult?.audit.warnings.length ?? 0,
      hasSafeApplyResult: Boolean(safeApplyResult),
    }),
    tags: [
      "construction_visual_refresh_signal",
      "signal_only",
      "no_world_projection_mutation",
      "no_ui_render",
      `run_reason:${input.runtimeInput.runReason}`,
    ],
  }
}

function buildChangedPlacementIds(
  worldLoopProtocolResult: ConstructionWorldLoopProtocolResult
): string[] {
  const acceptedDiffIds = new Set(
    worldLoopProtocolResult.safeApplyResult?.acceptedDiffIds ?? []
  )

  return uniqueTags(
    (worldLoopProtocolResult.executionResult?.mapDiffs ?? [])
      .filter((diff) => acceptedDiffIds.has(diff.id))
      .map((diff) => diff.placementId)
  )
}

function buildVisualRefreshSignalId(input: {
  worldId: string
  now: number
  sourcePlanId: string | null
}): string {
  return [
    "construction-visual-refresh",
    normalizeIdToken(input.worldId),
    String(input.now),
    normalizeIdToken(input.sourcePlanId ?? "none"),
  ].join("-")
}

function buildVisualRefreshReason(input: {
  shouldRefresh: boolean
  acceptedDiffIds: string[]
  protocolWarnings: number
  safeApplyWarnings: number
  hasSafeApplyResult: boolean
}): string {
  if (input.shouldRefresh) {
    return `建议刷新视觉链路：SafeApply 已接受 ${input.acceptedDiffIds.length} 个 MapDiff。`
  }

  if (!input.hasSafeApplyResult) {
    return "不建议刷新视觉链路：本轮没有 SafeApply 结果。"
  }

  if (input.protocolWarnings > 0 || input.safeApplyWarnings > 0) {
    return "不建议刷新视觉链路：协议或 SafeApply audit 仍有 warning。"
  }

  return "不建议刷新视觉链路：本轮没有 accepted MapDiff。"
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
