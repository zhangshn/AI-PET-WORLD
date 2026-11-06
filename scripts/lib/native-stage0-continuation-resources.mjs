import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {nativeStage0ServiceLimits as limits} from './native-stage0-formal-service.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const runtime=path.join(ROOT,'.runtime/ai-painter')
const runId='stage0-native-256-formal-229'
const run=path.join(runtime,'native-stage0-formal-training',runId)
const activation=path.join(run,'continuations/resource-continuation-236')
const guard=path.join(runtime,'owned-worker-guards/active.json')
const legacy=path.join(runtime,'current-execution-registry/current.json')
const pinned=path.join(run,'segments/13/recovery.pt')
const MiB=2**20,GiB=2**30,meta=MiB,terminal=65536
const gpuId='GPU-48ef1a4c-5905-0ab2-bc2d-1f8ea9b1bbcd'
const phases=new Set(['before_ticket','running','post_training','final_readback_entry','final_readback_running'])
const entryPhase=phase=>phase==='before_ticket'||phase==='final_readback_entry'
const hz=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
const safeInt=x=>Number.isSafeInteger(x)&&x>=0
const hash=b=>createHash('sha256').update(b).digest('hex')
const fresh=new WeakSet()
const checkpointSha='82c930dd25042493fae7a085e8c60c2571734ee520e40b1ab9e760983a219ee0'
const runEnd='2026-11-03T08:09:02.105Z'

function options(o){
  assert(o&&phases.has(o.phase)&&Number.isInteger(o.segment)&&o.segment>=14&&o.segment<=48)
  assert(Number.isInteger(o.runnerPid)&&o.runnerPid>0)
  assert(safeInt(o.additionalBytes??0))
  if(o.phase.startsWith('final_readback'))assert.equal(o.segment,48)
  return {segment:o.segment,phase:o.phase,runnerPid:o.runnerPid,additionalBytes:o.additionalBytes??0}
}
function reader(file,limit=1048576){
  const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=limit)
  return JSON.parse(fs.readFileSync(file,'utf8'))
}
function used(dir){
  let bytes=0
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name)
    let s
    try{s=fs.lstatSync(p)}catch(e){if(e.code==='ENOENT')continue;throw e}
    assert(!s.isSymbolicLink(),'redirected run artifact')
    if(s.isDirectory())bytes+=used(p)
    else{assert(s.isFile()&&s.nlink===1,'non-regular run artifact');bytes+=s.size}
  }
  return bytes
}
function deepFreeze(x){
  if(x&&typeof x==='object'){for(const child of Object.values(x))deepFreeze(child);Object.freeze(x)}
  return x
}

/** A 24th real persisted row proves the frozen worker has no remaining gradient call in this segment. */
export function proveCompletedGradientRows(rows,segment,previousHistory){
  if(!Array.isArray(rows)||rows.length!==24||!hz(previousHistory))return false
  const seen=new Set();let h=previousHistory
  for(const [i,row] of rows.entries()){
    const count=(segment-1)*24+i+1,p=row?.position
    if(!p||typeof p.sampleId!=='string'||!p.sampleId||seen.has(p.sampleId)||!Number.isInteger(p.trainIndex)||p.trainIndex<0||p.trainIndex>=48||
       p.epoch!==Math.floor((count-1)/48)+1||p.zeroBasedEpochPosition!==(count-1)%48||
       row.counts?.generator!==count||row.counts?.discriminator!==count||row.ledger?.sampleId!==p.sampleId||
       row.ledger?.generator!==1||row.ledger?.discriminator!==1||!Number.isFinite(row.generatorLoss)||!Number.isFinite(row.discriminatorLoss))return false
    seen.add(p.sampleId)
    // Match Python JSON sorted keys/separators in Stage0Training.next_hash.
    h=hash(Buffer.concat([Buffer.from(h,'hex'),Buffer.from(JSON.stringify({epoch:p.epoch,sampleId:p.sampleId,trainIndex:p.trainIndex,zeroBasedEpochPosition:p.zeroBasedEpochPosition}))]))
    if(h!==row.historySha256)return false
  }
  return true
}
function gradientClosed(o){
  if(o.phase==='before_ticket')return false
  if(o.phase.startsWith('final_readback'))return true
  const dir=path.join(run,'segments',String(o.segment).padStart(2,'0')),file=path.join(dir,'pairs.jsonl')
  if(!fs.existsSync(file))return false
  const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size<=2*MiB)
  const text=fs.readFileSync(file,'utf8')
  if(!text.endsWith('\n'))return false
  const rows=text.trimEnd().split('\n')
  if(rows.length!==24)return false
  const t=reader(path.join(dir,'ticket.json')),prevDir=path.join(run,'segments',String(o.segment-1).padStart(2,'0'))
  const sealFile=path.join(prevDir,'seal.json'),pr=path.join(prevDir,'result.json')
  assert.equal(t.runId,runId);assert.equal(t.segment,o.segment);assert.equal(t.startPair,(o.segment-1)*24);assert.equal(t.endPair,o.segment*24)
  assert.equal(t.previous.receipt.path,path.relative(ROOT,sealFile).replaceAll('\\','/'))
  assert.equal(hash(fs.readFileSync(sealFile)),t.previous.receipt.sha256)
  const seal=reader(sealFile);assert.equal(seal.result.path,path.relative(ROOT,pr).replaceAll('\\','/'))
  const bytes=fs.readFileSync(pr);assert.equal(hash(bytes),seal.result.sha256)
  const previous=JSON.parse(bytes)
  return proveCompletedGradientRows(rows.map(l=>JSON.parse(l)),o.segment,previous.historySha256)
}
export function parseContinuationCard(output){
  const rows=output.trim().split(/\r?\n/).map(v=>v.split(',').map(s=>s.trim())).filter(r=>r[0]===gpuId)
  assert.equal(rows.length,1);const [uuid,total,used,free,temp]=rows[0]
  assert(rows[0].length===5&&[total,used,free].every(v=>/^\d{1,8}$/.test(v))&&/^\d{1,3}(\.\d{1,12})?$/.test(temp))
  const card={gpuId:uuid,totalMiB:Number(total),usedMiB:Number(used),freeMiB:Number(free),temperatureC:Number(temp)}
  assert(card.totalMiB>0&&card.usedMiB+card.freeMiB<=card.totalMiB+1)
  return card
}

/** Pure qualification surface; production takes all measured values from the local machine. */
export function assessContinuationResources(raw,input){
  const opt=options(input),enter=entryPhase(opt.phase),gradient=!raw.gradientClosed
  for(const key of ['hostFreeBytes','diskFreeBytes','bytes'])assert(safeInt(raw[key])||(raw[key]===null&&raw.inspectionFailure))
  const hostFloor=(enter?limits.minimumHostEntryGiB:limits.minimumHostRunningGiB)*GiB
  const diskFloor=limits.minimumDiskMiB*MiB,ceiling=limits.maxArtifactBytes
  const reserve=(gradient?limits.failureReserveBytes+meta:0)+terminal
  const projectedGradientBytes=raw.bytes===null?null:raw.bytes+opt.additionalBytes+reserve
  // Checkpoint write happens after gradients; never charge both peaks at once.
  const projectedCheckpointBytes=raw.bytes===null?null:raw.bytes+opt.additionalBytes+32*MiB+terminal
  const actualHost=raw.hostFreeBytes===null?null:raw.hostFreeBytes>=hostFloor,actualDisk=raw.diskFreeBytes===null?null:raw.diskFreeBytes>=diskFloor
  const codes=[]
  if(actualHost===false)codes.push('host_memory_below_floor')
  if(actualDisk===false)codes.push('disk_below_floor')
  if(raw.inspectionFailure)codes.push('resource_inspection_failed')
  if(raw.deadlineReached)codes.push('original_deadline_reached')
  if(raw.stopRequested)codes.push('registered_stop_requested')
  if(raw.legacyActive)codes.push('conflicting_legacy_trainer')
  if(!raw.guardOkay)codes.push('exclusive_owner_guard_mismatch')
  if(!raw.pinPresent)codes.push('pinned_checkpoint13_unverified')
  if(raw.phaseMismatch)codes.push('post_training_without_complete_pair_ledger')
  if(projectedGradientBytes>ceiling)codes.push('retention_or_failure_reserve_exhausted')
  if(opt.phase==='before_ticket'&&projectedCheckpointBytes>ceiling)codes.push('prospective_checkpoint_exceeds_limit')
  const margin=enter?3072:0,card=raw.card?{...raw.card,entryReserveMiB:margin}:null
  if(card){
    if((card.usedMiB+margin)*10>card.totalMiB*7)codes.push('gpu_fraction_exceeded')
    if(card.freeMiB-margin<limits.minimumFreeVramMiB)codes.push('gpu_free_below_floor')
    if(card.temperatureC>=limits.maximumTemperatureC)codes.push('gpu_temperature_at_or_above_limit')
  }else if(actualHost&&actualDisk&&!raw.inspectionFailure&&raw.guardOkay&&!raw.legacyActive&&!raw.deadlineReached)codes.push('missing_card_telemetry')
  const waitable=codes.length&&enter&&codes.every(code=>code==='host_memory_below_floor'||code==='disk_below_floor')
  return deepFreeze({schema:'stage0-continuation-resource-sample-v1',...opt,atUtc:raw.atUtc,decision:!codes.length?'ready':waitable?'wait':'stop',
    codes,bytes:raw.bytes,hostFreeBytes:raw.hostFreeBytes,diskFreeBytes:raw.diskFreeBytes,card,
    checks:{hostAtOrAboveFloor:actualHost,diskAtOrAboveFloor:actualDisk,hostFloorBytes:hostFloor,diskFloorBytes:diskFloor,
      observedVolume:raw.volume??null,ownershipVerified:raw.guardOkay,pinnedCheckpoint13Present:raw.pinPresent,deadlineReached:raw.deadlineReached,
      physicalGpuPollPerformed:!!card,samplingError:raw.inspectionFailure??null},
    capacity:{allRunBytes:raw.bytes,pinnedCheckpoint13Included:raw.pinPresent,additionalBytes:opt.additionalBytes,gradientClosed:raw.gradientClosed,
      failureTensorReserveBytes:gradient?limits.failureReserveBytes:0,metadataReserveBytes:gradient?meta:0,terminalReserveBytes:terminal,
      projectedGradientBytes,projectedCheckpointBytes,maximumCheckpointBytes:32*MiB,ceilingBytes:ceiling}})
}
let pinSignature=null
function retainedCheckpointIntact(requestNewHash){
  const s=fs.lstatSync(pinned,{bigint:true})
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size!==30107037n)return false
  const signature=[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':')
  if(requestNewHash||signature!==pinSignature){
    const h=createHash('sha256'),buffer=Buffer.allocUnsafe(MiB),fd=fs.openSync(pinned,'r');let read=0
    try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0){read+=n;h.update(buffer.subarray(0,n))}
      const end=fs.fstatSync(fd,{bigint:true})
      if(read!==30107037||h.digest('hex')!==checkpointSha||[end.dev,end.ino,end.size,end.mtimeNs,end.ctimeNs].join(':')!==signature)return false
    }finally{fs.closeSync(fd)}
    pinSignature=signature
  }
  return true
}

export function sampleContinuationResources(input){
  const opt=options(input),enter=entryPhase(opt.phase)
  const raw={atUtc:new Date().toISOString(),bytes:null,hostFreeBytes:null,diskFreeBytes:null,
    volume:null,card:null,guardOkay:false,legacyActive:false,deadlineReached:false,gradientClosed:false,pinPresent:false}
  try{
    raw.hostFreeBytes=os.freemem()
    const stat=fs.statfsSync(run);raw.diskFreeBytes=stat.bavail*stat.bsize
    raw.volume=path.parse(fs.realpathSync.native(run)).root
    raw.bytes=used(run)
    raw.pinPresent=retainedCheckpointIntact(enter)
    const until=reader(path.join(run,'opening.json')).runDeadlineUtc;assert.equal(until,runEnd)
    const stop=Date.parse(until)
    raw.deadlineReached=Date.now()>=stop
    raw.stopRequested=fs.existsSync(path.join(run,'stop.json'))||fs.existsSync(path.join(activation,'stop.json'))
    raw.legacyActive=reader(legacy).activeExecution!==null
    const g=fs.existsSync(guard)?reader(guard):null
    raw.guardOkay=enter?!g:opt.phase==='post_training'?(!g||g.runnerPid===opt.runnerPid):g?.runnerPid===opt.runnerPid
    raw.gradientClosed=gradientClosed(opt)
    raw.phaseMismatch=opt.phase==='post_training'&&!raw.gradientClosed
    if(!raw.deadlineReached&&!raw.stopRequested&&raw.pinPresent&&raw.guardOkay&&!raw.legacyActive&&raw.hostFreeBytes>=(enter?13:10)*GiB&&raw.diskFreeBytes>=2048*MiB){
      raw.card=parseContinuationCard(execFileSync('nvidia-smi',['--query-gpu=uuid,memory.total,memory.used,memory.free,temperature.gpu','--format=csv,noheader,nounits'],
        {encoding:'utf8',timeout:4000,windowsHide:true,maxBuffer:65536}))
    }
  }catch(e){raw.inspectionFailure=String(e.message).slice(0,512)}
  const sample=assessContinuationResources(raw,opt);fresh.add(sample);return sample
}

function save(file,bytes,replace){
  const p=path.join(activation,file),tmp=p+'.'+process.pid+'.tmp'
  if(!replace&&fs.existsSync(p))return
  assert(used(run)+Buffer.byteLength(bytes)<=limits.maxArtifactBytes,'insufficient capacity for bounded evidence; leave original artifacts untouched')
  // Only this single externally owned activation writes the bounded resource ledger.
  fs.writeFileSync(tmp,bytes,{flag:'wx',flush:true})
  fs.renameSync(tmp,p)
}
export function recordContinuationResourceSample(sample){
  assert(fresh.has(sample),'must persist a sample produced by this live resource reader')
  assert(fs.existsSync(activation)&&!fs.lstatSync(activation).isSymbolicLink()&&
    fs.realpathSync.native(activation).toLowerCase()===path.join(fs.realpathSync.native(run),'continuations/resource-continuation-236').toLowerCase(),'fixed activation directory required')
  const latest=path.join(activation,'resource-latest.json'),previous=fs.existsSync(latest)?reader(latest,32768):null
  const transition=JSON.stringify([sample.segment,sample.phase,sample.decision,sample.codes,sample.capacity.gradientClosed])
  const actual={...sample,transition}
  const bytes=JSON.stringify(actual)+'\n'
  assert(Buffer.byteLength(bytes)<=16384)
  if(!previous)save('resource-first.json',bytes,false)
  if(sample.decision==='wait')save('resource-first-wait.json',bytes,false)
  if(sample.decision==='stop')save('resource-first-failure.json',bytes,false)
  if(!previous||previous.transition!==transition||sample.decision==='stop'||(sample.decision==='wait'&&Date.parse(sample.atUtc)-Date.parse(previous.atUtc)>=30000))save('resource-latest.json',bytes,true)
  return sample
}
export class ContinuationResourceError extends Error{
  constructor(sample){super('continuation resource '+sample.decision+': '+sample.codes.join(','));this.name='ContinuationResourceError';this.sample=sample;this.decision=sample.decision}
}
export function requireContinuationResources(input){
  const sample=recordContinuationResourceSample(sampleContinuationResources(input))
  if(sample.decision!=='ready')throw new ContinuationResourceError(sample)
  return sample
}
