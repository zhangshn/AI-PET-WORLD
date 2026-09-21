import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import ts from 'typescript'
import vm from 'node:vm'
import { listTrainingHistory, readTrainingRun, readTrainingArtifact } from '../../src/server/ai-console/training-history-store.mjs'
const REG = '.runtime/ai-painter/current-execution-registry'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1kAAAAASUVORK5CYII=', 'base64')
async function put(root, logical, value) {
  const file = path.join(root, logical); await mkdir(path.dirname(file), { recursive: true })
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
  await writeFile(file, bytes); return { path: logical, sha256: hash(bytes) }
}
async function fixture(t, count = 2, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'history-v22-test-'))
  await mkdir(path.join(root, REG), { recursive: true })
  await mkdir(path.join(root, 'data'), { recursive: true })
  const db = new DatabaseSync(path.join(root, REG, 'registry.sqlite'))
  t.after(async () => { db.close(); await rm(root, { recursive: true, force: true }) })
  db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
  let previous = null, previousTerminal = null; const events = []
  const append = async revision => {
    const runId = `fixture-run-${revision}`, transactionId = `fixture-tx-${revision}`
    const image = await put(root, `.runtime/ai-painter/${runId}/image.png`, options.fakeImage ? Buffer.from('not a png') : png)
    const checkpoint = await put(root, `.runtime/ai-painter/${runId}/checkpoint.pt`, Buffer.from('synthetic-weights-not-executed'))
    const variants = {
      decoder: ['ai-painter-decoder-binding-ab-package-v1', 'ai-painter-decoder-binding-ab-result-v1', 'decoder_binding_ab_0'],
      timestep: ['ai-painter-timestep-ab-package-v1', 'ai-painter-timestep-ab-result-v1', 'timestep_ab_0'],
      rgb: ['ai-painter-rgb-head-adaptation-package-v1', undefined, 'head_experiment_0'],
      learning: ['ai-painter-learning-capacity-experiment-package-v1', undefined, 'experiment_0'],
      ae: ['ai-painter-decoder-reconstruction-experiment-package-v1', undefined, 'experiment_0'],
    }
    const variant = variants[options.variant]
    const terminalStatus = ['learning', 'ae'].includes(options.variant) ? 'experiment_completed_not_formal_qualified' : 'completed_not_qualified'
    const request = await put(root, `.runtime/ai-painter/${runId}/request.json`, { schemaVersion: options.badPackageSchema ? 'unknown-package' : variant?.[0] ?? `ai-painter-endpoint-ab-request-${options.requestVersion ?? options.endpointVersion ?? 'v1'}`, identity: runId, experimentIdentity: options.crossRunPackage ? 'another-run' : runId, selectedRows: [{ sampleId: 'train-146', split: 'train', image }] })
    const resultData = { schemaVersion: variant ? variant[1] : `ai-painter-endpoint-ab-result-${options.resultVersion ?? options.endpointVersion ?? 'v1'}`, runId, experimentIdentity: runId, experimentKind: options.variant === 'rgb' ? 'five_rgb_heads_adaptation_frozen_ae_and_velocity_path' : undefined, status: 'completed_not_qualified', executionState: 'completed', request, artifacts: [image, checkpoint], optimizerSteps: 1, rows: [{ sampleId: 'train-146', split: 'train', arm: 'test', seed: 1, image, measurements: { loss: .5 } }], arms: [{ arm: 'test', checkpoint, optimizerSteps: 1 }] }
    const result = await put(root, `.runtime/ai-painter/${runId}/result.json`, resultData)
    const terminalValue = variant && ['decoder', 'timestep', 'rgb'].includes(options.variant) ? resultData : { schemaVersion: options.unsupported ? 'unsupported-fixture' : variant ? 'ai-painter-learning-capacity-experiment-terminal-v1' : `ai-painter-endpoint-ab-terminal-${options.endpointVersion ?? 'v1'}`, runId, experimentIdentity: runId, status: terminalStatus, executionState: 'completed', workerResult: result, result, formalTrainingQualified: false, formalStageAdvanced: false, checkpointPromotable: false, worldEntryAllowed: false }
    const terminal = await put(root, `.runtime/ai-painter/${runId}/terminal.json`, terminalValue)
    const capsule = await put(root, `.runtime/ai-painter/${runId}/capsule.json`, { schemaVersion: 'ai-painter-local-task-capsule-v1', taskId: runId, integrity: { status: 'verified' }, evidence: [{ ...terminal, sha256Verified: true }, ...(variant ? [{ ...request, kind: variant[2], sha256Verified: true }] : [])] })
    const latest = { ...terminal, runId, status: terminalStatus }
    const current = { schemaVersion: 'ai-painter-current-execution-registry-v1', registryRevision: revision, eventSequence: revision, writerIdentity: 'local_ai_capability_lifecycle_orchestrator', transactionId, taskId: runId, runId, taskCapsule: capsule, terminalEvidence: { ...terminal, status: terminalStatus }, activeExecution: null, latestTrainingTerminal: options.carryPrevious && previousTerminal ? previousTerminal : latest, supersedes: previous, archivedEvidenceNamespaces: [] }
    previousTerminal = latest
    const binding = await put(root, `${REG}/transactions/${transactionId}/current.staged.json`, current)
    await put(root, `${REG}/current.json`, current)
    await put(root, `${REG}/transactions/${transactionId}/transaction.json`, { schemaVersion: 'ai-painter-current-execution-registry-transaction-v1', transactionId, registryRevision: revision, eventSequence: revision, status: 'committed', currentSha256: binding.sha256, previousCurrentSha256: previous?.currentSha256 ?? null })
    db.prepare('INSERT INTO registry_revisions VALUES (?,?,?,?,?,?)').run(revision, revision, transactionId, binding.sha256, runId, runId)
    db.prepare('INSERT INTO registry_transactions VALUES (?,?,?)').run(transactionId, 'committed', binding.sha256)
    events.push({ registryRevision: revision, eventSequence: revision, transactionId, currentSha256: binding.sha256, taskId: runId, runId, previousCurrentSha256: previous?.currentSha256 ?? null })
    await put(root, `${REG}/events.jsonl`, Buffer.from(events.map(e => JSON.stringify(e)).join('\n') + '\n'))
    previous = { registryRevision: revision, eventSequence: revision, transactionId, currentSha256: binding.sha256, taskId: runId, runId }
  }
  for (let i = 1; i <= count; i++) await append(i)
  return { root, append, db }
}
test('real reader: pagination, source-bound cursor, new registered Run appears', async t => {
  const f = await fixture(t)
  const first = await listTrainingHistory({ root: f.root, limit: 1 })
  assert.equal(first.total, 2); assert.equal(first.records[0].runId, 'fixture-run-2')
  const second = await listTrainingHistory({ root: f.root, limit: 1, cursor: first.nextCursor })
  assert.equal(second.records[0].runId, 'fixture-run-1')
  await f.append(3)
  await assert.rejects(listTrainingHistory({ root: f.root, cursor: first.nextCursor }), /cursor_revision_conflict/)
  assert.equal((await listTrainingHistory({ root: f.root })).records[0].runId, 'fixture-run-3')
})
test('precise detail, original/output, Checkpoint metadata and no GET writes', async t => {
  const f = await fixture(t, 1)
  const before = await readFile(path.join(f.root, REG, 'current.json'))
  const entries = await readdir(path.join(f.root, REG))
  const detail = await readTrainingRun('fixture-run-1', { root: f.root })
  assert.equal(detail.record.samples.length, 1); assert.equal(detail.record.metrics.length, 1)
  const cp = detail.record.checkpoints[0]
  assert.equal(cp.verificationStatus, 'binding_verified_bytes_not_read')
  assert.equal((await readTrainingArtifact('fixture-run-1', cp.artifactId, { root: f.root })).bytes, undefined)
  const item = detail.record.artifacts.find(a => a.role === 'output')
  assert.deepEqual((await readTrainingArtifact('fixture-run-1', item.artifactId, { root: f.root })).bytes, png)
  assert.deepEqual(await readFile(path.join(f.root, REG, 'current.json')), before)
  assert.deepEqual(await readdir(path.join(f.root, REG)), entries)
  await writeFile(path.join(f.root, item.logicalPath), Buffer.from('tampered'))
  await assert.rejects(readTrainingArtifact('fixture-run-1', item.artifactId, { root: f.root }), /sha_mismatch/)
})
test('missing older snapshot retains verified prefix, never total zero or skips gap', async t => {
  const f = await fixture(t)
  await rm(path.join(f.root, REG, 'transactions/fixture-tx-1/current.staged.json'))
  const result = await listTrainingHistory({ root: f.root })
  assert.equal(result.dataStatus, 'unknown_or_stale'); assert.equal(result.total, null)
  assert.equal(result.records.length, 1); assert.equal(result.coverage.gap.fromRevision, 1)
  assert.equal((await readTrainingRun('fixture-run-2', { root: f.root })).dataStatus, 'connected')
})
test('fake image signature rejected', async t => {
  const f = await fixture(t, 1, { fakeImage: true })
  const detail = await readTrainingRun('fixture-run-1', { root: f.root })
  await assert.rejects(readTrainingArtifact('fixture-run-1', detail.record.artifacts.find(a => a.role === 'output').artifactId, { root: f.root }), /image_signature_invalid/)
})
test('symlink escape rejected before serving', async t => {
  const f = await fixture(t, 1)
  const detail = await readTrainingRun('fixture-run-1', { root: f.root })
  const item = detail.record.artifacts.find(a => a.role === 'output')
  const outside = await mkdtemp(path.join(tmpdir(), 'history-v22-outside-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  await writeFile(path.join(outside, 'image.png'), png)
  const imagePath = path.dirname(path.join(f.root, item.logicalPath))
  // Directory junction works without Windows symlink privilege; copy the small
  // fixture parents so the attack exercises resolved-root checking, not ENOENT.
  for (const name of await readdir(imagePath)) await writeFile(path.join(outside, name), await readFile(path.join(imagePath, name)))
  await rm(imagePath, { recursive: true })
  await symlink(outside, imagePath, 'junction')
  await assert.rejects(readTrainingArtifact('fixture-run-1', item.artifactId, { root: f.root }), /symlink_escape/)
})
test('invalid identifiers, limits and cursor rejected', async t => {
  const f = await fixture(t, 1)
  await assert.rejects(readTrainingRun('../escape', { root: f.root }), /run_id_invalid/)
  await assert.rejects(listTrainingHistory({ root: f.root, limit: 51 }), /limit_invalid/)
  await assert.rejects(listTrainingHistory({ root: f.root, cursor: 'bad' }), /cursor_invalid/)
})
function loadTs(source, dependencies = {}) {
  const exports = {}; const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { exports, require: name => dependencies[name], Buffer, URL, Response, Error, AbortController, setTimeout, clearTimeout })
  return exports
}
test('SQLite Run identity conflict is rejected', async t => {
  const f = await fixture(t, 1)
  f.db.prepare('UPDATE registry_revisions SET run_id = ?').run('forged-run')
  await assert.rejects(listTrainingHistory({ root: f.root }), /sqlite_run_conflict/)
})
test('event Run and previous SHA conflicts are rejected', async t => {
  for (const field of ['runId', 'previousCurrentSha256']) {
    const f = await fixture(t, 1)
    const filename = path.join(f.root, REG, 'events.jsonl')
    const event = JSON.parse((await readFile(filename, 'utf8')).trim())
    event[field] = 'forged'
    await writeFile(filename, JSON.stringify(event) + '\n')
    await assert.rejects(listTrainingHistory({ root: f.root }), /history_(event_run|previous_sha)_conflict/)
  }
})
test('unknown Schema stays partial and timestamps are not invented', async t => {
  const f = await fixture(t, 1, { unsupported: true })
  const detail = await readTrainingRun('fixture-run-1', { root: f.root })
  assert.equal(detail.dataStatus, 'partial'); assert.match(detail.reasonCode, /schema_unsupported/)
  assert.equal(detail.record.finishedAtUtc, null); assert.ok(detail.record.unavailableFields.includes('finishedAtUtc'))
})
test('decoder/timestep/RGB/learning/AE exact legacy package adapters and image bytes', async t => {
  for (const variant of ['decoder', 'timestep', 'rgb', 'learning', 'ae']) {
    const f = await fixture(t, 1, { variant })
    const detail = await readTrainingRun('fixture-run-1', { root: f.root })
    assert.equal(detail.reasonCode, 'history_output_association_not_recorded')
    assert.equal(detail.record.samples.length, 1); assert.equal(detail.record.metrics.length, 1)
    assert.equal(detail.record.checkpoints.length, 1); assert.equal(detail.record.events.length, 1)
    const item = detail.record.artifacts.find(a => a.role === 'image')
    assert.equal(item.sampleId, undefined) // Never invent association from filename.
    assert.deepEqual((await readTrainingArtifact('fixture-run-1', item.artifactId, { root: f.root })).bytes, png)
  }
})
test('carried historical terminal never owns the new task event or capsule', async t => {
  const f = await fixture(t, 2, { carryPrevious: true, variant: 'decoder' })
  const detail = await readTrainingRun('fixture-run-1', { root: f.root })
  assert.deepEqual(detail.record.events.map(event => event.runId), ['fixture-run-1'])
  assert.deepEqual(detail.record.events.map(event => event.registryRevision), [1])
  assert.equal(detail.record.samples.length, 1)
  assert.equal(detail.record.registeredAtUtc, null)
})
test('legacy package cross-Run and unknown Schema are rejected despite valid arrays', async t => {
  for (const options of [{ crossRunPackage: true }, { badPackageSchema: true }]) {
    const f = await fixture(t, 1, { variant: 'decoder', ...options })
    await assert.rejects(readTrainingRun('fixture-run-1', { root: f.root }), /history_package_(run|schema)_conflict/)
  }
})
test('unknown terminal retains readable transaction evidence and incomplete event coverage', async t => {
  const f = await fixture(t, 2, { unsupported: true })
  await rm(path.join(f.root, REG, 'transactions/fixture-tx-1/current.staged.json'))
  const detail = await readTrainingRun('fixture-run-2', { root: f.root })
  assert.equal(detail.record.eventCoverage.complete, false)
  assert.equal(detail.record.eventCoverage.gap.fromRevision, 1)
  const item = detail.record.artifacts.find(a => a.role === 'registry_transaction')
  const evidence = await readTrainingArtifact('fixture-run-2', item.artifactId, { root: f.root })
  assert.equal(JSON.parse(evidence.json.text).transactionId, 'fixture-tx-2')
})
test('loopback guard blocks fake Host/forwarded Host, arbitrary query and accepts local', async () => {
  const session = loadTs(await readFile('src/server/ai-console-control/operator-session.ts', 'utf8'), { 'node:crypto': await import('node:crypto') })
  const guard = loadTs(await readFile('src/server/ai-console/training-history-http.ts', 'utf8'), { '../ai-console-control/operator-session': session, './training-history-store.mjs': {} }).guardHistoryRequest
  assert.equal(guard(new Request('http://localhost:3001/api', { headers: { host: 'attacker.test' } })).status, 403)
  assert.equal(guard(new Request('http://localhost:3001/api', { headers: { host: 'localhost:3001', 'x-forwarded-host': 'attacker.test' } })).status, 403)
  assert.equal(guard(new Request('http://localhost:3001/api?path=secret', { headers: { host: 'localhost:3001' } })).status, 400)
  assert.equal(guard(new Request('http://localhost:3001/api', { headers: { host: 'localhost:3001' } })), null)
})
test('poll timeout, no overlap, automatic recovery and stop', async () => {
  const { startHistoryPolling } = loadTs(await readFile('src/app/ai-console/ai-console-history-poll.ts', 'utf8'))
  let calls = 0, failures = 0, running = 0, maximum = 0
  const stop = startHistoryPolling(async signal => {
    calls++; running++; maximum = Math.max(maximum, running)
    try { if (calls === 1) await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })) }
    finally { running-- }
  }, () => failures++, 10, 20)
  await new Promise(resolve => setTimeout(resolve, 80)); stop()
  const count = calls; await new Promise(resolve => setTimeout(resolve, 35))
  assert.equal(maximum, 1); assert.equal(failures, 1); assert.ok(calls >= 2); assert.equal(calls, count)
})

test('endpoint v2 exact triplet works; mixed terminal/result/request versions fail closed', async t => {
  const f = await fixture(t, 1, { endpointVersion: 'v2' })
  const detail = await readTrainingRun('fixture-run-1', { root: f.root })
  assert.equal(detail.dataStatus, 'connected'); assert.equal(detail.record.metrics.length, 1)
  assert.equal(detail.record.checkpoints.length, 1)
  for (const options of [{ endpointVersion: 'v2', resultVersion: 'v1' }, { endpointVersion: 'v2', requestVersion: 'v1' }, { endpointVersion: 'v1', resultVersion: 'v2' }]) {
    const mixed = await fixture(t, 1, options)
    await assert.rejects(readTrainingRun('fixture-run-1', { root: mixed.root }), /history_(result|request)_schema_conflict/)
  }
})

test('endpoint v3 is additive; v1/v2/v3 details remain supported and mixed schemas fail', async t => {
  for (const endpointVersion of ['v1', 'v2', 'v3']) {
    const f = await fixture(t, 1, { endpointVersion })
    const detail = await readTrainingRun('fixture-run-1', { root: f.root })
    assert.equal(detail.dataStatus, 'connected')
    assert.equal(detail.record.metrics.length, 1)
    assert.equal(detail.record.checkpoints.length, 1)
  }
  for (const options of [{ endpointVersion: 'v3', resultVersion: 'v2' }, { endpointVersion: 'v3', requestVersion: 'v2' }, { endpointVersion: 'v2', resultVersion: 'v3' }]) {
    const mixed = await fixture(t, 1, options)
    await assert.rejects(readTrainingRun('fixture-run-1', { root: mixed.root }), /history_(result|request)_schema_conflict/)
  }
})
