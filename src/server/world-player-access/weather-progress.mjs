import assert from 'node:assert/strict'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'

const ownerId='mvp-natural-owner-001',worldId='mvp-natural-world-001',playerId='mvp-natural-player-001'
const store='data/world-runtime/'+ownerId+'/'+worldId+'.json'
const service='.runtime/ai-painter/world-weather-service/'+worldId
const release='data/ai-painter/capability-releases/sakaerat-weather-153-scheduled-v5/release.json'
const registry='data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json'
const hash=b=>createHash('sha256').update(b).digest('hex'),isHash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)
const TTL=30000
let anchorCache=null,pending=null
function unavailable(){return {status:'unavailable',reason:'evidence_unavailable',day:null,validatedThroughDay:null,daysRemaining:null,
  simulationStartUtc:null,simulationEndUtc:null,verifiedAtUtc:null}}
async function registeredFile(name){
  const url=pathToFileURL(path.join(process.cwd(),'scripts','lib',name))
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url.href)
}
const dependencies=()=>Promise.all([
  registeredFile('natural-world-evolution-input.mjs'),registeredFile('natural-world-current-head-baseline.mjs'),registeredFile('natural-world-scheduled-head.mjs')
])
function grantMatches(grant,record){
 return grant?.ok===true&&grant.permission==='world.read'&&typeof grant.accountId==='string'&&grant.accountId.length>0&&grant.ownerId===ownerId&&grant.playerId===playerId&&grant.worldId===worldId&&
    record?.ownerId===grant.ownerId&&record.playerId===grant.playerId&&record.worldId===grant.worldId
}
function cappedReader(makeReader){
  const r=makeReader(process.cwd())
  return (logical,max=256*1024)=>{const bytes=r.read(logical,max);return {bytes,sha256:hash(bytes)}}
}
// The v5 origin pins a single earlier native record. Walking its three immutable
// predecessor receipts reaches the source seed without walking the world's entire history.
function originalChain(file,readBundle,cfg){
  const o=cfg.origin,archive=store+'.evolution/'
  let current=file(archive+o.businessKey+'.'+o.fileSha256+'.record.json')
  assert.equal(current.sha256,o.fileSha256)
  const early=[];let anchor
  for(let tick=o.tick;tick>=0;tick--){
    const r=JSON.parse(current.bytes),c=r.worldState.payload.environment.evolution.commit
    assert.equal(r.tick,tick);assert(isHash(c.businessKey)&&isHash(c.eventSha256))
    if(tick===o.tick){assert.equal(c.eventSha256,o.eventSha256);assert.equal(c.businessKey,o.businessKey)}
    const marker=JSON.parse(file(archive+c.businessKey+'.'+c.eventSha256+'.commit.json',65536).bytes)
    const head=readBundle(file,process.cwd(),store,current,marker.before.fileSha256)
    if(tick===o.tick)anchor=head
    if(tick===0){assert.equal(head.event.eventKind,'maintenance');assert.equal(head.event.previousEventSha256,null);return {anchor,early,maintenance:head}}
    assert.equal(head.event.eventKind,'evolution');assert.equal(head.event.fromTick,tick-1);assert.equal(head.event.toTick,tick)
    assert.equal(head.event.previousEventSha256,JSON.parse(head.before.bytes).worldState.payload.environment.evolution.commit.eventSha256)
    early.push({tick,eventSha256:head.eventSha,fileSha256:current.sha256});current=head.before
  }
  throw Error('weather origin missing')
}
function maybe(file,p,max){try{return file(p,max).sha256}catch(e){if(e.code==='ENOENT')return 'absent';throw e}}
function chainForSnapshot(file,readBundle,cfg,now){
  const key=cfg.version+'|'+cfg.identity.worldId+'|'+cfg.origin.fileSha256
  if(anchorCache&&key===anchorCache.key&&now>=anchorCache.at&&now-anchorCache.at<TTL){
    for(const [p,max,sha] of anchorCache.files)assert.equal(file(p,max).sha256,sha,'immutable source anchor differs')
    return anchorCache.chain
  }
  const files=[]
  const chain=originalChain((p,max=256*1024)=>{const r=file(p,max);files.push([p,max,r.sha256]);return r},readBundle,cfg)
  anchorCache={key,at:now,files,chain};return chain
}
function revision(file,r,sha){
  const evo=r.worldState.payload.environment.evolution,c=evo.commit
  assert(isHash(c.businessKey)&&isHash(c.eventSha256))
  const dir=store+'.evolution/'+c.businessKey+'.',step=service+'/steps/'+r.tick+'/'
  const keys=[sha,file(registry,1024*1024).sha256,file(release,256*1024).sha256,
    file(dir+c.eventSha256+'.commit.json',65536).sha256,file(dir+c.eventSha256+'.event.json',65536).sha256,file(dir+'receipt.json',65536).sha256,
    file(step+'input.json',128*1024).sha256,file(step+'output.json',8192).sha256,file(step+'process.json',65536).sha256,maybe(file,step+'receipt.json',65536),
    file(service+'/accounting/accounting.sqlite',4*1024*1024).sha256,maybe(file,service+'/accounting/accounting.sqlite-wal',4*1024*1024)]
  assert.equal(maybe(file,store+'.transaction.json',65536),'absent','in-flight state cannot be projected as the current committed weather')
  // Absolute bounded original v5 activation count. The production cap and actual
  // phases are revalidated by projectScheduledHead; none of these names originate in the request.
  for(let i=14;i>=1;i--){
    const a=maybe(file,service+'/activation-'+i+'.json',65536)
    if(a==='absent')continue
    keys.push(a,maybe(file,service+'/session-'+i+'.json',65536),maybe(file,service+'/completed-'+i+'.json',65536),maybe(file,service+'/stopped-'+i+'.json',65536),
      maybe(file,service+'/launches/scheduled-weather-v5-production-'+i+'/background-process-terminal.json',65536));break
  }
  return hash(JSON.stringify(keys))
}
/** Accept only the actual grant and Store record read by the player view; return a player-safe projection, never a weather command. */
async function project(record,fileSha256){
  try{
    const [{createEvolutionInputReader},{readCommittedHeadBundle},{scheduledAuthority,projectScheduledHead}]=await dependencies()
    const file=cappedReader(createEvolutionInputReader),live=file(store)
    assert.equal(live.sha256,fileSha256);assert.deepEqual(JSON.parse(live.bytes),record,'wrong or stale player Store snapshot')
    assert(record.tick>=4&&record.stateVersion===record.tick+1&&record.eventCursor===record.tick+1)
    const key=revision(file,record,fileSha256),now=Date.now()
    const a=scheduledAuthority(process.cwd(),file),chain=chainForSnapshot(file,readCommittedHeadBundle,a.cfg,now)
    const {scheduled,head}=projectScheduledHead({root:process.cwd(),store,live,file,readBundle:readCommittedHeadBundle,...chain,a})
    assert.equal(head.live.sha256,fileSha256);assert.equal(head.receipt.tick,record.tick)
    const last=cappedReader(createEvolutionInputReader)
    assert.equal(last(store).sha256,fileSha256);assert.equal(revision(last,record,fileSha256),key)
    const done=scheduled.status==='completed_exhausted'&&scheduled.serverExit?.code===0,stopped=scheduled.status==='stopped'
    // An outstanding accounting slot alone does not establish that the service is alive.
    if(!done&&!stopped)return unavailable()
    const at=Date.now(),v={status:done?'exhausted':stopped?'stopped':'ongoing',reason:done?'validated_horizon_exhausted':stopped?'service_stopped':'within_bound',
      day:record.tick,validatedThroughDay:a.cfg.validatedForecastDays,daysRemaining:scheduled.remainingDays,simulationStartUtc:a.cfg.originalCutoffUtc,
      simulationEndUtc:head.epoch,verifiedAtUtc:new Date(at).toISOString()}
    return v
  }catch{return unavailable()}
}
export async function readNaturalPlayerWeatherProgress(grant,{record,fileSha256}={}){
  if(!grantMatches(grant,record)||!isHash(fileSha256))return unavailable()
  let key
  try{key=[grant.ownerId,grant.playerId,grant.worldId,fileSha256,hash(JSON.stringify(record))].join('|')}catch{return unavailable()}
  if(pending?.key===key)return {...await pending.read}
  const read=project(record,fileSha256);pending={key,read}
  try{return {...await read}}finally{if(pending?.read===read)pending=null}
}
