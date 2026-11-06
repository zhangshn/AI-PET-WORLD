import fs from 'node:fs'
import path from 'node:path'
import {setTimeout as wait} from 'node:timers/promises'
import {execFileSync} from 'node:child_process'
import {ROOT, safe, read, bind, bound, json, digest, equal, idOf, featureSha, invariant,
  remapJournal, runtime, sha, observe, utc} from './world-initialized-evolution.mjs'
import {LOOP_RUNTIME_FILES} from '../tests/helpers/world-evolution-loop-loader.mjs'
import {launchProjectCommandBackground, validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'

export const BASE='.runtime/ai-painter/controller-repair-reviews/world-environment-background-166-20261031'
export const RUN=BASE+'/runtime/actual-run'
export const ENTRY='scripts/run-world-environment-scheduled.mjs'
const BOOT='ml/ai-painter/scripts/world_environment_scheduled_bootstrap.py'
const fixed=(p,h)=>JSON.parse(bound({path:p,sha256:h}))
const MODEL='26b87b4294e9cae347afe795a094b0a3955f31580ae7312a7483212345cc7d78'
const CONFIG='7353c10c25a71f58318eb62b98ebcb89cae3bf369e1336bbeed90b1dc1208283'
const c=fixed(BASE+'/model/model-contract.json',MODEL)
const cfg=fixed(BASE+'/runtime-config.json',CONFIG)
const a=fixed(BASE+'/task-alignment.json','5cd454a586c39f822d1d1c33add6b7025ea86d225514028b939f44c18683bb71')
const i=fixed(BASE+'/model/interpreter-contract.json','303f5dc4a945c20c9d71c7b1cf605ab910dca3f788104541942763fcf8b5625d')
const now=()=>new Date().toISOString()
const need=(v,msg)=>{if(!v)throw Error('scheduled166_'+msg)}
const info=(r)=>({path:r.path,sha256:r.sha256})
const ref=r=>({id:r.path,sha256:r.sha256,version:'private166-v1'})
const ev=r=>r.worldState.payload.environment.evolution
const counts=r=>({tick:r.tick,stateVersion:r.stateVersion,eventCursor:r.eventCursor})
const opt={root:ROOT,runnerPath:ENTRY,launchIdentity:cfg.launchIdentity,runnerArgs:['--run'],receiptRoot:cfg.receiptRoot}
const receiptPath=cfg.receiptRoot+'/'+cfg.launchIdentity+'/launch-receipt.json'
const sourceRoot=c.sourceRecordRef.path.split('/store/')[0]+'/store/'
function original(ref){
  const tail=path.relative(fs.realpathSync(path.join(ROOT,'.runtime')),ref.absolutePath).split(path.sep).join('/')
  const p='.runtime/'+tail
  need(p.startsWith(sourceRoot),'source_path')
  return {...info({path:p,sha256:ref.sha256}),bytes:ref.bytes}
}
function guarded(){
  for(const x of [...a.documents,...a.protected,...a.source164.files.map(original),cfg.sourceRef,c.checkpoint,c.reusedWorker,...c.modelCodeBindings,
    c.sourceSeedRecordRef,c.sourceInputRef,c.sourceOutputRef,c.sourceForwardProcessRef,c.archiveRef,c.archiveReceiptRef,cfg.backgroundLauncher,i.venvConfig,i.worker])bound(x)
  bound({path:BOOT,sha256:'f2ea5e236a0e8b59d9701958a153868e08fec8ebc71d9aff494d91dca7ba0129'})
  need(sha(fs.readFileSync(i.directInterpreter.path))===i.directInterpreter.sha256,'interpreter')
}
function save(p,v){
  need(p.startsWith(RUN+'/')&&p.endsWith('.json'),'write_scope')
  const target=safe(p); fs.mkdirSync(path.dirname(target),{recursive:true})
  const fd=fs.openSync(target,'wx')
  try{fs.writeFileSync(fd,JSON.stringify(v,null,2)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  return bind(p)
}
function usage(){
  let bytes=0,files=0
  function visit(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){
    const f=path.join(p,e.name),s=fs.lstatSync(f)
    need(!s.isSymbolicLink(),'artifact_link')
    if(e.isDirectory())visit(f)
    else{need(s.isFile()&&s.nlink===1,'artifact_type');files++;bytes+=s.size}
  }}
  visit(safe(BASE+'/runtime'))
  need(files<=cfg.resources.artifactFilesMaximum&&bytes<=cfg.resources.artifactBytesMaximum,'artifact_budget')
  return {files,bytes}
}
async function open(){
  const r=await runtime(), store=r.store.createProductionWorldRuntimeStore(safe(cfg.snapshotRoot))
  const current=()=>store.readNatural({ownerId:c.identity.ownerId,worldId:c.identity.worldId,expectedPlayerId:c.identity.playerId})
  const event=businessKey=>store.readNaturalTransition({identity:c.identity,businessKey})
  return {r,store,current,event}
}
function policy(r){
  const key=(p)=>ref(bind(p))
  const p=json(sourceRoot.slice(0,-6)+'diagnostic-policy.json')
  delete p.contentSha256
  Object.assign(p,{policyId:'private-scheduled-world166',policyVersion:'private166-v1',scopeId:'private-scheduled-verification',
    ruleVersion:'private166-v1',capabilityRef:{id:'no-production-capability',version:'private166-v1',sha256:MODEL},
    timePolicy:cfg.timePolicy,modelRef:ref(c.checkpoint),validatorRef:key('src/world/runtime/world-environment-validator.ts'),
    inputSchemaRef:key(BASE+'/model/model-contract.json'),executionPolicyRef:key(BASE+'/runtime-config.json'),resourceContractRef:key(BASE+'/runtime-config.json'),
    registrationEvidenceRefs:[key(BASE.replace('background-166','qualification-165')+'/controller-acceptance.json')]})
  Object.assign(p.historyPolicy,{selectorId:'shift-seven-verified-rows',selectorVersion:'private166-v1',maxEvents:4,minimumContextEvents:1,
    evidenceRefs:[key(BASE+'/model/model-contract.json')]})
  const candidate={...p,contentSha256:r.policy.computeWorldEvolutionPolicySha(p)}
  r.policy.validateWorldEvolutionPolicy(candidate,c.identity)
  return candidate
}
export function makeInput(step,current,event,prevInput,prevOutput){
  const spec=c.steps[step-1], rec=current.record, e=ev(rec)
  need(spec&&current.status==='found'&&equal(idOf(rec),c.identity)&&equal(counts(rec),spec.before),'input_identity_or_counts')
  need(event.eventKind==='evolution'&&event.eventSha256===e.commit.eventSha256&&event.cursor===rec.eventCursor&&
    equal(event.identity,c.identity)&&e.logicalEndUtc===spec.interval.logicalStartUtc&&
    equal(event.changes.map(x=>x.newValue),e.weather.values)&&equal(e.weather.values,prevOutput.values),'input_committed_weather')
  const previousEventRef=info(bind(c.recordPath+'.evolution/'+event.businessKey+'.'+event.eventSha256+'.event.json'))
  const provenance=structuredClone(prevInput.provenance.slice(1))
  for(const row of provenance)if(row.origin==='initialized_store_weather')row.sourceRef=info(c.sourceSeedRecordRef)
  provenance.push({origin:'committed_model_output',sourceRef:previousEventRef,periodStartUtc:prevInput.interval.logicalStartUtc,
    periodEndUtc:prevInput.interval.logicalEndUtc,note:'Read from the preceding committed evolution.'})
  return {schemaVersion:c.inputContract.schemaVersion,taskId:c.taskId,contractSha256:MODEL,mode:'primary',step,identity:c.identity,
    before:{...counts(rec),fileSha256:current.fileSha256,recordContentSha256:rec.recordContentSha256},interval:spec.interval,
    window:{fieldOrder:c.fieldOrder,units:c.units,values:[...prevInput.window.values.slice(1),e.weather.values]},provenance,previousEventRef}
}
async function inputFor(step,ctx){
  const current=await ctx.current();need(current.status==='found','read_current')
  const last=await ctx.event(ev(current.record).commit.businessKey);need(last.status==='found','read_previous_event')
  const prior=step===1?[c.sourceInputRef,c.sourceOutputRef]:['input','output'].map(k=>bind(RUN+'/step-1/'+k+'.json'))
  return {current,input:makeInput(step,current,last.event,...prior.map(x=>JSON.parse(bound(x))))}
}
function python(args,raw,limit){
  return observe(i.directInterpreter.path,[...i.args,safe(BOOT),...args],raw,Math.min(30000,limit))
}
function done(p){need(p.exitCode===0&&!p.signal&&!p.error,'process_failed: '+String(p.stderr||p.error).slice(-1200));return JSON.parse(p.stdout)}
export async function prepare(){
  guarded()
  const existing=fs.existsSync(safe(RUN));need(!existing,'attempt_already_prepared')
  fs.mkdirSync(safe(RUN),{recursive:true})
  const mapping=[]
  for(const source of a.source164.files.map(original)){
    const dest=cfg.snapshotRoot+'/'+source.path.slice(sourceRoot.length), raw=bound(source)
    const changed=dest.endsWith('.commit.json')
    const output=changed?remapJournal(raw,safe(c.sourceRecordRef.path),safe(c.recordPath)):raw
    fs.mkdirSync(path.dirname(safe(dest)),{recursive:true});fs.writeFileSync(safe(dest),output,{flag:'wx'})
    mapping.push({source,destination:bind(dest),changedFields:changed?['recordPath','transactionId']:[]})
  }
  need(mapping.length===11&&mapping.filter(x=>x.changedFields.length).length===2,'snapshot_mapping')
  const ctx=await open()
  for(const row of mapping.filter(x=>x.destination.path.endsWith('.event.json'))){
    const e=json(row.destination.path), restored=await ctx.event(e.businessKey)
    need(restored.status==='found'&&equal(restored.event,e),'original_event')
  }
  const {input}=await inputFor(1,ctx)
  const inputRef=save(RUN+'/preflight-input.json',input)
  const ident=python(['--identity-check'],Buffer.alloc(0),30000), parse=done(ident)
  need(parse.pid===ident.pid&&parse.modelForwardRuns===0&&parse.workerSha256===i.worker.sha256&&
    path.resolve(parse.executable)===path.resolve(i.directInterpreter.path)&&parse.interpreterSha256===i.directInterpreter.sha256,'identity')
  const zero=python(['--check-input'],bound(inputRef),30000), checked=done(zero)
  need(checked.step===1&&checked.pid===zero.pid&&checked.modelForwardRuns===0,'preflight')
  const p=save(RUN+'/private-policy.json',policy(ctx.r))
  const pre=save(RUN+'/preflight.json',{mapping,inputRef,identityProcess:ident,sourceCheck:zero,privatePolicyRef:p})
  const code=[ENTRY,'scripts/lib/world-environment-scheduled-run.mjs','scripts/lib/world-initialized-evolution.mjs',
    'scripts/tests/helpers/world-evolution-loop-loader.mjs','scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs',
    'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs',...LOOP_RUNTIME_FILES.map(f=>'src/world/runtime/'+f),
    'src/world/runtime/world-evolution-policy.ts','src/world/runtime/world-environment-validator.ts']
  const manifest=save(RUN+'/execution-contract.json',{config:bind(BASE+'/runtime-config.json'),preflight:pre,bindings:[...code.map(bind),p,inputRef,
    ...mapping.filter(x=>x.destination.path!==c.recordPath).map(x=>x.destination)],productionReady:false})
  guarded();usage();return manifest
}
function frozen(){
  guarded()
  const m=json(RUN+'/execution-contract.json')
  for(const item of [m.config,m.preflight,...m.bindings])bound(item)
  return bind(RUN+'/execution-contract.json')
}
function processIdentity(pid){
  need(Number.isSafeInteger(pid)&&pid>0,'cim_pid')
  const cmd="$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+"'; if($null -eq $p){'null'}else{[ordered]@{pid=[int]$p.ProcessId;creationDateUtc=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}"
  const v=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],
    {windowsHide:true,timeout:6000,maxBuffer:4096,encoding:'utf8'}))
  need(v===null||(v.pid===pid&&Number.isFinite(Date.parse(v.creationDateUtc))),'cim_result')
  return v
}
export function launch(){
  const manifest=frozen(), identity=processIdentity(process.pid);need(identity,'launch_client_missing')
  need(!fs.existsSync(safe(cfg.receiptRoot+'/'+cfg.launchIdentity)),'launch_already_attempted')
  save(RUN+'/launch-client.json',{identity,manifest,atUtc:now()})
  const receipt=launchProjectCommandBackground(opt)
  validateProjectCommandBackgroundReceipt({...opt,receipt})
  return {receiptPath,clientPid:process.pid,serverPid:receipt.processId}
}
async function exitProof(){
  const client=json(RUN+'/launch-client.json');bound(client.manifest)
  const start=performance.now()
  while(performance.now()-start<20000){
    const current=processIdentity(client.identity.pid)
    if(!current||current.creationDateUtc!==client.identity.creationDateUtc){
      const receipt=json(receiptPath)
      validateProjectCommandBackgroundReceipt({...opt,receipt})
      need(receipt.processId===process.pid&&processIdentity(process.pid)?.creationDateUtc===receipt.processCreationDateUtc,'runner_identity')
      return {identity:client.identity,observed:current,atUtc:now(),backgroundPid:process.pid,receipt:bind(receiptPath)}
    }
    await wait(300)
  }
  throw Error('launch_client_exit_not_observed')
}
export function checkedOutput(input,inputRaw,proc){
  const o=done(proc)
  need(equal(Object.keys(o).sort(),[...c.outputContract.exactFields].sort())&&o.schemaVersion===c.outputContract.schemaVersion&&
    o.taskId===c.taskId&&o.mode==='primary'&&o.step===input.step&&o.contractSha256===MODEL,'output_schema')
  need(o.inputBytesSha256===sha(inputRaw)&&o.featureValueSha256===featureSha(input.window.values)&&o.pid===proc.pid&&
    o.workerSha256===i.worker.sha256&&o.checkpointSha256===c.checkpoint.sha256,'output_lineage')
  need(equal(o.fieldOrder,c.fieldOrder)&&equal(o.units,c.units)&&Array.isArray(o.values)&&o.values.length===4&&o.values.every(Number.isFinite),'output_values')
  need(utc(o.startedAtUtc)>=utc(proc.startedAtUtc)-2&&utc(o.finishedAtUtc)<=utc(proc.finishedAtUtc)+2&&utc(o.finishedAtUtc)>=utc(o.startedAtUtc)&&
    Number.isFinite(o.elapsedSeconds)&&o.elapsedSeconds>=0&&o.elapsedSeconds<=30&&o.modelForwardRuns===1&&o.trainingUpdates===0&&
    o.worldWrites===0&&o.productionReady===false,'output_budget')
  return o
}
function transition(r,current,input,o,refs){
  const old=current.record, p=json(refs.policy.path), ids=c.fieldOrder.map(x=>'environment.'+x)
  const beforeValues=Object.fromEntries(ids.map((id,j)=>[id,ev(old).weather.values[j]]))
  const changes=ids.map((fieldId,j)=>({fieldId,operation:'replace',beforeValueSha256:digest(beforeValues[fieldId]),newValue:o.values[j],reasonRefs:[refs.output.sha256]}))
  const domain=r.domain.validateWorldEnvironmentDelta({identity:c.identity,policy:p,interval:input.interval,beforeValues,changes,result:'changes'})
  const next=structuredClone(old)
  for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete next[k]
  next.tick++;next.stateVersion++;next.eventCursor++;next.worldFacts.tick=next.worldState.tick=next.tick;next.savedAt=now()
  const e=ev(next);e.logicalEndUtc=input.interval.logicalEndUtc
  e.weather={fieldOrder:c.fieldOrder,units:c.units,values:ids.map(id=>domain.nextValues[id]),period:input.interval,origin:'model_predicted_private_simulation'}
  need(equal(invariant(old),invariant(next)),'unrelated_state_changed')
  const event={schemaVersion:'world-evolution-event-v1',identity:c.identity,eventId:'background166-evolution-'+input.step,businessKey:'0'.repeat(64),
    cursor:next.eventCursor,eventKind:'evolution',fromTick:old.tick,toTick:next.tick,fromStateVersion:old.stateVersion,toStateVersion:next.stateVersion,
    before:{expectedTick:old.tick,expectedStateVersion:old.stateVersion,expectedFileSha256:current.fileSha256,
      worldFactsPayloadSha256:old.worldFactsPayloadSha256,statePayloadSha256:old.statePayloadSha256,recordContentSha256:old.recordContentSha256},
    interval:input.interval,policyRef:ref(refs.policy),externalInputRefs:[c.archiveRef,c.archiveReceiptRef].map(ref),historyInputRef:ref(refs.history),
    evidence:{kind:'evolution',capabilityRef:p.capabilityRef,modelRef:ref(c.checkpoint),inputRef:ref(refs.input),outputRef:ref(refs.output),validatorRef:ref(refs.validator)},
    changes,reasonRefs:[refs.output.sha256],previousEventSha256:ev(old).commit.eventSha256,domainAfterSha256:r.transaction.computeWorldEvolutionDomainSha(next)}
  event.businessKey=r.transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=r.transaction.sealWorldEvolutionEvent(event)
  e.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:next.eventCursor,eventSha256:sealed.eventSha256}}
  return {domain,request:{record:next,event:sealed,expectedTick:old.tick,expectedStateVersion:old.stateVersion,expectedFileSha256:current.fileSha256}}
}
async function oneStep(step,ctx,anchor,remaining){
  const dir=RUN+'/step-'+step, {current,input}=await inputFor(step,ctx)
  const clockArgs={committedLogicalEndUtc:ev(current.record).logicalEndUtc,remainingStepBudget:3-step,remainingLogicalSeconds:(3-step)*86400,maxBatchSteps:1}
  let plan
  do{
    plan=ctx.r.clock.planWorldEvolutionBatch(anchor,{...clockArgs,monotonicNowMs:performance.now()})
    if(!plan.proposedSteps){
      const ms=Math.ceil(plan.nextScheduleInMilliseconds);need(ms<remaining(),'clock_deadline');await wait(ms)
    }
  }while(!plan.proposedSteps)
  need(plan.proposedSteps===1&&equal(plan.intervals,[input.interval]),'clock_interval')
  save(dir+'/clock.json',{plan,observedAtUtc:now(),monotonicMs:performance.now()})
  if(step===1)need(equal(input,json(RUN+'/preflight-input.json')),'preflight_changed')
  const inputRef=save(dir+'/input.json',input),raw=bound(inputRef)
  frozen();usage()
  need(remaining()>30000,'worker_budget')
  save(dir+'/forward-reservation.json',{pid:process.pid,atUtc:now(),maximumForwards:1,automaticRetry:0,inputRef})
  const proc=python([],raw,remaining());save(dir+'/forward-process.json',proc)
  const output=checkedOutput(input,raw,proc),outputRef=save(dir+'/output.json',output)
  const history=save(dir+'/history.json',{previousEventRef:input.previousEventRef,provenance:input.provenance,featureValueSha256:featureSha(input.window.values)})
  const built=transition(ctx.r,current,input,output,{policy:bind(RUN+'/private-policy.json'),input:inputRef,output:outputRef,history,validator:bind('src/world/runtime/world-environment-validator.ts')})
  save(dir+'/domain-validation.json',built.domain);save(dir+'/candidate.json',built.request)
  frozen();usage();need(remaining()>0,'commit_deadline')
  const commit=await ctx.store.writeNaturalTransition(built.request);save(dir+'/commit.json',commit)
  need(commit.ok&&!commit.replayed&&equal(counts(commit.receipt),{tick:step+1,stateVersion:step+2,eventCursor:step+2}),'commit: '+commit.message)
  const replay=await ctx.store.writeNaturalTransition(built.request);save(dir+'/replay.json',replay)
  need(replay.ok&&replay.replayed&&equal(commit.receipt,replay.receipt),'replay')
  return counts(commit.receipt)
}
export async function readback(){
  frozen()
  const ctx=await open(), current=await ctx.current(), old=JSON.parse(bound(c.sourceRecordRef))
  need(current.status==='found'&&equal(counts(current.record),{tick:3,stateVersion:4,eventCursor:4})&&
    equal(invariant(current.record),invariant(old)),'restored_state')
  const dir=c.recordPath+'.evolution',names=fs.readdirSync(safe(dir)).filter(s=>s.endsWith('.event.json'))
  const events=[]
  for(const name of names){
    const event=json(dir+'/'+name), restored=await ctx.event(event.businessKey)
    need(restored.status==='found'&&equal(event,restored.event),'event_readback')
    events.push(event)
  }
  events.sort((x,y)=>x.cursor-y.cursor)
  need(equal(events.map(e=>e.eventKind),['maintenance','evolution','evolution','evolution'])&&
    events.every((e,j)=>e.cursor===j+1&&(!j||e.previousEventSha256===events[j-1].eventSha256)),'event_chain')
  for(const step of [1,2]){
    const dir=RUN+'/step-'+step, p=json(dir+'/forward-process.json'), input=json(dir+'/input.json')
    const output=checkedOutput(input,read(dir+'/input.json'),p), event=events[step+1]
    const commit=json(dir+'/commit.json'), replay=json(dir+'/replay.json')
    need(equal(output,json(dir+'/output.json'))&&equal(event.changes.map(ch=>ch.newValue),output.values)&&
      commit.receipt.eventSha256===event.eventSha256&&replay.replayed&&equal(replay.receipt,commit.receipt)&&
      event.evidence.outputRef.sha256===bind(dir+'/output.json').sha256&&event.evidence.inputRef.sha256===bind(dir+'/input.json').sha256&&
      input.previousEventRef.sha256===sha(read(c.recordPath+'.evolution/'+events[step].businessKey+'.'+events[step].eventSha256+'.event.json')),'restored_lineage')
  }
  need(current.fileSha256===json(RUN+'/step-2/commit.json').receipt.fileSha256&&
    ev(current.record).commit.eventSha256===events[3].eventSha256&&equal(ev(current.record).weather.values,json(RUN+'/step-2/output.json').values),'final_weather')
  return {pid:process.pid,...counts(current.record),fileSha256:current.fileSha256,events:events.map(e=>({kind:e.eventKind,cursor:e.cursor,sha256:e.eventSha256})),
    weather:ev(current.record).weather,productionReady:false}
}
export async function run(){
  const start=performance.now(),remaining=()=>180000-(performance.now()-start)
  const proof=await exitProof()
  frozen();save(RUN+'/client-exit-observed.json',proof)
  const ctx=await open(), initial=await ctx.current()
  need(initial.status==='found'&&initial.fileSha256===c.sourceRecordRef.sha256,'background_start')
  const anchor=ctx.r.clock.createWorldEvolutionClockAnchor({policy:cfg.timePolicy,lastCommittedLogicalEndUtc:ev(initial.record).logicalEndUtc,
    monotonicNowMs:performance.now(),recoveredPendingSteps:0})
  for(const step of [1,2])await oneStep(step,ctx,anchor,remaining)
  const cp=observe(process.execPath,[safe(ENTRY),'--readback'],Buffer.alloc(0),Math.min(30000,remaining()))
  save(RUN+'/readback-process.json',cp)
  const restored=done(cp);need(restored.pid===cp.pid&&restored.pid!==process.pid,'readback_process')
  save(RUN+'/readback.json',restored);frozen();need(remaining()>0,'deadline')
  return save(RUN+'/result.json',{status:'completed_bounded_private_background_run',finishedAtUtc:now(),backgroundPid:process.pid,elapsedMs:performance.now()-start,
    clientExitObservedAtUtc:proof.atUtc,initialCounts:counts(initial.record),finalCounts:counts(restored),steps:2,actualModelForwards:2,
    idempotentReplays:2,readbackPid:restored.pid,stopReason:'two_step_budget_exhausted',formalWorldWrites:0,trainingUpdates:0,productionReady:false,artifactsBeforeResult:usage()})
}
