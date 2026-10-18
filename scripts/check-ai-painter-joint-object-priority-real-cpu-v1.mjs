// One managed CPU observation of the joint rule; no production routing or training.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs';
import {collectActualExecutionSources} from './lib/ai-painter-execution-source-closure-v1.mjs';
import {runParameter60OwnedWorker} from './lib/ai-painter-parameter60-owned-worker-v1.mjs';
import {createOwnedAccounting,proofPassed} from './diagnose-ai-painter-parameter88-causal-gpu-v1.mjs';
import {readCurrentExecutionRegistry} from '../src/server/ai-painter-current-execution-registry.mjs';

const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),'..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const CANDIDATE='stage4_mvp256_dry_joint_object_priority_real_cpu_v1';
export const UPDATE_RULE='stage4_mvp256_dry_joint_object_priority_cpu_v1';
export const POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-joint-object-priority-real-cpu-policy-v1.json',sha256:'91fae3af9d0b954569d3dc6255d462966b199e0df371a172d1cec99ce4408fc6'});
export const RESOURCES=Object.freeze({maxWallSeconds:240,maxManagedWorkerSeconds:180,threads:2,cpuAffinityMaximum:2,maxOutputBytes:8388608,maxStreamBytes:8388608,maxJsonBytes:1048576,failureReserveBytes:65536,cleanupReserveMs:1000,finalizationReserveMs:8000,attempts:1,automaticRetries:0});
export const QUALIFICATION=Object.freeze({gpuExecutionAllowed:false,trainingAllowed:false,checkpointWritten:false,stage4Qualified:false,capabilityReleased:false,runtimeFrameAllowed:false});
export const CALLS=Object.freeze({generatorForwards:1,generatorForwardCompleted:1,trainSampleDecodeAttempts:1,decodedTrainSamples:1,autogradCalls:5,backwardCalls:0,optimizerConstruction:0,optimizerSteps:0,checkpointLoads:0,cudaInitializationAttempts:0});
const LABELS=['actualTotal','structuredObjective','wholeFrameFidelity','objectCoreRgb','objectSupportStructure'];
const OUTPUT='.runtime/ai-painter/joint-object-priority-real-cpu-checks';
const CLAIM=OUTPUT+'/attempt-v1.json';

export function validatePolicy(p){
  assert.equal(p.schemaVersion,'ai-painter-joint-object-priority-real-cpu-policy-v1');
  assert.equal(p.candidateId,CANDIDATE);
  assert.equal(p.status,'registered_once_real_model_cpu_verification_only');
  assert.deepEqual(p.implementation,{entrypoint:'scripts/check-ai-painter-joint-object-priority-real-cpu-v1.mjs',worker:'ml/ai-painter/scripts/check_joint_object_priority_real_cpu_v1.py',profile:'ml/ai-painter/scripts/painter_stage4_joint_object_priority_training_profile_cpu_v1.py',pythonTests:'ml/ai-painter/tests/test_joint_object_priority_real_cpu_v1.py',nodeTests:'scripts/tests/ai-painter-joint-object-priority-real-cpu-v1.test.mjs'});
  assert.deepEqual(p.resources,RESOURCES);assert.deepEqual(p.qualification,QUALIFICATION);
  assert.equal(p.outputRoot,OUTPUT);assert.equal(p.attemptClaimPath,CLAIM);
  assert.deepEqual(p.formalSpecification,{path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',version:'AI-PAINTER-SPEC-1.81',sha256:'402f473929627fbb6bd5c6d337c0697f4a35b7e8d0a821b838509f1315c73b7f'});
  assert.equal(p.updateRule.candidateId,UPDATE_RULE);
  assert.equal(p.updateRule.implementation.sha256,'99c437fe1cdf31229257c25716736e3c2f580a58f99fde8297c5e06611920324');
  assert.deepEqual(p.model,{capability:'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1',parameterTensors:108,parameterElements:2242687,objectHeadParameterTensors:16,objectHeadParameterElements:4876,initializationSeed:20260929,freshSourceInitializationOnly:true,checkpointLoading:false,forwardOrParameterGraphChanged:false});
  assert.deepEqual(p.limits,{decodedTrainSamples:1,generatorForwards:1,generatorAutogradCalls:5,discriminatorAutogradCalls:0,optimizerConstruction:0,optimizerUpdates:0,cudaCalls:0,checkpointLoads:0,imageOrCheckpointWrites:0});
  assert.deepEqual(p.data,{dataPlan:{path:'.runtime/ai-painter/final-rgb-base-weight-quality-executions/final-rgb-base-quality-v1-f13f9856-7aac-4d43-b7c9-51133cfed683/quality-plan.json',sha256:'4d96fb6239943620793b83bb63d1e17374b070650106323d17c11ab0690b482c'},planPurpose:'data_locator_only_no_permission_or_weights_inherited',selectedSampleId:'ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3',split:'train',sampleCount:1,resolution:[256,192],originalDataSplits:'48/8/4/4 unchanged',validationContentRead:false,challengeOrRegressionContentRead:false});
  assert.deepEqual(p.sourceClosure,{maxFiles:256,maxFileBytes:1048576,maxTotalBytes:16777216,scope:'actual_loaded_and_validation_source_closure_not_all_historical_roles',loadedModulesMustBeVerified:true});
  assert.deepEqual(p.registry,{path:'.runtime/ai-painter/current-execution-registry/current.json',writeAllowed:false,preserveLatestTrainingTerminal:true});
  assert.deepEqual(p.protocol.componentsInOrder,LABELS);
  assert.equal(p.protocol.atol,1e-6);assert.equal(p.protocol.rtol,1e-5);assert.equal(p.protocol.projectionRoundoffMultiplier,16);
  for(const key of ['singleSharedForwardGraph','originalLossAndWeightsUnchanged','originalOrderedScalarAndGradientSumKept','frozenCriticEvaluationOriginalLossOnly','all108OriginalGradientGates','nonHeadActualGradientIdentityPreserved','modelCriticStateGradUnchanged','rngUnchanged','actualCallsAndCompletedLabelsRequiredOnFailure'])assert.equal(p.protocol[key],true,key);
  assert.equal(p.protocol.failureRawGradientTensorSave,false);
  return true;
}

export function validateWorkerResult(v,p,request){
  assert.equal(v.schemaVersion,'joint-object-priority-real-cpu-worker-result-v1');
  assert.equal(v.status,'real_cpu_verified_inactive');assert.equal(v.executionState,'completed');
  assert.equal(v.runId,request.runId);assert.equal(v.candidateId,CANDIDATE);assert.deepEqual(v.policy,POLICY);
  assert.deepEqual(v.actualCalls,CALLS);
  for(const key of ['gpuInitialized','weightsModified','trainingStarted','imageOrCheckpointWritten','validationRgbRead','challengeContentRead','regressionContentRead'])assert.equal(v[key],false,key);
  assert.equal(v.rngUnchanged,true);
  for(const [a,b] of [['modelStateBefore','modelStateAfter'],['criticStateBefore','criticStateAfter']]){
    assert.match(v[a],/^[a-f0-9]{64}$/u);assert.equal(v[a],v[b],a);
  }
  assert.equal(v.probe.passed,true);assert.equal(v.probe.candidateId,CANDIDATE);
  const g=v.probe.fiveGradientFacts;
  assert.equal(g.candidateId,UPDATE_RULE);assert.equal(g.modelCapabilityVersion,p.model.capability);
  assert.equal(g.actualTotalProvenanceVerified,true);assert.equal(g.actualTotalIndependentFullModelGradient,true);
  assert.equal(g.autogradGradCalls,5);assert.deepEqual(g.componentsInOrder,LABELS);
  assert.deepEqual(g.independentFullParameterGradientTensorCounts,[108,108,108,108,108]);
  assert.equal(g.gradientIdentityAtol,1e-6);assert.equal(g.gradientIdentityRtol,1e-5);assert.equal(g.projectionRoundoffMultiplier,16);
  assert.equal(g.nonHeadActualTotalIdentityPreserved,true);assert.equal(g.nonConflictHeadActualTotalBytesPreserved,true);
  assert.equal(g.optimizerCreated,false);assert.equal(g.parametersUpdated,false);
  assert.deepEqual(g.parameterIdentity,{modelParameterTensorCount:108,modelParameterElementCount:2242687,objectHeadParameterTensorCount:16,objectHeadParameterElementCount:4876});
  assert.ok(Array.isArray(v.loadedSources?.projectSources)&&v.loadedSources.projectSources.length>0,'loaded project sources required');
  assert.equal(v.loadedSources.qualified,false,'source check does not grant qualification');
  assert.ok(Array.isArray(v.loadedSources.dynamicNamespaces),'provider identity checks required');
  const declared=new Set(Object.values(request.programBindings).map(b=>b.path));
  assert.equal(new Set(v.loadedSources.projectSources).size,v.loadedSources.projectSources.length,'duplicate loaded sources');
  for(const name of v.loadedSources.projectSources)assert(declared.has(name),'loaded source outside request closure: '+name);
  return true;
}

export function consumeAttempt(root,runId){
  assert.ok(/^joint-object-real-cpu-[a-f0-9-]{36}$/u.test(runId));
  const file=path.join(root,CLAIM);fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({schemaVersion:'joint-object-priority-real-cpu-claim-v1',runId,policy:POLICY,recordedAtUtc:new Date().toISOString(),automaticRetries:0})+'\n',{flag:'wx'});
  return file;
}

// Accounting only: this does not certify cleanup or recover an old guard.
export function accountReceiptScope(root,accounting,receipt){
  const guard=receipt?.guard,id=guard?.identity;
  if(!guard?.nativeEvidenceRoot||!guard?.startedEvidence)return null;
  assert.match(id,/^[a-f0-9-]{36}$/u);
  const base=path.join(root,'.runtime/ai-painter/owned-worker-guards');
  for(const [key,suffix] of [['nativeEvidenceRoot','-native'],['startedEvidence','-started.json'],['terminalEvidence','-terminal.json'],['terminalPath','-guard-terminal.json']])assert.equal(path.resolve(guard[key]),path.join(base,id+suffix));
  assert.equal(path.resolve(guard.path),path.join(base,'active.json'));
  const scope={guardRecord:{identity:id},nativeBuildDirectory:guard.nativeEvidenceRoot,guard,getStreamBytes:()=>receipt.streamBytes??{stdout:0,stderr:0}};
  accounting.observe(scope);return scope;
}

export function activeGuardBytes(scope){
  const file=scope?.guard?.path;
  if(!file||!fs.existsSync(file))return 0;
  const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=65536,'bounded active guard required');
  const raw=fs.readFileSync(file);assert.equal(JSON.parse(raw).identity,scope.guardRecord.identity,'active guard identity changed');
  return raw.length;
}

export function completeOutputBudget(value,{claimBytes=0,guardBytes=0,closingFailure=false}={}){
  assert(Number.isSafeInteger(claimBytes)&&claimBytes>=0&&Number.isSafeInteger(guardBytes)&&guardBytes>=0);
  const totalBytes=value.totalBytes+claimBytes+guardBytes;
  assert(totalBytes<=RESOURCES.maxOutputBytes-(closingFailure?0:RESOURCES.failureReserveBytes),'claim/guard-inclusive output ceiling');
  return {...value,claimBytes,guardBytes,totalBytes};
}

export function collectSourceClosure(root,reader,p){
  const required={nodeEntry:p.implementation.entrypoint,nodeTests:p.implementation.nodeTests,realCpuWorker:p.implementation.worker,realCpuProfile:p.implementation.profile,pythonTests:p.implementation.pythonTests,jointUpdateRule:p.updateRule.implementation.path,nativeOwnerSource:'scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs'};
  return collectActualExecutionSources({root,required,dynamicPaths:['scripts/lib/real-earth-region-governance.mjs'],python:path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),bind:logical=>{const bytes=reader.bytes(logical);return {path:logical,sha256:hash(bytes)};}});
}

export async function runCpu(root=ROOT){
  const began=Date.now(),deadline=began+240000,reader=createReader(root);
  const p=reader.bound(POLICY);validatePolicy(p);reader.bytes(p.formalSpecification.path,p.formalSpecification.sha256);
  for(const b of Object.values(p.updateRule))if(b&&typeof b==='object'&&b.path)reader.bytes(b.path,b.sha256);
  const before=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});
  assert(before.ok&&before.registry.activeExecution===null,'active/unknown execution refused');
  assert(!fs.existsSync(path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json')),'existing guard refused');
  assert(!fs.existsSync(path.join(root,CLAIM)),'real CPU attempt already consumed; no retry');
  const runId='joint-object-real-cpu-'+crypto.randomUUID(),logical=OUTPUT+'/'+runId,absolute=path.join(root,logical);
  fs.mkdirSync(absolute,{recursive:true});
  const accounting=createOwnedAccounting(root,absolute,p);
  let claimBytes=0,ownerScope=null,closingFailure=false;
  const completeBudget=()=>completeOutputBudget(accounting.requireBudget(),{claimBytes,guardBytes:activeGuardBytes(ownerScope),closingFailure});
  const put=(name,value,failure=false)=>{
    assert(/^[a-z0-9-]+\.json$/u.test(name));
    const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');assert(bytes.length<=p.resources.maxJsonBytes,'single JSON ceiling');
    assert(accounting.measure().totalBytes+claimBytes+activeGuardBytes(ownerScope)+bytes.length<=p.resources.maxOutputBytes-(failure?0:p.resources.failureReserveBytes),'complete output ceiling');
    fs.writeFileSync(path.join(absolute,name),bytes,{flag:'wx'});
    return {path:logical+'/'+name,sha256:hash(bytes),bytes:bytes.length};
  };
  let result=null,request=null,terminal=null,error=null,consumed=false;
  try{
    const programBindings=collectSourceClosure(root,reader,p);reader.bound(p.data.dataPlan);
    const python=path.join(root,'ml/ai-painter/.venv/Scripts/python.exe');
    const body={schemaVersion:'joint-object-priority-real-cpu-request-v1',runId,candidateId:CANDIDATE,policy:POLICY,dataPlan:p.data.dataPlan,programBindings,selectedSampleId:p.data.selectedSampleId,outputRoot:logical,registryBefore:{path:p.registry.path,sha256:before.registrySha256},interpreter:{path:python,sha256:hash(fs.readFileSync(python))},deadlineUnixMs:deadline-p.resources.finalizationReserveMs};
    request=put('request.json',body);reader.verifyStable();
    assert(deadline-Date.now()>p.resources.finalizationReserveMs+1000,'CPU preparation exhausted budget');
    claimBytes=fs.statSync(consumeAttempt(root,runId)).size;consumed=true;completeBudget();
    result=await runParameter60OwnedWorker(python,['-B',path.join(root,p.implementation.worker),'--request',request.path,'--request-sha256',request.sha256],{
      cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',PYTHONPATH:[path.join(root,'ml/ai-painter/src'),path.join(root,'ml/ai-painter/scripts')].join(path.delimiter)},
      timeout:Math.min(180000,deadline-Date.now()-p.resources.finalizationReserveMs),maxBuffer:8388608,onSpawn:value=>{ownerScope=value;accounting.observe(value);completeBudget();},
      abortReason:()=>{completeBudget();return Date.now()>=deadline-p.resources.finalizationReserveMs?'real CPU total deadline':null;}
    });
    assert(Buffer.byteLength(result.stdout)<=p.resources.maxJsonBytes,'worker JSON ceiling');
    const value=JSON.parse(result.stdout);const worker=put('worker-result.json',value);
    validateWorkerResult(value,p,body);proofPassed(result.ownedReceipt);reader.verifyStable();
    const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});
    assert(after.ok&&after.registrySha256===before.registrySha256,'production registry changed');
    assert(!fs.existsSync(path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json')),'guard not released');
    terminal=put('terminal.json',{schemaVersion:'joint-object-priority-real-cpu-terminal-v1',runId,candidateId:CANDIDATE,status:value.status,executionState:'completed',policy:POLICY,request,worker,ownedReceipt:result.ownedReceipt,registryBeforeSha256:before.registrySha256,registryAfterSha256:after.registrySha256,elapsedMs:Date.now()-began,outputAccounting:completeBudget(),qualification:QUALIFICATION,recordedAtUtc:new Date().toISOString()});
  }catch(first){
    error=first;closingFailure=true;accounting.beginFailureClosure();
    if(!ownerScope)try{ownerScope=accountReceiptScope(root,accounting,first.ownedReceipt);}catch(secondary){first.secondaryAccountingError=String(secondary.stack??secondary);}
    let workerFailure=null;
    try{const raw=String(first.stdout??result?.stdout??'');if(raw&&Buffer.byteLength(raw)<=p.resources.maxJsonBytes)workerFailure=put('worker-failure.json',JSON.parse(raw),true);}catch(secondary){first.secondaryWorkerEvidenceError=String(secondary.message??secondary);}
    try{terminal=put('failure.json',{schemaVersion:'joint-object-priority-real-cpu-terminal-v1',runId,candidateId:CANDIDATE,status:'real_cpu_failed_closed',executionState:'failed_closed',policy:POLICY,request,workerFailure,attemptConsumed:consumed,error:String(first.stack??first).slice(0,16384),stdout:String(first.stdout??result?.stdout??'').slice(0,32768),stderr:String(first.stderr??result?.stderr??'').slice(0,32768),ownedReceipt:first.ownedReceipt??result?.ownedReceipt??null,qualification:QUALIFICATION,recordedAtUtc:new Date().toISOString()},true);}catch(secondary){first.secondaryEvidenceError=String(secondary.stack??secondary);}
    first.evidence=terminal;
  }
  try{completeBudget();assert(Date.now()<=deadline,'complete CPU wall budget exceeded');reader.verifyStable();const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(after.ok&&after.registrySha256===before.registrySha256,'production registry changed');}
  catch(secondary){
    closingFailure=true;accounting.beginFailureClosure();
    try{const failed=put('finalization-failure.json',{schemaVersion:'joint-object-priority-real-cpu-finalization-failure-v1',runId,priorObservation:terminal,status:'real_cpu_failed_closed',error:String(secondary.stack??secondary).slice(0,16384),qualification:QUALIFICATION,recordedAtUtc:new Date().toISOString()},true);if(!error)terminal=failed;}
    catch(persistence){secondary.secondaryPersistenceError=String(persistence.stack??persistence);}
    if(error)error.secondaryFinalizationError=String(secondary.stack??secondary);else{error=secondary;error.evidence=terminal;}
  }
  if(error)throw error;
  return terminal;
}

if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
  assert.equal(process.argv.length,2,'fixed CPU scope; no overrides');
  runCpu().then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(JSON.stringify({status:'real_cpu_failed_closed',error:e.message,evidence:e.evidence??null}));process.exitCode=1;});
}
