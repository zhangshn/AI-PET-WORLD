import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const worldPath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const outputDir = path.join(root, "data/live-world/runtime-states");
const outputPath = path.join(outputDir, "p3-runtime-activation-snapshot.json");

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function withoutHash(worldState) {
  const { worldStatePayloadHash, ...rest } = worldState;
  return rest;
}

function worldTileToChunkCoordinate(worldState, worldTileX, worldTileY) {
  return {
    chunkX: Math.floor(worldTileX / worldState.chunkSize) - worldState.chunkRadius,
    chunkY: Math.floor(worldTileY / worldState.chunkSize) - worldState.chunkRadius,
  };
}

function activationRecord(chunk, center, isActive) {
  return {
    chunkId: chunk.chunkId,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    distanceFromPlayerChunkX: chunk.chunkX - center.chunkX,
    distanceFromPlayerChunkY: chunk.chunkY - center.chunkY,
    runtimeState: {
      loadedState: isActive ? "active" : "sleeping",
      isActive,
      lastActiveTick: isActive ? 0 : chunk.runtimeState.lastActiveTick,
      lastUpdatedTick: 0,
    },
  };
}

function buildActivationSnapshot(worldState) {
  if (!worldState.playerState) {
    throw new Error("WorldState.playerState is required for runtime activation.");
  }

  const sourceWorldStatePayloadHash =
    worldState.worldStatePayloadHash ?? hashJson(withoutHash(worldState));
  const center = worldTileToChunkCoordinate(
    worldState,
    worldState.playerState.worldTileX,
    worldState.playerState.worldTileY,
  );
  const chunksByCoordinate = new Map(
    worldState.chunks.map((chunk) => [chunkKey(chunk.chunkX, chunk.chunkY), chunk]),
  );
  const activeChunks = [];
  const missingChunkIds = [];

  for (let chunkY = center.chunkY - worldState.activeChunkRadius; chunkY <= center.chunkY + worldState.activeChunkRadius; chunkY += 1) {
    for (let chunkX = center.chunkX - worldState.activeChunkRadius; chunkX <= center.chunkX + worldState.activeChunkRadius; chunkX += 1) {
      const chunk = chunksByCoordinate.get(chunkKey(chunkX, chunkY));
      if (!chunk) {
        missingChunkIds.push(chunkKey(chunkX, chunkY));
        continue;
      }
      activeChunks.push(activationRecord(chunk, center, true));
    }
  }

  const activeChunkIds = new Set(activeChunks.map((chunk) => chunk.chunkId));
  const sleepingChunks = worldState.chunks
    .filter((chunk) => !activeChunkIds.has(chunk.chunkId))
    .map((chunk) => activationRecord(chunk, center, false));
  const centerChunk = chunksByCoordinate.get(chunkKey(center.chunkX, center.chunkY));

  if (!centerChunk) {
    throw new Error(`Center chunk missing: ${chunkKey(center.chunkX, center.chunkY)}`);
  }

  return {
    runtimeSnapshotVersion: "live-world-p3-runtime-activation-v1",
    sourceWorldStatePayloadHash,
    worldId: worldState.worldId,
    seed: worldState.seed,
    playerId: worldState.playerState.playerId,
    playerWorldTileX: worldState.playerState.worldTileX,
    playerWorldTileY: worldState.playerState.worldTileY,
    centerChunkId: centerChunk.chunkId,
    centerChunkX: center.chunkX,
    centerChunkY: center.chunkY,
    activeChunkRadius: worldState.activeChunkRadius,
    activeChunkIds: activeChunks.map((chunk) => chunk.chunkId),
    sleepingChunkIds: sleepingChunks.map((chunk) => chunk.chunkId),
    missingChunkIds,
    activeChunks,
    sleepingChunks,
    runtimeReadBoundary: {
      allowedSource: "WorldState",
      forbiddenSources: [
        ".runtime/ai-painter",
        "data/world-visual-candidates",
        "data/world-samples",
      ],
      allowTrainingArtifacts: false,
      allowUnreviewedCandidates: false,
    },
    createdAt: "2026-07-06T00:00:00.000Z",
  };
}

const worldState = JSON.parse(await readFile(worldPath, "utf8"));
const snapshot = buildActivationSnapshot(worldState);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(`centerChunkId=${snapshot.centerChunkId}`);
console.log(`activeChunks=${snapshot.activeChunks.length}`);
console.log(`sleepingChunks=${snapshot.sleepingChunks.length}`);
console.log(`sourceWorldStatePayloadHash=${snapshot.sourceWorldStatePayloadHash}`);
