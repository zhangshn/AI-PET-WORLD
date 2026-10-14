// Legacy layouts are enabled by explicit package/result discriminants. File
// extensions classify already-bound artifacts; names never invent relationships.
const MANAGED_DETAIL_PROTOCOLS = [
  {worker:'detail-weight-managed-worker-terminal-v1', review:'detail-weight-managed-review-terminal-v1',
    plans:new Map([['detail-weight-plan.json','detail-weight-managed-plan-v1'],
      ['detail-weight-capture-plan.json','detail-weight-capture-managed-plan-v1']]),
    report:'detail-weight-native-review-input-v1', adapter:'detail_weight_managed_training_v1'},
  {worker:'ecology-regime-quality-worker-terminal-v1', review:'ecology-regime-quality-review-terminal-v1',
    plans:new Map([['quality-plan.json','ecology-regime-quality-plan-v1']]),
    configuration:'ecology-regime-quality-configuration-v1', mode:'bounded-quality-training',
    report:'ecology-regime-native-review-input-v1', adapter:'ecology_quality_training_v1'},
  {worker:'ecology-decode1-weight-quality-worker-terminal-v1', review:'ecology-decode1-weight-quality-review-terminal-v1',
    plans:new Map([['quality-plan.json','ecology-decode1-weight-quality-plan-v1']]),
    configuration:'ecology-decode1-weight-quality-configuration-v1', mode:'bounded-quality-training',
    report:'ecology-regime-native-review-input-v1', adapter:'ecology_decode1_weight_quality_training_v1'},
];
const PACKAGE_KINDS = {
  'ai-painter-decoder-binding-ab-result-v1': ['decoder_binding_ab_0', 'ai-painter-decoder-binding-ab-package-v1', 'decoder_binding_ab'],
  'ai-painter-timestep-ab-result-v1': ['timestep_ab_0', 'ai-painter-timestep-ab-package-v1', 'timestep_ab'],
  'ai-painter-learning-capacity-experiment-terminal-v1': ['experiment_0', null, 'learning_capacity'],
}
const MVP_STAGE0_LIFECYCLE_SCHEMAS = new Set([
  'ai-painter-stage4-mvp-stage0-training-lifecycle-v1',
  'ai-painter-stage4-mvp-denoiser-stage0-lifecycle-v1',
  'ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-lifecycle-v1',
])
const MVP_STAGE0_PHASE_SCHEMAS = new Map([
  ['ai-painter-stage4-mvp-stage0-training-lifecycle-v1', 'ai-painter-stage4-mvp-stage0-training-terminal-v1'],
  ['ai-painter-stage4-mvp-denoiser-stage0-lifecycle-v1', 'ai-painter-stage4-mvp-denoiser-stage0-terminal-v1'],
  ['ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-lifecycle-v1', 'ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-terminal-v1'],
])
export function legacyRunKind(schema) { return schema === 'detail-weight-managed-worker-terminal-v1' ? 'bounded_managed_training' : PACKAGE_KINDS[schema]?.[2] ?? (schema === 'ai-painter-learning-capacity-interrupted-experiment-terminal-v1' ? 'interrupted_experiment' : 'registered_experiment') }
const LEARNING_PACKAGES = new Set(['ai-painter-learning-capacity-experiment-package-v1', 'ai-painter-decoder-reconstruction-experiment-package-v1', 'ai-painter-v21-train-only-capacity-package-v1'])
// Capability numbers select no behavior: only this unchanged v1 protocol does.
const DRY_LIFECYCLE = /^ai-painter-mvp256-dry-(v\d+(?:-v\d+)?)-training-lifecycle-v1$/u
// Legacy observation chunks inherit identity ONLY from this verified canonical
// parent. Iterate its bindings, never directories or filename conventions.
async function failedObservationFragments(request, result, readJson, readEvidenceJson, requireFact) {
  const maxCandidates = 16, maxBytes = 8 * 1024 * 1024
  const report = { scope: 'canonical_v1_failed_bound_json_only', maxCandidates, maxBytes, candidatesRead: 0,
    bytesVerified: 0, parseCacheHits: 0, parsedDocuments: 0, sources: [], gaps: [] }
  const rows = [], points = new Set(), samples = new Map(request.selectedRows.map((row, ordinal) => [row.sampleId, { ...row, ordinal }]))
  const plan = new Set(request.observationPlan.map(point => `${point.epoch}:${point.optimizerStep}`))
  for (const binding of result.artifacts ?? []) {
    if (!/\.json$/iu.test(binding.path)) continue // format classification, not association
    const source = { path: binding.path, sha256: binding.sha256 }
    const gap = reasonCode => { report.gaps.push({ ...source, reasonCode }); report.sources.push({ ...source, status: 'unavailable', reasonCode }) }
    if (report.candidatesRead >= maxCandidates || report.bytesVerified >= maxBytes) {
      gap('history_observation_fragment_budget_exceeded'); continue
    }
    const remaining = maxBytes - report.bytesVerified
    let evidence
    try {
      report.candidatesRead++
      if (readEvidenceJson) evidence = await readEvidenceJson(binding, remaining)
      else {
        const value = await readJson(binding)
        evidence = { value, byteLength: value === undefined ? 0 : new TextEncoder().encode(JSON.stringify(value)).length }
      }
    } catch (error) {
      if (error.status === 413) { gap(remaining < maxBytes ? 'history_observation_fragment_budget_exceeded' : 'history_byte_limit'); continue }
      if (error.message === 'history_json_invalid' || ['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) {
        gap(error.code === 'ENOENT' ? 'history_observation_fragment_missing' : error.message === 'history_json_invalid'
          ? 'history_observation_fragment_json_invalid' : 'history_observation_fragment_unreadable'); continue
      }
      throw error // hash/path/identity conflicts never fall back to old cached data
    }
    requireFact(Number.isSafeInteger(evidence.byteLength) && evidence.byteLength >= 0 && evidence.byteLength <= remaining,
      'history_observation_fragment_budget_exceeded', 413)
    report.bytesVerified += evidence.byteLength
    if (evidence.parseCache?.hit) report.parseCacheHits++; else report.parsedDocuments++
    if (evidence.parseCache) report.parseCache = evidence.parseCache
    const value = evidence.value
    if (!value || Array.isArray(value) || typeof value !== 'object'
      || value.schemaVersion !== undefined || Object.keys(value).some(key => !['epoch', 'optimizerStep', 'trainOnly', 'summary'].includes(key))
      || !Object.hasOwn(value, 'trainOnly') || !Object.hasOwn(value, 'epoch') || !Object.hasOwn(value, 'optimizerStep')) {
      gap('history_observation_fragment_schema_unsupported'); continue
    }
    requireFact(Number.isSafeInteger(value.epoch) && Number.isSafeInteger(value.optimizerStep)
      && plan.has(`${value.epoch}:${value.optimizerStep}`), 'history_observation_fragment_point_conflict')
    const point = `${value.epoch}:${value.optimizerStep}`
    requireFact(!points.has(point), 'history_observation_fragment_duplicate_point')
    requireFact(Array.isArray(value.trainOnly) && value.trainOnly.length === samples.size,
      'history_observation_fragment_shape_conflict')
    const seen = new Set(), projected = []
    for (const row of value.trainOnly) {
      const sample = samples.get(row?.sampleId)
      requireFact(sample && row.split === 'train' && row.split === sample.split && row.trainOrdinal === sample.ordinal
        && !seen.has(row.sampleId), 'history_observation_fragment_sample_conflict')
      requireFact(row.epoch === value.epoch && row.optimizerStep === value.optimizerStep,
        'history_observation_fragment_point_conflict')
      requireFact(row.measurements && typeof row.measurements === 'object' && !Array.isArray(row.measurements),
        'history_experiment_measurements_conflict')
      seen.add(row.sampleId)
      projected.push({ sampleId: row.sampleId, split: row.split, epoch: row.epoch, optimizerStep: row.optimizerStep,
        measurements: row.measurements, sourcePath: binding.path, sourceSha256: binding.sha256 })
    }
    points.add(point); rows.push(...projected)
    report.sources.push({ ...source, status: 'available', epoch: value.epoch, optimizerStep: value.optimizerStep,
      byteLength: evidence.byteLength, verifiedCount: projected.length })
  }
  return { rows, report }
}
// Contract-version dispatch, not model-version dispatch. These identities come
// only from the immutable package/result already verified by the reader.
function experimentEnvelopeV1(request, result, requireFact, failedClosed = false) {
  const selected = new Map()
  for (const row of request.selectedRows) {
    requireFact(typeof row?.sampleId === 'string' && row.sampleId.length > 0 && row.split === 'train'
      && !selected.has(row.sampleId), 'history_experiment_sample_conflict')
    selected.set(row.sampleId, row)
  }
  requireFact(selected.size > 0, 'history_experiment_sample_conflict')
  requireFact(Array.isArray(request.observationPlan) && request.observationPlan.length > 0
    && request.observationPlan.length <= 128, 'history_experiment_observation_plan_conflict')
  const points = new Map()
  let previous = null
  for (const point of request.observationPlan) {
    requireFact(Number.isSafeInteger(point?.epoch) && point.epoch >= 0
      && Number.isSafeInteger(point.optimizerStep) && point.optimizerStep >= 0
      && (!previous || (point.epoch > previous.epoch && point.optimizerStep > previous.optimizerStep)),
    'history_experiment_observation_plan_conflict')
    points.set(`${point.epoch}:${point.optimizerStep}`, new Set())
    previous = point
  }
  const expected = selected.size * points.size
  const observations = failedClosed && result.trainOnlyObservations === undefined ? [] : result.trainOnlyObservations
  requireFact(expected <= 1024 && Array.isArray(observations)
    && (failedClosed ? observations.length <= expected : observations.length === expected), 'history_experiment_observation_coverage_conflict')
  for (const row of observations) {
    requireFact(row && Number.isSafeInteger(row.epoch) && Number.isSafeInteger(row.optimizerStep),
      'history_experiment_observation_identity_conflict')
    const seen = points.get(`${row.epoch}:${row.optimizerStep}`)
    requireFact(seen && selected.has(row.sampleId) && row.split === selected.get(row.sampleId).split
      && !seen.has(row.sampleId), 'history_experiment_observation_sample_conflict')
    requireFact(row.measurements && typeof row.measurements === 'object' && !Array.isArray(row.measurements),
      'history_experiment_measurements_conflict')
    seen.add(row.sampleId)
  }
  const missingObservations = request.observationPlan.map(point => ({ ...point,
    missingSampleIds: [...selected.keys()].filter(id => !points.get(`${point.epoch}:${point.optimizerStep}`).has(id)),
  })).filter(point => point.missingSampleIds.length > 0)
  requireFact(failedClosed || missingObservations.length === 0,
    'history_experiment_observation_coverage_conflict')
  // The package freezes the exact identity set before image paths/SHA exist.
  // A count alone cannot prove which samples/purposes were actually produced.
  const imageKey = image => JSON.stringify([image.sampleId, image.split, image.epoch, image.optimizerStep, image.purpose])
  requireFact(Array.isArray(request.imagePlan) && request.imagePlan.length > 0 && request.imagePlan.length <= 1024,
    'history_experiment_image_plan_conflict')
  const imagePlan = new Map()
  for (const item of request.imagePlan) {
    requireFact(item && selected.has(item.sampleId) && item.split === selected.get(item.sampleId).split
      && Number.isSafeInteger(item.epoch) && Number.isSafeInteger(item.optimizerStep)
      && points.has(`${item.epoch}:${item.optimizerStep}`)
      && ['prediction', 'target_final_comparison'].includes(item.purpose), 'history_experiment_image_plan_conflict')
    const key = imageKey(item)
    requireFact(!imagePlan.has(key), 'history_experiment_image_plan_conflict')
    imagePlan.set(key, item)
  }
  const imageArtifacts = failedClosed && result.imageArtifacts === undefined ? [] : result.imageArtifacts
  requireFact(Array.isArray(imageArtifacts) && (failedClosed ? imageArtifacts.length <= imagePlan.size : imageArtifacts.length === imagePlan.size),
    'history_experiment_image_shape_conflict')
  const artifacts = new Map()
  for (const item of result.artifacts ?? []) {
    requireFact(typeof item?.path === 'string' && /^[a-f0-9]{64}$/u.test(item.sha256)
      && !artifacts.has(item.path), 'history_experiment_artifact_conflict')
    artifacts.set(item.path, item)
  }
  const images = new Map()
  const seenImages = new Set()
  for (const image of imageArtifacts) {
    requireFact(typeof image?.path === 'string' && /\.(png|jpe?g)$/iu.test(image.path)
      && /^[a-f0-9]{64}$/u.test(image.sha256) && !images.has(image.path), 'history_experiment_image_binding_conflict')
    requireFact(selected.has(image.sampleId) && image.split === selected.get(image.sampleId).split,
      'history_experiment_image_sample_conflict')
    requireFact(typeof image.sourceLabel === 'string' && image.sourceLabel.trim().length > 0
      && ['prediction', 'target_final_comparison'].includes(image.purpose), 'history_experiment_image_purpose_conflict')
    const key = imageKey(image), planned = imagePlan.get(key)
    requireFact(planned && !seenImages.has(key)
      && (planned.sourceLabel === undefined || planned.sourceLabel === image.sourceLabel), 'history_experiment_image_plan_binding_conflict')
    const artifact = artifacts.get(image.path)
    requireFact(artifact && artifact.sha256 === image.sha256, 'history_experiment_image_artifact_conflict')
    seenImages.add(key)
    images.set(image.path, { sampleId: image.sampleId, split: image.split, epoch: image.epoch,
      optimizerStep: image.optimizerStep, optimizerSteps: image.optimizerStep, sourceLabel: image.sourceLabel, purpose: image.purpose })
  }
  requireFact(failedClosed || seenImages.size === imagePlan.size, 'history_experiment_image_plan_binding_conflict')
  return { images, coverage: {
    complete: !failedClosed && missingObservations.length === 0 && seenImages.size === imagePlan.size,
    observations: { expectedCount: expected, verifiedCount: observations.length, complete: missingObservations.length === 0, missing: missingObservations },
    images: { expectedCount: imagePlan.size, verifiedCount: seenImages.size, complete: seenImages.size === imagePlan.size,
      missing: [...imagePlan].filter(([key]) => !seenImages.has(key)).map(([, item]) => item) },
  } }
}
export async function adaptLegacyTrainingDetail({ runId, terminal, record, base, capsuleBinding, taskTerminalBinding, readJson, readEvidenceJson, readLargeResultProjection, makeArtifact, checkpointMetadata, requireFact }) {
  if (terminal.schemaVersion === 'ai-painter-training-system-interruption-terminal-v1')
    return adaptSystemInterruption({ runId, terminal, record, base, readJson, readEvidenceJson, makeArtifact, requireFact })
  const dryProtocol = DRY_LIFECYCLE.exec(terminal.schemaVersion)
  if (dryProtocol) return adaptDryLifecycle({ family: dryProtocol[1], runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact })
  if (terminal.schemaVersion === 'stage4-full-backbone-spatial-affine-controlled-smoke-terminal-v1') return adaptSpatialAffineSmoke({ runId, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact })
  if (MVP_STAGE0_LIFECYCLE_SCHEMAS.has(terminal.schemaVersion)) return adaptMvpStage0Lifecycle({ runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact })
  const managed = await adaptManagedTrainingDetail({ runId, terminal, record, base, capsuleBinding, taskTerminalBinding,
    readJson, readEvidenceJson, makeArtifact, checkpointMetadata, requireFact })
  if (managed) return managed
  const finish = (reasonCode = null) => ({ ...base, dataStatus: reasonCode ? 'partial' : 'connected', reasonCode, schemaVersion: 'ai_console_training_run_detail_v1', record })
  const missing = (...fields) => { base.unavailableFields = [...new Set([...base.unavailableFields, ...fields])] }
  let layout = PACKAGE_KINDS[terminal.schemaVersion]
  if (terminal.schemaVersion === undefined && terminal.experimentKind === 'five_rgb_heads_adaptation_frozen_ae_and_velocity_path') layout = ['head_experiment_0', 'ai-painter-rgb-head-adaptation-package-v1', 'rgb_head_adaptation']
  if (!layout) {
    missing('samples', 'metrics', 'checkpoints')
    record.detailCoverage = { adapter: null, supported: false, reason: 'terminal_schema_not_adapted', terminalAndEventsAvailable: true }
    return finish('history_terminal_schema_unsupported')
  }
  record.detailCoverage = { adapter: layout[2], supported: true, imageToMetricAssociation: 'only_explicit_bindings', terminalAndEventsAvailable: true }
  if (!capsuleBinding) { missing('samples', 'metrics', 'checkpoints'); return finish('history_own_run_capsule_missing') }
  const capsule = await readJson(capsuleBinding)
  requireFact(capsule.schemaVersion === 'ai-painter-local-task-capsule-v1' && capsule.integrity?.status === 'verified' && Array.isArray(capsule.evidence) && capsule.evidence.length <= 128, 'history_capsule_schema_conflict')
  requireFact(capsule.taskId === capsuleBinding.taskId, 'history_capsule_task_conflict')
  // The capsule is attached to a verified snapshot whose own Run matches; never
  // use the capsule of a later task merely carrying this historical terminal.
  record.artifacts.push(makeArtifact('task_capsule', capsuleBinding))
  const packages = capsule.evidence.filter(item => item.kind === layout[0])
  requireFact(packages.length === 1 && packages[0].sha256Verified === true, 'history_package_binding_conflict')
  const packageBinding = packages[0]
  const request = await readJson(packageBinding)
  requireFact((request.experimentIdentity ?? request.identity ?? request.runId) === runId, 'history_package_run_conflict')
  record.artifacts.push(makeArtifact('request', packageBinding))
  if (!layout[1] && !LEARNING_PACKAGES.has(request.schemaVersion)) {
    missing('samples', 'metrics', 'checkpoints')
    record.detailCoverage = { ...record.detailCoverage, supported: false, reason: 'package_schema_not_adapted' }
    return finish('history_package_schema_unsupported')
  }
  requireFact(layout[1] ? request.schemaVersion === layout[1] : LEARNING_PACKAGES.has(request.schemaVersion), 'history_package_schema_conflict')
  let result = terminal
  if (layout[2] === 'learning_capacity') {
    if (!terminal.result) { missing('metrics', 'checkpoints'); return finish('history_result_binding_missing') }
    const resultArtifact = makeArtifact('result', terminal.result)
    record.artifacts.push(resultArtifact)
    try { result = await readJson(terminal.result) }
    catch (error) {
      if (error.status !== 413) throw error
      resultArtifact.previewStatus = 'blocked_byte_limit'
      resultArtifact.previewByteLimit = 8388608
      resultArtifact.url = null
      const supported = request.schemaVersion === 'ai-painter-learning-capacity-experiment-package-v1'
        && request.evidenceContractVersion === 1 && typeof request.experimentType === 'string'
      if (!supported || !readLargeResultProjection) {
        missing('samples', 'metrics', 'checkpoints')
        record.detailCoverage.resultByteLimit = 8388608
        return finish('history_detail_evidence_exceeds_limit')
      }
      try {
        const projected = await readLargeResultProjection(terminal.result, request)
        result = projected.value
        resultArtifact.previewStatus = 'bounded_projection_only_raw_source_over_limit'
        record.detailCoverage.largeResultProjection = { ...projected.coverage,
          sourcePath: terminal.result.path, sourceSha256: terminal.result.sha256,
          sourceByteLength: projected.sourceByteLength, projectedByteLength: projected.byteLength,
          projectionSha256: projected.projectionSha256 }
      } catch (projectionError) {
        if (projectionError.status !== 413) throw projectionError
        missing('samples', 'metrics', 'checkpoints')
        record.detailCoverage.resultByteLimit = 8388608
        record.detailCoverage.largeResultProjection = { status: 'over_limit', reasonCode: projectionError.message }
        return finish('history_detail_evidence_exceeds_limit')
      }
    }
    requireFact((result.runId ?? result.experimentIdentity) === runId, 'history_result_run_conflict')
    requireFact(result.schemaVersion === undefined || result.schemaVersion === 'ai-painter-learning-capacity-experiment-result-v1', 'history_legacy_result_schema_conflict')
  }
  const canonicalEnvelope = request.schemaVersion === 'ai-painter-learning-capacity-experiment-package-v1'
    && (request.evidenceContractVersion !== undefined || result.evidenceContractVersion !== undefined
      || request.experimentType === 'all_train_exposure_only' || result.experimentType === 'all_train_exposure_only')
  if (canonicalEnvelope && (request.evidenceContractVersion !== 1 || result.evidenceContractVersion !== 1)) {
    missing('samples', 'metrics', 'checkpoints', 'imageArtifacts')
    record.detailCoverage = { ...record.detailCoverage, supported: false, reason: 'evidence_contract_version_not_adapted' }
    return finish('history_evidence_contract_version_unsupported')
  }
  const failedBeforeArtifacts = result.status === 'experiment_failed_closed' && result.executionState === 'failed_closed' && result.artifacts === undefined
  const canonicalFailedClosed = canonicalEnvelope && result.status === 'experiment_failed_closed' && result.executionState === 'failed_closed'
  requireFact(Array.isArray(request.selectedRows) && request.selectedRows.length <= 128 && ((Array.isArray(result.artifacts) && result.artifacts.length <= 1024) || failedBeforeArtifacts), 'history_legacy_shape_conflict')
  let envelopeImages = null
  let envelopeObservations = result.trainOnlyObservations
  if (canonicalEnvelope) {
    requireFact(result.schemaVersion === 'ai-painter-learning-capacity-experiment-result-v1', 'history_experiment_result_schema_conflict')
    requireFact(typeof request.experimentType === 'string' && request.experimentType.trim().length > 0
      && result.experimentType === request.experimentType,
      'history_experiment_type_conflict')
    requireFact(![result.stage4QualificationGranted, result.checkpointPromotable, result.runtimeFrameAllowed,
      result.validationContentRead, result.challengeContentRead, result.regressionContentRead].includes(true),
    'history_experiment_boundary_conflict')
    if (result.optimizerSteps != null) requireFact(typeof result.optimizerSteps === 'object'
      && !Array.isArray(result.optimizerSteps)
      && Number.isSafeInteger(result.optimizerSteps.generator) && result.optimizerSteps.generator >= 0
      && Number.isSafeInteger(result.optimizerSteps.discriminator) && result.optimizerSteps.discriminator >= 0,
    'history_experiment_optimizer_steps_conflict')
    // Validate the canonical package first; missing flat data is not a licence
    // to accept arbitrary child JSON. Flat, even empty, is never mixed with chunks.
    let adapted = experimentEnvelopeV1(request, result, requireFact, canonicalFailedClosed)
    if (canonicalFailedClosed && !Object.hasOwn(result, 'trainOnlyObservations')) {
      const fragments = await failedObservationFragments(request, result, readJson, readEvidenceJson, requireFact)
      envelopeObservations = fragments.rows
      adapted = experimentEnvelopeV1(request, { ...result, trainOnlyObservations: envelopeObservations }, requireFact, true)
      record.detailCoverage.observationFragments = fragments.report
      if (fragments.report.gaps.length) missing('observationFragments.coverage')
    }
    envelopeImages = adapted.images
    record.detailCoverage = { ...record.detailCoverage, evidenceContractVersion: 1, observationIdentity: 'immutable_package_plan_and_selected_rows',
      ...adapted.coverage, ...(canonicalFailedClosed ? { resultStatus: result.status, executionState: result.executionState } : {}) }
    if (!adapted.coverage.observations.complete) missing('trainOnlyObservations.complete')
    if (!adapted.coverage.images.complete) missing('imageArtifacts.complete')
  }
  const v21TrainOnly = request.schemaVersion === 'ai-painter-v21-train-only-capacity-package-v1'
  const v21Images = new Map()
  if (v21TrainOnly && !failedBeforeArtifacts) {
    requireFact(result.status === 'experiment_executed_not_visual_qualified'
      && result.stage4QualificationGranted === false && result.checkpointPromotable === false
      && result.validationContentRead === false && result.challengeContentRead === false && result.regressionContentRead === false,
    'history_v21_experiment_boundary_conflict')
    requireFact(Array.isArray(result.trainOnlyObservations)
      && result.trainOnlyObservations.length === 4
      && result.trainOnlyObservations.every((observation, index) => observation.optimizerStep === [0, 128, 256, 512][index]
        && Array.isArray(observation.trainOnly) && observation.trainOnly.length === 2), 'history_v21_observation_shape_conflict')
    const selected = new Set(request.selectedRows.map(row => row.sampleId))
    const imageBinding = (binding, sampleId, step, sourceLabel) => {
      requireFact(binding?.path && binding?.sha256 && !v21Images.has(binding.path), 'history_v21_image_binding_conflict')
      requireFact(result.artifacts.some(artifact => artifact.path === binding.path && artifact.sha256 === binding.sha256), 'history_v21_image_artifact_missing')
      v21Images.set(binding.path, { binding, sampleId, split: 'train', optimizerSteps: step, sourceLabel })
    }
    for (const observation of result.trainOnlyObservations) {
      const seen = new Set()
      for (const row of observation.trainOnly) {
        requireFact(row.split === 'train' && selected.has(row.sampleId) && !seen.has(row.sampleId), 'history_v21_observation_sample_conflict')
        seen.add(row.sampleId)
        if (row.predictionPng) imageBinding(row.predictionPng, row.sampleId, observation.optimizerStep, `train-only 第${observation.optimizerStep}步预测`)
        if (row.targetStep0FinalContactSheetPng) imageBinding(row.targetStep0FinalContactSheetPng, row.sampleId, observation.optimizerStep, 'train原图／第0步／第512步对照')
      }
    }
  }
  record.resolution = request.resolution ?? request.training?.resolution ?? null
  record.optimizerSteps = v21TrainOnly || canonicalEnvelope ? result.optimizerSteps?.generator ?? null : result.optimizerSteps ?? terminal.optimizerSteps ?? null
  record.qualification = result.qualification ?? record.qualification
  if (v21TrainOnly) record.qualification = { scope: 'train_only_learning_capacity_no_generalization_claim', formalStageQualified: false, checkpointPromotable: false, runtimeFrameAllowed: false }
  if (canonicalEnvelope) record.qualification = { scope: 'train_only_learning_capacity_no_formal_qualification', formalStageQualified: false,
    checkpointPromotable: false, runtimeFrameAllowed: false, optimizerSteps: result.optimizerSteps ?? null }
  record.runKind = layout[2]
  if (record.resolution !== null) base.unavailableFields = base.unavailableFields.filter(field => field !== 'resolution')
  if (record.optimizerSteps === null) missing('optimizerSteps')
  for (const sample of request.selectedRows) {
    requireFact(typeof sample.sampleId === 'string' && typeof sample.split === 'string', 'history_sample_identity_invalid')
    const original = sample.image ? makeArtifact('original', sample.image, { sampleId: sample.sampleId, split: sample.split }) : null
    const condition = sample.conditionPack ? makeArtifact('condition', sample.conditionPack, { sampleId: sample.sampleId, split: sample.split }) : null
    if (original) record.artifacts.push(original); else missing(`samples.${sample.sampleId}.original`)
    if (condition) record.artifacts.push(condition)
    record.samples.push({ sampleId: sample.sampleId, split: sample.split, original, condition })
  }
  const samples = new Map(record.samples.map(sample => [sample.sampleId, sample]))
  const armCheckpoints = new Map()
  requireFact(result.arms === undefined || (Array.isArray(result.arms) && result.arms.length <= 32), 'history_record_limit', 413)
  for (const arm of result.arms ?? []) if (arm.checkpoint) armCheckpoints.set(arm.checkpoint.path, arm)
  for (const binding of result.artifacts ?? []) {
    requireFact(typeof binding.path === 'string', 'history_artifact_binding_invalid')
    const extension = binding.path.split('.').pop().toLowerCase()
    if (['png', 'jpg', 'jpeg'].includes(extension)) {
      if (envelopeImages) {
        const association = envelopeImages.get(binding.path)
        if (!association && canonicalFailedClosed) {
          record.artifacts.push(makeArtifact('image', binding, { associationStatus: 'not_recorded_failed_closed' }))
          missing('output.sample_arm_seed_association')
        } else {
          requireFact(association, 'history_experiment_image_association_conflict')
          record.artifacts.push(makeArtifact('output', binding, association))
        }
      } else if (v21TrainOnly) {
        const association = v21Images.get(binding.path)
        requireFact(association?.binding.sha256 === binding.sha256, 'history_v21_image_association_conflict')
        record.artifacts.push(makeArtifact('output', binding, association))
      } else {
        record.artifacts.push(makeArtifact('image', binding, { associationStatus: 'purpose_sample_arm_seed_not_explicitly_bound' }))
        missing('output.sample_arm_seed_association')
      }
    } else if (['pt', 'pth'].includes(extension)) {
      const arm = armCheckpoints.get(binding.path)
      if (arm) requireFact(arm.checkpoint.sha256 === binding.sha256, 'history_checkpoint_binding_conflict')
      const cp = await checkpointMetadata(makeArtifact('checkpoint', binding, { arm: arm?.arm ?? null, optimizerSteps: arm?.optimizerSteps ?? null }))
      record.artifacts.push(cp); record.checkpoints.push(cp)
    } else if (extension === 'json') record.artifacts.push(makeArtifact('evidence', binding))
    else missing(`artifact.unsupported_type:${binding.path}`)
  }
  // Canonical observations are the sole metric plane. The producer's legacy
  // aliases remain in the immutable result, never merged or count-deduplicated.
  if (!canonicalEnvelope) {
    const rows = result.rows ?? result.fullGeneratedRows ?? []
    requireFact(Array.isArray(rows) && rows.length <= 1024, 'history_metrics_limit')
    for (const row of rows) {
      requireFact(samples.has(row.sampleId) && samples.get(row.sampleId).split === row.split, 'history_sample_binding_conflict')
      record.metrics.push({ sampleId: row.sampleId, split: row.split, arm: row.arm ?? null, seed: row.seed ?? null, measurements: row.measurements ?? row, baseline: row.baseline ?? null })
    }
  }
  if (v21TrainOnly && !failedBeforeArtifacts) for (const observation of result.trainOnlyObservations) {
    for (const row of observation.trainOnly) record.metrics.push({ sampleId: row.sampleId, split: 'train', optimizerStep: observation.optimizerStep, measurements: row })
  }
  if (envelopeImages) for (const row of envelopeObservations ?? []) record.metrics.push({
    sampleId: row.sampleId, split: row.split, epoch: row.epoch, optimizerStep: row.optimizerStep, measurements: row.measurements,
    ...(row.sourcePath ? { sourcePath: row.sourcePath, sourceSha256: row.sourceSha256 } : {}),
  })
  if (!canonicalEnvelope) for (const field of ['epochMetrics', 'trainOnlyBaselineMetrics', 'trainOnlyFinalMetrics', 'fixedTrainOnlyObservations', 'observations', 'perStepReconstructionLoss', 'perStepHeadDependentObjective']) {
    if (result[field] !== undefined) record.metrics.push({ sourceField: field, measurements: result[field] })
  }
  if (!record.metrics.length) missing('metrics')
  if (!record.checkpoints.length) missing('checkpoints')
  // The old result lists files without a sample/arm/seed map. The files remain
  // visible and verifiable, but must never be paired by filename conventions.
  return finish(failedBeforeArtifacts ? 'history_failed_before_artifact_registration' : canonicalFailedClosed ? 'history_experiment_failed_closed_partial'
    : base.unavailableFields.includes('output.sample_arm_seed_association') ? 'history_output_association_not_recorded' : null)
}

// Stable managed protocol, not a Run/model-version switch. Only authenticated
// parent bindings are followed; no deterministic filename is a discovery path.
async function adaptSystemInterruption({ runId, terminal, record, base, readJson, readEvidenceJson, makeArtifact, requireFact }) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  // These v1 snapshots contain only scalar fields, including a null Checkpoint.
  // Compare every field without depending on JSON property order or adding I/O.
  const sameSnapshot = (left, right) => object(left) && object(right)
    && Object.keys(left).length === Object.keys(right).length
    && Object.keys(left).every(key => Object.hasOwn(right, key) && left[key] === right[key])
  const count = value => Number.isSafeInteger(value) && value >= 0
  const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
  const identity = value => requireFact(object(value) && value.runId === runId
    && value.packageId === terminal.packageId && value.capabilityVersion === terminal.capabilityVersion,
  'history_interruption_identity_conflict')
  requireFact(terminal.runId === runId && typeof terminal.packageId === 'string' && terminal.packageId.length > 0
    && typeof terminal.capabilityVersion === 'string' && terminal.capabilityVersion.length > 0,
  'history_interruption_identity_conflict')
  const flags = ['historicalCleanupCertified', 'oldExecutionMayReplay', 'trainingQualificationGranted']
  requireFact(terminal.executionState === 'failed_closed' && terminal.status === 'training_system_interrupted'
    && terminal.selectedCheckpoint === null && flags.every(key => terminal[key] === false)
    && sha(terminal.profileSha256), 'history_interruption_terminal_conflict')
  const progress = terminal.lastDurableProgress
  identity(progress)
  requireFact(progress.schemaVersion === 'ai-painter-current-training-progress-v1'
    && progress.executionState === 'executing' && progress.selectedCheckpoint === null
    && ['completedEpochs', 'actualEpoch', 'optimizerStepsGenerator', 'optimizerStepsDiscriminator'].every(key => count(progress[key]))
    && progress.completedEpochs <= progress.actualEpoch
    && typeof progress.updatedAtUtc === 'string' && progress.updatedAtUtc.endsWith('Z')
    && Number.isFinite(Date.parse(progress.updatedAtUtc)) && Number.isFinite(Date.parse(terminal.recordedAtUtc))
    && Date.parse(progress.updatedAtUtc) <= Date.parse(terminal.recordedAtUtc), 'history_interruption_progress_conflict')
  const availability = { lastDurableProgress: 'available', metrics: 'available', samples: 'not_recorded', checkpoints: 'not_recorded', logs: 'not_recorded' }
  const gaps = new Set(['samples', 'checkpoints', 'logs'])
  const limits = { jsonReads: 5, jsonBytes: 2 * 1024 * 1024 }
  let reads = 0
  const append = (bound, evidenceKind) => {
    const item = makeArtifact('evidence', bound, { evidenceKind })
    if (!record.artifacts.some(prior => prior.artifactId === item.artifactId)) record.artifacts.push(item)
    return item
  }
  const read = async (bound, field) => {
    requireFact(++reads <= limits.jsonReads, 'history_interruption_read_limit', 413)
    append(bound, field)
    try {
      const value = readEvidenceJson ? (await readEvidenceJson(bound, limits.jsonBytes)).value : await readJson(bound)
      requireFact(object(value), 'history_interruption_document_invalid')
      availability[field] = 'available'; return value
    } catch (error) {
      // Missing one parent preserves independently verified terminal progress.
      // Identity, SHA and path conflicts must still fail the whole request.
      if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code) && error.status !== 413) throw error
      gaps.add(field)
      availability[field] = error.status === 413 ? 'over_limit' : error.code === 'ENOENT' ? 'missing' : 'unreadable'
      return null
    }
  }
  record.runKind = 'bounded_managed_training'
  record.trainingStatus = terminal.status; record.trainingExecutionState = terminal.executionState
  record.completedEpochs = progress.completedEpochs
  record.optimizerSteps = { generator: progress.optimizerStepsGenerator, discriminator: progress.optimizerStepsDiscriminator }
  record.discriminatorOptimizerSteps = progress.optimizerStepsDiscriminator
  record.failureSummary = { type: 'training_system_interrupted' }
  record.qualification = { ...record.qualification, formalQualificationAllowed: false,
    worldEntryAllowed: false, checkpointSelected: false, checkpointPromotionEligible: false }
  record.metrics.push({ source: 'last_durable_progress', epoch: progress.actualEpoch,
    optimizerStep: progress.optimizerStepsGenerator, measurements: {
      completedEpochs: progress.completedEpochs, optimizerStepsGenerator: progress.optimizerStepsGenerator,
      optimizerStepsDiscriminator: progress.optimizerStepsDiscriminator, executionState: progress.executionState,
      updatedAtUtc: progress.updatedAtUtc }, sourcePath: record.terminalBinding.path, sourceSha256: record.terminalBinding.sha256 })
  base.unavailableFields = base.unavailableFields.filter(field => !['metrics', 'optimizerSteps', 'completedEpochs'].includes(field))
  const finish = () => {
    for (const field of gaps) availability[field] ??= 'not_recorded'
    base.unavailableFields = [...new Set([...base.unavailableFields, ...gaps])]
    record.detailCoverage = { adapter: 'training_system_interruption_v1', supported: true,
      sourcePolicy: 'verified_registry_events_and_explicit_sha256_parents_only', availability, limits,
      jsonReads: reads, complete: false, terminalAndEventsAvailable: true,
      resourceAndStepLogs: 'not_recorded_unless_bound', checkpointBytesRead: false }
    return { ...base, schemaVersion: 'ai_console_training_run_detail_v1', record,
      dataStatus: 'partial', reasonCode: 'history_system_interruption_detail_partial' }
  }
  const original = terminal.originalRegistry
  requireFact(object(original) && original.path === '.runtime/ai-painter/current-execution-registry/current.json'
    && count(original.revision) && original.revision > 0 && sha(original.sha256), 'history_interruption_registry_conflict')
  const report = await read(terminal.recoveryReport, 'systemInterruptionReport')
  if (report) {
    identity(report)
    requireFact(report.schemaVersion === 'ai-painter-training-system-interruption-report-v1'
      && report.profileSha256 === terminal.profileSha256 && sameSnapshot(report.originalRegistry, original)
      && sameSnapshot(report.lastDurableProgress, progress) && flags.every(key => report[key] === false)
      && report.modelRootCauseEstablished === false, 'history_interruption_report_conflict')
  }
  // current.json has advanced. Only the already-verified event for the exact
  // original revision/SHA can locate its immutable transaction snapshot.
  const events = (record.events ?? []).filter(event => event.registryRevision === original.revision)
  if (!events.length) {
    gaps.add('originalRegistrySnapshot'); availability.originalRegistrySnapshot = 'missing'
    gaps.add('trainingPlan'); return finish()
  }
  requireFact(events.length === 1 && events[0].runId === runId && events[0].currentSha256 === original.sha256,
    'history_interruption_registry_conflict')
  const event = events[0], snapshotPath = `.runtime/ai-painter/current-execution-registry/transactions/${event.transactionId}/current.staged.json`
  requireFact(event.evidenceReferences?.includes(snapshotPath), 'history_interruption_registry_conflict')
  const snapshot = await read({ path: snapshotPath, sha256: original.sha256 }, 'originalRegistrySnapshot')
  if (!snapshot) { gaps.add('trainingPlan'); return finish() }
  identity(snapshot)
  requireFact(snapshot.schemaVersion === 'ai-painter-current-execution-registry-v1'
    && snapshot.writerIdentity === 'local_ai_capability_lifecycle_orchestrator'
    && snapshot.registryRevision === original.revision && snapshot.eventSequence === event.eventSequence
    && snapshot.transactionId === event.transactionId && snapshot.taskId === event.taskId, 'history_interruption_registry_conflict')
  const capsule = await read(snapshot.taskCapsule, 'originalTaskCapsule')
  if (!capsule) { gaps.add('trainingPlan'); return finish() }
  requireFact(capsule.schemaVersion === 'ai-painter-local-task-capsule-v1' && capsule.taskId === snapshot.taskId
    && capsule.integrity?.status === 'verified' && Array.isArray(capsule.evidence) && capsule.evidence.length <= 128,
  'history_interruption_capsule_conflict')
  const packages = capsule.evidence.filter(binding => binding.kind === 'execution_package')
  requireFact(packages.length === 1 && packages[0].sha256Verified === true, 'history_interruption_package_conflict')
  const pkg = await read(packages[0], 'autonomousExecutionPackage')
  if (!pkg) { gaps.add('trainingPlan'); return finish() }
  requireFact(pkg.schemaVersion === 'ai-painter-autonomous-closed-loop-package-v1'
    && pkg.packageIdentity === terminal.packageId && pkg.capabilityVersion === terminal.capabilityVersion
    && typeof pkg.outputRoot === 'string' && pkg.outputRoot.startsWith('.runtime/ai-painter/')
    && !pkg.outputRoot.includes('\\') && pkg.outputRoot.split('/').every(part => part && part !== '.' && part !== '..')
    && Array.isArray(pkg.inputEvidence) && pkg.inputEvidence.length <= 128, 'history_interruption_package_conflict')
  const plans = pkg.inputEvidence.filter(binding => binding.path === `${pkg.outputRoot}/quality-plan.json`)
  requireFact(plans.length === 1, 'history_interruption_plan_conflict')
  const plan = await read(plans[0], 'trainingPlan')
  if (!plan) return finish()
  identity(plan)
  const protocol = MANAGED_DETAIL_PROTOCOLS.find(candidate => candidate.plans.get('quality-plan.json') === plan.schema)
  requireFact(protocol?.configuration && plan.executionMode === protocol.mode
    && plan.configuration?.schema === protocol.configuration && plan.outputRoot === pkg.outputRoot
    && plan.configuration.capabilityVersion === terminal.capabilityVersion, 'history_interruption_plan_conflict')
  const ceiling = plan.configuration.executionCeiling, resolution = plan.configuration.scope?.resolution
  requireFact(object(ceiling) && ['epochs', 'generatorOptimizerSteps', 'discriminatorOptimizerSteps']
    .every(key => count(ceiling[key]) && ceiling[key] > 0)
    && Array.isArray(resolution) && resolution.length === 2 && resolution.every(value => count(value) && value > 0),
  'history_interruption_plan_conflict')
  requireFact(progress.actualEpoch <= ceiling.epochs && progress.optimizerStepsGenerator <= ceiling.generatorOptimizerSteps
    && progress.optimizerStepsDiscriminator <= ceiling.discriminatorOptimizerSteps, 'history_interruption_plan_limit_conflict')
  record.resolution = { width: resolution[0], height: resolution[1] }
  record.trainingPlan = { epochs: ceiling.epochs, generatorOptimizerSteps: ceiling.generatorOptimizerSteps,
    discriminatorOptimizerSteps: ceiling.discriminatorOptimizerSteps, checkpointSelection: plan.configuration.checkpointSelection ?? null }
  record.targetEpochs = ceiling.epochs; record.targetOptimizerSteps = ceiling.generatorOptimizerSteps
  record.targetDiscriminatorOptimizerSteps = ceiling.discriminatorOptimizerSteps
  availability.resolution = 'available'
  base.unavailableFields = base.unavailableFields.filter(field => field !== 'resolution')
  return finish()
}

export async function adaptManagedTrainingDetail({ runId, terminal, record, base, capsuleBinding, taskTerminalBinding,
  readJson, readEvidenceJson, makeArtifact, checkpointMetadata, requireFact }) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  const count = v => Number.isSafeInteger(v) && v >= 0
  const text = v => typeof v === 'string' && v.length > 0 && v.length <= 192
  let protocol = MANAGED_DETAIL_PROTOCOLS.find(p => terminal.schema === p.worker
    || (terminal.schema ?? terminal.schemaVersion) === p.review) ?? MANAGED_DETAIL_PROTOCOLS[0]
  let schema = protocol.worker
  const isReviewWrapper = value => (value?.schema ?? value?.schemaVersion) === protocol.review
  const gaps = new Set(), availability = {}, seen = new Map()
  const limits = { jsonReads: 16, jsonBytes: 2 * 1024 * 1024, artifacts: 256, checkpoints: 32, metrics: 1024, images: 128 }
  let reads = 0, worker = terminal, workerBinding = record.terminalBinding, wrapper = null, boundAutonomous = null
  const gap = (field, state = 'not_recorded') => {
    gaps.add(field)
    if (state !== 'not_recorded' || !availability[field] || availability[field] === 'available') availability[field] = state
  }
  const binding = b => {
    requireFact(object(b) && typeof b.path === 'string' && /^[a-f0-9]{64}$/u.test(b.sha256)
      && !/^(?:[A-Za-z]:|\/)/u.test(b.path) && !b.path.includes('\\')
      && b.path.split('/').every(part => part && part !== '.' && part !== '..'), 'history_managed_binding_invalid')
  }
  const same = (a, b) => { binding(a); binding(b); requireFact(a.path === b.path && a.sha256 === b.sha256, 'history_managed_parent_conflict') }
  const read = async (bound, field) => {
    if (!bound) { gap(field); return null }
    binding(bound); requireFact(++reads <= limits.jsonReads, 'history_managed_read_limit', 413)
    try {
      const value = readEvidenceJson ? (await readEvidenceJson(bound, limits.jsonBytes)).value : await readJson(bound)
      requireFact(object(value), 'history_managed_document_invalid')
      availability[field] = 'available'; return value
    } catch (error) {
      if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code) && error.status !== 413) throw error
      gap(field, error.status === 413 ? 'over_limit' : error.code === 'ENOENT' ? 'missing' : 'unreadable'); return null
    }
  }
  // Unknown protocols still take the existing partial fallback. A wrapper can
  // select this adapter only when its explicit child really has the stable schema.
  if (worker.schema !== schema) {
    if (isReviewWrapper(worker)) { binding(worker.workerTerminal); binding(worker.executionPackage) }
    if (!object(worker.workerTerminal) || !object(worker.executionPackage)) return null
    wrapper = worker; workerBinding = worker.workerTerminal
    if (isReviewWrapper(wrapper)) {
      requireFact(wrapper.runId === runId && text(wrapper.packageId) && text(wrapper.capabilityVersion), 'history_managed_identity_conflict')
      boundAutonomous = await read(wrapper.executionPackage, 'autonomousExecutionPackage')
      if (!boundAutonomous) return null
      if (boundAutonomous.schemaVersion !== 'ai-painter-autonomous-closed-loop-package-v1') return null
      requireFact(boundAutonomous.packageIdentity === wrapper.packageId && boundAutonomous.capabilityVersion === wrapper.capabilityVersion,
        'history_managed_identity_conflict')
      binding({ path: boundAutonomous.outputRoot, sha256: wrapper.executionPackage.sha256 })
      requireFact(boundAutonomous.outputRoot.startsWith('.runtime/ai-painter/')
        && workerBinding.path.startsWith(`${boundAutonomous.outputRoot}/`)
        && record.terminalBinding.path.startsWith(`${boundAutonomous.outputRoot}/`), 'history_managed_output_root_conflict')
    }
    worker = await read(workerBinding, 'workerTerminal')
    if (!worker) return null
    if (!MANAGED_DETAIL_PROTOCOLS.some(p => (wrapper?.schema ?? wrapper?.schemaVersion) === p.review)) {
      protocol = MANAGED_DETAIL_PROTOCOLS.find(p => worker.schema === p.worker) ?? protocol
      schema = protocol.worker
    }
    if (isReviewWrapper(wrapper)) requireFact(worker.schema === schema, 'history_managed_worker_schema_conflict')
    if (worker.schema !== schema) return null
  }
  requireFact(worker.runId === runId && text(worker.packageId) && text(worker.capabilityVersion)
    && ['completed', 'failed_closed'].includes(worker.executionState), 'history_managed_identity_conflict')
  requireFact(worker.status === (worker.executionState === 'completed' ? 'training_completed_review_pending' : 'failed_closed'),
    'history_managed_terminal_state_conflict')
  const identity = value => requireFact(object(value) && value.runId === runId && value.packageId === worker.packageId
    && value.capabilityVersion === worker.capabilityVersion, 'history_managed_identity_conflict')
  const verifyReviewWrapper = value => {
    identity(value); same(value.executionPackage, worker.executionPackage); same(value.workerTerminal, workerBinding)
    requireFact(worker.executionState === 'completed'
      && ['completed', 'failed_closed'].includes(value.executionState)
      && ['dry_single_world_review_failed_closed', 'dry_single_world_numeric_passed_visual_approval_pending',
        'dry_review_failed_closed', 'bounded_comparison_completed_no_visual_release', 'review_execution_failed_closed'].includes(value.status),
    'history_managed_review_terminal_state_conflict')
    requireFact(value.executionState === (['dry_single_world_numeric_passed_visual_approval_pending',
      'bounded_comparison_completed_no_visual_release'].includes(value.status) ? 'completed' : 'failed_closed'),
    'history_managed_review_terminal_state_conflict')
  }
  if (wrapper) { identity(wrapper); same(wrapper.executionPackage, worker.executionPackage) }
  if (isReviewWrapper(wrapper)) verifyReviewWrapper(wrapper)
  const append = (role, bound, metadata = {}) => {
    binding(bound)
    const key = `${role}:${bound.path}`, prior = seen.get(key)
    if (prior) { requireFact(prior.sha256 === bound.sha256, 'history_artifact_binding_conflict'); return prior }
    requireFact(record.artifacts.length < limits.artifacts, 'history_record_limit', 413)
    const item = makeArtifact(role, bound, metadata); record.artifacts.push(item); seen.set(key, item); return item
  }
  for (const item of record.artifacts) seen.set(`${item.role}:${item.logicalPath}`, item)
  if (wrapper) append('evidence', workerBinding, { evidenceKind: 'workerTerminal' })
  record.runKind = 'bounded_managed_training'
  record.qualification = { ...record.qualification, formalQualificationAllowed: false, worldEntryAllowed: false,
    checkpointPromotionEligible: false, checkpointReloadVerified: worker.checkpointReloadVerified ?? null }
  const finish = () => {
    base.unavailableFields = [...new Set([...base.unavailableFields, ...gaps])]
    record.detailCoverage = { adapter: protocol.adapter, supported: true,
      sourcePolicy: 'verified_registry_explicit_sha256_parents_only', availability, limits, jsonReads: reads,
      complete: gaps.size === 0, imageAssociation: protocol.configuration
        ? 'explicit_validation_images_no_filename_inference' : 'explicit_subject_only_no_filename_inference',
      resourceAndStepLogs: 'not_recorded_unless_bound', checkpointBytesRead: false }
    return { ...base, schemaVersion: 'ai_console_training_run_detail_v1', record,
      dataStatus: gaps.size ? 'partial' : 'connected', reasonCode: gaps.size ? 'history_managed_detail_partial' : null }
  }
  const removeUnavailable = (...fields) => { base.unavailableFields = base.unavailableFields.filter(f => !fields.includes(f)) }
  const g = worker.optimizerStepsGenerator ?? worker.optimizerSteps?.generator ?? null
  const d = worker.optimizerStepsDiscriminator ?? worker.optimizerSteps?.discriminator ?? null
  requireFact(worker.optimizerSteps == null || object(worker.optimizerSteps)
    && Object.keys(worker.optimizerSteps).every(k => ['generator', 'discriminator'].includes(k)), 'history_managed_count_invalid')
  for (const [name, value] of [['generator', g], ['discriminator', d]]) {
    requireFact(value === null || count(value), 'history_managed_count_invalid')
    if (worker.optimizerSteps?.[name] !== undefined) requireFact(worker.optimizerSteps[name] === value, 'history_managed_count_conflict')
  }
  requireFact(worker.completedEpochs == null || count(worker.completedEpochs), 'history_managed_count_invalid')
  record.optimizerSteps = { generator: g, discriminator: d }; record.discriminatorOptimizerSteps = d
  record.completedEpochs = worker.completedEpochs ?? null
  record.trainingStatus = worker.status
  record.trainingExecutionState = worker.executionState
  record.failureSummary = worker.error ?? worker.originalError ?? null
  if (g === null || d === null) gap('optimizerSteps')
  if (record.completedEpochs === null) gap('completedEpochs')
  gap('logs') // An immutable summary is not per-step resource/log history.
  const autonomous = boundAutonomous ?? await read(worker.executionPackage, 'autonomousExecutionPackage')
  if (!autonomous) { gap('trainingPlan'); gap('checkpoints'); gap('samples'); return finish() }
  if (autonomous.schemaVersion !== 'ai-painter-autonomous-closed-loop-package-v1') {
    gap('autonomousExecutionPackage', 'unsupported_schema'); return finish()
  }
  requireFact(autonomous.packageIdentity === worker.packageId && autonomous.capabilityVersion === worker.capabilityVersion,
    'history_managed_identity_conflict')
  const outputRoot = autonomous.outputRoot
  binding({ path: outputRoot, sha256: worker.executionPackage.sha256 })
  requireFact(outputRoot.startsWith('.runtime/ai-painter/') && Array.isArray(autonomous.inputEvidence)
    && autonomous.inputEvidence.length <= 128, 'history_managed_package_conflict')
  const own = bound => { binding(bound); requireFact(bound.path.startsWith(`${outputRoot}/`), 'history_managed_output_root_conflict') }
  own(workerBinding)
  if (wrapper) own(record.terminalBinding)
  append('evidence', worker.executionPackage, { evidenceKind: 'autonomousExecutionPackage' })
  // Select only this registered protocol's signed plan binding, never a Run name.
  const plans = autonomous.inputEvidence.filter(b => [...protocol.plans.keys()]
    .some(name => b?.path === `${outputRoot}/${name}`))
  requireFact(plans.length <= 1, 'history_managed_plan_conflict')
  const plan = await read(plans[0], 'managedPlan')
  if (!plan) { gap('trainingPlan'); gap('checkpoints'); gap('samples'); return finish() }
  const expectedPlanSchema = protocol.plans.get(plans[0].path.slice(outputRoot.length + 1))
  if (plan.schema !== expectedPlanSchema) {
    gap('managedPlan', 'unsupported_schema'); return finish()
  }
  identity(plan); requireFact(plan.outputRoot === outputRoot && object(plan.configuration), 'history_managed_plan_conflict')
  if (protocol.configuration) requireFact(plan.configuration.schema === protocol.configuration
    && plan.executionMode === protocol.mode, 'history_managed_plan_conflict')
  const config = plan.configuration, ceiling = config.executionCeiling, selection = config.checkpointSelection
  requireFact(object(ceiling) && count(ceiling.epochs) && ceiling.epochs > 0
    && count(ceiling.generatorOptimizerSteps) && count(ceiling.discriminatorOptimizerSteps)
    && object(selection) && Array.isArray(selection.eligibleEpochs) && selection.eligibleEpochs.length <= limits.checkpoints
    && count(selection.validationRowsPerEligibleEpoch) && selection.validationRowsPerEligibleEpoch > 0
    && selection.validationRowsPerEligibleEpoch <= 128
    && selection.eligibleEpochs.every(e => count(e) && e > 0 && e <= ceiling.epochs)
    && new Set(selection.eligibleEpochs).size === selection.eligibleEpochs.length,
    'history_managed_plan_conflict')
  requireFact((g === null || g <= ceiling.generatorOptimizerSteps) && (d === null || d <= ceiling.discriminatorOptimizerSteps)
    && (record.completedEpochs === null || record.completedEpochs <= ceiling.epochs), 'history_managed_plan_limit_conflict')
  const resolution = config.scope?.resolution
  requireFact(Array.isArray(resolution) && resolution.length === 2 && resolution.every(n => count(n) && n > 0), 'history_managed_plan_conflict')
  record.resolution = { width: resolution[0], height: resolution[1] }
  record.trainingPlan = { epochs: ceiling.epochs, generatorOptimizerSteps: ceiling.generatorOptimizerSteps,
    discriminatorOptimizerSteps: ceiling.discriminatorOptimizerSteps, checkpointSelection: selection }
  record.targetEpochs = ceiling.epochs; record.targetOptimizerSteps = ceiling.generatorOptimizerSteps
  record.targetDiscriminatorOptimizerSteps = ceiling.discriminatorOptimizerSteps
  removeUnavailable('resolution'); append('evidence', plans[0], { evidenceKind: 'managedPlan' })
  record.metrics.push({ source: 'managed_configuration', measurements: { executionCeiling: ceiling, checkpointSelection: selection,
    optimizer: config.optimizer ?? null, scope: config.scope, dataUse: config.dataUse ?? null, seed: config.seed ?? null },
    sourcePath: plans[0].path, sourceSha256: plans[0].sha256 })
  let capsule = null
  if (capsuleBinding) {
    capsule = await read(capsuleBinding, 'taskCapsule')
    if (capsule) requireFact(capsule.schemaVersion === 'ai-painter-local-task-capsule-v1'
      && capsule.integrity?.status === 'verified' && Array.isArray(capsule.evidence) && capsule.evidence.length <= 128,
      'history_managed_capsule_conflict')
  }
  const observations = (capsule?.evidence ?? []).filter(b => b?.path === `${outputRoot}/package.json`)
  requireFact(observations.length <= 1, 'history_managed_observation_conflict')
  const observation = await read(observations[0], 'observationPackage')
  if (observation) {
    identity(observation)
    requireFact(observation.schemaVersion === 'ai-painter-current-training-package-v1' && observation.outputRoot === outputRoot,
      'history_managed_observation_conflict')
    same(observation.autonomousExecutionPackage, worker.executionPackage)
    requireFact(JSON.stringify(observation.resolution) === JSON.stringify(resolution)
      && ['epochs', 'generatorOptimizerSteps', 'discriminatorOptimizerSteps'].every(k => observation.trainingPlan?.[k] === ceiling[k]
        && observation.resourceBudget?.[k] === ceiling[k]),
      'history_managed_observation_conflict')
    append('evidence', observations[0], { evidenceKind: 'observationPackage' })
  }
  const rows = worker.checkpoints
  if (rows === undefined) gap('checkpoints')
  else requireFact(Array.isArray(rows) && rows.length <= limits.checkpoints, 'history_managed_checkpoint_limit', 413)
  const epochs = new Set(), sampleIds = new Set()
  for (const cp of rows ?? []) {
    requireFact(object(cp) && selection.eligibleEpochs.includes(cp.epoch) && !epochs.has(cp.epoch)
      && (record.completedEpochs === null || cp.epoch <= record.completedEpochs)
      && object(cp.counts) && count(cp.counts.generator) && count(cp.counts.discriminator)
      && cp.counts.generator <= (g ?? ceiling.generatorOptimizerSteps) && cp.counts.discriminator <= (d ?? ceiling.discriminatorOptimizerSteps),
      'history_managed_checkpoint_conflict')
    epochs.add(cp.epoch); own(cp.checkpoint)
    const item = append('checkpoint', cp.checkpoint, { epoch: cp.epoch, optimizerSteps: cp.counts,
      selection: cp.selection ?? null, metadataOnly: true, promotable: false })
    try { Object.assign(item, await checkpointMetadata(item)); record.checkpoints.push(item) }
    catch (error) {
      if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error
      item.availability = error.code === 'ENOENT' ? 'missing' : 'unreadable'; gap('checkpoints', item.availability)
    }
    requireFact(Array.isArray(cp.validation) && cp.validation.length <= selection.validationRowsPerEligibleEpoch, 'history_managed_metric_limit', 413)
    const ids = new Set()
    for (const row of cp.validation) {
      requireFact(text(row?.sampleId) && row.split === 'validation' && row.epoch === cp.epoch && !ids.has(row.sampleId),
        'history_managed_metric_conflict')
      ids.add(row.sampleId); sampleIds.add(row.sampleId)
      requireFact(record.metrics.length < limits.metrics, 'history_managed_metric_limit', 413)
      record.metrics.push({ sampleId: row.sampleId, split: 'validation', epoch: cp.epoch, measurements: row,
        sourcePath: workerBinding.path, sourceSha256: workerBinding.sha256 })
    }
  }
  if (!record.checkpoints.length) gap('checkpoints')
  else { removeUnavailable('checkpoints'); if (!gaps.has('checkpoints')) availability.checkpoints = 'available' }
  if (!sampleIds.size) gap('validationMetrics')
  else removeUnavailable('metrics')
  const selected = worker.selectedCheckpointRecord
  if (selected) {
    const cp = (rows ?? []).find(row => row.epoch === selected.epoch)
    requireFact(cp, 'history_managed_checkpoint_conflict'); same(cp.checkpoint, selected.checkpoint)
    record.selectedEpoch = selected.epoch
    for (const item of record.checkpoints) item.selected = item.epoch === selected.epoch
  } else gap('selectedCheckpoint')
  // A finalization that lacks an audit/report binding is not permission to read
  // outputRoot/dry-review by convention. Preserve this upstream protocol gap.
  let taskTerminal = wrapper
  if (taskTerminalBinding && taskTerminalBinding.path !== record.terminalBinding?.path) {
    own(taskTerminalBinding); taskTerminal = await read(taskTerminalBinding, 'taskTerminal')
    if (taskTerminal) { requireFact(taskTerminal.runId === runId, 'history_managed_identity_conflict'); same(taskTerminal.executionPackage, worker.executionPackage) }
  }
  const preciseReview = isReviewWrapper(taskTerminal)
  if (preciseReview) {
    verifyReviewWrapper(taskTerminal)
    record.reviewExecutionState = taskTerminal.executionState
    record.reviewStatus = null
    append('evidence', taskTerminalBinding ?? record.terminalBinding, { evidenceKind: 'managedReviewTerminal' })
    if (taskTerminal.reviewFailure) {
      own(taskTerminal.reviewFailure)
      const failure = await read(taskTerminal.reviewFailure, 'reviewFailure')
      if (failure) {
        requireFact(taskTerminal.status === 'review_execution_failed_closed', 'history_managed_review_failure_conflict')
        // The original local executor terminal has a package identity but no
        // Run field. Its exact wrapper/worker linkage supplies that identity.
        const autonomousFailure = failure.schemaVersion === 'ai-painter-autonomous-closed-loop-terminal-v1'
        for (const key of ['runId', 'packageId', 'capabilityVersion']) if (failure[key] !== undefined)
          requireFact(failure[key] === worker[key], 'history_managed_identity_conflict')
        if (autonomousFailure) requireFact(failure.packageIdentity === worker.packageId && failure.status === 'failed_closed'
          && failure.latestEvidence?.phase === 'review', 'history_managed_review_failure_conflict')
        else {
          identity(failure); same(failure.executionPackage, worker.executionPackage); same(failure.workerTerminal, workerBinding)
          requireFact(failure.status === 'review_execution_failed_closed' && failure.executionState === 'failed_closed',
            'history_managed_review_failure_conflict')
        }
        const result = autonomousFailure ? failure.finalResult : failure
        requireFact(object(result) && (!autonomousFailure || result.status === 'failed')
          && ['program', 'infrastructure'].includes(result.failureKind)
          && typeof result.failureCode === 'string' && result.failureCode.length > 0
          && typeof (result.detail ?? result.error) === 'string' && (result.detail ?? result.error).length > 0,
        'history_managed_review_failure_conflict')
        if (autonomousFailure) requireFact(failure.failureCode === result.failureCode, 'history_managed_review_failure_conflict')
        record.reviewStatus = 'review_execution_failed_closed'
        record.failureSummary = { phase: 'review', status: record.reviewStatus, failureKind: result.failureKind,
          failureCode: result.failureCode, detail: result.detail ?? result.error,
          sourcePath: taskTerminal.reviewFailure.path, sourceSha256: taskTerminal.reviewFailure.sha256 }
        requireFact(record.metrics.length < limits.metrics, 'history_managed_metric_limit', 413)
        record.metrics.push({ source: 'managed_review_execution_failure', measurements: {
          phase: 'review', status: record.reviewStatus, failureKind: result.failureKind,
          failureCode: result.failureCode, detail: result.detail ?? result.error },
          sourcePath: taskTerminal.reviewFailure.path, sourceSha256: taskTerminal.reviewFailure.sha256 })
        append('evidence', taskTerminal.reviewFailure, { evidenceKind: 'reviewFailure' })
      }
    } else if (taskTerminal.status === 'review_execution_failed_closed') gap('reviewFailure')
    if (taskTerminal.reviewRecoveryPlan) {
      own(taskTerminal.reviewRecoveryPlan)
      // A bound plan is inspectable evidence, never an applied recovery or a
      // quality verdict. Do not interpret arbitrary plan fields as authority.
      append('evidence', taskTerminal.reviewRecoveryPlan, { evidenceKind: 'reviewRecoveryPlan' })
    }
  }
  const auditBinding = preciseReview ? taskTerminal.audit : taskTerminal?.audit ?? worker.audit
  if (auditBinding) own(auditBinding)
  const audit = await read(auditBinding, 'machineReview')
  if (audit) {
    requireFact(audit.runId === runId, 'history_managed_identity_conflict')
    for (const key of ['packageId', 'capabilityVersion']) if (audit[key] !== undefined)
      requireFact(audit[key] === worker[key], 'history_managed_identity_conflict')
    same(audit.executionPackage, worker.executionPackage)
    if (!['dry_single_world_review_failed_closed', 'dry_single_world_numeric_passed_visual_approval_pending'].includes(audit.status)) {
      gap('machineReview', 'unsupported_schema')
    } else {
      requireFact(selected, 'history_managed_review_conflict'); same(audit.selectedCheckpoint, selected.checkpoint)
      if (preciseReview && taskTerminal.status !== 'review_execution_failed_closed') {
        const mapped = audit.status === 'dry_single_world_review_failed_closed' ? 'dry_review_failed_closed' : 'bounded_comparison_completed_no_visual_release'
        requireFact(taskTerminal.status === audit.status || taskTerminal.status === mapped, 'history_managed_review_status_conflict')
        record.reviewStatus = audit.status
      }
      record.qualification.independentReviewStatus = audit.status
      record.independentReviewStatus = audit.status
      record.reviewStatusSource = auditBinding.path
      append('evidence', auditBinding, { evidenceKind: 'machineReview' })
      requireFact(record.metrics.length < limits.metrics, 'history_managed_metric_limit', 413)
      record.metrics.push({ source: 'managed_machine_review', measurements: { status: audit.status,
        detail: audit.detail ?? null, aesthetic: audit.aesthetic ?? null, alignment: audit.alignment ?? null,
        issueCodes: audit.issueCodes ?? [], validationImprovedWithoutMeanRgbRegression: audit.validationImprovedWithoutMeanRgbRegression ?? null },
        sourcePath: auditBinding.path, sourceSha256: auditBinding.sha256 })
    }
  }
  const reportBinding = preciseReview ? taskTerminal.reviewReport : taskTerminal?.reviewReport ?? worker.reviewReport ?? (availability.machineReview === 'available' ? audit?.input : null)
  if (reportBinding) own(reportBinding)
  if (reportBinding && audit?.input && availability.machineReview === 'available') same(reportBinding, audit.input)
  const report = await read(reportBinding, 'reviewReport')
  if (report) {
    if (report.schema !== protocol.report) gap('reviewReport', 'unsupported_schema')
    else {
      requireFact(report.capabilityVersion === worker.capabilityVersion, 'history_managed_identity_conflict')
      for (const key of ['runId', 'packageId']) if (report[key] !== undefined) requireFact(report[key] === worker[key], 'history_managed_identity_conflict')
      same(report.executionPackage, worker.executionPackage); same(report.workerTerminal, workerBinding)
      requireFact(selected, 'history_managed_review_conflict'); same(report.selectedCheckpoint, selected.checkpoint)
      const subject = report.subject
      requireFact(text(subject?.sampleId) && subject.split === 'validation' && subject.sampleId === config.scope.subjectSampleId
        && sampleIds.has(subject.sampleId), 'history_managed_review_conflict')
      own(report.candidateRgb); own(report.originalRgb)
      const metadata = { sampleId: subject.sampleId, split: 'validation', epoch: selected.epoch, formalQualification: false }
      const output = append('output', report.candidateRgb, metadata)
      const original = append('original', report.originalRgb, { ...metadata, sourceRole: 'saved_scaled_training_reference' })
      const reference = subject.referenceRgb ? append('original', subject.referenceRgb, { ...metadata, sourceRole: 'source_reference_rgb' }) : null
      const condition = subject.conditionPack ? append('condition', subject.conditionPack, metadata) : null
      record.samples.push({ sampleId: subject.sampleId, split: 'validation', original, sourceOriginal: reference, output, condition })
      removeUnavailable('samples')
      if (!reference) gap('samples.sourceOriginal')
      if (!condition) gap('samples.condition')
      requireFact(Array.isArray(report.artifacts) && report.artifacts.length <= limits.images, 'history_managed_image_limit', 413)
      for (const bound of report.artifacts) { own(bound); append('image', bound, { associationStatus: 'report_declared_image_no_sample_inferred' }) }
      if (protocol.configuration) {
        requireFact(Array.isArray(report.validationImages)
          && report.validationImages.length === selection.validationRowsPerEligibleEpoch,
        'history_quality_image_coverage_conflict')
        const selectedRows = (rows ?? []).find(row => row.epoch === selected.epoch)?.validation ?? []
        requireFact(selectedRows.length === report.validationImages.length, 'history_quality_image_coverage_conflict')
        const seenImages = new Set(), declaredArtifacts = new Map(report.artifacts.map(b => [b.path,b.sha256]))
        for (let index=0; index<report.validationImages.length; index++) {
          const image = report.validationImages[index], expected = selectedRows[index]
          requireFact(object(image) && image.sampleId === expected.sampleId && image.split === 'validation'
            && image.epoch === selected.epoch && image.optimizerStep === selected.counts.generator
            && image.purpose === 'prediction' && !seenImages.has(image.sampleId), 'history_quality_image_identity_conflict')
          seenImages.add(image.sampleId); own(image.binding)
          requireFact(declaredArtifacts.get(image.binding.path) === image.binding.sha256, 'history_quality_image_binding_conflict')
          if (image.checkpoint) same(image.checkpoint, selected.checkpoint)
          const metadata = {sampleId:image.sampleId,split:'validation',epoch:image.epoch,
            optimizerStep:image.optimizerStep,purpose:image.purpose,formalQualification:false}
          const output = append('output',image.binding,metadata)
          const existing = record.samples.find(sample => sample.sampleId === image.sampleId)
          if (existing) same({path:existing.output.logicalPath,sha256:existing.output.sha256},image.binding)
          else record.samples.push({sampleId:image.sampleId,split:'validation',output,
            original:null,sourceOriginal:null,condition:null})
        }
        availability.validationImages='available'
      }
      append('evidence', reportBinding, { evidenceKind: 'nativeReviewReport' })
    }
  }
  if (worker.executionState === 'failed_closed' && worker.captureStatus !== 'capture_not_triggered'
    && (worker.captureReceipt !== undefined || worker.captureStatus !== undefined)) {
    // Only this already-verified managed worker may introduce capture children.
    // The receipt is a binding, not a caller's certification of completeness.
    // Validate the pair before appending either item; failures keep all prior
    // legitimate artifacts. Tensor bytes are never opened or made downloadable.
    try {
      const captureSchema = 'ecology-regime-gradient-failure-capture-v1', receipt = worker.captureReceipt
      requireFact(worker.executionState === 'failed_closed' && object(receipt) && receipt.schema === captureSchema,
        'history_managed_capture_schema_unsupported')
      requireFact(worker.captureStatus === 'captured' && receipt.status === 'captured'
        && [worker.captureMissing, receipt.missing].every(value => Array.isArray(value) && value.length === 0),
      'history_managed_capture_incomplete')
      const children = receipt.artifacts
      requireFact(object(children) && ['manifest', 'primary', 'tensors'].every(key => object(children[key]))
        && Object.keys(children).every(key => ['manifest', 'primary', 'tensors'].includes(key)),
      'history_managed_capture_binding_missing')
      for (const [key, name] of [['manifest', 'manifest.json'], ['primary', 'primary.json'], ['tensors', 'tensors.pt']]) {
        const bound = children[key]
        own(bound)
        requireFact(bound.path === `${outputRoot}/gradient-failure/${name}`, 'history_managed_capture_path_conflict')
        requireFact(count(bound.bytes) && bound.bytes > 0, 'history_managed_capture_byte_conflict')
        if (key !== 'tensors') requireFact(bound.bytes <= limits.jsonBytes, 'history_byte_limit', 413)
      }
      const captureRead = async (bound, expectedBytes = null) => {
        binding(bound); requireFact(typeof readEvidenceJson === 'function', 'history_managed_capture_reader_unavailable')
        requireFact(++reads <= limits.jsonReads, 'history_managed_read_limit', 413)
        const read = await readEvidenceJson(bound, limits.jsonBytes)
        requireFact(object(read.value) && count(read.byteLength) && read.byteLength <= limits.jsonBytes,
          'history_managed_capture_schema_unsupported')
        requireFact(read.sha256 === bound.sha256 && (expectedBytes === null || read.byteLength === expectedBytes),
          'history_managed_capture_byte_conflict')
        return read.value
      }
      const manifest = await captureRead(children.manifest, children.manifest.bytes)
      requireFact(manifest.schema === captureSchema && manifest.status === 'captured'
        && Array.isArray(manifest.missing) && manifest.missing.length === 0, 'history_managed_capture_schema_unsupported')
      const primary = await captureRead(children.primary, children.primary.bytes)
      // primary.json has no separate Schema in capture-v1: its version and
      // identity come from this exact manifest/receipt, not a filename match.
      requireFact(Object.keys(primary).every(key => ['context', 'primaryError', 'timing'].includes(key))
        && primary.timing === 'after_exception', 'history_managed_capture_schema_unsupported')
      const error = worker.originalError ?? worker.error
      const sameError = value => requireFact(object(error) && object(value) && text(error.type)
        && typeof error.message === 'string' && /^[a-f0-9]{64}$/u.test(error.messageSha256)
        && ['type', 'message', 'messageSha256'].every(key => value[key] === error[key]),
      'history_managed_capture_error_conflict')
      sameError(receipt.primaryError); sameError(primary.primaryError)
      requireFact(object(manifest.artifacts), 'history_managed_capture_binding_missing')
      for (const key of ['primary', 'tensors']) {
        same(manifest.artifacts[key], children[key])
        requireFact(manifest.artifacts[key].bytes === children[key].bytes, 'history_managed_capture_byte_conflict')
      }
      const context = manifest.context, primaryContext = primary.context, position = worker.failurePosition
      const semanticEqual = (left, right) => {
        if (left === right) return true
        if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
          && left.length === right.length && left.every((value, index) => semanticEqual(value, right[index]))
        if (!object(left) || !object(right)) return false
        const keys = Object.keys(left)
        return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key)
          && semanticEqual(left[key], right[key]))
      }
      requireFact(object(context) && object(primaryContext) && semanticEqual(context, primaryContext),
        'history_managed_capture_context_conflict')
      requireFact(object(context.programBindings) && object(plan.programBindings)
        && semanticEqual(context.programBindings, plan.programBindings), 'history_managed_capture_program_conflict')
      requireFact(object(position) && count(position.epoch) && position.epoch > 0 && position.epoch <= ceiling.epochs
        && text(position.sampleId) && count(position.trainIndex) && count(position.zeroBasedEpochPosition),
      'history_managed_capture_sample_conflict')
      const contextKeys = ['runId', 'executionPackage', 'modelBinding', 'failurePosition', 'optimizerSteps',
        'programBindings', 'sampleBindings', 'sampleId', 'sampleIdentity', 'split']
      for (const value of [context, primaryContext]) {
        requireFact(object(value) && Object.keys(value).every(key => contextKeys.includes(key))
          && value.runId === runId, 'history_managed_capture_identity_conflict')
        same(value.executionPackage, worker.executionPackage)
        requireFact(value.sampleId === position.sampleId && value.split === 'train'
          && object(value.failurePosition) && ['epoch', 'sampleId', 'trainIndex', 'zeroBasedEpochPosition']
            .every(key => value.failurePosition[key] === position[key])
          && object(value.optimizerSteps) && value.optimizerSteps.generator === g && value.optimizerSteps.discriminator === d,
        'history_managed_capture_sample_conflict')
        requireFact(object(value.sampleIdentity) && value.sampleIdentity.sampleId === value.sampleId
          && value.sampleIdentity.split === value.split && object(value.sampleBindings), 'history_managed_capture_sample_conflict')
        same(value.sampleIdentity.image, value.sampleBindings.source)
        same(value.sampleIdentity.conditionPack, value.sampleBindings.condition)
      }
      same(context.modelBinding, primaryContext.modelBinding)
      const models = autonomous.inputEvidence.filter(bound => bound.path === `${outputRoot}/model-identity.json`)
      requireFact(models.length === 1, 'history_managed_capture_model_conflict')
      same(context.modelBinding, models[0]); own(models[0])
      const model = await captureRead(models[0])
      requireFact(model.capabilityVersion === worker.capabilityVersion && text(model.modelCapabilityVersion)
        && text(model.architecture), 'history_managed_capture_model_conflict')
      requireFact(Array.isArray(manifest.graph) && Array.isArray(model.graph) && semanticEqual(manifest.graph, model.graph),
        'history_managed_capture_model_conflict')
      own(manifest.executionBinding)
      requireFact(manifest.executionBinding.path === `${outputRoot}/capture-execution.json`, 'history_managed_capture_path_conflict')
      const execution = await captureRead(manifest.executionBinding)
      requireFact(execution.schema === 'ecology-regime-failure-capture-execution-v1'
        && execution.runId === runId && execution.outputRoot === outputRoot, 'history_managed_capture_identity_conflict')
      same(execution.executionPackage, worker.executionPackage); same(execution.modelBinding, models[0])
      requireFact(record.artifacts.length + 2 <= limits.artifacts, 'history_record_limit', 413)
      append('evidence', children.manifest, { evidenceKind: 'gradientFailureManifest' })
      append('evidence', children.primary, { evidenceKind: 'gradientFailurePrimary' })
      availability.artifacts = 'available'
    } catch (error) {
      // A bad optional capture does not erase the authenticated worker, plan or
      // transaction evidence. Only the capture pair is withheld from delivery.
      if (!error.message?.startsWith('history_') && !['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error
      gap('artifacts', error.status === 413 ? 'over_limit' : error.code === 'ENOENT'
        || error.message === 'history_managed_capture_binding_missing' ? 'missing'
          : error.message === 'history_sha_mismatch' || error.message === 'history_managed_capture_byte_conflict' ? 'hash_conflict'
            : error.message.includes('schema_unsupported') ? 'unsupported_schema' : 'unreadable')
    }
  }
  if (!record.samples.length) gap('samples')
  // Native CPU images never fill a missing machine quality verdict.
  return finish()
}

// No IO or discovery here. The store rechecks safe paths and actual JSON bytes;
// image bytes are checked by the existing artifact endpoint, weights stay metadata.
// This historical materialization predates the common candidateRgb/artifacts
// shape. Both discovery and GET revalidate its explicit parents with this pure
// adapter; it never discovers files, reads weights/images or grants qualification.
export const DRY_RECOVERY_CANDIDATE_SCHEMA = 'ai-painter-mvp256-dry-v24-candidate-manifest-v1'
export async function readDryRecoveryCandidate({ runId, manifest, manifestBinding, terminalBinding, terminal, readJson, requireFact }) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  const text = value => typeof value === 'string' && value.length > 0 && value.length <= 192
  const count = value => Number.isSafeInteger(value) && value >= 0
  const binding = value => requireFact(object(value) && typeof value.path === 'string'
    && /^[a-f0-9]{64}$/u.test(value.sha256), 'history_dry_candidate_binding_missing')
  const same = (left, right) => {
    binding(left); binding(right)
    requireFact(left.path === right.path && left.sha256 === right.sha256, 'history_dry_candidate_parent_conflict')
  }
  requireFact(object(manifest) && manifest.schemaVersion === DRY_RECOVERY_CANDIDATE_SCHEMA,
    'history_dry_candidate_schema_unsupported')
  requireFact(manifest.runId === runId && text(manifest.packageId) && text(manifest.capabilityVersion)
    && manifest.status === 'candidate_materialized_review_pending', 'history_dry_candidate_identity_conflict')
  binding(manifestBinding)
  requireFact(manifest.inputPath === manifestBinding.path, 'history_dry_candidate_parent_conflict')
  same(manifest.trainingTerminal, terminalBinding)
  const identity = value => requireFact(object(value) && value.runId === runId
    && value.packageId === manifest.packageId && value.capabilityVersion === manifest.capabilityVersion,
  'history_dry_candidate_identity_conflict')
  const training = terminal ?? await readJson(manifest.trainingTerminal)
  identity(training)
  requireFact(training.schemaVersion === 'ai-painter-mvp256-dry-v24-training-lifecycle-v1'
    && training.executionState === 'completed' && training.status === 'training_completed_review_pending',
  'history_dry_candidate_terminal_conflict')
  same(manifest.executionPackage, training.executionPackage)
  same(manifest.workerTerminal, training.workerTerminal)
  same(manifest.selectedCheckpoint, training.selectedCheckpoint)
  const pkg = await readJson(manifest.executionPackage)
  identity(pkg)
  requireFact(pkg.schemaVersion === 'ai-painter-stage4-mvp256-dry-v24-execution-package-v1'
    && typeof pkg.outputRoot === 'string' && pkg.outputRoot.startsWith('.runtime/ai-painter/'),
  'history_dry_candidate_schema_unsupported')
  const own = value => { binding(value); requireFact(value.path.startsWith(`${pkg.outputRoot}/`), 'history_dry_candidate_output_root_conflict') }
  for (const value of [manifestBinding, manifest.trainingTerminal, manifest.executionPackage,
    manifest.workerTerminal, manifest.selectedCheckpoint]) own(value)
  const worker = await readJson(manifest.workerTerminal)
  identity(worker)
  requireFact(worker.schemaVersion === 'ai-painter-stage4-mvp256-dry-v24-worker-terminal-v1'
    && worker.executionState === training.executionState && worker.status === training.status,
  'history_dry_candidate_terminal_conflict')
  same(worker.executionPackage, manifest.executionPackage)
  same(worker.selectedCheckpointBinding ?? worker.selectedCheckpoint, manifest.selectedCheckpoint)
  const plan = pkg.trainingPlan, epoch = manifest.selectedEpoch
  requireFact(object(plan) && count(plan.epochs) && count(worker.completedEpochs)
    && worker.completedEpochs <= plan.epochs && count(epoch) && epoch > 0 && epoch <= worker.completedEpochs
    && epoch === training.selectedEpoch && epoch === worker.selectedEpoch
    && Array.isArray(plan.eligibleCheckpointEpochs) && plan.eligibleCheckpointEpochs.length <= 32
    && plan.eligibleCheckpointEpochs.includes(epoch)
    && count(plan.validationRows) && plan.validationRows > 0 && plan.validationRows <= 128,
  'history_dry_candidate_epoch_conflict')
  binding(pkg.validationSplit)
  const membership = await readJson(pkg.validationSplit)
  requireFact(membership.split === 'validation' && Array.isArray(membership.sampleIds)
    && membership.sampleIds.length === plan.validationRows && membership.sampleIds.every(text)
    && new Set(membership.sampleIds).size === membership.sampleIds.length, 'history_dry_candidate_sample_conflict')
  const subject = manifest.subject, candidate = manifest.candidate
  requireFact(object(subject) && object(candidate) && text(subject.sampleId) && subject.split === 'validation'
    && candidate.sampleId === subject.sampleId && candidate.split === subject.split
    && membership.sampleIds.includes(subject.sampleId), 'history_dry_candidate_sample_conflict')
  own(candidate.rgb)
  requireFact(candidate.sourceCheckpointSha256 === manifest.selectedCheckpoint.sha256,
    'history_dry_candidate_checkpoint_conflict')
  requireFact(Array.isArray(worker.checkpoints) && worker.checkpoints.length <= 32, 'history_dry_candidate_checkpoint_limit', 413)
  const checkpoints = worker.checkpoints.filter(cp => cp.epoch === epoch)
  requireFact(checkpoints.length === 1, 'history_dry_candidate_checkpoint_conflict')
  same(checkpoints[0].checkpoint, manifest.selectedCheckpoint)
  requireFact(Array.isArray(checkpoints[0].validation) && checkpoints[0].validation.length <= 128,
    'history_dry_candidate_metric_limit', 413)
  const observations = checkpoints[0].validation.filter(row => row.sampleId === subject.sampleId)
  requireFact(observations.length === 1 && observations[0].split === subject.split && observations[0].epoch === epoch,
    'history_dry_candidate_sample_conflict')
  const resolution = candidate.resolution
  requireFact(Array.isArray(resolution) && resolution.length === 2 && resolution.every(value => count(value) && value > 0),
    'history_dry_candidate_resolution_conflict')
  for (const value of [subject.referenceRgb, subject.conditionPack]) if (value != null) binding(value)
  return { sampleId: subject.sampleId, split: subject.split, epoch,
    output: candidate.rgb, original: subject.referenceRgb ?? null, condition: subject.conditionPack ?? null,
    checkpoint: manifest.selectedCheckpoint, resolution: { width: resolution[0], height: resolution[1] },
    observation: observations[0] }
}

async function adaptDryLifecycle({ family, runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact }) {
  const MAX_ARTIFACTS = 256, MAX_CHECKPOINTS = 32, MAX_METRICS = 1024, MAX_IMAGES = 128, MAX_READS = 16
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  const count = value => Number.isSafeInteger(value) && value >= 0
  const text = value => typeof value === 'string' && value.length > 0 && value.length <= 192
  const gaps = new Set(), availability = {}, seen = new Map(), metrics = new Map(), declaredSamples = new Set()
  requireFact(Array.isArray(record.artifacts) && record.artifacts.length < MAX_ARTIFACTS, 'history_record_limit', 413)
  let reads = 0
  const gap = (field, status = 'not_recorded') => { gaps.add(field); availability[field] = status }
  const binding = value => requireFact(object(value) && typeof value.path === 'string' && /^[a-f0-9]{64}$/u.test(value.sha256), 'history_dry_binding_invalid')
  const same = (left, right) => {
    binding(left); binding(right)
    requireFact(left.path === right.path && left.sha256 === right.sha256, 'history_dry_parent_binding_conflict')
  }
  const identity = (value, capability = true) => requireFact(object(value) && value.runId === runId
    && value.packageId === terminal.packageId && (!capability || value.capabilityVersion === terminal.capabilityVersion), 'history_dry_identity_conflict')
  const append = (role, bound, metadata = {}) => {
    binding(bound)
    const key = `${role}:${bound.path}`, prior = seen.get(key)
    if (prior) { requireFact(prior.sha256 === bound.sha256, 'history_artifact_binding_conflict'); return prior }
    requireFact(record.artifacts.length < MAX_ARTIFACTS, 'history_record_limit', 413)
    const item = makeArtifact(role, bound, metadata)
    record.artifacts.push(item); seen.set(key, item); return item
  }
  const read = async (bound, field) => {
    if (!bound) { gap(field); return null }
    binding(bound)
    requireFact(++reads <= MAX_READS, 'history_dry_read_limit', 413)
    let value
    try {
      value = await readJson(bound)
    } catch (error) {
      if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code) && error.status !== 413) throw error
      gap(field, error.status === 413 ? 'over_limit' : error.code === 'ENOENT' ? 'missing' : 'unreadable')
      return null
    }
    requireFact(object(value), 'history_dry_schema_conflict')
    append('evidence', bound, { evidenceKind: field }); availability[field] = 'available'
    return value
  }
  const finish = () => {
    const sampleCoverage = field => ({ scope: 'explicit_validation_sample_bindings_only',
      availableSampleIds: [...declaredSamples].filter(id => record.samples.some(row => row.sampleId === id && row[field])),
      notRecordedSampleIds: [...declaredSamples].filter(id => !record.samples.some(row => row.sampleId === id && row[field])),
      complete: declaredSamples.size > 0 && [...declaredSamples].every(id => record.samples.some(row => row.sampleId === id && row[field])) })
    const originals = sampleCoverage('original'), conditions = sampleCoverage('condition')
    if (originals.notRecordedSampleIds.length) gap('samples.original')
    if (conditions.notRecordedSampleIds.length) gap('samples.condition')
    if (!record.samples.length) gap('samples')
    base.unavailableFields = [...new Set([...base.unavailableFields, ...gaps])]
    record.detailCoverage = { adapter: 'bounded_dry_training_lifecycle_v1', supported: true,
      sourcePolicy: 'verified_registry_and_explicit_sha256_bound_parents_only', availability,
      checkpointLimit: MAX_CHECKPOINTS, metricLimit: MAX_METRICS, imageLimit: MAX_IMAGES,
      artifactLimit: MAX_ARTIFACTS, jsonReadLimit: MAX_READS, jsonReads: reads,
      validationMetricCount: record.metrics.length, candidateCount: record.artifacts.filter(item => item.role === 'output').length,
      originals, conditions,
      complete: gaps.size === 0 }
    return { ...base, dataStatus: gaps.size ? 'partial' : 'connected', reasonCode: gaps.size ? 'history_dry_detail_partial' : null,
      schemaVersion: 'ai_console_training_run_detail_v1', record }
  }
  requireFact(terminal.runId === runId && text(terminal.packageId) && text(terminal.capabilityVersion), 'history_dry_identity_conflict')
  requireFact(['completed', 'failed_closed'].includes(terminal.executionState), 'history_dry_terminal_state_conflict')
  record.runKind = 'bounded_dry_training'
  gap('logs') // This protocol has no bound program log; events remain separate.
  const pkg = await read(terminal.executionPackage, 'executionPackage')
  if (!pkg) { gap('metrics'); gap('checkpoints'); gap('samples'); return finish() }
  identity(pkg)
  requireFact(pkg.schemaVersion === `ai-painter-stage4-mvp256-dry-${family}-execution-package-v1`, 'history_dry_schema_conflict')
  requireFact(typeof pkg.outputRoot === 'string' && pkg.outputRoot.startsWith('.runtime/ai-painter/')
    && terminal.executionPackage.path === `${pkg.outputRoot}/execution-package.json`, 'history_dry_output_root_conflict')
  const own = bound => { binding(bound); requireFact(bound.path.startsWith(`${pkg.outputRoot}/`), 'history_dry_output_root_conflict') }
  const plan = pkg.trainingPlan
  requireFact(object(plan) && count(plan.epochs) && plan.epochs > 0 && count(plan.generatorOptimizerSteps)
    && count(plan.discriminatorOptimizerSteps) && count(plan.validationRows) && plan.validationRows > 0 && plan.validationRows <= 128,
  'history_dry_plan_conflict')
  requireFact(Array.isArray(plan.eligibleCheckpointEpochs) && plan.eligibleCheckpointEpochs.length > 0
    && plan.eligibleCheckpointEpochs.length <= MAX_CHECKPOINTS
    && new Set(plan.eligibleCheckpointEpochs).size === plan.eligibleCheckpointEpochs.length
    && plan.eligibleCheckpointEpochs.every(epoch => count(epoch) && epoch > 0 && epoch <= plan.epochs)
    && plan.eligibleCheckpointEpochs.length * plan.validationRows <= MAX_METRICS, 'history_dry_plan_limit', 413)
  if (pkg.resourceBudget) for (const field of ['epochs', 'generatorOptimizerSteps', 'discriminatorOptimizerSteps'])
    requireFact(pkg.resourceBudget[field] === plan[field], 'history_dry_plan_conflict')
  const candidate = await read(pkg.sourceDataCandidate, 'sourceDataCandidate')
  if (candidate) {
    const size = candidate.scope?.resolution
    requireFact(candidate.schemaVersion === 'stage4-mvp256-dry-v24-closed-loop-candidate-v1'
      && Array.isArray(size) && size.length === 2 && size.every(value => count(value) && value > 0), 'history_dry_candidate_schema_conflict')
    record.resolution = { width: size[0], height: size[1] }
    base.unavailableFields = base.unavailableFields.filter(field => field !== 'resolution')
  } else gap('resolution')
  record.targetEpochs = plan.epochs; record.targetOptimizerSteps = plan.generatorOptimizerSteps
  record.targetDiscriminatorOptimizerSteps = plan.discriminatorOptimizerSteps
  if (terminal.workerTerminal) own(terminal.workerTerminal)
  const worker = await read(terminal.workerTerminal, 'workerTerminal')
  if (!worker) { gap('metrics'); gap('checkpoints'); gap('samples'); gap('candidateImages'); return finish() }
  own(terminal.workerTerminal); identity(worker)
  requireFact(worker.schemaVersion === `ai-painter-stage4-mvp256-dry-${family}-worker-terminal-v1`, 'history_dry_schema_conflict')
  same(worker.executionPackage, terminal.executionPackage)
  requireFact(worker.executionState === terminal.executionState && worker.status === terminal.status, 'history_dry_terminal_state_conflict')
  const g = worker.optimizerStepsGenerator, d = worker.optimizerStepsDiscriminator
  requireFact(count(worker.completedEpochs) && worker.completedEpochs <= plan.epochs
    && count(g) && g <= plan.generatorOptimizerSteps && count(d) && d <= plan.discriminatorOptimizerSteps, 'history_dry_plan_conflict')
  record.completedEpochs = worker.completedEpochs; record.optimizerSteps = g
  record.discriminatorOptimizerSteps = d
  if (worker.completedAtUtc || worker.finishedAtUtc) {
    record.finishedAtUtc = worker.completedAtUtc ?? worker.finishedAtUtc
    base.unavailableFields = base.unavailableFields.filter(field => field !== 'finishedAtUtc')
  }
  if (terminal.trainingProgress) own(terminal.trainingProgress)
  const progress = await read(terminal.trainingProgress, 'trainingProgress')
  if (progress) {
    own(terminal.trainingProgress); identity(progress)
    requireFact(progress.schemaVersion === `ai-painter-stage4-mvp256-dry-${family}-progress-v1`
      && ['completed', 'failed_closed', 'checkpoint_selected_review_pending'].includes(progress.executionState)
      && progress.completedEpochs === worker.completedEpochs && progress.optimizerStepsGenerator === g
      && progress.optimizerStepsDiscriminator === d, 'history_dry_progress_conflict')
  }
  const membership = await read(pkg.validationSplit, 'validationSplit')
  if (!membership) { gap('metrics'); gap('samples'); return finish() }
  requireFact(membership.split === 'validation' && Array.isArray(membership.sampleIds)
    && membership.sampleIds.length === plan.validationRows && membership.sampleIds.every(text)
    && new Set(membership.sampleIds).size === membership.sampleIds.length, 'history_dry_sample_conflict')
  const sampleIds = new Set(membership.sampleIds), epochs = new Set()
  for (const id of sampleIds) declaredSamples.add(id)
  requireFact(Array.isArray(worker.checkpoints) && worker.checkpoints.length <= MAX_CHECKPOINTS, 'history_dry_checkpoint_limit', 413)
  for (const cp of worker.checkpoints) {
    requireFact(object(cp) && plan.eligibleCheckpointEpochs.includes(cp.epoch) && cp.epoch <= worker.completedEpochs
      && !epochs.has(cp.epoch) && cp.selection?.epoch === cp.epoch, 'history_dry_checkpoint_conflict')
    epochs.add(cp.epoch); own(cp.checkpoint)
    if (cp.checkpointSha256 !== undefined) requireFact(cp.checkpointSha256 === cp.checkpoint.sha256, 'history_dry_checkpoint_conflict')
    const item = append('checkpoint', cp.checkpoint, { epoch: cp.epoch, selected: cp.epoch === terminal.selectedEpoch,
      selection: cp.selection, promotable: false, verificationStatus: 'binding_verified_bytes_not_read', metadataOnly: true })
    try { Object.assign(item, await checkpointMetadata(item)); record.checkpoints.push(item) }
    catch (error) { if (error.code !== 'ENOENT') throw error; item.availability = 'missing'; gap('checkpoints', 'missing') }
    requireFact(Array.isArray(cp.validation) && cp.validation.length <= plan.validationRows, 'history_dry_metric_limit', 413)
    const seenSamples = new Set()
    for (const row of cp.validation) {
      requireFact(object(row) && sampleIds.has(row.sampleId) && row.split === 'validation'
        && row.epoch === cp.epoch && !seenSamples.has(row.sampleId), 'history_dry_metric_identity_conflict')
      requireFact(record.metrics.length < MAX_METRICS, 'history_dry_metric_limit', 413)
      seenSamples.add(row.sampleId)
      const metric = { sourceField: 'checkpoint.validation', sampleId: row.sampleId, split: row.split, epoch: cp.epoch,
        measurements: row, sourcePath: terminal.workerTerminal.path, sourceSha256: terminal.workerTerminal.sha256 }
      record.metrics.push(metric); metrics.set(`${cp.epoch}:${row.sampleId}`, metric)
    }
    if (seenSamples.size !== sampleIds.size) gap('metrics', 'not_recorded')
  }
  if (!record.metrics.length) gap('metrics')
  if (!record.checkpoints.length) gap('checkpoints')
  if (worker.executionState === 'completed' && epochs.size !== plan.eligibleCheckpointEpochs.length) gap('checkpointCoverage')
  if (terminal.selectedCheckpoint) {
    own(terminal.selectedCheckpoint)
    same(terminal.selectedCheckpoint, worker.selectedCheckpointBinding ?? worker.selectedCheckpoint)
    if (worker.selectedCheckpointBinding && worker.selectedCheckpoint) same(worker.selectedCheckpointBinding, worker.selectedCheckpoint)
    requireFact(terminal.selectedEpoch === worker.selectedEpoch && epochs.has(terminal.selectedEpoch), 'history_dry_checkpoint_conflict')
    const selected = worker.checkpoints.find(cp => cp.epoch === terminal.selectedEpoch)
    same(selected.checkpoint, terminal.selectedCheckpoint)
    if (progress?.selectedCheckpoint) same(progress.selectedCheckpoint, terminal.selectedCheckpoint)
    if (progress?.selectedEpoch !== undefined) requireFact(progress.selectedEpoch === terminal.selectedEpoch, 'history_dry_checkpoint_conflict')
  } else gap('selectedCheckpoint')
  record.selectedEpoch = terminal.selectedEpoch ?? null
  record.qualification = { ...record.qualification, checkpointReloadVerified: worker.checkpointReloadVerified ?? null,
    checkpointPromotionEligible: false, formalQualificationAllowed: false, worldEntryAllowed: false }
  const image = (bound, metadata) => {
    own(bound)
    requireFact(sampleIds.has(metadata.sampleId) && metadata.split === 'validation'
      && metrics.has(`${metadata.epoch}:${metadata.sampleId}`), 'history_dry_image_identity_conflict')
    const output = append('output', bound, metadata)
    metrics.get(`${metadata.epoch}:${metadata.sampleId}`).image = output
    if (!record.samples.some(row => row.sampleId === metadata.sampleId)) record.samples.push({ sampleId: metadata.sampleId, split: metadata.split, output, original: null, condition: null })
    return output
  }
  if (worker.images !== undefined) {
    requireFact(Array.isArray(worker.images) && worker.images.length <= MAX_IMAGES, 'history_dry_image_limit', 413)
    for (const row of worker.images) {
      requireFact(['prediction', 'validation_prediction'].includes(row.purpose), 'history_dry_image_purpose_conflict')
      image(row, { sampleId: row.sampleId, split: row.split, epoch: row.epoch, purpose: row.purpose })
    }
  }
  if (!candidate || !terminal.selectedCheckpoint) { gap('candidateImages'); gap('machineReview'); return finish() }
  // A review must point back to this exact registered training terminal. It is
  // never discovered by name, and its baseline comparison arm is never imported.
  if (!taskTerminalBinding || taskTerminalBinding.path === record.terminalBinding?.path) {
    gap('machineReview'); if (!record.samples.length) gap('candidateImages'); return finish()
  }
  own(taskTerminalBinding)
  const review = await read(taskTerminalBinding, 'reviewTerminal')
  if (!review) { gap('candidateImages'); return finish() }
  if (review.schemaVersion !== `ai-painter-mvp256-dry-${family}-review-terminal-v1`) {
    gap('machineReview', 'unsupported_schema'); gap('candidateImages'); return finish()
  }
  identity(review, false)
  requireFact(review.status === taskTerminalBinding.status, 'history_dry_review_status_conflict')
  same(review.trainingTerminal, record.terminalBinding)
  same(review.selectedCheckpoint, terminal.selectedCheckpoint)
  if (review.cpuComparison) own(review.cpuComparison)
  const comparison = await read(review.cpuComparison, 'cpuComparison')
  if (!comparison) { gap('candidateImages'); return finish() }
  identity(comparison)
  requireFact(comparison.schemaVersion === `ai-painter-mvp256-dry-${family}-cpu-review-v1`, 'history_dry_schema_conflict')
  same(comparison.trainingTerminal, record.terminalBinding); same(comparison.executionPackage, terminal.executionPackage)
  same(comparison.workerTerminal, terminal.workerTerminal); same(comparison.selectedCheckpoint, terminal.selectedCheckpoint)
  requireFact(comparison.selectedEpoch === terminal.selectedEpoch && object(comparison.measurements)
    && Object.keys(comparison.measurements).length <= 16, 'history_dry_comparison_conflict')
  const arms = Object.values(comparison.measurements).filter(arm => object(arm)
    && arm.checkpoint?.path === terminal.selectedCheckpoint.path && arm.checkpoint?.sha256 === terminal.selectedCheckpoint.sha256)
  requireFact(arms.length === 1 && Array.isArray(arms[0].rows) && arms[0].rows.length <= Math.min(MAX_IMAGES, plan.validationRows), 'history_dry_comparison_conflict')
  const imageSamples = new Set()
  for (const row of arms[0].rows) {
    const observation = row.observation
    requireFact(observation?.sampleId === row.sampleId && observation.epoch === terminal.selectedEpoch
      && !imageSamples.has(row.sampleId), 'history_dry_image_identity_conflict')
    imageSamples.add(row.sampleId)
    image(row.image, { sampleId: row.sampleId, split: observation.split, epoch: observation.epoch,
      purpose: 'validation_prediction', sourceLabel: 'selected_checkpoint_cpu_comparison', sourcePath: review.cpuComparison.path })
  }
  if (imageSamples.size !== sampleIds.size) gap('candidateImages')
  const subject = comparison.subject
  requireFact(subject?.sampleId === candidate?.scope?.subjectSampleId && subject.split === candidate?.scope?.subjectSplit
    && subject.split === 'validation' && imageSamples.has(subject.sampleId), 'history_dry_subject_conflict')
  const subjectRow = arms[0].rows.find(row => row.sampleId === subject.sampleId)
  same(comparison.candidateRgb, subjectRow.image)
  const output = image(comparison.candidateRgb, { sampleId: subject.sampleId, split: subject.split, epoch: terminal.selectedEpoch, purpose: 'validation_prediction' })
  output.reviewCandidate = true
  const original = subject.referenceRgb ? append('original', subject.referenceRgb, { sampleId: subject.sampleId, split: subject.split, purpose: 'held_out_reference_rgb' }) : null
  const condition = subject.conditionPack ? append('condition', subject.conditionPack, { sampleId: subject.sampleId, split: subject.split }) : null
  if (comparison.originalRgb) { own(comparison.originalRgb); append('original', comparison.originalRgb, { sampleId: subject.sampleId, split: subject.split, purpose: 'resized_review_reference' }) }
  Object.assign(record.samples.find(row => row.sampleId === subject.sampleId), { original, condition })
  if (review.audit) own(review.audit)
  const audit = await read(review.audit, 'machineReview')
  if (audit) {
    requireFact(audit.schemaVersion === `ai-painter-mvp256-dry-${family}-independent-audit-v1`
      && audit.runId === runId && audit.sampleId === subject.sampleId && audit.selectedEpoch === terminal.selectedEpoch
      && audit.status === review.status, 'history_dry_audit_identity_conflict')
    same(audit.input, review.cpuComparison); same(audit.selectedCheckpoint, terminal.selectedCheckpoint); same(audit.candidateRgb, comparison.candidateRgb)
    if (audit.projection) { own(audit.projection); append('image', audit.projection, { sampleId: subject.sampleId, split: subject.split,
      epoch: terminal.selectedEpoch, purpose: 'alignment_auditor_projection_not_native_generation' }) }
    record.machineReview = { status: audit.status, issueCodes: audit.issueCodes ?? [], visualApprovalGranted: audit.visualApprovalGranted ?? null,
      sourcePath: review.audit.path, sourceSha256: review.audit.sha256 }
    output.passed = audit.visualApprovalGranted === true; output.issueCodes = audit.issueCodes ?? []
  }
  record.reviewStatus = review.status
  record.qualification = { ...record.qualification, machineReviewPending: false, visualApprovalGranted: review.visualApprovalGranted ?? null,
    formalStage4QualificationGranted: review.formalStage4QualificationGranted ?? null, runtimePublicationGranted: review.runtimePublicationGranted ?? null }
  return finish()
}

// Stage0 training and its later machine review are separate immutable
// terminals. This adapter joins them only through bindings carried by the
// verified registry chain and checks every parent identity and hash binding.
// It never discovers review files by directory or filename convention.
async function adaptMvpStage0Lifecycle({ runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact }) {
  const phaseSchema = MVP_STAGE0_PHASE_SCHEMAS.get(terminal.schemaVersion)
  requireFact(Boolean(phaseSchema), 'history_mvp_stage0_schema_conflict')
  const nativeRgb = terminal.schemaVersion !== 'ai-painter-stage4-mvp-denoiser-stage0-lifecycle-v1'
  const gaps = new Set(), seen = new Map()
  const missing = (...fields) => { for (const field of fields) gaps.add(field) }
  const sameBinding = (left, right, code = 'history_mvp_stage0_parent_conflict') => {
    requireFact(left?.path === right?.path && left?.sha256 === right?.sha256, code)
  }
  const append = (role, binding, metadata = {}) => {
    if (!binding) return null
    const key = `${role}:${binding.path}`
    if (seen.has(key)) { requireFact(seen.get(key).sha256 === binding.sha256, 'history_artifact_binding_conflict'); return seen.get(key) }
    requireFact(record.artifacts.length < 96, 'history_record_limit', 413)
    const item = makeArtifact(role, binding, metadata)
    record.artifacts.push(item); seen.set(key, item)
    return item
  }
  const evidence = async (binding, schema, field) => {
    if (!binding) { missing(field); return null }
    const value = await readJson(binding)
    requireFact(value.schemaVersion === schema, 'history_mvp_stage0_schema_conflict')
    requireFact(value.runId === runId, 'history_mvp_stage0_run_conflict')
    append('evidence', binding, { evidenceKind: field })
    return value
  }
  const finish = reasonCode => {
    base.unavailableFields = [...new Set([...base.unavailableFields, ...gaps])]
    record.detailCoverage = {
      adapter: nativeRgb ? 'mvp_native_rgb_stage0_lifecycle_v1' : 'mvp_denoiser_stage0_lifecycle_v1', supported: true,
      sourcePolicy: 'verified_registry_and_explicit_hash_bound_parents_only',
      candidateAssociation: 'explicit_sample_split_inference_identity_and_review_binding',
      candidateCount: record.artifacts.filter(item => item.role === 'output').length,
      complete: gaps.size === 0,
    }
    return { ...base, dataStatus: reasonCode ? 'partial' : 'connected', reasonCode, schemaVersion: 'ai_console_training_run_detail_v1', record }
  }

  requireFact(terminal.runId === runId, 'history_mvp_stage0_run_conflict')
  record.runKind = nativeRgb ? 'mvp_native_rgb_stage0_training' : 'mvp_denoiser_stage0_training'
  record.resolution = terminal.stage ? { width: terminal.stage.width, height: terminal.stage.height } : null
  if (record.resolution) base.unavailableFields = base.unavailableFields.filter(field => field !== 'resolution')
  else missing('resolution')
  append('evidence', terminal.executionPackage, { evidenceKind: 'execution_package' })
  if (terminal.status === 'formal_stage0_failed_closed' && terminal.executionState === 'failed_closed') {
    missing('worker_terminal', 'metrics', 'checkpoint', 'machineReview', 'candidateImages')
    record.qualification = { ...record.qualification, stagePassed: false, checkpointPromotionEligible: false, stage1InitializationEligible: false }
    return finish('history_failed_before_artifact_registration')
  }
  requireFact(terminal.status === 'training_completed_review_pending', 'history_mvp_stage0_run_conflict')
  const phase = await evidence(terminal.workerTerminal, phaseSchema, 'worker_terminal')
  if (!phase) return finish('history_mvp_stage0_training_terminal_missing')
  sameBinding(phase.executionPackage, terminal.executionPackage)
  sameBinding(phase.checkpoint, terminal.checkpoint, 'history_checkpoint_binding_conflict')
  record.optimizerSteps = phase.optimizerSteps ?? null
  record.finishedAtUtc = phase.finishedAtUtc ?? phase.completedAtUtc ?? record.finishedAtUtc
  record.qualification = {
    ...record.qualification,
    checkpointReloadVerified: phase.checkpointReloadVerified ?? null,
    stagePassed: phase.stagePassed ?? false,
    machineReviewPending: phase.machineReviewPending ?? null,
    checkpointPromotionEligible: false,
    stage1InitializationEligible: false,
  }
  if (terminal.checkpoint) {
    const checkpoint = await checkpointMetadata(append('checkpoint', terminal.checkpoint, { optimizerSteps: record.optimizerSteps, selectedEpoch: phase.selectedEpoch ?? null, promotable: false }))
    Object.assign(record.artifacts.find(item => item.artifactId === checkpoint.artifactId), checkpoint)
    record.checkpoints.push(checkpoint)
  } else missing('checkpoint')

  if (!taskTerminalBinding) { missing('machineReview', 'candidateImages'); return finish('history_mvp_stage0_review_not_registered') }
  const reviewTerminal = await readJson(taskTerminalBinding)
  if (reviewTerminal.schemaVersion !== 'ai-painter-stage4-mvp-stage0-machine-review-terminal-v1') {
    missing('machineReview', 'candidateImages')
    return finish('history_mvp_stage0_review_not_registered')
  }
  requireFact(reviewTerminal.runId === runId, 'history_mvp_stage0_run_conflict')
  requireFact(reviewTerminal.status === taskTerminalBinding.status, 'history_mvp_stage0_review_status_conflict')
  sameBinding(reviewTerminal.sourceTrainingTerminal, terminal.workerTerminal)
  sameBinding(reviewTerminal.checkpoint, terminal.checkpoint, 'history_checkpoint_binding_conflict')
  append('evidence', taskTerminalBinding, { evidenceKind: 'machine_review_terminal' })
  const manifest = await evidence(reviewTerminal.candidateManifest, 'ai-painter-stage4-mvp-stage0-review-candidate-pack-v1', 'candidate_manifest')
  const review = reviewTerminal.machineReview ? await readJson(reviewTerminal.machineReview) : null
  if (!review) missing('machine_review')
  const v13Review = review?.schemaVersion === 'stage4-mvp-v13-stage0-formal-machine-review-v1'
  if (review && !v13Review && review.schemaVersion !== 'ai-painter-stage4-mvp-stage0-machine-review-v1') {
    append('evidence', reviewTerminal.machineReview, { evidenceKind: 'machine_review', contentStatus: 'unsupported_schema' })
    missing('machineReview', 'candidateImages')
    return finish('history_mvp_stage0_review_schema_unsupported')
  }
  if (!manifest || !review) return finish('history_mvp_stage0_review_evidence_missing')
  requireFact(review.runId === runId, 'history_mvp_stage0_run_conflict')
  append('evidence', reviewTerminal.machineReview, { evidenceKind: 'machine_review' })
  sameBinding(review.candidateManifest, reviewTerminal.candidateManifest)
  if (v13Review) sameBinding(review.executionPackage, terminal.executionPackage)
  else {
    sameBinding(review.trainingTerminal, terminal.workerTerminal)
    sameBinding(review.checkpoint, terminal.checkpoint, 'history_checkpoint_binding_conflict')
  }
  sameBinding(manifest.trainingTerminal, terminal.workerTerminal)
  sameBinding(manifest.checkpoint, terminal.checkpoint, 'history_checkpoint_binding_conflict')
  requireFact(Array.isArray(manifest.candidates) && manifest.candidates.length <= 32, 'history_sample_limit', 413)
  requireFact(Array.isArray(review.reviews) && review.reviews.length === manifest.candidates.length, 'history_mvp_stage0_review_count_conflict')
  requireFact(manifest.candidateCount === manifest.candidates.length && review.candidateCount === review.reviews.length, 'history_mvp_stage0_review_count_conflict')
  const reviewBySample = new Map(review.reviews.map(row => [row.sampleId, row]))
  requireFact(reviewBySample.size === review.reviews.length, 'history_mvp_stage0_sample_conflict')
  for (const candidate of manifest.candidates) {
    const deterministic = candidate.seed === null
      && (candidate.artifactIdentity?.inferenceMode === 'deterministic_condition_to_complete_rgb'
        || (v13Review && candidate.artifactIdentity?.inferenceMode === 'bound_instance_objects_to_complete_rgb'))
    if (v13Review && deterministic) sameBinding(candidate.artifactIdentity.candidateRgb, candidate.candidateRgb, 'history_mvp_stage0_candidate_binding_conflict')
    requireFact(typeof candidate.sampleId === 'string' && candidate.split === 'validation'
      && (Number.isInteger(candidate.seed) || deterministic), 'history_sample_identity_invalid')
    const judged = reviewBySample.get(candidate.sampleId)
    requireFact(judged && judged.sampleIndex === candidate.sampleIndex, 'history_mvp_stage0_sample_conflict')
    sameBinding(judged.candidateRgb, candidate.candidateRgb, 'history_mvp_stage0_candidate_binding_conflict')
    if (v13Review) {
      sameBinding(judged.referenceRgb, candidate.referenceRgb, 'history_mvp_stage0_candidate_binding_conflict')
      sameBinding(judged.conditionPack, candidate.conditionPack, 'history_mvp_stage0_candidate_binding_conflict')
      requireFact(typeof judged.semanticAndAestheticPassed === 'boolean' && typeof judged.minimumDetailPassed === 'boolean', 'history_mvp_stage0_review_shape_conflict')
    }
    const passed = v13Review ? judged.semanticAndAestheticPassed && judged.minimumDetailPassed : judged.passed === true
    const reviewMetadata = { sampleId: candidate.sampleId, split: candidate.split,
      ...(Number.isInteger(candidate.seed) ? { seed: candidate.seed } : {}),
      inferenceMode: deterministic ? candidate.artifactIdentity.inferenceMode : 'seeded_rollout',
      epoch: manifest.selectedEpoch ?? null, passed, issueCodes: judged.issueCodes ?? [] }
    const original = append('original', candidate.referenceRgb, { sampleId: candidate.sampleId, split: candidate.split, sourceRole: 'held_out_reference_rgb' })
    const condition = append('condition', candidate.conditionPack, { sampleId: candidate.sampleId, split: candidate.split })
    const output = append('output', candidate.candidateRgb, reviewMetadata)
    record.samples.push({ sampleId: candidate.sampleId, split: candidate.split, original, condition, output })
    record.metrics.push({
      sampleId: candidate.sampleId, split: candidate.split, seed: candidate.seed, epoch: manifest.selectedEpoch ?? null,
      passed, issueCodes: judged.issueCodes ?? [],
      measurements: candidate.rolloutMetrics ?? null,
      machineReview: { professionalAesthetic: judged.professionalAesthetic ?? null, conditionAlignment: judged.conditionAlignment ?? null, minimumDetail: judged.minimumDetail ?? null },
      image: output,
    })
  }
  record.terminalStatus = reviewTerminal.status
  record.reviewStatus = reviewTerminal.status
  record.qualification = {
    ...record.qualification,
    stagePassed: reviewTerminal.stagePassed === true,
    machineReviewPending: false,
    candidateCount: reviewTerminal.candidateCount,
    candidatePassCount: reviewTerminal.candidatePassCount,
    candidateFailCount: reviewTerminal.candidateFailCount,
    issueHistogram: reviewTerminal.issueHistogram ?? {},
    checkpointPromotionEligible: reviewTerminal.checkpointPromotionEligible === true,
    stage1InitializationEligible: reviewTerminal.stage1InitializationEligible === true,
  }
  return finish(null)
}

// This adapter follows only explicit, hash-bound parents. It deliberately has
// no filesystem access, history discovery, new index or filename inference.
async function adaptSpatialAffineSmoke({ runId, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact }) {
  const gaps = new Set(), availability = {}, seen = new Map()
  const gap = (field, reason = 'not_recorded') => { gaps.add(field); availability[field] = reason }
  const finish = () => {
    base.unavailableFields = [...new Set([...base.unavailableFields, ...gaps])]
    record.detailCoverage = { adapter: 'spatial_affine_controlled_smoke_v1', supported: true, artifactLimit: 64, availability, complete: gaps.size === 0 }
    return { ...base, dataStatus: gaps.size ? 'partial' : 'connected', reasonCode: gaps.size ? 'history_spatial_affine_detail_partial' : null, schemaVersion: 'ai_console_training_run_detail_v1', record }
  }
  const append = (role, binding, metadata = {}) => {
    if (!binding) { gap(role); return null }
    const key = `${role}:${binding.path}`
    if (seen.has(key)) { requireFact(seen.get(key).sha256 === binding.sha256, 'history_artifact_binding_conflict'); return seen.get(key) }
    if (record.artifacts.length >= 64) { gap('artifacts', 'over_limit'); return null }
    const item = makeArtifact(role, binding, metadata); record.artifacts.push(item); seen.set(key, item); availability[binding.path] = 'available'; return item
  }
  const read = async (binding, field, schema = null, sameRun = false) => {
    if (!binding) { gap(field); return null }
    try {
      const value = await readJson(binding)
      if (schema) requireFact(value.schemaVersion === schema, 'history_spatial_affine_schema_conflict')
      if (sameRun) requireFact(value.runId === runId, 'history_spatial_affine_run_conflict')
      append('evidence', binding, { evidenceKind: field }); return value
    } catch (error) {
      if (error.code !== 'ENOENT' && error.status !== 413) throw error
      gap(field, error.code === 'ENOENT' ? 'missing' : 'over_limit')
      return null
    }
  }
  requireFact(terminal.runId === runId, 'history_spatial_affine_run_conflict')
  const finalization = await read(terminal.finalization, 'finalization', 'stage4-full-backbone-spatial-affine-controlled-smoke-finalization-v1', true)
  const manifestBinding = terminal.manifest ?? finalization?.manifest
  if (terminal.manifest && finalization?.manifest) requireFact(terminal.manifest.path === finalization.manifest.path && terminal.manifest.sha256 === finalization.manifest.sha256, 'history_spatial_affine_parent_conflict')
  const manifest = await read(manifestBinding, 'manifest', 'stage4-full-backbone-spatial-affine-controlled-smoke-root-manifest-v1', true)
  if (!manifest) return finish()
  const trainingBinding = manifest.trainingManifest
  if (finalization?.trainingManifest && trainingBinding) requireFact(finalization.trainingManifest.path === trainingBinding.path && finalization.trainingManifest.sha256 === trainingBinding.sha256, 'history_spatial_affine_parent_conflict')
  const training = await read(trainingBinding, 'trainingManifest', 'project-owned-ai-assisted-cold-start-checkpoint-v7')
  if (!training) return finish()
  record.runKind = 'spatial_affine_controlled_smoke'
  record.optimizerSteps = training.trainingTokenAccounting?.runTotals?.optimizerSteps ?? null
  const geometry = training.trainingTokenAccounting?.geometry
  record.resolution = geometry ? { width: geometry.imageWidth, height: geometry.imageHeight } : null
  if (record.resolution) base.unavailableFields = base.unavailableFields.filter(field => field !== 'resolution')
  record.qualification = { ...record.qualification, formalInferenceEligible: training.formalInferenceEligible ?? null, checkpointPromotionEligible: training.checkpointPromotionEligible ?? null, terminalCheckpointPromotable: terminal.checkpointPromotable ?? null }
  requireFact(Array.isArray(training.metrics) && training.metrics.length <= 1024, 'history_metrics_limit', 413)
  for (const metric of training.metrics) {
    requireFact(metric && typeof metric === 'object' && Number.isInteger(metric.epoch) && metric.epoch > 0, 'history_epoch_identity_invalid')
    record.metrics.push({ sourceField: 'epoch_metrics', epoch: metric.epoch, measurements: metric, sourcePath: trainingBinding.path, sourceSha256: trainingBinding.sha256 })
  }
  if (!record.metrics.length) gap('metrics')
  const checkpointBinding = manifest.checkpoint
  if (checkpointBinding) {
    requireFact(checkpointBinding.path === training.checkpointPath && checkpointBinding.sha256 === training.checkpointSha256, 'history_checkpoint_binding_conflict')
    if (finalization?.checkpoint) requireFact(finalization.checkpoint.path === checkpointBinding.path && finalization.checkpoint.sha256 === checkpointBinding.sha256, 'history_checkpoint_binding_conflict')
    const item = append('checkpoint', checkpointBinding, { optimizerSteps: record.optimizerSteps, promotable: checkpointBinding.promotable ?? null })
    if (item) try { Object.assign(item, await checkpointMetadata(item)); record.checkpoints.push(item) } catch (error) { if (error.code !== 'ENOENT') throw error; item.availability = 'missing'; gap('checkpoint', 'missing') }
  } else gap('checkpoint')
  const selected = training.singleSampleOverfitSmoke?.enabled === true ? training.singleSampleOverfitSmoke : null
  if (selected && typeof selected.sampleId === 'string' && training.sourceIndexPath && training.sourceIndexSha256) {
    const sourceBinding = { path: training.sourceIndexPath, sha256: training.sourceIndexSha256 }
    const source = await read(sourceBinding, 'sourceIndex', 'ai-assisted-cold-start-dataset-source-index-v1')
    if (source) {
      requireFact(Array.isArray(source.samples) && source.samples.length <= 2048, 'history_sample_limit', 413)
      const rows = source.samples.filter(row => row.sampleId === selected.sampleId)
      requireFact(rows.length === 1 && rows[0].split === selected.selectedSplit, 'history_sample_binding_conflict')
      const row = rows[0]
      if (row.imagePath && row.imageSha256) {
        const original = append('original', { path: row.imagePath, sha256: row.imageSha256 }, { sampleId: row.sampleId, split: row.split, sourceRole: 'explicit_selected_smoke_sample' })
        if (original) record.samples.push({ sampleId: row.sampleId, split: row.split, original, condition: null })
      } else gap('selectedSample.original')
    }
  } else gap('selectedSample.original')
  if (!record.samples.length) gap('selectedSample.original')
  // Epoch is explicit in each fixedPreviews entry. No sample/seed is decoded
  // from its filename; missing per-image identities stay visibly unbound.
  if (training.fixedPreviews !== undefined) requireFact(Array.isArray(training.fixedPreviews), 'history_preview_schema_conflict')
  for (const preview of (training.fixedPreviews ?? []).slice(0,64)) {
    if (!preview.path || !preview.sha256) { gap('preview.binding'); continue }
    append('output', preview, { epoch: preview.epoch ?? null, sampleId: preview.sampleId, seed: preview.seed, associationStatus: preview.sampleId ? 'explicit_sample_binding' : 'epoch_only_sample_seed_not_bound' })
    if (!preview.sampleId || preview.seed === undefined) gap('preview.sample_seed_association')
  }
  if ((training.fixedPreviews?.length ?? 0) > 64) gap('artifacts', 'over_limit')
  if (!training.fixedPreviews?.length) gap('previews')
  for (const field of ['machineReviewTimeline','lateStabilityQualification','resourceTelemetry','activeConfig','progress']) {
    const binding = terminal[field] ?? manifest[field] ?? finalization?.[field]
    for (const parent of [terminal,manifest,finalization]) if (binding && parent?.[field]) requireFact(binding.path === parent[field].path && binding.sha256 === parent[field].sha256, 'history_spatial_affine_parent_conflict')
    await read(binding, field)
  }
  return finish()
}
