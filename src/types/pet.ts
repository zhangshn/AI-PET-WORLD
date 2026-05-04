/**
 * 当前文件负责：定义宠物状态类型。
 */

import type {
  LifePersonalityProfileBundle,
  PetTimelineSnapshot,
} from "../ai/gateway"

import type {
  PetGoalState,
} from "../systems/pet/pet-goal/pet-goal-gateway"

import type {
  PetCognitionRecord,
} from "./cognition"

import type {
  ActiveBehaviorProcess,
} from "../ai/behavior-core/behavior-gateway"

export type PetAction =
  | "sleeping"
  | "eating"
  | "walking"
  | "exploring"
  | "approaching"
  | "idle"
  | "observing"
  | "resting"
  | "alert_idle"

export type PetMood =
  | "happy"
  | "normal"
  | "sad"
  | "calm"
  | "curious"
  | "alert"

export type PetLifePhase =
  | "newborn"
  | "adaptation"
  | "dependent"
  | "curious"
  | "independent"

export type PetLifeState = {
  phase: PetLifePhase
  ageTicks: number
  bornAtTick: number
  safeRadius: number
  maxExploreRadius: number
}

export type PetState = {
  name: string
  energy: number
  hunger: number
  mood: PetMood
  action: PetAction

  lifeProfile: LifePersonalityProfileBundle

  lifeState: PetLifeState

  currentGoal?: PetGoalState
  timelineSnapshot?: PetTimelineSnapshot
  latestCognition?: PetCognitionRecord | null
  recentCognition: PetCognitionRecord[]
  activeBehaviorProcess?: ActiveBehaviorProcess | null
}