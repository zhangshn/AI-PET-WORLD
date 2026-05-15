/**
 * 当前文件负责：根据初始家园 recipe 生成 HomeMapState。
 */

import type {
  HomeResourceState,
  HomeZone,
} from "@/world/map-state/home-map-state-schema"
import { runPlacementEngine } from "@/world/placement/placement-engine"
import { INITIAL_HOME_PLACEMENT_RULE_SET } from "@/world/placement/placement-rules"
import type { PlacementRecipeItem } from "@/world/placement/placement-schema"

import type {
  InitialHomeGenerationInput,
  InitialHomeGenerationResult,
  InitialHomeSceneRecipe,
} from "./generation-schema"
import { createStableWorldSeed } from "./world-seed"

export const MVP_INITIAL_HOME_SCENE_RECIPE: InitialHomeSceneRecipe = {
  id: "mvp-initial-home-scene-recipe",
  name: "MVP 初始家园 Scene Recipe",
  columns: 80,
  rows: 48,
  tileSize: 24,
  zones: buildInitialHomeZones(),
  recipeItems: buildInitialHomeRecipeItems(),
  tags: [
    "scene_recipe",
    "mvp_initial_home",
    "no_ai_free_layout",
    "adoption_arrival",
  ],
}

export function generateInitialHomeMap(
  input: InitialHomeGenerationInput
): InitialHomeGenerationResult {
  const seed = createStableWorldSeed(input.params.seedInput)
  const recipe = input.recipe ?? MVP_INITIAL_HOME_SCENE_RECIPE
  const placementResult = runPlacementEngine({
    mapId: recipe.id,
    columns: recipe.columns,
    rows: recipe.rows,
    tileSize: recipe.tileSize,
    zones: recipe.zones,
    recipeItems: recipe.recipeItems,
    rules: INITIAL_HOME_PLACEMENT_RULE_SET,
  })

  return {
    seed,
    mapState: {
      id: "mvp-initial-home",
      name: "MVP Initial Home",
      columns: recipe.columns,
      rows: recipe.rows,
      tileSize: recipe.tileSize,
      seed: seed.value,
      zones: recipe.zones,
      placements: placementResult.placements,
      resources: buildInitialHomeResourceState(input),
      diffs: [],
      tags: [
        ...recipe.tags,
        input.params.constructionStyle ?? "construction_style_pending",
        ...(input.params.resourceBiasTags ?? []),
      ],
    },
    placementWarnings: placementResult.warnings,
    rejectedPlacementIds: placementResult.rejected.map((item) => item.itemId),
    tags: [
      "initial_home_generated",
      "scene_recipe_driven",
      "placement_engine_driven",
    ],
  }
}

function buildInitialHomeZones(): HomeZone[] {
  return [
    {
      id: "visual_center",
      name: "视觉中心范围",
      purpose: "让玩家第一眼看到抵达点、照护点、临时住所和路径关系。",
      bounds: { x: 18, y: 14, width: 45, height: 21 },
      requiredAssetIds: [
        "groundGrassBase01",
        "pathDirtHorizontal01",
        "buildingTempShelter01",
        "buildingPetArrivalPoint01",
      ],
      optionalAssetIds: ["surfaceGrassTuft01", "surfaceStoneSmall01"],
      forbiddenTags: ["old_birth_device"],
      decorationDensity: "medium",
      pathConnectionTargetIds: [
        "pet_arrival",
        "initial_care",
        "temporary_shelter",
      ],
      tags: ["zone", "visual_center"],
    },
    {
      id: "pet_arrival",
      name: "宠物抵达区",
      purpose: "表达宠物被送达家园后的第一位置。",
      bounds: { x: 14, y: 18, width: 11, height: 9 },
      requiredAssetIds: ["buildingPetArrivalPoint01"],
      optionalAssetIds: ["surfaceStoneSmall01", "surfaceGrassTuft01"],
      forbiddenTags: ["old_birth_device"],
      decorationDensity: "low",
      pathConnectionTargetIds: ["initial_care"],
      tags: ["zone", "arrival"],
    },
    {
      id: "initial_care",
      name: "初始照护区",
      purpose: "承接宠物最初的食物、水和观察。",
      bounds: { x: 31, y: 27, width: 10, height: 6 },
      requiredAssetIds: [
        "buildingInitialCareStation01",
        "facilityFoodBowlFull01",
        "facilityWaterBowlFull01",
      ],
      optionalAssetIds: ["surfaceFlowerPatch01", "facilityStorageBoxClosed01"],
      forbiddenTags: ["old_birth_device"],
      decorationDensity: "low",
      pathConnectionTargetIds: ["pet_arrival", "temporary_shelter"],
      tags: ["zone", "care"],
    },
    {
      id: "temporary_shelter",
      name: "临时住所区",
      purpose: "表达家园第一阶段的遮蔽和居住支持。",
      bounds: { x: 47, y: 17, width: 11, height: 9 },
      requiredAssetIds: ["buildingTempShelter01"],
      optionalAssetIds: ["surfaceFallenLeaf01", "natureBushSmall01"],
      forbiddenTags: ["final_large_house", "old_birth_device"],
      decorationDensity: "low",
      pathConnectionTargetIds: ["initial_care", "pet_rest"],
      tags: ["zone", "shelter"],
    },
    {
      id: "pet_rest",
      name: "宠物休息区",
      purpose: "提供宠物最初的休息位置。",
      bounds: { x: 52, y: 27, width: 8, height: 6 },
      requiredAssetIds: ["facilityPetBedNeat01"],
      optionalAssetIds: ["surfaceGrassTuft01"],
      forbiddenTags: ["isolated_bed"],
      decorationDensity: "low",
      pathConnectionTargetIds: ["temporary_shelter"],
      tags: ["zone", "rest"],
    },
    {
      id: "storage_tools",
      name: "储物工具区",
      purpose: "表达管家开始整理资源和工具。",
      bounds: { x: 38, y: 28, width: 6, height: 5 },
      requiredAssetIds: ["facilityStorageBoxClosed01"],
      optionalAssetIds: ["surfaceStoneSmall01"],
      forbiddenTags: ["isolated_storage"],
      decorationDensity: "low",
      pathConnectionTargetIds: ["initial_care"],
      tags: ["zone", "storage"],
    },
    {
      id: "natural_boundary",
      name: "自然边界区",
      purpose: "减少大面积空草地，表达自然资源和边界。",
      bounds: { x: 1, y: 1, width: 80, height: 48 },
      requiredAssetIds: ["natureTreeSmall01", "natureBushSmall01"],
      optionalAssetIds: [
        "surfaceGrassTuft01",
        "surfaceStoneSmall01",
        "surfaceFlowerPatch01",
        "surfaceFallenLeaf01",
      ],
      forbiddenTags: ["path_blocker"],
      decorationDensity: "medium",
      pathConnectionTargetIds: [],
      tags: ["zone", "nature"],
    },
  ]
}

function buildInitialHomeRecipeItems(): PlacementRecipeItem[] {
  return [
    baseItem("base-grass", "groundGrassBase01", "ground", "visual_center", 1, 1, {
      width: 80,
      height: 48,
      priority: 1,
      tags: ["base_ground"],
    }),
    ...buildDirtSupportItems(),
    ...buildEdgeItems(),
    ...buildPathItems(),
    item("arrival-point", "buildingPetArrivalPoint01", "structure", "pet_arrival", 18, 21, {
      width: 4,
      height: 4,
      priority: 50,
      tags: ["arrival_focus"],
    }),
    item("initial-care-station", "buildingInitialCareStation01", "structure", "initial_care", 35, 30, {
      width: 4,
      height: 4,
      priority: 52,
      tags: ["care_station"],
    }),
    item("temporary-shelter", "buildingTempShelter01", "structure", "temporary_shelter", 52, 20, {
      width: 5,
      height: 4,
      priority: 55,
      requiredSupportLayer: "ground",
      tags: ["temporary_shelter"],
    }),
    item("food-bowl", "facilityFoodBowlFull01", "facility", "initial_care", 34, 29, {
      width: 1,
      height: 1,
      priority: 60,
      tags: ["care", "food"],
    }),
    item("water-bowl", "facilityWaterBowlFull01", "facility", "initial_care", 36, 29, {
      width: 1,
      height: 1,
      priority: 61,
      tags: ["care", "water"],
    }),
    item("storage-box", "facilityStorageBoxClosed01", "facility", "storage_tools", 39, 30, {
      width: 1,
      height: 1,
      priority: 62,
      tags: ["storage"],
    }),
    item("pet-bed", "facilityPetBedNeat01", "facility", "pet_rest", 55, 29, {
      width: 2,
      height: 1,
      priority: 63,
      tags: ["rest"],
    }),
    ...buildNatureItems(),
    ...buildSurfaceDecorationItems(),
    item("butler-near-shelter", "butlerBodyStandard01", "actor", "temporary_shelter", 47, 24, {
      width: 1,
      height: 2,
      priority: 100,
      tags: ["butler", "actor"],
    }),
    item("pet-near-arrival-point", "petPoseSkeletonIdleFront01", "actor", "pet_arrival", 22, 23, {
      width: 1,
      height: 1,
      priority: 101,
      tags: ["pet", "actor"],
    }),
  ]
}

function buildDirtSupportItems(): PlacementRecipeItem[] {
  return [
    ...rectangleTiles("shelter-dirt", 48, 18, 7, 3, "temporary_shelter"),
    ...rectangleTiles("care-dirt", 33, 28, 4, 2, "initial_care"),
  ]
}

function buildEdgeItems(): PlacementRecipeItem[] {
  return [
    baseItem("shelter-dirt-edge-top", "edgeGrassDirtTop01", "edge", "temporary_shelter", 50, 18, {
      priority: 18,
      tags: ["ground_edge"],
    }),
    baseItem("shelter-dirt-edge-bottom", "edgeGrassDirtBottom01", "edge", "temporary_shelter", 50, 21, {
      priority: 19,
      tags: ["ground_edge"],
    }),
    baseItem("shelter-dirt-edge-left", "edgeGrassDirtLeft01", "edge", "temporary_shelter", 48, 19, {
      priority: 20,
      tags: ["ground_edge"],
    }),
    baseItem("shelter-dirt-edge-right", "edgeGrassDirtRight01", "edge", "temporary_shelter", 54, 19, {
      priority: 21,
      tags: ["ground_edge"],
    }),
    baseItem("care-dirt-edge-top", "edgeGrassDirtTop01", "edge", "initial_care", 34, 28, {
      priority: 22,
      tags: ["ground_edge"],
    }),
    baseItem("care-dirt-edge-bottom", "edgeGrassDirtBottom01", "edge", "initial_care", 34, 30, {
      priority: 23,
      tags: ["ground_edge"],
    }),
  ]
}

function buildPathItems(): PlacementRecipeItem[] {
  const points = [
    [18, 21],
    [19, 21],
    [20, 21],
    [20, 22],
    [20, 23],
    [21, 23],
    [22, 23],
    [23, 23],
    [23, 24],
    [23, 25],
    [24, 25],
    [25, 25],
    [26, 25],
    [27, 25],
    [27, 26],
    [27, 27],
    [28, 27],
    [29, 27],
    [30, 27],
    [31, 27],
    [31, 28],
    [31, 29],
    [32, 29],
    [33, 29],
    [34, 29],
    [35, 29],
    [36, 29],
    [37, 29],
    [38, 29],
    [38, 28],
    [38, 27],
    [39, 27],
    [40, 27],
    [41, 27],
    [42, 27],
    [42, 26],
    [42, 25],
    [43, 25],
    [44, 25],
    [45, 25],
    [45, 24],
    [45, 23],
    [46, 23],
    [47, 23],
    [48, 23],
    [49, 23],
    [49, 22],
    [49, 21],
    [50, 21],
    [51, 21],
    [52, 21],
  ] as const

  return points.map(([x, y], index) =>
    baseItem(
      `main-path-${index + 1}`,
      index % 5 === 0 ? "pathDirtVertical01" : "pathDirtHorizontal01",
      "path",
      "visual_center",
      x,
      y,
      {
        priority: 20 + index,
        tags: ["main_path"],
      }
    )
  )
}

function buildNatureItems(): PlacementRecipeItem[] {
  return [
    item("upper-left-tree", "natureTreeSmall01", "nature", "natural_boundary", 7, 9, {
      width: 2,
      height: 3,
      priority: 70,
      tags: ["tree"],
    }),
    item("right-upper-tree", "natureTreeSmall01", "nature", "natural_boundary", 69, 14, {
      width: 2,
      height: 3,
      priority: 71,
      tags: ["tree"],
    }),
    item("left-boundary-bush", "natureBushSmall01", "nature", "natural_boundary", 8, 11, {
      width: 2,
      height: 1,
      priority: 72,
      tags: ["bush"],
    }),
    item("arrival-bottom-bush", "natureBushSmall01", "nature", "pet_arrival", 20, 29, {
      width: 2,
      height: 1,
      priority: 73,
      tags: ["bush"],
    }),
    item("shelter-right-bush", "natureBushSmall01", "nature", "temporary_shelter", 57, 25, {
      width: 2,
      height: 1,
      priority: 74,
      tags: ["bush"],
    }),
  ]
}

function buildSurfaceDecorationItems(): PlacementRecipeItem[] {
  return [
    item("arrival-side-grass", "surfaceGrassTuft01", "surface-decoration", "pet_arrival", 14, 24, {
      width: 1,
      height: 1,
      priority: 80,
      tags: ["grass_tuft"],
    }),
    item("arrival-stone", "surfaceStoneSmall01", "surface-decoration", "pet_arrival", 23, 22, {
      width: 1,
      height: 1,
      priority: 81,
      tags: ["stone"],
    }),
    item("care-flower", "surfaceFlowerPatch01", "surface-decoration", "initial_care", 31, 30, {
      width: 1,
      height: 1,
      priority: 82,
      tags: ["flower"],
    }),
    item("shelter-fallen-leaf", "surfaceFallenLeaf01", "surface-decoration", "temporary_shelter", 58, 24, {
      width: 1,
      height: 1,
      priority: 83,
      tags: ["fallen_leaf"],
    }),
  ]
}

function rectangleTiles(
  idPrefix: string,
  startX: number,
  startY: number,
  width: number,
  height: number,
  zoneId: PlacementRecipeItem["zoneId"]
): PlacementRecipeItem[] {
  return Array.from({ length: width * height }, (_, index) => {
    const x = startX + (index % width)
    const y = startY + Math.floor(index / width)

    return baseItem(
      `${idPrefix}-${x}-${y}`,
      "groundDirtBase01",
      "ground",
      zoneId,
      x,
      y,
      {
        priority: 10 + index,
        tags: ["ground_support"],
      }
    )
  })
}

function baseItem(
  id: string,
  assetId: PlacementRecipeItem["assetId"],
  layer: PlacementRecipeItem["layer"],
  zoneId: PlacementRecipeItem["zoneId"],
  x: number,
  y: number,
  options: Partial<
    Pick<
      PlacementRecipeItem,
      | "width"
      | "height"
      | "scale"
      | "priority"
      | "anchor"
      | "requiredSupportLayer"
      | "tags"
    >
  > = {}
): PlacementRecipeItem {
  return {
    id,
    assetId,
    layer,
    zoneId,
    x,
    y,
    width: options.width ?? 1,
    height: options.height ?? 1,
    scale: options.scale ?? 1,
    priority: options.priority ?? 1,
    anchor: options.anchor ?? "top-left",
    requiredSupportLayer: options.requiredSupportLayer,
    tags: options.tags ?? [],
  }
}

function item(
  id: string,
  assetId: PlacementRecipeItem["assetId"],
  layer: PlacementRecipeItem["layer"],
  zoneId: PlacementRecipeItem["zoneId"],
  x: number,
  y: number,
  options: Partial<
    Pick<
      PlacementRecipeItem,
      | "width"
      | "height"
      | "scale"
      | "priority"
      | "anchor"
      | "requiredSupportLayer"
      | "tags"
    >
  >
): PlacementRecipeItem {
  return baseItem(id, assetId, layer, zoneId, x, y, {
    anchor: "bottom-center",
    ...options,
  })
}

function buildInitialHomeResourceState(
  input: InitialHomeGenerationInput
): HomeResourceState {
  return {
    groundHealth: 78,
    naturalGrowth: 42,
    materialReadiness: 24,
    careReadiness: 52,
    spacePressure: 18,
    tags: [
      "mvp_initial_resources",
      input.params.constructionStyle ?? "style_pending",
      ...(input.params.resourceBiasTags ?? []),
    ],
  }
}
