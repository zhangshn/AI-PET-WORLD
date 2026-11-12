import { HistoryError } from './training-history-safe-bytes.mjs'
import { isDeepStrictEqual } from 'node:util'

// Only callers holding a registry/event-verified task-terminal binding may use
// this adapter. The independent review owns a separate, plan-bound root; this
// does not extend any existing training-root or arbitrary artifact permission.
/** @param {{terminal: any, terminalBinding: {path: string, sha256: string}, runId: string,
 * workerBinding?: {path: string, sha256: string} | null,
 * readJson: (binding: {path: string, sha256: string}, maximumBytes: number) => Promise<any>}} options */
export async function readBoundIndependentTrainingReview({ terminal, terminalBinding, runId, workerBinding = null, readJson }) {
  if (terminal?.schema !== 'completed-training-independent-review-v1') return null
  const need = (ok, suffix) => { if (!ok) throw new HistoryError(`history_independent_review_${suffix}`) }
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  const bound = value => {
    need(object(value) && typeof value.path === 'string' && /^[a-f0-9]{64}$/u.test(value.sha256)
      && !/^(?:[A-Za-z]:|\/)/u.test(value.path) && !value.path.includes('\\')
      && value.path.split('/').every(part => part && part !== '.' && part !== '..'), 'binding_invalid')
  }
  const same = (a, b) => { bound(a); bound(b); need(a.path === b.path && a.sha256 === b.sha256, 'parent_conflict') }
  let reads = 0
  const read = async binding => {
    bound(binding); need(++reads <= 10, 'read_limit')
    const value = await readJson(binding, 2 * 1024 * 1024)
    need(value !== null, 'evidence_unavailable')
    return value
  }
  bound(terminalBinding)
  need(terminal.runId === runId && typeof terminal.packageId === 'string' && typeof terminal.capabilityVersion === 'string', 'identity_conflict')
  const identity = value => need(object(value) && ['runId', 'packageId', 'capabilityVersion'].every(key => value[key] === terminal[key]), 'identity_conflict')
  const plan = await read(terminal.reviewRecoveryPlan)
  identity(plan)
  need(plan.schema === terminal.schema && /^[a-f0-9-]{36}$/u.test(plan.recoveryId)
    && plan.outputRoot === `.runtime/ai-painter/controller-repair-reviews/independent-review-adoption-004-20261022/review-${plan.recoveryId}`
    && terminalBinding.path === `${plan.outputRoot}/finalization.json`
    && terminal.reviewRecoveryPlan.path === `${plan.outputRoot}/plan.json`, 'root_conflict')
  const own = binding => { bound(binding); need(binding.path.startsWith(`${plan.outputRoot}/`), 'root_conflict') }
  same(plan.sourceWorkerTerminal, terminal.workerTerminal)
  same(plan.sourceExecutionPackage, terminal.executionPackage)
  same(plan.selectedCheckpoint, terminal.selectedCheckpoint)
  if (workerBinding) same(workerBinding, terminal.workerTerminal)
  const worker = await read(terminal.workerTerminal), pkg = await read(terminal.executionPackage)
  identity(worker)
  need(worker.schema === 'object-support-structure-quality-worker-terminal-v1'
    && worker.status === 'training_completed_review_pending' && worker.executionState === 'completed', 'worker_conflict')
  same(worker.executionPackage, terminal.executionPackage)
  same(worker.selectedCheckpointRecord?.checkpoint, terminal.selectedCheckpoint)
  need(pkg.schemaVersion === 'ai-painter-autonomous-closed-loop-package-v1' && pkg.packageIdentity === terminal.packageId
    && pkg.capabilityVersion === terminal.capabilityVersion && typeof pkg.outputRoot === 'string'
    && pkg.outputRoot.startsWith('.runtime/ai-painter/') && Array.isArray(pkg.inputEvidence) && pkg.inputEvidence.length <= 128
    && terminal.workerTerminal.path.startsWith(`${pkg.outputRoot}/`)
    && terminal.selectedCheckpoint.path.startsWith(`${pkg.outputRoot}/`), 'package_conflict')
  need(plan.sourceTrainingPlan?.path === `${pkg.outputRoot}/quality-plan.json`
    && pkg.inputEvidence.filter(item => item.path === plan.sourceTrainingPlan.path && item.sha256 === plan.sourceTrainingPlan.sha256).length === 1,
  'training_plan_conflict')
  const trainingPlan = await read(plan.sourceTrainingPlan)
  identity(trainingPlan)
  need(trainingPlan.schema === 'object-support-structure-quality-plan-v1'
    && trainingPlan.executionMode === 'bounded-quality-training' && trainingPlan.outputRoot === pkg.outputRoot
    && trainingPlan.configuration?.schema === 'object-support-structure-quality-configuration-v1'
    && trainingPlan.configuration.capabilityVersion === terminal.capabilityVersion, 'training_plan_conflict')
  own(terminal.core)
  need(terminal.core.path === `${plan.outputRoot}/dry-review/machine-audit-core.json`, 'root_conflict')
  const core = await read(terminal.core)
  identity(core); same(core.executionPackage, terminal.executionPackage); same(core.selectedCheckpoint, terminal.selectedCheckpoint)
  need(core.schema === 'object-support-structure-machine-audit-core-v1'
    && ['dry_single_world_review_failed_closed', 'dry_single_world_numeric_passed_visual_approval_pending'].includes(core.status)
    && core.status === terminal.status && terminal.executionState === (core.status === 'dry_single_world_review_failed_closed' ? 'failed_closed' : 'completed')
    && Array.isArray(core.issueCodes) && core.issueCodes.length <= 128
    && core.issueCodes.every(code => typeof code === 'string' && /^[a-z0-9_]{1,192}$/u.test(code))
    && [core.visualApprovalGranted, core.formalStage4QualificationGranted, core.runtimePublicationGranted].every(value => value === false), 'core_conflict')
  own(core.input)
  need(core.input.path === `${plan.outputRoot}/dry-review/cpu-review.json`, 'root_conflict')
  const input = await read(core.input)
  need(input.schema === 'object-support-structure-quality-native-review-input-v1' && input.capabilityVersion === terminal.capabilityVersion, 'input_conflict')
  for (const key of ['runId', 'packageId']) if (input[key] !== undefined) need(input[key] === terminal[key], 'identity_conflict')
  same(input.executionPackage, terminal.executionPackage); same(input.workerTerminal, terminal.workerTerminal)
  same(input.selectedCheckpoint, terminal.selectedCheckpoint)
  const manifest = await read(trainingPlan.datasetManifest), index = await read(manifest.sourceIndex), split = await read(trainingPlan.validationSplit)
  need(manifest.schemaVersion === 'ai-painter-stage4-source-correction-release-v1'
    && index.schemaVersion === `${manifest.schemaVersion}:source-index`
    && split.schemaVersion === `${manifest.schemaVersion}:membership`
    && Array.isArray(index.samples) && index.samples.length <= 128 && split.split === 'validation'
    && Array.isArray(split.sampleIds) && split.sampleIds.length === 8, 'dataset_conflict')
  const selected = worker.selectedCheckpointRecord
  need(Array.isArray(selected.validation) && selected.validation.length === 8 && Array.isArray(core.validationImages)
    && core.validationImages.length === 8 && isDeepStrictEqual(input.validationImages, core.validationImages)
    && trainingPlan.configuration.checkpointSelection?.validationRowsPerEligibleEpoch === 8, 'image_coverage_conflict')
  const seen = new Set(), paths = new Set()
  for (const [position, image] of core.validationImages.entries()) {
    const row = selected.validation[position], source = index.samples.filter(item => item.sampleId === image.sampleId)
    need(object(image) && image.sampleId === row.sampleId && image.sampleId === split.sampleIds[position]
      && image.split === 'validation' && row.split === 'validation' && image.epoch === selected.epoch
      && image.optimizerStep === selected.counts?.generator && image.purpose === 'prediction'
      && !seen.has(image.sampleId) && !paths.has(image.binding?.path) && source.length === 1 && source[0].split === 'validation', 'image_identity_conflict')
    seen.add(image.sampleId); paths.add(image.binding.path); own(image.binding)
    need(image.binding.path.startsWith(`${plan.outputRoot}/dry-review/`) && image.binding.path.endsWith('.png'), 'root_conflict')
    same(image.checkpoint, terminal.selectedCheckpoint); same(image.originalRgb, source[0].image); same(image.condition, source[0].conditionPack)
  }
  need(input.subject?.sampleId === core.validationImages[0].sampleId && input.subject.split === 'validation', 'subject_conflict')
  same(input.subject.referenceRgb, core.validationImages[0].originalRgb); same(input.subject.conditionPack, core.validationImages[0].condition)
  return { terminal, terminalBinding, plan, worker, core, input, jsonReads: reads }
}
