/**
 * 当前文件负责：推进宠物生命周期阶段，并根据人格偏向更新安全半径与探索半径。
 */

import type { PetState } from "../../types/pet"

export type RunPetLifeInput = {
  pet: PetState
}

export type RunPetLifeResult = {
  pet: PetState
}

export function runPetLife(input: RunPetLifeInput): RunPetLifeResult {
  const nextPet: PetState = {
    ...input.pet,
    lifeState: {
      ...input.pet.lifeState,
      ageTicks: input.pet.lifeState.ageTicks + 1,
    },
  }

  const petBias = nextPet.finalPersonalityProfile.bias.petBehaviorBias
  const activityBias = petBias.newbornActivity
  const explorationBias = petBias.explorationRange
  const ageTicks = nextPet.lifeState.ageTicks

  if (ageTicks < 6) {
    nextPet.lifeState = {
      ...nextPet.lifeState,
      phase: "newborn",
      safeRadius: 70,
      maxExploreRadius: 90,
    }

    return { pet: nextPet }
  }

  if (ageTicks < 14) {
    nextPet.lifeState = {
      ...nextPet.lifeState,
      phase: "adaptation",
      safeRadius: 95,
      maxExploreRadius: 120 + explorationBias * 0.4,
    }

    return { pet: nextPet }
  }

  if (ageTicks < 28) {
    nextPet.lifeState = {
      ...nextPet.lifeState,
      phase: "dependent",
      safeRadius: 130,
      maxExploreRadius: 160 + explorationBias * 0.65,
    }

    return { pet: nextPet }
  }

  if (ageTicks < 48 || activityBias < 55) {
    nextPet.lifeState = {
      ...nextPet.lifeState,
      phase: "curious",
      safeRadius: 170,
      maxExploreRadius: 220 + explorationBias * 0.8,
    }

    return { pet: nextPet }
  }

  nextPet.lifeState = {
    ...nextPet.lifeState,
    phase: "independent",
    safeRadius: 240,
    maxExploreRadius: 320 + explorationBias,
  }

  return { pet: nextPet }
}