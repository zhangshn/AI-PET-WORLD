// Existing closed-loop six-phase exports. No separate service or fixture CLI.
import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {advanceCurrentExecutionRegistry,readCurrentExecutionRegistry} from '../src/server/ai-painter-current-execution-registry.mjs';
import {processIdentity} from './run-ai-painter-mvp256-dry-v24-training.mjs';
import {replaceHeartbeatFile} from './run-ai-painter-learning-capacity-experiment.mjs';
import {createPresentation,createActiveIdentity} from './lib/ai-painter-ecology-quality-registration-v1.mjs';
import {runNative,cleanupForCurrentCall,hasLiveOwnedProof,withNativeOrdinaryBudget,withNativeReceiptBudget} from './lib/ai-painter-ecology-quality-owned-native-v1.mjs';
import {CAPABILITY,EXECUTION_PROFILE,inside,read,write,json,bind,loadContext,validateTerminal} from './lib/ai-painter-ecology-quality-package-chain-v1.mjs';

export function verifyGpuOutcome(ready,binding){
 const {root,plan,packageBinding}=ready,gate=json(root,binding);
 assert.equal(binding.path,plan.outputRoot+'/gpu-gate.json');assert.equal(gate.schema,'ecology-regime-quality-all-train-gpu-gate-v1');
 assert.equal(gate.status,'passed');assert.equal(gate.capabilityVersion,CAPABILITY);assert.equal(gate.executionProfile,EXECUTION_PROFILE);
 assert.equal(gate.runId,plan.runId);assert.equal(gate.packageId,plan.packageId);assert.deepEqual(gate.executionPackage,packageBinding);
 assert.deepEqual(gate.programBindings,plan.programBindings);assert.deepEqual(gate.actualCounts,{forwardAttempted:48,forwardCompleted:48,generatorAttempted:192,generatorCompleted:192,discriminatorAttempted:48,discriminatorCompleted:48});
 assert.equal(gate.optimizerSteps,0);assert.equal(gate.checkpointLoaded,false);assert.equal(gate.checkpointWritten,false);
 assert.equal(gate.deviceIdentity?.ordinal,0);assert.match(gate.deviceIdentity.uuid,/^GPU-/u);
 for(const row of gate.cases){assert.deepEqual(row.proof.callCounts,{generatorForwards:1,generatorAutograd:4,discriminatorAutograd:1});assert.equal(row.proof.optimizerCreated,false);assert.equal(row.proof.optimizerUpdates,0);}
 assert.deepEqual(gate.cases.map(r=>r.sampleId),json(root,plan.trainSplit).sampleIds);assert.equal(gate.cases.length,48);assert.ok(gate.cases.every(r=>r.passed===true));
 assert.deepEqual(gate.initialState,gate.finalState);assert.deepEqual(gate.initialCpuState,json(root,plan.modelBinding).initialState);return gate;
}
export function createPhaseAdapters(dependencies={}){
 const deps={loadContext,runNative,hasLiveOwnedProof,cleanupForCurrentCall,withNativeOrdinaryBudget,withNativeReceiptBudget,
  readRegistry:readCurrentExecutionRegistry,advanceRegistry:advanceCurrentExecutionRegistry,processIdentity,
  createPresentation,createActiveIdentity,verifyGpuOutcome,validateTerminal,write,json,bind,inside,read,...dependencies};
 async function advance(ready,{activeExecution,evidence,state,activity,latestTrainingTerminal,capsuleLogical}){
  const terminal=deps.json(ready.root,evidence);
  for(const key of ['capabilityVersion','packageId','runId'])assert.equal(terminal[key],ready.plan[key]);
  assert.deepEqual(terminal.executionPackage,ready.packageBinding);
  assert.ok(['completed','failed_closed','blocked_policy_boundary'].includes(terminal.executionState),'registry evidence must be terminal');
  const current=await deps.readRegistry(ready.root);assert.equal(current.ok,true);
  const capsule=deps.write(ready.root,capsuleLogical??ready.plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json',{
   schemaVersion:'ai-painter-local-task-capsule-v1',taskId:ready.plan.runId,integrity:{status:'verified'},
   evidence:[{...evidence,kind:'diagnostic_execution_evidence',sha256Verified:true},{...ready.packageBinding,kind:'execution_package',sha256Verified:true}]});
  const result=await deps.advanceRegistry({projectRoot:ready.root,capabilityVersion:CAPABILITY,packageId:ready.plan.packageId,
   taskId:ready.plan.runId,taskKind:'ecology_quality_training',taskGoal:'One12-epoch quality train/checkpoint/review; no formal qualification or publication.',
   priority:5,queueStatus:state==='executing'?'running':state,nextMachineAction:null,queuedAtUtc:new Date().toISOString(),
   runId:ready.plan.runId,lifecycleStage:'dry_single_world_256x192',executionState:state,activity,taskCapsulePath:capsule.path,
   terminalEvidencePath:evidence.path,activeExecution,...(latestTrainingTerminal?{latestTrainingTerminal}:{}),
   expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256});
  assert.equal(result.ok,true);return result;
 }
 function heartbeat(context,ready,identity){
  context.heartbeat();const file=deps.inside(ready.root,ready.plan.outputRoot+'/heartbeat.json'),value=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [key,v]of Object.entries(identity))assert.equal(value[key],v);
  value.heartbeatAtUtc=new Date().toISOString();const staged=file+'.staged-'+crypto.randomUUID();fs.writeFileSync(staged,JSON.stringify(value),{flag:'wx'});replaceHeartbeatFile(staged,file);
 }
 async function preflight(context){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready;
  deps.write(root,plan.outputRoot+'/package.json',deps.createPresentation(ready.input));
  const result=await deps.runNative({root,outputRoot:plan.outputRoot,phase:'cpu',executionPlan:plan,
   executable:deps.inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),
   args:['-B',deps.inside(root,plan.programBindings.worker.path),'--preflight','--package',packageBinding.path,'--sha256',packageBinding.sha256],onHeartbeat:context.heartbeat});
  assert.ok(deps.hasLiveOwnedProof(result.ownedReceipt));assert.equal(JSON.parse(result.stdout).status,'own_quality_entry_preflight_passed_not_gpu_qualified');
  assert.equal(JSON.parse(result.stdout).gpuInitialized,false);
  return deps.withNativeOrdinaryBudget(root,result.ownedReceipt,()=>({status:'passed',preflight:deps.write(root,plan.outputRoot+'/preflight.json',
   {status:'passed',executionPackage:packageBinding,ownedReceipt:result.receiptBinding,gpuQualified:false})}));
 }
 async function execute(context){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready,current=await deps.readRegistry(root);
  assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null,'concurrent active execution refused');
  deps.write(root,plan.outputRoot+'/execution-consumed.json',{executionPackage:packageBinding,attempt:1,automaticRetries:0});
  const identity={capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,processId:process.pid,processStartIdentity:deps.processIdentity(process.pid)};
  const lock=deps.write(root,plan.outputRoot+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity});
  deps.write(root,plan.outputRoot+'/heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120});
  const active=deps.createActiveIdentity(ready.input,{...identity,executionState:'executing',programBindings:plan.programBindings,lock,heartbeat:{path:plan.outputRoot+'/heartbeat.json',ttlSeconds:120}});
  const dispatch=deps.write(root,plan.outputRoot+'/dispatched.json',{status:'qualification_pending',executionState:'completed',
   completedAction:'execution_dispatch_record_only_not_training',capabilityVersion:CAPABILITY,packageId:plan.packageId,runId:plan.runId,
   executionPackage:packageBinding,trainingStarted:false});
  await advance(ready,{activeExecution:active,evidence:dispatch,state:'executing',activity:'diagnostic_gpu_qualification_pending'});
  const executable=deps.inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),base=['--package',packageBinding.path,'--sha256',packageBinding.sha256];
  let lastReceipt=null,phase='qualification';
  try{
   const gpu=await deps.runNative({root,outputRoot:plan.outputRoot,phase,executionPlan:plan,executable,
    args:['-B',deps.inside(root,plan.programBindings.gpuQualifier.path),...base],onHeartbeat:()=>heartbeat(context,ready,identity)});
   lastReceipt=gpu.ownedReceipt;assert.ok(deps.hasLiveOwnedProof(lastReceipt));const report=JSON.parse(gpu.stdout);deps.verifyGpuOutcome(ready,report);
   const admission=await deps.withNativeOrdinaryBudget(root,lastReceipt,()=>deps.write(root,plan.outputRoot+'/gpu-acceptance.json',{
    schema:'ecology-regime-quality-owned-gpu-acceptance-v1',status:'passed',executionPackage:packageBinding,programBindings:plan.programBindings,report,ownedReceipt:gpu.receiptBinding}));
   phase='training';lastReceipt=null;
   const result=await deps.runNative({root,outputRoot:plan.outputRoot,phase,executionPlan:plan,executable,
    args:['-B',deps.inside(root,plan.programBindings.worker.path),...base,'--gpu',admission.path,'--gpu-sha256',admission.sha256],onHeartbeat:()=>heartbeat(context,ready,identity)});
   lastReceipt=result.ownedReceipt;assert.ok(deps.hasLiveOwnedProof(lastReceipt));const terminal=JSON.parse(result.stdout),body=deps.json(root,terminal);deps.validateTerminal(body,packageBinding,plan);
   assert.equal(body.status,'training_completed_review_pending');
   await deps.withNativeReceiptBudget(root,lastReceipt,()=>advance(ready,{activeExecution:null,evidence:terminal,state:'completed',activity:'diagnostic_completed_no_root_cause_conclusion',latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}}));
   return {status:'passed',workerTerminal:terminal,captureStatus:'capture_not_triggered',rootCauseConfirmed:false,ownedReceipt:result.receiptBinding};
  }catch(error){
   let terminal=null,body=null;
   try{terminal=deps.bind(root,plan.outputRoot+'/worker-terminal.json');body=deps.json(root,terminal);deps.validateTerminal(body,packageBinding,plan);}catch{terminal=null;body=null;}
   const persist=async()=>{
    const failure=deps.write(root,plan.outputRoot+'/execution-failure.json',{status:'failed_closed',executionState:'failed_closed',phase,
     runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:packageBinding,workerTerminal:terminal,
     optimizerStepsGenerator:body?.optimizerStepsGenerator??null,optimizerStepsDiscriminator:body?.optimizerStepsDiscriminator??null,
     captureStatus:body?.captureStatus??'capture_incomplete',originalError:body?.originalError??null,error:String(error),automaticRetries:0,
     cleanupConfirmed:deps.cleanupForCurrentCall(error,lastReceipt),formalStage4QualificationAllowed:false,runtimePublicationAllowed:false});
    if(deps.cleanupForCurrentCall(error,lastReceipt))await advance(ready,{activeExecution:null,evidence:failure,state:'failed_closed',activity:'diagnostic_failed_closed',...(terminal?{latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}}:{})});
   };
   const receipt=Object.hasOwn(error,'ownedReceipt')?error.ownedReceipt:lastReceipt;
   try{if(receipt?.outputAccountingRoots)await deps.withNativeReceiptBudget(root,receipt,persist);else await persist();}catch(secondary){error.secondaryEvidenceError=String(secondary);}
   throw error;
  }
 }
 async function validate(context){
  const ready=deps.loadContext(context),terminal=deps.bind(ready.root,ready.plan.outputRoot+'/worker-terminal.json')
  const body=deps.json(ready.root,terminal);deps.validateTerminal(body,ready.packageBinding,ready.plan);assert.equal(body.status,'training_completed_review_pending')
  for(const record of body.checkpoints)deps.read(ready.root,record.checkpoint)
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
   assert.equal(core.schema,'ecology-regime-machine-audit-core-v1');assert.equal(core.capabilityVersion,CAPABILITY)
   assert.deepEqual(core.executionPackage,packageBinding);assert.equal(core.runId,plan.runId)
   assert.equal(core.formalStage4QualificationGranted,false);assert.equal(core.runtimePublicationGranted,false)
   return await deps.withNativeReceiptBudget(root,result.ownedReceipt,async()=>{
    const audit=deps.write(root,plan.outputRoot+'/dry-review/machine-audit.json',{schema:'ecology-regime-machine-audit-v1',
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
      schema:'ecology-regime-review-failure-v1',runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,
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
  assert.equal(body.schema,'ecology-regime-machine-audit-v1');assert.deepEqual(body.executionPackage,ready.packageBinding)
  assert.equal(body.formalStage4QualificationGranted,false);assert.equal(body.runtimePublicationGranted,false)
  const core=deps.json(ready.root,body.core)
  assert.equal(core.schema,'ecology-regime-machine-audit-core-v1');assert.equal(core.status,body.status)
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
    schema:'ecology-regime-quality-review-terminal-v1',status:audit.status,executionState:completed?'completed':'failed_closed',
    runId:ready.plan.runId,packageId:ready.plan.packageId,capabilityVersion:CAPABILITY,executionPackage:ready.packageBinding,
    workerTerminal:deps.bind(ready.root,ready.plan.outputRoot+'/worker-terminal.json'),audit:auditBinding,reviewReport:audit.input,
    automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false})
   await advance(ready,{activeExecution:null,evidence:finalization,state:completed?'completed':'failed_closed',activity:audit.status,capsuleLogical})
   return completed?{status:'passed',finalization}:{status:'failed',failureKind:'visual',failureCode:'dry_review_failed',
    summaryZh:'原审核器拒绝当前场景；本路线结束，不续训、不授予资格。',finalization}
  },[finalLogical,capsuleLogical])
 }
 return {preflight,execute,validate,review,adjudicate,finalize}
}

const production=createPhaseAdapters()
export const {preflight,execute,validate,review,adjudicate,finalize}=production
