import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateId = "poc0-candidate-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const candidateMetaPath = path.join(candidateDir, "candidate.meta.json");
const manualReviewPath = path.join(candidateDir, "manual-review.json");
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

const candidateMeta = JSON.parse(await readFile(candidateMetaPath, "utf8"));
const manualReview = JSON.parse(await readFile(manualReviewPath, "utf8"));

assert(manualReview.reviewVersion === "live-world-poc0-manual-review-v1", "invalid manual review version");
assert(manualReview.reviewId === "poc0-review-0001", "reviewId mismatch");
assert(manualReview.candidateId === candidateMeta.candidateId, "candidateId mismatch");
assert(manualReview.outputId === candidateMeta.outputId, "outputId mismatch");
assert(manualReview.inputPayloadHash === candidateMeta.inputPayloadHash, "input hash mismatch");
assert(manualReview.reviewType === "manual", "reviewType must be manual");
assert(manualReview.reviewer === "owner", "reviewer must be owner");
assert(manualReview.status === "needs_owner_review", "P1 review placeholder must remain needs_owner_review");
assert(Array.isArray(manualReview.structureIssues), "structureIssues must be an array");
assert(Array.isArray(manualReview.visualIssues), "visualIssues must be an array");
assert(manualReview.candidateMetaPath === "data/world-visual-candidates/poc0-candidate-0001/candidate.meta.json", "candidateMetaPath mismatch");
assert(!(await fileExists(positiveSampleDir)), "P1 manual review must not create a positive sample");
assert(!(await fileExists(negativeSampleDir)), "P1 manual review must not create a negative sample");

console.log("POC-0 manual review check passed");
console.log(`reviewId=${manualReview.reviewId}`);
console.log(`status=${manualReview.status}`);
console.log(`inputPayloadHash=${manualReview.inputPayloadHash}`);
