import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {decodeNaturalWorldRuntimeRecord,assertNaturalWorldReadInput,assertNaturalWorldReadMatch} from '../runtime/world-runtime-record-validation.ts'
import {isPointInPolygon} from '../spatial/spatial-geometry.ts'
import {polygonBounds,rectWithinBounds} from './game-map-geometry.ts'
import {baselineDigest} from '../../../scripts/lib/natural-world-baseline-proof.mjs'

const width=1024,height=768
const canvas={x:0,y:0,width,height}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)
const idFields=['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId']
const terrainChannels={grass:'terrain_grass',path_ground:'terrain_path_ground',water:'terrain_water',shoreline:'terrain_shoreline',
  tall_grass:'terrain_tall_grass',mud_patch:'terrain_mud_patch',natural_boundary:'terrain_natural_boundary'}

function resolvePixel(point){
  assert(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),'invalid spatial coordinate')
  if(point.space==='normalized'){
    assert(point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1,'normalized point outside canvas')
    return {x:Math.min(width-1,Math.floor(point.x*width)),y:Math.min(height-1,Math.floor(point.y*height))}
  }
  assert(point.space==='native'&&Number.isInteger(point.x)&&Number.isInteger(point.y)&&
    point.x>=0&&point.x<width&&point.y>=0&&point.y<height,'native point outside canvas')
  return {x:point.x,y:point.y}
}

function indexRegions(rows,terrain=false){
  const ids=new Set()
  return rows.map(row=>{
    assert(typeof row.sourceId==='string'&&row.sourceId.length&&!ids.has(row.sourceId),'invalid or repeated region identity');ids.add(row.sourceId)
    assert(Array.isArray(row.polygon)&&row.polygon.length>=3&&row.polygon.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)),'invalid world polygon')
    if(terrain)assert(Object.hasOwn(terrainChannels,row.kind),'unsupported terrain kind')
    return {sourceId:row.sourceId,kind:row.kind,bounds:polygonBounds(row.polygon),polygon:{points:row.polygon}}
  })
}
function hits(regions,point){
  return regions.filter(r=>point.x>=r.bounds.x&&point.x<=r.bounds.x+r.bounds.width&&point.y>=r.bounds.y&&point.y<=r.bounds.y+r.bounds.height&&isPointInPolygon(point,r.polygon))
}
function contains(rect,p){
  return p.x>=rect.x&&p.x<rect.x+rect.width&&p.y>=rect.y&&p.y<rect.y+rect.height
}

/**
 * The caller obtains expected from an authorized current Store read plus its
 * verified live descriptor. This function authenticates their bytes and evaluates
 * their geometry only. It neither authenticates players nor authorizes frames.
 * A cached query requires the caller's current snapshot identity on each hit.
 */
export function createNaturalWorldSpatialQuery({storeBytes,descriptorBytes,expected}){
  assert(Buffer.isBuffer(storeBytes)&&Buffer.isBuffer(descriptorBytes)&&descriptorBytes.length<=256*1024,'expected bounded original bytes')
  const {record,fileSha256}=decodeNaturalWorldRuntimeRecord(storeBytes)
  const descriptorSha256=sha(descriptorBytes),descriptor=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(descriptorBytes))
  const identity=Object.fromEntries(idFields.map(k=>[k,record[k]]))
  assert(expected&&expected.identity&&idFields.every(k=>typeof expected.identity[k]==='string'&&expected.identity[k].length),'expected full world identity')
  assert.deepEqual(identity,expected.identity,'foreign authenticated world');assert.deepEqual(descriptor.identity,identity)
  const request={ownerId:expected.identity.ownerId,worldId:expected.identity.worldId,expectedPlayerId:expected.identity.playerId,
    expectedTick:expected.tick,expectedStateVersion:expected.stateVersion,expectedFileSha256:expected.storeFileSha256}
  assertNaturalWorldReadInput(request);assertNaturalWorldReadMatch(record,request,fileSha256)
  assert.deepEqual([expected.tick,expected.stateVersion,expected.eventCursor,expected.storeFileSha256,expected.descriptorSha256],
    [record.tick,record.stateVersion,record.eventCursor,fileSha256,descriptorSha256],'stale world or descriptor identity')
  assert.equal(descriptor.schemaVersion,'natural-world-live-map-input-v1');assert.equal(descriptor.stage,2)
  assert.equal(descriptor.head.path,'data/world-runtime/'+identity.ownerId+'/'+identity.worldId+'.json')
  const logicalTime=Date.parse(record.worldState.payload.environment.evolution.logicalEndUtc)
  assert(Number.isFinite(logicalTime)&&Date.parse(descriptor.logicalEndUtc)===logicalTime,'descriptor logical time differs')
  assert.deepEqual(descriptor.nativeShape,[1,23,height,width]);assert.equal(descriptor.channels.length,23)
  assert(new Set(descriptor.channels.map(c=>c.id)).size===23&&descriptor.channels.every(c=>digest(c.sha256)&&digest(c.pixelSha256)),'invalid spatial channel bindings')
  assert.deepEqual([descriptor.tick,descriptor.stateVersion,descriptor.eventCursor,descriptor.head.sha256,descriptor.factHash,descriptor.statePayloadSha256,descriptor.recordContentSha256],
    [record.tick,record.stateVersion,record.eventCursor,fileSha256,record.worldFactsPayloadSha256,record.statePayloadSha256,record.recordContentSha256],'descriptor does not describe the Store snapshot')
  const facts=record.worldFacts.payload,states=record.worldState.payload.objects
  assert.equal(descriptor.geometrySha256,baselineDigest(facts),'descriptor geometry differs')
  const {terrainRegions,walkableRegions,collisionRegions,objectFootprints}=facts
  const terrains=indexRegions(terrainRegions,true),walkable=indexRegions(walkableRegions),collisions=indexRegions(collisionRegions)
  const channels=new Set(descriptor.channels.map(c=>c.id))
  for(const id of ['walkable','collision','object_instance',...terrains.map(t=>terrainChannels[t.kind])])assert(channels.has(id),'missing map query channel '+id)
  assert(objectFootprints.length<=254&&states.length===objectFootprints.length,'incomplete world object state')
  const byId=new Map(states.map(item=>[item.objectId,item]))
  const table=objectFootprints.map(({objectId,kind,footprint,blocksMovement},i)=>{
    assert(typeof objectId==='string'&&objectId.length>0&&typeof kind==='string'&&typeof blocksMovement==='boolean'&&
      [footprint.x,footprint.y,footprint.width,footprint.height].every(Number.isSafeInteger)&&footprint.width>0&&footprint.height>0&&rectWithinBounds(footprint,canvas),'invalid object footprint')
    const state=byId.get(objectId)
    assert(state&&state.kind===kind&&state.blocksMovement===blocksMovement,'missing or different state object');assert.deepEqual(state.footprint,footprint)
    return {value:i+1,objectId,kind,footprint,blocksMovement}
  })
  assert(new Set(table.map(o=>o.objectId)).size===table.length&&byId.size===table.length,'duplicate state or world object')
  assert.deepEqual(descriptor.objectInstanceTable,table,'descriptor instances differ from WorldFacts order')
  const stamp={identity,tick:record.tick,stateVersion:record.stateVersion,eventCursor:record.eventCursor,storeFileSha256:fileSha256,descriptorSha256}
  function query(point,current,expectedObjectId=undefined){
    assert.deepEqual(current,stamp,'spatial query belongs to another world or stale snapshot')
    const pixel=resolvePixel(point),center={x:pixel.x+0.5,y:pixel.y+0.5}
    const terrain=hits(terrains,center).map(t=>({sourceId:t.sourceId,kind:t.kind,channel:terrainChannels[t.kind]}))
    const walkableRegionIds=hits(walkable,center).map(r=>r.sourceId),collisionRegionIds=hits(collisions,center).map(r=>r.sourceId)
    // Rect membership matches the binary footprint mask; the original instance
    // raster writes in array order so the last hit owns its single encoded byte.
    const objectHits=table.filter(o=>contains(o.footprint,center)).map(o=>({...o,footprint:{...o.footprint},
      stateRef:{objectId:o.objectId,statePayloadSha256:record.statePayloadSha256}}))
    if(expectedObjectId!==undefined){
      assert(typeof expectedObjectId==='string'&&byId.has(expectedObjectId),'unknown world object')
      assert(objectHits.some(o=>o.objectId===expectedObjectId),'registered object is outside selected pixel')
    }
    const movement=collisionRegionIds.length?'blocked_by_collision':walkableRegionIds.length?'walkable_here':'outside_walkable_region'
    return {snapshot:structuredClone(stamp),pixel,pixelCenter:center,terrain,walkableRegionIds,collisionRegionIds,
      movement,onPathGround:terrain.some(t=>t.kind==='path_ground'),objects:objectHits,instanceValue:objectHits.at(-1)?.value??0}
  }
  return {snapshot:structuredClone(stamp),nativeCanvas:{width,height,origin:'top_left',xAxis:'right',yAxis:'down'},
    counts:{terrainRegions:terrains.length,walkableRegions:walkable.length,collisionRegions:collisions.length,objects:table.length},query}
}
