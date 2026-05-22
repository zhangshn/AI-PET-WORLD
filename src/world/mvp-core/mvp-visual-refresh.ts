/**
 * 当前文件职责：生成 MVP snapshot 刷新请求。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

export type MvpVisualRefreshInput = {
  nextHomeMapState: HomeMapState
  acceptedDiffIds: string[]
  changedPlacementIds: string[]
  warnings: string[]
  tags: string[]
}

export type MvpVisualRefreshResult = {
  shouldRefreshSnapshot: boolean
  changedPlacementIds: string[]
  acceptedDiffIds: string[]
  snapshotRefreshRequestId: string
  reason: string
  warnings: string[]
  messages: string[]
  tags: string[]
}

export function buildMvpVisualRefresh(
  input: MvpVisualRefreshInput
): MvpVisualRefreshResult {
  const shouldRefreshSnapshot =
    input.warnings.length === 0 && input.acceptedDiffIds.length > 0

  return {
    shouldRefreshSnapshot,
    changedPlacementIds: input.changedPlacementIds.slice().sort(),
    acceptedDiffIds: input.acceptedDiffIds.slice().sort(),
    snapshotRefreshRequestId: [
      "mvp-snapshot-refresh",
      normalizeIdToken(input.nextHomeMapState.worldId),
      String(input.nextHomeMapState.updatedAt),
    ].join("-"),
    reason: shouldRefreshSnapshot
      ? "MVP snapshot refresh request is ready."
      : "MVP snapshot refresh skipped by warnings or no accepted diffs.",
    warnings: input.warnings,
    messages: input.warnings.length === 0 ? ["MVP visual refresh checked."] : input.warnings,
    tags: [
      "mvp_visual_refresh",
      "snapshot_refresh_request_only",
      "no_renderer_mutation",
      ...input.tags,
    ],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
