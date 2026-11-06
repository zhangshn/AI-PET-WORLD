import assert from 'node:assert/strict'
import {bound,digest,featureSha,idOf,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {BASELINE_IDENTITY} from './natural-world-baseline-proof.mjs'
import {buildEvolutionDiagnosticFeatures} from './natural-world-evolution-input.mjs'
import {readPowerDailySource} from './natural-world-temporal-data.mjs'

export const ROLLING_BASE='.runtime/ai-painter/controller-repair-reviews/world-server-rolling-schedule-190-20261103'
const firstRun='.runtime/ai-painter/world-first-weather-runtime/v3'
const historicalContract={path:'data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json',
  sha256:'e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a'}
const maintenanceContract={path:'data/ai-painter/system-governance/mvp-natural-world-weather-maintenance-v1.json',
  sha256:'5feeefb800c43c31bb0be42f7c4556db3247c62d3e646d1132f40abf42aaff0f'}
const firstRelease={path:'data/ai-painter/capability-releases/sakaerat-weather-153-runtime-v3/release.json',
  sha256:'39ff6c92cb5a9b3110365377dc35b6d324723ceead1ec525fa89804ff00d2aa6'}
const DAY=86400000
const fromRef=r=>({path:r.id,sha256:r.sha256})
const iso=s=>new Date(s).toISOString()
function asPeriod(start,end){
  const a=iso(start),b=iso(end)
  assert.equal(Date.parse(b)-Date.parse(a),DAY,'weather period must span one day')
  return {logicalStartUtc:a,logicalEndUtc:b,durationSeconds:86400}
}
export function rollingLocations(scope){
  if(scope==='production')return {store:'data/world-runtime',artifacts:'.runtime/ai-painter/world-rolling-weather'}
  if(scope==='qualification')return {store:ROLLING_BASE+'/qualification/store',artifacts:ROLLING_BASE+'/qualification/steps'}
  throw Error('fixed rolling weather scope required')
}
function recordRef(name,key,fileSha,suffix){
  assert(/^[a-f0-9]{64}$/.test(key)&&/^[a-f0-9]{64}$/.test(fileSha))
  return {path:name+'.evolution/'+key+'.'+fileSha+'.'+suffix+'.json',sha256:fileSha}
}
function archiveRows(seedRecord,maintenance){
  const a=JSON.parse(bound(maintenanceContract))
  const checked=JSON.parse(bound(a.validationRef))
  assert.deepEqual(maintenance.policyRef,{id:maintenanceContract.path,version:a.contractId,sha256:maintenanceContract.sha256})
  assert.equal(maintenance.evidence.validationRef.sha256,a.validationRef.sha256)
  const archive=checked.sourceRefs.archive,receipt=checked.sourceRefs.receipt
  assert.deepEqual(maintenance.externalInputRefs.map(fromRef),[archive,receipt].map(r=>({path:r.path,sha256:r.sha256})))
  const climate=readPowerDailySource(bound(archive),JSON.parse(bound(receipt)),{start:'20200101',end:'20200131',
    latitude:14.5078,longitude:101.895,returnedCoordinates:[101.895,14.508]})
  const features=buildEvolutionDiagnosticFeatures(climate)
  assert.equal(featureSha(features.values),checked.contextValueSha256)
  const weather=seedRecord.worldState.payload.environment.evolution.weather
  assert.deepEqual(weather.values,features.values.at(-1));assert.deepEqual(weather.units,features.units)
  return features.values.map((values,i)=>({values,period:asPeriod(features.periods[i].startUtc,features.periods[i].endUtc),
    provenance:i===6?{kind:'committed_archival_seed',worldId:maintenance.identity.worldId,eventSha256:maintenance.eventSha256,businessKey:maintenance.businessKey,
      reasonRefs:maintenance.reasonRefs,archive,receipt}:{kind:'archival_context',archive,receipt,contextValueSha256:checked.contextValueSha256}}))
}
function expectEventFiles(scope,tick,oldDigest,event){
  const artifacts=rollingLocations(scope).artifacts
  const dir=tick===1?firstRun:artifacts+'/step-'+tick+'-'+oldDigest
  assert.equal(event.evidence.inputRef.id,dir+'/input.json')
  assert.equal(event.historyInputRef.id,event.evidence.inputRef.id)
  assert.equal(event.evidence.outputRef.id,dir+'/output.json')
  if(tick===1){
    assert.deepEqual(fromRef(event.evidence.capabilityRef),firstRelease);bound(firstRelease)
  }else{
    // An unreleased local qualification can only consume its own clone's subsequent weather events.
    assert.equal(scope,'qualification','production rolling successor release unavailable')
    assert.equal(event.evidence.capabilityRef.id,ROLLING_BASE+'/qualification-budget.json')
    bound(fromRef(event.evidence.capabilityRef))
  }
}

export async function readWorldRollingWeatherInput(scope='production'){
  const {store:root}=rollingLocations(scope),budget=JSON.parse(bound(historicalContract))
  const id=BASELINE_IDENTITY
  assert.deepEqual(id,budget.identity)
  const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(root))
  const q={ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId}
  const head=await store.readNatural(q);assert.equal(head.status,'found','current rolling weather world not verified')
  assert.deepEqual(idOf(head.record),id);assert(Number.isSafeInteger(head.record.tick)&&head.record.tick>=1)
  const name=root+'/'+id.ownerId+'/'+id.worldId+'.json',rows=[],headEv=head.record.worldState.payload.environment.evolution
  let current=head.record,currentSha=head.fileSha256
  while(rows.length<7){
    const tick=current.tick,weather=current.worldState.payload.environment.evolution,commit=weather.commit
    assert.deepEqual(idOf(current),id);assert.deepEqual([current.stateVersion,current.eventCursor],[tick+1,tick+1])
    const saved=await store.readNaturalTransition({identity:id,businessKey:commit.businessKey})
    assert.equal(saved.status,'found','rolling weather receipt unavailable')
    const {receipt,event}=saved
    assert.deepEqual(event.identity,id);assert.equal(receipt.fileSha256,currentSha);assert.equal(receipt.eventSha256,commit.eventSha256)
    assert.equal(event.eventSha256,commit.historyHead.eventSha256);assert.equal(receipt.eventCursor,tick+1)
    assert.equal(event.domainAfterSha256,api.transaction.computeWorldEvolutionDomainSha(current))
    if(tick===0){
      assert.equal(event.eventKind,'maintenance');assert.equal(event.previousEventSha256,null)
      rows.unshift(...archiveRows(current,event).slice(-(7-rows.length)))
      break
    }
    assert.equal(event.eventKind,'evolution');assert.deepEqual([event.fromTick,event.toTick,event.cursor],[tick-1,tick,tick+1])
    const prev=recordRef(name,commit.businessKey,event.before.expectedFileSha256,'before')
    // readNaturalTransition has verified the before-image and signed content digests through the Store journal.
    const old=JSON.parse(bound(prev))
    assert.deepEqual(idOf(old),id);assert.equal(old.tick,tick-1)
    assert.equal(old.worldState.payload.environment.evolution.commit.eventSha256,event.previousEventSha256)
    assert.equal(event.before.recordContentSha256,old.recordContentSha256)
    expectEventFiles(scope,tick,prev.sha256,event)
    const inputFile=fromRef(event.evidence.inputRef),outputFile=fromRef(event.evidence.outputRef)
    const raw=bound(inputFile),modelInput=JSON.parse(raw),output=JSON.parse(bound(outputFile))
    assert.deepEqual(modelInput.identity,id);assert.equal(modelInput.before.fileSha256,prev.sha256)
    assert.equal(output.inputSha256,sha(raw));assert.equal(output.checkpointSha256,budget.checkpoint.sha256)
    assert.equal(modelInput.modelSha256,budget.checkpoint.sha256);assert.equal(event.evidence.modelRef.sha256,budget.checkpoint.sha256)
    assert.equal(output.modelForwards,1);assert.equal(output.trainingUpdates,0)
    assert.deepEqual(output.values,weather.weather.values)
    assert.equal(event.historyInputRef.sha256,inputFile.sha256);assert(event.reasonRefs.includes(outputFile.sha256))
    const period=asPeriod(event.interval.logicalStartUtc,event.interval.logicalEndUtc)
    assert.equal(period.logicalEndUtc,iso(weather.logicalEndUtc))
    assert.deepEqual(asPeriod(weather.weather.period.logicalStartUtc,weather.weather.period.logicalEndUtc),period)
    assert.deepEqual(asPeriod(modelInput.interval.logicalStartUtc,modelInput.interval.logicalEndUtc),period)
    rows.unshift({values:output.values,period,provenance:{kind:'committed_model_weather',worldId:id.worldId,tick,
      businessKey:commit.businessKey,eventSha256:event.eventSha256,previousEventSha256:event.previousEventSha256,fileSha256:currentSha,
      input:inputFile,output:outputFile,model:fromRef(event.evidence.modelRef),capability:fromRef(event.evidence.capabilityRef),reasonRefs:event.reasonRefs}})
    current=old;currentSha=prev.sha256
  }
  assert.equal(rows.length,7)
  for(let i=0;i<rows.length;i++){
    assert(rows[i].values.length===4&&rows[i].values.every(Number.isFinite))
    if(i)assert.equal(rows[i-1].period.logicalEndUtc,rows[i].period.logicalStartUtc)
  }
  const end=iso(headEv.logicalEndUtc);assert.equal(rows.at(-1).period.logicalEndUtc,end)
  const history=rows.map(r=>r.values)
  return {schemaVersion:'sakaerat-rolling-weather-model-input-v1',scope,identity:id,before:{tick:head.record.tick,stateVersion:head.record.stateVersion,
    eventCursor:head.record.eventCursor,fileSha256:head.fileSha256,recordContentSha256:head.record.recordContentSha256,
    worldFactsPayloadSha256:head.record.worldFactsPayloadSha256,statePayloadSha256:head.record.statePayloadSha256},
    interval:asPeriod(end,Date.parse(end)+DAY),fieldOrder:headEv.weather.fieldOrder,units:headEv.weather.units,history,historyValueSha256:featureSha(history),
    rows,head:{businessKey:headEv.commit.businessKey,eventSha256:headEv.commit.eventSha256},modelSha256:budget.checkpoint.sha256,
    randomBeforeSha256:digest(head.record.randomState)}
}
