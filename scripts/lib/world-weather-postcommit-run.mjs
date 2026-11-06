import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {bind,bound,digest,idOf,invariant,json,read,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {EVOLUTION_STORE} from './natural-world-evolution-input.mjs'
import {readCommittedWeatherInput,verifyFirstWeatherOutputBinding} from './world-weather-first-transaction.mjs'
import {FIRST_WEATHER_POLICY_PATH} from './world-weather-release-policy.mjs'

const base='.runtime/ai-painter/controller-repair-reviews/natural-world-mainline-172-20261102/transaction'
const storeRoot=base+'/qualification/store',inputPath=base+'/qualification/postcommit-input.json',dir=base+'/postcommit-run'
const inputSha='27566d83a776798d6775d6dc02d733f7a064e96b43324a6b90c8fe81a39d5e5d'
const formalSha='93a6202c69b470ac79094ed1686889e7a85605a3554f5728be8df414ca569868'
const worker='ml/ai-painter/scripts/world_weather_postcommit_worker.py'
const self='scripts/lib/world-weather-postcommit-run.mjs'
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n')
const asRef=b=>({id:b.path,version:'isolated-first-weather-v1',sha256:b.sha256})
const receiptQuery=r=>({identity:r.identity,businessKey:r.businessKey})
function put(name,bytes){
  const file=dir+'/'+name
  fs.writeFileSync(safe(file),bytes,{flag:'wx',flush:true})
  return bind(file)
}
function save(name,value){return put(name,encode(value))}
function available(){const s=fs.statfsSync(safe(dir),{bigint:true});return s.bavail*s.bsize}

// Called with this launch's live native-owner result. Historical receipts cannot start a commit.
export function verifyPostcommitProcess({receipt,stdout,heartbeatPid,limits}){
  assert(receipt?.cleanupConfirmed && receipt.guardReleaseConfirmed && receipt.ownerClosed &&
    receipt.proof?.assignedBeforeResume && receipt.proof.activeProcessesAfterCleanup===0 &&
    receipt.proof.exitCode===0 && receipt.proof.killOnJobClose &&
    receipt.proof.ownerPid===receipt.ownerIdentity.pid,'postcommit native owner not confirmed')
  const output=JSON.parse(stdout)
  assert(Number.isSafeInteger(output.pid)&&output.pid>0&&output.pid===receipt.proof.rootPid&&output.pid===heartbeatPid,'postcommit changed worker PID')
  assert.equal(output.inputSha256,inputSha)
  assert.equal(output.modelForwards,1);assert.equal(output.trainingUpdates,0)
  assert.equal(output.job.maxCommittedBytes,limits.maxCommittedMemoryMiB*1048576)
  assert(output.job.peakCommittedBytes>0&&output.job.peakCommittedBytes<=output.job.maxCommittedBytes)
  assert.equal(output.job.cpuAffinityCount,limits.cpuThreadsMaximum);assert.equal(output.job.maxProcesses,1)
  return output
}

function monitor(limits,started,pulseStart){
  if(fs.existsSync(safe(dir+'/cancel')))return 'weather_cancelled'
  if(available()<BigInt(limits.minimumFreeDiskMiB)*1048576n)return 'weather_disk_budget'
  if(performance.now()-started>limits.runSecondsMaximum*1000)return 'weather_total_deadline'
  let pulse=pulseStart
  try{pulse=fs.statSync(safe(dir+'/heartbeat')).mtimeMs}catch(e){if(e.code!=='ENOENT')throw e}
  if(Date.now()-pulse>limits.staleSeconds*1000)return 'weather_stale_worker'
  const files=fs.readdirSync(safe(dir))
  if(files.length>limits.artifactFilesMaximum)return 'weather_artifact_count'
  let bytes=0
  for(const name of files){try{bytes+=fs.statSync(safe(dir+'/'+name)).size}catch(e){if(e.code!=='ENOENT')throw e}}
  return bytes>limits.artifactBytesMaximum?'weather_artifact_size':null
}

async function preflight(){
  const input=await readCommittedWeatherInput()
  assert(bound({path:inputPath,sha256:inputSha}).equals(encode(input)))
  const policy=JSON.parse(bound({path:FIRST_WEATHER_POLICY_PATH,sha256:input.policySha256}))
  const config=JSON.parse(bound({path:policy.resourceContractRef.id,sha256:input.budgetSha256}))
  const interpreter=JSON.parse(bound(config.interpreter)),exe=interpreter.directInterpreter
  assert.equal(sha(fs.readFileSync(exe.path)),exe.sha256)
  for(const b of [config.worker,config.checkpoint,config.nativeOwner,config.supervisor,config.nativeBuilder])bound(b)
  assert.equal(config.checkpoint.sha256,input.modelSha256)
  assert.equal(bind(EVOLUTION_STORE).sha256,formalSha)
  assert.deepEqual(config.reservationKeyFields,['worldId','epochUtc','firstEvolution'])
  const key=digest({worldId:input.identity.worldId,epochUtc:input.interval.logicalStartUtc,firstEvolution:true})
  const reservation=storeRoot+'/'+input.identity.ownerId+'/'+input.identity.worldId+'.first-weather-'+key+'.reservation.json'
  assert(!fs.existsSync(safe(reservation)),'first weather budget already reserved')
  assert(!fs.existsSync(safe('.runtime/ai-painter/owned-worker-guards/active.json')),'shared worker guard occupied')
  assert(available()>=BigInt(config.resources.minimumFreeDiskMiB)*1048576n,'insufficient weather disk budget')
  return {input,config,policy,interpreter,reservation}
}

export function buildIsolatedWeatherEvolutionRequest(api,current,input,output,policy,artifacts){
  assert.equal(current.status,'found')
  assert.equal(current.fileSha256,input.before.fileSha256)
  assert.deepEqual(idOf(current.record),input.identity)
  const beforeValues=Object.fromEntries(policy.domainFields.map((f,i)=>[f.fieldId,input.history.at(-1)[i]]))
  const changes=policy.domainFields.flatMap((f,i)=>output.values[i]===beforeValues[f.fieldId]?[]:[{fieldId:f.fieldId,
    operation:'replace',beforeValueSha256:digest(beforeValues[f.fieldId]),newValue:output.values[i],reasonRefs:[artifacts.output.sha256]}])
  const domain=api.domain.validateWorldEnvironmentDelta({policy,identity:input.identity,interval:input.interval,beforeValues,
    changes,result:changes.length?'changes':'no_change'})
  assert.equal(domain.domainValid,true)
  const record=structuredClone(current.record)
  for(const k of ['recordContentSha256','worldFactsPayloadSha256','statePayloadSha256'])delete record[k]
  record.tick=1;record.stateVersion=2;record.eventCursor=2
  record.worldFacts.tick=1;record.worldState.tick=1;record.savedAt=new Date().toISOString()
  const evolution=record.worldState.payload.environment.evolution
  evolution.logicalEndUtc=input.interval.logicalEndUtc
  evolution.weather={fieldOrder:input.fieldOrder,units:input.units,period:input.interval,
    values:policy.domainFields.map(f=>domain.nextValues[f.fieldId]),origin:'model_predicted_private_simulation'}
  assert.deepEqual(invariant(record),invariant(current.record))
  const before={expectedTick:0,expectedStateVersion:1,expectedFileSha256:current.fileSha256,
    worldFactsPayloadSha256:current.record.worldFactsPayloadSha256,statePayloadSha256:current.record.statePayloadSha256,
    recordContentSha256:current.record.recordContentSha256}
  const event={schemaVersion:'world-evolution-event-v1',identity:input.identity,eventId:'isolated-first-weather-after-seed',
    businessKey:'0'.repeat(64),cursor:2,eventKind:'evolution',fromTick:0,toTick:1,fromStateVersion:1,toStateVersion:2,
    before,interval:input.interval,policyRef:asRef(bind(FIRST_WEATHER_POLICY_PATH)),externalInputRefs:[input.historyProvenance.archive,input.historyProvenance.receipt].map(asRef),
    historyInputRef:asRef(bind(inputPath)),evidence:{kind:'evolution',capabilityRef:asRef(artifacts.worker),modelRef:policy.modelRef,
      inputRef:asRef(bind(inputPath)),outputRef:asRef(artifacts.output),validatorRef:policy.validatorRef},changes,
    reasonRefs:[artifacts.output.sha256,artifacts.process.sha256,artifacts.validation.sha256],
    previousEventSha256:input.historyProvenance.maintenanceEventSha256,domainAfterSha256:api.transaction.computeWorldEvolutionDomainSha(record)}
  event.businessKey=api.transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=api.transaction.sealWorldEvolutionEvent(event)
  evolution.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:2,eventSha256:sealed.eventSha256}}
  return {record,event:sealed,expectedTick:0,expectedStateVersion:1,expectedFileSha256:current.fileSha256}
}

async function readback(){
  const input=JSON.parse(bound({path:inputPath,sha256:inputSha})),api=await runtime()
  const store=api.store.createProductionWorldRuntimeStore(safe(storeRoot)),id=input.identity
  const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
  assert.equal(current.status,'found');assert.deepEqual(idOf(current.record),id)
  assert.deepEqual([current.record.tick,current.record.stateVersion,current.record.eventCursor],[1,2,2])
  const seed=await store.readNaturalTransition({identity:id,businessKey:input.historyProvenance.maintenanceBusinessKey})
  const request=json(dir+'/evolution-request.json')
  const next=await store.readNaturalTransition(receiptQuery(request.event))
  assert.equal(seed.status,'found');assert.equal(next.status,'found')
  assert.deepEqual(next.event,request.event);assert.deepEqual(next.receipt,json(dir+'/evolution-receipt.json'))
  assert.deepEqual(seed.receipt,json(base+'/qualification/original-receipt.json'))
  assert.equal(seed.event.eventSha256,input.historyProvenance.maintenanceEventSha256)
  assert.equal(next.event.previousEventSha256,seed.event.eventSha256)
  assert.equal(next.event.before.expectedFileSha256,seed.receipt.fileSha256)
  assert.equal(next.receipt.fileSha256,current.fileSha256)
  assert.deepEqual(current.record.worldFacts.payload,json(EVOLUTION_STORE).worldFacts.payload)
  assert.deepEqual(current.record.worldState.payload.environment.evolution.weather.values,json(dir+'/worker-stdout.json').values)
  assert.equal(bind(EVOLUTION_STORE).sha256,formalSha)
  return {pid:process.pid,identity:id,after:[1,2,2],storeSha256:current.fileSha256,eventHashes:[seed.event.eventSha256,next.event.eventSha256],
    weather:current.record.worldState.payload.environment.evolution.weather,formalSha,formalWorldWrites:0}
}

async function run(){
  const started=performance.now(),{input,policy,config,interpreter,reservation}=await preflight(),limits=config.resources
  const workerRef=bind(worker),start=Date.now()
  const launch={startedAtUtc:new Date(start).toISOString(),identity:input.identity,preState:input.before,worker:workerRef,input:bind(inputPath),
    code:bind(self),budgetSha256:input.budgetSha256,deadlineUtc:new Date(start+limits.runSecondsMaximum*1000).toISOString(),retries:0}
  fs.writeFileSync(safe(reservation),encode(launch),{flag:'wx',flush:true})
  save('reservation.json',launch)
  let managed
  try{
    managed=await runOwnedWorker(interpreter.directInterpreter.path,[...interpreter.args,safe(worker)],{cwd:process.cwd(),timeout:limits.workerSecondsMaximum*1000,
      maxBuffer:limits.logBytesPerStreamMaximum,env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1'},
      abortReason:()=>monitor(limits,started,start)})
  }catch(error){
    save('worker-failure.json',{message:error.message,code:error.code??null,receipt:error.ownedReceipt??null,stdout:error.stdout??'',stderr:error.stderr??''})
    throw error
  }
  const outputRaw=Buffer.from(managed.stdout)
  const outputRef=put('worker-stdout.json',outputRaw)
  const processRef=save('worker-process.json',{receipt:managed.ownedReceipt,stderr:managed.stderr,worker:workerRef,input:launch.input,output:outputRef})
  const output=verifyPostcommitProcess({receipt:managed.ownedReceipt,stdout:managed.stdout,heartbeatPid:Number(read(dir+'/heartbeat')),limits})
  const validation=await verifyFirstWeatherOutputBinding('qualification',bound(launch.input),outputRaw)
  assert.equal(validation.domainValid,true);bound(workerRef);bound(launch.code);bound(outputRef);bound(processRef)
  const validationRef=save('validation.json',validation)
  assert.deepEqual(await readCommittedWeatherInput(),input)
  const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(safe(storeRoot)),id=input.identity
  const current=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
  const request=buildIsolatedWeatherEvolutionRequest(api,current,input,output,policy,{worker:workerRef,process:processRef,output:outputRef,validation:validationRef})
  api.transaction.snapshotNaturalWorldTransition(request)
  save('evolution-request.json',request)
  assert(performance.now()-started<limits.runSecondsMaximum*1000,'weather overall deadline')
  const commit=await store.writeNaturalTransition(request)
  assert(commit.ok&&!commit.replayed,commit.message)
  save('evolution-receipt.json',commit.receipt)
  const replay=await store.writeNaturalTransition(request)
  assert(replay.ok&&replay.replayed,replay.message);assert.deepEqual(replay.receipt,commit.receipt)
  const remaining=Math.floor(limits.runSecondsMaximum*1000-(performance.now()-started))
  assert(remaining>0,'weather overall deadline')
  const child=spawnSync(process.execPath,[safe(self),'--readback'],{cwd:process.cwd(),windowsHide:true,encoding:'utf8',timeout:Math.min(30000,remaining),maxBuffer:256*1024})
  assert.equal(child.status,0,child.stderr)
  const independentlyRead=JSON.parse(child.stdout)
  assert.equal(independentlyRead.pid,child.pid);assert.notEqual(child.pid,process.pid)
  assert.equal(independentlyRead.storeSha256,commit.receipt.fileSha256)
  return save('result.json',{finishedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-started,launch,output:outputRef,
    process:processRef,validation:validationRef,commit:commit.receipt,replayed:replay.replayed,readback:independentlyRead,productionAdmitted:false})
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  assert.equal(process.argv.length,3)
  const mode=process.argv[2]
  if(mode==='--preflight')console.log(JSON.stringify((await preflight()).input.before))
  else if(mode==='--readback')console.log(JSON.stringify(await readback()))
  else if(mode==='--run')console.log(JSON.stringify(await run()))
  else throw Error('expected --preflight, --readback or --run')
}
