import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const ROOT = process.cwd()
const args = parseArgs(process.argv.slice(2))
if (!/^[0-9]{8}-[0-9]{9}$/.test(args.runId ?? "")) throw new Error("--run-id is required")
for (const name of ["cpuReport", "implementationRoot", "registeredRequest", "registeredRequestSha256"]) if (!args[name]) throw new Error(`--${name} is required`)
const requestId = `owner-authorized-stage4-conflict-aware-gradient-stage0-execution-${args.runId}`
const output = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests", requestId)
if (fs.existsSync(output)) throw new Error("Stage 0 authorization namespace already exists")

const files = {
  sourceConfig: [".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/inactive-config.json", "f9c7dbc10f31f728034e30722ca13e85d9b6d13e8377fe38a0d661582322c644"],
  terminalQualification: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/phase-terminal.json", "dbaf16d2edbd6faa4d60aad001555c54ed21df493a44c62ebceb8dff0afcb7fc"],
  qualificationReport: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/timeline-qualification-report.json", "41021fa164cef99804b9f8cde27f93c4576e2421718eab0ad161dd3d215a099d"],
  qualificationDecision: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-142452041/qualification-decision.json", "c4d5f90cca9142ba2fe06864af92cb542a7a62056a538b551781d078efe2f861"],
  stage0ActionRequest: [args.registeredRequest, args.registeredRequestSha256],
  cpuReport: [args.cpuReport, null],
  implementationAuthorization: [path.join(args.implementationRoot, "implementation-authorization.json"), null],
  implementationConsumption: [path.join(args.implementationRoot, "implementation-consumption.json"), null],
}
for (const [name,[relative,expected]] of Object.entries(files)) {
  const absolute=path.resolve(ROOT,relative); if(!fs.existsSync(absolute)) throw new Error(`missing binding: ${name}`)
  if(expected && sha(absolute)!==expected) throw new Error(`${name} identity changed`)
}
const cpu = read(files.cpuReport[0])
const qualification = read(files.terminalQualification[0])
if (
  cpu.status !== "passed_stage4_semantic_mixture_formal_stage_modes_cpu_regression"
  || cpu.positivePassed !== cpu.positiveTotal || cpu.negativePassed !== cpu.negativeTotal
  || qualification.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed"
  || qualification.stage0EntryPermitted !== true
) throw new Error("Stage 0 source gates are not eligible")

const code = {
  authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
  modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  compiler: "ml/ai-painter/scripts/compile_stage4_semantic_mixture_full_training_config.py",
  cpuChecker: "ml/ai-painter/scripts/check_stage4_semantic_mixture_full_training_modes_cpu.py",
  runner: "scripts/run-stage4-semantic-mixture-formal-stage.mjs",
}
for (const relative of Object.values(code)) if(!fs.existsSync(path.resolve(ROOT,relative))) throw new Error(`missing code: ${relative}`)
const authorization = {
  schemaVersion: "ai-painter-stage4-formal-stage-execution-authorization-v1",
  requestId, commandRef: requestId,
  scope: "one_stage4_semantic_mixture_stage0_full_training_only",
  status: "resolved_owner_authorized_not_consumed",
  executionActions: ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "run_stage0"],
  explicitlyDeniedActions: ["load_parent_denoiser", "run_stage1", "run_stage2", "run_stage5", "run_formal_inference", "promote_checkpoint", "create_runtime_frame", "enter_world"],
  bindings: {
    sourceConfig: bind(files.sourceConfig[0]), terminalQualification: bind(files.terminalQualification[0]),
    qualificationReport: bind(files.qualificationReport[0]), qualificationDecision: bind(files.qualificationDecision[0]),
    stage0ActionRequest: bind(files.stage0ActionRequest[0]), cpuReport: bind(files.cpuReport[0]),
    implementationAuthorization: bind(files.implementationAuthorization[0]),
    implementationConsumption: bind(files.implementationConsumption[0]),
    code: Object.fromEntries(Object.entries(code).map(([name,relative])=>[name,sha(path.resolve(ROOT,relative))])),
  },
  fixedStage: 0, fixedResolution: { width: 256, height: 192 }, fixedEpochs: 40,
  fixedSeed: 20263722, fixedSplitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
  initialization: "project_random_fact_conditioned_semantic_mixture",
  smokeCheckpointAllowed: false, historicalCheckpointAllowed: false,
  automaticRetryAllowed: false, oneTimeConsumptionRequired: true,
}
fs.mkdirSync(output,{recursive:false})
const authorizationPath=path.join(output,"execution-authorization.json")
writeImmutable(authorizationPath,authorization)
console.log(JSON.stringify({status:"created_unconsumed",authorization:bind(authorizationPath)},null,2))

function parseArgs(values){const out={};for(let i=0;i<values.length;i+=2){const key=values[i];if(!key?.startsWith("--")||i+1>=values.length)throw new Error("invalid arguments");out[key.slice(2).replaceAll("-","_").replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]=values[i+1]}return out}
function read(file){return JSON.parse(fs.readFileSync(path.resolve(ROOT,file),"utf8"))}
function writeImmutable(file,value){const h=fs.openSync(file,"wx");try{fs.writeFileSync(h,`${JSON.stringify(value,null,2)}\n`,"utf8");fs.fsyncSync(h)}finally{fs.closeSync(h)}}
function sha(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}
function project(file){return path.relative(ROOT,path.resolve(ROOT,file)).replaceAll("\\","/")}
function bind(file){const absolute=path.resolve(ROOT,file);return{path:project(absolute),sha256:sha(absolute)}}
