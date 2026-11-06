import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {BASELINE_IDENTITY} from './natural-world-baseline-proof.mjs'
import {ROOT,bind,bound,digest,featureSha,runtime,safe,sha} from './world-initialized-evolution.mjs'
import {loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH} from './ai-painter-autonomous-package-decision-core-v3.mjs'
import {readScheduledWeatherHistory,readScheduledWeatherEnrollmentAnchor,readScheduledWeatherQualificationHistory,
  readScheduledWeatherQualificationEnrollmentAnchor,scheduledWeatherInterval,WEATHER_CHECKPOINT,WEATHER_EPOCH,WEATHER_FORECAST_DAYS,WEATHER_NEXT_VERSION} from './world-weather-scheduled-history.mjs'

const fixtures='.runtime/ai-painter/controller-repair-reviews/world-service-lease-206-20261103/fixtures'
// Namespace deliberately independent of executable version, session, activation, date and batch number.
const lifetime=digest({world:BASELINE_IDENTITY,cutoffUtc:WEATHER_EPOCH})
const initialSha='812125a94cf1a1704d4dfff46b2ac218bb31a9ac4a7bc277144331610e827898'
const timeContract={path:'data/ai-painter/system-governance/sakaerat-first-weather-execution-budget-v1.json',sha256:'e0d6bf6988f29ce9129a857d6dfcb67aa5b46430a279e41b266226200b154d2a'}
const horizonPath='.runtime/ai-painter/controller-repair-reviews/world-environment-holdout-154-20261029/evaluation-contract.json'
const horizonSha='4ac397b53dc55b7d4d0f33da6e213db88a2ee0210be03042e483103ccf527517'
const encode=x=>Buffer.from(JSON.stringify(x,null,2)+'\n')
const isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
function integer(x,min,max,reason){assert(Number.isSafeInteger(x)&&x>=min&&x<=max,reason)}
function observed(history){
  assert.equal(history.schemaVersion,'sakaerat-scheduled-weather-history-v1')
  assert.deepEqual(history.identity,BASELINE_IDENTITY)
  assert.equal(history.modelSha256,WEATHER_CHECKPOINT);assert.equal(history.originalCutoffUtc,WEATHER_EPOCH)
  const b=history.before,tick=b.tick
  integer(tick,3,WEATHER_FORECAST_DAYS,'weather lease cursor')
  assert.deepEqual([b.stateVersion,b.eventCursor],[tick+1,tick+1])
  assert(isHash(b.fileSha256)&&isHash(history.head.businessKey)&&isHash(history.head.eventSha256))
  assert.equal(featureSha(history.history),history.historyValueSha256)
  assert.deepEqual(history.rows.map(row=>row.values),history.history)
  assert.equal(history.rows.at(-1).provenance.eventSha256,history.head.eventSha256)
  assert.deepEqual(history.interval,scheduledWeatherInterval(tick))
  return {tick,file:b.fileSha256,event:history.head.eventSha256,business:history.head.businessKey,history:history.historyValueSha256}
}

// Outer total is charged over the single world/cutoff lifetime. A batch is just a smaller grant.
export function weatherServiceContract(initial,{maxNewSteps=3,batchSize=2,maxBatchIssues=6,batchLeaseMs=60000}={}){
  const origin=observed(initial)
  assert.equal(origin.tick,3);assert.equal(origin.file,initialSha,'unrecognized service starting checkpoint')
  const past=JSON.parse(bound({path:'.runtime/ai-painter/world-rolling-weather-runtime/v4/completed-1.json',sha256:'32f8ae4d8381eb8cede0dae26ea56767163adf40e6f0358040b967d70b20c143'}))
  assert.deepEqual(initial.before,past.after);assert.deepEqual(initial.head,past.readback.head)
  assert.deepEqual(initial.history.at(-1),past.readback.currentWeather)
  assert.equal(origin.history,'58b332b94470ba155fb3719678c78975d1c6a01d8fcf79f728c3a9d9e5c416f3')
  const evaluated=JSON.parse(bound({path:horizonPath,sha256:horizonSha}))
  assert.equal(evaluated.candidateCheckpoint.sha256,WEATHER_CHECKPOINT)
  assert.deepEqual(evaluated.origins.horizons,[7,30])
  integer(maxNewSteps,1,WEATHER_FORECAST_DAYS-origin.tick,'budget cannot exceed remaining original forecast horizon')
  integer(batchSize,1,Math.min(2,maxNewSteps),'batch too large')
  integer(maxBatchIssues,Math.ceil(maxNewSteps/batchSize),2*WEATHER_FORECAST_DAYS,'invalid lifetime batch limit')
  integer(batchLeaseMs,30000,180000,'invalid lease duration')
  const original=JSON.parse(bound(timeContract))
  return {schemaVersion:'sakaerat-scheduled-weather-accounting-v1',lifetime,identity:initial.identity,
    modelSha256:WEATHER_CHECKPOINT,cutoffUtc:WEATHER_EPOCH,maximumForecastDays:WEATHER_FORECAST_DAYS,
    initial:origin,maximumNewSteps:maxNewSteps,maximumNewModelStarts:maxNewSteps,lastEligibleTick:origin.tick+maxNewSteps,
    batchSize,maximumBatchIssues:maxBatchIssues,batchLeaseMs,maximumInflight:1,automaticModelRetries:0,
    maximumCumulativeWorkerSeconds:maxNewSteps*original.resources.workerSecondsMaximum,
    maximumCumulativeWorkerArtifactBytes:maxNewSteps*original.resources.artifactBytesMaximum,
    clock:original.timePolicy,workerLimits:{cpuThreads:original.resources.cpuThreadsMaximum,maxCommitMiB:original.resources.maxCommittedMemoryMiB,
      maxWorkerSeconds:original.resources.workerSecondsMaximum},qualificationOnly:true}
}
function fixturePath(name){
  assert(typeof name==='string'&&/^lease-[a-z0-9]{16,48}$/.test(name),'isolated fixture name required')
  return safe(fixtures+'/'+name)
}
function trustedFixtureConfig(initial,cfg,mode='qualification'){
  const expected=weatherServiceContract(initial,{maxNewSteps:cfg.maximumNewSteps,batchSize:cfg.batchSize,maxBatchIssues:cfg.maximumBatchIssues,batchLeaseMs:cfg.batchLeaseMs})
  assert.deepEqual(cfg,{...expected,qualificationOnly:mode!=='production'},'changed, unknown or expanded machine contract')
}

const ddl=`
CREATE TABLE service (id INTEGER PRIMARY KEY CHECK(id=1), scope TEXT NOT NULL, cfg_sha TEXT NOT NULL,
  tick INTEGER NOT NULL, file_sha TEXT NOT NULL, event_sha TEXT NOT NULL, business_key TEXT NOT NULL, history_sha TEXT NOT NULL,
  wall_watermark INTEGER NOT NULL);
CREATE TABLE batches (seq INTEGER PRIMARY KEY, batch_id TEXT NOT NULL UNIQUE, first_tick INTEGER NOT NULL,
  last_tick INTEGER NOT NULL, issued_ms INTEGER NOT NULL, expires_ms INTEGER NOT NULL);
CREATE TABLE slots (target_tick INTEGER PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(batch_id), token TEXT NOT NULL UNIQUE,
  before_file TEXT NOT NULL, before_event TEXT NOT NULL, input_sha TEXT NOT NULL, history_sha TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('reserved','failed','committed')), failure TEXT, commit_file TEXT, commit_event TEXT);
`
function readMark(file){return JSON.parse(fs.readFileSync(file))}
function checkFile(file){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&fs.realpathSync.native(file).toLowerCase()===file.toLowerCase(),'unsafe accounting file')}

export function initializeIsolatedWeatherLease(name,initial,cfg){
  return initializeAccounting(fixturePath(name),initial,cfg,'qualification')
}
function initializeAccounting(dir,initial,cfg,mode){
  trustedFixtureConfig(initial,cfg,mode)
  fs.mkdirSync(path.dirname(dir),{recursive:true})
  // Directory creation claims initialization. Reentry, missing DB and incomplete initialization never mint credit.
  fs.mkdirSync(dir,{recursive:false})
  const marker={lifetime,configSha256:digest(cfg),origin:observed(initial),initialInputSha256:sha(encode(initial))}
  fs.writeFileSync(path.join(dir,'identity.json'),encode(marker),{flag:'wx',flush:true})
  fs.writeFileSync(path.join(dir,'contract.json'),encode(cfg),{flag:'wx',flush:true})
  fs.writeFileSync(path.join(dir,'initial-input.json'),encode(initial),{flag:'wx',flush:true})
  const db=new DatabaseSync(path.join(dir,'accounting.sqlite'))
  try{
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; BEGIN IMMEDIATE')
    db.exec(ddl)
    const s=marker.origin
    db.prepare('INSERT INTO service VALUES(1,?,?,?,?,?,?,?,0)').run(lifetime,marker.configSha256,s.tick,s.file,s.event,s.business,s.history)
    db.exec('COMMIT')
  }finally{db.close()}
  return {lifetime,configSha256:marker.configSha256,startedAtTick:marker.origin.tick}
}

function openAccounting(dir,initial,cfg,mode='qualification',readOnly=false){
  trustedFixtureConfig(initial,cfg,mode)
  const file=path.join(dir,'accounting.sqlite'),mark=path.join(dir,'identity.json');checkFile(mark);checkFile(file)
  const marker=readMark(mark)
  assert.deepEqual(marker,{lifetime,configSha256:digest(cfg),origin:observed(initial),initialInputSha256:sha(encode(initial))},'weather lifetime config mismatch; credit cannot be reset')
  const db=new DatabaseSync(file,{readOnly})
  try{
    db.exec(readOnly?'PRAGMA query_only=ON; PRAGMA busy_timeout=2000':'PRAGMA busy_timeout=2000; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON')
    assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok','damaged budget ledger')
  }catch(error){db.close();throw error}
  const state=()=>db.prepare('SELECT * FROM service WHERE id=1').get()
  function verifiedState(){
    const s=state();assert(s&&s.scope===lifetime&&s.cfg_sha===marker.configSha256,'missing original lifetime identity')
    return s
  }
  try{verifiedState()}catch(error){db.close();throw error}
  function tx(fn){
    db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}
  }
  function checkWall(now){
    integer(now,0,Number.MAX_SAFE_INTEGER,'invalid wall time')
    const s=verifiedState();assert(now>=s.wall_watermark,'wall clock regressed; do not renew')
    db.prepare('UPDATE service SET wall_watermark=? WHERE id=1').run(now)
    return s
  }
  function sameHead(s,h){
    assert(s.tick===h.tick&&s.file_sha===h.file&&s.event_sha===h.event&&s.business_key===h.business&&s.history_sha===h.history,
      'stale, competing or unverified committed weather head')
  }
  function evidence(){
    const s=verifiedState(),slots=db.prepare('SELECT target_tick,status FROM slots ORDER BY target_tick').all(),
      batches=db.prepare('SELECT COUNT(*) AS n FROM batches').get().n
    assert(slots.length<=cfg.maximumNewModelStarts&&batches<=cfg.maximumBatchIssues,'persistent resource account invalid')
    for(const [i,row] of slots.entries()){
      assert(row.target_tick===cfg.initial.tick+i+1,'durable day gap')
      assert(row.target_tick<=s.tick?row.status==='committed':(row.target_tick===s.tick+1&&row.status!=='committed'),'ledger cursor and charged slots differ')
    }
    assert(s.tick===cfg.initial.tick+slots.filter(r=>r.status==='committed').length,'lost committed slot')
    const pending=slots.find(x=>x.status!=='committed')
    return {scope:lifetime,anchorTick:cfg.initial.tick,committedTick:s.tick,chargedModelStartSlots:slots.length,remainingModelStarts:cfg.maximumNewModelStarts-slots.length,
      cumulativeIncludingPriorDays:cfg.initial.tick+slots.length,remainingAuthorizedDays:cfg.lastEligibleTick-s.tick,
      remainingOriginalValidatedDays:WEATHER_FORECAST_DAYS-s.tick,batchesIssued:batches,remainingBatchIssues:cfg.maximumBatchIssues-batches,
      outstanding:pending?{tick:pending.target_tick,status:pending.status}:null}
  }
  function appendCommittedHead(history){
    const h=observed(history)
    return tx(()=>{
      const s=verifiedState()
      if(h.tick===s.tick){sameHead(s,h);return {replayed:true,usage:evidence()}}
      assert.equal(h.tick,s.tick+1,'weather reconciliation cannot skip any commitment')
      const slot=db.prepare('SELECT * FROM slots WHERE target_tick=?').get(h.tick)
      const ev=history.verifiedTrace.at(-1),row=history.rows.at(-1).provenance
      assert(slot&&slot.status==='reserved','no recoverable charged slot')
      assert(ev&&ev.modelVersion===WEATHER_NEXT_VERSION&&ev.tick===h.tick&&ev.eventSha256===h.event&&ev.businessKey===h.business&&
        ev.fileSha256===h.file&&ev.inputSha256===slot.input_sha&&ev.outputSha256===row.output.sha256&&row.input.sha256===slot.input_sha&&
        row.previousEventSha256===s.event_sha&&slot.before_file===s.file_sha&&slot.before_event===s.event_sha,'unbound model event or competing origin')
      db.prepare("UPDATE slots SET status='committed',commit_file=?,commit_event=? WHERE target_tick=?").run(h.file,h.event,h.tick)
      db.prepare('UPDATE service SET tick=?,file_sha=?,event_sha=?,business_key=?,history_sha=? WHERE id=1').run(h.tick,h.file,h.event,h.business,h.history)
      return {replayed:false,usage:evidence()}
    })
  }
  function acquire(history,now=Date.now()){
    const h=observed(history)
    return tx(()=>{
      const s=checkWall(now);sameHead(s,h);const usage=evidence()
      if(usage.outstanding)return {status:'consumed_slot_requires_recovery',usage}
      if(!usage.remainingModelStarts||!usage.remainingAuthorizedDays)return {status:'lifetime_exhausted',usage}
      const target=s.tick+1,batch=db.prepare('SELECT * FROM batches ORDER BY seq DESC LIMIT 1').get()
      if(batch&&target>=batch.first_tick&&target<=batch.last_tick&&now<batch.expires_ms)return {status:'existing_batch',batch,usage}
      if(!usage.remainingBatchIssues)return {status:'batch_issuance_exhausted',usage}
      const seq=usage.batchesIssued+1,end=Math.min(cfg.lastEligibleTick,target+cfg.batchSize-1)
      const id=digest({scope:lifetime,seq,first:target,end,before:h.file,issued:now})
      db.prepare('INSERT INTO batches VALUES(?,?,?,?,?,?)').run(seq,id,target,end,now,now+cfg.batchLeaseMs)
      return {status:'new_batch',batch:db.prepare('SELECT * FROM batches WHERE seq=?').get(seq),usage:evidence()}
    })
  }
  function reserve(history,batchId,now){
    const h=observed(history)
    return tx(()=>{
      const s=checkWall(now);sameHead(s,h);const usage=evidence()
      if(usage.outstanding)return {status:'consumed_slot_requires_recovery',mayStart:false,usage}
      if(!usage.remainingModelStarts||!usage.remainingAuthorizedDays)return {status:'lifetime_exhausted',mayStart:false,usage}
      const batch=db.prepare('SELECT * FROM batches ORDER BY seq DESC LIMIT 1').get()
      assert(batch&&batch.batch_id===batchId&&now>=batch.issued_ms&&now<batch.expires_ms,'superseded or expired weather batch')
      const target=s.tick+1;assert(target>=batch.first_tick&&target<=batch.last_tick&&target<=cfg.lastEligibleTick,'tick exceeds batch')
      const token=randomUUID(),inputSha=sha(encode(history))
      db.prepare("INSERT INTO slots(target_tick,batch_id,token,before_file,before_event,input_sha,history_sha,status) VALUES(?,?,?,?,?,?,?,'reserved')")
        .run(target,batchId,token,h.file,h.event,inputSha,h.history)
      // This is an idempotency/resource reservation, never a capability release or standalone permission to execute.
      return {status:'fresh_slot',mayStart:true,token,targetTick:target,inputSha256:inputSha,beforeFileSha256:h.file,usage:evidence()}
    })
  }
  function fail(token,reason){
    assert(typeof reason==='string'&&reason.length>0&&reason.length<=512)
    return tx(()=>{
      assert.equal(db.prepare("UPDATE slots SET status='failed',failure=? WHERE status='reserved' AND token=?").run(reason,token).changes,1,'unknown or terminal weather slot')
      return evidence()
    })
  }
  return {usage:evidence,acquire,reserve,fail,appendCommittedHead,close:()=>db.close()}
}

// Stage-one accounting has no production-file, forecasting, release or Store-write entry.
// A later trusted server adapter supplies freshly verified Store history to these same operations.
export async function openIsolatedWeatherService(name,initial,cfg){
  const data=openAccounting(fixturePath(name),initial,cfg)
  return onlineService(data,cfg)
}
async function onlineService(data,cfg){
  let clock
  try{({clock}=await runtime())}catch(error){data.close();throw error}
  return {
    usage:data.usage,acquireBatch:data.acquire,markFailed:data.fail,reconcileVerifiedFixtureHead:data.appendCommittedHead,
    reconcileVerifiedHead:data.appendCommittedHead,close:data.close,
    openOnlineSession(history,monotonicStartMs=performance.now()){
      const h=observed(history);const end=history.rows.at(-1).period.logicalEndUtc
      const anchor=clock.createWorldEvolutionClockAnchor({policy:cfg.clock,lastCommittedLogicalEndUtc:end,monotonicNowMs:monotonicStartMs,recoveredPendingSteps:0})
      return {
        origin:h,claimDue(historyNow,{monotonicNowMs=performance.now(),wallNowMs=Date.now(),expectedBatchId}={}){
          const hnow=observed(historyNow),usage=data.usage()
          if(hnow.tick!==usage.committedTick)throw Error('stale online weather cursor')
          const batch=data.acquire(historyNow,wallNowMs)
          if(!batch.batch)return {...batch,mayStart:false}
          if(expectedBatchId!==undefined&&expectedBatchId!==batch.batch.batch_id)throw Error('weather batch superseded')
          const remaining=Math.min(usage.remainingAuthorizedDays,usage.remainingModelStarts)
          const proposal=clock.planWorldEvolutionBatch(anchor,{monotonicNowMs,committedLogicalEndUtc:historyNow.rows.at(-1).period.logicalEndUtc,
            remainingStepBudget:remaining,remainingLogicalSeconds:remaining*86400,maxBatchSteps:1})
          if(!proposal.proposedSteps)return {status:'not_due_online',batch:batch.batch,mayStart:false,usage:data.usage()}
          assert.deepEqual(proposal.intervals[0],historyNow.interval,'online proposal differs from committed interval')
          return {...data.reserve(historyNow,batch.batch.batch_id,wallNowMs),batch:batch.batch}
        },
      }
    },
  }
}

// No caller-supplied budget, cursor, counters or "passed" flag on restart.
export function resumeIsolatedWeatherService(name){
  const dir=fixturePath(name)
  function boundedJson(filename,max){
    const p=path.join(dir,filename);checkFile(p);assert(fs.statSync(p).size<=max,'oversized service checkpoint')
    return readMark(p)
  }
  const initial=boundedJson('initial-input.json',65536),cfg=boundedJson('contract.json',16384)
  return openIsolatedWeatherService(name,initial,cfg)
}

// The two registered locations share the proven accounting algorithm, never a database or certificate.
// No caller can redirect a production file. Production registration is re-read from the original release reader.
export async function openRegisteredWeatherServiceAccounting(mode,initial,opts,create=false,readOnly=false){
  assert(mode==='production'||mode==='qualification')
  assert(typeof create==='boolean'&&typeof readOnly==='boolean'&&!(create&&readOnly))
  const isFormal=mode==='production'
  const base=isFormal?'.runtime/ai-painter/world-weather-service/'+BASELINE_IDENTITY.worldId:
    '.runtime/ai-painter/controller-repair-reviews/world-service-scheduled-runtime-210-20261103/qualification'
  const budgetPath=isFormal?'data/ai-painter/system-governance/sakaerat-scheduled-weather-runtime-v5.json':base+'/budget.json'
  let budgetBinding
  if(isFormal){
    const a=loadAndValidateReleasedCapabilityBinding({projectRoot:ROOT,capabilityReleasePath:'data/ai-painter/capability-releases/'+WEATHER_NEXT_VERSION+'/release.json',
      trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH,requiredCapabilityScope:'world_evolution'})
    assert.equal(a.verificationStatus,'verified_from_machine_adjudication_and_trusted_registry')
    assert.equal(a.release.capabilityReleaseIdentity,WEATHER_NEXT_VERSION);assert.equal(a.release.modelCapabilityVersion,WEATHER_NEXT_VERSION)
    assert.equal(a.release.capabilityScope,'world_evolution');assert.equal(a.verifiedBindings.runtimeInterfaceContract.path,budgetPath)
    budgetBinding=a.verifiedBindings.runtimeInterfaceContract
  }else budgetBinding=bind(budgetPath)
  const budget=JSON.parse(bound(budgetBinding))
  assert.equal(budget.version,WEATHER_NEXT_VERSION);assert.deepEqual(budget.identity,BASELINE_IDENTITY)
  assert.equal(budget.formalWritesMaximum,isFormal?budget.maximumNewSteps:0)
  assert.deepEqual(opts,{maxNewSteps:budget.maximumNewSteps,batchSize:budget.batchSize,maxBatchIssues:budget.maximumBatchIssues,batchLeaseMs:budget.batchLeaseMs})
  const checked=isFormal?await readScheduledWeatherEnrollmentAnchor():await readScheduledWeatherQualificationEnrollmentAnchor()
  assert.deepEqual(initial,checked)
  const dir=safe(base+'/accounting'),cfg={...weatherServiceContract(checked,opts),qualificationOnly:!isFormal}
  if(!fs.existsSync(dir)){
    assert(create&&!readOnly,'previously enrolled accounting unavailable; no automatic replenishment')
    const now=isFormal?await readScheduledWeatherHistory():await readScheduledWeatherQualificationHistory()
    assert.deepEqual(now.before,checked.before,'cannot recreate a ledger at an advanced head')
    assert(!fs.existsSync(safe(base+'/steps'))&&!fs.existsSync(safe(base+'/activation-1.json'))&&!fs.existsSync(safe(base+'/launches')),'lost accounting cannot be refilled')
    initializeAccounting(dir,checked,cfg,mode)
  }
  const data=openAccounting(dir,checked,cfg,mode,readOnly)
  if(readOnly)return {usage:data.usage,close:data.close}
  const core=await onlineService(data,cfg),live=()=>isFormal?readScheduledWeatherHistory():readScheduledWeatherQualificationHistory()
  const acquiredHere=new Set()
  return {
    usage:core.usage,close:core.close,
    async reconcileVerifiedHead(expected){
      const actual=await live();assert.deepEqual(actual,expected,'registered service requires the current original Store')
      return core.reconcileVerifiedHead(actual)
    },
    markFailed(token,reason){assert(acquiredHere.has(token),'unknown native reservation');return core.markFailed(token,reason)},
    openOnlineSession(expected,...overrides){
      assert.equal(overrides.length,0,'server clock cannot be overridden')
      const online=core.openOnlineSession(expected)
      return {async claimDue(expectedHead,...params){
        assert.equal(params.length,0,'server due time cannot be supplied')
        const actual=await live();assert.deepEqual(actual,expectedHead,'registered input no longer current')
        const decision=online.claimDue(actual)
        if(decision.mayStart)acquiredHere.add(decision.token)
        return decision
      }}
    },
  }
}

export async function readWeatherServiceReadiness(...args){
  assert.equal(args.length,0)
  const input=await readScheduledWeatherHistory()
  return {stage:'read_only',identity:input.identity,before:input.before,nextInterval:input.interval,historyValueSha256:input.historyValueSha256,
    inputSha256:sha(encode(input)),originalCutoffUtc:WEATHER_EPOCH,maximumValidatedForecastDays:WEATHER_FORECAST_DAYS,
    remainingOriginalValidatedDays:input.remainingValidatedDays,suggestedFixture:{totalNewDays:3,batchSize:2,modelForwardsAtMost:3},
    proposedCapability:WEATHER_NEXT_VERSION,releasedOrEnrolled:false,modelCalls:0,formalWorldWrites:0}
}
