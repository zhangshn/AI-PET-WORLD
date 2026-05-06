/**
 * 当前文件负责：定义宠物行为表达层类型。
 */

import type {
  CurrentLifeRuntimeBundle,
} from "../../../ai/gateway"

import type {
  PetAction,
  PetLifePhase,
} from "../../../types/pet"

import type {
  PetGoalState,
} from "../pet-goal/pet-goal-gateway"

export type PetExpressionReason =
  | "no_expression_change"
  | "newborn_explore_intent_softened"
  | "newborn_approach_intent_softened"
  | "newborn_low_energy_softened"
  | "adaptation_explore_intent_softened"
  | "adaptation_high_observe_expression"
  | "dependent_restore_expression"
  | "low_energy_expression_limit"
  | "high_hunger_expression_limit"

export type PetExpressionInput = {
  rawAction: PetAction
  currentAction: PetAction
  currentGoal?: PetGoalState | null
  lifePhase: PetLifePhase
  energy: number
  hunger: number
  currentLifeRuntimeBundle?: CurrentLifeRuntimeBundle | null
}

export type PetExpressionResult = {
  expressedAction: PetAction
  reason: PetExpressionReason
  internalIntent: PetAction
  summary: string
}