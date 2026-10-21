import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { listTrainingHistory, readTrainingRun, readTrainingRunSection, readTrainingArtifact } from '../../src/server/ai-console/training-history-store.mjs'

const REG = '.runtime/ai-painter/current-execution-registry'
const sha = value => createHash('sha256').update(value).digest('hex')
async function fixture(t, { phase = 'training', withWorker = false, mutateFailure, mutatePlan, mutatePackage, mutateWorker } = {}) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'history-parent-failure-'))
  await fs.mkdir(path.join(root, REG), { recursive: true }); await fs.mkdir(path.join(root, 'data'))
  const db = new DatabaseSync(path.join(root, REG, 'registry.sqlite'))
  db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
  t.after(async () => {
    db.close()
    assert.equal(path.dirname(await fs.realpath(root)), await fs.realpath(tmpdir()))
    assert.ok(path.basename(root).startsWith('history-parent-failure-'))
    await fs.rm(root, { recursive: true })
  })
  const put = async (logical, value) => {
    const raw = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    const file = path.join(root, logical); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, raw)
    return { path: logical, sha256: sha(raw) }
  }
  const id = { runId: 'failure-fixture-run', packageId: 'failure-fixture-package', capabilityVersion: 'failure-fixture-capability' }
  const outputRoot = `.runtime/ai-painter/parent-failure-fixture/${id.runId}`
  const plan = { ...id, schema: 'object-support-structure-quality-plan-v1', executionMode: 'bounded-quality-training', outputRoot,
    configuration: { schema: 'object-support-structure-quality-configuration-v1', capabilityVersion: id.capabilityVersion,
      scope: { resolution: [256, 192] }, executionCeiling: { epochs: 24, generatorOptimizerSteps: 1152, discriminatorOptimizerSteps: 1152 },
      checkpointSelection: { eligibleEpochs: [24], observationOnlyEpochs: [12], validationRowsPerEligibleEpoch: 8 } } }
  mutatePlan?.(plan)
  const planBinding = await put(`${outputRoot}/quality-plan.json`, plan)
  const pkg = { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: id.packageId,
    capabilityVersion: id.capabilityVersion, outputRoot, inputEvidence: [planBinding] }
  mutatePackage?.(pkg)
  const packageBinding = await put(`.runtime/ai-painter/autonomous-closed-loop-packages/${id.packageId}/package.json`, pkg)
  const worker = { ...id, schema: 'object-support-structure-quality-worker-terminal-v1', executionState: 'failed_closed', status: 'failed_closed',
    executionPackage: packageBinding, optimizerStepsGenerator: 607, optimizerStepsDiscriminator: 608, completedEpochs: 12,
    checkpoints: [], epochObservations: [], selectedCheckpointRecord: null, originalError: { type: 'ValueError', message: 'synthetic failure' } }
  mutateWorker?.(worker)
  const workerBinding = withWorker ? await put(`${outputRoot}/worker-terminal.json`, worker) : null
  const failure = { ...id, status: 'failed_closed', executionState: 'failed_closed', phase, executionPackage: packageBinding,
    workerTerminal: workerBinding, optimizerStepsGenerator: null, optimizerStepsDiscriminator: null,
    error: 'Error: wall_timeout', originalError: null, cleanupConfirmed: true }
  mutateFailure?.(failure)
  const failureBinding = await put(`${outputRoot}/execution-failure.json`, failure)
  // A last progress file and unbound artifact are not terminal evidence. They
  // must remain untouched, and cannot provide exact final training counters.
  const unbound = await put(`${outputRoot}/progress.json`, { ...id, actualEpoch: 19, completedEpochs: 18,
    optimizerStepsGenerator: 899, optimizerStepsDiscriminator: 899, latestTrainingPreview: { untrusted: true } })
  const unrelated = await put('.runtime/ai-painter/earlier-fixture/terminal.json', { runId: 'earlier-fixture', status: 'completed_not_qualified', schemaVersion: 'unknown-history-fixture' })
  const latest = { ...unrelated, runId: 'earlier-fixture', status: 'completed_not_qualified' }
  let previous = null, revision = 0
  const events = []
  async function append(runId, terminalBinding, status, fields = {}) {
    revision++; const transactionId = `fixture-transaction-${revision}`
    const capsule = await put(`.runtime/ai-painter/fixture-capsules/${transactionId}.json`, { schemaVersion: 'ai-painter-local-task-capsule-v1', taskId: runId,
      integrity: { status: 'verified' }, evidence: [{ ...terminalBinding, sha256Verified: true }, { ...packageBinding, kind: 'execution_package', sha256Verified: true }] })
    const snapshot = { schemaVersion: 'ai-painter-current-execution-registry-v1', writerIdentity: 'local_ai_capability_lifecycle_orchestrator',
      registryRevision: revision, eventSequence: revision, transactionId, taskId: runId, runId,
      ...(runId === id.runId ? { packageId: id.packageId, capabilityVersion: id.capabilityVersion, taskKind: 'ecology_quality_training' } : {}),
      terminalEvidence: { ...terminalBinding, status }, taskCapsule: capsule, activeExecution: null,
      latestTrainingTerminal: latest, supersedes: previous, archivedEvidenceNamespaces: [], ...fields }
    const staged = await put(`${REG}/transactions/${transactionId}/current.staged.json`, snapshot)
    await put(`${REG}/current.json`, snapshot)
    await put(`${REG}/transactions/${transactionId}/transaction.json`, { schemaVersion: 'ai-painter-current-execution-registry-transaction-v1',
      transactionId, registryRevision: revision, eventSequence: revision, status: 'committed', currentSha256: staged.sha256, previousCurrentSha256: previous?.currentSha256 ?? null })
    db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(revision, revision, transactionId, staged.sha256, runId, runId)
    db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run(transactionId, 'committed', staged.sha256)
    events.push({ transactionId, registryRevision: revision, eventSequence: revision, taskId: runId, runId, currentSha256: staged.sha256, previousCurrentSha256: previous?.currentSha256 ?? null })
    await put(`${REG}/events.jsonl`, Buffer.from(events.map(row => JSON.stringify(row)).join('\n') + '\n'))
    previous = { registryRevision: revision, eventSequence: revision, transactionId, currentSha256: staged.sha256, taskId: runId, runId }
  }
  await append('earlier-fixture', unrelated, latest.status)
  await append(id.runId, failureBinding, 'failed_closed')
  return { root, id, failure, failureBinding, workerBinding, packageBinding, planBinding, unbound, put, append, latest,
    async newTask() {
      const bound = await put('.runtime/ai-painter/next-task/terminal.json', { runId: 'next-task', status: 'planning_pending', executionState: 'completed' })
      await append('next-task', bound, 'planning_pending')
    } }
}

test('parent timeout stays listed and readable without a worker or latestTrainingTerminal update', async t => {
  const f = await fixture(t), original = await fs.readFile(path.join(f.root, REG, 'current.json'))
  const listing = await listTrainingHistory({ root: f.root })
  assert.deepEqual(listing.records.map(row => row.runId), [f.id.runId, 'earlier-fixture'])
  const detail = await readTrainingRun(f.id.runId, { root: f.root })
  assert.equal(detail.record.terminalStatus, 'failed_closed')
  assert.equal(detail.reasonCode, 'history_managed_parent_failure_worker_missing')
  assert.equal(detail.record.trainingStatus, 'failed_closed')
  assert.deepEqual(detail.record.optimizerSteps, { generator: null, discriminator: null })
  assert.equal(detail.record.completedEpochs, null)
  assert.equal(detail.record.targetEpochs, 24)
  assert.deepEqual(detail.record.resolution, { width: 256, height: 192 })
  assert.deepEqual(detail.record.failureSummary, { type: 'Error', message: 'wall_timeout' })
  assert.equal(detail.record.events.length, 1)
  assert.ok(detail.record.events.every(event => event.runId === f.id.runId))
  assert.equal(detail.record.artifacts.some(item => ['image', 'output', 'checkpoint'].includes(item.role)), false)
  assert.match(detail.record.detailCoverage.artifactSourceGap, /缺少受信终态清单，当前接口未接入/)
  assert.equal(detail.record.detailCoverage.trainingPreview.status, 'unavailable')
  const pkg = detail.record.artifacts.find(item => item.evidenceKind === 'autonomousExecutionPackage')
  const pkgResponse = (await readTrainingArtifact(f.id.runId, pkg.artifactId, { root: f.root })).json
  assert.equal(pkgResponse.verificationStatus, 'bytes_verified')
  assert.equal(JSON.parse(pkgResponse.text).packageIdentity, f.id.packageId)
  const page = await readTrainingRunSection(f.id.runId, { root: f.root, section: 'artifacts', limit: 20 })
  assert.equal(page.items.length, detail.record.artifacts.length)
  assert.deepEqual(await fs.readFile(path.join(f.root, REG, 'current.json')), original)
  assert.equal(sha(await fs.readFile(path.join(f.root, f.unbound.path))), f.unbound.sha256)
})

test('failed Run remains queryable after another project task takes over', async t => {
  const f = await fixture(t); await f.newTask()
  const listing = await listTrainingHistory({ root: f.root })
  assert.ok(listing.records.some(row => row.runId === f.id.runId && row.terminalStatus === 'failed_closed'))
  assert.equal((await readTrainingRun(f.id.runId, { root: f.root })).record.terminalBinding.sha256, f.failureBinding.sha256)
})

test('a carried older worker pointer cannot replace the newer Run-owned parent failure', async t => {
  const f = await fixture(t, { withWorker: true })
  await f.append('next-task', await f.put('.runtime/ai-painter/next-task/result.json', { runId: 'next-task', status: 'planning_pending', executionState: 'completed' }), 'planning_pending', {
    latestTrainingTerminal: { ...f.workerBinding, runId: f.id.runId, status: 'failed_closed' },
  })
  const item = (await listTrainingHistory({ root: f.root })).records.find(row => row.runId === f.id.runId)
  assert.equal(item.terminalBinding.sha256, f.failureBinding.sha256)
})

for (const phase of ['qualification', 'gpu_qualification']) test(`${phase} failure never masquerades as completed or active training`, async t => {
  const f = await fixture(t, { phase })
  const detail = await readTrainingRun(f.id.runId, { root: f.root })
  assert.equal(detail.record.runKind, 'bounded_gpu_qualification')
  assert.equal(detail.record.trainingStatus, null)
  assert.equal(detail.record.completedEpochs, null)
  assert.deepEqual(detail.record.optimizerSteps, { generator: null, discriminator: null })
  assert.equal(detail.record.detailCoverage.phase, phase)
  assert.equal(detail.record.qualification.formalQualificationAllowed, false)
})

test('existing worker terminal remains the authority for its recorded counters', async t => {
  const f = await fixture(t, { withWorker: true })
  const detail = await readTrainingRun(f.id.runId, { root: f.root })
  assert.deepEqual(detail.record.optimizerSteps, { generator: 607, discriminator: 608 })
  assert.equal(detail.record.completedEpochs, 12)
  assert.equal(detail.record.artifacts.some(item => item.evidenceKind === 'workerTerminal'), true)
})

test('qualification parent cannot claim a training worker or its optimization counts', async t => {
  const f = await fixture(t, { phase: 'qualification', withWorker: true })
  await assert.rejects(readTrainingRun(f.id.runId, { root: f.root }), /history_managed_parent_phase_conflict/)
})

test('a bound worker file that is missing preserves the parent failure, events and plan with an explicit gap', async t => {
  const f = await fixture(t, { withWorker: true })
  await fs.unlink(path.join(f.root, f.workerBinding.path))
  const detail = await readTrainingRun(f.id.runId, { root: f.root })
  assert.equal(detail.record.failureSummary.message, 'wall_timeout')
  assert.equal(detail.record.detailCoverage.workerTerminal, 'missing')
  assert.deepEqual(detail.record.optimizerSteps, { generator: null, discriminator: null })
  assert.equal(detail.record.events.length, 1)
})

for (const [name, options] of [
  ['worker Run', { mutateWorker: worker => { worker.runId = 'foreign-run' } }],
  ['worker package', { mutateWorker: worker => { worker.packageId = 'foreign-package' } }],
  ['worker SHA', { mutateFailure: value => { value.workerTerminal.sha256 = 'f'.repeat(64) } }],
]) test(`explicit worker ${name} conflict is rejected, not silently treated as missing`, async t => {
  const f = await fixture(t, { withWorker: true, ...options })
  await assert.rejects(readTrainingRun(f.id.runId, { root: f.root }), /history_(managed_identity_conflict|sha_mismatch)/)
})

for (const [name, options] of [
  ['wrong Run', { mutateFailure: value => { value.runId = 'foreign-run' } }],
  ['wrong package identity', { mutateFailure: value => { value.packageId = 'foreign-package' } }],
  ['wrong capability identity', { mutateFailure: value => { value.capabilityVersion = 'foreign-capability' } }],
  ['wrong package SHA', { mutateFailure: value => { value.executionPackage.sha256 = 'f'.repeat(64) } }],
  ['wrong package header', { mutatePackage: value => { value.packageIdentity = 'foreign-package' } }],
  ['wrong output root', { mutatePackage: value => { value.outputRoot = '.runtime/ai-painter/foreign' } }],
]) test(`registry-derived parent failure rejects ${name}`, async t => {
  const f = await fixture(t, options)
  await assert.rejects(listTrainingHistory({ root: f.root }), /history_|current_|registry_/)
})

for (const [name, mutatePlan] of [
  ['wrong plan Run', value => { value.runId = 'foreign-run' }],
  ['wrong configuration capability', value => { value.configuration.capabilityVersion = 'foreign-capability' }],
]) test(`detail rejects ${name} without scanning alternate evidence`, async t => {
  const f = await fixture(t, { mutatePlan })
  await assert.rejects(readTrainingRun(f.id.runId, { root: f.root }), /history_parent_failure_plan_conflict/)
})

test('changed failure bytes are rejected after an earlier successful list/detail read', async t => {
  const f = await fixture(t)
  await readTrainingRun(f.id.runId, { root: f.root })
  await fs.writeFile(path.join(f.root, f.failureBinding.path), JSON.stringify({ ...f.failure, error: 'changed but valid JSON' }))
  await assert.rejects(readTrainingRun(f.id.runId, { root: f.root }), /sha256|sha_mismatch|current_task_evidence_unknown_hash_mismatch/)
})

test('unrelated versioned native qualification failures are not mistaken for parent package failures', async t => {
  const f = await fixture(t)
  const bound = await f.put('.runtime/ai-painter/native-failure-fixture/terminal.json', { schema: 'object-support-structure-quality-native-failure-v1',
    runId: 'native-failure-fixture', status: 'failed_closed', executionState: 'failed_closed', phase: 'qualification' })
  await f.append('native-failure-fixture', bound, 'failed_closed')
  assert.ok((await listTrainingHistory({ root: f.root })).records.some(row => row.runId === f.id.runId))
  assert.equal((await readTrainingRun(f.id.runId, { root: f.root })).record.terminalStatus, 'failed_closed')
})
