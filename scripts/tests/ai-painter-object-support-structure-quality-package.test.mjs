// Synthetic protocol checks only. No native command, process stop or model call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as chain from '../lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs';
import * as reg from '../lib/ai-painter-object-support-structure-quality-registration-v1.mjs';
import * as native from '../lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs';

const clone=structuredClone,zero='0'.repeat(64),bound=p=>({path:p,sha256:zero});
const root=process.cwd();
const source=new URL('../lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs',import.meta.url);
const aliases={
 'control:ai-painter-ecology-decode1-quality':'node scripts/run-ai-painter-ecology-decode1-quality-v1.mjs',
 'control:ai-painter-ecology-terrain-detail-quality':'node scripts/run-ai-painter-ecology-terrain-detail-quality-v1.mjs',
 'control:ai-painter-object-support-structure-quality':'node scripts/run-ai-painter-object-support-structure-quality-v1.mjs'};
const programs=(n=179)=>Object.fromEntries(Array.from({length:n},(_,i)=>['source-'+i,bound('synthetic/source-'+i+'.mjs')]));
function candidate(){return chain.json(root,reg.CANDIDATE);}
function syntheticModel(){
 const graph=Array.from({length:108},(_,i)=>({name:'synthetic.parameter.'+i,shape:[1],elements:1,dtype:'torch.float32'}));
 graph[52]={name:'core.core.terrain.decode_1.layers.3.weight',shape:[48,48,3,3],elements:20736,dtype:'torch.float32'};
 graph[60]={...graph[52],name:'core.core.terrain.full_resolution_detail.layers.3.weight'};
 graph[0].elements=2242687-graph.slice(1).reduce((n,r)=>n+r.elements,0);graph[0].shape=[graph[0].elements];
 return {capabilityVersion:reg.CAPABILITY,modelCapabilityVersion:reg.MODEL_CAPABILITY,
  architecture:reg.ARCHITECTURE,numericRule:reg.NUMERIC_RULE,graph,initialState:{generator:zero,discriminator:zero}};
}
function cpuFixture(){
 const outputRoot=reg.OUTPUT_ROOT+'/synthetic-support-run-0001';
 const runtimeIdentity={python:{absolutePath:'synthetic-python.exe',sha256:zero},node:{absolutePath:'synthetic-node.exe',sha256:zero}};
 const request={schema:'object-support-structure-quality-cpu-request-v1',runId:'synthetic-support-run-0001',
  packageId:'synthetic-support-package-0001',outputRoot:outputRoot+'/cpu-entry',
  programBindings:programs(),configuration:reg.deriveConfiguration(candidate()),runtimeIdentity,
  modelIdentityOutput:outputRoot+'/model-identity.json',modelCapabilityVersion:reg.MODEL_CAPABILITY};
 const plan={...request,outputRoot,modelBinding:bound(request.modelIdentityOutput)};
 const raw={schema:'object-support-structure-quality-entry-cpu-report-v1',status:'passed',passed:20,failed:0,errors:0,skipped:0,
  synthetic:true,gpuInitialized:false,actualCalls:Object.fromEntries(['moduleForwardCalls','autogradCalls',
   'optimizerConstructionAttempts','optimizerUpdates','cudaInitializationAttempts'].map(k=>[k,0])),
  programBindings:clone(plan.programBindings),configuration:clone(plan.configuration),runtimeIdentity:clone(runtimeIdentity),
  modelBinding:clone(plan.modelBinding),initialModel:syntheticModel(),items:Array.from({length:20},()=>({status:'passed'}))};
 return {request,plan,raw};
}
function preparationFixture(){
 const outputRoot=reg.OUTPUT_ROOT+'/synthetic-support-run-0001';
 const expected={outputRoot,runId:'synthetic-support-run-0001',packageId:'synthetic-support-package-0001',programBindings:programs(),runtimeIdentity:{node:bound('runtime/node'),python:bound('runtime/python')}};
 const binding=bound(outputRoot+'/local-prepare/request.json');
 const request={schema:'ai-painter-local-prepare-request-v1',protocol:'ai-painter-local-control-v2',
  capabilityVersion:reg.CAPABILITY,candidateSelection:'object-support-structure-quality-v1',...expected,
  requestId:expected.runId,candidateBinding:reg.CANDIDATE,executionPackage:null,automaticRetries:0};
 return {binding,request,expected};
}
function receiptFixture(){
 return {ownerPid:17,bindingBase64:'same-current-command',ownerClosed:true,protocolError:null,stdoutBytes:7,stderrBytes:9,
  proof:{ownerPid:17,rootPid:19,rootCreationDateUtc:'2026-10-15T00:00:00Z',bindingBase64:'same-current-command',
   assignedBeforeResume:true,killOnJobClose:true,activeProcessesAfterCleanup:0,observationError:null,cleanupError:null,
   stdoutBytes:7,stderrBytes:9,streamClosureVersion:'bounded-stream-capture-v2',stdoutClosed:true,stderrClosed:true,
   transportCompleted:true,streamCaptureError:null,streamTransportError:null}};
}

test('support candidate has its own entry, profile and output while model identity is preserved',()=>{
 assert.equal(chain.CAPABILITY,'stage4_mvp256_dry_object_support_structure_quality24_v1');
 assert.equal(chain.MODEL_CAPABILITY,'stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1');
 assert.equal(chain.PLAN_SCHEMA,'object-support-structure-quality-plan-v1');
 assert.equal(chain.EXECUTION_PROFILE,'bounded_object_support_structure_quality24_v1');
 assert.equal(chain.ADAPTER,'scripts/run-ai-painter-object-support-structure-quality-v1.mjs');
 assert.equal(chain.OUTPUT_ROOT,'.runtime/ai-painter/object-support-structure-quality-executions');
});

test('current execution authority and historical CPU configuration are separate bindings',()=>{
 assert.notEqual(reg.SPECIFICATION.sha256,reg.CPU_BASELINE_SPECIFICATION.sha256);
 assert.notEqual(reg.SPECIFICATION.path,reg.CPU_BASELINE_SPECIFICATION.path);
 const current=chain.read(root,reg.SPECIFICATION),historical=chain.read(root,reg.CPU_BASELINE_SPECIFICATION);
 assert.ok(current.includes(Buffer.from('AI-PAINTER-SPEC-1.72')));
 assert.ok(historical.includes(Buffer.from('AI-PAINTER-SPEC-1.69')));
 const config=reg.deriveConfiguration(candidate());
 assert.equal(config.formalSpecification.sha256,reg.CPU_BASELINE_SPECIFICATION.sha256);
 assert.deepEqual(config.sourceAssetsCandidate,reg.CANDIDATE);assert.equal(Object.hasOwn(config,'sourceCandidate'),false);
 assert.deepEqual(config.lossDefinition,reg.LOSS);assert.deepEqual(config.gradientDefinition,reg.GRADIENT);
 assert.deepEqual(config.integrationPolicy,reg.INTEGRATION_POLICY);
});

test('bound reader rejects path traversal, absolute paths and a forged SHA before consuming input',()=>{
 for(const logical of ['../outside.json','data/../outside.json','/outside.json','C:/outside.json','data\\outside.json'])
  assert.throws(()=>chain.read(root,bound(logical)));
 assert.throws(()=>chain.read(root,{...reg.EXECUTION_POLICY,sha256:zero}),/input SHA differs/);
});

test('own policy and prior eight-source 90-case CPU evidence verify without any execution',()=>{
 const config=reg.deriveConfiguration(candidate()),policy=chain.verifyExecutionPolicy(root,config);
 assert.equal(policy.gpuAdmission.totalGeneratorAutograd,240);
 assert.equal(policy.gpuAdmission.generatorAutogradPerSample,5);
 assert.equal(policy.gpuAdmission.totalDiscriminatorAutograd,48);
 assert.equal(policy.checkpointIdentity.schema,'object-support-structure-quality-checkpoint-v1');
 assert.equal(Object.hasOwn(policy,'currentExternalWorkBoundary'),false);
 assert.equal(policy.lifecycleBoundary.samePackageGpuAdmission,true);
 assert.equal(policy.lifecycleBoundary.boundedTrainingAfterSamePackageGpuAdmission,true);
 assert.equal(policy.lifecycleBoundary.qualificationOnlyStopsBeforeTraining,true);
 assert.ok(Object.values(policy.qualification).every(v=>v===false));
 const evidence=chain.verifySupportStructurePriorCpuEvidence(root);
 assert.equal(evidence.sourceBindings.length,8);assert.equal(evidence.testSummary.passed,90);
});

test('manifest transition permits exactly the two existing aliases plus the new alias',()=>{
 const original={name:'synthetic',scripts:{check:'node check.mjs'},dependencies:{example:'1.0.0'}};
 const current={...clone(original),scripts:{...original.scripts,...aliases}};
 assert.equal(chain.verifyProjectManifestTransition(original,current),true);
 for(const key of Object.keys(aliases)){
  const missing=clone(current);delete missing.scripts[key];assert.throws(()=>chain.verifyProjectManifestTransition(original,missing));
  const changed=clone(current);changed.scripts[key]+=' --unsafe';assert.throws(()=>chain.verifyProjectManifestTransition(original,changed));
 }
 const changed=clone(current);changed.dependencies.example='2.0.0';assert.throws(()=>chain.verifyProjectManifestTransition(original,changed));
 const extra=clone(current);extra.scripts.other='node other.mjs';assert.throws(()=>chain.verifyProjectManifestTransition(original,extra));
 assert.throws(()=>chain.verifyProjectManifestTransition({...clone(original),scripts:{...original.scripts,...aliases}},current));
});

test('179 frozen roles are rebuilt with the historical source substitutions',()=>{
 const frozen=chain.json(root,reg.FROZEN_PLAN).programBindings,currentManifest=bound('package.json');
 assert.equal(Object.keys(frozen).length,179);
 const actual=Object.fromEntries(Object.entries(frozen).map(([role,b])=>['frozen-'+role,
  role==='source-137'?currentManifest:chain.historicalSourceBinding(role,b)]));
 assert.equal(chain.verifyHistoricalProgramBindings(frozen,actual,currentManifest),true);
 assert.deepEqual(actual['frozen-source-19'],chain.ORIGINAL_REGISTRY);
 assert.deepEqual(actual['frozen-source-151'],chain.ORIGINAL_NATIVE_TESTS);
 for(const role of ['source-0','source-19','source-137','source-151']){
  const bad=clone(actual);bad['frozen-'+role]=bound('synthetic/unrelated.mjs');
  assert.throws(()=>chain.verifyHistoricalProgramBindings(frozen,bad,currentManifest));
 }
});

test('legacy native test source permits only the original identifier rename',()=>{
 const original=chain.read(root,chain.ORIGINAL_NATIVE_TESTS);
 const current=chain.read(root,chain.bind(root,chain.ROLES.currentLegacyNativeTests));
 assert.equal(chain.verifyNativeTestRename(original,current),true);
 assert.throws(()=>chain.verifyNativeTestRename(original,Buffer.concat([current,Buffer.from('// changed\n')])));
 assert.throws(()=>chain.historicalSourceBinding('source-19',bound(chain.ROLES.currentExecutionRegistry)));
});

test('same-path same-SHA aliases count once and conflicting identities fail closed',()=>{
 const values=programs();values.alias=clone(values['source-0']);
 assert.deepEqual(chain.verifyProgramBindingAliases(values),{roles:180,uniquePaths:179});
 values.alias.sha256='f'.repeat(64);assert.throws(()=>chain.verifyProgramBindingAliases(values),/source alias conflict/);
 assert.throws(()=>chain.verifyProgramBindingAliases(programs(257)),/source role ceiling/);
 assert.throws(()=>chain.verifyProgramBindingAliases(programs(178)),/source role ceiling/);
 const unsafe=programs();unsafe.constructor=bound('synthetic/unsafe.mjs');assert.throws(()=>chain.verifyProgramBindingAliases(unsafe));
});

test('bounded closure declares device objective, five-gradient bridge and every frozen reference',()=>{
 const roles={...chain.ROLES,...chain.SUPPORT_DEPENDENCY_ROLES,...chain.LOCAL_DEPLOYMENT_DEPENDENCY_ROLES};
 assert.ok(179+Object.keys(roles).length<=256);
 for(const binding of [reg.LOSS,reg.GRADIENT,reg.INTEGRATION_POLICY,reg.CPU_BASELINE_SPECIFICATION])assert.ok(Object.values(roles).includes(binding.path));
 for(const name of ['native_rgb_object_support_structure_device_v1.py','object_support_structure_priority_update_device_v1.py',
  'native_rgb_object_support_structure_candidate_cpu_v1.py','object_support_structure_priority_update_cpu_v1.py',
  'painter_stage4_object_support_structure_training_profile_cpu_v1.py','object_support_structure_checkpoint_v1.py',
  'ecology_terrain_detail_weight_checkpoint_v1.py','painter_stage4_ecology_terrain_detail_weight_training_profile_v1.py'])
  assert.ok(Object.values(roles).some(p=>p.endsWith('/'+name)),name);
 assert.equal(chain.ROLES.cpuHarness,'ml/ai-painter/tests/test_object_support_structure_execution_cpu_v1.py');
 assert.equal(chain.ROLES.reviewDriver,'scripts/run-ai-painter-object-support-structure-quality-review-v1.mjs');
 for(const name of ['src/server/ai-console/bound-training-presentation.mjs','src/server/ai-console/training-history-detail-adapters.mjs'])
  assert.ok(Object.values(roles).includes(name),name);
 assert.ok(Object.values(roles).includes('data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json'));
});

test('CPU report accepts a complete synthetic report and retains original zero-call gates',()=>{
 const {raw,request,plan}=cpuFixture();assert.equal(chain.verifyCpuReport(raw,request,plan),raw);
 for(const field of Object.keys(raw.actualCalls)){
  const bad=clone(raw);bad.actualCalls[field]=1;assert.throws(()=>chain.verifyCpuReport(bad,request,plan));
 }
 for(const [key,value]of [['passed',19],['failed',1],['errors',1],['skipped',1],['synthetic',false],['gpuInitialized',true]]){
  const bad=clone(raw);bad[key]=value;assert.throws(()=>chain.verifyCpuReport(bad,request,plan));
 }
});

test('CPU report refuses old schema, model identity, changed sources and cross-Run paths',()=>{
 const {raw,request,plan}=cpuFixture();
 for(const mutate of [v=>{v.schema='ecology-terrain-detail-weight-quality-entry-cpu-report-v1'},
  v=>{v.initialModel.capabilityVersion='stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_quality24_v1'},
  v=>{v.modelBinding.path=reg.OUTPUT_ROOT+'/other-run/model-identity.json'},
  v=>{v.programBindings['source-0'].sha256='f'.repeat(64)},v=>{v.items[0].status='skipped'},
  v=>{v.configuration.executionCeiling.maxWallSeconds++}]){
  const bad=clone(raw);mutate(bad);assert.throws(()=>chain.verifyCpuReport(bad,request,plan));
 }
 const borrowed=clone(request);borrowed.modelBinding=clone(plan.modelBinding);
 assert.throws(()=>chain.verifyCpuReport(raw,borrowed,plan),/must not import a reference identity/);
});

test('preparation namespace requires its own exact registered request without consumed execution',()=>{
 const {binding,request,expected}=preparationFixture();assert.equal(chain.validatePreparationNamespace(binding,request,expected),request);
 for(const mutate of [v=>{v.candidateSelection='ecology-terrain-detail-quality-v1'},v=>{v.outputRoot+='-other'},
  v=>{v.capabilityVersion='old-candidate'},v=>{v.requestId='old-run'},v=>{v.executionPackage=bound('old/package.json')},
  v=>{v.automaticRetries=1},v=>{v.runtimeIdentity.node.sha256='f'.repeat(64)}]){
  const bad=clone(request);mutate(bad);assert.throws(()=>chain.validatePreparationNamespace(binding,bad,expected));
 }
 assert.throws(()=>chain.validatePreparationNamespace(bound(reg.OUTPUT_ROOT+'/other-run/local-prepare/request.json'),request,expected));
});

test('CPU budget preserves the original 240s managed ceiling, streams and 8MiB output',()=>{
 assert.deepEqual(native.nativeBudget('cpu'),{timeoutMs:240000,streamBytes:8388608,outputBytes:8388608});
 for(const phase of ['qualification','training','review'])assert.throws(()=>native.nativeBudget(phase),/requires its own immutable support plan/);
 for(const phase of ['old-training','gpu','stop'])assert.throws(()=>native.nativeBudget(phase),/unknown native phase/);
});

test('non-CPU budget refuses a predecessor plan before reading any native or runtime input',()=>{
 const f=cpuFixture(),plan={schema:'ecology-terrain-detail-weight-quality-plan-v1',...f.plan};
 assert.throws(()=>native.nativeBudget('training',{root,plan}));
 plan.schema=reg.PLAN_SCHEMA;plan.capabilityVersion='old-candidate';
 assert.throws(()=>native.nativeBudget('qualification',{root,plan}));
});

test('native ceiling rejects retries, resource successors and expanded phase limits before model IO',()=>{
 const plan={schema:reg.PLAN_SCHEMA,capabilityVersion:reg.CAPABILITY,executionProfile:reg.EXECUTION_PROFILE,
  executionMode:'bounded-quality-training',runId:'synthetic-support-run-0001',packageId:'synthetic-support-package-0001',
  outputRoot:reg.OUTPUT_ROOT+'/synthetic-support-run-0001',historicalCheckpointMayInitialize:false,trainingRestartAllowed:false,
  configuration:reg.deriveConfiguration(candidate())};
 for(const [key,value]of Object.entries({maxWallSeconds:8401,maxOutputMiB:129,cpuThreads:3,trainingAttempts:2,automaticRetries:1})){
  const bad=clone(plan);bad.configuration.executionCeiling[key]=value;
  assert.throws(()=>native.nativeBudget('training',{root,plan:bad}),/own support ceiling differs/);
 }
 for(const key of ['resourcePolicy','effectiveExecutionCeiling','resourceSuccessor']){
  const bad=clone(plan);bad[key]={maxWallSeconds:99999};assert.throws(()=>native.nativeBudget('training',{root,plan:bad}));
 }
 const bad=clone(plan);bad.configuration.gpuAdmissionSeconds=601;assert.throws(()=>native.nativeBudget('qualification',{root,plan:bad}));
});

test('transport receipt validates a closed bounded private Job without granting live authority',()=>{
 const fixture=receiptFixture();assert.equal(native.validateNativeReceipt(fixture),true);
 assert.equal(native.hasLiveOwnedProof(fixture.proof),false);
 assert.equal(native.hasLiveOwnedProof({...fixture,cleanupConfirmed:true}),false);
 assert.equal(native.cleanupForCurrentCall({ownedReceipt:fixture},fixture),false);
 for(const mutate of [v=>{v.ownerClosed=false},v=>{v.protocolError='bad'},v=>{v.proof.activeProcessesAfterCleanup=1},
  v=>{v.proof.assignedBeforeResume=false},v=>{v.proof.killOnJobClose=false},v=>{v.proof.stdoutClosed=false},
  v=>{v.proof.stderrClosed=false},v=>{v.proof.transportCompleted=false},v=>{v.proof.streamCaptureError='error'},
  v=>{v.proof.streamTransportError='error'},v=>{v.proof.bindingBase64='other-command'},v=>{v.stdoutBytes++}]){
  const bad=clone(fixture);mutate(bad);assert.equal(native.validateNativeReceipt(bad),false);
 }
});

test('serialized receipt cannot authorize ordinary or terminal writes, fixture cleanup or failure evidence',async()=>{
 const stored={schema:'detail-weight-live-native-owner-receipt-v1',cleanupConfirmed:true,processCleanupConfirmed:true,
  ...receiptFixture(),phase:'cpu',outputAccountingRoots:[reg.OUTPUT_ROOT+'/synthetic-support-run-0001'],
  budget:{outputBytes:8388608},streamBytes:{stdout:0,stderr:0},cpuNegativeInputs:{fixtureLinksRemoved:true}};
 let calls=0;const action=()=>{calls++};
 await assert.rejects(native.withNativeOrdinaryBudget(root,stored,action),/same live native call required/);
 await assert.rejects(native.withNativeReceiptBudget(root,stored,action),/same live native call required/);
 assert.equal(native.hasLiveCpuFixtureCleanup(stored),false);
 assert.throws(()=>native.requireLiveOwnedReceipt(root,bound(reg.OUTPUT_ROOT+'/synthetic-support-run-0001/release-receipt.json')),/stored proof grants no authority/);
 assert.throws(()=>native.currentNativeFailureScope(root,stored),/current native failure call required/);
 await assert.rejects(native.persistNativeFailureEvidence(root,stored,Error('wall_timeout'),'preparation'),/current native failure call required/);
 assert.equal(calls,0);
});

test('CPU and review accounting retain link reserves, closed SQLite sidecar debit and both review roots',()=>{
 const bytes=native.cpuRegistryFixtureBudgetTotal({diskBytes:100,closedSidecarDebitBytes:50,streamBytes:30,guardBytes:20,linkReserveBytes:49152,reserveBytes:65536});
 assert.equal(bytes,100+50+30+20+49152+65536);
 native.assertCpuNegativeInputBudget(bytes,8388608-bytes,8388608);
 assert.throws(()=>native.assertCpuNegativeInputBudget(bytes,8388609-bytes,8388608),/combined output budget/);
 assert.throws(()=>native.assertCpuNegativeInputBudget(0,0,8388609),/ceiling may not expand/);
 assert.throws(()=>native.cpuRegistryFixtureBudgetTotal({diskBytes:1,closedSidecarDebitBytes:-1}));
 const outputRoot=reg.OUTPUT_ROOT+'/synthetic-support-run-0001/dry-review-owned',guard='.runtime/ai-painter/owned-worker-guards/synthetic';
 assert.deepEqual(native.nativeAccountingRoots(root,outputRoot,guard,null,'review'),[outputRoot,outputRoot.replace(/-owned$/u,''),guard]);
});

test('all three SQLite fixture lease requests remain bound to one current call and compact roots',()=>{
 const context={callIdentity:'synthetic-current-call',request:bound('synthetic/request.json'),declaration:bound('synthetic/declaration.json'),
  entryRoot:reg.OUTPUT_ROOT+'/synthetic-support-run-0001/cpu-entry'};
 for(const name of ['dispatch','finalization','failure']){
  const value={schema:'cpu-registry-fixture-keeper-request-v1',callIdentity:context.callIdentity,
   request:context.request,declaration:context.declaration,name,root:context.entryRoot+'/r/'+name,rootIdentity:'1:2'};
  assert.equal(native.validateCpuRegistryFixtureLeaseRequest(context,value),value);
  for(const patch of [{callIdentity:'other'},{root:context.entryRoot+'/r/../'+name},{rootIdentity:'caller-verified'},
   {request:bound('other/request.json')},{extra:true}])assert.throws(()=>native.validateCpuRegistryFixtureLeaseRequest(context,{...value,...patch}));
 }
});

test('CPU fixture links have exact ordinary targets and stable observed identities',()=>{
 const logical=reg.OUTPUT_ROOT+'/synthetic-support-run-0001',layout=native.cpuNegativeInputLayout(logical);
 assert.equal(layout.links.length,3);assert.equal(native.CPU_LINK_RESERVE_BYTES,49152);
 const target=path.resolve(root,'synthetic-target'),stat={dev:1n,ino:2n,isSymbolicLink:()=>true};
 assert.equal(native.validateCpuNegativeLink(layout.links[0].path,stat,target,target),'1:2');
 assert.throws(()=>native.validateCpuNegativeLink(layout.links[0].path,stat,target,target,'1:3'),/identity replaced/);
 assert.throws(()=>native.validateCpuNegativeLink(layout.links[0].path,stat,target,target+'-other'),/target differs/);
 assert.throws(()=>native.validateCpuNegativeLink(layout.links[0].path,{...stat,isSymbolicLink:()=>false},target,target));
});

test('native framing counts all complete frames with a fresh accounting pass per block',()=>{
 const lines=[],errors=[];let scans=0,overflow=0;
 const callbacks={onFrame:s=>lines.push(s),onError:e=>errors.push(e),onOverflow:()=>overflow++,account:()=>scans++};
 let pending=native.consumeNativeOwnerChunk('',Buffer.from('O:YQ'),callbacks);assert.equal(scans,0);
 pending=native.consumeNativeOwnerChunk(pending,Buffer.from('==\nE:Yg==\n'),callbacks);
 assert.equal(pending,'');assert.deepEqual(lines,['O:YQ==','E:Yg==']);assert.equal(scans,1);
 native.consumeNativeOwnerChunk('',Buffer.from('R:e30=\n'),callbacks);assert.equal(scans,2);
 native.consumeNativeOwnerChunk('',Buffer.from('x'.repeat(65537)),callbacks);assert.equal(overflow,1);assert.deepEqual(errors,[]);
});

test('primary stop reason and private failure metadata survive secondary transport errors',()=>{
 const primary=Error('wall_timeout'),pipe=Object.assign(Error('private token'),{code:'EPIPE'});
 assert.equal(native.primaryErrorForControlStream(primary,'wall_timeout',pipe),primary);
 const derived=native.primaryErrorForControlStream(null,'wall_timeout',pipe);
 assert.equal(native.boundedNativeFailureMetadata(derived).reason,'wall_timeout');
 const record=native.boundedNativeFailureMetadata(pipe);
 assert.equal(record.untrustedMessageSuppressed,true);assert.equal(record.rawStackRecorded,false);
 assert.equal(JSON.stringify(record).includes('private token'),false);
});

test('operator stop remains wired to the real retained call and never treats secret presence as authentication',()=>{
 assert.equal(native.operatorStopControlAvailability({}).available,false);
 const configured=native.operatorStopControlAvailability({AI_PET_WORLD_OPERATOR_SESSION_SECRET:'x'.repeat(32)});
 assert.equal(configured.status,'stable_operator_secret_configured_not_authenticated');
 const raw=fs.readFileSync(source,'utf8');
 for(const fragment of ['createOwnedStopNativeControl({projectRoot:root,evidenceRoot',
  'const readRetainedNativeCall=()=>child&&!closed&&!settled?descriptor:null',
  'stopControl.abortReason()','stopControl.preparePending()',
  'registered?.processId,process.pid','registered.processStartIdentity,creation',
  'fs.unlinkSync(guardPath)','liveReceipts.add(receipt)'])assert.ok(raw.includes(fragment),fragment);
 assert.equal(raw.includes('reviewRecoveryNativeContext'),false);
});

test('unknown native options fail before compilation, spawn, stop or any filesystem mutation',async()=>{
 await assert.rejects(native.runNative({bypass:true}),/unsupported native option/);
});
