import {runtimeWorkingDirectory} from '../../../scripts/lib/runtime-working-directory.mjs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const hex=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s)
const text=s=>typeof s==='string'&&s.length>0&&s.length<=200
function problem(code,status){return Object.assign(Error(code),{code,status})}
function need(ok){if(!ok)throw problem('natural_map_source_unavailable',503)}
export function parseNaturalMapReview(url){
  const p=new URL(url).searchParams,keys=[...p.keys()]
  if(!keys.length)return {kind:'summary'}
  if(new Set(keys).size!==keys.length||!hex(p.get('token')))throw problem('invalid_natural_map_query',400)
  const token=p.get('token')
  if(keys.length===2&&p.get('image')==='1')return {kind:'image',token}
  if(keys.length!==3||!p.has('x')||!p.has('y'))throw problem('invalid_natural_map_query',400)
  const axis=(k,max)=>{const v=p.get(k);if(!/^(0|[1-9]\d{0,3})$/.test(v)||Number(v)>=max)throw problem('invalid_natural_map_coordinate',400);return Number(v)}
  return {kind:'point',token,x:axis('x',1024),y:axis('y',768)}
}
export function safeMapSummary(frame){
  const s=frame.snapshot,d=frame.dimensions,i=frame.image
  need(hex(frame.token)&&d.width===1024&&d.height===768&&i.width===d.width&&i.height===d.height&&hex(i.sha256)&&text(s.identity.worldId))
  need([s.tick,s.stateVersion,s.eventCursor].every(n=>Number.isSafeInteger(n)&&n>=0))
  return {scope:'local_candidate_review',token:frame.token,worldId:s.identity.worldId,tick:s.tick,stateVersion:s.stateVersion,eventCursor:s.eventCursor,
    width:d.width,height:d.height,imageSha256:i.sha256}
}
function list(values,limit,map){need(Array.isArray(values)&&values.length<=limit);return values.map(map)}
function id(value){need(text(value));return value}
export function safeMapPoint(hit,expected){
  need(hit?.pixel?.x===expected.x&&hit.pixel.y===expected.y&&['walkable_here','blocked_by_collision','outside_walkable_region'].includes(hit.movement))
  return {pixel:{x:hit.pixel.x,y:hit.pixel.y},movement:hit.movement,onPathGround:hit.onPathGround===true,
    terrain:list(hit.terrain,64,r=>({kind:id(r.kind),sourceId:id(r.sourceId)})),
    walkableRegionIds:list(hit.walkableRegionIds,64,id),collisionRegionIds:list(hit.collisionRegionIds,128,id),
    objects:list(hit.objects,128,o=>{const f=o.footprint;need(typeof o.blocksMovement==='boolean'&&f&&[f.x,f.y,f.width,f.height].every(Number.isFinite)&&f.width>0&&f.height>0)
      return {id:id(o.objectId),kind:id(o.kind),blocksMovement:o.blocksMovement,footprint:{x:f.x,y:f.y,width:f.width,height:f.height}}})}
}
// Load source with its original Node filesystem identity (the Store verifies original paths).
// Only the fixed server module is executable. Request values never select an import or file.
function loadOriginal(filename){
  const absolute=path.join(runtimeWorkingDirectory(),'scripts','lib',filename),url=pathToFileURL(absolute)
  url.searchParams.set('revision',createHash('sha256').update(readFileSync(absolute)).digest('hex'))
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url.href)
}
async function auditSummary(frame){
  try{
    const {readNaturalFrameAudit}=await loadOriginal('natural-current-frame-review.mjs'),report=readNaturalFrameAudit(frame)
    if(!report)return null
    need(report.token===frame.token&&report.worldId===frame.snapshot.identity.worldId&&report.tick===frame.snapshot.tick&&
      report.stateVersion===frame.snapshot.stateVersion&&report.eventCursor===frame.snapshot.eventCursor&&report.releaseEligible===false)
    const statuses=['passed','failed','not_qualified','not_applicable']
    need(statuses.includes(report.status))
    return {status:report.status,gates:list(report.gates,64,g=>{
      need(statuses.includes(g.status))
      const data={id:id(g.id),status:g.status,summary:id(g.summary),repair:g.repair?id(g.repair):null}
      if(g.id==='style_fingerprint'){
        const m=g.measurements?.metrics;need(Number.isFinite(m?.nearestApprovedDistance)&&Number.isFinite(m?.approvedEnvelopeRadius))
        data.styleDistance={actual:m.nearestApprovedDistance,maximum:m.approvedEnvelopeRadius}
      }
      return data
    })}
  }catch{return {status:'unavailable',gates:[]}}
}
let retained=null,reading=null
export async function naturalMapReview(query){
  try{
    if(retained){
      try{await retained.assertCurrent()}catch(e){const old=retained;retained=null;if(e?.code==='stale_natural_map_snapshot'&&query.token===old?.token)throw e}
    }
    if(!retained){
      if(!reading)reading=loadOriginal('natural-current-frame-source.mjs')
        .then(m=>m.readCurrentNaturalFrameCandidate()).finally(()=>{reading=null})
      retained=await reading
    }
    const frame=retained
    if(query.token&&frame.token!==query.token)throw problem('stale_natural_map_snapshot',409)
    let result
    if(query.kind==='summary')result={...safeMapSummary(frame),audit:await auditSummary(frame)}
    else if(query.kind==='point')result={token:frame.token,...safeMapPoint(await frame.query({space:'native',x:query.x,y:query.y}),query)}
    else if(query.kind==='image'){
      const data=await frame.readImage();need(Buffer.isBuffer(data)&&data.length>0&&data.length<=4*1024*1024)
      result={bytes:data,sha256:frame.image.sha256}
    }else throw problem('invalid_natural_map_query',400)
    await frame.assertCurrent();return result
  }catch(e){
    if(e?.code==='stale_natural_map_snapshot')throw problem('stale_natural_map_snapshot',409)
    if(e?.code==='current_natural_map_candidate_missing')throw problem(query.token?'stale_natural_map_snapshot':'current_natural_map_candidate_missing',query.token?409:404)
    if(e?.status===400)throw e
    console.error('[natural-map-review] candidate integrity/read error',e)
    retained=null;throw problem('natural_map_source_unavailable',503)
  }
}
