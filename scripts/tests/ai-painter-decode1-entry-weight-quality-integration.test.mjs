import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync,spawn} from 'node:child_process';
import * as registration from '../lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs';
import * as candidateChain from '../lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs';
import {resolveNativeTiming} from '../lib/ai-painter-decode1-entry-completion-native-owner-v1.mjs';
import {collectActualExecutionSources,sourceCollectionReport} from '../lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs';
import {isResourceGuardMessage,primaryErrorForControlStream,hasLiveOwnedProof,cleanupForCurrentCall,requireLiveOwnedReceipt,nativeBudget,deferCompletionParserUntilSpawn,runNative}
 from '../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs';
import {localPreparationRoute,LOCAL_DECODE1_ENTRY_WEIGHT_PREPARE_REGISTRATION,LOCAL_DECODE1_ENTRY_COMPLETION_PREPARE_REGISTRATION,LOCAL_DECODE1_ENTRY_COMPLETION_V2_PREPARE_REGISTRATION,LOCAL_DECODE1_ENTRY_SAME_CALL_PREPARE_REGISTRATION,verifyPreparationSources}
 from '../lib/ai-painter-local-prepare-v1.mjs';
import {validateLocalStartPackage,LOCAL_DECODE1_ENTRY_WEIGHT_CONTROL_REGISTRATION,LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION,LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION,LOCAL_DECODE1_ENTRY_SAME_CALL_CONTROL_REGISTRATION}
 from '../run-ai-painter-local-control-v1.mjs';
import {verifyGpuOutcome,parsePreparationArguments,createPreparationAdaptersForIsolatedTests,createPhaseAdaptersForIsolatedTests}
  from '../run-ai-painter-decode1-entry-weight-quality-v1.mjs';
import {inside,bind as fileBinding,read as readBound,directoryBytes,ROLES,withOutputBudget as withCandidateOutputBudget,write as writeCandidateBudgeted}
  from '../lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs';
import {directoryBytes as historicalDirectoryBytes} from '../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';
import {write as writeCandidateAccounting} from '../lib/ai-painter-decode1-entry-weight-output-accounting-v1.mjs';
import {decodeTrainingInterfaceJson,parseTrainingInterfacePolicy} from '../../src/server/ai-console/training-preview-history-v1.mjs';

test('registered interface index is shared by preparation and Python without changing candidate consumers',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'painter-interface-cpu-'));
 try{
  const policy=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v5.json'));
  const index={schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',normalAuthority:'local_ai_pet_world_program',ownerInNormalStateMachine:false,trainingInterfaces:[]};
  for(const suffix of ['alpha','beta']){
   const p=structuredClone(policy),selector=`interface-fixture-${suffix}`;p.candidate=`interface_fixture_${suffix}_v1`;p.candidateSelection=selector;
   p.outputRoot=`.runtime/ai-painter/registered-training-${selector}-executions`;p.executionProfile=`interface_fixture_${suffix}_profile`;
   Object.assign(p.interfaceContract,{candidateSelection:selector,runPrefix:selector+'-',packagePrefix:selector+'-package-'});
   const file=`data/ai-painter/system-governance/interface-fixture-${suffix}.json`,raw=Buffer.from(JSON.stringify(p));
   fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),raw);
   index.trainingInterfaces.push({candidateSelection:selector,executionPolicy:{path:file,sha256:crypto.createHash('sha256').update(raw).digest('hex')}});
  }
  const indexFile=path.join(root,registration.INTERFACE_REGISTRY_PATH);fs.writeFileSync(indexFile,JSON.stringify(index));
  const actual=registration.registeredTrainingInterfaces(root);assert.equal(actual.length,2);
  for(const p of actual)assert.equal(localPreparationRoute(p.candidateSelection,root).capability,p.CAPABILITY);
  const code="import sys,json;sys.path.insert(0,sys.argv[1]);from ai_painter.complete_world import decode1_entry_weight_quality_checkpoint_v1 as c;print(json.dumps([{'capability':r['capability'],'root':r['root_prefix'],'profile':r['profile']} for r in c.registered_training_interfaces(sys.argv[2])]))";
  const python=spawnSync(path.resolve('ml/ai-painter/.venv/Scripts/python.exe'),['-I','-B','-c',code,path.resolve('ml/ai-painter/src'),root],
   {encoding:'utf8',timeout:15000,windowsHide:true,env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'}});
  assert.equal(python.status,0,python.stderr);assert.deepEqual(JSON.parse(python.stdout),actual.map(p=>({capability:p.CAPABILITY,root:p.OUTPUT_ROOT+'/',profile:p.EXECUTION_PROFILE})));
  fs.writeFileSync(indexFile,JSON.stringify({...index,trainingInterfaces:[...index.trainingInterfaces,index.trainingInterfaces[0]]}));
  assert.throws(()=>registration.registeredTrainingInterfaces(root),/duplicate training interface/);
  fs.writeFileSync(indexFile,JSON.stringify({...index,trainingInterfaces:[{...index.trainingInterfaces[0],executionPolicy:{...index.trainingInterfaces[0].executionPolicy,sha256:'0'.repeat(64)}}]}));
  assert.throws(()=>registration.registeredTrainingInterfaces(root),/SHA differs/);
 }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('painter-interface-cpu-'));fs.rmSync(root,{recursive:true});}
});
test('interface JSON rejects duplicate/escaped keys, nonfinite values, invalid UTF8 and unsupported protocols',()=>{
 for(const raw of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"x":1e999}','{"x":1,}','[1,,2]'])assert.throws(()=>decodeTrainingInterfaceJson(Buffer.from(raw)));
 assert.throws(()=>decodeTrainingInterfaceJson(Buffer.from([0xff])),/encoding/);
 assert.deepEqual(decodeTrainingInterfaceJson(Buffer.from('{"x":[1,true,null,"quoted\\\"value"]}')),{x:[1,true,null,'quoted"value']});
 const policy=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v5.json'));
 for(const change of [p=>p.interfaceContract.protocols.progress='arbitrary',p=>p.interfaceContract.adapterId='external_import',
  p=>p.outputRoot='.runtime/ai-painter/foreign',p=>p.phaseResources.programFileCountMaximum=257]){
  const changed=structuredClone(policy);change(changed);assert.throws(()=>parseTrainingInterfacePolicy(changed));
 }
});
test('same-call route uses an independent identity and exact registered control/preparation without changing model or learning',()=>{
 const route=registration.executionRoute(registration.SAME_CALL_CAPABILITY);
 assert.equal(route.sameCallCapture,true);assert.equal(route.qualificationCompletion,true);
 assert.notEqual(route.CAPABILITY,registration.COMPLETION_V2_CAPABILITY);
 assert.notEqual(route.OUTPUT_ROOT,registration.COMPLETION_V2_PROFILE.OUTPUT_ROOT);
 const candidate=JSON.parse(fs.readFileSync(registration.CANDIDATE.path,'utf8'));
 const current=registration.deriveConfiguration(candidate,{capabilityVersion:route.CAPABILITY,trainingPreviewPolicy:{path:route.previewPath,sha256:'a'.repeat(64)}});
 const old=registration.deriveConfiguration(candidate,{capabilityVersion:registration.COMPLETION_V2_CAPABILITY,trainingPreviewPolicy:{path:registration.COMPLETION_V2_PROFILE.previewPath,sha256:'a'.repeat(64)}});
 for(const key of ['modelCapabilityVersion','lossDefinition','gradientDefinition','optimizer','executionCeiling','dataUse','seed','checkpointSelection'])assert.deepEqual(current[key],old[key]);
 assert.equal(current.gpuAdmissionSeconds,null);assert.equal(current.gpuAdmissionWallMode,'completion');
 const index=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json'));
 for(const expected of [LOCAL_DECODE1_ENTRY_SAME_CALL_CONTROL_REGISTRATION,LOCAL_DECODE1_ENTRY_SAME_CALL_PREPARE_REGISTRATION])assert.deepEqual(index.localControlEntrypoints.filter(r=>r.entryId===expected.entryId),[expected]);
 assert.equal(localPreparationRoute(route.candidateSelection).capability,route.CAPABILITY);
});

test('same-call exact policy authority rejects caller adoption flags or changed resources',()=>{
 const route=registration.SAME_CALL_PROFILE,policy=JSON.parse(fs.readFileSync(route.EXECUTION_POLICY.path));
 const candidate=JSON.parse(fs.readFileSync(registration.CANDIDATE.path));
 const preview=candidateChain.bind(process.cwd(),route.previewPath);
 const config=registration.deriveConfiguration(candidate,{capabilityVersion:route.CAPABILITY,trainingPreviewPolicy:preview});
 assert.equal(candidateChain.verifyExecutionPolicy(policy,config).sameCallCapture.parameterIndex,90);
 for(const patch of [{...policy,sameCallCapture:{...policy.sameCallCapture,adoption:true}},
  {...policy,phaseResources:{...policy.phaseResources,programFileCountMaximum:260}}])assert.throws(()=>candidateChain.verifyExecutionPolicy(patch,config),/exact execution policy/);
});

test('same-call actual closure keeps every capture source and only its hash-bound unreachable legacy edges',()=>{
 const programs=candidateChain.finalProgramBindings(process.cwd(),{capabilityVersion:registration.SAME_CALL_CAPABILITY});
 const paths=new Set(Object.values(programs).map(b=>b.path)),evidence=sourceCollectionReport();
 assert.equal(paths.size,Object.keys(programs).length);assert.ok(paths.size<=256);
 const policy=JSON.parse(fs.readFileSync(registration.SAME_CALL_PROFILE.EXECUTION_POLICY.path));
 for(const b of policy.sameCallCapture.componentSources){assert.ok(paths.has(b.path));assert.deepEqual(Object.values(programs).find(v=>v.path===b.path),b);}
 for(const name of ['mvp_dataset_release.py','mvp_denoiser_release.py','regrouped_candidate.py','joint_object_priority_quality_checkpoint_v1.py'])assert.equal(paths.has('ml/ai-painter/src/ai_painter/complete_world/'+name),false);
 assert.ok(evidence.deferredImportEvidence.some(r=>r.path.endsWith('/split_release.py')&&r.registration.excludeScopes.includes('load_package')));
 assert.ok(evidence.deferredImportEvidence.some(r=>r.path.endsWith('/object_support_structure_failure_capture_v1.py')&&r.registration.excludeScopes.includes('_joint_program_limit')));
});

for(const currentInterface of [false,true])test((currentInterface?'registered-interface':'same-call')+' native qualification mode requires exact new policy package and finite startup without any training admission',()=>{
 const root=process.cwd(),route=currentInterface?registration.registeredTrainingInterfaces()[0]:registration.SAME_CALL_PROFILE,
  policy=JSON.parse(fs.readFileSync(route.EXECUTION_POLICY.path)),now=Date.now();
 function fixture(change=()=>{}){
  const runId='same-call-private-run-0000',packageId='same-call-private-package-0000',output=route.OUTPUT_ROOT+'/'+runId,store=new Map();
  const put=(logical,value)=>{const raw=Buffer.from(JSON.stringify(value));store.set(path.resolve(root,logical),raw);return{path:logical,sha256:crypto.createHash('sha256').update(raw).digest('hex')};};
  const python=Buffer.from('private inert interpreter'),qualifier=Buffer.from('private inert qualifier');
  const executable=path.resolve(root,'private-same-call-python.exe'),qualifierPath='private-same-call-qualifier.py';
  store.set(executable,python);store.set(path.resolve(root,qualifierPath),qualifier);
  const programs={gpuQualifier:{path:qualifierPath,sha256:crypto.createHash('sha256').update(qualifier).digest('hex')}};
  const plan={runId,packageId,capabilityVersion:route.CAPABILITY,outputRoot:output,executionProfile:route.EXECUTION_PROFILE,
   executionPolicy:route.EXECUTION_POLICY,formalSpecification:route.SPECIFICATION,
   ...(currentInterface?{interfacePolicy:route.EXECUTION_POLICY,entrypointSnapshot:route.entrypointSnapshot}:{}),
   configuration:{capabilityVersion:route.CAPABILITY,executionCeiling:policy.executionCeiling,gpuAdmissionSeconds:null,gpuAdmissionWallMode:'completion'},
   historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,runtimeIdentity:{python:{absolutePath:executable,sha256:crypto.createHash('sha256').update(python).digest('hex')}},programBindings:programs};
  change(plan);const planRef=put(output+'/quality-plan.json',plan),pkg=put('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json',
   {packageIdentity:packageId,capabilityVersion:route.CAPABILITY,inputEvidence:[planRef]});
  return {timing:{mode:'registered_qualification_completion',phase:'qualification',policy:route.EXECUTION_POLICY,runId,packageId,startupDeadlineUnixMs:now+1000},
   options:{root,executable,args:['-B',path.resolve(root,qualifierPath),'--package',pkg.path,'--sha256',pkg.sha256],now,reader:p=>store.get(path.resolve(p))??fs.readFileSync(p)}};
 }
 const f=fixture(),actual=resolveNativeTiming(f.timing,f.options);assert.equal(actual.phase,'qualification');assert.equal(Object.hasOwn(actual,'deadlineUnixMs'),false);
 for(const change of [p=>p.capabilityVersion=registration.COMPLETION_V2_CAPABILITY,p=>p.configuration.gpuAdmissionSeconds=720,
  p=>p.configuration.gpuAdmissionWallMode='finite',p=>p.trainingRestartAllowed=true]){const changed=fixture(change);assert.throws(()=>resolveNativeTiming(changed.timing,changed.options));}
 assert.throws(()=>resolveNativeTiming({...f.timing,startupDeadlineUnixMs:now+720001},f.options));
 assert.throws(()=>resolveNativeTiming({...f.timing,policy:registration.COMPLETION_V2_POLICY},f.options));
});

test('same-call exact native namespace passes the root gate before intentionally invalid CPU arguments, foreign namespace still refuses',async()=>{
 const base={root:process.cwd(),phase:'cpu',executable:process.execPath,args:[]};
 await assert.rejects(runNative({...base,outputRoot:registration.SAME_CALL_PROFILE.OUTPUT_ROOT+'/same-call-private-run-0000'}),
  e=>e.code==='ERR_ASSERTION'&&e.actual===0&&e.expected===6);
 await assert.rejects(runNative({...base,outputRoot:registration.SAME_CALL_PROFILE.OUTPUT_ROOT+'-foreign/same-call-private-run-0000'}),
  e=>e.code==='ERR_ASSERTION'&&typeof e.actual==='string'&&e.actual.includes('-foreign/'));
});

test('completion parser waits for real PID; asynchronous ENOENT retains original error and no cleanup authority',async()=>{
 const child=spawn(path.join(os.tmpdir(),'ai-painter-no-such-owner-'+crypto.randomUUID()+'.exe'),[],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 let firstError=null,created=0,ready=0,parserError=null;
 const closed=new Promise(resolve=>{child.once('error',error=>{firstError??=error});child.once('close',resolve)});
 assert.equal(child.pid,undefined);
 deferCompletionParserUntilSpawn(child,()=>{created++;throw new Error('must not construct without spawned owner')},()=>{ready++},error=>{parserError=error});
 await closed;
 assert.equal(firstError?.code,'ENOENT');assert.equal(created,0);assert.equal(ready,0);assert.equal(parserError,null);
 assert.equal(hasLiveOwnedProof(firstError),false);assert.equal(cleanupForCurrentCall(firstError,null),false);
});
test('completion timing configuration cannot remove legacy8400 or finite admission/review budgets',()=>{
 const old=registration.executionRoute(),next=registration.executionRoute(registration.COMPLETION_CAPABILITY);
 assert.equal(old.CAPABILITY,registration.CAPABILITY);assert.equal(next.candidateSelection,registration.COMPLETION_SELECTOR);
 assert.equal(next.EXECUTION_PROFILE,'completion_decode1_entry_weight_quality24_v1');
 const candidate=JSON.parse(fs.readFileSync(path.join(process.cwd(),registration.CANDIDATE.path),'utf8'));
 const config=registration.deriveConfiguration(candidate,{capabilityVersion:next.CAPABILITY,trainingPreviewPolicy:{path:next.previewPath,sha256:'a'.repeat(64)}});
 assert.equal(config.executionCeiling.maxWallSeconds,null);assert.equal(config.executionCeiling.trainingWallMode,'completion');
 assert.equal(config.executionCeiling.epochs,24);assert.equal(config.executionCeiling.generatorOptimizerSteps,1152);
 assert.equal(config.executionCeiling.discriminatorOptimizerSteps,1152);assert.equal(config.gpuAdmissionSeconds,720);
 const legacy=registration.deriveConfiguration(candidate,{trainingPreviewPolicy:{path:old.previewPath,sha256:'a'.repeat(64)}});
 assert.equal(legacy.executionCeiling.maxWallSeconds,8400);assert.equal(Object.hasOwn(legacy.executionCeiling,'trainingWallMode'),false);
});

test('completion control and preparation constants exactly match current machine registration',()=>{
 const index=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json','utf8'));
 for(const expected of [LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION,LOCAL_DECODE1_ENTRY_COMPLETION_PREPARE_REGISTRATION,LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION,LOCAL_DECODE1_ENTRY_COMPLETION_V2_PREPARE_REGISTRATION]){
  const matches=index.localControlEntrypoints.filter(row=>row.entryId===expected.entryId);
  assert.deepEqual(matches,[expected]);
 }
 const route=localPreparationRoute(registration.COMPLETION_SELECTOR);
 assert.equal(route.registration,LOCAL_DECODE1_ENTRY_COMPLETION_PREPARE_REGISTRATION);
 assert.equal(route.capability,registration.COMPLETION_CAPABILITY);assert.equal(route.outputRoot,registration.COMPLETION_PROFILE.OUTPUT_ROOT);
});
import {validateCpuRegistryFixtureLeaseRequest,primaryErrorBeforeNativeFinalization,boundedNativeFailureMetadata}
  from '../lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs';
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
const url=pathToFileURL(path.join(process.cwd(),'scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs')).href+'?private-timeout-finalize';
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
function cpuFixtureRoutes(){
  return [...[registration.CAPABILITY,registration.COMPLETION_CAPABILITY,registration.COMPLETION_V2_CAPABILITY,registration.SAME_CALL_CAPABILITY]
    .map(cap=>registration.executionRoute(cap)),...registration.registeredTrainingInterfaces(process.cwd())];
}
function cpuFixtureRoute(logical){
  assert.equal(typeof logical,'string','exact current CPU fixture budget root');
  const route=cpuFixtureRoutes()
    .find(value=>logical.startsWith(value.OUTPUT_ROOT+'/'));
  assert.ok(route&&logical.endsWith('/cpu-entry'),'exact current CPU fixture budget root');
  assert.match(logical.slice(route.OUTPUT_ROOT.length+1),/^[a-z0-9][a-z0-9-]{7,127}\/cpu-entry$/u);
  return route;
}
function fixtureOutputRoot(){
  if(budgetRoot){
    assert.equal(process.env.TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT,budgetRoot,'CPU fixture budget root changed');
    if(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT)assert.equal(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT,budgetRoot,'CPU harness roots disagree');
    return budgetRoot;
  }
  const logical=process.env.TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT
    ?? process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT
    ?? registration.OUTPUT_ROOT+'/js-sqlite-'+crypto.randomUUID()+'/cpu-entry';
  cpuFixtureRoute(logical);
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

test('CPU fixture paths accept exact legacy and policy-registered interface roots without a candidate name table',()=>{
 const routes=cpuFixtureRoutes();assert.ok(routes.some(route=>route.interfaceContract),'registered interface fixture coverage required');
 for(const route of routes){
  const root=route.OUTPUT_ROOT;
  assert.deepEqual(cpuFixtureRoute(root+'/private-cpu-fixture/cpu-entry'),route);
  for(const logical of [root+'-other/private-cpu-fixture/cpu-entry',root+'/private-cpu-fixture/cpu-entry/other',
   root+'/private-cpu-fixture/cpu-entry-other',root+'/../private-cpu-fixture/cpu-entry',root+'/short/cpu-entry',
   root+'/private-cpu-fixture/other/cpu-entry',root.replace('ai-painter/','unregistered-ai-painter/')+'/private-cpu-fixture/cpu-entry'])
   assert.throws(()=>cpuFixtureRoute(logical));
 }
});

test('registered successor namespace leaves the existing Windows SQLite sidecar reserve intact',()=>{
 const project='F:/ai-pet-world',uuid='00000000-0000-4000-8000-000000000001';
 const sqlitePath=(root,runId,name)=>path.win32.resolve(project,root,runId,'cpu-entry','r',name,
  '.runtime','ai-painter','current-execution-registry','registry.sqlite');
 for(const route of registration.registeredTrainingInterfaces(process.cwd())){
  for(const name of ['dispatch','finalization','failure'])
   assert.ok(sqlitePath(route.OUTPUT_ROOT,route.runPrefix+uuid,name).length+12<260,'existing SQLite sidecar path ceiling');
 }
 const predecessor=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v5.json'));
 assert.equal(sqlitePath(predecessor.outputRoot,predecessor.interfaceContract.runPrefix+uuid,'finalization').length+12,267);
});

test('managed CPU registry metadata binds exact route Run request declaration and keeper identity',()=>{
 for(const route of cpuFixtureRoutes()){
  const cap=route.CAPABILITY,runId='private-metadata-fixture',packageId='private-metadata-package';
  const entryRoot=route.OUTPUT_ROOT+'/'+runId+'/cpu-entry',request=binding(route.OUTPUT_ROOT+'/'+runId+'/cpu-request.json'),
   declaration=binding(route.OUTPUT_ROOT+'/'+runId+'/cpu-negative-inputs/input-declaration.json');
  const current={schema:'object-support-structure-quality-cpu-request-v1',outputRoot:entryRoot,runId,packageId,
   configuration:{capabilityVersion:cap},formalSpecification:route.SPECIFICATION,programBindings:{fixture:binding('scripts/private-fixture.mjs')}};
  const body={schema:'cpu-negative-input-declaration-v1',runId,packageId,programBindings:structuredClone(current.programBindings),
   callIdentity:'00000000-0000-4000-8000-000000000001'};
  assert.deepEqual(managedCpuRegistryContext(entryRoot,request,declaration,body,current),{entryRoot,request,declaration,callIdentity:body.callIdentity});
  const changes=[(r,b,c)=>{r.path=r.path.replace(runId,runId+'-other')},(r,b,c)=>{c.outputRoot+='/other'},
   (r,b,c)=>{c.configuration.capabilityVersion=cap===registration.CAPABILITY?registration.COMPLETION_CAPABILITY:registration.CAPABILITY},
   (r,b,c)=>{c.runId+='-other';b.runId=c.runId},(r,b,c)=>{b.packageId+='-other'},
   (r,b,c)=>{c.formalSpecification={...c.formalSpecification,sha256:'0'.repeat(64)}},
   (r,b,c)=>{b.programBindings={}},(r,b,c)=>{b.callIdentity='unknown-owner'}];
  for(const change of changes){const r=structuredClone(request),b=structuredClone(body),c=structuredClone(current);change(r,b,c);
   assert.throws(()=>managedCpuRegistryContext(entryRoot,r,declaration,b,c));}
 }
});

test('new configuration binds the frozen five-gradient definitions and asset-only source',()=>{
  const c=registration.deriveConfiguration(candidate,{trainingPreviewPolicy:binding(registration.PROFILE.previewPath)});
  assert.equal(c.schema,'object-support-structure-quality-configuration-v1');
  assert.equal(c.capabilityVersion,registration.CAPABILITY);
  assert.equal(c.modelCapabilityVersion,registration.MODEL_CAPABILITY);
  assert.equal(Object.hasOwn(c,'sourceCandidate'),false);
  assert.deepEqual(c.sourceAssetsCandidate,registration.CANDIDATE);
  assert.equal(c.sourceAssetsUse,'data_review_and_base_schedule_only_not_execution_qualification');
  assert.deepEqual(c.lossDefinition,registration.LOSS);
  assert.deepEqual(c.gradientDefinition,registration.GRADIENT);
  assert.deepEqual(c.integrationPolicy,registration.INTEGRATION_POLICY);
  assert.deepEqual(c.formalSpecification,registration.SPECIFICATION);
  assert.equal(c.executionCeiling.epochs,24);
  assert.equal(c.executionCeiling.maxWallSeconds,8400);
  assert.deepEqual(c.checkpointSelection.eligibleEpochs,[24]);
  assert.deepEqual(c.checkpointSelection.observationOnlyEpochs,[12]);
  assert.equal(c.automaticResumeAllowed,false);
});

test('CLI requires the new explicit protocol and cannot start training',()=>{
  const protocol='decode1-entry-weight-quality-entry-v1';
  assert.equal(parsePreparationArguments(['--help']).help,true);
  assert.equal(parsePreparationArguments(['--protocol',protocol,'prepare-only','--run','support-run-0001','--package-id','support-package-0001']).mode,'prepare-only');
  for(const mode of ['start','train','resume','retry'])
    assert.throws(()=>parsePreparationArguments(['--protocol',protocol,mode,'--run','support-run-0001','--package-id','support-package-0001']));
  assert.throws(()=>parsePreparationArguments(['--protocol','ecology-terrain-detail-weight-quality-entry-v1','prepare-only','--run','support-run-0001','--package-id','support-package-0001']));
});

function gpuFixture(_test,capabilityVersion=registration.CAPABILITY){
  const route=registration.executionRoute(capabilityVersion);
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
  const plan={capabilityVersion,runId:'synthetic-run-0001',packageId:'synthetic-package-0001',outputRoot:logical,
    programBindings:{syntheticSource:binding('scripts/synthetic-only.mjs')},
    trainSplit:write('train.json',{sampleIds:ids}),modelBinding:write('model.json',{initialState:initial})};
  const packageBinding=binding('.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json');
  const gate={schema:'object-support-structure-quality-all-train-gpu-gate-v1',status:'passed',
    capabilityVersion,executionProfile:route.EXECUTION_PROFILE,
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

test('completion v2 preserves full48 zero-update gate and refuses old qualification identity',t=>{
 const f=gpuFixture(t,registration.COMPLETION_V2_CAPABILITY);
 assert.deepEqual(verifyGpuOutcome(f.ready,f.write('gpu-gate.json',f.gate)),f.gate);
 const changed={...f.gate,capabilityVersion:registration.COMPLETION_CAPABILITY};
 assert.throws(()=>verifyGpuOutcome(f.ready,f.write('old-gpu-gate.json',changed)));
});

test('three registered resource policies keep old720 and admit null only for completion v2',()=>{
 for(const cap of [registration.CAPABILITY,registration.COMPLETION_CAPABILITY,registration.COMPLETION_V2_CAPABILITY]){
  const route=registration.executionRoute(cap),policy=JSON.parse(fs.readFileSync(route.EXECUTION_POLICY.path,'utf8'));
  const preview={path:route.previewPath,sha256:policy.trainingPreviewPolicy.sha256??'a'.repeat(64)};
  const c=registration.deriveConfiguration(candidate,{capabilityVersion:cap,trainingPreviewPolicy:preview});
  assert.equal(c.gpuAdmissionSeconds,cap===registration.COMPLETION_V2_CAPABILITY?null:720);
  assert.equal(candidateChain.verifyExecutionPolicy(policy,c),policy);
  const changed=structuredClone(c);changed.gpuAdmissionSeconds=cap===registration.COMPLETION_V2_CAPABILITY?720:null;
  assert.throws(()=>candidateChain.verifyExecutionPolicy(policy,changed));
 }
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
function simulated({gpuFailure=false,unknownCleanup=false,invalidStored=false,diskOnlyReviewReceipt=false,
 trainingFailure=false,trainingCleanupUnknown=false,workerMode='missing',scopeChange=null,failureChange=null,failureReadConflict=false,
 initialAdvanceError=null,dispatchRegistryUnreadable=false,failureWriteError=null,failureWriter=null,dispatchBudget=null}={}){
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
    sourceCandidate:registration.CANDIDATE,executionPolicy:registration.EXECUTION_POLICY,trainingPreviewPolicy:binding(registration.PROFILE.previewPath),configuration:registration.deriveConfiguration(candidate,{trainingPreviewPolicy:binding(registration.PROFILE.previewPath)}),programBindings:programs,
    modelBinding:binding(outputRoot+'/model-identity.json'),finalCpuAcceptance:binding(outputRoot+'/cpu-acceptance.json'),
    datasetManifest:candidate.frozenBindings.datasetManifest,trainSplit:candidate.frozenBindings.trainSplit,validationSplit:candidate.frozenBindings.validationSplit,
    historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,
    runtimeIdentity:{python:{absolutePath:path.resolve('synthetic/python.exe'),sha256:zero},node:{absolutePath:process.execPath,sha256:zero}}};
  const packageBinding=binding('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json');
  const input={plan,packageBinding,planBinding:binding(outputRoot+'/quality-plan.json'),modelBinding:plan.modelBinding,modelIdentity:model};
  const f={root:process.cwd(),plan,packageBinding,input},store=new Map(),live=new WeakSet(),budgeted=new WeakSet(),liveReceipts=new Map();
  const nativeCalls=[],registryWrites=[],liveBudgetReceipts=[],liveReceiptLookups=[],cleanupLookups=[],nativeFailurePersistenceCalls=[],dispatchBudgetScopes=[],registryReadOptions=[];
  let current={registryRevision:409,activeExecution:null},terminal=null,registryReads=0;
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
    loadContext:()=>f,write:(_root,p,value)=>{if(/(execution|qualification)-failure\.json$/u.test(p)){
      if(failureWriteError)throw failureWriteError;if(failureWriter)return failureWriter(_root,p,value);}
      const changed=clone(value);if(p===outputRoot+'/execution-failure.json'&&failureChange)failureChange(changed);return put(_root,p,changed);},
    json:(_root,b)=>{assert.ok(store.has(b.path),'missing private stub binding');if((failureReadConflict&&b.path===outputRoot+'/execution-failure.json')||(workerMode==='digest-conflict'&&b.path===outputRoot+'/worker-terminal.json'))throw Error('input SHA differs');return clone(store.get(b.path));},
    bind:(_root,p)=>{if(!store.has(p))throw Object.assign(Error('missing fixture file'),{code:'ENOENT',path:path.resolve(_root,p)});return binding(p);},inside:(r,p)=>path.resolve(r,p),read:()=>Buffer.from('synthetic-no-model-bytes'),
    processIdentity:()=> 'synthetic-process-creation',readRegistry:async(_root,options)=>{
      registryReadOptions.push(clone(options??null));registryReads++;if(dispatchRegistryUnreadable&&registryReads===2)return {ok:false,state:'unknown_or_stale',errors:['committed_pointer_unpublished']};
      return {ok:true,registry:clone(current),registrySha256:zero,currentTaskTerminal:clone(terminal)};},
    advanceRegistry:async options=>{registryWrites.push(clone(options));if(initialAdvanceError&&registryWrites.length===1)throw initialAdvanceError;
      current={...current,registryRevision:current.registryRevision+1,activeExecution:options.activeExecution,
      capabilityVersion:options.capabilityVersion,packageId:options.packageId,runId:options.runId};terminal=clone(store.get(options.terminalEvidencePath));return {ok:true};},
    withNativeOrdinaryBudget:async(_r,receipt,action)=>{assert.ok(live.has(receipt));return action();},
    withNativeReceiptBudget:async(_r,receipt,action)=>{assert.ok(budgeted.has(receipt));liveBudgetReceipts.push(receipt);return action();},
    withOutputBudget:(options,action)=>{dispatchBudgetScopes.push(clone(options));return dispatchBudget?dispatchBudget(options,action):action();},
    requireLiveOwnedReceipt:(_root,b)=>{liveReceiptLookups.push(clone(b));const receipt=liveReceipts.get(b.path);
      assert.ok(receipt&&live.has(receipt),'same-process live receipt required; disk copy is not authority');return receipt;},
    hasGpuAcceptance:()=>store.has(outputRoot+'/gpu-acceptance.json'),hasConsumedQualification:()=>store.has(outputRoot+'/qualification-consumed.json'),
    hasOwnPreflight:()=>store.has(outputRoot+'/preflight.json'),verifyStoredPreflight:()=>({fixtureKind:'explicit-private-preflight-stub'}),
    hasLiveOwnedProof:p=>live.has(p),cleanupForCurrentCall:(error,last)=>{cleanupLookups.push({error,last});return live.has(Object.hasOwn(error,'ownedReceipt')?error.ownedReceipt:last);},
    persistNativeFailureEvidence:async(...args)=>{nativeFailurePersistenceCalls.push(args);return {fixtureKind:'explicit-private-failure-stub'};},
    currentNativeFailureScope:(_root,receipt)=>{assert.ok(live.has(receipt));const scope={capabilityVersion:plan.capabilityVersion,runId,packageId,outputRoot,phase:receipt.phase};if(scopeChange)scopeChange(scope);return scope;},
    verifyGpuOutcome:()=>({fixtureKind:'simulated-protocol-no-GPU'}),verifyStoredGpuAcceptance:()=>assert.equal(invalidStored,false,'untrusted stored GPU receipt'),
    runNative:async options=>{
      nativeCalls.push(options);const receipt={fixtureKind:'explicit-private-stub-not-native',phase:options.phase,cleanupConfirmed:true,
        proof:{activeProcessesAfterCleanup:0},outputAccountingRoots:[outputRoot,outputRoot+'/dry-review-owned',outputRoot+'/dry-review']};
      const receiptBinding=binding(outputRoot+'/owned-'+options.phase+'.json');
      put(f.root,receiptBinding.path,receipt);budgeted.add(receipt);
      if(options.phase==='cpu'||(!unknownCleanup&&!(options.phase==='training'&&trainingCleanupUnknown)))live.add(receipt);
      if(!(options.phase==='review'&&diskOnlyReviewReceipt))liveReceipts.set(receiptBinding.path,receipt);
      if(options.phase==='cpu')return {stdout:JSON.stringify({status:'own_quality_entry_preflight_passed_not_gpu_qualified',gpuInitialized:false}),ownedReceipt:receipt,receiptBinding};
      if(options.phase==='qualification'){
        if(gpuFailure){const error=Error('synthetic gate failure');error.ownedReceipt=receipt;throw error;}
        return {stdout:JSON.stringify(binding(outputRoot+'/gpu-gate.json')),ownedReceipt:receipt,receiptBinding};
      }
      if(options.phase==='training'){
        if(trainingFailure){
          if(workerMode!=='missing'){
            const body=completed();Object.assign(body,{status:'failed_closed',executionState:'failed_closed',optimizerSteps:{generator:1151,discriminator:1152},optimizerStepsGenerator:1151,optimizerStepsDiscriminator:1152,
              checkpoints:[],selectedCheckpointRecord:null,captureStatus:'capture_incomplete',originalError:{message:'first worker error'}});
            if(workerMode==='cross-run')body.runId='other-run-0001';
            put(f.root,outputRoot+'/worker-terminal.json',body);
          }
          const error=Error('wall_timeout');error.ownedReceipt=receipt;throw error;
        }
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
  return {f,store,adapters,nativeCalls,registryWrites,liveReceipts,liveBudgetReceipts,liveReceiptLookups,cleanupLookups,nativeFailurePersistenceCalls,dispatchBudgetScopes,registryReadOptions,
    registryReadCount:()=>registryReads,getCurrent:()=>current};
}

test('initial dispatch rename EPERM preserves exact first error and records zero-native recovery scope',async()=>{
 const primary=Object.assign(Error('EPERM: operation not permitted, rename'),{code:'EPERM',errno:-4048,syscall:'rename',
  path:'F:\\synthetic\\current.json.tmp',dest:'F:\\synthetic\\current.json'});
 const s=simulated({initialAdvanceError:primary});
 await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===primary);
 const failed=s.store.get(s.f.plan.outputRoot+'/execution-failure.json');
 assert.equal(failed.phase,'dispatch');assert.equal(failed.failureScope,'initial_registry_dispatch_before_native_call');
 assert.deepEqual(failed.dispatchError,{name:'Error',message:primary.message,code:'EPERM',errno:-4048,syscall:'rename',path:primary.path,dest:primary.dest});
 assert.equal(failed.error,'Error: '+primary.message);assert.equal(failed.workerTerminal,null);assert.equal(failed.originalError,null);
 for(const key of ['cleanupConfirmed','gpuQualificationStarted','trainingStarted'])assert.equal(failed[key],false);
 assert.equal(failed.nativeCallsAttempted,0);assert.equal(failed.nativeCleanupStatus,'no_current_native_call');
 assert.equal(failed.registryPublication.status,'unverified_after_initial_advance_error');
 assert.equal(failed.registryPublication.transactionRecoveryStatus,'requires_registry_verification_or_transaction_recovery');
 assert.equal(failed.registryPublication.adapterRetryAttempted,false);
 assert.equal(primary.dispatchFailureEvidence.path,s.f.plan.outputRoot+'/execution-failure.json');
 assert.equal(s.nativeCalls.length,0);assert.equal(s.registryWrites.length,1);assert.equal(s.registryReadCount(),2);
 assert.equal(s.cleanupLookups.length,0);assert.equal(s.nativeFailurePersistenceCalls.length,0);
 assert.equal(s.store.has(s.f.plan.outputRoot+'/worker-terminal.json'),false);
 await assert.rejects(s.adapters.execute({heartbeat(){}}),/exclusive duplicate fixture write/u);
 assert.equal(s.nativeCalls.length,0);assert.equal(s.registryWrites.length,1);
});

test('initial dispatch unreadable registry records failure without any replacement registry write',async()=>{
 const s=simulated({dispatchRegistryUnreadable:true});let primary;
 try{await s.adapters.execute({heartbeat(){}})}catch(error){primary=error}
 assert.equal(primary.code,'ERR_ASSERTION');assert.equal(s.registryWrites.length,0);assert.equal(s.nativeCalls.length,0);
 assert.equal(s.registryReadCount(),2);assert.equal(s.getCurrent().registryRevision,409);
 const failed=s.store.get(s.f.plan.outputRoot+'/execution-failure.json');assert.equal(failed.phase,'dispatch');
 assert.equal(failed.cleanupConfirmed,false);assert.equal(failed.registryPublication.adapterRetryAttempted,false);
});

test('initial dispatch read and advance share one absolute existing ten-second operation deadline',async()=>{
 const primary=Object.assign(Error('original deadline-bound rename refusal'),{code:'EPERM'}),s=simulated({initialAdvanceError:primary});
 const before=Date.now();await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===primary);const after=Date.now();
 assert.equal(s.registryReadOptions.length,2);assert.equal(s.registryReadOptions[0],null);
 const deadline=s.registryReadOptions[1].deadlineUnixMs;
 assert.ok(Number.isSafeInteger(deadline)&&deadline>=before+10000&&deadline<=after+10000);
 assert.equal(s.registryWrites.length,1);assert.equal(s.registryWrites[0].deadlineUnixMs,deadline);
 assert.equal(primary.message,'original deadline-bound rename refusal');assert.equal(s.nativeCalls.length,0);
});

test('initial dispatch after completed CPU preflight cannot borrow its cleanup or discover a worker terminal',async()=>{
 const primary=Object.assign(Error('rename refused'),{code:'EPERM',syscall:'rename'}),s=simulated({initialAdvanceError:primary}),context={heartbeat(){}};
 await s.adapters.preflight(context);primary.ownedReceipt=s.liveReceipts.get(s.f.plan.outputRoot+'/owned-cpu.json');
 s.store.set(s.f.plan.outputRoot+'/worker-terminal.json',{status:'pretend-worker-terminal'});
 await assert.rejects(s.adapters.qualifyOnly(context),error=>error===primary);
 const failed=s.store.get(s.f.plan.outputRoot+'/qualification-failure.json');
 assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu']);assert.equal(failed.phase,'dispatch');
 assert.equal(failed.workerTerminal,null);assert.equal(failed.cleanupConfirmed,false);assert.equal(failed.trainingStarted,false);
 assert.equal(s.cleanupLookups.length,0);assert.equal(s.nativeFailurePersistenceCalls.length,0);
 assert.equal(primary.nativeFailureEvidence,undefined);assert.equal(s.registryWrites.length,1);
});

test('initial dispatch failure evidence write failure stays secondary to the original system error',async()=>{
 const primary=Object.assign(Error('original rename refusal'),{code:'EPERM',errno:-4048,syscall:'rename'});
 const secondary=Object.assign(Error('no evidence space'),{code:'ENOSPC',errno:-4055,syscall:'write'});
 const s=simulated({initialAdvanceError:primary,failureWriteError:secondary});
 await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===primary);
 assert.equal(primary.message,'original rename refusal');assert.equal(primary.code,'EPERM');
 assert.equal(primary.secondaryEvidenceError.errno,-4055);assert.equal(primary.secondaryEvidenceError.operation,'write');
 assert.equal(primary.dispatchFailureEvidence,undefined);assert.equal(s.nativeCalls.length,0);assert.equal(s.registryWrites.length,1);
});

test('initial dispatch system metadata is UTF8 bounded without mutating the original error',async()=>{
 const primary=Object.assign(Error('错'.repeat(10000)),{code:'EPERM',errno:-4048,syscall:'rename',path:'路'.repeat(6000),dest:'终'.repeat(6000)});
 const s=simulated({initialAdvanceError:primary});await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===primary);
 const failed=s.store.get(s.f.plan.outputRoot+'/execution-failure.json');
 for(const [key,maximum]of [['message',8192],['path',4096],['dest',4096]])assert.ok(Buffer.byteLength(failed.dispatchError[key])<=maximum);
 assert.equal(primary.message.length,10000);assert.equal(primary.path.length,6000);assert.equal(failed.dispatchError.code,'EPERM');
});

test('initial dispatch real candidate aggregate quota exhaustion preserves the original publication error',async t=>{
 const f=entryTimingFixture(t,{mapped:false}),primary=Object.assign(Error('first rename refusal'),{code:'EPERM',errno:-4048,syscall:'rename'});
 let privateNativeRoot,quotaError;
 const s=simulated({initialAdvanceError:primary,
  dispatchBudget:(options,action)=>{
   assert.equal(options.projectRoot,process.cwd());assert.equal(options.maximum,128*1024**2);assert.equal(options.reserveBytes,65536);
   assert.equal(options.roots.length,2);assert.equal(options.roots[0],s.f.plan.outputRoot);
   const key=crypto.createHash('sha256').update(s.f.plan.outputRoot).digest('hex').slice(0,32);
   assert.equal(options.roots[1],'.runtime/ai-painter/owned-worker-guards/'+[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join('-'));
   privateNativeRoot=options.roots[1];fs.mkdirSync(path.join(f.projectRoot,privateNativeRoot),{recursive:true});
   fs.writeFileSync(path.join(f.projectRoot,privateNativeRoot,'existing-native-evidence.bin'),Buffer.alloc(7900));
   fs.writeFileSync(path.join(f.dir,'existing-run-evidence.bin'),Buffer.alloc(100));
   return withCandidateOutputBudget({projectRoot:f.projectRoot,roots:[f.logical,privateNativeRoot],maximum:8192,reserveBytes:64},action);
  },failureWriter:(_root,_logical,value)=>{
   try{return writeCandidateAccounting(f.projectRoot,f.logical+'/execution-failure.json',value)}catch(error){quotaError=error;throw error}
  }});
 await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===primary);
 assert.equal(primary.message,'first rename refusal');assert.equal(primary.code,'EPERM');
 assert.match(quotaError.message,/total output reserve/u);assert.equal(primary.secondaryEvidenceError.reason,'contract_assertion');
 assert.equal(primary.secondaryEvidenceError.code,'ERR_ASSERTION');assert.equal(primary.dispatchFailureEvidence,undefined);
 assert.equal(fs.existsSync(path.join(f.dir,'execution-failure.json')),false);
 assert.equal(directoryBytes(path.join(f.projectRoot,privateNativeRoot)),7900);assert.equal(directoryBytes(f.dir),100);
 assert.equal(s.nativeCalls.length,0);assert.equal(s.registryWrites.length,1);assert.equal(s.dispatchBudgetScopes.length,1);
});

test('initial dispatch keeps exact transaction publication diagnostics as evidence without retry authority',async()=>{
 const primary=Object.assign(Error('first rename refusal'),{code:'EPERM',errno:-4048,syscall:'rename',publicationDiagnostics:{
  transactionId:'synthetic-same-transaction',status:'rename_failed',attempts:[1,2,3].map(attempt=>({attempt,
   atUtc:'2026-10-24T11:00:0'+attempt+'.000Z',code:'EPERM',message:'same temporary file publication refused'})),
  secondaryError:{code:'ERR_ASSERTION',message:'publication identity changed'}}});
 const s=simulated({initialAdvanceError:primary});await assert.rejects(s.adapters.execute({heartbeat(){}}),error=>error===primary);
 const failure=s.store.get(s.f.plan.outputRoot+'/execution-failure.json'),observed=failure.dispatchError.publicationDiagnostics;
 assert.equal(observed.transactionId,primary.publicationDiagnostics.transactionId);
 assert.equal(observed.status,'rename_failed');assert.deepEqual(observed.attempts,primary.publicationDiagnostics.attempts);
 assert.equal(observed.attemptsTruncated,false);assert.equal(observed.secondaryError.message,'publication identity changed');
 assert.equal(observed.secondaryError.code,'ERR_ASSERTION');assert.equal(s.registryWrites.length,1);assert.equal(s.nativeCalls.length,0);
 assert.equal(primary.message,'first rename refusal');assert.equal(primary.code,'EPERM');
});

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

test('training wall_timeout with no worker terminal records the exact failure and cannot retry',async()=>{
 const s=simulated({trainingFailure:true}),context={heartbeat(){}};
 await assert.rejects(s.adapters.execute(context),/wall_timeout/);
 const latest=s.registryWrites.at(-1).latestTrainingTerminal,body=s.store.get(latest.path);
 assert.equal(latest.path,s.f.plan.outputRoot+'/execution-failure.json');assert.equal(latest.status,'failed_closed');assert.equal(latest.runId,s.f.plan.runId);
 assert.equal(body.error,'Error: wall_timeout');assert.equal(body.workerTerminal,null);
 assert.equal(body.optimizerStepsGenerator,null);assert.equal(body.optimizerStepsDiscriminator,null);assert.equal(body.originalError,null);
 assert.equal(s.getCurrent().activeExecution,null);assert.deepEqual(s.nativeCalls.map(c=>c.phase),['qualification','training']);
 const calls=s.nativeCalls.length,events=s.registryWrites.length;
 await assert.rejects(s.adapters.execute(context));assert.equal(s.nativeCalls.length,calls);assert.equal(s.registryWrites.length,events);
});

test('existing same-Run worker failure retains first error and partial counts instead of being replaced',async()=>{
 const s=simulated({trainingFailure:true,workerMode:'valid'});await assert.rejects(s.adapters.execute({heartbeat(){}}),/wall_timeout/);
 const latest=s.registryWrites.at(-1).latestTrainingTerminal;assert.equal(latest.path,s.f.plan.outputRoot+'/worker-terminal.json');
 const failure=s.store.get(s.f.plan.outputRoot+'/execution-failure.json');assert.equal(failure.originalError.message,'first worker error');
 assert.equal(failure.optimizerStepsGenerator,1151);assert.equal(failure.optimizerStepsDiscriminator,1152);
});

test('qualification failure never becomes latest training and unknown training cleanup retains active identity',async()=>{
 const gate=simulated({gpuFailure:true});await assert.rejects(gate.adapters.execute({heartbeat(){}}));
 assert.equal(gate.registryWrites.at(-1).latestTrainingTerminal,undefined);assert.deepEqual(gate.nativeCalls.map(c=>c.phase),['qualification']);
 const training=simulated({trainingFailure:true,trainingCleanupUnknown:true});await assert.rejects(training.adapters.execute({heartbeat(){}}),/wall_timeout/);
 assert.notEqual(training.getCurrent().activeExecution,null);assert.equal(training.registryWrites.length,1);
 assert.equal(training.store.get(training.f.plan.outputRoot+'/execution-failure.json').cleanupConfirmed,false);
});

for(const [name,options]of [
 ['different native Run',{scopeChange:s=>s.runId='other-run-0001'}],
 ['different native package',{scopeChange:s=>s.packageId='other-package-0001'}],
 ['qualification receipt scope',{scopeChange:s=>s.phase='qualification'}],
 ['different native output root',{scopeChange:s=>s.outputRoot+='/other'}],
 ['failure bytes hash conflict',{failureReadConflict:true}],
 ['failure content Run mismatch',{failureChange:f=>f.runId='other-run-0001'}],
 ['failure package digest conflict',{failureChange:f=>f.executionPackage.sha256='2'.repeat(64)}]
])test('missing-worker fallback rejects '+name+' while preserving the original timeout',async()=>{
 const s=simulated({trainingFailure:true,...options});let observed;
 try{await s.adapters.execute({heartbeat(){}});}catch(error){observed=error;}
 assert.equal(observed?.message,'wall_timeout');assert.ok(observed.secondaryEvidenceError);
 assert.equal(s.registryWrites.length,1);assert.notEqual(s.getCurrent().activeExecution,null);
 assert.equal(s.store.get(s.f.plan.outputRoot+'/execution-failure.json').error,'Error: wall_timeout');
});

for(const mode of ['cross-run','digest-conflict'])test('existing worker '+mode+' is not treated as an absent worker terminal',async()=>{
 const s=simulated({trainingFailure:true,workerMode:mode});await assert.rejects(s.adapters.execute({heartbeat(){}}),/wall_timeout/);
 assert.equal(s.registryWrites.at(-1).latestTrainingTerminal,undefined);
 assert.equal(s.store.has(s.f.plan.outputRoot+'/worker-terminal.json'),true);
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
function managedCpuRegistryContext(entryRoot,request,declaration,body,current){
  const route=cpuFixtureRoute(entryRoot);
  assert.equal(body.schema,'cpu-negative-input-declaration-v1');
  assert.equal(current.schema,'object-support-structure-quality-cpu-request-v1');
  assert.equal(current.outputRoot,entryRoot);assert.deepEqual(current.programBindings,body.programBindings);
  assert.equal(current.configuration.capabilityVersion,route.CAPABILITY,'CPU declaration root/capability mismatch');
  if(Object.hasOwn(current,'capabilityVersion'))assert.equal(current.capabilityVersion,route.CAPABILITY);
  assert.deepEqual(current.formalSpecification,route.SPECIFICATION);
  assert.equal(current.runId,entryRoot.slice(route.OUTPUT_ROOT.length+1).split('/')[0],'CPU declaration Run/root mismatch');
  assert.equal(body.runId,current.runId);assert.equal(body.packageId,current.packageId);
  assert.equal(request.path,entryRoot.replace(/\/cpu-entry$/u,'')+'/cpu-request.json');
  assert.match(body.callIdentity,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u);
  return {entryRoot,request,declaration,callIdentity:body.callIdentity};
}
function cpuRegistryContext(){
  if(registryContext)return registryContext;
  const entryRoot=fixtureOutputRoot(),project=process.cwd();
  const declarationPath=entryRoot.replace(/\/cpu-entry$/u,'')+'/cpu-negative-inputs/input-declaration.json';
  if(fs.existsSync(inside(project,declarationPath))){
    managedKeeper=true;
    const declaration=fileBinding(project,declarationPath),body=JSON.parse(readBound(project,declaration));
    const request=body.request,current=JSON.parse(readBound(project,request));
    registryContext=managedCpuRegistryContext(entryRoot,request,declaration,body,current);
  }else{
    assert.equal(Boolean(process.env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT),false,'managed CPU declaration missing; no component fallback');
    const callIdentity=crypto.randomUUID();
    const request=cpuKeeperWrite(entryRoot+'/fixture-context/request.json',{
      schema:'object-support-structure-quality-isolated-sqlite-request-v1',outputRoot:entryRoot,
      capabilityVersion:cpuFixtureRoute(entryRoot).CAPABILITY,callIdentity,fixtureOnly:true,nativeOwnerAllowed:false});
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
  // Exercise the existing real pointer/event/SQLite transaction with an owned
  // execution-failure terminal instead of fabricating a worker terminal.
  const missing={status:'failed_closed',executionState:'failed_closed',phase:'training',workerTerminal:null,
    capabilityVersion:registration.CAPABILITY,runId:f.plan.runId,packageId:f.plan.packageId,
    optimizerStepsGenerator:null,optimizerStepsDiscriminator:null,originalError:null,error:'Error: wall_timeout',captureStatus:'capture_incomplete',
    cleanupConfirmed:true,automaticRetries:0,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false};
  const next=registryOptions(root,f,read,missing,{state:'failed_closed'});
  const actual=JSON.parse(fs.readFileSync(path.resolve(root,next.terminalEvidencePath),'utf8'));
  const plan={...f.plan,capabilityVersion:registration.CAPABILITY,outputRoot:registration.OUTPUT_ROOT+'/'+f.plan.runId};
  const failureBinding=fixtureWrite(root,plan.outputRoot+'/execution-failure.json',actual);
  next.latestTrainingTerminal=registration.validateTrainingFailureTerminal(actual,failureBinding,actual.executionPackage,plan);
  assert.throws(()=>registration.validateTrainingFailureTerminal(actual,{...failureBinding,path:plan.outputRoot+'/other.json'},actual.executionPackage,plan));
  const beforeFallback=fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH));
  await assert.rejects(prepareCurrentExecutionRegistryAdvance({...next,latestTrainingTerminal:{...next.latestTrainingTerminal,sha256:'2'.repeat(64)}}),/latest_training_terminal_sha256_invalid/);
  assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),beforeFallback);
  await publishPrepared(next);const finalRead=await readCurrentExecutionRegistry(root);
  assert.equal(finalRead.ok,true);assert.equal(finalRead.registry.latestTrainingTerminal.runId,f.plan.runId);
  assert.equal(finalRead.registry.latestTrainingTerminal.path,failureBinding.path);assert.equal(finalRead.registry.latestTrainingTerminal.sha256,failureBinding.sha256);
  assert.equal(finalRead.registry.latestTrainingTerminal.status,'failed_closed');assert.equal(finalRead.registry.activeExecution,null);
  assert.equal(finalRead.latestTrainingExecution.terminal.error,'Error: wall_timeout');assert.equal(finalRead.latestTrainingExecution.terminal.optimizerStepsGenerator,null);
  const afterFallback=fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH));
  await assert.rejects(prepareCurrentExecutionRegistryAdvance(next));
  assert.deepEqual(fs.readFileSync(path.resolve(root,CURRENT_EXECUTION_REGISTRY_PATH)),afterFallback);
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




const readPolicy=()=>JSON.parse(fs.readFileSync(registration.EXECUTION_POLICY.path));
const freshConfiguration=()=>registration.deriveConfiguration(candidate,{trainingPreviewPolicy:binding(registration.PROFILE.previewPath)});

test('historical identity keeps its original pins; numeric successor binds changed bytes without reusing old source qualification',()=>{
 const p=readPolicy();assert.equal(candidateChain.verifyExecutionPolicy(p,freshConfiguration()),p);
 assert.equal(digest(fs.readFileSync(registration.EXECUTION_POLICY.path)),registration.EXECUTION_POLICY.sha256);
 assert.equal(digest(fs.readFileSync('data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.96-f33115ca.txt')),registration.SPECIFICATION.sha256);
 assert.equal(digest(fs.readFileSync('data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.98-d8590b62.txt')),registration.COMPLETION_PROFILE.SPECIFICATION.sha256);
 const parent=registration.executionRoute('stage4_mvp256_dry_decode2_support_structure_weight1_v1');
 assert.equal(digest(fs.readFileSync(parent.EXECUTION_POLICY.path)),parent.EXECUTION_POLICY.sha256);
 const numeric=registration.executionRoute('stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1');
 const current=JSON.parse(fs.readFileSync(numeric.EXECUTION_POLICY.path));
 assert.equal(digest(fs.readFileSync(numeric.EXECUTION_POLICY.path)),numeric.EXECUTION_POLICY.sha256);
 assert.equal(current.previousExecutionPolicy.path,parent.EXECUTION_POLICY.path);
 assert.equal(current.previousExecutionPolicy.sha256,parent.EXECUTION_POLICY.sha256);
 for(const b of p.modelBoundary.frozenCpuSources){
  assert.match(b.sha256,/^[a-f0-9]{64}$/u);
  const updated=current.modelBoundary.frozenCpuSources.find(v=>v.path===b.path);
  assert.ok(updated);assert.notEqual(updated.sha256,b.sha256);assert.equal(digest(fs.readFileSync(b.path)),updated.sha256);
 }
 assert.equal(current.modelBoundary.numericOperatorsChanged,true);
 assert.equal(current.modelBoundary.changedTargetIndex,90);
 assert.equal(current.modelBoundary.parentDecode2Entry40Kept,true);
 assert.equal(current.modelBoundary.frozenCpuSources.length,4);
 const parsed=parseTrainingInterfacePolicy(current);
 assert.equal(parsed.model,'stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1');
 const wrongModel=structuredClone(current);wrongModel.modelCapability=parent.MODEL_CAPABILITY;
 assert.throws(()=>parseTrainingInterfacePolicy(wrongModel),/model_unsupported/);
 assert.equal(registration.sourceFileCountMaximum(),256);assert.equal(registration.gpuAdmissionSeconds(),720);
 for(const old of ['stage4_mvp256_dry_joint_object_priority_quality24_v1','stage4_mvp256_dry_decode1_entry_gpu_qualification_v4','stage4_mvp256_dry_object_support_structure_quality24_v1']){
  assert.throws(()=>registration.executionRoute(old));assert.throws(()=>registration.sourceFileCountMaximum(old));
 }
 assert.equal(p.priorCpuEvidence.normativeVersion,'AI-PAINTER-SPEC-1.91');
 assert.equal(p.jointRuleCpuEvidence.normativeVersion,'AI-PAINTER-SPEC-1.82');
});
for(const [name,change]of [
 ['260 exception',p=>p.sourceClosure.maximumEntries=260],
 ['forged program count',p=>p.phaseResources.programFileCountMaximum=260],
 ['GPU deadline',p=>p.phaseResources.gpuAdmissionSeconds=721],
 ['training deadline',p=>p.executionCeiling.maxWallSeconds=8401],
 ['optimizers in qualification',p=>p.gpuAdmission.optimizerConstruction=1],
 ['four gradients',p=>p.gpuAdmission.generatorAutogradPerSample=4],
 ['old joint selection',p=>p.candidateSelection='joint-object-priority-quality-v1'],
 ['old checkpoint',p=>p.checkpointIdentity.schema='joint-object-priority-quality-checkpoint-v1'],
 ['old target',p=>p.modelBoundary.changedTargetIndex=88],
 ['old evidence reuse',p=>p.priorCpuEvidence.grantsGpuOrTrainingQualification=true],
 ['joint evidence reuse',p=>p.jointRuleCpuEvidence.oldAttemptReplayAllowed=true],
 ['validation autograd',p=>p.lifecycleBoundary.cpuPreparationValidationLoaderReadOnly.autograd=true],
 ['challenge read',p=>p.dataUse.challengeAndRegressionContentRead=true],
 ['preview protocol',p=>p.trainingPreviewPolicy.path=p.trainingPreviewPolicy.path.replace('-v6','-v5')],
 ['resource threshold',p=>p.executionCeiling.minimumFreeVramMiB=1024],
 ['resource message replacement',p=>p.resourceFailureRecord.observation='requery_after_stop'],
 ['automatic retry',p=>p.executionCeiling.automaticRetries=1],
 ['round24 selection',p=>p.checkpointSelection.eligibleEpochs=[12,24]],
 ['progress freshness',p=>p.progressPublication.freshnessSeconds=121]
])test('policy rejects '+name+' without reading sample content',()=>{
 const p=readPolicy();change(p);assert.throws(()=>candidateChain.verifyExecutionPolicy(p,freshConfiguration()));
});

test('new source binding aliases and forged260 maxima fail before any data or native call',()=>{
 const programs=n=>Object.fromEntries(Array.from({length:n},(_,i)=>['source-'+i,binding('private/source-'+i+'.txt')]));
 assert.deepEqual(candidateChain.verifyProgramBindingAliases(programs(256)),{roles:256,uniquePaths:256});
 for(const n of [257,260])assert.throws(()=>candidateChain.verifyProgramBindingAliases(programs(n),{maximumEntries:260}),/source role ceiling/);
 assert.throws(()=>candidateChain.verifyProgramBindingAliases({first:binding('same.mjs'),second:binding('same.mjs')}),/one exact binding/);
 assert.throws(()=>candidateChain.verifyProgramBindingAliases({constructor:binding('safe.mjs')}));
 assert.throws(()=>verifyPreparationSources(process.cwd(),programs(257),registration.PROFILE.candidateSelection),/source_count_limit/);
});

test('read-only collector reports the complete257 source deficit and refuses caller maxima',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'decode1-source-count-'));
 t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
 const required={};for(let i=0;i<257;i++){const name='source-'+i+'.txt';fs.writeFileSync(path.join(root,name),'inert-source');required['s'+i]=name;}
 const options={root,required,bind:name=>({path:name,sha256:digest(fs.readFileSync(path.join(root,name)))}),maximumEntries:260};
 assert.throws(()=>collectActualExecutionSources(options),e=>e.deficit===1&&e.boundSourceCount===257&&e.maximumEntries===256&&e.sourcePaths.length===257);
 delete required.s256;assert.equal(Object.keys(collectActualExecutionSources(options)).length,256);
 fs.writeFileSync(path.join(root,'source-0.txt'),Buffer.alloc(1048577));assert.throws(()=>collectActualExecutionSources(options),/file ceiling/);
});

test('resource first error retains the exact triggering poll and defeats a later worker/pipe failure',()=>{
 const poll={gpuIndex:0,gpuUuid:'GPU-private-0001',sampledAtUtc:'2026-10-18T11:00:00Z',freeVramMiB:2047,temperatureC:85,
  minimumFreeVramMiB:2048,maximumTemperatureC:85,triggered:['free_vram_below_minimum','temperature_at_or_above_maximum']};
 const message='GPU resource guard: '+JSON.stringify(poll),first=Error(message);
 assert.equal(isResourceGuardMessage(message),true);
 const selected=primaryErrorBeforeNativeFinalization({primaryError:first,proof:{exitCode:1}});
 assert.equal(selected,first);assert.equal(boundedNativeFailureMetadata(selected).message,message);
 assert.equal(primaryErrorForControlStream(null,message,Object.assign(Error('EPIPE'),{code:'EPIPE'})).message,message);
 assert.equal(primaryErrorBeforeNativeFinalization({proof:{exitCode:1,stopReason:message}}).message,message);
 for(const altered of ['GPU resource guard: not-json',message+'x','GPU resource guard: '+JSON.stringify({...poll,maximumTemperatureC:86}),
  'GPU resource guard: '+JSON.stringify({...poll,gpuUuid:'bad'}),'GPU resource guard: '+JSON.stringify({...poll,extra:'x'.repeat(2048)})])
  assert.equal(isResourceGuardMessage(altered),false);
 assert.equal(boundedNativeFailureMetadata(Error('untrusted private payload')).untrustedMessageSuppressed,true);
});

test('only private retained native receipts can authorize handoff; disk and cleanup booleans cannot',()=>{
 const forged={phase:'qualification',cleanupConfirmed:true,processCleanupConfirmed:true,proof:{activeProcessesAfterCleanup:0}};
 assert.equal(hasLiveOwnedProof(forged),false);assert.equal(cleanupForCurrentCall({ownedReceipt:forged},forged),false);
 assert.throws(()=>requireLiveOwnedReceipt(process.cwd(),binding('synthetic/release-receipt.json')),/same retained native call/);
 assert.equal(nativeBudget('cpu').timeoutMs,240000);
 for(const phase of ['training','qualification','review'])assert.throws(()=>nativeBudget(phase),/requires its own immutable/);
 assert.throws(()=>nativeBudget('unknown'));
});

test('prepare selection uses only the independently registered route and existing six-phase adapter',()=>{
 const r=localPreparationRoute(registration.PROFILE.candidateSelection);
 assert.equal(r.registration,LOCAL_DECODE1_ENTRY_WEIGHT_PREPARE_REGISTRATION);assert.equal(r.adapter,candidateChain.ADAPTER);
 assert.equal(r.prefix,'decode1-entry-quality-v1-');assert.equal(r.packagePrefix,'decode1-entry-quality-v1-package-');
 for(const phase of ['preflight','execute','validate','review','adjudicate','finalize'])
  assert.equal(typeof createPhaseAdaptersForIsolatedTests({})[phase],'function');
});

for(const completion of [0,1,2])for(const scenario of ['registered','wrong-adapter','wrong-registration','unknown-capability'])test('shared start/status/stop route keeps exact '+(completion?'completion-v'+completion:'target48')+' '+scenario+' boundary',t=>{
 const temporary=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(temporary,'decode1-entry-stop-scope-'));
 t.after(()=>{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),temporary);
  assert(path.basename(resolved).startsWith('decode1-entry-stop-scope-'));fs.rmSync(resolved,{recursive:true});});
 const packageId='decode1-entry-quality-v1-package-00000000-0000-4000-8000-000000000001',
  packagePath='.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json';
 const phases=['preflight','execute','validate','review','adjudicate','finalize'];
 const entry={...(completion===2?LOCAL_DECODE1_ENTRY_COMPLETION_V2_CONTROL_REGISTRATION:completion?LOCAL_DECODE1_ENTRY_COMPLETION_CONTROL_REGISTRATION:LOCAL_DECODE1_ENTRY_WEIGHT_CONTROL_REGISTRATION)};
 if(scenario==='wrong-registration')entry.capabilityVersion='unregistered-model';
 const index={schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',normalAuthority:'local_ai_pet_world_program',ownerInNormalStateMachine:false,currentEntrypoints:[],localControlEntrypoints:[entry]};
 const registryPath=path.join(root,'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json');
 fs.mkdirSync(path.dirname(registryPath),{recursive:true});fs.writeFileSync(registryPath,JSON.stringify(index));
 const spec={packageIdentity:packageId,capabilityVersion:scenario==='unknown-capability'?'unknown-completion-capability':completion===2?registration.COMPLETION_V2_CAPABILITY:completion?registration.COMPLETION_CAPABILITY:registration.CAPABILITY,maxInfrastructureRecoveryAttempts:0,
  phaseAdapters:Object.fromEntries(phases.map(phase=>[phase,{path:scenario==='wrong-adapter'?'scripts/run-ai-painter-ecology-quality-v1.mjs':entry.adapterFile,exportName:phase}])),programLineage:{}};
 const bytes=Buffer.from(JSON.stringify(spec));fs.mkdirSync(path.dirname(path.join(root,packagePath)),{recursive:true});fs.writeFileSync(path.join(root,packagePath),bytes);
 const expected={registered:'local_source_count_limit','wrong-adapter':'local_arbitrary_adapter_rejected','wrong-registration':'local_capability_entry_not_registered','unknown-capability':'local_unknown_capability_or_retries'}[scenario];
 assert.throws(()=>validateLocalStartPackage(root,{command:'start',packagePath,packageSha256:crypto.createHash('sha256').update(bytes).digest('hex')}),new RegExp(expected));
});

function entryTimingFixture(t,{mapped=true,name=null,capabilityVersion=registration.CAPABILITY}={}){
 const projectRoot=process.cwd(),temporary=fs.realpathSync(os.tmpdir());
 const base=fs.mkdtempSync(path.join(temporary,'decode1-entry-accounting-'));
 const route=registration.executionRoute(capabilityVersion);
 name??=(route.runPrefix??'decode1-entry-quality-v1-')+crypto.randomUUID();
 const logical=route.OUTPUT_ROOT+'/'+name;
 const dir=mapped?inside(projectRoot,logical):path.join(base,logical);
 assert.equal(fs.existsSync(dir),false,'fresh private accounting fixture required');fs.mkdirSync(dir,{recursive:true});
 t.after(()=>{
  if(mapped)for(const target of [dir,dir+'.moved']){
   assert.equal(path.dirname(target),path.dirname(dir));assert.equal(path.basename(dir),name);
   if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
  }
  assert.equal(path.dirname(base),temporary);fs.rmSync(base,{recursive:true,force:true});
 });
 return {projectRoot:mapped?projectRoot:base,base,logical,dir,final:path.join(dir,'gpu-qualification-timing.json'),staged:path.join(dir,'gpu-qualification-timing.json.staged')};
}
function entryAccountingFs(overrides,action){
 const originals=Object.fromEntries(Object.keys(overrides).map(key=>[key,fs[key]]));
 try{for(const [key,hook]of Object.entries(overrides))fs[key]=(...args)=>hook(originals[key],...args);return action();}
 finally{for(const [key,value]of Object.entries(originals))fs[key]=value;}
}

for(const capabilityVersion of [registration.CAPABILITY,registration.SAME_CALL_CAPABILITY]){
const accountingLabel=capabilityVersion===registration.CAPABILITY?'target48':'same-call';
test(accountingLabel+' exact physical namespace reproduces the old failure and fully recounts the atomic replacement',t=>{
 const f=entryTimingFixture(t,{capabilityVersion});assert.notEqual(f.dir,path.join(process.cwd(),f.logical));
 fs.writeFileSync(path.join(f.dir,'sentinel.bin'),Buffer.alloc(11));
 fs.mkdirSync(path.join(f.dir,'nested'));fs.writeFileSync(path.join(f.dir,'nested','unchanged.bin'),Buffer.alloc(17));
 const reset=()=>{fs.writeFileSync(f.final,Buffer.alloc(5));fs.writeFileSync(f.staged,Buffer.alloc(37));};
 const hooks={lstatSync:(original,target,...args)=>{if(target===f.staged)fs.renameSync(f.staged,f.final);return original.call(fs,target,...args);}};
 reset();entryAccountingFs(hooks,()=>assert.throws(()=>historicalDirectoryBytes(f.dir),error=>error.code==='ENOENT'&&error.path===f.staged));
 reset();let scans=0;entryAccountingFs({...hooks,readdirSync:(original,target,...args)=>{if(target===f.dir)scans++;return original.call(fs,target,...args);}},()=>assert.equal(directoryBytes(f.dir),65));
 assert.equal(scans,2);assert.equal(fs.existsSync(f.staged),false);
});

test(accountingLabel+' stable final and staged bytes both count and retain the32768 limit',t=>{
 const f=entryTimingFixture(t,{capabilityVersion});fs.writeFileSync(f.final,Buffer.alloc(32768));fs.writeFileSync(f.staged,Buffer.alloc(32768));
 fs.writeFileSync(path.join(f.dir,'sentinel.bin'),Buffer.alloc(11));assert.equal(directoryBytes(f.dir),65547);
 for(const target of [f.final,f.staged]){fs.writeFileSync(target,Buffer.alloc(32769));assert.throws(()=>directoryBytes(f.dir),/32768/);fs.writeFileSync(target,Buffer.alloc(32768));}
});

test(accountingLabel+' continuous atomic replacement still fails after exactly three full scans',t=>{
 const f=entryTimingFixture(t,{capabilityVersion});fs.writeFileSync(f.final,Buffer.alloc(5));let scans=0,renames=0;
 entryAccountingFs({readdirSync:(original,target,...args)=>{if(target===f.dir){scans++;fs.writeFileSync(f.staged,Buffer.alloc(37));}return original.call(fs,target,...args);},
  lstatSync:(original,target,...args)=>{if(target===f.staged){fs.renameSync(f.staged,f.final);renames++;}return original.call(fs,target,...args);}},()=>assert.throws(()=>directoryBytes(f.dir),/did not settle within three scans/));
 assert.equal(scans,3);assert.equal(renames,3);
});

for(const kind of ['unknown','nested','unknown-suffix','unmapped','wrong-run'])test(accountingLabel+' timing exemption rejects '+kind,t=>{
 const f=entryTimingFixture(t,{capabilityVersion,mapped:kind!=='unmapped',...(kind==='wrong-run'?{name:'unregistered-'+crypto.randomUUID()}: {})});
 const name=kind==='unknown'?'unknown.json':kind==='nested'?'nested/gpu-qualification-timing.json.staged':kind==='unknown-suffix'?'gpu-qualification-timing.json.staged-unknown':'gpu-qualification-timing.json.staged';
 const file=path.join(f.dir,name),final=name==='unknown'?file:file.replace(/\.staged.*$/u,'');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.alloc(37));if(file!==final)fs.writeFileSync(final,Buffer.alloc(5));let vanished=0,scans=0;
 entryAccountingFs({readdirSync:(original,target,...args)=>{if(target===f.dir)scans++;return original.call(fs,target,...args);},
  lstatSync:(original,target,...args)=>{if(target===file&&vanished++===0){if(file===final)fs.unlinkSync(file);else fs.renameSync(file,final);}return original.call(fs,target,...args);}},()=>assert.throws(()=>directoryBytes(f.dir),error=>error.code==='ENOENT'&&error.path===file));
 assert.equal(scans,1);assert.equal(vanished,1);
});

for(const kind of ['permission','target-permission','missing','directory','junction','oversize'])test(accountingLabel+' atomic replacement rejects '+kind,t=>{
 const f=entryTimingFixture(t,{capabilityVersion});fs.writeFileSync(f.staged,Buffer.alloc(37));
 if(kind==='directory')fs.mkdirSync(f.final);
 else if(kind==='junction'){const target=path.join(f.base,'linked');fs.mkdirSync(target);fs.symlinkSync(target,f.final,'junction');}
 else if(kind!=='missing')fs.writeFileSync(f.final,Buffer.alloc(kind==='oversize'?32769:5));
 const denied=Object.assign(Error('private access denied'),{code:'EACCES'});let scans=0;
 entryAccountingFs({readdirSync:(original,target,...args)=>{if(target===f.dir){scans++;return original.call(fs,target,...args).sort((a,b)=>(a.name.endsWith('.staged')?-1:0)-(b.name.endsWith('.staged')?-1:0));}return original.call(fs,target,...args);},
  lstatSync:(original,target,...args)=>{if(target===f.staged){if(kind==='permission')throw denied;fs.unlinkSync(f.staged);}if(target===f.final&&kind==='target-permission')throw denied;return original.call(fs,target,...args);}},()=>assert.throws(()=>directoryBytes(f.dir),error=>kind==='permission'||kind==='target-permission'?error===denied:kind==='missing'?error.code==='ENOENT':kind==='oversize'?/32768/.test(error.message):/must be regular/.test(error.message)));
 assert.equal(scans,1);
});

test(accountingLabel+' budgeted writer uses the same exact recount and does not lose reserve or explicit file bytes',t=>{
 const f=entryTimingFixture(t,{capabilityVersion});fs.writeFileSync(f.final,Buffer.alloc(5));fs.writeFileSync(f.staged,Buffer.alloc(50));fs.writeFileSync(path.join(f.dir,'sentinel'),Buffer.alloc(5));
 const attempt=()=>withCandidateOutputBudget({projectRoot:f.projectRoot,roots:[f.logical],maximum:64,reserveBytes:1},()=>writeCandidateBudgeted(f.projectRoot,f.logical+'/blocked.bin',Buffer.alloc(10)));
 assert.throws(attempt,/total output reserve/);assert.equal(directoryBytes(f.dir),60);
 entryAccountingFs({lstatSync:(original,target,...args)=>{if(target===f.staged||target===path.join(f.projectRoot,f.logical,'gpu-qualification-timing.json.staged'))fs.renameSync(f.staged,f.final);return original.call(fs,target,...args);}},()=>assert.throws(attempt,/total output reserve/));
 assert.equal(directoryBytes(f.dir),55);assert.equal(fs.existsSync(path.join(f.dir,'blocked.bin')),false);
 const output=f.logical+'/accepted.bin';const result=withCandidateOutputBudget({projectRoot:f.projectRoot,roots:[f.logical],maximum:66,reserveBytes:1},()=>writeCandidateBudgeted(f.projectRoot,output,Buffer.alloc(10)));
 assert.equal(result.sha256,digest(Buffer.alloc(10)));assert.equal(directoryBytes(f.dir),65);
 assert.throws(()=>withCandidateOutputBudget({projectRoot:f.projectRoot,roots:[f.logical],maximum:100,reserveBytes:1,files:[output]},()=>{}),/already counted/);
 const external=f.logical+'.accounted';fs.writeFileSync(path.join(f.dir,'../'+path.basename(external)),Buffer.alloc(40));
 t.after(()=>{const absolute=path.resolve(f.dir,'../'+path.basename(external));assert.equal(path.dirname(absolute),path.dirname(f.dir));fs.unlinkSync(absolute);});
 assert.throws(()=>withCandidateOutputBudget({projectRoot:f.projectRoot,roots:[f.logical],maximum:110,reserveBytes:1,files:[external]},()=>writeCandidateBudgeted(f.projectRoot,f.logical+'/blocked-again.bin',Buffer.alloc(10))),/total output reserve/);
});

test(accountingLabel+' progress and heartbeat keep their existing atomic rescan semantics',t=>{
 for(const [name,suffix]of [['progress.json','0123456789abcdef'],['heartbeat.json','01234567-89ab-cdef-0123-456789abcdef']]){
  const f=entryTimingFixture(t,{capabilityVersion}),final=path.join(f.dir,name),staged=final+'.staged-'+suffix;
  fs.writeFileSync(final,Buffer.alloc(5));fs.writeFileSync(staged,Buffer.alloc(37));fs.writeFileSync(path.join(f.dir,'sentinel'),Buffer.alloc(11));let scans=0;
  entryAccountingFs({lstatSync:(original,target,...args)=>{if(target===staged)fs.renameSync(staged,final);return original.call(fs,target,...args);},readdirSync:(original,target,...args)=>{if(target===f.dir)scans++;return original.call(fs,target,...args);}},()=>assert.equal(directoryBytes(f.dir),48));assert.equal(scans,2);
 }
});

test(accountingLabel+' accounting preserves historical shared IO bytes and regular writer parity',t=>{
 assert.equal(digest(fs.readFileSync('scripts/lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs')),'a2d71e05d98800d389bd4ed2c8b8c57a6a929f0584b7cacf8340d6819b86969c');
 const f=entryTimingFixture(t,{capabilityVersion});const value={schema:'private-accounting-fixture',count:12};
 const result=withCandidateOutputBudget({projectRoot:f.projectRoot,roots:[f.logical],maximum:1024,reserveBytes:64},()=>writeCandidateBudgeted(f.projectRoot,f.logical+'/ordinary.json',value));
 assert.deepEqual(fs.readFileSync(inside(f.projectRoot,result.path)),Buffer.from(JSON.stringify(value)+'\n'));
 assert.equal(directoryBytes(f.dir),historicalDirectoryBytes(f.dir));
 assert.throws(()=>withCandidateOutputBudget({projectRoot:f.projectRoot,roots:[f.logical],maximum:1024,reserveBytes:64},()=>writeCandidateBudgeted(f.projectRoot,f.logical+'.outside',value)),/outside explicit accounting scope/);
 assert.throws(()=>writeCandidateBudgeted(f.projectRoot,f.logical+'/ordinary.json',value),error=>error.code==='EEXIST');
});
}


