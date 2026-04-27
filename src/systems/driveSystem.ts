/**
 * 当前文件负责：根据人格底盘、时间、状态、意识偏压与外部刺激，统一计算宠物当前的 drive 强度与主导 drive
 */

import type { TimeState } from "../engine/timeSystem"
import type { PetState } from "../types/pet"
import type { PersonalityTraits } from "../ai/ziwei-core/schema"
import type { ConsciousnessBias } from "../ai/consciousness/consciousness-gateway"

export type DriveType =
  | "eat"
  | "rest"
  | "avoid"
  | "approach"
  | "explore"
  | "observe"

export type DriveScores = Record<DriveType, number>

export type DriveSnapshot = {
  values: DriveScores
  dominant: DriveType
  dominantScore: number
  reasons: Record<DriveType, string[]>
  summary: string
}

export type DriveSystemInput = {
  pet: Pick<
    PetState,
    | "energy"
    | "hunger"
    | "mood"
    | "timelineSnapshot"
    | "personalityProfile"
    | "consciousnessProfile"
  >
  time: TimeState
  externalStimuli?: Partial<Record<DriveType, number>>
}

type TimelineSnapshot = NonNullable<PetState["timelineSnapshot"]>

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function createEmptyScores(): DriveScores {
  return {
    eat: 0,
    rest: 0,
    avoid: 0,
    approach: 0,
    explore: 0,
    observe: 0,
  }
}

function createEmptyReasons(): Record<DriveType, string[]> {
  return {
    eat: [],
    rest: [],
    avoid: [],
    approach: [],
    explore: [],
    observe: [],
  }
}

function addScore(
  scores: DriveScores,
  reasons: Record<DriveType, string[]>,
  drive: DriveType,
  amount: number,
  reason: string
) {
  if (amount <= 0) return
  scores[drive] += amount
  reasons[drive].push(`${reason} +${round(amount)}`)
}

function subtractScore(
  scores: DriveScores,
  reasons: Record<DriveType, string[]>,
  drive: DriveType,
  amount: number,
  reason: string
) {
  if (amount <= 0) return
  scores[drive] -= amount
  reasons[drive].push(`${reason} -${round(amount)}`)
}

function getTraits(pet: DriveSystemInput["pet"]): PersonalityTraits {
  return pet.personalityProfile.traits
}

function getConsciousnessBias(
  pet: DriveSystemInput["pet"]
): ConsciousnessBias {
  return pet.consciousnessProfile.bias
}

function getSnapshot(pet: DriveSystemInput["pet"]): TimelineSnapshot | null {
  return pet.timelineSnapshot ?? null
}

function getEnergy(input: DriveSystemInput): number {
  const snapshot = getSnapshot(input.pet)
  return clamp(snapshot?.state.physical.energy ?? input.pet.energy ?? 50)
}

function getHunger(input: DriveSystemInput): number {
  const snapshot = getSnapshot(input.pet)
  return clamp(snapshot?.state.physical.hunger ?? input.pet.hunger ?? 50)
}

function getEmotionalLabel(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input.pet)
  return snapshot?.state.emotional.label ?? input.pet.mood ?? "normal"
}

function getEmotionalArousal(input: DriveSystemInput): number {
  const snapshot = getSnapshot(input.pet)
  return clamp((snapshot?.state.emotional.arousal ?? 0.5) * 100)
}

function getCognitiveLabel(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input.pet)
  return snapshot?.state.cognitive.label ?? "idle"
}

function getRelationalLabel(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input.pet)
  return snapshot?.state.relational.label ?? "neutral"
}

function getPhaseTag(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input.pet)
  return snapshot?.fortune.phaseTag ?? "stable_phase"
}

function getBranchTag(input: DriveSystemInput): string {
  const snapshot = getSnapshot(input.pet)
  return snapshot?.trajectory.branchTag ?? "balanced"
}

function getLegacyDriveHint(input: DriveSystemInput): string | null {
  const snapshot = getSnapshot(input.pet)
  return snapshot?.state.drive.primary ?? null
}

function applyTraitBaseLayer(
  input: DriveSystemInput,
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
  const traits = getTraits(input.pet)

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

function applyConsciousnessLayer(
  input: DriveSystemInput,
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
  const bias = getConsciousnessBias(input.pet)

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

function applyPhysicalLayer(
  input: DriveSystemInput,
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
  const hunger = getHunger(input)
  const energy = getEnergy(input)
  const bias = getConsciousnessBias(input.pet)

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

  /**
   * consciousness 只能在“疲惫但未危险”阶段对抗休息
   * 不能越过生理极限
   */
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
    subtractScore(
      scores,
      reasons,
      "explore",
      hungerExplorePenalty,
      "高饥饿压制探索"
    )

    const hungerApproachPenalty = clamp((hunger - 60) * 0.16, 0, 12)
    subtractScore(
      scores,
      reasons,
      "approach",
      hungerApproachPenalty,
      "高饥饿压制靠近"
    )
  }

  if (energy <= 40) {
    const lowEnergyExplorePenalty = clamp((40 - energy) * 0.35, 0, 18)
    subtractScore(
      scores,
      reasons,
      "explore",
      lowEnergyExplorePenalty,
      "低精力压制探索"
    )

    const lowEnergyApproachPenalty = clamp((40 - energy) * 0.22, 0, 12)
    subtractScore(
      scores,
      reasons,
      "approach",
      lowEnergyApproachPenalty,
      "低精力压制靠近"
    )
  }

  /**
   * 危险疲惫区：
   * - consciousness 还可以拖延一点点
   * - 但 explore / approach 必须明显衰退
   */
  if (energy <= 20 && energy > 10) {
    addScore(scores, reasons, "rest", 22, "危险疲惫推动恢复")
    addScore(scores, reasons, "eat", 4, "危险疲惫抬高补给需求")

    subtractScore(scores, reasons, "explore", 18, "危险疲惫强压探索")
    subtractScore(scores, reasons, "approach", 14, "危险疲惫强压靠近")

    /**
     * 允许高 observation 个体进入观察性停顿，而不是继续猛冲
     */
    addScore(scores, reasons, "observe", 6, "危险疲惫转入观察停顿")
  }

  /**
   * 生理崩溃区：
   * - 生理层绝对接管
   * - consciousness 不得越过生存底线
   */
  if (energy <= 10) {
    addScore(scores, reasons, "rest", 40, "生理极限强制恢复")
    addScore(scores, reasons, "eat", 8, "生理极限抬高基础补给")

    subtractScore(scores, reasons, "explore", 40, "生理极限禁止探索")
    subtractScore(scores, reasons, "approach", 32, "生理极限禁止靠近")
    subtractScore(scores, reasons, "avoid", 8, "生理极限压低外向防御活动")

    addScore(scores, reasons, "observe", 4, "生理极限残留环境留意")
  }

  /**
   * 极低能量：
   * 进一步锁住向外行为，确保 rest 必然主导
   */
  if (energy <= 8) {
    addScore(scores, reasons, "rest", 55, "崩溃边界强制休息")
    subtractScore(scores, reasons, "explore", 60, "崩溃边界切断探索")
    subtractScore(scores, reasons, "approach", 50, "崩溃边界切断靠近")
    subtractScore(scores, reasons, "observe", 10, "崩溃边界削弱观察")
  }
}

function applyEmotionAndRelationLayer(
  input: DriveSystemInput,
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
  const emotional = getEmotionalLabel(input)
  const arousal = getEmotionalArousal(input)
  const relational = getRelationalLabel(input)
  const cognitive = getCognitiveLabel(input)
  const bias = getConsciousnessBias(input.pet)

  if (emotional === "alert") {
    addScore(scores, reasons, "observe", 18, "警觉提升观察")
    addScore(scores, reasons, "avoid", 10, "警觉抬高防御")
  }

  if (emotional === "anxious" || emotional === "irritated") {
    addScore(scores, reasons, "avoid", 22, "不安/烦躁推动回避")
    addScore(scores, reasons, "observe", 10, "不安提升观察")

    const explorePenalty = clamp(12 - (bias.riskTolerance - 50) * 0.08, 4, 12)
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

function applyRhythmLayer(
  input: DriveSystemInput,
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
  const period = input.time.period
  const hour = input.time.hour
  const phaseTag = getPhaseTag(input)
  const branchTag = getBranchTag(input)
  const bias = getConsciousnessBias(input.pet)

  if (period === "Night") {
    addScore(scores, reasons, "rest", 18, "夜晚节律推动休息")
    addScore(scores, reasons, "observe", 6, "夜晚提升边界观察")
    subtractScore(scores, reasons, "explore", 8, "夜晚轻度压制探索")
  }

  if (period === "Morning" || period === "Daytime") {
    addScore(scores, reasons, "explore", 8, "白天节律支持探索")
  }

  if (phaseTag === "recovery_phase") {
    addScore(scores, reasons, "rest", 22, "恢复阶段强恢复")
    addScore(scores, reasons, "observe", 4, "恢复阶段弱观察")

    const restResistanceReduce = clamp((bias.restResistance - 50) * 0.08, 0, 6)
    const explorePenalty = Math.max(4, 12 - restResistanceReduce)
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
    addScore(scores, reasons, "avoid", 20, "敏感阶段强防御")
    addScore(scores, reasons, "observe", 10, "敏感阶段持续观察")

    const riskToleranceReduce = clamp((bias.riskTolerance - 50) * 0.08, 0, 8)
    const explorePenalty = Math.max(6, 18 - riskToleranceReduce)
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

function applyLegacyDriveHintLayer(
  input: DriveSystemInput,
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
  const hint = getLegacyDriveHint(input)

  if (!hint) return

  if (hint === "eat") {
    addScore(scores, reasons, "eat", 14, "状态层主驱动提示")
  }

  if (hint === "rest") {
    addScore(scores, reasons, "rest", 14, "状态层主驱动提示")
  }

  if (hint === "approach") {
    addScore(scores, reasons, "approach", 14, "状态层主驱动提示")
  }

  if (hint === "explore") {
    addScore(scores, reasons, "explore", 14, "状态层主驱动提示")
  }

  if (hint === "avoid") {
    addScore(scores, reasons, "avoid", 14, "状态层主驱动提示")
  }

  if (hint === "idle") {
    addScore(scores, reasons, "observe", 8, "停留状态提示观察")
  }
}

function applyExternalStimuliLayer(
  input: DriveSystemInput,
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
  const stimuli = input.externalStimuli

  if (!stimuli) return

  ;(Object.keys(stimuli) as DriveType[]).forEach((drive) => {
    const value = stimuli[drive]
    if (typeof value !== "number" || value <= 0) return

    addScore(scores, reasons, drive, value, "外部刺激")
  })
}

function applyCrossDriveSuppression(
  scores: DriveScores,
  reasons: Record<DriveType, string[]>
) {
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

function normalizeScores(scores: DriveScores) {
  ;(Object.keys(scores) as DriveType[]).forEach((key) => {
    scores[key] = clamp(round(scores[key]))
  })
}

function chooseDominantDrive(scores: DriveScores): {
  dominant: DriveType
  dominantScore: number
} {
  const drivePriority: DriveType[] = [
    "eat",
    "rest",
    "avoid",
    "approach",
    "explore",
    "observe",
  ]

  let dominant: DriveType = "observe"
  let dominantScore = -1

  for (const drive of drivePriority) {
    const score = scores[drive]
    if (score > dominantScore) {
      dominant = drive
      dominantScore = score
    }
  }

  return {
    dominant,
    dominantScore,
  }
}

function buildSummary(snapshot: DriveSnapshot): string {
  return `当前主导 drive 为 ${snapshot.dominant}（${snapshot.dominantScore}）`
}

export class DriveSystem {
  compute(input: DriveSystemInput): DriveSnapshot {
    const scores = createEmptyScores()
    const reasons = createEmptyReasons()

    applyTraitBaseLayer(input, scores, reasons)
    applyConsciousnessLayer(input, scores, reasons)
    applyPhysicalLayer(input, scores, reasons)
    applyEmotionAndRelationLayer(input, scores, reasons)
    applyRhythmLayer(input, scores, reasons)
    applyLegacyDriveHintLayer(input, scores, reasons)
    applyExternalStimuliLayer(input, scores, reasons)
    applyCrossDriveSuppression(scores, reasons)

    normalizeScores(scores)

    const { dominant, dominantScore } = chooseDominantDrive(scores)

    const snapshot: DriveSnapshot = {
      values: scores,
      dominant,
      dominantScore,
      reasons,
      summary: "",
    }

    snapshot.summary = buildSummary(snapshot)

    return snapshot
  }
}

export const driveSystem = new DriveSystem()

export default driveSystem