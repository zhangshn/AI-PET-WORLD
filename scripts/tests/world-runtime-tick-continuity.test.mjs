import assert from 'node:assert/strict'
import test from 'node:test'
import { loadRuntimeContinuityCpu, makePrivateRuntimeSave, makePrivateConstructionTick } from './helpers/world-runtime-tick-continuity-cpu.mjs'

const runtime = loadRuntimeContinuityCpu()
const profileFields = [
  'worldProfileId', 'worldProfileVersion', 'worldProfilePath',
  'earthParameterSnapshotId', 'earthParameterSnapshotPath',
]
const now = Date.parse('2026-01-01T00:00:00.000Z')
const behavior = 'project:private-plan|stage:foundation|intent:construction|world_rule:passed|placements:add:private-placement'

function assertRepeat(signatures, expected) {
  assert.equal(runtime.hasRepeatedRecentActionSignatures(signatures), expected)
  const saveRecord = makePrivateRuntimeSave({ recentActionSignatures: signatures })
  const decision = runtime.selectButlerRuntimeMotivation({ saveRecord, nextTick: 4, now })
  const score = (type) => decision.scores.find((entry) => entry.type === type)
  assert.equal(score('continue_construction').riskPenalty, expected ? 28 : 0)
  assert.equal(score('maintain_home').riskPenalty, expected ? 8 : 0)
  assert.equal(score('observe_world').continuityScore, expected ? 30 : 6)
  const audit = runtime.auditWorldRuntimeContinuity({ previousSaveRecord: saveRecord, nextSaveRecord: saveRecord, runtimeTick: null })
  assert.equal(audit.warnings.some((warning) => warning.includes('last 3 ticks')), expected)
  assert.deepEqual(audit.blockingWarnings, [])
}

test('three equal behaviors across ticks match legacy construction, decision and mixed signatures', () => {
  assertRepeat([behavior, behavior, behavior], true)
  assertRepeat([1, 2, 3].map((tick) => `tick:${tick}|${behavior}`), true)
  const decision = 'motivation:observe_world|intent:observation|world_rule:passed'
  assertRepeat([1, 2, 3].map((tick) => `${decision}|tick:${tick}|state:no_safe_construction`), true)
  assertRepeat([`tick:1|${behavior}`, behavior, `tick:3|${behavior}`], true)
  assert.equal(runtime.normalizeRuntimeActionSignature(`tick:1|${behavior}`), behavior)
})

test('different action content is never erased along with the legacy tick token', () => {
  for (const different of [
    behavior.replace('private-plan', 'other-plan'),
    behavior.replace('foundation', 'other-stage'),
    behavior.replace('intent:construction', 'intent:maintenance'),
    behavior.replace('world_rule:passed', 'world_rule:blocked'),
    behavior.replace('add:private-placement', 'remove:private-placement'),
    behavior.replace('private-placement', 'other-placement'),
    behavior.replace('private-placement', 'placement-tick:2'),
    `${behavior}|state:other`,
  ]) {
    assertRepeat([`tick:1|${behavior}`, `tick:2|${different}`, `tick:3|${behavior}`], false)
  }
  const observe = 'motivation:observe_world|intent:observation|world_rule:passed|state:no_safe_construction'
  const wait = 'motivation:wait_for_resources|intent:resource_wait|world_rule:passed|state:no_safe_construction'
  assertRepeat([observe, `tick:2|${wait}`, observe], false)
})

test('fewer than three observations do not trigger and only the latest three count', () => {
  for (const signatures of [[], [behavior], [behavior, behavior], [`tick:1|${behavior}`, `tick:2|${behavior}`]]) {
    assertRepeat(signatures, false)
  }
  assertRepeat(['different', behavior, behavior, behavior], true)
  assertRepeat([behavior, behavior, behavior, 'different'], false)
})

test('empty or tick-only history never proves a repeated behavior', () => {
  assertRepeat(['', '', ''], false)
  assertRepeat(['tick:1', 'tick:2', 'tick:3'], false)
  assertRepeat(['tick:1', '', 'tick:3'], false)
})

test('tick retains exactly the existing five identity fields including partial, empty and absent values', () => {
  const complete = Object.fromEntries(profileFields.map((field) => [field, `private-${field}`]))
  const cases = [complete, {}, ...profileFields.map((field) => ({ [field]: complete[field] })),
    Object.fromEntries(profileFields.map((field) => [field, ''])),
    Object.fromEntries(profileFields.map((field) => [field, undefined])),
  ]
  for (const fields of cases) {
    let saveRecord = makePrivateRuntimeSave(fields)
    for (let tick = 1; tick <= 4; tick++) {
      const before = structuredClone(saveRecord)
      const result = runtime.runOneRuntimeTick({ saveRecord, now: now + tick * 1000, tags: [] })
      assert.deepEqual(saveRecord, before, 'tick must not mutate its input')
      assert.equal(result.runtimeTick, null)
      assert.equal(result.audit.ok, true)
      const next = result.nextSaveRecord
      for (const field of profileFields) {
        assert.equal(Object.hasOwn(next, field), Object.hasOwn(fields, field), field)
        assert.equal(next[field], fields[field], field)
      }
      assert.equal(next.tick, tick)
      assert.equal(next.savedAt, new Date(now + tick * 1000).toISOString())
      assert.equal(next.homeMapState, saveRecord.homeMapState)
      for (const field of ['worldId', 'ownerId', 'butlerProfile', 'butlerRuntimeProfile', 'butlerBirthInput',
        'butlerMappingMode', 'butlerConstructionStyle', 'worldCreationStyleSource']) {
        assert.equal(next[field], saveRecord[field], field)
      }
      assert.equal(next.lastRuntimeAction.tick, tick)
      assert.equal(result.events[0].tick, tick)
      assert.equal(result.events[0].id, `runtime-event-${tick}`)
      assert.ok(!next.lastRuntimeAction.actionSignature.split('|').some((token) => token.startsWith('tick:')))
      assert.equal(next.lastRuntimeAction.actionSignature, next.recentActionSignatures[0])
      assert.equal(result.audit.warnings.some((warning) => warning.includes('last 3 ticks')), tick >= 3)
      saveRecord = next
    }
  }
})

test('construction behavior is stable across ticks, changes with action content and keeps placement sorting', () => {
  let action = { diffs: [
    { id: 'diff-z', operation: 'add', placementId: 'placement-z' },
    { id: 'diff-a', operation: 'move', placementId: 'placement-a' },
  ] }
  const cpu = loadRuntimeContinuityCpu({ constructionTick: (input) => makePrivateConstructionTick(input, action) })
  const complete = Object.fromEntries(profileFields.map((field) => [field, `private-${field}`]))
  const base = makePrivateRuntimeSave(complete)
  base.homeMapState.resources = { materialReadiness: 100, careReadiness: 100, groundHealth: 100, recentTransactions: [] }
  function run(tick) {
    return cpu.runOneRuntimeTick({ saveRecord: { ...base, tick: tick - 1 }, now: now + tick * 1000, tags: [] }).nextSaveRecord
  }
  const first = run(1)
  assert.equal(first.lastRuntimeAction.acceptedDiffCount, 2)
  assert.match(first.lastRuntimeAction.actionSignature, /placements:add:placement-z\+move:placement-a$/)
  for (const field of profileFields) assert.equal(first[field], complete[field])
  action = { ...action, diffs: [...action.diffs].reverse() }
  const second = run(2)
  const third = run(3)
  assert.equal(first.lastRuntimeAction.actionSignature, second.lastRuntimeAction.actionSignature)
  assertRepeat([first, second, third].map((save) => save.lastRuntimeAction.actionSignature), true)
  for (const change of [{ project: 'other-plan' }, { stage: 'other-stage' },
    { diffs: [{ id: 'other-diff', operation: 'remove', placementId: 'other-placement' }] }]) {
    action = change
    assertRepeat([first.lastRuntimeAction.actionSignature, run(4).lastRuntimeAction.actionSignature,
      third.lastRuntimeAction.actionSignature], false)
  }
})

test('legacy history carries forward without rewriting it and record windows retain original caps', () => {
  const action = 'motivation:wait_for_resources|intent:resource_wait|world_rule:passed'
  const legacy = [1, 2].map((tick) => `${action}|tick:${tick}|state:no_safe_construction`)
  const previous = makePrivateRuntimeSave({ tick: 2, recentActionSignatures: legacy })
  const result = runtime.runOneRuntimeTick({ saveRecord: previous, now, tags: [] })
  assert.deepEqual(result.nextSaveRecord.recentActionSignatures.slice(0, 2), legacy)
  assert.deepEqual(previous.recentActionSignatures, legacy)
  assertRepeat(result.nextSaveRecord.recentActionSignatures, true)
  const full = makePrivateRuntimeSave({
    recentEvents: Array.from({ length: 20 }, (_, tick) => ({ id: `old-${tick}`, tick })),
    recentActionSignatures: Array.from({ length: 10 }, (_, tick) => `old-${tick}`),
    recentMotivationTypes: Array(10).fill('observe_world'),
  })
  const next = runtime.runOneRuntimeTick({ saveRecord: full, now, tags: [] }).nextSaveRecord
  assert.equal(next.recentEvents.length, 20)
  assert.equal(next.recentEvents[0].id, 'old-1')
  assert.equal(next.recentActionSignatures.length, 10)
  assert.equal(next.recentActionSignatures[0], 'old-1')
  assert.equal(next.recentMotivationTypes.length, 10)
})

test('existing duplicate diff, placement and resource deduction blocking is preserved', () => {
  const diff = { id: 'private-diff', operation: 'add', placementId: 'private-placement' }
  const transaction = { transactionId: 'private-transaction', amount: -1 }
  const previous = makePrivateRuntimeSave()
  previous.homeMapState.mapDiffs = [diff]
  previous.homeMapState.resources.recentTransactions = [transaction]
  previous.homeMapState.resources.resourcePoolState = { transactions: [transaction] }
  const next = structuredClone(previous)
  next.homeMapState.mapDiffs.push(diff)
  next.homeMapState.resources.recentTransactions.push(transaction)
  next.homeMapState.resources.resourcePoolState.transactions.push(transaction)
  const audit = runtime.auditWorldRuntimeContinuity({ previousSaveRecord: previous, nextSaveRecord: next, runtimeTick: {} })
  for (const message of ['MapDiff id', 'add placement', 'resourcePoolState transactionId', 'recentTransactions transactionId', 'duplicated resource deduction']) {
    assert.ok(audit.blockingWarnings.some((warning) => warning.includes(message)), message)
  }
})
