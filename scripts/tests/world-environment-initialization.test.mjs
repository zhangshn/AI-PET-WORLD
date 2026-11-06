import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareWorldEnvironmentInitialization, INITIALIZATION_REFERENCE_PATHS } from '../lib/world-environment-initialization.mjs'
import { baselineDigest, baselineSha256 } from '../lib/natural-world-baseline-proof.mjs'
import { buildEvolutionDiagnosticFeatures, EVOLUTION_ARCHIVE, EVOLUTION_STORE } from '../lib/natural-world-evolution-input.mjs'
import { readPowerDailySource } from '../lib/natural-world-temporal-data.mjs'

const root = path.resolve(import.meta.dirname, '../..')
function refHashes(projectRoot) {
  return INITIALIZATION_REFERENCE_PATHS.map(p => ({ path: p, sha256: baselineSha256(fs.readFileSync(path.join(projectRoot, p))) }))
}
function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'world-init-163-'))
  t.after(() => {
    assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep + 'world-init-163-'))
    fs.rmSync(temporary, { recursive: true, force: true })
  })
  for (const relative of INITIALIZATION_REFERENCE_PATHS) {
    const target = path.join(temporary, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, relative), target)
  }
  return temporary
}
function frozenJson(value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value))
    assert.ok(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)
    Object.values(value).forEach(frozenJson)
  } else assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value))
}

test('actual fixed world prepares only explicit historical seed, deep frozen and deterministic with no writes', () => {
  const before = refHashes(root), r = prepareWorldEnvironmentInitialization({ projectRoot: root })
  assert.equal(r.schemaVersion, 'world-environment-initialization-preparation-v1')
  assert.equal(r.identity.worldId, 'mvp-natural-world-001')
  assert.equal(r.simulation.epochUtc, '2020-01-08T00:00:00.000Z')
  assert.equal(r.simulation.meaning, 'retrospective_archival_seeded_simulation')
  assert.deepEqual(r.context.dates, ['20200101', '20200102', '20200103', '20200104', '20200105', '20200106', '20200107'])
  assert.deepEqual(r.context.values[6], [0, 56.36, 25.13, 1.47])
  assert.equal(r.context.origin, 'external_archival_context')
  assert.deepEqual(r.initialWeather.values, r.context.values[6])
  assert.equal(r.initialWeather.origin, 'simulated_archival_seed')
  assert.deepEqual(r.initialWeather.period, { logicalStartUtc: '2020-01-07T00:00:00.000Z', logicalEndUtc: '2020-01-08T00:00:00.000Z', durationSeconds: 86400 })
  assert.equal(r.sourceMetadata.publishedAtUtc, null)
  assert.equal(r.sourceMetadata.publicationAvailability, 'unknown_retrospective_offline_source')
  assert.equal(r.worldHistory.events.length, 0)
  assert.ok(Object.values(r.qualification).every(v => v === false))
  assert.equal(r.modelRef.sha256, '36a5e5973228295f38392b50680868331caab7b1588e3fc10f54d2f084ce05c8')
  assert.equal(r.candidate.environmentEvolution.initialization.contextContentSha256, baselineDigest(r.context))
  assert.deepEqual(r.candidate.environmentEvolution.weather, r.initialWeather)
  const { contentSha256, ...content } = r; assert.equal(contentSha256, baselineDigest(content))
  frozenJson(r); assert.throws(() => { r.context.values[6][0] = 9 }, TypeError)
  assert.deepEqual(prepareWorldEnvironmentInitialization({ projectRoot: root }), r)
  assert.deepEqual(refHashes(root), before)
})

test('unknown options, reader injection, accessor and Proxy objects are rejected before traps execute', () => {
  for (const key of ['read', 'reader', 'source', 'epochUtc', 'passed', 'productionAdmitted', 'worldPath', 'checkpointPath'])
    assert.throws(() => prepareWorldEnvironmentInitialization({ projectRoot: 'not-a-project', [key]: true }), /initialization_options/)
  let getter = 0, prototypeTrap = 0, getTrap = 0, keysTrap = 0
  assert.throws(() => prepareWorldEnvironmentInitialization({ get projectRoot() { getter++; return root } }), /options_accessor/)
  const proxy = new Proxy({}, { getPrototypeOf() { prototypeTrap++; return Object.prototype }, get() { getTrap++; return root }, ownKeys() { keysTrap++; return [] } })
  assert.throws(() => prepareWorldEnvironmentInitialization(proxy), /initialization_options/)
  assert.deepEqual([getter, prototypeTrap, getTrap, keysTrap], [0, 0, 0, 0])
  assert.throws(() => prepareWorldEnvironmentInitialization(Object.create({ projectRoot: root })), /initialization_options/)
})

test('serialized or caller-forged source object cannot become reader-owned history', () => {
  const bytes = fs.readFileSync(path.join(root, EVOLUTION_ARCHIVE.sourcePath))
  const receipt = JSON.parse(fs.readFileSync(path.join(root, EVOLUTION_ARCHIVE.receiptPath)))
  const source = readPowerDailySource(bytes, receipt, { start: '20200101', end: '20200131', latitude: 14.5078, longitude: 101.895, returnedCoordinates: [101.895, 14.508] })
  assert.equal(buildEvolutionDiagnosticFeatures(source).dates[6], '20200107')
  assert.throws(() => buildEvolutionDiagnosticFeatures(structuredClone(source)), /untrusted daily source/)
  assert.throws(() => buildEvolutionDiagnosticFeatures({ ...source, trainingQualified: true, runtimeQualified: true }), /untrusted daily source/)
})

test('modified source, future target, wrong units or region and forged receipt hash fail fixed bindings', t => {
  const temporary = fixture(t), sourcePath = path.join(temporary, EVOLUTION_ARCHIVE.sourcePath)
  const receiptPath = path.join(temporary, EVOLUTION_ARCHIVE.receiptPath)
  const originalSource = fs.readFileSync(sourcePath), originalReceipt = fs.readFileSync(receiptPath)
  const cases = [
    s => { s.properties.parameter.RH2M['20200107'] = 50 },
    s => { s.properties.parameter.RH2M['20200108'] = 50 },
    s => { s.header.start = '20200102' },
    s => { s.parameters.RH2M.units = 'fraction' },
    s => { s.geometry.coordinates[0] = 102 },
  ]
  for (const mutate of cases) {
    const source = JSON.parse(originalSource); mutate(source)
    const raw = Buffer.from(JSON.stringify(source)), receipt = JSON.parse(originalReceipt)
    receipt.responseSha256 = baselineSha256(raw); receipt.responseBytes = raw.length
    fs.writeFileSync(sourcePath, raw); fs.writeFileSync(receiptPath, JSON.stringify(receipt))
    assert.throws(() => prepareWorldEnvironmentInitialization({ projectRoot: temporary }), /binding_sha:/)
  }
  fs.writeFileSync(sourcePath, originalSource); fs.writeFileSync(receiptPath, originalReceipt)
  const receipt = JSON.parse(originalReceipt); receipt.acquiredAtUtc = '2020-01-01T00:00:00.000Z'
  fs.writeFileSync(receiptPath, JSON.stringify(receipt))
  assert.throws(() => prepareWorldEnvironmentInitialization({ projectRoot: temporary }), /binding_sha:/)
})

test('already initialized, advanced or modified worlds are rejected without overwriting them', t => {
  const temporary = fixture(t), worldPath = path.join(temporary, EVOLUTION_STORE), original = fs.readFileSync(worldPath)
  const cases = [
    [w => { w.worldState.payload.environment.evolution = { logicalEndUtc: '2020-01-08T00:00:00.000Z' } }, /already_initialized/],
    [w => { w.worldState.payload.environment.evolution = null }, /already_initialized/],
    [w => { w.stateVersion = 1; w.eventCursor = 1 }, /already_advanced/],
    [w => { w.tick = 1 }, /already_advanced/],
    [w => { w.worldState.payload.environment.localTime = { status: 'known', value: '2020-01-08' } }, /existing_clock_or_weather/],
    [w => { w.identity = { passed: true } }, /world_binding_sha/],
  ]
  for (const [mutate, expected] of cases) {
    const world = JSON.parse(original); mutate(world); const bytes = Buffer.from(JSON.stringify(world)); fs.writeFileSync(worldPath, bytes)
    assert.throws(() => prepareWorldEnvironmentInitialization({ projectRoot: temporary }), expected)
    assert.deepEqual(fs.readFileSync(worldPath), bytes)
  }
})

test('wrong model and changed reader code are rejected rather than silently rebound', t => {
  const temporary = fixture(t)
  for (const relative of [INITIALIZATION_REFERENCE_PATHS.find(p => p.endsWith('checkpoint.pt')), 'scripts/lib/natural-world-temporal-data.mjs']) {
    const file = path.join(temporary, relative), bytes = fs.readFileSync(file), bad = Buffer.from(bytes); bad[0] ^= 1; fs.writeFileSync(file, bad)
    assert.throws(() => prepareWorldEnvironmentInitialization({ projectRoot: temporary }), /binding_sha:/)
    fs.writeFileSync(file, bytes)
  }
})
