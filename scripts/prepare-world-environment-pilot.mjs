import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPowerDailySource, buildCausalWindows } from './lib/natural-world-temporal-data.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = '.runtime/ai-painter/controller-repair-reviews/world-environment-pilot-147-20261029'
export const CONTRACT_SHA = '170899620754fdf3ec9bca0b19373ac83232e17379d27dd6a4efa30178d0ddbd'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
function requireValue(ok, message) { if (!ok) throw new Error(message) }

// An isolated learning input, never a production Dataset Release or world event.
export function preparePilotDataset({ sourceBytes, receipt, contractBytes, sourceBinding }) {
  requireValue(Buffer.isBuffer(contractBytes) && contractBytes.length < 65536 && sha(contractBytes) === CONTRACT_SHA, 'experiment contract identity mismatch')
  const contract = JSON.parse(contractBytes.toString('utf8'))
  const spec = contract.source
  const source = readPowerDailySource(sourceBytes, receipt, {
    start: spec.start, end: spec.end, latitude: spec.latitude, longitude: spec.longitude,
    returnedCoordinates: spec.returnedCoordinates,
  })
  const prepared = buildCausalWindows(source, { historyDays: contract.data.historyDays, splits: contract.splits })
  for (const split of prepared.summary) requireValue(split.windows === contract.data.expectedWindows[split.name], 'unexpected split window count')
  const trainSpec = contract.splits.find(x => x.name === 'train')
  const train = source.records.filter(x => x.date >= trainSpec.start && x.date <= trainSpec.end)
  requireValue(train.length === 731, 'training day count mismatch')
  const vector = row => spec.fields.map(field => row.values[field])
  return {
    schemaVersion: 'world-environment-pilot-dataset-v1', contractSha256: CONTRACT_SHA,
    sourceBinding, fieldOrder: [...spec.fields], units: [...spec.units], sourceDays: source.records.length,
    trainDays: train.map(vector), trainDates: train.map(x => x.date),
    windows: prepared.windows.map(row => ({ split: row.split, history: row.input.history.map(vector),
      historyDates: row.input.history.map(x => x.date), target: vector(row.target), targetDate: row.target.date })),
    splitSummary: prepared.summary,
    sourceQualification: 'isolated_experiment_only_not_formal_dataset_release', productionReady: false,
  }
}

async function readBounded(relative, maxBytes = 8 * 1024 * 1024) {
  // The path set is fixed by this entry; caller paths and discovery are not accepted.
  const { open } = await import('node:fs/promises')
  const file = await open(path.join(ROOT, relative), 'r')
  try {
    const size = (await file.stat()).size
    requireValue(size > 0 && size <= maxBytes, `input byte limit: ${relative}`)
    const bytes = Buffer.alloc(size + 1)
    const { bytesRead } = await file.read(bytes, 0, size + 1, 0)
    requireValue(bytesRead === size && (await file.stat()).size === size, `input changed: ${relative}`)
    return bytes.subarray(0, size)
  } finally { await file.close() }
}

async function main() {
  requireValue(process.argv.length === 2, 'this frozen experiment accepts no arguments')
  const startedAtUtc = new Date().toISOString(), start = performance.now()
  const names = ['source-response.json', 'source-receipt.json', 'experiment-contract.json', 'source-qualification.json', 'source-rights-web-readback.json']
  const raw = Object.fromEntries(await Promise.all(names.map(async name => [name, await readBounded(`${BASE}/${name}`)])))
  requireValue(Object.values(raw).reduce((n, b) => n + b.length, 0) <= 8 * 1024 * 1024, 'aggregate input byte budget exceeded')
  const qualification = JSON.parse(raw['source-qualification.json']), rightsReadback = JSON.parse(raw['source-rights-web-readback.json'])
  requireValue(qualification.status === 'source_rights_verified_for_isolated_experiment', 'source rights review missing')
  requireValue(qualification.sourceRef.sha256 === sha(raw['source-response.json']), 'rights review binds another source')
  requireValue(qualification.rightsRef.sha256 === sha(raw['source-rights-web-readback.json']), 'rights review identity mismatch')
  requireValue(rightsReadback.evidenceType === 'external_web_tool_result_not_raw_http_response' && rightsReadback.requestedUrl === 'https://forum.earthdata.nasa.gov/viewtopic.php?t=82', 'unexpected source rights review')
  // This binds the controller's source-rights review; it does not certify an HTTP
  // fetch or grant production dataset qualification by scanning a permission word.
  requireValue(raw['source-rights-web-readback.json'].includes(Buffer.from('commercial applications')) && raw['source-rights-web-readback.json'].includes(Buffer.from('public domain')), 'source-specific reviewed text missing')
  const sourceBinding = Object.fromEntries(names.map(name => [name, { path: `${BASE}/${name}`, sha256: sha(raw[name]), bytes: raw[name].length }]))
  const dataset = preparePilotDataset({ sourceBytes: raw['source-response.json'], receipt: JSON.parse(raw['source-receipt.json']), contractBytes: raw['experiment-contract.json'], sourceBinding })
  dataset.preparationCodeBindings = await Promise.all(['scripts/prepare-world-environment-pilot.mjs', 'scripts/lib/natural-world-temporal-data.mjs'].map(async p => ({ path: p, sha256: sha(await readFile(path.join(ROOT, p))) })))
  const bytes = Buffer.from(JSON.stringify(dataset))
  requireValue(bytes.length <= 8 * 1024 * 1024 && performance.now() - start < 120000, 'preparation resource budget exceeded')
  await writeFile(path.join(ROOT, BASE, 'dataset.json'), bytes, { flag: 'wx' })
  const binding = { schemaVersion: 'world-environment-pilot-dataset-binding-v1', taskId: 'WORLD-ENVIRONMENT-PILOT-147',
    path: `${BASE}/dataset.json`, sha256: sha(bytes), bytes: bytes.length, contractSha256: CONTRACT_SHA,
    startedAtUtc, finishedAtUtc: new Date().toISOString(), elapsedMs: performance.now() - start,
    sourceDays: dataset.sourceDays, windows: dataset.splitSummary, productionReady: false, modelExecuted: false, worldWrites: 0 }
  await writeFile(path.join(ROOT, BASE, 'dataset-binding.json'), `${JSON.stringify(binding, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify(binding))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(async error => {
    await writeFile(path.join(ROOT, BASE, `preparation-failure-${Date.now()}.json`), JSON.stringify({ atUtc: new Date().toISOString(), message: error.message, worldWrites: 0 }), { flag: 'wx' }).catch(() => {})
    console.error(error.message)
    process.exitCode = 1
  })
}
