import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {WEATHER_POLICY_PATH, WEATHER_RELEASE_PATH, WEATHER_VERSION, inspectWeatherReleasePolicy} from '../lib/world-weather-release-policy.mjs'
import {loadAndValidateReleasedCapabilityBinding, TRUSTED_RELEASE_REGISTRY_PATH, deriveRuntimeCapabilityTicket} from '../lib/ai-painter-autonomous-package-decision-core-v3.mjs'
import {publishMachineAdjudicatedCapability} from '../lib/ai-painter-machine-capability-release-orchestrator-v1.mjs'
import {runtime} from '../lib/world-initialized-evolution.mjs'

function refused(fn) {
  let error
  try { fn() } catch (e) { error=e }
  assert.equal(error?.code,'weather_release_not_admitted')
  assert.equal(error.productionAdmitted,false)
  assert.equal(error.assessment.blockers.includes('weather_dataset_not_released'),error.assessment.datasetRelease===null)
  assert.ok(error.assessment.blockers.includes('execution_budget_does_not_permit_formal_world_write'))
  return error.assessment
}
const root=process.cwd()
const options={projectRoot:root,capabilityReleasePath:WEATHER_RELEASE_PATH,trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH}
test('the strict Runtime policy and admission assessment agree on the policy digest and first region',async()=>{
  const api=(await runtime()).policy
  const result=inspectWeatherReleasePolicy(root), policy=JSON.parse(fs.readFileSync(WEATHER_POLICY_PATH))
  const verified=api.validateWorldEvolutionPolicy(policy,policy.identity)
  assert.equal(verified.policy.contentSha256,result.policyContentSha256)
  assert.equal(result.worldId,'mvp-natural-world-001')
  assert.equal(result.resources.formalWorldWrites,0)
})
test('actual publisher, Runtime reader and ticket issuer enforce the same candidate even without an explicit scope',()=>{
  const draft={capabilityReleaseIdentity:WEATHER_VERSION,productionAdmitted:true,passed:true}
  const writer=refused(()=>publishMachineAdjudicatedCapability(draft,{root,expectedRegistryRevision:0}))
  const reader=refused(()=>loadAndValidateReleasedCapabilityBinding({...options,requiredCapabilityScope:'world_evolution'}))
  const ticket=refused(()=>deriveRuntimeCapabilityTicket(options))
  assert.deepEqual(writer,reader)
  assert.deepEqual(reader,ticket)
})
test('an unrelated draft cannot claim a world scope through an omitted option or a getter',()=>{
  assert.throws(()=>publishMachineAdjudicatedCapability({capabilityScope:'world_evolution'},{root}),/unsupported_scope/)
  let accessed=false
  const draft={get modelCapabilityVersion(){accessed=true;return WEATHER_VERSION}}
  assert.throws(()=>publishMachineAdjudicatedCapability(draft,{root}),/accessors rejected/)
  assert.equal(accessed,false)
})
test('modified policy is rejected at both boundaries before any registry or lifecycle access',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weather-policy-binding-'))
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}))
  fs.mkdirSync(path.join(temp,'.runtime'))
  const p=path.join(temp,WEATHER_POLICY_PATH)
  fs.mkdirSync(path.dirname(p),{recursive:true})
  const modified=JSON.parse(fs.readFileSync(WEATHER_POLICY_PATH))
  modified.timePolicy.stepSeconds=1
  fs.writeFileSync(p,JSON.stringify(modified))
  assert.throws(()=>loadAndValidateReleasedCapabilityBinding({...options,projectRoot:temp}),/policy_file_sha/)
  assert.throws(()=>publishMachineAdjudicatedCapability({modelCapabilityVersion:WEATHER_VERSION},{root:temp}),/policy_file_sha/)
  assert.deepEqual(fs.readdirSync(path.join(temp,'.runtime')),[])
})
