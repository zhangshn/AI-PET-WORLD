import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateId = "poc0-candidate-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const candidateInputPath = path.join(candidateDir, "input.chunk.json");
const candidateMetaPath = path.join(candidateDir, "candidate.meta.json");
const outputMetaPath = path.join(candidateDir, "output.meta.json");
const manualReviewPath = path.join(candidateDir, "p4-manual-review.json");
const candidateArchivePath = path.join(candidateDir, "candidate.archive.json");
const candidateSampleDecisionPath = path.join(candidateDir, "sample-decision.json");
const pendingSampleDecisionPath = path.join(
  root,
  "data/world-samples/pending",
  candidateId,
  "sample-decision.json",
);
const outputImagePath = path.join(candidateDir, "output.image.png");
const positiveSampleDir = path.join(root, "data/world-samples/positive", candidateId);
const negativeSampleDir = path.join(root, "data/world-samples/negative", candidateId);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const visualInput = JSON.parse(await readFile(candidateInputPath, "utf8"));
const candidateMeta = JSON.parse(await readFile(candidateMetaPath, "utf8"));
const outputMeta = JSON.parse(await readFile(outputMetaPath, "utf8"));
const manualReview = JSON.parse(await readFile(manualReviewPath, "utf8"));
const candidateArchive = JSON.parse(await readFile(candidateArchivePath, "utf8"));
const candidateSampleDecision = JSON.parse(await readFile(candidateSampleDecisionPath, "utf8"));
const pendingSampleDecision = JSON.parse(await readFile(pendingSampleDecisionPath, "utf8"));

assert(candidateArchive.archiveVersion === "live-world-p4-candidate-archive-v1", "invalid P4 archive version");
assert(candidateArchive.candidateId === candidateId, "archive candidateId mismatch");
assert(candidateArchive.outputId === candidateMeta.outputId, "archive outputId mismatch");
assert(candidateArchive.stage === "P4", "archive stage must be P4");
assert(candidateArchive.chunkId === candidateMeta.chunkId, "archive chunkId mismatch");
assert(candidateArchive.inputPayloadHash === visualInput.inputPayloadHash, "archive input hash mismatch");
assert(
  candidateArchive.sourceChunkStatePayloadHash === visualInput.sourceChunkStatePayloadHash,
  "archive source chunk state hash mismatch",
);
assert(candidateArchive.trainingEligibility === false, "archive must not be trainable");
assert(candidateArchive.canEnterRuntime === false, "archive must not enter runtime");
assert(candidateArchive.outputFile.imageGenerated === false, "P4 POC candidate must not have a generated image");
assert(candidateArchive.outputFile.imageHash === null, "missing generated image must have null image hash");

assert(manualReview.reviewVersion === "live-world-p4-manual-review-v1", "invalid P4 manual review version");
assert(manualReview.status === "needs_owner_review", "P4 POC review must stay needs_owner_review");
assert(manualReview.trainingEligibility === false, "P4 review must not be trainable");
assert(manualReview.canEnterRuntime === false, "P4 review must not enter runtime");
assert(manualReview.structureIssues.includes("missing_output_image"), "missing output image issue is required");
assert(manualReview.visualIssues.includes("not_generated"), "not generated visual issue is required");

for (const sampleDecision of [candidateSampleDecision, pendingSampleDecision]) {
  assert(sampleDecision.sampleDecisionVersion === "live-world-p4-sample-decision-v1", "invalid sample decision version");
  assert(sampleDecision.candidateId === candidateId, "sample decision candidateId mismatch");
  assert(sampleDecision.outputId === candidateMeta.outputId, "sample decision outputId mismatch");
  assert(sampleDecision.chunkId === candidateMeta.chunkId, "sample decision chunkId mismatch");
  assert(sampleDecision.inputPayloadHash === visualInput.inputPayloadHash, "sample decision input hash mismatch");
  assert(sampleDecision.decision === "pending_review", "P4 POC sample decision must be pending_review");
  assert(sampleDecision.trainingEligibility === "pending_review", "P4 POC sample must remain pending review");
  assert(sampleDecision.licenseStatus === "do_not_train", "pending review sample must not train");
  assert(sampleDecision.positiveSamplePath === null, "pending review must not have positive path");
  assert(sampleDecision.negativeSamplePath === null, "pending review must not have negative path");
  assert(sampleDecision.outputImageHash === null, "pending review without image must have null image hash");
}

assert(JSON.stringify(candidateSampleDecision) === JSON.stringify(pendingSampleDecision), "candidate and pending sample decisions must match");
assert(outputMeta.imageGenerated === false, "P4 POC output placeholder must not be generated");
assert(!(await fileExists(outputImagePath)), "P4 POC must not contain a fake output image");
assert(!(await fileExists(positiveSampleDir)), "P4 pending review must not create positive sample directory");
assert(!(await fileExists(negativeSampleDir)), "P4 pending review must not create negative sample directory");

console.log("P4 candidate sample protocol check passed");
console.log(`candidateId=${candidateId}`);
console.log(`decision=${candidateSampleDecision.decision}`);
console.log(`trainingEligibility=${candidateSampleDecision.trainingEligibility}`);
