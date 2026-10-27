import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { adaptSingleMapTraining } from '../../src/server/ai-console/single-map-training-history.mjs'

function fixture() {
  const runId = 'single-map-fixture', outputRoot = `.runtime/ai-painter/learning-capacity-experiments/${runId}`
  const docs = new Map()
  const put = (name, value) => {
    const bytes = JSON.stringify(value), path = outputRoot + '/' + name
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    docs.set(path, { bytes, sha256 }); return { path, sha256 }
  }
  const image = put('reference.png', 'synthetic-image'), final = put('output.png', 'synthetic-output')
  const cp = put('checkpoint.pt', 'synthetic-checkpoint')
  const observation = put('observation.json', { step: 1, sampleId: 'sample', optimizerSteps: { generator: 1, discriminator: 1 },
    prediction: final, metrics: { fullRgbMae: 0.04 }, recordedAtUtc: '2026-10-25T15:17:55Z' })
  const learning = put('learning.json', { step: 1, sampleId: 'sample', optimizerSteps: { generator: 1, discriminator: 1 },
    values: { generatorLoss: 0.1 }, measurementScope: 'original_pre_update_objectives_for_successfully_committed_pair' })
  const result = { experimentIdentity: runId, status: 'experiment_executed_not_visual_qualified', formalQualificationGranted: false,
    optimizerSteps: { generator: 1, discriminator: 1 }, checkpointReloadExact: true, artifacts: [observation, learning, final, cp] }
  const request = { experimentIdentity: runId, outputRoot, qualificationGranted: false, selectedSampleId: 'sample',
    sampleIdentity: { sampleId: 'sample', split: 'train', image }, training: { pairs: 1, observations: [1] },
    sourcePlan: put('plan.json', { configuration: { scope: { resolution: [256, 192] } } }) }
  const terminal = { runId, experimentIdentity: runId, executionState: 'completed', status: 'experiment_completed_not_formal_qualified',
    formalTrainingQualified: false, checkpointPromotable: false, worldEntryAllowed: false, actualFinalOptimizerSteps: { generator: 1, discriminator: 1 } }
  const run = async () => {
    terminal.result = put('result.json', result)
    return adaptSingleMapTraining({ runId, request, terminal, base: { unavailableFields: ['resolution'] },
      record: { samples: [], metrics: [], checkpoints: [], artifacts: [] },
      readJson: async b => { const d = docs.get(b.path); assert.equal(d?.sha256, b.sha256, 'hash mismatch'); return JSON.parse(d.bytes) },
      makeArtifact: (role, b, metadata) => ({ role, ...b, ...metadata }), checkpointMetadata: async item => item,
      requireFact: (ok, reason) => { if (!ok) throw new Error(reason) } })
  }
  return { run, request, result, terminal, put, observation, learning, final }
}

test('frozen single-map protocol exposes exact images, measured steps and metrics without qualification', async () => {
  const f = fixture(), d = await f.run()
  assert.equal(d.dataStatus, 'connected'); assert.equal(d.record.samples.length, 1)
  assert.equal(d.record.metrics.length, 2); assert.equal(d.record.checkpoints.length, 1)
  assert.equal(d.record.artifacts.find(x => x.role === 'output').optimizerSteps, 1)
  assert.equal(d.record.qualification.formalStageQualified, false)
  assert.deepEqual(d.record.resolution, { width: 256, height: 192 })
})
test('unbound images, another sample, changed hashes and duplicate steps are rejected', async () => {
  let f = fixture(); f.result.artifacts = f.result.artifacts.filter(x => x !== f.final)
  await assert.rejects(f.run(), /image_binding_conflict/)
  f = fixture(); f.request.sampleIdentity.split = 'validation'; await assert.rejects(f.run(), /sample_conflict/)
  f = fixture(); f.observation.sha256 = '0'.repeat(64); await assert.rejects(f.run(), /hash mismatch/)
  f = fixture(); f.result.artifacts.push(f.observation); await assert.rejects(f.run(), /artifact_conflict/)
  f = fixture(); f.result.artifacts = f.result.artifacts.filter(x => x !== f.learning)
  await assert.rejects(f.run(), /coverage_conflict/)
})
test('terminal steps, provenance root and qualification cannot be silently repaired by projection', async () => {
  let f = fixture(); f.terminal.actualFinalOptimizerSteps.generator = 0; await assert.rejects(f.run(), /terminal_steps_conflict/)
  f = fixture(); f.request.outputRoot += '/other'; await assert.rejects(f.run(), /root_conflict/)
  f = fixture(); f.result.formalQualificationGranted = true; await assert.rejects(f.run(), /status_conflict/)
})
