// Diagnostic identity sidecar. The existing registry remains the only writer.
import assert from 'node:assert/strict';
export const CAPABILITY='stage4_mvp256_dry_factorized_ecology_quality_v1';
export const PLAN_SCHEMA='ecology-regime-quality-plan-v1';
export const EXECUTION_PROFILE='factorized_ecology_quality_execution_v1';
export const OUTPUT_ROOT='.runtime/ai-painter/ecology-regime-quality-executions';
export const SPECIFICATION=Object.freeze({path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',sha256:'41c000f8b0dff28184bd1ccd0d584d10916824ad61f85054aae110dc71d42a51'});
export const CANDIDATE=Object.freeze({path:'data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json',sha256:'ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566'});
export const MODEL_REFERENCE=Object.freeze({path:'.runtime/ai-painter/ecology-execution-auth-t-q4-71/cpu/model-identity.json',sha256:'61a05d8d487fad5b96ec5df285ca6eeede772edb41649535f02adba41c827469'});
export const FROZEN_PLAN=Object.freeze({path:'.runtime/ai-painter/ecology-regime-managed-executions/ecology-managed-t73-20261009075755-execution/ecology-plan.json',sha256:'03d5ec1e68701d03f5a9973c793731d1e3811226ed294e151e5a80bf225ca030'});
export const HEARTBEAT_SECONDS=120;
export function binding(value){
 assert.deepEqual(Object.keys(value??{}).sort(),['path','sha256']);assert.match(value.sha256,/^[a-f0-9]{64}$/u);
 assert.equal(typeof value.path,'string');assert.ok(value.path.length<=4096&&!/[\\:\x00-\x1f\x7f]/u.test(value.path));
 assert.ok(value.path.split('/').every(p=>p&&p!=='.'&&p!=='..'));return value;
}
export function deriveConfiguration(candidate){
 return {schema:'ecology-regime-quality-configuration-v1',capabilityVersion:CAPABILITY,sourceCandidate:CANDIDATE,formalSpecification:SPECIFICATION,
  executionCeiling:{...candidate.executionCeiling,epochs:12,generatorOptimizerSteps:576,discriminatorOptimizerSteps:576},
  dataUse:{train:48,validation:8,challenge:4,regression:4,weightUpdatesFrom:['train'],checkpointSelectionFrom:['validation'],
   challengeAndRegressionContentRead:false,sourceImageOrSplitMutation:false},
  scope:{resolution:[256,192],worldCount:1,subjectSampleId:candidate.scope.subjectSampleId,subjectSplit:'validation',waterFactPresent:false,buildingsRequired:false,artificialRoadNetworkRequired:false,personalityRequired:false,formalStage4Qualification:false,runtimePublication:false,purpose:'single_bounded_quality_validation'},seed:20260929,gpuAdmissionSeconds:600,
  checkpointSelection:{...candidate.checkpointSelection,eligibleEpochs:[12]},captureMiB:64,captureMetadataReserveBytes:1048576,terminalReserveBytes:65536,
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
 assert.deepEqual(plan.modelBinding,modelBinding);assert.equal(modelIdentity.capabilityVersion,'stage4_mvp256_dry_factorized_ecology_v1');
 assert.equal(modelIdentity.architecture,'fresh_detail_precision_four_heads_independent_season_ecology_training_v1');
 assert.equal(modelIdentity.numericRule,'fp32_native_biased_conv_native_input_weight_vjp_fp64_bias_reduce_device_v1|fp32_native_biased_detail_conv_native_input_bias_vjp_fp64_unfold_matmul_weight_once_fp32_v1');
 assert.equal(modelIdentity.graph.length,108);assert.equal(new Set(modelIdentity.graph.map(r=>r.name)).size,108);
 assert.equal(modelIdentity.graph.reduce((n,r)=>{assert.equal(r.dtype,'torch.float32');assert.ok(r.shape.every(x=>Number.isSafeInteger(x)&&x>0));assert.equal(r.elements,r.shape.reduce((a,b)=>a*b,1));return n+r.elements},0),2242687);
 for(const sha of Object.values(modelIdentity.initialState))assert.match(sha,/^[a-f0-9]{64}$/u);
 assert.ok(Object.keys(plan.programBindings).length>=179&&Object.keys(plan.programBindings).length<=256);
 for(const [role,item]of Object.entries(plan.programBindings)){assert.match(role,/^[A-Za-z0-9._-]{1,80}$/u);assert.ok(!['__proto__','constructor','prototype'].includes(role));binding(item);}
 const ceiling=plan.configuration.executionCeiling;
 for(const [key,value]of Object.entries({epochs:12,generatorOptimizerSteps:576,discriminatorOptimizerSteps:576,maxWallSeconds:2700,
  cpuThreads:2,trainingAttempts:1,automaticRetries:0,maxGpuMemoryFraction:.7,maximumTemperatureC:85,minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,maxOutputMiB:128}))assert.equal(ceiling[key],value);
 assert.deepEqual(plan.configuration.checkpointSelection.eligibleEpochs,[12]);
 return structuredClone(input);
}
export function createPresentation(input){
 const {plan,packageBinding,modelBinding}=validate(input);
 return {schemaVersion:'ai-painter-current-training-package-v1',capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,
  outputRoot:plan.outputRoot,resolution:[256,192],trainingPlan:{epochs:12,generatorOptimizerSteps:576,discriminatorOptimizerSteps:576,checkpointSelection:plan.configuration.checkpointSelection},
  resourceBudget:plan.configuration.executionCeiling,observation:{progressPath:plan.outputRoot+'/progress.json'},
  autonomousExecutionPackage:packageBinding,modelBinding,observationOnly:true,cpuQualified:false,gpuQualified:false,trainingAllowed:false,
  checkpointPromotable:false,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false,productionExecutionAuthenticated:false};
}
export function createActiveIdentity(input,execution){
 const {plan}=validate(input);
 for(const key of ['runId','packageId','capabilityVersion'])assert.equal(execution[key],plan[key]);
 assert.equal(execution.executionState,'executing');assert.ok(Number.isSafeInteger(execution.processId)&&execution.processId>0&&execution.processId<=0x7fffffff);
 assert.equal(typeof execution.processStartIdentity,'string');assert.ok(execution.processStartIdentity.length>0&&execution.processStartIdentity.length<=1024);
 binding(execution.lock);assert.equal(execution.lock.path,plan.outputRoot+'/execution-lock.json');
 assert.deepEqual(execution.programBindings,plan.programBindings);assert.deepEqual(execution.heartbeat,{path:plan.outputRoot+'/heartbeat.json',ttlSeconds:120});
 return {schemaVersion:'ai-painter-current-active-execution-v1',capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,
  executionState:'executing',processId:execution.processId,processStartIdentity:execution.processStartIdentity,
  programLineage:plan.programBindings,lock:execution.lock,heartbeat:execution.heartbeat};
}
export function validateTerminal(value,packageBinding,plan){
 assert.equal(value.schema,'ecology-regime-quality-worker-terminal-v1');assert.equal(value.executionProfile,EXECUTION_PROFILE);
 for(const key of ['capabilityVersion','runId','packageId'])assert.equal(value[key],plan[key]);
 assert.deepEqual(value.executionPackage,packageBinding);
 assert.ok(['training_completed_review_pending','failed_closed'].includes(value.status));
 assert.equal(value.executionState,value.status==='failed_closed'?'failed_closed':'completed');
 if(value.optimizerSteps!==null){
  assert.deepEqual(Object.keys(value.optimizerSteps).sort(),['discriminator','generator']);
  for(const n of Object.values(value.optimizerSteps))assert.ok(Number.isSafeInteger(n)&&n>=0&&n<=576);
  assert.equal(value.optimizerStepsGenerator,value.optimizerSteps.generator);
  assert.equal(value.optimizerStepsDiscriminator,value.optimizerSteps.discriminator);
 }else {assert.equal(value.optimizerStepsGenerator,null);assert.equal(value.optimizerStepsDiscriminator,null);}
 assert.ok(Array.isArray(value.checkpoints)&&value.checkpoints.length<=1);
 for(const r of value.checkpoints){assert.equal(r.epoch,12);binding(r.checkpoint);
  assert.equal(r.checkpoint.path,plan.outputRoot+'/checkpoint-12.pt');
  assert.deepEqual(r.counts,{generator:576,discriminator:576});assert.equal(r.selection.epoch,12);
  assert.deepEqual(r.selection.rank,[r.selection.worstApplicableObjectCorrelation,-r.selection.meanValidationRgbMae,-12]);
  assert.equal(r.selection.qualificationGranted,false);assert.equal(r.selection.checkpointPromotionEligible,false);
 }
 if(value.status==='training_completed_review_pending'){
  assert.equal(value.completedEpochs,12);assert.deepEqual(value.optimizerSteps,{generator:576,discriminator:576});
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
