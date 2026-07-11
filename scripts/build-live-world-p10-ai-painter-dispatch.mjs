import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";
const dispatchId = "p10-ai-painter-dispatch-0001";

const batchPath = path.join(root, "data/live-world/visual-generation-requests/p10-active-chunks/generation-batch.json");
const dispatchRoot = path.join(root, "data/live-world/visual-generation-dispatches/p10-active-chunks");
const dispatchPath = path.join(dispatchRoot, "ai-painter-dispatch.json");
const latestPath = path.join(root, "data/live-world/visual-generation-dispatches/latest-ai-painter-dispatch.json");

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

const batch = JSON.parse(await readFile(batchPath, "utf8"));
const aiPainterCommand = process.env.LIVE_WORLD_AI_PAINTER_COMMAND?.trim() || null;
const dispatchStatus = aiPainterCommand
  ? "ready_to_execute"
  : "blocked_missing_ai_painter_command";

const entries = [];

for (const entry of batch.entries) {
  const visualInputPath = path.join(root, entry.visualInputPath);
  const visualInput = JSON.parse(await readFile(visualInputPath, "utf8"));
  const candidateRoot = path.join(root, entry.expectedCandidateRoot);
  const candidateInputPath = path.join(candidateRoot, "input.chunk.json");
  const candidateMetaPath = path.join(candidateRoot, "candidate.meta.json");
  const outputMetaPath = path.join(candidateRoot, "output.meta.json");
  const outputImagePath = path.join(candidateRoot, "output.image.png");
  const imageGenerated = await fileExists(outputImagePath);

  const candidateMeta = {
    candidateVersion: "live-world-p10-ai-painter-candidate-dispatch-v1",
    candidateId: entry.candidateId,
    outputId: `${entry.candidateId}-output-0001`,
    inputPayloadHash: entry.inputPayloadHash,
    sourceWorldStatePayloadHash: batch.sourceWorldStatePayloadHash,
    chunkId: entry.chunkId,
    chunkX: entry.chunkX,
    chunkY: entry.chunkY,
    imagePath: projectPath(outputImagePath),
    metaPath: projectPath(candidateMetaPath),
    outputMetaPath: projectPath(outputMetaPath),
    status: imageGenerated ? "pending_structure_review" : "generation_pending",
    stage: "P10",
    imageGenerated,
    createdAt: now,
    notes: aiPainterCommand
      ? "P10 dispatch candidate is ready for AI Painter execution."
      : "P10 dispatch candidate is blocked because LIVE_WORLD_AI_PAINTER_COMMAND is not configured.",
  };

  const outputMeta = {
    outputId: candidateMeta.outputId,
    outputVersion: "live-world-p10-ai-painter-output-dispatch-v1",
    inputPayloadHash: entry.inputPayloadHash,
    chunkId: entry.chunkId,
    imagePath: candidateMeta.imagePath,
    modelVersion: aiPainterCommand ? "configured-by-live-world-ai-painter-command" : "not-generated",
    promptVersion: "live-world-p10-active-chunk-visual-input-v1",
    generatedAt: imageGenerated ? now : null,
    status: imageGenerated ? "generated" : "generation_pending",
    imageGenerated,
    reason: imageGenerated
      ? "Output image exists and is ready for automatic structure review."
      : aiPainterCommand
        ? "AI Painter command is configured but this script has not executed image generation yet."
        : "Missing LIVE_WORLD_AI_PAINTER_COMMAND. Candidate archive skeleton is prepared, but no image is generated.",
  };

  await mkdir(candidateRoot, { recursive: true });
  await writeFile(candidateInputPath, `${JSON.stringify(visualInput, null, 2)}\n`, "utf8");
  await writeFile(candidateMetaPath, `${JSON.stringify(candidateMeta, null, 2)}\n`, "utf8");
  await writeFile(outputMetaPath, `${JSON.stringify(outputMeta, null, 2)}\n`, "utf8");

  entries.push({
    requestId: entry.requestId,
    candidateId: entry.candidateId,
    chunkId: entry.chunkId,
    inputPayloadHash: entry.inputPayloadHash,
    candidateRoot: projectPath(candidateRoot),
    candidateInputPath: projectPath(candidateInputPath),
    candidateMetaPath: projectPath(candidateMetaPath),
    outputMetaPath: projectPath(outputMetaPath),
    expectedOutputImagePath: projectPath(outputImagePath),
    status: outputMeta.status,
    blockedReason: imageGenerated
      ? null
      : aiPainterCommand
        ? "image_not_generated_yet"
        : "missing LIVE_WORLD_AI_PAINTER_COMMAND",
  });
}

const imageGeneratedCount = entries.filter((entry) => entry.status === "generated").length;
const dispatch = {
  dispatchVersion: "live-world-p10-ai-painter-dispatch-v1",
  dispatchId,
  batchId: batch.batchId,
  status: imageGeneratedCount === entries.length
    ? "executed"
    : dispatchStatus,
  aiPainterCommand,
  entries,
  candidateCount: entries.length,
  imageGeneratedCount,
  readBoundary: {
    sourceBatchPath: projectPath(batchPath),
    allowedWriteRoots: [
      "data/world-visual-candidates",
      "data/live-world/visual-generation-dispatches",
    ],
    forbiddenWriteRoots: [
      "data/live-world/approved-visuals",
      "data/world-samples/positive",
      "data/world-samples/negative",
      "data/world-samples/pending",
      "data/world-samples/rejected",
      "data/world-runs",
    ],
    canWriteCandidates: true,
    canWriteApprovedVisuals: false,
    canWriteTrainingSamples: false,
    canBypassRuntimePageGate: false,
  },
  nextRequiredPipelines: {
    aiPainterCommandConfiguration: !aiPainterCommand,
    aiPainterGeneration: imageGeneratedCount < entries.length,
    autoStructureReview: imageGeneratedCount === entries.length,
    ownerReview: false,
    approvedVisualPromotion: false,
    runtimePageGateRefresh: false,
  },
  createdAt: now,
};

await mkdir(dispatchRoot, { recursive: true });
await writeFile(dispatchPath, `${JSON.stringify(dispatch, null, 2)}\n`, "utf8");
await writeFile(
  latestPath,
  `${JSON.stringify(
    {
      dispatchId,
      batchId: batch.batchId,
      status: dispatch.status,
      dispatchPath: projectPath(dispatchPath),
      candidateCount: dispatch.candidateCount,
      imageGeneratedCount: dispatch.imageGeneratedCount,
      canWriteApprovedVisuals: false,
      canWriteTrainingSamples: false,
      canBypassRuntimePageGate: false,
      createdAt: now,
    },
    null,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${projectPath(dispatchPath)}`);
console.log(`dispatchId=${dispatch.dispatchId}`);
console.log(`status=${dispatch.status}`);
console.log(`candidateCount=${dispatch.candidateCount}`);
console.log(`imageGeneratedCount=${dispatch.imageGeneratedCount}`);
console.log(`aiPainterCommand=${aiPainterCommand ? "configured" : "missing"}`);
