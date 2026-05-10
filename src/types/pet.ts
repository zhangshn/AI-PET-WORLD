/**
 * 当前文件负责：定义宠物状态类型。
 */

import type {
  BaziProfile,
  CurrentLifeRuntimeBundle,
  LifePersonalityProfileBundle,
  PersonalityProfile,
  PetTimelineSnapshot,
  PublicPersonalityView,
} from "../ai/gateway"

import type {
  ZiweiConsciousnessKernel,
} from "../ai/consciousness-core/consciousness/consciousness-gateway"

import type {
  PetMemoryState,
} from "../ai/memory-core/memory-gateway"

import type {
  PetLearningState,
} from "../systems/pet/learning/pet-learning-gateway"

import type {
  PetGoalState,
} from "../systems/pet/goal/pet-goal-gateway"

import type {
  PetWorldPerceptionSnapshot,
} from "../systems/agent-perception/agent-world-perception"

import type {
  AgentConsciousnessInterpretation,
} from "../systems/agent-perception/agent-consciousness-interpretation"

import type {
  PetCognitionRecord,
} from "./cognition"

import type {
  ActiveBehaviorProcess,
} from "../ai/behavior-core/behavior-gateway"

export type PetGenderPerspective = "male" | "female"

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
  genderPerspective: PetGenderPerspective

  energy: number
  hunger: number
  mood: PetMood
  action: PetAction

  lifeProfile: LifePersonalityProfileBundle

  personalityProfile: PersonalityProfile
  publicPersonalityView: PublicPersonalityView | null
  baziProfile: BaziProfile
  consciousnessProfile: ZiweiConsciousnessKernel

  /**
   * 当前世界时间下的生命运行动态包。
   * 这里只保存运行上下文，不直接决定行为。
   */
  currentLifeRuntimeBundle?: CurrentLifeRuntimeBundle | null

  lifeState: PetLifeState

  currentGoal?: PetGoalState
  memoryState: PetMemoryState
  learningState: PetLearningState
  timelineSnapshot?: PetTimelineSnapshot

  /**
   * 宠物最近一次世界感知快照。
   * 这里只保存“宠物可能注意到的环境线索”，不直接决定 action / drive。
   */
  latestWorldPerception?: PetWorldPerceptionSnapshot | null

  /**
   * 宠物最近一次意识解释快照。
   * 这里只保存“宠物如何解释感知线索”，不直接决定 action / drive。
   */
  latestWorldInterpretation?: AgentConsciousnessInterpretation | null

  latestCognition?: PetCognitionRecord | null
  recentCognition: PetCognitionRecord[]
  activeBehaviorProcess?: ActiveBehaviorProcess | null
}