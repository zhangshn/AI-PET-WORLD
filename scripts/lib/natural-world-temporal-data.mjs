import { createHash } from 'node:crypto'

// Data preparation only. This module never trains a model or writes world state.
export const DAILY_FIELDS = Object.freeze({ PRECTOTCORR: 'mm/day', RH2M: '%', T2M: 'C', WS2M: 'm/s' })
export const TEMPORAL_LIMITS = Object.freeze({ maxWindows: 4096, maxCopiedRows: 65536, maxOutputBytes: 16 * 1024 * 1024 })
const readerOwnedSources = new WeakMap()
const RECEIPT_KEYS = ['taskId', 'status', 'acquiredAtUtc', 'url', 'parameters', 'httpStatus', 'responseSha256', 'responseBytes',
  'elapsedSeconds', 'header', 'fields', 'recordCount', 'valuesCount', 'sourceType', 'actualTraining', 'runtimeStateWrites',
  'automaticProgressPassGranted', 'limitations']
const DAY_MS = 86400000
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function requireValue(ok, message) { if (!ok) throw new Error(message) }
function deepFreeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value) }
  return value
}
// Snapshot caller configuration without invoking getters, accepting class instances,
// or allocating an unbounded clone. These copies never grant source qualification.
function configurationCopy(value, label) {
  let nodes = 0, bytes = 0
  function visit(v, depth) {
    requireValue(++nodes <= 4096 && depth <= 12, `${label}: configuration bound exceeded`)
    if (v === null || typeof v === 'boolean') return v
    if (typeof v === 'number') { requireValue(Number.isFinite(v), `${label}: invalid number`); return v }
    if (typeof v === 'string') { bytes += Buffer.byteLength(v); requireValue(bytes <= 64 * 1024 && v.length <= 8192, `${label}: configuration byte bound exceeded`); return v }
    requireValue(v && typeof v === 'object' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null), `${label}: expected plain data`)
    const descriptors = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(descriptors)
    requireValue(keys.length <= (Array.isArray(v) ? 1025 : 64) && keys.every(k => typeof k === 'string'), `${label}: configuration fields bound exceeded`)
    const out = Array.isArray(v) ? [] : {}
    for (const k of keys) {
      if (Array.isArray(v) && k === 'length') continue
      const d = descriptors[k]
      requireValue(d.enumerable && Object.hasOwn(d, 'value') && !['__proto__', 'constructor', 'prototype'].includes(k), `${label}: accessor or unsafe field`)
      if (Array.isArray(v)) requireValue(/^(?:0|[1-9]\d*)$/.test(k) && Number(k) < v.length, `${label}: invalid array field`)
      out[k] = visit(d.value, depth + 1)
    }
    if (Array.isArray(v)) requireValue(out.length === v.length && Object.keys(out).length === v.length, `${label}: sparse array`)
    return out
  }
  return deepFreeze(visit(value, 0))
}
function exactKeys(value, required, optional = [], label = 'object') {
  requireValue(value && !Array.isArray(value) && typeof value === 'object' && required.every(k => Object.hasOwn(value, k)) &&
    Object.keys(value).every(k => required.includes(k) || optional.includes(k)), `${label}: missing or unknown field`)
}
function day(value) {
  requireValue(typeof value === 'string' && /^\d{8}$/.test(value), 'expected YYYYMMDD date')
  const time = Date.parse(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`)
  requireValue(Number.isFinite(time) && key(time) === value, 'invalid calendar date')
  return time
}
const key = time => new Date(time).toISOString().slice(0, 10).replaceAll('-', '')
const iso = time => new Date(time).toISOString()

export function readPowerDailySource(bytes, receipt, expected) {
  requireValue(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 8 * 1024 * 1024, 'source byte bound exceeded')
  bytes = Buffer.from(bytes)
  receipt = configurationCopy(receipt, 'receipt')
  expected = configurationCopy(expected, 'expected')
  exactKeys(receipt, ['httpStatus', 'responseBytes', 'responseSha256', 'url'], RECEIPT_KEYS, 'receipt')
  exactKeys(expected, ['start', 'end', 'latitude', 'longitude', 'returnedCoordinates'], [], 'expected')
  requireValue(receipt?.httpStatus === 200 && receipt.responseBytes === bytes.length && receipt.responseSha256 === hash(bytes), 'source receipt hash/bytes/status mismatch')
  if (receipt.acquiredAtUtc !== undefined) requireValue(typeof receipt.acquiredAtUtc === 'string' && Number.isFinite(Date.parse(receipt.acquiredAtUtc)), 'invalid acquisition time')
  const start = day(expected.start), end = day(expected.end)
  requireValue(end >= start && end - start <= 100 * 366 * DAY_MS, 'invalid source date span')
  requireValue(Number.isFinite(expected.latitude) && Math.abs(expected.latitude) <= 90 && Number.isFinite(expected.longitude) && Math.abs(expected.longitude) <= 180, 'invalid requested coordinate')
  const url = new URL(receipt.url)
  requireValue(url.origin === 'https://power.larc.nasa.gov' && url.pathname === '/api/temporal/daily/point' && !url.username && !url.password && !url.hash, 'unexpected source endpoint')
  requireValue([...url.searchParams.keys()].every((k, i, all) => all.indexOf(k) === i), 'duplicate request parameter')
  for (const [name, value] of Object.entries({ start: expected.start, end: expected.end, 'time-standard': 'UTC', format: 'JSON' })) {
    requireValue(url.searchParams.get(name) === value, `request ${name} mismatch`)
  }
  requireValue(Number(url.searchParams.get('latitude')) === expected.latitude && Number(url.searchParams.get('longitude')) === expected.longitude, 'request coordinate mismatch')
  requireValue(url.searchParams.get('parameters')?.split(',').sort().join(',') === Object.keys(DAILY_FIELDS).sort().join(','), 'request fields mismatch')
  const source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  const header = source.header
  requireValue(header?.time_standard === 'UTC' && header.start === expected.start && header.end === expected.end, 'response date/time standard mismatch')
  requireValue(typeof header.title === 'string' && /Daily Data/.test(header.title) && !/Climatology/i.test(header.title), 'expected daily data, not climatology')
  requireValue(Array.isArray(header.sources) && header.sources.includes('MERRA2') && Number.isFinite(header.fill_value), 'missing source identity/fill metadata')
  const coordinates = source.geometry?.coordinates
  // Pin the actual returned point explicitly; do not invent a spatial tolerance
  // or treat the gridded response as a measurement of each world object.
  requireValue(source.type === 'Feature' && source.geometry?.type === 'Point' && Array.isArray(coordinates) &&
    coordinates.length >= 2 && coordinates.length <= 3 && coordinates.every(Number.isFinite) &&
    Array.isArray(expected.returnedCoordinates) && expected.returnedCoordinates.length === 2 &&
    coordinates[0] === expected.returnedCoordinates[0] && coordinates[1] === expected.returnedCoordinates[1], 'response coordinate mismatch')
  const dates = []
  for (let time = start; time <= end; time += DAY_MS) dates.push(key(time))
  const parameters = source.properties?.parameter
  requireValue(parameters && Object.keys(parameters).sort().join(',') === Object.keys(DAILY_FIELDS).sort().join(','), 'response fields mismatch')
  requireValue(source.parameters && Object.keys(source.parameters).sort().join(',') === Object.keys(DAILY_FIELDS).sort().join(','), 'parameter metadata fields mismatch')
  for (const [field, unit] of Object.entries(DAILY_FIELDS)) {
    requireValue(source.parameters?.[field]?.units === unit, `${field}: unit mismatch`)
    requireValue(Object.keys(parameters[field]).sort().join(',') === dates.join(','), `${field}: dates missing or extra`)
  }
  let normalizedBytes = 0
  const records = dates.map(date => {
    const values = {}
    for (const field of Object.keys(DAILY_FIELDS)) {
      const value = parameters[field][date]
      requireValue(typeof value === 'number' && Number.isFinite(value) && value !== header.fill_value, `${field}/${date}: invalid or missing value`)
      requireValue(field !== 'RH2M' || (value >= 0 && value <= 100), 'RH2M outside percentage range')
      requireValue(!['PRECTOTCORR', 'WS2M'].includes(field) || value >= 0, `${field}: negative value`)
      requireValue(field !== 'T2M' || value >= -273.15, 'T2M below absolute zero')
      values[field] = value
    }
    const row = { date, intervalStartUtc: iso(day(date)), periodEndUtc: iso(day(date) + DAY_MS), values }
    normalizedBytes += Buffer.byteLength(JSON.stringify(row))
    requireValue(normalizedBytes <= 8 * 1024 * 1024, 'normalized source byte bound exceeded')
    return row
  })
  const result = deepFreeze({ schemaVersion: 'natural-world-daily-source-candidate-v1', sourceSha256: hash(bytes),
    sourceType: 'regional_gridded_reanalysis_not_object_measurements', units: { ...DAILY_FIELDS },
    requestedCoordinates: { latitude: expected.latitude, longitude: expected.longitude }, responseCoordinates: [...coordinates],
    records, publicationAvailability: 'unknown_retrospective_offline_source', trainingQualified: false, runtimeQualified: false })
  readerOwnedSources.set(result, { rawSourceSha256: hash(bytes), receipt, expected, normalizedBytes })
  return result
}

/** Serialized/cloned DTOs must be rebuilt from original bytes through the reader. */
export function buildCausalWindows(source, configuration) {
  const provenance = readerOwnedSources.get(source)
  requireValue(provenance && Object.isFrozen(source) && source.sourceSha256 === provenance.rawSourceSha256,
    'untrusted daily source: re-read original bytes, receipt and expected identity')
  const config = configurationCopy(configuration, 'window config')
  exactKeys(config, ['historyDays', 'splits'], ['limits'], 'window config')
  const { historyDays, splits } = config
  requireValue(Number.isSafeInteger(historyDays) && historyDays >= 1 && historyDays <= 366, 'invalid history length')
  requireValue(Array.isArray(splits) && splits.length > 0 && splits.length <= 4, 'explicit bounded date splits required')
  const limits = { ...TEMPORAL_LIMITS }
  if (config.limits !== undefined) {
    exactKeys(config.limits, [], Object.keys(TEMPORAL_LIMITS), 'window limits')
    for (const [name, value] of Object.entries(config.limits)) {
      requireValue(Number.isSafeInteger(value) && value > 0 && value <= TEMPORAL_LIMITS[name], `invalid or relaxed ${name} limit`)
      limits[name] = value
    }
  }
  const names = new Set()
  const ranges = splits.map(split => {
    exactKeys(split, ['name', 'start', 'end'], [], 'split')
    requireValue(['train', 'validation', 'test', 'diagnostic'].includes(split.name) && !names.has(split.name), 'invalid or duplicate split name')
    names.add(split.name)
    const start = day(split.start), end = day(split.end)
    requireValue(start <= end, 'reversed split')
    return { ...split, startTime: start, endTime: end }
  }).sort((a, b) => a.startTime - b.startTime)
  for (let i = 1; i < ranges.length; i++) requireValue(ranges[i].startTime > ranges[i - 1].endTime, 'overlapping splits')
  const roleOrder = { train: 0, validation: 1, test: 2, diagnostic: 3 }
  for (let i = 1; i < ranges.length; i++) requireValue(roleOrder[ranges[i].name] > roleOrder[ranges[i - 1].name], 'training must precede validation and test')
  const records = source.records, sourceStart = day(records[0].date), sourceEnd = day(records.at(-1).date)
  const rowSizes = records.map(row => Buffer.byteLength(JSON.stringify(row))), prefix = [0]
  for (const size of rowSizes) prefix.push(prefix.at(-1) + size)
  let plannedWindows = 0, plannedCopiedRows = 0
  // Covers fixed result metadata, summary and budget fields, excluding each window.
  let plannedOutputBytes = 8192
  requireValue(plannedOutputBytes <= limits.maxOutputBytes, 'window output byte bound exceeded before cloning')
  const summary = []
  for (const split of ranges) {
    requireValue(split.startTime >= sourceStart && split.endTime <= sourceEnd, 'split outside source coverage')
    const startIndex = (split.startTime - sourceStart) / DAY_MS, days = (split.endTime - split.startTime) / DAY_MS + 1
    const count = Math.max(0, days - historyDays)
    plannedWindows += count
    plannedCopiedRows += count * (historyDays + 1)
    requireValue(Number.isSafeInteger(plannedWindows) && plannedWindows <= limits.maxWindows, 'window count bound exceeded before cloning')
    requireValue(Number.isSafeInteger(plannedCopiedRows) && plannedCopiedRows <= limits.maxCopiedRows, 'copied row bound exceeded before cloning')
    // Prefix sums bound every row copy before any window/history allocation.
    for (let i = startIndex + historyDays; i < startIndex + days; i++) {
      plannedOutputBytes += prefix[i] - prefix[i - historyDays] + rowSizes[i] + historyDays + 512
      requireValue(plannedOutputBytes <= limits.maxOutputBytes, 'window output byte bound exceeded before cloning')
    }
    summary.push({ name: split.name, start: split.start, end: split.end, days,
      windows: count, excludedWarmupDays: Math.min(historyDays, days), startIndex })
  }
  const windows = []
  for (const split of summary) {
    for (let i = split.startIndex + historyDays; i < split.startIndex + split.days; i++) {
      const history = structuredClone(records.slice(i - historyDays, i))
      windows.push({ split: split.name, sourceSha256: provenance.rawSourceSha256,
        input: { asOfUtc: history.at(-1).periodEndUtc, horizonSeconds: 86400, history }, target: structuredClone(records[i]) })
    }
  }
  const result = { schemaVersion: 'natural-world-causal-window-candidate-v1', historyDays,
    summary: summary.map(({ startIndex, ...rest }) => { void startIndex; return rest }), windows,
    sourceBinding: { rawSourceSha256: provenance.rawSourceSha256, receiptIdentitySha256: hash(JSON.stringify(provenance.receipt)),
      expectedIdentitySha256: hash(JSON.stringify(provenance.expected)), provenance: 'reader_owned_immutable_raw_byte_snapshot_not_source_qualification' },
    resourceUse: { limits, windows: plannedWindows, copiedRows: plannedCopiedRows, maximumSerializedBytes: plannedOutputBytes },
    boundaryPolicy: 'all_input_and_target_days_within_one_split',
    limitations: ['Retrospective offline samples assume completed-day inputs; actual provider publication times are unknown, so this is not operational as-of replay.',
      'Teacher-forced daily prediction samples do not prove multi-step autonomous rollout or memory benefit.',
      'No normalization is fitted here; any future normalization must use training data only.',
      'Reader provenance establishes an immutable parse of supplied raw bytes, not acquisition authenticity, data rights or a registered training release.'],
    trainingQualified: false, runtimeQualified: false }
  // Defense in depth; the conservative preflight above prevents oversized clones.
  requireValue(Buffer.byteLength(JSON.stringify(result)) <= plannedOutputBytes, 'window serialization estimate violated')
  return deepFreeze(result)
}
