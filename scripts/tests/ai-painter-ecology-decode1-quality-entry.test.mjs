import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import * as reg from '../lib/ai-painter-ecology-decode1-quality-registration-v1.mjs';
import {ROLES,verifyCpuReport,validatePreparationNamespace,verifyProjectManifestTransition} from '../lib/ai-painter-ecology-decode1-quality-package-chain-v1.mjs';
import {createPhaseAdaptersForIsolatedTests,createPreparationAdaptersForIsolatedTests,parsePreparationArguments,verifyStoredGpuAcceptance,classifyPreparationFailure,preservePreparationCliFailure}
 from '../run-ai-painter-ecology-decode1-quality-v1.mjs';
import {nativeBudget,hasLiveOwnedProof,cleanupForCurrentCall,validateNativeReceipt,createNativeFailureProtocolFixtureForIsolatedTests,
 persistNativeFailureEvidence,withNativeReceiptBudget,withNativeOrdinaryBudget,boundedNativeFailureMetadata}
 from '../lib/ai-painter-ecology-decode1-quality-owned-native-v1.mjs';
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex'),zero='0'.repeat(64),bound=p=>({path:p,sha256:zero});
const clone=structuredClone;
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
 assert.equal(out.trainingStarted,false);assert.equal(out.optimizerSteps,0);assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification']);
 assert.equal(s.nativeCalls[1].args[1],path.resolve(s.f.root,ROLES.gpuQualifier));assert.equal(s.store.has(s.f.plan.outputRoot+'/worker-terminal.json'),false);
 assert.equal(s.store.get(s.f.plan.outputRoot+'/package.json').schemaVersion,'ai-painter-current-training-package-v1');
 assert.equal(s.store.has(s.f.plan.outputRoot+'/execution-consumed.json'),false);assert.equal(s.registryWrites.at(-1).activeExecution,null);
 assert.equal(s.registryWrites.at(-1).latestTrainingTerminal,undefined);assert.equal(s.getCurrent().registryRevision,411);
 assert.equal(s.registryWrites.at(-1).taskKind,'ecology_decode1_weight_readonly_gpu_qualification');assert.match(s.registryWrites.at(-1).taskGoal,/zero optimizer updates/);
 await assert.rejects(s.adapters.qualifyOnly({heartbeat(){}}),/twice/);assert.equal(s.nativeCalls.length,2);});
test('same-package explicit execution uses trusted stored gate and does not run qualifier twice',async()=>{const s=simulated();await s.adapters.qualifyOnly({heartbeat(){}});
 await s.adapters.execute({heartbeat(){}});assert.deepEqual(s.nativeCalls.map(v=>v.phase),['cpu','qualification','training']);
 assert.ok(s.store.has(s.f.plan.outputRoot+'/qualification-lock.json'));assert.ok(s.store.has(s.f.plan.outputRoot+'/execution-lock.json'));
 await assert.rejects(s.adapters.execute({heartbeat(){}}));assert.equal(s.nativeCalls.length,3);});
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
