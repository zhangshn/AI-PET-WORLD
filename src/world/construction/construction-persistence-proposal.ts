/**
 * 当前文件职责：根据建设协议结果生成持久化前提案。
 */

import type {
  ConstructionPersistenceProposal,
  ConstructionRuntimeCycleInput,
  ConstructionRuntimeCommitResult,
} from "./construction-schema"

export function buildConstructionPersistenceProposal(input: {
  runtimeInput: ConstructionRuntimeCycleInput
  runtimeCommitResult: ConstructionRuntimeCommitResult
}): ConstructionPersistenceProposal | null {
  if (input.runtimeInput.persistenceMode === "disabled") {
    return null
  }

  const safeApplyResult = input.runtimeCommitResult.safeApplyResult
  const acceptedDiffIds = safeApplyResult?.acceptedDiffIds ?? []
  const rejectedDiffIds =
    safeApplyResult?.rejectedDiffs.map((diff) => diff.diffId) ?? []
  const sourcePlanId = input.runtimeCommitResult.selectedPlan?.id ?? null
  const shouldPersist =
    input.runtimeCommitResult.audit.warnings.length === 0 &&
    Boolean(safeApplyResult) &&
    (safeApplyResult?.audit.warnings.length ?? 0) === 0 &&
    acceptedDiffIds.length > 0

  return {
    proposalId: buildPersistenceProposalId({
      worldId: input.runtimeInput.homeMapState.worldId,
      now: input.runtimeInput.now,
      sourcePlanId,
    }),
    worldId: input.runtimeInput.homeMapState.worldId,
    ownerId: input.runtimeInput.homeMapState.ownerId,
    seed: input.runtimeInput.homeMapState.seed,
    sourcePlanId,
    shouldPersist,
    baseUpdatedAt: input.runtimeInput.homeMapState.updatedAt,
    nextUpdatedAt: input.runtimeCommitResult.nextHomeMapState.updatedAt,
    acceptedDiffIds,
    rejectedDiffIds,
    reason: buildPersistenceReason({
      shouldPersist,
      acceptedDiffIds,
      protocolWarnings: input.runtimeCommitResult.audit.warnings.length,
      safeApplyWarnings: safeApplyResult?.audit.warnings.length ?? 0,
      hasSafeApplyResult: Boolean(safeApplyResult),
    }),
    tags: [
      "construction_persistence_proposal",
      "proposal_only",
      "no_direct_storage_write",
      "no_runtime_persistence",
      `run_reason:${input.runtimeInput.runReason}`,
    ],
  }
}

function buildPersistenceProposalId(input: {
  worldId: string
  now: number
  sourcePlanId: string | null
}): string {
  return [
    "construction-persist",
    normalizeIdToken(input.worldId),
    String(input.now),
    normalizeIdToken(input.sourcePlanId ?? "none"),
  ].join("-")
}

function buildPersistenceReason(input: {
  shouldPersist: boolean
  acceptedDiffIds: string[]
  protocolWarnings: number
  safeApplyWarnings: number
  hasSafeApplyResult: boolean
}): string {
  if (input.shouldPersist) {
    return `建议持久化：SafeApply 已接受 ${input.acceptedDiffIds.length} 个 MapDiff。`
  }

  if (!input.hasSafeApplyResult) {
    return "不建议持久化：本轮没有 SafeApply 结果。"
  }

  if (input.protocolWarnings > 0 || input.safeApplyWarnings > 0) {
    return "不建议持久化：协议或 SafeApply audit 仍有 warning。"
  }

  return "不建议持久化：本轮没有 accepted MapDiff。"
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
