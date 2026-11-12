import assert from 'node:assert/strict'
import {test} from 'node:test'
import {projectNativeStage0Status as project,projectStage0Continuation,projectNativeStage0Polling as polling} from '../../src/server/local-backup/native-stage0-training-progress.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {verifyNativeStage0HistoricalStop,readNativeStage0HistoricalStop} from '../../src/server/local-backup/native-stage0-history.mjs'

test('future Stage0 observations are unavailable and the original cached evidence is retained',()=>{
  const now=Date.parse('2026-11-12T00:00:00Z')
  const cache={pending:false,lastAttempt:now-15000,last:{kind:'verified',sourceTime:new Date(now+1).toISOString(),committed:312},problem:null}
  const original=structuredClone(cache),result=polling(cache,now)
  assert.equal(result.view.kind,'unavailable');assert.equal(result.shouldPoll,true)
  assert.deepEqual(cache,original)
})
test('a clock rollback permits a fresh read without waiting for the previous wall time',()=>{
  const now=Date.parse('2026-11-12T00:00:00Z'),cache={pending:false,lastAttempt:now+3600000,last:null,problem:null}
  assert.equal(polling(cache,now).shouldPoll,true)
  assert.equal(polling({...cache,pending:true},now).shouldPoll,false)
})
test('Stage0 freshness retains zero age and the original exclusive 45 second limit',()=>{
  const now=Date.parse('2026-11-12T00:00:00Z')
  for(const age of [0,44999,45000,45001]){
    const last={kind:'verified',sourceTime:new Date(now-age).toISOString(),committed:312}
    const result=polling({pending:false,lastAttempt:now,last,problem:null},now)
    assert.equal(result.view.kind,age<45000?'verified':'reading')
    if(age<45000)assert.equal(result.view,last)
    assert.equal(result.shouldPoll,false)
  }
})
test('Stage0 polling retains its interval and avoids parallel reads while pending',()=>{
  const now=Date.parse('2026-11-12T00:00:00Z')
  for(const elapsed of [0,14499,14500,14501])for(const pending of [false,true]){
    assert.equal(polling({pending,lastAttempt:now-elapsed,last:null,problem:null},now).shouldPoll,!pending&&elapsed>=14500)
  }
})
test('invalid observation clocks cannot be returned as verified progress',()=>{
  const now=Date.parse('2026-11-12T00:00:00Z')
  for(const sourceTime of [null,undefined,'invalid']){
    assert.equal(polling({pending:false,lastAttempt:now,last:{kind:'verified',sourceTime},problem:null},now).view.kind,'unavailable')
  }
})
test('Stage0 polling retains a prior read error and recovers on a valid new snapshot',()=>{
  const now=Date.parse('2026-11-12T00:00:00Z'),cache={pending:false,lastAttempt:now-15000,last:null,problem:'读取失败'}
  assert.deepEqual(polling(cache,now),{shouldPoll:true,view:{kind:'unavailable',message:'读取失败'}})
  const last={kind:'verified',sourceTime:new Date(now).toISOString(),committed:312}
  assert.equal(polling({...cache,last,problem:null,lastAttempt:now},now).view,last)
})
const runId='stage0-native-256-formal-229',at='2026-11-03T01:22:00Z'
test('resumed progress retains the original stop and never calls a stale worker active',()=>{
  const originalStop={path:'.runtime/ai-painter/native-stage0-formal-training/'+runId+'/terminal.json',sha256:'3cb0712c1da6921fe6c5d370445679f8895328d51f096ecaa49de19ce3888fa1'}
  const base=project({...state,status:'failed_closed',endedAtUtc:at,sealedSegments:13,sealedPairs:312,counts:{generator:312,discriminator:312},currentSegment:13,currentEpoch:7,terminal:{status:'failed_closed',reason:'host or disk below floor'}})
  const s={runId,dispatchId:'resource-continuation-236',oldTerminal:originalStop,deadlineUtc:'2026-11-03T08:09:02.105Z',sourceTime:at,status:'waiting_resources',completedPairs:312,segment:14,hostAlive:true,activePid:345,activeProof:{identityVerified:true,pid:345}}
  const v=projectStage0Continuation(base,s)
  assert.equal(v.percentage,27.1);assert.equal(v.previousStop.committed,312);assert.equal(v.previousStop.endedAt,at)
  assert.equal(v.pendingG,null);assert.equal(v.workerOwned,false);assert.equal(v.endedAt,null)
  assert.throws(()=>projectStage0Continuation(base,{...s,hostAlive:false}))
  assert.throws(()=>projectStage0Continuation(base,{...s,oldTerminal:{...originalStop,sha256:'0'.repeat(64)}}))
  assert.equal(projectStage0Continuation(base,{...s,status:'not_started'}),base)
})
const state={runId,phase:'train',source:'local_native_stage0_service',snapshotAtUtc:at,status:'active',startedAtUtc:at,endedAtUtc:null,
  policy:{path:'data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json',sha256:'3f00ea5bb99997ddbdd4f051b424bd9177b1305591504874394370be461887e1'},
  elapsedSeconds:123.5,sealedSegments:1,sealedPairs:24,counts:{generator:24,discriminator:24},currentSegment:2,currentEpoch:1,
  host:{pid:10,alive:true},worker:{currentlyOwned:true,heartbeat:{utc:at,runId,segment:2,workerPid:11,phase:'training_guard',completedInMemory:{D:29,G:28}}},
  lastSegmentTicket:{runId,segment:2,startPair:24,endPair:48},terminal:null,validation:[]}
test('read totals and separate D/G in-flight without awarding additional committed pairs',()=>{
  const row=project(state);assert.deepEqual([row.committed,row.percentage,row.segments,row.pendingD,row.pendingG],[24,2.1,1,5,4])
  assert.deepEqual([row.hostPid,row.workerPid,row.workerOwned],[10,11,true]);assert.equal(row.links.length,2)
})
test('not-started, interrupted and fully trained but quality-failed are distinct and have honest percentages',()=>{
  const idle=project({...state,status:'not_started',startedAtUtc:null,sealedPairs:0})
  assert.equal(idle.epoch,null);assert.equal(idle.percentage,0);assert.equal(idle.startedAt,null)
  const stopped=project({...state,status:'failed_closed',terminal:{status:'failed_closed',reason:'disk reserve'}})
  assert.equal(stopped.reason,'disk reserve');assert.equal(stopped.committed,24)
  const final=project({...state,status:'training_completed_fixed_review_failed',terminal:{status:'training_completed_fixed_review_failed',reason:{qualityPassed:false}},
   currentSegment:48,currentEpoch:24,sealedSegments:48,sealedPairs:1152,counts:{generator:1152,discriminator:1152},endedAtUtc:at})
  assert.equal(final.percentage,100);assert.equal(final.reason,'固定审核未通过');assert.equal(final.pendingD,null)
})
test('qualification fixtures, altered contract and inconsistent sealed counts cannot become a percentage',()=>{
  for(const patch of [{phase:'cpu_rehearsal'},{counts:{generator:25,discriminator:24}},{sealedPairs:35},{policy:{...state.policy,sha256:'0'.repeat(64)}},{currentEpoch:12}]){
    assert.throws(()=>project({...state,...patch}))
  }
  const bad=project({...state,worker:{heartbeat:{...state.worker.heartbeat,runId:'other'}}});assert.equal(bad.pendingG,null)
})

const historyRoot='.runtime/ai-painter/native-stage0-formal-training/'+runId
function historyRecords(){
  return new Map([['opening.json','opening.json'],['terminal.json','terminal.json'],['segments/13/seal.json','seal13.json']]
    .map(([logical,name])=>[historyRoot+'/'+logical,fs.readFileSync(new URL('./fixtures/native-stage0-history/'+name,import.meta.url))]))
}
function historyFixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'native-stage0-history-'))
  t.after(()=>{
    const resolved=fs.realpathSync(root),parent=fs.realpathSync(os.tmpdir()),relative=path.relative(parent,resolved)
    assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));assert(path.basename(resolved).startsWith('native-stage0-history-'))
    fs.rmSync(resolved,{recursive:true})
  })
  for(const [p,b]of historyRecords()){const target=path.join(root,p);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b)}
  return root
}
test('historical stop reads only three bound metadata records and preserves original times',()=>{
  const records=historyRecords(),calls=[]
  const result=verifyNativeStage0HistoricalStop((p,max)=>{calls.push(p);assert(records.has(p));assert.equal(max,16384);return Buffer.from(records.get(p))})
  assert.deepEqual(calls,[...records.keys()]);assert.equal(result.status,'verified')
  assert.equal(result.recordedPairs,312);assert.equal(result.recordedSegments,13)
  assert.equal(result.startedAt,'2026-11-02T23:09:02.105Z');assert.equal(result.endedAt,'2026-11-03T00:47:51.135Z')
  assert.equal(result.checkpointRevalidated,false);assert(!('hostAlive' in result));assert(!('percentage' in result));assert(!('qualificationGranted' in result))
})
test('each historical record rejects byte changes and missing data without accepting partial counts',()=>{
  for(const key of historyRecords().keys()){
    const records=historyRecords()
    assert.throws(()=>verifyNativeStage0HistoricalStop(p=>p===key?Buffer.concat([records.get(p),Buffer.from(' ')]):records.get(p)),/digest differs/)
    assert.throws(()=>verifyNativeStage0HistoricalStop(p=>{if(p===key)throw Object.assign(Error('missing'),{code:'ENOENT'});return records.get(p)}),/missing/)
  }
})
test('historical filesystem reader ignores installed model code and refuses damaged historical evidence',t=>{
  const root=historyFixture(t),source=path.join(root,'ml/ai-painter/src/ai_painter/training/dataset.py')
  fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'raise RuntimeError("must never execute")')
  const before=readNativeStage0HistoricalStop(root);assert.equal(before.status,'verified')
  fs.writeFileSync(source,'different current implementation')
  const after=readNativeStage0HistoricalStop(root);assert.equal(after.status,'verified');assert.equal(after.recordedPairs,before.recordedPairs)
  fs.appendFileSync(path.join(root,historyRoot,'terminal.json'),' ')
  const rejected=readNativeStage0HistoricalStop(root);assert.equal(rejected.status,'unavailable');assert(!('recordedPairs' in rejected))
})
test('actual progress reader retains verified history when current reporter installation is absent or invalid',t=>{
  const root=historyFixture(t),moduleUrl=new URL('../../src/server/local-backup/native-stage0-training-progress.mjs',import.meta.url).href
  const code=`process.chdir(process.argv[1]);const m=await import(process.argv[2]);console.log(JSON.stringify(m.readNativeStage0TrainingProgress(process.cwd())))`
  const run=()=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code,root,moduleUrl],{encoding:'utf8',windowsHide:true,timeout:15000}))
  for(const invalid of [false,true]){
    if(invalid){const p=path.join(root,'data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'{}')}
    const view=run();assert.equal(view.kind,'unavailable');assert.equal(view.historicalStop.status,'verified');assert.equal(view.historicalStop.recordedPairs,312);assert(!('committed' in view))
  }
})

const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),ts=require('typescript')
const componentFile=fileURLToPath(new URL('../../src/app/local-backup/progress/current-native-training.tsx',import.meta.url))
const compiled=ts.transpileModule(fs.readFileSync(componentFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
const component={}
const componentDependencies={'react/jsx-runtime':require('react/jsx-runtime'),'./current-delivery.module.css':{default:{}},
  'next/link':{default:props=>React.createElement('a',props)}}
new Function('require','exports',compiled)(name=>{assert(Object.hasOwn(componentDependencies,name),'unregistered test component dependency: '+name);return componentDependencies[name]},component)
const render=data=>renderToStaticMarkup(React.createElement(component.CurrentNativeTraining,{data}))
function historyView(){return {...verifyNativeStage0HistoricalStop(p=>historyRecords().get(p)),verifiedAtUtc:'2026-11-12T02:00:00Z'}}
test('unavailable current UI shows historical counts with explicit scope, never a live progress bar',()=>{
  const html=render({kind:'unavailable',message:'当前查询失败',historicalStop:historyView()})
  assert(html.includes('当前查询失败'));assert(html.includes('首次停机记录（历史）'));assert(html.includes('312'));assert(html.includes('不代表最新接续进度或可恢复资格'));assert(!html.includes('<progress'));assert(!html.includes('27.1%'))
})
test('missing historical evidence does not hide valid current progress or fabricate old counts',()=>{
  const html=render({...project(state),historicalStop:{status:'unavailable',message:'历史记录校验失败'}})
  assert(html.includes('历史记录校验失败'));assert(html.includes('2.1%'));assert(html.includes('<progress'));assert(!html.includes('312'))
})

function addContinuationRecords(root){
  const records=new Map([['continuations/resource-continuation-236/terminal.json','continuation-terminal.json'],
    ['segments/48/seal.json','seal48.json'],['segments/48/final-readback-seal.json','final-readback-seal.json']]
    .map(([logical,name])=>[historyRoot+'/'+logical,fs.readFileSync(new URL('./fixtures/native-stage0-history/'+name,import.meta.url))]))
  for(const [p,b]of records){const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b)}
  return records
}
test('complete history retains first stop and distinguishes completed updates from failed fixed review',t=>{
  const root=historyFixture(t);addContinuationRecords(root)
  const history=readNativeStage0HistoricalStop(root)
  assert.equal(history.status,'verified');assert.equal(history.recordedPairs,312)
  assert.equal(history.continuation.status,'verified');assert.equal(history.continuation.recordedPairs,1152)
  assert.equal(history.continuation.runStatus,'training_completed_fixed_review_failed')
  assert.equal(history.continuation.endedAt,'2026-11-03T07:01:29.622Z')
  assert.equal(history.continuation.checkpointRevalidated,false);assert.equal(history.continuation.reviewRecomputed,false)
  const html=render({kind:'unavailable',message:'当前查询不可用',historicalStop:history})
  assert(html.includes('312'));assert(html.includes('1152'));assert(html.includes('训练完成，固定审核未通过'))
  assert(!html.includes('<progress'));assert(!html.includes('100%'));assert(html.includes('不代表模型能力通过或当前正在训练'))
})
test('each damaged or missing continuation record is rejected without discarding first-stop evidence',t=>{
  const root=historyFixture(t),records=addContinuationRecords(root)
  for(const [p,raw]of records){
    const file=path.join(root,p)
    fs.writeFileSync(file,Buffer.concat([raw,Buffer.from(' ')]))
    let view=readNativeStage0HistoricalStop(root)
    assert.equal(view.status,'verified');assert.equal(view.recordedPairs,312);assert.equal(view.continuation.status,'unavailable')
    assert(!('recordedPairs' in view.continuation))
    fs.unlinkSync(file)
    view=readNativeStage0HistoricalStop(root);assert.equal(view.status,'verified');assert.equal(view.continuation.status,'unavailable')
    fs.writeFileSync(file,raw)
    assert.equal(readNativeStage0HistoricalStop(root).continuation.status,'verified')
  }
})
test('valid current progress remains visible when the continuation history cannot be verified',()=>{
  const history={...historyView(),continuation:{status:'unavailable',message:'接续终态校验失败'}}
  const html=render({...project(state),historicalStop:history})
  assert(html.includes('2.1%'));assert(html.includes('312'));assert(html.includes('接续终态校验失败'));assert(!html.includes('1152 对更新、48'))
})
