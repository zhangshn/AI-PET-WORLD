import fs from 'node:fs'
import path from 'node:path'
import {loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH} from './ai-painter-autonomous-package-decision-core-v3.mjs'
import {BASELINE_IDENTITY,baselineDigest as digest,baselineNeed as need,baselineSha256 as sha} from './natural-world-baseline-proof.mjs'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'

const v4='sakaerat-weather-153-rolling-v4'
const release='data/ai-painter/capability-releases/'+v4+'/release.json'
const budget='data/ai-painter/system-governance/sakaerat-rolling-weather-runtime-v4.json'
const policy='data/ai-painter/system-governance/mvp-natural-world-weather-policy-v4.json'
const root193='.runtime/ai-painter/controller-repair-reviews/world-rolling-runtime-193-20261103/qualification'
const prod='.runtime/ai-painter/world-rolling-weather-runtime/v4'
const anchor='.runtime/ai-painter/controller-repair-reviews/world-server-rolling-schedule-190-20261103/formal-next-input.json'
const anchorSha='9dd1328a722c7b8719b0719def007def72a21fb6938e2c1a43091a5c2c015733'
const equal=(a,b)=>digest(a)===digest(b)
const ref=(b,version=v4)=>({id:b.path,sha256:b.sha256,version})
const iso=x=>new Date(x).toISOString()
const hashPattern=/^[0-9a-f]{64}$/
const memo=new Map()

// Display-only, short-lived attestation. Fresh release/registry, five roles, lifecycle, machine ledger,
// SQLite WAL and adjudication identities invalidate it; the full inspection timestamp is exposed.
export function readDisplayRelease(projectRoot,releasePath,version,file){
  const rel=file(releasePath,256*1024),entry=JSON.parse(rel.bytes),registry=file(TRUSTED_RELEASE_REGISTRY_PATH,1024*1024)
  const rows=JSON.parse(registry.bytes).releaseRecords.filter(r=>r.releasePath===releasePath)
  need(rows.length===1&&rows[0].releaseSha256===rel.sha256&&rows[0].capabilityReleaseIdentity===version&&rows[0].capabilityScope==='world_evolution','head_release_registry')
  need(equal(Object.keys(entry.bindings).sort(),['conditionContract','datasetRelease','modelArtifact','reviewContract','runtimeInterfaceContract']),'head_release_roles')
  const reader=createEvolutionInputReader(projectRoot)
  const checks=[rel.sha256,registry.sha256]
  for(const b of [...Object.values(entry.bindings??{}),entry.machineReleaseAdjudication,entry.runtimeAutonomyPolicy]){
    need(b&&hashPattern.test(b.sha256),'head_release_binding')
    const bytes=reader.read(b.path,4*1024*1024);need(sha(bytes)===b.sha256,'head_release_binding');checks.push(b.sha256)
  }
  for(const f of ['.runtime/ai-painter/capability-lifecycle/'+version+'/state.json','.runtime/ai-painter/capability-lifecycle/'+version+'/lifecycle.sqlite',
    '.runtime/ai-painter/capability-lifecycle/'+version+'/lifecycle.sqlite-wal','.runtime/ai-painter/capability-release-ledger.sqlite','.runtime/ai-painter/capability-release-ledger.sqlite-wal']){
    try{checks.push(sha(reader.read(f,4*1024*1024)))}catch(e){if(e.code!=='ENOENT')throw e;checks.push('absent')}
  }
  const key=path.resolve(projectRoot)+'|'+version,id=checks.join('|'),now=Date.now(),cached=memo.get(key)
  if(cached&&cached.id===id&&now>=cached.at&&now-cached.at<30000)return cached
  const value=loadAndValidateReleasedCapabilityBinding({projectRoot,capabilityReleasePath:releasePath,trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH,requiredCapabilityScope:'world_evolution'})
  need(value.verificationStatus==='verified_from_machine_adjudication_and_trusted_registry'&&value.release.modelCapabilityVersion===version&&
    value.release.capabilityReleaseIdentity===version&&value.release.capabilityScope==='world_evolution'&&value.capabilityReleaseSha256===rel.sha256&&
    value.trustedReleaseRegistrySha256===registry.sha256,'head_release_scope')
  const item={id,at:now,value}
  if(memo.size>=4&&!memo.has(key))memo.delete(memo.keys().next().value)
  memo.set(key,item);return item
}
export function rollingAuthority(projectRoot,file){
  const full=readDisplayRelease(projectRoot,release,v4,file),a=full.value
  need(a.verifiedBindings.reviewContract.path===policy&&a.verifiedBindings.runtimeInterfaceContract.path===budget,'head_rolling_authority')
  const b=file(budget,65536),p=file(policy,65536),cfg=JSON.parse(b.bytes),rules=JSON.parse(p.bytes)
  need(b.sha256===a.verifiedBindings.runtimeInterfaceContract.sha256&&p.sha256===a.verifiedBindings.reviewContract.sha256&&
    cfg.version===v4&&cfg.maximumNewSteps===2&&cfg.maximumModelForwards===2&&cfg.formalWritesMaximum===2&&equal(cfg.identity,BASELINE_IDENTITY)&&
    cfg.model.sha256===a.verifiedBindings.modelArtifact.sha256&&cfg.model.sha256===rules.modelRef.sha256&&cfg.policyPath===policy,'head_rolling_budget')
  return {mode:'production',dir:prod,config:cfg,rules,budget:{path:budget,sha256:b.sha256},release:{path:release,sha256:a.capabilityReleaseSha256},
    domain:{path:policy,sha256:p.sha256},verifiedUtc:new Date(full.at).toISOString()}
}
function rawFiles(projectRoot){
  const reader=createEvolutionInputReader(projectRoot)
  return (f,limit)=>{const bytes=reader.read(f,limit);return {bytes,sha256:sha(bytes),value:JSON.parse(bytes)}}
}
function strictSource(src,path,object){
  need(src.path===path&&src.sha256===object.sha256&&src.bytes===object.bytes.length,'head_rolling_original')
}
export function summarizeWeatherDay(prior,head,extras={}){
  const before=prior.record.worldState.payload.environment.evolution.weather,after=head.record.worldState.payload.environment.evolution.weather
  return {tick:head.record.tick,cursor:head.record.eventCursor,stateVersion:head.record.stateVersion,logicalStartUtc:head.event.interval.logicalStartUtc,
    logicalEndUtc:head.event.interval.logicalEndUtc,savedAtUtc:head.record.savedAt,before:before.values,after:after.values,fields:after.fieldOrder,units:after.units,
    eventSha256:head.eventSha,previousEventSha256:head.event.previousEventSha256,receiptSha256:head.receiptSha,fileSha256:head.live.sha256,...extras}
}
function stateRef(head){const {record:r}=head;return {tick:r.tick,stateVersion:r.stateVersion,eventCursor:r.eventCursor,fileSha256:head.live.sha256,
  recordContentSha256:r.recordContentSha256,worldFactsPayloadSha256:r.worldFactsPayloadSha256,statePayloadSha256:r.statePayloadSha256}}
export function verifyRollingDays(projectRoot,initial,chain,a){
  need(a.mode==='production'?a.dir===prod:a.mode==='qualification'&&a.dir===root193,'head_rolling_scope')
  const raw=rawFiles(projectRoot),seed=raw(anchor,32768)
  need(seed.sha256===anchorSha&&a.config.anchor.inputSha256===anchorSha&&seed.value.before.fileSha256===initial.live.sha256&&
    seed.value.head.eventSha256===initial.eventSha&&a.config.anchor.eventSha256===initial.eventSha&&a.config.anchor.businessKey===initial.event.businessKey,'head_rolling_anchor')
  let window={...seed.value,scope:a.mode},previous=initial
  const days=[]
  for(const head of chain){
    const tick=previous.record.tick+1,d=a.dir+'/steps/'+tick,event=head.event,record=head.record
    need(tick===2||tick===3,'head_rolling_tick')
    need(equal(record.worldFacts.tick,tick)&&record.worldState.tick===tick&&record.tick===tick&&record.stateVersion===tick+1&&record.eventCursor===tick+1&&
      head.before.sha256===previous.live.sha256&&event.previousEventSha256===previous.eventSha&&equal(event.identity,BASELINE_IDENTITY)&&
      event.eventKind==='evolution'&&event.eventId==='weather-v4-day-'+tick&&equal([event.fromTick,event.toTick,event.fromStateVersion,event.toStateVersion,event.cursor],
        [tick-1,tick,tick,tick+1,tick+1]),'head_rolling_previous')
    const intent=raw(d+'/intent.json',8192).value
    const readOriginal=(name,key,max)=>{const out=raw(d+'/'+name+'.json',max);strictSource(intent[key],d+'/'+name+'.json',out);return out}
    const input=readOriginal('input','input',32768),output=readOriginal('output','output',8192),proof=readOriginal('process','process',65536),
      request=readOriginal('request','request',256*1024),res=raw(d+'/reservation.json',8192),claim=raw(d+'/worker-claim.json',8192).value
    const o=output.value,p=proof.value,n=p.proof,iv=input.value,rv=res.value
    need(equal(window,iv)&&equal(iv.before,stateRef(previous))&&intent.businessKey===event.businessKey&&equal(request.value.event,event)&&
      equal(event.interval,iv.interval)&&Date.parse(iv.interval.logicalEndUtc)-Date.parse(iv.interval.logicalStartUtc)===86400000&&
      iso(previous.epoch)===iso(iv.interval.logicalStartUtc),'head_rolling_input')
    need(equal(event.policyRef,ref(a.domain))&&equal(event.evidence.capabilityRef,ref(a.release))&&equal(event.evidence.modelRef,a.rules.modelRef)&&
      equal(event.evidence.validatorRef,a.rules.validatorRef)&&equal(event.historyInputRef,ref(intent.input))&&equal(event.evidence.inputRef,ref(intent.input))&&
      equal(event.evidence.outputRef,ref(intent.output))&&equal(event.reasonRefs,[input.sha256,output.sha256,proof.sha256]),'head_rolling_authority')
    need(rv.mode===a.mode&&rv.worldId===BASELINE_IDENTITY.worldId&&equal(rv.before,iv.before)&&rv.inputSha256===input.sha256&&rv.historyValueSha256===iv.historyValueSha256&&
      rv.workerStartMaximum===1&&rv.attemptNumber===tick-1&&equal(rv.budget,a.budget)&&equal(rv.release,a.release)&&claim.reservationSha256===res.sha256&&
      claim.inputSha256===input.sha256&&claim.historyValueSha256===iv.historyValueSha256&&claim.pid===o.pid,'head_rolling_reservation')
    need(p.ownerClosed&&p.cleanupConfirmed&&p.guardReleaseConfirmed&&p.liveOwnerCleanupConfirmed&&!p.protocolError&&n.assignedBeforeResume&&n.killOnJobClose&&
      n.exitCode===0&&n.activeProcessesAfterCleanup===0&&n.ownerPid===p.ownerIdentity.pid&&n.rootPid===o.pid&&Number.isSafeInteger(o.pid)&&o.pid>0&&
      o.inputSha256===input.sha256&&o.historyValueSha256===iv.historyValueSha256&&o.checkpointSha256===a.config.model.sha256&&
      o.job.cpuAffinityCount===a.config.workerLimits.cpuThreadsMaximum&&o.job.maxProcesses===1&&o.job.maxCommittedBytes===a.config.workerLimits.maxCommittedMemoryMiB*1048576&&
      o.job.peakCommittedBytes>0&&o.job.peakCommittedBytes<=o.job.maxCommittedBytes&&o.modelForwards===1&&o.trainingUpdates===0,'head_rolling_process')
    const old=previous.record.worldState.payload.environment.evolution.weather,expected=structuredClone(previous.record)
    const field=a.rules.domainFields,changes=[]
    need(o.values.length===4&&equal(old.values,iv.history.at(-1))&&equal(iv.units,old.units)&&equal(iv.fieldOrder,old.fieldOrder),'head_rolling_fields')
    for(let i=0;i<field.length;i++){
      const val=o.values[i],f=field[i];need(Number.isFinite(val)&&f.fieldId==='environment.'+old.fieldOrder[i]&&f.unit===old.units[i]&&
        val>=f.constraints.min&&val<=f.constraints.max,'head_rolling_range')
      if(val!==old.values[i])changes.push({fieldId:f.fieldId,operation:'replace',beforeValueSha256:digest(old.values[i]),newValue:val,reasonRefs:[output.sha256]})
    }
    const ext=[...new Map(iv.rows.flatMap(r=>r.provenance.archive?[r.provenance.archive,r.provenance.receipt]:[]).map(v=>[v.path,ref(v)])).values()]
    need(equal(changes,event.changes)&&equal(event.externalInputRefs,ext)&&equal(event.before,{expectedTick:iv.before.tick,expectedStateVersion:iv.before.stateVersion,
      expectedFileSha256:iv.before.fileSha256,worldFactsPayloadSha256:iv.before.worldFactsPayloadSha256,statePayloadSha256:iv.before.statePayloadSha256,
      recordContentSha256:iv.before.recordContentSha256}),'head_rolling_delta')
    const business=digest({schemaVersion:'world-evolution-task-v1',taskKind:'evolution',identity:event.identity,before:event.before,interval:event.interval,
      policyRef:event.policyRef,capabilityRef:event.evidence.capabilityRef,modelRef:event.evidence.modelRef,externalInputRefs:ext,historyInputRef:event.historyInputRef})
    need(event.businessKey===business,'head_rolling_key')
    expected.tick=expected.worldFacts.tick=expected.worldState.tick=tick;expected.stateVersion=expected.eventCursor=tick+1;expected.savedAt=record.savedAt
    const env=expected.worldState.payload.environment.evolution
    env.logicalEndUtc=iv.interval.logicalEndUtc;env.weather={fieldOrder:iv.fieldOrder,units:iv.units,values:o.values,period:iv.interval,
      origin:a.mode==='production'?'model_predicted':'model_predicted_private_simulation'}
    delete env.commit
    const core={...BASELINE_IDENTITY,worldState:expected.worldState,ruleVersion:expected.ruleVersion,randomState:expected.randomState,eventCursor:tick+1,tick,stateVersion:tick+1}
    need(event.domainAfterSha256===digest({...core,worldFacts:expected.worldFacts}),'head_rolling_domain')
    env.commit={businessKey:business,eventId:event.eventId,eventSha256:event.eventSha256,historyHead:{cursor:tick+1,eventSha256:event.eventSha256}}
    expected.worldFactsPayloadSha256=digest(expected.worldFacts);expected.statePayloadSha256=digest(core);delete expected.recordContentSha256
    expected.recordContentSha256=digest(expected);need(equal(expected,record),'head_rolling_record')
    const unsealed=structuredClone(record);for(const k of ['recordContentSha256','statePayloadSha256','worldFactsPayloadSha256'])delete unsealed[k]
    need(equal(unsealed,request.value.record),'head_rolling_request')
    days.push(summarizeWeatherDay(previous,head,{modelPid:o.pid,ownerPid:n.ownerPid,inputSha256:input.sha256,outputSha256:output.sha256,
      historyValueSha256:iv.historyValueSha256,modelSha256:o.checkpointSha256,nativeProofSha256:proof.sha256,workerMs:p.elapsedMs,peakCommittedBytes:o.job.peakCommittedBytes,
      serverPid:rv.serverPid,workerStartedUtc:n.rootCreationDateUtc}))
    const rows=[...iv.rows.slice(1),{period:iv.interval,values:o.values,provenance:{kind:'committed_model_weather',worldId:BASELINE_IDENTITY.worldId,tick,
      businessKey:business,eventSha256:event.eventSha256,previousEventSha256:event.previousEventSha256,fileSha256:head.live.sha256,
      input:intent.input,output:intent.output,model:{path:event.evidence.modelRef.id,sha256:event.evidence.modelRef.sha256},capability:a.release,reasonRefs:event.reasonRefs}}]
    const history=rows.map(r=>r.values),data=Buffer.alloc(224);history.flat().forEach((v,i)=>data.writeDoubleLE(v,i*8))
    window={...iv,before:stateRef(head),history,historyValueSha256:sha(data),rows,head:{businessKey:business,eventSha256:event.eventSha256},
      interval:{logicalStartUtc:iv.interval.logicalEndUtc,logicalEndUtc:new Date(Date.parse(iv.interval.logicalEndUtc)+86400000).toISOString(),durationSeconds:86400},
      randomBeforeSha256:digest(record.randomState)}
    previous=head
  }
  return {days,window,head:previous}
}

// These directory entries themselves consume durable budget even before reservation.json has been flushed.
export function rollingBudgetStatus(projectRoot,a,head,days){
  const raw=rawFiles(projectRoot),root=fs.realpathSync(path.join(projectRoot,'.runtime'))
  function fixed(logical){
    need(logical.startsWith('.runtime/'),'head_rolling_scope')
    let p=root
    for(const name of logical.slice(9).split('/')){
      need(/^[a-zA-Z0-9_.-]+$/.test(name)&&name!=='.'&&name!=='..','head_rolling_path')
      p=path.join(p,name)
      try{const s=fs.lstatSync(p);need(!s.isSymbolicLink()&&fs.realpathSync(p).toLowerCase()===p.toLowerCase(),'head_rolling_path')}
      catch(e){if(e.code==='ENOENT')return null;throw e}
    }
    return p
  }
  const steps=fixed(a.dir+'/steps'),slots=steps?fs.readdirSync(steps,{withFileTypes:true}):[]
  need(slots.length<=2&&slots.sort((a,b)=>a.name.localeCompare(b.name)).every((s,i)=>s.isDirectory()&&s.name===String(i+2)),'head_rolling_slots')
  const consumed=slots.length,committed=head.record.tick-1
  need(consumed>=committed&&consumed<=committed+1,'head_rolling_slots')
  let terminal=null
  for(const index of [1,2]){
    const complete=a.dir+'/completed-'+index+'.json'
    if(!fixed(complete))continue
    const completed=raw(complete,32768).value,root=a.dir+'/launches/weather-rolling-v4-'+a.mode+'-'+index
    const launch=raw(root+'/launch-receipt.json',16384),terminalPath=root+'/background-process-terminal.json'
    validateProjectCommandBackgroundReceipt({root:projectRoot,runnerPath:a.config.entry.path,launchIdentity:'weather-rolling-v4-'+a.mode+'-'+index,
      runnerArgs:[a.mode==='production'?'--serve':'--qualify-serve',String(index)],receiptRoot:a.dir+'/launches',receipt:launch.value})
    need(completed.mode===a.mode&&completed.status==='rolling_budget_exhausted'&&completed.activation===index&&completed.exit.serverPid===launch.value.processId&&
      completed.exit.receipt.sha256===launch.sha256&&completed.exit.clientExited&&completed.exit.clientPid!==completed.exit.serverPid&&
      equal(completed.after,stateRef(head))&&equal(completed.budget,a.budget)&&equal(completed.release,a.release)&&
      equal(completed.readback.before,stateRef(head))&&completed.readback.usage.exhausted&&committed===2&&days.at(-1)?.serverPid===launch.value.processId,'head_rolling_completion')
    if(!fixed(terminalPath))continue
    const t=raw(terminalPath,16384)
    need(t.value.status==='runner_process_exited'&&t.value.exitCode===0&&t.value.processId===launch.value.processId&&
      t.value.processStartIdentity===launch.value.processStartIdentity&&t.value.commandIdentitySha256===launch.value.commandIdentitySha256&&
      t.value.launchIdentity===launch.value.launchIdentity&&t.value.runnerSha256===a.config.entry.sha256,'head_rolling_terminal')
    terminal={serverPid:t.value.processId,finishedUtc:t.value.recordedAtUtc,exitCode:t.value.exitCode,sha256:t.sha256}
  }
  return {total:a.config.maximumModelForwards,reserved:consumed,committed,remaining:a.config.maximumModelForwards-consumed,
    status:terminal?'exhausted_exited':committed===2?'exhausted':consumed>committed?'reserved_uncommitted':'available',terminal,
    releaseVerifiedAtUtc:a.verifiedUtc??null}
}
