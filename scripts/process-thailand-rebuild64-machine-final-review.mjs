import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SERIES_ID = "thailand-rebuild64-20260731"
const CONTRACT_PATH = "data/ai-painter/system-governance/thailand-rebuild64-machine-final-review-contract-v1.json"
const AUTHORIZATION_ID = "owner-authorized-thailand-rebuild64-machine-final-review-20260801"
const OWNER_COMMAND_REF = "owner-command-process-previous64-no-manual-screening-problems-direct-failed-20260801"
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const COMPLETE_MAP_ROOT = path.join(LIBRARY_ROOT, "complete-maps")
const OUTPUT_ROOT = ".runtime/ai-painter/thailand-rebuild64-machine-final-reviews"
const REGISTER_CAPACITY = process.argv.includes("--register-capacity")

const authorizationPath = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", AUTHORIZATION_ID, "request.json")
assert(fs.existsSync(authorizationPath), `owner authorization is missing: ${projectPath(authorizationPath)}`)
const authorization = readJson(authorizationPath)
assert(authorization.status === "owner_authorized_pending_execution", "owner authorization is not pending execution")
assert(authorization.ownerDecision?.decision === "authorized", "owner authorization decision is invalid")
assert(authorization.ownerDecision?.commandRef === OWNER_COMMAND_REF, "owner command reference mismatch")
const contract = readJson(path.join(ROOT, CONTRACT_PATH))
assert(contract.status === "active_owner_authorized", "machine final review contract is not active")

const timestamp = new Date().toISOString()
const runId = `thailand-rebuild64-machine-final-review-${timestamp.replace(/[:.]/g, "-")}`
appendAiPainterProgramEvent({
  action: "thailand_rebuild64_machine_final_review",
  runId,
  kind: "review_started",
  status: "running",
  title: "Thailand rebuild64 delegated machine final review started",
  titleZh: "泰国新64组委托机器最终审核开始",
  detail: "Current64 will be re-reviewed; any machine issue is direct failure and no manual per-image screening is required.",
  detailZh: "程序重新审核当前64张；任何机器问题直接未通过，不再要求逐张人工筛选。",
  script: "scripts/process-thailand-rebuild64-machine-final-review.mjs",
  currentStep: "select_current64",
  evidencePath: CONTRACT_PATH,
})

runRequired("build_style_fingerprint", "scripts/build-ai-assisted-style-fingerprint.mjs", [])
const active = selectCurrent64()
const results = []

for (const entry of active) {
  const beforeReview = readRecord(entry.recordId)
  const alreadyCompleted = completedUnderThisBatch(beforeReview) && indexSummaryMatches(beforeReview)
  const reviewProcess = alreadyCompleted
    ? { status: 0, stdout: "batch_checkpoint_reused", stderr: "" }
    : runWithTransientRetries("machine_review", "scripts/review-ai-assisted-cold-start-image.mjs", [
        "--record-id", entry.recordId,
        "--category-id", "complete-maps",
      ])
  const reviewed = alreadyCompleted ? beforeReview : readRecord(entry.recordId)
  const machineReview = readJson(path.join(ROOT, reviewed.reviews.machineReviewPath))
  assert(machineReview.imageSha256 === reviewed.originalImage.sha256, `${entry.recordId}: machine review image hash mismatch`)
  assert(machineReview.passed === (machineReview.issues.length === 0), `${entry.recordId}: machine issue/pass contradiction`)

  if (machineReview.passed) {
    assert(reviewProcess.status === 0, `${entry.recordId}: machine pass process exited nonzero`)
    if (
      reviewed.reviews.ownerReviewStatus === "pending_review"
      || reviewed.aiAssistedColdStartEligible !== true
      || reviewed.conditionBinding?.formalConditionalTrainingEligible !== true
    ) {
      runRequired("delegated_owner_finalization", "scripts/record-ai-assisted-cold-start-owner-review.mjs", [
        "--record-id", entry.recordId,
        "--category-id", "complete-maps",
        "--decision", "approved",
        "--owner-command-ref", OWNER_COMMAND_REF,
        "--comment", "项目所有者明确取消本批逐张人工筛选；本图依据当前机器全部硬门禁通过，按批量委托规则进入成功组。",
        "--review-mode", "owner_delegated_machine_hard_gate_batch",
        "--batch-authorization-ref", AUTHORIZATION_ID,
      ])
    }
  }

  const finalRecord = readRecord(entry.recordId)
  const passed = machineReview.passed
  assert(passed
    ? finalRecord.status === "ai_assisted_cold_start_eligible" && finalRecord.reviews.ownerReviewStatus === "owner_approved"
    : finalRecord.status === "rejected" && finalRecord.reviews.ownerReviewStatus === "not_reached_machine_failed",
  `${entry.recordId}: final classification mismatch`)

  if (passed && REGISTER_CAPACITY && finalRecord.v7CapacityContribution?.status !== "registered") {
    runRequired("register_capacity", "scripts/register-ai-assisted-v7-capacity-contribution.mjs", [
      "--record-id", entry.recordId,
      "--owner-command-ref", OWNER_COMMAND_REF,
    ])
  }

  results.push({
    sequenceNumber: entry.sequenceNumber,
    sequenceCode: String(entry.sequenceNumber).padStart(2, "0"),
    recordId: entry.recordId,
    imageSha256: finalRecord.originalImage.sha256,
    machineReviewId: machineReview.reviewId,
    machineReviewPath: finalRecord.reviews.machineReviewPath,
    machinePassed: passed,
    issueCodes: machineReview.issues.map((issue) => issue.code),
    finalStatus: finalRecord.status,
    ownerReviewStatus: finalRecord.reviews.ownerReviewStatus,
    manualVisualInspectionPerformed: passed ? false : null,
    pageGroup: finalRecord.status === "rejected" ? "failed-records" : "autonomous-generation-training-originals",
  })
}

const success = results.filter((entry) => entry.machinePassed)
const failed = results.filter((entry) => !entry.machinePassed)
const completedAt = new Date().toISOString()
const report = {
  schemaVersion: "thailand-rebuild64-machine-final-review-run-v1",
  runId,
  status: "completed",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  updatedAtUtc: completedAt,
  updatedAtAsiaShanghai: formatShanghai(completedAt),
  seriesId: SERIES_ID,
  contractPath: CONTRACT_PATH,
  contractSha256: sha256File(path.join(ROOT, CONTRACT_PATH)),
  authorizationId: AUTHORIZATION_ID,
  authorizationPath: projectPath(authorizationPath),
  ownerCommandRef: OWNER_COMMAND_REF,
  reviewMode: "owner_delegated_machine_hard_gate_batch",
  manualPerImageScreeningPerformed: false,
  total: results.length,
  successCount: success.length,
  failedCount: failed.length,
  pendingOwnerReviewCount: results.filter((entry) => entry.ownerReviewStatus === "pending_review").length,
  capacityRegistrationRequested: REGISTER_CAPACITY,
  newRgbGenerated: 0,
  gpuTrainingStarted: false,
  runtimeFrameCreated: false,
  worldEntryStarted: false,
  successSequenceCodes: success.map((entry) => entry.sequenceCode),
  failedSequenceCodes: failed.map((entry) => entry.sequenceCode),
  records: results,
}
assert(report.total === 64, "batch report does not contain 64 records")
assert(report.pendingOwnerReviewCount === 0, "manual review queue is not empty")
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "review-report.json",
  record: report,
  latest: {
    seriesId: SERIES_ID,
    successCount: report.successCount,
    failedCount: report.failedCount,
  },
})

appendAiPainterProgramEvent({
  action: "thailand_rebuild64_machine_final_review",
  runId,
  kind: "review_completed",
  status: "success",
  title: "Thailand rebuild64 delegated machine final review completed",
  titleZh: "泰国新64组委托机器最终审核完成",
  detail: `success=${report.successCount}; failed=${report.failedCount}; pendingOwnerReview=0`,
  detailZh: `成功=${report.successCount}；未通过=${report.failedCount}；待人工审核=0。`,
  script: "scripts/process-thailand-rebuild64-machine-final-review.mjs",
  currentStep: "completed",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  evidencePath: stored.runPath,
  nextAction: "owner_may_inspect_batch_results_without_manual_decision_requirement",
  nextActionZh: "项目所有者可查看批量结果，但不再需要逐张决定。",
})

console.log(JSON.stringify({
  status: report.status,
  runId,
  reportPath: stored.runPath,
  successCount: report.successCount,
  failedCount: report.failedCount,
  pendingOwnerReviewCount: report.pendingOwnerReviewCount,
  failedSequenceCodes: report.failedSequenceCodes,
  newRgbGenerated: 0,
  gpuTrainingStarted: false,
}, null, 2))

function selectCurrent64() {
  const records = []
  for (const directory of fs.readdirSync(COMPLETE_MAP_ROOT, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue
    const recordPath = path.join(COMPLETE_MAP_ROOT, directory.name, "record.json")
    if (!fs.existsSync(recordPath)) continue
    const record = readJson(recordPath)
    if (record.rebuild64Sequence?.seriesId !== SERIES_ID) continue
    records.push(record)
  }
  const groups = new Map()
  for (const record of records) {
    const sequenceNumber = record.rebuild64Sequence.sequenceNumber
    assert(Number.isInteger(sequenceNumber) && sequenceNumber >= 1 && sequenceNumber <= 64, `${record.recordId}: invalid sequence number`)
    const current = groups.get(sequenceNumber)
    if (!current || record.createdAtUtc > current.createdAtUtc) groups.set(sequenceNumber, record)
  }
  assert(groups.size === 64, `expected 64 active sequences, found ${groups.size}`)
  return [...groups.entries()].sort(([left], [right]) => left - right).map(([sequenceNumber, record]) => ({
    sequenceNumber,
    recordId: record.recordId,
    createdAtUtc: record.createdAtUtc,
  }))
}

function readRecord(recordId) { return readJson(path.join(COMPLETE_MAP_ROOT, recordId, "record.json")) }
function completedUnderThisBatch(record) {
  const machinePath = record.reviews?.machineReviewPath
  if (!machinePath || !fs.existsSync(path.join(ROOT, machinePath))) return false
  const machineReview = readJson(path.join(ROOT, machinePath))
  if (machineReview.imageSha256 !== record.originalImage?.sha256) return false
  if (machineReview.createdAtUtc < authorization.recordedAtUtc) return false
  if (!machineReview.passed) {
    return record.status === "rejected" && record.reviews?.ownerReviewStatus === "not_reached_machine_failed"
  }
  const ownerPath = record.reviews?.ownerReviewPath
  if (!ownerPath || !fs.existsSync(path.join(ROOT, ownerPath))) return false
  const ownerReview = readJson(path.join(ROOT, ownerPath))
  return ownerReview.imageSha256 === record.originalImage?.sha256
    && ownerReview.decision === "owner_approved"
    && ownerReview.reviewMode === "owner_delegated_machine_hard_gate_batch"
    && ownerReview.batchAuthorizationRef === AUTHORIZATION_ID
    && ownerReview.manualVisualInspectionPerformed === false
}
function indexSummaryMatches(record) {
  const index = readJson(path.join(LIBRARY_ROOT, "index.json"))
  const summary = index.records.find((entry) => entry.recordId === record.recordId)
  return summary?.status === record.status
    && summary?.reviews?.machineReviewStatus === record.reviews?.machineReviewStatus
    && summary?.reviews?.ownerReviewStatus === record.reviews?.ownerReviewStatus
}
function runRequired(step, script, args) {
  const result = runWithTransientRetries(step, script, args)
  assert(result.status === 0, `${step} failed: ${tail(result.stderr || result.stdout)}`)
  return result
}
function runWithTransientRetries(step, script, args) {
  let result
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    result = runAllowFailure(script, args)
    const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`
    if (result.status === 0 || !/EPERM[\s\S]*rename|rename[\s\S]*EPERM/i.test(output)) return result
    if (attempt < 5) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 250)
    }
  }
  assert(false, `${step} exhausted transient file-lock retries: ${tail(result?.stderr || result?.stdout)}`)
}
function runAllowFailure(script, args) {
  return spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
}
function tail(value = "") { return value.trim().split(/\r?\n/).slice(-12).join("\n") }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
