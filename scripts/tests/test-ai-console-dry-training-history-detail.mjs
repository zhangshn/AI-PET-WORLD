import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const fakeSha = label => hash(label)
function fixture(options = {}) {
  const family = options.family ?? 'v26-v2', runId = `dry-${family}`, packageId = `package-${family}`
  const root = `.runtime/ai-painter/${runId}`, files = new Map(), reads = [], metadataReads = []
  const identity = { runId, packageId, capabilityVersion: `capability-${family}` }
  const bind = (logical, value) => { const bytes = Buffer.from(JSON.stringify(value)); files.set(logical, bytes); return { path: logical, sha256: hash(bytes) } }
  const imageBinding = label => ({ path: `${root}/${label}.png`, sha256: fakeSha(label) })
  const cpBinding = epoch => ({ path: `${root}/checkpoints/epoch-${epoch}.pt`, sha256: fakeSha(`cp-${epoch}`) })
  const candidateValue = { schemaVersion: 'stage4-mvp256-dry-v24-closed-loop-candidate-v1', scope: { resolution: [32, 24], subjectSampleId: 'a', subjectSplit: 'validation' } }
  const candidate = bind('data/dry-candidate.json', candidateValue)
  const membership = bind('data/validation.json', { split: 'validation', sampleIds: ['a', 'b'] })
  const packageValue = { ...identity, schemaVersion: `ai-painter-stage4-mvp256-dry-${family}-execution-package-v1`, outputRoot: root,
    sourceDataCandidate: candidate, validationSplit: membership,
    trainingPlan: { epochs: 4, generatorOptimizerSteps: 8, discriminatorOptimizerSteps: 7, validationRows: 2, eligibleCheckpointEpochs: [2, 4] } }
  options.package?.(packageValue)
  const executionPackage = bind(`${root}/execution-package.json`, packageValue)
  const observation = (sampleId, epoch) => ({ sampleId, split: 'validation', epoch, fullRgbMae: 0.1, objectCorrelations: { tree: 0.4 } })
  const workerValue = { ...identity, schemaVersion: `ai-painter-stage4-mvp256-dry-${family}-worker-terminal-v1`, executionPackage,
    executionState: 'completed', status: 'training_completed_review_pending', completedEpochs: 4, optimizerStepsGenerator: 8, optimizerStepsDiscriminator: 7,
    checkpoints: [2, 4].map(epoch => ({ epoch, selection: { epoch }, checkpoint: cpBinding(epoch), validation: ['a', 'b'].map(id => observation(id, epoch)) })),
    selectedEpoch: 2, selectedCheckpointBinding: cpBinding(2), checkpointReloadVerified: true }
  options.worker?.(workerValue)
  const workerTerminal = bind(`${root}/worker.json`, workerValue)
  const progressValue = { ...identity, schemaVersion: `ai-painter-stage4-mvp256-dry-${family}-progress-v1`, executionState: 'checkpoint_selected_review_pending',
    completedEpochs: 4, optimizerStepsGenerator: 8, optimizerStepsDiscriminator: 7, selectedCheckpoint: cpBinding(2) }
  options.progress?.(progressValue)
  const trainingProgress = bind(`${root}/progress.json`, progressValue)
  const terminal = { ...identity, schemaVersion: `ai-painter-mvp256-dry-${family}-training-lifecycle-v1`, executionState: 'completed',
    status: 'training_completed_review_pending', executionPackage, workerTerminal, trainingProgress, selectedCheckpoint: cpBinding(2), selectedEpoch: 2 }
  if (options.noWorker) { terminal.executionState = 'failed_closed'; terminal.status = 'training_failed_closed'; delete terminal.workerTerminal; delete terminal.trainingProgress; delete terminal.selectedCheckpoint }
  options.terminal?.(terminal)
  const terminalBinding = bind(`${root}/training-finalize.json`, terminal)
  const comparisonValue = { ...identity, schemaVersion: `ai-painter-mvp256-dry-${family}-cpu-review-v1`, executionPackage, trainingTerminal: terminalBinding,
    workerTerminal, selectedCheckpoint: cpBinding(2), selectedEpoch: 2,
    subject: { sampleId: 'a', split: 'validation', referenceRgb: { path: 'data/a-reference.png', sha256: fakeSha('original') } },
    originalRgb: imageBinding('original-small'), candidateRgb: imageBinding('a-output'),
    measurements: { completely_unrelated_baseline_label: { checkpoint: { path: '.runtime/ai-painter/foreign/old.pt', sha256: fakeSha('foreign') }, rows: [{ sampleId: 'foreign' }] },
      arbitrary_new_capability_label: { checkpoint: cpBinding(2), rows: ['a', 'b'].map(sampleId => ({ sampleId, observation: observation(sampleId, 2), image: imageBinding(`${sampleId}-output`) })) } } }
  options.comparison?.(comparisonValue)
  const cpuComparison = bind(`${root}/review/comparison.json`, comparisonValue)
  const auditValue = { schemaVersion: `ai-painter-mvp256-dry-${family}-independent-audit-v1`, runId, sampleId: 'a', selectedEpoch: 2,
    status: 'dry_single_world_review_failed_closed', input: cpuComparison, selectedCheckpoint: cpBinding(2), candidateRgb: imageBinding('a-output'),
    visualApprovalGranted: false, issueCodes: ['semantic_failure'], projection: imageBinding('alignment-projection') }
  options.audit?.(auditValue)
  const audit = bind(`${root}/review/audit.json`, auditValue)
  const reviewValue = { schemaVersion: `ai-painter-mvp256-dry-${family}-review-terminal-v1`, runId, packageId,
    status: 'dry_single_world_review_failed_closed', trainingTerminal: terminalBinding, selectedCheckpoint: cpBinding(2), cpuComparison, audit,
    visualApprovalGranted: false, formalStage4QualificationGranted: false, runtimePublicationGranted: false }
  options.review?.(reviewValue)
  const taskTerminalBinding = { ...bind(`${root}/review/terminal.json`, reviewValue), status: reviewValue.status }
  const record = { runId, terminalBinding, terminalStatus: terminal.status, artifacts: [], metrics: [], checkpoints: [], samples: [], qualification: {}, finishedAtUtc: null }
  const base = { unavailableFields: ['resolution', 'finishedAtUtc'], provenance: { evidenceReferences: [] } }
  const input = { runId, terminal, record, base, taskTerminalBinding: options.noReview ? undefined : taskTerminalBinding,
    requireFact: (condition, code, status = 409) => { if (!condition) throw Object.assign(new Error(code), { status }) },
    readJson: async bound => {
      reads.push(bound.path)
      if (options.overLimit === bound.path) throw Object.assign(new Error('history_byte_limit'), { status: 413 })
      const bytes = files.get(bound.path)
      if (!bytes) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      if (hash(bytes) !== bound.sha256) throw new Error('history_sha_mismatch')
      return JSON.parse(bytes)
    },
    makeArtifact: (role, bound, metadata = {}) => ({ artifactId: fakeSha(`${runId}:${role}:${bound.path}:${bound.sha256}`), role,
      logicalPath: bound.path, sha256: bound.sha256, url: `/api/ai-console/training/history/${runId}/artifacts/${fakeSha(`${runId}:${role}:${bound.path}:${bound.sha256}`)}`, ...metadata }),
    checkpointMetadata: async item => { metadataReads.push(item.logicalPath); return { ...item, byteLength: 1234 } },
  }
  return { input, files, reads, metadataReads, root, workerValue, comparisonValue }
}
test('dry v1 protocol exposes complete checkpoint validation, current images, originals and metadata without baseline contamination', async () => {
  const f = fixture(), detail = await adaptLegacyTrainingDetail(f.input), r = detail.record
  assert.equal(r.detailCoverage.supported, true); assert.equal(r.detailCoverage.adapter, 'bounded_dry_training_lifecycle_v1')
  assert.equal(r.metrics.length, 4); assert.equal(r.checkpoints.length, 2); assert.equal(r.samples.length, 2)
  assert.equal(r.artifacts.filter(a => a.role === 'output').length, 2)
  assert.equal(r.artifacts.filter(a => a.role === 'original').length, 2)
  assert.ok(r.metrics.every(row => row.sourceField === 'checkpoint.validation' && row.sourceSha256 === f.input.terminal.workerTerminal.sha256))
  assert.equal(r.metrics.find(row => row.epoch === 2 && row.sampleId === 'a').image.reviewCandidate, true)
  assert.equal(r.completedEpochs, 4); assert.equal(r.optimizerSteps, 8); assert.equal(r.discriminatorOptimizerSteps, 7)
  assert.deepEqual(r.resolution, { width: 32, height: 24 }); assert.equal(r.finishedAtUtc, null)
  assert.equal(r.terminalStatus, 'training_completed_review_pending'); assert.equal(r.reviewStatus, 'dry_single_world_review_failed_closed')
  assert.equal(r.machineReview.visualApprovalGranted, false); assert.equal(r.qualification.formalQualificationAllowed, false)
  assert.ok(r.checkpoints.every(cp => cp.metadataOnly && cp.verificationStatus === 'binding_verified_bytes_not_read'))
  assert.ok(!f.reads.some(p => p.endsWith('.pt'))); assert.equal(f.metadataReads.length, 2)
  assert.ok(!JSON.stringify(r.artifacts).includes('foreign')); assert.ok(detail.unavailableFields.includes('logs'))
  assert.equal(r.detailCoverage.availability.logs, 'not_recorded'); assert.ok(r.artifacts.every(a => a.url))
  assert.deepEqual(r.detailCoverage.originals.availableSampleIds, ['a'])
  assert.deepEqual(r.detailCoverage.originals.notRecordedSampleIds, ['b'])
  assert.equal(r.detailCoverage.originals.complete, false); assert.ok(detail.unavailableFields.includes('samples.original'))
})
for (const family of ['v24', 'v99', 'v999-v77']) test(`same dry protocol ${family} needs no model-name dispatch`, async () => {
  const detail = await adaptLegacyTrainingDetail(fixture({ family }).input)
  assert.equal(detail.record.metrics.length, 4); assert.equal(detail.record.artifacts.filter(a => a.role === 'output').length, 2)
})
test('failure before worker preserves package and gaps without fabricated counters, images or checkpoints', async () => {
  const f = fixture({ noWorker: true }), detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.dataStatus, 'partial'); assert.equal(detail.reasonCode, 'history_dry_detail_partial')
  assert.equal(detail.record.terminalStatus, 'training_failed_closed'); assert.equal(detail.record.metrics.length, 0)
  assert.equal(detail.record.checkpoints.length, 0); assert.equal(detail.record.samples.length, 0)
  assert.equal(detail.record.optimizerSteps, undefined); assert.ok(detail.unavailableFields.includes('workerTerminal'))
  assert.ok(!f.reads.some(p => p.includes('/review/')))
})
for (const [label, option, code] of [
  ['foreign worker Run', { worker: w => { w.runId = 'foreign' } }, /identity_conflict/],
  ['foreign package', { package: p => { p.packageId = 'foreign' } }, /identity_conflict/],
  ['foreign review Run', { review: r => { r.runId = 'foreign' } }, /identity_conflict/],
  ['foreign review package', { review: r => { r.packageId = 'foreign' } }, /identity_conflict/],
  ['foreign comparison', { comparison: c => { c.runId = 'foreign' } }, /identity_conflict/],
  ['foreign audit', { audit: a => { a.runId = 'foreign' } }, /audit_identity_conflict/],
  ['wrong review training parent', { review: r => { r.trainingTerminal = { ...r.trainingTerminal, sha256: fakeSha('wrong') } } }, /parent_binding_conflict/],
  ['wrong worker package backlink', { worker: w => { w.executionPackage = { ...w.executionPackage, sha256: fakeSha('wrong') } } }, /parent_binding_conflict/],
  ['wrong selected checkpoint', { terminal: t => { t.selectedCheckpoint = { ...t.selectedCheckpoint, sha256: fakeSha('wrong') } } }, /parent_binding_conflict/],
  ['conflicting worker checkpoint aliases', { worker: w => { w.selectedCheckpoint = { ...w.selectedCheckpointBinding, sha256: fakeSha('wrong') } } }, /parent_binding_conflict/],
  ['foreign metric sample', { worker: w => { w.checkpoints[0].validation[0].sampleId = 'foreign' } }, /metric_identity_conflict/],
  ['metric wrong split', { worker: w => { w.checkpoints[0].validation[0].split = 'train' } }, /metric_identity_conflict/],
  ['metric wrong epoch', { worker: w => { w.checkpoints[0].validation[0].epoch = 3 } }, /metric_identity_conflict/],
  ['image wrong epoch', { comparison: c => { c.measurements.arbitrary_new_capability_label.rows[0].observation.epoch = 4 } }, /image_identity_conflict/],
  ['image wrong split', { comparison: c => { c.measurements.arbitrary_new_capability_label.rows[0].observation.split = 'train' } }, /image_identity_conflict/],
  ['image foreign sample', { comparison: c => { c.measurements.arbitrary_new_capability_label.rows[0].sampleId = 'foreign' } }, /image_identity_conflict/],
  ['candidate image hash differs', { comparison: c => { c.candidateRgb.sha256 = fakeSha('wrong') } }, /parent_binding_conflict/],
  ['subject differs from frozen candidate', { comparison: c => { c.subject.sampleId = 'b' } }, /subject_conflict/],
  ['optimizer overflow', { worker: w => { w.optimizerStepsGenerator = 9 } }, /plan_conflict/],
  ['D overflow', { worker: w => { w.optimizerStepsDiscriminator = 8 } }, /plan_conflict/],
  ['too many checkpoint epochs', { package: p => { p.trainingPlan.eligibleCheckpointEpochs = Array(33).fill(2) } }, /plan_limit/],
  ['too many checkpoint records', { worker: w => { w.checkpoints = Array(33).fill(w.checkpoints[0]) } }, /checkpoint_limit/],
  ['too many metrics', { worker: w => { w.checkpoints[0].validation = Array(3).fill(w.checkpoints[0].validation[0]) } }, /metric_limit/],
  ['unknown worker protocol', { worker: w => { w.schemaVersion += '-future' } }, /schema_conflict/],
  ['duplicate comparison arms', { comparison: c => { c.measurements.duplicate = c.measurements.arbitrary_new_capability_label } }, /comparison_conflict/],
  ['wrong final progress counts', { progress: p => { p.optimizerStepsGenerator = 6 } }, /progress_conflict/],
]) test(`dry ${label} rejects authenticated conflicting evidence`, async () => {
  await assert.rejects(adaptLegacyTrainingDetail(fixture(option).input), code)
})
test('wrong actual JSON SHA fails closed instead of using parsed evidence', async () => {
  const f = fixture(); f.input.terminal.executionPackage.sha256 = fakeSha('wrong-bytes')
  await assert.rejects(adaptLegacyTrainingDetail(f.input), /history_sha_mismatch/)
})
test('missing bound worker file yields an explicit local gap', async () => {
  const f = fixture(); f.files.delete(f.input.terminal.workerTerminal.path)
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.detailCoverage.availability.workerTerminal, 'missing'); assert.equal(detail.record.metrics.length, 0)
})
test('missing review binding preserves training validation and Checkpoint metadata', async () => {
  const f = fixture({ noReview: true }), detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.metrics.length, 4); assert.equal(detail.record.checkpoints.length, 2)
  assert.equal(detail.record.artifacts.filter(a => a.role === 'output').length, 0)
  assert.ok(detail.unavailableFields.includes('machineReview')); assert.ok(detail.unavailableFields.includes('candidateImages'))
})
test('missing selected checkpoint binding cannot borrow review pictures', async () => {
  const f = fixture({ terminal: t => { delete t.selectedCheckpoint } }), detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.metrics.length, 4); assert.ok(detail.unavailableFields.includes('selectedCheckpoint'))
  assert.equal(detail.record.artifacts.filter(a => a.role === 'output').length, 0)
})
test('worker image requires explicit purpose, sample, split and checkpoint epoch', async () => {
  const f = fixture({ noReview: true, worker: w => { w.images = [{ ...{ path: '.runtime/ai-painter/dry-v26-v2/worker-image.png', sha256: fakeSha('image') }, sampleId: 'a', split: 'validation', epoch: 2, purpose: 'prediction' }] } })
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.artifacts.filter(a => a.role === 'output').length, 1)
  await assert.rejects(adaptLegacyTrainingDetail(fixture({ worker: w => { w.images = [{ sampleId: 'a', split: 'validation', epoch: 2, purpose: 'invented' }] } }).input), /image_purpose_conflict/)
})
test('more than 128 images and more than 256 artifacts are bounded', async () => {
  await assert.rejects(adaptLegacyTrainingDetail(fixture({ worker: w => { w.images = Array(129).fill({}) } }).input), /image_limit/)
  const f = fixture(); f.input.record.artifacts = Array(256).fill({ role: 'registered_evidence' })
  await assert.rejects(adaptLegacyTrainingDetail(f.input), /history_record_limit/)
  assert.equal(f.reads.length, 0) // Full initial record is rejected before reading anything.
})
test('missing subject original remains unavailable without borrowing resized reference or guessing other samples', async () => {
  const f = fixture({ comparison: c => { delete c.subject.referenceRgb } }), detail = await adaptLegacyTrainingDetail(f.input)
  assert.deepEqual(detail.record.detailCoverage.originals.availableSampleIds, [])
  assert.deepEqual(detail.record.detailCoverage.originals.notRecordedSampleIds, ['a', 'b'])
  assert.equal(detail.record.samples[0].original, null)
  assert.ok(detail.record.artifacts.some(a => a.purpose === 'resized_review_reference'))
})
test('per-source byte limit stays explicit without dropping verified package identity', async () => {
  const f = fixture({ overLimit: '.runtime/ai-painter/dry-v26-v2/worker.json' }), detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.detailCoverage.availability.workerTerminal, 'over_limit')
  assert.equal(detail.record.metrics.length, 0); assert.equal(detail.dataStatus, 'partial')
})
test('dry adapter has no filesystem, process, directory discovery or write dependency', () => {
  const source = readFileSync(new URL('../../src/server/ai-console/training-history-detail-adapters.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /^import\s/m)
  assert.doesNotMatch(source, /(?:readdir|writeFile|mkdir|execFile|spawn|DatabaseSync)\s*\(/)
})
