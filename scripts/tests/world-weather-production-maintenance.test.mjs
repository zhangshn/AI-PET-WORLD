import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {bind,bound,json,read,runtime,safe,sha} from '../lib/world-initialized-evolution.mjs'
import {applyInitialWeatherMaintenance,classifyWeatherMaintenanceState,decodeWeatherMaintenanceAuthority,
  qualifyInitialWeatherMaintenanceClone} from '../lib/world-weather-production-maintenance.mjs'

const root='.runtime/ai-painter/controller-repair-reviews/natural-world-maintenance-178-20261103'
const draft='.runtime/ai-painter/controller-repair-reviews/natural-world-maintenance-policy-179-20261103/maintenance-policy.draft.json'
const formalContract='data/ai-painter/system-governance/mvp-natural-world-weather-maintenance-v1.json'
const contract=decodeWeatherMaintenanceAuthority(read(draft))

test('the production write entry rejects absent authority and cannot redirect into a supplied root',async()=>{
  await assert.rejects(()=>applyInitialWeatherMaintenance({root:'somewhere',allow:true}),/fixed formal maintenance interface/)
  // If issued later, do not execute a write as part of a test.
  if(!fs.existsSync(safe(formalContract))){
    const before=bind(contract.worldRef.path)
    await assert.rejects(()=>applyInitialWeatherMaintenance(),{code:'ENOENT'})
    assert.deepEqual(bind(contract.worldRef.path),before)
  }
  const forged={...contract,limits:{...contract.limits,evolutionCommits:1}}
  assert.throws(()=>decodeWeatherMaintenanceAuthority(Buffer.from(JSON.stringify(forged))),/unregistered/)
})

test('foreign, stale or already-evolved records do not qualify for first maintenance',()=>{
  const current={status:'found',fileSha256:contract.worldRef.sha256,
    record:{...contract.identity,tick:0,stateVersion:0,eventCursor:0,worldState:{payload:{environment:{}}}}}
  assert.equal(classifyWeatherMaintenanceState(contract,current,'0'.repeat(64)),'initial')
  assert.throws(()=>classifyWeatherMaintenanceState(contract,{...current,fileSha256:'0'.repeat(64)},'x'),/stale pre-state/)
  for(const change of [{worldId:'foreign-world'},{eventCursor:2},{tick:1,stateVersion:2,eventCursor:2}]){
    assert.throws(()=>classifyWeatherMaintenanceState(contract,{...current,record:{...current.record,...change}},'x'))
  }
})

test('altering the observed raw climate source or the prepared weather bytes rejects before Store access',async(t)=>{
  const validation=json(contract.validationRef.path)
  for(const binding of [validation.preparationRef,validation.sourceRefs.archive]){
    const originalRead=fs.readFileSync
    let intercepted=false
    const spy=t.mock.method(fs,'readFileSync',function(...args){
      const bytes=Reflect.apply(originalRead,this,args)
      if(Buffer.isBuffer(bytes)&&bytes.length===binding.bytes&&sha(bytes)===binding.sha256){
        const altered=Buffer.from(bytes);altered[altered.length-1]^=1;intercepted=true;return altered
      }
      return bytes
    })
    try{await assert.rejects(()=>qualifyInitialWeatherMaintenanceClone(),/binding/);assert(intercepted)}
    finally{spy.mock.restore()}
  }
})

test('fixed clone commits one zero-duration maintenance; a new process recovers the same receipt',async()=>{
  const formalBefore=bind(contract.worldRef.path)
  const storePath=root+'/qualification/store',id=contract.identity,save=storePath+'/'+id.ownerId+'/'+id.worldId+'.json'
  fs.mkdirSync(path.dirname(safe(save)),{recursive:true})
  if(!fs.existsSync(safe(save)))fs.writeFileSync(safe(save),bound(contract.worldRef),{flag:'wx',flush:true})
  const fresh=bind(save).sha256===contract.worldRef.sha256
  const commit=await qualifyInitialWeatherMaintenanceClone()
  assert.equal(commit.replayed,!fresh)
  const child=spawnSync(process.execPath,['--input-type=module','-e',
    "import {qualifyInitialWeatherMaintenanceClone as check} from './scripts/lib/world-weather-production-maintenance.mjs';console.log(JSON.stringify({pid:process.pid,...await check()}))"],
    {cwd:process.cwd(),encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:65536})
  assert.equal(child.status,0,child.stderr)
  const replay=JSON.parse(child.stdout)
  assert.equal(replay.pid,child.pid);assert.notEqual(replay.pid,process.pid)
  assert(replay.replayed);assert.deepEqual(replay.receipt,commit.receipt)
  const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(storePath))
  const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
  assert.equal(current.status,'found');assert.equal(current.fileSha256,commit.receipt.fileSha256)
  assert.deepEqual([current.record.tick,current.record.stateVersion,current.record.eventCursor],[0,1,1])
  const tx=await store.readNaturalTransition({identity:id,businessKey:commit.receipt.businessKey})
  assert.equal(tx.status,'found');assert.equal(tx.event.eventKind,'maintenance')
  assert.equal(tx.event.interval.durationSeconds,0)
  const before=json(save+'.evolution/'+commit.receipt.businessKey+'.'+contract.worldRef.sha256+'.before.json')
  assert.deepEqual(before.worldFacts,current.record.worldFacts);assert.deepEqual(before.randomState,current.record.randomState)
  assert.deepEqual(formalBefore,bind(contract.worldRef.path))
  if(fresh)fs.writeFileSync(safe(root+'/clone-receipt.json'),JSON.stringify({checkedAtUtc:new Date().toISOString(),
    parentPid:process.pid,childPid:child.pid,scope:'fixed-clone',formalBefore,commit,replay,interval:tx.event.interval,
    origin:current.record.worldState.payload.environment.evolution.weather.origin,formalWrites:0,modelForwards:0},null,2)+'\n',{flag:'wx',flush:true})
})
