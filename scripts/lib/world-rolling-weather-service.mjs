import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {setTimeout as wait} from 'node:timers/promises'
import {pathToFileURL} from 'node:url'
import {launchProjectCommandBackground,validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {ROOT,bind,bound,digest,idOf,invariant,json,read,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {readWorldRollingWeatherInput,rollingLocations,ROLLING_BASE as base} from './world-rolling-weather-input.mjs'

const service='scripts/lib/world-rolling-weather-service.mjs',worker='ml/ai-painter/scripts/world_rolling_weather_forward.py'
const scope='qualification',cfgPath=base+'/qualification-budget.json',q=base+'/qualification'
const {store:root,artifacts}=rollingLocations(scope)
const old={path:'data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json',sha256:'e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a'}
const enc=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
const ref=r=>({id:r.path,sha256:r.sha256,version:'rolling-weather-qualification-v1'})
const snapshot=(dir,name,raw)=>{const file=dir+'/'+name;fs.writeFileSync(safe(file),Buffer.isBuffer(raw)?raw:enc(raw),{flag:'wx',flush:true});return bind(file)}
function contract(){
  const cfg=json(cfgPath),oldBudget=JSON.parse(bound(old))
  assert.equal(cfg.scope,'rolling-weather-sole-qualification-v1')
  assert.equal(cfg.maximumNewSteps,2);assert.equal(cfg.maximumModelForwards,2);assert.equal(cfg.formalWrites,0)
  assert.equal(cfg.initialTick,1);assert.deepEqual(cfg.identity,oldBudget.identity)
  assert.deepEqual(cfg.workerLimits,oldBudget.resources)
  assert.equal(cfg.maximumRunSeconds,180);assert.equal(cfg.automaticModelRetries,0)
  assert.deepEqual(cfg.clock,oldBudget.timePolicy)
  assert.equal(cfg.clock.downtimeMode,'freeze');assert.equal(cfg.clock.scheduleIntervalSeconds,15)
  for(const b of cfg.sources)bound(b)
  for(const p of [service,worker,'scripts/lib/world-rolling-weather-input.mjs']){
    assert(cfg.sources.some(r=>r.path===p&&r.sha256===bind(p).sha256),'missing frozen rolling executor')
  }
  assert.equal(cfg.domainPolicy.path,base+'/qualification-domain-policy.json')
  const domain=JSON.parse(bound(cfg.domainPolicy))
  const contractScope=JSON.parse(bound(cfg.qualificationScope))
  assert.equal(cfg.qualificationScope.path,base+'/qualification-scope.json')
  for(const key of ['capabilityRef','executionPolicyRef','resourceContractRef'])assert.deepEqual(domain[key],ref(cfg.qualificationScope))
  assert.equal(contractScope.maximumNewSteps,cfg.maximumNewSteps);assert.equal(contractScope.maximumModelForwards,cfg.maximumModelForwards)
  assert.equal(contractScope.formalWrites,0);assert.equal(contractScope.initialFileSha256,cfg.initialFileSha256)
  assert.deepEqual(domain.timePolicy,cfg.clock);assert.deepEqual(domain.identity,cfg.identity)
  const interpreter=JSON.parse(bound(oldBudget.interpreter)),exe=interpreter.directInterpreter
  bound(interpreter.venvConfig);assert.equal(fs.statSync(exe.path).size,exe.bytes);assert.equal(sha(fs.readFileSync(exe.path)),exe.sha256)
  return {cfg,domain,budget:bind(cfgPath),interpreter}
}
function processCreation(pid){
  assert(Number.isSafeInteger(pid)&&pid>0)
  const cmd="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+"';if($p){$p.CreationDate.ToUniversalTime().ToString('o')}"
  return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{windowsHide:true,encoding:'utf8',timeout:6000}).trim()||null
}
const option=kind=>({root:ROOT,runnerPath:service,runnerArgs:['--server-'+kind],receiptRoot:q+'/launches',launchIdentity:'rolling-weather-190-'+kind})
const launched=kind=>q+'/launches/'+option(kind).launchIdentity+'/launch-receipt.json'
const control=kind=>q+'/client-'+kind+'.json'
function activeServer(kind){
  if(!fs.existsSync(safe(launched(kind))))return false
  const r=json(launched(kind))
  validateProjectCommandBackgroundReceipt({...option(kind),receipt:r})
  return processCreation(r.processId)===r.processCreationDateUtc
}
export async function launchRollingWeatherQualification(kind='start'){
  assert(kind==='start'||kind==='resume')
  const {cfg,budget}=contract(),input=await readWorldRollingWeatherInput(scope)
  if(input.before.tick>=cfg.initialTick+cfg.maximumNewSteps)return {status:'step_budget_exhausted',cursor:input.before}
  const dispatch=json(base+'/qualification-dispatch.json')
  assert.equal(dispatch.budgetSha256,budget.sha256)
  if(kind==='start'){
    assert.equal(input.before.tick,cfg.initialTick)
    assert.equal(sha(enc(input)),dispatch.initialInputSha256)
    const end=Date.parse(dispatch.startBeforeUtc)
    assert(Date.now()<end&&end-Date.now()<=600000,'current bounded dispatch required')
  }else{
    assert(fs.existsSync(safe(control('start')))&&!activeServer('start'),'first server active or absent')
    assert(Date.now()-Date.parse(json(control('start')).startUtc)<cfg.maximumRunSeconds*1000,'overall schedule expired')
  }
  const info={clientPid:process.pid,clientCreation:processCreation(process.pid),startUtc:new Date().toISOString(),budget,input:input.before}
  snapshot(q,'client-'+kind+'.json',info)
  const receipt=launchProjectCommandBackground(option(kind))
  validateProjectCommandBackgroundReceipt({...option(kind),receipt})
  return {status:'detached_qualification_spawned',kind,clientPid:process.pid,serverPid:receipt.processId,receipt:bind(launched(kind))}
}

async function verifyDetached(kind){
  const c=json(control(kind)),since=performance.now()
  while(performance.now()-since<18000){
    if(processCreation(c.clientPid)!==c.clientCreation&&fs.existsSync(safe(launched(kind)))){
      const r=json(launched(kind));validateProjectCommandBackgroundReceipt({...option(kind),receipt:r})
      assert.equal(r.processId,process.pid);assert.equal(processCreation(process.pid),r.processCreationDateUtc)
      return {clientExited:true,clientPid:c.clientPid,serverPid:process.pid,serverStartUtc:r.processCreationDateUtc,receipt:bind(launched(kind)),checkedUtc:new Date().toISOString()}
    }
    await wait(250)
  }
  throw Error('detached weather server/client exit not verified')
}

function storageGuard(dir,limits,started,until){
  if(Date.now()>=until)return 'overall_deadline'
  if(fs.existsSync(safe(q+'/stop')))return 'requested_stop'
  const disk=fs.statfsSync(safe(dir),{bigint:true});if(disk.bavail*disk.bsize<BigInt(limits.minimumFreeDiskMiB)*1048576n)return 'disk_reserve'
  const files=fs.readdirSync(safe(dir));if(files.length>limits.artifactFilesMaximum)return 'artifact_file_limit'
  let bytes=0
  for(const name of files){
    try{const st=fs.lstatSync(safe(dir+'/'+name));if(!st.isFile()||st.nlink!==1)return 'artifact_type';bytes+=st.size}
    catch(e){if(e.code!=='ENOENT')throw e}
  }
  if(bytes>limits.artifactBytesMaximum)return 'artifact_bytes'
  let pulse=started
  try{pulse=fs.statSync(safe(dir+'/heartbeat')).mtimeMs}catch(e){if(e.code!=='ENOENT')throw e}
  return Date.now()-pulse>limits.staleSeconds*1000?'weather_heartbeat_stale':null
}

function checkedOutput(raw,owned,input,pid,limits){
  const out=JSON.parse(raw)
  assert.deepEqual(Object.keys(out).sort(),['checkpointSha256','historyValueSha256','inputSha256','job','modelForwards','pid','trainingUpdates','values'])
  assert(owned.liveOwnerCleanupConfirmed&&owned.ownerClosed&&owned.guardReleaseConfirmed&&owned.proof.assignedBeforeResume&&owned.proof.killOnJobClose&&owned.proof.exitCode===0&&owned.proof.activeProcessesAfterCleanup===0)
  assert.equal(out.pid,pid);assert.equal(pid,owned.proof.rootPid);assert.equal(out.historyValueSha256,input.historyValueSha256)
  assert.equal(out.inputSha256,sha(enc(input)));assert.equal(out.checkpointSha256,input.modelSha256)
  assert.equal(out.modelForwards,1);assert.equal(out.trainingUpdates,0)
  assert.equal(out.job.cpuAffinityCount,2);assert.equal(out.job.maxProcesses,1)
  assert.equal(out.job.maxCommittedBytes,limits.maxCommittedMemoryMiB*1048576)
  assert(out.job.peakCommittedBytes>0&&out.job.peakCommittedBytes<=out.job.maxCommittedBytes)
  assert(Array.isArray(out.values)&&out.values.length===4&&out.values.every(Number.isFinite))
  return out
}
function makeRequest(api,policy,current,input,out,refs,budget){
  const old=current.record,t=input.before.tick
  assert.equal(current.status,'found');assert.equal(current.fileSha256,input.before.fileSha256);assert.deepEqual(idOf(old),input.identity)
  const before=Object.fromEntries(policy.domainFields.map((f,i)=>[f.fieldId,input.history.at(-1)[i]]))
  const changes=policy.domainFields.flatMap((f,i)=>out.values[i]===before[f.fieldId]?[]:[{fieldId:f.fieldId,operation:'replace',
    beforeValueSha256:digest(before[f.fieldId]),newValue:out.values[i],reasonRefs:[refs.output.sha256]}])
  const outcome=api.domain.validateWorldEnvironmentDelta({policy,identity:input.identity,interval:input.interval,beforeValues:before,changes,result:changes.length?'changes':'no_change'})
  assert(outcome.domainValid)
  const record=structuredClone(old)
  for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete record[k]
  record.tick++;record.stateVersion++;record.eventCursor++;record.worldFacts.tick=record.worldState.tick=record.tick;record.savedAt=new Date().toISOString()
  const env=record.worldState.payload.environment.evolution
  env.logicalEndUtc=input.interval.logicalEndUtc
  env.weather={fieldOrder:input.fieldOrder,units:input.units,values:out.values,period:input.interval,origin:'model_predicted_private_simulation'}
  assert.deepEqual(invariant(record),invariant(old))
  const reason=[refs.output.sha256,refs.process.sha256,refs.input.sha256]
  const event={schemaVersion:'world-evolution-event-v1',eventId:'rolling-weather-day-'+record.tick,identity:input.identity,businessKey:'0'.repeat(64),eventKind:'evolution',
    cursor:record.eventCursor,fromTick:t,toTick:record.tick,fromStateVersion:old.stateVersion,toStateVersion:record.stateVersion,before:{
      expectedTick:t,expectedStateVersion:old.stateVersion,expectedFileSha256:current.fileSha256,recordContentSha256:old.recordContentSha256,
      statePayloadSha256:old.statePayloadSha256,worldFactsPayloadSha256:old.worldFactsPayloadSha256},interval:input.interval,
    policyRef:ref(refs.policy),historyInputRef:ref(refs.input),externalInputRefs:[...new Map(input.rows.flatMap(r=>r.provenance.archive?[r.provenance.archive,r.provenance.receipt]:[]).map(b=>[b.path,ref(b)])).values()],
    evidence:{kind:'evolution',capabilityRef:ref(budget),modelRef:policy.modelRef,inputRef:ref(refs.input),outputRef:ref(refs.output),validatorRef:policy.validatorRef},
    changes,reasonRefs:reason,previousEventSha256:input.head.eventSha256,domainAfterSha256:api.transaction.computeWorldEvolutionDomainSha(record)}
  event.businessKey=api.transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=api.transaction.sealWorldEvolutionEvent(event)
  env.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:record.eventCursor,eventSha256:sealed.eventSha256}}
  return {record,event:sealed,expectedTick:t,expectedStateVersion:old.stateVersion,expectedFileSha256:current.fileSha256}
}

async function tick(input,until,ctx,api){
  const id=input.identity,index=input.before.tick+1,segment='step-'+index+'-'+input.before.fileSha256,dir=artifacts+'/'+segment
  assert(index>ctx.cfg.initialTick&&index<=ctx.cfg.initialTick+ctx.cfg.maximumNewSteps)
  fs.mkdirSync(safe(artifacts),{recursive:true})
  const store=api.store.createProductionWorldRuntimeStore(safe(root)),q0={ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId}
  if(fs.existsSync(safe(dir))){
    assert(fs.existsSync(safe(dir+'/intent.json')),'already reserved without original journal; no retry')
    const intent=json(dir+'/intent.json'),request=JSON.parse(bound(intent.request))
    assert.equal(intent.input.sha256,sha(enc(input)));assert.equal(request.expectedFileSha256,input.before.fileSha256)
    const prev=await store.recoverNaturalTransition({identity:id,businessKey:request.event.businessKey});assert(prev.ok,prev.message)
    assert.equal(prev.receipt.eventSha256,request.event.eventSha256)
    return {receipt:prev.receipt,replayedFromOriginalJournal:true,newForwards:0}
  }
  fs.mkdirSync(safe(dir))
  const inputRef=snapshot(dir,'input.json',enc(input)),launch=snapshot(dir,'reservation.json',{serverPid:process.pid,budgetSha256:ctx.budget.sha256,
    inputSha256:inputRef.sha256,historyValueSha256:input.historyValueSha256,window:input.interval,from:input.before,atUtc:new Date().toISOString(),automaticRetries:0})
  let managed
  try{
    const start=Date.now(),l=ctx.cfg.workerLimits;assert.equal(storageGuard(dir,l,start,until),null)
    managed=await runOwnedWorker(ctx.interpreter.directInterpreter.path,[...ctx.interpreter.args,safe(worker),'qualification',segment,launch.sha256,inputRef.sha256],
      {cwd:ROOT,env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',PYTHONDONTWRITEBYTECODE:'1'},
        maxBuffer:l.logBytesPerStreamMaximum,timeout:Math.min(l.workerSecondsMaximum*1000,until-start),abortReason:()=>storageGuard(dir,l,start,until)})
    const outputRef=snapshot(dir,'output.json',Buffer.from(managed.stdout)),proc=snapshot(dir,'process.json',managed.ownedReceipt)
    const out=checkedOutput(managed.stdout,managed.ownedReceipt,input,Number(read(dir+'/heartbeat',32)),l)
    assert.deepEqual(await readWorldRollingWeatherInput(scope),input,'model result has stale or foreign history')
    assert.equal(contract().budget.sha256,ctx.budget.sha256)
    const current=await store.readNatural(q0)
    const request=makeRequest(api,ctx.domain,current,input,out,{output:outputRef,process:proc,input:inputRef,policy:ctx.cfg.domainPolicy},ctx.budget)
    api.transaction.snapshotNaturalWorldTransition(request)
    const req=snapshot(dir,'request.json',request)
    snapshot(dir,'intent.json',{request:req,input:inputRef,output:outputRef,process:proc})
    assert(Date.now()<until,'rolling schedule expired')
    const commit=await store.writeNaturalTransition(request);assert(commit.ok&&!commit.replayed,commit.message)
    const replay=await store.writeNaturalTransition(request);assert(replay.ok&&replay.replayed);assert.deepEqual(replay.receipt,commit.receipt)
    snapshot(dir,'receipt.json',commit.receipt)
    return {newForwards:1,input:inputRef,output:outputRef,process:proc,receipt:commit.receipt,replayed:true}
  }catch(error){
    snapshot(dir,'failure.json',{message:error.message,owned:error.ownedReceipt??managed?.ownedReceipt??null,stderr:error.stderr??null,atUtc:new Date().toISOString(),automaticRetries:0});throw error
  }
}

async function serve(kind){
  const ctx=contract(),api=await runtime(),exit=await verifyDetached(kind)
  const until=Date.parse(json(control('start')).startUtc)+ctx.cfg.maximumRunSeconds*1000
  const first=await readWorldRollingWeatherInput(scope),initialEnd=first.rows.at(-1).period.logicalEndUtc
  const anchor=api.clock.createWorldEvolutionClockAnchor({policy:ctx.cfg.clock,lastCommittedLogicalEndUtc:initialEnd,monotonicNowMs:performance.now(),recoveredPendingSteps:0})
  const steps=[],lastTick=ctx.cfg.initialTick+ctx.cfg.maximumNewSteps
  let latest=first
  while(latest.before.tick<lastTick){
    assert(Date.now()<until,'bounded rolling weather service expired')
    if(fs.existsSync(safe(q+'/stop')))return snapshot(q,'stopped-'+kind+'.json',{exit,steps,status:'requested_stop',cursor:latest.before})
    const end=latest.rows.at(-1).period.logicalEndUtc,remaining=lastTick-latest.before.tick
    const plan=api.clock.planWorldEvolutionBatch(anchor,{monotonicNowMs:performance.now(),committedLogicalEndUtc:end,
      remainingStepBudget:remaining,remainingLogicalSeconds:remaining*86400,maxBatchSteps:1})
    if(plan.proposedSteps===0){await wait(Math.min(1000,Math.max(1,plan.nextScheduleInMilliseconds)));continue}
    assert.deepEqual(plan.intervals[0],latest.interval)
    steps.push(await tick(latest,until,ctx,api));latest=await readWorldRollingWeatherInput(scope)
  }
  return snapshot(q,'completed-'+kind+'.json',{status:'step_budget_exhausted',client:exit,startedFrom:first.before,finishedAtUtc:new Date().toISOString(),
    final:latest.before,historyValueSha256:latest.historyValueSha256,steps,worldWrites:steps.filter(x=>x.newForwards===1).length,formalWorldWrites:0,missedDowntimeSteps:0})
}
export async function readRollingWeatherStatus(){
  const input=await readWorldRollingWeatherInput(scope)
  return {pid:process.pid,scope,cursor:input.before,historyValueSha256:input.historyValueSha256,
    nextInterval:input.interval,stepBudgetExhausted:input.before.tick>=3}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  assert.equal(process.argv.length,3)
  const mode=process.argv[2]
  if(mode==='--launch'||mode==='--resume')console.log(JSON.stringify(await launchRollingWeatherQualification(mode==='--launch'?'start':'resume')))
  else if(mode==='--server-start'||mode==='--server-resume')console.log(JSON.stringify(await serve(mode.slice(9))))
  else if(mode==='--status')console.log(JSON.stringify(await readRollingWeatherStatus()))
  else throw Error('fixed rolling-weather qualification command required')
}
