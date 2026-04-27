/**
 * 当前文件负责：定义管家系统的核心类型。
 */

import type { PetState } from "@/types/pet"
import type { IncubatorState } from "@/types/incubator"
import type { HomeState } from "@/types/home"
import type { FinalPersonalityProfile } from "@/ai/gateway"

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
  finalPersonalityProfile?: FinalPersonalityProfile | null
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
  butlerPersonalityProfile?: FinalPersonalityProfile | null
}