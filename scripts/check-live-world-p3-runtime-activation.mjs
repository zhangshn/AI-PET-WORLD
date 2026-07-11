import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const worldPath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const snapshotPath = path.join(root, "data/live-world/runtime-states/p3-runtime-activation-snapshot.json");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function withoutHash(worldState) {
  const { worldStatePayloadHash, ...rest } = worldState;
  return rest;
}

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

const worldState = JSON.parse(await readFile(worldPath, "utf8"));
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const calculatedWorldHash = hashJson(withoutHash(worldState));

assert(snapshot.runtimeSnapshotVersion === "live-world-p3-runtime-activation-v1", "invalid runtime snapshot version");
assert(snapshot.sourceWorldStatePayloadHash === worldState.worldStatePayloadHash, "snapshot source hash mismatch");
assert(snapshot.sourceWorldStatePayloadHash === calculatedWorldHash, "world hash is not reproducible");
assert(snapshot.worldId === worldState.worldId, "worldId mismatch");
assert(snapshot.seed === worldState.seed, "seed mismatch");
assert(snapshot.playerId === worldState.playerState.playerId, "playerId mismatch");
assert(snapshot.playerWorldTileX === worldState.playerState.worldTileX, "playerWorldTileX mismatch");
assert(snapshot.playerWorldTileY === worldState.playerState.worldTileY, "playerWorldTileY mismatch");
assert(snapshot.centerChunkId === worldState.playerState.currentChunkId, "centerChunkId mismatch");
assert(snapshot.centerChunkX === 0 && snapshot.centerChunkY === 0, "P3 fixture player must start in center chunk");
assert(snapshot.activeChunkRadius === 1, "activeChunkRadius must be 1");
assert(Array.isArray(snapshot.activeChunkIds), "activeChunkIds must be an array");
assert(Array.isArray(snapshot.sleepingChunkIds), "sleepingChunkIds must be an array");
assert(Array.isArray(snapshot.missingChunkIds), "missingChunkIds must be an array");
assert(snapshot.activeChunkIds.length === 9, "center active radius should activate 9 chunks");
assert(snapshot.sleepingChunkIds.length === 16, "5x5 world should leave 16 sleeping chunks");
assert(snapshot.missingChunkIds.length === 0, "center 3x3 activation should have no missing chunks");
assert(snapshot.activeChunks.length === 9, "activeChunks length mismatch");
assert(snapshot.sleepingChunks.length === 16, "sleepingChunks length mismatch");

const worldChunksById = new Map(worldState.chunks.map((chunk) => [chunk.chunkId, chunk]));
const allRuntimeChunkIds = new Set([...snapshot.activeChunkIds, ...snapshot.sleepingChunkIds]);
assert(allRuntimeChunkIds.size === 25, "runtime snapshot must mention every chunk exactly once");

for (const chunkId of allRuntimeChunkIds) {
  assert(worldChunksById.has(chunkId), `runtime chunk not found in WorldState: ${chunkId}`);
}

for (const activeChunk of snapshot.activeChunks) {
  assert(snapshot.activeChunkIds.includes(activeChunk.chunkId), `active chunk record missing from ids: ${activeChunk.chunkId}`);
  assert(Math.abs(activeChunk.distanceFromPlayerChunkX) <= 1, `active chunk X distance out of range: ${activeChunk.chunkId}`);
  assert(Math.abs(activeChunk.distanceFromPlayerChunkY) <= 1, `active chunk Y distance out of range: ${activeChunk.chunkId}`);
  assert(activeChunk.runtimeState.loadedState === "active", `active chunk state mismatch: ${activeChunk.chunkId}`);
  assert(activeChunk.runtimeState.isActive === true, `active chunk isActive mismatch: ${activeChunk.chunkId}`);
}

for (const sleepingChunk of snapshot.sleepingChunks) {
  assert(snapshot.sleepingChunkIds.includes(sleepingChunk.chunkId), `sleeping chunk record missing from ids: ${sleepingChunk.chunkId}`);
  assert(
    Math.abs(sleepingChunk.distanceFromPlayerChunkX) > 1 ||
      Math.abs(sleepingChunk.distanceFromPlayerChunkY) > 1,
    `sleeping chunk is inside active radius: ${sleepingChunk.chunkId}`,
  );
  assert(sleepingChunk.runtimeState.loadedState === "sleeping", `sleeping chunk state mismatch: ${sleepingChunk.chunkId}`);
  assert(sleepingChunk.runtimeState.isActive === false, `sleeping chunk isActive mismatch: ${sleepingChunk.chunkId}`);
}

for (let chunkY = -1; chunkY <= 1; chunkY += 1) {
  for (let chunkX = -1; chunkX <= 1; chunkX += 1) {
    const expectedChunkId = `p2-fixed-seed-5x5-world-chunk-${chunkX}-${chunkY}`;
    assert(snapshot.activeChunkIds.includes(expectedChunkId), `missing active 3x3 chunk ${chunkKey(chunkX, chunkY)}`);
  }
}

assert(snapshot.runtimeReadBoundary.allowedSource === "WorldState", "runtime must read WorldState only");
assert(snapshot.runtimeReadBoundary.allowTrainingArtifacts === false, "runtime must not allow training artifacts");
assert(snapshot.runtimeReadBoundary.allowUnreviewedCandidates === false, "runtime must not allow unreviewed candidates");
for (const forbidden of [
  ".runtime/ai-painter",
  "data/world-visual-candidates",
  "data/world-samples",
]) {
  assert(
    snapshot.runtimeReadBoundary.forbiddenSources.includes(forbidden),
    `missing forbidden runtime source: ${forbidden}`,
  );
}

console.log("P3 runtime activation check passed");
console.log(`centerChunkId=${snapshot.centerChunkId}`);
console.log(`activeChunks=${snapshot.activeChunks.length}`);
console.log(`sleepingChunks=${snapshot.sleepingChunks.length}`);
console.log(`sourceWorldStatePayloadHash=${snapshot.sourceWorldStatePayloadHash}`);
