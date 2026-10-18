import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import * as registration from '../lib/ai-painter-object-support-structure-quality-registration-v1.mjs';
import {verifyGpuOutcome,parsePreparationArguments,createPreparationAdaptersForIsolatedTests,createPhaseAdaptersForIsolatedTests}
  from '../run-ai-painter-object-support-structure-quality-v1.mjs';
import {inside,bind as fileBinding,read as readBound,directoryBytes,ROLES}
  from '../lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs';
import {validateCpuRegistryFixtureLeaseRequest,primaryErrorBeforeNativeFinalization,boundedNativeFailureMetadata}
  from '../lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs';
import {CURRENT_EXECUTION_REGISTRY_PATH,initializeCurrentExecutionRegistry,
  prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance,readCurrentExecutionRegistry}
  from '../../src/server/ai-painter-current-execution-registry.mjs';

const digest = raw => crypto.createHash('sha256').update(raw).digest('hex');
const binding = logical => ({path:logical,sha256:'1'.repeat(64)});
const candidate = JSON.parse(fs.readFileSync(registration.CANDIDATE.path,'utf8'));

test('retained stop sender handles asynchronous terminal, exit and EPIPE races without weakening receipts',t=>{
 const code=String.raw`
import assert from 'node:assert/strict';
import {Writable,PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const url=pathToFileURL(path.join(process.cwd(),'scripts/lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs')).href+'?private-timeout-finalize';
const hook=registerHooks({load(urlToLoad,context,next){const loaded=next(urlToLoad,context);return urlToLoad===url?
 {...loaded,source:Buffer.from(loaded.source).toString('utf8')+'\nexport {createRetainedNativeStopSender as privateSender};\n'}:loaded;}});
let native;try{native=await import(url);}finally{hook.deregister();}
const tick=()=>new Promise(resolve=>setImmediate(resolve)),cases=[];
const binding=Buffer.from(JSON.stringify({callId:'private-current-call',nonce:'private-current-nonce'})).toString('base64');
const proof=()=>({ownerPid:123,rootPid:456,rootCreationDateUtc:'2026-10-17T00:00:00Z',bindingBase64:binding,
 assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,observationError:null,cleanupError:null,
 stdoutBytes:0,stderrBytes:0,streamClosureVersion:'bounded-stream-capture-v2',stdoutClosed:true,stderrClosed:true,
 transportCompleted:true,streamCaptureError:null,streamTransportError:null,exitCode:1,stopReason:'wall_timeout'});
function fixture({broken=false}={}){
 const child=new EventEmitter();child.pid=123;child.exitCode=null;child.signalCode=null;
 const state={closed:false,settled:false,proof:null,protocolError:null,primary:null,stopReason:null,pending:'',writes:[],errors:[],stdoutBytes:0,stderrBytes:0};
 child.stdin=new Writable({write(chunk,encoding,done){state.writes.push(Buffer.from(chunk).toString('utf8'));
  setImmediate(()=>done(broken?Object.assign(new Error('write EPIPE'),{code:'EPIPE'}):null));}});
 const send=native.privateSender(child,{isClosed:()=>state.closed,isSettled:()=>state.settled,
  hasTerminalFrame:()=>state.proof!==null,onError:error=>{state.errors.push(error.code);state.primary=native.primaryErrorForControlStream(state.primary,state.stopReason,error);state.protocolError??=String(error);}});
 const output=new PassThrough();output.on('data',chunk=>{state.pending=native.consumeNativeOwnerChunk(state.pending,chunk,{
  onFrame:line=>{if(line.startsWith('R:')){assert.equal(state.proof,null);state.proof=JSON.parse(Buffer.from(line.slice(2),'base64').toString('utf8'));}
   else if(line.startsWith('O:'))state.stdoutBytes+=Buffer.from(line.slice(2),'base64').length;else throw new Error('unknown native frame');},
  onError:error=>{state.protocolError??=String(error);},onOverflow:()=>{state.protocolError??='native_frame_overflow';},account:()=>{}});});
 child.once('close',()=>{state.closed=true;if(state.pending.trim())state.protocolError??='incomplete_frame';});
 const terminal=value=>output.write('R:'+Buffer.from(JSON.stringify(value)).toString('base64')+'\n');
 const stop=reason=>{if(reason instanceof Error)state.primary??=reason;if(state.stopReason)return false;
  state.stopReason=String(reason).slice(0,2048);try{return send(state.stopReason);}catch(error){state.protocolError??=String(error);return false;}};
 const close=()=>child.emit('close');
 const accepted=()=>native.validateNativeReceipt({proof:state.proof,ownerPid:child.pid,bindingBase64:binding,
  ownerClosed:state.closed,protocolError:state.protocolError,stdoutBytes:state.stdoutBytes,stderrBytes:state.stderrBytes});
 const dispose=async()=>{output.destroy();child.stdin.destroy();await tick();};
 return {child,state,send,stop,terminal,close,accepted,output,dispose};
}
async function run(name,body){await body();cases.push({name,status:'passed'});}
await run('valid terminal proof before close prevents a late write on a still-writable stream',async()=>{
 const f=fixture({broken:true});f.terminal(proof());await tick();assert.equal(f.state.proof.stopReason,'wall_timeout');
 assert.equal(f.child.stdin.destroyed,false);assert.equal(f.child.stdin.writable,true);assert.equal(f.state.closed,false);
 assert.equal(f.stop('wall_timeout'),false);await tick();assert.deepEqual(f.state.writes,[]);assert.deepEqual(f.state.errors,[]);
 assert.equal(f.accepted(),false);f.close();assert.equal(f.accepted(),true);
 assert.equal(native.primaryErrorBeforeNativeFinalization({stopReason:f.state.stopReason,proof:f.state.proof}).message,'wall_timeout');
 assert.equal(native.hasLiveOwnedProof({proof:f.state.proof,cleanupConfirmed:true}),false,'synthetic proof grants no live receipt authority');await f.dispose();
});
await run('owner exit before close prevents writing even without terminal proof',async()=>{
 const f=fixture({broken:true});f.child.exitCode=0;assert.equal(f.stop('wall_timeout'),false);await tick();
 assert.deepEqual(f.state.writes,[]);f.close();assert.equal(f.accepted(),false);await f.dispose();
});
for(const kind of ['closed','settled','signal','destroyed','ended'])await run(kind+' retained-call boundary prevents sending',async()=>{
 const f=fixture({broken:true});if(kind==='closed')f.close();if(kind==='settled')f.state.settled=true;
 if(kind==='signal')f.child.signalCode='SIGKILL';if(kind==='destroyed')f.child.stdin.destroy();if(kind==='ended')f.child.stdin.end();
 assert.equal(f.stop('wall_timeout'),false);await tick();assert.deepEqual(f.state.writes,[]);assert.equal(f.accepted(),false);await f.dispose();
});
await run('first same-call reason is sent once and cannot be handed off twice',async()=>{
 const f=fixture();assert.equal(f.stop('wall_timeout'),true);assert.equal(f.stop('operator_stop'),false);assert.equal(f.send('operator_stop'),false);await tick();
 assert.deepEqual(f.state.writes,[Buffer.from('wall_timeout').toString('base64')+'\n']);assert.equal(f.state.stopReason,'wall_timeout');await f.dispose();
});
await run('early asynchronous EPIPE remains fatal after otherwise valid proof and close',async()=>{
 const f=fixture({broken:true});f.stop('wall_timeout');await tick();await tick();assert.deepEqual(f.state.errors,['EPIPE']);
 f.terminal(proof());f.close();assert.equal(f.accepted(),false);assert.match(f.state.protocolError,/EPIPE/);
 assert.equal(f.state.primary.message,'wall_timeout');assert.equal(native.primaryErrorBeforeNativeFinalization({primaryError:f.state.primary,proof:f.state.proof}),f.state.primary);await f.dispose();
});
await run('unsolicited early stream error is never discarded or replaced by later proof',async()=>{
 const f=fixture();f.child.stdin.destroy(Object.assign(new Error('early EPIPE'),{code:'EPIPE'}));await tick();
 f.terminal(proof());f.close();assert.equal(f.state.primary.code,'EPIPE');assert.equal(f.accepted(),false);await f.dispose();
});
await run('EPIPE from a write in flight remains fatal even if terminal frame arrives first',async()=>{
 const f=fixture({broken:true});f.stop('wall_timeout');f.terminal(proof());assert.notEqual(f.state.proof,null);
 await tick();await tick();f.close();assert.deepEqual(f.state.errors,['EPIPE']);assert.equal(f.accepted(),false);assert.equal(f.state.primary.message,'wall_timeout');await f.dispose();
});
for(const kind of ['wrongOwner','wrongNonce','activeJob','streamCount','streamOpen','transportIncomplete','captureError'])await run(kind+' terminal proof still fails strict receipt validation',async()=>{
 const f=fixture({broken:true}),p=proof();if(kind==='wrongOwner')p.ownerPid++;if(kind==='wrongNonce')p.bindingBase64=Buffer.from('wrong-nonce').toString('base64');
 if(kind==='activeJob')p.activeProcessesAfterCleanup=1;if(kind==='streamCount')p.stdoutBytes=1;if(kind==='streamOpen')p.stdoutClosed=false;
 if(kind==='transportIncomplete')p.transportCompleted=false;if(kind==='captureError')p.streamCaptureError='truncated';
 f.terminal(p);await tick();assert.equal(f.stop('wall_timeout'),false);f.close();assert.equal(f.accepted(),false);assert.deepEqual(f.state.writes,[]);await f.dispose();
});
await run('truncated terminal frame remains a protocol error after owner close',async()=>{
 const f=fixture();f.output.write('R:eyJpbmNvbXBsZXRlIjp0cnVl');f.close();assert.equal(f.state.protocolError,'incomplete_frame');assert.equal(f.accepted(),false);
 assert.equal(f.stop('wall_timeout'),false);assert.deepEqual(f.state.writes,[]);await f.dispose();
});
console.log(JSON.stringify({cases,privateCpuSyntheticOnly:true,nativeJobStarted:false,guardRegistryOrOldRunWritten:false,receiptValidatorUnchanged:true}));
`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:process.cwd(),windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:1048576,
  env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',CUDA_VISIBLE_DEVICES:'-1'}});
 assert.equal(result.status,0,result.stderr);const evidence=JSON.parse(result.stdout.trim());
 assert.equal(evidence.cases.length,19);assert.ok(evidence.cases.every(row=>row.status==='passed'));
 assert.equal(evidence.privateCpuSyntheticOnly,true);assert.equal(evidence.nativeJobStarted,false);t.diagnostic(JSON.stringify(evidence));
});

let budgetRoot;
function fixtureOutputRoot(){
  if(budgetRoot){
    assert.equal(process.env.TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT,budgetRoot,'CPU fixture budget root changed');
    if(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT)assert.equal(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT,budgetRoot,'CPU harness roots disagree');
    return budgetRoot;
  }
  const logical=process.env.TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT
    ?? process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT
    ?? registration.OUTPUT_ROOT+'/js-sqlite-'+crypto.randomUUID()+'/cpu-entry';
  const prefix=[registration.OUTPUT_ROOT,registration.FINAL_RGB_PROFILE.OUTPUT_ROOT,registration.JOINT_PROFILE.OUTPUT_ROOT].find(root=>logical.startsWith(root+'/'));
  assert.ok(prefix&&logical.endsWith('/cpu-entry'),'exact current CPU fixture budget root');
  assert.match(logical.slice(prefix.length+1),/^[a-z0-9][a-z0-9-]{7,127}\/cpu-entry$/u);
  if(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT)
    assert.equal(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT,logical,'CPU harness roots disagree');
  const physical=inside(process.cwd(),logical);fs.mkdirSync(physical,{recursive:true});
  const stat=fs.lstatSync(physical);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
  process.env.TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT=logical;budgetRoot=logical;return logical;
}
function checkFixtureBudget(extraBytes=0){
  assert.ok(Number.isSafeInteger(extraBytes)&&extraBytes>=0);
  assert.ok(directoryBytes(inside(process.cwd(),fixtureOutputRoot()))+extraBytes<=8*1024**2-65536,'CPU fixture output budget');
}

test('new configuration binds the frozen five-gradient definitions and asset-only source',()=>{
  const c=registration.deriveConfiguration(candidate);
  assert.equal(c.schema,'object-support-structure-quality-configuration-v1');
  assert.equal(c.capabilityVersion,registration.CAPABILITY);
  assert.equal(c.modelCapabilityVersion,registration.MODEL_CAPABILITY);
  assert.equal(Object.hasOwn(c,'sourceCandidate'),false);
  assert.deepEqual(c.sourceAssetsCandidate,registration.CANDIDATE);
  assert.equal(c.sourceAssetsUse,'data_review_and_base_schedule_only_not_execution_qualification');
  assert.deepEqual(c.lossDefinition,registration.LOSS);
  assert.deepEqual(c.gradientDefinition,registration.GRADIENT);
  assert.deepEqual(c.integrationPolicy,registration.INTEGRATION_POLICY);
  assert.notDeepEqual(c.formalSpecification,registration.SPECIFICATION);
  assert.equal(c.executionCeiling.epochs,24);
  assert.equal(c.executionCeiling.maxWallSeconds,8400);
  assert.deepEqual(c.checkpointSelection.eligibleEpochs,[24]);
  assert.deepEqual(c.checkpointSelection.observationOnlyEpochs,[12]);
  assert.equal(c.automaticResumeAllowed,false);
});

test('CLI requires the new explicit protocol and cannot start training',()=>{
  const protocol='object-support-structure-quality-entry-v1';
  assert.equal(parsePreparationArguments(['--help']).help,true);
  assert.equal(parsePreparationArguments(['--protocol',protocol,'prepare-only','--run','support-run-0001','--package-id','support-package-0001']).mode,'prepare-only');
  for(const mode of ['start','train','resume','retry'])
    assert.throws(()=>parsePreparationArguments(['--protocol',protocol,mode,'--run','support-run-0001','--package-id','support-package-0001']));
  assert.throws(()=>parsePreparationArguments(['--protocol','ecology-terrain-detail-weight-quality-entry-v1','prepare-only','--run','support-run-0001','--package-id','support-package-0001']));
});

function gpuFixture(){
  const root=process.cwd();
  const parentLogical=fixtureOutputRoot();
  const parent=inside(root,parentLogical);fs.mkdirSync(parent,{recursive:true});
  const physical=fs.mkdtempSync(path.join(parent,'synthetic-gate-'));
  const logical=parentLogical+'/'+path.basename(physical);
  // Keep synthetic inputs and rejected gates with the three registry proofs.
  // The owning CPU harness reads them after this Node test process exits.
  const write=(name,value)=>{const raw=Buffer.from(JSON.stringify(value));const p=logical+'/'+name;
    checkFixtureBudget(raw.length);fs.writeFileSync(inside(root,p),raw,{flag:'wx'});return {path:p,sha256:digest(raw)};};
  const ids=Array.from({length:48},(_,i)=>'synthetic-train-'+i);
  const initial={generator:'a'.repeat(64),discriminator:'b'.repeat(64)};
  const plan={capabilityVersion:registration.CAPABILITY,runId:'synthetic-run-0001',packageId:'synthetic-package-0001',outputRoot:logical,
    programBindings:{syntheticSource:binding('scripts/synthetic-only.mjs')},
    trainSplit:write('train.json',{sampleIds:ids}),modelBinding:write('model.json',{initialState:initial})};
  const packageBinding=binding('.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json');
  const gate={schema:'object-support-structure-quality-all-train-gpu-gate-v1',status:'passed',
    capabilityVersion:registration.CAPABILITY,executionProfile:registration.EXECUTION_PROFILE,
    runId:plan.runId,packageId:plan.packageId,executionPackage:structuredClone(packageBinding),programBindings:structuredClone(plan.programBindings),
    actualCounts:{forwardAttempted:48,forwardCompleted:48,generatorAttempted:240,generatorCompleted:240,discriminatorAttempted:48,discriminatorCompleted:48},
    optimizerSteps:0,checkpointLoaded:false,checkpointWritten:false,deviceIdentity:{ordinal:0,uuid:'GPU-synthetic-unit-test'},
    initialState:initial,finalState:initial,initialCpuState:initial,
    cases:ids.map(sampleId=>({sampleId,passed:true,proof:{callCounts:{generatorForwards:1,generatorForwardCompleted:1,generatorAutograd:5,discriminatorAutograd:1},optimizerCreated:false,optimizerUpdates:0}}))};
  return {ready:{root,plan,packageBinding},gate,write};
}

test('gate verifier accepts only an exact same-package 48/240/48 observation',t=>{
  const f=gpuFixture(t);const b=f.write('gpu-gate.json',f.gate);
  assert.deepEqual(verifyGpuOutcome(f.ready,b),f.gate);
});

for(const [name,mutate] of [
  ['old four-gradient counts',g=>{g.actualCounts.generatorAttempted=192;g.actualCounts.generatorCompleted=192;}],
  ['per-case four-gradient proof',g=>{g.cases[3].proof.callCounts.generatorAutograd=4;}],
  ['missing completed forward',g=>{delete g.cases[0].proof.callCounts.generatorForwardCompleted;}],
  ['old candidate identity',g=>{g.capabilityVersion='stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_quality24_v1';}],
  ['cross package',g=>{g.executionPackage.sha256='2'.repeat(64);} ],
  ['weight update',g=>{g.optimizerSteps=1;}],
  ['changed state',g=>{g.finalState={...g.finalState,generator:'c'.repeat(64)};}],
  ['wrong train order',g=>{g.cases.reverse();}],
  ['optimizer construction',g=>{g.cases[0].proof.optimizerCreated=true;}],
]) test('gate verifier refuses '+name,t=>{
  const f=gpuFixture(t);mutate(f.gate);
  assert.throws(()=>verifyGpuOutcome(f.ready,f.write('gpu-gate.json',f.gate)));
});

test('preparation adapter preserves CPU -> exact package order and stops before GPU',async()=>{
  const events=[];const request=binding('synthetic/cpu-request.json'),acceptance=binding('synthetic/cpu-acceptance.json');
  const plan=binding('synthetic/quality-plan.json');
  const adapter=createPreparationAdaptersForIsolatedTests({
    assertNoGuard:()=>events.push('guard'),readRegistry:async()=>({ok:true,registry:{activeExecution:null}}),
    prepareCpuRequest:()=>{events.push('request');return request;},
    runtimeIdentity:()=>({python:{absolutePath:'synthetic-python'}}),inside:(_root,p)=>p,
    runNative:async options=>{events.push(options.phase);assert.equal(options.phase,'cpu');return {ownedReceipt:{synthetic:true}};},
    finalizeCpuAcceptance:async()=>{events.push('accept');return acceptance;},
    withNativeOrdinaryBudget:async(_root,_receipt,action)=>action(),
    preparePlan:()=>{events.push('plan');return plan;},makeInternalCandidate:()=>{events.push('candidate');return {};},
    materialize:()=>{events.push('package');return {packagePath:'synthetic/package.json',packageSha256:'1'.repeat(64)};},
  });
  const result=await adapter.prepareOnly({root:process.cwd(),runId:'synthetic-run-0001',packageId:'synthetic-package-0001'});
  assert.deepEqual(events,['guard','request','cpu','accept','plan','candidate','package']);
  assert.equal(result.trainingStarted,false);assert.equal(result.gpuStarted,false);
  assert.equal(result.checkpointWritten,false);assert.equal(result.automaticRetries,0);
});

test('preparation failure is not retried and cannot materialize a package',async()=>{
  let calls=0;const error=Error('synthetic CPU failure');
  const adapter=createPreparationAdaptersForIsolatedTests({assertNoGuard(){},
    readRegistry:async()=>({ok:true,registry:{activeExecution:null}}),prepareCpuRequest:()=>binding('synthetic/request.json'),
    runtimeIdentity:()=>({python:{absolutePath:'synthetic-python'}}),inside:(_root,p)=>p,
    runNative:async()=>{calls++;throw error;},materialize:()=>assert.fail('must not materialize')});
  await assert.rejects(adapter.prepareOnly({root:process.cwd(),runId:'synthetic-run-0001',packageId:'synthetic-package-0001'}),e=>e===error);
  assert.equal(calls,1);
});

// Explicit in-memory orchestration stubs, separate from the three real SQLite
// fixtures below. No stub invokes a native owner, process, model or GPU.
function simulated({gpuFailure=false,unknownCleanup=false,invalidStored=false,diskOnlyReviewReceipt=false}={}){
  const clone=structuredClone,zero='1'.repeat(64),runId=fixtureOutputRoot().split('/').at(-2);
  const outputRoot=registration.OUTPUT_ROOT+'/'+runId,packageId='synthetic-support-package-0001';
  // Historical metadata contributes graph shape only, never an execution grant.
  const graph=JSON.parse(fs.readFileSync('.runtime/ai-painter/ecology-execution-auth-t-q4-71/cpu/model-identity.json','utf8')).graph;
  const model={capabilityVersion:registration.CAPABILITY,modelCapabilityVersion:registration.MODEL_CAPABILITY,
    architecture:registration.ARCHITECTURE,numericRule:registration.NUMERIC_RULE,graph,
    initialState:{generator:zero,discriminator:zero}};
  const programs=Object.fromEntries(Array.from({length:179},(_,i)=>['frozen-role-'+i,binding('scripts/synthetic/'+i+'.mjs')]));
  for(const [role,p]of Object.entries(ROLES))programs[role]=binding(p);
  const plan={schema:registration.PLAN_SCHEMA,executionProfile:registration.EXECUTION_PROFILE,executionMode:'bounded-quality-training',
    capabilityVersion:registration.CAPABILITY,runId,packageId,outputRoot,formalSpecification:registration.SPECIFICATION,
    sourceCandidate:registration.CANDIDATE,configuration:registration.deriveConfiguration(candidate),programBindings:programs,
    modelBinding:binding(outputRoot+'/model-identity.json'),finalCpuAcceptance:binding(outputRoot+'/cpu-acceptance.json'),
    datasetManifest:candidate.frozenBindings.datasetManifest,trainSplit:candidate.frozenBindings.trainSplit,validationSplit:candidate.frozenBindings.validationSplit,
    historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,
    runtimeIdentity:{python:{absolutePath:path.resolve('synthetic/python.exe'),sha256:zero},node:{absolutePath:process.execPath,sha256:zero}}};
  const packageBinding=binding('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json');
  const input={plan,packageBinding,planBinding:binding(outputRoot+'/quality-plan.json'),modelBinding:plan.modelBinding,modelIdentity:model};
  const f={root:process.cwd(),plan,packageBinding,input},store=new Map(),live=new WeakSet(),liveReceipts=new Map();
  const nativeCalls=[],registryWrites=[],liveBudgetReceipts=[],liveReceiptLookups=[];
  let current={registryRevision:409,activeExecution:null},terminal=null;
  const put=(_root,p,value)=>{assert.equal(store.has(p),false,'exclusive duplicate fixture write');store.set(p,clone(value));return binding(p);};
  function completed(){
    const checkpoint={epoch:24,counts:{generator:1152,discriminator:1152},checkpoint:binding(outputRoot+'/checkpoint-24.pt'),
      selection:{epoch:24,worstApplicableObjectCorrelation:.1,meanValidationRgbMae:.2,rank:[.1,-.2,-24],qualificationGranted:false,checkpointPromotionEligible:false}};
    const observation={epoch:12,capabilityVersion:registration.CAPABILITY,modelCapabilityVersion:registration.MODEL_CAPABILITY,runId,packageId,
      executionPackage:packageBinding,planBinding:input.planBinding,modelBinding:plan.modelBinding,datasetManifest:plan.datasetManifest,configurationSha256:zero,
      optimizerSteps:{generator:576,discriminator:576},checkpointSelectionEligible:false,weightUpdates:0,
      validation:Array.from({length:8},(_,i)=>({sampleId:'synthetic-observation-'+i,split:'validation',epoch:12,fullRgbMae:.2})),
      metrics:{epoch:12,qualificationGranted:false,checkpointPromotionEligible:false},artifact:binding(outputRoot+'/epoch-observation-12.json')};
    return {schema:'object-support-structure-quality-worker-terminal-v1',executionProfile:registration.EXECUTION_PROFILE,
      status:'training_completed_review_pending',executionState:'completed',capabilityVersion:registration.CAPABILITY,runId,packageId,executionPackage:packageBinding,
      optimizerSteps:{generator:1152,discriminator:1152},optimizerStepsGenerator:1152,optimizerStepsDiscriminator:1152,completedEpochs:24,
      checkpoints:[checkpoint],epochObservations:[observation],selectedCheckpointRecord:clone(checkpoint),checkpointReloadVerified:true,
      checkpointSelectionExecuted:true,validationRgbRead:true,captureStatus:'capture_not_triggered',originalError:null,
      challengeContentRead:false,regressionContentRead:false,checkpointPromotable:false,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false,automaticRetries:0};
  }
  const adapters=createPhaseAdaptersForIsolatedTests({
    loadContext:()=>f,write:put,json:(_root,b)=>{assert.ok(store.has(b.path),'missing private stub binding');return clone(store.get(b.path));},
    bind:(_root,p)=>{assert.ok(store.has(p));return binding(p);},inside:(r,p)=>path.resolve(r,p),read:()=>Buffer.from('synthetic-no-model-bytes'),
    processIdentity:()=> 'synthetic-process-creation',readRegistry:async()=>({ok:true,registry:clone(current),registrySha256:zero,currentTaskTerminal:clone(terminal)}),
    advanceRegistry:async options=>{registryWrites.push(clone(options));current={...current,registryRevision:current.registryRevision+1,activeExecution:options.activeExecution,
      capabilityVersion:options.capabilityVersion,packageId:options.packageId,runId:options.runId};terminal=clone(store.get(options.terminalEvidencePath));return {ok:true};},
    withNativeOrdinaryBudget:async(_r,receipt,action)=>{assert.ok(live.has(receipt));return action();},
    withNativeReceiptBudget:async(_r,receipt,action)=>{assert.ok(live.has(receipt));liveBudgetReceipts.push(receipt);return action();},
    requireLiveOwnedReceipt:(_root,b)=>{liveReceiptLookups.push(clone(b));const receipt=liveReceipts.get(b.path);
      assert.ok(receipt&&live.has(receipt),'same-process live receipt required; disk copy is not authority');return receipt;},
    hasGpuAcceptance:()=>store.has(outputRoot+'/gpu-acceptance.json'),hasConsumedQualification:()=>store.has(outputRoot+'/qualification-consumed.json'),
    hasOwnPreflight:()=>store.has(outputRoot+'/preflight.json'),verifyStoredPreflight:()=>({fixtureKind:'explicit-private-preflight-stub'}),
    hasLiveOwnedProof:p=>live.has(p),cleanupForCurrentCall:(error,last)=>live.has(Object.hasOwn(error,'ownedReceipt')?error.ownedReceipt:last),
    persistNativeFailureEvidence:async()=>({fixtureKind:'explicit-private-failure-stub'}),
    verifyGpuOutcome:()=>({fixtureKind:'simulated-protocol-no-GPU'}),verifyStoredGpuAcceptance:()=>assert.equal(invalidStored,false,'untrusted stored GPU receipt'),
    runNative:async options=>{
      nativeCalls.push(options);const receipt={fixtureKind:'explicit-private-stub-not-native',phase:options.phase,cleanupConfirmed:true,
        proof:{activeProcessesAfterCleanup:0},outputAccountingRoots:[outputRoot,outputRoot+'/dry-review-owned',outputRoot+'/dry-review']};
      const receiptBinding=binding(outputRoot+'/owned-'+options.phase+'.json');
      put(f.root,receiptBinding.path,receipt);
      if(options.phase==='cpu'||!unknownCleanup)live.add(receipt);
      if(!(options.phase==='review'&&diskOnlyReviewReceipt))liveReceipts.set(receiptBinding.path,receipt);
      if(options.phase==='cpu')return {stdout:JSON.stringify({status:'own_quality_entry_preflight_passed_not_gpu_qualified',gpuInitialized:false}),ownedReceipt:receipt,receiptBinding};
      if(options.phase==='qualification'){
        if(gpuFailure){const error=Error('synthetic gate failure');error.ownedReceipt=receipt;throw error;}
        return {stdout:JSON.stringify(binding(outputRoot+'/gpu-gate.json')),ownedReceipt:receipt,receiptBinding};
      }
      if(options.phase==='training'){
        const body=completed(),observation=clone(body.epochObservations[0]);delete observation.artifact;
        put(f.root,outputRoot+'/epoch-observation-12.json',observation);
        return {stdout:JSON.stringify(put(f.root,outputRoot+'/worker-terminal.json',body)),ownedReceipt:receipt,receiptBinding};
      }
      assert.equal(options.phase,'review');
      const core={schema:'object-support-structure-machine-audit-core-v1',status:'dry_single_world_numeric_passed_visual_approval_pending',
        capabilityVersion:registration.CAPABILITY,runId,packageId,executionPackage:packageBinding,
        input:binding(outputRoot+'/dry-review/cpu-review.json'),selectedCheckpoint:completed().selectedCheckpointRecord.checkpoint,
        formalStage4QualificationGranted:false,runtimePublicationGranted:false};
      return {stdout:JSON.stringify(put(f.root,outputRoot+'/dry-review/machine-audit-core.json',core)),ownedReceipt:receipt,receiptBinding};
    },
  });
  return {f,store,adapters,nativeCalls,registryWrites,liveReceipts,liveBudgetReceipts,liveReceiptLookups,getCurrent:()=>current};
}

test('mock qualificationOnly cannot enter training, optimizer, checkpoint or training-terminal handoff',async()=>{
  const s=simulated(),out=await s.adapters.qualifyOnly({heartbeat(){}}),base=s.f.plan.outputRoot;
  assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification']);assert.equal(out.trainingStarted,false);assert.equal(out.optimizerSteps,0);
  assert.equal(s.nativeCalls[1].args[1],path.resolve(s.f.root,ROLES.gpuQualifier));
  assert.equal(s.store.has(base+'/worker-terminal.json'),false);assert.equal(s.store.has(base+'/execution-consumed.json'),false);
  const terminal=s.store.get(base+'/qualification-only-terminal.json');
  assert.equal(terminal.schema,'object-support-structure-quality-pretraining-terminal-v1');
  for(const flag of ['trainingStarted','checkpointWritten','formalStage4QualificationAllowed','runtimePublicationAllowed'])assert.equal(terminal[flag],false);
  assert.equal(terminal.optimizerStepsGenerator,0);assert.equal(terminal.optimizerStepsDiscriminator,0);
  assert.equal(s.registryWrites.at(-1).latestTrainingTerminal,undefined);assert.equal(s.getCurrent().activeExecution,null);
  await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}),/twice/u);assert.equal(s.nativeCalls.length,2);
});

test('mock consumed qualification is rejected before preflight or training',async()=>{
  const s=simulated();s.store.set(s.f.plan.outputRoot+'/qualification-consumed.json',{attempt:1});
  await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}),/cannot retry/u);
  await assert.rejects(s.adapters.execute({heartbeat(){}}),/cannot retry/u);
  assert.equal(s.nativeCalls.length,0);assert.equal(s.registryWrites.length,0);
});

test('mock GPU gate failure closes without training and consumed qualification cannot retry',async()=>{
  const s=simulated({gpuFailure:true});await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}),/synthetic gate failure/u);
  assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification']);assert.equal(s.registryWrites.at(-1).executionState,'failed_closed');
  assert.equal(s.getCurrent().activeExecution,null);assert.equal(s.store.has(s.f.plan.outputRoot+'/worker-terminal.json'),false);
  await assert.rejects(s.adapters.execute({heartbeat(){}}),/cannot retry/u);assert.equal(s.nativeCalls.length,2);
});

test('mock same-package stored gate reaches worker once and cannot consume execution twice',async()=>{
  const s=simulated();await s.adapters.qualifyOnly({heartbeat(){}});await s.adapters.execute({heartbeat(){}});
  assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification','training']);
  assert.equal(s.store.get(s.f.plan.outputRoot+'/dispatched.json').status,'training_pending');
  assert.equal(s.registryWrites.at(-1).latestTrainingTerminal.status,'training_completed_review_pending');
  await assert.rejects(s.adapters.execute({heartbeat(){}}));assert.equal(s.nativeCalls.length,3);
});

test('full mock six-phase handoff keeps new identity and uses the live review object, not its disk copy',async()=>{
  const s=simulated(),context={heartbeat(){}},base=s.f.plan.outputRoot;
  await s.adapters.preflight(context);await s.adapters.execute(context);await s.adapters.validate(context);
  await s.adapters.review(context);await s.adapters.adjudicate(context);const out=await s.adapters.finalize(context);
  assert.equal(out.status,'passed');assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification','training','review']);
  assert.equal(s.nativeCalls[2].args[1],path.resolve(s.f.root,ROLES.worker));
  assert.equal(s.nativeCalls[3].args[0],path.resolve(s.f.root,ROLES.reviewDriver));
  assert.deepEqual(s.nativeCalls[3].args.slice(-4),['--terminal',base+'/worker-terminal.json','--terminal-sha256','1'.repeat(64)]);
  const terminal=s.store.get(base+'/worker-terminal.json'),audit=s.store.get(base+'/dry-review/machine-audit.json'),final=s.store.get(base+'/finalization.json');
  assert.equal(terminal.executionProfile,registration.EXECUTION_PROFILE);assert.equal(terminal.schema,'object-support-structure-quality-worker-terminal-v1');
  for(const body of [terminal,audit,final]){assert.equal(body.capabilityVersion,registration.CAPABILITY);assert.deepEqual(body.executionPackage,s.f.packageBinding);}
  assert.deepEqual(audit.selectedCheckpoint,terminal.selectedCheckpointRecord.checkpoint);
  assert.equal(final.schema,'object-support-structure-quality-review-terminal-v1');assert.equal(final.executionState,'completed');
  assert.equal(final.formalStage4QualificationGranted,false);assert.equal(final.runtimePublicationGranted,false);assert.equal(s.getCurrent().activeExecution,null);
  assert.deepEqual(s.liveReceiptLookups,[binding(base+'/owned-review.json')]);
  assert.equal(s.liveBudgetReceipts.at(-1),s.liveReceipts.get(base+'/owned-review.json'));
  assert.notEqual(s.liveBudgetReceipts.at(-1),s.store.get(base+'/owned-review.json'));
});

test('mock finalization refuses a structurally valid disk-only review receipt',async()=>{
  const s=simulated({diskOnlyReviewReceipt:true}),context={heartbeat(){}};
  await s.adapters.execute(context);await s.adapters.validate(context);await s.adapters.review(context);
  await assert.rejects(s.adapters.finalize(context),/same-process live receipt required/u);
  assert.equal(s.store.has(s.f.plan.outputRoot+'/finalization.json'),false);
  assert.equal(s.registryWrites.at(-1).activity,'training_completed_review_pending');
});

test('mock unknown live cleanup retains active identity and cannot sign a GPU acceptance',async()=>{
  const s=simulated({unknownCleanup:true});await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}));
  assert.equal(s.registryWrites.length,1);assert.ok(s.getCurrent().activeExecution);
  assert.equal(s.store.has(s.f.plan.outputRoot+'/gpu-acceptance.json'),false);
});

test('mock invalid stored gate cannot consume execution or dispatch a worker',async()=>{
  const s=simulated({invalidStored:true});await s.adapters.qualifyOnly({heartbeat(){}});
  await assert.rejects(s.adapters.execute({heartbeat(){}}),/untrusted stored GPU receipt/u);
  assert.equal(s.store.has(s.f.plan.outputRoot+'/execution-consumed.json'),false);assert.equal(s.nativeCalls.length,2);
});

// The managed harness supplies the real declaration and the existing native
// keeper. Standalone CPU tests use ordinary real WAL connections in this same
// process, with the identical request/ready/ack/consumed protocol. Neither mode
// starts a process or grants native cleanup/production authority.
let registryContext,managedKeeper=false;
const componentKeepers=new Map(),actionSequences=new Map();
function cpuKeeperWrite(logical,value){
  const entry=fixtureOutputRoot();assert.ok(logical.startsWith(entry+'/'),'keeper output outside CPU budget root');
  const raw=Buffer.from(JSON.stringify(value)+'\n');assert.ok(raw.length<=8192,'bounded keeper message');
  checkFixtureBudget(raw.length);const target=inside(process.cwd(),logical);
  fs.mkdirSync(path.dirname(target),{recursive:true});const fd=fs.openSync(target,'wx');
  try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  return {path:logical,sha256:digest(raw)};
}
function cpuRegistryContext(){
  if(registryContext)return registryContext;
  const entryRoot=fixtureOutputRoot(),project=process.cwd();
  const declarationPath=entryRoot.replace(/\/cpu-entry$/u,'')+'/cpu-negative-inputs/input-declaration.json';
  if(fs.existsSync(inside(project,declarationPath))){
    managedKeeper=true;
    const declaration=fileBinding(project,declarationPath),body=JSON.parse(readBound(project,declaration));
    const request=body.request,current=JSON.parse(readBound(project,request));
    assert.equal(body.schema,'cpu-negative-input-declaration-v1');
    assert.equal(current.schema,'object-support-structure-quality-cpu-request-v1');
    assert.equal(current.outputRoot,entryRoot);assert.deepEqual(current.programBindings,body.programBindings);
    assert.deepEqual(current.formalSpecification,registration.executionRoute(current.configuration.capabilityVersion).SPECIFICATION);
    assert.equal(body.runId,current.runId);assert.equal(body.packageId,current.packageId);
    assert.equal(request.path,entryRoot.replace(/\/cpu-entry$/u,'')+'/cpu-request.json');
    assert.match(body.callIdentity,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u);
    registryContext={entryRoot,request,declaration,callIdentity:body.callIdentity};
  }else{
    assert.equal(Boolean(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT),false,'managed CPU declaration missing; no component fallback');
    const callIdentity=crypto.randomUUID();
    const request=cpuKeeperWrite(entryRoot+'/fixture-context/request.json',{
      schema:'object-support-structure-quality-isolated-sqlite-request-v1',outputRoot:entryRoot,
      capabilityVersion:registration.CAPABILITY,callIdentity,fixtureOnly:true,nativeOwnerAllowed:false});
    const declaration=cpuKeeperWrite(entryRoot+'/fixture-context/declaration.json',{
      schema:'cpu-registry-fixture-isolated-declaration-v1',request,callIdentity,nativeAuthorityClaimed:false});
    registryContext={entryRoot,request,declaration,callIdentity};
  }
  return registryContext;
}
function isolatedRegistryRoot(name){
  assert.ok(['dispatch','finalization','failure'].includes(name));const context=cpuRegistryContext();
  const logical=context.entryRoot+'/r/'+name,physical=inside(process.cwd(),logical);
  assert.equal(fs.existsSync(physical),false,'old registry fixture refused');fs.mkdirSync(physical,{recursive:true});
  // Preserve the established short logical Windows path for SQLite sidecars.
  return path.resolve(process.cwd(),logical);
}
function serveComponentKeeper(root,context,request,requestBinding,readyStat){
  assert.equal(managedKeeper,false);assert.equal(componentKeepers.has(request.name),false);
  assert.deepEqual(fs.readdirSync(root),[],'fresh component keeper fixture required');
  const logical=request.root,registry=logical+'/.runtime/ai-painter/current-execution-registry';
  const database=registry+'/registry.sqlite',databasePath=path.resolve(root,'.runtime/ai-painter/current-execution-registry/registry.sqlite');
  if(process.platform==='win32')assert.ok(databasePath.length+12<260,'SQLite sidecar path ceiling');
  fs.mkdirSync(path.dirname(databasePath),{recursive:true});
  const connection=new DatabaseSync(databasePath);
  const slot={connection,root,logical,database,closed:false};componentKeepers.set(request.name,slot);
  connection.exec('PRAGMA journal_mode = WAL; PRAGMA user_version = 0;');
  assert.equal(connection.prepare('PRAGMA journal_mode').get().journal_mode,'wal');
  assert.equal(connection.prepare('SELECT COUNT(*) AS count FROM sqlite_schema').get().count,0);
  assert.equal(connection.isTransaction,false);
  const expected=[[logical,true],[logical+'/.runtime',true],[logical+'/.runtime/ai-painter',true],[registry,true],
    [database,false],[database+'-wal',false],[database+'-shm',false]];
  const identities=expected.map(([p,directory])=>{
    const stat=fs.lstatSync(inside(process.cwd(),p),{bigint:true});
    assert.ok(!stat.isSymbolicLink()&&(directory?stat.isDirectory():stat.isFile()));
    return {path:p,directory,identity:`${stat.dev}:${stat.ino}`};
  });
  assert.equal(identities[0].identity,request.rootIdentity);checkFixtureBudget();
  const acknowledgement=cpuKeeperWrite(context.entryRoot+'/sqlite-keeper-ack-'+request.name+'.json',{
    schema:'cpu-registry-fixture-keeper-ack-v1',...context,name:request.name,root:logical,rootIdentity:request.rootIdentity,
    childRequest:requestBinding,readyIdentity:`${readyStat.dev}:${readyStat.ino}`,identities,
    walActivated:true,emptySchema:true,activeTransaction:false,keeperWritesWhileChildActive:0,nativeAuthorityClaimed:false});
  const fd=fs.openSync(inside(process.cwd(),context.entryRoot+'/sqlite-keeper-ack-'+request.name+'.ready'),'wx');
  try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  slot.acknowledgement=acknowledgement;slot.identities=identities;
}
async function acquireRegistryKeeper(root){
  const context=cpuRegistryContext(),logical=path.relative(process.cwd(),root).replaceAll('\\','/'),name=path.basename(root);
  const stat=fs.lstatSync(root,{bigint:true});assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
  const request={schema:'cpu-registry-fixture-keeper-request-v1',...context,name,root:logical,rootIdentity:`${stat.dev}:${stat.ino}`};
  delete request.entryRoot;validateCpuRegistryFixtureLeaseRequest(context,request);
  const requestBinding=cpuKeeperWrite(context.entryRoot+'/sqlite-keeper-request-'+name+'.json',request);
  const readyPath=inside(process.cwd(),context.entryRoot+'/sqlite-keeper-request-'+name+'.ready'),fd=fs.openSync(readyPath,'wx');
  try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  const readyStat=fs.lstatSync(readyPath,{bigint:true});
  if(!managedKeeper)serveComponentKeeper(root,context,request,requestBinding,readyStat);
  const ackReady=inside(process.cwd(),context.entryRoot+'/sqlite-keeper-ack-'+name+'.ready'),deadline=Date.now()+5000;
  while(!fs.existsSync(ackReady)){
    assert.ok(Date.now()<deadline,'same-call SQLite keeper acknowledgement deadline');
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  const notify=fs.lstatSync(ackReady,{bigint:true});assert.ok(notify.isFile()&&!notify.isSymbolicLink()&&notify.size===0n);
  const acknowledgement=fileBinding(process.cwd(),context.entryRoot+'/sqlite-keeper-ack-'+name+'.json');
  const ack=JSON.parse(readBound(process.cwd(),acknowledgement));assert.equal(ack.schema,'cpu-registry-fixture-keeper-ack-v1');
  for(const key of ['callIdentity','entryRoot','request','declaration'])assert.deepEqual(ack[key],context[key]);
  assert.deepEqual(ack.childRequest,requestBinding);assert.equal(ack.name,name);assert.equal(ack.root,logical);
  assert.equal(ack.rootIdentity,request.rootIdentity);assert.equal(ack.readyIdentity,`${readyStat.dev}:${readyStat.ino}`);
  assert.equal(ack.walActivated,true);assert.equal(ack.emptySchema,true);assert.equal(ack.activeTransaction,false);
  assert.equal(ack.keeperWritesWhileChildActive,0);assert.equal(ack.nativeAuthorityClaimed,false);
  const registry=logical+'/.runtime/ai-painter/current-execution-registry',database=registry+'/registry.sqlite';
  const expected=[[logical,true],[logical+'/.runtime',true],[logical+'/.runtime/ai-painter',true],[registry,true],
    [database,false],[database+'-wal',false],[database+'-shm',false]];
  assert.equal(ack.identities.length,expected.length);
  for(const [i,[p,directory]]of expected.entries()){
    const s=fs.lstatSync(inside(process.cwd(),p),{bigint:true}),actual=ack.identities[i];
    assert.equal(actual.path,p);assert.equal(actual.directory,directory);
    assert.ok(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()));assert.equal(actual.identity,`${s.dev}:${s.ino}`);
  }
  cpuKeeperWrite(context.entryRoot+'/sqlite-keeper-consumed-'+name+'.json',{
    schema:'cpu-registry-fixture-keeper-consumed-v1',...context,name,root:logical,rootIdentity:request.rootIdentity,
    childRequest:requestBinding,acknowledgement,identities:ack.identities,nativeAuthorityClaimed:false});
}
function fixtureWrite(root,logical,value){
  const allowed=fs.realpathSync(inside(process.cwd(),fixtureOutputRoot())),resolved=fs.realpathSync(root);
  const scope=path.relative(allowed,resolved);assert.ok(scope&&!scope.startsWith('..')&&!path.isAbsolute(scope),'private registry root outside CPU budget');
  const target=path.resolve(root,logical),relative=path.relative(root,target);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));fs.mkdirSync(path.dirname(target),{recursive:true});
  const raw=Buffer.from(JSON.stringify(value)+'\n');checkFixtureBudget(raw.length);
  if(fs.existsSync(target))assert.deepEqual(fs.readFileSync(target),raw,'fixture evidence cannot be overwritten');
  else fs.writeFileSync(target,raw,{flag:'wx'});
  return {path:logical,sha256:digest(raw)};
}
async function initializeIsolatedRegistry(root){
  await acquireRegistryKeeper(root);
  const candidate=fixtureWrite(root,'fixture/candidate.json',{schemaVersion:'stage4-post-decode-bounded-candidate-v1',status:'cpu_inactive_candidate_planned_not_implemented'});
  const terminal=fixtureWrite(root,'fixture/planning-terminal.json',{schemaVersion:'stage4-post-decode-failure-bounded-planning-terminal-v1',executionState:'completed',
    status:'bounded_candidate_planning_completed',planningRunId:'isolated-cpu-plan',nextAction:'cpu-fixture-only',candidate});
  const capsule=fixtureWrite(root,'fixture/planning-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v2',latestTerminal:terminal});
  const latest=fixtureWrite(root,'fixture/formal/phase-terminal.json',{schemaVersion:'stage4-post-decode-object-rgb-stage0-terminal-v1',executionState:'completed',
    status:'post_decode_object_rgb_stage0_real_visual_failure',runId:'isolated-historical-fixture'});
  fixtureWrite(root,'fixture/formal/execution-state.json',{status:'fixture_only'});
  fixtureWrite(root,'fixture/formal/machine-review.json',{status:'fixture_only'});
  fixtureWrite(root,'fixture/formal/training-output/progress.json',{status:'fixture_only'});
  const initial=await initializeCurrentExecutionRegistry({projectRoot:root,currentTaskCapsulePath:capsule.path,currentTaskTerminalPath:terminal.path,
    currentCandidatePath:candidate.path,latestTrainingTerminalPath:latest.path,archivedEvidenceNamespaces:[]});
  assert.equal(initial.ok,true);checkFixtureBudget();return initial;
}
function registryFixtureIdentity(name){
  return {plan:{runId:'sql-'+name+'-run',packageId:'sql-'+name+'-pkg'},
    packageBinding:binding('.runtime/ai-painter/autonomous-closed-loop-packages/sql-'+name+'-pkg/package.json')};
}
function registryOptions(root,f,initial,evidence,{state='completed',activeExecution=null}={}){
  const sequence=(actionSequences.get(root)??0)+1;actionSequences.set(root,sequence);
  const packageBinding=fixtureWrite(root,f.packageBinding.path,{fixtureKind:'isolated-package-not-production',runId:f.plan.runId});
  const terminal=fixtureWrite(root,'fixture/action-terminal-'+sequence+'.json',{...evidence,executionPackage:packageBinding});
  const capsule=fixtureWrite(root,'fixture/action-capsule-'+sequence+'.json',{schemaVersion:'ai-painter-local-task-capsule-v1',integrity:{status:'verified'},
    evidence:[{...terminal,kind:'actual_action_terminal',sha256Verified:true},{...packageBinding,kind:'isolated_execution_package',sha256Verified:true}]});
  return {projectRoot:root,capabilityVersion:registration.CAPABILITY,packageId:f.plan.packageId,runId:f.plan.runId,taskId:f.plan.runId,
    taskKind:'object_support_structure_quality_cpu_fixture',taskGoal:'CPU-only isolated registry contract verification; no production execution.',
    lifecycleStage:'dry_single_world_256x192',executionState:state,activity:'diagnostic_fixture_terminal',
    queueStatus:state==='executing'?'running':state==='package_materialized'?'ready':state,
    nextMachineAction:state==='package_materialized'?f.plan.runId:null,taskCapsulePath:capsule.path,terminalEvidencePath:terminal.path,activeExecution,
    expectedPreviousRegistryRevision:initial.registry.registryRevision,expectedPreviousRegistrySha256:initial.registrySha256,
    _testHooks:{currentProcessIdentity:'explicit-isolated-cpu-writer'}};
}
async function publishPrepared(options){
  const prepared=await prepareCurrentExecutionRegistryAdvance(options);assert.equal(prepared.status,'prepared_not_published');
  const result=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:options.projectRoot,transactionId:prepared.transactionId,_testHooks:options._testHooks});
  assert.equal(result.ok,true);checkFixtureBudget();return result;
}
function recordRegistryProof(root,proof,read){
  const databasePath=path.resolve(root,'.runtime/ai-painter/current-execution-registry/registry.sqlite');
  const database=new DatabaseSync(databasePath,{readOnly:true});let revision,transaction;
  try{
    revision=database.prepare('SELECT * FROM registry_revisions WHERE registry_revision = ?').get(read.registry.registryRevision);
    assert.equal(revision.current_sha256,read.registrySha256);assert.equal(revision.transaction_id,read.registry.transactionId);
    transaction=database.prepare('SELECT * FROM registry_transactions WHERE transaction_id = ?').get(read.registry.transactionId);
    assert.equal(transaction.status,'committed');assert.equal(transaction.current_sha256,read.registrySha256);
  }finally{database.close();}
  fixtureWrite(root,'fixture-proof.json',{...proof,fixtureKind:'actual-isolated-registry-IO-and-SHA-not-production',projectRoot:root,
    publicRegistryCodeMocked:false,readerMocked:false,nativeCalls:0,gpuCalls:0,productionRegistryWrites:0,
    writerIdentityTestHookUsed:true,realActiveProcessLivenessVerified:false,sqliteRevision:{...revision},sqliteTransaction:{...transaction},
    externalManagedKeeper:managedKeeper});
}

test('real CPU registry dispatch keeps completed dispatch evidence and rejects missing active identity',async()=>{
  const f=registryFixtureIdentity('dispatch'),root=isolatedRegistryRoot('dispatch'),initial=await initializeIsolatedRegistry(root);
  const dispatch={schema:'object-support-structure-quality-dispatch-completed-v1',status:'diagnostic_dispatched',executionState:'completed',
    capabilityVersion:registration.CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,trainingStarted:false,gpuStarted:false};
  const before=fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),rejections=[];
  for(const state of [undefined,'qualification_pending','executing']){
    const body={...dispatch};if(state===undefined)delete body.executionState;else body.executionState=state;
    await assert.rejects(prepareCurrentExecutionRegistryAdvance(registryOptions(root,f,initial,body,{state:'package_materialized'})),/advanced_terminal_not_completed/u);
    rejections.push(state??'missing');assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
  }
  await assert.rejects(prepareCurrentExecutionRegistryAdvance(registryOptions(root,f,initial,dispatch,{state:'executing'})),/registry_active_execution_missing/u);
  assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),before);
  const accepted=await publishPrepared(registryOptions(root,f,initial,dispatch,{state:'package_materialized'}));
  const read=await readCurrentExecutionRegistry(root);assert.equal(read.ok,true);assert.equal(read.registry.activeExecution,null);
  assert.equal(read.registry.executionState,'package_materialized');assert.equal(read.currentTaskTerminal.executionState,'completed');
  assert.equal(read.currentTaskTerminal.trainingStarted,false);assert.equal(read.currentTaskTerminal.gpuStarted,false);
  recordRegistryProof(root,{rejections,executingWithoutActiveIdentityRejected:true,acceptedRevision:accepted.registry.registryRevision,
    readerVerified:read.ok,terminal:read.currentTaskTerminal},read);
});

test('real CPU registry finalization rejects incomplete state and changed actual terminal bytes',async()=>{
  const f=registryFixtureIdentity('finalization'),root=isolatedRegistryRoot('finalization'),initial=await initializeIsolatedRegistry(root);
  const final={schema:'object-support-structure-quality-review-terminal-v1',status:'dry_single_world_review_passed',executionState:'completed',
    capabilityVersion:registration.CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,formalStage4QualificationGranted:false,runtimePublicationGranted:false};
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
  recordRegistryProof(root,{tamperedActualBytesRejected:true,tamperedTerminalPath:tampered.terminalEvidencePath,
    acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,terminal:read.currentTaskTerminal},read);
});

test('real CPU registry failure preserves the first error and separate partial update counts',async()=>{
  const f=registryFixtureIdentity('failure'),root=isolatedRegistryRoot('failure'),initial=await initializeIsolatedRegistry(root);
  const failure={schema:'object-support-structure-quality-worker-terminal-v1',status:'failed_closed',executionState:'failed_closed',
    capabilityVersion:registration.CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,
    optimizerSteps:{generator:1151,discriminator:1152},optimizerStepsGenerator:1151,optimizerStepsDiscriminator:1152,
    originalError:{message:'synthetic primary G error'},formalStage4QualificationAllowed:false,runtimePublicationAllowed:false};
  const accepted=await publishPrepared(registryOptions(root,f,initial,failure,{state:'failed_closed'})),read=await readCurrentExecutionRegistry(root);
  assert.equal(read.ok,true);assert.equal(read.registry.activeExecution,null);assert.equal(read.currentTaskTerminal.executionState,'failed_closed');
  assert.equal(read.currentTaskTerminal.optimizerStepsGenerator,1151);assert.equal(read.currentTaskTerminal.optimizerStepsDiscriminator,1152);
  assert.deepEqual(read.currentTaskTerminal.optimizerSteps,{generator:1151,discriminator:1152});
  assert.equal(read.currentTaskTerminal.originalError.message,'synthetic primary G error');
  assert.equal(read.currentTaskTerminal.formalStage4QualificationAllowed,false);assert.equal(read.currentTaskTerminal.runtimePublicationAllowed,false);
  recordRegistryProof(root,{acceptedRevision:accepted.registry.registryRevision,readerVerified:read.ok,terminal:read.currentTaskTerminal},read);
});

after(()=>{
  if(componentKeepers.size===0)return;const observations=[];
  for(const [name,slot]of componentKeepers){
    const sidecars=slot.identities.filter(item=>/registry\.sqlite-(wal|shm)$/u.test(item.path)).map(item=>({path:item.path,
      beforeBytes:fs.statSync(inside(process.cwd(),item.path)).size}));
    slot.connection.close();slot.closed=true;
    for(const item of sidecars)item.afterBytes=fs.existsSync(inside(process.cwd(),item.path))?fs.statSync(inside(process.cwd(),item.path)).size:0;
    observations.push({name,closed:true,sidecars});
  }
  cpuKeeperWrite(fixtureOutputRoot()+'/component-keeper-lifecycle.json',{
    schema:'object-support-structure-quality-isolated-sqlite-keeper-lifecycle-v1',outputRoot:fixtureOutputRoot(),
    nativeAuthorityClaimed:false,processCleanupQualificationGranted:false,observations});
  checkFixtureBudget();process.stdout.write('# retained CPU fixture evidence: '+fixtureOutputRoot()+'\n');
});


test('worker nonzero exit remains primary when subsequent keeper completeness checks fail',()=>{
 const primary=primaryErrorBeforeNativeFinalization({proof:{exitCode:1}});
 assert.equal(primary.message,'worker_exit_1');assert.equal(primary.status,1);
 const stderr='Traceback: cross Run data closure path\n';
 const receipt={workerStderrTail:stderr,cpuRegistryFixtures:{opened:[],childConsumptions:[],consumptionErrors:[]},cleanupConfirmed:false};
 let fixtureCleanup=true;
 try{assert.equal(receipt.cpuRegistryFixtures.opened.length,3,'all three current SQLite fixture keepers required');}
 catch(error){fixtureCleanup=false;receipt.cpuRegistryKeeperError=String(error);receipt.cpuRegistryKeeperErrorIsSecondary=primary!==null;}
 const finalError=primary??Error(receipt.cpuRegistryKeeperError);finalError.ownedReceipt=receipt;
 assert.equal(finalError,primary);assert.equal(fixtureCleanup,false);assert.equal(receipt.cleanupConfirmed,false);
 assert.equal(receipt.cpuRegistryKeeperErrorIsSecondary,true);assert.equal(receipt.cpuRegistryFixtures.opened.length,0);
 assert.equal(receipt.workerStderrTail,stderr);assert.equal(boundedNativeFailureMetadata(finalError).reason,'worker_exit_1');
 assert.equal(boundedNativeFailureMetadata(finalError).exitStatus,1);
});

test('an earlier native error, resource stop or transport error keeps precedence over worker exit',()=>{
 const earlier=Object.assign(Error('original native failure'),{code:'EIO'});
 assert.equal(primaryErrorBeforeNativeFinalization({primaryError:earlier,stopReason:'wall_timeout',protocolError:'native_protocol_error',proof:{exitCode:1}}),earlier);
 assert.equal(primaryErrorBeforeNativeFinalization({stopReason:'wall_timeout',protocolError:'native_protocol_error',proof:{exitCode:1}}).message,'wall_timeout');
 assert.equal(primaryErrorBeforeNativeFinalization({protocolError:'native_protocol_error',proof:{exitCode:1}}).message,'native_protocol_error');
 for(const status of [2,137,255])assert.equal(primaryErrorBeforeNativeFinalization({proof:{exitCode:status}}).message,'worker_exit_'+status);
});

test('zero or missing worker exit cannot manufacture an execution failure or bypass later failed checks',()=>{
 for(const proof of [null,{}, {exitCode:0},{exitCode:'1'}])assert.equal(primaryErrorBeforeNativeFinalization({proof}),null);
 const postcondition=Error('all three current SQLite fixture keepers required');
 const primary=primaryErrorBeforeNativeFinalization({proof:{exitCode:0}});
 assert.equal(primary??postcondition,postcondition);
});
