import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {bind,json,read,runtime,safe,sha} from '../lib/world-initialized-evolution.mjs'
import {EVOLUTION_STORE} from '../lib/natural-world-evolution-input.mjs'
import {initializeIsolatedWeather,readCommittedWeatherInput,verifyFirstWeatherOutputBinding} from '../lib/world-weather-first-transaction.mjs'
import {buildIsolatedWeatherEvolutionRequest,verifyPostcommitProcess} from '../lib/world-weather-postcommit-run.mjs'
import {FIRST_WEATHER_POLICY_PATH} from '../lib/world-weather-release-policy.mjs'

const base='.runtime/ai-painter/controller-repair-reviews/natural-world-mainline-172-20261102/transaction'
const fresh=()=>'test-'+randomUUID().replaceAll('-','')
const encode=x=>Buffer.from(JSON.stringify(x))
test('maintenance preserves the original identity, original facts and RNG, and replays across processes',async()=>{
  const name=fresh(),original=bind(EVOLUTION_STORE),old=json(EVOLUTION_STORE)
  const first=await initializeIsolatedWeather(name),retry=await initializeIsolatedWeather(name)
  assert(!first.replayed);assert(retry.replayed);assert.deepEqual(first.receipt,retry.receipt)
  const child=spawnSync(process.execPath,['scripts/lib/world-weather-first-transaction.mjs','--readback',name],
    {encoding:'utf8',timeout:20000,maxBuffer:65536,windowsHide:true})
  assert.equal(child.status,0,child.stderr);const readback=JSON.parse(child.stdout)
  assert.equal(readback.pid,child.pid);assert.notEqual(readback.pid,process.pid)
  const input=readback.input
  assert.deepEqual([input.before.tick,input.before.stateVersion,input.before.eventCursor],[0,1,1])
  assert.equal(input.before.fileSha256,first.receipt.fileSha256)
  assert.deepEqual(input,JSON.parse(read(first.workerInput.path)))
  const stored=json(base+'/'+name+'/store/'+old.ownerId+'/'+old.worldId+'.json')
  assert.deepEqual(stored.randomState,old.randomState);assert.deepEqual(stored.worldFacts,old.worldFacts)
  assert.equal(stored.worldState.payload.environment.evolution.weather.values[0],input.history.at(-1)[0])
  assert.deepEqual(bind(EVOLUTION_STORE),original)
})
test('a preview on the old record fails even with identical numerical history; malformed or tampered results fail',async()=>{
  const name=fresh(),{workerInput}=await initializeIsolatedWeather(name)
  const newRaw=read(workerInput.path),expected=JSON.parse(newRaw),previewDir='.runtime/ai-painter/world-weather-first-step/forecast'
  const oldRaw=read(previewDir+'/input.json'),previewRaw=Buffer.from(json(previewDir+'/process.json').stdout)
  assert.deepEqual(JSON.parse(oldRaw).history,expected.history)
  await assert.rejects(verifyFirstWeatherOutputBinding(name,oldRaw,previewRaw),/differs from committed/)
  await assert.rejects(verifyFirstWeatherOutputBinding(name,newRaw,previewRaw),/different input bytes/)
  // A synthetic schema check cannot grant execution or commit authority.
  const synthetic={...JSON.parse(previewRaw),inputSha256:sha(newRaw),values:expected.history.at(-1)}
  const result=await verifyFirstWeatherOutputBinding(name,newRaw,encode(synthetic))
  assert(result.domainValid && result.requiresIndependentManagedWorkerReceipt);assert.equal(result.productionAdmitted,false)
  await assert.rejects(verifyFirstWeatherOutputBinding(name,newRaw,encode({...synthetic,values:[-200,20,20,2]})),/field_value/)
  await assert.rejects(verifyFirstWeatherOutputBinding(name,newRaw,encode({...synthetic,passed:true})))
  await assert.rejects(verifyFirstWeatherOutputBinding(name,newRaw,Buffer.alloc(65537)),/invalid model output bytes/)
  const altered={...expected,before:{...expected.before,eventCursor:2}}
  await assert.rejects(verifyFirstWeatherOutputBinding(name,encode(altered),previewRaw),/differs from committed/)
})
test('the Store rejects an inconsistent CAS without changing the clone; the input reader rejects a damaged saved receipt',async()=>{
  const name=fresh(),{receipt}=await initializeIsolatedWeather(name),dir=base+'/'+name
  const request=json(dir+'/maintenance-request.json')
  const {store:factory}=await runtime(),store=factory.createProductionWorldRuntimeStore(safe(dir+'/store'))
  const wrong={...request,expectedStateVersion:13}
  const rejected=await store.writeNaturalTransition(wrong)
  assert.equal(rejected.ok,false)
  const current=await store.readNatural({ownerId:receipt.identity.ownerId,worldId:receipt.identity.worldId})
  assert.equal(current.fileSha256,receipt.fileSha256)
  const fixture=safe(dir+'/original-receipt.json')
  assert(path.basename(path.dirname(fixture)).startsWith('test-'))
  fs.writeFileSync(fixture,JSON.stringify({...receipt,fileSha256:'0'.repeat(64)}))
  await assert.rejects(readCommittedWeatherInput(name),/changed original receipt/)
})
test('qualification accepts only its fixed directory or isolated test identifiers',async()=>{
  for(const injection of ['../data/world-runtime','qualification/other','data/world-runtime',{}]){
    await assert.rejects(initializeIsolatedWeather(injection),/scope/)
    await assert.rejects(readCommittedWeatherInput(injection),/scope/)
  }
})
test('postcommit rejects foreign worker, stale pre-state and out-of-domain vector without a launch or write',async()=>{
  assert.throws(()=>verifyPostcommitProcess({receipt:{},stdout:'{}',heartbeatPid:7,limits:{}}),/native owner/)
  const directory=base+'/qualification',input=json(directory+'/postcommit-input.json')
  const api=await runtime(),policy=json(FIRST_WEATHER_POLICY_PATH)
  const seed=api.transaction.snapshotNaturalWorldTransition(json(directory+'/maintenance-request.json'))
  const current={status:'found',record:seed.record,fileSha256:input.before.fileSha256}
  const ref=bind(directory+'/postcommit-input.json'),artifacts={worker:ref,process:ref,output:ref,validation:ref}
  const request=v=>buildIsolatedWeatherEvolutionRequest(api,current,input,{values:v},policy,artifacts)
  const valid=api.transaction.snapshotNaturalWorldTransition(request([0.2,61,26,1]))
  assert.equal(valid.event.previousEventSha256,input.historyProvenance.maintenanceEventSha256)
  assert.deepEqual(valid.record.worldFacts.payload,current.record.worldFacts.payload)
  assert.throws(()=>request([0.2,101,26,1]))
  current.fileSha256='0'.repeat(64);assert.throws(()=>request([0.2,61,26,1]))
})
