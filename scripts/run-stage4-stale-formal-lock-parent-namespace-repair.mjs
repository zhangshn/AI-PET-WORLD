import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const authorizationPath = projectFile(required(arg("--authorization")))
const authorizationSha256 = requiredSha(arg("--authorization-sha256"))
const consumptionPath = projectFile(required(arg("--consumption")))
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-stale-formal-lock-parent-namespace-repair-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "cpu_only_fix_stale_formal_lock_fixed_parent_namespace_then_compile_fresh_background_continuation_plan")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
assert.equal(fs.existsSync(projectFile(authorization.outputNamespace)), false, "implementation_output_exists")
for (const [name, binding] of Object.entries(authorization.boundEvidence)) verify(binding, name)

const failed = read(projectFile(authorization.boundEvidence.failedTerminal.path))
assert.equal(failed.packageReusable, false)
assert.equal(failed.authorizationStates.every((value) => value.consumed === false), true)
assert.equal(fs.existsSync(projectFile(".runtime/ai-painter/stage4-stale-formal-lock-quarantines/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823024149360")), false)
const cpu = read(projectFile(authorization.boundEvidence.cpuReport.path))
assert.equal(cpu.status, "passed_stage4_stale_formal_lock_parent_namespace_and_real_progress_identity_cpu_regression")
assert.equal(cpu.positivePassed, 2)
assert.equal(cpu.negativePassed, 8)
assert.equal(cpu.missingFixedParentCreatedPassed, true)
assert.equal(cpu.freshPackageDirectoryNonOverwritingPassed, true)
assert.equal(cpu.realFormalLockModified, false)

const now = new Date().toISOString()
writeFreshJson(consumptionPath, { schemaVersion: "stage4-stale-formal-lock-parent-namespace-repair-consumption-v1", status: "stage4_stale_formal_lock_parent_namespace_repair_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: project(authorizationPath), authorizationSha256, oneTimeConsumption: true, consumedAtUtc: now, consumedAtAsiaShanghai: formatShanghai(now) })
const outputRoot = projectFile(authorization.outputNamespace)
fs.mkdirSync(outputRoot, { recursive: true })
const supportPath = path.join(outputRoot, "implementation-support-contract.json")
writeJsonAtomic(supportPath, { schemaVersion: "stage4-stale-formal-lock-parent-namespace-repair-support-v1", status: "cpu_support_verified_inactive", contractId: "stage4_stale_formal_lock_fixed_parent_namespace_creation_v1", fixedParentNamespace: ".runtime/ai-painter/stage4-stale-formal-lock-quarantines", parentCreation: "recursive_after_all_identity_and_pid_checks", packageDirectoryCreation: "non_recursive_non_overwriting", realStaleLockMoved: false, realStaleLockDeleted: false, implementedPrograms: { repairer: authorization.boundEvidence.repairer, checker: authorization.boundEvidence.checker }, gpuAuthorized: false, trainingAuthorized: false, recordedAtUtc: now })
const cpuPath = path.join(outputRoot, "cpu-report.json")
writeJsonAtomic(cpuPath, { schemaVersion: "stage4-stale-formal-lock-parent-namespace-repair-cpu-report-v1", status: "passed_stale_formal_lock_parent_namespace_cpu_implementation", sourceCpuReport: authorization.boundEvidence.cpuReport, positivePassed: cpu.positivePassed, negativePassed: cpu.negativePassed, fixedParentCreationPassed: true, packageDirectoryNonOverwritingPassed: true, realStaleLockModified: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now })
const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planSyncPath = path.join(outputRoot, "plan-sync-record.json")
writeJsonAtomic(planSyncPath, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_not_changed_cpu_infrastructure_repair_only", plan: bind(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const terminalPath = path.join(outputRoot, "phase-terminal.json")
writeJsonAtomic(terminalPath, { schemaVersion: "stage4-stale-formal-lock-parent-namespace-repair-terminal-v1", status: "stale_formal_lock_parent_namespace_cpu_support_succeeded_closed", failedSignedPackage: authorization.boundEvidence.failedPackage, failedSignedPackageReusable: false, failedSignedPackageAuthorizationsConsumed: false, supportContract: bind(supportPath), cpuReport: bind(cpuPath), implementationAuthorization: bind(authorizationPath), implementationConsumption: bind(consumptionPath), realStaleLockMoved: false, realStaleLockDeleted: false, gpuStarted: false, trainingStarted: false, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: "compile_fresh_unsigned_capacity_stage0_stage1_stage2_background_continuation_plan", recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const capsulePath = path.join(outputRoot, "local-task-capsule.json")
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter Stage4", currentStage: "Stale-lock fixed parent namespace CPU repair passed; fresh unsigned continuation plan required", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(terminalPath), nextLegalAction: "compile_fresh_unsigned_background_continuation_plan", recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-stale-lock-parent-repair-${authorization.runId}`, timestamp: now, action: "stage4_stale_formal_lock_parent_namespace_repair", runId: authorization.runId, kind: "cpu_infrastructure_repair", status: "success", title: "Stage4 stale-lock parent namespace repair passed", titleZh: "Stage4旧锁隔离父命名空间修复通过", detailZh: "父目录缺失夹具及全部拒绝路径通过；真实旧锁未移动，GPU和训练未启动。", evidencePath: project(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
for (const file of [consumptionPath, supportPath, cpuPath, planSyncPath, terminalPath, capsulePath]) index(file)
console.log(JSON.stringify({ status: read(terminalPath).status, supportContract: bind(supportPath), cpuReport: bind(cpuPath), terminal: bind(terminalPath), capsule: bind(capsulePath), planSync: bind(planSyncPath), implementationConsumption: bind(consumptionPath) }, null, 2))

function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
function required(value) { assert.ok(typeof value === "string" && value.trim(), "argument_required"); return value.trim() }
function requiredSha(value) { const result = required(value).toLowerCase(); assert.match(result, /^[a-f0-9]{64}$/u, "sha256_required"); return result }
function projectFile(value) { assert.equal(path.isAbsolute(value), false, "project_relative_path_required"); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_boundary_required"); return target }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: project(value), sha256: sha(value) } }
function verify(binding, name) { const target = projectFile(binding.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), binding.sha256, `${name}_sha256_mismatch`) }
function writeFreshJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function index(value) { const stat = fs.statSync(value); indexArtifact({ logicalPath: logicalProjectPath(value), physicalUri: fs.realpathSync(value), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_stale_formal_lock_parent_namespace_repair", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(value) }) }
