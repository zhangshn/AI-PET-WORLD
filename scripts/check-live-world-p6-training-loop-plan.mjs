import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runId = "live-world-p6-training-plan-0001";
const outputRoot = path.join(root, "data/world-runs", runId);
const manifestPath = path.join(outputRoot, "training-sample-manifest.json");
const runRecordPath = path.join(outputRoot, "training-run-record.json");
const latestPath = path.join(root, "data/world-runs", "latest-training-plan.json");

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const runRecord = JSON.parse(await readFile(runRecordPath, "utf8"));
const latest = JSON.parse(await readFile(latestPath, "utf8"));

assert(manifest.manifestVersion === "live-world-p6-training-sample-manifest-v1", "invalid manifest version");
assert(manifest.trainingRunId === runId, "manifest trainingRunId mismatch");
assert(Array.isArray(manifest.entries), "manifest entries must be an array");
assert(manifest.entries.length === manifest.totalTrainableSamples, "manifest entry count mismatch");
assert(manifest.positiveCount === 0, "current POC must have no positive trainable samples");
assert(manifest.negativeCount === 0, "current POC must have no negative trainable samples");
assert(manifest.totalTrainableSamples === 0, "current POC must have no trainable samples");
assert(manifest.blockedSampleCounts.pending === 1, "current POC should have one pending sample decision");
assert(manifest.blockedSampleCounts.rejected === 0, "current POC should have no rejected sample decision");
assert(manifest.readBoundary.allowPending === false, "training must not allow pending samples");
assert(manifest.readBoundary.allowRejected === false, "training must not allow rejected samples");
assert(manifest.readBoundary.allowedSampleRoots.includes("data/world-samples/positive"), "positive root must be allowed");
assert(manifest.readBoundary.allowedSampleRoots.includes("data/world-samples/negative"), "negative root must be allowed");
for (const forbidden of [
  "data/world-samples/pending",
  "data/world-samples/rejected",
  "data/world-visual-candidates",
  ".runtime/ai-painter",
]) {
  assert(manifest.readBoundary.forbiddenSampleRoots.includes(forbidden), `missing forbidden root: ${forbidden}`);
}

assert(runRecord.trainingRunVersion === "live-world-p6-training-run-record-v1", "invalid training run version");
assert(runRecord.trainingRunId === runId, "runRecord trainingRunId mismatch");
assert(runRecord.status === "blocked_no_trainable_samples", "run must be blocked without trainable samples");
assert(runRecord.sampleManifestPath === "data/world-runs/live-world-p6-training-plan-0001/training-sample-manifest.json", "sampleManifestPath mismatch");
assert(runRecord.configSnapshot.trainingMode === "blocked-plan-only", "blocked run must use blocked-plan-only mode");
assert(runRecord.configSnapshot.command === null, "blocked run must not contain a training command");
assert(runRecord.configSnapshot.datasetRoot === null, "blocked run must not contain a dataset root");
assert(runRecord.configSnapshot.maxEpochs === null, "blocked run must not contain epochs");
assert(runRecord.outputArchivePlan.canWriteModelArtifact === false, "blocked run must not write model artifacts");
assert(runRecord.outputArchivePlan.checkpointPath === null, "blocked run must not have checkpoint path");
assert(runRecord.blockedReasons.includes("positive sample count is 0"), "missing positive blocked reason");
assert(runRecord.blockedReasons.includes("negative sample count is 0"), "missing negative blocked reason");
assert(runRecord.blockedReasons.includes("pending samples are not trainable"), "missing pending blocked reason");
assert(latest.trainingRunId === runId, "latest trainingRunId mismatch");
assert(latest.status === runRecord.status, "latest status mismatch");
assert(latest.trainingRunRecordPath === "data/world-runs/live-world-p6-training-plan-0001/training-run-record.json", "latest record path mismatch");

console.log("P6 training loop plan check passed");
console.log(`trainingRunId=${runRecord.trainingRunId}`);
console.log(`status=${runRecord.status}`);
console.log(`trainableSamples=${manifest.totalTrainableSamples}`);
console.log(`pendingSamples=${manifest.blockedSampleCounts.pending}`);
