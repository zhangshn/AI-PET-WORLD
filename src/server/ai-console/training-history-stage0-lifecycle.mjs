

export const MVP_STAGE0_LIFECYCLE_SCHEMAS = new Set([
  'ai-painter-stage4-mvp-stage0-training-lifecycle-v1',
  'ai-painter-stage4-mvp-denoiser-stage0-lifecycle-v1',
  'ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-lifecycle-v1',
])

export const MVP_STAGE0_PHASE_SCHEMAS = new Map([
  ['ai-painter-stage4-mvp-stage0-training-lifecycle-v1', 'ai-painter-stage4-mvp-stage0-training-terminal-v1'],
  ['ai-painter-stage4-mvp-denoiser-stage0-lifecycle-v1', 'ai-painter-stage4-mvp-denoiser-stage0-terminal-v1'],
  ['ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-lifecycle-v1', 'ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-terminal-v1'],
])

// Stage0 training and its later machine review are separate immutable
// terminals. This adapter joins them only through bindings carried by the
// verified registry chain and checks every parent identity and hash binding.
// It never discovers review files by directory or filename convention.
export async function adaptMvpStage0Lifecycle({ runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact }) {
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
