// Pure observation validation. Execution policy, model admission and release
// remain with their existing authorities; this protocol grants no qualification.
import { isDeepStrictEqual } from 'node:util'

export const OBSERVATION_CONTRACT = 'ai-painter-training-interface-contract-v2'
export const OBSERVATION_RECORD = 'ai-painter-training-observation-v1'
export const OBSERVATION_PROGRESS = 'ai-painter-training-observation-progress-v1'
export const OBSERVATION_SCOPE = 'worker_data_model_loading_updates_checkpoint_validation_before_result_publication'
export const IMAGE_SCOPE = 'prediction_forward_cpu_transfer_png_encoding_and_publication'
export const CONTROLLER_SCOPE = 'controller_after_cpu_preparation_before_terminal_registration'
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const count = v => Number.isSafeInteger(v) && v >= 0
const need = (ok, code) => { if (!ok) throw Error('training_observation_' + code) }
export const sameBinding = (a, b) => Boolean(a && b && a.path === b.path && a.sha256 === b.sha256)
const artifactKey = a => JSON.stringify([a.role, a.sampleId ?? null, a.split ?? null, a.optimizerStep, a.measurementScope ?? null])
export function observationBinding(b) {
  need(object(b) && typeof b.path === 'string' && /^(?:\.runtime|data|cold)\//u.test(b.path)
    && !b.path.includes('\\') && b.path.split('/').every(p => p && p !== '.' && p !== '..')
    && /^[a-f0-9]{64}$/u.test(b.sha256), 'binding_invalid')
  return b
}
export function observationContract(pkg, runId) {
  const c = pkg?.interfaceContract
  need(object(c) && c.schemaVersion === OBSERVATION_CONTRACT, 'contract_unsupported')
  need(c.purpose === 'observation_only' && c.producerVersion === 'training-observation-recorder-v1'
    && c.recordFile === 'training-observation.json' && c.progressFile === 'progress.json', 'contract_conflict')
  need((pkg.runId ?? pkg.experimentIdentity) === runId && typeof pkg.outputRoot === 'string'
    && pkg.outputRoot.startsWith('.runtime/ai-painter/') && pkg.outputRoot.endsWith('/' + runId)
    && !pkg.outputRoot.includes('\\') && pkg.outputRoot.split('/').every(p => p && p !== '.' && p !== '..'), 'run_conflict')
  need(Array.isArray(c.resolution) && c.resolution.length === 2
    && c.resolution.every(v => Number.isSafeInteger(v) && v > 0 && v <= 8192), 'resolution_invalid')
  need(object(c.optimizerStepCeiling) && ['generator', 'discriminator'].every(k => count(c.optimizerStepCeiling[k])
    && c.optimizerStepCeiling[k] <= 10000000), 'ceiling_invalid')
  need(Array.isArray(c.samples) && c.samples.length > 0 && c.samples.length <= 128, 'samples_invalid')
  const ids = new Set()
  for (const s of c.samples) {
    need(object(s) && typeof s.sampleId === 'string' && /^[\w.-]{1,192}$/u.test(s.sampleId)
      && ['train', 'validation', 'challenge', 'regression'].includes(s.split) && !ids.has(s.sampleId), 'sample_conflict')
    ids.add(s.sampleId); observationBinding(s.image)
    if (s.conditionPack != null) observationBinding(s.conditionPack)
  }
  need(object(c.producer) && typeof c.producer.path === 'string' && c.producer.path.startsWith('ml/ai-painter/')
    && !c.producer.path.includes('\\') && c.producer.path.split('/').every(p=>p&&p!=='.'&&p!=='..')
    && /^[a-f0-9]{64}$/u.test(c.producer.sha256) && Array.isArray(pkg.programs)
    && pkg.programs.some(b=>sameBinding(b,c.producer)), 'producer_binding_conflict')
  need(Array.isArray(c.artifactPlan) && c.artifactPlan.length > 0 && c.artifactPlan.length <= 2303, 'artifact_plan_invalid')
  const planned=new Set()
  for(const a of c.artifactPlan) {
    need(object(a)&&['prediction','diagnostic_composite','metrics','checkpoint'].includes(a.role)
      &&count(a.optimizerStep)&&a.optimizerStep<=c.optimizerStepCeiling.generator
      &&!planned.has(artifactKey(a)), 'artifact_plan_conflict')
    if(a.role!=='checkpoint') need(c.samples.some(s=>s.sampleId===a.sampleId&&s.split===a.split)
      &&typeof a.measurementScope==='string'&&/^[a-z0-9_]{1,192}$/u.test(a.measurementScope),'artifact_plan_sample_conflict')
    planned.add(artifactKey(a))
  }
  return c
}
export function observationCounts(value, c) {
  need(object(value) && ['generator', 'discriminator'].every(k => count(value[k])
    && value[k] <= c.optimizerStepCeiling[k]), 'counts_conflict')
  return value
}
export function observationClock(clock, scope, { partial = false } = {}) {
  const utc = t => typeof t === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|\+00:00)$/u.test(t) && Number.isFinite(Date.parse(t))
  need(object(clock) && clock.scope === scope && utc(clock.startedAtUtc), 'clock_invalid')
  if (partial && clock.status === 'started') {
    need(clock.endedAtUtc === null && clock.elapsedSeconds === null, 'clock_partial_conflict'); return clock
  }
  need(['completed', 'failed_closed'].includes(clock.status) && utc(clock.endedAtUtc)
    && Number.isFinite(clock.elapsedSeconds) && clock.elapsedSeconds >= 0 && clock.elapsedSeconds <= 31536000, 'clock_invalid')
  // Wall clock adjustment is retained explicitly; never derive monotonic duration
  // from UTC or reject real measured elapsed solely because UTC moved backwards.
  return clock
}
export function validateObservationRecord({ pkg, packageBinding, runId, terminal, value }) {
  const c = observationContract(pkg, runId)
  observationBinding(packageBinding)
  need(value?.schemaVersion === OBSERVATION_RECORD && value.runId === runId
    && sameBinding(value.executionPackage, packageBinding), 'record_identity_conflict')
  need(value.producerVersion === c.producerVersion && value.qualificationGranted === false
    && ['completed', 'failed_closed'].includes(value.executionState), 'record_state_conflict')
  observationCounts(value.optimizerSteps, c)
  observationClock(value.workerTiming, OBSERVATION_SCOPE)
  need(value.workerTiming.status === value.executionState, 'timing_state_conflict')
  if (terminal) {
    need(terminal.runId === runId && terminal.executionState === value.executionState
      && terminal.formalTrainingQualified === false && terminal.checkpointPromotable === false
      && terminal.worldEntryAllowed === false, 'terminal_conflict')
    const final = terminal.actualFinalOptimizerSteps ?? terminal.lastConfirmedOptimizerSteps
    need(isDeepStrictEqual(final, value.optimizerSteps), 'terminal_counts_conflict')
  }
  const coverageGaps=validateObservationArtifacts(c,pkg,value.artifacts,value.optimizerSteps,value.executionState==='completed')
  need(Array.isArray(value.secondaryErrors) && value.secondaryErrors.length <= 8
    && value.secondaryErrors.every(e => typeof e === 'string' && /^[a-z0-9_]{1,96}$/u.test(e)), 'secondary_errors_invalid')
  return { contract: c, value, coverageGaps }
}
export function validateObservationArtifacts(c,pkg,artifacts,counts,completed=false) {
  need(Array.isArray(artifacts) && artifacts.length <= 2304, 'artifact_limit')
  const seen = new Set(), actual = new Set(), planned = new Set(c.artifactPlan.map(artifactKey)), samples = new Map(c.samples.map(s => [s.sampleId, s]))
  for (const a of artifacts) {
    observationBinding(a.binding)
    need(a.binding.path.startsWith(pkg.outputRoot + '/') && !seen.has(a.binding.path), 'artifact_root_or_duplicate')
    seen.add(a.binding.path)
    need(['prediction', 'diagnostic_composite', 'metrics', 'checkpoint', 'program_events'].includes(a.role), 'artifact_role_invalid')
    need(count(a.optimizerStep) && a.optimizerStep <= counts.generator, 'artifact_step_conflict')
    if(a.role!=='program_events') {
      need(planned.has(artifactKey(a))&&!actual.has(artifactKey(a)), 'artifact_off_plan')
      actual.add(artifactKey(a))
    }
    if (['prediction', 'diagnostic_composite', 'metrics'].includes(a.role)) {
      need(samples.get(a.sampleId)?.split === a.split, 'artifact_sample_conflict')
      need(typeof a.measurementScope === 'string' && /^[a-z0-9_]{1,192}$/u.test(a.measurementScope), 'metric_scope_invalid')
    }
    if (['prediction', 'diagnostic_composite'].includes(a.role)) {
      need(a.binding.path.endsWith('.png') && isDeepStrictEqual(a.resolution, c.resolution), 'image_resolution_conflict')
      observationClock(a.imageTiming, IMAGE_SCOPE)
    }
    if (a.role === 'checkpoint') need(a.binding.path.endsWith('.pt') && a.promotable === false, 'checkpoint_conflict')
    if (['metrics', 'program_events'].includes(a.role)) need(a.binding.path.endsWith('.json'), 'artifact_type_invalid')
  }
  const coverageGaps=c.artifactPlan.filter(a=>!actual.has(artifactKey(a))
    &&(completed||a.optimizerStep<counts.generator))
    .map(a=>({role:a.role,sampleId:a.sampleId??null,optimizerStep:a.optimizerStep,reasonCode:'planned_artifact_not_recorded'}))
  return coverageGaps
}
export function validateInterruptedObservation({pkg,packageBinding,runId,terminal,value:p}) {
  const c=observationContract(pkg,runId)
  need(terminal.trainingObservation==null&&terminal.executionState==='failed_closed'&&terminal.runId===runId
    &&terminal.lastWorkerProgress?.path===pkg.outputRoot+'/'+c.progressFile,'interrupted_parent_conflict')
  need(p?.schemaVersion===OBSERVATION_PROGRESS&&p.runId===runId&&sameBinding(p.executionPackage,packageBinding)
    &&p.packageId===terminal.packageId&&p.capabilityVersion===terminal.capabilityVersion,'progress_identity_conflict')
  observationCounts(p.optimizerSteps,c)
  need(isDeepStrictEqual(p.optimizerSteps,terminal.lastConfirmedOptimizerSteps),'progress_counts_conflict')
  observationClock(p.workerTiming,OBSERVATION_SCOPE,{partial:true})
  need(p.workerTiming.status==='started','progress_clock_conflict')
  validateObservationArtifacts(c,pkg,p.artifacts??[],p.optimizerSteps)
  return {contract:c,value:p,workerExecutionTiming:publicObservationTiming({workerTiming:p.workerTiming},terminal.lastWorkerProgress)}
}
export function publicObservationTiming(value, binding) {
  return { availability: 'available', reasonCode: null, sourcePath: binding.path, sourceSha256: binding.sha256,
    ...value.workerTiming, stopReason: value.executionState === 'failed_closed' ? 'original_failure_in_bound_result' : null }
}
export function validateObservationResult(result,terminal,runId,value,pkg) {
  observationBinding(terminal.result)
  need(terminal.result.path.startsWith(pkg.outputRoot+'/')&&(result.runId??result.experimentIdentity)===runId
    &&sameBinding(result.trainingObservation,terminal.trainingObservation)
    &&['generator','discriminator'].every(k=>result.optimizerSteps?.[k]===value.optimizerSteps[k]),'result_conflict')
  need(result.executionState===undefined||result.executionState===terminal.executionState,'result_state_conflict')
  need(result.formalQualificationGranted!==true&&result.checkpointPromotable!==true&&result.worldEntryAllowed!==true,'result_qualification_conflict')
}
export function publicControllerTiming(terminal,binding) {
  if(!terminal?.controllerExecutionTiming||!binding)return null
  observationBinding(binding)
  observationClock(terminal.controllerExecutionTiming,CONTROLLER_SCOPE)
  return {availability:'available',reasonCode:null,sourcePath:binding.path,sourceSha256:binding.sha256,
    ...terminal.controllerExecutionTiming}
}
