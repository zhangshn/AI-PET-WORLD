/**
 * 当前文件负责：定义宠物 AI 学习层的最小状态结构。
 *
 * learning 不等于 memory。
 * memory 记录发生过什么，learning 表示这些经历稳定改变了什么。
 */

export type PetLearningState = {
  /**
   * 对食物机会的熟悉度。
   *
   * 来源：memory.preferenceBias.eatBias、relationImpression.caretakerTrust。
   * 作用：只能轻量影响 evaluateFoodOffer 的接受评分。
   */
  foodFamiliarity: number

  /**
   * 对休息 / 恢复机会的熟悉度。
   *
   * 来源：memory.preferenceBias.restBias、selfImpression.recoveryConfidence。
   * 作用：只能轻量影响 evaluateRestOffer 的接受评分。
   */
  restFamiliarity: number

  /**
   * 对照料者 / 管家照看行为的长期信任学习。
   *
   * 来源：memory.relationImpression.caretakerTrust。
   * 作用：只能轻量影响机会判断，不直接控制行为。
   */
  butlerTrustLearning: number

  /**
   * 对靠近 / 关系机会的安全学习。
   *
   * 来源：memory.preferenceBias.approachBias、relationImpression.approachSafety。
   * 作用：只能轻量影响 evaluateApproachOffer 的接受评分。
   */
  approachSafetyLearning: number

  /**
   * 最近一次学习更新时间。
   */
  lastUpdatedTick: number | null

  /**
   * 学习摘要。
   *
   * 用于审计和后续展示，但不是系统日志。
   */
  summaries: string[]
}

export type UpdatePetLearningInput = {
  previousLearning: PetLearningState
  memoryState: {
    preferenceBias: {
      eatBias: number
      restBias: number
      approachBias: number
      exploreBias: number
      observeBias: number
    }
    relationImpression: {
      caretakerTrust: number
      approachSafety: number
    }
    selfImpression: {
      recoveryConfidence: number
      enduranceConfidence: number
      rhythmConfidence: number
    }
  }
  tick: number
}