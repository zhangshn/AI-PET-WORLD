import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "data/live-world/poc-inputs/poc-0-input.chunk.json");
const chunkStatePath = path.join(root, "data/live-world/poc-inputs/poc-0-chunk-state.json");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertGrid(grid, width, height, label) {
  assert(Array.isArray(grid), `${label} must be an array`);
  assert(grid.length === height, `${label} height must be ${height}`);

  for (const [y, row] of grid.entries()) {
    assert(Array.isArray(row), `${label}[${y}] must be an array`);
    assert(row.length === width, `${label}[${y}] width must be ${width}`);
  }
}

function flatten(grid) {
  return grid.flatMap((row) => row);
}

const input = JSON.parse(await readFile(inputPath, "utf8"));
const chunkState = JSON.parse(await readFile(chunkStatePath, "utf8"));

assert(chunkState.chunkStateVersion === "live-world-poc0-chunk-state-v1", "invalid chunk state version");
assert(chunkState.sourceInputPayloadHash === input.inputPayloadHash, "source input hash mismatch");
assert(typeof chunkState.chunkStatePayloadHash === "string" && chunkState.chunkStatePayloadHash.length === 64, "missing chunk state hash");
assert(chunkState.chunkId === input.chunkId, "chunkId mismatch");
assert(chunkState.worldId === "poc0-world", "worldId mismatch");
assert(chunkState.width === 32 && chunkState.height === 32, "chunk dimensions must be 32x32");
assert(chunkState.primaryBiomeType === "open_grassland", "unexpected primary biome");

assertGrid(chunkState.tiles, 32, 32, "tiles");
assertGrid(chunkState.collisionLayer, 32, 32, "collisionLayer");
assertGrid(chunkState.walkableLayer, 32, 32, "walkableLayer");
assertGrid(chunkState.interactionLayer, 32, 32, "interactionLayer");

assert(Array.isArray(chunkState.entities), "entities must be an array");
assert(chunkState.entities.length === input.entityMap.length, "entity count mismatch");

const entitiesById = new Map(chunkState.entities.map((entity) => [entity.entityId, entity]));

for (const visualEntity of input.entityMap) {
  const entity = entitiesById.get(visualEntity.entityId);
  assert(entity, `missing entity ${visualEntity.entityId}`);
  assert(entity.entityType === visualEntity.entityType, `entity type mismatch for ${visualEntity.entityId}`);
  assert(entity.lifecycle.type === visualEntity.entityType, `lifecycle type mismatch for ${visualEntity.entityId}`);
  assert(entity.tileX === visualEntity.tileX && entity.tileY === visualEntity.tileY, `entity position mismatch for ${visualEntity.entityId}`);
  assert(entity.visualProfileId === `${visualEntity.entityType}.${visualEntity.stage}`, `visual profile mismatch for ${visualEntity.entityId}`);
}

for (const tile of flatten(chunkState.tiles)) {
  assert(Number.isFinite(tile.traversalCost), `tile ${tile.x},${tile.y} traversalCost must be finite`);

  const collisionCell = chunkState.collisionLayer[tile.y][tile.x];
  const walkableCell = chunkState.walkableLayer[tile.y][tile.x];

  if (tile.terrainType === "water") {
    assert(tile.baseBlocksMovement === true, `water tile ${tile.x},${tile.y} must block movement`);
    assert(collisionCell.blocksMovement === true, `water collision ${tile.x},${tile.y} must block movement`);
    assert(walkableCell.walkable === false, `water walkable ${tile.x},${tile.y} must be false`);
  }

  assert(tile.projectedBlocksMovement === collisionCell.blocksMovement, `projected movement mismatch at ${tile.x},${tile.y}`);
  assert(tile.projectedBlocksVision === collisionCell.blocksVision, `projected vision mismatch at ${tile.x},${tile.y}`);
}

for (const entity of chunkState.entities) {
  if (entity.collision.blocksMovement) {
    const originCell = chunkState.collisionLayer[entity.tileY][entity.tileX];
    assert(originCell.blocksMovement === true, `blocking entity ${entity.entityId} did not project movement collision`);
    assert(originCell.sourceEntityIds.includes(entity.entityId), `blocking entity ${entity.entityId} missing from sourceEntityIds`);
  }

  const isInteractable = flatten(chunkState.interactionLayer).some((cell) =>
    cell.interactableEntityIds.includes(entity.entityId),
  );
  assert(isInteractable, `entity ${entity.entityId} missing from interaction layer`);
}

assert(chunkState.visualCache.status === "missing", "visual cache should be missing before AI Painter generation");
assert(chunkState.runtimeState.loadedState === "generated", "runtime state should be generated");
assert(chunkState.runtimeState.isActive === false, "POC chunk should not be active yet");

console.log("POC-0 ChunkState check passed");
console.log(`entities: ${chunkState.entities.length}`);
console.log(`blocked cells: ${flatten(chunkState.collisionLayer).filter((cell) => cell.blocksMovement).length}`);
console.log(`interaction cells: ${flatten(chunkState.interactionLayer).filter((cell) => cell.interactableEntityIds.length > 0).length}`);
