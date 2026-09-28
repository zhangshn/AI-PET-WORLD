import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function fixture({ tamperCandidate = false, nativeRgb = false, genericLifecycle = false, v13 = false } = {}) {
  const runId = 'mvp-stage0-fixture'
  const values = new Map()
  const bind = (path, value) => {
    const binding = { path, sha256: hash(value) }
    values.set(path, value)
    return binding
  }
  const executionPackage = bind('.runtime/fixture/execution-package.json', { schemaVersion: 'fixture-package-v1', runId })
  const checkpoint = { path: '.runtime/fixture/stage0.pt', sha256: 'a'.repeat(64) }
  const phase = bind('.runtime/fixture/phase-terminal.json', {
    schemaVersion: genericLifecycle
      ? 'ai-painter-stage4-mvp-stage0-training-terminal-v1'
      : nativeRgb
      ? 'ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-terminal-v1'
      : 'ai-painter-stage4-mvp-denoiser-stage0-terminal-v1', runId,
    status: 'training_completed_review_pending', executionPackage, checkpoint,
    optimizerSteps: 1920, selectedEpoch: 38, checkpointReloadVerified: true,
    stagePassed: false, machineReviewPending: true, recordedAtUtc: '2026-09-23T19:53:30Z',
  })
  const candidates = Array.from({ length: 2 }, (_, index) => ({
    sampleIndex: index, sampleId: `sample-${index}`, split: 'validation',
    seed: nativeRgb ? null : 2000 + index,
    ...(nativeRgb ? { artifactIdentity: { inferenceMode: v13 ? 'bound_instance_objects_to_complete_rgb' : 'deterministic_condition_to_complete_rgb',
      ...(v13 ? { candidateRgb: { path: `.runtime/fixture/candidate-${index}.png`, sha256: String(index + 1).repeat(64) } } : {}) } } : {}),
    candidateRgb: { path: `.runtime/fixture/candidate-${index}.png`, sha256: String(index + 1).repeat(64), width: 256, height: 192 },
    referenceRgb: { path: `data/fixture/reference-${index}.png`, sha256: String(index + 3).repeat(64) },
    conditionPack: { path: `.runtime/fixture/condition-${index}.json`, sha256: String(index + 5).repeat(64) },
    rolloutMetrics: { rolloutRgbMae: 0.1 + index },
  }))
  const manifest = bind('.runtime/fixture/candidate-manifest.json', {
    schemaVersion: 'ai-painter-stage4-mvp-stage0-review-candidate-pack-v1', runId,
    trainingTerminal: phase, checkpoint, selectedEpoch: 38, candidateCount: candidates.length, candidates,
  })
  const reviews = candidates.map((candidate, index) => ({
    sampleIndex: index, sampleId: candidate.sampleId,
    candidateRgb: tamperCandidate && index === 0 ? { ...candidate.candidateRgb, sha256: 'f'.repeat(64) } : candidate.candidateRgb,
    passed: false, issueCodes: [`issue-${index}`], professionalAesthetic: { passed: true }, conditionAlignment: { passed: false },
  }))
  const review = bind('.runtime/fixture/review.json', {
    schemaVersion: v13 ? 'stage4-mvp-v13-stage0-formal-machine-review-v1' : 'ai-painter-stage4-mvp-stage0-machine-review-v1', runId,
    candidateManifest: manifest, trainingTerminal: phase, checkpoint,
    executionPackage, candidateCount: reviews.length,
    reviews: v13 ? reviews.map((row, index) => ({ ...row, passed: undefined, semanticAndAestheticPassed: false,
      minimumDetailPassed: false, referenceRgb: candidates[index].referenceRgb, conditionPack: candidates[index].conditionPack,
      minimumDetail: { passed: false } })) : reviews,
  })
  const reviewTerminalValue = {
    schemaVersion: 'ai-painter-stage4-mvp-stage0-machine-review-terminal-v1', runId,
    status: 'stage4_mvp_stage0_machine_review_failed', sourceTrainingTerminal: phase,
    candidateManifest: manifest, machineReview: review, checkpoint,
    candidateCount: 2, candidatePassCount: 0, candidateFailCount: 2,
    issueHistogram: { issue: 2 }, stagePassed: false, checkpointPromotionEligible: false,
    stage1InitializationEligible: false, recordedAtUtc: '2026-09-23T19:55:51Z',
  }
  const taskTerminalBinding = bind('.runtime/fixture/review-terminal.json', reviewTerminalValue)
  taskTerminalBinding.status = reviewTerminalValue.status
  const terminal = {
    schemaVersion: genericLifecycle
      ? 'ai-painter-stage4-mvp-stage0-training-lifecycle-v1'
      : nativeRgb
      ? 'ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-lifecycle-v1'
      : 'ai-painter-stage4-mvp-denoiser-stage0-lifecycle-v1', runId,
    status: 'training_completed_review_pending', stage: { width: 256, height: 192 },
    executionPackage, workerTerminal: phase, checkpoint,
  }
  const artifacts = []
  const record = { runId, terminalStatus: terminal.status, artifacts, samples: [], metrics: [], checkpoints: [], qualification: {}, finishedAtUtc: null }
  const base = { dataStatus: 'connected', unavailableFields: ['resolution'] }
  return {
    runId, terminal, record, base, taskTerminalBinding,
    readJson: async binding => values.get(binding.path),
    makeArtifact: (role, binding, metadata = {}) => ({ artifactId: hash([role, binding.path, binding.sha256]), role, logicalPath: binding.path, sha256: binding.sha256, ...metadata }),
    checkpointMetadata: async item => ({ ...item, byteLength: 1234 }),
    requireFact: (value, code) => { if (!value) throw new Error(code) },
  }
}

test('MVP Stage0 history exposes exact candidate/reference pairs and failed review facts', async () => {
  const result = await adaptLegacyTrainingDetail(fixture())
  assert.equal(result.dataStatus, 'connected')
  assert.equal(result.reasonCode, null)
  assert.deepEqual(result.record.resolution, { width: 256, height: 192 })
  assert.equal(result.record.optimizerSteps, 1920)
  assert.equal(result.record.artifacts.filter(item => item.role === 'output').length, 2)
  assert.equal(result.record.artifacts.filter(item => item.role === 'original').length, 2)
  assert.equal(result.record.artifacts.filter(item => item.role === 'output').every(item => item.passed === false), true)
  assert.equal(result.record.metrics.length, 2)
  assert.equal(result.record.checkpoints.length, 1)
  assert.equal(result.record.terminalStatus, 'stage4_mvp_stage0_machine_review_failed')
  assert.equal(result.record.detailCoverage.candidateCount, 2)
})

test('MVP Stage0 history rejects review image hash disagreement', async () => {
  await assert.rejects(adaptLegacyTrainingDetail(fixture({ tamperCandidate: true })), /history_mvp_stage0_candidate_binding_conflict/)
})

test('MVP native RGB Stage0 history exposes deterministic candidates without fake seeds', async () => {
  const result = await adaptLegacyTrainingDetail(fixture({ nativeRgb: true }))
  assert.equal(result.dataStatus, 'connected')
  assert.equal(result.record.runKind, 'mvp_native_rgb_stage0_training')
  assert.equal(result.record.artifacts.filter(item => item.role === 'output').length, 2)
  assert.equal(result.record.artifacts.filter(item => item.role === 'output').every(item => item.seed === undefined), true)
  assert.equal(result.record.artifacts.filter(item => item.role === 'output').every(item => item.inferenceMode === 'deterministic_condition_to_complete_rgb'), true)
})

test('MVP generic Stage0 lifecycle accepts a new deterministic capability without version patching', async () => {
  const result = await adaptLegacyTrainingDetail(fixture({ nativeRgb: true, genericLifecycle: true }))
  assert.equal(result.dataStatus, 'connected')
  assert.equal(result.record.runKind, 'mvp_native_rgb_stage0_training')
  assert.equal(result.record.detailCoverage.adapter, 'mvp_native_rgb_stage0_lifecycle_v1')
  assert.equal(result.record.detailCoverage.candidateCount, 2)
})

test('failed Stage0 terminal retains identity and evidence without pretending artifacts were recorded', async () => {
  const input = fixture()
  input.terminal.status = 'formal_stage0_failed_closed'
  input.terminal.executionState = 'failed_closed'
  delete input.terminal.workerTerminal
  delete input.terminal.checkpoint
  input.record.terminalStatus = input.terminal.status
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.dataStatus, 'partial')
  assert.equal(detail.reasonCode, 'history_failed_before_artifact_registration')
  assert.equal(detail.record.terminalStatus, 'formal_stage0_failed_closed')
  assert.ok(detail.unavailableFields.includes('metrics'))
  assert.equal(detail.record.checkpoints.length, 0)
  assert.ok(detail.record.artifacts.some(item => item.evidenceKind === 'execution_package'))
})

test('V13 review uses its explicit package and three image bindings, preserving failure', async () => {
  const detail = await adaptLegacyTrainingDetail(fixture({ nativeRgb: true, genericLifecycle: true, v13: true }))
  assert.equal(detail.dataStatus, 'connected')
  assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 2)
  assert.ok(detail.record.artifacts.filter(item => item.role === 'output').every(item => item.passed === false))
  assert.equal(detail.record.metrics[0].machineReview.minimumDetail.passed, false)
  assert.equal(detail.record.finishedAtUtc, null) // A recording timestamp is not a finish time.
})

test('V13 still rejects a changed candidate hash', async () => {
  await assert.rejects(adaptLegacyTrainingDetail(fixture({ nativeRgb: true, genericLifecycle: true, v13: true, tamperCandidate: true })), /candidate_binding_conflict/)
})
