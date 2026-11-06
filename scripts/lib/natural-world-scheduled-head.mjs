import fs from 'node:fs'
import path from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {BASELINE_IDENTITY,baselineDigest as digest,baselineNeed as need,baselineSha256 as sha} from './natural-world-baseline-proof.mjs'
import {createEvolutionInputReader,buildEvolutionDiagnosticFeatures} from './natural-world-evolution-input.mjs'
import {readPowerDailySource} from './natural-world-temporal-data.mjs'
import {readDisplayRelease,summarizeWeatherDay} from './natural-world-rolling-head.mjs'
import {featureSha,invariant} from './world-initialized-evolution.mjs'
import {validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'

const version='sakaerat-weather-153-scheduled-v5'
const releasePath='data/ai-painter/capability-releases/'+version+'/release.json'
const budgetPath='data/ai-painter/system-governance/sakaerat-scheduled-weather-runtime-v5.json'
const service='.runtime/ai-painter/world-weather-service/'+BASELINE_IDENTITY.worldId
const equal=(a,b)=>digest(a)===digest(b)
const isSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)
const json=raw=>JSON.parse(raw.bytes)
const ref=(path,sha256)=>({id:path,sha256,version})
const atTick=(cfg,t)=>new Date(Date.parse(cfg.originalCutoffUtc)+t*cfg.clock.stepSeconds*1000).toISOString()

export function scheduledAuthority(root,file){
  const verified=readDisplayRelease(root,releasePath,version,file),a=verified.value
  const budget=file(budgetPath,65536),cfg=json(budget),b=a.verifiedBindings
  need(b.runtimeInterfaceContract.path===budgetPath&&b.runtimeInterfaceContract.sha256===budget.sha256&&cfg.version===version&&
    cfg.requiredCapabilityScope==='world_evolution'&&equal(cfg.identity,BASELINE_IDENTITY)&&cfg.origin.tick===3&&
    isSha(cfg.origin.fileSha256)&&isSha(cfg.origin.businessKey)&&isSha(cfg.origin.eventSha256)&&cfg.maximumNewSteps===27&&
    cfg.validatedForecastDays===30&&cfg.clock.stepSeconds===86400&&cfg.maximumActivations===14&&cfg.maximumBatchIssues===14&&
    cfg.policyPath===b.reviewContract.path&&cfg.model.sha256===b.modelArtifact.sha256,'head_scheduled_contract')
  const policy=file(cfg.policyPath,65536);need(policy.sha256===b.reviewContract.sha256,'head_scheduled_policy')
  return {cfg,policy:json(policy),policyRef:ref(cfg.policyPath,policy.sha256),budget:{path:budgetPath,sha256:budget.sha256},
    capability:{path:releasePath,sha256:a.capabilityReleaseSha256},verifiedAt:new Date(verified.at).toISOString()}
}

function ledgerSnapshot(root){
  let p=fs.realpathSync(path.join(root,'.runtime'))
  for(const part of (service.slice(9)+'/accounting/accounting.sqlite').split('/')){
    p=path.join(p,part);need(!fs.lstatSync(p).isSymbolicLink()&&fs.realpathSync(p)===p,'head_scheduled_sqlite_path')
  }
  for(const target of [p,p+'-wal',p+'-shm']){
    if(!fs.existsSync(target))continue
    const s=fs.lstatSync(target);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=4*1024*1024&&fs.realpathSync(target)===target,'head_scheduled_sqlite_path')
  }
  const db=new DatabaseSync(p,{readOnly:true})
  try{
    db.exec('PRAGMA query_only=ON; BEGIN')
    return {current:db.prepare('SELECT * FROM service WHERE id=1').get(),slots:db.prepare('SELECT * FROM slots ORDER BY target_tick LIMIT 28').all(),
      batches:db.prepare('SELECT * FROM batches ORDER BY seq LIMIT 15').all()}
  }finally{db.close()}
}

export function checkScheduledLedger(a,ledger,contract,marker,head){
  const {cfg}=a,{current:s,slots,batches}=ledger,{origin:o}=cfg
  const initial={tick:o.tick,file:o.fileSha256,event:o.eventSha256,business:o.businessKey,history:o.historyValueSha256}
  const lifetime=digest({world:BASELINE_IDENTITY,cutoffUtc:cfg.originalCutoffUtc})
  need(equal(initial,marker.origin)&&equal(initial,contract.initial)&&marker.configSha256===digest(contract)&&
    marker.lifetime===lifetime&&contract.lifetime===lifetime&&equal(contract.identity,cfg.identity)&&
    contract.modelSha256===cfg.model.sha256&&equal(contract.clock,cfg.clock)&&contract.maximumForecastDays===cfg.validatedForecastDays&&
    contract.maximumNewSteps===cfg.maximumNewSteps&&contract.maximumNewModelStarts===cfg.maximumNewSteps&&contract.maximumBatchIssues===cfg.maximumBatchIssues&&
    contract.lastEligibleTick===cfg.validatedForecastDays&&contract.qualificationOnly===false&&s.scope===lifetime&&s.cfg_sha===marker.configSha256,'head_scheduled_account_identity')
  need(slots.length<=cfg.maximumNewSteps&&batches.length<=cfg.maximumBatchIssues,'head_scheduled_budget')
  let previousFile=o.fileSha256,previousEvent=o.eventSha256,committed=o.tick
  for(const [i,row] of slots.entries()){
    const tick=o.tick+i+1,batch=batches.find(b=>b.batch_id===row.batch_id)
    need(row.target_tick===tick&&row.before_file===previousFile&&row.before_event===previousEvent&&batch&&batch.first_tick<=tick&&tick<=batch.last_tick&&
      batch.last_tick-batch.first_tick<cfg.batchSize&&batch.last_tick<=cfg.validatedForecastDays&&isSha(row.input_sha)&&isSha(row.history_sha),'head_scheduled_slot_chain')
    if(row.status==='committed'){
      need(isSha(row.commit_file)&&isSha(row.commit_event),'head_scheduled_slot_commit')
      previousFile=row.commit_file;previousEvent=row.commit_event;committed=tick
    }else need(i===slots.length-1&&['reserved','failed'].includes(row.status)&&row.commit_file===null&&row.commit_event===null,'head_scheduled_open_slot')
  }
  for(const [i,b] of batches.entries()){
    const before=b.first_tick===o.tick+1?o.fileSha256:slots.find(row=>row.target_tick===b.first_tick-1)?.commit_file
    need(b.seq===i+1&&isSha(before)&&Number.isSafeInteger(b.issued_ms)&&b.expires_ms===b.issued_ms+cfg.batchLeaseMs&&
      b.last_tick===Math.min(cfg.validatedForecastDays,b.first_tick+cfg.batchSize-1)&&
      b.batch_id===digest({scope:lifetime,seq:b.seq,first:b.first_tick,end:b.last_tick,before,issued:b.issued_ms}),'head_scheduled_batch')
  }
  need(s.tick===committed&&s.file_sha===previousFile&&s.event_sha===previousEvent,'head_scheduled_ledger_head')
  const row=slots.find(r=>r.target_tick===head.record.tick)
  need(row&&row.status!=='failed'&&row.before_file===head.before.sha256&&row.before_event===head.event.previousEventSha256&&
    ((s.tick===row.target_tick&&row.commit_file===head.live.sha256&&row.commit_event===head.eventSha&&s.business_key===head.receipt.businessKey)||
    (s.tick===row.target_tick-1&&row.status==='reserved')),'head_scheduled_store_ledger')
  return {row,remaining:cfg.maximumNewSteps-slots.length,accounted:committed-o.tick,reserved:slots.length,
    batches:batches.length,outstanding:slots.at(-1)?.status==='committed'?null:slots.at(-1)?.status}
}

// Reread only the model's seven-day input window, pinned by prior committed Store receipts.
export function verifyScheduledWindow({input,tick,cfg,store,file,raw,ledger,early,maintenance}){
  const refs=maintenance.event.externalInputRefs
  let archived
  for(const [index,row] of input.rows.entries()){
    const day=tick-7+index,p=row.provenance
    need(equal(row.period,{logicalStartUtc:atTick(cfg,day-1),logicalEndUtc:atTick(cfg,day),durationSeconds:cfg.clock.stepSeconds}),'head_scheduled_history_period')
    if(day<=0){
      const [source,receipt]=[p.archive,p.receipt]
      need(p.kind===(day===0?'committed_archival_seed':'archival_context')&&[source,receipt].every((b,i)=>b.path===refs[i].id&&b.sha256===refs[i].sha256),'head_scheduled_archive')
      if(day===0)need(p.eventSha256===maintenance.eventSha&&p.businessKey===maintenance.receipt.businessKey&&p.worldId===cfg.identity.worldId,'head_scheduled_seed')
      if(!archived){
        const response=raw(source.path),proof=raw(receipt.path)
        need(response.sha256===source.sha256&&proof.sha256===receipt.sha256,'head_scheduled_archive')
        archived=buildEvolutionDiagnosticFeatures(readPowerDailySource(response.bytes,json(proof),{start:'20200101',end:'20200131',latitude:14.5078,longitude:101.895,returnedCoordinates:[101.895,14.508]}))
      }
      need(equal(row.values,archived.values[6+day]),'head_scheduled_archive_values');continue
    }
    const older=early.find(d=>d.tick===day),slot=ledger.slots.find(s=>s.target_tick===day)
    const eventSha=older?.eventSha256??slot?.commit_event,fileSha=older?.fileSha256??slot?.commit_file
    need(p.kind==='committed_model_weather'&&p.worldId===cfg.identity.worldId&&p.tick===day&&isSha(p.businessKey)&&
      isSha(eventSha)&&isSha(fileSha)&&p.eventSha256===eventSha&&p.fileSha256===fileSha,'head_scheduled_history_binding')
    const prefix=store+'.evolution/'+p.businessKey+'.',receipt=json(file(prefix+'receipt.json',65536)),event=json(file(prefix+eventSha+'.event.json',65536))
    const {eventSha256,...payload}=event,e=event.evidence
    const expectedPath=day===1?'.runtime/ai-painter/world-first-weather-runtime/v3/output.json':
      (day<=cfg.origin.tick?'.runtime/ai-painter/world-rolling-weather-runtime/v4':service)+'/steps/'+day+'/output.json'
    need(receipt.tick===day&&receipt.fileSha256===fileSha&&receipt.eventSha256===eventSha&&equal(receipt.identity,cfg.identity)&&
      eventSha256===eventSha&&digest(payload)===eventSha&&event.businessKey===p.businessKey&&e.outputRef.id===expectedPath&&p.output.path===expectedPath&&
      e.outputRef.sha256===p.output.sha256,'head_scheduled_history_output')
    const output=raw(expectedPath,8192)
    need(output.sha256===p.output.sha256&&equal(json(output).values,row.values),'head_scheduled_history_values')
  }
}

export function projectScheduledHead({root,store,live,file,readBundle,anchor,early,maintenance,a}){
  const {cfg}=a,o=cfg.origin,r=json(live),tick=r.tick,dir=service+'/steps/'+tick
  need(anchor.record.tick===o.tick&&anchor.live.sha256===o.fileSha256&&anchor.eventSha===o.eventSha256&&
    anchor.receipt.businessKey===o.businessKey&&Number.isInteger(tick)&&tick>o.tick&&tick<=cfg.validatedForecastDays,'head_scheduled_range')
  const reader=createEvolutionInputReader(root)
  const raw=(p,max=65536)=>{const bytes=reader.read(p,max);return {bytes,sha256:sha(bytes)}}
  const optional=p=>{try{return json(raw(p))}catch(e){if(e.code==='ENOENT')return null;throw e}}
  const intent=json(raw(dir+'/intent.json')),reservation=raw(dir+'/reservation.json'),reserved=json(reservation),claim=json(raw(dir+'/worker-claim.json'))
  function original(name,max){
    const p=dir+'/'+name+'.json',f=raw(p,max),b=intent[name]
    need(b.path===p&&b.sha256===f.sha256&&b.bytes===f.bytes.length,'head_scheduled_original');return json(f)
  }
  const input=original('input',65536),output=original('output',8192),proc=original('process',65536),req=original('request',256*1024)
  const head=readBundle(file,root,store,live,req.expectedFileSha256),prior=json(head.before),e=head.event,p=proc.proof,weather=r.worldState.payload.environment.evolution.weather
  const ledger=ledgerSnapshot(root),marker=json(raw(service+'/accounting/identity.json')),contract=json(raw(service+'/accounting/contract.json'))
  const usage=checkScheduledLedger(a,ledger,contract,marker,head),row=usage.row
  need(equal(invariant(prior),invariant(r))&&equal(req.record.worldState,r.worldState)&&r.worldFacts.tick===tick&&r.worldState.tick===tick,'head_scheduled_weather_only')
  need(equal(e.identity,cfg.identity)&&equal(req.event,e)&&intent.businessKey===e.businessKey&&e.eventId==='scheduled-weather-day-'+tick&&
    e.eventKind==='evolution'&&equal([prior.tick,prior.stateVersion,prior.eventCursor,r.stateVersion,r.eventCursor,e.fromTick,e.toTick,e.fromStateVersion,e.toStateVersion,e.cursor],[tick-1,tick,tick,tick+1,tick+1,tick-1,tick,tick,tick+1,tick+1])&&
    e.before.expectedFileSha256===head.before.sha256&&prior.worldState.payload.environment.evolution.commit.eventSha256===e.previousEventSha256&&
    equal(e.policyRef,a.policyRef)&&equal(e.evidence.modelRef,a.policy.modelRef)&&equal(e.evidence.validatorRef,a.policy.validatorRef)&&
    equal(e.evidence.capabilityRef,ref(a.capability.path,a.capability.sha256))&&equal(e.evidence.inputRef,ref(intent.input.path,intent.input.sha256))&&
    equal(e.evidence.outputRef,ref(intent.output.path,intent.output.sha256))&&equal(e.reasonRefs,[intent.output.sha256,intent.input.sha256,intent.process.sha256]),'head_scheduled_event')
  const priorReceipt=store+'.evolution/'+prior.worldState.payload.environment.evolution.commit.businessKey+'.receipt.json'
  const pr=json(file(priorReceipt,65536));need(pr.fileSha256===head.before.sha256&&pr.eventSha256===e.previousEventSha256&&pr.tick===prior.tick&&equal(pr.identity,cfg.identity),'head_scheduled_previous_receipt')
  need(input.scope==='production'&&equal(input.identity,cfg.identity)&&input.modelSha256===cfg.model.sha256&&input.head.eventSha256===e.previousEventSha256&&
    input.before.fileSha256===head.before.sha256&&input.before.tick===prior.tick&&input.historyValueSha256===featureSha(input.history)&&
    equal(input.rows.map(x=>x.values),input.history)&&equal(input.history.at(-1),prior.worldState.payload.environment.evolution.weather.values)&&
    equal(e.interval,{logicalStartUtc:atTick(cfg,tick-1),logicalEndUtc:atTick(cfg,tick),durationSeconds:cfg.clock.stepSeconds})&&
    equal(e.interval,input.interval)&&equal(weather.period,e.interval)&&equal(weather.values,output.values)&&output.values.length===4&&output.values.every(Number.isFinite)&&
    output.inputSha256===intent.input.sha256&&output.historyValueSha256===input.historyValueSha256&&output.checkpointSha256===cfg.model.sha256&&
    output.modelForwards===1&&output.trainingUpdates===0,'head_scheduled_weather')
  const changes=a.policy.domainFields.flatMap((field,i)=>{
    const priorValue=input.history.at(-1)[i],newValue=output.values[i]
    return priorValue===newValue?[]:[{fieldId:field.fieldId,operation:'replace',beforeValueSha256:digest(priorValue),newValue,reasonRefs:[intent.output.sha256]}]
  })
  need(equal(input.fieldOrder,weather.fieldOrder)&&equal(input.units,weather.units)&&equal(e.changes,changes)&&
    equal(e.historyInputRef,e.evidence.inputRef),'head_scheduled_domain_changes')
  verifyScheduledWindow({input,tick,cfg,store,file,raw,ledger,early,maintenance})
  need(reserved.scope==='production'&&reserved.worldId===cfg.identity.worldId&&reserved.tick===tick&&reserved.lifetime===marker.lifetime&&
    equal(reserved.capability,a.capability)&&equal(reserved.budget,a.budget)&&reserved.slotToken===row.token&&reserved.batchId===row.batch_id&&
    reserved.inputSha256===row.input_sha&&row.input_sha===intent.input.sha256&&row.history_sha===input.historyValueSha256&&
    claim.reservationSha256===reservation.sha256&&claim.batchId===reserved.batchId&&claim.inputSha256===intent.input.sha256&&claim.pid===output.pid,'head_scheduled_reservation')
  const obs=path.relative(root,proc.observationPath).split(path.sep).join('/')
  need(/^\.runtime\/ai-painter\/owned-worker-guards\/[a-f0-9-]+-native\/cleanup-observation\.json$/.test(obs),'head_scheduled_process_path')
  const native=json(raw(obs)),limits=cfg.workerLimits
  need(proc.ownerClosed&&proc.cleanupConfirmed&&proc.liveOwnerCleanupConfirmed&&proc.guardReleaseConfirmed&&p.assignedBeforeResume&&p.killOnJobClose&&
    p.activeProcessesAfterCleanup===0&&p.exitCode===0&&p.rootPid===output.pid&&Number.isInteger(output.pid)&&output.pid>0&&
    p.stdoutBytes===intent.output.bytes&&p.ownerPid===proc.ownerIdentity.pid&&native.ownerPid===p.ownerPid&&native.rootPid===p.rootPid&&
    native.activeProcessesAfterCleanup===0&&native.assignedBeforeResume&&native.bindingBase64===p.bindingBase64&&!native.cleanupErrorBase64&&!native.stopReasonBase64&&
    output.job.maxProcesses===1&&output.job.cpuAffinityCount===limits.cpuThreadsMaximum&&output.job.maxCommittedBytes===limits.maxCommittedMemoryMiB*1048576&&
    output.job.peakCommittedBytes>0&&output.job.peakCommittedBytes<=output.job.maxCommittedBytes,'head_scheduled_process')
  const serviceReceipt=optional(dir+'/receipt.json')
  need(serviceReceipt?equal(serviceReceipt,head.receipt):row.status==='reserved','head_scheduled_service_receipt')
  let activation=reserved.batchSequence
  for(let index=cfg.maximumActivations;index>activation;index--){if(optional(service+'/activation-'+index+'.json')){activation=index;break}}
  const activationRef=json(raw(service+'/activation-'+activation+'.json'))
  need(activationRef.index===activation&&equal(activationRef.budget,a.budget)&&equal(activationRef.capability,a.capability),'head_scheduled_activation')
  const end=optional(service+'/completed-'+activation+'.json'),stop=optional(service+'/stopped-'+activation+'.json')
  const launchIdentity='scheduled-weather-v5-production-'+activation,launchDir=service+'/launches/'+launchIdentity
  const launch=optional(launchDir+'/launch-receipt.json'),exit=optional(launchDir+'/background-process-terminal.json'),session=optional(service+'/session-'+activation+'.json')
  if(launch)validateProjectCommandBackgroundReceipt({root,launchIdentity,runnerPath:cfg.entry.path,runnerArgs:['--serve',String(activation)],receiptRoot:service+'/launches',receipt:launch})
  if(session)need(launch&&session.parent.serverPid===launch.processId&&session.parent.launchReceipt.path===launchDir+'/launch-receipt.json'&&
    session.parent.launchReceipt.sha256===raw(launchDir+'/launch-receipt.json').sha256&&equal(session.budget,a.budget)&&equal(session.capability,a.capability),'head_scheduled_session')
  if(exit)need(launch&&exit.status==='runner_process_exited'&&exit.processId===launch.processId&&exit.processStartIdentity===launch.processStartIdentity&&
    exit.commandIdentitySha256===launch.commandIdentitySha256&&exit.launchIdentity===launchIdentity&&exit.runnerSha256===cfg.entry.sha256,'head_scheduled_server_exit')
  if(stop)need(session&&equal(stop.parent,session.parent)&&typeof stop.status==='string'&&stop.status.length>0,'head_scheduled_stop')
  let status='no_inflight_model'
  if(end){
    need(!stop&&end.status==='cumulative_lifetime_exhausted'&&equal(end.budget,a.budget)&&equal(end.capability,a.capability)&&
      end.after.fileSha256===head.live.sha256&&end.after.tick===tick&&end.recovered.before.fileSha256===head.live.sha256&&
      equal(end.usage,end.recovered.usage)&&session&&equal(end.parent,session.parent)&&(!exit||exit.exitCode===0)&&
      end.usage.committedTick===tick&&end.usage.remainingModelStarts===usage.remaining&&end.usage.batchesIssued===usage.batches&&
      usage.remaining===0&&usage.accounted===cfg.maximumNewSteps&&usage.outstanding===null,'head_scheduled_terminal')
    status='completed_exhausted'
  }else if(stop||usage.outstanding==='failed'||exit)status='stopped'
  else if(usage.accounted<tick-o.tick)status='commit_pending_accounting'
  else if(usage.outstanding)status='reserved_uncommitted'
  else if(!usage.remaining)status='budget_exhausted'
  return {head,day:summarizeWeatherDay({record:prior},head,{modelPid:output.pid,serverPid:reserved.serverPid,workerMs:proc.elapsedMs,
    historyValueSha256:input.historyValueSha256,inputSha256:intent.input.sha256,outputSha256:intent.output.sha256,modelSha256:cfg.model.sha256,nativeProofSha256:intent.process.sha256}),
    scheduled:{total:cfg.maximumNewSteps,committed:tick-o.tick,reserved:usage.reserved,remaining:usage.remaining,accounted:usage.accounted,
      remainingDays:cfg.validatedForecastDays-tick,batches:usage.batches,activation,status,completedAtUtc:end?.atUtc??null,releaseVerifiedAtUtc:a.verifiedAt,
      serverExit:exit?{pid:exit.processId,code:exit.exitCode,atUtc:exit.recordedAtUtc}:null}}
}
