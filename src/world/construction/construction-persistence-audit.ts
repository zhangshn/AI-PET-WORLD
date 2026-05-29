/**
 * 当前文件职责：审计建设持久化 adapter dry-run 的边界。
 */

import type {
  ConstructionPersistenceAdapterAudit,
  ConstructionPersistenceAdapterRequest,
} from "./construction-schema"

export function auditConstructionPersistenceAdapter(input: {
  request: ConstructionPersistenceAdapterRequest
}): ConstructionPersistenceAdapterAudit {
  const warnings = auditRequestShape(input.request)

  return {
    stablePersistenceFingerprint:
      buildStablePersistenceFingerprint(input.request),
    sourceWorldId: input.request.worldId,
    sourceOwnerId: input.request.ownerId,
    acceptedDiffIds: input.request.acceptedDiffIds,
    warnings,
    tags: [
      "construction_persistence_adapter_audit",
      warnings.length === 0
        ? "construction_persistence_adapter_valid"
        : "construction_persistence_adapter_warning",
      "dry_run_only",
      "no_storage_write",
    ],
  }
}

function auditRequestShape(
  request: ConstructionPersistenceAdapterRequest
): string[] {
  const warnings: string[] = []

  if (request.shouldPersist && request.acceptedDiffIds.length === 0) {
    warnings.push("PersistenceAdapter 不能在没有 acceptedDiffIds 时持久化。")
  }
  if (request.nextUpdatedAt < request.sourceUpdatedAt) {
    warnings.push("PersistenceAdapter nextUpdatedAt 不能早于 sourceUpdatedAt。")
  }

  return warnings
}

function buildStablePersistenceFingerprint(
  request: ConstructionPersistenceAdapterRequest
): string {
  return [
    request.requestId,
    request.worldId,
    request.ownerId,
    request.seed,
    String(request.sourceUpdatedAt),
    String(request.nextUpdatedAt),
    request.acceptedDiffIds.slice().sort().join("+"),
    String(request.shouldPersist),
  ].join("::")
}
