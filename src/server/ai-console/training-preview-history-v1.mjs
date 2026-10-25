import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { crc32, inflateSync } from 'node:zlib'

// Closed compatibility table: a new Run is not a new API, but a new policy
// version must have explicitly reviewed path, schema and scope semantics.
const POLICY_PROTOCOLS = new Map([
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v9.json', {
    schema: 'ai-painter-training-preview-observation-policy-v9',
    capability: 'stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1',
    model: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    root: '.runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions/',
    sourceLimit: 256,
  }],
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v2.json', {
    schema: 'ai-painter-training-preview-observation-policy-v2',
    capability: 'stage4_mvp256_dry_object_support_structure_quality24_v1',
    model: 'stage4_mvp256_dry_factorized_ecology_terrain_detail_weight_precision_v1',
    root: '.runtime/ai-painter/object-support-structure-quality-executions/',
  }],
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v3.json', {
    schema: 'ai-painter-training-preview-observation-policy-v3',
    capability: 'stage4_mvp256_dry_final_rgb_base_weight_quality24_v1',
    model: 'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1',
    root: '.runtime/ai-painter/final-rgb-base-weight-quality-executions/',
  }],
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v4.json', {
    schema: 'ai-painter-training-preview-observation-policy-v4',
    capability: 'stage4_mvp256_dry_joint_object_priority_quality24_v1',
    model: 'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1',
    root: '.runtime/ai-painter/joint-object-priority-quality-executions/',
  }],
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v5.json', {
    schema: 'ai-painter-training-preview-observation-policy-v5',
    capability: 'stage4_mvp256_dry_joint_object_priority_quality24_v1',
    model: 'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1',
    root: '.runtime/ai-painter/joint-object-priority-quality-executions/',
  }],
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v6.json', {
    schema: 'ai-painter-training-preview-observation-policy-v6',
    capability: 'stage4_mvp256_dry_decode1_entry_weight_quality24_v1',
    model: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    root: '.runtime/ai-painter/decode1-entry-weight-quality-executions/',
    sourceLimit: 256,
  }],
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v7.json', {
    schema: 'ai-painter-training-preview-observation-policy-v7',
    capability: 'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1',
    model: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    root: '.runtime/ai-painter/decode1-entry-weight-quality-completion-executions/',
    sourceLimit: 256,
  }],
  ['data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v8.json', {
    schema: 'ai-painter-training-preview-observation-policy-v8',
    capability: 'stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2',
    model: 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1',
    root: '.runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions/',
    sourceLimit: 256,
  }],
])

// Protocol admission, not candidate admission. The policy must be reached through
// an authenticated registry (preparation) or this Run's immutable package (reads).
// This module never reads the mutable current registry or imports runner code.
export const TRAINING_INTERFACE_PROTOCOLS = Object.freeze({
  package: 'ai-painter-current-training-package-v1',
  progress: 'ai-painter-current-training-progress-v1',
  previewRecord: 'training-preview-diagnostic-record-v1',
  previewManifest: 'training-preview-diagnostic-manifest-v1',
  timing: 'decode1-entry-worker-execution-timing-v1',
})
export function decodeTrainingInterfaceJson(raw, maximum=65536) {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > maximum) throw Error('training_interface_json_limit')
  const source=raw.toString('utf8')
  if (!Buffer.from(source).equals(raw)) throw Error('training_interface_json_encoding')
  const tokens=source.match(/"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\u0000-\u001f])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]|[\x20\t\r\n]+/gu)??[]
  if(tokens.join('')!==source)throw Error('training_interface_json_invalid')
  const values=tokens.filter(token=>!/^\s+$/u.test(token));let cursor=0
  const take=expected=>{if(values[cursor++]!==expected)throw Error('training_interface_json_invalid')}
  const visit=depth=>{
    if(depth>64)throw Error('training_interface_json_depth')
    const token=values[cursor++]
    if(token==='{'){
      const keys=new Set();if(values[cursor]==='}'){cursor++;return}
      for(;;){const key=values[cursor++];if(!key?.startsWith('"'))throw Error('training_interface_json_invalid')
        const decoded=JSON.parse(key);if(keys.has(decoded))throw Error('training_interface_json_duplicate_key');keys.add(decoded)
        take(':');visit(depth+1);if(values[cursor]==='}'){cursor++;return}take(',')}
    }
    if(token==='['){if(values[cursor]===']'){cursor++;return}for(;;){visit(depth+1);if(values[cursor]===']'){cursor++;return}take(',')}}
    if(token===undefined||!['true','false','null'].includes(token)&&!token.startsWith('"')&&!Number.isFinite(Number(token)))throw Error('training_interface_json_invalid')
  }
  visit(0);if(cursor!==values.length)throw Error('training_interface_json_invalid')
  return JSON.parse(source)
}
export function parseTrainingInterfacePolicy(policy) {
  const fail = message => { throw new Error(`training_interface_${message}`) }
  const require = (condition, message) => { if (!condition) fail(message) }
  const descriptor = policy?.interfaceContract
  require(object(policy) && policy.schemaVersion === 'ai-painter-registered-training-execution-policy-v1'
    && object(descriptor), 'schema_unsupported')
  require(isDeepStrictEqual(Object.keys(descriptor).sort(),
    ['adapterId', 'candidateSelection', 'packagePrefix', 'protocols', 'runPrefix', 'schemaVersion']), 'descriptor_fields')
  require(descriptor.schemaVersion === 'ai-painter-training-interface-contract-v1'
    && descriptor.adapterId === 'decode1_entry_same_call_completion_v1'
    && isDeepStrictEqual(descriptor.protocols, TRAINING_INTERFACE_PROTOCOLS), 'protocol_unsupported')
  const selector = descriptor.candidateSelection
  require(typeof selector === 'string' && /^[a-z][a-z0-9-]{7,79}$/u.test(selector)
    && policy.candidateSelection === selector, 'selector_invalid')
  require(descriptor.runPrefix === `${selector}-` && descriptor.packagePrefix === `${selector}-package-`, 'prefix_conflict')
  require(typeof policy.candidate === 'string' && /^[a-z][a-z0-9_]{7,127}$/u.test(policy.candidate)
    && policy.modelCapability === (['stage4_mvp256_dry_decode2_rgb_output_support_structure_weight1_v1',
      'stage4_mvp256_dry_decode2_rgb_output_qualification_capture_v1',
      'stage4_mvp256_dry_decode2_rgb_output_training_capture_v1',
      'stage4_mvp256_dry_decode2_rgb_output_training_capture_v2',
      'stage4_mvp256_dry_decode2_rgb_output_training_capture_v3',
      'stage4_mvp256_dry_decode2_rgb_output_training_capture_v4',
      'stage4_mvp256_dry_decode2_rgb_output_training_capture_v5',
      'stage4_mvp256_dry_decode2_rgb_output_training_capture_v6'].includes(policy.candidate)
      ? 'stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1'
      : policy.candidate === 'stage4_mvp256_dry_decode2_support_structure_weight1_v1'
      ? 'stage4_mvp256_dry_factorized_ecology_decode2_entry_weight_precision_v1'
      : 'stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1'), 'model_unsupported')
  if (policy.candidate === 'stage4_mvp256_dry_decode2_rgb_output_qualification_capture_v1') {
    require(selector === 'd2o-p0c-v1'
      && policy.executionProfile === 'completion_decode2_rgb_output_qualification_capture_v1', 'capture_identity_conflict')
  }
  const trainingCaptureIdentities = {
    stage4_mvp256_dry_decode2_rgb_output_training_capture_v1: ['d2o-p0t-v1', 'completion_decode2_rgb_output_training_capture_v1'],
    stage4_mvp256_dry_decode2_rgb_output_training_capture_v2: ['d2o-p0t2-v1', 'completion_decode2_rgb_output_training_capture_v2'],
    stage4_mvp256_dry_decode2_rgb_output_training_capture_v3: ['d2o-p0t3-v1', 'completion_decode2_rgb_output_training_capture_v3'],
    stage4_mvp256_dry_decode2_rgb_output_training_capture_v4: ['d2o-p0t4-v1', 'completion_decode2_rgb_output_training_capture_v4'],
    stage4_mvp256_dry_decode2_rgb_output_training_capture_v5: ['d2o-p0t5-v1', 'completion_decode2_rgb_output_training_capture_v5'],
    stage4_mvp256_dry_decode2_rgb_output_training_capture_v6: ['d2o-p0t6-v1', 'completion_decode2_rgb_output_training_capture_v6'],
  }
  if (Object.hasOwn(trainingCaptureIdentities, policy.candidate)) {
    const [expectedSelector, expectedProfile] = trainingCaptureIdentities[policy.candidate]
    require(selector === expectedSelector && policy.executionProfile === expectedProfile, 'training_capture_identity_conflict')
  }
  require(policy.outputRoot === `.runtime/ai-painter/registered-training-${selector}-executions`
    && typeof policy.executionProfile === 'string' && /^[a-z][a-z0-9_]{7,127}$/u.test(policy.executionProfile), 'namespace_conflict')
  for (const key of ['formalSpecification', 'trainingPreviewPolicy']) binding(policy[key])
  binding(policy.progressPublication?.componentPolicy)
  require(policy.formalSpecification.path === 'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md'
    && typeof policy.formalSpecification.version === 'string' && /^AI-PAINTER-SPEC-1\.\d+$/u.test(policy.formalSpecification.version), 'specification_invalid')
  require(policy.trainingPreviewPolicy.path.startsWith('data/ai-painter/system-governance/')
    && policy.progressPublication.componentPolicy.path.startsWith('data/ai-painter/system-governance/'), 'policy_boundary_conflict')
  require(policy.entrypointPath === 'scripts/run-ai-painter-decode1-entry-weight-quality-v1.mjs'
    && policy.progressPublication.componentPath === 'ml/ai-painter/src/ai_painter/complete_world/bounded_progress_publication_cpu_v2.py', 'implementation_unsupported')
  const ceiling = policy.executionCeiling, resources = policy.phaseResources
  require(object(ceiling) && ceiling.epochs === 24 && ceiling.generatorOptimizerSteps === 1152
    && ceiling.discriminatorOptimizerSteps === 1152 && ceiling.trainingWallMode === 'completion'
    && ceiling.maxWallSeconds === null && object(resources) && resources.gpuAdmissionWallMode === 'completion'
    && resources.gpuAdmissionSeconds === null && resources.programFileCountMaximum === 256, 'resource_conflict')
  require(isDeepStrictEqual(policy.scope?.resolution, [256, 192]) && policy.scope?.worldCount === 1
    && policy.scope?.waterFactPresent === false && policy.scope?.formalStage4Qualification === false
    && policy.scope?.runtimePublication === false, 'scope_conflict')
  return { descriptor: structuredClone(descriptor), capability: policy.candidate, model: policy.modelCapability,
    root: `${policy.outputRoot}/`, profile: policy.executionProfile, sourceLimit: 256,
    previewPolicy: binding(policy.trainingPreviewPolicy), progressPolicy: binding(policy.progressPublication.componentPolicy),
    policySchema: policy.schemaVersion, gpuAdmissionCompletion: true }
}

export async function readBoundTrainingInterface({ envelope, plan, parent, readJson }) {
  // Absence is legacy. Presence with any invalid value must NOT fall back.
  if (!Object.hasOwn(plan ?? {}, 'interfacePolicy')) return null
  const bound = binding(plan.interfacePolicy)
  same(bound, plan.executionPolicy); same(bound, plan.configuration?.executionPolicy)
  need(Array.isArray(envelope.inputEvidence) && envelope.inputEvidence.length <= 128
    && envelope.inputEvidence.filter(item => item?.path === bound.path).length === 1, 'plan_policy_not_bound')
  same(envelope.inputEvidence.find(item => item?.path === bound.path), bound)
  const policy = await readJson(bound, 65536), protocol = parseTrainingInterfacePolicy(policy)
  need(['runId', 'packageId', 'capabilityVersion'].every(key => plan[key] === parent[key])
    && envelope.packageIdentity === parent.packageId && envelope.capabilityVersion === parent.capabilityVersion
    && plan.capabilityVersion === protocol.capability && plan.configuration?.capabilityVersion === protocol.capability
    && plan.configuration?.modelCapabilityVersion === protocol.model
    && plan.executionProfile === protocol.profile && parent.runId.startsWith(protocol.descriptor.runPrefix)
    && parent.packageId.startsWith(protocol.descriptor.packagePrefix) && plan.outputRoot === `${protocol.root}${parent.runId}`
    && envelope.outputRoot === plan.outputRoot && isDeepStrictEqual(plan.configuration.executionCeiling, policy.executionCeiling), 'policy_scope_conflict')
  same(plan.trainingPreviewPolicy, protocol.previewPolicy); same(plan.configuration.trainingPreviewPolicy, protocol.previewPolicy)
  same(plan.configuration.progressPublicationPolicy, protocol.progressPolicy)
  return { ...protocol, policy, policyPath: bound.path, interfacePolicy: bound }
}
const PURPOSE = 'not_reviewed_diagnostic_only'
const PHASE = 'after_discriminator_update_before_generator_update'
const FLAGS = ['formalOutput', 'checkpointSelectionEligible', 'qualificationEvidence', 'runtimePublicationEligible']
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const count = value => Number.isSafeInteger(value) && value >= 0
const sha = value => createHash('sha256').update(value).digest('hex')
// Producer ABI: Python json.dumps(sort_keys=True, separators=(',', ':'),
// ensure_ascii=True). Registered plans originate in JSON (not Python objects).
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : object(value)
  ? `{${Object.keys(value).sort().map(key => `${canonical(key)}:${canonical(value[key])}`).join(',')}}`
  : typeof value === 'string' ? JSON.stringify(value).replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
    : typeof value === 'number' && value !== 0 && Math.abs(value) < 0.0001
      ? value.toExponential().replace(/e([+-])(\d)$/u, (_match, sign, digit) => `e${sign}0${digit}`) : JSON.stringify(value)
export const previewIdentityHash = value => sha(canonical(value))

function need(condition, code) { if (!condition) throw new Error(`training_preview_${code}`) }
function binding(value) {
  need(object(value) && typeof value.path === 'string' && value.path.length <= 1024
    && !value.path.startsWith('/') && !/[\\:\x00-\x1f]/u.test(value.path)
    && value.path.split('/').every(part => part && part !== '.' && part !== '..')
    && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(value.sha256), 'binding_invalid')
  return { path: value.path, sha256: value.sha256 }
}
function same(a, b) { need(isDeepStrictEqual(binding(a), binding(b)), 'binding_conflict') }
function within(value, root) { binding(value); need(value.path.startsWith(`${root}/`), 'output_boundary_conflict') }
function pngRgb8(image, width, height) {
  need(image.length >= 33 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image_invalid')
  let offset = 8, header = false, ended = false
  const payloads = []
  while (offset + 12 <= image.length) {
    const length = image.readUInt32BE(offset), next = offset + 12 + length
    need(next <= image.length, 'image_invalid')
    const kind = image.toString('ascii', offset + 4, offset + 8), data = image.subarray(offset + 8, next - 4)
    need(crc32(image.subarray(offset + 4, next - 4)) === image.readUInt32BE(next - 4), 'image_invalid')
    if (!header) {
      need(kind === 'IHDR' && length === 13 && data.readUInt32BE(0) === width && data.readUInt32BE(4) === height
        && data.subarray(8).equals(Buffer.from([8, 2, 0, 0, 0])), 'image_invalid')
      header = true
    } else if (kind === 'IDAT') payloads.push(data)
    else if (kind === 'IEND') { need(length === 0 && next === image.length, 'image_invalid'); ended = true; break }
    else need(kind !== 'IHDR' && (image[offset + 4] & 32) !== 0, 'image_invalid')
    offset = next
  }
  need(header && ended && payloads.length > 0, 'image_invalid')
  const stride = width * 3 + 1, decoded = inflateSync(Buffer.concat(payloads), { maxOutputLength: stride * height })
  need(decoded.length === stride * height, 'image_invalid')
  for (let row = 0; row < height; row++) need(decoded[row * stride] <= 4, 'image_invalid')
}
function identity(value, parent) {
  need(object(value) && ['runId', 'packageId', 'capabilityVersion'].every(key => value[key] === parent[key]), 'identity_conflict')
}
function state(error) {
  if (error?.code === 'ENOENT') return 'missing'
  if (['EACCES', 'EPERM'].includes(error?.code)) return 'unreadable'
  if (error?.message === 'history_sha_mismatch') return 'hash_conflict'
  if (error?.status === 413 || error?.message === 'training_preview_read_budget') return 'over_limit'
  if (error?.message === 'training_preview_schema_unsupported') return 'unsupported_schema'
  return 'unavailable'
}

// Injectable IO keeps the adapter testable; production supplies only the
// existing registry/process verifier and bound-training-presentation reader.
export async function readTrustedTrainingPreviewProgress({ runId, readRegistry, readPresentation, readJson, currentPath }) {
  const current = await readRegistry()
  need(current.ok === true && object(current.registry), 'current_registry_unavailable')
  const registry = current.registry, active = registry.activeExecution
  if (registry.runId !== runId || !active) return null
  const presentation = await readPresentation(current)
  const metrics = presentation.currentMetrics
  need(metrics?.availability === 'available' && metrics.runId === runId
    && metrics.processId === active.processId && metrics.processStartIdentity === active.processStartIdentity
    && metrics.sourceIdentity === 'current_registry_bound_progress_v1', 'current_progress_unavailable')
  const progress = await readJson(binding({ path: metrics.sourcePath, sha256: metrics.sourceSha256 }))
  identity(progress, registry)
  need(progress.schemaVersion === 'ai-painter-current-training-progress-v1', 'schema_unsupported')
  await readJson(binding({ path: currentPath, sha256: current.registrySha256 }))
  return progress
}

/** Pure, bounded adapter: IO is supplied by the existing trusted history reader.
 * No directory discovery, state writes, model/weight loads or inference. Mutable
 * progress is accepted ONLY when the caller supplies the original verified
 * current-registry/bound-progress context; a historical `running` flag is not one.
 */
export async function readTrainingPreviewHistory({ parent, manifestBinding = null, progress = null,
  progressVerified = false, readBytes, planSchemas = [], configurationSchemas = [],
  metadataOnly = false, artifactId = null }) {
  const report = { status: 'not_recorded', reasonCode: 'unregistered_source', source: manifestBinding ? 'terminal_manifest' : 'verified_current_progress',
    verifiedCount: 0, gaps: [], images: [] }
  let consumed = 0, reads = 0
  const started = Date.now(), cache = new Map()
  const binary = async (bound, maximum) => {
    const b = binding(bound)
    need(++reads <= 256 && Date.now() - started <= 5000, 'read_budget')
    const key = `${b.path}:${b.sha256}`
    if (cache.has(key)) return cache.get(key)
    const remaining = Math.min(maximum, 16 * 1024 * 1024 - consumed)
    need(remaining > 0, 'read_budget')
    const raw = await readBytes(b, remaining)
    need(Buffer.isBuffer(raw) && raw.length <= remaining, 'read_budget')
    if (sha(raw) !== b.sha256) throw new Error('history_sha_mismatch')
    consumed += raw.length; cache.set(key, raw)
    need(Date.now() - started <= 5000, 'read_budget')
    return raw
  }
  const json = async (bound, maximum = 2 * 1024 * 1024) => {
    const value = decodeTrainingInterfaceJson(await binary(bound, maximum),maximum)
    need(object(value), 'document_invalid'); return value
  }
  try {
    need(typeof metadataOnly === 'boolean' && (artifactId === null
      || typeof artifactId === 'string' && /^[a-f0-9]{64}$/u.test(artifactId) && !metadataOnly), 'query_invalid')
    if (!manifestBinding && !(progressVerified && progress?.latestTrainingPreview)) return report
    need(object(parent) && typeof parent.runId === 'string', 'identity_conflict')
    const envelope = await json(parent.executionPackage)
    need(envelope.schemaVersion === 'ai-painter-autonomous-closed-loop-package-v1', 'schema_unsupported')
    need(envelope.packageIdentity === parent.packageId && envelope.capabilityVersion === parent.capabilityVersion,
      'identity_conflict')
    const root = envelope.outputRoot
    need(typeof root === 'string' && root.startsWith('.runtime/ai-painter/'), 'output_boundary_conflict')
    binding({ path: root, sha256: parent.executionPackage.sha256 })
    need(Array.isArray(envelope.inputEvidence) && envelope.inputEvidence.length <= 128, 'package_invalid')
    const plans = envelope.inputEvidence.filter(item => item?.path === `${root}/quality-plan.json`)
    need(plans.length === 1, 'plan_policy_not_bound')
    const planBinding = plans[0], plan = await json(planBinding)
    identity(plan, parent)
    need(planSchemas.includes(plan.schema) && configurationSchemas.includes(plan.configuration?.schema)
      && plan.executionMode === 'bounded-quality-training', 'schema_unsupported')
    // Select from two authenticated declarations, not a directory/name search
    // or the first readable policy in package inputEvidence.
    const policyBinding = binding(plan.trainingPreviewPolicy)
    same(policyBinding, plan.configuration.trainingPreviewPolicy)
    const registered = await readBoundTrainingInterface({ envelope, plan, parent, readJson: json })
    const policyProtocol = registered
      ? { ...registered, schema: 'ai-painter-registered-training-preview-policy-v1' }
      : POLICY_PROTOCOLS.get(policyBinding.path)
    need(policyProtocol, 'schema_unsupported')
    const policies = envelope.inputEvidence.filter(item => registered ? item?.path === policyBinding.path : POLICY_PROTOCOLS.has(item?.path))
    need(policies.length === 1, 'plan_policy_not_bound')
    same(policies[0], policyBinding)
    const policy = await json(policyBinding, 65536)
    need(policy.schemaVersion === policyProtocol.schema, 'schema_unsupported')
    need(parent.capabilityVersion === policyProtocol.capability
      && plan.configuration.capabilityVersion === policyProtocol.capability
      && plan.configuration.modelCapabilityVersion === policyProtocol.model
      && root === `${policyProtocol.root}${parent.runId}`, 'policy_scope_conflict')
    // v2 did not carry these fields; later registered versions bind all three. A
    // contradictory optional v2 field is not a migration or fallback grant.
    for (const [key, expected] of [['capabilityVersion', policyProtocol.capability],
      ['modelCapabilityVersion', policyProtocol.model], ['outputRootPrefix', policyProtocol.root]])
      if (policyProtocol.schema !== 'ai-painter-training-preview-observation-policy-v2' || Object.hasOwn(policy.scope ?? {}, key))
        need(policy.scope?.[key] === expected, 'policy_scope_conflict')
    need(plan.outputRoot === root && object(plan.configuration) && object(plan.programBindings), 'plan_conflict')
    if (policyProtocol.sourceLimit !== undefined)
      need(Object.keys(plan.programBindings).length > 0 && Object.keys(plan.programBindings).length <= policyProtocol.sourceLimit,
        'source_identity_conflict')
    const ceiling = plan.configuration.executionCeiling, capture = policy.capture
    need(object(ceiling) && count(ceiling.epochs) && ceiling.epochs > 0
      && object(capture) && capture.split === 'train' && capture.ordinal === 0
      && capture.maxFramesPerEpoch === 1 && capture.maxFrames === 24
      && capture.phase === PHASE, 'policy_conflict')
    need(policy.scope?.epochs === 24 && policy.scope?.trainSamples === 48 && ceiling.epochs === 24
      && isDeepStrictEqual(policy.scope.resolution, [256, 192])
      && isDeepStrictEqual(plan.configuration.scope?.resolution, policy.scope.resolution)
      && policy.resources?.maxPngBytes === 155648 && policy.resources?.maxMetadataBytes === 8192
      && policy.resources?.maxPreviewBytes === 4194304 && policy.recordAndImageLimits?.maxManifestBytes === 16384,
    'policy_conflict')
    const model = await json(plan.modelBinding), manifest = await json(plan.datasetManifest)
    need(isDeepStrictEqual(envelope.programLineage, Object.fromEntries(Object.entries(plan.programBindings).map(([key, value]) => [key, binding(value).sha256]))), 'source_identity_conflict')
    need(object(policy.programBindings) && Object.values(policy.programBindings).every(value =>
      Object.values(plan.programBindings).some(program => isDeepStrictEqual(binding(program), binding(value)))), 'source_identity_conflict')
    for (const input of [plan.modelBinding, plan.datasetManifest, plan.trainSplit])
      need(envelope.inputEvidence.some(value => isDeepStrictEqual(binding(value), binding(input))), 'source_identity_conflict')
    need(model.capabilityVersion === parent.capabilityVersion
      && model.modelCapabilityVersion === plan.configuration.modelCapabilityVersion, 'model_conflict')
    const split = await json(plan.trainSplit), index = await json(manifest.sourceIndex)
    need(split.split === 'train' && Array.isArray(split.sampleIds) && split.sampleIds.length > 0
      && split.sampleIds.length === 48 && new Set(split.sampleIds).size === split.sampleIds.length
      && Array.isArray(index.samples) && index.samples.length <= 256, 'source_conflict')
    let entries
    let captureFailureCode = null
    if (manifestBinding) {
      within(manifestBinding, root)
      const collection = await json(manifestBinding, 16384)
      need(collection.schemaVersion === 'training-preview-diagnostic-manifest-v1', 'schema_unsupported')
      need(collection.runId === parent.runId && collection.packageId === parent.packageId, 'identity_conflict')
      same(collection.policy, policyBinding); same(collection.plan, planBinding)
      entries = collection.entries
      if (object(collection.secondaryError)) {
        const code = collection.secondaryError.availabilityCode
        captureFailureCode = ['capture_failed', 'budget_exhausted', 'publication_incomplete', 'binding_mismatch'].includes(code)
          ? code : 'capture_failed'
      }
    } else {
      need(progressVerified, 'current_progress_unverified'); identity(progress, parent)
      entries = [progress.latestTrainingPreview]
    }
    need(Array.isArray(entries) && entries.length <= capture.maxFrames && entries.length <= 24, 'manifest_limit')
    const epochs = new Set(), sequences = new Set()
    for (const [position, entry] of entries.entries()) {
      try {
        need(object(entry), 'entry_invalid'); within(entry.record, root); within(entry.image, root)
        // The existing artifact ABI binds identity to Run, role, path and SHA.
        // A precise image request checks only that image's full source chain;
        // list/detail requests verify record bindings, not every image body.
        if (artifactId !== null && sha(JSON.stringify([parent.runId, 'image', entry.image.path, entry.image.sha256])) !== artifactId) continue
        const frame = await json(entry.record, 8192)
        need(frame.schemaVersion === 'training-preview-diagnostic-record-v1', 'schema_unsupported')
        identity(frame, parent)
        need(frame.purpose === PURPOSE && FLAGS.every(key => frame[key] === false), 'qualification_conflict')
        same(frame.policy, policyBinding); same(frame.plan, planBinding); same(frame.executionPackage, parent.executionPackage)
        same(frame.modelBinding, plan.modelBinding); same(frame.datasetManifest, plan.datasetManifest)
        need(frame.modelCapabilityVersion === model.modelCapabilityVersion
          && frame.configurationSha256 === previewIdentityHash(plan.configuration)
          && frame.programBindingsSha256 === previewIdentityHash(plan.programBindings), 'source_identity_conflict')
        need(frame.split === 'train' && frame.phase === PHASE && count(frame.epoch) && frame.epoch > 0
          && frame.epoch <= ceiling.epochs && frame.trainOrdinal === capture.ordinal && count(frame.trainIndex)
          && frame.trainIndex < split.sampleIds.length && frame.sampleId === split.sampleIds[frame.trainIndex]
          && count(frame.forwardSequence) && frame.forwardSequence > 0
          && !epochs.has(frame.epoch) && !sequences.has(frame.forwardSequence), 'sample_or_position_conflict')
        const g = (frame.epoch - 1) * split.sampleIds.length + frame.trainOrdinal, d = g + 1
        need(frame.optimizerSteps?.generator === g && frame.optimizerSteps?.discriminator === d
          && g <= ceiling.generatorOptimizerSteps && d <= ceiling.discriminatorOptimizerSteps, 'count_conflict')
        const latestG = progress ? progress.optimizerStepsGenerator : parent.optimizerStepsGenerator ?? parent.optimizerSteps?.generator
        const latestD = progress ? progress.optimizerStepsDiscriminator : parent.optimizerStepsDiscriminator ?? parent.optimizerSteps?.discriminator
        need(count(latestG) && count(latestD) && g <= latestG && d <= latestD, 'count_conflict')
        const rows = index.samples.filter(row => row?.sampleId === frame.sampleId && row.split === 'train')
        need(rows.length === 1, 'sample_or_position_conflict')
        const source = rows[0]
        same(frame.sourceRgb, source.image); same(frame.conditionPack, source.conditionPack)
        same(frame.image, entry.image); within(frame.image, root)
        need(count(frame.image.bytes) && frame.image.bytes > 0 && frame.image.bytes <= 155648, 'image_size_conflict')
        if (!metadataOnly) {
          const condition = await json(source.conditionPack)
          const contribution = await json(source.contribution)
          const taskBinding = { path: contribution.taskPackagePath, sha256: contribution.taskPackageSha256 }
          const task = await json(taskBinding)
          need(condition.sourceBindings?.taskPackagePath === taskBinding.path, 'world_facts_conflict')
          same(frame.worldFacts, { path: task.sourceBindings?.naturalizedWorldFactsPath,
            sha256: task.sourceBindings?.naturalizedWorldFactsSha256 })
          await json(frame.worldFacts)
          need(typeof frame.worldId === 'string' && frame.worldId.length <= 128
            && frame.worldId === condition.worldId && frame.worldId === task.worldId
            && count(frame.tick) && frame.tick === condition.tick && frame.tick === task.tick, 'world_facts_conflict')
          await binary(source.image, 16 * 1024 * 1024)
          const image = await binary(entry.image, 155648)
          need(image.length === frame.image.bytes, 'image_size_conflict')
          pngRgb8(image, 256, 192)
        }
        epochs.add(frame.epoch); sequences.add(frame.forwardSequence)
        report.images.push({ binding: binding(entry.image), metadata: { evidenceKind: 'training_diagnostic_preview',
          sourceLabel: '未审核训练预览，非Checkpoint/正式输出', purpose: PURPOSE,
          sampleId: frame.sampleId, split: 'train', epoch: frame.epoch, optimizerSteps: { generator: g, discriminator: d },
          forwardSequence: frame.forwardSequence, phase: PHASE, modelBindingMeaning: 'identity_metadata_not_step_weights',
          formalOutput: false, checkpointSelectionEligible: false, qualificationEvidence: false,
          runtimePublicationEligible: false,
          verificationStatus: metadataOnly ? 'binding_verified_bytes_not_read' : 'bytes_verified' } })
      } catch (error) { report.gaps.push({ index: position, status: state(error), reasonCode: 'training_preview_entry_unavailable' }) }
    }
    report.verifiedCount = report.images.length
    if (captureFailureCode) report.gaps.push({ status: captureFailureCode, reasonCode: captureFailureCode })
    report.status = report.gaps.length ? report.images.length ? 'partial' : report.gaps[0].status
      : entries.length ? 'available' : 'not_recorded'
    report.reasonCode = report.status === 'available' ? null : report.status === 'not_recorded' ? 'not_captured'
      : captureFailureCode ?? 'binding_mismatch'
  } catch (error) { report.status = state(error); report.reasonCode = report.status === 'unsupported_schema' ? 'unsupported_schema' : 'binding_mismatch'; report.gaps.push({ status: report.status, reasonCode: 'training_preview_parent_unavailable' }) }
  report.bytesVerified = consumed
  return report
}
