import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { BASELINE_IDENTITY, BASELINE_SELECTION, baselineCanonical, baselineDigest, baselineJson,
  baselineSha256, verifyNaturalRecordBytes, verifyNaturalWorldBaselineProof } from './natural-world-baseline-proof.mjs'
import { readPowerDailySource, buildCausalWindows } from './natural-world-temporal-data.mjs'

export const EVOLUTION_INPUT_LIMITS = Object.freeze({ maxReadBytes: 16 * 1024 * 1024,
  maxFiles: 512, maxOutputBytes: 2 * 1024 * 1024, maxElapsedMs: 115000 })
const SOURCE_ROOT = '.runtime/ai-painter/controller-repair-reviews/world-evolution-scope-137-20261028/daily-source-pilot-v1/'
export const EVOLUTION_ARCHIVE = Object.freeze({ sourcePath: SOURCE_ROOT + 'response.json',
  sourceSha256: '008167c9aa000feb9197b7f3dcbfed1e94e889473486cd33085045204cae1ef8',
  receiptPath: SOURCE_ROOT + 'receipt.json', receiptSha256: '5647d9a1b05d7cd6582c59669b39fe4e87f7d94b5bc13f2f3ffe3e7c931dfd34' })
export const EVOLUTION_REGISTRY = 'data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json'
export const EVOLUTION_RELEASE_READER = 'scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs'
export const EVOLUTION_STORE = 'data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json'
const FIELDS = Object.freeze(['PRECTOTCORR', 'RH2M', 'T2M', 'WS2M'])
const UNITS = Object.freeze(['mm/day', '%', 'C', 'm/s'])
const EXPECTED = Object.freeze({ start: '20200101', end: '20200131', latitude: 14.5078,
  longitude: 101.895, returnedCoordinates: Object.freeze([101.895, 14.508]) })
function need(ok, code) { if (!ok) throw new Error('evolution_input_' + code) }
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) } return v }
function same(a, b) { return baselineCanonical(a) === baselineCanonical(b) }

/** Existing .runtime mount is pinned once; descendant links and hardlinks are rejected. */
export function createEvolutionInputReader(root = process.cwd()) {
  const absoluteRoot = fs.realpathSync(root), cache = new Map(), started = performance.now()
  const runtimeRoot = fs.realpathSync(path.join(absoluteRoot, '.runtime'))
  let bytesRead = 0
  const read = (logical, maxBytes = EVOLUTION_INPUT_LIMITS.maxReadBytes) => {
    need(typeof logical === 'string' && logical.length <= 2048 && !logical.includes('\\') &&
      !logical.includes(':') && !logical.startsWith('/') && logical.split('/').every(x => x && x !== '.' && x !== '..'), 'read_path')
    need(Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= EVOLUTION_INPUT_LIMITS.maxReadBytes, 'read_limit')
    need(performance.now() - started <= EVOLUTION_INPUT_LIMITS.maxElapsedMs, 'read_timeout')
    if (cache.has(logical)) { const b = cache.get(logical); need(b.length <= maxBytes, 'cached_file_limit'); return Buffer.from(b) }
    need(cache.size < EVOLUTION_INPUT_LIMITS.maxFiles, 'file_budget')
    const segments = logical.split('/'), runtime = segments[0] === '.runtime'
    let filename = runtime ? runtimeRoot : absoluteRoot
    if (runtime) need(fs.realpathSync(path.join(absoluteRoot, '.runtime')) === runtimeRoot, 'runtime_mount_changed')
    for (const segment of runtime ? segments.slice(1) : segments) {
      filename = path.join(filename, segment)
      const st = fs.lstatSync(filename)
      need(!st.isSymbolicLink(), 'linked_path')
    }
    const st = fs.lstatSync(filename)
    need(st.isFile() && st.nlink === 1 && st.size <= maxBytes && bytesRead + st.size <= EVOLUTION_INPUT_LIMITS.maxReadBytes, 'file_or_byte_budget')
    need(fs.realpathSync(filename) === filename, 'resolved_path')
    const fd = fs.openSync(filename, fs.constants.O_RDONLY)
    let b
    try {
      const before = fs.fstatSync(fd)
      need(before.isFile() && before.nlink === 1 && before.size === st.size && before.ino === st.ino, 'read_race')
      const storage = Buffer.alloc(before.size + 1)
      let offset = 0, n
      do { n = fs.readSync(fd, storage, offset, storage.length - offset, offset); offset += n } while (n && offset < storage.length)
      b = storage.subarray(0, offset)
      const after = fs.fstatSync(fd)
      need(b.length === before.size && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'read_changed')
    } finally { fs.closeSync(fd) }
    bytesRead += b.length; cache.set(logical, b)
    return Buffer.from(b)
  }
  return { read, coverage: () => ({ files: cache.size, bytes: bytesRead,
    refs: [...cache].map(([p, b]) => ({ path: p, sha256: baselineSha256(b), bytes: b.length })) }) }
}

/** The only model feature projection. A reader-owned source is required by temporal-data. */
export function buildEvolutionDiagnosticFeatures(source) {
  const windows = buildCausalWindows(source, { historyDays: 7,
    splits: [{ name: 'diagnostic', start: '20200101', end: '20200131' }] })
  need(windows.windows.length === 24, 'archive_window_count')
  const w = windows.windows[0]
  need(w.target.date === '20200108' && w.input.history.length === 7 && w.input.horizonSeconds === 86400, 'fixed_window')
  const dates = w.input.history.map(r => r.date)
  need(dates.every((d, i) => d === '2020010' + (i + 1) && d < w.target.date), 'future_or_date')
  const features = { schemaVersion: 'natural-world-seven-day-weather-features-v1',
    sourceSha256: source.sourceSha256, fieldOrder: [...FIELDS], units: [...UNITS],
    shape: [7, 4], dates,
    periods: w.input.history.map(r => ({ startUtc: r.intervalStartUtc, endUtc: r.periodEndUtc })),
    asOfUtc: w.input.asOfUtc, asOfSemantics: 'retrospective_completed_day_assumption_not_publication',
    horizonSeconds: 86400, targetPeriod: { startUtc: w.target.intervalStartUtc, endUtc: w.target.periodEndUtc },
    values: w.input.history.map(r => FIELDS.map(f => r.values[f])) }
  need(features.asOfUtc === '2020-01-08T00:00:00.000Z' && features.values.flat().every(Number.isFinite), 'matrix')
  return freeze({ ...features, inputContentSha256: baselineDigest(features) })
}

/** No model invocation, world mutation, ticket derivation or release registration. */
export function buildNaturalWorldEvolutionDiagnosticInput({ read }) {
  need(typeof read === 'function', 'reader_required')
  const bound = (p, expectedSha, max) => {
    const b = read(p, max)
    need(Buffer.isBuffer(b) && b.length <= max && (!expectedSha || baselineSha256(b) === expectedSha), 'bound_bytes')
    return b
  }
  const selectionBytes = bound(BASELINE_SELECTION, null, 64 * 1024)
  const selection = baselineJson(selectionBytes, 64 * 1024)
  const baseline = verifyNaturalWorldBaselineProof({ selection, read })
  need(same(baseline.identity, BASELINE_IDENTITY) && baseline.store.path === EVOLUTION_STORE, 'world_binding')
  const storeBytes = bound(EVOLUTION_STORE, baseline.store.sha256, 4 * 1024 * 1024)
  const record = verifyNaturalRecordBytes(storeBytes, BASELINE_IDENTITY)
  const raw = bound(EVOLUTION_ARCHIVE.sourcePath, EVOLUTION_ARCHIVE.sourceSha256, 8 * 1024 * 1024)
  const receiptBytes = bound(EVOLUTION_ARCHIVE.receiptPath, EVOLUTION_ARCHIVE.receiptSha256, 64 * 1024)
  const receipt = baselineJson(receiptBytes, 64 * 1024)
  const source = readPowerDailySource(raw, receipt, EXPECTED)
  const modelFeatures = buildEvolutionDiagnosticFeatures(source)
  const registryBytes = bound(EVOLUTION_REGISTRY, null, 4 * 1024 * 1024)
  const registry = baselineJson(registryBytes)
  need(registry.schemaVersion === 'ai-painter-capability-release-registry-v2' &&
    registry.contractId === registry.schemaVersion && Number.isSafeInteger(registry.registryRevision) &&
    registry.registryRevision >= 0 && Array.isArray(registry.releaseRecords), 'registry_shape')
  need(record.worldState.payload.environment.localTime?.status === 'unknown' && record.eventCursor === 0, 'baseline_clock_or_history_changed')
  const ref = (p, b) => ({ path: p, sha256: baselineSha256(b), bytes: b.length })
  const releaseReaderBytes = bound(EVOLUTION_RELEASE_READER, null, 1024 * 1024)
  const content = { schemaVersion: 'natural-world-evolution-input-diagnostic-v1',
    producerId: 'natural-world-evolution-input-program-v1', status: 'diagnostic_input_ready',
    worldBinding: { metadataOnly: true, historicalArchiveState: false, identity: { ...BASELINE_IDENTITY },
      storeRef: ref(EVOLUTION_STORE, storeBytes), tick: record.tick, stateVersion: record.stateVersion,
      eventCursor: record.eventCursor, factsHash: record.worldFactsPayloadSha256,
      stateHash: record.statePayloadSha256, recordHash: record.recordContentSha256,
      randomStateSha256: baselineDigest(record.randomState), selectionRef: ref(BASELINE_SELECTION, selectionBytes),
      baselineProofRef: selection.proofRef, environment: record.worldState.payload.environment },
    worldClock: { status: 'uninitialized', logicalTime: null, evidence: 'actual_store.environment.localTime',
      reason: record.worldState.payload.environment.localTime.reason },
    worldHistory: { origin: 'bootstrap_no_events', eventCursor: 0, events: [], externalArchiveIncluded: false },
    archiveContext: { kind: 'external_archival_context', notWorldExperiencedEvents: true,
      sourceRef: ref(EVOLUTION_ARCHIVE.sourcePath, raw), receiptRef: ref(EVOLUTION_ARCHIVE.receiptPath, receiptBytes),
      sourceType: source.sourceType, acquiredAtUtc: receipt.acquiredAtUtc, publishedAtUtc: null,
      publicationAvailability: source.publicationAvailability, requestedCoordinates: source.requestedCoordinates,
      responseCoordinates: source.responseCoordinates, sourceDays: 31, diagnosticWindows: 24,
      trainingQualified: false, runtimeQualified: false },
    modelFeatures,
    capabilityObservation: { registryRef: ref(EVOLUTION_REGISTRY, registryBytes), status: registry.status,
      registryRevision: registry.registryRevision, releaseRecordsCount: registry.releaseRecords.length,
      worldEvolutionScopeReaderSupported: null, scopeAssessment: 'not_performed_by_diagnostic_entry',
      readerSourceRef: ref(EVOLUTION_RELEASE_READER, releaseReaderBytes), capabilityVerified: false,
      reason: registry.releaseRecords.length === 0 ? 'registry_contains_no_releases' : 'world_evolution_scope_not_semantically_validated' },
    readiness: { diagnosticInputOnly: true, productionReady: false, modelExecuted: false,
      productionTaskCreated: false, stateCommitted: false, tickAdvanced: false, framePublished: false,
      trainingQualified: false, evolutionQualified: false, worldEntryEligible: false, mvpQualified: false,
      blockers: ['source_diagnostic_not_dataset_release', 'world_evolution_qualification_not_verified',
        'world_evolution_scope_not_verified', 'world_clock_uninitialized',
        'world_history_empty_no_cold_start_qualification', 'source_publication_unknown_retrospective_only'] },
    readCoverage: { ...baseline.readCoverage, scope: 'baseline_bound_machine_readback_only;_archive_and_registry_reads_are_reported_by_run_reads',
      rawSourceBytesRehashed: false, sourceReplay: false, pngDecode: false },
    contentDigestRule: 'canonical_sha256_of_all_top_level_fields_except_contentSha256_and_observedAtUtc; modelFeatures_has_its_own_digest_excluding_inputContentSha256' }
  const result = { ...content, contentSha256: baselineDigest(content), observedAtUtc: new Date().toISOString() }
  need(Buffer.byteLength(JSON.stringify(result, null, 2)) + 1 <= EVOLUTION_INPUT_LIMITS.maxOutputBytes, 'output_budget')
  return freeze(result)
}
