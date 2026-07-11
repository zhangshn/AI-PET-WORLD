import type { LifecycleStage } from "../types/lifecycle-types";
import type {
  BiomeType,
  ResourceType,
  TerrainType,
} from "../types/terrain-types";

export interface ResourcePlacementRule {
  resourceType: ResourceType;

  allowedTerrain: TerrainType[];
  preferredBiome: BiomeType[];
  forbiddenTerrain: TerrainType[];

  minDistanceTiles: number;
  maxPerChunk: number;
  placementWeight: number;

  avoidMainPath: boolean;
  avoidWaterDistanceTiles?: number;
  preferWaterDistanceTiles?: number;

  defaultLifecycleStage: LifecycleStage;
  defaultCollisionProfileId: string;
  defaultVisualProfileId: string;
}

export const MVP_RESOURCE_PLACEMENT_RULES: ResourcePlacementRule[] = [
  {
    resourceType: "tree",
    allowedTerrain: ["grass", "tall_grass", "forest_edge"],
    preferredBiome: ["small_woods", "water_edge"],
    forbiddenTerrain: ["water", "dirt_path"],
    minDistanceTiles: 2,
    maxPerChunk: 16,
    placementWeight: 0.8,
    avoidMainPath: true,
    defaultLifecycleStage: "mature",
    defaultCollisionProfileId: "tree_trunk_1x1",
    defaultVisualProfileId: "tree_mature_3x3",
  },
  {
    resourceType: "rock",
    allowedTerrain: ["grass", "stone_ground", "forest_edge"],
    preferredBiome: ["stone_patch"],
    forbiddenTerrain: ["water", "dirt_path"],
    minDistanceTiles: 2,
    maxPerChunk: 8,
    placementWeight: 0.45,
    avoidMainPath: true,
    defaultLifecycleStage: "medium",
    defaultCollisionProfileId: "rock_body_1x1",
    defaultVisualProfileId: "rock_medium_1x1",
  },
  {
    resourceType: "grass_clump",
    allowedTerrain: ["grass", "tall_grass"],
    preferredBiome: ["open_grassland"],
    forbiddenTerrain: ["water", "dirt_path"],
    minDistanceTiles: 1,
    maxPerChunk: 24,
    placementWeight: 1,
    avoidMainPath: false,
    defaultLifecycleStage: "mature",
    defaultCollisionProfileId: "non_blocking_detail",
    defaultVisualProfileId: "grass_clump_mature_1x1",
  },
  {
    resourceType: "flower",
    allowedTerrain: ["grass", "tall_grass", "shoreline"],
    preferredBiome: ["open_grassland", "water_edge"],
    forbiddenTerrain: ["water", "stone_ground"],
    minDistanceTiles: 1,
    maxPerChunk: 16,
    placementWeight: 0.55,
    avoidMainPath: false,
    defaultLifecycleStage: "blooming",
    defaultCollisionProfileId: "non_blocking_detail",
    defaultVisualProfileId: "flower_blooming_1x1",
  },
  {
    resourceType: "berry_bush",
    allowedTerrain: ["grass", "tall_grass", "forest_edge"],
    preferredBiome: ["small_woods"],
    forbiddenTerrain: ["water", "dirt_path"],
    minDistanceTiles: 2,
    maxPerChunk: 8,
    placementWeight: 0.35,
    avoidMainPath: true,
    defaultLifecycleStage: "fruiting",
    defaultCollisionProfileId: "bush_body_1x1",
    defaultVisualProfileId: "berry_bush_fruiting_1x1",
  },
  {
    resourceType: "reed",
    allowedTerrain: ["shoreline", "wetland"],
    preferredBiome: ["water_edge", "wetland_edge"],
    forbiddenTerrain: ["dirt_path", "stone_ground"],
    minDistanceTiles: 1,
    maxPerChunk: 12,
    placementWeight: 0.6,
    avoidMainPath: true,
    preferWaterDistanceTiles: 1,
    defaultLifecycleStage: "mature",
    defaultCollisionProfileId: "reed_soft_edge",
    defaultVisualProfileId: "reed_mature_1x1",
  },
];

