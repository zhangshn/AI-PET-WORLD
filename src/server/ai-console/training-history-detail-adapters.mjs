// Legacy layouts are enabled by explicit package/result discriminants. File
// extensions classify already-bound artifacts; names never invent relationships.
const PACKAGE_KINDS = {
  'ai-painter-decoder-binding-ab-result-v1': ['decoder_binding_ab_0', 'ai-painter-decoder-binding-ab-package-v1', 'decoder_binding_ab'],
  'ai-painter-timestep-ab-result-v1': ['timestep_ab_0', 'ai-painter-timestep-ab-package-v1', 'timestep_ab'],
  'ai-painter-learning-capacity-experiment-terminal-v1': ['experiment_0', null, 'learning_capacity'],
}
export function legacyRunKind(schema) { return PACKAGE_KINDS[schema]?.[2] ?? (schema === 'ai-painter-learning-capacity-interrupted-experiment-terminal-v1' ? 'interrupted_experiment' : 'registered_experiment') }
const LEARNING_PACKAGES = new Set(['ai-painter-learning-capacity-experiment-package-v1', 'ai-painter-decoder-reconstruction-experiment-package-v1'])
export async function adaptLegacyTrainingDetail({ runId, terminal, record, base, capsuleBinding, readJson, makeArtifact, checkpointMetadata, requireFact }) {
  if (terminal.schemaVersion === 'stage4-full-backbone-spatial-affine-controlled-smoke-terminal-v1') return adaptSpatialAffineSmoke({ runId, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact })
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
  requireFact(layout[1] ? request.schemaVersion === layout[1] : LEARNING_PACKAGES.has(request.schemaVersion), 'history_package_schema_conflict')
  record.artifacts.push(makeArtifact('request', packageBinding))
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
      missing('samples', 'metrics', 'checkpoints')
      record.detailCoverage.resultByteLimit = 8388608
      return finish('history_detail_evidence_exceeds_limit')
    }
    requireFact((result.runId ?? result.experimentIdentity) === runId, 'history_result_run_conflict')
    requireFact(result.schemaVersion === undefined || result.schemaVersion === 'ai-painter-learning-capacity-experiment-result-v1', 'history_legacy_result_schema_conflict')
  }
  const failedBeforeArtifacts = result.status === 'experiment_failed_closed' && result.executionState === 'failed_closed' && result.artifacts === undefined
  requireFact(Array.isArray(request.selectedRows) && request.selectedRows.length <= 128 && ((Array.isArray(result.artifacts) && result.artifacts.length <= 1024) || failedBeforeArtifacts), 'history_legacy_shape_conflict')
  record.resolution = request.resolution ?? request.training?.resolution ?? null
  record.optimizerSteps = result.optimizerSteps ?? terminal.optimizerSteps ?? null
  record.qualification = result.qualification ?? record.qualification
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
      record.artifacts.push(makeArtifact('image', binding, { associationStatus: 'purpose_sample_arm_seed_not_explicitly_bound' }))
      missing('output.sample_arm_seed_association')
    } else if (['pt', 'pth'].includes(extension)) {
      const arm = armCheckpoints.get(binding.path)
      if (arm) requireFact(arm.checkpoint.sha256 === binding.sha256, 'history_checkpoint_binding_conflict')
      const cp = await checkpointMetadata(makeArtifact('checkpoint', binding, { arm: arm?.arm ?? null, optimizerSteps: arm?.optimizerSteps ?? null }))
      record.artifacts.push(cp); record.checkpoints.push(cp)
    } else if (extension === 'json') record.artifacts.push(makeArtifact('evidence', binding))
    else missing(`artifact.unsupported_type:${binding.path}`)
  }
  const rows = result.rows ?? result.fullGeneratedRows ?? []
  requireFact(Array.isArray(rows) && rows.length <= 1024, 'history_metrics_limit')
  for (const row of rows) {
    requireFact(samples.has(row.sampleId) && samples.get(row.sampleId).split === row.split, 'history_sample_binding_conflict')
    record.metrics.push({ sampleId: row.sampleId, split: row.split, arm: row.arm ?? null, seed: row.seed ?? null, measurements: row.measurements ?? row, baseline: row.baseline ?? null })
  }
  for (const field of ['epochMetrics', 'trainOnlyBaselineMetrics', 'trainOnlyFinalMetrics', 'fixedTrainOnlyObservations', 'observations', 'perStepReconstructionLoss', 'perStepHeadDependentObjective']) {
    if (result[field] !== undefined) record.metrics.push({ sourceField: field, measurements: result[field] })
  }
  if (!record.metrics.length) missing('metrics')
  if (!record.checkpoints.length) missing('checkpoints')
  // The old result lists files without a sample/arm/seed map. The files remain
  // visible and verifiable, but must never be paired by filename conventions.
  return finish(failedBeforeArtifacts ? 'history_failed_before_artifact_registration' : base.unavailableFields.includes('output.sample_arm_seed_association') ? 'history_output_association_not_recorded' : null)
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
