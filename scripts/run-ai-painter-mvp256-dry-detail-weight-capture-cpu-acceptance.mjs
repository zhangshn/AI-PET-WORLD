// Private leased acceptance: one retained native Job, isolated metadata only.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {spawnSync} from "node:child_process"
import {fileURLToPath} from "node:url"
import {inside,read,json,bind,write,sha,validatePlan,makeInternalCandidate,CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE} from "./lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs"
import {runNative,nativeAccountingRoots,withNativeReceiptBudget} from "./run-ai-painter-mvp256-dry-detail-weight-capture-training.mjs"
import {processIdentity} from "./run-ai-painter-mvp256-dry-v24-training.mjs"
import {initializeCurrentExecutionRegistry,advanceCurrentExecutionRegistry,readCurrentExecutionRegistry} from "../src/server/ai-painter-current-execution-registry.mjs"
import {materializeAutonomousClosedLoopPackage} from "./lib/ai-painter-autonomous-package-materializer-v1.mjs"
import {CLOSED_LOOP_CONTRACT_PATH} from "./lib/ai-painter-autonomous-closed-loop-v1.mjs"
const SELF=fileURLToPath(import.meta.url)
export const TASK_ROOT=".runtime/ai-painter/detail-weight-capture-bounded-repair-t-q4-51"
const CPU_TASK_ROOTS={"T-Q4-51":TASK_ROOT,"T-Q4-55":".runtime/ai-painter/native-startup-recovery-t-q4-55/cpu","T-Q4-58":".runtime/ai-painter/post-reboot-current-source-t-q4-58/cpu","T-Q4-59":".runtime/ai-painter/corrected-source-verification-t-q4-59/cpu","T-Q4-60":".runtime/ai-painter/output-accounting-race-repair-t-q4-60/cpu","T-Q4-61":".runtime/ai-painter/progress-publication-current-source-t-q4-61/cpu","T-Q4-62":".runtime/ai-painter/progress-publication-binding-guard-t-q4-62/cpu","T-Q4-64":".runtime/ai-painter/seventy-minute-resource-successor-t-q4-64/cpu","T-Q4-65":".runtime/ai-painter/seventy-minute-config-binding-repair-t-q4-65/cpu"}
export const WORKER_BYTES=7340032,RESERVE=65536
const REGISTRY=".runtime/ai-painter/current-execution-registry/current.json"
const TEST="ml/ai-painter/tests/test_painter_stage4_detail_weight_capture_execution_worker.py"
const GUIDE_SNAPSHOT={path:".runtime/ai-painter/detail-weight-postfailure-t-q4-48/controller/prior-execution-guide.json",sha256:"804ef037e782f190903b1e9f7497fe1259fb73d7602b4c032bed6e1cd0688214"}
function bytes(dir){if(!fs.existsSync(dir))return 0;return fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>{const p=path.join(dir,e.name);assert.equal(fs.lstatSync(p).isSymbolicLink(),false);return n+(e.isDirectory()?bytes(p):fs.statSync(p).size)},0)}
export function validateBatch(raw){
 assert.equal(raw.failed,0);assert.equal(raw.errors,0);assert.equal(raw.skipped,0)
 assert.ok(raw.passed>0&&raw.testsAttempted===raw.testsCompleted&&raw.items.length===raw.passed&&raw.testsCompleted===raw.passed)
 assert.ok(raw.items.every(x=>x.status==="passed"));assert.equal(raw.synthetic,true);assert.equal(raw.gpuInitialized,false)
 for(const n of Object.values(raw.actualCalls))assert.equal(n,0)
 for(const n of Object.values(raw.actualOptimizerSteps))assert.equal(n,0)
 for(const key of ["cudaAttempted","realDatasetReads","generatorStepAttempted","discriminatorStepAttempted"])assert.equal(raw.events[key],0)
}
function copy(root,isolated,binding){const payload=read(root,binding);assert.ok(payload.length<=2097152,"isolated source/metadata input ceiling");assert.ok(!/\.(png|jpg|jpeg|webp|pt)$/u.test(binding.path),"pixels/checkpoints excluded");write(isolated,binding.path,payload)}

export async function isolatedRegistry({root,plan,executionPackage,programBindings}){
 const stamp=new Date().toISOString()
 const candidate=write(root,".runtime/fixture/plan/candidate.json",{schemaVersion:"stage4-post-decode-bounded-candidate-v1",status:"cpu_inactive_candidate_planned_not_implemented",selectedCandidate:{candidateKind:"synthetic_fixture"},recordedAtUtc:stamp})
 const priorPlan=write(root,".runtime/fixture/plan/terminal.json",{schemaVersion:"stage4-post-decode-failure-bounded-planning-terminal-v1",executionState:"completed",status:"bounded_candidate_planning_completed",planningRunId:"synthetic-plan",nextAction:"synthetic-next",candidate,recordedAtUtc:stamp})
 const capsule=write(root,".runtime/fixture/plan/capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v2",latestTerminal:priorPlan,recordedAtUtc:stamp})
 const prior=write(root,".runtime/fixture/prior/terminal.json",{schemaVersion:"stage4-post-decode-object-rgb-stage0-terminal-v1",executionState:"completed",status:"post_decode_object_rgb_stage0_real_visual_failure",runId:"synthetic-prior",synthetic:true})
 for(const [name,value]of[["execution-state.json",{status:"completed"}],["machine-review.json",{synthetic:true}],["training-output/progress.json",{synthetic:true}]])write(root,".runtime/fixture/prior/"+name,value)
 const initial=await initializeCurrentExecutionRegistry({projectRoot:root,currentTaskCapsulePath:capsule.path,currentTaskTerminalPath:priorPlan.path,currentCandidatePath:candidate.path,latestTrainingTerminalPath:prior.path,archivedEvidenceNamespaces:[".runtime/fixture/archive"]});assert.equal(initial.ok,true)
 const identity={capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,processId:process.pid,processStartIdentity:processIdentity(process.pid)}
 const lock=write(root,plan.outputRoot+"/execution-lock.json",{schemaVersion:"ai-painter-current-active-execution-lock-v1",...identity})
 write(root,plan.outputRoot+"/heartbeat.json",{schemaVersion:"ai-painter-current-active-execution-heartbeat-v1",...identity,executionState:"executing",heartbeatAtUtc:stamp,ttlSeconds:120})
 const active={schemaVersion:"ai-painter-current-active-execution-v1",...identity,executionState:"executing",programLineage:programBindings,lock,heartbeat:{path:plan.outputRoot+"/heartbeat.json",ttlSeconds:120}}
 const evidence=write(root,".runtime/fixture/current/evidence.json",{synthetic:true,executionPackage,programBindings})
 const terminal=write(root,".runtime/fixture/current/terminal.json",{schemaVersion:"detail-weight-synthetic-registry-terminal-v1",executionState:"completed",status:"synthetic_registry_roundtrip",runId:plan.runId,executionPackage,formalStage4QualificationGranted:false,runtimePublicationGranted:false})
 const task=write(root,".runtime/fixture/current/capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v1",integrity:{status:"verified"},evidence:[{...evidence,kind:"synthetic_structure",sha256Verified:true}]})
 const advanced=await advanceCurrentExecutionRegistry({projectRoot:root,capabilityVersion:CAPABILITY,packageId:plan.packageId,taskId:plan.runId,taskKind:"cpu_structure",taskGoal:"Synthetic successor package registry/preflight",priority:5,queueStatus:"running",nextMachineAction:null,queuedAtUtc:stamp,runId:plan.runId,lifecycleStage:"synthetic",executionState:"executing",activity:"cpu_structure",taskCapsulePath:task.path,terminalEvidencePath:terminal.path,activeExecution:active,expectedPreviousRegistryRevision:initial.registry.registryRevision,expectedPreviousRegistrySha256:initial.registrySha256})
 assert.equal(advanced.ok,true);const verified=await readCurrentExecutionRegistry(root);assert.equal(verified.ok,true);assert.equal(verified.registrySha256,advanced.registrySha256)
 assert.deepEqual(verified.registry.activeExecution.programLineage,programBindings)
 return {status:"isolated_registry_roundtrip_verified",registryRevisionBefore:initial.registry.registryRevision,registryRevisionAfter:verified.registry.registryRevision,registrySha256:verified.registrySha256,executionPackage,programBindings,productionRegistryChanged:false,synthetic:true,supervisorPid:identity.processId,supervisorStartIdentity:identity.processStartIdentity}
}

async function child(root,out,inputBinding,deadline){
 const input=json(root,inputBinding),work=json(root,input.workorder)
 for(const b of Object.values(input.programBindings))read(root,b)
 const isolated=inside(root,out+"/isolated-project");fs.mkdirSync(isolated,{recursive:false})
 // Every mirrored source is immutable and budgeted; never mirror pixels,
 // checkpoints or historical failure tensors into the isolated project.
 const mirrored=new Set()
 for(const b of input.copyBindings){if(!mirrored.has(b.path)){copy(root,isolated,b);mirrored.add(b.path)}}
 const model=json(isolated,work.baseline.priorModelEvidence.modelCpuReport)
 const configuration=input.configuration,candidate=json(isolated,configuration.sourceCandidate)
 const plan={schema:PLAN_SCHEMA,executionProfile:EXECUTION_PROFILE,executionMode:"synthetic-cpu-bootstrap",capabilityVersion:CAPABILITY,runId:"capture-t51-cpu-bootstrap-run",packageId:"capture-t51-cpu-bootstrap-package",outputRoot:".runtime/ai-painter/detail-weight-capture-managed-executions/cpu-bootstrap-t51",configuration,sourceCandidate:configuration.sourceCandidate,formalSpecification:configuration.formalSpecification,programBindings:input.programBindings,lifecycleCpuAcceptance:write(isolated,".runtime/bootstrap-lifecycle-pending.json",{status:"pending_current_owned_receipt",synthetic:true}),modelCpuReport:work.baseline.priorModelEvidence.modelCpuReport,modelCpuReceipt:work.baseline.priorModelEvidence.modelCpuReceipt,numericalSourceBindings:model.inputBindings.filter(b=>b.path.endsWith(".py")&&(b.path.startsWith("ml/ai-painter/src/")||b.path.startsWith("ml/ai-painter/scripts/"))),numericalIdentity:{graph:model.graph,initialState:model.initialState,datasetManifest:model.datasetManifest},modelContextSnapshots:input.modelContextSnapshots,historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,...Object.fromEntries(["datasetManifest","trainSplit","validationSplit"].map(k=>[k,candidate.frozenBindings[k]]))}
 if(input.resourcePolicy)plan.resourcePolicy=input.resourcePolicy
 validatePlan(isolated,plan)
 const planBinding=write(isolated,plan.outputRoot+"/detail-weight-capture-plan.json",plan)
 const materialized=materializeAutonomousClosedLoopPackage(makeInternalCandidate(isolated,planBinding),{root:isolated})
 const executionPackage={path:materialized.packagePath,sha256:materialized.packageSha256}
 const registry=await isolatedRegistry({root:isolated,plan,executionPackage,programBindings:input.programBindings})
 const proof=write(root,out+"/isolated-registry-proof.json",registry)
 const packet=write(isolated,".runtime/bootstrap-input.json",{executionPackage,programBindings:input.programBindings,isolatedProjectRoot:isolated,supervisorPid:process.pid,supervisorStartIdentity:registry.supervisorStartIdentity,rawOutput:plan.outputRoot+"/cpu-raw-tests.json"})
 assert.ok(Date.now()<deadline,"CPU bootstrap deadline")
 const python=spawnSync(inside(root,"ml/ai-painter/.venv/Scripts/python.exe"),["-B",inside(isolated,TEST),"--input",packet.path,"--sha256",packet.sha256],{cwd:isolated,env:{...process.env,CUDA_VISIBLE_DEVICES:"",PYTHONDONTWRITEBYTECODE:"1",OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2"},windowsHide:true,timeout:Math.max(1,deadline-Date.now()-5000),encoding:"utf8",maxBuffer:65536})
 write(root,out+"/python-stderr.txt",Buffer.from(python.stderr??""))
 if(!fs.existsSync(inside(isolated,plan.outputRoot+"/cpu-raw-tests.json")))throw new Error("Python synthetic batch produced no report (exit="+String(python.status)+"): "+String(python.error?.message??python.stderr??"").slice(-8192))
 const raw=json(isolated,bind(isolated,plan.outputRoot+"/cpu-raw-tests.json"))
 const {runCases}=await import("./tests/ai-painter-mvp256-dry-detail-weight-capture-integration.test.mjs")
 const js=await runCases({projectRoot:root,isolated,plan,executionPackage,programBindings:input.programBindings})
 raw.items.push(...js);raw.testsAttempted+=js.length;raw.testsCompleted+=js.length
 raw.passed+=js.filter(x=>x.status==="passed").length;raw.failed+=js.filter(x=>x.status!=="passed").length
 raw.isolatedRegistryProof=proof;raw.programBindings=input.programBindings;write(root,out+"/raw-tests.json",raw)
 assert.equal(python.status,0,python.error?.message??"Python synthetic batch failed");validateBatch(raw)
 assert.equal(sha(fs.readFileSync(inside(root,REGISTRY))),input.productionRegistrySha256,"production registry changed")
 for(const b of Object.values(input.programBindings))read(root,b)
 console.log(JSON.stringify({status:"synthetic_cpu_batch_completed",raw:bind(root,out+"/raw-tests.json")}))
}

export async function accept({root,requestBinding,leaseBinding}){
 const request=json(root,requestBinding),lease=json(root,leaseBinding)
 assert.equal(lease.schema,"detail-weight-capture-cpu-lease-v1");assert.equal(lease.taskId,request.taskId);assert.ok(Object.hasOwn(CPU_TASK_ROOTS,lease.taskId));const taskRoot=CPU_TASK_ROOTS[lease.taskId];assert.deepEqual(lease.request,requestBinding)
 assert.equal(lease.invocations,1);assert.equal(lease.cpuThreads,2);assert.equal(lease.wallSeconds,120);assert.equal(lease.outputBytes,WORKER_BYTES);assert.equal(lease.automaticRetries,0)
 assert.ok(Number.isFinite(Date.parse(lease.expiresAtUtc))&&Date.now()<Date.parse(lease.expiresAtUtc),"CPU lease expired")
 const work=json(root,request.workorder);assert.equal(work.taskId,request.taskId)
 assert.ok(request.outputRoot.startsWith(taskRoot+"/training/"));assert.equal(request.phase,"final_source_synthetic_cpu")
 for(const b of work.baseline.frozenBindings)read(root,b)
 for(const b of Object.values(request.programBindings))read(root,b)
 // Create only this request's explicit new accounting root before metering.
 // A missing or redirected root after this point is a failure, never zero bytes.
 fs.mkdirSync(inside(root,taskRoot),{recursive:true})
 const accountingRoots=nativeAccountingRoots(root,request.outputRoot,null,taskRoot)
 const currentBytes=accountingRoots.reduce((n,logical)=>n+bytes(inside(root,logical)),0)
 assert.ok(Number.isSafeInteger(request.conservativeAdditionalBytes)&&request.conservativeAdditionalBytes>0)
 const copies=[...new Map(request.copyBindings.map(b=>[b.path,b])).values()]
 const copyBytes=copies.reduce((n,b)=>n+read(root,b).length,0)
 assert.ok(request.conservativeAdditionalBytes>=copyBytes,"CPU prediction must include all copied input bytes")
 // This larger internal reservation reduces ordinary capacity; it does not
 // grant another CPU invocation or enlarge the fixed seven-MiB worker ceiling.
 assert.ok(currentBytes+request.conservativeAdditionalBytes<=WORKER_BYTES-1048576,"aggregate conservative CPU preflight/reserve")
 assert.equal(fs.existsSync(inside(root,".runtime/ai-painter/owned-worker-guards/active.json")),false,"CPU guard busy before lease consumption")
 process.env.DETAIL_WEIGHT_OUTPUT_ROOTS=JSON.stringify(accountingRoots);process.env.DETAIL_WEIGHT_BUDGET_PROJECT_ROOT=root;process.env.DETAIL_WEIGHT_OUTPUT_MAX=String(WORKER_BYTES-1048576)
 write(root,request.outputRoot+"/cpu-lease-consumed.json",{lease:leaseBinding,request:requestBinding,automaticRetries:0})
 const production=fs.readFileSync(inside(root,REGISTRY)),input=write(root,request.outputRoot+"/cpu-input.json",{...request,productionRegistrySha256:sha(production)})
 try{
  const result=await runNative({root,outputRoot:request.outputRoot,phase:"cpu",executable:process.execPath,args:[SELF,"--internal-owned-child",root,request.outputRoot,input.path,input.sha256,String(Date.now()+112000)],cpuAccountingRoot:taskRoot,cpuMaximumBytes:WORKER_BYTES})
  // runNative saved the original live owner receipt before optional audits.
  const rawBinding=bind(root,request.outputRoot+"/raw-tests.json"),raw=json(root,rawBinding);validateBatch(raw)
  assert.ok(fs.readFileSync(inside(root,REGISTRY)).equals(production))
  for(const b of Object.values(request.programBindings))read(root,b)
  return withNativeReceiptBudget(root,result.ownedReceipt,()=>write(root,request.outputRoot+"/acceptance.json",{schema:"detail-weight-capture-lifecycle-cpu-acceptance-v1",status:"passed",programBindings:request.programBindings,testResult:rawBinding,ownedReceipt:result.receiptBinding,isolatedRegistryProof:bind(root,request.outputRoot+"/isolated-registry-proof.json"),productionRegistryChanged:false,gpuInitialized:false,realTrainingStarted:false,synthetic:true,productionAdopted:false,automaticRetries:0}))
 }catch(error){const persist=()=>write(root,request.outputRoot+"/acceptance-failure.json",{status:"failed_closed",error:String(error),ownedReceipt:error.receiptBinding??null,productionAdopted:false,automaticRetries:0});try{if(error.ownedReceipt?.outputAccountingRoots)await withNativeReceiptBudget(root,error.ownedReceipt,persist);else persist()}catch(secondary){error.secondaryEvidenceError=String(secondary)}throw error}
}

if(process.argv[2]==="--internal-owned-child"){
 try{await child(process.argv[3],process.argv[4],{path:process.argv[5],sha256:process.argv[6]},Number(process.argv[7]))}catch(error){console.error(String(error));process.exitCode=1}
}else if(process.argv[2]==="--request"){
 assert.deepEqual([process.argv[4],process.argv[6],process.argv[8]],["--request-sha256","--lease","--lease-sha256"])
 const root=path.resolve(path.dirname(SELF),"..")
 console.log(JSON.stringify(await accept({root,requestBinding:{path:process.argv[3],sha256:process.argv[5]},leaseBinding:{path:process.argv[7],sha256:process.argv[9]}})))
}
