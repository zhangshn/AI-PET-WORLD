import {resolveRuntimePath} from './runtime-working-directory.mjs'
import path from 'node:path'
import fs from 'node:fs'
import {FIRST_WEATHER_SCOPED_PATH, FIRST_WEATHER_SCOPED_VERSION,
  FIRST_WEATHER_SCOPED_POLICY_PATH, TRUSTED_RELEASE_REGISTRY_PATH} from './ai-painter-autonomous-package-decision-core-v3.mjs'
import {BASELINE_IDENTITY,BASELINE_SELECTION,baselineDigest as digest,baselineNeed as need,baselineSha256 as sha} from './natural-world-baseline-proof.mjs'
import {COMPAT_SCHEMA} from './natural-world-baseline-compatibility.mjs'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {readDisplayRelease,rollingAuthority,rollingBudgetStatus,summarizeWeatherDay,verifyRollingDays} from './natural-world-rolling-head.mjs'
import {scheduledAuthority,projectScheduledHead} from './natural-world-scheduled-head.mjs'

const store='data/world-runtime/'+BASELINE_IDENTITY.ownerId+'/'+BASELINE_IDENTITY.worldId+'.json'
const genesisSha='93a6202c69b470ac79094ed1686889e7a85605a3554f5728be8df414ca569868'
// The program independently read the committed Store and the original transaction
// before this first maintenance was registered. This proof covers that event only.
const registered={path:'.runtime/ai-painter/controller-repair-reviews/natural-world-maintenance-policy-179-20261103/formal-readback.json',
  sha256:'51dbe9dbad430f784d6f36f4eab6df679081ab9c90e38851bc6d4afe20e15d0f'}
const equal=(a,b)=>digest(a)===digest(b)
const shaPattern=/^[a-f0-9]{64}$/
function pendingJournal(read){
  try{return read(store+'.transaction.json',65536)}catch(error){if(error.code==='ENOENT')return null;throw error}
}

export function readCommittedHeadBundle(file,projectRoot,logical,live,previousSha){
  const record=JSON.parse(live.bytes),commit=record.worldState.payload.environment.evolution?.commit
  const key=commit?.businessKey,eventSha=commit?.eventSha256
  need(shaPattern.test(key)&&shaPattern.test(eventSha)&&shaPattern.test(previousSha),'head_key')
  const dir=logical+'.evolution/'+key+'.'
  const markerRef=file(dir+eventSha+'.commit.json',65536),marker=JSON.parse(markerRef.bytes)
  const {state,transactionId,...body}=marker
  const recordPath=logical.startsWith('.runtime/')?path.join(fs.realpathSync(path.join(projectRoot,'.runtime')),logical.slice(9)):resolveRuntimePath(projectRoot,logical)
  need(state==='committed'&&marker.schemaVersion==='world-runtime-transaction-v1'&&marker.protocolVersion==='world-evolution-transaction-v1'&&
    marker.recordKind==='natural_world'&&marker.recordPath===recordPath&&marker.latestPath===null&&
    marker.worldId===BASELINE_IDENTITY.worldId&&equal(marker.identity,BASELINE_IDENTITY)&&marker.businessKey===key&&
    marker.eventSha256===eventSha&&marker.tick===record.tick&&marker.stateVersion===record.stateVersion&&transactionId===digest(body),'head_journal')
  function side(suffix,sidecar){
    const r=file(dir+suffix)
    need(sidecar.name===key+'.'+suffix&&sidecar.fileSha256===r.sha256&&sidecar.bytes===r.bytes.length,'head_sidecar')
    return r
  }
  const before=side(previousSha+'.before.json',marker.before)
  need(before.sha256===previousSha&&side(live.sha256+'.record.json',marker.next).bytes.equals(live.bytes),'head_before_after')
  const event=JSON.parse(side(eventSha+'.event.json',marker.event).bytes),{eventSha256,...payload}=event
  need(eventSha256===eventSha&&digest(payload)===eventSha&&event.businessKey===key&&equal(event.identity,BASELINE_IDENTITY)&&
    commit.eventId===event.eventId&&commit.historyHead.cursor===event.cursor&&commit.historyHead.eventSha256===eventSha,'head_event')
  const rb=file(dir+'receipt.json',65536),receipt=JSON.parse(rb.bytes)
  need(equal(receipt,{schemaVersion:'world-evolution-receipt-v1',identity:BASELINE_IDENTITY,businessKey:key,eventId:event.eventId,
    eventSha256:eventSha,fileSha256:live.sha256,recordContentSha256:record.recordContentSha256,tick:record.tick,stateVersion:record.stateVersion,
    eventCursor:record.eventCursor,transportOnly:true,productionReady:false})&&receipt.recordContentSha256===marker.recordContentSha256,'head_receipt')
  return {before,live,record,event,receipt,eventSha,markerSha:markerRef.sha256,receiptSha:rb.sha256,epoch:event.interval.logicalEndUtc}
}

function readFirstMaintenance(file,projectRoot,live){
  const reference=file(registered.path,32*1024)
  need(reference.sha256===registered.sha256,'head_registration')
  const verified=JSON.parse(reference.bytes),expected=verified.commit
  need(verified.formalStore===store&&equal(verified.world,BASELINE_IDENTITY)&&
    verified.before.fileSha256===genesisSha&&equal([verified.before.tick,verified.before.stateVersion,verified.before.eventCursor],[0,0,0]),'head_registration')
  need(live.sha256===verified.after.fileSha256,'head_not_registered')
  const result=readCommittedHeadBundle(file,projectRoot,store,live,genesisSha),{record,event,receipt,before}=result
  for(const [k,v] of Object.entries(BASELINE_IDENTITY))need(record[k]===v,'head_identity')
  need(equal([record.tick,record.stateVersion,record.eventCursor],[0,1,1]),'head_counters')
  need(event.eventKind==='maintenance'&&
    equal(event.identity,BASELINE_IDENTITY)&&event.before.expectedFileSha256===before.sha256&&event.previousEventSha256===null&&
    equal(event.interval,verified.interval)&&event.interval.durationSeconds===0,'head_event')
  need(equal(receipt,expected)&&equal(record.worldState.payload.environment.evolution.weather,verified.weather),'head_receipt')
  return result
}

// Pure Store/semantic verification shared by the positive isolated test and the
// released path. The public projection obtains authority only from the local
// machine release reader. No input to the HTTP API can select this authority.
export function verifyFirstForecastRecord({read,projectRoot,logical,live,previous,authority}){
  const result=readCommittedHeadBundle(read,projectRoot,logical,live,previous.receipt.fileSha256)
  const {event,record}=result,prior=JSON.parse(result.before.bytes),changes=event.changes
  need(equal(prior,previous.record)&&event.previousEventSha256===previous.receipt.eventSha256&&
    event.eventKind==='evolution'&&event.eventId==='first-sakaerat-committed-weather-v3'&&
    equal([event.fromTick,event.toTick,event.fromStateVersion,event.toStateVersion,event.cursor],[0,1,1,2,2])&&
    equal(event.before,{expectedTick:0,expectedStateVersion:1,expectedFileSha256:previous.receipt.fileSha256,
      worldFactsPayloadSha256:prior.worldFactsPayloadSha256,statePayloadSha256:prior.statePayloadSha256,recordContentSha256:prior.recordContentSha256}),'head_evolution_before')
  const a=authority,e=event.evidence,ref=(path,sha256)=>({id:path,version:FIRST_WEATHER_SCOPED_VERSION,sha256})
  need(e.kind==='evolution'&&equal(event.policyRef,a.policyRef)&&equal(e.capabilityRef,a.capabilityRef)&&
    equal(e.modelRef,a.policy.modelRef)&&equal(e.validatorRef,a.policy.validatorRef)&&
    equal(event.interval,a.interval)&&event.interval.logicalStartUtc===previous.epoch,'head_evolution_authority')
  const source=[...previous.event.externalInputRefs].map(x=>ref(x.id,x.sha256))
  need(equal(source,event.externalInputRefs)&&equal(event.historyInputRef,e.inputRef)&&
    e.inputRef.id===a.run+'/input.json'&&e.outputRef.id===a.run+'/output.json'&&
    [e.inputRef,e.outputRef].every(x=>x.version===FIRST_WEATHER_SCOPED_VERSION&&shaPattern.test(x.sha256))&&
    event.reasonRefs.length===3&&event.reasonRefs.every(x=>shaPattern.test(x))&&event.reasonRefs[0]===e.outputRef.sha256,'head_evolution_sources')
  const calculatedKey=digest({schemaVersion:'world-evolution-task-v1',taskKind:'evolution',identity:event.identity,before:event.before,
    interval:event.interval,policyRef:event.policyRef,capabilityRef:e.capabilityRef,modelRef:e.modelRef,externalInputRefs:event.externalInputRefs,historyInputRef:e.inputRef})
  need(event.businessKey===calculatedKey,'head_evolution_key')
  const next=structuredClone(prior),weather=next.worldState.payload.environment.evolution.weather
  const fields=a.policy.domainFields
  need(equal(weather.fieldOrder.map(f=>'environment.'+f),fields.map(f=>f.fieldId))&&
    equal(weather.units,fields.map(f=>f.unit))&&Array.isArray(changes)&&changes.length<=fields.length,'head_evolution_fields')
  const ids=new Set()
  for(const c of changes){
    const i=fields.findIndex(f=>f.fieldId===c.fieldId)
    need(i>=0&&!ids.has(i)&&c.operation==='replace'&&c.beforeValueSha256===digest(weather.values[i])&&
      equal(c.reasonRefs,[e.outputRef.sha256])&&Number.isFinite(c.newValue)&&weather.values[i]!==c.newValue&&
      c.newValue>=fields[i].constraints.min&&c.newValue<=fields[i].constraints.max,'head_evolution_delta')
    ids.add(i);weather.values[i]=c.newValue
  }
  weather.period=event.interval;weather.origin=a.weatherOrigin
  next.tick=next.worldState.tick=next.worldFacts.tick=1;next.stateVersion=2;next.eventCursor=2
  const env=next.worldState.payload.environment.evolution
  env.logicalEndUtc=event.interval.logicalEndUtc;delete env.commit
  const domain={...BASELINE_IDENTITY,worldState:next.worldState,ruleVersion:next.ruleVersion,randomState:next.randomState,
    eventCursor:2,tick:1,stateVersion:2}
  need(event.domainAfterSha256===digest({...domain,worldFacts:next.worldFacts}),'head_evolution_domain')
  env.commit={businessKey:calculatedKey,eventId:event.eventId,eventSha256:result.eventSha,historyHead:{cursor:2,eventSha256:result.eventSha}}
  next.savedAt=record.savedAt
  need(typeof next.savedAt==='string'&&Number.isFinite(Date.parse(next.savedAt))&&new Date(next.savedAt).toISOString()===next.savedAt,'head_evolution_time')
  next.worldFactsPayloadSha256=digest(next.worldFacts);next.statePayloadSha256=digest(domain);delete next.recordContentSha256
  next.recordContentSha256=digest(next)
  need(equal(record,next),'head_evolution_record')
  verifyForecastOriginals(projectRoot,previous,result,a)
  return result
}

function verifyForecastOriginals(projectRoot,previous,result,a){
  // The GET reads exactly these six bounded existing originals. IDs embedded in
  // an intent or in the Store cannot introduce additional file locations.
  const dirs={production:'.runtime/ai-painter/world-first-weather-runtime/v3',
    qualification:'.runtime/ai-painter/controller-repair-reviews/world-first-evolution-runtime-185-20261103/qualification/run'}
  need(a.run===dirs[a.mode]&&Object.hasOwn(dirs,a.mode),'head_worker_scope')
  const inputReader=createEvolutionInputReader(projectRoot)
  const bytes=(name,max)=>inputReader.read(a.run+'/'+name+'.json',max)
  const seal=JSON.parse(bytes('intent',16384))
  function original(name,refKey,max){
    const b=bytes(name,max),binding=seal[refKey]
    need(binding.path===a.run+'/'+name+'.json'&&binding.sha256===sha(b)&&binding.bytes===b.length,'head_worker_original')
    return JSON.parse(b)
  }
  const input=original('input','input',16384),output=original('output','output',8192),native=original('native','proof',32768),
    validation=original('validation','validation',16384),request=original('request','request',256*1024)
  const {event,record}=result,prior=previous.record,p=native.proof,j=output.job,observed=input.historyProvenance
  const expectedBefore={tick:0,stateVersion:1,eventCursor:1,fileSha256:previous.receipt.fileSha256,
    worldFactsPayloadSha256:prior.worldFactsPayloadSha256,statePayloadSha256:prior.statePayloadSha256,recordContentSha256:prior.recordContentSha256}
  need(seal.businessKey===event.businessKey&&equal(request.event,event)&&request.expectedFileSha256===previous.receipt.fileSha256&&
    request.expectedTick===0&&request.expectedStateVersion===1&&seal.input.sha256===event.evidence.inputRef.sha256&&
    equal(event.reasonRefs,[seal.output.sha256,seal.proof.sha256,seal.validation.sha256]),'head_worker_intent')
  const domainRecord={...record}
  for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete domainRecord[k]
  need(equal(request.record,domainRecord)&&input.schemaVersion==='world-weather-committed-model-input-v1'&&input.scope===a.mode&&
    equal(input.identity,BASELINE_IDENTITY)&&equal(input.before,expectedBefore)&&equal(input.interval,event.interval)&&
    input.modelSha256===a.policy.modelRef.sha256&&observed.maintenanceBusinessKey===previous.receipt.businessKey&&
    observed.maintenanceEventSha256===previous.receipt.eventSha256&&observed.maintenanceReceiptContentSha256===digest(previous.receipt)&&
    equal(input.randomBefore,{use:'not_consumed',stateSha256:digest(prior.randomState)})&&equal(input.history.at(-1),prior.worldState.payload.environment.evolution.weather.values),'head_worker_input')
  need(validation.mode===a.mode&&equal(validation.before,expectedBefore)&&validation.inputSha256===seal.input.sha256&&
    validation.rawOutputSha256===seal.output.sha256&&validation.modelSha256===a.policy.modelRef.sha256&&equal(validation.native,seal.proof)&&
    validation.budget.path===a.budget.path&&validation.budget.sha256===a.budget.sha256&&
    validation.release.path===a.capabilityRef.id&&validation.release.sha256===a.capabilityRef.sha256,'head_worker_validation')
  need(native.ownerClosed===true&&native.cleanupConfirmed===true&&native.guardReleaseConfirmed===true&&
    native.ownerIdentity.pid===p.ownerPid&&Number.isSafeInteger(p.rootPid)&&p.rootPid>0&&p.rootPid===output.pid&&
    p.exitCode===0&&p.assignedBeforeResume===true&&p.killOnJobClose===true&&p.activeProcessesAfterCleanup===0&&
    !p.observationError&&!p.cleanupError&&!native.protocolError&&output.modelForwards===1&&output.trainingUpdates===0&&
    Number.isSafeInteger(j.peakCommittedBytes)&&j.peakCommittedBytes>0&&j.peakCommittedBytes<=j.maxCommittedBytes&&
    j.maxCommittedBytes===1536*1048576&&j.cpuAffinityCount===2&&j.maxProcesses===1&&
    output.inputSha256===seal.input.sha256&&output.checkpointSha256===a.policy.modelRef.sha256&&
    equal(output.values,record.worldState.payload.environment.evolution.weather.values),'head_worker_result')
}

function releasedForecastAuthority(projectRoot,file){
  const a=readDisplayRelease(projectRoot,FIRST_WEATHER_SCOPED_PATH,FIRST_WEATHER_SCOPED_VERSION,file).value
  need(a.verificationStatus==='verified_from_machine_adjudication_and_trusted_registry'&&
    a.release.modelCapabilityVersion===FIRST_WEATHER_SCOPED_VERSION&&a.release.capabilityReleaseIdentity===FIRST_WEATHER_SCOPED_VERSION,'head_evolution_release')
  const policyFile=file(FIRST_WEATHER_SCOPED_POLICY_PATH,65536),policy=JSON.parse(policyFile.bytes)
  const contract=a.verifiedBindings.runtimeInterfaceContract
  need(contract.path==='data/ai-painter/system-governance/sakaerat-first-committed-weather-runtime-v3.json','head_evolution_budget')
  const raw=file(contract.path,65536),budget=JSON.parse(raw.bytes)
  need(raw.sha256===contract.sha256&&budget.version===FIRST_WEATHER_SCOPED_VERSION&&budget.requiredCapabilityScope==='world_evolution'&&
    budget.policyPath===FIRST_WEATHER_SCOPED_POLICY_PATH&&equal(budget.identity,BASELINE_IDENTITY)&&equal(policy.identity,BASELINE_IDENTITY)&&
    a.verifiedBindings.modelArtifact.sha256===policy.modelRef.sha256,'head_evolution_budget')
  const ref=(id,sha256)=>({id,version:FIRST_WEATHER_SCOPED_VERSION,sha256})
  return {policyRef:ref(FIRST_WEATHER_SCOPED_POLICY_PATH,policyFile.sha256),capabilityRef:ref(FIRST_WEATHER_SCOPED_PATH,a.capabilityReleaseSha256),
    registrySha:a.trustedReleaseRegistrySha256,policy,interval:budget.firstInterval,budget:contract,mode:'production',
    run:'.runtime/ai-painter/world-first-weather-runtime/v3',weatherOrigin:'model_predicted'}
}

// Keep the original creation verifier (including all 157 code hashes) untouched.
// The single substitution is the original Store read at creation, after rehashing
// the exact transaction's immutable before-image and matching its verified genesis.
export function readBaselineAndCurrentHead(options,readOriginalBaseline){
  const historical=readOriginalBaseline(options)
  if(historical.status!=='unverifiable')return historical
  const {read,readFresh,readAtUtc}=options
  try{
    const selection=JSON.parse(read(BASELINE_SELECTION,65536).bytes)
    if(selection.schemaVersion!==COMPAT_SCHEMA||selection.deliveryId!==options.deliveryId)return historical
    const pending=pendingJournal(read)
    function file(p,max=256*1024){
      const r=read(p,max);need(r.bytes.length<=max&&sha(r.bytes)===r.sha256,'head_bytes');return r
    }
    const actual=file(store)
    let live=actual
    if(pending){
      const journal=JSON.parse(pending.bytes),{state,transactionId,...payload}=journal
      need(['prepared','committed'].includes(state)&&transactionId===digest(payload)&&journal.recordPath===resolveRuntimePath(options.projectRoot,store)&&
        equal(journal.identity,BASELINE_IDENTITY)&&shaPattern.test(journal.businessKey)&&shaPattern.test(journal.before.fileSha256)&&
        journal.before.name===journal.businessKey+'.'+journal.before.fileSha256+'.before.json','head_pending_journal')
      need(shaPattern.test(journal.next.fileSha256)&&[journal.before.fileSha256,journal.next.fileSha256].includes(actual.sha256)&&
        (state!=='committed'||actual.sha256===journal.next.fileSha256),'head_pending_live_record')
      live=file(store+'.evolution/'+journal.before.name)
      need(live.sha256===journal.before.fileSha256,'head_pending_before')
    }
    const record=JSON.parse(live.bytes),advanced=Number.isSafeInteger(record.tick)&&record.tick>=1&&record.stateVersion===record.tick+1&&record.eventCursor===record.tick+1
    let maintenance,head,days=[],rolling=null,scheduled=null
    if(advanced){
      const registry=file(TRUSTED_RELEASE_REGISTRY_PATH,1024*1024),releaseFile=file(FIRST_WEATHER_SCOPED_PATH,256*1024)
      const registration=file(registered.path,32768)
      need(registration.sha256===registered.sha256,'head_registration')
      const original=JSON.parse(registration.bytes),registeredKey=original.commit.businessKey
      const saved=file(store+'.evolution/'+registeredKey+'.'+original.after.fileSha256+'.record.json')
      maintenance=readFirstMaintenance(file,options.projectRoot,saved)
      const authority=releasedForecastAuthority(options.projectRoot,file)
      need(releaseFile.sha256===authority.capabilityRef.sha256&&registry.sha256===authority.registrySha,'head_evolution_release')
      let predecessor=live
      const scheduledRelease=record.tick>3?scheduledAuthority(options.projectRoot,file):null
      if(scheduledRelease){
        const origin=scheduledRelease.cfg.origin
        need(record.tick<=scheduledRelease.cfg.validatedForecastDays,'head_scheduled_range')
        predecessor=file(store+'.evolution/'+origin.businessKey+'.'+origin.fileSha256+'.record.json')
        need(predecessor.sha256===origin.fileSha256,'head_scheduled_anchor')
      }
      const chain=[]
      for(let tick=JSON.parse(predecessor.bytes).tick;tick>=2;tick--){
        const saved=JSON.parse(predecessor.bytes),ec=saved.worldState.payload.environment.evolution.commit
        need(saved.tick===tick&&shaPattern.test(ec.businessKey)&&shaPattern.test(ec.eventSha256),'head_rolling_chain')
        const marker=JSON.parse(file(store+'.evolution/'+ec.businessKey+'.'+ec.eventSha256+'.commit.json',65536).bytes)
        const item=readCommittedHeadBundle(file,options.projectRoot,store,predecessor,marker.before.fileSha256)
        chain.unshift(item);predecessor=item.before
      }
      head=verifyFirstForecastRecord({read:file,projectRoot:options.projectRoot,logical:store,live:predecessor,previous:maintenance,authority})
      days=[summarizeWeatherDay(maintenance,head)]
      const rollingPath='data/ai-painter/capability-releases/sakaerat-weather-153-rolling-v4/release.json'
      const registryContent=JSON.parse(registry.bytes)
      const listed=registryContent.releaseRecords.some(r=>r.releasePath===rollingPath)
      need(!chain.length||listed,'head_rolling_unreleased')
      if(listed){
        const a=rollingAuthority(options.projectRoot,file),result=verifyRollingDays(options.projectRoot,head,chain,a)
        rolling=rollingBudgetStatus(options.projectRoot,a,result.head,result.days)
        days.push(...result.days);head=result.head
        need(readFresh(rollingPath,256*1024).sha256===a.release.sha256,'head_rolling_release_changed')
      }
      if(scheduledRelease){
        const result=projectScheduledHead({root:options.projectRoot,store,live,file,readBundle:readCommittedHeadBundle,anchor:head,early:days,maintenance,a:scheduledRelease})
        days.push(result.day);head=result.head;scheduled=result.scheduled
        need(readFresh(scheduledRelease.capability.path,256*1024).sha256===scheduledRelease.capability.sha256,'head_scheduled_release_changed')
      }
      need(readFresh(TRUSTED_RELEASE_REGISTRY_PATH,1024*1024).sha256===registry.sha256&&
        readFresh(FIRST_WEATHER_SCOPED_PATH,256*1024).sha256===releaseFile.sha256,'head_evolution_release_changed')
    }else{
      head=maintenance=readFirstMaintenance(file,options.projectRoot,live)
    }
    const baseline=readOriginalBaseline({...options,read:(logical,max)=>logical===store?maintenance.before:read(logical,max)})
    if(baseline.status!=='baseline_verified')return baseline
    need(baseline.store.sha256===maintenance.before.sha256,'head_unrelated_baseline')
    need(pendingJournal(readFresh)?.sha256===pending?.sha256&&readFresh(store,256*1024).sha256===actual.sha256,'head_changed')
    return {...baseline,label:record.tick>=2?'同一世界的天气演化与存档已核验':advanced?'同一世界的初创、天气初始化与首次演化已核验':'同一世界的初创基线与当前维护提交已核验',
      genesisArchive:{path:store+'.evolution/'+maintenance.receipt.businessKey+'.'+maintenance.before.sha256+'.before.json',sha256:maintenance.before.sha256},
      currentHead:{tick:head.receipt.tick,stateVersion:head.receipt.stateVersion,eventCursor:head.receipt.eventCursor,kind:head.event.eventKind,
        businessKey:head.receipt.businessKey,fileSha256:head.live.sha256,eventSha256:head.eventSha,
        receiptSha256:head.receiptSha,journalSha256:head.markerSha,logicalEndUtc:head.epoch,readAtUtc,days,rolling,scheduled,pendingTransaction:Boolean(pending)},
      reason:record.tick>=2?`服务器已保存 ${record.tick} 个模拟日的天气，事件游标为 ${record.eventCursor}，其中包含一次天气初始化。`:advanced?`服务器已根据本地天气模型推进了一个模拟日，当前为第 ${head.receipt.tick} 步、状态版本 ${head.receipt.stateVersion}，两条历史事件分别是天气初始化和首次演化。`:
        `服务器已提交首次天气初始化。当前世界步数为 ${head.receipt.tick}、状态版本为 ${head.receipt.stateVersion}，共有 ${head.receipt.eventCursor} 条历史事件。此次维护经过的模拟时间为 0 秒。`,
      readVerification:scheduled?`已核验初创至第 3 日的记录、本轮累计预算账本、当前及前一笔存档和收据，以及第 ${record.tick} 日的模型输入、输出与受管进程。最近一次提交的逻辑时间为 ${head.epoch}。`:record.tick>=2?`已核对维护和首日记录，以及此后每一天的七日输入、天气输出、原生进程、事务收据与世界存档。最近一次提交的逻辑时间为 ${head.epoch}。`:advanced?`本地天气模型完成一次计算，系统已核对其受信版本、输入、实际输出、进程回执和前后存档。气温由 ${maintenance.record.worldState.payload.environment.evolution.weather.values[2].toFixed(2)} °C 变为 ${head.record.worldState.payload.environment.evolution.weather.values[2].toFixed(2)} °C，本步结束于 ${head.epoch}。`:
        `已分别核验初创时的存档、服务器当前存档、维护事件、事务日志及提交回执。天气初始化的模拟时间为 ${head.epoch}。`}
  }catch(error){
    return {...historical,reason:error?.message==='baseline_head_changed'?'读取期间出现新的存档或事务。下次刷新将重新核对已提交的版本。':'平台未能把当前存档、同一世界的原始事务与相应的执行凭证核对一致。',reasonCode:
      /^baseline_head_[a-z_]+$/.test(error.message)?error.message:'baseline_head_unverifiable'}
  }
}
