/**
 * 当前文件负责：编排宠物目标系统，并输出当前目标。
 */

import {
  applyGoalDriveAlignmentLayer,
} from "./pet-goal-drive-alignment-layer"

import {
  applyGoalLifeTendencyLayer,
} from "./pet-goal-life-tendency-layer"

import {
  chooseBaseGoal,
} from "./pet-goal-choice-layer"

import {
  buildGoalDuration,
} from "./pet-goal-duration-layer"

import {
  shouldKeepPreviousGoal,
} from "./pet-goal-persistence-layer"

import {
  getGoalKernel,
  getGoalMemory,
} from "./pet-goal-context"

import type {
  GoalDraft,
  GoalPriority,
  GoalSystemInput,
  PetGoalDriveAlignment,
  PetGoalLifeTendencyHint,
  PetGoalState,
  PetGoalType,
} from "./pet-goal-types"

function applyRuntimeGoalLayers(
  input: GoalSystemInput,
  goal: GoalDraft
): GoalDraft {
  const driveAligned = applyGoalDriveAlignmentLayer({
    goal,
    driveSnapshot: input.driveSnapshot ?? null,
  })

  return applyGoalLifeTendencyLayer({
    goal: driveAligned,
    pet: {
      currentLifeRuntimeBundle:
        input.pet.currentLifeRuntimeBundle ?? null,
    },
  })
}

function refreshPreviousGoal(input: GoalSystemInput): PetGoalState {
  const previousGoal = input.previousGoal

  if (!previousGoal) {
    throw new Error("refreshPreviousGoal 需要 previousGoal。")
  }

  const {
    startedAtTick,
    holdUntilTick,
    ...goalWithoutRuntimeFields
  } = previousGoal

  const interpreted = applyRuntimeGoalLayers(
    input,
    goalWithoutRuntimeFields
  )

  return {
    ...previousGoal,
    ...interpreted,
    startedAtTick,
    holdUntilTick,
  }
}

export class GoalSystem {
  compute(input: GoalSystemInput): PetGoalState {
    if (shouldKeepPreviousGoal(input) && input.previousGoal) {
      return refreshPreviousGoal(input)
    }

    const kernel = getGoalKernel(input)
    const memory = getGoalMemory(input)

    const chosen = chooseBaseGoal(input)
    const interpreted = applyRuntimeGoalLayers(input, chosen)

    const duration = buildGoalDuration({
      goalType: interpreted.type,
      kernel,
      memory,
    })

    return {
      ...interpreted,
      startedAtTick: input.tick,
      holdUntilTick: input.tick + duration,
    }
  }
}

export const goalSystem = new GoalSystem()
export default goalSystem

export type {
  GoalDraft,
  GoalPriority,
  GoalSystemInput,
  PetGoalDriveAlignment,
  PetGoalLifeTendencyHint,
  PetGoalState,
  PetGoalType,
} from "./pet-goal-types"