// A child of the existing native Job, not an independently owned background.
// Python inference and unchanged JS machine audits share one review deadline.
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import sharp from 'sharp'
import {loadContext,inside,read,json,write,bind,sha,directoryBytes,withOutputBudget,runtimeIdentity,validateCompleted,ROLES}
 from './ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'
import {auditMvp256DetailSufficiency} from './ai-painter-mvp-detail-sufficiency-v1.mjs'
import {auditProfessionalAestheticFromFrozenContract} from './ai-painter-stage4-v2-machine-review-execution-v1.mjs'
import {decodeV17ResponsibilityArtifact} from './ai-painter-stage4-mvp-v17-responsibility-artifact.mjs'
import {decideMvp256DryReview} from './ai-painter-mvp256-dry-review-decision-v1.mjs'
import {readCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {processIdentity} from '../run-ai-painter-mvp256-dry-v24-training.mjs'
import {replaceHeartbeatFile} from '../run-ai-painter-learning-capacity-experiment.mjs'

export const HISTORY_ROOT='.runtime/ai-painter/controller-repair-reviews/training-review-data-identity-20261022'
export const SUCCESSOR_CASE='.runtime/ai-painter/controller-repair-reviews/training-review-transport-successor-002-20261022'
export const LEGACY_RECOVERY_ROOT=HISTORY_ROOT+'/recovery-v1'
const EVIDENCE_ROOT=HISTORY_ROOT
const CLOSEOUT_ROOT=SUCCESSOR_CASE+'/old-prelaunch-closeout'
const ADMISSION_ROOT=SUCCESSOR_CASE+'/admission'
const CAPTURE_ROOT=SUCCESSOR_CASE+'/prior-command-capture'
export const INDEPENDENT_CASE='.runtime/ai-painter/controller-repair-reviews/independent-review-adoption-004-20261022'
const INDEPENDENT_ADMISSION=INDEPENDENT_CASE+'/admission'
const HEART_ROOT=INDEPENDENT_CASE+'/control-heartbeat'
const REGISTRY_ROOT='.runtime/ai-painter/current-execution-registry'
export const PRIOR_ACCOUNTING={path:SUCCESSOR_CASE+'/real-terminal-accounting-v1.json',sha256:'8ae668c5b1a487a909dd99e0d81a3017457a22e1d29c383c55812ca27c77e34b'}
export const INDEPENDENT_POLICY={path:'.runtime/ai-painter/controller-repair-reviews/review-budget-proposal-003-20261022/controller-budget-plan-v1.json',sha256:'4e169d35a56a7315d8c3af7ebd1ceb63b6a513ec86c52a7057754cb5566a4bab'}
export const CONTROL_RESERVE_BYTES=3*1024**2,HEARTBEAT_ENVELOPE_BYTES=65536,OUTER_STREAM_ENVELOPE_BYTES=65536
export const INDEPENDENT_LIMITS=Object.freeze({maxWallMs:300000,terminalReserveMs:15000,maxOutputBytes:16777216,cpuThreads:2,modelForwardCalls:16,optimizerSteps:0,automaticRetries:0,heartbeatTtlSeconds:120,heartbeatMaximumIntervalMs:5000})
const SOURCE_RUN='d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8'
const RECOVERY_CAPABILITY='stage4_mvp256_dry_decode1_registered_source_v1'
const SCHEMA='completed-training-independent-review-v1'
export const RECOVERY_LIMITS=Object.freeze({maxWallMs:120000,maxOutputBytes:16777216,cpuThreads:2,modelForwardCalls:16,optimizerSteps:0,automaticRetries:0})
const MUTABLE=new Set(['reviewWorker','reviewDriver','nativeRunner','executionAuth'])
const SPEC={path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',sha256:'89a0d3f9f1a67390eeb5c71ac85491a2ad5ce4974803f87c7466c1319f00c167'}
const REVIEW_SPEC={path:'docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md',sha256:'4b4e4d083024e9944474dc3df3db97ae782910064661cd74fb8cdca94ddbe6e5'}

export function independentOutputRoot(identity){
 assert.match(identity,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u)
 return INDEPENDENT_CASE+'/review-'+identity
}
export function independentBudgetFromFacts(wallParts,priorBytes,priorStreamBytes){
 assert.ok(Array.isArray(wallParts)&&wallParts.length===4)
 for(const n of [...wallParts,priorBytes,priorStreamBytes])assert.ok(Number.isSafeInteger(n)&&n>=0,'actual bounded prior debits required')
 const wallDebitMs=wallParts.reduce((a,b)=>a+b,0)
 assert.equal(wallDebitMs,119634);assert.ok(priorBytes>=556372&&priorBytes+CONTROL_RESERVE_BYTES<16777216)
 assert.ok(priorStreamBytes<8388608-OUTER_STREAM_ENVELOPE_BYTES)
 return {wallDebitMs,timeoutMs:300000-wallDebitMs,terminalReserveMs:15000,priorByteDebit:priorBytes,
  priorStreamBytes,outputBytes:16777216-priorBytes-CONTROL_RESERVE_BYTES,
  streamBytes:8388608-priorStreamBytes-OUTER_STREAM_ENVELOPE_BYTES,controlReserveBytes:CONTROL_RESERVE_BYTES}
}
export function createIndependentHeartbeat({now=()=>performance.now()}={}){
 let last=null
 const clock=()=>{const t=now();assert.ok(Number.isFinite(t));if(last!==null)assert.ok(t>=last&&t-last<=5000,'independent heartbeat refresh late');return t}
 return {due(){const t=clock();return last===null||t-last>=1000},committed(){last=clock()},last(){return last}}
}
export function measureIndependentPrior(root){
 const a=json(root,PRIOR_ACCOUNTING),oldPlan=json(root,PRELAUNCH_BINDINGS.plan),prior=json(root,oldPlan.priorReviewReceipt)
 const legacy=loadSuccessorLedger(root,prior),command=json(root,a.command),last=json(root,a.liveNativeReceipt)
 assert.equal(last.cleanupConfirmed,true);assert.equal(last.ownerClosed,true);assert.equal(last.proof.activeProcessesAfterCleanup,0)
 const wallParts=[prior.elapsedMs,legacy.wallDebitMs-prior.elapsedMs,Math.ceil(command.launcherObservedElapsedSeconds*1000)]
 const close=json(root,PRELAUNCH_BINDINGS.accounting)
 const exactWall=[prior.elapsedMs,close.priorRecoveryDebitMs,close.wallDebitMs,Math.ceil(command.launcherObservedElapsedSeconds*1000)]
 assert.equal(wallParts.reduce((x,y)=>x+y,0),exactWall.reduce((x,y)=>x+y,0))
 let disk=0
 for(const group of a.phaseOutputRoots){
  const expected=new Set(group.files.map(b=>b.path)),found=[]
  const walk=p=>{for(const item of fs.readdirSync(inside(root,p),{withFileTypes:true})){const q=p+'/'+item.name;assert.equal(item.isSymbolicLink(),false);if(item.isDirectory())walk(q);else{assert.ok(item.isFile());found.push(q)}}}
  walk(group.path);assert.deepEqual(found.sort(),[...expected].sort(),'prior output set changed')
  for(const b of group.files){const bytes=read(root,{path:b.path,sha256:b.sha256});assert.equal(bytes.length,b.bytes);disk+=bytes.length}
 }
 for(const b of [...a.externalCommandEvidence,...a.registrationFiles]){const raw=read(root,{path:b.path,sha256:b.sha256});assert.equal(raw.length,b.bytes);disk+=raw.length}
 const database=new DatabaseSync(inside(root,REGISTRY_ROOT+'/registry.sqlite'),{readOnly:true})
 let rows,tx
 try{rows=database.prepare('SELECT * FROM registry_revisions WHERE registry_revision BETWEEN 500 AND 504 ORDER BY registry_revision').all().map(v=>({...v}));tx=rows.map(v=>({...database.prepare('SELECT * FROM registry_transactions WHERE transaction_id=?').get(v.transaction_id)}))}finally{database.close()}
 assert.deepEqual(rows,a.sqliteRevisionRows);assert.deepEqual(tx,a.sqliteTransactionRows)
 const events=fs.readFileSync(inside(root,REGISTRY_ROOT+'/events.jsonl'));assert.ok(events.length<=8*1024**2)
 const selected=events.toString().split(/(?<=\n)/u).filter(line=>line.trim()&&[500,501,502,503,504].includes(JSON.parse(line).registryRevision))
 assert.equal(selected.length,5)
 for(const line of selected){const e=JSON.parse(line),row=rows.find(v=>v.registry_revision===e.registryRevision);assert.equal(e.transactionId,row.transaction_id);assert.equal(e.currentSha256,row.current_sha256)}
 const logicalRows=[...rows,...tx].reduce((n,v)=>n+Buffer.byteLength(JSON.stringify(v)),0)
 assert.equal(logicalRows,a.output.registrationLogicalSqlRowsBytes)
 const eventBytes=selected.reduce((n,s)=>n+Buffer.byteLength(s),0);assert.equal(eventBytes,a.output.registrationEventLineBytes)
 let retired=0
 for(const rec of [prior,last]){const v=JSON.parse(Buffer.from(rec.proof.bindingBase64,'base64'));const raw=Buffer.from(JSON.stringify(v.guard));assert.equal(sha(raw),v.guardSha256);retired+=raw.length}
 const priorStreams=legacy.budget.priorStreamBytes+last.streamBytes.stdout+last.streamBytes.stderr+command.stdoutBytes+command.stderrBytes
 const bytes=disk+logicalRows+eventBytes+retired+priorStreams
 assert.equal(bytes,a.output.conservativeKnownBytes)
 const policy=json(root,INDEPENDENT_POLICY);assert.equal(policy.wallBudget.newCumulativeCeilingMs,300000);assert.equal(policy.wallBudget.priorActualConservativeMs,exactWall.reduce((x,y)=>x+y,0));assert.equal(policy.wallBudget.selectedCleanupAndOuterTerminalReserveMs,15000)
 return {budget:independentBudgetFromFacts(exactWall,bytes,priorStreams),accounting:a,roots:[INDEPENDENT_ADMISSION],wallDebitMs:exactWall.reduce((x,y)=>x+y,0)}
}
export const PRELAUNCH_BINDINGS=Object.freeze({
 plan:{path:LEGACY_RECOVERY_ROOT+'/plan.json',sha256:'d29f3b6d0227957897e32490cb4246d3812037516ce1ecb6eb09006485bbfca1'},
 consumed:{path:LEGACY_RECOVERY_ROOT+'/consumed.json',sha256:'cf59a858a9f4fa90a0eff22a3db69ed5708fb0dd1c3c40d3507347a956edd0d9'},
 command:{path:HISTORY_ROOT+'/single-recovery-command-result.json',sha256:'25fa14f37328863bfd254952cf3f31a5e0211a9b7adaa2a024517066f54b7996'},
 stderr:{path:HISTORY_ROOT+'/single-recovery-command.stderr.log',sha256:'21bfeecd1c7b1cb75cfb878a91057daa3a446220119e8d97d41cb56754ffddf4'},
 proof:{path:CLOSEOUT_ROOT+'/proof.json',sha256:'efbe59fa579ed25535fa0f70a3a87c05b40b17517391fae7da1a0032b1191aef'},
 terminal:{path:CLOSEOUT_ROOT+'/failure-terminal.json',sha256:'407ce5d97d3bde26c9e74a3cb106182ff935b1129ea14bd73c9537e23bc0aadd'},
 accounting:{path:CLOSEOUT_ROOT+'/execution-accounting.json',sha256:'f12d2d9e93702b6e0e10791a84deb6373bd77d4449ccf3dd8a1cf75298b67865'},
 writer:{path:CLOSEOUT_ROOT+'/writer.stdout.json',sha256:'7cf3b8f62d9e356e523e7a83152831ba988ff0b3de15c94810328a7be2ffb7c2'}})

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

export function loadSuccessorLedger(root,prior){
 const values=Object.fromEntries(Object.entries(PRELAUNCH_BINDINGS).filter(([k])=>k!=='stderr').map(([k,b])=>[k,json(root,b)]))
 const {plan,consumed,command,proof,terminal,accounting,writer}=values
 assert.deepEqual(proof.sourcePlan,PRELAUNCH_BINDINGS.plan);assert.deepEqual(consumed.plan,PRELAUNCH_BINDINGS.plan)
 assert.deepEqual(terminal.prelaunchProof,PRELAUNCH_BINDINGS.proof);assert.equal(terminal.executionState,'failed_closed')
 assert.equal(terminal.nativeCleanupCertified,false);assert.equal(terminal.nativeReceipt,null)
 assert.equal(writer.current?.ok,true);assert.equal(writer.current.registry.registryRevision,502)
 assert.equal(writer.current.registry.activeExecution,null)
 assert.deepEqual(writer.current.registry.latestTrainingTerminal.path,plan.sourceWorkerTerminal.path)
 assert.deepEqual(writer.current.registry.latestTrainingTerminal.sha256,plan.sourceWorkerTerminal.sha256)
 assert.equal(command.exitCode,13);assert.equal(accounting.exitCode,0)
 assert.equal(accounting.priorRecoveryDebitMs,Math.ceil(command.elapsedSeconds*1000))
 assert.equal(accounting.wallDebitMs,Math.ceil(accounting.elapsedMonotonicMsObserved))
 assert.equal(accounting.stdoutBytes,read(root,PRELAUNCH_BINDINGS.writer).length)
 const base=remainingRecoveryBudget(prior),extraWall=accounting.priorRecoveryDebitMs+accounting.wallDebitMs
 const extraStreams=command.stdoutBytes+command.stderrBytes+accounting.stdoutBytes+accounting.stderrBytes
 assert.ok(Number.isSafeInteger(extraWall)&&extraWall>0&&extraWall<base.timeoutMs)
 assert.ok(Number.isSafeInteger(extraStreams)&&extraStreams>=0&&extraStreams<base.streamBytes)
 const roots=[...prior.outputAccountingRoots,LEGACY_RECOVERY_ROOT,CLOSEOUT_ROOT,CAPTURE_ROOT,ADMISSION_ROOT]
 for(const n of ['single-recovery-command-result.json','single-recovery-command.stdout.log','single-recovery-command.stderr.log']){
  const original=bind(root,HISTORY_ROOT+'/'+n),captured=bind(root,CAPTURE_ROOT+'/'+n)
  assert.equal(original.sha256,captured.sha256);read(root,captured)
 }
 for(const p of roots)directoryBytes(inside(root,p))
 return {budget:{timeoutMs:base.timeoutMs-extraWall,streamBytes:base.streamBytes-extraStreams,
  outputBytes:base.outputBytes-extraStreams,priorStreamBytes:base.priorStreamBytes+extraStreams},roots,
  wallDebitMs:prior.elapsedMs+extraWall,priorBindings:PRELAUNCH_BINDINGS,closedRegistry:writer.current.registry}
}
const NORMATIVE=[{original:{path:SPEC.path,sha256:'385d9a2a788ca016545ea2b620c45a4ff05c28cd1dfb48bba5378395b9f7e8c3'},snapshot:{path:'data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.108-385d9a2a.txt',sha256:'385d9a2a788ca016545ea2b620c45a4ff05c28cd1dfb48bba5378395b9f7e8c3'}},
 {original:{path:REVIEW_SPEC.path,sha256:'48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909'},snapshot:{path:'data/ai-painter/system-governance/document-baselines/review-storage-1.25-48d9b177.txt',sha256:'48d9b177df5936bdd3898e6743f703a97a2f5f490ec0ba22d748601aa1493909'}},
 {original:{path:SPEC.path,sha256:'6232b96b13ab590a44c3d0ae582fa1e3fbb34eb7d5806fefed4d5143bb547d87'},snapshot:{path:'data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.109-6232b96b.txt',sha256:'6232b96b13ab590a44c3d0ae582fa1e3fbb34eb7d5806fefed4d5143bb547d87'}},
 {original:{path:REVIEW_SPEC.path,sha256:'6b244778888fd4619f511091b598698b8d2c44d772d6a6b642b3af09a69b1549'},snapshot:{path:'data/ai-painter/system-governance/document-baselines/review-storage-1.26-6b244778.txt',sha256:'6b244778888fd4619f511091b598698b8d2c44d772d6a6b642b3af09a69b1549'}},
 {original:{path:SPEC.path,sha256:'c360fdc0499c2b986ab506c98408cd3ab4ca7bffdc7725bac07d9fdb03f3a3fd'},snapshot:{path:'data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.110-c360fdc0.txt',sha256:'c360fdc0499c2b986ab506c98408cd3ab4ca7bffdc7725bac07d9fdb03f3a3fd'}},
 {original:{path:REVIEW_SPEC.path,sha256:'6a1068fbbe16f3683b7a16c2e3e8fd8d4888817e9e88307104b6338ee51096e5'},snapshot:{path:'data/ai-painter/system-governance/document-baselines/review-storage-1.27-6a1068fb.txt',sha256:'6a1068fbbe16f3683b7a16c2e3e8fd8d4888817e9e88307104b6338ee51096e5'}}]

export function remainingRecoveryBudget(prior){
 assert.equal(prior.phase,'review');assert.equal(prior.cleanupConfirmed,true);assert.equal(prior.ownerClosed,true)
 assert.equal(prior.proof?.activeProcessesAfterCleanup,0);assert.equal(prior.proof?.exitCode,1)
 assert.equal(prior.budget?.timeoutMs,120000);assert.equal(prior.budget?.outputBytes,16777216)
 assert.ok(Number.isSafeInteger(prior.elapsedMs)&&prior.elapsedMs>0&&prior.elapsedMs<120000,'original wall budget exhausted')
 for(const n of [prior.streamBytes?.stdout,prior.streamBytes?.stderr])assert.ok(Number.isSafeInteger(n)&&n>=0)
 const debit=prior.streamBytes.stdout+prior.streamBytes.stderr
 assert.ok(debit<8388608,'original stream budget exhausted')
 return {timeoutMs:120000-prior.elapsedMs,streamBytes:8388608-debit,outputBytes:16777216-debit,priorStreamBytes:debit}
}

export function validateRecoveryPrograms(original,programs){
 assert.deepEqual(Object.keys(programs).sort(),Object.keys(original).sort())
 for(const [role,b]of Object.entries(original)){
  assert.equal(programs[role].path,b.path,'recovery source role retargeted')
  if(!MUTABLE.has(role))assert.deepEqual(programs[role],b,'protected numerical/data/auditor source changed: '+role)
 }
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

export function loadReviewRecovery(root,planBinding,{pulse=()=>{}}={}){
 pulse()
 const plan=json(root,planBinding),original=json(root,plan.sourceTrainingPlan)
 assert.equal(plan.schema,SCHEMA);assert.equal(plan.outputRoot,independentOutputRoot(plan.recoveryId))
 assert.equal(planBinding.path,plan.outputRoot+'/plan.json')
 assert.equal(plan.runId,SOURCE_RUN);assert.equal(plan.capabilityVersion,RECOVERY_CAPABILITY)
 assert.equal(plan.taskId,SOURCE_RUN+'-independent-'+plan.recoveryId)
 for(const key of ['runId','packageId','capabilityVersion'])assert.equal(plan[key],original[key])
 assert.deepEqual(plan.limits,INDEPENDENT_LIMITS);assert.equal(plan.gpuAllowed,false)
 assert.equal(plan.formalQualificationAllowed,false);assert.equal(plan.runtimePublicationAllowed,false)
 assert.deepEqual(plan.specification,SPEC);assert.deepEqual(plan.reviewSpecification,REVIEW_SPEC)
 assert.deepEqual(plan.historicalNormativeBindings,NORMATIVE)
 assert.deepEqual(plan.independentPolicy,INDEPENDENT_POLICY);assert.deepEqual(plan.priorAccounting,PRIOR_ACCOUNTING)
 read(root,SPEC);read(root,REVIEW_SPEC)
 assert.equal(plan.sourceTrainingPlan.path,original.outputRoot+'/quality-plan.json')
 const pkg=json(root,plan.sourceExecutionPackage),terminal=json(root,plan.sourceWorkerTerminal)
 assert.equal(plan.sourceExecutionPackage.sha256,'835e0bb18a2fb7f5614b1bf7b494acd8149842475584b313f0be24ff0f9ae27a')
 assert.equal(plan.sourceWorkerTerminal.path,original.outputRoot+'/worker-terminal.json')
 assert.equal(plan.sourceWorkerTerminal.sha256,'9f11ec2f93cfcf1cf43ce4c384b16e208e29c57d7ae0f1468053b0cc12d7e708')
 assert.ok(pkg.inputEvidence.some(b=>b.path===plan.sourceTrainingPlan.path&&b.sha256===plan.sourceTrainingPlan.sha256))
 validateCompleted(terminal,plan.sourceExecutionPackage,original)
 assert.deepEqual(plan.selectedCheckpoint,terminal.selectedCheckpointRecord.checkpoint);read(root,plan.selectedCheckpoint)
 assert.deepEqual(original.runtimeIdentity,runtimeIdentity(root))
 pulse()
 validateRecoveryPrograms(original.programBindings,plan.programBindings)
 let sourceIndex=0
 for(const b of Object.values(plan.programBindings)){read(root,b);if(++sourceIndex%64===0)pulse()}
 const preservation=json(root,plan.sourcePreservation)
 assert.equal(plan.sourcePreservation.path,EVIDENCE_ROOT+'/all-original-source-preservation.json')
 assert.deepEqual(preservation.sourcePackage,plan.sourceExecutionPackage);assert.deepEqual(preservation.sourcePlan,plan.sourceTrainingPlan)
 assert.equal(preservation.entries.length,Object.keys(original.programBindings).length)
 const aliases=new Map()
 for(const row of preservation.entries){
  const old=original.programBindings[row.role]
  assert.deepEqual({path:row.originalPath,sha256:row.sha256},old)
  assert.equal(row.snapshotPath,EVIDENCE_ROOT+'/source-baselines/'+old.sha256+'.txt')
  const snapshot={path:row.snapshotPath,sha256:old.sha256};read(root,snapshot)
  if(aliases.size%64===0)pulse()
  const key=old.path+':'+old.sha256;assert.equal(aliases.has(key),false);aliases.set(key,snapshot)
 }
 for(const row of NORMATIVE){read(root,row.snapshot);aliases.set(row.original.path+':'+row.original.sha256,row.snapshot)}
 for(const b of pkg.inputEvidence){read(root,aliases.get(b.path+':'+b.sha256)??b);pulse()}
 pulse()
 const acceptance=json(root,plan.cpuAcceptance)
 assert.equal(acceptance.status,'passed');assert.ok(acceptance.passed>=10)
 assert.equal(acceptance.failed,0);assert.equal(acceptance.skipped,0);assert.equal(acceptance.modelForwards,0)
 assert.deepEqual(acceptance.programBindings,plan.programBindings)
 for(const b of acceptance.testEvidence)read(root,b)
 const failure=json(root,plan.sourceReviewFailure),prior=json(root,plan.priorReviewReceipt)
 assert.equal(plan.sourceReviewFailure.path,original.outputRoot+'/dry-review-owned/review-failure.json')
 assert.equal(plan.sourceReviewFailure.sha256,'64a03fb327f5be435cb4fabe9396a7ef22b51258a94cb4f742f590d3b6e58551')
 assert.deepEqual(failure.nativeOwnedReceipt,plan.priorReviewReceipt)
 assert.deepEqual(failure.executionPackage,plan.sourceExecutionPackage);assert.deepEqual(failure.workerTerminal,plan.sourceWorkerTerminal)
 assert.equal(failure.status,'review_execution_failed_closed')
 assert.equal(plan.priorReviewReceipt.sha256,'718a5bdc88dfaf87f7a3f6638b027564a8d6e615f0be478330a8add2fe3c5b77')
 assert.deepEqual(prior.outputAccountingRoots.slice(0,2),[original.outputRoot+'/dry-review-owned',original.outputRoot+'/dry-review'])
 assert.equal(prior.outputAccountingRoots.length,3)
 assert.match(prior.outputAccountingRoots[2],/^\.runtime\/ai-painter\/owned-worker-guards\/[a-f0-9-]{36}$/u)
 for(const p of prior.outputAccountingRoots)directoryBytes(inside(root,p))
 assert.equal(prior.elapsedMs,57148)
 const ledger=measureIndependentPrior(root),budget=ledger.budget
 pulse()
 assert.deepEqual(plan.priorBindings,PRELAUNCH_BINDINGS)
 assert.deepEqual(plan.priorAccountingRoots,ledger.roots)
 assert.equal(plan.processStartIdentity,processIdentity(plan.processId))
 const creation=Date.parse(plan.processStartIdentity.slice(plan.processStartIdentity.indexOf(':')+1))
 assert.equal(plan.startedAtUnixMs,creation,'preparation budget starts at real process creation')
 const deadline=creation+budget.timeoutMs,workDeadline=deadline-INDEPENDENT_LIMITS.terminalReserveMs
 assert.ok(Date.now()<workDeadline,'independent working deadline exhausted')
 return {root,plan,original,terminal,failure,prior,budget,deadline,workDeadline,planBinding,accountingRoots:ledger.roots,wallDebitMs:ledger.wallDebitMs,
  ready:{root,plan:original,packageBinding:plan.sourceExecutionPackage}}
}

export function recoveryNativeContext(root,planBinding,pulse=()=>{}){
 const context=loadReviewRecovery(root,planBinding,{pulse}),{plan}=context
 assert.equal(plan.processId,process.pid)
 const claim=json(root,bind(root,plan.outputRoot+'/consumed.json'))
 assert.deepEqual(claim.plan,planBinding);assert.equal(claim.attempt,1);assert.equal(claim.automaticRetries,0)
 assert.deepEqual(json(root,bind(root,INDEPENDENT_ADMISSION+'/independent-consumed.json')),claim)
 const timeoutMs=context.workDeadline-Date.now()+1000
 assert.ok(timeoutMs>2000,'native cleanup and outer terminal reserve exhausted')
 return {...context,deadline:context.workDeadline+1000,budget:{...context.budget,timeoutMs}}
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



