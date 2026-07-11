import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runId = "live-world-p6-training-plan-0001";
const outputRoot = path.join(root, "data/world-runs", runId);
const manifestPath = path.join(outputRoot, "training-sample-manifest.json");
const runRecordPath = path.join(outputRoot, "training-run-record.json");
const latestPath = path.join(root, "data/world-runs", "latest-training-plan.json");

const positiveRoot = path.join(root, "data/world-samples/positive");
const negativeRoot = path.join(root, "data/world-samples/negative");
const pendingRoot = path.join(root, "data/world-samples/pending");
const rejectedRoot = path.join(root, "data/world-samples/rejected");

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

async function listSampleDecisionFiles(sampleRoot) {
  if (!(await fileExists(sampleRoot))) return [];
  const entries = await readdir(sampleRoot, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sampleDecisionPath = path.join(sampleRoot, entry.name, "sample-decision.json");
    if (await fileExists(sampleDecisionPath)) files.push(sampleDecisionPath);
  }
  return files;
}

async function countSampleDecisionFiles(sampleRoot) {
  return (await listSampleDecisionFiles(sampleRoot)).length;
}

async function collectTrainableEntries(sampleRoot, polarity) {
  const decisionFiles = await listSampleDecisionFiles(sampleRoot);
  const entries = [];
  for (const decisionPath of decisionFiles) {
    const decision = JSON.parse(await readFile(decisionPath, "utf8"));
    const isExpectedDecision = decision.decision === polarity;
    const isTrainable = decision.trainingEligibility === "trainable";
    const hasImageHash = typeof decision.outputImageHash === "string" && decision.outputImageHash.length > 0;
    const imagePath = decision.outputImagePath ? path.join(root, decision.outputImagePath) : null;
    const hasImage = imagePath ? await fileExists(imagePath) : false;

    if (!isExpectedDecision || !isTrainable || !hasImageHash || !hasImage) {
      continue;
    }

    entries.push({
      sampleId: decision.sampleId,
      candidateId: decision.candidateId,
      outputId: decision.outputId,
      polarity,
      inputPayloadHash: decision.inputPayloadHash,
      outputImagePath: decision.outputImagePath,
      outputImageHash: decision.outputImageHash,
      sampleDecisionPath: projectPath(decisionPath),
      sourcePath: decision.sourcePath,
    });
  }
  return entries;
}

const positiveEntries = await collectTrainableEntries(positiveRoot, "positive");
const negativeEntries = await collectTrainableEntries(negativeRoot, "negative");
const trainableEntries = [...positiveEntries, ...negativeEntries];
const pendingCount = await countSampleDecisionFiles(pendingRoot);
const rejectedCount = await countSampleDecisionFiles(rejectedRoot);
const now = "2026-07-06T00:00:00.000Z";
const isBlocked = trainableEntries.length === 0;

const manifest = {
  manifestVersion: "live-world-p6-training-sample-manifest-v1",
  manifestId: "live-world-p6-training-sample-manifest-0001",
  trainingRunId: runId,
  entries: trainableEntries,
  positiveCount: positiveEntries.length,
  negativeCount: negativeEntries.length,
  totalTrainableSamples: trainableEntries.length,
  blockedSampleCounts: {
    pending: pendingCount,
    rejected: rejectedCount,
  },
  readBoundary: {
    allowedSampleRoots: [
      "data/world-samples/positive",
      "data/world-samples/negative",
    ],
    forbiddenSampleRoots: [
      "data/world-samples/pending",
      "data/world-samples/rejected",
      "data/world-visual-candidates",
      ".runtime/ai-painter",
    ],
    allowPending: false,
    allowRejected: false,
  },
  createdAt: now,
};

const runRecord = {
  trainingRunVersion: "live-world-p6-training-run-record-v1",
  trainingRunId: runId,
  status: isBlocked ? "blocked_no_trainable_samples" : "ready",
  sampleManifestPath: projectPath(manifestPath),
  configSnapshot: {
    configVersion: "live-world-p6-training-config-snapshot-v1",
    modelFamily: "ai-painter-natural-home",
    trainingMode: isBlocked ? "blocked-plan-only" : "structure-guided-refiner",
    command: isBlocked ? null : "reserved-for-p6-training-command",
    datasetRoot: isBlocked ? null : "data/world-samples",
    outputRoot: projectPath(outputRoot),
    seed: 20260706,
    maxEpochs: isBlocked ? null : 8,
    reason: isBlocked
      ? "No trainable positive or negative samples are available. Pending and rejected samples are forbidden for training."
      : "Trainable sample manifest is ready.",
  },
  outputArchivePlan: {
    outputRoot: projectPath(outputRoot),
    checkpointPath: isBlocked ? null : projectPath(path.join(outputRoot, "checkpoints/best.pt")),
    metricsPath: isBlocked ? null : projectPath(path.join(outputRoot, "metrics.json")),
    logPath: isBlocked ? null : projectPath(path.join(outputRoot, "training.log")),
    generatedCandidateRoot: isBlocked
      ? null
      : "data/world-visual-candidates/generated-from-p6-training-plan-0001",
    canWriteModelArtifact: !isBlocked,
  },
  blockedReasons: isBlocked
    ? [
        "positive sample count is 0",
        "negative sample count is 0",
        "pending samples are not trainable",
        "rejected samples are not trainable without owner re-selection",
      ]
    : [],
  nextAllowedAction: isBlocked
    ? "Generate real visual outputs, run P4/P5 review, and promote owner-approved data into positive or negative samples before training."
    : "Start AI Painter training using the manifest entries only.",
  createdAt: now,
};

await mkdir(outputRoot, { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(runRecordPath, `${JSON.stringify(runRecord, null, 2)}\n`, "utf8");
await writeFile(
  latestPath,
  `${JSON.stringify(
    {
      trainingRunId: runId,
      status: runRecord.status,
      sampleManifestPath: runRecord.sampleManifestPath,
      trainingRunRecordPath: projectPath(runRecordPath),
      createdAt: now,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${projectPath(manifestPath)}`);
console.log(`Wrote ${projectPath(runRecordPath)}`);
console.log(`trainingRunId=${runId}`);
console.log(`status=${runRecord.status}`);
console.log(`trainableSamples=${manifest.totalTrainableSamples}`);
console.log(`pendingSamples=${pendingCount}`);
console.log(`rejectedSamples=${rejectedCount}`);
