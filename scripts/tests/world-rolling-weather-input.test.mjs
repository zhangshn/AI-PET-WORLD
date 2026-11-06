import assert from 'node:assert/strict'
import {test} from 'node:test'
import {bound,featureSha,json} from '../lib/world-initialized-evolution.mjs'
import {readWorldRollingWeatherInput,rollingLocations} from '../lib/world-rolling-weather-input.mjs'

test('fixed rolling scopes reject injected Store names and alternate releases',async()=>{
  for(const v of ['.runtime/another','production/../qualification',{worldId:'foreign'}])assert.throws(()=>rollingLocations(v),/fixed rolling/)
  await assert.rejects(readWorldRollingWeatherInput('historical-clone'),/fixed rolling/)
})
test('committed first formal day becomes the newest model row; a later v4 head cannot stand in for this contract',async()=>{
  const v=JSON.parse(bound({path:'.runtime/ai-painter/controller-repair-reviews/world-server-rolling-schedule-190-20261103/formal-next-input.json',
    sha256:'9dd1328a722c7b8719b0719def007def72a21fb6938e2c1a43091a5c2c015733'}))
  const first=json('.runtime/ai-painter/world-first-weather-runtime/v3/input.json')
  const out=json('.runtime/ai-painter/world-first-weather-runtime/v3/output.json')
  assert.equal(v.before.tick,1)
  assert.deepEqual(v.history,[...first.history.slice(1),out.values])
  assert.deepEqual(v.rows.map(r=>r.provenance.kind),['archival_context','archival_context','archival_context','archival_context','archival_context','committed_archival_seed','committed_model_weather'])
  assert.equal(v.interval.logicalStartUtc,'2020-01-09T00:00:00.000Z')
  assert.equal(v.rows[6].provenance.input.sha256,out.inputSha256)
  const current=json('data/world-runtime/'+v.identity.ownerId+'/'+v.identity.worldId+'.json')
  if(current.tick===1)assert.deepEqual(await readWorldRollingWeatherInput('production'),v)
  else{
    assert(current.tick>1)
    await assert.rejects(readWorldRollingWeatherInput('production'),/input\.json|production rolling successor release unavailable/)
    const clone=await readWorldRollingWeatherInput('qualification')
    const row=clone.rows.find(r=>r.provenance.tick===1&&r.provenance.eventSha256===v.head.eventSha256)
    assert.deepEqual(row.values,out.values)
  }
  assert.equal(v.rows.at(-1).provenance.eventSha256,v.head.eventSha256)
  assert.equal(featureSha(v.history),v.historyValueSha256)
  assert.notEqual(first.historyValueSha256,v.historyValueSha256)
  assert.equal(v.interval.durationSeconds,86400);assert.equal(v.history.length,7)
})
