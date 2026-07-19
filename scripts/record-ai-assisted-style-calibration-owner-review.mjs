import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const recordId = argumentValue("--record-id")
const categoryId = argumentValue("--category-id") ?? "complete-maps"
const ownerCommandRef = argumentValue("--owner-command-ref")
const comment = argumentValue("--comment") ?? ""

assert(recordId && /^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId), "--record-id is required")
assert(ownerCommandRef, "--owner-command-ref is required")

const recordPath = findRecordPath(categoryId, recordId)
const record = readJson(recordPath)
const machineReviewPath = path.resolve(ROOT, record.reviews?.machineReviewPath ?? "")
assert(isWithin(ROOT, machineReviewPath) && fs.existsSync(machineReviewPath), "machine review is missing")
const machineReview = readJson(machineReviewPath)
const issueCodes = (machineReview.issues ?? []).map((issue) => issue.code)
assert(machineReview.status === "machine_rejected", "style calibration review requires a machine-rejected record")
assert(issueCodes.length > 0, "machine review has no style issue")
assert(issueCodes.every((code) => code === "style_fingerprint_outside_approved_envelope"), "style calibration cannot override non-style machine failures")
assert(machineReview.sourceResolutionAudit?.passed === true, "source resolution audit must pass")
assert(machineReview.compositionNoveltyAudit?.passed === true, "composition novelty audit must pass")
assert(machineReview.semanticConditionAudit?.passed !== false, "semantic condition audit must pass")

const timestamp = new Date().toISOString()
const review = {
  schemaVersion: "ai-assisted-style-calibration-owner-review-v1",
  reviewId: `ai-assisted-style-calibration-owner-review-${recordId}-${timestamp.replace(/[:.]/g, "-")}`,
  recordId,
  reviewerRole: "project_owner",
  decision: "owner_approved_style_calibration",
  scope: "style_fingerprint_positive_sample_only",
  ownerCommandRef,
  comment,
  machineReviewPath: projectPath(machineReviewPath),
  machineIssueCodes: issueCodes,
  trainingEligibilityGranted: false,
  runtimeEligibilityGranted: false,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  automaticStorage: true,
}
const recordDirectory = path.dirname(recordPath)
const reviewPath = path.join(recordDirectory, "reviews", "style-calibration-owner-review.json")
const historyPath = path.join(recordDirectory, "reviews", "style-calibration-owner", `${review.reviewId}.json`)
writeJsonAtomic(historyPath, review)
writeJsonAtomic(reviewPath, review)

const updatedRecord = {
  ...record,
  reviews: {
    ...record.reviews,
    ownerStyleCalibrationStatus: "owner_approved",
    ownerStyleCalibrationPath: projectPath(reviewPath),
  },
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: formatShanghai(timestamp),
}
writeJsonAtomic(recordPath, updatedRecord)
updateIndex(updatedRecord)
appendJsonLine(path.join(LIBRARY_ROOT, "events.jsonl"), {
  schemaVersion: "original-image-library-event-v1",
  action: "ai_assisted_style_calibration_owner_review_recorded",
  recordId,
  categoryId,
  decision: review.decision,
  ownerCommandRef,
  reviewPath: projectPath(reviewPath),
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: review.createdAtAsiaShanghai,
})
const ledgerEvent = appendAiPainterProgramEvent({
  action: "record_ai_assisted_style_calibration_owner_review",
  runId: review.reviewId,
  kind: "review_completed",
  status: "success",
  title: "Project owner approved image for style fingerprint calibration",
  titleZh: "项目所有者批准图片进入风格指纹校准",
  detail: `recordId=${recordId}; training eligibility remains pending machine re-review`,
  detailZh: `记录=${recordId}；训练资格仍等待机器复审`,
  script: "scripts/record-ai-assisted-style-calibration-owner-review.mjs",
  currentStep: "style_fingerprint_calibration_owner_approved",
  archiveId: recordId,
  evidencePath: projectPath(historyPath),
  finalGameMapSuccess: false,
  canEnterWorld: false,
  nextAction: "rebuild_style_fingerprint_and_rerun_machine_review",
  nextActionZh: "重建风格指纹并重新执行机器审核",
})

console.log(JSON.stringify({ review, recordId, reviewPath: projectPath(reviewPath), ledgerEventId: ledgerEvent.id }, null, 2))

function updateIndex(value) {
  const indexPath = path.join(LIBRARY_ROOT, "index.json")
  const index = readJson(indexPath)
  const records = index.records.map((item) => item.recordId === value.recordId ? {
    ...item,
    reviews: value.reviews,
    updatedAtUtc: value.updatedAtUtc,
    updatedAtAsiaShanghai: value.updatedAtAsiaShanghai,
  } : item)
  writeJsonAtomic(indexPath, { ...index, updatedAt: value.updatedAtUtc, records })
}

function findRecordPath(targetCategoryId, targetRecordId) {
  const value = path.join(LIBRARY_ROOT, targetCategoryId, targetRecordId, "record.json")
  assert(isWithin(LIBRARY_ROOT, value) && fs.existsSync(value), "original image record is missing")
  return value
}
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  fs.renameSync(temporary, filePath)
}
function appendJsonLine(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8")
}
function isWithin(parent, child) {
  const root = path.resolve(parent)
  const target = path.resolve(child)
  return target === root || target.startsWith(`${root}${path.sep}`)
}
function assert(condition, message) { if (!condition) throw new Error(message) }
