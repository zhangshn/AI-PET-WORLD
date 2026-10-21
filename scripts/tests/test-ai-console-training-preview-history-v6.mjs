import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'
import { listTrainingHistory, readTrainingRun, readTrainingArtifact } from '../../src/server/ai-console/training-history-store.mjs'
import { readBoundTrainingPresentation } from '../../src/server/ai-console/bound-training-presentation.mjs'
import { readTrainingPreviewHistory, previewIdentityHash } from '../../src/server/ai-console/training-preview-history-v1.mjs'
import { readCompletionTrainingObservation } from '../../src/server/ai-console/training-history-detail-adapters.mjs'
import { loadCurrentExecutionProjectionForCpu } from './helpers/current-execution-projection-cpu.mjs'
import { bytes } from '../../src/server/ai-console/training-history-safe-bytes.mjs'
import { deriveConfiguration, executionRoute } from '../lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs'

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
function fixture(t, frameCount = 1, policyVersion = 6, registered = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'console-preview-fixture-'))
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('console-preview-fixture-')); fs.rmSync(root, { recursive: true }) })
  const put = (logical, value) => {
    const raw = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw)
    return { path: logical, sha256: digest(raw) }
  }
  const scope = registered ? {capabilityVersion:registered.candidate,modelCapabilityVersion:registered.modelCapability,
    outputRootPrefix:registered.outputRoot+'/'} : policyVersion === 9 ? {
    capabilityVersion: 'stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1',
    modelCapabilityVersion: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    outputRootPrefix: '.runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions/',
  } : policyVersion === 8 ? {
    capabilityVersion: 'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2',
    modelCapabilityVersion: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    outputRootPrefix: '.runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions/',
  } : policyVersion === 7 ? {
    capabilityVersion: 'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1',
    modelCapabilityVersion: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    outputRootPrefix: '.runtime/ai-painter/decode1-entry-weight-quality-completion-executions/',
  } : policyVersion === 6 ? {
    capabilityVersion: 'stage4_mvp256_dry_decode1_entry_weight_quality24_v1',
    modelCapabilityVersion: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    outputRootPrefix: '.runtime/ai-painter/decode1-entry-weight-quality-executions/',
  } : [4, 5].includes(policyVersion) ? {
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
  const identity = { runId: registered?registered.interfaceContract.runPrefix+'fixture':'preview-fixture-run',
    packageId:registered?registered.interfaceContract.packagePrefix+'fixture':'preview-fixture-package', capabilityVersion: scope.capabilityVersion }
  const outputRoot = `${scope.outputRootPrefix}${identity.runId}`
  const program = put('ml/ai-painter/fixture/source.txt', 'synthetic non-executable source metadata')
  const policy = { schemaVersion: registered?'ai-painter-registered-training-preview-policy-v1':`ai-painter-training-preview-observation-policy-v${policyVersion}`,
    capture: { split: 'train', ordinal: 0, maxFrames: 24, maxFramesPerEpoch: 1,
      phase: 'after_discriminator_update_before_generator_update' }, programBindings: { storage: program },
    scope: { resolution: [256, 192], epochs: 24, trainSamples: 48, ...(registered||[3, 4, 5, 6, 7, 8, 9].includes(policyVersion) ? scope : {}) },
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
    ...(registered||[8, 9].includes(policyVersion) ? { gpuAdmissionWallMode: 'completion', gpuAdmissionSeconds: null } : {}),
    executionCeiling: { epochs: 24, generatorOptimizerSteps: 1152, discriminatorOptimizerSteps: 1152,
      ...(registered||[7, 8, 9].includes(policyVersion) ? { trainingWallMode: 'completion', maxWallSeconds: null } : {}) },
    checkpointSelection: { eligibleEpochs: [24], validationRowsPerEligibleEpoch: 8 } }
  const policyNumber = policyVersion === 9 ? 4 : policyVersion === 8 ? 3 : 2
  const executionProfile = registered?registered.executionProfile:policyVersion === 9 ? 'completion_decode1_entry_weight_quality24_same_call_v1' : 'completion_decode1_entry_weight_quality24_v2'
  let registeredPolicy=null
  if(registered){config.executionCeiling=structuredClone(registered.executionCeiling);config.progressPublicationPolicy=registered.progressPublication.componentPolicy;
    registeredPolicy={...structuredClone(registered),trainingPreviewPolicy:policyBinding}}
  let executionPolicy = registered?put('data/ai-painter/system-governance/synthetic-registered-policy.json',registeredPolicy):[7, 8, 9].includes(policyVersion) ? put(`data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v${policyNumber}.json`, {
    schemaVersion: `ai-painter-decode1-entry-weight-quality-execution-policy-v${policyNumber}`, candidate: identity.capabilityVersion,
    ...([8, 9].includes(policyVersion) ? { executionProfile,
      outputRoot: scope.outputRootPrefix.slice(0, -1), phaseResources: { gpuAdmissionWallMode: 'completion', gpuAdmissionSeconds: null },
      gpuAdmission: { sampleSplit: 'train', sampleCount: 48 } } : {}),
    executionCeiling: config.executionCeiling }) : null
  if (executionPolicy) config.executionPolicy = executionPolicy
  const plan = { schema: 'object-support-structure-quality-plan-v1', executionMode: 'bounded-quality-training',
    ...identity, outputRoot, trainingPreviewPolicy: policyBinding, configuration: config,
    ...(registered||[8, 9].includes(policyVersion) ? { executionProfile } : {}),
    ...(executionPolicy ? { executionPolicy } : {}),
    ...(registered?{interfacePolicy:executionPolicy}:{}),
    programBindings: { storage: program }, modelBinding: model, datasetManifest: manifest, trainSplit: train }
  const planBinding = put(`${outputRoot}/quality-plan.json`, plan)
  const envelope = { schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', packageIdentity: identity.packageId,
    capabilityVersion: identity.capabilityVersion, outputRoot, programLineage: { storage: program.sha256 },
    inputEvidence: [planBinding, policyBinding, model, manifest, train, ...(executionPolicy ? [executionPolicy] : [])] }
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
    if(registered){registeredPolicy.trainingPreviewPolicy=policyBinding;executionPolicy=put(executionPolicy.path,registeredPolicy);
      plan.interfacePolicy=plan.executionPolicy=config.executionPolicy=executionPolicy}
    const planBinding = put(`${plan.outputRoot}/quality-plan.json`, plan)
    envelope.programLineage = Object.fromEntries(Object.entries(plan.programBindings).map(([key, value]) => [key, value.sha256]))
    envelope.outputRoot = plan.outputRoot
    envelope.inputEvidence = [planBinding, policyBinding, model, manifest, train, ...(executionPolicy ? [executionPolicy] : [])]
    parent.executionPackage = put(executionPackage.path, envelope)
    collection.policy = policyBinding; collection.plan = planBinding
    for (const frame of frames) Object.assign(frame, { policy: policyBinding, plan: planBinding,
      executionPackage: parent.executionPackage, configurationSha256: previewIdentityHash(config),
      programBindingsSha256: previewIdentityHash(plan.programBindings) })
    commit()
  }
  return { root, outputRoot, put, parent, frames, collection, commit, read, resign, options, policy, plan, envelope, config, executionPackage,registeredPolicy }
}

for(const suffix of ['first','second'])test(`registered interface: ${suffix} candidate uses unchanged preview/timing consumers`,async t=>{
  const policy=JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v5.json'))
  const selector=`synthetic-interface-${suffix}`;policy.candidate=`synthetic_interface_${suffix}_v1`;policy.candidateSelection=selector
  policy.outputRoot=`.runtime/ai-painter/registered-training-${selector}-executions`
  policy.executionProfile=`synthetic_interface_${suffix}_profile`
  Object.assign(policy.interfaceContract,{candidateSelection:selector,runPrefix:selector+'-',packagePrefix:selector+'-package-'})
  const f=fixture(t,1,10,policy),sentinel=f.put('data/synthetic/readonly-sentinel',Buffer.from('unchanged'))
  const before=fs.readFileSync(path.join(f.root,sentinel.path))
  const result=await f.read();assert.equal(result.status,'available',JSON.stringify(result));assert.equal(result.verifiedCount,1)
  assert.equal((await readCompletionTrainingObservation(f.root,f.parent)).trainingWallMode,'completion')
  assert.deepEqual(fs.readFileSync(path.join(f.root,'data/synthetic/readonly-sentinel')),before)
  assert.equal(fs.existsSync(path.join(f.root,'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json')),false,'history must not consult current index')
  for(const change of [p=>p.interfaceContract.protocols.progress='unknown-v9',p=>p.interfaceContract.adapterId='unregistered_adapter',
    p=>p.modelCapability='unregistered_model',p=>p.phaseResources.programFileCountMaximum=257,p=>p.executionCeiling.maxWallSeconds=1]){
    const original=structuredClone(f.registeredPolicy);change(f.registeredPolicy);f.resign();assert.notEqual((await f.read()).status,'available')
    Object.assign(f.registeredPolicy,original);f.resign();assert.equal((await f.read()).status,'available')
  }
})

test('v1: unsupported preview contract stays rejected', async t => {
  const f = fixture(t, 1, 1)
  assert.equal((await f.read()).status, 'unsupported_schema')
})

test('registered completion routes share the documented policy and preview version mapping', () => {
  const api = fs.readFileSync(new URL('../../docs/ai-console/AI_CONSOLE_DATA_DICTIONARY_AND_API_CONTRACT.md', import.meta.url), 'utf8')
  const rows = api.split('\n').filter(line => /^\| (?:1\.98|1\.99|1\.105) \|/u.test(line))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim().replaceAll('`', '')))
  for (const [version, capability] of [[7, 'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1'],
    [8, 'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2'],
    [9, 'stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1']]) {
    const route = executionRoute(capability)
    const policy = JSON.parse(fs.readFileSync(new URL(`../../${route.EXECUTION_POLICY.path}`, import.meta.url), 'utf8'))
    const matching = rows.filter(row => row[1] === capability)
    assert.equal(matching.length, 1, `exact documentation mapping for ${capability}`)
    assert.equal(matching[0][2], policy.schemaVersion)
    assert.equal(matching[0][3], `v${version}`)
    assert.equal(route.previewPath, `data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v${version}.json`)
    const preview = JSON.parse(fs.readFileSync(new URL(`../../${route.previewPath}`, import.meta.url), 'utf8'))
    assert.equal(preview.scope.capabilityVersion, capability)
    assert.equal(preview.scope.outputRootPrefix, route.OUTPUT_ROOT + '/')
  }
})

for (const version of [7, 8, 9]) test(`v${version}: private fixture clock, identity, profile and policy match the actual pure producer definitions`, async t => {
  const f = fixture(t, 1, version)
  const route = executionRoute(f.parent.capabilityVersion)
  const candidate = JSON.parse(fs.readFileSync(new URL('../../data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json', import.meta.url), 'utf8'))
  const actual = deriveConfiguration(candidate, { capabilityVersion: route.CAPABILITY, trainingPreviewPolicy: f.plan.trainingPreviewPolicy })
  assert.equal(f.plan.executionMode, 'bounded-quality-training')
  assert.equal(actual.schema, f.config.schema)
  assert.equal(actual.capabilityVersion, f.config.capabilityVersion)
  assert.equal(actual.modelCapabilityVersion, f.config.modelCapabilityVersion)
  assert.equal(route.OUTPUT_ROOT + '/' + f.parent.runId, f.outputRoot)
  for (const key of ['epochs', 'generatorOptimizerSteps', 'discriminatorOptimizerSteps', 'trainingWallMode', 'maxWallSeconds'])
    assert.equal(actual.executionCeiling[key], f.config.executionCeiling[key])
  assert.equal(actual.executionPolicy.path, f.config.executionPolicy.path)
  f.plan.executionProfile = route.EXECUTION_PROFILE
  f.resign()
  assert.equal((await f.read()).status, 'available')
})

for (const version of [2, 3, 4, 5, 6, 7, 8, 9]) test(`v${version}: existing preview ABI remains readable`, async t => {
  const f = fixture(t, 1, version), result = await f.read()
  assert.equal(result.status, 'available', JSON.stringify(result))
  assert.equal(result.images.length, 1)
  assert.equal(result.images[0].metadata.formalOutput, false)
  assert.equal(result.images[0].metadata.checkpointSelectionEligible, false)
  assert.equal(result.images[0].metadata.qualificationEvidence, false)
  assert.equal(result.images[0].metadata.runtimePublicationEligible, false)
})

for (const version of [6, 7, 8, 9]) test(`v${version}: current registered policy bytes work only in a fresh private bound fixture`, async t => {
  const f = fixture(t, 1, version)
  const logical = `data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v${version}.json`
  const raw = fs.readFileSync(new URL(`../../${logical}`, import.meta.url)), policy = JSON.parse(raw)
  Object.assign(f.policy, policy)
  f.plan.programBindings = policy.programBindings
  f.resign()
  const result = await f.read()
  assert.equal(result.status, 'available', JSON.stringify(result))
  assert.equal(result.images[0].metadata.qualificationEvidence, false)
  t.diagnostic(JSON.stringify({ originalPolicySha256: digest(raw), scope: 'private_synthetic_fixture_not_production_adoption' }))
})

for (const version of [8, 9]) test(`v${version}: frozen execution-policy bytes bind actual GPU-completion configuration and training-worker timing only`, async t => {
  const f = fixture(t, 1, version)
  const policyVersion = version === 9 ? 4 : 3
  const logical = `data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v${policyVersion}.json`
  const raw = fs.readFileSync(new URL(`../../${logical}`, import.meta.url))
  assert.equal(digest(raw), version === 9 ? 'a9efa678657b7069b36f824487673e27d05a862b39a37a21bf3270d34624e2aa' : '851b6ad6c13794f9351325a3b9f6323295dd48c4dbad9a141f74074a7e0b2307')
  Object.assign(f.plan.executionPolicy, f.put(logical, raw))
  f.resign()
  bindTiming(f)
  const observed = await readCompletionTrainingObservation(f.root, f.parent)
  assert.equal(observed.trainingWallMode, 'completion', JSON.stringify(observed))
  assert.equal(observed.workerExecutionTiming.availability, 'available')
  assert.equal(observed.workerExecutionTiming.elapsedSeconds, 9001.25)
  assert.equal(Object.hasOwn(observed, 'gpuAdmissionWallMode'), false)
  assert.equal(Object.hasOwn(observed, 'gpuAdmissionSeconds'), false)
  assert.equal(Object.hasOwn(observed, 'gpuQualificationTiming'), false)
})

for (const version of [2, 3, 4, 5, 6]) test(`v${version}: re-signed v7 policy cannot authorize an old candidate`, async t => {
  const f = fixture(t, 1, version)
  f.policy.schemaVersion = 'ai-painter-training-preview-observation-policy-v7'
  f.plan.trainingPreviewPolicy.path = 'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v7.json'
  f.resign()
  assert.equal((await f.read()).images.length, 0)
})

for (const version of [2, 3, 4, 5, 6, 7]) test(`v${version}: re-signed v8 preview cannot authorize an old candidate`, async t => {
  const f = fixture(t, 1, version)
  f.policy.schemaVersion = 'ai-painter-training-preview-observation-policy-v8'
  f.plan.trainingPreviewPolicy.path = 'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v8.json'
  f.resign()
  assert.equal((await f.read()).images.length, 0)
})

for (const version of [2, 3, 4, 5, 6, 7, 8]) test(`v${version}: re-signed v9 preview cannot authorize an old candidate`, async t => {
  const f = fixture(t, 1, version)
  f.policy.schemaVersion = 'ai-painter-training-preview-observation-policy-v9'
  f.plan.trainingPreviewPolicy.path = 'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v9.json'
  f.resign()
  assert.equal((await f.read()).images.length, 0)
})

for (const version of [8, 9]) for (const mutation of ['missing-gpu-mode', 'missing-seconds', 'finite-seconds', 'old-profile', 'missing-profile', 'v2-policy', 'v2-schema', 'policy-gpu-mode', 'policy-gpu-seconds', 'policy-sample-count'])
  test(`v${version}: ${mutation} cannot adopt GPU completion via null or another route`, async t => {
    const f = fixture(t, 1, version)
    if (mutation === 'missing-gpu-mode') delete f.config.gpuAdmissionWallMode
    if (mutation === 'missing-seconds') delete f.config.gpuAdmissionSeconds
    if (mutation === 'finite-seconds') f.config.gpuAdmissionSeconds = 720
    if (mutation === 'old-profile') f.plan.executionProfile = 'completion_decode1_entry_weight_quality24_v1'
    if (mutation === 'missing-profile') delete f.plan.executionProfile
    if (mutation === 'v2-policy') f.plan.executionPolicy.path = 'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v2.json'
    if (mutation === 'v2-schema' || mutation.startsWith('policy-')) {
      const binding = f.plan.executionPolicy
      const policy = JSON.parse(fs.readFileSync(path.join(f.root, binding.path), 'utf8'))
      if (mutation === 'v2-schema') policy.schemaVersion = 'ai-painter-decode1-entry-weight-quality-execution-policy-v2'
      if (mutation === 'policy-gpu-mode') delete policy.phaseResources.gpuAdmissionWallMode
      if (mutation === 'policy-gpu-seconds') policy.phaseResources.gpuAdmissionSeconds = 720
      if (mutation === 'policy-sample-count') policy.gpuAdmission.sampleCount = 47
      Object.assign(binding, f.put(binding.path, policy))
    }
    f.resign()
    const result = await readCompletionTrainingObservation(f.root, f.parent)
    assert.equal(result.trainingWallMode, null, JSON.stringify(result))
    assert.equal(result.workerExecutionTiming.availability, 'unavailable')
  })

for (const version of [8, 9]) for (const phase of ['qualification', 'gpu_qualification']) test(`v${version}: ${phase} failure never becomes training or receives training-worker duration`, async t => {
  const f = fixture(t, 1, version)
  bindTiming(f)
  delete f.parent.schema
  delete f.parent.trainingPreviewManifest
  delete f.parent.completedEpochs
  delete f.parent.optimizerSteps
  delete f.parent.optimizerStepsGenerator
  delete f.parent.optimizerStepsDiscriminator
  f.parent.phase = phase
  registerFixture(t, f)
  const detail = await readTrainingRun(f.parent.runId, { root: f.root })
  assert.equal(detail.record.runKind, 'bounded_gpu_qualification')
  assert.equal(detail.record.trainingStatus, null)
  assert.equal(detail.record.completedEpochs, null)
  assert.deepEqual(detail.record.optimizerSteps, { generator: null, discriminator: null })
  assert.equal(detail.record.workerExecutionTiming.availability, 'unavailable')
  assert.equal(detail.record.workerExecutionTiming.elapsedSeconds, null)
  assert.equal(detail.record.artifacts.some(item => item.evidenceKind === 'workerExecutionTiming'), false)
})

for (const version of [2, 3, 4, 5, 6, 7]) test(`v${version}: a bare GPU null never acquires the new completion_v2 identity`, async t => {
  const f = fixture(t, 1, version)
  f.config.gpuAdmissionSeconds = null
  f.resign()
  const observed = await readCompletionTrainingObservation(f.root, f.parent)
  if (version !== 7) assert.equal(observed, null)
  else assert.equal(Object.hasOwn(observed, 'gpuAdmissionWallMode'), false)
  // Existing preview identity remains its original policy/capability, never v8.
  assert.equal((await f.read()).status, 'available')
  assert.notEqual(f.parent.capabilityVersion, 'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2')
})

for (const version of [6, 7, 8, 9]) test(`v${version}: unregistered completion-quality-training mode stays rejected`, async t => {
  const f = fixture(t, 1, version)
  f.plan.executionMode = 'completion-quality-training'
  f.resign()
  assert.equal((await f.read()).images.length, 0)
  if ([7, 8, 9].includes(version)) assert.equal((await readCompletionTrainingObservation(f.root, f.parent)).trainingWallMode, null)
})

for (const mode of ['completion', null]) test(`v7: parent failure preserves explicit clock fields only (${mode}) and no missing-manifest retrofit`, async t => {
  const f = fixture(t, 1, 7)
  if (mode === null) delete f.config.executionCeiling.trainingWallMode
  f.resign()
  delete f.parent.schema
  delete f.parent.trainingPreviewManifest
  delete f.parent.completedEpochs
  delete f.parent.optimizerSteps
  delete f.parent.optimizerStepsGenerator
  delete f.parent.optimizerStepsDiscriminator
  Object.assign(f.parent, { phase: 'training', error: 'Error: worker_exit_1', updatedAtUtc: '2026-10-18T18:00:00.000Z' })
  registerFixture(t, f)
  const detail = await readTrainingRun(f.parent.runId, { root: f.root })
  assert.equal(detail.record.detailCoverage.adapter, 'managed_parent_execution_failure', JSON.stringify(detail))
  assert.equal(detail.record.trainingPlan.trainingWallMode, mode === null ? null : 'completion', JSON.stringify(detail.record.workerExecutionTiming))
  assert.equal(detail.record.trainingPlan.maxWallSeconds, null)
  assert.equal(detail.record.startedAtUtc, null)
  assert.equal(detail.record.finishedAtUtc, null)
  assert.equal(detail.record.elapsedMs, undefined)
  assert.equal(detail.record.completedEpochs, null)
  assert.deepEqual(detail.record.optimizerSteps, { generator: null, discriminator: null })
  assert.equal(detail.record.artifacts.some(item => item.evidenceKind === 'training_diagnostic_preview'), false)
  assert.equal(detail.record.detailCoverage.trainingPreview.verifiedCount, 0)
})

for (const version of [6, 7, 8, 9]) test(`v${version}: 24 entries stay pageable and exact last-image query rechecks original, facts and PNG bytes`, async t => {
  const f = fixture(t, 24, version), calls = []
  f.parent.completedEpochs = 24
  f.parent.optimizerSteps = { generator: 1152, discriminator: 1152 }
  f.parent.optimizerStepsGenerator = f.parent.optimizerStepsDiscriminator = 1152
  const readBytes = async (bound, maximum) => { calls.push(bound.path); return f.options.readBytes(bound, maximum) }
  const result = await f.read({ metadataOnly: true, readBytes })
  assert.equal(result.status, 'available', JSON.stringify(result))
  assert.equal(result.images.length, 24)
  assert.ok(f.frames.every(frame => !calls.includes(frame.image.path)))
  const selected = f.frames[23]
  const artifactId = digest(JSON.stringify([f.parent.runId, 'image', selected.image.path, selected.image.sha256]))
  calls.length = 0
  const exact = await f.read({ artifactId, readBytes })
  assert.equal(exact.images.length, 1)
  assert.ok([selected.image.path, selected.sourceRgb.path, selected.worldFacts.path].every(p => calls.includes(p)))
  fs.appendFileSync(path.join(f.root, selected.image.path), 'mutated PNG')
  assert.equal((await f.read({ artifactId })).images.length, 0)
})

for (const version of [6, 7, 8, 9]) for (const target of ['capability', 'model', 'scope', 'root', 'schema', 'v5-path', 'unknown-path', 'duplicate-policy', 'predecessor-path'])
  test(`v${version}: rebound ${target} cannot cross the registered version/scope boundary`, async t => {
    const f = fixture(t, 1, version)
    if (target === 'capability') f.parent.capabilityVersion = 'stage4_mvp256_dry_joint_object_priority_quality24_v1'
    if (target === 'model') f.config.modelCapabilityVersion = 'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1'
    if (target === 'scope') f.policy.scope.capabilityVersion = 'stage4_mvp256_dry_joint_object_priority_quality24_v1'
    if (target === 'root') f.plan.outputRoot = '.runtime/ai-painter/joint-object-priority-quality-executions/' + f.parent.runId
    if (target === 'schema') f.policy.schemaVersion = 'ai-painter-training-preview-observation-policy-v5'
    if (target === 'v5-path') f.plan.trainingPreviewPolicy.path = 'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v5.json'
    if (target === 'unknown-path') f.plan.trainingPreviewPolicy.path = 'data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v10.json'
    if (target === 'predecessor-path') f.plan.trainingPreviewPolicy.path = `data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v${version === 8 ? 7 : version === 7 ? 6 : 7}.json`
    f.resign()
    if (target === 'duplicate-policy') {
      f.envelope.inputEvidence.push(f.put('data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v5.json', {}))
      f.parent.executionPackage = f.put(f.executionPackage.path, f.envelope)
    }
    const result = await f.read()
    assert.equal(result.images.length, 0)
    assert.notEqual(result.status, 'available')
  })

for (const version of [6, 7, 8, 9]) test(`v${version}: 256 source bindings pass; 257 and the old 260 exception fail`, async t => {
  const f = fixture(t, 1, version)
  for (const count of [256, 257, 260]) {
    while (Object.keys(f.plan.programBindings).length < count) {
      const name = 'synthetic-source-' + Object.keys(f.plan.programBindings).length
      f.plan.programBindings[name] = f.put('ml/ai-painter/synthetic/' + name + '.py', Buffer.from('# synthetic source'))
    }
    f.resign()
    const result = await f.read()
    assert.equal(result.images.length, count === 256 ? 1 : 0, JSON.stringify(result))
  }
})

for (const version of [6, 7, 8, 9]) for (const target of ['sourceRgb', 'worldFacts', 'image']) test(`v${version}: stale ${target} bytes cannot borrow a prior successful request`, async t => {
  const f = fixture(t, 1, version), selected = f.frames[0]
  assert.equal((await f.read()).status, 'available')
  fs.appendFileSync(path.join(f.root, selected[target].path), 'changed bytes')
  assert.equal((await f.read()).images.length, 0)
})

for (const version of [6, 7, 8, 9]) test(`v${version}: active preview requires the existing current identity verification`, async t => {
  const f = fixture(t, 1, version), progress = { ...f.parent, latestTrainingPreview: f.collection.entries[0] }
  assert.equal((await f.read({ manifestBinding: null, progress })).images.length, 0)
  assert.equal((await f.read({ manifestBinding: null, progress, progressVerified: true })).status, 'available')
  progress.packageId = 'foreign-package'
  assert.equal((await f.read({ manifestBinding: null, progress, progressVerified: true })).images.length, 0)
})

function registerFixture(t, f, taskTerminal = null) {
  const registryRoot = '.runtime/ai-painter/current-execution-registry', transactionId = 'preview-v6-fixture-transaction'
  const terminal = f.put(f.outputRoot + '/worker-terminal.json', f.parent)
  const task = taskTerminal ? f.put(f.outputRoot + '/review-terminal.json', taskTerminal) : terminal
  const capsule = f.put(f.outputRoot + '/capsule.json', { schemaVersion: 'ai-painter-local-task-capsule-v1',
    taskId: f.parent.runId, integrity: { status: 'verified' }, evidence: [{ ...terminal, sha256Verified: true }] })
  const registry = { schemaVersion: 'ai-painter-current-execution-registry-v1', registryRevision: 1, eventSequence: 1,
    lifecycleStage: 'readonly_gpu_qualified', executionState: 'failed_closed', packageSha256: task.sha256,
    writerIdentity: 'local_ai_capability_lifecycle_orchestrator', transactionId,
    taskId: f.parent.runId, runId: f.parent.runId, packageId: f.parent.packageId, capabilityVersion: f.parent.capabilityVersion,
    taskCapsule: capsule, terminalEvidence: { ...task, status: taskTerminal?.status ?? f.parent.status }, activeExecution: null,
    latestTrainingTerminal: { ...terminal, runId: f.parent.runId, status: f.parent.status },
    supersedes: null, archivedEvidenceNamespaces: [] }
  const bound = f.put(registryRoot + '/transactions/' + transactionId + '/current.staged.json', registry)
  f.put(registryRoot + '/current.json', registry)
  f.put(registryRoot + '/transactions/' + transactionId + '/transaction.json', {
    schemaVersion: 'ai-painter-current-execution-registry-transaction-v1', transactionId, registryRevision: 1,
    eventSequence: 1, status: 'committed', currentSha256: bound.sha256, previousCurrentSha256: null })
  f.put(registryRoot + '/events.jsonl', Buffer.from(JSON.stringify({ registryRevision: 1, eventSequence: 1,
    transactionId, taskId: f.parent.runId, runId: f.parent.runId, currentSha256: bound.sha256, previousCurrentSha256: null }) + '\n'))
  const db = new DatabaseSync(path.join(f.root, registryRoot, 'registry.sqlite'))
  db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
  db.prepare('INSERT INTO registry_revisions VALUES (?,?,?,?,?,?)').run(1, 1, transactionId, bound.sha256, f.parent.runId, f.parent.runId)
  db.prepare('INSERT INTO registry_transactions VALUES (?,?,?)').run(transactionId, 'committed', bound.sha256)
  db.close()
  const previous = process.env.AI_CONSOLE_HISTORY_ROOT
  process.env.AI_CONSOLE_HISTORY_ROOT = f.root
  t.after(() => { if (previous === undefined) delete process.env.AI_CONSOLE_HISTORY_ROOT; else process.env.AI_CONSOLE_HISTORY_ROOT = previous })
  return { registry, registrySha256: bound.sha256, currentTaskTerminal: taskTerminal ?? f.parent,
    taskCapsule: JSON.parse(fs.readFileSync(path.join(f.root, capsule.path), 'utf8')) }
}

const timingScope = 'worker_training_execute_including_authentication_data_model_checkpoint_validation_and_final_progress_before_terminal_publication'
function bindTiming(f, overrides = {}) {
  const value = { schemaVersion: 'decode1-entry-worker-execution-timing-v1',
    capabilityVersion: f.parent.capabilityVersion, runId: f.parent.runId, packageId: f.parent.packageId,
    executionPackage: f.parent.executionPackage, scope: timingScope, status: 'completed', stopReason: null,
    startedAtUtc: '2026-10-18T18:00:00.000Z', endedAtUtc: '2026-10-18T20:30:00.000Z',
    elapsedSeconds: 9001.25, ...overrides }
  f.parent.workerExecutionTiming = f.put(f.outputRoot + '/worker-execution-timing.json', value)
  return value
}

function activeTimingFixture(t, version = 9, registered = null) {
  const f = fixture(t, 0, version, registered), stamp = new Date().toISOString()
  const timing = bindTiming(f, { status: 'started', endedAtUtc: null, elapsedSeconds: null })
  const timingBinding = f.parent.workerExecutionTiming
  delete f.parent.workerExecutionTiming
  delete f.parent.trainingPreviewManifest
  f.parent.status = 'training_pending'
  f.parent.executionState = 'executing'
  const current = registerFixture(t, f)
  const id = { runId: f.parent.runId, packageId: f.parent.packageId, capabilityVersion: f.parent.capabilityVersion }
  const lock = { ...id, schemaVersion: 'ai-painter-current-active-execution-lock-v1', processId: 123,
    processStartIdentity: '123:synthetic-birth' }
  const lockBinding = f.put(f.outputRoot + '/execution-lock.json', lock)
  const heartbeat = { ...lock, schemaVersion: 'ai-painter-current-active-execution-heartbeat-v1',
    executionState: 'executing', heartbeatAtUtc: stamp }
  f.put(f.outputRoot + '/heartbeat.json', heartbeat)
  f.put(f.outputRoot + '/package.json', { ...id, schemaVersion: 'ai-painter-current-training-package-v1',
    outputRoot: f.outputRoot, autonomousExecutionPackage: f.parent.executionPackage, resolution: [256, 192],
    trainingPlan: { ...f.config.executionCeiling, checkpointSelection: f.config.checkpointSelection },
    resourceBudget: f.config.executionCeiling, observation: { progressPath: f.outputRoot + '/progress.json' } })
  const progress = { ...id, schemaVersion: 'ai-painter-current-training-progress-v1', executionState: 'executing',
    actualEpoch: 1, completedEpochs: 0, optimizerStepsGenerator: 1, optimizerStepsDiscriminator: 2,
    updatedAtUtc: stamp, workerExecutionTiming: timingBinding }
  f.put(f.outputRoot + '/progress.json', progress)
  Object.assign(current.registry, { executionState: 'executing', latestTrainingTerminal: null,
    activeExecution: { ...lock, lock: lockBinding, executionState: 'executing',
      heartbeat: { path: f.outputRoot + '/heartbeat.json', ttlSeconds: 120 } } })
  const rebindRegistry = () => { current.registrySha256 = f.put('.runtime/ai-painter/current-execution-registry/current.json', current.registry).sha256 }
  rebindRegistry()
  // The CPU registry double certifies process identity; the actual presentation
  // and TS projection still verify lock, heartbeat, progress, SHA and TTL bytes.
  const projection = loadCurrentExecutionProjectionForCpu(process.cwd(), {
    CURRENT_EXECUTION_REGISTRY_PATH: '.runtime/ai-painter/current-execution-registry/current.json',
    readCurrentExecutionRegistry: async () => ({ ok: true, ...current }) })
  return { f, current, progress, heartbeat, timing, timingBinding, rebindRegistry,
    snapshot: () => projection.readAiPainterCurrentExecutionSnapshot(f.root) }
}

for (const version of [7, 8, 9]) test(`v${version}: active TS projection reads committed start only from trusted progress without writes`, async t => {
  const a = activeTimingFixture(t, version), { f } = a
  const paths = [a.timingBinding.path, f.outputRoot + '/progress.json', '.runtime/ai-painter/current-execution-registry/current.json']
  const before = paths.map(logical => fs.readFileSync(path.join(f.root, logical)))
  const snapshot = await a.snapshot(), presentation = snapshot.trainingPresentation
  assert.equal(snapshot.ok, true, JSON.stringify(snapshot))
  assert.equal(presentation.currentMetrics.availability, 'available', JSON.stringify(presentation))
  assert.equal(presentation.currentMetrics.optimizationStep, 1)
  assert.equal(presentation.currentMetrics.discriminatorOptimizerSteps, 2)
  assert.equal(presentation.trainingWallMode, 'completion')
  assert.equal(presentation.workerExecutionTiming.availability, 'available', JSON.stringify(presentation))
  assert.equal(presentation.workerExecutionTiming.startedAtUtc, a.timing.startedAtUtc)
  assert.equal(presentation.workerExecutionTiming.sourceSha256, a.timingBinding.sha256)
  assert.equal(presentation.workerExecutionTiming.status, 'started')
  assert.equal(presentation.workerExecutionTiming.endedAtUtc, null)
  assert.equal(presentation.workerExecutionTiming.elapsedSeconds, null)
  assert.equal(presentation.completedEpochs, null)
  assert.equal(presentation.actualOptimizerSteps, null)
  for (const [i, logical] of paths.entries()) assert.deepEqual(fs.readFileSync(path.join(f.root, logical)), before[i])
})

for (const suffix of ['first', 'second']) test(`registered active timing: ${suffix} candidate uses the same progress reader`, async t => {
  const policy = JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v5.json'))
  const selector = `synthetic-active-${suffix}`
  policy.candidate = `synthetic_active_${suffix}_v1`; policy.candidateSelection = selector
  policy.outputRoot = `.runtime/ai-painter/registered-training-${selector}-executions`
  policy.executionProfile = `synthetic_active_${suffix}_profile`
  Object.assign(policy.interfaceContract, { candidateSelection: selector, runPrefix: selector + '-', packagePrefix: selector + '-package-' })
  const a = activeTimingFixture(t, 10, policy), snapshot = await a.snapshot()
  assert.equal(snapshot.trainingPresentation.currentMetrics.availability, 'available', JSON.stringify(snapshot))
  assert.equal(snapshot.trainingPresentation.workerExecutionTiming.availability, 'available', JSON.stringify(snapshot))
  assert.equal(snapshot.trainingPresentation.workerExecutionTiming.startedAtUtc, a.timing.startedAtUtc)
  assert.equal(snapshot.trainingPresentation.workerExecutionTiming.endedAtUtc, null)
  assert.equal(snapshot.trainingPresentation.workerExecutionTiming.elapsedSeconds, null)
})

for (const mutation of ['progress-run', 'progress-package', 'progress-capability', 'progress-stale', 'progress-future',
  'heartbeat-stale', 'heartbeat-future', 'lock-hash', 'process-birth', 'no-active', 'unbound', 'timing-hash',
  'timing-path', 'timing-run', 'timing-package', 'timing-capability', 'execution-package', 'scope', 'started-zero'])
  test(`active timing: ${mutation} cannot supply a trusted start or final duration`, async t => {
    const a = activeTimingFixture(t), { f, progress, heartbeat, current } = a
    if (mutation === 'progress-run') progress.runId = 'foreign-run'
    if (mutation === 'progress-package') progress.packageId = 'foreign-package'
    if (mutation === 'progress-capability') progress.capabilityVersion = 'foreign-capability'
    if (mutation === 'progress-stale') progress.updatedAtUtc = new Date(Date.now() - 121000).toISOString()
    if (mutation === 'progress-future') progress.updatedAtUtc = new Date(Date.now() + 60000).toISOString()
    if (mutation === 'heartbeat-stale') heartbeat.heartbeatAtUtc = new Date(Date.now() - 16000).toISOString()
    if (mutation === 'heartbeat-future') heartbeat.heartbeatAtUtc = new Date(Date.now() + 60000).toISOString()
    if (mutation === 'lock-hash') current.registry.activeExecution.lock.sha256 = '0'.repeat(64)
    if (mutation === 'process-birth') current.registry.activeExecution.processStartIdentity = '123:another-birth'
    if (mutation === 'no-active') current.registry.activeExecution = null
    if (mutation === 'unbound') delete progress.workerExecutionTiming
    if (mutation === 'timing-hash') fs.appendFileSync(path.join(f.root, a.timingBinding.path), 'changed bytes')
    if (mutation === 'timing-path') progress.workerExecutionTiming = f.put('data/fixture/worker-execution-timing.json', a.timing)
    const edits = { 'timing-run': { runId: 'foreign-run' }, 'timing-package': { packageId: 'foreign-package' },
      'timing-capability': { capabilityVersion: 'foreign-capability' }, scope: { scope: 'pure_gpu_training' },
      'execution-package': { executionPackage: { ...f.parent.executionPackage, sha256: '0'.repeat(64) } },
      'started-zero': { elapsedSeconds: 0 } }
    if (edits[mutation]) progress.workerExecutionTiming = f.put(a.timingBinding.path, { ...a.timing, ...edits[mutation] })
    f.put(f.outputRoot + '/progress.json', progress)
    f.put(f.outputRoot + '/heartbeat.json', heartbeat)
    a.rebindRegistry()
    const snapshot = await a.snapshot(), presentation = snapshot.trainingPresentation
    assert.equal(snapshot.ok, true, JSON.stringify(snapshot))
    assert.equal(presentation.workerExecutionTiming.availability, 'unavailable', JSON.stringify(presentation))
    assert.equal(presentation.workerExecutionTiming.startedAtUtc, null)
    assert.equal(presentation.workerExecutionTiming.elapsedSeconds, null)
    assert.equal(presentation.trainingWallMode, 'completion')
    if (['unbound', 'timing-hash', 'timing-path', ...Object.keys(edits)].includes(mutation)) {
      assert.equal(presentation.currentMetrics.optimizationStep, 1)
      assert.equal(presentation.currentMetrics.discriminatorOptimizerSteps, 2)
    }
  })

for (const changed of ['progress', 'registry']) test(`active timing: ${changed} replacement after validation rejects the original digest`, async t => {
  const a = activeTimingFixture(t), { f, current } = a
  const presentation = await readBoundTrainingPresentation(f.root, current.registry, current.taskCapsule, current.currentTaskTerminal)
  assert.equal(presentation.currentMetrics.availability, 'available')
  const logical = changed === 'progress' ? f.outputRoot + '/progress.json' : '.runtime/ai-painter/current-execution-registry/current.json'
  fs.appendFileSync(path.join(f.root, logical), ' ')
  const result = await readCompletionTrainingObservation(f.root, f.parent, { ok: true, ...current, presentation })
  assert.equal(result.workerExecutionTiming.availability, 'unavailable')
  assert.equal(result.workerExecutionTiming.reasonCode, 'history_sha_mismatch')
  assert.equal(result.trainingWallMode, 'completion')
})

for (const version of [7, 8, 9]) test(`v${version}: actual current TS projection and history share separately scoped monotonic timing and exact JSON artifact`, async t => {
  const f = fixture(t, 1, version), timing = bindTiming(f, { status: 'failed_closed',
    stopReason: { type: 'ValueError', message: 'worker_failure', messageSha256: digest('worker_failure') } })
  const registered = registerFixture(t, f)
  const projection = loadCurrentExecutionProjectionForCpu(process.cwd(), {
    CURRENT_EXECUTION_REGISTRY_PATH: '.runtime/ai-painter/current-execution-registry/current.json',
    readCurrentExecutionRegistry: async () => ({ ok: true, ...registered }) })
  // The missing mutable observation means the current presentation stays
  // unavailable; create the existing backlink surface without starting a Run.
  const id = { runId: f.parent.runId, packageId: f.parent.packageId, capabilityVersion: f.parent.capabilityVersion }
  f.put(f.outputRoot + '/package.json', { ...id, schemaVersion: 'ai-painter-current-training-package-v1',
    outputRoot: f.outputRoot, autonomousExecutionPackage: f.parent.executionPackage, resolution: [256, 192],
    trainingPlan: { ...f.config.executionCeiling, checkpointSelection: f.config.checkpointSelection },
    resourceBudget: f.config.executionCeiling, observation: { progressPath: f.outputRoot + '/progress.json' } })
  const before = fs.readFileSync(path.join(f.root, '.runtime/ai-painter/current-execution-registry/current.json'))
  const snapshot = await projection.readAiPainterCurrentExecutionSnapshot(f.root)
  assert.equal(snapshot.ok, true, JSON.stringify(snapshot))
  assert.equal(snapshot.trainingPresentation.availability, 'available', JSON.stringify(snapshot.trainingPresentation))
  assert.equal(snapshot.trainingPresentation.trainingWallMode, 'completion', JSON.stringify(snapshot.trainingPresentation))
  assert.equal(snapshot.trainingPresentation.workerExecutionTiming.elapsedSeconds, 9001.25)
  assert.equal(snapshot.activeExecution, null)
  const detail = await readTrainingRun(f.parent.runId, { root: f.root })
  assert.equal(detail.record.workerExecutionTiming.elapsedSeconds, 9001.25)
  assert.equal(detail.record.workerExecutionTiming.startedAtUtc, timing.startedAtUtc)
  assert.equal(detail.record.workerExecutionTiming.scope, timingScope)
  assert.equal(detail.record.startedAtUtc, null)
  assert.equal(detail.record.finishedAtUtc, null)
  assert.deepEqual(detail.record.optimizerSteps, { generator: 539, discriminator: 540 })
  const artifact = detail.record.artifacts.find(item => item.evidenceKind === 'workerExecutionTiming')
  assert.ok(artifact)
  const response = await readTrainingArtifact(f.parent.runId, artifact.artifactId, { root: f.root })
  assert.equal(response.json.truncated, false)
  assert.deepEqual(JSON.parse(response.json.text), timing)
  assert.deepEqual(fs.readFileSync(path.join(f.root, '.runtime/ai-painter/current-execution-registry/current.json')), before)
})

test('v7: bound start-only timing leaves final duration unknown, never zero or a UTC difference', async t => {
  const f = fixture(t, 1, 7)
  bindTiming(f, { endedAtUtc: null, elapsedSeconds: null, status: 'started' })
  const observation = await readCompletionTrainingObservation(f.root, f.parent)
  assert.equal(observation.workerExecutionTiming.availability, 'available', JSON.stringify(observation))
  assert.equal(observation.workerExecutionTiming.endedAtUtc, null)
  assert.equal(observation.workerExecutionTiming.elapsedSeconds, null)
})

test('v7: Python UTC offset encoding is preserved without changing monotonic elapsed', async t => {
  const f = fixture(t, 1, 7)
  const timing = bindTiming(f, { startedAtUtc: '2026-10-18T18:00:00.123456+00:00', endedAtUtc: '2026-10-18T20:30:00.654321+00:00' })
  const observation = await readCompletionTrainingObservation(f.root, f.parent)
  assert.equal(observation.workerExecutionTiming.availability, 'available')
  assert.equal(observation.workerExecutionTiming.startedAtUtc, timing.startedAtUtc)
  assert.equal(observation.workerExecutionTiming.elapsedSeconds, 9001.25)
})

test('v7: missing worker terminal does not erase independently bound policy/plan clock semantics', async t => {
  const f = fixture(t, 1, 7)
  f.parent.workerTerminal = { path: f.outputRoot + '/missing-worker-terminal.json', sha256: '0'.repeat(64) }
  const observation = await readCompletionTrainingObservation(f.root, f.parent)
  assert.equal(observation.trainingWallMode, 'completion')
  assert.equal(observation.workerExecutionTiming.availability, 'unavailable')
  assert.equal(observation.workerExecutionTiming.elapsedSeconds, null)
})

for (const target of ['run', 'package', 'capability', 'execution-package', 'scope', 'schema', 'negative', 'partial-end', 'utc', 'oversize', 'hash', 'path', 'state', 'error-string', 'error-object'])
  test(`v7: ${target} timing conflict leaves first failure, counters and preview intact`, async t => {
    const f = fixture(t, 1, 7)
    const edits = {
      run: { runId: 'another-run' }, package: { packageId: 'another-package' }, capability: { capabilityVersion: 'legacy' },
      'execution-package': { executionPackage: { ...f.parent.executionPackage, sha256: '0'.repeat(64) } },
      scope: { scope: 'pure_optimizer_loop' }, schema: { schemaVersion: 'unknown-timing-v1' },
      negative: { elapsedSeconds: -1 }, 'partial-end': { endedAtUtc: null }, utc: { startedAtUtc: 'not-a-time' },
      oversize: { ignored: 'x'.repeat(32769) }, hash: {}, path: {},
      state: { status: 'running' }, 'error-string': { status: 'failed_closed', stopReason: 'unregistered error format' },
      'error-object': { status: 'failed_closed', stopReason: { type: 'Error', message: 'missing hash' } },
    }
    f.parent.error = { type: 'ValueError', message: 'original failure' }
    bindTiming(f, edits[target])
    if (target === 'hash') fs.appendFileSync(path.join(f.root, f.parent.workerExecutionTiming.path), 'changed')
    if (target === 'path') f.parent.workerExecutionTiming = f.put('data/fixture/worker-execution-timing.json', {})
    registerFixture(t, f)
    const detail = await readTrainingRun(f.parent.runId, { root: f.root })
    assert.equal(detail.record.workerExecutionTiming.availability, 'unavailable', JSON.stringify(detail))
    assert.deepEqual(detail.record.optimizerSteps, { generator: 539, discriminator: 540 })
    assert.deepEqual(detail.record.failureSummary, f.parent.error)
    assert.equal(detail.record.detailCoverage.trainingPreview.verifiedCount, 1)
    assert.equal(detail.record.artifacts.some(item => item.evidenceKind === 'workerExecutionTiming'), false)
  })

test('v7: an unbound file is not timing evidence; old v6 never adopts the completion timing field', async t => {
  const f = fixture(t, 1, 7)
  bindTiming(f)
  delete f.parent.workerExecutionTiming
  assert.equal((await readCompletionTrainingObservation(f.root, f.parent)).workerExecutionTiming.availability, 'unavailable')
  const old = fixture(t, 1, 6)
  bindTiming(old)
  assert.equal(await readCompletionTrainingObservation(old.root, old.parent), null)
})

for (const version of [7, 8, 9]) for (const status of ['completed', 'failed_closed', 'started'])
  test(`history list v${version}: ${status} exposes verified worker times without replacing raw Run dates`, async t => {
    const f = fixture(t, 0, version)
    const timing = bindTiming(f, { status,
      startedAtUtc: '2026-10-18T18:00:00.123456+00:00',
      ...(status === 'started' ? { endedAtUtc: null, elapsedSeconds: null } : {}),
      stopReason: status === 'failed_closed' ? { type: 'ValueError', message: 'synthetic failure', messageSha256: digest('synthetic failure') } : null })
    registerFixture(t, f)
    const listing = await listTrainingHistory({ root: f.root, limit: 1 })
    const row = listing.records[0]
    assert.equal(row.workerExecutionTiming?.availability, 'available', JSON.stringify(row))
    assert.equal(row.workerExecutionTiming.startedAtUtc, timing.startedAtUtc)
    assert.equal(row.workerExecutionTiming.endedAtUtc, timing.endedAtUtc)
    assert.equal(row.workerExecutionTiming.elapsedSeconds, timing.elapsedSeconds)
    assert.equal(row.workerExecutionTiming.scope, timingScope)
    assert.equal(row.workerExecutionTiming.status, status)
    assert.equal(row.startedAtUtc, null); assert.equal(row.finishedAtUtc, null)
    assert.ok(row.unavailableFields.includes('startedAtUtc'))
    assert.equal(listing.records.length, 1); assert.equal(listing.nextCursor, null)
    assert.deepEqual(row.workerExecutionTiming, (await readTrainingRun(f.parent.runId, { root: f.root })).record.workerExecutionTiming)
  })

for (const target of ['unbound', 'missing', 'run', 'package', 'execution-package', 'scope', 'schema', 'negative', 'oversize', 'hash', 'path'])
  test(`history list: ${target} timing stays unavailable without hiding the Run`, async t => {
    const f = fixture(t, 0, 7)
    const edits = { run: { runId: 'foreign-run' }, package: { packageId: 'foreign-package' },
      'execution-package': { executionPackage: { ...f.parent.executionPackage, sha256: '0'.repeat(64) } },
      scope: { scope: 'pure_gpu_training' }, schema: { schemaVersion: 'unknown-clock-v1' },
      negative: { elapsedSeconds: -1 }, oversize: { ignored: 'x'.repeat(32769) } }
    bindTiming(f, edits[target])
    const timingBinding = f.parent.workerExecutionTiming
    if (target === 'unbound') delete f.parent.workerExecutionTiming
    if (target === 'missing') fs.unlinkSync(path.join(f.root, timingBinding.path))
    if (target === 'hash') fs.appendFileSync(path.join(f.root, timingBinding.path), 'changed')
    if (target === 'path') f.parent.workerExecutionTiming = f.put('data/fixture/untrusted-timing.json', {})
    registerFixture(t, f)
    const row = (await listTrainingHistory({ root: f.root })).records[0]
    assert.equal(row.runId, f.parent.runId)
    assert.equal(row.terminalStatus, f.parent.status)
    assert.equal(row.workerExecutionTiming?.availability, 'unavailable', JSON.stringify(row))
    assert.equal(row.workerExecutionTiming.startedAtUtc, null)
    assert.equal(row.workerExecutionTiming.elapsedSeconds, null)
    assert.ok(row.workerExecutionTiming.reasonCode)
    assert.ok(row.unavailableFields.includes('workerExecutionTiming'))
  })

test('history list: cached registry does not cache successful timing bytes or backfill old unbound evidence', async t => {
  const f = fixture(t, 0, 7)
  bindTiming(f); registerFixture(t, f)
  const first = await listTrainingHistory({ root: f.root })
  assert.equal(first.records[0].workerExecutionTiming?.availability, 'available')
  fs.appendFileSync(path.join(f.root, f.parent.workerExecutionTiming.path), ' ')
  const next = await listTrainingHistory({ root: f.root })
  assert.equal(next.sourceRevision, first.sourceRevision)
  assert.equal(next.records[0].workerExecutionTiming.availability, 'unavailable')
  assert.equal(next.records[0].workerExecutionTiming.reasonCode, 'history_sha_mismatch')
  const old = fixture(t, 0, 6)
  bindTiming(old); registerFixture(t, old)
  assert.equal((await listTrainingHistory({ root: old.root })).records[0].workerExecutionTiming ?? null, null)
})

for (const suffix of ['first', 'second']) test(`history list: registered ${suffix} candidate needs no consumer name special case`, async t => {
  const policy = JSON.parse(fs.readFileSync('data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v5.json'))
  const selector = `synthetic-list-${suffix}`
  policy.candidate = `synthetic_list_${suffix}_v1`; policy.candidateSelection = selector
  policy.outputRoot = `.runtime/ai-painter/registered-training-${selector}-executions`
  policy.executionProfile = `synthetic_list_${suffix}_profile`
  Object.assign(policy.interfaceContract, { candidateSelection: selector, runPrefix: selector + '-', packagePrefix: selector + '-package-' })
  const f = fixture(t, 0, 10, policy), timing = bindTiming(f)
  registerFixture(t, f)
  const row = (await listTrainingHistory({ root: f.root })).records[0]
  assert.equal(row.workerExecutionTiming?.availability, 'available', JSON.stringify(row))
  assert.equal(row.workerExecutionTiming.elapsedSeconds, timing.elapsedSeconds)
})

test('history list: timing enrichment preserves bounded pages, opaque cursors and read-only source bytes', async t => {
  const f = fixture(t, 0, 7)
  bindTiming(f)
  const first = registerFixture(t, f), reg = '.runtime/ai-painter/current-execution-registry'
  const prior = first.registry, runId = 'next-list-run', transactionId = 'next-list-transaction'
  const terminal = f.put('.runtime/ai-painter/list-fixture/terminal.json', { runId, status: 'completed_not_qualified',
    executionState: 'completed', schemaVersion: 'unknown-list-schema' })
  const capsule = f.put('.runtime/ai-painter/list-fixture/capsule.json', { schemaVersion: 'ai-painter-local-task-capsule-v1',
    taskId: runId, integrity: { status: 'verified' }, evidence: [{ ...terminal, sha256Verified: true }] })
  const snapshot = { ...prior, registryRevision: 2, eventSequence: 2, taskId: runId, runId, transactionId, executionState: 'completed',
    taskCapsule: capsule, terminalEvidence: { ...terminal, status: 'completed_not_qualified' },
    latestTrainingTerminal: { ...terminal, runId, status: 'completed_not_qualified' },
    supersedes: { registryRevision: 1, eventSequence: 1, transactionId: prior.transactionId,
      currentSha256: first.registrySha256, taskId: prior.taskId, runId: prior.runId } }
  const staged = f.put(`${reg}/transactions/${transactionId}/current.staged.json`, snapshot)
  f.put(`${reg}/current.json`, snapshot)
  f.put(`${reg}/transactions/${transactionId}/transaction.json`, { schemaVersion: 'ai-painter-current-execution-registry-transaction-v1',
    transactionId, registryRevision: 2, eventSequence: 2,
    status: 'committed', currentSha256: staged.sha256, previousCurrentSha256: first.registrySha256 })
  const events = fs.readFileSync(path.join(f.root, reg, 'events.jsonl'), 'utf8')
  f.put(`${reg}/events.jsonl`, Buffer.from(events + JSON.stringify({ transactionId, registryRevision: 2, eventSequence: 2,
    taskId: runId, runId, currentSha256: staged.sha256, previousCurrentSha256: first.registrySha256 }) + '\n'))
  const db = new DatabaseSync(path.join(f.root, reg, 'registry.sqlite'))
  db.prepare('INSERT INTO registry_revisions VALUES(?,?,?,?,?,?)').run(2, 2, transactionId, staged.sha256, runId, runId)
  db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run(transactionId, 'committed', staged.sha256)
  db.close()
  const paths = [`${reg}/current.json`, `${reg}/events.jsonl`, `${reg}/registry.sqlite`,
    `${f.outputRoot}/worker-terminal.json`, f.parent.workerExecutionTiming.path]
  const before = paths.map(logical => fs.readFileSync(path.join(f.root, logical)))
  const page1 = await listTrainingHistory({ root: f.root, limit: 1 })
  assert.deepEqual(page1.records.map(row => row.runId), [runId])
  assert.equal(page1.records[0].workerExecutionTiming ?? null, null)
  assert.ok(page1.nextCursor); assert.equal(page1.total, 2)
  const page2 = await listTrainingHistory({ root: f.root, limit: 1, cursor: page1.nextCursor })
  assert.deepEqual(page2.records.map(row => row.runId), [f.parent.runId])
  assert.equal(page2.records[0].workerExecutionTiming.availability, 'available')
  assert.equal(page2.nextCursor, null); assert.equal(page2.sourceRevision, page1.sourceRevision)
  const bad = Buffer.from(JSON.stringify({ sha256: '0'.repeat(64), offset: 1 })).toString('base64url')
  await assert.rejects(listTrainingHistory({ root: f.root, cursor: bad }), /history_cursor_revision_conflict/)
  for (const [i, logical] of paths.entries()) assert.deepEqual(fs.readFileSync(path.join(f.root, logical)), before[i])
  const source = fs.readFileSync('src/server/ai-console/training-history-store.mjs', 'utf8')
  assert.match(source, /combined\.slice\(offset, next\)[\s\S]*verifiedListWorkerTiming\(root, record\)/)
})

for (const mutation of ['missing-mode', 'finite-wall', 'missing-policy', 'policy-mode', 'policy-null', 'policy-hash'])
  test(`v7: ${mutation} cannot turn null into completion semantics`, async t => {
    const f = fixture(t, 1, 7)
    if (mutation === 'missing-mode') delete f.config.executionCeiling.trainingWallMode
    if (mutation === 'finite-wall') f.config.executionCeiling.maxWallSeconds = 8400
    if (mutation === 'missing-policy') delete f.config.executionPolicy
    if (mutation.startsWith('policy-')) {
      const binding = f.plan.executionPolicy
      const value = JSON.parse(fs.readFileSync(path.join(f.root, binding.path), 'utf8'))
      if (mutation === 'policy-mode') delete value.executionCeiling.trainingWallMode
      if (mutation === 'policy-null') value.executionCeiling.maxWallSeconds = 8400
      const replacement = f.put(binding.path, value)
      if (mutation !== 'policy-hash') {
        Object.assign(binding, replacement)
        f.config.executionPolicy = binding
      } else fs.appendFileSync(path.join(f.root, binding.path), 'changed')
    }
    f.resign()
    assert.equal((await readCompletionTrainingObservation(f.root, f.parent)).trainingWallMode, null)
  })

for (const version of [6, 7, 8, 9]) test(`v${version}: real registry/history list/detail/artifact readers accept new namespace without writes or invented checkpoint`, async t => {
  const f = fixture(t, 1, version)
  registerFixture(t, f)
  const currentPath = path.join(f.root, '.runtime/ai-painter/current-execution-registry/current.json')
  const before = fs.readFileSync(currentPath)
  const list = await listTrainingHistory({ root: f.root })
  assert.equal(list.records[0].runId, f.parent.runId)
  const detail = await readTrainingRun(f.parent.runId, { root: f.root })
  assert.equal(detail.record.detailCoverage.trainingPreview.status, 'available', JSON.stringify(detail))
  assert.deepEqual(detail.record.optimizerSteps, { generator: 539, discriminator: 540 })
  assert.equal(detail.record.checkpoints.length, 0)
  const preview = detail.record.artifacts.find(item => item.evidenceKind === 'training_diagnostic_preview')
  assert.ok(preview)
  const artifact = await readTrainingArtifact(f.parent.runId, preview.artifactId, { root: f.root })
  assert.equal(artifact.contentType, 'image/png')
  assert.equal(digest(artifact.bytes), f.frames[0].image.sha256)
  assert.deepEqual(fs.readFileSync(currentPath), before)
})

for (const version of [6, 7, 8, 9]) test(`v${version}: existing current metrics projection accepts new capability/root and preserves actual G/D increments`, async t => {
  const f = fixture(t, 1, version), now = Date.now(), stamp = new Date(now).toISOString()
  const id = { runId: f.parent.runId, packageId: f.parent.packageId, capabilityVersion: f.parent.capabilityVersion }
  const lock = { ...id, schemaVersion: 'ai-painter-current-active-execution-lock-v1', processId: 123,
    processStartIdentity: '123:synthetic-birth' }
  const lockBinding = f.put(f.outputRoot + '/execution-lock.json', lock)
  f.put(f.outputRoot + '/heartbeat.json', { ...lock, schemaVersion: 'ai-painter-current-active-execution-heartbeat-v1',
    executionState: 'executing', heartbeatAtUtc: stamp })
  const observation = { ...id, schemaVersion: 'ai-painter-current-training-package-v1', outputRoot: f.outputRoot,
    autonomousExecutionPackage: f.parent.executionPackage, resolution: [256, 192],
    trainingPlan: { ...f.config.executionCeiling, checkpointSelection: f.config.checkpointSelection },
    resourceBudget: f.config.executionCeiling, observation: { progressPath: f.outputRoot + '/progress.json' } }
  f.put(f.outputRoot + '/package.json', observation)
  const progress = { ...id, schemaVersion: 'ai-painter-current-training-progress-v1', executionState: 'executing',
    actualEpoch: 1, completedEpochs: 0, optimizerStepsGenerator: 1, optimizerStepsDiscriminator: 2, updatedAtUtc: stamp }
  f.put(f.outputRoot + '/progress.json', progress)
  const registry = { ...id, activeExecution: { ...lock, lock: lockBinding, executionState: 'executing',
    heartbeat: { path: f.outputRoot + '/heartbeat.json', ttlSeconds: 120 } } }
  const capsule = { evidence: [f.parent.executionPackage] }, terminal = { ...id, executionPackage: f.parent.executionPackage }
  const first = await readBoundTrainingPresentation(f.root, registry, capsule, terminal, { observedNow: now })
  assert.equal(first.currentMetrics.availability, 'available', JSON.stringify(first))
  assert.equal(first.currentMetrics.optimizationStep, 1)
  progress.optimizerStepsGenerator = 2; progress.optimizerStepsDiscriminator = 3
  f.put(f.outputRoot + '/progress.json', progress)
  const next = await readBoundTrainingPresentation(f.root, registry, capsule, terminal, { observedNow: now })
  assert.equal(next.currentMetrics.optimizationStep, 2)
  assert.equal(next.currentMetrics.discriminatorOptimizerSteps, 3)
  assert.equal(next.currentMetrics.estimatedCompletionAtUtc, null)
  assert.equal(next.startedAtUtc, undefined)
  assert.equal(next.elapsedMs, undefined)
  // updatedAtUtc remains freshness evidence; it never becomes a start time.
  assert.equal(next.currentMetrics.reportedAtUtc, stamp)
  f.put(f.outputRoot + '/progress.json', { ...progress, updatedAtUtc: new Date(now - 120001).toISOString() })
  const stale = await readBoundTrainingPresentation(f.root, registry, capsule, terminal, { observedNow: now })
  assert.equal(stale.currentMetrics.availability, 'unavailable')
  assert.equal(stale.currentMetrics.reasonCode, 'training_progress_stale_or_future')
})

for (const version of [6, 7, 8, 9]) test(`v${version}: completed synthetic worker exposes bound validation original and output through the original artifact reader`, async t => {
  const f = fixture(t, 1, version), id = { runId: f.parent.runId, packageId: f.parent.packageId, capabilityVersion: f.parent.capabilityVersion }
  f.config.scope.subjectSampleId = 'validation-0'
  f.resign()
  const checkpoint = f.put(f.outputRoot + '/checkpoints/epoch-0024.pt', Buffer.from('synthetic metadata-only checkpoint; never deserialized'))
  const cp = { epoch: 24, checkpoint, counts: { generator: 1152, discriminator: 1152 }, selection: {},
    validation: Array.from({ length: 8 }, (_, i) => ({ sampleId: 'validation-' + i, split: 'validation', epoch: 24, fullRgbMae: 0.1 })) }
  Object.assign(f.parent, { executionState: 'completed', status: 'training_completed_review_pending', completedEpochs: 24,
    optimizerSteps: { generator: 1152, discriminator: 1152 }, optimizerStepsGenerator: 1152, optimizerStepsDiscriminator: 1152,
    checkpoints: [cp], selectedCheckpointRecord: cp, checkpointReloadVerified: true })
  const workerTerminal = f.put(f.outputRoot + '/worker-terminal.json', f.parent)
  const images = Array.from({ length: 8 }, (_, i) => f.put(f.outputRoot + '/review/prediction-' + i + '.png', png()))
  const referenceRgb = f.put('data/fixture/validation-reference.png', png())
  const originalRgb = f.put(f.outputRoot + '/review/scaled-reference.png', png())
  const report = f.put(f.outputRoot + '/review/report.json', { ...id,
    schema: 'object-support-structure-quality-native-review-input-v1', executionPackage: f.parent.executionPackage,
    workerTerminal, selectedCheckpoint: checkpoint, subject: { sampleId: 'validation-0', split: 'validation', referenceRgb },
    originalRgb, candidateRgb: images[0], artifacts: images,
    validationImages: images.map((binding, i) => ({ sampleId: 'validation-' + i, split: 'validation', epoch: 24,
      optimizerStep: 1152, purpose: 'prediction', binding, checkpoint })) })
  registerFixture(t, f, { ...id, schema: 'object-support-structure-quality-review-terminal-v1',
    executionPackage: f.parent.executionPackage, workerTerminal, reviewReport: report,
    executionState: 'failed_closed', status: 'dry_review_failed_closed' })
  const detail = await readTrainingRun(f.parent.runId, { root: f.root })
  const original = detail.record.artifacts.find(item => item.role === 'original' && item.sourceRole === 'source_reference_rgb')
  assert.ok(original, JSON.stringify(detail))
  assert.equal(detail.record.samples.length, 8)
  assert.equal(detail.record.artifacts.filter(item => item.role === 'output').length, 8)
  assert.equal(detail.record.checkpoints[0].metadataOnly, true)
  assert.equal(detail.record.qualification.worldEntryAllowed, false)
  const image = await readTrainingArtifact(f.parent.runId, original.artifactId, { root: f.root })
  assert.equal(digest(image.bytes), referenceRgb.sha256)
  fs.appendFileSync(path.join(f.root, referenceRgb.path), 'changed source')
  await assert.rejects(readTrainingArtifact(f.parent.runId, original.artifactId, { root: f.root }), /sha_mismatch/u)
})

