import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { listTrainingHistory, readTrainingRun, readTrainingRunSection } from '../../src/server/ai-console/training-history-store.mjs'
import { loadCurrentExecutionProjectionForCpu } from './helpers/current-execution-projection-cpu.mjs'
import { readReadonlyPostReviewEvidence, adaptReadonlyPostReviewHistory,
  publicReadonlyReviewArtifact, isReadonlyPostReviewTerminal } from '../../src/server/ai-console/readonly-post-review-history.mjs'

const flags = { formalQualificationGranted: false, checkpointPromotable: false,
  runtimePublicationAllowed: false, automaticNextTraining: false }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function fixture(change = () => {}) {
  const state = { root: '.runtime/ai-painter/review-fixture', source: '.runtime/ai-painter/training-fixture',
    alteredWeights: false, wrongSplit: false, falseProjection: false, foreignCheckpoint: false,
    falseQualification: false, outputEscape: false }
  change(state)
  const docs = new Map(), calls = []
  const put = (p, value) => {
    const bytes = Buffer.from(JSON.stringify(value))
    const binding = { path: p, sha256: hash(bytes) }; docs.set(p, { value, bytes, binding }); return binding
  }
  const leaf = name => ({ path: state.root + '/' + name, sha256: hash(Buffer.from(name)) })
  const sourcePackage = put(state.source + '/package.json', { schemaVersion: 'old-training', runId: 'training-fixture' })
  const cp = { path: state.source + '/checkpoint.pt', sha256: hash(Buffer.from('weights')) }
  const sourceResult = put(state.source + '/result.json', { experimentIdentity: 'training-fixture', artifacts: [cp] })
  const sourceTerminal = put(state.source + '/terminal.json', { runId: 'training-fixture', executionState: 'completed',
    executionPackage: sourcePackage, result: sourceResult })
  const ids = Array.from({ length: 10 }, (_, i) => 'sample-' + i)
  const pkg = { schemaVersion: 'ai-painter-two-map-post-review-package-v1', reviewId: 'review-fixture',
    outputRoot: state.root, sourceTerminal, sourcePackage, sourceCheckpoint: state.foreignCheckpoint
      ? { ...cp, sha256: hash(Buffer.from('foreign weights')) } : cp,
    trainSampleIds: ids.slice(0, 2), validationSampleIds: ids.slice(2), ...flags }
  const executionPackage = put(state.root + '/package.json', pkg)
  const observations = ids.map((sampleId, i) => ({ sampleId, split: i < 2 ? 'train' : 'validation',
    prediction: state.outputEscape && !i ? { ...leaf('prediction-0.png'), path: '.runtime/other/prediction.png' } : leaf('prediction-' + i + '.png'),
    identity: { image: { path: 'data/samples/' + sampleId + '.png', sha256: hash(Buffer.from(sampleId)) },
      conditionPack: leaf('condition-' + i + '.json') }, metrics: { fullRgbMae: 0.1 + i / 100 } }))
  const inference = { schemaVersion: 'ai-painter-two-map-post-review-inference-v1', reviewId: 'review-fixture',
    executionPackage, sourceCheckpoint: pkg.sourceCheckpoint, observations,
    actualCalls: { generatorForwards: 10, criticForwards: 0, optimizerAttempts: 0, autogradAttempts: 0, cudaAttempts: 0 },
    stateBefore: ['original'], stateAfter: [state.alteredWeights ? 'changed' : 'original'],
    optimizerUpdates: 0, gpuInitialized: false, startedAtUtc: '2026-01-01T00:00:02.000Z',
    endedAtUtc: '2026-01-01T00:00:04.000Z', elapsedSeconds: 1.95 }
  const inferenceBinding = put(state.root + '/inference.json', inference)
  const audits = observations.map((o, i) => {
    const split = state.wrongSplit && i === 3 ? 'train' : o.split
    const issueCodes = i === 3 ? ['condition_mismatch'] : []
    const audit = { sampleId: o.sampleId, split, prediction: o.prediction, reference: o.identity.image,
      condition: o.identity.conditionPack, projection: leaf('projection-' + i + '.png'),
      projectionIsModelOutput: state.falseProjection, detail: { passed: true, issueCodes: [] },
      aesthetic: { passed: true, issues: [] }, alignment: { passed: i !== 3, issues: issueCodes.map(code => ({ code })) }, ...flags }
    return { sampleId: o.sampleId, split, passed: i !== 3, issueCodes,
      evidence: put(state.root + '/audit-' + i + '.json', audit) }
  })
  const report = { schemaVersion: 'ai-painter-two-map-post-review-result-v1', reviewId: 'review-fixture', sourceRunId: 'training-fixture',
    executionPackage, sourceTerminal, sourceCheckpoint: pkg.sourceCheckpoint, inference: inferenceBinding,
    audits, visualOutcome: 'failed', issueCodes: ['condition_mismatch'], ...flags }
  const terminal = { schemaVersion: 'ai-painter-two-map-post-review-terminal-v1', runId: 'review-fixture',
    packageId: 'review-fixture', sourceRunId: 'training-fixture', sourceTerminal, executionPackage,
    executionState: 'completed', status: 'post_training_visual_review_failed', visualOutcome: 'failed',
    report: put(state.root + '/review.json', report), optimizerUpdates: 0, gpuInitialized: false,
    startedAtUtc: '2026-01-01T00:00:01.000Z', recordedAtUtc: '2026-01-01T00:00:05.000Z', elapsedSeconds: 3.99,
    ...flags, formalQualificationGranted: state.falseQualification }
  const terminalBinding = put(state.root + '/terminal.json', terminal)
  return { terminal, runId: terminal.runId, terminalBinding, docs, calls,
    readEvidenceJson: async (binding, maximum) => {
      const row = docs.get(binding.path); assert.ok(row, 'missing bound fixture')
      assert.equal(hash(row.bytes), binding.sha256, 'fixture actual-byte SHA mismatch')
      assert.ok(row.bytes.length <= maximum, 'fixture byte limit')
      calls.push(binding.path)
      return { value: JSON.parse(row.bytes), byteLength: row.bytes.length, sha256: hash(row.bytes) }
    } }
}

test('old ten-image execution success and absolute visual failure remain separate, with authentic scoped clocks', async () => {
  const f = fixture(), r = await readReadonlyPostReviewEvidence(f)
  assert.equal(r.executionResult, 'succeeded'); assert.equal(r.absoluteOutcome, 'failed')
  assert.equal(r.relativeOutcome, null); assert.equal(r.rows.length, 10)
  assert.equal(r.rows.filter(x => x.passed).length, 9)
  assert.equal(r.reviewTiming.endedAtUtc, null) // recordedAt is not an end clock.
  assert.equal(r.reviewTiming.elapsedSeconds, 3.99); assert.equal(r.inferenceTiming.elapsedSeconds, 1.95)
  assert.equal(new Set(f.calls).size, f.calls.length)
  assert.ok(f.calls.every(p => !p.endsWith('.pt') && !p.endsWith('.png')))
})
for (const key of ['alteredWeights', 'wrongSplit', 'falseProjection', 'foreignCheckpoint', 'falseQualification', 'outputEscape']) {
  test('reject self-consistent SHA chain with invalid semantics: ' + key, async () => {
    await assert.rejects(readReadonlyPostReviewEvidence(fixture(s => { s[key] = true })))
  })
}
test('byte tampering is rejected and no cached parsed JSON substitutes for source validation', async () => {
  const f = fixture(), b = f.terminal.report
  f.docs.get(b.path).bytes = Buffer.from('{}')
  await assert.rejects(readReadonlyPostReviewEvidence(f), /SHA mismatch/u)
})
test('missing audit and over-limit metadata cannot silently become empty successful reviews', async () => {
  const f = fixture(); f.docs.delete(f.terminal.report.path)
  await assert.rejects(readReadonlyPostReviewEvidence(f))
  const g = fixture(), read = g.readEvidenceJson
  g.readEvidenceJson = async (...args) => ({ ...await read(...args), byteLength: 1024 * 1024 + 1 })
  await assert.rejects(readReadonlyPostReviewEvidence(g), /aggregate_limit/u)
})
test('unknown terminal is unsupported without reads', async () => {
  assert.equal(isReadonlyPostReviewTerminal({ schemaVersion: 'future', status: 'post_training_visual_review_failed' }), false)
  assert.equal(await readReadonlyPostReviewEvidence({ terminal: { schemaVersion: 'future' } }), null)
})
test('history contains native prediction and distinct auditor projection, retaining no-qualification flags', async () => {
  const f = fixture(), record = { terminalBinding: f.terminalBinding, artifacts: [], samples: [], metrics: [], checkpoints: [] }
  const detail = await adaptReadonlyPostReviewHistory({ ...f, record, base: { unavailableFields: [] },
    makeArtifact: (role, b, meta) => ({ role, logicalPath: b.path, sha256: b.sha256, ...meta }), checkpointMetadata: async x => x })
  assert.equal(detail.dataStatus, 'connected'); assert.equal(record.samples.length, 10)
  assert.equal(record.artifacts.filter(a => a.isModelOutput === true).length, 10)
  assert.equal(record.artifacts.filter(a => a.isModelOutput === false).length, 10)
  assert.equal(record.reviewSummary.formalQualificationGranted, false)
  assert.equal(record.workerExecutionTiming, undefined)
})
test('public artifact preview cannot leak raw commands, paths, error text or arbitrary JSON', () => {
  const r = publicReadonlyReviewArtifact({ schemaVersion: 'test', runId: 'run', error: 'sensitive raw error',
    environment: { TOKEN: 'secret' }, commandLine: 'raw command', arbitrary: { nested: 'secret' } })
  assert.equal(r.runId, 'run'); assert.doesNotMatch(JSON.stringify(r), /secret|sensitive|raw command/u)
})

test('failed review execution keeps counts and absent clocks unknown, preserving its bound source checkpoint', async () => {
  const f = fixture()
  Object.assign(f.terminal, { executionState: 'failed_closed', status: 'post_training_review_execution_failed',
    visualOutcome: 'unknown' }); delete f.terminal.report; delete f.terminal.elapsedSeconds; delete f.terminal.startedAtUtc
  const record = { terminalBinding: f.terminalBinding, artifacts: [], samples: [], metrics: [], checkpoints: [] }
  const r = await adaptReadonlyPostReviewHistory({ ...f, record, base: { unavailableFields: [] },
    makeArtifact: (role, b, meta) => ({ role, logicalPath: b.path, sha256: b.sha256, ...meta }), checkpointMetadata: async x => x })
  assert.equal(r.dataStatus, 'partial'); assert.equal(record.reviewSummary.absoluteOutcome, 'unknown')
  assert.equal(record.reviewSummary.completedReviewCount, null); assert.equal(record.reviewSummary.failedCount, null)
  assert.equal(record.reviewTiming.startedAtUtc, null); assert.equal(record.reviewTiming.endedAtUtc, null)
  assert.equal(record.reviewTiming.elapsedSeconds, null)
  assert.equal(record.checkpoints.length, 1)
})

async function replayFixture(t, options = {}) {
  const policy = JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-replay-retention-review-policy-v1.json'))
  if (!fs.existsSync(policy.parentExperiment.package.path)) { t.skip('named frozen parent JSON metadata unavailable'); return null }
  const { createReplayRetentionFixture } = await import('./local-backup-replay-retention-recording.test.mjs')
  const f = createReplayRetentionFixture({ onDisk: true, ...options }), calls = []
  return { ...f, runId: f.reviewId, terminalBinding: f.terminalRef, calls,
    readEvidenceJson: async (b, maximum) => {
      const row = f.read(b.path, b.sha256)
      assert.ok(Buffer.isBuffer(row.bytes), 'actual authenticated fixture bytes required')
      assert.equal(hash(row.bytes), b.sha256); assert.ok(row.bytes.length <= maximum)
      calls.push(b.path)
      return { value: JSON.parse(row.bytes), byteLength: row.bytes.length, sha256: hash(row.bytes) }
    } }
}
test('56 sharded rows use real SHA metadata, bounded JSON and separate native/parent/A/auditor identities; no actual model run', async t => {
  const f = await replayFixture(t); if (!f) return
  const record = { terminalBinding: f.terminalRef, artifacts: [], samples: [], metrics: [], checkpoints: [] }
  const r = await adaptReadonlyPostReviewHistory({ ...f, record, base: { unavailableFields: [] },
    makeArtifact: (role, b, meta) => ({ role, logicalPath: b.path, sha256: b.sha256, ...meta }), checkpointMetadata: async x => x })
  assert.equal(r.dataStatus, 'connected'); assert.equal(record.samples.length, 56); assert.equal(record.metrics.length, 56)
  assert.equal(record.reviewSummary.absoluteOutcome, 'failed'); assert.equal(record.reviewSummary.executionResult, 'succeeded')
  assert.equal(record.reviewSummary.relativeOutcome, 'eligible_for_further_diagnostic_comparison_not_qualified')
  assert.equal(record.reviewSummary.formalQualificationGranted, false)
  assert.equal(record.artifacts.filter(a => a.isModelOutput === true).length, 112)
  assert.equal(record.artifacts.filter(a => a.associations?.some(x => x.arm === 'A')).length, 56)
  assert.equal(record.artifacts.filter(a => a.isModelOutput === false).length, 112)
  const aAssociations = record.artifacts.flatMap(a => a.associations ?? [a]).filter(a => a.arm === 'A')
  assert.equal(aAssociations.length, 56); assert(aAssociations.every(a => a.sourceRunId === null && a.sourceTerminal))
  assert(record.detailCoverage.byteLength <= 8 * 1024 * 1024)
  assert.equal(new Set(f.calls).size, f.calls.length)
  assert(!f.calls.includes(f.policy.parentEvaluation.path)); assert(!f.calls.includes(f.policy.single149Evaluation.path))
  assert.equal(record.reviewTiming.endedAtUtc, null)
  assert.equal(record.reviewSummary.historicalMetricsAuthority, 'frozen_evaluations_revalidated_by_worker_not_ledger')
  assert.equal(record.metrics[0].relativeComparison.checks.length, 17)
  t.diagnostic(JSON.stringify({ scope: 'CPU_metadata_fixture_no_model_or_image_bytes', jsonBytes: record.detailCoverage.byteLength,
    jsonFiles: record.detailCoverage.documentCount, artifacts: record.artifacts.length, rows: record.samples.length }))
})
test('new 56 review rejects missing shard before publishing any successful projection', async t => {
  const f = await replayFixture(t); if (!f) return
  f.entries.delete(f.rowBindings[31].binding.path)
  await assert.rejects(readReadonlyPostReviewEvidence(f))
})
test('new short arm has its own exposure policy and keeps training counters separate from 56 review forwards', async t => {
  const f = await replayFixture(t, { arm: 'short', large: false }); if (!f) return
  const r = await readReadonlyPostReviewEvidence(f)
  assert.equal(r.arm, 'short'); assert.equal(r.rows.length, 56); assert.equal(r.inference.actualCalls.generatorForwards, 56)
  assert.equal(r.inference.actualCalls.optimizerAttempts, 0)
  assert.equal(r.sourceRunId, f.terminal.sourceRunId)
})

test('balanced48 exact policy and four passes plus first8 fit the existing package exception without granting qualification', async t => {
  const f = await replayFixture(t, { arm: 'balanced' }); if (!f) return
  const source = f.entries.get(f.sourcePackage.path), value = source.value
  assert(source.byteLength > 1024 * 1024 && source.byteLength <= 4 * 1024 * 1024)
  assert.equal(value.policy.sha256, '4394bf6250cdd73f9271a414ead91a2ad8427c8586cfeabfdb408ee949ab68db')
  assert.equal(value.selectedSampleIds.length, 48); assert.equal(value.training.pairs, 200)
  assert.deepEqual(value.schedule, [...value.selectedSampleIds, ...value.selectedSampleIds,
    ...value.selectedSampleIds, ...value.selectedSampleIds, ...value.selectedSampleIds.slice(0, 8)])
  assert.equal(value.plannedSampleVisits['ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3'], 5)
  assert.equal(value.plannedSampleVisits['mvp64-slot164-objects-v5-20261020'], 4)
  const r = await readReadonlyPostReviewEvidence(f)
  assert.equal(r.arm, 'balanced'); assert.equal(r.rows.length, 56)
  assert.equal(r.executionResult, 'succeeded'); assert.equal(r.absoluteOutcome, 'failed')
  assert.equal(r.pkg.checkpointPromotable, false); assert.equal(r.pkg.runtimePublicationAllowed, false)
  assert(r.readCoverage.byteLength <= 8 * 1024 * 1024)
  assert(f.calls.every(p => !p.endsWith('.pt') && !p.endsWith('.png')))
})
for (const [label, fitMutation] of [
  ['substituted policy SHA', v => { v.policy = { ...v.policy, sha256: '0'.repeat(64) } }],
  ['changed frozen schedule', v => { v.schedule.reverse() }],
  ['wrong target exposure', v => { v.training = { ...v.training, targetPairs: 100, replayPairs: 100 } }],
  ['wrong recorded sample visits', v => { v.plannedSampleVisits['mvp64-slot164-objects-v5-20261020'] = 5 }],
  ['borrowed formal qualification', v => { v.qualificationGranted = true }],
  ['unknown package arm', v => { v.arm = 'unregistered' }],
]) test('balanced large-package exception rejects ' + label + ' despite valid new JSON hashes', async t => {
  const f = await replayFixture(t, { arm: 'balanced', fitMutation }); if (!f) return
  await assert.rejects(readReadonlyPostReviewEvidence(f))
})
test('short arm cannot inherit the balanced large-package exception', async t => {
  const f = await replayFixture(t, { arm: 'short', large: true }); if (!f) return
  await assert.rejects(readReadonlyPostReviewEvidence(f), /large_package_conflict/u)
})
test('balanced registered execution failure retains unknown verdict and counters without inventing a review', async t => {
  const f = await replayFixture(t, { arm: 'balanced', failure: true }); if (!f) return
  const record = { terminalBinding: f.terminalRef, artifacts: [], samples: [], metrics: [], checkpoints: [] }
  const r = await adaptReadonlyPostReviewHistory({ ...f, record, base: { unavailableFields: [] },
    makeArtifact: (role, b, meta) => ({ role, logicalPath: b.path, sha256: b.sha256, ...meta }), checkpointMetadata: async x => x })
  assert.equal(r.dataStatus, 'partial'); assert.equal(record.reviewSummary.absoluteOutcome, 'unknown')
  assert.equal(record.reviewSummary.relativeOutcome, 'unknown'); assert.equal(record.reviewSummary.completedReviewCount, null)
  assert.equal(record.reviewSummary.failedCount, null); assert.equal(record.reviewTiming.endedAtUtc, null)
  assert.equal(record.reviewSummary.formalQualificationGranted, false)
})

for (const arm of ['mixed', 'balanced']) test(arm + ' 56-image metadata fixture passes the real history store and every artifact page without changing the registry', async t => {
  const f = await replayFixture(t, { arm }); if (!f) return
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'console-review-fixture-'))
  t.after(() => { const absolute = fs.realpathSync(root)
    assert.equal(path.dirname(absolute), fs.realpathSync(os.tmpdir()))
    assert(path.basename(absolute).startsWith('console-review-fixture-')); fs.rmSync(absolute, { recursive: true }) })
  f.materialize(root)
  const put = (logical, value) => {
    const target = path.join(root, logical), bytes = Buffer.from(JSON.stringify(value))
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes)
    return { path: logical, sha256: hash(bytes) }
  }
  const reg = '.runtime/ai-painter/current-execution-registry', transactionId = 'readonly-review-fixture-tx'
  const capsule = put(f.outputRoot + '/capsule.json', { schemaVersion: 'ai-painter-local-task-capsule-v1',
    taskId: f.reviewId, integrity: { status: 'verified' }, evidence: [{ ...f.terminalRef, sha256Verified: true }] })
  const current = { schemaVersion: 'ai-painter-current-execution-registry-v1', registryRevision: 1, eventSequence: 1,
    writerIdentity: 'local_ai_capability_lifecycle_orchestrator', transactionId, taskId: f.reviewId, runId: f.reviewId,
    taskKind: 'readonly_post_training_visual_review', lifecycleStage: 'isolated_implementation', executionState: 'completed',
    taskCapsule: capsule, terminalEvidence: { ...f.terminalRef, status: f.terminal.status },
    activeExecution: null, latestTrainingTerminal: null, supersedes: null, archivedEvidenceNamespaces: [] }
  const staged = put(reg + '/transactions/' + transactionId + '/current.staged.json', current)
  put(reg + '/current.json', current)
  put(reg + '/transactions/' + transactionId + '/transaction.json', { schemaVersion: 'ai-painter-current-execution-registry-transaction-v1',
    transactionId, registryRevision: 1, eventSequence: 1, status: 'committed', currentSha256: staged.sha256, previousCurrentSha256: null })
  fs.writeFileSync(path.join(root, reg, 'events.jsonl'), JSON.stringify({ registryRevision: 1, eventSequence: 1, transactionId,
    currentSha256: staged.sha256, previousCurrentSha256: null, taskId: f.reviewId, runId: f.reviewId }) + '\n')
  const db = new DatabaseSync(path.join(root, reg, 'registry.sqlite'))
  db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
  db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(1, 1, transactionId, staged.sha256, f.reviewId, f.reviewId)
  db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run(transactionId, 'committed', staged.sha256); db.close()
  const cp = f.entries.get(f.pkg.path).value.sourceCheckpoint
  fs.writeFileSync(path.join(root, cp.path), 'private checkpoint metadata fixture, never deserialized or verified as weight bytes')
  const before = fs.readFileSync(path.join(root, reg, 'current.json'))
  const listing = await listTrainingHistory({ root, limit: 5 })
  assert.equal(listing.records[0].runId, f.reviewId)
  const detail = await readTrainingRun(f.reviewId, { root })
  assert.equal(detail.record.samples.length, 56)
  const ids = new Set(); let cursor = null
  do {
    const page = await readTrainingRunSection(f.reviewId, { root, section: 'artifacts', limit: 50, cursor })
    assert.equal(page.dataStatus, 'connected')
    for (const a of page.items) { assert(!ids.has(a.artifactId)); ids.add(a.artifactId) }
    cursor = page.nextCursor
  } while (cursor)
  assert.equal(ids.size, detail.record.artifacts.length)
  assert.equal((await readTrainingRunSection(f.reviewId, { root, section: 'metrics', limit: 50 })).nextCursor !== null, true)
  const projection = loadCurrentExecutionProjectionForCpu(process.cwd())
  const snapshot = await projection.readAiPainterCurrentExecutionSnapshot(root)
  assert.equal(snapshot.ok, true, JSON.stringify(snapshot))
  assert.equal(snapshot.activeExecution, null); assert.equal(snapshot.latestTrainingTerminal, null)
  assert.equal(snapshot.machineReview.completedReviewCount, 56); assert.equal(snapshot.machineReview.previewFailCount, 56)
  assert.equal(snapshot.machineReview.absoluteOutcome, 'failed')
  assert.equal(snapshot.machineReview.relativeOutcome, 'eligible_for_further_diagnostic_comparison_not_qualified')
  assert(snapshot.machineReview.reviews.every(r => r.epoch === null))
  assert.deepEqual(fs.readFileSync(path.join(root, reg, 'current.json')), before)
  t.diagnostic(JSON.stringify({ scope: 'private_CPU_metadata_only', runId: f.reviewId, artifacts: ids.size, modelForwards: 0 }))
})
