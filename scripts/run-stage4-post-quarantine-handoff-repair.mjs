import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const authorizationPath = projectFile(required(arg("--authorization")))
const authorizationSha256 = required(arg("--authorization-sha256")).toLowerCase()
const consumptionPath = projectFile(required(arg("--consumption")))
assert.equal(sha(authorizationPath), authorizationSha256)
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-post-quarantine-handoff-repair-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(fs.existsSync(consumptionPath), false)
assert.equal(fs.existsSync(projectFile(authorization.outputNamespace)), false)
for (const binding of Object.values(authorization.boundEvidence)) verify(binding)
const cpu = read(projectFile(authorization.boundEvidence.cpuReport.path))
assert.equal(cpu.status, "passed_stage4_post_quarantine_coordinator_handoff_cpu_regression")
assert.equal(cpu.positivePassed, 2)
assert.equal(cpu.negativePassed, 8)
const failedPackage = read(projectFile(authorization.boundEvidence.failedPackage.path))
for (const relative of [failedPackage.coordinator.authorization.path, ...failedPackage.steps.map((step) => step.authorization.path)]) { const request = read(projectFile(relative)); assert.equal(fs.existsSync(projectFile(`.runtime/project-owner-write-authorization-consumptions/${request.authorizationId}`)), false) }

const now = new Date().toISOString()
writeFresh(consumptionPath, { schemaVersion: "stage4-post-quarantine-handoff-repair-consumption-v1", status: "stage4_post_quarantine_handoff_repair_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: project(authorizationPath), authorizationSha256, oneTimeConsumption: true, consumedAtUtc: now, consumedAtAsiaShanghai: formatShanghai(now) })
const root = projectFile(authorization.outputNamespace)
fs.mkdirSync(root, { recursive: true })
const support = path.join(root, "implementation-support-contract.json")
writeJsonAtomic(support, { schemaVersion: "stage4-post-quarantine-handoff-support-v1", status: "cpu_support_verified_inactive", contractId: "stage4_pre_and_post_quarantine_coordinator_verification_v1", preQuarantine: "verify_original_lock_path_and_sha256_before_atomic_quarantine", postQuarantine: "verify_package_scoped_terminal_and_quarantined_lock_sha256_after_atomic_quarantine", futurePackage: "bind_prior_quarantine_and_do_not_move_same_lock_again", programs: { planChecker: authorization.boundEvidence.planChecker, packageCore: authorization.boundEvidence.packageCore, backgroundLauncher: authorization.boundEvidence.backgroundLauncher }, gpuAuthorized: false, trainingAuthorized: false, recordedAtUtc: now })
const cpuPath = path.join(root, "cpu-report.json")
writeJsonAtomic(cpuPath, { schemaVersion: "stage4-post-quarantine-handoff-aggregate-cpu-report-v1", status: "passed_post_quarantine_coordinator_handoff_cpu_implementation", sourceCpuReport: authorization.boundEvidence.cpuReport, positivePassed: cpu.positivePassed, negativePassed: cpu.negativePassed, coordinatorAndStageAuthorizationsConsumed: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now })
const terminal = path.join(root, "phase-terminal.json")
writeJsonAtomic(terminal, { schemaVersion: "stage4-post-quarantine-handoff-repair-terminal-v1", status: "post_quarantine_coordinator_handoff_cpu_support_succeeded_closed", failedPackage: authorization.boundEvidence.failedPackage, failedPackageReusable: false, backgroundFailure: authorization.boundEvidence.backgroundTerminal, priorQuarantineTerminal: authorization.boundEvidence.quarantineTerminal, priorQuarantinedLock: authorization.boundEvidence.quarantinedLock, supportContract: bind(support), cpuReport: bind(cpuPath), implementationAuthorization: bind(authorizationPath), implementationConsumption: bind(consumptionPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, gpuStarted: false, trainingStarted: false, nextLegalAction: "compile_fresh_unsigned_capacity_background_continuation_plan_with_prior_quarantine", recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const capsule = path.join(root, "local-task-capsule.json")
writeJsonAtomic(capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter Stage4", currentStage: "Post-quarantine coordinator handoff CPU repair passed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, terminal: bind(terminal), nextLegalAction: "compile_fresh_unsigned_background_plan", recordedAtUtc: now })
const guide = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planSync = path.join(root, "plan-sync-record.json")
writeJsonAtomic(planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_not_changed_cpu_infrastructure_repair_only", plan: bind(guide), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now })
appendAiPainterProgramEvent({ id: `stage4-post-quarantine-handoff-${authorization.runId}`, timestamp: now, action: "stage4_post_quarantine_handoff_repair", runId: authorization.runId, kind: "cpu_infrastructure_repair", status: "success", title: "Post-quarantine handoff repair passed", titleZh: "Stage4隔离后后台接管修复通过", detailZh: "隔离前验证原锁，隔离后验证同包隔离证据；未来包不再移动同一旧锁。", evidencePath: project(terminal), evidenceSha256: sha(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
for (const value of [consumptionPath, support, cpuPath, terminal, capsule, planSync]) index(value)
console.log(JSON.stringify({ status: read(terminal).status, supportContract: bind(support), cpuReport: bind(cpuPath), terminal: bind(terminal), capsule: bind(capsule) }, null, 2))

function arg(name) { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
function required(value) { assert.ok(typeof value === "string" && value.trim()); return value.trim() }
function projectFile(value) { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: project(value), sha256: sha(value) } }
function verify(binding) { assert.equal(sha(projectFile(binding.path)), binding.sha256) }
function writeFresh(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function index(value) { const stat = fs.statSync(value); indexArtifact({ logicalPath: logicalProjectPath(value), physicalUri: fs.realpathSync(value), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_post_quarantine_handoff_repair", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(value) }) }
