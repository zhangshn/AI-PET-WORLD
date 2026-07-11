import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const candidateId = "poc0-candidate-0001";
const candidateDir = path.join(root, "data/world-visual-candidates", candidateId);
const inputPath = path.join(candidateDir, "input.chunk.json");
const archivePath = path.join(candidateDir, "candidate.archive.json");
const outputMetaPath = path.join(candidateDir, "output.meta.json");
const sampleDecisionPath = path.join(candidateDir, "sample-decision.json");
const autoReviewPath = path.join(candidateDir, "auto-structure-review.json");

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

function countBy(items, key) {
  const result = {};
  for (const item of items) {
    const value = item[key];
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function countGridValues(grid) {
  const result = {};
  for (const row of grid) {
    for (const value of row) {
      result[value] = (result[value] ?? 0) + 1;
    }
  }
  return result;
}

function summarizeNeighborEdges(neighborContext) {
  const result = {};
  for (const direction of ["north", "south", "east", "west"]) {
    const edge = neighborContext[direction];
    result[direction] = edge
      ? `${edge.chunkId}:terrain=${edge.terrainEdge.length},biome=${edge.biomeEdge.length},movement=${edge.movementEdge.length},entities=${edge.entityEdgeHints.length}`
      : "missing";
  }
  return result;
}

function check(checkId, status, message, expected = null, actual = null) {
  return {
    checkId,
    status,
    expected,
    actual,
    message,
  };
}

const visualInput = JSON.parse(await readFile(inputPath, "utf8"));
const archive = JSON.parse(await readFile(archivePath, "utf8"));
const outputMeta = JSON.parse(await readFile(outputMetaPath, "utf8"));
const sampleDecision = JSON.parse(await readFile(sampleDecisionPath, "utf8"));

const outputImageAbsolutePath = path.join(root, outputMeta.imagePath);
const imageExists = await fileExists(outputImageAbsolutePath);
const imageGenerated = Boolean(outputMeta.imageGenerated && imageExists);
const expectedEntityCounts = countBy(visualInput.entityMap, "entityType");
const terrainMaskSummary = countGridValues(visualInput.terrainMask);
const neighborEdgeSummary = summarizeNeighborEdges(visualInput.neighborContext);

const structureChecks = [
  check(
    "output.image.exists",
    imageExists ? "pass" : "fail",
    imageExists ? "Output image exists." : "Output image is missing; image-based structure review cannot continue.",
    true,
    imageExists,
  ),
  check(
    "output.meta.imageGenerated",
    outputMeta.imageGenerated === true ? "pass" : "fail",
    outputMeta.imageGenerated === true
      ? "Output metadata marks image as generated."
      : "Output metadata still marks image as not generated.",
    true,
    outputMeta.imageGenerated,
  ),
  check(
    "output.image.hash",
    archive.outputFile.imageHash ? "pass" : "fail",
    archive.outputFile.imageHash
      ? "Output image hash is present."
      : "Output image hash is missing.",
    "non-empty sha256",
    archive.outputFile.imageHash,
  ),
  check(
    "input.hash.chain",
    archive.inputPayloadHash === visualInput.inputPayloadHash &&
      outputMeta.inputPayloadHash === visualInput.inputPayloadHash &&
      sampleDecision.inputPayloadHash === visualInput.inputPayloadHash
      ? "pass"
      : "fail",
    "Input payload hash must match across visual input, archive, output metadata, and sample decision.",
    visualInput.inputPayloadHash,
    `${archive.inputPayloadHash}|${outputMeta.inputPayloadHash}|${sampleDecision.inputPayloadHash}`,
  ),
  check(
    "chunk.id.chain",
    archive.chunkId === visualInput.chunkId &&
      outputMeta.chunkId === visualInput.chunkId &&
      sampleDecision.chunkId === visualInput.chunkId
      ? "pass"
      : "fail",
    "Chunk id must match across visual input, archive, output metadata, and sample decision.",
    visualInput.chunkId,
    `${archive.chunkId}|${outputMeta.chunkId}|${sampleDecision.chunkId}`,
  ),
  check(
    "entity.count.input",
    Object.values(expectedEntityCounts).reduce((sum, value) => sum + value, 0) === visualInput.entityMap.length
      ? "pass"
      : "fail",
    "Input entity count summary must match entityMap length.",
    visualInput.entityMap.length,
    Object.values(expectedEntityCounts).reduce((sum, value) => sum + value, 0),
  ),
  check(
    "terrain.mask.size",
    visualInput.terrainMask.length === visualInput.tileHeight &&
      visualInput.terrainMask.every((row) => row.length === visualInput.tileWidth)
      ? "pass"
      : "fail",
    "Terrain mask must match tile dimensions.",
    `${visualInput.tileWidth}x${visualInput.tileHeight}`,
    `${visualInput.terrainMask[0]?.length ?? 0}x${visualInput.terrainMask.length}`,
  ),
  check(
    "neighbor.edges.present",
    ["north", "south", "east", "west"].every((direction) => visualInput.neighborContext[direction])
      ? "pass"
      : "fail",
    "All four neighbor edge contexts must be present.",
    "north,south,east,west",
    Object.keys(visualInput.neighborContext).sort().join(","),
  ),
  check(
    "image.entity.count.compare",
    imageGenerated ? "skipped" : "blocked",
    imageGenerated
      ? "Image entity count comparison is deferred to the vision judge."
      : "No generated image exists, so visual entity count comparison is blocked.",
  ),
  check(
    "image.mask.compare",
    imageGenerated ? "skipped" : "blocked",
    imageGenerated
      ? "Image mask comparison is deferred to the vision judge."
      : "No generated image exists, so water/path/shoreline visual mask comparison is blocked.",
  ),
  check(
    "image.forbidden.resources",
    imageGenerated ? "skipped" : "blocked",
    imageGenerated
      ? "Forbidden-resource image detection is deferred to the vision judge."
      : "No generated image exists, so forbidden interactive resource detection is blocked.",
  ),
];

const hasFailure = structureChecks.some((item) => item.status === "fail");
const hasBlocked = structureChecks.some((item) => item.status === "blocked");
const conclusion = hasFailure ? "fail" : hasBlocked ? "blocked_pending_output" : "pass";

const autoReview = {
  reviewVersion: "live-world-p5-auto-structure-review-v1",
  reviewId: "poc0-auto-structure-review-0001",
  candidateId: archive.candidateId,
  outputId: archive.outputId,
  inputPayloadHash: visualInput.inputPayloadHash,
  reviewType: "auto",
  reviewer: "system",
  status: conclusion === "pass" ? "pass" : "fail",
  structureIssues: imageGenerated ? [] : ["missing_output_image", "missing_output_hash"],
  visualIssues: imageGenerated ? [] : ["not_generated"],
  candidateMetaPath: archive.candidateMetaPath,
  notes:
    "P5 automatic structure review. Current POC has no generated output image, so image-based structure checks are blocked and the candidate cannot train or enter runtime.",
  reviewedAt: "2026-07-06T00:00:00.000Z",
  worldId: archive.worldId,
  worldStatePayloadHash: archive.worldStatePayloadHash,
  sourceChunkStatePayloadHash: archive.sourceChunkStatePayloadHash,
  imageGenerated,
  outputImagePath: outputMeta.imagePath,
  outputImageHash: archive.outputFile.imageHash,
  expectedEntityCounts,
  terrainMaskSummary,
  neighborEdgeSummary,
  structureChecks,
  conclusion,
  trainingEligibility: "not_trainable",
  canEnterManualReview: false,
  canEnterRuntime: false,
  recommendedSampleDecision: sampleDecision.decision,
  decisionReason:
    "Missing generated output image and image hash. Keep the candidate in pending_review and out of training/runtime.",
};

await writeFile(autoReviewPath, `${JSON.stringify(autoReview, null, 2)}\n`, "utf8");

console.log(`Wrote ${projectPath(autoReviewPath)}`);
console.log(`candidateId=${autoReview.candidateId}`);
console.log(`conclusion=${autoReview.conclusion}`);
console.log(`trainingEligibility=${autoReview.trainingEligibility}`);
console.log(`entityTypes=${Object.keys(expectedEntityCounts).length}`);
