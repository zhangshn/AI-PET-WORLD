import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { preparePilotDataset } from '../prepare-world-environment-pilot.mjs'

const base = '.runtime/ai-painter/controller-repair-reviews/world-environment-pilot-147-20261029/'
const contractBytes = readFileSync(base + 'experiment-contract.json')
const contract = JSON.parse(contractBytes)
function fixture() {
  const fields = contract.source.fields
  const parameter = Object.fromEntries(fields.map(f => [f, {}]))
  for (let ms = Date.parse('2020-01-01'); ms < Date.parse('2024-01-01'); ms += 86400000) {
    const d = new Date(ms).toISOString().slice(0, 10).replaceAll('-', '')
    fields.forEach((f, i) => { parameter[f][d] = i + (Number(d.slice(-2)) / 100) })
  }
  const source = { type: 'Feature', geometry: { type: 'Point', coordinates: [101.895, 14.508, 374.47] },
    properties: { parameter }, parameters: Object.fromEntries(fields.map((f, i) => [f, { units: contract.source.units[i] }])),
    header: { title: 'NASA POWER Daily Data', time_standard: 'UTC', start: '20200101', end: '20231231', sources: ['MERRA2'], fill_value: -999 } }
  const sourceBytes = Buffer.from(JSON.stringify(source))
  const receipt = { httpStatus: 200, responseBytes: sourceBytes.length, responseSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    url: 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,RH2M,T2M,WS2M&start=20200101&end=20231231&latitude=14.5078&longitude=101.895&time-standard=UTC&format=JSON' }
  return { sourceBytes, receipt, contractBytes, sourceBinding: { fixture: true } }
}

test('full windows stay within chronological partitions and normalization days only train', () => {
  const d = preparePilotDataset(fixture())
  assert.equal(d.trainDays.length, 731)
  assert.equal(d.sourceDays, 1461)
  assert.deepEqual(Object.fromEntries(d.splitSummary.map(s => [s.name, s.windows])), { train: 724, validation: 358, test: 358 })
  const used = new Map()
  for (const w of d.windows) {
    const split = contract.splits.find(s => s.name === w.split)
    for (const date of [...w.historyDates, w.targetDate]) {
      assert.ok(date >= split.start && date <= split.end)
      assert.ok(!used.has(date) || used.get(date) === w.split)
      used.set(date, w.split)
    }
    assert.ok(w.historyDates.at(-1) < w.targetDate)
  }
  assert.equal(d.productionReady, false)
})

test('changed raw bytes cannot keep acquisition receipt identity', () => {
  const f = fixture(); f.sourceBytes = Buffer.concat([f.sourceBytes, Buffer.from(' ')])
  assert.throws(() => preparePilotDataset(f), /receipt/)
})

test('split, model or budget amendments cannot silently reuse the frozen contract', () => {
  const f = fixture(); f.contractBytes = Buffer.from(JSON.stringify({ ...contract, splits: [] }))
  assert.throws(() => preparePilotDataset(f), /contract identity/)
})
