/**
 * 当前文件负责：定义世界层正式使用的管家类型。
 */

import type { FinalPersonalityProfile } from "../ai/gateway"

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