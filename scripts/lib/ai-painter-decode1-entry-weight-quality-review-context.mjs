// Read-only recovery inputs, historical identities and cumulative budgets.
// No native execution, CLI dispatch, state publication or proof minting.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {inside,read,json,bind,sha,directoryBytes,runtimeIdentity,validateCompleted} from './ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs';
import {processIdentity} from './windows-process-identity.mjs';

export const HISTORY_ROOT='.runtime/ai-painter/controller-repair-reviews/training-review-data-identity-20261022'

export const SUCCESSOR_CASE='.runtime/ai-painter/controller-repair-reviews/training-review-transport-successor-002-20261022'

export const LEGACY_RECOVERY_ROOT=HISTORY_ROOT+'/recovery-v1'

export const EVIDENCE_ROOT=HISTORY_ROOT

const CLOSEOUT_ROOT=SUCCESSOR_CASE+'/old-prelaunch-closeout'

const ADMISSION_ROOT=SUCCESSOR_CASE+'/admission'

const CAPTURE_ROOT=SUCCESSOR_CASE+'/prior-command-capture'

export const INDEPENDENT_CASE='.runtime/ai-painter/controller-repair-reviews/independent-review-adoption-004-20261022'

export const INDEPENDENT_ADMISSION=INDEPENDENT_CASE+'/admission'

export const REGISTRY_ROOT='.runtime/ai-painter/current-execution-registry'

export const PRIOR_ACCOUNTING={path:SUCCESSOR_CASE+'/real-terminal-accounting-v1.json',sha256:'8ae668c5b1a487a909dd99e0d81a3017457a22e1d29c383c55812ca27c77e34b'}

export const INDEPENDENT_POLICY={path:'.runtime/ai-painter/controller-repair-reviews/review-budget-proposal-003-20261022/controller-budget-plan-v1.json',sha256:'4e169d35a56a7315d8c3af7ebd1ceb63b6a513ec86c52a7057754cb5566a4bab'}

export const CONTROL_RESERVE_BYTES=3*1024**2,HEARTBEAT_ENVELOPE_BYTES=65536,OUTER_STREAM_ENVELOPE_BYTES=65536

export const INDEPENDENT_LIMITS=Object.freeze({maxWallMs:300000,terminalReserveMs:15000,maxOutputBytes:16777216,cpuThreads:2,modelForwardCalls:16,optimizerSteps:0,automaticRetries:0,heartbeatTtlSeconds:120,heartbeatMaximumIntervalMs:5000})

export const SOURCE_RUN='d1-src-v1-850c25f8-8181-446e-99da-3dae2dbb21a8'

export const RECOVERY_CAPABILITY='stage4_mvp256_dry_decode1_registered_source_v1'

export const SCHEMA='completed-training-independent-review-v1'

const MUTABLE=new Set(['reviewWorker','reviewDriver','nativeRunner','executionAuth'])

export const SPEC={path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',sha256:'89a0d3f9f1a67390eeb5c71ac85491a2ad5ce4974803f87c7466c1319f00c167'}

export const REVIEW_SPEC={path:'docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md',sha256:'4b4e4d083024e9944474dc3df3db97ae782910064661cd74fb8cdca94ddbe6e5'}

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

export const NORMATIVE=[{original:{path:SPEC.path,sha256:'385d9a2a788ca016545ea2b620c45a4ff05c28cd1dfb48bba5378395b9f7e8c3'},snapshot:{path:'data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.108-385d9a2a.txt',sha256:'385d9a2a788ca016545ea2b620c45a4ff05c28cd1dfb48bba5378395b9f7e8c3'}},
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
