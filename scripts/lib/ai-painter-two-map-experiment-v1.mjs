// Exact experiment route and terminal checks; no publication or scheduling.
import assert from 'node:assert/strict'

export const twoMapCheckpointPolicy = 'data/ai-painter/system-governance/ai-painter-two-map-checkpoint-fit-policy-v1.json'
export const twoMapCheckpointSuccessorPolicy = 'data/ai-painter/system-governance/ai-painter-two-map-checkpoint-fit-policy-v2.json'
export const twoMapWorker = 'ml/ai-painter/scripts/painter_two_map_checkpoint_fit_v1.py'
export const twoMapTests = 'test_two_map_checkpoint_fit_v1.py'
export const twoMapSamples = ['ai-cold-start-v7-v7-capacity-slot-149-tropical-forest-glade-v3', 'mvp64-slot164-objects-v5-20261020']

export function twoMapExperimentSucceeded(result, pkg, code, timedOut) {
  try {
    assert.equal(code, 0)
    assert.equal(timedOut, false)
    assert([twoMapCheckpointPolicy, twoMapCheckpointSuccessorPolicy].includes(pkg.policy.path))
    assert.equal(pkg.schemaVersion, 'two-map-checkpoint-fit-package-v1')
    assert.deepEqual(pkg.selectedSampleIds, twoMapSamples)
    assert.equal(pkg.training.pairs, 200)
    assert.equal(pkg.training.visitsPerSample, 100)
    assert.equal(result.experimentIdentity, pkg.experimentIdentity)
    assert.equal(result.status, 'experiment_executed_not_visual_qualified')
    assert.equal(result.checkpointReloadExact, true)
    assert.equal(result.formalQualificationGranted, false)
    assert.deepEqual(result.optimizerSteps, { generator: 200, discriminator: 200 })
    assert.deepEqual(result.sampleVisits, Object.fromEntries(twoMapSamples.map(id => [id, 100])))
    assert(Array.isArray(result.artifacts))
    assert.equal(result.artifacts.filter(a => a.path === pkg.outputRoot + '/checkpoint-final.pt').length, 1)
    return true
  } catch { return false }
}
