import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = "20260821-015500000"
const output = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-terminal-pass-late-convergence-qualification-implementations",
  runId,
)
const smokeRoot = path.join(
  root,
  ".runtime",
  "ai-painter",
  "stage4-per-class-worst-sample-reference-feature-structure-smoke-executions",
  "20260821-012500000",
)
const files = {
  sourceTerminal: path.join(smokeRoot, "finalization", "phase-terminal.json"),
  sourceFinalization: path.join(smokeRoot, "finalization", "finalization-report.json"),
  sourceManifest: path.join(smokeRoot, "training-output", "manifest.json"),
  sourceReview: path.join(smokeRoot, "training-output", "fixed-preview-reviews.json"),
  checker: path.join(root, "scripts", "check-stage4-terminal-pass-late-convergence-qualification.mjs"),
  decisionLibrary: path.join(root, "scripts", "lib", "ai-painter-stage4-late-convergence-qualification.mjs"),
  plan: path.join(root, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md"),
  report: path.join(output, "cpu-failure-report.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  ownerRequest: path.join(output, "owner-action-request.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
for (const file of [
  files.sourceTerminal,
  files.sourceFinalization,
  files.sourceManifest,
  files.sourceReview,
  files.checker,
  files.decisionLibrary,
  files.plan,
]) {
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
}
for (const file of [files.report, files.terminal, files.capsule, files.ownerRequest, files.planSync]) {
  if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
}

const timestamp = new Date().toISOString()
const fixedTotalProgress = { completedStages: 3, totalStages: 5, percent: 60 }
const sourceEvidence = {
  terminal: bind(files.sourceTerminal),
  finalization: bind(files.sourceFinalization),
  manifest: bind(files.sourceManifest),
  machineReview: bind(files.sourceReview),
  checker: bind(files.checker),
  decisionLibrary: bind(files.decisionLibrary),
}
writeJsonAtomic(files.report, {
  schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-cpu-failure-report-v1",
  status: "stage4_terminal_pass_late_convergence_cpu_contract_failed_closed",
  failureCode: "late_stability_mutually_exclusive_route_assertion_mismatch",
  error: "AssertionError: failedPositiveKeys=sustained_zero_from_first_late_epoch",
  observedLateEpochs: [10, 20, 30],
  observedFailureCounts: [1, 0, 0],
  expectedQualificationRoute: "strict_decrease_then_stable_zero",
  incorrectlyRequiredAdditionalRoute: "sustained_zero_from_first_late_epoch",
  exactBoundary: {
    sourceEvidenceModified: false,
    qualificationAuthorizationCreated: false,
    qualificationAuthorizationConsumed: false,
    checkpointWeightsRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    gpuStarted: false,
    trainingStarted: false,
  },
  sourceEvidence,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.ownerRequest, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "fix_only_late_stability_cpu_checker_mutually_exclusive_route_assertion_then_rerun_cpu_qualification",
  sourceCpuFailureReport: bind(files.report),
  allowedChange: "accept_exactly_one_formal_route_for_bound_smoke_while_regressing_both_routes",
  forbiddenChanges: [
    "modify_decision_library_semantics",
    "modify_source_smoke",
    "change_review_thresholds",
    "rerun_smoke",
    "read_checkpoint_weights",
    "start_gpu",
    "start_training",
  ],
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-cpu-gate-terminal-v1",
  status: "stage4_terminal_pass_late_convergence_cpu_contract_failed_closed",
  blocker: "late_stability_mutually_exclusive_route_assertion_mismatch",
  cpuFailureReport: bind(files.report),
  ownerActionRequest: bind(files.ownerRequest),
  qualificationAuthorizationCreated: false,
  qualificationAuthorizationConsumed: false,
  stage0Started: false,
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress,
  currentStage: "Stage4 late-stability qualification CPU gate failed closed",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "late_stability_mutually_exclusive_route_assertion_mismatch",
  nextLegalAction: "owner_authorized_bounded_cpu_checker_route_assertion_correction_only",
  evidence: { ...sourceEvidence, cpuFailureReport: bind(files.report) },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(files.planSync, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  runId,
  uniqueModulePlan: bind(files.plan),
  terminal: bind(files.terminal),
  nextLegalAction: "owner_authorized_bounded_cpu_checker_route_assertion_correction_only",
  fixedTotalProgress,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

for (const file of Object.values(files).filter((value) => fs.existsSync(value))) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    artifactType: file === files.plan
      ? "ai_painter_unique_module_plan"
      : "stage4_late_stability_qualification_cpu_gate_failure",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: hash(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-late-stability-qualification-cpu-gate-${runId}`,
  timestamp,
  action: "stage4_terminal_pass_late_convergence_cpu_contract",
  runId,
  kind: "cpu_validation",
  status: "failed_closed",
  title: "Stage4 late-stability qualification CPU route assertion failed closed",
  titleZh: "Stage4后期稳定资格CPU路线断言失败关闭",
  detailZh: "当前Smoke为1→0→0严格下降后稳定归零路线，但CPU检查器错误地同时要求0→0→0持续零路线；资格授权未创建或消费，未读取Checkpoint、未启动GPU或训练。",
  evidencePath: projectPath(files.terminal),
  evidenceSha256: hash(files.terminal),
  fixedTotalProgress,
})

console.log(JSON.stringify({
  status: "recorded",
  terminal: bind(files.terminal),
  cpuFailureReport: bind(files.report),
  ownerActionRequest: bind(files.ownerRequest),
  localTaskCapsule: bind(files.capsule),
  planSyncRecord: bind(files.planSync),
}, null, 2))

function hash(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}
function projectPath(file) {
  return path.relative(root, file).replace(/\\/g, "/")
}
function bind(file) {
  return { path: projectPath(file), sha256: hash(file) }
}


