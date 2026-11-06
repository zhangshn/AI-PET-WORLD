import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {isGameMapFrame} from './game-map-frame-schema.ts'
import {bindAiPainterCandidateVisualLayer} from './game-map-visual-layer-binding.ts'
import {createNaturalWorldSpatialQuery} from './natural-world-spatial-query.mjs'
import {baselineDigest as digest} from '../../../scripts/lib/natural-world-baseline-proof.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex')
const noVisual={status:'not_generated',source:'none',approvedFrameId:null,candidateId:null,imageSha256:null,imageWidth:null,imageHeight:null,imageFormat:null}
const regions=(rows,kind)=>rows.map(r=>({id:(kind??r.kind)+'-'+r.sourceId,sourceId:r.sourceId,kind:kind??r.kind,polygon:r.polygon}))
export function staleNaturalMap(){
  return Object.assign(new Error('current natural map snapshot changed'),{code:'stale_natural_map_snapshot'})
}

// This consumes verified private render output. The Runtime publish gate is separate.
export function assembleNaturalCurrentFrame({storeBytes,descriptorBytes,snapshot,candidate,imageBytes,assertCurrent}){
  assert(typeof assertCurrent==='function','current source guard required')
  const queryMap=createNaturalWorldSpatialQuery({storeBytes,descriptorBytes,expected:snapshot})
  const record=JSON.parse(storeBytes),descriptor=JSON.parse(descriptorBytes),facts=record.worldFacts.payload
  assert.deepEqual(candidate.world,snapshot.identity);assert.deepEqual([candidate.tick,candidate.stateVersion,candidate.eventCursor],[snapshot.tick,snapshot.stateVersion,snapshot.eventCursor])
  assert.equal(candidate.store.sha256,snapshot.storeFileSha256);assert.equal(candidate.descriptor.sha256,snapshot.descriptorSha256)
  assert.equal(candidate.status,'current_native_candidate_unpublished');assert.equal(candidate.published,false)
  const pixels=Buffer.from(imageBytes),imageSha256=sha(pixels)
  assert.equal(imageSha256,candidate.artifacts['native-rgb.png'].sha256)
  const image={sha256:imageSha256,pixelSha256:candidate.pixelSha256,width:1024,height:768}
  const token=digest({world:snapshot,candidate:candidate.key,imageSha256:image.sha256,pixels:image.pixelSha256,geometrySha256:descriptor.geometrySha256})
  const {worldId,ownerId}=snapshot.identity
  const terrain=regions(facts.terrainRegions),walkable=regions(facts.walkableRegions,'walkable_area'),collision=regions(facts.collisionRegions,'blocked_area')
  const objects=facts.objectFootprints.map(o=>({id:'object-'+o.objectId,sourceObjectId:o.objectId,kind:o.kind,
    position:{x:o.footprint.x+o.footprint.width/2,y:o.footprint.y+o.footprint.height/2},footprint:o.footprint,blocksMovement:o.blocksMovement}))
  const interactions=objects.map(o=>({id:'inspect-'+o.sourceObjectId,sourceObjectId:o.sourceObjectId,kind:'inspect',bounds:o.footprint}))
  const sourceFactIds=[...new Set([...terrain,...walkable,...collision].map(r=>r.sourceId).concat(objects.map(o=>o.sourceObjectId)))]
  const env=record.worldState.payload.environment.evolution,weather=env.weather
  const state={tick:record.tick,stateVersion:record.stateVersion,eventCursor:record.eventCursor,logicalEndUtc:env.logicalEndUtc,
    ruleVersion:record.ruleVersion,worldFactsPayloadSha256:record.worldFactsPayloadSha256,statePayloadSha256:record.statePayloadSha256,recordContentSha256:record.recordContentSha256,
    weather:{fields:weather.fieldOrder,units:weather.units,values:weather.values,origin:weather.origin},event:{businessKey:env.commit.businessKey,eventSha256:env.commit.eventSha256}}
  const structureId='natural-structure-'+descriptor.geometrySha256
  const unbound={schemaVersion:'game-map-frame-v1',frameId:'natural-game-frame-'+token,structureId,worldId,ownerId,tick:snapshot.tick,sourceFactIds,
    terrainLayer:{regions:terrain},objectLayer:{objects},walkableLayer:{regions:walkable},collisionLayer:{regions:collision,blockedObjectIds:objects.filter(o=>o.blocksMovement).map(o=>o.sourceObjectId)},
    interactionLayer:{items:interactions},runtimeLayer:{phase:'natural_home_static_mvp',stateRefs:['world:'+worldId,'tick:'+snapshot.tick,'structure:'+structureId,
      'store:'+snapshot.storeFileSha256,'worldFacts:'+state.worldFactsPayloadSha256,'worldState:'+state.statePayloadSha256,'stateVersion:'+snapshot.stateVersion,'eventCursor:'+snapshot.eventCursor,
      'event:'+state.event.eventSha256,'logicalEndUtc:'+state.logicalEndUtc]},visualLayer:noVisual,tags:['game_map_frame','natural_home_mvp','world_facts_first','current_authenticated_snapshot']}
  const binding=bindAiPainterCandidateVisualLayer({frame:unbound,candidate:{candidateId:candidate.key,sourceKind:'project_model_generated',imageFormat:'png',width:image.width,
    height:image.height,sourceFactIds,canShowToPlayer:false},expectedWorldId:worldId,expectedTick:snapshot.tick,expectedSourceFactIds:sourceFactIds})
  assert.equal(binding.status,'candidate_bound')
  const frame={...binding.frame,visualLayer:{...binding.frame.visualLayer,imageSha256:image.sha256}}
  assert(isGameMapFrame(frame));assert.equal(frame.visualLayer.status,'candidate');assert(!Object.hasOwn(frame.visualLayer,'imageUrl'))
  const sourceSnapshot=structuredClone(snapshot)
  function query(point,expectedObjectId){
    assertCurrent()
    const hit=queryMap.query(point,sourceSnapshot,expectedObjectId)
    const ids=new Set(hit.objects.map(o=>o.objectId))
    return {...hit,interactions:structuredClone(interactions.filter(i=>ids.has(i.sourceObjectId)))}
  }
  assertCurrent()
  return {token,frame:structuredClone(frame),snapshot:structuredClone(sourceSnapshot),dimensions:{width:1024,height:768},image,
    condition:{geometrySha256:descriptor.geometrySha256,channels:descriptor.channels.map(({id,sha256,pixelSha256})=>({id,sha256,pixelSha256}))},
    state:structuredClone(state),query,assertCurrent,readImage(){assertCurrent();return Buffer.from(pixels)}}
}
