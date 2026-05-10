/**
 * 当前文件负责：定义管家行为执行层的最小类型。
 *
 * 行为执行层不负责选择任务。
 * 它只把当前任务、关系、教育策略和管家感知转换为可被世界读取的行为执行快照。
 */

import type {
  ButlerWorldPerceptionSnapshot,
} from "@/systems/agent-perception/agent-world-perception"

import type {
  ButlerEducationStrategy,
} from "../../education/strategy/butler-education-strategy-gateway"

import type {
  ButlerRelationState,
} from "../../memory-relation/butler-relation"

import type {
  ButlerTask,
} from "../../butler-schema"

export type ButlerBehaviorExecutionKind =
  | "idle_observation"
  | "incubator_watch"
  | "home_building"
  | "home_maintenance"
  | "space_tidying"
  | "care_opportunity_support"
  | "protective_waiting"
  | "world_state_explanation"

export type ButlerBehaviorExecutionTarget =
  | "none"
  | "incubator"
  | "home"
  | "garden"
  | "pet"
  | "world"
  | "player"

export type ButlerBehaviorExecution = {
  kind: ButlerBehaviorExecutionKind
  target: ButlerBehaviorExecutionTarget
  intensity: number
  canAffectHome: boolean
  canAffectPet: boolean
  canContactPlayer: boolean
  summary: string
  reason: string
  tags: string[]
  createdAtTick: number
}

export type BuildButlerBehaviorExecutionInput = {
  task: ButlerTask
  relation: ButlerRelationState
  educationStrategy: ButlerEducationStrategy | null
  butlerWorldPerception?: ButlerWorldPerceptionSnapshot | null
  tick: number
}
