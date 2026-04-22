/**
 * ======================================================
 * AI-PET-WORLD
 * Memory Core Types
 * ======================================================
 *
 * 当前文件负责：
 * 1. 定义宠物记忆模块核心类型
 * 2. 定义近期行为记忆 / 结果记忆 / 世界印象 / 关系印象
 *
 * 设计原则：
 * - 记忆不是日志
 * - 记忆是“会进入下一轮判断的内部经验”
 * - 先做最小可运行版
 * - 未来宠物 / 管家 / NPC 都可复用
 * ======================================================
 */

import type { PetAction } from "../../types/pet"

export type MemoryEventKind =
  | "action_loop"
  | "need_relief"
  | "recovery"
  | "feeding_received"
  | "night_activity"
  | "night_recovery"
  | "approach_result"
  | "observation_result"
  | "exploration_result"

export type MemoryActionRecord = {
  tick: number
  day: number
  hour: number
  action: PetAction
  energy: number
  hunger: number
  mood: string
}

export type MemoryEventRecord = {
  tick: number
  day: number
  hour: number
  kind: MemoryEventKind
  summary: string
  weight: number
}

export type MemoryWorldImpression = {
  /**
   * 对夜晚的长期印象
   * 正数：夜晚更偏恢复、安全
   * 负数：夜晚更偏紧张、不安
   */
  nightSafetyBias: number

  /**
   * 对探索的长期印象
   * 正数：探索通常值得
   * 负数：探索代价更高
   */
  explorationConfidence: number

  /**
   * 对观察的长期印象
   * 正数：观察通常有帮助
   * 负数：观察价值较低
   */
  observationConfidence: number
}

export type MemoryRelationImpression = {
  /**
   * 对“照料者/外部喂食来源”的长期可靠感
   */
  caretakerTrust: number

  /**
   * 对靠近行为的总体安全感
   */
  approachSafety: number
}

export type MemorySelfImpression = {
  /**
   * 对自身恢复能力的印象
   */
  recoveryConfidence: number

  /**
   * 对自身连续探索承受力的印象
   */
  enduranceConfidence: number

  /**
   * 对自身当前生活节律的稳定感
   */
  rhythmConfidence: number
}

export type MemoryPreferenceBias = {
  /**
   * 由经验塑造出来的行动偏压
   */
  exploreBias: number
  observeBias: number
  approachBias: number
  restBias: number
  eatBias: number
}

export type PetMemoryState = {
  /**
   * 最近动作记录
   */
  recentActions: MemoryActionRecord[]

  /**
   * 最近事件记录
   */
  recentEvents: MemoryEventRecord[]

  /**
   * 世界印象
   */
  worldImpression: MemoryWorldImpression

  /**
   * 关系印象
   */
  relationImpression: MemoryRelationImpression

  /**
   * 自我印象
   */
  selfImpression: MemorySelfImpression

  /**
   * 经验偏压
   */
  preferenceBias: MemoryPreferenceBias

  /**
   * 对外摘要
   */
  summaries: string[]
}

export type UpdateMemoryInput = {
  previousMemory: PetMemoryState
  tick: number
  time: {
    day: number
    hour: number
    period?: string
  }
  action: PetAction
  energyBefore: number
  energyAfter: number
  hungerBefore: number
  hungerAfter: number
  moodBefore: string
  moodAfter: string
  wasFed?: boolean
}