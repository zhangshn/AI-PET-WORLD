import { createHash } from 'node:crypto'
import { open, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readCurrentExecutionRegistry, CURRENT_EXECUTION_REGISTRY_ROOT as REG } from '../ai-painter-current-execution-registry.mjs'
import { adaptLegacyTrainingDetail, legacyRunKind } from './training-history-detail-adapters.mjs'

const JSON_LIMIT = 8 * 1024 * 1024
const IMAGE_LIMIT = 16 * 1024 * 1024
const SHA = /^[a-f0-9]{64}$/
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export class HistoryError extends Error {
  constructor(code, status = 409) { super(code); this.status = status }
}
function requireFact(value, code, status = 409) { if (!value) throw new HistoryError(code, status) }
function inside(root, file) { const relative = path.relative(root, file); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)) }
export function historyRoot() { return process.env.AI_CONSOLE_HISTORY_ROOT || process.cwd() }

// Only the explicitly registered F: runtime junction is an external read root.
// A different checkout may read its own local data/runtime; it cannot grant a disk.
async function safePath(root, logical) {
  requireFact(typeof logical === 'string' && !logical.includes('\\') && !logical.split('/').some(p => p === '..' || p === '.' || p === '') && /^(?:\.runtime|data)\//.test(logical), 'history_path_outside_root')
  const base = await realpath(root)
  const namespace = logical.split('/')[0]
  const logicalRoot = path.join(base, namespace)
  const resolvedRoot = await realpath(logicalRoot)
  const registered = process.platform === 'win32' && base.toLowerCase() === path.resolve('F:/ai-pet-world').toLowerCase()
    && namespace === '.runtime' && resolvedRoot.toLowerCase() === path.resolve('D:/AI-PET-WORLD-DATA/hot/runtime').toLowerCase()
  requireFact(inside(base, resolvedRoot) || registered, 'history_unregistered_mount')
  const resolved = await realpath(path.join(base, logical))
  requireFact(inside(resolvedRoot, resolved), 'history_symlink_escape')
  return resolved
}
async function bytes(root, logical, maximum, expected) {
  const filename = await safePath(root, logical)
  const handle = await open(filename, 'r')
  try {
    const meta = await handle.stat()
    requireFact(meta.isFile(), 'history_not_regular_file')
    requireFact(meta.size <= maximum, 'history_byte_limit', 413)
    // Bound the allocation even if the source grows during a read.
    const buffer = Buffer.alloc(meta.size + 1)
    let used = 0
    while (used < buffer.length) { const read = await handle.read(buffer, used, buffer.length - used, used); if (!read.bytesRead) break; used += read.bytesRead }
    requireFact(used === meta.size, 'history_file_changed')
    const value = buffer.subarray(0, used)
    const digest = hash(value)
    if (expected !== undefined) requireFact(SHA.test(expected) && digest === expected, 'history_sha_mismatch')
    return { value, sha256: digest }
  } finally { await handle.close() }
}
async function json(root, binding) {
  requireFact(binding && typeof binding.path === 'string', 'history_binding_missing')
  const read = await bytes(root, binding.path, JSON_LIMIT, binding.sha256)
  try { return { value: JSON.parse(read.value.toString('utf8').replace(/^\uFEFF/, '')), sha256: read.sha256 } }
  catch { throw new HistoryError('history_json_invalid') }
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
  const runEvents = new Map(), runCapsules = new Map(), runKinds = new Map(), eventArtifacts = new Map()
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
  return { records: [...records.values()], runEvents, runCapsules, eventArtifacts, sourceRevision: current.registry.registryRevision, sourceSha256: current.registrySha256, verifiedAtUtc: new Date().toISOString(), revisionsVerified: visited, coverageGap }
}
function envelope(history) {
  const observedAtUtc = new Date().toISOString()
  return { dataStatus: 'connected', sourceIdentity: 'ai-painter-training-history', sourceRevision: history.sourceRevision, observedAtUtc, reasonCode: null, unavailableFields: [], provenance: { sourceIdentity: 'ai-painter-training-history', writerIdentity: 'ai_console_training_history_reader_v1', sourceRevision: history.sourceRevision, observedAtUtc, verifiedAtUtc: history.verifiedAtUtc, evidenceReferences: [`${REG}/current.json`, `${REG}/events.jsonl`, `${REG}/registry.sqlite`], trustStatus: 'verified_registry' } }
}
/** @param {{root?: string, cursor?: string|null, limit?: number}} options */
export async function listTrainingHistory({ root = historyRoot(), cursor = null, limit = 20 } = {}) {
  requireFact(Number.isInteger(limit) && limit >= 1 && limit <= 50, 'history_limit_invalid', 400)
  const history = await verifiedHistory(root)
  let offset = 0
  if (cursor !== null) {
    let decoded
    try { requireFact(typeof cursor === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(cursor), 'history_cursor_invalid', 400); decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) } catch { throw new HistoryError('history_cursor_invalid', 400) }
    requireFact(Number.isInteger(decoded.offset) && decoded.offset >= 0 && decoded.offset <= history.records.length && SHA.test(decoded.sha256), 'history_cursor_invalid', 400)
    requireFact(decoded.sha256 === history.sourceSha256, 'history_cursor_revision_conflict')
    offset = decoded.offset
  }
  const next = offset + limit
  return { ...envelope(history), dataStatus: history.coverageGap ? 'unknown_or_stale' : 'connected', reasonCode: history.coverageGap?.reasonCode ?? null, schemaVersion: 'ai_console_training_history_v1', records: history.records.slice(offset, next), total: history.coverageGap ? null : history.records.length, nextCursor: next < history.records.length ? Buffer.from(JSON.stringify({ sha256: history.sourceSha256, offset: next })).toString('base64url') : null, refreshIntervalMs: 2000, coverage: { scope: 'registered_latest_training_terminals_only', revisionsVerified: history.revisionsVerified, verifiedRecordCount: history.records.length, gap: history.coverageGap, directoryDiscovery: false, detailSupport: 'explicit_request_result_bindings; unsupported_schema_is_partial' } }
}
function artifact(runId, role, binding, metadata = {}) {
  requireFact(binding && typeof binding.path === 'string' && SHA.test(binding.sha256), 'history_artifact_binding_invalid')
  const artifactId = hash(JSON.stringify([runId, role, binding.path, binding.sha256]))
  return { artifactId, role, logicalPath: binding.path, sha256: binding.sha256, verificationStatus: 'binding_verified_bytes_not_read', ...metadata, url: `/api/ai-console/training/history/${encodeURIComponent(runId)}/artifacts/${artifactId}` }
}
export async function readTrainingRun(runId, { root = historyRoot() } = {}) {
  requireFact(typeof runId === 'string' && ID.test(runId), 'history_run_id_invalid', 400)
  const history = await verifiedHistory(root)
  const registration = history.records.find(record => record.runId === runId)
  requireFact(registration, 'history_run_not_found', 404)
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
    return adaptLegacyTrainingDetail({ runId, terminal, record, base, capsuleBinding: history.runCapsules.get(runId),
      readJson: async binding => (await json(root, binding)).value,
      makeArtifact: (role, binding, metadata) => artifact(runId, role, binding, metadata),
      checkpointMetadata: async item => { const meta = await stat(await safePath(root, item.logicalPath)); requireFact(meta.isFile(), 'history_checkpoint_not_file'); return { ...item, byteLength: meta.size } },
      requireFact,
    })
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
