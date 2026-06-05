/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Evolution
 *



 *


 *

 * - 杩欎竴灞備笉璐熻矗鍑虹敓杈撳叆璁＄畻


 * ======================================================
 */

import type {
  CorePersonality,
  PersonalityProfile,
  PersonalityTraits
} from "./ziwei-core-schema"

/**

 *



 *


 *


 *


 */
export type AdoptionImprint = {
  calmGrowth: number
  activeGrowth: number
  stableGrowth: number
  sensitiveGrowth: number
}

/**
 * ======================================================

 * ======================================================
 */
function clampValue(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value)
}

/**
 * ======================================================
 * 闄愬埗 traits 鑼冨洿
 * ======================================================
 */
function clampTraits(traits: PersonalityTraits): PersonalityTraits {
  return {
    activity: clampValue(traits.activity),
    restPreference: clampValue(traits.restPreference),
    appetite: clampValue(traits.appetite),
    discipline: clampValue(traits.discipline),
    curiosity: clampValue(traits.curiosity),
    emotionalSensitivity: clampValue(traits.emotionalSensitivity),
    stability: clampValue(traits.stability),
    caregiving: clampValue(traits.caregiving),
    buildingPreference: clampValue(traits.buildingPreference)
  }
}

/**
 * ======================================================

 *

 * - 去重

 * ======================================================
 */
function mergeSummaries(base: string[], extra: string[]): string[] {
  const set = new Set<string>()
  const merged: string[] = []

  for (const item of [...base, ...extra]) {
    if (!set.has(item)) {
      set.add(item)
      merged.push(item)
    }
  }

  return merged
}

function mergeTags(base: string[], extra: string[]): string[] {
  const set = new Set<string>()
  const merged: string[] = []

  for (const item of [...base, ...extra]) {
    if (!set.has(item)) {
      set.add(item)
      merged.push(item)
    }
  }

  return merged
}

function clampCoreValue(value: number): number {
  if (value < -1) return -1
  if (value > 1) return 1
  return Math.round(value * 1000) / 1000
}

function mergeCorePersonality(
  seedCore: CorePersonality,
  birthCore: CorePersonality,
  imprint: AdoptionImprint
): CorePersonality {
  return {
    activity: clampCoreValue(
      birthCore.activity * 0.65 +
      seedCore.activity * 0.25 +
      ((imprint.activeGrowth - 50) / 100) * 0.1
    ),
    curiosity: clampCoreValue(
      birthCore.curiosity * 0.7 +
      seedCore.curiosity * 0.3
    ),
    dependency: clampCoreValue(
      birthCore.dependency * 0.7 +
      seedCore.dependency * 0.3
    ),
    confidence: clampCoreValue(
      birthCore.confidence * 0.7 +
      seedCore.confidence * 0.3
    ),
    sensitivity: clampCoreValue(
      birthCore.sensitivity * 0.65 +
      seedCore.sensitivity * 0.25 +
      ((imprint.sensitiveGrowth - 50) / 100) * 0.1
    )
  }
}

/**
 * ======================================================

 * ======================================================
 */
function buildEvolutionSummaries(
  imprint: AdoptionImprint
): string[] {
  const summaries: string[] = []

  if (imprint.calmGrowth >= 60) {
    summaries.push("Early growth formed a recorded tendency.")
  }

  if (imprint.activeGrowth >= 60) {
    summaries.push("Early growth formed a recorded tendency.")
  }

  if (imprint.stableGrowth >= 60) {
    summaries.push("早期成长过程整体较稳定。")
  }

  if (imprint.sensitiveGrowth >= 60) {
    summaries.push("Early growth formed a recorded tendency.")
  }

  return summaries
}

/**
 * ======================================================
 * 铻嶅悎浜烘牸
 *



 *


 *


 *


 *




 * ======================================================
 */
export function evolveProfile(
  seedProfile: PersonalityProfile,
  birthProfile: PersonalityProfile,
  imprint: AdoptionImprint
): PersonalityProfile {
  const seedTraits = seedProfile.traits
  const birthTraits = birthProfile.traits

  /**




   */
  const mergedTraits: PersonalityTraits = {
    activity:
      birthTraits.activity * 0.6 +
      seedTraits.activity * 0.25 +
      imprint.activeGrowth * 0.15,

    restPreference:
      birthTraits.restPreference * 0.6 +
      seedTraits.restPreference * 0.25 +
      imprint.calmGrowth * 0.15,

    appetite:
      birthTraits.appetite * 0.7 +
      seedTraits.appetite * 0.3,

    discipline:
      birthTraits.discipline * 0.65 +
      seedTraits.discipline * 0.2 +
      imprint.stableGrowth * 0.15,

    curiosity:
      birthTraits.curiosity * 0.75 +
      seedTraits.curiosity * 0.25,

    emotionalSensitivity:
      birthTraits.emotionalSensitivity * 0.6 +
      seedTraits.emotionalSensitivity * 0.2 +
      imprint.sensitiveGrowth * 0.2,

    stability:
      birthTraits.stability * 0.6 +
      seedTraits.stability * 0.2 +
      imprint.stableGrowth * 0.2,

    caregiving:
      birthTraits.caregiving * 0.7 +
      seedTraits.caregiving * 0.3,

    buildingPreference:
      birthTraits.buildingPreference * 0.7 +
      seedTraits.buildingPreference * 0.3
  }

  const normalizedTraits = clampTraits(mergedTraits)

  const evolutionSummaries = buildEvolutionSummaries(imprint)
  const mergedCorePersonality = mergeCorePersonality(
    seedProfile.corePersonality,
    birthProfile.corePersonality,
    imprint
  )
  const mergedTags = mergeTags(seedProfile.tags, birthProfile.tags)

  return {
    /**


     */
    pattern: birthProfile.pattern,

    /**

     */
    summaries: mergeSummaries(
      birthProfile.summaries,
      [...seedProfile.summaries, ...evolutionSummaries]
    ),

    /**

     */
    traits: normalizedTraits,
    corePersonality: mergedCorePersonality,
    tags: mergedTags
  }
}
