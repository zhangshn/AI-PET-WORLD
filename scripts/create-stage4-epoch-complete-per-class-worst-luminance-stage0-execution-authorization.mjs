import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const [runId, implementationRunId, cpuRunId] = process.argv.slice(2)
for (const value of [runId, implementationRunId, cpuRunId]) if (!/^[0-9]{8}-[0-9]{9}$/.test(value ?? "")) throw new Error("three runIds are required")
const referenceFeatureSharedReplay = process.argv.includes("--reference-feature-shared-replay")
const requestId = referenceFeatureSharedReplay
  ? `owner-authorized-stage4-epoch-complete-reference-feature-shared-replay-stage0-execution-${runId}`
  : `owner-authorized-stage4-epoch-complete-per-class-worst-luminance-stage0-execution-${runId}`
const output = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("Stage 0 authorization namespace already exists")
const implementationRoot = referenceFeatureSharedReplay
  ? `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-reference-feature-shared-replay-stage0-${implementationRunId}`
  : `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-luminance-stage0-${implementationRunId}`
const files = {
  sourceConfig: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/inactive-config.json" : ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/inactive-config.json"),
  terminalQualification: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/phase-terminal.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/phase-terminal.json"),
  qualificationReport: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/timeline-qualification-report.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/timeline-qualification-report.json"),
  qualificationDecision: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/qualification-decision.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/qualification-decision.json"),
  qualificationCpuReport: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/cpu-report.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/cpu-report.json"),
  stage0ActionRequest: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/stage0-owner-action-request.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/stage0-owner-action-request.json"),
  cpuReport: projectFile(`.runtime/ai-painter/stage4-semantic-mixture-formal-stage-mode-cpu-regressions/${cpuRunId}/cpu-report.json`),
  implementationAuthorization: projectFile(`${implementationRoot}/implementation-authorization.json`),
  implementationConsumption: projectFile(`${implementationRoot}/implementation-consumption.json`),
}
const code = {
  authorizationPolicy: projectFile("ml/ai-painter/scripts/ai_painter_authorization_policy.py"),
  modeRegistry: projectFile("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
  trainer: projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  compiler: projectFile("ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py"),
  cpuChecker: projectFile("ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py"),
  runner: projectFile("scripts/run-stage4-semantic-mixture-formal-stage.mjs"),
}
for (const file of [...Object.values(files), ...Object.values(code)]) if (!fs.existsSync(file)) throw new Error(`missing binding: ${projectPath(file)}`)
const cpu = read(files.cpuReport)
const qualification = read(files.terminalQualification)
if (cpu.status !== "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression" || cpu.positivePassed !== cpu.positiveTotal || cpu.negativePassed !== cpu.negativeTotal || qualification.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed" || qualification.stage0EntryPermitted !== true) throw new Error("Stage 0 source gates are not eligible")
const actions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "run_stage0"].sort()
const authorization = {
  schemaVersion: "ai-painter-stage4-formal-stage-execution-authorization-v1",
  requestId, commandRef: requestId, scope: "one_stage4_semantic_mixture_stage0_full_training_only",
  status: "resolved_owner_authorized_not_consumed", executionActions: actions,
  explicitlyDeniedActions: ["load_parent_denoiser", "run_stage1", "run_stage2", "run_stage5", "run_formal_inference", "promote_checkpoint", "create_runtime_frame", "enter_world"],
  bindings: {
    sourceConfig: bind(files.sourceConfig), terminalQualification: bind(files.terminalQualification),
    qualificationReport: bind(files.qualificationReport), qualificationDecision: bind(files.qualificationDecision),
    qualificationCpuReport: bind(files.qualificationCpuReport), stage0ActionRequest: bind(files.stage0ActionRequest),
    cpuReport: bind(files.cpuReport), implementationAuthorization: bind(files.implementationAuthorization),
    implementationConsumption: bind(files.implementationConsumption),
    code: Object.fromEntries(Object.entries(code).map(([name, file]) => [name, hash(file)])),
  },
  fixedStage: 0, fixedResolution: { width: 256, height: 192 }, fixedEpochs: 40,
  fixedSeed: 20263722, fixedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
  initialization: "project_random_fact_conditioned_semantic_mixture", smokeCheckpointAllowed: false,
  historicalCheckpointAllowed: false, automaticRetryAllowed: false, oneTimeConsumptionRequired: true,
}
fs.mkdirSync(output, { recursive: false })
const authorizationPath = path.join(output, "execution-authorization.json")
writeImmutable(authorizationPath, authorization)
console.log(JSON.stringify({ status: "created_unconsumed", authorization: bind(authorizationPath) }, null, 2))

function projectFile(value) { return path.resolve(root, value) }
function writeImmutable(file, value) { const handle = fs.openSync(file, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function hash(file) { return createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function projectPath(file) { return path.relative(root, file).replace(/\\/g, "/") }
function bind(file) { return { path: projectPath(file), sha256: hash(file) } }
