import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateId = "poc0-candidate-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const inputPath = path.join(candidateDir, "input.chunk.json");
const archivePath = path.join(candidateDir, "candidate.archive.json");
const outputMetaPath = path.join(candidateDir, "output.meta.json");
const sampleDecisionPath = path.join(candidateDir, "sample-decision.json");
const autoReviewPath = path.join(candidateDir, "auto-structure-review.json");
const outputImagePath = path.join(candidateDir, "output.image.png");

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

const visualInput = JSON.parse(await readFile(inputPath, "utf8"));
const archive = JSON.parse(await readFile(archivePath, "utf8"));
const outputMeta = JSON.parse(await readFile(outputMetaPath, "utf8"));
const sampleDecision = JSON.parse(await readFile(sampleDecisionPath, "utf8"));
const autoReview = JSON.parse(await readFile(autoReviewPath, "utf8"));

assert(autoReview.reviewVersion === "live-world-p5-auto-structure-review-v1", "invalid auto review version");
assert(autoReview.reviewType === "auto", "reviewType must be auto");
assert(autoReview.reviewer === "system", "reviewer must be system");
assert(autoReview.candidateId === candidateId, "candidateId mismatch");
assert(autoReview.outputId === archive.outputId, "outputId mismatch");
assert(autoReview.inputPayloadHash === visualInput.inputPayloadHash, "inputPayloadHash mismatch");
assert(autoReview.sourceChunkStatePayloadHash === archive.sourceChunkStatePayloadHash, "sourceChunkStatePayloadHash mismatch");
assert(autoReview.imageGenerated === false, "POC output must not be marked imageGenerated");
assert(autoReview.outputImagePath === outputMeta.imagePath, "output image path mismatch");
assert(autoReview.outputImageHash === null, "POC output image hash must be null");
assert(autoReview.status === "fail", "POC auto review must fail until output image exists");
assert(autoReview.conclusion === "fail", "POC auto review conclusion must fail until output image exists");
assert(autoReview.trainingEligibility === "not_trainable", "failed auto review must not train");
assert(autoReview.canEnterManualReview === false, "missing image cannot enter manual visual review");
assert(autoReview.canEnterRuntime === false, "failed auto review cannot enter runtime");
assert(autoReview.recommendedSampleDecision === sampleDecision.decision, "recommended sample decision mismatch");
assert(autoReview.structureIssues.includes("missing_output_image"), "missing output image issue is required");
assert(autoReview.structureIssues.includes("missing_output_hash"), "missing output hash issue is required");
assert(autoReview.visualIssues.includes("not_generated"), "not generated visual issue is required");
assert(!(await fileExists(outputImagePath)), "POC must not contain a fake output image");

for (const type of ["tree", "rock", "grass_clump", "flower", "reed"]) {
  assert(Number.isInteger(autoReview.expectedEntityCounts[type]), `missing expected entity count for ${type}`);
}

assert(autoReview.expectedEntityCounts.tree === 3, "tree count mismatch");
assert(autoReview.expectedEntityCounts.rock === 2, "rock count mismatch");
assert(autoReview.expectedEntityCounts.grass_clump === 6, "grass_clump count mismatch");
assert(autoReview.expectedEntityCounts.flower === 5, "flower count mismatch");
assert(autoReview.expectedEntityCounts.reed === 4, "reed count mismatch");

for (const terrain of ["grass", "water", "shoreline", "dirt_path"]) {
  assert(Number.isInteger(autoReview.terrainMaskSummary[terrain]), `missing terrain summary for ${terrain}`);
}

for (const direction of ["north", "south", "east", "west"]) {
  assert(typeof autoReview.neighborEdgeSummary[direction] === "string", `missing neighbor edge summary for ${direction}`);
}

const checkIds = new Set(autoReview.structureChecks.map((item) => item.checkId));
for (const requiredCheck of [
  "output.image.exists",
  "output.meta.imageGenerated",
  "output.image.hash",
  "input.hash.chain",
  "chunk.id.chain",
  "entity.count.input",
  "terrain.mask.size",
  "neighbor.edges.present",
  "image.entity.count.compare",
  "image.mask.compare",
  "image.forbidden.resources",
]) {
  assert(checkIds.has(requiredCheck), `missing structure check ${requiredCheck}`);
}

const failedChecks = autoReview.structureChecks.filter((item) => item.status === "fail");
const blockedChecks = autoReview.structureChecks.filter((item) => item.status === "blocked");
assert(failedChecks.length === 3, "POC should have 3 failed output-file checks");
assert(blockedChecks.length === 3, "POC should have 3 blocked image-based checks");

console.log("P5 auto structure review check passed");
console.log(`candidateId=${autoReview.candidateId}`);
console.log(`conclusion=${autoReview.conclusion}`);
console.log(`failedChecks=${failedChecks.length}`);
console.log(`blockedChecks=${blockedChecks.length}`);
