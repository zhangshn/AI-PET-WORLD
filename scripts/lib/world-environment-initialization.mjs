import { types } from 'node:util'
import { BASELINE_IDENTITY, baselineDigest, baselineJson, baselineSha256, verifyNaturalRecordBytes }
  from './natural-world-baseline-proof.mjs'
import { EVOLUTION_ARCHIVE, EVOLUTION_STORE, createEvolutionInputReader, buildEvolutionDiagnosticFeatures }
  from './natural-world-evolution-input.mjs'
import { readPowerDailySource } from './natural-world-temporal-data.mjs'

const SELF = 'scripts/lib/world-environment-initialization.mjs'
const EPOCH = '2020-01-08T00:00:00.000Z'
const WORLD_SHA = '93a6202c69b470ac79094ed1686889e7a85605a3554f5728be8df414ca569868'
const MODEL_PATH = '.runtime/ai-painter/controller-repair-reviews/world-environment-humidity-153-20261029/model-run-v1/checkpoint.pt'
const MODEL_SHA = '36a5e5973228295f38392b50680868331caab7b1588e3fc10f54d2f084ce05c8'
const FIELDS = ['PRECTOTCORR', 'RH2M', 'T2M', 'WS2M'], UNITS = ['mm/day', '%', 'C', 'm/s']
const EXPECTED_SOURCE = { start: '20200101', end: '20200131', latitude: 14.5078,
  longitude: 101.895, returnedCoordinates: [101.895, 14.508] }
const PINNED_CODE = [
  ['scripts/lib/natural-world-evolution-input.mjs', '61f040a7e332d6159a03155a6eaf6057cb306d342386b0e894d926559af40666'],
  ['scripts/lib/natural-world-temporal-data.mjs', 'd43bd95b50f190545d28229a6e0ff5e8e1fb4c57f7fc43f2fdceb120c35acd49'],
  ['scripts/lib/natural-world-baseline-proof.mjs', 'dd76d5e0d385f7fbb33efcc7f1d4e3033b41ffe4554176b57edcb31194d4cace'],
  ['ml/ai-painter/scripts/world_environment_humidity.py', 'b3e0788504f52eaeab44fb556acced7b32d5a79af3ab47e6a0faf12df0762928'],
  ['ml/ai-painter/scripts/world_environment_holdout.py', 'cf8b2555422b775a6b5bed2c86320e93f810a14d59b127d5da2d7f04a78a840a'],
  ['ml/ai-painter/scripts/world_environment_stability_wind.py', '718d4736db582deb067c2fa57d375e94f1cc928d13b5ee81a9a6893c8d307e13'],
  ['ml/ai-painter/scripts/world_environment_stability.py', 'a0f9d12e07eca5b7d9c2611935c6f70c00818f25ee910edc5dfe22ad19a9638e'],
  ['ml/ai-painter/scripts/world_environment_comparison.py', 'c68f38252e3ed743fa33769d5d0432d8f19da0b6f6563bbd900d27c92241f1b6'],
  ['ml/ai-painter/scripts/world_environment_pilot.py', 'd77135fec15215cea671f3b949ff92cb62fa61b6c81db82f4ddb33317dd07a51'],
]
export const INITIALIZATION_REFERENCE_PATHS = Object.freeze([
  EVOLUTION_STORE, EVOLUTION_ARCHIVE.sourcePath, EVOLUTION_ARCHIVE.receiptPath, MODEL_PATH, SELF, ...PINNED_CODE.map(([p]) => p),
])
function need(ok, code) { if (!ok) throw new Error('world_environment_initialization_' + code) }
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

/** Fixed retrospective preparation only. No injected reader, model execution,
 * authority flag, Store write, epoch choice or external source override. */
export function prepareWorldEnvironmentInitialization(options = {}) {
  need(options && typeof options === 'object' && !types.isProxy(options) && Object.getPrototypeOf(options) === Object.prototype
    && Reflect.ownKeys(options).every(k => k === 'projectRoot'), 'options')
  if (Object.hasOwn(options, 'projectRoot')) need(Object.hasOwn(Object.getOwnPropertyDescriptor(options, 'projectRoot'), 'value'), 'options_accessor')
  const projectRoot = options.projectRoot ?? process.cwd()
  need(typeof projectRoot === 'string' && projectRoot.length > 0, 'project_root')
  const { read } = createEvolutionInputReader(projectRoot)
  const binding = (p, bytes) => ({ path: p, sha256: baselineSha256(bytes), bytes: bytes.length })
  const bound = (p, expected, max) => {
    const bytes = read(p, max); need(baselineSha256(bytes) === expected, 'binding_sha:' + p); return bytes
  }
  const worldBytes = read(EVOLUTION_STORE, 512 * 1024), observedWorld = baselineJson(worldBytes, 512 * 1024)
  const environment = observedWorld.worldState?.payload?.environment
  need(observedWorld.tick === 0 && observedWorld.stateVersion === 0 && observedWorld.eventCursor === 0, 'already_advanced')
  need(environment && !Object.hasOwn(environment, 'evolution'), 'already_initialized')
  need(environment.localTime?.status === 'unknown' && environment.weather?.status === 'unknown', 'existing_clock_or_weather')
  need(baselineSha256(worldBytes) === WORLD_SHA, 'world_binding_sha')
  const world = verifyNaturalRecordBytes(worldBytes, BASELINE_IDENTITY)
  const archiveBytes = bound(EVOLUTION_ARCHIVE.sourcePath, EVOLUTION_ARCHIVE.sourceSha256, 8192)
  const receiptBytes = bound(EVOLUTION_ARCHIVE.receiptPath, EVOLUTION_ARCHIVE.receiptSha256, 8192)
  const receipt = baselineJson(receiptBytes, 8192)
  const source = readPowerDailySource(archiveBytes, receipt, EXPECTED_SOURCE)
  // The builder admits only a reader-owned source object. Its fixed first window
  // supplies Jan1–7; later rows in the archival file never enter this candidate.
  const features = buildEvolutionDiagnosticFeatures(source)
  need(features.asOfUtc === EPOCH && features.dates.length === 7 && features.dates.every((d, i) => d === `2020010${i + 1}`)
    && features.periods.every(p => p.endUtc <= EPOCH && p.startUtc < p.endUtc), 'future_context')
  need(JSON.stringify(features.fieldOrder) === JSON.stringify(FIELDS) && JSON.stringify(features.units) === JSON.stringify(UNITS), 'feature_fields_units')
  const checkpointBytes = bound(MODEL_PATH, MODEL_SHA, 65536)
  const modelRef = { id: 'world-environment-humidity-153', version: 'world-environment-humidity-checkpoint-v1',
    ...binding(MODEL_PATH, checkpointBytes) }
  const codeBindings = PINNED_CODE.map(([p, digest]) => binding(p, bound(p, digest, 1024 * 1024)))
  codeBindings.unshift(binding(SELF, read(SELF, 1024 * 1024)))
  const worldRef = binding(EVOLUTION_STORE, worldBytes)
  const identity = { ...BASELINE_IDENTITY }
  const context = { fieldOrder: [...FIELDS], units: [...UNITS], dates: [...features.dates],
    periods: features.periods.map(p => ({ ...p })), values: features.values.map(row => [...row]), origin: 'external_archival_context' }
  const initialWeather = { fieldOrder: [...FIELDS], units: [...UNITS], values: [...context.values[6]],
    period: { logicalStartUtc: '2020-01-07T00:00:00.000Z', logicalEndUtc: EPOCH, durationSeconds: 86400 }, origin: 'simulated_archival_seed' }
  const content = {
    schemaVersion: 'world-environment-initialization-preparation-v1', taskId: 'WORLD-ENVIRONMENT-INITIALIZATION-163',
    producerId: 'world-environment-initialization-program-v1', identity,
    before: { tick: world.tick, stateVersion: world.stateVersion, eventCursor: world.eventCursor,
      fileSha256: worldRef.sha256, recordContentSha256: world.recordContentSha256,
      worldFactsPayloadSha256: world.worldFactsPayloadSha256, statePayloadSha256: world.statePayloadSha256,
      randomStateSha256: baselineDigest(world.randomState) }, worldRef,
    simulation: { epochUtc: EPOCH, meaning: 'retrospective_archival_seeded_simulation' }, context, initialWeather,
    sourceRefs: { archive: binding(EVOLUTION_ARCHIVE.sourcePath, archiveBytes), receipt: binding(EVOLUTION_ARCHIVE.receiptPath, receiptBytes) },
    sourceMetadata: { requestedCoordinates: { ...source.requestedCoordinates }, responseCoordinates: [...source.responseCoordinates],
      statistics: 'daily_UTC', acquiredAtUtc: receipt.acquiredAtUtc, publishedAtUtc: null,
      publicationAvailability: source.publicationAvailability }, modelRef, codeBindings,
    worldHistory: { origin: 'bootstrap_no_events', eventCursor: 0, events: [] },
    candidate: { environmentEvolution: { logicalEndUtc: EPOCH, weather: structuredClone(initialWeather),
      initialization: { kind: 'simulated_archival_seed', simulationEpochUtc: EPOCH, sourceWorldRef: { ...worldRef },
        contextContentSha256: baselineDigest(context), worldLivedEvents: 0, publishedAtUtc: null, productionAdmitted: false } } },
    qualification: { productionAdmitted: false, coldStartQualified: false, modelExecuted: false, modelLoaded: false, capabilityReleased: false },
  }
  const result = { ...content, contentSha256: baselineDigest(content) }
  need(Buffer.byteLength(JSON.stringify(result), 'utf8') <= 65536, 'output_budget')
  return freeze(result)
}
