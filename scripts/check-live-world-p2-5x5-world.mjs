import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const worldPath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function assertGrid(grid, width, height, label) {
  assert(Array.isArray(grid), `${label} must be an array`);
  assert(grid.length === height, `${label} height must be ${height}`);
  for (const [y, row] of grid.entries()) {
    assert(Array.isArray(row), `${label}[${y}] must be an array`);
    assert(row.length === width, `${label}[${y}] width must be ${width}`);
  }
}

function withoutHash(worldState) {
  const { worldStatePayloadHash, ...rest } = worldState;
  return rest;
}

function terrainAtEdge(chunk, x, y) {
  return chunk.tiles[y][x].terrainType;
}

function biomeAtEdge(chunk, x, y) {
  return chunk.tiles[y][x].biomeType;
}

function isWaterCompatible(a, b) {
  const waterCompatible = new Set(["water", "shoreline", "wetland"]);
  if (a === "water") return waterCompatible.has(b);
  if (b === "water") return waterCompatible.has(a);
  return true;
}

const worldState = JSON.parse(await readFile(worldPath, "utf8"));
const calculatedHash = hashJson(withoutHash(worldState));
assert(worldState.worldStatePayloadHash === calculatedHash, "worldStatePayloadHash mismatch");
assert(worldState.worldId === "p2-fixed-seed-5x5-world", "worldId mismatch");
assert(worldState.seed === "live-world-p2-fixed-seed-5x5-v1", "seed mismatch");
assert(worldState.chunkSize === 32, "chunkSize must be 32");
assert(worldState.tileSize === 16, "tileSize must be 16");
assert(worldState.chunkRadius === 2, "chunkRadius must be 2");
assert(worldState.activeChunkRadius === 1, "activeChunkRadius must be 1");
assert(Array.isArray(worldState.chunks), "chunks must be an array");
assert(worldState.chunks.length === 25, "5x5 world must contain 25 chunks");
assert(worldState.playerState?.currentChunkId === "p2-fixed-seed-5x5-world-chunk-0-0", "player must start in center chunk");

const chunksByKey = new Map();
let totalEntities = 0;
let totalWaterTiles = 0;
let totalBlockedTiles = 0;
let totalInteractionCells = 0;
const biomeCounts = new Map();

for (const chunk of worldState.chunks) {
  assert(chunk.chunkX >= -2 && chunk.chunkX <= 2, `chunkX out of range: ${chunk.chunkId}`);
  assert(chunk.chunkY >= -2 && chunk.chunkY <= 2, `chunkY out of range: ${chunk.chunkId}`);
  assert(!chunksByKey.has(chunkKey(chunk.chunkX, chunk.chunkY)), `duplicate chunk coordinate: ${chunk.chunkId}`);
  chunksByKey.set(chunkKey(chunk.chunkX, chunk.chunkY), chunk);
  assert(chunk.width === 32 && chunk.height === 32, `invalid chunk size: ${chunk.chunkId}`);
  assertGrid(chunk.tiles, 32, 32, `${chunk.chunkId}.tiles`);
  assertGrid(chunk.collisionLayer, 32, 32, `${chunk.chunkId}.collisionLayer`);
  assertGrid(chunk.walkableLayer, 32, 32, `${chunk.chunkId}.walkableLayer`);
  assertGrid(chunk.interactionLayer, 32, 32, `${chunk.chunkId}.interactionLayer`);
  assert(chunk.visualCache.status === "missing", `visualCache must be missing: ${chunk.chunkId}`);
  assert(chunk.runtimeState.loadedState === "generated", `chunk must be generated: ${chunk.chunkId}`);

  totalEntities += chunk.entities.length;

  for (const row of chunk.tiles) {
    for (const tile of row) {
      assert(Number.isFinite(tile.traversalCost), `tile traversalCost must be finite: ${chunk.chunkId} ${tile.x},${tile.y}`);
      assert(tile.traversalCost !== null, `tile traversalCost must not be null: ${chunk.chunkId} ${tile.x},${tile.y}`);
      biomeCounts.set(tile.biomeType, (biomeCounts.get(tile.biomeType) ?? 0) + 1);
      const collisionCell = chunk.collisionLayer[tile.y][tile.x];
      const walkableCell = chunk.walkableLayer[tile.y][tile.x];
      assert(tile.projectedBlocksMovement === collisionCell.blocksMovement, `projected movement mismatch: ${chunk.chunkId} ${tile.x},${tile.y}`);
      assert(tile.projectedBlocksVision === collisionCell.blocksVision, `projected vision mismatch: ${chunk.chunkId} ${tile.x},${tile.y}`);
      if (tile.terrainType === "water") {
        totalWaterTiles += 1;
        assert(collisionCell.blocksMovement === true, `water must block movement: ${chunk.chunkId} ${tile.x},${tile.y}`);
        assert(walkableCell.walkable === false, `water must not be walkable: ${chunk.chunkId} ${tile.x},${tile.y}`);
      }
      if (collisionCell.blocksMovement) totalBlockedTiles += 1;
    }
  }

  for (const row of chunk.interactionLayer) {
    for (const cell of row) {
      if (cell.interactableEntityIds.length > 0) totalInteractionCells += 1;
    }
  }

  for (const entity of chunk.entities) {
    assert(entity.chunkId === chunk.chunkId, `entity chunkId mismatch: ${entity.entityId}`);
    assert(entity.tileX >= 0 && entity.tileX < 32, `entity tileX out of range: ${entity.entityId}`);
    assert(entity.tileY >= 0 && entity.tileY < 32, `entity tileY out of range: ${entity.entityId}`);
    assert(entity.lifecycle.type === entity.entityType, `entity lifecycle mismatch: ${entity.entityId}`);
    if (entity.collision.blocksMovement) {
      const originCell = chunk.collisionLayer[entity.tileY][entity.tileX];
      assert(originCell.blocksMovement === true, `blocking entity did not project collision: ${entity.entityId}`);
      assert(originCell.sourceEntityIds.includes(entity.entityId), `blocking entity missing sourceEntityIds: ${entity.entityId}`);
    }
  }
}

for (let chunkY = -2; chunkY <= 2; chunkY += 1) {
  for (let chunkX = -2; chunkX <= 2; chunkX += 1) {
    assert(chunksByKey.has(chunkKey(chunkX, chunkY)), `missing chunk ${chunkX},${chunkY}`);
  }
}

for (let chunkY = -2; chunkY <= 2; chunkY += 1) {
  for (let chunkX = -2; chunkX < 2; chunkX += 1) {
    const left = chunksByKey.get(chunkKey(chunkX, chunkY));
    const right = chunksByKey.get(chunkKey(chunkX + 1, chunkY));
    for (let y = 0; y < 32; y += 1) {
      assert(typeof terrainAtEdge(left, 31, y) === "string", "left edge terrain missing");
      assert(typeof terrainAtEdge(right, 0, y) === "string", "right edge terrain missing");
      assert(typeof biomeAtEdge(left, 31, y) === "string", "left edge biome missing");
      assert(typeof biomeAtEdge(right, 0, y) === "string", "right edge biome missing");
      assert(
        isWaterCompatible(terrainAtEdge(left, 31, y), terrainAtEdge(right, 0, y)),
        `water seam mismatch between ${left.chunkId} and ${right.chunkId} at y=${y}`,
      );
    }
  }
}

for (let chunkX = -2; chunkX <= 2; chunkX += 1) {
  for (let chunkY = -2; chunkY < 2; chunkY += 1) {
    const north = chunksByKey.get(chunkKey(chunkX, chunkY));
    const south = chunksByKey.get(chunkKey(chunkX, chunkY + 1));
    for (let x = 0; x < 32; x += 1) {
      assert(typeof terrainAtEdge(north, x, 31) === "string", "north edge terrain missing");
      assert(typeof terrainAtEdge(south, x, 0) === "string", "south edge terrain missing");
      assert(typeof biomeAtEdge(north, x, 31) === "string", "north edge biome missing");
      assert(typeof biomeAtEdge(south, x, 0) === "string", "south edge biome missing");
      assert(
        isWaterCompatible(terrainAtEdge(north, x, 31), terrainAtEdge(south, x, 0)),
        `water seam mismatch between ${north.chunkId} and ${south.chunkId} at x=${x}`,
      );
    }
  }
}

assert(totalEntities >= 180, "5x5 world should contain at least 180 entities");
assert(totalWaterTiles >= 1000, "5x5 world should contain a meaningful water region");
assert(totalBlockedTiles > totalWaterTiles, "blocked tiles should include water plus blocking entities");
assert(totalInteractionCells >= totalEntities, "interaction cells should cover all entities");
for (const biomeType of [
  "open_grassland",
  "water_edge",
  "small_woods",
  "stone_patch",
  "wetland_edge",
  "home_entrance",
]) {
  assert((biomeCounts.get(biomeType) ?? 0) > 0, `missing biome coverage: ${biomeType}`);
}

console.log("P2 fixed seed 5x5 world check passed");
console.log(`chunks=${worldState.chunks.length}`);
console.log(`entities=${totalEntities}`);
console.log(`waterTiles=${totalWaterTiles}`);
console.log(`blockedTiles=${totalBlockedTiles}`);
console.log(`interactionCells=${totalInteractionCells}`);
console.log(`biomes=${[...biomeCounts.entries()].map(([key, value]) => `${key}:${value}`).join(",")}`);
console.log(`worldStatePayloadHash=${worldState.worldStatePayloadHash}`);
