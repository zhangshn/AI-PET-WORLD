import assert from 'node:assert/strict'
import test from 'node:test'
import {verifyCommittedWeatherTrial} from '../lib/world-weather-v3-qualification.mjs'

test('the frozen forecast, Windows Job and committed isolated event identify the same model run', () => {
  const trial = verifyCommittedWeatherTrial()
  assert.equal(trial.input.before.tick, 0)
  assert.equal(trial.input.before.stateVersion, 1)
  assert.equal(trial.output.modelForwards, 1)
  assert.equal(trial.isolatedReceipt.tick, 1)
  assert.equal(trial.isolatedReceipt.stateVersion, 2)
  assert.equal(trial.isolatedReceipt.productionReady, false)
})
