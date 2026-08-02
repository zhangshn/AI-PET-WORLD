import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RECORD_ID = "ai-cold-start-v7-v7-capacity-slot-119-monsoon-grassland-v2"
const CAPACITY_SLOT_ID = "v7-capacity-slot-119"
const OWNER_COMMAND_REF = "project-owner-authorized-slot-119-owner-review-capacity-binding-repair-20260727"
const RECORD_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/record.json`
const INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const CANONICAL_REVIEW_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/reviews/owner-review.json`
const CAPACITY_REVIEW_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/reviews/owner/ai-cold-start-owner-review-${RECORD_ID}-2026-07-27T11-57-29-804Z.json`
const DUPLICATE_REVIEW_PATH = `data/world-samples/original-image-library/natural-home-v1/complete-maps/${RECORD_ID}/reviews/owner/ai-cold-start-owner-review-${RECORD_ID}-2026-07-27T11-58-03-166Z.json`
const CONTRIBUTION_PATH = `.runtime/ai-painter/ai-assisted-v7-capacity-contributions/ai-assisted-v7-capacity-contribution-${CAPACITY_SLOT_ID}-2026-07-27T11-57-29-993Z/contribution.json`
const CAPACITY_REVIEW_SHA256 = "e0a3bbcbd82d016869b3b525ae5a517997448d52495436c2271c68eb51f06e82"
const DUPLICATE_REVIEW_SHA256 = "6c1b072e0d1abe7e8a51d08b94577820e6138a6b67f34f071de0f9ae963c0fae"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-v7-owner-review-capacity-binding-repairs"
const FAILURE_ROOT = ".runtime/ai-painter/ai-assisted-v7-owner-review-capacity-binding-repair-failures"

let repairCompleted = false
let failureStored = false
installFailureHandler()

const timestamp = new Date().toISOString()
const runId = `ai-assisted-v7-owner-review-capacity-binding-repair-${CAPACITY_SLOT_ID}-${timestamp.replace(/[:.]/g, "-")}`
const recordPath = resolveProjectPath(RECORD_PATH)
const indexPath = resolveProjectPath(INDEX_PATH)
const canonicalReviewPath = resolveProjectPath(CANONICAL_REVIEW_PATH)
const capacityReviewPath = resolveProjectPath(CAPACITY_REVIEW_PATH)
const duplicateReviewPath = resolveProjectPath(DUPLICATE_REVIEW_PATH)
const contributionPath = resolveProjectPath(CONTRIBUTION_PATH)

for (const requiredPath of [
  recordPath,
  indexPath,
  canonicalReviewPath,
  capacityReviewPath,
  duplicateReviewPath,
  contributionPath,
]) {
  assert(fs.existsSync(requiredPath), `required repair evidence missing: ${projectPath(requiredPath)}`)
}

const capacityReviewBytes = fs.readFileSync(capacityReviewPath)
const duplicateReviewBytes = fs.readFileSync(duplicateReviewPath)
const canonicalBeforeBytes = fs.readFileSync(canonicalReviewPath)
const capacityReview = JSON.parse(capacityReviewBytes.toString("utf8"))
const duplicateReview = JSON.parse(duplicateReviewBytes.toString("utf8"))
const contribution = readJson(contributionPath)
const record = readJson(recordPath)
const index = readJson(indexPath)
const canonicalBeforeSha256 = sha256(canonicalBeforeBytes)

assert(sha256(capacityReviewBytes) === CAPACITY_REVIEW_SHA256, "capacity-bound immutable owner review hash mismatch")
assert(sha256(duplicateReviewBytes) === DUPLICATE_REVIEW_SHA256, "duplicate immutable owner review hash mismatch")
assert(
  canonicalBeforeSha256 === DUPLICATE_REVIEW_SHA256 || canonicalBeforeSha256 === CAPACITY_REVIEW_SHA256,
  "canonical owner review has an unexpected third hash",
)
assert(capacityReview.recordId === RECORD_ID && duplicateReview.recordId === RECORD_ID, "owner review record identity mismatch")
assert(capacityReview.decision === "owner_approved" && duplicateReview.decision === "owner_approved", "owner review decisions conflict")
assert(capacityReview.imageSha256 === duplicateReview.imageSha256, "owner review image identities conflict")
assert(contribution.recordId === RECORD_ID, "capacity contribution record identity mismatch")
assert(contribution.capacitySlotId === CAPACITY_SLOT_ID, "capacity contribution slot identity mismatch")
assert(contribution.ownerReviewPath === CANONICAL_REVIEW_PATH, "capacity contribution canonical review path mismatch")
assert(contribution.ownerReviewSha256 === CAPACITY_REVIEW_SHA256, "capacity contribution owner review hash mismatch")
assert(record.recordId === RECORD_ID, "original-image record identity mismatch")
assert(record.reviews?.ownerReviewStatus === "owner_approved", "original-image record is not owner approved")
assert(record.reviews?.ownerReviewPath === CANONICAL_REVIEW_PATH, "original-image record canonical review path mismatch")
assert(record.originalImage?.sha256 === capacityReview.imageSha256, "owner review and original image identities differ")
assert(record.v7CapacityContribution?.capacitySlotId === CAPACITY_SLOT_ID, "record capacity contribution slot mismatch")
assert(record.v7CapacityContribution?.contributionPath === CONTRIBUTION_PATH, "record capacity contribution path mismatch")
assert(
  record.autonomousGenerationTrainingOriginal?.ownerCommandRef === capacityReview.ownerCommandRef,
  "record autonomous training identity is not bound to the capacity owner review",
)

const indexedRecordPosition = (index.records ?? []).findIndex((entry) => entry.recordId === RECORD_ID)
assert(indexedRecordPosition >= 0, "original-image library index record missing")

writeBytesAtomic(canonicalReviewPath, capacityReviewBytes)
assert(sha256File(canonicalReviewPath) === CAPACITY_REVIEW_SHA256, "canonical owner review restore hash mismatch")

const repairedAtAsiaShanghai = formatShanghai(timestamp)
const repairedRecord = {
  ...record,
  copiedArtifacts: {
    ...record.copiedArtifacts,
    reviews: (record.copiedArtifacts?.reviews ?? []).map((item) => item.path === CANONICAL_REVIEW_PATH
      ? { ...item, sha256: CAPACITY_REVIEW_SHA256 }
      : item),
  },
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: repairedAtAsiaShanghai,
}
assert(
  repairedRecord.copiedArtifacts.reviews.some(
    (item) => item.path === CANONICAL_REVIEW_PATH && item.sha256 === CAPACITY_REVIEW_SHA256,
  ),
  "record copied owner-review artifact summary was not repaired",
)
writeJsonAtomic(recordPath, repairedRecord)

const repairedIndexRecord = {
  ...index.records[indexedRecordPosition],
  title: repairedRecord.title,
  status: repairedRecord.status,
  conditionBinding: repairedRecord.conditionBinding,
  reviews: repairedRecord.reviews,
  blockReasons: repairedRecord.blockReasons,
  autonomousGenerationTrainingOriginal: repairedRecord.autonomousGenerationTrainingOriginal,
  trainingEligibility: repairedRecord.trainingEligibility,
  aiAssistedColdStartEligible: repairedRecord.aiAssistedColdStartEligible,
  independentTrainingEligible: repairedRecord.independentTrainingEligible,
  v7CapacityContribution: repairedRecord.v7CapacityContribution,
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: repairedAtAsiaShanghai,
}
const repairedIndexRecords = [...index.records]
repairedIndexRecords[indexedRecordPosition] = repairedIndexRecord
writeJsonAtomic(indexPath, {
  ...index,
  updatedAt: timestamp,
  records: repairedIndexRecords,
})

for (const artifactPath of [
  canonicalReviewPath,
  capacityReviewPath,
  duplicateReviewPath,
  contributionPath,
  recordPath,
  indexPath,
]) {
  indexWrittenArtifact(artifactPath, runId)
}

const report = {
  schemaVersion: "ai-assisted-v7-owner-review-capacity-binding-repair-v1",
  runId,
  status: "completed",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: repairedAtAsiaShanghai,
  ownerCommandRef: OWNER_COMMAND_REF,
  recordId: RECORD_ID,
  capacitySlotId: CAPACITY_SLOT_ID,
  reason: "A second owner-approved review replaced the canonical owner-review pointer after capacity registration and changed its hash.",
  reasonZh: "容量登记后第二次项目所有者通过记录替换了公共 owner-review 指针并改变其哈希。",
  capacityContributionPath: CONTRIBUTION_PATH,
  capacityContributionOwnerReviewPath: contribution.ownerReviewPath,
  capacityContributionOwnerReviewSha256: contribution.ownerReviewSha256,
  canonicalOwnerReviewPath: CANONICAL_REVIEW_PATH,
  canonicalOwnerReviewSha256Before: canonicalBeforeSha256,
  canonicalOwnerReviewSha256After: sha256File(canonicalReviewPath),
  capacityBoundImmutableReviewPath: CAPACITY_REVIEW_PATH,
  capacityBoundImmutableReviewSha256: sha256File(capacityReviewPath),
  duplicateApprovedImmutableReviewPath: DUPLICATE_REVIEW_PATH,
  duplicateApprovedImmutableReviewSha256: sha256File(duplicateReviewPath),
  bothImmutableReviewHistoriesPreserved: true,
  reviewDecisionChanged: false,
  imageChanged: false,
  worldFactsChanged: false,
  conditionGeometryChanged: false,
  reviewThresholdsChanged: false,
  recordPath: RECORD_PATH,
  recordSha256After: sha256File(recordPath),
  indexPath: INDEX_PATH,
  indexSha256After: sha256File(indexPath),
  automaticStorage: true,
  imageGenerated: false,
  gpuTrainingStarted: false,
  runtimeStarted: false,
  worldPageChanged: false,
}
const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "repair-report.json",
  record: report,
  latest: {
    recordId: RECORD_ID,
    capacitySlotId: CAPACITY_SLOT_ID,
    canonicalOwnerReviewSha256After: report.canonicalOwnerReviewSha256After,
  },
})
appendAiPainterProgramEvent({
  action: "repair_ai_assisted_v7_owner_review_capacity_binding",
  runId,
  kind: "repair_completed",
  status: "success",
  title: "V7 owner-review capacity binding repaired",
  titleZh: "V7 项目所有者审核与容量绑定已修复",
  detail: "The program restored the capacity-bound owner review as the canonical pointer while preserving both immutable approved review histories.",
  detailZh: "程序已将容量贡献绑定的项目所有者审核恢复为公共指针，并保留两份不可变的通过审核历史。",
  script: "scripts/repair-ai-assisted-v7-slot-119-owner-review-capacity-binding.mjs",
  currentStep: "slot_119_owner_review_capacity_binding_repaired",
  evidencePath: written.runPath,
  evidence: [
    written.runPath,
    CANONICAL_REVIEW_PATH,
    CAPACITY_REVIEW_PATH,
    DUPLICATE_REVIEW_PATH,
    CONTRIBUTION_PATH,
    RECORD_PATH,
    INDEX_PATH,
  ],
})

repairCompleted = true
console.log(JSON.stringify({ ...report, reportPath: written.runPath }, null, 2))

function installFailureHandler() {
  process.once("uncaughtException", (error) => {
    persistFailure(error)
    console.error(error)
    process.exitCode = 1
  })
}

function persistFailure(error) {
  if (repairCompleted || failureStored) return
  failureStored = true
  const failureTimestamp = new Date().toISOString()
  const failureRunId = `ai-assisted-v7-owner-review-capacity-binding-repair-failure-${CAPACITY_SLOT_ID}-${failureTimestamp.replace(/[:.]/g, "-")}`
  const failure = {
    schemaVersion: "ai-assisted-v7-owner-review-capacity-binding-repair-failure-v1",
    runId: failureRunId,
    status: "failed",
    createdAtUtc: failureTimestamp,
    createdAtAsiaShanghai: formatShanghai(failureTimestamp),
    ownerCommandRef: OWNER_COMMAND_REF,
    recordId: RECORD_ID,
    capacitySlotId: CAPACITY_SLOT_ID,
    failureCode: error?.code ?? "owner_review_capacity_binding_repair_failed",
    failureMessage: error?.message ?? String(error),
    canonicalOwnerReviewPath: CANONICAL_REVIEW_PATH,
    canonicalOwnerReviewSha256AtFailure: safeSha256(CANONICAL_REVIEW_PATH),
    capacityBoundImmutableReviewPath: CAPACITY_REVIEW_PATH,
    capacityBoundImmutableReviewSha256: safeSha256(CAPACITY_REVIEW_PATH),
    duplicateApprovedImmutableReviewPath: DUPLICATE_REVIEW_PATH,
    duplicateApprovedImmutableReviewSha256: safeSha256(DUPLICATE_REVIEW_PATH),
    imageGenerated: false,
    gpuTrainingStarted: false,
    automaticStorage: true,
  }
  try {
    const written = writeImmutableProgramRun({
      root: FAILURE_ROOT,
      runId: failureRunId,
      fileName: "failure.json",
      record: failure,
      latest: { recordId: RECORD_ID, capacitySlotId: CAPACITY_SLOT_ID },
    })
    appendAiPainterProgramEvent({
      action: "repair_ai_assisted_v7_owner_review_capacity_binding",
      runId: failureRunId,
      kind: "repair_failed",
      status: "failed",
      title: "V7 owner-review capacity binding repair failed",
      titleZh: "V7 项目所有者审核与容量绑定修复失败",
      detail: failure.failureMessage,
      detailZh: `修复失败：${failure.failureMessage}`,
      script: "scripts/repair-ai-assisted-v7-slot-119-owner-review-capacity-binding.mjs",
      currentStep: "slot_119_owner_review_capacity_binding_repair_failed",
      errorCode: failure.failureCode,
      evidencePath: written.runPath,
      evidence: [written.runPath],
    })
  } catch (storageError) {
    console.error(`failed to persist repair failure: ${storageError?.message ?? storageError}`)
  }
}

function indexWrittenArtifact(filePath, runId) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256File(filePath),
  })
}

function writeBytesAtomic(filePath, bytes) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, bytes)
  fs.renameSync(temporaryPath, filePath)
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(value, "utf8"))
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function sha256File(value) {
  return sha256(fs.readFileSync(value))
}

function safeSha256(value) {
  try {
    const resolved = resolveProjectPath(value)
    return fs.existsSync(resolved) ? sha256File(resolved) : null
  } catch {
    return null
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
