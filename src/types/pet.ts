/**
 * ======================================================
 * AI-PET-WORLD
 * Pet Type
 * ======================================================
 */

import type {
  PersonalityProfile,
  PetTimelineSnapshot,
} from "../ai/gateway"

import type {
  ZiweiConsciousnessKernel,
} from "../ai/consciousness/consciousness-gateway"

import type {
  PetMemoryState,
} from "../ai/memory-core/memory-gateway"

import type {
  PetGoalState,
} from "../systems/goalSystem"

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

export type PetState = {
  name: string
  energy: number
  hunger: number
  mood: PetMood
  action: PetAction

  /**
   * 固定人格结果
   */
  personalityProfile: PersonalityProfile

  /**
   * 紫微意识核
   */
  consciousnessProfile: ZiweiConsciousnessKernel

  /**
   * 当前目标
   */
  currentGoal?: PetGoalState

  /**
   * 经验记忆
   */
  memoryState: PetMemoryState

  /**
   * 当前时间线快照
   */
  timelineSnapshot?: PetTimelineSnapshot
}