/**
 * 当前文件职责：把建设视觉刷新信号转换为刷新请求前协议。
 */

import type {
  ConstructionVisualRefreshBridgeResult,
  ConstructionVisualRefreshSignal,
} from "./construction-schema"

export function buildConstructionVisualRefreshBridgeResult(input: {
  signal: ConstructionVisualRefreshSignal | null
}): ConstructionVisualRefreshBridgeResult {
  if (!input.signal) {
    return {
      bridgeId: "construction-visual-bridge-none",
      signalId: null,
      shouldRequestRefresh: false,
      changedPlacementIds: [],
      acceptedDiffIds: [],
      reason: "未生成视觉刷新信号，刷新桥接不发出请求。",
      tags: [
        "construction_visual_refresh_bridge",
        "bridge_only",
        "no_world_projection_mutation",
        "no_renderer_mutation",
        "no_ui_render",
      ],
    }
  }

  return {
    bridgeId: buildBridgeId(input.signal),
    signalId: input.signal.signalId,
    shouldRequestRefresh: input.signal.shouldRefresh,
    changedPlacementIds: input.signal.changedPlacementIds,
    acceptedDiffIds: input.signal.acceptedDiffIds,
    reason: input.signal.shouldRefresh
      ? "视觉刷新桥接建议后续刷新 RenderableWorldSnapshot。"
      : "视觉刷新桥接未满足刷新条件。",
    tags: [
      "construction_visual_refresh_bridge",
      "bridge_only",
      "no_world_projection_mutation",
      "no_renderer_mutation",
      "no_ui_render",
      input.signal.shouldRefresh ? "refresh_request_ready" : "refresh_request_skipped",
    ],
  }
}

function buildBridgeId(signal: ConstructionVisualRefreshSignal): string {
  return [
    "construction-visual-bridge",
    normalizeIdToken(signal.worldId),
    normalizeIdToken(signal.signalId),
  ].join("-")
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
