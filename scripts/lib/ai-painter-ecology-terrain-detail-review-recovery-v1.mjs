// Existing review recovery contract, using already saved native RGB evidence.
// No model execution, training, threshold change, retry or publication path.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import sharp from 'sharp'
import {bind,read,json,write,inside,sha,finalProgramBindings,directoryBytes,withOutputBudget,
 CAPABILITY,EXECUTION_PROFILE,ROLES,runtimeIdentity,verifyExecutionPolicy,deriveConfiguration,validateCompleted}
 from './ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs'
import {validate as validateTrainingPlan} from './ai-painter-ecology-terrain-detail-quality-registration-v1.mjs'
import {readCurrentExecutionRegistry,advanceCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {processIdentity} from '../run-ai-painter-mvp256-dry-v24-training.mjs'
import {replaceHeartbeatFile} from '../run-ai-painter-learning-capacity-experiment.mjs'

const SCHEMA='ecology-terrain-detail-readonly-review-recovery-plan-v1'
const SPEC='docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md'
const ARCHIVES=[
 '.runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/review-logical-path-before/original-bytes.json',
 '.runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/review-recovery-transport-original-bytes.json']
const MUTABLE=new Set(['reviewDriver','entryTests','packageChain','nativeRunner'])
const LIMITS=Object.freeze({maxWallMs:120000,maxOutputBytes:16777216,cpuThreads:2,modelForwardCalls:0,optimizerSteps:0,automaticRetries:0})

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

export function remainingReviewBudget(prior){
 assert.equal(prior.phase,'review');assert.equal(prior.cleanupConfirmed,true);assert.equal(prior.ownerClosed,true)
 assert.equal(prior.proof?.activeProcessesAfterCleanup,0);assert.equal(prior.proof?.exitCode,1)
 assert.equal(prior.budget?.timeoutMs,120000);assert.equal(prior.budget?.outputBytes,16777216)
 assert.ok(Number.isSafeInteger(prior.elapsedMs)&&prior.elapsedMs>0&&prior.elapsedMs<120000,'cumulative review wall budget exhausted')
 const streams=prior.streamBytes;for(const n of [streams?.stdout,streams?.stderr])assert.ok(Number.isSafeInteger(n)&&n>=0)
 const debit=streams.stdout+streams.stderr;assert.ok(debit<8388608,'cumulative review stream budget exhausted')
 return {timeoutMs:120000-prior.elapsedMs,streamBytes:8388608-debit,outputBytes:16777216-debit,priorStreamBytes:debit}
}

export function validateRecoveryShape(plan,original,terminal,failure,prior){
 assert.equal(plan.schema,SCHEMA);assert.equal(plan.capabilityVersion,CAPABILITY)
 for(const key of ['runId','packageId'])assert.equal(plan[key],original[key])
 assert.equal(plan.outputRoot,original.outputRoot+'/review-recovery-v1');assert.equal(plan.taskId,original.runId+'-review-recovery-v1')
 assert.deepEqual(plan.limits,LIMITS);assert.equal(plan.gpuAllowed,false);assert.equal(plan.formalQualificationAllowed,false);assert.equal(plan.runtimePublicationAllowed,false)
 validateCompleted(terminal,plan.sourceExecutionPackage,original)
 for(const key of ['runId','packageId','capabilityVersion'])assert.equal(failure[key],original[key])
 assert.equal(failure.status,'review_execution_failed_closed');assert.equal(failure.executionState,'failed_closed')
 assert.deepEqual(failure.executionPackage,plan.sourceExecutionPackage);assert.deepEqual(failure.workerTerminal,plan.sourceWorkerTerminal)
 assert.deepEqual(failure.nativeOwnedReceipt,plan.priorReviewReceipt)
 assert.deepEqual(plan.selectedCheckpoint,terminal.selectedCheckpointRecord.checkpoint)
 assert.deepEqual(prior.outputAccountingRoots.slice(0,2),[original.outputRoot+'/dry-review-owned',original.outputRoot+'/dry-review'])
 assert.equal(prior.outputAccountingRoots.length,3)
 assert.match(prior.outputAccountingRoots[2],/^\.runtime\/ai-painter\/owned-worker-guards\/[a-f0-9-]{36}$/u)
 assert.deepEqual(Object.keys(plan.programBindings).sort(),[...Object.keys(original.programBindings),'reviewRecovery'].sort())
 for(const [role,b]of Object.entries(original.programBindings)){
  assert.equal(plan.programBindings[role]?.path,b.path,'source role retargeted')
  if(!MUTABLE.has(role))assert.deepEqual(plan.programBindings[role],b,'protected model/data/auditor source changed: '+role)
 }
 return remainingReviewBudget(prior)
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

function historicalBytes(root,archives){
 assert.deepEqual(archives.map(b=>b.path),ARCHIVES)
 const rows=new Map()
 for(const b of archives)for(const row of json(root,b).files){
  assert.equal(rows.has(row.path),false,'duplicate historical source')
  const bytes=Buffer.from(row.contentBase64,'base64');assert.equal(bytes.length,row.size);assert.equal(sha(bytes),row.sha256)
  rows.set(row.path,{bytes,sha256:row.sha256})
 }
 return rows
}

export function loadReviewRecovery(root,planBinding){
 return verifyReviewRecoveryInputs(root,json(root,planBinding),planBinding)
}

function verifyReviewRecoveryInputs(root,plan,planBinding){
 const original=json(root,plan.sourceTrainingPlan),terminal=json(root,plan.sourceWorkerTerminal)
 const failure=json(root,plan.sourceReviewFailure),prior=json(root,plan.priorReviewReceipt)
 const budget=validateRecoveryShape(plan,original,terminal,failure,prior)
 assert.equal(planBinding.path,plan.outputRoot+'/plan.json')
 assert.equal(plan.sourceTrainingPlan.path,original.outputRoot+'/quality-plan.json')
 assert.equal(plan.sourceWorkerTerminal.path,original.outputRoot+'/worker-terminal.json')
 assert.equal(plan.sourceReviewFailure.path,original.outputRoot+'/dry-review-owned/review-failure.json')
 assert.ok(plan.priorReviewReceipt.path.startsWith(original.outputRoot+'/dry-review-owned/owned-review-'))
 assert.equal(plan.sourceReviewReport.path,original.outputRoot+'/dry-review/cpu-review.json')
 const spec=json(root,plan.sourceExecutionPackage)
 assert.equal(spec.packageIdentity,original.packageId);assert.equal(spec.capabilityVersion,CAPABILITY)
 assert.ok(spec.inputEvidence.some(b=>b.path===plan.sourceTrainingPlan.path&&b.sha256===plan.sourceTrainingPlan.sha256))
 validateTrainingPlan({plan:original,planBinding:plan.sourceTrainingPlan,packageBinding:plan.sourceExecutionPackage,
  modelBinding:original.modelBinding,modelIdentity:json(root,original.modelBinding)})
 assert.deepEqual(original.configuration,deriveConfiguration(json(root,original.sourceCandidate)))
 verifyExecutionPolicy(root,original.configuration);assert.deepEqual(original.runtimeIdentity,runtimeIdentity(root))
 const saved=historicalBytes(root,plan.historicalArchives)
 for(const [role,b]of Object.entries(original.programBindings)){
  if(MUTABLE.has(role)){const row=saved.get(b.path);assert.ok(row);assert.equal(row.sha256,b.sha256)}else read(root,b)
 }
 assert.deepEqual(plan.programBindings,finalProgramBindings(root))
 assert.equal(plan.reviewSpecification.path,SPEC);read(root,plan.reviewSpecification)
 const cpu=json(root,plan.cpuAcceptance);assert.equal(cpu.status,'passed');assert.equal(cpu.failed,0);assert.equal(cpu.skipped,0)
 assert.ok(cpu.passed>=20);assert.deepEqual(cpu.programBindings,plan.programBindings)
 for(const b of terminal.checkpoints)read(root,b.checkpoint)
 const report=json(root,plan.sourceReviewReport)
 assert.equal(report.schema,'ecology-terrain-detail-weight-quality-native-review-input-v1')
 assert.equal(report.status,'native_artifacts_ready_machine_audits_pending');assert.equal(report.capabilityVersion,CAPABILITY)
 assert.equal(report.executionProfile,EXECUTION_PROFILE);assert.deepEqual(report.executionPackage,plan.sourceExecutionPackage)
 assert.equal(report.modelForwardCalls,16);assert.equal(report.optimizerSteps,0);assert.equal(report.gpuInitialized,false)
 assert.deepEqual(report.selectedCheckpoint,plan.selectedCheckpoint)
 assert.equal(fs.existsSync(inside(root,original.outputRoot+'/dry-review/machine-audit-core.json')),false,'an existing visual decision cannot be replayed')
 assert.equal(plan.projection.path,original.outputRoot+'/dry-review/auditor-input-1024.png');read(root,plan.projection)
 for(const row of report.validationImages??[]){read(root,row.binding);read(root,row.condition);read(root,row.originalRgb)}
 const conditions=json(root,report.subject.conditionPack)
 assert.equal(conditions.channels.length,23)
 for(const channel of conditions.channels)read(root,{path:channel.path,sha256:channel.sha256})
 read(root,report.subject.referenceRgb);read(root,report.candidateRgb)
 for(const p of prior.outputAccountingRoots)directoryBytes(inside(root,p))
 return {plan,original,terminal,failure,prior,budget,report,ready:{root,plan:original,packageBinding:plan.sourceExecutionPackage}}
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

export function reviewRecoveryNativeContext(root,planBinding){
 const value=loadReviewRecovery(root,planBinding),{plan,budget}=value,start=json(root,bind(root,plan.outputRoot+'/execution-start.json'))
 assert.equal(start.processId,process.pid);assert.equal(start.processStartIdentity,processIdentity(process.pid))
 const claim=json(root,bind(root,plan.outputRoot+'/consumed.json'));assert.deepEqual(claim.plan,planBinding)
 assert.equal(claim.attempt,1);assert.equal(claim.automaticRetries,0)
 assert.ok(Number.isSafeInteger(start.startedAtUnixMs)&&start.startedAtUnixMs<=Date.now())
 const deadline=start.startedAtUnixMs+budget.timeoutMs;assert.ok(deadline>Date.now()+2000,'cumulative recovery deadline exhausted')
 return {...value,deadline,budget:{...budget,timeoutMs:deadline-Date.now()}}
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
