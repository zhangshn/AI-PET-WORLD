import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'

const identityFields=['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId']
const nativeDimensions=[1,23,768,1024]
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)

// This compares inputs after their original Store, descriptor and channel bytes have been read
// and verified. Its result cannot grant visual model release, image publication or client access.
function source(record,fileSha256,descriptor,descriptorSha256){
  assert(hex(fileSha256)&&hex(descriptorSha256),'bound record and descriptor required')
  const live=descriptor.schemaVersion==='natural-world-live-map-input-v1'
  assert(live||descriptor.schemaVersion==='natural-world-current-visual-input-v1','unknown natural input descriptor')
  const world=Object.fromEntries(identityFields.map(k=>[k,record[k]]))
  for(const k of identityFields)assert(typeof world[k]==='string'&&world[k].length>0)
  assert.deepEqual(descriptor.identity,world)
  assert.equal((live?descriptor.head:descriptor.store).sha256,fileSha256,'foreign save for visual condition')
  const clock=record.worldState.payload.environment.evolution
  assert.equal(Date.parse(descriptor.logicalEndUtc),Date.parse(clock.logicalEndUtc))
  assert(Number.isFinite(Date.parse(clock.logicalEndUtc))&&typeof record.ruleVersion==='string'&&record.ruleVersion.length>0)
  for(const k of ['tick','stateVersion','eventCursor']){
    assert(Number.isSafeInteger(record[k])&&record[k]>=0);assert.equal(descriptor[k],record[k])
  }
  for(const [k,key] of [['factHash','worldFactsPayloadSha256'],['statePayloadSha256','statePayloadSha256'],['recordContentSha256','recordContentSha256']]){
    assert(hex(record[key]));assert.equal(descriptor[k],record[key])
  }
  assert.equal(descriptor.stage,2)
  assert.deepEqual(live?descriptor.nativeShape:[1,descriptor.channels.length,descriptor.height,descriptor.width],nativeDimensions)
  assert.equal(descriptor.channels.length,23);assert.equal(new Set(descriptor.channels.map(c=>c.id)).size,23)
  for(const c of descriptor.channels)assert(typeof c.id==='string'&&hex(c.sha256)&&hex(c.pixelSha256))
  assert(Array.isArray(descriptor.objectInstanceTable)&&hex(descriptor.geometrySha256))
  const contract=live?descriptor.contract:descriptor.conditionContract
  assert(typeof contract.path==='string'&&hex(contract.sha256))
  return {...world,ruleVersion:record.ruleVersion,tick:record.tick,stateVersion:record.stateVersion,eventCursor:record.eventCursor,
    logicalEndUtc:new Date(clock.logicalEndUtc).toISOString(),storeFileSha256:fileSha256,factHash:record.worldFactsPayloadSha256,
    statePayloadSha256:record.statePayloadSha256,recordContentSha256:record.recordContentSha256,descriptorSha256,
    geometrySha256:descriptor.geometrySha256,conditionContract:{path:contract.path,sha256:contract.sha256},
    channels:descriptor.channels.map(({id,sha256,pixelSha256})=>({id,sha256,pixelSha256})),objects:descriptor.objectInstanceTable}
}

export function compareNaturalFrameSourceSnapshots(current,rendered){
  const fields=x=>source(x.record,x.fileSha256,x.descriptor,x.descriptorSha256)
  const target=fields(current),actual=fields(rendered)
  const mismatched=Object.keys(target).filter(k=>!isDeepStrictEqual(target[k],actual[k]))
  return {sameSnapshot:mismatched.length===0,mismatched}
}

// The current native Painter's recorded export is opaque 8-bit RGB PNG. Check the file
// bytes and the actually decoded RGB buffer, independently of a suffix, tags or metadata.
export async function inspectNaturalFrameRgbPng(bytes,expectedFileSha256,expectedPixelSha256){
  assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=4*1024*1024)
  assert(hex(expectedFileSha256)&&hex(expectedPixelSha256))
  const digest=b=>createHash('sha256').update(b).digest('hex')
  assert.equal(digest(bytes),expectedFileSha256,'frame file bytes differ')
  const {default:sharp}=await import('sharp'),image=sharp(bytes,{limitInputPixels:1024*768,failOn:'error'})
  const m=await image.metadata()
  assert.deepEqual([m.format,m.width,m.height,m.channels,m.depth,m.hasAlpha],['png',1024,768,3,'uchar',false],'native RGB geometry or encoding differs')
  const decoded=await image.raw().toBuffer()
  assert.equal(decoded.length,1024*768*3)
  assert.equal(digest(decoded),expectedPixelSha256,'frame decoded pixels differ')
  return {format:m.format,width:m.width,height:m.height,fileSha256:expectedFileSha256,pixelSha256:expectedPixelSha256}
}
