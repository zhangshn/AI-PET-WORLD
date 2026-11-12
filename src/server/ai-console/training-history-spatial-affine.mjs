

// This adapter follows only explicit, hash-bound parents. It deliberately has
// no filesystem access, history discovery, new index or filename inference.
export async function adaptSpatialAffineSmoke({ runId, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact }) {
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
