import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-native-condition-encoder-responsibility-residual-final-candidate-v1"
const TASK = "implement_native_condition_encoder_responsibility_residual_cpu_inactive_support"
const NEXT = "run_native_condition_encoder_responsibility_residual_readonly_gpu_qualification"
const RUN_ID = `stage4-native-responsibility-residual-cpu-${compactUtc()}-01`
const OUTPUT = inside(`.runtime/ai-painter/stage4-native-responsibility-residual-cpu-support/${RUN_ID}`)
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const COMPILER = inside("ml/ai-painter/scripts/compile_stage4_native_responsibility_residual_cpu_config.py")
const CHECKER = inside("ml/ai-painter/scripts/check_stage4_native_responsibility_residual_cpu.py")
const SOURCE_CONFIG = inside(".runtime/ai-painter/stage4-direct-responsibility-residual-formal-stage0/stage4-direct-responsibility-residual-stage0-20260827091911-01/active-config.json")
const LIFECYCLE_STATE = inside(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`)
const IMPLEMENTATION_FILES = [
  inside("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  inside("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  inside("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  inside("ml/ai-painter/scripts/ai_painter_native_responsibility_residual_contract.py"),
  COMPILER,
  CHECKER,
]

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.taskId, TASK)
assert.equal(current.registry.lifecycleStage, "planned")
assert.equal(current.registry.activity, "planned_not_started")
const planTerminal = inside(current.registry.terminalEvidence.path)
verifyFile(planTerminal, current.registry.terminalEvidence.sha256, "final candidate plan terminal")
const plan = read(planTerminal)
const candidateContract = inside(plan.candidateContract.path)
verifyFile(candidateContract, plan.candidateContract.sha256, "final candidate contract")
const lifecycle = read(LIFECYCLE_STATE)
assert.ok(
  lifecycle.state === "change_candidate" || lifecycle.state === "isolated_implementation",
  `unexpected lifecycle state before CPU support: ${lifecycle.state}`,
)
if (lifecycle.state === "change_candidate") {
  advanceCapabilityLifecycle({
    root: ROOT,
    capabilityVersion: CAPABILITY,
    targetState: "isolated_implementation",
    evidence: {
      schemaVersion: "ai-painter-capability-stage-evidence-v1",
      capabilityVersion: CAPABILITY,
      targetState: "isolated_implementation",
      status: "passed",
      bindings: [candidateContract, ...IMPLEMENTATION_FILES].map(bind),
      ownerAuthorizationRequired: false,
    },
  })
}
assert.equal(fs.existsSync(OUTPUT), false, "CPU support output reuse is forbidden")
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: false })
const inactive = path.join(OUTPUT, "inactive-config.json")
const report = path.join(OUTPUT, "cpu-report.json")
const audit = path.join(OUTPUT, "configuration-audit.json")
const terminal = path.join(OUTPUT, "phase-terminal.json")
const capsule = path.join(OUTPUT, "local-task-capsule.json")

run(PYTHON, [COMPILER, "--source-config", SOURCE_CONFIG, "--output", inactive])
const cpu = JSON.parse(run(PYTHON, [CHECKER]).stdout)
assert.equal(cpu.status, "stage4_native_responsibility_residual_cpu_support_passed")
const recordedAtUtc = new Date().toISOString()
writeExclusive(report, { ...cpu, schemaVersion: "stage4-native-responsibility-residual-cpu-report-v1", candidateContract: bind(candidateContract), inactiveConfig: bind(inactive), ownerAuthorizationRequired: false, recordedAtUtc })
writeExclusive(audit, { schemaVersion: "stage4-native-responsibility-residual-configuration-audit-v1", status: "passed", architecture: cpu.architecture, parameterCount: cpu.parameterCount, responsibilityIdentityOrder: cpu.responsibilityIdentityOrder, activationGate: false, gpuAllowed: false, optimizerAllowed: false, backwardAllowed: false, trainingAllowed: false, checkpointReadAllowed: false, ownerAuthorizationRequired: false, recordedAtUtc })
writeExclusive(terminal, { schemaVersion: "stage4-native-responsibility-residual-cpu-terminal-v1", executionState: "completed", status: "native_responsibility_residual_cpu_support_succeeded", capabilityVersion: CAPABILITY, runId: RUN_ID, candidateContract: bind(candidateContract), inactiveConfig: bind(inactive), cpuReport: bind(report), configurationAudit: bind(audit), nextLegalAction: NEXT, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, ownerAuthorizationRequired: false, recordedAtUtc })
const evidence = [candidateContract, inactive, report, audit, terminal]
writeExclusive(capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", capsuleId: `local-ai-${RUN_ID}`, module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" }, fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: { number: 4, total: 5, labelZh: "原生条件编码责任隔离CPU支持", status: "completed" }, nextAllowedAction: { code: NEXT, ownerAuthorizationRequired: false, automaticExecutionAllowed: true }, evidence: evidence.map((file) => ({ ...bind(file), sha256Verified: true })), integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" }, ownerAuthorizationRequired: false, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })
advanceCapabilityLifecycle({ root: ROOT, capabilityVersion: CAPABILITY, targetState: "cpu_contract_verified", evidence: { schemaVersion: "ai-painter-capability-stage-evidence-v1", capabilityVersion: CAPABILITY, targetState: "cpu_contract_verified", status: "passed", bindings: [terminal, report, inactive, audit].map(bind), ownerAuthorizationRequired: false } })
const advanced = await advanceCurrentExecutionRegistry({ projectRoot: ROOT, capabilityVersion: CAPABILITY, packageId: RUN_ID, taskId: NEXT, taskKind: "readonly_gpu_qualification", runId: RUN_ID, lifecycleStage: "cpu_contract_verified", executionState: "completed", activity: "planned_not_started", taskCapsulePath: projectPath(capsule), terminalEvidencePath: projectPath(terminal) })
appendAiPainterProgramEvent({ id: `stage4-native-responsibility-residual-cpu-${RUN_ID}`, timestamp: recordedAtUtc, action: "stage4_native_responsibility_residual_cpu_support_completed", runId: RUN_ID, kind: "cpu_inactive_support", status: "success", title: "Native responsibility residual CPU support completed", titleZh: "原生条件编码责任隔离CPU支持完成", detailZh: `正向${cpu.positiveChecks}项、反向${cpu.negativeChecks}项通过，未启动GPU或训练。`, evidencePath: projectPath(terminal), evidenceSha256: sha(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
process.stdout.write(`${JSON.stringify({ status: read(terminal).status, runId: RUN_ID, terminal: bind(terminal), inactiveConfig: bind(inactive), cpuReport: bind(report), currentRegistrySha256: advanced.registrySha256, nextLegalAction: NEXT, ownerAuthorizationRequired: false }, null, 2)}\n`)

function run(command, args) { const result = spawnSync(command, args, { cwd: ROOT, env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${inside("ml/ai-painter/src")};${inside("ml/ai-painter/scripts")}` }, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 300_000 }); if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr || result.stdout); return result }
function inside(relative) { const candidate = path.resolve(ROOT, relative); assert.ok(candidate === ROOT || candidate.startsWith(`${ROOT}${path.sep}`)); return candidate }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function verifyFile(file, expected, label) { assert.equal(fs.existsSync(file), true, `${label} missing`); assert.equal(sha(file), expected, `${label} SHA mismatch`) }
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
