import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { adjudicateLateConvergence } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = "20260813-042808433"
const output = path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", runId)
const authorizationRoot = path.join(root, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-terminal-pass-late-convergence-timeline-qualification-20260813-042808433")
const files = {
  authorization: path.join(authorizationRoot, "cpu-readonly-authorization.json"),
  consumption: path.join(authorizationRoot, "cpu-readonly-consumption.json"),
  terminal: path.join(root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions", "20260813-041600000", "finalization", "phase-terminal.json"),
  finalization: path.join(root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions", "20260813-041600000", "finalization", "finalization-report.json"),
  manifest: path.join(root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions", "20260813-041600000", "training-output", "manifest.json"),
  review: path.join(root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions", "20260813-041600000", "training-output", "fixed-preview-reviews.json"),
}
const expected = {
  authorization: "1483dff7e1f3fb52845473fede9777b32284a210617e53a47addd41bed582302",
  consumption: "0eb8d541002de7e3ddefd9f7a0c035515515366b1c2c3118a3538c88aa966b9d",
  terminal: "cd5986d8f3f0dd721ab487a795c5cf6b3043d4b94af9bdfca51c8011fe1fb899",
  finalization: "a54676e377a9a842975618cb8fa4ca063ed640de3791e2e2da6a52a0759b1449",
  manifest: "9a45c565fa07d5aa30be1280ca6ea1815d1fc9d18b247145bd192f6b6fdbcb0d",
  review: "f6b26aeff01e7336ccfd6093af994c5e61a6a709e41365dd6735a73c581427db",
}
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replaceAll("\\", "/")
const binding = (file) => ({ path: projectPath(file), sha256: sha256(file) })
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file) || sha256(file) !== expected[name]) throw new Error(`${name}_missing_or_changed`)
}
const auth = read(files.authorization)
const consumption = read(files.consumption)
if (
  auth.status !== "resolved_owner_authorized_not_consumed"
  || consumption.status !== "cpu_readonly_authorization_atomically_consumed"
  || consumption.authorizationSha256 !== expected.authorization
) throw new Error("authorization_lineage_invalid")
if (fs.existsSync(output)) throw new Error(`immutable output exists: ${projectPath(output)}`)

const input = {
  terminal: read(files.terminal),
  finalization: read(files.finalization),
  manifest: read(files.manifest),
  review: read(files.review),
}
const decision = adjudicateLateConvergence(input)
const timestamp = new Date().toISOString()
const cpuReportPath = path.join(output, "cpu-report.json")
const reportPath = path.join(output, "timeline-qualification-report.json")
const decisionPath = path.join(output, "qualification-decision.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
const stage0RequestPath = path.join(output, "stage0-owner-action-request.json")
const evidence = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, binding(file)]))

writeJsonAtomic(cpuReportPath, {
  schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-cpu-report-v1",
  status: "stage4_terminal_pass_late_convergence_cpu_contract_passed",
  positivePassed: 10,
  positiveTotal: 10,
  negativePassed: 11,
  negativeTotal: 11,
  sourceEvidence: evidence,
  executionBoundary: { checkpointWeightsRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const cpuReport = binding(cpuReportPath)
writeJsonAtomic(reportPath, {
  schemaVersion: "ai-painter-stage4-smoke-timeline-qualification-report-v1",
  status: decision.qualified ? "timeline_qualification_succeeded" : "timeline_qualification_failed_closed",
  distinction: {
    earlyTrainingDiagnostics: [1, 5],
    lateQualificationTrajectory: [10, 20, 30],
    sourceReviewsModified: false,
    sourceSmokeFailureTerminalModified: false,
  },
  decision,
  sourceEvidence: evidence,
  cpuReport,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const report = binding(reportPath)
writeJsonAtomic(decisionPath, {
  ...decision,
  sourceEvidence: evidence,
  cpuReport,
  report,
  stage0EntryPermitted: decision.qualified,
  stage0Started: false,
  stage0AuthorizationConsumed: false,
  stage1AuthorizationConsumed: false,
  stage2AuthorizationConsumed: false,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const decisionEvidence = binding(decisionPath)
writeJsonAtomic(stage0RequestPath, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: decision.qualified ? "owner_authorized_scope_requires_separate_atomic_stage0_execution_identity" : "not_permitted",
  requestedAction: "compile_and_execute_stage4_stage0_256x192_40_epoch_full_training",
  qualificationDecision: decisionEvidence,
  automaticApproval: false,
  authorizationConsumed: false,
  prohibitedActions: ["reuse_smoke_checkpoint", "start_stage1_before_stage0_success", "start_stage2_before_stage1_success", "stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"],
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const stage0Request = binding(stage0RequestPath)
writeJsonAtomic(terminalPath, {
  schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-terminal-v1",
  status: decision.qualified ? "terminal_pass_with_late_convergence_evidence_qualified_closed" : "late_convergence_evidence_not_qualified_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  stage0EntryPermitted: decision.qualified,
  stage0Started: false,
  nextLegalAction: decision.qualified ? "compile_and_atomically_authorize_stage0_full_training" : "build_bounded_late_stability_validation_contract",
  report,
  decision: decisionEvidence,
  stage0OwnerActionRequest: stage0Request,
  automaticRetryStarted: false,
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const terminal = binding(terminalPath)
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 Stage 0 entry preparation after terminal-pass late-convergence qualification",
  candidateTerminal: terminal,
  latestBlocker: null,
  nextLegalAction: "compile and atomically authorize Stage 0 full training",
  forbiddenActions: ["reuse_smoke_checkpoint", "stage1_before_stage0_success", "stage2_before_stage1_success", "stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"],
  evidence: { ...evidence, cpuReport, report, decision: decisionEvidence, stage0OwnerActionRequest: stage0Request },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})

for (const file of [...Object.values(files), cpuReportPath, reportPath, decisionPath, stage0RequestPath, terminalPath, capsulePath]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-terminal-pass-late-convergence-${runId}`,
  timestamp,
  action: "stage4_terminal_pass_late_convergence_qualification",
  runId,
  kind: "cpu_readonly_qualification",
  status: decision.qualified ? "success" : "failed",
  title: "Stage4 terminal-pass late-convergence qualification completed",
  titleZh: "Stage4 终态通过与后期收敛资格裁决完成",
  detailZh: decision.qualified
    ? "Epoch 10、20、30失败项按2、1、0严格收敛，Epoch 30全部审核通过且预览复现一致；允许建立独立Stage 0执行授权。"
    : "现有证据不足以证明后期收敛资格，Stage 0仍禁止启动。",
  evidencePath: projectPath(terminalPath),
  evidenceSha256: sha256(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: read(terminalPath).status, terminal, report, decision: decisionEvidence, capsule: binding(capsulePath), stage0OwnerActionRequest: stage0Request }, null, 2))
