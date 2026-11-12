import {SCHEMA,SPEC,ARCHIVES,LIMITS,loadReviewRecovery,verifyReviewRecoveryInputs} from "./ai-painter-ecology-terrain-detail-review-context.mjs";
export {remainingReviewBudget,validateRecoveryShape,loadReviewRecovery,reviewRecoveryNativeContext} from "./ai-painter-ecology-terrain-detail-review-context.mjs";
// Existing review recovery contract, using already saved native RGB evidence.
// No model execution, training, threshold change, retry or publication path.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import sharp from 'sharp'
import {bind,json,write,inside,sha,finalProgramBindings,withOutputBudget,
 CAPABILITY,ROLES}
 from './ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs'
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {processIdentity} from './windows-process-identity.mjs'
import {replaceHeartbeatFile} from "./training-heartbeat-publication.mjs"







function beforeDeadline(context){if(context.deadline!==undefined)assert.ok(Date.now()<context.deadline,'cumulative review deadline exhausted')}
export function withReviewRecoveryBudget(root,context,action){
 beforeDeadline(context)
 const receipt=context.nativeReceipt,observation=context.budgetObservation
 const roots=receipt?.outputAccountingRoots??observation?.roots??[context.plan.outputRoot,...context.prior.outputAccountingRoots]
 const maximum=receipt?receipt.budget.outputBytes-receipt.streamBytes.stdout-receipt.streamBytes.stderr:
  observation?.maximum??context.budget.outputBytes
 assert.ok(Number.isSafeInteger(maximum)&&maximum>65536&&maximum<=context.budget.outputBytes)
 return withOutputBudget({projectRoot:root,roots,maximum,reserveBytes:65536},action)
}

export function recoveryDeadlineOptions(context){beforeDeadline(context);return {deadlineUnixMs:context.deadline??null}}

export async function preserveRecoveryFailure(primary,record){
 try{await record()}catch(secondary){primary.secondaryEvidenceError=String(secondary)}
 throw primary
}





export function validateRecoveredCore(plan,binding,core){
 assert.equal(binding.path,plan.outputRoot+'/dry-review/machine-audit-core.json')
 assert.equal(core.schema,'ecology-terrain-detail-weight-machine-audit-core-v1');assert.equal(core.capabilityVersion,CAPABILITY)
 assert.equal(core.runId,plan.runId);assert.equal(core.packageId,plan.packageId)
 assert.deepEqual(core.executionPackage,plan.sourceExecutionPackage);assert.deepEqual(core.selectedCheckpoint,plan.selectedCheckpoint)
 assert.deepEqual(core.input,plan.sourceReviewReport)
 assert.ok(['dry_single_world_review_failed_closed','dry_single_world_numeric_passed_visual_approval_pending'].includes(core.status))
 assert.equal(core.formalStage4QualificationGranted,false);assert.equal(core.runtimePublicationGranted,false)
 return core
}







export function recoveryOutputState(root,outputRoot){
 const file=inside(root,outputRoot)
 if(!fs.existsSync(file))return 'absent'
 const stat=fs.lstatSync(file);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'recovery output must be a plain directory')
 assert.equal(fs.readdirSync(file).length,0,'recovery identity already prepared or consumed')
 return 'empty'
}

export function assertFreshRecoveryOutput(root,outputRoot){
 const parent=inside(root,outputRoot),entries=fs.readdirSync(parent,{withFileTypes:true})
 for(const entry of entries){
  const file=inside(root,outputRoot+'/'+entry.name),stat=fs.lstatSync(file)
  assert.equal(stat.isSymbolicLink(),false,'recovery output redirect refused')
  if(entry.name==='plan.json'){assert.ok(stat.isFile());continue}
  assert.ok(['dry-review','dry-review-owned'].includes(entry.name)&&stat.isDirectory(),'recovery already consumed or partial')
  assert.equal(fs.readdirSync(file).length,0,'recovery already contains partial artifacts')
 }
}

export async function prepareReviewRecovery(root,runId,cpuAcceptance){
 const current=await readCurrentExecutionRegistry(root);assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null)
 assert.equal(current.registry.runId,runId);assert.equal(current.registry.activity,'review_execution_failed_closed')
 const failureBinding=current.registry.terminalEvidence,failure=json(root,{path:failureBinding.path,sha256:failureBinding.sha256})
 const worker={path:current.registry.latestTrainingTerminal.path,sha256:current.registry.latestTrainingTerminal.sha256},terminal=json(root,worker)
 const executionPackage=terminal.executionPackage,spec=json(root,executionPackage)
 const candidates=spec.inputEvidence.filter(b=>b.path.endsWith('/quality-plan.json'));assert.equal(candidates.length,1)
 const original=json(root,candidates[0]);assert.equal(original.runId,runId)
 const outputRoot=original.outputRoot+'/review-recovery-v1';recoveryOutputState(root,outputRoot)
 const plan={schema:SCHEMA,runId,packageId:original.packageId,capabilityVersion:CAPABILITY,taskId:runId+'-review-recovery-v1',outputRoot,
  sourceExecutionPackage:executionPackage,sourceTrainingPlan:candidates[0],sourceWorkerTerminal:worker,
  sourceReviewFailure:{path:failureBinding.path,sha256:failureBinding.sha256},priorReviewReceipt:failure.nativeOwnedReceipt,
  sourceReviewReport:bind(root,original.outputRoot+'/dry-review/cpu-review.json'),selectedCheckpoint:terminal.selectedCheckpointRecord.checkpoint,
  projection:bind(root,original.outputRoot+'/dry-review/auditor-input-1024.png'),historicalArchives:ARCHIVES.map(p=>bind(root,p)),
  programBindings:finalProgramBindings(root),reviewSpecification:bind(root,SPEC),cpuAcceptance,limits:LIMITS,
  gpuAllowed:false,formalQualificationAllowed:false,runtimePublicationAllowed:false}
 const expected={path:outputRoot+'/plan.json',sha256:sha(JSON.stringify(plan)+'\n')}
 const verified=verifyReviewRecoveryInputs(root,plan,expected)
 fs.mkdirSync(inside(root,outputRoot),{recursive:true})
 const binding=await withReviewRecoveryBudget(root,verified,()=>write(root,outputRoot+'/plan.json',plan))
 loadReviewRecovery(root,binding);return binding
}



async function publish(root,context,evidence,{state,activity,active=null,suffix}){
 beforeDeadline(context)
 const {plan}=context,current=await readCurrentExecutionRegistry(root,recoveryDeadlineOptions(context))
 assert.equal(current.ok,true);assert.equal(current.registry.runId,plan.runId)
 assert.deepEqual({path:current.registry.latestTrainingTerminal.path,sha256:current.registry.latestTrainingTerminal.sha256},plan.sourceWorkerTerminal)
 const capsule=withReviewRecoveryBudget(root,context,()=>write(root,plan.outputRoot+'/'+suffix+'-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:plan.taskId,
  integrity:{status:'verified'},evidence:[{...evidence,kind:'review_recovery_terminal',sha256Verified:true},
   {...plan.sourceExecutionPackage,kind:'execution_package',sha256Verified:true}]}))
 beforeDeadline(context)
 const result=await advanceCurrentExecutionRegistry({projectRoot:root,capabilityVersion:CAPABILITY,packageId:plan.packageId,runId:plan.runId,
  taskId:plan.taskId,taskKind:'ecology_terrain_detail_readonly_review_recovery',taskGoal:'Review immutable saved RGB and completed weights; no model execution or training.',
  priority:5,queueStatus:active?'running':state,nextMachineAction:null,queuedAtUtc:new Date().toISOString(),lifecycleStage:'dry_single_world_256x192',
  executionState:state,activity,taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,activeExecution:active,
  expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256,
  ...recoveryDeadlineOptions(context)})
 assert.equal(result.ok,true);return result
}

export async function recoverSavedAudits(root,planBinding,auditReviewCore){
 assert.equal(typeof auditReviewCore,'function','driver must supply its already evaluated audit implementation')
 const context=loadReviewRecovery(root,planBinding),{plan,ready}=context
 const start=json(root,bind(root,plan.outputRoot+'/execution-start.json'));context.deadline=start.startedAtUnixMs+context.budget.timeoutMs
 const current=await readCurrentExecutionRegistry(root,recoveryDeadlineOptions(context));assert.equal(current.ok,true)
 assert.equal(current.registry.taskId,plan.taskId);assert.equal(current.registry.activity,'cpu_review_recovery_running')
 assert.deepEqual(current.registry.activeExecution?.programLineage,plan.programBindings)
 const guard=json(root,bind(root,'.runtime/ai-painter/owned-worker-guards/active.json'))
 assert.equal(guard.runnerPid,current.registry.activeExecution.processId)
 assert.equal(guard.helperSha256,plan.programBindings.nativeRunner.sha256)
 assert.equal(guard.executableSha256,context.original.runtimeIdentity.node.sha256)
 assert.equal(guard.commandSha256,sha(JSON.stringify([inside(root,ROLES.reviewDriver),'--recover-audits',planBinding.path,planBinding.sha256])))
 assert.deepEqual(json(root,bind(root,plan.outputRoot+'/consumed.json')).plan,planBinding)
 sharp.concurrency(2)
 return auditReviewCore(ready,plan.sourceReviewReport,{outputRoot:plan.outputRoot+'/dry-review',projectionBinding:plan.projection})
}

export async function executeReviewRecovery(root,planBinding){
 const started=Date.now(),context=loadReviewRecovery(root,planBinding),{plan,budget}=context
 context.deadline=started+budget.timeoutMs
 const current=await readCurrentExecutionRegistry(root,recoveryDeadlineOptions(context));assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null)
 assert.equal(current.registry.terminalEvidence.sha256,plan.sourceReviewFailure.sha256)
 assert.equal(fs.existsSync(inside(root,'.runtime/ai-painter/owned-worker-guards/active.json')),false)
 assertFreshRecoveryOutput(root,plan.outputRoot)
 const claim=withReviewRecoveryBudget(root,context,()=>write(root,plan.outputRoot+'/consumed.json',{schema:'readonly-review-recovery-consumed-v1',plan:planBinding,attempt:1,automaticRetries:0}))
 const identity={runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,processId:process.pid,processStartIdentity:processIdentity(process.pid)}
 withReviewRecoveryBudget(root,context,()=>write(root,plan.outputRoot+'/execution-start.json',{startedAtUnixMs:started,processId:process.pid,processStartIdentity:identity.processStartIdentity}))
 await publish(root,context,plan.sourceReviewFailure,{state:'failed_closed',activity:'review_execution_failed_closed',suffix:'source-failure'})
 const lock=withReviewRecoveryBudget(root,context,()=>write(root,plan.outputRoot+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity}))
 const heartPath=plan.outputRoot+'/heartbeat.json'
 const beat=observation=>{if(observation)context.budgetObservation=observation
  const staged=heartPath+'.staged-'+crypto.randomUUID()
  withReviewRecoveryBudget(root,context,()=>write(root,staged,{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,
   executionState:'reviewing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120}))
  replaceHeartbeatFile(inside(root,staged),inside(root,heartPath))}
 beat();const active={schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'reviewing',programLineage:plan.programBindings,lock,heartbeat:{path:heartPath,ttlSeconds:120}}
 await publish(root,context,plan.sourceReviewFailure,{state:'reviewing',activity:'cpu_review_recovery_running',active,suffix:'started'})
 const {runNative,withNativeReceiptBudget,cleanupForCurrentCall}=await import('./ai-painter-ecology-terrain-detail-quality-owned-native-v1.mjs')
 let result=null
 try{
  result=await runNative({root,outputRoot:plan.outputRoot+'/dry-review-owned',phase:'review',reviewRecoveryPlan:planBinding,
   executable:process.execPath,args:[inside(root,ROLES.reviewDriver),'--recover-audits',planBinding.path,planBinding.sha256],onHeartbeat:beat,
   abortReason:()=>Date.now()>=started+budget.timeoutMs-1000?'cumulative_review_recovery_timeout':null})
  context.nativeReceipt=result.ownedReceipt
  const coreBinding=JSON.parse(result.stdout),core=json(root,coreBinding)
  validateRecoveredCore(plan,coreBinding,core)
  assert.ok(Date.now()-started<budget.timeoutMs,'cumulative review deadline exhausted before finalization')
  return await withNativeReceiptBudget(root,result.ownedReceipt,async()=>{
   const audit=write(root,plan.outputRoot+'/dry-review/machine-audit.json',{schema:'ecology-terrain-detail-weight-machine-audit-v1',status:core.status,
    runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:plan.sourceExecutionPackage,core:coreBinding,
    input:plan.sourceReviewReport,selectedCheckpoint:plan.selectedCheckpoint,nativeOwnedReceipt:result.receiptBinding,
    formalStage4QualificationGranted:false,runtimePublicationGranted:false})
   const terminal=write(root,plan.outputRoot+'/finalization.json',{schema:'ecology-terrain-detail-weight-quality-review-terminal-v1',
    runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:plan.sourceExecutionPackage,
    status:core.status,executionState:core.status==='dry_single_world_review_failed_closed'?'failed_closed':'completed',
    workerTerminal:plan.sourceWorkerTerminal,audit,reviewReport:plan.sourceReviewReport,reviewRecoveryPlan:planBinding,
    sourceReviewFailure:plan.sourceReviewFailure,claim,modelForwardCalls:0,optimizerSteps:0,gpuInitialized:false,automaticRetries:0,
    formalStage4QualificationGranted:false,runtimePublicationGranted:false})
   const body=json(root,terminal)
   await publish(root,context,terminal,{state:body.executionState,activity:core.status,suffix:'terminal'})
   return {status:core.status,terminal,audit,issueCodes:core.issueCodes,trainingRestarted:false,stage4Advanced:false,
    cumulativeWallMs:context.prior.elapsedMs+Date.now()-started}
  })
 }catch(error){
  return preserveRecoveryFailure(error,async()=>{if(cleanupForCurrentCall(error,result?.ownedReceipt)){
   const receipt=error.ownedReceipt??result.ownedReceipt
   context.nativeReceipt=receipt
   await withNativeReceiptBudget(root,receipt,async()=>{
    const failure=write(root,plan.outputRoot+'/recovery-failure.json',{schema:'ecology-decode1-weight-review-failure-v1',
     runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:plan.sourceExecutionPackage,
     workerTerminal:plan.sourceWorkerTerminal,sourceReviewFailure:plan.sourceReviewFailure,reviewRecoveryPlan:planBinding,
     status:'review_execution_failed_closed',executionState:'failed_closed',error:String(error),nativeOwnedReceipt:error.receiptBinding??result.receiptBinding,
     automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false})
    await publish(root,context,failure,{state:'failed_closed',activity:'review_execution_failed_closed',suffix:'failure'})
   })
  }})
 }
}

export async function recoveryCli(args,{auditReviewCore}={}){
 const [mode,...values]=args,root=process.cwd()
 if(mode==='--prepare-recovery'){assert.equal(values.length,3);return prepareReviewRecovery(root,values[0],{path:values[1],sha256:values[2]})}
 assert.equal(values.length,2);const b={path:values[0],sha256:values[1]}
 if(mode==='--execute-recovery')return executeReviewRecovery(root,b)
 assert.equal(mode,'--recover-audits');return recoverSavedAudits(root,b,auditReviewCore)
}
