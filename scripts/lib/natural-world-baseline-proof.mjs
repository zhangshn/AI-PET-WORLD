import { createHash } from 'node:crypto'

export const BASELINE_PRODUCER = 'natural-world-baseline-program-v1'
export const BASELINE_DELIVERY = 'WORLD-BASELINE-001'
export const BASELINE_PREFIX = '.runtime/ai-painter/natural-world-baselines/'
export const BASELINE_SELECTION = '.runtime/local-backup/project-progress/current-world-baseline.json'
export const BASELINE_IDENTITY = Object.freeze({
  ownerId: 'mvp-natural-owner-001', playerId: 'mvp-natural-player-001', worldId: 'mvp-natural-world-001',
  worldSeed: 'mvp-natural-world-001-seed-v1',
  worldProfileId: 'mainland-southeast-asia-tropical-monsoon-natural-home-v1', regionId: 'mvp-natural-region-001',
})
export const BASELINE_CONTRACT = Object.freeze({
  path: 'data/ai-painter/system-governance/ai-painter-natural-world-bootstrap-contract-v2.json',
  sha256: 'ec419bcd0adf167fdfed2004a44a6d6ae300e18829e547423708b12681887206',
})
export const BASELINE_CODE_FILES = Object.freeze([
  'scripts/run-natural-world-baseline.mjs', 'scripts/lib/natural-world-baseline.mjs',
  'scripts/lib/natural-world-baseline-proof.mjs', 'scripts/lib/natural-world-baseline-ts-loader.mjs',
  'src/world/runtime/natural-world-bootstrap.ts', 'src/world/runtime/world-runtime-schema.ts',
  'src/world/runtime/world-runtime-record-validation.ts', 'src/world/runtime/world-runtime-store-adapter.ts',
  'src/world/runtime/world-runtime-store.ts', 'src/world/runtime/world-runtime-production-store.ts',
  'src/world/runtime/runtime-path-security.ts',
])
export const BASELINE_SOURCE_PRODUCERS = Object.freeze([
  'scripts/build-earth-geospatial-complete-map-conditions.mjs', 'scripts/lib/real-earth-region-governance.mjs',
  'scripts/build-current-world-visual-fact-manifest.mjs', 'scripts/build-current-world-visual-generation-task-package.mjs',
  'scripts/compile-current-world-visual-conditions.mjs', 'src/world/runtime/natural-world-bootstrap.ts',
  'scripts/lib/anonymous-route-naturalness.mjs', 'scripts/lib/anonymous-water-naturalness.mjs',
  'scripts/lib/measurement-driven-anonymous-topology.mjs', 'scripts/lib/measurement-derived-coarse-hydrology.mjs',
  'scripts/lib/world-visual-dictionary-contract.mjs', 'src/world/runtime/world-runtime-record-validation.ts',
  'src/world/runtime/world-runtime-store-adapter.ts', 'src/world/runtime/world-runtime-store.ts',
  'src/world/runtime/world-runtime-production-store.ts', 'src/world/runtime/runtime-path-security.ts',
])
const ID_KEYS = Object.keys(BASELINE_IDENTITY)
const HASH = /^[a-f0-9]{64}$/
const RUN = /^baseline-[a-f0-9]{32}$/
const QUALIFICATION = Object.freeze({ modelExecuted: false, rgbCreated: false, framePublished: false,
  evolutionVerified: false, worldEntryEligible: false, publicOwnershipVerified: false, mvpQualified: false })
export const baselineQualification = () => ({ ...QUALIFICATION })
export const baselineSha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export function baselineNeed(value, code) { if (!value) throw new Error('baseline_' + code) }
function plain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) }
function keys(v, required, optional = []) {
  baselineNeed(plain(v) && required.every(k => Object.hasOwn(v, k)) &&
    Object.keys(v).every(k => required.includes(k) || optional.includes(k)), 'fields')
}
export function baselineCanonical(v, depth = 0) {
  baselineNeed(depth <= 64, 'json_depth')
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number') { baselineNeed(Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v)), 'json_number'); return JSON.stringify(v) }
  if (Array.isArray(v)) return '[' + v.map(x => baselineCanonical(x, depth + 1)).join(',') + ']'
  baselineNeed(plain(v), 'json_type')
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + baselineCanonical(v[k], depth + 1)).join(',') + '}'
}
export const baselineDigest = value => baselineSha256(Buffer.from(baselineCanonical(value), 'utf8'))
export function baselineLogicalPath(value) {
  baselineNeed(typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/[\\:\0]/.test(value) &&
    !value.startsWith('/') && value.split('/').every(s => s && s !== '.' && s !== '..'), 'path')
  return value
}
export function baselineJson(bytes, max = 4 * 1024 * 1024) {
  baselineNeed(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= max, 'json_size')
  let value
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new Error('baseline_json') }
  baselineCanonical(value)
  return value
}
export function verifyNaturalRecordBytes(bytes, identity) {
  const r = baselineJson(bytes)
  keys(r, [...ID_KEYS, 'version', 'tick', 'stateVersion', 'savedAt', 'worldFacts', 'worldState', 'ruleVersion', 'eventCursor',
    'randomState', 'sourceBindings', 'worldFactsPayloadSha256', 'statePayloadSha256', 'recordContentSha256'])
  baselineNeed(r.version === 'natural-world-runtime-save-v1' && ID_KEYS.every(k => r[k] === identity[k]) &&
    r.tick === 0 && r.stateVersion === 0 && r.eventCursor === 0 && typeof r.ruleVersion === 'string' && r.ruleVersion, 'record_identity')
  for (const [name, schema] of [['worldFacts', 'natural-world-facts-snapshot-v1'], ['worldState', 'natural-world-state-snapshot-v1']]) {
    const s = r[name]
    keys(s, ['schemaVersion', 'worldId', 'regionId', 'tick', 'payload'])
    baselineNeed(s.schemaVersion === schema && s.worldId === identity.worldId && s.regionId === identity.regionId && s.tick === 0, 'snapshot_identity')
  }
  keys(r.worldFacts.payload, ['terrainRegions', 'objectFootprints', 'walkableRegions', 'collisionRegions'])
  for (const k of Object.keys(r.worldFacts.payload)) baselineNeed(Array.isArray(r.worldFacts.payload[k]), 'facts_arrays')
  baselineNeed(r.worldFacts.payload.terrainRegions.length && r.worldFacts.payload.walkableRegions.length, 'empty_facts')
  keys(r.worldState.payload, ['environment', 'objects', 'resources'])
  baselineNeed(plain(r.worldState.payload.environment) && Array.isArray(r.worldState.payload.objects) &&
    Array.isArray(r.worldState.payload.resources) && r.worldState.payload.resources.length === 0, 'state_shape')
  baselineNeed(r.randomState?.status === 'captured' && typeof r.randomState.algorithmId === 'string' &&
    typeof r.randomState.algorithmVersion === 'string' && plain(r.randomState.state), 'rng')
  const state = { ...Object.fromEntries(ID_KEYS.map(k => [k, r[k]])), worldState: r.worldState, randomState: r.randomState,
    ruleVersion: r.ruleVersion, eventCursor: r.eventCursor, tick: r.tick, stateVersion: r.stateVersion }
  const { recordContentSha256, ...withoutOwn } = r
  baselineNeed(r.worldFactsPayloadSha256 === baselineDigest(r.worldFacts) && r.statePayloadSha256 === baselineDigest(state) &&
    recordContentSha256 === baselineDigest(withoutOwn), 'record_digest')
  baselineNeed(Number.isFinite(Date.parse(r.savedAt)), 'record_time')
  return r
}
function refShape(ref) {
  keys(ref, ['path', 'sha256', 'bytes'])
  baselineLogicalPath(ref.path)
  baselineNeed(HASH.test(ref.sha256) && Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 128 * 1024 * 1024, 'ref_shape')
}
function equal(a, b, code) { baselineNeed(baselineCanonical(a) === baselineCanonical(b), code) }
function processProof(p) {
  keys(p, ['pid', 'exitCode', 'startedAtUtc', 'finishedAtUtc', 'elapsedMs'])
  baselineNeed(Number.isSafeInteger(p.pid) && p.pid > 0 && p.exitCode === 0 &&
    Number.isFinite(Date.parse(p.startedAtUtc)) && Date.parse(p.finishedAtUtc) >= Date.parse(p.startedAtUtc) &&
    Number.isFinite(p.elapsedMs) && p.elapsedMs >= 0 && p.elapsedMs <= 120000, 'process')
}

/** Pure synchronous verification. read is a bounded logical-path -> Buffer callback. */
export function verifyNaturalWorldBaselineProof(args) {
  return verifyEvidence(args, { identity: BASELINE_IDENTITY, worldRoot: BASELINE_PREFIX + BASELINE_IDENTITY.worldId + '/',
    storeRoot: 'data/world-runtime', identityScope: 'local_mvp_delivery_namespace' })
}
/** Test-only namespace: cannot validate a delivery selection or a production world. */
export function verifyNaturalWorldBaselinePrivateFixtureProof({ selection, read, fixtureRoot }) {
  const prefix = '.runtime/ai-painter/controller-repair-reviews/mvp-world-baseline-145-20261029/t/'
  baselineNeed(typeof fixtureRoot === 'string' && fixtureRoot.startsWith(prefix) && /^[a-f0-9]{8}$/.test(fixtureRoot.slice(prefix.length)), 'fixture_scope')
  baselineNeed(read(fixtureRoot + '/fixture.marker', 128).toString() === 'natural-world-baseline-private-fixture-v1', 'fixture_marker')
  const id = fixtureRoot.slice(prefix.length)
  const identity = { ownerId: 'baseline-test-owner-' + id, playerId: 'baseline-test-player-' + id, worldId: 'baseline-test-world-' + id,
    worldSeed: 'baseline-test-seed-' + id, regionId: 'baseline-test-region-' + id, worldProfileId: BASELINE_IDENTITY.worldProfileId }
  return verifyEvidence({ selection, read }, { identity, worldRoot: fixtureRoot + '/w/', storeRoot: fixtureRoot + '/store', identityScope: 'private_test_fixture' })
}
function verifyEvidence({ selection, read }, context) {
  keys(selection, ['schemaVersion', 'deliveryId', 'proofRef', 'identity', 'selectedAtUtc'])
  baselineNeed(selection.schemaVersion === 'natural-world-baseline-selection-v1' && selection.deliveryId === BASELINE_DELIVERY &&
    Number.isFinite(Date.parse(selection.selectedAtUtc)) && typeof read === 'function', 'selection')
  equal(selection.identity, context.identity, 'selection_identity')
  baselineNeed(selection.proofRef?.path.startsWith(context.worldRoot) &&
    /^runs\/baseline-[a-f0-9]{32}\/result\.json$/.test(selection.proofRef.path.slice(context.worldRoot.length)), 'proof_location')
  const cache = new Map(); let total = 0; const started = Date.now()
  function bound(ref, max = 4 * 1024 * 1024) {
    refShape(ref)
    baselineNeed(ref.bytes <= max, 'ref_limit')
    if (!cache.has(ref.path)) {
      baselineNeed(cache.size < 512 && Date.now() - started <= 8000, 'read_budget')
      const bytes = read(ref.path, max)
      baselineNeed(Buffer.isBuffer(bytes) && bytes.length === ref.bytes, 'read_bytes')
      total += bytes.length; baselineNeed(total <= 16 * 1024 * 1024, 'read_budget')
      cache.set(ref.path, { bytes, sha256: baselineSha256(bytes) })
    }
    const v = cache.get(ref.path)
    baselineNeed(v.bytes.length === ref.bytes && v.sha256 === ref.sha256, 'ref_digest')
    return v.bytes
  }
  const p = baselineJson(bound(selection.proofRef, 2 * 1024 * 1024))
  keys(p, ['schemaVersion', 'producerId', 'deliveryId', 'runId', 'command', 'status', 'identity', 'identityScope',
    'creation', 'readback', 'source', 'conditions', 'counts', 'timing', 'codeBindings', 'qualification'])
  baselineNeed(p.schemaVersion === 'natural-world-baseline-result-v1' && p.producerId === BASELINE_PRODUCER &&
    p.deliveryId === BASELINE_DELIVERY && p.status === 'baseline_verified' && ['create', 'verify'].includes(p.command) && RUN.test(p.runId) &&
    p.identityScope === context.identityScope, 'proof_identity')
  equal(p.identity, context.identity, 'proof_identity')
  equal(p.qualification, QUALIFICATION, 'qualification')
  const worldRoot = context.worldRoot, runRoot = worldRoot + 'runs/' + p.runId + '/'
  baselineNeed(RUN.test(p.creation.artifactRunId), 'artifact_run')
  const artifactRoot = worldRoot + 'runs/' + p.creation.artifactRunId + '/'
  baselineNeed(selection.proofRef.path === runRoot + 'result.json', 'proof_location')
  baselineNeed(p.readback.receiptRef.path === runRoot + 'reader.json', 'reader_location')
  for (const ref of [p.creation.bootstrapResultRef, p.source.sourceFactReleaseRef,
    p.source.sourcePackageRef, p.source.generatedFactsRef, p.conditions.manifestRef, p.conditions.packageRef]) {
    baselineNeed(ref.path.startsWith(artifactRoot), 'artifact_location')
  }
  processProof(p.creation.writer); processProof(p.readback.reader)
  baselineNeed(p.creation.mode === 'configured_store' && p.creation.before.slot === 'not_found' &&
    p.creation.before.outputs === 'absent' && p.creation.writer.pid !== p.readback.reader.pid &&
    Date.parse(p.readback.reader.startedAtUtc) >= Date.parse(p.creation.writer.finishedAtUtc), 'independent_readback')
  baselineNeed(p.creation.writerObservationRef.path === artifactRoot + 'create-process.json' &&
    p.readback.readerObservationRef.path === runRoot + 'read-process.json', 'process_observation_location')
  const writerObservation = baselineJson(bound(p.creation.writerObservationRef)), readerObservation = baselineJson(bound(p.readback.readerObservationRef))
  for (const [observed, operation] of [[writerObservation, p.creation.writer], [readerObservation, p.readback.reader]]) {
    baselineNeed(observed.schemaVersion === 'natural-world-baseline-process-observation-v1' && observed.reasonCode === null &&
      observed.process.pid === operation.pid && observed.process.exitCode === 0 &&
      Date.parse(observed.process.startedAtUtc) <= Date.parse(operation.startedAtUtc) &&
      Date.parse(observed.process.finishedAtUtc) >= Date.parse(operation.finishedAtUtc), 'process_observation')
  }
  baselineNeed(Date.parse(readerObservation.process.startedAtUtc) >= Date.parse(writerObservation.process.finishedAtUtc), 'process_exit_order')
  const expectedStore = context.storeRoot + '/' + p.identity.ownerId + '/' + p.identity.worldId + '.json'
  baselineNeed(p.creation.storeRef.path === expectedStore, 'store_location')
  const record = verifyNaturalRecordBytes(bound(p.creation.storeRef), p.identity)
  const bootstrap = baselineJson(bound(p.creation.bootstrapResultRef))
  baselineNeed(bootstrap.schemaVersion === 'natural-world-bootstrap-result-v1' && bootstrap.executionMode === 'configured_store' &&
    bootstrap.status === 'unpublished_natural_world_candidate_saved' && bootstrap.stored.ok === true, 'bootstrap')
  equal(bootstrap.identity, p.identity, 'bootstrap_identity')
  baselineNeed(bootstrap.stored.fileSha256 === p.creation.storeRef.sha256 && bootstrap.factHash === record.worldFactsPayloadSha256, 'bootstrap_store')
  const summary = { fileSha256: p.creation.storeRef.sha256, recordContentSha256: record.recordContentSha256,
    worldFactsPayloadSha256: record.worldFactsPayloadSha256, statePayloadSha256: record.statePayloadSha256,
    tick: record.tick, stateVersion: record.stateVersion, eventCursor: record.eventCursor, ruleVersion: record.ruleVersion,
    randomStateSha256: baselineDigest(record.randomState) }
  equal(p.creation.after, summary, 'creation_summary')
  const receipt = baselineJson(bound(p.readback.receiptRef))
  baselineNeed(receipt.schemaVersion === 'natural-world-baseline-readback-v1' && receipt.producerId === BASELINE_PRODUCER &&
    receipt.runId === p.runId && receipt.process.pid === p.readback.reader.pid, 'reader_receipt')
  equal(receipt.identity, p.identity, 'reader_identity'); equal(receipt.record, summary, 'reader_summary')
  equal(receipt.process, p.readback.reader, 'reader_process')
  equal(receipt.source, p.source, 'reader_source'); equal(receipt.conditions, p.conditions, 'reader_conditions')
  equal(receipt.codeBindings, p.codeBindings, 'reader_code'); equal(receipt.storeRef, p.creation.storeRef, 'reader_store')
  baselineNeed(receipt.method === 'original_store_exited_writer_source_replay_and_23_png_decode' && receipt.modelExecuted === false, 'reader_method')
  const contract = baselineJson(bound(p.source.contractRef))
  baselineNeed(p.source.contractRef.path === BASELINE_CONTRACT.path && p.source.contractRef.sha256 === BASELINE_CONTRACT.sha256 &&
    contract.schemaVersion === 'natural-world-bootstrap-contract-v2', 'contract')
  const release = baselineJson(bound(p.source.sourceFactReleaseRef)), pack = baselineJson(bound(p.source.sourcePackageRef)), generated = baselineJson(bound(p.source.generatedFactsRef))
  baselineNeed(release.schemaVersion === 'natural-world-source-fact-release-v1' && release.scope === 'natural_world_runtime_v1' &&
    release.ownerId === p.identity.ownerId && release.worldId === p.identity.worldId && release.regionId === p.identity.regionId &&
    release.tick === 0 && release.factHash === record.worldFactsPayloadSha256, 'source_release')
  const { sourceFactReleaseIdentity, ...releasePayload } = release
  baselineNeed(sourceFactReleaseIdentity === 'natural-source-facts-' + baselineDigest(releasePayload), 'source_release_identity')
  equal(generated.identity, p.identity, 'generated_identity'); equal(generated.sourcePackage, pack, 'source_package')
  baselineNeed(release.sourcePackageBinding.path === p.source.sourcePackageRef.path &&
    release.sourcePackageBinding.sha256 === p.source.sourcePackageRef.sha256 &&
    release.generatedFactsBinding.path === p.source.generatedFactsRef.path &&
    release.generatedFactsBinding.sha256 === p.source.generatedFactsRef.sha256, 'release_artifact_binding')
  baselineNeed(generated.schemaVersion === 'natural-world-generated-facts-v1' && generated.ruleVersion === record.ruleVersion &&
    generated.sourcePackageIdentity === release.sourcePackageIdentity, 'generated')
  equal(generated.randomState, record.randomState, 'generated_rng')
  equal(record.worldState.payload.environment, { ...generated.environment,
    resourceInitialization: 'no_resource_instances_created', runtimeEvents: 'none_created' }, 'generated_environment')
  equal(record.worldState.payload.objects, record.worldFacts.payload.objectFootprints, 'generated_objects')
  equal({ schemaVersion: 'natural-world-facts-snapshot-v1', worldId: generated.identity.worldId,
    regionId: generated.identity.regionId, tick: generated.tick,
    payload: Object.fromEntries(['terrainRegions', 'objectFootprints', 'walkableRegions', 'collisionRegions'].map(k => [k, generated.geometry[k]])) },
  record.worldFacts, 'generated_geometry')
  const sourceMap = new Map((p.source.inputRefs ?? []).map(r => [r.path, r]))
  baselineNeed(sourceMap.size > 0 && sourceMap.size <= 256 && sourceMap.size === p.source.inputRefs.length &&
    sourceMap.size === new Set(generated.sourceInputReads.map(r => r.path)).size, 'source_refs')
  for (const r of generated.sourceInputReads) {
    const actual = sourceMap.get(r.path)
    baselineNeed(actual && actual.sha256 === r.fileSha256 && actual.bytes === r.bytes, 'source_read_binding')
  }
  const excludedLargeSourceRefs = []
  const largeSources = new Set([
    '.runtime/ai-painter/earth-geospatial-source-cache/copernicus-dem-glo30-2021-n14e101/source.tif',
    '.runtime/ai-painter/earth-geospatial-source-cache/esa-worldcover-2021-v200-n12e099/source.tif',
  ])
  for (const ref of sourceMap.values()) {
    refShape(ref)
    baselineNeed(!ref.path.includes('/controller-repair-reviews/') && !/\.(?:png|jpg|jpeg|pt|pth)$/i.test(ref.path), 'source_forbidden')
    if (ref.bytes > 16 * 1024 * 1024) {
      baselineNeed(largeSources.has(ref.path), 'large_source_not_registered')
      excludedLargeSourceRefs.push({ ...ref })
    } else bound(ref, 16 * 1024 * 1024)
  }
  for (const r of generated.sourceInputReads) {
    const actual = sourceMap.get(r.path)
    baselineNeed(actual && actual.sha256 === r.fileSha256 && actual.bytes === r.bytes, 'source_read_binding')
  }
  function storedRole(role, ref) {
    const found = record.sourceBindings.filter(x => x.role === role)
    baselineNeed(found.length === 1 && found[0].uri === ref.path && found[0].fileSha256 === ref.sha256, 'stored_binding')
  }
  for (const [role, ref] of [['natural_source_fact_release', p.source.sourceFactReleaseRef], ['natural_source_package', p.source.sourcePackageRef],
    ['natural_generated_facts', p.source.generatedFactsRef], ['condition_manifest', p.conditions.manifestRef], ['condition_package', p.conditions.packageRef]]) storedRole(role, ref)
  const manifest = baselineJson(bound(p.conditions.manifestRef)), conditions = baselineJson(bound(p.conditions.packageRef))
  const tensorContract = baselineJson(bound(p.conditions.tensorContractRef))
  baselineNeed(p.conditions.tensorContractRef.path === conditions.identityBindings.conditionContractPath &&
    p.conditions.tensorContractRef.sha256 === conditions.identityBindings.conditionContractSha256 &&
    tensorContract.conditionContractIdentity === conditions.identityBindings.conditionContractIdentity, 'tensor_contract')
  const canonicalPack = structuredClone(conditions); delete canonicalPack.conditionPackSha256; delete canonicalPack.identityBindings.conditionPackageSha256
  baselineNeed(baselineSha256(Buffer.from(JSON.stringify(canonicalPack))) === conditions.conditionPackSha256 &&
    manifest.conditionPackSha256 === conditions.conditionPackSha256, 'condition_pack_digest')
  equal(manifest.identityBindings, conditions.identityBindings, 'condition_manifest_binding')
  baselineNeed(manifest.conditionPackPath === p.conditions.packageRef.path && conditions.scope === 'natural_world_runtime_v1' &&
    conditions.worldId === p.identity.worldId && conditions.regionId === p.identity.regionId && conditions.tick === 0 &&
    conditions.factHash === record.worldFactsPayloadSha256 && conditions.newWorldIsDatasetSample === false &&
    conditions.datasetBindingPurpose === 'model_training_knowledge_only', 'conditions_identity')
  baselineNeed(Array.isArray(p.conditions.channels) && p.conditions.channels.length === 23 && conditions.channels.length === 23 &&
    new Set(conditions.channels.map(c => c.id)).size === 23, 'channels')
  equal(conditions.channels.map(c => c.id), tensorContract.tensorContract.channelOrder, 'channel_order')
  for (let i = 0; i < 23; i++) {
    const c = conditions.channels[i], ref = p.conditions.channels[i]
    baselineNeed(c.id === ref.id && c.path === ref.path && c.sha256 === ref.sha256 && c.dtype === 'uint8', 'channel_binding')
    equal(c.shape, [1, 768, 1024], 'channel_shape'); equal(ref.shape, c.shape, 'channel_shape')
    const bytes = bound({ path: ref.path, sha256: ref.sha256, bytes: ref.bytes }, 8 * 1024 * 1024)
    baselineNeed(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.readUInt32BE(16) === 1024 && bytes.readUInt32BE(20) === 768, 'channel_png_header')
    storedRole('condition_channel_' + c.id, ref)
  }
  const codeMap = new Map(p.codeBindings.map(x => [x.path, x]))
  baselineNeed(codeMap.size === p.codeBindings.length && codeMap.size <= 128 && BASELINE_CODE_FILES.every(f => codeMap.has(f)), 'code_bindings')
  for (const ref of codeMap.values()) { baselineNeed(/^(?:src\/|scripts\/)/.test(ref.path), 'code_location'); bound(ref) }
  baselineNeed(Array.isArray(release.producerBindings) && release.producerBindings.length === BASELINE_SOURCE_PRODUCERS.length, 'producer_set')
  for (let i = 0; i < BASELINE_SOURCE_PRODUCERS.length; i++) {
    const ref = release.producerBindings[i]
    baselineNeed(ref.path === BASELINE_SOURCE_PRODUCERS[i] && codeMap.get(ref.path)?.sha256 === ref.sha256, 'producer_binding')
  }
  const counts = { terrainRegionCount: record.worldFacts.payload.terrainRegions.length, objectCount: record.worldFacts.payload.objectFootprints.length,
    walkableRegionCount: record.worldFacts.payload.walkableRegions.length, collisionRegionCount: record.worldFacts.payload.collisionRegions.length, conditionChannelCount: 23 }
  equal(p.counts, counts, 'counts'); equal(receipt.counts, counts, 'reader_counts')
  baselineNeed(Number.isFinite(Date.parse(p.timing.startedAtUtc)) && Date.parse(p.timing.finishedAtUtc) >= Date.parse(p.timing.startedAtUtc) &&
    p.timing.createdAtUtc === record.savedAt && Number.isFinite(p.timing.elapsedMs) && p.timing.elapsedMs >= 0, 'timing')
  baselineNeed(Date.parse(p.timing.finishedAtUtc) >= Date.parse(readerObservation.process.finishedAtUtc) &&
    Date.parse(selection.selectedAtUtc) >= Date.parse(p.timing.finishedAtUtc) &&
    Date.parse(readerObservation.process.startedAtUtc) >= Date.parse(p.timing.startedAtUtc) &&
    (p.command !== 'create' || Date.parse(writerObservation.process.startedAtUtc) >= Date.parse(p.timing.startedAtUtc)), 'timing_envelope')
  baselineNeed(Date.now() - started <= 8000, 'read_budget')
  return { status: 'verified_bound_machine_readback', machineStatus: p.status, producerId: BASELINE_PRODUCER,
    deliveryId: BASELINE_DELIVERY, runId: p.runId, identity: { ...p.identity }, identityScope: p.identityScope,
    proofRef: { ...selection.proofRef }, verifiedAtUtc: new Date().toISOString(),
    store: { ...p.creation.storeRef, ...summary }, conditions: { channelCount: 23, manifestRef: p.conditions.manifestRef, packageRef: p.conditions.packageRef },
    counts, timing: { ...p.timing, readbackAtUtc: p.readback.reader.finishedAtUtc }, qualification: baselineQualification(),
    verificationScope: 'bound_machine_independent_readback_evidence_actual_bytes_not_new_runtime_or_model_qualification',
    readCoverage: { files: cache.size, bytes: total, pngDecode: false, sourceReplay: false,
      rawSourceBytesRehashed: false, excludedLargeSourceRefs, machineReadbackAtUtc: p.readback.reader.finishedAtUtc,
      writes: false, processesStarted: false } }
}
