import type {
  LifecycleStage,
  BerryBushStage,
  FlowerStage,
  GrassClumpStage,
  ReedStage,
  RockStage,
  TreeStage,
} from "./lifecycle-types";
import type {
  BinaryMask,
  BiomeMask,
  BiomeType,
  MovementClass,
  ResourceType,
  TerrainMask,
  TerrainType,
} from "./terrain-types";

export type VisualCacheStatus =
  | "missing"
  | "generation_requested"
  | "generated"
  | "failed";

export interface VisualCacheState {
  status: VisualCacheStatus;
  latestOutputId?: string;
  latestCandidateId?: string;
  updatedAt?: string;
}

export type VisualReviewStatus =
  | "generated"
  | "auto_rejected"
  | "pending_owner_review"
  | "owner_approved"
  | "owner_rejected";

export type DecorationType =
  | "grass_detail"
  | "tiny_flower_detail"
  | "fallen_leaf"
  | "small_pebble"
  | "shore_foam"
  | "mud_patch";

export type ForbiddenObjectType =
  | "building"
  | "npc"
  | "bridge"
  | "fence"
  | "chest"
  | "extra_large_tree"
  | "extra_large_rock";

export type EntityCountPolicy =
  | "exact"
  | "approximate";

export interface VisualConstraints {
  forbidUnlistedInteractiveResources: true;

  allowedDecorations: DecorationType[];
  forbiddenObjects: ForbiddenObjectType[];

  entityCountPolicy: Record<ResourceType, EntityCountPolicy>;

  maxEntityCenterOffsetTiles: number;

  preserveTerrainMask: {
    water: true;
    dirt_path: true;
    shoreline: true;
  };

  preserveChunkEdges: true;
}

export interface StyleProfile {
  styleProfileId: string;
  camera: "top_down" | "three_quarter";
  pixelArt: boolean;
  targetTileSize: 16;
  notes?: string;
}

export type ChunkVisualEntity =
  | {
      entityId: string;
      entityType: "tree";
      stage: TreeStage;
      tileX: number;
      tileY: number;
      widthTiles: number;
      heightTiles: number;
      blocksMovement: boolean;
      sourceRuleId: string;
    }
  | {
      entityId: string;
      entityType: "rock";
      stage: RockStage;
      tileX: number;
      tileY: number;
      widthTiles: number;
      heightTiles: number;
      blocksMovement: boolean;
      sourceRuleId: string;
    }
  | {
      entityId: string;
      entityType: "grass_clump";
      stage: GrassClumpStage;
      tileX: number;
      tileY: number;
      widthTiles: number;
      heightTiles: number;
      blocksMovement: boolean;
      sourceRuleId: string;
    }
  | {
      entityId: string;
      entityType: "flower";
      stage: FlowerStage;
      tileX: number;
      tileY: number;
      widthTiles: number;
      heightTiles: number;
      blocksMovement: boolean;
      sourceRuleId: string;
    }
  | {
      entityId: string;
      entityType: "berry_bush";
      stage: BerryBushStage;
      tileX: number;
      tileY: number;
      widthTiles: number;
      heightTiles: number;
      blocksMovement: boolean;
      sourceRuleId: string;
    }
  | {
      entityId: string;
      entityType: "reed";
      stage: ReedStage;
      tileX: number;
      tileY: number;
      widthTiles: number;
      heightTiles: number;
      blocksMovement: boolean;
      sourceRuleId: string;
    };

export interface EdgeEntityHint {
  entityId: string;
  entityType: ResourceType;
  stage: LifecycleStage;
  tileX: number;
  tileY: number;
  distanceToEdge: number;
}

export interface ChunkEdgeContext {
  chunkId: string;

  terrainEdge: TerrainType[];
  biomeEdge: BiomeType[];
  movementEdge: MovementClass[];

  entityEdgeHints: EdgeEntityHint[];
}

export interface NeighborContext {
  north?: ChunkEdgeContext;
  south?: ChunkEdgeContext;
  east?: ChunkEdgeContext;
  west?: ChunkEdgeContext;
}

export interface ChunkVisualInput {
  inputVersion: string;
  worldRuleVersion: string;
  generatorVersion: string;
  inputPayloadHash: string;

  chunkId: string;
  chunkX: number;
  chunkY: number;

  tileWidth: 32;
  tileHeight: 32;
  tileSize: 16;

  pixelWidth: 512;
  pixelHeight: 512;

  terrainMask: TerrainMask;
  biomeMask: BiomeMask;
  walkableMask: BinaryMask;
  collisionMask: BinaryMask;

  entityMap: ChunkVisualEntity[];

  neighborContext: NeighborContext;
  styleProfile: StyleProfile;
  visualConstraints: VisualConstraints;
}

export interface ChunkVisualOutput {
  outputId: string;
  outputVersion: string;

  inputPayloadHash: string;
  chunkId: string;

  imagePath: string;

  modelVersion: string;
  promptVersion: string;
  generatedAt: string;

  status: VisualReviewStatus;
}

