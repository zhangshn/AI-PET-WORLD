import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {test} from 'node:test'
import {nativeStage0ServiceCommand as command,nativeStage0ServiceLimits as budget} from '../lib/native-stage0-formal-service.mjs'
import {bind,json,safe} from '../lib/world-initialized-evolution.mjs'

const prep='.runtime/ai-painter/controller-repair-reviews/native-stage0-formal-training-229-20261103/service'
const fixture=prep+'/cpu-fixture'
test('registered segment and total budgets are separate, and normal commands reject path/authority injection',async()=>{
  assert.equal(budget.segmentSeconds*1000,840000);assert.equal(budget.totalSeconds,32400)
  assert.equal(budget.segmentPairs*budget.segments,1152);assert.equal(budget.failureReserveBytes,64*1024**2)
  await assert.rejects(command('--unknown'));await assert.rejects(command('--status','another-world'))
  const state=await command('--status');assert.equal(state.runId,'stage0-native-256-formal-229');assert.equal(state.source,'local_native_stage0_service')
})
test('one local detached rehearsal independently authenticates both original Jobs and releases previous scratch only after newer checkpoint',async t=>{
  if(!fs.existsSync(safe(fixture+'/terminal.json')))return t.skip('requires original completed bounded rehearsal')
  const state=await command('--cpu-status')
  assert.equal(state.status,'cpu_rehearsal_completed');assert.equal(state.sealedPairs,0);assert.equal(state.sealedSegments,2)
  assert.deepEqual(state.counts,{generator:0,discriminator:0});assert.equal(state.rehearsalPositions,48)
  const a=json(fixture+'/segments/01/seal.json'),b=json(fixture+'/segments/02/seal.json')
  assert.equal(a.previousSealSha256,null);assert.equal(b.previousSealSha256,bind(fixture+'/segments/01/seal.json').sha256)
  assert.notEqual(a.guardIdentity,b.guardIdentity);assert.notEqual(a.workerPid,b.workerPid)
  const first=json(a.ticket.path),second=json(b.ticket.path)
  assert.equal(first.ownerRunnerPid,second.ownerRunnerPid);assert.equal(first.runDeadlineUtc,second.runDeadlineUtc)
  assert.deepEqual(second.previous.checkpoint,a.checkpoint);assert.deepEqual(second.previous.receipt,bind(fixture+'/segments/01/seal.json'))
  assert(!fs.existsSync(safe(a.checkpoint.path)));assert.deepEqual(json(fixture+'/segments/01/reaped.json').replacement,b.checkpoint)
  assert.equal(bind(b.checkpoint.path).sha256,b.checkpoint.sha256)
  assert.equal(json(a.result.path).optimizerUpdates,0);assert.equal(json(b.result.path).modelForwards,0)
  const other=JSON.parse(execFileSync(process.execPath,['scripts/run-native-stage0-formal-training.mjs','--cpu-status'],{encoding:'utf8',windowsHide:true}))
  assert.deepEqual(other.lastSegmentTicket,second);assert.equal(other.terminal.status,'cpu_rehearsal_completed')
})
