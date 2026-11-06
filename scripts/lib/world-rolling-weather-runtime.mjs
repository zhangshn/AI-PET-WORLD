import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync,spawnSync} from 'node:child_process'
import {setTimeout as wait} from 'node:timers/promises'
import {loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH} from './ai-painter-autonomous-package-decision-core-v3.mjs'
import {launchProjectCommandBackground,validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {ROOT,bind,bound,digest,featureSha,idOf,invariant,json,read,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {readWorldRollingWeatherInput} from './world-rolling-weather-input.mjs'

const version='sakaerat-weather-153-rolling-v4',releasePath='data/ai-painter/capability-releases/'+version+'/release.json'
const realBudget='data/ai-painter/system-governance/sakaerat-rolling-weather-runtime-v4.json'
const realPolicy='data/ai-painter/system-governance/mvp-natural-world-weather-policy-v4.json'
const previous='.runtime/ai-painter/controller-repair-reviews/world-server-rolling-schedule-190-20261103'
const priorBudget={path:'data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json',sha256:'e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a'}
const anchorRef={path:previous+'/formal-next-input.json',sha256:'9dd1328a722c7b8719b0719def007def72a21fb6938e2c1a43091a5c2c015733'}
const eligibility={path:previous+'/qualification-evidence.json',sha256:'64c49d65a766051d3f881960d0feeb95a55a128e65b23519f9357572c7d1c458'}
const qualifier='.runtime/ai-painter/controller-repair-reviews/world-rolling-runtime-193-20261103/qualification'
const files={runner:'scripts/lib/world-rolling-weather-runtime.mjs',entry:'scripts/run-world-rolling-weather.mjs',
  worker:'ml/ai-painter/scripts/world_rolling_weather_runtime.py',rollingInput:'scripts/lib/world-rolling-weather-input.mjs',
  sharedForecast:'ml/ai-painter/scripts/world_weather_committed_forward.py'}
const encode=v=>Buffer.from(JSON.stringify(v,null,2)+'\n')
const asRef=(b,v=version)=>({id:b.path,sha256:b.sha256,version:v})
const fromRef=r=>({path:r.id,sha256:r.sha256})
const same=(a,b)=>a?.path===b?.path&&a.sha256===b.sha256
function loc(mode){
  if(mode==='production')return {dir:'.runtime/ai-painter/world-rolling-weather-runtime/v4',store:'data/world-runtime',budget:realBudget,policy:realPolicy}
  assert.equal(mode,'qualification')
  return {dir:qualifier,store:qualifier+'/store',budget:qualifier+'/budget.json',policy:qualifier+'/policy.json'}
}
function save(dir,name,value){
  const file=dir+'/'+name
  fs.writeFileSync(safe(file),Buffer.isBuffer(value)?value:encode(value),{flag:'wx',flush:true})
  return bind(file)
}
function original(){return JSON.parse(bound(anchorRef))}
function anchorShape(initial){return {tick:initial.before.tick,stateVersion:initial.before.stateVersion,eventCursor:initial.before.eventCursor,
  fileSha256:initial.before.fileSha256,eventSha256:initial.head.eventSha256,businessKey:initial.head.businessKey,
  historyValueSha256:initial.historyValueSha256,inputSha256:anchorRef.sha256}}

function admitted(mode){
  const l=loc(mode)
  let release,budget,policy
  if(mode==='production'){
    // Use only the current registry, lifecycle, adjudication and actual immutable role bytes.
    const verified=loadAndValidateReleasedCapabilityBinding({projectRoot:ROOT,capabilityReleasePath:releasePath,
      trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH,requiredCapabilityScope:'world_evolution'})
    assert.equal(verified.verificationStatus,'verified_from_machine_adjudication_and_trusted_registry')
    assert.equal(verified.release.modelCapabilityVersion,version);assert.equal(verified.release.capabilityReleaseIdentity,version)
    assert.equal(verified.release.capabilityScope,'world_evolution')
    const roles=verified.verifiedBindings
    assert.equal(roles.runtimeInterfaceContract.path,l.budget);assert.equal(roles.reviewContract.path,l.policy)
    assert.equal(roles.conditionContract.path,files.rollingInput)
    assert.equal(roles.modelArtifact.sha256,original().modelSha256)
    assert.equal(roles.datasetRelease.path,'data/world-samples/dataset-packages/sakaerat-daily-weather-153-v1/dataset-package.json')
    release={path:releasePath,sha256:verified.capabilityReleaseSha256};budget=fromRef(asRef(roles.runtimeInterfaceContract));policy=fromRef(asRef(roles.reviewContract))
  }else{
    // The diagnostic is isolated by both its fixed contract path and Store root.
    bound(eligibility);release=eligibility;budget=bind(l.budget);policy=bind(l.policy)
  }
  const cfg=JSON.parse(bound(budget)),domain=JSON.parse(bound(policy)),old=JSON.parse(bound(priorBudget)),base=original()
  assert.equal(cfg.version,version);assert.equal(cfg.schemaVersion,'sakaerat-rolling-weather-runtime-v4')
  assert.equal(cfg.requiredCapabilityScope,'world_evolution');assert.equal(cfg.policyPath,l.policy)
  assert.deepEqual(cfg.identity,base.identity);assert.deepEqual(cfg.anchor,anchorShape(base))
  assert.equal(cfg.maximumNewSteps,2);assert.equal(cfg.maximumModelForwards,2);assert.equal(cfg.maximumServerActivations,2)
  assert.equal(cfg.formalWritesMaximum,mode==='production'?2:0);assert.equal(cfg.automaticModelRetries,0);assert.equal(cfg.maximumRunSeconds,180)
  assert.deepEqual(cfg.clock,old.timePolicy);assert.deepEqual(cfg.workerLimits,old.resources);assert.deepEqual(domain.timePolicy,cfg.clock)
  assert.deepEqual(domain.identity,cfg.identity);assert.equal(domain.modelRef.sha256,base.modelSha256)
  for(const [k,p] of Object.entries(files)){assert.equal(cfg[k].path,p);bound(cfg[k])}
  assert(same(cfg.sourceBudget,priorBudget)&&same(cfg.model,old.checkpoint)&&same(cfg.interpreter,old.interpreter)&&same(cfg.qualification,eligibility))
  for(const b of [old.nativeOwner,old.nativeBuilder,old.supervisor,old.worker,cfg.model,cfg.qualification])bound(b)
  const interpreter=JSON.parse(bound(cfg.interpreter));bound(interpreter.venvConfig)
  assert.equal(fs.statSync(interpreter.directInterpreter.path).size,interpreter.directInterpreter.bytes)
  assert.equal(sha(fs.readFileSync(interpreter.directInterpreter.path)),interpreter.directInterpreter.sha256)
  assert.deepEqual(interpreter.args,['-I','-X','utf8','-B'])
  return {l,cfg,domain,interpreter,release,budget,policy}
}
function sameAdmission(a,b){assert(same(a.release,b.release)&&same(a.budget,b.budget)&&same(a.policy,b.policy),'rolling weather authority changed')}
const q=id=>({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId})
function stateRef(record,fileSha256){
  return {tick:record.tick,stateVersion:record.stateVersion,eventCursor:record.eventCursor,fileSha256,
    recordContentSha256:record.recordContentSha256,worldFactsPayloadSha256:record.worldFactsPayloadSha256,statePayloadSha256:record.statePayloadSha256}
}
async function initialHead(root,api){
  const input=original(),id=input.identity,store=api.store.createProductionWorldRuntimeStore(safe(root))
  const prior=await store.readNaturalTransition({identity:id,businessKey:input.head.businessKey})
  assert.equal(prior.status,'found','missing original first-day committed receipt')
  assert.deepEqual(prior.receipt.identity,id);assert.equal(prior.event.eventSha256,input.head.eventSha256)
  assert.equal(prior.receipt.fileSha256,input.before.fileSha256)
  const tail=input.rows.at(-1).provenance
  assert.equal(tail.eventSha256,prior.event.eventSha256);assert.equal(prior.event.evidence.outputRef.sha256,tail.output.sha256)
  assert.deepEqual(JSON.parse(bound(tail.output)).values,input.history.at(-1));bound(tail.input);bound(tail.capability)
  const seedRow=input.rows.find(r=>r.provenance.kind==='committed_archival_seed')
  const seed=await store.readNaturalTransition({identity:id,businessKey:seedRow.provenance.businessKey});assert.equal(seed.status,'found')
  assert.equal(seed.event.eventSha256,prior.event.previousEventSha256);bound(seedRow.provenance.archive);bound(seedRow.provenance.receipt)
  return {input,store,id}
}

async function readHead(mode,a,api){
  const {dir,store:root}=loc(mode),{input:anchor,store,id}=await initialHead(root,api)
  let input={...anchor,scope:mode}
  const current=await store.readNatural(q(id))
  assert.equal(current.status,'found');assert.deepEqual(idOf(current.record),id)
  const endTick=current.record.tick
  assert(Number.isSafeInteger(endTick)&&endTick>=anchor.before.tick&&endTick<=anchor.before.tick+2,'outside two-day trial horizon')
  if(endTick===anchor.before.tick && mode==='production')assert.deepEqual(await readWorldRollingWeatherInput('production'),anchor)
  const name=root+'/'+id.ownerId+'/'+id.worldId+'.json'
  for(let day=anchor.before.tick+1;day<=endTick;day++){
    assert(a,'cannot attribute subsequent days without their machine release')
    const step=dir+'/steps/'+day,res=json(step+'/reservation.json'),intent=json(step+'/intent.json')
    assert.equal(res.inputSha256,sha(encode(input)));assert.deepEqual(res.before,input.before)
    assert(same(res.release,a.release)&&same(res.budget,a.budget));assert.deepEqual(res.historyValueSha256,input.historyValueSha256)
    for(const [k,f] of Object.entries({request:'request.json',input:'input.json',output:'output.json',process:'process.json'})){
      assert.equal(intent[k].path,step+'/'+f);bound(intent[k])
    }
    assert(bound(intent.input).equals(encode(input)))
    const request=JSON.parse(bound(intent.request)),output=JSON.parse(bound(intent.output))
    const next=await store.readNaturalTransition({identity:id,businessKey:request.event.businessKey});assert.equal(next.status,'found')
    const sealed=api.transaction.snapshotNaturalWorldTransition(request)
    assert.deepEqual(next.event,sealed.event);assert.equal(next.event.previousEventSha256,input.head.eventSha256)
    assert.equal(next.receipt.tick,day);assert.equal(next.event.before.expectedFileSha256,input.before.fileSha256)
    assert(same(fromRef(next.event.evidence.capabilityRef),a.release)&&same(fromRef(next.event.policyRef),a.policy))
    assert(same(fromRef(next.event.evidence.inputRef),intent.input)&&same(fromRef(next.event.evidence.outputRef),intent.output))
    assert.equal(output.inputSha256,intent.input.sha256);assert.equal(output.historyValueSha256,input.historyValueSha256)
    const record=JSON.parse(bound({path:name+'.evolution/'+next.receipt.businessKey+'.'+next.receipt.fileSha256+'.record.json',sha256:next.receipt.fileSha256}))
    assert.deepEqual(record,sealed.record);assert.deepEqual(record.worldState.payload.environment.evolution.weather.values,output.values)
    const period=input.interval,rows=[...input.rows.slice(1),{period,values:output.values,provenance:{kind:'committed_model_weather',worldId:id.worldId,
      tick:day,businessKey:next.event.businessKey,eventSha256:next.event.eventSha256,previousEventSha256:next.event.previousEventSha256,fileSha256:next.receipt.fileSha256,
      input:intent.input,output:intent.output,model:fromRef(next.event.evidence.modelRef),capability:a.release,reasonRefs:next.event.reasonRefs}}]
    const history=rows.map(r=>r.values)
    input={...input,before:stateRef(record,next.receipt.fileSha256),history,historyValueSha256:featureSha(history),rows,
      head:{businessKey:next.receipt.businessKey,eventSha256:next.receipt.eventSha256},
      interval:{logicalStartUtc:period.logicalEndUtc,logicalEndUtc:new Date(Date.parse(period.logicalEndUtc)+86400000).toISOString(),durationSeconds:86400},
      randomBeforeSha256:digest(record.randomState)}
  }
  assert.deepEqual(stateRef(current.record,current.fileSha256),input.before);assert.deepEqual(current.record.worldState.payload.environment.evolution.weather.values,input.history.at(-1))
  return {input,current,store}
}

function census(dir){
  const parent=dir+'/steps'
  if(!fs.existsSync(safe(parent)))return []
  const dirs=fs.readdirSync(safe(parent),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))
  assert(dirs.length<=2&&dirs.every((e,i)=>e.isDirectory()&&e.name===String(i+2)),'nonsequential or excess weather reservations')
  return dirs.map(e=>({tick:Number(e.name),path:parent+'/'+e.name}))
}
export function describeRollingTrialBudget(slotTicks,currentTick){
  assert(Array.isArray(slotTicks)&&slotTicks.length<=2&&slotTicks.every((t,i)=>t===2+i),'invalid durable slots')
  assert(Number.isSafeInteger(currentTick)&&currentTick>=1&&currentTick<=3,'invalid committed cursor')
  const used=slotTicks.length,committed=currentTick-1
  assert(used>=committed&&used<=committed+1,'weather reservations differ from committed cursor')
  return {reserved:used,committed,remainingModelSlots:2-used,unresolved:used>committed,exhausted:committed===2}
}
const usage=(dir,input)=>describeRollingTrialBudget(census(dir).map(s=>s.tick),input.before.tick)
export async function preflightRollingWeather(...args){
  assert.equal(args.length,0,'fixed formal preflight only')
  let a,error
  try{a=admitted('production')}catch(e){error=e.message}
  const api=await runtime()
  if(!a){
    const base=await initialHead('data/world-runtime',api),current=await base.store.readNatural(q(base.id))
    assert.equal(current.status,'found')
    const eligible=current.record.tick===1?await readWorldRollingWeatherInput('production'):null
    return {productionAdmitted:false,releaseFailure:error,identity:base.id,before:stateRef(current.record,current.fileSha256),
      anchor:base.input.head,currentInputSha256:eligible?sha(encode(eligible)):null,workerStarts:0,worldWrites:0}
  }
  const {input}=await readHead('production',a,api)
  return {productionAdmitted:true,before:input.before,anchor:a.cfg.anchor,currentInputSha256:sha(encode(input)),historyValueSha256:input.historyValueSha256,
    release:a.release,budget:a.budget,window:input.interval,usage:usage(a.l.dir,input),workerStarts:0,worldWrites:0}
}

function creation(pid){
  assert(Number.isSafeInteger(pid)&&pid>0)
  const cmd="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+"';if($p){$p.CreationDate.ToUniversalTime().ToString('o')}"
  return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{windowsHide:true,encoding:'utf8',maxBuffer:4096,timeout:6000}).trim()||null
}
function launchOpts(mode,index){
  assert([1,2].includes(index),'unsupported server activation')
  return {root:ROOT,runnerPath:files.entry,runnerArgs:[mode==='production'?'--serve':'--qualify-serve',String(index)],
    launchIdentity:'weather-rolling-v4-'+mode+'-'+index,receiptRoot:loc(mode).dir+'/launches'}
}
const receiptPath=opt=>opt.receiptRoot+'/'+opt.launchIdentity+'/launch-receipt.json'
function serverExists(mode,n){
  const opt=launchOpts(mode,n)
  assert(fs.existsSync(safe(receiptPath(opt))),'uncertain prior background spawn; no second activation')
  const r=json(receiptPath(opt));validateProjectCommandBackgroundReceipt({...opt,receipt:r})
  return creation(r.processId)===r.processCreationDateUtc
}
async function launch(mode){
  const a=admitted(mode),api=await runtime(),dir=a.l.dir,id=a.cfg.identity
  const pending=a.l.store+'/'+id.ownerId+'/'+id.worldId+'.json.transaction.json'
  if(fs.existsSync(safe(pending))){
    // A prepared journal hides even historical reads in the original Store. Recover only
    // an exact existing transaction tied to this release, reservation and original sidecars.
    const first=json(dir+'/activation-1.json')
    assert(same(first.release,a.release)&&same(first.budget,a.budget))
    assert(Date.now()<Date.parse(first.startedUtc)+a.cfg.maximumRunSeconds*1000,'expired rolling recovery window')
    for(const n of [1,2])if(fs.existsSync(safe(dir+'/activation-'+n+'.json'))&&serverExists(mode,n))return {status:'running',activation:n}
    const journal=json(pending),slots=census(dir),last=slots.at(-1);assert(last,'unrecognized world journal')
    const intent=json(last.path+'/intent.json'),res=json(last.path+'/reservation.json')
    assert(same(res.release,a.release)&&same(res.budget,a.budget));assert.equal(intent.request.path,last.path+'/request.json')
    const request=JSON.parse(bound(intent.request))
    assert.equal(request.event.businessKey,journal.businessKey);assert.equal(request.event.eventSha256,journal.eventSha256)
    assert.deepEqual(request.event.identity,id);assert.equal(request.expectedFileSha256,res.before.fileSha256)
    assert(same(fromRef(request.event.evidence.capabilityRef),a.release)&&same(fromRef(request.event.policyRef),a.policy))
    assert.equal(intent.input.path,last.path+'/input.json');assert.equal(intent.output.path,last.path+'/output.json')
    assert(same(intent.input,fromRef(request.event.evidence.inputRef))&&same(intent.output,fromRef(request.event.evidence.outputRef)))
    bound(intent.input);bound(intent.output);bound(intent.process)
    sameAdmission(a,admitted(mode))
    const store=api.store.createProductionWorldRuntimeStore(safe(a.l.store))
    const restored=await store.recoverNaturalTransition({identity:id,businessKey:journal.businessKey})
    assert(restored.ok&&restored.receipt.eventSha256===journal.eventSha256,'original rolling journal recovery failed')
  }
  const {input}=await readHead(mode,a,api)
  const budget=usage(dir,input)
  if(budget.exhausted)return {status:'rolling_budget_exhausted',usage:budget,before:input.before}
  // Once a slot exists it counts permanently, including failed or incomplete work.
  if(budget.unresolved){
    return {status:'unresolved_consumed_slot',usage:budget,before:input.before,automaticModelRetries:0}
  }
  if(mode==='qualification'){
    const dispatch=json(dir+'/dispatch.json');assert.equal(dispatch.budgetSha256,a.budget.sha256)
    if(!fs.existsSync(safe(dir+'/activation-1.json'))){
      assert.equal(dispatch.initialInputSha256,sha(encode(input)));const d=Date.parse(dispatch.startBeforeUtc);assert(Date.now()<d&&d-Date.now()<=600000)
    }
  }
  fs.mkdirSync(safe(dir),{recursive:true})
  let index=1
  if(fs.existsSync(safe(dir+'/activation-1.json'))){
    const first=json(dir+'/activation-1.json')
    assert(same(a.budget,first.budget)&&same(a.release,first.release))
    if(Date.now()>=Date.parse(first.startedUtc)+a.cfg.maximumRunSeconds*1000)return {status:'rolling_total_wall_exhausted',usage:budget}
    if(serverExists(mode,1))return {status:'running',activation:1}
    index=2
    if(fs.existsSync(safe(dir+'/activation-2.json')))return {status:serverExists(mode,2)?'running':'server_activation_budget_exhausted',activation:2,usage:budget}
  }
  const client={clientPid:process.pid,clientCreationUtc:creation(process.pid),startedUtc:new Date().toISOString(),budget:a.budget,release:a.release,initialInputSha256:sha(encode(input))}
  save(dir,'activation-'+index+'.json',client)
  const opts=launchOpts(mode,index),r=launchProjectCommandBackground(opts)
  validateProjectCommandBackgroundReceipt({...opts,receipt:r})
  return {status:'launched',activation:index,clientPid:process.pid,serverPid:r.processId,receipt:bind(receiptPath(opts)),budget:a.budget}
}

async function verifyActivation(mode,n){
  const opts=launchOpts(mode,n),client=json(loc(mode).dir+'/activation-'+n+'.json'),start=performance.now()
  while(performance.now()-start<18000){
    if(creation(client.clientPid)!==client.clientCreationUtc&&fs.existsSync(safe(receiptPath(opts)))){
      const receipt=json(receiptPath(opts));validateProjectCommandBackgroundReceipt({...opts,receipt})
      assert.equal(receipt.processId,process.pid);assert.equal(receipt.processCreationDateUtc,creation(process.pid))
      return {clientExited:true,clientPid:client.clientPid,serverPid:process.pid,serverCreationUtc:receipt.processCreationDateUtc,atUtc:new Date().toISOString(),receipt:bind(receiptPath(opts))}
    }
    await wait(250)
  }
  throw Error('weather client exit or server receipt not verified')
}
function resource(dir,runRoot,limits,start,deadline){
  if(Date.now()>=deadline)return 'rolling_total_wall_limit'
  if(fs.existsSync(safe(runRoot+'/stop')))return 'requested_stop'
  const d=fs.statfsSync(safe(dir),{bigint:true});if(d.bavail*d.bsize<BigInt(limits.minimumFreeDiskMiB)*1048576n)return 'disk_reserve'
  const files=fs.readdirSync(safe(dir));if(files.length>limits.artifactFilesMaximum)return 'file_limit'
  let size=0
  for(const f of files){try{const s=fs.lstatSync(safe(dir+'/'+f));if(!s.isFile()||s.nlink!==1)return 'artifact_type';size+=s.size}catch(e){if(e.code!=='ENOENT')throw e}}
  if(size>limits.artifactBytesMaximum)return 'output_byte_limit'
  let pulse=start
  try{pulse=fs.statSync(safe(dir+'/heartbeat')).mtimeMs}catch(e){if(e.code!=='ENOENT')throw e}
  return Date.now()-pulse>limits.staleSeconds*1000?'worker_stale':null
}
function outputProof(input,stdout,proof,pid,limits){
  assert(typeof stdout==='string'&&Buffer.byteLength(stdout)<=65536)
  const out=JSON.parse(stdout)
  assert.deepEqual(Object.keys(out).sort(),['checkpointSha256','historyValueSha256','inputSha256','job','modelForwards','pid','trainingUpdates','values'])
  assert(proof?.liveOwnerCleanupConfirmed&&proof.cleanupConfirmed&&proof.guardReleaseConfirmed&&proof.ownerClosed&&proof.proof?.assignedBeforeResume&&
    proof.proof.killOnJobClose&&proof.proof.exitCode===0&&proof.proof.activeProcessesAfterCleanup===0)
  assert(Number.isSafeInteger(pid)&&pid===out.pid&&pid===proof.proof.rootPid&&proof.proof.ownerPid===proof.ownerIdentity.pid)
  assert.equal(out.inputSha256,sha(encode(input)));assert.equal(out.checkpointSha256,input.modelSha256)
  assert.equal(out.historyValueSha256,input.historyValueSha256);assert.equal(out.modelForwards,1);assert.equal(out.trainingUpdates,0)
  assert.equal(out.job.cpuAffinityCount,2);assert.equal(out.job.maxProcesses,1);assert.equal(out.job.maxCommittedBytes,limits.maxCommittedMemoryMiB*1048576)
  assert(Number.isSafeInteger(out.job.peakCommittedBytes)&&out.job.peakCommittedBytes>0&&out.job.peakCommittedBytes<=out.job.maxCommittedBytes)
  assert(Array.isArray(out.values)&&out.values.length===4&&out.values.every(Number.isFinite))
  return out
}
function makeRequest(mode,a,api,current,input,out,refs){
  const old=current.record,id=input.identity;assert.equal(current.fileSha256,input.before.fileSha256);assert.deepEqual(idOf(old),id)
  const before=Object.fromEntries(a.domain.domainFields.map((f,i)=>[f.fieldId,input.history.at(-1)[i]]))
  const changes=a.domain.domainFields.flatMap((f,i)=>out.values[i]===before[f.fieldId]?[]:[{fieldId:f.fieldId,operation:'replace',beforeValueSha256:digest(before[f.fieldId]),newValue:out.values[i],reasonRefs:[refs.output.sha256]}])
  assert(api.domain.validateWorldEnvironmentDelta({policy:a.domain,identity:id,interval:input.interval,beforeValues:before,changes,result:changes.length?'changes':'no_change'}).domainValid)
  const record=structuredClone(old)
  for(const k of ['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256'])delete record[k]
  record.tick++;record.stateVersion++;record.eventCursor++;record.worldFacts.tick=record.worldState.tick=record.tick;record.savedAt=new Date().toISOString()
  const e=record.worldState.payload.environment.evolution
  e.logicalEndUtc=input.interval.logicalEndUtc;e.weather={fieldOrder:input.fieldOrder,units:input.units,period:input.interval,values:out.values,
    origin:mode==='production'?'model_predicted':'model_predicted_private_simulation'}
  assert.deepEqual(invariant(record),invariant(old))
  const event={schemaVersion:'world-evolution-event-v1',identity:id,eventKind:'evolution',eventId:'weather-v4-day-'+record.tick,businessKey:'0'.repeat(64),
    cursor:record.eventCursor,fromTick:old.tick,toTick:record.tick,fromStateVersion:old.stateVersion,toStateVersion:record.stateVersion,before:{
      expectedTick:old.tick,expectedStateVersion:old.stateVersion,expectedFileSha256:current.fileSha256,worldFactsPayloadSha256:old.worldFactsPayloadSha256,
      statePayloadSha256:old.statePayloadSha256,recordContentSha256:old.recordContentSha256},interval:input.interval,policyRef:asRef(a.policy),
    externalInputRefs:[...new Map(input.rows.flatMap(r=>r.provenance.archive?[r.provenance.archive,r.provenance.receipt]:[]).map(v=>[v.path,asRef(v)])).values()],
    historyInputRef:asRef(refs.input),evidence:{kind:'evolution',capabilityRef:asRef(a.release),modelRef:a.domain.modelRef,inputRef:asRef(refs.input),
      outputRef:asRef(refs.output),validatorRef:a.domain.validatorRef},changes,reasonRefs:[refs.input.sha256,refs.output.sha256,refs.process.sha256],
    previousEventSha256:input.head.eventSha256,domainAfterSha256:api.transaction.computeWorldEvolutionDomainSha(record)}
  event.businessKey=api.transaction.computeWorldEvolutionBusinessKey(event)
  const sealed=api.transaction.sealWorldEvolutionEvent(event)
  e.commit={businessKey:sealed.businessKey,eventId:sealed.eventId,eventSha256:sealed.eventSha256,historyHead:{cursor:record.eventCursor,eventSha256:sealed.eventSha256}}
  const request={record,event:sealed,expectedTick:old.tick,expectedStateVersion:old.stateVersion,expectedFileSha256:current.fileSha256}
  api.transaction.snapshotNaturalWorldTransition(request)
  return request
}

async function step(mode,a,api,head,deadline){
  const {input,store}=head,day=input.before.tick+1,dir=a.l.dir+'/steps/'+day,limits=a.cfg.workerLimits
  const state=usage(a.l.dir,input);assert(!state.exhausted)
  if(state.unresolved){
    const i=json(dir+'/intent.json'),res=json(dir+'/reservation.json')
    assert.deepEqual(res.before,input.before);assert(same(res.release,a.release)&&same(res.budget,a.budget))
    assert.equal(i.request.path,dir+'/request.json');assert.equal(i.input.path,dir+'/input.json');assert(bound(i.input).equals(encode(input)))
    const request=JSON.parse(bound(i.request));assert.equal(request.expectedFileSha256,input.before.fileSha256)
    assert(same(fromRef(request.event.evidence.capabilityRef),a.release)&&same(fromRef(request.event.policyRef),a.policy))
    const recovered=await store.recoverNaturalTransition({identity:input.identity,businessKey:request.event.businessKey})
    assert(recovered.ok&&recovered.receipt.eventSha256===request.event.eventSha256,'no original recoverable transaction; consumed slot will not retry')
    return {tick:day,receipt:recovered.receipt,recovered:true,modelForwards:0}
  }
  assert(state.remainingModelSlots>0);fs.mkdirSync(safe(a.l.dir+'/steps'),{recursive:true});fs.mkdirSync(safe(dir))
  const inputRef=save(dir,'input.json',encode(input)),reservation=save(dir,'reservation.json',{mode,serverPid:process.pid,worldId:input.identity.worldId,
    budget:a.budget,release:a.release,atUtc:new Date().toISOString(),before:input.before,historyValueSha256:input.historyValueSha256,
    inputSha256:inputRef.sha256,workerStartMaximum:1,attemptNumber:state.reserved+1})
  let managed
  try{
    sameAdmission(a,admitted(mode))
    const now=Date.now();assert.equal(resource(dir,a.l.dir,limits,now,deadline),null)
    managed=await runOwnedWorker(a.interpreter.directInterpreter.path,[...a.interpreter.args,safe(files.worker),mode,String(day),reservation.sha256,inputRef.sha256],{
      cwd:ROOT,timeout:Math.min(limits.workerSecondsMaximum*1000,deadline-now),maxBuffer:limits.logBytesPerStreamMaximum,
      env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',PYTHONDONTWRITEBYTECODE:'1'},
      abortReason:()=>resource(dir,a.l.dir,limits,now,deadline)})
    const output=save(dir,'output.json',Buffer.from(managed.stdout)),proof=save(dir,'process.json',managed.ownedReceipt)
    const out=outputProof(input,managed.stdout,managed.ownedReceipt,Number(read(dir+'/heartbeat',32)),limits)
    const after=admitted(mode);sameAdmission(a,after)
    const current=await readHead(mode,after,api);assert.deepEqual(current.input,input,'weather prestate changed during forecast')
    const refs={input:inputRef,output,process:proof}
    const request=makeRequest(mode,a,api,current.current,input,out,refs)
    const req=save(dir,'request.json',request);save(dir,'intent.json',{...refs,request:req,businessKey:request.event.businessKey})
    assert(Date.now()<deadline,'rolling schedule expired before commit');sameAdmission(a,admitted(mode))
    const written=await store.writeNaturalTransition(request);assert(written.ok&&!written.replayed,written.message)
    const replay=await store.readNaturalTransition({identity:input.identity,businessKey:request.event.businessKey});assert.equal(replay.status,'found');assert.deepEqual(written.receipt,replay.receipt)
    save(dir,'receipt.json',written.receipt)
    return {tick:day,modelForwards:1,receipt:written.receipt,...refs}
  }catch(error){
    save(dir,'failure.json',{atUtc:new Date().toISOString(),error:error.message,ownedReceipt:error.ownedReceipt??managed?.ownedReceipt??null,
      stderr:error.stderr??null,automaticRetries:0});throw error
  }
}

async function serve(mode,index){
  const a=admitted(mode),api=await runtime(),exit=await verifyActivation(mode,index),dir=a.l.dir
  const first=json(dir+'/activation-1.json'),activation=json(dir+'/activation-'+index+'.json')
  assert(same(first.budget,a.budget)&&same(first.release,a.release)&&same(activation.budget,a.budget)&&same(activation.release,a.release))
  const deadline=Date.parse(first.startedUtc)+a.cfg.maximumRunSeconds*1000
  assert(Date.now()<deadline,'rolling service total deadline already elapsed')
  let head=await readHead(mode,a,api)
  const start=head.input.before,anchor=api.clock.createWorldEvolutionClockAnchor({policy:a.cfg.clock,lastCommittedLogicalEndUtc:head.input.rows.at(-1).period.logicalEndUtc,
    monotonicNowMs:performance.now(),recoveredPendingSteps:0})
  const steps=[]
  for(;;){
    const state=usage(dir,head.input)
    if(state.exhausted)break
    assert(Date.now()<deadline,'whole rolling weather trial wall budget exhausted')
    if(fs.existsSync(safe(dir+'/stop')))return save(dir,'stopped-'+index+'.json',{status:'requested_stop',exit,steps,usage:state})
    const remaining=a.cfg.maximumNewSteps-state.committed
    const plan=api.clock.planWorldEvolutionBatch(anchor,{monotonicNowMs:performance.now(),committedLogicalEndUtc:head.input.rows.at(-1).period.logicalEndUtc,
      remainingStepBudget:remaining,remainingLogicalSeconds:remaining*a.cfg.clock.stepSeconds,maxBatchSteps:1})
    if(!plan.proposedSteps){await wait(Math.min(1000,Math.max(1,plan.nextScheduleInMilliseconds)));continue}
    assert.deepEqual(plan.intervals[0],head.input.interval);sameAdmission(a,admitted(mode))
    steps.push(await step(mode,a,api,head,deadline));head=await readHead(mode,a,api)
  }
  const remaining=deadline-Date.now();assert(remaining>0)
  const child=spawnSync(process.execPath,[safe(files.entry),mode==='production'?'--status':'--qualify-status'],{cwd:ROOT,
    timeout:Math.min(remaining,30000),maxBuffer:65536,windowsHide:true,encoding:'utf8'})
  assert.equal(child.status,0,child.stderr);const check=JSON.parse(child.stdout)
  assert.equal(check.pid,child.pid);assert.notEqual(child.pid,process.pid);assert.deepEqual(check.before,head.input.before);assert(check.usage.exhausted)
  return save(dir,'completed-'+index+'.json',{status:'rolling_budget_exhausted',mode,anchor:a.cfg.anchor,start,after:head.input.before,steps,exit,
    readback:check,activation:index,budget:a.budget,release:a.release,finishedUtc:new Date().toISOString(),workerRetries:0,offlineCatchupSteps:0})
}
export async function rollingWeatherCommand(command,...args){
  assert(typeof command==='string')
  const options={'--preflight':['production','preflight'],'--launch':['production','launch'],'--status':['production','status'],'--serve':['production','serve'],
    '--qualify-launch':['qualification','launch'],'--qualify-serve':['qualification','serve'],'--qualify-status':['qualification','status']}
  assert(Object.hasOwn(options,command),'fixed weather runtime command required')
  const [mode,action]=options[command]
  if(action==='serve'){assert(args.length===1&&['1','2'].includes(args[0]),'fixed activation required');return serve(mode,Number(args[0]))}
  assert.equal(args.length,0,'weather entry accepts no authority, budget or world override')
  if(action==='preflight')return preflightRollingWeather()
  if(action==='launch')return launch(mode)
  const a=admitted(mode),head=await readHead(mode,a,await runtime())
  return {pid:process.pid,scope:mode,before:head.input.before,head:head.input.head,usage:usage(a.l.dir,head.input),
    inputSha256:sha(encode(head.input)),currentWeather:head.input.history.at(-1),release:a.release,budget:a.budget}
}
