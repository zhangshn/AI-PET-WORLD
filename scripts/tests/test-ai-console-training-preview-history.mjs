import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { readTrainingPreviewHistory, readTrustedTrainingPreviewProgress, previewIdentityHash } from '../../src/server/ai-console/training-preview-history-v1.mjs'
import { adaptLegacyTrainingDetail } from '../../src/server/ai-console/training-history-detail-adapters.mjs'
import { bytes, requireFact } from '../../src/server/ai-console/training-history-safe-bytes.mjs'

const digest = raw => createHash('sha256').update(raw).digest('hex')
// Synthetic PNG fixture only; no model, real RGB, optimizer or GPU is loaded.
function png() {
  const chunk = (kind, value) => {
    const name = Buffer.from(kind), raw = Buffer.concat([name, value])
    let crc = 0xffffffff
    for (const octet of raw) { crc ^= octet; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1 }
    const size = Buffer.alloc(4), tail = Buffer.alloc(4)
    size.writeUInt32BE(value.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([size, raw, tail])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(256); header.writeUInt32BE(192, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc(192 * (1 + 256 * 3)))), chunk('IEND', Buffer.alloc(0))])
}
function fixture(t, frameCount = 1, policyVersion = 2) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'console-preview-fixture-'))
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('console-preview-fixture-')); fs.rmSync(root, { recursive: true }) })
  const put = (logical, value) => {
    const raw = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw)
    return { path: logical, sha256: digest(raw) }
  }
  const scope = [4, 5].includes(policyVersion) ? {
    capabilityVersion: 'stage4_mvp256_dry_joint_object_priority_quality24_v1',
    modelCapabilityVersion: 'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1',
    outputRootPrefix: '.runtime/ai-painter/joint-object-priority-quality-executions/',
  } : policyVersion === 3 ? {
    capabilityVersion: 'stage4_mvp256_dry_final_rgb_base_weight_quality24_v1',
    modelCapabilityVersion: 'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1',
    outputRootPrefix: '.runtime/ai-painter/final-rgb-base-weight-quality-executions/',
  } : {
    capabilityVersion: 'stage4_mvp256_dry_object_support_structure_quality24_v1',
    modelCapabilityVersion: 'stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1',
    outputRootPrefix: '.runtime/ai-painter/object-support-structure-quality-executions/',
  }
  const identity = { runId: 'preview-fixture-run', packageId: 'preview-fixture-package', capabilityVersion: scope.capabilityVersion }
  const outputRoot = `${scope.outputRootPrefix}${identity.runId}`
  const program = put('ml/ai-painter/fixture/source.txt', 'synthetic non-executable source metadata')
  const policy = { schemaVersion: `ai-painter-training-preview-observation-policy-v${policyVersion}`,
    capture: { split: 'train', ordinal: 0, maxFrames: 24, maxFramesPerEpoch: 1,
      phase: 'after_discriminator_update_before_generator_update' }, programBindings: { storage: program },
    scope: { resolution: [256, 192], epochs: 24, trainSamples: 48, ...([3, 4, 5].includes(policyVersion) ? scope : {}) },
    resources: { maxPngBytes: 155648, maxMetadataBytes: 8192, maxPreviewBytes: 4194304 },
    recordAndImageLimits: { maxManifestBytes: 16384 } }
  const policyBinding = put(`data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v${policyVersion}.json`, policy)
  const facts = put('data/fixture/facts.json', { worldId: 'training-world:fixture', tick: 0 })
  const task = put('data/fixture/task.json', { worldId: 'training-world:fixture', tick: 0,
    sourceBindings: { naturalizedWorldFactsPath: facts.path, naturalizedWorldFactsSha256: facts.sha256 } })
  const condition = put('data/fixture/condition.json', { worldId: 'training-world:fixture', tick: 0, sourceBindings: { taskPackagePath: task.path } })
  const rgb = put('data/fixture/rgb.png', png())
  const contribution = put('data/fixture/contribution.json', { taskPackagePath: task.path, taskPackageSha256: task.sha256 })
  const sourceIndex = put('data/fixture/index.json', { samples: [{ sampleId: 'train-0', split: 'train', image: rgb, conditionPack: condition, contribution }] })
  const manifest = put('data/fixture/dataset.json', { sourceIndex })
  const train = put('data/fixture/train.json', { split: 'train', sampleIds: Array.from({ length: 48 }, (_, i) => `train-${i}`) })
  const model = put(`${outputRoot}/model.json`, { ...identity, modelCapabilityVersion: scope.modelCapabilityVersion })
  const config = { schema: 'object-support-structure-quality-configuration-v1', capabilityVersion: scope.capabilityVersion,
    modelCapabilityVersion: scope.modelCapabilityVersion,
    trainingPreviewPolicy: policyBinding, scope: { resolution: [256, 192] }, optimizer: { eps: 1e-8 },
    executionCeiling: { epochs: 24, generatorOptimizerSteps: 1152, discriminatorOptimizerSteps: 1152 },
    checkpointSelection: { eligibleEpochs: [24], validationRowsPerEligibleEpoch: 8 } }
  const plan = { schema: 'object-support-structure-quality-plan-v1', executionMode: 'bounded-quality-training',
    ...identity, outputRoot, trainingPreviewPolicy: policyBinding, configuration: config,
    programBindings: { storage: program }, modelBinding: model, datasetManifest: manifest, trainSplit: train }
  const planBinding = put(`${outputRoot}/quality-plan.json`, plan)
  const envelope = { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: identity.packageId,
    capabilityVersion: identity.capabilityVersion, outputRoot, programLineage: { storage: program.sha256 },
    inputEvidence: [planBinding, policyBinding, model, manifest, train] }
  const executionPackage = put(`.runtime/ai-painter/autonomous-closed-loop-packages/${identity.packageId}/package.json`, envelope)
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const image = { ...put(`${outputRoot}/training-previews/${index}.png`, png()), bytes: png().length }
    return structuredClone({ schemaVersion: 'training-preview-diagnostic-record-v1', purpose: 'not_reviewed_diagnostic_only',
      formalOutput: false, checkpointSelectionEligible: false, qualificationEvidence: false, runtimePublicationEligible: false,
      ...identity, modelCapabilityVersion: config.modelCapabilityVersion, policy: policyBinding, plan: planBinding,
      executionPackage, modelBinding: model, datasetManifest: manifest, sourceRgb: rgb, conditionPack: condition, worldFacts: facts,
      configurationSha256: previewIdentityHash(config), programBindingsSha256: previewIdentityHash(plan.programBindings),
      worldId: 'training-world:fixture', tick: 0, split: 'train', sampleId: 'train-0', epoch: index + 1, trainOrdinal: 0, trainIndex: 0,
      optimizerSteps: { generator: index * 48, discriminator: index * 48 + 1 },
      phase: 'after_discriminator_update_before_generator_update', forwardSequence: index + 1, image })
  })
  const collection = { schemaVersion: 'training-preview-diagnostic-manifest-v1', runId: identity.runId,
    packageId: identity.packageId, policy: policyBinding, plan: planBinding, entries: [] }
  const parent = { schema: 'object-support-structure-quality-worker-terminal-v1', ...identity, executionPackage,
    executionState: 'failed_closed', status: 'failed_closed', completedEpochs: 11, checkpoints: [],
    optimizerSteps: { generator: 539, discriminator: 540 }, optimizerStepsGenerator: 539, optimizerStepsDiscriminator: 540 }
  const commit = () => {
    collection.entries = frames.map((frame, index) => ({ record: put(`${outputRoot}/training-previews/${index}.json`, frame),
      image: { path: frame.image.path, sha256: frame.image.sha256 } }))
    parent.trainingPreviewManifest = put(`${outputRoot}/training-previews/manifest.json`, collection)
  }
  commit()
  const options = { parent, manifestBinding: parent.trainingPreviewManifest,
    planSchemas: [plan.schema], configurationSchemas: [config.schema],
    readBytes: async (b, max) => (await bytes(root, b.path, max, b.sha256)).value }
  const read = extra => readTrainingPreviewHistory({ ...options, manifestBinding: parent.trainingPreviewManifest, ...extra })
  // Re-sign this isolated fixture's parents after a deliberate semantic change;
  // rejection must not merely be an accidentally stale package/plan SHA.
  const resign = () => {
    const policyBinding = put(plan.trainingPreviewPolicy.path, policy)
    plan.trainingPreviewPolicy = config.trainingPreviewPolicy = policyBinding
    const planBinding = put(`${plan.outputRoot}/quality-plan.json`, plan)
    envelope.outputRoot = plan.outputRoot
    envelope.inputEvidence = [planBinding, policyBinding, model, manifest, train]
    parent.executionPackage = put(executionPackage.path, envelope)
    collection.policy = policyBinding; collection.plan = planBinding
    for (const frame of frames) Object.assign(frame, { policy: policyBinding, plan: planBinding,
      executionPackage: parent.executionPackage, configurationSha256: previewIdentityHash(config) })
    commit()
  }
  return { root, outputRoot, put, parent, frames, collection, commit, read, resign, options, policy, plan, envelope, config, executionPackage }
}

test('normal and failed terminal manifests preserve diagnostic-only image identity without claiming a checkpoint', async t => {
  const f = fixture(t, 2)
  for (const executionState of ['completed', 'failed_closed']) {
    f.parent.executionState = executionState
    const result = await f.read()
    assert.equal(result.status, 'available', JSON.stringify(result))
    assert.equal(result.images.length, 2)
    for (const image of result.images) {
      assert.equal(image.metadata.evidenceKind, 'training_diagnostic_preview')
      assert.equal(image.metadata.passed, undefined)
      assert.equal(image.metadata.checkpointSelectionEligible, false)
      assert.equal(image.metadata.modelBindingMeaning, 'identity_metadata_not_step_weights')
    }
  }
})

test('configuration digest agrees with producer Python canonical exponent and Unicode bytes', () => {
  assert.equal(previewIdentityHash({ optimizer: { eps: 1e-8, lr: 0.00001 }, unicode: '世界😀' }),
    'cbbc9016827ddeadb71be5c96bb6bb6850e4afdd456938610e8c32b36e16376a')
})

for (const version of [2, 3, 4, 5]) test(`registered v${version} policy original bytes work with a fresh isolated plan/package, no pinned policy SHA`, async t => {
  const f = fixture(t, 1, version)
  const logical = `data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v${version}.json`
  const raw = fs.readFileSync(new URL(`../../${logical}`, import.meta.url)), policy = JSON.parse(raw)
  const policyBinding = f.put(logical, raw)
  assert.equal(policyBinding.sha256, digest(raw))
  f.plan.trainingPreviewPolicy = f.config.trainingPreviewPolicy = policyBinding
  f.plan.programBindings = policy.programBindings
  const planBinding = f.put(`${f.outputRoot}/quality-plan.json`, f.plan)
  f.envelope.inputEvidence = f.envelope.inputEvidence.map(item => item.path === logical ? policyBinding
    : item.path === planBinding.path ? planBinding : item)
  f.envelope.programLineage = Object.fromEntries(Object.entries(policy.programBindings).map(([key, value]) => [key, value.sha256]))
  f.parent.executionPackage = f.put(f.executionPackage.path, f.envelope)
  f.collection.policy = policyBinding; f.collection.plan = planBinding
  Object.assign(f.frames[0], { policy: policyBinding, plan: planBinding, executionPackage: f.parent.executionPackage,
    configurationSha256: previewIdentityHash(f.config), programBindingsSha256: previewIdentityHash(f.plan.programBindings) })
  f.commit()
  const result = await f.read()
  assert.equal(result.status, 'available', JSON.stringify(result))
  assert.equal(result.images[0].metadata.qualificationEvidence, false)
  t.diagnostic(JSON.stringify({ policySha256: policyBinding.sha256, scope: 'synthetic_fixture_only_not_production_acceptance' }))
})

test('v3 final-RGB capability and new root preserve terminal and verified-current preview ABI', async t => {
  const f = fixture(t, 2, 3)
  assert.match(f.plan.outputRoot, /^\.runtime\/ai-painter\/final-rgb-base-weight-quality-executions\//u)
  assert.equal((await f.read()).images.length, 2)
  const progress = { ...f.parent, latestTrainingPreview: f.collection.entries[1] }
  const live = await f.read({ manifestBinding: null, progress, progressVerified: true })
  assert.equal(live.status, 'available', JSON.stringify(live))
  assert.equal(live.images[0].metadata.epoch, 2)
  assert.equal(live.images[0].metadata.formalOutput, false)
})

for (const version of [4, 5]) test(`v${version} joint-priority capability preserves terminal and verified-current preview ABI without new plan schemas`, async t => {
  const f = fixture(t, 2, version)
  assert.equal(f.plan.schema, 'object-support-structure-quality-plan-v1')
  assert.equal(f.config.schema, 'object-support-structure-quality-configuration-v1')
  assert.match(f.plan.outputRoot, /^\.runtime\/ai-painter\/joint-object-priority-quality-executions\//u)
  for (const metadataOnly of [false, true]) {
    const history = await f.read({ metadataOnly })
    assert.equal(history.status, 'available', JSON.stringify(history))
    assert.equal(history.images.length, 2)
    const live = await f.read({ manifestBinding: null, progress: { ...f.parent, latestTrainingPreview: f.collection.entries[1] }, progressVerified: true, metadataOnly })
    assert.equal(live.status, 'available', JSON.stringify(live))
    assert.equal(live.images[0].metadata.epoch, 2)
    for (const field of ['formalOutput', 'checkpointSelectionEligible', 'qualificationEvidence', 'runtimePublicationEligible'])
      assert.equal(live.images[0].metadata[field], false)
    assert.equal(live.images[0].metadata.verificationStatus, metadataOnly ? 'binding_verified_bytes_not_read' : 'bytes_verified')
  }
})

test('v5 accepts the joint candidate 260-source metadata closure without increasing preview read budgets', async t => {
  const f = fixture(t, 1, 5)
  for (let index = 1; index < 260; index++) f.plan.programBindings[`source-${index}`] = f.put(
    `ml/ai-painter/fixture/source-${index}.txt`, `synthetic source metadata ${index}`)
  f.envelope.programLineage = Object.fromEntries(Object.entries(f.plan.programBindings).map(([key, value]) => [key, value.sha256]))
  f.resign()
  f.frames[0].programBindingsSha256 = previewIdentityHash(f.plan.programBindings); f.commit()
  assert.equal(Object.keys(f.plan.programBindings).length, 260)
  for (const metadataOnly of [true, false]) {
    const result = await f.read({ metadataOnly })
    assert.equal(result.status, 'available', JSON.stringify(result))
    assert.equal(result.images.length, 1)
    assert.ok(result.bytesVerified <= 16 * 1024 * 1024)
  }
})

for (const version of [4, 5]) for (const [label, mutate] of [
  ['wrong schema', f => { f.policy.schemaVersion = `ai-painter-training-preview-observation-policy-v${version - 1}` }],
  ['previous policy path', f => { f.plan.trainingPreviewPolicy.path = `data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v${version - 1}.json` }],
  ['wrong capability', f => {
    const old = 'stage4_mvp256_dry_final_rgb_base_weight_quality24_v1'
    f.parent.capabilityVersion = f.plan.capabilityVersion = f.config.capabilityVersion = f.envelope.capabilityVersion = old
  }],
  ['wrong configuration model', f => { f.config.modelCapabilityVersion = 'foreign-model' }],
  ['v3 output root', f => { f.plan.outputRoot = `.runtime/ai-painter/final-rgb-base-weight-quality-executions/${f.parent.runId}` }],
  ['another Run root', f => { f.plan.outputRoot += '-other' }],
  ['scope capability conflict', f => { f.policy.scope.capabilityVersion = 'foreign' }],
  ['scope model conflict', f => { f.policy.scope.modelCapabilityVersion = 'foreign' }],
  ['scope root conflict', f => { f.policy.scope.outputRootPrefix = '.runtime/ai-painter/foreign/' }],
  ...['capabilityVersion', 'modelCapabilityVersion', 'outputRootPrefix'].map(key => [`missing required scope ${key}`, f => { delete f.policy.scope[key] }]),
  ['larger capture count', f => { f.policy.capture.maxFrames = 25 }],
  ['larger preview byte budget', f => { f.policy.resources.maxPreviewBytes++ }],
]) test(`v${version} metadata and exact-image reads reject ${label} after re-signing parents`, async t => {
  const f = fixture(t, 1, version); mutate(f); f.resign()
  for (const metadataOnly of [false, true]) {
    const result = await f.read({ metadataOnly })
    assert.equal(result.images.length, 0)
    assert.notEqual(result.status, 'available')
  }
})

for (const version of [4, 5]) for (const field of ['configurationSha256', 'programBindingsSha256']) test(`v${version} rejects a changed ${field} summary in both metadata and precise-image reads`, async t => {
  const f = fixture(t, 1, version)
  f.frames[0][field] = 'f'.repeat(64); f.commit()
  const artifactId = digest(JSON.stringify([f.parent.runId, 'image', f.frames[0].image.path, f.frames[0].image.sha256]))
  for (const options of [{ metadataOnly: true }, { artifactId }]) {
    const result = await f.read(options)
    assert.equal(result.images.length, 0)
    assert.equal(result.gaps[0].status, 'unavailable')
  }
})

for (const version of [4, 5]) for (const variant of ['duplicate', 'mixed-versions', 'input-sha', 'plan-config-conflict', 'policy-byte-change'])
  test(`v${version} rejects ${variant} policy bindings without falling back to v${version - 1}`, async t => {
    const f = fixture(t, 1, version)
    if (variant === 'duplicate') f.envelope.inputEvidence.push(structuredClone(f.plan.trainingPreviewPolicy))
    if (variant === 'mixed-versions') f.envelope.inputEvidence.push(f.put(`data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v${version - 1}.json`, { schemaVersion: `ai-painter-training-preview-observation-policy-v${version - 1}` }))
    if (variant === 'input-sha') f.envelope.inputEvidence = f.envelope.inputEvidence.map(item => item.path === f.plan.trainingPreviewPolicy.path ? { ...item, sha256: 'f'.repeat(64) } : item)
    if (variant === 'plan-config-conflict') f.config.trainingPreviewPolicy = { ...f.config.trainingPreviewPolicy, sha256: 'f'.repeat(64) }
    if (variant === 'policy-byte-change') fs.appendFileSync(path.join(f.root, f.plan.trainingPreviewPolicy.path), 'changed')
    const plan = f.put(`${f.outputRoot}/quality-plan.json`, f.plan)
    f.envelope.inputEvidence = f.envelope.inputEvidence.map(item => item.path === plan.path ? plan : item)
    f.parent.executionPackage = f.put(f.executionPackage.path, f.envelope)
    const result = await f.read({ metadataOnly: true })
    assert.equal(result.images.length, 0)
    assert.notEqual(result.status, 'available')
  })

for (const [label, mutate] of [
  ['unknown policy path', f => { f.plan.trainingPreviewPolicy.path = 'data/ai-painter/system-governance/preview-v99.json' }],
  ['v3 path with v2 schema', f => { f.policy.schemaVersion = 'ai-painter-training-preview-observation-policy-v2' }],
  ['v2 path with v3 schema', f => { f.plan.trainingPreviewPolicy.path = 'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v2.json' }],
  ['v3 under the old output root', f => { f.plan.outputRoot = `.runtime/ai-painter/object-support-structure-quality-executions/${f.parent.runId}` }],
  ['other Run directory', f => { f.plan.outputRoot += '-other-run' }],
  ['cross-version capability', f => {
    const old = 'stage4_mvp256_dry_object_support_structure_quality24_v1'
    f.parent.capabilityVersion = f.plan.capabilityVersion = f.config.capabilityVersion = f.envelope.capabilityVersion = old
  }],
  ['policy capability scope', f => { f.policy.scope.capabilityVersion = 'foreign' }],
  ['policy model scope', f => { f.policy.scope.modelCapabilityVersion = 'foreign' }],
  ['policy output scope', f => { f.policy.scope.outputRootPrefix = '.runtime/ai-painter/other/' }],
  ['missing v3 scope', f => { delete f.policy.scope.capabilityVersion }],
  ['configuration model identity', f => { f.config.modelCapabilityVersion = 'foreign' }],
]) test(`v3 rejects ${label} after re-signing fixture parents`, async t => {
  const f = fixture(t, 1, 3); mutate(f); f.resign()
  const opened = [], result = await f.read({ readBytes: async (bound, maximum) => {
    opened.push(bound.path); return f.options.readBytes(bound, maximum)
  } })
  assert.equal(result.images.length, 0)
  assert.notEqual(result.status, 'available')
  if (label === 'unknown policy path') assert.ok(!opened.some(logical => logical.endsWith('preview-v99.json')))
})

for (const variant of ['duplicate', 'both-versions', 'package-sha', 'different-plan-config', 'missing-plan', 'missing-configuration'])
  test(`v3 rejects ambiguous or inconsistent policy declarations: ${variant}`, async t => {
    const f = fixture(t, 1, 3)
    if (variant === 'duplicate') f.envelope.inputEvidence.push(structuredClone(f.plan.trainingPreviewPolicy))
    if (variant === 'both-versions') f.envelope.inputEvidence.push(f.put(
      'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v2.json',
      { schemaVersion: 'ai-painter-training-preview-observation-policy-v2' }))
    if (variant === 'package-sha') f.envelope.inputEvidence.find(item => item.path.endsWith('policy-v3.json')).sha256 = 'a'.repeat(64)
    if (variant === 'different-plan-config') f.config.trainingPreviewPolicy = { ...f.config.trainingPreviewPolicy, sha256: 'b'.repeat(64) }
    if (variant === 'missing-plan') delete f.plan.trainingPreviewPolicy
    if (variant === 'missing-configuration') delete f.config.trainingPreviewPolicy
    const planBinding = f.put(`${f.outputRoot}/quality-plan.json`, f.plan)
    f.envelope.inputEvidence = f.envelope.inputEvidence.map(item => item.path === planBinding.path ? planBinding : item)
    f.parent.executionPackage = f.put(f.executionPackage.path, f.envelope)
    const result = await f.read()
    assert.equal(result.images.length, 0)
    assert.notEqual(result.status, 'available')
  })

for (const variant of ['cross-run', 'image-sha', 'policy-byte-change']) test(`v3 preserves byte/Run rejection: ${variant}`, async t => {
  const f = fixture(t, 1, 3)
  if (variant === 'cross-run') { f.frames[0].runId = 'foreign'; f.commit() }
  if (variant === 'image-sha') fs.appendFileSync(path.join(f.root, f.frames[0].image.path), 'changed')
  if (variant === 'policy-byte-change') fs.appendFileSync(path.join(f.root, f.plan.trainingPreviewPolicy.path), 'changed')
  const result = await f.read()
  assert.equal(result.images.length, 0)
  assert.notEqual(result.status, 'available')
})

for (const target of ['plan', 'configuration', 'conflict']) test(`both frozen policy links are required: ${target}`, async t => {
  const f = fixture(t)
  if (target === 'plan') delete f.plan.trainingPreviewPolicy
  if (target === 'configuration') delete f.config.trainingPreviewPolicy
  if (target === 'conflict') f.config.trainingPreviewPolicy = { ...f.plan.trainingPreviewPolicy, sha256: 'a'.repeat(64) }
  const updatedPlan = f.put(`${f.outputRoot}/quality-plan.json`, f.plan)
  f.envelope.inputEvidence = f.envelope.inputEvidence.map(item => item.path === updatedPlan.path ? updatedPlan : item)
  f.parent.executionPackage = f.put(f.executionPackage.path, f.envelope)
  const result = await f.read()
  assert.equal(result.images.length, 0)
  assert.equal(result.status, 'unavailable')
})

test('active progress entry is unavailable without the original verified progress boundary', async t => {
  const f = fixture(t)
  const progress = { ...f.parent, latestTrainingPreview: f.collection.entries[0] }
  const unverified = await f.read({ manifestBinding: null, progress, progressVerified: false })
  assert.equal(unverified.images.length, 0)
  const verified = await f.read({ manifestBinding: null, progress, progressVerified: true })
  assert.equal(verified.status, 'available', JSON.stringify(verified))
  progress.runId = 'foreign'
  assert.equal((await f.read({ manifestBinding: null, progress, progressVerified: true })).images.length, 0)
})

test('current preview reads only the progress SHA accepted by the existing validator and rejects pointer changes', async t => {
  const f = fixture(t)
  const progress = { ...f.parent, schemaVersion: 'ai-painter-current-training-progress-v1', latestTrainingPreview: f.collection.entries[0] }
  const progressBinding = f.put(`${f.outputRoot}/progress.json`, progress)
  const registry = { ...f.parent, activeExecution: { processId: 123, processStartIdentity: 'synthetic-process-birth' } }
  const currentBinding = f.put('.runtime/ai-painter/current-execution-registry/current.json', registry)
  const current = { ok: true, registry, registrySha256: currentBinding.sha256 }
  const metrics = { availability: 'available', runId: registry.runId, ...registry.activeExecution,
    sourcePath: progressBinding.path, sourceSha256: progressBinding.sha256, sourceIdentity: 'current_registry_bound_progress_v1' }
  const calls = [], options = { runId: registry.runId, currentPath: currentBinding.path,
    readRegistry: async () => current, readPresentation: async () => ({ currentMetrics: metrics }),
    readJson: async bound => { calls.push(bound); return JSON.parse((await bytes(f.root, bound.path, 2 * 1024 * 1024, bound.sha256)).value) } }
  assert.deepEqual(await readTrustedTrainingPreviewProgress(options), progress)
  assert.deepEqual(calls, [progressBinding, currentBinding])
  fs.appendFileSync(path.join(f.root, currentBinding.path), 'changed')
  await assert.rejects(() => readTrustedTrainingPreviewProgress(options), /history_sha_mismatch/u)
  current.ok = false
  await assert.rejects(() => readTrustedTrainingPreviewProgress(options), /current_registry_unavailable/u)
})

test('inactive/foreign current Run, rejected metrics and mismatched process cannot surface active preview', async t => {
  const f = fixture(t)
  const current = { ok: true, registry: { ...f.parent, activeExecution: null } }
  const options = { runId: f.parent.runId, readRegistry: async () => current,
    readPresentation: async () => ({ currentMetrics: { availability: 'unavailable' } }),
    readJson: async () => { throw new Error('untrusted file must not be read') } }
  assert.equal(await readTrustedTrainingPreviewProgress(options), null)
  current.registry.activeExecution = { processId: 123, processStartIdentity: 'synthetic-birth' }
  current.registry.runId = 'foreign'
  assert.equal(await readTrustedTrainingPreviewProgress(options), null)
  current.registry.runId = f.parent.runId
  await assert.rejects(() => readTrustedTrainingPreviewProgress(options), /current_progress_unavailable/u)
  options.readPresentation = async () => ({ currentMetrics: { availability: 'available', runId: f.parent.runId,
    processId: 124, processStartIdentity: 'wrong-birth', sourceIdentity: 'current_registry_bound_progress_v1' } })
  await assert.rejects(() => readTrustedTrainingPreviewProgress(options), /current_progress_unavailable/u)
})

for (const [label, change] of [
  ['foreign Run', frame => { frame.runId = 'foreign' }],
  ['foreign package', frame => { frame.packageId = 'foreign' }],
  ['foreign capability', frame => { frame.capabilityVersion = 'foreign' }],
  ['foreign model', frame => { frame.modelCapabilityVersion = 'foreign' }],
  ['wrong sample', frame => { frame.sampleId = 'train-9' }],
  ['validation split', frame => { frame.split = 'validation' }],
  ['wrong train index', frame => { frame.trainIndex = 2 }],
  ['wrong ordinal', frame => { frame.trainOrdinal = 1 }],
  ['wrong count', frame => { frame.optimizerSteps.generator++ }],
  ['negative epoch', frame => { frame.epoch = -1 }],
  ['new forward phase', frame => { frame.phase = 'after_generator_update' }],
  ['wrong config SHA', frame => { frame.configurationSha256 = 'a'.repeat(64) }],
  ['wrong program SHA', frame => { frame.programBindingsSha256 = 'a'.repeat(64) }],
  ['different source RGB', frame => { frame.sourceRgb.sha256 = 'a'.repeat(64) }],
  ['different world facts', frame => { frame.worldFacts.sha256 = 'a'.repeat(64) }],
  ['different tick', frame => { frame.tick = 9 }],
  ['unknown schema', frame => { frame.schemaVersion = 'unsupported-v9' }],
  ['formal output claim', frame => { frame.formalOutput = true }],
  ['object qualification claim', frame => { frame.qualificationEvidence = { passed: true } }],
  ['path traversal', frame => { frame.image.path = '.runtime/ai-painter/../foreign.png' }],
  ['absolute path', frame => { frame.image.path = 'C:/private.png' }],
]) test(`preview rejects ${label} but retains another successful frame`, async t => {
  const f = fixture(t, 2); change(f.frames[0]); f.commit()
  const result = await f.read()
  assert.equal(result.status, 'partial', JSON.stringify(result))
  assert.equal(result.images.length, 1)
  assert.equal(result.images[0].metadata.epoch, 2)
})

for (const target of ['record', 'image']) test(`changed ${target} bytes cannot use a stale binding`, async t => {
  const f = fixture(t, 2), bound = f.collection.entries[0][target]
  fs.appendFileSync(path.join(f.root, bound.path), 'changed')
  const result = await f.read()
  assert.equal(result.status, 'partial')
  assert.equal(result.gaps[0].status, 'hash_conflict')
  assert.equal(result.images.length, 1)
})

test('missing, capture failure, absent registration and unsupported manifest stay distinct', async t => {
  const f = fixture(t)
  fs.unlinkSync(path.join(f.root, f.collection.entries[0].image.path))
  assert.equal((await f.read()).status, 'missing')
  assert.equal((await f.read({ manifestBinding: null })).status, 'not_recorded')
  f.frames.length = 0; f.collection.secondaryError = { message: 'secret=not-public' }; f.commit()
  const failed = await f.read()
  assert.equal(failed.status, 'capture_failed')
  assert.ok(!JSON.stringify(failed).includes('secret='))
  f.collection.schemaVersion = 'unsupported-v2'; f.commit()
  assert.equal((await f.read()).status, 'unsupported_schema')
})

for (const code of ['capture_failed', 'budget_exhausted', 'publication_incomplete', 'binding_mismatch', 'unknown-secret-code'])
  test(`explicit producer availability ${code} preserves good previews and never parses raw error text`, async t => {
    const f = fixture(t)
    f.collection.secondaryError = { availabilityCode: code, message: 'secret=private error path; budget exhausted' }; f.commit()
    const partial = await f.read()
    assert.equal(partial.status, 'partial')
    assert.equal(partial.images.length, 1)
    assert.equal(partial.reasonCode, code === 'unknown-secret-code' ? 'capture_failed' : code)
    assert.ok(!JSON.stringify(partial).includes('secret='))
    f.frames.length = 0; f.commit()
    assert.equal((await f.read()).status, code === 'unknown-secret-code' ? 'capture_failed' : code)
  })

test('forged passed metadata never supplies review authority', async t => {
  const f = fixture(t)
  for (const passed of [true, { approved: true }, 'true']) {
    f.frames[0].passed = passed; f.commit()
    const result = await f.read()
    assert.equal(result.status, 'available')
    assert.equal(result.images[0].metadata.passed, undefined)
    assert.equal(result.images[0].metadata.formalOutput, false)
  }
})

test('freshly rebound corrupt PNG and excessive manifests are not accepted as diagnostic images', async t => {
  const f = fixture(t)
  const raw = png(); raw[raw.length - 1] ^= 1
  f.frames[0].image = { ...f.put(f.frames[0].image.path, raw), bytes: raw.length }; f.commit()
  assert.equal((await f.read()).images.length, 0)
  f.collection.entries = Array(25).fill(f.collection.entries[0])
  f.parent.trainingPreviewManifest = f.put(`${f.outputRoot}/training-previews/manifest.json`, f.collection)
  const limited = await f.read()
  assert.equal(limited.images.length, 0)
  assert.ok(limited.gaps.length > 0)
})

test('source file mutations are re-read even after a successful preview request', async t => {
  const f = fixture(t)
  assert.equal((await f.read()).status, 'available')
  fs.appendFileSync(path.join(f.root, f.frames[0].sourceRgb.path), 'changed original bytes')
  const second = await f.read()
  assert.equal(second.images.length, 0)
  assert.equal(second.gaps[0].status, 'hash_conflict')
})

for (const version of [3, 4, 5]) test(`v${version}: all 24 preview bindings remain listable without eager image/source bodies; exact last-image GET still fully verifies`, async t => {
  const f = fixture(t, 24, version), reads = []
  f.parent.completedEpochs = 24
  f.parent.optimizerSteps = { generator: 1152, discriminator: 1152 }
  f.parent.optimizerStepsGenerator = f.parent.optimizerStepsDiscriminator = 1152
  const readBytes = async (b, max) => {
    reads.push(b.path)
    return f.options.readBytes(b, max)
  }
  const listed = await f.read({ metadataOnly: true, readBytes })
  assert.equal(listed.status, 'available', JSON.stringify(listed))
  assert.equal(listed.images.length, 24)
  assert.ok(listed.images.every(image => image.metadata.verificationStatus === 'binding_verified_bytes_not_read'))
  assert.ok(!reads.includes(f.frames[0].sourceRgb.path))
  assert.ok(!reads.includes(f.frames[0].worldFacts.path))
  assert.ok(f.frames.every(frame => !reads.includes(frame.image.path)))
  const selected = f.frames[23]
  const artifactId = digest(JSON.stringify([f.parent.runId, 'image', selected.image.path, selected.image.sha256]))
  reads.length = 0
  const precise = await f.read({ artifactId, readBytes })
  assert.equal(precise.status, 'available', JSON.stringify(precise))
  assert.equal(precise.images.length, 1)
  assert.equal(precise.images[0].binding.path, selected.image.path)
  assert.equal(precise.images[0].metadata.verificationStatus, 'bytes_verified')
  assert.ok(reads.includes(selected.sourceRgb.path) && reads.includes(selected.worldFacts.path))
  assert.ok(reads.includes(selected.image.path))
  assert.ok(!reads.includes(f.frames[0].image.path))
  // A displayed binding is not permission to return bytes after a mutation.
  fs.appendFileSync(path.join(f.root, selected.image.path), 'changed')
  const changed = await f.read({ artifactId })
  assert.equal(changed.images.length, 0)
  assert.equal(changed.gaps[0].status, 'hash_conflict')
})

for (const version of [3, 4, 5]) test(`v${version}: metadata binding never bypasses exact-image source, world-facts or PNG validation`, async t => {
  for (const target of ['sourceRgb', 'worldFacts', 'image']) {
    const f = fixture(t, 1, version), frame = f.frames[0]
    const artifactId = digest(JSON.stringify([f.parent.runId, 'image', frame.image.path, frame.image.sha256]))
    assert.equal((await f.read({ metadataOnly: true })).images.length, 1)
    fs.appendFileSync(path.join(f.root, frame[target].path), 'changed')
    const result = await f.read({ artifactId })
    assert.equal(result.images.length, 0, target)
    assert.equal(result.gaps[0].status, 'hash_conflict', target)
  }
})

for (const version of [2, 3, 4, 5]) test(`v${version}: existing detail adapter appends previews and retains real failure counts and all original evidence`, async t => {
  const f = fixture(t, 1, version)
  const previous = process.env.AI_CONSOLE_HISTORY_ROOT
  process.env.AI_CONSOLE_HISTORY_ROOT = f.root
  t.after(() => { if (previous === undefined) delete process.env.AI_CONSOLE_HISTORY_ROOT; else process.env.AI_CONSOLE_HISTORY_ROOT = previous })
  const terminalBinding = f.put(`${f.outputRoot}/worker-terminal.json`, f.parent)
  const initial = { role: 'terminal', artifactId: 'original', logicalPath: terminalBinding.path, sha256: terminalBinding.sha256 }
  const record = { runId: f.parent.runId, terminalBinding, artifacts: [initial], samples: [], metrics: [], checkpoints: [], qualification: {} }
  const result = await adaptLegacyTrainingDetail({ runId: record.runId, terminal: f.parent, record,
    base: { unavailableFields: [] }, requireFact,
    readJson: async b => JSON.parse((await bytes(f.root, b.path, 2 * 1024 * 1024, b.sha256)).value),
    makeArtifact: (role, b, metadata) => ({ role, logicalPath: b.path, sha256: b.sha256, artifactId: digest(b.path + b.sha256), ...metadata }),
    checkpointMetadata: async () => { throw new Error('no checkpoint should be read') } })
  assert.equal(result.record.detailCoverage.trainingPreview.status, 'available', JSON.stringify(result))
  assert.ok(result.record.artifacts.includes(initial))
  assert.equal(result.record.artifacts.filter(image => image.role === 'image').length, 1)
  assert.deepEqual(result.record.optimizerSteps, { generator: 539, discriminator: 540 })
  assert.equal(result.record.checkpoints.length, 0)
})
