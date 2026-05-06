/**
 * 当前文件负责：定义管家系统的核心类型。
 */

import type { PetState } from "@/types/pet"
import type { IncubatorState } from "@/types/incubator"
import type { HomeState } from "@/types/home"
import type {
  ButlerProfile,
  GenderAwareBehaviorBias,
} from "@/ai/gateway"

export type ButlerTask =
  | "watching_incubator"
  | "building_home"
  | "watching_pet"
  | "offering_food"
  | "offering_rest"
  | "offering_approach"
  | "idle"

export type ButlerMood =
  | "calm"
  | "busy"
  | "gentle"
  | "alert"
  | "focused"

export type ButlerOpportunityType =
  | "food_offer"
  | "rest_offer"
  | "approach_offer"

export type ButlerOpportunityCooldowns = Record<
  ButlerOpportunityType,
  number
>

export type ButlerOpportunity = {
  id: string
  type: ButlerOpportunityType
  createdAtTick: number
  expiresAtTick: number
  createdBy: "butler"
  target: "pet"
  summary: string
  intensity: number
  payload?: {
    foodPortion?: number
    comfortLevel?: number
    socialWarmth?: number
  }
}

export type ButlerState = {
  name: string
  task: ButlerTask
  mood: ButlerMood
  lastTaskChangedTick: number
  pendingOpportunities: ButlerOpportunity[]
  opportunityCooldowns: ButlerOpportunityCooldowns

  /**
   * 管家人格 Profile。
   * 由 AI 层 butler-profile-core 生成，systems 层只保存结果。
   * 当前阶段不让 profile 直接决定行为，只进入状态和后续审计链路。
   */
  profile?: ButlerProfile | null

  /**
   * 旧行为偏置暂时保留。
   * 当前 task / opportunity 仍可能读取 behaviorBias。
   */
  behaviorBias?: GenderAwareBehaviorBias | null
}

export type ButlerSystemInput = {
  tick: number
  pet: PetState | null
  incubator: IncubatorState | null
  home: HomeState | null
  time: {
    day: number
    hour: number
    period?: string
  }
  butlerBehaviorBias?: GenderAwareBehaviorBias | null
}