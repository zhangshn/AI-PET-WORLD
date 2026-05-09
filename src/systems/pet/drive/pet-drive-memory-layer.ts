/**
 * 当前文件负责：把宠物记忆倾向转换为 drive 分数的轻量偏移。
 */

import type { DriveLayerContext } from "./pet-drive-types"
import { addScore, clamp, subtractScore } from "./pet-drive-score-utils"

export function applyDriveMemoryLayer(context: DriveLayerContext) {
  const memory = context.input.pet.memoryState

  if (!memory) return

  const { scores, reasons } = context
  const preference = memory.preferenceBias
  const relation = memory.relationImpression
  const self = memory.selfImpression
  const world = memory.worldImpression

  addScore(
    scores,
    reasons,
    "eat",
    clamp(preference.eatBias * 0.08, 0, 8),
    "记忆层进食倾向"
  )

  addScore(
    scores,
    reasons,
    "rest",
    clamp(preference.restBias * 0.08, 0, 8),
    "记忆层恢复倾向"
  )

  addScore(
    scores,
    reasons,
    "approach",
    clamp(preference.approachBias * 0.08, 0, 8),
    "记忆层接近倾向"
  )

  addScore(
    scores,
    reasons,
    "explore",
    clamp(preference.exploreBias * 0.08, 0, 8),
    "记忆层探索倾向"
  )

  addScore(
    scores,
    reasons,
    "observe",
    clamp(preference.observeBias * 0.08, 0, 8),
    "记忆层观察倾向"
  )

  addScore(
    scores,
    reasons,
    "approach",
    clamp((relation.approachSafety + relation.caretakerTrust) * 0.035, 0, 7),
    "关系记忆支持接近"
  )

  addScore(
    scores,
    reasons,
    "rest",
    clamp(self.recoveryConfidence * 0.06, 0, 6),
    "恢复经验支持休息"
  )

  addScore(
    scores,
    reasons,
    "explore",
    clamp(world.explorationConfidence * 0.05, 0, 6),
    "探索经验支持探索"
  )

  addScore(
    scores,
    reasons,
    "observe",
    clamp(world.observationConfidence * 0.05, 0, 6),
    "观察经验支持观察"
  )

  addScore(
    scores,
    reasons,
    "rest",
    clamp(world.nightSafetyBias * 0.04, 0, 5),
    "夜晚安全记忆支持恢复"
  )

  const nightTension = clamp(Math.max(0, -world.nightSafetyBias) * 0.04, 0, 5)

  if (nightTension > 0) {
    addScore(
      scores,
      reasons,
      "observe",
      nightTension,
      "夜晚负面记忆提高观察"
    )
  }

  const trustPenalty = clamp(Math.max(0, -relation.caretakerTrust) * 0.05, 0, 6)

  if (trustPenalty > 0) {
    subtractScore(
      scores,
      reasons,
      "approach",
      trustPenalty,
      "关系负面记忆压低接近"
    )

    addScore(
      scores,
      reasons,
      "avoid",
      trustPenalty * 0.8,
      "关系负面记忆提高回避"
    )
  }
}