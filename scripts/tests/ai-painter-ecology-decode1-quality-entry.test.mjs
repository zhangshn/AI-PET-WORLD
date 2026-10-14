import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {CURRENT_EXECUTION_REGISTRY_PATH,initializeCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,
 finalizePreparedCurrentExecutionRegistryAdvance,readCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs';
import * as reg from '../lib/ai-painter-ecology-decode1-quality-registration-v1.mjs';
import {ROLES,ORIGINAL_NATIVE_TESTS,ORIGINAL_REGISTRY,FROZEN_PLAN,finalProgramBindings,verifyHistoricalProgramBindings,historicalSourceBinding,historicalNativeTestBinding,verifyNativeTestRename,verifyCpuReport,validatePreparationNamespace,verifyProjectManifestTransition,
 inside,read as readBound,bind as fileBinding} from '../lib/ai-painter-ecology-decode1-quality-package-chain-v1.mjs';
import {createPhaseAdaptersForIsolatedTests,createPreparationAdaptersForIsolatedTests,parsePreparationArguments,verifyStoredGpuAcceptance,classifyPreparationFailure,preservePreparationCliFailure}
 from '../run-ai-painter-ecology-decode1-quality-v1.mjs';
import {nativeBudget,hasLiveOwnedProof,cleanupForCurrentCall,validateNativeReceipt,createNativeFailureProtocolFixtureForIsolatedTests,
 persistNativeFailureEvidence,withNativeReceiptBudget,withNativeOrdinaryBudget,boundedNativeFailureMetadata,validateCpuRegistryFixtureLeaseRequest,
 consumeNativeOwnerChunk,primaryErrorForControlStream}
 from '../lib/ai-painter-ecology-decode1-quality-owned-native-v1.mjs';
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex'),zero='0'.repeat(64),bound=p=>({path:p,sha256:zero});
const clone=structuredClone;
test('one incoming stream block counts every frame but performs one fresh accounting pass',()=>{
 let bytes=0,frames=0,scans=0;const errors=[];
 const callbacks={onFrame:line=>{assert.match(line,/^[OE]:/u);bytes+=Buffer.from(line.slice(2),'base64').length;frames++},
  onError:e=>errors.push(e),onOverflow:()=>assert.fail('unexpected overflow'),account:()=>{scans++;assert.equal(bytes,500)}};
 const input=Buffer.from(Array.from({length:100},()=> 'E:'+Buffer.from('abcde').toString('base64')+'\n').join(''));
 assert.equal(consumeNativeOwnerChunk('',input,callbacks),'');assert.equal(frames,100);assert.equal(bytes,500);assert.equal(scans,1);assert.deepEqual(errors,[]);
});
test('partial frames retain bytes until a complete frame; later blocks never reuse a disk total',()=>{
 const lines=[];let scans=0;const callbacks={onFrame:line=>lines.push(line),onError:e=>{throw e},onOverflow:()=>assert.fail('unexpected overflow'),account:()=>{scans++}};
 let pending=consumeNativeOwnerChunk('',Buffer.from('E:YQ'),callbacks);assert.equal(scans,0);
 pending=consumeNativeOwnerChunk(pending,Buffer.from('==\nO:Yg==\n'),callbacks);assert.equal(pending,'');assert.equal(scans,1);
 consumeNativeOwnerChunk('',Buffer.from('E:Yw==\n'),callbacks);assert.equal(scans,2);assert.deepEqual(lines,['E:YQ==','O:Yg==','E:Yw==']);
});
test('malformed frames, accounting failure and oversized pending data remain failures',()=>{
 const failures=[],primary=Error('actual-accounting-refusal');let overflow=0,scans=0;
 const pending=consumeNativeOwnerChunk('',Buffer.from('bad\n'+'x'.repeat(65537)),{
  onFrame:()=>{throw Error('actual-frame-refusal')},onError:e=>failures.push(e),onOverflow:()=>overflow++,account:()=>{scans++;throw primary}});
 assert.equal(pending,'');assert.equal(overflow,1);assert.equal(scans,1);assert.equal(failures[0].message,'actual-frame-refusal');assert.equal(failures[1],primary);
});
test('every decoded byte is charged before an unchanged output ceiling is tested',()=>{
 let bytes=0,stops=0;consumeNativeOwnerChunk('',Buffer.from('O:YWFh\nE:YmJi\n'),{
  onFrame:line=>{bytes+=Buffer.from(line.slice(2),'base64').length},onError:e=>{throw e},onOverflow:()=>assert.fail('unexpected overflow'),
  account:()=>{const actualDiskBytes=5,unchangedCeiling=10;if(actualDiskBytes+bytes>unchangedCeiling)stops++}});
 assert.equal(bytes,6);assert.equal(stops,1);
});
test('EPIPE after a known stop cannot replace the original timeout or resource reason',()=>{
 const pipe=Object.assign(Error('write EPIPE'),{code:'EPIPE'});
 for(const reason of ['wall_timeout','cleanup_deadline','output_budget']){
  const primary=primaryErrorForControlStream(null,reason,pipe);assert.equal(boundedNativeFailureMetadata(primary).reason,reason);assert.notEqual(primary,pipe);
 }
 const original=Error('original computation error');assert.equal(primaryErrorForControlStream(original,'wall_timeout',pipe),original);
 assert.equal(primaryErrorForControlStream(null,null,pipe),pipe);assert.equal(primaryErrorForControlStream(null,'untrusted_secret_marker',pipe),pipe);
});
// The owning CPU harness supplies this exact namespace. These are the existing
// three real registry/SQLite cases, not mocked registry writes or model tests.
// Component-only invocations do not claim the retained native handshake.
const ownedCpuEntry=process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT;
function cpuRegistryContext(){
 assert.ok(ownedCpuEntry?.startsWith(reg.OUTPUT_ROOT+'/')&&ownedCpuEntry.endsWith('/cpu-entry'),'exact owned CPU fixture root');
 const root=process.cwd(),declaration=fileBinding(root,ownedCpuEntry.replace(/\/cpu-entry$/u,'')+'/cpu-negative-inputs/input-declaration.json');
 const body=JSON.parse(readBound(root,declaration)),request=body.request,current=JSON.parse(readBound(root,request));
 assert.equal(body.schema,'cpu-negative-input-declaration-v1');assert.equal(current.schema,'ecology-decode1-weight-quality-cpu-request-v1');
 assert.equal(current.outputRoot,ownedCpuEntry);assert.deepEqual(current.programBindings,body.programBindings);
 assert.equal(body.runId,current.runId);assert.equal(body.packageId,current.packageId);
 return {entryRoot:ownedCpuEntry,request,declaration,callIdentity:body.callIdentity};
}
function cpuKeeperWrite(logical,value){
 const raw=Buffer.from(JSON.stringify(value)+'\n');assert.ok(raw.length<=8192);
 const fd=fs.openSync(inside(process.cwd(),logical),'wx');try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
 return {path:logical,sha256:digest(raw)};
}
function isolatedRegistryRoot(name){
 assert.ok(['dispatch','finalization','failure'].includes(name));cpuRegistryContext();
 const logical=ownedCpuEntry+'/registry-fixtures/'+name,root=path.resolve(logical);
 assert.equal(fs.existsSync(root),false,'old registry fixture refused');fs.mkdirSync(root,{recursive:true});return root;
}
async function acquireRegistryKeeper(root){
 const context=cpuRegistryContext(),logical=path.relative(process.cwd(),root).replaceAll('\\','/'),name=path.basename(root);
 const stat=fs.lstatSync(root,{bigint:true});assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
 const request={schema:'cpu-registry-fixture-keeper-request-v1',...context,name,root:logical,rootIdentity:`${stat.dev}:${stat.ino}`};
 delete request.entryRoot;validateCpuRegistryFixtureLeaseRequest(context,request);
 const binding=cpuKeeperWrite(context.entryRoot+'/sqlite-keeper-request-'+name+'.json',request);
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
 cpuKeeperWrite(context.entryRoot+'/sqlite-keeper-consumed-'+name+'.json',{
  schema:'cpu-registry-fixture-keeper-consumed-v1',...context,name,root:logical,rootIdentity:request.rootIdentity,
  childRequest:binding,acknowledgement,identities:ack.identities,nativeAuthorityClaimed:false});
}
function fixtureWrite(root,logical,value){
 const target=path.resolve(root,logical),relative=path.relative(root,target);
 assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative));fs.mkdirSync(path.dirname(target),{recursive:true});
 const raw=Buffer.from(JSON.stringify(value)+'\n');fs.writeFileSync(target,raw);return {path:logical,sha256:digest(raw)};
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
 return {projectRoot:root,capabilityVersion:reg.CAPABILITY,packageId:f.plan.packageId,runId:f.plan.runId,taskId:f.plan.runId,
  taskKind:'ecology_gradient_failure_diagnostic',taskGoal:'CPU-only isolated registry contract verification; no production execution.',
  lifecycleStage:'dry_single_world_256x192',executionState:state,activity:state==='executing'?'diagnostic_gpu_qualification_pending':'diagnostic_fixture_terminal',
  queueStatus:state==='executing'?'running':state==='package_materialized'?'ready':state,
  nextMachineAction:state==='package_materialized'?f.plan.runId:null,taskCapsulePath:capsule.path,terminalEvidencePath:terminal.path,activeExecution,
  expectedPreviousRegistryRevision:initial.registry.registryRevision,expectedPreviousRegistrySha256:initial.registrySha256,
  _testHooks:{currentProcessIdentity:'explicit-isolated-cpu-writer'}};
}
function activeCpuFixture(root,f){
 const command="$ErrorActionPreference='Stop'\n$p=Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = "+process.pid+"' -ErrorAction Stop\n$p.CreationDate.ToUniversalTime().ToString('o')";
 const probe=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000});
 assert.equal(probe.status,0,String(probe.stderr));const processStartIdentity=process.pid+':'+String(probe.stdout).replace(/^\uFEFF/u,'').trim();
 const identity={capabilityVersion:reg.CAPABILITY,packageId:f.plan.packageId,runId:f.plan.runId,processId:process.pid,processStartIdentity};
 const runner='fixture/programs/adapter.mjs',raw=fs.readFileSync(path.resolve('scripts/run-ai-painter-ecology-decode1-quality-v1.mjs'));
 fs.mkdirSync(path.dirname(path.resolve(root,runner)),{recursive:true});fs.writeFileSync(path.resolve(root,runner),raw,{flag:'wx'});
 const lock=fixtureWrite(root,'fixture/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity});
 const heartbeat=fixtureWrite(root,'fixture/heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,
  executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
 return {schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'executing',programLineage:{runner:{path:runner,sha256:digest(raw)}},
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
if(ownedCpuEntry){
 test('real owned CPU registry dispatch preserves exact process and completed dispatch evidence',async()=>{
  const s=simulated();await s.adapters.execute({heartbeat(){}});
  const dispatch=s.store.get(s.f.plan.outputRoot+'/dispatched.json'),root=isolatedRegistryRoot('dispatch'),initial=await initializeIsolatedRegistry(root);
  assert.ok(dispatch);const before=fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),rejections=[];
  for(const state of [undefined,'qualification_pending','executing']){
   const body={...dispatch};if(state===undefined)delete body.executionState;else body.executionState=state;
   await assert.rejects(prepareCurrentExecutionRegistryAdvance(registryOptions(root,s.f,initial,body,{state:'package_materialized'})),/advanced_terminal_not_completed/u);
   rejections.push(state??'missing');assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
  }
  const active=activeCpuFixture(root,s.f),accepted=await publishPrepared(registryOptions(root,s.f,initial,dispatch,{state:'executing',activeExecution:active}));
  const read=await readCurrentExecutionRegistry(root);assert.equal(read.ok,true);assert.equal(read.registry.executionState,'executing');
  assert.equal(read.registry.activeExecution.executionState,'executing');assert.equal(read.currentTaskTerminal.executionState,'completed');
  assert.equal(read.currentTaskTerminal.trainingStarted,false);
  recordRegistryProof(root,{rejections,acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,terminal:read.currentTaskTerminal});
 });
 test('real owned CPU registry finalization rejects incomplete state and changed terminal bytes',async()=>{
  const f=fixture(),root=isolatedRegistryRoot('finalization'),initial=await initializeIsolatedRegistry(root);
  const final={schema:'ecology-decode1-weight-quality-review-terminal-v1',status:'dry_single_world_review_passed',executionState:'completed',
   capabilityVersion:reg.CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,formalStage4QualificationGranted:false,runtimePublicationGranted:false};
  const before=fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH));
  for(const state of [undefined,'executing']){
   const body={...final};if(state===undefined)delete body.executionState;else body.executionState=state;
   await assert.rejects(prepareCurrentExecutionRegistryAdvance(registryOptions(root,f,initial,body)),/advanced_terminal_not_completed/u);
   assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
  }
  const tampered=registryOptions(root,f,initial,final);fs.appendFileSync(path.resolve(root,tampered.terminalEvidencePath),' ');
  await assert.rejects(prepareCurrentExecutionRegistryAdvance(tampered),/current_task_evidence_actual_action_terminal_hash_mismatch/u);
  assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
  const accepted=await publishPrepared(registryOptions(root,f,initial,final)),read=await readCurrentExecutionRegistry(root);
  assert.equal(read.ok,true);assert.equal(read.registry.activeExecution,null);assert.equal(read.currentTaskTerminal.executionState,'completed');
  for(const flag of ['formalStage4QualificationGranted','runtimePublicationGranted'])assert.equal(read.currentTaskTerminal[flag],false);
  recordRegistryProof(root,{tamperedActualBytesRejected:true,acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,terminal:read.currentTaskTerminal});
 });
 test('real owned CPU registry preserves failed terminal and separate partial update counts',async()=>{
  const f=fixture(),root=isolatedRegistryRoot('failure'),initial=await initializeIsolatedRegistry(root);
  const failure={...completed(f),status:'failed_closed',executionState:'failed_closed',optimizerSteps:{generator:575,discriminator:576},optimizerStepsGenerator:575,optimizerStepsDiscriminator:576,
   originalError:{message:'synthetic primary G error'},formalStage4QualificationAllowed:false,runtimePublicationAllowed:false};
  const accepted=await publishPrepared(registryOptions(root,f,initial,failure,{state:'failed_closed'})),read=await readCurrentExecutionRegistry(root);
  assert.equal(read.ok,true);assert.equal(read.registry.activeExecution,null);assert.equal(read.currentTaskTerminal.executionState,'failed_closed');
  assert.equal(read.currentTaskTerminal.optimizerStepsGenerator,575);assert.equal(read.currentTaskTerminal.optimizerStepsDiscriminator,576);
  assert.deepEqual(read.currentTaskTerminal.optimizerSteps,{generator:575,discriminator:576});
  assert.equal(read.currentTaskTerminal.originalError.message,'synthetic primary G error');
  assert.equal(read.currentTaskTerminal.formalStage4QualificationAllowed,false);assert.equal(read.currentTaskTerminal.runtimePublicationAllowed,false);
  recordRegistryProof(root,{acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,terminal:read.currentTaskTerminal});
 });
}
test('historical registry source keeps exact pre-repair bytes and live registry is a separate current role',()=>{
 const snapshot=fs.readFileSync(ORIGINAL_REGISTRY.path);
 assert.equal(digest(snapshot),ORIGINAL_REGISTRY.sha256);
 assert.equal(ROLES.currentExecutionRegistry,'src/server/ai-painter-current-execution-registry.mjs');
 const original={path:ROLES.currentExecutionRegistry,sha256:ORIGINAL_REGISTRY.sha256};
 assert.deepEqual(historicalSourceBinding('source-19',original),ORIGINAL_REGISTRY);
 assert.equal(historicalSourceBinding('source-18',original),original);
 assert.throws(()=>historicalSourceBinding('source-19',{...original,sha256:zero}));
 assert.throws(()=>historicalSourceBinding('source-19',{...original,path:'scripts/foreign.mjs'}));
 assert.notEqual(digest(fs.readFileSync(ROLES.currentExecutionRegistry)),ORIGINAL_REGISTRY.sha256);
});
test('full plan historical closure agrees with final collection and refuses old live-path aliases',()=>{
 const frozen=JSON.parse(fs.readFileSync(FROZEN_PLAN.path)).programBindings;
 const programs=finalProgramBindings(process.cwd()),manifest=programs['frozen-source-137'];
 assert.equal(verifyHistoricalProgramBindings(frozen,programs,manifest),true);
 for(const change of [p=>p['frozen-source-19']=frozen['source-19'],
  p=>delete p['frozen-source-19'],p=>p['frozen-source-19']=p.currentExecutionRegistry,
  p=>p['frozen-source-151']=frozen['source-151']]){
  const changed=clone(programs);change(changed);
  assert.throws(()=>verifyHistoricalProgramBindings(frozen,changed,manifest),/old role omitted\/changed/u);
 }
 assert.throws(()=>verifyHistoricalProgramBindings({...frozen,extra:frozen['source-19']},programs,manifest),/exact historical source count/u);
});
test('historical native tests keep exact old bytes; current change is only four identifier renames',()=>{
 const original=fs.readFileSync(ORIGINAL_NATIVE_TESTS.path),current=fs.readFileSync(ROLES.currentLegacyNativeTests);
 assert.equal(digest(original),ORIGINAL_NATIVE_TESTS.sha256);assert.equal(verifyNativeTestRename(original,current),true);
 const old={path:ROLES.currentLegacyNativeTests,sha256:ORIGINAL_NATIVE_TESTS.sha256};
 for(const role of ['source-151','nativeTests'])assert.deepEqual(historicalNativeTestBinding(role,old),ORIGINAL_NATIVE_TESTS);
 assert.equal(historicalNativeTestBinding('source-150',old),old);
 assert.throws(()=>historicalNativeTestBinding('source-151',{...old,sha256:zero}));
 assert.throws(()=>historicalNativeTestBinding('nativeTests',{...old,path:'scripts/foreign.mjs'}));
 assert.throws(()=>verifyNativeTestRename(original,original));
 assert.throws(()=>verifyNativeTestRename(original,Buffer.concat([current,Buffer.from('\n// unrelated change')])));
});
// Historical metadata supplies only an ordered graph shape to an explicitly
// synthetic protocol fixture. No factory computation or model qualification.
function fixture(){
 const source=JSON.parse(fs.readFileSync(reg.CANDIDATE.path,'utf8'));
 const graph=JSON.parse(fs.readFileSync('.runtime/ai-painter/ecology-execution-auth-t-q4-71/cpu/model-identity.json','utf8')).graph;
 const model={capabilityVersion:reg.CAPABILITY,modelCapabilityVersion:reg.MODEL_CAPABILITY,architecture:reg.ARCHITECTURE,numericRule:reg.NUMERIC_RULE,graph,
  initialState:{generator:zero,discriminator:zero}};
 const runId='ns003-synthetic-run-01',packageId='ns003-synthetic-package-01',outputRoot=reg.OUTPUT_ROOT+'/'+runId;
 const programs=Object.fromEntries(Array.from({length:179},(_,i)=>['frozen-role-'+i,bound('scripts/synthetic/'+i+'.mjs')]));
 for(const [role,p]of Object.entries(ROLES))programs[role]=bound(p);
 const plan={schema:reg.PLAN_SCHEMA,executionProfile:reg.EXECUTION_PROFILE,executionMode:'bounded-quality-training',capabilityVersion:reg.CAPABILITY,
  runId,packageId,outputRoot,formalSpecification:reg.SPECIFICATION,sourceCandidate:reg.CANDIDATE,configuration:reg.deriveConfiguration(source),
  programBindings:programs,modelBinding:bound(outputRoot+'/model-identity.json'),finalCpuAcceptance:bound(outputRoot+'/cpu-acceptance.json'),
  datasetManifest:source.frozenBindings.datasetManifest,trainSplit:source.frozenBindings.trainSplit,validationSplit:source.frozenBindings.validationSplit,
  historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,runtimeIdentity:{python:{absolutePath:path.resolve('synthetic/python.exe'),sha256:zero},node:{absolutePath:process.execPath,sha256:zero}}};
 const packageBinding=bound('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json');
 const input={plan,packageBinding,planBinding:bound(outputRoot+'/quality-plan.json'),modelBinding:plan.modelBinding,modelIdentity:model};
 return {root:process.cwd(),source,plan,packageBinding,input,model};
}
function completed(f){const checkpoint={epoch:12,counts:{generator:576,discriminator:576},checkpoint:bound(f.plan.outputRoot+'/checkpoint-12.pt'),
 selection:{epoch:12,worstApplicableObjectCorrelation:.1,meanValidationRgbMae:.2,rank:[.1,-.2,-12],qualificationGranted:false,checkpointPromotionEligible:false}};
 return {schema:'ecology-decode1-weight-quality-worker-terminal-v1',executionProfile:reg.EXECUTION_PROFILE,status:'training_completed_review_pending',executionState:'completed',
  capabilityVersion:reg.CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,executionPackage:f.packageBinding,
  optimizerSteps:{generator:576,discriminator:576},optimizerStepsGenerator:576,optimizerStepsDiscriminator:576,completedEpochs:12,checkpoints:[checkpoint],
  selectedCheckpointRecord:clone(checkpoint),checkpointReloadVerified:true,checkpointSelectionExecuted:true,validationRgbRead:true,captureStatus:'capture_not_triggered',originalError:null,
  challengeContentRead:false,regressionContentRead:false,checkpointPromotable:false,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false,automaticRetries:0};}

test('new exact identity and presentation retain bounds and grant no qualification',()=>{const f=fixture();reg.validate(f.input);const p=reg.createPresentation(f.input);
 assert.equal(p.trainingAllowed,false);assert.equal(p.gpuQualified,false);assert.equal(p.checkpointPromotable,false);assert.equal(p.trainingPlan.epochs,12);
 assert.equal(p.trainingPlan.generatorOptimizerSteps,576);assert.equal(p.resourceBudget.maxWallSeconds,2700);});
for(const [name,change]of [
 ['old execution capability',f=>f.plan.capabilityVersion='stage4_mvp256_dry_factorized_ecology_quality_v1'],
 ['old model capability',f=>f.model.modelCapabilityVersion='stage4_mvp256_dry_factorized_ecology_v1'],
 ['old numeric rule',f=>f.model.numericRule=f.model.numericRule.split('|').slice(0,-1).join('|')],
 ['wrong target shape',f=>f.model.graph[52].shape=[48,48,1,1]],
 ['wrong graph order',f=>[f.model.graph[0],f.model.graph[52]]=[f.model.graph[52],f.model.graph[0]]],
 ['wrong spec binding',f=>f.plan.formalSpecification={...reg.SPECIFICATION,sha256:zero}],
 ['wrong candidate binding',f=>f.plan.sourceCandidate={...reg.CANDIDATE,sha256:zero}],
 ['foreign model path',f=>f.plan.modelBinding=bound('.runtime/foreign/model-identity.json')],
 ['training budget expansion',f=>f.plan.configuration.executionCeiling.maxWallSeconds=4200],
 ['checkpoint selection expansion',f=>f.plan.configuration.checkpointSelection.eligibleEpochs=[6,12]],
 ['source role expansion',f=>{for(let i=0;i<257;i++)f.plan.programBindings['extra-'+i]=bound('scripts/extra/'+i+'.mjs')}],
 ['historical checkpoint initialization',f=>f.plan.historicalCheckpointMayInitialize=true],
 ['automatic training restart',f=>f.plan.trainingRestartAllowed=true]
])test('refuses '+name,()=>{const f=fixture();change(f);assert.throws(()=>reg.validate(f.input));});
test('wrong source candidate and resolution refuse before configuration derivation',()=>{const f=fixture();f.source.capabilityVersion=reg.CAPABILITY;assert.throws(()=>reg.deriveConfiguration(f.source));
 const next=fixture();next.source.scope.resolution=[512,384];assert.throws(()=>reg.deriveConfiguration(next.source));});
test('checkpoint completion requires epoch12/full576/exactreload and immutable selection',()=>{const f=fixture(),body=completed(f);reg.validateTerminal(body,f.packageBinding,f.plan);
 for(const mutate of [v=>v.checkpoints[0].epoch=11,v=>v.optimizerSteps.generator=575,v=>v.checkpointReloadVerified=false,v=>v.checkpoints[0].checkpoint.path='.runtime/foreign/checkpoint.pt']){
  const bad=clone(body);mutate(bad);assert.throws(()=>reg.validateTerminal(bad,f.packageBinding,f.plan));}});
test('failed terminal preserves separate partialD/G counters without qualification',()=>{const f=fixture(),body=completed(f);Object.assign(body,{status:'failed_closed',executionState:'failed_closed',
 optimizerSteps:{generator:575,discriminator:576},optimizerStepsGenerator:575,captureStatus:'capture_incomplete',originalError:{message:'synthetic G fault'}});
 reg.validateTerminal(body,f.packageBinding,f.plan);assert.equal(body.optimizerStepsDiscriminator,576);});
test('native phase budgets are strict and forged booleans cannot supply a live proof',()=>{assert.equal(nativeBudget('cpu').timeoutMs,240000);assert.equal(nativeBudget('cpu').outputBytes,8388608);
 for(const phase of ['qualification','training','review','unknown'])assert.throws(()=>nativeBudget(phase));
 const forged={cleanupConfirmed:true,processCleanupConfirmed:true,proof:{activeProcessesAfterCleanup:0}};
 assert.equal(hasLiveOwnedProof(forged),false);assert.equal(cleanupForCurrentCall({ownedReceipt:forged},null),false);
 assert.equal(validateNativeReceipt({proof:forged.proof,ownerClosed:true}),false);});
test('versioned CLI accepts only preparation or qualification and rejects start/execute/overrides',()=>{const prefix=['--protocol','ecology-decode1-weight-quality-entry-v1'];
 assert.equal(parsePreparationArguments([...prefix,'prepare-only','--run','synthetic-run-01','--package-id','synthetic-package-01']).mode,'prepare-only');
 assert.equal(parsePreparationArguments([...prefix,'qualify-only','--package','.runtime/ai-painter/autonomous-closed-loop-packages/synthetic-package-01/package.json','--sha256',zero]).mode,'qualify-only');
 for(const args of [[...prefix,'execute'],[...prefix,'start'],[...prefix,'prepare-only','--run','synthetic-run-01','--run','synthetic-run-02'],[...prefix,'qualify-only','--package','../bad','--sha256',zero]])assert.throws(()=>parsePreparationArguments(args));
 const child=spawnSync(process.execPath,['scripts/run-ai-painter-ecology-decode1-quality-v1.mjs','--help'],{windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:4096});
 assert.equal(child.status,0);assert.match(child.stdout,/Both stop before training/);});

function simulated({unknownCleanup=false,gpuFailure=false,active=false,invalidStored=false,cpuPreflightFailure=false}={}){
 const f=fixture(),store=new Map(),live=new WeakSet(),nativeCalls=[],registryWrites=[];let current={registryRevision:409,activeExecution:active?{synthetic:true}:null};let terminal=null;
 const put=(root,p,v)=>{assert.equal(store.has(p),false,'exclusive duplicate fixture write');store.set(p,clone(v));return bound(p)};
 const adapters=createPhaseAdaptersForIsolatedTests({loadContext:()=>f,write:put,json:(r,b)=>{assert.ok(store.has(b.path));return clone(store.get(b.path))},
  bind:(r,p)=>{assert.ok(store.has(p));return bound(p)},inside:(r,p)=>path.resolve(r,p),read:()=>Buffer.from('synthetic'),processIdentity:()=> 'synthetic-process-creation',
  readRegistry:async()=>({ok:true,registry:clone(current),registrySha256:zero,currentTaskTerminal:clone(terminal)}),
  advanceRegistry:async options=>{registryWrites.push(clone(options));current={...current,registryRevision:current.registryRevision+1,activeExecution:options.activeExecution,
   capabilityVersion:options.capabilityVersion,packageId:options.packageId,runId:options.runId};terminal=clone(store.get(options.terminalEvidencePath));return {ok:true}},
  withNativeOrdinaryBudget:async(r,p,action)=>action(),withNativeReceiptBudget:async(r,p,action)=>action(),
  hasGpuAcceptance:()=>store.has(f.plan.outputRoot+'/gpu-acceptance.json'),hasConsumedQualification:()=>store.has(f.plan.outputRoot+'/qualification-consumed.json'),
  hasOwnPreflight:()=>store.has(f.plan.outputRoot+'/preflight.json'),verifyStoredPreflight:()=>({fixtureKind:'explicit-private-preflight-validation-stub'}),
  hasLiveOwnedProof:p=>live.has(p),cleanupForCurrentCall:(error,last)=>live.has(Object.hasOwn(error,'ownedReceipt')?error.ownedReceipt:last),
  verifyGpuOutcome:()=>({fixtureKind:'simulated-protocol-no-GPU'}),verifyStoredGpuAcceptance:()=>{assert.equal(invalidStored,false,'untrusted stored GPU receipt')},
  runNative:async options=>{nativeCalls.push(options);const receipt={fixtureKind:'explicit-private-stub-not-native',outputAccountingRoots:[f.plan.outputRoot]};if(options.phase==='cpu'||!unknownCleanup)live.add(receipt);
   if(options.phase==='cpu'){if(cpuPreflightFailure)throw Error('synthetic own CPU preflight failure');return {stdout:JSON.stringify({status:'own_quality_entry_preflight_passed_not_gpu_qualified',gpuInitialized:false}),ownedReceipt:receipt,receiptBinding:bound(f.plan.outputRoot+'/owned-preflight.json')}}
   if(options.phase==='qualification'){if(gpuFailure){const e=Error('synthetic gate failure');e.ownedReceipt=receipt;throw e;}return {stdout:JSON.stringify(bound(f.plan.outputRoot+'/gpu-gate.json')),ownedReceipt:receipt,receiptBinding:bound(f.plan.outputRoot+'/owned-gpu.json')}}
   assert.equal(options.phase,'training');const body=completed(f),binding=put(f.root,f.plan.outputRoot+'/worker-terminal.json',body);
   return {stdout:JSON.stringify(binding),ownedReceipt:receipt,receiptBinding:bound(f.plan.outputRoot+'/owned-train.json')};}
 });return {f,store,adapters,nativeCalls,registryWrites,getCurrent:()=>current};
}
test('qualify-only uses exactly qualifier stub; no worker/optimizer/checkpoint or training terminal',async()=>{const s=simulated(),out=await s.adapters.qualifyOnly({heartbeat(){}});
 assert.equal(s.store.get(s.f.plan.outputRoot+'/qualification-dispatched.json').status,'qualification_pending');
 assert.equal(s.registryWrites[0].activity,'diagnostic_gpu_qualification_pending');
 assert.equal(out.trainingStarted,false);assert.equal(out.optimizerSteps,0);assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification']);
 assert.equal(s.nativeCalls[1].args[1],path.resolve(s.f.root,ROLES.gpuQualifier));assert.equal(s.store.has(s.f.plan.outputRoot+'/worker-terminal.json'),false);
 assert.equal(s.store.get(s.f.plan.outputRoot+'/package.json').schemaVersion,'ai-painter-current-training-package-v1');
 assert.equal(s.store.has(s.f.plan.outputRoot+'/execution-consumed.json'),false);assert.equal(s.registryWrites.at(-1).activeExecution,null);
 assert.equal(s.registryWrites.at(-1).latestTrainingTerminal,undefined);assert.equal(s.getCurrent().registryRevision,411);
 assert.equal(s.registryWrites.at(-1).taskKind,'ecology_decode1_weight_readonly_gpu_qualification');assert.match(s.registryWrites.at(-1).taskGoal,/zero optimizer updates/);
 await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}),/twice/);assert.equal(s.nativeCalls.length,2);});
test('same-package explicit execution uses trusted stored gate and does not run qualifier twice',async()=>{const s=simulated();await s.adapters.qualifyOnly({heartbeat(){}});
 await s.adapters.execute({heartbeat(){}});assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification','training']);
 const dispatch=s.store.get(s.f.plan.outputRoot+'/dispatched.json');assert.equal(dispatch.status,'training_pending');assert.equal(dispatch.trainingStarted,false);
 assert.equal(s.registryWrites[2].activity,'training_pending');assert.equal(s.registryWrites.at(-1).activity,'training_completed_review_pending');
 assert.ok(s.store.has(s.f.plan.outputRoot+'/qualification-lock.json'));assert.ok(s.store.has(s.f.plan.outputRoot+'/execution-lock.json'));
 await assert.rejects(s.adapters.execute({heartbeat(){}}));assert.equal(s.nativeCalls.length,3);});
test('combined qualification and training completion records the actual worker terminal, not a diagnostic',async()=>{
 const s=simulated();await s.adapters.preflight({heartbeat(){}});await s.adapters.execute({heartbeat(){}});
 assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification','training']);
 assert.equal(s.store.get(s.f.plan.outputRoot+'/dispatched.json').status,'qualification_pending');
 assert.equal(s.registryWrites[0].activity,'diagnostic_gpu_qualification_pending');
 assert.equal(s.registryWrites.at(-1).activity,'training_completed_review_pending');
 assert.equal(s.registryWrites.at(-1).latestTrainingTerminal.status,'training_completed_review_pending');
});
test('invalid stored GPU proof blocks explicit execution before worker and consumption',async()=>{const s=simulated({invalidStored:true});await s.adapters.qualifyOnly({heartbeat(){}});
 await assert.rejects(s.adapters.execute({heartbeat(){}}),/untrusted/);assert.equal(s.nativeCalls.length,2);assert.equal(s.store.has(s.f.plan.outputRoot+'/execution-consumed.json'),false);});
test('gate failure closes without automatic retry; consumed failed qualification cannot enter execute',async()=>{const s=simulated({gpuFailure:true});
 await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}));assert.equal(s.nativeCalls.length,2);assert.equal(s.registryWrites.at(-1).executionState,'failed_closed');
 await assert.rejects(s.adapters.execute({heartbeat(){}}),/cannot retry/);assert.equal(s.nativeCalls.length,2);});
test('unknown live cleanup leaves active identity retained and cannot sign qualification',async()=>{const s=simulated({unknownCleanup:true});await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}));
 assert.equal(s.registryWrites.length,1);assert.ok(s.getCurrent().activeExecution);assert.equal(s.store.has(s.f.plan.outputRoot+'/gpu-acceptance.json'),false);});
test('concurrent active execution refuses before any native stub or writes',async()=>{const s=simulated({active:true});await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}),/concurrent/);
 assert.equal(s.nativeCalls.length,0);assert.equal(s.store.size,0);});
test('own CPU preflight failure prevents qualifier and is not retried; exact accepted preflight can be rechecked',async()=>{const failed=simulated({cpuPreflightFailure:true});
 await assert.rejects(failed.adapters.qualifyOnly({heartbeat(){}}));assert.deepEqual(failed.nativeCalls.map(v=>v.phase),['cpu']);
 await assert.rejects(failed.adapters.qualifyOnly({heartbeat(){}}));assert.equal(failed.nativeCalls.length,1);
 const ok=simulated();await ok.adapters.preflight({heartbeat(){}});await ok.adapters.preflight({heartbeat(){}});assert.deepEqual(ok.nativeCalls.map(v=>v.phase),['cpu']);});
test('CLI refusal classifies concrete safe reasons and never echoes unknown secret text or writes invalid scope',async()=>{const marker='synthetic-secret-cookie-csrf-must-not-echo';
 const refused=await preservePreparationCliFailure({request:null,ready:null,error:Error(marker)});assert.equal(JSON.stringify(refused).includes(marker),false);
 assert.equal(classifyPreparationFailure(Object.assign(Error('private filesystem failure'),{code:'EACCES'}),'preparation').errorCode,'decode1_preparation_io_eacces');
 assert.equal(classifyPreparationFailure(Error('local_v2_deployment_key_missing'),'preparation').errorCode,'decode1_preparation_stable_configuration_key_missing');});

function preparation({active=false,guard=false,cpuFailure=false}={}){const calls=[],f=fixture();const adapters=createPreparationAdaptersForIsolatedTests({
 assertNoGuard:()=>{assert.equal(guard,false,'unknown guard')},readRegistry:async()=>({ok:true,registry:{activeExecution:active?{}:null}}),
 prepareCpuRequest:()=>{calls.push('request');return bound(f.plan.outputRoot+'/cpu-request.json')},runtimeIdentity:()=>f.plan.runtimeIdentity,inside:(r,p)=>p,
 runNative:async options=>{calls.push(options.phase);assert.equal(options.phase,'cpu');if(cpuFailure)throw Error('synthetic CPU failure');return {ownedReceipt:{fixtureKind:'private-stub'}}},
 finalizeCpuAcceptance:async()=>{calls.push('acceptance');return f.plan.finalCpuAcceptance},withNativeOrdinaryBudget:async(r,p,action)=>action(),
 preparePlan:()=>{calls.push('plan');return f.input.planBinding},makeInternalCandidate:()=>{calls.push('candidate');return {synthetic:true}},
 materialize:()=>{calls.push('package');return {packagePath:f.packageBinding.path,packageSha256:zero}}
 });return {calls,f,adapters};}
test('prepare-only ends after own CPU/plan/package stubs and never calls lifecycle or GPU',async()=>{const s=preparation(),out=await s.adapters.prepareOnly({root:s.f.root,runId:s.f.plan.runId,packageId:s.f.plan.packageId});
 assert.deepEqual(s.calls,['request','cpu','acceptance','plan','candidate','package']);assert.equal(out.trainingStarted,false);assert.equal(out.gpuStarted,false);});
test('prepare active/unknown guard/CPU failure cannot materialize a package or start GPU',async()=>{for(const config of [{active:true},{guard:true},{cpuFailure:true}]){
 const s=preparation(config);await assert.rejects(s.adapters.prepareOnly({root:s.f.root,runId:s.f.plan.runId,packageId:s.f.plan.packageId}));assert.equal(s.calls.includes('package'),false);assert.equal(s.calls.includes('qualification'),false);}});
test('CPU report requires newly computed model output, not bootstrap model reference',()=>{const f=fixture(),request={schema:'ecology-decode1-weight-quality-cpu-request-v1',runId:f.plan.runId,packageId:f.plan.packageId,
 outputRoot:f.plan.outputRoot+'/cpu-entry',modelIdentityOutput:f.plan.modelBinding.path,modelCapabilityVersion:reg.MODEL_CAPABILITY,
 programBindings:f.plan.programBindings,configuration:f.plan.configuration,runtimeIdentity:f.plan.runtimeIdentity};
 const raw={schema:'ecology-decode1-weight-quality-entry-cpu-report-v1',status:'passed',passed:20,failed:0,errors:0,skipped:0,synthetic:true,gpuInitialized:false,
 programBindings:f.plan.programBindings,configuration:f.plan.configuration,runtimeIdentity:f.plan.runtimeIdentity,modelBinding:f.plan.modelBinding,initialModel:f.model,
 actualCalls:{moduleForwardCalls:0,autogradCalls:0,optimizerConstructionAttempts:0,optimizerUpdates:0,cudaInitializationAttempts:0},items:Array.from({length:20},()=>({status:'passed'}))};
 verifyCpuReport(raw,request,f.plan);assert.throws(()=>verifyCpuReport(raw,{...request,modelBinding:f.plan.modelBinding},f.plan));
 const wrong=clone(raw);wrong.initialModel.capabilityVersion='stage4_mvp256_dry_factorized_ecology_v1';assert.throws(()=>verifyCpuReport(wrong,request,f.plan));});
test('precreated localPrepare namespace requires exact new protocol/request/source/runtime bindings',()=>{const f=fixture(),expected={runId:f.plan.runId,packageId:f.plan.packageId,outputRoot:f.plan.outputRoot,programBindings:f.plan.programBindings,runtimeIdentity:f.plan.runtimeIdentity};
 const b=bound(expected.outputRoot+'/local-prepare/request.json'),request={...expected,schema:'ai-painter-local-prepare-request-v1',protocol:'ai-painter-local-control-v2',
 capabilityVersion:reg.CAPABILITY,requestId:expected.runId,candidateSelection:'ecology-decode1-quality-v1',candidateBinding:reg.CANDIDATE,executionPackage:null,automaticRetries:0};
 validatePreparationNamespace(b,request,expected);
 for(const mutate of [v=>v.protocol='ai-painter-local-control-v1',v=>v.capabilityVersion='stage4_mvp256_dry_factorized_ecology_quality_v1',v=>v.runId='other-run-01',
 v=>v.programBindings={},v=>v.runtimeIdentity={},v=>v.executionPackage=bound('.runtime/old/package.json'),v=>v.automaticRetries=1]){
  const bad=clone(request);mutate(bad);assert.throws(()=>validatePreparationNamespace(b,bad,expected));}
 assert.throws(()=>validatePreparationNamespace(bound('.runtime/foreign/request.json'),request,expected));});
test('only the exact source137 npm alias transition is admitted; other script/field/source changes refuse',()=>{
 const original={name:'explicit-private-fixture',scripts:{old:'node old.mjs'},dependencies:{old:'1'}},alias='control:ai-painter-ecology-decode1-quality',command='node scripts/run-ai-painter-ecology-decode1-quality-v1.mjs';
 const current=clone(original);current.scripts[alias]=command;assert.equal(verifyProjectManifestTransition(original,current),true);
 for(const mutate of [v=>delete v.scripts[alias],v=>v.scripts[alias]='node other.mjs',v=>v.scripts.extra='node extra.mjs',v=>v.scripts.old='node changed.mjs',v=>v.dependencies.old='2',v=>v.name='changed']){
  const bad=clone(current);mutate(bad);assert.throws(()=>verifyProjectManifestTransition(original,bad));}
 assert.throws(()=>verifyProjectManifestTransition(current,current));
});

function savedAdmissionFixture(){
 const f=fixture(),store=new Map(),put=(p,v)=>{const bytes=Buffer.isBuffer(v)?v:Buffer.from(JSON.stringify(v));store.set(p,bytes);return {path:p,sha256:digest(bytes)}};
 const inside=(r,p)=>path.resolve(r,p),bind=(r,p)=>{assert.ok(store.has(p));return {path:p,sha256:digest(store.get(p))}},read=(r,b)=>{const bytes=store.get(b.path);assert.ok(bytes);assert.equal(digest(bytes),b.sha256);return bytes},json=(r,b)=>JSON.parse(read(r,b));
 const guardId='00000001-0002-0003-0004-000000000005',key=digest(f.plan.outputRoot).slice(0,32),namespace=[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join('-'),nativeRoot='.runtime/ai-painter/owned-worker-guards/'+namespace;
 const source=Buffer.from('// explicit synthetic CPU native source, never compiled\n'),binary=Buffer.from('synthetic-not-executable');
 put(nativeRoot+'/'+guardId+'-native/owner.cs',source);put(nativeRoot+'/'+guardId+'-native/owner.exe',binary);
 const ownerSource={path:inside(f.root,'scripts/windows/ai-painter-owned-worker-owner.cs'),sha256:digest(source)};
 const guard={identity:guardId,runnerPid:999,recordedAtUtc:'2026-10-12T00:00:00Z',executable:f.plan.runtimeIdentity.python.absolutePath,
  executableSha256:zero,helperSha256:f.plan.programBindings.nativeRunner.sha256,nativeOwnerSource:ownerSource,
  commandSha256:digest(JSON.stringify(['-B',inside(f.root,ROLES.gpuQualifier),'--package',f.packageBinding.path,'--sha256',f.packageBinding.sha256])),
  startedEvidence:inside(f.root,nativeRoot+'/'+guardId+'-started.json')};
 const build={snapshot:inside(f.root,nativeRoot+'/'+guardId+'-native/owner.cs'),binary:inside(f.root,nativeRoot+'/'+guardId+'-native/owner.exe'),binarySha256:digest(binary)};
 const encoded=Buffer.from(JSON.stringify({guard,guardSha256:digest(JSON.stringify(guard)),scope:path.resolve(f.root),nativeBuild:build})).toString('base64');
 put(nativeRoot+'/'+guardId+'-started.json',{...guard,ownerPid:1001,commandBinding:encoded});
 const receipt={schema:'detail-weight-live-native-owner-receipt-v1',stopReason:null,phase:'qualification',cleanupConfirmed:true,processCleanupConfirmed:true,ownerClosed:true,ownerIdentity:{pid:1001},protocolError:null,
  proof:{exitCode:0,ownerPid:1001,rootPid:1002,rootCreationDateUtc:'2026-10-12T00:00:00Z',bindingBase64:encoded,assignedBeforeResume:true,killOnJobClose:true,
   activeProcessesAfterCleanup:0,stdoutBytes:20,stderrBytes:0,streamClosureVersion:'bounded-stream-capture-v2',stdoutClosed:true,stderrClosed:true,transportCompleted:true,streamCaptureError:null,streamTransportError:null},streamBytes:{stdout:20,stderr:0},budget:{timeoutMs:600000,outputBytes:16777216},nativeBuild:build,
  guard:{identity:guardId,state:'released_after_live_empty_job',nativeEvidenceRoot:nativeRoot},outputAccountingRoots:[f.plan.outputRoot]};
 const receiptBinding=put(f.plan.outputRoot+'/synthetic-owned-gpu.json',receipt);
 const admission={schema:'ecology-decode1-weight-quality-owned-gpu-acceptance-v1',status:'passed',executionPackage:f.packageBinding,
  programBindings:f.plan.programBindings,ownedReceipt:receiptBinding,report:bound(f.plan.outputRoot+'/gpu-gate.json')};
 const binding=put(f.plan.outputRoot+'/gpu-acceptance.json',admission);
 const registryResult={ok:true,registry:{activeExecution:null,capabilityVersion:reg.CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId},
  currentTaskTerminal:{schema:'ecology-decode1-weight-quality-pretraining-terminal-v1',status:'qualification_completed_training_not_started',executionState:'completed',
   trainingStarted:false,optimizerStepsGenerator:0,optimizerStepsDiscriminator:0,executionPackage:f.packageBinding,gpuAcceptance:binding}};
 const io={inside,bind,read,json,nativeOwnerSourceIdentity:()=>ownerSource,verifyGpuOutcome:()=>({synthetic:true})};
 return {f,store,put,binding,registryResult,io,admission,receipt,receiptBinding,nativeRoot,guardId};
}
test('stored GPU validator recomputes synthetic descriptor/build/start bindings; grants no live cleanup',()=>{const s=savedAdmissionFixture();
 verifyStoredGpuAcceptance(s.f,s.binding,s.registryResult,s.io);assert.equal(hasLiveOwnedProof(s.receipt),false);});
for(const [name,mutate]of [
 ['other package registry',s=>s.registryResult.registry.packageId='other-synthetic-package'],
 ['changed admission source',s=>{s.admission.programBindings.nativeRunner.sha256='1'.repeat(64);s.put(s.binding.path,s.admission)}],
 ['changed source snapshot',s=>s.put(s.nativeRoot+'/'+s.guardId+'-native/owner.cs',Buffer.from('different synthetic source'))],
 ['changed native binary',s=>s.put(s.nativeRoot+'/'+s.guardId+'-native/owner.exe',Buffer.from('different synthetic binary'))],
 ['missing started evidence',s=>s.store.delete(s.nativeRoot+'/'+s.guardId+'-started.json')],
 ['unclean Job receipt',s=>{s.receipt.proof.activeProcessesAfterCleanup=1;s.admission.ownedReceipt=s.put(s.receiptBinding.path,s.receipt);s.binding=s.put(s.binding.path,s.admission);s.registryResult.currentTaskTerminal.gpuAcceptance=s.binding}],
 ['expanded qualification budget',s=>{s.receipt.budget.timeoutMs=601000;s.admission.ownedReceipt=s.put(s.receiptBinding.path,s.receipt);s.binding=s.put(s.binding.path,s.admission);s.registryResult.currentTaskTerminal.gpuAcceptance=s.binding}],
 ['changed terminal acceptance reference',s=>s.registryResult.currentTaskTerminal.gpuAcceptance=bound(s.binding.path)]
])test('stored GPU validator rejects '+name,()=>{const s=savedAdmissionFixture();mutate(s);assert.throws(()=>verifyStoredGpuAcceptance(s.f,s.binding,s.registryResult,s.io));});

function streamFixture(){const parent=process.env.AI_PAINTER_STREAM_REPAIR_COMPONENT_ROOT;assert.ok(parent&&path.isAbsolute(parent),'explicit private stream parent required');
 return createNativeFailureProtocolFixtureForIsolatedTests(path.join(parent,'case-'+crypto.randomUUID()));}

test('actual phase adapter loads during a waiting v2 entry; the previous static edge exits 13',()=>{
 const parent=process.env.AI_PAINTER_STREAM_REPAIR_COMPONENT_ROOT;
 assert.ok(parent&&path.isAbsolute(parent),'explicit private component parent required');
 const directory=path.join(parent,'adapter-import-'+crypto.randomUUID());fs.mkdirSync(directory);
 const cli=pathToFileURL(path.resolve('scripts/run-ai-painter-local-control-v2.mjs')).href;
 const adapter=pathToFileURL(path.resolve('scripts/run-ai-painter-ecology-decode1-quality-v1.mjs')).href;
 const before=fs.readFileSync(new URL(adapter)),beforeRegistry=fs.readFileSync(CURRENT_EXECUTION_REGISTRY_PATH);
 const outputs=[];
 for(const previousStaticEdge of [true,false]){
  const waitingEntry=`export function loadLocalOperatorDeploymentConfiguration(){throw Error('configuration must not run in an imported phase adapter');}
   const loaded=await import(${JSON.stringify(adapter)});
   for(const name of ['preflight','execute','validate','review','adjudicate','finalize'])if(typeof loaded[name]!=='function')throw Error('phase export missing');
   console.log('current_phase_adapter_import_complete');`;
  const loader=path.join(directory,previousStaticEdge?'previous-edge.mjs':'current-edge.mjs');
  const edge="import {loadLocalOperatorDeploymentConfiguration} from './run-ai-painter-local-control-v2.mjs';\n";
  fs.writeFileSync(loader,`export async function load(url,context,next){
   if(url===${JSON.stringify(cli)})return {format:'module',shortCircuit:true,source:${JSON.stringify(waitingEntry)}};
   const result=await next(url,context);
   if(url===${JSON.stringify(adapter)}&&${previousStaticEdge})return {...result,source:${JSON.stringify(edge)}+Buffer.from(result.source).toString('utf8')};
   return result;
  }`,{flag:'wx'});
  const child=spawnSync(process.execPath,['--no-warnings','--max-old-space-size=128','--experimental-loader',pathToFileURL(loader).href,
   '--input-type=module','-e',`await import(${JSON.stringify(cli)});`],{cwd:process.cwd(),windowsHide:true,shell:false,
   encoding:'utf8',timeout:10000,maxBuffer:65536});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);
  assert.equal(child.status,previousStaticEdge?13:0);
  assert.equal(child.stdout.includes('current_phase_adapter_import_complete'),!previousStaticEdge);
  outputs.push({previousStaticEdge,exitCode:child.status,stdout:child.stdout,stderr:child.stderr});
 }
 assert.deepEqual(fs.readFileSync(new URL(adapter)),before,'current adapter source must remain unchanged');
 assert.deepEqual(fs.readFileSync(CURRENT_EXECUTION_REGISTRY_PATH),beforeRegistry,'module loading must not write the registry');
 fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify({schema:'decode1-phase-adapter-module-cycle-regression-v1',
  outputs,currentAdapterSha256:digest(before),waitingEntryReplacedForIsolation:true,phaseAdapterUsesActualCurrentSource:true,
  phasesInvoked:false,actualNativeCalls:0,actualGpuCalls:0,productionConfigurationLoaded:false,qualificationGranted:false})+'\n',{flag:'wx'});
});
test('v2 stream proof requires both EOFs, completed transport and exactly null errors; old proofs refuse',()=>{
 const s=savedAdmissionFixture(),receipt=s.receipt,args={proof:receipt.proof,ownerPid:1001,bindingBase64:receipt.proof.bindingBase64,ownerClosed:true,protocolError:null,stdoutBytes:20,stderrBytes:0};
 assert.equal(validateNativeReceipt(args),true);
 for(const key of ['streamClosureVersion','stdoutClosed','stderrClosed','transportCompleted','streamCaptureError','streamTransportError']){
  const old=clone(args);delete old.proof[key];assert.equal(validateNativeReceipt(old),false);
 }
 for(const mutate of [p=>p.stdoutClosed=false,p=>p.stderrClosed=false,p=>p.transportCompleted=false,p=>p.streamCaptureError='capture_failed',p=>p.streamTransportError='transport_failed',
 p=>p.streamCaptureError='',p=>p.streamTransportError=false,p=>p.streamClosureVersion='old-v1']){const bad=clone(args);mutate(bad.proof);assert.equal(validateNativeReceipt(bad),false);}
 assert.equal(hasLiveOwnedProof(receipt),false,'synthetic stream flags grant no live authority');
});
test('incomplete CPU cleanup can save dedicated failure but still cannot use normal writes or cleanup',async()=>{
 const s=streamFixture(),error=Object.assign(Error('stream close unconfirmed'),{ownedReceipt:s.receipt});let ordinaryWrites=0;
 await assert.rejects(withNativeReceiptBudget(s.root,s.receipt,()=>ordinaryWrites++),/fixture cleanup/);
 await assert.rejects(withNativeOrdinaryBudget(s.root,s.receipt,()=>ordinaryWrites++),/fixture cleanup/);assert.equal(ordinaryWrites,0);
 const result=await persistNativeFailureEvidence(s.root,s.receipt,error,'preparation'),body=JSON.parse(fs.readFileSync(result.path,'utf8'));
 assert.equal(body.primaryError.reason,'stream close unconfirmed');assert.equal(body.privateCpuFixture,true);
 for(const key of ['cleanupQualificationGranted','guardReleaseGranted','normalWriteQualificationGranted'])assert.equal(body[key],false);
 assert.equal(hasLiveOwnedProof(s.receipt),false);assert.equal(cleanupForCurrentCall(error,null),false);
});
test('forged/copied receipts and arbitrary roots/flags cannot mint or expand failure scope',async()=>{
 const s=streamFixture();await assert.rejects(persistNativeFailureEvidence(s.root,clone(s.receipt),Error('fake'),'preparation'),/current native failure call/);
 await assert.rejects(persistNativeFailureEvidence(path.dirname(s.root),s.receipt,Error('fake'),'preparation'),/root differs/);
 s.receipt.outputAccountingRoots=[path.resolve('data')];s.receipt.budget.outputBytes=1024**3;s.receipt.cleanupConfirmed=true;
 const b=await persistNativeFailureEvidence(s.root,s.receipt,Error('stream close unconfirmed'),'preparation');assert.equal(path.dirname(b.path),s.root);
 assert.equal(hasLiveOwnedProof(s.receipt),false);assert.equal(s.evidenceFiles().length,1);
});
test('CLI preserves primary and explicit secondary on evidence budget exhaustion without leaking messages',async()=>{
 const s=streamFixture(),marker='private_cookie_and_csrf_do_not_echo',error=Object.assign(Error(marker),{code:'EACCES',ownedReceipt:s.receipt});s.setDebit(8388608);
 const out=await preservePreparationCliFailure({root:s.root,ready:null,request:{mode:'prepare-only'},error});
 assert.equal(out.errorCode,'decode1_preparation_io_eacces');assert.equal(out.primaryError.code,'EACCES');
 assert.equal(out.evidenceStatus,'failed_to_preserve');assert.ok(out.secondaryEvidenceFailure);assert.equal(s.evidenceFiles().length,0);
 assert.equal(JSON.stringify(out).includes(marker),false);assert.match(out.secondaryEvidenceFailure.reason,/evidence budget/);
});
test('CLI dedicated failure success uses actual scope and rejects absent call despite ready/input booleans',async()=>{
 const s=streamFixture(),error=Object.assign(Error('stream forwarding deadline'),{ownedReceipt:s.receipt});
 const out=await preservePreparationCliFailure({root:s.root,request:{mode:'prepare-only',values:{'--run':'forged-run'}},ready:{verified:true,plan:{outputRoot:'arbitrary'}},error});
 assert.equal(out.runId,'private-stream-repair-run');assert.equal(out.evidenceStatus,'preserved_from_current_call');assert.equal(path.dirname(out.evidence.path),s.root);
 const refused=await preservePreparationCliFailure({root:s.root,request:{mode:'prepare-only'},ready:{verified:true},error:Error('primary')});
 assert.equal(refused.evidenceStatus,'failed_to_preserve');assert.match(refused.secondaryEvidenceFailure.reason,/current native failure call/);
});
test('source/runtime changes and replaced ordinary parent reject failure write with explicit secondary',async()=>{
 for(const kind of ['source','runtime']){const s=streamFixture();fs.writeFileSync(s[kind],'changed private fixture');
  const out=await preservePreparationCliFailure({root:s.root,request:{mode:'prepare-only'},error:Object.assign(Error('stream close unconfirmed'),{ownedReceipt:s.receipt})});
  assert.equal(out.evidenceStatus,'failed_to_preserve');assert.match(out.secondaryEvidenceFailure.reason,new RegExp(kind+' changed'));assert.equal(s.evidenceFiles().length,0);
 }
 const s=streamFixture(),moved=s.root+'-preserved';assert.equal(path.dirname(moved),path.dirname(s.root));fs.renameSync(s.root,moved);fs.mkdirSync(s.root);
 await assert.rejects(persistNativeFailureEvidence(s.root,s.receipt,Error('stream close unconfirmed'),'preparation'),/parent changed/);assert.deepEqual(fs.readdirSync(s.root),[]);
});
test('failure terminal allowance is cumulative64KiB and metadata never dumps arbitrary stack/env',async()=>{
 const s=streamFixture(),marker='private_secret_marker';let refused=false;
 for(let i=0;i<150;i++){try{await persistNativeFailureEvidence(s.root,s.receipt,Object.assign(Error(marker),{stack:marker+' stack',env:{secret:marker}}),'preparation');}catch(e){assert.match(e.message,/already exhausted/);refused=true;break;}}
 assert.equal(refused,true);const files=s.evidenceFiles(),total=files.reduce((n,p)=>n+fs.statSync(path.join(s.root,p)).size,0);assert.ok(total<=65536);
 for(const p of files)assert.equal(fs.readFileSync(path.join(s.root,p),'utf8').includes(marker),false);
 assert.equal(boundedNativeFailureMetadata(Object.assign(Error(marker),{code:marker})).code,null);
});
