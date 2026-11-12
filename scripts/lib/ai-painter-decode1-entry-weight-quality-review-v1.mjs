import {SUCCESSOR_CASE,EVIDENCE_ROOT,INDEPENDENT_CASE,INDEPENDENT_ADMISSION,REGISTRY_ROOT,PRIOR_ACCOUNTING,INDEPENDENT_POLICY,CONTROL_RESERVE_BYTES,HEARTBEAT_ENVELOPE_BYTES,OUTER_STREAM_ENVELOPE_BYTES,INDEPENDENT_LIMITS,SOURCE_RUN,RECOVERY_CAPABILITY,SCHEMA,SPEC,REVIEW_SPEC,independentOutputRoot,measureIndependentPrior,PRELAUNCH_BINDINGS,NORMATIVE,loadReviewRecovery} from "./ai-painter-decode1-entry-weight-quality-review-context.mjs";
export {HISTORY_ROOT,SUCCESSOR_CASE,LEGACY_RECOVERY_ROOT,INDEPENDENT_CASE,PRIOR_ACCOUNTING,INDEPENDENT_POLICY,CONTROL_RESERVE_BYTES,HEARTBEAT_ENVELOPE_BYTES,OUTER_STREAM_ENVELOPE_BYTES,INDEPENDENT_LIMITS,independentOutputRoot,independentBudgetFromFacts,measureIndependentPrior,PRELAUNCH_BINDINGS,loadSuccessorLedger,remainingRecoveryBudget,validateRecoveryPrograms,loadReviewRecovery,recoveryNativeContext} from "./ai-painter-decode1-entry-weight-quality-review-context.mjs";
// A child of the existing native Job, not an independently owned background.
// Python inference and unchanged JS machine audits share one review deadline.
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import sharp from 'sharp'
import {loadContext,inside,read,json,write,bind,sha,directoryBytes,withOutputBudget,ROLES}
 from './ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'
import {auditMvp256DetailSufficiency} from './ai-painter-mvp-detail-sufficiency-v1.mjs'
import {auditProfessionalAestheticFromFrozenContract} from './ai-painter-stage4-v2-machine-review-execution-v1.mjs'
import {decodeV17ResponsibilityArtifact} from './ai-painter-stage4-mvp-v17-responsibility-artifact.mjs'
import {decideMvp256DryReview} from './ai-painter-mvp256-dry-review-decision-v1.mjs'
import {readCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {processIdentity} from './windows-process-identity.mjs'
import {replaceHeartbeatFile} from "./training-heartbeat-publication.mjs"










const HEART_ROOT=INDEPENDENT_CASE+'/control-heartbeat'








export const RECOVERY_LIMITS=Object.freeze({maxWallMs:120000,maxOutputBytes:16777216,cpuThreads:2,modelForwardCalls:16,optimizerSteps:0,automaticRetries:0})






export function createIndependentHeartbeat({now=()=>performance.now()}={}){
 let last=null
 const clock=()=>{const t=now();assert.ok(Number.isFinite(t));if(last!==null)assert.ok(t>=last&&t-last<=5000,'independent heartbeat refresh late');return t}
 return {due(){const t=clock();return last===null||t-last>=1000},committed(){last=clock()},last(){return last}}
}



export function successorOutputRoot(identity){
 assert.match(identity,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u)
 return SUCCESSOR_CASE+'/review-v2-'+identity
}

export function verifyPrelaunchFailureFacts({plan,registry,consumed,lock,heartbeat,command,stderr,driver,native,processObservation,guardPresent,nativeNamespacePresent,entries,now=Date.now()}){
 assert.equal(registry.registryRevision,501);assert.equal(registry.taskId,plan.taskId)
 assert.equal(plan.runId,SOURCE_RUN);assert.equal(plan.capabilityVersion,RECOVERY_CAPABILITY)
 assert.equal(plan.processId,36592);assert.equal(plan.processStartIdentity,'36592:2026-10-21T18:43:42.0673890Z')
 const active=registry.activeExecution
 for(const key of ['runId','packageId','capabilityVersion','processId','processStartIdentity']){
  assert.equal(active?.[key],plan[key]);assert.equal(lock[key],plan[key]);assert.equal(heartbeat[key],plan[key])
 }
 assert.deepEqual(active.programLineage,plan.programBindings)
 assert.deepEqual(consumed.plan,PRELAUNCH_BINDINGS.plan);assert.equal(consumed.attempt,1);assert.equal(consumed.automaticRetries,0)
 assert.equal(processObservation.status,'dead','live, reused or indeterminate supervisor cannot close this case')
 assert.equal(guardPresent,false);assert.equal(nativeNamespacePresent,false)
 assert.deepEqual([...entries].sort(),['consumed.json','execution-lock.json','heartbeat.json','plan.json','started-capsule.json'])
 assert.ok(now-Date.parse(heartbeat.heartbeatAtUtc)>heartbeat.ttlSeconds*1000,'old heartbeat must expire')
 assert.equal(command.exitCode,13);assert.equal(command.stdoutBytes,0);assert.equal(Buffer.byteLength(stderr),command.stderrBytes)
 assert.deepEqual(command.command,['C:\\Program Files\\nodejs\\node.exe',ROLES.reviewDriver,'--recover-once',plan.cpuAcceptance.path,plan.cpuAcceptance.sha256])
 assert.match(stderr,/Detected unsettled top-level await/u);assert.match(stderr,/review-v1\.mjs:353/u)
 assert.equal(sha(driver),plan.programBindings.reviewDriver.sha256);assert.equal(sha(native),plan.programBindings.nativeRunner.sha256)
 const text=native.toString(),body=text.slice(text.indexOf('export async function runNative(options)'))
 const wait=body.indexOf("const entry=await import('./ai-painter-decode1-entry-weight-quality-review-v1.mjs')")
 assert.ok(wait>0&&wait<body.indexOf('fs.mkdirSync(guardRoot')&&body.indexOf('fs.mkdirSync(guardRoot')<body.indexOf('command=createNativeOwnerCommand(')&&body.indexOf('command=createNativeOwnerCommand(')<body.indexOf('child=spawn('))
 assert.match(driver.toString().split(/\r?\n/u)[352],/await recoverOnce\(process.cwd\(\),binding\)/u)
 return {nativeNotLaunched:true,nativeCleanupCertified:false}
}








export function assertFreshRecoveryDirectory(root,logical){
 assert.match(logical,new RegExp('^'+INDEPENDENT_CASE+'/review-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$','u'))
 assert.equal(fs.existsSync(inside(root,INDEPENDENT_ADMISSION+'/independent-consumed.json')),false,'independent review already consumed')
 const folder=inside(root,logical)
 if(!fs.existsSync(folder))return
 for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  assert.ok(['dry-review','dry-review-owned'].includes(entry.name)&&entry.isDirectory()&&!entry.isSymbolicLink(),'recovery already prepared or consumed')
  assert.equal(fs.readdirSync(inside(root,logical+'/'+entry.name)).length,0,'partial recovery evidence forbids replay')
 }
}





export function independentHeartbeatPath(plan){assert.equal(plan.outputRoot,independentOutputRoot(plan.recoveryId));return HEART_ROOT+'/'+plan.recoveryId+'/heartbeat.json'}
function controlBytes(context,extra=0){
 const {root,plan}=context
 let bytes=OUTER_STREAM_ENVELOPE_BYTES
 const heart=path.posix.dirname(independentHeartbeatPath(plan))
 if(context.heartbeatEstablished)assert.ok(fs.existsSync(inside(root,independentHeartbeatPath(plan))),'committed heartbeat disappeared')
 if(fs.existsSync(inside(root,heart))){const n=directoryBytes(inside(root,heart));assert.ok(n<=HEARTBEAT_ENVELOPE_BYTES);bytes+=n}
 for(const name of ['current.json','events.jsonl','registry.sqlite','registry.sqlite-wal','registry.sqlite-shm']){
  const f=inside(root,REGISTRY_ROOT+'/'+name),exists=fs.existsSync(f)
  if(['current.json','events.jsonl','registry.sqlite'].includes(name))assert.ok(exists,'required registry accounting file disappeared')
  if(exists){const s=fs.lstatSync(f);assert.ok(s.isFile()&&!s.isSymbolicLink());bytes+=s.size}
 }
 for(const id of context.controlTransactions??[]){assert.match(id,/^current-execution-registry-advance-[0-9TZ]+-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u);bytes+=directoryBytes(inside(root,REGISTRY_ROOT+'/transactions/'+id))}
 assert.ok(bytes+extra<=CONTROL_RESERVE_BYTES,'independent control-plane output reserve exhausted')
 return bytes
}
function publishHeartbeat(context,identity){
 const {root,plan}=context,heartPath=independentHeartbeatPath(plan),folder=path.posix.dirname(heartPath)
 const staged=heartPath+'.staged-'+crypto.randomUUID()
 fs.mkdirSync(inside(root,folder),{recursive:true})
 for(const item of fs.readdirSync(inside(root,folder)))assert.equal(item,'heartbeat.json','unknown/partial heartbeat evidence')
 const value={schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'reviewing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:120}
 const raw=Buffer.byteLength(JSON.stringify(value)+'\n');assert.ok(raw<=4096)
 controlBytes(context,raw)
 withOutputBudget({projectRoot:root,roots:[folder],maximum:HEARTBEAT_ENVELOPE_BYTES,reserveBytes:0},()=>write(root,staged,value))
 replaceHeartbeatFile(inside(root,staged),inside(root,heartPath))
 context.heartbeatEstablished=true
}

function recoveryWrite(context,action,{terminal=false}={}){
 const {root,plan,prior,budget,deadline,nativeReceipt,observation}=context
 assert.ok(Date.now()<deadline,'cumulative recovery record deadline exhausted')
 const current=measureIndependentPrior(root);assert.deepEqual(current.budget,context.budget)
 const roots=nativeReceipt?.outputAccountingRoots??observation?.roots??[plan.outputRoot,...context.accountingRoots]
 const maximum=nativeReceipt?nativeReceipt.budget.outputBytes-nativeReceipt.streamBytes.stdout-nativeReceipt.streamBytes.stderr:
  observation?.maximum??budget.outputBytes
 return withOutputBudget({projectRoot:root,roots,maximum,reserveBytes:terminal?0:65536},action)
}

async function publishRecovery(context,evidence,{state,activity,active=null,suffix}){
 const {root,plan,deadline}=context
 if(!context.heartbeatError)context.beat?.()
 controlBytes(context,512*1024)
 const current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert.equal(current.ok,true)
 assert.equal(current.registry.runId,plan.runId)
 assert.deepEqual({path:current.registry.latestTrainingTerminal.path,sha256:current.registry.latestTrainingTerminal.sha256},plan.sourceWorkerTerminal)
 const capsule=recoveryWrite(context,()=>write(root,plan.outputRoot+'/'+suffix+'-capsule.json',{
  schemaVersion:'ai-painter-local-task-capsule-v1',taskId:plan.taskId,integrity:{status:'verified'},
  evidence:[{...evidence,kind:'review_recovery_terminal',sha256Verified:true},{...plan.sourceExecutionPackage,kind:'execution_package',sha256Verified:true}]}))
 const prepared=await prepareCurrentExecutionRegistryAdvance({projectRoot:root,capabilityVersion:plan.capabilityVersion,packageId:plan.packageId,runId:plan.runId,
  taskId:plan.taskId,taskKind:'source_corrected_parent_readonly_review_recovery',taskGoal:'Review completed weights against the verified parent on the original eight validation rows.',
  priority:5,queueStatus:active?'running':state,nextMachineAction:null,queuedAtUtc:new Date().toISOString(),lifecycleStage:'dry_single_world_256x192',
  executionState:state,activity,taskCapsulePath:capsule.path,terminalEvidencePath:evidence.path,activeExecution:active,
  expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256,deadlineUnixMs:deadline})
 context.controlTransactions??=new Set();context.controlTransactions.add(prepared.transactionId)
 controlBytes(context)
 if(!context.heartbeatError)context.beat?.()
 const result=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:root,transactionId:prepared.transactionId,deadlineUnixMs:deadline,
  beforeAtomicWrite:(_logical,bytes)=>{controlBytes(context,bytes);assert.ok(Date.now()<deadline,'independent terminal deadline exhausted')}})
 assert.equal(result.ok,true);controlBytes(context)
}

export async function runIndependentReview(root,cpuAcceptance){
 // This single CLI call includes module imports, preparation, build and cleanup.
 const identity=processIdentity(process.pid),creation=Date.parse(identity.slice(identity.indexOf(':')+1))
 const current=await readCurrentExecutionRegistry(root);assert.equal(current.ok,true)
 assert.equal(current.registry.runId,SOURCE_RUN);assert.equal(current.registry.activeExecution,null)
 const previousAccount=json(root,PRIOR_ACCOUNTING)
 assert.deepEqual({path:current.registry.terminalEvidence.path,sha256:current.registry.terminalEvidence.sha256},previousAccount.newFailure)
 assert.equal(fs.existsSync(inside(root,'.runtime/ai-painter/owned-worker-guards/active.json')),false)
 const recoveryId=crypto.randomUUID(),outputRoot=independentOutputRoot(recoveryId)
 assertFreshRecoveryDirectory(root,outputRoot)
 const terminalBinding={path:current.registry.latestTrainingTerminal.path,sha256:current.registry.latestTrainingTerminal.sha256}
 const terminal=json(root,terminalBinding),pkg=json(root,terminal.executionPackage)
 const plans=pkg.inputEvidence.filter(b=>b.path.endsWith('/quality-plan.json'));assert.equal(plans.length,1)
 const previous=json(root,PRELAUNCH_BINDINGS.plan)
 const original=json(root,plans[0]),failureBinding=previous.sourceReviewFailure
 const failure=json(root,failureBinding)
 const programBindings=Object.fromEntries(Object.entries(original.programBindings).map(([role,b])=>[role,bind(root,b.path)]))
 const plan={schema:SCHEMA,runId:SOURCE_RUN,packageId:original.packageId,capabilityVersion:RECOVERY_CAPABILITY,
  recoveryId,outputRoot,taskId:SOURCE_RUN+'-independent-'+recoveryId,processId:process.pid,processStartIdentity:identity,startedAtUnixMs:creation,
  sourceExecutionPackage:terminal.executionPackage,sourceTrainingPlan:plans[0],sourceWorkerTerminal:terminalBinding,
  sourceReviewFailure:failureBinding,priorReviewReceipt:failure.nativeOwnedReceipt,selectedCheckpoint:terminal.selectedCheckpointRecord.checkpoint,
  sourcePreservation:bind(root,EVIDENCE_ROOT+'/all-original-source-preservation.json'),specification:SPEC,reviewSpecification:REVIEW_SPEC,
  cpuAcceptance,programBindings,historicalNormativeBindings:NORMATIVE,limits:INDEPENDENT_LIMITS,
  independentPolicy:INDEPENDENT_POLICY,priorAccounting:PRIOR_ACCOUNTING,gpuAllowed:false,formalQualificationAllowed:false,runtimePublicationAllowed:false}
 // Persist with an independent identity; write() is exclusive and never replaces evidence.
 const prior=json(root,plan.priorReviewReceipt),ledger=measureIndependentPrior(root),budget=ledger.budget
 Object.assign(plan,{priorBindings:PRELAUNCH_BINDINGS,priorAccountingRoots:ledger.roots})
 const planBinding={path:outputRoot+'/plan.json',sha256:sha(JSON.stringify(plan)+'\n')}
 const context={root,plan,prior,budget,deadline:creation+budget.timeoutMs,workDeadline:creation+budget.timeoutMs-15000,planBinding,accountingRoots:ledger.roots,wallDebitMs:ledger.wallDebitMs,controlTransactions:new Set()}
 for(const p of ledger.roots)fs.mkdirSync(inside(root,p),{recursive:true})
 fs.mkdirSync(inside(root,outputRoot),{recursive:true})
 recoveryWrite(context,()=>write(root,planBinding.path,plan))
 Object.assign(context,loadReviewRecovery(root,planBinding))
 const claimValue={schema:SCHEMA,plan:planBinding,attempt:1,automaticRetries:0}
 recoveryWrite(context,()=>write(root,INDEPENDENT_ADMISSION+'/independent-consumed.json',claimValue))
 const claim=recoveryWrite(context,()=>write(root,outputRoot+'/consumed.json',claimValue))
 const identityRecord={runId:SOURCE_RUN,packageId:plan.packageId,capabilityVersion:plan.capabilityVersion,processId:process.pid,processStartIdentity:identity}
 const lock=recoveryWrite(context,()=>write(root,outputRoot+'/execution-lock.json',{schemaVersion:'ai-painter-current-active-execution-lock-v1',...identityRecord}))
 const heartbeatPath=independentHeartbeatPath(plan),heartbeat=createIndependentHeartbeat()
 const beat=observation=>{
  if(context.heartbeatError)throw context.heartbeatError
  if(observation)context.observation=observation
  if(!heartbeat.due())return
  measureIndependentPrior(root);publishHeartbeat(context,identityRecord);heartbeat.committed()
 }
 context.beat=()=>{try{beat()}catch(error){context.heartbeatError??=error;throw error}}
 const active={schemaVersion:'ai-painter-current-active-execution-v1',...identityRecord,executionState:'reviewing',programLineage:programBindings,lock,heartbeat:{path:heartbeatPath,ttlSeconds:120}}
 const {runNative,withNativeReceiptBudget,cleanupForCurrentCall,verifiedPrelaunchFailure}=await import('./ai-painter-decode1-entry-weight-quality-owned-native-v1.mjs')
 let result=null,heartbeatTimer=null
 try{
  context.beat()
  // The existing managed call also owns asynchronous registry preparation.
  // Its timer ends in finally; synchronous checks/builds use the same pulse.
  heartbeatTimer=setInterval(()=>{if(!context.heartbeatError)try{context.beat()}catch{}},1000)
  await publishRecovery(context,plan.sourceReviewFailure,{state:'reviewing',activity:'cpu_review_recovery_running',active,suffix:'started'})
  if(context.heartbeatError)throw context.heartbeatError
  result=await runNative({root,outputRoot:outputRoot+'/dry-review-owned',phase:'review',reviewRecoveryPlan:planBinding,
   executable:process.execPath,args:[inside(root,ROLES.reviewDriver),'--independent-review-child',planBinding.path,planBinding.sha256],onHeartbeat:observation=>{try{beat(observation)}catch(error){context.heartbeatError??=error;throw error}},
   abortReason:()=>context.heartbeatError?'independent_heartbeat_failure':Date.now()>=context.workDeadline?'independent_review_work_timeout':null})
  context.nativeReceipt=result.ownedReceipt
  const coreBinding=JSON.parse(result.stdout),core=json(root,coreBinding)
  assert.equal(coreBinding.path,outputRoot+'/dry-review/machine-audit-core.json')
  assert.deepEqual(core.executionPackage,plan.sourceExecutionPackage);assert.deepEqual(core.selectedCheckpoint,plan.selectedCheckpoint)
  assert.ok(['dry_single_world_review_failed_closed','dry_single_world_numeric_passed_visual_approval_pending'].includes(core.status))
  return await withNativeReceiptBudget(root,result.ownedReceipt,async()=>{
   const terminal=recoveryWrite(context,()=>write(root,outputRoot+'/finalization.json',{
    schema:SCHEMA,status:core.status,executionState:core.status==='dry_single_world_review_failed_closed'?'failed_closed':'completed',
    ...identityRecord,executionPackage:plan.sourceExecutionPackage,workerTerminal:plan.sourceWorkerTerminal,
    sourceReviewFailure:plan.sourceReviewFailure,reviewRecoveryPlan:planBinding,claim,core:coreBinding,
    nativeOwnedReceipt:result.receiptBinding,selectedCheckpoint:plan.selectedCheckpoint,
    modelForwardCalls:16,optimizerSteps:0,gpuInitialized:false,automaticRetries:0,
    formalStage4QualificationGranted:false,runtimePublicationGranted:false}))
   const body=json(root,terminal)
   await publishRecovery(context,terminal,{state:body.executionState,activity:body.status,suffix:'terminal'})
   return {status:body.status,terminal,core:coreBinding,issueCodes:core.issueCodes,cumulativeWallMs:ledger.wallDebitMs+Date.now()-creation}
  })
 }catch(error){
  try{const prelaunch=verifiedPrelaunchFailure(error,root,planBinding)
  if(prelaunch){
   const failure=recoveryWrite(context,()=>write(root,outputRoot+'/prelaunch-failure.json',{
    schema:SCHEMA,status:'review_prelaunch_program_failed_closed',executionState:'failed_closed',...identityRecord,
    executionPackage:plan.sourceExecutionPackage,workerTerminal:plan.sourceWorkerTerminal,reviewRecoveryPlan:planBinding,
    sourceReviewFailure:plan.sourceReviewFailure,prelaunchProof:prelaunch,error:String(error),nativeReceipt:null,
    nativeNotLaunched:true,nativeCleanupCertified:false,modelForwardCalls:0,optimizerSteps:0,
    automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false}),{terminal:true})
   await publishRecovery(context,failure,{state:'failed_closed',activity:'review_prelaunch_program_failed_closed',suffix:'prelaunch-failure'})
   error.failureTerminal=failure
  }else if(cleanupForCurrentCall(error,result?.ownedReceipt)){
   const receipt=error.ownedReceipt??result.ownedReceipt;context.nativeReceipt=receipt
   await withNativeReceiptBudget(root,receipt,async()=>{
    const failure=recoveryWrite(context,()=>write(root,outputRoot+'/recovery-failure.json',{
     schema:SCHEMA,status:'review_execution_failed_closed',executionState:'failed_closed',...identityRecord,
     executionPackage:plan.sourceExecutionPackage,workerTerminal:plan.sourceWorkerTerminal,reviewRecoveryPlan:planBinding,
     sourceReviewFailure:plan.sourceReviewFailure,nativeOwnedReceipt:error.receiptBinding??result?.receiptBinding,
     error:String(error),workerStderrTail:result?.stderr?.slice(-4096)??error.stderr?.slice(-4096)??null,
     optimizerSteps:0,automaticRetries:0,formalStage4QualificationGranted:false,runtimePublicationGranted:false}),{terminal:true})
    await publishRecovery(context,failure,{state:'failed_closed',activity:'review_execution_failed_closed',suffix:'failure'})
   })
  }else{
   const unknown=recoveryWrite(context,()=>write(root,outputRoot+'/cleanup-unknown-failure.json',{
    schema:SCHEMA,status:'review_failure_cleanup_unknown_active_retained',executionState:'failed_closed',...identityRecord,
    executionPackage:plan.sourceExecutionPackage,workerTerminal:plan.sourceWorkerTerminal,reviewRecoveryPlan:planBinding,
    error:String(error).slice(0,4096),nativeOwnedReceipt:error.receiptBinding??result?.receiptBinding??null,
    activeExecutionRetained:true,nativeCleanupCertified:false,automaticRetries:0,
    formalStage4QualificationGranted:false,runtimePublicationGranted:false}),{terminal:true})
   error.failureEvidence=unknown
  }}catch(secondary){error.secondaryEvidenceError=String(secondary)}
  throw error
 }finally{if(heartbeatTimer!==null)clearInterval(heartbeatTimer)}
}

async function recoverChild(root,planBinding){
 const context=loadReviewRecovery(root,planBinding),{plan,original,workDeadline}=context
 const current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:workDeadline});assert.equal(current.ok,true)
 assert.equal(current.registry.taskId,plan.taskId);assert.equal(current.registry.activity,'cpu_review_recovery_running')
 assert.deepEqual(current.registry.activeExecution?.programLineage,plan.programBindings)
 assert.equal(current.registry.activeExecution.processId,plan.processId)
 const guard=json(root,bind(root,'.runtime/ai-painter/owned-worker-guards/active.json'))
 assert.equal(guard.runnerPid,plan.processId);assert.equal(guard.helperSha256,plan.programBindings.nativeRunner.sha256)
 assert.equal(guard.commandSha256,sha(JSON.stringify([inside(root,ROLES.reviewDriver),'--independent-review-child',planBinding.path,planBinding.sha256])))
 assert.equal(guard.executableSha256,original.runtimeIdentity.node.sha256)
 const claim=json(root,bind(root,plan.outputRoot+'/consumed.json'));assert.deepEqual(claim.plan,planBinding)
 sharp.concurrency(2)
 const result=spawnSync(original.runtimeIdentity.python.absolutePath,['-B',inside(root,ROLES.reviewWorker),
  '--package',plan.sourceExecutionPackage.path,'--sha256',plan.sourceExecutionPackage.sha256,
  '--terminal',plan.sourceWorkerTerminal.path,'--terminal-sha256',plan.sourceWorkerTerminal.sha256,
  '--recovery-plan',planBinding.path,'--recovery-sha256',planBinding.sha256],{
  cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1'},windowsHide:true,
  timeout:Math.max(1,workDeadline-Date.now()-1000),maxBuffer:context.budget.streamBytes,encoding:'utf8'})
 if(result.error)throw result.error
 assert.equal(result.status,0,result.stderr?.slice(-4096))
 const reportBinding=JSON.parse(result.stdout)
 assert.equal(reportBinding.path,plan.outputRoot+'/dry-review/cpu-review.json')
 assert.ok(Date.now()<workDeadline,'cumulative machine audit deadline exhausted')
 return auditReviewCore(context.ready,reportBinding,{outputRoot:plan.outputRoot+'/dry-review',recoveryPlan:planBinding})
}

export function auditReviewConditionAlignment(root,input){
 // Validate the registered physical mapping, but keep the auditor's project-
 // logical path contract. A mapped .runtime file is not an external input.
 for(const logical of [input.record.conditionBinding.conditionPackPath,input.imagePath,input.referenceImagePath])inside(root,logical)
 return auditAiAssistedConditionAlignment(input)
}

export async function auditReviewCore(ready,reportBinding,{outputRoot=null,projectionBinding=null,recoveryPlan=null}={}){
 const {root,plan,packageBinding}=ready,output=outputRoot??plan.outputRoot+'/dry-review'
 if(outputRoot!==null){
  if(recoveryPlan){const recovery=loadReviewRecovery(root,recoveryPlan);assert.deepEqual(recovery.original,plan);assert.equal(outputRoot,recovery.plan.outputRoot+'/dry-review')}
  else{assert.equal(outputRoot,plan.outputRoot+'/review-recovery-v1/dry-review');assert.ok(projectionBinding)}
 }
 const report=json(root,reportBinding),candidate=json(root,plan.sourceCandidate),scope=json(root,candidate.frozenBindings.dryScope)
 assert.equal(report.schema,'object-support-structure-quality-native-review-input-v1');assert.equal(report.capabilityVersion,plan.capabilityVersion)
 assert.equal(report.executionProfile,plan.executionProfile);assert.deepEqual(report.executionPackage,packageBinding)
 assert.equal(report.modelForwardCalls,16);assert.equal(report.optimizerSteps,0);assert.equal(report.gpuInitialized,false)
 const ids=json(root,plan.validationSplit).sampleIds;
 assert.ok(Array.isArray(report.validationImages)&&report.validationImages.length===8);
 assert.deepEqual(report.validationImages.map(row=>row.sampleId),ids);
 assert.deepEqual(report.validationImages.map(row=>row.binding),report.artifacts);
 for(const row of report.validationImages){
  assert.equal(row.split,'validation');assert.equal(row.epoch,24);assert.equal(row.optimizerStep,1152);
  assert.equal(row.purpose,'prediction');assert.deepEqual(row.checkpoint,report.selectedCheckpoint);
  read(root,row.binding);read(root,row.condition);read(root,row.originalRgb);
 }
 assert.equal(report.subject.sampleId,candidate.scope.subjectSampleId);assert.equal(report.subject.split,'validation')
 for(const key of ['worldId','regionId','tick','factHash','conditionPack'])assert.deepEqual(report.subject[key],scope.preselectedSubject[key])
 const roles=decodeV17ResponsibilityArtifact({archiveBytes:read(root,report.responsibility.archive),evidence:report.responsibility.evidence,
  expectedIdentity:{worldId:report.subject.worldId,regionId:report.subject.regionId,tick:report.subject.tick,factHash:report.subject.factHash,
   visualFactManifestSha256:report.subject.visualFactManifestSha256,conditionPackSha256:report.subject.conditionPack.sha256,
   modelStateSha256:report.subject.modelStateSha256},schemaBytes:read(root,report.responsibility.interface),
  schemaSha256:report.responsibility.interface.sha256,candidatePackSchemaVersion:json(root,report.responsibility.interface).candidatePackSchemaVersion})
 const bytes=read(root,report.candidateRgb),metadata=await sharp(bytes).metadata()
 assert.deepEqual([metadata.width,metadata.height],[256,192])
 // The unchanged 1024 condition auditor needs this projection only; it is not
 // a model output, a higher-resolution qualification, or a Runtime frame.
 const projectionBytes=await sharp(bytes).resize(1024,768,{kernel:'nearest'}).png().toBuffer()
 const projection=projectionBinding??write(root,output+'/auditor-input-1024.png',projectionBytes)
 if(projectionBinding){assert.equal(projection.path,plan.outputRoot+'/dry-review/auditor-input-1024.png');assert.deepEqual(read(root,projection),projectionBytes)}
 const thresholds=json(root,candidate.frozenBindings.numericReview),manifest=json(root,plan.datasetManifest)
 const source=json(root,manifest.sourceIndex),rows=source.samples.filter(row=>row.sampleId===report.subject.sampleId)
 assert.equal(rows.length,1);const row=rows[0]
 assert.equal(row.split,'validation');assert.deepEqual(row.image,report.subject.referenceRgb)
 const detail=await auditMvp256DetailSufficiency({candidatePath:inside(root,report.candidateRgb.path),referencePath:inside(root,row.image.path),
  contract:json(root,candidate.frozenBindings.detailReview)})
 const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:inside(root,report.candidateRgb.path),thresholdContract:thresholds,
  styleFingerprintPath:inside(root,thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
 const alignment=await auditReviewConditionAlignment(root,{record:{recordId:plan.runId+'-dry-review',
  conditionBinding:{conditionPackPath:report.subject.conditionPack.path,worldId:report.subject.worldId,tick:report.subject.tick},
  classification:{monsoonSeason:row.monsoonSeason,regionalLandscapeType:null}},imagePath:projection.path,referenceImagePath:row.image.path})
 const decision=decideMvp256DryReview({scope:scope.preselectedSubject,candidate:{sampleId:report.subject.sampleId,split:'validation',resolution:[256,192]},
  detail,aesthetic,alignment,responsibilityRoleCount:roles.roleOrder.length})
 assert.equal(typeof report.validationImprovedWithoutMeanRgbRegression,'boolean')
 if(!report.validationImprovedWithoutMeanRgbRegression){
  decision.status='dry_single_world_review_failed_closed';decision.issueCodes.push('validation_not_improved_without_mean_rgb_regression')
 }
 return write(root,output+'/machine-audit-core.json',{...decision,schema:'object-support-structure-machine-audit-core-v1',
  capabilityVersion:plan.capabilityVersion,executionProfile:plan.executionProfile,runId:plan.runId,packageId:plan.packageId,
  selectedCheckpoint:report.selectedCheckpoint,executionPackage:packageBinding,input:reportBinding,validationImages:report.validationImages,
  validationImprovedWithoutMeanRgbRegression:report.validationImprovedWithoutMeanRgbRegression,detail,aesthetic,alignment})
}

export async function runReview(packageBinding,terminalBinding,{root=process.cwd()}={}){
 const started=Date.now(),spec=json(root,packageBinding)
 const ready=loadContext({projectRoot:root,packageIdentity:spec.packageIdentity,capabilityVersion:spec.capabilityVersion,
  outputRoot:spec.outputRoot,inputEvidence:spec.inputEvidence})
 assert.deepEqual(ready.packageBinding,packageBinding)
 assert.equal(terminalBinding.path,ready.plan.outputRoot+'/worker-terminal.json');read(root,terminalBinding)
 const remaining=120000-(Date.now()-started)-1000
 assert.ok(remaining>0,'review setup deadline exhausted')
 const result=spawnSync(inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B',inside(root,ready.plan.programBindings.reviewWorker.path),
  '--package',packageBinding.path,'--sha256',packageBinding.sha256,'--terminal',terminalBinding.path,'--terminal-sha256',terminalBinding.sha256],
  {cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1'},windowsHide:true,timeout:remaining,maxBuffer:8*1024**2,encoding:'utf8'})
 if(result.error)throw result.error
 assert.equal(result.status,0,result.stderr?.slice(-4096))
 const report=JSON.parse(result.stdout)
 assert.equal(report.path,ready.plan.outputRoot+'/dry-review/cpu-review.json')
 assert.ok(Date.now()-started<120000,'review inference deadline exhausted')
 return auditReviewCore(ready,report)
}

export async function reviewCli(args=process.argv.slice(2)){
 assert.ok(!['--recover-once','--recover-child'].includes(args[0]),'consumed predecessor commands cannot execute')
 if(['--independent-review-once','--independent-review-child'].includes(args[0])){
  assert.equal(args.length,3)
  const binding={path:args[1],sha256:args[2]}
  return args[0]==='--independent-review-once'?runIndependentReview(process.cwd(),binding):recoverChild(process.cwd(),binding)
 }else{
 const names=['--package','--sha256','--terminal','--terminal-sha256']
 assert.equal(args.length,8)
 const values={}
 for(let i=0;i<args.length;i+=2){assert.ok(names.includes(args[i])&&!Object.hasOwn(values,args[i]));values[args[i]]=args[i+1]}
 return runReview({path:values['--package'],sha256:values['--sha256']},
  {path:values['--terminal'],sha256:values['--terminal-sha256']})
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // Finish module evaluation before native imports this module to verify context.
 // Keeping the operation promise outside top-level await breaks that wait cycle.
 reviewCli().then(result=>{const raw=JSON.stringify(result)+'\n';assert.ok(Buffer.byteLength(raw)<=32768,'outer stdout ceiling');process.stdout.write(raw)}).catch(error=>{
  process.stderr.write(String(error?.stack??error).slice(0,8192)+'\n')
  if(error?.secondaryEvidenceError)process.stderr.write('secondary evidence: '+String(error.secondaryEvidenceError).slice(0,1024)+'\n')
  process.exitCode=1
 })
}



