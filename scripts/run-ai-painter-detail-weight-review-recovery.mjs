// One read-only recovery of an interrupted review; never dispatches training.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads'
import {bind,json,read,write,inside,CAPABILITY,validateCompleted} from './lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs'
import {runNative,auditReviewReport,priorReviewBudget,withNativeReceiptBudget} from './run-ai-painter-mvp256-dry-detail-weight-capture-training.mjs'
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from '../src/server/ai-painter-current-execution-registry.mjs'
import {processIdentity} from './run-ai-painter-mvp256-dry-v24-training.mjs'
import {replaceHeartbeatFile} from './run-ai-painter-learning-capacity-experiment.mjs'

export const SOURCE_RUN='mvp256-dry-detail-weight-capture-t65-20261009031741'
export const BASE=`.runtime/ai-painter/detail-weight-capture-managed-executions/${SOURCE_RUN}`
export const RECOVERY=`${BASE}/review-recovery-v1`
export const CONTROLLER='.runtime/ai-painter/review-directory-recovery-t-q4-66'
const ROLES={reviewRecovery:'ml/ai-painter/scripts/detail_weight_review_recovery.py',reviewRecoveryTests:'ml/ai-painter/tests/test_detail_weight_review_recovery.py',reviewRecoveryRunner:'scripts/run-ai-painter-detail-weight-review-recovery.mjs',reviewRecoveryRunnerTests:'scripts/tests/ai-painter-detail-weight-review-recovery.test.mjs'}

export function currentPrograms(root,original){
 const programs={...original.programBindings}
 for(const role of ['worker','cpuReview','adapter'])programs[role]=bind(root,original.programBindings[role].path)
 for(const [role,file]of Object.entries(ROLES))programs[role]=bind(root,file)
 for(const bound of Object.values(programs))read(root,bound)
 return programs
}
export function verifyRecoveryShape(plan,original,terminal){
 assert.equal(plan.schema,'detail-weight-review-recovery-plan-v1')
 for(const name of ['runId','packageId','capabilityVersion'])assert.equal(plan[name],original[name])
 assert.equal(plan.runId,SOURCE_RUN);assert.equal(plan.capabilityVersion,CAPABILITY)
 assert.equal(plan.outputRoot,`${original.outputRoot}/review-recovery-v1/dry-review`)
 assert.deepEqual(plan.budget,{maxWallSeconds:120,maxOutputMiB:16,cpuThreads:2,maxModelForwardCalls:16})
 for(const key of ['gpuAllowed','formalQualificationAllowed','runtimePublicationAllowed'])assert.equal(plan[key],false)
 assert.equal(plan.optimizerSteps,0);assert.equal(plan.automaticRetries,0)
 validateCompleted(terminal,plan.sourceExecutionPackage,original)
 const roles=new Set(['worker','cpuReview','adapter'])
 assert.equal(plan.historicalProgramSnapshots.length,roles.size)
 for(const row of plan.historicalProgramSnapshots){assert.ok(roles.delete(row.role));assert.deepEqual(row.originalBinding,original.programBindings[row.role]);assert.equal(row.snapshotBinding.sha256,row.originalBinding.sha256);assert.ok(row.snapshotBinding.path.startsWith(CONTROLLER+'/snapshots/'))}
 assert.equal(roles.size,0)
 assert.deepEqual(Object.keys(plan.programBindings).sort(),[...Object.keys(original.programBindings),...Object.keys(ROLES)].sort())
 for(const [role,b]of Object.entries(original.programBindings))assert.deepEqual(plan.programBindings[role],['worker','cpuReview','adapter'].includes(role)?{path:b.path,sha256:plan.programBindings[role].sha256}:b)
 return plan
}
function source(root){
 const terminalBinding=bind(root,BASE+'/worker-terminal.json'),terminal=json(root,terminalBinding)
 const packageBinding=terminal.executionPackage,packageBody=json(root,packageBinding)
 const plans=packageBody.inputEvidence.filter(b=>b.path===BASE+'/detail-weight-capture-plan.json');assert.equal(plans.length,1)
 const original=json(root,plans[0]);validateCompleted(terminal,packageBinding,original)
 const failure=bind(root,`.runtime/ai-painter/autonomous-closed-loop-executions/${original.packageId}/phase-evidence/review-attempt-0.json`)
 const evidence=json(root,failure);assert.equal(evidence.phase,'review');assert.equal(evidence.result.failureCode,'adapter_exception')
 const prior=bind(root,BASE+'/dry-review-owned/owned-review-85c7c473-4690-494f-88c8-bf596f4ba78a/release-receipt.json')
 priorReviewBudget(root,RECOVERY+'/dry-review-owned',prior)
 for(const cp of terminal.checkpoints)read(root,cp.checkpoint)
 return {original,terminal,terminalBinding,packageBinding,planBinding:plans[0],failure,prior}
}
export async function prepare(root){
 const current=await readCurrentExecutionRegistry(root);assert.equal(current.ok,true);assert.equal(current.registry.activeExecution,null);assert.equal(current.registry.runId,SOURCE_RUN)
 const src=source(root),snapshots=json(root,bind(root,CONTROLLER+'/source-snapshots.json'))
 const historicalProgramSnapshots=['worker','cpuReview','adapter'].map(role=>{const row=snapshots.rows.find(x=>x.originalBinding.path===src.original.programBindings[role].path);assert.deepEqual(row.originalBinding,src.original.programBindings[role]);read(root,row.snapshotBinding);return {role,...row}})
 const programs=currentPrograms(root,src.original),acceptanceBinding=bind(root,CONTROLLER+'/cpu-final-v2/acceptance.json'),acceptance=json(root,acceptanceBinding)
 assert.equal(acceptance.status,'passed');assert.deepEqual(acceptance.programBindings,programs)
 const plan={schema:'detail-weight-review-recovery-plan-v1',runId:SOURCE_RUN,packageId:src.original.packageId,capabilityVersion:CAPABILITY,outputRoot:RECOVERY+'/dry-review',sourceExecutionPackage:src.packageBinding,sourceTrainingPlan:src.planBinding,sourceWorkerTerminal:src.terminalBinding,sourceReviewFailure:src.failure,priorReviewReceipt:src.prior,historicalProgramSnapshots,programBindings:programs,cpuAcceptance:acceptanceBinding,reviewSpecification:bind(root,'docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md'),budget:{maxWallSeconds:120,maxOutputMiB:16,cpuThreads:2,maxModelForwardCalls:16},optimizerSteps:0,automaticRetries:0,gpuAllowed:false,formalQualificationAllowed:false,runtimePublicationAllowed:false}
 verifyRecoveryShape(plan,src.original,src.terminal)
 return write(root,RECOVERY+'/plan.json',plan)
}
export function checkReviewDeadline(deadline){assert.ok(Date.now()<deadline,'cumulative review wall budget exceeded')}

export function auditBeforeDeadline(ready,result,outputRoot,deadline){
 checkReviewDeadline(deadline)
 // These auditors are in-process JS/sharp consumers, not child processes.
 // A disposable worker makes their async work cancellable before finalization.
 return new Promise((resolve,reject)=>{
  const thread=new Worker(new URL(import.meta.url),{workerData:{mode:'audit',ready,result,outputRoot,deadline},stdout:true,stderr:true,env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',VIPS_CONCURRENCY:'2'}})
  let settled=false,bytes=0
  const finish=async(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);try{await thread.terminate()}catch(cleanup){error??=cleanup}error?reject(error):resolve(value)}
  const timer=setTimeout(()=>{void finish(new Error('cumulative review wall timeout during machine audit'))},Math.max(1,deadline-Date.now()))
  for(const stream of [thread.stdout,thread.stderr])stream.on('data',raw=>{bytes+=raw.length;if(bytes>65536)void finish(new Error('audit worker stream bound exceeded'))})
  thread.once('message',message=>{void finish(message.ok?null:new Error(message.error),message.value)})
  thread.once('error',error=>{void finish(error)})
  thread.once('exit',code=>{if(!settled)void finish(new Error('audit worker exited without result: '+code))})
 })
}
async function publish(root,plan,terminalBinding,{state,activity,active=null,suffix='terminal',deadline=null}){
 if(deadline!==null)checkReviewDeadline(deadline)
 const current=await readCurrentExecutionRegistry(root);assert.equal(current.ok,true);assert.equal(current.registry.runId,plan.runId)
 assert.deepEqual({path:current.registry.latestTrainingTerminal.path,sha256:current.registry.latestTrainingTerminal.sha256},plan.sourceWorkerTerminal)
 const capsule=write(root,RECOVERY+`/${suffix}-capsule.json`,{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:SOURCE_RUN+'-review-recovery-v1',integrity:{status:'verified'},evidence:[{...terminalBinding,kind:'detail_weight_review_terminal',sha256Verified:true},{...bind(root,BASE+'/package.json'),kind:'execution_package',sha256Verified:true}]})
 if(deadline!==null)checkReviewDeadline(deadline)
 const changed=await advanceCurrentExecutionRegistry({projectRoot:root,capabilityVersion:CAPABILITY,packageId:plan.packageId,runId:plan.runId,taskId:SOURCE_RUN+'-review-recovery-v1',taskKind:'mvp256_dry_detail_weight_review_recovery',taskGoal:'Recover fixed CPU review of completed weights; no training or model change.',priority:5,queueStatus:active?'running':state,nextMachineAction:null,queuedAtUtc:new Date().toISOString(),lifecycleStage:'dry_single_world_256x192',executionState:state,activity,taskCapsulePath:capsule.path,terminalEvidencePath:terminalBinding.path,activeExecution:active,expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256})
 assert.equal(changed.ok,true)
 if(deadline!==null)checkReviewDeadline(deadline)
 return changed
}
function wrapper(plan,status,state,extra={}){return {schema:'detail-weight-managed-review-terminal-v1',runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:plan.sourceExecutionPackage,workerTerminal:plan.sourceWorkerTerminal,status,executionState:state,formalStage4QualificationGranted:false,runtimePublicationGranted:false,...extra}}
export async function execute(root,planBinding){
 const plan=json(root,planBinding),src=source(root);verifyRecoveryShape(plan,src.original,src.terminal)
 assert.deepEqual(plan.programBindings,currentPrograms(root,src.original));read(root,plan.reviewSpecification);read(root,plan.cpuAcceptance)
 const before=await readCurrentExecutionRegistry(root);assert.equal(before.ok,true);assert.equal(before.registry.activeExecution,null)
 assert.deepEqual({path:before.registry.latestTrainingTerminal.path,sha256:before.registry.latestTrainingTerminal.sha256},src.terminalBinding)
 assert.equal(fs.existsSync(inside(root,'.runtime/ai-painter/owned-worker-guards/active.json')),false)
 const claim=write(root,RECOVERY+'/consumed.json',{schema:'detail-weight-review-recovery-consumed-v1',plan:planBinding,attempt:1,automaticRetries:0})
 const started=Date.now(),remaining=priorReviewBudget(root,RECOVERY+'/dry-review-owned',plan.priorReviewReceipt).remainingMs
 const deadline=started+remaining
 const originalFailure=write(root,RECOVERY+'/source-failure.json',{schema:'detail-weight-review-failure-v1',runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:plan.sourceExecutionPackage,workerTerminal:plan.sourceWorkerTerminal,status:'review_execution_failed_closed',executionState:'failed_closed',phase:'review',failureKind:'program',failureCode:'adapter_exception',error:'Original review stopped before output: empty accounting root was treated as consumed.',source:plan.sourceReviewFailure,nativeOwnedReceipt:plan.priorReviewReceipt,historicalReceiptOnly:true})
 const originalEnd=write(root,RECOVERY+'/source-failure-terminal.json',wrapper(plan,'review_execution_failed_closed','failed_closed',{reviewFailure:originalFailure,reviewRecoveryPlan:planBinding}))
 await publish(root,plan,originalEnd,{state:'failed_closed',activity:'review_execution_failed_closed',suffix:'source-failure'})
 const identity={runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,processId:process.pid,processStartIdentity:processIdentity(process.pid)}
 const lock=write(root,RECOVERY+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity})
 const heartPath=RECOVERY+'/heartbeat.json'
 const beat=()=>{const target=inside(root,heartPath),pending=target+'.staged-'+cryptoId();fs.writeFileSync(pending,JSON.stringify({schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'reviewing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120}),{flag:'wx'});replaceHeartbeatFile(pending,target)}
 beat()
 const active={schemaVersion:'ai-painter-current-active-execution-v1',...identity,executionState:'reviewing',programLineage:plan.programBindings,lock,heartbeat:{path:heartPath,ttlSeconds:120}}
 await publish(root,plan,originalEnd,{state:'reviewing',activity:'cpu_review_recovery_running',active,suffix:'started'})
 let result=null
 try{
  checkReviewDeadline(deadline-2000)
  result=await runNative({root,outputRoot:RECOVERY+'/dry-review-owned',phase:'review',priorReviewReceipt:plan.priorReviewReceipt,priorReviewFailure:plan.sourceReviewFailure,executable:inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),args:['-B',inside(root,plan.programBindings.cpuReview.path),'--package',plan.sourceExecutionPackage.path,'--sha256',plan.sourceExecutionPackage.sha256,'--terminal',plan.sourceWorkerTerminal.path,'--terminal-sha256',plan.sourceWorkerTerminal.sha256,'--recovery-plan',planBinding.path,'--recovery-sha256',planBinding.sha256],onHeartbeat:beat,abortReason:()=>Date.now()-started>=remaining-2000?'review_recovery_total_wall_timeout':null})
  const report=JSON.parse(result.stdout);read(root,report)
  const audited=await auditBeforeDeadline({root,plan:src.original,packageBinding:plan.sourceExecutionPackage},result,plan.outputRoot,deadline-2000)
  checkReviewDeadline(deadline)
  const audit=json(root,audited.audit),completed=audit.status==='dry_single_world_numeric_passed_visual_approval_pending'
  await withNativeReceiptBudget(root,result.ownedReceipt,async()=>{
   checkReviewDeadline(deadline)
   const end=write(root,RECOVERY+'/terminal.json',wrapper(plan,audit.status,completed?'completed':'failed_closed',{audit:audited.audit,reviewReport:report,reviewRecoveryPlan:planBinding,sourceReviewFailure:plan.sourceReviewFailure,optimizerSteps:0,gpuInitialized:false,claim}))
   await publish(root,plan,end,{state:completed?'completed':'failed_closed',activity:audit.status,deadline})
  })
  return {status:audit.status,audit:audited.audit,report,trainingRestarted:false,stage4Advanced:false}
 }catch(error){
  const owned=Object.hasOwn(error,'ownedReceipt')?error.ownedReceipt:result?.ownedReceipt
  if(owned?.cleanupConfirmed===true){
   try{await withNativeReceiptBudget(root,owned,async()=>{
    const failure=write(root,plan.outputRoot+'/review-failure.json',{schema:'detail-weight-review-failure-v1',runId:plan.runId,packageId:plan.packageId,capabilityVersion:CAPABILITY,executionPackage:plan.sourceExecutionPackage,workerTerminal:plan.sourceWorkerTerminal,status:'review_execution_failed_closed',executionState:'failed_closed',phase:'review',failureKind:'program',failureCode:'review_recovery_exception',error:String(error),workerStderrTail:owned.workerStderrTail??'',nativeOwnedReceipt:error.receiptBinding??result?.receiptBinding??null})
    const end=write(root,RECOVERY+'/failure-terminal.json',wrapper(plan,'review_execution_failed_closed','failed_closed',{reviewFailure:failure,reviewRecoveryPlan:planBinding,claim,precedingTerminal:fs.existsSync(inside(root,RECOVERY+'/terminal.json'))?bind(root,RECOVERY+'/terminal.json'):null}))
    await publish(root,plan,end,{state:'failed_closed',activity:'review_execution_failed_closed',suffix:'failure-terminal'})
   })}catch(secondary){error.secondaryEvidenceError=String(secondary)}
  }
  throw error
 }
}
function cryptoId(){return crypto.randomUUID()}
import crypto from 'node:crypto'
if(!isMainThread&&workerData?.mode==='audit'){
 try{checkReviewDeadline(workerData.deadline);const value=await auditReviewReport(workerData.ready,workerData.result,{outputRoot:workerData.outputRoot});checkReviewDeadline(workerData.deadline);parentPort.postMessage({ok:true,value})}catch(error){parentPort.postMessage({ok:false,error:String(error)})}
}else if(isMainThread&&process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [mode,logical,digest]=process.argv.slice(2);assert.ok(['--prepare','--execute'].includes(mode))
 process.stdout.write(JSON.stringify(mode==='--prepare'?await prepare(process.cwd()):await execute(process.cwd(),{path:logical,sha256:digest}))+'\n')
}
