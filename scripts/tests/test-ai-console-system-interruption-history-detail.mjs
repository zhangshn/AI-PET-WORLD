import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'
import { requireFact, bytes } from '../../src/server/ai-console/training-history-safe-bytes.mjs'
import { readTrainingRun, readTrainingRunSection, readTrainingArtifact } from '../../src/server/ai-console/training-history-store.mjs'

const REG = '.runtime/ai-painter/current-execution-registry'
const digest = value => createHash('sha256').update(value).digest('hex')
function fixture(decode1 = true) {
  const documents = new Map(), calls = [], failures = new Map()
  const identity = { runId: 'interrupted-fixture-run', packageId: 'interrupted-fixture-package', capabilityVersion: 'fixture-capability' }
  const outputRoot = '.runtime/ai-painter/interrupted-fixture', recoveryRoot = '.runtime/ai-painter/interruption-registration-fixture'
  const bind = (logical, value) => {
    const raw = Buffer.from(JSON.stringify(value)); documents.set(logical, raw)
    return { path: logical, sha256: digest(raw) }
  }
  const plan = { schema: decode1 ? 'ecology-decode1-weight-quality-plan-v1' : 'ecology-regime-quality-plan-v1',
    executionMode: 'bounded-quality-training', ...identity, outputRoot, configuration: {
      schema: decode1 ? 'ecology-decode1-weight-quality-configuration-v1' : 'ecology-regime-quality-configuration-v1',
      capabilityVersion: identity.capabilityVersion, scope: { resolution: [256, 192] },
      executionCeiling: { epochs: 12, generatorOptimizerSteps: 576, discriminatorOptimizerSteps: 576 },
      checkpointSelection: { eligibleEpochs: [12], validationRowsPerEligibleEpoch: 8 } } }
  const pkg = { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: identity.packageId,
    capabilityVersion: identity.capabilityVersion, outputRoot, inputEvidence: [] }
  const originalCapsule = { schemaVersion: 'ai-painter-local-task-capsule-v1', taskId: identity.runId,
    integrity: { status: 'verified' }, evidence: [] }
  const snapshot = { schemaVersion: 'ai-painter-current-execution-registry-v1', writerIdentity: 'local_ai_capability_lifecycle_orchestrator',
    ...identity, taskId: identity.runId, taskKind: 'ecology_quality_training', registryRevision: 1, eventSequence: 1,
    transactionId: 'interrupted-fixture-tx-1', activeExecution: null, latestTrainingTerminal: null, supersedes: null,
    archivedEvidenceNamespaces: [] }
  const progress = { schemaVersion: 'ai-painter-current-training-progress-v1', ...identity,
    actualEpoch: 6, completedEpochs: 5, optimizerStepsGenerator: 286, optimizerStepsDiscriminator: 285,
    executionState: 'executing', selectedCheckpoint: null, status: 'bounded_training_progress_not_formal_qualified',
    updatedAtUtc: '2026-10-13T09:59:55.530733Z' }
  const terminal = { schemaVersion: 'ai-painter-training-system-interruption-terminal-v1', ...identity,
    executionState: 'failed_closed', status: 'training_system_interrupted', recordedAtUtc: '2026-10-13T13:48:50.835Z',
    profileSha256: '1'.repeat(64), lastDurableProgress: progress, selectedCheckpoint: null,
    historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false }
  const report = { schemaVersion: 'ai-painter-training-system-interruption-report-v1', ...identity,
    recordedAtUtc: '2026-10-13T13:48:50.827Z', profileSha256: terminal.profileSha256,
    lastDurableProgress: structuredClone(progress), historicalCleanupCertified: false, oldExecutionMayReplay: false,
    trainingQualificationGranted: false, modelRootCauseEstablished: false,
    host: { Processes: [{ CommandLine: 'worker --password=fixture-secret', environment: { SECRET_TOKEN: 'fixture-secret' } }] } }
  const events = [], bindings = {}
  const seal = () => {
    bindings.plan = bind(`${outputRoot}/quality-plan.json`, plan)
    pkg.inputEvidence = [bindings.plan, { path: `${outputRoot}/model-identity.json`, sha256: '2'.repeat(64) }]
    bindings.pkg = bind('.runtime/ai-painter/autonomous-closed-loop-packages/interrupted-fixture/package.json', pkg)
    originalCapsule.evidence = [{ ...bindings.pkg, kind: 'execution_package', sha256Verified: true }]
    bindings.capsule = bind(`${outputRoot}/capsule.json`, originalCapsule); snapshot.taskCapsule = bindings.capsule
    snapshot.terminalEvidence = { ...bind(`${outputRoot}/dispatch.json`, { ...identity, status: 'qualification_pending', executionState: 'completed' }), status: 'qualification_pending' }
    bindings.snapshot = bind(`${REG}/transactions/${snapshot.transactionId}/current.staged.json`, snapshot)
    terminal.originalRegistry = { path: `${REG}/current.json`, sha256: bindings.snapshot.sha256, revision: 1 }
    report.originalRegistry = structuredClone(terminal.originalRegistry)
    bindings.report = bind(`${recoveryRoot}/report.json`, report); terminal.recoveryReport = bindings.report
    bindings.terminal = bind(`${recoveryRoot}/terminal.json`, terminal)
    const recoveryCapsule = bind(`${recoveryRoot}/capsule.json`, { schemaVersion: 'ai-painter-local-task-capsule-v1',
      integrity: { status: 'verified' }, evidence: [bindings.terminal, bindings.report].map(b => ({ ...b, sha256Verified: true })) })
    const latest = { ...bindings.terminal, runId: identity.runId, status: terminal.status }
    const current = { ...snapshot, taskId: 'interruption-recovery', registryRevision: 2, eventSequence: 2,
      transactionId: 'interrupted-fixture-tx-2', taskCapsule: recoveryCapsule, terminalEvidence: latest,
      latestTrainingTerminal: latest, supersedes: { registryRevision: 1, eventSequence: 1, transactionId: snapshot.transactionId,
        currentSha256: bindings.snapshot.sha256, taskId: snapshot.taskId, runId: identity.runId } }
    bindings.current = bind(`${REG}/current.json`, current)
    bind(`${REG}/transactions/${current.transactionId}/current.staged.json`, current)
    events.length = 0
    for (const [value, binding] of [[snapshot, bindings.snapshot], [current, bindings.current]]) {
      const txPath = `${REG}/transactions/${value.transactionId}/transaction.json`
      bind(txPath, { schemaVersion: 'ai-painter-current-execution-registry-transaction-v1',
        transactionId: value.transactionId, registryRevision: value.registryRevision, eventSequence: value.eventSequence,
        status: 'committed', currentSha256: binding.sha256, previousCurrentSha256: value.supersedes?.currentSha256 ?? null })
      events.push({ registryRevision: value.registryRevision, eventSequence: value.eventSequence, transactionId: value.transactionId,
        currentSha256: binding.sha256, taskId: value.taskId, runId: value.runId, action: 'fixture-registration',
        recordedAtUtc: '2026-10-13T13:48:53.000Z', previousCurrentSha256: value.supersedes?.currentSha256 ?? null,
        evidenceReferences: [txPath, `${REG}/transactions/${value.transactionId}/current.staged.json`] })
    }
    documents.set(`${REG}/events.jsonl`, Buffer.from(events.map(e => JSON.stringify(e)).join('\n') + '\n'))
  }
  seal()
  const readJson = async bound => {
    calls.push(bound.path)
    if (failures.has(bound.path)) throw failures.get(bound.path)
    const raw = documents.get(bound.path)
    if (!raw) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    requireFact(digest(raw) === bound.sha256, 'history_sha_mismatch')
    return JSON.parse(raw)
  }
  const run = () => adaptLegacyTrainingDetail({ runId: identity.runId, terminal: structuredClone(terminal),
    record: { runId: identity.runId, terminalStatus: terminal.status, terminalBinding: bindings.terminal,
      events: structuredClone(events), eventCoverage: { complete: true, scope: 'verified_registry_events_only', gap: null },
      artifacts: [], samples: [], checkpoints: [], metrics: [], qualification: {} },
    base: { sourceRevision: 2, unavailableFields: ['startedAtUtc', 'finishedAtUtc', 'metrics', 'resolution'] },
    readJson, readEvidenceJson: async (bound, maximum) => {
      requireFact((documents.get(bound.path)?.length ?? 0) <= maximum, 'history_byte_limit', 413)
      return { value: await readJson(bound) }
    }, requireFact, makeArtifact: (role, b, metadata) => ({ role, logicalPath: b.path, sha256: b.sha256,
      artifactId: digest(JSON.stringify([identity.runId, role, b.path, b.sha256])), ...metadata }),
    checkpointMetadata: () => assert.fail('interruption must never read weights') })
  return { run, seal, documents, calls, failures, terminal, report, snapshot, originalCapsule, plan, pkg, events, bindings, identity }
}

test('interruption reads last persisted progress and original plan without claiming final weights or images', async () => {
  const f = fixture(), result = await f.run(), record = result.record
  assert.equal(result.schemaVersion, 'ai_console_training_run_detail_v1')
  assert.equal(result.reasonCode, 'history_system_interruption_detail_partial')
  assert.equal(record.detailCoverage.adapter, 'training_system_interruption_v1')
  assert.equal(record.trainingExecutionState, 'failed_closed')
  assert.equal(record.completedEpochs, 5)
  assert.deepEqual(record.optimizerSteps, { generator: 286, discriminator: 285 })
  assert.equal(record.metrics[0].epoch, 6)
  assert.equal(record.metrics[0].measurements.updatedAtUtc, '2026-10-13T09:59:55.530733Z')
  assert.equal(record.metrics[0].sourcePath, f.bindings.terminal.path)
  assert.equal(record.targetEpochs, 12); assert.equal(record.targetOptimizerSteps, 576)
  assert.deepEqual(record.resolution, { width: 256, height: 192 })
  assert.equal(record.detailCoverage.jsonReads, 5)
  assert.equal(record.detailCoverage.availability.checkpoints, 'not_recorded')
  assert.equal(record.samples.length, 0); assert.equal(record.checkpoints.length, 0)
  assert.equal(record.qualification.formalQualificationAllowed, false)
  assert.equal(record.qualification.checkpointSelected, false)
  assert.equal(record.qualification.worldEntryAllowed, false)
  assert.ok(record.artifacts.some(a => a.logicalPath === f.bindings.pkg.path))
  assert.ok(record.artifacts.some(a => a.logicalPath === f.bindings.report.path))
  assert.deepEqual(record.events, f.events)
  assert.ok(result.unavailableFields.includes('finishedAtUtc'))
  assert.ok(!result.unavailableFields.includes('metrics'))
  assert.ok(!f.calls.some(p => p.endsWith('/progress.json') || p.endsWith('/heartbeat.json') || p === `${REG}/current.json`))
})

test('compatible quality plan uses its registered protocol and frozen limits', async () => {
  const f = fixture(false)
  Object.assign(f.plan.configuration.executionCeiling, { epochs: 9, generatorOptimizerSteps: 432, discriminatorOptimizerSteps: 431 })
  f.seal()
  const result = await f.run()
  assert.equal(result.record.targetEpochs, 9); assert.equal(result.record.targetDiscriminatorOptimizerSteps, 431)
})

for (const [name, change, error] of [
  ['wrong progress Run', f => { f.terminal.lastDurableProgress.runId = 'wrong' }, 'identity_conflict'],
  ['wrong report package', f => { f.report.packageId = 'wrong'; f.seal() }, 'identity_conflict'],
  ['report progress disagreement', f => { f.report.lastDurableProgress.completedEpochs = 4; f.seal() }, 'report_conflict'],
  ['report falsely claims root cause', f => { f.report.modelRootCauseEstablished = true; f.seal() }, 'report_conflict'],
  ['unknown report schema', f => { f.report.schemaVersion = 'unknown-report-v1'; f.seal() }, 'report_conflict'],
  ['wrong report profile', f => { f.report.profileSha256 = '0'.repeat(64); f.seal() }, 'report_conflict'],
  ['checkpoint claim', f => { f.terminal.selectedCheckpoint = { path: 'weights.pt' } }, 'terminal_conflict'],
  ['training grant', f => { f.terminal.trainingQualificationGranted = true }, 'terminal_conflict'],
  ['negative steps', f => { f.terminal.lastDurableProgress.optimizerStepsGenerator = -1 }, 'progress_conflict'],
  ['invalid epoch relation', f => { f.terminal.lastDurableProgress.actualEpoch = 4 }, 'progress_conflict'],
  ['progress after terminal', f => { f.terminal.lastDurableProgress.updatedAtUtc = '2026-10-14T00:00:00Z' }, 'progress_conflict'],
  ['wrong event Run', f => { f.events[0].runId = 'wrong' }, 'registry_conflict'],
  ['wrong event digest', f => { f.events[0].currentSha256 = '0'.repeat(64) }, 'registry_conflict'],
  ['duplicate original event', f => { f.events.push(f.events[0]) }, 'registry_conflict'],
  ['unbound snapshot path', f => { f.events[0].evidenceReferences = [] }, 'registry_conflict'],
  ['snapshot tamper', f => { f.documents.set(f.bindings.snapshot.path, Buffer.from('{}')) }, 'history_sha_mismatch'],
  ['report tamper', f => { f.documents.set(f.bindings.report.path, Buffer.from('{}')) }, 'history_sha_mismatch'],
  ['package tamper', f => { f.documents.set(f.bindings.pkg.path, Buffer.from('{}')) }, 'history_sha_mismatch'],
  ['plan tamper', f => { f.documents.set(f.bindings.plan.path, Buffer.from('{}')) }, 'history_sha_mismatch'],
  ['wrong original snapshot Run', f => { f.snapshot.runId = 'wrong'; f.seal() }, 'registry_conflict'],
  ['wrong original capsule task', f => { f.originalCapsule.taskId = 'wrong'; f.seal() }, 'capsule_conflict'],
  ['unverified original capsule', f => { f.originalCapsule.integrity.status = 'unknown'; f.seal() }, 'capsule_conflict'],
  ['wrong original package', f => { f.pkg.packageIdentity = 'wrong'; f.seal() }, 'package_conflict'],
  ['wrong plan identity', f => { f.plan.packageId = 'wrong'; f.seal() }, 'identity_conflict'],
  ['cross protocol configuration', f => { f.plan.configuration.schema = 'ecology-regime-quality-configuration-v1'; f.seal() }, 'plan_conflict'],
  ['unknown plan protocol', f => { f.plan.schema = 'unknown-quality-plan-v1'; f.seal() }, 'plan_conflict'],
  ['step ceiling', f => { f.plan.configuration.executionCeiling.discriminatorOptimizerSteps = 284; f.seal() }, 'plan_limit_conflict'],
  ['epoch ceiling', f => { f.plan.configuration.executionCeiling.epochs = 5; f.seal() }, 'plan_limit_conflict'],
  ['unsafe package root', f => { f.pkg.outputRoot = '.runtime/ai-painter/../escape'; f.seal() }, 'package_conflict'],
  ['unsafe report path', f => { f.terminal.recoveryReport.path = '../report.json'; f.failures.set('../report.json', Object.assign(new Error('history_path_outside_root'), { status: 409 })) }, 'history_path_outside_root'],
]) test(`interruption rejects ${name}`, async () => {
  const f = fixture(); change(f); await assert.rejects(f.run, new RegExp(error, 'u'))
})

for (const [name, field, state, fail] of [
  ['missing report', 'report', 'missing', { code: 'ENOENT' }],
  ['unreadable plan', 'plan', 'unreadable', { code: 'EACCES' }],
  ['oversize package', 'pkg', 'over_limit', { status: 413 }],
]) test(`interruption preserves progress with ${name}`, async () => {
  const f = fixture(); f.failures.set(f.bindings[field].path, Object.assign(new Error(name), fail))
  const result = await f.run()
  const coverageField = { report: 'systemInterruptionReport', plan: 'trainingPlan', pkg: 'autonomousExecutionPackage' }[field]
  assert.equal(result.record.detailCoverage.availability[coverageField], state)
  assert.deepEqual(result.record.optimizerSteps, { generator: 286, discriminator: 285 })
  assert.equal(result.record.metrics.length, 1)
  assert.ok(!result.unavailableFields.includes('metrics'))
})

test('missing original event keeps terminal/report and does not borrow a different revision', async () => {
  const f = fixture(); f.events.shift()
  const result = await f.run()
  assert.equal(result.record.detailCoverage.availability.originalRegistrySnapshot, 'missing')
  assert.equal(result.record.resolution, undefined)
  assert.equal(f.calls.length, 1)
  assert.equal(result.record.completedEpochs, 5)
})

async function persist(t, f) {
  const root = await mkdtemp(path.join(tmpdir(), 'console-interruption-history-'))
  t.after(async () => {
    const resolved = await realpath(root)
    assert.equal(path.dirname(resolved), await realpath(tmpdir()))
    assert.ok(path.basename(resolved).startsWith('console-interruption-history-'))
    await rm(resolved, { recursive: true, force: true })
  })
  for (const [logical, raw] of f.documents) {
    await mkdir(path.dirname(path.join(root, logical)), { recursive: true })
    await writeFile(path.join(root, logical), raw)
  }
  const db = new DatabaseSync(path.join(root, REG, 'registry.sqlite'))
  try {
    db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
    for (const event of f.events) {
      db.prepare('INSERT INTO registry_revisions VALUES (?,?,?,?,?,?)').run(event.registryRevision, event.eventSequence,
        event.transactionId, event.currentSha256, event.taskId, event.runId)
      db.prepare('INSERT INTO registry_transactions VALUES (?,?,?)').run(event.transactionId, 'committed', event.currentSha256)
    }
  } finally { db.close() }
  return root
}

test('private registry reader serves details/events/artifacts without writes or host secrets', async t => {
  const f = fixture(), root = await persist(t, f), runId = f.identity.runId
  const before = await Promise.all([...f.documents.keys(), `${REG}/registry.sqlite`].map(p => readFile(path.join(root, p))))
  const detail = await readTrainingRun(runId, { root })
  assert.equal(detail.record.detailCoverage.adapter, 'training_system_interruption_v1')
  assert.equal(detail.record.finishedAtUtc, null)
  assert.equal(detail.record.events.length, 2)
  assert.equal(detail.record.checkpoints.length, 0); assert.equal(detail.record.samples.length, 0)
  const eventPage = await readTrainingRunSection(runId, { root, section: 'events', limit: 1 })
  assert.equal(eventPage.items.length, 1)
  const next = await readTrainingRunSection(runId, { root, section: 'events', limit: 1, cursor: eventPage.nextCursor })
  assert.equal(next.items[0].registryRevision, 2)
  const report = detail.record.artifacts.find(a => a.evidenceKind === 'systemInterruptionReport')
  const preview = (await readTrainingArtifact(runId, report.artifactId, { root })).json
  assert.equal(preview.verificationStatus, 'bytes_verified')
  assert.equal(preview.previewStatus, 'controlled_report_fields_only')
  assert.doesNotMatch(preview.text, /fixture-secret|CommandLine|SECRET_TOKEN|Processes/u)
  assert.equal(JSON.parse(preview.text).lastDurableProgress.completedEpochs, 5)
  const pkg = detail.record.artifacts.find(a => a.evidenceKind === 'autonomousExecutionPackage')
  assert.equal(JSON.parse((await readTrainingArtifact(runId, pkg.artifactId, { root })).json.text).packageIdentity, f.identity.packageId)
  const after = await Promise.all([...f.documents.keys(), `${REG}/registry.sqlite`].map(p => readFile(path.join(root, p))))
  assert.deepEqual(after, before)
  await writeFile(path.join(root, f.bindings.plan.path), '{}')
  await assert.rejects(readTrainingRun(runId, { root }), /history_sha_mismatch/u)
})

test('real interrupted Run readback preserves registry and bound evidence bytes', {
  skip: process.env.AI_CONSOLE_VERIFY_INTERRUPTED_RUN !== '1', timeout: 110000,
}, async () => {
  const root = process.cwd(), runId = 'ecology-decode1-cpu-repair-20261013-170651'
  const currentBefore = await readFile(path.join(root, REG, 'current.json'))
  const detail = await readTrainingRun(runId, { root })
  assert.equal(detail.record.detailCoverage.adapter, 'training_system_interruption_v1')
  assert.equal(detail.record.terminalStatus, 'training_system_interrupted')
  assert.equal(detail.record.completedEpochs, 5)
  assert.deepEqual(detail.record.optimizerSteps, { generator: 286, discriminator: 286 })
  assert.equal(detail.record.targetEpochs, 12)
  assert.equal(detail.record.metrics[0].epoch, 6)
  assert.equal(detail.record.finishedAtUtc, null)
  assert.equal(detail.record.events.length, 4)
  assert.equal(detail.record.samples.length, 0); assert.equal(detail.record.checkpoints.length, 0)
  for (const item of detail.record.artifacts.filter(a => ['terminal', 'evidence'].includes(a.role))) {
    await bytes(root, item.logicalPath, 2 * 1024 * 1024, item.sha256)
  }
  const report = detail.record.artifacts.find(a => a.evidenceKind === 'systemInterruptionReport')
  const preview = (await readTrainingArtifact(runId, report.artifactId, { root })).json
  assert.equal(preview.verificationStatus, 'bytes_verified')
  assert.doesNotMatch(preview.text, /CommandLine|Processes/u)
  assert.deepEqual(await readFile(path.join(root, REG, 'current.json')), currentBefore)
  // A later Run may legitimately be current/active while this historical
  // interrupted Run stays queryable. GET must preserve that current identity.
  assert.ok(JSON.parse(currentBefore).registryRevision >= 413)
  assert.equal(detail.sourceRevision, JSON.parse(currentBefore).registryRevision)
})
