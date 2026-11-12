import { MANAGED_DETAIL_PROTOCOLS } from './training-history-managed-detail.mjs'

// Stable managed protocol, not a Run/model-version switch. Only authenticated
// parent bindings are followed; no deterministic filename is a discovery path.
export async function adaptSystemInterruption({ runId, terminal, record, base, readJson, readEvidenceJson, makeArtifact, requireFact }) {
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
    && [protocol.configuration].flat().includes(plan.configuration?.schema) && plan.outputRoot === pkg.outputRoot
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
