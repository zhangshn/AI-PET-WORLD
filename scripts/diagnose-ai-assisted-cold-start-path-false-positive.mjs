import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"

const ROOT = process.cwd()
const RECORD_ID = "ai-cold-start-earth-reference-earth-reference-naturalized-complete-map-b3be6a28ffb6-v1"
const RECORD_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/record.json`
const AUTHORIZATION_REF = "owner-authorized-machine-misjudge-diagnosis-and-same-image-rereview-20260725"
const REQUIRED_OLD_ISSUE = "condition_terrain_path_ground_centroid_drift"

const record = readJson(RECORD_PATH)
const imagePath = path.resolve(ROOT, record.relativeDirectory, record.originalImage.path)
const oldReviewPath = path.resolve(ROOT, record.reviews.machineReviewPath)
const oldReview = readJson(oldReviewPath)
const oldPathAudit = oldReview.semanticConditionAudit?.channelAudits?.find((item) => item.channelId === "terrain_path_ground")
assert(oldReview.status === "machine_rejected", "source machine review is not rejected")
assert(oldReview.issues?.length === 1 && oldReview.issues[0].code === REQUIRED_OLD_ISSUE, "source review is not the locked single-issue path false-positive case")
assert(sha256File(imagePath) === record.originalImage.sha256, "image hash changed before diagnosis")

const preview = await auditAiAssistedConditionAlignment({ record, imagePath })
const previewPathAudit = preview.channelAudits.find((item) => item.channelId === "terrain_path_ground")
assert(preview.pathClassifier?.signalIsolationMode === "condition_supported_connected_components_v1", "path component isolation is missing")
assert(previewPathAudit?.signalIsolation?.rejectedPixelCount > 0, "diagnosis did not isolate disconnected warm-ground signal")
assert(JSON.stringify(previewPathAudit.thresholds) === JSON.stringify(oldPathAudit.thresholds), "acceptance thresholds changed during diagnosis")

const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-cold-start-path-false-positive-diagnosis-${createdAtUtc.replace(/[:.]/g, "-")}`
const diagnosis = {
  schemaVersion: "ai-assisted-cold-start-path-false-positive-diagnosis-v1",
  status: preview.passed
    ? "false_positive_diagnosed_same_image_rereview_ready"
    : "diagnosis_completed_same_image_still_blocked",
  runId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: AUTHORIZATION_REF,
  recordId: RECORD_ID,
  imagePath: projectPath(imagePath),
  imageSha256: record.originalImage.sha256,
  conditionPackPath: record.conditionBinding.conditionPackPath,
  conditionPackSha256: record.conditionBinding.conditionPackSha256,
  oldMachineReview: {
    reviewId: oldReview.reviewId,
    path: projectPath(oldReviewPath),
    sha256: sha256File(oldReviewPath),
    status: oldReview.status,
    issueCodes: oldReview.issues.map((issue) => issue.code),
    pathAudit: oldPathAudit,
  },
  rootCause: {
    code: "wet_season_path_classifier_included_disconnected_warm_bare_ground",
    detail: "The wet-season color classifier treated disconnected warm bare-ground patches as route pixels. Those patches shifted the aggregate route centroid toward the map center even though the continuous left-side route matched the locked condition channel.",
    detailZh: "雨季暖土色分类器把与道路不连通的裸土地块一并识别为道路像素，导致整体道路质心被拉向画面中央；左侧连续道路实际与锁定条件通道一致。",
  },
  repair: {
    method: preview.method,
    signalIsolationMode: preview.pathClassifier.signalIsolationMode,
    behavior: "Retain complete color-classified connected components only when they intersect or receive material support from the locked path-condition corridor. Disconnected warm-ground patches remain visible RGB content but are excluded from route measurement.",
    thresholdsChanged: false,
    worldFactsChanged: false,
    conditionChannelsChanged: false,
    imageChanged: false,
  },
  sameImagePreview: {
    passed: preview.passed,
    issueCodes: preview.issues.map((issue) => issue.code),
    pathAudit: previewPathAudit,
  },
  executionBoundary: {
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    inferenceStarted: false,
    newRgbCreated: false,
    sameImageRereviewRequired: true,
    ownerReviewStillRequiresMachinePass: true,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  },
  sourceEvidence: [
    "scripts/lib/ai-assisted-condition-alignment.mjs",
    "scripts/review-ai-assisted-cold-start-image.mjs",
    RECORD_PATH,
    projectPath(oldReviewPath),
  ].map((value) => ({ path: value, sha256: sha256File(value) })),
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: ".runtime/ai-painter/ai-assisted-cold-start/path-false-positive-diagnostics",
  runId,
  fileName: "diagnosis.json",
  record: diagnosis,
  latest: {
    recordId: RECORD_ID,
    imageSha256: record.originalImage.sha256,
    sameImagePreviewPassed: preview.passed,
    thresholdsChanged: false,
  },
})

appendAiPainterProgramEvent({
  action: "diagnose_ai_assisted_cold_start_path_false_positive",
  runId,
  kind: "review_diagnosis",
  status: preview.passed ? "success" : "blocked",
  title: "Disconnected warm-ground path false positive diagnosed",
  titleZh: "已诊断不连通暖色裸地导致的道路误判",
  detail: `recordId=${RECORD_ID}; oldCentroidDistance=${oldPathAudit.centroidDistance}; previewCentroidDistance=${previewPathAudit.centroidDistance}; thresholdsChanged=false; newRgbCreated=false`,
  detailZh: `记录=${RECORD_ID}；旧质心偏移=${oldPathAudit.centroidDistance}；复审预览质心偏移=${previewPathAudit.centroidDistance}；审核门槛未改变；未生成新图`,
  script: "scripts/diagnose-ai-assisted-cold-start-path-false-positive.mjs",
  currentStep: preview.passed ? "same_image_machine_rereview_ready" : "same_image_still_blocked",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: written.runPath,
  nextAction: preview.passed ? "rerun_machine_review_on_same_image" : "stop_and_request_owner_direction",
  nextActionZh: preview.passed ? "对同一张图执行机器复审" : "停止并询问项目所有者",
})

console.log(JSON.stringify({
  status: diagnosis.status,
  runId,
  diagnosisPath: written.runPath,
  sameImagePreviewPassed: preview.passed,
  oldPathCentroidDistance: oldPathAudit.centroidDistance,
  previewPathCentroidDistance: previewPathAudit.centroidDistance,
  rejectedDisconnectedWarmGroundPixels: previewPathAudit.signalIsolation.rejectedPixelCount,
  thresholdsChanged: false,
  newRgbCreated: false,
}, null, 2))

function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(ROOT, value)).replace(/\\/g, "/") }
function assert(condition, message) { if (!condition) throw new Error(message) }
