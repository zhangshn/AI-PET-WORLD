import test from 'node:test'
import assert from 'node:assert/strict'
import { validateWorldEvolutionTimePolicy as validate, createWorldEvolutionClockAnchor as create,
  planWorldEvolutionBatch as plan } from '../../src/world/runtime/world-evolution-clock.ts'

const epoch = '2025-01-01T00:00:00.000Z'
const policy = () => ({ simulationEpochUtc: epoch, stepSeconds: 86400, scheduleIntervalSeconds: 2,
  modelHorizonSeconds: 86400, downtimeMode: 'freeze', maxCatchupSteps: 0, maxCatchupLogicalSeconds: 0 })
const anchorInput = (p = policy(), backlog = 0) => ({ policy: p, lastCommittedLogicalEndUtc: epoch, monotonicNowMs: 100, recoveredPendingSteps: backlog })
const query = (now = 2100, end = epoch) => ({ monotonicNowMs: now, committedLogicalEndUtc: end,
  remainingStepBudget: 10, remainingLogicalSeconds: 864000, maxBatchSteps: 10 })
const catchupPolicy = () => ({ ...policy(), downtimeMode: 'bounded_catchup', maxCatchupSteps: 3, maxCatchupLogicalSeconds: 259200 })

test('freeze starts at recovered logical end; no downtime or wall clock advances it', () => {
  const a = create(anchorInput())
  assert.equal(plan(a, query(100)).proposedSteps, 0)
  const oldNow = Date.now
  try {
    Date.now = () => 0
    const before = plan(a, query(2100))
    Date.now = () => 8000000000000000
    const after = plan(a, query(2100))
    assert.deepEqual(before, after)
    assert.deepEqual(after.intervals, [{ logicalStartUtc: epoch, logicalEndUtc: '2025-01-02T00:00:00.000Z', durationSeconds: 86400 }])
    assert.equal(after.committedLogicalEndUtc, epoch)
    assert.equal(after.proposalOnly, true)
    assert.equal(after.committedStateVerified, false)
  } finally { Date.now = oldNow }
})

test('proposal repetition consumes nothing; observed committed progress excludes old interval', () => {
  const a = create(anchorInput())
  const first = plan(a, query(4100))
  assert.deepEqual(plan(a, query(4100)), first)
  const next = plan(a, query(4100, '2025-01-02T00:00:00.000Z'))
  assert.equal(next.proposedSteps, 1)
  assert.equal(next.intervals[0].logicalStartUtc, '2025-01-02T00:00:00.000Z')
  assert.throws(() => plan(a, query(4100)), /committed_end_backwards/)
  assert.throws(() => plan(a, query(4000, '2025-01-02T00:00:00.000Z')), /monotonic_backwards/)
})

test('bounded recovery caps whole-anchor catchup and retains backlog without skipping to newer work', () => {
  const a = create(anchorInput(catchupPolicy(), 8))
  const first = plan(a, query(100))
  assert.equal(first.proposedSteps, 3)
  assert.equal(first.pendingStepsAfterProposals, 5)
  const exhausted = plan(a, query(2100, '2025-01-04T00:00:00.000Z'))
  assert.equal(exhausted.proposedSteps, 0)
  assert.equal(exhausted.dueSteps, 6)
  assert.equal(exhausted.recoveredPendingSteps, 5)
  assert.equal(exhausted.recoveryLimitReached, true)
})

test('recovery shorter than catchup allowance permits newly scheduled work after it', () => {
  const a = create(anchorInput(catchupPolicy(), 2))
  assert.equal(plan(a, query(6100)).proposedSteps, 5)
  const done = plan(a, query(6100, '2025-01-06T00:00:00.000Z'))
  assert.equal(done.dueSteps, 0)
  assert.equal(done.recoveredPendingSteps, 0)
})

test('execution steps, logical duration, allocation cap and recovery duration all constrain work', () => {
  const a = create(anchorInput(catchupPolicy(), 8))
  assert.equal(plan(a, { ...query(100), remainingStepBudget: 0 }).proposedSteps, 0)
  assert.equal(plan(a, { ...query(100), remainingStepBudget: 2 }).proposedSteps, 2)
  assert.equal(plan(a, { ...query(100), remainingLogicalSeconds: 86399 }).proposedSteps, 0)
  assert.equal(plan(a, { ...query(100), remainingLogicalSeconds: 86400 }).proposedSteps, 1)
  assert.equal(plan(a, { ...query(100), maxBatchSteps: 1 }).proposedSteps, 1)
  const limited = create(anchorInput({ ...catchupPolicy(), maxCatchupLogicalSeconds: 172800 }, 8))
  assert.equal(plan(limited, query(100)).proposedSteps, 2)
})

test('strict UTC, millisecond precision and exact model horizon', () => {
  for (const simulationEpochUtc of [null, '2025-01-01', '2025-01-01T00:00:00Z', '2025-02-30T00:00:00.000Z', '2025-01-01T08:00:00.000+08:00']) {
    assert.throws(() => validate({ ...policy(), simulationEpochUtc }), /utc_/)
  }
  assert.throws(() => validate({ ...policy(), modelHorizonSeconds: 3600 }), /horizon_mismatch/)
  assert.throws(() => validate({ ...policy(), stepSeconds: 0.0001, modelHorizonSeconds: 0.0001 }), /milliseconds/)
  assert.equal(validate({ ...policy(), stepSeconds: 0.001, modelHorizonSeconds: 0.001 }).stepSeconds, 0.001)
})

test('unknown fields, getters, prototypes and cyclic inputs are rejected without executing getters', () => {
  let getters = 0
  const bad = { ...policy() }
  Object.defineProperty(bad, 'stepSeconds', { enumerable: true, get() { getters++; return 86400 } })
  assert.throws(() => validate(bad), /accessor/)
  assert.equal(getters, 0)
  assert.throws(() => validate({ ...policy(), passed: true }), /fields/)
  assert.throws(() => validate(Object.assign(Object.create({}), policy())), /prototype/)
  const cycle = policy(); cycle.stepSeconds = cycle
  assert.throws(() => validate(cycle), /step/)
  assert.throws(() => create({ ...anchorInput(), wallClockUtc: epoch }), /fields/)
  assert.throws(() => plan(create(anchorInput()), { ...query(), coldStartQualified: true }), /fields/)
})

test('invalid counters, nonfinite values, forbidden freeze backlog and configuration combinations reject', () => {
  for (const n of [-1, NaN, Infinity, true, null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => create({ ...anchorInput(), monotonicNowMs: n }))
    assert.throws(() => plan(create(anchorInput()), { ...query(), remainingStepBudget: n }))
  }
  for (const p of [{ ...policy(), maxCatchupSteps: 1 }, { ...policy(), maxCatchupLogicalSeconds: 1 },
    { ...catchupPolicy(), maxCatchupSteps: 0 }, { ...catchupPolicy(), maxCatchupLogicalSeconds: 0 },
    { ...policy(), downtimeMode: 'always' }, { ...policy(), scheduleIntervalSeconds: 0 }]) assert.throws(() => validate(p))
  assert.throws(() => create(anchorInput(policy(), 1)), /freeze_recovered_pending/)
  assert.throws(() => create(anchorInput(catchupPolicy(), 0.5)), /recovered_pending/)
})

test('unknown clock, off-grid or future committed progress reject', () => {
  assert.throws(() => create({ ...anchorInput(), lastCommittedLogicalEndUtc: null }), /utc_format/)
  assert.throws(() => create({ ...anchorInput(), lastCommittedLogicalEndUtc: '2024-12-31T00:00:00.000Z' }), /grid/)
  assert.throws(() => create({ ...anchorInput(), lastCommittedLogicalEndUtc: '2025-01-01T01:00:00.000Z' }), /grid/)
  assert.throws(() => plan(create(anchorInput()), query(100, '2025-01-02T00:00:00.000Z')), /unearned_commit/)
})

test('opaque anchor cannot be replaced by serialized/caller-mutated objects', () => {
  const input = anchorInput(); const a = create(input)
  input.policy.stepSeconds = 1; input.policy.modelHorizonSeconds = 1
  assert.equal(plan(a, query()).intervals[0].durationSeconds, 86400)
  assert.throws(() => plan(JSON.parse(JSON.stringify(a)), query()), /owned_anchor/)
  assert.throws(() => plan({ kind: 'world_evolution_clock_anchor' }, query()), /owned_anchor/)
  assert(Object.isFrozen(a)); const output = plan(a, query())
  assert(Object.isFrozen(output)); assert(Object.isFrozen(output.intervals)); assert(Object.isFrozen(output.intervals[0]))
})

test('exact schedule boundary, fractional monotonic readings and millisecond logical steps', () => {
  const a = create(anchorInput({ ...policy(), stepSeconds: 0.001, modelHorizonSeconds: 0.001 }))
  assert.equal(plan(a, query(2099.999)).proposedSteps, 0)
  const due = plan(a, query(2100))
  assert.equal(due.proposedSteps, 1)
  assert.equal(due.intervals[0].logicalEndUtc, '2025-01-01T00:00:00.001Z')
  assert.equal(due.nextScheduleInMilliseconds, 2000)
})

test('overflow and oversized batches reject before allocating interval arrays', () => {
  assert.throws(() => plan(create(anchorInput()), { ...query(), maxBatchSteps: 1025 }), /allocation/)
  assert.throws(() => validate({ ...policy(), stepSeconds: Number.MAX_SAFE_INTEGER }), /milliseconds/)
  const a = create(anchorInput(catchupPolicy(), Number.MAX_SAFE_INTEGER))
  assert.throws(() => plan(a, query()), /step_count_overflow/)
  const last = '9999-12-31T00:00:00.000Z'
  const z = create({ ...anchorInput({ ...policy(), simulationEpochUtc: last }), lastCommittedLogicalEndUtc: last })
  assert.throws(() => plan(z, query(2100, last)), /utc_format/)
})
