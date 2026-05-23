/**
 * 当前文件负责：整合 seed、布局输入、自然世界事实与 Placement Engine 生成 HomeMapState。
 */

import type {
  ConstructionPlanSummary,
  HomeMapState,
  HomeResourceState,
  HomeZone,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import { selectBiomeType } from "@/world/ecology/biome-rules"
import type { BiomeType } from "@/world/ecology/ecology-schema"
import { buildInitialHomePlacements } from "@/world/placement/placement-engine"
import { INITIAL_HOME_PLACEMENT_RULE_SET } from "@/world/placement/placement-rules"
import {
  auditResourcePoolState,
  buildInitialResourcePoolState,
  resourcePoolToHomeResourceSnapshot,
} from "@/world/resource-cycle/resource-cycle"

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

const INITIAL_WORLD_ZONE_TYPES: readonly HomeZone["type"][] = [
  "visual_center",
  "entry_area",
  "natural_boundary",
]

const INITIAL_WORLD_PLACEMENT_LAYERS: readonly MapPlacement["layer"][] = [
  "nature",
  "surface-decoration",
  "atmosphere",
]

const INITIAL_WORLD_FORBIDDEN_CONSTRUCTION_TOKENS = [
  "temporary_shelter",
  "initial_care",
  "care_station",
  "storage",
  "tools",
  "quiet_living",
  "main_path",
  "core_living",
  "shelter_support",
  "care_support",
  "quiet_living_support",
]

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
  const biomeType = selectBiomeType({
    requestedBiomeType: input.biomeType,
    seed,
  })
  const generationInput = {
    ...input,
    biomeType,
  }
  const resources = buildInitialResources(input, biomeType, seed)
  const layoutBuildResult = buildWorldLayoutGenerationInput({
    generationInput,
    seed,
    resources,
  })
  const layoutAudit = auditWorldLayoutGenerationInput(
    layoutBuildResult.layoutInput
  )
  const recipeZones = recipe.areas.map((area) =>
    toHomeZone(area, layoutBuildResult.layoutInput)
  )
  const zones = toInitialWorldZones(recipeZones)
  const placementResult = buildInitialHomePlacements({
    worldId: input.worldId,
    ownerId: input.ownerId,
    seed,
    recipe,
    zones: recipeZones,
    rules: INITIAL_HOME_PLACEMENT_RULE_SET,
    butlerConstructionStyle: input.butlerConstructionStyle,
    layoutInput: layoutBuildResult.layoutInput,
  })
  const placements = toInitialWorldPlacements({
    worldId: input.worldId,
    ownerId: input.ownerId,
    seed,
    zones,
    placements: placementResult.placements,
  })

  return {
    homeMapState: {
      worldId: input.worldId,
      ownerId: input.ownerId,
      seed,
      mapSize: recipe.mapSize,
      zones,
      placements,
      resources,
      constructionPlans: buildInitialConstructionPlans(input, recipe),
      mapDiffs: [],
      createdAt: input.now,
      updatedAt: input.now,
      tags: [
        "mvp_initial_home",
        "world_nature_initial_state",
        "scene_recipe_natural_boundary_only",
        "placement_engine_driven",
        "layout_input_driven",
        "personality_layout_input",
        "stable_world_seed",
        "construction_facts_deferred_to_butler",
        "no_initial_shelter_fact",
        "no_initial_care_point_fact",
        "no_initial_storage_fact",
        "no_initial_finished_path_fact",
        "layout_candidate_driven_natural_zones",
        layoutBuildResult.layoutInput.biome.biomeType,
        layoutBuildResult.layoutInput.selectedCandidate.candidateId,
        layoutBuildResult.layoutInput.variant.variantId,
      ],
    },
    zones,
    warnings: [
      ...layoutAudit.warnings,
      ...placementResult.warnings,
      "WORLD-BUTLER-BOUNDARY-00: construction facts are deferred to butler construction logic.",
    ],
    rejectedPlacementIds: placementResult.rejectedPlacementIds,
    tags: [
      "initial_home_generation_result",
      "world_layout_generation_input_built",
      "world_nature_initial_state",
      "construction_facts_deferred_to_butler",
      ...layoutAudit.tags,
    ],
  }
}

function toHomeZone(
  area: InitialHomeAreaRecipe,
  layoutInput: ReturnType<typeof buildWorldLayoutGenerationInput>["layoutInput"]
): HomeZone {
  const offset = layoutInput.selectedCandidate.zoneOffsets[area.areaType] ?? {
    x: 0,
    y: 0,
  }

  return {
    id: area.id,
    type: area.areaType,
    name: area.name,
    purpose: area.purpose,
    bounds: {
      x: area.center.x + offset.x - Math.floor(area.size.width / 2),
      y: area.center.y + offset.y - Math.floor(area.size.height / 2),
      width: area.size.width,
      height: area.size.height,
    },
    tags: [
      ...area.tags,
      "layout_candidate_zone",
      layoutInput.selectedCandidate.candidateId,
      layoutInput.biome.biomeType,
    ],
  }
}

function toInitialWorldZones(zones: HomeZone[]): HomeZone[] {
  return zones
    .filter((zone) => INITIAL_WORLD_ZONE_TYPES.includes(zone.type))
    .map((zone) => ({
      ...zone,
      tags: Array.from(
        new Set([
          ...zone.tags,
          "initial_world_natural_zone",
          zone.type === "entry_area"
            ? "butler_observation_entry"
            : "world_nature_fact",
          "not_butler_construction_fact",
        ])
      ),
    }))
}

function toInitialWorldPlacements(input: {
  worldId: string
  ownerId: string
  seed: string
  zones: HomeZone[]
  placements: MapPlacement[]
}): MapPlacement[] {
  const naturalPlacements = input.placements.filter(isInitialWorldPlacement)
  const entryZone = input.zones.find((zone) => zone.type === "entry_area")

  if (!entryZone) {
    return naturalPlacements
  }

  return [
    ...naturalPlacements,
    buildButlerObservationPlacement({
      worldId: input.worldId,
      ownerId: input.ownerId,
      seed: input.seed,
      entryZone,
    }),
    buildWorldObservationMarker({
      worldId: input.worldId,
      ownerId: input.ownerId,
      seed: input.seed,
      entryZone,
    }),
  ]
}

function isInitialWorldPlacement(placement: MapPlacement): boolean {
  const normalizedTokens = [
    placement.id,
    placement.label,
    placement.assetId,
    placement.layer,
    ...placement.tags,
  ].map((token) => token.toLowerCase())

  const containsConstructionToken =
    INITIAL_WORLD_FORBIDDEN_CONSTRUCTION_TOKENS.some((token) =>
      normalizedTokens.some((item) => item.includes(token))
    )

  if (containsConstructionToken) return false

  return INITIAL_WORLD_PLACEMENT_LAYERS.includes(placement.layer)
}

function buildButlerObservationPlacement(input: {
  worldId: string
  ownerId: string
  seed: string
  entryZone: HomeZone
}): MapPlacement {
  const center = getZoneCenter(input.entryZone)

  return {
    id: `butler-observing-empty-land-${input.worldId}`,
    assetId: "butlerBodyStandard01",
    x: center.x,
    y: center.y,
    layer: "actor",
    scale: 0.78,
    alpha: 1,
    label: "管家",
    source: "placement_engine",
    tags: [
      "butler",
      "actor",
      "butler_observing_world",
      "butler_logic",
      "not_world_nature_fact",
      "not_construction_result",
      "construction_deferred",
      input.ownerId,
      input.seed,
    ],
  }
}

function buildWorldObservationMarker(input: {
  worldId: string
  ownerId: string
  seed: string
  entryZone: HomeZone
}): MapPlacement {
  const center = getZoneCenter(input.entryZone)

  return {
    id: `world-observation-entry-${input.worldId}`,
    assetId: "arrivalPointGrassRingSoft01",
    x: center.x,
    y: center.y,
    layer: "atmosphere",
    scale: 0.62,
    alpha: 0.72,
    label: "观察起点",
    source: "placement_engine",
    tags: [
      "world_observation_entry",
      "entry_area",
      "initial_world_marker",
      "not_home_building",
      "not_care_point",
      "not_shelter",
      "not_storage",
      input.ownerId,
      input.seed,
    ],
  }
}

function getZoneCenter(zone: HomeZone): { x: number; y: number } {
  return {
    x: zone.bounds.x + Math.floor(zone.bounds.width / 2),
    y: zone.bounds.y + Math.floor(zone.bounds.height / 2),
  }
}

function buildInitialResources(
  input: InitialHomeGenerationInput,
  biomeType: BiomeType,
  seed: string
): HomeResourceState {
  const warmth =
    input.butlerConstructionStyle.warmCaretaker +
    input.butlerConstructionStyle.quietMaintainer
  const structure =
    input.butlerConstructionStyle.structuredBuilder +
    input.butlerConstructionStyle.protectiveKeeper
  const resourcePoolState = buildInitialResourcePoolState({
    worldId: input.worldId,
    regionId: "initial-home",
    seed,
    biomeType,
    currentOverrides: {
      groundHealth: 78,
      naturalGrowth: 46,
      materialReadiness: Math.min(100, 24 + structure * 8),
      careReadiness: Math.min(100, 48 + warmth * 7),
      spacePressure: 18,
    },
    tags: [
      "mvp_initial_resources",
      input.biomeType ? `requested_biome:${input.biomeType}` : "seed_biome",
    ],
  })
  const resourceAudit = auditResourcePoolState(resourcePoolState)

  return {
    ...resourcePoolToHomeResourceSnapshot(resourcePoolState),
    resourcePoolState,
    recentTransactions: resourcePoolState.transactions,
    resourceAudit,
    tags: [
      "mvp_initial_resources",
      "resource_pool_state_snapshot",
      biomeType,
      input.biomeType ? `requested_biome:${input.biomeType}` : "seed_biome",
    ],
  }
}

function buildInitialConstructionPlans(
  input: InitialHomeGenerationInput,
  recipe: InitialHomeSceneRecipe
): ConstructionPlanSummary[] {
  return [
    {
      id: "butler-intent-temporary-shelter-plan",
      title: "规划临时住所",
      targetZoneType: "temporary_shelter",
      status: "planned",
      progress: 0,
      reason: [
        `管家会先观察 ${recipe.name} 的自然资源、空间压力和地貌状态。`,
        "临时住所不是初始世界事实，必须由管家后续消耗资源并通过 MapDiff 建设出来。",
      ].join(""),
      tags: [
        "construction_plan",
        "butler_construction_intent",
        "temporary_shelter",
        "not_initial_world_fact",
        "resource_required_before_build",
        input.butlerConstructionStyle.structuredBuilder > 0.6
          ? "structured_builder_priority"
          : "observe_before_build",
      ],
    },
    {
      id: "butler-intent-initial-care-plan",
      title: "规划基础照护点",
      targetZoneType: "initial_care",
      status: "planned",
      progress: 0,
      reason: [
        "照护点属于管家建设逻辑，不属于世界自然初始内容。",
        "管家需要先确认材料、照护准备度和空间条件，再决定如何建设。",
      ].join(""),
      tags: [
        "construction_plan",
        "butler_construction_intent",
        "initial_care",
        "not_initial_world_fact",
        "resource_required_before_build",
        input.butlerConstructionStyle.warmCaretaker > 0.6
          ? "warm_caretaker_priority"
          : "observe_before_build",
      ],
    },
  ]
}
