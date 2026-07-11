import { projectChunkCollision } from "../collision/collision-projection";
import type { CollisionState, FootprintCell } from "../types/collision-types";
import type { InteractionState, WorldEntity } from "../types/entity-types";
import type {
  BerryBushLifecycle,
  FlowerLifecycle,
  GrassClumpLifecycle,
  ReedLifecycle,
  RockLifecycle,
  TreeLifecycle,
} from "../types/lifecycle-types";
import type {
  BiomeType,
  MovementClass,
  TerrainType,
  TileOverlay,
  TileState,
} from "../types/terrain-types";
import type { ChunkVisualEntity, ChunkVisualInput } from "../types/visual-types";
import type { ChunkState } from "../types/world-types";

const BLOCKED_TRAVERSAL_COST = 999999;

function movementClassForTerrain(terrainType: TerrainType): MovementClass {
  if (terrainType === "water") {
    return "blocked";
  }

  if (terrainType === "wetland") {
    return "slow";
  }

  if (terrainType === "shoreline") {
    return "edge_only";
  }

  return "walkable";
}

function traversalCostForTerrain(terrainType: TerrainType): number {
  if (terrainType === "water") {
    return BLOCKED_TRAVERSAL_COST;
  }

  if (terrainType === "dirt_path") {
    return 0.8;
  }

  if (terrainType === "wetland") {
    return 2;
  }

  if (terrainType === "shoreline") {
    return 1.2;
  }

  return 1;
}

function overlaysForTerrain(terrainType: TerrainType): TileOverlay[] {
  if (terrainType === "shoreline") {
    return ["shore_foam", "small_pebble"];
  }

  if (terrainType === "wetland") {
    return ["mud_patch"];
  }

  if (terrainType === "grass" || terrainType === "tall_grass") {
    return ["grass_detail"];
  }

  return [];
}

function createTiles(input: ChunkVisualInput): TileState[][] {
  return input.terrainMask.map((row, y) =>
    row.map((terrainType, x) => {
      const biomeType = input.biomeMask[y][x];
      const movementClass = movementClassForTerrain(terrainType);
      const baseBlocksMovement = movementClass === "blocked";

      return {
        x,
        y,
        terrainType,
        biomeType,
        movementClass,
        traversalCost: traversalCostForTerrain(terrainType),
        elevation: 0,
        moisture:
          biomeType === "water_edge" || biomeType === "wetland_edge" ? 0.8 : 0.45,
        fertility:
          biomeType === "small_woods" || biomeType === "open_grassland"
            ? 0.7
            : 0.5,
        baseBlocksMovement,
        baseBlocksVision: false,
        projectedBlocksMovement: baseBlocksMovement,
        projectedBlocksVision: false,
        overlays: overlaysForTerrain(terrainType),
      } satisfies TileState;
    }),
  );
}

function squareFootprint(width: number, height: number): FootprintCell[] {
  const footprint: FootprintCell[] = [];

  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      footprint.push({ dx, dy });
    }
  }

  return footprint;
}

function interactionRing(): FootprintCell[] {
  return [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
}

function collisionForVisualEntity(entity: ChunkVisualEntity): CollisionState {
  const visualSize = {
    width: entity.widthTiles,
    height: entity.heightTiles,
  };

  if (entity.entityType === "tree") {
    return {
      blocksMovement: true,
      blocksVision: true,
      visualSize,
      movementFootprint: [{ dx: 0, dy: 0 }],
      visionFootprint: squareFootprint(entity.widthTiles, entity.heightTiles),
      interactionFootprint: interactionRing(),
      collisionProfileId: "tree_trunk_1x1",
    };
  }

  if (entity.entityType === "rock") {
    return {
      blocksMovement: true,
      blocksVision: false,
      visualSize,
      movementFootprint: [{ dx: 0, dy: 0 }],
      visionFootprint: [],
      interactionFootprint: interactionRing(),
      collisionProfileId: "rock_body_1x1",
    };
  }

  return {
    blocksMovement: false,
    blocksVision: false,
    visualSize,
    movementFootprint: [],
    visionFootprint: [],
    interactionFootprint: [{ dx: 0, dy: 0 }],
    collisionProfileId: "non_blocking_resource",
  };
}

function interactionForVisualEntity(entity: ChunkVisualEntity): InteractionState {
  if (entity.entityType === "tree") {
    return {
      enabled: true,
      kinds: ["inspect", "chop"],
    };
  }

  if (entity.entityType === "rock") {
    return {
      enabled: true,
      kinds: ["inspect", "mine"],
    };
  }

  return {
    enabled: true,
    kinds: ["inspect", "harvest"],
  };
}

function lifecycleForVisualEntity(
  entity: ChunkVisualEntity,
):
  | TreeLifecycle
  | RockLifecycle
  | GrassClumpLifecycle
  | FlowerLifecycle
  | BerryBushLifecycle
  | ReedLifecycle {
  if (entity.entityType === "tree") {
    return {
      type: "tree",
      stage: entity.stage,
      ageTicks: entity.stage === "young" ? 250 : 1000,
    };
  }

  if (entity.entityType === "rock") {
    return {
      type: "rock",
      stage: entity.stage,
      durability: entity.stage === "small" ? 1 : 2,
    };
  }

  if (entity.entityType === "grass_clump") {
    return {
      type: "grass_clump",
      stage: entity.stage,
      ageTicks: 120,
    };
  }

  if (entity.entityType === "flower") {
    return {
      type: "flower",
      stage: entity.stage,
      ageTicks: 180,
    };
  }

  if (entity.entityType === "berry_bush") {
    return {
      type: "berry_bush",
      stage: entity.stage,
      ageTicks: 400,
    };
  }

  return {
    type: "reed",
    stage: entity.stage,
    ageTicks: 200,
  };
}

function createWorldEntity(entity: ChunkVisualEntity, chunkId: string): WorldEntity {
  const base = {
    entityId: entity.entityId,
    chunkId,
    tileX: entity.tileX,
    tileY: entity.tileY,
    widthTiles: entity.widthTiles,
    heightTiles: entity.heightTiles,
    collision: collisionForVisualEntity(entity),
    interaction: interactionForVisualEntity(entity),
    visualProfileId: `${entity.entityType}.${entity.stage}`,
    sourceRuleId: entity.sourceRuleId,
    createdTick: 0,
    updatedTick: 0,
  };

  const lifecycle = lifecycleForVisualEntity(entity);

  if (entity.entityType === "tree" && lifecycle.type === "tree") {
    return {
      ...base,
      entityType: "tree",
      lifecycle,
    };
  }

  if (entity.entityType === "rock" && lifecycle.type === "rock") {
    return {
      ...base,
      entityType: "rock",
      lifecycle,
    };
  }

  if (entity.entityType === "grass_clump" && lifecycle.type === "grass_clump") {
    return {
      ...base,
      entityType: "grass_clump",
      lifecycle,
    };
  }

  if (entity.entityType === "flower" && lifecycle.type === "flower") {
    return {
      ...base,
      entityType: "flower",
      lifecycle,
    };
  }

  if (entity.entityType === "berry_bush" && lifecycle.type === "berry_bush") {
    return {
      ...base,
      entityType: "berry_bush",
      lifecycle,
    };
  }

  if (entity.entityType === "reed" && lifecycle.type === "reed") {
    return {
      ...base,
      entityType: "reed",
      lifecycle,
    };
  }

  throw new Error(`Unsupported visual entity lifecycle: ${entity.entityId}`);
}

function primaryBiomeFromMask(mask: BiomeType[][]): BiomeType {
  const counts = new Map<BiomeType, number>();

  for (const row of mask) {
    for (const biomeType of row) {
      counts.set(biomeType, (counts.get(biomeType) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "open_grassland";
}

export function buildPoc0ChunkStateFromVisualInput(
  input: ChunkVisualInput,
): ChunkState {
  const tiles = createTiles(input);
  const entities = input.entityMap.map((entity) =>
    createWorldEntity(entity, input.chunkId),
  );
  const projection = projectChunkCollision({ tiles, entities });

  const projectedTiles = tiles.map((row, y) =>
    row.map((tile, x) => ({
      ...tile,
      projectedBlocksMovement: projection.collisionLayer[y][x].blocksMovement,
      projectedBlocksVision: projection.collisionLayer[y][x].blocksVision,
    })),
  );

  return {
    chunkId: input.chunkId,
    worldId: "poc0-world",
    chunkX: input.chunkX,
    chunkY: input.chunkY,
    width: 32,
    height: 32,
    primaryBiomeType: primaryBiomeFromMask(input.biomeMask),
    tiles: projectedTiles,
    entities,
    collisionLayer: projection.collisionLayer,
    walkableLayer: projection.walkableLayer,
    interactionLayer: projection.interactionLayer,
    visualCache: {
      status: "missing",
    },
    runtimeState: {
      loadedState: "generated",
      isActive: false,
      lastActiveTick: 0,
      lastUpdatedTick: 0,
    },
  };
}
