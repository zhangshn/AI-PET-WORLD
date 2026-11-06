import {execFile} from 'node:child_process'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const runId='stage0-native-256-formal-229',entry='scripts/run-native-stage0-formal-training.mjs'
const host='scripts/lib/native-stage0-formal-service.mjs',policy='data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json'
const approvedPolicy='3f00ea5bb99997ddbdd4f051b424bd9177b1305591504874394370be461887e1'
const continuationPolicy='data/ai-painter/system-governance/ai-painter-native-stage0-resource-continuation-v1.json'
const approvedContinuationPolicy='21f90e499fc58606c926459be8c2642415e6a6a82b684a49e62cfb6716232878'
const continuationEntry='scripts/run-native-stage0-continuation.mjs'
const originalStop={path:'.runtime/ai-painter/native-stage0-formal-training/'+runId+'/terminal.json',sha256:'3cb0712c1da6921fe6c5d370445679f8895328d51f096ecaa49de19ce3888fa1'}
const continuationStatuses=new Set(['not_started','dispatch_reserved','waiting_resources','running','failed_closed','stopped','training_completed_fixed_review_passed','training_completed_fixed_review_failed','host_exit_unconfirmed'])
const integer=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi
const date=v=>typeof v==='string'&&v.length<=48&&Number.isFinite(Date.parse(v))
const hash=b=>createHash('sha256').update(b).digest('hex')
const statuses=new Set(['not_started','initialization_incomplete','stopping','stopped','active','host_not_running','failed_closed',
  'training_completed_fixed_review_passed','training_completed_fixed_review_failed'])
const nonempty=v=>typeof v==='string'&&v.length>0&&v.length<4100
const links=[{label:'第 30 天地图候选与原图',href:'/local-backup/work/codex-818bb0ccda8514712999e4e290d502c1712a7e19184d0ade574f46e02476b9af'},
  {label:'48 张训练图的梯度准入记录',href:'/local-backup/work/codex-f10864d14a1efae5caf5bfbafb8e991644d586ab8f6a0b8c3e9064f43d5c4cfb'}]
function fail(why){throw Error(why)}
// Extract only view fields from the normal reporter. Raw checkpoint paths, environment and process receipts stay local.
export function projectNativeStage0Status(s){
  if(s?.runId!==runId||s.phase!=='train'||s.source!=='local_native_stage0_service'||!statuses.has(s.status)||!date(s.snapshotAtUtc))fail('报告身份或状态不符')
  if(s.status==='not_started'||s.status==='initialization_incomplete'){
    if(s.sealedPairs!==0||s.startedAtUtc!==null)fail('未启动状态含训练更新')
    return {kind:'verified',runId,status:s.status,sourceTime:s.snapshotAtUtc,startedAt:null,endedAt:null,elapsedSeconds:null,committed:0,percentage:0,
      segments:0,currentSegment:null,epoch:null,hostPid:null,hostAlive:null,workerPid:null,workerOwned:false,pendingD:null,pendingG:null,heartbeatAt:null,workerPhase:null,
      reason:null,reviews:[],links}
  }
  if(!integer(s.sealedSegments,0,48)||s.sealedPairs!==s.sealedSegments*24||s.counts?.generator!==s.sealedPairs||s.counts.discriminator!==s.sealedPairs||
      s.policy?.path!==policy||s.policy.sha256!==approvedPolicy||!date(s.startedAtUtc)||!Number.isFinite(s.elapsedSeconds)||s.elapsedSeconds<0)fail('封存计数或正式合同不符')
  const n=s.currentSegment
  if(n!==null&&(!integer(n,1,48)||s.currentEpoch!==Math.ceil(n/2)))fail('当前段与轮次不符')
  const heartbeat=s.worker?.heartbeat
  const ticket=s.lastSegmentTicket
  // A D update may have completed while its matching G update is still running.
  // The two in-memory counts are deliberately kept apart from all durable pairs.
  let pendingD=null,pendingG=null,heartbeatAt=null,workerPid=null,workerPhase=null
  if(heartbeat&&ticket?.segment===n&&ticket.runId===runId&&heartbeat.runId===runId&&heartbeat.segment===n&&date(heartbeat.utc)){
    const {D,G}=heartbeat.completedInMemory??{},from=ticket.startPair,to=ticket.endPair
    if(integer(D,from,to)&&integer(G,from,to)&&integer(n,1,48)&&from===(n-1)*24&&to===n*24){
      pendingD=Math.max(0,D-s.sealedPairs);pendingG=Math.max(0,G-s.sealedPairs);heartbeatAt=heartbeat.utc
      workerPid=integer(heartbeat.workerPid,1,2**31-1)?heartbeat.workerPid:null
      workerPhase=nonempty(heartbeat.phase)?heartbeat.phase:null
    }
  }
  const term=s.terminal,reason=typeof term?.reason==='string'?term.reason:
    term?.reason&&typeof term.reason.qualityPassed==='boolean'?(term.reason.qualityPassed?'固定审核通过':'固定审核未通过'):null
  if(term&&term.status!==s.status)fail('终态记录与运行状态不符')
  const reviews=(s.validation??[]).map(v=>{
    if(![12,24].includes(v.epoch)||v.rows?.length!==8)fail('固定观察原件不完整')
    return {epoch:v.epoch,rows:v.rows.length,reviewAvailable:Boolean(v.review),eligibility:v.epoch===12?'observation':'selection'}
  })
  return {kind:'verified',runId,status:s.status,sourceTime:s.snapshotAtUtc,startedAt:s.startedAtUtc,endedAt:date(s.endedAtUtc)?s.endedAtUtc:null,
    elapsedSeconds:s.elapsedSeconds,committed:s.sealedPairs,percentage:Math.round(s.sealedPairs/1152*1000)/10,segments:s.sealedSegments,
    currentSegment:n,epoch:s.currentEpoch,hostPid:integer(s.host?.pid,1,2**31-1)?s.host.pid:null,hostAlive:typeof s.host?.alive==='boolean'?s.host.alive:null,
    workerPid,workerOwned:Boolean(s.worker?.currentlyOwned&&s.host?.alive),pendingD,pendingG,heartbeatAt,workerPhase,reason,reviews,links}
}

// The enclosing plan projection is synchronous. Share one bounded asynchronous read per polling interval
// across all tabs, and always show the reporter timestamp of the returned observation.
const cacheKey=Symbol.for('ai-pet-world.local-backup.native-stage0-status.236')
const cache=globalThis[cacheKey]??={pending:false,lastAttempt:0,last:null,problem:null}
function installedBytes(root,relative,limit){
  const file=path.join(root,relative),st=fs.lstatSync(file)
  if(!st.isFile()||st.nlink!==1||st.size<=0||st.size>limit||fs.realpathSync.native(file).toLowerCase()!==file.toLowerCase())fail('报告程序文件边界不符')
  return fs.readFileSync(file)
}
export function projectStage0Continuation(base,s){
  if(base.kind!=='verified'||base.status!=='failed_closed'||s?.runId!==runId||s.dispatchId!=='resource-continuation-236'||
    s.oldTerminal?.path!==originalStop.path||s.oldTerminal.sha256!==originalStop.sha256||!date(s.sourceTime)||
    s.deadlineUtc!=='2026-11-03T08:09:02.105Z'||!continuationStatuses.has(s.status)||
    !integer(s.completedPairs,312,1152)||s.completedPairs%24!==0)fail('接续身份、原终态或更新数不符')
  if(s.status==='not_started'){
    if(base.committed!==312||s.completedPairs!==312)fail('未启动的接续含新封存')
    return base
  }
  if(!integer(s.segment,13,48)||!base.endedAt)fail('接续分段或原停机时点缺失')
  const alive=s.hostAlive===true&&s.activeProof?.identityVerified===true&&integer(s.activePid,1,2**31-1)&&s.activePid===s.activeProof.pid
  if(['running','waiting_resources'].includes(s.status)&&!alive)fail('接续宿主缺少实际存活身份')
  const terminal=s.terminal,endedAt=terminal?.atUtc??null
  if(terminal&&(!date(endedAt)||terminal.status!==s.status||terminal.completedPairs!==s.completedPairs))fail('接续终态不符')
  const end=endedAt??s.sourceTime
  const worker=alive&&integer(s.workerPid,1,2**31-1)?s.workerPid:null
  const sameSample=worker!==null&&worker===base.workerPid&&s.segment===base.currentSegment&&s.completedPairs===base.committed
  return {...base,status:s.status==='running'?'active':s.status,sourceTime:s.sourceTime,endedAt,
    elapsedSeconds:Math.max(0,(Date.parse(end)-Date.parse(base.startedAt))/1000),committed:s.completedPairs,percentage:Math.round(s.completedPairs*1000/1152)/10,
    segments:s.completedPairs/24,currentSegment:s.segment,epoch:Math.ceil(s.segment/2),hostPid:alive?s.activePid:null,hostAlive:s.hostAlive??null,
    workerOwned:worker!==null,workerPid:worker,pendingD:sameSample?base.pendingD:null,pendingG:sameSample?base.pendingG:null,heartbeatAt:sameSample?base.heartbeatAt:null,workerPhase:sameSample?base.workerPhase:null,
    reason:s.status==='waiting_resources'?'等待达到原资源门槛，尚未签发这一段训练票据。':s.status==='failed_closed'?'接续已保护停机，请查看本地运行记录。':null,
    previousStop:{endedAt:base.endedAt,committed:312},waitingResource:s.waiting&&date(s.waiting.observedAtUtc)&&
      [s.waiting.hostFreeBytes,s.waiting.minHostFreeBytes,s.waiting.diskFreeBytes,s.waiting.minDiskFreeBytes].every(n=>integer(n,0,Number.MAX_SAFE_INTEGER))?
      {at:s.waiting.observedAtUtc,ram:s.waiting.hostFreeBytes,minRam:s.waiting.minHostFreeBytes,disk:s.waiting.diskFreeBytes,minDisk:s.waiting.minDiskFreeBytes}:null,
    links:[...base.links,{label:'首次停机与原始断点',href:'/local-backup/work/codex-bb7cd694064788f4c02c05fac82973eb49f6c7c054961370a279e12fe497dbe8'}]}
}
function report(root,file){
  return new Promise((resolve,reject)=>execFile(process.execPath,[path.join(root,file),'--status'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:2*1024*1024},
    (err,stdout)=>{try{if(err)throw Error('本地程序读取失败，请查看运行原件');resolve(JSON.parse(stdout))}catch(e){reject(e)}}))
}
async function currentProjection(root){
  const base=projectNativeStage0Status(await report(root,entry))
  if(base.status!=='failed_closed'||!fs.existsSync(path.join(root,continuationPolicy)))return base
  const bytes=installedBytes(root,continuationPolicy,128*1024)
  if(hash(bytes)!==approvedContinuationPolicy)fail('接续合同尚未与工作台登记的版本匹配')
  const spec=JSON.parse(bytes)
  if(spec.dispatchId!=='resource-continuation-236'||spec.runId!==runId||spec.oldTerminal?.sha256!==originalStop.sha256||
     spec.originalPolicy?.sha256!==approvedPolicy||spec.originalPolicy?.path!==policy||spec.entry?.path!==continuationEntry||
     spec.activationRoot!=='.runtime/ai-painter/native-stage0-formal-training/'+runId+'/continuations/resource-continuation-236')fail('接续合同与原运行不符')
  if(!fs.existsSync(path.join(root,spec.activationRoot)))return base
  // Only fixed repository programs may be used by the dashboard, and only after
  // the controller has bound the installed bytes and original terminal evidence.
  const code=[continuationEntry,...['host','proof','resources'].map(n=>'scripts/lib/native-stage0-continuation-'+n+'.mjs')]
  for(const file of code){
    const bound=spec.sources?.find(r=>r.path===file)
    if(!bound||hash(installedBytes(root,file,256*1024))!==bound.sha256)fail('接续报告程序与登记不符')
  }
  return projectStage0Continuation(base,await report(root,continuationEntry))
}
export function readNativeStage0TrainingProgress(projectRoot){
  if(path.resolve(projectRoot)!==path.resolve(process.cwd()))return null
  try{
    const bytes=installedBytes(projectRoot,policy,256*1024)
    if(hash(bytes)!==approvedPolicy)fail('正式训练合同已变更')
    const spec=JSON.parse(bytes).service
    for(const [key,file] of [['entry',entry],['host',host]]){
      if(spec[key].path!==file||hash(installedBytes(projectRoot,file,128*1024))!==spec[key].sha256)fail('本地训练报告程序与登记不符')
    }
  }catch(err){return err.code==='ENOENT'?null:{kind:'unavailable',message:'无法校验本地正式训练报告程序。'}}
  const now=Date.now()
  if(!cache.pending&&now-cache.lastAttempt>=14500){
    cache.pending=true;cache.lastAttempt=now
    currentProjection(projectRoot).then(v=>{cache.last=v;cache.problem=null}).catch(e=>{cache.problem=e.message;cache.last=null}).finally(()=>{cache.pending=false})
  }
  if(cache.last&&now-Date.parse(cache.last.sourceTime)<45000)return cache.last
  return cache.problem?{kind:'unavailable',message:cache.problem}:{kind:'reading',message:'正在读取本地正式训练服务，结果随看板刷新。'}
}
