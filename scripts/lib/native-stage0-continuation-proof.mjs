// This adapter is read-only. Its seal has the wire shape consumed by the original worker.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {ROOT,safe,read} from './world-initialized-evolution.mjs'

const runId='stage0-native-256-formal-229',runRoot='.runtime/ai-painter/native-stage0-formal-training/'+runId
const policyPath='data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json'
const worker='ml/ai-painter/scripts/native_stage0_formal_worker.py'
const original=Object.freeze({
  policy:'3f00ea5bb99997ddbdd4f051b424bd9177b1305591504874394370be461887e1',
  opening:'dd63aa4efbe7e54116a8f443943e9794a71fa4952757c9b7bbc72af19b17de27',
  terminal:'3cb0712c1da6921fe6c5d370445679f8895328d51f096ecaa49de19ce3888fa1',
  checkpoint13:'82c930dd25042493fae7a085e8c60c2571734ee520e40b1ab9e760983a219ee0',
  seal13:'7b5cddcc542d78479f9e2f32d2c226399d4cb64427724853a66eaba6468b2423',
})
const MiB=1024**2,hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const digest=b=>createHash('sha256').update(b).digest('hex')
const same=assert.deepEqual
const dir=n=>runRoot+'/segments/'+String(n).padStart(2,'0')
const exists=p=>fs.existsSync(safe(p))
const counts=n=>({generator:n,discriminator:n})
const topology=['adamw','counts','cudaRng','history','modes','networks','rng']

function ref(p){
  const fd=fs.openSync(safe(p),'r')
  try{
    const first=fs.fstatSync(fd),h=createHash('sha256')
    assert(first.isFile()&&first.nlink===1&&first.size>0&&first.size<=128*MiB,'invalid bound file '+p)
    const buf=Buffer.allocUnsafe(Math.min(256*1024,first.size))
    let bytes=0,n
    while((n=fs.readSync(fd,buf,0,buf.length,null))>0){bytes+=n;h.update(buf.subarray(0,n))}
    const last=fs.fstatSync(fd)
    assert.equal(bytes,first.size);assert.equal(first.ino,last.ino);assert.equal(first.mtimeMs,last.mtimeMs)
    return {path:p,bytes,sha256:h.digest('hex')}
  }finally{fs.closeSync(fd)}
}
function check(binding,expected=binding.path){
  assert.equal(binding.path,expected);const actual=ref(expected)
  assert.equal(binding.sha256,actual.sha256,'file digest '+expected)
  if(binding.bytes!==undefined)assert.equal(binding.bytes,actual.bytes,'file bytes '+expected)
  return actual
}
// Parse only the very bytes hashed for the returned binding.
function record(p,expected){
  const b=read(p,4*MiB),binding={path:p,bytes:b.length,sha256:digest(b)}
  if(expected)assert.equal(binding.sha256,expected,'record digest '+p)
  return {value:JSON.parse(b),binding}
}
function config(){
  const {value:policy,binding}=record(policyPath,original.policy)
  const {value:opening}=record(runRoot+'/opening.json',original.opening)
  const {value:terminal}=record(runRoot+'/terminal.json',original.terminal)
  assert.equal(terminal.status,'failed_closed');same([terminal.reservedSegments,terminal.sealedSegments,terminal.sealedPairs,terminal.unconfirmedSegment],[13,13,312,null])
  same(opening.policy,binding);assert.equal(opening.runId,runId);assert.equal(opening.automaticRetries,0)
  assert.equal(Date.parse(opening.runDeadlineUtc)-Date.parse(opening.startedAtUtc),32400000);check(opening.grant)
  const s=policy.service
  assert.equal(s.worker.path,worker);assert.equal(s.realRunRoot,runRoot)
  assert.equal(s.interpreter.path.toLowerCase(),'d:\\devcaches\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe')
  assert.equal(digest(fs.readFileSync(s.interpreter.path)),s.interpreter.sha256)
  const checked=new Map()
  for(const r of [s.worker,s.entry,s.host,s.reviewer,s.cpuQualification,policy.sourceRelease,policy.qualification,policy.optimizerQualification,...s.sourceBindings,...policy.programs]){
    if(checked.has(r.path))same(checked.get(r.path),r)
    else{check(r);checked.set(r.path,r)}
  }
  const checkpoint13=check(terminal.mostRecentSealedCheckpoint,dir(13)+'/recovery.pt')
  assert.equal(checkpoint13.sha256,original.checkpoint13)
  const seal13=check(terminal.lastSealed,dir(13)+'/seal.json');assert.equal(seal13.sha256,original.seal13)
  const train=record(policy.trainMembership.path,policy.trainMembership.sha256).value,validation=record(policy.validationMembership.path,policy.validationMembership.sha256).value
  assert.equal(train.split,'train');assert.equal(validation.split,'validation');assert.equal(new Set(train.sampleIds).size,48)
  return {opening,terminal,policy:binding,settings:policy,checkpoint13,seal13,train:train.sampleIds,validation:validation.sampleIds}
}
function job(n,operation,ownership,ticket,result,ctx){
  const r=ownership.receipt,p=r.proof
  assert(ownership.ok&&r.ownerClosed&&r.guardReleaseConfirmed&&r.cleanupConfirmed&&r.liveOwnerCleanupConfirmed&&p.assignedBeforeResume&&p.killOnJobClose)
  assert.equal(r.guard.state,'released_after_confirmed_cleanup');assert.equal(p.exitCode,0);assert.equal(p.activeProcessesAfterCleanup,0)
  assert.equal(p.rootPid,result.workerPid);assert.equal(p.ownerPid,r.ownerIdentity.pid)
  assert(/^[0-9a-f-]{36}$/.test(r.guard.identity))
  const {value:cleanup,binding}=record('.runtime/ai-painter/owned-worker-guards/'+r.guard.identity+'-native/cleanup-observation.json')
  assert.equal(cleanup.activeProcessesAfterCleanup,0);assert.equal(cleanup.rootPid,result.workerPid);assert.equal(cleanup.bindingBase64,p.bindingBase64)
  const native=JSON.parse(Buffer.from(cleanup.bindingBase64,'base64'));assert.equal(native.guard.runnerPid,ticket.ownerRunnerPid)
  assert.equal(native.guard.executableSha256,ctx.settings.service.interpreter.sha256)
  const args=['-I','-B',path.join(ROOT,worker),operation,String(n)]
  assert.equal(native.guard.commandSha256,digest(JSON.stringify(args)))
  return {guardIdentity:r.guard.identity,nativeCleanup:binding}
}
function checkedTimes(ticket,opening,maxSec){
  const issued=Date.parse(ticket.issuedAtUtc),deadline=Date.parse(ticket.segmentDeadlineUtc)
  assert.equal(ticket.runDeadlineUtc,opening.runDeadlineUtc);assert(Number.isFinite(issued)&&issued>=Date.parse(opening.startedAtUtc)&&deadline>issued)
  assert(deadline<=Date.parse(opening.runDeadlineUtc)&&deadline-issued<=maxSec*1000)
}
function sealFor(ctx,n,checkBytes){
  const d=dir(n),ticket=record(d+'/ticket.json'),out=record(d+'/result.json'),owned=record(d+'/ownership.json')
  const t=ticket.value,v=out.value,start=(n-1)*24,end=n*24
  assert.equal(t.runId,runId);assert.equal(t.phase,'train');assert.equal(t.policySha256,ctx.policy.sha256)
  same([t.segment,t.startPair,t.endPair],[n,start,end]);checkedTimes(t,ctx.opening,840)
  assert.equal(v.schema,'native-stage0-formal-segment-result-v1');assert.equal(v.phase,'train');assert.equal(v.runId,runId);assert.equal(v.policySha256,ctx.policy.sha256)
  same([v.segment,v.startPair,v.endPair],[n,start,end]);same(v.ticket,ticket.binding);same(v.counts,counts(end))
  assert.equal(v.checkpoint.path,d+'/recovery.pt');assert(hex(v.checkpoint.sha256)&&Number.isInteger(v.checkpoint.bytes)&&v.checkpoint.bytes>0&&v.checkpoint.bytes<=32*MiB)
  if(checkBytes)check(v.checkpoint)
  same(Object.keys(v.stateDigest).sort(),topology);assert(Object.values(v.stateDigest).every(hex))
  const rebuilt=v.checkpointVerification
  assert(rebuilt.independentCpuReconstruction&&rebuilt.deviceRngBytesVerified);same(rebuilt.stateDigest,v.stateDigest);same(rebuilt.checkpoint,v.checkpoint)
  let previousSealSha256=null,lastHistory=digest('native-stage0-original-order-v1')
  if(n===1)assert.equal(t.previous,null)
  else{
    const prev=record(dir(n-1)+'/seal.json'),proof=record(d+'/restore-proof.json').value
    previousSealSha256=prev.binding.sha256
    same(t.previous,{receipt:prev.binding,checkpoint:prev.value.checkpoint});same(proof.receipt,prev.binding);same(proof.checkpoint,prev.value.checkpoint)
    same(proof.stateDigest,prev.value.stateDigest);same(proof.counts,counts(start));assert.equal(proof.segment,n);assert.equal(proof.runId,runId);assert.equal(proof.workerPid,v.workerPid)
    lastHistory=record(prev.value.result.path,prev.value.result.sha256).value.historySha256
  }
  const pairs=read(d+'/pairs.jsonl',2*MiB).toString().trimEnd().split(/\r?\n/).map(s=>JSON.parse(s))
  same(pairs,v.trainingRows);assert.equal(pairs.length,24)
  const seen=new Set()
  for(const [i,p] of pairs.entries()){
    const j=start+i,pos=p.position
    same([pos.epoch,pos.zeroBasedEpochPosition],[Math.floor(j/48)+1,j%48]);assert.equal(ctx.train[pos.trainIndex],pos.sampleId)
    assert(!seen.has(pos.sampleId));seen.add(pos.sampleId)
    same(p.counts,counts(j+1));same(p.ledger,{generator:1,discriminator:1,sampleId:pos.sampleId})
    assert(Number.isFinite(p.generatorLoss)&&Number.isFinite(p.discriminatorLoss))
    lastHistory=digest(Buffer.concat([Buffer.from(lastHistory,'hex'),Buffer.from(JSON.stringify(pos,Object.keys(pos).sort()))]))
    assert.equal(p.historySha256,lastHistory)
  }
  assert.equal(lastHistory,v.historySha256);assert.equal(v.stateDigest.history,digest(JSON.stringify(lastHistory)))
  if(n%2===0){
    const prev=record(dir(n-1)+'/result.json').value.trainingRows.map(p=>p.position.sampleId)
    same([...prev,...seen].sort(),[...ctx.train].sort())
  }
  if(n===24||n===48){
    const a=v.validation
    same(a.rows.map(x=>x.sampleId),ctx.validation);assert.equal(a.epoch,n/2);assert.equal(a.eligibility,n===24?'observation_only':'sole_selection_candidate')
    same(a.checkpoint,v.checkpoint)
    a.rows.forEach((row,i)=>{check(row.image,d+'/validation-'+String(i).padStart(2,'0')+'.png');assert(hex(row.rawRgbSha256))})
  }else assert.equal(v.validation,null)
  const native=job(n,'--segment',owned.value,t,v,ctx)
  return {schema:'native-stage0-durable-segment-v1',mode:'train',runId,segment:n,endPair:end,result:out.binding,checkpoint:v.checkpoint,
    ownership:owned.binding,ticket:ticket.binding,workerPid:v.workerPid,...native,stateDigest:v.stateDigest,previousSealSha256}
}
function reapData(n){
  const prev=record(dir(n-1)+'/seal.json'),current=record(dir(n)+'/seal.json')
  assert.equal(current.value.previousSealSha256,prev.binding.sha256)
  assert.equal(prev.value.checkpoint.path,dir(n-1)+'/recovery.pt');assert.equal(current.value.checkpoint.path,dir(n)+'/recovery.pt')
  return {old:prev.value.checkpoint,replacement:current.value.checkpoint,committed:current.binding}
}
function reaping(n,required){
  const d=dir(n-1),data=reapData(n),intent=d+'/reap-intent.json',done=d+'/reaped.json'
  const hasIntent=exists(intent),hasDone=exists(done),oldExists=exists(data.old.path)
  if(hasIntent)same(record(intent).value,data)
  if(hasDone){assert(hasIntent);same(record(done).value,data);assert(!oldExists)}
  else{assert(!required);assert(oldExists||hasIntent);if(oldExists)check(data.old)}
  return data
}
export function verifyNativeContinuationBoundary(){
  const ctx=config()
  const dirs=fs.readdirSync(safe(runRoot+'/segments'),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))
  assert(dirs.length>=13&&dirs.length<=48)
  let latest=null,reservedSegment=null
  for(const [i,d] of dirs.entries()){
    const n=i+1
    assert(d.isDirectory()&&!d.isSymbolicLink());assert.equal(d.name,String(n).padStart(2,'0'))
    const p=dir(n)+'/seal.json'
    if(!exists(p)){assert.equal(n,dirs.length);assert(n>=14);reservedSegment=n;break}
    const sealed=record(p)
    same(sealed.value,sealFor(ctx,n,n===13||n===dirs.length||!exists(dir(n+1)+'/seal.json')))
    if(n<=13)same(record(runRoot+'/events/committed-'+d.name+'.json').value.receipt,sealed.binding)
    if(n>1&&n!==14)reaping(n,n<=13)
    latest=sealed
  }
  assert(latest);assert(!exists(dir(13)+'/reap-intent.json')&&!exists(dir(13)+'/reaped.json'),'original terminal checkpoint protected')
  return {runId,runRoot,opening:ctx.opening,policy:ctx.policy,terminal:ctx.terminal,checkpoint13:ctx.checkpoint13,seal13:ctx.seal13,
    deadlineUtc:ctx.opening.runDeadlineUtc,latestSeal:latest.binding,latestCheckpoint:latest.value.checkpoint,endPair:latest.value.endPair,
    nextSegment:latest.value.segment+1,reservedSegment}
}
export function buildNativeContinuationSeal(n){
  assert(Number.isInteger(n)&&n>=14&&n<=48)
  const boundary=verifyNativeContinuationBoundary()
  assert(boundary.reservedSegment===n||(boundary.reservedSegment===null&&boundary.nextSegment===n+1),'unconfirmed or wrong position')
  return sealFor(config(),n,true)
}
export function verifyNativeContinuationReap(n){
  assert(Number.isInteger(n)&&n>=14&&n<=48)
  const b=verifyNativeContinuationBoundary();assert.equal(b.nextSegment,n+1);assert.equal(b.reservedSegment,null)
  if(n===14)return null
  return reaping(n,false)
}
export function verifyNativeContinuationFinalReadback(){
  const b=verifyNativeContinuationBoundary();assert.equal(b.nextSegment,49);assert.equal(b.endPair,1152)
  const ctx=config(),d=dir(48),seal=record(d+'/seal.json'),out=record(d+'/final-readback-result.json'),ticket=record(d+'/final-readback-ticket.json'),owned=record(d+'/final-readback-ownership.json')
  const t=ticket.value,v=out.value,originalRows=record(seal.value.result.path,seal.value.result.sha256).value.validation.rows
  same([t.phase,t.segment,t.startPair,t.endPair,t.runId,t.policySha256],['verify_final',48,1152,1152,runId,ctx.policy.sha256])
  checkedTimes(t,ctx.opening,120);same(t.previous,{receipt:seal.binding,checkpoint:seal.value.checkpoint})
  assert.equal(v.schema,'native-stage0-formal-final-readback-v1');assert.equal(v.phase,'verify_final');assert.equal(v.runId,runId);assert.equal(v.segment,48);assert.equal(v.policySha256,ctx.policy.sha256)
  same(v.ticket,ticket.binding);same(v.checkpoint,b.latestCheckpoint);same(v.stateDigest,seal.value.stateDigest);same(v.counts,counts(1152))
  assert.equal(v.optimizerUpdates,0);same(v.modelForwards,{G:8,D:0});assert.notEqual(v.workerPid,seal.value.workerPid)
  job(48,'--verify-final',owned.value,t,v,ctx);assert.equal(v.rows.length,8)
  for(const [i,row] of v.rows.entries()){
    const orig=originalRows[i];assert.equal(row.sampleId,orig.sampleId);same(row.originalValidationImage,orig.image)
    assert.equal(row.expectedRawRgbSha256,orig.rawRgbSha256);assert.equal(row.actualRawRgbSha256,orig.rawRgbSha256);assert.equal(row.actualPngSha256,orig.image.sha256)
  }
  return {runId,phase:'verify_final',segment:48,checkpoint:v.checkpoint,result:out.binding,ownership:owned.binding,workerPid:v.workerPid,counts:v.counts,modelForwards:v.modelForwards,optimizerUpdates:0}
}
