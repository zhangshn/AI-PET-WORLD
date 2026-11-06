import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {createNaturalWorldSpatialQuery} from '../../src/world/game-map-frame/natural-world-spatial-query.mjs'
import {sealNaturalWorldRuntimeRecord} from '../../src/world/runtime/world-runtime-record-validation.ts'
import {baselineDigest} from '../lib/natural-world-baseline-proof.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex')
const worldId='mvp-natural-world-001',ownerId='mvp-natural-owner-001',live='data/world-runtime/'+ownerId+'/'+worldId+'.json'
const bytesSha='690f3ae2d6882391323fa8403e9c2a27ccb6a718de758619aedd7e5941f58b6f',descriptorSha='2749e67a14c79590dcc0ae2ca6e782e344a00d25eab47b181eb8bcc93a32985a'
const day=live+'.evolution/99c5e7de49c116f0f635b22ce0bf2740b5a8c28eef4fb1f7ba197636bb905e81.'+bytesSha+'.record.json'
const storeBytes=fs.readFileSync(day),descriptorBytes=fs.readFileSync('.runtime/ai-painter/natural-world-live-map-inputs/'+worldId+'/'+bytesSha+'/input.json')
assert.equal(sha(storeBytes),bytesSha);assert.equal(sha(descriptorBytes),descriptorSha)
const record=JSON.parse(storeBytes),descriptor=JSON.parse(descriptorBytes)
const expected={identity:descriptor.identity,tick:30,stateVersion:31,eventCursor:31,storeFileSha256:bytesSha,descriptorSha256:descriptorSha}
const setup=(options={})=>createNaturalWorldSpatialQuery({storeBytes,descriptorBytes,expected,...options})
test('existing spatial polygon traversal terminates on convex, concave, horizontal, vertex and half-open boundary cases',()=>{
  // A synchronous regression would block Node's timer if tested only in-process.
  const script=`import assert from 'node:assert/strict';import {isPointInPolygon as inside} from './src/world/spatial/spatial-geometry.ts';
    const rect={points:[[0,0],[4,0],[4,4],[0,4]].map(([x,y])=>({x,y}))};
    for(const [x,y,truth] of [[2,2,true],[0,2,true],[2,0,true],[0,0,true],[4,4,false],[4,2,false],[2,4,false],[-1,0,false]])assert.equal(inside({x,y},rect),truth);
    const concave={points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]].map(([x,y])=>({x,y}))};assert(inside({x:.5,y:3},concave));assert(!inside({x:2,y:2},concave));`
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{timeout:2500,encoding:'utf8',windowsHide:true})
  assert.ifError(child.error);assert.equal(child.status,0,child.stderr)
})
test('real native layers retain terrain overlaps, corridor, collisions and object IDs without assuming a visual frame',()=>{
  const map=setup(),q=(x,y)=>map.query({space:'native',x,y},expected)
  assert.deepEqual(map.counts,{terrainRegions:8,walkableRegions:1,collisionRegions:33,objects:52})
  assert.equal(q(0,0).movement,'blocked_by_collision')
  assert.equal(q(810,320).movement,'walkable_here');assert.equal(q(810,320).onPathGround,true)
  assert.equal(q(608,76).movement,'outside_walkable_region')
  assert.deepEqual(q(627,492).terrain.map(t=>t.kind),['grass','tall_grass','mud_patch'])
  assert(q(112,235).objects[0].objectId.endsWith(':001'));assert.equal(q(146,255).instanceValue,1);assert.equal(q(147,255).instanceValue,0)
  assert.equal(q(232,116).objects[0].kind,'shrub');assert.equal(q(232,116).objects[0].blocksMovement,false)
  assert.equal(q(637,267).objects[0].kind,'rock');assert.equal(q(637,267).movement,'blocked_by_collision')
  const rockId=q(637,267).objects[0].objectId
  assert.equal(map.query({space:'native',x:637,y:267},expected,rockId).objects[0].objectId,rockId)
  assert.throws(()=>map.query({space:'native',x:810,y:320},expected,rockId),/outside selected pixel/)
  assert.throws(()=>map.query({space:'native',x:810,y:320},expected,'unregistered-id'),/unknown world object/)
  const first=q(112,235);first.objects[0].footprint.x=0;first.snapshot.identity.worldId='foreign'
  assert.equal(q(112,235).objects[0].footprint.x,112);assert.deepEqual(map.snapshot,expected)
})
test('normalized content coordinates respect canvas edges, rectangular pixels, registered version and owner',()=>{
 const map=setup();for(const [x,y] of [[0,0],[232,116],[1023,767],[810,320]]){
    const native=map.query({space:'native',x,y},expected)
    assert.deepEqual(map.query({space:'normalized',x:(x+.5)/1024,y:(y+.5)/768},expected),native)
 }
 assert.deepEqual(map.query({space:'normalized',x:1,y:1},expected).pixel,{x:1023,y:767})
 for(const p of [{space:'native',x:1024,y:0},{space:'native',x:.5,y:0},{space:'normalized',x:-.00001,y:.1},{space:'normalized',x:1.01,y:.3},{space:'normalized',x:NaN,y:1}]){
   assert.throws(()=>map.query(p,expected),/coordinate|point/)
 }
 for(const bad of [{...expected,identity:{...expected.identity,ownerId:'foreign'}},{...expected,identity:{...expected.identity,worldId:'foreign'}},
  {...expected,stateVersion:30},{...expected,tick:29},{...expected,eventCursor:30},{...expected,storeFileSha256:'0'.repeat(64)},{...expected,descriptorSha256:'1'.repeat(64)}]){
   assert.throws(()=>setup({expected:bad}));assert.throws(()=>map.query({space:'native',x:0,y:0},bad))
 }
})
test('checksum and source disagreements reject even when caller rebound the descriptor bytes',()=>{
 for(const change of [d=>d.objectInstanceTable[0].value=6,d=>d.objectInstanceTable.reverse(),d=>d.geometrySha256='a'.repeat(64),d=>d.tick=0,
    d=>d.logicalEndUtc='2020-01-08T00:00:00Z',d=>d.channels.pop(),d=>d.nativeShape=[1,23,192,256],d=>d.head.path=day]){
   const v=structuredClone(descriptor);change(v);const b=Buffer.from(JSON.stringify(v))
   assert.throws(()=>setup({descriptorBytes:b,expected:{...expected,descriptorSha256:sha(b)}}))
 }
 const bad=structuredClone(record);bad.worldFacts.payload.objectFootprints[0].footprint.x=0
 const buf=Buffer.from(JSON.stringify(bad));assert.throws(()=>setup({storeBytes:buf,expected:{...expected,storeFileSha256:sha(buf)}}))
})
test('in-memory overlaps keep both source IDs, expose the native instance priority and give collision precedence over walkability',()=>{
 const r=structuredClone(record),d=structuredClone(descriptor),facts=r.worldFacts.payload,objs=facts.objectFootprints
 const rect={x:809,y:319,width:3,height:3}
 for(const i of [0,1]){objs[i].footprint={...rect};r.worldState.payload.objects[i].footprint={...rect};d.objectInstanceTable[i].footprint={...rect}}
 facts.collisionRegions.push({sourceId:'fixture-intersection',polygon:[{x:809,y:319},{x:812,y:319},{x:812,y:322},{x:809,y:322}]})
 const sealed=sealNaturalWorldRuntimeRecord(r),s=Buffer.from(JSON.stringify(sealed))
 Object.assign(d,{head:{path:live,sha256:sha(s)},geometrySha256:baselineDigest(facts),factHash:sealed.worldFactsPayloadSha256,
   statePayloadSha256:sealed.statePayloadSha256,recordContentSha256:sealed.recordContentSha256})
 const b=Buffer.from(JSON.stringify(d)),stamp={...expected,storeFileSha256:sha(s),descriptorSha256:sha(b)}
 const hit=setup({storeBytes:s,descriptorBytes:b,expected:stamp}).query({x:810,y:320,space:'native'},stamp)
 assert.deepEqual(hit.objects.map(o=>o.objectId),objs.slice(0,2).map(o=>o.objectId));assert.equal(hit.instanceValue,2)
 assert(hit.walkableRegionIds.length>0);assert(hit.collisionRegionIds.includes('fixture-intersection'));assert.equal(hit.movement,'blocked_by_collision')
})
