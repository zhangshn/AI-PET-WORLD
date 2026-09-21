// Bounded train-only endpoint A/B through the existing six-phase local runner.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runOwnedWorker } from "./ai-painter-owned-worker-v1.mjs";
import { readCurrentExecutionRegistry, prepareCurrentExecutionRegistryAdvance, finalizePreparedCurrentExecutionRegistryAdvance } from "../../src/server/ai-painter-current-execution-registry.mjs";
import { materializeAutonomousClosedLoopPackage } from "./ai-painter-autonomous-package-materializer-v1.mjs";
import { adjudicateBoundedDecision } from "./ai-painter-autonomous-package-decision-core-v3.mjs";
import { projectFile, boundJson, loadPhase, retryTransientIo, validateLaunchSnapshot, samplingOutputRoot } from "./ai-painter-endpoint-gradient-shadow-v1.mjs";
import { summarizePairedSampling } from "./ai-painter-paired-sampling-shadow-v1.mjs";

export const ADAPTER = "scripts/lib/ai-painter-endpoint-ab-v1.mjs";
export const WORKER = "ml/ai-painter/scripts/painter_endpoint_ab_experiment.py";
export const NODE_TEST = "scripts/tests/test-ai-painter-endpoint-ab.mjs";
export const PY_TEST = "ml/ai-painter/tests/test_endpoint_ab_experiment.py";
export const ARMS = ["single_step_control", "mixed_endpoint_candidate"];
export const TRAINING = Object.freeze({optimizerStepsPerArm:200,totalOptimizerStepLimit:400,epochsPerArm:100,batchSize:1,
  learningRate:0.0001,weightDecay:0.01,optimizer:"AdamW",optimizerState:"fresh_identical_per_arm_no_resume",
  seedBase:20260909,seedRule:"seedBase_plus_2_epoch_plus_sample_index",teacherEpochOffset:500,inferenceSteps:10,
  candidateRoute:"even_epoch_single_step_odd_epoch_endpoint_both_samples",checkpointRule:"final_step_only_no_selection",
  modelMode:"eval_with_denoiser_gradients",equalComputeClaim:false,formalQualificationAllowed:false});
export const RESOURCES = Object.freeze({maxWallSeconds:900,maxGpuSeconds:600,cudaMemoryFraction:0.7,minimumFreeVramMiB:2048,
  maximumTemperatureC:85,minimumFreeDiskMiB:2048,maxOutputMiB:128,cpuThreads:4,automaticRetries:0});
export const TRAINING_V2 = Object.freeze({...TRAINING,
  candidateRoute:"every_step_full_single_step_plus_odd_epoch_existing_endpoint_rgb",
  objectiveStrategy:"full18_every_step_plus_existing_rgb11_v2",gradientScaleChanged:true});
export const TRAINING_V3 = Object.freeze({...TRAINING_V2,
  candidateRoute:"every_step_full_single_step_plus_epoch_mod4_eq3_existing_endpoint_rgb",
  objectiveStrategy:"full18_every_step_plus_existing_rgb11_every4_v3"});
export const TRAINING_V4=Object.freeze({...TRAINING_V3,candidateRoute:"both_full_plus_endpoint_every4_candidate_only_phase4",
  objectiveStrategy:"full18_rgb11_every4_plus_candidate_phase4_v1",phase4Coefficient:1,phase4EpsilonSquared:1e-12});
const TRAININGS={v1:TRAINING,v2:TRAINING_V2,v3:TRAINING_V3,v4:TRAINING_V4};
export const PHASE4_POLICY="data/ai-painter/system-governance/ai-painter-endpoint-phase4-experiment-policy-v1.json";
const PHASE4_SPEC="docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md";
const PHASE4_POLICY_SHA="6aa0297ac06d1fb62682c6d51a0154061a563c6fe1a71ec32f8ad32425eb7446";
export const GPU_RECHECK_POLICY={path:"data/ai-painter/system-governance/ai-painter-phase4-gpu-recheck-policy-v1.json",
  sha256:"ec9bcce07c2c8f504be0272c6c4283ec6e6c33c10105456a447a11ab6fc3abab"};
export const CONTROLLED_TRAINING_POLICY={path:"data/ai-painter/system-governance/ai-painter-phase4-controlled-training-policy-v1.json",
  sha256:"3219110faaf2752a09d3b81ce64fc054c8f1daa31e2023ff9c2b56f5e3aaced4"};
const gpuOnly=request=>request.executionMode==="gpu_qualification_only";
const controlledTraining=request=>request.executionMode==="bounded_training_after_gpu_recheck";
function recheckPolicy(root,request){
  assert.deepEqual(request.gpuRecheckPolicy,GPU_RECHECK_POLICY);
  return boundJson(root,GPU_RECHECK_POLICY);
}
export function validatePhase4Policy(root,binding){
  assert.deepEqual(binding,{path:PHASE4_POLICY,sha256:PHASE4_POLICY_SHA});
  return boundJson(root,binding);
}
export function expectedEndpointRoute(version,arm,epoch){
  assert(Object.hasOwn(TRAININGS,version)&&ARMS.includes(arm)&&Number.isInteger(epoch)&&epoch>=0&&epoch<100);
  if(version==="v4")return epoch%4===3?(arm===ARMS[1]?"full_plus_endpoint_phase4":"full_plus_endpoint"):"single_step";
  const extra=version==="v3"?epoch%4===3:Boolean(epoch%2);
  return arm===ARMS[1]&&extra?(version==="v1"?"endpoint_rgb":"full_plus_endpoint"):"single_step";
}
export const OWNED_FILES = ["scripts/lib/ai-painter-owned-worker-v1.mjs", "scripts/tests/test-ai-painter-owned-worker.mjs", "scripts/fixtures/ai-painter-owned-worker.mjs",
  "scripts/lib/ai-painter-owned-worker-native-v1.mjs", "scripts/windows/ai-painter-owned-worker-owner.cs", "scripts/tests/test-ai-painter-owned-worker-native.mjs"];
const ownedPrograms=()=>Object.fromEntries(["ownedWorker","ownedTest","ownedFixture","ownedNative","ownedNativeSource","ownedNativeTest"].map((role,index)=>[role,OWNED_FILES[index]]));
const V2_FILES = [...OWNED_FILES,ADAPTER,WORKER,NODE_TEST,PY_TEST,"ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py",
  "ml/ai-painter/tests/test_endpoint_rgb_experiment.py"];
const canonical = value => JSON.stringify(value, function(key,item){
  return item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])) : item;
});
function sealEndpointRequest(payload,version){
  assert(["v2","v3","v4"].includes(version));
  assert.equal(payload.schemaVersion,`ai-painter-endpoint-ab-request-${version}`);
  assert(!("identity" in payload)&&!("outputRoot" in payload));
  assert.deepEqual(payload.training,TRAININGS[version]);assert.deepEqual(payload.resources,RESOURCES);
  const identity=`painter-endpoint-ab-${version}-`+sha(Buffer.from(canonical(payload)));
  return {...payload,identity,outputRoot:`.runtime/ai-painter/learning-capacity-experiments/${identity}`};
}
export const sealEndpointV2Request=payload=>sealEndpointRequest(payload,"v2");
export const sealEndpointV3Request=payload=>sealEndpointRequest(payload,"v3");
export const sealEndpointV4Request=payload=>sealEndpointRequest(payload,"v4");
export function validateRequestStrategy(request){
  assert(Object.keys(TRAININGS).map(v=>`ai-painter-endpoint-ab-request-${v}`).includes(request.schemaVersion));
  const version=request.schemaVersion.split("-").at(-1),modern=version!=="v1";
  assert.deepEqual(request.training,TRAININGS[version]);assert.deepEqual(request.resources,RESOURCES);
  assert.equal(request.mode,"bounded_paired_endpoint_training");
  if(request.executionMode!==undefined)assert(version==="v4"&&(gpuOnly(request)||controlledTraining(request)),"unknown execution mode");
  if(modern){const {identity,outputRoot,...payload}=request;assert.deepEqual(sealEndpointRequest(payload,version),request);}
  return modern;
}
const PHASES = ["preflight","execute","validate","review","adjudicate","finalize"];
const PARENT = "legacy_global_schedule_control";
const REGIONS = ["terrain_path_ground","object_footprints","object_tree","object_rock","object_vegetation"];
const METRICS = ["rgbMae","laplacianMae","edgeMae","phase4ResidualRmsAfterGlobalBiasRemoval",...REGIONS];
const bytes = v => Buffer.from(JSON.stringify(v,null,2)+"\n");
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const bind = (root,p) => ({path:p,sha256:sha(fs.readFileSync(projectFile(root,p)))});
const phasePath = (c,p) => `${c.outputRoot}/${p}.json`;
function persist(root,p,value) {
  const target=projectFile(root,p), data=bytes(value);
  if(fs.existsSync(target)) assert(fs.readFileSync(target).equals(data),`immutable output conflict: ${p}`);
  else { const fd=fs.openSync(target,"wx");try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);} }
  return bind(root,p);
}
function verifyBindings(root,receipts) {
  const seen=new Map();
  for(const b of receipts){assert(/^[a-f0-9]{64}$/.test(b.sha256));assert(!seen.has(b.path)||seen.get(b.path)===b.sha256);
    assert.equal(bind(root,b.path).sha256,b.sha256,`input changed: ${b.path}`);seen.set(b.path,b.sha256);}
}
export function validatePredecessor(previous,registry) {
  assert.equal(previous.schemaVersion,"ai-painter-endpoint-gradient-shadow-result-v1");
  assert.equal(previous.status,"endpoint_gradient_shadow_completed_not_visual_qualified");
  assert.equal(previous.executionState,"completed");assert.equal(previous.runId,registry.runId);
  assert.equal(previous.summary.cpuCandidatePathVerified,true);assert.equal(previous.summary.gpuCandidateQualified,false);
  assert.equal(previous.optimizerSteps,0);assert.equal(previous.trainingStarted,false);
}
export function requestOf(context) {
  const selected=context.inputEvidence.filter(b=>b.path===`${context.outputRoot}/experiment-request.json`);
  assert.equal(selected.length,1);const request=boundJson(context.projectRoot,selected[0]);
  const v2=validateRequestStrategy(request);
  assert.equal(request.identity,context.packageIdentity);assert.equal(request.outputRoot,context.outputRoot);
  // Old packages remain immutable evidence; current execution requires all
  // transitive owned-worker bytes, including their synthetic checks, rebound.
  for(const file of [ADAPTER,...OWNED_FILES]){const found=request.inputReceipts.filter(b=>b.path===file);assert.equal(found.length,1);assert.deepEqual(found[0],bind(context.projectRoot,file));}
  if(v2){
    for(const file of V2_FILES){const found=request.inputReceipts.filter(b=>b.path===file);assert.equal(found.length,1);assert.deepEqual(found[0],bind(context.projectRoot,file));}
    verifyBindings(context.projectRoot,request.inputReceipts);
  }
  if(request.schemaVersion==="ai-painter-endpoint-ab-request-v4"){
    let policy=validatePhase4Policy(context.projectRoot,request.phase4Policy);
    if(gpuOnly(request))policy=recheckPolicy(context.projectRoot,request);
    if(controlledTraining(request)){
      assert.deepEqual(request.controlledTrainingPolicy,CONTROLLED_TRAINING_POLICY);
      policy=boundJson(context.projectRoot,CONTROLLED_TRAINING_POLICY);
      assert.deepEqual(request.trainingPredecessor,policy.requiredPredecessor);
    }
    assert(request.inputReceipts.some(b=>b.path===PHASE4_POLICY&&b.sha256===PHASE4_POLICY_SHA));
    assert.deepEqual(boundJson(context.projectRoot,bind(context.projectRoot,policy.attemptPath)).request,selected[0]);
  }
  return {request,binding:selected[0]};
}
// Read-only construction. The caller must explicitly persist/materialize the new
// identity; historical request/result bytes are never rewritten or relabelled.
function buildEndpointAbRequest(root,{sourceRequest,sourceResult,expectedPreviousRevision,expectedPreviousSha256,latestTrainingRunId},version){
  assert(["v2","v3","v4"].includes(version));const previousVersion=version==="v4"?"v3":version==="v3"?"v2":"v1";
  const old=boundJson(root,sourceRequest),result=boundJson(root,sourceResult);
  assert.equal(old.schemaVersion,`ai-painter-endpoint-ab-request-${previousVersion}`);validateRequestStrategy(old);
  assert.equal(result.schemaVersion,`ai-painter-endpoint-ab-result-${previousVersion}`);assert.deepEqual(result.request,sourceRequest);
  assert.equal(result.runId,old.identity);assert.equal(result.executionState,"completed");assert.equal(result.optimizerSteps,400);
  assert.equal(result.checkpointSelected,false);assert.equal(result.formalQualificationAllowed,false);
  assert.deepEqual(result.parentCheckpoint,old.parentCheckpoint);assert.deepEqual(result.training,TRAININGS[previousVersion]);
  assert(Number.isInteger(expectedPreviousRevision)&&expectedPreviousRevision>=0);
  assert(/^[a-f0-9]{64}$/.test(expectedPreviousSha256));assert.equal(typeof latestTrainingRunId,"string");assert(latestTrainingRunId);
  assert.equal(old.selectedRows.length,2);assert(old.selectedRows.every(r=>r.split==="train"));
  const rebound=version==="v4"?[...V2_FILES,PHASE4_SPEC]:V2_FILES;
  const receipts=[...old.inputReceipts.filter(b=>!rebound.includes(b.path)),...rebound.map(f=>bind(root,f)),sourceRequest,sourceResult];
  verifyBindings(root,receipts);
  const inputReceipts=[...new Map(receipts.map(b=>[b.path,b])).values()];
  const {identity,outputRoot,...payload}=old;
  if(version==="v4"){
    const phase4Policy=bind(root,PHASE4_POLICY);validatePhase4Policy(root,phase4Policy);
    return sealEndpointRequest({...payload,schemaVersion:"ai-painter-endpoint-ab-request-v4",training:TRAINING_V4,
      inputReceipts:[...inputReceipts,phase4Policy],phase4Policy,
      documentRebindings:[{historical:old.inputReceipts.find(b=>b.path===PHASE4_SPEC),current:bind(root,PHASE4_SPEC)}],
      predecessorRequest:sourceRequest,predecessorResult:sourceResult,expectedPreviousRevision,expectedPreviousSha256,latestTrainingRunId,
      boundaries:{...old.boundaries,controlLoss:"200_full_plus_50_existing_endpoint",
        candidateLoss:"200_full_plus_50_existing_endpoint_plus_50_phase4",newLossTerms:true,
        gradientScaleChanged:true,equalUpdatesNotEqualCompute:true}},version);
  }
  return sealEndpointRequest({...payload,schemaVersion:`ai-painter-endpoint-ab-request-${version}`,training:TRAININGS[version],inputReceipts,
    predecessorRequest:sourceRequest,predecessorResult:sourceResult,expectedPreviousRevision,expectedPreviousSha256,latestTrainingRunId,
    boundaries:{...old.boundaries,candidateLoss:version==="v3"?"200_old_full_single_step_plus_50_existing_11_RGB_endpoint_objectives":"200_old_full_single_step_plus_100_existing_11_RGB_endpoint_objectives",
      controlLoss:"200_old_full_single_step",gradientScaleChanged:true,equalUpdatesNotEqualCompute:true,newLossTerms:false}},version);
}
export const buildEndpointAbV2Request=(root,options)=>buildEndpointAbRequest(root,options,"v2");
export const buildEndpointAbV3Request=(root,options)=>buildEndpointAbRequest(root,options,"v3");
export const buildEndpointAbV4Request=(root,options)=>buildEndpointAbRequest(root,options,"v4");
async function prepareEndpointAbPackageVersion(root,version){
  const current=await readCurrentExecutionRegistry(root);assert(current.ok);
  assert.equal(current.registry.activeExecution,null);assert.equal(current.registry.nextMachineAction,null);
  const terminal=boundJson(root,current.registry.latestTrainingTerminal);
  assert.equal(terminal.schemaVersion,`ai-painter-endpoint-ab-terminal-${version==="v4"?"v3":version==="v3"?"v2":"v1"}`);assert.equal(terminal.executionState,"completed");
  assert.equal(terminal.runId,current.registry.latestTrainingTerminal.runId);
  const sourceResult=terminal.workerResult,result=boundJson(root,sourceResult);
  const request=buildEndpointAbRequest(root,{sourceRequest:result.request,sourceResult,
    expectedPreviousRevision:current.registry.registryRevision,expectedPreviousSha256:current.registrySha256,
    latestTrainingRunId:current.registry.latestTrainingTerminal.runId},version);
  if(version==="v4"){
    const policy=validatePhase4Policy(root,request.phase4Policy);
    const attempt=projectFile(root,policy.attemptPath);
    const fd=fs.openSync(attempt,"wx");
    try{fs.writeFileSync(fd,bytes({schemaVersion:"endpoint-phase4-attempt-v1",
      request:{path:`${request.outputRoot}/experiment-request.json`,sha256:sha(bytes(request))},recordedAtUtc:new Date().toISOString()}));fs.fsyncSync(fd);}
    finally{fs.closeSync(fd);}
  }
  fs.mkdirSync(projectFile(root,request.outputRoot),{recursive:false});
  const receipt=persist(root,`${request.outputRoot}/experiment-request.json`,request);
  return materializeAutonomousClosedLoopPackage({schemaVersion:"ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity:request.identity,capabilityVersion:request.identity,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,
    outputRoot:request.outputRoot,programFiles:{adapter:ADAPTER,worker:WORKER,...ownedPrograms()},
    inputEvidencePaths:[receipt.path,...request.inputReceipts.map(b=>b.path)],
    phaseAdapters:Object.fromEntries(PHASES.map(p=>[p,{path:ADAPTER,exportName:p}]))},{root});
}
export const prepareEndpointAbV2Package=(root=process.cwd())=>prepareEndpointAbPackageVersion(root,"v2");
export const prepareEndpointAbV3Package=(root=process.cwd())=>prepareEndpointAbPackageVersion(root,"v3");
export const prepareEndpointAbV4Package=(root=process.cwd())=>prepareEndpointAbPackageVersion(root,"v4");

export async function preparePhase4GpuRecheck(root=process.cwd()){
  const c=await readCurrentExecutionRegistry(root);assert(c.ok);
  assert.equal(c.registry.activeExecution,null);assert.equal(c.registry.nextMachineAction,null);
  const failureBinding=c.registry.latestTrainingTerminal,failure=boundJson(root,failureBinding);
  assert.equal(failure.executionState,"failed_closed");assert.equal(failure.optimizerSteps,0);assert.equal(failure.trainingStarted,false);
  const failedResultBinding=failure.workerResult,failed=boundJson(root,failedResultBinding);
  assert.equal(failed.executionState,"failed_closed");assert.equal(failed.optimizerSteps,0);assert.equal(failed.trainingStarted,false);
  assert(failed.error.startsWith("CUDA out of memory."));assert.equal(failed.runId,failure.runId);
  const old=boundJson(root,failed.request);validateRequestStrategy(old);
  assert.equal(old.schemaVersion,"ai-painter-endpoint-ab-request-v4");assert.equal(old.executionMode,undefined);
  assert.equal(failed.runId,old.identity);
  const policy=boundJson(root,GPU_RECHECK_POLICY),equivalence=boundJson(root,policy.cpuEquivalence);
  assert.equal(equivalence.status,"cpu_equivalent");assert.equal(equivalence.optimizerSteps,0);assert.equal(equivalence.gpuStarted,false);
  assert.equal(equivalence.rows.length,2);assert(equivalence.rows.every(r=>r.allGradientsExactlyEqual&&r.lossExactlyEqual));
  const rebound=[...V2_FILES,PHASE4_SPEC];
  const receipts=[...old.inputReceipts.filter(b=>!rebound.includes(b.path)),...rebound.map(f=>bind(root,f)),
    {path:failureBinding.path,sha256:failureBinding.sha256},failedResultBinding,failed.request,GPU_RECHECK_POLICY,policy.cpuEquivalence];
  verifyBindings(root,receipts);
  const {identity,outputRoot,...payload}=old;
  const request=sealEndpointV4Request({...payload,executionMode:"gpu_qualification_only",gpuRecheckPolicy:GPU_RECHECK_POLICY,
    gpuRecheckPredecessor:{path:failureBinding.path,sha256:failureBinding.sha256},
    inputReceipts:[...new Map(receipts.map(b=>[b.path,b])).values()],
    documentRebindings:old.documentRebindings.map(r=>({...r,current:bind(root,r.current.path)})),
    expectedPreviousRevision:c.registry.registryRevision,expectedPreviousSha256:c.registrySha256,
    latestTrainingRunId:c.registry.latestTrainingTerminal.runId});
  const fd=fs.openSync(projectFile(root,policy.attemptPath),"wx");
  try{fs.writeFileSync(fd,bytes({schemaVersion:"phase4-gpu-recheck-attempt-v1",request:{path:`${request.outputRoot}/experiment-request.json`,sha256:sha(bytes(request))},recordedAtUtc:new Date().toISOString()}));fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
  fs.mkdirSync(projectFile(root,request.outputRoot),{recursive:false});
  const b=persist(root,`${request.outputRoot}/experiment-request.json`,request);
  return materializeAutonomousClosedLoopPackage({schemaVersion:"ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity:request.identity,capabilityVersion:request.identity,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,
    outputRoot:request.outputRoot,programFiles:{adapter:ADAPTER,worker:WORKER,...ownedPrograms()},
    inputEvidencePaths:[b.path,...request.inputReceipts.map(r=>r.path)],
    phaseAdapters:Object.fromEntries(PHASES.map(p=>[p,{path:ADAPTER,exportName:p}]))},{root});
}
export async function preparePhase4ControlledTraining(root=process.cwd()){
  const c=await readCurrentExecutionRegistry(root);assert(c.ok);
  assert.equal(c.registry.activeExecution,null);assert.equal(c.registry.nextMachineAction,null);
  const policy=boundJson(root,CONTROLLED_TRAINING_POLICY),predecessor=policy.requiredPredecessor;
  assert.deepEqual({path:c.registry.terminalEvidence.path,sha256:c.registry.terminalEvidence.sha256},predecessor);
  const terminal=boundJson(root,predecessor);assert.equal(terminal.status,"gpu_recheck_completed_no_training");
  assert.equal(terminal.runId,c.registry.runId);
  const result=boundJson(root,terminal.workerResult),old=boundJson(root,result.request);
  validateRequestStrategy(old);validateGpuRecheckResult(result,old,result.request);
  const rebound=[...V2_FILES,PHASE4_SPEC];
  const receipts=[...old.inputReceipts.filter(b=>!rebound.includes(b.path)),...rebound.map(f=>bind(root,f)),
    predecessor,terminal.workerResult,result.request,CONTROLLED_TRAINING_POLICY];
  verifyBindings(root,receipts);
  const {identity,outputRoot,executionMode,gpuRecheckPolicy,gpuRecheckPredecessor,...payload}=old;
  const request=sealEndpointV4Request({...payload,executionMode:"bounded_training_after_gpu_recheck",
    controlledTrainingPolicy:CONTROLLED_TRAINING_POLICY,trainingPredecessor:predecessor,
    inputReceipts:[...new Map(receipts.map(b=>[b.path,b])).values()],
    documentRebindings:old.documentRebindings.map(r=>({...r,current:bind(root,r.current.path)})),
    expectedPreviousRevision:c.registry.registryRevision,expectedPreviousSha256:c.registrySha256,
    latestTrainingRunId:c.registry.latestTrainingTerminal.runId});
  const fd=fs.openSync(projectFile(root,policy.attemptPath),"wx");
  try{fs.writeFileSync(fd,bytes({schemaVersion:"phase4-controlled-training-attempt-v1",
    request:{path:`${request.outputRoot}/experiment-request.json`,sha256:sha(bytes(request))},recordedAtUtc:new Date().toISOString()}));fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
  fs.mkdirSync(projectFile(root,request.outputRoot),{recursive:false});
  const b=persist(root,`${request.outputRoot}/experiment-request.json`,request);
  return materializeAutonomousClosedLoopPackage({schemaVersion:"ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity:request.identity,capabilityVersion:request.identity,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,
    outputRoot:request.outputRoot,programFiles:{adapter:ADAPTER,worker:WORKER,...ownedPrograms()},
    inputEvidencePaths:[b.path,...request.inputReceipts.map(r=>r.path)],
    phaseAdapters:Object.fromEntries(PHASES.map(p=>[p,{path:ADAPTER,exportName:p}]))},{root});
}
export async function prepareEndpointAbPackage(root=process.cwd()) {
  const current=await readCurrentExecutionRegistry(root);assert(current.ok,"verified current registry required");
  assert.equal(current.registry.activeExecution,null);assert.equal(current.registry.nextMachineAction,null);
  const sourceCurrent={path:current.registry.terminalEvidence.path,sha256:current.registry.terminalEvidence.sha256};
  const previous=boundJson(root,sourceCurrent);validatePredecessor(previous,current.registry);
  const {sourceSampling,sourceResult,parentCheckpoint}=previous;
  assert.deepEqual(sourceResult,{path:current.registry.latestTrainingTerminal.path,sha256:current.registry.latestTrainingTerminal.sha256});
  const source=boundJson(root,sourceResult), sampled=boundJson(root,sourceSampling).replay;
  assert.equal(source.runId,current.registry.latestTrainingTerminal.runId);
  summarizePairedSampling(source,sampled,samplingOutputRoot(sourceSampling));
  const selected=source.arms.filter(a=>a.arm===PARENT);assert.equal(selected.length,1);assert.deepEqual(selected[0].checkpoint,parentCheckpoint);
  const sourcePackage=bind(root,path.posix.dirname(sourceResult.path)+"/experiment.json");
  const modelPackage=boundJson(root,sourcePackage);
  assert.equal(modelPackage.experimentIdentity,source.runId);assert.deepEqual(modelPackage.resources,RESOURCES);
  assert.equal(modelPackage.selectedRows.length,2);assert(modelPackage.selectedRows.every(r=>r.split==="train"));
  const files=[...OWNED_FILES,ADAPTER,WORKER,NODE_TEST,PY_TEST,"scripts/lib/ai-painter-endpoint-gradient-shadow-v1.mjs",
    "ml/ai-painter/scripts/verify_endpoint_rgb_experiment.py","ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py",
    "scripts/lib/ai-painter-paired-sampling-shadow-v1.mjs","ml/ai-painter/scripts/compare_decoder_adapted_sampling.py",
    "scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs","scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
    "scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs","scripts/lib/ai-painter-local-autonomy-governance-v3.mjs",
    "scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs","scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
    "src/server/ai-painter-current-execution-registry.mjs","package-lock.json"];
  const receipts=[...modelPackage.inputReceipts,sourceCurrent,sourceSampling,sourceResult,sourcePackage,
    ...previous.evidence,...sampled.images,...source.artifacts,...files.map(f=>bind(root,f))];
  verifyBindings(root,receipts);
  const inputReceipts=[...new Map(receipts.map(b=>[b.path,b])).values()];
  const payload={schemaVersion:"ai-painter-endpoint-ab-request-v1",mode:"bounded_paired_endpoint_training",
    sourceCurrent,sourceSampling,sourceResult,sourcePackage,parentCheckpoint,selectedRows:modelPackage.selectedRows,
    training:TRAINING,resources:RESOURCES,inputReceipts,
    expectedPreviousRevision:current.registry.registryRevision,expectedPreviousSha256:current.registrySha256,
    latestTrainingRunId:current.registry.latestTrainingTerminal.runId,
    boundaries:{originalTargetsOnly:true,holdoutAccess:false,defaultModelChanged:false,automaticRetries:0,
      frozen:["Autoencoder","five_RGB_heads","normalization","23_conditions","original_data","default_configuration"],
      candidateLoss:"100_old_full_single_step_plus_100_existing_11_RGB_terms_at_target_free_endpoint",
      controlLoss:"200_old_full_single_step",equalUpdatesNotEqualCompute:true,
      evaluation:"all_six_existing_seeds_ten_complete_steps_all_five_regions_no_selection",
      scope:"isolated_256x192_train_only_learning_experiment_not_Stage4_qualification"}};
  const identity="painter-endpoint-ab-"+sha(bytes(payload));
  const outputRoot=`.runtime/ai-painter/learning-capacity-experiments/${identity}`;
  fs.mkdirSync(projectFile(root,outputRoot),{recursive:false});
  const request=persist(root,`${outputRoot}/experiment-request.json`,{...payload,identity,outputRoot});
  return materializeAutonomousClosedLoopPackage({schemaVersion:"ai-painter-autonomous-closed-loop-candidate-v1",
    packageIdentity:identity,capabilityVersion:identity,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot,
    programFiles:{adapter:ADAPTER,worker:WORKER,...ownedPrograms()},inputEvidencePaths:[request.path,...inputReceipts.map(b=>b.path)],
    phaseAdapters:Object.fromEntries(PHASES.map(p=>[p,{path:ADAPTER,exportName:p}]))},{root});
}

function environment(root,gpu=false){
  const env={...process.env,PYTHONIOENCODING:"utf-8",PYTHONUNBUFFERED:"1",PYTHONDONTWRITEBYTECODE:"1",
    CUBLAS_WORKSPACE_CONFIG:":4096:8",PYTHONPATH:[path.join(root,"ml/ai-painter/src"),path.join(root,"ml/ai-painter/scripts")].join(path.delimiter)};
  if(!gpu)env.CUDA_VISIBLE_DEVICES="";
  return env;
}
const python=root=>projectFile(root,"ml/ai-painter/.venv/Scripts/python.exe");
async function processResult(root,executable,args,timeout){
  return runOwnedWorker(executable,args,{cwd:root,timeout,maxBuffer:8*1024*1024,env:environment(root)});
}
function runGpuWorker(root,args,timeout,abortReason){
  return runOwnedWorker(python(root),args,{cwd:root,timeout,maxBuffer:8*1024*1024,env:environment(root,true),abortReason});
}
function remaining(context){
  const start=boundJson(context.projectRoot,bind(context.projectRoot,`${context.outputRoot}/started.json`));
  const elapsed=Date.now()-Date.parse(start.startedAtUtc);
  assert(Number.isFinite(elapsed)&&elapsed>=0);const remaining=RESOURCES.maxWallSeconds*1000-elapsed;
  assert(remaining>0,"bounded run wall-time exceeded");
  const folder=projectFile(context.projectRoot,context.outputRoot);
  const size=fs.readdirSync(folder,{withFileTypes:true}).filter(e=>e.isFile()).reduce((s,e)=>s+fs.statSync(path.join(folder,e.name)).size,0);
  assert(size<RESOURCES.maxOutputMiB*2**20,"bounded run output limit");return remaining;
}
async function register(context,request,evidence,begin){
  const root=context.projectRoot,current=await readCurrentExecutionRegistry(root);assert(current.ok);
  assert.equal(current.registry.latestTrainingTerminal.runId,request.latestTrainingRunId);
  let activeExecution=null;
  if(begin){
    validateLaunchSnapshot(request,current);
    const probe=await processResult(root,path.join(process.env.SystemRoot??"C:/Windows","System32/WindowsPowerShell/v1.0/powershell.exe"),["-NoProfile","-NonInteractive","-Command",
      `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${process.pid}'; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`],10000);
    const identity={capabilityVersion:request.identity,packageId:request.identity,runId:request.identity,
      processId:process.pid,processStartIdentity:probe.stdout.trim()};
    const lock=persist(root,`${context.outputRoot}/execution-lock.json`,{schemaVersion:"ai-painter-current-active-execution-lock-v1",...identity});
    persist(root,`${context.outputRoot}/heartbeat.json`,{schemaVersion:"ai-painter-current-active-execution-heartbeat-v1",...identity,
      executionState:"executing",heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
    activeExecution={schemaVersion:"ai-painter-current-active-execution-v1",...identity,executionState:"executing",
      programLineage:{adapter:bind(root,ADAPTER),worker:bind(root,WORKER)},lock,heartbeat:{path:`${context.outputRoot}/heartbeat.json`,ttlSeconds:120}};
  }else{
    assert.equal(current.registry.runId,request.identity);assert.equal(current.registry.activeExecution?.processId,process.pid);
  }
  const value=boundJson(root,evidence);
  const capsule=persist(root,`${context.outputRoot}/${begin?"begin":"finish"}-capsule.json`,{
    schemaVersion:"ai-painter-local-task-capsule-v1",taskId:request.identity,integrity:{status:"verified"},
    evidence:[bind(root,`${context.outputRoot}/experiment-request.json`),evidence].map((b,i)=>({...b,kind:`endpoint_ab_${i}`,sha256Verified:true}))});
  const dispatched=fs.existsSync(projectFile(root,`${context.outputRoot}/worker-dispatch.json`));
  const latestTrainingTerminal=!begin&&dispatched&&!gpuOnly(request)?{runId:request.identity,...evidence,status:value.status}:null;
  const prepared=await prepareCurrentExecutionRegistryAdvance({projectRoot:root,capabilityVersion:request.identity,packageId:request.identity,
    taskId:request.identity,runId:request.identity,taskKind:gpuOnly(request)?"bounded_phase4_gpu_recheck":"bounded_endpoint_ab_experiment",
    taskGoal:gpuOnly(request)?"One zero-update GPU admission recheck; optimizer and training forbidden":"One 400-update paired 256x192 endpoint experiment; no production model selection or formal qualification",
    queueStatus:begin?"running":value.executionState,nextMachineAction:null,lifecycleStage:"isolated_implementation",
    executionState:begin?"executing":value.executionState,activity:begin?"endpoint_ab_running":value.status,
    taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,activeExecution,latestTrainingTerminal,
    expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256});
  const done=await retryTransientIo(()=>finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:root,transactionId:prepared.transactionId}));
  assert(done.ok);persist(root,`${context.outputRoot}/registry-${begin?"begin":"finish"}-receipt.json`,{
    revision:done.registry.registryRevision,sha256:done.registrySha256,transactionId:prepared.transactionId});
}
async function heartbeat(context){
  await retryTransientIo(()=>context.heartbeat());
  const target=projectFile(context.projectRoot,`${context.outputRoot}/heartbeat.json`);
  if(!fs.existsSync(target))return;
  const value=JSON.parse(fs.readFileSync(target));assert.equal(value.processId,process.pid);
  value.heartbeatAtUtc=new Date().toISOString();fs.writeFileSync(target+".staged",bytes(value));
  await retryTransientIo(()=>fs.renameSync(target+".staged",target));
  const progressFile=projectFile(context.projectRoot,`${context.outputRoot}/training-progress.json`);
  if(fs.existsSync(progressFile)){
    const progress=JSON.parse(fs.readFileSync(progressFile));
    assert.equal(progress.runId,context.packageIdentity);
    context.reportProgress({message:`Endpoint A/B: ${progress.phase}; ${progress.optimizerSteps}/400 confirmed updates`,
      optimizerStep:progress.optimizerSteps});
  }
}
export function failureFacts({dispatched,progress=null,result=null}){
  if(result)return {gpuStarted:result.gpuStarted,trainingStarted:result.trainingStarted,optimizerSteps:result.optimizerSteps,
    stepInFlight:result.stepInFlight,finalStepCountKnown:result.finalStepCountKnown};
  if(!dispatched)return {gpuStarted:false,trainingStarted:false,optimizerSteps:0,stepInFlight:false,finalStepCountKnown:true};
  return {gpuStarted:progress?.gpuStarted===true?true:null,trainingStarted:progress?.trainingStarted===true?true:null,
    optimizerSteps:progress?.optimizerSteps??0,stepInFlight:progress?.stepInFlight??null,finalStepCountKnown:false};
}
async function phase(context,operation){
  let request, heartbeatError=null, pending=null;
  const timer=setInterval(()=>{
    if(pending)return;pending=heartbeat(context).then(()=>remaining(context)).catch(e=>{heartbeatError=e;}).finally(()=>{pending=null;});
  },5000);
  try{
    ({request}=requestOf(context));verifyBindings(context.projectRoot,request.inputReceipts);
    if(context.phase==="preflight")persist(context.projectRoot,`${context.outputRoot}/started.json`,{runId:request.identity,startedAtUtc:new Date().toISOString()});
    remaining(context);await heartbeat(context);
    const result=await operation(request,()=>heartbeatError);
    if(pending)await pending;
    if(context.phase!=="finalize"){remaining(context);verifyBindings(context.projectRoot,request.inputReceipts);}
    if(heartbeatError)throw heartbeatError;
    return result;
  }catch(error){
    const root=context.projectRoot;
    const readOptional=name=>{
      const target=projectFile(root,`${context.outputRoot}/${name}`);if(!fs.existsSync(target))return null;
      const v=JSON.parse(fs.readFileSync(target));assert.equal(v.runId,context.packageIdentity);return v;
    };
    const raw=readOptional(request&&gpuOnly(request)?"gpu-qualification-result.json":"result.json"), progress=readOptional("training-progress.json");
    const dispatched=fs.existsSync(projectFile(root,`${context.outputRoot}/worker-dispatch.json`));
    const artifact=persist(root,`${context.outputRoot}/failure-${context.phase}.json`,{
      schemaVersion:"ai-painter-endpoint-ab-failure-v1",runId:context.packageIdentity,status:"endpoint_ab_failed_closed",
      executionState:"failed_closed",phase:context.phase,error:String(error.stack??error),
      ownedProcess: error.ownedReceipt ?? null,
      ...failureFacts({dispatched,progress,result:raw}),workerResult:raw?bind(root,`${context.outputRoot}/result.json`):null,
      formalQualificationAllowed:false,recordedAtUtc:new Date().toISOString()});
    const current=await readCurrentExecutionRegistry(root);
    if(error.ownedReceipt?.cleanupConfirmed!==false&&request&&current.ok&&current.registry.runId===request.identity&&current.registry.activeExecution?.processId===process.pid)
      await register(context,request,artifact,false);
    return {status:"failed",failureKind:"evidence",failureCode:"endpoint_ab_failed_closed",artifact};
  }finally{clearInterval(timer);if(pending)await pending;}
}
export const preflight=context=>phase(context,async request=>{
  const nodeTests=await processResult(context.projectRoot,process.execPath,["--test",NODE_TEST],Math.min(60000,remaining(context)));
  const pythonTests=await processResult(context.projectRoot,python(context.projectRoot),["-m","unittest","discover",
    "-s","ml/ai-painter/tests","-p",path.basename(PY_TEST),"-v"],Math.min(60000,remaining(context)));
  let cpuProbe=null;
  if(request.schemaVersion==="ai-painter-endpoint-ab-request-v4"){
    const b=requestOf(context).binding;
    const raw=await processResult(context.projectRoot,python(context.projectRoot),[WORKER,"--request",b.path,"--request-sha256",b.sha256,"--cpu-probe-only"],Math.min(180000,remaining(context)));
    cpuProbe=JSON.parse(raw.stdout);assert.equal(cpuProbe.status,"cpu_phase4_probe_passed");
    assert.equal(cpuProbe.optimizerSteps,0);assert.equal(cpuProbe.gpuStarted,false);assert.equal(cpuProbe.probes.length,4);
  }
  const artifact=persist(context.projectRoot,phasePath(context,"preflight"),{status:"endpoint_ab_preflight_passed",executionState:"completed",nodeTests,pythonTests,cpuProbe});
  await register(context,request,artifact,true);return {status:"passed",artifact};
});
export const execute=context=>phase(context,async(request,abortReason)=>{
  const {binding}=requestOf(context);
  persist(context.projectRoot,`${context.outputRoot}/worker-dispatch.json`,{runId:request.identity,dispatchedAtUtc:new Date().toISOString(),automaticRetries:0});
  const raw=await runGpuWorker(context.projectRoot,[WORKER,"--request",binding.path,"--request-sha256",binding.sha256,...(gpuOnly(request)?["--probe-only"]:[])],
    Math.min(RESOURCES.maxWallSeconds*1000,remaining(context)),abortReason);
  const result=JSON.parse(raw.stdout), resultBinding=bind(context.projectRoot,`${context.outputRoot}/${gpuOnly(request)?"gpu-qualification-result.json":"result.json"}`);
  assert.deepEqual(result,boundJson(context.projectRoot,resultBinding));
  assert.equal(result.executionState,"completed",result.error??"worker failed");
  return {status:"passed",artifact:persist(context.projectRoot,phasePath(context,"execute"),{result:resultBinding,stderr:raw.stderr,ownedProcess:raw.ownedReceipt})};
});

const finite=v=>{assert(typeof v==="number"&&Number.isFinite(v)&&v>=0,"invalid metric");return v;};
const metric=(m,k)=>finite(REGIONS.includes(k)?m.semanticRegions[k].rgbMae:m.final[k]);
function compareRows(left,right){
  return Object.fromEntries(METRICS.map(k=>{
    const delta=left.map((r,i)=>metric(right[i],k)-metric(r,k));
    const reduction=left.map((r,i)=>metric(r,k)>0?(metric(r,k)-metric(right[i],k))/metric(r,k)*100:null);
    return [k,{improvedCount:delta.filter(d=>d<0).length,worseCount:delta.filter(d=>d>0).length,equalCount:delta.filter(d=>d===0).length,
      absoluteChangeRange:[Math.min(...delta),Math.max(...delta)],
      relativeReductionPercentRange:reduction.every(v=>v!==null)?[Math.min(...reduction),Math.max(...reduction)]:null}];
  }));
}
export function summarize(result,sampled,request,ledgers){
  const version=request.schemaVersion?.split("-").at(-1)??"v1",modern=version!=="v1";
  if(modern)validateRequestStrategy(request);
  assert.equal(result.schemaVersion,`ai-painter-endpoint-ab-result-${version}`);assert.equal(result.runId,request.identity);
  assert.equal(result.status,"endpoint_ab_completed_not_visual_qualified");assert.equal(result.executionState,"completed");
  assert.deepEqual(result.parentCheckpoint,request.parentCheckpoint);assert.deepEqual(result.training,TRAININGS[version]);assert.deepEqual(result.resources,RESOURCES);
  for(const [k,v] of Object.entries({gpuStarted:true,trainingStarted:true,optimizerSteps:400,stepInFlight:false,
    finalStepCountKnown:true,checkpointReloadExact:true,formalQualificationAllowed:false,checkpointSelected:false,worldEntryAllowed:false}))assert.equal(result[k],v,k);
  assert(finite(result.gpuSeconds)<600);assert(finite(result.elapsedSeconds)<900);
  assert.equal(result.numericRuntime.strictDeterministicBackward,false);assert.equal(result.numericRuntime.cudnnDeterministic,true);
  assert.equal(result.gpuProbes.length,4);
  const sampleIds=request.selectedRows.map(r=>r.sampleId);
  assert.equal(sampleIds.length,2);assert(request.selectedRows.every(r=>r.split==="train"));
  const modes=version==="v4"?["full_plus_endpoint","full_plus_endpoint_phase4"]:["single_step",modern?"full_plus_endpoint":"endpoint_rgb"];
  assert.deepEqual(result.gpuProbes.map(p=>[p.route,p.sampleId]),modes.flatMap(r=>sampleIds.map(s=>[r,s])));
  for(const p of result.gpuProbes){assert.equal(p.optimizerCreated,false);assert.equal(p.modelStateUnchanged,true);
    assert.equal(p.baseOutputReached,true);assert(finite(p.gradientL2)>0);assert.equal(p.frozenGradientCount,0);
    if(version==="v4"&&p.route==="full_plus_endpoint_phase4")assert(finite(p.phase4GradientL2)>0);}
  assert.deepEqual(result.arms.map(a=>a.arm),ARMS);
  for(const key of ["initialDenoiserStateSha256","frozenStateSha256","trainingInputStateSha256"]){
    assert(/^[a-f0-9]{64}$/.test(result.arms[0][key]));assert.equal(result.arms[0][key],result.arms[1][key]);}
  for(let a=0;a<2;a++){
    const arm=result.arms[a],{ledger,records}=ledgers[a];assert.equal(arm.optimizerSteps,200);
    assert.equal(arm.frozenStateUnchanged,true);assert.equal(arm.checkpointReloadExact,true);
    assert.notEqual(arm.denoiserStateSha256,arm.initialDenoiserStateSha256);
    assert.equal(arm.checkpoint.path,`${request.outputRoot}/${ARMS[a]}.pt`);
    assert.equal(ledger.schemaVersion,"ai-painter-train-split-step-evidence-v1");
    assert.equal(ledger.optimizerSteps,200);assert.equal(ledger.nonTrainOptimizerSteps,0);assert.equal(ledger.rejectedOptimizerStepAttempts,0);
    assert.equal(ledger.steps.length,200);assert.equal(records.length,200);
    for(let n=0;n<200;n++){
      const r=records[n],s=ledger.steps[n],epoch=Math.floor(n/2),i=n%2;
      assert.equal(r.optimizerStep,n+1);assert.equal(r.epoch,epoch);assert.equal(r.sampleId,sampleIds[i]);
      assert.equal(r.seed,20260909+n);assert.equal(r.route,expectedEndpointRoute(version,ARMS[a],epoch));
      if(modern){
        assert.equal(r.fullObjectiveTerms,18);assert.equal(r.endpointObjectiveTerms,r.route.startsWith("full_plus_endpoint")?11:0);
        if(version==="v4"){
          assert.equal(r.phase4ObjectiveTerms,r.route==="full_plus_endpoint_phase4"?1:0);
          if(r.phase4ObjectiveTerms){
            assert.equal(r.phase4Coefficient,1);
            const added=finite(r.existingEndpointObjectiveValue)+finite(r.phase4Loss);
            assert(Math.abs(finite(r.endpointObjectiveValue)-added)<=1e-6*Math.max(1,added),"phase4 objective mismatch");
          }else assert(!("phase4Loss" in r),"phase4 present in control or unscheduled update");
        }
        if(r.route.startsWith("full_plus_endpoint")){
          assert.equal(r.endpointNoiseSha256,r.noiseSha256);
          const sum=finite(r.fullObjectiveValue)+finite(r.endpointObjectiveValue);
          assert(Math.abs(finite(r.loss)-sum)<=1e-6*Math.max(1,sum),"combined objective mismatch");
        }
      }
      if(r.route==="endpoint_rgb")assert.equal(r.teacherTimestep,null);
      else assert(Number.isInteger(r.teacherTimestep)&&r.teacherTimestep>=0&&r.teacherTimestep<1000);
      assert(/^[a-f0-9]{64}$/.test(r.noiseSha256));finite(r.loss);
      assert.equal(s.optimizerStep,n+1);assert.equal(s.split,"train");assert.equal(s.datasetReleaseIdentity,request.identity);
      assert.deepEqual(s.sampleIds,[sampleIds[i]]);assert(/^[a-f0-9]{64}$/.test(s.datasetSelectionSha256));
      if(a===1){assert.equal(r.noiseSha256,ledgers[0].records[n].noiseSha256);
        if(modern||r.route==="single_step")assert.equal(r.teacherTimestep,ledgers[0].records[n].teacherTimestep);}
    }
  }
  const expected=sampled.rows.filter(r=>r.arm===PARENT&&r.steps===10);assert.equal(expected.length,6);
  assert.equal(result.parentReplay.length,6);assert.equal(result.rows.length,12);
  for(let n=0;n<18;n++){
    const r=n<6?result.parentReplay[n]:result.rows[n-6],e=expected[n%6];
    assert.equal(r.arm,n<6?PARENT:ARMS[Math.floor((n-6)/6)]);
    assert.deepEqual([r.sampleId,r.seed],[e.sampleId,e.seed]);assert.equal(r.split,"train");
    assert.equal(r.steps,10);assert.equal(r.fullEndpoint,true);assert.equal(r.targetUsedForInitialization,false);
    assert.equal(r.noiseStateSha256,e.noiseStateSha256);assert.deepEqual(r.baseline,e.measurements);assert.deepEqual(r.baselineImage,e.image);
    if(n<6){assert.deepEqual(r.measurements,e.measurements);assert.deepEqual(r.image,e.image);}
    else assert.equal(r.image.path,`${request.outputRoot}/${r.arm}-${Math.floor((n%6)/3)}-${n%3}.png`);
    METRICS.forEach(k=>metric(r.measurements,k));
  }
  const parent=expected.map(r=>r.measurements),control=result.rows.slice(0,6).map(r=>r.measurements),candidate=result.rows.slice(6).map(r=>r.measurements);
  return {optimizerSteps:400,zeroUpdateProbes:4,exactParentReplays:6,comparisonRows:12,
    controlVersusParent:compareRows(parent,control),candidateVersusParent:compareRows(parent,candidate),
    candidateVersusControl:compareRows(control,candidate),checkpointSelected:false,formalVisualQualification:false};
}
export const validate=context=>phase(context,async request=>{
  const binding=loadPhase(context,"execute").result,result=boundJson(context.projectRoot,binding);
  if(gpuOnly(request))return {status:"passed",artifact:persist(context.projectRoot,phasePath(context,"validate"),{
    summary:validateGpuRecheckResult(result,request,requestOf(context).binding),result:binding})};
  assert.equal(result.inputBindingsReverified,request.inputReceipts.length);
  const ledgers=result.arms.map(a=>boundJson(context.projectRoot,a.stepEvidence));
  verifyBindings(context.projectRoot,[...result.arms.map(a=>a.checkpoint),...result.rows.map(r=>r.image)]);
  const summary=summarize(result,boundJson(context.projectRoot,request.sourceSampling).replay,request,ledgers);
  const requestBinding=requestOf(context).binding;
  const replayProcess=await processResult(context.projectRoot,python(context.projectRoot),[WORKER,"--request",requestBinding.path,
    "--request-sha256",requestBinding.sha256,"--verify-result"],Math.min(150000,remaining(context)));
  const replay=JSON.parse(replayProcess.stdout);assert.deepEqual(replay.result,binding);
  assert.equal(replay.exactRows,12);assert.equal(replay.exactPngs,12);assert.equal(replay.optimizerSteps,0);assert.equal(replay.cudaInitialized,false);
  return {status:"passed",artifact:persist(context.projectRoot,phasePath(context,"validate"),{summary,replay,ownedProcess:replayProcess.ownedReceipt})};
});
export function validateGpuRecheckResult(result,request,binding){
  assert(gpuOnly(request));assert.deepEqual(result.request,binding);
  assert.equal(result.runId,request.identity);assert.equal(result.executionState,"completed");
  assert.equal(result.schemaVersion,"ai-painter-endpoint-ab-gpu-qualification-v4");
  assert.equal(result.status,"endpoint_ab_v4_zero_update_gpu_qualified");
  assert.equal(result.optimizerCreated,false);assert.equal(result.optimizerSteps,0);assert.equal(result.trainingStarted,false);
  assert.equal(result.gpuStarted,true);assert.equal(result.stepInFlight,false);assert.equal(result.finalStepCountKnown,true);
  assert.equal(result.formalQualificationAllowed,false);assert.deepEqual(result.training,TRAINING_V4);assert.deepEqual(result.resources,RESOURCES);
  assert.deepEqual(result.parentCheckpoint,request.parentCheckpoint);assert.deepEqual(result.arms,[]);
  assert(finite(result.gpuSeconds)<600);assert(finite(result.elapsedSeconds)<900);
  const expected=["full_plus_endpoint","full_plus_endpoint_phase4"].flatMap(route=>request.selectedRows.map(r=>[route,r.sampleId]));
  assert.deepEqual(result.gpuProbes.map(p=>[p.route,p.sampleId]),expected);
  for(const p of result.gpuProbes){assert.equal(p.optimizerCreated,false);assert.equal(p.modelStateUnchanged,true);
    assert.equal(p.baseOutputReached,true);assert.equal(p.frozenGradientCount,0);assert(finite(p.gradientL2)>0);
    if(p.route==="full_plus_endpoint_phase4")assert(finite(p.phase4GradientL2)>0);}
  return {zeroUpdateProbes:4,optimizerSteps:0,gpuCheckPassed:true,formalVisualQualification:false,
    peakAllocatedMiB:finite(result.peakAllocatedMiB),peakReservedMiB:finite(result.peakReservedMiB)};
}
export const review=context=>phase(context,async request=>{
  const validation=loadPhase(context,"validate");
  return {status:"passed",artifact:persist(context.projectRoot,phasePath(context,"review"),{...validation,
    scope:gpuOnly(request)?"gpu_zero_update_admission_not_training":"train_only_paired_metrics_not_VJ2",visualQualification:"not_assessed",
    limitations:["Two historically used training originals; no unseen-data generalization claim.",
      "Equal updates, not equal compute; current experimental control parent only.",
      "Changing the supervised rollout is not proof of a unique noise cause.",
      "No checkpoint selection, release, Runtime entry, Stage4 advancement or automatic extra training."]})};
});
export function decide(summary,evidence){
  assert.equal(summary.optimizerSteps,400);assert.equal(summary.comparisonRows,12);assert.equal(summary.formalVisualQualification,false);
  const comparisons=[...Object.values(summary.candidateVersusControl),...Object.values(summary.candidateVersusParent)];
  const improved=comparisons.every(v=>v.worseCount===0)&&comparisons.some(v=>v.improvedCount>0);
  const option=improved?"candidate_train_metrics_improved":"mixed_or_regressed_train_metrics";
  return {...adjudicateBoundedDecision({decisionSetId:"bounded_endpoint_ab",ruleVersion:"all_six_nine_metrics_no_selection_v1",
    optionIds:["candidate_train_metrics_improved","mixed_or_regressed_train_metrics"],matchedOptionIds:[option],
    evidenceReferences:[evidence],evidenceComplete:true}),applied:false,nextMachineAction:null,
    checkpointSelected:false,formalQualificationAllowed:false,automaticRetrainingAllowed:false};
}
export const adjudicate=context=>phase(context,async request=>{
  const reviewed=loadPhase(context,"review");
  if(gpuOnly(request))return {status:"passed",artifact:persist(context.projectRoot,phasePath(context,"adjudicate"),{
    status:"gpu_recheck_complete_no_training_dispatch",applied:false,nextMachineAction:null,
    checkpointSelected:false,formalQualificationAllowed:false,automaticRetrainingAllowed:false})};
  return {status:"passed",artifact:persist(context.projectRoot,phasePath(context,"adjudicate"),
    decide(reviewed.summary,bind(context.projectRoot,phasePath(context,"review"))))};
});
export const finalize=context=>phase(context,async request=>{
  const decision=loadPhase(context,"adjudicate"),reviewed=loadPhase(context,"review"),execution=loadPhase(context,"execute");
  const result=boundJson(context.projectRoot,execution.result);
  const artifact=persist(context.projectRoot,phasePath(context,"finalize"),{
    schemaVersion:gpuOnly(request)?"ai-painter-phase4-gpu-recheck-terminal-v1":`ai-painter-endpoint-ab-terminal-${request.schemaVersion.split("-").at(-1)}`,runId:request.identity,
    status:gpuOnly(request)?"gpu_recheck_completed_no_training":"endpoint_ab_completed_not_visual_qualified",executionState:"completed",workerResult:execution.result,
    sourceCurrent:request.sourceCurrent,parentCheckpoint:request.parentCheckpoint,summary:reviewed.summary,decision,
    ...failureFacts({dispatched:true,result}),evidence:PHASES.slice(0,-1).map(p=>bind(context.projectRoot,phasePath(context,p))),
    formalQualificationAllowed:false,checkpointSelected:false,worldEntryAllowed:false,
    migrationStatus:"bounded_local_execution_validated_not_production_cutover",recordedAtUtc:new Date().toISOString()});
  verifyBindings(context.projectRoot,request.inputReceipts);remaining(context);
  await register(context,request,artifact,false);return {status:"passed",artifact};
});
