/**
 * 当前文件负责：把宠物最新认知结果轻量映射到 drive 分数。
 */

import type {
  DriveLayerContext,
} from "./pet-drive-types"

import {
  addScore,
} from "./pet-drive-score-utils"

function scaleLevel(
  value: number,
  factor: number
): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value)) * factor
}

export function applyCognitionDriveLayer(
  context: DriveLayerContext
) {
  const cognition = context.input.pet.latestCognition

  if (!cognition) {
    return
  }

  if (cognition.reactionTendency === "chase") {
    addScore(
      context.scores,
      context.reasons,
      "explore",
      8 + scaleLevel(cognition.curiosityLevel, 0.08),
      `认知驱动：追随倾向提高探索 drive（${cognition.summary}）`
    )

    addScore(
      context.scores,
      context.reasons,
      "observe",
      4,
      `认知驱动：追随前仍需要观察目标变化（${cognition.summary}）`
    )
  }

  if (cognition.reactionTendency === "observe") {
    addScore(
      context.scores,
      context.reasons,
      "observe",
      10 + scaleLevel(cognition.curiosityLevel, 0.05),
      `认知驱动：观察倾向提高 observe drive（${cognition.summary}）`
    )
  }

  if (cognition.reactionTendency === "approach") {
    addScore(
      context.scores,
      context.reasons,
      "approach",
      8 + scaleLevel(cognition.safetyFeeling, 0.04),
      `认知驱动：安全靠近倾向提高 approach drive（${cognition.summary}）`
    )
  }

  if (cognition.reactionTendency === "avoid") {
    addScore(
      context.scores,
      context.reasons,
      "avoid",
      10 + scaleLevel(cognition.stressLevel, 0.08),
      `认知驱动：回避倾向提高 avoid drive（${cognition.summary}）`
    )

    addScore(
      context.scores,
      context.reasons,
      "observe",
      4,
      `认知驱动：回避前先确认边界（${cognition.summary}）`
    )
  }

  if (cognition.reactionTendency === "rest_nearby") {
    addScore(
      context.scores,
      context.reasons,
      "rest",
      9 + scaleLevel(cognition.safetyFeeling, 0.04),
      `认知驱动：附近恢复倾向提高 rest drive（${cognition.summary}）`
    )

    addScore(
      context.scores,
      context.reasons,
      "observe",
      3,
      `认知驱动：恢复前保留轻度观察（${cognition.summary}）`
    )
  }

  if (cognition.interpretation === "exciting") {
    addScore(
      context.scores,
      context.reasons,
      "explore",
      5,
      `认知解释：兴奋刺激提高探索 drive（${cognition.summary}）`
    )
  }

  if (
    cognition.interpretation === "interesting" ||
    cognition.interpretation === "mysterious"
  ) {
    addScore(
      context.scores,
      context.reasons,
      "observe",
      5,
      `认知解释：未知 / 有趣刺激提高观察 drive（${cognition.summary}）`
    )
  }

  if (
    cognition.interpretation === "comforting" ||
    cognition.interpretation === "peaceful"
  ) {
    addScore(
      context.scores,
      context.reasons,
      "rest",
      5,
      `认知解释：舒适刺激提高恢复 drive（${cognition.summary}）`
    )
  }

  if (cognition.interpretation === "dangerous") {
    addScore(
      context.scores,
      context.reasons,
      "avoid",
      8,
      `认知解释：危险刺激提高回避 drive（${cognition.summary}）`
    )
  }
}