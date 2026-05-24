/**
 * 当前文件职责：审计建设链路触发 RenderableWorldSnapshot 刷新前请求。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type {
  ConstructionSnapshotRefreshAudit,
  ConstructionSnapshotRefreshRequest,
} from "./construction-schema"

// These tokens are only used for V2.6 redline audit scans. They do not mean the current product supports these old routes.
const FORBIDDEN_SNAPSHOT_REFRESH_TOKENS = [
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

export function auditConstructionSnapshotRefreshRequest(input: {
  request: ConstructionSnapshotRefreshRequest
}): ConstructionSnapshotRefreshAudit {
  const warnings = [
    ...auditRefreshFlags(input.request),
    ...auditForbiddenTokens(input.request),
  ]

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

function auditForbiddenTokens(
  request: ConstructionSnapshotRefreshRequest
): string[] {
  const tokens = [
    request.requestId,
    request.reason,
    ...request.tags,
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_SNAPSHOT_REFRESH_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`SnapshotRefreshRequest 包含禁止 token：${token}`]
      : []
  )
}
