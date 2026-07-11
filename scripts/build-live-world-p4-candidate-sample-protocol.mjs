import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateId = "poc0-candidate-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const candidateInputPath = path.join(candidateDir, "input.chunk.json");
const candidateMetaPath = path.join(candidateDir, "candidate.meta.json");
const outputMetaPath = path.join(candidateDir, "output.meta.json");
const manualReviewPath = path.join(candidateDir, "manual-review.json");
const p4ManualReviewPath = path.join(candidateDir, "p4-manual-review.json");
const candidateArchivePath = path.join(candidateDir, "candidate.archive.json");
const candidateSampleDecisionPath = path.join(candidateDir, "sample-decision.json");
const outputImagePath = path.join(candidateDir, "output.image.png");

const pendingSampleDir = path.join(root, "data/world-samples/pending", candidateId);
const pendingSampleDecisionPath = path.join(pendingSampleDir, "sample-decision.json");
const rejectedSampleDir = path.join(root, "data/world-samples/rejected", candidateId);

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
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
const imageGenerated = await fileExists(outputImagePath);

const now = "2026-07-06T00:00:00.000Z";
const worldId = visualInput.worldId ?? null;
const worldStatePayloadHash = visualInput.worldStatePayloadHash ?? null;

const candidateArchive = {
  archiveVersion: "live-world-p4-candidate-archive-v1",
  candidateId,
  outputId: candidateMeta.outputId,
  stage: "P4",
  worldId,
  worldStatePayloadHash,
  chunkId: candidateMeta.chunkId,
  inputPayloadHash: candidateMeta.inputPayloadHash,
  sourceChunkStatePayloadHash: candidateMeta.sourceChunkStatePayloadHash,
  candidateMetaPath: projectPath(candidateMetaPath),
  candidateInputPath: projectPath(candidateInputPath),
  outputMetaPath: projectPath(outputMetaPath),
  manualReviewPath: projectPath(p4ManualReviewPath),
  sampleDecisionPath: projectPath(candidateSampleDecisionPath),
  outputFile: {
    imagePath: projectPath(outputImagePath),
    imageHash: null,
    width: null,
    height: null,
    generatedAt: outputMeta.generatedAt,
    imageGenerated,
  },
  status: "pending_owner_review",
  trainingEligibility: false,
  canEnterRuntime: false,
  createdAt: now,
  notes:
    "P4 protocol archive. This POC candidate has no generated image yet, so it is tracked as pending_review and cannot enter training or runtime.",
};

const p4ManualReview = {
  ...manualReview,
  reviewVersion: "live-world-p4-manual-review-v1",
  worldStatePayloadHash,
  imageGenerated,
  trainingEligibility: false,
  canEnterRuntime: false,
  structureIssues: imageGenerated ? manualReview.structureIssues : ["missing_output_image"],
  visualIssues: imageGenerated ? manualReview.visualIssues : ["not_generated"],
  decisionReason:
    "No generated output image exists yet. Keep this candidate in pending review; do not promote to positive or negative samples.",
};

const sampleDecision = {
  sampleDecisionVersion: "live-world-p4-sample-decision-v1",
  sampleId: "poc0-sample-decision-0001",
  candidateId,
  outputId: candidateMeta.outputId,
  worldId,
  worldStatePayloadHash,
  chunkId: candidateMeta.chunkId,
  inputPayloadHash: candidateMeta.inputPayloadHash,
  decision: "pending_review",
  trainingEligibility: "pending_review",
  sourceType: "generated",
  sourcePath: projectPath(candidateDir),
  licenseStatus: "do_not_train",
  positiveSamplePath: null,
  negativeSamplePath: null,
  rejectedSamplePath: projectPath(rejectedSampleDir),
  pendingReviewPath: projectPath(pendingSampleDir),
  candidateArchivePath: projectPath(candidateArchivePath),
  manualReviewPath: projectPath(p4ManualReviewPath),
  outputMetaPath: projectPath(outputMetaPath),
  outputImagePath: projectPath(outputImagePath),
  outputImageHash: null,
  decisionReason:
    "Candidate is structurally archived but has no real generated image and no owner pass/fail review. It must stay out of training.",
  decidedAt: now,
};

await mkdir(pendingSampleDir, { recursive: true });
await mkdir(path.join(root, "data/world-samples/rejected"), { recursive: true });
await writeFile(candidateArchivePath, `${JSON.stringify(candidateArchive, null, 2)}\n`, "utf8");
await writeFile(p4ManualReviewPath, `${JSON.stringify(p4ManualReview, null, 2)}\n`, "utf8");
await writeFile(candidateSampleDecisionPath, `${JSON.stringify(sampleDecision, null, 2)}\n`, "utf8");
await writeFile(pendingSampleDecisionPath, `${JSON.stringify(sampleDecision, null, 2)}\n`, "utf8");

console.log(`Wrote ${projectPath(candidateArchivePath)}`);
console.log(`Wrote ${projectPath(p4ManualReviewPath)}`);
console.log(`Wrote ${projectPath(candidateSampleDecisionPath)}`);
console.log(`Wrote ${projectPath(pendingSampleDecisionPath)}`);
console.log(`candidateId=${candidateId}`);
console.log(`decision=${sampleDecision.decision}`);
console.log(`trainingEligibility=${sampleDecision.trainingEligibility}`);
