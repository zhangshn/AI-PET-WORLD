/**
 * ======================================================
 * AI-PET-WORLD
 * Memory Core Builder
 * ======================================================
 *
 * 当前文件负责：
 * 1. 构建宠物初始记忆
 * 2. 出生时建立空记忆容器
 *
 * 说明：
 * - 宠物出生时不应该有完整经验记忆
 * - 但应该有“可写入的记忆结构”
 * ======================================================
 */

import type { PetMemoryState } from "./memory-types"

export function buildInitialPetMemoryState(): PetMemoryState {
  return {
    recentActions: [],
    recentEvents: [],
    worldImpression: {
      nightSafetyBias: 0,
      explorationConfidence: 0,
      observationConfidence: 0,
    },
    relationImpression: {
      caretakerTrust: 0,
      approachSafety: 0,
    },
    selfImpression: {
      recoveryConfidence: 0,
      enduranceConfidence: 0,
      rhythmConfidence: 0,
    },
    preferenceBias: {
      exploreBias: 0,
      observeBias: 0,
      approachBias: 0,
      restBias: 0,
      eatBias: 0,
    },
    summaries: [],
  }
}