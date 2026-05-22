/**
 * 当前文件负责：整合 seed、布局输入、Scene Recipe 与 Placement Engine 生成 HomeMapState。
 */

import type {
  ConstructionPlanSummary,
  HomeMapState,
  HomeResourceState,
  HomeZone,
} from "@/world/map-state/home-map-state-schema"
import { buildInitialHomePlacements } from "@/world/placement/placement-engine"
import { INITIAL_HOME_PLACEMENT_RULE_SET } from "@/world/placement/placement-rules"

import type {
  InitialHomeAreaRecipe,
  InitialHomeGenerationInput,
  InitialHomeGenerationResult,
  InitialHomeSceneRecipe,
} from "./generation-schema"
import { INITIAL_HOME_SCENE_RECIPE } from "./initial-home-scene-recipe"
import { auditWorldLayoutGenerationInput } from "./world-layout-input-audit"
import { buildWorldLayoutGenerationInput } from "./world-layout-input-builder"
import { buildStableWorldSeed } from "./world-seed"

export function generateInitialHomeMap(
  input: InitialHomeGenerationInput
): HomeMapState {
  return generateInitialHomeMapResult(input).homeMapState
}

export function generateInitialHomeMapResult(
  input: InitialHomeGenerationInput
): InitialHomeGenerationResult {
  const recipe = input.recipe ?? INITIAL_HOME_SCENE_RECIPE
  const seed = buildStableWorldSeed({
    ownerId: input.ownerId,
    birthSignature: input.birthSignature,
    worldSalt: input.worldSalt,
  })
  const resources = buildInitialResources(input)
  const layoutBuildResult = buildWorldLayoutGenerationInput({
    generationInput: input,
    seed,
    resources,
  })
  const layoutAudit = auditWorldLayoutGenerationInput(
    layoutBuildResult.layoutInput
  )
  const zones = recipe.areas.map(toHomeZone)
  const placementResult = buildInitialHomePlacements({
    worldId: input.worldId,
    ownerId: input.ownerId,
    seed,
    recipe,
    zones,
    rules: INITIAL_HOME_PLACEMENT_RULE_SET,
    butlerConstructionStyle: input.butlerConstructionStyle,
    layoutInput: layoutBuildResult.layoutInput,
  })

  return {
    homeMapState: {
      worldId: input.worldId,
      ownerId: input.ownerId,
      seed,
      mapSize: recipe.mapSize,
      zones,
      placements: placementResult.placements,
      resources,
      constructionPlans: buildInitialConstructionPlans(input, recipe),
      mapDiffs: [],
      createdAt: input.now,
      updatedAt: input.now,
      tags: [
        "mvp_initial_home",
        "scene_recipe_driven",
        "placement_engine_driven",
        "layout_input_driven",
        "personality_layout_input",
        "stable_world_seed",
        layoutBuildResult.layoutInput.variant.variantId,
      ],
    },
    zones,
    warnings: [...layoutAudit.warnings, ...placementResult.warnings],
    rejectedPlacementIds: placementResult.rejectedPlacementIds,
    tags: [
      "initial_home_generation_result",
      "world_layout_generation_input_built",
      ...layoutAudit.tags,
    ],
  }
}

function toHomeZone(area: InitialHomeAreaRecipe): HomeZone {
  return {
    id: area.id,
    type: area.areaType,
    name: area.name,
    purpose: area.purpose,
    bounds: {
      x: area.center.x - Math.floor(area.size.width / 2),
      y: area.center.y - Math.floor(area.size.height / 2),
      width: area.size.width,
      height: area.size.height,
    },
    tags: area.tags,
  }
}

function buildInitialResources(
  input: InitialHomeGenerationInput
): HomeResourceState {
  const warmth =
    input.butlerConstructionStyle.warmCaretaker +
    input.butlerConstructionStyle.quietMaintainer
  const structure =
    input.butlerConstructionStyle.structuredBuilder +
    input.butlerConstructionStyle.protectiveKeeper

  return {
    groundHealth: 78,
    naturalGrowth: 46,
    materialReadiness: Math.min(100, 24 + structure * 8),
    careReadiness: Math.min(100, 48 + warmth * 7),
    spacePressure: 18,
    tags: ["mvp_initial_resources", "default_resource_state"],
  }
}

function buildInitialConstructionPlans(
  input: InitialHomeGenerationInput,
  recipe: InitialHomeSceneRecipe
): ConstructionPlanSummary[] {
  return [
    {
      id: "initial-temporary-shelter-plan",
      title: "维持临时住所",
      targetZoneType: "temporary_shelter",
      status: "planned",
      progress: 8 + input.butlerConstructionStyle.structuredBuilder * 4,
      reason: `由 ${recipe.name} 初始化，用于保证初始家园具备基础遮蔽与管理空间。`,
      tags: ["construction_plan", "temporary_shelter", "mvp_initial"],
    },
    {
      id: "initial-care-point-plan",
      title: "稳定初始照护点",
      targetZoneType: "initial_care",
      status: "planned",
      progress: 12 + input.butlerConstructionStyle.warmCaretaker * 5,
      reason: "用于保证基础物资、照护点和生活区有基础秩序。",
      tags: ["construction_plan", "care_point", "mvp_initial"],
    },
  ]
}
