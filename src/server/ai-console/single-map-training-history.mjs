// Read-only projection of the frozen single-map experiment protocol. All child
// files must be listed by the authenticated result; never discover by directory.
import { legacySingleMapElapsed } from './training-observation-history.mjs'

export async function readLegacySingleMapPresentation({pkg,packageBinding,registry,terminal,readJson}) {
  if(pkg.schemaVersion!=='single-map-checkpoint-fit-package-v1'||Object.hasOwn(pkg,'interfaceContract'))return null
  const need=(ok)=>{if(!ok)throw Error('training_legacy_single_map_identity_conflict')}
  need(pkg.experimentIdentity===registry.runId&&pkg.outputRoot===`.runtime/ai-painter/learning-capacity-experiments/${registry.runId}`
    &&pkg.qualificationGranted===false&&terminal?.runId===registry.runId&&registry.activeExecution==null)
  const plan=await readJson(pkg.sourcePlan),resolution=plan.configuration?.scope?.resolution
  need(Array.isArray(resolution)&&resolution.length===2&&resolution.every(n=>Number.isSafeInteger(n)&&n>0))
  const result=await readJson(terminal.result)
  need(result.experimentIdentity===registry.runId&&terminal.result.path.startsWith(pkg.outputRoot+'/'))
  const counts=result.optimizerSteps
  need(Number.isSafeInteger(pkg.training?.pairs)&&pkg.training.pairs>0&&['generator','discriminator'].every(k=>Number.isSafeInteger(counts?.[k])
    &&counts[k]>=0&&counts[k]<=pkg.training.pairs&&(terminal.actualFinalOptimizerSteps??terminal.lastConfirmedOptimizerSteps)?.[k]===counts[k]))
  return {availability:'available',reasonCode:null,runId:registry.runId,scope:'single_map_checkpoint_fit',
    resolution:{width:resolution[0],height:resolution[1]},targetEpochs:null,targetOptimizerSteps:pkg.training.pairs,
    targetDiscriminatorOptimizerSteps:pkg.training.pairs,completedEpochs:null,
    actualOptimizerSteps:{generator:counts.generator,critic:counts.discriminator},errorCode:null,
    packagePath:packageBinding.path,packageSha256:packageBinding.sha256,experimentTiming:legacySingleMapElapsed(result,terminal.result)}
}

export async function adaptSingleMapTraining({ runId, request, terminal, record, base, readJson, makeArtifact, checkpointMetadata, requireFact }) {
  const check = (ok, suffix) => requireFact(ok, 'history_single_map_' + suffix)
  const binding = b => b && typeof b.path === 'string' && /^[a-f0-9]{64}$/.test(b.sha256)
  const count = n => Number.isSafeInteger(n) && n >= 0
  const sample = request.sampleIdentity
  check(request.experimentIdentity === runId && terminal.runId === runId && terminal.experimentIdentity === runId, 'identity_conflict')
  check(sample?.sampleId === request.selectedSampleId && sample.split === 'train' && binding(sample.image), 'sample_conflict')
  check(request.qualificationGranted === false && terminal.formalTrainingQualified === false
    && terminal.checkpointPromotable === false && terminal.worldEntryAllowed === false, 'qualification_conflict')
  check(request.outputRoot === `.runtime/ai-painter/learning-capacity-experiments/${runId}`, 'root_conflict')
  check(count(request.training?.pairs) && request.training.pairs <= 512
    && Array.isArray(request.training.observations) && request.training.observations.length <= 32
    && request.training.observations.every(n => count(n) && n <= request.training.pairs)
    && new Set(request.training.observations).size === request.training.observations.length, 'budget_conflict')
  const finish = reasonCode => ({ ...base, dataStatus: reasonCode ? 'partial' : 'connected', reasonCode,
    schemaVersion: 'ai_console_training_run_detail_v1', record })
  record.runKind = 'single_map_checkpoint_fit'
  record.detailCoverage = { adapter: 'single_map_checkpoint_fit_v1', supported: true,
    imageToMetricAssociation: 'verified_result_and_observation_bindings', terminalAndEventsAvailable: true }
  record.qualification = { scope: 'fixed_train_sample_fit_only', formalStageQualified: false,
    checkpointPromotable: false, runtimeFrameAllowed: false }
  record.optimizerInitialization = request.optimizerInitialization
  const original = makeArtifact('original', sample.image, { sampleId: sample.sampleId, split: 'train' })
  record.artifacts.push(original)
  const condition = binding(sample.conditionPack) ? makeArtifact('condition', sample.conditionPack, { sampleId: sample.sampleId, split: 'train' }) : null
  if (condition) record.artifacts.push(condition)
  record.samples.push({ sampleId: sample.sampleId, split: 'train', original, condition })
  const plan = await readJson(request.sourcePlan)
  const size = plan.configuration?.scope?.resolution
  check(Array.isArray(size) && size.length === 2 && size.every(n => Number.isSafeInteger(n) && n > 0), 'resolution_missing')
  record.resolution = { width: size[0], height: size[1] }
  base.unavailableFields = base.unavailableFields.filter(field => field !== 'resolution')
  if (!binding(terminal.result)) { base.unavailableFields.push('metrics', 'checkpoints', 'output'); return finish('history_result_binding_missing') }
  const result = await readJson(terminal.result)
  record.experimentTiming = legacySingleMapElapsed(result, terminal.result)
  record.artifacts.push(makeArtifact('result', terminal.result))
  check(result.experimentIdentity === runId && Array.isArray(result.artifacts) && result.artifacts.length <= 1024, 'result_conflict')
  const completed = terminal.executionState === 'completed'
  check(completed ? terminal.status === 'experiment_completed_not_formal_qualified'
    && result.status === 'experiment_executed_not_visual_qualified' && result.formalQualificationGranted === false
    : terminal.executionState === 'failed_closed' && result.status === 'experiment_failed_closed', 'status_conflict')
  const steps = result.optimizerSteps
  check(steps && count(steps.generator) && count(steps.discriminator)
    && steps.generator <= request.training.pairs && steps.discriminator <= request.training.pairs, 'steps_conflict')
  check(!completed || steps.generator === request.training.pairs && steps.discriminator === request.training.pairs
    && result.checkpointReloadExact === true, 'completion_conflict')
  const final = terminal.actualFinalOptimizerSteps ?? terminal.lastConfirmedOptimizerSteps
  check(final?.generator === steps.generator && final?.discriminator === steps.discriminator, 'terminal_steps_conflict')
  record.optimizerSteps = steps.generator
  record.qualification.optimizerSteps = steps
  record.checkpointReloadExact = result.checkpointReloadExact
  const byPath = new Map()
  for (const b of result.artifacts) {
    check(binding(b) && b.path.startsWith(request.outputRoot + '/') && !byPath.has(b.path), 'artifact_conflict')
    byPath.set(b.path, b)
  }
  const observations = new Map(), learning = new Map(), images = new Map()
  for (const b of result.artifacts) {
    if (!b.path.endsWith('.json')) continue
    const v = await readJson(b)
    record.artifacts.push(makeArtifact('evidence', b))
    // Classify by fields in verified JSON, not the filename.
    if (v.prediction !== undefined && v.metrics !== undefined) {
      check(v.sampleId === sample.sampleId && request.training.observations.includes(v.step)
        && !observations.has(v.step) && v.step <= steps.generator
        && v.optimizerSteps?.generator === v.step && v.optimizerSteps?.discriminator === v.step, 'observation_conflict')
      check(binding(v.prediction) && byPath.get(v.prediction.path)?.sha256 === v.prediction.sha256
        && v.prediction.path.endsWith('.png') && !images.has(v.prediction.path), 'image_binding_conflict')
      observations.set(v.step, v)
      images.set(v.prediction.path, { sampleId: sample.sampleId, split: 'train', optimizerSteps: v.step,
        sourceLabel: `固定训练样本 · 第 ${v.step} 步`, sourcePath: b.path, sourceSha256: b.sha256 })
      record.metrics.push({ sampleId: sample.sampleId, split: 'train', optimizerStep: v.step,
        measurements: v.metrics, recordedAtUtc: v.recordedAtUtc, sourcePath: b.path, sourceSha256: b.sha256 })
    } else if (v.measurementScope === 'original_pre_update_objectives_for_successfully_committed_pair') {
      check(v.sampleId === sample.sampleId && count(v.step) && v.step > 0 && v.step <= steps.generator
        && !learning.has(v.step) && v.optimizerSteps?.generator === v.step && v.optimizerSteps?.discriminator === v.step
        && v.values && typeof v.values === 'object' && !Array.isArray(v.values), 'learning_conflict')
      learning.set(v.step, v)
    }
  }
  for (const b of result.artifacts) {
    if (b.path.endsWith('.png')) {
      const association = images.get(b.path)
      check(association, 'image_association_missing')
      record.artifacts.push(makeArtifact('output', b, association))
    } else if (b.path.endsWith('.pt')) {
      const cp = await checkpointMetadata(makeArtifact('checkpoint', b, { optimizerSteps: steps.generator, promotable: false }))
      record.artifacts.push(cp); record.checkpoints.push(cp)
    }
  }
  for (const [step, v] of [...learning].sort((a, b) => a[0] - b[0])) record.metrics.push({
    sampleId: sample.sampleId, split: 'train', optimizerStep: step, sourceField: 'committed_pair_learning',
    measurements: v.values, recordedAtUtc: v.recordedAtUtc, measurementScope: v.measurementScope })
  check(!completed || observations.size === request.training.observations.length
    && learning.size === steps.generator && record.checkpoints.length === 1, 'coverage_conflict')
  record.detailCoverage.observationCount = observations.size
  record.detailCoverage.learningStepCount = learning.size
  record.detailCoverage.logs = 'not_bound_by_result'
  if (!completed) base.unavailableFields.push('completed_training')
  return finish(completed ? null : 'history_experiment_failed_closed_partial')
}
