/**
 * 当前文件负责：计算生理、情绪关系、节律、状态提示、外部刺激与 drive 互相压制。
 */

import type { DriveLayerContext, DriveType } from "./pet-drive-types"
import { addScore, clamp, round, subtractScore } from "./pet-drive-score-utils"
import {
  getBranchTag,
  getCognitiveLabel,
  getConsciousnessBias,
  getEmotionalArousal,
  getEmotionalLabel,
  getEnergy,
  getHunger,
  getDriveHint,
  getPhaseTag,
  getRelationalLabel,
} from "./pet-drive-context"

export function applyPhysicalLayer(context: DriveLayerContext) {
  const { input, scores, reasons } = context
  const hunger = getHunger(input)
  const energy = getEnergy(input)
  const bias = getConsciousnessBias(input)

  if (hunger >= 30) {
    addScore(scores, reasons, "eat", (hunger - 30) * 0.35, "饥饿累积")
  }

  if (hunger >= 65) {
    addScore(scores, reasons, "eat", (hunger - 65) * 0.75, "高饥饿加速")
  }

  if (energy <= 70) {
    addScore(scores, reasons, "rest", (70 - energy) * 0.3, "精力下降")
  }

  if (energy <= 35) {
    addScore(scores, reasons, "rest", (35 - energy) * 0.95, "低精力强恢复")
  }

  const restResistanceFactor = clamp((bias.restResistance - 50) * 0.12, 0, 10)

  if (energy <= 40 && energy > 20 && restResistanceFactor > 0) {
    subtractScore(
      scores,
      reasons,
      "rest",
      restResistanceFactor,
      "意识层抗休息削弱恢复驱动"
    )

    addScore(
      scores,
      reasons,
      "explore",
      restResistanceFactor * 0.7,
      "意识层抗休息保留探索冲动"
    )
  }

  if (hunger >= 60) {
    const hungerExplorePenalty = clamp((hunger - 60) * 0.25, 0, 20)
    const hungerApproachPenalty = clamp((hunger - 60) * 0.16, 0, 12)

    subtractScore(scores, reasons, "explore", hungerExplorePenalty, "高饥饿压制探索")
    subtractScore(scores, reasons, "approach", hungerApproachPenalty, "高饥饿压制靠近")
  }

  if (energy <= 40) {
    const lowEnergyExplorePenalty = clamp((40 - energy) * 0.35, 0, 18)
    const lowEnergyApproachPenalty = clamp((40 - energy) * 0.22, 0, 12)

    subtractScore(scores, reasons, "explore", lowEnergyExplorePenalty, "低精力压制探索")
    subtractScore(scores, reasons, "approach", lowEnergyApproachPenalty, "低精力压制靠近")
  }

  if (energy <= 20 && energy > 10) {
    addScore(scores, reasons, "rest", 22, "危险疲惫推动恢复")
    addScore(scores, reasons, "eat", 4, "危险疲惫抬高补给需求")
    addScore(scores, reasons, "observe", 6, "危险疲惫转入观察停顿")

    subtractScore(scores, reasons, "explore", 18, "危险疲惫强压探索")
    subtractScore(scores, reasons, "approach", 14, "危险疲惫强压靠近")
  }

  if (energy <= 10) {
    addScore(scores, reasons, "rest", 40, "生理极限强制恢复")
    addScore(scores, reasons, "eat", 8, "生理极限抬高基础补给")
    addScore(scores, reasons, "observe", 4, "生理极限残留环境留意")

    subtractScore(scores, reasons, "explore", 40, "生理极限禁止探索")
    subtractScore(scores, reasons, "approach", 32, "生理极限禁止靠近")
    subtractScore(scores, reasons, "avoid", 8, "生理极限压低外向防御活动")
  }

  if (energy <= 8) {
    addScore(scores, reasons, "rest", 55, "崩溃边界强制休息")
    subtractScore(scores, reasons, "explore", 60, "崩溃边界切断探索")
    subtractScore(scores, reasons, "approach", 50, "崩溃边界切断靠近")
    subtractScore(scores, reasons, "observe", 10, "崩溃边界削弱观察")
  }
}

export function applyEmotionAndRelationLayer(context: DriveLayerContext) {
  const { input, scores, reasons } = context
  const emotional = getEmotionalLabel(input)
  const arousal = getEmotionalArousal(input)
  const relational = getRelationalLabel(input)
  const cognitive = getCognitiveLabel(input)
  const bias = getConsciousnessBias(input)

  if (emotional === "alert") {
    addScore(scores, reasons, "observe", 18, "警觉提升观察")
    addScore(scores, reasons, "avoid", 10, "警觉抬高防御")
  }

  if (emotional === "anxious" || emotional === "irritated") {
    const explorePenalty = clamp(12 - (bias.riskTolerance - 50) * 0.08, 4, 12)

    addScore(scores, reasons, "avoid", 22, "不安/烦躁推动回避")
    addScore(scores, reasons, "observe", 10, "不安提升观察")
    subtractScore(scores, reasons, "explore", explorePenalty, "不安压制探索")
    subtractScore(scores, reasons, "approach", 14, "不安压制靠近")
  }

  if (emotional === "low") {
    addScore(scores, reasons, "rest", 16, "低落推动恢复")
    subtractScore(scores, reasons, "explore", 14, "低落压制探索")
    subtractScore(scores, reasons, "approach", 8, "低落压制靠近")
  }

  if (emotional === "relaxed" || emotional === "content") {
    addScore(scores, reasons, "explore", 12, "放松支持向外探索")
    addScore(scores, reasons, "approach", 8, "放松支持靠近")
  }

  if (emotional === "curious") {
    addScore(scores, reasons, "explore", 18, "好奇推动探索")
  }

  if (emotional === "excited") {
    addScore(scores, reasons, "explore", 10, "兴奋推动向外扩展")
    addScore(scores, reasons, "approach", 8, "兴奋推动主动靠近")
  }

  if (relational === "attached" || relational === "secure") {
    addScore(scores, reasons, "approach", 18, "关系安全支持靠近")
  }

  if (relational === "guarded" || relational === "distant") {
    addScore(scores, reasons, "observe", 8, "保留感提升观察")
    addScore(scores, reasons, "avoid", 8, "疏离感提升回避")
    subtractScore(scores, reasons, "approach", 14, "关系疏离压制靠近")
  }

  if (cognitive === "observing") {
    addScore(scores, reasons, "observe", 12, "观察状态延续观察驱动")
  }

  if (cognitive === "focused") {
    addScore(scores, reasons, "approach", 6, "专注支持目标收束")
    addScore(scores, reasons, "explore", 6, "专注支持持续探索")
  }

  if (cognitive === "hesitant" || cognitive === "avoidant") {
    addScore(scores, reasons, "observe", 10, "迟疑/回避提升观察")
    addScore(scores, reasons, "avoid", 10, "迟疑/回避推动防御")
    subtractScore(scores, reasons, "approach", 8, "迟疑压制靠近")
  }

  if (arousal >= 65) {
    addScore(scores, reasons, "observe", 8, "高唤醒提升观察")
  }
}

export function applyRhythmLayer(context: DriveLayerContext) {
  const { input, scores, reasons } = context
  const period = input.time.period
  const hour = input.time.hour
  const phaseTag = getPhaseTag(input)
  const branchTag = getBranchTag(input)
  const bias = getConsciousnessBias(input)

  if (period === "Night") {
    addScore(scores, reasons, "rest", 18, "夜晚节律推动休息")
    addScore(scores, reasons, "observe", 6, "夜晚提升边界观察")
    subtractScore(scores, reasons, "explore", 8, "夜晚轻度压制探索")
  }

  if (period === "Morning" || period === "Daytime") {
    addScore(scores, reasons, "explore", 8, "白天节律支持探索")
  }

  if (phaseTag === "recovery_phase") {
    const restResistanceReduce = clamp((bias.restResistance - 50) * 0.08, 0, 6)
    const explorePenalty = Math.max(4, 12 - restResistanceReduce)

    addScore(scores, reasons, "rest", 22, "恢复阶段强恢复")
    addScore(scores, reasons, "observe", 4, "恢复阶段弱观察")
    subtractScore(scores, reasons, "explore", explorePenalty, "恢复阶段压制探索")
    subtractScore(scores, reasons, "approach", 8, "恢复阶段压制靠近")
  }

  if (phaseTag === "growth_phase") {
    addScore(scores, reasons, "explore", 16, "成长阶段推动探索")
  }

  if (phaseTag === "attachment_phase") {
    addScore(scores, reasons, "approach", 16, "依附阶段推动靠近")
  }

  if (phaseTag === "sensitive_phase") {
    const riskToleranceReduce = clamp((bias.riskTolerance - 50) * 0.08, 0, 8)
    const explorePenalty = Math.max(6, 18 - riskToleranceReduce)

    addScore(scores, reasons, "avoid", 20, "敏感阶段强防御")
    addScore(scores, reasons, "observe", 10, "敏感阶段持续观察")
    subtractScore(scores, reasons, "explore", explorePenalty, "敏感阶段压制探索")
    subtractScore(scores, reasons, "approach", 14, "敏感阶段压制靠近")
  }

  if (branchTag === "curiosity") {
    addScore(scores, reasons, "explore", 12, "探索路径推动探索")
  }

  if (branchTag === "attachment") {
    addScore(scores, reasons, "approach", 10, "亲近路径推动靠近")
  }

  if (branchTag === "defense") {
    addScore(scores, reasons, "avoid", 12, "防御路径提升回避")
    addScore(scores, reasons, "observe", 8, "防御路径提升观察")
  }

  if (hour >= 22 || hour <= 5) {
    addScore(scores, reasons, "rest", 10, "深夜时段增强恢复倾向")
  }
}

export function applyDriveHintLayer(context: DriveLayerContext) {
  const { input, scores, reasons } = context
  const hint = getDriveHint(input)

  if (!hint) return

  if (hint === "eat") addScore(scores, reasons, "eat", 14, "状态层主驱动提示")
  if (hint === "rest") addScore(scores, reasons, "rest", 14, "状态层主驱动提示")
  if (hint === "approach") addScore(scores, reasons, "approach", 14, "状态层主驱动提示")
  if (hint === "explore") addScore(scores, reasons, "explore", 14, "状态层主驱动提示")
  if (hint === "avoid") addScore(scores, reasons, "avoid", 14, "状态层主驱动提示")
  if (hint === "idle") addScore(scores, reasons, "observe", 8, "停留状态提示观察")
}

export function applyExternalStimuliLayer(context: DriveLayerContext) {
  const stimuli = context.input.externalStimuli

  if (!stimuli) return

  ;(Object.keys(stimuli) as DriveType[]).forEach((drive) => {
    const value = stimuli[drive]
    if (typeof value !== "number" || value <= 0) return

    addScore(context.scores, context.reasons, drive, value, "外部刺激")
  })
}

export function applyCrossDriveSuppression(context: DriveLayerContext) {
  const { scores, reasons } = context

  if (scores.eat >= 65) {
    const penalty = clamp((scores.eat - 65) * 0.25, 0, 18)
    scores.explore -= penalty
    scores.approach -= penalty * 0.7
    reasons.explore.push(`eat 强势压制探索 -${round(penalty)}`)
    reasons.approach.push(`eat 强势压制靠近 -${round(penalty * 0.7)}`)
  }

  if (scores.rest >= 65) {
    const penalty = clamp((scores.rest - 65) * 0.28, 0, 20)
    scores.explore -= penalty
    scores.approach -= penalty * 0.75
    reasons.explore.push(`rest 强势压制探索 -${round(penalty)}`)
    reasons.approach.push(`rest 强势压制靠近 -${round(penalty * 0.75)}`)
  }

  if (scores.avoid >= 55) {
    const penalty = clamp((scores.avoid - 55) * 0.35, 0, 22)
    scores.explore -= penalty
    scores.approach -= penalty
    reasons.explore.push(`avoid 强势压制探索 -${round(penalty)}`)
    reasons.approach.push(`avoid 强势压制靠近 -${round(penalty)}`)
  }

  if (scores.approach >= 55) {
    const penalty = clamp((scores.approach - 55) * 0.2, 0, 10)
    scores.explore -= penalty * 0.6
    reasons.explore.push(`approach 收束探索 -${round(penalty * 0.6)}`)
  }

  if (scores.explore >= 55) {
    const penalty = clamp((scores.explore - 55) * 0.18, 0, 10)
    scores.observe -= penalty * 0.5
    reasons.observe.push(
      `explore 稳定后压低纯观察 -${round(penalty * 0.5)}`
    )
  }
}
