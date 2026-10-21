import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { adaptManagedTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'
import { previewIdentityHash } from '../../src/server/ai-console/training-preview-history-v1.mjs'
import { bytes, requireFact } from '../../src/server/ai-console/training-history-safe-bytes.mjs'

// In-memory CPU fixtures: no model, RGB, production files or registries written.
const hash = value => createHash('sha256').update(value).digest('hex')
const membershipSchema = 'ai-painter-stage4-v2-mvp64-fresh-lineage-dataset-release-v1:membership'
const source = 'managed_midpoint_observation'
function fixture(terrain = false) {
  const outputRoot = '.runtime/ai-painter/synthetic-midpoint', files = new Map(), calls = []
  const id = { runId: 'synthetic-midpoint', packageId: 'synthetic-package', capabilityVersion: 'synthetic-capability' }
  const prefix = terrain ? 'ecology-terrain-detail-weight' : 'object-support-structure'
  const bind = (path, value) => {
    const raw = Buffer.from(JSON.stringify(value)); files.set(path, raw)
    return { path, sha256: hash(raw) }
  }
  const config = { schema: `${prefix}-quality-configuration-${terrain ? 'v2' : 'v1'}`,
    capabilityVersion: id.capabilityVersion, modelCapabilityVersion: 'synthetic-model',
    scope: { resolution: [256, 192] }, optimizer: { eps: 1e-8 },
    executionCeiling: { epochs: 24, generatorOptimizerSteps: 1152, discriminatorOptimizerSteps: 1152 },
    checkpointSelection: { eligibleEpochs: [24], observationOnlyEpochs: [12], validationRowsPerEligibleEpoch: 8 } }
  const model = { capabilityVersion: id.capabilityVersion, modelCapabilityVersion: config.modelCapabilityVersion }
  const split = { schemaVersion: membershipSchema, split: 'validation', sampleIds: Array.from({ length: 8 }, (_, i) => `sample-${i}`) }
  const datasetManifest = { path: 'data/synthetic/manifest.json', sha256: hash('unread-manifest') }
  const plan = { ...id, schema: `${prefix}-quality-plan-v1`, executionMode: 'bounded-quality-training',
    outputRoot, configuration: config, datasetManifest }
  const observations = split.sampleIds.map(sampleId => ({ sampleId, split: 'validation', epoch: 12,
    fullRgbMae: 0.125, objectCorrelations: { object_footprints: 0.5, object_tree: 0.25, object_rock: -0.125, object_vegetation: null } }))
  observations[0].objectCorrelations.object_vegetation = 0.125
  const metrics = { epoch: 12, meanValidationRgbMae: 0.125, worstApplicableObjectCorrelation: -0.125,
    applicableImageCounts: { object_footprints: 8, object_tree: 8, object_rock: 8, object_vegetation: 1 },
    rank: [-0.125, -0.125, -12], qualificationGranted: false, checkpointPromotionEligible: false }
  const entry = { ...id, modelCapabilityVersion: config.modelCapabilityVersion, epoch: 12,
    optimizerSteps: { generator: 576, discriminator: 576 }, checkpointSelectionEligible: false, weightUpdates: 0,
    validation: observations, metrics, datasetManifest }
  const worker = { ...id, schema: `${prefix}-quality-worker-terminal-v1`, executionState: 'failed_closed', status: 'failed_closed',
    completedEpochs: 12, optimizerStepsGenerator: 607, optimizerStepsDiscriminator: 608,
    originalError: { type: 'ValueError', message: 'actual four-term total gradient identity differs at parameter 48' },
    checkpoints: [], epochObservations: [entry], selectedCheckpointRecord: null, checkpointReloadVerified: false }
  const f = { id, outputRoot, config, plan, worker, entry, model, split, files, calls, bind, inlineOnly: false,
    sync() {
      plan.modelBinding = bind(`${outputRoot}/model-identity.json`, model)
      plan.validationSplit = bind('data/synthetic/validation.json', split)
      this.planBinding = bind(`${outputRoot}/quality-plan.json`, plan)
      this.envelope = { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: id.packageId,
        capabilityVersion: id.capabilityVersion, outputRoot,
        inputEvidence: [this.planBinding, plan.modelBinding, plan.datasetManifest, plan.validationSplit] }
      this.packageBinding = bind('.runtime/ai-painter/autonomous-closed-loop-packages/synthetic/package.json', this.envelope)
      worker.executionPackage = this.packageBinding
      Object.assign(entry, { executionPackage: this.packageBinding, planBinding: this.planBinding,
        modelBinding: plan.modelBinding, configurationSha256: previewIdentityHash(config) })
      return this.refresh()
    },
    refresh() {
      const saved = { ...entry }; delete saved.artifact
      if (this.inlineOnly) delete entry.artifact
      else entry.artifact = bind(`${outputRoot}/arbitrary-bound-observation.json`, this.saved ?? saved)
      this.terminalBinding = bind(`${outputRoot}/worker-terminal.json`, worker)
      return this
    },
    async readEvidenceJson(bound, maximum) {
      calls.push({ path: bound.path, maximum })
      if (this.readErrors?.has(bound.path)) throw this.readErrors.get(bound.path)
      const raw = files.get(bound.path)
      if (!raw) throw Object.assign(Error('missing'), { code: 'ENOENT' })
      requireFact(raw.length <= maximum, 'history_byte_limit', 413)
      requireFact(hash(raw) === bound.sha256, 'history_sha_mismatch')
      let value
      try { value = JSON.parse(raw) } catch { throw Error('history_json_invalid') }
      return { value, byteLength: raw.length, sha256: hash(raw) }
    },
    async run() {
      // Mirror the production verified terminal read, then the shared adapter.
      const terminal = (await this.readEvidenceJson(this.terminalBinding, 2097152)).value
      return adaptManagedTrainingDetail({ runId: id.runId, terminal,
        record: { runId: id.runId, terminalStatus: terminal.status, terminalBinding: this.terminalBinding,
          artifacts: structuredClone(this.initialArtifacts ?? []), metrics: structuredClone(this.initialMetrics ?? []),
          samples: [], checkpoints: [], qualification: {} },
        base: { unavailableFields: ['resolution', 'metrics', 'checkpoints', 'samples'] },
        readJson: async b => (await this.readEvidenceJson(b, 2097152)).value,
        readEvidenceJson: (b, maximum) => this.readEvidenceJson(b, maximum),
        makeArtifact: (role, b, metadata) => ({ role, logicalPath: b.path, sha256: b.sha256,
          artifactId: hash(JSON.stringify([id.runId, role, b.path, b.sha256])), ...metadata }),
        checkpointMetadata: async item => ({ ...item, byteLength: 123 }), requireFact })
    } }
  return f.sync()
}
const midpoint = detail => detail.record.metrics.filter(row => row.source === source)
const sampleMetrics = detail => midpoint(detail).filter(row => row.sampleId !== undefined)

for (const terrain of [false, true]) test(`projects eight midpoint rows and summary for ${terrain ? 'terrain v2' : 'object-support v1'}`, async () => {
  const f = fixture(terrain), before = [...f.files].map(([path, raw]) => [path, hash(raw)])
  const detail = await f.run(), { record } = detail
  assert.equal(sampleMetrics(detail).length, 8); assert.equal(midpoint(detail).length, 9)
  assert.equal(record.detailCoverage.availability.validationMetrics, 'available')
  assert.ok(!detail.unavailableFields.includes('metrics')); assert.ok(!detail.unavailableFields.includes('validationMetrics'))
  assert.equal(record.trainingStatus, 'failed_closed'); assert.equal(record.completedEpochs, 12)
  assert.deepEqual(record.optimizerSteps, { generator: 607, discriminator: 608 })
  assert.deepEqual(record.failureSummary, f.worker.originalError)
  assert.equal(record.selectedEpoch, undefined); assert.equal(record.reviewStatus, undefined)
  assert.equal(record.samples.length, 0); assert.equal(record.checkpoints.length, 0)
  for (const row of midpoint(detail)) {
    assert.equal(row.epoch, 12); assert.equal(row.optimizerStep, 576)
    assert.equal(row.sourcePath, f.entry.artifact.path); assert.equal(row.sourceSha256, f.entry.artifact.sha256)
    assert.equal(row.measurements.checkpointSelectionEligible, false); assert.equal(row.measurements.weightUpdates, 0)
  }
  assert.deepEqual(sampleMetrics(detail).map(row => row.sampleId), f.split.sampleIds)
  const evidence = record.artifacts.find(a => a.evidenceKind === source)
  assert.equal(evidence.role, 'evidence'); assert.equal(evidence.verificationStatus, 'bytes_verified')
  assert.match(evidence.sourceLabel, /中期.*非Checkpoint/u)
  assert.equal(record.qualification.checkpointPromotionEligible, false)
  assert.equal(record.qualification.formalQualificationAllowed, false); assert.equal(record.qualification.worldEntryAllowed, false)
  assert.equal(detail.dataStatus, 'partial'); assert.equal(record.detailCoverage.complete, false)
  assert.ok(f.calls.every(call => call.path.endsWith('.json') && call.maximum === 2097152))
  assert.ok(record.detailCoverage.jsonReads <= 16)
  assert.deepEqual([...f.files].map(([path, raw]) => [path, hash(raw)]), before)
})

test('inline observation without an artifact uses only the verified worker SHA, never a guessed file', async () => {
  const f = fixture(); f.inlineOnly = true; f.refresh()
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 8)
  assert.ok(midpoint(detail).every(row => row.sourcePath === f.terminalBinding.path && row.sourceSha256 === f.terminalBinding.sha256))
  assert.ok(!f.calls.some(call => call.path.includes('observation')))
  assert.ok(!detail.record.artifacts.some(a => a.logicalPath.includes('observation')))
})

for (const missing of [undefined, []]) test(`absent observations (${String(missing)}) remain not recorded`, async () => {
  const f = fixture(); f.worker.epochObservations = missing; f.refresh()
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.validationMetrics, 'not_recorded')
  assert.ok(detail.unavailableFields.includes('metrics'))
  assert.ok(!f.calls.some(call => call.path === f.entry.artifact.path))
})

for (const [name, change, state] of [
  ['missing file', f => f.files.delete(f.entry.artifact.path), 'missing'],
  ['changed bytes', f => f.files.set(f.entry.artifact.path, Buffer.from('{}')), 'hash_conflict'],
  ['oversized JSON', f => f.files.set(f.entry.artifact.path, Buffer.alloc(2097153)), 'over_limit'],
  ['missing model', f => f.files.delete(f.plan.modelBinding.path), 'missing'],
  ['changed model', f => f.files.set(f.plan.modelBinding.path, Buffer.from('{}')), 'hash_conflict'],
  ['missing membership', f => f.files.delete(f.plan.validationSplit.path), 'missing'],
  ['unreadable artifact', f => { f.readErrors = new Map([[f.entry.artifact.path, Object.assign(Error('denied'), { code: 'EACCES' })]]) }, 'unreadable'],
  ['invalid JSON', f => { const b = f.entry.artifact; const raw = Buffer.from('{'); f.files.set(b.path, raw); b.sha256 = hash(raw);
    f.terminalBinding = f.bind(`${f.outputRoot}/worker-terminal.json`, f.worker) }, 'unsupported_schema'],
]) test(`${name} keeps a specific gap and preserves failure evidence`, async () => {
  const f = fixture(); change(f)
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, state)
  assert.equal(detail.record.detailCoverage.availability.validationMetrics, state)
  assert.equal(detail.record.trainingStatus, 'failed_closed')
  assert.deepEqual(detail.record.optimizerSteps, { generator: 607, discriminator: 608 })
  assert.ok(!detail.record.artifacts.some(a => a.evidenceKind === source))
})

for (const [name, change, state = 'unreadable'] of [
  ['foreign inline Run', f => { f.entry.runId = 'foreign' }],
  ['foreign inline package', f => { f.entry.packageId = 'foreign' }],
  ['foreign capability', f => { f.entry.capabilityVersion = 'foreign' }],
  ['foreign model', f => { f.entry.modelCapabilityVersion = 'foreign' }],
  ['foreign model metadata', f => { f.model.capabilityVersion = 'foreign'; f.sync() }],
  ['configuration hash', f => { f.entry.configurationSha256 = 'f'.repeat(64) }],
  ['wrong plan hash', f => { f.entry.planBinding = { ...f.planBinding, sha256: 'f'.repeat(64) } }],
  ['wrong dataset hash', f => { f.entry.datasetManifest = { ...f.plan.datasetManifest, sha256: 'f'.repeat(64) } }],
  ['foreign execution package', f => { f.entry.executionPackage = { ...f.packageBinding, path: '.runtime/ai-painter/foreign/package.json' } }],
  ['foreign artifact root', f => { f.entry.artifact = { ...f.entry.artifact, path: '.runtime/ai-painter/foreign/observation.json' } }],
  ['path traversal', f => { f.entry.artifact = { ...f.entry.artifact, path: `${f.outputRoot}/../foreign.json` } }],
  ['selection eligibility', f => { f.entry.checkpointSelectionEligible = true }],
  ['observation weight updates', f => { f.entry.weightUpdates = 1 }],
  ['unplanned epoch', f => { f.entry.epoch = 24 }],
  ['incomplete epoch', f => { f.worker.completedEpochs = 11 }],
  ['wrong step', f => { f.entry.optimizerSteps.generator = 575 }],
  ['step beyond actual worker', f => { f.worker.optimizerStepsGenerator = 575 }],
  ['unknown observation schema', f => { f.entry.schemaVersion = 'future-v9' }, 'unsupported_schema'],
  ['unknown membership schema', f => { f.split.schemaVersion = 'future-v9'; f.sync() }, 'unsupported_schema'],
  ['foreign membership', f => { f.split.split = 'train'; f.sync() }, 'unsupported_schema'],
  ['duplicate membership', f => { f.split.sampleIds[1] = f.split.sampleIds[0]; f.sync() }, 'unsupported_schema'],
  ['over-count membership', f => { f.split.sampleIds.push('foreign'); f.sync() }, 'unsupported_schema'],
  ['unknown field', f => { f.entry.passed = true }, 'unsupported_schema'],
  ['unknown nested binding field', f => { f.entry.modelBinding = { ...f.entry.modelBinding, secret: 'never-projected' } }, 'unsupported_schema'],
  ['invalid array schema', f => { f.worker.epochObservations = {} }, 'unsupported_schema'],
  ['over-count', f => { f.worker.epochObservations = [f.entry, structuredClone(f.entry)] }, 'over_limit'],
  ['oversized validation', f => { f.entry.validation.push(structuredClone(f.entry.validation[0])) }, 'over_limit'],
  ['missing validation row', f => { f.entry.validation.pop() }, 'unsupported_schema'],
  ['duplicate sample', f => { f.entry.validation[1].sampleId = f.entry.validation[0].sampleId }, 'unsupported_schema'],
  ['foreign sample', f => { f.entry.validation[0].sampleId = 'foreign' }, 'unsupported_schema'],
  ['wrong split', f => { f.entry.validation[0].split = 'train' }, 'unsupported_schema'],
  ['wrong row epoch', f => { f.entry.validation[0].epoch = 24 }, 'unsupported_schema'],
  ['non-numeric metric', f => { f.entry.validation[0].fullRgbMae = '0.1' }, 'unsupported_schema'],
  ['non-finite metric', f => { f.entry.validation[0].fullRgbMae = Infinity }, 'unsupported_schema'],
  ['out-of-range correlation', f => { f.entry.validation[0].objectCorrelations.object_tree = 2 }, 'unsupported_schema'],
  ['unknown row field', f => { f.entry.validation[0].secret = 'never-projected' }, 'unsupported_schema'],
  ['qualification assertion', f => { f.entry.metrics.qualificationGranted = true }, 'unsupported_schema'],
  ['summary disagrees with rows', f => { f.entry.metrics.meanValidationRgbMae = 0.75 }, 'unsupported_schema'],
  ['foreign JSON Run', f => { f.saved = { ...f.entry, runId: 'foreign' }; delete f.saved.artifact }],
  ['foreign JSON package', f => { f.saved = { ...f.entry, packageId: 'foreign' }; delete f.saved.artifact }],
  ['unknown JSON schema', f => { f.saved = { ...f.entry, schema: 'future-v9' }; delete f.saved.artifact }, 'unsupported_schema'],
]) test(`rejects ${name} without inventing a checkpoint, review or metrics`, async () => {
  const f = fixture()
  // Refresh first, then apply any binding override without automatically fixing it.
  change(f)
  const overridden = f.entry.artifact
  f.refresh()
  if (['foreign artifact root', 'path traversal'].includes(name)) {
    f.entry.artifact = overridden; f.terminalBinding = f.bind(`${f.outputRoot}/worker-terminal.json`, f.worker)
  }
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, state)
  assert.equal(detail.record.checkpoints.length, 0); assert.equal(detail.record.reviewStatus, undefined)
  assert.equal(detail.record.selectedEpoch, undefined)
  assert.ok(!detail.record.artifacts.some(a => a.evidenceKind === source))
  assert.ok(f.calls.every(call => !call.path.startsWith('.runtime/ai-painter/foreign/')))
})

for (const corrupt of [false, true]) test(`${corrupt ? 'bad' : 'valid'} optional midpoint leaves final checkpoint validation and selection intact`, async () => {
  const f = fixture()
  const cp = { epoch: 24, checkpoint: { path: `${f.outputRoot}/unread.pt`, sha256: hash('unread-checkpoint') },
    counts: { generator: 1152, discriminator: 1152 }, validation: f.entry.validation.map(row => ({ ...row, epoch: 24 })) }
  Object.assign(f.worker, { executionState: 'completed', status: 'training_completed_review_pending', completedEpochs: 24,
    optimizerStepsGenerator: 1152, optimizerStepsDiscriminator: 1152, checkpoints: [cp], selectedCheckpointRecord: cp })
  f.refresh()
  if (corrupt) f.files.set(f.entry.artifact.path, Buffer.from('{}'))
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, corrupt ? 0 : 8)
  assert.equal(detail.record.metrics.filter(row => row.epoch === 24).length, 8)
  assert.equal(detail.record.selectedEpoch, 24); assert.equal(detail.record.checkpoints.length, 1)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, corrupt ? 'hash_conflict' : 'available')
  assert.equal(detail.record.detailCoverage.availability.validationMetrics, 'available')
  assert.ok(!f.calls.some(call => call.path.endsWith('.pt')))
})

test('null artifact binding does not silently fall back to the inline observation', async () => {
  const f = fixture(); f.entry.artifact = null
  f.terminalBinding = f.bind(`${f.outputRoot}/worker-terminal.json`, f.worker)
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, 'unsupported_schema')
})

for (const duplicate of [false, true]) test(`${duplicate ? 'duplicate' : 'missing'} signed model parent is refused`, async () => {
  const f = fixture()
  f.envelope.inputEvidence = f.envelope.inputEvidence.filter(input => input.path !== f.plan.modelBinding.path)
  if (duplicate) f.envelope.inputEvidence.push(f.plan.modelBinding, f.plan.modelBinding)
  f.packageBinding = f.bind(f.packageBinding.path, f.envelope)
  f.worker.executionPackage = f.packageBinding; f.entry.executionPackage = f.packageBinding; f.refresh()
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, 'unreadable')
  assert.ok(!f.calls.some(call => call.path === f.plan.modelBinding.path))
})

for (const kind of ['metrics', 'artifacts']) test(`retains existing ${kind} and refuses midpoint overflow atomically`, async () => {
  const f = fixture()
  if (kind === 'metrics') f.initialMetrics = Array.from({ length: 1016 }, () => ({ source: 'existing' }))
  else f.initialArtifacts = Array.from({ length: 254 }, (_, i) => ({ role: 'evidence', logicalPath: `data/existing-${i}.json`, sha256: hash(`existing-${i}`) }))
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, 'over_limit')
  assert.ok(!detail.record.artifacts.some(a => a.evidenceKind === source))
  assert.ok(detail.record.detailCoverage.jsonReads <= 16)
  if (kind === 'metrics') assert.equal(detail.record.metrics.filter(row => row.source === 'existing').length, 1016)
})

test('old configuration with no midpoint keeps checkpoint behavior; cannot borrow new observation ABI', async () => {
  const f = fixture(true); f.config.schema = 'ecology-terrain-detail-weight-quality-configuration-v1'; f.sync()
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, 'unsupported_schema')
  assert.ok(!f.calls.some(call => call.path === f.entry.artifact.path))
})

test('unversioned legacy configuration cannot accidentally match an absent midpoint protocol', async () => {
  const f = fixture(); delete f.config.schema
  f.worker.schema = 'detail-weight-managed-worker-terminal-v1'; f.plan.schema = 'detail-weight-managed-plan-v1'
  f.planBinding = f.bind(`${f.outputRoot}/detail-weight-plan.json`, f.plan)
  f.envelope.inputEvidence = [f.planBinding, f.plan.modelBinding, f.plan.datasetManifest, f.plan.validationSplit]
  f.packageBinding = f.bind(f.packageBinding.path, f.envelope)
  f.worker.executionPackage = f.packageBinding
  Object.assign(f.entry, { executionPackage: f.packageBinding, planBinding: f.planBinding,
    configurationSha256: previewIdentityHash(f.config) })
  f.refresh()
  const detail = await f.run()
  assert.equal(sampleMetrics(detail).length, 0)
  assert.equal(detail.record.detailCoverage.availability.epochObservations, 'unsupported_schema')
  assert.ok(!f.calls.some(call => call.path === f.entry.artifact.path))
})

// Opt-in exact production Run read: uses the existing query, section and artifact
// readers. No server startup, index refresh, image reads or registry writes.
test('exact real Run exposes eight midpoint rows through existing history readers, read-only', {
  skip: !process.env.AI_CONSOLE_HISTORY_MIDPOINT_RUN_ID,
}, async t => {
  const runId = process.env.AI_CONSOLE_HISTORY_MIDPOINT_RUN_ID
  assert.match(runId, /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/u)
  const { readTrainingRun, readTrainingRunSection, readTrainingArtifact } = await import('../../src/server/ai-console/training-history-store.mjs')
  const registryPath = '.runtime/ai-painter/current-execution-registry/current.json'
  const registry = await bytes(process.cwd(), registryPath, 2097152)
  const detail = await readTrainingRun(runId), { record } = detail
  const rows = sampleMetrics(detail)
  assert.equal(rows.length, 8); assert.equal(record.detailCoverage.availability.validationMetrics, 'available')
  assert.equal(record.trainingStatus, 'failed_closed'); assert.equal(record.completedEpochs, 12)
  assert.deepEqual(record.optimizerSteps, { generator: 607, discriminator: 608 })
  assert.equal(record.checkpoints.length, 0); assert.equal(record.selectedEpoch, undefined)
  assert.equal(record.qualification.checkpointPromotionEligible, false)
  const pages = []; let cursor = null
  do {
    const page = await readTrainingRunSection(runId, { section: 'metrics', limit: 3, cursor })
    pages.push(...page.items); cursor = page.nextCursor
  } while (cursor)
  assert.deepEqual(pages.filter(row => row.source === source), midpoint(detail))
  const evidence = record.artifacts.find(a => a.evidenceKind === source)
  assert.ok(evidence)
  const artifact = await readTrainingArtifact(runId, evidence.artifactId)
  assert.equal(artifact.json.sha256, evidence.sha256); assert.equal(artifact.json.verificationStatus, 'bytes_verified')
  assert.equal(artifact.json.truncated, false)
  const saved = JSON.parse(artifact.json.text)
  assert.deepEqual(saved.validation, rows.map(row => {
    const value = { ...row.measurements }; delete value.checkpointSelectionEligible; delete value.weightUpdates; return value
  }))
  assert.equal((await bytes(process.cwd(), registryPath, 2097152)).sha256, registry.sha256)
  t.diagnostic(JSON.stringify({ runId, rows: rows.length, sourcePath: evidence.logicalPath, sourceSha256: evidence.sha256,
    jsonReads: record.detailCoverage.jsonReads, checkpointBytesRead: record.detailCoverage.checkpointBytesRead,
    registryUnchanged: true, qualificationGranted: false }))
})
