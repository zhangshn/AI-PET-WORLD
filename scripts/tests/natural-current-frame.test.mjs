import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {isGameMapFrame} from '../../src/world/game-map-frame/game-map-frame-schema.ts'
import {assembleNaturalCurrentFrame,staleNaturalMap} from '../../src/world/game-map-frame/natural-current-frame.mjs'
import {readCurrentNaturalFrameCandidate} from '../lib/natural-current-frame-source.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')

test('normal current-frame entry binds genuine layers and opaque pixels to matching committed state without public approval',async()=>{
 const v=await readCurrentNaturalFrameCandidate(),r=JSON.parse(fs.readFileSync(v.sources.store.path)),f=r.worldFacts.payload,frame=v.frame
 assert(isGameMapFrame(frame));assert.equal(v.token,frame.frameId.slice('natural-game-frame-'.length))
 assert.equal(frame.worldId,r.worldId);assert.equal(frame.tick,r.tick);assert.equal(v.state.stateVersion,r.stateVersion);assert.equal(v.state.eventCursor,r.eventCursor)
 assert.equal(v.condition.channels.length,23);assert.equal(v.state.statePayloadSha256,r.statePayloadSha256);assert.equal(v.state.event.eventSha256,r.worldState.payload.environment.evolution.commit.eventSha256)
 for(const [actual,src] of [[frame.terrainLayer.regions,f.terrainRegions],[frame.walkableLayer.regions,f.walkableRegions],[frame.collisionLayer.regions,f.collisionRegions]])
  assert.deepEqual(actual.map(x=>[x.sourceId,x.polygon]),src.map(x=>[x.sourceId,x.polygon]))
 assert.deepEqual(frame.objectLayer.objects.map(x=>x.sourceObjectId),f.objectFootprints.map(o=>o.objectId))
 assert.deepEqual(frame.collisionLayer.blockedObjectIds,f.objectFootprints.filter(o=>o.blocksMovement).map(o=>o.objectId))
 assert.equal(frame.interactionLayer.items.length,f.objectFootprints.length)
 for(const [i,o] of f.objectFootprints.entries()){
   const item=frame.interactionLayer.items[i];assert.equal(item.kind,'inspect');assert.equal(item.sourceObjectId,o.objectId);assert.deepEqual(item.bounds,o.footprint)
 }
 const buf=v.readImage();assert.equal(v.image.sha256,hash(buf));buf[0]=0;assert.equal(hash(v.readImage()),v.image.sha256)
 assert.equal(frame.visualLayer.status,'candidate');assert.equal(frame.visualLayer.approvedFrameId,null);assert(!Object.hasOwn(frame.visualLayer,'imageUrl'))
 assert.equal(frame.visualLayer.imageSha256,v.image.sha256);assert.deepEqual(v.dimensions,{width:1024,height:768})
 const rock=f.objectFootprints.find(o=>o.kind==='rock'),p={space:'native',x:rock.footprint.x+1,y:rock.footprint.y+1}
 assert.equal(v.query(p,rock.objectId).interactions[0].sourceObjectId,rock.objectId);assert.throws(()=>v.query(p,'invented'))
 assert.deepEqual(v.query({x:(p.x+.5)/1024,y:(p.y+.5)/768,space:'normalized'}).pixel,{x:p.x,y:p.y})
})
test('current token is content-bound, and the normal reader has no old-head or private path selector',async()=>{
 const v=await readCurrentNaturalFrameCandidate()
 assert.equal((await readCurrentNaturalFrameCandidate({expectedToken:v.token})).token,v.token)
 for(const t of ['a'.repeat(64),'../private',''])await assert.rejects(()=>readCurrentNaturalFrameCandidate({expectedToken:t}),{code:'stale_natural_map_snapshot'})
})
test('independent stale/tampered store, descriptor, candidate and raster inputs fail before a frame is assembled',async()=>{
 const actual=await readCurrentNaturalFrameCandidate(),original={
    storeBytes:fs.readFileSync(actual.sources.store.path),descriptorBytes:fs.readFileSync(actual.sources.descriptor.path),
    snapshot:actual.snapshot,candidate:JSON.parse(fs.readFileSync(actual.sources.candidate.path)),imageBytes:actual.readImage(),assertCurrent:()=>{}}
 for(const kind of ['wrong-world','old-visual-tick','wrong-state','different-condition','old-record','different-raster','self-approved']){
   const src={...original,snapshot:structuredClone(original.snapshot),candidate:structuredClone(original.candidate)}
   if(kind==='wrong-world')src.candidate.world.worldId='foreign'
   if(kind==='old-visual-tick')src.candidate.tick--
   if(kind==='wrong-state')src.snapshot.stateVersion--
   if(kind==='different-condition')src.descriptorBytes=Buffer.from(src.descriptorBytes.toString()+' ')
   if(kind==='old-record')src.storeBytes=Buffer.concat([src.storeBytes,Buffer.from(' ')])
   if(kind==='different-raster'){src.imageBytes=Buffer.from(src.imageBytes);src.imageBytes[0]^=1}
   if(kind==='self-approved')src.candidate.published=true
   assert.throws(()=>assembleNaturalCurrentFrame(src),undefined,kind)
 }
 let current=true
 const local=assembleNaturalCurrentFrame({...original,assertCurrent(){if(!current)throw staleNaturalMap()}})
 local.frame.interactionLayer.items.length=0;assert(local.query({x:637,y:267,space:'native'}).interactions.length>0)
 current=false;assert.throws(()=>local.readImage(),{code:'stale_natural_map_snapshot'});assert.throws(()=>local.query({x:1,y:1,space:'native'}),{code:'stale_natural_map_snapshot'})
})
