// Adapt only an own-Run capsule carried by a verified committed snapshot.
// Returned facts are original machine evidence, not a retrospective GPU run.
export function readSingleMapWorkEvidence({ terminal, binding, registry, read, need }) {
  if (terminal.schemaVersion !== 'ai-painter-learning-capacity-experiment-terminal-v1'
    || registry?.runId !== terminal.runId || !registry.taskCapsule) return null
  const valid = b => b && typeof b.path === 'string' && /^[a-f0-9]{64}$/.test(b.sha256)
  const check = (ok, code) => need(ok, 'work_single_map_' + code, 409)
  check(valid(registry.taskCapsule), 'capsule_missing')
  const capsule = read(registry.taskCapsule.path, registry.taskCapsule.sha256)
  check(capsule.value.schemaVersion === 'ai-painter-local-task-capsule-v1'
    && capsule.value.taskId === registry.taskId && capsule.value.integrity?.status === 'verified'
    && Array.isArray(capsule.value.evidence) && capsule.value.evidence.length <= 128, 'capsule_conflict')
  const packages = capsule.value.evidence.filter(b => b.kind === 'experiment_0')
  if (packages.length !== 1) return null
  check(valid(packages[0]) && packages[0].sha256Verified === true, 'package_binding_conflict')
  const pkg = read(packages[0].path, packages[0].sha256), p = pkg.value
  if (p.schemaVersion !== 'single-map-checkpoint-fit-package-v1') return null
  check(!Object.hasOwn(p,'interfaceContract'),'declared_observation_contract_requires_common_adapter')
  check(p.experimentIdentity === terminal.runId && terminal.experimentIdentity === terminal.runId
    && (!binding.runId || binding.runId === terminal.runId) && p.qualificationGranted === false
    && p.sampleIdentity?.split === 'train' && p.selectedSampleId === p.sampleIdentity.sampleId, 'identity_conflict')
  check(valid(terminal.result) && terminal.result.path.startsWith(p.outputRoot + '/')
    && p.outputRoot === `.runtime/ai-painter/learning-capacity-experiments/${terminal.runId}`, 'result_binding_conflict')
  const result = read(terminal.result.path, terminal.result.sha256), r = result.value
  check(r.experimentIdentity === terminal.runId && terminal.formalTrainingQualified === false
    && terminal.checkpointPromotable === false && terminal.worldEntryAllowed === false, 'result_conflict')
  const completed = terminal.executionState === 'completed'
  check(completed ? terminal.status === 'experiment_completed_not_formal_qualified'
    && r.status === 'experiment_executed_not_visual_qualified' && r.formalQualificationGranted === false
    : terminal.executionState === 'failed_closed' && r.status === 'experiment_failed_closed', 'status_conflict')
  const steps = r.optimizerSteps, final = terminal.actualFinalOptimizerSteps ?? terminal.lastConfirmedOptimizerSteps
  check(['generator', 'discriminator'].every(k => Number.isSafeInteger(steps?.[k]) && steps[k] >= 0
    && steps[k] <= p.training.pairs && final?.[k] === steps[k]), 'steps_conflict')
  check(!completed || steps.generator === p.training.pairs && steps.discriminator === p.training.pairs
    && r.checkpointReloadExact === true, 'completion_conflict')
  check(Number.isFinite(r.elapsedSeconds) && r.elapsedSeconds >= 0, 'duration_conflict')
  return { completed, capsule, pkg, result, steps, elapsedSeconds: r.elapsedSeconds,
    checkpointReloadExact: r.checkpointReloadExact, optimizerInitialization: p.optimizerInitialization }
}
