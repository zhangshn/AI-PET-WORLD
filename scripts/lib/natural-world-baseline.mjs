import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { syncBuiltinESMExports } from 'node:module'
import { BASELINE_PRODUCER, BASELINE_DELIVERY, BASELINE_PREFIX, BASELINE_IDENTITY, BASELINE_CONTRACT,
  BASELINE_SELECTION, BASELINE_CODE_FILES, baselineQualification, baselineSha256 as sha, baselineDigest as digest,
  baselineNeed as need, baselineLogicalPath, baselineJson, verifyNaturalRecordBytes, verifyNaturalWorldBaselineProof } from './natural-world-baseline-proof.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CLI = path.join(ROOT, 'scripts/run-natural-world-baseline.mjs')
const TEST_PREFIX = '.runtime/ai-painter/controller-repair-reviews/mvp-world-baseline-145-20261029/t/'
const MAX_OUTPUT = 134217728
const MAX_STREAM = 256 * 1024
const jsonBytes = v => Buffer.from(JSON.stringify(v, null, 2) + '\n')
const relative = p => path.relative(ROOT, p).replaceAll('\\', '/')
const absolute = p => path.resolve(ROOT, baselineLogicalPath(p))
function present(p) { try { fs.lstatSync(p); return true } catch (e) { if (e.code === 'ENOENT') return false; throw e } }
function safe(p) {
  const logical = baselineLogicalPath(p), target = absolute(logical)
  const base = logical.startsWith('.runtime/') ? path.join(ROOT, '.runtime') : ROOT
  const rel = path.relative(base, target)
  need(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'physical_scope')
  let current = base
  for (const part of rel.split(path.sep)) {
    current = path.join(current, part)
    if (!present(current)) break
    need(!fs.lstatSync(current).isSymbolicLink(), 'link')
  }
  return target
}
export function readBaselineFile(logical, max = 4 * 1024 * 1024) {
  const p = safe(logical), fd = fs.openSync(p, 'r')
  try {
    const before = fs.fstatSync(fd)
    need(before.isFile() && before.nlink === 1 && before.size > 0 && before.size <= max, 'file_size_or_identity')
    const bytes = fs.readFileSync(fd), after = fs.fstatSync(fd)
    need(after.size === bytes.length && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ino === after.ino, 'file_changed')
    return bytes
  } finally { fs.closeSync(fd) }
}
const readJson = (p, max) => baselineJson(readBaselineFile(p, max), max)
function binding(logical, max = 16 * 1024 * 1024) { const b = readBaselineFile(logical, max); return { path: logical, sha256: sha(b), bytes: b.length } }
function write(logical, value) {
  const p = safe(logical), bytes = jsonBytes(value)
  need(bytes.length <= 4 * 1024 * 1024, 'result_size')
  const fd = fs.openSync(p, 'wx')
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  return { path: logical, sha256: sha(bytes), bytes: bytes.length }
}
function mkdir(logical) { fs.mkdirSync(safe(logical)) }
function config(fixtureRoot) {
  if (!fixtureRoot) {
    need(process.env.NODE_ENV !== 'production' && !process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT, 'local_adapter_required')
    return { identity: { ...BASELINE_IDENTITY }, identityScope: 'local_mvp_delivery_namespace',
      worldRoot: BASELINE_PREFIX + BASELINE_IDENTITY.worldId, storeRoot: 'data/world-runtime', fixture: false }
  }
  baselineLogicalPath(fixtureRoot)
  need(fixtureRoot.startsWith(TEST_PREFIX) && /^[a-f0-9]{8}$/.test(fixtureRoot.slice(TEST_PREFIX.length)), 'fixture_scope')
  need(readBaselineFile(fixtureRoot + '/fixture.marker', 128).toString() === 'natural-world-baseline-private-fixture-v1', 'fixture_marker')
  const id = fixtureRoot.slice(TEST_PREFIX.length)
  return { identity: { ownerId: 'baseline-test-owner-' + id, playerId: 'baseline-test-player-' + id,
    worldId: 'baseline-test-world-' + id, worldSeed: 'baseline-test-seed-' + id, regionId: 'baseline-test-region-' + id,
    worldProfileId: BASELINE_IDENTITY.worldProfileId }, identityScope: 'private_test_fixture',
    worldRoot: fixtureRoot + '/w', storeRoot: fixtureRoot + '/store', fixture: true, fixtureRoot }
}
function slot(c) { return c.storeRoot + '/' + c.identity.ownerId + '/' + c.identity.worldId + '.json' }
function slotPresent(c) {
  const p = safe(slot(c)), owner = path.dirname(p)
  return present(p) || present(owner) && fs.readdirSync(owner).some(n => n.startsWith(path.basename(p)))
}
function outputBytes(c) {
  let total = 0, files = 0
  const visit = p => {
    if (!present(p)) return
    const s = fs.lstatSync(p); need(!s.isSymbolicLink(), 'output_link')
    if (s.isDirectory()) { for (const n of fs.readdirSync(p)) visit(path.join(p, n)) }
    else { need(s.isFile() && ++files <= 512, 'output_files'); total += s.size }
    need(total <= MAX_OUTPUT, 'output_budget')
  }
  visit(safe(c.worldRoot)); const record = safe(slot(c)); if (present(record)) total += fs.statSync(record).size
  need(total <= MAX_OUTPUT, 'output_budget'); return { bytes: total, files }
}
function proc(start, pid, elapsed) { return { pid, exitCode: 0, startedAtUtc: start, finishedAtUtc: new Date().toISOString(), elapsedMs: elapsed } }
async function child(action, requestRef, c, deadline) {
  const left = Math.min(120000, Math.floor(deadline - performance.now()))
  need(left > 0, 'deadline')
  const startedAtUtc = new Date().toISOString(), started = performance.now()
  const cp = spawn(process.execPath, [CLI, '--internal-worker', action, requestRef.path, requestRef.sha256], {
    cwd: ROOT, windowsHide: true, env: { ...process.env, NODE_ENV: c.fixture ? 'production' : 'development',
      AI_PET_WORLD_RUNTIME_STORE_ROOT: c.fixture ? absolute(c.storeRoot) : '', UV_THREADPOOL_SIZE: '2', OMP_NUM_THREADS: '2',
      MKL_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '2' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = '', streamBytes = 0, failure = null
  const consume = (kind, b) => { streamBytes += b.length; if (streamBytes > MAX_STREAM) { failure = 'baseline_stream_budget'; cp.kill() }
    else if (kind === 'stdout') stdout += b.toString(); else stderr += b.toString() }
  cp.stdout.on('data', b => consume('stdout', b)); cp.stderr.on('data', b => consume('stderr', b))
  const timer = setTimeout(() => { failure = 'baseline_child_timeout'; cp.kill() }, left)
  const monitor = setInterval(() => { try { outputBytes(c) } catch (e) { failure = e.message; cp.kill() } }, 100)
  let code
  try { code = await new Promise((resolve, reject) => { cp.once('error', reject); cp.once('close', resolve) }) }
  finally { clearTimeout(timer); clearInterval(monitor) }
  const observation = { pid: cp.pid, exitCode: code, startedAtUtc, finishedAtUtc: new Date().toISOString(), elapsedMs: performance.now() - started }
  const request = readJson(requestRef.path), receiptPath = request.runRoot + '/' + (action === 'create' ? 'writer' : 'reader') + '.json'
  write(request.runRoot + '/' + action + '-process.json', { schemaVersion: 'natural-world-baseline-process-observation-v1',
    process: observation, streamBytes, reasonCode: failure, stderr, stdout })
  let receipt = null
  try { if (present(safe(receiptPath))) receipt = readJson(receiptPath) } catch { failure ??= 'baseline_receipt_unreadable' }
  return { observation, receipt, receiptRef: receipt ? binding(receiptPath) : null, failure: failure ?? (code === 0 ? null : 'baseline_child_failed') }
}

/** Parent controller. No model, training, frame or world evolution work is performed. */
export async function runNaturalWorldBaseline({ command, fixtureRoot } = {}) {
  need(['create', 'verify', 'publish-selection'].includes(command), 'command')
  need(fs.realpathSync(ROOT) === fs.realpathSync(process.cwd()), 'cwd')
  const c = config(fixtureRoot), startedAtUtc = new Date().toISOString(), started = performance.now(), deadline = started + 115000
  if (command === 'publish-selection') { need(!c.fixture, 'fixture_selection_forbidden'); return publishSelection(c) }
  let artifactRunId, originalWriter
  if (command === 'create') {
    need(!slotPresent(c) && !present(safe(c.worldRoot)), 'existing_world_or_outputs')
    if (!c.fixture) fs.mkdirSync(safe(BASELINE_PREFIX.slice(0, -1)), { recursive: true })
    mkdir(c.worldRoot); mkdir(c.worldRoot + '/runs')
  } else {
    const reservation = readJson(c.worldRoot + '/reservation.json')
    need(reservation.schemaVersion === 'natural-world-baseline-reservation-v1', 'reservation')
    artifactRunId = reservation.runId
    originalWriter = readJson(c.worldRoot + '/runs/' + artifactRunId + '/writer.json')
    need(originalWriter.operation === 'create' && originalWriter.result, 'writer_unverified')
  }
  const runId = 'baseline-' + randomUUID().replaceAll('-', ''), runRoot = c.worldRoot + '/runs/' + runId
  mkdir(runRoot)
  const input = { schemaVersion: 'natural-world-bootstrap-input-v1', ...c.identity, createdAtUtc: new Date().toISOString() }
  const request = { schemaVersion: 'natural-world-baseline-request-v1', config: c, runId, runRoot, command,
    artifactRunId: artifactRunId ?? runId, input }
  const requestRef = write(runRoot + '/request.json', request)
  if (command === 'create') write(c.worldRoot + '/reservation.json', { schemaVersion: 'natural-world-baseline-reservation-v1', runId, requestRef })
  let writer = null, reader = null, status = 'failed', reasonCode = null
  try {
    if (command === 'create') {
      writer = await child('create', requestRef, c, deadline)
      if (writer.failure || !writer.receipt?.result) throw new Error(writer.failure ?? 'baseline_writer_failed')
      originalWriter = writer.receipt; artifactRunId = runId
    }
    reader = await child('read', requestRef, c, deadline)
    if (reader.failure || !reader.receipt?.record) throw new Error(reader.failure ?? 'baseline_readback_failed')
    need(originalWriter.process.pid !== reader.receipt.process.pid, 'same_process')
    status = 'baseline_verified'
  } catch (e) { reasonCode = /^baseline_[a-z_]+$/.test(e.message) ? e.message : 'baseline_operation_failed'; status = slotPresent(c) ? 'saved_unverified' : 'failed' }
  let observedStoreRef = null, storeObservationError = null
  if (present(safe(slot(c)))) { try { observedStoreRef = binding(slot(c)) } catch (e) { storeObservationError = e.message } }
  const proof = { schemaVersion: 'natural-world-baseline-result-v1', producerId: BASELINE_PRODUCER, deliveryId: BASELINE_DELIVERY,
    runId, command, status, identity: c.identity, identityScope: c.identityScope,
    creation: { artifactRunId: artifactRunId ?? runId, mode: 'configured_store', before: { slot: 'not_found', outputs: 'absent' },
      writer: originalWriter?.process ?? writer?.observation ?? null,
      writerObservationRef: present(safe(c.worldRoot + '/runs/' + (artifactRunId ?? runId) + '/create-process.json'))
        ? binding(c.worldRoot + '/runs/' + (artifactRunId ?? runId) + '/create-process.json') : null,
      bootstrapResultRef: originalWriter?.result?.resultBinding ? binding(originalWriter.result.resultBinding.path) : null,
      storeRef: reader?.receipt?.storeRef ?? observedStoreRef, after: reader?.receipt?.record ?? null,
      persistenceStatus: status === 'baseline_verified' ? 'verified' : slotPresent(c) ? 'commit_unknown' : 'not_observed',
      reasonCode, storeObservationError, slotOrJournalPresent: slotPresent(c), storeOutcome: originalWriter?.failure?.storeOutcome ?? null },
    readback: { reader: reader?.receipt?.process ?? reader?.observation ?? null,
      readerObservationRef: present(safe(runRoot + '/read-process.json')) ? binding(runRoot + '/read-process.json') : null,
      receiptRef: reader?.receiptRef ?? null },
    source: reader?.receipt?.source ?? null, conditions: reader?.receipt?.conditions ?? null, counts: reader?.receipt?.counts ?? null,
    timing: { createdAtUtc: originalWriter?.input?.createdAtUtc ?? input.createdAtUtc, startedAtUtc, finishedAtUtc: new Date().toISOString(), elapsedMs: performance.now() - started },
    codeBindings: reader?.receipt?.codeBindings ?? [], qualification: baselineQualification() }
  const proofRef = write(runRoot + '/result.json', proof)
  outputBytes(c)
  if (status === 'baseline_verified' && !present(safe(c.worldRoot + '/baseline-result-ref.json'))) write(c.worldRoot + '/baseline-result-ref.json', proofRef)
  return { status, runId, identity: c.identity, proofRef, reasonCode, qualification: baselineQualification() }
}

function publishSelection(c) {
  const proofRef = readJson(c.worldRoot + '/baseline-result-ref.json')
  const candidate = { schemaVersion: 'natural-world-baseline-selection-v1', deliveryId: BASELINE_DELIVERY,
    identity: c.identity, proofRef, selectedAtUtc: new Date().toISOString() }
  verifyNaturalWorldBaselineProof({ selection: candidate, read: readBaselineFile })
  const target = safe(BASELINE_SELECTION)
  if (present(target)) {
    const old = readJson(BASELINE_SELECTION)
    need(old.schemaVersion === candidate.schemaVersion && old.deliveryId === candidate.deliveryId &&
      digest(old.identity) === digest(candidate.identity) && digest(old.proofRef) === digest(candidate.proofRef), 'selection_conflict')
    return { status: 'selection_published', replayed: true, proofRef }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temp = BASELINE_SELECTION + '.prepared-' + randomUUID(), bytes = jsonBytes(candidate)
  const fd = fs.openSync(safe(temp), 'wx')
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  try { fs.linkSync(safe(temp), target) } finally { fs.unlinkSync(safe(temp)) }
  return { status: 'selection_published', replayed: false, proofRef }
}

export async function runBaselineWorker(action, requestPath, expectedSha256) {
  need(['create', 'read'].includes(action), 'worker_action')
  const raw = readBaselineFile(requestPath)
  need(sha(raw) === expectedSha256, 'worker_request_digest')
  const request = baselineJson(raw), c = config(request.config.fixtureRoot)
  need(digest(c) === digest(request.config) && request.runRoot === c.worldRoot + '/runs/' + request.runId &&
    /^baseline-[a-f0-9]{32}$/.test(request.runId) && requestPath === request.runRoot + '/request.json', 'worker_request')
  const startedAtUtc = new Date().toISOString(), started = performance.now()
  const timer = setTimeout(() => process.exit(124), 119000)
  let receipt
  try {
    await guardWorker(c, request.runRoot)
    const sharp = (await import('sharp')).default; sharp.concurrency(1); sharp.cache(false)
    const { loadNaturalWorldBaselineRuntime } = await import('./natural-world-baseline-ts-loader.mjs')
    const runtime = await loadNaturalWorldBaselineRuntime(ROOT)
    if (action === 'create') {
      need(!slotPresent(c), 'slot_exists')
      const result = await runtime.bootstrap.createInitialNaturalWorld(request.input, { outputRoot: absolute(request.runRoot + '/bootstrap'), mode: 'configured_store' })
      receipt = { schemaVersion: 'natural-world-baseline-writer-v1', operation: 'create', input: request.input, result }
    } else receipt = await verifyReadback(request, c, runtime)
    receipt.producerId = BASELINE_PRODUCER
    receipt.process = proc(startedAtUtc, process.pid, performance.now() - started)
    write(request.runRoot + '/' + (action === 'create' ? 'writer' : 'reader') + '.json', receipt)
  } catch (e) {
    const failurePath = request.runRoot + '/bootstrap/bootstrap-failure.json'
    const failure = present(safe(failurePath)) ? readJson(failurePath) : null
    receipt = { schemaVersion: 'natural-world-baseline-worker-failure-v1', producerId: BASELINE_PRODUCER, operation: action,
      process: { ...proc(startedAtUtc, process.pid, performance.now() - started), exitCode: 1 },
      reasonCode: /^baseline_[a-z_]+$/.test(e.message) ? e.message : 'baseline_existing_component_failed',
      detail: String(e.message).slice(0, 2048), slotOrJournalPresent: slotPresent(c), failure }
    write(request.runRoot + '/' + (action === 'create' ? 'writer' : 'reader') + '.json', receipt)
    process.exitCode = 1
  } finally { clearTimeout(timer) }
}

async function guardWorker(c, runRoot) {
  const denied = () => { throw new Error('baseline_network_or_subprocess_forbidden') }
  globalThis.fetch = denied
  for (const [module, methods] of [['node:http', ['request', 'get']], ['node:https', ['request', 'get']],
    ['node:net', ['connect', 'createConnection']], ['node:tls', ['connect']],
    ['node:child_process', ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']]]) {
    const builtin = (await import(module)).default
    for (const method of methods) builtin[method] = denied
  }
  const allowed = p => {
    const candidate = relative(path.resolve(String(p)))
    return candidate === c.storeRoot || candidate.startsWith(c.storeRoot + '/') || candidate === runRoot || candidate.startsWith(runRoot + '/')
  }
  const check = p => need(allowed(p), 'worker_write_scope')
  const syncWrite = fs.writeFileSync.bind(fs), syncMkdir = fs.mkdirSync.bind(fs)
  const syncOpen = fs.openSync.bind(fs), syncClose = fs.closeSync.bind(fs), writableFds = new Set()
  let written = 0
  const account = data => { written += Buffer.isBuffer(data) ? data.length : Buffer.byteLength(String(data)); need(written <= MAX_OUTPUT, 'write_budget') }
  fs.openSync = (p, flags, ...rest) => { const writing = /[wa+]/.test(String(flags)); if (writing) check(p)
    const fd = syncOpen(p, flags, ...rest); if (writing) writableFds.add(fd); return fd }
  fs.closeSync = fd => { writableFds.delete(fd); return syncClose(fd) }
  fs.writeFileSync = (p, data, ...rest) => { if (typeof p === 'number') need(writableFds.has(p), 'worker_write_fd'); else check(p)
    account(data); return syncWrite(p, data, ...rest) }
  fs.mkdirSync = (p, ...rest) => { if (!present(p)) check(p); return syncMkdir(p, ...rest) }
  const fsp = (await import('node:fs/promises')).default
  for (const name of ['mkdir', 'rename', 'rm', 'unlink']) {
    const original = fsp[name].bind(fsp)
    fsp[name] = async (...args) => {
      if (name !== 'mkdir' || !present(args[0])) check(args[0])
      if (name === 'rename') check(args[1])
      return original(...args)
    }
  }
  const open = fsp.open.bind(fsp)
  fsp.open = async (p, flags, ...rest) => {
    const writing = /[wa+]/.test(String(flags)); if (writing) check(p)
    const handle = await open(p, flags, ...rest)
    if (writing) { const writeFile = handle.writeFile.bind(handle); handle.writeFile = (data, ...args) => { account(data); return writeFile(data, ...args) } }
    return handle
  }
  syncBuiltinESMExports()
}

async function verifyReadback(request, c, runtime) {
  const origin = c.worldRoot + '/runs/' + request.artifactRunId, writer = readJson(origin + '/writer.json')
  need(writer.operation === 'create' && writer.result, 'original_writer_missing')
  const b = writer.result
  const restored = await runtime.facade.readNaturalWorldRuntimeSaveRecord({ ownerId: c.identity.ownerId, worldId: c.identity.worldId,
    expectedPlayerId: c.identity.playerId, expectedTick: 0, expectedStateVersion: 0, expectedFileSha256: b.stored.fileSha256 })
  need(restored.status === 'found' && restored.record, 'store_readback')
  const storeRef = binding(slot(c)), record = verifyNaturalRecordBytes(readBaselineFile(storeRef.path), c.identity)
  need(restored.fileSha256 === storeRef.sha256 && digest(restored.record) === digest(record), 'facade_readback')
  const { verifyNaturalWorldFactRelease } = await import('../build-earth-geospatial-complete-map-conditions.mjs')
  const { verifyNaturalWorldConditionPackage } = await import('../compile-current-world-visual-conditions.mjs')
  const generatedBytes = readBaselineFile(b.generatedFactsBinding.path)
  need(sha(generatedBytes) === b.generatedFactsBinding.sha256, 'generated_preflight_digest')
  const generated = baselineJson(generatedBytes)
  need(Array.isArray(generated.sourceInputReads) && generated.sourceInputReads.length <= 256, 'source_preflight_shape')
  const preflight = new Map()
  for (const ref of generated.sourceInputReads) {
    const s = fs.statSync(safe(ref.path))
    need(s.isFile() && s.nlink === 1 && s.size === ref.bytes && s.size > 0 && s.size <= 128 * 1024 * 1024, 'source_preflight_size')
    preflight.set(ref.path, s.size)
  }
  need([...preflight.values()].reduce((a, v) => a + v, 0) <= 256 * 1024 * 1024, 'source_preflight_budget')
  const verified = await verifyNaturalWorldFactRelease({ root: ROOT, binding: b.sourceFactReleaseBinding })
  need(digest(verified.factsEnvelope) === record.worldFactsPayloadSha256 && digest(record.randomState) === digest(verified.proposal.randomState), 'source_replay')
  need(digest(record.worldState.payload.environment) === digest({ ...verified.proposal.environment,
    resourceInitialization: 'no_resource_instances_created', runtimeEvents: 'none_created' }) &&
    digest(record.worldState.payload.objects) === digest(record.worldFacts.payload.objectFootprints) &&
    record.ruleVersion === verified.proposal.ruleVersion, 'state_replay')
  const typed = await verifyNaturalWorldConditionPackage({ manifestBinding: b.conditionManifestBinding, expected: {
    worldId: c.identity.worldId, regionId: c.identity.regionId, tick: 0, factHash: record.worldFactsPayloadSha256,
    sourceFactReleaseIdentity: verified.release.sourceFactReleaseIdentity } })
  let sourceBytes = 0
  const inputRefs = [...new Map(verified.proposal.sourceInputReads.map(r => {
    need(Number.isSafeInteger(r.bytes) && r.bytes > 0 && r.bytes <= 128 * 1024 * 1024, 'source_input_size')
    sourceBytes += r.bytes; need(sourceBytes <= 256 * 1024 * 1024, 'source_input_budget')
    const ref = binding(r.path, 128 * 1024 * 1024); need(ref.sha256 === r.fileSha256 && ref.bytes === r.bytes, 'source_input_digest'); return [ref.path, ref]
  })).values()]
  const codeNames = [...new Set([...BASELINE_CODE_FILES, ...verified.release.producerBindings.map(x => x.path)])]
  const codeBindings = codeNames.map(f => binding(f))
  const channels = typed.pack.channels.map(ch => ({ id: ch.id, kind: ch.kind, ...binding(ch.path), shape: ch.shape, dtype: ch.dtype }))
  return { schemaVersion: 'natural-world-baseline-readback-v1', runId: request.runId, identity: c.identity, storeRef,
    record: { fileSha256: storeRef.sha256, recordContentSha256: record.recordContentSha256,
      worldFactsPayloadSha256: record.worldFactsPayloadSha256, statePayloadSha256: record.statePayloadSha256,
      tick: record.tick, stateVersion: record.stateVersion, eventCursor: record.eventCursor, ruleVersion: record.ruleVersion,
      randomStateSha256: digest(record.randomState) },
    source: { contractRef: binding(BASELINE_CONTRACT.path), sourceFactReleaseRef: binding(b.sourceFactReleaseBinding.path),
      sourcePackageRef: binding(b.sourcePackageBinding.path), generatedFactsRef: binding(b.generatedFactsBinding.path), inputRefs },
    conditions: { manifestRef: binding(b.conditionManifestPath), packageRef: binding(b.conditionPackPath),
      tensorContractRef: binding(typed.pack.identityBindings.conditionContractPath), channels },
    counts: { terrainRegionCount: record.worldFacts.payload.terrainRegions.length, objectCount: record.worldFacts.payload.objectFootprints.length,
      walkableRegionCount: record.worldFacts.payload.walkableRegions.length, collisionRegionCount: record.worldFacts.payload.collisionRegions.length, conditionChannelCount: channels.length },
    codeBindings, method: 'original_store_exited_writer_source_replay_and_23_png_decode', modelExecuted: false }
}
