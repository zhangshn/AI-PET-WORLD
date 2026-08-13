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
const runId = "20260813-032500000"
const runRoot = path.join(root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions", runId)
const paths = {
  terminal: path.join(runRoot, "finalization", "phase-terminal.json"),
  finalization: path.join(runRoot, "finalization", "finalization-report.json"),
  manifest: path.join(runRoot, "training-output", "manifest.json"),
  review: path.join(runRoot, "training-output", "fixed-preview-reviews.json"),
  checkpoint: path.join(runRoot, "training-output", "complete-world-ai-assisted-conditional-denoiser.pt"),
  progress: path.join(runRoot, "training-output", "progress.json"),
  telemetry: path.join(runRoot, "training-output", "stage4-step-telemetry.json"),
  continuationCpu: path.join(root, ".runtime", "ai-painter", "stage4-semantic-mixture-existing-smoke-finalization-support", "20260813-033300000", "cpu-report.json"),
}
const projectPath = (file) => path.relative(root, file).replaceAll("\\", "/")
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const binding = (file) => ({ path: projectPath(file), sha256: sha256(file) })
for (const file of Object.values(paths)) if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)

const terminal = JSON.parse(fs.readFileSync(paths.terminal, "utf8"))
const review = JSON.parse(fs.readFileSync(paths.review, "utf8"))
const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"))
const progress = JSON.parse(fs.readFileSync(paths.progress, "utf8"))
if (
  terminal.status !== "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed"
  || !terminal.blockers?.includes("fixed_preview_machine_review_failed")
  || review.previewCount !== 5
  || review.previewPassCount !== 0
  || review.previewFailCount !== 5
  || manifest.status !== "conditional_denoiser_single_sample_overfit_smoke_completed"
  || progress.status !== "completed"
  || progress.currentEpoch !== 30
  || progress.liveProgress?.optimizerStep !== 90
) throw new Error("bound smoke failure evidence is inconsistent")

const vegetationTimeline = review.reviews.map((row) => {
  const vegetation = row.conditionAlignment?.objectSemanticAudits?.find((item) => item.channelId === "object_vegetation")
  return {
    epoch: row.epoch,
    previewPassed: row.passed,
    issueCodes: row.issueCodes,
    localResponsePassed: vegetation?.localResponsePassed,
    maskedRgbMae: vegetation?.referenceResponse?.maskedRgbMae,
    maskedEdgeMae: vegetation?.referenceResponse?.maskedEdgeMae,
    maskedLumaCorrelation: vegetation?.referenceResponse?.maskedLumaCorrelation,
  }
})
const epoch30 = vegetationTimeline.find((row) => row.epoch === 30)
if (!epoch30 || epoch30.issueCodes.length !== 1 || epoch30.issueCodes[0] !== "condition_object_vegetation_reference_semantic_mismatch") {
  throw new Error("epoch 30 is not the expected vegetation-only visual failure")
}

const timestamp = new Date().toISOString()
const capsulePath = path.join(runRoot, "finalization", "local-task-capsule.json")
const ownerPath = path.join(runRoot, "finalization", "owner-decision-request.json")
for (const file of [capsulePath, ownerPath]) if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
const evidence = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, binding(file)]))
writeJsonAtomic(ownerPath, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "owner_decision_required_not_executed",
  requestedDecision: "choose_new_vegetation_luminance_structure_supervision_contract_or_exit_current_stage4_candidate",
  prohibitedAutomaticActions: ["repeat_same_smoke", "free_hyperparameter_search", "machine_review_threshold_change", "start_stage0"],
  rationale: "The legal RGB and edge obligations improved their metrics, but the only remaining Epoch 30 failure is masked vegetation luma correlation 0.0577 below the unchanged 0.08 audit requirement.",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  evidence,
  vegetationTimeline,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 vegetation final-visible semantic repair Smoke failed visual qualification",
  candidateTerminal: binding(paths.terminal),
  latestBlocker: "condition_object_vegetation_reference_semantic_mismatch",
  nextLegalAction: "Owner chooses bounded luminance-structure supervision construction or exits the candidate route",
  forbiddenActions: ["repeat_same_smoke", "start_stage0", "change_review_thresholds", "use_failed_preview_pixels_as_training_target"],
  evidence,
  ownerDecisionRequest: binding(ownerPath),
  vegetationTimeline,
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
  id: `stage4-vegetation-final-visible-smoke-${runId}`,
  timestamp,
  action: "stage4_vegetation_final_visible_semantic_repair_smoke",
  runId,
  kind: "gpu_smoke_visual_qualification",
  status: "failed_closed",
  title: "Stage4 vegetation final-visible repair Smoke failed visual qualification",
  titleZh: "Stage4 植被最终可见语义修复 Smoke 视觉资格失败关闭",
  detailZh: "30 Epoch、90次优化、五张预览及字节复现均完成；Epoch 30仅剩植被参考语义不一致，亮度相关性0.0577未达到既有0.08审核要求，Stage 0未启动。",
  evidencePath: projectPath(paths.terminal),
  evidenceSha256: sha256(paths.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: "recorded_failed_closed",
  terminal: binding(paths.terminal),
  finalization: binding(paths.finalization),
  manifest: binding(paths.manifest),
  review: binding(paths.review),
  localTaskCapsule: binding(capsulePath),
  ownerDecisionRequest: binding(ownerPath),
  vegetationTimeline,
}, null, 2))
