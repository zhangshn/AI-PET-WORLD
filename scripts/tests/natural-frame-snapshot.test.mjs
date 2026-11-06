import assert from 'node:assert/strict'
import {test} from 'node:test'
import {compareNaturalFrameSourceSnapshots as compare,inspectNaturalFrameRgbPng as inspect} from '../../src/world/game-map-frame/natural-frame-snapshot.mjs'
import {bound,json,sha} from '../lib/world-initialized-evolution.mjs'
const reports='.runtime/ai-painter/controller-repair-reviews/'
const strict=ref=>JSON.parse(bound(ref))
const readback=json(reports+'natural-frame-snapshot-contract-225-20261103/inspection.json')
const original=readback.history,now=readback.current
const older={record:strict(original.immutableRecord),fileSha256:original.immutableRecord.sha256,descriptor:strict(original.descriptor),descriptorSha256:original.descriptor.sha256}
const currentDescriptor=strict(now.descriptor)
const current={record:strict(currentDescriptor.currentSnapshot),fileSha256:now.file.sha256,descriptor:currentDescriptor,descriptorSha256:now.descriptor.sha256}
test('real first-day native result and final-day snapshot differ despite identical 23 spatial channels and object table',()=>{
  const different=compare(current,older)
  assert.deepEqual(different,readback.comparison);assert.equal(different.sameSnapshot,false)
  for(const k of ['tick','stateVersion','eventCursor','logicalEndUtc','factHash','statePayloadSha256','descriptorSha256'])assert(different.mismatched.includes(k))
  assert(!different.mismatched.includes('geometrySha256')&&!different.mismatched.includes('channels')&&!different.mismatched.includes('objects'))
})
test('foreign owner, stale revision, missing committed state and an altered channel cannot certify a current frame',()=>{
  for(const [key,value] of [['stateVersion',current.record.stateVersion-1],['factHash','0'.repeat(64)]]){
    assert.throws(()=>compare(current,{...current,descriptor:{...current.descriptor,[key]:value}}))
  }
  const other=structuredClone(current);other.record.ownerId=other.descriptor.identity.ownerId='foreign-owner'
  assert(compare(current,other).mismatched.includes('ownerId'))
  const channel=structuredClone(current);channel.descriptor.channels[0].sha256='f'.repeat(64)
  assert(compare(current,channel).mismatched.includes('channels'))
  assert.throws(()=>compare(current,{...current,record:{...current.record,worldState:{}}}))
})
test('fixture quality flags and an actual weather release do not yield authority even when source inputs match',()=>{
  assert.equal(readback.registeredReleases.length,3);assert(readback.registeredReleases.every(x=>x.scope==='world_evolution'))
  const claimed={...current,vj1Status:'vj_1_passed',vj2Status:'vj_2_passed',published:true,canShowInWorld:true,
    release:current.descriptor.capabilityRelease}
  assert.deepEqual(compare(current,claimed),{sameSnapshot:true,mismatched:[]})
  assert.deepEqual(compare(current,{...older,...{tags:['approved','world_page_ready']}}),readback.comparison)
  assert.equal(original.published,false);assert.equal(original.reviewCount,0)
})
test('the recorded RGB PNG requires both real file and decoded pixel identity',async()=>{
  const bytes=bound(original.png),actual=await inspect(bytes,original.png.sha256,original.pixelSha256)
  assert.deepEqual([actual.width,actual.height],[1024,768])
  await assert.rejects(inspect(bytes,'a'.repeat(64),original.pixelSha256),/file bytes/)
  await assert.rejects(inspect(bytes,original.png.sha256,'b'.repeat(64)),/decoded pixels/)
  const invalid=bytes.subarray(0,120)
  await assert.rejects(inspect(invalid,sha(invalid),original.pixelSha256))
})
