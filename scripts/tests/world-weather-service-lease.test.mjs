import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {after,before,test} from 'node:test'
import {digest,featureSha,safe} from '../lib/world-initialized-evolution.mjs'
import {readScheduledWeatherEnrollmentAnchor,scheduledWeatherInterval,checkScheduledHistoryLink,WEATHER_NEXT_VERSION} from '../lib/world-weather-scheduled-history.mjs'
import {weatherServiceContract,initializeIsolatedWeatherLease,openIsolatedWeatherService,resumeIsolatedWeatherService,readWeatherServiceReadiness} from '../lib/world-weather-service-lease.mjs'

let anchor
before(async()=>{anchor=await readScheduledWeatherEnrollmentAnchor()})
const folder='.runtime/ai-painter/controller-repair-reviews/world-service-lease-206-20261103/fixtures'
const wall=1800000000000
const fixturesToClean=[]
after(()=>{
  for(const name of fixturesToClean){
    const base=safe(folder),tmp=safe(folder+'/'+name)
    assert.equal(path.dirname(tmp),base);assert.equal(fs.realpathSync.native(tmp).toLowerCase(),tmp.toLowerCase())
    fs.rmSync(tmp,{recursive:true,force:true})
  }
})
function newFixture(opts){
  const name='lease-'+randomUUID().replaceAll('-',''),cfg=weatherServiceContract(anchor,opts)
  initializeIsolatedWeatherLease(name,anchor,cfg)
  fixturesToClean.push(name)
  return {name,cfg}
}
// Explicit synthetic receipt/history values only for testing the isolated ledger's atomic transitions.
// This helper neither calls a model nor creates a release or a world record.
function fixtureAfter(old,slot){
  const v=structuredClone(old),tick=old.before.tick+1
  const event=digest(['synthetic-fixture-event',tick]),biz=digest(['synthetic-fixture-biz',tick]),out=digest(['synthetic-fixture-output',tick])
  const file=digest(['synthetic-fixture-file',tick]),values=[0,60+tick,25,1]
  Object.assign(v.before,{tick,stateVersion:tick+1,eventCursor:tick+1,fileSha256:file,recordContentSha256:digest([file,'content'])})
  v.head={businessKey:biz,eventSha256:event}
  const provenance={kind:'committed_model_weather',worldId:old.identity.worldId,tick,businessKey:biz,eventSha256:event,previousEventSha256:old.head.eventSha256,
    input:{sha256:slot.inputSha256},output:{sha256:out}}
  v.rows=[...old.rows.slice(1),{period:old.interval,values,provenance}]
  v.history=v.rows.map(r=>r.values);v.historyValueSha256=featureSha(v.history);v.interval=scheduledWeatherInterval(tick)
  v.remainingValidatedDays=30-tick
  v.verifiedTrace.push({tick,businessKey:biz,eventSha256:event,inputSha256:slot.inputSha256,outputSha256:out,fileSha256:file,modelVersion:WEATHER_NEXT_VERSION})
  return v
}
test('actual original 3/4/4 provides seven verified daily rows and inherits the original day-30 ceiling',async()=>{
  assert.deepEqual([anchor.before.tick,anchor.before.stateVersion,anchor.before.eventCursor],[3,4,4])
  assert.deepEqual(anchor.verifiedTrace.map(x=>x.modelVersion),['sakaerat-weather-153-runtime-v3','sakaerat-weather-153-rolling-v4','sakaerat-weather-153-rolling-v4'])
  assert.deepEqual(anchor.historyValueSha256,'58b332b94470ba155fb3719678c78975d1c6a01d8fcf79f728c3a9d9e5c416f3')
  assert.equal(anchor.interval.logicalEndUtc,'2020-01-12T00:00:00.000Z')
  assert.equal(scheduledWeatherInterval(29).logicalEndUtc,'2020-02-07T00:00:00.000Z')
  assert.equal(scheduledWeatherInterval(30),null);assert.throws(()=>scheduledWeatherInterval(31),/horizon/)
  assert.equal(weatherServiceContract(anchor,{maxNewSteps:27,batchSize:2,maxBatchIssues:20}).lastEligibleTick,30)
  assert.throws(()=>weatherServiceContract(anchor,{maxNewSteps:28}),/horizon/)
  const readiness=await readWeatherServiceReadiness()
  assert.equal(readiness.modelCalls,0);assert.equal(readiness.remainingOriginalValidatedDays,30-readiness.before.tick)
})
test('server requests two short batches under the same durable lifetime, survives restart while days remain and stops on the original quota',async t=>{
  const {name,cfg}=newFixture()
  let db=await openIsolatedWeatherService(name,anchor,cfg)
  let h=anchor,clock=db.openOnlineSession(h,0)
  const early=clock.claimDue(h,{monotonicNowMs:14999,wallNowMs:wall});assert.equal(early.status,'not_due_online')
  const first=clock.claimDue(h,{monotonicNowMs:15000,wallNowMs:wall+1});assert(first.mayStart);assert.equal(first.targetTick,4)
  assert.equal(first.batch.seq,1);assert.equal(first.batch.last_tick,5)
  // Actual persistence: close the only local engine handle immediately after charged dispatch.
  db.close();db=await resumeIsolatedWeatherService(name);t.after(()=>db.close())
  assert.equal(db.usage().chargedModelStartSlots,1)
  clock=db.openOnlineSession(h,1000000)
  assert.equal(clock.claimDue(h,{monotonicNowMs:1000000,wallNowMs:wall+5}).mayStart,false)
  const fresh=fixtureAfter(h,first)
  const fork=structuredClone(fresh);fork.rows.at(-1).provenance.previousEventSha256='0'.repeat(64)
  assert.throws(()=>db.reconcileVerifiedFixtureHead(fork),/unbound/)
  assert.equal(db.reconcileVerifiedFixtureHead(fresh).replayed,false);assert.equal(db.reconcileVerifiedFixtureHead(fresh).replayed,true)
  h=fresh;clock=db.openOnlineSession(h,1000000)
  assert.equal(clock.claimDue(h,{monotonicNowMs:1000000,wallNowMs:wall+6}).status,'not_due_online')
  assert.equal(clock.claimDue(h,{monotonicNowMs:1014999,wallNowMs:wall+7}).status,'not_due_online')
  const second=clock.claimDue(h,{monotonicNowMs:1015000,wallNowMs:wall+8});assert.equal(second.batch.batch_id,first.batch.batch_id)
  h=fixtureAfter(h,second);db.reconcileVerifiedFixtureHead(h)
  const third=clock.claimDue(h,{monotonicNowMs:1030000,wallNowMs:wall+9});assert.equal(third.batch.seq,2);assert.equal(third.batch.first_tick,6)
  assert.equal(third.batch.last_tick,6);h=fixtureAfter(h,third);db.reconcileVerifiedFixtureHead(h)
  const stop=db.acquireBatch(h,wall+10)
  assert.equal(stop.status,'lifetime_exhausted');assert.equal(stop.usage.chargedModelStartSlots,3);assert.equal(stop.usage.cumulativeIncludingPriorDays,6)
  assert.equal(stop.usage.remainingOriginalValidatedDays,24);assert.equal(stop.usage.remainingModelStarts,0)
})
test('reentry cannot replenish a failed attempt, import a different model, reset the anchor or expand the budget',async()=>{
  const {name,cfg}=newFixture(),db=await openIsolatedWeatherService(name,anchor,cfg)
  const session=db.openOnlineSession(anchor,0),s=session.claimDue(anchor,{monotonicNowMs:15000,wallNowMs:wall})
  assert.equal(db.markFailed(s.token,'simulated worker loss').outstanding.status,'failed');db.close()
  assert.throws(()=>initializeIsolatedWeatherLease(name,anchor,cfg),/EEXIST/)
  const reset=await openIsolatedWeatherService(name,anchor,cfg)
  try{
    const f=reset.openOnlineSession(anchor,9999999).claimDue(anchor,{monotonicNowMs:10099999,wallNowMs:wall+999999})
    assert.equal(f.mayStart,false);assert.equal(f.usage.outstanding.status,'failed');assert.equal(f.usage.batchesIssued,1)
  }finally{reset.close()}
  await assert.rejects(openIsolatedWeatherService(name,anchor,{...cfg,modelSha256:'0'.repeat(64)}))
  await assert.rejects(openIsolatedWeatherService(name,anchor,weatherServiceContract(anchor,{maxNewSteps:4})),/cannot be reset/)
  const wrong=structuredClone(anchor);wrong.identity.worldId+='-other';assert.throws(()=>weatherServiceContract(wrong))
  const old=structuredClone(anchor);old.before.fileSha256='0'.repeat(64);assert.throws(()=>weatherServiceContract(old),/checkpoint/)
})
test('expired short grants are superseded only with unconsumed capacity; no infinite grant renewal from a watchdog',async t=>{
  const {name,cfg}=newFixture({maxNewSteps:2,batchSize:2,maxBatchIssues:2,batchLeaseMs:30000})
  const db=await openIsolatedWeatherService(name,anchor,cfg);t.after(()=>db.close())
  const s=db.openOnlineSession(anchor,0),first=db.acquireBatch(anchor,wall),second=db.acquireBatch(anchor,wall+30000)
  assert.equal(first.batch.seq,1);assert.equal(second.batch.seq,2);assert.equal(second.usage.chargedModelStartSlots,0)
  assert.throws(()=>s.claimDue(anchor,{monotonicNowMs:15000,wallNowMs:wall+30001,expectedBatchId:first.batch.batch_id}),/superseded/)
  assert.throws(()=>db.acquireBatch(anchor,wall+1),/regressed/)
  assert.equal(db.acquireBatch(anchor,wall+60000).status,'batch_issuance_exhausted')
})
test('two independent processes contending for the same due tick produce exactly one charged reservation',async()=>{
  const {name,cfg}=newFixture()
  fs.writeFileSync(path.join(safe(folder+'/'+name),'test-input.json'),JSON.stringify({anchor,cfg}))
  const childCode="import fs from 'node:fs';import{resumeIsolatedWeatherService}from './scripts/lib/world-weather-service-lease.mjs';"+
    "const f=process.argv[1],v=JSON.parse(fs.readFileSync('.runtime/ai-painter/controller-repair-reviews/world-service-lease-206-20261103/fixtures/'+f+'/test-input.json'));"+
    "const db=await resumeIsolatedWeatherService(f);try{const r=db.openOnlineSession(v.anchor,0).claimDue(v.anchor,{monotonicNowMs:15000,wallNowMs:1800000000000});console.log(JSON.stringify({pid:process.pid,mayStart:r.mayStart,status:r.status}))}finally{db.close()}"
  const run=()=>new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,['--input-type=module','-e',childCode,name],{windowsHide:true,stdio:['ignore','pipe','pipe']})
    let output='',err='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>err+=b)
    p.on('error',reject);p.on('close',code=>{if(code!==0)reject(Error(err));else resolve(JSON.parse(output))})
  })
  const results=await Promise.all([run(),run()])
  assert.notEqual(results[0].pid,results[1].pid);assert.equal(results.filter(r=>r.mayStart).length,1)
  assert.equal(results.filter(r=>r.status==='consumed_slot_requires_recovery').length,1)
  const db=await openIsolatedWeatherService(name,anchor,cfg);try{assert.equal(db.usage().chargedModelStartSlots,1);assert.equal(db.usage().batchesIssued,1)}finally{db.close()}
})
test('history linking checks source world, cursor, hash, previous time and known version',()=>{
  const run=JSON.parse(fs.readFileSync('.runtime/ai-painter/world-rolling-weather-runtime/v4/steps/3/request.json')).event
  const input=JSON.parse(fs.readFileSync('.runtime/ai-painter/world-rolling-weather-runtime/v4/steps/3/input.json'))
  const h={...input.before,eventSha256:input.head.eventSha256};checkScheduledHistoryLink(h,run,input.identity)
  for(const change of [v=>{v.identity.worldId+='-foreign'},v=>{v.toTick++},v=>{v.before.expectedFileSha256='0'.repeat(64)},
    v=>{v.previousEventSha256='f'.repeat(64)},v=>{v.interval.logicalStartUtc='2020-01-10T01:00:00Z'},v=>{v.evidence.capabilityRef.version='new-unverified'}]){
    const bad=structuredClone(run);change(bad);assert.throws(()=>checkScheduledHistoryLink(h,bad,input.identity))
  }
})
