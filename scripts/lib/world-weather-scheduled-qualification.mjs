import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {BASELINE_IDENTITY,baselineDigest,baselineJson,baselineSha256} from './natural-world-baseline-proof.mjs'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {verifyWeatherDatasetRelease} from './world-weather-dataset-release.mjs'
import {verifyWeatherRegression} from './world-weather-regression.mjs'

export const SCHEDULED_WEATHER_DOMAIN_POLICY_PATH='data/ai-painter/system-governance/mvp-natural-world-weather-policy-v5.json'
export const SCHEDULED_WEATHER_DOMAIN_BINDING_ROLES=Object.freeze(['datasetRelease','modelArtifact','reviewContract','runtimeInterfaceContract','conditionContract'])
const version='sakaerat-weather-153-scheduled-v5'
const policyRef={path:SCHEDULED_WEATHER_DOMAIN_POLICY_PATH,sha256:'cbc5c8ced8f734fb58590f07de469412d52d4bcfc5dc0d30bc9731cef6265300'}
const budgetRef={path:'data/ai-painter/system-governance/sakaerat-scheduled-weather-runtime-v5.json',sha256:'06ca46513e23e188288630f55a59b6eb267386126dd6434b022ac8e6d92a625c'}
const base='.runtime/ai-painter/controller-repair-reviews/world-service-scheduled-runtime-210-20261103',q=base+'/qualification'
const trialRef={path:base+'/qualification-evidence.json',sha256:'9d06f9bfc9bc2522b039d3f36817ef179607bd11f517b3ec6bd1f54e5ba2aeb6'}
const originRef={path:'.runtime/ai-painter/controller-repair-reviews/world-service-lease-206-20261103/current-readonly-input.json',sha256:'0a0e5116a20a02c260cbf8c44e2b2deab7c6c4650ac7e5b7d28479813aed0928'}
const roles=['entry','runner','worker','sharedForecast','historyReader','leaseLedger']
const fieldOrder=['PRECTOTCORR','RH2M','T2M','WS2M']
const ref=(r)=>({id:r.path,version,sha256:r.sha256})
function reader(root){
  const {read}=createEvolutionInputReader(root)
  const bytes=r=>{const v=read(r.path,4*1024*1024);assert.equal(baselineSha256(v),r.sha256,r.path);if(r.bytes!==undefined)assert.equal(v.length,r.bytes);return v}
  return {bytes,get:r=>baselineJson(bytes(r)),json:p=>baselineJson(read(p,2*1024*1024)),read}
}
function inputValueSha(rows){
  assert.equal(rows.length,7);const values=Buffer.alloc(224)
  for(const [i,row] of rows.entries()){
    assert.equal(row.length,4)
    for(const [j,n] of row.entries()){assert(Number.isFinite(n));values.writeDoubleLE(n,(i*4+j)*8)}
  }
  return baselineSha256(values)
}
function normalizePolicy(p,b){
  const {contentSha256,...body}=p;assert.equal(baselineDigest(body),contentSha256)
  const normalized={...body}
  for(const k of ['resourceContractRef','capabilityRef','executionPolicyRef']){
    assert.deepEqual(body[k],ref(b));delete normalized[k]
  }
  return normalized
}
function compareContracts(r,t,formal,policy){
  assert.equal(t.qualification.budget.path,q+'/budget.json');assert.equal(t.qualification.policy.path,q+'/policy.json')
  const small=r.get(t.qualification.budget),isolatedPolicy=r.get(t.qualification.policy)
  assert.deepEqual(formal,{...small,policyPath:policyRef.path,maximumNewSteps:27,maximumBatchIssues:14,
    maximumActivations:14,maximumSupervisedWindowSeconds:1800,formalWritesMaximum:27})
  assert.deepEqual(normalizePolicy(policy,budgetRef),normalizePolicy(isolatedPolicy,t.qualification.budget))
  assert.deepEqual(formal.identity,BASELINE_IDENTITY);assert.deepEqual(policy.identity,BASELINE_IDENTITY)
  assert.deepEqual([small.maximumNewSteps,small.batchSize,small.maximumBatchIssues,small.maximumActivations,
    small.maximumStepsPerActivation,small.maximumSupervisedWindowSeconds,small.formalWritesMaximum],[3,2,6,2,2,180,0])
  assert.equal(formal.version,version);assert.equal(formal.requiredCapabilityScope,'world_evolution')
  assert.equal(formal.validatedForecastDays,30);assert.equal(formal.originalCutoffUtc,'2020-01-08T00:00:00.000Z')
  assert.equal(formal.maximumNewSteps+formal.origin.tick,formal.validatedForecastDays)
  assert.deepEqual([formal.maximumConcurrentWorkers,formal.automaticModelRetries,formal.clock.scheduleIntervalSeconds,formal.clock.maxCatchupSteps,
    formal.clock.downtimeMode],[1,0,15,0,'freeze'])
  const original=r.get(formal.sourceBudget)
  assert.deepEqual(formal.workerLimits,original.resources);assert.deepEqual(formal.clock,original.timePolicy)
  assert.deepEqual(formal.model,original.checkpoint);assert.deepEqual(formal.interpreter,original.interpreter)
  assert.equal(formal.workerLimits.gpu,false);assert.equal(formal.workerLimits.trainingUpdates,0)
  for(const role of ['supervisor','nativeOwner','nativeBuilder','worker'])r.bytes(original[role])
  assert.deepEqual(policy.inputSchemaRef,ref(formal.historyReader));assert.equal(policy.scopeId,'world_evolution')
  r.bytes(formal.qualification);return original
}
function verifyServers(r,t,cfg){
  assert.equal(t.stages.length,2)
  const stages=t.stages.map((stage,i)=>{
    const n=i+1,dir=q+'/launches/scheduled-weather-v5-qualification-'+n
    for(const [role,p] of Object.entries({activation:q+'/activation-'+n+'.json',session:q+'/session-'+n+'.json',
      launch:dir+'/launch-receipt.json',terminal:dir+'/background-process-terminal.json'}))assert.equal(stage[role].path,p)
    const act=r.get(stage.activation),s=r.get(stage.session),launch=r.get(stage.launch),term=r.get(stage.terminal)
    assert.equal(launch.runnerPath,cfg.entry.path);assert.equal(launch.runnerSha256,cfg.entry.sha256)
    assert.deepEqual(launch.runnerArgs,['--qualify-serve',String(n)]);assert.equal(launch.detachedFromCodex,true)
    assert.equal(launch.launchIdentity,'scheduled-weather-v5-qualification-'+n);r.bytes(launch.spawnAttempt)
    assert.equal(term.launchIdentity,launch.launchIdentity);assert.equal(term.processId,launch.processId);assert.equal(term.exitCode,0)
    assert.equal(term.processStartIdentity,launch.processStartIdentity);assert.equal(term.status,'runner_process_exited')
    assert.equal(term.commandIdentitySha256,launch.commandIdentitySha256);assert.equal(term.spawnAttemptSha256,launch.spawnAttempt.sha256)
    assert.equal(s.parent.serverPid,launch.processId);assert.equal(s.parent.launcherPid,act.launcherPid)
    assert.equal(s.parent.launcherExited,true);assert.deepEqual(s.parent.launchReceipt,stage.launch);assert.equal(s.recoveredOfflineTicks,0)
    assert.notEqual(act.launcherPid,launch.processId);return {act,s,launch,term}
  })
  const [a,b]=stages;assert.equal(a.act.kind,'initial_detach');assert.equal(b.act.kind,'automatic_checkpoint_handoff')
  assert.equal(b.act.launcherPid,a.launch.processId);assert.notEqual(a.launch.processId,b.launch.processId)
  assert(Date.parse(b.s.parent.verifiedUtc)>=Date.parse(a.term.recordedAtUtc))
  const check=r.get(t.interruption.checkpoint),handoff=r.get(t.interruption.handoff),done=r.get(t.completion)
  assert.equal(t.interruption.checkpoint.path,q+'/checkpoint-1.json');assert.equal(t.completion.path,q+'/completed-2.json')
  assert.equal(handoff.next.serverPid,b.launch.processId);assert.deepEqual(handoff.handoff,t.interruption.checkpoint)
  assert.equal(check.status,'store_committed_pending_accounting');assert.equal(check.head.tick,5)
  assert.deepEqual([check.pending.committedTick,check.pending.chargedModelStartSlots,check.pending.outstanding.tick,check.pending.remainingModelStarts],[4,2,5,1])
  assert.deepEqual([b.s.restored.committedTick,b.s.restored.chargedModelStartSlots,b.s.restored.remainingModelStarts,b.s.restored.outstanding],[5,2,1,null])
  assert.deepEqual(b.s.checkpointRecovery.after,check.head);assert.deepEqual(check.head,b.s.startingWorld)
  assert.deepEqual(done.recovered.before,done.after);assert.notEqual(done.recovered.pid,b.launch.processId)
  assert.equal(done.status,'cumulative_lifetime_exhausted')
  return stages
}
function verifyLedger(root,r,t){
  const rel=q+'/accounting/accounting.sqlite';r.read(rel,1024*1024)
  const db=new DatabaseSync(path.resolve(fs.realpathSync(path.join(root,'.runtime')),rel.slice(9)),{readOnly:true})
  try{
    assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok')
    const ledger=db.prepare('SELECT * FROM service WHERE id=1').get(),slots=db.prepare('SELECT * FROM slots ORDER BY target_tick').all()
    const batches=db.prepare('SELECT seq,batch_id,first_tick,last_tick FROM batches ORDER BY seq').all().map(row=>({...row}))
    assert.deepEqual(batches,t.batches);assert.deepEqual(batches.map(x=>[x.first_tick,x.last_tick]),[[4,5],[6,6]])
    assert.equal(slots.length,3);assert.equal(ledger.tick,6)
    assert.equal(t.repeatAdmission.status,'lifetime_exhausted')
    assert.deepEqual(t.repeatAdmission.usage,t.finalRead.usage);assert.equal(t.repeatAdmission.usage.remainingModelStarts,0)
    assert.equal(t.repeatAdmission.usage.remainingAuthorizedDays,0);assert.equal(t.repeatAdmission.usage.chargedModelStartSlots,slots.length)
    assert.equal(t.repeatAdmission.usage.batchesIssued,batches.length);assert.equal(t.repeatAdmission.usage.outstanding,null)
    return {ledger,slots,batches}
  }finally{db.close()}
}
function verifyStep(r,cfg,t,original,stages,slot,step,inputRows,file,event,batch){
  const tick=slot.target_tick,dir=q+'/steps/'+tick,stage=stages[tick===6?1:0]
  const names={inputRef:'input',outputRef:'output',requestRef:'request',receiptRef:'receipt',reservationRef:'reservation',processRef:'process'}
  for(const [role,name] of Object.entries(names))assert.equal(step[role].path,dir+'/'+name+'.json')
  const input=r.get(step.inputRef),out=r.get(step.outputRef),proc=r.get(step.processRef),reservation=r.get(step.reservationRef)
  const req=r.get(step.requestRef),e=req.event,receipt=r.get(step.receiptRef),claim=r.json(dir+'/worker-claim.json')
  assert.equal(input.scope,'qualification');assert.deepEqual(input.identity,cfg.identity);assert.deepEqual(input.fieldOrder,fieldOrder)
  assert.equal(input.before.fileSha256,file);assert.equal(input.head.eventSha256,event);assert.equal(input.before.tick,tick-1)
  assert.deepEqual(input.history,inputRows);assert.equal(input.historyValueSha256,inputValueSha(inputRows))
  assert.equal(input.modelSha256,cfg.model.sha256);assert.equal(input.originalCutoffUtc,cfg.originalCutoffUtc)
  assert.deepEqual(input.rows.map(x=>x.values),inputRows)
  assert.equal(Date.parse(input.interval.logicalStartUtc),Date.parse(cfg.originalCutoffUtc)+(tick-1)*86400000)
  assert.equal(Date.parse(input.interval.logicalEndUtc),Date.parse(cfg.originalCutoffUtc)+tick*86400000)
  assert.equal(input.interval.durationSeconds,86400)
  assert.equal(reservation.slotToken,slot.token);assert.equal(slot.status,'committed');assert.equal(reservation.batchId,batch.batch_id)
  assert.equal(slot.batch_id,batch.batch_id);assert.equal(slot.before_file,file);assert.equal(slot.before_event,event)
  assert.equal(reservation.serverPid,stage.launch.processId);assert.equal(reservation.scope,'qualification')
  if(tick===4||tick===6)assert(Date.parse(reservation.atUtc)-Date.parse(stage.s.monotonicAnchorUtc)>=14950)
  assert.equal(reservation.budget.sha256,t.qualification.budget.sha256);assert.equal(slot.input_sha,step.inputRef.sha256)
  assert.equal(slot.history_sha,input.historyValueSha256);assert.equal(reservation.inputSha256,step.inputRef.sha256)
  assert.equal(claim.reservationSha256,step.reservationRef.sha256);assert.equal(claim.inputSha256,out.inputSha256)
  assert.equal(claim.pid,out.pid);assert.equal(out.pid,proc.proof.rootPid);assert.equal(proc.proof.exitCode,0)
  assert.equal(out.modelForwards,1);assert.equal(out.trainingUpdates,0);assert.equal(out.checkpointSha256,cfg.model.sha256)
  assert.equal(out.inputSha256,step.inputRef.sha256);assert.equal(out.historyValueSha256,input.historyValueSha256)
  assert.deepEqual([out.job.cpuAffinityCount,out.job.maxProcesses,out.job.maxCommittedBytes],[2,1,1536*1048576])
  assert(out.job.peakCommittedBytes>0&&out.job.peakCommittedBytes<=out.job.maxCommittedBytes)
  assert(proc.proof.assignedBeforeResume&&proc.proof.killOnJobClose&&proc.guardReleaseConfirmed&&proc.ownerClosed&&proc.liveOwnerCleanupConfirmed&&proc.cleanupConfirmed)
  assert.equal(proc.proof.activeProcessesAfterCleanup,0);assert.equal(proc.proof.ownerPid,proc.ownerIdentity.pid)
  assert.equal(step.cleanupRef.path,'.runtime/ai-painter/owned-worker-guards/'+proc.guard.identity+'-native/cleanup-observation.json')
  const cleanup=r.get(step.cleanupRef);assert.equal(cleanup.bindingBase64,proc.proof.bindingBase64)
  assert.equal(cleanup.rootPid,claim.pid);assert.equal(cleanup.activeProcessesAfterCleanup,0);assert.equal(cleanup.ownerPid,proc.ownerIdentity.pid)
  const native=baselineJson(Buffer.from(proc.proof.bindingBase64,'base64'))
  assert.equal(native.guard.runnerPid,stage.launch.processId);assert.equal(native.guard.identity,proc.guard.identity)
  assert.equal(native.guard.helperSha256,original.supervisor.sha256);assert.equal(native.guard.nativeOwnerSource.sha256,original.nativeOwner.sha256)
  const runtime=r.get(cfg.interpreter)
  assert.equal(native.guard.executableSha256,runtime.directInterpreter.sha256)
  const command=[...runtime.args,path.win32.join(native.scope,cfg.worker.path),'qualification',String(tick),step.reservationRef.sha256,step.inputRef.sha256]
  assert.equal(native.guard.commandSha256,baselineSha256(Buffer.from(JSON.stringify(command))))
  const {eventSha256,...eventBody}=e;assert.equal(baselineDigest(eventBody),eventSha256);assert.equal(eventSha256,receipt.eventSha256)
  assert.equal(e.previousEventSha256,event);assert.equal(req.expectedFileSha256,file);assert.equal(e.before.expectedFileSha256,file)
  assert.deepEqual(e.evidence.inputRef,ref(step.inputRef));assert.deepEqual(e.evidence.outputRef,ref(step.outputRef))
  assert.deepEqual(e.policyRef,ref(t.qualification.policy));assert.deepEqual(e.evidence.capabilityRef,ref(t.qualification.budget))
  assert.deepEqual(e.interval,input.interval);assert.deepEqual(e.identity,cfg.identity);assert.deepEqual(receipt.identity,cfg.identity)
  assert.deepEqual([receipt.tick,receipt.stateVersion,receipt.eventCursor],[tick,tick+1,tick+1]);assert.equal(slot.commit_event,e.eventSha256)
  assert.deepEqual(e.reasonRefs,[step.outputRef.sha256,step.inputRef.sha256,step.processRef.sha256])
  const rules=r.get(t.qualification.policy)
  assert.deepEqual(e.evidence.validatorRef,rules.validatorRef);assert.deepEqual(e.evidence.modelRef,rules.modelRef)
  const changes=rules.domainFields.flatMap((f,i)=>{
    assert.equal(f.fieldId,'environment.'+fieldOrder[i]);assert.equal(f.unit,input.units[i]);assert(f.allowedOps.includes('replace'))
    const value=out.values[i];assert(Number.isFinite(value)&&value>=f.constraints.min&&value<=f.constraints.max)
    return value===inputRows.at(-1)[i]?[]:[{fieldId:f.fieldId,operation:'replace',beforeValueSha256:baselineDigest(inputRows.at(-1)[i]),newValue:value,reasonRefs:[step.outputRef.sha256]}]
  })
  assert.deepEqual(e.changes,changes)
  const store=q+'/store/'+cfg.identity.ownerId+'/'+cfg.identity.worldId+'.json.evolution/'+receipt.businessKey
  assert.deepEqual(r.json(store+'.receipt.json'),receipt);assert.deepEqual(r.json(store+'.'+eventSha256+'.event.json'),e)
  const before=r.get({path:store+'.'+file+'.before.json',sha256:file}),after=r.get({path:store+'.'+receipt.fileSha256+'.record.json',sha256:receipt.fileSha256})
  assert.deepEqual(before.worldState.payload.environment.evolution.weather.values,inputRows.at(-1))
  assert.deepEqual(after.worldState.payload.environment.evolution.weather.values,out.values);assert.deepEqual(out.values,step.values)
  assert.deepEqual(after.worldFacts.payload,before.worldFacts.payload);assert.deepEqual(after.randomState,before.randomState)
  assert.equal(receipt.fileSha256,slot.commit_file);assert.equal(e.toTick,tick);assert.equal(e.fromTick,tick-1)
  return {file:receipt.fileSha256,event:eventSha256,rows:[...inputRows.slice(1),out.values],pid:out.pid}
}

export function verifyScheduledWeatherReleaseDomain(root=process.cwd()){
  const r=reader(root),policy=r.get(policyRef),cfg=r.get(budgetRef),t=r.get(trialRef),anchor=r.get(originRef)
  const original=compareContracts(r,t,cfg,policy),stages=verifyServers(r,t,cfg),{slots,batches,ledger}=verifyLedger(root,r,t)
  const initial=r.json(q+'/initial-input.json');assert.deepEqual({...initial,scope:'production'},anchor)
  assert.deepEqual(t.formalWorld,anchor.before);assert.deepEqual(anchor.identity,BASELINE_IDENTITY)
  assert.deepEqual(cfg.origin,{tick:3,stateVersion:4,eventCursor:4,fileSha256:anchor.before.fileSha256,...anchor.head,historyValueSha256:anchor.historyValueSha256})
  assert.equal(t.steps.length,3)
  let cursor={file:anchor.before.fileSha256,event:anchor.head.eventSha256,rows:anchor.history}
  const workers=new Set()
  for(const [i,slot] of slots.entries()){
    assert.equal(slot.target_tick,i+4)
    cursor=verifyStep(r,cfg,t,original,stages,slot,t.steps[i],cursor.rows,cursor.file,cursor.event,batches[i===2?1:0])
    workers.add(cursor.pid)
  }
  assert.equal(workers.size,3);assert.equal(ledger.file_sha,cursor.file);assert.equal(ledger.event_sha,cursor.event)
  assert.equal(ledger.history_sha,inputValueSha(cursor.rows));assert.equal(t.finalRead.before.fileSha256,cursor.file)
  const dataset=verifyWeatherDatasetRelease(root),regression=verifyWeatherRegression(root)
  assert.equal(dataset.checkpointSha256,cfg.model.sha256);assert.equal(regression.modelSha256,cfg.model.sha256)
  const lineage={}
  for(const role of roles){r.bytes(cfg[role]);lineage[role]=cfg[role].sha256}
  const bind=(identity,r)=>({identity,path:r.path,sha256:r.sha256})
  return {bindings:{datasetRelease:bind(dataset.datasetReleaseIdentity,dataset.packageRef),modelArtifact:bind('sakaerat-weather-model-153',cfg.model),
    reviewContract:bind(version,policyRef),runtimeInterfaceContract:bind('sakaerat-scheduled-weather-runtime-v5',budgetRef),
    conditionContract:bind('sakaerat-scheduled-weather-history',cfg.historyReader)},programLineage:lineage,
    releaseEvidence:[policyRef,budgetRef,originRef,trialRef,t.completion,t.interruption.checkpoint].map(({path,sha256})=>({path,sha256}))}
}

// Preparation advances the existing machine lifecycle only. The normal publisher owns release/registry.
export async function qualifyScheduledWeatherCandidate(...args){
  assert.equal(args.length,0,'fixed scheduled weather candidate accepts no overrides')
  const root=process.cwd(),domain=verifyScheduledWeatherReleaseDomain(root),r=reader(root)
  const core=await import('./ai-painter-autonomous-package-decision-core-v3.mjs')
  const directory='.runtime/ai-painter/capability-lifecycle/'+version+'/'
  const spec={schemaVersion:'ai-painter-capability-change-candidate-v1',capabilityVersion:version,
    changeClass:'runtime_interface',ownerAuthorizationRequired:false,ownerInLifecycle:false,sourceEvidence:[policyRef]}
  let state
  try{assert.deepEqual(r.json(directory+'candidate.json'),spec);state=r.json(directory+'state.json')}
  catch(error){if(error.code!=='ENOENT')throw error}
  if(state?.state==='released'){
    const actual=core.loadAndValidateReleasedCapabilityBinding({projectRoot:root,trustedReleaseRegistryPath:core.TRUSTED_RELEASE_REGISTRY_PATH,
      capabilityReleasePath:core.SCHEDULED_WEATHER_RELEASE_PATH,requiredCapabilityScope:'world_evolution'})
    return {capabilityVersion:version,state:'released',releaseSha256:actual.capabilityReleaseSha256}
  }
  const {readScheduledWeatherHistory}=await import('./world-weather-scheduled-history.mjs')
  const live=await readScheduledWeatherHistory(),before=r.get(originRef)
  assert.deepEqual(live,before,'candidate enrollment does not match the original world')
  const {createCapabilityCandidate,advanceCapabilityLifecycle}=await import('./ai-painter-capability-lifecycle-v1.mjs')
  if(!state){createCapabilityCandidate(spec,{root});state=r.json(directory+'state.json')}
  const trial=r.get(trialRef),stages=[
    ['isolated_implementation',[budgetRef,domain.bindings.conditionContract]],
    ['cpu_contract_verified',[budgetRef,trial.tests,originRef]],
    ['controlled_smoke_completed',[trialRef,trial.completion]],
    ['formal_stage_validation_completed',[policyRef,trialRef,trial.interruption.checkpoint]],
    ['independent_regression_completed',[domain.bindings.datasetRelease,domain.bindings.modelArtifact,trialRef]],
    ['machine_release_adjudicated',domain.releaseEvidence],
  ]
  const i=['change_candidate',...stages.map(row=>row[0])].indexOf(state.state)
  assert(i>=0&&state.sequence===i,'unknown scheduled weather lifecycle state')
  for(const [targetState,refs] of stages.slice(i)){
    advanceCapabilityLifecycle({root,capabilityVersion:version,targetState,evidence:{schemaVersion:'ai-painter-capability-stage-evidence-v1',
      capabilityVersion:version,targetState,status:'passed',bindings:refs.map(({path,sha256})=>({path,sha256}))}})
  }
  core.verifyScopedWeatherReleaseLifecycle(root,version,['machine_release_adjudicated'])
  return {capabilityVersion:version,state:'machine_release_adjudicated',before:live.before,published:false}
}
