import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const worldId = "p2-fixed-seed-5x5-world";
const seed = "live-world-p2-fixed-seed-5x5-v1";
const outputDir = path.join(root, "data/live-world/world-states");
const outputPath = path.join(outputDir, "p2-fixed-seed-5x5-world.json");
const chunkSize = 32;
const tileSize = 16;
const chunkRadius = 2;
const blockedTraversalCost = 999999;

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function deterministicNoise(x, y, salt = 0) {
  const value = Math.sin((x + 17) * 12.9898 + (y + 31) * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function globalTileX(chunkX, x) {
  return (chunkX + chunkRadius) * chunkSize + x;
}

function globalTileY(chunkY, y) {
  return (chunkY + chunkRadius) * chunkSize + y;
}

function riverBoundary(globalY) {
  return 128 + Math.round(Math.sin(globalY / 17) * 4);
}

function pathCenterX(globalY) {
  return 16 + Math.round(globalY * 0.55 + Math.sin(globalY / 11) * 5);
}

function isHomeArea(globalX, globalY) {
  return globalX >= 68 && globalX <= 92 && globalY >= 68 && globalY <= 92;
}

function terrainAt(globalX, globalY) {
  const riverX = riverBoundary(globalY);
  const pathX = pathCenterX(globalY);

  if (globalX >= riverX + 2) return "water";
  if (globalX >= riverX - 1) return "shoreline";
  if (globalY >= 104 && globalY <= 142 && globalX >= riverX - 10 && globalX < riverX - 1) {
    return "wetland";
  }
  if (Math.abs(globalX - pathX) <= 1) return "dirt_path";
  if (isHomeArea(globalX, globalY)) return "home_ground";

  const noise = deterministicNoise(globalX, globalY, 1);
  if (globalX < 54 && globalY < 58 && noise > 0.68) return "forest_edge";
  if (globalX < 54 && globalY > 92 && noise > 0.76) return "stone_ground";
  if (noise > 0.91) return "tall_grass";

  return "grass";
}

function biomeAt(globalX, globalY, terrainType) {
  if (isHomeArea(globalX, globalY)) return "home_entrance";
  if (terrainType === "water" || terrainType === "shoreline") return "water_edge";
  if (terrainType === "wetland") return "wetland_edge";
  if (terrainType === "stone_ground" || (globalX < 58 && globalY > 96)) return "stone_patch";
  if (globalX < 64 && globalY < 72) return "small_woods";
  return "open_grassland";
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
  if (terrainType === "forest_edge") return ["fallen_leaf", "grass_detail"];
  if (terrainType === "stone_ground") return ["small_pebble"];
  return [];
}

function createTiles(chunkX, chunkY) {
  const tiles = [];

  for (let y = 0; y < chunkSize; y += 1) {
    const row = [];

    for (let x = 0; x < chunkSize; x += 1) {
      const gx = globalTileX(chunkX, x);
      const gy = globalTileY(chunkY, y);
      const terrainType = terrainAt(gx, gy);
      const biomeType = biomeAt(gx, gy, terrainType);
      const movementClass = movementClassForTerrain(terrainType);
      const baseBlocksMovement = movementClass === "blocked";

      row.push({
        x,
        y,
        terrainType,
        biomeType,
        movementClass,
        traversalCost: traversalCostForTerrain(terrainType),
        elevation: Math.round(deterministicNoise(gx, gy, 2) * 3) / 10,
        moisture: biomeType === "water_edge" || biomeType === "wetland_edge" ? 0.85 : 0.45,
        fertility: biomeType === "small_woods" || biomeType === "open_grassland" ? 0.7 : 0.5,
        baseBlocksMovement,
        baseBlocksVision: false,
        projectedBlocksMovement: baseBlocksMovement,
        projectedBlocksVision: false,
        overlays: overlaysForTerrain(terrainType),
      });
    }

    tiles.push(row);
  }

  return tiles;
}

function squareFootprint(width, height) {
  const footprint = [];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) footprint.push({ dx, dy });
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

function collisionForEntity(entityType, stage, widthTiles, heightTiles) {
  const visualSize = { width: widthTiles, height: heightTiles };
  if (entityType === "tree") {
    return {
      blocksMovement: true,
      blocksVision: true,
      visualSize,
      movementFootprint: [{ dx: 0, dy: 0 }],
      visionFootprint: squareFootprint(widthTiles, heightTiles),
      interactionFootprint: interactionRing(),
      collisionProfileId: stage === "stump" ? "tree_stump_1x1" : "tree_trunk_1x1",
    };
  }
  if (entityType === "rock") {
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

function interactionForEntity(entityType) {
  if (entityType === "tree") return { enabled: true, kinds: ["inspect", "chop"] };
  if (entityType === "rock") return { enabled: true, kinds: ["inspect", "mine"] };
  return { enabled: true, kinds: ["inspect", "harvest"] };
}

function lifecycleForEntity(entityType, stage) {
  if (entityType === "tree") return { type: "tree", stage, ageTicks: stage === "young" ? 250 : 1000 };
  if (entityType === "rock") return { type: "rock", stage, durability: stage === "small" ? 1 : 2 };
  if (entityType === "grass_clump") return { type: "grass_clump", stage, ageTicks: 120 };
  if (entityType === "flower") return { type: "flower", stage, ageTicks: 180 };
  if (entityType === "berry_bush") return { type: "berry_bush", stage, ageTicks: 400 };
  return { type: "reed", stage, ageTicks: 200 };
}

function canPlace(tile, entityType) {
  if (!tile) return false;
  if (tile.terrainType === "water" || tile.terrainType === "dirt_path" || tile.terrainType === "home_ground") return false;
  if (entityType === "reed") return tile.terrainType === "shoreline" || tile.terrainType === "wetland";
  if (entityType === "rock") return tile.terrainType === "grass" || tile.terrainType === "stone_ground" || tile.terrainType === "forest_edge";
  if (entityType === "tree") return tile.terrainType === "grass" || tile.terrainType === "tall_grass" || tile.terrainType === "forest_edge";
  if (entityType === "berry_bush") return tile.biomeType === "small_woods" && tile.terrainType !== "forest_edge";
  return tile.terrainType === "grass" || tile.terrainType === "tall_grass" || tile.terrainType === "shoreline";
}

function candidatesFor(chunkX, chunkY, tiles, entityType) {
  const candidates = [];
  for (let y = 2; y < chunkSize - 2; y += 1) {
    for (let x = 2; x < chunkSize - 2; x += 1) {
      if (!canPlace(tiles[y][x], entityType)) continue;
      const gx = globalTileX(chunkX, x);
      const gy = globalTileY(chunkY, y);
      candidates.push({ x, y, score: deterministicNoise(gx, gy, entityType.length) });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function chooseEntityCounts(primaryBiomeType, chunkX, chunkY) {
  const isCenter = chunkX === 0 && chunkY === 0;
  if (primaryBiomeType === "water_edge") {
    return { tree: 1, rock: 1, grass_clump: 3, flower: 2, berry_bush: 0, reed: 5 };
  }
  if (primaryBiomeType === "wetland_edge") {
    return { tree: 1, rock: 1, grass_clump: 4, flower: 2, berry_bush: 0, reed: 6 };
  }
  if (primaryBiomeType === "small_woods") {
    return { tree: 5, rock: 1, grass_clump: 4, flower: 2, berry_bush: 2, reed: 0 };
  }
  if (primaryBiomeType === "stone_patch") {
    return { tree: 2, rock: 4, grass_clump: 3, flower: 1, berry_bush: 0, reed: 0 };
  }
  if (isCenter || primaryBiomeType === "home_entrance") {
    return { tree: 2, rock: 1, grass_clump: 5, flower: 4, berry_bush: 1, reed: 0 };
  }
  return { tree: 3, rock: 2, grass_clump: 6, flower: 4, berry_bush: 0, reed: 1 };
}

function primaryBiomeFromTiles(tiles) {
  const counts = new Map();
  for (const row of tiles) {
    for (const tile of row) counts.set(tile.biomeType, (counts.get(tile.biomeType) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "open_grassland";
}

function placeEntities(chunkX, chunkY, chunkId, tiles, primaryBiomeType) {
  const counts = chooseEntityCounts(primaryBiomeType, chunkX, chunkY);
  const entities = [];
  const occupied = new Set();

  function addEntity(entityType, stage, x, y, widthTiles, heightTiles, sourceRuleId) {
    const key = `${x},${y}`;
    if (occupied.has(key)) return false;
    occupied.add(key);
    const index = String(entities.length + 1).padStart(2, "0");
    entities.push({
      entityId: `${chunkId}-${entityType}-${index}`,
      chunkId,
      entityType,
      tileX: x,
      tileY: y,
      widthTiles,
      heightTiles,
      lifecycle: lifecycleForEntity(entityType, stage),
      collision: collisionForEntity(entityType, stage, widthTiles, heightTiles),
      interaction: interactionForEntity(entityType),
      visualProfileId: `${entityType}.${stage}`,
      sourceRuleId,
      createdTick: 0,
      updatedTick: 0,
    });
    return true;
  }

  for (const [entityType, count] of Object.entries(counts)) {
    const candidates = candidatesFor(chunkX, chunkY, tiles, entityType);
    let placed = 0;
    for (const candidate of candidates) {
      if (placed >= count) break;
      const stage =
        entityType === "tree"
          ? candidate.score > 0.72 ? "mature" : "young"
          : entityType === "rock"
            ? candidate.score > 0.6 ? "medium" : "small"
            : entityType === "flower"
              ? "blooming"
              : entityType === "berry_bush"
                ? "fruiting"
                : "mature";
      const widthTiles = entityType === "tree" && stage === "mature" ? 3 : entityType === "tree" ? 2 : 1;
      const heightTiles = entityType === "tree" && stage === "mature" ? 3 : entityType === "reed" ? 2 : entityType === "tree" ? 2 : 1;
      if (addEntity(entityType, stage, candidate.x, candidate.y, widthTiles, heightTiles, `p2.${entityType}.${primaryBiomeType}`)) {
        placed += 1;
      }
    }
  }

  return entities;
}

function isInsideGrid(tiles, x, y) {
  return y >= 0 && y < tiles.length && x >= 0 && x < tiles[y].length;
}

function projectCollision(tiles, entities) {
  const collisionLayer = tiles.map((row, y) =>
    row.map((tile, x) => ({
      x,
      y,
      blocksMovement: tile.baseBlocksMovement,
      blocksVision: tile.baseBlocksVision,
      sourceEntityIds: [],
    })),
  );
  const interactionLayer = tiles.map((row, y) =>
    row.map((_, x) => ({
      x,
      y,
      interactableEntityIds: [],
    })),
  );

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
      traversalCost: collisionLayer[y][x].blocksMovement ? blockedTraversalCost : tile.traversalCost,
    })),
  );

  const projectedTiles = tiles.map((row, y) =>
    row.map((tile, x) => ({
      ...tile,
      projectedBlocksMovement: collisionLayer[y][x].blocksMovement,
      projectedBlocksVision: collisionLayer[y][x].blocksVision,
    })),
  );

  return { projectedTiles, collisionLayer, walkableLayer, interactionLayer };
}

function createChunk(chunkX, chunkY) {
  const chunkId = `${worldId}-chunk-${chunkX}-${chunkY}`;
  const tiles = createTiles(chunkX, chunkY);
  const primaryBiomeType = primaryBiomeFromTiles(tiles);
  const entities = placeEntities(chunkX, chunkY, chunkId, tiles, primaryBiomeType);
  const projection = projectCollision(tiles, entities);

  return {
    chunkId,
    worldId,
    chunkX,
    chunkY,
    width: 32,
    height: 32,
    primaryBiomeType,
    tiles: projection.projectedTiles,
    entities,
    collisionLayer: projection.collisionLayer,
    walkableLayer: projection.walkableLayer,
    interactionLayer: projection.interactionLayer,
    visualCache: { status: "missing" },
    runtimeState: {
      loadedState: "generated",
      isActive: false,
      lastActiveTick: 0,
      lastUpdatedTick: 0,
    },
  };
}

const chunks = [];
for (let chunkY = -chunkRadius; chunkY <= chunkRadius; chunkY += 1) {
  for (let chunkX = -chunkRadius; chunkX <= chunkRadius; chunkX += 1) {
    chunks.push(createChunk(chunkX, chunkY));
  }
}

const worldState = {
  worldId,
  worldVersion: "live-world-p2-fixed-seed-5x5-world-v1",
  worldRuleVersion: "live-world-rule-v1.2",
  generatorVersion: "fixed-seed-5x5-generator-v1",
  seed,
  chunkSize: 32,
  tileSize: 16,
  chunkRadius: 2,
  activeChunkRadius: 1,
  timeState: {
    currentTick: 0,
    dayIndex: 1,
    timeOfDay: "day",
    season: "spring",
  },
  chunks,
  playerState: {
    playerId: "p2-player-001",
    worldTileX: 80,
    worldTileY: 80,
    currentChunkId: `${worldId}-chunk-0-0`,
  },
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const worldStatePayloadHash = hashJson(worldState);
const output = {
  worldStatePayloadHash,
  ...worldState,
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entities.length, 0);
console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(`worldStatePayloadHash=${worldStatePayloadHash}`);
console.log(`chunks=${chunks.length}`);
console.log(`entities=${totalEntities}`);
