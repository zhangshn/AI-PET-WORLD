import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {prepareWorldEnvironmentInitialization} from './world-environment-initialization.mjs'
import {EVOLUTION_STORE,buildEvolutionDiagnosticFeatures} from './natural-world-evolution-input.mjs'
import {readPowerDailySource} from './natural-world-temporal-data.mjs'
import {bind, bound, digest, featureSha, idOf, json, read, runtime, safe, sha} from './world-initialized-evolution.mjs'
import {FIRST_WEATHER_POLICY_PATH, FIRST_WEATHER_VERSION, inspectWeatherReleasePolicy} from './world-weather-release-policy.mjs'

const base='.runtime/ai-painter/controller-repair-reviews/natural-world-mainline-172-20261102/transaction'
// Bytes reproduced from the verified, fixed bootstrap world and source archive.
const preparationSha='325513216699c99baac2ba4bb3047b881e675aea80d6100729b3b30ba9239d30'
const hashes=['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256']
const at=()=>new Date().toISOString()
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n')

function runPath(name) {
  if(typeof name!=='string'||(name!=='qualification'&&!/^test-[a-f0-9]{32}$/.test(name)))throw Error('weather_transaction_isolation_scope')
  return base+'/'+name
}

function snapshotRef(file) {
  const actual=bind(file)
  return {id:file,version:FIRST_WEATHER_VERSION,sha256:actual.sha256}
}

function query(identity) {
  return {ownerId:identity.ownerId,worldId:identity.worldId,expectedPlayerId:identity.playerId}
}

// Existing identical bytes are a retry. An interrupted or conflicting file is retained.
function put(file,bytes) {
  try { fs.writeFileSync(safe(file),bytes,{flag:'wx',flush:true}) }
  catch(error){if(error.code!=='EEXIST')throw error;assert(read(file).equals(bytes),'weather_transaction_artifact_conflict: '+file)}
  return bind(file)
}

function beforeRef(current) {
  const r=current.record
  return {expectedTick:r.tick,expectedStateVersion:r.stateVersion,expectedFileSha256:current.fileSha256,
    worldFactsPayloadSha256:r.worldFactsPayloadSha256,statePayloadSha256:r.statePayloadSha256,recordContentSha256:r.recordContentSha256}
}

function unsealed(record) {
  const next=structuredClone(record)
  for(const field of hashes)delete next[field]
  return next
}

function inputs(seed) {
  const policy=json(FIRST_WEATHER_POLICY_PATH)
  const assessment=inspectWeatherReleasePolicy(process.cwd(),FIRST_WEATHER_VERSION)
  assert.equal(assessment.policyFileSha256,bind(FIRST_WEATHER_POLICY_PATH).sha256)
  assert.equal(assessment.productionAdmitted,false)
  assert(assessment.datasetRelease,'weather dataset missing')
  assert.deepEqual(seed.identity,policy.identity)
  assert.equal(seed.modelRef.sha256,policy.modelRef.sha256)
  assert.equal(seed.worldRef.path,EVOLUTION_STORE)
  assert.equal(sha(encode(seed)),preparationSha,'unrecognized bootstrap preparation')
  const budget=JSON.parse(bound({path:policy.resourceContractRef.id,sha256:policy.resourceContractRef.sha256}))
  assert.deepEqual(budget.identity,seed.identity)
  assert.deepEqual(budget.precondition,{tick:0,stateVersion:1,eventCursor:1,requiresCommittedInitialization:true})
  assert.equal(budget.resources.maintenanceWrites,0)
  assert.equal(policy.maintenancePolicy.mode,'migration')
  return {seed,policy,budget,assessment}
}

function makeMaintenance({seed,policy}, original, transaction, preparationRef, validationRef, savedAt) {
  assert.equal(new Date(savedAt).toISOString(),savedAt)
  assert.equal(original.fileSha256,seed.before.fileSha256)
  const old=original.record
  assert.deepEqual(idOf(old),seed.identity)
  assert.deepEqual([old.tick,old.stateVersion,old.eventCursor],[0,0,0])
  assert(!Object.hasOwn(old.worldState.payload.environment,'evolution'))
  assert(policy.maintenancePolicy.compatibleFromVersions.includes(old.ruleVersion))
  const record=unsealed(old)
  record.stateVersion=1
  record.eventCursor=1
  record.savedAt=savedAt
  record.worldState.payload.environment.evolution=structuredClone(seed.candidate.environmentEvolution)
  const actualPolicy=snapshotRef(FIRST_WEATHER_POLICY_PATH)
  const modelRef=policy.modelRef
  const validationSha=validationRef.sha256
  const changes=seed.initialWeather.fieldOrder.map((field,index)=>({
    fieldId:'environment.'+field,operation:'set',beforeValueSha256:digest({status:'unavailable',reason:'environment_evolution_not_initialized'}),
    newValue:seed.initialWeather.values[index],reasonRefs:[validationSha]}))
  changes.push({fieldId:'environment.logicalEndUtc',operation:'set',beforeValueSha256:digest({status:'unavailable',reason:'logical_anchor_not_initialized'}),
    newValue:seed.simulation.epochUtc,reasonRefs:[validationSha]})
  const event={schemaVersion:'world-evolution-event-v1',eventId:'sakaerat-first-weather-seed-v2',identity:seed.identity,
    businessKey:'0'.repeat(64),cursor:1,eventKind:'maintenance',fromTick:0,toTick:0,fromStateVersion:0,toStateVersion:1,
    before:beforeRef(original),interval:{logicalStartUtc:seed.simulation.epochUtc,logicalEndUtc:seed.simulation.epochUtc,durationSeconds:0},
    policyRef:actualPolicy,externalInputRefs:Object.values(seed.sourceRefs).map(source=>snapshotRef(source.path)),
    historyInputRef:preparationRef,evidence:{kind:'maintenance',maintenanceContext:{targetPolicyRef:actualPolicy,
      targetRuleVersion:policy.ruleVersion,targetModelRef:modelRef,migrationEvidenceRef:policy.maintenancePolicy.migrationEvidenceRef,
      executorId:'isolated-qualification-first-weather-seed'},migrationArtifactRef:preparationRef,validationRef},
    changes,reasonRefs:[validationSha],previousEventSha256:null,domainAfterSha256:transaction.computeWorldEvolutionDomainSha(record)}
  event.businessKey=transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=transaction.sealWorldEvolutionEvent(event)
  record.worldState.payload.environment.evolution.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,
    historyHead:{cursor:1,eventSha256:sealed.eventSha256}}
  return {record,event:sealed,expectedTick:0,expectedStateVersion:0,expectedFileSha256:original.fileSha256}
}

function files(run,identity) {
  const store=run+'/store'
  return {store,save:store+'/'+identity.ownerId+'/'+identity.worldId+'.json',prepared:run+'/preparation.json',
    validation:run+'/validation.json',request:run+'/maintenance-request.json',input:run+'/postcommit-input.json'}
}

function verifiedSeed({seed,policy},r) {
  r.policy.validateWorldEvolutionPolicy(policy,seed.identity)
  const w=seed.initialWeather,ctx=seed.context
  assert.equal(w.origin,'simulated_archival_seed')
  assert.deepEqual(w.fieldOrder,ctx.fieldOrder)
  assert.deepEqual(w.units,ctx.units)
  assert.deepEqual(w.values,ctx.values.at(-1))
  assert.equal(w.period.logicalEndUtc,seed.simulation.epochUtc)
  assert.equal(ctx.values.length,7)
  assert.equal(ctx.origin,'external_archival_context')
  assert.equal(ctx.periods.length,7)
  assert.deepEqual(seed.worldHistory,{origin:'bootstrap_no_events',eventCursor:0,events:[]})
  for(const [index,field] of policy.domainFields.entries()){
    assert.equal(field.fieldId,'environment.'+w.fieldOrder[index])
    assert.equal(field.unit,w.units[index])
    for(const row of ctx.values){
      const value=row[index]
      assert(Number.isFinite(value)&&value>=field.constraints.min&&value<=field.constraints.max,'invalid archive weather value')
    }
  }
  return {scope:'isolated-maintenance-validation',policy:snapshotRef(FIRST_WEATHER_POLICY_PATH),
    preparedContentSha256:seed.contentSha256,contextValueSha256:featureSha(ctx.values),
    normalizedSourcePeriod:w.period,worldEventCountBefore:0,modelForwards:0}
}

function fixedOriginal(seed, savedBeforePath=seed.worldRef.path) {
  const raw=bound({...seed.worldRef,path:savedBeforePath})
  return {record:JSON.parse(raw),fileSha256:sha(raw),raw}
}

function assertPreparedEvidence(p,prepared,validation) {
  assert(read(p.prepared,65536).equals(encode(prepared)),'changed initialization preparation')
  assert(read(p.validation,65536).equals(encode(validation)),'changed maintenance validation')
}

function expectedRequest(input,original,r,p) {
  const saved=json(p.request)
  const expected=makeMaintenance(input,original,r.transaction,snapshotRef(p.prepared),snapshotRef(p.validation),saved.record.savedAt)
  assert.deepEqual(saved,expected,'maintenance request no longer matches frozen preparation')
  return expected
}

export async function initializeIsolatedWeather(name='qualification') {
  const run=runPath(name)
  const input=inputs(prepareWorldEnvironmentInitialization()),{seed}=input,r=await runtime(),v=verifiedSeed(input,r),original=fixedOriginal(seed)
  const p=files(run,seed.identity)
  try {
    fs.mkdirSync(safe(run))
    fs.mkdirSync(path.dirname(safe(p.save)),{recursive:true})
    put(p.save,original.raw)
  } catch(error){if(error.code!=='EEXIST')throw error}
  // A torn clone is never recreated from a missing or inconsistent record.
  const store=r.store.createProductionWorldRuntimeStore(safe(p.store))
  const current=await store.readNatural(query(seed.identity))
  assert.equal(current.status,'found','isolated store cannot read existing clone')
  put(p.prepared,encode(seed));put(p.validation,encode(v))
  if(!fs.existsSync(safe(p.request))){
    assert.equal(current.fileSha256,original.fileSha256,'bootstrap bytes or version have changed')
    const request=makeMaintenance(input,current,r.transaction,snapshotRef(p.prepared),snapshotRef(p.validation),at())
    put(p.request,encode(request))
  }
  const request=expectedRequest(input,original,r,p)
  const commit=await store.writeNaturalTransition(request)
  assert(commit.ok,'maintenance failed: '+commit.message)
  const replay=await store.writeNaturalTransition(request)
  assert(replay.ok&&replay.replayed,'same-key verification failed')
  assert.deepEqual(replay.receipt,commit.receipt)
  put(run+'/original-receipt.json',encode(commit.receipt))
  const result=await readCommittedWeatherInput(name)
  put(p.input,encode(result))
  assert.equal(bind(EVOLUTION_STORE).sha256,original.fileSha256)
  return {name,scope:'isolated-same-identity',replayed:commit.replayed===true,receipt:commit.receipt,
    workerInput:bind(p.input),sourceFileSha256:original.fileSha256,modelForwards:0,formalWorldWrites:0}
}

export async function readCommittedWeatherInput(name='qualification') {
  const run=runPath(name)
  const preparedBytes=bound({path:run+'/preparation.json',sha256:preparationSha})
  const input=inputs(JSON.parse(preparedBytes)),{seed,policy,budget,assessment}=input,r=await runtime()
  const p=files(run,seed.identity)
  // Read the Store's own immutable before-image. The formal live world can later advance.
  const key=json(p.request).event.businessKey
  assert(typeof key==='string' && /^[a-f0-9]{64}$/.test(key),'invalid saved key')
  const original=fixedOriginal(seed,p.save+'.evolution/'+key+'.'+seed.worldRef.sha256+'.before.json')
  assertPreparedEvidence(p,seed,verifiedSeed(input,r))
  const request=expectedRequest(input,original,r,p)
  const store=r.store.createProductionWorldRuntimeStore(safe(p.store)),current=await store.readNatural(query(seed.identity))
  assert.equal(current.status,'found','committed snapshot missing or invalid')
  const event=await store.readNaturalTransition({identity:seed.identity,businessKey:request.event.businessKey})
  assert.equal(event.status,'found','missing committed seed event')
  assert.deepEqual(event.event,request.event)
  assert.equal(event.receipt.fileSha256,current.fileSha256,'seed receipt is not the current file')
  assert.deepEqual(event.receipt,json(run+'/original-receipt.json'),'changed original receipt')
  assert.deepEqual(request.record,unsealed(current.record),'live domain differs from sealed request')
  assert.deepEqual(idOf(current.record),seed.identity)
  assert.equal(r.transaction.computeWorldEvolutionDomainSha(current.record),event.event.domainAfterSha256)
  const e=current.record.worldState.payload.environment.evolution
  assert.deepEqual(e.weather,seed.initialWeather)
  assert.deepEqual(e.commit.historyHead,{cursor:1,eventSha256:event.event.eventSha256})
  assert.equal(e.logicalEndUtc,budget.firstInterval.logicalStartUtc)
  const source=readPowerDailySource(bound(seed.sourceRefs.archive),JSON.parse(bound(seed.sourceRefs.receipt)),
    {start:'20200101',end:'20200131',...seed.sourceMetadata.requestedCoordinates,
      returnedCoordinates:seed.sourceMetadata.responseCoordinates.slice(0,2)})
  const actualFeatures=buildEvolutionDiagnosticFeatures(source)
  assert.deepEqual(actualFeatures.dates,seed.context.dates)
  assert.deepEqual(actualFeatures.periods,seed.context.periods)
  assert.deepEqual(actualFeatures.values,seed.context.values)
  const history=[...actualFeatures.values.slice(0,6),e.weather.values]
  return {schemaVersion:'world-weather-postmaintenance-input-v1',scope:'isolated-same-identity',
    identity:seed.identity,before:{tick:current.record.tick,stateVersion:current.record.stateVersion,eventCursor:current.record.eventCursor,
      fileSha256:current.fileSha256,worldFactsPayloadSha256:current.record.worldFactsPayloadSha256,statePayloadSha256:current.record.statePayloadSha256,
      recordContentSha256:current.record.recordContentSha256},interval:budget.firstInterval,
    modelSha256:policy.modelRef.sha256,policySha256:assessment.policyFileSha256,budgetSha256:policy.resourceContractRef.sha256,
    datasetReleaseIdentity:assessment.datasetRelease.identity,fieldOrder:e.weather.fieldOrder,units:e.weather.units,history,
    historyValueSha256:featureSha(history),historyProvenance:{archive:seed.sourceRefs.archive,receipt:seed.sourceRefs.receipt,
      periods:seed.context.periods,firstSixRowsOrigin:'external_archival_context',lastRowOrigin:'saved_simulated_archival_seed',
      maintenanceBusinessKey:event.event.businessKey,maintenanceEventSha256:event.event.eventSha256,livedEvolutionEvents:0},
    randomBefore:{use:'not_consumed',stateSha256:digest(current.record.randomState)}}
}

// This comparison only establishes model-output binding. It grants no write capability.
export async function verifyFirstWeatherOutputBinding(name,inputBytes,outputBytes) {
  assert(Buffer.isBuffer(inputBytes)&&inputBytes.length>0&&inputBytes.length<=65536,'invalid model input bytes')
  assert(Buffer.isBuffer(outputBytes)&&outputBytes.length>0&&outputBytes.length<=65536,'invalid model output bytes')
  const input=Buffer.from(inputBytes),outputRaw=Buffer.from(outputBytes)
  const output=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(outputRaw))
  assert.deepEqual(Object.keys(output).sort(),['checkpointSha256','inputSha256','job','modelForwards','pid','trainingUpdates','values'])
  assert(Number.isSafeInteger(output.pid)&&output.pid>0,'invalid model pid')
  const expected=await readCommittedWeatherInput(name)
  assert(input.equals(encode(expected)),'model input differs from committed weather pre-state')
  assert.equal(output.inputSha256,sha(input),'forward was executed for different input bytes')
  assert.equal(output.checkpointSha256,expected.modelSha256)
  assert.equal(output.modelForwards,1)
  assert.equal(output.trainingUpdates,0)
  assert(Array.isArray(output.values)&&output.values.length===4&&output.values.every(Number.isFinite),'invalid model weather vector')
  const {policy,budget}=inputs(JSON.parse(bound({path:runPath(name)+'/preparation.json',sha256:preparationSha})))
  const {domain}=await runtime()
  const beforeValues=Object.fromEntries(policy.domainFields.map((f,i)=>[f.fieldId,expected.history.at(-1)[i]]))
  const changes=policy.domainFields.flatMap((f,i)=>beforeValues[f.fieldId]===output.values[i]?[]:[{
    fieldId:f.fieldId,operation:'replace',beforeValueSha256:digest(beforeValues[f.fieldId]),
    newValue:output.values[i],reasonRefs:[sha(outputRaw)]}])
  const delta=domain.validateWorldEnvironmentDelta({policy,identity:expected.identity,interval:budget.firstInterval,
    beforeValues,changes,result:changes.length?'changes':'no_change'})
  return {domainValid:delta.domainValid,modelInputSha256:output.inputSha256,before:expected.before,
    modelOutputSha256:sha(outputRaw),requiresIndependentManagedWorkerReceipt:true,productionAdmitted:false}
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [, ,operation,name='qualification']=process.argv
  assert(process.argv.length<=4)
  if(operation==='--initialize')console.log(JSON.stringify(await initializeIsolatedWeather(name)))
  else if(operation==='--readback')console.log(JSON.stringify({pid:process.pid,input:await readCommittedWeatherInput(name)}))
  else throw Error('expected --initialize or --readback')
}
