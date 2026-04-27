/**
 * ======================================================
 * AI-PET-WORLD
 * Behavior Core Types
 * ======================================================
 *
 * 当前文件负责：
 * 1. 定义行为内部过程类型
 * 2. 定义行为阶段
 * 3. 定义行为影响结果
 * ======================================================
 */

import type { PetAction } from "../../types/pet"
import type { PetCognitionRecord } from "../../types/cognition"

export type BehaviorProcessType =
  | "chasing_target"
  | "careful_observation"
  | "seeking_comfort_zone"
  | "none"

export type BehaviorProcessStage =
  | "start"
  | "engaged"
  | "peak"
  | "cooldown"
  | "finished"

export type BehaviorDelta = {
  energyDelta: number
  hungerDelta: number
  emotionalShift: number
}

export type ActiveBehaviorProcess = {
  type: BehaviorProcessType
  stage: BehaviorProcessStage
  sourceStimulusId: string
  sourceStimulusType: string
  startedAtTick: number
  updatedAtTick: number
  endAtTick: number
  summary: string
}

export type BuildBehaviorProcessInput = {
  tick: number
  cognition: PetCognitionRecord
  currentAction: PetAction
  energy: number
  hunger: number
}

export type StepBehaviorProcessInput = {
  tick: number
  process: ActiveBehaviorProcess
  energy: number
  hunger: number
}

export type StepBehaviorProcessResult = {
  nextProcess: ActiveBehaviorProcess | null
  delta: BehaviorDelta
  suggestedAction?: PetAction
  summary: string
}