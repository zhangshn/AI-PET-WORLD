import type { WorldEntity } from "../types/entity-types";
import type { BinaryMask } from "../types/terrain-types";
import type {
  ChunkVisualEntity,
  ChunkVisualInput,
  NeighborContext,
  StyleProfile,
  VisualConstraints,
} from "../types/visual-types";
import type { ChunkState } from "../types/world-types";

export interface BuildChunkVisualInputOptions {
  inputVersion: string;
  worldRuleVersion: string;
  generatorVersion: string;
  inputPayloadHash?: string;
  neighborContext?: NeighborContext;
  styleProfile: StyleProfile;
  visualConstraints: VisualConstraints;
}

function binaryMaskFromBooleanGrid(
  width: number,
  height: number,
  valueAt: (x: number, y: number) => boolean,
): BinaryMask {
  const mask: BinaryMask = [];

  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];

    for (let x = 0; x < width; x += 1) {
      row.push(valueAt(x, y) ? 1 : 0);
    }

    mask.push(row);
  }

  return mask;
}

function visualEntityFromWorldEntity(entity: WorldEntity): ChunkVisualEntity {
  const base = {
    entityId: entity.entityId,
    tileX: entity.tileX,
    tileY: entity.tileY,
    widthTiles: entity.widthTiles,
    heightTiles: entity.heightTiles,
    blocksMovement: entity.collision.blocksMovement,
    sourceRuleId: entity.sourceRuleId,
  };

  if (entity.entityType === "tree") {
    return {
      ...base,
      entityType: "tree",
      stage: entity.lifecycle.stage,
    };
  }

  if (entity.entityType === "rock") {
    return {
      ...base,
      entityType: "rock",
      stage: entity.lifecycle.stage,
    };
  }

  if (entity.entityType === "grass_clump") {
    return {
      ...base,
      entityType: "grass_clump",
      stage: entity.lifecycle.stage,
    };
  }

  if (entity.entityType === "flower") {
    return {
      ...base,
      entityType: "flower",
      stage: entity.lifecycle.stage,
    };
  }

  if (entity.entityType === "berry_bush") {
    return {
      ...base,
      entityType: "berry_bush",
      stage: entity.lifecycle.stage,
    };
  }

  return {
    ...base,
    entityType: "reed",
    stage: entity.lifecycle.stage,
  };
}

export function buildChunkVisualInputFromChunkState(
  chunkState: ChunkState,
  options: BuildChunkVisualInputOptions,
): ChunkVisualInput {
  const terrainMask = chunkState.tiles.map((row) =>
    row.map((tile) => tile.terrainType),
  );
  const biomeMask = chunkState.tiles.map((row) =>
    row.map((tile) => tile.biomeType),
  );

  const walkableMask = binaryMaskFromBooleanGrid(
    chunkState.width,
    chunkState.height,
    (x, y) => chunkState.walkableLayer[y][x].walkable,
  );
  const collisionMask = binaryMaskFromBooleanGrid(
    chunkState.width,
    chunkState.height,
    (x, y) => chunkState.collisionLayer[y][x].blocksMovement,
  );

  return {
    inputVersion: options.inputVersion,
    worldRuleVersion: options.worldRuleVersion,
    generatorVersion: options.generatorVersion,
    inputPayloadHash: options.inputPayloadHash ?? "",
    chunkId: chunkState.chunkId,
    chunkX: chunkState.chunkX,
    chunkY: chunkState.chunkY,
    tileWidth: chunkState.width,
    tileHeight: chunkState.height,
    tileSize: 16,
    pixelWidth: 512,
    pixelHeight: 512,
    terrainMask,
    biomeMask,
    walkableMask,
    collisionMask,
    entityMap: chunkState.entities.map(visualEntityFromWorldEntity),
    neighborContext: options.neighborContext ?? {},
    styleProfile: options.styleProfile,
    visualConstraints: options.visualConstraints,
  };
}
