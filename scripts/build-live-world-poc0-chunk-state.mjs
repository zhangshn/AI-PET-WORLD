import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "data/live-world/poc-inputs/poc-0-input.chunk.json");
const outputPath = path.join(root, "data/live-world/poc-inputs/poc-0-chunk-state.json");

const blockedTraversalCost = 999999;

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function movementClassForTerrain(terrainType) {
  if (terrainType === "water") return "blocked";
  if (terrainType === "wetland") return "slow";
  if (terrainType === "shoreline") return "edge_only";
  return "walkable";
}

function traversalCostForTerrain(terrainType) {
  if (terrainType === "water") return blockedTraversalCost;
  if (terrainType === "dirt_path") return 0.8;
  if (terrainType === "wetland") return 2;
  if (terrainType === "shoreline") return 1.2;
  return 1;
}

function overlaysForTerrain(terrainType) {
  if (terrainType === "shoreline") return ["shore_foam", "small_pebble"];
  if (terrainType === "wetland") return ["mud_patch"];
  if (terrainType === "grass" || terrainType === "tall_grass") return ["grass_detail"];
  return [];
}

function createTiles(input) {
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
        moisture: biomeType === "water_edge" || biomeType === "wetland_edge" ? 0.8 : 0.45,
        fertility: biomeType === "small_woods" || biomeType === "open_grassland" ? 0.7 : 0.5,
        baseBlocksMovement,
        baseBlocksVision: false,
        projectedBlocksMovement: baseBlocksMovement,
        projectedBlocksVision: false,
        overlays: overlaysForTerrain(terrainType),
      };
    }),
  );
}

function squareFootprint(width, height) {
  const footprint = [];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      footprint.push({ dx, dy });
    }
  }
  return footprint;
}

function interactionRing() {
  return [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
}

function collisionForEntity(entity) {
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

function interactionForEntity(entity) {
  if (entity.entityType === "tree") return { enabled: true, kinds: ["inspect", "chop"] };
  if (entity.entityType === "rock") return { enabled: true, kinds: ["inspect", "mine"] };
  return { enabled: true, kinds: ["inspect", "harvest"] };
}

function lifecycleForEntity(entity) {
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
    return { type: "grass_clump", stage: entity.stage, ageTicks: 120 };
  }

  if (entity.entityType === "flower") {
    return { type: "flower", stage: entity.stage, ageTicks: 180 };
  }

  if (entity.entityType === "berry_bush") {
    return { type: "berry_bush", stage: entity.stage, ageTicks: 400 };
  }

  return { type: "reed", stage: entity.stage, ageTicks: 200 };
}

function createWorldEntity(entity, chunkId) {
  return {
    entityId: entity.entityId,
    chunkId,
    entityType: entity.entityType,
    tileX: entity.tileX,
    tileY: entity.tileY,
    widthTiles: entity.widthTiles,
    heightTiles: entity.heightTiles,
    lifecycle: lifecycleForEntity(entity),
    collision: collisionForEntity(entity),
    interaction: interactionForEntity(entity),
    visualProfileId: `${entity.entityType}.${entity.stage}`,
    sourceRuleId: entity.sourceRuleId,
    createdTick: 0,
    updatedTick: 0,
  };
}

function isInsideGrid(tiles, x, y) {
  return y >= 0 && y < tiles.length && x >= 0 && x < tiles[y].length;
}

function createBaseCollisionLayer(tiles) {
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

function createBaseInteractionLayer(tiles) {
  return tiles.map((row, y) =>
    row.map((_, x) => ({
      x,
      y,
      interactableEntityIds: [],
    })),
  );
}

function projectChunkCollision(tiles, entities) {
  const collisionLayer = createBaseCollisionLayer(tiles);
  const interactionLayer = createBaseInteractionLayer(tiles);

  for (const entity of entities) {
    for (const cell of entity.collision.movementFootprint) {
      const x = entity.tileX + cell.dx;
      const y = entity.tileY + cell.dy;
      if (!isInsideGrid(tiles, x, y)) continue;
      if (entity.collision.blocksMovement) collisionLayer[y][x].blocksMovement = true;
      if (!collisionLayer[y][x].sourceEntityIds.includes(entity.entityId)) {
        collisionLayer[y][x].sourceEntityIds.push(entity.entityId);
      }
    }

    for (const cell of entity.collision.visionFootprint) {
      const x = entity.tileX + cell.dx;
      const y = entity.tileY + cell.dy;
      if (!isInsideGrid(tiles, x, y)) continue;
      if (entity.collision.blocksVision) collisionLayer[y][x].blocksVision = true;
      if (!collisionLayer[y][x].sourceEntityIds.includes(entity.entityId)) {
        collisionLayer[y][x].sourceEntityIds.push(entity.entityId);
      }
    }

    for (const cell of entity.collision.interactionFootprint) {
      const x = entity.tileX + cell.dx;
      const y = entity.tileY + cell.dy;
      if (!isInsideGrid(tiles, x, y)) continue;
      if (!interactionLayer[y][x].interactableEntityIds.includes(entity.entityId)) {
        interactionLayer[y][x].interactableEntityIds.push(entity.entityId);
      }
    }
  }

  const walkableLayer = tiles.map((row, y) =>
    row.map((tile, x) => ({
      x,
      y,
      walkable: !collisionLayer[y][x].blocksMovement,
      traversalCost: collisionLayer[y][x].blocksMovement
        ? blockedTraversalCost
        : tile.traversalCost,
    })),
  );

  return { collisionLayer, walkableLayer, interactionLayer };
}

function primaryBiomeFromMask(mask) {
  const counts = new Map();
  for (const row of mask) {
    for (const biomeType of row) {
      counts.set(biomeType, (counts.get(biomeType) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "open_grassland";
}

function buildChunkState(input) {
  const tiles = createTiles(input);
  const entities = input.entityMap.map((entity) => createWorldEntity(entity, input.chunkId));
  const projection = projectChunkCollision(tiles, entities);

  const projectedTiles = tiles.map((row, y) =>
    row.map((tile, x) => ({
      ...tile,
      projectedBlocksMovement: projection.collisionLayer[y][x].blocksMovement,
      projectedBlocksVision: projection.collisionLayer[y][x].blocksVision,
    })),
  );

  return {
    chunkStateVersion: "live-world-poc0-chunk-state-v1",
    sourceInputPayloadHash: input.inputPayloadHash,
    chunkStatePayloadHash: "",
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

const input = JSON.parse(await readFile(inputPath, "utf8"));
const chunkState = buildChunkState(input);
chunkState.chunkStatePayloadHash = hashJson({
  ...chunkState,
  chunkStatePayloadHash: "",
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(chunkState, null, 2)}\n`, "utf8");

console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(`ChunkState hash ${chunkState.chunkStatePayloadHash}`);
