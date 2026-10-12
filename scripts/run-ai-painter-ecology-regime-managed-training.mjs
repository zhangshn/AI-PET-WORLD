// Six-phase adapter to the existing autonomous engine. No separate CLI/backend.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {advanceCurrentExecutionRegistry,readCurrentExecutionRegistry} from '../src/server/ai-painter-current-execution-registry.mjs'
import {replaceHeartbeatFile} from './run-ai-painter-learning-capacity-experiment.mjs'
import {processIdentity} from './run-ai-painter-mvp256-dry-v24-training.mjs'
import {createPresentation,createActiveIdentity} from './lib/ai-painter-ecology-execution-registration-v1.mjs'
import {runNative,cleanupForCurrentCall,withNativeReceiptBudget} from './lib/ai-painter-ecology-owned-native-v1.mjs'
import {CAPABILITY,EXECUTION_PROFILE,inside,read,json,bind,write,loadContext,validateCompleted}
 from './lib/ai-painter-ecology-managed-package-chain-v1.mjs'

export function verifyGpuOutcome(ready,binding){
 const {root,plan,packageBinding}=ready,gate=json(root,binding)
 assert.equal(binding.path,plan.outputRoot+'/gpu-gate.json')
 assert.equal(gate.schema,'ecology-regime-all-train-gpu-gate-v1');assert.equal(gate.status,'passed')
 assert.equal(gate.capabilityVersion,CAPABILITY);assert.equal(gate.executionProfile,EXECUTION_PROFILE)
 assert.equal(gate.runId,plan.runId);assert.equal(gate.packageId,plan.packageId)
 assert.deepEqual(gate.executionPackage,packageBinding);assert.deepEqual(gate.programBindings,plan.programBindings)
 assert.deepEqual(gate.actualCounts,{forwardAttempted:48,forwardCompleted:48,generatorAttempted:192,generatorCompleted:192,
  discriminatorAttempted:48,discriminatorCompleted:48})
 assert.equal(gate.optimizerSteps,0);assert.equal(gate.checkpointLoaded,false);assert.equal(gate.checkpointWritten,false)
 const ids=json(root,plan.trainSplit).sampleIds
 assert.equal(ids.length,48);assert.equal(gate.cases.length,48)
 assert.deepEqual(gate.cases.map(row=>row.sampleId),ids);assert.ok(gate.cases.every(row=>row.passed===true))
 assert.deepEqual(gate.initialState,gate.finalState)
 assert.deepEqual(gate.initialCpuState,json(root,plan.modelBinding).initialState)
 return gate
}

// Tests inject an isolated transport/store explicitly; production exports below
// are constructed once from real dependencies and expose no fixture CLI.
export function createPhaseAdapters(dependencies={}){
 const deps={loadContext,runNative,readRegistry:readCurrentExecutionRegistry,advanceRegistry:advanceCurrentExecutionRegistry,
  processIdentity,createPresentation,createActiveIdentity,verifyGpuOutcome,validateCompleted,...dependencies}
 async function advance(context,ready,{activeExecution,evidence,state,activity,latestTrainingTerminal,
  capsuleLogical=ready.plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json'}){
  const current=await deps.readRegistry(ready.root);assert.equal(current.ok,true)
  const capsule=write(ready.root,capsuleLogical,{
   schemaVersion:'ai-painter-local-task-capsule-v1',taskId:ready.plan.runId,integrity:{status:'verified'},
   evidence:[{...evidence,kind:'ecology_managed_lifecycle_evidence',sha256Verified:true},
    {...ready.packageBinding,kind:'execution_package',sha256Verified:true}]})
  const result=await deps.advanceRegistry({projectRoot:ready.root,capabilityVersion:CAPABILITY,packageId:ready.plan.packageId,
   taskId:ready.plan.runId,taskKind:'mvp256_dry_factorized_ecology_training',taskGoal:'Bounded original natural world training and fixed review.',
   priority:5,queueStatus:state==='executing'?'running':state,nextMachineAction:null,queuedAtUtc:new Date().toISOString(),
   runId:ready.plan.runId,lifecycleStage:'dry_single_world_256x192',executionState:state,activity,
   taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,activeExecution,
   ...(latestTrainingTerminal?{latestTrainingTerminal}:{}),expectedPreviousRegistryRevision:current.registry.registryRevision,
   expectedPreviousRegistrySha256:current.registrySha256})
  assert.equal(result.ok,true);return result
 }
 function heartbeat(context,ready,identity){
  context.heartbeat()
  const file=inside(ready.root,ready.plan.outputRoot+'/heartbeat.json'),value=JSON.parse(fs.readFileSync(file,'utf8'))
  for(const key of ['capabilityVersion','runId','packageId','processId','processStartIdentity'])assert.equal(value[key],identity[key])
  value.heartbeatAtUtc=new Date().toISOString()
  const staged=file+'.staged-'+crypto.randomUUID();fs.writeFileSync(staged,JSON.stringify(value),{flag:'wx'})
  replaceHeartbeatFile(staged,file)
 }
 async function preflight(context){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready
  const presentation=deps.createPresentation(ready.input)
  write(root,plan.outputRoot+'/package.json',presentation)
  const result=await deps.runNative({root,outputRoot:plan.outputRoot,phase:'cpu',executable:inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),
   args:['-B',inside(root,plan.programBindings.worker.path),'--preflight','--package',packageBinding.path,'--sha256',packageBinding.sha256],
   onHeartbeat:context.heartbeat})
  assert.equal(JSON.parse(result.stdout).status,'own_ecology_entry_preflight_passed_not_gpu_qualified')
  assert.equal(JSON.parse(result.stdout).gpuInitialized,false)
  return withNativeReceiptBudget(root,result.ownedReceipt,async()=>({status:'passed',preflight:write(root,plan.outputRoot+'/preflight.json',
   {status:'passed',executionPackage:packageBinding,ownedReceipt:result.receiptBinding,gpuQualified:false})}))
 }
 async function execute(context){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready,current=await deps.readRegistry(root)
  assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null)
  write(root,plan.outputRoot+'/execution-consumed.json',{executionPackage:packageBinding,attempt:1,automaticRetries:0})
  const identity={capabilityVersion:CAPABILITY,runId:plan.runId,packageId:plan.packageId,
   processId:process.pid,processStartIdentity:deps.processIdentity(process.pid)}
  const lock=write(root,plan.outputRoot+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity})
  write(root,plan.outputRoot+'/heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,
   executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120})
  const active=deps.createActiveIdentity(ready.input,{...identity,executionState:'executing',programBindings:plan.programBindings,
   lock,heartbeat:{path:plan.outputRoot+'/heartbeat.json',ttlSeconds:120}})
  const dispatch=write(root,plan.outputRoot+'/dispatched.json',{status:'qualification_pending',executionState:'completed',
   completedAction:'execution_dispatch_record_only_not_training',runId:plan.runId,
   executionPackage:packageBinding,trainingStarted:false})
  await advance(context,ready,{activeExecution:active,evidence:dispatch,state:'executing',activity:'gpu_qualification_pending'})
  const executable=inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),base=['--package',packageBinding.path,'--sha256',packageBinding.sha256]
  let lastReceipt=null,phase='qualification'
  try{
   const gate=await deps.runNative({root,outputRoot:plan.outputRoot,phase,executable,
    args:['-B',inside(root,plan.programBindings.gpuQualifier.path),...base],onHeartbeat:()=>heartbeat(context,ready,identity)})
   lastReceipt=gate.ownedReceipt
   const gpu=JSON.parse(gate.stdout);deps.verifyGpuOutcome(ready,gpu)
   const admission=await withNativeReceiptBudget(root,gate.ownedReceipt,()=>write(root,plan.outputRoot+'/gpu-acceptance.json',{
    schema:'ecology-regime-owned-gpu-acceptance-v1',status:'passed',executionPackage:packageBinding,
    programBindings:plan.programBindings,report:gpu,ownedReceipt:gate.receiptBinding}))
   phase='training';lastReceipt=null
   const trained=await deps.runNative({root,outputRoot:plan.outputRoot,phase,executionPlan:plan,executable,
    args:['-B',inside(root,plan.programBindings.worker.path),...base,'--gpu',admission.path,'--gpu-sha256',admission.sha256],
    onHeartbeat:()=>heartbeat(context,ready,identity)})
   lastReceipt=trained.ownedReceipt
   const terminal=JSON.parse(trained.stdout),body=json(root,terminal);deps.validateCompleted(body,packageBinding,plan)
   await withNativeReceiptBudget(root,trained.ownedReceipt,()=>advance(context,ready,{activeExecution:null,evidence:terminal,state:'completed',
    activity:'training_completed_review_pending',latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}}))
   return {status:'passed',workerTerminal:terminal,ownedReceipt:trained.receiptBinding}
  }catch(error){
   let terminal=null,body=null
   try{terminal=bind(root,plan.outputRoot+'/worker-terminal.json');body=json(root,terminal)
    assert.equal(body.runId,plan.runId);assert.equal(body.capabilityVersion,CAPABILITY)
    assert.equal(body.packageId,plan.packageId);assert.deepEqual(body.executionPackage,packageBinding)
    assert.ok(['failed_closed','training_completed_review_pending'].includes(body.status))
   }catch{terminal=null;body=null}
   const persist=async()=>{
    const failure=write(root,plan.outputRoot+'/execution-failure.json',{status:'failed_closed',executionState:'failed_closed',phase,
     runId:plan.runId,capabilityVersion:CAPABILITY,packageId:plan.packageId,executionPackage:packageBinding,workerTerminal:terminal,
     optimizerStepsGenerator:body?.optimizerStepsGenerator??null,optimizerStepsDiscriminator:body?.optimizerStepsDiscriminator??null,
     completedEpochs:body?.completedEpochs??null,error:String(error),cleanupConfirmed:cleanupForCurrentCall(error,lastReceipt),automaticRetries:0})
    if(cleanupForCurrentCall(error,lastReceipt))await advance(context,ready,{activeExecution:null,evidence:failure,state:'failed_closed',activity:'failed_closed',
     ...(terminal?{latestTrainingTerminal:{runId:plan.runId,...terminal,status:body.status}}:{})})
   }
   const receipt=error.ownedReceipt?.outputAccountingRoots?error.ownedReceipt:lastReceipt
   try{if(receipt)await withNativeReceiptBudget(root,receipt,persist);else await persist()}catch(secondary){error.secondaryEvidenceError=String(secondary)}
   throw error // Unknown cleanup keeps the active identity and guard, no replay.
  }
 }
 async function validate(context){
  const ready=deps.loadContext(context),terminal=bind(ready.root,ready.plan.outputRoot+'/worker-terminal.json')
  const body=json(ready.root,terminal);deps.validateCompleted(body,ready.packageBinding,ready.plan)
  for(const record of body.checkpoints)read(ready.root,record.checkpoint)
  return {status:'passed',workerTerminal:terminal}
 }
 async function review(context){
  const ready=deps.loadContext(context),{root,plan,packageBinding}=ready
  const terminal=bind(root,plan.outputRoot+'/worker-terminal.json')
  let result=null
  try{
   // Node is the one retained root; its Python child and JS audits share the
   // same 120-second private Job and output accounting, not a second runner.
   result=await deps.runNative({root,outputRoot:plan.outputRoot+'/dry-review-owned',phase:'review',executable:process.execPath,
    args:[inside(root,plan.programBindings.reviewDriver.path),'--package',packageBinding.path,'--sha256',packageBinding.sha256,
     '--terminal',terminal.path,'--terminal-sha256',terminal.sha256],onHeartbeat:context.heartbeat})
   const coreBinding=JSON.parse(result.stdout),core=json(root,coreBinding)
   assert.equal(coreBinding.path,plan.outputRoot+'/dry-review/machine-audit-core.json')
   assert.equal(core.schema,'ecology-regime-machine-audit-core-v1');assert.equal(core.capabilityVersion,CAPABILITY)
   assert.deepEqual(core.executionPackage,packageBinding);assert.equal(core.runId,plan.runId)
   assert.equal(core.formalStage4QualificationGranted,false);assert.equal(core.runtimePublicationGranted,false)
   return await withNativeReceiptBudget(root,result.ownedReceipt,async()=>{
    const audit=write(root,plan.outputRoot+'/dry-review/machine-audit.json',{schema:'ecology-regime-machine-audit-v1',
     status:core.status,runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:packageBinding,
     core:coreBinding,input:core.input,selectedCheckpoint:core.selectedCheckpoint,nativeOwnedReceipt:result.receiptBinding,
     formalStage4QualificationGranted:false,runtimePublicationGranted:false})
    return {status:'passed',reviewOutcome:core.status==='dry_single_world_review_failed_closed'?'machine_reviews_failed':'machine_reviews_completed',audit}
   })
  }catch(error){
   if(cleanupForCurrentCall(error,result?.ownedReceipt)){
    const owned=error.ownedReceipt??result.ownedReceipt
    const capsuleLogical=plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json'
    try{await withNativeReceiptBudget(root,owned,async()=>{
     const failure=write(root,plan.outputRoot+'/dry-review-owned/review-failure.json',{
      schema:'ecology-regime-review-failure-v1',runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,
      executionPackage:packageBinding,workerTerminal:terminal,status:'review_execution_failed_closed',executionState:'failed_closed',
      error:String(error),nativeOwnedReceipt:error.receiptBinding??result?.receiptBinding??null,automaticRetries:0,
      formalStage4QualificationGranted:false,runtimePublicationGranted:false})
     await advance(context,ready,{activeExecution:null,evidence:failure,state:'failed_closed',activity:'review_execution_failed_closed',capsuleLogical})
    },[capsuleLogical])}catch(secondary){error.secondaryEvidenceError=String(secondary)}
   }
   throw error
  }
 }
 async function adjudicate(context){
  const ready=deps.loadContext(context),audit=bind(ready.root,ready.plan.outputRoot+'/dry-review/machine-audit.json')
  const body=json(ready.root,audit)
  assert.equal(body.schema,'ecology-regime-machine-audit-v1');assert.deepEqual(body.executionPackage,ready.packageBinding)
  assert.equal(body.formalStage4QualificationGranted,false);assert.equal(body.runtimePublicationGranted,false)
  const core=json(ready.root,body.core)
  assert.equal(core.schema,'ecology-regime-machine-audit-core-v1');assert.equal(core.status,body.status)
  for(const key of ['runId','packageId','capabilityVersion','executionPackage','input','selectedCheckpoint',
   'formalStage4QualificationGranted','runtimePublicationGranted'])assert.deepEqual(body[key],core[key])
  read(ready.root,body.nativeOwnedReceipt)
  return {status:'passed',audit,decision:body.status}
 }
 async function finalize(context){
  await adjudicate(context) // Rehash core and wrapper before committing a terminal.
  const ready=deps.loadContext(context),auditBinding=bind(ready.root,ready.plan.outputRoot+'/dry-review/machine-audit.json')
  const audit=json(ready.root,auditBinding),receipt=json(ready.root,audit.nativeOwnedReceipt)
  assert.equal(receipt.phase,'review');assert.equal(receipt.cleanupConfirmed,true)
  assert.equal(receipt.proof.activeProcessesAfterCleanup,0)
  assert.ok(receipt.outputAccountingRoots.includes(ready.plan.outputRoot+'/dry-review-owned'))
  assert.ok(receipt.outputAccountingRoots.includes(ready.plan.outputRoot+'/dry-review'))
  const completed=audit.status==='dry_single_world_numeric_passed_visual_approval_pending'
  assert.ok(completed||audit.status==='dry_single_world_review_failed_closed','unknown machine review state')
  const finalLogical=ready.plan.outputRoot+'/finalization.json',capsuleLogical=ready.plan.outputRoot+'/capsule-'+crypto.randomUUID()+'.json'
  return withNativeReceiptBudget(ready.root,receipt,async()=>{
   const finalization=write(ready.root,finalLogical,{
    schema:'ecology-regime-managed-review-terminal-v1',status:audit.status,executionState:completed?'completed':'failed_closed',
    runId:ready.plan.runId,packageId:ready.plan.packageId,capabilityVersion:CAPABILITY,executionPackage:ready.packageBinding,
    workerTerminal:bind(ready.root,ready.plan.outputRoot+'/worker-terminal.json'),audit:auditBinding,reviewReport:audit.input,
    automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false})
   await advance(context,ready,{activeExecution:null,evidence:finalization,state:completed?'completed':'failed_closed',activity:audit.status,capsuleLogical})
   return completed?{status:'passed',finalization}:{status:'failed',failureKind:'visual',failureCode:'dry_review_failed',
    summaryZh:'原审核器拒绝当前场景；本路线结束，不续训、不授予资格。',finalization}
  },[finalLogical,capsuleLogical])
 }
 return {preflight,execute,validate,review,adjudicate,finalize}
}

const production=createPhaseAdapters()
export const {preflight,execute,validate,review,adjudicate,finalize}=production
