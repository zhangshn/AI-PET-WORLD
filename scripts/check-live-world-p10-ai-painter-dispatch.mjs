import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const batchPath = path.join(root, "data/live-world/visual-generation-requests/p10-active-chunks/generation-batch.json");
const dispatchPath = path.join(root, "data/live-world/visual-generation-dispatches/p10-active-chunks/ai-painter-dispatch.json");
const latestPath = path.join(root, "data/live-world/visual-generation-dispatches/latest-ai-painter-dispatch.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const batch = JSON.parse(await readFile(batchPath, "utf8"));
const dispatch = JSON.parse(await readFile(dispatchPath, "utf8"));
const latest = JSON.parse(await readFile(latestPath, "utf8"));

assert(dispatch.dispatchVersion === "live-world-p10-ai-painter-dispatch-v1", "invalid dispatch version");
assert(dispatch.batchId === batch.batchId, "dispatch batchId mismatch");
assert(dispatch.status === "blocked_missing_ai_painter_command", "current P10-B dispatch should be blocked until AI Painter command is configured");
assert(dispatch.aiPainterCommand === null, "current P10-B dispatch must not contain an implicit AI Painter command");
assert(dispatch.candidateCount === 9, "dispatch must prepare 9 candidates");
assert(dispatch.imageGeneratedCount === 0, "dispatch must not fabricate generated images");
assert(dispatch.entries.length === dispatch.candidateCount, "dispatch entry count mismatch");
assert(dispatch.readBoundary.canWriteCandidates === true, "dispatch should prepare candidate archives");
assert(dispatch.readBoundary.canWriteApprovedVisuals === false, "dispatch must not write approved visuals");
assert(dispatch.readBoundary.canWriteTrainingSamples === false, "dispatch must not write training samples");
assert(dispatch.readBoundary.canBypassRuntimePageGate === false, "dispatch must not bypass page gate");
assert(dispatch.nextRequiredPipelines.aiPainterCommandConfiguration === true, "dispatch must require AI Painter command configuration");
assert(dispatch.nextRequiredPipelines.aiPainterGeneration === true, "dispatch must require AI Painter generation");
assert(dispatch.nextRequiredPipelines.autoStructureReview === false, "auto review must wait for generated images");

const batchEntriesByCandidate = new Map(batch.entries.map((entry) => [entry.candidateId, entry]));

for (const entry of dispatch.entries) {
  const batchEntry = batchEntriesByCandidate.get(entry.candidateId);
  assert(batchEntry, `candidate not found in source batch: ${entry.candidateId}`);
  assert(entry.inputPayloadHash === batchEntry.inputPayloadHash, `input hash mismatch: ${entry.candidateId}`);
  assert(entry.status === "generation_pending", `candidate should be generation_pending: ${entry.candidateId}`);
  assert(entry.blockedReason === "missing LIVE_WORLD_AI_PAINTER_COMMAND", `blocked reason mismatch: ${entry.candidateId}`);

  const candidateInput = JSON.parse(await readFile(path.join(root, entry.candidateInputPath), "utf8"));
  const candidateMeta = JSON.parse(await readFile(path.join(root, entry.candidateMetaPath), "utf8"));
  const outputMeta = JSON.parse(await readFile(path.join(root, entry.outputMetaPath), "utf8"));
  const imageExists = await fileExists(path.join(root, entry.expectedOutputImagePath));

  assert(candidateInput.inputPayloadHash === entry.inputPayloadHash, `candidate input hash mismatch: ${entry.candidateId}`);
  assert(candidateMeta.candidateId === entry.candidateId, `candidate meta id mismatch: ${entry.candidateId}`);
  assert(candidateMeta.stage === "P10", `candidate stage mismatch: ${entry.candidateId}`);
  assert(candidateMeta.status === "generation_pending", `candidate meta status mismatch: ${entry.candidateId}`);
  assert(candidateMeta.imageGenerated === false, `candidate must not be marked generated: ${entry.candidateId}`);
  assert(outputMeta.inputPayloadHash === entry.inputPayloadHash, `output meta hash mismatch: ${entry.candidateId}`);
  assert(outputMeta.imageGenerated === false, `output meta must not be generated: ${entry.candidateId}`);
  assert(outputMeta.status === "generation_pending", `output status mismatch: ${entry.candidateId}`);
  assert(imageExists === false, `output image must not be fabricated: ${entry.candidateId}`);
}

assert(latest.dispatchId === dispatch.dispatchId, "latest dispatchId mismatch");
assert(latest.status === dispatch.status, "latest status mismatch");
assert(latest.imageGeneratedCount === dispatch.imageGeneratedCount, "latest imageGeneratedCount mismatch");
assert(latest.canWriteApprovedVisuals === false, "latest must not write approved visuals");
assert(latest.canBypassRuntimePageGate === false, "latest must not bypass page gate");

console.log("P10 AI Painter dispatch check passed");
console.log(`dispatchId=${dispatch.dispatchId}`);
console.log(`status=${dispatch.status}`);
console.log(`candidateCount=${dispatch.candidateCount}`);
console.log(`imageGeneratedCount=${dispatch.imageGeneratedCount}`);
