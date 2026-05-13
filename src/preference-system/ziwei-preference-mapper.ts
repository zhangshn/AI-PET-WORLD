/**
 * 当前文件负责：把紫微概率解释转成潜在喜好画像。
 */

import type {
  ZiweiProbabilityProfile,
} from "../ziwei-probability/ziwei-probability.types"
import type {
  CarePriority,
  GardenStyleType,
  HomeStyleType,
  ShelterStyleType,
  VisualColorTone,
  ZiweiVisualArchetype,
} from "../visual-system/visual-dna.types"
import type {
  AtmospherePreference,
  ButlerImagePreference,
  ColorPreference,
  HomePreference,
  InteractionPreference,
  PetPreference,
  PreferenceProfile,
} from "./preference.types"

type ArchetypePreferenceDefaults = {
  colorTone: VisualColorTone
  secondaryTones: VisualColorTone[]
  contrastLevel: ColorPreference["contrastLevel"]
  brightness: ColorPreference["brightness"]
  bodyFeeling: PetPreference["bodyFeeling"]
  energyPreference: PetPreference["energyPreference"]
  attachmentPreference: PetPreference["attachmentPreference"]
  silhouette: string
  toolFeeling: ButlerImagePreference["toolFeeling"]
  homeStyle: HomeStyleType
  gardenStyle: GardenStyleType
  shelterStyle: ShelterStyleType
  carePriority: CarePriority
  pathPreference: HomePreference["pathPreference"]
  mood: AtmospherePreference["mood"]
  lightFeeling: AtmospherePreference["lightFeeling"]
  butlerActionBias: InteractionPreference["butlerActionBias"]
  petInteractionBias: InteractionPreference["petInteractionBias"]
}

const archetypeDefaults: Record<
  ZiweiVisualArchetype,
  ArchetypePreferenceDefaults
> = {
  structured_builder: {
    colorTone: "metal_clear",
    secondaryTones: ["earth_warm", "water_quiet"],
    contrastLevel: "medium",
    brightness: "balanced",
    bodyFeeling: "steady_compact",
    energyPreference: "medium",
    attachmentPreference: "balanced",
    silhouette: "steady_compact",
    toolFeeling: "building",
    homeStyle: "orderly_structured",
    gardenStyle: "neat_low_grass",
    shelterStyle: "straight_frame",
    carePriority: "storage_first",
    pathPreference: "straight",
    mood: "clear_order",
    lightFeeling: "cool_clear",
    butlerActionBias: "organize",
    petInteractionBias: "attach",
  },
  warm_caretaker: {
    colorTone: "earth_warm",
    secondaryTones: ["moon_soft", "fire_bright"],
    contrastLevel: "low",
    brightness: "soft",
    bodyFeeling: "round_soft",
    energyPreference: "low",
    attachmentPreference: "close",
    silhouette: "soft_round",
    toolFeeling: "caretaking",
    homeStyle: "warm_care_first",
    gardenStyle: "warm_flower_patch",
    shelterStyle: "soft_canopy",
    carePriority: "comfort_first",
    pathPreference: "soft_curve",
    mood: "warm_safe",
    lightFeeling: "warm_lamp",
    butlerActionBias: "care",
    petInteractionBias: "comfort",
  },
  protective_keeper: {
    colorTone: "wood_green",
    secondaryTones: ["metal_clear", "water_quiet"],
    contrastLevel: "high",
    brightness: "balanced",
    bodyFeeling: "alert_light",
    energyPreference: "medium",
    attachmentPreference: "watchful",
    silhouette: "guarded_upright",
    toolFeeling: "guarding",
    homeStyle: "protected_boundary",
    gardenStyle: "protected_shrub_edge",
    shelterStyle: "reinforced_edge",
    carePriority: "safety_first",
    pathPreference: "guarded",
    mood: "guarded_green",
    lightFeeling: "soft_shade",
    butlerActionBias: "protect",
    petInteractionBias: "guard",
  },
  aesthetic_organizer: {
    colorTone: "fire_bright",
    secondaryTones: ["earth_warm", "moon_soft"],
    contrastLevel: "high",
    brightness: "bright",
    bodyFeeling: "curious_active",
    energyPreference: "high",
    attachmentPreference: "balanced",
    silhouette: "elegant_light",
    toolFeeling: "decorating",
    homeStyle: "flowered_aesthetic",
    gardenStyle: "decorative_garden",
    shelterStyle: "decorated_roof",
    carePriority: "beauty_first",
    pathPreference: "decorative",
    mood: "bright_decorative",
    lightFeeling: "bright_sun",
    butlerActionBias: "decorate",
    petInteractionBias: "play",
  },
  quiet_maintainer: {
    colorTone: "water_quiet",
    secondaryTones: ["moon_soft", "earth_warm"],
    contrastLevel: "low",
    brightness: "soft",
    bodyFeeling: "quiet_small",
    energyPreference: "low",
    attachmentPreference: "independent",
    silhouette: "quiet_simple",
    toolFeeling: "none",
    homeStyle: "quiet_minimal",
    gardenStyle: "quiet_shade",
    shelterStyle: "low_quiet_shelter",
    carePriority: "stability_first",
    pathPreference: "minimal",
    mood: "quiet_moon",
    lightFeeling: "moon_quiet",
    butlerActionBias: "maintain",
    petInteractionBias: "observe",
  },
  adaptive_planner: {
    colorTone: "moon_soft",
    secondaryTones: ["wood_green", "metal_clear"],
    contrastLevel: "medium",
    brightness: "balanced",
    bodyFeeling: "adaptive_mixed",
    energyPreference: "adaptive",
    attachmentPreference: "balanced",
    silhouette: "balanced_adaptive",
    toolFeeling: "planning",
    homeStyle: "adaptive_mixed",
    gardenStyle: "mixed_natural",
    shelterStyle: "adaptive_shelter",
    carePriority: "context_first",
    pathPreference: "adaptive",
    mood: "adaptive_soft",
    lightFeeling: "mixed",
    butlerActionBias: "adapt",
    petInteractionBias: "adapt",
  },
}

function uniqueTones(tones: VisualColorTone[]): VisualColorTone[] {
  return Array.from(new Set(tones))
}

export function buildPreferenceProfileFromZiweiProbability(
  profile: ZiweiProbabilityProfile
): PreferenceProfile {
  const primary = archetypeDefaults[profile.topArchetype]
  const secondary = profile.secondaryArchetype
    ? archetypeDefaults[profile.secondaryArchetype]
    : null
  const primaryTone =
    profile.colorToneCandidates[0] ?? primary.colorTone
  const secondaryTones = uniqueTones([
    ...profile.colorToneCandidates.slice(1, 4),
    ...primary.secondaryTones,
    ...(secondary ? [secondary.colorTone] : []),
  ]).filter((tone) => tone !== primaryTone)

  return {
    colorPreference: {
      primaryTone,
      secondaryTones,
      contrastLevel: primary.contrastLevel,
      brightness: primary.brightness,
    },
    petPreference: {
      matchType: profile.topPetMatchType,
      bodyFeeling: primary.bodyFeeling,
      energyPreference: primary.energyPreference,
      attachmentPreference: primary.attachmentPreference,
    },
    butlerImagePreference: {
      archetype: profile.topArchetype,
      silhouette: primary.silhouette,
      clothingTone: primaryTone,
      toolFeeling: primary.toolFeeling,
    },
    homePreference: {
      homeStyle: profile.homeStyleCandidates[0] ?? primary.homeStyle,
      gardenStyle: profile.gardenStyleCandidates[0] ?? primary.gardenStyle,
      shelterStyle:
        profile.shelterStyleCandidates[0] ?? primary.shelterStyle,
      carePriority:
        profile.carePriorityCandidates[0] ?? primary.carePriority,
      pathPreference: primary.pathPreference,
    },
    atmospherePreference: {
      mood: primary.mood,
      lightFeeling: primary.lightFeeling,
    },
    interactionPreference: {
      butlerActionBias: primary.butlerActionBias,
      petInteractionBias: primary.petInteractionBias,
    },
    confidence: profile.confidence,
    source: profile.source,
    explanation: [
      "PreferenceProfile 由紫微概率解释生成，不是用户问卷结果。",
      `主导视觉类型是 ${profile.topArchetype}，次级倾向是 ${profile.secondaryArchetype ?? "none"}。`,
      ...profile.explanations,
    ],
  }
}
