import assert from 'node:assert/strict'
import fs from 'node:fs'
import {test} from 'node:test'
import {readCommittedWorldWeatherInput,requireCommittedWeatherProductionExecution,verifyCommittedWorldWeatherOutput} from '../lib/world-weather-committed-input.mjs'
import {bind,json,safe,sha} from '../lib/world-initialized-evolution.mjs'

const base='.runtime/ai-painter/controller-repair-reviews/world-first-evolution-executor-180-20261103/qualification'
const save=base+'/store/mvp-natural-owner-001/mvp-natural-world-001.json'
const encode=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
test('caller cannot choose a Store or fabricate production execution authority',async()=>{
  await assert.rejects(readCommittedWorldWeatherInput('data/world-runtime'),/fixed committed weather scope/)
  assert.throws(()=>requireCommittedWeatherProductionExecution({released:true}),/no caller-supplied authority/)
  assert.throws(()=>requireCommittedWeatherProductionExecution(),/weather_release_not_admitted/)
})
test('bounds and types are enforced before any managed worker can be accepted',async()=>{
  for(const data of ['',Buffer.alloc(0),Buffer.alloc(65537)]){
    await assert.rejects(verifyCommittedWorldWeatherOutput('qualification',data,'{}',null,1),/bounded committed input/)
  }
  await assert.rejects(verifyCommittedWorldWeatherOutput('qualification',Buffer.from('{}'),'x'.repeat(65537),null,1),/bounded weather stdout/)
})
test('real committed clone binds the original receipt, bytes, provenance and full seven days',async t=>{
  if(!fs.existsSync(safe(save)))return t.skip('dedicated integration Store has not been prepared')
  const actual=bind(save),saved=json(save)
  if(saved.tick===1){
    await assert.rejects(readCommittedWorldWeatherInput('qualification'),/previously evolved/)
    assert.equal(bind(save).sha256,actual.sha256)
    return
  }
  const input=await readCommittedWorldWeatherInput('qualification')
  const receipt=json(base+'/maintenance-receipt.json')
  assert.equal(input.before.fileSha256,actual.sha256)
  assert.deepEqual([input.before.tick,input.before.stateVersion,input.before.eventCursor],[0,1,1])
  assert.equal(input.historyProvenance.maintenanceBusinessKey,receipt.businessKey)
  assert.equal(input.historyProvenance.maintenanceEventSha256,receipt.eventSha256)
  assert.equal(input.historyProvenance.livedEvolutionEvents,0)
  assert.equal(input.history.length,7)
  assert.deepEqual(input.history.at(-1),saved.worldState.payload.environment.evolution.weather.values)
  assert(input.history.every(row=>row.length===4&&row.every(Number.isFinite)))
  const bytes=encode(input)
  assert.equal(sha(encode(await readCommittedWorldWeatherInput('qualification'))),sha(bytes))
  for(const mutate of [x=>{x.before.stateVersion=0},x=>{x.history[0][0]++},x=>{x.historyProvenance.maintenanceEventSha256='0'.repeat(64)}]){
    const fake=structuredClone(input);mutate(fake)
    await assert.rejects(verifyCommittedWorldWeatherOutput('qualification',encode(fake),'{}',{},1),/committed input changed/)
  }
  await assert.rejects(verifyCommittedWorldWeatherOutput('qualification',bytes,'{}',{cleanupConfirmed:true},1),/native managed proof/)
  assert.equal(bind(save).sha256,actual.sha256)
})
