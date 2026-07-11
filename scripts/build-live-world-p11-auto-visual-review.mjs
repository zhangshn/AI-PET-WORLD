import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";
const batchId = "p11-active-chunk-auto-visual-review-0001";
const commandRunPath = "data/live-world/visual-generation-dispatches/p10-active-chunks/ai-painter-command-run.json";
const reviewRoot = "data/live-world/visual-reviews/p11-active-chunks";
const batchPath = `${reviewRoot}/p11-auto-visual-review-batch.json`;
const latestPath = "data/live-world/visual-reviews/latest-p11-auto-visual-review-batch.json";

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function resolveProjectPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(resolveProjectPath(filePath), "utf8"));
}

async function writeJson(filePath, value) {
  const absolutePath = resolveProjectPath(filePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(resolveProjectPath(filePath))).digest("hex");
}

function countBy(items, key) {
  const result = {};
  for (const item of items) {
    const value = item[key] ?? "unknown";
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

function summarizeNeighborEdges(neighborContext = {}) {
  const result = {};
  for (const direction of ["north", "south", "east", "west"]) {
    const edge = neighborContext[direction];
    result[direction] = edge
      ? `${edge.chunkId}:terrain=${edge.terrainEdge?.length ?? 0},biome=${edge.biomeEdge?.length ?? 0},movement=${edge.movementEdge?.length ?? 0},entities=${edge.entityEdgeHints?.length ?? 0}`
      : "missing";
  }
  return result;
}

function check(checkId, status, message, expected = null, actual = null) {
  return { checkId, status, expected, actual, message };
}

function sameCounts(expected, actual) {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual ?? {})]);
  for (const key of keys) {
    if ((expected[key] ?? 0) !== (actual?.[key] ?? 0)) return false;
  }
  return true;
}

async function imageMetrics(imagePath) {
  const image = sharp(resolveProjectPath(imagePath)).removeAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const luminance = [];
  const colorSet = new Set();

  let borderSum = 0;
  let borderCount = 0;
  let centerSum = 0;
  let centerCount = 0;
  const border = Math.max(4, Math.round(Math.min(width, height) * 0.06));
  const centerLeft = Math.round(width * 0.25);
  const centerRight = Math.round(width * 0.75);
  const centerTop = Math.round(height * 0.25);
  const centerBottom = Math.round(height * 0.75);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luminance.push(value);
      if (x < border || x >= width - border || y < border || y >= height - border) {
        borderSum += value;
        borderCount += 1;
      }
      if (x >= centerLeft && x < centerRight && y >= centerTop && y < centerBottom) {
        centerSum += value;
        centerCount += 1;
      }
      if (x % 4 === 0 && y % 4 === 0) {
        colorSet.add(`${r >> 3},${g >> 3},${b >> 3}`);
      }
    }
  }

  const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const variance = luminance.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminance.length;
  const centerMean = centerSum / Math.max(1, centerCount);
  const borderMean = borderSum / Math.max(1, borderCount);

  return {
    width: metadata.width ?? width,
    height: metadata.height ?? height,
    luminanceMean: round(mean),
    luminanceStdDev: round(Math.sqrt(variance)),
    borderLuminanceMean: round(borderMean),
    centerLuminanceMean: round(centerMean),
    darkBorderRatio: round(borderMean / Math.max(1, centerMean)),
    horizontalGridRatio: round(gridRatio(data, width, height, channels, "horizontal")),
    verticalGridRatio: round(gridRatio(data, width, height, channels, "vertical")),
    uniqueColorRatio: round(colorSet.size / Math.max(1, Math.ceil(width / 4) * Math.ceil(height / 4))),
  };
}

function gridRatio(data, width, height, channels, direction) {
  const step = direction === "vertical" ? 8 : 6;
  let gridDiff = 0;
  let gridCount = 0;
  let normalDiff = 0;
  let normalCount = 0;

  const pixelDiff = (x1, y1, x2, y2) => {
    const a = (y1 * width + x1) * channels;
    const b = (y2 * width + x2) * channels;
    return (
      Math.abs(data[a] - data[b]) +
      Math.abs(data[a + 1] - data[b + 1]) +
      Math.abs(data[a + 2] - data[b + 2])
    ) / 3;
  };

  if (direction === "vertical") {
    for (let x = 1; x < width; x += 1) {
      for (let y = 0; y < height; y += 2) {
        const diff = pixelDiff(x - 1, y, x, y);
        if (x % step === 0) {
          gridDiff += diff;
          gridCount += 1;
        } else {
          normalDiff += diff;
          normalCount += 1;
        }
      }
    }
  } else {
    for (let y = 1; y < height; y += 1) {
      for (let x = 0; x < width; x += 2) {
        const diff = pixelDiff(x, y - 1, x, y);
        if (y % step === 0) {
          gridDiff += diff;
          gridCount += 1;
        } else {
          normalDiff += diff;
          normalCount += 1;
        }
      }
    }
  }

  return (gridDiff / Math.max(1, gridCount)) / Math.max(1, normalDiff / Math.max(1, normalCount));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function visualIssuesFromMetrics(metrics, input) {
  const issues = [];
  if (metrics.darkBorderRatio < 0.82) issues.push("dark_border");
  if (metrics.horizontalGridRatio > 1.18 || metrics.verticalGridRatio > 1.18) issues.push("visible_grid_pattern");
  if (metrics.uniqueColorRatio < 0.08) issues.push("repeated_texture");
  if (metrics.luminanceStdDev < 24) issues.push("muddy_texture");
  const hasWater = input.terrainMask.some((row) => row.some((value) => ["water", "water_body", "river", "pond", "stream"].includes(value)));
  if (hasWater && metrics.luminanceStdDev < 36) issues.push("water_artifact");
  return [...new Set(issues)];
}

async function buildReview(entry) {
  const candidateRoot = path.dirname(entry.outputImagePath).replaceAll("\\", "/");
  const input = await readJson(entry.inputPath);
  const candidateMeta = await readJson(`${candidateRoot}/candidate.meta.json`);
  const outputMeta = await readJson(entry.outputMetaPath);
  const hash = await sha256File(entry.outputImagePath);
  const metrics = await imageMetrics(entry.outputImagePath);
  const expectedEntityCounts = countBy(input.entityMap, "entityType");
  const terrainMaskSummary = countGridValues(input.terrainMask);
  const neighborEdgeSummary = summarizeNeighborEdges(input.neighborContext);
  const entitySummaryMatches = sameCounts(expectedEntityCounts, outputMeta.entitySummary);
  const visualIssues = visualIssuesFromMetrics(metrics, input);

  const structureChecks = [
    check("output.image.exists", "pass", "Output image exists.", true, true),
    check("output.meta.generated", outputMeta.imageGenerated === true && outputMeta.status === "generated" ? "pass" : "fail", "Output metadata must mark the image as generated.", "generated", `${outputMeta.status}|${outputMeta.imageGenerated}`),
    check("output.image.hash", hash === entry.imageHash && hash === outputMeta.outputImageHash ? "pass" : "fail", "Output image hash must match command run and output metadata.", entry.imageHash, `${hash}|${outputMeta.outputImageHash}`),
    check("candidate.meta.status", candidateMeta.status === "pending_structure_review" ? "pass" : "fail", "Candidate must still be waiting for structure review.", "pending_structure_review", candidateMeta.status),
    check("input.hash.chain", candidateMeta.inputPayloadHash === input.inputPayloadHash ? "pass" : "fail", "Candidate input hash must match ChunkVisualInput.", input.inputPayloadHash, candidateMeta.inputPayloadHash),
    check("chunk.id.chain", candidateMeta.chunkId === input.chunkId && outputMeta.chunkId === input.chunkId ? "pass" : "fail", "Chunk id must match input, candidate metadata, and output metadata.", input.chunkId, `${candidateMeta.chunkId}|${outputMeta.chunkId}`),
    check("entity.summary.match", entitySummaryMatches ? "pass" : "fail", "Output metadata entity summary must match input entityMap counts.", JSON.stringify(expectedEntityCounts), JSON.stringify(outputMeta.entitySummary ?? {})),
    check("terrain.mask.size", input.terrainMask.length === input.tileHeight && input.terrainMask.every((row) => row.length === input.tileWidth) ? "pass" : "fail", "Terrain mask must match tile dimensions.", `${input.tileWidth}x${input.tileHeight}`, `${input.terrainMask[0]?.length ?? 0}x${input.terrainMask.length}`),
    check("image.dimensions", metrics.width === 256 && metrics.height === 192 ? "pass" : "fail", "Generated image must match current local model output size.", "256x192", `${metrics.width}x${metrics.height}`),
    check("image.quality.heuristics", visualIssues.length === 0 ? "pass" : "skipped", "Visual quality issues are recorded for owner review and do not auto-promote.", "no issues", visualIssues.join(",")),
  ];

  const structureIssues = [];
  if (!entitySummaryMatches) structureIssues.push("output_meta_mismatch");
  if (hash !== entry.imageHash || hash !== outputMeta.outputImageHash) structureIssues.push("output_hash_mismatch");
  if (structureChecks.some((item) => item.status === "fail")) structureIssues.push("candidate_file_missing");

  const hasStructureFailure = structureChecks.some((item) => item.status === "fail");
  const conclusion = hasStructureFailure ? "fail" : visualIssues.length > 0 ? "needs_owner_review" : "pass";
  const status = conclusion === "fail" ? "fail" : visualIssues.length > 0 ? "needs_owner_review" : "pass";
  const reviewPath = `${reviewRoot}/${entry.candidateId}/auto-visual-review.json`;

  const review = {
    reviewVersion: "live-world-p11-auto-visual-review-v1",
    reviewId: `${entry.candidateId}-p11-auto-review-0001`,
    stage: "P11",
    candidateId: entry.candidateId,
    outputId: candidateMeta.outputId,
    inputPayloadHash: input.inputPayloadHash,
    reviewType: "auto",
    reviewer: "system",
    status,
    structureIssues: [...new Set(structureIssues)],
    visualIssues,
    candidateRoot,
    candidateMetaPath: `${candidateRoot}/candidate.meta.json`,
    outputMetaPath: entry.outputMetaPath,
    candidateMetaPathForRuntime: candidateMeta.metaPath,
    notes: visualIssues.length > 0
      ? "P11 automatic review generated visual quality flags. Candidate requires owner review before any promotion."
      : "P11 automatic review did not find blocking visual quality flags. Candidate still requires owner review before promotion.",
    reviewedAt: now,
    worldId: null,
    worldStatePayloadHash: candidateMeta.sourceWorldStatePayloadHash,
    sourceChunkStatePayloadHash: "p10-active-chunk-visual-input",
    imageGenerated: true,
    outputImagePath: entry.outputImagePath,
    outputImageHash: hash,
    expectedEntityCounts,
    terrainMaskSummary,
    neighborEdgeSummary,
    structureChecks,
    conclusion,
    trainingEligibility: "pending_review",
    canEnterManualReview: true,
    canEnterRuntime: false,
    recommendedSampleDecision: status === "fail" ? "rejected" : "pending_review",
    decisionReason: status === "fail"
      ? "Structural metadata checks failed."
      : "Generated candidate requires owner review. Automatic review cannot approve runtime or training use.",
    visualQualityMetrics: metrics,
    manualReviewRequired: true,
    approvedVisualPromotionAllowed: false,
  };

  await writeJson(reviewPath, review);
  return {
    candidateId: entry.candidateId,
    chunkId: entry.chunkId,
    reviewPath,
    status,
    conclusion,
    structureIssues: review.structureIssues,
    visualIssues,
  };
}

const commandRun = await readJson(commandRunPath);
if (commandRun.status !== "completed") {
  throw new Error(`P11 requires a completed P10 command run, got: ${commandRun.status}`);
}

const records = [];
for (const entry of commandRun.entries) {
  records.push(await buildReview(entry));
}

const batch = {
  batchVersion: "live-world-p11-auto-visual-review-batch-v1",
  batchId,
  sourceCommandRunPath: commandRunPath,
  status: records.some((record) => record.status === "fail") ? "failed" : "completed",
  candidateCount: records.length,
  passCount: records.filter((record) => record.status === "pass").length,
  failCount: records.filter((record) => record.status === "fail").length,
  needsOwnerReviewCount: records.filter((record) => record.status === "needs_owner_review").length,
  records,
  forbiddenSideEffects: {
    writesApprovedVisuals: false,
    writesTrainingSamples: false,
    bypassesRuntimePageGate: false,
  },
  createdAt: now,
};

await writeJson(batchPath, batch);
await writeJson(latestPath, {
  batchId,
  status: batch.status,
  candidateCount: batch.candidateCount,
  passCount: batch.passCount,
  failCount: batch.failCount,
  needsOwnerReviewCount: batch.needsOwnerReviewCount,
  batchPath,
  createdAt: now,
});

console.log(`Wrote ${batchPath}`);
console.log(`batchId=${batchId}`);
console.log(`status=${batch.status}`);
console.log(`candidateCount=${batch.candidateCount}`);
console.log(`needsOwnerReviewCount=${batch.needsOwnerReviewCount}`);
