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
function registry(f,{uncommitted=false}={}) {
  const pkg=f.write('.runtime/ai-painter/fixture/package.json',{schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:'PKG-001'})
  const executionPackage={path:pkg.logicalPath,sha256:pkg.sha256}
  const worker={schema:'object-support-structure-quality-worker-terminal-v1',status:'training_completed_review_pending',executionState:'completed',runId:'RUN-001',packageId:'PKG-001',executionPackage,recordedAtUtc:'2026-10-21T19:01:00.123456+00:00'}
  const t=f.write('.runtime/ai-painter/fixture/worker.json',worker)
  const failure=f.write('.runtime/ai-painter/fixture/review.json',{schema:'object-support-structure-review-failure-v1',status:'review_execution_failed_closed',runId:'RUN-001',packageId:'PKG-001',executionPackage,workerTerminal:{path:t.logicalPath,sha256:t.sha256}})
  const head={schemaVersion:'ai-painter-current-execution-registry-v1',writerIdentity:'local_ai_capability_lifecycle_orchestrator',registryRevision:1,transactionId:'tx-001',runId:'RUN-001',eventSequence:1,latestTrainingTerminal:{path:t.logicalPath,sha256:t.sha256,runId:'RUN-001'},terminalEvidence:{path:failure.logicalPath,sha256:failure.sha256}}
  const current=f.write(REG+'/transactions/tx-001/current.staged.json',head)
  f.write(REG+'/transactions/tx-001/transaction.json',{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',transactionId:'tx-001',currentSha256:current.sha256,registryRevision:1,eventSequence:1})
  f.write(REG+'/current.json',head)
  f.write(REG+'/events.jsonl',{schemaVersion:'ai-painter-current-execution-registry-event-v1',registryRevision:1,eventSequence:1,transactionId:'tx-001',currentSha256:current.sha256,runId:'RUN-001'})
  const db=new DatabaseSync(path.join(f.root,REG,'registry.sqlite'));try{db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)');db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?)').run(1,1,'tx-001',current.sha256,'RUN-001');db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run('tx-001',uncommitted?'prepared':'committed',current.sha256)}finally{db.close()}
  return {head,reader:async()=>({ok:true,status:'verified',registry:head})}
}
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
