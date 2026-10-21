// Independent target48 lifecycle identity. The existing registry is the only writer.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readOwnedStopProjectFile} from './ai-painter-owned-stop-request-v1.mjs';
import {parseTrainingInterfacePolicy,decodeTrainingInterfaceJson} from '../../src/server/ai-console/training-preview-history-v1.mjs';

export const INTERFACE_REGISTRY_PATH='data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json';
export function registeredTrainingInterfaces(root=process.cwd()){
 const registryBytes=readOwnedStopProjectFile(root,INTERFACE_REGISTRY_PATH,1048576);
 const registry=decodeTrainingInterfaceJson(registryBytes,1048576);
 assert.equal(registry.schemaVersion,'ai-painter-current-entrypoint-registry-v1');
 assert.equal(registry.status,'active');assert.equal(registry.normalAuthority,'local_ai_pet_world_program');
 assert.equal(registry.ownerInNormalStateMachine,false);
 const rows=registry.trainingInterfaces??[];assert.ok(Array.isArray(rows)&&rows.length<=64,'bounded training interface index required');
 const selections=new Set((registry.localControlEntrypoints??[]).map(row=>row.candidateSelection).filter(Boolean)),
  capabilities=new Set((registry.localControlEntrypoints??[]).map(row=>row.capabilityVersion).filter(Boolean)),roots=new Set();
 return rows.map(row=>{
  assert.deepEqual(Object.keys(row).sort(),['candidateSelection','executionPolicy']);binding(row.executionPolicy);
  assert.ok(row.executionPolicy.path.startsWith('data/ai-painter/system-governance/'));
  const raw=readOwnedStopProjectFile(root,row.executionPolicy.path,65536);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),row.executionPolicy.sha256,'interface policy SHA differs');
  const policy=decodeTrainingInterfaceJson(raw),parsed=parseTrainingInterfacePolicy(policy),d=parsed.descriptor;
  assert.equal(row.candidateSelection,d.candidateSelection);
  for(const [seen,value]of [[selections,d.candidateSelection],[capabilities,parsed.capability],[roots,parsed.root]]){
   assert.ok(!seen.has(value),'duplicate training interface identity');seen.add(value);
  }
  return {...SAME_CALL_PROFILE,CAPABILITY:parsed.capability,EXECUTION_PROFILE:parsed.profile,OUTPUT_ROOT:policy.outputRoot,
   SPECIFICATION:{path:policy.formalSpecification.path,sha256:policy.formalSpecification.sha256},
   EXECUTION_POLICY:{...row.executionPolicy},previewPath:parsed.previewPolicy.path,progressPolicy:parsed.progressPolicy,
   candidateSelection:d.candidateSelection,runPrefix:d.runPrefix,packagePrefix:d.packagePrefix,
   interfaceContract:d,interfacePolicy:policy,
   interfacePolicyCanonicalSha256:crypto.createHash('sha256').update(JSON.stringify(canonicalInterface(policy)).replace(/[\u007f-\uffff]/gu,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))).digest('hex'),
   entrypointSnapshot:{schemaVersion:'ai-painter-training-entrypoint-snapshot-v1',registry:{path:INTERFACE_REGISTRY_PATH,
    sha256:crypto.createHash('sha256').update(registryBytes).digest('hex')},selection:structuredClone(row)}};
 });
}
function canonicalInterface(value){return Array.isArray(value)?value.map(canonicalInterface):value!==null&&typeof value==='object'
 ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalInterface(value[k])])):value;}
export const COMPLETION_CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1';
export const COMPLETION_V2_CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2';
export const SAME_CALL_CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1';
export const COMPLETION_V2_SELECTOR='decode1-entry-weight-quality-completion-v2';
export const COMPLETION_SELECTOR='decode1-entry-weight-quality-completion-v1';
export const CAPABILITY='stage4_mvp256_dry_decode1_entry_weight_quality24_v1';
export const PLAN_SCHEMA='object-support-structure-quality-plan-v1';
export const EXECUTION_PROFILE='bounded_decode1_entry_weight_quality24_v1';
export const OUTPUT_ROOT='.runtime/ai-painter/decode1-entry-weight-quality-executions';
export const SPECIFICATION=Object.freeze({path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',sha256:'f33115ca81ff3704e5b47d29f2927c5db9a5e0e97045a04b10813e646506557b'});
export const EXECUTION_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v1.json',sha256:'94363da6660fb4c6c2789f0d7567babea231d8814f5e8652098b8891e9897fa9'});
export const JOINT_LEARNING_RULE=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-joint-object-priority-cpu-policy-v1.json',sha256:'ad23ad5a097fe9b4f6cc89a621a7ff763ac31340046a418b02861f2c94e59bf4'});
export const PROGRESS_PUBLICATION_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v1.json',sha256:'594e72f0f3faa0d4eb8380e64143e197bf31d6eb6567578ba5f2e762c431c1bc'});
export const LOSS=Object.freeze({"path":"data/ai-painter/system-governance/ai-painter-object-support-structure-cpu-policy-v1.json","sha256":"f5842c5005a60a2c51dd84f9baca1d4ecc751a5fed09e8647f7d96acd4efaefe"});
export const GRADIENT=Object.freeze({"path":"data/ai-painter/system-governance/ai-painter-object-support-structure-integration-cpu-policy-v1.json","sha256":"2aa89a112ebc125e9b4bfdea8f7adade22f1d57afb094d1d4b4f1cff36293d82"});
export const INTEGRATION_POLICY=Object.freeze({"path":"data/ai-painter/system-governance/ai-painter-object-support-structure-lifecycle-integration-policy-v1.json","sha256":"7782b99aa6f04c56a14a2f35694c4e67c99911835bc62e1096f25ac3424d17d3"});
export const CANDIDATE=Object.freeze({path:'data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json',sha256:'ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566'});
export const MODEL_CAPABILITY='stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1';
export const ARCHITECTURE='fresh_detail_precision_four_heads_independent_season_ecology_decode1_terrain_detail_final_rgb_base_decode1_entry_weight_fp64_v1';
export const NUMERIC_RULE='fp32_native_biased_conv_native_input_weight_vjp_fp64_bias_reduce_device_v1|fp32_native_biased_detail_conv_native_input_bias_vjp_fp64_unfold_matmul_weight_once_fp32_v1|decode1_conv3_fp32_native_forward_native_input_bias_vjp_original_device_fp64_unfold_matmul_weight_once_fp32_v1|terrain_full_resolution_detail_conv3_fp32_native_forward_native_input_bias_vjp_full_mask_original_device_fp64_unfold_matmul_weight_once_fp32_v1|final_rgb_base_conv2_fp32_native_forward_native_input_bias_vjp_full_mask_original_device_fp64_unfold_matmul_weight_once_fp32_v1|decode1_entry_conv0_fp32_native_forward_native_input_bias_vjp_full_mask_original_device_fp64_unfold_matmul_weight_once_fp32_v1';

export const PROFILE=Object.freeze({CAPABILITY,MODEL_CAPABILITY,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION,EXECUTION_POLICY,ARCHITECTURE,NUMERIC_RULE,
 previewPath:'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v6.json',candidateSelection:'decode1-entry-weight-quality-v1'});
export const COMPLETION_EXECUTION_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v2.json',sha256:'cee623bb0a34bfd49f68ec99f6078c93603a7af66f457e807f29fa50b6cd467b'});
export const COMPLETION_PROGRESS_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v2.json',sha256:'e4c71f859201cccfac33afacec4f0ec731709c45d73d276886ab642d7c923403'});
export const COMPLETION_PROFILE=Object.freeze({...PROFILE,CAPABILITY:COMPLETION_CAPABILITY,
 EXECUTION_PROFILE:'completion_decode1_entry_weight_quality24_v1',OUTPUT_ROOT:'.runtime/ai-painter/decode1-entry-weight-quality-completion-executions',
 SPECIFICATION:Object.freeze({path:SPECIFICATION.path,sha256:'d8590b62599da831130fdd791edee9ea23f683d0ce62cd3845f9466676d37162'}),
 EXECUTION_POLICY:COMPLETION_EXECUTION_POLICY,previewPath:'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v7.json',
 candidateSelection:COMPLETION_SELECTOR,completion:true,progressPolicy:COMPLETION_PROGRESS_POLICY,
 runPrefix:'decode1-entry-completion-v1-',packagePrefix:'decode1-entry-completion-v1-package-'});
export const COMPLETION_V2_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v3.json',sha256:'851b6ad6c13794f9351325a3b9f6323295dd48c4dbad9a141f74074a7e0b2307'});
export const COMPLETION_V2_PROGRESS_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v3.json',sha256:'0dc4baba10f789f8b571f9bcf322e3d3e5962e21bda1224054d1fce2665db16f'});
export const COMPLETION_V2_PROFILE=Object.freeze({...COMPLETION_PROFILE,CAPABILITY:COMPLETION_V2_CAPABILITY,
 EXECUTION_PROFILE:'completion_decode1_entry_weight_quality24_v2',OUTPUT_ROOT:'.runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions',
 SPECIFICATION:Object.freeze({path:SPECIFICATION.path,sha256:'0bdd8f244f2e75777e75e27a8606c1f7132d464ea5d1efb1aec8d1b1abce294e'}),
 EXECUTION_POLICY:COMPLETION_V2_POLICY,previewPath:'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v8.json',
 candidateSelection:COMPLETION_V2_SELECTOR,qualificationCompletion:true,progressPolicy:COMPLETION_V2_PROGRESS_POLICY,
 runPrefix:'decode1-entry-completion-v2-',packagePrefix:'decode1-entry-completion-v2-package-'});
export const SAME_CALL_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v4.json',sha256:'a9efa678657b7069b36f824487673e27d05a862b39a37a21bf3270d34624e2aa'});
export const SAME_CALL_PROGRESS_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-progress-publication-cpu-policy-v4.json',sha256:'f03354cab75b2a96cc0145b85103999e6f22e6e1e4ddc5541f0063f0f58935b9'});
export const SAME_CALL_PROFILE=Object.freeze({...COMPLETION_V2_PROFILE,CAPABILITY:SAME_CALL_CAPABILITY,
 EXECUTION_PROFILE:'completion_decode1_entry_weight_quality24_same_call_v1',OUTPUT_ROOT:'.runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions',
 SPECIFICATION:Object.freeze({path:SPECIFICATION.path,sha256:'4492b0641a5a3b5e62e9b8f2c71f358f3dcd3d43734cc7f3de0b721730c92cfc'}),
 EXECUTION_POLICY:SAME_CALL_POLICY,previewPath:'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v9.json',
 candidateSelection:'decode1-entry-weight-quality-same-call-v1',sameCallCapture:true,progressPolicy:SAME_CALL_PROGRESS_POLICY,
 runPrefix:'decode1-entry-same-call-v1-',packagePrefix:'decode1-entry-same-call-v1-package-'});
export function executionRoute(capabilityVersion=CAPABILITY,root=process.cwd()){
 if(capabilityVersion===SAME_CALL_CAPABILITY)return SAME_CALL_PROFILE;
 if(capabilityVersion===COMPLETION_V2_CAPABILITY)return COMPLETION_V2_PROFILE;
 if(capabilityVersion===COMPLETION_CAPABILITY)return COMPLETION_PROFILE;
 if(capabilityVersion===CAPABILITY)return PROFILE;
 const found=registeredTrainingInterfaces(root).find(route=>route.CAPABILITY===capabilityVersion);
 assert.ok(found,'unknown execution identity');return found;}
export function gpuAdmissionSeconds(capabilityVersion=CAPABILITY){return executionRoute(capabilityVersion).qualificationCompletion?null:720;}
export function sourceCandidateBinding(capabilityVersion=CAPABILITY,root=process.cwd()){
 const route=executionRoute(capabilityVersion,root);
 return route.interfaceContract?binding(route.interfacePolicy.sourceCandidate):CANDIDATE;
}
export function sourceFileCountMaximum(capabilityVersion=CAPABILITY){executionRoute(capabilityVersion);return 256;}
export function validateModelIdentity(modelIdentity){
 const {CAPABILITY,MODEL_CAPABILITY,ARCHITECTURE,NUMERIC_RULE}=executionRoute(modelIdentity.capabilityVersion);
 assert.equal(modelIdentity.capabilityVersion,CAPABILITY);assert.equal(modelIdentity.modelCapabilityVersion,MODEL_CAPABILITY);assert.equal(modelIdentity.architecture,ARCHITECTURE);
 assert.equal(modelIdentity.numericRule,NUMERIC_RULE);
 assert.equal(modelIdentity.graph.length,108);assert.equal(new Set(modelIdentity.graph.map(r=>r.name)).size,108);
 assert.equal(modelIdentity.graph.reduce((n,r)=>{assert.equal(r.dtype,'torch.float32');assert.ok(r.shape.every(x=>Number.isSafeInteger(x)&&x>0));assert.equal(r.elements,r.shape.reduce((a,b)=>a*b,1));return n+r.elements},0),2242687);
 assert.deepEqual(modelIdentity.graph[48],{dtype:'torch.float32',elements:62208,name:'core.core.terrain.decode_1.layers.0.weight',shape:[48,144,3,3]});
 assert.deepEqual(modelIdentity.graph[52],{dtype:'torch.float32',elements:20736,name:'core.core.terrain.decode_1.layers.3.weight',shape:[48,48,3,3]});
 assert.deepEqual(modelIdentity.graph[60],{dtype:'torch.float32',elements:20736,name:'core.core.terrain.full_resolution_detail.layers.3.weight',shape:[48,48,3,3]});
 assert.deepEqual(modelIdentity.graph[88],{dtype:'torch.float32',elements:20736,name:'core.core.final_rgb_decoder.base.layers.2.weight',shape:[48,48,3,3]});
 assert.deepEqual(Object.keys(modelIdentity.initialState).sort(),['discriminator','generator']);
 for(const digest of Object.values(modelIdentity.initialState))assert.match(digest,/^[a-f0-9]{64}$/u);
 return modelIdentity;
}
export const SUPPORT_WEIGHT1_CAPABILITY='stage4_mvp256_dry_decode1_support_structure_weight1_v1';
export const HEARTBEAT_SECONDS=120;
export function binding(value){
 assert.deepEqual(Object.keys(value??{}).sort(),['path','sha256']);assert.match(value.sha256,/^[a-f0-9]{64}$/u);
 assert.equal(typeof value.path,'string');assert.ok(value.path.length<=4096&&!/[\\:\x00-\x1f\x7f]/u.test(value.path));
 assert.ok(value.path.split('/').every(p=>p&&p!=='.'&&p!=='..'));return value;
}
export function deriveConfiguration(candidate,{capabilityVersion=CAPABILITY,trainingPreviewPolicy=null}={}){
 const route=executionRoute(capabilityVersion),{CAPABILITY,MODEL_CAPABILITY,SPECIFICATION,EXECUTION_POLICY}=route;
 assert.equal(candidate.schemaVersion,'stage4-mvp256-dry-v24-closed-loop-candidate-v1');
 assert.equal(candidate.capabilityVersion,'stage4_mvp256_dry_v24_closed_loop_candidate_v1');
 for(const key of ['datasetManifest','trainSplit','validationSplit','dryScope','sourcePolicy','numericReview','detailReview'])binding(candidate.frozenBindings[key]);
 assert.deepEqual(candidate.scope.resolution,[256,192]);assert.equal(candidate.scope.worldCount,1);
 assert.equal(candidate.scope.subjectSplit,'validation');assert.equal(candidate.scope.waterFactPresent,false);
 const result={schema:'object-support-structure-quality-configuration-v1',capabilityVersion:CAPABILITY,modelCapabilityVersion:MODEL_CAPABILITY,
  sourceAssetsCandidate:sourceCandidateBinding(capabilityVersion),sourceAssetsUse:'data_review_and_base_schedule_only_not_execution_qualification',
  formalSpecification:SPECIFICATION,integrationPolicy:INTEGRATION_POLICY,lossDefinition:LOSS,gradientDefinition:GRADIENT,
  executionCeiling:{...candidate.executionCeiling,epochs:24,generatorOptimizerSteps:1152,discriminatorOptimizerSteps:1152,maxWallSeconds:8400},
  dataUse:{train:48,validation:8,challenge:4,regression:4,weightUpdatesFrom:['train'],checkpointSelectionFrom:['validation'],
   challengeAndRegressionContentRead:false,sourceImageOrSplitMutation:false},
  scope:{resolution:[256,192],worldCount:1,subjectSampleId:candidate.scope.subjectSampleId,subjectSplit:'validation',waterFactPresent:false,buildingsRequired:false,artificialRoadNetworkRequired:false,personalityRequired:false,formalStage4Qualification:false,runtimePublication:false,purpose:'single_bounded_quality_validation'},seed:20260929,gpuAdmissionSeconds:720,
  checkpointSelection:{...candidate.checkpointSelection,eligibleEpochs:[24],observationOnlyEpochs:[12]},captureMiB:64,captureMetadataReserveBytes:1048576,terminalReserveBytes:65536,
  freshInitializationOnly:true,historicalCheckpointMayInitialize:false,automaticResumeAllowed:false,
  optimizer:{name:'AdamW',generatorLearningRate:.0001,discriminatorLearningRate:.0001,weightDecay:.01,betas:[.9,.999],eps:1e-8}};
 if(route.completion){result.executionCeiling.maxWallSeconds=null;result.executionCeiling.trainingWallMode='completion';}
 if(route.qualificationCompletion)result.gpuAdmissionWallMode='completion';
 binding(trainingPreviewPolicy);assert.equal(trainingPreviewPolicy.path,route.previewPath);
 Object.assign(result,{formalSpecification:SPECIFICATION,executionPolicy:EXECUTION_POLICY,trainingPreviewPolicy:{...trainingPreviewPolicy},gpuAdmissionSeconds:gpuAdmissionSeconds(capabilityVersion),
  jointLearningRule:{...JOINT_LEARNING_RULE},progressPublicationPolicy:{...(route.progressPolicy??PROGRESS_PUBLICATION_POLICY)}});
 if(capabilityVersion===SUPPORT_WEIGHT1_CAPABILITY){
  assert.equal(route.interfacePolicy.objectSupportStructureWeight,1,'registered support weight1 policy required');result.objectSupportStructureWeight=1;
 }else assert.equal(Object.hasOwn(route.interfacePolicy??{},'objectSupportStructureWeight'),false,'legacy policy cannot activate support weight1');
 executionRoute(capabilityVersion);
 return result;
}
export function validate(input){
 const {plan,planBinding,packageBinding,modelBinding,modelIdentity}=input;
 const route=executionRoute(plan.capabilityVersion),{CAPABILITY,MODEL_CAPABILITY,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION}=route;
 assert.equal(plan.schema,PLAN_SCHEMA);assert.equal(plan.executionProfile,EXECUTION_PROFILE);assert.equal(plan.capabilityVersion,CAPABILITY);
 assert.equal(plan.executionMode,'bounded-quality-training');assert.deepEqual(plan.formalSpecification,SPECIFICATION);assert.deepEqual(plan.sourceCandidate,sourceCandidateBinding(plan.capabilityVersion));
 if(route.interfaceContract){assert.deepEqual(plan.interfacePolicy,route.EXECUTION_POLICY);assert.deepEqual(plan.entrypointSnapshot,route.entrypointSnapshot);}
 for(const key of ['runId','packageId'])assert.match(plan[key],/^[a-z0-9][a-z0-9-]{7,127}$/u);
 assert.notEqual(plan.runId,plan.packageId);assert.equal(plan.outputRoot,OUTPUT_ROOT+'/'+plan.runId);
 assert.equal(plan.historicalCheckpointMayInitialize,false);assert.equal(plan.trainingRestartAllowed,false);
 assert.equal(Object.hasOwn(plan,'resourcePolicy'),false);assert.equal(Object.hasOwn(plan,'effectiveExecutionCeiling'),false);
 for(const item of [planBinding,packageBinding,modelBinding,plan.finalCpuAcceptance])binding(item);
 assert.equal(planBinding.path,plan.outputRoot+'/quality-plan.json');
 assert.equal(packageBinding.path,'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json');
 assert.deepEqual(plan.modelBinding,modelBinding);assert.equal(modelBinding.path,plan.outputRoot+'/model-identity.json');
 validateModelIdentity(modelIdentity);
 assert.ok(Object.keys(plan.programBindings).length>=1&&Object.keys(plan.programBindings).length<=sourceFileCountMaximum(plan.capabilityVersion));
 for(const [role,item]of Object.entries(plan.programBindings)){assert.match(role,/^[A-Za-z0-9._-]{1,80}$/u);assert.ok(!['__proto__','constructor','prototype'].includes(role));binding(item);}
 const ceiling=plan.configuration.executionCeiling;
 assert.equal(plan.configuration.schema,'object-support-structure-quality-configuration-v1');
 assert.equal(plan.configuration.capabilityVersion,CAPABILITY);
 assert.deepEqual(plan.configuration.formalSpecification,route.SPECIFICATION);assert.deepEqual(plan.configuration.sourceAssetsCandidate,sourceCandidateBinding(plan.capabilityVersion));
 {binding(plan.trainingPreviewPolicy);assert.equal(plan.trainingPreviewPolicy.path,route.previewPath);assert.deepEqual(plan.trainingPreviewPolicy,plan.configuration.trainingPreviewPolicy);assert.deepEqual(plan.executionPolicy,route.EXECUTION_POLICY);assert.deepEqual(plan.configuration.executionPolicy,route.EXECUTION_POLICY);}
 assert.deepEqual(plan.configuration.jointLearningRule,JOINT_LEARNING_RULE);assert.deepEqual(plan.configuration.progressPublicationPolicy,route.progressPolicy??PROGRESS_PUBLICATION_POLICY);
 assert.equal(Object.hasOwn(plan.configuration,'sourceCandidate'),false);assert.equal(plan.configuration.sourceAssetsUse,'data_review_and_base_schedule_only_not_execution_qualification');
 if(plan.capabilityVersion===SUPPORT_WEIGHT1_CAPABILITY)assert.equal(plan.configuration.objectSupportStructureWeight,1);
 else assert.equal(Object.hasOwn(plan.configuration,'objectSupportStructureWeight'),false,'legacy configuration cannot activate weight1');
 assert.deepEqual(plan.configuration.integrationPolicy,INTEGRATION_POLICY);assert.deepEqual(plan.configuration.lossDefinition,LOSS);assert.deepEqual(plan.configuration.gradientDefinition,GRADIENT);assert.equal(plan.configuration.modelCapabilityVersion,MODEL_CAPABILITY);
 assert.deepEqual(plan.configuration.dataUse,{train:48,validation:8,challenge:4,regression:4,weightUpdatesFrom:['train'],checkpointSelectionFrom:['validation'],challengeAndRegressionContentRead:false,sourceImageOrSplitMutation:false});
 assert.equal(plan.configuration.seed,20260929);assert.equal(plan.configuration.gpuAdmissionSeconds,gpuAdmissionSeconds(plan.capabilityVersion));
 assert.equal(plan.configuration.freshInitializationOnly,true);assert.equal(plan.configuration.historicalCheckpointMayInitialize,false);assert.equal(plan.configuration.automaticResumeAllowed,false);
 assert.equal(plan.configuration.captureMiB,64);assert.equal(plan.configuration.captureMetadataReserveBytes,1048576);assert.equal(plan.configuration.terminalReserveBytes,65536);
 for(const [key,value]of Object.entries({epochs:24,generatorOptimizerSteps:1152,discriminatorOptimizerSteps:1152,maxWallSeconds:route.completion?null:8400,
  cpuThreads:2,trainingAttempts:1,automaticRetries:0,maxGpuMemoryFraction:.7,maximumTemperatureC:85,minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,maxOutputMiB:128}))assert.equal(ceiling[key],value);
 if(route.completion)assert.equal(ceiling.trainingWallMode,'completion');else assert(!Object.hasOwn(ceiling,'trainingWallMode'),'legacy wall mode cannot change');
 assert.deepEqual(plan.configuration.checkpointSelection.eligibleEpochs,[24]);
 assert.deepEqual(plan.configuration.checkpointSelection.observationOnlyEpochs,[12]);
 return structuredClone(input);
}
export function createPresentation(input){
 const {plan,packageBinding,modelBinding}=validate(input);
 return {schemaVersion:'ai-painter-current-training-package-v1',capabilityVersion:plan.capabilityVersion,runId:plan.runId,packageId:plan.packageId,
  outputRoot:plan.outputRoot,resolution:[256,192],trainingPlan:{epochs:24,generatorOptimizerSteps:1152,discriminatorOptimizerSteps:1152,checkpointSelection:plan.configuration.checkpointSelection},
  resourceBudget:plan.configuration.executionCeiling,observation:{progressPath:plan.outputRoot+'/progress.json'},
  autonomousExecutionPackage:packageBinding,modelBinding,observationOnly:true,cpuQualified:false,gpuQualified:false,trainingAllowed:false,
  checkpointPromotable:false,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false,productionExecutionAuthenticated:false};
}
export function createActiveIdentity(input,execution){
 const {plan}=validate(input);
 for(const key of ['runId','packageId','capabilityVersion'])assert.equal(execution[key],plan[key]);
 assert.equal(execution.executionState,'executing');assert.ok(Number.isSafeInteger(execution.processId)&&execution.processId>0&&execution.processId<=0x7fffffff);
 assert.equal(typeof execution.processStartIdentity,'string');assert.ok(execution.processStartIdentity.length>0&&execution.processStartIdentity.length<=1024);
 const phase=execution.executionPhase??'training';assert.ok(['qualification','training'].includes(phase));
 binding(execution.lock);assert.equal(execution.lock.path,plan.outputRoot+(phase==='qualification'?'/qualification-lock.json':'/execution-lock.json'));
 assert.deepEqual(execution.programBindings,plan.programBindings);assert.deepEqual(execution.heartbeat,{path:plan.outputRoot+(phase==='qualification'?'/qualification-heartbeat.json':'/heartbeat.json'),ttlSeconds:120});
 return {schemaVersion:'ai-painter-current-active-execution-v1',capabilityVersion:plan.capabilityVersion,runId:plan.runId,packageId:plan.packageId,
  executionState:'executing',processId:execution.processId,processStartIdentity:execution.processStartIdentity,
  programLineage:plan.programBindings,lock:execution.lock,heartbeat:execution.heartbeat};
}
// An owned training failure is itself a legal immutable terminal when the
// worker could not publish one. Callers must verify live cleanup/current-call
// identity and reread these exact bound bytes before using the returned ref.
export function validateTrainingFailureTerminal(value,failureBinding,packageBinding,plan){
 binding(failureBinding);binding(packageBinding);
 assert.equal(failureBinding.path,plan.outputRoot+'/execution-failure.json');
 assert.equal(value.status,'failed_closed');assert.equal(value.executionState,'failed_closed');assert.equal(value.phase,'training');
 for(const key of ['capabilityVersion','runId','packageId'])assert.equal(value[key],plan[key]);
 assert.equal(plan.outputRoot,executionRoute(plan.capabilityVersion).OUTPUT_ROOT+'/'+plan.runId);
 assert.deepEqual(value.executionPackage,packageBinding);
 if(value.workerExecutionTiming!=null){
  assert.equal(executionRoute(plan.capabilityVersion).completion,true,'worker timing requires completion route');
  binding(value.workerExecutionTiming);assert.equal(value.workerExecutionTiming.path,plan.outputRoot+'/worker-execution-timing.json');
 }
 assert.equal(value.workerTerminal,null);assert.equal(value.cleanupConfirmed,true);
 assert.equal(value.optimizerStepsGenerator,null);assert.equal(value.optimizerStepsDiscriminator,null);
 assert.equal(value.automaticRetries,0);assert.equal(value.formalStage4QualificationAllowed,false);assert.equal(value.runtimePublicationAllowed,false);
 assert.equal(typeof value.error,'string');assert.ok(value.error.length>0);
 return {runId:plan.runId,...failureBinding,status:value.status};
}
export function validateTerminal(value,packageBinding,plan){
 const {CAPABILITY,MODEL_CAPABILITY,EXECUTION_PROFILE}=executionRoute(plan.capabilityVersion);
 assert.equal(value.schema,'object-support-structure-quality-worker-terminal-v1');assert.equal(value.executionProfile,EXECUTION_PROFILE);
 for(const key of ['capabilityVersion','runId','packageId'])assert.equal(value[key],plan[key]);
 assert.deepEqual(value.executionPackage,packageBinding);
 if(value.workerExecutionTiming!=null){
  assert.equal(executionRoute(plan.capabilityVersion).completion,true,'worker timing requires completion route');
  binding(value.workerExecutionTiming);assert.equal(value.workerExecutionTiming.path,plan.outputRoot+'/worker-execution-timing.json');
 }
 assert.ok(['training_completed_review_pending','failed_closed'].includes(value.status));
 assert.equal(value.executionState,value.status==='failed_closed'?'failed_closed':'completed');
 assert.ok(Array.isArray(value.epochObservations)&&value.epochObservations.length<=1,'one midpoint observation at most');
 if(value.status==='training_completed_review_pending')assert.equal(value.epochObservations.length,1,'completed training requires midpoint observation');
 for(const observation of value.epochObservations){
  assert.equal(observation.epoch,12);assert.equal(observation.checkpointSelectionEligible,false);assert.equal(observation.weightUpdates,0);
  assert.equal(observation.capabilityVersion,CAPABILITY);assert.equal(observation.modelCapabilityVersion,MODEL_CAPABILITY);
  for(const key of ['runId','packageId'])assert.equal(observation[key],plan[key]);
  assert.deepEqual(observation.executionPackage,packageBinding);assert.deepEqual(observation.modelBinding,plan.modelBinding);
  assert.deepEqual(observation.datasetManifest,plan.datasetManifest);binding(observation.planBinding);
  assert.equal(observation.planBinding.path,plan.outputRoot+'/quality-plan.json');assert.match(observation.configurationSha256,/^[a-f0-9]{64}$/u);
  assert.deepEqual(observation.optimizerSteps,{generator:576,discriminator:576});
  assert.ok(Array.isArray(observation.validation)&&observation.validation.length===8);
  assert.equal(new Set(observation.validation.map(row=>row.sampleId)).size,8);
  for(const row of observation.validation){assert.equal(row.split,'validation');assert.equal(row.epoch,12);assert.ok(typeof row.fullRgbMae==='number'&&Number.isFinite(row.fullRgbMae)&&row.fullRgbMae>=0&&row.fullRgbMae<=1);}
  assert.equal(observation.metrics.epoch,12);assert.equal(observation.metrics.qualificationGranted,false);assert.equal(observation.metrics.checkpointPromotionEligible,false);
  if(observation.artifact){binding(observation.artifact);assert.equal(observation.artifact.path,plan.outputRoot+'/epoch-observation-12.json');}
  if(value.status==='training_completed_review_pending')assert.ok(observation.artifact,'completed observation must have its immutable artifact');
 }
 if(value.optimizerSteps!==null){
  assert.deepEqual(Object.keys(value.optimizerSteps).sort(),['discriminator','generator']);
  for(const n of Object.values(value.optimizerSteps))assert.ok(Number.isSafeInteger(n)&&n>=0&&n<=1152);
  assert.equal(value.optimizerStepsGenerator,value.optimizerSteps.generator);
  assert.equal(value.optimizerStepsDiscriminator,value.optimizerSteps.discriminator);
 }else {assert.equal(value.optimizerStepsGenerator,null);assert.equal(value.optimizerStepsDiscriminator,null);}
 assert.ok(Array.isArray(value.checkpoints)&&value.checkpoints.length<=1);
 for(const r of value.checkpoints){assert.equal(r.epoch,24);binding(r.checkpoint);
  assert.equal(r.checkpoint.path,plan.outputRoot+'/checkpoint-24.pt');
  assert.deepEqual(r.counts,{generator:1152,discriminator:1152});assert.equal(r.selection.epoch,24);
  assert.deepEqual(r.selection.rank,[r.selection.worstApplicableObjectCorrelation,-r.selection.meanValidationRgbMae,-24]);
  assert.equal(r.selection.qualificationGranted,false);assert.equal(r.selection.checkpointPromotionEligible,false);
 }
 if(value.status==='training_completed_review_pending'){
  assert.equal(value.completedEpochs,24);assert.deepEqual(value.optimizerSteps,{generator:1152,discriminator:1152});
  assert.equal(value.checkpoints.length,1);assert.deepEqual(value.selectedCheckpointRecord,value.checkpoints[0]);
  assert.equal(value.checkpointReloadVerified,true);assert.equal(value.checkpointSelectionExecuted,true);
  assert.equal(value.validationRgbRead,true);assert.equal(value.captureStatus,'capture_not_triggered');assert.equal(value.originalError,null);
 }else {assert.ok(value.originalError&&typeof value.originalError.message==='string');
  assert.ok(['captured','capture_incomplete'].includes(value.captureStatus));}
 if(value.captureStatus==='captured'){
  const receipt=value.captureReceipt;assert.equal(receipt?.status,'captured');assert.deepEqual(receipt.primaryError,value.originalError);
  for(const [kind,name]of [['manifest','manifest.json'],['primary','primary.json'],['tensors','tensors.pt']]){
   const b=receipt.artifacts?.[kind];assert.equal(b?.path,plan.outputRoot+'/gradient-failure/'+name);
   assert.match(b.sha256,/^[a-f0-9]{64}$/u);assert.ok(Number.isSafeInteger(b.bytes)&&b.bytes>0&&b.bytes<=67108864);}
 }
 for(const flag of ['challengeContentRead','regressionContentRead','checkpointPromotable','formalStage4QualificationAllowed','runtimePublicationAllowed'])assert.equal(value[flag],false);
 assert.equal(value.automaticRetries,0);return value;
}
export function validateCompleted(value,packageBinding,plan){
 validateTerminal(value,packageBinding,plan);assert.equal(value.status,'training_completed_review_pending');return value;
}



