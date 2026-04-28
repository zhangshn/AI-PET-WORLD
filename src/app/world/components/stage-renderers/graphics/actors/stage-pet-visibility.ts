/**
 * 当前文件负责：判断宠物在外部世界与室内照护场景中的可见阶段。
 */

import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

export type ExternalPetVisibilityPhase =
  | "hidden_before_birth"
  | "hidden_newborn_care"
  | "yard_adaptation"
  | "external_life"

export function getExternalPetVisibilityPhase(input: {
  pet: PetState | null
  incubator: IncubatorState | null
}): ExternalPetVisibilityPhase {
  if (!input.pet) return "hidden_before_birth"

  if (input.incubator?.status !== "hatched") {
    return "hidden_before_birth"
  }

  if (input.pet.lifeState?.phase === "newborn") {
    return "hidden_newborn_care"
  }

  if (input.pet.lifeState?.phase === "adaptation") {
    return "yard_adaptation"
  }

  return "external_life"
}

export function shouldRenderExternalPet(input: {
  pet: PetState | null
  incubator: IncubatorState | null
}): boolean {
  const phase = getExternalPetVisibilityPhase(input)

  return phase === "yard_adaptation" || phase === "external_life"
}

export function shouldKeepPetNearShelter(input: {
  pet: PetState | null
  incubator: IncubatorState | null
}): boolean {
  return getExternalPetVisibilityPhase(input) === "yard_adaptation"
}

export function shouldRenderInteriorNewbornNest(input: {
  pet: PetState | null
  incubator: IncubatorState | null
}): boolean {
  const phase = getExternalPetVisibilityPhase(input)

  return phase === "hidden_newborn_care" || phase === "yard_adaptation"
}