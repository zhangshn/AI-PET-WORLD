import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DAILY_FIELDS, TEMPORAL_LIMITS, readPowerDailySource, buildCausalWindows } from '../lib/natural-world-temporal-data.mjs'

function fixture(change = () => {}) {
  const expected = { start: '20200101', end: '20200131', latitude: 14.5078, longitude: 101.895, returnedCoordinates: [101.895, 14.508] }
  const parameter = Object.fromEntries(Object.keys(DAILY_FIELDS).map((field, i) => [field, Object.fromEntries(Array.from({ length: 31 }, (_, d) => [`202001${String(d + 1).padStart(2, '0')}`, i + d / 10]))]))
  const source = { type: 'Feature', geometry: { type: 'Point', coordinates: [101.895, 14.508] },
    header: { title: 'NASA/POWER Source Native Resolution Daily Data', sources: ['MERRA2'], fill_value: -999, time_standard: 'UTC', start: expected.start, end: expected.end },
    parameters: Object.fromEntries(Object.entries(DAILY_FIELDS).map(([field, units]) => [field, { units }])), properties: { parameter } }
  change(source)
  const bytes = Buffer.from(JSON.stringify(source))
  const query = new URLSearchParams({ ...expected, 'time-standard': 'UTC', format: 'JSON', parameters: Object.keys(DAILY_FIELDS).join(',') })
  const receipt = { httpStatus: 200, responseBytes: bytes.length, responseSha256: createHash('sha256').update(bytes).digest('hex'), url: `https://power.larc.nasa.gov/api/temporal/daily/point?${query}` }
  return { bytes, receipt, expected }
}
const read = f => readPowerDailySource(f.bytes, f.receipt, f.expected)
test('daily aggregates have next-day period end and causal disjoint splits', () => {
  const result = buildCausalWindows(read(fixture()), { historyDays: 3, splits: [
    { name: 'train', start: '20200101', end: '20200115' },
    { name: 'validation', start: '20200116', end: '20200123' },
    { name: 'test', start: '20200124', end: '20200131' }] })
  assert.deepEqual(result.summary.map(s => s.windows), [12, 5, 5])
  const seen = new Map()
  for (const window of result.windows) {
    assert.equal(window.input.asOfUtc, window.target.intervalStartUtc)
    for (const row of [...window.input.history, window.target]) {
      assert.ok(!seen.has(row.date) || seen.get(row.date) === window.split)
      seen.set(row.date, window.split)
    }
    assert.ok(window.input.history.every(row => row.date < window.target.date))
  }
  assert.equal(result.runtimeQualified, false)
})
test('source bytes are bound to actual receipt', () => {
  const f = fixture(); f.bytes[0] = 32
  assert.throws(() => read(f), /receipt/)
})
for (const [name, mutate, error] of [
  ['climatology', s => { s.header.title = 'Climatology'; }, /daily data/],
  ['wrong units', s => { s.parameters.T2M.units = 'K'; }, /unit/],
  ['missing day', s => { delete s.properties.parameter.T2M['20200115']; }, /dates/],
  ['extra date', s => { s.properties.parameter.T2M['20200201'] = 25; }, /dates/],
  ['missing value', s => { s.properties.parameter.T2M['20200115'] = -999; }, /missing/],
  ['null value', s => { s.properties.parameter.T2M['20200115'] = null; }, /invalid/],
  ['string value', s => { s.properties.parameter.T2M['20200115'] = '25'; }, /invalid/],
  ['humidity bounds', s => { s.properties.parameter.RH2M['20200115'] = 101; }, /percentage/],
  ['negative rainfall', s => { s.properties.parameter.PRECTOTCORR['20200115'] = -1; }, /negative/],
  ['wrong coordinate', s => { s.geometry.coordinates[0] = 105.5; }, /coordinate/],
  ['local solar time', s => { s.header.time_standard = 'LST'; }, /time standard/],
]) test(`reject ${name}`, () => assert.throws(() => read(fixture(mutate)), error))
test('request identity cannot be replaced by matching response metadata', () => {
  const f = fixture(); f.receipt.url = f.receipt.url.replace('14.5078', '15.5')
  assert.throws(() => read(f), /coordinate/)
})
test('reject overlapping splits and reverse training time', () => {
  const source = read(fixture())
  for (const splits of [
    [{ name: 'train', start: '20200101', end: '20200120' }, { name: 'validation', start: '20200120', end: '20200131' }],
    [{ name: 'test', start: '20200101', end: '20200115' }, { name: 'train', start: '20200116', end: '20200131' }],
  ]) assert.throws(() => buildCausalWindows(source, { historyDays: 3, splits }), /overlapping|precede/)
})
test('reject future aggregate presented as already available, missing history day, impossible date', () => {
  const config = { historyDays: 3, splits: [{ name: 'diagnostic', start: '20200101', end: '20200131' }] }
  const source = read(fixture()); assert.throws(() => { source.records[1].periodEndUtc = source.records[1].intervalStartUtc }, TypeError)
  const gap = structuredClone(source); gap.records.splice(10, 1)
  assert.throws(() => buildCausalWindows(gap, config), /untrusted daily source/)
  assert.throws(() => buildCausalWindows(read(fixture()), { ...config, splits: [{ name: 'diagnostic', start: '20200101', end: '20200231' }] }), /calendar/)
})
test('history windows are copied; target changes cannot mutate inputs', () => {
  const source = read(fixture())
  const result = buildCausalWindows(source, { historyDays: 7, splits: [{ name: 'diagnostic', start: '20200101', end: '20200131' }] })
  assert.equal(result.windows.length, 24)
  const before = JSON.stringify(result.windows[0].input)
  assert.throws(() => { result.windows[0].target.values.T2M = 500 }, TypeError)
  assert.throws(() => { source.records[0].values.T2M = 500 }, TypeError)
  assert.equal(JSON.stringify(result.windows[0].input), before)
})

const diagnostic = { historyDays: 7, splits: [{ name: 'diagnostic', start: '20200101', end: '20200131' }] }

test('reader ownership rejects fabricated, serialized and caller-rehashed DTO reentry', () => {
  const source = read(fixture())
  const forged = structuredClone(source); forged.records[0].values.futureTarget = source.records[7].values.T2M
  forged.sourceSha256 = createHash('sha256').update(JSON.stringify(forged)).digest('hex')
  for (const value of [{ ...source }, structuredClone(source), JSON.parse(JSON.stringify(source)), forged,
    { schemaVersion: source.schemaVersion, records: source.records, sourceSha256: source.sourceSha256, passed: true }]) {
    assert.throws(() => buildCausalWindows(value, diagnostic), /untrusted daily source/)
  }
  const f = fixture(), rebuilt = readPowerDailySource(Buffer.from(f.bytes), JSON.parse(JSON.stringify(f.receipt)), structuredClone(f.expected))
  assert.equal(buildCausalWindows(rebuilt, diagnostic).windows.length, 24)
})

test('normalized source and derived windows reject mutation, future fields and changed source identity', () => {
  const source = read(fixture())
  for (const mutate of [s => { s.records[0].values.T2M = -999 }, s => { s.records[0].values.T2M = null },
    s => { s.records[0].values.T2M = NaN }, s => { s.records[0].values.futureTarget = 30 },
    s => { s.sourceSha256 = 'caller_fake' }, s => { s.units.T2M = 'K' }, s => { s.records.push(s.records[0]) }]) {
    assert.throws(() => mutate(source), TypeError)
  }
  const result = buildCausalWindows(source, diagnostic)
  assert(Object.isFrozen(result.windows[0].input.history[0].values)); assert(Object.isFrozen(result.sourceBinding))
  assert.equal(Object.keys(result.windows[0].input.history[0].values).sort().join(','), Object.keys(DAILY_FIELDS).sort().join(','))
  assert(result.windows.every(w => w.sourceSha256 === source.sourceSha256))
})

test('reader snapshots bytes, receipt and expected; later caller mutation cannot relabel prior history', () => {
  const f = fixture(), source = read(f), oldSha = source.sourceSha256
  f.bytes.fill(32); f.receipt.responseSha256 = '0'.repeat(64); f.expected.latitude = 0
  const result = buildCausalWindows(source, diagnostic)
  assert.equal(result.sourceBinding.rawSourceSha256, oldSha); assert.equal(result.windows.length, 24)
  assert.throws(() => read(f), /receipt/)
  const changed = fixture(s => { s.properties.parameter.T2M['20200101'] = 37 })
  const newlyRead = read(changed)
  assert.notEqual(newlyRead.sourceSha256, oldSha)
  assert.equal(buildCausalWindows(newlyRead, diagnostic).windows[0].input.history[0].values.T2M, 37)
  assert.equal(result.windows[0].input.history[0].values.T2M, 2)
})

test('unknown feature, config and expected keys are rejected; getters are not executed', () => {
  assert.throws(() => read(fixture(s => { s.properties.parameter.futureTarget = s.properties.parameter.T2M })), /fields mismatch/)
  assert.throws(() => read(fixture(s => { s.parameters.futureTarget = { units: 'C' } })), /metadata fields/)
  const f = fixture(); f.expected.futureTarget = 30; assert.throws(() => read(f), /unknown field/)
  const g = fixture(); let getterCalls = 0
  Object.defineProperty(g.receipt, 'responseSha256', { get() { getterCalls++; return '0'.repeat(64) }, enumerable: true })
  assert.throws(() => read(g), /accessor/); assert.equal(getterCalls, 0)
  for (const config of [{ ...diagnostic, futureTarget: 99 }, { ...diagnostic, splits: [{ ...diagnostic.splits[0], futureTarget: 99 }] },
    { ...diagnostic, limits: { unknown: 1 } }]) assert.throws(() => buildCausalWindows(read(fixture()), config), /unknown field/)
})

for (const [name, field, value] of [['negative wind', 'WS2M', -1], ['below absolute zero', 'T2M', -274],
  ['infinite quantity', 'T2M', Infinity], ['NaN quantity', 'T2M', NaN], ['boolean quantity', 'T2M', false]]) {
  test(`reject invalid ${name}`, () => assert.throws(() => read(fixture(s => { s.properties.parameter[field]['20200101'] = value })), /negative|absolute zero|invalid/))
}

function longFixture(count) {
  const f = fixture(), raw = JSON.parse(f.bytes), start = Date.parse('2000-01-01T00:00:00Z')
  const dates = Array.from({ length: count }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10).replaceAll('-', ''))
  f.expected.start = dates[0]; f.expected.end = dates.at(-1); raw.header.start = f.expected.start; raw.header.end = f.expected.end
  for (const [i, field] of Object.keys(DAILY_FIELDS).entries()) raw.properties.parameter[field] = Object.fromEntries(dates.map((date, n) => [date, i + (n % 30) / 10]))
  f.bytes = Buffer.from(JSON.stringify(raw)); f.receipt.responseBytes = f.bytes.length; f.receipt.responseSha256 = createHash('sha256').update(f.bytes).digest('hex')
  const url = new URL(f.receipt.url); url.searchParams.set('start', f.expected.start); url.searchParams.set('end', f.expected.end); f.receipt.url = url.href
  return f
}

test('window count, copied rows and output bytes are rejected before any history cloning', () => {
  const countSource = longFixture(5000), rowSource = longFixture(1000)
  const cases = [
    [read(countSource), { historyDays: 7, splits: [{ name: 'diagnostic', start: countSource.expected.start, end: countSource.expected.end }] }, /window count/],
    [read(rowSource), { historyDays: 100, splits: [{ name: 'diagnostic', start: rowSource.expected.start, end: rowSource.expected.end }] }, /copied row/],
    [read(fixture()), { ...diagnostic, limits: { maxOutputBytes: 9000 } }, /output byte/],
    [read(fixture()), { ...diagnostic, historyDays: 31, limits: { maxOutputBytes: 1 } }, /output byte/],
  ]
  const original = globalThis.structuredClone; let clones = 0
  globalThis.structuredClone = () => { clones++; throw Error('clone must not start') }
  try { for (const [source, config, message] of cases) assert.throws(() => buildCausalWindows(source, config), message) }
  finally { globalThis.structuredClone = original }
  assert.equal(clones, 0)
})

test('limits can only tighten and successful result remains within declared serialized budget', () => {
  for (const limits of [{ maxWindows: TEMPORAL_LIMITS.maxWindows + 1 }, { maxCopiedRows: 0 }, { maxOutputBytes: Infinity }, { maxWindows: 1.5 }]) {
    assert.throws(() => buildCausalWindows(read(fixture()), { ...diagnostic, limits }), /limit|invalid number/)
  }
  const result = buildCausalWindows(read(fixture()), { ...diagnostic, limits: { maxWindows: 24, maxCopiedRows: 192, maxOutputBytes: 65536 } })
  assert.equal(result.windows.length, 24); assert.equal(result.resourceUse.copiedRows, 192)
  assert(Buffer.byteLength(JSON.stringify(result)) <= result.resourceUse.maximumSerializedBytes)
  assert(result.resourceUse.maximumSerializedBytes <= 65536)
  assert.throws(() => buildCausalWindows(read(fixture()), { ...diagnostic, limits: { maxWindows: 23 } }), /window count/)
})

test('exact split boundaries exclude warmup crossing and preserve future targets outside inputs', () => {
  const source = read(fixture()), config = { historyDays: 7, splits: [
    { name: 'train', start: '20200101', end: '20200108' },
    { name: 'validation', start: '20200109', end: '20200115' },
    { name: 'test', start: '20200116', end: '20200131' }] }
  const result = buildCausalWindows(source, config)
  assert.deepEqual(result.summary.map(x => x.windows), [1, 0, 9])
  assert.equal(result.windows[0].target.date, '20200108')
  assert.equal(result.windows[1].input.history[0].date, '20200116')
  for (const window of result.windows) assert(window.input.history.every(r => r.periodEndUtc <= window.input.asOfUtc && r.date < window.target.date))
  assert.throws(() => buildCausalWindows(source, { ...diagnostic, splits: [{ name: 'diagnostic', start: '20191231', end: '20200131' }] }), /outside source coverage/)
})
