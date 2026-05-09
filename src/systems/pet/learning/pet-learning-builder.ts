/**
 * 当前文件负责：创建宠物 AI 学习层的初始状态。
 */

import type { PetLearningState } from "./pet-learning-schema"

export function createInitialPetLearningState(): PetLearningState {
  return {
    foodFamiliarity: 0,
    restFamiliarity: 0,
    butlerTrustLearning: 0,
    approachSafetyLearning: 0,
    lastUpdatedTick: null,
    summaries: [],
  }
}