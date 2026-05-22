/**
 * 当前文件职责：把建设持久化提案转换为 dry-run adapter 结果。
 */

import { auditConstructionPersistenceAdapter } from "./construction-persistence-audit"
import type {
  ConstructionPersistenceAdapterDryRunResult,
  ConstructionPersistenceAdapterRequest,
  ConstructionPersistenceProposal,
  ConstructionRuntimeBridgeAudit,
} from "./construction-schema"

export function buildConstructionPersistenceAdapterDryRunResult(input: {
  proposal: ConstructionPersistenceProposal | null
  runtimeBridgeAudit?: ConstructionRuntimeBridgeAudit
}): ConstructionPersistenceAdapterDryRunResult {
  const request = buildConstructionPersistenceAdapterRequest(input)
  const audit = auditConstructionPersistenceAdapter({ request })
  const hasWarnings =
    audit.warnings.length > 0 ||
    (input.runtimeBridgeAudit?.warnings.length ?? 0) > 0
  const canPersist = request.shouldPersist && !hasWarnings

  return {
    request,
    audit,
    canPersist,
    shouldPersist: request.shouldPersist,
    rejectedReason: canPersist
      ? null
      : buildPersistenceRejectedReason({
          request,
          hasWarnings,
          hasProposal: Boolean(input.proposal),
        }),
    sourceWorldId: request.worldId,
    sourceUpdatedAt: request.sourceUpdatedAt,
    nextUpdatedAt: request.nextUpdatedAt,
    acceptedDiffIds: request.acceptedDiffIds,
    tags: [
      "construction_persistence_adapter_dry_run_result",
      "dry_run_only",
      "no_storage_write",
      canPersist ? "persistence_dry_run_ready" : "persistence_dry_run_blocked",
    ],
  }
}

function buildConstructionPersistenceAdapterRequest(input: {
  proposal: ConstructionPersistenceProposal | null
  runtimeBridgeAudit?: ConstructionRuntimeBridgeAudit
}): ConstructionPersistenceAdapterRequest {
  if (!input.proposal) {
    const worldId = input.runtimeBridgeAudit?.worldId ?? "unknown-world"
    const ownerId = input.runtimeBridgeAudit?.ownerId ?? "unknown-owner"

    return {
      requestId: [
        "construction-persistence-dry-run",
        normalizeIdToken(worldId),
        "none",
      ].join("-"),
      proposalId: null,
      worldId,
      ownerId,
      seed: "unknown-seed",
      sourceUpdatedAt: 0,
      nextUpdatedAt: 0,
      acceptedDiffIds: [],
      shouldPersist: false,
      reason: "没有持久化提案，dry-run 不允许持久化。",
      tags: [
        "construction_persistence_adapter_request",
        "dry_run_only",
        "proposal_missing",
      ],
    }
  }

  return {
    requestId: [
      "construction-persistence-dry-run",
      normalizeIdToken(input.proposal.worldId),
      normalizeIdToken(input.proposal.proposalId),
    ].join("-"),
    proposalId: input.proposal.proposalId,
    worldId: input.proposal.worldId,
    ownerId: input.proposal.ownerId,
    seed: input.proposal.seed,
    sourceUpdatedAt: input.proposal.baseUpdatedAt,
    nextUpdatedAt: input.proposal.nextUpdatedAt,
    acceptedDiffIds: input.proposal.acceptedDiffIds,
    shouldPersist: input.proposal.shouldPersist,
    reason: input.proposal.reason,
    tags: [
      "construction_persistence_adapter_request",
      "dry_run_only",
      "no_storage_write",
      ...input.proposal.tags.map((tag) => `proposal_tag:${tag}`),
    ],
  }
}

function buildPersistenceRejectedReason(input: {
  request: ConstructionPersistenceAdapterRequest
  hasWarnings: boolean
  hasProposal: boolean
}): string {
  if (!input.hasProposal) {
    return "没有持久化提案。"
  }
  if (input.hasWarnings) {
    return "持久化 dry-run audit 仍有 warning。"
  }
  if (!input.request.shouldPersist) {
    return "持久化提案未建议持久化。"
  }

  return "持久化 dry-run 被安全边界阻止。"
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
