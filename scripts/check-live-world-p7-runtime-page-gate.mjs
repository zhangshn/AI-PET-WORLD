import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const runtimeSnapshotPath = path.join(root, "data/live-world/runtime-states/p3-runtime-activation-snapshot.json");
const manifestPath = path.join(root, "data/live-world/approved-visuals/p7-approved-visual-manifest.json");
const pageGatePath = path.join(root, "data/live-world/page-gates/p7-runtime-page-gate.json");
const latestPageGatePath = path.join(root, "data/live-world/page-gates/latest-runtime-page-gate.json");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const runtimeSnapshot = JSON.parse(await readFile(runtimeSnapshotPath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pageGate = JSON.parse(await readFile(pageGatePath, "utf8"));
const latest = JSON.parse(await readFile(latestPageGatePath, "utf8"));

const requiredForbiddenRoots = [
  "data/world-visual-candidates",
  "data/world-samples/pending",
  "data/world-samples/rejected",
  "data/world-runs",
  ".runtime/ai-painter",
];

assert(manifest.manifestVersion === "live-world-p7-approved-visual-manifest-v1", "invalid approved visual manifest version");
assert(manifest.worldId === worldState.worldId, "approved visual manifest worldId mismatch");
assert(manifest.sourceWorldStatePayloadHash === worldState.worldStatePayloadHash, "approved visual manifest source hash mismatch");
assert(Array.isArray(manifest.requiredChunkIds), "requiredChunkIds must be an array");
assert(manifest.requiredChunkIds.length === runtimeSnapshot.activeChunkIds.length, "required chunk count mismatch");
assert(Array.isArray(manifest.approvedVisuals), "approvedVisuals must be an array");
assert(manifest.approvedVisuals.length === manifest.approvedVisualCount, "approved visual count mismatch");
assert(manifest.approvedVisualCount === 0, "P7 must not fabricate approved visuals");
assert(manifest.missingApprovedVisualChunkIds.length === runtimeSnapshot.activeChunkIds.length, "all active chunks should be missing approved visuals at P7");
assert(manifest.readBoundary.allowCandidateOutputs === false, "approved manifest must not allow candidate outputs");
assert(manifest.readBoundary.allowPendingSamples === false, "approved manifest must not allow pending samples");
assert(manifest.readBoundary.allowRejectedSamples === false, "approved manifest must not allow rejected samples");

for (const forbidden of requiredForbiddenRoots) {
  assert(manifest.readBoundary.forbiddenVisualRoots.includes(forbidden), `manifest missing forbidden root: ${forbidden}`);
}

assert(pageGate.pageGateVersion === "live-world-p7-runtime-page-gate-v1", "invalid page gate version");
assert(pageGate.status === "blocked_no_approved_visuals", "P7 gate must be blocked until approved visuals exist");
assert(pageGate.worldId === worldState.worldId, "page gate worldId mismatch");
assert(pageGate.worldStatePath === "data/live-world/world-states/p2-fixed-seed-5x5-world.json", "worldStatePath mismatch");
assert(pageGate.runtimeSnapshotPath === "data/live-world/runtime-states/p3-runtime-activation-snapshot.json", "runtimeSnapshotPath mismatch");
assert(pageGate.approvedVisualManifestPath === "data/live-world/approved-visuals/p7-approved-visual-manifest.json", "approvedVisualManifestPath mismatch");
assert(pageGate.worldStatePayloadHash === worldState.worldStatePayloadHash, "page gate world hash mismatch");
assert(pageGate.runtimeSnapshotSourceWorldStatePayloadHash === runtimeSnapshot.sourceWorldStatePayloadHash, "page gate runtime source hash mismatch");
assert(pageGate.worldStatePayloadHash === pageGate.runtimeSnapshotSourceWorldStatePayloadHash, "WorldState and runtime snapshot source hash must match");
assert(pageGate.activeChunkCount === 9, "P7 should expose 9 active chunks");
assert(pageGate.sleepingChunkCount === 16, "P7 should expose 16 sleeping chunks");
assert(pageGate.requiredVisualChunkCount === 9, "P7 should require visual output for 9 active chunks");
assert(pageGate.approvedVisualCount === 0, "P7 should have no approved visuals yet");
assert(pageGate.missingApprovedVisualChunkIds.length === 9, "P7 should report 9 missing approved visuals");
assert(pageGate.canRenderWorldPage === false, "P7 /world must remain blocked without approved visuals");
assert(pageGate.blockedReasons.includes("Active chunks do not have owner-approved visual outputs."), "missing approved visual blocked reason");

for (const forbidden of requiredForbiddenRoots) {
  assert(pageGate.forbiddenReadRoots.includes(forbidden), `page gate missing forbidden root: ${forbidden}`);
  assert(!pageGate.allowedReadRoots.includes(forbidden), `forbidden root must not be allowed: ${forbidden}`);
}

for (const allowed of [
  "data/live-world/world-states",
  "data/live-world/runtime-states",
  "data/live-world/approved-visuals",
]) {
  assert(pageGate.allowedReadRoots.includes(allowed), `page gate missing allowed root: ${allowed}`);
}

assert(latest.gateId === pageGate.gateId, "latest gateId mismatch");
assert(latest.status === pageGate.status, "latest status mismatch");
assert(latest.canRenderWorldPage === pageGate.canRenderWorldPage, "latest render flag mismatch");
assert(latest.pageGatePath === "data/live-world/page-gates/p7-runtime-page-gate.json", "latest pageGatePath mismatch");

console.log("P7 runtime page gate check passed");
console.log(`gateId=${pageGate.gateId}`);
console.log(`status=${pageGate.status}`);
console.log(`activeChunks=${pageGate.activeChunkCount}`);
console.log(`approvedVisuals=${pageGate.approvedVisualCount}`);
console.log(`missingApprovedVisuals=${pageGate.missingApprovedVisualChunkIds.length}`);
console.log(`canRenderWorldPage=${pageGate.canRenderWorldPage}`);
