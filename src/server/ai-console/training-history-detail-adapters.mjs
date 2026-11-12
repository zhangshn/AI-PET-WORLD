import { adaptLegacyTrainingDetailCore } from './training-history-legacy-detail.mjs'
import { readCompletionTrainingObservation } from './training-history-completion-observation.mjs'
import { MANAGED_DETAIL_PROTOCOLS } from './training-history-managed-detail.mjs'
import { readTrustedTrainingPreviewProgress, readTrainingPreviewHistory } from './training-preview-history-v1.mjs'
import { CURRENT_EXECUTION_REGISTRY_PATH, readCurrentExecutionRegistry } from '../ai-painter-current-execution-registry.mjs'
import { readBoundTrainingPresentation } from './bound-training-presentation.mjs'
import { bytes as readPreviewBytes } from './training-history-safe-bytes.mjs'

export async function adaptLegacyTrainingDetail(options) {
  const detail = await adaptLegacyTrainingDetailCore(options)
  if (['training_observation_v1', 'readonly_post_review_v1'].includes(detail.record.detailCoverage?.adapter)) return detail
  const { runId, terminal, readJson, makeArtifact } = options
  const root = process.env.AI_CONSOLE_HISTORY_ROOT || process.cwd()
  const completion = await readCompletionTrainingObservation(root, terminal)
  if (completion) {
    // Keep legacy start/finish fields and their scope unchanged.
    detail.record.workerExecutionTiming = completion.workerExecutionTiming
    detail.record.trainingPlan = { ...detail.record.trainingPlan,
      trainingWallMode: completion.trainingWallMode, maxWallSeconds: completion.maxWallSeconds }
    const timing = completion.workerExecutionTiming
    if (timing.availability === 'available') detail.record.artifacts.push(makeArtifact('evidence',
      { path: timing.sourcePath, sha256: timing.sourceSha256 }, { evidenceKind: 'workerExecutionTiming' }))
    else detail.unavailableFields = [...new Set([...(detail.unavailableFields ?? []), 'workerExecutionTiming'])]
  }
  let parent = terminal, protocol, progress = null, progressVerified = false
  try {
    if (terminal.workerTerminal && terminal.executionPackage) parent = await readJson(terminal.workerTerminal)
    protocol = MANAGED_DETAIL_PROTOCOLS.find(item => parent?.schema === item.worker)
    if (parent?.trainingPreviewManifest && terminal.trainingPreviewManifest)
      options.requireFact(parent.trainingPreviewManifest.path === terminal.trainingPreviewManifest.path
        && parent.trainingPreviewManifest.sha256 === terminal.trainingPreviewManifest.sha256, 'training_preview_manifest_binding_conflict')
    const manifestBinding = parent?.trainingPreviewManifest ?? terminal.trainingPreviewManifest
    if (!manifestBinding) {
      if (protocol || ['training_pending', 'qualification_pending'].includes(parent?.status))
        detail.record.detailCoverage = { ...detail.record.detailCoverage,
          trainingPreview: { status: 'not_recorded', reasonCode: 'unregistered_source', verifiedCount: 0, gaps: [] } }
      if (!['training_pending', 'qualification_pending'].includes(parent?.status)) return detail
    }
    if (!manifestBinding) {
      // A history request cannot certify activity. Reuse the original registry
      // verifier and bound-progress validator; never scan a progress directory.
      progress = await readTrustedTrainingPreviewProgress({ runId, readJson, currentPath: CURRENT_EXECUTION_REGISTRY_PATH,
        readRegistry: () => readCurrentExecutionRegistry(root), readPresentation: current =>
          readBoundTrainingPresentation(root, current.registry, current.taskCapsule, current.currentTaskTerminal) })
      if (!progress?.latestTrainingPreview) return detail
      progressVerified = true
      // The plan protocol, not a model name/Run suffix, selects its semantics.
      const envelope = await readJson(parent.executionPackage)
      const plans = envelope.inputEvidence?.filter(item => item?.path === `${envelope.outputRoot}/quality-plan.json`) ?? []
      if (plans.length !== 1) throw new Error('training_preview_plan_unavailable')
      const plan = await readJson(plans[0])
      protocol = MANAGED_DETAIL_PROTOCOLS.find(item => item.plans.get('quality-plan.json') === plan.schema
        && [item.configuration].flat().includes(plan.configuration?.schema))
    }
    const report = await readTrainingPreviewHistory({ parent, manifestBinding,
      progress, progressVerified, planSchemas: [...(protocol?.plans.values() ?? [])],
      configurationSchemas: [protocol?.configuration].flat().filter(Boolean),
      ...options.previewReadOptions,
      readBytes: async (bound, maximum) => (await readPreviewBytes(root, bound.path, maximum, bound.sha256)).value })
    for (const image of report.images) {
      const prior = detail.record.artifacts.find(item => item.role === 'image' && item.logicalPath === image.binding.path && item.sha256 === image.binding.sha256)
      if (prior) { Object.assign(prior, image.metadata); delete prior.passed }
      else detail.record.artifacts.push(makeArtifact('image', image.binding, image.metadata))
    }
    const coverage = { ...report }; delete coverage.images
    detail.record.detailCoverage = { ...detail.record.detailCoverage, trainingPreview: coverage }
    if (report.images.length && ['training_pending', 'qualification_pending'].includes(parent.status))
      detail.reasonCode = 'history_training_preview_observation_only'
    if (report.gaps.length) { detail.dataStatus = 'partial'; detail.unavailableFields = [...new Set([...(detail.unavailableFields ?? []), 'trainingPreview'])] }
  } catch {
    // One failed/missing preview must not hide independently verified history,
    // failure evidence, checkpoints or prior successful images.
    detail.record.detailCoverage = { ...detail.record.detailCoverage,
      trainingPreview: { status: 'unavailable', verifiedCount: 0, gaps: [{ reasonCode: 'training_preview_source_unavailable' }] } }
    detail.dataStatus = 'partial'
  }
  return detail
}

export { readBoundIndependentTrainingReview } from './training-history-independent-review.mjs'
export { readCompletionTrainingObservation } from './training-history-completion-observation.mjs'
export { legacyRunKind } from './training-history-legacy-detail.mjs'
export { adaptManagedTrainingDetail } from './training-history-managed-detail.mjs'
export { DRY_RECOVERY_CANDIDATE_SCHEMA } from './training-history-dry-lifecycle.mjs'
export { readDryRecoveryCandidate } from './training-history-dry-lifecycle.mjs'
