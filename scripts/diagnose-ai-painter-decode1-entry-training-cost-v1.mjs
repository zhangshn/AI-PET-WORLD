// New diagnostic admission only. Numerical code and the native owner are reused.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs';
import {collectActualExecutionSources} from './lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs';
import {createOwnedAccounting,proofPassed,directoryBytes} from './diagnose-ai-painter-parameter48-causal-gpu-v2.mjs';
import {runParameter60OwnedWorker} from './lib/ai-painter-parameter60-owned-worker-v1.mjs';
import {readCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance}
  from '../src/server/ai-painter-current-execution-registry.mjs';

const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),'..');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export const CAPABILITY='stage4_mvp256_dry_decode1_entry_training_cost_probe_v1';
export const OUTPUT='.runtime/ai-painter/decode1-entry-training-cost-probes';
export const OWN=Object.freeze(['scripts/diagnose-ai-painter-decode1-entry-training-cost-v1.mjs',
  'scripts/tests/ai-painter-decode1-entry-training-cost-v1.test.mjs',
  'ml/ai-painter/scripts/diagnose_decode1_entry_training_cost_gpu_v1.py',
  'ml/ai-painter/tests/test_decode1_entry_training_cost_gpu_v1.py']);
export let POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-training-cost-probe-policy-v1.json',sha256:null});
export const RESOURCES=Object.freeze({cpuPreparationSeconds:120,gpuDiagnosticSeconds:180,cpuThreads:2,cpuAffinityCores:2,
  maxGpuMemoryFraction:.7,maximumTemperatureC:85,temperatureComparison:'strictly_less_than',minimumFreeVramMiB:2048,
  minimumFreeDiskMiB:2048,maxOutputBytes:134217728,maxStreamBytes:8388608,maxTimingJsonBytes:32768,
  maxTimingAtomicTemporaryBytes:32768,failureTerminalReserveBytes:65536});
const RESERVE=65536,FINALIZATION=8000;
export function binding(value){
  assert(value&&typeof value.path==='string'&&value.path&&!/[\\:\x00-\x1f\x7f]/u.test(value.path)
    &&!value.path.startsWith('/')&&value.path.split('/').every(p=>p&&p!=='.'&&p!=='..')&&hex(value.sha256),'logical byte binding required');
  return {path:value.path,sha256:value.sha256};
}
export function bindPolicy(value){assert.equal(value?.path,POLICY.path);binding(value);
  if(POLICY.sha256!==null)assert.equal(value.sha256,POLICY.sha256,'immutable invocation policy');POLICY=Object.freeze(binding(value));return POLICY;}
export function validatePolicy(p){
  assert.equal(p.schemaVersion,'ai-painter-decode1-entry-training-cost-probe-policy-v1');
  assert.equal(p.status,'registered_one_shot_zero_update_cost_diagnostic_not_training');assert.equal(p.capabilityVersion,CAPABILITY);
  assert.equal(p.entrypointPath,OWN[0]);assert.equal(p.workerPath,OWN[2]);assert.equal(p.outputRoot,OUTPUT);
  assert.deepEqual(p.allowedModes,['cpu_prepare','gpu_probe']);assert.deepEqual(p.resources,RESOURCES);
  assert.equal(p.scope.sampleSplit,'train');assert.equal(p.scope.sampleId,'ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3');
  assert.equal(p.scope.sampleSelector,'first_row_of_exact_parent_train_split');assert.equal(p.scope.sampleCount,1);
  assert.equal(p.scope.initializationSeed,20260929);assert.equal(p.scope.freshInitializationOnly,true);
  for(const key of ['readValidationChallengeRegressionContents','readHistoricalOrFailureWeights'])assert.equal(p.scope[key],false);
  assert.deepEqual(p.scope.resolution,[256,192]);assert.equal(p.scope.originalDataSplits,'48/8/4/4 unchanged');
  assert.equal(p.scope.trainingWallSecondsUnchanged,8400);
  assert.equal(p.modelBoundary.parameterCount,108);assert.equal(p.modelBoundary.parameterElements,2242687);
  for(const key of ['allOriginalLossAndGradientGatesKept','originalFiveVjpBridgeKept','originalJointPriorityArithmeticKept',
    'originalPrecisionRulesForParameters48_52_60_88Kept'])assert.equal(p.modelBoundary[key],true);
  assert.equal(p.modelBoundary.frozenAlgorithmBindings.length,5);for(const b of p.modelBoundary.frozenAlgorithmBindings)binding(b);
  assert.deepEqual(p.sourceBoundary,{maximumFiles:256,maximumSingleSourceBytes:1048576,maximumTotalSourceBytes:16777216,
    uniquePathShaRequired:true,bindActualImportedAndExecutedDependencies:true,allowedNewProgramPaths:[...OWN],
    scopedParentSpecificationMappingOnly:true,noGlobalReaderOrFrozenParentSourceMutation:true});
  const e=p.executionBoundary;
  for(const [key,want] of Object.entries({cpuPreparationAttempts:1,gpuAttempts:1,automaticRetries:0,cpuFailureMayEnterGpu:false,
    realModelForwardsDuringCpuPreparation:0,realAutogradDuringCpuPreparation:0,cudaInitializationsDuringCpuPreparation:0,
    generatorForwardsMaximum:1,generatorAutogradMaximum:5,discriminatorAutogradMaximum:1,optimizerConstructions:0,optimizerUpdates:0,
    writePng:false,writeCheckpoint:false,training:false,replayConsumedParent:false,preserveAllOriginalResourceChecksAndFrequencies:true,
    reuseExistingNativeJobAndUniqueGuard:true,reuseExistingCurrentExecutionRegistryWriter:true,latestTrainingTerminalMayChange:false,
    allModelStateRngModesAndRequiresGradRestored:true}))assert.equal(e[key],want,'fixed boundary '+key);
  assert.deepEqual(p.grants,{trainingQualification:false,visualQualification:false,stage4Qualification:false,capabilityRelease:false,runtimeRelease:false});
  assert.equal(p.observation.clock,'host_monotonic_elapsed_not_gpu_kernel_time');
  for(const key of ['extraCudaEvents','extraCudaSynchronizations','extraModelCalls','extraGradientCalls'])assert.equal(p.observation[key],0);
  for(const key of ['saveTensors','saveUnboundedEvents'])assert.equal(p.observation[key],false);
  for(const key of ['observeOnlyExistingOperations','unseparableCostsMustRemainAggregated','parentChildSpansAreNotIndependentCosts',
    'cannotAttributeFullTrainingOrHistoricalState'])assert.equal(p.observation[key],true);
  assert.deepEqual(p.finalization.allowedResults,['probe_completed_no_training_qualification','failed_closed']);
  for(const key of ['requireOriginalCallCounts','requireModelAndRngUnchanged','requireRetainedProcessAndPipeCleanupProof','unknownMustNotBecomeZero',
    'failurePreservesFirstErrorAndCommittedObservations','uncommittedObservationsMustNotBeReconstructed','noAutomaticFollowupTraining'])assert.equal(p.finalization[key],true);
  assert.equal(p.parentEvidence.runId,'decode1-entry-quality-v1-054b3669-3a3f-45e9-a647-66502fcb5fcb');
  for(const key of ['package','plan','modelIdentity','failure','originalSpecification','originalSpecificationSnapshot'])binding(p.parentEvidence[key]);
  assert.equal(p.parentEvidence.originalSpecification.sha256,p.parentEvidence.originalSpecificationSnapshot.sha256);
  binding(p.formalSpecification);return true;
}
export function collectSources(root,reader,python,p){
  const frozen=new Map(p.modelBoundary.frozenAlgorithmBindings.map(b=>[b.path,b.sha256]));
  const required=Object.fromEntries(OWN.map((name,i)=>['costProgram'+i,name]));
  required.canonicalRegionProgram='scripts/lib/real-earth-region-governance.mjs';
  required.nativeOwnerSource='scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs';
  const programs=Object.values(collectActualExecutionSources({root,required,python,
    bind:name=>{const raw=reader.bytes(name,frozen.get(name));return {path:name,sha256:hash(raw)};}}));
  assert(programs.length<=256);for(const b of p.modelBoundary.frozenAlgorithmBindings)assert.deepEqual(programs.find(row=>row.path===b.path),b);
  return programs.sort((a,b)=>a.path.localeCompare(b.path));
}
export function resolveInputs(root){
  assert(hex(POLICY.sha256),'explicit registered policy digest required');
  const reader=createReader(root),p=reader.bound(POLICY);validatePolicy(p);
  reader.bytes(p.formalSpecification.path,p.formalSpecification.sha256);
  // Exact local mapping only. Never rewrite the global reader or parent policy.
  reader.bytes(p.parentEvidence.originalSpecificationSnapshot.path,p.parentEvidence.originalSpecification.sha256);
  const parent={};for(const key of ['package','plan','modelIdentity','failure'])parent[key]=reader.bound(p.parentEvidence[key]);
  assert.equal(parent.plan.runId,p.parentEvidence.runId);assert.equal(parent.failure.runId,p.parentEvidence.runId);
  assert.equal(parent.plan.formalSpecification.path,p.parentEvidence.originalSpecification.path);
  assert.equal(parent.plan.formalSpecification.sha256,p.parentEvidence.originalSpecification.sha256);
  const closure=reader.bound(parent.plan.dataClosure);
  const diagnostics=closure.bindings.filter(b=>b.sha256==='4639d25a8c0f0bc2f60592c15b23971de3a17b131124ea54df52568c4139a09e');
  assert.equal(diagnostics.length,1,'exact parent metadata diagnostic');
  const dataBindings={datasetManifest:binding(parent.plan.datasetManifest),trainSplit:binding(parent.plan.trainSplit),
    validationSplit:binding(parent.plan.validationSplit),regimeDiagnostic:binding(diagnostics[0]),
    conditionContract:{path:'data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json',
      sha256:'c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2'}};
  assert.equal(reader.bound(dataBindings.trainSplit).sampleIds[0],p.scope.sampleId,'fixed first train row');
  const python=path.join(root,'ml/ai-painter/.venv/Scripts/python.exe');
  const interpreter={path:python,sha256:hash(fs.readFileSync(python))};
  const actualNode=fs.realpathSync(process.execPath),expectedNode=fs.realpathSync(parent.plan.runtimeIdentity.node.absolutePath);
  assert.equal(process.platform==='win32'?actualNode.toLowerCase():actualNode,process.platform==='win32'?expectedNode.toLowerCase():expectedNode,
    'actual Node file differs from the bound original provider');
  const nodeInterpreter={path:parent.plan.runtimeIdentity.node.absolutePath,sha256:hash(fs.readFileSync(process.execPath))};
  assert.equal(nodeInterpreter.sha256,parent.plan.runtimeIdentity.node.sha256);
  const programs=collectSources(root,reader,python,p);reader.verifyStable();
  return {reader,p,python,interpreter,nodeInterpreter,programs,dataBindings};
}
function environment(root,cpu){return {...process.env,CUDA_VISIBLE_DEVICES:cpu?'':'0',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',
  PYTHONPATH:[path.join(root,'ml/ai-painter/src'),path.join(root,'ml/ai-painter/scripts')].join(path.delimiter),
  OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'};}
function clock(seconds){const wall=Date.now(),mono=performance.now();return {deadline:wall+seconds*1000,
  remaining:()=>seconds*1000-Math.max(Date.now()-wall,performance.now()-mono)};}
function requireTime(c,reserve=0){assert(c.remaining()>reserve,'total phase deadline including cleanup/finalization exhausted');}
function put(root,out,name,value,accounting,{failure=false,replace=false}={}){
  assert(/^[a-z-]+\.json$/u.test(name));const raw=Buffer.from(JSON.stringify(value)+'\n');
  if(failure)assert(raw.length<=65536,'failure terminal reserve ceiling');
  assert(accounting.requireBudget().totalBytes+raw.length<=RESOURCES.maxOutputBytes-(failure?0:RESERVE),'complete evidence quota');
  const logical=out+'/'+name,file=path.join(root,logical);
  const target=replace?file+'.staged':file,fd=fs.openSync(target,'wx');let primary=null;
  try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}catch(e){primary=e;throw e;}
  finally{try{fs.closeSync(fd);}catch(e){if(!primary)throw e;}}
  if(replace)fs.renameSync(target,file);
  return {path:logical,sha256:hash(raw)};
}
function accountingFor(root,out,p,prior=null){
  const base=createOwnedAccounting(root,path.join(root,out),p);
  const retired=prior?.outputAccounting?.externalOwnedBytes??0;
  const external=()=>['cpu-attempt.json','gpu-attempt.json','current-cpu-acceptance.json'].reduce((n,name)=>{
    const file=path.join(root,OUTPUT,name);return n+(fs.existsSync(file)?fs.statSync(file).size:0);},0);
  let closing=false,observed=false;const orphanDirectories=new Set(),orphanFiles=new Set();
  return {...base,observe(scope){base.observe(scope);observed=true;},
    observeFailure(error){const g=error.ownedReceipt?.guard;if(observed||!g||g.state==='existing_guard_refused')return;
      assert(/^[a-f0-9-]{36}$/u.test(g.identity),'own pre-spawn guard identity');
      const guardRoot=path.join(root,'.runtime/ai-painter/owned-worker-guards'),native=path.join(guardRoot,g.identity+'-native');
      if(fs.existsSync(native))orphanDirectories.add(native);
      for(const suffix of ['-started.json','-terminal.json','-guard-terminal.json'])orphanFiles.add(path.join(guardRoot,g.identity+suffix));},
    beginFailureClosure(){closing=true;base.beginFailureClosure();},requireBudget(){const v=base.requireBudget(),guard=path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json');
    const guardBytes=fs.existsSync(guard)?fs.statSync(guard).size:0;
  const orphanBytes=[...orphanDirectories].reduce((n,d)=>n+directoryBytes(d),0)+[...orphanFiles].reduce((n,f)=>{
    if(!fs.existsSync(f))return n;const stat=fs.lstatSync(f);assert(stat.isFile()&&!stat.isSymbolicLink());return n+stat.size;},0);
  const extra=retired+external()+8*v.streamBytes+1048576+guardBytes+orphanBytes;
    requireTotalBudget(v.totalBytes,extra,closing);
    return {...v,totalBytes:v.totalBytes+extra,externalOwnedBytes:v.nativeBytes+v.registryBytes+v.streamBytes+v.atomicCopyBytes+extra};}};
}
export function requireTotalBudget(total,extra,failure=false){
  assert(Number.isSafeInteger(total)&&total>=0&&Number.isSafeInteger(extra)&&extra>=0&&typeof failure==='boolean','observed accounting bytes required');
  assert(total+extra<=RESOURCES.maxOutputBytes-(failure?0:RESERVE),'complete transport/native/registry quota');
}
async function emptyRegistry(root,c){requireTime(c);const r=await readCurrentExecutionRegistry(root,{deadlineUnixMs:c.deadline});
  assert(r.ok,'current registry verification failed: '+r.errorCode);assert.equal(r.registry.activeExecution,null,'active execution refused');
  assert(!fs.existsSync(path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json')),'existing guard refused');return r;}
async function publish(options,accounting){const prepared=await prepareCurrentExecutionRegistryAdvance(options);
  accounting.observeRegistryTransaction(prepared.transactionRoot);accounting.requireBudget();
  return finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:options.projectRoot,transactionId:prepared.transactionId,
    deadlineUnixMs:options.deadlineUnixMs,beforeAtomicWrite:accounting.beforeAtomicWrite});}
export function validateWorker(value,cpu){
  assert.equal(value.executionState,'completed');assert.equal(value.status,cpu?'cpu_preparation_passed':'probe_completed_no_training_qualification');
  for(const key of ['trainingAllowed','gpuQualified','stage4Qualified','checkpointWritten','imageWritten','capabilityReleased','historicalReplayAllowed'])assert.equal(value[key],false);
  const n=value.counts;assert.equal(n.optimizerConstruction,0);assert.equal(n.optimizerUpdates,0);
  assert.deepEqual(['generatorForwards','generatorAutograd','discriminatorAutograd','autogradAttempts','autogradCompleted','sampleDecodeAttempts','decodedSamples']
    .map(k=>n[k]),cpu?[0,0,0,0,0,0,0]:[1,5,1,6,6,1,1]);
  if(cpu)assert.equal(value.cudaInitialized,false);
  assert(Buffer.byteLength(JSON.stringify(value.timings))<=32768,'timing JSON ceiling');
  assert.equal(value.timings.schemaVersion,'ai-painter-decode1-entry-training-cost-observation-v1');return true;
}
function gpuObservation(){const raw=execFileSync('nvidia-smi',['--query-gpu=index,uuid,memory.free,temperature.gpu','--format=csv,noheader,nounits'],
  {encoding:'utf8',windowsHide:true,timeout:2500,maxBuffer:16384});
  const rows=raw.trim().split(/\r?\n/u).map(line=>line.split(',').map(s=>s.trim())).filter(row=>row[0]==='0');assert.equal(rows.length,1);
  const [index,uuid,free,temp]=rows[0];assert.equal(index,'0');assert(/^GPU-[a-f0-9-]{36}$/iu.test(uuid));
  assert(Number.isFinite(+free)&&+free>=2048&&Number.isFinite(+temp)&&+temp<85,'GPU startup safety floor');
  return {uuid,freeVramMiB:+free,temperatureC:+temp};}
function currentCpu(root,bound){
  const {reader,p,programs,interpreter,nodeInterpreter}=bound;
  const pointer=JSON.parse(fs.readFileSync(path.join(root,OUTPUT,'current-cpu-acceptance.json'),'utf8'));
  assert(pointer.path.startsWith(OUTPUT+'/decode1-entry-cost-')&&pointer.path.endsWith('/cpu-acceptance.json'));
  const cpu=reader.bound(binding(pointer));assert.equal(cpu.status,'cpu_preparation_passed');assert.deepEqual(cpu.policy,POLICY);
  const pkg=reader.bound(cpu.package);assert.equal(pkg.runId,cpu.runId);assert.deepEqual(pkg.programBindings,programs);
  assert.deepEqual(pkg.interpreter,interpreter);assert.deepEqual(pkg.nodeInterpreter,nodeInterpreter);
  assert.deepEqual(pkg.resources,p.resources);assert.deepEqual(pkg.scope,p.scope);assert.deepEqual(pkg.dataBindings,bound.dataBindings);
  const request=reader.bound(cpu.request);assert.equal(request.mode,'cpu_prepare');assert.deepEqual(request.package,cpu.package);
  validateWorker(cpu.worker,true);proofPassed(cpu.ownedReceipt);
  const receipt=cpu.ownedReceipt,live=JSON.parse(Buffer.from(receipt.proof.bindingBase64,'base64').toString('utf8'));
  const args=['-B',path.join(root,OWN[2]),'--request',cpu.request.path,'--request-sha256',cpu.request.sha256,'--policy-sha256',POLICY.sha256];
  assert.equal(live.scope,path.resolve(root));assert.equal(live.guard.commandSha256,hash(JSON.stringify(args)));
  assert.equal(live.guard.executableSha256,interpreter.sha256);assert.equal(live.guard.identity,receipt.guard.identity);
  assert.equal(receipt.proof.exitCode,0);assert.equal(receipt.proof.stopReason,null);
  for(const [file,sha] of [[receipt.guard.terminalPath,live.guardSha256],[live.nativeBuild.binary,live.nativeBuild.binarySha256],
    [live.nativeBuild.source.path,live.nativeBuild.source.sha256],[live.nativeBuild.compiler,live.nativeBuild.compilerSha256]])
    assert.equal(hash(fs.readFileSync(file)),sha,'immutable CPU native evidence differs');
  const terminal=JSON.parse(fs.readFileSync(receipt.guard.terminalEvidence,'utf8'));assert.deepEqual(terminal.proof,receipt.proof);
  assert.equal(terminal.liveOwnerCleanupConfirmed,true);
  const started=JSON.parse(fs.readFileSync(receipt.guard.startedEvidence,'utf8'));assert.equal(started.bindingBase64,receipt.proof.bindingBase64);
  return {pointer,cpu,pkg};
}
export async function execute(cpu,{root=ROOT,policyBinding=POLICY}={}){
  bindPolicy(policyBinding);const c=clock(cpu?120:180),bound=resolveInputs(root),{p,reader,python}=bound;
  const before=await emptyRegistry(root,c);requireTime(c,FINALIZATION+1000);
  fs.mkdirSync(path.join(root,OUTPUT),{recursive:true});
  const claim=path.join(root,OUTPUT,cpu?'cpu-attempt.json':'gpu-attempt.json');assert(!fs.existsSync(claim),'one attempt consumed; no retry');
  const previous=cpu?null:currentCpu(root,bound);
  if(!cpu)gpuObservation();
  assert(fs.statfsSync(path.join(root,OUTPUT)).bavail*fs.statfsSync(path.join(root,OUTPUT)).bsize>=2048*1024**2,'disk safety floor');
  const runId=previous?.cpu.runId??'decode1-entry-cost-'+crypto.randomUUID(),out=OUTPUT+'/'+runId;
  if(cpu)fs.mkdirSync(path.join(root,out));
  const accounting=accountingFor(root,out,p,previous?.cpu);
  const write=(name,value,options)=>put(root,out,name,value,accounting,options);
  fs.writeFileSync(claim,JSON.stringify({runId,policy:POLICY,automaticRetries:0,recordedAtUtc:new Date().toISOString()})+'\n',{flag:'wx'});
  const pkg=cpu?write('package.json',{schemaVersion:'decode1-entry-training-cost-package-v1',runId,capabilityVersion:CAPABILITY,policy:POLICY,
    scope:p.scope,resources:p.resources,programBindings:bound.programs,interpreter:bound.interpreter,nodeInterpreter:bound.nodeInterpreter,dataBindings:bound.dataBindings})
    :previous.cpu.package;
  const request=write(cpu?'cpu-request.json':'gpu-request.json',{schemaVersion:'decode1-entry-training-cost-request-v1',runId,
    mode:cpu?'cpu_prepare':'gpu_probe',outputRoot:out,policy:POLICY,package:pkg,deadlineUnixMs:c.deadline-FINALIZATION,
    registryBefore:{path:'.runtime/ai-painter/current-execution-registry/current.json',sha256:before.registrySha256},
    ...(!cpu?{cpuAcceptance:binding(previous.pointer)}:{})});
  let result,liveReceipt=null,first=null,terminal=null,registered=false,timer=null,heartbeatError=null,activeRegistrySha=null;
  const common={projectRoot:root,capabilityVersion:CAPABILITY,packageId:runId+'-package',taskId:runId,taskKind:'zero_update_cost_diagnostic',
    taskGoal:'One fresh source-bound sample, unchanged one forward/five G VJPs/one D VJP, zero updates; observe inclusive host costs.',
    priority:1,runId,lifecycleStage:'numerical_diagnosis',nextMachineAction:null,deadlineUnixMs:c.deadline};
  try{
    if(!cpu){
      const admission=write('admission.json',{runId,executionState:'completed',status:'same_package_cpu_verified_not_training',request,trainingAllowed:false});
      const capsule=write('task-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:runId,runId,integrity:{status:'verified'},
        evidence:[{...request,sha256Verified:true},{...admission,sha256Verified:true}]});common.taskCapsulePath=capsule.path;
      const created=execFileSync('powershell.exe',['-NoProfile','-Command',
        "$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+process.pid+"'; $p.CreationDate.ToUniversalTime().ToString('o')"],
        {encoding:'utf8',windowsHide:true,timeout:3000,maxBuffer:4096}).trim();assert(created);
      const identity={capabilityVersion:CAPABILITY,packageId:common.packageId,runId,processId:process.pid,processStartIdentity:process.pid+':'+created};
      const lock=write('active-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity});
      const beat=()=>write('heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,
        executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120},{replace:fs.existsSync(path.join(root,out,'heartbeat.json'))});
      beat();timer=setInterval(()=>{try{requireTime(c);beat();}catch(e){heartbeatError=e;}},5000);
      await publish({...common,executionState:'executing',activity:'zero_update_cost_probe_not_training',queueStatus:'running',
        activeExecution:{schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'executing',
          programLineage:Object.fromEntries(bound.programs.map((b,i)=>['costSource'+i,b])),
          lock,heartbeat:{path:out+'/heartbeat.json',ttlSeconds:120}},terminalEvidencePath:admission.path,
        expectedPreviousRegistryRevision:before.registry.registryRevision,expectedPreviousRegistrySha256:before.registrySha256},accounting);
      registered=true;
      const actual=await readCurrentExecutionRegistry(root,{deadlineUnixMs:c.deadline});assert(actual.ok&&actual.registry.runId===runId);
      activeRegistrySha=actual.registrySha256;
    }
    requireTime(c,FINALIZATION+1000);
    result=await runParameter60OwnedWorker(python,['-B',path.join(root,OWN[2]),'--request',request.path,'--request-sha256',request.sha256,'--policy-sha256',POLICY.sha256,
      ...(!cpu?['--active-registry-sha256',activeRegistrySha]:[])],
      {cwd:root,env:environment(root,cpu),timeout:Math.floor(c.remaining()-FINALIZATION),maxBuffer:p.resources.maxStreamBytes,
        onSpawn:accounting.observe,abortReason:()=>{accounting.requireBudget();return heartbeatError?'heartbeat persistence failed':c.remaining()<=FINALIZATION?'total execution/cleanup deadline':null;}});
    liveReceipt=result.ownedReceipt;proofPassed(liveReceipt);
    const value=JSON.parse(result.stdout);assert.equal(value.runId,runId);validateWorker(value,cpu);
    reader.verifyStable();requireTime(c);
    const timing=write(cpu?'cpu-timing.json':'gpu-timing.json',value.timings);
    terminal=write(cpu?'cpu-acceptance.json':'terminal.json',{schemaVersion:'decode1-entry-training-cost-terminal-v1',runId,policy:POLICY,
      status:value.status,executionState:'completed',package:pkg,request,worker:value,timing,ownedReceipt:liveReceipt,
      outputAccounting:accounting.requireBudget(),elapsedMs:(cpu?120:180)*1000-c.remaining(),trainingAllowed:false});
    if(cpu){
      const now=await readCurrentExecutionRegistry(root,{deadlineUnixMs:c.deadline});assert(now.ok&&now.registrySha256===before.registrySha256,'CPU registry changed');
      const file=path.join(root,OUTPUT,'current-cpu-acceptance.json');assert(!fs.existsSync(file));
      accounting.requireBudget();fs.writeFileSync(file,JSON.stringify(terminal)+'\n',{flag:'wx'});
    }
  }catch(error){first=error;liveReceipt=error.ownedReceipt??liveReceipt;accounting.beginFailureClosure();
    try{accounting.observeFailure(error);}catch(secondary){error.secondaryAccountingError=String(secondary.message);}
    let committedObservation=null,workerFailure=null;
    try{const file=path.join(root,out,'gpu-observation.json');if(fs.existsSync(file)){
      const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=32768);
      const raw=fs.readFileSync(file),v=JSON.parse(raw);assert.equal(v.runId,runId);assert.deepEqual(v.policy,POLICY);assert.deepEqual(v.package,pkg);
      committedObservation={path:out+'/gpu-observation.json',sha256:hash(raw)};}}
    catch(secondary){error.secondaryObservationError=String(secondary.message);}
    try{const v=JSON.parse(error.stdout??result?.stdout??'');if(v.runId===runId&&v.status==='failed_closed')workerFailure={firstError:v.firstError,
      counts:v.counts,gradientFailureSummary:v.gradientFailureSummary,secondaryProbeErrors:v.secondaryProbeErrors};}catch{}
    try{terminal=write(cpu?'cpu-failure.json':'failure.json',{schemaVersion:'decode1-entry-training-cost-terminal-v1',runId,policy:POLICY,
      status:'failed_closed',executionState:'failed_closed',firstError:{type:error.name,message:String(error.message).slice(0,4096)},
      workerOutput:String(error.stdout??result?.stdout??'').slice(0,16384),stderr:String(error.stderr??result?.stderr??'').slice(0,4096),
      ownedReceipt:liveReceipt,workerFailure,committedObservation,committedObservationOnly:true,unobservedCounts:null,trainingAllowed:false},{failure:true});error.evidence=terminal;}
    catch(secondary){error.secondaryEvidenceError=String(secondary.message);}
  }
  try{
    if(registered){
      // Only the receipt retained from THIS awaited native invocation can clear it.
      assert(terminal&&liveReceipt,'unknown cleanup retains active registry and guard');proofPassed(liveReceipt);
      const own=await readCurrentExecutionRegistry(root,{deadlineUnixMs:c.deadline});assert(own.ok&&own.registry.runId===runId);
      await publish({...common,executionState:first?'failed_closed':'completed',activity:'cost_diagnostic_terminal_not_training',
        queueStatus:first?'failed_closed':'completed',activeExecution:null,terminalEvidencePath:terminal.path,
        expectedPreviousRegistrySha256:own.registrySha256},accounting);
      const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:c.deadline});assert(after.ok&&after.registry.activeExecution===null);
      assert.deepEqual(after.registry.latestTrainingTerminal,before.registry.latestTrainingTerminal,'training terminal must stay unchanged');
    }
    accounting.requireBudget();requireTime(c);
  }catch(secondary){if(first)first.secondaryFinalizationError=String(secondary.message);else first=secondary;}
  finally{if(timer)clearInterval(timer);}
  if(first)throw first;return terminal;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
  const a=process.argv.slice(2);assert(a.length===5&&['--cpu','--run'].includes(a[0])&&a[1]==='--policy'&&a[3]==='--policy-sha256',
    '--cpu|--run --policy <fixed-path> --policy-sha256 <registered-sha> required');
  execute(a[0]==='--cpu',{policyBinding:{path:a[2],sha256:a[4]}}).then(v=>console.log(JSON.stringify(v))).catch(e=>{
    console.error(JSON.stringify({status:'failed_closed',error:String(e.message),evidence:e.evidence??null,
      secondaryEvidenceError:e.secondaryEvidenceError??null,secondaryFinalizationError:e.secondaryFinalizationError??null}));process.exitCode=1;});
}
