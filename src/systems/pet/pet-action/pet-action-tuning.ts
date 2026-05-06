/**
 * 当前文件负责：集中管理宠物行为选择与稳定层的调参参数。
 */

import type { PetAction, PetLifePhase } from "../../../types/pet"

export type PetActionPhaseWeightTuning = Partial<Record<PetAction, number>>

export type PetActionRandomTuning = {
  walking: number
  exploring: number
  observing: number
}

export type PetActionMinDurationTuning = Record<PetAction, number>

export const ACTION_LIFE_PHASE_WEIGHT_TUNING: Record<
  PetLifePhase,
  PetActionPhaseWeightTuning
> = {
  newborn: {
    exploring: -34,
    walking: -18,
    observing: 22,
    resting: 18,
    approaching: 10,
  },

  adaptation: {
    exploring: -22,
    walking: -8,
    observing: 18,
    resting: 10,
  },

  dependent: {
    exploring: -10,
    approaching: 14,
    observing: 8,
  },

  curious: {
    exploring: 8,
    observing: 5,
  },

  independent: {},
}

export const ACTION_RANDOM_TUNING: PetActionRandomTuning = {
  walking: 4,
  exploring: 3,
  observing: 2,
}

export const ACTION_MIN_DURATION_TUNING: PetActionMinDurationTuning = {
  sleeping: 4,
  eating: 3,
  walking: 3,
  exploring: 4,
  approaching: 3,
  idle: 2,
  observing: 3,
  resting: 3,
  alert_idle: 3,
}

/**
 * 当前阶段的行为调参目标：
 * 1. newborn 不要过早完整探索。
 * 2. adaptation 可以从 idle 更快进入 observing。
 * 3. dependent 夜晚可以 resting，但不能被 action selector 写死。
 */
export const ACTION_TUNING_NOTES = {
  newborn:
    "刚出生阶段重点是观察、确认环境、轻微靠近，不直接完整探索。",
  adaptation:
    "适应期允许更多观察和短距离移动，但仍不鼓励长时间探索。",
  dependent:
    "依附期允许恢复和安全区休整，同时保留观察与关系靠近。",
}