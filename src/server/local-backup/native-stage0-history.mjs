import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createEvolutionInputReader} from '../../../scripts/lib/natural-world-evolution-input.mjs'

const runId='stage0-native-256-formal-229',run='.runtime/ai-painter/native-stage0-formal-training/'+runId
const openingSha='dd63aa4efbe7e54116a8f443943e9794a71fa4952757c9b7bbc72af19b17de27'
const terminalSha='3cb0712c1da6921fe6c5d370445679f8895328d51f096ecaa49de19ce3888fa1'
const policyPath='data/ai-painter/system-governance/ai-painter-native-stage0-formal-training-v1.json'
const policySha='3f00ea5bb99997ddbdd4f051b424bd9177b1305591504874394370be461887e1'
const hash=b=>createHash('sha256').update(b).digest('hex')

function readBoundHistoryRecord(read,logical,expected,bytes){
  const raw=read(logical,16*1024)
  assert(Buffer.isBuffer(raw)&&raw.length<=16*1024)
  assert.equal(hash(raw),expected,'historical record digest differs')
  if(bytes!==undefined)assert.equal(raw.length,bytes)
  return JSON.parse(raw.toString('utf8'))
}

// Verify saved record bytes, never installed training programs or execution admission.
// This projection does not revalidate checkpoint contents or current execution state.
export function verifyNativeStage0HistoricalStop(read){
  const bound=(...args)=>readBoundHistoryRecord(read,...args)
  const opening=bound(run+'/opening.json',openingSha)
  const terminal=bound(run+'/terminal.json',terminalSha)
  assert.equal(opening.runId,runId);assert.equal(opening.phase,'train')
  assert.equal(opening.policy.path,policyPath);assert.equal(opening.policy.sha256,policySha)
  assert.equal(terminal.runId,runId);assert.equal(terminal.phase,'train');assert.equal(terminal.status,'failed_closed')
  assert.equal(terminal.stageAdvanceAllowed,false);assert.equal(terminal.worldEntryAllowed,false)
  assert.equal(terminal.sealedSegments,13);assert.equal(terminal.sealedPairs,312)
  assert.equal(terminal.lastSealed.path,run+'/segments/13/seal.json')
  const seal=bound(terminal.lastSealed.path,terminal.lastSealed.sha256,terminal.lastSealed.bytes)
  assert.equal(seal.schema,'native-stage0-durable-segment-v1');assert.equal(seal.mode,'train');assert.equal(seal.runId,runId)
  assert.equal(seal.segment,13);assert.equal(seal.endPair,312)
  assert.deepEqual(seal.checkpoint,terminal.mostRecentSealedCheckpoint)
  const started=Date.parse(opening.startedAtUtc),ended=Date.parse(terminal.atUtc)
  assert(Number.isFinite(started)&&Number.isFinite(ended)&&ended>=started)
  return {status:'verified',runId,runStatus:terminal.status,startedAt:opening.startedAtUtc,endedAt:terminal.atUtc,
    recordedPairs:terminal.sealedPairs,recordedSegments:terminal.sealedSegments,reason:terminal.reason,
    terminalSha256:terminalSha,checkpointRevalidated:false}
}

const continuationSha='b3b02f10f0c4c35f73e212ad12e000c0955ac39b60f2ebdc6a07d2378c0bea14'
function verifyHistoricalContinuation(read,firstStop){
  assert.equal(firstStop.status,'verified');assert.equal(firstStop.terminalSha256,terminalSha)
  const bound=(...args)=>readBoundHistoryRecord(read,...args)
  const terminal=bound(run+'/continuations/resource-continuation-236/terminal.json',continuationSha)
  assert.equal(terminal.runId,runId);assert.equal(terminal.dispatchId,'resource-continuation-236')
  assert.equal(terminal.originalTerminal.path,run+'/terminal.json');assert.equal(terminal.originalTerminal.sha256,terminalSha)
  assert.equal(terminal.status,'training_completed_fixed_review_failed');assert.equal(terminal.completedPairs,1152)
  assert.equal(terminal.stageAdvanceAllowed,false);assert.equal(terminal.worldEntryAllowed,false)
  assert.equal(terminal.lastSeal.path,run+'/segments/48/seal.json')
  const seal=bound(terminal.lastSeal.path,terminal.lastSeal.sha256,terminal.lastSeal.bytes)
  assert.equal(seal.runId,runId);assert.equal(seal.schema,'native-stage0-durable-segment-v1');assert.equal(seal.mode,'train')
  assert.equal(seal.segment,48);assert.equal(seal.endPair,1152)
  const ref=terminal.reason.finalReadback
  assert.equal(ref.path,run+'/segments/48/final-readback-seal.json')
  const final=bound(ref.path,ref.sha256,ref.bytes)
  assert.equal(final.runId,runId);assert.equal(final.phase,'verify_final');assert.equal(final.segment,48)
  assert.deepEqual(final.counts,{generator:1152,discriminator:1152});assert.equal(final.optimizerUpdates,0)
  assert.deepEqual(final.checkpoint,seal.checkpoint)
  assert(Date.parse(terminal.atUtc)>=Date.parse(firstStop.endedAt))
  return {status:'verified',runStatus:terminal.status,endedAt:terminal.atUtc,recordedPairs:1152,recordedSegments:48,
    terminalSha256:continuationSha,checkpointRevalidated:false,reviewRecomputed:false}
}

export function readNativeStage0HistoricalStop(root){
  try{
    const reader=createEvolutionInputReader(root)
    const first=verifyNativeStage0HistoricalStop(reader.read)
    let continuation
    try{continuation=verifyHistoricalContinuation(reader.read,first)}
    catch{continuation={status:'unavailable',message:'接续终态记录缺失或校验未通过；首次停机记录仍独立有效。'}}
    return {...first,continuation,verifiedAtUtc:new Date().toISOString()}
  }catch{
    return {status:'unavailable',message:'首次停机历史记录缺失或校验未通过。'}
  }
}
