/**
 * 当前文件负责：把人格 traits 映射成动态五维解释分数。
 */

import type {
  PersonalityTraits
} from "../destiny-core/ziwei-core/ziwei-core-schema"

import type {
  LifeTendencyFiveDimensionScores
} from "./life-tendency-schema"

import {
  clampLifeTendencyScore
} from "./life-tendency-normalizer"

function getTrait(
  traits: PersonalityTraits,
  key: string
): number {
  return clampLifeTendencyScore(traits[key] ?? 50)
}

export function buildLifeTendencyFiveDimensionScores(
  traits: PersonalityTraits | null
): LifeTendencyFiveDimensionScores {
  if (!traits) {
    return {
      explore: 50,
      observe: 50,
      approach: 50,
      recover: 50,
      care: 50,
      protect: 50,
      boundary: 50,
      routine: 50,
      action: 50,
      perception: 50,
      stability: 50,
    }
  }

  const activity = getTrait(traits, "activity")
  const curiosity = getTrait(traits, "curiosity")
  const discipline = getTrait(traits, "discipline")
  const stability = getTrait(traits, "stability")
  const caregiving = getTrait(traits, "caregiving")
  const restPreference = getTrait(traits, "restPreference")
  const emotionalSensitivity = getTrait(
    traits,
    "emotionalSensitivity"
  )

  return {
    explore: clampLifeTendencyScore(
      activity * 0.45 +
        curiosity * 0.55
    ),
    observe: clampLifeTendencyScore(
      curiosity * 0.45 +
        emotionalSensitivity * 0.35 +
        discipline * 0.2
    ),
    approach: clampLifeTendencyScore(
      activity * 0.25 +
        stability * 0.35 +
        caregiving * 0.25 +
        (100 - emotionalSensitivity) * 0.15
    ),
    recover: clampLifeTendencyScore(
      restPreference * 0.55 +
        stability * 0.3 +
        discipline * 0.15
    ),
    care: clampLifeTendencyScore(
      caregiving * 0.6 +
        stability * 0.2 +
        restPreference * 0.2
    ),
    protect: clampLifeTendencyScore(
      caregiving * 0.35 +
        stability * 0.35 +
        discipline * 0.3
    ),
    boundary: clampLifeTendencyScore(
      discipline * 0.55 +
        stability * 0.25 +
        emotionalSensitivity * 0.2
    ),
    routine: clampLifeTendencyScore(
      discipline * 0.65 +
        restPreference * 0.2 +
        stability * 0.15
    ),
    action: clampLifeTendencyScore(
      activity * 0.5 +
        discipline * 0.3 +
        curiosity * 0.2
    ),
    perception: clampLifeTendencyScore(
      curiosity * 0.4 +
        emotionalSensitivity * 0.45 +
        stability * 0.15
    ),
    stability: clampLifeTendencyScore(
      stability * 0.55 +
        restPreference * 0.25 +
        discipline * 0.2
    ),
  }
}