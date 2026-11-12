import { bytes as readPreviewBytes } from './training-history-safe-bytes.mjs'
import { decodeTrainingInterfaceJson, readBoundTrainingInterface, readTrustedTrainingPreviewProgress } from './training-preview-history-v1.mjs'
import { CURRENT_EXECUTION_REGISTRY_PATH, readCurrentExecutionRegistry } from '../ai-painter-current-execution-registry.mjs'
import { readBoundTrainingPresentation } from './bound-training-presentation.mjs'
import { isDeepStrictEqual } from 'node:util'

export const COMPLETION_PROTOCOLS = new Map([
  ['stage4_mvp256_dry_decode1_entry_weight_quality24_same_call_v1', {
    root: '.runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions/',
    policyPath: 'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v4.json',
    policySchema: 'ai-painter-decode1-entry-weight-quality-execution-policy-v4',
    profile: 'completion_decode1_entry_weight_quality24_same_call_v1',
    gpuAdmissionCompletion: true,
  }],
  ['stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1', {
    root: '.runtime/ai-painter/decode1-entry-weight-quality-completion-executions/',
    policyPath: 'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v2.json',
    policySchema: 'ai-painter-decode1-entry-weight-quality-execution-policy-v2',
  }],
  ['stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2', {
    root: '.runtime/ai-painter/decode1-entry-weight-quality-completion-v2-executions/',
    policyPath: 'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v3.json',
    policySchema: 'ai-painter-decode1-entry-weight-quality-execution-policy-v3',
    profile: 'completion_decode1_entry_weight_quality24_v2',
    gpuAdmissionCompletion: true,
  }],
])

export const WORKER_TIMING_SCOPE = 'worker_training_execute_including_authentication_data_model_checkpoint_validation_and_final_progress_before_terminal_publication'

// Shared read-only extension for the existing current projection and history.
// The caller supplies an authenticated parent; only its explicit SHA chain is
// followed. Failure here cannot replace that parent's counters or first error.
/** @param {(Awaited<ReturnType<typeof readCurrentExecutionRegistry>> & {presentation: Awaited<ReturnType<typeof readBoundTrainingPresentation>>}) | null} [current] */
export async function readCompletionTrainingObservation(root, terminal, current = null) {
  // The common protocol has already been verified by the shared presentation
  // reader. Do not overwrite it with the legacy execution-policy timing adapter.
  if (current?.presentation?.observationContractVersion === 2) return null
  let protocol = COMPLETION_PROTOCOLS.get(terminal?.capabilityVersion)
  if (!protocol && !terminal?.executionPackage) return null
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  const unavailable = reasonCode => ({ availability: 'unavailable', reasonCode, sourcePath: null, sourceSha256: null,
    startedAtUtc: null, endedAtUtc: null, elapsedSeconds: null, scope: WORKER_TIMING_SCOPE, status: null, stopReason: null })
  const result = { trainingWallMode: null, maxWallSeconds: null, workerExecutionTiming: unavailable('worker_timing_not_bound') }
  const need = (condition, code) => { if (!condition) throw new Error(code) }
  const same = (a, b) => a?.path === b?.path && a?.sha256 === b?.sha256
  const read = async (binding, maximum = 2 * 1024 * 1024) => {
    need(object(binding) && typeof binding.path === 'string' && /^[a-f0-9]{64}$/u.test(binding.sha256), 'worker_timing_binding_invalid')
    const raw = await readPreviewBytes(root, binding.path, maximum, binding.sha256)
    return decodeTrainingInterfaceJson(raw.value,maximum)
  }
  const identity = value => need(object(value) && ['capabilityVersion', 'runId', 'packageId'].every(key =>
    typeof terminal[key] === 'string' && value[key] === terminal[key]), 'worker_timing_identity_conflict')
  try {
    let parent = terminal
    let childError = null
    for (let depth = 0; depth < 3; depth++) {
      identity(parent)
      const child = parent.workerTerminal ?? parent.trainingTerminal
      if (!child) break
      let next
      try { next = await read(child) }
      catch (error) { childError = error; break }
      identity(next)
      if (parent.executionPackage) need(same(parent.executionPackage, next.executionPackage), 'worker_timing_package_conflict')
      parent = next
    }
    identity(parent)
    const pkg = await read(parent.executionPackage)
    const outputRoot = protocol ? `${protocol.root}${parent.runId}` : pkg.outputRoot
    need(pkg.schemaVersion === 'ai-painter-autonomous-closed-loop-package-v1'
      && pkg.packageIdentity === parent.packageId && pkg.capabilityVersion === parent.capabilityVersion
      && pkg.outputRoot === outputRoot && Array.isArray(pkg.inputEvidence) && pkg.inputEvidence.length <= 128,
    'worker_timing_package_conflict')
    const plans = pkg.inputEvidence.filter(item => item?.path === `${outputRoot}/quality-plan.json`)
    need(plans.length === 1, 'worker_timing_plan_conflict')
    const plan = await read(plans[0]); identity(plan)
    const registered = await readBoundTrainingInterface({ envelope: pkg, plan, parent, readJson: read })
    if (registered) protocol = registered
    if (!protocol) return null
    const config = plan.configuration
    need(plan.schema === 'object-support-structure-quality-plan-v1' && plan.executionMode === 'bounded-quality-training'
      && plan.outputRoot === outputRoot && config?.schema === 'object-support-structure-quality-configuration-v1'
      && config.capabilityVersion === parent.capabilityVersion, 'worker_timing_plan_conflict')
    if (protocol.gpuAdmissionCompletion) {
      need(plan.executionProfile === protocol.profile, 'worker_timing_profile_conflict')
      need(config.gpuAdmissionWallMode === 'completion' && config.gpuAdmissionSeconds === null,
        'worker_timing_gpu_admission_clock_conflict')
    }
    // Null by itself never means completion. Authenticate this Run's policy as
    // well as its configuration before exposing that interpretation.
    const policyBinding = plan.executionPolicy
    if (protocol.gpuAdmissionCompletion) need(policyBinding?.path === protocol.policyPath
      && same(policyBinding, config.executionPolicy)
      && pkg.inputEvidence.filter(item => same(item, policyBinding)).length === 1, 'worker_timing_execution_policy_conflict')
    if (policyBinding && same(policyBinding, config.executionPolicy)
      && policyBinding.path === protocol.policyPath
      && pkg.inputEvidence.filter(item => same(item, policyBinding)).length === 1) {
      const policy = await read(policyBinding, 65536)
      if (protocol.gpuAdmissionCompletion) need(policy.phaseResources?.gpuAdmissionWallMode === 'completion'
        && policy.phaseResources.gpuAdmissionSeconds === null && policy.executionProfile === protocol.profile
        && policy.outputRoot === protocol.root.slice(0, -1)
        && policy.gpuAdmission?.sampleSplit === 'train' && policy.gpuAdmission.sampleCount === 48,
      'worker_timing_gpu_admission_policy_conflict')
      const ceiling = config.executionCeiling, frozen = policy.executionCeiling
      if (policy.schemaVersion === protocol.policySchema
        && policy.candidate === parent.capabilityVersion && ceiling?.trainingWallMode === 'completion'
        && ceiling.maxWallSeconds === null && frozen?.trainingWallMode === 'completion' && frozen.maxWallSeconds === null
        && ['epochs', 'generatorOptimizerSteps', 'discriminatorOptimizerSteps'].every((key, i) =>
          ceiling[key] === [24, 1152, 1152][i] && frozen[key] === ceiling[key])) result.trainingWallMode = 'completion'
    }
    if (protocol.gpuAdmissionCompletion) need(result.trainingWallMode === 'completion', 'worker_timing_execution_policy_conflict')
    // Qualification duration has a different scope. Never attach the training
    // worker clock to this route's qualification terminal, even if it carries one.
    if (protocol.gpuAdmissionCompletion && ['qualification', 'gpu_qualification'].includes(terminal.phase)) return result
    if (childError) throw childError
    let timingBinding = parent.workerExecutionTiming
    if (!timingBinding && (current?.registry?.activeExecution || terminal.status === 'training_pending')) {
      // Reuse the verified registry/process/lock/heartbeat/TTL projection. Its
      // exact progress digest authenticates the binding, never file existence.
      const progress = await readTrustedTrainingPreviewProgress({ runId: terminal.runId,
        currentPath: CURRENT_EXECUTION_REGISTRY_PATH, readJson: binding => read(binding, 65536),
        readRegistry: () => current ?? readCurrentExecutionRegistry(root),
        readPresentation: snapshot => current?.presentation ?? readBoundTrainingPresentation(root,
          snapshot.registry, snapshot.taskCapsule, snapshot.currentTaskTerminal) })
      if (progress) { identity(progress); timingBinding = progress.workerExecutionTiming }
    }
    if (!timingBinding) return result
    need(timingBinding.path === `${outputRoot}/worker-execution-timing.json`, 'worker_timing_path_conflict')
    const timing = await read(timingBinding, 32768); identity(timing)
    need(timing.schemaVersion === 'decode1-entry-worker-execution-timing-v1', 'worker_timing_schema_unsupported')
    need(same(timing.executionPackage, parent.executionPackage) && timing.scope === WORKER_TIMING_SCOPE,
      'worker_timing_package_or_scope_conflict')
    const utc = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/u.test(value)
      && Number.isFinite(Date.parse(value))
    need(utc(timing.startedAtUtc) && (timing.endedAtUtc === null && timing.elapsedSeconds === null
      || utc(timing.endedAtUtc) && typeof timing.elapsedSeconds === 'number' && Number.isFinite(timing.elapsedSeconds)
        && timing.elapsedSeconds >= 0), 'worker_timing_time_conflict')
    const failure = timing.stopReason
    const failureRecorded = object(failure) && isDeepStrictEqual(Object.keys(failure).sort(), ['message', 'messageSha256', 'type'])
      && typeof failure.type === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(failure.type)
      && typeof failure.message === 'string' && [...failure.message].length <= 4096
      && typeof failure.messageSha256 === 'string' && /^[a-f0-9]{64}$/u.test(failure.messageSha256)
    need(timing.status === 'started' && timing.endedAtUtc === null && timing.stopReason === null
      || timing.status === 'completed' && timing.endedAtUtc !== null && timing.stopReason === null
      || timing.status === 'failed_closed' && timing.endedAtUtc !== null && failureRecorded, 'worker_timing_state_conflict')
    result.workerExecutionTiming = { availability: 'available', reasonCode: null, sourcePath: timingBinding.path,
      sourceSha256: timingBinding.sha256, ...Object.fromEntries(['scope', 'startedAtUtc', 'endedAtUtc', 'elapsedSeconds',
        'status', 'stopReason'].map(key => [key, timing[key]])) }
  } catch (error) {
    result.workerExecutionTiming = unavailable(error.code === 'ENOENT' ? 'worker_timing_missing' : error.message ?? 'worker_timing_unavailable')
  }
  return result
}
