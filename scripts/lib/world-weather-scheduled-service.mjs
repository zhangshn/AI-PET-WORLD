import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync,spawnSync} from 'node:child_process'
import {setTimeout as wait} from 'node:timers/promises'
import {DatabaseSync} from 'node:sqlite'
import {loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH} from './ai-painter-autonomous-package-decision-core-v3.mjs'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {launchProjectCommandBackground,validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'
import {ROOT,bind,bound,digest,idOf,invariant,json,read,runtime,safe,sha} from './world-initialized-evolution.mjs'
import * as history from './world-weather-scheduled-history.mjs'
import * as leases from './world-weather-service-lease.mjs'

const version='sakaerat-weather-153-scheduled-v5'
const releasePath='data/ai-painter/capability-releases/'+version+'/release.json'
const officialBudget='data/ai-painter/system-governance/sakaerat-scheduled-weather-runtime-v5.json'
const officialPolicy='data/ai-painter/system-governance/mvp-natural-world-weather-policy-v5.json'
const predecessor={path:'data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json',sha256:'e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a'}
const accountingProof={path:'.runtime/ai-painter/controller-repair-reviews/world-service-lease-206-20261103/delivery.json',sha256:'b53f732228828bce8ced1d096b3c9bdccb4212a0bc6a78898d94d4eeecc8b42e'}
const incoming={historyReader:'scripts/lib/world-weather-scheduled-history.mjs',leaseLedger:'scripts/lib/world-weather-service-lease.mjs',
  runner:'scripts/lib/world-weather-scheduled-service.mjs',entry:'scripts/run-world-weather-service.mjs',worker:'ml/ai-painter/scripts/world_weather_scheduled_runtime.py',
  sharedForecast:'ml/ai-painter/scripts/world_weather_committed_forward.py'}
const qualification='.runtime/ai-painter/controller-repair-reviews/world-service-scheduled-runtime-210-20261103/qualification'
const realRoot='.runtime/ai-painter/world-weather-service/mvp-natural-world-001'
const encode=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
const same=(a,b)=>a?.path===b?.path&&a.sha256===b.sha256
const toRef=b=>({id:b.path,version,sha256:b.sha256})
const storeQuery=id=>({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})

function locations(mode){
  if(mode==='production')return {dir:realRoot,store:'data/world-runtime',budget:officialBudget,policy:officialPolicy}
  assert.equal(mode,'qualification')
  return {dir:qualification,store:qualification+'/store',budget:qualification+'/budget.json',policy:qualification+'/policy.json'}
}
function write(dir,name,value){
  const file=dir+'/'+name;fs.writeFileSync(safe(file),Buffer.isBuffer(value)?value:encode(value),{flag:'wx',flush:true});return bind(file)
}
async function readWorld(mode,enrollment=false){
  if(mode==='production')return enrollment?history.readScheduledWeatherEnrollmentAnchor():history.readScheduledWeatherHistory()
  return enrollment?history.readScheduledWeatherQualificationEnrollmentAnchor():history.readScheduledWeatherQualificationHistory()
}
function release(mode){
  const l=locations(mode)
  let capability,policy,budget
  if(mode==='production'){
    const verified=loadAndValidateReleasedCapabilityBinding({projectRoot:ROOT,capabilityReleasePath:releasePath,
      trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH,requiredCapabilityScope:'world_evolution'})
    assert.equal(verified.verificationStatus,'verified_from_machine_adjudication_and_trusted_registry')
    assert.equal(verified.release.capabilityReleaseIdentity,version);assert.equal(verified.release.modelCapabilityVersion,version)
    assert.equal(verified.release.capabilityScope,'world_evolution')
    const roles=verified.verifiedBindings
    assert.equal(roles.reviewContract.path,l.policy);assert.equal(roles.runtimeInterfaceContract.path,l.budget)
    assert.equal(roles.conditionContract.path,incoming.historyReader)
    assert.equal(roles.modelArtifact.sha256,history.WEATHER_CHECKPOINT)
    assert.equal(roles.datasetRelease.path,'data/world-samples/dataset-packages/sakaerat-daily-weather-153-v1/dataset-package.json')
    capability={path:releasePath,sha256:verified.capabilityReleaseSha256}
    policy={path:l.policy,sha256:roles.reviewContract.sha256};budget={path:l.budget,sha256:roles.runtimeInterfaceContract.sha256}
  }else{
    // Qualification evidence is confined by the fixed clone Store and private budget namespace.
    policy=bind(l.policy);budget=bind(l.budget);capability={path:budget.path,sha256:budget.sha256}
  }
  const cfg=JSON.parse(bound(budget)),domain=JSON.parse(bound(policy)),old=JSON.parse(bound(predecessor))
  const {contentSha256,...policyBody}=domain
  assert.equal(digest(policyBody),contentSha256)
  for(const role of ['capabilityRef','resourceContractRef','executionPolicyRef'])assert.deepEqual(domain[role],toRef(budget))
  assert.deepEqual(domain.inputSchemaRef,toRef(bind(incoming.historyReader)))
  assert.equal(cfg.schemaVersion,'sakaerat-scheduled-weather-runtime-v5');assert.equal(cfg.version,version);assert.equal(cfg.requiredCapabilityScope,'world_evolution')
  assert.equal(cfg.policyPath,l.policy);assert.deepEqual(cfg.identity,old.identity);assert.deepEqual(domain.identity,cfg.identity)
  assert.equal(cfg.originalCutoffUtc,history.WEATHER_EPOCH);assert.equal(cfg.validatedForecastDays,history.WEATHER_FORECAST_DAYS)
  assert.deepEqual(cfg.clock,old.timePolicy);assert.deepEqual(domain.timePolicy,cfg.clock);assert.deepEqual(cfg.workerLimits,old.resources)
  assert(same(cfg.sourceBudget,predecessor)&&same(cfg.model,old.checkpoint)&&same(cfg.interpreter,old.interpreter)&&same(cfg.qualification,accountingProof))
  assert.equal(domain.modelRef.sha256,cfg.model.sha256);bound(cfg.model);bound(cfg.qualification)
  for(const [k,p] of Object.entries(incoming)){assert.equal(cfg[k].path,p);bound(cfg[k])}
  assert.equal(cfg.maximumConcurrentWorkers,1);assert.equal(cfg.automaticModelRetries,0)
  assert.equal(cfg.formalWritesMaximum,mode==='production'?cfg.maximumNewSteps:0)
  for(const [n,low,high] of [[cfg.maximumNewSteps,1,27],[cfg.batchSize,1,2],[cfg.maximumBatchIssues,1,60],[cfg.batchLeaseMs,30000,180000],
    [cfg.maximumStepsPerActivation,1,3],[cfg.maximumActivations,1,30],[cfg.maximumRunSecondsPerActivation,30,180],
    [cfg.maximumSupervisedWindowSeconds,30,mode==='qualification'?180:1800]]){
    assert(Number.isSafeInteger(n)&&n>=low&&n<=high,'outside registered finite service bounds')
  }
  assert(cfg.maximumBatchIssues>=Math.ceil(cfg.maximumNewSteps/cfg.batchSize))
  assert(cfg.maximumActivations>=Math.ceil(cfg.maximumNewSteps/cfg.maximumStepsPerActivation))
  if(mode==='qualification')assert.deepEqual([cfg.maximumNewSteps,cfg.batchSize,cfg.maximumStepsPerActivation,cfg.maximumActivations],[3,2,2,2])
  const interpreter=JSON.parse(bound(cfg.interpreter));bound(interpreter.venvConfig);assert.deepEqual(interpreter.args,['-I','-X','utf8','-B'])
  assert.equal(fs.statSync(interpreter.directInterpreter.path).size,interpreter.directInterpreter.bytes)
  assert.equal(sha(fs.readFileSync(interpreter.directInterpreter.path)),interpreter.directInterpreter.sha256)
  for(const b of [old.worker,old.nativeOwner,old.nativeBuilder,old.supervisor])bound(b)
  return {mode,l,cfg,domain,interpreter,capability,budget,policy}
}
const repeatRelease=a=>{const latest=release(a.mode);assert(same(latest.capability,a.capability)&&same(latest.budget,a.budget)&&same(latest.policy,a.policy),'weather release changed')}

async function accounting(a,create,readOnly=false){
  const origin=await readWorld(a.mode,true),o=a.cfg.origin
  assert.deepEqual(o,{tick:3,stateVersion:4,eventCursor:4,fileSha256:origin.before.fileSha256,eventSha256:origin.head.eventSha256,
    businessKey:origin.head.businessKey,historyValueSha256:origin.historyValueSha256})
  return leases.openRegisteredWeatherServiceAccounting(a.mode,origin,{maxNewSteps:a.cfg.maximumNewSteps,batchSize:a.cfg.batchSize,
    maxBatchIssues:a.cfg.maximumBatchIssues,batchLeaseMs:a.cfg.batchLeaseMs},create,readOnly)
}
function creation(pid){
  assert(Number.isSafeInteger(pid)&&pid>0)
  const command="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+"';if($p){$p.CreationDate.ToUniversalTime().ToString('o')}"
  return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:6000,maxBuffer:4096,encoding:'utf8'}).trim()||null
}
function opts(a,index){
  assert(Number.isSafeInteger(index)&&index>=1&&index<=a.cfg.maximumActivations)
  return {root:ROOT,launchIdentity:'scheduled-weather-v5-'+a.mode+'-'+index,runnerPath:incoming.entry,
    runnerArgs:[a.mode==='production'?'--serve':'--qualify-serve',String(index)],receiptRoot:a.l.dir+'/launches'}
}
const receiptPath=opt=>opt.receiptRoot+'/'+opt.launchIdentity+'/launch-receipt.json'
const activation=(dir,i)=>dir+'/activation-'+i+'.json'
function inventory(a){
  const out=[];for(let i=1;i<=a.cfg.maximumActivations;i++){const file=activation(a.l.dir,i);if(!fs.existsSync(safe(file)))continue
    assert.equal(out.length,i-1,'activation sequence gap')
    const item=json(file);assert.equal(item.index,i);assert(same(item.budget,a.budget)&&same(item.capability,a.capability))
    out.push(item)
  }
  return out
}
function active(a,n){
  const opt=opts(a,n),p=receiptPath(opt)
  assert(fs.existsSync(safe(p)),'previous spawn lacks native receipt; no duplicate launch')
  const r=json(p);validateProjectCommandBackgroundReceipt({...opt,receipt:r})
  return creation(r.processId)===r.processCreationDateUtc
}
function dispatch(a,index,head,kind){
  const dir=a.l.dir,opt=opts(a,index)
  write(dir,'activation-'+index+'.json',{kind,index,atUtc:new Date().toISOString(),launcherPid:process.pid,launcherCreationUtc:creation(process.pid),
    before:head.before,head:head.head,budget:a.budget,capability:a.capability,automaticModelRetries:0})
  const r=launchProjectCommandBackground(opt);validateProjectCommandBackgroundReceipt({...opt,receipt:r})
  return {index,launcherPid:process.pid,serverPid:r.processId,receipt:bind(receiptPath(opt))}
}
async function verifiedParentExit(a,index){
  const item=json(activation(a.l.dir,index)),opt=opts(a,index),start=performance.now()
  assert(same(item.budget,a.budget)&&same(item.capability,a.capability))
  while(performance.now()-start<20000){
    if(creation(item.launcherPid)!==item.launcherCreationUtc&&fs.existsSync(safe(receiptPath(opt)))){
      const r=json(receiptPath(opt));validateProjectCommandBackgroundReceipt({...opt,receipt:r})
      assert.equal(r.processId,process.pid);assert.equal(creation(process.pid),r.processCreationDateUtc)
      if(item.kind==='automatic_checkpoint_handoff'){
        const old=opts(a,index-1),terminal=old.receiptRoot+'/'+old.launchIdentity+'/background-process-terminal.json'
        if(!fs.existsSync(safe(terminal))){await wait(150);continue}
        const prior=json(terminal);assert(prior.processId===item.launcherPid&&prior.exitCode===0&&prior.status==='runner_process_exited')
      }
      return {launcherExited:true,launcherPid:item.launcherPid,verifiedUtc:new Date().toISOString(),serverPid:process.pid,
        serverCreationDateUtc:r.processCreationDateUtc,launchReceipt:bind(receiptPath(opt)),kind:item.kind}
    }
    await wait(250)
  }
  throw Error('previous scheduled process still live or unverified; no activation')
}
function constraints(step,dir,limits,started,deadline){
  if(Date.now()>=deadline)return 'service_wall_deadline'
  if(fs.existsSync(safe(dir+'/stop')))return 'scheduled_service_stopped'
  const disk=fs.statfsSync(safe(step),{bigint:true});if(disk.bavail*disk.bsize<BigInt(limits.minimumFreeDiskMiB)*1048576n)return 'disk_reserve'
  let bytes=0;const files=fs.readdirSync(safe(step))
  if(files.length>limits.artifactFilesMaximum)return 'artifact_count'
  for(const name of files){try{const st=fs.lstatSync(safe(step+'/'+name));if(!st.isFile()||st.nlink!==1)return 'artifact_type';bytes+=st.size}catch(e){if(e.code!=='ENOENT')throw e}}
  if(bytes>limits.artifactBytesMaximum)return 'artifact_bytes'
  let last=started;try{last=fs.statSync(safe(step+'/heartbeat')).mtimeMs}catch(e){if(e.code!=='ENOENT')throw e}
  return Date.now()-last>limits.staleSeconds*1000?'stale_weather_forward':null
}
function observedOutput(input,raw,proof,pid,limits){
  assert(typeof raw==='string'&&Buffer.byteLength(raw)<=65536)
  const out=JSON.parse(raw)
  assert.deepEqual(Object.keys(out).sort(),['checkpointSha256','historyValueSha256','inputSha256','job','modelForwards','pid','trainingUpdates','values'])
  assert(proof.liveOwnerCleanupConfirmed&&proof.cleanupConfirmed&&proof.guardReleaseConfirmed&&proof.ownerClosed&&proof.proof.assignedBeforeResume&&
    proof.proof.killOnJobClose&&proof.proof.activeProcessesAfterCleanup===0&&proof.proof.exitCode===0)
  assert(Number.isSafeInteger(pid)&&pid===out.pid&&pid===proof.proof.rootPid&&proof.proof.ownerPid===proof.ownerIdentity.pid)
  assert.equal(out.inputSha256,sha(encode(input)));assert.equal(out.historyValueSha256,input.historyValueSha256)
  assert.equal(out.checkpointSha256,input.modelSha256);assert.equal(out.modelForwards,1);assert.equal(out.trainingUpdates,0)
  assert.equal(out.job.maxProcesses,1);assert.equal(out.job.cpuAffinityCount,limits.cpuThreadsMaximum)
  assert.equal(out.job.maxCommittedBytes,limits.maxCommittedMemoryMiB*1048576);assert(out.job.peakCommittedBytes>0&&out.job.peakCommittedBytes<=out.job.maxCommittedBytes)
  assert(Array.isArray(out.values)&&out.values.length===4&&out.values.every(Number.isFinite))
  return out
}
function constructTransition(a,api,current,input,out,refs){
  const r=current.record;assert.equal(current.status,'found');assert.equal(current.fileSha256,input.before.fileSha256);assert.deepEqual(idOf(r),input.identity)
  const old=r.worldState.payload.environment.evolution.weather;assert.deepEqual(input.history.at(-1),old.values)
  const before=Object.fromEntries(a.domain.domainFields.map((f,i)=>[f.fieldId,old.values[i]]))
  const changes=a.domain.domainFields.flatMap((f,i)=>out.values[i]===old.values[i]?[]:[{fieldId:f.fieldId,operation:'replace',beforeValueSha256:digest(old.values[i]),newValue:out.values[i],reasonRefs:[refs.output.sha256]}])
  assert(api.domain.validateWorldEnvironmentDelta({policy:a.domain,identity:input.identity,interval:input.interval,beforeValues:before,changes,result:changes.length?'changes':'no_change'}).domainValid)
  const record=structuredClone(r);for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete record[k]
  record.tick++;record.stateVersion++;record.eventCursor++;record.worldFacts.tick=record.worldState.tick=record.tick;record.savedAt=new Date().toISOString()
  const env=record.worldState.payload.environment.evolution
  env.logicalEndUtc=input.interval.logicalEndUtc
  env.weather={fieldOrder:input.fieldOrder,units:input.units,period:input.interval,values:out.values,origin:a.mode==='production'?'model_predicted':'model_predicted_private_simulation'}
  assert.deepEqual(invariant(record),invariant(r))
  const event={schemaVersion:'world-evolution-event-v1',eventId:'scheduled-weather-day-'+record.tick,eventKind:'evolution',identity:input.identity,
    businessKey:'0'.repeat(64),cursor:record.eventCursor,fromTick:r.tick,toTick:record.tick,fromStateVersion:r.stateVersion,toStateVersion:record.stateVersion,
    before:{expectedTick:r.tick,expectedStateVersion:r.stateVersion,expectedFileSha256:current.fileSha256,worldFactsPayloadSha256:r.worldFactsPayloadSha256,
      statePayloadSha256:r.statePayloadSha256,recordContentSha256:r.recordContentSha256},interval:input.interval,policyRef:toRef(a.policy),
    externalInputRefs:[...new Map(input.rows.flatMap(v=>v.provenance.archive?[v.provenance.archive,v.provenance.receipt]:[]).map(v=>[v.path,toRef(v)])).values()],
    historyInputRef:toRef(refs.input),evidence:{kind:'evolution',capabilityRef:toRef(a.capability),modelRef:a.domain.modelRef,inputRef:toRef(refs.input),
      outputRef:toRef(refs.output),validatorRef:a.domain.validatorRef},changes,reasonRefs:[refs.output.sha256,refs.input.sha256,refs.process.sha256],previousEventSha256:input.head.eventSha256,
    domainAfterSha256:api.transaction.computeWorldEvolutionDomainSha(record)}
  event.businessKey=api.transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=api.transaction.sealWorldEvolutionEvent(event)
  env.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:record.eventCursor,eventSha256:sealed.eventSha256}}
  const req={record,event:sealed,expectedTick:r.tick,expectedStateVersion:r.stateVersion,expectedFileSha256:current.fileSha256}
  api.transaction.snapshotNaturalWorldTransition(req);return req
}
function verifyArchivedNative(a,head){
  const dir=a.l.dir+'/steps/'+head.before.tick,intent=json(dir+'/intent.json'),req=JSON.parse(bound(intent.request)),reservation=json(dir+'/reservation.json')
  for(const [k,name] of Object.entries({input:'input.json',output:'output.json',process:'process.json',request:'request.json'})){
    assert.equal(intent[k].path,dir+'/'+name);bound(intent[k])
  }
  const claim=json(dir+'/worker-claim.json'),input=JSON.parse(bound(intent.input)),raw=bound(intent.output).toString('utf8'),proof=JSON.parse(bound(intent.process))
  assert.equal(reservation.inputSha256,intent.input.sha256);assert.equal(claim.reservationSha256,bind(dir+'/reservation.json').sha256)
  assert.equal(claim.batchId,reservation.batchId);assert.equal(claim.inputSha256,intent.input.sha256)
  const out=observedOutput(input,raw,proof,claim.pid,a.cfg.workerLimits)
  const registered=head.verifiedTrace.at(-1)
  assert.equal(registered.eventSha256,req.event.eventSha256);assert.equal(registered.businessKey,req.event.businessKey)
  assert.equal(registered.inputSha256,intent.input.sha256);assert.equal(registered.outputSha256,intent.output.sha256)
  assert.deepEqual(out.values,head.history.at(-1))
  const observe=path.relative(ROOT,proof.observationPath).split(path.sep).join('/')
  assert(observe.startsWith('.runtime/ai-painter/owned-worker-guards/'));const native=json(observe)
  assert.equal(native.activeProcessesAfterCleanup,0);assert.equal(native.rootPid,out.pid);assert.equal(native.bindingBase64,proof.proof.bindingBase64)
  assert.equal(native.ownerPid,proof.ownerIdentity.pid);assert(native.assignedBeforeResume&&!native.cleanupErrorBase64&&!native.stopReasonBase64)
  return {input:intent.input,output:intent.output,process:intent.process,cleanup:bind(observe),reservation:bind(dir+'/reservation.json'),
    request:intent.request,eventSha256:req.event.eventSha256,businessKey:req.event.businessKey,after:head.before}
}
async function recoverOriginalIntent(a){
  const storePath=a.l.store+'/'+a.cfg.identity.ownerId+'/'+a.cfg.identity.worldId+'.json',j=storePath+'.transaction.json'
  if(fs.existsSync(safe(j))){
    const first=json(activation(a.l.dir,1));assert(same(first.capability,a.capability)&&same(first.budget,a.budget))
    assert(Date.now()<Date.parse(first.atUtc)+a.cfg.maximumSupervisedWindowSeconds*1000,'expired journal recovery')
    const ledger=new DatabaseSync(safe(a.l.dir+'/accounting/accounting.sqlite'),{readOnly:true})
    let pending,marker
    try{
      const open=ledger.prepare("SELECT * FROM slots WHERE status!='committed'").all();assert.equal(open.length,1)
      pending=open[0];marker=ledger.prepare('SELECT * FROM service WHERE id=1').get()
    }finally{ledger.close()}
    assert(pending?.status==='reserved'&&pending.target_tick===marker.tick+1,'foreign/missing reserved transaction')
    const dir=a.l.dir+'/steps/'+pending.target_tick,intent=json(dir+'/intent.json'),journal=json(j)
    assert.equal(intent.request.path,dir+'/request.json');const req=JSON.parse(bound(intent.request))
    const res=json(dir+'/reservation.json')
    assert(req.event.businessKey===journal.businessKey&&req.event.eventSha256===journal.eventSha256&&res.tick===pending.target_tick&&same(res.capability,a.capability)&&same(res.budget,a.budget))
    assert.equal(res.slotToken,pending.token);assert.equal(res.batchId,pending.batch_id);assert.equal(res.lifetime,marker.scope)
    assert.equal(req.expectedFileSha256,pending.before_file);assert.equal(req.event.previousEventSha256,pending.before_event)
    assert.equal(res.inputSha256,pending.input_sha);assert.equal(intent.input.sha256,pending.input_sha);assert.equal(res.historyValueSha256,pending.history_sha)
    assert.deepEqual(req.event.identity,a.cfg.identity);assert.deepEqual(req.event.evidence.inputRef,toRef(intent.input));assert.deepEqual(req.event.evidence.outputRef,toRef(intent.output))
    for(const [k,name] of Object.entries({input:'input.json',output:'output.json',process:'process.json'})){assert.equal(intent[k].path,dir+'/'+name);bound(intent[k])}
    observedOutput(JSON.parse(bound(intent.input)),bound(intent.output).toString('utf8'),JSON.parse(bound(intent.process)),json(dir+'/worker-claim.json').pid,a.cfg.workerLimits)
    assert.deepEqual(req.event.evidence.capabilityRef,toRef(a.capability));assert.deepEqual(req.event.policyRef,toRef(a.policy))
    repeatRelease(a);const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(a.l.store))
    const repaired=await store.recoverNaturalTransition({identity:a.cfg.identity,businessKey:journal.businessKey});assert(repaired.ok,repaired.message)
  }
}
async function readAndSync(a,db){
  await recoverOriginalIntent(a)
  const head=await readWorld(a.mode),usage=db.usage()
  let checkpointRecovery=null
  if(head.before.tick>usage.committedTick){
    assert.equal(head.before.tick,usage.committedTick+1);checkpointRecovery=verifyArchivedNative(a,head)
  }
  await db.reconcileVerifiedHead(head)
  return {head,checkpointRecovery}
}
async function modelStep(a,db,claim,input,until){
  const dir=a.l.dir+'/steps/'+claim.targetTick,l=a.cfg.workerLimits
  fs.mkdirSync(safe(a.l.dir+'/steps'),{recursive:true});fs.mkdirSync(safe(dir))
  const inputRef=write(dir,'input.json',encode(input));assert.equal(claim.inputSha256,inputRef.sha256)
  const reservation=write(dir,'reservation.json',{scope:a.mode,serverPid:process.pid,worldId:input.identity.worldId,tick:claim.targetTick,
    slotToken:claim.token,batchId:claim.batch.batch_id,batchSequence:claim.batch.seq,batchBounds:[claim.batch.first_tick,claim.batch.last_tick],
    lifetime:claim.usage.scope,atUtc:new Date().toISOString(),inputSha256:claim.inputSha256,historyValueSha256:input.historyValueSha256,budget:a.budget,capability:a.capability})
  let managed,submitted=false
  try{
    repeatRelease(a);const started=Date.now();assert.equal(constraints(dir,a.l.dir,l,started,until),null)
    managed=await runOwnedWorker(a.interpreter.directInterpreter.path,[...a.interpreter.args,safe(incoming.worker),a.mode,String(claim.targetTick),reservation.sha256,inputRef.sha256],
      {cwd:ROOT,timeout:Math.min(l.workerSecondsMaximum*1000,until-started),maxBuffer:l.logBytesPerStreamMaximum,
        env:{...process.env,CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'},
        abortReason:()=>constraints(dir,a.l.dir,l,started,until)})
    const output=write(dir,'output.json',Buffer.from(managed.stdout)),processRef=write(dir,'process.json',managed.ownedReceipt)
    const out=observedOutput(input,managed.stdout,managed.ownedReceipt,Number(read(dir+'/heartbeat',32)),l)
    assert.deepEqual(await readWorld(a.mode),input,'world changed while scheduled forecast ran')
    const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(a.l.store)),current=await store.readNatural(storeQuery(input.identity))
    const refs={input:inputRef,output,process:processRef},req=constructTransition(a,api,current,input,out,refs)
    const request=write(dir,'request.json',req);write(dir,'intent.json',{...refs,request,businessKey:req.event.businessKey})
    assert(Date.now()<until,'service deadline before commit');repeatRelease(a)
    submitted=true
    const committed=await store.writeNaturalTransition(req);assert(committed.ok&&!committed.replayed,committed.message)
    const verified=await store.readNaturalTransition({identity:input.identity,businessKey:req.event.businessKey});assert.equal(verified.status,'found');assert.deepEqual(committed.receipt,verified.receipt)
    write(dir,'receipt.json',verified.receipt)
    return {targetTick:claim.targetTick,batchId:claim.batch.batch_id,batchSequence:claim.batch.seq,workerPid:out.pid,receipt:committed.receipt,...refs,request}
  }catch(error){
    if(!submitted)db.markFailed(claim.token,error.message.slice(0,512))
    write(dir,'failure.json',{message:error.message,submitted,atUtc:new Date().toISOString(),owned:managed?.ownedReceipt??error.ownedReceipt??null,stderr:error.stderr??null,automaticRetries:0})
    throw error
  }
}

async function launch(mode){
  const a=release(mode),dir=a.l.dir
  const runs=fs.existsSync(safe(dir))?inventory(a):[]
  if(runs.length&&active(a,runs.length))return {status:'running',activation:runs.length}
  await recoverOriginalIntent(a)
  if(mode==='qualification'&&!runs.length){
    const origin=await readWorld(mode,true)
    const dispatch=json(dir+'/dispatch.json')
    assert.equal(dispatch.budgetSha256,a.budget.sha256);assert.equal(dispatch.initialInputSha256,sha(encode(origin)))
    const end=Date.parse(dispatch.startBeforeUtc);assert(Date.now()<end&&end-Date.now()<=600000)
  }
  const db=await accounting(a,runs.length===0)
  try{
    const view=await readAndSync(a,db),usage=db.usage()
    if(!usage.remainingModelStarts||usage.outstanding)return {status:usage.outstanding?'consumed_slot_no_retry':'lifetime_exhausted',usage,world:view.head.before}
    if(runs.length>=a.cfg.maximumActivations)return {status:'activation_limit_reached',usage}
    if(runs.length&&Date.now()>=Date.parse(runs[0].atUtc)+a.cfg.maximumSupervisedWindowSeconds*1000)return {status:'supervised_window_expired',usage}
    return {status:'scheduled_weather_server_spawned',...dispatch(a,runs.length+1,view.head,runs.length?'verified_server_restart':'initial_detach'),usage}
  }finally{db.close()}
}
async function serve(mode,index){
  const a=release(mode),dir=a.l.dir
  assert(index>=1&&index<=a.cfg.maximumActivations);const parent=await verifiedParentExit(a,index)
  const config=json(activation(dir,index)),initial=json(activation(dir,1))
  assert(same(config.budget,a.budget)&&same(initial.capability,a.capability))
  const deadline=Math.min(Date.parse(initial.atUtc)+a.cfg.maximumSupervisedWindowSeconds*1000,Date.now()+a.cfg.maximumRunSecondsPerActivation*1000)
  assert(Date.now()<deadline,'no scheduled weather time budget remains')
  const db=await accounting(a,false)
  try{
    const start=await readAndSync(a,db),restored=db.usage(),session=db.openOnlineSession(start.head),steps=[]
    let h=start.head
    write(dir,'session-'+index+'.json',{parent,restored,startingWorld:h.before,checkpointRecovery:start.checkpointRecovery,
      monotonicAnchorUtc:new Date().toISOString(),recoveredOfflineTicks:0,budget:a.budget,capability:a.capability})
    for(;;){
      const use=db.usage()
      if(!use.remainingModelStarts||!use.remainingAuthorizedDays){
        assert(!use.outstanding,'charged incomplete forecast; cannot label completed')
        const remaining=deadline-Date.now();assert(remaining>0)
        const c=spawnSync(process.execPath,[safe(incoming.entry),mode==='production'?'--status':'--qualify-status'],{cwd:ROOT,encoding:'utf8',maxBuffer:65536,windowsHide:true,timeout:Math.min(remaining,30000)})
        assert.equal(c.status,0,c.stderr);const recovered=JSON.parse(c.stdout);assert.equal(recovered.pid,c.pid);assert.notEqual(c.pid,process.pid)
        assert.deepEqual(recovered.before,h.before);assert.deepEqual(recovered.usage,use)
        return write(dir,'completed-'+index+'.json',{status:'cumulative_lifetime_exhausted',parent,start:start.head.before,after:h.before,restored,
          steps,recovered,usage:use,atUtc:new Date().toISOString(),budget:a.budget,capability:a.capability,automaticRetries:0})
      }
      if(use.outstanding)return write(dir,'stopped-'+index+'.json',{status:'incomplete_charged_slot',usage:use,steps,parent})
      assert(Date.now()<deadline,'scheduled service wall deadline')
      if(fs.existsSync(safe(dir+'/stop')))return write(dir,'stopped-'+index+'.json',{status:'requested_stop',usage:use,steps,parent})
      const claim=await session.claimDue(h)
      if(!claim.mayStart){
        if(claim.status==='not_due_online'){await wait(250);continue}
        return write(dir,'stopped-'+index+'.json',{status:claim.status,usage:claim.usage,steps,parent})
      }
      const step=await modelStep(a,db,claim,h,deadline);steps.push(step)
      if(steps.length>=a.cfg.maximumStepsPerActivation && db.usage().remainingModelStarts>0){
        assert(index<a.cfg.maximumActivations,'remaining slots require an unconfigured activation')
        // Store commit is durable, but ledger reconciliation deliberately belongs to the successor. The next process
        // must prove the original receipt/native output before it can charge another forecast.
        const head=await readWorld(a.mode)
        const handoff=write(dir,'checkpoint-'+index+'.json',{status:'store_committed_pending_accounting',head:head.before,steps,pending:db.usage(),
          atUtc:new Date().toISOString(),parent,budget:a.budget,capability:a.capability})
        repeatRelease(a);assert(Date.now()<deadline)
        const next=dispatch(a,index+1,head,'automatic_checkpoint_handoff')
        return write(dir,'handoff-'+index+'.json',{handoff,next,atUtc:new Date().toISOString()})
      }
      const sync=await readAndSync(a,db);h=sync.head
    }
  }finally{db.close()}
}
async function status(mode){
  const a=release(mode),h=await readWorld(mode)
  const ledgerPath=a.l.dir+'/accounting/accounting.sqlite'
  if(!fs.existsSync(safe(ledgerPath))){
    assert(!fs.existsSync(safe(a.l.dir+'/accounting'))&&!fs.existsSync(safe(a.l.dir+'/activation-1.json'))&&!fs.existsSync(safe(a.l.dir+'/steps')),'durable ledger missing')
    return {pid:process.pid,mode,status:'not_enrolled',before:h.before,head:h.head,inputSha256:sha(encode(h)),usage:null}
  }
  const db=await accounting(a,false,true)
  try{return {pid:process.pid,mode,before:h.before,head:h.head,inputSha256:sha(encode(h)),historyValueSha256:h.historyValueSha256,currentWeather:h.history.at(-1),
    nextInterval:h.interval,remainingValidatedDays:h.remainingValidatedDays,usage:db.usage(),budget:a.budget,capability:a.capability,logicalTimeEarnedDuringDowntime:0}}
  finally{db.close()}
}
export async function executeScheduledWeatherCommand(cmd,...args){
  const routes={'--preflight':['production','preflight'],'--status':['production','status'],'--launch':['production','launch'],'--serve':['production','serve'],
    '--qualify-status':['qualification','status'],'--qualify-launch':['qualification','launch'],'--qualify-serve':['qualification','serve']}
  assert(Object.hasOwn(routes,cmd),'fixed scheduled weather command required')
  const [mode,action]=routes[cmd]
  if(action==='serve'){assert(args.length===1&&/^[1-9][0-9]?$/.test(args[0]));return serve(mode,Number(args[0]))}
  assert.equal(args.length,0,'no caller supplied world, authority or budget')
  if(action==='preflight'){
    const h=await readWorld(mode);let a,why
    try{a=release(mode)}catch(error){why=error.message}
    return {pid:process.pid,before:h.before,head:h.head,nextInterval:h.interval,currentInputSha256:sha(encode(h)),historyValueSha256:h.historyValueSha256,
      originalCutoffUtc:h.originalCutoffUtc,remainingValidatedDays:h.remainingValidatedDays,productionAdmitted:Boolean(a),reason:why??null,
      capability:a?.capability??null,budget:a?.budget??null,modelStarts:0,worldWrites:0}
  }
  if(action==='status')return status(mode)
  return launch(mode)
}
