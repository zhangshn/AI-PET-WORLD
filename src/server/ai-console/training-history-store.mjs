import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readCurrentExecutionRegistry, CURRENT_EXECUTION_REGISTRY_ROOT as REG } from '../ai-painter-current-execution-registry.mjs'
import { adaptLegacyTrainingDetail, legacyRunKind } from './training-history-detail-adapters.mjs'
import { readBoundLargeExperimentProjection } from './training-history-large-result-projection.mjs'
import { HistoryError, requireFact, safePath, bytes } from './training-history-safe-bytes.mjs'
export { HistoryError, safePath, bytes } from './training-history-safe-bytes.mjs'

const JSON_LIMIT = 8 * 1024 * 1024
const IMAGE_LIMIT = 16 * 1024 * 1024
const SHA = /^[a-f0-9]{64}$/
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export function historyRoot() { return process.env.AI_CONSOLE_HISTORY_ROOT || process.cwd() }
const parsedEvidenceCache = new Map()
const PARSED_EVIDENCE_ENTRIES = 32, PARSED_EVIDENCE_BYTES = 16 * 1024 * 1024
let parsedEvidenceBytes = 0
function evictParsedEvidence(key) {
  const prior = parsedEvidenceCache.get(key)
  if (prior) { parsedEvidenceBytes -= prior.byteLength; parsedEvidenceCache.delete(key) }
}
async function json(root, binding, { cacheParsed = false, maximumBytes = JSON_LIMIT } = {}) {
  requireFact(binding && typeof binding.path === 'string', 'history_binding_missing')
  const key = cacheParsed ? JSON.stringify([path.resolve(root), binding.path, binding.sha256]) : null
  let read
  // Cached parsing never bypasses safe-path, bounded fresh bytes or SHA checks.
  try { read = await bytes(root, binding.path, Math.min(JSON_LIMIT, maximumBytes), binding.sha256) }
  catch (error) { if (key) evictParsedEvidence(key); throw error }
  const cached = key && parsedEvidenceCache.get(key)
  let value
  if (cached) {
    parsedEvidenceCache.delete(key); parsedEvidenceCache.set(key, cached)
    value = structuredClone(cached.value)
  } else {
    try { value = JSON.parse(read.value.toString('utf8').replace(/^\uFEFF/, '')) }
    catch { throw new HistoryError('history_json_invalid') }
    if (key) {
      parsedEvidenceCache.set(key, { value: structuredClone(value), byteLength: read.value.length })
      parsedEvidenceBytes += read.value.length
      while (parsedEvidenceCache.size > PARSED_EVIDENCE_ENTRIES || parsedEvidenceBytes > PARSED_EVIDENCE_BYTES) {
        evictParsedEvidence(parsedEvidenceCache.keys().next().value)
      }
    }
  }
  return { value, sha256: read.sha256, byteLength: read.value.length, ...(cacheParsed ? { parseCache: {
    hit: Boolean(cached), verification: 'fresh_bytes_sha256', retainedEntries: parsedEvidenceCache.size,
    retainedSourceBytes: parsedEvidenceBytes, maxEntries: PARSED_EVIDENCE_ENTRIES, maxSourceBytes: PARSED_EVIDENCE_BYTES,
  } } : {}) }
}
const caches = new Map()
const inFlight = new Map()
const latestHeads = new Map()
async function verifiedHistory(root) {
  // The official current reader remains the authority; history never writes it.
  await safePath(root, `${REG}/current.json`)
  const current = await readCurrentExecutionRegistry(root)
  requireFact(current.ok, current.errorCode || 'history_current_unreadable', 503)
  const key = path.resolve(root)
  if ((latestHeads.get(key)?.revision ?? 0) <= current.registry.registryRevision) latestHeads.set(key, { revision: current.registry.registryRevision, sha256: current.registrySha256 })
  const cached = caches.get(key)
  if (cached?.sha256 === current.registrySha256 && Date.now() - cached.at < 2000) return cached.value
  const flightKey = `${key}:${current.registrySha256}`
  if (inFlight.has(flightKey)) return inFlight.get(flightKey)
  const promise = traverse(root, current).then(value => { if (latestHeads.get(key)?.sha256 === current.registrySha256) caches.set(key, { sha256: current.registrySha256, value, at: Date.now() }); return value }).finally(() => inFlight.delete(flightKey))
  inFlight.set(flightKey, promise)
  return promise
}
async function traverse(root, current) {
  const eventBytes = await bytes(root, `${REG}/events.jsonl`, JSON_LIMIT)
  let events
  try { events = eventBytes.value.toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }
  catch { throw new HistoryError('history_events_invalid') }
  const database = new DatabaseSync(await safePath(root, `${REG}/registry.sqlite`), { readOnly: true })
  const records = new Map()
  const runEvents = new Map(), runCapsules = new Map(), runKinds = new Map(), runTaskTerminals = new Map(), eventArtifacts = new Map()
  let snapshot = current.registry, digest = current.registrySha256, visited = 0, coverageGap = null
  try {
    database.prepare('BEGIN').run()
    while (snapshot) {
      requireFact(++visited <= 2048, 'history_revision_coverage_limit')
      requireFact(ID.test(snapshot.transactionId), 'history_transaction_identity_invalid')
      const txRoot = `${REG}/transactions/${snapshot.transactionId}`
      const txRead = await json(root, { path: `${txRoot}/transaction.json` })
      const tx = txRead.value
      const revision = database.prepare('SELECT * FROM registry_revisions WHERE registry_revision = ?').get(snapshot.registryRevision)
      const row = database.prepare('SELECT * FROM registry_transactions WHERE transaction_id = ?').get(snapshot.transactionId)
      requireFact(tx.status === 'committed' && row?.status === 'committed', 'history_transaction_not_committed')
      requireFact(tx.transactionId === snapshot.transactionId && tx.registryRevision === snapshot.registryRevision && tx.eventSequence === snapshot.eventSequence && tx.currentSha256 === digest, 'history_transaction_conflict')
      requireFact(revision?.transaction_id === snapshot.transactionId && revision?.event_sequence === snapshot.eventSequence && revision?.current_sha256 === digest && row?.current_sha256 === digest, 'history_sqlite_conflict')
      requireFact(revision.task_id === snapshot.taskId && revision.run_id === snapshot.runId, 'history_sqlite_run_conflict')
      const matches = events.filter(event => event.transactionId === snapshot.transactionId)
      requireFact(matches.length === 1 && matches[0].registryRevision === snapshot.registryRevision && matches[0].eventSequence === snapshot.eventSequence && matches[0].currentSha256 === digest, 'history_event_conflict')
      requireFact(matches[0].taskId === snapshot.taskId && matches[0].runId === snapshot.runId, 'history_event_run_conflict')
      requireFact((tx.previousCurrentSha256 ?? null) === (snapshot.supersedes?.currentSha256 ?? null) && (matches[0].previousCurrentSha256 ?? null) === (snapshot.supersedes?.currentSha256 ?? null), 'history_previous_sha_conflict')
      requireFact(snapshot.schemaVersion === 'ai-painter-current-execution-registry-v1' && snapshot.writerIdentity === 'local_ai_capability_lifecycle_orchestrator', 'history_snapshot_schema_invalid')
      const event = matches[0]
      const ownEvents = runEvents.get(event.runId) ?? []
      ownEvents.push({ eventSequence: event.eventSequence, registryRevision: event.registryRevision, transactionId: event.transactionId, taskId: event.taskId, runId: event.runId, action: event.action ?? null, recordedAtUtc: event.recordedAtUtc ?? null, currentSha256: event.currentSha256, evidenceReferences: [`${txRoot}/transaction.json`, `${txRoot}/current.staged.json`] })
      runEvents.set(event.runId, ownEvents)
      const ownArtifacts = eventArtifacts.get(event.runId) ?? []
      ownArtifacts.push({ role: 'registry_transaction', path: `${txRoot}/transaction.json`, sha256: txRead.sha256 })
      eventArtifacts.set(event.runId, ownArtifacts)
      if (!runCapsules.has(snapshot.runId) && snapshot.taskCapsule) runCapsules.set(snapshot.runId, { ...snapshot.taskCapsule, taskId: snapshot.taskId })
      if (!runKinds.has(snapshot.runId) && snapshot.taskKind) runKinds.set(snapshot.runId, snapshot.taskKind)
      // Traversal is newest-first. Preserve the newest terminal explicitly
      // owned by this Run so a training adapter can follow a later review
      // terminal without scanning directories or borrowing another Run.
      if (!runTaskTerminals.has(snapshot.runId) && snapshot.terminalEvidence) {
        runTaskTerminals.set(snapshot.runId, { ...snapshot.terminalEvidence, taskId: snapshot.taskId, taskKind: snapshot.taskKind ?? null, registryRevision: snapshot.registryRevision })
      }
      const binding = snapshot.latestTrainingTerminal
      if (binding?.runId && !records.has(binding.runId)) {
        requireFact(ID.test(binding.runId) && SHA.test(binding.sha256), 'history_run_binding_invalid')
        const terminal = (await json(root, binding)).value
        requireFact((terminal.runId ?? terminal.experimentIdentity) === binding.runId && terminal.status === binding.status, 'history_terminal_identity_conflict')
        records.set(binding.runId, {
          runId: binding.runId, taskId: snapshot.runId === binding.runId ? snapshot.taskId : null,
          runKind: snapshot.runId === binding.runId ? snapshot.taskKind ?? 'unclassified' : 'unclassified',
          terminalStatus: terminal.status, sourceRevision: snapshot.registryRevision,
          startedAtUtc: terminal.startedAtUtc ?? null, finishedAtUtc: terminal.finishedAtUtc ?? terminal.completedAtUtc ?? null, recordedAtUtc: terminal.recordedAtUtc ?? null,
          unavailableFields: ['trainingPlanId', 'manifestEvidenceId', ...(!terminal.startedAtUtc ? ['startedAtUtc'] : []), ...(!(terminal.finishedAtUtc ?? terminal.completedAtUtc) ? ['finishedAtUtc'] : [])],
          trainingPlanId: null, manifestEvidenceId: null, finalizationEvidenceId: binding.sha256,
          terminalBinding: binding, terminalSchema: terminal.schemaVersion,
          evidenceReferences: [binding.path, `${txRoot}/transaction.json`],
        })
      }
      const previous = snapshot.supersedes
      if (!previous) { requireFact(snapshot.registryRevision === 1, 'history_chain_truncated'); break }
      requireFact(previous.registryRevision === snapshot.registryRevision - 1 && previous.eventSequence === snapshot.eventSequence - 1 && ID.test(previous.transactionId) && SHA.test(previous.currentSha256), 'history_supersedes_conflict')
      let old
      try { old = await json(root, { path: `${REG}/transactions/${previous.transactionId}/current.staged.json`, sha256: previous.currentSha256 }) }
      catch (error) {
        coverageGap = { fromRevision: previous.registryRevision, reasonCode: error.code === 'ENOENT' ? 'history_snapshot_missing' : error.message }
        break // Preserve only the verified prefix; never skip to an older success.
      }
      requireFact(old.value.registryRevision === previous.registryRevision && old.value.transactionId === previous.transactionId && old.value.runId === previous.runId && old.value.taskId === previous.taskId, 'history_snapshot_identity_conflict')
      snapshot = old.value; digest = old.sha256
    }
  } finally { database.close() }
  for (const record of records.values()) {
    record.runKind = runKinds.get(record.runId) ?? legacyRunKind(record.terminalSchema)
    const ownEvents = runEvents.get(record.runId) ?? []
    if (record.taskId === null && ownEvents.length) record.taskId = ownEvents[0].taskId
    record.registeredAtUtc = ownEvents[0]?.recordedAtUtc ?? null
  }
  return { records: [...records.values()], runEvents, runCapsules, runTaskTerminals, eventArtifacts, sourceRevision: current.registry.registryRevision, sourceSha256: current.registrySha256, verifiedAtUtc: new Date().toISOString(), revisionsVerified: visited, coverageGap }
}
function envelope(history) {
  const observedAtUtc = new Date().toISOString()
  return { dataStatus: 'connected', sourceIdentity: 'ai-painter-training-history', sourceRevision: history.sourceRevision, observedAtUtc, reasonCode: null, unavailableFields: [], provenance: { sourceIdentity: 'ai-painter-training-history', writerIdentity: 'ai_console_training_history_reader_v1', sourceRevision: history.sourceRevision, observedAtUtc, verifiedAtUtc: history.verifiedAtUtc, evidenceReferences: [`${REG}/current.json`, `${REG}/events.jsonl`, `${REG}/registry.sqlite`], trustStatus: 'verified_registry' } }
}
/** @param {{root?: string, cursor?: string|null, limit?: number}} options */
export async function listTrainingHistory({ root = historyRoot(), cursor = null, limit = 20 } = {}) {
  requireFact(Number.isInteger(limit) && limit >= 1 && limit <= 50, 'history_limit_invalid', 400)
  const history = await verifiedHistory(root)
  const { readHistoryEvidenceIndex } = await import('./training-history-evidence-index.mjs')
  const index = readHistoryEvidenceIndex(root)
  const registeredIds = new Set(history.records.map(record => record.runId))
  const independentByRun = new Map()
  const independentConflicts = new Set()
  for (const source of index.sources) {
    if (source.kind !== 'materialization' || source.status !== 'verified' || !source.terminalBinding || registeredIds.has(source.runId)) continue
    const previous = independentByRun.get(source.runId)
    if (previous && (previous.logicalPath !== source.logicalPath || previous.sha256 !== source.sha256
      || previous.terminalBinding.path !== source.terminalBinding.path || previous.terminalBinding.sha256 !== source.terminalBinding.sha256)) {
      independentConflicts.add(source.runId); continue
    }
    independentByRun.set(source.runId, source)
  }
  const independentRecords = [...independentByRun.values()].filter(source => !independentConflicts.has(source.runId)).map(source => ({
    runId: source.runId, recordId: source.runId, identityStatus: 'verified_independent_source', taskId: null,
    runKind: 'independent_materialization', terminalStatus: 'independent_evidence_only', sourceRevision: null,
    startedAtUtc: null, finishedAtUtc: null, recordedAtUtc: null, registeredAtUtc: null,
    terminalBinding: { ...source.terminalBinding, runId: source.runId }, evidenceReferences: [source.logicalPath],
    unavailableFields: ['registryEvents', 'trainingPlanId', 'startedAtUtc', 'finishedAtUtc'] }))
  const combined = [...independentRecords, ...history.records]
  const cursorIdentity = hash(JSON.stringify([history.sourceSha256, index.indexRevision]))
  const indexIncomplete = index.indexRevision !== null && (!index.coverage.complete || independentConflicts.size > 0 || independentRecords.length > 0)
  let offset = 0
  if (cursor !== null) {
    let decoded
    try { requireFact(typeof cursor === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(cursor), 'history_cursor_invalid', 400); decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) } catch { throw new HistoryError('history_cursor_invalid', 400) }
    requireFact(Number.isInteger(decoded.offset) && decoded.offset >= 0 && decoded.offset <= combined.length && SHA.test(decoded.sha256), 'history_cursor_invalid', 400)
    requireFact(decoded.sha256 === cursorIdentity, 'history_cursor_revision_conflict')
    offset = decoded.offset
  }
  const next = offset + limit
  const page = await Promise.all(combined.slice(offset, next).map(async record => ({ ...record,
    ...(await verifiedListReviewSummary(root, record, index.sources)) })))
  return { ...envelope(history), dataStatus: history.coverageGap || indexIncomplete ? 'partial' : 'connected', reasonCode: history.coverageGap?.reasonCode ?? index.reasonCode ?? (independentConflicts.size ? 'history_independent_run_conflict' : independentRecords.length ? 'history_independent_only_records' : indexIncomplete ? 'history_index_coverage_incomplete' : null), schemaVersion: 'ai_console_training_history_v1', records: page, total: history.coverageGap || indexIncomplete ? null : combined.length, nextCursor: next < combined.length ? Buffer.from(JSON.stringify({ sha256: cursorIdentity, offset: next })).toString('base64url') : null, refreshIntervalMs: 2000,
    indexRevision: index.indexRevision,
    coverage: { scope: 'registered_latest_training_terminals_only', revisionsVerified: history.revisionsVerified, verifiedRecordCount: history.records.length,
      gap: history.coverageGap, independentRecordCount: independentRecords.length,
      independentConflicts: [...independentConflicts],
      conflictingSources: index.sources.filter(source => independentConflicts.has(source.runId)).map(source => ({
        runId: source.runId, logicalPath: source.logicalPath, sha256: source.sha256, status: source.status })),
      directoryDiscovery: index.indexRevision !== null ? 'bounded_background_index' : 'not_connected',
      sources: { registry: { complete: history.coverageGap === null, gap: history.coverageGap },
        generated_result: { complete: index.coverage.complete, scannedAtUtc: index.coverage.scannedAtUtc,
          partialSourceCount: index.coverage.partialSourceCount ?? 0, reasonCode: index.reasonCode,
          sourceGaps: index.sources.filter(source => source.status !== 'verified').slice(0, 20).map(source => ({
            logicalPath: source.logicalPath, reasonCode: source.reasonCode })) } },
      detailSupport: 'registry_and_explicit_parent_bound_independent_evidence; overall_index_coverage_may_be_incomplete' } }
}
async function verifiedListReviewSummary(root, record, sources) {
  const terminal = record.terminalBinding
  if (!terminal) return null
  const materializations = sources.filter(source => source.runId === record.runId && source.kind === 'materialization'
    && source.status === 'verified' && source.terminalBinding?.path === terminal.path
    && source.terminalBinding.sha256 === terminal.sha256)
  if (materializations.length !== 1) return null
  const materialization = materializations[0]
  const reviews = sources.filter(source => source.runId === record.runId && source.kind === 'review'
    && source.status === 'verified' && source.parentBinding.path === materialization.logicalPath
    && source.parentBinding.sha256 === materialization.sha256)
  if (reviews.length !== 1) return null
  try {
    // List refreshes every two seconds. Bound each read independently; detail
    // remains the full 8 MiB path when a verified report exceeds this budget.
    const read = async source => JSON.parse((await bytes(root, source.logicalPath, 128 * 1024, source.sha256)).value.toString('utf8'))
    const [training, report, review] = await Promise.all([
      read({ logicalPath: terminal.path, sha256: terminal.sha256 }), read(materialization), read(reviews[0]),
    ])
    const candidate = report.candidate?.candidateRgb
    if (training.runId !== record.runId || (record.terminalStatus !== 'independent_evidence_only'
      && training.status !== record.terminalStatus)
      || report.runId !== record.runId || report.trainingTerminal?.path !== terminal.path
      || report.trainingTerminal.sha256 !== terminal.sha256 || review.runId !== record.runId
      || report.workerTerminal?.path !== training.workerTerminal?.path
      || report.workerTerminal?.sha256 !== training.workerTerminal?.sha256
      || report.checkpoint?.path !== training.checkpoint?.path
      || report.checkpoint?.sha256 !== training.checkpoint?.sha256
      || review.materialization?.path !== materialization.logicalPath
      || review.materialization.sha256 !== materialization.sha256
      || !candidate?.path || !SHA.test(candidate.sha256)
      || review.candidateRgb?.path !== candidate.path || review.candidateRgb.sha256 !== candidate.sha256
      || typeof review.status !== 'string' || review.status.length > 192
      || !Array.isArray(review.issueCodes) || review.issueCodes.length > 128
      || !review.issueCodes.every(code => typeof code === 'string' && code.length <= 192)) return null
    return { independentReviewStatus: review.status, independentReviewIssueCodes: review.issueCodes,
      reviewStatusSource: 'verified_independent_parent_binding' }
  } catch { return null }
}
function artifact(runId, role, binding, metadata = {}) {
  requireFact(binding && typeof binding.path === 'string' && SHA.test(binding.sha256), 'history_artifact_binding_invalid')
  const artifactId = hash(JSON.stringify([runId, role, binding.path, binding.sha256]))
  return { artifactId, role, logicalPath: binding.path, sha256: binding.sha256, verificationStatus: 'binding_verified_bytes_not_read', ...metadata, url: `/api/ai-console/training/history/${encodeURIComponent(runId)}/artifacts/${artifactId}` }
}
async function augmentIndexedEvidence(root, runId, registration, terminal, detail) {
  const { readHistoryEvidenceIndex, HISTORY_INDEX_PATH } = await import('./training-history-evidence-index.mjs')
  const index = readHistoryEvidenceIndex(root, runId)
  const matches = index.sources.filter(source => source.kind === 'materialization' && source.status === 'verified'
    && source.terminalBinding?.path === registration.terminalBinding.path && source.terminalBinding.sha256 === registration.terminalBinding.sha256)
  if (matches.length === 0) {
    const unsupported = index.sources.find(source => source.kind === 'materialization'
      && source.terminalBinding?.path === registration.terminalBinding.path
      && source.terminalBinding.sha256 === registration.terminalBinding.sha256)
    detail.record.detailCoverage = { ...(detail.record.detailCoverage ?? {}), independentIndex: index.dataStatus,
      indexRevision: index.indexRevision, indexCoverage: index.coverage,
      reason: unsupported?.reasonCode ?? index.reasonCode ?? 'history_independent_materialization_not_indexed' }
    return detail
  }
  requireFact(matches.length === 1, 'history_independent_materialization_conflict')
  const source = matches[0]
  const report = (await json(root, { path: source.logicalPath, sha256: source.sha256 })).value
  requireFact(report.runId === runId && report.schemaVersion && typeof report.schemaVersion === 'string', 'history_independent_materialization_identity_conflict')
  requireFact(report.trainingTerminal?.path === registration.terminalBinding.path && report.trainingTerminal.sha256 === registration.terminalBinding.sha256,
    'history_independent_materialization_parent_conflict')
  const same = (left, right, code) => requireFact(left?.path === right?.path && left?.sha256 === right?.sha256, code)
  same(report.workerTerminal, terminal.workerTerminal, 'history_independent_worker_conflict')
  same(report.checkpoint, terminal.checkpoint, 'history_independent_checkpoint_conflict')
  requireFact(report.candidate && typeof report.candidate.sampleId === 'string' && report.candidate.sampleId.length <= 192
    && report.candidate.split === 'validation' && report.artifacts && !Array.isArray(report.artifacts)
    && Object.keys(report.artifacts).length <= 128, 'history_independent_materialization_schema_unsupported')
  const record = detail.record
  const seen = new Map(record.artifacts.map(item => [item.logicalPath, item]))
  const append = (role, binding, metadata = {}) => {
    requireFact(binding?.path && SHA.test(binding.sha256), 'history_independent_artifact_binding_invalid')
    const prior = seen.get(binding.path)
    if (prior) { requireFact(prior.sha256 === binding.sha256, 'history_independent_artifact_conflict'); return prior }
    requireFact(record.artifacts.length < 256, 'history_record_limit', 413)
    const item = artifact(runId, role, binding, metadata)
    record.artifacts.push(item); seen.set(binding.path, item)
    return item
  }
  append('evidence', { path: source.logicalPath, sha256: source.sha256 }, { evidenceKind: 'independent_materialization' })
  const phase = (await json(root, terminal.workerTerminal)).value
  requireFact(phase.runId === runId, 'history_independent_worker_run_conflict')
  record.optimizerSteps = phase.optimizerStepsGenerator ?? phase.optimizerSteps ?? record.optimizerSteps
  record.resolution = phase.stage?.width && phase.stage?.height ? { width: phase.stage.width, height: phase.stage.height } : record.resolution
  if (terminal.checkpoint) {
    const item = append('checkpoint', terminal.checkpoint, { optimizerSteps: record.optimizerSteps, promotable: false })
    const info = await stat(await safePath(root, item.logicalPath))
    requireFact(info.isFile(), 'history_checkpoint_not_file')
    item.byteLength = info.size
    if (!record.checkpoints.some(checkpoint => checkpoint.artifactId === item.artifactId)) record.checkpoints.push(item)
  }
  const sampleId = report.candidate.sampleId
  const original = append('original', report.candidate.referenceRgb, { sampleId, split: report.candidate.split, sourceRole: 'held_out_reference_rgb' })
  const output = append('output', report.candidate.candidateRgb, { sampleId, split: report.candidate.split,
    inferenceMode: report.candidate.artifactIdentity?.inferenceMode ?? null, formalQualification: false })
  const condition = report.candidate.conditionPack ? append('condition', report.candidate.conditionPack, { sampleId, split: report.candidate.split }) : null
  record.samples.push({ sampleId, split: report.candidate.split, original, condition, output })
  const unsupportedArtifacts = []
  for (const [label, binding] of Object.entries(report.artifacts)) {
    requireFact(label.length <= 128 && binding?.path && SHA.test(binding.sha256), 'history_independent_artifact_binding_invalid')
    if (/\.(?:png|jpe?g)$/iu.test(binding.path)) append('image', binding, { sampleId, split: report.candidate.split,
      sourceLabel: label, associationStatus: 'declared_in_materialization_no_role_inferred_from_filename' })
    else unsupportedArtifacts.push({ sourceLabel: label, logicalPath: binding.path, sha256: binding.sha256,
      contentStatus: 'unsupported_schema' })
  }
  if (report.metrics && typeof report.metrics === 'object') record.metrics.push({ source: 'independent_materialization', sampleId, measurements: report.metrics })
  const reviews = index.sources.filter(item => item.kind === 'review' && item.status === 'verified'
    && item.parentBinding.path === source.logicalPath && item.parentBinding.sha256 === source.sha256)
  const unsupportedReview = index.sources.find(item => item.kind === 'review' && item.status !== 'verified'
    && item.parentBinding.path === source.logicalPath && item.parentBinding.sha256 === source.sha256)
  requireFact(reviews.length <= 1, 'history_independent_review_conflict')
  let reviewStatus = 'not_indexed'
  if (reviews.length) {
    const review = (await json(root, { path: reviews[0].logicalPath, sha256: reviews[0].sha256 })).value
    requireFact(review.runId === runId && review.materialization?.path === source.logicalPath
      && review.materialization.sha256 === source.sha256 && Array.isArray(review.issueCodes)
      && review.issueCodes.length <= 128 && review.issueCodes.every(code => typeof code === 'string' && code.length <= 192),
    'history_independent_review_identity_conflict')
    same(review.candidateRgb, report.candidate.candidateRgb, 'history_independent_candidate_conflict')
    append('evidence', { path: reviews[0].logicalPath, sha256: reviews[0].sha256 }, { evidenceKind: 'independent_review' })
    reviewStatus = review.status
    record.qualification = { ...record.qualification, independentReviewStatus: review.status, issueCodes: review.issueCodes,
      independentReviewClaims: { formalStage0QualificationGranted: review.formalStage0QualificationGranted === true,
        runtimePublicationGranted: review.runtimePublicationGranted === true, visualQualityGranted: review.visualQualityGranted === true },
      formalGrantNotInferredFromIndependentEvidence: true }
    record.metrics.push({ source: 'independent_review', sampleId, issueCodes: review.issueCodes,
      measurements: { detail: review.detail?.status ?? null, aesthetic: review.aesthetic?.status ?? null, alignment: review.alignment?.status ?? null } })
  }
  detail.unavailableFields = detail.unavailableFields.filter(field => !['samples', 'metrics', 'checkpoints', 'resolution'].includes(field))
  record.detailCoverage = { adapter: 'explicit_parent_bound_independent_evidence', supported: true,
    sourcePolicy: 'bounded_index_and_rechecked_sha256_parent_bindings', indexRevision: index.indexRevision,
    indexCoverage: index.coverage, materializationStatus: 'verified', reviewStatus,
    reviewGap: reviews.length ? null : unsupportedReview?.reasonCode ?? null,
    unsupportedArtifacts,
    candidateQualification: 'unqualified_until_independent_review_and_formal_gate' }
  detail.provenance.evidenceReferences = [...detail.provenance.evidenceReferences, HISTORY_INDEX_PATH, source.logicalPath,
    ...(reviews.length ? [reviews[0].logicalPath] : [])]
  detail.dataStatus = index.coverage.complete && reviews.length ? 'connected' : 'partial'
  detail.reasonCode = !reviews.length ? 'history_independent_review_not_indexed'
    : !index.coverage.complete ? 'history_index_coverage_incomplete' : null
  return detail
}
export async function readTrainingRun(runId, { root = historyRoot() } = {}) {
  requireFact(typeof runId === 'string' && ID.test(runId), 'history_run_id_invalid', 400)
  const history = await verifiedHistory(root)
  const registration = history.records.find(record => record.runId === runId)
  if (!registration) {
    const { readHistoryEvidenceIndex, HISTORY_INDEX_PATH } = await import('./training-history-evidence-index.mjs')
    const index = readHistoryEvidenceIndex(root, runId)
    const sources = index.sources.filter(source => source.kind === 'materialization' && source.status === 'verified' && source.terminalBinding)
    requireFact(sources.length > 0, 'history_run_not_found', 404)
    requireFact(sources.length === 1, 'history_independent_run_conflict')
    const binding = sources[0].terminalBinding
    const terminal = (await json(root, binding)).value
    requireFact(terminal.runId === runId && typeof terminal.status === 'string', 'history_independent_terminal_identity_conflict')
    const base = envelope(history)
    base.sourceIdentity = 'ai-painter-independent-training-history'
    base.sourceRevision = null
    base.dataStatus = 'partial'
    base.reasonCode = 'history_independent_not_in_verified_registry_prefix'
    base.unavailableFields = ['registryEvents', 'trainingPlanId', 'startedAtUtc', 'finishedAtUtc', 'samples', 'metrics', 'checkpoints', 'resolution']
    base.provenance = { ...base.provenance, sourceIdentity: base.sourceIdentity, sourceRevision: null,
      writerIdentity: 'ai_console_training_history_independent_reader_v1', trustStatus: 'verified_independent_parent_binding',
      evidenceReferences: [HISTORY_INDEX_PATH, sources[0].logicalPath] }
    const record = { runId, recordId: runId, identityStatus: 'verified_independent_source', taskId: null,
      runKind: 'independent_materialization', terminalStatus: terminal.status, sourceRevision: null,
      startedAtUtc: null, finishedAtUtc: null, recordedAtUtc: terminal.recordedAtUtc ?? null,
      registeredAtUtc: null, terminalBinding: { ...binding, runId, status: terminal.status },
      artifacts: [artifact(runId, 'terminal', binding)], samples: [], metrics: [], checkpoints: [], optimizerSteps: null,
      resolution: null, qualification: { formalQualificationAllowed: null, worldEntryAllowed: null },
      events: [], eventCoverage: { scope: 'verified_registry_events_only', complete: false,
        gap: history.coverageGap ?? { reasonCode: 'history_run_not_in_verified_registry_prefix' } } }
    const detail = await augmentIndexedEvidence(root, runId, record, terminal, { ...base, schemaVersion: 'ai_console_training_run_detail_v1', record })
    detail.record.detailCoverage = { ...detail.record.detailCoverage, registryAssociation: 'not_in_verified_prefix' }
    return detail
  }
  // Revalidate parents for each detail/artifact request, regardless of list cache.
  const terminal = (await json(root, registration.terminalBinding)).value
  requireFact((terminal.runId ?? terminal.experimentIdentity) === runId && terminal.status === registration.terminalStatus, 'history_terminal_identity_conflict')
  const base = envelope(history)
  const artifacts = [artifact(runId, 'terminal', registration.terminalBinding)]
  const record = { ...registration, artifacts, samples: [], metrics: [], checkpoints: [], optimizerSteps: terminal.optimizerSteps ?? null, resolution: null, qualification: { formalQualificationAllowed: terminal.formalQualificationAllowed ?? null, checkpointSelected: terminal.checkpointSelected ?? null, worldEntryAllowed: terminal.worldEntryAllowed ?? null } }
  record.events = [...(history.runEvents.get(runId) ?? [])].sort((a, b) => a.eventSequence - b.eventSequence)
  record.eventCoverage = { scope: 'verified_registry_events_only', complete: history.coverageGap === null, gap: history.coverageGap }
  for (const binding of history.eventArtifacts.get(runId) ?? []) artifacts.push(artifact(runId, binding.role, binding))
  base.unavailableFields = [...registration.unavailableFields, 'resolution']
  const endpointVersions = { 'ai-painter-endpoint-ab-terminal-v1': ['ai-painter-endpoint-ab-result-v1', 'ai-painter-endpoint-ab-request-v1'], 'ai-painter-endpoint-ab-terminal-v2': ['ai-painter-endpoint-ab-result-v2', 'ai-painter-endpoint-ab-request-v2'], 'ai-painter-endpoint-ab-terminal-v3': ['ai-painter-endpoint-ab-result-v3', 'ai-painter-endpoint-ab-request-v3'] }
  const endpointSchemas = endpointVersions[terminal.schemaVersion]
  if (!endpointSchemas) {
    const detail = await adaptLegacyTrainingDetail({ runId, terminal, record, base, capsuleBinding: history.runCapsules.get(runId), taskTerminalBinding: history.runTaskTerminals.get(runId),
      readJson: async binding => (await json(root, binding)).value,
      readEvidenceJson: (binding, maximumBytes) => json(root, binding, { cacheParsed: true, maximumBytes }),
      readLargeResultProjection: (binding, request) => readBoundLargeExperimentProjection(root, binding, request),
      makeArtifact: (role, binding, metadata) => artifact(runId, role, binding, metadata),
      checkpointMetadata: async item => { const meta = await stat(await safePath(root, item.logicalPath)); requireFact(meta.isFile(), 'history_checkpoint_not_file'); return { ...item, byteLength: meta.size } },
      requireFact,
    })
    return detail.reasonCode === 'history_terminal_schema_unsupported'
      ? augmentIndexedEvidence(root, runId, registration, terminal, detail) : detail
  }
  const resultBinding = terminal.workerResult ?? terminal.result
  if (!resultBinding) return { ...base, dataStatus: 'partial', reasonCode: 'history_result_schema_unsupported', unavailableFields: ['samples', 'metrics', 'checkpoints'], schemaVersion: 'ai_console_training_run_detail_v1', record }
  const result = (await json(root, resultBinding)).value
  requireFact(result.schemaVersion === endpointSchemas[0], 'history_result_schema_conflict')
  requireFact((result.runId ?? result.experimentIdentity) === runId, 'history_result_run_conflict')
  artifacts.push(artifact(runId, 'result', resultBinding))
  if (!result.request?.path) return { ...base, dataStatus: 'partial', reasonCode: 'history_request_schema_unsupported', unavailableFields: ['samples', 'metrics', 'checkpoints'], schemaVersion: 'ai_console_training_run_detail_v1', record }
  const request = (await json(root, result.request)).value
  requireFact(request.schemaVersion === endpointSchemas[1], 'history_request_schema_conflict')
  requireFact((request.identity ?? request.runId ?? request.experimentIdentity) === runId, 'history_request_run_conflict')
  artifacts.push(artifact(runId, 'request', result.request))
  if (!Array.isArray(request.selectedRows) || !Array.isArray(result.rows) || !Array.isArray(result.arms)) return { ...base, dataStatus: 'partial', reasonCode: 'history_rows_schema_unsupported', unavailableFields: ['samples', 'metrics', 'checkpoints'], schemaVersion: 'ai_console_training_run_detail_v1', record }
  requireFact(request.selectedRows.length <= 128 && result.rows.length <= 1024 && result.arms.length <= 32, 'history_record_limit', 413)
  record.resolution = request.training?.resolution ?? request.training?.imageSize ?? null
  for (const sample of request.selectedRows) {
    const original = artifact(runId, 'original', sample.image, { sampleId: sample.sampleId, split: sample.split })
    artifacts.push(original)
    let condition = null
    if (sample.conditionPack?.path) { condition = artifact(runId, 'condition', sample.conditionPack, { sampleId: sample.sampleId }); artifacts.push(condition) }
    record.samples.push({ sampleId: sample.sampleId, split: sample.split, original, condition, conditionLabel: sample.conditionLabel ?? null })
  }
  for (const row of result.rows) {
    requireFact(record.samples.some(sample => sample.sampleId === row.sampleId && sample.split === row.split), 'history_sample_binding_conflict')
    const image = artifact(runId, 'output', row.image, { sampleId: row.sampleId, split: row.split, arm: row.arm, seed: row.seed, samplingSteps: row.steps })
    artifacts.push(image)
    record.metrics.push({ sampleId: row.sampleId, split: row.split, arm: row.arm, seed: row.seed, samplingSteps: row.steps, measurements: row.measurements ?? null, baseline: row.baseline ?? null, image })
  }
  for (const arm of result.arms) {
    if (!arm.checkpoint) continue
    const cp = artifact(runId, 'checkpoint', arm.checkpoint, { arm: arm.arm, optimizerSteps: arm.optimizerSteps ?? null })
    const file = await safePath(root, cp.logicalPath)
    const meta = await stat(file)
    requireFact(meta.isFile(), 'history_checkpoint_not_file')
    cp.byteLength = meta.size // Metadata only. Never deserialize or hash weights on polling.
    artifacts.push(cp); record.checkpoints.push(cp)
    if (arm.stepEvidence) artifacts.push(artifact(runId, 'steps', arm.stepEvidence, { arm: arm.arm }))
  }
  record.optimizerSteps = result.optimizerSteps ?? record.optimizerSteps
  return { ...base, schemaVersion: 'ai_console_training_run_detail_v1', record }
}
/** @param {string} runId @param {{root?: string, section: string, cursor?: string|null, limit?: number}} options */
export async function readTrainingRunSection(runId, { root = historyRoot(), section, cursor = null, limit = 20 } = {}) {
  requireFact(['artifacts', 'metrics', 'events', 'logs'].includes(section), 'history_section_invalid', 400)
  requireFact(Number.isInteger(limit) && limit >= 1 && limit <= 50, 'history_limit_invalid', 400)
  const detail = await readTrainingRun(runId, { root })
  const artifactOrder = { output: 0, image: 1, original: 2, checkpoint: 3 }
  const rows = section === 'artifacts' ? [...(detail.record.artifacts ?? [])].sort((a, b) =>
    (artifactOrder[a.role] ?? 4) - (artifactOrder[b.role] ?? 4))
    : section === 'metrics' ? detail.record.metrics ?? []
      : section === 'events' ? detail.record.events ?? [] : []
  const sourceIdentity = hash(JSON.stringify([runId, section, detail.sourceRevision,
    detail.record.terminalBinding?.sha256 ?? null, detail.record.detailCoverage?.indexRevision ?? null,
    (section === 'artifacts' ? rows : detail.record.artifacts)?.map(item => item.artifactId) ?? [], rows.length]))
  let offset = 0
  if (cursor !== null) {
    let decoded
    try {
      requireFact(typeof cursor === 'string' && /^[A-Za-z0-9_-]{1,512}$/u.test(cursor), 'history_cursor_invalid', 400)
      decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    } catch { throw new HistoryError('history_cursor_invalid', 400) }
    requireFact(decoded.runId === runId && decoded.section === section && Number.isInteger(decoded.offset)
      && decoded.offset >= 0 && decoded.offset <= rows.length && SHA.test(decoded.sourceIdentity), 'history_cursor_invalid', 400)
    requireFact(decoded.sourceIdentity === sourceIdentity, 'history_cursor_revision_conflict')
    offset = decoded.offset
  }
  const unavailable = section === 'logs' || (section === 'metrics' && detail.unavailableFields?.includes('metrics') && rows.length === 0)
  const nextOffset = offset + limit
  return { schemaVersion: 'ai_console_training_run_detail_v1', dataStatus: unavailable || detail.dataStatus !== 'connected' ? 'partial' : 'connected',
    reasonCode: section === 'logs' ? 'history_logs_not_indexed' : unavailable ? detail.reasonCode ?? 'history_section_not_recorded' : detail.reasonCode,
    sourceRevision: detail.sourceRevision, indexRevision: detail.record.detailCoverage?.indexRevision ?? null,
    observedAtUtc: detail.observedAtUtc, record: { runId, terminalStatus: detail.record.terminalStatus },
    section, items: rows.slice(offset, nextOffset), knownItemCount: rows.length,
    total: unavailable || detail.dataStatus !== 'connected' ? null : rows.length,
    nextCursor: nextOffset < rows.length ? Buffer.from(JSON.stringify({ runId, section, offset: nextOffset, sourceIdentity })).toString('base64url') : null,
    coverage: { scope: 'verified_record_section_only', complete: !unavailable && detail.dataStatus === 'connected',
      parentReasonCode: detail.reasonCode, unavailableFields: detail.unavailableFields ?? [] } }
}
export async function readTrainingArtifact(runId, artifactId, options = {}) {
  requireFact(typeof artifactId === 'string' && SHA.test(artifactId), 'history_artifact_id_invalid', 400)
  const detail = await readTrainingRun(runId, options)
  const item = detail.record.artifacts.find(value => value.artifactId === artifactId)
  requireFact(item, 'history_artifact_not_found', 404)
  if (item.role === 'checkpoint') return { json: item }
  const root = options.root ?? historyRoot()
  const isImage = ['output', 'original', 'image'].includes(item.role)
  const read = await bytes(root, item.logicalPath, isImage ? IMAGE_LIMIT : JSON_LIMIT, item.sha256)
  if (isImage) {
    const png = read.value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const jpeg = read.value[0] === 255 && read.value[1] === 216 && read.value[2] === 255
    requireFact(png || jpeg, 'history_image_signature_invalid')
    return { bytes: read.value, contentType: png ? 'image/png' : 'image/jpeg' }
  }
  return { json: { ...item, verificationStatus: 'bytes_verified', byteLength: read.value.length, truncated: read.value.length > 65536, text: read.value.subarray(0, 65536).toString('utf8') } }
}
