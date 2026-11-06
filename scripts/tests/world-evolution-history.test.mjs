import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import ts from 'typescript'

// Pure synthetic query projections: these tests never open a world Store or
// qualify immutable events, capabilities, models, or a production world.
const require = createRequire(import.meta.url)
const source = fs.readFileSync(new URL('../../src/world/runtime/world-evolution-history.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
assert.equal(compiled.diagnostics.filter(x => x.category === ts.DiagnosticCategory.Error).length, 0)
const loaded = { exports: {} }
new Function('require', 'exports', 'module', compiled.outputText)(require, loaded.exports, loaded)
const { validateWorldEvolutionHistory: validate } = loaded.exports
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x) : Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}'
const sha = x => createHash('sha256').update(canonical(x)).digest('hex')
const identity = { ownerId: 'fixture-owner', playerId: 'fixture-player', worldId: 'fixture-world', worldSeed: 'fixture-seed', worldProfileId: 'fixture-profile', regionId: 'fixture-region' }
const initial = { cursor: 0, tick: 0, stateVersion: 0, logicalEndUtc: '2020-01-01T00:00:00.000Z', eventSha256: null }
function append(query, kind = 'evolution') {
  const p = query.committedHead, durationSeconds = kind === 'evolution' ? 86400 : 0
  const content = { projectionVersion: 'world-evolution-history-projection-v1', origin: 'world_lived_event', identity: structuredClone(identity), eventId: 'fixture-event-' + (p.cursor + 1), businessKey: sha(['fixture-business', p.cursor + 1]), cursor: p.cursor + 1, eventKind: kind, fromTick: p.tick, toTick: p.tick + (kind === 'evolution' ? 1 : 0), fromStateVersion: p.stateVersion, toStateVersion: p.stateVersion + 1,
    interval: { logicalStartUtc: p.logicalEndUtc, logicalEndUtc: new Date(Date.parse(p.logicalEndUtc) + durationSeconds * 1000).toISOString(), durationSeconds }, previousEventSha256: p.eventSha256, domainAfterSha256: sha(['fixture-domain', p.cursor + 1]), reasonRefs: [sha('fixture-reason')] }
  const core = structuredClone(content); delete core.projectionVersion; delete core.origin
  const originalEvent = { schemaVersion: 'world-evolution-event-v1', ...structuredClone(core), extraDomainEvidence: { fixtureOnly: true, note: 'integrity-bound but not semantically qualified' } }
  originalEvent.eventSha256 = sha(originalEvent)
  const entry = { originalEvent, content, projectionSha256: sha(content) }; query.events.push(entry)
  query.committedHead = { cursor: content.cursor, tick: content.toTick, stateVersion: content.toStateVersion, logicalEndUtc: content.interval.logicalEndUtc, eventSha256: originalEvent.eventSha256 }
  return query
}
function fixture(n = 3) {
  const q = { identity: structuredClone(identity), startAnchor: structuredClone(initial), committedHead: structuredClone(initial), limits: { maxEvents: 16, maxBytes: 32768, minimumContextEvents: 2 }, events: [] }
  for (let i = 0; i < n; i++) append(q, i === 1 ? 'maintenance' : 'evolution')
  return q
}
function rejected(mutator, why) { const q = fixture(); mutator(q); assert.throws(() => validate(q), why) }
function changeCore(q, index, mutator) {
  const entry = q.events[index]; mutator(entry.content)
  for (const [key, value] of Object.entries(entry.content)) if (!['projectionVersion', 'origin'].includes(key)) entry.originalEvent[key] = structuredClone(value)
  const original = structuredClone(entry.originalEvent); delete original.eventSha256
  entry.originalEvent.eventSha256 = sha(original); entry.projectionSha256 = sha(entry.content)
}

test('mixed evolution and maintenance form one immutable internal chain, never production proof', () => {
  const q = fixture(), before = structuredClone(q), out = validate(q)
  assert.equal(out.status, 'chain_matches_supplied_anchors'); assert.equal(out.selectedCount, 3)
  assert.equal(out.productionReady, false); assert.equal(out.commitAuthenticityVerified, false); assert.equal(out.validationOnly, true)
  assert.equal(out.contentSha256, sha(q)); assert.equal(out.inputBytes, Buffer.byteLength(canonical(q)))
  assert.deepEqual(q, before); assert(Object.isFrozen(out.events[0].content.identity))
  q.events[0].content.eventId = 'mutated'; assert.equal(out.events[0].content.eventId, 'fixture-event-1')
})
test('a complete suffix uses explicit previous anchor and never deletes original older events', () => {
  const q = fixture(), original = structuredClone(q), first = q.events.shift()
  q.startAnchor = { cursor: 1, tick: 1, stateVersion: 1, logicalEndUtc: first.content.interval.logicalEndUtc, eventSha256: first.originalEvent.eventSha256 }
  assert.equal(validate(q).selectedCount, 2); assert.equal(original.events.length, 3)
  q.startAnchor.eventSha256 = null; assert.throws(() => validate(q), /hash/)
})
test('empty genesis and insufficient nonempty history expose qualification gaps', () => {
  const q = fixture(0); q.limits.minimumContextEvents = 0
  assert.equal(validate(q).status, 'cold_start_qualification_missing')
  assert.equal(validate(fixture(1)).status, 'minimum_history_missing')
  const nonempty = fixture(); nonempty.startAnchor = structuredClone(nonempty.committedHead); nonempty.events = []
  assert.throws(() => validate(nonempty), /empty_suffix_not_genesis/)
})
test('no caller boolean, external archive or extra field creates committed/cold-start trust', () => {
  for (const key of ['passed', 'committed', 'coldStart', 'productionReady']) rejected(q => { q[key] = true }, /fields/)
  rejected(q => { q.events[0].content.origin = 'external_archival_context' }, /projection_origin/)
  rejected(q => { q.events[0].content.extra = 'future' }, /fields/)
  rejected(q => { q.events[0].content.projectionVersion = 'world-evolution-event-v1' }, /projection_origin/)
})
test('cross-world, tamper, duplicate, skipped, reversed and future rows are rejected', () => {
  rejected(q => changeCore(q, 0, e => { e.identity.playerId = 'another-player' }), /cross_world/)
  rejected(q => { q.events[0].content.domainAfterSha256 = 'b'.repeat(64) }, /original_projection_mismatch/)
  rejected(q => changeCore(q, 1, e => { e.eventId = q.events[0].content.eventId }), /duplicate_event/)
  rejected(q => changeCore(q, 1, e => { e.businessKey = q.events[0].content.businessKey }), /duplicate_event/)
  rejected(q => { q.events.splice(1, 1) }, /suffix_coverage/)
  rejected(q => { q.events.reverse() }, /counter_chain/)
  rejected(q => changeCore(q, 0, e => { e.previousEventSha256 = 'a'.repeat(64) }), /hash_chain/)
  rejected(q => changeCore(q, 0, e => { e.cursor = 20 }), /counter_chain/)
})
test('head counters, logical time and actual content digest all bind the suffix', () => {
  rejected(q => { q.committedHead.eventSha256 = 'a'.repeat(64) }, /committed_head_mismatch/)
  rejected(q => { q.committedHead.tick-- }, /committed_head_mismatch/)
  rejected(q => { q.committedHead.logicalEndUtc = '2020-01-04T00:00:00.000Z' }, /committed_head_mismatch/)
  rejected(q => { q.committedHead.stateVersion++ }, /anchor_counters/)
})
test('evolution moves one tick and time; maintenance moves version/cursor only', () => {
  rejected(q => changeCore(q, 1, e => { e.toTick++ }), /maintenance_transition/)
  rejected(q => changeCore(q, 0, e => { e.toTick += 2 }), /evolution_transition/)
  rejected(q => changeCore(q, 0, e => { e.toStateVersion += 1 }), /counter_chain/)
  rejected(q => changeCore(q, 0, e => { e.eventKind = 'failure_attempt' }), /maintenance_transition/)
})
test('invalid UTC, millisecond precision, gaps and duration disagreement reject', () => {
  rejected(q => changeCore(q, 0, e => { e.interval.logicalStartUtc = '2020-02-30T00:00:00.000Z' }), /utc/)
  rejected(q => changeCore(q, 0, e => { e.interval.logicalEndUtc = '2020-01-02T00:00:00Z' }), /utc/)
  rejected(q => changeCore(q, 0, e => { e.interval.durationSeconds = 86400.0001 }), /duration/)
  rejected(q => changeCore(q, 1, e => { e.interval.logicalStartUtc = '2020-01-01T00:00:00.000Z' }), /duration/)
  rejected(q => { q.events[0].content.interval.durationSeconds = Infinity }, /number/)
})
test('original additional evidence and projections have separate hashes; changed originals cannot retain a head', () => {
  const q = fixture(1), oldProjection = q.events[0].projectionSha256, oldHash = q.events[0].originalEvent.eventSha256
  q.events[0].originalEvent.extraDomainEvidence.note = 'changed original evidence'
  assert.throws(() => validate(q), /original_event_hash/)
  const original = structuredClone(q.events[0].originalEvent); delete original.eventSha256
  q.events[0].originalEvent.eventSha256 = sha(original)
  assert.notEqual(q.events[0].originalEvent.eventSha256, oldHash); assert.equal(q.events[0].projectionSha256, oldProjection)
  assert.throws(() => validate(q), /committed_head_mismatch/)
  q.committedHead.eventSha256 = q.events[0].originalEvent.eventSha256
  assert.equal(validate(q).commitAuthenticityVerified, false)
  q.events[0].content.interval.durationSeconds = 1; q.events[0].projectionSha256 = sha(q.events[0].content)
  assert.throws(() => validate(q), /original_projection_mismatch/)
})
test('count and bytes are bounded before deep clone, output also obeys the byte cap', () => {
  rejected(q => { q.limits.maxEvents = 2 }, /event_budget/)
  rejected(q => { q.limits.maxEvents = 5000000 }, /limits/)
  rejected(q => { q.limits.maxBytes = 300 }, /byte_budget/)
  const q = fixture(0); q.limits.maxBytes = Buffer.byteLength(canonical(q)); assert.throws(() => validate(q), /byte_budget/)
  rejected(q => { q.events[0].content.eventId = 'x'.repeat(40000) }, /byte_budget/)
})
test('accessors, sparse arrays, symbols, cycles, unsafe numbers and foreign prototypes reject', () => {
  let invoked = false; const q = fixture(); Object.defineProperty(q, 'events', { enumerable: true, get() { invoked = true; return [] } })
  assert.throws(() => validate(q), /accessor/); assert.equal(invoked, false)
  rejected(q => { delete q.events[1] }, /sparse/)
  rejected(q => { q.events.extra = 1 }, /extra_array/)
  rejected(q => { q.events[0].content[Symbol('hidden')] = 1 }, /symbol/)
  rejected(q => { q.events[0].content.reasonRefs = q.events }, /cycle/)
  rejected(q => { q.events[0].content.cursor = Number.MAX_SAFE_INTEGER + 1 }, /number/)
  rejected(q => { Object.setPrototypeOf(q.events[0].content, new Date()) }, /prototype/)
})
