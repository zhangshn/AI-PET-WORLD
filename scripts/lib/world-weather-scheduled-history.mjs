import assert from 'node:assert/strict'
import {loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH} from './ai-painter-autonomous-package-decision-core-v3.mjs'
import {BASELINE_IDENTITY} from './natural-world-baseline-proof.mjs'
import {buildEvolutionDiagnosticFeatures} from './natural-world-evolution-input.mjs'
import {readPowerDailySource} from './natural-world-temporal-data.mjs'
import {ROOT,bind as jsonBinding,bound,digest,featureSha,idOf,runtime,safe,sha} from './world-initialized-evolution.mjs'

export const WEATHER_EPOCH='2020-01-08T00:00:00.000Z'
export const WEATHER_FORECAST_DAYS=30
export const WEATHER_STEP_SECONDS=86400
export const WEATHER_CHECKPOINT='36a5e5973228295f38392b50680868331caab7b1588e3fc10f54d2f084ce05c8'
export const WEATHER_NEXT_VERSION='sakaerat-weather-153-scheduled-v5'
const duration=WEATHER_STEP_SECONDS*1000
const root='data/world-runtime'
const genesis='93a6202c69b470ac79094ed1686889e7a85605a3554f5728be8df414ca569868'
const maintenance={path:'data/ai-painter/system-governance/mvp-natural-world-weather-maintenance-v1.json',sha256:'5feeefb800c43c31bb0be42f7c4556db3247c62d3e646d1132f40abf42aaff0f'}
const day1={version:'sakaerat-weather-153-runtime-v3',storage:'.runtime/ai-painter/world-first-weather-runtime/v3'}
const twoDay={version:'sakaerat-weather-153-rolling-v4',storage:'.runtime/ai-painter/world-rolling-weather-runtime/v4/steps'}
const next={version:WEATHER_NEXT_VERSION,storage:'.runtime/ai-painter/world-weather-service/'+BASELINE_IDENTITY.worldId+'/steps'}
const qual210='.runtime/ai-painter/controller-repair-reviews/world-service-scheduled-runtime-210-20261103/qualification'
const modelEpochMs=Date.parse(WEATHER_EPOCH)
const iso=s=>new Date(s).toISOString()
const checkUtc=(actual,expected)=>assert.equal(iso(actual),expected)
const hashPattern=/^[a-f0-9]{64}$/
const releasePath=v=>'data/ai-painter/capability-releases/'+v+'/release.json'
function target(tick,scope='production'){
  const v=tick===1?day1:tick<=3?twoDay:next
  return {version:v.version,dir:tick===1?v.storage:tick>3&&scope==='qualification'?qual210+'/steps/'+tick:v.storage+'/'+tick}
}
function original(file){return JSON.parse(bound(file))}
function before(record,fileSha256){
  return {tick:record.tick,stateVersion:record.stateVersion,eventCursor:record.eventCursor,fileSha256,
    worldFactsPayloadSha256:record.worldFactsPayloadSha256,statePayloadSha256:record.statePayloadSha256,recordContentSha256:record.recordContentSha256}
}
export function scheduledWeatherInterval(tick){
  assert(Number.isSafeInteger(tick)&&tick>=0&&tick<=WEATHER_FORECAST_DAYS,'outside original 30-day forecast horizon')
  if(tick===WEATHER_FORECAST_DAYS)return null
  return {logicalStartUtc:iso(modelEpochMs+tick*duration),logicalEndUtc:iso(modelEpochMs+(tick+1)*duration),durationSeconds:WEATHER_STEP_SECONDS}
}
function rowsFromArchive(record,event){
  const a=original(maintenance),validated=original(a.validationRef)
  assert.equal(a.before.fileSha256,genesis)
  assert.deepEqual(event.identity,a.identity)
  assert.equal(event.eventKind,'maintenance');assert.equal(event.before.expectedFileSha256,genesis);assert.equal(event.previousEventSha256,null)
  assert.equal(event.policyRef.id,maintenance.path);assert.equal(event.policyRef.sha256,maintenance.sha256)
  assert.equal(event.evidence.validationRef.sha256,a.validationRef.sha256)
  const {archive,receipt}=validated.sourceRefs
  assert.deepEqual(event.externalInputRefs.map(r=>[r.id,r.sha256]),[archive,receipt].map(r=>[r.path,r.sha256]))
  const data=readPowerDailySource(bound(archive),original(receipt),{start:'20200101',end:'20200131',latitude:14.5078,longitude:101.895,returnedCoordinates:[101.895,14.508]})
  const features=buildEvolutionDiagnosticFeatures(data)
  assert.equal(featureSha(features.values),validated.contextValueSha256)
  const env=record.worldState.payload.environment.evolution
  assert.deepEqual(env.weather.values,features.values.at(-1));assert.deepEqual(env.weather.units,features.units);assert.deepEqual(env.weather.fieldOrder,features.fieldOrder)
  checkUtc(env.logicalEndUtc,WEATHER_EPOCH)
  return features.values.map((values,i)=>({values,period:{logicalStartUtc:iso(features.periods[i].startUtc),logicalEndUtc:iso(features.periods[i].endUtc),durationSeconds:WEATHER_STEP_SECONDS},
    provenance:i===6?{kind:'committed_archival_seed',worldId:a.identity.worldId,businessKey:event.businessKey,eventSha256:event.eventSha256,archive,receipt}:
      {kind:'archival_context',archive,receipt}}))
}

export function checkScheduledHistoryLink(previous,nextEvent,expectedIdentity){
  assert.deepEqual(nextEvent.identity,expectedIdentity,'weather chain foreign identity')
  assert.deepEqual([nextEvent.fromTick,nextEvent.fromStateVersion,nextEvent.toTick,nextEvent.toStateVersion,nextEvent.cursor],
    [previous.tick,previous.stateVersion,previous.tick+1,previous.stateVersion+1,previous.eventCursor+1],'weather gap')
  assert.equal(nextEvent.previousEventSha256,previous.eventSha256,'weather chain fork')
  assert.equal(nextEvent.before.expectedFileSha256,previous.fileSha256,'weather stale before')
  assert.equal(nextEvent.before.recordContentSha256,previous.recordContentSha256)
  assert.equal(nextEvent.before.worldFactsPayloadSha256,previous.worldFactsPayloadSha256)
  assert.equal(nextEvent.before.statePayloadSha256,previous.statePayloadSha256)
  const interval=scheduledWeatherInterval(previous.tick);assert(interval,'weather horizon exhausted')
  checkUtc(nextEvent.interval.logicalStartUtc,interval.logicalStartUtc);checkUtc(nextEvent.interval.logicalEndUtc,interval.logicalEndUtc)
  assert.equal(nextEvent.interval.durationSeconds,interval.durationSeconds)
  assert.equal(nextEvent.evidence.capabilityRef.version,target(nextEvent.toTick).version,'unknown or misplaced weather capability version')
}

function historicalAuthority(version,cache,scope){
  if(cache.has(version))return cache.get(version)
  if(version===WEATHER_NEXT_VERSION&&scope==='qualification'){
    const p=qual210+'/policy.json',b=qual210+'/budget.json',cfgRef=jsonBinding(b),domainRef=jsonBinding(p)
    const cfg=original(cfgRef),rules=original(domainRef)
    assert.equal(cfg.version,version);assert.equal(cfg.formalWritesMaximum,0);assert.equal(cfg.maximumNewSteps,3)
    assert.equal(cfg.policyPath,p);assert.deepEqual(cfg.identity,BASELINE_IDENTITY);assert.equal(rules.modelRef.sha256,WEATHER_CHECKPOINT)
    const authority={release:{id:b,version,sha256:cfgRef.sha256},policy:rules,policyRef:{id:p,version,sha256:domainRef.sha256}}
    cache.set(version,authority);return authority
  }
  const verified=loadAndValidateReleasedCapabilityBinding({projectRoot:ROOT,capabilityReleasePath:releasePath(version),trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH,
    requiredCapabilityScope:'world_evolution'})
  assert.equal(verified.verificationStatus,'verified_from_machine_adjudication_and_trusted_registry')
  assert.equal(verified.release.capabilityReleaseIdentity,version);assert.equal(verified.release.modelCapabilityVersion,version)
  assert.equal(verified.release.capabilityScope,'world_evolution')
  assert.equal(verified.verifiedBindings.modelArtifact.sha256,WEATHER_CHECKPOINT)
  const policy=original(verified.verifiedBindings.reviewContract)
  const out={release:{id:releasePath(version),version,sha256:verified.capabilityReleaseSha256},policy,
    policyRef:{id:verified.verifiedBindings.reviewContract.path,version,sha256:verified.verifiedBindings.reviewContract.sha256}}
  cache.set(version,out);return out
}

// Read-only history provenance. A valid old transaction never grants a new execution slot.
async function verifiedHistory(enrollmentOnly,scope='production'){
  const api=await runtime(),id=BASELINE_IDENTITY
  assert(scope==='production'||scope==='qualification')
  const storeRoot=scope==='production'?root:qual210+'/store'
  const adapter=api.store.createProductionWorldRuntimeStore(safe(storeRoot)),name=storeRoot+'/'+id.ownerId+'/'+id.worldId+'.json'
  let newest=await adapter.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
  assert.equal(newest.status,'found','weather store head not verified');assert.deepEqual(idOf(newest.record),id)
  if(enrollmentOnly){
    const firstThree=await adapter.readNaturalTransition({identity:id,businessKey:'c89b02e1b1391ed698007aa5bdc714621659bd40b0a8d53f2964c4b61735bee8'})
    assert.equal(firstThree.status,'found','original three-day enrollment checkpoint missing')
    const receipt=firstThree.receipt
    assert.equal(receipt.fileSha256,'812125a94cf1a1704d4dfff46b2ac218bb31a9ac4a7bc277144331610e827898')
    newest={record:original({path:name+'.evolution/'+receipt.businessKey+'.'+receipt.fileSha256+'.record.json',sha256:receipt.fileSha256}),fileSha256:receipt.fileSha256}
  }
  const horizon=scheduledWeatherInterval(newest.record.tick)
  assert(newest.record.tick>=3,'ongoing service requires the committed first three days')
  let cursor=newest.record,cursorSha=newest.fileSha256
  const chain=[],auth=new Map()
  while(true){
    const tick=cursor.tick;scheduledWeatherInterval(tick)
    assert.deepEqual([cursor.stateVersion,cursor.eventCursor],[tick+1,tick+1])
    const ec=cursor.worldState.payload.environment.evolution.commit
    assert(hashPattern.test(ec.businessKey)&&hashPattern.test(ec.eventSha256))
    const tr=await adapter.readNaturalTransition({identity:id,businessKey:ec.businessKey})
    assert.equal(tr.status,'found','weather receipt missing');assert.equal(tr.receipt.fileSha256,cursorSha)
    assert.equal(ec.eventSha256,tr.event.eventSha256);assert.equal(tr.event.domainAfterSha256,api.transaction.computeWorldEvolutionDomainSha(cursor))
    const environment=cursor.worldState.payload.environment.evolution
    const item={before:before(cursor,cursorSha),event:tr.event,receipt:tr.receipt,weather:environment.weather}
    if(tick===0){
      item.rows=rowsFromArchive(cursor,tr.event);chain.unshift(item);break
    }
    assert.equal(tr.event.eventKind,'evolution')
    checkUtc(environment.logicalEndUtc,iso(tr.event.interval.logicalEndUtc))
    checkUtc(environment.weather.period.logicalStartUtc,iso(tr.event.interval.logicalStartUtc))
    checkUtc(environment.weather.period.logicalEndUtc,iso(tr.event.interval.logicalEndUtc))
    assert.equal(environment.weather.period.durationSeconds,WEATHER_STEP_SECONDS)
    const ref=tr.event.before.expectedFileSha256;assert(hashPattern.test(ref))
    const previous=original({path:name+'.evolution/'+ec.businessKey+'.'+ref+'.before.json',sha256:ref})
    assert.deepEqual(idOf(previous),id);assert.equal(previous.tick,tick-1)
    checkScheduledHistoryLink({...before(previous,ref),eventSha256:previous.worldState.payload.environment.evolution.commit.eventSha256},tr.event,id)
    chain.unshift(item);cursor=previous;cursorSha=ref
  }
  assert.equal(chain.length,newest.record.tick+1)
  let rows=chain[0].rows
  const trace=[]
  for(let i=1;i<chain.length;i++){
    const v=chain[i],previous=chain[i-1],event=v.event,{version,dir}=target(i,scope),a=historicalAuthority(version,auth,scope)
    if(i===3)assert.equal(v.before.fileSha256,'812125a94cf1a1704d4dfff46b2ac218bb31a9ac4a7bc277144331610e827898','foreign enrollment checkpoint')
    const e=event.evidence
    assert.deepEqual(e.capabilityRef,a.release);assert.deepEqual(event.policyRef,a.policyRef);assert.deepEqual(e.modelRef,a.policy.modelRef)
    assert.deepEqual(e.validatorRef,a.policy.validatorRef);assert.deepEqual(event.historyInputRef,e.inputRef)
    assert.equal(e.inputRef.id,dir+'/input.json');assert.equal(e.outputRef.id,dir+'/output.json')
    const inputRef={path:e.inputRef.id,sha256:e.inputRef.sha256},outputRef={path:e.outputRef.id,sha256:e.outputRef.sha256}
    const inputBytes=bound(inputRef),input=JSON.parse(inputBytes),out=original(outputRef)
    assert.equal(input.scope,i<=3?'production':scope);assert.deepEqual(input.identity,id);assert.deepEqual(input.before,previous.before)
    assert.deepEqual(input.history,rows.map(row=>row.values),'weather model window does not descend from actual committed history')
    assert.equal(input.historyValueSha256,featureSha(input.history));assert.equal(sha(inputBytes),out.inputSha256);assert.equal(input.modelSha256,WEATHER_CHECKPOINT)
    assert.equal(out.checkpointSha256,WEATHER_CHECKPOINT);assert.equal(out.modelForwards,1);assert.equal(out.trainingUpdates,0)
    if(i>1)assert.equal(out.historyValueSha256,input.historyValueSha256)
    checkUtc(input.interval.logicalStartUtc,iso(event.interval.logicalStartUtc));checkUtc(input.interval.logicalEndUtc,iso(event.interval.logicalEndUtc))
    assert.equal(input.interval.durationSeconds,event.interval.durationSeconds)
    assert.deepEqual(v.weather.values,out.values)
    const fieldOrder=v.weather.fieldOrder,units=v.weather.units
    assert.deepEqual(fieldOrder,input.fieldOrder);assert.deepEqual(units,input.units)
    const values=Object.fromEntries(a.policy.domainFields.map((f,n)=>[f.fieldId,input.history.at(-1)[n]]))
    const verdict=api.domain.validateWorldEnvironmentDelta({policy:a.policy,identity:id,interval:event.interval,beforeValues:values,
      changes:event.changes,result:event.changes.length?'changes':'no_change'})
    assert(verdict.domainValid);assert.deepEqual(a.policy.domainFields.map(f=>verdict.nextValues[f.fieldId]),out.values)
    assert(event.reasonRefs.includes(outputRef.sha256));assert.equal(event.previousEventSha256,previous.event.eventSha256)
    const canonical=scheduledWeatherInterval(i-1)
    const row={period:canonical,values:out.values,provenance:{kind:'committed_model_weather',worldId:id.worldId,tick:i,businessKey:event.businessKey,
      eventSha256:event.eventSha256,previousEventSha256:event.previousEventSha256,fileSha256:v.before.fileSha256,input:inputRef,output:outputRef,
      model:{path:e.modelRef.id,sha256:e.modelRef.sha256},capability:{path:e.capabilityRef.id,sha256:e.capabilityRef.sha256},reasonRefs:event.reasonRefs}}
    rows=[...rows.slice(1),row];trace.push({tick:i,businessKey:event.businessKey,eventSha256:event.eventSha256,inputSha256:inputRef.sha256,
      outputSha256:outputRef.sha256,modelVersion:version,fileSha256:v.before.fileSha256})
  }
  if(!enrollmentOnly){
    const next=await adapter.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
    assert.equal(next.status,'found');assert.equal(next.fileSha256,newest.fileSha256,'weather head changed during bounded historical read')
  }
  const last=chain.at(-1),history=rows.map(r=>r.values)
  return {schemaVersion:'sakaerat-scheduled-weather-history-v1',scope,identity:id,modelSha256:WEATHER_CHECKPOINT,originalCutoffUtc:WEATHER_EPOCH,
    maximumValidatedForecastDays:WEATHER_FORECAST_DAYS,before:last.before,head:{businessKey:last.event.businessKey,eventSha256:last.event.eventSha256},
    history,rows,historyValueSha256:featureSha(history),fieldOrder:last.weather.fieldOrder,units:last.weather.units,randomBeforeSha256:digest(newest.record.randomState),
    interval:horizon,remainingValidatedDays:WEATHER_FORECAST_DAYS-last.before.tick,verifiedTrace:trace}
}

export function readScheduledWeatherHistory(...args){
  assert.equal(args.length,0,'fixed world history: no root, event or release override')
  return verifiedHistory(false)
}

export function readScheduledWeatherEnrollmentAnchor(...args){
  assert.equal(args.length,0,'fixed historical weather enrollment only')
  return verifiedHistory(true)
}

export function readScheduledWeatherQualificationHistory(...args){
  assert.equal(args.length,0,'fixed 210 qualification only');return verifiedHistory(false,'qualification')
}
export function readScheduledWeatherQualificationEnrollmentAnchor(...args){
  assert.equal(args.length,0,'fixed 210 qualification only');return verifiedHistory(true,'qualification')
}
