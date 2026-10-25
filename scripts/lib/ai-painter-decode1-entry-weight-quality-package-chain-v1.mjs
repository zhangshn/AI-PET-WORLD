// Candidate adapter over the existing evidence IO, package materializer and six-phase engine.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {localPreparationRoute} from './ai-painter-local-prepare-v1.mjs';
import {projectRoot,physicalRuntimeRoot} from './ai-pet-world-storage.mjs';
import * as io from './ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';
import {directoryBytes,withOutputBudget,write as writeAccounted} from './ai-painter-decode1-entry-weight-output-accounting-v1.mjs';
import {collectActualExecutionSources,requiredProgramRoles as queryProgramRoles} from './ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs';
import {CAPABILITY,MODEL_CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION,EXECUTION_POLICY,CANDIDATE,
 PROFILE,binding,deriveConfiguration,validate,validateModelIdentity,validateTerminal,validateCompleted,
 LOSS,GRADIENT,INTEGRATION_POLICY,JOINT_LEARNING_RULE,PROGRESS_PUBLICATION_POLICY,executionRoute,gpuAdmissionSeconds,sourceFileCountMaximum,sourceCandidateBinding}
 from './ai-painter-decode1-entry-weight-quality-registration-v1.mjs';
import {COMPLETION_CAPABILITY,QUALIFICATION_CAPTURE_CAPABILITY,TRAINING_CAPTURE_CAPABILITY,TRAINING_CAPTURE_V2_CAPABILITY,TRAINING_CAPTURE_V3_CAPABILITY,TRAINING_CAPTURE_V4_CAPABILITY,TRAINING_CAPTURE_V5_CAPABILITY,TRAINING_CAPTURE_V6_CAPABILITY,TRAINING_CAPTURE_CAPABILITIES} from './ai-painter-decode1-entry-weight-quality-registration-v1.mjs';
export {CAPABILITY,MODEL_CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION,EXECUTION_POLICY,CANDIDATE,deriveConfiguration,
 validateTerminal,validateCompleted,executionRoute,gpuAdmissionSeconds,sourceFileCountMaximum,sourceCandidateBinding};
export const ADAPTER='scripts/run-ai-painter-decode1-entry-weight-quality-v1.mjs';
export const ROLES=Object.freeze({
 adapter:ADAPTER,packageChain:'scripts/lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs',
 currentExecutionRegistry:'src/server/ai-painter-current-execution-registry.mjs',
 worker:'ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_quality_worker_v1.py',
 gpuQualifier:'ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py',
 executionAuth:'ml/ai-painter/scripts/decode1_entry_weight_quality_auth_v1.py',
 registration:'scripts/lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs',
 nativeRunner:'scripts/lib/ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs',
 nativeOwnerBuilder:'scripts/lib/ai-painter-decode1-entry-completion-native-owner-v1.mjs',
 nativeOwnerSource:'scripts/windows/ai-painter-owned-worker-owner-stream-completion-v1.cs',
 cpuHarness:'ml/ai-painter/tests/test_decode1_entry_weight_quality_adapters_cpu_v1.py',
 entryTests:'scripts/tests/ai-painter-decode1-entry-weight-quality-integration.test.mjs',
 capture:'ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py',
 loop:'ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_lifecycle_v1.py',
 trainingProfile:'ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py',
 managedCheckpoint:'ml/ai-painter/src/ai_painter/complete_world/decode1_entry_weight_quality_checkpoint_v1.py',
 ranking:'ml/ai-painter/scripts/ecology_quality_ranking_v1.py',
 reviewWorker:'ml/ai-painter/scripts/decode1_entry_weight_quality_review_v1.py',
 reviewDriver:'scripts/lib/ai-painter-decode1-entry-weight-quality-review-v1.mjs',
 executionPolicy:EXECUTION_POLICY.path,
 progressPublication:'ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v1.py'});
export const sha=io.sha;
export function rolesFor(capabilityVersion=CAPABILITY){const route=executionRoute(capabilityVersion);
 return route.completion?{...ROLES,executionPolicy:route.EXECUTION_POLICY.path,
  progressPublication:'ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py',
  nativeOwnerBuilder:'scripts/lib/ai-painter-decode1-entry-completion-native-owner-v1.mjs',
  nativeOwnerSource:'scripts/windows/ai-painter-owned-worker-owner-stream-completion-v1.cs'}:ROLES;}
export {withOutputBudget,directoryBytes};
const PHASES=['preflight','execute','validate','review','adjudicate','finalize'];
const scopes=new Map(),environment=process.env.AI_PET_WORLD_DATA_ROOT;
const id=s=>[String(s.dev),String(s.ino)].join(':');
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
function runtimePlain(filename){
 for(let current=filename;;current=path.dirname(current)){
  assert.equal(fs.lstatSync(current,{bigint:true}).isSymbolicLink(),false,'runtime path redirection refused');
  if(path.dirname(current)===current)break;
 }
}
function runtimeExecutableIdentity(filename){
 const original=path.resolve(filename);runtimePlain(original);
 const before=fs.lstatSync(original,{bigint:true});assert.ok(before.isFile(),'regular runtime executable required');
 const canonical=fs.realpathSync.native(original);runtimePlain(canonical);
 assert.equal(stamp(fs.lstatSync(canonical,{bigint:true})),stamp(before),'canonical runtime file identity differs');
 const fd=fs.openSync(canonical,'r'),hasher=crypto.createHash('sha256'),buffer=Buffer.alloc(1048576);
 const handleStamp=s=>[s.dev,s.ino,s.size,s.mtimeNs].map(String).join(':');let bytes=0;
 try{
  const handleBefore=fs.fstatSync(fd,{bigint:true});
  assert.equal(handleStamp(handleBefore),handleStamp(before),'runtime handle identity differs');
  for(;;){const count=fs.readSync(fd,buffer,0,buffer.length,null);if(count===0)break;bytes+=count;
   assert.ok(BigInt(bytes)<=before.size,'runtime executable grew during hash');hasher.update(buffer.subarray(0,count));}
  assert.equal(BigInt(bytes),before.size,'runtime executable size changed');
  assert.equal(stamp(fs.fstatSync(fd,{bigint:true})),stamp(handleBefore),'runtime handle changed during hash');
 }finally{fs.closeSync(fd);}
 runtimePlain(original);runtimePlain(canonical);
 assert.equal(stamp(fs.lstatSync(original,{bigint:true})),stamp(before),'original runtime executable changed');
 assert.equal(stamp(fs.lstatSync(canonical,{bigint:true})),stamp(before),'canonical runtime executable changed');
 return {absolutePath:canonical,sha256:hasher.digest('hex')};
}
export function runtimeIdentity(root){
 stable(root);
 return {python:runtimeExecutableIdentity(path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe')),
  node:runtimeExecutableIdentity(process.execPath)};
}
function stable(root){
 root=path.resolve(root);assert.equal(root,path.resolve(projectRoot),'configured project root required');
 assert.equal(process.env.AI_PET_WORLD_DATA_ROOT,environment,'storage configuration changed');
 const logical=path.join(root,'.runtime'),p=fs.lstatSync(root,{bigint:true}),link=fs.lstatSync(logical,{bigint:true});
 const target=fs.lstatSync(physicalRuntimeRoot,{bigint:true});
 assert.ok(p.isDirectory()&&!p.isSymbolicLink()&&target.isDirectory()&&!target.isSymbolicLink());
 assert.equal(fs.realpathSync(logical),fs.realpathSync(physicalRuntimeRoot),'formal runtime target differs');
 const current={project:id(p),projectPhysical:fs.realpathSync(root),link:id(link),redirected:link.isSymbolicLink(),
  linkTarget:link.isSymbolicLink()?fs.readlinkSync(logical):null,target:id(target),physical:fs.realpathSync(physicalRuntimeRoot)};
 if(scopes.has(root))assert.deepEqual(current,scopes.get(root),'project/logical/physical root identity changed');else scopes.set(root,current);
 return current;
}
export function inside(root,logical){
 binding({path:logical,sha256:'0'.repeat(64)});const scope=stable(root),parts=logical.split('/');
 let physical=scope.projectPhysical;
 if(parts[0]==='.runtime'){physical=scope.physical;parts.shift();}
 for(const part of parts){physical=path.join(physical,part);if(fs.existsSync(physical))assert.equal(fs.lstatSync(physical).isSymbolicLink(),false,'descendant redirect refused');}
 stable(root);return physical;
}
export function read(root,b){
 binding(b);const file=inside(root,b.path),before=fs.lstatSync(file,{bigint:true});
 assert.ok(before.isFile()&&!before.isSymbolicLink()&&before.size<=67108864n,'bounded regular input required');
 const fd=fs.openSync(file,'r');let data;
 try{assert.equal(stamp(fs.fstatSync(fd,{bigint:true})),stamp(before),'input identity changed');
  data=Buffer.alloc(Number(before.size));let n=0;while(n<data.length){const got=fs.readSync(fd,data,n,data.length-n,null);assert.ok(got>0);n+=got;}
  assert.equal(stamp(fs.fstatSync(fd,{bigint:true})),stamp(before),'input changed during read');
 }finally{fs.closeSync(fd);}
 assert.equal(stamp(fs.lstatSync(inside(root,b.path),{bigint:true})),stamp(before),'input replaced');assert.equal(sha(data),b.sha256,'input SHA differs');return data;
}
export function json(root,b){const raw=read(root,b);assert.ok(raw.length<=2097152);return JSON.parse(raw.toString('utf8'));}
export function bind(root,logical){const data=fs.readFileSync(inside(root,logical)),b={path:logical,sha256:sha(data)};read(root,b);return b;}
export function write(root,logical,value){
 inside(root,logical);const result=writeAccounted(root,logical,value);read(root,result);return result;
}

export function requiredProgramRoles(root,capabilityVersion=CAPABILITY){
 executionRoute(capabilityVersion);
 const result=queryProgramRoles({root,python:runtimeIdentity(root).python.absolutePath,capabilityVersion,authPath:ROLES.executionAuth});
 for(const [role,p]of Object.entries(rolesFor(capabilityVersion)))assert.equal(result[role],p,'Python/Node actual role mismatch: '+role);
 return result;
}
export function verifyProgramBindingAliases(programs,{capabilityVersion=CAPABILITY}={}){
 executionRoute(capabilityVersion);assert.ok(programs&&typeof programs==='object'&&!Array.isArray(programs));
 assert.ok(Object.keys(programs).length>=1&&Object.keys(programs).length<=256,'source role ceiling');
 const paths=new Set();for(const [role,b]of Object.entries(programs)){
  assert.match(role,/^[A-Za-z0-9._-]{1,80}$/u);assert.ok(!['__proto__','constructor','prototype'].includes(role));binding(b);
  assert.ok(!paths.has(b.path),'one exact binding per source path required');paths.add(b.path);
 }return {roles:Object.keys(programs).length,uniquePaths:paths.size};
}
export function finalProgramBindings(root,{capabilityVersion=CAPABILITY}={}){
 const profile=executionRoute(capabilityVersion),required=requiredProgramRoles(root,capabilityVersion),route=localPreparationRoute(profile.candidateSelection);
 assert.equal(route.capability,profile.CAPABILITY);assert.equal(route.adapter,ADAPTER);
 const extras={
  localOperatorDeploymentManifest:'node_modules/@next/env/package.json',localOperatorDeploymentLoader:'node_modules/@next/env/dist/index.js',
  localControl:'scripts/run-ai-painter-local-control-v1.mjs',localPrepareEntry:'scripts/run-ai-painter-local-control-v2.mjs',
  localPrepare:'scripts/lib/ai-painter-local-prepare-v1.mjs',stopNativeControl:'scripts/lib/ai-painter-owned-stop-native-control-v1.mjs',
  stopRequest:'scripts/lib/ai-painter-owned-stop-request-v1.mjs',stopExecutionBridge:'scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs',
  stopHandoff:'scripts/lib/ai-painter-owned-stop-handoff-v1.mjs',operatorSession:'src/server/ai-console-control/operator-session.ts',
  backgroundLauncher:'scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',storageMapping:'scripts/lib/ai-pet-world-storage.mjs',
  exactlyOnceSpawn:'scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs',
  registeredEntrypoints:'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json',
  consoleTrainingPresentation:'src/server/ai-console/bound-training-presentation.mjs',
  consoleTrainingHistoryAdapters:'src/server/ai-console/training-history-detail-adapters.mjs',
  previewComponent:'ml/ai-painter/src/ai_painter/complete_world/training_preview_observer_v2.py',
  previewTests:'ml/ai-painter/tests/test_training_preview_observer_cpu_v2.py',
  previewStorage:'ml/ai-painter/src/ai_painter/complete_world/training_preview_storage_v2.py',
  previewStorageTests:'ml/ai-painter/tests/test_training_preview_storage_cpu_v2.py',previewPolicy:profile.previewPath,
  progressPublicationPolicy:(profile.progressPolicy??PROGRESS_PUBLICATION_POLICY).path,
  sourceCollector:'scripts/lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs'};
 const paths=new Set(Object.values(required));for(const [role,p]of Object.entries(extras))if(!paths.has(p)){required[role]=p;paths.add(p);}
 const result=collectActualExecutionSources({root,required,capabilityVersion,dynamicPaths:[ADAPTER,'scripts/lib/'+route.chain.slice(2),'scripts/lib/'+route.native.slice(2)],
  python:runtimeIdentity(root).python.absolutePath,bind:p=>bind(root,p)});
 verifyProgramBindingAliases(result,{capabilityVersion});return result;
}
export function authorityBindings(policy){
 const route=executionRoute(policy.candidate),{SPECIFICATION,EXECUTION_POLICY}=route,progress=route.progressPolicy??PROGRESS_PUBLICATION_POLICY;
 const refs=[SPECIFICATION,EXECUTION_POLICY,sourceCandidateBinding(policy.candidate),LOSS,GRADIENT,INTEGRATION_POLICY,JOINT_LEARNING_RULE,progress,
  route.completion?policy.priorProgressPublicationCpuEvidence:policy.progressPublicationCpuEvidence,policy.previousExecutionPolicy,policy.modelBoundary.jointCpuRule,...policy.modelBoundary.frozenCpuSources,
  policy.priorCpuEvidence.request,policy.qualificationOnlyPredecessor.policy,policy.qualificationOnlyPredecessor.normativeBytes,
  policy.resourceFailureRecord.componentEvidence];
 if(['stage4_mvp256_dry_decode2_support_structure_weight1_v1','stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1',QUALIFICATION_CAPTURE_CAPABILITY,...TRAINING_CAPTURE_CAPABILITIES].includes(policy.candidate))refs.push(policy.numericRepairCpuEvidence);
 const qualificationCapture=verifyQualificationFailureCapturePolicy(policy);
 if(qualificationCapture)refs.push(...qualificationCapture.componentSources,qualificationCapture.cpuEvidence);
 const trainingCapture=verifyTrainingFailureCapturePolicy(policy);
 if(trainingCapture)refs.push(...trainingCapture.componentSources,trainingCapture.cpuEvidence);
 const canonicalVerification=verifyCanonicalVerificationPolicy(policy);
 if(canonicalVerification)refs.push(canonicalVerification.canonicalProgram);
 for(const key of ['priorCpuEvidence','jointRuleCpuEvidence'])for(const name of ['acceptance','terminal','policy','originalNormativeBytes'])refs.push(policy[key][name]);
 if(route.sameCallCapture&&!TRAINING_CAPTURE_CAPABILITIES.includes(policy.candidate)){
  const same=policy.sameCallCapture;
  assert.equal(same.parameterIndex,90);assert.equal(same.maximumSidecarBytes,2097152);
  refs.push(same.cpuSupport.acceptance,same.cpuSupport.report,...same.componentSources);
 }
 return refs.map(({path,sha256})=>({path,sha256}));
}
const QUALIFICATION_CAPTURE_CORE={
 schemaVersion:'qualification-parameter0-sequence-capture-v1',capabilityVersion:QUALIFICATION_CAPTURE_CAPABILITY,
 phase:'qualification',sampleId:'ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2',sampleOrdinal:17,split:'train',
 target:{index:0,name:'core.core.terrain.base_stem.layers.0.weight',shape:[48,31,3,3],spatial:[192,256]},
 sequenceSamples:48,sameGeneratorAndDiscriminatorInstances:true,originalOrderAndSeedKept:true,
 originalGateAndToleranceKept:true,originalFailureFirst:true,additionalForwardCalls:0,additionalAutogradCalls:0,
 additionalOptimizerUpdates:0,maximumCaptureAndWorkspaceBytes:67108864,maximumAggregateSidecarBytes:2097152,
 terminalReserveBytes:65536,rawTargetGradientSets:5,finiteReferenceCoordinates:1,nonfiniteSumReferenceCalls:0,
 otherSampleCaptureAllowed:false,qualificationGranted:false,activation:'authenticated_new_package_only',
 failureAction:'preserve_primary_and_close_no_retry',
 completeSequenceAction:'original_same_package_training_only_after_all48_and_state_checks'};
const QUALIFICATION_CAPTURE_SOURCES=[
 'ml/ai-painter/scripts/qualification_parameter0_capture_v1.py',
 'ml/ai-painter/scripts/qualification_gradient_gate_authentication_cpu_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_observation_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_reference_v1.py'];
export function verifyQualificationFailureCapturePolicy(policy){
 if(policy.candidate!==QUALIFICATION_CAPTURE_CAPABILITY){
  assert.equal(Object.hasOwn(policy,'qualificationFailureCapture'),false,'legacy policy cannot activate qualification failure capture');return null;
 }
 const capture=policy.qualificationFailureCapture;
 assert.ok(capture&&typeof capture==='object'&&!Array.isArray(capture),'qualification capture contract required');
 const {componentSources,cpuEvidence,...core}=capture;
 assert.deepEqual(core,QUALIFICATION_CAPTURE_CORE,'exact qualification capture contract required');
 assert.ok(Array.isArray(componentSources));assert.deepEqual(componentSources.map(b=>binding(b).path),QUALIFICATION_CAPTURE_SOURCES);
 binding(cpuEvidence);assert.equal(cpuEvidence.path,'.runtime/ai-painter/controller-repair-reviews/qualification-sequence-capture-019-20261024/controller-integration-review.json');
 return capture;
}
export function verifyQualificationFailureCaptureCpuEvidence(proof,capture){
 assert.equal(proof.status,'cpu_component_passed_not_admitted');
 assert.equal(proof.taskId,'QUALIFICATION-SEQUENCE-CAPTURE-019-CPU');assert.equal(proof.qualificationGranted,false);
 assert.deepEqual(proof.sourceBindings,capture.componentSources,'capture CPU evidence must bind the actual four source bytes');
 assert.equal(proof.tests.passed,true);assert.ok(Number.isSafeInteger(proof.tests.testsRun)&&proof.tests.testsRun>0);
 assert.equal(proof.tests.cudaInitialized,false);
 for(const key of ['modelCalls','autogradCalls','optimizerUpdates'])assert.equal(proof.tests[key],0);
 return proof;
}
export const TRAINING_CAPTURE_CORE={"schemaVersion":"parameter0-training-same-call-capture-v1","capabilityVersion":"stage4_mvp256_dry_decode2_rgb_output_training_capture_v1","phase":"training","activation":"authenticated_new_package_exact_g_call_only","sampleId":"ai-cold-start-v7-v7-capacity-slot-154-tropical-forest-glade-v2","split":"train","epoch":1,"zeroBasedEpochPosition":14,"trainIndex":8,"optimizerSteps":{"generator":14,"discriminator":15},"maximumObservedGCalls":1,"target":{"index":0,"name":"core.core.terrain.base_stem.layers.0.weight","shape":[48,31,3,3],"spatial":[192,256],"coordinate":[1,13,0,0],"inputChannel":13,"outputChannel":1,"operator":"torch.nn.Conv2d","stride":[1,1],"padding":[1,1],"dilation":[1,1],"groups":1,"paddingMode":"zeros"},"gradientLabels":["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"],"sameGeneratorAndDiscriminatorInstances":true,"originalGateAndToleranceKept":true,"originalFailureFirst":true,"rawTargetGradientSets":5,"weightWitness":true,"additionalForwardCalls":0,"additionalAutogradCalls":0,"additionalOptimizerUpdates":0,"localReferenceCalls":0,"maximumCaptureAndWorkspaceBytes":67108864,"maximumAggregateSidecarBytes":2097152,"terminalReserveBytes":65536,"aggregateIncludesStagingAndManifests":true,"originalFailureMaximumBytes":67108864,"executionMaximumBytes":134217728,"nonTargetSampleCaptureAllowed":false,"otherParameterFailureDoesNotCreatePacket":true,"fixedCoordinateNotViolatingAction":"retain_authenticated_target0_fixed_projection_mark_not_violating_no_reference","nonfiniteAction":"preserve_original_failure_and_classify_capture_availability_no_reference","successAction":"release_all_hooks_and_graph_references_before_original_generator_commit","failureAction":"preserve_primary_and_close_no_retry","qualificationGranted":false};
export const TRAINING_CAPTURE_V2_CORE={...structuredClone(TRAINING_CAPTURE_CORE),capabilityVersion:TRAINING_CAPTURE_V2_CAPABILITY};
export const TRAINING_CAPTURE_V3_CORE={...structuredClone(TRAINING_CAPTURE_CORE),capabilityVersion:TRAINING_CAPTURE_V3_CAPABILITY};
export const TRAINING_CAPTURE_V4_CORE={...structuredClone(TRAINING_CAPTURE_CORE),capabilityVersion:TRAINING_CAPTURE_V4_CAPABILITY};
export const TRAINING_CAPTURE_V5_CORE={...structuredClone(TRAINING_CAPTURE_CORE),capabilityVersion:TRAINING_CAPTURE_V5_CAPABILITY};
export const TRAINING_CAPTURE_V6_CORE={"schemaVersion":"parameter0-training-call-coverage-v1","capabilityVersion":"stage4_mvp256_dry_decode2_rgb_output_training_capture_v6","phase":"training","activation":"authenticated_new_package_sequential_g_calls_only","split":"train","maximumObservedGCalls":1152,"target":{"index":0,"name":"core.core.terrain.base_stem.layers.0.weight","shape":[48,31,3,3],"spatial":[192,256],"coordinate":[1,13,0,0],"inputChannel":13,"outputChannel":1,"operator":"torch.nn.Conv2d","stride":[1,1],"padding":[1,1],"dilation":[1,1],"groups":1,"paddingMode":"zeros"},"gradientLabels":["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"],"sameGeneratorAndDiscriminatorInstances":true,"originalGateAndToleranceKept":true,"originalFailureFirst":true,"rawTargetGradientSets":5,"weightWitness":true,"additionalForwardCalls":0,"additionalAutogradCalls":0,"additionalOptimizerUpdates":0,"localReferenceCalls":0,"maximumCaptureAndWorkspaceBytes":67108864,"maximumAggregateSidecarBytes":2097152,"terminalReserveBytes":65536,"aggregateIncludesStagingAndManifests":true,"originalFailureMaximumBytes":67108864,"executionMaximumBytes":134217728,"nonTargetSampleCaptureAllowed":true,"otherParameterFailureDoesNotCreatePacket":true,"fixedCoordinateNotViolatingAction":"retain_authenticated_target0_fixed_projection_mark_not_violating_no_reference","nonfiniteAction":"preserve_original_failure_and_classify_capture_availability_no_reference","successAction":"release_all_hooks_graph_references_and_current_copies_before_original_generator_commit","failureAction":"preserve_primary_and_close_coverage_instance_no_retry","qualificationGranted":false,"sampleScope":"all48_bound_train_samples_in_original_epoch_schedule","epochCount":24,"firstGeneratorCount":0,"lastGeneratorCount":1151,"maximumLiveObservationContexts":1,"sequenceRule":"pre_D_G_equals_D_equals_observed_calls_then_pre_G_D_equals_G_plus_one","previousSuccessReleasedBeforeNextD":true,"concurrentPairAllowed":false,"successfulTensorHistoryRetained":false,"storageIdentityRule":"recompute_epoch_position_train_index_from_seed_and_actual_G_D_counts"};
export function trainingCaptureIdentity(capability){
 assert.ok(TRAINING_CAPTURE_CAPABILITIES.includes(capability),'unknown training capture identity');
 const identities={
  [TRAINING_CAPTURE_CAPABILITY]:{core:TRAINING_CAPTURE_CORE,evidencePath:'.runtime/ai-painter/controller-repair-reviews/parameter0-training-same-call-023-20261024/cpu-component-acceptance.json',taskId:'TRAINING-SAME-CALL-CAPTURE-023-CPU'},
  [TRAINING_CAPTURE_V2_CAPABILITY]:{core:TRAINING_CAPTURE_V2_CORE,evidencePath:'.runtime/ai-painter/controller-repair-reviews/registry-publication-repair-024-20261024/cpu-component-acceptance.json',taskId:'TRAINING-SAME-CALL-CAPTURE-024-CPU'},
  [TRAINING_CAPTURE_V3_CAPABILITY]:{core:TRAINING_CAPTURE_V3_CORE,evidencePath:'.runtime/ai-painter/controller-repair-reviews/canonical-initialization-repair-025-20261024/cpu-component-acceptance.json',taskId:'TRAINING-SAME-CALL-CAPTURE-025-CPU'},
  [TRAINING_CAPTURE_V4_CAPABILITY]:{core:TRAINING_CAPTURE_V4_CORE,evidencePath:'.runtime/ai-painter/controller-repair-reviews/canonical-fixture-isolation-repair-026-20261024/cpu-component-acceptance.json',taskId:'TRAINING-SAME-CALL-CAPTURE-026-CPU'},
  [TRAINING_CAPTURE_V5_CAPABILITY]:{core:TRAINING_CAPTURE_V5_CORE,evidencePath:'.runtime/ai-painter/controller-repair-reviews/backend-observation-compatibility-repair-027-20261024/cpu-component-acceptance.json',taskId:'TRAINING-SAME-CALL-CAPTURE-027-CPU'},
  [TRAINING_CAPTURE_V6_CAPABILITY]:{core:TRAINING_CAPTURE_V6_CORE,evidencePath:'.runtime/ai-painter/controller-repair-reviews/failure-call-adoption-031-20261025/cpu-component-acceptance.json',taskId:'TRAINING-SAME-CALL-CAPTURE-031-CPU'}};
 assert.ok(Object.hasOwn(identities,capability),'unmapped training capture identity');return identities[capability];
}
export const TRAINING_CAPTURE_SOURCES=Object.freeze([
 'ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_capture_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_storage_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_bridge_v1.py',
 'ml/ai-painter/scripts/painter_stage4_decode2_rgb_output_training_same_call_profile_v1.py']);
export function verifyTrainingFailureCapturePolicy(policy){
 if(!TRAINING_CAPTURE_CAPABILITIES.includes(policy.candidate)){
  assert.equal(Object.hasOwn(policy,'trainingFailureCapture'),false,'legacy policy cannot activate training capture');return null;
 }
 assert.equal(Object.hasOwn(policy,'sameCallCapture'),false,'training capture cannot activate legacy parameter90 contract');
 assert.equal(Object.hasOwn(policy,'qualificationFailureCapture'),false,'training capture cannot activate qualification observer');
 const capture=policy.trainingFailureCapture;
 assert.ok(capture&&typeof capture==='object'&&!Array.isArray(capture),'training capture contract required');
 const {componentSources,cpuEvidence,...core}=capture;
 assert.deepEqual(core,trainingCaptureIdentity(policy.candidate).core,'exact training capture contract required');
 assert.ok(Array.isArray(componentSources));assert.deepEqual(componentSources.map(b=>binding(b).path),TRAINING_CAPTURE_SOURCES);
 binding(cpuEvidence);assert.equal(cpuEvidence.path,trainingCaptureIdentity(policy.candidate).evidencePath);
 return capture;
}
export function verifyTrainingFailureCaptureCpuEvidence(proof,capture){
 assert.equal(proof.status,'cpu_component_passed_not_admitted');
 assert.equal(proof.taskId,trainingCaptureIdentity(capture.capabilityVersion).taskId);assert.equal(proof.qualificationGranted,false);
 assert.deepEqual(proof.sourceBindings,capture.componentSources,'training capture CPU evidence must bind actual four source bytes');
 assert.equal(proof.tests.passed,true);assert.ok(Number.isSafeInteger(proof.tests.testsRun)&&proof.tests.testsRun>0);
 assert.equal(proof.tests.cudaInitialized,false);
 for(const key of ['realModelCalls','realAutogradCalls','realOptimizerUpdates'])assert.equal(proof.tests[key],0);
 assert.ok(typeof proof.tests.syntheticOperations==='string'&&proof.tests.syntheticOperations.length>0&&proof.tests.syntheticOperations.length<=4096);
 return proof;
}
export const CANONICAL_VERIFICATION_CORE=Object.freeze({
 schemaVersion:'canonical-region-verification-v1',activation:'authenticated_live_v3_reader_run_package_only',
 cacheScope:'reader_process_run_package',maximumCacheEntries:64,maximumCacheBytes:65536,cacheSuccessfulDigestsOnly:true,
 revalidateSourceBytesEveryCall:true,canonicalProgram:Object.freeze({path:'scripts/lib/real-earth-region-governance.mjs',
 sha256:'c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1'}),nodeIdentity:'verified_runtimeIdentity_node',
 subprocessTimeoutSeconds:10,observationFile:'canonical-initialization-observation.json',maximumObservationBytes:32768,terminalReserveBytes:65536});
export const CANONICAL_VERIFICATION_V4_CORE=Object.freeze({...CANONICAL_VERIFICATION_CORE,activation:'authenticated_live_v4_reader_run_package_only'});
export const CANONICAL_VERIFICATION_V5_CORE=Object.freeze({...CANONICAL_VERIFICATION_CORE,activation:'authenticated_live_v5_reader_run_package_only'});
export const CANONICAL_VERIFICATION_V6_CORE=Object.freeze({...CANONICAL_VERIFICATION_CORE,activation:'authenticated_live_v6_reader_run_package_only'});
export const CANONICAL_CAPABILITIES=Object.freeze([TRAINING_CAPTURE_V3_CAPABILITY,TRAINING_CAPTURE_V4_CAPABILITY,TRAINING_CAPTURE_V5_CAPABILITY,TRAINING_CAPTURE_V6_CAPABILITY]);
export function canonicalVerificationIdentity(capability){
 const identities={[TRAINING_CAPTURE_V3_CAPABILITY]:CANONICAL_VERIFICATION_CORE,[TRAINING_CAPTURE_V4_CAPABILITY]:CANONICAL_VERIFICATION_V4_CORE,[TRAINING_CAPTURE_V5_CAPABILITY]:CANONICAL_VERIFICATION_V5_CORE,[TRAINING_CAPTURE_V6_CAPABILITY]:CANONICAL_VERIFICATION_V6_CORE};
 assert.ok(Object.hasOwn(identities,capability),'unknown canonical verification identity');return identities[capability];
}
export function verifyCanonicalVerificationPolicy(policy,programs=null){
 if(!CANONICAL_CAPABILITIES.includes(policy.candidate)){
  assert.equal(Object.hasOwn(policy,'canonicalVerification'),false,'canonical verification is restricted to registered versions');return null;
 }
 assert.deepEqual(policy.canonicalVerification,canonicalVerificationIdentity(policy.candidate),'exact canonical verification contract required');
 if(programs!==null)assert.deepEqual(programs.canonicalRegionProgram,policy.canonicalVerification.canonicalProgram,
  'canonical program role differs from authenticated policy');
 return policy.canonicalVerification;
}
export function verifyExecutionPolicy(policy,configuration){
 verifyCanonicalVerificationPolicy(policy);
 const route=executionRoute(configuration.capabilityVersion),{CAPABILITY,MODEL_CAPABILITY,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION}=route;
 const progress=route.progressPolicy??PROGRESS_PUBLICATION_POLICY,roles=rolesFor(route.CAPABILITY);
 const canonical=value=>Array.isArray(value)?value.map(canonical):value!==null&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 assert.equal(sha(JSON.stringify(canonical(policy)).replace(/[\u007f-\uffff]/gu,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'))),
  route.interfaceContract?route.interfacePolicyCanonicalSha256:route.sameCallCapture?'16c00d3fb974136aa14873c31c75bd1f8d743add69b805766434320c2fbea57b':route.qualificationCompletion?'a67aabb4127b2f607286084fbe337c7dbc4d4d2364fe6201c9efe9fbfdca5aac':route.completion?'1dddf9bba4d2c180e2d1ea2bf534fd516ebec70a088776c939cbef9ee5ed6930':'65f539ec17f1165f9f544cfd755d46b18e491755c51e762fe914d02f395cd50d','exact execution policy values differ');
 assert.equal(policy.schemaVersion,route.interfaceContract?'ai-painter-registered-training-execution-policy-v1':route.sameCallCapture?'ai-painter-decode1-entry-weight-quality-execution-policy-v4':route.qualificationCompletion?'ai-painter-decode1-entry-weight-quality-execution-policy-v3':route.completion?'ai-painter-decode1-entry-weight-quality-execution-policy-v2':'ai-painter-decode1-entry-weight-quality-execution-policy-v1');
 assert.equal(policy.status,'registered_bounded_candidate_route_not_qualified');
 assert.equal(policy.candidate,CAPABILITY);assert.equal(policy.modelCapability,MODEL_CAPABILITY);
 assert.equal(policy.executionProfile,EXECUTION_PROFILE);assert.equal(policy.outputRoot,OUTPUT_ROOT);assert.equal(policy.entrypointPath,ADAPTER);
 assert.equal(policy.candidateSelection,route.candidateSelection);
 verifyQualificationFailureCapturePolicy(policy);
 verifyTrainingFailureCapturePolicy(policy);
 if(['stage4_mvp256_dry_decode1_support_structure_weight1_v1','stage4_mvp256_dry_decode2_support_structure_weight1_v1','stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1',QUALIFICATION_CAPTURE_CAPABILITY,...TRAINING_CAPTURE_CAPABILITIES].includes(configuration.capabilityVersion)){
  assert.equal(policy.objectSupportStructureWeight,1);assert.equal(configuration.objectSupportStructureWeight,1);
 }else{
  assert.equal(Object.hasOwn(policy,'objectSupportStructureWeight'),false,'legacy policy cannot activate support weight1');
  assert.equal(Object.hasOwn(configuration,'objectSupportStructureWeight'),false,'legacy configuration cannot activate support weight1');
 }
 assert.deepEqual(policy.formalSpecification,{...SPECIFICATION,version:route.interfaceContract?route.interfacePolicy.formalSpecification.version:route.sameCallCapture?'AI-PAINTER-SPEC-1.105':route.qualificationCompletion?'AI-PAINTER-SPEC-1.99':route.completion?'AI-PAINTER-SPEC-1.98':'AI-PAINTER-SPEC-1.96'});
 for(const key of ['executionCeiling','dataUse','optimizer'])assert.deepEqual(policy[key],configuration[key]);
 assert.equal(configuration.gpuAdmissionSeconds,gpuAdmissionSeconds(route.CAPABILITY));
 if(route.qualificationCompletion)assert.equal(configuration.gpuAdmissionWallMode,'completion');
 else assert.equal(Object.hasOwn(configuration,'gpuAdmissionWallMode'),false,'finite admission cannot inherit completion mode');
 assert.deepEqual(policy.sourceCandidate,sourceCandidateBinding(configuration.capabilityVersion));
 assert.deepEqual(policy.phaseResources,{cpuPreparationSeconds:240,gpuAdmissionSeconds:gpuAdmissionSeconds(route.CAPABILITY),reviewSeconds:120,maxStreamBytes:8388608,
  cpuOutputBytes:8388608,qualificationAndReviewOutputBytes:16777216,captureMiB:64,captureMetadataReserveBytes:1048576,terminalReserveBytes:65536,
  programFileCountMaximum:256,programFileBytesMaximum:1048576,totalProgramBytesMaximum:16777216,
  ...(route.completion?{trainingStartupSeconds:8400,nativeCleanupMilliseconds:1000}:{}),
  ...(route.qualificationCompletion?{gpuAdmissionWallMode:'completion',gpuAdmissionStartupSeconds:720}:{})});
 assert.equal(policy.sourceClosure.maximumEntries,256);assert.equal(policy.sourceClosure.maximumFileBytes,1048576);
 assert.equal(policy.sourceClosure.maximumTotalBytes,16777216);assert.equal(policy.sourceClosure.oneExactBindingPerPath,true);
 assert.equal(policy.sourceClosure.missingLoadedModuleFailsClosed,true);assert.equal(policy.sourceClosure.historicalReferencesGrantExecution,false);
 assert.deepEqual(policy.gpuAdmission,{sampleSplit:'train',sampleCount:48,optimizerConstruction:0,optimizerUpdates:0,samePackageRequired:true,
  stateBytesMustRemainUnchanged:true,originalGradientGateKept:true,oldCandidateQualificationReusable:false,generatorForwardsPerSample:1,
  generatorAutogradPerSample:5,discriminatorAutogradPerSample:1,totalGeneratorAutograd:240,totalDiscriminatorAutograd:48,
  ...(route.qualificationCompletion?{wallMode:'completion',totalWallSeconds:null,startupSeconds:720}:{})});
 for(const [key,want]of Object.entries({lossDefinition:LOSS,gradientDefinition:GRADIENT,integrationPolicy:INTEGRATION_POLICY,jointLearningRule:JOINT_LEARNING_RULE})){
  assert.deepEqual(policy[key],want);assert.deepEqual(configuration[key],want);}
 assert.deepEqual(policy.componentPaths,{deviceBridge:'ml/ai-painter/src/ai_painter/complete_world/object_decode1_entry_joint_priority_device_v1.py',
  trainingProfile:ROLES.trainingProfile,checkpoint:ROLES.managedCheckpoint});
 assert.deepEqual(policy.checkpointIdentity,{schema:'decode1-entry-weight-quality-checkpoint-v1',configurationSchema:'object-support-structure-quality-configuration-v1',
  implementation:ROLES.managedCheckpoint,historicalMetadataRenamingAllowed:false});
 const rgbOutput=['stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1',QUALIFICATION_CAPTURE_CAPABILITY,...TRAINING_CAPTURE_CAPABILITIES].includes(configuration.capabilityVersion);
 const decode2=rgbOutput||configuration.capabilityVersion==='stage4_mvp256_dry_decode2_support_structure_weight1_v1';
 const m=policy.modelBoundary;for(const [key,want]of Object.entries({parameterCount:108,parameterElements:2242687,changedTargetIndex:rgbOutput?90:decode2?40:48,
  changedTargetName:rgbOutput?'core.core.final_rgb_decoder.base.layers.4.weight':decode2?'core.core.terrain.decode_2.layers.0.weight':'core.core.terrain.decode_1.layers.0.weight',initializationSeed:20260929,freshInitializationOnly:true,
  historicalCheckpointMayInitialize:false,failedStateMayInitialize:false,otherLayersMayChange:false,relativeToAcceptedCpuCandidateNoModelOrNumericChanges:!decode2,
  parentTargets52And60Kept:true,parentFinalRgb88Kept:true,nativeForwardAndInputBiasGradientsKept:true,modelArchitectureChanged:false,numericOperatorsChanged:decode2}))
  assert.equal(m[key],want);
 assert.deepEqual(m.targetShape,rgbOutput?[3,48,1,1]:decode2?[96,192,3,3]:[48,144,3,3]);
 if(decode2){
  assert.equal(m.parentDecode1Entry48Kept,true);assert.equal(m.frozenCpuSources.length,rgbOutput?4:3);
  if(rgbOutput)assert.equal(m.parentDecode2Entry40Kept,true);
  assert.deepEqual(m.frozenCpuSources.map(b=>b.path),[
   'ml/ai-painter/src/ai_painter/complete_world/decode1_entry_weight_reduction_precision_v1.py',
   'ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_entry_weight_precision_v1.py',
   'ml/ai-painter/src/ai_painter/complete_world/object_decode1_entry_joint_priority_device_v1.py',
   ...(rgbOutput?['ml/ai-painter/src/ai_painter/complete_world/final_rgb_base_weight_reduction_precision_v1.py']:[])]);
  m.frozenCpuSources.forEach(binding);binding(policy.numericRepairCpuEvidence);
 }else assert.deepEqual(m.frozenCpuSources,[
 {path:'ml/ai-painter/src/ai_painter/complete_world/decode1_entry_weight_reduction_precision_v1.py',sha256:'2ee9e87343509c298f9cdd44fbbd004bf66690c64cf9edd68a636a2b673e51a6'},
 {path:'ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_entry_weight_precision_v1.py',sha256:'4913645e95b731ea5e51512a726cd2fd777938639122e853289de15308a44083'},
 {path:'ml/ai-painter/src/ai_painter/complete_world/object_decode1_entry_joint_priority_device_v1.py',sha256:'8fd5c2c8a47446cd07c2a6da0f0c503a916b92fd15d97a253770f5a547b23066'}]);
 assert.deepEqual(m.jointCpuRule,{path:'ml/ai-painter/src/ai_painter/complete_world/object_joint_rgb_structure_priority_update_cpu_v1.py',
  sha256:'99c437fe1cdf31229257c25716736e3c2f580a58f99fde8297c5e06611920324'});
 assert.deepEqual(policy.progressPublication,{componentPolicy:progress,componentPath:roles.progressPublication,
  freshnessSeconds:120,maximumPendingFiles:1,originalDeadlineRequired:!route.completion,
  ...(route.completion?{trainingDeadlineMode:'explicit_null_only_for_authenticated_completion_training',operationMaximumSeconds:.25,finiteLegacyDeadlineUnchanged:true,
   operationMaximumScope:'Existing atomic replacement, not the whole publish including output accounting/identity/fsync'}:{})});
 assert.deepEqual(configuration.progressPublicationPolicy,progress);
 assert.deepEqual(policy.scope,Object.fromEntries(Object.keys(policy.scope).map(k=>[k,configuration.scope[k]])));
 assert.deepEqual(policy.lifecycleBoundary,{managedCpuPreparation:true,samePackageGpuAdmission:true,boundedTrainingAfterSamePackageGpuAdmission:true,
 productionRegistryWrite:true,oldEvidenceMutation:false,qualificationOnlyStopsBeforeTraining:true,cpuPreparationValidationLoaderReadOnly:{
 split:'validation',exactSampleCount:8,originalRgbAndConditionsOnly:true,trainImageRead:false,challengeImageRead:false,regressionImageRead:false,
 sourceMutation:false,autograd:false,checkpointSelection:false},...(route.completion?{boundMeaning:route.qualificationCompletion?'Fixed48train admission and24epochs/1152G/1152D; no total wall cutoff for either authenticated phase in this new policy. Existing safety, output, identity, stop and finite startup/operation/cleanup retained.':'Fixed24epochs/1152G/1152D and retained safety/output/stop boundaries; no training total wall cutoff for this policy.'}:{})});
 assert.deepEqual(policy.checkpointSelection,{eligibleEpochs:[24],strictNewCandidateReloadRequired:true,automaticResumeAllowed:false,observationOnlyEpochs:[12]});
 for(const key of ['priorCpuEvidence','jointRuleCpuEvidence']){assert.equal(policy[key].oldAttemptReplayAllowed,false);assert.equal(policy[key].grantsGpuOrTrainingQualification,false);}
 assert.equal(policy.priorCpuEvidence.normativeVersion,'AI-PAINTER-SPEC-1.91');assert.equal(policy.jointRuleCpuEvidence.normativeVersion,'AI-PAINTER-SPEC-1.82');
 assert.equal(policy.qualificationOnlyPredecessor.oldQualificationReusable,false);assert.equal(policy.qualificationOnlyPredecessor.oldAttemptReplayAllowed,false);
 assert.deepEqual(policy.trainingPreviewPolicy,{path:route.previewPath,schemaVersion:route.interfaceContract?'ai-painter-registered-training-preview-policy-v1':route.sameCallCapture?'ai-painter-training-preview-observation-policy-v9':route.qualificationCompletion?'ai-painter-training-preview-observation-policy-v8':route.completion?'ai-painter-training-preview-observation-policy-v7':'ai-painter-training-preview-observation-policy-v6',exactHashRequiredInPlanConfigurationAndPackage:true,
  ...(route.completion?{sha256:configuration.trainingPreviewPolicy.sha256}:{})});
 assert.ok(Object.values(policy.qualification).every(x=>x===false));
 assert.equal(policy.resourceFailureRecord.observation,'exact_failing_poll_no_requery');assert.equal(policy.resourceFailureRecord.maximumMessageBytes,2048);
 assert.deepEqual(policy.resourceFailureRecord.reasonCodes,['free_vram_below_minimum','temperature_at_or_above_maximum']);
 return policy;
}
export function verifyAuthority(root,{capabilityVersion=CAPABILITY}={}){
 const route=executionRoute(capabilityVersion),{CAPABILITY,MODEL_CAPABILITY,OUTPUT_ROOT,SPECIFICATION,EXECUTION_POLICY}=route;
 const progressPolicy=route.progressPolicy??PROGRESS_PUBLICATION_POLICY,roles=rolesFor(capabilityVersion);
 const policy=json(root,EXECUTION_POLICY),previewBinding=bind(root,route.previewPath);
 if(route.sameCallCapture&&!TRAINING_CAPTURE_CAPABILITIES.includes(policy.candidate)){
  const support=json(root,policy.sameCallCapture.cpuSupport.acceptance),report=json(root,policy.sameCallCapture.cpuSupport.report);
  assert.equal(support.status,'accepted_cpu_integration_host_correction_only');
  assert.deepEqual(report.tests,{run:55,failures:0,errors:0,skipped:0});
  assert.equal(report.productionIntegrated,false);assert.equal(report.realModelForwards,0);
  for(const component of policy.sameCallCapture.componentSources)read(root,component);
 }
 assert.ok(read(root,SPECIFICATION).includes(Buffer.from(route.interfaceContract?route.interfacePolicy.formalSpecification.version:route.sameCallCapture?'AI-PAINTER-SPEC-1.105':route.qualificationCompletion?'AI-PAINTER-SPEC-1.99':route.completion?'AI-PAINTER-SPEC-1.98':'AI-PAINTER-SPEC-1.96')));
 const configuration=deriveConfiguration(json(root,sourceCandidateBinding(capabilityVersion)),{capabilityVersion,trainingPreviewPolicy:previewBinding});
 verifyExecutionPolicy(policy,configuration);
 for(const ref of authorityBindings(policy))read(root,ref);
 const qualificationCapture=verifyQualificationFailureCapturePolicy(policy);
 if(qualificationCapture)verifyQualificationFailureCaptureCpuEvidence(json(root,qualificationCapture.cpuEvidence),qualificationCapture);
 const trainingCapture=verifyTrainingFailureCapturePolicy(policy);
 if(trainingCapture)verifyTrainingFailureCaptureCpuEvidence(json(root,trainingCapture.cpuEvidence),trainingCapture);
 const accepted=json(root,policy.priorCpuEvidence.acceptance),terminal=json(root,authorityBindings(policy).find(b=>b.path===policy.priorCpuEvidence.terminal.path));
 assert.equal(accepted.status,'cpu_candidate_verified_inactive_scope_closed');
 assert.equal(accepted.candidate,'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1');
 if(['stage4_mvp256_dry_decode2_support_structure_weight1_v1','stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1',QUALIFICATION_CAPTURE_CAPABILITY,...TRAINING_CAPTURE_CAPABILITIES].includes(route.CAPABILITY)){
  const rgbOutput=['stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1',QUALIFICATION_CAPTURE_CAPABILITY,...TRAINING_CAPTURE_CAPABILITIES].includes(route.CAPABILITY);
  const numeric=json(root,policy.numericRepairCpuEvidence);
  assert.equal(numeric.schemaVersion,rgbOutput?'parameter90-numeric-repair-component-cpu-v1':'parameter40-numeric-repair-component-cpu-v1');assert.equal(numeric.status,'component_passed_not_admitted');
  assert.equal(numeric.exitCode,0);assert.equal(numeric.modelCapability,MODEL_CAPABILITY);
  if(rgbOutput)assert(Number.isSafeInteger(numeric.summary.testsRun)&&numeric.summary.testsRun>0);
  else assert.equal(numeric.summary.testsRun,18);
  assert.equal(numeric.summary.passed,true);assert.equal(numeric.summary.cudaInitialized,false);
  assert.equal(numeric.summary.optimizerConstruction,0);assert.equal(numeric.summary.optimizerUpdates,0);
  numeric.programBindings.forEach(source=>read(root,source));
 }
 assert.equal(terminal.status,'cpu_candidate_verified_inactive');assert.equal(terminal.executionState,'completed');
 assert.equal(terminal.ownedReceipt.cleanupConfirmed,true);assert.equal(terminal.ownedReceipt.guardReleaseConfirmed,true);
 assert.equal(terminal.registryBeforeSha256,terminal.registryAfterSha256);assert.ok(Object.values(terminal.qualification).every(x=>x===false));
 const joint=json(root,policy.jointRuleCpuEvidence.acceptance);assert.equal(joint.status,'cpu_affinity_startup_repair_closed_real_cpu_verified_inactive');
 assert.equal(joint.realExecution.status,'real_cpu_verified_inactive');
 const preview=json(root,previewBinding);assert.equal(preview.schemaVersion,route.interfaceContract?'ai-painter-registered-training-preview-policy-v1':route.sameCallCapture?'ai-painter-training-preview-observation-policy-v9':route.qualificationCompletion?'ai-painter-training-preview-observation-policy-v8':route.completion?'ai-painter-training-preview-observation-policy-v7':'ai-painter-training-preview-observation-policy-v6');
 assert.equal(preview.scope.capabilityVersion,CAPABILITY);assert.equal(preview.scope.modelCapabilityVersion,MODEL_CAPABILITY);
 assert.equal(preview.scope.outputRootPrefix,OUTPUT_ROOT+'/');
 for(const key of ['component','tests','storage','storageTests']){assert.notEqual(preview.programBindings[key].sha256,'0'.repeat(64));read(root,preview.programBindings[key]);}
 const progress=json(root,progressPolicy),proof=json(root,route.completion?policy.priorProgressPublicationCpuEvidence:policy.progressPublicationCpuEvidence);
 assert.equal(progress.status,'registered_inactive_cpu_candidate');assert.equal(progress.implementation.component,roles.progressPublication);
 assert.equal(proof.status,'cpu_component_scope_closed_not_production_adopted');
 if(!route.completion){assert.deepEqual(proof.implementation.policy,PROGRESS_PUBLICATION_POLICY);assert.equal(proof.implementation.component.path,ROLES.progressPublication);read(root,proof.implementation.component);}
 return {policy,previewBinding,configuration};
}
function provenance(policy){return {schemaVersion:'ai-painter-execution-provenance-refs-v1',
 priorCpuAcceptance:{...policy.priorCpuEvidence.acceptance},priorCpuTerminal:Object.fromEntries(['path','sha256'].map(k=>[k,policy.priorCpuEvidence.terminal[k]])),
 jointRuleCpuAcceptance:{...policy.jointRuleCpuEvidence.acceptance},role:'immutable_historical_source_references_not_execution_permission'};}
export function prepareCpuRequest({root,runId,packageId,preparationRequestBinding=null,capabilityVersion=CAPABILITY}){
 const route=executionRoute(capabilityVersion),{OUTPUT_ROOT,SPECIFICATION,MODEL_CAPABILITY}=route;
 assert.match(runId,new RegExp('^'+(route.runPrefix??'decode1-entry-quality-v1-')+'[a-f0-9-]{36}$','u'));assert.match(packageId,new RegExp('^'+(route.packagePrefix??'decode1-entry-quality-v1-package-')+'[a-f0-9-]{36}$','u'));
 const sourceCandidate=sourceCandidateBinding(capabilityVersion),{policy,configuration}=verifyAuthority(root,{capabilityVersion}),candidate=json(root,sourceCandidate),outputRoot=OUTPUT_ROOT+'/'+runId;
 const programBindings=finalProgramBindings(root,{capabilityVersion}),runtime=runtimeIdentity(root),directory=inside(root,outputRoot);
 verifyCanonicalVerificationPolicy(policy,programBindings);
 if(fs.existsSync(directory)){assert.ok(preparationRequestBinding,'existing Run requires its exact registered preparation request');
  assert.deepEqual(fs.readdirSync(directory).sort(),['local-prepare'],'existing model/CPU/consumed namespace refused');
  validatePreparationNamespace(preparationRequestBinding,json(root,preparationRequestBinding),{outputRoot,runId,packageId,programBindings,runtimeIdentity:runtime});
 }else assert.equal(preparationRequestBinding,null);
 return write(root,outputRoot+'/cpu-request.json',{schema:'object-support-structure-quality-cpu-request-v1',runId,packageId,outputRoot:outputRoot+'/cpu-entry',
 configuration,programBindings,modelIdentityOutput:outputRoot+'/model-identity.json',modelCapabilityVersion:MODEL_CAPABILITY,
 datasetManifest:candidate.frozenBindings.datasetManifest,trainSplit:candidate.frozenBindings.trainSplit,validationSplit:candidate.frozenBindings.validationSplit,
 formalSpecification:SPECIFICATION,sourceCandidate,runtimeIdentity:runtime,historicalProvenance:provenance(policy),
 ...(route.interfaceContract?{interfacePolicy:route.EXECUTION_POLICY,entrypointSnapshot:route.entrypointSnapshot}:{})});
}
export function validatePlan(root,plan){
 const route=executionRoute(plan.capabilityVersion),{policy,previewBinding,configuration}=verifyAuthority(root,{capabilityVersion:plan.capabilityVersion});
 assert.deepEqual(plan.configuration,configuration);assert.deepEqual(plan.executionPolicy,route.EXECUTION_POLICY);assert.deepEqual(plan.trainingPreviewPolicy,previewBinding);
 assert.deepEqual(plan.historicalProvenance,provenance(policy));
 validate({plan,planBinding:{path:plan.outputRoot+'/quality-plan.json',sha256:sha(JSON.stringify(plan))},
 packageBinding:{path:'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json',sha256:sha('shape-only')},
 modelBinding:plan.modelBinding,modelIdentity:json(root,plan.modelBinding)});
 verifyCanonicalVerificationPolicy(policy,plan.programBindings);
 verifyProgramBindingAliases(plan.programBindings,{capabilityVersion:plan.capabilityVersion});assert.deepEqual(plan.programBindings,finalProgramBindings(root,{capabilityVersion:plan.capabilityVersion}),'actual current execution closure differs');
 const candidate=json(root,sourceCandidateBinding(plan.capabilityVersion));for(const key of ['datasetManifest','trainSplit','validationSplit'])assert.deepEqual(plan[key],candidate.frozenBindings[key]);
 let bytes=0;for(const b of Object.values(plan.programBindings)){const raw=read(root,b);assert.ok(raw.length<=1048576);bytes+=raw.length;assert.ok(bytes<=16777216);}
 assert.equal(Object.hasOwn(plan,'resourceSuccessor'),false);return plan;
}
export function makeInternalCandidate(root,planBinding){
 const plan=validatePlan(root,json(root,planBinding));verifyFinalAcceptance(root,plan);const {policy}=verifyAuthority(root,{capabilityVersion:plan.capabilityVersion});
 const evidence=[planBinding,...authorityBindings(policy),plan.trainingPreviewPolicy,plan.modelBinding,plan.datasetManifest,plan.trainSplit,plan.validationSplit,plan.finalCpuAcceptance,plan.dataClosure];
 return {schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:plan.packageId,capabilityVersion:plan.capabilityVersion,
 ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:plan.outputRoot,
 programFiles:Object.fromEntries(Object.entries(plan.programBindings).map(([role,b])=>[role,b.path])),
 inputEvidencePaths:[...new Set(evidence.map(b=>b.path))],
 phaseAdapters:Object.fromEntries(PHASES.map(exportName=>[exportName,{path:ADAPTER,exportName}]))};
}
export function verifyCpuReport(raw,request,plan){
 const {MODEL_CAPABILITY}=executionRoute(plan.capabilityVersion??request.configuration?.capabilityVersion??CAPABILITY);
 assert.equal(raw.schema,'object-support-structure-quality-entry-cpu-report-v1');assert.equal(raw.status,'passed');
 assert.ok(Number.isSafeInteger(raw.passed)&&raw.passed>=20);for(const key of ['failed','errors','skipped'])assert.equal(raw[key],0);
 assert.equal(raw.synthetic,true);assert.equal(raw.gpuInitialized,false);
 assert.deepEqual(raw.actualCalls,Object.fromEntries(['moduleForwardCalls','autogradCalls','optimizerConstructionAttempts','optimizerUpdates','cudaInitializationAttempts'].map(k=>[k,0])));
 for(const key of ['programBindings','configuration','runtimeIdentity']){assert.deepEqual(raw[key],plan[key]);assert.deepEqual(request[key],plan[key]);}
 assert.equal(Object.hasOwn(request,'modelBinding'),false,'CPU bootstrap must not import a reference identity');
 assert.equal(request.modelIdentityOutput,plan.outputRoot+'/model-identity.json');
 assert.equal(request.modelCapabilityVersion,MODEL_CAPABILITY);
 assert.equal(raw.modelBinding.path,request.modelIdentityOutput);binding(raw.modelBinding);
 if(plan.modelBinding)assert.deepEqual(raw.modelBinding,plan.modelBinding);
 validateModelIdentity(raw.initialModel);
 assert.equal(request.schema,'object-support-structure-quality-cpu-request-v1');assert.equal(request.runId,plan.runId);assert.equal(request.packageId,plan.packageId);
 assert.equal(request.outputRoot,plan.outputRoot+'/cpu-entry');assert.equal(raw.items.length,raw.passed);assert.ok(raw.items.every(x=>x.status==='passed'));
 return raw;
}
export function verifyFinalAcceptance(root,plan){
 const acceptance=json(root,plan.finalCpuAcceptance);assert.equal(acceptance.schema,'object-support-structure-quality-final-cpu-acceptance-v1');
 assert.equal(acceptance.status,'passed');assert.deepEqual(acceptance.programBindings,plan.programBindings);
 const raw=json(root,acceptance.report),request=json(root,raw.request);verifyCpuReport(raw,request,plan);
 assert.deepEqual(raw.initialModel,json(root,plan.modelBinding));
 const receipt=json(root,acceptance.ownedReceipt);assert.equal(receipt.phase,'cpu');assert.equal(receipt.cleanupConfirmed,true);
 assert.equal(receipt.processCleanupConfirmed,true);
 assert.equal(receipt.ownerClosed,true);assert.equal(receipt.proof.exitCode,0);assert.equal(receipt.proof.assignedBeforeResume,true);
 assert.equal(receipt.proof.killOnJobClose,true);assert.equal(receipt.proof.activeProcessesAfterCleanup,0);
 assert.equal(receipt.cpuNegativeInputs?.fixtureLinksRemoved,true);
 assert.equal(receipt.cpuNegativeInputs.linkMetadataReserveBytes,49152);assert.equal(receipt.cpuNegativeInputs.reserveIsMeasurement,false);
 assert.equal(receipt.cpuNegativeInputs.root,plan.outputRoot+'/cpu-negative-inputs');
 assert.equal(receipt.cpuNegativeInputs.declaration.path,receipt.cpuNegativeInputs.root+'/input-declaration.json');
 const declaration=json(root,receipt.cpuNegativeInputs.declaration);assert.deepEqual(declaration.request,raw.request);
 assert.deepEqual(declaration.programBindings,plan.programBindings);assert.equal(declaration.callIdentity,receipt.guard.identity);
 const base=plan.outputRoot+'/cpu-negative-inputs',expected=[{name:'reader',path:base+'/reader-link',target:base+'/reader-target'},
  {name:'snapshot',path:base+'/snapshot-link',target:base+'/snapshot-target'},{name:'program',path:base+'/program-project/scripts/lib',target:base+'/program-target'}];
 assert.equal(receipt.cpuNegativeInputs.links.length,3);
 for(const [i,link] of receipt.cpuNegativeInputs.links.entries()){assert.deepEqual({name:link.name,path:link.path,target:link.target},expected[i]);
  assert.equal(link.present,false);assert.match(link.observedIdentity,/^\d+:\d+$/u);
  assert.equal(fs.existsSync(inside(root,link.path)),false,'CPU fixture link remains');
  const observation=json(root,bind(root,plan.outputRoot+'/cpu-entry/negative-observation-'+link.name+'.json'));
  assert.equal(observation.callIdentity,receipt.guard.identity);assert.deepEqual(observation.request,raw.request);
  assert.deepEqual(observation.link,{...link,present:true});}
 assert.ok(Array.isArray(receipt.cpuNegativeInputs.directoryIdentities)&&receipt.cpuNegativeInputs.directoryIdentities.length>=8);
 for(const entry of receipt.cpuNegativeInputs.directoryIdentities){assert.ok(entry.path===base||entry.path.startsWith(base+'/'));
  const stat=fs.lstatSync(inside(root,entry.path),{bigint:true});assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
  assert.equal(id(stat),entry.identity,'CPU input directory replaced after cleanup');}
 // Python independently verifies the exact command, native binaries and guard.
 return acceptance;
}
export function validatePreparationNamespace(bindingValue,request,expected){
 binding(bindingValue);assert.equal(bindingValue.path,expected.outputRoot+'/local-prepare/request.json');
 assert.equal(request.schema,'ai-painter-local-prepare-request-v1');
 assert.equal(request.protocol,'ai-painter-local-control-v2');
 const route=executionRoute(request.capabilityVersion);
 assert.equal(request.candidateSelection,route.candidateSelection);
 if(route.interfaceContract){assert.deepEqual(request.interfacePolicy,route.EXECUTION_POLICY);assert.deepEqual(request.entrypointSnapshot,route.entrypointSnapshot);}
 assert.equal(expected.outputRoot,route.OUTPUT_ROOT+'/'+expected.runId);
 for(const key of ['runId','packageId','outputRoot','programBindings','runtimeIdentity'])assert.deepEqual(request[key],expected[key]);
 assert.equal(request.requestId,expected.runId);assert.deepEqual(request.candidateBinding,sourceCandidateBinding(request.capabilityVersion));
 assert.equal(request.executionPackage,null);assert.equal(request.automaticRetries,0);return request;
}
export async function finalizeCpuAcceptance({root,requestBinding,result}){
 const {hasLiveOwnedProof,hasLiveCpuFixtureCleanup,withNativeOrdinaryBudget}=await import('./ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs');
 assert.ok(hasLiveOwnedProof(result.ownedReceipt),'same live CPU call required');assert.equal(result.ownedReceipt.proof?.exitCode,0);
 assert.equal(result.ownedReceipt.phase,'cpu');
 assert.ok(hasLiveCpuFixtureCleanup(result.ownedReceipt),'same retained CPU call must confirm all fixture links removed');
 const request=json(root,requestBinding),reportBinding=JSON.parse(result.stdout),raw=json(root,reportBinding);
 assert.equal(reportBinding.path,request.outputRoot+'/cpu-report.json');assert.deepEqual(raw.request,requestBinding);
 const plan={...request,outputRoot:request.outputRoot.replace(/\/cpu-entry$/u,'')};verifyCpuReport(raw,request,plan);
 assert.deepEqual(raw.initialModel,validateModelIdentity(json(root,raw.modelBinding)));
 return withNativeOrdinaryBudget(root,result.ownedReceipt,()=>write(root,plan.outputRoot+'/cpu-acceptance.json',{
  schema:'object-support-structure-quality-final-cpu-acceptance-v1',status:'passed',programBindings:request.programBindings,
  report:reportBinding,ownedReceipt:result.receiptBinding}));
}
export function preparePlan({root,requestBinding,finalCpuAcceptance}){
 const request=json(root,requestBinding),outputRoot=request.outputRoot.replace(/\/cpu-entry$/u,'');
 const acceptance=json(root,finalCpuAcceptance),raw=json(root,acceptance.report);
 const plan={...Object.fromEntries(['runId','packageId','configuration','programBindings','datasetManifest','trainSplit','validationSplit','formalSpecification','sourceCandidate','runtimeIdentity'].map(k=>[k,request[k]])),modelBinding:raw.modelBinding,dataClosure:raw.dataClosure,
   schema:PLAN_SCHEMA,executionProfile:executionRoute(request.configuration.capabilityVersion).EXECUTION_PROFILE,executionMode:'bounded-quality-training',capabilityVersion:request.configuration.capabilityVersion,
  outputRoot,finalCpuAcceptance,historicalCheckpointMayInitialize:false,trainingRestartAllowed:false};
 {
  plan.executionPolicy={...executionRoute(plan.capabilityVersion).EXECUTION_POLICY};
  plan.trainingPreviewPolicy=request.configuration.trainingPreviewPolicy;plan.historicalProvenance=request.historicalProvenance;
  if(request.interfacePolicy){plan.interfacePolicy=request.interfacePolicy;plan.entrypointSnapshot=request.entrypointSnapshot;}
 }
 validatePlan(root,plan);verifyFinalAcceptance(root,plan);return write(root,outputRoot+'/quality-plan.json',plan);
}
export function loadContext(context){
 const root=context.projectRoot,plans=context.inputEvidence.filter(b=>b.path.endsWith('/quality-plan.json'));assert.equal(plans.length,1);
 const plan=validatePlan(root,json(root,plans[0]));verifyFinalAcceptance(root,plan);
 assert.equal(context.capabilityVersion,plan.capabilityVersion);assert.equal(context.packageIdentity,plan.packageId);assert.equal(context.outputRoot,plan.outputRoot);
 const packageBinding=bind(root,'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json'),spec=json(root,packageBinding);
 assert.equal(spec.schemaVersion,'ai-painter-autonomous-closed-loop-package-v1');assert.equal(spec.maxInfrastructureRecoveryAttempts,0);
 assert.equal(spec.ownerAuthorizationRequired,false);assert.equal(spec.ownerInStateMachine,false);assert.deepEqual(spec.inputEvidence,context.inputEvidence);
 assert.deepEqual(spec.programLineage,Object.fromEntries(Object.entries(plan.programBindings).map(([k,b])=>[k,b.sha256])));
 assert.deepEqual(Object.keys(spec.phaseAdapters).sort(),[...PHASES].sort());
 for(const phase of PHASES)assert.deepEqual(spec.phaseAdapters[phase],{kind:'project_module_export',path:ADAPTER,sha256:plan.programBindings.adapter.sha256,exportName:phase});
 for(const b of spec.inputEvidence)read(root,b);
 return {root,plan,packageBinding,spec,planBinding:plans[0],input:{plan,planBinding:plans[0],packageBinding,modelBinding:plan.modelBinding,modelIdentity:json(root,plan.modelBinding)}};
}


