import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
if (!/^[0-9]{8}-[0-9]{9}$/.test(args.runId ?? "")) throw new Error("--run-id is required")
if (!args.registeredRequest || !args.registeredRequestSha256) throw new Error("registered request binding is required")
const requestId = `owner-authorized-stage4-conflict-aware-gradient-stage0-implementation-${args.runId}`
const output = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("implementation authorization namespace already exists")

const files = {
  qualificationTerminal: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/phase-terminal.json", "dbaf16d2edbd6faa4d60aad001555c54ed21df493a44c62ebceb8dff0afcb7fc"],
  qualificationReport: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/timeline-qualification-report.json", "41021fa164cef99804b9f8cde27f93c4576e2421718eab0ad161dd3d215a099d"],
  qualificationDecision: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/qualification-decision.json", "c4d5f90cca9142ba2fe06864af92cb542a7a62056a538b551781d078efe2f861"],
  sourceActionRequest: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/stage0-owner-action-request.json", "2ad8c1c14adb7c27f4046dbf968f3d7bd7f9e4701a8fe741e25ce856a02267f9"],
  inactiveConfig: [".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/inactive-config.json", "f9c7dbc10f31f728034e30722ca13e85d9b6d13e8377fe38a0d661582322c644"],
  supportContract: [".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/training-paradigm-support-contract.json", "69248e28e3d906bbac671503cfe4a65abce59d4386c9b7ed5cb040d59b9aac67"],
  registeredRequest: [args.registeredRequest, args.registeredRequestSha256],
}
const code = {
  compiler: "ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py",
  checker: "ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  runner: "scripts/run-stage4-semantic-mixture-formal-stage.mjs",
}
for (const [name, [relative, expected]] of Object.entries(files)) assertBinding(name, relative, expected)
for (const relative of Object.values(code)) if (!fs.existsSync(path.resolve(ROOT, relative))) throw new Error(`missing code: ${relative}`)

const scope = "activate_conflict_aware_gradient_aggregation_for_one_fresh_stage0_then_execute_after_all_gates"
const authorization = {
  schemaVersion: "ai-painter-owner-implementation-authorization-v1",
  requestId, commandRef: requestId, scope,
  status: "resolved_owner_authorized_not_consumed",
  implementationActions: [
    "register_current_owner_action_request_latest", "activate_conflict_aware_contract_in_formal_stage0",
    "extend_trainer_formal_activation_gate", "extend_formal_stage_cpu_regression",
    "run_cpu_positive_negative_regression", "run_active_config_audit",
    "run_real_node_trainer_readonly_preflight", "run_python_cuda_disk_preflight",
    "create_and_consume_one_fresh_stage0_authorization", "execute_one_fresh_stage0_training",
    "record_local_evidence",
  ],
  explicitlyDeniedActions: [
    "modify_model_structure", "modify_loss_values_or_weights", "modify_dataset_or_split",
    "modify_checkpoint_format", "modify_machine_review_thresholds", "reuse_smoke_checkpoint",
    "reuse_historical_checkpoint", "automatic_retry", "free_tuning", "start_stage1",
    "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion",
    "runtime_frame", "world_entry",
  ],
  sourceEvidence: {
    ...Object.fromEntries(Object.entries(files).map(([name, [relative]]) => [name, bind(relative)])),
    code: Object.fromEntries(Object.entries(code).map(([name, relative]) => [name, bind(relative)])),
  },
  oneTimeConsumptionRequired: true,
  failurePolicy: { preserveEvidence: true, automaticRetry: false },
}
fs.mkdirSync(output, { recursive: false })
const authorizationPath = path.join(output, "implementation-authorization.json")
writeImmutable(authorizationPath, authorization)
const consumptionPath = path.join(output, "implementation-consumption.json")
writeImmutable(consumptionPath, {
  schemaVersion: "ai-painter-owner-implementation-consumption-v1",
  status: "consumed_once", requestId, commandRef: requestId, scope,
  authorizationPath: project(authorizationPath), authorizationSha256: sha(authorizationPath),
  oneTimeConsumption: true, consumedAtUtc: new Date().toISOString(),
})
console.log(JSON.stringify({ status: "consumed_once", implementationRoot: project(output), authorization: bind(authorizationPath), consumption: bind(consumptionPath) }, null, 2))

function parseArgs(values) { const out = {}; for (let i=0;i<values.length;i+=2) { const key=values[i]; if (!key?.startsWith("--") || i+1>=values.length) throw new Error("invalid arguments"); out[key.slice(2).replaceAll("-", "_").replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]=values[i+1] } return out }
function assertBinding(name, relative, expected) { const absolute=path.resolve(ROOT,relative); if(!fs.existsSync(absolute)||sha(absolute)!==expected) throw new Error(`${name} identity changed`) }
function writeImmutable(file,value){const h=fs.openSync(file,"wx");try{fs.writeFileSync(h,`${JSON.stringify(value,null,2)}\n`,"utf8");fs.fsyncSync(h)}finally{fs.closeSync(h)}}
function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){const absolute=path.resolve(ROOT,file);return{path:project(absolute),sha256:sha(absolute)}}
