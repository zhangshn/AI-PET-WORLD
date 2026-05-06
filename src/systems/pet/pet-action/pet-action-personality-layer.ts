/**
 * 当前文件负责：把宠物人格、意识倾向与记忆倾向映射为候选行为权重。
 */

import type { PetState } from "../../../types/pet"
import type { PetActionWeights } from "./pet-action-weight-types"

export function applyActionPersonalityLayer(
  pet: PetState,
  weights: PetActionWeights
) {
  const consciousness = pet.consciousnessProfile.bias
  const petBias = pet.lifeProfile.genderAwareBehaviorBias.petBehaviorBias
  const memory = pet.memoryState.preferenceBias

  weights.observing += petBias.observationNeed * 0.18
  weights.approaching += petBias.attachmentNeed * 0.12
  weights.exploring += petBias.explorationRange * 0.14
  weights.resting += petBias.restNeed * 0.12
  weights.walking += petBias.newbornActivity * 0.08

  if (consciousness.changeSeeking >= 75) {
    weights.exploring += 10
    weights.walking += 6
    weights.idle -= 4
  }

  if (consciousness.observationBias >= 75) {
    weights.observing += 12
    weights.alert_idle += 4
  }

  if (consciousness.attachmentBias >= 75) {
    weights.approaching += 10
  }

  if (consciousness.comfortSeeking >= 75) {
    weights.resting += 10
    weights.sleeping += 8
    weights.exploring -= 8
  }

  if (consciousness.restResistance >= 75) {
    weights.resting -= 8
    weights.sleeping -= 6
    weights.exploring += 6
    weights.walking += 4
  }

  weights.exploring += memory.exploreBias * 0.5
  weights.observing += memory.observeBias * 0.5
  weights.approaching += memory.approachBias * 0.5
  weights.resting += memory.restBias * 0.5
  weights.eating += memory.eatBias * 0.5
}