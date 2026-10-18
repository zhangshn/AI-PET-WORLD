// Candidate CPU verification only; no GPU/training scheduler or old-run retry.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createReader} from "./lib/ai-painter-stage4-dataset-audit.mjs";
import {runParameter60OwnedWorker} from "./lib/ai-painter-parameter60-owned-worker-v1.mjs";
import {createOwnedAccounting,proofPassed} from "./diagnose-ai-painter-parameter60-causal-gpu.mjs";
import {readCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from "../src/server/ai-painter-current-execution-registry.mjs";
const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),"..");
export const POLICY={path:"data/ai-painter/system-governance/ai-painter-terrain-detail-weight-precision-cpu-policy-v1.json",sha256:"8c94ed1b2828195111855a79cef10f54b66b500209d518820717c6ed3ba43917"};
const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
const OWN=[
"scripts/check-ai-painter-terrain-detail-weight-precision-cpu.mjs",
"scripts/diagnose-ai-painter-parameter60-causal-gpu.mjs",
"scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs",
"scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs",
"scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs",
"scripts/lib/ai-painter-stage4-dataset-audit.mjs",
"src/server/ai-painter-current-execution-registry.mjs",
"ml/ai-painter/scripts/check_terrain_detail_weight_precision_cpu.py",
"ml/ai-painter/scripts/diagnose_parameter60_causal_gpu_v1.py",
"ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_restore_v1.py",
"ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_observation_v1.py",
"ml/ai-painter/src/ai_painter/complete_world/terrain_detail_weight_reduction_precision_v1.py",
"ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_precision_v1.py",
"ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_priority_update_v1.py",
"ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py",
"ml/ai-painter/tests/test_ecology_terrain_detail_precision_cpu.py"];
export function validatePolicy(p){
 assert.equal(p.schemaVersion,"ai-painter-terrain-detail-weight-precision-cpu-policy-v1");
 assert.equal(p.status,"registered_cpu_candidate_verification_only");
 assert.equal(p.formalSpecification.version,"AI-PAINTER-SPEC-1.66");
 assert.equal(p.candidate,"stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1");
 assert.equal(p.target.parameterIndex,60);assert.equal(p.target.parameterName,"core.core.terrain.full_resolution_detail.layers.3.weight");
 assert.deepEqual(p.target.weightShape,[48,48,3,3]);
 assert.equal(p.scope.split,"train");assert.equal(p.scope.sampleCount,1);assert.deepEqual(p.scope.resolution,[256,192]);
 assert.equal(p.scope.failureStateInitializationAllowed,false);assert.equal(p.scope.initializationSeed,20260929);
 assert.deepEqual(p.resources,{maxWallSeconds:120,threads:2,maxOutputBytes:8388608,maxStreamBytes:8388608,failureReserveBytes:65536,cleanupReserveMs:1000,finalizationReserveMs:8000,attempts:1,automaticRetries:0});
 assert.deepEqual(p.limits,{fullBaselineForwards:1,fullCandidateForwards:1,fullGeneratorAutogradCalls:4,operatorFixtureForwards:1,operatorFixtureAutogradCalls:4,discriminatorAutogradCalls:0,optimizerConstruction:0,optimizerUpdates:0,cudaCalls:0});
 assert.deepEqual(p.comparison,{atol:1e-6,rtol:1e-5,originalGateKept:true,nativeForwardBytesIdentical:true,onlyTargetWeightGradientChanged:true});
 for(const value of Object.values(p.qualification))assert.equal(value,false);
 return true;
}
export function validateResult(v,p){
 assert.equal(v.status,"cpu_candidate_verified_inactive");assert.equal(v.executionState,"completed");
 assert.deepEqual(v.policy,POLICY);assert.equal(v.candidate,p.candidate);assert.deepEqual(v.counts,p.limits);
 assert.equal(v.cudaInitialized,false);assert.equal(v.trainingAllowed,false);assert.equal(v.stage4Qualified,false);
 assert.equal(v.failedStateOrCheckpointLoaded,false);assert.equal(v.pngOrCheckpointWritten,false);
 assert.equal(v.nativeFull256ForwardBytesEqual,true);assert.equal(v.fullOriginalLossGradientGatePassed,true);
 assert.equal(v.beforeAfterStateBytesEqual,true);assert.equal(v.capturedFixtureOutsideToleranceElements,0);
 assert(v.componentTests.passed>0&&v.componentTests.skipped===0);
}
export function keepPrimaryError(first,secondary,field){
 if(first){first[field]=String(secondary.stack??secondary);return first;}
 return secondary;
}
export async function runCpu(){
 const began=Date.now(),deadline=began+120000,reader=createReader(ROOT);
 const p=reader.bound(POLICY);validatePolicy(p);reader.bytes(p.formalSpecification.path,p.formalSpecification.sha256);
 const registry=await readCurrentExecutionRegistry(ROOT,{deadlineUnixMs:deadline});assert(registry.ok&&registry.registry.activeExecution===null);
 assert(!fs.existsSync(path.join(ROOT,".runtime/ai-painter/owned-worker-guards/active.json")),"existing guard refused");
 const locator=reader.bound(p.dataLocator),lineage=new Map();
 for(const b of Object.values(locator.context.programBindings))if(b.path.startsWith("ml/ai-painter/")&&b.path.endsWith(".py")){reader.bytes(b.path,b.sha256);lineage.set(b.path,{path:b.path,sha256:b.sha256});}
 for(const item of p.sourceAlgorithmBindings)reader.bytes(item.binding.path,item.binding.sha256);
 for(const b of Object.values(p.operatorFixture))reader.bytes(b.path,b.sha256);
 for(const logical of OWN){const bytes=reader.bytes(logical);assert(bytes.length<=1048576);lineage.set(logical,{path:logical,sha256:digest(bytes)});}
 assert(lineage.size<=256);assert([...lineage.values()].reduce((n,b)=>n+reader.bytes(b.path,b.sha256).length,0)<=16777216);
 const python=path.join(ROOT,"ml/ai-painter/.venv/Scripts/python.exe"),interpreter={path:python,sha256:digest(fs.readFileSync(python))};
 const outputRoot=path.join(ROOT,p.outputRoot);fs.mkdirSync(outputRoot,{recursive:true});
 const claim=path.join(outputRoot,"attempt-v1.json");assert(!fs.existsSync(claim),"CPU attempt consumed; no automatic retry");
 const runId="terrain-detail-cpu-"+crypto.randomUUID(),logical=p.outputRoot+"/"+runId,absolute=path.join(ROOT,logical);
 fs.mkdirSync(absolute);assert.equal(fs.realpathSync(absolute),path.join(fs.realpathSync(path.join(ROOT,".runtime")),"ai-painter","terrain-detail-weight-precision-cpu-checks",runId));
 const accounting=createOwnedAccounting(ROOT,absolute,p);
 const put=(name,value,failure=false)=>{
   const bytes=Buffer.from(JSON.stringify(value,null,2)+"\n"),current=accounting.measure().totalBytes;
   assert(current+bytes.length<=p.resources.maxOutputBytes-(failure?0:65536));
   fs.writeFileSync(path.join(absolute,name),bytes,{flag:"wx"});return {path:logical+"/"+name,sha256:digest(bytes),bytes:bytes.length};
 };
 const request=put("request.json",{schemaVersion:"terrain-detail-precision-cpu-request-v1",runId,policy:POLICY,
   interpreter,programBindings:[...lineage.values()],deadlineUnixMs:deadline-8000});
 fs.writeFileSync(claim,JSON.stringify({runId,policy:POLICY,recordedAtUtc:new Date().toISOString(),automaticRetries:0})+"\n",{flag:"wx"});
 let result,terminal,error=null;
 try{
   result=await runParameter60OwnedWorker(python,["-B",path.join(ROOT,p.workerPath),"--request",request.path,"--request-sha256",request.sha256],{
    cwd:ROOT,env:{...process.env,CUDA_VISIBLE_DEVICES:"",PYTHONDONTWRITEBYTECODE:"1",PYTHONNOUSERSITE:"1",PYTHONPATH:[path.join(ROOT,"ml/ai-painter/src"),path.join(ROOT,"ml/ai-painter/scripts")].join(path.delimiter),OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2"},
    timeout:deadline-Date.now()-8000,maxBuffer:8388608,onSpawn:accounting.observe,abortReason:()=>{accounting.requireBudget();return Date.now()>=deadline-8000?"CPU deadline":null;}});
   const value=JSON.parse(result.stdout);assert.equal(value.runId,runId);validateResult(value,p);proofPassed(result.ownedReceipt);reader.verifyStable();
   const current=await readCurrentExecutionRegistry(ROOT,{deadlineUnixMs:deadline});assert(current.ok&&current.registrySha256===registry.registrySha256);
   terminal=put("terminal.json",{schemaVersion:"terrain-detail-precision-cpu-terminal-v1",runId,
     executionState:"completed",status:value.status,request,worker:value,ownedReceipt:result.ownedReceipt,
     recordedAtUtc:new Date().toISOString(),elapsedMs:Date.now()-began,outputAccounting:accounting.requireBudget(),
     qualification:p.qualification,registryBeforeSha256:registry.registrySha256});
 }catch(first){
   error=first;accounting.beginFailureClosure();
   try{terminal=put("failure.json",{schemaVersion:"terrain-detail-precision-cpu-terminal-v1",runId,executionState:"failed_closed",
     status:"cpu_candidate_failed_closed",request,error:String(first.stack??first),
     stdout:String(first.stdout??result?.stdout??"").slice(0,16384),stderr:String(first.stderr??result?.stderr??"").slice(0,16384),
     ownedReceipt:first.ownedReceipt??result?.ownedReceipt??null,qualification:p.qualification},true);}
   catch(secondary){error=keepPrimaryError(error,secondary,"secondaryEvidenceError");}
   error.evidence=terminal??null;
 }
 try{
 assert(terminal,"CPU terminal missing");
 const current=await readCurrentExecutionRegistry(ROOT,{deadlineUnixMs:deadline});assert(current.ok&&current.registrySha256===registry.registrySha256);
 const capsule=put("task-capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:runId,runId,integrity:{status:"verified"},evidence:[{...terminal,sha256Verified:true}]},error!==null);
 const options={projectRoot:ROOT,capabilityVersion:p.candidate,packageId:runId+"-package",taskId:runId,
  taskKind:"candidate_cpu_verification",taskGoal:"Verify the single target precision candidate without weight updates or GPU.",
  runId,lifecycleStage:"candidate_cpu_support",priority:1,executionState:error?"failed_closed":"completed",
  queueStatus:error?"failed_closed":"completed",activity:"candidate_cpu_terminal_not_training",activeExecution:null,
  taskCapsulePath:capsule.path,terminalEvidencePath:terminal.path,expectedPreviousRegistrySha256:registry.registrySha256,
  nextMachineAction:null,deadlineUnixMs:deadline};
 const prepared=await prepareCurrentExecutionRegistryAdvance(options);accounting.observeRegistryTransaction(prepared.transactionRoot);
 await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:ROOT,transactionId:prepared.transactionId,deadlineUnixMs:deadline,beforeAtomicWrite:accounting.beforeAtomicWrite});
 accounting.requireBudget();assert(Date.now()<deadline);
 const after=await readCurrentExecutionRegistry(ROOT,{deadlineUnixMs:deadline});assert(after.ok&&after.registry.activeExecution===null);
 assert.deepEqual(after.registry.latestTrainingTerminal,registry.registry.latestTrainingTerminal);
 }catch(secondary){error=keepPrimaryError(error,secondary,"secondaryFinalizationError");error.evidence??=terminal??null;}
 if(error)throw error;return terminal;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
 assert.equal(process.argv.length,2,"no mode or scope override");
 runCpu().then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(JSON.stringify({status:"failed_closed",error:e.message,evidence:e.evidence??null}));process.exitCode=1;});
}
