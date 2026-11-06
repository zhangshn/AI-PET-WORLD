import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {createHistoricalWeatherFixture} from './helpers/historical-environment-qualification.mjs'
import { auditWorldEnvironmentEvidence, recomputeEnvironmentHoldout, ENVIRONMENT_EVIDENCE_MANIFEST }
  from '../lib/world-environment-evidence.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, ENVIRONMENT_EVIDENCE_MANIFEST)))
function bundle() {
  return Object.fromEntries(['evaluationContract', 'source', 'sourceReceipt', 'dataset', 'trainingDataset', 'evaluationResult', 'predictions', 'rollouts']
    .map(key => [{ evaluationContract: 'contract', sourceReceipt: 'receipt', evaluationResult: 'result' }[key] ?? key,
      JSON.parse(fs.readFileSync(path.join(root, manifest.roots[key])))]))
}
function fixture(t) {
  const result=createHistoricalWeatherFixture()
  t.after(result.cleanup)
  return result.fixture
}

test('actual fixed read-only audit verifies exact 81 references and recomputes all six criteria', t => {
  const result = auditWorldEnvironmentEvidence({ projectRoot: fixture(t) })
  assert.equal(result.referenceBytesVerified.count, 81)
  assert.equal(result.referenceBytesVerified.refs.length, 81)
  assert.deepEqual(Object.values(result.recomputedHoldout.conditions), Array(6).fill(true))
  assert.equal(result.recomputedHoldout.oneStep.candidate.count, 358)
  assert.equal(result.recomputedHoldout.aggregate.candidate153[30].candidate.count, 360)
  assert.equal(result.historicalIntegration.verifiedSavedForwardRecords, 5)
  assert.equal(result.historicalIntegration.consecutiveSavedSteps, 3)
  assert.ok(result.historicalIntegration.numericalHistoryDifference > 1e-9)
  assert.equal(result.formalWorld.tick, 0)
  assert.equal(result.coldStartStatus, 'not_proven_for_formal_world')
  assert.equal(result.productionAdmitted, false); assert.equal(result.modelForwards, 0)
  assert.equal(result.admission.registry.releaseCount, 0)
})

test('pure arithmetic ignores prior passed booleans and never grants production qualification', () => {
  const b = bundle()
  b.result.passConditions = Object.fromEntries(Object.keys(b.result.passConditions).map(k => [k, false]))
  b.result.temporalHoldoutPassed = false; b.result.productionReady = true
  const result = recomputeEnvironmentHoldout(b)
  assert.ok(Object.values(result.conditions).every(Boolean))
  assert.equal(result.productionAdmitted, false)
})

test('semantic checks reject wrong model, fields, units, region, dates and source values', () => {
  const cases = [
    b => { b.contract.candidateCheckpoint.sha256 = '0'.repeat(64) },
    b => { b.result.parentCheckpoint.sha256 = '0'.repeat(64) },
    b => { b.contract.source.units[1] = 'fraction' },
    b => { b.dataset.units[2] = 'K' },
    b => { b.source.parameters.WS2M.units = 'km/h' },
    b => { b.contract.source.latitude = 15 },
    b => { b.source.geometry.coordinates[0] = 102 },
    b => { b.receipt.parameters.longitude = '0' },
    b => { b.dataset.windows[0].historyDates[6] = '20250108' },
    b => { b.dataset.windows[0].target[0] = 3 },
    b => { b.contract.data.historyDays = 1 },
    b => { b.predictions.rows[0].candidate153.prediction[0] = Number.NaN },
    b => { b.rollouts.trajectories[0].candidate153.steps.pop() },
    b => { b.rollouts.trajectories[1].originDate = b.rollouts.trajectories[0].originDate },
    b => { b.result.normalizer.std[0] *= 2 },
    b => { b.predictions.rows[0].candidate153.prediction[0] += 100 },
  ]
  for (const mutate of cases) { const b = bundle(); mutate(b); assert.throws(() => recomputeEnvironmentHoldout(b), /environment_evidence_/) }
})

test('entry rejects arbitrary paths and caller qualification flags before reading', () => {
  for (const key of ['read', 'manifestPath', 'checkpointPath', 'passed', 'productionAdmitted'])
    assert.throws(() => auditWorldEnvironmentEvidence({ projectRoot: 'does-not-exist', [key]: true }), /environment_evidence_options/)
  assert.throws(() => auditWorldEnvironmentEvidence({ get projectRoot() { throw Error('getter executed') } }), /options_accessor/)
})

test('tampered original output or checkpoint bytes fail, no result can grant qualification', t => {
  const temporary = fixture(t), original = path.join(temporary, manifest.roots.checkpoint)
  const bytes = fs.readFileSync(original); bytes[bytes.length - 1] ^= 1; fs.writeFileSync(original, bytes)
  assert.throws(() => auditWorldEnvironmentEvidence({ projectRoot: temporary }), /reference_sha:/)
  fs.copyFileSync(path.join(root, manifest.roots.checkpoint), original)
  const resultPath = path.join(temporary, manifest.roots.evaluationResult)
  const raw = fs.readFileSync(resultPath, 'utf8').replace('0.34482714887127186', '0.00000000000000000')
  fs.writeFileSync(resultPath, raw)
  assert.throws(() => auditWorldEnvironmentEvidence({ projectRoot: temporary }), /reference_sha:/)
})

test('manifest path escape, self-asserted references and nested junctions cannot redirect reads', t => {
  const temporary = fixture(t), manifestPath = path.join(temporary, ENVIRONMENT_EVIDENCE_MANIFEST)
  const bad = structuredClone(manifest); bad.refs[0].path = '../outside'; bad.productionAdmitted = true
  fs.writeFileSync(manifestPath, JSON.stringify(bad))
  assert.throws(() => auditWorldEnvironmentEvidence({ projectRoot: temporary }), /manifest_sha/)
  fs.copyFileSync(path.join(root, ENVIRONMENT_EVIDENCE_MANIFEST), manifestPath)
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'environment-evidence-162-outside-'))
  t.after(() => {
    assert.ok(path.resolve(outside).startsWith(path.resolve(os.tmpdir()) + path.sep + 'environment-evidence-162-outside-'))
    fs.rmSync(outside, { recursive: true, force: true })
  })
  const modelDirectory = path.dirname(path.join(temporary, manifest.roots.checkpoint))
  assert.ok(modelDirectory.startsWith(temporary + path.sep))
  fs.rmSync(modelDirectory, { recursive: true })
  fs.symlinkSync(outside, modelDirectory, process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => auditWorldEnvironmentEvidence({ projectRoot: temporary }), /linked_path/)
})
