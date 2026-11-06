import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {setTimeout as sleep} from 'node:timers/promises'
import {ROOT,safe} from './world-initialized-evolution.mjs'
import {launchProjectCommandBackground,validateProjectCommandBackgroundReceipt} from './ai-painter-autonomous-background-launcher-v1.mjs'
import {runOwnedWorker} from './ai-painter-owned-worker-v1.mjs'
import {readNativeStage0FormalReview} from './native-stage0-formal-review.mjs'
import {verifyNativeContinuationBoundary,buildNativeContinuationSeal,verifyNativeContinuationReap,verifyNativeContinuationFinalReadback} from './native-stage0-continuation-proof.mjs'
import {sampleContinuationResources,recordContinuationResourceSample} from './native-stage0-continuation-resources.mjs'

const runId='stage0-native-256-formal-229',dispatchId='resource-continuation-236'
const runRoot='.runtime/ai-painter/native-stage0-formal-training/'+runId,activationRoot=runRoot+'/continuations/'+dispatchId
const policyPath='data/ai-painter/system-governance/ai-painter-native-stage0-resource-continuation-v1.json'
const grantPath='.runtime/ai-painter/controller-repair-reviews/native-stage0-resource-continuation-236-20261103/controller/dispatch.json'
const entry='scripts/run-native-stage0-continuation.mjs',driver='scripts/lib/native-stage0-continuation-host.mjs'
const originalPolicy='data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json',guardPath='.runtime/ai-painter/owned-worker-guards/active.json'
const oldTerminal=runRoot+'/terminal.json',recordedDeadline='2026-11-03T08:09:02.105Z',MiB=1024**2
const ownerOptions={root:ROOT,launchIdentity:dispatchId,runnerPath:entry,runnerArgs:['--host'],receiptRoot:activationRoot+'/launches'}
const launchFile=ownerOptions.receiptRoot+'/'+dispatchId+'/launch-receipt.json'
const file=n=>activationRoot+'/'+n,seg=n=>runRoot+'/segments/'+String(n).padStart(2,'0'),exists=p=>fs.existsSync(safe(p))
const now=()=>new Date().toISOString(),hash=b=>createHash('sha256').update(b).digest('hex')
function raw(p,max=4*MiB){
  const fp=safe(p),s=fs.lstatSync(fp);assert(s.isFile()&&s.nlink===1&&!s.isSymbolicLink()&&s.size<=max,'invalid bounded file: '+p)
  const b=fs.readFileSync(fp),e=fs.lstatSync(fp);assert.equal(e.size,s.size);assert.equal(e.mtimeMs,s.mtimeMs);assert.equal(b.length,s.size);return b
}
const json=p=>JSON.parse(raw(p).toString('utf8').replace(/^\uFEFF/,''))
function ref(p){const b=raw(p,64*MiB);return {path:p,sha256:hash(b),bytes:b.length}}
function verify(b,p=b?.path){
  assert(b&&b.path===p&&/^[a-f0-9]{64}$/.test(b.sha256));const actual=ref(p);assert.equal(actual.sha256,b.sha256,'wrong immutable source '+p)
  if(b.bytes!==undefined)assert.equal(b.bytes,actual.bytes);return actual
}
function usage(p=runRoot){return fs.readdirSync(safe(p),{withFileTypes:true}).reduce((sum,x)=>{
  const target=p+'/'+x.name,s=fs.lstatSync(safe(target));assert(!s.isSymbolicLink());if(s.isDirectory())return sum+usage(target)
  assert(s.isFile()&&s.nlink===1);return sum+s.size},0)}
// Every destination has a single owner, selected before publication by an exclusive directory.
// A leftover pending file is evidence of uncertain transition and is never overwritten.
function save(p,body,terminal=false){
  assert(p.startsWith(runRoot+'/'));assert(!exists(p),'immutable output already exists: '+p)
  const b=Buffer.from(JSON.stringify(body,null,2)+'\n'),fp=safe(p)
  assert(usage()+b.length+(terminal?0:65536)<=128*MiB,'total retained bytes would exceed original budget')
  const tmp=fp+'.pending',fd=fs.openSync(tmp,'wx')
  try{fs.writeFileSync(fd,b);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  assert(!fs.existsSync(fp));fs.renameSync(tmp,fp);return ref(p)
}
function processCreation(pid){
  assert(Number.isSafeInteger(pid)&&pid>0)
  const cmd="$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+pid+"';if($p){$p.CreationDate.ToUniversalTime().ToString('o')}"
  try{return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{windowsHide:true,encoding:'utf8',timeout:5000,maxBuffer:4096}).trim()||false}catch{return null}
}
function hostProof(){
  if(!exists(launchFile))return {activePid:null,hostAlive:null,activeProof:null}
  const r=json(launchFile);validateProjectCommandBackgroundReceipt({...ownerOptions,receipt:r})
  const creation=processCreation(r.processId),verified=typeof creation==='string'&&creation===r.processCreationDateUtc
  return {activePid:verified?r.processId:null,hostAlive:creation===null?null:verified,
    activeProof:{pid:r.processId,creationUtc:r.processCreationDateUtc,launchReceipt:ref(launchFile),identityVerified:verified}}
}
function liveWorker(host,n){
  const missing={workerPid:null,nativeOwnerPid:null,guardIdentity:null}
  if(!host.hostAlive||!exists(guardPath))return missing
  const g=json(guardPath)
  if(g.runnerPid!==host.activePid||!/^[a-f0-9-]{36}$/.test(g.identity))return missing
  const startedPath='.runtime/ai-painter/owned-worker-guards/'+g.identity+'-started.json'
  if(!exists(startedPath))return missing
  const s=json(startedPath),owner=s.ownerIdentity
  if(s.identity!==g.identity||s.runnerPid!==g.runnerPid||s.commandSha256!==g.commandSha256||
     owner?.identitySource!=='retained_child_handle'||!Number.isSafeInteger(owner.pid)||owner.pid<=0)return missing
  const file=seg(n)+'/heartbeat.json'
  let beat=null;try{if(exists(file))beat=json(file)}catch{/* an atomic heartbeat update can race a UI read */}
  const known={workerPid:null,nativeOwnerPid:owner.pid,guardIdentity:g.identity}
  if(beat&&(beat.runId!==runId||beat.segment!==n))return known
  const cmd="$ErrorActionPreference='Stop';@(Get-CimInstance Win32_Process -Filter 'ParentProcessId="+owner.pid+"' | Select-Object ProcessId,ExecutablePath) | ConvertTo-Json -Compress"
  try{
    const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{windowsHide:true,encoding:'utf8',timeout:4000,maxBuffer:8192}).trim()
    if(!result)return known
    const arr=[JSON.parse(result)].flat()
    const found=arr.filter(p=>typeof p.ExecutablePath==='string'&&p.ExecutablePath.toLowerCase()===g.executable.toLowerCase())
    if(found.length===1&&(!beat||beat.workerPid===found[0].ProcessId))known.workerPid=found[0].ProcessId
  }catch{/* unknown remains distinct from an observed native child */}
  return known
}
function policy(){
  const body=json(policyPath),p=ref(policyPath)
  assert.equal(body.schemaVersion,'native-stage0-resource-continuation-v1');assert.equal(body.dispatchId,dispatchId);assert.equal(body.runId,runId)
  assert.equal(body.runRoot,runRoot);assert.equal(body.activationRoot,activationRoot);assert.equal(body.firstSegment,14);assert.equal(body.lastSegment,48)
  assert.equal(body.runDeadlineUtc,recordedDeadline);assert.equal(body.grantPath,grantPath)
  verify(body.entry,entry);verify(body.originalPolicy,originalPolicy);verify(body.opening,runRoot+'/opening.json');verify(body.oldTerminal,oldTerminal)
  verify(body.seal13,seg(13)+'/seal.json');verify(body.checkpoint13,seg(13)+'/recovery.pt')
  const expected=[entry,driver,'scripts/lib/native-stage0-continuation-proof.mjs','scripts/lib/native-stage0-continuation-resources.mjs']
  assert(Array.isArray(body.sources)&&expected.every(n=>body.sources.some(b=>b.path===n)),'required continuation sources absent')
  for(const b of body.sources)verify(b)
  const schema=json(originalPolicy);verify(schema.service.worker);verify(schema.service.reviewer);verify(schema.service.host)
  const opening=json(body.opening.path);assert.equal(opening.runDeadlineUtc,recordedDeadline);assert.equal(opening.policy.sha256,body.originalPolicy.sha256)
  return {body,p,opening,worker:schema.service.worker.path,interpreter:schema.service.interpreter.path}
}
function grant(p){
  const g=json(grantPath)
  assert.equal(g.dispatchId,dispatchId);assert.equal(g.runId,runId);assert.equal(g.mode,'formal_same_run_resource_continuation_once')
  assert.equal(g.policySha256,p.sha256);assert.equal(g.deadlineUtc,recordedDeadline);assert(Date.parse(g.issuedAtUtc)<=Date.now()&&Date.parse(g.issuedAtUtc)>=Date.parse(json(oldTerminal).atUtc))
  return ref(grantPath)
}
function priorTerminal(){
  const t=json(oldTerminal);assert.equal(t.runId,runId);assert.equal(t.status,'failed_closed');assert.equal(t.sealedSegments,13)
  assert.equal(t.reservedSegments,13);assert.equal(t.unconfirmedSegment,null);assert.equal(t.sealedPairs,312)
  return {terminal:t,oldTerminal:ref(oldTerminal)}
}
export function continuationOutcome(n,quality){assert.equal(n,48);assert.equal(typeof quality,'boolean');return quality?'training_completed_fixed_review_passed':'training_completed_fixed_review_failed'}
export function continuationCursor(boundary){
  assert.equal(boundary.runId,runId);assert.equal(boundary.deadlineUtc,recordedDeadline);assert.equal(boundary.reservedSegment,null,'reserved/uncertain segment: no retry')
  assert(Number.isInteger(boundary.endPair)&&boundary.endPair>=312&&boundary.endPair<=1152&&boundary.endPair%24===0)
  const n=boundary.endPair/24+1;assert.equal(boundary.nextSegment,n);assert(n>=14&&n<=49)
  return n
}
function ownTick(){
  const t=json(file('reservation.json'));verify(t.policy,policyPath);verify(t.grant,grantPath);assert.equal(t.oldTerminal.sha256,priorTerminal().oldTerminal.sha256)
  assert(!exists(file('terminal.json')),'continuation already has a terminal')
  assert(!exists(runRoot+'/stop.json')&&!exists(file('stop.json')),'persistent stop request')
  assert(Date.now()<Date.parse(recordedDeadline),'original absolute deadline reached')
}
function appointment(phase,n,previous){
  const t=Date.now(),limit=phase==='verify_final'?120000:840000,end=Math.min(t+limit,Date.parse(recordedDeadline))
  assert(end-t>=1000,'not enough time remains before original deadline')
  return {runId,phase,segment:n,startPair:phase==='verify_final'?1152:(n-1)*24,endPair:n*24,ownerRunnerPid:process.pid,
    issuedAtUtc:new Date(t).toISOString(),segmentDeadlineUtc:new Date(end).toISOString(),runDeadlineUtc:recordedDeadline,policySha256:json(runRoot+'/opening.json').policy.sha256,previous}
}
function sample(n,phase){
  const s=sampleContinuationResources({segment:n,phase,runnerPid:process.pid,additionalBytes:0});recordContinuationResourceSample(s);return s
}
async function waitBefore(n,phase){
  let lastWait=0
  for(;;){
    ownTick()
    const s=sample(n,phase);if(s.decision==='ready')return s
    assert(s.decision==='wait'&&phase==='before_ticket','resource stop: '+JSON.stringify(s.codes))
    if(!lastWait&&!exists(file('wait-'+n+'.json')))save(file('wait-'+n+'.json'),{segment:n,atUtc:s.atUtc,codes:s.codes})
    lastWait=Date.now();await sleep(Math.min(10000,Math.max(1,Date.parse(recordedDeadline)-lastWait)))
  }
}
async function owned(ctx,t){
  const final=t.phase==='verify_final',dir=seg(t.segment),owner=dir+'/'+(final?'final-readback-ownership.json':'ownership.json')
  const env={...process.env,PYTHONDONTWRITEBYTECODE:'1',CUDA_VISIBLE_DEVICES:'GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd',
    PYTORCH_ALLOC_CONF:'max_split_size_mb:128',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'}
  delete env.PYTORCH_CUDA_ALLOC_CONF
  const deadline=Date.parse(t.segmentDeadlineUtc);let last=0
  try{
    const timeout=deadline-Date.now();assert(timeout>0&&timeout<=(final?120000:840000))
    const v=await runOwnedWorker(ctx.interpreter,['-I','-B',path.join(ROOT,ctx.worker),final?'--verify-final':'--segment',String(t.segment)],{
      cwd:ROOT,env,timeout,maxBuffer:8*MiB,abortReason:()=>{
        if(Date.now()>=deadline||exists(runRoot+'/stop.json')||exists(file('stop.json')))return 'stop or original deadline'
        if(Date.now()-last<2000)return null;last=Date.now()
        try{const r=sample(t.segment,final?'final_readback_running':'running');return r.decision==='ready'?null:r.codes.join(',')}catch(e){return String(e.message)}
      }})
    save(owner,{ok:true,timeoutMs:timeout,receipt:v.ownedReceipt,stdout:v.stdout,stderr:v.stderr})
  }catch(e){
    if(!exists(owner))save(owner,{ok:false,error:String(e.message).slice(0,3072),receipt:e.ownedReceipt??null,stderr:String(e.stderr??'').slice(-2048)})
    throw e
  }
}
async function review(n){
  if(n!==24&&n!==48)return null
  const dir=runRoot+'/review',p=dir+'/epoch-'+n/2+'.json'
  fs.mkdirSync(safe(dir),{recursive:true});assert(!exists(p),'review consumed')
  assert(usage()+256*1024<=128*MiB,'missing bounded review space')
  const began=performance.now()
  const verdict=await readNativeStage0FormalReview(n/2,{root:ROOT})
  assert(performance.now()-began<120000&&Date.now()<Date.parse(recordedDeadline),'review deadline')
  assert.equal(verdict.epoch,n/2);assert.equal(verdict.runId,runId);assert.equal(verdict.stageAdvanceAllowed,false);assert.equal(verdict.worldEntryAllowed,false)
  if(n===24)assert.equal(verdict.trainingMayContinue,true)
  const report=save(p,verdict),seal=ref(seg(n)+'/seal.json'),checkpoint=json(seal.path).checkpoint
  const receipt=save(dir+'/receipt-'+n/2+'.json',{report,seal,checkpoint})
  const eventId='review-'+n/2
  save(runRoot+'/events/'+eventId+'.json',{runId,phase:'train',atUtc:now(),eventId,review:report,receipt,qualityPassed:verdict.qualityPassed,dispatchId})
  return verdict
}
function reap(n){
  const v=verifyNativeContinuationReap(n);if(n===14){assert.equal(v,null);return}
  assert(n>=15&&v)
  const dir=seg(n-1),exact=dir+'/recovery.pt'
  verify(v.old,exact);verify(v.replacement,seg(n)+'/recovery.pt');verify(v.committed,seg(n)+'/seal.json')
  assert.equal(path.dirname(safe(exact)),safe(dir));assert.equal(path.basename(safe(exact)),'recovery.pt')
  save(dir+'/reap-intent.json',v);verify(v.old,exact);fs.unlinkSync(safe(exact));save(dir+'/reaped.json',v)
}
// All irreversible operations use the same order in the local execution path.
// No retry branch exists after a segment or independent readback was charged.
export async function driveContinuationSegment(n,h){
  assert(Number.isInteger(n)&&n>=14&&n<=48)
  await h.waitForCapacity(n)
  const ticket=h.claim(n)
  await h.perform(ticket)
  const seal=h.seal(n,ticket)
  if(n===48)await h.independentReadback(n,seal)
  const verdict=(n===24||n===48)?await h.review(n):null
  if(n!==14)h.reap(n)
  return verdict
}
function terminal(status,reason){
  const boundary=verifyNativeContinuationBoundary()
  return save(file('terminal.json'),{dispatchId,runId,status,reason,atUtc:now(),completedPairs:boundary.endPair,
    lastSeal:boundary.latestSeal,reservedSegment:boundary.reservedSegment,originalTerminal:ref(oldTerminal),deadlineUtc:recordedDeadline,
    stageAdvanceAllowed:false,worldEntryAllowed:false},true)
}
async function work(){
  assert(exists(file('reservation.json')))
  const until=Math.min(Date.now()+20000,Date.parse(recordedDeadline))
  while(!exists(launchFile)&&Date.now()<until)await sleep(100)
  const host=hostProof();assert(host.hostAlive&&host.activePid===process.pid,'only registered native-host receipt can enter')
  fs.mkdirSync(safe(file('host-claim')));let n=14
  try{
    let ctx=policy();ownTick();assert.equal(continuationCursor(verifyNativeContinuationBoundary()),14)
    for(;n<=48;n++){
      const boundary=verifyNativeContinuationBoundary();assert.equal(continuationCursor(boundary),n)
      const verdict=await driveContinuationSegment(n,{
        waitForCapacity:k=>waitBefore(k,'before_ticket'),
        claim(k){
          ctx=policy();ownTick();assert(!exists(guardPath),'original exclusive guard became busy')
          const t=appointment('train',k,{receipt:boundary.latestSeal,checkpoint:boundary.latestCheckpoint})
          fs.mkdirSync(safe(seg(k)));save(seg(k)+'/ticket.json',t);return t
        },
        perform:t=>owned(ctx,t),
        seal(k,t){
          assert.equal(t.ownerRunnerPid,process.pid);assert.equal(json(seg(k)+'/ticket.json').ownerRunnerPid,process.pid)
          const proof=buildNativeContinuationSeal(k),receipt=save(seg(k)+'/seal.json',proof)
          const eventId='committed-'+String(k).padStart(2,'0')
          save(runRoot+'/events/'+eventId+'.json',{runId,phase:'train',atUtc:now(),eventId,segment:k,endPair:k*24,receipt,dispatchId})
          return proof
        },
        async independentReadback(k,proof){
          await waitBefore(k,'final_readback_entry');ownTick()
          const t=appointment('verify_final',48,{receipt:ref(seg(k)+'/seal.json'),checkpoint:proof.checkpoint})
          save(seg(k)+'/final-readback-ticket.json',t);await owned(ctx,t)
          save(seg(k)+'/final-readback-seal.json',verifyNativeContinuationFinalReadback())
        },review,reap})
      if(n===48)return terminal(continuationOutcome(n,verdict.qualityPassed),{review:ref(runRoot+'/review/epoch-24.json'),finalReadback:ref(seg(48)+'/final-readback-seal.json')})
    }
  }catch(e){
    if(!exists(file('terminal.json'))){
      const reason=String(e.message).slice(0,4096),status=/persistent stop|registered stop/i.test(reason)?'stopped':'failed_closed'
      try{terminal(status,reason)}catch{
        // Even if the current boundary cannot be proven, retain failure without guessing counts.
        save(file('terminal.json'),{dispatchId,runId,status,reason,atUtc:now(),completedPairs:null,lastSeal:null,reservedSegment:n,
          originalTerminal:ref(oldTerminal),deadlineUtc:recordedDeadline,stageAdvanceAllowed:false,worldEntryAllowed:false},true)
      }
    }
    throw e
  }
}
function status(){
  const old=priorTerminal(),term=exists(file('terminal.json'))?json(file('terminal.json')):null,claim=exists(file('reservation.json')),host=claim?hostProof():{activePid:null,hostAlive:null,activeProof:null}
  let boundary=null,problem=null
  try{boundary=verifyNativeContinuationBoundary()}catch(e){problem=String(e.message)}
  let n=boundary?.reservedSegment??boundary?.nextSegment??14;if(n>48)n=48
  const open=exists(seg(n)+'/ticket.json')&&!exists(seg(n)+'/seal.json'),w=file('resource-latest.json'),latest=exists(w)?json(w):null
  const wait=latest?.decision==='wait'&&latest.segment===n&&!open?latest:null
  const state=term?.status??(!claim?'not_started':host.hostAlive===false||(!host.activeProof&&Date.now()-Date.parse(json(file('reservation.json')).atUtc)>30000)?'host_exit_unconfirmed':!host.hostAlive?'dispatch_reserved':wait?'waiting_resources':'running')
  return {dispatchId,runId,activationRoot,status:state,...host,...liveWorker(host,n),oldTerminal:old.oldTerminal,
    completedPairs:term?term.completedPairs:boundary?.endPair??null,segment:term&&term.completedPairs!==null?term.completedPairs/24:n,
    stopReason:term?.reason??problem??null,deadlineUtc:recordedDeadline,terminal:term,waiting:state==='waiting_resources'?{segment:n,codes:wait.codes,observedAtUtc:wait.atUtc,resourceStatus:'wait',
      hostFreeBytes:Number.isSafeInteger(wait.hostFreeBytes)?wait.hostFreeBytes:null,minHostFreeBytes:13*1024**3,
      diskFreeBytes:Number.isSafeInteger(wait.diskFreeBytes)?wait.diskFreeBytes:null,minDiskFreeBytes:2*1024**3}:null,
    sourceTime:now(),lastEvidenceAtUtc:term?.atUtc??latest?.atUtc??(open?json(seg(n)+'/ticket.json').issuedAtUtc:claim?json(file('reservation.json')).atUtc:old.terminal.atUtc)}
}
export async function nativeContinuationCommand(action='--status',...extra){
  assert(!extra.length&&['--preflight','--status','--launch','--host'].includes(action),'fixed continuation command only')
  if(action==='--status')return status()
  if(action==='--host')return work()
  const ctx=policy(),boundary=verifyNativeContinuationBoundary()
  if(action==='--preflight')return {runId,dispatchId,oldTerminal:ctx.body.oldTerminal,policy:ctx.p,deadlineUtc:recordedDeadline,
    nextSegment:boundary.nextSegment,completedPairs:boundary.endPair,reservedSegment:boundary.reservedSegment,eligibleCursor:boundary.nextSegment===14&&boundary.reservedSegment===null,
    deadlineRemaining:Date.now()<Date.parse(recordedDeadline),grantPresent:exists(grantPath),attemptReserved:exists(file('reservation.json')),modelForwards:0}
  if(exists(file('reservation.json')))return status()
  assert.equal(continuationCursor(boundary),14);const grantRef=grant(ctx.p)
  assert(Date.now()<Date.parse(recordedDeadline)&&!exists(runRoot+'/stop.json'),'stop or original deadline')
  assert(!exists(guardPath),'original Job currently in use')
  fs.mkdirSync(safe(runRoot+'/continuations'),{recursive:true});fs.mkdirSync(safe(activationRoot))
  save(file('reservation.json'),{runId,dispatchId,atUtc:now(),grant:grantRef,policy:ctx.p,oldTerminal:ctx.body.oldTerminal,
    opening:ctx.body.opening,seal13:ctx.body.seal13,checkpoint13:ctx.body.checkpoint13,deadlineUtc:recordedDeadline,automaticRetries:0})
  const receipt=launchProjectCommandBackground(ownerOptions);validateProjectCommandBackgroundReceipt({...ownerOptions,receipt})
  return {runId,dispatchId,status:'dispatch_reserved',hostPid:receipt.processId,receipt:ref(launchFile),deadlineUtc:recordedDeadline}
}
