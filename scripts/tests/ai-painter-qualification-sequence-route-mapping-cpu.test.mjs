import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as registration from '../lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs';
import {authorityBindings,verifyExecutionPolicy,verifyQualificationFailureCapturePolicy,
 verifyQualificationFailureCaptureCpuEvidence,verifyTrainingFailureCapturePolicy,verifyTrainingFailureCaptureCpuEvidence,
 TRAINING_CAPTURE_CORE,TRAINING_CAPTURE_V2_CORE,TRAINING_CAPTURE_V3_CORE,TRAINING_CAPTURE_V4_CORE,TRAINING_CAPTURE_V5_CORE,TRAINING_CAPTURE_V6_CORE,TRAINING_CAPTURE_SOURCES,trainingCaptureIdentity,
 CANONICAL_VERIFICATION_CORE,CANONICAL_VERIFICATION_V4_CORE,CANONICAL_VERIFICATION_V5_CORE,CANONICAL_VERIFICATION_V6_CORE,canonicalVerificationIdentity,verifyCanonicalVerificationPolicy} from '../lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs';
import {parseTrainingInterfacePolicy} from '../../src/server/ai-console/training-preview-history-v1.mjs';

// These are isolated metadata fixtures. No model, Python, native owner or GPU is invoked.
const project=process.cwd(),oldPolicy=JSON.parse(fs.readFileSync(path.join(project,
 'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v11.json')));
const candidate=JSON.parse(fs.readFileSync(path.join(project,oldPolicy.sourceCandidate.path)));
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const bound=p=>({path:p,sha256:'a'.repeat(64)});
const sources=[
 'ml/ai-painter/scripts/qualification_parameter0_capture_v1.py',
 'ml/ai-painter/scripts/qualification_gradient_gate_authentication_cpu_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_observation_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_reference_v1.py'];
function capture(){return {
 schemaVersion:'qualification-parameter0-sequence-capture-v1',capabilityVersion:registration.QUALIFICATION_CAPTURE_CAPABILITY,
 phase:'qualification',sampleId:'ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2',sampleOrdinal:17,split:'train',
 target:{index:0,name:'core.core.terrain.base_stem.layers.0.weight',shape:[48,31,3,3],spatial:[192,256]},
 sequenceSamples:48,sameGeneratorAndDiscriminatorInstances:true,originalOrderAndSeedKept:true,originalGateAndToleranceKept:true,
 originalFailureFirst:true,additionalForwardCalls:0,additionalAutogradCalls:0,additionalOptimizerUpdates:0,
 maximumCaptureAndWorkspaceBytes:67108864,maximumAggregateSidecarBytes:2097152,terminalReserveBytes:65536,
 rawTargetGradientSets:5,finiteReferenceCoordinates:1,nonfiniteSumReferenceCalls:0,otherSampleCaptureAllowed:false,
 qualificationGranted:false,activation:'authenticated_new_package_only',failureAction:'preserve_primary_and_close_no_retry',
 completeSequenceAction:'original_same_package_training_only_after_all48_and_state_checks',
 componentSources:sources.map(bound),
 cpuEvidence:bound('.runtime/ai-painter/controller-repair-reviews/qualification-sequence-capture-019-20261024/controller-integration-review.json')};}
function policy(){
 const p=structuredClone(oldPolicy),selector='d2o-p0c-v1';
 Object.assign(p,{candidate:registration.QUALIFICATION_CAPTURE_CAPABILITY,candidateSelection:selector,
  executionProfile:'completion_decode2_rgb_output_qualification_capture_v1',
  outputRoot:`.runtime/ai-painter/registered-training-${selector}-executions`,qualificationFailureCapture:capture()});
 Object.assign(p.interfaceContract,{candidateSelection:selector,runPrefix:selector+'-',packagePrefix:selector+'-package-'});
 return p;
}
function trainingPolicy(successor=false){
 const version=successor===6?6:successor===5?5:successor===4?4:successor===3?3:successor?2:1;
 const p=structuredClone(oldPolicy),selector=version===1?'d2o-p0t-v1':`d2o-p0t${version}-v1`,capability=registration.TRAINING_CAPTURE_CAPABILITIES[version-1];
 delete p.sameCallCapture;delete p.qualificationFailureCapture;
 Object.assign(p,{candidate:capability,candidateSelection:selector,
  executionProfile:`completion_decode2_rgb_output_training_capture_v${version}`,
  outputRoot:`.runtime/ai-painter/registered-training-${selector}-executions`,
  trainingFailureCapture:{...structuredClone(trainingCaptureIdentity(capability).core),componentSources:TRAINING_CAPTURE_SOURCES.map(bound),
   cpuEvidence:bound(trainingCaptureIdentity(capability).evidencePath)}});
 if([3,4,5,6].includes(version))p.canonicalVerification=structuredClone(canonicalVerificationIdentity(capability));
 Object.assign(p.interfaceContract,{candidateSelection:selector,runPrefix:selector+'-',packagePrefix:selector+'-package-'});
 return p;
}
function inRegistry(policies,action){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'painter-capture-route-cpu-')),previous=process.cwd();
 try{
  const index={schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',normalAuthority:'local_ai_pet_world_program',
   ownerInNormalStateMachine:false,trainingInterfaces:[]};
  for(const [i,p]of policies.entries()){
   const logical=`data/ai-painter/system-governance/capture-route-fixture-${i}.json`,raw=JSON.stringify(p);
   fs.mkdirSync(path.dirname(path.join(root,logical)),{recursive:true});fs.writeFileSync(path.join(root,logical),raw,{flag:'wx'});
   index.trainingInterfaces.push({candidateSelection:p.candidateSelection,executionPolicy:{path:logical,sha256:digest(raw)}});
  }
  fs.writeFileSync(path.join(root,registration.INTERFACE_REGISTRY_PATH),JSON.stringify(index),{flag:'wx'});
  process.chdir(root);return action(root);
 }finally{
  process.chdir(previous);
  const actual=fs.realpathSync(root),parent=fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(actual),parent);assert.ok(path.basename(actual).startsWith('painter-capture-route-cpu-'));
  fs.rmSync(actual,{recursive:true});
 }
}
const configuration=p=>registration.deriveConfiguration(candidate,{capabilityVersion:p.candidate,
 trainingPreviewPolicy:{path:p.trainingPreviewPolicy.path,sha256:p.trainingPreviewPolicy.sha256}});

test('fresh execution identity maps exactly to unchanged RGB architecture, numeric rule and weight1',()=>{
 const next=policy();inRegistry([oldPolicy,next],()=>{
  const prior=registration.executionRoute(oldPolicy.candidate),current=registration.executionRoute(next.candidate);
  for(const key of ['MODEL_CAPABILITY','ARCHITECTURE','NUMERIC_RULE'])assert.equal(current[key],prior[key]);
  assert.notEqual(current.CAPABILITY,prior.CAPABILITY);assert.notEqual(current.OUTPUT_ROOT,prior.OUTPUT_ROOT);
  assert.equal(current.candidateSelection,'d2o-p0c-v1');assert.equal(current.EXECUTION_PROFILE,next.executionProfile);
  const a=configuration(oldPolicy),b=configuration(next);
  for(const key of ['modelCapabilityVersion','objectSupportStructureWeight','seed','dataUse','optimizer','lossDefinition',
   'gradientDefinition','executionCeiling','gpuAdmissionSeconds','gpuAdmissionWallMode','checkpointSelection'])assert.deepEqual(b[key],a[key]);
  assert.equal(b.objectSupportStructureWeight,1);assert.equal(b.gpuAdmissionSeconds,null);
  assert.equal(verifyExecutionPolicy(next,b),next);
  assert.throws(()=>registration.executionRoute('unregistered_capture_fixture_v1'),/unknown execution identity/);
 });
});

test('capture model cannot be selected through a wrong candidate, selector, profile or caller model field',()=>{
 for(const change of [p=>p.modelCapability=registration.MODEL_CAPABILITY,
  p=>p.candidate='unregistered_capture_fixture_v1',p=>p.executionProfile='unexpected_capture_profile',
  p=>{p.candidateSelection='wrong-capture-v1';Object.assign(p.interfaceContract,{candidateSelection:p.candidateSelection,
   runPrefix:p.candidateSelection+'-',packagePrefix:p.candidateSelection+'-package-'});p.outputRoot=`.runtime/ai-painter/registered-training-${p.candidateSelection}-executions`;}]){
  const p=policy();change(p);assert.throws(()=>parseTrainingInterfacePolicy(p));
 }
});

test('new bound policies cannot change model target, learning weight, call counts or completion resources',()=>{
 for(const change of [p=>p.objectSupportStructureWeight=.5,p=>delete p.objectSupportStructureWeight,
  p=>p.modelBoundary.changedTargetIndex=0,p=>p.modelBoundary.targetShape=[48,31,3,3],
  p=>p.gpuAdmission.generatorAutogradPerSample=6,p=>p.executionCeiling.generatorOptimizerSteps=1153,
  p=>p.phaseResources.gpuAdmissionSeconds=180,p=>p.priorCpuEvidence.grantsGpuOrTrainingQualification=true]){
  const p=policy();change(p);
  assert.throws(()=>inRegistry([p],()=>verifyExecutionPolicy(p,configuration(p))));
 }
});

test('qualification capture requires exact bounded same-call contract and four ordered source bindings',()=>{
 const p=policy();assert.equal(verifyQualificationFailureCapturePolicy(p),p.qualificationFailureCapture);
 for(const change of [c=>c.extra=true,c=>delete c.originalFailureFirst,c=>c.phase='training',c=>c.sampleOrdinal=18,
  c=>c.sequenceSamples=1,c=>c.additionalForwardCalls=1,c=>c.additionalAutogradCalls=1,c=>c.maximumAggregateSidecarBytes++,
  c=>c.qualificationGranted=true,c=>c.rawTargetGradientSets=4,c=>c.nonfiniteSumReferenceCalls=1,
  c=>c.componentSources.reverse(),c=>c.componentSources[0].sha256='x'.repeat(64),
  c=>c.componentSources[0].optional=true,c=>c.cpuEvidence.path='other/review.json']){
  const changed=policy();change(changed.qualificationFailureCapture);
  assert.throws(()=>verifyQualificationFailureCapturePolicy(changed));
 }
 assert.equal(verifyQualificationFailureCapturePolicy(oldPolicy),null);
 assert.throws(()=>verifyQualificationFailureCapturePolicy({...oldPolicy,qualificationFailureCapture:capture()}),/legacy policy/);
});

test('CPU component provenance must bind the same actual sources without granting qualification',()=>{
 const c=capture(),proof={status:'cpu_component_passed_not_admitted',taskId:'QUALIFICATION-SEQUENCE-CAPTURE-019-CPU',
  qualificationGranted:false,sourceBindings:structuredClone(c.componentSources),
  tests:{passed:true,testsRun:1,cudaInitialized:false,modelCalls:0,autogradCalls:0,optimizerUpdates:0}};
 assert.equal(verifyQualificationFailureCaptureCpuEvidence(proof,c),proof);
 for(const change of [p=>p.status='passed',p=>p.taskId='another-task',p=>p.qualificationGranted=true,
  p=>p.sourceBindings[0].sha256='b'.repeat(64),p=>p.sourceBindings.pop(),p=>p.tests.testsRun=true,
  p=>p.tests.testsRun=0,p=>p.tests.passed=false,p=>p.tests.cudaInitialized=true,
  p=>p.tests.modelCalls=1,p=>p.tests.autogradCalls=1,p=>p.tests.optimizerUpdates=1]){
  const changed=structuredClone(proof);change(changed);assert.throws(()=>verifyQualificationFailureCaptureCpuEvidence(changed,c));
 }
});

test('authority closure contains all four capture sources, CPU evidence and numeric component evidence',()=>{
 const p=policy();inRegistry([p],()=>{
  const refs=authorityBindings(p);
  for(const expected of [...p.qualificationFailureCapture.componentSources,p.qualificationFailureCapture.cpuEvidence,p.numericRepairCpuEvidence]){
   assert.ok(refs.some(actual=>actual.path===expected.path&&actual.sha256===expected.sha256));
  }
 });
});

test('preexisting registered RGB and generic decode1 policies preserve their original mapping',()=>{
 const generic=JSON.parse(fs.readFileSync(path.join(project,
  'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v5.json')));
 const selector='interface-fixture-existing';generic.candidate='interface_fixture_existing_v1';generic.candidateSelection=selector;
 generic.outputRoot=`.runtime/ai-painter/registered-training-${selector}-executions`;generic.executionProfile='interface_fixture_existing_profile';
 Object.assign(generic.interfaceContract,{candidateSelection:selector,runPrefix:selector+'-',packagePrefix:selector+'-package-'});
 inRegistry([oldPolicy,generic],()=>{
  assert.equal(registration.executionRoute(generic.candidate).MODEL_CAPABILITY,registration.MODEL_CAPABILITY);
  assert.equal(registration.executionRoute(generic.candidate).NUMERIC_RULE,registration.NUMERIC_RULE);
  assert.equal(verifyExecutionPolicy(oldPolicy,configuration(oldPolicy)),oldPolicy);
 });
});

test('training capture has its own fixed identity but identical RGB arithmetic and completion limits',()=>{
 const p=trainingPolicy();inRegistry([oldPolicy,policy(),p],()=>{
  const a=registration.executionRoute(oldPolicy.candidate),b=registration.executionRoute(p.candidate);
  for(const key of ['MODEL_CAPABILITY','ARCHITECTURE','NUMERIC_RULE'])assert.equal(a[key],b[key]);
  const c=configuration(p);assert.equal(c.objectSupportStructureWeight,1);assert.equal(c.gpuAdmissionSeconds,null);
  assert.equal(b.candidateSelection,'d2o-p0t-v1');assert.equal(b.EXECUTION_PROFILE,'completion_decode2_rgb_output_training_capture_v1');
  assert.equal(verifyExecutionPolicy(p,c),p);
  const refs=authorityBindings(p);for(const binding of [...p.trainingFailureCapture.componentSources,p.trainingFailureCapture.cpuEvidence,p.numericRepairCpuEvidence])
   assert.ok(refs.some(actual=>actual.path===binding.path&&actual.sha256===binding.sha256));
  assert.ok(!refs.some(binding=>binding.path.includes('parameter90_training_same_call')));
 });
 for(const mutate of [p=>p.modelCapability=registration.MODEL_CAPABILITY,p=>p.executionProfile='wrong_training_profile',
  p=>{p.candidateSelection='other-p0t-v1';Object.assign(p.interfaceContract,{candidateSelection:p.candidateSelection,runPrefix:p.candidateSelection+'-',packagePrefix:p.candidateSelection+'-package-'});p.outputRoot=`.runtime/ai-painter/registered-training-${p.candidateSelection}-executions`;}]){
  const changed=trainingPolicy();mutate(changed);assert.throws(()=>parseTrainingInterfacePolicy(changed));
 }
});

test('training capture rejects wrong call position, extra operations, old observers and source retargeting',()=>{
 const p=trainingPolicy();assert.equal(verifyTrainingFailureCapturePolicy(p),p.trainingFailureCapture);
 for(const mutate of [c=>c.extra=true,c=>c.phase='qualification',c=>c.sampleId='other',c=>c.epoch=2,c=>c.zeroBasedEpochPosition=15,
  c=>c.trainIndex=9,c=>c.optimizerSteps.discriminator=14,c=>c.target.coordinate=[1,12,0,0],c=>c.target.padding=[0,0],
  c=>c.additionalForwardCalls=1,c=>c.localReferenceCalls=1,c=>c.maximumAggregateSidecarBytes++,c=>c.rawTargetGradientSets=4,
  c=>c.maximumObservedGCalls=2,c=>c.successAction='keep_hooks',c=>c.qualificationGranted=true,c=>c.componentSources.reverse(),
  c=>delete c.componentSources[0].sha256,c=>c.cpuEvidence.path='old/report.json']){
  const changed=trainingPolicy();mutate(changed.trainingFailureCapture);assert.throws(()=>verifyTrainingFailureCapturePolicy(changed));
 }
 for(const key of ['sameCallCapture','qualificationFailureCapture'])assert.throws(()=>verifyTrainingFailureCapturePolicy({...p,[key]:{}}));
 assert.throws(()=>verifyTrainingFailureCapturePolicy({...oldPolicy,trainingFailureCapture:p.trainingFailureCapture}));
 assert.equal(verifyTrainingFailureCapturePolicy(oldPolicy),null);
});

test('training component evidence distinguishes real calls from declared synthetic autograd and binds all sources',()=>{
 const capture=trainingPolicy().trainingFailureCapture;
 const proof={status:'cpu_component_passed_not_admitted',taskId:'TRAINING-SAME-CALL-CAPTURE-023-CPU',qualificationGranted:false,
  sourceBindings:structuredClone(capture.componentSources),tests:{passed:true,testsRun:1,cudaInitialized:false,
   realModelCalls:0,realAutogradCalls:0,realOptimizerUpdates:0,syntheticOperations:'Tiny synthetic convolution/autograd fixtures only.'}};
 assert.equal(verifyTrainingFailureCaptureCpuEvidence(proof,capture),proof);
 for(const mutate of [p=>p.taskId='old',p=>p.sourceBindings[0].sha256='b'.repeat(64),p=>p.tests.testsRun=true,
  p=>p.tests.realModelCalls=1,p=>p.tests.realAutogradCalls=1,p=>p.tests.realOptimizerUpdates=1,p=>p.tests.cudaInitialized=true,
  p=>delete p.tests.syntheticOperations,p=>p.tests.syntheticOperations='',p=>p.qualificationGranted=true]){
  const changed=structuredClone(proof);mutate(changed);assert.throws(()=>verifyTrainingFailureCaptureCpuEvidence(changed,capture));
 }
});

test('v2 capture has isolated fixed identity and identical arithmetic, resources and raw core',()=>{
 const p=trainingPolicy(true),old=trainingPolicy();inRegistry([oldPolicy,old,p],()=>{
  const a=registration.executionRoute(old.candidate),b=registration.executionRoute(p.candidate);
  for(const key of ['MODEL_CAPABILITY','ARCHITECTURE','NUMERIC_RULE'])assert.equal(a[key],b[key]);
  assert.equal(b.candidateSelection,'d2o-p0t2-v1');assert.equal(b.EXECUTION_PROFILE,'completion_decode2_rgb_output_training_capture_v2');
  const config=configuration(p);assert.equal(config.objectSupportStructureWeight,1);assert.equal(verifyExecutionPolicy(p,config),p);
  assert.deepEqual(TRAINING_CAPTURE_V2_CORE,JSON.parse(fs.readFileSync(path.join(project,'.runtime/ai-painter/controller-repair-reviews/registry-publication-repair-024-20261024/training-capture-contract-core.json'))));
  assert.deepEqual({...TRAINING_CAPTURE_V2_CORE,capabilityVersion:old.candidate},TRAINING_CAPTURE_CORE);
 });
 for(const mutate of [p=>p.trainingFailureCapture.capabilityVersion=old.candidate,p=>p.trainingFailureCapture.cpuEvidence=old.trainingFailureCapture.cpuEvidence,
  p=>p.executionProfile=old.executionProfile,p=>p.trainingFailureCapture.additionalAutogradCalls=1]){
  const changed=trainingPolicy(true);mutate(changed);assert.throws(()=>{parseTrainingInterfacePolicy(changed);verifyTrainingFailureCapturePolicy(changed)});
 }
});
test('v2 capture rejects old CPU task and mixed scope while v1 remains unchanged',()=>{
 for(const successor of [false,true]){
  const capture=trainingPolicy(successor).trainingFailureCapture,identity=trainingCaptureIdentity(capture.capabilityVersion);
  const proof={status:'cpu_component_passed_not_admitted',taskId:identity.taskId,qualificationGranted:false,sourceBindings:capture.componentSources,
   tests:{passed:true,testsRun:1,cudaInitialized:false,realModelCalls:0,realAutogradCalls:0,realOptimizerUpdates:0,syntheticOperations:'Synthetic identity fixtures only.'}};
  assert.equal(verifyTrainingFailureCaptureCpuEvidence(proof,capture),proof);
  proof.taskId=successor?'TRAINING-SAME-CALL-CAPTURE-023-CPU':'TRAINING-SAME-CALL-CAPTURE-024-CPU';
  assert.throws(()=>verifyTrainingFailureCaptureCpuEvidence(proof,capture));
 }
 assert.throws(()=>trainingCaptureIdentity('unknown_training_capture'));
});

test('v3 uses isolated selector, profile, core and CPU evidence while keeping all prior arithmetic',()=>{
 const p=trainingPolicy(3),prior=[trainingPolicy(),trainingPolicy(true)];
 inRegistry([...prior,p],()=>{
  const actual=registration.executionRoute(p.candidate);
  assert.equal(actual.candidateSelection,'d2o-p0t3-v1');
  assert.equal(actual.EXECUTION_PROFILE,'completion_decode2_rgb_output_training_capture_v3');
  for(const old of prior){
   const route=registration.executionRoute(old.candidate);
   for(const key of ['MODEL_CAPABILITY','ARCHITECTURE','NUMERIC_RULE'])assert.equal(actual[key],route[key]);
   assert.deepEqual({...TRAINING_CAPTURE_V3_CORE,capabilityVersion:old.candidate},trainingCaptureIdentity(old.candidate).core);
  }
  assert.equal(verifyExecutionPolicy(p,configuration(p)),p);
 });
 const identity=trainingCaptureIdentity(p.candidate);
 assert.equal(identity.evidencePath,'.runtime/ai-painter/controller-repair-reviews/canonical-initialization-repair-025-20261024/cpu-component-acceptance.json');
 assert.equal(identity.taskId,'TRAINING-SAME-CALL-CAPTURE-025-CPU');
 const capture=p.trainingFailureCapture;
 const proof={status:'cpu_component_passed_not_admitted',taskId:identity.taskId,qualificationGranted:false,sourceBindings:capture.componentSources,
  tests:{passed:true,testsRun:1,cudaInitialized:false,realModelCalls:0,realAutogradCalls:0,realOptimizerUpdates:0,syntheticOperations:'Synthetic v3 identity fixture only.'}};
 assert.equal(verifyTrainingFailureCaptureCpuEvidence(proof,capture),proof);
 for(const old of prior){
  for(const mutate of [p=>p.executionProfile=old.executionProfile,p=>p.trainingFailureCapture.capabilityVersion=old.candidate,
   p=>p.trainingFailureCapture.cpuEvidence=old.trainingFailureCapture.cpuEvidence,
   p=>{p.candidateSelection=old.candidateSelection;p.interfaceContract=structuredClone(old.interfaceContract);p.outputRoot=old.outputRoot;}]){
   const changed=trainingPolicy(3);mutate(changed);
   assert.throws(()=>{parseTrainingInterfacePolicy(changed);verifyTrainingFailureCapturePolicy(changed)});
  }
  assert.throws(()=>verifyTrainingFailureCaptureCpuEvidence({...proof,taskId:trainingCaptureIdentity(old.candidate).taskId},capture));
 }
 assert.throws(()=>trainingCaptureIdentity('stage4_mvp256_dry_decode2_rgb_output_training_capture_unknown'));
});

test('v3 canonical policy binds exact semantics and current source role while predecessors reject activation',()=>{
 const p=trainingPolicy(3),core=p.canonicalVerification;
 assert.deepEqual(CANONICAL_VERIFICATION_CORE,JSON.parse(fs.readFileSync(path.join(project,
  '.runtime/ai-painter/controller-repair-reviews/canonical-initialization-repair-025-20261024/canonical-verification-contract-core.json'))));
 assert.equal(verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:core.canonicalProgram}),core);
 inRegistry([p],()=>assert.ok(authorityBindings(p).some(b=>b.path===core.canonicalProgram.path&&b.sha256===core.canonicalProgram.sha256)));
 for(const mutate of [c=>c.maximumCacheEntries++,c=>c.maximumCacheBytes++,c=>c.cacheSuccessfulDigestsOnly=false,
  c=>c.revalidateSourceBytesEveryCall=false,c=>c.subprocessTimeoutSeconds=11,c=>c.maximumObservationBytes++,
  c=>c.terminalReserveBytes=0,c=>c.canonicalProgram.sha256='a'.repeat(64),c=>c.canonicalProgram.path='old/program.mjs',
  c=>c.activation='unscoped',c=>c.extra=true]){
  const changed=trainingPolicy(3);mutate(changed.canonicalVerification);assert.throws(()=>verifyCanonicalVerificationPolicy(changed));
 }
 assert.throws(()=>verifyCanonicalVerificationPolicy({...p,canonicalVerification:undefined}));
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{}));
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:{...core.canonicalProgram,sha256:'b'.repeat(64)}}));
 for(const old of [trainingPolicy(),trainingPolicy(true)]){
  assert.equal(verifyCanonicalVerificationPolicy(old),null);
  assert.throws(()=>verifyCanonicalVerificationPolicy({...old,canonicalVerification:core}));
 }
});
test('v4 uses isolated selector, profile, core and CPU evidence while keeping all prior arithmetic',()=>{
 const p=trainingPolicy(4),prior=[trainingPolicy(),trainingPolicy(true),trainingPolicy(3)];
 inRegistry([...prior,p],()=>{
  const actual=registration.executionRoute(p.candidate);
  assert.equal(actual.candidateSelection,'d2o-p0t4-v1');
  assert.equal(actual.EXECUTION_PROFILE,'completion_decode2_rgb_output_training_capture_v4');
  for(const old of prior){
   const route=registration.executionRoute(old.candidate);
   for(const key of ['MODEL_CAPABILITY','ARCHITECTURE','NUMERIC_RULE'])assert.equal(actual[key],route[key]);
   assert.deepEqual({...TRAINING_CAPTURE_V4_CORE,capabilityVersion:old.candidate},trainingCaptureIdentity(old.candidate).core);
  }
  assert.equal(verifyExecutionPolicy(p,configuration(p)),p);
 });
 const identity=trainingCaptureIdentity(p.candidate);
 assert.equal(identity.evidencePath,'.runtime/ai-painter/controller-repair-reviews/canonical-fixture-isolation-repair-026-20261024/cpu-component-acceptance.json');
 assert.equal(identity.taskId,'TRAINING-SAME-CALL-CAPTURE-026-CPU');
 const capture=p.trainingFailureCapture;
 const proof={status:'cpu_component_passed_not_admitted',taskId:identity.taskId,qualificationGranted:false,sourceBindings:capture.componentSources,
  tests:{passed:true,testsRun:1,cudaInitialized:false,realModelCalls:0,realAutogradCalls:0,realOptimizerUpdates:0,syntheticOperations:'Synthetic v4 identity fixture only.'}};
 assert.equal(verifyTrainingFailureCaptureCpuEvidence(proof,capture),proof);
 for(const old of prior){
  for(const mutate of [p=>p.executionProfile=old.executionProfile,p=>p.trainingFailureCapture.capabilityVersion=old.candidate,
   p=>p.trainingFailureCapture.cpuEvidence=old.trainingFailureCapture.cpuEvidence,
   p=>{p.candidateSelection=old.candidateSelection;p.interfaceContract=structuredClone(old.interfaceContract);p.outputRoot=old.outputRoot;}]){
   const changed=trainingPolicy(4);mutate(changed);
   assert.throws(()=>{parseTrainingInterfacePolicy(changed);verifyTrainingFailureCapturePolicy(changed)});
  }
  assert.throws(()=>verifyTrainingFailureCaptureCpuEvidence({...proof,taskId:trainingCaptureIdentity(old.candidate).taskId},capture));
 }
 assert.throws(()=>trainingCaptureIdentity('stage4_mvp256_dry_decode2_rgb_output_training_capture_unknown'));
});


test('v4 canonical activation is exact and cannot activate a v3 or legacy package',()=>{
 const p=trainingPolicy(4),core=p.canonicalVerification,old=trainingPolicy(3);
 assert.deepEqual(CANONICAL_VERIFICATION_V4_CORE,JSON.parse(fs.readFileSync(path.join(project,
  '.runtime/ai-painter/controller-repair-reviews/canonical-fixture-isolation-repair-026-20261024/canonical-verification-contract-core.json'))));
 assert.deepEqual({...core,activation:CANONICAL_VERIFICATION_CORE.activation},CANONICAL_VERIFICATION_CORE);
 assert.equal(verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:core.canonicalProgram}),core);
 inRegistry([p],()=>assert.ok(authorityBindings(p).some(b=>b.path===core.canonicalProgram.path&&b.sha256===core.canonicalProgram.sha256)));
 for(const changed of [{...p,canonicalVerification:old.canonicalVerification},{...old,canonicalVerification:core},
  {...trainingPolicy(),canonicalVerification:core},{...trainingPolicy(true),canonicalVerification:core},
  {...p,canonicalVerification:{...core,subprocessTimeoutSeconds:11}},{...p,canonicalVerification:{...core,maximumCacheEntries:65}}]){
  assert.throws(()=>verifyCanonicalVerificationPolicy(changed));
 }
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{}));
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:{...core.canonicalProgram,sha256:'b'.repeat(64)}}));
 for(const cap of [registration.TRAINING_CAPTURE_CAPABILITY,registration.TRAINING_CAPTURE_V2_CAPABILITY,'unknown'])assert.throws(()=>canonicalVerificationIdentity(cap));
});
test('v5 uses isolated selector, profile, core and CPU evidence while keeping all prior arithmetic',()=>{
 const p=trainingPolicy(5),prior=[trainingPolicy(),trainingPolicy(true),trainingPolicy(3),trainingPolicy(4)];
 inRegistry([...prior,p],()=>{
  const actual=registration.executionRoute(p.candidate);
  assert.equal(actual.candidateSelection,'d2o-p0t5-v1');
  assert.equal(actual.EXECUTION_PROFILE,'completion_decode2_rgb_output_training_capture_v5');
  for(const old of prior){
   const route=registration.executionRoute(old.candidate);
   for(const key of ['MODEL_CAPABILITY','ARCHITECTURE','NUMERIC_RULE'])assert.equal(actual[key],route[key]);
   assert.deepEqual({...TRAINING_CAPTURE_V5_CORE,capabilityVersion:old.candidate},trainingCaptureIdentity(old.candidate).core);
  }
  assert.equal(verifyExecutionPolicy(p,configuration(p)),p);
 });
 const identity=trainingCaptureIdentity(p.candidate);
 assert.equal(identity.evidencePath,'.runtime/ai-painter/controller-repair-reviews/backend-observation-compatibility-repair-027-20261024/cpu-component-acceptance.json');
 assert.equal(identity.taskId,'TRAINING-SAME-CALL-CAPTURE-027-CPU');
 const capture=p.trainingFailureCapture;
 const proof={status:'cpu_component_passed_not_admitted',taskId:identity.taskId,qualificationGranted:false,sourceBindings:capture.componentSources,
  tests:{passed:true,testsRun:1,cudaInitialized:false,realModelCalls:0,realAutogradCalls:0,realOptimizerUpdates:0,syntheticOperations:'Synthetic v5 identity fixture only.'}};
 assert.equal(verifyTrainingFailureCaptureCpuEvidence(proof,capture),proof);
 for(const old of prior){
  for(const mutate of [p=>p.executionProfile=old.executionProfile,p=>p.trainingFailureCapture.capabilityVersion=old.candidate,
   p=>p.trainingFailureCapture.cpuEvidence=old.trainingFailureCapture.cpuEvidence,
   p=>{p.candidateSelection=old.candidateSelection;p.interfaceContract=structuredClone(old.interfaceContract);p.outputRoot=old.outputRoot;}]){
   const changed=trainingPolicy(5);mutate(changed);
   assert.throws(()=>{parseTrainingInterfacePolicy(changed);verifyTrainingFailureCapturePolicy(changed)});
  }
  assert.throws(()=>verifyTrainingFailureCaptureCpuEvidence({...proof,taskId:trainingCaptureIdentity(old.candidate).taskId},capture));
 }
 assert.throws(()=>trainingCaptureIdentity('stage4_mvp256_dry_decode2_rgb_output_training_capture_unknown'));
});



test('v5 canonical activation rejects both prior canonical versions and preserves their exact objects',()=>{
 const p=trainingPolicy(5),core=p.canonicalVerification;
 assert.deepEqual(CANONICAL_VERIFICATION_V5_CORE,JSON.parse(fs.readFileSync(path.join(project,
  '.runtime/ai-painter/controller-repair-reviews/backend-observation-compatibility-repair-027-20261024/canonical-verification-contract-core.json'))));
 assert.deepEqual({...core,activation:CANONICAL_VERIFICATION_CORE.activation},CANONICAL_VERIFICATION_CORE);
 assert.equal(verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:core.canonicalProgram}),core);
 inRegistry([p],()=>assert.ok(authorityBindings(p).some(b=>b.path===core.canonicalProgram.path&&b.sha256===core.canonicalProgram.sha256)));
 for(const old of [trainingPolicy(3),trainingPolicy(4)]){
  assert.throws(()=>verifyCanonicalVerificationPolicy({...p,canonicalVerification:old.canonicalVerification}));
  assert.throws(()=>verifyCanonicalVerificationPolicy({...old,canonicalVerification:core}));
 }
 for(const old of [trainingPolicy(),trainingPolicy(true)])assert.throws(()=>verifyCanonicalVerificationPolicy({...old,canonicalVerification:core}));
 assert.throws(()=>verifyCanonicalVerificationPolicy({...p,canonicalVerification:{...core,subprocessTimeoutSeconds:11}}));
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{}));
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:{...core.canonicalProgram,sha256:'b'.repeat(64)}}));
});

test('v6 uses isolated selector, profile, core and CPU evidence while keeping all prior arithmetic',()=>{
 const p=trainingPolicy(6),prior=[trainingPolicy(),trainingPolicy(true),trainingPolicy(3),trainingPolicy(4),trainingPolicy(5)];
 inRegistry([...prior,p],()=>{
  const actual=registration.executionRoute(p.candidate);
  assert.equal(actual.candidateSelection,'d2o-p0t6-v1');
  assert.equal(actual.EXECUTION_PROFILE,'completion_decode2_rgb_output_training_capture_v6');
  for(const old of prior){
   const route=registration.executionRoute(old.candidate);
   for(const key of ['MODEL_CAPABILITY','ARCHITECTURE','NUMERIC_RULE'])assert.equal(actual[key],route[key]);
   for(const key of ['target','gradientLabels','additionalForwardCalls','additionalAutogradCalls','additionalOptimizerUpdates','maximumCaptureAndWorkspaceBytes','maximumAggregateSidecarBytes','executionMaximumBytes'])assert.deepEqual(TRAINING_CAPTURE_V6_CORE[key],trainingCaptureIdentity(old.candidate).core[key]);
  }
  assert.equal(verifyExecutionPolicy(p,configuration(p)),p);
 });
 const identity=trainingCaptureIdentity(p.candidate);
 assert.equal(identity.evidencePath,'.runtime/ai-painter/controller-repair-reviews/failure-call-adoption-031-20261025/cpu-component-acceptance.json');
 assert.equal(identity.taskId,'TRAINING-SAME-CALL-CAPTURE-031-CPU');
 const capture=p.trainingFailureCapture;
 const proof={status:'cpu_component_passed_not_admitted',taskId:identity.taskId,qualificationGranted:false,sourceBindings:capture.componentSources,
  tests:{passed:true,testsRun:1,cudaInitialized:false,realModelCalls:0,realAutogradCalls:0,realOptimizerUpdates:0,syntheticOperations:'Synthetic v6 identity fixture only.'}};
 assert.equal(verifyTrainingFailureCaptureCpuEvidence(proof,capture),proof);
 for(const old of prior){
  for(const mutate of [p=>p.executionProfile=old.executionProfile,p=>p.trainingFailureCapture.capabilityVersion=old.candidate,
   p=>p.trainingFailureCapture.cpuEvidence=old.trainingFailureCapture.cpuEvidence,
   p=>{p.candidateSelection=old.candidateSelection;p.interfaceContract=structuredClone(old.interfaceContract);p.outputRoot=old.outputRoot;}]){
   const changed=trainingPolicy(6);mutate(changed);
   assert.throws(()=>{parseTrainingInterfacePolicy(changed);verifyTrainingFailureCapturePolicy(changed)});
  }
  assert.throws(()=>verifyTrainingFailureCaptureCpuEvidence({...proof,taskId:trainingCaptureIdentity(old.candidate).taskId},capture));
 }
 assert.throws(()=>trainingCaptureIdentity('stage4_mvp256_dry_decode2_rgb_output_training_capture_unknown'));
});




test('v6 canonical activation rejects both prior canonical versions and preserves their exact objects',()=>{
 const p=trainingPolicy(6),core=p.canonicalVerification;
 assert.deepEqual(CANONICAL_VERIFICATION_V6_CORE,JSON.parse(fs.readFileSync(path.join(project,
  '.runtime/ai-painter/controller-repair-reviews/failure-call-adoption-031-20261025/canonical-verification-contract-core.json'))));
 assert.deepEqual({...core,activation:CANONICAL_VERIFICATION_CORE.activation},CANONICAL_VERIFICATION_CORE);
 assert.equal(verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:core.canonicalProgram}),core);
 inRegistry([p],()=>assert.ok(authorityBindings(p).some(b=>b.path===core.canonicalProgram.path&&b.sha256===core.canonicalProgram.sha256)));
 for(const old of [trainingPolicy(3),trainingPolicy(4),trainingPolicy(5)]){
  assert.throws(()=>verifyCanonicalVerificationPolicy({...p,canonicalVerification:old.canonicalVerification}));
  assert.throws(()=>verifyCanonicalVerificationPolicy({...old,canonicalVerification:core}));
 }
 for(const old of [trainingPolicy(),trainingPolicy(true)])assert.throws(()=>verifyCanonicalVerificationPolicy({...old,canonicalVerification:core}));
 assert.throws(()=>verifyCanonicalVerificationPolicy({...p,canonicalVerification:{...core,subprocessTimeoutSeconds:11}}));
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{}));
 assert.throws(()=>verifyCanonicalVerificationPolicy(p,{canonicalRegionProgram:{...core.canonicalProgram,sha256:'b'.repeat(64)}}));
});

test('v6 exact coverage core rejects fixed-call fields, expanded budget and missing release constraints',()=>{const p=trainingPolicy(6);assert.equal(p.trainingFailureCapture.maximumObservedGCalls,1152);assert.equal(p.trainingFailureCapture.maximumLiveObservationContexts,1);for(const [key,value]of [['maximumObservedGCalls',1153],['maximumLiveObservationContexts',2],['previousSuccessReleasedBeforeNextD',false],['successfulTensorHistoryRetained',true],['maximumAggregateSidecarBytes',2097153],['sampleId','foreign'],['epoch',1],['optimizerSteps',{generator:14,discriminator:15}]]){const changed=structuredClone(p);changed.trainingFailureCapture[key]=value;assert.throws(()=>verifyTrainingFailureCapturePolicy(changed),key)}});
