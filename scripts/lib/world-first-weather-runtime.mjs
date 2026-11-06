import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH} from './ai-painter-autonomous-package-decision-core-v3.mjs'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {bind,bound,digest,idOf,invariant,json,read,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {readCommittedWorldWeatherInput,verifyCommittedWorldWeatherOutput} from './world-weather-committed-input.mjs'

const version='sakaerat-weather-153-runtime-v3'
const releasePath='data/ai-painter/capability-releases/'+version+'/release.json'
const budgetPath='data/ai-painter/system-governance/sakaerat-first-committed-weather-runtime-v3.json'
const policyPath='data/ai-painter/system-governance/mvp-natural-world-weather-policy-v3.json'
const oldBudget={path:'data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json',sha256:'e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a'}
const shared='ml/ai-painter/scripts/world_weather_committed_forward.py'
const controller='scripts/lib/world-first-weather-runtime.mjs'
const entry='scripts/run-world-environment-scheduled.mjs'
const worker='ml/ai-painter/scripts/world_first_weather_runtime.py'
const base='.runtime/ai-painter/controller-repair-reviews/world-first-evolution-runtime-185-20261103'
const passed='.runtime/ai-painter/controller-repair-reviews/world-first-evolution-executor-180-20261103'
const oldResult={path:passed+'/qualification/run/result.json',sha256:'1bed75d7512797933288156e8d46a5828760f43c3156151e081263e4d9f5b6f6'}
const oldDelivery={path:passed+'/delivery.json',sha256:'934dbf6a8bcc846bdb0c231bba9d42fd3bf0c2db8483717bbc390dedec48fc21'}
const encode=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
const sameRef=(a,b)=>a.path===b.path&&a.sha256===b.sha256
const ref=(file,v=version)=>({id:file.path,sha256:file.sha256,version:v})
const locations={
  production:{store:'data/world-runtime',run:'.runtime/ai-painter/world-first-weather-runtime/v3'},
  qualification:{store:base+'/qualification/store',run:base+'/qualification/run'},
}
function paths(mode){assert(Object.hasOwn(locations,mode),'unknown weather mode');return locations[mode]}
function save(dir,name,value,raw=false){
  const file=dir+'/'+name
  fs.writeFileSync(safe(file),raw?value:encode(value),{flag:'wx',flush:true})
  return bind(file)
}

function authority(mode) {
  // No Store, run folder, process or mutable scheduling ledger is consulted before this call.
  let release,contract,capability,policy
  if(mode==='production'){
    const a=loadAndValidateReleasedCapabilityBinding({projectRoot:process.cwd(),capabilityReleasePath:releasePath,
      trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH,requiredCapabilityScope:'world_evolution'})
    assert.equal(a.verificationStatus,'verified_from_machine_adjudication_and_trusted_registry')
    assert.equal(a.release.modelCapabilityVersion,version);assert.equal(a.release.capabilityReleaseIdentity,version)
    assert.equal(a.verifiedBindings.runtimeInterfaceContract.path,budgetPath)
    release={path:releasePath,sha256:a.capabilityReleaseSha256}
    contract=a.verifiedBindings.runtimeInterfaceContract
    capability=ref(release);policy=bind(policyPath)
    assert.equal(a.verifiedBindings.modelArtifact.sha256,JSON.parse(bound(oldBudget)).checkpoint.sha256)
  }else{
    assert.equal(mode,'qualification')
    bound(oldDelivery);bound(oldResult)
    release=oldDelivery;capability=ref(oldDelivery,'unreleased-fixed-clone-qualification')
    contract=bind(base+'/qualification-budget.json')
    policy=bind('data/ai-painter/system-governance/mvp-natural-world-weather-policy-v2.json')
  }
  const cfg=JSON.parse(bound(contract)),old=JSON.parse(bound(oldBudget))
  assert.equal(cfg.schemaVersion,'sakaerat-first-committed-weather-runtime-v3')
  assert.equal(cfg.version,version);assert.equal(cfg.requiredCapabilityScope,'world_evolution')
  assert.equal(cfg.policyPath,policy.path);assert(sameRef(cfg.sourceBudget,oldBudget))
  for(const [key,f] of Object.entries({runner:controller,worker,entry,sharedForecast:shared,committedReader:'scripts/lib/world-weather-committed-input.mjs'})){
    assert.equal(cfg[key].path,f);bound(cfg[key])
  }
  assert.deepEqual(cfg.identity,old.identity);assert.deepEqual(cfg.firstInterval,old.firstInterval)
  assert.deepEqual(cfg.resources,{...old.resources,formalWorldWrites:mode==='production'?1:0})
  assert(sameRef(cfg.qualification,oldDelivery));bound(oldDelivery)
  assert(sameRef(cfg.interpreter,old.interpreter)&&sameRef(cfg.checkpoint,old.checkpoint))
  const interpreter=JSON.parse(bound(cfg.interpreter));bound(interpreter.venvConfig);bound(cfg.checkpoint)
  assert.deepEqual(interpreter.args,['-I','-X','utf8','-B'])
  assert.equal(fs.statSync(interpreter.directInterpreter.path).size,interpreter.directInterpreter.bytes)
  assert.equal(sha(fs.readFileSync(interpreter.directInterpreter.path)),interpreter.directInterpreter.sha256)
  for(const original of [old.nativeOwner,old.supervisor,old.nativeBuilder,old.worker])bound(original)
  return {release,contract:{path:contract.path,sha256:contract.sha256},capability,policy,config:cfg,interpreter}
}

async function verifiedInput(mode) {
  if(mode==='production')return readCommittedWorldWeatherInput('production')
  const historic=JSON.parse(bound(oldResult)),input=JSON.parse(bound(historic.input))
  const id=input.identity,api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(paths(mode).store))
  const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
  const prior=await store.readNaturalTransition({identity:id,businessKey:input.historyProvenance.maintenanceBusinessKey})
  assert.equal(current.status,'found');assert.equal(prior.status,'found')
  assert.deepEqual([current.record.tick,current.record.stateVersion,current.record.eventCursor],[0,1,1])
  assert.equal(current.fileSha256,input.before.fileSha256)
  assert.equal(digest(prior.receipt),input.historyProvenance.maintenanceReceiptContentSha256)
  assert.equal(prior.event.eventSha256,input.historyProvenance.maintenanceEventSha256)
  assert.deepEqual(current.record.worldState.payload.environment.evolution.weather.values,input.history.at(-1))
  return input
}

function monitor(dir,start,launch,limits){
  if(Date.now()-start>=limits.runSecondsMaximum*1000)return 'weather_overall_deadline'
  if(fs.existsSync(safe(dir+'/cancel')))return 'weather_cancelled'
  const disk=fs.statfsSync(safe(dir),{bigint:true})
  if(disk.bavail*disk.bsize<BigInt(limits.minimumFreeDiskMiB)*1048576n)return 'weather_disk_reserve'
  const files=fs.readdirSync(safe(dir));if(files.length>limits.artifactFilesMaximum)return 'weather_artifact_count'
  let bytes=0
  for(const file of files){
    try{const s=fs.lstatSync(safe(dir+'/'+file));if(!s.isFile()||s.nlink!==1)return 'weather_artifact_type';bytes+=s.size}
    catch(e){if(e.code!=='ENOENT')throw e}
  }
  if(bytes>limits.artifactBytesMaximum)return 'weather_artifact_bytes'
  let latest=launch
  try{latest=fs.statSync(safe(dir+'/heartbeat')).mtimeMs}catch(error){if(error.code!=='ENOENT')throw error}
  return Date.now()-latest>limits.staleSeconds*1000?'weather_stale_worker':null
}

function verifyNative(input,stdout,proof,pid,limits){
  assert(proof?.ownerClosed&&proof.guardReleaseConfirmed&&proof.liveOwnerCleanupConfirmed&&proof.cleanupConfirmed&&
    proof.proof?.assignedBeforeResume&&proof.proof.killOnJobClose&&proof.proof.activeProcessesAfterCleanup===0&&proof.proof.exitCode===0&&
    proof.proof.ownerPid===proof.ownerIdentity.pid,'native weather worker did not finish cleanly')
  assert(typeof stdout==='string'&&Buffer.byteLength(stdout)<=65536)
  const out=JSON.parse(stdout)
  assert.deepEqual(Object.keys(out).sort(),['checkpointSha256','inputSha256','job','modelForwards','pid','trainingUpdates','values'])
  assert.equal(out.pid,pid);assert(Number.isSafeInteger(pid)&&pid>0&&pid===proof.proof.rootPid)
  assert.equal(out.inputSha256,sha(encode(input)));assert.equal(out.checkpointSha256,input.modelSha256)
  assert.equal(out.modelForwards,1);assert.equal(out.trainingUpdates,0)
  assert.equal(out.job.maxCommittedBytes,limits.maxCommittedMemoryMiB*1048576)
  assert(Number.isSafeInteger(out.job.peakCommittedBytes)&&out.job.peakCommittedBytes>0&&out.job.peakCommittedBytes<=out.job.maxCommittedBytes)
  assert.equal(out.job.cpuAffinityCount,limits.cpuThreadsMaximum);assert.equal(out.job.maxProcesses,1)
  assert(Array.isArray(out.values)&&out.values.length===4&&out.values.every(Number.isFinite))
  return out
}

function transition(api,current,a,input,refs,out,mode,savedAt){
  const policy=JSON.parse(bound(a.policy));api.policy.validateWorldEvolutionPolicy(policy,input.identity)
  assert.equal(current.status,'found');assert.equal(current.fileSha256,input.before.fileSha256)
  assert.deepEqual(idOf(current.record),input.identity);assert.deepEqual(current.record.worldState.payload.environment.evolution.weather.values,input.history.at(-1))
  const beforeValues=Object.fromEntries(policy.domainFields.map((f,i)=>[f.fieldId,input.history.at(-1)[i]]))
  const changes=policy.domainFields.flatMap((f,i)=>out.values[i]===beforeValues[f.fieldId]?[]:[{fieldId:f.fieldId,operation:'replace',
    beforeValueSha256:digest(beforeValues[f.fieldId]),newValue:out.values[i],reasonRefs:[refs.output.sha256]}])
  const verdict=api.domain.validateWorldEnvironmentDelta({policy,identity:input.identity,interval:input.interval,beforeValues,changes,result:changes.length?'changes':'no_change'})
  assert.equal(verdict.domainValid,true)
  const record=structuredClone(current.record)
  for(const key of ['recordContentSha256','worldFactsPayloadSha256','statePayloadSha256'])delete record[key]
  Object.assign(record,{savedAt,tick:1,stateVersion:2,eventCursor:2});record.worldState.tick=1;record.worldFacts.tick=1
  const e=record.worldState.payload.environment.evolution
  e.logicalEndUtc=input.interval.logicalEndUtc
  e.weather={fieldOrder:input.fieldOrder,units:input.units,values:out.values,period:input.interval,
    origin:mode==='production'?'model_predicted':'model_predicted_private_simulation'}
  assert.deepEqual(invariant(record),invariant(current.record))
  const event={schemaVersion:'world-evolution-event-v1',eventId:'first-sakaerat-committed-weather-v3',identity:input.identity,eventKind:'evolution',
    businessKey:'0'.repeat(64),cursor:2,fromTick:0,toTick:1,fromStateVersion:1,toStateVersion:2,
    before:{expectedTick:0,expectedStateVersion:1,expectedFileSha256:current.fileSha256,...Object.fromEntries(['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'].map(k=>[k,current.record[k]]))},
    interval:input.interval,policyRef:ref(a.policy),externalInputRefs:[input.historyProvenance.archive,input.historyProvenance.receipt].map(x=>ref(x)),historyInputRef:ref(refs.input),
    evidence:{kind:'evolution',capabilityRef:a.capability,modelRef:policy.modelRef,inputRef:ref(refs.input),outputRef:ref(refs.output),validatorRef:policy.validatorRef},
    changes,reasonRefs:[refs.output.sha256,refs.proof.sha256,refs.validation.sha256],previousEventSha256:input.historyProvenance.maintenanceEventSha256,
    domainAfterSha256:api.transaction.computeWorldEvolutionDomainSha(record)}
  event.businessKey=api.transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=api.transaction.sealWorldEvolutionEvent(event)
  e.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:2,eventSha256:sealed.eventSha256}}
  const request={record,event:sealed,expectedTick:0,expectedStateVersion:1,expectedFileSha256:current.fileSha256}
  api.transaction.snapshotNaturalWorldTransition(request)
  return request
}

function readArtifacts(dir,a){
  const reservation=json(dir+'/reservation.json'),seal=json(dir+'/intent.json')
  assert(sameRef(a.release,reservation.release)&&sameRef(a.contract,reservation.budget))
  for(const [key,file] of Object.entries({input:'input.json',proof:'native.json',output:'output.json',validation:'validation.json',request:'request.json'})){
    assert.equal(seal[key].path,dir+'/'+file);bound(seal[key])
  }
  const input=JSON.parse(bound(seal.input)),req=JSON.parse(bound(seal.request)),out=JSON.parse(bound(seal.output))
  assert.equal(seal.input.sha256,reservation.inputSha256)
  assert.equal(req.event.businessKey,seal.businessKey);assert.equal(req.event.evidence.outputRef.sha256,seal.output.sha256)
  assert.deepEqual(req.event.policyRef,ref(a.policy));assert.deepEqual(req.event.evidence.capabilityRef,a.capability)
  assert.equal(out.inputSha256,seal.input.sha256);assert.equal(out.checkpointSha256,a.config.checkpoint.sha256)
  return {input,req,out,seal}
}

async function recover(mode, allowFinalize){
  const a=authority(mode),{run:dir,store:root}=paths(mode)
  assert(fs.existsSync(safe(dir+'/intent.json')),'first-weather incomplete reservation: no durable intent, no automatic re-execution')
  const {input,req,out,seal}=readArtifacts(dir,a),api=await runtime()
  const fixedRequest=api.transaction.snapshotNaturalWorldTransition(req)
  const store=api.store.createProductionWorldRuntimeStore(safe(root)),id=a.config.identity
  assert.deepEqual(input.identity,id)
  const query={identity:id,businessKey:seal.businessKey}
  let next=await store.readNaturalTransition(query)
  if(next.status!=='found'&&allowFinalize){
    // Recover exclusively the existing original journal. Never re-submit the cached prediction/request.
    const recovered=await store.recoverNaturalTransition(query)
    assert(recovered.ok,'no recoverable original Store transaction: '+recovered.message)
    next=await store.readNaturalTransition(query)
  }
  assert.equal(next.status,'found',next.message)
  assert.deepEqual(next.event,fixedRequest.event)
  const prior=await store.readNaturalTransition({identity:id,businessKey:input.historyProvenance.maintenanceBusinessKey})
  assert.equal(prior.status,'found');assert.equal(prior.event.eventSha256,next.event.previousEventSha256)
  assert.equal(digest(prior.receipt),input.historyProvenance.maintenanceReceiptContentSha256)
  const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
  assert.equal(current.status,'found');assert.deepEqual(current.record,fixedRequest.record)
  assert.equal(current.fileSha256,next.receipt.fileSha256);assert.deepEqual(current.record.worldState.payload.environment.evolution.weather.values,out.values)
  return {pid:process.pid,scope:mode,worldId:id.worldId,fileSha256:current.fileSha256,tick:current.record.tick,stateVersion:current.record.stateVersion,
    eventCursor:current.record.eventCursor,receipt:next.receipt,weather:current.record.worldState.payload.environment.evolution.weather,
    input:seal.input,output:seal.output,budget:a.contract,scopeRelease:a.release}
}

async function consume(mode){
  const start=Date.now(),a=authority(mode),{run:dir,store:root}=paths(mode),limits=a.config.resources
  if(fs.existsSync(safe(dir)))return {...await recover(mode,true),replayed:true}
  const input=await verifiedInput(mode)
  assert.deepEqual(input.identity,a.config.identity);assert.deepEqual(input.interval,a.config.firstInterval)
  const raw=encode(input),inputSha=sha(raw)
  if(mode==='qualification'){
    const dispatch=json(base+'/qualification-dispatch.json')
    assert.equal(dispatch.budgetSha256,a.contract.sha256);assert.equal(dispatch.inputSha256,inputSha)
    const cutoff=Date.parse(dispatch.startBeforeUtc);assert(Date.now()<cutoff&&cutoff-Date.now()<=600000)
  }
  const formalBudget=JSON.parse(bound(oldBudget));bound(formalBudget.supervisor)
  fs.mkdirSync(safe(path.posix.dirname(dir)),{recursive:true})
  try{fs.mkdirSync(safe(dir))}catch(e){if(e.code!=='EEXIST')throw e;throw Error('first-weather reservation already claimed')}
  const inputRef=save(dir,'input.json',raw,true)
  const reservation=save(dir,'reservation.json',{mode,runnerPid:process.pid,atUtc:new Date().toISOString(),before:input.before,inputSha256:inputSha,
    budget:a.contract,release:a.release,interpreterSha256:a.interpreter.directInterpreter.sha256,automaticRetry:0})
  let managed
  try{
    const launched=Date.now();assert.equal(monitor(dir,start,launched,limits),null)
    const args=[...a.interpreter.args,safe(worker),mode,reservation.sha256,inputSha]
    managed=await runOwnedWorker(a.interpreter.directInterpreter.path,args,{cwd:process.cwd(),timeout:limits.workerSecondsMaximum*1000,
      maxBuffer:limits.logBytesPerStreamMaximum,env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',PYTHONDONTWRITEBYTECODE:'1'},
      abortReason:()=>monitor(dir,start,launched,limits)})
    const proof=save(dir,'native.json',managed.ownedReceipt),output=save(dir,'output.json',Buffer.from(managed.stdout),true)
    const later=authority(mode);assert(sameRef(later.release,a.release)&&sameRef(later.contract,a.contract),'release changed after forward')
    assert.deepEqual(await verifiedInput(mode),input)
    const pid=Number(read(dir+'/heartbeat',32).toString('ascii'))
    const out=verifyNative(input,managed.stdout,managed.ownedReceipt,pid,limits)
    if(mode==='production')await verifyCommittedWorldWeatherOutput('production',bound(inputRef),managed.stdout,managed.ownedReceipt,pid)
    else assert.deepEqual(out.values,JSON.parse(bound(JSON.parse(bound(oldResult)).output)).values,'same-fixture forecast differs')
    const validation=save(dir,'validation.json',{mode,inputSha256:inputSha,rawOutputSha256:output.sha256,modelSha256:out.checkpointSha256,native:proof,
      before:input.before,release:a.release,budget:a.contract,domainValuesMustPassOriginalValidator:true})
    const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(root)),id=input.identity
    const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
    const refs={input:inputRef,proof,output,validation}
    const request=transition(api,current,later,input,refs,out,mode,new Date().toISOString())
    const requestRef=save(dir,'request.json',request)
    save(dir,'intent.json',{...refs,request:requestRef,businessKey:request.event.businessKey})
    assert(Date.now()-start<limits.runSecondsMaximum*1000,'weather run deadline')
    const finalAdmission=authority(mode)
    assert(sameRef(finalAdmission.release,a.release)&&sameRef(finalAdmission.contract,a.contract))
    const written=await store.writeNaturalTransition(request);assert(written.ok&&!written.replayed,written.message)
    const replay=await store.readNaturalTransition({identity:id,businessKey:request.event.businessKey});assert.equal(replay.status,'found');assert.deepEqual(replay.receipt,written.receipt)
    const remaining=limits.runSecondsMaximum*1000-(Date.now()-start);assert(remaining>0)
    const command=mode==='production'?'--read-first-committed-weather':'--read-qualification'
    const cli=mode==='production'?entry:controller
    const child=spawnSync(process.execPath,[safe(cli),command],{cwd:process.cwd(),encoding:'utf8',windowsHide:true,maxBuffer:65536,timeout:Math.min(30000,remaining)})
    assert.equal(child.status,0,child.stderr);const recovered=JSON.parse(child.stdout)
    assert.equal(recovered.pid,child.pid);assert.notEqual(child.pid,process.pid);assert.deepEqual(recovered.receipt,written.receipt)
    const summary={...recovered,workerPid:out.pid,elapsedMs:Date.now()-start,modelForwards:out.modelForwards,replayed:false}
    assert(summary.elapsedMs<=limits.runSecondsMaximum*1000);save(dir,'result.json',summary)
    return summary
  }catch(error){
    save(dir,'failure.json',{atUtc:new Date().toISOString(),error:error.message,ownedReceipt:error.ownedReceipt??managed?.ownedReceipt??null,
      stderr:error.stderr??null,stdout:error.stdout??null,automaticRetry:0})
    throw error
  }
}

export function runFirstWeatherRuntime(...args){assert.equal(args.length,0,'fixed production mode');return consume('production')}
export function readFirstWeatherRuntime(...args){assert.equal(args.length,0,'fixed production mode');return recover('production',false)}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  assert.equal(process.argv.length,3)
  if(process.argv[2]==='--qualify')console.log(JSON.stringify(await consume('qualification')))
  else if(process.argv[2]==='--read-qualification')console.log(JSON.stringify(await recover('qualification',false)))
  else throw Error('fixed private qualification mode only')
}
