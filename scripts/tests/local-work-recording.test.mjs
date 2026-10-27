import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { initializeStore,createStore } from '../../src/server/local-backup/store.mjs'
import { hash } from '../../src/server/local-backup/contracts.mjs'
import { createWorkProducersForIsolatedTests } from '../../src/server/local-backup/work-producers.mjs'
import * as producersModule from '../../src/server/local-backup/work-producers.mjs'
import * as contractsModule from '../../src/server/local-backup/contracts.mjs'
import { createWorkObserver } from '../../src/server/local-backup/work-observer.mjs'
import { readRecordInput,runRecordWork } from '../record-work.mjs'

const PLAN='docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'
const REG='.runtime/ai-painter/current-execution-registry'
const inventory={schemaVersion:'local_backup_inventory_v1',observedAtUtc:'2026-10-21T19:00:00Z',coverageComplete:false,totalBytes:null,totalFiles:null,categoriesOverlap:true}
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-work-'))
  fs.writeFileSync(path.join(root,'.local-work-private-fixture'),'local-work-test-only')
  fs.mkdirSync(path.join(root,'.runtime'))
  fs.mkdirSync(path.join(root,'docs/game-world-generation'),{recursive:true})
  fs.writeFileSync(path.join(root,PLAN),'| 2 | 训练 |\n| 3 | 迁移 |\n| 8 | 控制台 |\n| 9 | 备份 |\n')
  const moduleRoot=path.join(root,'.runtime/local-backup');initializeStore(moduleRoot,inventory)
  const store=createStore(moduleRoot)
  const write=(logical,value)=>{const file=path.join(root,logical);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));return {logicalPath:logical,sha256:hash(fs.readFileSync(file))}}
  const make=options=>createWorkProducersForIsolatedTests({projectRoot:root,store,...options})
  return {root,moduleRoot,store,write,make}
}
function report(extra={}) {return {title:'详细工作报告',objective:'核对真实工作及结果',reason:'按生效规格自动归集',actions:['实施并验证有界修改'],changes:[{path:'src/server/local-backup/work-ledger.mjs',description:'保留详细报告及来源'}],checks:[{command:null,status:'not_verified',description:'此处为私有测试数据，不宣称生产验收'}],results:['真实测试事实'],issues:['全日覆盖仍未知'],nextSteps:['由各窗口提交自己的报告'],planComparison:'关联唯一计划的真实摘要',...extra}}
function input(f,ctx,extra={}) {
  const evidence=f.write('.runtime/ai-painter/controller-repair-reviews/fixture/delivery.json',{workOrder:'TASK-001',fixture:true})
  return {eventId:'report-001',moduleId:'capability-migration',taskId:'TASK-001',runId:null,eventKind:'execution_finished',executionResult:'succeeded',workReport:report(),attributedClaims:{validationStatus:'passed',acceptanceStatus:'unknown'},evidenceReferences:[evidence],originalStartedAtUtc:'2026-10-21T15:59:59.123456+00:00',originalFinishedAtUtc:'2026-10-21T16:00:00.654321+00:00',monotonicElapsedMs:1530.865,originalEventAtUtc:'2026-10-21T16:00:00.654321+00:00',planReference:ctx.planReference('capability-migration'),...extra}
}
const rows=ctx=>ctx.ledger.events(new URLSearchParams({limit:'50'})).records

test('controller takeover fixes new report identity while preserving the original persisted controller event bytes',async()=>{
 const f=fixture(),ctx=f.make(),{createWorkLedger}=await import('../../src/server/local-backup/work-ledger.mjs')
 const previous={id:'codex-controller',name:'总控｜文档、调度与验收',threadId:'01a06c76-0c98-7e62-a132-d8035ccbdab0'}
 const producer={id:'codex-work-codex-controller',sourceCategory:'codex',reporter:previous,verifyEvidence:()=>true,verifyPlan:()=>true}
 const legacy=input(f,ctx,{eventId:'legacy-controller-private-event',reporter:previous,validationStatus:'unknown',acceptanceStatus:'unknown',workReport:report({title:'旧总控私有报告'})})
 createWorkLedger(f.store,[producer]).appendProduced(producer,legacy)
 const before=f.store.read(db=>db.prepare('SELECT payload_json,sha FROM work_events WHERE event_id=?').get(legacy.eventId))
 const next=input(f,ctx,{eventId:'new-controller-private-report',workReport:report({title:'接替总控私有报告'})})
 const result=await ctx.recordCodex(next,'codex-controller');assert.equal(result.recorded,true,JSON.stringify(result))
 const current=ctx.ledger.find(result.eventIds[0])
 assert.equal(current.sourceCategory,'codex');assert.deepEqual(current.reporter,{id:'codex-controller',name:'总控|文档、调度与验收2',threadId:'01a16ccd-a67b-7ae0-b614-a0415398ae0b'})
 assert.equal(current.validationStatus,'unknown');assert.equal(current.acceptanceStatus,'unknown');assert.equal(current.attributedClaims.validationStatus,'passed')
 assert.equal((await ctx.recordCodex(next,'codex-controller')).replayed,true);assert.equal(rows(ctx).length,2)
 assert.deepEqual(ctx.ledger.find(legacy.eventId).reporter,previous)
 assert.deepEqual(f.store.read(db=>db.prepare('SELECT payload_json,sha FROM work_events WHERE event_id=?').get(legacy.eventId)),before)
 assert.equal((await ctx.recordCodex({...next,reporter:previous},'codex-controller')).recorded,false)
 const summary=ctx.ledger.summary(new URLSearchParams()).records[0];assert.equal(summary.validationPassed,0);assert.equal(summary.acceptanceCompleted,0)
})
test('Codex source, reporter, sequence, literal microseconds and attribution are trusted separately',async()=>{
  const f=fixture(),ctx=f.make(),value=input(f,ctx)
  const result=await ctx.recordCodex(value,'codex-migration');assert.equal(result.recorded,true,JSON.stringify(result))
  const e=rows(ctx)[0];assert.equal(e.sourceCategory,'codex');assert.equal(e.reporter.id,'codex-migration');assert.equal(e.producerSequence,1)
  assert.equal(e.originalEventAtUtc,value.originalEventAtUtc);assert.equal(e.originalStartedAtUtc,value.originalStartedAtUtc);assert.equal(e.workDateAsiaShanghai,'2026-10-22');assert.equal(e.monotonicElapsedMs,1530.865)
  assert.equal(e.validationStatus,'unknown');assert.equal(e.acceptanceStatus,'unknown');assert.equal(e.attributedClaims.validationStatus,'passed')
  const s=ctx.ledger.summary(new URLSearchParams()).records[0];assert.equal(s.executionEnded,0);assert.equal(s.validationPassed,0);assert.equal(s.acceptanceCompleted,0);assert.equal(s.codexClaimedValidationPassed,1)
  for(const field of ['producerSequence','sourceCategory','reporter'])assert.equal((await ctx.recordCodex({...value,[field]:1},'codex-migration')).recorded,false)
  assert.equal((await ctx.recordCodex(value,'unregistered')).recorded,false)
  assert.equal(rows(ctx).length,1)
})
test('long legal Chinese report is stored whole, replay survives plan revision and changed content conflicts',async()=>{
  const f=fixture(),ctx=f.make(),value=input(f,ctx,{workReport:report({results:Array.from({length:4},(_,i)=>String(i)+'结'.repeat(1900)),nextSteps:Array.from({length:3},(_,i)=>String(i)+'步'.repeat(1900))})})
  assert(Buffer.byteLength(JSON.stringify(value))<65536)
  assert.equal((await ctx.recordCodex(value,'codex-migration')).recorded,true)
  fs.appendFileSync(path.join(f.root,PLAN),'计划真实变更\n')
  const replay=await ctx.recordCodex(value,'codex-migration');assert.equal(replay.recorded,true,JSON.stringify(replay));assert.equal(replay.replayed,true)
  assert.deepEqual(rows(ctx)[0].workReport,value.workReport);assert.equal(rows(ctx)[0].planReferenceResolution,'resolved')
  const changed=await ctx.recordCodex({...value,workReport:report()},'codex-migration');assert.equal(changed.recorded,false);assert.equal(changed.reasonCode,'event_idempotency_conflict')
  const huge=await ctx.recordCodex({...value,eventId:'too-big',workReport:report({results:Array.from({length:12},()=> '字'.repeat(1999))})},'codex-migration');assert.equal(huge.recorded,false);assert.equal(rows(ctx).length,1)
})
test('window/date filters, module8 and no-report coverage preserve unknown and progress is not completed work',async()=>{
  const f=fixture(),ctx=f.make(),value=input(f,ctx,{eventKind:'progress_report',moduleId:'ai-console',planReference:ctx.planReference('ai-console'),originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null})
  assert.equal(value.planReference.moduleOrRequirementId,'module-8');assert.equal((await ctx.recordCodex(value,'codex-console')).recorded,true)
  const s=ctx.ledger.summary(new URLSearchParams({date:'2026-10-22',reporterId:'codex-console'}));assert.equal(s.records.length,1);assert.equal(s.records[0].progressReports,1);assert.equal(s.records[0].executionEnded,0);assert.equal(s.records[0].attributedClaims,0)
  assert.equal(ctx.ledger.events(new URLSearchParams({reporterId:'codex-training'})).records.length,0)
  const missing=s.coverage.registeredReporters.find(r=>r.id==='codex-training');assert.equal(missing.knownReportCount,null);assert.equal(missing.reasonCode,'not_reported_is_not_zero_work')
  assert.equal(s.coverage.registeredReporters.find(r=>r.id==='codex-console').knownReportCount,1)
  assert.equal(s.coverage.sources.find(x=>x.sourceId==='backup-runs-v1').status,'not_connected')
  const db=new DatabaseSync(path.join(f.moduleRoot,'module.sqlite'),{readOnly:true});try{assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n,6)}finally{db.close()}
})
test('existing multi-entry console evidence binds only its actual named work orders',async()=>{
  const f=fixture(),ctx=f.make(),value=input(f,ctx)
  value.evidenceReferences=[f.write('.runtime/ai-painter/controller-repair-reviews/fixture/window.json',{reports:[{workOrder:'TASK-001'},{workOrder:'TASK-002'}]})]
  assert.equal((await ctx.recordCodex(value,'codex-console')).recorded,true)
  assert.equal((await ctx.recordCodex({...value,eventId:'other',taskId:'TASK-003'},'codex-console')).reasonCode,'work_task_evidence_mismatch')
})
test('evidence rejects fake hash and unrelated task; GET queries never modify the tree',async()=>{
  const f=fixture(),ctx=f.make(),value=input(f,ctx)
  assert.equal((await ctx.recordCodex({...value,evidenceReferences:[{...value.evidenceReferences[0],sha256:'a'.repeat(64)}]},'codex-migration')).recorded,false)
  assert.equal((await ctx.recordCodex({...value,taskId:'UNRELATED'},'codex-migration')).reasonCode,'work_task_evidence_mismatch')
  assert.equal((await ctx.recordCodex(value,'codex-migration')).recorded,true)
  function snapshot(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?snapshot(path.join(dir,e.name)):[[path.relative(f.root,path.join(dir,e.name)),hash(fs.readFileSync(path.join(dir,e.name)))]])}
  const before=snapshot(f.root);ctx.ledger.events(new URLSearchParams());ctx.ledger.summary(new URLSearchParams());assert.deepEqual(snapshot(f.root),before)
})
test('Git JSON binding snapshots actual stage facts; ledger failure never throws or executes Git',async()=>{
  const f=fixture(),ctx=f.make(),operationId='a'.repeat(64)
  const value={schemaVersion:'local_backup_git_operation_v1',operationId,revision:1,status:'push_unknown',failureCode:'push_connection_unknown',commit:{status:'verified',startedAtUtc:'2026-10-21T19:00:00Z',finishedAtUtc:'2026-10-21T19:00:01Z',elapsedMs:1000},push:{status:'unknown',startedAtUtc:null,finishedAtUtc:null,elapsedMs:null}}
  f.write('.runtime/local-backup/git/operations/'+operationId+'.json',{value,sha256:hash(value)})
  const binding={operationId,revision:1,sha256:hash(value)},first=await ctx.recordGitOperation(binding);assert.equal(first.recorded,true,JSON.stringify(first));assert.equal(first.eventIds.length,2)
  assert.equal((await ctx.recordGitOperation(binding)).replayed,true);assert.equal(rows(ctx).find(e=>e.sourceReference.kind==='git_push').executionResult,'unknown')
  assert.equal((await ctx.recordGitOperation({...binding,revision:2})).recorded,false)
  const immutable=rows(ctx)[0].evidenceReferences[0];f.write('.runtime/local-backup/git/operations/'+operationId+'.json',{changed:true});assert.equal(hash(fs.readFileSync(path.join(f.root,immutable.logicalPath))),immutable.sha256)
  const failed=f.make({store:{...f.store,write(){throw Error('fixture_store_unavailable')}}})
  const codex=await failed.recordCodex(input(f,failed),'codex-migration');assert.equal(codex.recorded,false)
})
test('backup records require a saved bound terminal; missing source stays unavailable',async()=>{
  const f=fixture(),ctx=f.make();assert.equal((await ctx.recordBackupRun({backupId:'none',sha256:'a'.repeat(64)})).recorded,false)
  const ref=f.write('.runtime/local-backup/runs/private-case/terminal.json',{schemaVersion:'local_backup_run_terminal_v1',backupId:'private-case',state:'failed',failureCode:'fixture_disk_missing',startedAtUtc:null,finishedAtUtc:null,elapsedMs:null})
  const r=await ctx.recordBackupRun({backupId:'private-case',sha256:ref.sha256});assert.equal(r.recorded,true,JSON.stringify(r));assert.equal(rows(ctx)[0].executionResult,'failed');assert.equal(rows(ctx)[0].originalEventAtUtc,null);assert.equal(rows(ctx)[0].acceptanceStatus,'unknown')
})
function registry(f,{uncommitted=false,workerOverride={},preview=null,reviewOverride={},core=null,headOverride={}}={}) {
  const pkg=f.write('.runtime/ai-painter/fixture/package.json',{schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:'PKG-001'})
  const executionPackage={path:pkg.logicalPath,sha256:pkg.sha256}
  const worker={schema:'object-support-structure-quality-worker-terminal-v1',status:'training_completed_review_pending',executionState:'completed',runId:'RUN-001',packageId:'PKG-001',executionPackage,recordedAtUtc:'2026-10-21T19:01:00.123456+00:00',...workerOverride}
  if(preview){const ref=f.write('.runtime/ai-painter/fixture/preview.json',{schemaVersion:'training-preview-diagnostic-manifest-v1',runId:'RUN-001',packageId:'PKG-001',...preview});worker.trainingPreviewManifest={path:ref.logicalPath,sha256:ref.sha256}}
  const t=f.write('.runtime/ai-painter/fixture/worker.json',worker)
  const review={schema:'object-support-structure-review-failure-v1',status:'review_execution_failed_closed',runId:'RUN-001',packageId:'PKG-001',executionPackage,workerTerminal:{path:t.logicalPath,sha256:t.sha256},...reviewOverride}
  if(core){const ref=f.write('.runtime/ai-painter/fixture/core.json',{schema:'object-support-structure-machine-audit-core-v1',runId:'RUN-001',packageId:'PKG-001',executionPackage,...core});review.core={path:ref.logicalPath,sha256:ref.sha256}}
  const failure=f.write('.runtime/ai-painter/fixture/review.json',review)
  const head={schemaVersion:'ai-painter-current-execution-registry-v1',writerIdentity:'local_ai_capability_lifecycle_orchestrator',registryRevision:1,transactionId:'tx-001',runId:'RUN-001',taskId:'RUN-001',eventSequence:1,latestTrainingTerminal:{path:t.logicalPath,sha256:t.sha256,runId:'RUN-001'},terminalEvidence:{path:failure.logicalPath,sha256:failure.sha256}}
  Object.assign(head,headOverride)
  const current=f.write(REG+'/transactions/tx-001/current.staged.json',head)
  f.write(REG+'/transactions/tx-001/transaction.json',{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',transactionId:'tx-001',currentSha256:current.sha256,registryRevision:1,eventSequence:1})
  f.write(REG+'/current.json',head)
  f.write(REG+'/events.jsonl',{schemaVersion:'ai-painter-current-execution-registry-event-v1',registryRevision:1,eventSequence:1,transactionId:'tx-001',currentSha256:current.sha256,runId:'RUN-001',taskId:head.taskId})
  const db=new DatabaseSync(path.join(f.root,REG,'registry.sqlite'));try{db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,run_id TEXT,task_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)');db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(1,1,'tx-001',current.sha256,'RUN-001',head.taskId);db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run('tx-001',uncommitted?'prepared':'committed',current.sha256)}finally{db.close()}
  return {head,reader:async()=>({ok:true,status:'verified',registry:head})}
}
function singleMapRegistry(f,{corrupt=false}={}) {
  const prefix='.runtime/ai-painter/learning-capacity-experiments/RUN-001'
  const ref=(name,value)=>{const b=f.write(prefix+'/'+name,value);return {path:b.logicalPath,sha256:b.sha256}}
  const pkg=ref('package.json',{schemaVersion:'single-map-checkpoint-fit-package-v1',experimentIdentity:'RUN-001',outputRoot:prefix,
    qualificationGranted:false,selectedSampleId:'sample',sampleIdentity:{sampleId:'sample',split:'train'},training:{pairs:200},
    optimizerInitialization:'fresh_AdamW_no_parent_moments_available'})
  const result=ref('result.json',{experimentIdentity:'RUN-001',status:'experiment_executed_not_visual_qualified',formalQualificationGranted:false,
    optimizerSteps:{generator:200,discriminator:200},checkpointReloadExact:true,elapsedSeconds:863.171})
  const capsule=ref('capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:'RUN-001',integrity:{status:'verified'},evidence:[{...pkg,kind:'experiment_0',sha256Verified:true}]})
  if(corrupt)result.sha256='0'.repeat(64)
  return registry(f,{workerOverride:{schema:null,schemaVersion:'ai-painter-learning-capacity-experiment-terminal-v1',
    experimentIdentity:'RUN-001',status:'experiment_completed_not_formal_qualified',executionState:'completed',result,
    formalTrainingQualified:false,checkpointPromotable:false,worldEntryAllowed:false,actualFinalOptimizerSteps:{generator:200,discriminator:200}},
    headOverride:{taskId:'RUN-001',taskCapsule:capsule,terminalEvidence:null}})
}
test('single-map terminal enters durable work ledger and precise history replay is idempotent',async()=>{
  const f=fixture(),r=singleMapRegistry(f),ctx=f.make({readRegistry:r.reader})
  const first=await ctx.observeCommittedRegistry();assert.equal(first.recorded,true,JSON.stringify(first))
  assert.equal(rows(ctx).length,1)
  const row=rows(ctx)[0];assert.equal(row.runId,'RUN-001');assert.equal(row.executionResult,'succeeded')
  assert.equal(row.acceptanceStatus,'unknown');assert.equal(row.originalEventAtUtc,'2026-10-21T19:01:00.123456+00:00')
  assert(row.workReport.results.some(s=>s.includes('G更新 200')))
  assert(row.workReport.results.some(s=>s.includes('863.171')))
  const reopened=f.make({readRegistry:r.reader});const replay=await reopened.observeCommittedRegistry({replayRevisions:[1]})
  assert.equal(replay.recorded,true,JSON.stringify(replay));assert.equal(rows(reopened).length,1)
  assert.equal(reopened.getState('ai-painter-registry-v1').cursor,1)
  await assert.rejects(reopened.observeCommittedRegistry({replayRevisions:[0]}),/work_replay_revision_invalid/)
})
test('single-map result digest mismatch never creates a successful work event',async()=>{
  const f=fixture(),r=singleMapRegistry(f,{corrupt:true}),ctx=f.make({readRegistry:r.reader})
  assert.equal((await ctx.observeCommittedRegistry()).recorded,false);assert.equal(rows(ctx).length,0)
})
test('committed registry produces training and failed-review separately, replay/reopen is idempotent',async()=>{
  const f=fixture(),r=registry(f),ctx=f.make({readRegistry:r.reader})
  const first=await ctx.observeCommittedRegistry();assert.equal(first.recorded,true,JSON.stringify(first));assert.equal(rows(ctx).length,2)
  assert.equal(rows(ctx).find(e=>e.taskId==='training-RUN-001').executionResult,'succeeded');assert.equal(rows(ctx).find(e=>e.taskId==='review-RUN-001').executionResult,'failed')
  assert.equal(ctx.getState('ai-painter-registry-v1').cursor,1)
  const reopened=f.make({readRegistry:r.reader});assert.equal((await reopened.observeCommittedRegistry()).recorded,true);assert.equal(rows(reopened).length,2)
})
test('historical committed facts survive dead activity, but mismatched durable bindings cannot pass',async()=>{
  const f=fixture();registry(f)
  const reader=async()=>({ok:false,status:'unknown_or_stale',errorCode:'registry_active_execution_process_not_active'})
  const ctx=f.make({readRegistry:reader}),r=await ctx.observeCommittedRegistry();assert.equal(r.recorded,true,JSON.stringify(r));assert.equal(r.coverage.currentActivityStatus,'unknown_or_stale');assert.equal(rows(ctx).length,2)
  const g=fixture();registry(g);fs.appendFileSync(path.join(g.root,REG,'current.json'),' ')
  const bad=g.make({readRegistry:reader});assert.equal((await bad.observeCommittedRegistry()).recorded,false);assert.equal(rows(bad).length,0)
  const other=f.make({readRegistry:async()=>({ok:false,errorCode:'registry_current_hash_mismatch'})});assert.equal((await other.observeCommittedRegistry()).reasonCode,'work_registry_unverified')
})
test('failed SQLite commit cannot advance cursor; replay only records facts and never reruns business',async()=>{
  const f=fixture(),r=registry(f);let fail=true,writes=0
  const store={...f.store,write(fn){writes++;if(fail)throw Error('fixture_sqlite_failure');return f.store.write(fn)}}
  const ctx=f.make({readRegistry:r.reader,store});assert.equal((await ctx.observeCommittedRegistry()).recorded,false);assert.equal(ctx.getState('ai-painter-registry-v1').cursor,0);assert.equal(rows(ctx).length,0)
  fail=false;assert.equal((await ctx.observeCommittedRegistry()).recorded,true);assert.equal(rows(ctx).length,2);assert.equal(ctx.getState('ai-painter-registry-v1').cursor,1);assert(writes>=3)
})
test('crash after SQLite commit but before cursor checkpoint replays without duplicate events',async()=>{
  const f=fixture(),r=registry(f),ctx=f.make({readRegistry:r.reader})
  let injected=false
  const faultyStore={...f.store,write(fn){const result=f.store.write(fn);if(!injected){injected=true;fs.mkdirSync(path.join(ctx.stateRoot,'sources'),{recursive:true});fs.writeFileSync(path.join(ctx.stateRoot,'sources/ai-painter-registry-v1.json'),'fault-injected-invalid-state')}return result}}
  const faulty=f.make({readRegistry:r.reader,store:faultyStore});const first=await faulty.observeCommittedRegistry();assert.equal(first.recorded,false);assert.equal(rows(faulty).length,2)
  // Remove only this test's injected corrupt checkpoint, retaining failure receipts.
  fs.unlinkSync(path.join(ctx.stateRoot,'sources/ai-painter-registry-v1.json'))
  assert.equal((await ctx.observeCommittedRegistry()).recorded,true);assert.equal(rows(ctx).length,2);assert.equal(ctx.getState('ai-painter-registry-v1').cursor,1)
})
test('current pure GET factory ignores a pre-HMR cached ledger closure and stays read-only',async()=>{
  const f=fixture(),ctx=f.make();assert.equal((await ctx.recordCodex(input(f,ctx),'codex-migration')).recorded,true)
  const key=Symbol.for('ai-pet-world.local-work-recording.context.v1'),previous=globalThis[key]
  globalThis[key]={ledgerForStore(){throw Error('old_pre_hmr_ledger_closure')}}
  try {
    const require=createRequire(import.meta.url),exports={}
    const code=ts.transpileModule(fs.readFileSync('src/server/local-backup/service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
    new Function('require','exports',code)(name=>name==='./work-producers.mjs'?{...producersModule,createWorkProducers:()=>f.make()}:name==='./store.mjs'?{createStore:()=>f.store}:name==='./contracts.mjs'?contractsModule:name.startsWith('@/')?{}:require(name),exports)
    const before=hash(fs.readFileSync(path.join(f.moduleRoot,'module.sqlite')))
    const e=exports.ledger().events(new URLSearchParams({date:'2026-10-22',reporterId:'codex-migration'}));assert.equal(e.records.length,1);assert.equal(e.records[0].reporter.id,'codex-migration')
    const s=exports.ledger().summary(new URLSearchParams({date:'2026-10-22',reporterId:'codex-migration'}));assert.equal(s.records[0].reporter.id,'codex-migration');assert.equal(hash(fs.readFileSync(path.join(f.moduleRoot,'module.sqlite'))),before)
  }finally{if(previous===undefined)delete globalThis[key];else globalThis[key]=previous}
})
test('observer subscribes once to fixed source and disposes; uncommitted history fails closed',async()=>{
  const f=fixture(),r=registry(f,{uncommitted:true}),ctx=f.make({readRegistry:r.reader})
  const observed=await ctx.observeCommittedRegistry();assert.equal(observed.recorded,false);assert.equal(observed.reasonCode,'work_registry_transaction_uncommitted');assert.equal(ctx.getState('ai-painter-registry-v1').cursor,0)
  const g=fixture(),s=registry(g),good=g.make({readRegistry:s.reader}),observer=createWorkObserver(good)
  await observer.ready;assert.equal(observer.active,true);assert.equal(rows(good).length,2)
  fs.writeFileSync(path.join(g.root,REG,'current.json'),JSON.stringify(s.head))
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(rows(good).length,2);observer.dispose();assert.equal(observer.active,false)
})
test('CLI accepts only bounded JSON, registered reporter and exact arguments',async()=>{
  assert.match((await runRecordWork(['--help'])).help,/--reporter/)
  await assert.rejects(runRecordWork(['--source','local_program']),/arguments_invalid/)
  await assert.rejects(readRecordInput(Readable.from([Buffer.alloc(65537)])),/input_limit/)
  await assert.rejects(readRecordInput(Readable.from([Buffer.from('{')])),/json_invalid/)
  assert.deepEqual(await readRecordInput(Readable.from([Buffer.from('{"中文":true}')])),{中文:true})
})

test('failed training records business impact, primary and preview secondary errors under its Run without granting qualification',async()=>{
 const f=fixture(),r=registry(f,{workerOverride:{status:'failed_closed',executionState:'failed_closed',completedEpochs:5,optimizerSteps:{generator:250,discriminator:251},failurePosition:{epoch:6,trainIndex:27,zeroBasedEpochPosition:10},checkpointSelectionExecuted:false,originalError:{type:'ValueError',message:'actual four-term total gradient identity differs at parameter 90'},captureReceipt:{secondaryCaptureFailure:null}},preview:{secondaryError:{errorType:'KeyError',message:"'contribution'"}}}),ctx=f.make({readRegistry:r.reader})
 assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
 const event=rows(ctx).find(e=>e.taskId==='training-RUN-001'),text=JSON.stringify(event.workReport)
 for(const expected of ['业务影响','parameter 90','contribution','epoch 6','G更新 250','修复状态','未验证'])assert(text.includes(expected),expected)
 assert.equal(event.runId,'RUN-001');assert.equal(event.executionResult,'failed');assert.equal(event.sourceCategory,'local_program');assert.equal(event.validationStatus,'unknown');assert.equal(event.acceptanceStatus,'unknown')
 assert.equal(event.evidenceReferences.length,2);assert.equal(Object.keys(event.workReport).length,10)
 const count=rows(ctx).length;assert.equal((await ctx.observeCommittedRegistry()).recorded,true);assert.equal(rows(ctx).length,count)
})

test('damaged preview and timing evidence cannot hide the saved training first error or manufacture timing',async()=>{
 const f=fixture(),r=registry(f,{workerOverride:{status:'failed_closed',executionState:'failed_closed',originalError:{type:'ValueError',message:'actual four-term total gradient identity differs at parameter 90'},workerExecutionTiming:{path:'.runtime/ai-painter/fixture/missing-timing.json',sha256:'a'.repeat(64)}},preview:{secondaryError:{errorType:'KeyError',message:"'contribution'"}}})
 fs.appendFileSync(path.join(f.root,'.runtime/ai-painter/fixture/preview.json'),' ')
 const ctx=f.make({readRegistry:r.reader}),result=await ctx.observeCommittedRegistry();assert.equal(result.recorded,true,JSON.stringify(result))
 const event=rows(ctx).find(e=>e.taskId==='training-RUN-001'),text=JSON.stringify(event.workReport)
 assert(text.includes('parameter 90'));assert(text.includes('摘要或身份不一致'));assert(text.includes('计时证据不可核对'));assert.equal(event.monotonicElapsedMs,null);assert.equal(event.originalStartedAtUtc,null)
 assert.equal(event.evidenceReferences.length,1);assert(!text.includes('缺少 contribution 字段'))
})

test('completed native review records adverse findings separately from execution success and external controller review',async()=>{
 const f=fixture(),r=registry(f,{reviewOverride:{schema:'completed-training-independent-review-v1',status:'dry_single_world_review_failed_closed'},core:{status:'dry_single_world_review_failed_closed',issueCodes:['condition_object_tree_reference_semantic_mismatch','validation_not_improved_without_mean_rgb_regression'],formalStage4QualificationGranted:true}}),ctx=f.make({readRegistry:r.reader})
 assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
 const event=rows(ctx).find(e=>e.taskId==='review-RUN-001'),text=JSON.stringify(event.workReport)
 assert.equal(event.executionResult,'succeeded');assert.equal(event.validationStatus,'unknown');assert.equal(event.acceptanceStatus,'unknown');assert(text.includes('树木与留出参考语义不一致'));assert(text.includes('未满足验证改善'));assert(text.includes('不授予Stage4'))
 const submission=input(f,ctx,{moduleId:'ai-painter',runId:'RUN-001',planReference:ctx.planReference('ai-painter'),workReport:report({title:'总控独立复核',issues:['程序结论另记；组件通过不等于画质通过']})})
 assert.equal((await ctx.recordCodex(submission,'codex-controller')).recorded,true)
 const external=rows(ctx).find(e=>e.reporter.id==='codex-controller');assert.equal(external.runId,event.runId);assert.equal(external.sourceCategory,'codex');assert.equal(external.validationStatus,'unknown');assert.equal(external.acceptanceStatus,'unknown')
})

test('unbound or wrong-Run review supplements remain gaps, and arbitrary exception text never enters the public report',async()=>{
 const f=fixture(),r=registry(f,{workerOverride:{status:'failed_closed',executionState:'failed_closed',originalError:{type:'Error',message:'Cookie=session-value SECRET_TOKEN=never-display'}},preview:{runId:'OTHER-RUN',secondaryError:{message:'secret-preview'}}}),ctx=f.make({readRegistry:r.reader})
 assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
 const event=rows(ctx).find(e=>e.taskId==='training-RUN-001'),text=JSON.stringify(event.workReport)
 assert(!text.includes('session-value'));assert(!text.includes('never-display'));assert(!text.includes('secret-preview'));assert(text.includes('原消息仅保留于受限证据'));assert(text.includes('身份不一致'));assert.equal(event.evidenceReferences.length,1)
})

test('unknown diagnostic schemas are reported as incomplete coverage, never invented training or audit results',async()=>{
 const f=fixture(),r=registry(f,{reviewOverride:{schema:'unconnected-numerical-diagnostic-v1',status:'diagnostic_target_evidence_complete'}}),ctx=f.make({readRegistry:r.reader})
 const result=await ctx.observeCommittedRegistry();assert.equal(result.recorded,true);assert(result.coverage.unsupportedSchemasObserved>0);assert.equal(rows(ctx).length,1);assert.equal(ctx.getState('ai-painter-registry-v1').reasonCode,'work_terminal_schemas_not_connected')
})

test('oversized audit issue arrays remain explicit coverage gaps within the existing report limits',async()=>{
 const f=fixture(),r=registry(f,{reviewOverride:{schema:'completed-training-independent-review-v1',status:'dry_single_world_review_failed_closed'},core:{status:'dry_single_world_review_failed_closed',issueCodes:Array(65).fill('unmapped')}}),ctx=f.make({readRegistry:r.reader})
 assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
 const event=rows(ctx).find(e=>e.taskId==='review-RUN-001');assert(event.workReport.issues.some(v=>v.includes('列表缺失或超限')));assert(event.workReport.issues.length<=64)
})

test('upgrading detailed templates appends without rewriting an old event or double-counting its task and Run',async()=>{
 const f=fixture(),r=registry(f),ctx=f.make({readRegistry:r.reader}),{createWorkLedger}=await import('../../src/server/local-backup/work-ledger.mjs')
 const producer={id:'ai-painter-work-v1',sourceCategory:'local_program'},oldId='program-'+hash(['training',r.head.latestTrainingTerminal.path,r.head.latestTrainingTerminal.sha256])
 const old={eventId:oldId,producerSequence:1,moduleId:'ai-painter',taskId:'training-RUN-001',runId:'RUN-001',eventKind:'execution_finished',executionResult:'succeeded',validationStatus:'unknown',acceptanceStatus:'unknown',evidenceReferences:[],originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,originalEventAtUtc:'2026-10-21T19:01:00.123456+00:00',planReference:null,reporter:{id:'local-ai-painter',name:'本地训练与审核程序',threadId:null},workReport:report({title:'旧模板原件'})}
 createWorkLedger(f.store,[producer]).append(producer,old)
 const before=f.store.read(db=>db.prepare('SELECT payload_json,sha FROM work_events WHERE event_id=?').get(oldId))
 assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
 assert.equal(rows(ctx).length,3)
 assert.deepEqual(f.store.read(db=>db.prepare('SELECT payload_json,sha FROM work_events WHERE event_id=?').get(oldId)),before)
 const training=rows(ctx).filter(e=>e.taskId==='training-RUN-001');assert.equal(training.length,2);assert(training.some(e=>e.eventId.startsWith('program-detail-v2-')))
 const summary=ctx.ledger.summary(new URLSearchParams({reporterId:'local-ai-painter'}));assert.equal(summary.records.reduce((n,g)=>n+g.executionEnded,0),2)
})

test('direct bound audit core and malformed supplementary SHA retain provenance without promoting machine qualification',async()=>{
 const f=fixture(),r=registry(f,{reviewOverride:{schema:'object-support-structure-machine-audit-core-v1',status:'dry_single_world_numeric_passed_visual_approval_pending',issueCodes:[]},workerOverride:{trainingPreviewManifest:{path:'.runtime/ai-painter/fixture/review.json'}}}),ctx=f.make({readRegistry:r.reader})
 assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
 const audit=rows(ctx).find(e=>e.taskId==='review-RUN-001');assert.equal(audit.executionResult,'succeeded');assert.equal(audit.validationStatus,'unknown');assert.equal(audit.acceptanceStatus,'unknown');assert(JSON.stringify(audit.workReport).includes('numeric_passed_visual_approval_pending'))
 const training=rows(ctx).find(e=>e.taskId==='training-RUN-001');assert(training.workReport.issues.some(t=>t.includes('证据缺失、超限、摘要或身份不一致')))
})

test('malformed or prototype-named audit codes remain unmapped without exposing object values or inherited functions',async()=>{
 const f=fixture(),r=registry(f,{reviewOverride:{schema:'completed-training-independent-review-v1',status:'dry_single_world_review_failed_closed'},core:{status:'dry_single_world_review_failed_closed',issueCodes:['constructor','toString',{toString:null,secret:'never-display-code'}]}}),ctx=f.make({readRegistry:r.reader})
 assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
 const text=JSON.stringify(rows(ctx).find(e=>e.taskId==='review-RUN-001').workReport)
 assert.equal(text.split('问题码未映射').length-1,3);assert(!text.includes('native code'));assert(!text.includes('never-display-code'))
})


test('bounded mixed package ingestion preserves full evidence while rejecting wrong schema, digest and oversize',async()=>{
 const run='RUN-001',prefix='.runtime/ai-painter/learning-capacity-experiments/'+run
 const producer={path:'ml/ai-painter/fixture.py',sha256:'a'.repeat(64)}
 const value={schemaVersion:'mixed-train-rehearsal-package-v1',experimentIdentity:run,outputRoot:prefix,selectedSampleIds:Array.from({length:48},(_,i)=>'sample-'+i),training:{pairs:448},qualificationGranted:false,padding:'x'.repeat(1200000),programs:[producer],interfaceContract:{schemaVersion:'ai-painter-training-interface-contract-v2',purpose:'observation_only',producerVersion:'training-observation-recorder-v1',producer,recordFile:'training-observation.json',progressFile:'progress.json',resolution:[256,192],optimizerStepCeiling:{generator:448,discriminator:448},samples:[{sampleId:'sample-0',split:'train',image:{path:'data/private.png',sha256:'a'.repeat(64)}}],artifactPlan:[{role:'checkpoint',optimizerStep:448}]}}
 for(const [name,body,file,digest,expected] of [
  ['valid',value,prefix+'/package.json',null,true],
  ['wrong-schema',{...value,schemaVersion:'unknown'},prefix+'/package.json',null,false],
  ['too-large',{...value,padding:'x'.repeat(4*1024*1024)},prefix+'/package.json',null,false],
  ['wrong-digest',value,prefix+'/package.json','0'.repeat(64),false],
  ['unrelated',value,'.runtime/ai-painter/controller-repair-reviews/private/result.json',null,false],
  ['wrong-run',{...value,experimentIdentity:'other'},prefix+'/package.json',null,false]]){
  const f=fixture(),b=f.write(file,body),executionPackage={path:b.logicalPath,sha256:digest??b.sha256}
  const r=registry(f,{workerOverride:{schema:null,schemaVersion:'ai-painter-learning-capacity-experiment-terminal-v1',executionPackage,status:'experiment_failed_closed',executionState:'failed_closed',formalTrainingQualified:false,checkpointPromotable:false,worldEntryAllowed:false},headOverride:{terminalEvidence:null}})
  const ctx=f.make({readRegistry:r.reader}),result=await ctx.observeCommittedRegistry()
  assert.equal(result.recorded,expected,name+': '+JSON.stringify(result))
  if(expected){
   assert.equal(rows(ctx).length,1)
   const evidence=rows(ctx)[0].evidenceReferences.find(e=>e.sha256===b.sha256)
   assert(evidence.logicalPath.includes('/evidence/program/'))
   assert.equal(hash(fs.readFileSync(path.join(f.root,evidence.logicalPath))),b.sha256)
   assert.equal((await f.make({readRegistry:r.reader}).observeCommittedRegistry()).recorded,true)
  }else assert.equal(rows(ctx).length,0)
 }
})
