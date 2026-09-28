// A disposable read-only projection, not a second registry or producer record.
// Large immutable sources are streamed and hashed on every read; only the first
// read of an exact binding parses the source. Ordinary JSON stays at 8 MiB.
import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { HistoryError, requireFact, safePath } from './training-history-safe-bytes.mjs'

export const LARGE_RESULT_SOURCE_LIMIT = 16 * 1024 * 1024
const PROJECTION_LIMIT = 8 * 1024 * 1024, CACHE_LIMIT = 16 * 1024 * 1024, CACHE_ENTRIES = 32
const CHUNK_BYTES = 64 * 1024, MAX_MS = 5000, MAX_IN_FLIGHT = 2
const fields = ['schemaVersion', 'experimentIdentity', 'runId', 'experimentType', 'evidenceContractVersion',
  'status', 'executionState', 'stage4QualificationGranted', 'checkpointPromotable', 'runtimeFrameAllowed',
  'validationContentRead', 'challengeContentRead', 'regressionContentRead', 'optimizerSteps', 'qualification',
  'trainOnlyObservations', 'imageArtifacts', 'artifacts', 'checkpoint']
const cache = new Map(), inFlight = new Map()
let retainedBytes = 0
const sha = value => createHash('sha256').update(value).digest('hex')
function evict(key) {
  const previous = cache.get(key)
  if (previous) { retainedBytes -= previous.byteLength; cache.delete(key) }
}
function supported(request) {
  return request?.schemaVersion === 'ai-painter-learning-capacity-experiment-package-v1'
    && request.evidenceContractVersion === 1 && typeof request.experimentType === 'string'
    && request.experimentType.length > 0 && typeof request.experimentIdentity === 'string'
}

export async function readBoundLargeExperimentProjection(root, binding, request) {
  requireFact(supported(request), 'history_large_result_package_unsupported')
  requireFact(binding && typeof binding.path === 'string' && /^[a-f0-9]{64}$/u.test(binding.sha256), 'history_binding_missing')
  const key = JSON.stringify([root, binding.path, binding.sha256, request.experimentIdentity, request.experimentType])
  // Coalesce only currently in-flight verification, never return a stale cache
  // without a new safe-path/handle/length/hash check on the next request.
  if (inFlight.has(key)) return structuredClone(await inFlight.get(key))
  requireFact(inFlight.size < MAX_IN_FLIGHT, 'history_large_projection_busy', 503)
  const operation = (async () => {
    const began = performance.now()
    const filename = await safePath(root, binding.path)
    const handle = await open(filename, 'r')
    let sourceBytes, sourceLength, cacheHit
    try {
      const before = await handle.stat()
      requireFact(before.isFile(), 'history_not_regular_file')
      requireFact(before.size <= LARGE_RESULT_SOURCE_LIMIT, 'history_byte_limit', 413)
      const previous = cache.get(key)
      cacheHit = Boolean(previous)
      const chunks = [], digest = createHash('sha256'), buffer = Buffer.alloc(CHUNK_BYTES)
      let used = 0
      while (true) {
        requireFact(performance.now() - began <= MAX_MS, 'history_large_result_parse_budget', 413)
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, used)
        if (!bytesRead) break
        used += bytesRead
        requireFact(used <= LARGE_RESULT_SOURCE_LIMIT, 'history_byte_limit', 413)
        const chunk = buffer.subarray(0, bytesRead)
        digest.update(chunk)
        if (!previous) chunks.push(Buffer.from(chunk))
      }
      const after = await handle.stat()
      requireFact(used === before.size && after.size === before.size && after.mtimeMs === before.mtimeMs,
        'history_file_changed')
      requireFact(digest.digest('hex') === binding.sha256, 'history_sha_mismatch')
      sourceLength = used
      if (previous) {
        requireFact(sha(previous.serialized) === previous.projectionSha256, 'history_large_projection_hash_conflict')
        cache.delete(key); cache.set(key, previous)
      } else {
        sourceBytes = Buffer.concat(chunks, used)
      }
    } catch (error) { evict(key); throw error }
    finally { await handle.close() }
    if (!cacheHit) {
      let result
      try { result = JSON.parse(sourceBytes.toString('utf8').replace(/^\uFEFF/u, '')) }
      catch { throw new HistoryError('history_json_invalid') }
      requireFact(result?.schemaVersion === 'ai-painter-learning-capacity-experiment-result-v1'
        && result.evidenceContractVersion === 1 && result.experimentIdentity === request.experimentIdentity
        && (result.runId === undefined || result.runId === request.experimentIdentity)
        && result.experimentType === request.experimentType, 'history_large_result_identity_conflict')
      const projection = Object.fromEntries(fields.filter(field => Object.hasOwn(result, field)).map(field => [field, result[field]]))
      const serialized = JSON.stringify(projection), byteLength = Buffer.byteLength(serialized)
      requireFact(byteLength <= PROJECTION_LIMIT, 'history_large_projection_byte_limit', 413)
      requireFact(performance.now() - began <= MAX_MS, 'history_large_result_parse_budget', 413)
      cache.set(key, { serialized, byteLength, projectionSha256: sha(serialized) })
      retainedBytes += byteLength
      while (cache.size > CACHE_ENTRIES || retainedBytes > CACHE_LIMIT) evict(cache.keys().next().value)
    }
    const projected = cache.get(key)
    requireFact(projected, 'history_large_projection_unavailable')
    return { value: JSON.parse(projected.serialized), byteLength: projected.byteLength, sourceByteLength: sourceLength,
      projectionSha256: projected.projectionSha256, sourceSha256: binding.sha256,
      coverage: { scope: 'canonical_v1_controlled_fields_only', omittedLegacyAliases: ['rows'],
        rawSourcePreviewAvailable: false, sourceByteLimit: LARGE_RESULT_SOURCE_LIMIT,
        projectionByteLimit: PROJECTION_LIMIT, maxParseMs: MAX_MS, streamChunkBytes: CHUNK_BYTES,
        parseCacheHit: cacheHit, retainedProjectionBytes: retainedBytes, maxRetainedProjectionBytes: CACHE_LIMIT } }
  })()
  inFlight.set(key, operation)
  try { return structuredClone(await operation) }
  finally { inFlight.delete(key) }
}
