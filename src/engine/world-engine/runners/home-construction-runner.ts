/**
 * 当前文件负责：根据管家行为执行快照，安全推进单次 Tick 中的家园建设。
 *
 * 注意：
 * 家园建设必须经过 ButlerState.latestBehaviorExecution 边界。
 * 管家可以影响家园，但不能借此控制宠物。
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

function canButlerAffectHome(input: {
  butler: ButlerState
}): boolean {
  const execution = input.butler.latestBehaviorExecution

  if (!execution) return false
  if (!execution.canAffectHome) return false

  return (
    execution.kind === "home_building" ||
    execution.kind === "home_maintenance" ||
    execution.kind === "space_tidying"
  )
}

function resolveExecutionHomeMultiplier(input: {
  butler: ButlerState
}): number {
  const execution = input.butler.latestBehaviorExecution

  if (!execution) return 0

  if (execution.kind === "home_building") {
    return 1
  }

  if (execution.kind === "home_maintenance") {
    return 0.55
  }

  if (execution.kind === "space_tidying") {
    return 0.35
  }

  return 0
}

function resolveExecutionIntensityMultiplier(input: {
  butler: ButlerState
}): number {
  const execution = input.butler.latestBehaviorExecution

  if (!execution) return 0

  return Math.max(0.2, Math.min(1.4, execution.intensity / 60))
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

  const executionMultiplier = resolveExecutionHomeMultiplier({
    butler: input.butler,
  })

  const intensityMultiplier = resolveExecutionIntensityMultiplier({
    butler: input.butler,
  })

  amount *= executionMultiplier
  amount *= intensityMultiplier

  return Math.max(1, Math.round(amount))
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

  if (!canButlerAffectHome({ butler: input.butler })) {
    return {
      didBuild: false,
      completed: false,
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

  input.homeSystem.applyButlerSpaceAction(
    input.butler.latestBehaviorExecution
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
