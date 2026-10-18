// Diagnostic identity sidecar. The existing registry remains the only writer.
import assert from 'node:assert/strict';
export const CAPABILITY='stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_quality24_v1';
export const PLAN_SCHEMA='ecology-terrain-detail-weight-quality-plan-v1';
export const EXECUTION_PROFILE='bounded_ecology_terrain_detail_weight_quality24_v1';
export const OUTPUT_ROOT='.runtime/ai-painter/ecology-terrain-detail-weight-quality-executions';
export const SPECIFICATION=Object.freeze({path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',sha256:'792bf647336eb59a3cdbe6b4efbe3e630724e810ba0afa125fb4d7cc350c2e19'});
export const EXECUTION_POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-terrain-detail-weight-quality-execution-policy-v3.json',sha256:'4bea99e243a1f68806eb27f4c4da4cc3aad11c77f58956efbd34e583cb2eb1d2'});
export const CANDIDATE=Object.freeze({path:'data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json',sha256:'ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566'});
export const MODEL_CAPABILITY='stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1';
export const ARCHITECTURE='fresh_detail_precision_four_heads_independent_season_ecology_decode1_and_terrain_detail_weight_fp64_v1';
export const NUMERIC_RULE='fp32_native_biased_conv_native_input_weight_vjp_fp64_bias_reduce_device_v1|fp32_native_biased_detail_conv_native_input_bias_vjp_fp64_unfold_matmul_weight_once_fp32_v1|decode1_conv3_fp32_native_forward_native_input_bias_vjp_original_device_fp64_unfold_matmul_weight_once_fp32_v1|terrain_full_resolution_detail_conv3_fp32_native_forward_native_input_bias_vjp_full_mask_original_device_fp64_unfold_matmul_weight_once_fp32_v1';
export function validateModelIdentity(modelIdentity){
 assert.equal(modelIdentity.capabilityVersion,CAPABILITY);assert.equal(modelIdentity.modelCapabilityVersion,MODEL_CAPABILITY);assert.equal(modelIdentity.architecture,ARCHITECTURE);
 assert.equal(modelIdentity.numericRule,NUMERIC_RULE);
 assert.equal(modelIdentity.graph.length,108);assert.equal(new Set(modelIdentity.graph.map(r=>r.name)).size,108);
 assert.equal(modelIdentity.graph.reduce((n,r)=>{assert.equal(r.dtype,'torch.float32');assert.ok(r.shape.every(x=>Number.isSafeInteger(x)&&x>0));assert.equal(r.elements,r.shape.reduce((a,b)=>a*b,1));return n+r.elements},0),2242687);
 assert.deepEqual(modelIdentity.graph[52],{dtype:'torch.float32',elements:20736,name:'core.core.terrain.decode_1.layers.3.weight',shape:[48,48,3,3]});
 assert.deepEqual(modelIdentity.graph[60],{dtype:'torch.float32',elements:20736,name:'core.core.terrain.full_resolution_detail.layers.3.weight',shape:[48,48,3,3]});
 assert.deepEqual(Object.keys(modelIdentity.initialState).sort(),['discriminator','generator']);
 for(const digest of Object.values(modelIdentity.initialState))assert.match(digest,/^[a-f0-9]{64}$/u);
 return modelIdentity;
}
export const FROZEN_PLAN=Object.freeze({path:'.runtime/ai-painter/ecology-regime-managed-executions/ecology-managed-t73-20261009075755-execution/ecology-plan.json',sha256:'03d5ec1e68701d03f5a9973c793731d1e3811226ed294e151e5a80bf225ca030'});
export const HEARTBEAT_SECONDS=120;
export function binding(value){
 assert.deepEqual(Object.keys(value??{}).sort(),['path','sha256']);assert.match(value.sha256,/^[a-f0-9]{64}$/u);
 assert.equal(typeof value.path,'string');assert.ok(value.path.length<=4096&&!/[\\:\x00-\x1f\x7f]/u.test(value.path));
 assert.ok(value.path.split('/').every(p=>p&&p!=='.'&&p!=='..'));return value;
}
export function deriveConfiguration(candidate){
 assert.equal(candidate.schemaVersion,'stage4-mvp256-dry-v24-closed-loop-candidate-v1');
 assert.equal(candidate.capabilityVersion,'stage4_mvp256_dry_v24_closed_loop_candidate_v1');
 for(const key of ['datasetManifest','trainSplit','validationSplit','dryScope','sourcePolicy','numericReview','detailReview'])binding(candidate.frozenBindings[key]);
 assert.deepEqual(candidate.scope.resolution,[256,192]);assert.equal(candidate.scope.worldCount,1);
 assert.equal(candidate.scope.subjectSplit,'validation');assert.equal(candidate.scope.waterFactPresent,false);
 return {schema:'ecology-terrain-detail-weight-quality-configuration-v2',capabilityVersion:CAPABILITY,sourceCandidate:CANDIDATE,formalSpecification:SPECIFICATION,
  executionCeiling:{...candidate.executionCeiling,epochs:24,generatorOptimizerSteps:1152,discriminatorOptimizerSteps:1152,maxWallSeconds:8400},
  dataUse:{train:48,validation:8,challenge:4,regression:4,weightUpdatesFrom:['train'],checkpointSelectionFrom:['validation'],
   challengeAndRegressionContentRead:false,sourceImageOrSplitMutation:false},
  scope:{resolution:[256,192],worldCount:1,subjectSampleId:candidate.scope.subjectSampleId,subjectSplit:'validation',waterFactPresent:false,buildingsRequired:false,artificialRoadNetworkRequired:false,personalityRequired:false,formalStage4Qualification:false,runtimePublication:false,purpose:'single_bounded_quality_validation'},seed:20260929,gpuAdmissionSeconds:600,
  checkpointSelection:{...candidate.checkpointSelection,eligibleEpochs:[24],observationOnlyEpochs:[12]},captureMiB:64,captureMetadataReserveBytes:1048576,terminalReserveBytes:65536,
  freshInitializationOnly:true,historicalCheckpointMayInitialize:false,automaticResumeAllowed:false,
  optimizer:{name:'AdamW',generatorLearningRate:.0001,discriminatorLearningRate:.0001,weightDecay:.01,betas:[.9,.999],eps:1e-8}};
}
export function validate(input){
 const {plan,planBinding,packageBinding,modelBinding,modelIdentity}=input;
 assert.equal(plan.schema,PLAN_SCHEMA);assert.equal(plan.executionProfile,EXECUTION_PROFILE);assert.equal(plan.capabilityVersion,CAPABILITY);
 assert.equal(plan.executionMode,'bounded-quality-training');assert.deepEqual(plan.formalSpecification,SPECIFICATION);assert.deepEqual(plan.sourceCandidate,CANDIDATE);
 for(const key of ['runId','packageId'])assert.match(plan[key],/^[a-z0-9][a-z0-9-]{7,127}$/u);
 assert.notEqual(plan.runId,plan.packageId);assert.equal(plan.outputRoot,OUTPUT_ROOT+'/'+plan.runId);
 assert.equal(plan.historicalCheckpointMayInitialize,false);assert.equal(plan.trainingRestartAllowed,false);
 assert.equal(Object.hasOwn(plan,'resourcePolicy'),false);assert.equal(Object.hasOwn(plan,'effectiveExecutionCeiling'),false);
 for(const item of [planBinding,packageBinding,modelBinding,plan.finalCpuAcceptance])binding(item);
 assert.equal(planBinding.path,plan.outputRoot+'/quality-plan.json');
 assert.equal(packageBinding.path,'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json');
 assert.deepEqual(plan.modelBinding,modelBinding);assert.equal(modelBinding.path,plan.outputRoot+'/model-identity.json');
 validateModelIdentity(modelIdentity);
 assert.ok(Object.keys(plan.programBindings).length>=179&&Object.keys(plan.programBindings).length<=256);
 for(const [role,item]of Object.entries(plan.programBindings)){assert.match(role,/^[A-Za-z0-9._-]{1,80}$/u);assert.ok(!['__proto__','constructor','prototype'].includes(role));binding(item);}
 const ceiling=plan.configuration.executionCeiling;
 assert.equal(plan.configuration.schema,'ecology-terrain-detail-weight-quality-configuration-v2');
 assert.equal(plan.configuration.capabilityVersion,CAPABILITY);
 assert.deepEqual(plan.configuration.formalSpecification,SPECIFICATION);assert.deepEqual(plan.configuration.sourceCandidate,CANDIDATE);
 assert.deepEqual(plan.configuration.dataUse,{train:48,validation:8,challenge:4,regression:4,weightUpdatesFrom:['train'],checkpointSelectionFrom:['validation'],challengeAndRegressionContentRead:false,sourceImageOrSplitMutation:false});
 assert.equal(plan.configuration.seed,20260929);assert.equal(plan.configuration.gpuAdmissionSeconds,600);
 assert.equal(plan.configuration.freshInitializationOnly,true);assert.equal(plan.configuration.historicalCheckpointMayInitialize,false);assert.equal(plan.configuration.automaticResumeAllowed,false);
 assert.equal(plan.configuration.captureMiB,64);assert.equal(plan.configuration.captureMetadataReserveBytes,1048576);assert.equal(plan.configuration.terminalReserveBytes,65536);
 for(const [key,value]of Object.entries({epochs:24,generatorOptimizerSteps:1152,discriminatorOptimizerSteps:1152,maxWallSeconds:8400,
  cpuThreads:2,trainingAttempts:1,automaticRetries:0,maxGpuMemoryFraction:.7,maximumTemperatureC:85,minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,maxOutputMiB:128}))assert.equal(ceiling[key],value);
 assert.deepEqual(plan.configuration.checkpointSelection.eligibleEpochs,[24]);
 assert.deepEqual(plan.configuration.checkpointSelection.observationOnlyEpochs,[12]);
 return structuredClone(input);
}
export function createPresentation(input){
 const {plan,packageBinding,modelBinding}=validate(input);
 return {schemaVersion:'ai-painter-current-training-package-v1',capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,
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
 return {schemaVersion:'ai-painter-current-active-execution-v1',capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,
  executionState:'executing',processId:execution.processId,processStartIdentity:execution.processStartIdentity,
  programLineage:plan.programBindings,lock:execution.lock,heartbeat:execution.heartbeat};
}
export function validateTerminal(value,packageBinding,plan){
 assert.equal(value.schema,'ecology-terrain-detail-weight-quality-worker-terminal-v1');assert.equal(value.executionProfile,EXECUTION_PROFILE);
 for(const key of ['capabilityVersion','runId','packageId'])assert.equal(value[key],plan[key]);
 assert.deepEqual(value.executionPackage,packageBinding);
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
