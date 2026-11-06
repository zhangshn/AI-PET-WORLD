import assert from 'node:assert/strict'
import {test} from 'node:test'
import {projectNativeStage0Status as project,projectStage0Continuation} from '../../src/server/local-backup/native-stage0-training-progress.mjs'
const runId='stage0-native-256-formal-229',at='2026-11-03T01:22:00Z'
test('resumed progress retains the original stop and never calls a stale worker active',()=>{
  const originalStop={path:'.runtime/ai-painter/native-stage0-formal-training/'+runId+'/terminal.json',sha256:'3cb0712c1da6921fe6c5d370445679f8895328d51f096ecaa49de19ce3888fa1'}
  const base=project({...state,status:'failed_closed',endedAtUtc:at,sealedSegments:13,sealedPairs:312,counts:{generator:312,discriminator:312},currentSegment:13,currentEpoch:7,terminal:{status:'failed_closed',reason:'host or disk below floor'}})
  const s={runId,dispatchId:'resource-continuation-236',oldTerminal:originalStop,deadlineUtc:'2026-11-03T08:09:02.105Z',sourceTime:at,status:'waiting_resources',completedPairs:312,segment:14,hostAlive:true,activePid:345,activeProof:{identityVerified:true,pid:345}}
  const v=projectStage0Continuation(base,s)
  assert.equal(v.percentage,27.1);assert.equal(v.previousStop.committed,312);assert.equal(v.previousStop.endedAt,at)
  assert.equal(v.pendingG,null);assert.equal(v.workerOwned,false);assert.equal(v.endedAt,null)
  assert.throws(()=>projectStage0Continuation(base,{...s,hostAlive:false}))
  assert.throws(()=>projectStage0Continuation(base,{...s,oldTerminal:{...originalStop,sha256:'0'.repeat(64)}}))
  assert.equal(projectStage0Continuation(base,{...s,status:'not_started'}),base)
})
const state={runId,phase:'train',source:'local_native_stage0_service',snapshotAtUtc:at,status:'active',startedAtUtc:at,endedAtUtc:null,
  policy:{path:'data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json',sha256:'3f00ea5bb99997ddbdd4f051b424bd9177b1305591504874394370be461887e1'},
  elapsedSeconds:123.5,sealedSegments:1,sealedPairs:24,counts:{generator:24,discriminator:24},currentSegment:2,currentEpoch:1,
  host:{pid:10,alive:true},worker:{currentlyOwned:true,heartbeat:{utc:at,runId,segment:2,workerPid:11,phase:'training_guard',completedInMemory:{D:29,G:28}}},
  lastSegmentTicket:{runId,segment:2,startPair:24,endPair:48},terminal:null,validation:[]}
test('read totals and separate D/G in-flight without awarding additional committed pairs',()=>{
  const row=project(state);assert.deepEqual([row.committed,row.percentage,row.segments,row.pendingD,row.pendingG],[24,2.1,1,5,4])
  assert.deepEqual([row.hostPid,row.workerPid,row.workerOwned],[10,11,true]);assert.equal(row.links.length,2)
})
test('not-started, interrupted and fully trained but quality-failed are distinct and have honest percentages',()=>{
  const idle=project({...state,status:'not_started',startedAtUtc:null,sealedPairs:0})
  assert.equal(idle.epoch,null);assert.equal(idle.percentage,0);assert.equal(idle.startedAt,null)
  const stopped=project({...state,status:'failed_closed',terminal:{status:'failed_closed',reason:'disk reserve'}})
  assert.equal(stopped.reason,'disk reserve');assert.equal(stopped.committed,24)
  const final=project({...state,status:'training_completed_fixed_review_failed',terminal:{status:'training_completed_fixed_review_failed',reason:{qualityPassed:false}},
   currentSegment:48,currentEpoch:24,sealedSegments:48,sealedPairs:1152,counts:{generator:1152,discriminator:1152},endedAtUtc:at})
  assert.equal(final.percentage,100);assert.equal(final.reason,'固定审核未通过');assert.equal(final.pendingD,null)
})
test('qualification fixtures, altered contract and inconsistent sealed counts cannot become a percentage',()=>{
  for(const patch of [{phase:'cpu_rehearsal'},{counts:{generator:25,discriminator:24}},{sealedPairs:35},{policy:{...state.policy,sha256:'0'.repeat(64)}},{currentEpoch:12}]){
    assert.throws(()=>project({...state,...patch}))
  }
  const bad=project({...state,worker:{heartbeat:{...state.worker.heartbeat,runId:'other'}}});assert.equal(bad.pendingG,null)
})
