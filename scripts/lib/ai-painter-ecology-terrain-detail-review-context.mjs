// Read-only recovery inputs, historical identities and cumulative budgets.
// No native execution, CLI dispatch, state publication or proof minting.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bind,read,json,inside,sha,finalProgramBindings,directoryBytes,CAPABILITY,EXECUTION_PROFILE,runtimeIdentity,verifyExecutionPolicy,deriveConfiguration,validateCompleted} from './ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs';
import {validate as validateTrainingPlan} from './ai-painter-ecology-terrain-detail-quality-registration-v1.mjs';
import {processIdentity} from './windows-process-identity.mjs';

export const SCHEMA='ecology-terrain-detail-readonly-review-recovery-plan-v1'

export const SPEC='docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md'

export const ARCHIVES=[
 '.runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/review-logical-path-before/original-bytes.json',
 '.runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/review-recovery-transport-original-bytes.json']

const MUTABLE=new Set(['reviewDriver','entryTests','packageChain','nativeRunner'])

export const LIMITS=Object.freeze({maxWallMs:120000,maxOutputBytes:16777216,cpuThreads:2,modelForwardCalls:0,optimizerSteps:0,automaticRetries:0})

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

export function verifyReviewRecoveryInputs(root,plan,planBinding){
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

export function reviewRecoveryNativeContext(root,planBinding){
 const value=loadReviewRecovery(root,planBinding),{plan,budget}=value,start=json(root,bind(root,plan.outputRoot+'/execution-start.json'))
 assert.equal(start.processId,process.pid);assert.equal(start.processStartIdentity,processIdentity(process.pid))
 const claim=json(root,bind(root,plan.outputRoot+'/consumed.json'));assert.deepEqual(claim.plan,planBinding)
 assert.equal(claim.attempt,1);assert.equal(claim.automaticRetries,0)
 assert.ok(Number.isSafeInteger(start.startedAtUnixMs)&&start.startedAtUnixMs<=Date.now())
 const deadline=start.startedAtUnixMs+budget.timeoutMs;assert.ok(deadline>Date.now()+2000,'cumulative recovery deadline exhausted')
 return {...value,deadline,budget:{...budget,timeoutMs:deadline-Date.now()}}
}
