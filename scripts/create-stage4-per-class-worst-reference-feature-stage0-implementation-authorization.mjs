import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const requestId = `owner-authorized-stage4-per-class-worst-reference-feature-stage0-${runId}`
const output = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("implementation authorization namespace already exists")
const sourceFiles = {
  qualificationTerminal: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-021100000", "phase-terminal.json"),
  qualificationReport: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-021100000", "timeline-qualification-report.json"),
  qualificationDecision: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-021100000", "qualification-decision.json"),
  stage0ActionRequest: path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", "20260821-021100000", "stage0-owner-action-request.json"),
  compiler: path.join(root, "ml", "ai-painter", "scripts", "compile_stage4_semantic_mixture_full_training_config.py"),
  checker: path.join(root, "ml", "ai-painter", "scripts", "check_stage4_semantic_mixture_full_training_modes_cpu.py"),
  trainer: path.join(root, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py"),
  runner: path.join(root, "scripts", "run-stage4-semantic-mixture-formal-stage.mjs"),
}
for (const file of Object.values(sourceFiles)) if (!fs.existsSync(file)) throw new Error(`missing source: ${projectPath(file)}`)
const expected = {
  qualificationTerminal: "e0b9ef07018d520d62cf8b28482afa1b2d614cbc1688dc9bf44380cb0833f5d1",
  qualificationReport: "7e3a777e81df80b624395f8ac5aabc4be5e11ece84497e708d2029db42045d0b",
  qualificationDecision: "e283b719496dd446a00058a8b28aeafb47bc9ef7df746f53ef8dc4420907dd48",
  stage0ActionRequest: "8856be84817853db7a9af1275fe89cd2ba375df27503f14d38b3d160b9bf99a9",
}
for (const [name, expectedHash] of Object.entries(expected)) {
  if (hash(sourceFiles[name]) !== expectedHash) throw new Error(`${name} hash changed`)
}
const authorization = {
  schemaVersion: "ai-painter-owner-implementation-authorization-v1",
  requestId,
  commandRef: requestId,
  scope: "activate_current_per_class_worst_reference_feature_contract_for_one_fresh_stage0_then_execute_after_all_gates",
  status: "resolved_owner_authorized_not_consumed",
  implementationActions: [
    "extend_formal_stage_config_compiler_current_contract_activation",
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
    "modify_model_structure",
    "modify_existing_loss_weights",
    "modify_dataset_or_split",
    "modify_checkpoint_format",
    "modify_machine_review_thresholds",
    "reuse_smoke_checkpoint",
    "reuse_historical_checkpoint",
    "start_stage1",
    "start_stage2",
    "start_stage5",
    "run_formal_inference",
    "promote_checkpoint",
    "create_runtime_frame",
    "enter_world",
  ],
  sourceEvidence: Object.fromEntries(Object.entries(sourceFiles).map(([name, file]) => [name, bind(file)])),
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
  requestId,
  commandRef: requestId,
  scope: authorization.scope,
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
