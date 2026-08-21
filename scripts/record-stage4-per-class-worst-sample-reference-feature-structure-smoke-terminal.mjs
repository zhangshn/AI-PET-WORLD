import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")

const runRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-per-class-worst-sample-reference-feature-structure-smoke-executions",
  runId,
)
const authorizationRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  `owner-authorized-stage4-per-class-worst-sample-reference-feature-structure-smoke-${runId}`,
)
const implementationRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-per-class-worst-sample-reference-feature-structure-smoke-entry-implementations",
  "20260821-012400000",
)
const files = {
  authorization: path.join(authorizationRoot, "gpu-authorization.json"),
  consumption: path.join(authorizationRoot, "gpu-consumption.json"),
  cpuReport: path.join(implementationRoot, "cpu-report.json"),
  preflight: path.join(runRoot, "preflight-report.json"),
  activeConfig: path.join(runRoot, "active-config.json"),
  review: path.join(runRoot, "training-output", "fixed-preview-reviews.json"),
  manifest: path.join(runRoot, "training-output", "manifest.json"),
  checkpoint: path.join(runRoot, "training-output", "complete-world-ai-assisted-conditional-denoiser.pt"),
  terminalState: path.join(
    runRoot,
    "training-output",
    "terminal-qualification-identity",
    "epoch-030-denoiser-state.pt",
  ),
  finalization: path.join(runRoot, "finalization", "finalization-report.json"),
  terminal: path.join(runRoot, "finalization", "phase-terminal.json"),
  capsule: path.join(runRoot, "finalization", "local-task-capsule.json"),
  ownerRequest: path.join(runRoot, "finalization", "owner-action-request.json"),
  planSync: path.join(runRoot, "finalization", "plan-sync-record.json"),
  plan: path.join(root, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md"),
}

for (const file of [
  files.authorization,
  files.consumption,
  files.cpuReport,
  files.preflight,
  files.activeConfig,
  files.review,
  files.manifest,
  files.checkpoint,
  files.terminalState,
  files.finalization,
  files.terminal,
  files.plan,
]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${logical(file)}`)
}
for (const file of [files.capsule, files.ownerRequest, files.planSync]) {
  if (fs.existsSync(file)) throw new Error(`immutable output exists: ${logical(file)}`)
}

const terminal = readJson(files.terminal)
const finalization = readJson(files.finalization)
const review = readJson(files.review)
const manifest = readJson(files.manifest)
const consumption = readJson(files.consumption)
if (
  terminal.status !== "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed"
  || finalization.status !== terminal.status
  || review.status !== "machine_reviews_failed_closed"
  || review.previewCount !== 5
  || review.previewPassCount !== 2
  || review.previewFailCount !== 3
  || manifest.singleSampleOverfitSmoke?.enabled !== true
  || manifest.trainingStage !== "conditional_denoiser_single_sample_overfit_smoke"
  || manifest.modelStateHashEvidence?.weightsChanged !== true
  || consumption.status !== "fact_conditioned_semantic_mixture_stage4_smoke_authorization_atomically_consumed"
) throw new Error("Smoke terminal evidence is inconsistent")

const expectedTimeline = [
  [1, false, 9],
  [5, false, 2],
  [10, false, 1],
  [20, true, 0],
  [30, true, 0],
]
if (
  review.reviews.length !== expectedTimeline.length
  || expectedTimeline.some(([epoch, passed, issueCount], index) => {
    const current = review.reviews[index]
    return current.epoch !== epoch
      || current.passed !== passed
      || current.issueCodes.length !== issueCount
  })
) throw new Error("Smoke machine-review timeline changed")

const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
const evidence = {
  terminal: bind(files.terminal),
  finalization: bind(files.finalization),
  manifest: bind(files.manifest),
  machineReview: { ...bind(files.review), passCount: 2, failCount: 3 },
  bestCheckpoint: bind(files.checkpoint),
  epoch30TerminalState: bind(files.terminalState),
  executionConsumption: bind(files.consumption),
  cpuReport: bind(files.cpuReport),
}

writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress,
  currentStage: "Stage4 per-class worst-sample reference feature structure 30 Epoch Smoke closed",
  candidateTerminal: evidence.terminal,
  latestBlocker: "fixed_preview_machine_review_failed_2_of_5",
  nextLegalAction: "owner_authorized_cpu_readonly_late_stability_qualification_only",
  forbiddenActions: [
    "automatic_smoke_retry",
    "stage0_without_qualification",
    "stage1",
    "stage2",
    "stage5",
    "formal_inference",
    "checkpoint_promotion",
    "runtime_frame",
    "world_entry",
  ],
  machineReviewTimeline: review.reviews.map((entry) => ({
    epoch: entry.epoch,
    passed: entry.passed,
    issueCodes: entry.issueCodes,
  })),
  evidence,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.ownerRequest, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "execute_one_cpu_readonly_late_stability_qualification_for_current_smoke",
  sourceTerminal: evidence.terminal,
  sourceManifest: evidence.manifest,
  sourceMachineReview: evidence.machineReview,
  requiredLateEpochTimeline: [10, 20, 30],
  observedLateEpochFailureCounts: [1, 0, 0],
  smokeRetryAuthorized: false,
  stage0Authorized: false,
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.planSync, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  runId,
  uniqueModulePlan: bind(files.plan),
  terminal: evidence.terminal,
  nextLegalAction: "owner_authorized_cpu_readonly_late_stability_qualification_only",
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

for (const file of [
  ...Object.values(files),
].filter((value) => typeof value === "string" && fs.existsSync(value))) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: file === files.plan
      ? "ai_painter_unique_module_plan"
      : "stage4_per_class_worst_sample_reference_feature_structure_30_epoch_smoke",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}

appendAiPainterProgramEvent({
  id: `stage4-per-class-worst-sample-reference-feature-structure-smoke-${runId}`,
  timestamp,
  action: "stage4_per_class_worst_sample_reference_feature_structure_30_epoch_smoke",
  runId,
  kind: "gpu_training",
  status: "failed_closed",
  title: "Stage4 per-class worst-sample reference feature structure Smoke closed by aggregate review",
  titleZh: "Stage4逐类别最差样本参考特征结构Smoke按聚合审核关闭",
  detailZh: "30 Epoch训练与工程证据完整；Epoch 1/5/10失败，Epoch 20/30连续通过。正式五张聚合门为2/5，因此Smoke失败关闭，未启动Stage 0。",
  evidencePath: logical(files.terminal),
  evidenceSha256: hash(files.terminal),
  fixedTotalProgress,
})

console.log(JSON.stringify({
  status: "recorded",
  terminal: evidence.terminal,
  manifest: evidence.manifest,
  machineReview: evidence.machineReview,
  localTaskCapsule: bind(files.capsule),
  ownerActionRequest: bind(files.ownerRequest),
  planSyncRecord: bind(files.planSync),
}, null, 2))

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function hash(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function logical(file) {
  return path.relative(root, file).replace(/\\/g, "/")
}

function bind(file) {
  return { path: logical(file), sha256: hash(file) }
}
