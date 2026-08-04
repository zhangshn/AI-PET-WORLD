import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const MODEL_ROOT = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r1"
const POINTER_PATH = `${MODEL_ROOT}/latest-program-check.json`
const pointer = readJson(POINTER_PATH)
assert(pointer?.status === "stage0_smoke_program_passed_stopped", "completed repair R1 smoke pointer is missing")
const originalReviewPath = pointer.originalPreviewReviewPath ?? pointer.previewReviewPath
const originalReview = readJson(originalReviewPath)
assert(originalReview?.previewPath, "original fixed preview review is missing")
const originalPreviewPath = resolvePath(originalReview.previewPath)
assert(fs.existsSync(originalPreviewPath), "fixed preview image is missing")
const createdAtUtc = new Date().toISOString()
const suffix = createdAtUtc.replace(/[:.]/g, "-")
const runId = `ai-assisted-v7-bounded-repair-r1-preview-review-reconciliation-${suffix}`
const derivativePath = path.join(ROOT, ".runtime", "ai-painter", "v7-r1-preview-review-assets", `${sha256File(originalPreviewPath).slice(0, 16)}-1024x768-nearest.png`)
fs.mkdirSync(path.dirname(derivativePath), { recursive: true })
if (!fs.existsSync(derivativePath)) {
  await sharp(originalPreviewPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(derivativePath)
}
indexFile(derivativePath, runId)

const aesthetic = await auditAiAssistedProfessionalAesthetic(derivativePath)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = readJson(datasetPointer.manifestPath)
const sourceIndex = readJson(datasetManifest.sourceIndexPath)
const previewRow = sourceIndex.samples.find((row) => path.basename(originalPreviewPath).includes(row.conditionLabel))
assert(previewRow, "fixed preview condition row is missing")
const conditionPack = readJson(previewRow.conditionPackPath)
const alignment = await auditAiAssistedConditionAlignment({
  record: {
    recordId: `${pointer.runId}-fixed-preview`,
    conditionBinding: { conditionPackPath: previewRow.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick },
    classification: previewRow.classification,
  },
  imagePath: derivativePath,
})
const previewMachinePassed = aesthetic.passed && alignment.passed
const correctedReview = {
  schemaVersion: "ai-assisted-v7-bounded-repair-r1-stage-preview-review-v2",
  status: previewMachinePassed ? "machine_review_completed_passed" : "machine_review_completed_failed_quality_diagnostic",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  runId: pointer.runId,
  stage: 0,
  epoch: 1,
  sourcePreviewPath: originalReview.previewPath,
  sourcePreviewSha256: originalReview.previewSha256,
  normalizedReviewImagePath: projectPath(derivativePath),
  normalizedReviewImageSha256: sha256File(derivativePath),
  sourceResolution: { width: 256, height: 192 },
  reviewResolution: { width: 1024, height: 768 },
  resizeKernel: "nearest",
  formalCandidate: false,
  thresholdPolicy: "unchanged_owner_calibrated_professional_aesthetic_and_condition_alignment_gates",
  professionalAesthetic: aesthetic,
  conditionAlignment: alignment,
  originalReviewDisposition: "superseded_due_to_native_resolution_and_missing_condition_alignment_review",
  originalReviewPath,
  originalReviewSha256: sha256File(originalReviewPath),
  interpretation: "The one-epoch Smoke program passed. This preview remains a non-formal diagnostic and does not pass visual quality.",
  automaticStorage: true,
}
const stored = writeImmutableProgramRun({
  root: ".runtime/ai-painter/v7-bounded-repair-r1-preview-review-reconciliations",
  runId,
  fileName: "reconciliation-report.json",
  record: correctedReview,
  latest: {
    smokeRunId: pointer.runId,
    previewMachinePassed,
    formalCandidate: false,
  },
})
const correctedHash = sha256File(stored.runPath)

const ownerRequestRoot = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests")
const pointedRequest = pointer.nextOwnerRequestPath ? readJson(pointer.nextOwnerRequestPath) : null
const originalRequestDir = pointedRequest ? {
  entry: { name: path.basename(path.dirname(resolvePath(pointer.nextOwnerRequestPath))) },
  request: pointedRequest,
} : fs.readdirSync(ownerRequestRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("owner-action-request-v7-repair-r1-full-training-"))
  .map((entry) => ({ entry, request: readJson(path.join(ownerRequestRoot, entry.name, "request.json")) }))
  .filter((item) => item.request?.taskIdentity?.smokeRunId === pointer.runId)
  .sort((left, right) => String(right.request.recordedAtUtc).localeCompare(String(left.request.recordedAtUtc)))[0]
assert(originalRequestDir, "original full-training owner request is missing")
const supersessionPath = path.join(ownerRequestRoot, originalRequestDir.entry.name, "preview-review-supersession.json")
writeJsonAtomic(supersessionPath, {
  schemaVersion: "ai-painter-owner-action-request-evidence-supersession-v1",
  status: "evidence_superseded_request_not_authorized",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  requestId: originalRequestDir.request.requestId,
  supersededField: "taskIdentity.previewMachinePassed",
  oldValue: originalRequestDir.request.taskIdentity.previewMachinePassed,
  correctedValue: previewMachinePassed,
  reasonCode: "stage_preview_requires_condition_alignment_in_addition_to_professional_aesthetic",
  correctedReviewPath: stored.runPath,
  correctedReviewSha256: correctedHash,
  requestWasNeverAuthorized: originalRequestDir.request.status === "waiting_owner_authorization",
  automaticStorage: true,
})
indexFile(supersessionPath, runId)

const correctedRequestId = `${originalRequestDir.request.requestId}-condition-alignment-corrected`
const correctedRequestPath = path.join(ownerRequestRoot, correctedRequestId, "request.json")
const correctedRequest = {
  ...originalRequestDir.request,
  requestId: correctedRequestId,
  recordedAtUtc: createdAtUtc,
  recordedAtAsiaShanghai: formatShanghai(createdAtUtc),
  supersedesRequestId: originalRequestDir.request.requestId,
  taskIdentity: {
    ...originalRequestDir.request.taskIdentity,
    previewMachinePassed,
    correctedPreviewReviewPath: stored.runPath,
    correctedPreviewReviewSha256: correctedHash,
  },
  ownerVisibleConclusionZh: "V7 修复版一次 Stage 0 Smoke 程序已通过并停止；固定预览经 1024×768 等比例审查尺度归一化后未通过画质门禁，符合 1 epoch Smoke 仍是噪声诊断图的事实。",
  localSystemFindingZh: "Smoke 证明修复后的训练、损失、检查点、预览、Token 和硬件记录链能运行；它不证明模型画质已经合格。完整训练仍须项目所有者另行授权，后续严格复验继续独立阻断。",
}
writeJsonAtomic(correctedRequestPath, correctedRequest)
indexFile(correctedRequestPath, runId)

const updatedPointer = {
  ...pointer,
  originalPreviewReviewPath: originalReviewPath,
  originalPreviewReviewSha256: sha256File(originalReviewPath),
  previewReviewPath: stored.runPath,
  previewReviewSha256: correctedHash,
  previewMachinePassed,
  previewReviewReconciledAtUtc: createdAtUtc,
  nextOwnerRequestId: correctedRequestId,
  nextOwnerRequestPath: projectPath(correctedRequestPath),
  nextOwnerRequestSha256: sha256File(correctedRequestPath),
}
writeJsonAtomic(resolvePath(POINTER_PATH), updatedPointer)
indexFile(resolvePath(POINTER_PATH), runId)

appendAiPainterProgramEvent({
  action: "reconcile_ai_assisted_v7_bounded_repair_r1_preview_review",
  runId,
  kind: "machine_review_reconciled",
  status: "success",
  title: "V7 repair R1 fixed preview review was resolution-normalized and reconciled",
  titleZh: "V7 修复版固定预览已按正式审查分辨率归一化并完成纠正复核",
  detail: `smokeProgramPassed=true; previewMachinePassed=${previewMachinePassed}; fullTrainingStarted=false`,
  detailZh: `Smoke程序通过=true；预览机器画质通过=${previewMachinePassed}；完整训练启动=false`,
  script: "scripts/reconcile-ai-assisted-v7-bounded-repair-r1-preview-review.mjs",
  currentStep: "v7_repair_r1_smoke_completed_waiting_owner_full_training_decision",
  evidencePath: stored.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  smokeProgramStatus: pointer.status,
  correctedPreviewStatus: correctedReview.status,
  previewMachinePassed,
  issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
  reconciliationPath: stored.runPath,
  reconciliationSha256: correctedHash,
  correctedOwnerRequestId: correctedRequestId,
  correctedOwnerRequestPath: projectPath(correctedRequestPath),
  fullTrainingStarted: false,
  formalInferenceEligible: false,
  canEnterWorld: false,
}, null, 2))

function readJson(value) { try { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) } catch { return null } }
function resolvePath(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolvePath(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex") }
function indexFile(value, artifactRunId) {
  const absolute = resolvePath(value)
  const info = fs.statSync(absolute)
  indexArtifact({ logicalPath: projectPath(absolute), physicalUri: fs.realpathSync(absolute), storageLayer: "hot", runId: artifactRunId, byteSize: info.size, modifiedAtUtc: info.mtime.toISOString(), sha256: sha256File(absolute) })
}
function assert(condition, message) { if (!condition) throw new Error(message) }
