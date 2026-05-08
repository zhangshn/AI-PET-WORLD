/**
 * 当前文件负责：处理单次 Tick 中管家推进家园建设的结果。
 */

import type { GenderAwareBehaviorBias } from "@/ai/gateway"
import type { ButlerState } from "@/types/butler"
import type { HomeState } from "@/types/home"
import type { PetState } from "@/types/pet"

import type { HomeSystem } from "@/systems/systems-gateway"

export type RunHomeConstructionInput = {
  homeSystem: HomeSystem
  pet: PetState | null
  butler: ButlerState
}

export type RunHomeConstructionResult = {
  didBuild: boolean
  completed: boolean
  progressAdded: number
  previousHome: HomeState
  currentHome: HomeState
  buildAmount: number
}

function getConstructionBias(input: {
  butler: ButlerState
}): GenderAwareBehaviorBias | null {
  return (
    input.butler.profile?.behaviorBias ??
    input.butler.behaviorBias ??
    null
  )
}

function resolveConstructionDrive(input: {
  butler: ButlerState
}): number {
  return (
    input.butler.profile?.bias.constructionDrive ??
    input.butler.profile?.behaviorBias.butlerBehaviorBias.constructionDrive ??
    input.butler.behaviorBias?.butlerBehaviorBias.constructionDrive ??
    50
  )
}

function resolveBuildAmount(input: {
  pet: PetState | null
  butler: ButlerState
}): number {
  const constructionDrive = resolveConstructionDrive({
    butler: input.butler,
  })

  let amount = 12

  amount += Math.max(0, constructionDrive - 50) * 0.08

  if (input.pet?.timelineSnapshot) {
    const energy = input.pet.timelineSnapshot.state.physical.energy
    const hunger = input.pet.timelineSnapshot.state.physical.hunger
    const lifePhase = input.pet.lifeState.phase

    if (lifePhase === "newborn" || lifePhase === "adaptation") {
      amount *= 0.75
    }

    if (energy <= 35 || hunger >= 65) {
      amount *= 0.65
    }
  }

  return Math.max(5, Math.round(amount))
}

export function runHomeConstruction(
  input: RunHomeConstructionInput
): RunHomeConstructionResult {
  const previousHome = input.homeSystem.getHome()

  if (previousHome.status === "completed") {
    return {
      didBuild: false,
      completed: true,
      progressAdded: 0,
      previousHome,
      currentHome: previousHome,
      buildAmount: 0,
    }
  }

  const buildAmount = resolveBuildAmount({
    pet: input.pet,
    butler: input.butler,
  })

  input.homeSystem.build(
    buildAmount,
    getConstructionBias({
      butler: input.butler,
    })
  )

  const currentHome = input.homeSystem.getHome()
  const progressAdded = Math.max(
    0,
    Math.round(currentHome.progress - previousHome.progress)
  )

  return {
    didBuild: progressAdded > 0,
    completed: currentHome.status === "completed",
    progressAdded,
    previousHome,
    currentHome,
    buildAmount,
  }
}
