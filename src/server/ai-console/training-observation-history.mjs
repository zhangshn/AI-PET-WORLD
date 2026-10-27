import { observationBinding, observationContract, observationCounts, validateInterruptedObservation,validateObservationResult,
  validateObservationRecord, publicObservationTiming, publicControllerTiming, sameBinding } from './training-observation-contract.mjs'
import {publicMeasurements} from './training-observation-public-fields.mjs'

export async function readInterruptedObservation({pkg,packageBinding,runId,terminal,readJson}) {
  if(terminal.trainingObservation!=null||terminal.executionState!=='failed_closed'||!terminal.lastWorkerProgress) return null
  observationBinding(terminal.lastWorkerProgress)
  const p=await readJson(terminal.lastWorkerProgress)
  // No final worker clock or final counters are inferred from a controller exit.
  return validateInterruptedObservation({pkg,packageBinding,runId,terminal,value:p})
}

export async function readObservationRecord({ pkg, packageBinding, runId, terminal, readJson }) {
  const c = observationContract(pkg, runId)
  observationBinding(terminal.trainingObservation)
  if (terminal.trainingObservation.path !== pkg.outputRoot + '/' + c.recordFile)
    throw Error('training_observation_record_path_conflict')
  const value = await readJson(terminal.trainingObservation,512*1024)
  const verified=validateObservationRecord({ pkg, packageBinding, runId, terminal, value })
  observationBinding(terminal.result)
  if(!terminal.result.path.startsWith(pkg.outputRoot+'/')) throw Error('training_observation_result_path_conflict')
  const result=await readJson(terminal.result,512*1024)
  validateObservationResult(result,terminal,runId,value,pkg)
  return verified
}
// All compliant experiment types take this path. No model/candidate/schema-name
// dispatch is allowed inside the common observation protocol.
export async function adaptObservationHistory({ runId, request, packageBinding, terminal, record, base, readJson, readEvidenceJson, makeArtifact, checkpointMetadata }) {
  try {record.controllerExecutionTiming=publicControllerTiming(terminal,record.terminalBinding)}catch{/* Invalid controller clocks do not overwrite worker facts. */}
  let consumedBytes=0
  const boundedJson=async(binding,maximumBytes=32768)=>{
    const budget=Math.min(maximumBytes,8*1024*1024-consumedBytes)
    if(budget<=0)throw Error('history_observation_aggregate_byte_limit')
    const read=readEvidenceJson?await readEvidenceJson(binding,budget):{value:await readJson(binding,budget)}
    consumedBytes+=read.byteLength??Buffer.byteLength(JSON.stringify(read.value),'utf8')
    if(consumedBytes>8*1024*1024)throw Error('history_observation_aggregate_byte_limit')
    return read.value
  }
  let observation
  try { observation=await readObservationRecord({pkg:request,packageBinding,runId,terminal,readJson:boundedJson}) }
  catch(error) {
    const reason=/^[a-z][a-z0-9_]{1,159}$/u.test(error.message??'')?error.message:'training_observation_evidence_unavailable'
    record.runKind='protocol_observed_training'
    try {
      const interrupted=await readInterruptedObservation({pkg:request,packageBinding,runId,terminal,readJson:boundedJson})
      if(interrupted) {
        record.workerExecutionTiming=interrupted.workerExecutionTiming
        record.lastConfirmedOptimizerSteps=interrupted.value.optimizerSteps
        record.resolution={width:interrupted.contract.resolution[0],height:interrupted.contract.resolution[1]}
        for(const a of interrupted.value.artifacts??[]) {
          if(a.role==='prediction'||a.role==='diagnostic_composite') record.artifacts.push(makeArtifact('output',a.binding,
            {sampleId:a.sampleId,split:a.split,optimizerSteps:a.optimizerStep,resolution:a.resolution,purpose:a.role,imageTiming:a.imageTiming}))
        }
      }
    } catch { /* Keep original terminal and the first observation failure. */ }
    record.detailCoverage={adapter:'training_observation_v1',supported:false,reasonCode:reason,terminalAndEventsAvailable:true}
    base.unavailableFields=[...new Set([...base.unavailableFields,...(record.workerExecutionTiming?[]:['workerExecutionTiming']),'samples','metrics','checkpoints'])]
    return {...base,schemaVersion:'ai_console_training_run_detail_v1',record,dataStatus:'partial',reasonCode:reason}
  }
  const { contract: c, value, coverageGaps }=observation
  record.runKind = 'protocol_observed_training'
  record.resolution = { width: c.resolution[0], height: c.resolution[1] }
  record.optimizerSteps = value.optimizerSteps.generator
  record.workerExecutionTiming = publicObservationTiming(value, terminal.trainingObservation)
  record.qualification = { formalStageQualified: false, checkpointPromotable: false, runtimeFrameAllowed: false,
    optimizerSteps: value.optimizerSteps }
  record.artifacts.push(makeArtifact('evidence', terminal.trainingObservation))
  record.artifacts.push(makeArtifact('result', terminal.result))
  record.logs = []
  for (const s of c.samples) {
    const original = makeArtifact('original', s.image, { sampleId: s.sampleId, split: s.split })
    const condition = s.conditionPack ? makeArtifact('condition', s.conditionPack, { sampleId: s.sampleId, split: s.split }) : null
    record.samples.push({ sampleId: s.sampleId, split: s.split, original, condition })
    record.artifacts.push(original, ...(condition ? [condition] : []))
  }
  const gaps = [...value.secondaryErrors, ...coverageGaps]
  for (const a of value.artifacts) {
    const metadata = { sampleId: a.sampleId, split: a.split, optimizerSteps: a.optimizerStep,
      purpose: a.role, measurementScope: a.measurementScope, resolution: a.resolution, imageTiming: a.imageTiming }
    try {
      if (a.role === 'checkpoint') {
        const cp = await checkpointMetadata(makeArtifact('checkpoint', a.binding, { ...metadata, promotable: false }))
        record.checkpoints.push(cp); record.artifacts.push(cp)
      } else if (a.role === 'metrics') {
        const metric = await boundedJson(a.binding)
        if (metric.sampleId !== a.sampleId || metric.step !== a.optimizerStep
          || metric.optimizerSteps?.generator !== a.optimizerStep) throw Error('training_observation_metric_conflict')
        observationCounts(metric.optimizerSteps,c)
        if(metric.optimizerSteps.discriminator>value.optimizerSteps.discriminator
          ||typeof metric.recordedAtUtc!=='string'||metric.recordedAtUtc.length>40||!Number.isFinite(Date.parse(metric.recordedAtUtc)))
          throw Error('training_observation_metric_conflict')
        const measurements=publicMeasurements(metric.values??metric.metrics)
        if(metric.missingReason!=null)gaps.push('training_observation_metric_partially_recorded')
        record.metrics.push({ ...metadata, optimizerStep: a.optimizerStep, measurements,
          recordedAtUtc: metric.recordedAtUtc, sourcePath: a.binding.path, sourceSha256: a.binding.sha256 })
        record.artifacts.push(makeArtifact('evidence', a.binding, metadata))
      } else if (a.role === 'program_events') {
        const log = await boundedJson(a.binding,65536)
        if (log.schemaVersion !== 'ai-painter-observation-program-events-v1' || log.runId !== runId
          || !Array.isArray(log.events) || log.events.length > 512) throw Error('training_observation_log_conflict')
        for (const e of log.events) {
          if (!['worker_completed', 'worker_failed_closed'].includes(e.code)
            || !/^[a-z0-9_]{1,96}$/u.test(e.phase) || !sameBinding(value.executionPackage, packageBinding)
            || typeof e.recordedAtUtc !== 'string' || !Number.isFinite(Date.parse(e.recordedAtUtc)))
            throw Error('training_observation_log_conflict')
          // Whitelist the public projection; never expose arbitrary log fields.
          record.logs.push({ code: e.code, phase: e.phase, recordedAtUtc: e.recordedAtUtc,
            optimizerSteps: value.optimizerSteps, sourcePath: a.binding.path, sourceSha256: a.binding.sha256 })
        }
      } else record.artifacts.push(makeArtifact('output', a.binding, metadata))
    } catch (error) { gaps.push(error.code === 'ENOENT' ? 'observation_artifact_missing'
      : /^[a-z][a-z0-9_]{1,159}$/u.test(error.message??'') ? error.message : 'observation_artifact_unavailable') }
  }
  base.unavailableFields = base.unavailableFields.filter(f => !['resolution', 'workerExecutionTiming'].includes(f))
  record.detailCoverage = { adapter: 'training_observation_v1', supported: true, observationGaps: gaps,
    sourcePolicy: 'verified_registry_package_terminal_observation_explicit_sha256', logs: 'safe_program_events_only',
    checkpointBytesRead: false, qualification: 'separate_original_authority' }
  return { ...base, schemaVersion: 'ai_console_training_run_detail_v1', record,
    dataStatus: gaps.length ? 'partial' : 'connected', reasonCode: gaps.length ? 'history_observation_incomplete' : null }
}

// Historical sources never had a complete worker timing record. Preserve the
// actually measured elapsed separately; no subtraction or endpoint fabrication.
export function legacySingleMapElapsed(result, binding) {
  if (!Number.isFinite(result?.elapsedSeconds) || result.elapsedSeconds < 0) return null
  return { availability: 'available', scope: 'legacy_single_map_experiment_before_result_publication',
    startedAtUtc: null, endedAtUtc: null, elapsedSeconds: result.elapsedSeconds,
    sourcePath: binding.path, sourceSha256: binding.sha256 }
}
