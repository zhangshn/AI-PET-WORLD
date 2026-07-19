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
const recordId = argumentValue("--record-id")
const categoryId = argumentValue("--category-id") ?? "complete-maps"
assert(recordId && /^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId), "--record-id is required")

const timestamp = new Date().toISOString()
const runId = `ai-assisted-cold-start-review-${recordId}-${timestamp.replace(/[:.]/g, "-")}`
const runRoot = ".runtime/ai-painter/ai-assisted-cold-start/review-pipeline-runs"
const recordPath = findRecordPath(categoryId, recordId)
const initialRecord = readJson(recordPath)

appendAiPainterProgramEvent({
  action: "ai_assisted_cold_start_review_pipeline",
  runId,
  kind: "review_started",
  status: "running",
  title: "AI-assisted cold-start candidate review started",
  titleZh: "AI 辅助冷启动候选图自动审核开始",
  detail: `recordId=${recordId}; categoryId=${categoryId}`,
  detailZh: `记录=${recordId}；分类=${categoryId}`,
  script: "scripts/run-ai-assisted-cold-start-review-pipeline.mjs",
  currentStep: "machine_review",
  archiveId: recordId,
  evidencePath: projectPath(recordPath),
})

let report
try {
  const fingerprintProcess = spawnSync(process.execPath, [
    path.join(ROOT, "scripts", "build-ai-assisted-style-fingerprint.mjs"),
  ], { cwd: ROOT, encoding: "utf8", maxBuffer: 40 * 1024 * 1024 })
  assert(fingerprintProcess.status === 0, fingerprintProcess.stderr || fingerprintProcess.stdout || "style fingerprint build failed")
  const styleFingerprint = JSON.parse(fingerprintProcess.stdout)
  const reviewProcess = spawnSync(process.execPath, [
    path.join(ROOT, "scripts", "review-ai-assisted-cold-start-image.mjs"),
    "--record-id", recordId,
    "--category-id", categoryId,
  ], { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })

  const updatedRecord = readJson(recordPath)
  const machineReviewPath = resolveProjectPath(updatedRecord.reviews?.machineReviewPath)
  assert(machineReviewPath && fs.existsSync(machineReviewPath), reviewProcess.stderr || "machine review evidence is missing")
  const machineReview = readJson(machineReviewPath)
  const machineRejected = machineReview.status === "machine_rejected"
  assert(reviewProcess.status === 0 || machineRejected, reviewProcess.stderr || reviewProcess.stdout || "machine review process failed")

  const status = machineRejected ? "machine_rejected_and_archived" : "completed_waiting_owner_review"
  const event = appendAiPainterProgramEvent({
    action: "ai_assisted_cold_start_review_pipeline",
    runId,
    kind: machineRejected ? "step_failed" : "review_completed",
    status: machineRejected ? "failed" : "info",
    title: machineRejected
      ? "AI-assisted cold-start candidate failed machine review"
      : "AI-assisted cold-start candidate awaits owner review",
    titleZh: machineRejected
      ? "AI 辅助冷启动候选图机器审核失败"
      : "AI 辅助冷启动候选图等待项目所有者审核",
    detail: machineRejected
      ? `failureCodes=${machineReview.issues.map((issue) => issue.code).join(",")}`
      : "Machine contract review passed; training remains blocked until owner review.",
    detailZh: machineRejected
      ? `失败码=${machineReview.issues.map((issue) => issue.code).join(",")}`
      : "机器契约审核已通过；在项目所有者审核前仍禁止进入训练。",
    script: "scripts/run-ai-assisted-cold-start-review-pipeline.mjs",
    currentStep: machineRejected ? "failure_backwrite" : "waiting_owner_review",
    error: machineRejected ? "ai_assisted_cold_start_machine_review_failed" : null,
    errorZh: machineRejected ? "AI 辅助冷启动候选图未通过机器审核" : null,
    finalGameMapSuccess: false,
    canEnterWorld: false,
    archiveId: recordId,
    evidencePath: projectPath(machineReviewPath),
    nextAction: machineRejected ? "repair_generation_constraints" : "wait_for_owner_review",
    nextActionZh: machineRejected ? "修复生成约束后创建新候选" : "等待项目所有者审核",
  })

  report = {
    schemaVersion: "ai-assisted-cold-start-review-pipeline-run-v1",
    runId,
    recordId,
    categoryId,
    status,
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    updatedAtUtc: new Date().toISOString(),
    recordPath: projectPath(recordPath),
    imagePath: `${initialRecord.relativeDirectory}/source/original.png`,
    imageSha256: initialRecord.originalImage.sha256,
    machineReviewPath: projectPath(machineReviewPath),
    machineReviewStatus: machineReview.status,
    styleFingerprintId: styleFingerprint.fingerprintId,
    styleFingerprintPath: styleFingerprint.fingerprintPath,
    ownerReviewStatus: updatedRecord.reviews?.ownerReviewStatus ?? (machineRejected ? "not_reached_machine_failed" : "pending_review"),
    trainingEligible: false,
    independentTrainingEligible: false,
    ledgerEventId: event.id,
    automaticStorage: true,
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  const event = appendAiPainterProgramEvent({
    action: "ai_assisted_cold_start_review_pipeline",
    runId,
    kind: "run_failed",
    status: "error",
    title: "AI-assisted cold-start review pipeline failed",
    titleZh: "AI 辅助冷启动自动审核流水线异常",
    detail: message,
    detailZh: `自动审核流水线异常：${message}`,
    script: "scripts/run-ai-assisted-cold-start-review-pipeline.mjs",
    currentStep: "machine_review",
    error: message,
    errorZh: message,
    archiveId: recordId,
    evidencePath: projectPath(recordPath),
  })
  report = {
    schemaVersion: "ai-assisted-cold-start-review-pipeline-run-v1",
    runId,
    recordId,
    categoryId,
    status: "pipeline_error",
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    updatedAtUtc: new Date().toISOString(),
    recordPath: projectPath(recordPath),
    error: message,
    ledgerEventId: event.id,
    automaticStorage: true,
  }
}

const stored = writeImmutableProgramRun({
  root: runRoot,
  runId,
  fileName: "run-report.json",
  record: report,
  latest: { recordId, recordPath: report.recordPath, machineReviewPath: report.machineReviewPath ?? null },
})
const storedReport = { ...report, runReportPath: stored.runPath }
syncConditionalRequestState(recordId, storedReport)
console.log(JSON.stringify(storedReport, null, 2))
if (report.status === "pipeline_error") process.exit(1)

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function resolveProjectPath(value) { return value ? path.resolve(ROOT, value) : null }
function findRecordPath(targetCategoryId, targetRecordId) {
  if (targetCategoryId === "complete-maps") return path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1", targetCategoryId, targetRecordId, "record.json")
  throw new Error(`unsupported category for review pipeline: ${targetCategoryId}`)
}
function syncConditionalRequestState(targetRecordId, currentReport) {
  const pointerPath = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-cold-start", "conditional-rgb-generation-requests", "latest.json")
  if (!fs.existsSync(pointerPath)) return
  const pointer = readJson(pointerPath)
  const requestPath = resolveProjectPath(pointer.requestPath)
  if (!requestPath || !fs.existsSync(requestPath)) return
  const request = readJson(requestPath)
  if (request.outputRecordId !== targetRecordId) return
  const currentRecord = readJson(recordPath)
  const requestStatus = currentReport.status === "machine_rejected_and_archived"
    ? "generated_intaked_machine_rejected"
    : currentReport.status === "completed_waiting_owner_review"
      ? "generated_intaked_machine_passed_waiting_owner_review"
      : "generated_intaked_review_pipeline_error"
  const updatedRequest = {
    ...request,
    status: requestStatus,
    machineReviewStatus: currentReport.machineReviewStatus ?? null,
    machineReviewPath: currentReport.machineReviewPath ?? null,
    ownerReviewStatus: currentRecord.reviews?.ownerReviewStatus ?? currentReport.ownerReviewStatus ?? null,
    conditionalTrainingEligible: false,
    automaticReview: currentReport,
  }
  writeJsonAtomic(requestPath, updatedRequest)
  writeJsonAtomic(path.join(path.dirname(requestPath), "generation-result.json"), updatedRequest)
  writeJsonAtomic(pointerPath, {
    ...pointer,
    status: requestStatus,
    requestPath: projectPath(requestPath),
    originalImageRecordPath: request.originalImageRecordPath ?? projectPath(recordPath),
    machineReviewStatus: updatedRequest.machineReviewStatus,
    ownerReviewStatus: updatedRequest.ownerReviewStatus,
    automaticReviewRunReportPath: currentReport.runReportPath,
  })
}
function writeJsonAtomic(value, body) {
  const tempPath = `${value}.${process.pid}.tmp`
  fs.mkdirSync(path.dirname(value), { recursive: true })
  fs.writeFileSync(tempPath, `${JSON.stringify(body, null, 2)}\n`, "utf8")
  fs.renameSync(tempPath, value)
}
function assert(condition, message) { if (!condition) throw new Error(message) }
