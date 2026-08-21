import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const requestId = `owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-stage0-execution-${runId}`
const output = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("Stage 0 authorization namespace already exists")

const files = {
  sourceConfig: path.join(root, ".runtime", "ai-painter", "stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-implementations", "20260821-051855146", "inactive-config.json"),
  terminalQualification: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "phase-terminal.json"),
  qualificationReport: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "timeline-qualification-report.json"),
  qualificationDecision: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "qualification-decision.json"),
  qualificationCpuReport: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-cpu-checks", "20260821-062956530", "cpu-report.json"),
  stage0ActionRequest: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "stage0-owner-action-request.json"),
  cpuReport: path.join(root, ".runtime", "ai-painter", "stage4-semantic-mixture-formal-stage-mode-cpu-regressions", "20260821-063800000", "cpu-report.json"),
  implementationAuthorization: path.join(root, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-stage0-20260821-063700000", "implementation-authorization.json"),
  implementationConsumption: path.join(root, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-stage0-20260821-063700000", "implementation-consumption.json"),
}
const code = {
  authorizationPolicy: path.join(root, "ml", "ai-painter", "scripts", "ai_painter_authorization_policy.py"),
  modeRegistry: path.join(root, "ml", "ai-painter", "scripts", "ai_painter_stage_mode_registry.py"),
  trainer: path.join(root, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py"),
  compiler: path.join(root, "ml", "ai-painter", "scripts", "compile_stage4_semantic_mixture_full_training_config.py"),
  cpuChecker: path.join(root, "ml", "ai-painter", "scripts", "check_stage4_semantic_mixture_full_training_modes_cpu.py"),
  runner: path.join(root, "scripts", "run-stage4-semantic-mixture-formal-stage.mjs"),
}
for (const file of [...Object.values(files), ...Object.values(code)]) if (!fs.existsSync(file)) throw new Error(`missing binding: ${projectPath(file)}`)

const expected = {
  sourceConfig: "886ed53287c1d384d13d94c0aa3fbe224eb5228febe65f36580bec8012373ad4",
  terminalQualification: "b31a1645a7ddeb2a8305c6502c83fbcf3d57ec94f2391b892f74a6736832cbd2",
  qualificationReport: "c9fe59ca4c55c79f903e23437c5cf988bbdd2de512da2ab1926fa36de18e5f9e",
  qualificationDecision: "ce372284a5079e509f38b3a2f3d6801279ed93dcccf691d5457bc16c0237209d",
  qualificationCpuReport: "6b270aa2cf84a7429aab770f019fb14141651aafb7ccd6cb02ad90d5e616938e",
  stage0ActionRequest: "2bbf1ee4dfae697e89701164d025b2ce42f5ae81254053888c770e0f70656ba0",
}
for (const [name, value] of Object.entries(expected)) if (hash(files[name]) !== value) throw new Error(`${name} hash changed`)
const cpu = read(files.cpuReport)
const qualification = read(files.terminalQualification)
if (
  cpu.status !== "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression"
  || cpu.positivePassed !== 50 || cpu.positiveTotal !== 50
  || cpu.negativePassed !== 45 || cpu.negativeTotal !== 45
  || qualification.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed"
  || qualification.stage0EntryPermitted !== true
) throw new Error("Stage 0 source gates are not eligible")

const authorization = {
  schemaVersion: "ai-painter-stage4-formal-stage-execution-authorization-v1",
  requestId, commandRef: requestId,
  scope: "one_stage4_semantic_mixture_stage0_full_training_only",
  status: "resolved_owner_authorized_not_consumed",
  executionActions: [
    "create_optimizer", "execute_backward", "inspect_autoencoder_identity",
    "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights",
    "run_stage0",
  ],
  explicitlyDeniedActions: [
    "load_parent_denoiser", "run_stage1", "run_stage2", "run_stage5",
    "run_formal_inference", "promote_checkpoint", "create_runtime_frame", "enter_world",
  ],
  bindings: {
    sourceConfig: bind(files.sourceConfig), terminalQualification: bind(files.terminalQualification),
    qualificationReport: bind(files.qualificationReport), qualificationDecision: bind(files.qualificationDecision),
    qualificationCpuReport: bind(files.qualificationCpuReport), stage0ActionRequest: bind(files.stage0ActionRequest),
    cpuReport: bind(files.cpuReport), implementationAuthorization: bind(files.implementationAuthorization),
    implementationConsumption: bind(files.implementationConsumption),
    code: Object.fromEntries(Object.entries(code).map(([name, file]) => [name, hash(file)])),
  },
  fixedStage: 0,
  fixedResolution: { width: 256, height: 192 },
  fixedEpochs: 40,
  fixedSeed: 20263722,
  fixedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
  initialization: "project_random_fact_conditioned_semantic_mixture",
  smokeCheckpointAllowed: false,
  historicalCheckpointAllowed: false,
  automaticRetryAllowed: false,
  oneTimeConsumptionRequired: true,
}
fs.mkdirSync(output, { recursive: false })
const authorizationPath = path.join(output, "execution-authorization.json")
writeImmutable(authorizationPath, authorization)
console.log(JSON.stringify({ status: "created_unconsumed", authorization: bind(authorizationPath) }, null, 2))

function writeImmutable(file, value) {
  const handle = fs.openSync(file, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) }
  finally { fs.closeSync(handle) }
}
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function hash(file) { return createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function projectPath(file) { return path.relative(root, file).replace(/\\/g, "/") }
function bind(file) { return { path: projectPath(file), sha256: hash(file) } }
