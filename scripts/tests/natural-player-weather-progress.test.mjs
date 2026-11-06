import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {readNaturalPlayerWeatherProgress as read} from '../../src/server/world-player-access/weather-progress.mjs'
const file='data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json'
const bytes=fs.readFileSync(file),record=JSON.parse(bytes),fileSha256=createHash('sha256').update(bytes).digest('hex')
const grant={ok:true,accountId:'component-read',permission:'world.read',ownerId:record.ownerId,worldId:record.worldId,playerId:record.playerId}
const input={record,fileSha256}
test('actual first-region Store grant and durable endpoint yield exact player-safe progress and span',async()=>{
 const x=await read(grant,input);assert.equal(x.status,'exhausted');assert.equal(x.reason,'validated_horizon_exhausted')
 assert.equal(x.day,30);assert.equal(x.validatedThroughDay,30);assert.equal(x.daysRemaining,0)
 assert.equal(x.simulationStartUtc,'2020-01-08T00:00:00.000Z');assert.equal(x.simulationEndUtc,'2020-02-07T00:00:00.000Z')
 assert(Number.isFinite(Date.parse(x.verifiedAtUtc)));assert.deepEqual(Object.keys(x).sort(),['day','daysRemaining','reason','simulationEndUtc','simulationStartUtc','status','validatedThroughDay','verifiedAtUtc'])
 const both=await Promise.all([read(grant,input),read(grant,input)]);assert.deepEqual(both[0],both[1])
 both[0].status='edited';assert.equal(both[1].status,'exhausted')
})
test('missing, wrong-world and non-read grants cannot open local evidence',async t=>{
 let opened=0;const spy=t.mock.method(fs,'lstatSync',()=>{opened++;throw Error('unauthorized opened a file')})
 for(const g of [undefined,{...grant,ok:false},{...grant,permission:'control'},{...grant,worldId:'other'},{...grant,ownerId:'other'},{...grant,playerId:'other'},{...grant,accountId:''}]){
  const state=await read(g,input);assert.equal(state.status,'unavailable');assert.equal(state.day,null);assert.equal(state.verifiedAtUtc,null)
 }
 spy.mock.restore();assert.equal(opened,0)
})
test('partial cross-version inputs remain unavailable even alongside an authorized in-flight read',async()=>{
 const modified=structuredClone(record);modified.worldState.payload.environment.evolution.weather.values[2]++
 const [valid,bad,stale]=await Promise.all([read(grant,input),read(grant,{record:modified,fileSha256}),read(grant,{record,fileSha256:'0'.repeat(64)})])
 assert.equal(valid.status,'exhausted');for(const v of [bad,stale]){assert.equal(v.status,'unavailable');assert.equal(v.simulationEndUtc,null)}
})
test('missing original service-account identity cannot be hidden by a previously valid projection; no files are modified',async t=>{
 assert.equal((await read(grant,input)).status,'exhausted')
 const prior=fs.lstatSync;let observed=0
 const spy=t.mock.method(fs,'lstatSync',function(filename,...args){
   if(String(filename).replaceAll('\\','/').endsWith('/world-weather-service/mvp-natural-world-001/accounting/identity.json')){
      observed++;throw Object.assign(Error('simulated missing source'),{code:'ENOENT'})
   }
   return prior.call(this,filename,...args)
 })
 const bad=await read(grant,input);spy.mock.restore();assert(observed>0);assert.equal(bad.status,'unavailable');assert.equal(bad.daysRemaining,null)
 assert.equal((await read(grant,input)).status,'exhausted')
})
