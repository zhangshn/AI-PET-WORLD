/**
 * 当前文件负责：计算人格底盘与意识核心对 drive 的影响。
 */

import type { DriveLayerContext } from "./pet-drive-types"
import { addScore, clamp, subtractScore } from "./pet-drive-score-utils"
import { getConsciousnessBias, getTraits } from "./pet-drive-context"

export function applyTraitBaseLayer(context: DriveLayerContext) {
  const { input, scores, reasons } = context
  const traits = getTraits(input)

  addScore(
    scores,
    reasons,
    "eat",
    clamp((traits.appetite - 45) * 0.22, 0, 12),
    "食欲底盘"
  )

  addScore(
    scores,
    reasons,
    "rest",
    clamp((traits.restPreference - 45) * 0.22, 0, 12),
    "恢复偏好底盘"
  )

  addScore(
    scores,
    reasons,
    "approach",
    clamp((traits.stability - 45) * 0.14, 0, 8) +
      clamp((traits.emotionalSensitivity - 40) * 0.08, 0, 6),
    "关系接近底盘"
  )

  addScore(
    scores,
    reasons,
    "explore",
    clamp((traits.activity - 45) * 0.25, 0, 15),
    "向外活动底盘"
  )

  addScore(
    scores,
    reasons,
    "observe",
    clamp((traits.emotionalSensitivity - 45) * 0.22, 0, 15),
    "感知敏锐底盘"
  )

  addScore(
    scores,
    reasons,
    "avoid",
    clamp((traits.emotionalSensitivity - 55) * 0.18, 0, 10) +
      clamp((55 - traits.stability) * 0.18, 0, 10),
    "防御敏感底盘"
  )
}

export function applyConsciousnessLayer(context: DriveLayerContext) {
  const { input, scores, reasons } = context
  const bias = getConsciousnessBias(input)

  addScore(
    scores,
    reasons,
    "explore",
    clamp((bias.changeSeeking - 50) * 0.24, 0, 16),
    "意识层变化追求"
  )

  addScore(
    scores,
    reasons,
    "observe",
    clamp((bias.observationBias - 50) * 0.24, 0, 18),
    "意识层观察偏置"
  )

  addScore(
    scores,
    reasons,
    "approach",
    clamp((bias.attachmentBias - 50) * 0.22, 0, 14),
    "意识层连接偏置"
  )

  addScore(
    scores,
    reasons,
    "rest",
    clamp((bias.comfortSeeking - 50) * 0.24, 0, 18),
    "意识层舒适追求"
  )

  addScore(
    scores,
    reasons,
    "avoid",
    clamp((bias.riskTolerance < 50 ? 50 - bias.riskTolerance : 0) * 0.18, 0, 12),
    "意识层低风险容忍"
  )

  const restSuppression = clamp((bias.restResistance - 50) * 0.18, 0, 14)

  if (restSuppression > 0) {
    subtractScore(
      scores,
      reasons,
      "rest",
      restSuppression,
      "意识层抗休息压低恢复"
    )
  }

  const riskBoost = clamp((bias.riskTolerance - 50) * 0.16, 0, 12)

  if (riskBoost > 0) {
    addScore(
      scores,
      reasons,
      "explore",
      riskBoost,
      "意识层高风险容忍推动探索"
    )

    subtractScore(
      scores,
      reasons,
      "avoid",
      riskBoost * 0.7,
      "意识层高风险容忍压低回避"
    )
  }
}