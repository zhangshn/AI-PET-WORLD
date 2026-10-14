import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DRY_RECOVERY_CANDIDATE_SCHEMA, readDryRecoveryCandidate } from '../../src/server/ai-console/training-history-detail-adapters.mjs'
import { scanHistoryEvidence, readHistoryEvidenceIndex, HISTORY_INDEX_PATH } from '../../src/server/ai-console/training-history-evidence-index.mjs'
import { readTrainingRun, readTrainingRunSection, readTrainingArtifact, bytes } from '../../src/server/ai-console/training-history-store.mjs'
import { requireFact } from '../../src/server/ai-console/training-history-safe-bytes.mjs'

const REG = '.runtime/ai-painter/current-execution-registry'
const digest = value => createHash('sha256').update(value).digest('hex')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1kAAAAASUVORK5CYII=', 'base64')
function fixture(options = {}) {
  const files = new Map(), calls = [], runId = 'dry-recovery-fixture', outputRoot = `.runtime/ai-painter/${runId}`
  const identity = { runId, packageId: 'recovery-package', capabilityVersion: 'recovery-capability' }
  const bind = (logical, value) => {
    const raw = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    files.set(logical, raw); return { path: logical, sha256: digest(raw) }
  }
  const cp = bind(`${outputRoot}/unusual-weight.pt`, Buffer.from('fixture-not-deserialized'))
  const output = bind(`${outputRoot}/arbitrary-output-name.png`, options.fakeImage ? Buffer.from('not-png') : png)
  const original = bind('data/arbitrary-reference-name.png', png)
  const condition = bind('data/arbitrary-condition.json', { sampleId: 'a' })
  const membership = bind('data/membership.json', { split: 'validation', sampleIds: ['a', 'b'] })
  const pkg = { ...identity, schemaVersion: 'ai-painter-stage4-mvp256-dry-v24-execution-package-v1', outputRoot,
    validationSplit: membership, trainingPlan: { epochs: 4, generatorOptimizerSteps: 8, discriminatorOptimizerSteps: 8,
      validationRows: 2, eligibleCheckpointEpochs: [4] } }
  options.package?.(pkg)
  const executionPackage = bind(`${outputRoot}/execution-package.json`, pkg)
  const worker = { ...identity, schemaVersion: 'ai-painter-stage4-mvp256-dry-v24-worker-terminal-v1',
    executionPackage, executionState: 'completed', status: 'training_completed_review_pending',
    completedEpochs: 4, optimizerStepsGenerator: 8, optimizerStepsDiscriminator: 8, selectedEpoch: 4,
    selectedCheckpointBinding: cp, checkpointReloadVerified: true,
    checkpoints: [{ epoch: 4, selection: { epoch: 4 }, checkpoint: cp,
      validation: ['a', 'b'].map(sampleId => ({ sampleId, split: 'validation', epoch: 4, fullRgbMae: 0.2 })) }] }
  options.worker?.(worker)
  const workerTerminal = bind(`${outputRoot}/arbitrary-worker.json`, worker)
  const terminal = { ...identity, schemaVersion: 'ai-painter-mvp256-dry-v24-training-lifecycle-v1',
    executionState: 'completed', status: 'training_completed_review_pending', executionPackage, workerTerminal,
    selectedCheckpoint: cp, selectedEpoch: 4 }
  options.terminal?.(terminal)
  const terminalBinding = bind(`${outputRoot}/arbitrary-training-terminal.json`, terminal)
  const manifestPath = `${outputRoot}/no-filename-discovery-hints.json`
  const manifest = { ...identity, schemaVersion: DRY_RECOVERY_CANDIDATE_SCHEMA, inputPath: manifestPath,
    status: 'candidate_materialized_review_pending', executionPackage, workerTerminal, trainingTerminal: terminalBinding,
    selectedCheckpoint: cp, selectedEpoch: 4,
    subject: { sampleId: 'a', split: 'validation', referenceRgb: original, conditionPack: condition },
    candidate: { sampleId: 'a', split: 'validation', rgb: output, resolution: [32, 24], sourceCheckpointSha256: cp.sha256 },
    formalStage4QualificationGranted: false, runtimePublicationGranted: false }
  options.manifest?.(manifest)
  const manifestBinding = bind(manifestPath, manifest)
  const readJson = async binding => {
    calls.push(binding.path)
    const raw = files.get(binding.path)
    if (!raw) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    requireFact(digest(raw) === binding.sha256, 'history_sha_mismatch')
    return JSON.parse(raw)
  }
  return { runId, files, calls, manifest, manifestBinding, terminal, terminalBinding, executionPackage,
    workerTerminal, output, original, cp, run: () => readDryRecoveryCandidate({ runId, manifest, manifestBinding,
      terminalBinding, readJson, requireFact }) }
}

async function persist(t, f, staleIndex = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'console-dry-recovery-'))
  t.after(async () => {
    const resolved = await realpath(root)
    assert.equal(path.dirname(resolved), await realpath(tmpdir()))
    assert.ok(path.basename(resolved).startsWith('console-dry-recovery-'))
    await rm(resolved, { recursive: true, force: true })
  })
  const put = async (logical, value) => {
    const raw = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    f.files.set(logical, raw)
    await mkdir(path.dirname(path.join(root, logical)), { recursive: true })
    await writeFile(path.join(root, logical), raw)
    return { path: logical, sha256: digest(raw) }
  }
  for (const [logical, raw] of f.files) await put(logical, raw)
  const capsule = await put(`${REG}/fixture-capsule.json`, { schemaVersion: 'ai-painter-local-task-capsule-v1',
    taskId: f.runId, integrity: { status: 'verified' }, evidence: [{ ...f.terminalBinding, sha256Verified: true }] })
  const transactionId = 'dry-recovery-fixture-tx'
  const current = { schemaVersion: 'ai-painter-current-execution-registry-v1', registryRevision: 1, eventSequence: 1,
    writerIdentity: 'local_ai_capability_lifecycle_orchestrator', transactionId, taskId: f.runId, runId: f.runId,
    taskCapsule: capsule, terminalEvidence: { ...f.terminalBinding, status: f.terminal.status }, activeExecution: null,
    latestTrainingTerminal: { ...f.terminalBinding, runId: f.runId, status: f.terminal.status },
    supersedes: null, archivedEvidenceNamespaces: [] }
  const staged = await put(`${REG}/transactions/${transactionId}/current.staged.json`, current)
  await put(`${REG}/current.json`, current)
  await put(`${REG}/transactions/${transactionId}/transaction.json`, {
    schemaVersion: 'ai-painter-current-execution-registry-transaction-v1', transactionId,
    registryRevision: 1, eventSequence: 1, status: 'committed', currentSha256: staged.sha256, previousCurrentSha256: null })
  await put(`${REG}/events.jsonl`, Buffer.from(`${JSON.stringify({ registryRevision: 1, eventSequence: 1,
    transactionId, currentSha256: staged.sha256, taskId: f.runId, runId: f.runId, previousCurrentSha256: null })}\n`))
  const db = new DatabaseSync(path.join(root, REG, 'registry.sqlite'))
  db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
  db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(1, 1, transactionId, staged.sha256, f.runId, f.runId)
  db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run(transactionId, 'committed', staged.sha256)
  db.close()
  for (let attempt = 0; attempt < 4; attempt++) {
    await scanHistoryEvidence({ root }) // Private fixture only, never the production index.
    if (readHistoryEvidenceIndex(root, f.runId).sources.length) break
  }
  if (staleIndex) {
    const index = new DatabaseSync(path.join(root, HISTORY_INDEX_PATH))
    index.prepare("UPDATE sources SET status='partial',reason_code='history_source_schema_unsupported' WHERE logical_path=?").run(f.manifestBinding.path)
    index.close()
  }
  return root
}

test('exact v24 materialization uses explicit parents and sample/epoch, not filenames or weights', async () => {
  const f = fixture(), candidate = await f.run()
  assert.deepEqual(candidate.output, f.output); assert.equal(candidate.sampleId, 'a'); assert.equal(candidate.epoch, 4)
  assert.deepEqual(candidate.resolution, { width: 32, height: 24 }); assert.deepEqual(candidate.original, f.original)
  assert.equal(f.calls.length, 4)
  assert.ok(f.calls.every(file => file.endsWith('.json')))
})
for (const [name, options, expected] of [
  ['unknown manifest', { manifest: m => { m.schemaVersion += '-future' } }, 'schema_unsupported'],
  ['wrong source self binding', { manifest: m => { m.inputPath += '-other' } }, 'parent_conflict'],
  ['wrong Run', { manifest: m => { m.runId = 'foreign' } }, 'identity_conflict'],
  ['wrong package identity', { package: p => { p.packageId = 'foreign' } }, 'identity_conflict'],
  ['wrong capability', { worker: w => { w.capabilityVersion = 'foreign' } }, 'identity_conflict'],
  ['wrong checkpoint', { manifest: m => { m.selectedCheckpoint.sha256 = '0'.repeat(64) } }, 'parent_conflict'],
  ['wrong RGB source checkpoint', { manifest: m => { m.candidate.sourceCheckpointSha256 = '0'.repeat(64) } }, 'checkpoint_conflict'],
  ['missing checkpoint', { manifest: m => { delete m.selectedCheckpoint } }, 'binding_missing'],
  ['missing validation membership', { package: p => { delete p.validationSplit } }, 'binding_missing'],
  ['foreign output root', { manifest: m => { m.candidate.rgb.path = '.runtime/ai-painter/foreign/output.png' } }, 'output_root_conflict'],
  ['wrong selected epoch', { manifest: m => { m.selectedEpoch = 3 } }, 'epoch_conflict'],
  ['challenge candidate', { manifest: m => { m.candidate.split = 'challenge' } }, 'sample_conflict'],
  ['wrong subject', { manifest: m => { m.subject.sampleId = 'foreign' } }, 'sample_conflict'],
  ['wrong validation observation', { worker: w => { w.checkpoints[0].validation[0].split = 'train' } }, 'sample_conflict'],
  ['unknown worker schema', { worker: w => { w.schemaVersion += '-future' } }, 'terminal_conflict'],
  ['duplicate checkpoint', { worker: w => { w.checkpoints.push(w.checkpoints[0]) } }, 'checkpoint_conflict'],
  ['oversize checkpoint metadata', { worker: w => { w.checkpoints = Array(33).fill(w.checkpoints[0]) } }, 'checkpoint_limit'],
]) test(`v24 materialization rejects ${name}`, async () => {
  await assert.rejects(fixture(options).run, new RegExp(expected, 'u'))
})

test('missing optional original/condition does not fabricate or hide the bound output', async () => {
  const f = fixture({ manifest: m => { delete m.subject.referenceRgb; delete m.subject.conditionPack } })
  const candidate = await f.run()
  assert.equal(candidate.original, null); assert.equal(candidate.condition, null); assert.deepEqual(candidate.output, f.output)
})

test('index verifies real v24 field shape; partial old row is freshly readable without GET writes', async t => {
  const f = fixture({ manifest: m => {
    m.environment = 'fixture-secret'; m.subject.environment = 'fixture-secret'
    m.subject.referenceRgb.environment = 'fixture-secret'; m.selectedCheckpoint.environment = 'fixture-secret'
  } }), root = await persist(t, f)
  assert.equal(readHistoryEvidenceIndex(root, f.runId).sources[0].status, 'verified')
  const index = new DatabaseSync(path.join(root, HISTORY_INDEX_PATH))
  index.exec("UPDATE sources SET status='partial',reason_code='history_source_schema_unsupported'")
  index.close()
  const snapshotPaths = [...f.files.keys(), `${REG}/registry.sqlite`, HISTORY_INDEX_PATH]
  const before = await Promise.all(snapshotPaths.map(logical => readFile(path.join(root, logical))))
  const detail = await readTrainingRun(f.runId, { root })
  assert.equal(detail.dataStatus, 'partial'); assert.equal(detail.record.samples.length, 1)
  assert.equal(detail.record.detailCoverage.candidateCount, 1)
  assert.equal(detail.record.detailCoverage.availability.candidateImages, 'available')
  assert.equal(detail.record.detailCoverage.availability.resolution, 'available')
  assert.equal(detail.record.detailCoverage.availability.samples, 'available')
  assert.equal(detail.record.detailCoverage.complete, false)
  assert.equal(detail.record.detailCoverage.originals.complete, false)
  assert.deepEqual(detail.record.detailCoverage.originals.notRecordedSampleIds, ['b'])
  assert.ok(detail.unavailableFields.includes('machineReview')); assert.ok(detail.unavailableFields.includes('samples.original'))
  assert.ok(detail.record.detailCoverage.jsonReads <= 16)
  const output = detail.record.artifacts.find(item => item.role === 'output')
  assert.equal(output.formalQualification, false); assert.equal(output.epoch, 4)
  assert.deepEqual((await readTrainingArtifact(f.runId, output.artifactId, { root })).bytes, png)
  const original = detail.record.artifacts.find(item => item.role === 'original')
  assert.deepEqual((await readTrainingArtifact(f.runId, original.artifactId, { root })).bytes, png)
  const manifest = detail.record.artifacts.find(item => item.evidenceKind === 'dry_recovery_candidate_manifest')
  const preview = (await readTrainingArtifact(f.runId, manifest.artifactId, { root })).json
  assert.equal(preview.previewStatus, 'controlled_candidate_fields_only')
  assert.doesNotMatch(preview.text, /fixture-secret|environment/u)
  const first = await readTrainingRunSection(f.runId, { root, section: 'artifacts', limit: 1 })
  assert.equal(first.items[0].artifactId, output.artifactId)
  const second = await readTrainingRunSection(f.runId, { root, section: 'artifacts', limit: 1, cursor: first.nextCursor })
  assert.equal(second.items[0].artifactId, original.artifactId)
  assert.deepEqual(await Promise.all(snapshotPaths.map(logical => readFile(path.join(root, logical)))), before)
  assert.equal(readHistoryEvidenceIndex(root, f.runId).sources[0].status, 'partial')
})

test('missing indexed manifest preserves training metrics/CP and reports a local missing gap', async t => {
  const f = fixture(), root = await persist(t, f, true)
  await rm(path.join(root, f.manifestBinding.path))
  const d = await readTrainingRun(f.runId, { root })
  assert.equal(d.record.metrics.length, 2); assert.equal(d.record.checkpoints.length, 1)
  assert.equal(d.record.samples.length, 0); assert.equal(d.record.detailCoverage.availability.candidateManifest, 'missing')
})

test('missing candidate binding and unsupported schema remain partial sources, not guessed images', async t => {
  for (const options of [{ manifest: m => { delete m.candidate.rgb } }, { manifest: m => { m.schemaVersion += '-future' } }]) {
    const f = fixture(options), root = await persist(t, f)
    assert.equal(readHistoryEvidenceIndex(root, f.runId).sources[0].status, 'partial')
    const d = await readTrainingRun(f.runId, { root })
    assert.equal(d.record.metrics.length, 2); assert.equal(d.record.samples.length, 0)
    assert.equal(d.record.detailCoverage.availability.candidateManifest, 'unsupported_schema')
  }
})

test('index parent tampering stays partial, rather than verifying a syntactically valid SHA', async t => {
  const f = fixture(); f.files.set(f.workerTerminal.path, Buffer.from('{}'))
  const root = await persist(t, f)
  const source = readHistoryEvidenceIndex(root, f.runId).sources[0]
  assert.equal(source.status, 'partial'); assert.equal(source.reasonCode, 'history_sha_mismatch')
})

test('duplicate authenticated candidate manifests fail closed, never choose the latest', async t => {
  const f = fixture()
  const logical = f.manifestBinding.path.replace('.json', '-duplicate.json')
  f.files.set(logical, Buffer.from(JSON.stringify({ ...f.manifest, inputPath: logical })))
  const root = await persist(t, f)
  assert.equal(readHistoryEvidenceIndex(root, f.runId).sources.length, 2)
  await assert.rejects(readTrainingRun(f.runId, { root }), /history_independent_materialization_conflict/u)
})

test('source limit is an explicit gap, not a truncated claim of complete pictures', async t => {
  const f = fixture()
  for (let i = 0; i < 8; i++) {
    const logical = f.manifestBinding.path.replace('.json', `-extra-${i}.json`)
    f.files.set(logical, Buffer.from(JSON.stringify({ ...f.manifest, inputPath: logical })))
  }
  const root = await persist(t, f)
  assert.equal(readHistoryEvidenceIndex(root, f.runId).sources.length, 9)
  const d = await readTrainingRun(f.runId, { root })
  assert.equal(d.record.detailCoverage.availability.candidateManifest, 'over_limit')
  assert.equal(d.record.detailCoverage.candidateCount, 0)
  assert.ok(d.record.detailCoverage.jsonReads <= 16)
  assert.equal(d.record.metrics.length, 2)
})

test('source tamper is rejected even when index row claims verified', async t => {
  const f = fixture(), root = await persist(t, f)
  await writeFile(path.join(root, f.manifestBinding.path), '{}')
  await assert.rejects(readTrainingRun(f.runId, { root }), /history_sha_mismatch/u)
})

test('output tamper and invalid PNG signature are rejected on artifact delivery', async t => {
  for (const fakeImage of [false, true]) {
    const f = fixture({ fakeImage }), root = await persist(t, f)
    const d = await readTrainingRun(f.runId, { root }), output = d.record.artifacts.find(item => item.role === 'output')
    if (!fakeImage) await writeFile(path.join(root, f.output.path), 'tampered')
    await assert.rejects(readTrainingArtifact(f.runId, output.artifactId, { root }), fakeImage ? /image_signature_invalid/u : /sha_mismatch/u)
  }
})

test('real v24 recovery binding/detail/artifact readback preserves immutable evidence', {
  skip: process.env.AI_CONSOLE_VERIFY_DRY_RECOVERY_RUN !== '1', timeout: 110000,
}, async () => {
  const root = process.cwd(), runId = 'mvp256-dry-v24-9056e7f9a7eb9ba8bf8fbf569d05c0be30c12c723ffca0e2'
  const logical = `.runtime/ai-painter/stage4-mvp256-dry-v24-recovery-v2-executions/${runId}/dry-review/candidate-manifest.json`
  const source = readHistoryEvidenceIndex(root, runId).sources.find(row => row.logicalPath === logical)
  assert.ok(source)
  const manifest = JSON.parse((await bytes(root, logical, 2097152, source.sha256)).value.toString('utf8'))
  const paths = [logical, manifest.trainingTerminal.path, manifest.workerTerminal.path, manifest.executionPackage.path, `${REG}/current.json`]
  const before = await Promise.all(paths.map(file => readFile(path.join(root, file))))
  const d = await readTrainingRun(runId, { root }), r = d.record
  assert.equal(r.samples.length, 1); assert.equal(r.metrics.length, 24); assert.equal(r.checkpoints.length, 3)
  assert.equal(r.detailCoverage.candidateCount, 1); assert.equal(r.detailCoverage.complete, false)
  assert.equal(r.detailCoverage.originals.notRecordedSampleIds.length, 7)
  assert.ok(d.unavailableFields.includes('machineReview'))
  const output = r.artifacts.find(item => item.role === 'output')
  assert.equal(output.epoch, 36); assert.equal(output.split, 'validation'); assert.equal(output.formalQualification, false)
  const image = await readTrainingArtifact(runId, output.artifactId, { root })
  assert.equal(image.contentType, 'image/png'); assert.equal(image.bytes.length, 99959)
  assert.equal(digest(image.bytes), '78256724a3eacbdbc55f46f5a6dd202d9a0695657833b3e996894815f741ac3b')
  const original = r.artifacts.find(item => item.role === 'original')
  assert.equal((await readTrainingArtifact(runId, original.artifactId, { root })).contentType, 'image/png')
  assert.deepEqual(await Promise.all(paths.map(file => readFile(path.join(root, file)))), before)
  console.log(JSON.stringify({ runId, outputArtifactId: output.artifactId, byteLength: image.bytes.length,
    imageSha256: digest(image.bytes), productionIndexRebuilt: false, detailStatus: d.dataStatus }))
})
