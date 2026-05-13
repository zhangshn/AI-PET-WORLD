/**
 * 当前文件负责：定义紫微视觉变体系统的基础类型。
 */

export type ZiweiVisualArchetype =
  | "structured_builder"
  | "warm_caretaker"
  | "protective_keeper"
  | "aesthetic_organizer"
  | "quiet_maintainer"
  | "adaptive_planner"

export type VisualColorTone =
  | "earth_warm"
  | "wood_green"
  | "moon_soft"
  | "metal_clear"
  | "water_quiet"
  | "fire_bright"

export type ButlerSilhouette =
  | "steady_compact"
  | "soft_round"
  | "guarded_upright"
  | "elegant_light"
  | "quiet_simple"
  | "balanced_adaptive"

export type PetMatchType =
  | "stable_attached"
  | "soft_companion"
  | "alert_guardian"
  | "curious_playful"
  | "quiet_observer"
  | "adaptive_partner"

export type HomeStyleType =
  | "orderly_structured"
  | "warm_care_first"
  | "protected_boundary"
  | "flowered_aesthetic"
  | "quiet_minimal"
  | "adaptive_mixed"

export type GardenStyleType =
  | "neat_low_grass"
  | "warm_flower_patch"
  | "protected_shrub_edge"
  | "decorative_garden"
  | "quiet_shade"
  | "mixed_natural"

export type ShelterStyleType =
  | "straight_frame"
  | "soft_canopy"
  | "reinforced_edge"
  | "decorated_roof"
  | "low_quiet_shelter"
  | "adaptive_shelter"

export type CarePriority =
  | "storage_first"
  | "comfort_first"
  | "safety_first"
  | "beauty_first"
  | "stability_first"
  | "context_first"

export type VisualDNA = {
  archetype: ZiweiVisualArchetype
  colorTone: VisualColorTone
  butlerSilhouette: ButlerSilhouette
  petMatchType: PetMatchType
  homeStyle: HomeStyleType
  gardenStyle: GardenStyleType
  shelterStyle: ShelterStyleType
  carePriority: CarePriority
  orderVsNature: number
  warmthVsDistance: number
  protectionNeed: number
  decorationNeed: number
  confidence: number
  source: "ziwei_primary" | "bazi_fallback" | "mock"
}

export type SpriteVariant = {
  butlerSprite: string
  petSprite: string
  treeSprite: string
  shelterSprite: string
  houseSprite: string
  careCornerSprite: string
  adoptionCenterSprite: string
}

export type PrefabVariant = {
  butlerPrefab: string
  petPrefab: string
  careCornerPrefab: string
  shelterPrefab: string
  basicHousePrefab: string
  gardenPrefab: string
  adoptionCenterPrefab: string
}

export type SceneLayoutVariant = {
  initialHomeScene: string
  carePointScene: string
  temporaryShelterScene: string
  basicHomeScene: string
  adoptionArrivalScene: string
}

export type VisualGenerationResult = {
  visualDNA: VisualDNA
  spriteVariant: SpriteVariant
  prefabVariant: PrefabVariant
  sceneLayoutVariant: SceneLayoutVariant
}
