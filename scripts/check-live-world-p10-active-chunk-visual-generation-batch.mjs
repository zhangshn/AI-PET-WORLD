import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const runtimeSnapshotPath = path.join(root, "data/live-world/runtime-states/p3-runtime-activation-snapshot.json");
const pageGatePath = path.join(root, "data/live-world/page-gates/p7-runtime-page-gate.json");
const manifestPath = path.join(root, "data/live-world/visual-generation-requests/p10-active-chunks/generation-batch.json");
const latestPath = path.join(root, "data/live-world/visual-generation-requests/latest-generation-batch.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const runtimeSnapshot = JSON.parse(await readFile(runtimeSnapshotPath, "utf8"));
const pageGate = JSON.parse(await readFile(pageGatePath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const latest = JSON.parse(await readFile(latestPath, "utf8"));

assert(manifest.batchVersion === "live-world-p10-active-chunk-visual-generation-batch-v1", "invalid batch version");
assert(manifest.status === "ready_for_ai_painter", "P10 batch must be ready for AI Painter");
assert(manifest.sourceWorldStatePayloadHash === worldState.worldStatePayloadHash, "source world hash mismatch");
assert(manifest.sourceRuntimePageGateStatus === pageGate.status, "source page gate status mismatch");
assert(pageGate.status === "blocked_no_approved_visuals", "P10 starts from the expected blocked page gate state");
assert(manifest.activeChunkCount === runtimeSnapshot.activeChunkIds.length, "active chunk count mismatch");
assert(manifest.requestCount === 9, "P10 must create 9 active chunk requests");
assert(manifest.entries.length === manifest.requestCount, "entry count mismatch");
assert(manifest.readBoundary.canWriteCandidates === true, "P10 generation batch must be allowed to write candidates");
assert(manifest.readBoundary.canWriteApprovedVisuals === false, "P10 generation batch must not write approved visuals");
assert(manifest.readBoundary.canWriteTrainingSamples === false, "P10 generation batch must not write training samples");
assert(manifest.readBoundary.canBypassRuntimePageGate === false, "P10 generation batch must not bypass page gate");
assert(manifest.nextRequiredPipelines.aiPainterGeneration === true, "missing AI Painter generation step");
assert(manifest.nextRequiredPipelines.autoStructureReview === true, "missing auto review step");
assert(manifest.nextRequiredPipelines.ownerReview === true, "missing owner review step");
assert(manifest.nextRequiredPipelines.approvedVisualPromotion === true, "missing approved promotion step");
assert(manifest.nextRequiredPipelines.runtimePageGateRefresh === true, "missing page gate refresh step");

const activeSet = new Set(runtimeSnapshot.activeChunkIds);
const seenChunkIds = new Set();
const seenHashes = new Set();

for (const entry of manifest.entries) {
  assert(activeSet.has(entry.chunkId), `entry chunk is not active: ${entry.chunkId}`);
  assert(!seenChunkIds.has(entry.chunkId), `duplicate chunk request: ${entry.chunkId}`);
  seenChunkIds.add(entry.chunkId);
  assert(entry.status === "waiting_for_ai_painter", `entry must wait for AI Painter: ${entry.requestId}`);
  assert(entry.expectedCandidateRoot.startsWith("data/world-visual-candidates/"), "candidate root must be a candidate path");
  assert(entry.expectedOutputImagePath.endsWith("/output.image.png"), "expected output image path mismatch");

  const visualInputPath = path.join(root, entry.visualInputPath);
  const visualInput = JSON.parse(await readFile(visualInputPath, "utf8"));
  assert(visualInput.inputVersion === "live-world-p10-active-chunk-visual-input-v1", "invalid visual input version");
  assert(visualInput.chunkId === entry.chunkId, "visual input chunkId mismatch");
  assert(visualInput.inputPayloadHash === entry.inputPayloadHash, "entry input hash mismatch");
  assert(hashVisualInput(visualInput) === visualInput.inputPayloadHash, "visual input hash is not stable");
  assert(!seenHashes.has(visualInput.inputPayloadHash), "duplicate visual input hash");
  seenHashes.add(visualInput.inputPayloadHash);
  assert(visualInput.tileWidth === 32, "tileWidth must be 32");
  assert(visualInput.tileHeight === 32, "tileHeight must be 32");
  assert(visualInput.pixelWidth === 512, "pixelWidth must be 512");
  assert(visualInput.pixelHeight === 512, "pixelHeight must be 512");
  assert(visualInput.terrainMask.length === 32, "terrainMask height mismatch");
  assert(visualInput.terrainMask.every((row) => row.length === 32), "terrainMask width mismatch");
  assert(visualInput.biomeMask.length === 32, "biomeMask height mismatch");
  assert(visualInput.walkableMask.length === 32, "walkableMask height mismatch");
  assert(visualInput.collisionMask.length === 32, "collisionMask height mismatch");
  assert(Array.isArray(visualInput.entityMap), "entityMap must be an array");
  assert(visualInput.visualConstraints.forbidUnlistedInteractiveResources === true, "must forbid unlisted interactive resources");
  assert(visualInput.visualConstraints.preserveTerrainMask.water === true, "must preserve water mask");
  assert(visualInput.visualConstraints.preserveTerrainMask.dirt_path === true, "must preserve dirt path mask");
  assert(visualInput.visualConstraints.preserveTerrainMask.shoreline === true, "must preserve shoreline mask");
  assert(visualInput.visualConstraints.preserveChunkEdges === true, "must preserve chunk edges");
}

for (const activeChunkId of runtimeSnapshot.activeChunkIds) {
  assert(seenChunkIds.has(activeChunkId), `missing active chunk request: ${activeChunkId}`);
}

assert(latest.batchId === manifest.batchId, "latest batchId mismatch");
assert(latest.requestCount === manifest.requestCount, "latest request count mismatch");
assert(latest.canWriteApprovedVisuals === false, "latest must not write approved visuals");
assert(latest.canBypassRuntimePageGate === false, "latest must not bypass page gate");

console.log("P10 active chunk visual generation batch check passed");
console.log(`batchId=${manifest.batchId}`);
console.log(`status=${manifest.status}`);
console.log(`requestCount=${manifest.requestCount}`);
console.log(`uniqueInputHashes=${seenHashes.size}`);
