import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { auditStage4Stage0To80ContinuationPlan } from "./check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-condition-fusion-stage0-final-route-20260823-083751371/authorization.json"
const SOURCE_AUTH_SHA = "639ccae8053c30893e2cf118f403d1254aae07ea287b46112676db49fea2bcc5"
const SOURCE_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-condition-fusion-stage0-final-route-20260823-083751371/consumption.json"
const SOURCE_CONSUMPTION_SHA = "002436aab09d9ec2c6b6db41db47579fa34c19fbcbbadf4e48c2c0b6b3786482"
const OLD_PLAN = ".runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/20260823-105352744/execution-plan.json"
const args = parseArgs(process.argv.slice(2))
const authorizationPath = projectFile(required(args.authorization, "--authorization is required"))
const authorizationSha256 = requiredSha(args.authorizationSha256, "--authorization-sha256 is required")
const consumptionPath = projectFile(required(args.consumption, "--consumption is required"))
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-background-host-recovery-continuation-compilation-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "cpu_only_record_host_interruption_and_compile_fresh_host_isolated_capacity_stage0_to_stage2_plan")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) verifyBinding(binding, `source_${name}`)
for (const [name, binding] of Object.entries(authorization.programLineage)) verifyBinding(binding, `program_${name}`)
for (const relative of [authorization.outputNamespace, authorization.planNamespace, authorization.lineageNamespace]) assert.equal(fs.existsSync(projectFile(relative)), false, `fresh_namespace_required:${relative}`)
verifyBinding({ path: SOURCE_AUTH, sha256: SOURCE_AUTH_SHA }, "implementation_source_authorization")
verifyBinding({ path: SOURCE_CONSUMPTION, sha256: SOURCE_CONSUMPTION_SHA }, "implementation_source_consumption")
const oldPlan = read(projectFile(OLD_PLAN))
assert.equal(oldPlan.candidateIdentity.candidateId, "stage4_capacity_only_base_width_64_to_existing_level1_128")
assert.equal(oldPlan.candidateIdentity.controlledStructureArm, "capacity_only_base_width_64_to_existing_level1_128")

const now = new Date().toISOString()
writeFreshJson(consumptionPath, { schemaVersion: "stage4-background-host-recovery-continuation-compilation-consumption-v1", status: "stage4_background_host_recovery_continuation_compilation_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: project(authorizationPath), authorizationSha256, oneTimeConsumption: true, consumedAtUtc: now, consumedAtAsiaShanghai: formatShanghai(now) })

const lineageRoot = projectFile(authorization.lineageNamespace)
fs.mkdirSync(lineageRoot, { recursive: true })
const sourceAuthorization = { path: SOURCE_AUTH, sha256: SOURCE_AUTH_SHA }
const sourceConsumption = { path: SOURCE_CONSUMPTION, sha256: SOURCE_CONSUMPTION_SHA }
const sourceAuthValue = read(projectFile(SOURCE_AUTH))
const lineageAuthorizationPath = path.join(lineageRoot, "resolved-implementation-authorization.json")
writeFreshJson(lineageAuthorizationPath, {
  candidateId: oldPlan.candidateIdentity.candidateId,
  commandRef: sourceAuthValue.commandRef,
  planCompilationRunId: authorization.runId,
  requestId: sourceAuthValue.requestId,
  resolution: "raw_owner_authorization_and_atomic_consumption_verified",
  resolvedAtUtc: now,
  schemaVersion: "ai-painter-stage4-resolved-implementation-authorization-v1",
  scope: sourceAuthValue.scope,
  sourceAuthorization,
  sourceConsumption,
  status: "resolved_owner_authorized_not_consumed",
})
const lineageConsumptionPath = path.join(lineageRoot, "resolved-implementation-consumption.json")
writeFreshJson(lineageConsumptionPath, {
  authorizationPath: project(lineageAuthorizationPath),
  authorizationSha256: sha(lineageAuthorizationPath),
  candidateId: oldPlan.candidateIdentity.candidateId,
  commandRef: sourceAuthValue.commandRef,
  oneTimeConsumption: true,
  planCompilationRunId: authorization.runId,
  requestId: sourceAuthValue.requestId,
  resolvedAtUtc: now,
  schemaVersion: "ai-painter-stage4-resolved-implementation-consumption-v1",
  scope: sourceAuthValue.scope,
  sourceAuthorization,
  sourceConsumption,
  status: "resolved_implementation_lineage_consumption_verified",
})
const lineageAuthorization = bind(lineageAuthorizationPath)
const lineageConsumption = bind(lineageConsumptionPath)

const plan = structuredClone(oldPlan)
plan.createdAtUtc = now
plan.planCompilationRunId = authorization.runId
plan.validityHours = 168
plan.hostExecution = {
  schemaVersion: "ai-painter-stage4-background-host-execution-contract-v1",
  mechanism: "wmi_win32_process_create",
  codexProcessTreeIndependent: true,
  stopOnCodexExit: false,
  automaticRetry: false,
  requiresFreshPackageAndOutput: true,
  launcher: authorization.programLineage.backgroundLauncher,
  worker: authorization.programLineage.backgroundWorker,
  starter: authorization.programLineage.backgroundStarter,
  disconnectCpuReport: authorization.sourceEvidence.backgroundCpuReport,
  preconsumptionFailureRecording: {
    schemaVersion: "ai-painter-stage4-background-preconsumption-failure-recording-contract-v1",
    failureRootTemplate: ".runtime/ai-painter/stage4-background-preconsumption-failures/{{PACKAGE_ID}}",
    cpuReport: authorization.sourceEvidence.preconsumptionFailureCpuReport,
    implementationTerminal: authorization.sourceEvidence.realProgressRepairTerminal,
    priorFailureTerminal: authorization.sourceEvidence.preconsumptionFailureTerminal,
    coordinatorAndStageAuthorizationsRemainUnconsumed: true,
    automaticRetry: false,
  },
  staleFormalLockRecovery: {
    enabled: true,
    sourceState: "prior_quarantine_verified",
    quarantineRootTemplate: ".runtime/ai-painter/stage4-stale-formal-lock-quarantines/{{PACKAGE_ID}}",
    repairer: authorization.programLineage.staleLockRepairer,
    cpuReport: authorization.sourceEvidence.staleLockCpuReport,
    lock: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/.formal-stage.lock", sha256: authorization.sourceEvidence.priorQuarantinedLock.sha256 },
    interruptionTerminal: authorization.sourceEvidence.interruptionTerminal,
    oldProgress: authorization.sourceEvidence.oldProgress,
    priorQuarantineTerminal: authorization.sourceEvidence.priorQuarantineTerminal,
    priorQuarantinedLock: authorization.sourceEvidence.priorQuarantinedLock,
    implementationTerminal: authorization.sourceEvidence.realProgressRepairTerminal,
    supportContract: authorization.sourceEvidence.realProgressRepairSupport,
  },
}
for (const step of plan.steps) {
  const runId = `${authorization.runId}-capacity-${step.role}`
  const outputNamespace = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${runId}`
  assert.equal(fs.existsSync(projectFile(outputNamespace)), false, `future_output_exists:${step.role}`)
  step.runId = runId
  step.outputNamespace = outputNamespace
  step.progressPath = `${outputNamespace}/training-output/progress.json`
  step.terminal.path = `${outputNamespace}/finalization/phase-terminal.json`
  replaceRunId(step.preflightArgs, step.stage, runId)
  replaceRunId(step.executeArgs, step.stage, runId)
  step.runnerAuthorization.requestId = `owner-authorized-stage4-capacity-${step.role}-${authorization.runId}`
  step.runnerAuthorization.commandRef = step.runnerAuthorization.requestId
  step.runnerAuthorization.bindings.implementationAuthorization = lineageAuthorization
  step.runnerAuthorization.bindings.implementationConsumption = lineageConsumption
  step.runnerAuthorization.taskIdentity.outputNamespace = outputNamespace
}
auditStage4Stage0To80ContinuationPlan(plan, { root: ROOT, verifyFiles: true })
const planRoot = projectFile(authorization.planNamespace)
fs.mkdirSync(planRoot, { recursive: true })
const planPath = path.join(planRoot, "execution-plan.json")
writeFreshJson(planPath, plan)
const check = spawnSync(process.execPath, [projectFile("scripts/check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"), "--plan", project(planPath)], { cwd: ROOT, encoding: "utf8", windowsHide: true })
assert.equal(check.status, 0, `continuation_plan_cpu_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
const cpuPath = path.join(planRoot, "cpu-report.json")
writeJsonAtomic(cpuPath, { ...cpu, status: "stage4_background_host_recovery_continuation_plan_cpu_passed", hostExecution: plan.hostExecution, interruptionTerminal: authorization.sourceEvidence.interruptionTerminal, realProgressIdentityRepair: authorization.sourceEvidence.realProgressRepairTerminal, preconsumptionFailureRecordingCpuReport: authorization.sourceEvidence.preconsumptionFailureCpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now })
const trust = projectFile("data/ai-painter/system-governance/project-owner-trust-registry-v1.json")
const signingCommand = `node scripts/owner-offline/sign-ai-painter-stage4-stage0-to-80-continuation-package.mjs --plan "${project(planPath)}" --plan-sha256 "${sha(planPath)}" --trust-registry-sha256 "${sha(trust)}"`
const requestPath = path.join(planRoot, "owner-action-request.json")
writeJsonAtomic(requestPath, { schemaVersion: "stage4-background-host-recovery-continuation-owner-action-request-v1", status: "ready_for_one_owner_offline_signature", candidateId: plan.candidateIdentity.candidateId, controlledStructureArm: plan.candidateIdentity.controlledStructureArm, hostExecution: plan.hostExecution, interruptedOldPackageReusable: false, preconsumptionFailedPackageReusable: false, executionPlan: bind(planPath), signingCommand, signatureCountRequiredFromOwner: 1, executionStarted: false, recordedAtUtc: now })
const outputRoot = projectFile(authorization.outputNamespace)
fs.mkdirSync(outputRoot, { recursive: true })
const terminalPath = path.join(outputRoot, "phase-terminal.json")
writeJsonAtomic(terminalPath, { schemaVersion: "stage4-background-host-recovery-continuation-compilation-terminal-v1", status: "fresh_host_isolated_capacity_continuation_plan_ready_for_owner_signature_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, interruptedOldPackageReusable: false, interruptedPartialWeightsReusable: false, executionPlan: bind(planPath), cpuReport: bind(cpuPath), ownerActionRequest: bind(requestPath), hostExecution: plan.hostExecution, ownerPrivateKeyRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now })
const capsulePath = path.join(outputRoot, "local-task-capsule.json")
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter Stage4", currentStage: "Fresh host-isolated capacity Stage0 to Stage2 plan awaiting one Owner offline signature", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, candidateTerminal: bind(terminalPath), latestBlocker: "owner_offline_signature_required", nextLegalAction: "owner_sign_once_then_launch_with_wmi_background_host", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-background-host-recovery-plan-${authorization.runId}`, timestamp: now, action: "stage4_background_host_recovery_continuation_plan", runId: authorization.runId, kind: "cpu_only_fresh_plan_compilation", status: "success", title: "Fresh host-isolated continuation plan ready", titleZh: "新的独立后台Stage4连续计划已就绪", detailZh: "旧包、旧runId、旧输出和部分权重全部排除；新计划绑定Windows WMI后台宿主，需Owner离线签署一次。", evidencePath: project(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "fresh_host_isolated_capacity_continuation_plan_ready_for_owner_signature_closed", executionPlan: bind(planPath), cpuReport: bind(cpuPath), ownerActionRequest: bind(requestPath), terminal: bind(terminalPath), signingCommand, signatureCountRequiredFromOwner: 1 }, null, 2))

function replaceRunId(values, stage, runId) { const marker = values.indexOf("--run-id"); assert.ok(marker >= 0); values[marker + 1] = runId; const stageMarker = values.indexOf("--stage"); assert.equal(values[stageMarker + 1], String(stage)) }
function verifyBinding(value, name) { const target = projectFile(value.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), value.sha256, `${name}_sha256_mismatch`) }
function writeFreshJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function projectFile(value) { assert.equal(path.isAbsolute(value), false, "project_relative_path_required"); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_boundary_required"); return target }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: project(value), sha256: sha(value) } }
function required(value, message) { assert.ok(typeof value === "string" && value.trim(), message); return value.trim() }
function requiredSha(value, message) { const result = required(value, message).toLowerCase(); assert.match(result, /^[a-f0-9]{64}$/u, message); return result }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) { const key = values[index]; const value = values[index + 1]; assert.ok(key?.startsWith("--") && value, "unexpected_argument"); result[key.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = value } return result }
