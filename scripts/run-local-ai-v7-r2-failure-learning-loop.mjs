import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { analyzeFailureLearningLoop } from "./lib/ai-assisted-failure-learning-loop.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const FINALIZATION_PATH = ".runtime/ai-painter/v7-bounded-repair-r2-overfit-smoke-finalizations/ai-assisted-v7-r2-overfit-smoke-finalization-reconciled-20260803/finalization-report.json"
const OVERLAY_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json"
const OUTPUT_ROOT = ".runtime/ai-painter/local-ai-failure-learning"
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-local-ai-failure-learning-closed-loop-phase1-20260804/request.json"
const AUTHORIZATION_SHA256 = "c869f97bae2fd2cac03a069f4cdb100c6d2ccb3446f4214908f7fef30adb1040"
const CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-local-ai-failure-learning-closed-loop-phase1-20260804/failure-learning-phase1-implementation-consumption.json"

verifyAuthorization()
const finalization = readJson(FINALIZATION_PATH)
assert(fileHashMatches(finalization.previewReviewPath, finalization.previewReviewSha256), "failure_learning_source_review_hash_mismatch")
const review = readJson(finalization.previewReviewPath)
const overlay = readJson(OVERLAY_PATH)
const now = new Date().toISOString()
const analysisId = `local-ai-v7-r2-failure-learning-${now.replace(/[:.]/g, "-")}`
const analysis = analyzeFailureLearningLoop({
  review,
  finalization,
  overlay,
  sourcePaths: [
    { path: FINALIZATION_PATH, sha256: sha256File(FINALIZATION_PATH) },
    { path: finalization.previewReviewPath, sha256: finalization.previewReviewSha256 },
    { path: OVERLAY_PATH, sha256: sha256File(OVERLAY_PATH) },
  ],
})
const report = {
  ...analysis,
  analysisId,
  createdAtUtc: now,
  createdAtAsiaShanghai: formatShanghai(now),
  generatedBy: "local_ai_failure_learning_program",
  authorizationPath: AUTHORIZATION_PATH,
  authorizationSha256: AUTHORIZATION_SHA256,
  authorizationConsumptionPath: CONSUMPTION_PATH,
  authorizationConsumptionSha256: sha256File(CONSUMPTION_PATH),
  automaticStorage: true,
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: analysisId,
  fileName: "failure-learning-report.json",
  record: report,
  latest: {
    sourceRunId: report.sourceRunId,
    status: report.status,
    ownerReviewRequired: true,
    configurationPatchApplied: false,
    trainingStarted: false,
  },
})
appendAiPainterProgramEvent({
  action: "run_local_ai_v7_r2_failure_learning_loop",
  runId: analysisId,
  kind: "failure_learning_contract_ready",
  status: "success",
  title: "Local AI failure evidence analysis and bounded repair contract completed",
  titleZh: "本地AI失败证据分析与有界修复合同已完成",
  detail: `sourceRun=${report.sourceRunId}; failed=${report.summary.failedPreviewCount}; finalPass=${report.summary.finalPreviewPassed}; configApplied=false; trainingStarted=false`,
  detailZh: `来源Run=${report.sourceRunId}；失败预览=${report.summary.failedPreviewCount}；终态通过=${report.summary.finalPreviewPassed}；配置已应用=false；训练已启动=false`,
  script: "scripts/run-local-ai-v7-r2-failure-learning-loop.mjs",
  currentStep: "waiting_for_owner_review_of_bounded_repair_contract",
  evidencePath: stored.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
console.log(JSON.stringify({
  status: report.status,
  analysisId,
  reportPath: stored.runPath,
  reportSha256: sha256File(stored.runPath),
  conclusionZh: report.summary.conclusionZh,
  configurationPatchApplied: false,
  trainingStarted: false,
}, null, 2))

function verifyAuthorization() {
  assert(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "failure_learning_authorization_hash_mismatch")
  const authorization = readJson(AUTHORIZATION_PATH)
  const consumption = readJson(CONSUMPTION_PATH)
  assert(authorization.ownerDecision?.decision === "authorized", "failure_learning_owner_decision_invalid")
  assert(authorization.ownerDecision?.scope === "local_ai_failure_learning_closed_loop_phase1_non_training_implementation_only", "failure_learning_scope_invalid")
  assert(consumption.status === "consumed_before_authorized_write", "failure_learning_authorization_not_consumed")
  assert(consumption.authorizationSha256 === AUTHORIZATION_SHA256, "failure_learning_consumption_hash_binding_invalid")
}

function resolve(value) { return path.resolve(ROOT, value) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(resolve(value)) && sha256File(value) === expected) }
function assert(condition, message) { if (!condition) throw new Error(message) }
