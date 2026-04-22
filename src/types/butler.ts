/**
 * ======================================================
 * AI-PET-WORLD
 * Butler Type
 * ======================================================
 *
 * 当前文件负责：
 * 1. 定义世界层正式使用的管家类型
 * 2. 统一 worldEngine / eventSystem / UI 使用的 ButlerState
 *
 * 说明：
 * - 这里的类型要和 systems/butlerSystem.ts 对齐
 * - 否则世界层与系统层会发生类型冲突
 * ======================================================
 */

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
}