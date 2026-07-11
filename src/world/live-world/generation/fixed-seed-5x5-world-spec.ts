import type { BiomeType } from "../types/terrain-types";

export const FIXED_SEED_5X5_WORLD_ID = "p2-fixed-seed-5x5-world";

export const FIXED_SEED_5X5_SEED = "live-world-p2-fixed-seed-5x5-v1";

export const FIXED_SEED_5X5_CHUNK_RADIUS = 2;

export const FIXED_SEED_5X5_CHUNK_SIZE = 32;

export const FIXED_SEED_5X5_TILE_SIZE = 16;

export interface FixedSeed5x5ChunkCoordinate {
  chunkX: -2 | -1 | 0 | 1 | 2;
  chunkY: -2 | -1 | 0 | 1 | 2;
}

export interface FixedSeed5x5ChunkPlan {
  chunkId: string;
  chunkX: FixedSeed5x5ChunkCoordinate["chunkX"];
  chunkY: FixedSeed5x5ChunkCoordinate["chunkY"];
  primaryBiomeType: BiomeType;
  role:
    | "northwest_woods"
    | "northern_grass"
    | "northeast_water_edge"
    | "western_stone"
    | "center_home"
    | "eastern_water"
    | "southwest_grass"
    | "southern_wetland"
    | "southeast_water";
}

export const FIXED_SEED_5X5_COORDINATES: FixedSeed5x5ChunkCoordinate[] = [
  { chunkX: -2, chunkY: -2 },
  { chunkX: -1, chunkY: -2 },
  { chunkX: 0, chunkY: -2 },
  { chunkX: 1, chunkY: -2 },
  { chunkX: 2, chunkY: -2 },
  { chunkX: -2, chunkY: -1 },
  { chunkX: -1, chunkY: -1 },
  { chunkX: 0, chunkY: -1 },
  { chunkX: 1, chunkY: -1 },
  { chunkX: 2, chunkY: -1 },
  { chunkX: -2, chunkY: 0 },
  { chunkX: -1, chunkY: 0 },
  { chunkX: 0, chunkY: 0 },
  { chunkX: 1, chunkY: 0 },
  { chunkX: 2, chunkY: 0 },
  { chunkX: -2, chunkY: 1 },
  { chunkX: -1, chunkY: 1 },
  { chunkX: 0, chunkY: 1 },
  { chunkX: 1, chunkY: 1 },
  { chunkX: 2, chunkY: 1 },
  { chunkX: -2, chunkY: 2 },
  { chunkX: -1, chunkY: 2 },
  { chunkX: 0, chunkY: 2 },
  { chunkX: 1, chunkY: 2 },
  { chunkX: 2, chunkY: 2 },
];
