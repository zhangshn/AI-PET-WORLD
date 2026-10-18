// One authenticated zero-update diagnostic; no training, repair or retry.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createReader} from "./lib/ai-painter-stage4-dataset-audit.mjs";
import {runParameter60OwnedWorker,validateParameter60NativeProof} from "./lib/ai-painter-parameter60-owned-worker-v1.mjs";
import {readCurrentExecutionRegistry, prepareCurrentExecutionRegistryAdvance, finalizePreparedCurrentExecutionRegistryAdvance} from "../src/server/ai-painter-current-execution-registry.mjs";

const SELF=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(SELF),"..");
export const POLICY={path:"data/ai-painter/system-governance/ai-painter-parameter60-causal-gpu-policy-v3.json",
  sha256:"454cf9bdb76274ba53ed4adc4851ecb7bc3e466fbfac7e5f14c824dbd6a4b56b"};
export const PREDECESSOR={
  "policy": {
    "path": "data/ai-painter/system-governance/ai-painter-parameter60-causal-gpu-policy-v2.json",
    "sha256": "c28a6f8e3021849f1feea7b8cc8f2f01a476f39fab163307d2d97f7a1e421bc7"
  },
  "attempt": {
    "path": ".runtime/ai-painter/parameter60-causal-gpu-diagnostics/attempt-v2.json",
    "sha256": "c33e34db55a685d3b2985a2173b4fb3bd06a0933eed55600307a184144f85188"
  },
  "terminal": {
    "path": ".runtime/ai-painter/parameter60-causal-gpu-diagnostics/parameter60-gpu-4f7de93f-b3aa-4a65-89f3-969b03a75b67/failure.json",
    "sha256": "b6aa7d79e522b307c6f0e9e6b2bb02c8a222eaae4b59514768b794647872c578"
  },
  "formalSnapshot": {
    "path": ".runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/documentation-1.64-before-cp60-v3.txt",
    "sha256": "b30c61eb111dde7f5f2132402773e8107a642417e01e19da275e74791f34934e"
  }
};
const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
const CAPABILITY="parameter60_causal_zero_update_v3";
const OWN=[
  "scripts/diagnose-ai-painter-parameter60-causal-gpu.mjs",
  "scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs",
  "scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs",
  "scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
  "src/server/ai-painter-current-execution-registry.mjs",
  "ml/ai-painter/scripts/diagnose_parameter60_causal_gpu_v1.py",
  "ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_restore_v1.py",
  "ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_observation_v1.py",
  "ml/ai-painter/tests/test_diagnose_parameter60_causal_gpu_v1.py",
  "ml/ai-painter/tests/test_parameter60_causal_observation_v1.py",
  "ml/ai-painter/tests/test_parameter60_causal_restore_v1.py",
  "scripts/tests/ai-painter-parameter60-owned-worker.test.mjs",
  "scripts/tests/ai-painter-parameter60-causal-gpu.test.mjs",
];
const RESERVE=65536;
export function validateGpuPolicy(p){
  assert.equal(p.schemaVersion,"ai-painter-parameter60-causal-gpu-policy-v3");
  assert.equal(p.status,"registered_zero_update_diagnostic_requires_own_cpu_acceptance");
  assert.equal(p.formalSpecification.version,"AI-PAINTER-SPEC-1.65");
  assert.equal(p.formalSpecification.sha256,"84e7332ab2527b6d6c9c9e7b81fb77b1cfe0d7ad2339f6be17508628b424057b");
  assert.deepEqual(p.predecessorRegistration,PREDECESSOR);
  assert.equal(p.scope.failureSampleId,"ai-cold-start-v7-v7-capacity-slot-157-grassland-forest-transition-v2");
  assert.equal(p.scope.sampleSplit,"train"); assert.equal(p.scope.sampleCount,1);
  assert.deepEqual(p.scope.resolution,[256,192]);
  assert.equal(p.scope.originalGeneratorParameterCount,108); assert.equal(p.scope.originalDiscriminatorParameterCount,14);
  assert.equal(p.scope.sourceStateTiming,"after_exception");
  assert.equal(p.sourceStateUse.trainingInitializationAllowed,false);
  assert.equal(p.sourceStateUse.historicalReplayAllowed,false);
  assert.equal(p.target.parameterIndex,60);
  assert.equal(p.target.parameterName,"core.core.terrain.full_resolution_detail.layers.3.weight");
  assert.deepEqual(p.target.weightShape,[48,48,3,3]);
  assert.equal(p.comparison.atol,1e-6); assert.equal(p.comparison.rtol,1e-5);
  assert.equal(p.comparison.originalGateKept,true);
  assert.deepEqual(p.counts,{fullGeneratorForward:1,fullGeneratorAutograd:4,discriminatorAutograd:0,
    optimizerConstruction:0,optimizerUpdates:0,localFp64WeightVjp:4,extraNativeBackwardReplay:0,extraModelAutograd:0});
  assert.deepEqual(p.resources,{maxWallSeconds:180,threads:2,maxGpuMemoryFraction:0.7,maximumTemperatureC:85,
    minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,maxOutputBytes:134217728,maxTargetCaptureBytes:67108864,
    attempts:1,automaticRetries:0,maxStreamBytes:8388608,cleanupReserveMs:1000,
    failureEvidenceReserveBytes:65536,temperaturePollMs:1000,cpuPreflightMaxWallSeconds:120,
    cpuPreflightMaxOutputBytes:8388608,finalizationReserveMs:8000});
  assert.equal(p.cleanup.transport,"bounded-stream-capture-v2");
  assert.equal(p.cleanup.historicalObservationIsAuthority,false);
  assert.equal(p.registry.diagnosisIsTraining,false);
  for(const v of Object.values(p.qualification))assert.equal(v,false);
  assert.equal(p.outputRoot,".runtime/ai-painter/parameter60-causal-gpu-diagnostics");
  assert.equal(p.attemptClaimPath,p.outputRoot+"/attempt-v3.json");
  return true;
}
export function requireDeadline(deadline,now=Date.now()){assert(now<deadline,"diagnostic total wall budget exhausted");}
export function byteBinding(binding){
  assert(binding&&typeof binding.path==="string"&&/^[a-f0-9]{64}$/.test(binding.sha256),"byte binding required");
  return {path:binding.path,sha256:binding.sha256};
}
export function directoryBytes(absolute){
  let bytes=0;
  for(const row of fs.readdirSync(absolute,{withFileTypes:true})){
    const file=path.join(absolute,row.name),st=fs.lstatSync(file);
    assert(!st.isSymbolicLink(),"private diagnostic output link refused");
    if(st.isDirectory())bytes+=directoryBytes(file);
    else{assert(st.isFile(),"unknown diagnostic output kind");bytes+=st.size;}
  }
  return bytes;
}
export function createOwnedAccounting(root,absolute,policy){
  let scope=null;
  const registryTransactions=new Set();
  const registryRoot=path.resolve(root,".runtime/ai-painter/current-execution-registry");
  const registryShared=["registry.sqlite","registry.sqlite-journal","registry.sqlite-wal","events.jsonl","writer.claim.json"];
  const fileBytes=file=>{if(!fs.existsSync(file))return 0;const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());return st.size;};
  const registryBaseline=new Map(registryShared.map(name=>[name,fileBytes(path.join(registryRoot,name))]));
  const guardRoot=path.resolve(root,".runtime/ai-painter/owned-worker-guards");
  const observe=value=>{
    const id=value.guardRecord?.identity;
    assert(/^[a-f0-9-]{36}$/.test(id),"actual invocation guard identity required");
    assert.equal(path.resolve(value.nativeBuildDirectory),path.join(guardRoot,id+"-native"));
    for(const [key,suffix] of [["startedEvidence","-started.json"],["terminalEvidence","-terminal.json"],["terminalPath","-guard-terminal.json"]])
      assert.equal(path.resolve(value.guard[key]),path.join(guardRoot,id+suffix));
    scope=value;
  };
  const measure=(streamBytes=null)=>{
    let nativeBytes=0;
    if(scope){
      nativeBytes+=directoryBytes(scope.nativeBuildDirectory);
      for(const file of [scope.guard.startedEvidence,scope.guard.terminalEvidence,scope.guard.terminalPath]){
        if(fs.existsSync(file)){const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());nativeBytes+=st.size;}
      }
    }
    if(streamBytes===null){const live=scope?.getStreamBytes?.()??{stdout:0,stderr:0};streamBytes=live.stdout+live.stderr;}
    assert(Number.isSafeInteger(streamBytes)&&streamBytes>=0&&streamBytes<=policy.resources.maxStreamBytes);
    const diagnosticBytes=directoryBytes(absolute);
    let registryBytes=0;for(const logical of registryTransactions)registryBytes+=directoryBytes(path.join(root,logical));
    for(const name of registryShared)registryBytes+=Math.max(0,fileBytes(path.join(registryRoot,name))-registryBaseline.get(name));
    return {diagnosticBytes,nativeBytes,registryBytes,streamBytes,totalBytes:diagnosticBytes+nativeBytes+registryBytes+streamBytes};
  };
  let closingFailure=false,atomicCopyBytes=0;
  const requireBudget=(streamBytes=null)=>{
    const value=measure(streamBytes);
    value.atomicCopyBytes=atomicCopyBytes;value.totalBytes+=atomicCopyBytes;
    assert(value.totalBytes<=policy.resources.maxOutputBytes-(closingFailure?0:RESERVE),"diagnostic complete output quota exceeded");
    return value;
  };
  const observeRegistryTransaction=logical=>{
    assert(/^\.runtime\/ai-painter\/current-execution-registry\/transactions\/current-execution-registry-advance-[a-zA-Z0-9-]+$/.test(logical),"actual prepared registry transaction required");
    registryTransactions.add(logical);
  };
  return {observe,measure:()=>{const value=measure();return {...value,atomicCopyBytes,totalBytes:value.totalBytes+atomicCopyBytes};},
    requireBudget,observeRegistryTransaction,maximum:policy.resources.maxOutputBytes,
    beginFailureClosure(){closingFailure=true;},
    beforeAtomicWrite(_logical,bytes){assert(Number.isSafeInteger(bytes)&&bytes>=0);const current=requireBudget();
      assert(current.totalBytes+bytes<=policy.resources.maxOutputBytes-(closingFailure?0:RESERVE),"registry atomic copy exceeds total quota");atomicCopyBytes+=bytes;}};
}
async function publishRegistry(options,accounting){
  requireDeadline(options.deadlineUnixMs);
  const prepared=await prepareCurrentExecutionRegistryAdvance(options);
  accounting.observeRegistryTransaction(prepared.transactionRoot);accounting.requireBudget();
  requireDeadline(options.deadlineUnixMs);
  const result=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:options.projectRoot,
    transactionId:prepared.transactionId,deadlineUnixMs:options.deadlineUnixMs,beforeAtomicWrite:accounting.beforeAtomicWrite});
  requireDeadline(options.deadlineUnixMs);return result;
}
function environment(root,cpu){
  return {...process.env,CUDA_VISIBLE_DEVICES:cpu?"":"0",PYTHONDONTWRITEBYTECODE:"1",PYTHONNOUSERSITE:"1",
    PYTHONPATH:[path.join(root,"ml/ai-painter/src"),path.join(root,"ml/ai-painter/scripts")].join(path.delimiter),
    OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2"};
}
export function verifyClosedPredecessor(reader,policy){
  const previous=reader.bound(PREDECESSOR.policy),claim=reader.bound(PREDECESSOR.attempt);
  const terminal=reader.bound(PREDECESSOR.terminal);
  reader.bytes(PREDECESSOR.formalSnapshot.path,PREDECESSOR.formalSnapshot.sha256);
  assert.deepEqual(claim.policy,PREDECESSOR.policy);
  assert.equal(claim.runId,"parameter60-gpu-4f7de93f-b3aa-4a65-89f3-969b03a75b67");
  assert.equal(claim.automaticRetries,0);
  assert.equal(terminal.runId,claim.runId);assert.equal(terminal.status,"diagnostic_failed_closed");
  assert.equal(terminal.executionState,"failed_closed");
  const observed=JSON.parse(terminal.workerOutput.text);
  assert.equal(observed.runId,claim.runId);assert.deepEqual(observed.policy,PREDECESSOR.policy);
  assert.equal(observed.error.message,"can't convert cuda:0 device type tensor to numpy. Use Tensor.cpu() to copy the tensor to host memory first.");
  assert.equal(observed.counts.cudaCalls,2);
  for(const [key,value] of Object.entries(observed.counts))if(key!=="cudaCalls")assert.equal(value,0);
  for(const binding of Object.values(previous.predecessorRegistration))reader.bytes(binding.path,binding.sha256);
  assert.equal(policy.resources.attempts,1);assert.equal(policy.resources.automaticRetries,0);
  for(const [key,value] of Object.entries(previous))
    if(!["schemaVersion","formalSpecification","attemptClaimPath","predecessorRegistration","continuationReason"].includes(key))assert.deepEqual(policy[key],value,"successor expanded "+key);
  return true;
}
function resolvePolicy(root){
  const reader=createReader(root),policy=reader.bound(POLICY);validateGpuPolicy(policy);
  verifyClosedPredecessor(reader,policy);
  reader.bytes(policy.formalSpecification.path,policy.formalSpecification.sha256);
  reader.bytes(policy.designBinding.path,policy.designBinding.sha256);
  const evidence=policy.sourceEvidence.map(b=>reader.bound(b)),manifest=evidence[1];
  assert.equal(manifest.context.sampleId,policy.scope.failureSampleId);
  assert.equal(manifest.context.split,"train");
  const lineage=new Map();
  for(const b of Object.values(manifest.context.programBindings)){
    if(b.path.startsWith("ml/ai-painter/")&&b.path.endsWith(".py")){reader.bytes(b.path,b.sha256);lineage.set(b.path,b);}
  }
  for(const item of policy.sourceAlgorithmBindings){reader.bytes(item.binding.path,item.binding.sha256);lineage.set(item.binding.path,item.binding);}
  for(const logical of OWN){const bytes=reader.bytes(logical);assert(bytes.length<=1048576,"program individual byte limit");lineage.set(logical,{path:logical,sha256:digest(bytes)});}
  assert(lineage.size<=256,"program count limit");
  assert([...lineage.values()].reduce((n,b)=>n+reader.bytes(b.path,b.sha256).length,0)<=16777216,"program total byte limit");
  reader.bytes(policy.sourceTensorArchive.path,policy.sourceTensorArchive.sha256);
  for(const b of Object.values(policy.sourceSampleBindings))reader.bytes(b.path,b.sha256);
  const python=path.join(root,"ml/ai-painter/.venv/Scripts/python.exe");
  const interpreter={path:python,sha256:digest(fs.readFileSync(python))};
  reader.verifyStable();
  return {reader,policy,lineage:[...lineage.values()],python,interpreter};
}
export function makeOutput(root,prefix,policy){
  const runId=prefix+"-"+crypto.randomUUID(),logical=policy.outputRoot+"/"+runId,absolute=path.join(root,logical);
  fs.mkdirSync(absolute,{recursive:true});
  assert.equal(fs.realpathSync(absolute),path.join(fs.realpathSync(path.join(root,".runtime")),"ai-painter","parameter60-causal-gpu-diagnostics",runId));
  let completeAccounting=null;
  const put=(name,value,{failure=false,replace=false}={})=>{
    assert(/^[a-z-]+\.json$/.test(name),"private evidence name");
    const bytes=Buffer.from(JSON.stringify(value,null,2)+"\n");
    const previousBytes=completeAccounting?completeAccounting.measure().totalBytes:directoryBytes(absolute);
    const maximum=completeAccounting?.maximum??policy.resources.maxOutputBytes;
    assert(previousBytes+bytes.length<=maximum-(failure?0:RESERVE),"diagnostic complete evidence limit");
    const file=path.join(absolute,name);
    if(replace){const tmp=file+"."+crypto.randomUUID()+".tmp";fs.writeFileSync(tmp,bytes,{flag:"wx"});fs.renameSync(tmp,file);}
    else fs.writeFileSync(file,bytes,{flag:"wx"});
    return {path:logical+"/"+name,sha256:digest(bytes),bytes:bytes.length};
  };
  return {runId,logical,absolute,put,setAccounting(value){completeAccounting=value;}};
}
export function proofPassed(receipt){
  assert.equal(receipt?.cleanupConfirmed,true,"live managed cleanup required");
  assert.equal(receipt.guardReleaseConfirmed,true,"guard release must follow confirmed cleanup");
  assert.equal(receipt.ownerClosed,true,"owner closure required");
  assert.equal(receipt.emptyJob,true,"empty Job must derive from live process count");
  const observation={ownerClosed:receipt.ownerClosed,ownerExitCode:receipt.ownerExitCode,ownerSignal:receipt.ownerSignal,
    stdoutClosed:receipt.ownerPipeEOF?.stdout,stderrClosed:receipt.ownerPipeEOF?.stderr,protocolError:receipt.protocolError,ownerError:receipt.ownerError,
    forced:receipt.termination!==null,ownerPid:receipt.ownerIdentity.pid,bindingBase64:receipt.proof?.bindingBase64,
    stdoutBytes:receipt.streamBytes.stdout,stderrBytes:receipt.streamBytes.stderr,maxBuffer:8388608};
  assert.equal(validateParameter60NativeProof(receipt.proof,observation).valid,true,"complete native identity and closure proof required");
}
export function validateWorkerTerminal(value,cpu){
  assert(value&&typeof value==="object","worker result required");
  assert.equal(value.trainingAllowed,false);assert.equal(value.stage4Qualified,false);
  assert.equal(value.historicalReplayAllowed,false);
  assert.equal(value.counts.optimizerConstruction,0);
  assert.equal(value.counts.optimizerUpdates,0);
  assert.equal(value.counts.discriminatorAutograd,0);
  for(const key of ["generatorForwards","generatorAutogradAttempts","generatorAutogradCompleted"])
    assert(Number.isSafeInteger(value.counts[key])&&value.counts[key]>=0,"invalid observed count: "+key);
  assert(value.counts.generatorAutogradCompleted<=value.counts.generatorAutogradAttempts);
  if(cpu){assert.equal(value.status,"cpu_preflight_passed_not_gpu_or_root_cause");
    assert.equal(value.counts.generatorForwards,0);assert.equal(value.counts.generatorAutogradAttempts,0);assert.equal(value.counts.cudaCalls,0);}
  else {
    assert(["diagnostic_target_evidence_complete","diagnostic_not_reproduced","diagnostic_failed_closed"].includes(value.status));
    assert(value.counts.generatorForwards<=1&&value.counts.generatorAutogradAttempts<=4&&value.counts.generatorAutogradCompleted<=4);
    assert((value.counts.localFp64WeightVjp??0)<=4);
    assert(Number.isSafeInteger(value.counts.localFp64WeightVjp??0)&&(value.counts.localFp64WeightVjp??0)>=0);
    if(value.status==="diagnostic_not_reproduced")assert.equal(value.counts.localFp64WeightVjp??0,0);
    if(value.status!=="diagnostic_failed_closed"){
      assert.equal(value.counts.generatorForwards,1);assert.equal(value.counts.generatorAutogradCompleted,4);
      assert.equal(value.counts.generatorAutogradAttempts,4);
    }
  }
}
function failureRecord(error,context,result){
  const {put,runId}=context;
  try{return put("failure.json",{schemaVersion:"parameter60-causal-diagnostic-terminal-v1",runId,
    executionState:"failed_closed",status:"diagnostic_failed_closed",recordedAtUtc:new Date().toISOString(),
    error:String(error.stack??error).slice(0,16384),
    workerOutput:boundedFailureStream(error.stdout??result?.stdout),stderr:boundedFailureStream(error.stderr??result?.stderr),
    ownedReceipt:error.ownedReceipt??result?.ownedReceipt??null,
    trainingAllowed:false,stage4Qualified:false},{failure:true});}
  catch(secondary){error.secondaryEvidenceError=String(secondary.message);return null;}
}
function boundedFailureStream(raw){
  if(raw==null)return null;const bytes=Buffer.from(String(raw));
  return {text:bytes.subarray(0,16384).toString("utf8"),originalBytes:bytes.length,truncated:bytes.length>16384};
}
async function emptyRegistry(root,deadlineUnixMs){
  const value=await readCurrentExecutionRegistry(root,{deadlineUnixMs});
  assert(value.ok,"verified registry required: "+value.errorCode);assert.equal(value.registry.activeExecution,null,"active execution refused");
  assert(!fs.existsSync(path.join(root,".runtime/ai-painter/owned-worker-guards/active.json")),"existing guard refused; no cleanup inferred");
  return value;
}
export async function runCpuPreflight(root=ROOT){
  const start=Date.now(),bound=resolvePolicy(root),{policy,reader,lineage,python,interpreter}=bound;
  const deadline=start+policy.resources.cpuPreflightMaxWallSeconds*1000;
  const registry=await emptyRegistry(root,deadline),context=makeOutput(root,"parameter60-cpu-current",policy);
  const {put,runId,logical}=context;
  const cpuAccountingPolicy={...policy,resources:{...policy.resources,maxOutputBytes:policy.resources.cpuPreflightMaxOutputBytes}};
  const accounting=createOwnedAccounting(root,context.absolute,cpuAccountingPolicy);
  context.setAccounting(accounting);
  const request={schemaVersion:"parameter60-causal-gpu-request-v1",runId,outputRoot:logical,policy:POLICY,
    programBindings:lineage,interpreter,deadlineUnixMs:deadline,mode:"cpu_preflight"};
  const requestBinding=put("request.json",request);
  let result;
  try{
    result=await runParameter60OwnedWorker(python,["-B",path.join(root,policy.workerPath),"--cpu-preflight","--request",requestBinding.path,"--request-sha256",requestBinding.sha256],
      {cwd:root,env:environment(root,true),timeout:deadline-Date.now(),maxBuffer:policy.resources.maxStreamBytes,
        onSpawn:accounting.observe,abortReason:()=>{accounting.requireBudget();return Date.now()>=deadline?"CPU total deadline":null;}});
    const value=JSON.parse(result.stdout);assert.equal(value.runId,runId);validateWorkerTerminal(value,true);proofPassed(result.ownedReceipt);
    reader.verifyStable();requireDeadline(deadline);
    const current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(current.ok&&current.registrySha256===registry.registrySha256,"CPU registry changed");
    const report=put("cpu-acceptance.json",{schemaVersion:"parameter60-current-cpu-acceptance-v1",status:"current_cpu_accepted_not_gpu_result",
      runId,request:requestBinding,policy:POLICY,programBindings:lineage,interpreter,worker:value,
      ownedReceipt:result.ownedReceipt,outputAccounting:accounting.requireBudget(result.ownedReceipt.streamBytes.stdout+result.ownedReceipt.streamBytes.stderr),
      registrySha256:registry.registrySha256,elapsedMs:Date.now()-start});
    accounting.requireBudget();
    requireDeadline(deadline);
    const pointer=path.join(root,policy.outputRoot,"current-cpu-acceptance.json"),tmp=pointer+"."+crypto.randomUUID()+".tmp";
    fs.writeFileSync(tmp,JSON.stringify(report)+"\n",{flag:"wx"});fs.renameSync(tmp,pointer);
    return report;
  }catch(error){error.evidence=failureRecord(error,context,result);throw error;}
}
export function currentCpuAcceptance(root,bound){
  const {policy,reader,lineage,interpreter}=bound;
  const pointer=JSON.parse(fs.readFileSync(path.join(root,policy.outputRoot,"current-cpu-acceptance.json"),"utf8"));
  assert(pointer.path.startsWith(policy.outputRoot+"/parameter60-cpu-current-")&&pointer.path.endsWith("/cpu-acceptance.json"));
  const value=reader.bound(pointer);assert.equal(value.status,"current_cpu_accepted_not_gpu_result");
  assert.deepEqual(value.policy,POLICY);assert.deepEqual(value.programBindings,lineage);assert.deepEqual(value.interpreter,interpreter);
  assert.equal(value.worker.runId,value.runId);assert(pointer.path.includes("/"+value.runId+"/"));
  const request=reader.bound(value.request);
  assert.equal(request.schemaVersion,"parameter60-causal-gpu-request-v1");assert.equal(request.mode,"cpu_preflight");
  assert.equal(request.runId,value.runId);assert.equal(request.outputRoot,policy.outputRoot+"/"+value.runId);
  assert.deepEqual(request.policy,POLICY);assert.deepEqual(request.programBindings,lineage);assert.deepEqual(request.interpreter,interpreter);
  const receipt=value.ownedReceipt,proof=receipt.proof;
  assert.equal(proof.exitCode,0,"CPU execution must actually succeed");assert.equal(proof.stopReason,null);
  assert.equal(receipt.firstStop,null);assert.equal(receipt.primaryError,null);
  const workerBinding=value.worker.workerResult;
  assert.equal(workerBinding.path,request.outputRoot+"/cpu-worker-result.json");
  const workerBytesValue=reader.bound(workerBinding),printedWorker={...value.worker};delete printedWorker.workerResult;
  assert.deepEqual(workerBytesValue,printedWorker,"CPU worker output bytes differ from admission");
  const binding=JSON.parse(Buffer.from(proof.bindingBase64,"base64").toString("utf8"));
  assert.equal(binding.guard.identity,receipt.guard.identity);
  const startedRecord=JSON.parse(fs.readFileSync(receipt.guard.startedEvidence,"utf8"));
  assert.equal(startedRecord.runnerPid,binding.guard.runnerPid);assert.equal(startedRecord.ownerIdentity.pid,proof.ownerPid);
  assert.equal(startedRecord.bindingBase64,proof.bindingBase64);assert.deepEqual(startedRecord.ownerIdentity,receipt.ownerIdentity);
  assert.equal(receipt.ownerIdentity.executable,binding.nativeBuild.binary);
  assert.equal(binding.guard.executableSha256,interpreter.sha256);assert.equal(path.resolve(binding.guard.executable),path.resolve(interpreter.path));
  assert.equal(binding.scope,path.resolve(root));
  const expectedArgs=["-B",path.join(root,policy.workerPath),"--cpu-preflight","--request",value.request.path,"--request-sha256",value.request.sha256];
  assert.equal(binding.guard.commandSha256,digest(JSON.stringify(expectedArgs)),"CPU invocation request differs");
  for(const [file,expected] of [[receipt.guard.terminalPath,binding.guardSha256],[binding.nativeBuild.binary,binding.nativeBuild.binarySha256],
    [binding.nativeBuild.source.path,binding.nativeBuild.source.sha256],[binding.nativeBuild.compiler,binding.nativeBuild.compilerSha256]])
    assert.equal(digest(fs.readFileSync(file)),expected,"CPU native immutable evidence differs");
  const liveRecord=JSON.parse(fs.readFileSync(receipt.guard.terminalEvidence,"utf8"));
  assert.deepEqual(liveRecord.proof,proof);assert.equal(liveRecord.liveOwnerCleanupConfirmed,true);
  validateWorkerTerminal(value.worker,true);proofPassed(value.ownedReceipt);return pointer;
}
function gpuObservation(){
  const value=execFileSync("nvidia-smi",["--query-gpu=index,uuid,memory.total,memory.free,temperature.gpu","--format=csv,noheader,nounits"],
    {encoding:"utf8",windowsHide:true,timeout:2500,maxBuffer:16384}).trim().split(/\r?\n/).find(v=>v.trim().startsWith("0,"));
  assert(value,"GPU0 observation unavailable");
  const [index,uuid,total,free,temp]=value.split(",").map(v=>v.trim());
  assert([+index,+total,+free,+temp].every(Number.isFinite),"invalid GPU observation");
  return {index:+index,uuid,totalMiB:+total,freeMiB:+free,temperatureC:+temp,observedAtUtc:new Date().toISOString()};
}
function processIdentity(){
  const command="$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+process.pid+"'; $p.CreationDate.ToUniversalTime().ToString('o')";
  const creation=execFileSync("powershell.exe",["-NoProfile","-Command",command],{encoding:"utf8",windowsHide:true,timeout:3000,maxBuffer:4096}).trim();
  assert(creation,"supervisor process creation identity missing");return process.pid+":"+creation;
}
export async function runGpuDiagnostic(root=ROOT){
  const start=Date.now(),bound=resolvePolicy(root),{policy,reader,lineage,python,interpreter}=bound;
  const deadline=start+policy.resources.maxWallSeconds*1000,registryBefore=await emptyRegistry(root,deadline);
  assert(!fs.existsSync(path.join(root,policy.attemptClaimPath)),"diagnostic attempt already consumed; no retry");
  const cpuAcceptance=byteBinding(currentCpuAcceptance(root,bound)),gpu=gpuObservation();
  assert(gpu.freeMiB>=policy.resources.minimumFreeVramMiB&&gpu.temperatureC<policy.resources.maximumTemperatureC,"GPU startup resource guard");
  const storage=fs.statfsSync(path.join(root,policy.outputRoot));
  assert(storage.bavail*storage.bsize>=policy.resources.minimumFreeDiskMiB*1048576,"free disk guard");
  const context=makeOutput(root,"parameter60-gpu",policy),{put,runId,logical,absolute}=context;
  const accounting=createOwnedAccounting(root,absolute,policy);
  context.setAccounting(accounting);
  const packageId=runId+"-package";
  fs.writeFileSync(path.join(root,policy.attemptClaimPath),JSON.stringify({schemaVersion:"parameter60-single-attempt-claim-v1",runId,policy:POLICY,
    recordedAtUtc:new Date().toISOString(),automaticRetries:0})+"\n",{flag:"wx"});
  let result,activeRegistered=false,heartbeatTimer=null,heartbeatError=null,terminal=null,firstError=null,liveReceipt=null;
  const requestBinding=put("request.json",{schemaVersion:"parameter60-causal-gpu-request-v1",runId,outputRoot:logical,
    policy:POLICY,programBindings:lineage,interpreter,cpuAcceptance,gpuIdentity:gpu,
    deadlineUnixMs:deadline-policy.resources.finalizationReserveMs,mode:"gpu_diagnostic"});
  const admission=put("admission.json",{executionState:"completed",status:"current_cpu_and_input_binding_verified_not_training",
    runId,request:requestBinding,trainingAllowed:false});
  const capsule=put("task-capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:runId,runId,
    integrity:{status:"verified"},evidence:[{...requestBinding,sha256Verified:true},{...admission,sha256Verified:true}]});
  const common={projectRoot:root,capabilityVersion:CAPABILITY,packageId,taskId:runId,taskKind:"zero_update_causal_diagnostic",
    taskGoal:"Observe the exact failed G phase without updates; stop with two independent diagnostic conclusions.",
    priority:1,runId,lifecycleStage:"numerical_diagnosis",taskCapsulePath:capsule.path,nextMachineAction:null,deadlineUnixMs:deadline};
  let lastGpuCheck=0;
  try{
    const identity=processIdentity(),activeBase={schemaVersion:"ai-painter-current-active-execution-lock-v1",
      capabilityVersion:CAPABILITY,packageId,runId,processId:process.pid,processStartIdentity:identity};
    const lock=put("active-lock.json",activeBase);
    const beat=()=>put("heartbeat.json",{...activeBase,schemaVersion:"ai-painter-current-active-execution-heartbeat-v1",
      executionState:"executing",heartbeatAtUtc:new Date().toISOString(),ttlSeconds:30},{replace:fs.existsSync(path.join(absolute,"heartbeat.json"))});
    beat();heartbeatTimer=setInterval(()=>{try{if(Date.now()>=deadline){clearInterval(heartbeatTimer);throw new Error("diagnostic total deadline exhausted");}beat();}catch(e){heartbeatError=e;}},5000);
    const active={...activeBase,schemaVersion:"ai-painter-current-active-execution-v1",executionState:"executing",
      programLineage:Object.fromEntries(OWN.slice(0,9).map((p,i)=>["diagnosticProgram"+i,lineage.find(b=>b.path===p)])),
      lock:{path:lock.path,sha256:lock.sha256},heartbeat:{path:logical+"/heartbeat.json",ttlSeconds:30}};
    await publishRegistry({...common,executionState:"executing",activity:"zero_update_diagnostic_not_training",
      queueStatus:"running",activeExecution:active,terminalEvidencePath:admission.path,
      expectedPreviousRegistryRevision:registryBefore.registry.registryRevision,expectedPreviousRegistrySha256:registryBefore.registrySha256},accounting);
    activeRegistered=true;requireDeadline(deadline-policy.resources.finalizationReserveMs);
    result=await runParameter60OwnedWorker(python,["-B",path.join(root,policy.workerPath),"--request",requestBinding.path,"--request-sha256",requestBinding.sha256],
      {cwd:root,env:environment(root,false),timeout:deadline-Date.now()-policy.resources.finalizationReserveMs,maxBuffer:policy.resources.maxStreamBytes,
        onSpawn:accounting.observe,
        abortReason:()=>{
          if(heartbeatError)return "diagnostic heartbeat persistence failure";
          if(Date.now()>=deadline-policy.resources.finalizationReserveMs)return "diagnostic execution and cleanup budget exhausted";
          accounting.requireBudget();
          if(Date.now()-lastGpuCheck>=policy.resources.temperaturePollMs){
            lastGpuCheck=Date.now();const now=gpuObservation();
            if(now.uuid!==gpu.uuid||now.temperatureC>=policy.resources.maximumTemperatureC)return "GPU identity or temperature guard";
          }return null;
        }});
    liveReceipt=result.ownedReceipt;
    const value=JSON.parse(result.stdout);assert.equal(value.runId,runId);validateWorkerTerminal(value,false);proofPassed(liveReceipt);
    if(value.status==="diagnostic_failed_closed")throw Object.assign(new Error(value.error?.message??"diagnostic worker failed closed"),{ownedReceipt:liveReceipt,stdout:result.stdout,stderr:result.stderr});
    reader.verifyStable();requireDeadline(deadline);
    terminal=put("terminal.json",{schemaVersion:"parameter60-causal-diagnostic-terminal-v1",runId,
      executionState:value.status==="diagnostic_failed_closed"?"failed_closed":"completed",status:value.status,
      request:requestBinding,worker:value,ownedReceipt:result.ownedReceipt,elapsedMs:Date.now()-start,
      outputAccounting:accounting.requireBudget(result.ownedReceipt.streamBytes.stdout+result.ownedReceipt.streamBytes.stderr),
      trainingAllowed:false,stage4Qualified:false,rootCauseProven:false});
  }catch(error){firstError=error;liveReceipt=error.ownedReceipt??result?.ownedReceipt??null;
    accounting.beginFailureClosure();terminal=failureRecord(error,context,result);error.evidence=terminal;}
  try{
  assert(terminal,"diagnostic terminal missing");accounting.requireBudget();requireDeadline(deadline);
  // Clearing an active execution requires this invocation's actual live cleanup, never a disk observation.
  const terminalBytes=fs.readFileSync(path.join(root,terminal.path));assert.equal(digest(terminalBytes),terminal.sha256,"terminal evidence changed");
  const terminalValue=JSON.parse(terminalBytes);assert.equal(terminalValue.runId,runId,"terminal Run changed");
  if(activeRegistered&&liveReceipt?.cleanupConfirmed===true&&liveReceipt.guardReleaseConfirmed===true){
    proofPassed(liveReceipt);
    const before=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(before.ok&&before.registry.runId===runId,"own registry identity changed");
    await publishRegistry({...common,executionState:terminalValue.executionState,activity:"diagnostic_terminal_not_training",
      queueStatus:terminalValue.executionState==="completed"?"completed":"failed_closed",activeExecution:null,
      terminalEvidencePath:terminal.path,expectedPreviousRegistrySha256:before.registrySha256},accounting);
    const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(after.ok&&after.registry.activeExecution===null);
    assert.deepEqual(after.registry.latestTrainingTerminal,registryBefore.registry.latestTrainingTerminal,"latest training must stay unchanged");
  }
  accounting.requireBudget();requireDeadline(deadline);
  }catch(secondary){if(firstError)firstError.secondaryFinalizationError=String(secondary.stack??secondary);else{firstError=secondary;firstError.evidence=terminal;}}
  finally{if(heartbeatTimer)clearInterval(heartbeatTimer);}
  if(firstError)throw firstError;
  return terminal;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
  assert.equal(process.argv.length,3,"one fixed mode required");assert(["--cpu","--run"].includes(process.argv[2]));
  (process.argv[2]==="--cpu"?runCpuPreflight():runGpuDiagnostic()).then(v=>console.log(JSON.stringify(v))).catch(e=>{
    console.error(JSON.stringify({status:"failed_closed",error:String(e.message),evidence:e.evidence??null,secondaryEvidenceError:e.secondaryEvidenceError??null}));process.exitCode=1;
  });
}

