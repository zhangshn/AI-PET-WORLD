import type {
  CollisionCell,
  CollisionProjectionResult,
  InteractionCell,
  WalkableCell,
} from "../types/collision-types";
import type { WorldEntity } from "../types/entity-types";
import type { TileState } from "../types/terrain-types";

export interface ProjectChunkCollisionInput {
  tiles: TileState[][];
  entities: WorldEntity[];
}

const BLOCKED_TRAVERSAL_COST = 999999;

function isInsideGrid(tiles: TileState[][], x: number, y: number): boolean {
  return y >= 0 && y < tiles.length && x >= 0 && x < (tiles[y]?.length ?? 0);
}

function createBaseCollisionLayer(tiles: TileState[][]): CollisionCell[][] {
  return tiles.map((row, y) =>
    row.map((tile, x) => ({
      x,
      y,
      blocksMovement: tile.baseBlocksMovement,
      blocksVision: tile.baseBlocksVision,
      sourceEntityIds: [],
    })),
  );
}

function createBaseInteractionLayer(tiles: TileState[][]): InteractionCell[][] {
  return tiles.map((row, y) =>
    row.map((_, x) => ({
      x,
      y,
      interactableEntityIds: [],
    })),
  );
}

function createWalkableLayer(
  tiles: TileState[][],
  collisionLayer: CollisionCell[][],
): WalkableCell[][] {
  return tiles.map((row, y) =>
    row.map((tile, x) => ({
      x,
      y,
      walkable: !collisionLayer[y][x].blocksMovement,
      traversalCost: collisionLayer[y][x].blocksMovement
        ? BLOCKED_TRAVERSAL_COST
        : tile.traversalCost,
    })),
  );
}

export function projectChunkCollision(
  input: ProjectChunkCollisionInput,
): CollisionProjectionResult {
  const collisionLayer = createBaseCollisionLayer(input.tiles);
  const interactionLayer = createBaseInteractionLayer(input.tiles);

  for (const entity of input.entities) {
    for (const cell of entity.collision.movementFootprint) {
      const x = entity.tileX + cell.dx;
      const y = entity.tileY + cell.dy;

      if (!isInsideGrid(input.tiles, x, y)) {
        continue;
      }

      if (entity.collision.blocksMovement) {
        collisionLayer[y][x].blocksMovement = true;
      }

      if (!collisionLayer[y][x].sourceEntityIds.includes(entity.entityId)) {
        collisionLayer[y][x].sourceEntityIds.push(entity.entityId);
      }
    }

    for (const cell of entity.collision.visionFootprint) {
      const x = entity.tileX + cell.dx;
      const y = entity.tileY + cell.dy;

      if (!isInsideGrid(input.tiles, x, y)) {
        continue;
      }

      if (entity.collision.blocksVision) {
        collisionLayer[y][x].blocksVision = true;
      }

      if (!collisionLayer[y][x].sourceEntityIds.includes(entity.entityId)) {
        collisionLayer[y][x].sourceEntityIds.push(entity.entityId);
      }
    }

    for (const cell of entity.collision.interactionFootprint) {
      const x = entity.tileX + cell.dx;
      const y = entity.tileY + cell.dy;

      if (!isInsideGrid(input.tiles, x, y)) {
        continue;
      }

      if (!interactionLayer[y][x].interactableEntityIds.includes(entity.entityId)) {
        interactionLayer[y][x].interactableEntityIds.push(entity.entityId);
      }
    }
  }

  const walkableLayer = createWalkableLayer(input.tiles, collisionLayer);

  return {
    collisionLayer,
    walkableLayer,
    interactionLayer,
  };
}
