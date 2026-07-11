import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";

const p11BatchPath = "data/live-world/visual-reviews/p11-active-chunks/p11-auto-visual-review-batch.json";
const worldStatePath = "data/live-world/world-states/p2-fixed-seed-5x5-world.json";
const runtimeSnapshotPath = "data/live-world/runtime-states/p3-runtime-activation-snapshot.json";

const p12Root = "data/live-world/owner-reviews/p12-active-chunks";
const p12BatchPath = `${p12Root}/p12-owner-review-decision-batch.json`;
const p12LatestPath = "data/live-world/owner-reviews/latest-p12-owner-review-decision-batch.json";

const p13Root = "data/live-world/approved-visuals";
const p13ManifestPath = `${p13Root}/p13-approved-visual-promotion-manifest.json`;
const p13LatestPath = `${p13Root}/latest-approved-visual-promotion-manifest.json`;

const p14Root = "data/live-world/page-gates";
const p14GatePath = `${p14Root}/p14-runtime-page-gate.json`;
const p14LatestPath = `${p14Root}/latest-runtime-page-gate.json`;

const p15Root = "data/live-world/training";
const p15ManifestPath = `${p15Root}/p15-training-sample-manifest.json`;
const p15RunPath = `${p15Root}/p15-training-run-record.json`;
const p15LatestPath = `${p15Root}/latest-training-run-record.json`;

const p16Root = "data/live-world/runtime-readiness";
const p16RecordPath = `${p16Root}/p16-runtime-page-readiness.json`;
const p16LatestPath = `${p16Root}/latest-runtime-page-readiness.json`;

const p17Root = "data/live-world/closure-reports";
const p17ReportPath = `${p17Root}/p17-live-world-mvp-closure-report.json`;
const p17LatestPath = `${p17Root}/latest-live-world-mvp-closure-report.json`;

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

function ownerDecisionFor(record) {
  return {
    decision: "pending_review",
    decisionSource: "template_generated",
    decisionReason: [
      "P11 automatic review requires owner decision.",
      record.visualIssues.length > 0
        ? `Visual issues: ${record.visualIssues.join(", ")}.`
        : "No visual issue was detected, but automatic review cannot approve runtime use.",
      "No image can enter approved visuals without explicit owner approval.",
    ].join(" "),
    canPromoteToApprovedVisual: false,
    canPromoteToPositiveSample: false,
    canPromoteToNegativeSample: false,
  };
}

const p11Batch = await readJson(p11BatchPath);
const worldState = await readJson(worldStatePath);
const runtimeSnapshot = await readJson(runtimeSnapshotPath);
const activeChunkIds = runtimeSnapshot.activeChunkIds ?? [];
const sleepingChunkIds = runtimeSnapshot.sleepingChunkIds ?? [];

const ownerReviewRecords = [];
for (const autoRecord of p11Batch.records) {
  const decision = ownerDecisionFor(autoRecord);
  const reviewPath = `${p12Root}/${autoRecord.candidateId}/owner-review-decision.json`;
  const record = {
    reviewVersion: "live-world-p12-owner-review-decision-v1",
    reviewId: `${autoRecord.candidateId}-p12-owner-review-0001`,
    candidateId: autoRecord.candidateId,
    chunkId: autoRecord.chunkId,
    sourceAutoReviewPath: autoRecord.reviewPath,
    sourceAutoStatus: autoRecord.status,
    sourceAutoConclusion: autoRecord.conclusion,
    sourceVisualIssues: autoRecord.visualIssues,
    sourceStructureIssues: autoRecord.structureIssues,
    decision: decision.decision,
    decisionSource: decision.decisionSource,
    decisionReason: decision.decisionReason,
    canPromoteToApprovedVisual: decision.canPromoteToApprovedVisual,
    canPromoteToPositiveSample: decision.canPromoteToPositiveSample,
    canPromoteToNegativeSample: decision.canPromoteToNegativeSample,
    requiresExplicitOwnerApproval: true,
    decidedAt: now,
  };
  await writeJson(reviewPath, record);
  ownerReviewRecords.push({
    candidateId: record.candidateId,
    chunkId: record.chunkId,
    ownerReviewPath: reviewPath,
    decision: record.decision,
    canPromoteToApprovedVisual: record.canPromoteToApprovedVisual,
    canPromoteToPositiveSample: record.canPromoteToPositiveSample,
    canPromoteToNegativeSample: record.canPromoteToNegativeSample,
  });
}

const p12Batch = {
  batchVersion: "live-world-p12-owner-review-decision-batch-v1",
  batchId: "p12-owner-review-decision-batch-0001",
  sourceAutoReviewBatchPath: p11BatchPath,
  status: "blocked_pending_owner_decision",
  candidateCount: ownerReviewRecords.length,
  approvedCount: ownerReviewRecords.filter((record) => record.decision === "approved").length,
  rejectedCount: ownerReviewRecords.filter((record) => record.decision === "rejected").length,
  pendingCount: ownerReviewRecords.filter((record) => record.decision === "pending_review").length,
  records: ownerReviewRecords,
  forbiddenSideEffects: {
    writesApprovedVisuals: false,
    writesTrainingSamples: false,
    bypassesRuntimePageGate: false,
  },
  createdAt: now,
};
await writeJson(p12BatchPath, p12Batch);
await writeJson(p12LatestPath, {
  batchId: p12Batch.batchId,
  status: p12Batch.status,
  candidateCount: p12Batch.candidateCount,
  approvedCount: p12Batch.approvedCount,
  rejectedCount: p12Batch.rejectedCount,
  pendingCount: p12Batch.pendingCount,
  batchPath: p12BatchPath,
  createdAt: now,
});

const approvedVisuals = [];
const approvedVisualChunkIds = new Set(approvedVisuals.map((entry) => entry.chunkId));
const missingApprovedVisualChunkIds = activeChunkIds.filter((chunkId) => !approvedVisualChunkIds.has(chunkId));

const p13Manifest = {
  manifestVersion: "live-world-p13-approved-visual-promotion-manifest-v1",
  manifestId: "p13-approved-visual-promotion-manifest-0001",
  sourceOwnerReviewBatchPath: p12BatchPath,
  status: "blocked_no_owner_approved_visuals",
  worldId: worldState.worldId,
  sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  requiredChunkIds: activeChunkIds,
  approvedVisuals,
  approvedVisualCount: approvedVisuals.length,
  missingApprovedVisualChunkIds,
  blockedReasons: [
    "P12 produced pending owner review templates only.",
    "No candidate has explicit owner approval.",
    "Approved visual promotion is forbidden until owner approval exists.",
  ],
  readBoundary: {
    allowedVisualRoots: ["data/live-world/approved-visuals"],
    forbiddenVisualRoots: [
      "data/world-visual-candidates",
      "data/world-samples/pending",
      "data/world-samples/rejected",
      "data/world-runs",
      ".runtime/ai-painter",
    ],
    allowCandidateOutputs: false,
    allowPendingSamples: false,
    allowRejectedSamples: false,
  },
  createdAt: now,
};
await writeJson(p13ManifestPath, p13Manifest);
await writeJson(p13LatestPath, {
  manifestId: p13Manifest.manifestId,
  status: p13Manifest.status,
  approvedVisualCount: p13Manifest.approvedVisualCount,
  missingApprovedVisualCount: p13Manifest.missingApprovedVisualChunkIds.length,
  manifestPath: p13ManifestPath,
  createdAt: now,
});

const sourceMismatch = worldState.worldStatePayloadHash !== runtimeSnapshot.sourceWorldStatePayloadHash;
const p14Status = sourceMismatch
  ? "blocked_source_mismatch"
  : missingApprovedVisualChunkIds.length > 0
    ? "blocked_no_approved_visuals"
    : "ready";
const p14Gate = {
  pageGateVersion: "live-world-p14-runtime-page-gate-v1",
  gateId: "p14-runtime-page-gate-0001",
  status: p14Status,
  worldId: worldState.worldId,
  worldStatePath,
  runtimeSnapshotPath,
  approvedVisualManifestPath: p13ManifestPath,
  worldStatePayloadHash: worldState.worldStatePayloadHash,
  runtimeSnapshotSourceWorldStatePayloadHash: runtimeSnapshot.sourceWorldStatePayloadHash,
  activeChunkCount: activeChunkIds.length,
  sleepingChunkCount: sleepingChunkIds.length,
  requiredVisualChunkCount: activeChunkIds.length,
  approvedVisualCount: approvedVisuals.length,
  missingApprovedVisualChunkIds,
  allowedReadRoots: [
    "data/live-world/world-states",
    "data/live-world/runtime-states",
    "data/live-world/approved-visuals",
  ],
  forbiddenReadRoots: [
    "data/world-visual-candidates",
    "data/world-samples/pending",
    "data/world-samples/rejected",
    "data/world-runs",
    ".runtime/ai-painter",
  ],
  canRenderWorldPage: p14Status === "ready",
  blockedReasons: [
    ...(sourceMismatch ? ["WorldState hash does not match RuntimeSnapshot source hash."] : []),
    ...(missingApprovedVisualChunkIds.length > 0 ? ["Active chunks do not have owner-approved visual outputs."] : []),
  ],
  nextAllowedAction: p14Status === "ready"
    ? "Render /world from WorldState, RuntimeSnapshot, and approved visuals only."
    : "Complete P12 owner approval, run P13 promotion, and refresh P14 page gate.",
  createdAt: now,
};
await writeJson(p14GatePath, p14Gate);
await writeJson(p14LatestPath, {
  gateId: p14Gate.gateId,
  status: p14Gate.status,
  pageGatePath: p14GatePath,
  approvedVisualManifestPath: p14Gate.approvedVisualManifestPath,
  canRenderWorldPage: p14Gate.canRenderWorldPage,
  createdAt: now,
});

const p15Manifest = {
  manifestVersion: "live-world-p15-training-sample-manifest-v1",
  manifestId: "p15-training-sample-manifest-0001",
  trainingRunId: "p15-training-run-0001",
  entries: [],
  positiveCount: 0,
  negativeCount: 0,
  totalTrainableSamples: 0,
  blockedSampleCounts: {
    pending: p12Batch.pendingCount,
    rejected: p12Batch.rejectedCount,
  },
  readBoundary: {
    allowedSampleRoots: ["data/world-samples/positive", "data/world-samples/negative"],
    forbiddenSampleRoots: ["data/world-samples/pending", "data/world-samples/rejected", "data/world-visual-candidates"],
    allowPending: false,
    allowRejected: false,
  },
  createdAt: now,
};
const p15Run = {
  trainingRunVersion: "live-world-p15-training-run-v1",
  trainingRunId: "p15-training-run-0001",
  status: "blocked_no_trainable_samples",
  sampleManifestPath: p15ManifestPath,
  configSnapshot: {
    configVersion: "live-world-p15-training-config-v1",
    modelFamily: "ai-painter-natural-home",
    trainingMode: "blocked-plan-only",
    command: null,
    datasetRoot: null,
    outputRoot: ".runtime/ai-painter/live-world-p15-training-blocked",
    seed: 20260706,
    maxEpochs: null,
    reason: "No owner-approved positive or negative samples exist after P12.",
  },
  outputArchivePlan: {
    outputRoot: ".runtime/ai-painter/live-world-p15-training-blocked",
    checkpointPath: null,
    metricsPath: null,
    logPath: null,
    generatedCandidateRoot: null,
    canWriteModelArtifact: false,
  },
  blockedReasons: [
    "P12 decisions are pending owner review.",
    "No candidate was approved as a positive sample.",
    "No candidate was approved as a negative sample.",
  ],
  nextAllowedAction: "Complete P12 owner decisions and rebuild the P15 training sample manifest.",
  createdAt: now,
};
await writeJson(p15ManifestPath, p15Manifest);
await writeJson(p15RunPath, p15Run);
await writeJson(p15LatestPath, {
  trainingRunId: p15Run.trainingRunId,
  status: p15Run.status,
  sampleManifestPath: p15ManifestPath,
  trainingRunPath: p15RunPath,
  totalTrainableSamples: p15Manifest.totalTrainableSamples,
  createdAt: now,
});

const p16Record = {
  readinessVersion: "live-world-p16-runtime-page-readiness-v1",
  readinessId: "p16-runtime-page-readiness-0001",
  sourcePageGatePath: p14GatePath,
  status: p14Gate.canRenderWorldPage ? "ready" : "blocked_waiting_for_approved_visuals",
  canRenderWorldPage: p14Gate.canRenderWorldPage,
  activeChunkCount: p14Gate.activeChunkCount,
  approvedVisualCount: p14Gate.approvedVisualCount,
  missingApprovedVisualChunkIds: p14Gate.missingApprovedVisualChunkIds,
  runtimeReadModel: {
    readsWorldState: true,
    readsRuntimeSnapshot: true,
    readsApprovedVisuals: true,
    readsCandidates: false,
    readsPendingSamples: false,
    readsRejectedSamples: false,
    readsRuntimeTrainingArtifacts: false,
  },
  blockedReasons: p14Gate.blockedReasons,
  nextAllowedAction: p14Gate.nextAllowedAction,
  createdAt: now,
};
await writeJson(p16RecordPath, p16Record);
await writeJson(p16LatestPath, {
  readinessId: p16Record.readinessId,
  status: p16Record.status,
  canRenderWorldPage: p16Record.canRenderWorldPage,
  readinessPath: p16RecordPath,
  createdAt: now,
});

const p17Report = {
  closureVersion: "live-world-p17-mvp-closure-report-v1",
  closureId: "p17-live-world-mvp-closure-report-0001",
  status: "closed_with_owner_approval_blocker",
  summary: "The data-driven live-world pipeline is closed through candidate generation, automatic review, owner-review templates, promotion gate, runtime gate, and training gate. Runtime approval is intentionally blocked because no owner-approved visuals exist yet.",
  completedStages: [
    "P0",
    "P1",
    "P2",
    "P3",
    "P4",
    "P5",
    "P6",
    "P7",
    "P8",
    "P9",
    "P10-A",
    "P10-B1",
    "P10-B2",
    "P10-B3",
    "P10-B4",
    "P10-C",
    "P11",
    "P12-template",
    "P13-blocked-promotion",
    "P14-blocked-runtime-gate",
    "P15-blocked-training",
    "P16-blocked-runtime-readiness",
  ],
  blocker: {
    blockerId: "owner_approval_required",
    description: "All 9 generated candidate visuals require owner review. None has explicit owner approval.",
    blockedStages: ["P13", "P14", "P15", "P16"],
    requiredHumanAction: "Review each P12 owner-review-decision.json and change decisions from pending_review to approved or rejected.",
  },
  artifacts: {
    p11BatchPath,
    p12BatchPath,
    p13ManifestPath,
    p14GatePath,
    p15ManifestPath,
    p15RunPath,
    p16RecordPath,
  },
  counts: {
    candidates: p11Batch.candidateCount,
    generatedImages: p11Batch.candidateCount,
    needsOwnerReview: p11Batch.needsOwnerReviewCount,
    ownerApproved: p12Batch.approvedCount,
    ownerRejected: p12Batch.rejectedCount,
    ownerPending: p12Batch.pendingCount,
    approvedVisuals: p13Manifest.approvedVisualCount,
    trainableSamples: p15Manifest.totalTrainableSamples,
  },
  finalRuntimeStatus: p16Record.status,
  canRenderWorldPage: p16Record.canRenderWorldPage,
  canStartTraining: p15Run.status === "ready",
  createdAt: now,
};
await writeJson(p17ReportPath, p17Report);
await writeJson(p17LatestPath, {
  closureId: p17Report.closureId,
  status: p17Report.status,
  canRenderWorldPage: p17Report.canRenderWorldPage,
  canStartTraining: p17Report.canStartTraining,
  closureReportPath: p17ReportPath,
  createdAt: now,
});

console.log(`Wrote ${p12BatchPath}`);
console.log(`Wrote ${p13ManifestPath}`);
console.log(`Wrote ${p14GatePath}`);
console.log(`Wrote ${p15RunPath}`);
console.log(`Wrote ${p16RecordPath}`);
console.log(`Wrote ${p17ReportPath}`);
console.log(`closureStatus=${p17Report.status}`);
console.log(`ownerPending=${p12Batch.pendingCount}`);
console.log(`approvedVisuals=${p13Manifest.approvedVisualCount}`);
console.log(`canRenderWorldPage=${p16Record.canRenderWorldPage}`);
