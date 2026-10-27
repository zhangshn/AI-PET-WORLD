import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout as delay } from 'node:timers/promises'
import { hash } from '../../src/server/local-backup/contracts.mjs'
import { initializeStore,createStore } from '../../src/server/local-backup/store.mjs'
import { createWorkProducersForIsolatedTests } from '../../src/server/local-backup/work-producers.mjs'
import { createWorkObserver } from '../../src/server/local-backup/work-observer.mjs'

const REG='.runtime/ai-painter/current-execution-registry',SOURCE='ai-painter-registry-v1'
function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-work-'))
  fs.writeFileSync(path.join(root,'.local-work-private-fixture'),'local-work-test-only')
  fs.mkdirSync(path.join(root,REG),{recursive:true})
  fs.mkdirSync(path.join(root,'docs/game-world-generation'),{recursive:true})
  fs.writeFileSync(path.join(root,'docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'),'| 2 | 训练 |\n')
  const moduleRoot=path.join(root,'.runtime/local-backup')
  initializeStore(moduleRoot,{schemaVersion:'local_backup_inventory_v1',observedAtUtc:'2026-10-21T19:00:00Z',coverageComplete:false,totalBytes:null,totalFiles:null,categoriesOverlap:true})
  const store=createStore(moduleRoot),file=logical=>path.join(root,logical)
  const write=(logical,value)=>{
    fs.mkdirSync(path.dirname(file(logical)),{recursive:true})
    const bytes=Buffer.from(JSON.stringify(value));fs.writeFileSync(file(logical),bytes)
    return {path:logical,sha256:hash(bytes)}
  }
  const db=new DatabaseSync(file(REG+'/registry.sqlite'))
  db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER PRIMARY KEY,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,run_id TEXT,task_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT PRIMARY KEY,status TEXT,current_sha256 TEXT)');db.close()
  function commit(revision,{failed=false,at='2026-10-25T16:00:00.123456+00:00',publish=true}={}) {
    const runId='RUN-'+revision,transactionId='tx-'+revision
    const executionPackage=write('.runtime/ai-painter/fixture/'+runId+'/package.json',{schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:'PKG-'+revision})
    const terminal=write('.runtime/ai-painter/fixture/'+runId+'/terminal.json',{
      schema:'object-support-structure-quality-worker-terminal-v1',runId,packageId:'PKG-'+revision,executionPackage,
      status:failed?'failed_closed':'training_completed_review_pending',executionState:failed?'failed_closed':'completed',recordedAtUtc:at})
    const head={schemaVersion:'ai-painter-current-execution-registry-v1',writerIdentity:'local_ai_capability_lifecycle_orchestrator',
      registryRevision:revision,eventSequence:revision,transactionId,runId,taskId:runId,latestTrainingTerminal:{...terminal,runId},terminalEvidence:null}
    const staged=write(REG+'/transactions/'+transactionId+'/current.staged.json',head)
    const tx=write(REG+'/transactions/'+transactionId+'/transaction.json',{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',transactionId,registryRevision:revision,eventSequence:revision,currentSha256:staged.sha256})
    const database=new DatabaseSync(file(REG+'/registry.sqlite'))
    try{database.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(revision,revision,transactionId,staged.sha256,runId,runId);database.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run(transactionId,'committed',staged.sha256)}finally{database.close()}
    const event={schemaVersion:'ai-painter-current-execution-registry-event-v1',registryRevision:revision,eventSequence:revision,transactionId,currentSha256:staged.sha256,runId,taskId:runId}
    fs.appendFileSync(file(REG+'/events.jsonl'),JSON.stringify(event)+'\n')
    if(publish) {
      write(REG+'/current.json',head)
    }
    return {head,staged,terminal,tx,event}
  }
  // Exercise the existing durable verifier as well as exact transaction reads;
  // the private source has no live training process and never launches one.
  const reader=async()=>({ok:false,errorCode:'registry_active_execution_process_not_active'})
  const make=options=>createWorkProducersForIsolatedTests({projectRoot:root,store,readRegistry:reader,...options})
  const notify=()=>fs.appendFileSync(file(REG+'/events.jsonl'),'\n')
  const rows=ctx=>ctx.ledger.events(new URLSearchParams({limit:'50'})).records
  return {root,file,write,commit,make,notify,rows,store}
}
async function until(predicate) {
  const deadline=Date.now()+7000
  while(!predicate()){assert(Date.now()<deadline,'observer delivery deadline exceeded');await delay(15)}
}
function start(t,ctx) {const observer=createWorkObserver(ctx);t.after(()=>observer.dispose());return observer}

test('native watcher delivers a new terminal past missing ancient snapshots; exact 544/546 replay never claims full history',async t=>{
  const f=fixture(),ancient=f.commit(1);fs.unlinkSync(f.file(ancient.staged.path))
  f.commit(544,{publish:false,at:'2026-10-20T15:59:59.123456+00:00'})
  f.commit(546,{failed:true})
  const ctx=f.make(),observer=start(t,ctx)
  await observer.ready
  assert.equal(ctx.getState(SOURCE).cursor,0);assert.equal(ctx.getState(SOURCE).liveCursor,546)
  assert.equal(ctx.getState(SOURCE).coverage.historyFailure.revision,1)
  assert.equal(f.rows(ctx).length,1);assert.equal(f.rows(ctx)[0].executionResult,'failed')
  const replay=await ctx.observeCommittedRegistry({replayRevisions:[544,546]})
  assert.equal(replay.recorded,true);assert.deepEqual(replay.coverage.exactReplayRevisions,[544,546])
  assert.equal(replay.coverage.historyThroughRevision,0);assert.equal(replay.coverage.complete,false)
  assert.equal(f.rows(ctx).length,2)
  const late=f.rows(ctx).find(e=>e.runId==='RUN-544')
  assert.equal(late.workDateAsiaShanghai,'2026-10-20');assert.equal(late.originalEventAtUtc,'2026-10-20T15:59:59.123456+00:00')
  const noScan=fs.readdirSync;fs.readdirSync=()=>{throw Error('source_directory_scan_forbidden')}
  try {
    f.commit(547)
    await until(()=>ctx.getState(SOURCE).liveCursor===547)
  }finally{fs.readdirSync=noScan}
  assert.equal(f.rows(ctx).length,3);assert.equal(ctx.getState(SOURCE).cursor,0)
  assert.equal(ctx.getState(SOURCE).status,'partial');assert.equal(ctx.getState(SOURCE).coverage.historyFailure.revision,1)
  f.notify();f.notify();await delay(100);assert.equal(f.rows(ctx).length,3)
  assert.equal(ctx.ledger.summary(new URLSearchParams()).records.reduce((n,r)=>n+r.executionEnded,0),3)
  observer.dispose();const restarted=f.make(),next=start(t,restarted);await next.ready
  assert.equal(f.rows(restarted).length,3);assert.equal(restarted.getState(SOURCE).liveCursor,547)
})

test('a live conflict holds its contiguous cursor while newer confirmed facts survive restart and late repair',async t=>{
  const f=fixture(),ancient=f.commit(1);fs.unlinkSync(f.file(ancient.staged.path));f.commit(2)
  const ctx=f.make(),observer=start(t,ctx);await observer.ready
  const broken=f.commit(3),bytes=fs.readFileSync(f.file(broken.terminal.path))
  fs.appendFileSync(f.file(broken.terminal.path),' ');f.commit(4,{failed:true})
  await until(()=>ctx.getState(SOURCE).latestConfirmedRevision===4)
  assert.equal(ctx.getState(SOURCE).liveCursor,2);assert.equal(ctx.getState(SOURCE).coverage.liveFailure.revision,3)
  assert.equal(f.rows(ctx).length,2);assert.equal(f.rows(ctx).find(e=>e.runId==='RUN-4').executionResult,'failed')
  observer.dispose();const reopened=f.make(),next=start(t,reopened);await next.ready
  assert.equal(reopened.getState(SOURCE).liveCursor,2);assert.equal(f.rows(reopened).length,2)
  fs.writeFileSync(f.file(broken.terminal.path),bytes);f.notify()
  await until(()=>reopened.getState(SOURCE).liveCursor===4)
  assert.equal(f.rows(reopened).length,3);assert.equal(reopened.getState(SOURCE).cursor,0)
  assert.equal(reopened.getState(SOURCE).coverage.liveFailure,null)
})

test('failed first SQLite append retains bootstrap boundary so restart catches the old terminal after head changes',async t=>{
  const f=fixture(),ancient=f.commit(1);fs.unlinkSync(f.file(ancient.staged.path));f.commit(2)
  let fail=true
  const store={...f.store,write(fn){if(fail)throw Error('fixture_ledger_write_failed');return f.store.write(fn)}}
  const ctx=f.make({store}),observer=start(t,ctx);await observer.ready
  assert.equal(f.rows(ctx).length,0);assert.equal(ctx.getState(SOURCE).liveCursor,1)
  assert.equal(ctx.getState(SOURCE).liveStartRevision,2);assert.equal(ctx.getState(SOURCE).latestConfirmedRevision,null)
  observer.dispose();f.commit(3);fail=false
  const restarted=f.make({store}),next=start(t,restarted);await next.ready
  assert.equal(restarted.getState(SOURCE).liveCursor,3)
  assert.deepEqual(f.rows(restarted).map(e=>e.runId).sort(),['RUN-2','RUN-3'])
  assert.equal(restarted.getState(SOURCE).coverage.historyFailure.revision,1)
})

test('notifications received during an asynchronous read cannot swallow a newer committed head',async t=>{
  const f=fixture();f.commit(1)
  let release,entered,block=false
  const entry=new Promise(resolve=>{entered=resolve})
  const gate=new Promise(resolve=>{release=resolve})
  const ctx=f.make({readRegistry:async()=>{
    const head=JSON.parse(fs.readFileSync(f.file(REG+'/current.json'),'utf8'))
    if(block){block=false;entered();await gate}
    return {ok:true,status:'verified',registry:head}
  }})
  const observer=start(t,ctx);await observer.ready
  block=true;f.commit(2);await entry
  f.commit(3,{failed:true});await delay(30);release()
  await until(()=>ctx.getState(SOURCE).liveCursor===3)
  assert.deepEqual(f.rows(ctx).map(e=>e.runId).sort(),['RUN-1','RUN-2','RUN-3'])
  assert.equal(ctx.getState(SOURCE).coverage.liveBacklog,0)
})

test('startup drains multiple live batches without a CLI, new notification, timer or historical scan',async t=>{
  const f=fixture(),old=f.commit(1);fs.unlinkSync(f.file(old.staged.path));f.commit(2)
  const ctx=f.make();assert.equal((await ctx.observeCommittedRegistry()).recorded,true)
  for(let i=3;i<=37;i++)f.commit(i,{failed:i%2===0})
  const observer=start(t,ctx);await observer.ready
  assert.equal(ctx.getState(SOURCE).liveCursor,37);assert.equal(ctx.getState(SOURCE).cursor,0)
  assert.equal(f.rows(ctx).length,36)
  assert.equal(ctx.ledger.summary(new URLSearchParams()).records.reduce((n,r)=>n+r.executionEnded,0),36)
  assert.equal(ctx.ledger.summary(new URLSearchParams()).records.reduce((n,r)=>n+r.failed,0),17)
})

test('missing SQLite revisions and transaction conflicts are explicit gaps, never skipped by replay or live catch-up',async()=>{
  const f=fixture();f.commit(1);const ctx=f.make();await ctx.observeCommittedRegistry()
  f.commit(3)
  const result=await ctx.observeCommittedRegistry()
  assert.equal(result.recorded,false);assert.equal(result.coverage.liveFailure.reasonCode,'work_registry_revision_gap')
  assert.equal(result.coverage.liveFailure.revision,2);assert.equal(ctx.getState(SOURCE).liveCursor,1)
  assert.equal(ctx.getState(SOURCE).latestConfirmedRevision,3);assert.equal(f.rows(ctx).length,2)
  const bad=await ctx.observeCommittedRegistry({replayRevisions:[2]})
  assert.equal(bad.recorded,false);assert.equal(bad.coverage.replayFailure.revision,2)
  assert.equal(f.rows(ctx).length,2)
  const binding=f.commit(2,{publish:false})
  f.write(binding.tx.path,{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',transactionId:'wrong-tx'})
  const conflict=await ctx.observeCommittedRegistry({replayRevisions:[2]})
  assert.equal(conflict.recorded,false);assert.equal(conflict.coverage.replayFailure.reasonCode,'work_registry_transaction_conflict')
  assert.equal(ctx.getState(SOURCE).liveCursor,1);assert.equal(f.rows(ctx).length,2)
})

test('missing historical registry event blocks history but not an independently verified live head',async t=>{
  const f=fixture(),old=f.commit(1),latest=f.commit(2)
  fs.writeFileSync(f.file(REG+'/events.jsonl'),JSON.stringify(latest.event)+'\n')
  const ctx=f.make(),observer=start(t,ctx);await observer.ready
  assert.equal(ctx.getState(SOURCE).cursor,0);assert.equal(ctx.getState(SOURCE).liveCursor,2)
  assert.equal(ctx.getState(SOURCE).coverage.historyFailure.reasonCode,'work_registry_event_conflict')
  assert.equal(f.rows(ctx).length,1);assert.equal(f.rows(ctx)[0].runId,'RUN-2')
  fs.writeFileSync(f.file(REG+'/events.jsonl'),JSON.stringify(old.event)+'\n'+JSON.stringify(latest.event)+'\n')
  await until(()=>ctx.getState(SOURCE).cursor===2)
  assert.equal(f.rows(ctx).length,2)
})

test('legacy liveCursor zero without a live origin starts an explicit new lane rather than inheriting the old historical gap',async t=>{
  const f=fixture(),old=f.commit(1);fs.unlinkSync(f.file(old.staged.path));f.commit(2)
  const ctx=f.make();ctx.saveState(SOURCE,{cursor:0,liveCursor:0})
  const observer=start(t,ctx);await observer.ready
  assert.equal(ctx.getState(SOURCE).cursor,0);assert.equal(ctx.getState(SOURCE).liveStartRevision,2)
  assert.equal(ctx.getState(SOURCE).liveCursor,2)
  assert.equal(ctx.getState(SOURCE).legacyLiveBoundary.previousLiveCursor,0)
  f.commit(3);await until(()=>ctx.getState(SOURCE).liveCursor===3)
  assert.equal(f.rows(ctx).length,2);assert.equal(ctx.getState(SOURCE).coverage.complete,false)
})
