/**
 * 当前文件负责：定义与维护管家和宠物之间的长期关系状态。
 */

export type ButlerRelationTone =
  | "unfamiliar"
  | "observing"
  | "familiar"
  | "trusted"
  | "guarded"

export type ButlerRelationState = {
  familiarity: number
  trustEstimate: number
  careHistory: number
  observationCount: number
  successfulOffers: number
  rejectedOffers: number
  lastInteractionTick: number | null
  tone: ButlerRelationTone
  tags: string[]
}

export function createInitialButlerRelationState(): ButlerRelationState {
  return {
    familiarity: 0,
    trustEstimate: 0,
    careHistory: 0,
    observationCount: 0,
    successfulOffers: 0,
    rejectedOffers: 0,
    lastInteractionTick: null,
    tone: "unfamiliar",
    tags: [],
  }
}