import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateId = "poc0-candidate-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const candidateMetaPath = path.join(candidateDir, "candidate.meta.json");
const manualReviewPath = path.join(candidateDir, "manual-review.json");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

const candidateMeta = JSON.parse(await readFile(candidateMetaPath, "utf8"));

const manualReview = {
  reviewVersion: "live-world-poc0-manual-review-v1",
  reviewId: "poc0-review-0001",
  candidateId: candidateMeta.candidateId,
  outputId: candidateMeta.outputId,
  inputPayloadHash: candidateMeta.inputPayloadHash,
  reviewType: "manual",
  reviewer: "owner",
  status: "needs_owner_review",
  structureIssues: [],
  visualIssues: [],
  candidateMetaPath: projectPath(candidateMetaPath),
  notes:
    "P1 manual review placeholder. Owner must replace status with pass or fail after a real generated image exists.",
  reviewedAt: "2026-07-06T00:00:00.000Z",
};

await writeFile(manualReviewPath, `${JSON.stringify(manualReview, null, 2)}\n`, "utf8");

console.log(`Wrote ${projectPath(manualReviewPath)}`);
console.log(`reviewId=${manualReview.reviewId}`);
console.log(`status=${manualReview.status}`);
console.log(`inputPayloadHash=${manualReview.inputPayloadHash}`);
