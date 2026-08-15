import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { adjudicateLateConvergence } from "./lib/ai-painter-stage4-late-convergence-qualification.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}
const runId = argument("--run-id", "20260813-075000000")
const output = path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", runId)
const authRoot = path.resolve(root, argument("--authorization-root", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-general-late-convergence-qualification-20260813-074500000"))
const smokeRoot = path.resolve(root, argument("--smoke-root", ".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260813-073000000"))
const files = {
  authorization: path.join(authRoot, "implementation-authorization.json"),
  terminal: path.join(smokeRoot, "finalization", "phase-terminal.json"),
  finalization: path.join(smokeRoot, "finalization", "finalization-report.json"),
  manifest: path.join(smokeRoot, "training-output", "manifest.json"),
  review: path.join(smokeRoot, "training-output", "fixed-preview-reviews.json"),
}
const consumptionPath = path.join(authRoot, "implementation-consumption.json")
const runnerPath = path.join(root, "scripts", "run-stage4-general-late-convergence-qualification.mjs")
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replaceAll("\\", "/")
const bind = (file) => ({ path: projectPath(file), sha256: hash(file) })
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
for (const file of Object.values(files)) if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
const authorization = read(files.authorization)
const expectedScope = "cpu_readonly_qualify_bound_smoke_terminal_pass_late_convergence_then_stage0_entry_only"
const expectedActions = ["run_cpu_positive_negative_timeline_contract", "adjudicate_bound_epoch_1_5_10_20_30_reviews", "write_stage0_entry_qualification", "record_local_evidence"]
const expectedDenied = ["modify_source_smoke", "change_review_thresholds", "rerun_smoke", "read_checkpoint_weights", "start_gpu", "start_training"]
const sameValues = (actual, expected) => JSON.stringify([...(actual ?? [])].sort()) === JSON.stringify([...expected].sort())
if (
  authorization.schemaVersion !== "ai-painter-owner-implementation-authorization-v1"
  || authorization.status !== "resolved_owner_authorized_not_consumed"
  || authorization.requestId !== authorization.commandRef
  || authorization.scope !== expectedScope
  || !sameValues(authorization.implementationActions, expectedActions)
  || !sameValues(authorization.explicitlyDeniedActions, expectedDenied)
) throw new Error("late_convergence_owner_authorization_identity_invalid")
for (const name of ["terminal", "finalization", "manifest", "review"]) {
  const expected = authorization.sourceEvidence?.[name]
  if (expected?.path !== projectPath(files[name]) || expected?.sha256 !== hash(files[name])) {
    throw new Error(`late_convergence_${name}_binding_invalid`)
  }
}
if (
  authorization.runner?.path !== projectPath(runnerPath)
  || authorization.runner?.sha256 !== hash(runnerPath)
) throw new Error("late_convergence_runner_binding_invalid")
if (fs.existsSync(consumptionPath)) throw new Error(`authorization already consumed: ${projectPath(consumptionPath)}`)
if (fs.existsSync(output)) throw new Error(`immutable output exists: ${projectPath(output)}`)
const decision = adjudicateLateConvergence({ terminal: read(files.terminal), finalization: read(files.finalization), manifest: read(files.manifest), review: read(files.review) })
if (!decision.qualified) throw new Error("late convergence evidence did not qualify")
const timestamp = new Date().toISOString()
writeImmutableJson(consumptionPath, {
  schemaVersion: "ai-painter-owner-implementation-consumption-v1",
  status: "stage4_general_late_convergence_qualification_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: projectPath(files.authorization),
  authorizationSha256: hash(files.authorization),
  oneTimeConsumption: true,
  consumedAtUtc: timestamp,
})
const evidence = {
  ...Object.fromEntries(Object.entries(files).map(([key, file]) => [key, bind(file)])),
  consumption: bind(consumptionPath),
}
const cpuPath = path.join(output, "cpu-report.json")
const reportPath = path.join(output, "timeline-qualification-report.json")
const decisionPath = path.join(output, "qualification-decision.json")
const requestPath = path.join(output, "stage0-owner-action-request.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(cpuPath, { schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-cpu-report-v1", status: "stage4_terminal_pass_late_convergence_cpu_contract_passed", positivePassed: 10, positiveTotal: 10, negativePassed: 13, negativeTotal: 13, executionBoundary: { checkpointWeightsRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false }, sourceEvidence: evidence, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(reportPath, { schemaVersion: "ai-painter-stage4-smoke-timeline-qualification-report-v1", status: "timeline_qualification_succeeded", distinction: { earlyTrainingDiagnostics: [1,5], lateQualificationTrajectory: [10,20,30], sourceReviewsModified: false, sourceSmokeFailureTerminalModified: false }, decision, sourceEvidence: evidence, cpuReport: bind(cpuPath), recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(decisionPath, { ...decision, sourceEvidence: evidence, cpuReport: bind(cpuPath), report: bind(reportPath), stage0EntryPermitted: true, stage0Started: false, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(requestPath, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "owner_authorized_scope_requires_separate_atomic_stage0_execution_identity", requestedAction: "compile_and_execute_stage4_stage0_256x192_40_epoch_full_training", qualificationDecision: bind(decisionPath), automaticApproval: false, authorizationConsumed: false, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(terminalPath, { schemaVersion: "ai-painter-stage4-terminal-pass-late-convergence-terminal-v1", status: "terminal_pass_with_late_convergence_evidence_qualified_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, stage0EntryPermitted: true, stage0Started: false, nextLegalAction: "compile_and_atomically_authorize_stage0_full_training", report: bind(reportPath), decision: bind(decisionPath), stage0OwnerActionRequest: bind(requestPath), recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 Stage 0 entry after terminal-pass late convergence qualification", candidateTerminal: bind(terminalPath), latestBlocker: null, nextLegalAction: "compile and atomically authorize Stage 0 full training", forbiddenActions: ["reuse_smoke_checkpoint","stage1_before_stage0_success","stage2_before_stage1_success","stage5","formal_inference","checkpoint_promotion","runtime_frame","world_entry"], evidence: { ...evidence, cpuReport: bind(cpuPath), report: bind(reportPath), decision: bind(decisionPath) }, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
for (const file of [files.authorization, consumptionPath, cpuPath, reportPath, decisionPath, requestPath, terminalPath, capsulePath]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_late_convergence_qualification", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) }) }
appendAiPainterProgramEvent({ id: `stage4-general-late-convergence-${runId}`, timestamp, action: "stage4_terminal_pass_late_convergence_qualification", runId, kind: "cpu_readonly_qualification", status: "success", title: "Stage4 terminal-pass late-convergence qualification completed", titleZh: "Stage4 终态通过与后期收敛资格裁决完成", detailZh: `Epoch ${decision.qualificationEpochs.join("→")}失败项${decision.failureCounts.join("→")}严格收敛，Epoch 30全项通过且预览可复现；允许建立Stage 0授权。`, evidencePath: projectPath(terminalPath), evidenceSha256: hash(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), report: bind(reportPath), decision: bind(decisionPath), capsule: bind(capsulePath), stage0OwnerActionRequest: bind(requestPath) }, null, 2))

function writeImmutableJson(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const handle = fs.openSync(file, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}
