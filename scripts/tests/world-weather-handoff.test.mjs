import test from 'node:test'
import assert from 'node:assert/strict'
import { BASELINE_IDENTITY } from '../lib/natural-world-baseline-proof.mjs'
import { inspectWorldWeatherHandoff, verifyDay30TransferBoundary } from '../lib/world-weather-handoff.mjs'

const epoch = '2020-01-08T00:00:00.000Z'
const version = 'sakaerat-weather-153-scheduled-v5'
function coherentSnapshot() {
  const trace = Array.from({ length: 27 }, (_, i) => {
    const tick = i + 4
    return { tick, fileSha256: 'file-' + tick, eventSha256: 'event-' + tick, businessKey: 'key-' + tick, inputSha256: 'input-' + tick, modelVersion: version }
  })
  return {
    history: {
      identity: { ...BASELINE_IDENTITY }, originalCutoffUtc: epoch, maximumValidatedForecastDays: 30,
      before: { tick:30, stateVersion:31, eventCursor:31, fileSha256:'file-30' },
      head: { eventSha256:'event-30', businessKey:'key-30' }, historyValueSha256:'history',
      verifiedTrace:trace,
    },
    cfg: { identity:{ ...BASELINE_IDENTITY }, originalCutoffUtc:epoch, validatedForecastDays:30, version, origin:{tick:3} },
    ledger: {
      current: { scope:'lifetime', tick:30, file_sha:'file-30', event_sha:'event-30', business_key:'key-30', history_sha:'history' },
      slots:trace.map(e => ({ target_tick:e.tick, status:'committed', commit_file:e.fileSha256, commit_event:e.eventSha256, input_sha:e.inputSha256, token:'slot-' + e.tick })),
      batches:Array.from({length:14},(_,i) => ({ seq:i+1 })),
    },
    loggedUsage: { outstanding:null, scope:'lifetime', chargedModelStartSlots:27, batchesIssued:14, cumulativeIncludingPriorDays:30,
      remainingModelStarts:0,remainingBatchIssues:0,remainingAuthorizedDays:0,remainingOriginalValidatedDays:0,committedTick:30 },
    usage:{ remaining:0, outstanding:null, accounted:27, reserved:27, batches:14 },
  }
}

test('same-world receipt, original lifetime and every settled model charge agree', () => {
  verifyDay30TransferBoundary(coherentSnapshot())
})

test('mixed world, cutoff, version, certificate, stale cursor or historical digest cannot count', () => {
  for (const change of [
    x => { x.history.identity.worldId = 'different' },
    x => { x.cfg.identity.regionId = 'foreign' },
    x => { x.history.originalCutoffUtc = '2020-02-07T00:00:00.000Z' },
    x => { x.cfg.version = 'unsigned-successor' },
    x => { x.cfg.validatedForecastDays = 37 },
    x => { x.history.before.stateVersion = 30 },
    x => { x.history.before.eventCursor = 30 },
    x => { x.ledger.current.file_sha = 'previous-store' },
    x => { x.ledger.current.event_sha = 'previous-event' },
    x => { x.ledger.current.history_sha = 'replaced-history' },
  ]) {
    const x=coherentSnapshot()
    change(x)
    assert.throws(() => verifyDay30TransferBoundary(x))
  }
})

test('unresolved, failed, repeated or missing model claims fail even with an exhausted summary', () => {
  for (const change of [
    x => { x.usage.outstanding = 'reserved' },
    x => { x.loggedUsage.outstanding = { tick:31,status:'failed' } },
    x => { x.ledger.slots[13].status = 'reserved' },
    x => { x.ledger.slots[13].status = 'failed' },
    x => { x.ledger.slots[1].token = x.ledger.slots[0].token },
    x => { x.history.verifiedTrace[1].businessKey = x.history.verifiedTrace[0].businessKey },
    x => { x.ledger.slots[1].target_tick = 4 },
    x => { x.ledger.slots.splice(2,1) },
    x => { x.ledger.batches.pop() },
    x => { x.history.verifiedTrace[4].inputSha256 = 'wrong-input' },
    x => { x.loggedUsage.remainingOriginalValidatedDays = 7 },
    x => { x.loggedUsage.chargedModelStartSlots = 0 },
  ]) {
    const x=coherentSnapshot()
    change(x)
    assert.throws(() => verifyDay30TransferBoundary(x))
  }
})

test('the production inspector accepts no injected path, release or permission', async () => {
  await assert.rejects(inspectWorldWeatherHandoff({path:'fixture', worldId:'other', successorApproved:true}), /fixed production handoff/)
})
