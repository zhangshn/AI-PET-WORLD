import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const referenceFeatureSharedReplay = process.argv.includes("--reference-feature-shared-replay")
const requestId = referenceFeatureSharedReplay
  ? `owner-authorized-stage4-epoch-complete-reference-feature-shared-replay-stage0-${runId}`
  : `owner-authorized-stage4-epoch-complete-per-class-worst-luminance-stage0-${runId}`
const output = path.join(root, ".runtime", "ai-painter", "owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("implementation authorization namespace already exists")

const files = {
  qualificationTerminal: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/phase-terminal.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/phase-terminal.json"),
  qualificationReport: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/timeline-qualification-report.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/timeline-qualification-report.json"),
  qualificationDecision: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/qualification-decision.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/qualification-decision.json"),
  qualificationCpuReport: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/cpu-report.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/cpu-report.json"),
  stage0ActionRequest: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/stage0-owner-action-request.json" : ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-042556350/stage0-owner-action-request.json"),
  inactiveConfig: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/inactive-config.json" : ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/inactive-config.json"),
  supportContract: projectFile(referenceFeatureSharedReplay ? ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/training-objective-support-contract.json" : ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/training-objective-support-contract.json"),
  compiler: projectFile("ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py"),
  checker: projectFile("ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py"),
  trainer: projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  runner: projectFile("scripts/run-stage4-semantic-mixture-formal-stage.mjs"),
}
for (const file of Object.values(files)) if (!fs.existsSync(file)) throw new Error(`missing source: ${projectPath(file)}`)
const expected = {
  qualificationTerminal: referenceFeatureSharedReplay ? "1cbc3f470448de2cce0dcee55a023a6c0289ac20a22fa389bbfea9acc335fead" : "5bdf2c8e1371891d6c37850c896e622559bb636542d1ee8d25aba92b2b3e30c7",
  qualificationReport: referenceFeatureSharedReplay ? "26293e6c78673180c106840efc4c139478d451b4fe54be081825eead5cfe8e63" : "0622d8992b94d6c1312d4fe080ac40e98fefa8877da7f4021055d9534d069859",
  qualificationDecision: referenceFeatureSharedReplay ? "67f416064d49d710400f0359dc019ae3c2e5451dce1b40781e3e44fcf51d573b" : "f9434a2733ae02cd6da6825cb7e772dbf80e08aab6fea4074cb8388b486a8bd7",
  qualificationCpuReport: referenceFeatureSharedReplay ? "7f94582f1dc60880cc61c92fac655d3e793a592c58b1fdbd11027937bc2a1944" : "1642e8405c4e4e1a9adb7da00802d696eba6991a48e6d7d4474bc0a9458af717",
  stage0ActionRequest: referenceFeatureSharedReplay ? "a037307140d9db9652aee91142ec669e4d8ef142bfc8d42d0d79d1f37d4b1832" : "d878b4080720f75b12021c1594d606bb6b76a9d977e40314bfe5a14b87ce706c",
  inactiveConfig: referenceFeatureSharedReplay ? "323a3a14bf0269bda101b8e7719fc9bc5d68ebde9e5b2dd7977f3789f2942976" : "2945c28e537f417437a3164c32625967882b3c06774a7407d60499c7b3aaf53a",
  supportContract: referenceFeatureSharedReplay ? "69dc31cca4cddc04d1e695c3d48a5af8e2443dbb6ce1cc0085c5dd2b536c7c47" : "d0618b9679431951208b2ba4427d3f2c8d118524c2e6f682130f936ac5c74c85",
}
for (const [name, value] of Object.entries(expected)) if (hash(files[name]) !== value) throw new Error(`${name} hash changed`)
const authorization = {
  schemaVersion: "ai-painter-owner-implementation-authorization-v1",
  requestId, commandRef: requestId,
  scope: referenceFeatureSharedReplay
    ? "activate_epoch_complete_reference_feature_shared_replay_contract_for_one_fresh_stage0_then_execute_after_all_gates"
    : "activate_epoch_complete_per_class_worst_luminance_contract_for_one_fresh_stage0_then_execute_after_all_gates",
  status: "resolved_owner_authorized_not_consumed",
  implementationActions: [
    "extend_formal_stage_config_compiler_current_contract_activation",
    "extend_formal_stage_cpu_checker_current_contract_activation",
    "run_cpu_positive_negative_regression", "run_active_config_audit",
    "run_real_node_trainer_readonly_preflight", "run_python_cuda_disk_preflight",
    "create_and_consume_one_fresh_stage0_authorization_after_all_gates_pass",
    "execute_one_fresh_stage0_training", "record_local_evidence",
  ],
  explicitlyDeniedActions: [
    "modify_model_structure", "modify_existing_loss_values_or_weights", "modify_dataset_or_split",
    "modify_checkpoint_format", "modify_machine_review_thresholds", "reuse_smoke_checkpoint",
    "reuse_historical_checkpoint", "start_stage1", "start_stage2", "start_stage5",
    "run_formal_inference", "promote_checkpoint", "create_runtime_frame", "enter_world",
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
  schemaVersion: "ai-painter-owner-implementation-consumption-v1", status: "consumed_once",
  requestId, commandRef: requestId, scope: authorization.scope,
  authorizationPath: projectPath(authorizationPath), authorizationSha256: hash(authorizationPath),
  oneTimeConsumption: true, consumedAtUtc: new Date().toISOString(),
})
console.log(JSON.stringify({ status: "consumed_once", authorization: bind(authorizationPath), consumption: bind(consumptionPath) }, null, 2))

function projectFile(value) { return path.resolve(root, value) }
function writeImmutable(file, value) { const handle = fs.openSync(file, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function hash(file) { return createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function projectPath(file) { return path.relative(root, file).replace(/\\/g, "/") }
function bind(file) { return { path: projectPath(file), sha256: hash(file) } }
