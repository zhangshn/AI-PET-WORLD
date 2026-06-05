import type {
  ConstructionPainterRefreshBridgeResult,
  ConstructionPainterRefreshSignal,
} from "./construction-schema"

export function buildConstructionPainterRefreshBridgeResult(input: {
  signal: ConstructionPainterRefreshSignal | null
}): ConstructionPainterRefreshBridgeResult {
  if (!input.signal) {
    return {
      bridgeId: "construction-painter-bridge-none",
      signalId: null,
      shouldRequestRefresh: false,
      changedPlacementIds: [],
      acceptedDiffIds: [],
      reason: "没有生成 Painter 刷新信号，因此不会发出 Painter 刷新请求。",
      tags: [
        "construction_painter_refresh_bridge",
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
      ? "Painter 刷新桥建议请求一次新的 WorldVisualPainter 流程。"
      : "Painter 刷新桥未请求刷新，因为信号未满足刷新条件。",
    tags: [
      "construction_painter_refresh_bridge",
      "bridge_only",
      "no_world_projection_mutation",
      "no_renderer_mutation",
      "no_ui_render",
      input.signal.shouldRefresh ? "refresh_request_ready" : "refresh_request_skipped",
    ],
  }
}

function buildBridgeId(signal: ConstructionPainterRefreshSignal): string {
  return [
    "construction-painter-bridge",
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
