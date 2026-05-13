/**
 * 当前文件负责：定义高概率潜在喜好画像类型。
 */

import type {
  CarePriority,
  GardenStyleType,
  HomeStyleType,
  PetMatchType,
  ShelterStyleType,
  VisualColorTone,
  ZiweiVisualArchetype,
} from "../visual-system/visual-dna.types"

export type ColorPreference = {
  primaryTone: VisualColorTone
  secondaryTones: VisualColorTone[]
  contrastLevel: "low" | "medium" | "high"
  brightness: "soft" | "balanced" | "bright"
}

export type PetPreference = {
  matchType: PetMatchType
  bodyFeeling:
    | "round_soft"
    | "steady_compact"
    | "alert_light"
    | "curious_active"
    | "quiet_small"
    | "adaptive_mixed"
  energyPreference: "low" | "medium" | "high" | "adaptive"
  attachmentPreference: "close" | "balanced" | "independent" | "watchful"
}

export type ButlerImagePreference = {
  archetype: ZiweiVisualArchetype
  silhouette: string
  clothingTone: VisualColorTone
  toolFeeling:
    | "none"
    | "caretaking"
    | "building"
    | "guarding"
    | "decorating"
    | "planning"
}

export type HomePreference = {
  homeStyle: HomeStyleType
  gardenStyle: GardenStyleType
  shelterStyle: ShelterStyleType
  carePriority: CarePriority
  pathPreference:
    | "straight"
    | "soft_curve"
    | "guarded"
    | "decorative"
    | "minimal"
    | "adaptive"
}

export type AtmospherePreference = {
  mood:
    | "clear_order"
    | "warm_safe"
    | "guarded_green"
    | "bright_decorative"
    | "quiet_moon"
    | "adaptive_soft"
  lightFeeling:
    | "cool_clear"
    | "warm_lamp"
    | "soft_shade"
    | "bright_sun"
    | "moon_quiet"
    | "mixed"
}

export type InteractionPreference = {
  butlerActionBias:
    | "organize"
    | "care"
    | "protect"
    | "decorate"
    | "maintain"
    | "adapt"
  petInteractionBias:
    | "attach"
    | "comfort"
    | "guard"
    | "play"
    | "observe"
    | "adapt"
}

export type PreferenceProfile = {
  colorPreference: ColorPreference
  petPreference: PetPreference
  butlerImagePreference: ButlerImagePreference
  homePreference: HomePreference
  atmospherePreference: AtmospherePreference
  interactionPreference: InteractionPreference
  confidence: number
  source: "ziwei_primary" | "bazi_fallback" | "mixed" | "mock"
  explanation: string[]
}
