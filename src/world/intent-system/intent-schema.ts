/**
 * 当前文件职责：定义管家行为意图层协议。
 */

import type { EnvironmentState } from "@/world/environment/environment-gateway"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

export type ButlerIntentType =
  | "build"
  | "maintain"
  | "plant"
  | "expand"
  | "observe"
  | "rest"
  | "reorganize"
  | "do_nothing"

export type IntentUrgency = "low" | "medium" | "high"

export type PetIntentContext = {
  energy: number
  hunger: number
  mood: string
  currentZoneType?: string
  recentAction?: string
  tags: string[]
}

export type ButlerIntentContext = {
  mood: string
  currentTask: string
  constructionStyle: ButlerConstructionStyleVector
  tags: string[]
}

export type WorldIntentContext = {
  worldTick: number
  spacePressure: number
  constructionPlanCount: number
  activeConstructionPlanCount: number
  tags: string[]
}

export type IntentCandidate = {
  type: ButlerIntentType
  score: number
  urgency: IntentUrgency
  reason: string
  drivers: string[]
  blockers: string[]
  tags: string[]
}

export type IntentDecision = {
  selectedIntent: IntentCandidate
  candidates: IntentCandidate[]
  shouldAct: boolean
  decisionReason: string
  tags: string[]
}

export type BuildButlerIntentDecisionInput = {
  butler: ButlerIntentContext
  pet: PetIntentContext
  environment: EnvironmentState
  world: WorldIntentContext
}
