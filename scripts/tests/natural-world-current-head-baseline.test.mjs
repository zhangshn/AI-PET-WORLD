import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {baselineSha256} from '../lib/natural-world-baseline-proof.mjs'
import {readBaselineAndCurrentHead,readCommittedHeadBundle,verifyFirstForecastRecord} from '../lib/natural-world-current-head-baseline.mjs'
import {rollingBudgetStatus,verifyRollingDays} from '../lib/natural-world-rolling-head.mjs'
import {readCurrentWorldBaseline} from '../../src/server/local-backup/natural-world-baseline-reader.mjs'
import {readProjectWorkPlan} from '../../src/server/local-backup/project-progress-work-plan.mjs'
import {uiHarness} from './helpers/local-backup-ui.mjs'

const root=process.cwd()
const r=JSON.parse(fs.readFileSync('.runtime/ai-painter/controller-repair-reviews/natural-world-maintenance-policy-179-20261103/formal-readback.json'))
const head=r.formalStore+'.evolution/'+r.commit.businessKey+'.'+r.commit.fileSha256+'.record.json'
const snapshot=fs.readFileSync(head)
function get(transform=(_,bytes)=>bytes,refresh=transform){
  function reader(change){return (p,max)=>{
    const bytes=change(p,p===r.formalStore?snapshot:fs.readFileSync(p))
    assert(bytes.length<=max)
    return {bytes,sha256:baselineSha256(bytes)}
  }}
  return readBaselineAndCurrentHead({projectRoot:root,read:reader(transform),readFresh:reader(refresh),
    deliveryId:'WORLD-BASELINE-001',readAtUtc:new Date().toISOString()},readCurrentWorldBaseline)
}
test('the creation proof retains its own record, the committed weather initialization is shown separately',()=>{
  const v=get()
  assert.equal(v.status,'baseline_verified')
  assert.equal(v.store.sha256,r.before.fileSha256);assert.equal(v.store.eventCursor,0)
  assert.equal(v.currentHead.fileSha256,r.after.fileSha256)
  assert.equal(v.currentHead.eventSha256,r.commit.eventSha256)
  assert.deepEqual([v.currentHead.tick,v.currentHead.stateVersion,v.currentHead.eventCursor],[0,1,1])
})
test('workbench renders separate creation and live evidence in both layouts',()=>{
  const plan=readProjectWorkPlan({projectRoot:root,runtimeRoot:fs.realpathSync('.runtime')})
  plan.currentDelivery.worldBaseline=get()
  for(const compact of [false,true]){
    const ui=uiHarness('src/app/local-backup/progress/current-delivery.tsx','CurrentDelivery',{props:{plan,compact}})
    try{
      for(const text of ['初创存档','当前服务器存档',r.after.fileSha256,r.commit.businessKey,r.commit.eventSha256,r.interval.logicalEndUtc]){
        assert(ui.text().includes(text),text)
      }
      assert(!ui.text().includes('本轮模型绘图：未执行'))
    }finally{ui.unmount()}
  }
})
test('replaced event, other world, damaged before-image or changed live read cannot qualify',()=>{
  const replace=(matches,change)=>(p,bytes)=>{
    if(!matches(p))return bytes
    const value=JSON.parse(bytes);change(value)
    return Buffer.from(JSON.stringify(value))
  }
  for(const input of [
    replace(p=>p.endsWith('.event.json'),v=>{v.changes[0].newValue=111}),
    replace(p=>p===r.formalStore,v=>{v.worldId='different-world'}),
    replace(p=>p.endsWith('.before.json'),v=>{v.tick=321}),
    replace(p=>p.endsWith('.commit.json'),v=>{v.recordPath='elsewhere'}),
  ]){
    const v=get(input)
    assert.equal(v.status,'unverifiable');assert.equal(v.currentHead,undefined)
  }
  const v=get(undefined,replace(p=>p===r.formalStore,o=>{o.eventCursor++}))
  assert.equal(v.status,'unverifiable')
})

test('the identical first-forecast Store verifier accepts the real bounded 185 trial, rejects changed authority, prior, RNG or raw process output',t=>{
  const base='.runtime/ai-painter/controller-repair-reviews/world-first-evolution-runtime-185-20261103/qualification'
  const logical=base+'/store/'+r.world.ownerId+'/'+r.world.worldId+'.json'
  const read=(p,max=256*1024)=>{const bytes=fs.readFileSync(p);assert(bytes.length<=max);return {bytes,sha256:baselineSha256(bytes)}}
  const json=p=>JSON.parse(read(p).bytes)
  const live=read(logical),after=JSON.parse(live.bytes),input=json(base+'/run/input.json'),dir=logical+'.evolution/'
  const oldKey=input.historyProvenance.maintenanceBusinessKey,receipt=json(dir+oldKey+'.receipt.json')
  const priorEvent=json(dir+oldKey+'.'+receipt.eventSha256+'.event.json')
  const prior=json(dir+oldKey+'.'+receipt.fileSha256+'.record.json')
  const previous={receipt,event:priorEvent,record:prior,epoch:priorEvent.interval.logicalEndUtc}
  const version='sakaerat-weather-153-runtime-v3',policyPath='data/ai-painter/system-governance/mvp-natural-world-weather-policy-v2.json'
  const qualifiedWorker='.runtime/ai-painter/controller-repair-reviews/world-first-evolution-executor-180-20261103/delivery.json'
  const authority={policyRef:{id:policyPath,version,sha256:read(policyPath).sha256},capabilityRef:{id:qualifiedWorker,
    version:'unreleased-fixed-clone-qualification',sha256:'934dbf6a8bcc846bdb0c231bba9d42fd3bf0c2db8483717bbc390dedec48fc21'},
    policy:json(policyPath),interval:json(base.slice(0,-'/qualification'.length)+'/qualification-budget.json').firstInterval,
    budget:{path:base.slice(0,-'/qualification'.length)+'/qualification-budget.json',sha256:read(base.slice(0,-'/qualification'.length)+'/qualification-budget.json').sha256},mode:'qualification',
    run:base+'/run',weatherOrigin:'model_predicted_private_simulation'}
  const ctx={read,projectRoot:process.cwd(),logical,live,previous,authority}
  const result=verifyFirstForecastRecord(ctx)
  assert.equal(result.receipt.fileSha256,live.sha256)
  assert.equal(result.receipt.eventCursor,2);assert.equal(result.event.previousEventSha256,receipt.eventSha256)
  assert.throws(()=>verifyFirstForecastRecord({...ctx,authority:{...authority,capabilityRef:{...authority.capabilityRef,sha256:'0'.repeat(64)}}}),/evolution_authority/)
  const wrong=structuredClone(previous);wrong.record.worldId='another-world'
  assert.throws(()=>verifyFirstForecastRecord({...ctx,previous:wrong}),/evolution_before/)
  const changed=structuredClone(after);changed.randomState.status='forged'
  const altered=Buffer.from(JSON.stringify(changed))
  assert.throws(()=>verifyFirstForecastRecord({...ctx,live:{bytes:altered,sha256:baselineSha256(altered)}}))
  const outputSize=read(base+'/run/output.json').bytes.length,originalRead=fs.readSync
  let injected=false
  const spy=t.mock.method(fs,'readSync',function(fd,b,...args){
    const size=Reflect.apply(originalRead,this,[fd,b,...args])
    if(size>0&&b.length===outputSize+1){
      const offset=b.indexOf('"modelForwards": 1')
      if(offset>=0){b[offset+'"modelForwards": '.length]=0x32;injected=true}
    }
    return size
  })
  try{assert.throws(()=>verifyFirstForecastRecord(ctx),/head_worker_original/);assert(injected)}
  finally{spy.mock.restore()}
})

test('released first-step artifacts project the genuine two-event chain; an unregistered or swapped release snapshot stays unverified',t=>{
  const dir='.runtime/ai-painter/world-first-weather-runtime/v3'
  if(!fs.existsSync(dir+'/intent.json')){t.skip('no production first step to verify');return}
  const seal=JSON.parse(fs.readFileSync(dir+'/intent.json')),prefix=r.formalStore+'.evolution/'+seal.businessKey+'.'
  if(!fs.existsSync(prefix+'receipt.json')){t.skip('first step has no committed receipt');return}
  const receipt=JSON.parse(fs.readFileSync(prefix+'receipt.json')),official=fs.readFileSync(prefix+receipt.fileSha256+'.record.json')
  const registry='data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json'
  const run=(bad,historical=false)=>{const read=(p,max)=>{
    const b=historical&&p===r.formalStore?official:fs.readFileSync(p)
    const bytes=bad&&p===registry?Buffer.from('{"releaseRecords":[]}'):b
    assert(bytes.length<=max);return {bytes,sha256:baselineSha256(bytes)}
  };return readBaselineAndCurrentHead({read,readFresh:read,projectRoot:root,deliveryId:'WORLD-BASELINE-001',readAtUtc:new Date().toISOString()},readCurrentWorldBaseline)}
  const positive=run(false)
  assert.equal(positive.currentHead?.days[0].fileSha256,receipt.fileSha256)
  assert.deepEqual([positive.currentHead.days[0].tick,positive.currentHead.days[0].stateVersion,positive.currentHead.days[0].cursor],[1,2,2])
  if(positive.currentHead.tick===3)assert.equal(run(false,true).status,'unverifiable','old first day cannot use the later terminal snapshot')
  const negative=run(true)
  assert.equal(negative.status,'unverifiable');assert.equal(negative.currentHead,undefined)
})

test('two rolling days from the real 193 clone each require a linked original Store, true model output, native receipt, and matching capacity',t=>{
  const home='.runtime/ai-painter/controller-repair-reviews/world-rolling-runtime-193-20261103/qualification'
  const world=home+'/store/'+r.world.ownerId+'/'+r.world.worldId+'.json'
  const file=(p,max=256*1024)=>{const bytes=fs.readFileSync(p);assert(bytes.length<=max);return {bytes,sha256:baselineSha256(bytes)}}
  const parse=p=>JSON.parse(file(p).bytes),budget=parse(home+'/budget.json')
  const a={mode:'qualification',dir:home,config:budget,rules:parse(home+'/policy.json'),budget:{path:home+'/budget.json',sha256:file(home+'/budget.json').sha256,bytes:file(home+'/budget.json').bytes.length},
    domain:{path:home+'/policy.json',sha256:file(home+'/policy.json').sha256},release:budget.qualification}
  // The runtime stores only path and SHA in an execution binding.
  a.release={path:a.release.path,sha256:a.release.sha256}
  const dayOneInput=parse(home+'/steps/2/input.json')
  const origKey=dayOneInput.head.businessKey,receipt=parse(world+'.evolution/'+origKey+'.receipt.json')
  const start=readCommittedHeadBundle(file,root,world,file(world+'.evolution/'+origKey+'.'+receipt.fileSha256+'.record.json'),
    parse(world+'.evolution/'+origKey+'.'+receipt.eventSha256+'.event.json').before.expectedFileSha256)
  const chain=[2,3].map(n=>{const rr=parse(home+'/steps/'+n+'/receipt.json'),event=parse(world+'.evolution/'+rr.businessKey+'.'+rr.eventSha256+'.event.json')
    return readCommittedHeadBundle(file,root,world,file(world+'.evolution/'+rr.businessKey+'.'+rr.fileSha256+'.record.json'),event.before.expectedFileSha256)})
  const passed=verifyRollingDays(root,start,chain,a)
  assert.equal(passed.days.length,2);assert.deepEqual(passed.days.map(x=>x.tick),[2,3])
  assert.deepEqual(passed.days[0].after,passed.days[1].before)
  assert.notEqual(passed.days[0].historyValueSha256,passed.days[1].historyValueSha256)
  assert.notEqual(passed.days[0].modelPid,passed.days[1].modelPid)
  const state=rollingBudgetStatus(root,a,passed.head,passed.days)
  assert.deepEqual([state.remaining,state.committed,state.reserved,state.status],[0,2,2,'exhausted_exited'])
  assert.throws(()=>verifyRollingDays(root,start,[chain[1],chain[0]],a))
  assert.throws(()=>verifyRollingDays(root,start,chain,{...a,mode:'production'}),/scope/)
  assert.throws(()=>verifyRollingDays(root,start,chain,{...a,domain:{...a.domain,sha256:'0'.repeat(64)}}),/authority/)
  const altered=structuredClone(chain[0]);altered.event.previousEventSha256='0'.repeat(64)
  assert.throws(()=>verifyRollingDays(root,start,[altered],a),/previous/)
  assert.throws(()=>rollingBudgetStatus(root,a,start,[]),/slots/,'a completed later run cannot be replayed against the earlier head')
  let corrupt=false;const originalRead=fs.readSync
  const spy=t.mock.method(fs,'readSync',function(fd,buffer,...rest){
    const n=Reflect.apply(originalRead,this,[fd,buffer,...rest]),marker=buffer.indexOf('"modelForwards": 1')
    if(n>0&&marker>=0&&buffer.length===fileSize+1){buffer[marker+'"modelForwards": '.length]=50;corrupt=true}
    return n
  })
  const fileSize=fs.statSync(home+'/steps/2/output.json').size
  try{assert.throws(()=>verifyRollingDays(root,start,chain,a),/original/);assert(corrupt)}finally{spy.mock.restore()}
})

test('an occupied but uncommitted slot preserves the previous day and an out-of-order slot fails closed',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rolling-weather-view-'))
  const dir='.runtime/ai-painter/controller-repair-reviews/world-rolling-runtime-193-20261103/qualification'
  const slots=path.join(tmp,dir,'steps')
  try{
    fs.mkdirSync(path.join(slots,'2'),{recursive:true})
    const a={mode:'qualification',dir,config:{maximumModelForwards:2}},day1={record:{tick:1}}
    const pending=rollingBudgetStatus(tmp,a,day1,[])
    assert.deepEqual([pending.status,pending.committed,pending.reserved,pending.remaining,pending.terminal],['reserved_uncommitted',0,1,1,null])
    assert.equal(day1.record.tick,1)
    fs.renameSync(path.join(slots,'2'),path.join(slots,'3'))
    assert.throws(()=>rollingBudgetStatus(tmp,a,day1,[]),/slots/)
  }finally{
    assert.equal(path.dirname(tmp),os.tmpdir());assert(path.basename(tmp).startsWith('rolling-weather-view-'))
    fs.rmSync(tmp,{recursive:true,force:true})
  }
})

test('formal scheduled ledger retains original limits, links across all charges and rejects foreign or stale heads',async()=>{
  const {checkScheduledLedger}=await import('../lib/natural-world-scheduled-head.mjs'),{DatabaseSync}=await import('node:sqlite')
  const dir='.runtime/ai-painter/world-weather-service/mvp-natural-world-001',parse=p=>JSON.parse(fs.readFileSync(p))
  const cfg=parse('data/ai-painter/system-governance/sakaerat-scheduled-weather-runtime-v5.json'),contract=parse(dir+'/accounting/contract.json'),identity=parse(dir+'/accounting/identity.json')
  const db=new DatabaseSync(dir+'/accounting/accounting.sqlite',{readOnly:true})
  let ledger
  try{db.exec('BEGIN');ledger={current:db.prepare('SELECT * FROM service').get(),slots:db.prepare('SELECT * FROM slots ORDER BY target_tick').all(),batches:db.prepare('SELECT * FROM batches ORDER BY seq').all()}}finally{db.close()}
  const {tick}=ledger.current,receipt=parse(dir+'/steps/'+tick+'/receipt.json')
  const head={record:{tick},receipt,eventSha:receipt.eventSha256,live:{sha256:receipt.fileSha256},before:{sha256:ledger.slots.at(-1).before_file},event:{previousEventSha256:ledger.slots.at(-1).before_event}}
  const inspect=(l=ledger,c=contract,m=identity,h=head)=>checkScheduledLedger({cfg},l,c,m,h)
  assert.equal(inspect().remaining,0);assert.equal(inspect().accounted,27)
  for(const change of [l=>l.slots[5].before_file='0'.repeat(64),l=>l.slots.pop(),l=>l.slots.at(-1).commit_event='0'.repeat(64),
    l=>l.current.scope='other-world',l=>l.batches.at(-1).last_tick=31]){
    const bad=structuredClone(ledger);change(bad);assert.throws(()=>inspect(bad),/head_scheduled_/)
  }
  assert.throws(()=>inspect(ledger,{...contract,maximumNewSteps:50}),/head_scheduled_/)
  assert.throws(()=>inspect(ledger,contract,identity,{...head,record:{tick:tick-1}}),/head_scheduled_/)
  const transferring=structuredClone(ledger),last=transferring.slots.at(-1),prior=transferring.slots.at(-2)
  Object.assign(last,{status:'reserved',commit_file:null,commit_event:null})
  Object.assign(transferring.current,{tick:tick-1,file_sha:prior.commit_file,event_sha:prior.commit_event})
  assert.equal(inspect(transferring).outstanding,'reserved')
  transferring.slots.at(-1).status='failed';assert.throws(()=>inspect(transferring),/head_scheduled_/)
})

test('seven dated rows independently reproduce early, middle and final scheduled inputs; substituted windows and output paths fail without a new model run',async()=>{
  const {verifyScheduledWindow}=await import('../lib/natural-world-scheduled-head.mjs'),{DatabaseSync}=await import('node:sqlite')
  const dir='.runtime/ai-painter/world-weather-service/mvp-natural-world-001',cfg=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/sakaerat-scheduled-weather-runtime-v5.json'))
  const store=r.formalStore,requests=[]
  function file(p){requests.push(p);const bytes=fs.readFileSync(p);return {bytes,sha256:baselineSha256(bytes)}}
  const read=p=>JSON.parse(file(p).bytes)
  const maintenance=readCommittedHeadBundle(file,root,store,file(head),r.before.fileSha256)
  const early=[1,2,3].map(tick=>{
    const home=tick===1?'.runtime/ai-painter/world-first-weather-runtime/v3':'.runtime/ai-painter/world-rolling-weather-runtime/v4/steps/'+tick
    const receipt=tick===1?read(store+'.evolution/'+read('.runtime/ai-painter/world-rolling-weather-runtime/v4/steps/2/input.json').head.businessKey+'.receipt.json'):read(home+'/receipt.json')
    return {tick,eventSha256:receipt.eventSha256,fileSha256:receipt.fileSha256}
  })
  const db=new DatabaseSync(dir+'/accounting/accounting.sqlite',{readOnly:true});let slots
  try{slots=db.prepare('SELECT * FROM slots ORDER BY target_tick').all()}finally{db.close()}
  const check=(input,tick)=>verifyScheduledWindow({input,tick,cfg,store,file,raw:file,ledger:{slots},early,maintenance})
  for(const tick of [4,6,7,12,30]){
    const input=read(dir+'/steps/'+tick+'/input.json');requests.length=0
    check(input,tick);assert(requests.length<=22)
    const bad=structuredClone(input);bad.rows[0].values[0]+=1
    assert.throws(()=>check(bad,tick),/head_scheduled_.*values/)
    const injected=structuredClone(input)
    injected.rows.at(-1).provenance.output.path='../unrelated-file';requests.length=0
    assert.throws(()=>check(injected,tick),/head_scheduled_history_output/);assert(!requests.includes('../unrelated-file'))
  }
})
