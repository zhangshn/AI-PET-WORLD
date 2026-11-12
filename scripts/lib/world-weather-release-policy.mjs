// Compatibility entry: readonly assessment is separate from lifecycle registration.
import {prepareNaturalWorldWeatherTarget} from './world-environment-target-profile.mjs'
import {WEATHER_VERSION, inspectWeatherReleasePolicy, weatherPolicyCandidateSpec as candidateSpec, requireWeatherPolicyValue as requireValue} from './world-weather-release-policy-reader.mjs'
export {WEATHER_VERSION, WEATHER_POLICY_PATH, WEATHER_RELEASE_PATH, FIRST_WEATHER_VERSION, FIRST_WEATHER_POLICY_PATH, FIRST_WEATHER_RELEASE_PATH, inspectWeatherReleasePolicy, requireWeatherProductionAdmission} from './world-weather-release-policy-reader.mjs'

export async function registerWeatherPolicyCandidate(root,version=WEATHER_VERSION) {
  const prior=inspectWeatherReleasePolicy(root,version)
  if(prior.lifecycle.state!=='absent')return {...prior,created:false}
  // Initial registration needs the live bootstrap inputs. Reading an existing candidate does not.
  const prepared=prepareNaturalWorldWeatherTarget(root)
  requireValue(prepared.identity.worldId===prior.worldId && prepared.modelRef.sha256===prior.modelSha256,'initial_target')
  const {createCapabilityCandidate}=await import('./ai-painter-capability-lifecycle-v1.mjs')
  // The original lifecycle writer owns directory creation, SQLite state and the event log.
  createCapabilityCandidate(candidateSpec(version),{root})
  const registered=inspectWeatherReleasePolicy(root,version)
  requireValue(registered.lifecycle.state==='change_candidate' && registered.lifecycle.sequence===0,'candidate_readback')
  return {...registered,created:true}
}
