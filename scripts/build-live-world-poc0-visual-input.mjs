import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceInputPath = path.join(root, "data/live-world/poc-inputs/poc-0-input.chunk.json");
const chunkStatePath = path.join(root, "data/live-world/poc-inputs/poc-0-chunk-state.json");
const outputPath = path.join(root, "data/live-world/poc-inputs/poc-0-visual-input.from-chunk-state.json");

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

function visualEntityFromWorldEntity(entity) {
  return {
    entityId: entity.entityId,
    entityType: entity.entityType,
    stage: entity.lifecycle.stage,
    tileX: entity.tileX,
    tileY: entity.tileY,
    widthTiles: entity.widthTiles,
    heightTiles: entity.heightTiles,
    blocksMovement: entity.collision.blocksMovement,
    sourceRuleId: entity.sourceRuleId,
  };
}

function buildVisualInput(chunkState, sourceInput) {
  const terrainMask = chunkState.tiles.map((row) => row.map((tile) => tile.terrainType));
  const biomeMask = chunkState.tiles.map((row) => row.map((tile) => tile.biomeType));
  const walkableMask = chunkState.walkableLayer.map((row) =>
    row.map((cell) => (cell.walkable ? 1 : 0)),
  );
  const collisionMask = chunkState.collisionLayer.map((row) =>
    row.map((cell) => (cell.blocksMovement ? 1 : 0)),
  );

  return {
    inputVersion: "live-world-poc0-visual-input-from-chunk-state-v1",
    worldRuleVersion: sourceInput.worldRuleVersion,
    generatorVersion: "chunk-state-to-visual-input-v1",
    inputPayloadHash: "",
    chunkId: chunkState.chunkId,
    chunkX: chunkState.chunkX,
    chunkY: chunkState.chunkY,
    tileWidth: chunkState.width,
    tileHeight: chunkState.height,
    tileSize: sourceInput.tileSize,
    pixelWidth: sourceInput.pixelWidth,
    pixelHeight: sourceInput.pixelHeight,
    terrainMask,
    biomeMask,
    walkableMask,
    collisionMask,
    entityMap: chunkState.entities.map(visualEntityFromWorldEntity),
    neighborContext: sourceInput.neighborContext,
    styleProfile: sourceInput.styleProfile,
    visualConstraints: sourceInput.visualConstraints,
    sourceChunkStatePayloadHash: chunkState.chunkStatePayloadHash,
  };
}

const sourceInput = JSON.parse(await readFile(sourceInputPath, "utf8"));
const chunkState = JSON.parse(await readFile(chunkStatePath, "utf8"));
const visualInput = buildVisualInput(chunkState, sourceInput);
visualInput.inputPayloadHash = hashVisualInput(visualInput);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(visualInput, null, 2)}\n`, "utf8");

console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(`inputPayloadHash=${visualInput.inputPayloadHash}`);
