import { previewIdentityHash } from './training-preview-history-v1.mjs'
import { isDeepStrictEqual } from 'node:util'
import { readBoundIndependentTrainingReview } from './training-history-independent-review.mjs'

export const MANAGED_DETAIL_PROTOCOLS = [
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
  {worker:'ecology-terrain-detail-weight-quality-worker-terminal-v1', review:'ecology-terrain-detail-weight-quality-review-terminal-v1',
    plans:new Map([['quality-plan.json','ecology-terrain-detail-weight-quality-plan-v1']]),
    configuration:['ecology-terrain-detail-weight-quality-configuration-v1',
      'ecology-terrain-detail-weight-quality-configuration-v2'], mode:'bounded-quality-training',
    midpointConfiguration:'ecology-terrain-detail-weight-quality-configuration-v2',
    report:'ecology-terrain-detail-weight-quality-native-review-input-v1', adapter:'ecology_terrain_detail_weight_quality_training_v1'},
  {worker:'object-support-structure-quality-worker-terminal-v1', review:'object-support-structure-quality-review-terminal-v1',
    plans:new Map([['quality-plan.json','object-support-structure-quality-plan-v1']]),
    configuration:'object-support-structure-quality-configuration-v1', mode:'bounded-quality-training',
    midpointConfiguration:'object-support-structure-quality-configuration-v1',
    report:'object-support-structure-quality-native-review-input-v1', adapter:'object_support_structure_quality_training_v1',
    audit:'object-support-structure-machine-audit-v1', core:'object-support-structure-machine-audit-core-v1',
    reviewFailure:'object-support-structure-review-failure-v1',
    capture:'object-support-structure-gradient-failure-capture-v1', captureExecution:'object-support-structure-failure-capture-execution-v1',
    gradientLabels:['actualTotal','structuredObjective','wholeFrameFidelity','objectCoreRgb','objectSupportStructure']},
];

export async function readManagedParentFailure({ runId, terminal, terminalBinding, readJson, requireFact }) {
  if (terminal.status !== 'failed_closed' || terminal.executionState !== 'failed_closed'
    || !['training', 'qualification', 'gpu_qualification'].includes(terminal.phase)
    || terminal.schema || terminal.schemaVersion) return null
  requireFact(terminal.runId === runId && typeof terminal.packageId === 'string'
    && typeof terminal.capabilityVersion === 'string'
    && terminal.executionPackage && /^[a-f0-9]{64}$/u.test(terminal.executionPackage.sha256), 'history_parent_failure_identity_conflict')
  const pkg = await readJson(terminal.executionPackage)
  requireFact(pkg.schemaVersion === 'ai-painter-autonomous-closed-loop-package-v1'
    && pkg.packageIdentity === terminal.packageId && pkg.capabilityVersion === terminal.capabilityVersion
    && typeof pkg.outputRoot === 'string' && pkg.outputRoot.startsWith('.runtime/ai-painter/')
    && !pkg.outputRoot.includes('\\') && pkg.outputRoot.split('/').every(part => part && part !== '.' && part !== '..')
    && terminalBinding.path.startsWith(`${pkg.outputRoot}/`)
    && Array.isArray(pkg.inputEvidence) && pkg.inputEvidence.length <= 128, 'history_parent_failure_package_conflict')
  const plans = pkg.inputEvidence.filter(item => item?.path === `${pkg.outputRoot}/quality-plan.json`)
  requireFact(plans.length === 1 && /^[a-f0-9]{64}$/u.test(plans[0].sha256), 'history_parent_failure_plan_conflict')
  const plan = await readJson(plans[0])
  requireFact(plan.runId === runId && plan.packageId === terminal.packageId
    && plan.capabilityVersion === terminal.capabilityVersion && plan.outputRoot === pkg.outputRoot
    && plan.configuration?.capabilityVersion === terminal.capabilityVersion, 'history_parent_failure_plan_conflict')
  const protocol = MANAGED_DETAIL_PROTOCOLS.find(item => item.plans.get('quality-plan.json') === plan.schema
    && [item.configuration].flat().includes(plan.configuration?.schema) && item.mode === plan.executionMode)
  if (!protocol) return null
  return { pkg, plan, planBinding: plans[0], protocol }
}

export async function adaptManagedParentFailure(options) {
  const { runId, terminal, record, base, readJson, requireFact, makeArtifact } = options
  const context = await readManagedParentFailure({ runId, terminal, terminalBinding: record.terminalBinding, readJson, requireFact })
  if (!context) return null
  let workerAvailability = 'not_recorded'
  if (terminal.workerTerminal) {
    requireFact(typeof terminal.workerTerminal.path === 'string'
      && terminal.workerTerminal.path.startsWith(`${context.pkg.outputRoot}/`)
      && /^[a-f0-9]{64}$/u.test(terminal.workerTerminal.sha256), 'history_parent_failure_worker_conflict')
    try { await readJson(terminal.workerTerminal); return null }
    catch (error) {
      if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error
      workerAvailability = error.code === 'ENOENT' ? 'missing' : 'unreadable'
    }
  }
  const config = context.plan.configuration, ceiling = config.executionCeiling, resolution = config.scope?.resolution
  requireFact(Array.isArray(resolution) && resolution.length === 2 && resolution.every(value => Number.isSafeInteger(value) && value > 0)
    && ceiling && ['epochs', 'generatorOptimizerSteps', 'discriminatorOptimizerSteps']
      .every(key => Number.isSafeInteger(ceiling[key]) && ceiling[key] > 0), 'history_parent_failure_plan_conflict')
  const count = (value, maximum) => {
    requireFact(value == null || Number.isSafeInteger(value) && value >= 0 && value <= maximum, 'history_parent_failure_count_conflict')
    return value ?? null
  }
  record.runKind = terminal.phase === 'training' ? 'bounded_managed_training' : 'bounded_gpu_qualification'
  record.resolution = { width: resolution[0], height: resolution[1] }
  record.trainingPlan = { ...ceiling, checkpointSelection: config.checkpointSelection ?? null }
  record.targetEpochs = ceiling.epochs
  record.targetOptimizerSteps = ceiling.generatorOptimizerSteps
  record.targetDiscriminatorOptimizerSteps = ceiling.discriminatorOptimizerSteps
  record.optimizerSteps = { generator: terminal.phase === 'training' ? count(terminal.optimizerStepsGenerator, ceiling.generatorOptimizerSteps) : null,
    discriminator: terminal.phase === 'training' ? count(terminal.optimizerStepsDiscriminator, ceiling.discriminatorOptimizerSteps) : null }
  record.completedEpochs = terminal.phase === 'training' ? count(terminal.completedEpochs, ceiling.epochs) : null
  record.trainingStatus = terminal.phase === 'training' ? 'failed_closed' : null
  record.trainingExecutionState = terminal.phase === 'training' ? 'failed_closed' : null
  record.failureSummary = terminal.originalError ?? (terminal.error === 'Error: wall_timeout' ? { type: 'Error', message: 'wall_timeout' } : null)
  record.qualification = { ...record.qualification, formalQualificationAllowed: false, worldEntryAllowed: false,
    checkpointPromotionEligible: false, checkpointReloadVerified: null }
  for (const [bound, evidenceKind] of [[terminal.executionPackage, 'autonomousExecutionPackage'], [context.planBinding, 'managedPlan']]) {
    record.artifacts.push(makeArtifact('evidence', bound, { evidenceKind }))
  }
  base.unavailableFields = [...new Set([...base.unavailableFields.filter(field => field !== 'resolution'),
    'workerTerminal', 'samples', 'metrics', 'checkpoints', 'logs',
    ...(record.completedEpochs === null ? ['completedEpochs'] : []),
    ...(Object.values(record.optimizerSteps).some(value => value === null) ? ['optimizerSteps'] : [])])]
  record.detailCoverage = { adapter: 'managed_parent_execution_failure', supported: true,
    sourcePolicy: 'verified_registry_explicit_sha256_parents_only', phase: terminal.phase,
    workerTerminal: workerAvailability, finalCounters: 'terminal_fields_only_not_last_progress', checkpointBytesRead: false,
    availability: { managedPlan: 'available', workerTerminal: workerAvailability, checkpoints: 'not_recorded' },
    trainingPreview: { status: 'unavailable', reasonCode: 'history_parent_failure_artifacts_not_bound', verifiedCount: 0, gaps: [] },
    artifactSourceGap: '缺少受信终态清单，当前接口未接入；不能据此判定未训练、未生成或未保存。' }
  return { ...base, schemaVersion: 'ai_console_training_run_detail_v1', record, dataStatus: 'partial',
    reasonCode: 'history_managed_parent_failure_worker_missing' }
}

export async function adaptManagedTrainingDetail({ runId, terminal, record, base, capsuleBinding, taskTerminalBinding,
  readJson, readEvidenceJson, makeArtifact, checkpointMetadata, requireFact }) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  const count = v => Number.isSafeInteger(v) && v >= 0
  const text = v => typeof v === 'string' && v.length > 0 && v.length <= 192
  const reviewProtocol = value => MANAGED_DETAIL_PROTOCOLS.find(p => [p.review, p.reviewFailure]
    .some(schema => schema && (value?.schema ?? value?.schemaVersion) === schema))
  let protocol = MANAGED_DETAIL_PROTOCOLS.find(p => terminal.schema === p.worker)
    ?? reviewProtocol(terminal) ?? MANAGED_DETAIL_PROTOCOLS[0]
  let schema = protocol.worker
  const isReviewWrapper = value => reviewProtocol(value) === protocol
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
    binding(bound); requireFact(reads < limits.jsonReads, 'history_managed_read_limit', 413); reads++
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
    if (!reviewProtocol(wrapper)) {
      protocol = MANAGED_DETAIL_PROTOCOLS.find(p => worker.schema === p.worker) ?? protocol
      schema = protocol.worker
    }
    if (isReviewWrapper(wrapper)) requireFact(worker.schema === schema, 'history_managed_worker_schema_conflict')
    if (worker.schema !== schema) return null
    requireFact(!['qualification', 'gpu_qualification'].includes(wrapper.phase), 'history_managed_parent_phase_conflict')
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
  if (protocol.configuration) requireFact([protocol.configuration].flat().includes(plan.configuration.schema)
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
  // These two registered quality protocols also persist an unversioned midpoint
  // record. Its exact shape and signed plan select semantics, never its filename.
  // It has no checkpoint/image role and cannot supply selectedEpoch or a review.
  let midpointMetricsAvailable = false
  if (worker.epochObservations !== undefined && !(Array.isArray(worker.epochObservations) && worker.epochObservations.length === 0)) {
    const field = 'epochObservations'
    try {
      requireFact(Boolean(protocol.midpointConfiguration) && config.schema === protocol.midpointConfiguration,
        'history_managed_midpoint_schema_unsupported')
      requireFact(Array.isArray(selection.observationOnlyEpochs) && selection.observationOnlyEpochs.length === 1
        && selection.observationOnlyEpochs[0] === 12 && selection.eligibleEpochs.length === 1 && selection.eligibleEpochs[0] === 24
        && selection.validationRowsPerEligibleEpoch === 8 && ceiling.epochs === 24
        && ceiling.generatorOptimizerSteps === 1152 && ceiling.discriminatorOptimizerSteps === 1152,
      'history_managed_midpoint_plan_conflict')
      requireFact(Array.isArray(worker.epochObservations), 'history_managed_midpoint_schema_unsupported')
      requireFact(worker.epochObservations.length <= selection.observationOnlyEpochs.length,
        'history_managed_midpoint_limit', 413)
      const entries = worker.epochObservations
      const keys = ['runId', 'packageId', 'capabilityVersion', 'modelCapabilityVersion', 'executionPackage',
        'planBinding', 'modelBinding', 'datasetManifest', 'configurationSha256', 'epoch', 'optimizerSteps',
        'checkpointSelectionEligible', 'weightUpdates', 'validation', 'metrics']
      const exactKeys = (value, expected) => object(value) && Object.keys(value).length === expected.length
        && expected.every(key => Object.hasOwn(value, key))
      const channels = ['object_footprints', 'object_tree', 'object_rock', 'object_vegetation']
      const finite = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high
      for (const entry of entries) {
        requireFact(exactKeys(entry, [...keys, ...(Object.hasOwn(entry ?? {}, 'artifact') ? ['artifact'] : [])]),
          'history_managed_midpoint_schema_unsupported')
        for (const key of ['executionPackage', 'planBinding', 'modelBinding', 'datasetManifest',
          ...(Object.hasOwn(entry, 'artifact') ? ['artifact'] : [])])
          requireFact(exactKeys(entry[key], ['path', 'sha256']), 'history_managed_midpoint_schema_unsupported')
        identity(entry); same(entry.executionPackage, worker.executionPackage); same(entry.planBinding, plans[0])
        same(entry.modelBinding, plan.modelBinding); same(entry.datasetManifest, plan.datasetManifest)
        own(entry.modelBinding)
        requireFact(entry.epoch === 12 && count(record.completedEpochs) && entry.epoch <= record.completedEpochs
          && entry.checkpointSelectionEligible === false && entry.weightUpdates === 0
          && exactKeys(entry.optimizerSteps, ['generator', 'discriminator'])
          && entry.optimizerSteps.generator === 576 && entry.optimizerSteps.discriminator === 576
          && count(g) && count(d) && entry.optimizerSteps.generator <= g && entry.optimizerSteps.discriminator <= d
          && text(config.modelCapabilityVersion) && entry.modelCapabilityVersion === config.modelCapabilityVersion
          && entry.configurationSha256 === previewIdentityHash(config), 'history_managed_midpoint_identity_conflict')
        requireFact(Array.isArray(entry.validation) && entry.validation.length <= selection.validationRowsPerEligibleEpoch,
          'history_managed_midpoint_limit', 413)
        requireFact(entry.validation.length === selection.validationRowsPerEligibleEpoch,
          'history_managed_midpoint_schema_unsupported')
      }
      // Only explicit JSON metadata parents; no weights, RGB or data discovery.
      for (const bound of [plan.modelBinding, plan.datasetManifest, plan.validationSplit]) {
        binding(bound)
        const matches = autonomous.inputEvidence.filter(input => input?.path === bound.path)
        requireFact(matches.length === 1, 'history_managed_midpoint_parent_conflict'); same(matches[0], bound)
      }
      const model = await read(plan.modelBinding, field)
      const split = model ? await read(plan.validationSplit, field) : null
      if (model && split) {
        requireFact(model.capabilityVersion === worker.capabilityVersion && model.modelCapabilityVersion === config.modelCapabilityVersion,
          'history_managed_midpoint_identity_conflict')
        requireFact(split.schemaVersion === 'ai-painter-stage4-v2-mvp64-fresh-lineage-dataset-release-v1:membership'
          && split.split === 'validation' && Array.isArray(split.sampleIds)
          && split.sampleIds.length === selection.validationRowsPerEligibleEpoch && split.sampleIds.every(text)
          && new Set(split.sampleIds).size === split.sampleIds.length, 'history_managed_midpoint_schema_unsupported')
        for (const entry of entries) {
          const coverage = Object.fromEntries(channels.map(channel => [channel, 0])), correlations = []
          let mae = 0
          for (const [index, row] of entry.validation.entries()) {
            requireFact(exactKeys(row, ['sampleId', 'split', 'epoch', 'fullRgbMae', 'objectCorrelations'])
              && row.sampleId === split.sampleIds[index] && row.split === 'validation' && row.epoch === entry.epoch
              && finite(row.fullRgbMae, 0, 1) && exactKeys(row.objectCorrelations, channels),
            'history_managed_midpoint_schema_unsupported')
            mae += row.fullRgbMae
            for (const channel of channels) {
              const value = row.objectCorrelations[channel]
              requireFact(value === null || finite(value, -1, 1), 'history_managed_midpoint_schema_unsupported')
              if (value !== null) { coverage[channel]++; correlations.push(value) }
            }
          }
          const metrics = entry.metrics
          requireFact(exactKeys(metrics, ['epoch', 'worstApplicableObjectCorrelation', 'meanValidationRgbMae',
            'applicableImageCounts', 'rank', 'qualificationGranted', 'checkpointPromotionEligible'])
            && metrics.epoch === entry.epoch && metrics.qualificationGranted === false && metrics.checkpointPromotionEligible === false
            && channels.every(channel => coverage[channel] > 0) && isDeepStrictEqual(metrics.applicableImageCounts, coverage)
            && metrics.worstApplicableObjectCorrelation === Math.min(...correlations)
            && metrics.meanValidationRgbMae === mae / entry.validation.length
            && isDeepStrictEqual(metrics.rank, [metrics.worstApplicableObjectCorrelation, -metrics.meanValidationRgbMae, -entry.epoch]),
          'history_managed_midpoint_schema_unsupported')
          // A failed atomic observation publication may leave only the immutable
          // worker's inline record. Project that source honestly; invent no file.
          let source = workerBinding
          if (Object.hasOwn(entry, 'artifact')) {
            own(entry.artifact)
            const saved = await read(entry.artifact, field)
            if (!saved) continue
            requireFact(exactKeys(saved, keys), 'history_managed_midpoint_schema_unsupported')
            const expected = { ...entry }; delete expected.artifact
            requireFact(isDeepStrictEqual(saved, expected), 'history_managed_midpoint_content_conflict')
            source = entry.artifact
          }
          requireFact(record.metrics.length + entry.validation.length + 1 <= limits.metrics, 'history_managed_metric_limit', 413)
          const metadata = { source: 'managed_midpoint_observation', epoch: entry.epoch, optimizerStep: entry.optimizerSteps.generator,
            sourcePath: source.path, sourceSha256: source.sha256 }
          const measurements = value => ({ ...value, checkpointSelectionEligible: false, weightUpdates: 0 })
          append('evidence', source, { evidenceKind: 'managed_midpoint_observation', epoch: entry.epoch,
            sourceLabel: '第12轮中期验证观察（非Checkpoint选择／最终审核）', verificationStatus: 'bytes_verified' })
          for (const row of entry.validation) {
            record.metrics.push({ ...metadata, sampleId: row.sampleId, split: row.split, measurements: measurements(row) })
          }
          record.metrics.push({ ...metadata, measurements: measurements(metrics) })
          midpointMetricsAvailable = true
        }
      }
    } catch (error) {
      // Optional observation gaps never erase an authenticated failure or final
      // checkpoint. Conflicting data are withheld, never read from another Run.
      if (!error.message?.startsWith('history_') && !['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error
      gap(field, error.status === 413 ? 'over_limit' : error.code === 'ENOENT' ? 'missing'
        : error.message === 'history_sha_mismatch' ? 'hash_conflict'
          : error.message === 'history_json_invalid' || error.message.endsWith('schema_unsupported') ? 'unsupported_schema' : 'unreadable')
    }
  }
  if (!sampleIds.size && !midpointMetricsAvailable) gap('validationMetrics', availability.epochObservations ?? 'not_recorded')
  else { removeUnavailable('metrics', 'validationMetrics'); availability.validationMetrics = 'available' }
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
    binding(taskTerminalBinding); taskTerminal = await read(taskTerminalBinding, 'taskTerminal')
    if (taskTerminal) { requireFact(taskTerminal.runId === runId, 'history_managed_identity_conflict'); same(taskTerminal.executionPackage, worker.executionPackage) }
    if (taskTerminal?.schema === 'completed-training-independent-review-v1') {
      let review
      try {
        review = await readBoundIndependentTrainingReview({ terminal: taskTerminal, terminalBinding: taskTerminalBinding,
          runId, workerBinding, readJson: bound => read(bound, 'independentReview') })
      } catch (error) {
        if (error.message !== 'history_independent_review_evidence_unavailable') throw error
        gap('machineReview', availability.independentReview ?? 'unreadable')
        return finish()
      }
      record.reviewExecutionState = taskTerminal.executionState
      record.reviewStatus = review.core.status
      record.independentReviewStatus = review.core.status
      record.reviewStatusSource = taskTerminal.core.path
      record.qualification.independentReviewStatus = review.core.status
      append('evidence', taskTerminalBinding, { evidenceKind: 'managedReviewTerminal' })
      append('evidence', taskTerminal.reviewRecoveryPlan, { evidenceKind: 'reviewRecoveryPlan' })
      append('evidence', taskTerminal.core, { evidenceKind: 'machineReview' })
      append('evidence', review.core.input, { evidenceKind: 'nativeReviewReport' })
      record.metrics.push({ source: 'managed_machine_review', measurements: {
        status: review.core.status, issueCodes: review.core.issueCodes, detail: review.core.detail,
        aesthetic: review.core.aesthetic, alignment: review.core.alignment,
        validationImprovedWithoutMeanRgbRegression: review.core.validationImprovedWithoutMeanRgbRegression },
      sourcePath: taskTerminal.core.path, sourceSha256: taskTerminal.core.sha256 })
      for (const image of review.core.validationImages) {
        const metadata = { sampleId: image.sampleId, split: image.split, epoch: image.epoch,
          optimizerStep: image.optimizerStep, purpose: image.purpose, formalQualification: false }
        const output = append('output', image.binding, metadata)
        const original = append('original', image.originalRgb, { ...metadata, purpose: 'reference', sourceRole: 'source_reference_rgb' })
        const condition = append('condition', image.condition, metadata)
        record.samples.push({ sampleId: image.sampleId, split: image.split, output, original: null, sourceOriginal: original, condition })
      }
      availability.machineReview = 'available'; availability.validationImages = 'available'; availability.samples = 'available'
      removeUnavailable('samples', 'machineReview', 'validationImages')
      return finish()
    }
    own(taskTerminalBinding)
  }
  const preciseReview = isReviewWrapper(taskTerminal)
  if (preciseReview) {
    verifyReviewWrapper(taskTerminal)
    record.reviewExecutionState = taskTerminal.executionState
    record.reviewStatus = null
    append('evidence', taskTerminalBinding ?? record.terminalBinding, { evidenceKind: 'managedReviewTerminal' })
    const directFailure = protocol.reviewFailure && (taskTerminal.schema ?? taskTerminal.schemaVersion) === protocol.reviewFailure
    const failureBinding = directFailure ? taskTerminalBinding ?? record.terminalBinding : taskTerminal.reviewFailure
    if (failureBinding) {
      own(failureBinding)
      const failure = directFailure ? taskTerminal : await read(failureBinding, 'reviewFailure')
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
        // This protocol persists the first raw error without classifying it.
        // Missing classifications stay null in the existing API fields.
        const rawFailure = protocol.reviewFailure && (failure.schema ?? failure.schemaVersion) === protocol.reviewFailure
        if (protocol.reviewFailure && !autonomousFailure)
          requireFact(rawFailure, 'history_managed_review_failure_schema_conflict')
        requireFact(object(result) && (!autonomousFailure || result.status === 'failed')
          && (rawFailure || ['program', 'infrastructure'].includes(result.failureKind)
            && typeof result.failureCode === 'string' && result.failureCode.length > 0)
          && typeof (result.detail ?? result.error) === 'string' && (result.detail ?? result.error).length > 0,
        'history_managed_review_failure_conflict')
        if (autonomousFailure) requireFact(failure.failureCode === result.failureCode, 'history_managed_review_failure_conflict')
        record.reviewStatus = 'review_execution_failed_closed'
        record.failureSummary = { phase: 'review', status: record.reviewStatus, failureKind: result.failureKind ?? null,
          failureCode: result.failureCode ?? null, detail: result.detail ?? result.error,
          sourcePath: failureBinding.path, sourceSha256: failureBinding.sha256 }
        requireFact(record.metrics.length < limits.metrics, 'history_managed_metric_limit', 413)
        record.metrics.push({ source: 'managed_review_execution_failure', measurements: {
          phase: 'review', status: record.reviewStatus, failureKind: result.failureKind ?? null,
          failureCode: result.failureCode ?? null, detail: result.detail ?? result.error },
          sourcePath: failureBinding.path, sourceSha256: failureBinding.sha256 })
        append('evidence', failureBinding, { evidenceKind: 'reviewFailure' })
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
    let measurements = audit, measurementsBinding = auditBinding
    if (protocol.audit) {
      requireFact((audit.schema ?? audit.schemaVersion) === protocol.audit, 'history_managed_audit_schema_conflict')
      own(audit.core)
      const core = await read(audit.core, 'machineReview')
      if (core) {
        requireFact((core.schema ?? core.schemaVersion) === protocol.core, 'history_managed_audit_schema_conflict')
        identity(core); identity(audit)
        for (const key of ['executionPackage', 'input', 'selectedCheckpoint']) same(core[key], audit[key])
        requireFact(core.status === audit.status, 'history_managed_review_status_conflict')
        measurements = core
        measurementsBinding = audit.core
        append('evidence', audit.core, { evidenceKind: 'machineReview' })
      }
    }
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
        detail: measurements.detail ?? null, aesthetic: measurements.aesthetic ?? null, alignment: measurements.alignment ?? null,
        issueCodes: measurements.issueCodes ?? [], validationImprovedWithoutMeanRgbRegression: measurements.validationImprovedWithoutMeanRgbRegression ?? null },
        sourcePath: measurementsBinding.path, sourceSha256: measurementsBinding.sha256 })
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
      const captureSchema = protocol.capture ?? 'ecology-regime-gradient-failure-capture-v1', receipt = worker.captureReceipt
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
      if (protocol.gradientLabels) requireFact(Array.isArray(manifest.labels)
        && manifest.labels.length === protocol.gradientLabels.length
        && manifest.labels.every((label, index) => label === protocol.gradientLabels[index]),
      'history_managed_capture_schema_unsupported')
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
      requireFact(execution.schema === (protocol.captureExecution ?? 'ecology-regime-failure-capture-execution-v1')
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
