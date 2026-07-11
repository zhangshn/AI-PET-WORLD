import type {
  CollisionCell,
  InteractionCell,
  WalkableCell,
} from "./collision-types";
import type { WorldEntity } from "./entity-types";
import type { BiomeType, TileState } from "./terrain-types";
import type { VisualCacheState } from "./visual-types";

export type TimeOfDay =
  | "morning"
  | "day"
  | "evening"
  | "night";

export type Season =
  | "spring"
  | "summer"
  | "autumn"
  | "winter";

export interface TimeState {
  currentTick: number;
  dayIndex: number;
  timeOfDay: TimeOfDay;
  season: Season;
}

export interface PlayerWorldState {
  playerId: string;
  worldTileX: number;
  worldTileY: number;
  currentChunkId: string;
}

export type ChunkLoadedState =
  | "not_generated"
  | "generated"
  | "active"
  | "sleeping";

export interface ChunkRuntimeState {
  loadedState: ChunkLoadedState;
  isActive: boolean;
  lastActiveTick: number;
  lastUpdatedTick: number;
}

export interface ChunkState {
  chunkId: string;
  worldId: string;

  chunkX: number;
  chunkY: number;

  width: 32;
  height: 32;

  primaryBiomeType: BiomeType;

  tiles: TileState[][];
  entities: WorldEntity[];

  collisionLayer: CollisionCell[][];
  walkableLayer: WalkableCell[][];
  interactionLayer: InteractionCell[][];

  visualCache: VisualCacheState;
  runtimeState: ChunkRuntimeState;
}

export interface WorldState {
  worldId: string;
  worldVersion: string;
  worldRuleVersion: string;
  generatorVersion: string;

  seed: string;

  chunkSize: 32;
  tileSize: 16;
  chunkRadius: 2;
  activeChunkRadius: 1;

  timeState: TimeState;

  chunks: ChunkState[];
  playerState?: PlayerWorldState;

  createdAt: string;
  updatedAt: string;
}

