/**
 * 当前文件负责：提供宠物目标系统的上下文读取工具。
 */

import type { ZiweiConsciousnessKernel } from "../../../ai/consciousness/consciousness-gateway"
import type { PetMemoryState } from "../../../ai/memory-core/memory-gateway"

import type {
  GoalSystemInput,
} from "./pet-goal-types"

export function getGoalEnergy(input: GoalSystemInput): number {
  return input.pet.timelineSnapshot?.state.physical.energy ?? input.pet.energy
}

export function getGoalHunger(input: GoalSystemInput): number {
  return input.pet.timelineSnapshot?.state.physical.hunger ?? input.pet.hunger
}

export function getGoalEmotion(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.state.emotional.label ?? input.pet.mood
}

export function getGoalRelation(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.state.relational.label ?? "neutral"
}

export function getGoalPhaseTag(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.fortune.phaseTag ?? "stable_phase"
}

export function getGoalBranchTag(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.trajectory.branchTag ?? "balanced"
}

export function getGoalKernel(
  input: GoalSystemInput
): ZiweiConsciousnessKernel {
  return input.pet.consciousnessProfile
}

export function getGoalMemory(input: GoalSystemInput): PetMemoryState {
  return input.pet.memoryState
}