export type TerrainType =
  | "grass"
  | "tall_grass"
  | "water"
  | "shoreline"
  | "dirt_path"
  | "wetland"
  | "forest_edge"
  | "stone_ground"
  | "home_ground";

export type BiomeType =
  | "open_grassland"
  | "water_edge"
  | "small_woods"
  | "stone_patch"
  | "wetland_edge"
  | "home_entrance";

export type ResourceType =
  | "tree"
  | "rock"
  | "grass_clump"
  | "flower"
  | "berry_bush"
  | "reed";

export type MovementClass =
  | "walkable"
  | "blocked"
  | "slow"
  | "shallow_water"
  | "edge_only";

export type TileOverlay =
  | "fallen_leaf"
  | "mud_patch"
  | "small_pebble"
  | "grass_detail"
  | "tiny_flower_detail"
  | "shore_foam";

export type TerrainMask = TerrainType[][];

export type BiomeMask = BiomeType[][];

export type BinaryMask = number[][];

export interface TileState {
  x: number;
  y: number;

  terrainType: TerrainType;
  biomeType: BiomeType;

  movementClass: MovementClass;
  traversalCost: number;

  elevation: number;
  moisture: number;
  fertility: number;

  baseBlocksMovement: boolean;
  baseBlocksVision: boolean;

  projectedBlocksMovement: boolean;
  projectedBlocksVision: boolean;

  overlays: TileOverlay[];
}

export interface MaskSpec {
  width: 32;
  height: 32;
  indexing: "mask[y][x]";
  origin: "top_left";
  valueRange: "0_or_1";
}

export const LIVE_WORLD_MASK_SPEC: MaskSpec = {
  width: 32,
  height: 32,
  indexing: "mask[y][x]",
  origin: "top_left",
  valueRange: "0_or_1",
};

