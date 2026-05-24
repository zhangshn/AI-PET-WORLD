/**
 * Minimal butler motivation protocol for live runtime ticks.
 */

export type ButlerRuntimeMotivationType =
  | "continue_construction"
  | "maintain_home"
  | "wait_for_resources"
  | "observe_world"

export type ButlerRuntimeMotivationScore = {
  type: ButlerRuntimeMotivationType
  baseScore: number
  resourceScore: number
  continuityScore: number
  riskPenalty: number
  finalScore: number
  reasons: string[]
  tags: string[]
}

export type ButlerRuntimeDecision = {
  tick: number
  selectedMotivation: ButlerRuntimeMotivationType
  shouldRunConstructionTick: boolean
  tickReason: ButlerRuntimeMotivationType
  scores: ButlerRuntimeMotivationScore[]
  reasons: string[]
  createdAt: string
  tags: string[]
}
