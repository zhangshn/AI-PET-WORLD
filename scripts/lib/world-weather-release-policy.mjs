import fs from 'node:fs'
import path from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {baselineDigest, baselineJson, baselineSha256} from './natural-world-baseline-proof.mjs'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {prepareNaturalWorldWeatherTarget} from './world-environment-target-profile.mjs'
import {readWeatherFieldDomain} from './world-weather-field-domain.mjs'
import {verifyWeatherDatasetRelease} from './world-weather-dataset-release.mjs'
import {inspectCapabilityScopeAdmission} from './ai-painter-autonomous-package-decision-core-v3.mjs'

export const WEATHER_VERSION = 'sakaerat-weather-153-runtime-v1'
export const WEATHER_POLICY_PATH = 'data/ai-painter/system-governance/mvp-natural-world-weather-policy-v1.json'
export const WEATHER_RELEASE_PATH = 'data/ai-painter/capability-releases/' + WEATHER_VERSION + '/release.json'
const policyFileSha = '50536801dad74ff4bdb117e744bb863169d3d2fee01f0ed213c6e2e5dccbc05e'
export const FIRST_WEATHER_VERSION = 'sakaerat-weather-153-runtime-v2'
export const FIRST_WEATHER_POLICY_PATH = 'data/ai-painter/system-governance/mvp-natural-world-weather-policy-v2.json'
export const FIRST_WEATHER_RELEASE_PATH = 'data/ai-painter/capability-releases/' + FIRST_WEATHER_VERSION + '/release.json'
function policyBinding(version) {
  if (version === WEATHER_VERSION) return {path:WEATHER_POLICY_PATH,sha256:policyFileSha}
  if (version === FIRST_WEATHER_VERSION) return {path:FIRST_WEATHER_POLICY_PATH,sha256:'fe2e3e6948aa8bcd422be384d3eeccee217748e9e961aa34604db746fd0bd2b8'}
  throw Error('unknown_weather_policy_version')
}
const qualificationPath = '.runtime/ai-painter/controller-repair-reviews/world-environment-pilot-147-20261029/source-qualification.json'
const trainingBindingPath = '.runtime/ai-painter/controller-repair-reviews/world-environment-pilot-147-20261029/dataset-binding.json'

function requireValue(condition, reason) {
  if (!condition) throw new Error('weather_release_' + reason)
}

function candidateSpec(version) {
  return {schemaVersion:'ai-painter-capability-change-candidate-v1', capabilityVersion:version,
    changeClass:'runtime_interface', ownerAuthorizationRequired:false, ownerInLifecycle:false,
    sourceEvidence:[policyBinding(version)]}
}

function readLifecycle(root, read, version) {
  const lifecycleRoot = '.runtime/ai-painter/capability-lifecycle/' + version
  // Only the established runtime mount can be a junction. Resolve its fixed descendants explicitly.
  let directory = fs.realpathSync(path.join(root,'.runtime'))
  for (const segment of lifecycleRoot.slice('.runtime/'.length).split('/')) {
    directory = path.join(directory,segment)
    try { requireValue(fs.lstatSync(directory).isDirectory() && fs.realpathSync.native(directory)===directory,'lifecycle_directory') }
    catch(error) { if(error.code==='ENOENT')return {state:'absent',sequence:null};throw error }
  }
  const spec = baselineJson(read(lifecycleRoot+'/candidate.json',65536))
  requireValue(baselineDigest(spec)===baselineDigest(candidateSpec(version)),'lifecycle_identity_conflict')
  const status = baselineJson(read(lifecycleRoot+'/state.json',65536))
  const dbFile=path.join(directory,'lifecycle.sqlite')
  const stat=fs.lstatSync(dbFile)
  requireValue(stat.isFile() && stat.nlink===1 && fs.realpathSync.native(dbFile)===dbFile,'lifecycle_sqlite_path')
  const db=new DatabaseSync(dbFile,{readOnly:true})
  try {
    const row=db.prepare('SELECT c.state,c.change_class,t.to_state,t.sequence FROM capabilities c JOIN lifecycle_transitions t USING(capability_version) WHERE c.capability_version=? ORDER BY t.sequence DESC LIMIT 1').get(version)
    requireValue(row && row.change_class===spec.changeClass && status.capabilityVersion===version &&
      status.changeClass===spec.changeClass && row.state===row.to_state && row.state===status.state &&
      row.sequence===status.sequence,'lifecycle_state_conflict')
    return {state:row.state,sequence:row.sequence}
  } finally {db.close()}
}

// A policy candidate binds the proposed capability version. Only the original trusted
// release record can grant it. The private execution budget is evidence of the limit actually tested.
export function inspectWeatherReleasePolicy(root,version=WEATHER_VERSION) {
  const {read}=createEvolutionInputReader(root)
  const binding=policyBinding(version),raw=read(binding.path,65536)
  requireValue(baselineSha256(raw)===binding.sha256,'policy_file_sha')
  const {contentSha256,...policy}=baselineJson(raw)
  requireValue(baselineDigest(policy)===contentSha256 && policy.scopeId==='world_evolution','policy_content')
  const sourceBytes=new Map()
  function verifyRef(ref){
    if(!sourceBytes.has(ref.id))sourceBytes.set(ref.id,read(ref.id,4*1024*1024))
    requireValue(baselineSha256(sourceBytes.get(ref.id))===ref.sha256,'reference_sha:'+ref.id)
  }
  for(const ref of [policy.capabilityRef,policy.modelRef,policy.validatorRef,policy.inputSchemaRef,
    policy.executionPolicyRef,policy.resourceContractRef,policy.maintenancePolicy.migrationEvidenceRef,
    policy.maintenancePolicy.resumeRule,...policy.historyPolicy.evidenceRefs,...policy.registrationEvidenceRefs,
    ...policy.domainFields.flatMap(f=>f.evidenceRefs)])verifyRef(ref)
  const target=baselineJson(sourceBytes.get(policy.capabilityRef.id))
  const fieldDomain=readWeatherFieldDomain(read)
  requireValue(policy.capabilityRef.version===version && policy.modelRef.sha256===target.modelSha256 &&
    baselineDigest(policy.identity)===baselineDigest(target.identity) &&
    baselineDigest(policy.domainFields)===baselineDigest(fieldDomain.domainFields),'target_model_fields')
  const resource=baselineJson(sourceBytes.get(policy.resourceContractRef.id))
  if(version===FIRST_WEATHER_VERSION){
    requireValue(resource.version===version && baselineDigest(resource.identity)===baselineDigest(policy.identity),'budget_identity')
    for(const item of [resource.interpreter,resource.worker,resource.nativeOwner,resource.supervisor,resource.nativeBuilder,...resource.basis]){
      verifyRef({id:item.path,sha256:item.sha256})
    }
  }
  requireValue(baselineDigest(policy.timePolicy)===baselineDigest(resource.timePolicy) &&
    policy.timePolicy.simulationEpochUtc===target.initialization.epochUtc &&
    policy.timePolicy.stepSeconds===target.time.singleStepSeconds && resource.checkpoint.sha256===target.modelSha256,'time_contract')
  const datasetBinding=baselineJson(sourceBytes.get(trainingBindingPath))
  requireValue(baselineSha256(read(datasetBinding.path,datasetBinding.bytes))===resource.checkpoint.trainingDatasetSha256 &&
    datasetBinding.sha256===resource.checkpoint.trainingDatasetSha256,'training_dataset_sha')
  const inventory=inspectCapabilityScopeAdmission({projectRoot:root,requiredCapabilityScope:'world_evolution'})
  const qualification=baselineJson(sourceBytes.get(qualificationPath))
  const datasetRelease=verifyWeatherDatasetRelease(root,{allowAbsent:true})
  if(datasetRelease)requireValue(datasetRelease.checkpointSha256===policy.modelRef.sha256 &&
    datasetRelease.trainingDatasetSha256===datasetBinding.sha256,'published_dataset_identity')
  const lifecycle=readLifecycle(root,read,version)
  const blockers=[]
  if(!datasetRelease)blockers.push('weather_dataset_not_released')
  if(resource.scope!=='production_world_execution' || !(resource.resources.formalWorldWrites>0))blockers.push('execution_budget_does_not_permit_formal_world_write')
  if(!['machine_release_adjudicated','released'].includes(lifecycle.state))blockers.push('weather_lifecycle_not_adjudicated')
  if(version===FIRST_WEATHER_VERSION)blockers.push('formal_initialization_and_commit_path_not_qualified')
  return {scope:policy.scopeId,candidateVersion:version,worldId:policy.identity.worldId,
    policyFileSha256:binding.sha256,policyContentSha256:contentSha256,modelSha256:policy.modelRef.sha256,
    verifiedReferences:sourceBytes.size,timePolicy:policy.timePolicy,resources:resource.resources,
    registry:inventory.registry,sourceQualification:qualification.status,
    datasetRelease:datasetRelease && {identity:datasetRelease.datasetReleaseIdentity,packageRef:datasetRelease.packageRef,
      selectionSha256:datasetRelease.datasetSelectionReproductionSha256,counts:datasetRelease.counts},
    lifecycle,blockers,productionAdmitted:false}
}

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

export function requireWeatherProductionAdmission(root,version=WEATHER_VERSION) {
  const assessment=inspectWeatherReleasePolicy(root,version)
  // A later policy with a different dataset, budget or consumer needs its own version.
  // Even a matching file or a caller-supplied pass flag cannot authorize this candidate.
  const error=new Error('weather_release_not_admitted: '+assessment.blockers.join(', '))
  error.code='weather_release_not_admitted'
  error.productionAdmitted=false
  error.assessment=assessment
  throw error
}
