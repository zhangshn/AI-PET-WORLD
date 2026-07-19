import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  projectPath as ledgerProjectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const recordId = argumentValue("--record-id")
const categoryId = argumentValue("--category-id") ?? "complete-maps"
const decision = argumentValue("--decision")
const ownerCommandRef = argumentValue("--owner-command-ref")
const comment = argumentValue("--comment") ?? ""
const reasonCodes = csvArgument("--reason-codes")
const reasonCodesZh = csvArgument("--reason-codes-zh")
const affectedRegions = csvArgument("--affected-regions")
const nextTrainingTarget = argumentValue("--next-training-target")
const autonomousSequence = numericArgument("--autonomous-sequence")

assert(recordId && /^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId), "--record-id is required")
assert(["approved", "rejected"].includes(decision), "--decision must be approved or rejected")
assert(ownerCommandRef, "--owner-command-ref is required")
if (decision === "rejected") {
  assert(reasonCodes.length > 0, "--reason-codes is required for rejection")
  assert(reasonCodesZh.length === reasonCodes.length, "--reason-codes-zh must match --reason-codes")
  assert(affectedRegions.length > 0, "--affected-regions is required for rejection")
  assert(nextTrainingTarget, "--next-training-target is required for rejection")
}
if (autonomousSequence != null) {
  assert(decision === "approved", "--autonomous-sequence is only valid for approval")
  assert(Number.isInteger(autonomousSequence) && autonomousSequence > 0, "--autonomous-sequence must be a positive integer")
  assertSequenceAvailable(autonomousSequence, recordId)
}

const recordPath = findRecordPath(categoryId, recordId)
assert(fs.existsSync(recordPath), "AI cold-start original image record is missing")
const record = readJson(recordPath)
assert(record.categoryId === categoryId, "record category mismatch")
assert(record.aiAssistedColdStart?.policyVersion === "owner-authorized-ai-assisted-cold-start-v1", "record is not in the authorized AI cold-start lane")
assert(record.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review", "owner approval requires a passed machine contract review")

const timestamp = new Date().toISOString()
const approved = decision === "approved"
const review = {
  schemaVersion: "ai-assisted-cold-start-owner-review-v1",
  reviewId: `ai-cold-start-owner-review-${recordId}-${timestamp.replace(/[:.]/g, "-")}`,
  recordId,
  reviewerRole: "project_owner",
  decision: approved ? "owner_approved" : "owner_rejected",
  ownerCommandRef,
  comment,
  reasonCodes,
  reasonCodesZh,
  affectedRegions,
  nextTrainingTarget: nextTrainingTarget ?? null,
  imagePath: `${record.relativeDirectory}/source/original.png`,
  imageSha256: record.originalImage.sha256,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  aiAssistedColdStartEligible: approved,
  independentTrainingEligible: false,
  gameUseContract: {
    role: "rgb_visual_training_original",
    directWorldDisplayAllowed: false,
    directRuntimeFrameUseAllowed: false,
    requiresWorldFactsAnd23ChannelBinding: true,
    requiresWalkableCollisionAndObjectIdentityLayers: true,
  },
  automaticStorage: true,
  autonomousGenerationTrainingOriginal: autonomousSequence == null ? null : {
    contractVersion: "autonomous-generation-training-original-v1",
    sequenceNumber: autonomousSequence,
    sequenceLabel: `自主生成训练原图第${String(autonomousSequence).padStart(3, "0")}张`,
  },
}
const reviewPath = path.join(path.dirname(recordPath), "reviews", "owner-review.json")
const reviewHistoryPath = path.join(path.dirname(recordPath), "reviews", "owner", `${review.reviewId}.json`)
writeJsonAtomic(reviewHistoryPath, review)
writeJsonAtomic(reviewPath, review)

const updatedRecord = {
  ...record,
  title: approved && autonomousSequence != null
    ? `自主生成训练原图第${String(autonomousSequence).padStart(3, "0")}张：${record.classification?.regionalLandscapeType ?? record.recordId}`
    : record.title,
  status: approved ? "ai_assisted_cold_start_eligible" : "rejected",
  blockReasons: approved ? [] : ["owner_visual_review_rejected"],
  reviews: {
    ...record.reviews,
    ownerReviewStatus: review.decision,
    ownerReviewPath: projectPath(reviewPath),
    ipReviewStatus: approved ? "owner_authorized_ai_cold_start_approved" : "owner_authorized_ai_cold_start_rejected_visual",
  },
  conditionBinding: record.conditionBinding
    ? {
        ...record.conditionBinding,
        status: approved && readJson(record.reviews.machineReviewPath).semanticConditionAudit?.passed === true
          ? "formal_conditional_training_eligible_owner_approved"
          : record.conditionBinding.status,
        formalConditionalTrainingEligible: approved
          && readJson(record.reviews.machineReviewPath).semanticConditionAudit?.passed === true,
      }
    : record.conditionBinding,
  classification: approved && autonomousSequence != null
    ? { ...record.classification, knowledgeRole: "autonomous_generation_complete_game_map_training_original" }
    : record.classification,
  autonomousGenerationTrainingOriginal: approved && autonomousSequence != null
    ? {
        contractVersion: "autonomous-generation-training-original-v1",
        sequenceNumber: autonomousSequence,
        sequenceLabel: `自主生成训练原图第${String(autonomousSequence).padStart(3, "0")}张`,
        ownerReviewDecision: "owner_approved",
        ownerCommandRef,
        ownerReviewPath: projectPath(reviewPath),
      }
    : record.autonomousGenerationTrainingOriginal,
  copiedArtifacts: {
    ...record.copiedArtifacts,
    reviews: [
      ...(record.copiedArtifacts?.reviews ?? []).filter((item) => item.path !== projectPath(reviewPath)),
      { path: projectPath(reviewPath), sha256: sha256File(reviewPath) },
    ],
  },
  trainingEligibility: approved ? "ai_assisted_cold_start_eligible" : "owner_rejected",
  aiAssistedColdStartEligible: approved,
  independentTrainingEligible: false,
  gameUseContract: review.gameUseContract,
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: formatShanghai(timestamp),
}
writeJsonAtomic(recordPath, updatedRecord)
updateIndex(updatedRecord)
const conditionalRequestUpdate = updateConditionalGenerationRequest({
  record: updatedRecord,
  review,
  reviewPath,
  approved,
  timestamp,
})
appendJsonLine(path.join(LIBRARY_ROOT, "events.jsonl"), {
  schemaVersion: "original-image-library-event-v1",
  action: "ai_assisted_cold_start_owner_review_recorded",
  recordId,
  categoryId: updatedRecord.categoryId,
  decision: review.decision,
  status: updatedRecord.status,
  ownerCommandRef,
  reviewPath: projectPath(reviewPath),
  reviewHistoryPath: projectPath(reviewHistoryPath),
  reasonCodes,
  affectedRegions,
  nextTrainingTarget: nextTrainingTarget ?? null,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
})

const ledgerEvent = appendAiPainterProgramEvent({
  action: "review_ai_assisted_cold_start_owner",
  runId: review.reviewId,
  kind: approved ? "review_completed" : "step_failed",
  status: approved ? "success" : "failed",
  title: approved
    ? "Project owner approved AI-assisted cold-start image"
    : "Project owner rejected AI-assisted cold-start image",
  titleZh: approved
    ? "项目所有者通过 AI 辅助冷启动原图"
    : "项目所有者拒绝 AI 辅助冷启动原图",
  detail: approved
    ? "The image may enter the AI-assisted cold-start lane after package validation."
    : `failureCodes=${reasonCodes.join(",")}; nextTrainingTarget=${nextTrainingTarget}`,
  detailZh: approved
    ? "图片可在数据包重新验证后进入 AI 辅助冷启动训练通道。"
    : `失败码=${reasonCodes.join(",")}；下一训练目标=${nextTrainingTarget}`,
  script: "scripts/record-ai-assisted-cold-start-owner-review.mjs",
  currentStep: approved ? "owner_review_approved" : "failure_backwrite",
  error: approved ? null : "owner_rejected_ai_assisted_cold_start_visual",
  errorZh: approved ? null : "项目所有者拒绝 AI 辅助冷启动视觉质量",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: recordId,
  evidencePath: ledgerProjectPath(reviewHistoryPath),
  nextAction: approved ? "rebuild_ai_assisted_dataset_package" : "repair_style_and_generate_new_candidate",
  nextActionZh: approved ? "重新构建 AI 辅助数据包" : "修复风格一致性并生成新候选图",
})

let failureRecordPath = null
if (!approved) {
  const failureRecord = {
    schemaVersion: "ai-assisted-cold-start-owner-failure-v1",
    failureId: `ai-assisted-cold-start-owner-failure-${recordId}-${timestamp.replace(/[:.]/g, "-")}`,
    status: "owner_rejected",
    recordId,
    imagePath: `${record.relativeDirectory}/source/original.png`,
    imageSha256: record.originalImage.sha256,
    reasonCodes,
    reasonCodesZh,
    affectedRegions,
    rootCauses: reasonCodes,
    nextTrainingTarget,
    nextTaskConstraint: "A new image must use the same approved world facts and conditions while repairing every recorded style failure.",
    nextTaskConstraintZh: "下一张图片必须保留相同的已批准世界事实和条件，同时修复本次记录的全部风格失败。",
    ownerCommandRef,
    ownerReviewPath: projectPath(reviewHistoryPath),
    ledgerEventId: ledgerEvent.id,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    automaticStorage: true,
    trainingUsage: "negative_failure_learning_only",
    mustNotTrainAsPositive: true,
  }
  const failureRun = writeImmutableProgramRun({
    root: ".runtime/ai-painter/auto-visual-judge-learning/original-image-owner-failures",
    runId: failureRecord.failureId,
    fileName: "failure-record.json",
    record: failureRecord,
    latest: { recordId, imageSha256: failureRecord.imageSha256 },
  })
  failureRecordPath = failureRun.runPath
  refreshGameMapAutoVisualJudgeLearning({
    trigger: "ai_assisted_cold_start_owner_rejected",
    triggerEventId: ledgerEvent.id,
  })
}

console.log(JSON.stringify({ review, record: updatedRecord, conditionalRequestUpdate, failureRecordPath, ledgerEventId: ledgerEvent.id }, null, 2))

function updateIndex(value) {
  const indexPath = path.join(LIBRARY_ROOT, "index.json")
  const index = readJson(indexPath)
  const records = index.records.map((item) => item.recordId === value.recordId ? {
    ...item,
    status: value.status,
    blockReasons: value.blockReasons,
    reviews: value.reviews,
    title: value.title,
    classification: value.classification,
    autonomousGenerationTrainingOriginal: value.autonomousGenerationTrainingOriginal,
    trainingEligibility: value.trainingEligibility,
    aiAssistedColdStartEligible: value.aiAssistedColdStartEligible,
    independentTrainingEligible: false,
    updatedAtUtc: value.updatedAtUtc,
    updatedAtAsiaShanghai: value.updatedAtAsiaShanghai,
  } : item)
  writeJsonAtomic(indexPath, { ...index, updatedAt: value.updatedAtUtc, records })
}

function updateConditionalGenerationRequest({ record, review, reviewPath, approved, timestamp }) {
  const promptEvidencePath = record.aiAssistedColdStart?.promptEvidencePath
  if (!promptEvidencePath) return null
  const requestPath = path.join(path.dirname(path.resolve(ROOT, promptEvidencePath)), "request.json")
  if (!fs.existsSync(requestPath)) return null
  const request = readJson(requestPath)
  assert(request.outputRecordId === record.recordId, "conditional RGB request record identity mismatch")
  const status = approved
    ? "generated_intaked_machine_passed_owner_approved"
    : "generated_intaked_machine_passed_owner_rejected"
  const updatedRequest = {
    ...request,
    status,
    ownerReviewStatus: review.decision,
    ownerReviewPath: projectPath(reviewPath),
    updatedAtUtc: timestamp,
    updatedAtAsiaShanghai: formatShanghai(timestamp),
  }
  writeJsonAtomic(requestPath, updatedRequest)

  const latestPath = path.join(path.dirname(requestPath), "..", "latest.json")
  if (fs.existsSync(latestPath)) {
    const latest = readJson(latestPath)
    if (path.resolve(ROOT, latest.requestPath ?? "") === requestPath) {
      writeJsonAtomic(latestPath, {
        ...latest,
        status,
        ownerReviewStatus: review.decision,
        ownerReviewPath: projectPath(reviewPath),
        updatedAtUtc: timestamp,
        updatedAtAsiaShanghai: formatShanghai(timestamp),
      })
    }
  }
  return { requestPath: projectPath(requestPath), status }
}

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function numericArgument(name) { const value = argumentValue(name); return value == null ? null : Number(value) }
function assertSequenceAvailable(sequenceNumber, currentRecordId) {
  const index = readJson(path.join(LIBRARY_ROOT, "index.json"))
  const conflict = index.records.find((item) =>
    item.recordId !== currentRecordId
    && item.autonomousGenerationTrainingOriginal?.sequenceNumber === sequenceNumber,
  )
  assert(!conflict, `autonomous generation training sequence already used by ${conflict?.recordId}`)
}
function csvArgument(name) { return (argumentValue(name) ?? "").split(",").map((value) => value.trim()).filter(Boolean) }
function findRecordPath(targetCategoryId, targetRecordId) {
  if (targetCategoryId === "complete-maps") return path.join(LIBRARY_ROOT, targetCategoryId, targetRecordId, "record.json")
  const categoryRoot = path.join(LIBRARY_ROOT, targetCategoryId)
  assert(fs.existsSync(categoryRoot), `original image category directory is missing: ${targetCategoryId}`)
  const matches = []
  collectRecordMatches(categoryRoot, targetRecordId, matches)
  assert(matches.length === 1, `expected one record for ${targetCategoryId}/${targetRecordId}, found ${matches.length}`)
  return matches[0]
}
function collectRecordMatches(directory, targetRecordId, matches) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    const child = path.join(directory, entry.name)
    if (entry.name === targetRecordId && fs.existsSync(path.join(child, "record.json"))) matches.push(path.join(child, "record.json"))
    else collectRecordMatches(child, targetRecordId, matches)
  }
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJsonAtomic(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const temp = `${value}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(body, null, 2)}\n`); fs.renameSync(temp, value) }
function appendJsonLine(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.appendFileSync(value, `${JSON.stringify(body)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
