import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";

const runId = "p8-butler-behavior-0001";
const behaviorRoot = path.join(root, "data/live-world/behavior-runs", runId);
const mutationRoot = path.join(root, "data/live-world/world-mutations");

const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const runtimeSnapshotPath = path.join(root, "data/live-world/runtime-states/p3-runtime-activation-snapshot.json");

const intentPath = path.join(behaviorRoot, "butler-behavior-intent.json");
const mutationRecordPath = path.join(behaviorRoot, "butler-world-mutation-record.json");
const deltaPath = path.join(mutationRoot, "p8-butler-harvest-berry-world-state-delta.json");
const latestPath = path.join(root, "data/live-world/behavior-runs/latest-butler-behavior.json");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function findTargetBerryBush(worldState, runtimeSnapshot) {
  const activeChunkIds = new Set(runtimeSnapshot.activeChunkIds);
  for (const chunk of worldState.chunks) {
    if (!activeChunkIds.has(chunk.chunkId)) continue;
    const entity = chunk.entities.find(
      (item) => item.entityType === "berry_bush" && item.lifecycle?.stage === "fruiting",
    );
    if (entity) return { chunk, entity };
  }
  return null;
}

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const runtimeSnapshot = JSON.parse(await readFile(runtimeSnapshotPath, "utf8"));
const target = findTargetBerryBush(worldState, runtimeSnapshot);

if (!target) {
  throw new Error("No active fruiting berry_bush was found for the P8 butler behavior POC.");
}

const { chunk, entity } = target;
const intentId = "p8-butler-intent-harvest-berry-0001";
const mutationId = "p8-butler-world-mutation-harvest-berry-0001";

const intent = {
  intentVersion: "live-world-p8-butler-behavior-intent-v1",
  intentId,
  actorId: "butler-001",
  behaviorType: "harvest_resource",
  target: {
    chunkId: chunk.chunkId,
    entityId: entity.entityId,
    entityType: entity.entityType,
    tileX: entity.tileX,
    tileY: entity.tileY,
  },
  requestedTick: 1,
  sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  sourceRuntimeSnapshotPath: projectPath(runtimeSnapshotPath),
  createdAt: now,
};

const entityMutations = [
  {
    entityId: entity.entityId,
    entityType: entity.entityType,
    fieldPath: "lifecycle.stage",
    before: entity.lifecycle.stage,
    after: "harvested",
  },
  {
    entityId: entity.entityId,
    entityType: entity.entityType,
    fieldPath: "lifecycle.nextFruitTick",
    before: null,
    after: 721,
  },
  {
    entityId: entity.entityId,
    entityType: entity.entityType,
    fieldPath: "visualProfileId",
    before: entity.visualProfileId,
    after: "berry_bush.harvested",
  },
  {
    entityId: entity.entityId,
    entityType: entity.entityType,
    fieldPath: "updatedTick",
    before: entity.updatedTick,
    after: 1,
  },
];

const mutationRecord = {
  mutationVersion: "live-world-p8-butler-world-mutation-record-v1",
  mutationId,
  status: "applied",
  intentId,
  actorId: intent.actorId,
  behaviorType: intent.behaviorType,
  sourceWorldStatePath: projectPath(worldStatePath),
  sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  affectedChunkIds: [chunk.chunkId],
  entityMutations,
  resourceDeltas: [
    {
      resourceType: "berry",
      amount: 3,
      inventoryTarget: "butler-001",
      reason: "Harvested a fruiting berry_bush in an active chunk.",
    },
  ],
  collisionProjectionRefreshRequired: false,
  runtimeSnapshotRefreshRequired: true,
  visualRefreshRequired: true,
  forbiddenSideEffects: {
    writesImageFiles: false,
    writesTrainingSamples: false,
    writesApprovedVisuals: false,
    bypassesRuntimePageGate: false,
  },
  createdAt: now,
};

const worldStateDelta = {
  deltaVersion: "live-world-p8-world-state-delta-v1",
  deltaId: "p8-butler-harvest-berry-world-state-delta-0001",
  mutationId,
  sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  affectedChunkIds: [chunk.chunkId],
  entityMutations,
  nextRequiredPipelines: {
    lifecycleRefresh: true,
    collisionProjectionRefresh: false,
    runtimeActivationRefresh: true,
    chunkVisualInputRefresh: true,
    candidateGeneration: true,
    ownerApprovalBeforeRuntimePage: true,
  },
  createdAt: now,
};

await mkdir(behaviorRoot, { recursive: true });
await mkdir(mutationRoot, { recursive: true });
await writeFile(intentPath, `${JSON.stringify(intent, null, 2)}\n`, "utf8");
await writeFile(mutationRecordPath, `${JSON.stringify(mutationRecord, null, 2)}\n`, "utf8");
await writeFile(deltaPath, `${JSON.stringify(worldStateDelta, null, 2)}\n`, "utf8");
await writeFile(
  latestPath,
  `${JSON.stringify(
    {
      runId,
      intentId,
      mutationId,
      status: mutationRecord.status,
      behaviorIntentPath: projectPath(intentPath),
      mutationRecordPath: projectPath(mutationRecordPath),
      worldStateDeltaPath: projectPath(deltaPath),
      affectedChunkIds: mutationRecord.affectedChunkIds,
      visualRefreshRequired: mutationRecord.visualRefreshRequired,
      ownerApprovalBeforeRuntimePage: true,
      createdAt: now,
    },
    null,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${projectPath(intentPath)}`);
console.log(`Wrote ${projectPath(mutationRecordPath)}`);
console.log(`Wrote ${projectPath(deltaPath)}`);
console.log(`runId=${runId}`);
console.log(`targetEntity=${entity.entityId}`);
console.log(`affectedChunk=${chunk.chunkId}`);
console.log("status=applied");
console.log("visualRefreshRequired=true");
