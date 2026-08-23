import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
if (!/^[0-9]{8}-[0-9]{9}$/.test(args.runId ?? "")) throw new Error("--run-id is required")
for (const name of ["cpuReport", "implementationRoot", "registeredRequest", "registeredRequestSha256"]) if (!args[name]) throw new Error(`--${name} is required`)
const requestId = `owner-authorized-stage4-condition-fusion-winner-stage0-execution-${args.runId}`
const output = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("Stage 0 authorization namespace already exists")
const files = {
  sourceConfig: [".runtime/ai-painter/stage4-controlled-structure-smoke-entry-integrations/20260823-051300000/inactive-fusion-smoke-config.json", "68eba4c67641f0d743d63c9570b942d4a9618cce55700016500754091b70e3c7"],
  terminalQualification: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260823-054700002/phase-terminal.json", "0a98c567225438591bd2ad92f37e28dc4ffd368e1e47a5efe7e0b39da12779e6"],
  crossArmTerminal: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/phase-terminal.json", "010771f7555e29043aee5dda7b142c820ef7d2a1ff0d55ea2a4bdea928cd4391"],
  crossArmDecision: [".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/cross-arm-adjudication.json", "adf504f93eef3646fcfa66bdba45108e97c115beeede488d5bae7d1c2b489337"],
  stage0ActionRequest: [args.registeredRequest, args.registeredRequestSha256],
  cpuReport: [args.cpuReport, null],
  implementationAuthorization: [path.join(args.implementationRoot, "implementation-authorization.json"), null],
  implementationConsumption: [path.join(args.implementationRoot, "implementation-consumption.json"), null],
}
for (const [name,[relative,expected]] of Object.entries(files)){const absolute=path.resolve(ROOT,relative);if(!fs.existsSync(absolute))throw new Error(`missing binding: ${name}`);if(expected&&sha(absolute)!==expected)throw new Error(`${name} identity changed`)}
const cpu=read(files.cpuReport[0]); const qualification=read(files.terminalQualification[0]); const decision=read(files.crossArmDecision[0]); const source=read(files.sourceConfig[0])
if (cpu.status !== "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression" || cpu.positivePassed !== cpu.positiveTotal || cpu.negativePassed !== cpu.negativeTotal || qualification.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed" || qualification.stage0EntryPermitted !== true || decision.outcome !== "condition_fusion_only_priority" || source.stage4ControlledStructureArm !== "condition_fusion_only_final_direct_residual_23_64_12") throw new Error("Stage 0 source gates are not eligible")
const code = { authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py", modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py", trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py", compiler: "ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py", cpuChecker: "ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py", runner: "scripts/run-stage4-semantic-mixture-formal-stage.mjs" }
const authorization = {
  schemaVersion: "ai-painter-stage4-formal-stage-execution-authorization-v1", requestId, commandRef: requestId,
  scope: "one_stage4_semantic_mixture_stage0_full_training_only", status: "resolved_owner_authorized_not_consumed",
  executionActions: ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "run_stage0"],
  explicitlyDeniedActions: ["load_parent_denoiser", "run_stage1", "run_stage2", "run_stage5", "run_formal_inference", "promote_checkpoint", "create_runtime_frame", "enter_world"],
  controlledStructureArm: "condition_fusion_only_final_direct_residual_23_64_12",
  bindings: { sourceConfig: bind(files.sourceConfig[0]), terminalQualification: bind(files.terminalQualification[0]), crossArmTerminal: bind(files.crossArmTerminal[0]), crossArmDecision: bind(files.crossArmDecision[0]), stage0ActionRequest: bind(files.stage0ActionRequest[0]), cpuReport: bind(files.cpuReport[0]), implementationAuthorization: bind(files.implementationAuthorization[0]), implementationConsumption: bind(files.implementationConsumption[0]), code: Object.fromEntries(Object.entries(code).map(([name,relative])=>[name,sha(path.resolve(ROOT,relative))])) },
  fixedStage: 0, fixedResolution: { width: 256, height: 192 }, fixedEpochs: 40, fixedSeed: 20263722,
  fixedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 }, initialization: "project_random_fact_conditioned_semantic_mixture",
  smokeCheckpointAllowed: false, historicalCheckpointAllowed: false, automaticRetryAllowed: false, oneTimeConsumptionRequired: true,
}
fs.mkdirSync(output,{recursive:false}); const authorizationPath=path.join(output,"execution-authorization.json"); writeImmutable(authorizationPath,authorization)
console.log(JSON.stringify({status:"created_unconsumed",authorization:bind(authorizationPath)},null,2))

function parseArgs(values){const out={};for(let i=0;i<values.length;i+=2){const key=values[i];if(!key?.startsWith("--")||i+1>=values.length)throw new Error("invalid arguments");out[key.slice(2).replaceAll("-","_").replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]=values[i+1]}return out}
function read(file){return JSON.parse(fs.readFileSync(path.resolve(ROOT,file),"utf8"))}
function writeImmutable(file,value){const h=fs.openSync(file,"wx");try{fs.writeFileSync(h,`${JSON.stringify(value,null,2)}\n`,"utf8");fs.fsyncSync(h)}finally{fs.closeSync(h)}}
function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){const absolute=path.resolve(ROOT,file);return{path:project(absolute),sha256:sha(absolute)}}
