import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runId = "p8-butler-behavior-0001";
const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const runtimeSnapshotPath = path.join(root, "data/live-world/runtime-states/p3-runtime-activation-snapshot.json");
const intentPath = path.join(root, "data/live-world/behavior-runs", runId, "butler-behavior-intent.json");
const mutationRecordPath = path.join(root, "data/live-world/behavior-runs", runId, "butler-world-mutation-record.json");
const deltaPath = path.join(root, "data/live-world/world-mutations/p8-butler-harvest-berry-world-state-delta.json");
const latestPath = path.join(root, "data/live-world/behavior-runs/latest-butler-behavior.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const runtimeSnapshot = JSON.parse(await readFile(runtimeSnapshotPath, "utf8"));
const intent = JSON.parse(await readFile(intentPath, "utf8"));
const mutationRecord = JSON.parse(await readFile(mutationRecordPath, "utf8"));
const delta = JSON.parse(await readFile(deltaPath, "utf8"));
const latest = JSON.parse(await readFile(latestPath, "utf8"));

const activeChunkIds = new Set(runtimeSnapshot.activeChunkIds);
const targetChunk = worldState.chunks.find((chunk) => chunk.chunkId === intent.target.chunkId);
const targetEntity = targetChunk?.entities.find((entity) => entity.entityId === intent.target.entityId);

assert(intent.intentVersion === "live-world-p8-butler-behavior-intent-v1", "invalid intent version");
assert(intent.behaviorType === "harvest_resource", "P8 POC behavior must harvest a resource");
assert(intent.sourceWorldStatePayloadHash === worldState.worldStatePayloadHash, "intent world hash mismatch");
assert(activeChunkIds.has(intent.target.chunkId), "target chunk must be active");
assert(targetEntity, "target entity must exist in WorldState");
assert(targetEntity.entityType === "berry_bush", "target entity must be a berry_bush");
assert(targetEntity.lifecycle.stage === "fruiting", "target berry_bush must start as fruiting");

assert(mutationRecord.mutationVersion === "live-world-p8-butler-world-mutation-record-v1", "invalid mutation version");
assert(mutationRecord.status === "applied", "mutation must be applied");
assert(mutationRecord.intentId === intent.intentId, "mutation intentId mismatch");
assert(mutationRecord.sourceWorldStatePayloadHash === worldState.worldStatePayloadHash, "mutation world hash mismatch");
assert(mutationRecord.affectedChunkIds.length === 1, "P8 POC should affect one chunk");
assert(mutationRecord.affectedChunkIds[0] === intent.target.chunkId, "affected chunk mismatch");
assert(mutationRecord.visualRefreshRequired === true, "behavior must require visual refresh");
assert(mutationRecord.runtimeSnapshotRefreshRequired === true, "behavior must require runtime refresh");
assert(mutationRecord.collisionProjectionRefreshRequired === false, "harvesting berry should not require collision refresh");
assert(mutationRecord.forbiddenSideEffects.writesImageFiles === false, "behavior must not write image files");
assert(mutationRecord.forbiddenSideEffects.writesTrainingSamples === false, "behavior must not write training samples");
assert(mutationRecord.forbiddenSideEffects.writesApprovedVisuals === false, "behavior must not write approved visuals");
assert(mutationRecord.forbiddenSideEffects.bypassesRuntimePageGate === false, "behavior must not bypass page gate");

const stageMutation = mutationRecord.entityMutations.find((item) => item.fieldPath === "lifecycle.stage");
const visualMutation = mutationRecord.entityMutations.find((item) => item.fieldPath === "visualProfileId");
assert(stageMutation?.before === "fruiting", "stage mutation before mismatch");
assert(stageMutation?.after === "harvested", "stage mutation after mismatch");
assert(visualMutation?.after === "berry_bush.harvested", "visual profile mutation mismatch");
assert(mutationRecord.resourceDeltas[0]?.resourceType === "berry", "resource delta type mismatch");
assert(mutationRecord.resourceDeltas[0]?.amount === 3, "resource delta amount mismatch");

assert(delta.deltaVersion === "live-world-p8-world-state-delta-v1", "invalid delta version");
assert(delta.mutationId === mutationRecord.mutationId, "delta mutationId mismatch");
assert(delta.sourceWorldStatePayloadHash === worldState.worldStatePayloadHash, "delta world hash mismatch");
assert(delta.nextRequiredPipelines.lifecycleRefresh === true, "delta must require lifecycle refresh");
assert(delta.nextRequiredPipelines.runtimeActivationRefresh === true, "delta must require runtime activation refresh");
assert(delta.nextRequiredPipelines.chunkVisualInputRefresh === true, "delta must require visual input refresh");
assert(delta.nextRequiredPipelines.candidateGeneration === true, "delta must require candidate generation");
assert(delta.nextRequiredPipelines.ownerApprovalBeforeRuntimePage === true, "delta must require owner approval before runtime page");

assert(latest.runId === runId, "latest runId mismatch");
assert(latest.intentId === intent.intentId, "latest intentId mismatch");
assert(latest.mutationId === mutationRecord.mutationId, "latest mutationId mismatch");
assert(latest.ownerApprovalBeforeRuntimePage === true, "latest must keep owner approval gate");

console.log("P8 butler behavior check passed");
console.log(`runId=${latest.runId}`);
console.log(`targetEntity=${intent.target.entityId}`);
console.log(`affectedChunk=${intent.target.chunkId}`);
console.log(`status=${mutationRecord.status}`);
console.log(`visualRefreshRequired=${mutationRecord.visualRefreshRequired}`);
