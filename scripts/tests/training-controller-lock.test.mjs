import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

function fixture({pid=null,probeCode=null,failPhase=null,livePids=[],persistedStates=[]}={}) {
  const trace=[],failure=Object.assign(Error('private '+(probeCode??failPhase)),{code:probeCode??'EIO'})
  let current=pid===null?null:{ino:1,dev:1,pid},nextIno=2,closed=false
  const stat=value=>({...value,isFile:()=>true,isSymbolicLink:()=>false})
  const io={mkdirSync:()=>{},
    openSync:(_file,mode)=>{assert.equal(mode,'wx');trace.push('open');if(failPhase==='open')throw failure;if(current)throw Object.assign(Error('held'),{code:'EEXIST'});current={ino:nextIno++,dev:1};return 123},
    writeFileSync:(_fd,bytes)=>{trace.push('write');if(failPhase==='write')throw failure;current.pid=JSON.parse(bytes).controllerPid},
    fstatSync:()=>{if(failPhase==='fstat')throw failure;return stat(current)},
    lstatSync:()=>{if(!current)throw Object.assign(Error('missing'),{code:'ENOENT'});return stat(current)},
    readFileSync:()=>JSON.stringify({controllerPid:current?.pid}),
    closeSync:()=>{closed=true;trace.push('close')},
    unlinkSync:()=>{trace.push('unlink');current=null},
  }
  const fakeProcess={pid:999,kill:(value,signal)=>{assert.equal(signal,0);trace.push(['probe',value]);if(livePids.includes(value))return;if(probeCode)throw failure}}
  const source=fs.readFileSync('src/server/ai-painter-training-controller.ts','utf8')+'\nexport { acquireTrainingProcessLock as fixtureAcquire, isProcessAlive as fixtureAlive };\n'
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,exports={}
  const resolve=id=>{if(id==='node:path')return path;if(id==='node:fs')return io;if(id==='node:fs/promises')return {};if(id==='node:child_process')return {spawn:()=>{throw Error('must not spawn')}};if(id==='./ai-painter-training-state')return {aiPainterRuntimeRoot:'private-runtime',trainingControlDir:'private-control',readTrainingControlState:async()=>{trace.push('read-state');const state=persistedStates.shift();if(state instanceof Error)throw state;assert(state,'unexpected state read');return state}};if(['./ai-painter-resource-usage','./ai-painter-training-result-archive','./ai-painter-training-world-promotion'].includes(id))return {};throw Error('unexpected dependency '+id)}
  new Function('require','exports','process',output)(resolve,exports,fakeProcess)
  return {trace,failure,acquire:()=>exports.fixtureAcquire('train'),start:()=>exports.startTrainingAction('train'),get current(){return current},get closed(){return closed},replace(){current={ino:99,dev:1,pid:1234}},alive:exports.fixtureAlive}
}

test('training lock does not mistake permission or unknown probe failures for a dead process',()=>{
  for(const probeCode of ['EPERM','EACCES','EIO']){
    const f=fixture({pid:1234,probeCode}),original=f.current
    assert.throws(f.acquire,error=>error===f.failure)
    assert.equal(f.current,original);assert.equal(f.trace.includes('unlink'),false)
  }
})

test('training lock preserves invalid owner PIDs rather than reclaiming them',()=>{
  for(const pid of [0,-1,1.5,2147483648]){
    const f=fixture({pid,probeCode:'ESRCH'}),original=f.current
    assert.throws(f.acquire);assert.equal(f.current,original);assert.equal(f.trace.includes('unlink'),false)
  }
})

test('training lock retains live owners and still recovers a confirmed departed owner',()=>{
  const live=fixture({pid:1234});assert.throws(live.acquire);assert.equal(live.trace.includes('unlink'),false)
  const dead=fixture({pid:1234,probeCode:'ESRCH'}),release=dead.acquire();assert.equal(dead.current.pid,999);release();assert.equal(dead.current,null)
})

test('training lock preserves original opening errors without pretending there is another owner',()=>{
  const f=fixture({failPhase:'open'});assert.throws(f.acquire,error=>error===f.failure);assert.equal(f.trace.includes('unlink'),false)
})

test('training lock initialization failures close the handle and preserve failed lock evidence',()=>{
  for(const failPhase of ['write','fstat']){
    const f=fixture({failPhase});assert.throws(f.acquire,error=>error===f.failure);assert.equal(f.closed,true);assert(f.current);assert.equal(f.trace.includes('unlink'),false)
  }
})

test('training lock release cannot delete a replacement owner and remains idempotent normally',()=>{
  const f=fixture(),release=f.acquire();f.replace();const replacement=f.current
  assert.throws(release,/training_process_lock_identity_changed/);assert.equal(f.current,replacement)
  const normal=fixture(),finish=normal.acquire();finish();finish();assert.equal(normal.trace.filter(x=>x==='unlink').length,1)
})

test('training startup preserves a departed controller lock while its recorded child is alive',async()=>{
  const f=fixture({pid:1234,probeCode:'ESRCH',livePids:[7777],persistedStates:[{status:'running',childPid:7777}]}),original=f.current
  await assert.rejects(f.start(),/已有本地训练任务正在运行/)
  assert.equal(f.current,original);assert.equal(f.trace.includes('open'),false);assert.equal(f.trace.includes('unlink'),false)
})

test('training startup preserves the previous lock when state or child liveness cannot be read',async()=>{
  const failure=Error('private state read failure'),f=fixture({pid:1234,probeCode:'ESRCH',persistedStates:[failure]}),original=f.current
  await assert.rejects(f.start(),error=>error===failure)
  assert.equal(f.current,original);assert.equal(f.trace.includes('unlink'),false)
  const g=fixture({pid:1234,probeCode:'EPERM',persistedStates:[{status:'running',childPid:7777}]}),before=g.current
  await assert.rejects(g.start(),error=>error===g.failure)
  assert.equal(g.current,before);assert.equal(g.trace.includes('open'),false)
})

test('training startup rechecks the child after acquiring the lock',async()=>{
  const f=fixture({livePids:[7777],persistedStates:[{status:'idle',childPid:null},{status:'running',childPid:7777}]})
  await assert.rejects(f.start(),/已有本地训练任务正在运行/)
  assert.equal(f.trace.filter(x=>x==='read-state').length,2);assert.equal(f.current,null)
  assert.equal(f.trace.filter(x=>x==='unlink').length,1)
})

test('training startup refuses corrupted or recovery-required state before and after locking',async()=>{
  for(const status of ['corrupted_state','recovery_required']){
    const bad={status,childPid:null,error:'private broken state'},before=fixture({pid:1234,probeCode:'ESRCH',persistedStates:[bad,bad]}),original=before.current
    await assert.rejects(before.start(),/training_control_state_unavailable/)
    assert.equal(before.current,original);assert.equal(before.trace.includes('open'),false)
    const after=fixture({persistedStates:[{status:'idle',childPid:null},bad]})
    await assert.rejects(after.start(),/training_control_state_unavailable/)
    assert.equal(after.current,null);assert.equal(after.trace.filter(x=>x==='unlink').length,1)
  }
})
