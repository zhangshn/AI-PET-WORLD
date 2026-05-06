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

import type {
  ButlerTaskDecisionTrace,
} from "./butler-task-decision-trace"

import type {
  ButlerMemoryState,
} from "./butler-memory"

import type {
  ButlerRelationState,
} from "./butler-relation"

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
   */
  profile?: ButlerProfile | null

  /**
   * 旧行为偏置暂时保留。
   * 当前 task / opportunity 仍可能读取 behaviorBias。
   */
  behaviorBias?: GenderAwareBehaviorBias | null

  /**
   * 管家最近一次任务选择审计。
   * 用于解释为什么本轮选择某个任务。
   */
  latestTaskDecisionTrace?: ButlerTaskDecisionTrace | null

  /**
   * 管家长期记忆状态。
   * 当前阶段只建立容器，不直接影响任务选择。
   */
  memory: ButlerMemoryState

  /**
   * 管家与宠物之间的长期关系估计。
   * 当前阶段只建立容器，不直接影响任务选择。
   */
  relation: ButlerRelationState
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