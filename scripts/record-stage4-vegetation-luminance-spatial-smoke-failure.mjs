import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = "20260813-041600000"
const runRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-fact-conditioned-semantic-mixture-smoke-executions",
  runId,
)
const authorizationRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "owner-action-requests",
  "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260813-041600000",
)
const paths = {
  terminal: path.join(runRoot, "finalization", "phase-terminal.json"),
  finalization: path.join(runRoot, "finalization", "finalization-report.json"),
  manifest: path.join(runRoot, "training-output", "manifest.json"),
  review: path.join(runRoot, "training-output", "fixed-preview-reviews.json"),
  checkpoint: path.join(runRoot, "training-output", "complete-world-ai-assisted-conditional-denoiser.pt"),
  progress: path.join(runRoot, "training-output", "progress.json"),
  telemetry: path.join(runRoot, "training-output", "stage4-step-telemetry.json"),
  authorization: path.join(authorizationRoot, "gpu-execution-authorization.json"),
  consumption: path.join(runRoot, "execution-consumption.json"),
}
const projectPath = (file) => path.relative(root, file).replaceAll("\\", "/")
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const binding = (file) => ({ path: projectPath(file), sha256: sha256(file) })

for (const file of Object.values(paths)) {
  if (!fs.existsSync(file)) throw new Error(`missing immutable evidence: ${projectPath(file)}`)
}

const terminal = JSON.parse(fs.readFileSync(paths.terminal, "utf8"))
const review = JSON.parse(fs.readFileSync(paths.review, "utf8"))
const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"))
const progress = JSON.parse(fs.readFileSync(paths.progress, "utf8"))
if (
  terminal.status !== "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed"
  || !terminal.blockers?.includes("fixed_preview_machine_review_failed")
  || manifest.status !== "conditional_denoiser_single_sample_overfit_smoke_completed"
  || review.status !== "machine_reviews_failed_closed"
  || review.previewCount !== 5
  || review.previewPassCount !== 1
  || review.previewFailCount !== 4
  || progress.status !== "completed"
  || progress.currentEpoch !== 30
) throw new Error("bound Smoke evidence does not match the closed visual failure")

const epochTimeline = review.reviews.map((row) => ({
  epoch: row.epoch,
  passed: row.passed,
  issueCodes: row.issueCodes,
  objects: Object.fromEntries(
    (row.conditionAlignment?.objectSemanticAudits ?? [])
      .filter((item) => ["object_footprints", "object_tree", "object_rock", "object_vegetation"].includes(item.channelId))
      .map((item) => [item.channelId, {
        passed: item.passed,
        maskedRgbMae: item.referenceResponse?.maskedRgbMae,
        maskedEdgeMae: item.referenceResponse?.maskedEdgeMae,
        maskedLumaCorrelation: item.referenceResponse?.maskedLumaCorrelation,
      }]),
  ),
}))
const expectedIssueCounts = new Map([[1, 7], [5, 4], [10, 2], [20, 1], [30, 0]])
for (const item of epochTimeline) {
  if (item.issueCodes.length !== expectedIssueCounts.get(item.epoch)) {
    throw new Error(`unexpected immutable issue timeline at epoch ${item.epoch}`)
  }
}
const epoch30 = epochTimeline.find((item) => item.epoch === 30)
if (!epoch30?.passed || epoch30.issueCodes.length !== 0 || !epoch30.objects.object_vegetation?.passed) {
  throw new Error("Epoch 30 is not the expected fully passing preview")
}

const capsulePath = path.join(runRoot, "finalization", "local-task-capsule.json")
const ownerPath = path.join(runRoot, "finalization", "owner-decision-request.json")
for (const file of [capsulePath, ownerPath]) {
  if (fs.existsSync(file)) throw new Error(`immutable output already exists: ${projectPath(file)}`)
}
const evidence = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, binding(file)]))
const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }

writeJsonAtomic(ownerPath, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "owner_decision_required_not_executed",
  requestedDecision: "choose_smoke_temporal_qualification_contract_or_stop_current_stage4_route",
  rationale: "The new legal vegetation luminance-spatial objective succeeded at Epoch 30 and all audited categories passed there, but the unchanged Smoke contract requires all five fixed previews to pass; the actual result is 1/5.",
  prohibitedAutomaticActions: [
    "start_stage0",
    "repeat_same_smoke",
    "change_machine_review_thresholds",
    "use_failed_preview_pixels_as_training_target",
  ],
  ownerChoices: [
    "retain_all_five_preview_pass_requirement_and_stop_this_candidate",
    "authorize_a_separate_evidence_based_late_stability_qualification_design_without_changing_review_thresholds",
  ],
  fixedTotalProgress,
  evidence,
  epochTimeline,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress,
  currentStage: "Stage4 vegetation luminance-spatial objective Smoke completed but failed temporal visual qualification",
  candidateTerminal: binding(paths.terminal),
  latestBlocker: "fixed_preview_machine_review_failed: preview pass count 1/5 despite Epoch 30 fully passing",
  nextLegalAction: "Owner decides whether to retain all-five-preview qualification or authorize a separate late-stability qualification design",
  forbiddenActions: [
    "start_stage0",
    "repeat_same_smoke",
    "change_machine_review_thresholds",
    "use_failed_preview_pixels_as_training_target",
  ],
  evidence,
  ownerDecisionRequest: binding(ownerPath),
  epochTimeline,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

for (const file of [...Object.values(paths), ownerPath, capsulePath]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256(file),
  })
}

appendAiPainterProgramEvent({
  id: `stage4-vegetation-luminance-spatial-smoke-${runId}`,
  timestamp,
  action: "stage4_vegetation_luminance_spatial_structure_smoke",
  runId,
  kind: "gpu_smoke_visual_qualification",
  status: "failed_closed",
  title: "Stage4 vegetation luminance-spatial Smoke failed temporal visual qualification",
  titleZh: "Stage4 植被亮度—空间结构 Smoke 未通过时间线视觉资格",
  detailZh: "30 Epoch训练、Checkpoint、固定预览字节复现均完成；Epoch 30全部视觉项通过，但五张固定预览仅1/5通过，因此未启动Stage 0，等待Owner裁决时间线资格合同。",
  evidencePath: projectPath(paths.terminal),
  evidenceSha256: sha256(paths.terminal),
  fixedTotalProgress,
})

console.log(JSON.stringify({
  status: "recorded_failed_closed_owner_decision_required",
  terminal: binding(paths.terminal),
  finalization: binding(paths.finalization),
  manifest: binding(paths.manifest),
  review: binding(paths.review),
  localTaskCapsule: binding(capsulePath),
  ownerDecisionRequest: binding(ownerPath),
  epochTimeline,
}, null, 2))
