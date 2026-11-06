import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'
import {pathToFileURL} from 'node:url'
import {createHash,randomUUID} from 'node:crypto'
import {launchProjectCommandBackground,validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {ensureAiPainterProgramEventCommitted} from './ai-painter-program-event-store.mjs'
import {ROOT,safe,digest} from './world-initialized-evolution.mjs'

const MiB=1024**2,GiB=1024**3,name='stage0-native-256-formal-229'
const task='.runtime/ai-painter/controller-repair-reviews/native-stage0-formal-training-229-20261103'
const actual='.runtime/ai-painter/native-stage0-formal-training/'+name
const policyFile='data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json'
const paths={entry:'scripts/run-native-stage0-formal-training.mjs',host:'scripts/lib/native-stage0-formal-service.mjs',
  worker:'ml/ai-painter/scripts/native_stage0_formal_worker.py',reviewer:'scripts/lib/native-stage0-formal-review.mjs'}
const historical='.runtime/ai-painter/controller-repair-reviews/'
const sources=[
  {path:historical+'native-stage0-compute-admission-220-20261103/verified-48.json',sha256:'7624533e7bfb6b44bd502bdf3cfbe2200c780c7f077f5a40227d1a67fd51cb7c'},
  {path:historical+'native-stage0-gpu-training-entry-226-20261103/delivery.json',sha256:'ace692e2aaddad399ccb8eedb980b70a6d103e1995fc945f85d1744a0502189b'},
  {path:historical+'native-stage0-checkpoint-continuation-228-20261103/delivery.json',sha256:'d84b813407cc75a4543a425e4e122f0dc8993b5c32d5cbf7255e8dd145aa2f21'},
]
const inputRef={path:historical+'native-stage0-source-gate-219-20261103/cpu-ready.json',sha256:'9e7b4f567faaba6a82c603a8c3b2c6fa205b48962afe017c86bf5fef2a8036f8'}
export const nativeStage0ServiceLimits=Object.freeze({segmentSeconds:840,totalSeconds:32400,segmentPairs:24,segments:48,maxArtifactBytes:128*MiB,
  failureReserveBytes:64*MiB,minimumHostEntryGiB:13,minimumHostRunningGiB:10,minimumDiskMiB:2048,maximumTemperatureC:85,
  wholeCardFraction:0.7,minimumFreeVramMiB:2048,maximumJobBytes:8*GiB,cpuCores:2,maxPerStreamBytes:8*MiB,automaticRetries:0})
const globalGuard='.runtime/ai-painter/owned-worker-guards',gpuId='GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd'
const hx=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const same=(a,b)=>a?.path===b?.path&&a.sha256===b.sha256&&(a.bytes===undefined||b.bytes===undefined||a.bytes===b.bytes)
const two=n=>String(n).padStart(2,'0')
const exists=p=>fs.existsSync(safe(p))
const json=p=>JSON.parse(fs.readFileSync(safe(p),'utf8'))
const mkdir=p=>fs.mkdirSync(safe(p),{recursive:true})
const iso=()=>new Date().toISOString()
function ref(p){
  const f=safe(p),fd=fs.openSync(f,'r')
  try{
    const st=fs.fstatSync(fd);assert(st.isFile()&&st.nlink===1&&st.size>0&&st.size<=128*MiB,'invalid file '+p)
    const h=createHash('sha256'),chunk=Buffer.allocUnsafe(Math.min(1024*1024,st.size))
    let n,read=0
    while((n=fs.readSync(fd,chunk,0,chunk.length,null))>0){read+=n;h.update(chunk.subarray(0,n))}
    const end=fs.fstatSync(fd);assert.equal(read,st.size);assert.equal(end.ino,st.ino);assert.equal(end.mtimeMs,st.mtimeMs)
    return {path:p,bytes:read,sha256:h.digest('hex')}
  }finally{fs.closeSync(fd)}
}
function verified(r,expected){assert(r&&hx(r.sha256));if(expected)assert.equal(r.path,expected);assert(same(r,ref(r.path)),'source changed '+r.path);return r}
function save(p,body){
  // Publish immutable records whole; a losing writer can only adopt identical bytes.
  const target=safe(p),tmp=target+'.'+randomUUID()+'.tmp',raw=Buffer.from(JSON.stringify(body,null,2)+'\n')
  if(!exists(p)){
    const run=[actual,settings(true).run].find(v=>p.startsWith(v+'/'))
    if(run)assert(usage(run)+raw.length+(p.endsWith('/terminal.json')||p.endsWith('/terminal.json.tmp')?0:65536)<=128*MiB,'aggregate artifact quota')
  }
  try{
    fs.writeFileSync(tmp,raw,{flag:'wx',flush:true})
    try{fs.linkSync(tmp,target)}catch(e){if(e.code!=='EEXIST')throw e;assert(fs.readFileSync(target).equals(raw),'conflicting '+p)}
  }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
  return ref(p)
}
function usage(dir){
  let total=0
  function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);let s
    try{s=fs.lstatSync(f)}catch(err){if(err.code==='ENOENT')continue;throw err}
    assert(!s.isSymbolicLink(),'linked execution artifact')
    if(s.isDirectory())walk(f);else {assert(s.isFile());total+=s.size}
  }}
  if(exists(dir))walk(safe(dir));return total
}
function settings(cpu){
  const run=cpu?task+'/service/cpu-fixture':actual
  return {cpu,run,maximum:cpu?2:48,policy:cpu?task+'/service/cpu-policy.json':policyFile,grant:task+(cpu?'/service/cpu-dispatch.json':'/controller/dispatch.json'),
    phase:cpu?'cpu_rehearsal':'train',segmentSeconds:cpu?180:840,totalSeconds:cpu?600:32400}
}
const segment=(a,n)=>a.run+'/segments/'+two(n)
const seal=(a,n)=>segment(a,n)+'/seal.json'
function verifyPrior(){
  for(const s of sources)verified(s)
  const [gate,one,twoStep]=sources.map(r=>json(r.path)),data=json(verified(inputRef).path)
  assert.deepEqual([gate.actualTrainCases,gate.generatorForwards,gate.discriminatorForwards,gate.fullGeneratorGradients,gate.discriminatorGradients,gate.optimizerUpdates],
    [48,48,144,240,48,0])
  assert.deepEqual(gate.samples.map(s=>s.id),data.gateOrder);for(const r of gate.samples)verified(r)
  assert.deepEqual(one.callbacks,{D:1,G:1});assert(one.jobEmpty&&!one.formalStagePassed)
  assert.deepEqual(twoStep.callbacks,{D:1,G:1});assert(twoStep.exitCode===0&&twoStep.jobEmpty&&twoStep.deviceRngExact&&twoStep.bothDeviceReloadsRgbRawIdentical&&twoStep.freshModelAndAdamWStateStep2IndependentCpuExact)
  verified(twoStep.checkpoint);assert.equal(data.historicalTrainOrder.length,48);return data
}
function configure(cpu){
  const a=settings(cpu),p=ref(a.policy),s=json(a.policy).service
  assert.equal(s.runId,name);assert.equal(s.realRunRoot,actual);assert.deepEqual(s.resourceLimits,nativeStage0ServiceLimits)
  for(const [k,f] of Object.entries(paths))if(!cpu||k!=='reviewer')verified(s[k],f)
  assert(Array.isArray(s.sourceBindings)&&s.sourceBindings.length>0);for(const r of s.sourceBindings)verified(r)
  assert.equal(s.interpreter.sha256,'dd5f8d19f6755d6491ee7c4bef2fe35ddd521334cc3ca3ed8fc93ebcadf135d0')
  assert.equal(s.interpreter.path.toLowerCase(),'d:\\devcaches\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe')
  assert.equal(createHash('sha256').update(fs.readFileSync(s.interpreter.path)).digest('hex'),s.interpreter.sha256)
  if(!cpu){
    assert.deepEqual(json(a.policy).finalReadback,finalLimits)
    verified(s.cpuQualification,task+'/service/cpu-qualification.json')
    const q=json(s.cpuQualification.path);assert(q.success===true&&q.completedSegments===2&&q.actualOptimizerUpdates===0)
    validateCpuReceipt(s)
  }
  return {...a,p,s,base:verifyPrior()}
}
function repeat(a){
  verified(a.p);for(const k of Object.keys(paths))if(!a.cpu||k!=='reviewer')verified(a.s[k],paths[k]);for(const b of a.s.sourceBindings)verified(b)
}
function activation(a,n){return {root:ROOT,launchIdentity:'formal-native-stage0-'+(a.cpu?'cpu':'gpu')+'-'+n,runnerPath:paths.entry,
  runnerArgs:[a.cpu?'--cpu-serve':'--serve',String(n)],receiptRoot:a.run+'/launches'}}
function activePid(pid){
  assert(Number.isSafeInteger(pid)&&pid>0)
  const cmd="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+"';if($p){$p.CreationDate.ToUniversalTime().ToString('o')}"
  return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{windowsHide:true,encoding:'utf8',timeout:6000,maxBuffer:4096}).trim()||null
}
const hostFile=(a,n)=>a.run+'/activations/'+two(n)+'.json'
function receiptPath(o){return o.receiptRoot+'/'+o.launchIdentity+'/launch-receipt.json'}
function priorHost(a){
  if(!exists(a.run+'/activations'))return null
  const ns=fs.readdirSync(safe(a.run+'/activations')).filter(n=>/^\d{2,}\.json$/.test(n)).map(n=>Number(n.split('.')[0])).sort((x,y)=>x-y)
  for(const [i,n] of ns.entries())assert.equal(i+1,n,'discontinuous host activation')
  if(!ns.length)return null
  const n=ns.at(-1),o=activation(a,n)
  if(!exists(receiptPath(o)))return {n,pid:null,alive:null,creation:null,status:'launch_receipt_pending_or_missing'}
  const r=json(receiptPath(o));validateProjectCommandBackgroundReceipt({...o,receipt:r})
  return {n,pid:r.processId,alive:activePid(r.processId)===r.processCreationDateUtc,creation:r.processCreationDateUtc}
}
async function verifyOwnHost(a,n){
  const o=activation(a,n),h=json(hostFile(a,n));assert.equal(h.activation,n)
  const start=performance.now()
  while(performance.now()-start<20000){
    if(activePid(h.launcherPid)!==h.launcherCreationUtc&&exists(receiptPath(o))){
      const r=json(receiptPath(o));validateProjectCommandBackgroundReceipt({...o,receipt:r})
      assert.equal(r.processId,process.pid);assert.equal(activePid(process.pid),r.processCreationDateUtc)
      return {pid:process.pid,activation:n,originalLauncherExited:true,receipt:ref(receiptPath(o))}
    }
    await delay(250)
  }
  throw Error('detached host or previous launcher could not be verified')
}
function gpu(a,enter){
  const text=execFileSync('nvidia-smi',['--query-gpu=uuid,memory.total,memory.used,memory.free,temperature.gpu','--format=csv,noheader,nounits'],
    {encoding:'utf8',windowsHide:true,timeout:4000})
  const rows=text.trim().split(/\r?\n/).map(s=>s.split(',').map(v=>v.trim())).filter(row=>row[0]===gpuId)
  assert.equal(rows.length,1);assert.equal(rows[0].length,5);assert(rows[0].slice(1,4).every(v=>/^\d+$/.test(v))&&/^\d+(\.\d+)?$/.test(rows[0][4]))
  const [total,used,free,temp]=rows[0].slice(1).map(Number),margin=enter?3072:0
  assert(total>0&&used+free<=total+1&&(used+margin)*10<=total*7&&free-margin>=2048&&temp<85,'GPU guard '+rows[0].join(','))
  return {gpuId,totalMiB:total,usedMiB:used,freeMiB:free,temperatureC:temp,entryReserveMiB:margin}
}
function resource(a,enter,gradient=false){
  const b=usage(a.run),d=fs.statfsSync(safe(a.run)),free=os.freemem(),disk=d.bavail*d.bsize
  assert(free>=(enter?13:10)*GiB&&disk>=2048*MiB,'host or disk below floor')
  assert(b+(gradient?64*MiB:0)<=128*MiB,'retention failure reserve exhausted')
  const current=json('.runtime/ai-painter/current-execution-registry/current.json');assert.equal(current.activeExecution,null,'conflicting legacy trainer')
  return {bytes:b,hostFreeBytes:free,diskFreeBytes:disk,card:a.cpu?null:gpu(a,enter)}
}
const policyHash=a=>a.cpu?ref(task+'/task-alignment.json').sha256:a.p.sha256
const topology=['networks','adamw','rng','cudaRng','modes','counts','history']
const finalLimits={attempts:1,device:'cuda:0',maxWorkerSeconds:120,maxGeneratorForwards:8,maxDiscriminatorForwards:0,maxOptimizerUpdates:0,automaticRetries:0}
function validateResult(a,n,withCheckpoint){
  const dir=segment(a,n),ticketPath=dir+'/ticket.json',ticket=json(ticketPath),outPath=dir+'/result.json',out=json(outPath)
  const opening=json(a.run+'/opening.json')
  assert(ticket.phase===a.phase&&ticket.runId===name&&ticket.segment===n&&ticket.policySha256===policyHash(a))
  assert.equal(ticket.runDeadlineUtc,opening.runDeadlineUtc)
  assert.equal(ticket.startPair,(n-1)*24);assert.equal(ticket.endPair,n*24)
  assert(Date.parse(ticket.segmentDeadlineUtc)<=Date.parse(ticket.runDeadlineUtc)&&Date.parse(ticket.segmentDeadlineUtc)>Date.parse(ticket.issuedAtUtc))
  assert.equal(out.schema,a.cpu?'native-stage0-formal-cpu-fixture-v1':'native-stage0-formal-segment-result-v1')
  assert.equal(out.runId,name);assert.equal(out.segment,n);assert.equal(out.startPair,ticket.startPair);assert.equal(out.endPair,ticket.endPair)
  assert.equal(out.policySha256,ticket.policySha256);assert(same(out.ticket,ref(ticketPath)));assert.deepEqual(out.counts,{generator:n*24,discriminator:n*24})
  assert.equal(out.checkpoint.path,dir+'/recovery.pt');assert(Number.isSafeInteger(out.checkpoint.bytes)&&out.checkpoint.bytes>0&&out.checkpoint.bytes<=32*MiB&&hx(out.checkpoint.sha256))
  if(withCheckpoint)verified(out.checkpoint)
  assert.deepEqual(Object.keys(out.stateDigest).sort(),[...topology].sort());assert(Object.values(out.stateDigest).every(hx))
  assert(Array.isArray(out.trainingRows)&&out.trainingRows.length===24)
  const ids=new Set()
  for(const [i,row] of out.trainingRows.entries()){
    const pair=ticket.startPair+i,position=row.position
    assert.deepEqual([position.epoch,position.zeroBasedEpochPosition],[Math.floor(pair/48)+1,pair%48])
    assert.equal(position.sampleId,a.base.historicalTrainOrder[position.trainIndex]);assert(!ids.has(position.sampleId));ids.add(position.sampleId)
    assert.deepEqual(row.counts,{generator:pair+1,discriminator:pair+1})
    if(!a.cpu){assert(Number.isFinite(row.generatorLoss)&&Number.isFinite(row.discriminatorLoss));assert(hx(row.historySha256))}
  }
  if(n%2===0){
    const first=json(segment(a,n-1)+'/result.json').trainingRows.map(row=>row.position.sampleId)
    assert.deepEqual([...first,...ids].sort(),[...a.base.historicalTrainOrder].sort(),'epoch did not use every original training sample exactly once')
  }
  if(a.cpu){assert.equal(out.optimizerUpdates,0);assert.equal(out.scope,'cpu_rehearsal')}
  else{
    assert.equal(out.phase,'train');assert(hx(out.historySha256))
    const check=out.checkpointVerification
    assert(check.independentCpuReconstruction&&check.deviceRngBytesVerified)
    assert.deepEqual(check.stateDigest,out.stateDigest);assert(same(check.checkpoint,out.checkpoint))
    if(n===24||n===48){assert.equal(out.validation.epoch,n/2);assert.equal(out.validation.rows.length,8);assert(same(out.validation.checkpoint,out.checkpoint))}
    else assert.equal(out.validation,null)
  }
  return {dir,ticket,out,outRef:ref(outPath)}
}
function nativeProof(a,n,withCheckpoint=true){
  const {dir,ticket,out,outRef}=validateResult(a,n,withCheckpoint),owned=json(dir+'/ownership.json'),r=owned.receipt,p=r?.proof
  assert(owned.ok&&r.ownerClosed&&r.guardReleaseConfirmed&&r.liveOwnerCleanupConfirmed&&r.cleanupConfirmed&&p.killOnJobClose&&p.assignedBeforeResume)
  assert.equal(p.exitCode,0);assert.equal(p.activeProcessesAfterCleanup,0);assert.equal(p.rootPid,out.workerPid);assert.equal(p.ownerPid,r.ownerIdentity.pid)
  assert.equal(r.guard.state,'released_after_confirmed_cleanup')
  const cleanup=globalGuard+'/'+r.guard.identity+'-native/cleanup-observation.json',raw=json(cleanup)
  assert.equal(raw.bindingBase64,p.bindingBase64);assert.equal(raw.rootPid,p.rootPid);assert.equal(raw.activeProcessesAfterCleanup,0)
  const native=JSON.parse(Buffer.from(raw.bindingBase64,'base64'));assert.equal(native.guard.runnerPid,ticket.ownerRunnerPid)
  const args=['-I','-B',path.join(ROOT,paths.worker),a.cpu?'--cpu-segment':'--segment',String(n)]
  assert.equal(native.guard.commandSha256,createHash('sha256').update(JSON.stringify(args)).digest('hex'))
  assert.equal(native.guard.executableSha256,a.s.interpreter.sha256)
  const prev=n>1?ref(seal(a,n-1)):null
  assert.equal(ticket.previous?.receipt?.sha256??null,prev?.sha256??null)
  if(prev){assert(same(ticket.previous.checkpoint,json(prev.path).checkpoint)&&same(ticket.previous.receipt,prev))}
  else assert.equal(ticket.previous,null)
  return {schema:'native-stage0-durable-segment-v1',mode:a.phase,runId:name,segment:n,endPair:n*24,result:outRef,checkpoint:out.checkpoint,
    ownership:ref(dir+'/ownership.json'),ticket:ref(dir+'/ticket.json'),workerPid:out.workerPid,guardIdentity:r.guard.identity,
    nativeCleanup:ref(cleanup),stateDigest:out.stateDigest,previousSealSha256:prev?.sha256??null}
}
function validateCpuReceipt(service){
  const a=settings(true)
  a.s=service;a.base=json(verified(inputRef).path)
  const final=json(a.run+'/terminal.json')
  assert.equal(final.status,'cpu_rehearsal_completed');assert.equal(final.sealedSegments,2)
  for(let n=1;n<=2;n++){const s=json(seal(a,n));assert.deepEqual(s,nativeProof(a,n,n===2))}
}
function events(a,id,body){
  mkdir(a.run+'/events');const file=a.run+'/events/'+id+'.json'
  if(!exists(file))save(file,{runId:name,phase:a.phase,atUtc:iso(),eventId:id,...body})
  if(!a.cpu){
    const event=json(file),r=ref(file)
    try{ensureAiPainterProgramEventCommitted({id:'native-formal-229-'+id,timestamp:event.atUtc,runId:name,kind:'native_stage0_formal_training',
      action:'native_stage0_formal_'+id,status:event.status??'recorded',title:'Native Stage0 '+id,titleZh:'原生256正式训练 '+id,
      detailZh:body.receipt?'本段已封存 '+body.endPair+' 对累计更新。':'读取原始运行记录查看实际时点与阶段。',
      evidencePath:r.path,evidenceSha256:r.sha256})}
    catch(error){
      const failure=a.run+'/events/projection-'+id+'.json'
      if(!exists(failure))save(failure,{stage:'platform_projection',reason:error.message.slice(0,1024),source:r,atUtc:iso()})
    }
  }
}
function census(a){
  const root=a.run+'/segments';if(!exists(root))return []
  const ns=fs.readdirSync(safe(root)).map(v=>{assert(/^\d\d$/.test(v),'invalid segment folder');return Number(v)}).sort((x,y)=>x-y)
  assert(ns.length<=a.maximum)
  for(const [i,n] of ns.entries()){assert.equal(n,i+1,'gap in reserved segment sequence');if(i<ns.length-1)assert(exists(seal(a,n)),'segment started before preceding commit')}
  return ns
}
function terminal(a,status,reason){
  const file=a.run+'/terminal.json';if(exists(file))return json(file)
  const ns=census(a),all=ns.filter(n=>exists(seal(a,n))),last=all.at(-1),end=last?json(seal(a,last)):null
  const value={runId:name,phase:a.phase,status,reason,atUtc:iso(),reservedSegments:ns.length,sealedSegments:all.length,
    sealedPairs:a.cpu?0:24*all.length,rehearsalPositions:a.cpu?24*all.length:null,unconfirmedSegment:ns.at(-1)!==last?ns.at(-1):null,lastSealed:end?ref(seal(a,last)):null,
    mostRecentSealedCheckpoint:end?.checkpoint??null,actualOutputBytesBeforeTerminal:usage(a.run),stageAdvanceAllowed:false,worldEntryAllowed:false}
  save(file,value);events(a,'terminal',{status,source:ref(file)});return value
}
function reclaim(a,n){
  if(n===1)return
  const current=json(seal(a,n)),old=json(seal(a,n-1));verified(current.checkpoint,segment(a,n)+'/recovery.pt')
  const exact=segment(a,n-1)+'/recovery.pt';assert.equal(old.checkpoint.path,exact)
  const dir=segment(a,n-1),intent=dir+'/reap-intent.json',done=dir+'/reaped.json',value={old:old.checkpoint,replacement:current.checkpoint,committed:ref(seal(a,n))}
  if(exists(done)){assert.deepEqual(json(done),value);assert(!exists(exact));return}
  if(exists(intent))assert.deepEqual(json(intent),value)
  else{verified(old.checkpoint,exact);save(intent,value)}
  if(exists(exact)){
    verified(old.checkpoint,exact);const p=safe(exact)
    assert.equal(path.dirname(p),safe(dir));assert.equal(path.basename(p),'recovery.pt');fs.unlinkSync(p)
  }
  save(done,value)
}
async function review(a,n){
  if(a.cpu||![24,48].includes(n))return null
  const epoch=n/2,file=a.run+'/review/epoch-'+epoch+'.json'
  assert(usage(a.run)+256*1024<=128*MiB,'missing bounded review space')
  const {readNativeStage0FormalReview}=await import(pathToFileURL(safe(paths.reviewer)).href)
  const elapsed=performance.now(),verdict=await readNativeStage0FormalReview(epoch,{root:ROOT})
  assert(performance.now()-elapsed<120000&&Date.now()<Date.parse(json(a.run+'/opening.json').runDeadlineUtc),'review deadline')
  assert.equal(verdict.runId,name);assert.equal(verdict.epoch,epoch);assert.equal(verdict.stageAdvanceAllowed,false);assert.equal(verdict.worldEntryAllowed,false)
  assert.equal(typeof verdict.qualityPassed,'boolean')
  if(n===24){assert.equal(verdict.checkpointEligibleForSelection,false);assert.equal(verdict.trainingMayContinue,true)}
  mkdir(a.run+'/review')
  if(exists(file)){
    const prior=json(file)
    for(const k of ['runId','epoch','status','qualityPassed','checkpointEligibleForSelection','stageAdvanceAllowed','worldEntryAllowed','segmentSeal','workerResult']){
      assert.deepEqual(prior[k],verdict[k],'review binding changed '+k)
    }
    const receipt=a.run+'/review/receipt-'+epoch+'.json'
    if(exists(receipt))assert(same(json(receipt).report,ref(file)),'stored review bytes changed')
    else assert.deepEqual(prior,verdict,'uncommitted review differs')
  }else save(file,verdict)
  save(a.run+'/review/receipt-'+epoch+'.json',{report:ref(file),seal:ref(seal(a,n)),checkpoint:json(seal(a,n)).checkpoint})
  events(a,'review-'+epoch,{review:ref(file),qualityPassed:verdict.qualityPassed})
  return verdict
}
function verifyFinalReadback(a){
  const d=segment(a,48),s=json(seal(a,48)),record=json(s.result.path),o=json(d+'/final-readback-ownership.json'),p=o.receipt?.proof
  const t=json(d+'/final-readback-ticket.json'),out=json(d+'/final-readback-result.json')
  assert(t.phase==='verify_final'&&t.segment===48&&t.startPair===1152&&t.endPair===1152&&t.runId===name&&t.policySha256===a.p.sha256)
  assert(same(t.previous.receipt,ref(seal(a,48)))&&same(t.previous.checkpoint,s.checkpoint));verified(s.checkpoint)
  assert(o.ok&&o.receipt.ownerClosed&&o.receipt.guardReleaseConfirmed&&o.receipt.cleanupConfirmed&&o.receipt.liveOwnerCleanupConfirmed&&p.assignedBeforeResume&&p.killOnJobClose)
  assert.equal(p.exitCode,0);assert.equal(p.activeProcessesAfterCleanup,0);assert.equal(p.rootPid,out.workerPid);assert.notEqual(out.workerPid,s.workerPid)
  const raw=json(globalGuard+'/'+o.receipt.guard.identity+'-native/cleanup-observation.json')
  assert.equal(raw.bindingBase64,p.bindingBase64);assert.equal(raw.rootPid,p.rootPid);assert.equal(raw.activeProcessesAfterCleanup,0)
  const native=JSON.parse(Buffer.from(raw.bindingBase64,'base64')),args=['-I','-B',path.join(ROOT,paths.worker),'--verify-final','48']
  assert.equal(native.guard.commandSha256,createHash('sha256').update(JSON.stringify(args)).digest('hex'));assert.equal(native.guard.runnerPid,t.ownerRunnerPid)
  assert.equal(native.guard.executableSha256,a.s.interpreter.sha256)
  assert.equal(out.schema,'native-stage0-formal-final-readback-v1');assert.equal(out.phase,'verify_final');assert.equal(out.runId,name)
  assert.equal(out.policySha256,a.p.sha256);assert(same(out.ticket,ref(d+'/final-readback-ticket.json')))
  assert(same(out.checkpoint,s.checkpoint));assert.deepEqual(out.stateDigest,s.stateDigest);assert.equal(out.optimizerUpdates,0)
  assert.deepEqual(out.counts,{generator:1152,discriminator:1152});assert.deepEqual(out.modelForwards,{G:8,D:0});assert.equal(out.rows.length,8)
  for(const [i,row] of out.rows.entries()){
    const v=record.validation.rows[i];assert.equal(row.sampleId,v.sampleId);assert(same(row.originalValidationImage,v.image))
    verified(v.image);assert.equal(row.actualPngSha256,v.image.sha256);assert.equal(row.expectedRawRgbSha256,v.rawRgbSha256);assert.equal(row.actualRawRgbSha256,v.rawRgbSha256)
  }
  return {runId:name,phase:'verify_final',segment:48,checkpoint:s.checkpoint,result:ref(d+'/final-readback-result.json'),
    ownership:ref(d+'/final-readback-ownership.json'),workerPid:p.rootPid,counts:out.counts,modelForwards:out.modelForwards,optimizerUpdates:0}
}
async function finalReadback(a){
  const cfg=json(a.policy);assert.deepEqual(cfg.finalReadback,finalLimits)
  const d=segment(a,48),ticket=d+'/final-readback-ticket.json',owner=d+'/final-readback-ownership.json'
  if(!exists(ticket)){
    assert(!exists(globalGuard+'/active.json'),'final verifier Job unavailable')
    const s=json(seal(a,48));repeat(a);resource(a,true)
    const now=Date.now(),overall=json(a.run+'/opening.json').runDeadlineUtc,deadline=Math.min(now+120000,Date.parse(overall))
    assert(deadline-now>=1000,'insufficient existing total budget for final readback')
    save(ticket,{runId:name,phase:'verify_final',segment:48,startPair:1152,endPair:1152,ownerRunnerPid:process.pid,policySha256:a.p.sha256,
      issuedAtUtc:new Date(now).toISOString(),segmentDeadlineUtc:new Date(deadline).toISOString(),runDeadlineUtc:overall,previous:{receipt:ref(seal(a,48)),checkpoint:s.checkpoint}})
    let last=0
    try{
      const env={...process.env,CUDA_VISIBLE_DEVICES:gpuId,PYTORCH_ALLOC_CONF:'max_split_size_mb:128',PYTHONDONTWRITEBYTECODE:'1',
        MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',OMP_NUM_THREADS:'2'};delete env.PYTORCH_CUDA_ALLOC_CONF
      const v=await runOwnedWorker(a.s.interpreter.path,['-I','-B',path.join(ROOT,paths.worker),'--verify-final','48'],{
        cwd:ROOT,env,timeout:deadline-Date.now(),maxBuffer:8*MiB,abortReason:()=>{
          if(Date.now()>=deadline||exists(a.run+'/stop.json'))return 'stop/deadline during independent final readback'
          if(Date.now()-last>=2000){last=Date.now();try{resource(a,false)}catch(error){return error.message}}
          return null
        }})
      save(owner,{ok:true,receipt:v.ownedReceipt,stdout:v.stdout,stderr:v.stderr})
    }catch(error){if(!exists(owner))save(owner,{ok:false,error:error.message,receipt:error.ownedReceipt??null,stderr:error.stderr??null});throw error}
  }
  // A consumed readback ticket without genuine terminal evidence may not consume another forward.
  const proof=verifyFinalReadback(a);save(d+'/final-readback-seal.json',proof)
  events(a,'independent-final-readback',{result:proof.result,checkpoint:proof.checkpoint})
}
async function finish(a,n){
  const sf=seal(a,n)
  if(exists(sf))assert.deepEqual(json(sf),nativeProof(a,n))
  else save(sf,nativeProof(a,n))
  events(a,'committed-'+two(n),{segment:n,endPair:n*24,receipt:ref(sf)})
  if(!a.cpu&&n===48)await finalReadback(a)
  await review(a,n)
  reclaim(a,n)
}
function actualEnd(a){
  if(a.cpu)return terminal(a,'cpu_rehearsal_completed','two real CPU Jobs, no model updates')
  const verdict=json(a.run+'/review/epoch-24.json')
  return terminal(a,verdict.qualityPassed?'training_completed_fixed_review_passed':'training_completed_fixed_review_failed',
    {review:ref(a.run+'/review/epoch-24.json'),qualityPassed:verdict.qualityPassed,checkpointEligibleForSelection:verdict.checkpointEligibleForSelection})
}
async function runOne(a,n,opening){
  const dir=segment(a,n),now=Date.now(),deadline=Math.min(now+a.segmentSeconds*1000,Date.parse(opening.runDeadlineUtc))
  assert(deadline-now>=1000,'run budget elapsed')
  assert(!exists(globalGuard+'/active.json'),'original Job unavailable')
  const initial=resource(a,true,true);repeat(a)
  let previous=null
  if(n>1){
    const latest=json(seal(a,n-1));verified(latest.checkpoint,segment(a,n-1)+'/recovery.pt')
    previous={receipt:ref(seal(a,n-1)),checkpoint:latest.checkpoint}
  }
  fs.mkdirSync(safe(dir))
  const t={runId:name,phase:a.phase,segment:n,startPair:(n-1)*24,endPair:n*24,policySha256:policyHash(a),ownerRunnerPid:process.pid,
    issuedAtUtc:new Date(now).toISOString(),segmentDeadlineUtc:new Date(deadline).toISOString(),runDeadlineUtc:opening.runDeadlineUtc,previous}
  const ticket=save(dir+'/ticket.json',t)
  events(a,'start-'+two(n),{ticket,initial,segment:n,startPair:t.startPair})
  const env={...process.env,PYTHONDONTWRITEBYTECODE:'1',CUDA_VISIBLE_DEVICES:a.cpu?'':gpuId,PYTORCH_ALLOC_CONF:'max_split_size_mb:128',
    OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'};delete env.PYTORCH_CUDA_ALLOC_CONF
  let last=0,peak=initial
  const stop=()=>{
    if(Date.now()>=deadline)return 'segment deadline'
    if(exists(a.run+'/stop.json'))return 'registered stop'
    if(Date.now()-last>=2000){
      last=Date.now()
      try{
        const sample=resource(a,false)
        peak={bytes:Math.max(peak.bytes,sample.bytes),hostFreeBytes:Math.min(peak.hostFreeBytes,sample.hostFreeBytes),
          diskFreeBytes:Math.min(peak.diskFreeBytes,sample.diskFreeBytes),card:sample.card}
      }catch(error){return error.message}
    }
    return null
  }
  try{
    const timeout=Math.min(a.segmentSeconds*1000,deadline-Date.now());assert(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=840000)
    const result=await runOwnedWorker(a.s.interpreter.path,['-I','-B',path.join(ROOT,paths.worker),a.cpu?'--cpu-segment':'--segment',String(n)],
      {cwd:ROOT,timeout,maxBuffer:8*MiB,env,abortReason:stop})
    save(dir+'/ownership.json',{ok:true,timeoutMs:timeout,receipt:result.ownedReceipt,stdout:result.stdout,stderr:result.stderr,peak})
  }catch(error){
    if(!exists(dir+'/ownership.json'))save(dir+'/ownership.json',{ok:false,reason:error.message,code:error.code??null,
      stdout:error.stdout??'',stderr:error.stderr??'',receipt:error.ownedReceipt??null,peak})
    throw error
  }
  await finish(a,n)
}
function status(cpu){
  const a=settings(cpu),root=a.run,snapshotAtUtc=iso()
  if(!exists(root+'/opening.json'))return {runId:name,phase:a.phase,status:exists(root)?'initialization_incomplete':'not_started',
    currentEpoch:null,sealedPairs:0,startedAtUtc:null,elapsedSeconds:null,snapshotAtUtc,source:'local_native_stage0_service'}
  const open=json(root+'/opening.json'),ns=census(a),sealed=ns.filter(n=>exists(seal(a,n))),n=ns.at(-1),last=sealed.at(-1)
  if(sealed.length){
    a.p=verified(open.policy);a.s=json(a.p.path).service;a.base=json(verified(inputRef).path)
    for(const i of sealed)assert.deepEqual(json(seal(a,i)),nativeProof(a,i,false))
  }
  const host=priorHost(a),g=exists(globalGuard+'/active.json')?json(globalGuard+'/active.json'):null
  const own=host&&g?.runnerPid===host.pid?g:null
  const started=own&&exists(globalGuard+'/'+own.identity+'-started.json')?json(globalGuard+'/'+own.identity+'-started.json'):null
  const dir=n?segment(a,n):null,ticket=dir&&exists(dir+'/ticket.json')?json(dir+'/ticket.json'):null
  // Heartbeats may be atomically replaced while a consumer polls. Committed counts always come from seals.
  let heartbeat=null
  if(dir&&exists(dir+'/heartbeat.json')){try{heartbeat=json(dir+'/heartbeat.json')}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e}}
  const result=dir&&exists(dir+'/result.json')?json(dir+'/result.json'):null,term=exists(root+'/terminal.json')?json(root+'/terminal.json'):null
  const marked=dir&&exists(dir+'/worker-failure.json')?ref(dir+'/worker-failure.json'):null
  const checkpoint=last?json(seal(a,last)).checkpoint:null,validation=[]
  if(!cpu)for(const [index,epoch] of [[24,12],[48,24]])if(sealed.includes(index)){
    const f=segment(a,index)+'/result.json',v=json(f).validation,reviewFile=root+'/review/epoch-'+epoch+'.json'
    validation.push({epoch,eligibility:v.eligibility,rows:v.rows,source:ref(f),review:exists(reviewFile)?ref(reviewFile):null})
  }
  return {runId:name,phase:a.phase,status:term?.status??(exists(root+'/stop.json')?'stopping':host?.alive?'active':'host_not_running'),
    source:'local_native_stage0_service',snapshotAtUtc,sourceRunRoot:root,policy:open.policy,startedAtUtc:open.startedAtUtc,endedAtUtc:term?.atUtc??null,
    elapsedSeconds:Math.max(0,(Date.parse(term?.atUtc??snapshotAtUtc)-Date.parse(open.startedAtUtc))/1000),runDeadlineUtc:open.runDeadlineUtc,
    currentSegment:n??null,currentEpoch:n?Math.ceil(n/2):null,sealedSegments:sealed.length,sealedPairs:cpu?0:sealed.length*24,
    rehearsalPositions:cpu?sealed.length*24:null,counts:{generator:cpu?0:sealed.length*24,discriminator:cpu?0:sealed.length*24},
    host,worker:{pid:heartbeat?.pid??result?.workerPid??null,nativeOwnerPid:started?.ownerIdentity?.pid??null,guardIdentity:own?.identity??null,
      currentlyOwned:own!==null,heartbeat,committed:false},lastSegmentTicket:ticket,latestCheckpoint:checkpoint?{...checkpoint,retained:exists(checkpoint.path)}:null,
    firstFailure:marked??(term?.status==='failed_closed'?ref(root+'/terminal.json'):null),terminal:term,validation,
    stageAdvanceAllowed:false,worldEntryAllowed:false}
}
function launch(a){
  const o=exists(a.run+'/opening.json')?json(a.run+'/opening.json'):null
  if(!o){
    const g=ref(a.grant),grant=json(a.grant)
    assert.equal(grant.mode,a.cpu?'cpu_stage0_service_rehearsal':'formal_stage0_single_attempt')
    assert.equal(grant.runId,name);assert.equal(grant.policySha256,a.p.sha256)
    const now=Date.now(),end=Date.parse(grant.startBeforeUtc);assert(end>now&&end<=now+600000,'expired or unbounded first launch')
    assert(!exists(globalGuard+'/active.json'),'native Job is busy at admission')
    mkdir(path.posix.dirname(a.run));fs.mkdirSync(safe(a.run))
    // The durable run root owns one cumulative deadline independent of host activations.
    save(a.run+'/opening.json',{runId:name,phase:a.phase,grant:g,policy:a.p,startedAtUtc:new Date(now).toISOString(),
      runDeadlineUtc:new Date(now+a.totalSeconds*1000).toISOString(),maximumSegments:a.maximum,automaticRetries:0})
    mkdir(a.run+'/segments');mkdir(a.run+'/activations');events(a,'accepted',{policy:a.p})
  }else{assert(same(o.policy,a.p));if(exists(a.run+'/terminal.json'))return status(a.cpu)}
  const current=priorHost(a);if(current?.alive||current?.alive===null)return status(a.cpu)
  if(exists(a.run+'/stop.json'))return terminal(a,'stopped','persistent stop request')
  if(Date.now()>=Date.parse(json(a.run+'/opening.json').runDeadlineUtc))return terminal(a,'failed_closed','absolute run deadline reached')
  const n=(current?.n??0)+1,opt=activation(a,n)
  const dir=a.run+'/activations/claim-'+n
  fs.mkdirSync(safe(dir))
  save(hostFile(a,n),{activation:n,launcherPid:process.pid,launcherCreationUtc:activePid(process.pid),atUtc:iso(),policy:a.p,previous:current??null})
  const receipt=launchProjectCommandBackground(opt);validateProjectCommandBackgroundReceipt({...opt,receipt})
  return {runId:name,phase:a.phase,status:'detached_host_started',activation:n,hostPid:receipt.processId,receipt:ref(receiptPath(opt)),runRoot:a.run}
}
async function serve(a,n){
  const parent=await verifyOwnHost(a,n),opening=json(a.run+'/opening.json')
  assert(same(opening.policy,a.p));events(a,'host-'+n,{parent})
  try{
    for(;;){
      if(exists(a.run+'/terminal.json'))return json(a.run+'/terminal.json')
      if(exists(a.run+'/stop.json'))return terminal(a,'stopped','persistent stop request')
      assert(Date.now()<Date.parse(opening.runDeadlineUtc),'absolute nine-hour run deadline reached')
      const ns=census(a),last=ns.at(-1)
      if(last){
        // A worker may have returned before a prior host could seal/review/reap its
        // checkpoint. Only genuine completion receipts can finish that transaction.
        assert(exists(segment(a,last)+'/ownership.json'),'reserved segment has no proven completed Job; no rerun')
        await finish(a,last)
      }
      if(last===a.maximum)return actualEnd(a)
      await runOne(a,(last??0)+1,opening)
    }
  }catch(error){
    const stopped=exists(a.run+'/stop.json')
    terminal(a,stopped?'stopped':'failed_closed',String(error.message).slice(0,4096))
    throw error
  }
}
export async function nativeStage0ServiceCommand(action='--status',...args){
  const commands=new Set(['--status','--start','--resume','--stop','--serve','--preflight',
    '--cpu-status','--cpu-start','--cpu-resume','--cpu-stop','--cpu-serve','--cpu-preflight'])
  assert(commands.has(action),'fixed native Stage0 command required');const cpu=action.startsWith('--cpu-'),route=action.replace('--cpu-','--')
  if(route==='--status'){assert.equal(args.length,0);return status(cpu)}
  if(route==='--stop'){
    assert.equal(args.length,0);const a=settings(cpu)
    if(!exists(a.run+'/opening.json')||exists(a.run+'/terminal.json'))return status(cpu)
    const dest=a.run+'/stop.json';if(!exists(dest))save(dest,{runId:name,phase:a.phase,requestedAtUtc:iso(),requestedBy:'local_service_operator'})
    const active=priorHost(a);if(!active?.alive)return terminal(a,'stopped','persistent stop request, original host no longer live')
    return status(cpu)
  }
  const a=configure(cpu)
  if(route==='--serve'){assert(args.length===1&&/^[1-9][0-9]*$/.test(args[0]));return serve(a,Number(args[0]))}
  assert.equal(args.length,0)
  if(route==='--preflight')return {runId:name,mode:a.phase,policy:a.p,sourceCases:a.base.historicalTrainOrder.length,optimizerUpdates:0,plannedSegments:a.maximum,limits:a.s.resourceLimits}
  if(route==='--resume')assert(exists(a.run+'/opening.json'),'missing original run to resume')
  return launch(a)
}
