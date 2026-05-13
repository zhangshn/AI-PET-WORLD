/**
 * 当前文件负责：把高概率喜好画像转换为视觉 DNA。
 */

import type {
  PreferenceProfile,
} from "../preference-system/preference.types"
import type {
  ButlerSilhouette,
  VisualDNA,
} from "./visual-dna.types"

const butlerSilhouettes: ButlerSilhouette[] = [
  "steady_compact",
  "soft_round",
  "guarded_upright",
  "elegant_light",
  "quiet_simple",
  "balanced_adaptive",
]

const fallbackSilhouetteByArchetype: Record<
  VisualDNA["archetype"],
  ButlerSilhouette
> = {
  structured_builder: "steady_compact",
  warm_caretaker: "soft_round",
  protective_keeper: "guarded_upright",
  aesthetic_organizer: "elegant_light",
  quiet_maintainer: "quiet_simple",
  adaptive_planner: "balanced_adaptive",
}

function resolveButlerSilhouette(
  preference: PreferenceProfile
): ButlerSilhouette {
  const silhouette = preference.butlerImagePreference.silhouette

  if (butlerSilhouettes.includes(silhouette as ButlerSilhouette)) {
    return silhouette as ButlerSilhouette
  }

  return fallbackSilhouetteByArchetype[
    preference.butlerImagePreference.archetype
  ]
}

function clampPreferenceScore(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveOrderVsNature(preference: PreferenceProfile): number {
  switch (preference.homePreference.pathPreference) {
    case "straight":
      return 88
    case "guarded":
      return 72
    case "minimal":
      return 64
    case "decorative":
      return 54
    case "soft_curve":
      return 42
    case "adaptive":
      return 62
  }
}

function resolveWarmthVsDistance(preference: PreferenceProfile): number {
  switch (preference.atmospherePreference.mood) {
    case "warm_safe":
      return 90
    case "bright_decorative":
      return 74
    case "adaptive_soft":
      return 66
    case "clear_order":
      return 54
    case "guarded_green":
      return 48
    case "quiet_moon":
      return 36
  }
}

function resolveProtectionNeed(preference: PreferenceProfile): number {
  switch (preference.homePreference.carePriority) {
    case "safety_first":
      return 92
    case "storage_first":
      return 58
    case "stability_first":
      return 56
    case "context_first":
      return 62
    case "comfort_first":
      return 48
    case "beauty_first":
      return 42
  }
}

function resolveDecorationNeed(preference: PreferenceProfile): number {
  switch (preference.homePreference.gardenStyle) {
    case "decorative_garden":
      return 94
    case "warm_flower_patch":
      return 62
    case "mixed_natural":
      return 58
    case "protected_shrub_edge":
      return 42
    case "neat_low_grass":
      return 30
    case "quiet_shade":
      return 24
  }
}

export function buildVisualDNAFromPreferenceProfile(
  preference: PreferenceProfile
): VisualDNA {
  return {
    archetype: preference.butlerImagePreference.archetype,
    colorTone: preference.colorPreference.primaryTone,
    butlerSilhouette: resolveButlerSilhouette(preference),
    petMatchType: preference.petPreference.matchType,
    homeStyle: preference.homePreference.homeStyle,
    gardenStyle: preference.homePreference.gardenStyle,
    shelterStyle: preference.homePreference.shelterStyle,
    carePriority: preference.homePreference.carePriority,
    orderVsNature: clampPreferenceScore(resolveOrderVsNature(preference)),
    warmthVsDistance: clampPreferenceScore(resolveWarmthVsDistance(preference)),
    protectionNeed: clampPreferenceScore(resolveProtectionNeed(preference)),
    decorationNeed: clampPreferenceScore(resolveDecorationNeed(preference)),
    confidence: preference.confidence,
    source: preference.source,
  }
}
