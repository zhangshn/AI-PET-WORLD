import test from 'node:test'
import assert from 'node:assert/strict'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'

const runId = 'v21-train-only-test'
const binding = path => ({ path, sha256: 'a'.repeat(64) })
const ids = ['train-a', 'train-b']

function fixture() {
  const packageBinding = binding('experiment/package.json')
  const resultBinding = binding('experiment/result.json')
  const selectedRows = ids.map(id => ({ sampleId: id, split: 'train', image: binding(`original/${id}.png`), conditionPack: binding(`condition/${id}.json`) }))
  const images = []
  const observations = [0, 128, 256, 512].map(step => ({ optimizerStep: step, trainOnly: ids.map(id => {
    const row = { sampleId: id, split: 'train', rgbMae: 0.1, objectRoleLumaCorrelation: {} }
    if (step === 0 || step === 512) { row.predictionPng = binding(`experiment/${id}-${step}.png`); images.push(row.predictionPng) }
    if (step === 512) { row.targetStep0FinalContactSheetPng = binding(`experiment/${id}-comparison.png`); images.push(row.targetStep0FinalContactSheetPng) }
    return row
  }) }))
  const request = { schemaVersion: 'ai-painter-v21-train-only-capacity-package-v1', experimentIdentity: runId, selectedRows }
  const result = { experimentIdentity: runId, status: 'experiment_executed_not_visual_qualified', stage4QualificationGranted: false,
    checkpointPromotable: false, validationContentRead: false, challengeContentRead: false, regressionContentRead: false,
    optimizerSteps: { generator: 512, discriminator: 512 }, trainOnlyObservations: observations,
    artifacts: [...images, binding('experiment/final-step.pt')] }
  const terminal = { schemaVersion: 'ai-painter-learning-capacity-experiment-terminal-v1', result: resultBinding }
  const capsuleBinding = { ...binding('experiment/capsule.json'), taskId: runId }
  const capsule = { schemaVersion: 'ai-painter-local-task-capsule-v1', taskId: runId, integrity: { status: 'verified' }, evidence: [{ ...packageBinding, kind: 'experiment_0', sha256Verified: true }] }
  const files = new Map([[packageBinding.path, request], [resultBinding.path, result], [capsuleBinding.path, capsule]])
  const input = { runId, terminal, record: { artifacts: [], samples: [], metrics: [], checkpoints: [] }, base: { unavailableFields: [] }, capsuleBinding,
    readJson: async item => files.get(item.path),
    makeArtifact: (role, item, metadata = {}) => ({ role, logicalPath: item.path, sha256: item.sha256, ...metadata }),
    checkpointMetadata: async item => item,
    requireFact: (condition, code) => { if (!condition) throw new Error(code) } }
  return { input, result }
}

test('V21 train-only images and metrics keep explicit sample and step identity', async () => {
  const { input } = fixture()
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.record.samples.length, 2)
  assert.equal(detail.record.metrics.length, 8)
  assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 6)
  assert.equal(detail.record.artifacts.find(item => item.logicalPath === 'experiment/train-a-512.png').optimizerSteps, 512)
  assert.equal(detail.record.optimizerSteps, 512)
  assert.equal(detail.record.qualification.formalStageQualified, false)
})

test('V21 train-only mismatched image binding fails closed', async () => {
  const { input, result } = fixture()
  result.trainOnlyObservations[3].trainOnly[0].predictionPng = { ...result.trainOnlyObservations[3].trainOnly[0].predictionPng, sha256: 'b'.repeat(64) }
  await assert.rejects(adaptLegacyTrainingDetail(input), /history_v21_image_artifact_missing/)
})
