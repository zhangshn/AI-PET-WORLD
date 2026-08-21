import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const requestId = `owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-stage0-${runId}`
const output = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("implementation authorization namespace already exists")

const files = {
  qualificationTerminal: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "phase-terminal.json"),
  qualificationReport: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "timeline-qualification-report.json"),
  qualificationDecision: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "qualification-decision.json"),
  qualificationCpuReport: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-cpu-checks", "20260821-062956530", "cpu-report.json"),
  stage0ActionRequest: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-063008725", "stage0-owner-action-request.json"),
  inactiveConfig: path.join(root, ".runtime", "ai-painter", "stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-implementations", "20260821-051855146", "inactive-config.json"),
  supportContract: path.join(root, ".runtime", "ai-painter", "stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-implementations", "20260821-051855146", "training-objective-support-contract.json"),
  compiler: path.join(root, "ml", "ai-painter", "scripts", "compile_stage4_semantic_mixture_full_training_config.py"),
  checker: path.join(root, "ml", "ai-painter", "scripts", "check_stage4_semantic_mixture_full_training_modes_cpu.py"),
  trainer: path.join(root, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py"),
  runner: path.join(root, "scripts", "run-stage4-semantic-mixture-formal-stage.mjs"),
}
for (const file of Object.values(files)) if (!fs.existsSync(file)) throw new Error(`missing source: ${projectPath(file)}`)
const expected = {
  qualificationTerminal: "b31a1645a7ddeb2a8305c6502c83fbcf3d57ec94f2391b892f74a6736832cbd2",
  qualificationReport: "c9fe59ca4c55c79f903e23437c5cf988bbdd2de512da2ab1926fa36de18e5f9e",
  qualificationDecision: "ce372284a5079e509f38b3a2f3d6801279ed93dcccf691d5457bc16c0237209d",
  qualificationCpuReport: "6b270aa2cf84a7429aab770f019fb14141651aafb7ccd6cb02ad90d5e616938e",
  stage0ActionRequest: "2bbf1ee4dfae697e89701164d025b2ce42f5ae81254053888c770e0f70656ba0",
  inactiveConfig: "886ed53287c1d384d13d94c0aa3fbe224eb5228febe65f36580bec8012373ad4",
  supportContract: "8d1d8e1e635f542ed4a2bb3d741acdf5aca91dd3fdd195860b65f37e7cec23aa",
}
for (const [name, value] of Object.entries(expected)) {
  if (hash(files[name]) !== value) throw new Error(`${name} hash changed`)
}

const authorization = {
  schemaVersion: "ai-painter-owner-implementation-authorization-v1",
  requestId,
  commandRef: requestId,
  scope: "activate_current_per_class_worst_sample_final_visible_luminance_contract_for_one_fresh_stage0_then_execute_after_all_gates",
  status: "resolved_owner_authorized_not_consumed",
  implementationActions: [
    "extend_formal_stage_config_compiler_current_contract_activation",
    "extend_trainer_authorization_gate_current_contract_activation",
    "extend_formal_stage_cpu_checker_current_contract_activation",
    "run_cpu_positive_negative_regression",
    "run_active_config_audit",
    "run_real_node_trainer_readonly_preflight",
    "run_python_cuda_disk_preflight",
    "create_and_consume_one_fresh_stage0_authorization_after_all_gates_pass",
    "execute_one_fresh_stage0_training",
    "record_local_evidence",
  ],
  explicitlyDeniedActions: [
    "modify_model_structure", "modify_existing_loss_values_or_weights",
    "modify_dataset_or_split", "modify_checkpoint_format",
    "modify_machine_review_thresholds", "reuse_smoke_checkpoint",
    "reuse_historical_checkpoint", "start_stage1", "start_stage2",
    "start_stage5", "run_formal_inference", "promote_checkpoint",
    "create_runtime_frame", "enter_world",
  ],
  sourceEvidence: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, bind(file)])),
  oneTimeConsumptionRequired: true,
  failurePolicy: { preserveEvidence: true, automaticRetry: false },
}
fs.mkdirSync(output, { recursive: false })
const authorizationPath = path.join(output, "implementation-authorization.json")
writeImmutable(authorizationPath, authorization)
const consumptionPath = path.join(output, "implementation-consumption.json")
writeImmutable(consumptionPath, {
  schemaVersion: "ai-painter-owner-implementation-consumption-v1",
  status: "consumed_once",
  requestId, commandRef: requestId, scope: authorization.scope,
  authorizationPath: projectPath(authorizationPath),
  authorizationSha256: hash(authorizationPath),
  oneTimeConsumption: true,
  consumedAtUtc: new Date().toISOString(),
})
console.log(JSON.stringify({ status: "consumed_once", authorization: bind(authorizationPath), consumption: bind(consumptionPath) }, null, 2))

function writeImmutable(file, value) {
  const handle = fs.openSync(file, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) }
  finally { fs.closeSync(handle) }
}
function hash(file) { return createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function projectPath(file) { return path.relative(root, file).replace(/\\/g, "/") }
function bind(file) { return { path: projectPath(file), sha256: hash(file) } }
