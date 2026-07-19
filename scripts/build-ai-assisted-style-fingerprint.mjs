import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { buildStyleFingerprintModel, extractStyleFeatures } from "./lib/ai-assisted-style-fingerprint.mjs"
import { appendAiPainterProgramEvent, formatShanghai, projectPath, writeImmutableProgramRun } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const WORLD_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const index = readJson(path.join(LIBRARY_ROOT, "index.json"))
const positiveRecords = []
const negativeRecords = []

for (const summary of index.records ?? []) {
  if (summary.categoryId !== "complete-maps") continue
  const record = readJson(path.resolve(ROOT, summary.recordPath))
  if (record.worldBinding?.worldProfileId !== WORLD_PROFILE_ID) continue
  if (
    (record.status === "ai_assisted_cold_start_eligible" && record.reviews?.ownerReviewStatus === "owner_approved")
    || record.reviews?.ownerStyleCalibrationStatus === "owner_approved"
  ) positiveRecords.push(record)
  if (record.reviews?.ownerReviewPath) {
    const review = readJson(path.resolve(ROOT, record.reviews.ownerReviewPath))
    if (review.decision === "owner_rejected" && (review.reasonCodes ?? []).some((code) => /style|camera_scale|object_scale|pixel_texture/.test(code))) {
      negativeRecords.push({ record, review })
    }
  }
}

const positiveSamples = []
for (const record of positiveRecords) positiveSamples.push(await sampleFor(record, null))
const negativeSamples = []
for (const entry of negativeRecords) negativeSamples.push(await sampleFor(entry.record, entry.review))
const model = buildStyleFingerprintModel(positiveSamples, negativeSamples)
const timestamp = new Date().toISOString()
const fingerprintId = `ai-assisted-project-style-fingerprint-${timestamp.replace(/[:.]/g, "-")}`
const fingerprintPath = `.runtime/ai-painter/style-fingerprints/${fingerprintId}/style-fingerprint.json`
const fingerprint = {
  schemaVersion: "ai-assisted-project-style-fingerprint-v1",
  fingerprintId,
  fingerprintPath,
  status: "project_style_fingerprint_ready",
  worldProfileId: WORLD_PROFILE_ID,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  updatedAtUtc: timestamp,
  sourcePolicy: "owner_approved_positive_plus_owner_rejected_style_failure_v1",
  positiveSampleCount: positiveSamples.length,
  negativeSampleCount: negativeSamples.length,
  positiveSamples,
  negativeSamples,
  model,
  automaticStorage: true,
  directTrainingTargetUseAllowed: false,
  ownerReviewStillRequired: true,
}
const stored = writeImmutableProgramRun({
  root: ".runtime/ai-painter/style-fingerprints",
  runId: fingerprintId,
  fileName: "style-fingerprint.json",
  record: fingerprint,
  latest: { fingerprintId, fingerprintPath: `.runtime/ai-painter/style-fingerprints/${fingerprintId}/style-fingerprint.json` },
})
const bytes = fs.readFileSync(path.resolve(ROOT, stored.runPath))
appendAiPainterProgramEvent({
  action: "build_ai_assisted_style_fingerprint",
  runId: fingerprintId,
  kind: "style_fingerprint_built",
  status: "success",
  title: "Project style fingerprint built from persisted owner reviews",
  titleZh: "程序根据已保存的项目所有者审核构建风格指纹",
  detail: `approved=${positiveSamples.length}; rejected=${negativeSamples.length}`,
  detailZh: `已批准样本=${positiveSamples.length}；已拒绝风格样本=${negativeSamples.length}`,
  script: "scripts/build-ai-assisted-style-fingerprint.mjs",
  currentStep: "style_fingerprint_calibration",
  archiveId: fingerprintId,
  evidencePath: stored.runPath,
})
console.log(JSON.stringify({
  status: fingerprint.status,
  fingerprintId,
  fingerprintPath: stored.runPath,
  fingerprintSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  positiveSampleCount: positiveSamples.length,
  negativeSampleCount: negativeSamples.length,
  approvedEnvelopeRadius: model.calibration.approvedEnvelopeRadius,
  rejectedPatternSeparationRatio: model.calibration.rejectedPatternSeparationRatio,
}, null, 2))

async function sampleFor(record, review) {
  const imagePath = path.resolve(path.dirname(path.resolve(ROOT, record.recordPath)), record.originalImage.path)
  const features = await extractStyleFeatures(imagePath)
  if (features.imageSha256 !== record.originalImage.sha256) throw new Error(`style source image hash mismatch: ${record.recordId}`)
  return {
    recordId: record.recordId,
    ownerReviewStatus: record.reviews.ownerReviewStatus ?? record.reviews.ownerStyleCalibrationStatus,
    imagePath: projectPath(imagePath),
    imageSha256: record.originalImage.sha256,
    reasonCodes: review?.reasonCodes ?? [],
    features,
  }
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
