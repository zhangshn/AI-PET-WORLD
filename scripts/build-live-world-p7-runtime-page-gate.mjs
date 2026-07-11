import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";

const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const runtimeSnapshotPath = path.join(root, "data/live-world/runtime-states/p3-runtime-activation-snapshot.json");
const approvedVisualRoot = path.join(root, "data/live-world/approved-visuals");
const pageGateRoot = path.join(root, "data/live-world/page-gates");
const approvedVisualManifestPath = path.join(approvedVisualRoot, "p7-approved-visual-manifest.json");
const pageGatePath = path.join(pageGateRoot, "p7-runtime-page-gate.json");
const latestPageGatePath = path.join(pageGateRoot, "latest-runtime-page-gate.json");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const runtimeSnapshot = JSON.parse(await readFile(runtimeSnapshotPath, "utf8"));
const activeChunkIds = runtimeSnapshot.activeChunkIds ?? [];
const sleepingChunkIds = runtimeSnapshot.sleepingChunkIds ?? [];
const sourceMismatch =
  worldState.worldStatePayloadHash !== runtimeSnapshot.sourceWorldStatePayloadHash;

const approvedVisuals = [];
const approvedVisualChunkIds = new Set(approvedVisuals.map((entry) => entry.chunkId));
const missingApprovedVisualChunkIds = activeChunkIds.filter(
  (chunkId) => !approvedVisualChunkIds.has(chunkId),
);

const approvedVisualManifest = {
  manifestVersion: "live-world-p7-approved-visual-manifest-v1",
  manifestId: "live-world-p7-approved-visual-manifest-0001",
  worldId: worldState.worldId,
  sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  requiredChunkIds: activeChunkIds,
  approvedVisuals,
  approvedVisualCount: approvedVisuals.length,
  missingApprovedVisualChunkIds,
  readBoundary: {
    allowedVisualRoots: [
      "data/live-world/approved-visuals",
    ],
    forbiddenVisualRoots: [
      "data/world-visual-candidates",
      "data/world-samples/pending",
      "data/world-samples/rejected",
      "data/world-runs",
      ".runtime/ai-painter",
    ],
    allowCandidateOutputs: false,
    allowPendingSamples: false,
    allowRejectedSamples: false,
  },
  createdAt: now,
};

const status = sourceMismatch
  ? "blocked_source_mismatch"
  : missingApprovedVisualChunkIds.length > 0
    ? "blocked_no_approved_visuals"
    : "ready";

const blockedReasons = [];
if (sourceMismatch) {
  blockedReasons.push("WorldState hash does not match the runtime snapshot source hash.");
}
if (missingApprovedVisualChunkIds.length > 0) {
  blockedReasons.push("Active chunks do not have owner-approved visual outputs.");
}

const pageGate = {
  pageGateVersion: "live-world-p7-runtime-page-gate-v1",
  gateId: "live-world-p7-runtime-page-gate-0001",
  status,
  worldId: worldState.worldId,
  worldStatePath: projectPath(worldStatePath),
  runtimeSnapshotPath: projectPath(runtimeSnapshotPath),
  approvedVisualManifestPath: projectPath(approvedVisualManifestPath),
  worldStatePayloadHash: worldState.worldStatePayloadHash,
  runtimeSnapshotSourceWorldStatePayloadHash: runtimeSnapshot.sourceWorldStatePayloadHash,
  activeChunkCount: activeChunkIds.length,
  sleepingChunkCount: sleepingChunkIds.length,
  requiredVisualChunkCount: activeChunkIds.length,
  approvedVisualCount: approvedVisuals.length,
  missingApprovedVisualChunkIds,
  allowedReadRoots: [
    "data/live-world/world-states",
    "data/live-world/runtime-states",
    "data/live-world/approved-visuals",
  ],
  forbiddenReadRoots: [
    "data/world-visual-candidates",
    "data/world-samples/pending",
    "data/world-samples/rejected",
    "data/world-runs",
    ".runtime/ai-painter",
  ],
  canRenderWorldPage: status === "ready",
  blockedReasons,
  nextAllowedAction: status === "ready"
    ? "Render /world from WorldState, RuntimeActivationSnapshot, and approved visuals only."
    : "Generate visual candidates, run structure review, complete owner approval, and promote approved chunk visuals before enabling /world rendering.",
  createdAt: now,
};

await mkdir(approvedVisualRoot, { recursive: true });
await mkdir(pageGateRoot, { recursive: true });
await writeFile(approvedVisualManifestPath, `${JSON.stringify(approvedVisualManifest, null, 2)}\n`, "utf8");
await writeFile(pageGatePath, `${JSON.stringify(pageGate, null, 2)}\n`, "utf8");
await writeFile(
  latestPageGatePath,
  `${JSON.stringify(
    {
      gateId: pageGate.gateId,
      status: pageGate.status,
      pageGatePath: projectPath(pageGatePath),
      approvedVisualManifestPath: pageGate.approvedVisualManifestPath,
      canRenderWorldPage: pageGate.canRenderWorldPage,
      createdAt: now,
    },
    null,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${projectPath(approvedVisualManifestPath)}`);
console.log(`Wrote ${projectPath(pageGatePath)}`);
console.log(`gateId=${pageGate.gateId}`);
console.log(`status=${pageGate.status}`);
console.log(`activeChunks=${pageGate.activeChunkCount}`);
console.log(`approvedVisuals=${pageGate.approvedVisualCount}`);
console.log(`missingApprovedVisuals=${pageGate.missingApprovedVisualChunkIds.length}`);
console.log(`canRenderWorldPage=${pageGate.canRenderWorldPage}`);
