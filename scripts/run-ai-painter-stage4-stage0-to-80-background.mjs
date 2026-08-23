import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { verifyStage4ContinuationPackage } from "../src/server/project-owner-stage4-continuation-package-core.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SCRIPT_PATH = fileURLToPath(import.meta.url)
const WORKER = path.resolve(ROOT, "scripts/run-ai-painter-stage4-stage0-to-80-background-worker.mjs")
const RUNNER = path.resolve(ROOT, "scripts/run-ai-painter-stage4-stage0-to-80-continuation.mjs")
const STARTER = path.resolve(ROOT, "scripts/windows/start-ai-painter-stage4-background-process.ps1")
const JOB_ROOT = path.resolve(ROOT, ".runtime/ai-painter/stage4-background-continuation-jobs")
const PRECONSUMPTION_FAILURE_ROOT = path.resolve(ROOT, ".runtime/ai-painter/stage4-background-preconsumption-failures")
if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
const args = parseArgs(process.argv.slice(2))
const packagePath = required(args.package, "--package is required")
const packageSha256 = requiredSha(args.packageSha256, "--package-sha256 is required")
const trustRegistrySha256 = requiredSha(args.trustRegistrySha256 ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256, "--trust-registry-sha256 is required")
const verified = verifyStage4ContinuationPackage({ root: ROOT, packagePath, packageSha256, trustRegistrySha256 })
const expectedHostExecution = {
  launcher: bind(SCRIPT_PATH),
  worker: bind(WORKER),
  starter: bind(STARTER),
}
if (verified.hostExecution?.mechanism !== "wmi_win32_process_create" || verified.hostExecution?.codexProcessTreeIndependent !== true || verified.hostExecution?.stopOnCodexExit !== false || verified.hostExecution?.automaticRetry !== false || verified.hostExecution?.requiresFreshPackageAndOutput !== true) fail("signed_background_host_execution_contract_invalid")
for (const [key, value] of Object.entries(expectedHostExecution)) if (JSON.stringify(verified.hostExecution?.[key]) !== JSON.stringify(value)) fail(`signed_background_${key}_binding_mismatch`)
const failureRecording = verified.hostExecution.preconsumptionFailureRecording
if (failureRecording?.schemaVersion !== "ai-painter-stage4-background-preconsumption-failure-recording-contract-v1" || failureRecording.failureRootTemplate !== ".runtime/ai-painter/stage4-background-preconsumption-failures/{{PACKAGE_ID}}" || failureRecording.coordinatorAndStageAuthorizationsRemainUnconsumed !== true || failureRecording.automaticRetry !== false) fail("signed_background_preconsumption_failure_recording_contract_invalid")
for (const key of ["cpuReport", "implementationTerminal", "priorFailureTerminal"]) if (!bindingExists(failureRecording[key])) fail(`signed_background_preconsumption_${key}_binding_invalid`)
const staleRecovery = verified.hostExecution.staleFormalLockRecovery
if (staleRecovery?.enabled !== true || staleRecovery.quarantineRootTemplate !== ".runtime/ai-painter/stage4-stale-formal-lock-quarantines/{{PACKAGE_ID}}") fail("signed_stale_formal_lock_recovery_contract_invalid")
let recoveryResult
if (staleRecovery.sourceState === "prior_quarantine_verified") {
  recoveryResult = { status: "stale_formal_stage_lock_already_quarantined_verified_closed", terminal: staleRecovery.priorQuarantineTerminal, quarantinedLock: staleRecovery.priorQuarantinedLock }
} else {
  try {
    recoveryResult = JSON.parse(execFileSync(process.execPath, [path.resolve(ROOT, staleRecovery.repairer.path), "--package-id", verified.packageId, "--lock-path", staleRecovery.lock.path, "--lock-sha256", staleRecovery.lock.sha256, "--interruption-terminal", staleRecovery.interruptionTerminal.path, "--interruption-terminal-sha256", staleRecovery.interruptionTerminal.sha256, "--quarantine-root", staleRecovery.quarantineRootTemplate.replace("{{PACKAGE_ID}}", verified.packageId)], { cwd: ROOT, encoding: "utf8", windowsHide: true }))
  } catch (error) {
    recordBackgroundPreconsumptionFailure({ packageValue: verified, packagePath: verified.packagePath, packageSha256: verified.packageSha256, phase: "stale_formal_lock_recovery", error })
    throw error
  }
  if (recoveryResult.status !== "stale_formal_stage_lock_quarantined_closed") fail("stale_formal_lock_recovery_failed")
}
const hostExecutionId = `AI-PET-WORLD-Stage4-${verified.packageId}`
if (!/^[A-Za-z0-9._-]+$/u.test(hostExecutionId) || hostExecutionId.length > 220) fail("background_host_execution_id_invalid")
const jobDirectory = path.join(JOB_ROOT, verified.packageId)
if (fs.existsSync(jobDirectory)) fail("background_job_namespace_exists")
const executionRoot = `.runtime/ai-painter/stage4-stage0-to-80-continuation-executions/${verified.packageId}`
if (fs.existsSync(path.resolve(ROOT, executionRoot))) fail("continuation_execution_output_exists")
fs.mkdirSync(jobDirectory, { recursive: true })
const jobPath = path.join(jobDirectory, "job.json")
const now = new Date().toISOString()
const job = {
  schemaVersion: "ai-painter-stage4-background-continuation-job-v1",
  status: "ready_to_start",
  packageId: verified.packageId,
  package: { path: verified.packagePath, sha256: verified.packageSha256 },
  trustRegistrySha256,
  taskName: hostExecutionId,
  launcher: bind(SCRIPT_PATH),
  worker: bind(WORKER),
  hostStarter: bind(STARTER),
  runner: bind(RUNNER),
  runnerArgs: ["--package", verified.packagePath, "--package-sha256", verified.packageSha256, "--trust-registry-sha256", trustRegistrySha256],
  executionStatePath: `${executionRoot}/execution-state.json`,
  coordinatorTerminalPath: `${executionRoot}/finalization/phase-terminal.json`,
  progressPaths: Object.fromEntries(verified.steps.map((step) => [step.role, step.progressPath])),
  hostIsolation: { mechanism: "wmi_win32_process_create", codexProcessTreeIndependent: true, stopOnCodexExit: false, automaticRetry: false },
  staleFormalLockRecovery: recoveryResult,
  createdAtUtc: now,
  createdAtAsiaShanghai: formatShanghai(now),
}
writeFreshJson(jobPath, job)
const jobSha256 = sha256File(jobPath)
let registration
try {
  const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", STARTER, "-HostExecutionId", hostExecutionId, "-NodePath", process.execPath, "-WorkerPath", WORKER, "-JobPath", project(jobPath), "-JobSha256", jobSha256, "-WorkingDirectory", ROOT], { cwd: ROOT, encoding: "utf8", windowsHide: true })
  registration = JSON.parse(output)
} catch (error) {
  writeJsonAtomic(path.join(jobDirectory, "launcher-failure.json"), { schemaVersion: "ai-painter-stage4-background-launcher-failure-v1", status: "background_process_broker_failed_closed", packageId: verified.packageId, hostExecutionId, message: String(error?.stderr || error?.message || error), job: bind(jobPath), recordedAtUtc: new Date().toISOString() })
  recordBackgroundPreconsumptionFailure({ packageValue: verified, packagePath: verified.packagePath, packageSha256: verified.packageSha256, phase: "background_process_broker", error, additionalEvidence: { job: bind(jobPath), launcherFailure: bind(path.join(jobDirectory, "launcher-failure.json")) } })
  throw error
}
const launchPath = path.join(jobDirectory, "launch-record.json")
writeJsonAtomic(launchPath, { schemaVersion: "ai-painter-stage4-background-launch-record-v1", status: "background_process_brokered_and_started", packageId: verified.packageId, hostExecutionId, registration, job: bind(jobPath), package: { path: verified.packagePath, sha256: verified.packageSha256 }, coordinatorAuthorizationConsumedByLauncher: false, stepAuthorizationsConsumedByLauncher: false, trainingStartedByLauncher: false, recordedAtUtc: new Date().toISOString() })
appendAiPainterProgramEvent({ action: "stage4_background_continuation", runId: verified.packageId, kind: "background_process_brokered", status: "running", title: "Stage4 background process brokered", titleZh: "Stage4独立后台进程已启动", detailZh: "训练执行已脱离Codex前台进程树；关闭聊天不会停止Windows后台进程。", evidencePath: project(launchPath), evidenceSha256: sha256File(launchPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_background_continuation_brokered_and_started", packageId: verified.packageId, hostExecutionId, backgroundProcessId: registration.processId, backgroundParentProcessName: registration.parentProcessName, job: bind(jobPath), launchRecord: bind(launchPath), heartbeatPath: project(path.join(jobDirectory, "heartbeat.json")), executionStatePath: job.executionStatePath }, null, 2))
}

export function recordBackgroundPreconsumptionFailure({ root = ROOT, packageValue, packagePath, packageSha256, phase, error, additionalEvidence = null, failureRootOverride = null, consumptionRootOverride = null, appendEvent = true }) {
  const projectRoot = path.resolve(root)
  const packageId = required(packageValue?.packageId, "package_id_required_for_failure_record")
  assertSafeSegment(packageId, "package_id_invalid_for_failure_record")
  const packageAbsolute = resolveProjectFile(projectRoot, packagePath)
  if (sha256File(packageAbsolute) !== packageSha256) fail("failure_record_package_hash_mismatch")
  const authorizationBindings = [
    ["coordinator", packageValue.coordinator?.authorization?.path],
    ...((packageValue.steps ?? []).map((step) => [step.role, step.authorization?.path])),
  ]
  const consumptionRoot = consumptionRootOverride ? path.resolve(projectRoot, consumptionRootOverride) : path.resolve(projectRoot, ".runtime/project-owner-write-authorization-consumptions")
  if (!isWithin(consumptionRoot, projectRoot)) fail("failure_record_consumption_root_invalid")
  const authorizationStates = authorizationBindings.map(([role, relative]) => {
    const requestPath = resolveProjectFile(projectRoot, relative)
    const request = JSON.parse(fs.readFileSync(requestPath, "utf8"))
    const consumptionDirectory = path.join(consumptionRoot, request.authorizationId)
    if (fs.existsSync(consumptionDirectory)) fail(`failure_record_authorization_already_consumed:${role}`)
    return { role, authorization: { path: relative, sha256: sha256File(requestPath) }, authorizationId: request.authorizationId, consumed: false }
  })
  const executionRoot = path.resolve(projectRoot, `.runtime/ai-painter/stage4-stage0-to-80-continuation-executions/${packageId}`)
  if (fs.existsSync(executionRoot)) fail("failure_record_execution_root_exists")
  const outputRoot = failureRootOverride
    ? path.resolve(projectRoot, failureRootOverride)
    : path.join(PRECONSUMPTION_FAILURE_ROOT, packageId)
  if (!isWithin(outputRoot, projectRoot)) fail("failure_record_output_path_invalid")
  if (fs.existsSync(outputRoot)) fail("failure_record_output_exists")
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true })
  fs.mkdirSync(outputRoot, { recursive: false })
  const now = new Date().toISOString()
  const reportPath = path.join(outputRoot, "failure-report.json")
  writeJsonAtomic(reportPath, {
    schemaVersion: "ai-painter-stage4-background-preconsumption-failure-report-v1",
    status: "background_start_failed_before_any_authorization_consumption",
    phase,
    errorName: String(error?.name ?? "Error"),
    errorMessage: String(error?.stderr || error?.message || error),
    package: { path: projectFrom(projectRoot, packageAbsolute), sha256: packageSha256 },
    authorizationStates,
    coordinatorAuthorizationConsumed: false,
    stageAuthorizationsConsumed: false,
    executionRootCreated: false,
    gpuStarted: false,
    optimizerCreated: false,
    trainingStarted: false,
    additionalEvidence,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  const terminalPath = path.join(outputRoot, "phase-terminal.json")
  writeJsonAtomic(terminalPath, {
    schemaVersion: "ai-painter-stage4-background-preconsumption-failure-terminal-v1",
    status: "stage4_background_start_failed_before_authorization_consumption_closed",
    packageId,
    phase,
    package: { path: projectFrom(projectRoot, packageAbsolute), sha256: packageSha256 },
    failureReport: { path: projectFrom(projectRoot, reportPath), sha256: sha256File(reportPath) },
    authorizationStates,
    packageReusable: false,
    coordinatorAuthorizationConsumed: false,
    stageAuthorizationsConsumed: false,
    executionRootCreated: false,
    gpuStarted: false,
    trainingStarted: false,
    automaticRetry: false,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  const planPath = path.resolve(projectRoot, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const planSyncPath = path.join(outputRoot, "plan-sync-record.json")
  writeJsonAtomic(planSyncPath, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_not_changed_execution_failure_only", plan: { path: projectFrom(projectRoot, planPath), sha256: sha256File(planPath) }, terminal: { path: projectFrom(projectRoot, terminalPath), sha256: sha256File(terminalPath) }, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  const capsulePath = path.join(outputRoot, "local-task-capsule.json")
  writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter Stage4", currentStage: "Background start failed before authorization consumption", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: { path: projectFrom(projectRoot, terminalPath), sha256: sha256File(terminalPath) }, nextLegalAction: "fix_exact_preconsumption_failure_then_compile_and_owner_sign_fresh_package", recordedAtUtc: now })
  if (appendEvent) appendAiPainterProgramEvent({ id: `stage4-background-preconsumption-failure-${packageId}`, timestamp: now, action: "stage4_background_continuation", runId: packageId, kind: "background_preconsumption_failure", status: "failed", title: "Stage4 background start failed before authorization consumption", titleZh: "Stage4后台启动在任何授权消费前失败关闭", detailZh: `失败阶段=${phase}；协调与Stage 0/1/2授权均未消费，GPU和训练均未启动。`, evidencePath: projectFrom(projectRoot, terminalPath), evidenceSha256: sha256File(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  return { status: "stage4_background_start_failed_before_authorization_consumption_closed", failureReport: { path: projectFrom(projectRoot, reportPath), sha256: sha256File(reportPath) }, terminal: { path: projectFrom(projectRoot, terminalPath), sha256: sha256File(terminalPath) }, capsule: { path: projectFrom(projectRoot, capsulePath), sha256: sha256File(capsulePath) }, planSync: { path: projectFrom(projectRoot, planSyncPath), sha256: sha256File(planSyncPath) } }
}

function bind(value) { return { path: project(value), sha256: sha256File(value) } }
function bindingExists(value) { if (!value || typeof value.path !== "string" || !/^[a-f0-9]{64}$/u.test(value.sha256 ?? "")) return false; const target = path.resolve(ROOT, value.path); return target.startsWith(`${ROOT}${path.sep}`) && fs.existsSync(target) && sha256File(target) === value.sha256 }
function writeFreshJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function projectFrom(root, value) { return path.relative(root, path.resolve(value)).replaceAll("\\", "/") }
function resolveProjectFile(root, value) { if (typeof value !== "string" || !value || path.isAbsolute(value) || value.startsWith("../") || value.includes("/../") || value.includes("\\")) fail("failure_record_project_path_invalid"); const result = path.resolve(root, value); if (!isWithin(result, root)) fail("failure_record_project_boundary_required"); return result }
function isWithin(candidate, parent) { const relative = path.relative(parent, candidate); return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative) }
function assertSafeSegment(value, message) { if (!/^[A-Za-z0-9._-]{1,220}$/u.test(value)) fail(message) }
function required(value, message) { if (typeof value !== "string" || !value.trim()) fail(message); return value.trim() }
function requiredSha(value, message) { const result = required(value, message).toLowerCase(); if (!/^[a-f0-9]{64}$/u.test(result)) fail(message); return result }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 2) { const key = values[index]; const value = values[index + 1]; if (!key?.startsWith("--") || !value) fail("unexpected_argument"); result[key.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = value } return result }
function fail(message) { throw new Error(message) }
