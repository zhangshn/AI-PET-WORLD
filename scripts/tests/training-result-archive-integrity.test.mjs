import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const indexSchema='ai-painter-generated-results-index-v1'
const historical={id:'historic',title:'retained historical result'}
const valid={schemaVersion:indexSchema,updatedAt:'2026-07-01T00:00:00Z',results:[historical]}
function fixture(content,{failurePhase=null}={}) {
  const writes=[],operations=[],files=new Map(),indexPath=path.resolve('private-archive-fixture/generated-results/index.json'),failure=Object.assign(Error('private archive IO failure'),{code:'EIO'})
  if(typeof content==='string')files.set(indexPath,Buffer.from(content))
  const io={
    readFile:async()=>{if(content instanceof Error)throw content;return content},
    mkdir:async()=>{},
    writeFile:async(file,bytes)=>{
      writes.push([file,bytes]);operations.push('write')
      if(failurePhase==='write'){files.set(file,Buffer.from(bytes).subarray(0,3));throw failure}
      files.set(file,Buffer.from(bytes))
    },
    open:async(file,mode)=>{
      assert.equal(mode,'wx');assert(!files.has(file));files.set(file,Buffer.alloc(0));operations.push('open')
      return {writeFile:bytes=>io.writeFile(file,bytes),sync:async()=>{operations.push('sync');if(failurePhase==='sync')throw failure},close:async()=>{operations.push('close')}}
    },
    rename:async(from,to)=>{operations.push('rename');if(failurePhase==='rename')throw failure;files.set(to,files.get(from));files.delete(from)},
    rm:async file=>{operations.push('rm');files.delete(file)},
  }
  const stateSource=fs.readFileSync('src/server/ai-painter-training-state.ts','utf8')
  const writerSource=stateSource+(stateSource.includes('export async function writeJsonAtomic(')?'':'\nexport { writeJsonAtomic };')
  const compilerOptions={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},writer={}
  new Function('require','exports',ts.transpileModule(writerSource,{compilerOptions}).outputText)(id=>{
    if(id==='node:path')return path
    if(id==='node:fs/promises')return io
    if(id==='node:crypto')return {randomUUID:()=> 'private-archive-write'}
    if(id==='@/server/ai-pet-world-storage')return {aiPainterRuntimeRoot:path.resolve('private-archive-fixture')}
    if(id==='@/server/ai-pet-world-storage-catalog')return {}
    throw Error('unexpected writer dependency '+id)
  },writer)
  const source=fs.readFileSync('src/server/ai-painter-training-result-archive.ts','utf8')
    .replace('async function upsertGeneratedResult(', 'export async function upsertGeneratedResult(')
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const resolve=id=>{
    if(id==='node:path')return path
    if(id==='node:fs/promises')return io
    if(id==='./ai-painter-training-state')return {aiPainterRuntimeRoot:path.resolve('private-archive-fixture'),writeJsonAtomic:writer.writeJsonAtomic}
    if(id==='./ai-painter-training-quality-gate'||id==='./ai-pet-world-storage-catalog')return {}
    throw Error('unexpected archive dependency '+id)
  }
  const exports={};new Function('require','exports',output)(resolve,exports)
  return {...exports,writes,operations,files,indexPath,failure}
}

test('missing archive index is empty while valid legacy records retain every supplied field',async()=>{
  const missing=fixture(Object.assign(Error('private missing'),{code:'ENOENT'}))
  assert.deepEqual(await missing.readGeneratedResultsIndex(),{schemaVersion:indexSchema,updatedAt:new Date(0).toISOString(),results:[]})
  assert.deepEqual(await fixture(JSON.stringify(valid)).readGeneratedResultsIndex(),valid)
})

test('archive read failures and malformed envelopes cannot overwrite previous history',async()=>{
  const failures=[Object.assign(Error('private denied'),{code:'EACCES'}),Object.assign(Error('private IO'),{code:'EIO'}),'{broken','null','[]',JSON.stringify({...valid,schemaVersion:'other'}),JSON.stringify({...valid,results:{}}),JSON.stringify({...valid,results:[null]}),JSON.stringify({...valid,results:[{}]}),JSON.stringify({...valid,updatedAt:null}),JSON.stringify({...valid,results:[{...historical,archivedAt:12}]})]
  for(const content of failures){
    const f=fixture(content)
    await assert.rejects(f.upsertGeneratedResult({id:'new',archivedAt:'2026-11-11T00:00:00Z'}))
    assert.equal(f.writes.length,0,'invalid history must not become a newly written empty index')
  }
})

test('valid archived result updates retain older records without inventing their absent fields',async()=>{
  const f=fixture(JSON.stringify(valid)),next={id:'new',archivedAt:'2026-11-11T00:00:00Z'}
  await f.upsertGeneratedResult(next)
  assert.equal(f.writes.length,1)
  const stored=JSON.parse(f.writes[0][1])
  assert.deepEqual(stored.results,[next,historical])
  assert.equal(Object.hasOwn(stored.results[1],'archivedAt'),false)
})

for(const failurePhase of ['write','sync','rename'])test(`archive ${failurePhase} failure preserves the prior index bytes`,async()=>{
  const original=JSON.stringify(valid),f=fixture(original,{failurePhase})
  await assert.rejects(f.upsertGeneratedResult({id:'new',archivedAt:'2026-11-11T00:00:00Z'}),error=>error===f.failure)
  assert.deepEqual(f.files.get(f.indexPath),Buffer.from(original))
  assert(f.operations.includes('close'),'opened temporary handle must be closed')
  if(failurePhase!=='rename')assert(!f.operations.includes('rename'))
})

test('successful archive replacement uses complete expected JSON and closes its temporary handle',async()=>{
  const f=fixture(JSON.stringify(valid)),next={id:'new',archivedAt:'2026-11-11T00:00:00Z'}
  await f.upsertGeneratedResult(next)
  assert.deepEqual(f.operations,['open','write','sync','close','rename'])
  const bytes=f.files.get(f.indexPath),parsed=JSON.parse(bytes)
  assert.deepEqual(parsed.results,[next,historical]);assert.equal(bytes.toString(),JSON.stringify(parsed,null,2)+'\n')
  assert.equal(f.files.size,1)
})
