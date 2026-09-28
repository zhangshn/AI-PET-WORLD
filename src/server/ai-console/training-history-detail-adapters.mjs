// Legacy layouts are enabled by explicit package/result discriminants. File
// extensions classify already-bound artifacts; names never invent relationships.
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
export function legacyRunKind(schema) { return PACKAGE_KINDS[schema]?.[2] ?? (schema === 'ai-painter-learning-capacity-interrupted-experiment-terminal-v1' ? 'interrupted_experiment' : 'registered_experiment') }
const LEARNING_PACKAGES = new Set(['ai-painter-learning-capacity-experiment-package-v1', 'ai-painter-decoder-reconstruction-experiment-package-v1', 'ai-painter-v21-train-only-capacity-package-v1'])
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
  if (terminal.schemaVersion === 'stage4-full-backbone-spatial-affine-controlled-smoke-terminal-v1') return adaptSpatialAffineSmoke({ runId, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact })
  if (MVP_STAGE0_LIFECYCLE_SCHEMAS.has(terminal.schemaVersion)) return adaptMvpStage0Lifecycle({ runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact })
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
