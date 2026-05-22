/**
 * 当前文件职责：生成建设链路后的 RenderableWorldSnapshot 刷新前请求。
 */

import { auditConstructionSnapshotRefreshRequest } from "./construction-snapshot-refresh-audit"
import type {
  ConstructionFormalVisualRefreshPrecheck,
  ConstructionSnapshotRefreshRequest,
  ConstructionVisualRefreshBridgeResult,
} from "./construction-schema"

export function buildConstructionSnapshotRefreshRequest(input: {
  worldId: string
  ownerId: string
  visualRefreshBridgeResult: ConstructionVisualRefreshBridgeResult
  upstreamWarnings: string[]
}): ConstructionSnapshotRefreshRequest {
  const shouldRefreshSnapshot =
    input.upstreamWarnings.length === 0 &&
    input.visualRefreshBridgeResult.shouldRequestRefresh &&
    input.visualRefreshBridgeResult.acceptedDiffIds.length > 0
  const stableRefreshFingerprint = buildStableRefreshFingerprint({
    worldId: input.worldId,
    ownerId: input.ownerId,
    bridgeResult: input.visualRefreshBridgeResult,
    shouldRefreshSnapshot,
  })

  return {
    requestId: [
      "construction-snapshot-refresh",
      normalizeIdToken(input.worldId),
      normalizeIdToken(input.visualRefreshBridgeResult.bridgeId),
    ].join("-"),
    worldId: input.worldId,
    ownerId: input.ownerId,
    changedPlacementIds:
      input.visualRefreshBridgeResult.changedPlacementIds.slice().sort(),
    acceptedDiffIds:
      input.visualRefreshBridgeResult.acceptedDiffIds.slice().sort(),
    reason: buildSnapshotRefreshReason({
      shouldRefreshSnapshot,
      upstreamWarnings: input.upstreamWarnings,
      acceptedDiffCount:
        input.visualRefreshBridgeResult.acceptedDiffIds.length,
    }),
    shouldRefreshSnapshot,
    shouldRebuildFormalVisualModel: shouldRefreshSnapshot,
    stableRefreshFingerprint,
    tags: [
      "construction_snapshot_refresh_request",
      "pre_renderer_only",
      "no_formal_visual_model_mutation",
      "no_ui_render",
      shouldRefreshSnapshot ? "snapshot_refresh_ready" : "snapshot_refresh_skipped",
    ],
  }
}

export function buildConstructionFormalVisualRefreshPrecheck(input: {
  request: ConstructionSnapshotRefreshRequest
}): ConstructionFormalVisualRefreshPrecheck {
  const audit = auditConstructionSnapshotRefreshRequest({
    request: input.request,
  })
  const shouldRebuildFormalVisualModel =
    input.request.shouldRebuildFormalVisualModel && audit.warnings.length === 0

  return {
    worldId: input.request.worldId,
    shouldRebuildFormalVisualModel,
    reason: shouldRebuildFormalVisualModel
      ? "Snapshot refresh precheck passed; downstream may rebuild FormalVisualModel."
      : "Snapshot refresh precheck blocked FormalVisualModel rebuild.",
    audit,
    tags: [
      "construction_formal_visual_refresh_precheck",
      "precheck_only",
      "no_formal_visual_model_build",
      shouldRebuildFormalVisualModel
        ? "formal_visual_rebuild_ready"
        : "formal_visual_rebuild_blocked",
    ],
  }
}

function buildSnapshotRefreshReason(input: {
  shouldRefreshSnapshot: boolean
  upstreamWarnings: string[]
  acceptedDiffCount: number
}): string {
  if (input.shouldRefreshSnapshot) {
    return `建议刷新 RenderableWorldSnapshot：本轮已接受 ${input.acceptedDiffCount} 个 MapDiff。`
  }
  if (input.upstreamWarnings.length > 0) {
    return "不建议刷新 RenderableWorldSnapshot：上游 audit 仍有 warning。"
  }

  return "不建议刷新 RenderableWorldSnapshot：本轮没有 accepted MapDiff。"
}

function buildStableRefreshFingerprint(input: {
  worldId: string
  ownerId: string
  bridgeResult: ConstructionVisualRefreshBridgeResult
  shouldRefreshSnapshot: boolean
}): string {
  return [
    input.worldId,
    input.ownerId,
    input.bridgeResult.bridgeId,
    input.bridgeResult.acceptedDiffIds.slice().sort().join("+"),
    input.bridgeResult.changedPlacementIds.slice().sort().join("+"),
    String(input.shouldRefreshSnapshot),
  ].join("::")
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
