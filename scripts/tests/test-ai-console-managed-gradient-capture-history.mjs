import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
function fixture(options = {}) {
  const runId = 'capture-history-test', packageId = 'capture-package', capabilityVersion = 'capture-capability'
  const root = `.runtime/ai-painter/${runId}`, files = new Map(), reads = []
  const bind = (logical, value) => {
    const raw = Buffer.from(JSON.stringify(value)); files.set(logical, raw)
    return { path: logical, sha256: hash(raw) }
  }
  const identity = { runId, packageId, capabilityVersion }
  const programBindings = { worker: { path: 'ml/ai-painter/scripts/fixture-worker.py', sha256: hash('worker') },
    capture: { path: 'ml/ai-painter/src/fixture-capture.py', sha256: hash('capture') } }
  const model = { capabilityVersion, modelCapabilityVersion: 'model-v1', architecture: 'fixture-architecture', graph: [
    { dtype: 'torch.float32', elements: 4, name: 'fixture.weight', shape: [2, 2] },
    { dtype: 'torch.float32', elements: 2, name: 'fixture.bias', shape: [2] } ] }
  options.model?.(model)
  const modelBinding = bind(`${root}/model-identity.json`, model)
  const plan = bind(`${root}/quality-plan.json`, { ...identity, schema: 'ecology-decode1-weight-quality-plan-v1',
    executionMode: 'bounded-quality-training', outputRoot: root, programBindings: structuredClone(programBindings), configuration: {
      schema: 'ecology-decode1-weight-quality-configuration-v1', scope: { resolution: [256, 192], subjectSampleId: 'validation-0' },
      executionCeiling: { epochs: 12, generatorOptimizerSteps: 576, discriminatorOptimizerSteps: 576 },
      checkpointSelection: { eligibleEpochs: [12], validationRowsPerEligibleEpoch: 8 } } })
  const executionPackage = bind(`${root}/autonomous.json`, { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1',
    packageIdentity: packageId, capabilityVersion, outputRoot: root, inputEvidence: [plan, modelBinding] })
  const originalError = { type: 'ValueError', message: 'actual total gradient identity differs at parameter 60',
    messageSha256: hash('actual total gradient identity differs at parameter 60') }
  const failurePosition = { epoch: 11, sampleId: 'train-a', trainIndex: 3, zeroBasedEpochPosition: 28 }
  const source = { path: 'data/train-a.png', sha256: hash('source') }
  const condition = { path: 'data/train-a-condition.json', sha256: hash('condition') }
  const context = { runId, executionPackage, modelBinding, failurePosition, optimizerSteps: { generator: 508, discriminator: 509 },
    sampleId: 'train-a', split: 'train', sampleIdentity: { sampleId: 'train-a', split: 'train', image: source, conditionPack: condition },
    sampleBindings: { source, condition }, programBindings: structuredClone(programBindings) }
  options.context?.(context)
  const execution = { schema: 'ecology-regime-failure-capture-execution-v1', runId, executionPackage, modelBinding,
    outputRoot: root, programBindings: structuredClone(programBindings) }
  options.execution?.(execution)
  const executionBinding = bind(`${root}/capture-execution.json`, execution)
  const primary = { context: structuredClone(context), primaryError: structuredClone(originalError), timing: 'after_exception' }
  options.primary?.(primary)
  const primaryBinding = bind(`${root}/gradient-failure/primary.json`, primary)
  const tensors = { path: `${root}/gradient-failure/tensors.pt`, sha256: hash('unread-tensors'), bytes: 42252025 }
  const manifest = { schema: 'ecology-regime-gradient-failure-capture-v1', status: 'captured', missing: [], graph: structuredClone(model.graph),
    context: structuredClone(context), executionBinding, artifacts: {
      primary: { ...primaryBinding, bytes: files.get(primaryBinding.path).length }, tensors },
    qualificationAllowed: false, replayAllowed: false }
  options.manifest?.(manifest)
  const manifestBinding = bind(`${root}/gradient-failure/manifest.json`, manifest)
  const receipt = { schema: 'ecology-regime-gradient-failure-capture-v1', status: 'captured', missing: [],
    primaryError: structuredClone(originalError), artifacts: {
      manifest: { ...manifestBinding, bytes: files.get(manifestBinding.path).length },
      primary: { ...primaryBinding, bytes: files.get(primaryBinding.path).length }, tensors } }
  const worker = { ...identity, schema: 'ecology-decode1-weight-quality-worker-terminal-v1', executionPackage,
    executionState: 'failed_closed', status: 'failed_closed', completedEpochs: 10,
    optimizerStepsGenerator: 508, optimizerStepsDiscriminator: 509, optimizerSteps: { generator: 508, discriminator: 509 },
    originalError, failurePosition, captureStatus: 'captured', captureMissing: [], captureReceipt: receipt,
    checkpoints: [], selectedCheckpointRecord: null, checkpointReloadVerified: false }
  if (options.success) {
    const cp = { epoch: 12, checkpoint: { path: `${root}/checkpoint.pt`, sha256: hash('metadata-only-checkpoint') },
      counts: { generator: 576, discriminator: 576 }, validation: Array.from({ length: 8 }, (_, index) => ({
        sampleId: `validation-${index}`, split: 'validation', epoch: 12, fullRgbMae: 0.1 })) }
    Object.assign(worker, { executionState: 'completed', status: 'training_completed_review_pending', completedEpochs: 12,
      optimizerStepsGenerator: 576, optimizerStepsDiscriminator: 576, optimizerSteps: { generator: 576, discriminator: 576 },
      checkpoints: [cp], selectedCheckpointRecord: cp, checkpointReloadVerified: true, captureStatus: 'capture_not_triggered' })
    delete worker.captureReceipt
  }
  options.worker?.(worker)
  const terminalBinding = bind(`${root}/worker-terminal.json`, worker)
  let taskTerminalBinding
  if (options.success) {
    const predictions = worker.checkpoints[0].validation.map((row, index) => ({
      path: `${root}/prediction-${index}.png`, sha256: hash(`prediction-${index}`) }))
    const report = bind(`${root}/review-report.json`, { ...identity, schema: 'ecology-regime-native-review-input-v1',
      executionPackage, workerTerminal: terminalBinding, selectedCheckpoint: worker.selectedCheckpointRecord.checkpoint,
      subject: { sampleId: 'validation-0', split: 'validation' }, candidateRgb: predictions[0],
      originalRgb: { path: `${root}/reference.png`, sha256: hash('reference') }, artifacts: predictions,
      validationImages: predictions.map((binding, index) => ({ sampleId: `validation-${index}`, split: 'validation',
        epoch: 12, optimizerStep: 576, purpose: 'prediction', binding })) })
    taskTerminalBinding = bind(`${root}/review-terminal.json`, { ...identity, executionPackage, reviewReport: report })
  }
  const makeArtifact = (role, b, metadata = {}) => ({ artifactId: hash(JSON.stringify([runId, role, b.path, b.sha256])),
    role, logicalPath: b.path, sha256: b.sha256, ...metadata })
  const initial = [makeArtifact('terminal', terminalBinding),
    makeArtifact('registry_transaction', { path: '.runtime/ai-painter/current-execution-registry/tx-a.json', sha256: hash('a') }),
    makeArtifact('registry_transaction', { path: '.runtime/ai-painter/current-execution-registry/tx-b.json', sha256: hash('b') }),
    makeArtifact('evidence', executionPackage), makeArtifact('evidence', plan)]
  const readEvidenceJson = async (b, maximum) => {
    reads.push(b.path)
    const raw = files.get(b.path)
    if (!raw) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    if (raw.length > maximum) throw Object.assign(new Error('history_byte_limit'), { status: 413 })
    if (hash(raw) !== b.sha256) throw new Error('history_sha_mismatch')
    return { value: JSON.parse(raw), byteLength: raw.length, sha256: hash(raw) }
  }
  const run = () => adaptLegacyTrainingDetail({ runId, terminal: worker, taskTerminalBinding,
    record: { runId, terminalBinding, artifacts: structuredClone(initial), metrics: [], checkpoints: [], samples: [], qualification: {} },
    base: { unavailableFields: [], sourceRevision: 415 }, makeArtifact, readEvidenceJson,
    readJson: async b => (await readEvidenceJson(b, 2097152)).value,
    checkpointMetadata: async item => {
      if (!options.success) throw Error('unexpected weight access')
      return { ...item, byteLength: 123 }
    },
    requireFact: (v, code, status = 409) => { if (!v) throw Object.assign(new Error(code), { status }) } })
  return { files, reads, run, initial, worker, manifest, primary, manifestBinding, primaryBinding, modelBinding, executionBinding }
}

test('captured managed failure adds exactly two JSON evidence artifacts and preserves the original five', async () => {
  const f = fixture(), d = await f.run(), a = d.record.artifacts
  assert.equal(a.length, 7)
  assert.deepEqual(a.slice(0, 5), f.initial)
  assert.deepEqual(a.slice(5).map(item => item.evidenceKind), ['gradientFailureManifest', 'gradientFailurePrimary'])
  assert.deepEqual(a.slice(5).map(item => item.sha256), [f.manifestBinding.sha256, f.primaryBinding.sha256])
  assert.ok(a.slice(5).every(item => item.role === 'evidence'))
  assert.equal(d.record.optimizerSteps.generator, 508); assert.equal(d.record.optimizerSteps.discriminator, 509)
  assert.equal(d.record.completedEpochs, 10); assert.equal(d.record.checkpoints.length, 0); assert.equal(d.record.samples.length, 0)
  assert.equal(d.record.qualification.formalQualificationAllowed, false)
  assert.ok(f.reads.every(file => file.endsWith('.json')))
  assert.ok(!a.some(item => item.logicalPath.endsWith('.pt')))
  assert.ok(d.record.detailCoverage.jsonReads <= 16)
})

test('successful capture_not_triggered worker keeps all eight explicitly bound validation outputs', async () => {
  const f = fixture({ success: true }), d = await f.run()
  assert.equal(d.record.samples.length, 8); assert.equal(d.record.checkpoints.length, 1)
  assert.equal(d.record.artifacts.filter(item => item.role === 'output').length, 8)
  assert.equal(d.record.detailCoverage.availability.validationImages, 'available')
  assert.ok(!d.unavailableFields.includes('artifacts'))
  assert.ok(!d.record.artifacts.some(item => item.evidenceKind?.startsWith('gradientFailure')))
  assert.ok(!f.reads.some(file => file.includes('/gradient-failure/')))
})

test('failed but capture_not_triggered worker does not create a capture gap', async () => {
  for (const placeholder of [false, true]) {
    const f = fixture({ worker: w => {
      w.captureStatus = 'capture_not_triggered'
      if (placeholder) w.captureReceipt = null
      else delete w.captureReceipt
    } })
    const d = await f.run()
    assert.deepEqual(d.record.artifacts, f.initial); assert.ok(!d.unavailableFields.includes('artifacts'))
    assert.ok(!f.reads.some(file => file.includes('/gradient-failure/')))
  }
})

test('context and graph comparison ignores object key order but preserves array order', async () => {
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])])) : value
  const f = fixture({ primary: p => { p.context = reorder(p.context) }, manifest: m => { m.graph = reorder(m.graph) } })
  assert.equal((await f.run()).record.artifacts.length, 7)
})

for (const [name, options] of [
  ['unknown manifest schema', { manifest: m => { m.schema += '-future' } }],
  ['unknown receipt schema', { worker: w => { w.captureReceipt.schema += '-future' } }],
  ['unknown primary shape', { primary: p => { p.schema = 'future-primary-v9' } }],
  ['wrong Run', { primary: p => { p.context.runId = 'foreign' } }],
  ['wrong package', { manifest: m => { m.context.executionPackage.sha256 = hash('foreign') } }],
  ['wrong model binding', { primary: p => { p.context.modelBinding.sha256 = hash('foreign') } }],
  ['wrong model capability', { model: m => { m.capabilityVersion = 'foreign' } }],
  ['same sample but internally consistent different source', { primary: p => {
    p.context.sampleBindings.source = { path: 'data/other-source.png', sha256: hash('other-source') }
    p.context.sampleIdentity.image = structuredClone(p.context.sampleBindings.source)
  } }],
  ['same sample but internally consistent different condition', { primary: p => {
    p.context.sampleBindings.condition = { path: 'data/other-condition.json', sha256: hash('other-condition') }
    p.context.sampleIdentity.conditionPack = structuredClone(p.context.sampleBindings.condition)
  } }],
  ['different nested sample metadata', { primary: p => { p.context.sampleIdentity.worldId = 'different-world' } }],
  ['both contexts agree on wrong program SHA', { context: c => { c.programBindings.worker.sha256 = hash('foreign-worker') } }],
  ['both contexts omit a frozen program', { context: c => { delete c.programBindings.capture } }],
  ['model graph differs', { manifest: m => { m.graph[0].shape = [4, 1] } }],
  ['model parameter order differs', { manifest: m => { m.graph.reverse() } }],
  ['wrong sample', { primary: p => { p.context.sampleId = 'foreign' } }],
  ['wrong split', { manifest: m => { m.context.split = 'challenge' } }],
  ['wrong original error', { primary: p => { p.primaryError.message = 'different failure' } }],
  ['wrong counts', { primary: p => { p.context.optimizerSteps.generator = 507 } }],
  ['wrong failure position', { manifest: m => { m.context.failurePosition.epoch = 12 } }],
  ['wrong execution parent', { execution: e => { e.runId = 'foreign' } }],
  ['wrong tensor identity', { manifest: m => { m.artifacts.tensors = { ...m.artifacts.tensors, sha256: hash('foreign') } } }],
  ['false complete flag', { manifest: m => { m.missing = ['generator_state']; m.complete = true } }],
  ['receipt not captured', { worker: w => { w.captureReceipt.status = 'partial' } }],
  ['missing primary binding', { worker: w => { delete w.captureReceipt.artifacts.primary } }],
  ['wrong declared length', { worker: w => { w.captureReceipt.artifacts.primary.bytes++ } }],
  ['outside outputRoot', { worker: w => { w.captureReceipt.artifacts.manifest.path = '.runtime/ai-painter/foreign/manifest.json' } }],
  ['wrong fixed child path', { worker: w => { w.captureReceipt.artifacts.primary.path = w.captureReceipt.artifacts.primary.path.replace('/primary.json', '/other.json') } }],
  ['traversal', { worker: w => { w.captureReceipt.artifacts.manifest.path += '/../outside.json' } }],
  ['oversize declared JSON', { worker: w => { w.captureReceipt.artifacts.manifest.bytes = 2097153 } }],
]) test(`capture ${name} is partial/rejected without dropping the original five`, async () => {
  const f = fixture(options), d = await f.run()
  assert.deepEqual(d.record.artifacts, f.initial)
  assert.equal(d.dataStatus, 'partial')
  assert.ok(d.unavailableFields.includes('artifacts'))
  assert.notEqual(d.record.detailCoverage.availability.artifacts, 'available')
  assert.ok(f.reads.every(file => file.endsWith('.json')))
})

for (const [name, field, status] of [
  ['missing JSON', 'primaryBinding', 'missing'], ['manifest bytes tampered', 'manifestBinding', 'hash_conflict'],
  ['model bytes tampered', 'modelBinding', 'hash_conflict'], ['execution bytes tampered', 'executionBinding', 'hash_conflict'],
]) test(`capture ${name} retains safe existing evidence`, async () => {
  const f = fixture()
  if (status === 'missing') f.files.delete(f[field].path)
  else f.files.set(f[field].path, Buffer.from('{}'))
  const d = await f.run()
  assert.deepEqual(d.record.artifacts, f.initial)
  assert.equal(d.record.detailCoverage.availability.artifacts, status)
})

test('actual over-limit JSON is not accepted on a smaller caller byte declaration', async () => {
  const f = fixture(), raw = Buffer.from(' '.repeat(2097153))
  f.files.set(f.primaryBinding.path, raw)
  f.worker.captureReceipt.artifacts.primary.sha256 = hash(raw)
  const d = await f.run()
  assert.equal(d.record.artifacts.length, 5)
  assert.equal(d.record.detailCoverage.availability.artifacts, 'over_limit')
})

test('real Run HTTP serves capture JSON, keeps tensors metadata-only and does not change evidence', {
  skip: process.env.AI_CONSOLE_VERIFY_CAPTURE_RUN !== '1', timeout: 100000,
}, async () => {
  const root = process.cwd(), runId = 'decode1-quality-v2-25e96b64-787b-4d4d-b9f3-114850f7e337'
  const base = 'http://127.0.0.1:3000', route = `/api/ai-console/training/history/${runId}`
  const get = async url => {
    const r = await fetch(base + url, { signal: AbortSignal.timeout(10000), cache: 'no-store' })
    assert.equal(r.status, 200); assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.ok(r.headers.get('cache-control').includes('no-store'))
    const j = await r.json(); return j
  }
  const currentBefore = await get('/api/ai-console/observability/current-execution')
  const d = await get(route), a = d.record.artifacts
  const manifests = a.filter(item => item.evidenceKind === 'gradientFailureManifest')
  const primaries = a.filter(item => item.evidenceKind === 'gradientFailurePrimary')
  assert.equal(manifests.length, 1); assert.equal(primaries.length, 1); assert.equal(a.length, 7)
  const workerItem = a.find(item => item.role === 'terminal')
  const worker = JSON.parse((await get(workerItem.url)).text)
  const bound = worker.captureReceipt.artifacts
  const paths = [bound.manifest.path, bound.primary.path, workerItem.logicalPath,
    '.runtime/ai-painter/current-execution-registry/current.json']
  const before = await Promise.all(paths.map(file => readFile(path.join(root, file))))
  for (const [item, label, expectedBytes] of [[manifests[0], 'manifest', 315716], [primaries[0], 'primary', 51922]]) {
    const result = await get(item.url)
    assert.equal(result.verificationStatus, 'bytes_verified'); assert.equal(result.byteLength, expectedBytes)
    assert.equal(result.sha256, bound[label].sha256)
    const raw = before[paths.indexOf(bound[label].path)]
    assert.equal(hash(raw), result.sha256); assert.equal(raw.length, result.byteLength)
    if (!result.truncated) assert.equal(hash(Buffer.from(result.text)), result.sha256)
    else assert.equal(Buffer.byteLength(result.text), 65536)
    console.log(JSON.stringify({ evidenceKind: item.evidenceKind, artifactId: item.artifactId,
      byteLength: result.byteLength, sha256: result.sha256, truncated: result.truncated }))
  }
  assert.equal(d.record.samples.length, 0); assert.equal(d.record.checkpoints.length, 0)
  assert.ok(!a.some(item => ['output', 'original', 'image', 'checkpoint'].includes(item.role)))
  assert.ok(!a.some(item => item.logicalPath === bound.tensors.path))
  assert.deepEqual(await Promise.all(paths.map(file => readFile(path.join(root, file)))), before)
  const currentAfter = await get('/api/ai-console/observability/current-execution')
  assert.equal(currentAfter.sourceSha256, currentBefore.sourceSha256)
  assert.equal(currentAfter.registryRevision, 415); assert.equal(currentAfter.activeExecution, null)
})
