import type {
  ConstructionRuntimeCycleInput,
  ConstructionPainterRefreshSignal,
  ConstructionRuntimeCommitResult,
} from "./construction-schema"

export function buildConstructionPainterRefreshSignal(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  runtimeCommitResult: ConstructionRuntimeCommitResult
}): ConstructionPainterRefreshSignal | null {
  if (input.runtimeInput.painterRefreshMode === "disabled") {
    return null
  }

  const safeApplyResult = input.runtimeCommitResult.safeApplyResult
  const acceptedDiffIds = safeApplyResult?.acceptedDiffIds ?? []
  const sourcePlanId = input.runtimeCommitResult.selectedPlan?.id ?? null
  const changedPlacementIds = buildChangedPlacementIds(input.runtimeCommitResult)
  const shouldRefresh =
    input.runtimeCommitResult.audit.warnings.length === 0 &&
    Boolean(safeApplyResult) &&
    (safeApplyResult?.audit.warnings.length ?? 0) === 0 &&
    acceptedDiffIds.length > 0

  return {
    signalId: buildPainterRefreshSignalId({
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
    reason: buildPainterRefreshReason({
      shouldRefresh,
      acceptedDiffIds,
      protocolWarnings: input.runtimeCommitResult.audit.warnings.length,
      safeApplyWarnings: safeApplyResult?.audit.warnings.length ?? 0,
      hasSafeApplyResult: Boolean(safeApplyResult),
    }),
    tags: [
      "construction_painter_refresh_signal",
      "signal_only",
      "no_world_projection_mutation",
      "no_ui_render",
      `run_reason:${input.runtimeInput.runReason}`,
    ],
  }
}

function buildChangedPlacementIds(
  runtimeCommitResult: ConstructionRuntimeCommitResult
): string[] {
  const acceptedDiffIds = new Set(
    runtimeCommitResult.safeApplyResult?.acceptedDiffIds ?? []
  )

  return uniqueTags(
    (runtimeCommitResult.executionResult?.mapDiffs ?? [])
      .filter((diff) => acceptedDiffIds.has(diff.id))
      .map((diff) => diff.placementId)
  )
}

function buildPainterRefreshSignalId(input: {
  worldId: string
  now: number
  sourcePlanId: string | null
}): string {
  return [
    "construction-painter-refresh",
    normalizeIdToken(input.worldId),
    String(input.now),
    normalizeIdToken(input.sourcePlanId ?? "none"),
  ].join("-")
}

function buildPainterRefreshReason(input: {
  shouldRefresh: boolean
  acceptedDiffIds: string[]
  protocolWarnings: number
  safeApplyWarnings: number
  hasSafeApplyResult: boolean
}): string {
  if (input.shouldRefresh) {
    return `建议刷新 Painter 链路：SafeApply 已接受 ${input.acceptedDiffIds.length} 个 MapDiff。`
  }

  if (!input.hasSafeApplyResult) {
    return "不建议刷新 Painter 链路：本轮没有 SafeApply 结果。"
  }

  if (input.protocolWarnings > 0 || input.safeApplyWarnings > 0) {
    return "不建议刷新 Painter 链路：协议或 SafeApply 审计仍然存在 warning。"
  }

  return "不建议刷新 Painter 链路：本轮没有接受任何 MapDiff。"
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
