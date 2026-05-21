/**
 * 当前文件职责：从 VisualState 纯函数生成 FormalEnvironmentModel。
 */

import type { VisualState } from "@/world/rendering/renderer-gateway"

import type {
  FormalAtmosphereTone,
  FormalCanvasMood,
  FormalEnvironmentModel,
  FormalVisualSourceTrace,
  FormalVisualStyleToken,
} from "./formal-visual-model-schema"

export function buildFormalEnvironmentModel(
  visualState: VisualState
): FormalEnvironmentModel {
  return {
    worldId: visualState.worldId,
    mood: buildEnvironmentMood(visualState),
    atmosphere: buildEnvironmentAtmosphere(visualState),
    styleToken: buildEnvironmentStyleToken(visualState),
    timeLabel: "时间状态未接入",
    weatherLabel: "天气状态未接入",
    source: buildEnvironmentSourceTrace(visualState),
    auditTags: [
      "formal_environment_model_v0",
      "source:visual_state",
    ],
  }
}

function buildEnvironmentMood(visualState: VisualState): FormalCanvasMood {
  if (hasTagToken(visualState.tags, "alert")) return "alert"
  if (hasTagToken(visualState.tags, "recovering")) return "recovering"
  if (hasTagToken(visualState.tags, "active")) return "active"
  if (hasTagToken(visualState.tags, "quiet")) return "quiet"
  if (hasTagToken(visualState.tags, "warm")) return "warm"

  return "calm"
}

function buildEnvironmentAtmosphere(
  visualState: VisualState
): FormalAtmosphereTone {
  if (hasTagToken(visualState.tags, "morning")) return "morning"
  if (hasTagToken(visualState.tags, "evening")) return "evening"
  if (hasTagToken(visualState.tags, "night")) return "night"
  if (hasTagToken(visualState.tags, "rain")) return "rain"
  if (hasTagToken(visualState.tags, "clear")) return "clear"
  if (hasTagToken(visualState.tags, "cloudy")) return "cloudy"
  if (hasTagToken(visualState.tags, "day")) return "day"

  return "unknown"
}

function buildEnvironmentStyleToken(
  visualState: VisualState
): FormalVisualStyleToken {
  if (hasTagToken(visualState.tags, "protective")) return "protective"
  if (hasTagToken(visualState.tags, "ordered")) return "ordered"
  if (hasTagToken(visualState.tags, "quiet")) return "quiet"
  if (hasTagToken(visualState.tags, "exploratory")) return "exploratory"
  if (hasTagToken(visualState.tags, "caretaking")) return "caretaking"

  return "warmNatural"
}

function buildEnvironmentSourceTrace(
  visualState: VisualState
): FormalVisualSourceTrace {
  return {
    source: "visual_state",
    sourceId: visualState.worldId,
    worldId: visualState.worldId,
  }
}

function hasTagToken(tags: string[], token: string): boolean {
  return tags.some((tag) => tag.includes(token))
}
