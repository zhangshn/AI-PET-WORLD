import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildNaturalWorldEvolutionDiagnosticInput, buildEvolutionDiagnosticFeatures,
  createEvolutionInputReader, EVOLUTION_ARCHIVE, EVOLUTION_STORE } from '../lib/natural-world-evolution-input.mjs'
import { BASELINE_SELECTION, baselineDigest, baselineSha256 } from '../lib/natural-world-baseline-proof.mjs'

// These are current-source CPU component checks using the fixed immutable145/137 bytes.
// They never call the CLI, create a run, infer a model, or write any world file.
const io = createEvolutionInputReader()
const before = baselineSha256(fs.readFileSync(EVOLUTION_STORE))
const read = (p, max) => io.read(p, max)
let result
test('actual fixed world and source produce only the first7x4 diagnostic matrix', () => {
  result = buildNaturalWorldEvolutionDiagnosticInput({ read })
  const f = result.modelFeatures
  assert.deepEqual(f.shape, [7, 4])
  assert.deepEqual(f.fieldOrder, ['PRECTOTCORR', 'RH2M', 'T2M', 'WS2M'])
  assert.deepEqual(f.units, ['mm/day', '%', 'C', 'm/s'])
  assert.equal(f.values.length, 7)
  assert.equal(f.values.flat().length, 28)
  assert.equal(f.dates[0], '20200101'); assert.equal(f.dates.at(-1), '20200107')
  assert.equal(f.targetPeriod.startUtc, '2020-01-08T00:00:00.000Z')
  const raw = JSON.parse(read(EVOLUTION_ARCHIVE.sourcePath, 8 * 1024 * 1024))
  assert.deepEqual(f.values, f.dates.map(d => f.fieldOrder.map(k => raw.properties.parameter[k][d])))
  assert.ok(!JSON.stringify(f).includes('climate'))
  assert.ok(!Object.hasOwn(f, 'target') && !Object.hasOwn(result, 'labels'))
  assert.equal(result.worldBinding.metadataOnly, true)
  assert.equal(result.worldBinding.historicalArchiveState, false)
  assert.equal(result.archiveContext.notWorldExperiencedEvents, true)
  assert.equal(result.worldClock.logicalTime, null)
  assert.deepEqual(result.worldHistory.events, [])
  for (const k of ['productionReady', 'modelExecuted', 'stateCommitted', 'tickAdvanced', 'evolutionQualified']) assert.equal(result.readiness[k], false)
  assert.equal(result.capabilityObservation.worldEvolutionScopeReaderSupported, null)
  assert.equal(result.capabilityObservation.scopeAssessment, 'not_performed_by_diagnostic_entry')
  assert.match(result.capabilityObservation.readerSourceRef.sha256, /^[a-f0-9]{64}$/)
  const { inputContentSha256, ...featureContent } = f
  assert.equal(inputContentSha256, baselineDigest(featureContent))
  const { contentSha256, observedAtUtc, ...content } = result
  assert.ok(observedAtUtc); assert.equal(contentSha256, baselineDigest(content))
  assert.ok(Object.isFrozen(result.modelFeatures.values[0]))
})
test('cross-world selection cannot bind an unrelated world', () => {
  assert.throws(() => buildNaturalWorldEvolutionDiagnosticInput({ read: (p, max) => {
    const b = read(p, max)
    if (p !== BASELINE_SELECTION) return b
    const s = JSON.parse(b); s.identity.worldId = 'other-world'; return Buffer.from(JSON.stringify(s))
  } }), /selection_identity/)
})
test('modified or future-injected source cannot retain frozen archive identity', () => {
  for (const change of [s => { s.properties.parameter.T2M['20200101'] += 1 },
    s => { s.properties.parameter.T2M['20200201'] = 99 }]) {
    assert.throws(() => buildNaturalWorldEvolutionDiagnosticInput({ read: (p, max) => {
      const b = read(p, max); if (p !== EVOLUTION_ARCHIVE.sourcePath) return b
      const s = JSON.parse(b); change(s); return Buffer.from(JSON.stringify(s))
    } }), /bound_bytes/)
  }
})
test('lookalike or serialized daily source cannot enter feature projection', () => {
  assert.throws(() => buildEvolutionDiagnosticFeatures({ schemaVersion: 'natural-world-daily-source-candidate-v1', records: [] }), /reader|owned|provenance|source/)
})
test('changed Store bytes fail before input preparation', () => {
  assert.throws(() => buildNaturalWorldEvolutionDiagnosticInput({ read: (p, max) => {
    const b = read(p, max); return p === EVOLUTION_STORE ? Buffer.concat([b, Buffer.from(' ')]) : b
  } }), /read_bytes|read_sha|digest|bytes/)
})
test('stable feature/content identities and no tick, RNG, or production file changes', () => {
  const second = buildNaturalWorldEvolutionDiagnosticInput({ read })
  assert.equal(second.modelFeatures.inputContentSha256, result.modelFeatures.inputContentSha256)
  assert.equal(second.contentSha256, result.contentSha256)
  assert.equal(second.worldBinding.tick, 0); assert.equal(second.worldBinding.stateVersion, 0)
  assert.equal(second.worldBinding.eventCursor, 0)
  assert.equal(baselineSha256(fs.readFileSync(EVOLUTION_STORE)), before)
  assert.equal(io.coverage().bytes < 16 * 1024 * 1024, true)
})
