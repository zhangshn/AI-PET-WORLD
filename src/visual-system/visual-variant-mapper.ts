/**
 * 当前文件负责：把 VisualDNA 映射为视觉变体。
 */

import type {
  PrefabVariant,
  SceneLayoutVariant,
  SpriteVariant,
  VisualDNA,
  VisualGenerationResult,
  ZiweiVisualArchetype,
} from "./visual-dna.types"

const spriteVariants: Record<ZiweiVisualArchetype, SpriteVariant> = {
  structured_builder: {
    butlerSprite: "butler_structured_compact_v1",
    petSprite: "pet_stable_attached_v1",
    treeSprite: "tree_neat_low_grass_v1",
    shelterSprite: "shelter_straight_frame_v1",
    houseSprite: "home_orderly_structured_v1",
    careCornerSprite: "care_storage_first_v1",
    adoptionCenterSprite: "adoption_center_clear_service_v1",
  },
  warm_caretaker: {
    butlerSprite: "butler_soft_round_v1",
    petSprite: "pet_soft_companion_v1",
    treeSprite: "tree_warm_flower_patch_v1",
    shelterSprite: "shelter_soft_canopy_v1",
    houseSprite: "home_warm_care_first_v1",
    careCornerSprite: "care_comfort_first_v1",
    adoptionCenterSprite: "adoption_center_warm_service_v1",
  },
  protective_keeper: {
    butlerSprite: "butler_guarded_upright_v1",
    petSprite: "pet_alert_guardian_v1",
    treeSprite: "tree_protected_shrub_edge_v1",
    shelterSprite: "shelter_reinforced_edge_v1",
    houseSprite: "home_protected_boundary_v1",
    careCornerSprite: "care_safety_first_v1",
    adoptionCenterSprite: "adoption_center_protected_service_v1",
  },
  aesthetic_organizer: {
    butlerSprite: "butler_elegant_light_v1",
    petSprite: "pet_curious_playful_v1",
    treeSprite: "tree_decorative_garden_v1",
    shelterSprite: "shelter_decorated_roof_v1",
    houseSprite: "home_flowered_aesthetic_v1",
    careCornerSprite: "care_beauty_first_v1",
    adoptionCenterSprite: "adoption_center_decorative_service_v1",
  },
  quiet_maintainer: {
    butlerSprite: "butler_quiet_simple_v1",
    petSprite: "pet_quiet_observer_v1",
    treeSprite: "tree_quiet_shade_v1",
    shelterSprite: "shelter_low_quiet_v1",
    houseSprite: "home_quiet_minimal_v1",
    careCornerSprite: "care_stability_first_v1",
    adoptionCenterSprite: "adoption_center_quiet_service_v1",
  },
  adaptive_planner: {
    butlerSprite: "butler_balanced_adaptive_v1",
    petSprite: "pet_adaptive_partner_v1",
    treeSprite: "tree_mixed_natural_v1",
    shelterSprite: "shelter_adaptive_v1",
    houseSprite: "home_adaptive_mixed_v1",
    careCornerSprite: "care_context_first_v1",
    adoptionCenterSprite: "adoption_center_adaptive_service_v1",
  },
}

const prefabVariants: Record<ZiweiVisualArchetype, PrefabVariant> = {
  structured_builder: {
    butlerPrefab: "prefab_butler_structured_compact_v1",
    petPrefab: "prefab_pet_stable_attached_v1",
    careCornerPrefab: "prefab_care_storage_first_v1",
    shelterPrefab: "prefab_shelter_straight_frame_v1",
    basicHousePrefab: "prefab_basic_house_orderly_v1",
    gardenPrefab: "prefab_garden_neat_low_grass_v1",
    adoptionCenterPrefab: "prefab_adoption_center_clear_service_v1",
  },
  warm_caretaker: {
    butlerPrefab: "prefab_butler_soft_round_v1",
    petPrefab: "prefab_pet_soft_companion_v1",
    careCornerPrefab: "prefab_care_comfort_first_v1",
    shelterPrefab: "prefab_shelter_soft_canopy_v1",
    basicHousePrefab: "prefab_basic_house_warm_v1",
    gardenPrefab: "prefab_garden_warm_flower_patch_v1",
    adoptionCenterPrefab: "prefab_adoption_center_warm_service_v1",
  },
  protective_keeper: {
    butlerPrefab: "prefab_butler_guarded_upright_v1",
    petPrefab: "prefab_pet_alert_guardian_v1",
    careCornerPrefab: "prefab_care_safety_first_v1",
    shelterPrefab: "prefab_shelter_reinforced_edge_v1",
    basicHousePrefab: "prefab_basic_house_protected_v1",
    gardenPrefab: "prefab_garden_protected_shrub_edge_v1",
    adoptionCenterPrefab: "prefab_adoption_center_protected_service_v1",
  },
  aesthetic_organizer: {
    butlerPrefab: "prefab_butler_elegant_light_v1",
    petPrefab: "prefab_pet_curious_playful_v1",
    careCornerPrefab: "prefab_care_beauty_first_v1",
    shelterPrefab: "prefab_shelter_decorated_roof_v1",
    basicHousePrefab: "prefab_basic_house_flowered_v1",
    gardenPrefab: "prefab_garden_decorative_v1",
    adoptionCenterPrefab: "prefab_adoption_center_decorative_service_v1",
  },
  quiet_maintainer: {
    butlerPrefab: "prefab_butler_quiet_simple_v1",
    petPrefab: "prefab_pet_quiet_observer_v1",
    careCornerPrefab: "prefab_care_stability_first_v1",
    shelterPrefab: "prefab_shelter_low_quiet_v1",
    basicHousePrefab: "prefab_basic_house_quiet_minimal_v1",
    gardenPrefab: "prefab_garden_quiet_shade_v1",
    adoptionCenterPrefab: "prefab_adoption_center_quiet_service_v1",
  },
  adaptive_planner: {
    butlerPrefab: "prefab_butler_balanced_adaptive_v1",
    petPrefab: "prefab_pet_adaptive_partner_v1",
    careCornerPrefab: "prefab_care_context_first_v1",
    shelterPrefab: "prefab_shelter_adaptive_v1",
    basicHousePrefab: "prefab_basic_house_adaptive_mixed_v1",
    gardenPrefab: "prefab_garden_mixed_natural_v1",
    adoptionCenterPrefab: "prefab_adoption_center_adaptive_service_v1",
  },
}

const sceneLayoutVariants: Record<ZiweiVisualArchetype, SceneLayoutVariant> = {
  structured_builder: {
    initialHomeScene: "scene_initial_ordered_grid_v1",
    carePointScene: "scene_care_storage_first_v1",
    temporaryShelterScene: "scene_shelter_straight_frame_v1",
    basicHomeScene: "scene_basic_home_orderly_v1",
    adoptionArrivalScene: "scene_arrival_clear_path_v1",
  },
  warm_caretaker: {
    initialHomeScene: "scene_initial_warm_corner_v1",
    carePointScene: "scene_care_comfort_first_v1",
    temporaryShelterScene: "scene_shelter_soft_canopy_v1",
    basicHomeScene: "scene_basic_home_warm_lit_v1",
    adoptionArrivalScene: "scene_arrival_welcome_mat_v1",
  },
  protective_keeper: {
    initialHomeScene: "scene_initial_boundary_watch_v1",
    carePointScene: "scene_care_safety_first_v1",
    temporaryShelterScene: "scene_shelter_reinforced_edge_v1",
    basicHomeScene: "scene_basic_home_protected_v1",
    adoptionArrivalScene: "scene_arrival_guarded_gate_v1",
  },
  aesthetic_organizer: {
    initialHomeScene: "scene_initial_flower_balance_v1",
    carePointScene: "scene_care_beauty_first_v1",
    temporaryShelterScene: "scene_shelter_decorated_roof_v1",
    basicHomeScene: "scene_basic_home_flowered_v1",
    adoptionArrivalScene: "scene_arrival_decorative_path_v1",
  },
  quiet_maintainer: {
    initialHomeScene: "scene_initial_quiet_shade_v1",
    carePointScene: "scene_care_stability_first_v1",
    temporaryShelterScene: "scene_shelter_low_quiet_v1",
    basicHomeScene: "scene_basic_home_quiet_minimal_v1",
    adoptionArrivalScene: "scene_arrival_quiet_corner_v1",
  },
  adaptive_planner: {
    initialHomeScene: "scene_initial_adaptive_mixed_v1",
    carePointScene: "scene_care_context_first_v1",
    temporaryShelterScene: "scene_shelter_adaptive_v1",
    basicHomeScene: "scene_basic_home_adaptive_mixed_v1",
    adoptionArrivalScene: "scene_arrival_adaptive_route_v1",
  },
}

export function buildSpriteVariantFromVisualDNA(
  visualDNA: VisualDNA
): SpriteVariant {
  return spriteVariants[visualDNA.archetype]
}

export function buildPrefabVariantFromVisualDNA(
  visualDNA: VisualDNA
): PrefabVariant {
  return prefabVariants[visualDNA.archetype]
}

export function buildSceneLayoutVariantFromVisualDNA(
  visualDNA: VisualDNA
): SceneLayoutVariant {
  return sceneLayoutVariants[visualDNA.archetype]
}

export function buildVisualGenerationResult(
  visualDNA: VisualDNA
): VisualGenerationResult {
  return {
    visualDNA,
    spriteVariant: buildSpriteVariantFromVisualDNA(visualDNA),
    prefabVariant: buildPrefabVariantFromVisualDNA(visualDNA),
    sceneLayoutVariant: buildSceneLayoutVariantFromVisualDNA(visualDNA),
  }
}
