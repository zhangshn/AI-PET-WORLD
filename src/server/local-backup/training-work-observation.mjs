import { OBSERVATION_CONTRACT, validateObservationRecord, validateObservationResult, validateInterruptedObservation, observationContract } from '../ai-console/training-observation-contract.mjs'

// Registry delivery remains the existing producer. This adapter changes neither
// work-event authority nor execution/qualification decisions.
export function readTrainingWorkObservation({ terminal, registry, read }) {
  if (terminal.schemaVersion !== 'ai-painter-learning-capacity-experiment-terminal-v1'
    || terminal.runId !== registry?.runId || !terminal.executionPackage) return null
  const pkg = read(terminal.executionPackage.path, terminal.executionPackage.sha256)
  if (!Object.hasOwn(pkg.value,'interfaceContract')) return null
  const c = observationContract(pkg.value, terminal.runId)
  if (c.schemaVersion !== OBSERVATION_CONTRACT) throw Error('training_observation_contract_unsupported')
  const completed = terminal.executionState === 'completed'
  if (!['completed', 'failed_closed'].includes(terminal.executionState)
    || terminal.formalTrainingQualified !== false || terminal.checkpointPromotable !== false || terminal.worldEntryAllowed !== false)
    throw Error('training_observation_terminal_conflict')
  let observation = null, value = null, gap = null, interruptedTiming=null
  try {
    if (terminal.trainingObservation?.path !== pkg.value.outputRoot + '/' + c.recordFile)
      throw Error('training_observation_record_missing')
    observation = read(terminal.trainingObservation.path, terminal.trainingObservation.sha256)
    const verified = validateObservationRecord({pkg:pkg.value,packageBinding:terminal.executionPackage,
      runId:terminal.runId,terminal,value:observation.value})
    value=verified.value
    if(verified.coverageGaps.length||value.secondaryErrors.length)gap='training_observation_incomplete'
    const result=read(terminal.result.path,terminal.result.sha256)
    validateObservationResult(result.value,terminal,terminal.runId,value,pkg.value)
  } catch {
    value=null
    gap = 'training_observation_evidence_unavailable'
    if(terminal.trainingObservation==null&&terminal.lastWorkerProgress) try {
      const progress=read(terminal.lastWorkerProgress.path,terminal.lastWorkerProgress.sha256)
      interruptedTiming=validateInterruptedObservation({pkg:pkg.value,packageBinding:terminal.executionPackage,
        runId:terminal.runId,terminal,value:progress.value}).workerExecutionTiming
    } catch { /* Retain original terminal; no fabricated final worker clock. */ }
  }
  return { completed, pkg, observation: value ? observation : null, value, gap, interruptedTiming }
}
