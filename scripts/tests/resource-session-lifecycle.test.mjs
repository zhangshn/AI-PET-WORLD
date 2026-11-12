import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const flush=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function fixture({holdSample=0,failAppendAt=0,failFinalWrite=false,atomicFailure=null}={}) {
  const files=new Map(),timers=[],operations=[],held=deferred()
  let calls=0,active=0,maxActive=0,appends=0,temporaryIdentity=0
  const sample=async()=>{
    calls++;active++;maxActive=Math.max(maxActive,active)
    if(calls===holdSample)await held.promise
    active--
    return {stdout:'Private GPU, 100, 10, 10, 40, 50, 100, private-driver'}
  }
  const failure=Object.assign(Error('private resource write failure'),{code:'EIO'})
  const io={
    mkdir:async()=>{},
    writeFile:async(file,text)=>{operations.push(['write',path.basename(file)]);if((failFinalWrite||atomicFailure==='write')&&file.includes('latest-session.json')){files.set(file,'partial');throw failure};files.set(file,Buffer.isBuffer(text)?text.toString():text)},
    appendFile:async(file,text)=>{appends++;if(appends===failAppendAt)throw failure;operations.push(['append',path.basename(file)]);files.set(file,(files.get(file)??'')+text)},
    readFile:async file=>{if(!files.has(file))throw Object.assign(Error('absent'),{code:'ENOENT'});return files.get(file)},
    rm:async file=>{operations.push(['rm',path.basename(file)]);files.delete(file)},
    open:async(file,mode)=>{assert.equal(mode,'wx');assert(!files.has(file));return {
      writeFile:bytes=>io.writeFile(file,bytes),
      sync:async()=>{operations.push(['sync',path.basename(file)]);if(atomicFailure==='sync'&&file.includes('latest-session.json'))throw failure},
      close:async()=>{operations.push(['close',path.basename(file)])},
    }},
    rename:async(from,to)=>{operations.push(['rename',path.basename(to)]);if(atomicFailure==='rename'&&to.endsWith('latest-session.json'))throw failure;files.set(to,files.get(from));files.delete(from)},
  }
  const source=fs.readFileSync('src/server/ai-painter-resource-usage.ts','utf8')
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const exports={}
  const resolve=id=>{
    if(id==='node:path')return path
    if(id==='node:fs/promises')return io
    if(id==='node:child_process')return {execFile:()=>{throw Error('real subprocess forbidden')}}
    if(id==='node:util')return {promisify:()=>sample}
    if(id==='node:crypto')return {randomUUID:()=>String(++temporaryIdentity)}
    if(id==='@/server/ai-pet-world-storage')return {aiPainterRuntimeRoot:path.resolve('private-resource-session/.runtime/ai-painter')}
    if(id==='@/server/ai-pet-world-storage-catalog')return {}
    if(id==='./ai-painter-training-state'){
      const writer={}
      const code=ts.transpileModule(fs.readFileSync('src/server/ai-painter-training-state.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
      new Function('require','exports',code)(resolve,writer)
      return writer
    }
    if(id.endsWith('runtime-working-directory.mjs'))return {runtimeWorkingDirectory:()=>path.resolve('private-resource-session')}
    throw Error('unexpected dependency '+id)
  }
  new Function('require','exports','setInterval','clearInterval',output)(resolve,exports,callback=>{const timer={callback,active:true};timers.push(timer);return timer},timer=>{timer.active=false})
  return {exports,files,operations,held,failure,get calls(){return calls},get maxActive(){return maxActive},tick(){for(const timer of timers)if(timer.active)timer.callback()}}
}
const completed={status:'completed',error:null}

for(const phase of ['write','sync','rename'])test(`resource latest summary preserves prior bytes on atomic ${phase} failure`,async()=>{
  const f=fixture({atomicFailure:phase}),session=await f.exports.startResourceUsageSession('private')
  const latest=path.resolve('private-resource-session/.runtime/ai-painter/training-resource-usage/latest-session.json')
  f.files.set(latest,'previous valid summary')
  await assert.rejects(session.finish(completed),error=>error===f.failure)
  assert.equal(f.files.get(latest),'previous valid summary')
  assert(!f.operations.some(([operation,file])=>operation==='append'&&file==='session-history.jsonl'))
  assert([...f.files.keys()].some(file=>file.endsWith('current-session.json')))
})

test('resource finish joins pending sampling and prevents late current-session resurrection',async()=>{
  const f=fixture({holdSample:2}),session=await f.exports.startResourceUsageSession('private')
  f.tick();await flush()
  let finished=false
  const terminal=session.finish(completed).then(value=>{finished=true;return value})
  await flush();const finishedBeforeSample=finished
  f.held.resolve();const result=await terminal;await flush()
  assert.equal(finishedBeforeSample,false)
  assert.equal(f.maxActive,1)
  assert.equal(result.sampleCount,3)
  assert(![...f.files.keys()].some(file=>file.endsWith('current-session.json')))
  assert.equal(f.operations.at(-1)[0],'rm')
})

test('resource repeated finish stays bound to the original session after another session completes',async()=>{
  const f=fixture(),a=await f.exports.startResourceUsageSession('private-a')
  const first=a.finish(completed),result=await first
  const b=await f.exports.startResourceUsageSession('private-b');await b.finish(completed)
  const repeated=a.finish({status:'failed',error:'late conflicting request'})
  assert.equal(await repeated,result)
  assert.equal(repeated,first)
  assert.equal(result.sessionId,a.sessionId)
  const history=[...f.files.entries()].find(([file])=>file.endsWith('session-history.jsonl'))[1]
  assert.equal(history.trim().split('\n').length,2)
})

test('resource timer coalesces overlap and captures sampling IO failure separately from training outcome',async()=>{
  const f=fixture({holdSample:2,failAppendAt:2}),session=await f.exports.startResourceUsageSession('private')
  f.tick();f.tick();f.tick();await flush()
  f.held.resolve();await flush()
  const result=await session.finish(completed)
  assert.equal(f.maxActive,1)
  assert.equal(f.calls,3)
  assert.equal(result.status,'completed')
  assert.equal(result.samplingStatus,'degraded')
  assert.equal(result.samplingError,'resource_sample_collection_failed:EIO')
})

test('resource initial and final write failures are not replaced by a fabricated latest summary',async()=>{
  const initial=fixture({failAppendAt:1})
  await assert.rejects(initial.exports.startResourceUsageSession('private'),error=>error===initial.failure)
  const final=fixture({failFinalWrite:true}),session=await final.exports.startResourceUsageSession('private')
  const first=session.finish(completed)
  await assert.rejects(first,error=>error===final.failure)
  const second=session.finish(completed)
  assert.equal(second,first)
  await assert.rejects(second,error=>error===final.failure)
  assert([...final.files.keys()].some(file=>file.endsWith('current-session.json')))
})
