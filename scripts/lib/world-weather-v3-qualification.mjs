import assert from 'node:assert/strict'
import {BASELINE_IDENTITY, baselineDigest, baselineJson, baselineSha256} from './natural-world-baseline-proof.mjs'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {verifyWeatherRegression} from './world-weather-regression.mjs'
import {verifyWeatherDatasetRelease} from './world-weather-dataset-release.mjs'

export const FIRST_WEATHER_DOMAIN_POLICY_PATH = 'data/ai-painter/system-governance/mvp-natural-world-weather-policy-v3.json'
export const FIRST_WEATHER_DOMAIN_BINDING_ROLES = Object.freeze([
  'datasetRelease', 'modelArtifact', 'reviewContract', 'runtimeInterfaceContract', 'conditionContract',
])
const version = 'sakaerat-weather-153-runtime-v3'
const contractPath = 'data/ai-painter/system-governance/sakaerat-first-committed-weather-runtime-v3.json'
const qualificationRoot = '.runtime/ai-painter/controller-repair-reviews/world-first-evolution-executor-180-20261103/'
const evidencePath = qualificationRoot + 'qualification/run/result.json'
const evidenceSha = '1bed75d7512797933288156e8d46a5828760f43c3156151e081263e4d9f5b6f6'

function evidenceReader(root) {
  const {read} = createEvolutionInputReader(root)
  function bytes(ref) {
    const data = read(ref.path, ref.bytes ?? 4 * 1024 * 1024)
    assert.equal(baselineSha256(data), ref.sha256, 'weather evidence bytes changed: ' + ref.path)
    if (ref.bytes !== undefined) assert.equal(data.length, ref.bytes)
    return data
  }
  return {read, bytes, get:ref => baselineJson(bytes(ref))}
}

// Recompute the lineage of an actual model output through its native worker and
// isolated Store. This remains reproducible after the formal game world advances.
export function verifyCommittedWeatherTrial(root = process.cwd()) {
  const {read, get} = evidenceReader(root)
  const result = get({path:evidencePath,sha256:evidenceSha})
  const launch = get(result.launch), input = get(result.input), output = get(result.output)
  const proc = get(result.process), validation = get(result.validation), budget = get(launch.budget)
  assert.equal(input.scope,'qualification')
  assert.deepEqual(input.identity,BASELINE_IDENTITY)
  assert.equal(launch.input.sha256,result.input.sha256)
  assert.equal(output.inputSha256,result.input.sha256)
  assert.equal(output.checkpointSha256,input.modelSha256)
  assert.deepEqual([output.modelForwards,output.trainingUpdates,result.formalWorldWrites],[1,0,0])
  assert.deepEqual(validation.output,output)
  assert.equal(validation.modelInputSha256,result.input.sha256)
  assert.equal(validation.workerStdoutSha256,result.output.sha256)
  assert.equal(validation.domainValid,true)
  assert.equal(output.pid,proc.proof.rootPid)
  assert.equal(proc.ownerIdentity.pid,proc.proof.ownerPid)
  assert(proc.cleanupConfirmed && proc.guardReleaseConfirmed && proc.ownerClosed)
  assert(proc.proof.assignedBeforeResume && proc.proof.killOnJobClose)
  assert.deepEqual([proc.proof.exitCode,proc.proof.activeProcessesAfterCleanup],[0,0])
  assert.match(proc.guard.identity,/^[0-9a-f-]{36}$/)
  const guard = '.runtime/ai-painter/owned-worker-guards/' + proc.guard.identity
  const observed = baselineJson(read(guard+'-native/cleanup-observation.json',65536))
  assert.equal(observed.bindingBase64,proc.proof.bindingBase64)
  assert.equal(observed.rootPid,output.pid)
  assert.equal(observed.activeProcessesAfterCleanup,0)
  const native = baselineJson(read(guard+'-terminal.json',65536))
  assert.deepEqual(native.proof,proc.proof)
  assert.equal(output.job.cpuAffinityCount,budget.limits.cpuThreadsMaximum)
  assert.equal(output.job.maxProcesses,1)
  assert.equal(output.job.maxCommittedBytes,budget.limits.maxCommittedMemoryMiB*1048576)
  assert(output.job.peakCommittedBytes > 0 && output.job.peakCommittedBytes <= output.job.maxCommittedBytes)
  assert(result.elapsedMs > 0 && result.elapsedMs <= budget.limits.runSecondsMaximum*1000)
  const receipt = result.receipt
  assert.deepEqual(receipt.identity,input.identity)
  assert.deepEqual([receipt.tick,receipt.stateVersion,receipt.eventCursor],[1,2,2])
  assert.equal(result.replayed,true)
  assert.equal(result.recovered.fileSha256,receipt.fileSha256)
  assert.deepEqual(result.recovered.weather.values,output.values)
  const tx = qualificationRoot+'qualification/store/'+input.identity.ownerId+'/'+input.identity.worldId+'.json.evolution/'+receipt.businessKey+'.'
  const event = baselineJson(read(tx+receipt.eventSha256+'.event.json',65536))
  const {eventSha256,...payload} = event
  assert.equal(baselineDigest(payload),eventSha256)
  assert.equal(eventSha256,receipt.eventSha256)
  assert.equal(event.previousEventSha256,input.historyProvenance.maintenanceEventSha256)
  assert.equal(event.evidence.inputRef.sha256,result.input.sha256)
  assert.equal(event.evidence.outputRef.sha256,result.output.sha256)
  assert.deepEqual(event.changes,validation.changes)
  const before = get({path:tx+input.before.fileSha256+'.before.json',sha256:input.before.fileSha256})
  const after = get({path:tx+receipt.fileSha256+'.record.json',sha256:receipt.fileSha256})
  assert.deepEqual(before.worldState.payload.environment.evolution.weather.values,input.history.at(-1))
  assert.deepEqual(after.worldState.payload.environment.evolution.weather.values,output.values)
  assert.deepEqual(before.randomState,after.randomState)
  assert.equal(after.recordContentSha256,receipt.recordContentSha256)
  return {input, output, isolatedReceipt:receipt, resultRef:{path:evidencePath,sha256:evidenceSha}}
}

const policyDigest = 'f788ac81f9b0d3bb9188e802b9a890ffd0d00ac7ccafe2052244328c3deb3d01'
const budgetDigest = 'd75ab622e3b420f3ec3ebd3eb0eeceebb83c61d370141e7b1d09ff838ef679c2'
const runtimeTrialRef = {
  path:'.runtime/ai-painter/controller-repair-reviews/world-first-evolution-runtime-185-20261103/qualification-evidence.json',
  sha256:'981f2acde15a27c5d19acf0c2b99ab626b6e6a3c697ab0c77b73e8cbbe4e5964',
}

function verifyRuntimeConsumer(verifier, budget, trial) {
  const q = verifier.get(runtimeTrialRef)
  for (const s of q.sourceBindings) verifier.bytes(s)
  assert.equal(q.normalEntrySha256,budget.entry.sha256)
  assert.equal(q.productionBudgetCandidate.sha256,budgetDigest)
  assert.equal(q.productionPolicyCandidate.sha256,policyDigest)
  assert.deepEqual(q.firstCursor,[0,1,1]); assert.deepEqual(q.finalCursor,[1,2,2])
  const result = verifier.get(q.resultRef), request = verifier.get(q.requestRef), actual = verifier.get(q.afterRecordRef)
  const event = verifier.get(q.eventRef), receipt = verifier.get(q.receiptRef)
  const input = verifier.get(q.inputRef), output = verifier.get(q.outputRef), validation = verifier.get(q.validationRef)
  const proc = verifier.get(q.processRef), cleanup = verifier.get(q.cleanupRef), terminal = verifier.get(q.terminalRef)
  const claim = verifier.get(q.workerClaimRef), reservation = verifier.get(q.reservationRef)
  assert.deepEqual(input,trial.input); assert.deepEqual(output.values,trial.output.values)
  assert.equal(output.checkpointSha256,budget.checkpoint.sha256)
  assert.deepEqual([output.trainingUpdates,output.modelForwards,result.modelForwards,q.realWorldWrites],[0,1,1,0])
  assert.equal(claim.pid,output.pid); assert.equal(output.pid,proc.proof.rootPid)
  assert.equal(claim.reservationSha256,q.reservationRef.sha256)
  assert.equal(reservation.inputSha256,q.inputRef.sha256)
  assert.equal(output.inputSha256,q.inputRef.sha256)
  assert.equal(validation.rawOutputSha256,q.outputRef.sha256)
  assert.deepEqual(proc.proof,terminal.proof)
  assert.equal(proc.proof.bindingBase64,cleanup.bindingBase64)
  assert.equal(cleanup.rootPid,output.pid)
  assert(proc.proof.assignedBeforeResume && proc.proof.killOnJobClose && proc.ownerClosed && proc.guardReleaseConfirmed)
  assert.deepEqual([proc.proof.exitCode,cleanup.activeProcessesAfterCleanup,output.job.maxProcesses],[0,0,1])
  assert(output.job.peakCommittedBytes>0 && output.job.peakCommittedBytes<=budget.resources.maxCommittedMemoryMiB*1048576)
  assert.equal(output.job.cpuAffinityCount,budget.resources.cpuThreadsMaximum)
  assert.equal(request.expectedFileSha256,input.before.fileSha256)
  assert.deepEqual(request.event,event)
  const {eventSha256,...contents}=event
  assert.equal(baselineDigest(contents),eventSha256)
  assert.equal(event.previousEventSha256,input.historyProvenance.maintenanceEventSha256)
  assert.equal(event.evidence.inputRef.sha256,q.inputRef.sha256)
  assert.equal(event.evidence.outputRef.sha256,q.outputRef.sha256)
  assert.equal(receipt.eventSha256,eventSha256)
  assert.equal(receipt.fileSha256,q.afterRecordRef.sha256)
  assert.deepEqual(result.receipt,receipt)
  assert.deepEqual([actual.tick,actual.stateVersion,actual.eventCursor],[1,2,2])
  assert.deepEqual(actual.worldState.payload.environment.evolution.weather.values,output.values)
  assert.equal(q.firstIndependentReaderPid,result.pid)
  assert.equal(new Set([q.firstIndependentReaderPid,q.secondIndependentReaderPid,output.pid]).size,3)
  assert(q.replay.restoredSameFileAndReceipt && q.replay.workerClaimProcessOutputAndReservationBytesUnchanged)
  assert.equal(q.replay.missingIntentRejected.exitCode,1)
  const negative=verifier.get(q.wrongInputRef)
  assert.equal(negative.cases.length,2)
  for (const test of negative.cases) assert(test.rejectedExit!==0 && test.workerLaunched===false)
}

export function verifyFirstWeatherReleaseDomain(root = process.cwd()) {
  const verifier = evidenceReader(root)
  const policyBytes = verifier.read(FIRST_WEATHER_DOMAIN_POLICY_PATH,65536)
  const policySha = baselineSha256(policyBytes)
  assert.equal(policySha,policyDigest,'unqualified first-weather production policy')
  const policy = baselineJson(policyBytes)
  assert.equal(policy.capabilityRef.version,version)
  assert.equal(policy.scopeId,'world_evolution')
  assert.deepEqual(policy.identity,BASELINE_IDENTITY)
  assert.equal(policy.resourceContractRef.id,contractPath)
  assert.equal(policy.resourceContractRef.sha256,budgetDigest)
  const runtimeRef = {path:contractPath,sha256:budgetDigest}
  const budget = verifier.get(runtimeRef)
  assert.equal(budget.version,version)
  assert.deepEqual(budget.identity,policy.identity)
  assert.deepEqual([budget.resources.formalWorldWrites,budget.resources.maintenanceWrites,budget.resources.actualModelForwardsMaximum],[1,0,1])
  const lineage = {}
  for (const key of ['entry','worker','runner','committedReader','sharedForecast']) {
    verifier.bytes(budget[key])
    lineage[key]=budget[key].sha256
  }
  const regression = verifyWeatherRegression(root), trial = verifyCommittedWeatherTrial(root)
  verifyRuntimeConsumer(verifier,budget,trial)
  assert.equal(trial.output.checkpointSha256,regression.modelSha256)
  assert.equal(budget.checkpoint.sha256,regression.modelSha256)
  const dataset = verifyWeatherDatasetRelease(root)
  const policyRef = {path:FIRST_WEATHER_DOMAIN_POLICY_PATH,sha256:policySha}
  const binding = (identity,r) => ({identity,path:r.path,sha256:r.sha256})
  return {bindings:{
    datasetRelease:binding(dataset.datasetReleaseIdentity,dataset.packageRef),
    modelArtifact:binding('sakaerat-weather-model-153',budget.checkpoint),
    reviewContract:binding(version,policyRef),
    runtimeInterfaceContract:binding('sakaerat-first-committed-weather-runtime-v3',runtimeRef),
    conditionContract:binding('sakaerat-committed-weather-conditions',budget.committedReader),
  },releaseEvidence:[policyRef,runtimeRef,trial.resultRef,runtimeTrialRef],programLineage:lineage}
}

// Pre-publication only. The game consumer separately requires a trusted release
// and checks its live Store before running the model or writing any event.
export async function qualifyFirstWeatherCandidate() {
  const root=process.cwd(), verifier=evidenceReader(root)
  const domain=verifyFirstWeatherReleaseDomain(root)
  const {readCommittedWorldWeatherInput}=await import('./world-weather-committed-input.mjs')
  const {advanceCapabilityLifecycle,createCapabilityCandidate}=await import('./ai-painter-capability-lifecycle-v1.mjs')
  const input=await readCommittedWorldWeatherInput('production')
  const trial=verifyCommittedWeatherTrial(root)
  assert.deepEqual(input.identity,trial.input.identity)
  assert.deepEqual(input.history,trial.input.history)
  assert.equal(input.scope,'production')
  assert.notEqual(input.before.fileSha256,trial.input.before.fileSha256)
  assert.deepEqual([input.before.tick,input.before.stateVersion,input.before.eventCursor],[0,1,1])
  assert.equal(input.modelSha256,domain.bindings.modelArtifact.sha256)
  const fixedStageEvidence=[
    ['isolated_implementation',[domain.bindings.runtimeInterfaceContract,domain.bindings.conditionContract]],
    ['cpu_contract_verified',[domain.bindings.runtimeInterfaceContract,runtimeTrialRef]],
    ['controlled_smoke_completed',[trial.resultRef,runtimeTrialRef]],
    ['formal_stage_validation_completed',[domain.bindings.reviewContract,trial.resultRef,runtimeTrialRef]],
    ['independent_regression_completed',[domain.bindings.datasetRelease,domain.bindings.modelArtifact,
      {path:'.runtime/ai-painter/controller-repair-reviews/world-environment-admission-162-20261030/evidence/manifest.json',
        sha256:'20c8d2816641e7e3bd8b8b37b283f5e37f09d59b7a65b5ffe308193adad68b71'}]],
    ['machine_release_adjudicated',domain.releaseEvidence],
  ]
  const spec={schemaVersion:'ai-painter-capability-change-candidate-v1',capabilityVersion:version,
    changeClass:'runtime_interface',ownerAuthorizationRequired:false,ownerInLifecycle:false,
    sourceEvidence:[{path:FIRST_WEATHER_DOMAIN_POLICY_PATH,sha256:policyDigest}]}
  const directory='.runtime/ai-painter/capability-lifecycle/'+version+'/'
  let existing
  try {existing=baselineJson(verifier.read(directory+'candidate.json',65536))}
  catch(error){if(error.code!=='ENOENT')throw error}
  if(existing) assert.deepEqual(existing,spec)
  else createCapabilityCandidate(spec,{root})
  const stages=['change_candidate',...fixedStageEvidence.map(([stage])=>stage)]
  const current=baselineJson(verifier.read(directory+'state.json',65536))
  const index=stages.indexOf(current.state)
  assert(index>=0 && current.sequence===index,'unexpected scope lifecycle or terminal status')
  for(const [targetState,bindings] of fixedStageEvidence.slice(index)){
    advanceCapabilityLifecycle({root,capabilityVersion:version,targetState,evidence:{
      schemaVersion:'ai-painter-capability-stage-evidence-v1',capabilityVersion:version,targetState,status:'passed',
      bindings:bindings.map(({path,sha256})=>({path,sha256})),
    }})
  }
  const {verifyFirstWeatherReleaseLifecycle}=await import('./ai-painter-autonomous-package-decision-core-v3.mjs')
  verifyFirstWeatherReleaseLifecycle(root,['machine_release_adjudicated'])
  return {capabilityVersion:version,scope:'world_evolution',world:input.identity.worldId,
    before:input.before,stage:'machine_release_adjudicated',published:false}
}
