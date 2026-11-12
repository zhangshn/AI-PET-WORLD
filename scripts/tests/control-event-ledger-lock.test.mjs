import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import test from 'node:test'
import ts from 'typescript'

function fixture({existing=false,failPhase=null,closeFails=false}={}) {
  const trace=[],failure=Object.assign(Error('private initialization error'),{code:'EIO'})
  const own={ino:11,dev:7,mtimeMs:Date.now()-60_000,isFile:()=>true,isSymbolicLink:()=>false}
  let current=existing?own:null,closed=false,bodyCalls=0
  const handle={
    writeFile:async()=>{trace.push('write');if(failPhase==='write')throw failure},
    stat:async()=>{trace.push('fstat');if(failPhase==='fstat')throw failure;return own},
    close:async()=>{trace.push('close');closed=true;if(closeFails)throw Error('secondary close failure')},
  }
  const io={
    mkdir:async()=>{},
    open:async(_file,mode)=>{assert.equal(mode,'wx');trace.push('open');if(failPhase==='open')throw failure;if(current)throw Object.assign(Error('held'),{code:'EEXIST'});current=own;return handle},
    stat:async()=>current,
    lstat:async()=>{trace.push('lstat');if(!current)throw Object.assign(Error('missing'),{code:'ENOENT'});return current},
    unlink:async()=>{trace.push('unlink');current=null},
  }
  const source=fs.readFileSync('src/server/ai-console-control/control-event-ledger.ts','utf8')+'\nexport { withLedgerLock as fixtureWithLedgerLock };\n'
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const exports={},resolve=id=>{if(id==='node:fs/promises')return io;if(id==='node:fs')return {existsSync:()=>false};if(id==='node:path')return path;if(id==='node:crypto')return crypto;throw Error('unexpected dependency '+id)}
  new Function('require','exports','setTimeout',output)(resolve,exports,callback=>{trace.push('wait');callback()})
  return {trace,failure,get current(){return current},get closed(){return closed},get bodyCalls(){return bodyCalls},replace(value){current=value},run:operation=>exports.fixtureWithLedgerLock(async()=>{bodyCalls++;return operation?.()??'private result'})}
}

test('control ledger does not steal a held lock merely because its timestamp is old',async()=>{
  const f=fixture({existing:true}),original=f.current
  await assert.rejects(f.run(),/ai_console_control_event_ledger_lock_timeout/)
  assert.equal(f.current,original);assert.equal(f.bodyCalls,0)
  assert.equal(f.trace.filter(x=>x==='open').length,40)
  assert.equal(f.trace.includes('unlink'),false)
})

test('control ledger releases its own lock and preserves operation result or error',async()=>{
  const f=fixture();assert.equal(await f.run(),'private result');assert.equal(f.closed,true);assert.equal(f.current,null)
  const g=fixture(),failure=Error('operation failure')
  await assert.rejects(g.run(()=>{throw failure}),error=>error===failure)
  assert.equal(g.closed,true);assert.equal(g.current,null)
})

test('control ledger preserves a substituted file or symbolic link at release',async()=>{
  for(const replacement of [{ino:12,dev:7,isFile:()=>true,isSymbolicLink:()=>false},{ino:11,dev:7,isFile:()=>false,isSymbolicLink:()=>true}]){
    const f=fixture()
    await assert.rejects(f.run(()=>{f.replace(replacement)}),/ai_console_control_event_ledger_lock_identity_changed/)
    assert.equal(f.current,replacement);assert.equal(f.closed,true);assert.equal(f.trace.includes('unlink'),false)
  }
})

test('control ledger initialization failures close the owned handle and retain evidence',async()=>{
  for(const failPhase of ['write','fstat']){
    const f=fixture({failPhase})
    await assert.rejects(f.run(),error=>error===f.failure)
    assert.equal(f.closed,true);assert(f.current);assert.equal(f.bodyCalls,0);assert.equal(f.trace.includes('unlink'),false)
  }
})

test('control ledger preserves the first initialization failure if close also fails',async()=>{
  const f=fixture({failPhase:'write',closeFails:true})
  await assert.rejects(f.run(),error=>error===f.failure)
  assert.equal(f.closed,true);assert(f.current);assert.equal(f.bodyCalls,0)
})

test('control ledger does not retry or delete on an IO error opening the lock',async()=>{
  const f=fixture({failPhase:'open'})
  await assert.rejects(f.run(),error=>error===f.failure)
  assert.equal(f.trace.filter(x=>x==='open').length,1);assert.equal(f.trace.includes('unlink'),false);assert.equal(f.bodyCalls,0)
})
