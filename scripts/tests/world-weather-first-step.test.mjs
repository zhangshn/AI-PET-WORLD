import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectWeatherReleasePolicy,FIRST_WEATHER_VERSION,FIRST_WEATHER_RELEASE_PATH} from '../lib/world-weather-release-policy.mjs'
import {publishMachineAdjudicatedCapability} from '../lib/ai-painter-machine-capability-release-orchestrator-v1.mjs'
import {deriveRuntimeCapabilityTicket,TRUSTED_RELEASE_REGISTRY_PATH} from '../lib/ai-painter-autonomous-package-decision-core-v3.mjs'
import {qualifyFirstWeatherBudget} from '../lib/world-weather-first-step.mjs'
import {runtime,json} from '../lib/world-initialized-evolution.mjs'

test('v2 changes the scoped budget while preserving the registered v1 contract and frame of reference',async()=>{
  const old=inspectWeatherReleasePolicy(process.cwd())
  const next=inspectWeatherReleasePolicy(process.cwd(),FIRST_WEATHER_VERSION)
  assert.notEqual(old.policyFileSha256,next.policyFileSha256)
  assert.equal(old.resources.formalWorldWrites,0)
  assert.equal(next.resources.formalWorldWrites,1)
  assert.equal(next.resources.actualModelForwardsMaximum,1)
  assert.equal(next.resources.maintenanceWrites,0)
  assert.equal(next.datasetRelease.identity,old.datasetRelease.identity)
  const policy=json('data/ai-painter/system-governance/mvp-natural-world-weather-policy-v2.json')
  assert.equal((await runtime()).policy.validateWorldEvolutionPolicy(policy,policy.identity).policy.contentSha256,next.policyContentSha256)
})

test('publisher and ticket issuer cannot substitute a numeric write budget for a released capability',()=>{
  const options={projectRoot:process.cwd(),capabilityReleasePath:FIRST_WEATHER_RELEASE_PATH,trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH}
  for(const fn of [()=>deriveRuntimeCapabilityTicket(options),()=>publishMachineAdjudicatedCapability({modelCapabilityVersion:FIRST_WEATHER_VERSION,passed:true},{root:process.cwd()})]){
    assert.throws(fn,e=>e.code==='weather_release_not_admitted'&&e.assessment.candidateVersion===FIRST_WEATHER_VERSION&&
      e.assessment.blockers.includes('formal_initialization_and_commit_path_not_qualified'))
  }
})

test('an arbitrary identifier cannot allocate another qualification budget',async()=>{
  await assert.rejects(qualifyFirstWeatherBudget('forecast-extra'),/unknown budget qualification/)
})
