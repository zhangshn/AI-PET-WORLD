/**
 * 当前文件负责：提供紫微偏好规则的构建工具。
 */

import type {
  ArchetypeScoreMap,
  PetMatchScoreMap,
  VisualPreferenceScoreMap,
  ZiweiPreferenceBias,
} from "./ziwei-probability.types"
import type {
  CarePriority,
  GardenStyleType,
  HomeStyleType,
  PetMatchType,
  ShelterStyleType,
  VisualColorTone,
  ZiweiVisualArchetype,
} from "../visual-system/visual-dna.types"

export const ziweiVisualArchetypes: ZiweiVisualArchetype[] = [
  "structured_builder",
  "warm_caretaker",
  "protective_keeper",
  "aesthetic_organizer",
  "quiet_maintainer",
  "adaptive_planner",
]

export const petMatchTypes: PetMatchType[] = [
  "stable_attached",
  "soft_companion",
  "alert_guardian",
  "curious_playful",
  "quiet_observer",
  "adaptive_partner",
]

export function createArchetypeScores(
  scores: Partial<ArchetypeScoreMap>
): ArchetypeScoreMap {
  return {
    structured_builder: scores.structured_builder ?? 0,
    warm_caretaker: scores.warm_caretaker ?? 0,
    protective_keeper: scores.protective_keeper ?? 0,
    aesthetic_organizer: scores.aesthetic_organizer ?? 0,
    quiet_maintainer: scores.quiet_maintainer ?? 0,
    adaptive_planner: scores.adaptive_planner ?? 0,
  }
}

export function createPetMatchScores(
  scores: Partial<PetMatchScoreMap>
): PetMatchScoreMap {
  return {
    stable_attached: scores.stable_attached ?? 0,
    soft_companion: scores.soft_companion ?? 0,
    alert_guardian: scores.alert_guardian ?? 0,
    curious_playful: scores.curious_playful ?? 0,
    quiet_observer: scores.quiet_observer ?? 0,
    adaptive_partner: scores.adaptive_partner ?? 0,
  }
}

export function createVisualScores(
  scores: Partial<VisualPreferenceScoreMap>
): VisualPreferenceScoreMap {
  return {
    order: scores.order ?? 0,
    warmth: scores.warmth ?? 0,
    protection: scores.protection ?? 0,
    decoration: scores.decoration ?? 0,
    nature: scores.nature ?? 0,
    stability: scores.stability ?? 0,
  }
}

export function createPreferenceBias(input: {
  archetypeScores: Partial<ArchetypeScoreMap>
  petMatchScores: Partial<PetMatchScoreMap>
  visualScores: Partial<VisualPreferenceScoreMap>
  colorToneHints: VisualColorTone[]
  homeStyleHints: HomeStyleType[]
  gardenStyleHints: GardenStyleType[]
  shelterStyleHints: ShelterStyleType[]
  carePriorityHints: CarePriority[]
  explanation: string
}): ZiweiPreferenceBias {
  return {
    archetypeScores: createArchetypeScores(input.archetypeScores),
    petMatchScores: createPetMatchScores(input.petMatchScores),
    visualScores: createVisualScores(input.visualScores),
    colorToneHints: input.colorToneHints,
    homeStyleHints: input.homeStyleHints,
    gardenStyleHints: input.gardenStyleHints,
    shelterStyleHints: input.shelterStyleHints,
    carePriorityHints: input.carePriorityHints,
    explanation: input.explanation,
  }
}
