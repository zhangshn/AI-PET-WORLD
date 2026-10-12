// Diagnostic identity sidecar. The existing registry remains the only writer.
import assert from 'node:assert/strict';
export const CAPABILITY='stage4_mvp256_dry_factorized_ecology_v1';
export const PLAN_SCHEMA='ecology-regime-failure-capture-plan-v1';
export const EXECUTION_PROFILE='factorized_ecology_failure_capture_execution_v1';
export const OUTPUT_ROOT='.runtime/ai-painter/ecology-regime-failure-capture-executions';
export const SPECIFICATION=Object.freeze({path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',sha256:'ba3e8cf1b4bff0e260f3db11511e959ac64f5c89360dde564211e69755680734'});
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
 return {schema:'ecology-regime-failure-capture-configuration-v1',capabilityVersion:CAPABILITY,sourceCandidate:CANDIDATE,formalSpecification:SPECIFICATION,
  executionCeiling:{...candidate.executionCeiling,epochs:13,generatorOptimizerSteps:600,discriminatorOptimizerSteps:600},
  dataUse:{train:48,validation:8,challenge:4,regression:4,weightUpdatesFrom:['train'],validationMetadataOnly:true,
   challengeAndRegressionContentRead:false,sourceImageOrSplitMutation:false},
  scope:{resolution:[256,192],purpose:'gradient_failure_diagnostic_only'},seed:20260929,gpuAdmissionSeconds:600,
  checkpointSelection:{eligibleEpochs:[],executed:false},captureMiB:64,captureMetadataReserveBytes:1048576,terminalReserveBytes:65536,
  freshInitializationOnly:true,historicalCheckpointMayInitialize:false,automaticResumeAllowed:false,
  optimizer:{kind:'AdamW',learningRate:.0001,betas:[.9,.999],epsilon:1e-8,weightDecay:.01,foreach:false,fused:false}};
}
export function validate(input){
 const {plan,planBinding,packageBinding,modelBinding,modelIdentity}=input;
 assert.equal(plan.schema,PLAN_SCHEMA);assert.equal(plan.executionProfile,EXECUTION_PROFILE);assert.equal(plan.capabilityVersion,CAPABILITY);
 assert.equal(plan.executionMode,'bounded-failure-capture');assert.deepEqual(plan.formalSpecification,SPECIFICATION);assert.deepEqual(plan.sourceCandidate,CANDIDATE);
 for(const key of ['runId','packageId'])assert.match(plan[key],/^[a-z0-9][a-z0-9-]{7,127}$/u);
 assert.notEqual(plan.runId,plan.packageId);assert.equal(plan.outputRoot,OUTPUT_ROOT+'/'+plan.runId);
 assert.equal(plan.historicalCheckpointMayInitialize,false);assert.equal(plan.trainingRestartAllowed,false);
 assert.equal(Object.hasOwn(plan,'resourcePolicy'),false);assert.equal(Object.hasOwn(plan,'effectiveExecutionCeiling'),false);
 for(const item of [planBinding,packageBinding,modelBinding,plan.finalCpuAcceptance])binding(item);
 assert.equal(planBinding.path,plan.outputRoot+'/failure-capture-plan.json');
 assert.equal(packageBinding.path,'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json');
 assert.deepEqual(plan.modelBinding,modelBinding);assert.equal(modelIdentity.capabilityVersion,CAPABILITY);
 assert.equal(modelIdentity.architecture,'fresh_detail_precision_four_heads_independent_season_ecology_training_v1');
 assert.equal(modelIdentity.numericRule,'fp32_native_biased_conv_native_input_weight_vjp_fp64_bias_reduce_device_v1|fp32_native_biased_detail_conv_native_input_bias_vjp_fp64_unfold_matmul_weight_once_fp32_v1');
 assert.equal(modelIdentity.graph.length,108);assert.equal(new Set(modelIdentity.graph.map(r=>r.name)).size,108);
 assert.equal(modelIdentity.graph.reduce((n,r)=>{assert.equal(r.dtype,'torch.float32');assert.ok(r.shape.every(x=>Number.isSafeInteger(x)&&x>0));assert.equal(r.elements,r.shape.reduce((a,b)=>a*b,1));return n+r.elements},0),2242687);
 for(const sha of Object.values(modelIdentity.initialState))assert.match(sha,/^[a-f0-9]{64}$/u);
 assert.ok(Object.keys(plan.programBindings).length>=179&&Object.keys(plan.programBindings).length<=256);
 for(const [role,item]of Object.entries(plan.programBindings)){assert.match(role,/^[A-Za-z0-9._-]{1,80}$/u);assert.ok(!['__proto__','constructor','prototype'].includes(role));binding(item);}
 const ceiling=plan.configuration.executionCeiling;
 for(const [key,value]of Object.entries({epochs:13,generatorOptimizerSteps:600,discriminatorOptimizerSteps:600,maxWallSeconds:2700,
  cpuThreads:2,trainingAttempts:1,automaticRetries:0,maxGpuMemoryFraction:.7,maximumTemperatureC:85,minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,maxOutputMiB:128}))assert.equal(ceiling[key],value);
 assert.deepEqual(plan.configuration.checkpointSelection,{eligibleEpochs:[],executed:false});
 return structuredClone(input);
}
export function createPresentation(input){
 const {plan,packageBinding,modelBinding}=validate(input);
 return {schemaVersion:'ai-painter-current-training-package-v1',capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,
  outputRoot:plan.outputRoot,resolution:[256,192],trainingPlan:{epochs:13,generatorOptimizerSteps:600,discriminatorOptimizerSteps:600,checkpointSelection:plan.configuration.checkpointSelection},
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
 assert.equal(value.schema,'ecology-regime-failure-capture-worker-terminal-v1');assert.equal(value.executionProfile,EXECUTION_PROFILE);
 for(const key of ['capabilityVersion','runId','packageId'])assert.equal(value[key],plan[key]);assert.deepEqual(value.executionPackage,packageBinding);
 assert.ok(['bounded_diagnostic_completed','failed_closed'].includes(value.status));assert.equal(value.executionState,value.status==='failed_closed'?'failed_closed':'completed');
 if(value.optimizerSteps!==null){assert.deepEqual(Object.keys(value.optimizerSteps).sort(),['discriminator','generator']);
  for(const n of Object.values(value.optimizerSteps))assert.ok(Number.isSafeInteger(n)&&n>=0&&n<=600);
  assert.equal(value.optimizerStepsGenerator,value.optimizerSteps.generator);assert.equal(value.optimizerStepsDiscriminator,value.optimizerSteps.discriminator);}
 else {assert.equal(value.optimizerStepsGenerator,null);assert.equal(value.optimizerStepsDiscriminator,null);}
 if(value.status==='bounded_diagnostic_completed'){assert.deepEqual(value.optimizerSteps,{generator:600,discriminator:600});assert.equal(value.captureStatus,'capture_not_triggered');assert.equal(value.originalError,null);}
 else {assert.ok(value.originalError&&typeof value.originalError.message==='string');assert.ok(['captured','capture_incomplete'].includes(value.captureStatus));}
 if(value.captureStatus==='captured'){
  const receipt=value.captureReceipt;assert.equal(receipt?.status,'captured');assert.deepEqual(receipt.primaryError,value.originalError);
  for(const [kind,name]of [['manifest','manifest.json'],['primary','primary.json'],['tensors','tensors.pt']]){
   const b=receipt.artifacts?.[kind];assert.equal(b?.path,plan.outputRoot+'/gradient-failure/'+name);assert.match(b.sha256,/^[a-f0-9]{64}$/u);assert.ok(Number.isSafeInteger(b.bytes)&&b.bytes>0&&b.bytes<=67108864);
  }
 }
 assert.deepEqual(value.checkpoints,[]);
 for(const flag of ['checkpointSelectionExecuted','validationRgbRead','challengeContentRead','regressionContentRead','checkpointPromotable','formalStage4QualificationAllowed','runtimePublicationAllowed'])assert.equal(value[flag],false);
 assert.equal(value.automaticRetries,0);return value;
}
