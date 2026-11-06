import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'
import {loadLoopRuntime} from './helpers/world-evolution-loop-loader.mjs'

const base=pathToFileURL(path.resolve('src/world/runtime')+path.sep).href
const hooks=registerHooks({resolve(id,context,next){
  if(context.parentURL?.startsWith(base)&&['./world-runtime-record-validation','./runtime-path-security'].includes(id))return next(new URL(id+'.ts',context.parentURL).href,context)
  return next(id,context)
}})
let history
try{({recentNaturalPlayerHistory:history}=await import(base+'natural-player-history.ts'))}finally{hooks.deregister()}

test('an empty world has no history to display and requires no receipt reads',async()=>{
  const value=await history('','',{eventCursor:0},'',()=>assert.fail('unexpected read'))
  assert.deepEqual(value,{status:'available',entries:[]})
})
test('missing or mismatched event receipt does not produce a player history',async()=>{
  const key='a'.repeat(64),record={eventCursor:1,worldState:{payload:{environment:{evolution:{commit:{businessKey:key}}}}}}
  for(const read of [()=>({status:'empty'}),()=>({status:'found',receipt:{fileSha256:'wrong'},event:{}})]){
    assert.deepEqual(await history('','',record,'actual-sha',read),{status:'unavailable',entries:[]})
  }
})
const root=path.resolve('data/world-runtime'),ownerId='mvp-natural-owner-001',worldId='mvp-natural-world-001'
test('registered current world returns three adjacent original receipts with player-safe values',async t=>{
  if(!fs.existsSync(path.join(root,ownerId,worldId+'.json')))return t.skip('no registered first-world Store on this installation')
  const runtime=await loadLoopRuntime(process.cwd()),store=runtime.store.createProductionWorldRuntimeStore(root)
  const head=await store.readNatural({ownerId,worldId})
  assert.equal(head.status,'found')
  const read=q=>store.readNaturalTransition(q),v=await history(root,head.path,head.record,head.fileSha256,read)
  assert.equal(v.status,'available')
  assert.equal(v.entries.length,Math.min(3,head.record.eventCursor))
  for(const [i,e] of v.entries.entries()){
    assert.equal(e.cursor,head.record.eventCursor-i)
    assert.match(e.date,/^\d{4}-\d{2}-\d{2}$/)
    assert.deepEqual(Object.keys(e).sort(),['changeCount','cursor','date','kind','tick','weather'])
    for(const w of e.weather)assert(Number.isFinite(w.value))
  }
  if(v.entries.length>1){
    let calls=0
    const broken=await history(root,head.path,head.record,head.fileSha256,async q=>{
      const r=await read(q)
      return ++calls===2?{...r,receipt:{...r.receipt,fileSha256:'0'.repeat(64)}}:r
    })
    assert.deepEqual(broken,{status:'unavailable',entries:[]})
  }
  t.diagnostic(JSON.stringify(v.entries))
})

test('rejects stale, repeated, oversized and malformed locators before looking up any key', async () => {
  const head = {eventCursor:31}, headSha = 'a'.repeat(64), key = 'b'.repeat(64)
  const cases = [[key+'.'+key,'stale_page'],[['x','y'],'invalid_page'],['','invalid_page'],
    [headSha+'.../foo','invalid_page'],[[headSha,...Array(11).fill(key)].join('.'),'invalid_page']]
  for (const [cursor,status] of cases)
    assert.deepEqual(await history('','',head,headSha,()=>assert.fail('unexpected lookup'),cursor),{status,entries:[]})
})

test('pages the committed first-world history both ways including initialization, with bounded reads',async t=>{
  if(!fs.existsSync(path.join(root,ownerId,worldId+'.json')))return t.skip('no registered first-world Store on this installation')
  const runtime=await loadLoopRuntime(process.cwd()),store=runtime.store.createProductionWorldRuntimeStore(root)
  const head=await store.readNatural({ownerId,worldId})
  assert.equal(head.status,'found')
  let calls=0
  const get=(token,read=q=>{calls++;return store.readNaturalTransition(q)})=>
    history(root,head.path,head.record,head.fileSha256,read,token)
  const ids=[],pageKeys=[],readCounts=[],pageMs=[]
  let token,second
  do {
    calls=0
    const started=performance.now(),page=await get(token)
    pageMs.push(Math.round(performance.now()-started))
    assert.equal(page.status,'available')
    assert(page.entries.length>0 && page.entries.length<=3)
    readCounts.push(calls)
    assert(calls<=3)
    if(pageKeys.length) assert.equal(page.newer,pageKeys.at(-1)??'')
    if(pageKeys.length===1) second=page
    pageKeys.push(token)
    ids.push(...page.entries.map(e=>e.cursor))
    token=page.older
  } while(token)
  const expectedCount=Math.min(33,head.record.eventCursor)
  assert.deepEqual(ids,Array.from({length:expectedCount},(_,i)=>head.record.eventCursor-i))
  if(second) {
    assert.equal((await get(second.newer || undefined)).entries[0].cursor,head.record.eventCursor)
    const valid=pageKeys[1]
    const tampered=valid.slice(0,-1)+(valid.endsWith('a')?'b':'a')
    assert.deepEqual(await get(tampered),{status:'unavailable',entries:[]})
    const foreign={...head.record,worldId:'another-world'}
    assert.deepEqual(await history(root,head.path,foreign,head.fileSha256,q=>store.readNaturalTransition(q),valid),
      {status:'unavailable',entries:[]})
    assert.deepEqual(await get(valid,async q=>{
      const actual=await store.readNaturalTransition(q)
      return {...actual,receipt:{...actual.receipt,businessKey:'c'.repeat(64)}}
    }),{status:'unavailable',entries:[]})
    if(pageKeys[2]) {
      assert.deepEqual((await get((await get(pageKeys[2])).newer)).entries,second.entries)
      const altered = pageKeys[2].split('.')
      altered[1] = '0'.repeat(64)
      const independentlyVerified=await get(altered.join('.'))
      assert.deepEqual(independentlyVerified.entries,(await get(pageKeys[2])).entries)
      assert.deepEqual(await get(independentlyVerified.newer),{status:'unavailable',entries:[]})
    }
  }
  const end=await store.readNatural({ownerId,worldId})
  assert.equal(end.fileSha256,head.fileSha256)
  t.diagnostic(JSON.stringify({world:worldId,head:head.fileSha256,pages:pageKeys.length,cursors:ids,transitionRequestsPerPage:readCounts,pageMs}))
})
