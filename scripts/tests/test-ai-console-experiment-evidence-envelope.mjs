import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'
import { readTrainingRun, readTrainingRunSection, readTrainingArtifact } from '../../src/server/ai-console/training-history-store.mjs'
import { readBoundLargeExperimentProjection } from '../../src/server/ai-console/training-history-large-result-projection.mjs'

const runId = 'generic-exposure-test'
const binding = path => ({ path: `.runtime/ai-painter/${path}`, sha256: 'a'.repeat(64) })
const hash = value => createHash('sha256').update(value).digest('hex')
// Synthetic fixture bytes only; no model, GPU, real data or service is used.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1kAAAAASUVORK5CYII=', 'base64')

function fixture() {
  const packageBinding = binding('experiment/package.json'), resultBinding = binding('experiment/result.json')
  const capsuleBinding = { ...binding('experiment/capsule.json'), taskId: runId }
  const selectedRows = Array.from({ length: 48 }, (_, index) => ({ sampleId: `train-${index}`, split: 'train', image: binding(`original/${index}.png`) }))
  const observationPlan = [{ epoch: 0, optimizerStep: 0 }, { epoch: 24, optimizerStep: 1152 }, { epoch: 48, optimizerStep: 2304 }]
  const imagePlan = [selectedRows[0], selectedRows[43]].flatMap(row => ['prediction', 'target_final_comparison'].map(purpose => ({
    sampleId: row.sampleId, split: row.split, epoch: 48, optimizerStep: 2304, purpose,
  })))
  const request = { schemaVersion: 'ai-painter-learning-capacity-experiment-package-v1', experimentIdentity: runId,
    experimentType: 'all_train_exposure_only', evidenceContractVersion: 1, selectedRows, observationPlan, imagePlan }
  const trainOnlyObservations = observationPlan.flatMap(point => selectedRows.map(row => ({
    sampleId: row.sampleId, split: row.split, ...point, measurements: { rgbMae: 0.12, loss: 0.34 },
  })))
  const imageArtifacts = imagePlan.map(item => ({ ...binding(`experiment/${item.sampleId}-${item.purpose}.png`),
    ...item, sourceLabel: `explicit ${item.purpose}` }))
  const result = { schemaVersion: 'ai-painter-learning-capacity-experiment-result-v1', experimentIdentity: runId,
    experimentType: request.experimentType, evidenceContractVersion: 1, status: 'experiment_executed_not_visual_qualified',
    stage4QualificationGranted: false, checkpointPromotable: false, optimizerSteps: { generator: 2304, discriminator: 2304 },
    trainOnlyObservations, imageArtifacts, artifacts: imageArtifacts.map(({ path, sha256 }) => ({ path, sha256 })) }
  const terminal = { schemaVersion: 'ai-painter-learning-capacity-experiment-terminal-v1', runId, experimentIdentity: runId,
    formalTrainingQualified: false, formalStageAdvanced: false, checkpointPromotable: false, worldEntryAllowed: false,
    status: 'experiment_completed_not_formal_qualified', executionState: 'completed', result: resultBinding }
  const capsule = { schemaVersion: 'ai-painter-local-task-capsule-v1', taskId: runId, integrity: { status: 'verified' },
    evidence: [{ ...packageBinding, kind: 'experiment_0', sha256Verified: true }] }
  const files = new Map([[packageBinding.path, request], [resultBinding.path, result], [capsuleBinding.path, capsule]])
  const input = { runId, terminal, capsuleBinding, record: { artifacts: [], samples: [], metrics: [], checkpoints: [] },
    base: { unavailableFields: [] }, readJson: async item => files.get(item.path),
    makeArtifact: (role, item, metadata = {}) => ({ role, logicalPath: item.path, sha256: item.sha256, ...metadata }),
    checkpointMetadata: async item => item,
    requireFact: (condition, code) => { if (!condition) throw new Error(code) } }
  return { input, request, result, capsule, packageBinding, resultBinding, capsuleBinding }
}

test('canonical v1 projects 3x48 explicit observations and four bound endpoint images', async () => {
  const { input } = fixture()
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.dataStatus, 'connected')
  assert.equal(detail.record.samples.length, 48)
  assert.equal(detail.record.metrics.length, 144)
  assert.equal(typeof detail.record.optimizerSteps, 'number')
  assert.equal(detail.record.optimizerSteps, 2304)
  assert.deepEqual(detail.record.qualification.optimizerSteps, { generator: 2304, discriminator: 2304 })
  assert.deepEqual(detail.record.metrics[48], { sampleId: 'train-0', split: 'train', epoch: 24, optimizerStep: 1152, measurements: { rgbMae: 0.12, loss: 0.34 } })
  const images = detail.record.artifacts.filter(item => item.role === 'output')
  assert.equal(images.length, 4)
  assert.equal(images[0].epoch, 48)
  assert.equal(images[0].optimizerStep, 2304)
  assert.equal(images[1].purpose, 'target_final_comparison')
  assert.deepEqual(images.map(item => item.sampleId), ['train-0', 'train-0', 'train-43', 'train-43'])
  assert.equal(detail.record.qualification.formalStageQualified, false)
  assert.equal(detail.record.detailCoverage.evidenceContractVersion, 1)
})

test('actual existing UI rejects the old object child but renders canonical numeric G while preserving real D', async () => {
  const { input, result } = fixture()
  result.optimizerSteps.discriminator = 2048 // Do not invent D by copying G.
  const detail = await adaptLegacyTrainingDetail(input)
  assert.deepEqual(detail.record.qualification.optimizerSteps, { generator: 2304, discriminator: 2048 })
  const source = await readFile(new URL('../../src/app/ai-console/ai-console-training-history.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText
  function render(optimizerSteps) {
    const record = { ...detail.record, optimizerSteps, runId, runKind: 'learning_capacity', terminalStatus: 'experiment_completed_not_formal_qualified',
      sourceRevision: 1, finishedAtUtc: null }
    const listing = { records: [record], dataStatus: 'connected', nextCursor: null, total: 1 }
    const selectedDetail = { ...detail, record }
    const sectionPage = { ...selectedDetail, section: 'artifacts', items: [], nextCursor: null, knownItemCount: 0, total: 0 }
    const seeds = [listing, selectedDetail, runId, null, null, '2026-09-28T00:00:00Z', null, 'artifacts', null, sectionPage, null]
    let position = 0
    const exports = {}, realRequire = createRequire(import.meta.url)
    const require = name => name === 'react' ? { ...React, useState(initial) {
      const value = position < seeds.length ? seeds[position] : initial; position++
      return React.useState(value)
    } } : name === './ai-console-training-summary' ? { AiConsoleTrainingSummary: () => null }
      : name.endsWith('.css') ? { default: {} } : name.includes('history-poll') ? { startHistoryPolling() {} } : realRequire(name)
    new Function('require', 'exports', compiled)(require, exports)
    return renderToStaticMarkup(React.createElement(exports.AiConsoleTrainingHistory))
  }
  assert.throws(() => render(result.optimizerSteps), /Objects are not valid as a React child/)
  const html = render(detail.record.optimizerSteps)
  assert.ok(html.includes('真实优化步：2304'))
})

test('missing canonical G/D counts stay unavailable, never substituted from plan or terminal', async () => {
  const { input, result } = fixture()
  delete result.optimizerSteps
  input.terminal.optimizerSteps = { generator: 999, discriminator: 999 }
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.record.optimizerSteps, null)
  assert.equal(detail.record.qualification.optimizerSteps, null)
  assert.ok(detail.unavailableFields.includes('optimizerSteps'))
})

test('plan and selected identities are package-driven, not hardcoded model/epoch/sample lists', async () => {
  const { input, request, result } = fixture()
  request.observationPlan[2] = { epoch: 60, optimizerStep: 2880 }
  for (const row of result.trainOnlyObservations.slice(96)) Object.assign(row, request.observationPlan[2])
  for (const item of [...result.imageArtifacts, ...request.imagePlan]) Object.assign(item, request.observationPlan[2])
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.record.metrics[143].optimizerStep, 2880)
  assert.equal(detail.record.artifacts.find(item => item.role === 'output').epoch, 60)
})

test('image count and identities follow the immutable plan, not a hardcoded four-image check', async () => {
  const { input, request, result } = fixture()
  request.imagePlan = request.imagePlan.slice(0, 2)
  result.imageArtifacts = result.imageArtifacts.slice(0, 2)
  result.artifacts = result.artifacts.slice(0, 2)
  assert.equal((await adaptLegacyTrainingDetail(input)).record.artifacts.filter(item => item.role === 'output').length, 2)
})

test('same canonical family accepts another explicit matching experimentType without model-version dispatch', async () => {
  const { input, request, result } = fixture()
  request.experimentType = result.experimentType = 'another_train_capacity_experiment'
  assert.equal((await adaptLegacyTrainingDetail(input)).record.metrics.length, 144)
})

test('legacy canonical experimentType without extension keeps the original generic adapter behavior', async () => {
  const { input, request, result } = fixture()
  delete request.evidenceContractVersion; delete result.evidenceContractVersion
  request.experimentType = result.experimentType = 'legacy_capacity_experiment'
  delete request.observationPlan; delete request.imagePlan; delete result.trainOnlyObservations; delete result.imageArtifacts
  result.rows = [{ sampleId: 'train-0', split: 'train', measurements: { loss: 0.34 } }]
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.reasonCode, 'history_output_association_not_recorded')
  assert.equal(detail.record.metrics.length, 1)
  assert.equal(detail.record.artifacts.filter(item => item.role === 'image').length, 4)
})

for (const version of [undefined, 2, '1']) test(`unknown contract version ${String(version)} stays partial without interpreting observations`, async () => {
  const { input, request, result } = fixture()
  request.evidenceContractVersion = version
  result.evidenceContractVersion = version
  result.trainOnlyObservations = null
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.dataStatus, 'partial')
  assert.equal(detail.reasonCode, 'history_evidence_contract_version_unsupported')
  assert.equal(detail.record.metrics.length, 0)
  assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 0)
  assert.ok(detail.record.artifacts.some(item => item.role === 'result'))
})

const invalidCases = [
  ['result version drift', f => { f.result.evidenceContractVersion = 2 }, null],
  ['experiment type drift', f => { f.result.experimentType = 'other' }, /history_experiment_type_conflict/],
  ['selected duplicate', f => { f.request.selectedRows[1].sampleId = 'train-0' }, /history_experiment_sample_conflict/],
  ['selected wrong split', f => { f.request.selectedRows[0].split = 'validation' }, /history_experiment_sample_conflict/],
  ['plan duplicate', f => { f.request.observationPlan[1] = { ...f.request.observationPlan[0] } }, /history_experiment_observation_plan_conflict/],
  ['observation omitted', f => { f.result.trainOnlyObservations.pop() }, /history_experiment_observation_coverage_conflict/],
  ['nested observation groups instead of flat rows', f => { f.result.trainOnlyObservations = f.request.observationPlan.map(point => ({ ...point,
    trainOnly: f.result.trainOnlyObservations.filter(row => row.epoch === point.epoch) })) }, /history_experiment_observation_coverage_conflict/],
  ['observation duplicated at same count', f => { f.result.trainOnlyObservations[1] = { ...f.result.trainOnlyObservations[0] } }, /history_experiment_observation_sample_conflict/],
  ['observation another sample', f => { f.result.trainOnlyObservations[0].sampleId = 'unselected' }, /history_experiment_observation_sample_conflict/],
  ['observation wrong split', f => { f.result.trainOnlyObservations[0].split = 'validation' }, /history_experiment_observation_sample_conflict/],
  ['observation wrong step', f => { f.result.trainOnlyObservations[0].optimizerStep = 1 }, /history_experiment_observation_sample_conflict/],
  ['measurements absent', f => { delete f.result.trainOnlyObservations[0].measurements }, /history_experiment_measurements_conflict/],
  ['image SHA mismatch', f => { f.result.imageArtifacts[0].sha256 = 'b'.repeat(64) }, /history_experiment_image_artifact_conflict/],
  ['image malformed SHA', f => { f.result.imageArtifacts[0].sha256 = 'not-sha' }, /history_experiment_image_binding_conflict/],
  ['image cross selected sample', f => { f.result.imageArtifacts[0].sampleId = 'train-1' }, /history_experiment_image_plan_binding_conflict/],
  ['image unselected sample', f => { f.result.imageArtifacts[0].sampleId = 'unselected' }, /history_experiment_image_sample_conflict/],
  ['image wrong split', f => { f.result.imageArtifacts[0].split = 'validation' }, /history_experiment_image_sample_conflict/],
  ['image wrong epoch', f => { f.result.imageArtifacts[0].epoch = 24 }, /history_experiment_image_plan_binding_conflict/],
  ['image wrong step', f => { f.result.imageArtifacts[0].optimizerStep = 1152 }, /history_experiment_image_plan_binding_conflict/],
  ['image purpose absent', f => { delete f.result.imageArtifacts[0].purpose }, /history_experiment_image_purpose_conflict/],
  ['image source label absent', f => { delete f.result.imageArtifacts[0].sourceLabel }, /history_experiment_image_purpose_conflict/],
  ['image omitted', f => { f.result.imageArtifacts.pop() }, /history_experiment_image_shape_conflict/],
  ['image missing artifact', f => { f.result.artifacts.pop() }, /history_experiment_image_artifact_conflict/],
  ['image plan absent', f => { delete f.request.imagePlan }, /history_experiment_image_plan_conflict/],
  ['image plan duplicate', f => { f.request.imagePlan[1] = { ...f.request.imagePlan[0] } }, /history_experiment_image_plan_conflict/],
  ['image plan outside selected set', f => { f.request.imagePlan[0].sampleId = 'unselected' }, /history_experiment_image_plan_conflict/],
  ['image plan wrong split', f => { f.request.imagePlan[0].split = 'validation' }, /history_experiment_image_plan_conflict/],
  ['image plan outside observations', f => { f.request.imagePlan[0].optimizerStep = 999 }, /history_experiment_image_plan_conflict/],
  ['four images from one sample', f => { for (const image of f.result.imageArtifacts) image.sampleId = 'train-0' }, /history_experiment_image_plan_binding_conflict/],
  ['four images with one purpose', f => { for (const image of f.result.imageArtifacts) image.purpose = 'prediction' }, /history_experiment_image_plan_binding_conflict/],
  ['same count but duplicated planned identity', f => { Object.assign(f.result.imageArtifacts[2], { sampleId: 'train-0', purpose: 'prediction' }) }, /history_experiment_image_plan_binding_conflict/],
  ['artifact duplicate', f => { f.result.artifacts.push({ ...f.result.artifacts[0] }) }, /history_experiment_artifact_conflict/],
  ['extra unbound image', f => { f.result.artifacts.push(binding('experiment/unbound.png')) }, /history_experiment_image_association_conflict/],
  ['false qualification', f => { f.result.stage4QualificationGranted = true }, /history_experiment_boundary_conflict/],
  ['non-numeric generator count', f => { f.result.optimizerSteps.generator = '2304' }, /history_experiment_optimizer_steps_conflict/],
  ['negative discriminator count', f => { f.result.optimizerSteps.discriminator = -1 }, /history_experiment_optimizer_steps_conflict/],
  ['scalar canonical step count', f => { f.result.optimizerSteps = 2304 }, /history_experiment_optimizer_steps_conflict/],
]
for (const [name, mutate, error] of invalidCases) test(`canonical envelope rejects ${name}`, async () => {
  const f = fixture(); mutate(f)
  if (error) await assert.rejects(adaptLegacyTrainingDetail(f.input), error)
  else assert.equal((await adaptLegacyTrainingDetail(f.input)).dataStatus, 'partial')
})

test('canonical failure before artifacts remains readable partial, not invented full coverage', async () => {
  const { input, result } = fixture()
  Object.assign(result, { status: 'experiment_failed_closed', executionState: 'failed_closed' })
  delete result.artifacts; delete result.imageArtifacts; delete result.trainOnlyObservations
  const detail = await adaptLegacyTrainingDetail(input)
  assert.equal(detail.reasonCode, 'history_failed_before_artifact_registration')
  assert.equal(detail.record.metrics.length, 0)
})

function failedFixture() {
  const f = fixture()
  Object.assign(f.result, { status: 'experiment_failed_closed', executionState: 'failed_closed' })
  Object.assign(f.input.terminal, { status: 'experiment_failed_closed', executionState: 'failed_closed' })
  f.input.record.terminalStatus = 'experiment_failed_closed'
  f.result.trainOnlyObservations = f.result.trainOnlyObservations.slice(0, 97)
  f.result.imageArtifacts = f.result.imageArtifacts.slice(0, 1)
  f.result.artifacts = f.result.artifacts.slice(0, 1)
  f.result.artifacts.push(binding('experiment/partial-evidence.json'))
  return f
}

test('failed canonical artifacts[] with absent observations/images remains readable partial', async () => {
  const f = failedFixture()
  f.result.artifacts = []
  delete f.result.trainOnlyObservations; delete f.result.imageArtifacts
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.dataStatus, 'partial')
  assert.equal(detail.reasonCode, 'history_experiment_failed_closed_partial')
  assert.equal(detail.record.terminalStatus, 'experiment_failed_closed')
  assert.equal(detail.record.detailCoverage.complete, false)
  assert.equal(detail.record.detailCoverage.observations.verifiedCount, 0)
  assert.equal(detail.record.detailCoverage.images.verifiedCount, 0)
  assert.equal(detail.record.metrics.length, 0)
  assert.ok(detail.unavailableFields.includes('trainOnlyObservations.complete'))
  assert.ok(detail.unavailableFields.includes('imageArtifacts.complete'))
})

test('epoch24 failed reproduction preserves 96 observations, evidence and actual differing G/D without endpoint inventions', async () => {
  const f = failedFixture()
  f.result.trainOnlyObservations = f.result.trainOnlyObservations.slice(0, 96)
  f.result.imageArtifacts = []
  f.result.artifacts = [binding('experiment/epoch24-failure.json')]
  f.result.optimizerSteps = { generator: 1152, discriminator: 1151 }
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.dataStatus, 'partial')
  assert.equal(detail.record.optimizerSteps, 1152)
  assert.deepEqual(detail.record.qualification.optimizerSteps, f.result.optimizerSteps)
  assert.equal(detail.record.metrics.length, 96)
  assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 0)
  assert.ok(detail.record.artifacts.some(item => item.logicalPath.endsWith('epoch24-failure.json')))
  assert.equal(detail.record.detailCoverage.observations.expectedCount, 144)
  assert.equal(detail.record.detailCoverage.observations.missing[0].epoch, 48)
  assert.equal(detail.record.detailCoverage.observations.missing[0].missingSampleIds.length, 48)
  assert.equal(detail.record.detailCoverage.images.missing.length, 4)
})

test('failed canonical partial explicit images and observations retain only verified existing identities', async () => {
  const f = failedFixture()
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.reasonCode, 'history_experiment_failed_closed_partial')
  assert.equal(detail.record.terminalStatus, 'experiment_failed_closed')
  assert.equal(detail.record.metrics.length, 97)
  assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 1)
  const image = detail.record.artifacts.find(item => item.role === 'output')
  assert.equal(image.sampleId, 'train-0')
  assert.equal(image.purpose, 'prediction')
  assert.equal(image.sha256, f.result.imageArtifacts[0].sha256)
  assert.equal(detail.record.detailCoverage.complete, false)
  assert.equal(detail.record.detailCoverage.observations.missing[0].missingSampleIds.length, 47)
  assert.equal(detail.record.detailCoverage.images.missing.length, 3)
  assert.equal(detail.record.qualification.formalStageQualified, false)
})

test('failed raw image artifact lacking association remains explicitly unassociated, never paired by name', async () => {
  const f = failedFixture()
  f.result.artifacts.push(binding('experiment/looks-like-train-43-target.png'))
  const detail = await adaptLegacyTrainingDetail(f.input)
  const image = detail.record.artifacts.find(item => item.logicalPath.endsWith('looks-like-train-43-target.png'))
  assert.equal(image.role, 'image')
  assert.equal(image.associationStatus, 'not_recorded_failed_closed')
  assert.equal(image.sampleId, undefined)
  assert.ok(detail.unavailableFields.includes('output.sample_arm_seed_association'))
})

test('failure after all artifacts still never becomes a connected/completed experiment', async () => {
  const f = fixture()
  Object.assign(f.result, { status: 'experiment_failed_closed', executionState: 'failed_closed' })
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.dataStatus, 'partial')
  assert.equal(detail.record.detailCoverage.complete, false)
  assert.equal(detail.record.metrics.length, 144)
  assert.equal(detail.record.detailCoverage.images.verifiedCount, 4)
})

const invalidFailedCases = [
  ['observation cross sample', f => { f.result.trainOnlyObservations[0].sampleId = 'unselected' }, /history_experiment_observation_sample_conflict/],
  ['observation wrong split', f => { f.result.trainOnlyObservations[0].split = 'validation' }, /history_experiment_observation_sample_conflict/],
  ['observation off plan', f => { f.result.trainOnlyObservations[0].optimizerStep = 3 }, /history_experiment_observation_sample_conflict/],
  ['observation duplicate', f => { f.result.trainOnlyObservations[1] = { ...f.result.trainOnlyObservations[0] } }, /history_experiment_observation_sample_conflict/],
  ['malformed observations', f => { f.result.trainOnlyObservations = null }, /history_experiment_observation_coverage_conflict/],
  ['image cross sample', f => { f.result.imageArtifacts[0].sampleId = 'train-1' }, /history_experiment_image_plan_binding_conflict/],
  ['image wrong split', f => { f.result.imageArtifacts[0].split = 'validation' }, /history_experiment_image_sample_conflict/],
  ['image off plan', f => { f.result.imageArtifacts[0].epoch = 24 }, /history_experiment_image_plan_binding_conflict/],
  ['image SHA mismatch', f => { f.result.imageArtifacts[0].sha256 = 'b'.repeat(64) }, /history_experiment_image_artifact_conflict/],
  ['image artifact absent', f => { f.result.artifacts.shift() }, /history_experiment_image_artifact_conflict/],
  ['image identity duplicate', f => { f.result.imageArtifacts.push({ ...f.result.imageArtifacts[0], ...binding('experiment/duplicate.png') }) }, /history_experiment_image_plan_binding_conflict/],
  ['malformed images', f => { f.result.imageArtifacts = null }, /history_experiment_image_shape_conflict/],
  ['bad raw artifact SHA', f => { f.result.artifacts[1].sha256 = 'bad' }, /history_experiment_artifact_conflict/],
  ['failure status alone', f => { f.result.executionState = 'completed' }, /history_experiment_observation_coverage_conflict/],
  ['failure state alone', f => { f.result.status = 'experiment_executed_not_visual_qualified' }, /history_experiment_observation_coverage_conflict/],
]
for (const [name, mutate, error] of invalidFailedCases) test(`partial failed canonical still rejects ${name}`, async () => {
  const f = failedFixture(); mutate(f)
  await assert.rejects(adaptLegacyTrainingDetail(f.input), error)
})

async function registeredFixture(t, f = fixture()) {
  const root = await mkdtemp(path.join(tmpdir(), 'console-envelope-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  async function put(logical, value) {
    const file = path.join(root, logical)
    await mkdir(path.dirname(file), { recursive: true })
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    await writeFile(file, bytes)
    return { path: logical, sha256: hash(bytes) }
  }
  for (const sample of f.request.selectedRows) Object.assign(sample.image, await put(sample.image.path, png))
  for (let i = 0; i < f.result.imageArtifacts.length; i++) {
    const item = f.result.imageArtifacts[i]
    Object.assign(item, await put(item.path, png))
    Object.assign(f.result.artifacts[i], { path: item.path, sha256: item.sha256 })
  }
  for (const doc of f.extraDocuments ?? []) Object.assign(doc.binding, await put(doc.binding.path, doc.value))
  Object.assign(f.packageBinding, await put(f.packageBinding.path, f.request))
  Object.assign(f.resultBinding, await put(f.resultBinding.path, f.result))
  Object.assign(f.capsule.evidence[0], f.packageBinding)
  Object.assign(f.capsuleBinding, await put(f.capsuleBinding.path, f.capsule))
  const terminal = await put('.runtime/ai-painter/experiment/terminal.json', f.input.terminal)
  const reg = '.runtime/ai-painter/current-execution-registry', transactionId = 'envelope-test-tx'
  const current = { schemaVersion: 'ai-painter-current-execution-registry-v1', registryRevision: 1, eventSequence: 1,
    writerIdentity: 'local_ai_capability_lifecycle_orchestrator', transactionId, taskId: runId, runId,
    taskCapsule: f.capsuleBinding, terminalEvidence: { ...terminal, status: f.input.terminal.status },
    latestTrainingTerminal: { ...terminal, runId, status: f.input.terminal.status },
    activeExecution: null, supersedes: null }
  const currentBinding = await put(`${reg}/current.json`, current)
  await put(`${reg}/transactions/${transactionId}/current.staged.json`, current)
  await put(`${reg}/transactions/${transactionId}/transaction.json`, { schemaVersion: 'ai-painter-current-execution-registry-transaction-v1', status: 'committed', transactionId, registryRevision: 1,
    eventSequence: 1, currentSha256: currentBinding.sha256, previousCurrentSha256: null })
  await put(`${reg}/events.jsonl`, Buffer.from(JSON.stringify({ transactionId, registryRevision: 1, eventSequence: 1,
    currentSha256: currentBinding.sha256, previousCurrentSha256: null, taskId: runId, runId }) + '\n'))
  const db = new DatabaseSync(path.join(root, reg, 'registry.sqlite'))
  try {
    db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
    db.prepare('INSERT INTO registry_revisions VALUES (1,1,?,?,?,?)').run(transactionId, currentBinding.sha256, runId, runId)
    db.prepare('INSERT INTO registry_transactions VALUES (?,\'committed\',?)').run(transactionId, currentBinding.sha256)
  } finally { db.close() }
  return { ...f, root, reg }
}

test('existing reader paginates all 144 metrics and four images; byte tampering fails closed with no GET writes', async t => {
  const f = await registeredFixture(t)
  const currentPath = path.join(f.root, f.reg, 'current.json'), before = await readFile(currentPath)
  const detail = await readTrainingRun(runId, { root: f.root })
  assert.equal(detail.record.metrics.length, 144)
  const metrics = []
  let cursor = null
  do {
    const page = await readTrainingRunSection(runId, { root: f.root, section: 'metrics', limit: 20, cursor })
    metrics.push(...page.items); cursor = page.nextCursor
  } while (cursor)
  assert.deepEqual(metrics, detail.record.metrics)
  const images = detail.record.artifacts.filter(item => item.role === 'output')
  assert.equal(images.length, 4)
  for (const item of images) assert.deepEqual((await readTrainingArtifact(runId, item.artifactId, { root: f.root })).bytes, png)
  await writeFile(path.join(f.root, images[0].logicalPath), Buffer.from('tampered fixture'))
  await assert.rejects(readTrainingArtifact(runId, images[0].artifactId, { root: f.root }), /sha_mismatch/)
  assert.deepEqual(await readFile(currentPath), before)
  await writeFile(path.join(f.root, f.packageBinding.path), Buffer.from(JSON.stringify({ ...f.request, observationPlan: [] })))
  await assert.rejects(readTrainingRun(runId, { root: f.root }), /current_task_evidence_experiment_0_hash_mismatch/)
})

test('existing reader exposes failed partial sections and image bytes instead of rejecting incomplete coverage', async t => {
  const f = await registeredFixture(t, failedFixture())
  const before = await readFile(path.join(f.root, f.reg, 'current.json'))
  const detail = await readTrainingRun(runId, { root: f.root })
  assert.equal(detail.dataStatus, 'partial')
  assert.equal(detail.record.terminalStatus, 'experiment_failed_closed')
  assert.equal(detail.record.metrics.length, 97)
  const page = await readTrainingRunSection(runId, { root: f.root, section: 'metrics', limit: 20 })
  assert.equal(page.dataStatus, 'partial')
  assert.equal(page.knownItemCount, 97)
  assert.equal(page.total, null)
  const image = detail.record.artifacts.find(item => item.role === 'output')
  assert.deepEqual((await readTrainingArtifact(runId, image.artifactId, { root: f.root })).bytes, png)
  await writeFile(path.join(f.root, image.logicalPath), Buffer.from('tampered failed fixture image'))
  await assert.rejects(readTrainingArtifact(runId, image.artifactId, { root: f.root }), /sha_mismatch/)
  assert.deepEqual(await readFile(path.join(f.root, f.reg, 'current.json')), before)
})

function fragmentFixture() {
  const f = failedFixture()
  const flat = fixture().result.trainOnlyObservations
  delete f.result.trainOnlyObservations
  f.result.imageArtifacts = []
  f.result.artifacts = []
  f.result.optimizerSteps = { generator: 1152, discriminator: 1152 }
  f.extraDocuments = []
  const originalRead = f.input.readJson
  f.input.readJson = async item => f.extraDocuments.find(doc => doc.binding.path === item.path)?.value ?? originalRead(item)
  f.addDocument = (logical, value) => {
    const doc = { binding: binding(logical), value }
    f.extraDocuments.push(doc); f.result.artifacts.push(doc.binding)
    return doc
  }
  for (const [index, point] of f.request.observationPlan.slice(0, 2).entries()) f.addDocument(`experiment/arbitrary-${index}.json`, {
    ...point, trainOnly: flat.filter(row => row.epoch === point.epoch).map((row, ordinal) => ({ ...row, trainOrdinal: ordinal })), summary: {},
  })
  return f
}

test('bound fragment compatibility projects exact 96 measurements with provenance and only epoch48 missing', async () => {
  const f = fragmentFixture()
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.dataStatus, 'partial')
  assert.equal(detail.record.metrics.length, 96)
  assert.equal(detail.record.detailCoverage.observations.expectedCount, 144)
  assert.equal(detail.record.detailCoverage.observations.missing.length, 1)
  assert.equal(detail.record.detailCoverage.observations.missing[0].epoch, 48)
  assert.equal(detail.record.detailCoverage.images.verifiedCount, 0)
  assert.deepEqual(detail.record.metrics[0].measurements, f.extraDocuments[0].value.trainOnly[0].measurements)
  assert.equal(detail.record.metrics[0].sourcePath, f.extraDocuments[0].binding.path)
  assert.equal(detail.record.metrics[48].sourceSha256, f.extraDocuments[1].binding.sha256)
  assert.equal(detail.record.optimizerSteps, 1152)
})

test('flat even empty is authoritative; compatibility never reads or mixes sibling fragments', async () => {
  const f = fragmentFixture()
  f.result.trainOnlyObservations = []
  const read = f.input.readJson
  f.input.readJson = item => {
    assert.ok(!f.extraDocuments.some(doc => doc.binding.path === item.path))
    return read(item)
  }
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.metrics.length, 0)
  assert.equal(detail.record.detailCoverage.observationFragments, undefined)
})

for (const count of [96, 144]) test(`canonical producer ${count} flat plus ${count} legacy rows projects exactly ${count}, not twice`, async () => {
  const f = fixture()
  if (count === 96) {
    Object.assign(f.result, { status: 'experiment_failed_closed', executionState: 'failed_closed' })
    f.result.trainOnlyObservations = f.result.trainOnlyObservations.slice(0, count)
    f.result.imageArtifacts = []; f.result.artifacts = []
  }
  // Actual producer representation: rows.measurements wraps the observation;
  // flat.measurements is the observation's metrics, not that wrapper.
  f.result.rows = f.result.trainOnlyObservations.map(row => ({ sampleId: row.sampleId, split: row.split,
    measurements: { sampleId: row.sampleId, split: row.split, epoch: row.epoch, optimizerStep: row.optimizerStep, metrics: row.measurements } }))
  const originalRows = structuredClone(f.result.rows)
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.metrics.length, count)
  assert.deepEqual(detail.record.metrics.map(row => row.measurements), f.result.trainOnlyObservations.map(row => row.measurements))
  assert.deepEqual(f.result.rows, originalRows)
  assert.ok(detail.record.artifacts.some(item => item.role === 'result'))
})

test('canonical aliases are not merged even when contradictory; fragment plane stays authoritative', async () => {
  const f = fragmentFixture()
  f.result.rows = [{ sampleId: 'outside', split: 'validation', measurements: { conflicting: true } }]
  f.result.epochMetrics = [{ conflicting: true }]
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.metrics.length, 96)
  assert.ok(detail.record.metrics.every(row => row.split === 'train' && row.measurements.conflicting === undefined))
  assert.equal(f.result.rows[0].measurements.conflicting, true)
})

test('unsupported child schema stays an explicit gap, not a version guess', async () => {
  const f = fragmentFixture()
  f.extraDocuments[0].value.schemaVersion = 'unknown-child-v9'
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.metrics.length, 48)
  assert.equal(detail.record.detailCoverage.observationFragments.gaps[0].reasonCode, 'history_observation_fragment_schema_unsupported')
})

const fragmentConflicts = [
  ['cross sample', f => { f.extraDocuments[0].value.trainOnly[0].sampleId = 'outside' }, /history_observation_fragment_sample_conflict/],
  ['split', f => { f.extraDocuments[0].value.trainOnly[0].split = 'validation' }, /history_observation_fragment_sample_conflict/],
  ['ordinal', f => { f.extraDocuments[0].value.trainOnly[0].trainOrdinal = 43 }, /history_observation_fragment_sample_conflict/],
  ['row point', f => { f.extraDocuments[0].value.trainOnly[0].epoch = 24 }, /history_observation_fragment_point_conflict/],
  ['file point', f => { f.extraDocuments[0].value.optimizerStep = 999 }, /history_observation_fragment_point_conflict/],
  ['duplicate sample', f => { f.extraDocuments[0].value.trainOnly[1] = f.extraDocuments[0].value.trainOnly[0] }, /history_observation_fragment_sample_conflict/],
  ['duplicate fragment point', f => { f.extraDocuments[1].value = structuredClone(f.extraDocuments[0].value) }, /history_observation_fragment_duplicate_point/],
  ['missing sample', f => { f.extraDocuments[0].value.trainOnly.pop() }, /history_observation_fragment_shape_conflict/],
  ['absent measurements', f => { delete f.extraDocuments[0].value.trainOnly[0].measurements }, /history_experiment_measurements_conflict/],
]
for (const [name, mutate, error] of fragmentConflicts) test(`bound fragment rejects ${name}`, async () => {
  const f = fragmentFixture(); mutate(f)
  await assert.rejects(adaptLegacyTrainingDetail(f.input), error)
})

test('candidate budget is explicit and does not expand into discovery', async () => {
  const f = fragmentFixture()
  for (let i = 0; i < 20; i++) f.addDocument(`experiment/other-${i}.json`, { unrelated: true })
  const detail = await adaptLegacyTrainingDetail(f.input)
  assert.equal(detail.record.metrics.length, 96)
  const report = detail.record.detailCoverage.observationFragments
  assert.equal(report.candidatesRead, 16)
  assert.ok(report.gaps.some(item => item.reasonCode === 'history_observation_fragment_budget_exceeded'))
})

test('reader paginates all chunk metrics, reuses bounded parsing but rejects byte tampering immediately', async t => {
  const f = await registeredFixture(t, fragmentFixture())
  const currentPath = path.join(f.root, f.reg, 'current.json'), before = await readFile(currentPath)
  const first = await readTrainingRun(runId, { root: f.root })
  assert.equal(first.record.metrics.length, 96)
  assert.equal(first.record.detailCoverage.observationFragments.parsedDocuments, 2)
  const second = await readTrainingRun(runId, { root: f.root })
  assert.equal(second.record.detailCoverage.observationFragments.parseCacheHits, 2)
  assert.equal(second.record.detailCoverage.observationFragments.parsedDocuments, 0)
  assert.equal(second.record.detailCoverage.observationFragments.parseCache.verification, 'fresh_bytes_sha256')
  // Consumer mutation cannot poison the cached source object.
  second.record.metrics[0].measurements.loss = -999
  const pageRows = [], pageLengths = []
  let cursor = null
  do {
    const page = await readTrainingRunSection(runId, { root: f.root, section: 'metrics', limit: 20, cursor })
    assert.equal(page.dataStatus, 'partial'); assert.equal(page.total, null); assert.equal(page.knownItemCount, 96)
    pageLengths.push(page.items.length); pageRows.push(...page.items); cursor = page.nextCursor
  } while (cursor)
  assert.deepEqual(pageLengths, [20, 20, 20, 20, 16])
  assert.deepEqual(pageRows, first.record.metrics)
  const file = path.join(f.root, f.extraDocuments[0].binding.path)
  const original = await readFile(file)
  const changed = JSON.parse(original)
  changed.trainOnly[0].measurements.loss = 0.35
  const changedBytes = Buffer.from(JSON.stringify(changed))
  assert.equal(changedBytes.length, original.length) // Same-length edits still invalidate on SHA, not stat size.
  await writeFile(file, changedBytes)
  await assert.rejects(readTrainingRun(runId, { root: f.root }), /history_sha_mismatch/)
  await writeFile(file, original)
  const restored = await readTrainingRun(runId, { root: f.root })
  assert.deepEqual(restored.record.metrics, first.record.metrics)
  assert.equal(restored.record.detailCoverage.observationFragments.parsedDocuments, 1)
  // A changed parent cannot reuse either an old Run or cached child identity.
  await writeFile(path.join(f.root, f.resultBinding.path), JSON.stringify({ ...f.result, status: 'changed' }))
  await assert.rejects(readTrainingRun(runId, { root: f.root }), /history_sha_mismatch/)
  assert.deepEqual(await readFile(currentPath), before)
})

test('registered large canonical result projects all metrics/images without raw JSON cap bypass or GET writes', async t => {
  const f = fixture()
  f.result.unrelatedLegacyPadding = 'x'.repeat(8 * 1024 * 1024)
  const registered = await registeredFixture(t, f)
  const before = await readFile(path.join(registered.root, registered.reg, 'current.json'))
  const detail = await readTrainingRun(runId, { root: registered.root })
  assert.equal(detail.record.metrics.length, 144)
  assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 4)
  const projection = detail.record.detailCoverage.largeResultProjection
  assert.ok(projection.sourceByteLength > 8388608)
  assert.ok(projection.projectedByteLength <= 8388608)
  assert.equal(projection.rawSourcePreviewAvailable, false)
  assert.equal(projection.sourceSha256, f.resultBinding.sha256)
  const result = detail.record.artifacts.find(item => item.role === 'result')
  assert.equal(result.url, null)
  assert.equal(result.previewStatus, 'bounded_projection_only_raw_source_over_limit')
  await assert.rejects(readTrainingArtifact(runId, result.artifactId, { root: registered.root }), /history_byte_limit/)
  const artifacts = [], firstPage = await readTrainingRunSection(runId, { root: registered.root, section: 'artifacts', limit: 20 })
  assert.deepEqual(firstPage.items.slice(0, 4).map(item => item.role), ['output', 'output', 'output', 'output'])
  artifacts.push(...firstPage.items)
  let artifactCursor = firstPage.nextCursor
  while (artifactCursor) {
    const page = await readTrainingRunSection(runId, { root: registered.root, section: 'artifacts', limit: 20, cursor: artifactCursor })
    artifacts.push(...page.items); artifactCursor = page.nextCursor
  }
  assert.equal(artifacts.length, detail.record.artifacts.length)
  assert.equal(new Set(artifacts.map(item => item.artifactId)).size, artifacts.length)
  const rows = []
  let cursor = null
  do {
    const page = await readTrainingRunSection(runId, { root: registered.root, section: 'metrics', limit: 20, cursor })
    rows.push(...page.items); cursor = page.nextCursor
  } while (cursor)
  assert.equal(rows.length, 144)
  assert.equal(new Set(rows.map(row => `${row.sampleId}:${row.epoch}:${row.optimizerStep}`)).size, 144)
  const output = detail.record.artifacts.find(item => item.role === 'output')
  assert.deepEqual((await readTrainingArtifact(runId, output.artifactId, { root: registered.root })).bytes, png)
  assert.deepEqual(await readFile(path.join(registered.root, registered.reg, 'current.json')), before)
})

test('large projection cache rechecks source bytes and evicts changed source, including same-length tampering', async t => {
  const f = fixture(); f.result.unrelatedLegacyPadding = 'x'.repeat(8 * 1024 * 1024)
  const registered = await registeredFixture(t, f)
  const first = await readBoundLargeExperimentProjection(registered.root, f.resultBinding, f.request)
  const second = await readBoundLargeExperimentProjection(registered.root, f.resultBinding, f.request)
  assert.equal(first.coverage.parseCacheHit, false); assert.equal(second.coverage.parseCacheHit, true)
  assert.ok(second.coverage.retainedProjectionBytes <= second.coverage.maxRetainedProjectionBytes)
  assert.equal(first.value.unrelatedLegacyPadding, undefined)
  const file = path.join(registered.root, f.resultBinding.path), original = await readFile(file), changed = Buffer.from(original)
  changed[changed.indexOf('xxxxxxxx')] = 121
  await writeFile(file, changed)
  await assert.rejects(readBoundLargeExperimentProjection(registered.root, f.resultBinding, f.request), /history_sha_mismatch/)
  await writeFile(file, original)
  assert.equal((await readBoundLargeExperimentProjection(registered.root, f.resultBinding, f.request)).coverage.parseCacheHit, false)
})

test('large source, projected content and unsupported contract each keep explicit finite limits', async t => {
  for (const kind of ['source', 'projection', 'unsupported']) {
    const f = fixture()
    if (kind === 'projection') f.result.trainOnlyObservations[0].measurements.large = 'x'.repeat(8388608)
    else f.result.unrelatedLegacyPadding = 'x'.repeat((kind === 'source' ? 16 : 8) * 1024 * 1024)
    if (kind === 'unsupported') { delete f.request.evidenceContractVersion; delete f.result.evidenceContractVersion }
    const registered = await registeredFixture(t, f)
    const detail = await readTrainingRun(runId, { root: registered.root })
    assert.equal(detail.dataStatus, 'partial')
    assert.equal(detail.reasonCode, 'history_detail_evidence_exceeds_limit')
    assert.equal(detail.record.metrics.length, 0)
    assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 0)
    if (kind === 'projection') assert.equal(detail.record.detailCoverage.largeResultProjection.reasonCode, 'history_large_projection_byte_limit')
  }
})

test('large projected result cannot change identity, image mapping or formal qualification', async t => {
  for (const [change, expected] of [
    [f => { f.result.experimentType = 'foreign' }, /history_large_result_identity_conflict/],
    [f => { f.result.stage4QualificationGranted = true }, /history_experiment_boundary_conflict/],
  ]) {
    const f = fixture(); f.result.unrelatedLegacyPadding = 'x'.repeat(8388608)
    change(f)
    const registered = await registeredFixture(t, f)
    await assert.rejects(readTrainingRun(runId, { root: registered.root }), expected)
  }
  const f = fixture(); f.result.unrelatedLegacyPadding = 'x'.repeat(8388608)
  const registered = await registeredFixture(t, f)
  const projected = await readBoundLargeExperimentProjection(registered.root, f.resultBinding, f.request)
  projected.value.imageArtifacts[0].sha256 = 'b'.repeat(64)
  f.input.readJson = async item => item.path === f.resultBinding.path ? (() => { const e = new Error('limit'); e.status = 413; throw e })() : item.path === f.packageBinding.path ? f.request : f.capsule
  f.input.readLargeResultProjection = async () => ({ ...projected, value: projected.value })
  await assert.rejects(adaptLegacyTrainingDetail(f.input), /history_experiment_image_artifact_conflict/)
})

test('large projection refuses path escape and unknown package before reading source', async t => {
  const registered = await registeredFixture(t)
  await assert.rejects(readBoundLargeExperimentProjection(registered.root, { path: '../outside.json', sha256: 'a'.repeat(64) }, registered.request), /history_path_outside_root/)
  await assert.rejects(readBoundLargeExperimentProjection(registered.root, registered.resultBinding, { ...registered.request, evidenceContractVersion: 2 }), /history_large_result_package_unsupported/)
})

test('large projection coalesces identical binding and bounds different in-flight sources', async t => {
  const f = fixture(); f.result.unrelatedLegacyPadding = 'x'.repeat(8388608)
  const registered = await registeredFixture(t, f)
  const first = readBoundLargeExperimentProjection(registered.root, f.resultBinding, f.request)
  const same = readBoundLargeExperimentProjection(registered.root, f.resultBinding, f.request)
  const second = readBoundLargeExperimentProjection(registered.root, f.resultBinding, { ...f.request, experimentIdentity: 'foreign-one' })
  const third = readBoundLargeExperimentProjection(registered.root, f.resultBinding, { ...f.request, experimentIdentity: 'foreign-two' })
  const results = await Promise.allSettled([first, same, second, third])
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'fulfilled')
  assert.deepEqual(results[0].value, results[1].value)
  results[0].value.value.trainOnlyObservations.pop()
  assert.equal(results[1].value.value.trainOnlyObservations.length, 144)
  assert.match(results[2].reason.message, /history_large_result_identity_conflict/)
  assert.equal(results[3].reason.message, 'history_large_projection_busy')
  assert.equal(results[3].reason.status, 503)
})

test('JSON and aggregate byte limits remain explicit gaps without silent missing-row success', async t => {
  const f = fragmentFixture()
  f.addDocument('experiment/too-large.json', { oversized: 'x'.repeat(8388608) })
  f.addDocument('experiment/within-budget.json', { other: 'x'.repeat(5 * 1024 * 1024) })
  f.addDocument('experiment/over-aggregate.json', { other: 'x'.repeat(5 * 1024 * 1024) })
  const registered = await registeredFixture(t, f)
  const detail = await readTrainingRun(runId, { root: registered.root })
  assert.equal(detail.record.metrics.length, 96)
  const report = detail.record.detailCoverage.observationFragments
  assert.ok(report.bytesVerified <= report.maxBytes)
  assert.ok(report.gaps.some(gap => gap.path.endsWith('too-large.json')))
  assert.ok(report.gaps.some(gap => gap.path.endsWith('over-aggregate.json') && gap.reasonCode === 'history_observation_fragment_budget_exceeded'))
  assert.ok(detail.unavailableFields.includes('observationFragments.coverage'))
  assert.equal(detail.dataStatus, 'partial')
})

test('parsed cache evicts across roots at finite entry and serialized-source byte ceilings', async t => {
  let first, last
  for (let batch = 0; batch < 3; batch++) {
    const f = fragmentFixture()
    for (let i = 0; i < 12; i++) f.addDocument(`experiment/padding-${i}.json`, { padding: 'x'.repeat(400 * 1024) })
    const registered = await registeredFixture(t, f)
    first ??= registered
    last = await readTrainingRun(runId, { root: registered.root })
    const cache = last.record.detailCoverage.observationFragments.parseCache
    assert.ok(cache.retainedEntries <= cache.maxEntries)
    assert.ok(cache.retainedSourceBytes <= cache.maxSourceBytes)
  }
  const again = await readTrainingRun(runId, { root: first.root })
  assert.ok(again.record.detailCoverage.observationFragments.parsedDocuments > 0)
  assert.equal(again.record.metrics.length, 96)
})
