import assert from 'node:assert/strict'
import {test} from 'node:test'
import {runtime,json} from '../lib/world-initialized-evolution.mjs'
import {launchRollingWeatherQualification} from '../lib/world-rolling-weather-service.mjs'
test('no caller-specified server executable, production route or unlimited mode',async()=>{
  for(const x of [true,{},'production','forever'])await assert.rejects(launchRollingWeatherQualification(x))
})
test('existing clock freezes offline time and earns only one interval per elapsed online period',async()=>{
  const {clock}=await runtime()
  const cfg=json('data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json').timePolicy
  const last='2020-01-09T00:00:00.000Z'
  const anchor=clock.createWorldEvolutionClockAnchor({policy:cfg,lastCommittedLogicalEndUtc:last,monotonicNowMs:420000,recoveredPendingSteps:0})
  const plan=(now,budget,end=last)=>clock.planWorldEvolutionBatch(anchor,{monotonicNowMs:now,committedLogicalEndUtc:end,
    remainingStepBudget:budget,remainingLogicalSeconds:budget*86400,maxBatchSteps:1})
  assert.equal(plan(420000,2).proposedSteps,0)
  assert.equal(plan(434999,2).proposedSteps,0)
  const first=plan(435000,2);assert.equal(first.proposedSteps,1);assert.equal(first.intervals[0].logicalEndUtc,'2020-01-10T00:00:00.000Z')
  assert.equal(plan(435000,1,first.intervals[0].logicalEndUtc).proposedSteps,0)
  assert.equal(plan(450000,0,first.intervals[0].logicalEndUtc).proposedSteps,0)
  assert.throws(()=>clock.createWorldEvolutionClockAnchor({policy:cfg,lastCommittedLogicalEndUtc:last,monotonicNowMs:0,recoveredPendingSteps:1}),/freeze/)
})
