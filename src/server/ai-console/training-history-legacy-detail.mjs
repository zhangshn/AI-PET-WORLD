import { adaptReadonlyPostReviewHistory } from './readonly-post-review-history.mjs'
import { adaptSystemInterruption } from './training-history-system-interruption.mjs'
import { adaptDryLifecycle } from './training-history-dry-lifecycle.mjs'
import { adaptSpatialAffineSmoke } from './training-history-spatial-affine.mjs'
import { MVP_STAGE0_LIFECYCLE_SCHEMAS, adaptMvpStage0Lifecycle } from './training-history-stage0-lifecycle.mjs'
import { adaptManagedTrainingDetail, adaptManagedParentFailure } from './training-history-managed-detail.mjs'
import { adaptObservationHistory } from './training-observation-history.mjs'
import { adaptSingleMapTraining } from './single-map-training-history.mjs'

export const PACKAGE_KINDS = {
  'ai-painter-decoder-binding-ab-result-v1': ['decoder_binding_ab_0', 'ai-painter-decoder-binding-ab-package-v1', 'decoder_binding_ab'],
  'ai-painter-timestep-ab-result-v1': ['timestep_ab_0', 'ai-painter-timestep-ab-package-v1', 'timestep_ab'],
  'ai-painter-learning-capacity-experiment-terminal-v1': ['experiment_0', null, 'learning_capacity'],
}

export function legacyRunKind(schema) { return schema === 'detail-weight-managed-worker-terminal-v1' ? 'bounded_managed_training' : PACKAGE_KINDS[schema]?.[2] ?? (schema === 'ai-painter-learning-capacity-interrupted-experiment-terminal-v1' ? 'interrupted_experiment' : 'registered_experiment') }

export const LEARNING_PACKAGES = new Set(['ai-painter-learning-capacity-experiment-package-v1', 'ai-painter-decoder-reconstruction-experiment-package-v1', 'ai-painter-v21-train-only-capacity-package-v1'])

// Capability numbers select no behavior: only this unchanged v1 protocol does.
export const DRY_LIFECYCLE = /^ai-painter-mvp256-dry-(v\d+(?:-v\d+)?)-training-lifecycle-v1$/u

// Legacy observation chunks inherit identity ONLY from this verified canonical
// parent. Iterate its bindings, never directories or filename conventions.
export async function failedObservationFragments(request, result, readJson, readEvidenceJson, requireFact) {
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
export function experimentEnvelopeV1(request, result, requireFact, failedClosed = false) {
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

export async function adaptLegacyTrainingDetailCore({ runId, terminal, record, base, capsuleBinding, taskTerminalBinding, readJson, readEvidenceJson, readLargeResultProjection, makeArtifact, checkpointMetadata, requireFact }) {
  const postReview = await adaptReadonlyPostReviewHistory({ runId, terminal, record, base,
    readJson, readEvidenceJson, makeArtifact, checkpointMetadata })
  if (postReview) return postReview
  if (terminal.schemaVersion === 'ai-painter-training-system-interruption-terminal-v1')
    return adaptSystemInterruption({ runId, terminal, record, base, readJson, readEvidenceJson, makeArtifact, requireFact })
  const dryProtocol = DRY_LIFECYCLE.exec(terminal.schemaVersion)
  if (dryProtocol) return adaptDryLifecycle({ family: dryProtocol[1], runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact })
  if (terminal.schemaVersion === 'stage4-full-backbone-spatial-affine-controlled-smoke-terminal-v1') return adaptSpatialAffineSmoke({ runId, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact })
  if (MVP_STAGE0_LIFECYCLE_SCHEMAS.has(terminal.schemaVersion)) return adaptMvpStage0Lifecycle({ runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact })
  const managed = await adaptManagedTrainingDetail({ runId, terminal, record, base, capsuleBinding, taskTerminalBinding,
    readJson, readEvidenceJson, makeArtifact, checkpointMetadata, requireFact })
  if (managed) return managed
  const parentFailure = await adaptManagedParentFailure({ runId, terminal, record, base, readJson, makeArtifact, requireFact })
  if (parentFailure) return parentFailure
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
  if (Object.hasOwn(request,'interfaceContract')) {
    // A declared new observation protocol cannot fall back to a legacy adapter
    // on corruption or an unknown version.
    return adaptObservationHistory({ runId, request, packageBinding, terminal, record, base,
      readJson, readEvidenceJson, makeArtifact, checkpointMetadata })
  }
  if (request.schemaVersion === 'single-map-checkpoint-fit-package-v1' && layout[2] === 'learning_capacity') {
    return adaptSingleMapTraining({ runId, request, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact })
  }
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
