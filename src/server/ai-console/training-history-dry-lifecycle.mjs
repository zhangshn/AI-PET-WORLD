

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

export async function adaptDryLifecycle({ family, runId, terminal, record, base, taskTerminalBinding, readJson, makeArtifact, checkpointMetadata, requireFact }) {
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
