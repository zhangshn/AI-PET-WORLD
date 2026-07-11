import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const batchPath = path.join(root, "data/live-world/visual-reviews/p11-active-chunks/p11-auto-visual-review-batch.json");

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const batch = await readJson(batchPath);

assert(batch.batchVersion === "live-world-p11-auto-visual-review-batch-v1", "invalid P11 batch version");
assert(batch.batchId === "p11-active-chunk-auto-visual-review-0001", "invalid P11 batch id");
assert(batch.status === "completed", "P11 batch should complete without structural failures");
assert(batch.candidateCount === 9, "P11 must review 9 active chunk candidates");
assert(batch.failCount === 0, "P11 should not have structural review failures after P10-C generation");
assert(batch.needsOwnerReviewCount >= 1, "Current generated images should require owner quality review");
assert(batch.forbiddenSideEffects.writesApprovedVisuals === false, "P11 must not write approved visuals");
assert(batch.forbiddenSideEffects.writesTrainingSamples === false, "P11 must not write training samples");
assert(batch.forbiddenSideEffects.bypassesRuntimePageGate === false, "P11 must not bypass runtime page gate");

for (const recordRef of batch.records) {
  const reviewPath = path.join(root, recordRef.reviewPath);
  assert(await fileExists(reviewPath), `missing review record: ${recordRef.candidateId}`);
  const review = await readJson(reviewPath);
  assert(review.reviewVersion === "live-world-p11-auto-visual-review-v1", `invalid review version: ${recordRef.candidateId}`);
  assert(review.stage === "P11", `invalid review stage: ${recordRef.candidateId}`);
  assert(review.candidateId === recordRef.candidateId, `candidate id mismatch: ${recordRef.candidateId}`);
  assert(review.status === recordRef.status, `status mismatch: ${recordRef.candidateId}`);
  assert(review.imageGenerated === true, `review must be for generated image: ${recordRef.candidateId}`);
  assert(await fileExists(path.join(root, review.outputImagePath)), `missing generated image: ${recordRef.candidateId}`);
  assert(typeof review.outputImageHash === "string" && review.outputImageHash.length === 64, `missing image hash: ${recordRef.candidateId}`);
  assert(review.canEnterManualReview === true, `candidate should enter manual review: ${recordRef.candidateId}`);
  assert(review.canEnterRuntime === false, `P11 must not allow runtime promotion: ${recordRef.candidateId}`);
  assert(review.trainingEligibility === "pending_review", `P11 must keep training pending: ${recordRef.candidateId}`);
  assert(review.approvedVisualPromotionAllowed === false, `P11 must not approve promotion: ${recordRef.candidateId}`);
  assert(review.manualReviewRequired === true, `P11 must require manual review: ${recordRef.candidateId}`);
  assert(review.visualQualityMetrics.width === 256, `unexpected image width: ${recordRef.candidateId}`);
  assert(review.visualQualityMetrics.height === 192, `unexpected image height: ${recordRef.candidateId}`);
  const checkIds = new Set(review.structureChecks.map((item) => item.checkId));
  for (const checkId of [
    "output.image.exists",
    "output.meta.generated",
    "output.image.hash",
    "candidate.meta.status",
    "input.hash.chain",
    "chunk.id.chain",
    "entity.summary.match",
    "terrain.mask.size",
    "image.dimensions",
    "image.quality.heuristics",
  ]) {
    assert(checkIds.has(checkId), `missing check ${checkId}: ${recordRef.candidateId}`);
  }
}

console.log("P11 auto visual review check passed");
console.log(`batchId=${batch.batchId}`);
console.log(`candidateCount=${batch.candidateCount}`);
console.log(`needsOwnerReviewCount=${batch.needsOwnerReviewCount}`);
