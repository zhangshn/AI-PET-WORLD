import assert from 'node:assert/strict'
import {BASELINE_IDENTITY,baselineDigest,baselineJson,baselineSha256} from './natural-world-baseline-proof.mjs'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {verifyWeatherRegression} from './world-weather-regression.mjs'
import {verifyWeatherDatasetRelease} from './world-weather-dataset-release.mjs'

export const ROLLING_WEATHER_DOMAIN_POLICY_PATH='data/ai-painter/system-governance/mvp-natural-world-weather-policy-v4.json'
export const ROLLING_WEATHER_DOMAIN_BINDING_ROLES=Object.freeze([
  'datasetRelease','modelArtifact','reviewContract','runtimeInterfaceContract','conditionContract',
])
const trialRef={
  path:'.runtime/ai-painter/controller-repair-reviews/world-server-rolling-schedule-190-20261103/qualification-evidence.json',
  sha256:'64c49d65a766051d3f881960d0feeb95a55a128e65b23519f9357572c7d1c458',
}

function readTrialArtifacts(root) {
  const {read}=createEvolutionInputReader(root)
  function bytes(ref) {
    const raw=read(ref.path,ref.bytes??4*1024*1024)
    assert.equal(baselineSha256(raw),ref.sha256,ref.path)
    if(ref.bytes!==undefined)assert.equal(raw.length,ref.bytes,ref.path)
    return raw
  }
  return {bytes,get:ref=>baselineJson(bytes(ref)),json:path=>baselineJson(read(path,2*1024*1024))}
}

export function verifyRollingServerTrial(root=process.cwd()) {
  const {get,bytes}=readTrialArtifacts(root), trial=get(trialRef)
  const budget=get(trial.qualificationBudget),completed=get(trial.completed),terminal=get(trial.serverTerminal)
  assert.deepEqual(budget.identity,BASELINE_IDENTITY)
  assert.deepEqual([budget.maximumNewSteps,budget.maximumModelForwards,budget.formalWrites,budget.automaticModelRetries],[2,2,0,0])
  assert.equal(budget.clock.downtimeMode,'freeze');assert.equal(budget.clock.maxCatchupSteps,0)
  assert.equal(completed.missedDowntimeSteps,0)
  for(const ref of trial.sourceBindings)bytes(ref)
  const launch=get(trial.clientExit.receipt),pid=launch.processId
  assert.equal(launch.detachedFromCodex,true)
  assert.equal(pid,trial.clientExit.serverPid);assert.notEqual(pid,trial.clientExit.clientPid)
  assert.equal(terminal.processId,pid);assert.equal(terminal.exitCode,0)
  assert.deepEqual(trial.startedFrom,completed.startedFrom)
  assert.deepEqual([trial.startedFrom.tick,trial.startedFrom.stateVersion,trial.startedFrom.eventCursor],[1,2,2])
  const initial=get(trial.beforeFormal)
  assert.equal(initial.before.fileSha256,trial.startedFrom.fileSha256)
  let previousEvent=initial.head.eventSha256, previousFile=initial.before.fileSha256
  let history=initial.history, logicalStart=initial.interval.logicalStartUtc
  let earliest=Date.parse(trial.clientExit.checkedUtc)+budget.clock.scheduleIntervalSeconds*1000
  const pids=new Set(),days=[]
  assert.equal(trial.committedCloneTicks.length,2)
  for(const step of trial.committedCloneTicks){
    const input=get(step.inputRef),output=get(step.outputRef),proc=get(step.processRef),cleanup=get(step.cleanup)
    const reservation=get(step.reservation),intent=get(step.intent),receipt=get(step.receiptRef)
    const event=get(step.eventRef),next=get(step.afterRecordRef)
    assert.equal(reservation.serverPid,pid);assert.equal(reservation.inputSha256,step.inputRef.sha256)
    assert(Date.parse(reservation.atUtc)>=earliest,'model day started before it was due')
    // The clock uses time slots relative to launch, not the previous worker completion time.
    earliest=Date.parse(trial.clientExit.checkedUtc)+2*budget.clock.scheduleIntervalSeconds*1000
    assert.deepEqual(input.identity,BASELINE_IDENTITY);assert.equal(input.before.fileSha256,previousFile)
    assert.equal(input.head.eventSha256,previousEvent)
    assert.equal(input.interval.logicalStartUtc,logicalStart);assert.equal(input.interval.durationSeconds,86400)
    assert.deepEqual(input.history,history);assert.equal(input.history.length,7)
    assert.deepEqual(input.rows.map(row=>row.values),history)
    const packed=Buffer.alloc(224)
    history.forEach((row,i)=>{assert.equal(row.length,4);row.forEach((v,j)=>{assert(Number.isFinite(v));packed.writeDoubleLE(v,(i*4+j)*8)})})
    assert.equal(baselineSha256(packed),output.historyValueSha256)
    assert.equal(output.inputSha256,step.inputRef.sha256);assert.equal(output.checkpointSha256,input.modelSha256)
    assert.deepEqual([output.modelForwards,output.trainingUpdates],[1,0])
    assert.equal(output.pid,proc.proof.rootPid);assert.equal(output.pid,cleanup.rootPid);pids.add(output.pid)
    assert.equal(cleanup.bindingBase64,proc.proof.bindingBase64)
    assert(proc.proof.assignedBeforeResume && proc.proof.killOnJobClose && proc.ownerClosed && proc.cleanupConfirmed && proc.guardReleaseConfirmed)
    assert.deepEqual([proc.proof.exitCode,cleanup.activeProcessesAfterCleanup,output.job.maxProcesses],[0,0,1])
    assert.equal(output.job.cpuAffinityCount,budget.workerLimits.cpuThreadsMaximum)
    assert(output.job.peakCommittedBytes>0 && output.job.peakCommittedBytes<=budget.workerLimits.maxCommittedMemoryMiB*1048576)
    assert.equal(intent.input.sha256,step.inputRef.sha256);assert.equal(intent.output.sha256,step.outputRef.sha256)
    const {eventSha256,...body}=event
    assert.equal(baselineDigest(body),eventSha256);assert.equal(eventSha256,receipt.eventSha256)
    assert.equal(event.previousEventSha256,previousEvent);assert.equal(receipt.fileSha256,step.afterRecordRef.sha256)
    assert.equal(next.tick,input.before.tick+1);assert.equal(next.eventCursor,input.before.eventCursor+1)
    assert.equal(next.stateVersion,input.before.stateVersion+1)
    assert.deepEqual(next.worldState.payload.environment.evolution.weather.values,output.values)
    days.push({tick:next.tick,eventSha256,output:output.values})
    previousEvent=eventSha256;previousFile=receipt.fileSha256
    logicalStart=input.interval.logicalEndUtc;history=[...history.slice(1),output.values]
  }
  assert.equal(pids.size,2);assert.equal(previousFile,completed.final.fileSha256)
  assert.deepEqual(completed.final,trial.recoveredClone)
  for(const probe of trial.exhaustionProbes){
    assert.equal(probe.result.cursor.fileSha256,previousFile)
    assert(probe.result.status==='step_budget_exhausted'||probe.result.stepBudgetExhausted===true)
  }
  return {trialRef,scope:trial.scope,anchor:initial.before,days,productionAdmitted:false}
}

const version='sakaerat-weather-153-rolling-v4'
const policyRef={path:ROLLING_WEATHER_DOMAIN_POLICY_PATH,sha256:'df425fd6d1fd6c47f3cb3cdb5bf92d90f7e5bbfc3ce97f9ca951c49fa4ecac1e'}
const budgetRef={path:'data/ai-painter/system-governance/sakaerat-rolling-weather-runtime-v4.json',sha256:'32f0194571efa79763213ad7da9182bfd37615187aec28b75e965bc3bd8ba78c'}
const consumerRoot='.runtime/ai-painter/controller-repair-reviews/world-rolling-runtime-193-20261103/qualification/'
const consumerRef={path:consumerRoot+'completed-1.json',sha256:'40b18241d21ae2f113575b7d72f179a60d278cd1bfe961c28e025dd9ddd88d3c'}
const consumerVerification={path:'.runtime/ai-painter/controller-repair-reviews/world-rolling-runtime-193-20261103/qualification-evidence.json',sha256:'3bb5a1971fc368c81346679e6e51d4048de50c92496d9ee6c453608befcbe2c7'}

// Check the actual normal server/worker against the earlier numerical and scheduling trial.
// The public release reader calls this after the live world has already advanced too.
function verifyRollingConsumerTrial(reader,budget,trial) {
  const handled=reader.get(consumerRef),qualification=reader.get(handled.budget)
  const independent=reader.get(consumerVerification)
  assert.equal(independent.normalEntrySha256,budget.entry.sha256)
  assert.equal(independent.resultRef.sha256,consumerRef.sha256)
  assert.deepEqual([independent.totalActivations,independent.slotsUsed,independent.forwardCalls,independent.formalWorldWrites],[1,2,2,0])
  assert.equal(independent.durableSlotsAndWorkerArtifactsUnchangedAfterRestart,true)
  const expected={...budget,formalWritesMaximum:0,policyPath:consumerRoot+'policy.json'}
  assert.deepEqual(qualification,expected)
  assert.equal(handled.steps.length,2)
  assert.deepEqual(handled.start,trial.anchor)
  assert.equal(handled.workerRetries,0);assert.equal(handled.offlineCatchupSteps,0)
  const exit=handled.exit,launch=reader.get(exit.receipt)
  assert.equal(launch.processId,exit.serverPid);assert.notEqual(exit.clientPid,exit.serverPid)
  assert.equal(launch.detachedFromCodex,true)
  const terminal=reader.json(consumerRoot+'launches/weather-rolling-v4-qualification-1/background-process-terminal.json')
  assert.equal(terminal.processId,exit.serverPid);assert.equal(terminal.exitCode,0)
  let previousFile=trial.anchor.fileSha256,previousEvent=budget.anchor.eventSha256
  const processes=new Set()
  for(const [index,step] of handled.steps.entries()){
    const tick=index+2,dir=consumerRoot+'steps/'+tick+'/'
    const input=reader.get(step.input),output=reader.get(step.output),proc=reader.get(step.process)
    const reservation=reader.json(dir+'reservation.json'),claim=reader.json(dir+'worker-claim.json'),intent=reader.json(dir+'intent.json')
    assert.equal(reservation.serverPid,exit.serverPid)
    assert(Date.parse(reservation.atUtc)-Date.parse(exit.atUtc)>=(index+1)*budget.clock.scheduleIntervalSeconds*1000)
    assert.equal(input.before.fileSha256,previousFile);assert.deepEqual(input.identity,budget.identity)
    assert.equal(input.head.eventSha256,previousEvent);assert.equal(input.historyValueSha256,output.historyValueSha256)
    assert.equal(claim.inputSha256,step.input.sha256);assert.equal(output.inputSha256,step.input.sha256)
    assert.equal(claim.pid,output.pid);assert.equal(proc.proof.rootPid,output.pid)
    assert.equal(output.checkpointSha256,budget.model.sha256)
    assert.deepEqual(output.values,trial.days[index].output)
    assert.deepEqual([output.modelForwards,output.trainingUpdates,proc.proof.exitCode],[1,0,0])
    assert(proc.cleanupConfirmed && proc.ownerClosed && proc.proof.killOnJobClose && proc.proof.assignedBeforeResume)
    assert.match(proc.guard.identity,/^[a-f0-9-]{36}$/)
    const cleanup=reader.json('.runtime/ai-painter/owned-worker-guards/'+proc.guard.identity+'-native/cleanup-observation.json')
    assert.equal(cleanup.bindingBase64,proc.proof.bindingBase64)
    assert.equal(cleanup.activeProcessesAfterCleanup,0);assert.equal(cleanup.rootPid,claim.pid)
    assert.equal(output.job.cpuAffinityCount,budget.workerLimits.cpuThreadsMaximum)
    assert.equal(output.job.maxProcesses,1)
    assert(output.job.peakCommittedBytes>0 && output.job.peakCommittedBytes<=budget.workerLimits.maxCommittedMemoryMiB*1048576)
    assert.equal(intent.output.sha256,step.output.sha256)
    const request=reader.get(intent.request),event=request.event
    const {eventSha256,...body}=event;assert.equal(baselineDigest(body),eventSha256)
    assert.equal(event.previousEventSha256,previousEvent)
    const receipt=reader.json(dir+'receipt.json');assert.deepEqual(receipt,step.receipt)
    const eventPath=consumerRoot+'store/'+input.identity.ownerId+'/'+input.identity.worldId+'.json.evolution/'+receipt.businessKey+'.'
    assert.deepEqual(reader.json(eventPath+eventSha256+'.event.json'),event)
    const record=reader.get({path:eventPath+receipt.fileSha256+'.record.json',sha256:receipt.fileSha256})
    assert.deepEqual([record.tick,record.stateVersion,record.eventCursor],[tick,tick+1,tick+1])
    assert.deepEqual(record.worldState.payload.environment.evolution.weather.values,output.values)
    assert.equal(receipt.eventSha256,eventSha256);processes.add(output.pid)
    previousFile=receipt.fileSha256;previousEvent=eventSha256
  }
  assert.equal(processes.size,2)
  assert.equal(handled.readback.before.fileSha256,previousFile)
  assert.deepEqual(handled.readback.usage,{reserved:2,committed:2,remainingModelSlots:0,unresolved:false,exhausted:true})
}

export function verifyRollingWeatherReleaseDomain(root=process.cwd()) {
  const reader=readTrialArtifacts(root),policy=reader.get(policyRef),budget=reader.get(budgetRef)
  assert.equal(policy.capabilityRef.version,version)
  assert.equal(policy.scopeId,'world_evolution')
  assert.deepEqual(policy.identity,BASELINE_IDENTITY);assert.deepEqual(budget.identity,policy.identity)
  assert.equal(budget.version,version);assert.equal(budget.policyPath,policyRef.path)
  assert.equal(policy.resourceContractRef.sha256,budgetRef.sha256)
  assert.deepEqual([budget.maximumModelForwards,budget.maximumNewSteps,budget.maximumServerActivations,budget.formalWritesMaximum,budget.automaticModelRetries],[2,2,2,2,0])
  const trial=verifyRollingServerTrial(root)
  verifyRollingConsumerTrial(reader,budget,trial)
  const regression=verifyWeatherRegression(root),dataset=verifyWeatherDatasetRelease(root)
  assert.equal(regression.modelSha256,budget.model.sha256);assert.equal(dataset.checkpointSha256,budget.model.sha256)
  const lineage={}
  for(const role of ['runner','entry','worker','rollingInput','sharedForecast']){
    reader.bytes(budget[role]);lineage[role]=budget[role].sha256
  }
  const binding=(identity,r)=>({identity,path:r.path,sha256:r.sha256})
  return {bindings:{
    datasetRelease:binding(dataset.datasetReleaseIdentity,dataset.packageRef),
    modelArtifact:binding('sakaerat-weather-model-153',budget.model),
    reviewContract:binding(version,policyRef),
    runtimeInterfaceContract:binding('sakaerat-rolling-weather-runtime-v4',budgetRef),
    conditionContract:binding('sakaerat-rolling-history-input',budget.rollingInput),
  },releaseEvidence:[policyRef,budgetRef,trialRef,consumerRef,consumerVerification],programLineage:lineage}
}

export async function qualifyRollingWeatherCandidate() {
  const root=process.cwd(),domain=verifyRollingWeatherReleaseDomain(root),reader=readTrialArtifacts(root)
  const directory='.runtime/ai-painter/capability-lifecycle/'+version+'/'
  const core=await import('./ai-painter-autonomous-package-decision-core-v3.mjs')
  const spec={schemaVersion:'ai-painter-capability-change-candidate-v1',capabilityVersion:version,
    changeClass:'runtime_interface',ownerAuthorizationRequired:false,ownerInLifecycle:false,sourceEvidence:[policyRef]}
  let state
  try{assert.deepEqual(reader.json(directory+'candidate.json'),spec);state=reader.json(directory+'state.json')}
  catch(error){if(error.code!=='ENOENT')throw error}
  if(state?.state==='released'){
    const result=core.loadAndValidateReleasedCapabilityBinding({
      projectRoot:root,trustedReleaseRegistryPath:core.TRUSTED_RELEASE_REGISTRY_PATH,
      requiredCapabilityScope:'world_evolution',capabilityReleasePath:'data/ai-painter/capability-releases/'+version+'/release.json',
    })
    return {capabilityVersion:version,state:'released',releaseSha256:result.capabilityReleaseSha256}
  }
  const {readWorldRollingWeatherInput}=await import('./world-rolling-weather-input.mjs')
  const live=await readWorldRollingWeatherInput('production'),budget=reader.get(budgetRef)
  assert.equal(live.before.fileSha256,budget.anchor.fileSha256)
  assert.equal(live.head.eventSha256,budget.anchor.eventSha256)
  assert.equal(live.historyValueSha256,budget.anchor.historyValueSha256)
  const {createCapabilityCandidate,advanceCapabilityLifecycle}=await import('./ai-painter-capability-lifecycle-v1.mjs')
  if(!state){createCapabilityCandidate(spec,{root});state=reader.json(directory+'state.json')}
  const stages=[
    ['isolated_implementation',[budgetRef,domain.bindings.conditionContract]],
    ['cpu_contract_verified',[budgetRef,consumerVerification]],
    ['controlled_smoke_completed',[trialRef,consumerRef]],
    ['formal_stage_validation_completed',[policyRef,consumerRef,consumerVerification]],
    ['independent_regression_completed',[domain.bindings.datasetRelease,domain.bindings.modelArtifact,trialRef,consumerVerification]],
    ['machine_release_adjudicated',domain.releaseEvidence],
  ]
  const index=['change_candidate',...stages.map(s=>s[0])].indexOf(state.state)
  assert(index>=0 && state.sequence===index,'unknown rolling candidate state')
  for(const [targetState,refs] of stages.slice(index)){
    advanceCapabilityLifecycle({root,capabilityVersion:version,targetState,evidence:{
      schemaVersion:'ai-painter-capability-stage-evidence-v1',capabilityVersion:version,targetState,status:'passed',
      bindings:refs.map(({path,sha256})=>({path,sha256})),
    }})
  }
  core.verifyScopedWeatherReleaseLifecycle(root,version,['machine_release_adjudicated'])
  return {capabilityVersion:version,state:'machine_release_adjudicated',before:live.before,published:false}
}
