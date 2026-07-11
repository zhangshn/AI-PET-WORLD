import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceInputPath = path.join(root, "data/live-world/poc-inputs/poc-0-input.chunk.json");
const chunkStatePath = path.join(root, "data/live-world/poc-inputs/poc-0-chunk-state.json");
const visualInputPath = path.join(root, "data/live-world/poc-inputs/poc-0-visual-input.from-chunk-state.json");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function hashVisualInput(input) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize({ ...input, inputPayloadHash: "" })))
    .digest("hex");
}

function assertGrid(grid, width, height, label) {
  assert(Array.isArray(grid), `${label} must be an array`);
  assert(grid.length === height, `${label} height must be ${height}`);
  for (const [y, row] of grid.entries()) {
    assert(Array.isArray(row), `${label}[${y}] must be an array`);
    assert(row.length === width, `${label}[${y}] width must be ${width}`);
  }
}

const sourceInput = JSON.parse(await readFile(sourceInputPath, "utf8"));
const chunkState = JSON.parse(await readFile(chunkStatePath, "utf8"));
const visualInput = JSON.parse(await readFile(visualInputPath, "utf8"));

assert(visualInput.inputVersion === "live-world-poc0-visual-input-from-chunk-state-v1", "invalid visual input version");
assert(visualInput.worldRuleVersion === sourceInput.worldRuleVersion, "world rule version mismatch");
assert(visualInput.generatorVersion === "chunk-state-to-visual-input-v1", "generator version mismatch");
assert(visualInput.sourceChunkStatePayloadHash === chunkState.chunkStatePayloadHash, "source chunk state hash mismatch");
assert(visualInput.inputPayloadHash === hashVisualInput(visualInput), "visual input hash is not stable");
assert(visualInput.chunkId === chunkState.chunkId, "chunkId mismatch");
assert(visualInput.tileWidth === 32 && visualInput.tileHeight === 32, "visual input dimensions must be 32x32");
assert(visualInput.pixelWidth === 512 && visualInput.pixelHeight === 512, "visual input pixels must be 512x512");

assertGrid(visualInput.terrainMask, 32, 32, "terrainMask");
assertGrid(visualInput.biomeMask, 32, 32, "biomeMask");
assertGrid(visualInput.walkableMask, 32, 32, "walkableMask");
assertGrid(visualInput.collisionMask, 32, 32, "collisionMask");

for (let y = 0; y < 32; y += 1) {
  for (let x = 0; x < 32; x += 1) {
    assert(visualInput.terrainMask[y][x] === chunkState.tiles[y][x].terrainType, `terrain mismatch at ${x},${y}`);
    assert(visualInput.biomeMask[y][x] === chunkState.tiles[y][x].biomeType, `biome mismatch at ${x},${y}`);
    assert(visualInput.walkableMask[y][x] === (chunkState.walkableLayer[y][x].walkable ? 1 : 0), `walkable mismatch at ${x},${y}`);
    assert(visualInput.collisionMask[y][x] === (chunkState.collisionLayer[y][x].blocksMovement ? 1 : 0), `collision mismatch at ${x},${y}`);
  }
}

assert(Array.isArray(visualInput.entityMap), "entityMap must be an array");
assert(visualInput.entityMap.length === chunkState.entities.length, "entity count mismatch");

const visualEntitiesById = new Map(visualInput.entityMap.map((entity) => [entity.entityId, entity]));

for (const entity of chunkState.entities) {
  const visualEntity = visualEntitiesById.get(entity.entityId);
  assert(visualEntity, `missing visual entity ${entity.entityId}`);
  assert(visualEntity.entityType === entity.entityType, `entity type mismatch for ${entity.entityId}`);
  assert(visualEntity.stage === entity.lifecycle.stage, `stage mismatch for ${entity.entityId}`);
  assert(visualEntity.tileX === entity.tileX && visualEntity.tileY === entity.tileY, `position mismatch for ${entity.entityId}`);
  assert(visualEntity.blocksMovement === entity.collision.blocksMovement, `movement flag mismatch for ${entity.entityId}`);
}

assert(visualInput.visualConstraints.forbidUnlistedInteractiveResources === true, "visual constraints must forbid unlisted interactive resources");
assert(visualInput.styleProfile.styleProfileId === sourceInput.styleProfile.styleProfileId, "style profile mismatch");

console.log("POC-0 visual input check passed");
console.log(`inputPayloadHash=${visualInput.inputPayloadHash}`);
console.log(`entities=${visualInput.entityMap.length}`);
