import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { recordBackgroundPreconsumptionFailure } from "./run-ai-painter-stage4-stage0-to-80-background.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const authorizationPath = projectFile(required(argument("--authorization"), "authorization_path_required"))
const authorizationSha256 = requiredSha(argument("--authorization-sha256"), "authorization_sha256_required")
const consumptionPath = projectFile(required(argument("--consumption"), "consumption_path_required"))
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-stale-formal-lock-real-progress-repair-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "cpu_only_fix_real_progress_run_identity_and_preconsumption_failure_record_then_compile_fresh_background_continuation_plan")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "implementation_authorization_already_consumed")
assert.equal(fs.existsSync(projectFile(authorization.outputNamespace)), false, "implementation_output_exists")
for (const [name, binding] of Object.entries(authorization.boundEvidence)) {
  if (name !== "staleLockRepairerBefore") verifyBinding(binding, `bound_${name}`)
}

const stalePackagePath = projectFile(authorization.boundEvidence.signedPackage.path)
const stalePackage = read(stalePackagePath)
assert.equal(stalePackage.packageId, authorization.stalePackageIdentity.packageId)
assert.deepEqual(stalePackage.hostExecution.staleFormalLockRecovery.repairer, authorization.boundEvidence.staleLockRepairerBefore, "old_repairer_binding_not_preserved_by_stale_package")
assert.notEqual(sha(projectFile("scripts/repair-ai-painter-stage4-stale-formal-lock.mjs")), authorization.boundEvidence.staleLockRepairerBefore.sha256, "stale_lock_repairer_was_not_updated")
assert.equal(fs.existsSync(projectFile(`.runtime/ai-painter/stage4-stage0-to-80-continuation-executions/${stalePackage.packageId}`)), false, "stale_package_execution_root_exists")
assert.equal(fs.existsSync(projectFile(`.runtime/ai-painter/stage4-stale-formal-lock-quarantines/${stalePackage.packageId}`)), false, "stale_package_quarantine_exists")
for (const [role, relative] of [["coordinator", stalePackage.coordinator.authorization.path], ...stalePackage.steps.map((step) => [step.role, step.authorization.path])]) {
  const request = read(projectFile(relative))
  assert.equal(fs.existsSync(projectFile(`.runtime/project-owner-write-authorization-consumptions/${request.authorizationId}`)), false, `${role}_authorization_was_consumed`)
}

const staleLockCpu = read(projectFile(".runtime/ai-painter/stage4-stale-formal-lock-cpu-regressions/20260823-103000001/cpu-report.json"))
assert.equal(staleLockCpu.status, "passed_stage4_stale_formal_lock_real_progress_identity_cpu_regression")
assert.equal(staleLockCpu.positivePassed, 2)
assert.equal(staleLockCpu.negativePassed, 7)
assert.equal(staleLockCpu.realProgressSchemaWithoutRunIdPassed, true)
assert.equal(staleLockCpu.realFormalLockModified, false)
const preconsumptionCpu = read(projectFile(".runtime/ai-painter/stage4-background-preconsumption-failure-cpu-regressions/20260823-103000002/cpu-report.json"))
assert.equal(preconsumptionCpu.status, "passed_background_preconsumption_failure_recording_cpu_regression")
assert.equal(preconsumptionCpu.positivePassed, 1)
assert.equal(preconsumptionCpu.negativePassed, 4)

const now = new Date().toISOString()
writeFreshJson(consumptionPath, {
  schemaVersion: "stage4-stale-formal-lock-real-progress-repair-consumption-v1",
  status: "stage4_stale_formal_lock_real_progress_repair_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: project(authorizationPath),
  authorizationSha256,
  oneTimeConsumption: true,
  consumedAtUtc: now,
  consumedAtAsiaShanghai: formatShanghai(now),
})

const failedLaunch = recordBackgroundPreconsumptionFailure({
  root: ROOT,
  packageValue: stalePackage,
  packagePath: project(stalePackagePath),
  packageSha256: authorization.boundEvidence.signedPackage.sha256,
  phase: "stale_formal_lock_recovery",
  error: new Error("lock_run_id_not_bound_to_interruption:real_progress_schema_has_no_embedded_run_id"),
  additionalEvidence: {
    staleLock: authorization.boundEvidence.staleLock,
    interruptionTerminal: authorization.boundEvidence.interruptionTerminal,
    oldProgress: authorization.boundEvidence.oldProgress,
    staleLockRepairerBefore: authorization.boundEvidence.staleLockRepairerBefore,
  },
})

const outputRoot = projectFile(authorization.outputNamespace)
fs.mkdirSync(outputRoot, { recursive: true })
const supportPath = path.join(outputRoot, "implementation-support-contract.json")
writeJsonAtomic(supportPath, {
  schemaVersion: "stage4-stale-formal-lock-real-progress-repair-support-v1",
  status: "cpu_support_verified_inactive",
  contractId: "stage4_stale_formal_lock_real_progress_run_identity_and_preconsumption_failure_recording_v1",
  runIdentity: {
    primarySource: "bound_interruption_terminal.oldProgress.path",
    requiredPattern: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/<runId>/training-output/progress.json",
    embeddedRunIdRule: "when_present_all_embedded_identities_must_equal_path_identity_and_lock_identity",
    missingEmbeddedRunIdRule: "path_identity_must_equal_lock_identity",
  },
  preconsumptionFailureRecording: {
    required: true,
    authorizationConsumptionRequired: false,
    coordinatorAndStageAuthorizationsMustRemainUnconsumed: true,
    taskCapsuleEventLedgerAndSqliteRequired: true,
  },
  realLockMoved: false,
  realLockDeleted: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  implementedPrograms: {
    staleLockRepairer: bind(projectFile("scripts/repair-ai-painter-stage4-stale-formal-lock.mjs")),
    staleLockCpuChecker: bind(projectFile("scripts/check-ai-painter-stage4-stale-formal-lock-repair.mjs")),
    backgroundLauncher: bind(projectFile("scripts/run-ai-painter-stage4-stage0-to-80-background.mjs")),
    preconsumptionCpuChecker: bind(projectFile("scripts/check-ai-painter-stage4-background-preconsumption-failure-recording.mjs")),
  },
  recordedAtUtc: now,
})
const cpuReportPath = path.join(outputRoot, "cpu-report.json")
writeJsonAtomic(cpuReportPath, {
  schemaVersion: "stage4-stale-formal-lock-real-progress-repair-aggregate-cpu-report-v1",
  status: "passed_stale_lock_real_progress_and_preconsumption_failure_recording_cpu_regression",
  staleLockRepairCpuReport: bind(projectFile(".runtime/ai-painter/stage4-stale-formal-lock-cpu-regressions/20260823-103000001/cpu-report.json")),
  preconsumptionFailureCpuReport: bind(projectFile(".runtime/ai-painter/stage4-background-preconsumption-failure-cpu-regressions/20260823-103000002/cpu-report.json")),
  realProgress: authorization.boundEvidence.oldProgress,
  realStaleLock: authorization.boundEvidence.staleLock,
  realStaleLockModified: false,
  realPackageAuthorizationsConsumed: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
})
const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planSyncPath = path.join(outputRoot, "plan-sync-record.json")
writeJsonAtomic(planSyncPath, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_not_changed_cpu_infrastructure_repair_only", plan: bind(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const terminalPath = path.join(outputRoot, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-stale-formal-lock-real-progress-repair-terminal-v1",
  status: "stale_formal_lock_real_progress_and_preconsumption_recording_cpu_support_succeeded_closed",
  staleSignedPackage: authorization.boundEvidence.signedPackage,
  staleSignedPackageReusable: false,
  staleSignedPackageAuthorizationsConsumed: false,
  failedLaunchTerminal: failedLaunch.terminal,
  supportContract: bind(supportPath),
  cpuReport: bind(cpuReportPath),
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  realStaleLockMoved: false,
  realStaleLockDeleted: false,
  gpuStarted: false,
  trainingStarted: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "compile_fresh_unsigned_capacity_stage0_stage1_stage2_background_continuation_plan",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const capsulePath = path.join(outputRoot, "local-task-capsule.json")
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter Stage4", currentStage: "Stale-lock real progress identity repair passed; fresh unsigned continuation plan required", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(terminalPath), nextLegalAction: "compile_fresh_unsigned_background_continuation_plan", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-stale-lock-real-progress-repair-${authorization.runId}`, timestamp: now, action: "stage4_stale_formal_lock_real_progress_repair", runId: authorization.runId, kind: "cpu_infrastructure_repair", status: "success", title: "Stage4 stale-lock real progress identity repair passed", titleZh: "Stage4旧锁真实progress身份及消费前失败记录修复通过", detailZh: "真实progress无runId字段路径已纳入正式身份解析；旧锁未移动，GPU和训练未启动。", evidencePath: project(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
for (const file of [consumptionPath, supportPath, cpuReportPath, planSyncPath, terminalPath, capsulePath]) index(file)
console.log(JSON.stringify({ status: read(terminalPath).status, failedLaunchTerminal: failedLaunch.terminal, supportContract: bind(supportPath), cpuReport: bind(cpuReportPath), terminal: bind(terminalPath), capsule: bind(capsulePath), planSync: bind(planSyncPath), implementationConsumption: bind(consumptionPath) }, null, 2))

function argument(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
function required(value, message) { assert.ok(typeof value === "string" && value.trim(), message); return value.trim() }
function requiredSha(value, message) { const result = required(value, message).toLowerCase(); assert.match(result, /^[a-f0-9]{64}$/u, message); return result }
function projectFile(value) { assert.equal(path.isAbsolute(value), false, "project_relative_path_required"); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, "project_boundary_required"); return result }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: project(value), sha256: sha(value) } }
function verifyBinding(value, name) { const file = projectFile(value.path); assert.equal(fs.existsSync(file), true, `${name}_missing`); assert.equal(sha(file), value.sha256, `${name}_sha256_mismatch`) }
function writeFreshJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function index(value) { const stat = fs.statSync(value); indexArtifact({ logicalPath: logicalProjectPath(value), physicalUri: fs.realpathSync(value), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_stale_formal_lock_real_progress_repair", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(value) }) }
