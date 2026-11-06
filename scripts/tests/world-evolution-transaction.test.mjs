// Original Store transport tests. Synthetic evidence is never model qualification.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {randomUUID} from 'node:crypto'
import {fixture,bootstrap,transitionInput,query,lookup,sha,json,canonical,identityOf,spawnOne,untilFiles,saveReply} from './helpers/world-evolution-transaction-worker.mjs'

const pass=r=>assert.equal(r.ok,true,JSON.stringify(r))
const rejected=r=>assert.equal(r.ok,false,JSON.stringify(r))
function sidecars(f){return fs.readdirSync(f.recordPath+'.evolution').map(n=>path.join(f.recordPath+'.evolution',n))}
function snapshot(f){return new Map([f.recordPath,...sidecars(f)].map(p=>[p,sha(fs.readFileSync(p))]))}
function unchanged(s){for(const [p,h]of s)assert.equal(sha(fs.readFileSync(p)),h,'modified '+p)}
function reseal(f,input){
 input.event.domainAfterSha256=f.transaction.computeWorldEvolutionDomainSha(input.record)
 input.event.businessKey=f.transaction.computeWorldEvolutionBusinessKey(input.event)
 delete input.event.eventSha256;input.event.eventSha256=sha(canonical(input.event))
 input.record.worldState.payload.environment.evolution.commit={businessKey:input.event.businessKey,eventId:input.event.eventId,eventSha256:input.event.eventSha256,historyHead:{cursor:input.event.cursor,eventSha256:input.event.eventSha256}}
 return input
}

for(const kind of ['development','production']){
 test(kind+': original adapter and facade commit, read, replay and old-key replay after later commit',async()=>{
  const f=fixture(kind),base=await bootstrap(f),input=transitionInput(f,base)
  const first=await f.facade.writeNaturalWorldRuntimeTransition(input);pass(first);assert.equal(first.receipt.tick,1);assert.equal(first.receipt.eventCursor,1);assert.equal(first.receipt.transportOnly,true);assert.equal(first.receipt.productionReady,false)
  const state=await f.facade.readNaturalWorldRuntimeSaveRecord(lookup);assert.equal(state.status,'found');assert.equal(state.record.stateVersion,1);assert.equal(state.fileSha256,first.receipt.fileSha256)
  const read=await f.store.readNaturalTransition(query(input));assert.equal(read.status,'found');assert.deepEqual(read.receipt,first.receipt);assert.deepEqual(read.event,input.event)
  const domainState=structuredClone(state.record.worldState);delete domainState.payload.environment.evolution.commit
  const r=state.record,domain={...identityOf(r),worldFacts:r.worldFacts,worldState:domainState,ruleVersion:r.ruleVersion,randomState:r.randomState,eventCursor:r.eventCursor,tick:r.tick,stateVersion:r.stateVersion}
  assert.equal(sha(canonical(domain)),input.event.domainAfterSha256,'independent domain hash retains every field except commit')
  const snap=snapshot(f),repeat=await f.store.writeNaturalTransition(input);pass(repeat);assert.equal(repeat.replayed,true);assert.deepEqual(repeat.receipt,first.receipt);unchanged(snap)
  const otherCandidate=structuredClone(input);otherCandidate.record.worldState.payload.environment.weather.temperatureC=99;otherCandidate.event.changes[0].newValue=otherCandidate.record.worldState.payload.environment.weather
  reseal(f,otherCandidate);assert.equal(otherCandidate.event.businessKey,input.event.businessKey);rejected(await f.store.writeNaturalTransition(otherCandidate));unchanged(snap)
  const next=transitionInput(f,state),second=await f.store.writeNaturalTransition(next);pass(second);assert.equal(second.receipt.stateVersion,2)
  const currentBytes=fs.readFileSync(f.recordPath),oldReplay=await f.facade.writeNaturalWorldRuntimeTransition(input);pass(oldReplay);assert.equal(oldReplay.replayed,true);assert.deepEqual(oldReplay.receipt,first.receipt);assert(fs.readFileSync(f.recordPath).equals(currentBytes))
  assert.equal((await f.facade.readNaturalWorldRuntimeTransition(query(input))).status,'found')
  saveReply(path.join(f.privateRoot,'positive-proof.json'),{first,second,oldReplay})
 })
 test(kind+': self-consistently rehashed but illegal transitions are refused',async()=>{
  const f=fixture(kind),base=await bootstrap(f),good=transitionInput(f,base),bytes=fs.readFileSync(f.recordPath)
  const mutations=[
   i=>{i.record.tick=2;i.record.worldFacts.tick=2;i.record.worldState.tick=2;i.event.toTick=2},
   i=>{i.record.stateVersion=2;i.event.toStateVersion=2},
   i=>{i.record.eventCursor=2;i.event.cursor=2},
   i=>{i.event.before.statePayloadSha256='f'.repeat(64)},
   i=>{i.event.interval.durationSeconds=59},
   i=>{i.event.interval.logicalStartUtc='2026-10-30T00:01:00.000Z';i.event.interval.logicalEndUtc='2026-10-30T00:00:00.000Z'},
   i=>{i.event.previousEventSha256='f'.repeat(64)},
   i=>{i.event.identity.worldSeed='different-seed'},
  ]
  for(const [index,mutate]of mutations.entries()){
   const i=structuredClone(good);mutate(i)
   // Domain/key helpers may themselves reject invalid transport fields; a
   // helper rejection counts only as preflight rejection, not Store exercise.
   let prepared;try{prepared=reseal(f,i)}catch(error){assert.match(String(error),/invalid|transition|evolution|time|interval/);continue}
   const result=await f.store.writeNaturalTransition(prepared);assert.equal(result.ok,false,'rehashed mutation '+index+': '+JSON.stringify(result));assert(fs.readFileSync(f.recordPath).equals(bytes))
  }
 })
 test(kind+': maintenance preserves tick and increments exactly one version and cursor',async()=>{
  const f=fixture(kind),base=await bootstrap(f),input=transitionInput(f,base,'maintenance'),w=await f.store.writeNaturalTransition(input);pass(w)
  assert.equal(w.receipt.tick,0);assert.equal(w.receipt.stateVersion,1);assert.equal(w.receipt.eventCursor,1)
 })
 test(kind+': maintenance rejects a self-consistent tick advance and undeclared RNG replacement',async()=>{
  for(const mutation of ['tick','rng']){
   const f=fixture(kind),base=await bootstrap(f),input=transitionInput(f,base,'maintenance'),bytes=fs.readFileSync(f.recordPath)
   if(mutation==='tick'){input.record.tick++;input.record.worldFacts.tick++;input.record.worldState.tick++;input.event.toTick++}
   else input.record.randomState.state.counter=99
   let prepared;try{prepared=reseal(f,input)}catch(error){assert.match(String(error),/invalid|transition|evolution|maintenance/);continue}
   rejected(await f.store.writeNaturalTransition(prepared));assert(fs.readFileSync(f.recordPath).equals(bytes))
  }
 })
 test(kind+': triple CAS, all stable identities, hashes, counters, domain and times reject without writes',async()=>{
  const f=fixture(kind),base=await bootstrap(f),good=transitionInput(f,base),bytes=fs.readFileSync(f.recordPath)
  const mutations=[i=>i.expectedTick++,i=>i.expectedStateVersion++,i=>i.expectedFileSha256='f'.repeat(64),i=>delete i.expectedFileSha256,
   ...['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId'].map(k=>i=>i.record[k]+='-foreign'),
   i=>i.record.eventCursor++,i=>i.record.tick++,i=>i.record.stateVersion++,i=>i.record.eventCursor=Number.MAX_SAFE_INTEGER+1,
   i=>i.event.domainAfterSha256='f'.repeat(64),i=>i.event.eventSha256='f'.repeat(64),i=>i.event.businessKey='f'.repeat(64),i=>i.record.worldState.payload.environment.weather.temperatureC=42,
   i=>i.event.interval.logicalEndUtc='2026-10-30T00:00:00.000Z',i=>i.event.interval.logicalStartUtc='bad',i=>i.event.interval.durationSeconds=-1,
   i=>i.event.previousEventSha256='f'.repeat(64),i=>i.event.before.statePayloadSha256='f'.repeat(64),i=>i.event.evidence.kind='maintenance',i=>i.record.worldState.payload.environment.evolution.commit.eventSha256='f'.repeat(64)]
  for(const [index,mutate] of mutations.entries()){
   const input=structuredClone(good);mutate(input)
   let r;try{r=await f.facade.writeNaturalWorldRuntimeTransition(input)}catch(error){assert.match(String(error),/world_transition_invalid:|natural_world_invalid:/);r={ok:false,preflightError:String(error)}}
   assert.equal(r.ok,false,'mutation '+index+': '+JSON.stringify(r));assert(fs.readFileSync(f.recordPath).equals(bytes),'mutation wrote '+index)
  }
 })
 test(kind+': two independent writers contend on the original same-world lock and CAS',async()=>{
  const f=fixture(kind),base=await bootstrap(f),a=transitionInput(f,base),b=structuredClone(a)
  b.event.policyRef.id='synthetic-competing-policy';b.event.businessKey=f.transaction.computeWorldEvolutionBusinessKey(b.event);delete b.event.eventSha256;b.event=f.transaction.sealWorldEvolutionEvent(b.event)
  b.record.worldState.payload.environment.evolution.commit={businessKey:b.event.businessKey,eventId:b.event.eventId,eventSha256:b.event.eventSha256,historyHead:{cursor:b.event.cursor,eventSha256:b.event.eventSha256}}
  const barrier=path.join(f.privateRoot,'start'),one=spawnOne(f,'write',a,{barrier}),two=spawnOne(f,'write',b,{barrier})
  await untilFiles([one.ready,two.ready]);fs.writeFileSync(barrier,'go');const replies=await Promise.all([one.done,two.done]);assert.notEqual(replies[0].pid,replies[1].pid);assert.equal(replies.filter(x=>x.result.ok).length,1)
  const state=await f.store.readNatural(lookup);assert.equal(state.record.tick,1);assert.equal(state.record.eventCursor,1);saveReply(path.join(f.privateRoot,'concurrent-proof.json'),replies)
 })
 for(const cut of ['after-prepared','before-state','after-state','after-committed','receipt'])test(kind+': independent process explicit recovery after '+cut,async()=>{
  const f=fixture(kind),base=await bootstrap(f),input=transitionInput(f,base),q=query(input)
  const failed=await spawnOne(f,'write',input,{cut}).done;assert.equal(failed.faultFired,true,'cut never reached: '+JSON.stringify(failed));rejected(failed.result);assert.equal(failed.lockRemains,false,'controlled IO failure must release owned lock')
  const stateBefore=fs.readFileSync(f.recordPath),journalBefore=fs.existsSync(f.transactionPath)?fs.readFileSync(f.transactionPath):null
  const read=await spawnOne(f,'transition',q).done
  if(['after-prepared','before-state','after-state'].includes(cut)){assert.equal(read.result.status,'invalid');assert.equal(read.result.event,null)}
  assert(fs.readFileSync(f.recordPath).equals(stateBefore),'GET changed state');if(journalBefore)assert(fs.readFileSync(f.transactionPath).equals(journalBefore),'GET changed journal')
  if(cut==='after-prepared'){
   const recovered=await spawnOne(f,'recover',q).done;rejected(recovered.result);assert(fs.readFileSync(f.recordPath).equals(stateBefore));assert(fs.readFileSync(f.transactionPath).equals(journalBefore))
   rejected((await spawnOne(f,'write',input).done).result)
   saveReply(path.join(f.privateRoot,'recovery-proof.json'),{mode:'injected_io_failure_then_normal_finally_unlock_then_fresh_process',cut,failed,read,recovered,meaning:'missing required sidecars safely blocks; no fabricated recovery'})
   return
  }
  const recovered=await spawnOne(f,'recover',q).done;assert.notEqual(recovered.pid,failed.pid);pass(recovered.result)
  const final=await spawnOne(f,'read',lookup).done;assert.equal(final.result.status,'found');assert.equal(final.result.record.tick,1);assert.equal(final.result.record.stateVersion,1);assert.equal(final.result.record.eventCursor,1)
  const proof=await spawnOne(f,'transition',q).done;assert.equal(proof.result.status,'found');assert.deepEqual(proof.result.event,input.event)
  const snap=snapshot(f),replay=await spawnOne(f,'write',input).done;pass(replay.result);assert.equal(replay.result.replayed,true);unchanged(snap)
  saveReply(path.join(f.privateRoot,'recovery-proof.json'),{mode:'injected_io_failure_then_normal_finally_unlock_then_fresh_process',cut,failed,read,recovered,final,proof,replay})
 })
 test(kind+': actually terminated writer retains lock; explicit new-process recovery quarantines proven dead lock',async()=>{
  const f=fixture(kind),base=await bootstrap(f),input=transitionInput(f,base),q=query(input),writer=spawnOne(f,'write',input,{hardKillCut:'after-state'})
  await untilFiles([writer.checkpoint]);const abandonedBytes=fs.readFileSync(f.recordPath+'.lock');assert.equal(JSON.parse(abandonedBytes).pid,writer.pid)
  assert.equal(writer.terminate(),true);const terminated=await writer.done;assert.equal(terminated.hardTerminated,true);assert.equal(terminated.lockRemains,true)
  rejected(await f.store.writeNaturalTransition(input));assert(fs.readFileSync(f.recordPath+'.lock').equals(abandonedBytes))
  const recovered=await spawnOne(f,'recover',q).done;pass(recovered.result)
  const quarantined=fs.readdirSync(path.dirname(f.recordPath)).filter(n=>n.startsWith(path.basename(f.recordPath)+'.lock.abandoned.'));assert.equal(quarantined.length,1);assert(fs.readFileSync(path.join(path.dirname(f.recordPath),quarantined[0])).equals(abandonedBytes))
  const state=await f.store.readNatural(lookup);assert.equal(state.status,'found');assert.equal(state.record.tick,1);assert.equal(state.record.eventCursor,1)
  saveReply(path.join(f.privateRoot,'actual-termination-proof.json'),{terminated,recovered,quarantined,recordFileSha256:state.fileSha256})
 })
 for(const damage of ['event-missing','event-corrupt','record-corrupt','commit-corrupt'])test(kind+': '+damage+' fails read and recovery preserving evidence',async()=>{
  const f=fixture(kind),base=await bootstrap(f),input=transitionInput(f,base);pass(await f.store.writeNaturalTransition(input))
  const suffix=damage.startsWith('event')?'.event.json':damage.startsWith('record')?'.record.json':'.commit.json',target=sidecars(f).find(p=>p.endsWith(suffix));assert(target,'sidecar not found '+suffix)
  if(damage.endsWith('missing'))fs.unlinkSync(target);else fs.writeFileSync(target,'{"synthetic-corruption":true}\n')
  const snap=snapshot(f),r=await f.store.readNaturalTransition(query(input));assert.equal(r.status,'invalid');assert.equal(r.event,null);rejected(await f.store.recoverNaturalTransition(query(input)));rejected(await f.store.writeNaturalTransition(input));unchanged(snap)
 })
 for(const lockKind of ['active-local','foreign-host','malformed'])test(kind+': '+lockKind+' lock is never reclaimed',async()=>{
  const f=fixture(kind),base=await bootstrap(f),input=transitionInput(f,base),lockPath=f.recordPath+'.lock'
  const lock=lockKind==='malformed'?'{"lockToken":"foreign"}':json({schemaVersion:'world-runtime-write-lock-v1',pid:process.pid,host:lockKind==='foreign-host'?'definitely-not-this-host':os.hostname(),ownerId:lookup.ownerId,worldId:lookup.worldId,lockToken:randomUUID(),createdAtUtc:new Date().toISOString()})
  fs.writeFileSync(lockPath,lock);const bytes=fs.readFileSync(f.recordPath);rejected(await f.store.writeNaturalTransition(input));const recovered=await f.store.recoverNaturalTransition(query(input));rejected(recovered)
  if(lockKind==='active-local')assert.match(recovered.message,/lock_process_active_or_unknown/)
  if(lockKind==='foreign-host')assert.match(recovered.message,/lock_not_owned_host_world/)
  assert.equal(fs.readFileSync(lockPath,'utf8'),lock);assert(fs.readFileSync(f.recordPath).equals(bytes))
 })
}
