/**
 * 当前文件职责：从 VisualState 纯函数生成 FormalCanvasModel。
 */

import type { VisualState } from "@/world/rendering/renderer-gateway"

import type {
  FormalCanvasModel,
  FormalVisualSourceTrace,
} from "./formal-visual-model-schema"

export function buildFormalCanvasModel(
  visualState: VisualState
): FormalCanvasModel {
  return {
    worldId: visualState.worldId,
    width: visualState.mapSize.columns * visualState.mapSize.tileSize,
    height: visualState.mapSize.rows * visualState.mapSize.tileSize,
    tileSize: visualState.mapSize.tileSize,
    mood: "calm",
    atmosphere: "unknown",
    styleToken: "warmNatural",
    source: buildCanvasSourceTrace(visualState),
    auditTags: [
      "formal_canvas_model_v0",
      "source:visual_state",
      `columns:${visualState.mapSize.columns}`,
      `rows:${visualState.mapSize.rows}`,
      `tile_size:${visualState.mapSize.tileSize}`,
    ],
  }
}

function buildCanvasSourceTrace(
  visualState: VisualState
): FormalVisualSourceTrace {
  return {
    source: "visual_state",
    sourceId: visualState.worldId,
    worldId: visualState.worldId,
  }
}
