import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {record} from './helpers/world-evolution-transaction-worker.mjs'
import {BASE,ROOT,exercise,cloneRecord,candidate,idOf,unchangedDomain,digest,write,binding,privateRun,independentReadback} from '../../.runtime/ai-painter/controller-repair-reviews/world-environment-initialization-163-20261030/integration/bridge.mjs'
const token=()=>randomUUID().replaceAll('-',''),run=()=>BASE+'/integration/test-'+token()
function fixture(){
 const original=record();delete original.worldState.payload.environment.evolution
 const fieldOrder=['PRECTOTCORR','RH2M','T2M','WS2M'],units=['mm/day','%','C','m/s'],values=[0,56.36,25.13,1.47],period={logicalStartUtc:'2020-01-07T00:00:00.000Z',logicalEndUtc:'2020-01-08T00:00:00.000Z',durationSeconds:86400},weather={fieldOrder,units,values,period,origin:'simulated_archival_seed'}
 const prepared={externalInputRefs:[{id:'synthetic-archive',version:'fixture-v1',sha256:digest('synthetic-archive')}],fieldOrder,units,values,period,logicalEndUtc:period.logicalEndUtc,sourceIdentity:idOf(original),targetModelRef:{id:'synthetic-not-production-model',version:'fixture-v1',sha256:'a'.repeat(64)},environmentEvolution:{logicalEndUtc:period.logicalEndUtc,weather,initialization:{kind:'simulated_archival_seed',contextContentSha256:digest('synthetic-context'),worldLivedEvents:0,productionAdmitted:false}}}
 return {original,prepared,preparation:{fixtureOnly:true,notProductionEvidence:true,prepared}}
}
test('original Store private maintenance persists0/1/1, unchanged facts/RNG/climate, replay and distinct process readback',async()=>{
 const f=fixture(),result=await exercise({run:run(),...f,bindings:[]}),{store,input,before,runtime:r}=result
 assert.equal(result.result.maintenanceEventCount,1);assert.equal(result.result.evolutionEventCount,0);assert.equal(result.result.readback.tick,0);assert.equal(result.result.readback.stateVersion,1);assert.equal(result.result.readback.eventCursor,1);assert.notEqual(result.result.readback.pid,process.pid)
 assert(Object.keys(idOf(f.original)).every(k=>input.record[k]!==f.original[k]&&input.record[k].startsWith('initialization163-')))
 assert.deepEqual(input.event.externalInputRefs,f.prepared.externalInputRefs);assert.equal(input.event.interval.logicalStartUtc,input.event.interval.logicalEndUtc);assert.equal(input.event.interval.durationSeconds,0);assert.equal(input.event.eventKind,'maintenance');assert.equal(input.event.evidence.maintenanceContext.targetModelRef.id,'synthetic-not-production-model')
 assert.deepEqual(unchangedDomain(input.record),unchangedDomain(before.record));assert.deepEqual(unchangedDomain(input.record),unchangedDomain(f.original));assert.equal(input.record.worldState.payload.environment.evolution.weather.origin,'simulated_archival_seed');assert.equal(result.result.productionReady,false)
 const physical=path.join(privateRun(result.result.run),'store',input.record.ownerId,input.record.worldId+'.json'),bytes=fs.readFileSync(physical)
 const changed=structuredClone(input);changed.record.worldState.payload.environment.evolution.weather.values[0]=1;changed.event.changes[0].newValue=1;delete changed.event.eventSha256;changed.event.domainAfterSha256=r.transaction.computeWorldEvolutionDomainSha(changed.record);changed.event=r.transaction.sealWorldEvolutionEvent(changed.event);changed.record.worldState.payload.environment.evolution.commit.eventSha256=changed.event.eventSha256;changed.record.worldState.payload.environment.evolution.commit.historyHead.eventSha256=changed.event.eventSha256
 assert.equal(changed.event.businessKey,input.event.businessKey);const conflict=await store.writeNaturalTransition(changed);assert.equal(conflict.ok,false);assert.deepEqual(fs.readFileSync(physical),bytes)
 const foreign=structuredClone(input);foreign.event.identity.worldId+='-foreign';assert.equal((await store.writeNaturalTransition(foreign)).ok,false);assert.deepEqual(fs.readFileSync(physical),bytes)
 const restored=await store.readNatural({ownerId:input.record.ownerId,worldId:input.record.worldId});assert.throws(()=>candidate(restored,f.prepared,binding(result.result.run+'/preparation.json'),r.transaction),/already_initialized/)
 await assert.rejects(independentReadback(result.result.run,'0'.repeat(64)),/manifest/)
 write(result.result.run,'negative-assertions.json',{syntheticFixtureOnly:true,changedPayloadRejected:true,foreignWorldRejected:true,alreadyInitializedRejected:true,storeBytesUnchanged:true,modelForwards:0})
})
test('preexisting environment or counters never become a new clone',()=>{for(const mutate of [r=>r.worldState.payload.environment.evolution={},r=>r.stateVersion=1,r=>r.eventCursor=1,r=>r.tick=1]){const f=fixture();mutate(f.original);assert.throws(()=>cloneRecord(f.original,token()),/already_initialized/)}})
test('source mutation or preparation world mismatch fails before private Store creation',async()=>{
 const f=fixture(),source=write(BASE+'/integration','synthetic-source-'+token()+'.json',{test:true}),changed={...source,sha256:'0'.repeat(64)},first=run()
 await assert.rejects(exercise({run:first,...f,bindings:[changed]}),/source_binding/);assert.equal(fs.existsSync(path.join(ROOT,first,'store')),false)
 const foreign=fixture();foreign.prepared.sourceIdentity.worldId='another-world';const second=run();await assert.rejects(exercise({run:second,...foreign,bindings:[]}),/source_world_identity/);assert.equal(fs.existsSync(path.join(ROOT,second,'store')),false)
})
test('private acceptance roots reject traversal, formal store and historical runs',()=>{for(const p of ['data/world-runtime',BASE+'/integration/actual-run/../escape',BASE+'/integration/test-abc','.runtime/ai-painter/controller-repair-reviews/world-evolution-loop-158-20261030/run-'+'a'.repeat(32)])assert.throws(()=>privateRun(p),/private_run/)})
