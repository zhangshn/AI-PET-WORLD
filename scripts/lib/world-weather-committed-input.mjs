import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {bind,bound,digest,featureSha,idOf,invariant,json,read,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {verifyCommittedWeatherMaintenance,verifyCommittedWeatherMaintenance180Clone} from './world-weather-production-maintenance.mjs'
import {FIRST_WEATHER_POLICY_PATH,FIRST_WEATHER_VERSION,requireWeatherProductionAdmission} from './world-weather-release-policy.mjs'
import {verifyWeatherDatasetRelease} from './world-weather-dataset-release.mjs'

const base='.runtime/ai-painter/controller-repair-reviews/world-first-evolution-executor-180-20261103'
const runDir=base+'/qualification/run'
const cloneStore=base+'/qualification/store'
const self='scripts/lib/world-weather-committed-input.mjs'
const worker='ml/ai-painter/scripts/world_weather_committed_forward.py'
const budgetRef={path:'data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json',sha256:'e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a'}
const encode=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
const cloneVersion='sakaerat-committed-weather-first-step-qualification-v1'
const ref=b=>({id:b.path,version:cloneVersion,sha256:b.sha256})
const exactKeys=(v,keys)=>assert.deepEqual(Object.keys(v).sort(),[...keys].sort())
function create(name,data){
  const p=runDir+'/'+name
  fs.writeFileSync(safe(p),data,{flag:'wx',flush:true})
  return bind(p)
}
const save=(name,value)=>create(name,encode(value))
function limitsAndInterpreter(){
  const budget=JSON.parse(bound(budgetRef))
  for(const b of [budget.nativeBuilder,budget.nativeOwner,budget.supervisor,budget.worker])bound(b)
  const interpreter=JSON.parse(bound(budget.interpreter))
  bound(interpreter.venvConfig)
  const {path:exe,sha256,bytes}=interpreter.directInterpreter
  const stat=fs.statSync(exe)
  assert(stat.isFile()&&stat.size===bytes&&bytes<=1024*1024&&sha(fs.readFileSync(exe))===sha256,'unrecognized weather interpreter')
  assert.deepEqual(interpreter.args,['-I','-X','utf8','-B'])
  assert.equal(budget.resources.maxCommittedMemoryMiB,1536)
  assert.equal(budget.resources.workerSecondsMaximum,30)
  assert.equal(budget.resources.runSecondsMaximum,180)
  return {budget,interpreter}
}

// The fixed 178 reader independently reconstructs the exact event, domain, journal, receipt,
// immutable pre-image and source archive before handing over the actual Store snapshot.
async function readHead(scope) {
  if(scope==='qualification')return verifyCommittedWeatherMaintenance180Clone()
  if(scope==='production')return verifyCommittedWeatherMaintenance()
  throw Error('fixed committed weather scope required')
}

export async function readCommittedWorldWeatherInput(scope='production'){
  const {identity,current,preparation,priorReceipt,event,authorityRef,policy,validation}=await readHead(scope)
  const budget=JSON.parse(bound(budgetRef)),dataset=verifyWeatherDatasetRelease(process.cwd())
  assert.equal(policy.resourceContractRef.sha256,budgetRef.sha256)
  assert.deepEqual(identity,budget.identity)
  assert.equal(dataset.checkpointSha256,policy.modelRef.sha256)
  assert.equal(dataset.trainingDatasetSha256,budget.checkpoint.trainingDatasetSha256)
  const record=current.record,e=record.worldState.payload.environment.evolution
  assert.deepEqual([record.tick,record.stateVersion,record.eventCursor],[0,1,1])
  assert.equal(event.eventKind,'maintenance')
  assert.equal(e.commit.historyHead.eventSha256,event.eventSha256)
  assert.equal(priorReceipt.fileSha256,current.fileSha256)
  assert.equal(priorReceipt.eventSha256,event.eventSha256)
  assert.deepEqual(e.weather,preparation.initialWeather)
  assert.equal(e.logicalEndUtc,budget.firstInterval.logicalStartUtc)
  const history=[...preparation.context.values.slice(0,6),e.weather.values]
  assert.equal(history.length,7)
  assert.equal(featureSha(history),validation.contextValueSha256)
  assert.deepEqual(e.weather.fieldOrder,validation.fieldOrder)
  assert.deepEqual(e.weather.units,validation.units)
  return {schemaVersion:'world-weather-committed-model-input-v1',scope,identity,
    before:{tick:record.tick,stateVersion:record.stateVersion,eventCursor:record.eventCursor,fileSha256:current.fileSha256,
      worldFactsPayloadSha256:record.worldFactsPayloadSha256,statePayloadSha256:record.statePayloadSha256,recordContentSha256:record.recordContentSha256},
    interval:budget.firstInterval,history,historyValueSha256:featureSha(history),fieldOrder:e.weather.fieldOrder,units:e.weather.units,
    historyProvenance:{maintenanceAuthority:authorityRef,maintenanceEventSha256:event.eventSha256,
      maintenanceBusinessKey:event.businessKey,maintenanceReceiptContentSha256:digest(priorReceipt),archive:preparation.sourceRefs.archive,
      receipt:preparation.sourceRefs.receipt,periods:preparation.context.periods,firstSixRowsOrigin:'external_archival_context',
      lastRowOrigin:'committed_simulated_archival_seed',livedEvolutionEvents:0},
    randomBefore:{use:'not_consumed',stateSha256:digest(record.randomState)},datasetReleaseIdentity:dataset.datasetReleaseIdentity,
    policySha256:bind(FIRST_WEATHER_POLICY_PATH).sha256,modelSha256:budget.checkpoint.sha256,sourceBudgetSha256:budgetRef.sha256}
}

export async function verifyCommittedWorldWeatherOutput(scope,inputBytes,stdout,owned,heartbeatPid) {
  assert(Buffer.isBuffer(inputBytes)&&inputBytes.length<=65536&&inputBytes.length>0,'bounded committed input required')
  assert(typeof stdout==='string'&&Buffer.byteLength(stdout)>0&&Buffer.byteLength(stdout)<=65536,'bounded weather stdout required')
  // Recheck the committed before-state after the model has stopped.
  const expected=await readCommittedWorldWeatherInput(scope)
  assert(inputBytes.equals(encode(expected)),'committed input changed')
  assert(owned?.cleanupConfirmed&&owned.guardReleaseConfirmed&&owned.ownerClosed&&owned.proof?.assignedBeforeResume&&
    owned.proof.activeProcessesAfterCleanup===0&&owned.proof.exitCode===0&&owned.proof.killOnJobClose&&
    owned.proof.ownerPid===owned.ownerIdentity.pid,'missing native managed proof')
  const out=JSON.parse(stdout)
  exactKeys(out,['pid','inputSha256','checkpointSha256','modelForwards','trainingUpdates','values','job'])
  assert(Number.isSafeInteger(heartbeatPid)&&heartbeatPid>0&&out.pid===owned.proof.rootPid&&out.pid===heartbeatPid,'worker PID mismatch')
  assert.equal(out.inputSha256,sha(inputBytes))
  assert.equal(out.checkpointSha256,expected.modelSha256)
  assert.equal(out.modelForwards,1)
  assert.equal(out.trainingUpdates,0)
  const {budget}=limitsAndInterpreter()
  assert.equal(out.job.maxCommittedBytes,budget.resources.maxCommittedMemoryMiB*1048576)
  assert(Number.isSafeInteger(out.job.peakCommittedBytes)&&out.job.peakCommittedBytes>0&&out.job.peakCommittedBytes<=out.job.maxCommittedBytes)
  assert.equal(out.job.cpuAffinityCount,budget.resources.cpuThreadsMaximum)
  assert.equal(out.job.maxProcesses,1)
  assert(Array.isArray(out.values)&&out.values.length===4&&out.values.every(Number.isFinite),'invalid weather vector')
  const policy=json(FIRST_WEATHER_POLICY_PATH),source=sha(Buffer.from(stdout))
  const beforeValues=Object.fromEntries(policy.domainFields.map((f,i)=>[f.fieldId,expected.history.at(-1)[i]]))
  const changes=policy.domainFields.flatMap((f,i)=>out.values[i]===beforeValues[f.fieldId]?[]:[{
    fieldId:f.fieldId,operation:'replace',beforeValueSha256:digest(beforeValues[f.fieldId]),newValue:out.values[i],reasonRefs:[source]}])
  const {domain}=await runtime()
  const decision=domain.validateWorldEnvironmentDelta({policy,identity:expected.identity,interval:expected.interval,beforeValues,changes,
    result:changes.length?'changes':'no_change'})
  assert.equal(decision.domainValid,true)
  return {output:out,changes,modelInputSha256:sha(inputBytes),workerStdoutSha256:source,domainValid:true,productionAdmitted:false}
}

export function requireCommittedWeatherProductionExecution(...args){
  assert.equal(args.length,0,'no caller-supplied authority')
  return requireWeatherProductionAdmission(process.cwd(),FIRST_WEATHER_VERSION)
}

function freeDisk(){const d=fs.statfsSync(safe(runDir),{bigint:true});return d.bavail*d.bsize}
function stopReason(start,launched,limits){
  if(Date.now()-start>=limits.runSecondsMaximum*1000)return 'overall_deadline'
  if(fs.existsSync(safe(runDir+'/cancel')))return 'weather_cancelled'
  if(freeDisk()<BigInt(limits.minimumFreeDiskMiB)*1048576n)return 'weather_disk_reserve'
  let bytes=0
  const files=fs.readdirSync(safe(runDir))
  if(files.length>limits.artifactFilesMaximum)return 'weather_artifact_count'
  for(const f of files){
    try{const stat=fs.lstatSync(safe(runDir+'/'+f));if(!stat.isFile()||stat.nlink!==1)return 'weather_artifact_type';bytes+=stat.size}
    catch(error){if(error.code!=='ENOENT')throw error}
  }
  if(bytes>limits.artifactBytesMaximum)return 'weather_artifact_bytes'
  let beat=launched
  try{beat=fs.statSync(safe(runDir+'/heartbeat')).mtimeMs}catch(error){if(error.code!=='ENOENT')throw error}
  return Date.now()-beat>limits.staleSeconds*1000?'weather_heartbeat_stale':null
}

// Clone-only integration. Production has no write call in this module; its release authority is separate.
async function commitClone(input,checked,refs){
  const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(cloneStore))
  const id=input.identity,query={ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId}
  const current=await store.readNatural(query)
  assert.equal(current.status,'found');assert.equal(current.fileSha256,input.before.fileSha256)
  assert.deepEqual(idOf(current.record),id)
  const record=structuredClone(current.record),policy=json(FIRST_WEATHER_POLICY_PATH),shaOutput=refs.output.sha256
  for(const k of ['recordContentSha256','worldFactsPayloadSha256','statePayloadSha256'])delete record[k]
  Object.assign(record,{tick:1,stateVersion:2,eventCursor:2,savedAt:new Date().toISOString()})
  record.worldFacts.tick=1;record.worldState.tick=1
  const e=record.worldState.payload.environment.evolution
  e.logicalEndUtc=input.interval.logicalEndUtc
  e.weather={fieldOrder:input.fieldOrder,units:input.units,period:input.interval,values:checked.output.values,origin:'model_predicted_private_simulation'}
  assert.deepEqual(invariant(record),invariant(current.record))
  const event={schemaVersion:'world-evolution-event-v1',identity:id,eventKind:'evolution',eventId:'first-committed-weather-step',
    businessKey:'0'.repeat(64),cursor:2,fromTick:0,toTick:1,fromStateVersion:1,toStateVersion:2,
    before:{expectedTick:0,expectedStateVersion:1,expectedFileSha256:current.fileSha256,
      ...Object.fromEntries(['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'].map(k=>[k,current.record[k]]))},
    interval:input.interval,policyRef:ref(bind(FIRST_WEATHER_POLICY_PATH)),externalInputRefs:[input.historyProvenance.archive,input.historyProvenance.receipt].map(ref),
    historyInputRef:ref(refs.input),evidence:{kind:'evolution',capabilityRef:ref(refs.worker),modelRef:policy.modelRef,inputRef:ref(refs.input),
      outputRef:ref(refs.output),validatorRef:policy.validatorRef},changes:checked.changes,reasonRefs:[shaOutput,refs.process.sha256,refs.validation.sha256],
    previousEventSha256:input.historyProvenance.maintenanceEventSha256,domainAfterSha256:api.transaction.computeWorldEvolutionDomainSha(record)}
  event.businessKey=api.transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=api.transaction.sealWorldEvolutionEvent(event)
  e.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:2,eventSha256:sealed.eventSha256}}
  const request={record,event:sealed,expectedTick:0,expectedStateVersion:1,expectedFileSha256:current.fileSha256}
  api.transaction.snapshotNaturalWorldTransition(request)
  save('request.json',request)
  const written=await store.writeNaturalTransition(request)
  assert(written.ok&&!written.replayed,written.message)
  save('receipt.json',written.receipt)
  const replay=await store.writeNaturalTransition(request)
  assert(replay.ok&&replay.replayed,replay.message)
  assert.deepEqual(replay.receipt,written.receipt)
  return written.receipt
}

async function readCloneResult(){
  const input=json(runDir+'/input.json'),receipt=json(runDir+'/receipt.json'),request=json(runDir+'/request.json'),api=await runtime()
  const store=api.store.createProductionWorldRuntimeStore(safe(cloneStore)),id=input.identity
  const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
  assert.equal(current.status,'found');assert.deepEqual(idOf(current.record),id)
  assert.equal(current.fileSha256,receipt.fileSha256)
  assert.deepEqual([current.record.tick,current.record.stateVersion,current.record.eventCursor],[1,2,2])
  const [prior,next]=await Promise.all([input.historyProvenance.maintenanceBusinessKey,request.event.businessKey].map(businessKey=>store.readNaturalTransition({identity:id,businessKey})))
  assert.equal(prior.status,'found');assert.equal(next.status,'found')
  assert.equal(prior.event.eventSha256,request.event.previousEventSha256)
  assert.equal(digest(prior.receipt),input.historyProvenance.maintenanceReceiptContentSha256)
  assert.deepEqual(next.event,request.event);assert.deepEqual(next.receipt,receipt)
  const actual=json(runDir+'/worker-output.json'),e=current.record.worldState.payload.environment.evolution
  assert.deepEqual(e.weather.values,actual.values);assert.equal(e.logicalEndUtc,input.interval.logicalEndUtc)
  assert.deepEqual(e.commit.historyHead,{cursor:2,eventSha256:next.event.eventSha256})
  return {pid:process.pid,fileSha256:current.fileSha256,eventSha256:next.event.eventSha256,weather:e.weather,predecessor:prior.event.eventSha256}
}

async function qualifyClone(){
  const started=Date.now(),input=await readCommittedWorldWeatherInput('qualification')
  const {budget,interpreter}=limitsAndInterpreter(),limits=budget.resources
  const contract=json(base+'/candidate-budget.json')
  assert.equal(contract.scope,'committed-weather-first-step-clone-only')
  assert.deepEqual(contract.limits,{...limits,formalWorldWrites:0})
  for(const b of contract.sources)bound(b)
  const workerRef=bind(worker),programRef=bind(self)
  for(const b of [workerRef,programRef])assert(contract.sources.some(row=>row.path===b.path&&row.sha256===b.sha256),'candidate source missing')
  const dispatch=json(base+'/qualification-dispatch.json')
  assert.equal(dispatch.scope,contract.scope)
  assert.equal(dispatch.budgetSha256,bind(base+'/candidate-budget.json').sha256)
  assert.equal(dispatch.inputSha256,sha(encode(input)))
  assert.equal(contract.inputSha256,dispatch.inputSha256)
  assert.deepEqual(contract.before,input.before)
  const expiry=Date.parse(dispatch.startBeforeUtc)
  assert(Date.now()<expiry&&expiry-Date.now()<=10*60*1000,'fresh qualification dispatch required')
  assert(!fs.existsSync(safe(runDir)),'forecast already reserved')
  fs.mkdirSync(safe(runDir))
  const inputRef=create('input.json',encode(input)),launch=save('reservation.json',{input:inputRef,scope:contract.scope,atUtc:new Date().toISOString(),
    budget:bind(base+'/candidate-budget.json'),dispatch:bind(base+'/qualification-dispatch.json'),worker:workerRef,formalWrites:0,retries:0})
  let managed
  try{
    assert.equal(stopReason(started,Date.now(),limits),null)
    const launched=Date.now()
    managed=await runOwnedWorker(interpreter.directInterpreter.path,[...interpreter.args,safe(worker),'qualification',inputRef.sha256],
      {cwd:process.cwd(),timeout:limits.workerSecondsMaximum*1000,maxBuffer:limits.logBytesPerStreamMaximum,
        env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',PYTHONDONTWRITEBYTECODE:'1'},
        abortReason:()=>stopReason(started,launched,limits)})
    const processRef=save('process.json',managed.ownedReceipt)
    const output=create('worker-output.json',Buffer.from(managed.stdout))
    const checked=await verifyCommittedWorldWeatherOutput('qualification',bound(inputRef),managed.stdout,managed.ownedReceipt,Number(read(runDir+'/heartbeat',32).toString('ascii')))
    assert.equal(output.sha256,checked.workerStdoutSha256)
    const validation=save('validation.json',checked)
    assert.equal(stopReason(started,Date.now(),{...limits,staleSeconds:limits.runSecondsMaximum}),null)
    const receipt=await commitClone(input,checked,{input:inputRef,worker:workerRef,process:processRef,output,validation})
    const remaining=limits.runSecondsMaximum*1000-(Date.now()-started)
    assert(remaining>0,'overall deadline')
    const child=spawnSync(process.execPath,[safe(self),'--recover-clone'],{cwd:process.cwd(),encoding:'utf8',timeout:Math.min(remaining,30000),maxBuffer:65536,windowsHide:true})
    assert.equal(child.status,0,child.stderr);const recovered=JSON.parse(child.stdout)
    assert.equal(recovered.pid,child.pid);assert.notEqual(child.pid,process.pid);assert.equal(recovered.fileSha256,receipt.fileSha256)
    assert(Date.now()-started<=limits.runSecondsMaximum*1000)
    return save('result.json',{launch,input:inputRef,output,process:processRef,validation,receipt,replayed:true,recovered,
      elapsedMs:Date.now()-started,productionAdmitted:false,formalWorldWrites:0})
  }catch(error){
    save('failure.json',{message:error.message,atUtc:new Date().toISOString(),receipt:error.ownedReceipt??managed?.ownedReceipt??null,
      stdout:error.stdout??null,stderr:error.stderr??null,retries:0})
    throw error
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  assert.equal(process.argv.length,3)
  const cmd=process.argv[2]
  if(cmd==='--qualify-clone')console.log(JSON.stringify(await qualifyClone()))
  else if(cmd==='--recover-clone')console.log(JSON.stringify(await readCloneResult()))
  else if(cmd==='--read-clone'||cmd==='--read-formal')console.log(JSON.stringify(await readCommittedWorldWeatherInput(cmd==='--read-clone'?'qualification':'production')))
  else if(cmd==='--require-production')requireCommittedWeatherProductionExecution()
  else throw Error('expected a fixed committed-weather operation')
}
