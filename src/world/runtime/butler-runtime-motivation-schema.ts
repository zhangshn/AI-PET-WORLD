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
  traceContextScore: number
  riskPenalty: number
  finalScore: number
  reasons: string[]
  tags: string[]
}

export type ButlerTraceMotivationContext = {
  tracePressure: number
  familiarRegionCount: number
  highMaintenanceTraceCount: number
  preferredObservationRegions: string[]
  highTraceMovementCostRegions: string[]
  memorySeedCount: number
  butlerMemoryHintCount: number
  ecologyMemoryHintCount: number
  relationshipMemoryHintCount: number
  traceAttentionScore: number
  maintenanceHintScore: number
  observationHintScore: number
  warnings: string[]
  tags: string[]
}

export type ButlerRuntimeDecision = {
  tick: number
  selectedMotivation: ButlerRuntimeMotivationType
  shouldRunConstructionTick: boolean
  tickReason: ButlerRuntimeMotivationType
  scores: ButlerRuntimeMotivationScore[]
  traceContext: ButlerTraceMotivationContext
  reasons: string[]
  createdAt: string
  tags: string[]
}
