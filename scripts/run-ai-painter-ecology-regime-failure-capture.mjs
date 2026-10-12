// Existing closed-loop six-phase exports. No separate service or fixture CLI.
import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {advanceCurrentExecutionRegistry,readCurrentExecutionRegistry} from '../src/server/ai-painter-current-execution-registry.mjs';
import {processIdentity} from './run-ai-painter-mvp256-dry-v24-training.mjs';
import {replaceHeartbeatFile} from './run-ai-painter-learning-capacity-experiment.mjs';
import {createPresentation,createActiveIdentity} from './lib/ai-painter-ecology-failure-capture-execution-registration-v1.mjs';
import {runNative,cleanupForCurrentCall,hasLiveOwnedProof,withNativeOrdinaryBudget,withNativeReceiptBudget} from './lib/ai-painter-ecology-failure-capture-owned-native-v1.mjs';
import {CAPABILITY,EXECUTION_PROFILE,inside,write,json,bind,loadContext,validateTerminal} from './lib/ai-painter-ecology-failure-capture-package-chain-v1.mjs';

export function verifyGpuOutcome(ready,binding){
 const {root,plan,packageBinding}=ready,gate=json(root,binding);
 assert.equal(binding.path,plan.outputRoot+'/gpu-gate.json');assert.equal(gate.schema,'ecology-regime-failure-capture-all-train-gpu-gate-v1');
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
  createPresentation,createActiveIdentity,verifyGpuOutcome,validateTerminal,write,json,bind,inside,...dependencies};
 async function advance(ready,{activeExecution,evidence,state,activity,latestTrainingTerminal}){
  const terminal=deps.json(ready.root,evidence);
  for(const key of ['capabilityVersion','packageId','runId'])assert.equal(terminal[key],ready.plan[key]);
  assert.deepEqual(terminal.executionPackage,ready.packageBinding);
  assert.ok(['completed','failed_closed','blocked_policy_boundary'].includes(terminal.executionState),'registry evidence must be terminal');
  const current=await deps.readRegistry(ready.root);assert.equal(current.ok,true);
  const capsule=deps.write(ready.root,ready.plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json',{
   schemaVersion:'ai-painter-local-task-capsule-v1',taskId:ready.plan.runId,integrity:{status:'verified'},
   evidence:[{...evidence,kind:'diagnostic_execution_evidence',sha256Verified:true},{...ready.packageBinding,kind:'execution_package',sha256Verified:true}]});
  const result=await deps.advanceRegistry({projectRoot:ready.root,capabilityVersion:CAPABILITY,packageId:ready.plan.packageId,
   taskId:ready.plan.runId,taskKind:'ecology_gradient_failure_diagnostic',taskGoal:'One600-update diagnostic; no qualification or publication.',
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
  assert.ok(deps.hasLiveOwnedProof(result.ownedReceipt));assert.equal(JSON.parse(result.stdout).status,'own_capture_entry_preflight_passed_not_gpu_qualified');
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
    schema:'ecology-regime-failure-capture-owned-gpu-acceptance-v1',status:'passed',executionPackage:packageBinding,programBindings:plan.programBindings,report,ownedReceipt:gpu.receiptBinding}));
   phase='training';lastReceipt=null;
   const result=await deps.runNative({root,outputRoot:plan.outputRoot,phase,executionPlan:plan,executable,
    args:['-B',deps.inside(root,plan.programBindings.worker.path),...base,'--gpu',admission.path,'--gpu-sha256',admission.sha256],onHeartbeat:()=>heartbeat(context,ready,identity)});
   lastReceipt=result.ownedReceipt;assert.ok(deps.hasLiveOwnedProof(lastReceipt));const terminal=JSON.parse(result.stdout),body=deps.json(root,terminal);deps.validateTerminal(body,packageBinding,plan);
   assert.equal(body.status,'bounded_diagnostic_completed');
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
 async function validate(context){const ready=deps.loadContext(context),terminal=deps.bind(ready.root,ready.plan.outputRoot+'/worker-terminal.json');deps.validateTerminal(deps.json(ready.root,terminal),ready.packageBinding,ready.plan);return {status:'passed',workerTerminal:terminal};}
 async function review(context){return {...await validate(context),diagnosticOnly:true,reviewExecuted:false,qualificationGranted:false};}
 async function adjudicate(context){return {...await validate(context),rootCauseConfirmed:false,qualificationGranted:false};}
 async function finalize(context){const checked=await validate(context),ready=deps.loadContext(context);const evidence=deps.write(ready.root,ready.plan.outputRoot+'/finalization.json',{
  status:'diagnostic_completed_no_root_cause_conclusion',executionState:'completed',
  completedAction:'diagnostic_finalization_record_only_not_quality_qualification',capabilityVersion:CAPABILITY,packageId:ready.plan.packageId,
  runId:ready.plan.runId,executionPackage:ready.packageBinding,workerTerminal:checked.workerTerminal,
  diagnosticOnly:true,rootCauseConfirmed:false,qualificationGranted:false,checkpointPromotable:false,
  automaticRetries:0,formalStage4QualificationAllowed:false,runtimePublicationAllowed:false});
  await advance(ready,{activeExecution:null,evidence,state:'completed',activity:'diagnostic_completed_no_root_cause_conclusion'});return {status:'passed',finalization:evidence};}
 return {preflight,execute,validate,review,adjudicate,finalize};
}
const production=createPhaseAdapters();export const {preflight,execute,validate,review,adjudicate,finalize}=production;
