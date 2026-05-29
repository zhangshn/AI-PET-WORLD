/**
 * 当前文件职责：审计建设链路触发 RenderableWorldSnapshot 刷新前请求。
 */

import type {
  ConstructionSnapshotRefreshAudit,
  ConstructionSnapshotRefreshRequest,
} from "./construction-schema"

export function auditConstructionSnapshotRefreshRequest(input: {
  request: ConstructionSnapshotRefreshRequest
}): ConstructionSnapshotRefreshAudit {
  const warnings = auditRefreshFlags(input.request)

  return {
    stableSnapshotRefreshFingerprint:
      input.request.stableRefreshFingerprint,
    sourceWorldId: input.request.worldId,
    changedPlacementIds: input.request.changedPlacementIds,
    acceptedDiffIds: input.request.acceptedDiffIds,
    warnings,
    tags: [
      "construction_snapshot_refresh_audit",
      warnings.length === 0
        ? "construction_snapshot_refresh_valid"
        : "construction_snapshot_refresh_warning",
      "pre_renderer_only",
      "no_formal_visual_model_build",
    ],
  }
}

function auditRefreshFlags(
  request: ConstructionSnapshotRefreshRequest
): string[] {
  const warnings: string[] = []

  if (request.acceptedDiffIds.length === 0 && request.shouldRefreshSnapshot) {
    warnings.push("Snapshot refresh 不能在没有 acceptedDiffIds 时请求刷新。")
  }
  if (!request.shouldRefreshSnapshot && request.shouldRebuildFormalVisualModel) {
    warnings.push("不能在 snapshot 不刷新时重建 FormalVisualModel。")
  }

  return warnings
}
