// Existing closed-loop six-phase exports. No separate service or fixture CLI.
import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {advanceCurrentExecutionRegistry,readCurrentExecutionRegistry} from '../src/server/ai-painter-current-execution-registry.mjs';
import {processIdentity} from './run-ai-painter-mvp256-dry-v24-training.mjs';
import {replaceHeartbeatFile} from './run-ai-painter-learning-capacity-experiment.mjs';
import {createPresentation,createActiveIdentity} from './lib/ai-painter-ecology-terrain-detail-quality-registration-v1.mjs';
import {runNative,cleanupForCurrentCall,hasLiveOwnedProof,validateNativeReceipt,withNativeOrdinaryBudget,withNativeReceiptBudget,persistNativeFailureEvidence,boundedNativeFailureMetadata,currentNativeFailureScope} from './lib/ai-painter-ecology-terrain-detail-quality-owned-native-v1.mjs';
import {nativeOwnerSourceIdentity} from './lib/ai-painter-ecology-decode1-native-owner-v2.mjs';
import {CAPABILITY,EXECUTION_PROFILE,inside,read,write,json,bind,loadContext,validateTerminal,withOutputBudget} from './lib/ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs';
import {fileURLToPath} from 'node:url';import path from 'node:path';
import {prepareCpuRequest,finalizeCpuAcceptance,preparePlan,makeInternalCandidate,ROLES,runtimeIdentity,finalProgramBindings} from './lib/ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs';
import {materializeAutonomousClosedLoopPackage} from './lib/ai-painter-autonomous-package-materializer-v1.mjs';

export function verifyGpuOutcome(ready,binding){
 const {root,plan,packageBinding}=ready,gate=json(root,binding);
 assert.equal(binding.path,plan.outputRoot+'/gpu-gate.json');assert.equal(gate.schema,'ecology-terrain-detail-weight-quality-all-train-gpu-gate-v1');
 assert.equal(gate.status,'passed');assert.equal(gate.capabilityVersion,CAPABILITY);assert.equal(gate.executionProfile,EXECUTION_PROFILE);
 assert.equal(gate.runId,plan.runId);assert.equal(gate.packageId,plan.packageId);assert.deepEqual(gate.executionPackage,packageBinding);
 assert.deepEqual(gate.programBindings,plan.programBindings);assert.deepEqual(gate.actualCounts,{forwardAttempted:48,forwardCompleted:48,generatorAttempted:192,generatorCompleted:192,discriminatorAttempted:48,discriminatorCompleted:48});
 assert.equal(gate.optimizerSteps,0);assert.equal(gate.checkpointLoaded,false);assert.equal(gate.checkpointWritten,false);
 assert.equal(gate.deviceIdentity?.ordinal,0);assert.match(gate.deviceIdentity.uuid,/^GPU-/u);
 for(const row of gate.cases){assert.deepEqual(row.proof.callCounts,{generatorForwards:1,generatorAutograd:4,discriminatorAutograd:1});assert.equal(row.proof.optimizerCreated,false);assert.equal(row.proof.optimizerUpdates,0);}
 assert.deepEqual(gate.cases.map(r=>r.sampleId),json(root,plan.trainSplit).sampleIds);assert.equal(gate.cases.length,48);assert.ok(gate.cases.every(r=>r.passed===true));
 assert.deepEqual(gate.initialState,gate.finalState);assert.deepEqual(gate.initialCpuState,json(root,plan.modelBinding).initialState);return gate;
}
// A stored receipt authorizes no cleanup. Recompute its complete call binding;
// the verified registry must still point to this same qualification terminal.
export function verifyStoredGpuAcceptance(ready,admissionBinding,registryResult,dependencies={}){
 const io={json,read,bind,inside,verifyGpuOutcome,nativeOwnerSourceIdentity,...dependencies},digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 const {root,plan,packageBinding}=ready;
 assert.equal(registryResult.ok,true);assert.equal(registryResult.registry.activeExecution,null);
 for(const key of ['capabilityVersion','runId','packageId'])assert.equal(registryResult.registry[key],plan[key]);
 const terminal=registryResult.currentTaskTerminal;
 assert.equal(terminal.schema,'ecology-terrain-detail-weight-quality-pretraining-terminal-v1');
 assert.equal(terminal.status,'qualification_completed_training_not_started');assert.equal(terminal.executionState,'completed');
 assert.equal(terminal.trainingStarted,false);assert.equal(terminal.optimizerStepsGenerator,0);assert.equal(terminal.optimizerStepsDiscriminator,0);
 assert.deepEqual(terminal.executionPackage,packageBinding);assert.deepEqual(terminal.gpuAcceptance,admissionBinding);
 assert.equal(admissionBinding.path,plan.outputRoot+'/gpu-acceptance.json');
 const admission=io.json(root,admissionBinding);assert.equal(admission.schema,'ecology-terrain-detail-weight-quality-owned-gpu-acceptance-v1');assert.equal(admission.status,'passed');
 assert.deepEqual(admission.executionPackage,packageBinding);assert.deepEqual(admission.programBindings,plan.programBindings);
 io.verifyGpuOutcome(ready,admission.report);
 const receipt=io.json(root,admission.ownedReceipt);
 assert.equal(receipt.schema,'detail-weight-live-native-owner-receipt-v1');assert.equal(receipt.stopReason,null);assert.equal(receipt.persistenceError,undefined);
 assert.equal(receipt.phase,'qualification');assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.processCleanupConfirmed,true);
 assert.equal(receipt.guard.state,'released_after_live_empty_job');assert.equal(receipt.proof.exitCode,0);
 assert.equal(receipt.budget.timeoutMs,600000);assert.equal(receipt.budget.outputBytes,16777216);
 assert.ok(receipt.outputAccountingRoots.includes(plan.outputRoot));
 const encoded=receipt.proof.bindingBase64;assert.equal(typeof encoded,'string');assert.ok(encoded.length<=65536);
 const namespace=digest(plan.outputRoot).slice(0,32),expectedNamespace=[namespace.slice(0,8),namespace.slice(8,12),namespace.slice(12,16),namespace.slice(16,20),namespace.slice(20)].join('-');
 assert.equal(receipt.guard.nativeEvidenceRoot,'.runtime/ai-painter/owned-worker-guards/'+expectedNamespace);
 const raw=Buffer.from(encoded,'base64');assert.equal(raw.toString('base64'),encoded);const descriptor=JSON.parse(raw);
 assert.equal(descriptor.scope,path.resolve(root));const guard=descriptor.guard;
 assert.equal(guard.identity,receipt.guard.identity);assert.deepEqual(guard.nativeOwnerSource,io.nativeOwnerSourceIdentity());
 assert.equal(guard.helperSha256,plan.programBindings.nativeRunner.sha256);
 assert.equal(path.resolve(guard.executable),path.resolve(plan.runtimeIdentity.python.absolutePath));assert.equal(guard.executableSha256,plan.runtimeIdentity.python.sha256);
 assert.equal(guard.commandSha256,digest(JSON.stringify(['-B',io.inside(root,plan.programBindings.gpuQualifier.path),'--package',packageBinding.path,'--sha256',packageBinding.sha256])));
 assert.equal(descriptor.guardSha256,digest(JSON.stringify(guard)));
 const startedPath=receipt.guard.nativeEvidenceRoot+'/'+guard.identity+'-started.json';assert.equal(guard.startedEvidence,io.inside(root,startedPath));
 const started=io.json(root,io.bind(root,startedPath));assert.deepEqual(started,{...guard,ownerPid:receipt.ownerIdentity.pid,commandBinding:encoded});
 assert.deepEqual(descriptor.nativeBuild,receipt.nativeBuild);
 const buildRoot=receipt.guard.nativeEvidenceRoot+'/'+guard.identity+'-native';
 for(const [name,file,shaKey]of [['snapshot','owner.cs',null],['binary','owner.exe','binarySha256']]){
  assert.equal(descriptor.nativeBuild[name],io.inside(root,buildRoot+'/'+file));
  assert.equal(digest(io.read(root,io.bind(root,buildRoot+'/'+file))),shaKey?descriptor.nativeBuild[shaKey]:guard.nativeOwnerSource.sha256);
 }
 assert.equal(validateNativeReceipt({proof:receipt.proof,ownerPid:receipt.ownerIdentity.pid,bindingBase64:encoded,ownerClosed:receipt.ownerClosed,
  protocolError:receipt.protocolError,stdoutBytes:receipt.streamBytes.stdout,stderrBytes:receipt.streamBytes.stderr}),true);
 return admission;
}
function verifyStoredPreflight(ready,preflightBinding,dependencies={}){
 const io={json,read,bind,inside,nativeOwnerSourceIdentity,...dependencies},digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),{root,plan,packageBinding}=ready;
 assert.equal(preflightBinding.path,plan.outputRoot+'/preflight.json');const body=io.json(root,preflightBinding);
 assert.equal(body.schema,'ecology-terrain-detail-weight-quality-owned-preflight-v1');assert.equal(body.status,'passed');assert.equal(body.gpuInitialized,false);
 assert.deepEqual(body.executionPackage,packageBinding);assert.deepEqual(body.programBindings,plan.programBindings);assert.deepEqual(body.modelBinding,plan.modelBinding);
 const receipt=io.json(root,body.ownedReceipt);assert.equal(receipt.phase,'cpu');assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.processCleanupConfirmed,true);
 assert.equal(receipt.budget.timeoutMs,240000);assert.equal(receipt.budget.outputBytes,8388608);assert.equal(receipt.proof.exitCode,0);
 assert.equal(receipt.guard.state,'released_after_live_empty_job');assert.equal(receipt.stopReason,null);
 const encoded=receipt.proof.bindingBase64,bytes=Buffer.from(encoded,'base64');assert.equal(bytes.toString('base64'),encoded);assert.ok(bytes.length<=65536);
 const descriptor=JSON.parse(bytes),guard=descriptor.guard;assert.equal(descriptor.scope,path.resolve(root));assert.equal(guard.identity,receipt.guard.identity);
 assert.deepEqual(guard.nativeOwnerSource,io.nativeOwnerSourceIdentity());assert.equal(guard.helperSha256,plan.programBindings.nativeRunner.sha256);
 assert.equal(guard.executableSha256,plan.runtimeIdentity.python.sha256);assert.equal(path.resolve(guard.executable),path.resolve(plan.runtimeIdentity.python.absolutePath));
 assert.equal(guard.commandSha256,digest(JSON.stringify(['-B',io.inside(root,ROLES.worker),'--preflight','--package',packageBinding.path,'--sha256',packageBinding.sha256])));
 assert.equal(descriptor.guardSha256,digest(JSON.stringify(guard)));
 const expected=digest(plan.outputRoot).slice(0,32),namespace=[expected.slice(0,8),expected.slice(8,12),expected.slice(12,16),expected.slice(16,20),expected.slice(20)].join('-');
 assert.equal(receipt.guard.nativeEvidenceRoot,'.runtime/ai-painter/owned-worker-guards/'+namespace);
 const started=receipt.guard.nativeEvidenceRoot+'/'+guard.identity+'-started.json';assert.equal(guard.startedEvidence,io.inside(root,started));
 assert.deepEqual(io.json(root,io.bind(root,started)),{...guard,ownerPid:receipt.ownerIdentity.pid,commandBinding:encoded});assert.deepEqual(descriptor.nativeBuild,receipt.nativeBuild);
 const buildRoot=receipt.guard.nativeEvidenceRoot+'/'+guard.identity+'-native';
 for(const [name,file,shaKey]of [['snapshot','owner.cs',null],['binary','owner.exe','binarySha256']]){
  assert.equal(descriptor.nativeBuild[name],io.inside(root,buildRoot+'/'+file));assert.equal(digest(io.read(root,io.bind(root,buildRoot+'/'+file))),shaKey?descriptor.nativeBuild[shaKey]:guard.nativeOwnerSource.sha256);
 }
 assert.equal(validateNativeReceipt({proof:receipt.proof,ownerPid:receipt.ownerIdentity.pid,bindingBase64:encoded,ownerClosed:receipt.ownerClosed,
  protocolError:receipt.protocolError,stdoutBytes:receipt.streamBytes.stdout,stderrBytes:receipt.streamBytes.stderr}),true);return body;
}
function createPhaseAdapters(dependencies={}){
 const deps={loadContext,runNative,hasLiveOwnedProof,cleanupForCurrentCall,withNativeOrdinaryBudget,withNativeReceiptBudget,
  readRegistry:readCurrentExecutionRegistry,advanceRegistry:advanceCurrentExecutionRegistry,processIdentity,
  createPresentation,createActiveIdentity,verifyGpuOutcome,verifyStoredGpuAcceptance,validateTerminal,write,json,bind,inside,read,
  hasGpuAcceptance:ready=>fs.existsSync(inside(ready.root,ready.plan.outputRoot+'/gpu-acceptance.json')),
  persistNativeFailureEvidence,
  hasConsumedQualification:ready=>fs.existsSync(inside(ready.root,ready.plan.outputRoot+'/qualification-consumed.json')),
  hasOwnPreflight:ready=>fs.existsSync(inside(ready.root,ready.plan.outputRoot+'/preflight.json')),verifyStoredPreflight,...dependencies};
 async function advance(ready,{activeExecution,evidence,state,activity,latestTrainingTerminal,capsuleLogical,qualificationOnly=false}){
  const terminal=deps.json(ready.root,evidence);
  for(const key of ['capabilityVersion','packageId','runId'])assert.equal(terminal[key],ready.plan[key]);
  assert.deepEqual(terminal.executionPackage,ready.packageBinding);
  assert.ok(['completed','failed_closed','blocked_policy_boundary'].includes(terminal.executionState),'registry evidence must be terminal');
  const current=await deps.readRegistry(ready.root);assert.equal(current.ok,true);
  const capsule=deps.write(ready.root,capsuleLogical??ready.plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json',{
   schemaVersion:'ai-painter-local-task-capsule-v1',taskId:ready.plan.runId,integrity:{status:'verified'},
   evidence:[{...evidence,kind:'diagnostic_execution_evidence',sha256Verified:true},{...ready.packageBinding,kind:'execution_package',sha256Verified:true}]});
  const result=await deps.advanceRegistry({projectRoot:ready.root,capabilityVersion:CAPABILITY,packageId:ready.plan.packageId,
   taskId:ready.plan.runId,taskKind:qualificationOnly?'ecology_decode1_weight_readonly_gpu_qualification':'ecology_quality_training',
   taskGoal:qualificationOnly?'48 train samples, zero optimizer updates, GPU qualification only; no training/checkpoint/publication.':'One24-epoch quality train/checkpoint/review with readonly epoch12 observation; no formal qualification or publication.',
   priority:5,queueStatus:state==='executing'?'running':state,nextMachineAction:null,queuedAtUtc:new Date().toISOString(),
   runId:ready.plan.runId,lifecycleStage:'dry_single_world_256x192',executionState:state,activity,taskCapsulePath:capsule.path,
   terminalEvidencePath:evidence.path,activeExecution,...(latestTrainingTerminal?{latestTrainingTerminal}:{}),
   expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256});
  assert.equal(result.ok,true);return result;
 }
 function heartbeat(context,ready,identity,qualificationOnly=false){
  context.heartbeat();const file=deps.inside(ready.root,ready.plan.outputRoot+(qualificationOnly?'/qualification-heartbeat.json':'/heartbeat.json')),value=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [key,v]of Object.entries(identity))assert.equal(value[key],v);
  value.heartbeatAtUtc=new Date().toISOString();const staged=file+'.staged-'+crypto.randomUUID();fs.writeFileSync(staged,JSON.stringify(value),{flag:'wx'});replaceHeartbeatFile(staged,file);
 }
 async function preflight(context){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready;
  if(deps.hasOwnPreflight(ready)){const b=deps.bind(root,plan.outputRoot+'/preflight.json');deps.verifyStoredPreflight(ready,b);return {status:'passed',preflight:b,reusedExactOwnPreflight:true};}
  deps.write(root,plan.outputRoot+'/preflight-consumed.json',{executionPackage:packageBinding,attempt:1,automaticRetries:0});
  deps.write(root,plan.outputRoot+'/package.json',deps.createPresentation(ready.input));
  const result=await deps.runNative({root,outputRoot:plan.outputRoot,phase:'cpu',executionPlan:plan,
   executable:deps.inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),
   args:['-B',deps.inside(root,plan.programBindings.worker.path),'--preflight','--package',packageBinding.path,'--sha256',packageBinding.sha256],onHeartbeat:context.heartbeat});
  assert.ok(deps.hasLiveOwnedProof(result.ownedReceipt));assert.equal(JSON.parse(result.stdout).status,'own_quality_entry_preflight_passed_not_gpu_qualified');
  assert.equal(JSON.parse(result.stdout).gpuInitialized,false);
  return deps.withNativeOrdinaryBudget(root,result.ownedReceipt,()=>({status:'passed',preflight:deps.write(root,plan.outputRoot+'/preflight.json',
   {schema:'ecology-terrain-detail-weight-quality-owned-preflight-v1',status:'passed',executionPackage:packageBinding,ownedReceipt:result.receiptBinding,
    programBindings:plan.programBindings,modelBinding:plan.modelBinding,gpuQualified:false,gpuInitialized:false})}));
 }
 async function executeBounded(context,{qualificationOnly=false}={}){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready,current=await deps.readRegistry(root);
  assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null,'concurrent active execution refused');
  let existingAdmission=null;
  if(deps.hasGpuAcceptance(ready)){
   assert.equal(qualificationOnly,false,'GPU qualification cannot be consumed twice');
   const saved=deps.bind(root,plan.outputRoot+'/gpu-acceptance.json');deps.verifyStoredGpuAcceptance(ready,saved,current);existingAdmission=saved;
  }else assert.equal(deps.hasConsumedQualification(ready),false,'consumed qualification without accepted result cannot retry');
  deps.write(root,plan.outputRoot+(qualificationOnly?'/qualification-consumed.json':'/execution-consumed.json'),{executionPackage:packageBinding,attempt:1,automaticRetries:0});
  const identity={capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,processId:process.pid,processStartIdentity:deps.processIdentity(process.pid)};
  const lockPath=plan.outputRoot+(qualificationOnly?'/qualification-lock.json':'/execution-lock.json'),heartbeatPath=plan.outputRoot+(qualificationOnly?'/qualification-heartbeat.json':'/heartbeat.json');
  const lock=deps.write(root,lockPath,{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity});
  deps.write(root,heartbeatPath,{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
  const active=deps.createActiveIdentity(ready.input,{...identity,executionPhase:qualificationOnly?'qualification':'training',executionState:'executing',programBindings:plan.programBindings,lock,heartbeat:{path:heartbeatPath,ttlSeconds:120}});
  const dispatchStatus=existingAdmission?'training_pending':'qualification_pending';
  const dispatch=deps.write(root,plan.outputRoot+(qualificationOnly?'/qualification-dispatched.json':'/dispatched.json'),{status:dispatchStatus,executionState:'completed',
   completedAction:'execution_dispatch_record_only_not_training',capabilityVersion:CAPABILITY,packageId:plan.packageId,runId:plan.runId,
   executionPackage:packageBinding,trainingStarted:false});
  await advance(ready,{activeExecution:active,evidence:dispatch,state:'executing',activity:existingAdmission?'training_pending':'diagnostic_gpu_qualification_pending',qualificationOnly});
  const executable=deps.inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),base=['--package',packageBinding.path,'--sha256',packageBinding.sha256];
  let lastReceipt=null,phase='qualification';
  try{
   let admission=existingAdmission;
   if(!admission){const gpu=await deps.runNative({root,outputRoot:plan.outputRoot,phase,executionPlan:plan,executable,
    args:['-B',deps.inside(root,plan.programBindings.gpuQualifier.path),...base],onHeartbeat:()=>heartbeat(context,ready,identity,qualificationOnly)});
   lastReceipt=gpu.ownedReceipt;assert.ok(deps.hasLiveOwnedProof(lastReceipt));const report=JSON.parse(gpu.stdout);deps.verifyGpuOutcome(ready,report);
   admission=await deps.withNativeOrdinaryBudget(root,lastReceipt,()=>deps.write(root,plan.outputRoot+'/gpu-acceptance.json',{
    schema:'ecology-terrain-detail-weight-quality-owned-gpu-acceptance-v1',status:'passed',executionPackage:packageBinding,programBindings:plan.programBindings,report,ownedReceipt:gpu.receiptBinding}));}
   if(qualificationOnly){
    const terminal=await deps.withNativeReceiptBudget(root,lastReceipt,()=>deps.write(root,plan.outputRoot+'/qualification-only-terminal.json',{
     schema:'ecology-terrain-detail-weight-quality-pretraining-terminal-v1',status:'qualification_completed_training_not_started',executionState:'completed',
     capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,executionPackage:packageBinding,gpuAcceptance:admission,
     optimizerStepsGenerator:0,optimizerStepsDiscriminator:0,trainingStarted:false,checkpointWritten:false,automaticRetries:0,
     formalStage4QualificationAllowed:false,runtimePublicationAllowed:false}));
    await deps.withNativeReceiptBudget(root,lastReceipt,()=>advance(ready,{activeExecution:null,evidence:terminal,state:'completed',activity:'qualification_completed_training_not_started',qualificationOnly}));
    return {status:'passed',qualification:admission,terminal,trainingStarted:false,optimizerSteps:0};
   }
   phase='training';lastReceipt=null;
   const result=await deps.runNative({root,outputRoot:plan.outputRoot,phase,executionPlan:plan,executable,
    args:['-B',deps.inside(root,plan.programBindings.worker.path),...base,'--gpu',admission.path,'--gpu-sha256',admission.sha256],onHeartbeat:()=>heartbeat(context,ready,identity)});
   lastReceipt=result.ownedReceipt;assert.ok(deps.hasLiveOwnedProof(lastReceipt));const terminal=JSON.parse(result.stdout),body=deps.json(root,terminal);deps.validateTerminal(body,packageBinding,plan);
   assert.equal(body.status,'training_completed_review_pending');
   await deps.withNativeReceiptBudget(root,lastReceipt,()=>advance(ready,{activeExecution:null,evidence:terminal,state:'completed',activity:body.status,latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}}));
   return {status:'passed',workerTerminal:terminal,captureStatus:'capture_not_triggered',rootCauseConfirmed:false,ownedReceipt:result.receiptBinding};
  }catch(error){
   let terminal=null,body=null;
   try{terminal=deps.bind(root,plan.outputRoot+'/worker-terminal.json');body=deps.json(root,terminal);deps.validateTerminal(body,packageBinding,plan);}catch{terminal=null;body=null;}
   const persist=async()=>{
    const failure=deps.write(root,plan.outputRoot+(qualificationOnly?'/qualification-failure.json':'/execution-failure.json'),{status:'failed_closed',executionState:'failed_closed',phase,
     runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:packageBinding,workerTerminal:terminal,
     optimizerStepsGenerator:body?.optimizerStepsGenerator??null,optimizerStepsDiscriminator:body?.optimizerStepsDiscriminator??null,
     captureStatus:body?.captureStatus??'capture_incomplete',originalError:body?.originalError??null,error:String(error),automaticRetries:0,
     cleanupConfirmed:deps.cleanupForCurrentCall(error,lastReceipt),formalStage4QualificationAllowed:false,runtimePublicationAllowed:false});
    if(deps.cleanupForCurrentCall(error,lastReceipt))await advance(ready,{activeExecution:null,evidence:failure,state:'failed_closed',activity:'diagnostic_failed_closed',qualificationOnly,...(terminal&&!qualificationOnly?{latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}}:{})});
   };
   const receipt=Object.hasOwn(error,'ownedReceipt')?error.ownedReceipt:lastReceipt;
   try{if(receipt)error.nativeFailureEvidence=await deps.persistNativeFailureEvidence(root,receipt,error,phase);}catch(secondary){error.failureEvidenceError=boundedNativeFailureMetadata(secondary);}
   try{if(receipt?.outputAccountingRoots)await deps.withNativeReceiptBudget(root,receipt,persist);else await persist();}catch(secondary){error.secondaryEvidenceError=boundedNativeFailureMetadata(secondary);}
   throw error;
  }
 }
 async function validate(context){
  const ready=deps.loadContext(context),terminal=deps.bind(ready.root,ready.plan.outputRoot+'/worker-terminal.json')
  const body=deps.json(ready.root,terminal);deps.validateTerminal(body,ready.packageBinding,ready.plan);assert.equal(body.status,'training_completed_review_pending')
  for(const record of body.checkpoints)deps.read(ready.root,record.checkpoint)
  for(const observation of body.epochObservations){
   const saved=deps.json(ready.root,observation.artifact),expected=structuredClone(observation);delete expected.artifact
   assert.deepEqual(saved,expected,'midpoint observation bytes/content differ from terminal')
   assert.deepEqual(saved.planBinding,ready.planBinding??ready.input.planBinding,'midpoint observation plan binding differs')
  }
  return {status:'passed',workerTerminal:terminal}
 }
 async function review(context){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready
  const terminal=deps.bind(root,plan.outputRoot+'/worker-terminal.json')
  let result=null
  try{
   // Node is the one retained root; its Python child and JS audits share the
   // same 120-second private Job and output accounting, not a second runner.
   result=await deps.runNative({root,outputRoot:plan.outputRoot+'/dry-review-owned',phase:'review',executionPlan:plan,executable:process.execPath,
    args:[deps.inside(root,plan.programBindings.reviewDriver.path),'--package',packageBinding.path,'--sha256',packageBinding.sha256,
     '--terminal',terminal.path,'--terminal-sha256',terminal.sha256],onHeartbeat:context.heartbeat})
   const coreBinding=JSON.parse(result.stdout),core=deps.json(root,coreBinding)
   assert.equal(coreBinding.path,plan.outputRoot+'/dry-review/machine-audit-core.json')
   assert.equal(core.schema,'ecology-terrain-detail-weight-machine-audit-core-v1');assert.equal(core.capabilityVersion,CAPABILITY)
   assert.deepEqual(core.executionPackage,packageBinding);assert.equal(core.runId,plan.runId)
   assert.equal(core.formalStage4QualificationGranted,false);assert.equal(core.runtimePublicationGranted,false)
   return await deps.withNativeReceiptBudget(root,result.ownedReceipt,async()=>{
    const audit=deps.write(root,plan.outputRoot+'/dry-review/machine-audit.json',{schema:'ecology-terrain-detail-weight-machine-audit-v1',
     status:core.status,runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:packageBinding,
     core:coreBinding,input:core.input,selectedCheckpoint:core.selectedCheckpoint,nativeOwnedReceipt:result.receiptBinding,
     formalStage4QualificationGranted:false,runtimePublicationGranted:false})
    return {status:'passed',reviewOutcome:core.status==='dry_single_world_review_failed_closed'?'machine_reviews_failed':'machine_reviews_completed',audit}
   })
  }catch(error){
   if(deps.cleanupForCurrentCall(error,result?.ownedReceipt)){
    const owned=error.ownedReceipt??result.ownedReceipt
    const capsuleLogical=plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json'
    try{await deps.withNativeReceiptBudget(root,owned,async()=>{
     const failure=deps.write(root,plan.outputRoot+'/dry-review-owned/review-failure.json',{
      schema:'ecology-decode1-weight-review-failure-v1',runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,
      executionPackage:packageBinding,workerTerminal:terminal,status:'review_execution_failed_closed',executionState:'failed_closed',
      error:String(error),nativeOwnedReceipt:error.receiptBinding??result?.receiptBinding??null,automaticRetries:0,
      formalStage4QualificationGranted:false,runtimePublicationGranted:false})
     await advance(ready,{activeExecution:null,evidence:failure,state:'failed_closed',activity:'review_execution_failed_closed',capsuleLogical})
    },[capsuleLogical])}catch(secondary){error.secondaryEvidenceError=String(secondary)}
   }
   throw error
  }
 }
 async function adjudicate(context){
  const ready=deps.loadContext(context),audit=deps.bind(ready.root,ready.plan.outputRoot+'/dry-review/machine-audit.json')
  const body=deps.json(ready.root,audit)
  assert.equal(body.schema,'ecology-terrain-detail-weight-machine-audit-v1');assert.deepEqual(body.executionPackage,ready.packageBinding)
  assert.equal(body.formalStage4QualificationGranted,false);assert.equal(body.runtimePublicationGranted,false)
  const core=deps.json(ready.root,body.core)
  assert.equal(core.schema,'ecology-terrain-detail-weight-machine-audit-core-v1');assert.equal(core.status,body.status)
  for(const key of ['runId','packageId','capabilityVersion','executionPackage','input','selectedCheckpoint',
   'formalStage4QualificationGranted','runtimePublicationGranted'])assert.deepEqual(body[key],core[key])
  deps.read(ready.root,body.nativeOwnedReceipt)
  return {status:'passed',audit,decision:body.status}
 }
 async function finalize(context){
  await adjudicate(context) // Rehash core and wrapper before committing a terminal.
  const ready=deps.loadContext(context),auditBinding=deps.bind(ready.root,ready.plan.outputRoot+'/dry-review/machine-audit.json')
  const audit=deps.json(ready.root,auditBinding),receipt=deps.json(ready.root,audit.nativeOwnedReceipt)
  assert.equal(receipt.phase,'review');assert.equal(receipt.cleanupConfirmed,true)
  assert.equal(receipt.proof.activeProcessesAfterCleanup,0)
  assert.ok(receipt.outputAccountingRoots.includes(ready.plan.outputRoot+'/dry-review-owned'))
  assert.ok(receipt.outputAccountingRoots.includes(ready.plan.outputRoot+'/dry-review'))
  const completed=audit.status==='dry_single_world_numeric_passed_visual_approval_pending'
  assert.ok(completed||audit.status==='dry_single_world_review_failed_closed','unknown machine review state')
  const finalLogical=ready.plan.outputRoot+'/finalization.json',capsuleLogical=ready.plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json'
  return deps.withNativeReceiptBudget(ready.root,receipt,async()=>{
   const finalization=deps.write(ready.root,finalLogical,{
    schema:'ecology-terrain-detail-weight-quality-review-terminal-v1',status:audit.status,executionState:completed?'completed':'failed_closed',
    runId:ready.plan.runId,packageId:ready.plan.packageId,capabilityVersion:CAPABILITY,executionPackage:ready.packageBinding,
    workerTerminal:deps.bind(ready.root,ready.plan.outputRoot+'/worker-terminal.json'),audit:auditBinding,reviewReport:audit.input,
    automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false})
   await advance(ready,{activeExecution:null,evidence:finalization,state:completed?'completed':'failed_closed',activity:audit.status,capsuleLogical})
   return completed?{status:'passed',finalization}:{status:'failed',failureKind:'visual',failureCode:'dry_review_failed',
    summaryZh:'原审核器拒绝当前场景；本路线结束，不续训、不授予资格。',finalization}
  },[finalLogical,capsuleLogical])
 }
 const execute=context=>executeBounded(context);
 const qualifyOnly=async context=>{
  const ready=deps.loadContext(context),current=await deps.readRegistry(ready.root);assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null,'concurrent active execution refused');
  assert.equal(deps.hasGpuAcceptance(ready),false,'GPU qualification cannot be consumed twice');assert.equal(deps.hasConsumedQualification(ready),false,'consumed qualification cannot retry');
  await preflight(context);return executeBounded(context,{qualificationOnly:true});
 };
 return {preflight,qualifyOnly,execute,validate,review,adjudicate,finalize}
}

const production=createPhaseAdapters()
export const {preflight,qualifyOnly,execute,validate,review,adjudicate,finalize}=production
// Explicit private dependency stubs are for CPU protocol verification only.
export const createPhaseAdaptersForIsolatedTests=dependencies=>createPhaseAdapters(dependencies);

function preparationAdapters(dependencies={}){
 const deps={prepareCpuRequest,finalizeCpuAcceptance,preparePlan,makeInternalCandidate,runNative,withNativeOrdinaryBudget,
  materialize:materializeAutonomousClosedLoopPackage,readRegistry:readCurrentExecutionRegistry,inside,runtimeIdentity,
  assertNoGuard:root=>assert.equal(fs.existsSync(inside(root,'.runtime/ai-painter/owned-worker-guards/active.json')),false,'unknown or active guard refused'),...dependencies};
 return {async prepareOnly({root,runId,packageId,preparationRequestBinding=null}){
  const started=Date.now();deps.assertNoGuard(root);
  const current=await deps.readRegistry(root);assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null,'active execution refused');
  const requestBinding=deps.prepareCpuRequest({root,runId,packageId,preparationRequestBinding});
  const identity=deps.runtimeIdentity(root),outputRoot='.runtime/ai-painter/ecology-terrain-detail-weight-quality-executions/'+runId;
  assert.ok(Date.now()-started<240000,'CPU preparation deadline');let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true},Math.max(1,240000-(Date.now()-started)));let result;
  try{result=await deps.runNative({root,outputRoot,phase:'cpu',executable:identity.python.absolutePath,
   args:['-B',deps.inside(root,ROLES.cpuHarness),'--cpu-request',requestBinding.path,'--sha256',requestBinding.sha256],
   abortReason:()=>timedOut?'decode1_cpu_preparation_deadline':null});}finally{clearTimeout(timer);}
  assert.ok(Date.now()-started<240000&&!timedOut,'CPU preparation deadline');
  const acceptance=await deps.finalizeCpuAcceptance({root,requestBinding,result});
  return deps.withNativeOrdinaryBudget(root,result.ownedReceipt,async()=>{
   const plan=deps.preparePlan({root,requestBinding,finalCpuAcceptance:acceptance});
   const beforePackage=await deps.readRegistry(root);assert.equal(beforePackage.ok,true);assert.equal(beforePackage.registry.activeExecution,null);
   const candidate=deps.makeInternalCandidate(root,plan),materialized=deps.materialize(candidate,{root,recoverExistingExact:false});
   assert.ok(Date.now()-started<240000,'CPU preparation deadline');
   return {schema:'ecology-terrain-detail-weight-quality-preparation-v1',status:'prepared_training_not_started',plan,
    executionPackage:{path:materialized.packagePath,sha256:materialized.packageSha256},cpuAcceptance:acceptance,
    trainingStarted:false,gpuStarted:false,checkpointWritten:false,automaticRetries:0};
  });
 }};
}
export const prepareOnly=options=>preparationAdapters().prepareOnly(options);
export const createPreparationAdaptersForIsolatedTests=dependencies=>preparationAdapters(dependencies);
export function parsePreparationArguments(args){
 const protocol='ecology-terrain-detail-weight-quality-entry-v1';
 if(args.length===1&&args[0]==='--help')return {help:true};
 assert.deepEqual(args.slice(0,2),['--protocol',protocol],'explicit versioned preparation protocol required');
 const mode=args[2],values={};assert.ok(['prepare-only','qualify-only'].includes(mode),'unknown preparation mode');
 assert.equal(args.length,7);const expected=mode==='prepare-only'?['--run','--package-id']:['--package','--sha256'];
 for(let i=3;i<args.length;i+=2){assert.ok(expected.includes(args[i])&&!Object.hasOwn(values,args[i]),'unknown or repeated argument');values[args[i]]=args[i+1];}
 if(mode==='prepare-only'){for(const key of expected)assert.match(values[key],/^[a-z0-9][a-z0-9-]{7,127}$/u);assert.notEqual(values['--run'],values['--package-id']);}
 else{assert.match(values['--package'],/^\.runtime\/ai-painter\/autonomous-closed-loop-packages\/[a-z0-9][a-z0-9-]{7,127}\/package\.json$/u);assert.match(values['--sha256'],/^[a-f0-9]{64}$/u);}
 return {mode,values};
}
export function classifyPreparationFailure(error,stage){
 const reasons=new Map([
  ['active execution refused','active_execution'],['concurrent active execution refused','active_execution'],['unknown or active guard refused','owned_guard'],
  ['same live CPU call required','cpu_live_proof'],['same retained CPU call must confirm all fixture links removed','cpu_fixture_cleanup'],
  ['GPU qualification cannot be consumed twice','qualification_consumed'],['consumed qualification cannot retry','qualification_consumed'],
  ['consumed qualification without accepted result cannot retry','qualification_consumed'],['CPU preparation deadline','cpu_deadline'],
  ['existing Run requires its exact registered preparation request','existing_run'],['existing model/CPU/consumed namespace refused','existing_run'],
  ['source file ceiling','source_limit'],['unique source closure ceiling','source_limit'],
  ...['key_missing','key_short','key_conflict','load_failed','root_mismatch','loader_source_mismatch','loader_version_mismatch','state_changed'].map(s=>['local_v2_deployment_'+s,'stable_configuration_'+s])
 ]);
 const ioCodes=new Set(['ENOENT','EACCES','EPERM','EBUSY','EEXIST','ETIMEDOUT','ENOSPC','EIO','OWNED_GUARD_BUSY']);
 const observed=boundedNativeFailureMetadata(error);
 const reason=reasons.get(error?.message)??(ioCodes.has(error?.code)?'io_'+error.code.toLowerCase():error?.code==='ERR_ASSERTION'?'contract_refused':observed.reason.replace(/[^a-z0-9]+/giu,'_').toLowerCase().slice(0,120));
 const type=['Error','AssertionError','TypeError','SyntaxError','RangeError'].includes(error?.name)?error.name:'Error';
 return {errorCode:'decode1_'+stage+'_'+reason,primaryError:{...observed,type,reason,code:ioCodes.has(error?.code)?error.code:observed.code},messageRecorded:observed.messageRecorded,rawStackRecorded:false};
}
export async function preservePreparationCliFailure({request,ready,error,root=process.cwd()}){
 const failure=classifyPreparationFailure(error,request?.mode==='qualify-only'?'qualification':request?.mode==='prepare-only'?'preparation':'arguments');
 const refused={schema:'ecology-terrain-detail-weight-quality-entry-refusal-v1',status:'failed_closed',...failure,automaticRetries:0};
 if(!request?.mode)return refused;
 try{
  const receipt=error?.ownedReceipt,scope=currentNativeFailureScope(root,receipt);
  const evidence=await persistNativeFailureEvidence(root,receipt,error,request.mode==='qualify-only'?'qualification':'preparation');
  return {...refused,runId:scope.runId,evidence,evidenceStatus:'preserved_from_current_call'};
 }catch(secondary){return {...refused,evidenceStatus:'failed_to_preserve',secondaryEvidenceFailure:boundedNativeFailureMetadata(secondary)};}
}
// The v2 entry awaits this adapter through the closed loop. Loading that entry
// here would create a top-level-await cycle; its configuration helper belongs
// only to this adapter's direct CLI invocation, not the imported phase exports.
async function adoptLocalDeploymentForDirectCli(){
 const {loadLocalOperatorDeploymentConfiguration}=await import('./run-ai-painter-local-control-v2.mjs');
 return loadLocalOperatorDeploymentConfiguration();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let request=null,ready=null;
 try{
  request=parsePreparationArguments(process.argv.slice(2));
  if(request.help)process.stdout.write('ecology-terrain-detail-weight-quality-entry-v1: prepare-only --run ID --package-id ID; qualify-only --package PATH --sha256 SHA. Both stop before training.\n');
  else if(request.mode==='prepare-only'){await adoptLocalDeploymentForDirectCli();process.stdout.write(JSON.stringify(await prepareOnly({root:process.cwd(),runId:request.values['--run'],packageId:request.values['--package-id']}))+'\n');}
  else{const packageBinding={path:request.values['--package'],sha256:request.values['--sha256']},spec=json(process.cwd(),packageBinding);
   await adoptLocalDeploymentForDirectCli();
   const context={projectRoot:process.cwd(),packageIdentity:spec.packageIdentity,capabilityVersion:spec.capabilityVersion,outputRoot:spec.outputRoot,inputEvidence:spec.inputEvidence,heartbeat(){}};
   ready=loadContext(context);assert.deepEqual(ready.packageBinding,packageBinding);
   process.stdout.write(JSON.stringify(await qualifyOnly(context))+'\n');}
 }catch(error){let refusal;try{refusal=await preservePreparationCliFailure({request,ready,error});}catch(secondary){refusal={schema:'ecology-terrain-detail-weight-quality-entry-refusal-v1',status:'failed_closed',...classifyPreparationFailure(error,'preparation'),secondaryEvidenceFailure:boundedNativeFailureMetadata(secondary),automaticRetries:0};}
  process.stderr.write(JSON.stringify(refusal)+'\n');process.exitCode=1;}
}
