import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
if (!/^[0-9]{8}-[0-9]{9}$/.test(args.runId ?? "")) throw new Error("--run-id is required")
if (!args.registeredRequest || !args.registeredRequestSha256) throw new Error("registered request binding is required")
const requestId = `owner-authorized-stage4-condition-fusion-winner-stage0-implementation-${args.runId}`
const output = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("implementation authorization namespace already exists")
const evidence = {
  originalCrossArmTerminal: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-054900000/phase-terminal.json", "6b04a93ea27afbf596414cec5470ffc3148b3582ef178a4520b857bd26adfa73"],
  originalCrossArmReport: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-054900000/cross-arm-comparison-report.json", "984fe9dfb21d2552819d5cc194c839bfaef0b0d93912a5515a0bfbfd6d1ef9db"],
  originalCrossArmDecision: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-054900000/cross-arm-adjudication.json", "ac1bf77100f2e253e6f128cc99a2ae74ca9d2e594e8faf1e4b0ee95e67af10c6"],
  fusionResourceTelemetry: [".runtime/ai-painter/stage4-controlled-structure-controlled-smokes/20260823-051400001-condition_fusion_only_final_direct_residual_23_64_12/resource-telemetry.json", "2e75ac84eb397002c16ee9066c55f733a0ec3304a6781ad06f96d8c03fbde050"],
  capacityResourceTelemetry: [".runtime/ai-painter/stage4-controlled-structure-controlled-smokes/20260823-051400002-capacity_only_base_width_64_to_existing_level1_128/resource-telemetry.json", "6d680111f456df3a2ebe150acf606d25beb444a6cc58eaa3a2f4e065f2031d9e"],
  correctedTerminal: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/phase-terminal.json", "010771f7555e29043aee5dda7b142c820ef7d2a1ff0d55ea2a4bdea928cd4391"],
  correctedDecision: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/cross-arm-adjudication.json", "adf504f93eef3646fcfa66bdba45108e97c115beeede488d5bae7d1c2b489337"],
  correctedActionRequest: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/owner-action-request.json", "b4e93240445072b2ba4beec40e0f284afd92ca12a128d00b867122829cfd4140"],
  mappingCpuReport: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-owner-action-mapping-cpu/20260823-055400000/cpu-report.json", "d3cee1b427c28028cbe8d00876dff0baedae0dbafa27fe47ccdac8840fdf9785"],
  sourceConfig: [".runtime/ai-painter/stage4-controlled-structure-smoke-entry-integrations/20260823-051300000/inactive-fusion-smoke-config.json", "68eba4c67641f0d743d63c9570b942d4a9618cce55700016500754091b70e3c7"],
  terminalQualification: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260823-054700002/phase-terminal.json", "0a98c567225438591bd2ad92f37e28dc4ffd368e1e47a5efe7e0b39da12779e6"],
  registeredRequest: [args.registeredRequest, args.registeredRequestSha256],
}
for (const [name, [relative, expected]] of Object.entries(evidence)) assertBinding(name, relative, expected)
const code = { compiler: "ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py", checker: "ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py", trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py", runner: "scripts/run-stage4-semantic-mixture-formal-stage.mjs" }
const scope = "activate_and_execute_one_fresh_condition_fusion_winner_stage0_after_all_gates"
const authorization = {
  schemaVersion: "ai-painter-owner-implementation-authorization-v1", requestId, commandRef: requestId, scope,
  status: "resolved_owner_authorized_not_consumed",
  implementationActions: ["supersede_stale_cross_arm_owner_action_mapping", "activate_winning_condition_fusion_structure_in_formal_stage0", "fileize_immutable_training_resource_telemetry", "run_cpu_positive_negative_regression", "run_active_config_audit", "run_real_node_trainer_readonly_preflight", "run_python_cuda_disk_preflight", "create_and_consume_one_fresh_stage0_authorization", "execute_one_fresh_stage0_training", "record_local_evidence"],
  explicitlyDeniedActions: ["modify_loss", "modify_dataset_or_split", "modify_checkpoint_format", "modify_review_thresholds", "reuse_checkpoint", "automatic_retry", "free_tuning", "start_stage1", "start_stage2", "stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"],
  sourceEvidence: { ...Object.fromEntries(Object.entries(evidence).map(([name, [relative]]) => [name, bind(relative)])), code: Object.fromEntries(Object.entries(code).map(([name, relative]) => [name, bind(relative)])) },
  winningArm: "condition_fusion_only_final_direct_residual_23_64_12", oneTimeConsumptionRequired: true,
  failurePolicy: { preserveEvidence: true, automaticRetry: false },
}
fs.mkdirSync(output, { recursive: false })
const authorizationPath = path.join(output, "implementation-authorization.json")
writeImmutable(authorizationPath, authorization)
const consumptionPath = path.join(output, "implementation-consumption.json")
writeImmutable(consumptionPath, { schemaVersion: "ai-painter-owner-implementation-consumption-v1", status: "consumed_once", requestId, commandRef: requestId, scope, authorizationPath: project(authorizationPath), authorizationSha256: sha(authorizationPath), oneTimeConsumption: true, consumedAtUtc: new Date().toISOString() })
console.log(JSON.stringify({ status: "consumed_once", implementationRoot: project(output), authorization: bind(authorizationPath), consumption: bind(consumptionPath) }, null, 2))

function parseArgs(values) { const out={}; for(let i=0;i<values.length;i+=2){const key=values[i]; if(!key?.startsWith("--")||i+1>=values.length)throw new Error("invalid arguments"); out[key.slice(2).replaceAll("-","_").replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]=values[i+1]} return out }
function assertBinding(name, relative, expected){const absolute=path.resolve(ROOT,relative);if(!fs.existsSync(absolute)||sha(absolute)!==expected)throw new Error(`${name} identity changed`)}
function writeImmutable(file,value){const h=fs.openSync(file,"wx");try{fs.writeFileSync(h,`${JSON.stringify(value,null,2)}\n`,"utf8");fs.fsyncSync(h)}finally{fs.closeSync(h)}}
function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){const absolute=path.resolve(ROOT,file);return{path:project(absolute),sha256:sha(absolute)}}
