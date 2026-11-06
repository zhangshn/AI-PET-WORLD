import assert from 'node:assert/strict'
import test from 'node:test'
import {verifyRollingWeatherReleaseDomain,verifyRollingServerTrial} from '../lib/world-weather-rolling-qualification.mjs'

test('both disconnected server days consume consecutive committed weather history',()=>{
  const result=verifyRollingServerTrial()
  assert.equal(result.anchor.tick,1)
  assert.deepEqual(result.days.map(day=>day.tick),[2,3])
  assert.notDeepEqual(result.days[0].output,result.days[1].output)
  assert.equal(result.productionAdmitted,false)
})

test('the verified runtime and condition roles bind the rolling implementation',()=>{
  const {bindings,releaseEvidence}=verifyRollingWeatherReleaseDomain()
  assert.equal(bindings.reviewContract.identity,'sakaerat-weather-153-rolling-v4')
  assert.equal(bindings.runtimeInterfaceContract.identity,'sakaerat-rolling-weather-runtime-v4')
  assert.equal(bindings.conditionContract.path,'scripts/lib/world-rolling-weather-input.mjs')
  assert(releaseEvidence.some(ref=>ref.path.endsWith('/qualification-evidence.json')))
})
