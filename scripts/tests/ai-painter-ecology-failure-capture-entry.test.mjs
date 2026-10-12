import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {CURRENT_EXECUTION_REGISTRY_PATH,initializeCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,
 finalizePreparedCurrentExecutionRegistryAdvance,readCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs';
import * as registration from '../lib/ai-painter-ecology-failure-capture-execution-registration-v1.mjs';
import {ROLES,verifyCpuReport,inside,directoryBytes,read as readBound,bind as fileBinding} from '../lib/ai-painter-ecology-failure-capture-package-chain-v1.mjs';
import {createPhaseAdapters} from '../run-ai-painter-ecology-regime-failure-capture.mjs';
import {nativeBudget,hasLiveOwnedProof,hasLiveCpuFixtureCleanup,cleanupForCurrentCall,validateNativeReceipt,
  CpuNegativeInputInspector,cpuNegativeInputLayout,validateCpuNegativeLink,assertCpuNegativeInputBudget,CPU_LINK_RESERVE_BYTES,
  validateCpuRegistryFixtureLeaseRequest,cpuRegistryFixtureBudgetTotal} from '../lib/ai-painter-ecology-failure-capture-owned-native-v1.mjs';
const {CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION,CANDIDATE,MODEL_REFERENCE,FROZEN_PLAN}=registration;
const json=b=>JSON.parse(fs.readFileSync(path.resolve(b.path),'utf8'));
const clone=structuredClone,sha='0'.repeat(64),bound=p=>({path:p,sha256:sha});
function fixture(){
 const frozen=json(FROZEN_PLAN),source=json(CANDIDATE),model=json(MODEL_REFERENCE),runId='synthetic-diagnostic-76',packageId='synthetic-package-76';
 const outputRoot=OUTPUT_ROOT+'/'+runId;
 const programs=Object.fromEntries(Object.entries(frozen.programBindings).map(([r,b])=>['frozen-'+r,b]));
 for(const [r,p]of Object.entries(ROLES))programs[r]=bound(p);
 const plan={schema:PLAN_SCHEMA,executionProfile:EXECUTION_PROFILE,executionMode:'bounded-failure-capture',capabilityVersion:CAPABILITY,
  runId,packageId,outputRoot,formalSpecification:SPECIFICATION,sourceCandidate:CANDIDATE,configuration:registration.deriveConfiguration(source),programBindings:programs,
  modelBinding:bound(outputRoot+'/model-identity.json'),dataClosure:bound(outputRoot+'/data-closure.json'),finalCpuAcceptance:bound(outputRoot+'/cpu-acceptance.json'),
  historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,trainSplit:source.frozenBindings.trainSplit};
 const input={plan,planBinding:bound(outputRoot+'/failure-capture-plan.json'),packageBinding:bound('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json'),modelBinding:plan.modelBinding,modelIdentity:model};
 return {plan,input,packageBinding:input.packageBinding,root:process.cwd()};
}
function completed(f){return {schema:'ecology-regime-failure-capture-worker-terminal-v1',executionProfile:EXECUTION_PROFILE,status:'bounded_diagnostic_completed',executionState:'completed',
 capabilityVersion:CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,executionPackage:f.packageBinding,
 optimizerSteps:{generator:600,discriminator:600},optimizerStepsGenerator:600,optimizerStepsDiscriminator:600,completedEpochs:12,
 captureStatus:'capture_not_triggered',originalError:null,checkpoints:[],checkpointSelectionExecuted:false,validationRgbRead:false,challengeContentRead:false,regressionContentRead:false,
 checkpointPromotable:false,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false,automaticRetries:0};}
test('new identity accepts full108/179 and original600/2700; presentation grants nothing',()=>{
 const f=fixture();registration.validate(f.input);const p=registration.createPresentation(f.input);
 assert.equal(p.trainingPlan.generatorOptimizerSteps,600);assert.equal(p.trainingAllowed,false);assert.equal(p.gpuQualified,false);
 assert.equal(Object.keys(f.plan.programBindings).filter(k=>k.startsWith('frozen-')).length,179);
});
test('old schema/spec,257roles,graph107,old48 selection and4200 overrides refused',()=>{
 for(const mutate of [i=>i.plan.schema='ecology-regime-managed-plan-v1',i=>i.plan.formalSpecification={...SPECIFICATION,sha256:sha},
  i=>i.modelIdentity.graph.pop(),i=>i.plan.configuration.executionCeiling.maxWallSeconds=4200,
  i=>i.plan.configuration.checkpointSelection.eligibleEpochs=[24,36,48],
  i=>{for(let n=Object.keys(i.plan.programBindings).length;n<=256;n++)i.plan.programBindings['extra-'+n]=bound('x.py')}]){
  const i=clone(fixture().input);mutate(i);assert.throws(()=>registration.validate(i));
 }
});
test('GPU/native budget cannot borrow old plan or fake disk cleanup',()=>{
 assert.equal(nativeBudget('cpu').timeoutMs,240000);assert.equal(nativeBudget('qualification').timeoutMs,600000);
 assert.equal(nativeBudget('cpu').outputBytes,8*1024**2);assert.equal(nativeBudget('cpu').streamBytes,8*1024**2);
 assert.equal(nativeBudget('qualification').outputBytes,16*1024**2);
 assert.throws(()=>nativeBudget('review'));assert.throws(()=>nativeBudget('training'));
 assert.throws(()=>nativeBudget('training',{root:process.cwd(),plan:{...fixture().plan,schema:'ecology-regime-managed-plan-v1'}}));
 assert.equal(hasLiveOwnedProof({cleanupConfirmed:true}),false);assert.equal(cleanupForCurrentCall({ownedReceipt:{cleanupConfirmed:true}},{cleanupConfirmed:true}),false);
 assert.equal(validateNativeReceipt({proof:{ownerPid:2,rootPid:3,rootCreationDateUtc:'synthetic',bindingBase64:'x',assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,stdoutBytes:0,stderrBytes:0},
  ownerPid:2,bindingBase64:'x',ownerClosed:false,protocolError:null,stdoutBytes:0,stderrBytes:0}),false);
});
test('CPU raw calls/source/config consistency required',()=>{
 const f=fixture(),request={...f.plan,schema:'ecology-regime-failure-capture-cpu-request-v1',outputRoot:f.plan.outputRoot+'/cpu-entry'};
 const raw={schema:'ecology-regime-failure-capture-entry-cpu-report-v1',status:'passed',passed:20,failed:0,errors:0,skipped:0,
  synthetic:true,gpuInitialized:false,items:Array.from({length:20},()=>({status:'passed'})),actualCalls:Object.fromEntries(['moduleForwardCalls','autogradCalls','optimizerConstructionAttempts','optimizerUpdates','cudaInitializationAttempts'].map(k=>[k,0])),
  programBindings:f.plan.programBindings,configuration:f.plan.configuration,modelBinding:f.plan.modelBinding};
 verifyCpuReport(raw,request,f.plan);
 for(const mutate of [r=>r.actualCalls.optimizerUpdates=1,r=>r.programBindings.worker.sha256='1'.repeat(64),r=>r.configuration.executionCeiling.generatorOptimizerSteps=601]){
  const r=clone(raw);mutate(r);assert.throws(()=>verifyCpuReport(r,request,f.plan));
 }
});
test('terminal partial D failure preserves primary; count and status conflict refused',()=>{
 const f=fixture(),body=completed(f);registration.validateTerminal(body,f.packageBinding,f.plan);
 const failure={...body,status:'failed_closed',executionState:'failed_closed',optimizerSteps:{generator:599,discriminator:600},optimizerStepsGenerator:599,captureStatus:'capture_incomplete',originalError:{message:'synthetic G gate failure'}};
 registration.validateTerminal(failure,f.packageBinding,f.plan);assert.equal(failure.originalError.message,'synthetic G gate failure');
 for(const mutate of [v=>v.optimizerSteps.generator=601,v=>v.optimizerStepsDiscriminator=599,v=>v.status='training_completed_review_pending',v=>v.checkpoints=[{}],v=>v.captureStatus='captured']){
  const v=clone(failure);mutate(v);assert.throws(()=>registration.validateTerminal(v,f.packageBinding,f.plan));
 }
});
function simulatedPhases({failed=false,unknownCleanup=false,concurrent=false}={}){
 const f=fixture(),store=new Map(),nativeCalls=[],registryWrites=[],live=new WeakSet();
 let registry={registryRevision:1,activeExecution:concurrent?{fixture:true}:null};
 const put=(root,p,value)=>{assert.equal(store.has(p),false,'synthetic exclusive duplicate');store.set(p,clone(value));return bound(p);};
 const body=completed(f),terminal=bound(f.plan.outputRoot+'/worker-terminal.json');
 if(failed)Object.assign(body,{status:'failed_closed',executionState:'failed_closed',optimizerSteps:{generator:599,discriminator:600},optimizerStepsGenerator:599,captureStatus:'capture_incomplete',originalError:{message:'synthetic primary G error'}});
 const primary=Error('synthetic numerical failure');
 const adapters=createPhaseAdapters({loadContext:()=>f,write:put,json:(r,b)=>store.get(b.path),bind:(r,p)=>{assert.ok(store.has(p));return bound(p)},inside:(r,p)=>path.resolve(r,p),
  readRegistry:async()=>({ok:true,registry,registrySha256:sha}),processIdentity:()=> 'synthetic-live-creation',
  advanceRegistry:async options=>{
   const evidence=store.get(options.terminalEvidencePath);assert.ok(evidence,'actual terminal evidence missing');
   for(const key of ['capabilityVersion','packageId','runId'])assert.equal(evidence[key],options[key]);
   assert.deepEqual(evidence.executionPackage,f.packageBinding);
   assert.ok(['completed','failed_closed','blocked_policy_boundary'].includes(evidence.executionState),'terminal evidence state missing');
   if(options.activeExecution){assert.equal(evidence.executionState,'completed');assert.equal(evidence.completedAction,'execution_dispatch_record_only_not_training');
    assert.equal(evidence.status,'qualification_pending');assert.equal(evidence.trainingStarted,false);assert.equal(options.executionState,'executing');}
   if(options.terminalEvidencePath.endsWith('/finalization.json')){
    assert.equal(evidence.executionState,'completed');assert.equal(evidence.completedAction,'diagnostic_finalization_record_only_not_quality_qualification');
    for(const flag of ['rootCauseConfirmed','qualificationGranted','checkpointPromotable','formalStage4QualificationAllowed','runtimePublicationAllowed'])assert.equal(evidence[flag],false);
    assert.equal(evidence.diagnosticOnly,true);}
   registryWrites.push(options);registry={registryRevision:registry.registryRevision+1,activeExecution:options.activeExecution};return {ok:true}},
  withNativeOrdinaryBudget:async(r,receipt,action)=>action(),withNativeReceiptBudget:async(r,receipt,action)=>action(),
  hasLiveOwnedProof:r=>live.has(r),cleanupForCurrentCall:(error,last)=>live.has(Object.hasOwn(error,'ownedReceipt')?error.ownedReceipt:last),
  verifyGpuOutcome:()=>({fixtureKind:'simulated-gpu-protocol-only'}),
  runNative:async options=>{
   nativeCalls.push(options);const receipt={fixtureKind:'simulated-native-not-live-Job',cleanupConfirmed:!unknownCleanup,outputAccountingRoots:[f.plan.outputRoot]};
   if(!unknownCleanup)live.add(receipt);
   if(options.phase==='qualification')return {stdout:JSON.stringify(bound(f.plan.outputRoot+'/gpu-gate.json')),ownedReceipt:receipt,receiptBinding:bound(f.plan.outputRoot+'/synthetic-owned-gpu.json')};
   store.set(terminal.path,body);
   if(failed){primary.ownedReceipt=receipt;throw primary;}
   return {stdout:JSON.stringify(terminal),ownedReceipt:receipt,receiptBinding:bound(f.plan.outputRoot+'/synthetic-owned-training.json')};
  }});
 return {adapters,nativeCalls,registryWrites,store,primary,f,getRegistry:()=>registry};
}
test('simulated closed-loop reaches600 without promotion and rejects consumed repeat',async()=>{
 const s=simulatedPhases();const out=await s.adapters.execute({heartbeat(){}});
 assert.equal(out.captureStatus,'capture_not_triggered');assert.equal(s.nativeCalls.length,2);assert.equal(s.nativeCalls[0].phase,'qualification');
 assert.equal(s.nativeCalls[1].phase,'training');assert.equal(s.registryWrites.at(-1).executionState,'completed');
 assert.equal(s.registryWrites.at(-1).activeExecution,null);assert.equal(s.registryWrites.at(-1).latestTrainingTerminal.status,'bounded_diagnostic_completed');
 const finalized=await s.adapters.finalize({});assert.equal(finalized.status,'passed');
 assert.equal(s.store.get(finalized.finalization.path).diagnosticOnly,true);assert.equal(s.registryWrites.at(-1).executionState,'completed');
 await assert.rejects(s.adapters.execute({heartbeat(){}}),/duplicate/u);assert.equal(s.nativeCalls.length,2);
});

// Real registry IO and SHA checks in an explicit CPU-only fixture. The native
// transport above remains simulated; neither registry code nor readers are mocked.
function isolatedRegistryRoot(name){
 const privateBase='.runtime/ai-painter/controller-parallel-20261010/training-capture-entry/repair-t88';
 const configured=process.env.T_Q4_88_REGISTRY_FIXTURE_ROOT;
 let logical;
 if(configured){assert.ok([privateBase+'/registry-fixtures','.runtime/ai-painter/controller-parallel-20261011/training-cpu-negative-inputs/repair-t112/registry-fixtures'].includes(configured));logical=configured;}
 else {const owned=process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT;
  assert.ok(owned?.startsWith(OUTPUT_ROOT+'/')&&owned.endsWith('/cpu-entry'),'owned CPU fixture root required');logical=owned+'/registry-fixtures';}
 const parent=path.resolve(logical),root=path.join(parent,name);
 assert.equal(path.relative(parent,root),name);assert.equal(fs.existsSync(root),false);
  fs.mkdirSync(parent,{recursive:true});fs.mkdirSync(root);return root;
}
const actualSha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function fixtureWrite(root,logical,value){
 const target=path.resolve(root,logical);assert.ok(!path.relative(root,target).startsWith('..')&&!path.isAbsolute(path.relative(root,target)));
 fs.mkdirSync(path.dirname(target),{recursive:true});const raw=Buffer.from(JSON.stringify(value)+'\n');fs.writeFileSync(target,raw);
 return {path:logical,sha256:actualSha(raw)};
}
function fixtureRead(root,logical){return JSON.parse(fs.readFileSync(path.resolve(root,logical),'utf8'));}
function registryKeeperContext(){
 const component=process.env.T_Q4_112_COMPONENT_ROOT,owned=process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT;
 assert.ok(component||owned,'current CPU keeper invocation required');assert.equal(Boolean(component&&owned),false);
 const entryRoot=component??owned;
 if(component)assert.equal(component,'.runtime/ai-painter/controller-parallel-20261011/training-cpu-negative-inputs/repair-t112');
 else assert.ok(owned.startsWith(OUTPUT_ROOT+'/')&&owned.endsWith('/cpu-entry'));
 const declarationPath=(component??owned.replace(/\/cpu-entry$/u,''))+'/cpu-negative-inputs/input-declaration.json';
 const declaration=fileBinding(process.cwd(),declarationPath),body=JSON.parse(readBound(process.cwd(),declaration));
 assert.equal(body.schema,component?'cpu-negative-input-component-declaration-v1':'cpu-negative-input-declaration-v1');
 const request=body.request,current=JSON.parse(readBound(process.cwd(),request));assert.equal(current.outputRoot,entryRoot);
 if(component){assert.equal(current.taskId,'T-Q4-112');assert.equal(body.callIdentity,process.env.T_Q4_112_COMPONENT_CALL);
  assert.deepEqual(request,JSON.parse(process.env.T_Q4_112_COMPONENT_REQUEST));assert.equal(current.nativeOwnerAllowed,false);}
 assert.deepEqual(current.programBindings,body.programBindings);
 return {entryRoot,request,declaration,callIdentity:body.callIdentity};
}
function writeKeeperJson(logical,value){
 const raw=Buffer.from(JSON.stringify(value)+'\n');assert.ok(raw.length<=8192);
 const fd=fs.openSync(inside(process.cwd(),logical),'wx');try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
 return {path:logical,sha256:actualSha(raw)};
}
async function acquireRegistryKeeper(root){
 const context=registryKeeperContext(),logical=path.relative(process.cwd(),root).replaceAll('\\','/'),name=path.basename(root);
 const stat=fs.lstatSync(root,{bigint:true});assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
 const request={schema:'cpu-registry-fixture-keeper-request-v1',...context,name,root:logical,rootIdentity:`${stat.dev}:${stat.ino}`};
 delete request.entryRoot;validateCpuRegistryFixtureLeaseRequest(context,request);
 const binding=writeKeeperJson(context.entryRoot+'/sqlite-keeper-request-'+name+'.json',request);
 const ready=inside(process.cwd(),context.entryRoot+'/sqlite-keeper-request-'+name+'.ready'),fd=fs.openSync(ready,'wx');
 try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
 const ackReady=inside(process.cwd(),context.entryRoot+'/sqlite-keeper-ack-'+name+'.ready'),deadline=Date.now()+5000;
 while(!fs.existsSync(ackReady)){assert.ok(Date.now()<deadline,'same-call SQLite keeper acknowledgement deadline');await new Promise(resolve=>setTimeout(resolve,50));}
 const readyStat=fs.lstatSync(ackReady,{bigint:true});assert.ok(readyStat.isFile()&&!readyStat.isSymbolicLink()&&readyStat.size===0n);
 const acknowledgement=fileBinding(process.cwd(),context.entryRoot+'/sqlite-keeper-ack-'+name+'.json');
 const ack=JSON.parse(readBound(process.cwd(),acknowledgement));assert.equal(ack.schema,'cpu-registry-fixture-keeper-ack-v1');
 for(const key of ['callIdentity','entryRoot','request','declaration'])assert.deepEqual(ack[key],context[key]);
 assert.deepEqual(ack.childRequest,binding);assert.equal(ack.name,name);assert.equal(ack.root,logical);assert.equal(ack.rootIdentity,request.rootIdentity);
 const requestReady=fs.lstatSync(ready,{bigint:true});assert.equal(ack.readyIdentity,`${requestReady.dev}:${requestReady.ino}`);
 assert.ok(requestReady.isFile()&&!requestReady.isSymbolicLink()&&requestReady.size===0n);
 assert.equal(ack.walActivated,true);assert.equal(ack.emptySchema,true);assert.equal(ack.activeTransaction,false);
 assert.equal(ack.keeperWritesWhileChildActive,0);assert.equal(ack.nativeAuthorityClaimed,false);
 const registry=logical+'/.runtime/ai-painter/current-execution-registry',database=registry+'/registry.sqlite';
 const expected=[[logical,true],[logical+'/.runtime',true],[logical+'/.runtime/ai-painter',true],[registry,true],
  [database,false],[database+'-wal',false],[database+'-shm',false]];
 assert.equal(ack.identities.length,expected.length);
 for(const [i,[p,directory]]of expected.entries()){
  const s=fs.lstatSync(inside(process.cwd(),p),{bigint:true}),id=ack.identities[i];
  assert.equal(id.path,p);assert.equal(id.directory,directory);assert.ok(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()));
  assert.equal(id.identity,`${s.dev}:${s.ino}`);
 }
 assert.equal(`${fs.lstatSync(root,{bigint:true}).dev}:${fs.lstatSync(root,{bigint:true}).ino}`,request.rootIdentity);
 writeKeeperJson(context.entryRoot+'/sqlite-keeper-consumed-'+name+'.json',{
  schema:'cpu-registry-fixture-keeper-consumed-v1',...context,name,root:logical,rootIdentity:request.rootIdentity,
  childRequest:binding,acknowledgement,identities:ack.identities,nativeAuthorityClaimed:false});
}
async function initializeIsolatedRegistry(root){
  await acquireRegistryKeeper(root);
 const candidate=fixtureWrite(root,'fixture/candidate.json',{schemaVersion:'stage4-post-decode-bounded-candidate-v1',status:'cpu_inactive_candidate_planned_not_implemented'});
 const terminal=fixtureWrite(root,'fixture/planning-terminal.json',{schemaVersion:'stage4-post-decode-failure-bounded-planning-terminal-v1',executionState:'completed',
  status:'bounded_candidate_planning_completed',planningRunId:'isolated-cpu-plan',nextAction:'cpu-fixture-only',candidate});
 const capsule=fixtureWrite(root,'fixture/planning-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v2',latestTerminal:terminal});
 const latest=fixtureWrite(root,'fixture/formal/phase-terminal.json',{schemaVersion:'stage4-post-decode-object-rgb-stage0-terminal-v1',executionState:'completed',
  status:'post_decode_object_rgb_stage0_real_visual_failure',runId:'isolated-historical-fixture'});
 fixtureWrite(root,'fixture/formal/execution-state.json',{status:'completed'});
 fixtureWrite(root,'fixture/formal/machine-review.json',{status:'fixture_only'});
 fixtureWrite(root,'fixture/formal/training-output/progress.json',{status:'fixture_only'});
 const initial=await initializeCurrentExecutionRegistry({projectRoot:root,currentTaskCapsulePath:capsule.path,currentTaskTerminalPath:terminal.path,
  currentCandidatePath:candidate.path,latestTrainingTerminalPath:latest.path,archivedEvidenceNamespaces:[]});
 assert.equal(initial.ok,true);return initial;
}
function registryOptions(root,f,initial,evidence,{state='completed',activeExecution=null}={}){
 const packageBinding=fixtureWrite(root,f.packageBinding.path,{fixtureKind:'isolated-package-not-production',runId:f.plan.runId});
 const terminal=fixtureWrite(root,'fixture/action-terminal.json',{...evidence,executionPackage:packageBinding});
 const capsule=fixtureWrite(root,'fixture/action-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',integrity:{status:'verified'},
  evidence:[{...terminal,kind:'actual_action_terminal',sha256Verified:true},{...packageBinding,kind:'isolated_execution_package',sha256Verified:true}]});
 return {projectRoot:root,capabilityVersion:CAPABILITY,packageId:f.plan.packageId,runId:f.plan.runId,taskId:f.plan.runId,
  taskKind:'ecology_gradient_failure_diagnostic',taskGoal:'CPU-only isolated registry contract verification; no production execution.',
  lifecycleStage:'dry_single_world_256x192',executionState:state,activity:state==='executing'?'diagnostic_gpu_qualification_pending':'diagnostic_fixture_terminal',
  queueStatus:state==='executing'?'running':state==='package_materialized'?'ready':state,
  nextMachineAction:state==='package_materialized'?f.plan.runId:null,taskCapsulePath:capsule.path,terminalEvidencePath:terminal.path,activeExecution,
  expectedPreviousRegistryRevision:initial.registry.registryRevision,expectedPreviousRegistrySha256:initial.registrySha256,
  _testHooks:{currentProcessIdentity:'explicit-isolated-cpu-writer'}};
}
function actualCpuProcessIdentity(){
 const command="$ErrorActionPreference='Stop'\n$p=Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = "+process.pid+"' -ErrorAction Stop\n$p.CreationDate.ToUniversalTime().ToString('o')";
 const result=process.platform==='win32'?spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000}):
  spawnSync('ps',['-o','lstart=','-p',String(process.pid)],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,String(result.stderr));return process.pid+':'+String(result.stdout).replace(/^\uFEFF/u,'').trim();
}
function activeCpuFixture(root,f){
 const identity={capabilityVersion:CAPABILITY,packageId:f.plan.packageId,runId:f.plan.runId,processId:process.pid,processStartIdentity:actualCpuProcessIdentity()};
 const runner='fixture/programs/adapter.mjs',raw=fs.readFileSync(path.resolve('scripts/run-ai-painter-ecology-regime-failure-capture.mjs'));
 fs.mkdirSync(path.dirname(path.resolve(root,runner)),{recursive:true});fs.writeFileSync(path.resolve(root,runner),raw,{flag:'wx'});
 const lock=fixtureWrite(root,'fixture/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity});
 const heartbeat=fixtureWrite(root,'fixture/heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,
  executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
 return {schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'executing',programLineage:{runner:{path:runner,sha256:actualSha(raw)}},
  lock,heartbeat:{path:heartbeat.path,ttlSeconds:120}};
}
async function publishPrepared(options){
 const prepared=await prepareCurrentExecutionRegistryAdvance(options);assert.equal(prepared.status,'prepared_not_published');
 const result=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:options.projectRoot,transactionId:prepared.transactionId,_testHooks:options._testHooks});
 assert.equal(result.ok,true);return result;
}
function recordRegistryProof(root,proof){
 fixtureWrite(root,'fixture-proof.json',{...proof,fixtureKind:'actual-isolated-registry-IO-and-SHA-not-production',projectRoot:root,
  publicRegistryCodeMocked:false,readerMocked:false,nativeCalls:0,gpuCalls:0,productionRegistryWrites:0});
}
test('real isolated registry rejects old or pending dispatch and accepts completed record with executing activity',async()=>{
 const s=simulatedPhases();await s.adapters.execute({heartbeat(){}});
 const dispatch=s.store.get(s.f.plan.outputRoot+'/dispatched.json'),root=isolatedRegistryRoot('dispatch'),initial=await initializeIsolatedRegistry(root);
 const before=fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),rejections=[];
 for(const state of [undefined,'qualification_pending','executing']){
  const body={...dispatch};if(state===undefined)delete body.executionState;else body.executionState=state;
  const options=registryOptions(root,s.f,initial,body,{state:'package_materialized'});
  await assert.rejects(prepareCurrentExecutionRegistryAdvance(options),/advanced_terminal_not_completed/u);rejections.push({state:state??'missing',error:'advanced_terminal_not_completed'});
  assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
 }
 const active=activeCpuFixture(root,s.f),options=registryOptions(root,s.f,initial,dispatch,{state:'executing',activeExecution:active});
 const accepted=await publishPrepared(options),read=await readCurrentExecutionRegistry(root);assert.equal(read.ok,true);
 assert.equal(read.registry.executionState,'executing');assert.equal(read.registry.activeExecution.executionState,'executing');
 assert.equal(read.currentTaskTerminal.executionState,'completed');assert.equal(read.currentTaskTerminal.completedAction,'execution_dispatch_record_only_not_training');
 assert.equal(read.currentTaskTerminal.trainingStarted,false);assert.equal(read.currentTaskTerminal.status,'qualification_pending');
 recordRegistryProof(root,{rejections,acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,activeExecutionState:read.registry.executionState,
  terminal:read.currentTaskTerminal,programSha256:active.programLineage.runner.sha256,processProbe:'actual-current-CPU-process'});
});
test('real isolated registry rejects incomplete finalization and tampered SHA then accepts diagnostic-only finalization',async()=>{
 const s=simulatedPhases();await s.adapters.execute({heartbeat(){}});await s.adapters.finalize({});
 const final=s.store.get(s.f.plan.outputRoot+'/finalization.json'),root=isolatedRegistryRoot('finalization'),initial=await initializeIsolatedRegistry(root);
 const before=fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),rejections=[];
 for(const state of [undefined,'executing']){
  const body={...final};if(state===undefined)delete body.executionState;else body.executionState=state;
  await assert.rejects(prepareCurrentExecutionRegistryAdvance(registryOptions(root,s.f,initial,body)),/advanced_terminal_not_completed/u);
  rejections.push({state:state??'missing',error:'advanced_terminal_not_completed'});assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
 }
 const tampered=registryOptions(root,s.f,initial,final);fs.appendFileSync(path.resolve(root,tampered.terminalEvidencePath),' ');
 await assert.rejects(prepareCurrentExecutionRegistryAdvance(tampered),/current_task_evidence_actual_action_terminal_hash_mismatch/u);
 assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
 const accepted=await publishPrepared(registryOptions(root,s.f,initial,final)),read=await readCurrentExecutionRegistry(root);assert.equal(read.ok,true);
 assert.equal(read.registry.activeExecution,null);assert.equal(read.currentTaskTerminal.executionState,'completed');assert.equal(read.currentTaskTerminal.diagnosticOnly,true);
 for(const flag of ['rootCauseConfirmed','qualificationGranted','checkpointPromotable','formalStage4QualificationAllowed','runtimePublicationAllowed'])assert.equal(read.currentTaskTerminal[flag],false);
 recordRegistryProof(root,{rejections,tamperedActualBytesRejected:true,acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,terminal:read.currentTaskTerminal});
});
test('real isolated registry accepts failed-closed evidence with exact diagnostic identity and original partial counts',async()=>{
 const s=simulatedPhases({failed:true});await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===s.primary);
 const failure=s.store.get(s.f.plan.outputRoot+'/execution-failure.json'),root=isolatedRegistryRoot('failure'),initial=await initializeIsolatedRegistry(root);
 const accepted=await publishPrepared(registryOptions(root,s.f,initial,failure,{state:'failed_closed'})),read=await readCurrentExecutionRegistry(root);assert.equal(read.ok,true);
 assert.equal(read.currentTaskTerminal.executionState,'failed_closed');assert.equal(read.currentTaskTerminal.runId,s.f.plan.runId);
 assert.equal(read.currentTaskTerminal.optimizerStepsGenerator,599);assert.equal(read.currentTaskTerminal.optimizerStepsDiscriminator,600);
 assert.equal(read.currentTaskTerminal.originalError.message,'synthetic primary G error');assert.equal(read.registry.activeExecution,null);
 assert.equal(read.currentTaskTerminal.formalStage4QualificationAllowed,false);assert.equal(read.currentTaskTerminal.runtimePublicationAllowed,false);
 recordRegistryProof(root,{acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,terminal:read.currentTaskTerminal});
});
test('simulated599G600D failure preserves original and clears only witnessed same call',async()=>{
 const s=simulatedPhases({failed:true});await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===s.primary);
 const record=s.store.get(s.f.plan.outputRoot+'/execution-failure.json');assert.equal(record.optimizerStepsGenerator,599);assert.equal(record.optimizerStepsDiscriminator,600);
 assert.equal(record.originalError.message,'synthetic primary G error');assert.equal(s.registryWrites.at(-1).executionState,'failed_closed');assert.equal(s.getRegistry().activeExecution,null);
});
test('simulated unknown cleanup retains active identity and concurrent dispatch does no work',async()=>{
 const unknown=simulatedPhases({unknownCleanup:true});await assert.rejects(unknown.adapters.execute({heartbeat(){}}));
 assert.notEqual(unknown.getRegistry().activeExecution,null);assert.equal(unknown.nativeCalls.length,1);
 const concurrent=simulatedPhases({concurrent:true});await assert.rejects(concurrent.adapters.execute({heartbeat(){}}),/concurrent/u);
 assert.equal(concurrent.nativeCalls.length,0);assert.equal(concurrent.registryWrites.length,0);
});

// These cases inspect real ordinary files. Link/race observations below are
// explicitly synthetic metadata; the three Python fixtures use real junctions.
function meterFixture(name){
 const component='.runtime/ai-painter/controller-parallel-20261011/training-cpu-negative-inputs/repair-t112';
 const ordinary=process.env.T_Q4_112_COMPONENT_ROOT??process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT;
 assert.ok(ordinary===component||(ordinary?.startsWith(OUTPUT_ROOT+'/')&&ordinary.endsWith('/cpu-entry')));
 const root=process.cwd(),layout=cpuNegativeInputLayout(ordinary+'/meter-fixtures/'+name);
 assert.equal(fs.existsSync(inside(root,layout.root)),false);
 for(const logical of [layout.root,...layout.links.map(v=>v.target),layout.root+'/program-project/scripts',layout.root+'/program-data/hot/runtime'])
  fs.mkdirSync(inside(root,logical),{recursive:true});
 return {root,layout,inspector:new CpuNegativeInputInspector(root,layout),physical:inside(root,layout.root)};
}
function syntheticLinkObservation(f,logical,target,action,{vanishes=false,identity=999n}={}){
 const parent=inside(f.root,path.posix.dirname(logical)),physical=path.join(parent,path.posix.basename(logical));
 const originals={lstatSync:fs.lstatSync,readdirSync:fs.readdirSync,readlinkSync:fs.readlinkSync};
 const stat={dev:1n,ino:identity,size:0n,isSymbolicLink:()=>true,isDirectory:()=>false,isFile:()=>false};
 const entry={name:path.basename(physical),isSymbolicLink:()=>true,isDirectory:()=>false,isFile:()=>false};
 fs.readdirSync=(p,...args)=>{const result=originals.readdirSync(p,...args);return String(p)===parent?[...result,entry]:result};
 fs.lstatSync=(p,...args)=>{if(String(p)===physical){if(vanishes)throw Object.assign(new Error('synthetic known-link removal'),{code:'ENOENT'});return stat}return originals.lstatSync(p,...args)};
 fs.readlinkSync=(p,...args)=>String(p)===physical?target:originals.readlinkSync(p,...args);
 try{return action()}finally{Object.assign(fs,originals)}
}
test('CPU inspection counts actual target files plus permanent48KiB and cannot mint cleanup authority',()=>{
 const f=meterFixture('count');fs.writeFileSync(inside(f.root,f.layout.links[0].target+'/a.bin'),Buffer.alloc(7));
 fs.writeFileSync(inside(f.root,f.layout.root+'/declaration.json'),'{}');
 const observation=f.inspector.scan();assert.equal(observation.actualFileBytes,9);assert.equal(observation.totalBytes,49161);
 assert.equal(observation.linkMetadataReserveBytes,CPU_LINK_RESERVE_BYTES);assert.equal(observation.reserveIsMeasurement,false);
 assert.equal(hasLiveCpuFixtureCleanup({phase:'cpu',cleanupConfirmed:true,cpuNegativeInputs:observation}),false);
 assert.throws(()=>f.inspector.scan({requireObserved:true}),/all three/u);
 const roots=[f.physical,inside(f.root,f.layout.links[0].target)];assert.equal(directoryBytes(roots[0]),9);
 // The reserve partitions the original ceiling; it is never a second quota.
 assertCpuNegativeInputBudget(observation.totalBytes,8*1024**2-observation.totalBytes,8*1024**2);
 assert.throws(()=>assertCpuNegativeInputBudget(observation.totalBytes,8*1024**2-observation.totalBytes+1,8*1024**2),/combined output/u);
 assert.throws(()=>assertCpuNegativeInputBudget(0,0,8*1024**2+1),/may not expand/u);
});
test('registered link metadata is not followed; cleanup incomplete and ordinary output still refuse',()=>{
 const f=meterFixture('known'),slot=f.layout.links[0],target=inside(f.root,slot.target);
 fs.writeFileSync(target+'/actual.bin',Buffer.alloc(11));
 syntheticLinkObservation(f,slot.path,target,()=>{
  const value=f.inspector.scan();assert.equal(value.actualFileBytes,11);assert.equal(value.totalBytes,49163);
  assert.equal(value.links[0].present,true);assert.throws(()=>f.inspector.scan({requireRemoved:true}),/cleanup incomplete/u);
  assert.throws(()=>directoryBytes(f.physical),/junction prohibited/u);
 });
 const removed=f.inspector.scan({requireRemoved:true});assert.equal(removed.totalBytes,49163);
 assert.equal(removed.links[0].present,false);assert.equal(removed.links[0].observedIdentity,'1:999');
 syntheticLinkObservation(f,slot.path,target,()=>assert.throws(()=>f.inspector.scan(),/reappeared/u));
});
test('unknown link, external target, file link and replaced link identity refuse without traversal',()=>{
 const f=meterFixture('refusal'),slot=f.layout.links[0],target=inside(f.root,slot.target);
 for(const wrong of [path.resolve('C:/outside-unread-target'),target+'/file.bin',target.toUpperCase()])
  syntheticLinkObservation(f,slot.path,wrong,()=>assert.throws(()=>f.inspector.scan(),/target differs/u));
 syntheticLinkObservation(f,f.layout.root+'/unknown-link',target,()=>assert.throws(()=>f.inspector.scan(),/unregistered/u));
 const stat={dev:1n,ino:1n,isSymbolicLink:()=>false};assert.throws(()=>validateCpuNegativeLink(slot.path,stat,target,target),/directory link/u);
 assert.throws(()=>validateCpuNegativeLink(slot.path,{...stat,isSymbolicLink:()=>true},target,target,'1:2'),/identity replaced/u);
});
test('known link ENOENT keeps reserve; unknown file disappearance is a failure',()=>{
 const f=meterFixture('vanish'),slot=f.layout.links[0],target=inside(f.root,slot.target);
 const observation=syntheticLinkObservation(f,slot.path,target,()=>f.inspector.scan(),{vanishes:true});
 assert.equal(observation.totalBytes,49152);assert.equal(observation.reserveIsMeasurement,false);
 const file=inside(f.root,f.layout.root+'/actual.bin');fs.writeFileSync(file,'preserved');f.inspector.scan();
 const original=fs.readdirSync;fs.readdirSync=(p,...args)=>{const entries=original(p,...args);return String(p)===f.physical?entries.filter(e=>e.name!=='actual.bin'):entries};
 try{assert.throws(()=>f.inspector.scan(),/ordinary CPU input file disappeared/u)}finally{fs.readdirSync=original}
 assert.equal(fs.readFileSync(file,'utf8'),'preserved');
});
test('target and root identity replacement metadata fail closed while real directories remain preserved',()=>{
 for(const kind of ['target','root']){
  const f=meterFixture('replace-'+kind),logical=kind==='root'?f.layout.root:f.layout.links[0].target;
  const physical=inside(f.root,logical),original=fs.lstatSync,identity=original(physical,{bigint:true}).ino;
  fs.lstatSync=(p,...args)=>{const stat=original(p,...args);if(String(p)!==physical)return stat;return new Proxy(stat,{get(value,key){return key==='ino'?value.ino+1n:typeof value[key]==='function'?value[key].bind(value):value[key]}})};
  try{assert.throws(()=>f.inspector.scan(),/identity replaced/u)}finally{fs.lstatSync=original}
  assert.equal(fs.lstatSync(physical,{bigint:true}).ino,identity);
 }
});
test('nested unknown redirect and disappearing ordinary IO refuse; stale markers grant no scope',()=>{
 const f=meterFixture('nested'),target=inside(f.root,f.layout.links[0].target);
 syntheticLinkObservation(f,f.layout.links[0].target+'/nested',target,()=>assert.throws(()=>f.inspector.scan(),/unregistered/u));
 fs.writeFileSync(inside(f.root,f.layout.root+'/old-marker.json'),JSON.stringify({cleanupConfirmed:true,phase:'cpu'}));
 const old={phase:'cpu',cleanupConfirmed:true,cpuNegativeInputs:{...f.inspector.scan(),fixtureLinksRemoved:true}};
 assert.equal(hasLiveOwnedProof(old),false);assert.equal(hasLiveCpuFixtureCleanup(old),false);
 const previous=process.env.AI_PAINTER_CPU_NEGATIVE_INPUTS_ALLOWED;process.env.AI_PAINTER_CPU_NEGATIVE_INPUTS_ALLOWED='true';
 try{assert.equal(hasLiveCpuFixtureCleanup(old),false)}finally{if(previous===undefined)delete process.env.AI_PAINTER_CPU_NEGATIVE_INPUTS_ALLOWED;else process.env.AI_PAINTER_CPU_NEGATIVE_INPUTS_ALLOWED=previous}
 const original=fs.lstatSync,file=inside(f.root,f.layout.root+'/old-marker.json');
 fs.lstatSync=(p,...args)=>{if(String(p)===file)throw Object.assign(new Error('synthetic ordinary file race'),{code:'ENOENT'});return original(p,...args)};
 try{assert.throws(()=>f.inspector.scan(),/vanished during accounting/u)}finally{fs.lstatSync=original}
 assert.equal(nativeBudget('qualification').outputBytes,16*1024**2);assert.throws(()=>nativeBudget('training',{root:f.root,plan:undefined}));
});

test('component declarations and exact-looking acknowledgements cannot mint native CPU cleanup authority',()=>{
 const component='.runtime/ai-painter/controller-parallel-20261011/training-cpu-negative-inputs/repair-t112';
 const declaration={schema:'cpu-negative-input-component-declaration-v1',callIdentity:'synthetic-current-component-call',
  request:bound(component+'/component-request.json'),layout:cpuNegativeInputLayout(component),nativeOwnerAllowed:false};
 const ack={schema:'cpu-negative-input-component-live-observation-v1',callIdentity:declaration.callIdentity,request:declaration.request,
  link:{...declaration.layout.links[0],present:true,observedIdentity:'123:456'},observedAtUtc:new Date().toISOString()};
 for(const value of [declaration,ack,{phase:'cpu',cleanupConfirmed:true,cpuNegativeInputs:{fixtureLinksRemoved:true},...ack}]){
  assert.equal(hasLiveOwnedProof(value),false);assert.equal(hasLiveCpuFixtureCleanup(value),false);
 }
});

test('full Windows identity metadata cannot grant native permission or replace retained inspector history',()=>{
 const f=meterFixture('windows-identity-marker'),actual=fs.lstatSync(f.physical,{bigint:true});
 const nodeIdentity=String(actual.dev)+':'+String(actual.ino);
 for(const pythonVolume of [actual.dev,actual.dev+2n**32n]){
  const marker={phase:'cpu',cleanupConfirmed:true,sameHandleIdentities:{nodeIdentity,
   pythonIdentity:String(pythonVolume)+':'+String(actual.ino)},cpuNegativeInputs:{fixtureLinksRemoved:true}};
  assert.equal(hasLiveOwnedProof(marker),false);assert.equal(hasLiveCpuFixtureCleanup(marker),false);
 }
 assert.throws(()=>f.inspector.scan({requireRemoved:true,requireObserved:true}),/all three/u);
});

test('CPU registry keeper rejects wrong current request call declaration and fixture path before IO',()=>{
 const context=registryKeeperContext(),value={schema:'cpu-registry-fixture-keeper-request-v1',callIdentity:context.callIdentity,
  request:context.request,declaration:context.declaration,name:'dispatch',root:context.entryRoot+'/registry-fixtures/dispatch',rootIdentity:'1:1'};
 // Structural examples are not fixture activation or native authority. The
 // actual parent independently revalidates bytes, identities and empty SQLite.
 for(const mutate of [v=>v.callIdentity='00000000-0000-0000-0000-000000000000',v=>v.request={...v.request,sha256:'0'.repeat(64)},
  v=>v.declaration={...v.declaration,path:context.entryRoot+'/old-declaration.json'},v=>v.name='unknown',
  v=>v.root=context.entryRoot+'/registry-fixtures/../outside',v=>v.rootIdentity='0:0',v=>v.nativeAuthorityClaimed=true]){
  const invalid=clone(value);mutate(invalid);assert.throws(()=>validateCpuRegistryFixtureLeaseRequest(context,invalid));
 }
 assert.equal(hasLiveOwnedProof(value),false);assert.equal(hasLiveCpuFixtureCleanup(value),false);
});

test('ordinary SQLite WAL disappearance still rejects strict output accounting',()=>{
 const f=meterFixture('ordinary-wal-disappearance'),file=path.join(f.physical,'registry.sqlite-wal');
 fs.writeFileSync(file,Buffer.alloc(17),{flag:'wx'});const before=directoryBytes(f.physical);assert.ok(before>=17);
 const original=fs.lstatSync;
 fs.lstatSync=(p,...args)=>{if(String(p)===file)throw Object.assign(new Error('synthetic ordinary WAL disappeared after directory enumeration'),{code:'ENOENT'});return original(p,...args)};
 try{assert.throws(()=>directoryBytes(f.physical),{code:'ENOENT'})}finally{fs.lstatSync=original}
 assert.equal(directoryBytes(f.physical),before);assert.equal(fs.readFileSync(file).length,17);
 const shm=path.join(f.physical,'registry.sqlite-shm');fs.writeFileSync(shm,Buffer.alloc(23),{flag:'wx'});
 const measuredSidecarBytes=fs.lstatSync(file).size+fs.lstatSync(shm).size,limit=8*1024**2;
 // Synthetic close arithmetic uses real retained fixture byte sizes. Actual
 // current-call SQLite close/persist guards are independently checked by the
 // shared parent lifecycle; no test deletes ordinary files or mints authority.
 for(const guardBytes of [0,113]){
  const fixed={streamBytes:211,guardBytes,linkReserveBytes:CPU_LINK_RESERVE_BYTES,reserveBytes:65536};
  const nearDisk=limit-cpuRegistryFixtureBudgetTotal({diskBytes:0,...fixed})-20;
  const beforeClose=cpuRegistryFixtureBudgetTotal({diskBytes:nearDisk,...fixed});
  const physicalAfter=nearDisk-measuredSidecarBytes;
  const retainedAfter=cpuRegistryFixtureBudgetTotal({diskBytes:physicalAfter,closedSidecarDebitBytes:measuredSidecarBytes,...fixed});
  assert.equal(retainedAfter,beforeClose);
  assertCpuNegativeInputBudget(cpuRegistryFixtureBudgetTotal({diskBytes:physicalAfter,...fixed}),21,limit);
  assert.throws(()=>assertCpuNegativeInputBudget(retainedAfter,21,limit),/combined output/u);
  const lateAllowed=limit-fixed.streamBytes-fixed.guardBytes-fixed.linkReserveBytes-fixed.reserveBytes-measuredSidecarBytes;
  assert.equal(cpuRegistryFixtureBudgetTotal({diskBytes:lateAllowed,closedSidecarDebitBytes:measuredSidecarBytes,...fixed}),limit);
  assert.throws(()=>assertCpuNegativeInputBudget(cpuRegistryFixtureBudgetTotal({diskBytes:lateAllowed+1,closedSidecarDebitBytes:measuredSidecarBytes,...fixed}),0,limit),/combined output/u);
 }
});
