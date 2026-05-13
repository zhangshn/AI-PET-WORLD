/**
 * 当前文件负责：聚合紫微主星和组合的概率解释。
 */

import type {
  ArchetypeScoreMap,
  PetMatchScoreMap,
  VisualPreferenceScoreMap,
  ZiweiPreferenceBias,
  ZiweiProbabilityInput,
  ZiweiProbabilityProfile,
} from "./ziwei-probability.types"
import {
  createArchetypeScores,
  createPetMatchScores,
  createVisualScores,
  petMatchTypes,
  ziweiVisualArchetypes,
} from "./ziwei-preference-helpers"
import { ziweiPairPreferenceBiases } from "./ziwei-pair-preferences"
import { ziweiStarPreferenceBiases } from "./ziwei-star-preferences"

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function addArchetypeScores(
  target: ArchetypeScoreMap,
  source: ArchetypeScoreMap,
  weight: number
) {
  ziweiVisualArchetypes.forEach((key) => {
    target[key] += source[key] * weight
  })
}

function addPetMatchScores(
  target: PetMatchScoreMap,
  source: PetMatchScoreMap,
  weight: number
) {
  petMatchTypes.forEach((key) => {
    target[key] += source[key] * weight
  })
}

function addVisualScores(
  target: VisualPreferenceScoreMap,
  source: VisualPreferenceScoreMap,
  weight: number
) {
  target.order += source.order * weight
  target.warmth += source.warmth * weight
  target.protection += source.protection * weight
  target.decoration += source.decoration * weight
  target.nature += source.nature * weight
  target.stability += source.stability * weight
}

function getTopScoreKey<Key extends string>(
  scores: Record<Key, number>,
  keys: Key[]
): Key {
  return [...keys].sort((a, b) => scores[b] - scores[a])[0]
}

function getSecondScoreKey<Key extends string>(
  scores: Record<Key, number>,
  keys: Key[]
): Key | undefined {
  return [...keys].sort((a, b) => scores[b] - scores[a])[1]
}

function normalizeArchetypeScores(
  scores: ArchetypeScoreMap
): ArchetypeScoreMap {
  return createArchetypeScores(
    Object.fromEntries(
      ziweiVisualArchetypes.map((key) => [key, clampScore(scores[key])])
    ) as Partial<ArchetypeScoreMap>
  )
}

function normalizePetMatchScores(scores: PetMatchScoreMap): PetMatchScoreMap {
  return createPetMatchScores(
    Object.fromEntries(
      petMatchTypes.map((key) => [key, clampScore(scores[key])])
    ) as Partial<PetMatchScoreMap>
  )
}

function normalizeVisualScores(
  scores: VisualPreferenceScoreMap
): VisualPreferenceScoreMap {
  return createVisualScores({
    order: clampScore(scores.order),
    warmth: clampScore(scores.warmth),
    protection: clampScore(scores.protection),
    decoration: clampScore(scores.decoration),
    nature: clampScore(scores.nature),
    stability: clampScore(scores.stability),
  })
}

function pushUniqueHints<T>(target: T[], values: T[]) {
  values.forEach((value) => {
    if (!target.includes(value)) {
      target.push(value)
    }
  })
}

function collectBias(input: {
  bias: ZiweiPreferenceBias
  weight: number
  archetypeScores: ArchetypeScoreMap
  petMatchScores: PetMatchScoreMap
  visualScores: VisualPreferenceScoreMap
  colorToneCandidates: ZiweiProbabilityProfile["colorToneCandidates"]
  homeStyleCandidates: ZiweiProbabilityProfile["homeStyleCandidates"]
  gardenStyleCandidates: ZiweiProbabilityProfile["gardenStyleCandidates"]
  shelterStyleCandidates: ZiweiProbabilityProfile["shelterStyleCandidates"]
  carePriorityCandidates: ZiweiProbabilityProfile["carePriorityCandidates"]
  explanations: string[]
}) {
  addArchetypeScores(
    input.archetypeScores,
    input.bias.archetypeScores,
    input.weight
  )
  addPetMatchScores(
    input.petMatchScores,
    input.bias.petMatchScores,
    input.weight
  )
  addVisualScores(input.visualScores, input.bias.visualScores, input.weight)
  pushUniqueHints(input.colorToneCandidates, input.bias.colorToneHints)
  pushUniqueHints(input.homeStyleCandidates, input.bias.homeStyleHints)
  pushUniqueHints(input.gardenStyleCandidates, input.bias.gardenStyleHints)
  pushUniqueHints(input.shelterStyleCandidates, input.bias.shelterStyleHints)
  pushUniqueHints(input.carePriorityCandidates, input.bias.carePriorityHints)
  input.explanations.push(input.bias.explanation)
}

function resolveConfidence(input: {
  topScore: number
  secondaryScore: number
  evidenceCount: number
}): number {
  const diff = Math.max(0, input.topScore - input.secondaryScore)
  const evidenceBonus = Math.min(18, input.evidenceCount * 3)

  return clampScore(48 + diff * 0.6 + evidenceBonus)
}

export function buildZiweiProbabilityProfile(
  input: ZiweiProbabilityInput
): ZiweiProbabilityProfile {
  const archetypeScores = createArchetypeScores({})
  const petMatchScores = createPetMatchScores({})
  const visualScores = createVisualScores({})
  const colorToneCandidates: ZiweiProbabilityProfile["colorToneCandidates"] =
    []
  const homeStyleCandidates: ZiweiProbabilityProfile["homeStyleCandidates"] =
    []
  const gardenStyleCandidates: ZiweiProbabilityProfile["gardenStyleCandidates"] =
    []
  const shelterStyleCandidates: ZiweiProbabilityProfile["shelterStyleCandidates"] =
    []
  const carePriorityCandidates: ZiweiProbabilityProfile["carePriorityCandidates"] =
    []
  const explanations: string[] = []

  input.primaryStars.forEach((star) => {
    collectBias({
      bias: ziweiStarPreferenceBiases[star],
      weight: 1,
      archetypeScores,
      petMatchScores,
      visualScores,
      colorToneCandidates,
      homeStyleCandidates,
      gardenStyleCandidates,
      shelterStyleCandidates,
      carePriorityCandidates,
      explanations,
    })
  })

  input.pairIds.forEach((pairId) => {
    collectBias({
      bias: ziweiPairPreferenceBiases[pairId],
      weight: 1.15,
      archetypeScores,
      petMatchScores,
      visualScores,
      colorToneCandidates,
      homeStyleCandidates,
      gardenStyleCandidates,
      shelterStyleCandidates,
      carePriorityCandidates,
      explanations,
    })
  })

  const normalizedArchetypeScores =
    normalizeArchetypeScores(archetypeScores)
  const normalizedPetMatchScores = normalizePetMatchScores(petMatchScores)
  const normalizedVisualScores = normalizeVisualScores(visualScores)
  const topArchetype = getTopScoreKey(
    normalizedArchetypeScores,
    ziweiVisualArchetypes
  )
  const secondaryArchetype = getSecondScoreKey(
    normalizedArchetypeScores,
    ziweiVisualArchetypes
  )
  const topPetMatchType = getTopScoreKey(
    normalizedPetMatchScores,
    petMatchTypes
  )
  const confidence = resolveConfidence({
    topScore: normalizedArchetypeScores[topArchetype],
    secondaryScore: secondaryArchetype
      ? normalizedArchetypeScores[secondaryArchetype]
      : 0,
    evidenceCount: input.primaryStars.length + input.pairIds.length,
  })

  return {
    input,
    archetypeScores: normalizedArchetypeScores,
    petMatchScores: normalizedPetMatchScores,
    visualScores: normalizedVisualScores,
    colorToneCandidates,
    homeStyleCandidates,
    gardenStyleCandidates,
    shelterStyleCandidates,
    carePriorityCandidates,
    topArchetype,
    secondaryArchetype,
    topPetMatchType,
    confidence,
    explanations,
    source: input.source,
  }
}
