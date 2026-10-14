import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readCurrentExecutionRegistry, recoverExpiredActiveExecutionToFailedClosed, recoverPreparedCurrentExecutionRegistryAdvance } from '../../src/server/ai-painter-current-execution-registry.mjs'

const GUARD = '.runtime/ai-painter/owned-worker-guards/active.json'
const REGISTRY = '.runtime/ai-painter/current-execution-registry/current.json'
const MAX_FILE = 2 * 1024 * 1024
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const requireValue = (value, code) => { if (!value) throw new Error(code) }
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const time = value => { const t = Date.parse(value); requireValue(Number.isFinite(t), 'invalid_timestamp'); return t }
const digest = value => /^[a-f0-9]{64}$/.test(value)

function readFile(file, expected) {
  const stat = fs.lstatSync(file)
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= MAX_FILE, 'invalid_bound_file')
  const bytes = fs.readFileSync(file)
  requireValue(!expected || digest(expected) && sha256(bytes) === expected, 'bound_sha256_mismatch')
  return bytes
}

function verifyExecutable(file, expected) {
  const stat = fs.lstatSync(file)
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 256 * 1024 * 1024 && digest(expected), 'invalid_executable_binding')
  const fd = fs.openSync(file, 'r')
  const hash = createHash('sha256')
  const chunk = Buffer.alloc(65536)
  try {
    let count
    while ((count = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, count))
  } finally { fs.closeSync(fd) }
  requireValue(hash.digest('hex') === expected, 'executable_sha256_mismatch')
}

// Logical paths may traverse the project's configured runtime junction, never arbitrary links.
function scopedFile(root, logical) {
  requireValue(typeof logical === 'string' && !path.isAbsolute(logical), 'relative_path_required')
  const absolute = path.resolve(root, logical)
  const rel = path.relative(root, absolute)
  requireValue(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'path_outside_project')
  const isRuntime = rel.replaceAll('\\', '/').startsWith('.runtime/')
  const boundary = fs.realpathSync(isRuntime ? path.join(root, '.runtime') : root)
  const real = fs.realpathSync(absolute)
  const physicalRel = path.relative(boundary, real)
  requireValue(physicalRel && !physicalRel.startsWith('..') && !path.isAbsolute(physicalRel), 'physical_path_outside_boundary')
  readFile(absolute)
  return absolute
}

export function historicalProjectPath(root, absolute) {
  requireValue(typeof absolute === 'string' && path.isAbsolute(absolute), 'historical_absolute_path_required')
  const local = path.relative(root, absolute)
  if (local && !local.startsWith('..') && !path.isAbsolute(local)) return local.replaceAll('\\', '/')
  const runtime = fs.realpathSync(path.join(root, '.runtime'))
  const relative = path.relative(runtime, absolute)
  requireValue(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'historical_path_outside_runtime')
  return '.runtime/' + relative.replaceAll('\\', '/')
}

export function loadRecoveryProfile(root, relative, expectedSha) {
  requireValue(digest(expectedSha), 'profile_sha256_required')
  const file = scopedFile(root, relative)
  const bytes = readFile(file, expectedSha)
  const profile = JSON.parse(bytes)
  requireValue(['ai-painter-owned-worker-reboot-recovery-profile-v1', 'ai-painter-owned-worker-reboot-recovery-profile-v2', 'ai-painter-owned-worker-reboot-recovery-profile-v3'].includes(profile.schema), 'profile_schema_invalid')
  if (profile.schema.endsWith('-v2')) requireValue(profile.failureCase === 'cpu_timeout_missing_native_observation_v1' && profile.observation === null, 'missing_observation_case_invalid')
  requireValue(/^[a-z0-9-]{1,64}$/.test(profile.caseId), 'case_id_invalid')
  requireValue(profile.guard.path === GUARD && profile.registry.path === REGISTRY, 'profile_target_invalid')
  return { profile, profileSha256: expectedSha, profilePath: relative }
}

const referenceMatches = (actual, expected) => actual && expected
  && actual.path === expected.path && actual.sha256 === expected.sha256 && digest(actual.sha256)

export function verifyHistoricalFailure(failure, profile, guard, readBound) {
  if (failure.status === 'failed_closed_post_spawn_receipt_budget_blocked') {
    requireValue(failure.controllerObservationOnly === true && failure.liveCleanupCertified === false, 'failure_evidence_invalid')
    requireValue(failure.currentGuardIdentity === guard.identity && failure.currentGuard?.sha256 === profile.guard.sha256
      && failure.started?.sha256 === profile.started.sha256 && failure.nativeBuild?.sha256 === profile.build.sha256
      && failure.nativeObservation?.sha256 === profile.observation.sha256, 'failure_chain_mismatch')
    return
  }
  requireValue(failure.schema === 'controller-ns003-pretraining-failure-handoff-v1'
    && failure.status === 'failed_closed_owned_cpu_receipt_unavailable_guard_retained', 'failure_evidence_invalid')
  const recovery = failure.recovery, attempted = failure.attempt, failed = failure.failure
  requireValue(recovery?.identity === guard.identity && referenceMatches(recovery.guard, profile.guard)
    && recovery.retained === true && recovery.guardRemoved === false && recovery.liveCleanupConfirmed === false
    && recovery.storedObservationUsedAsReleaseAuthority === false, 'failure_chain_mismatch')
  requireValue(referenceMatches(failed?.observation, profile.observation)
    && failed.observationHasReleaseAuthority === false && failed.nativeError === 'stream close unconfirmed', 'failure_chain_mismatch')
  requireValue(referenceMatches(failure.registry?.binding, profile.registry)
    && failure.registry.revision === profile.registry.revision && failure.registry.activeExecution === null, 'failure_registry_mismatch')
  requireValue(failure.results?.trainingStarted === false && failure.results.gpuQualificationExecuted === false
    && failure.results.realOptimizerUpdates === 0 && failure.independentComponents?.fullOwnedCpuAdmissionGranted === false
    && attempted?.commandMode === 'prepare-only' && attempted.attempts === 1 && attempted.automaticRetries === 0
    && attempted.cpuReportPresent === false && attempted.cpuAcceptancePresent === false, 'failure_scope_invalid')
  const output = '.runtime/ai-painter/ecology-decode1-weight-quality-executions/' + attempted.runId
  requireValue(typeof attempted.runId === 'string' && /^[a-z0-9][a-z0-9-]{7,127}$/.test(attempted.runId)
    && attempted.request?.path === output + '/cpu-request.json' && attempted.consumed?.path === output + '/cpu-entry/consumed.json'
    && failed.nativeErrorEvidence?.path === profile.observation.path + '.error', 'failure_artifact_path_mismatch')
  const request = JSON.parse(readBound(attempted.request))
  const consumed = JSON.parse(readBound(attempted.consumed))
  requireValue(request.schema === 'ecology-decode1-weight-quality-cpu-request-v1'
    && request.runId === attempted.runId && request.packageId === attempted.packageId && request.outputRoot === output + '/cpu-entry'
    && consumed.attempt === 1 && consumed.retries === 0 && referenceMatches(consumed.request, attempted.request), 'failure_consumed_request_mismatch')
  requireValue(readBound(failed.nativeErrorEvidence).toString('utf8').split(/\r?\n/u)[0] === 'System.Exception: ' + failed.nativeError, 'failure_native_error_mismatch')
}

export function normalizePreBootObservation(pre, profile, guard, readBound) {
  if (pre.schema !== 'controller-current-guard-recovery-readonly-review-v1') return pre
  requireValue(pre.caseGuardIdentity === guard.identity && referenceMatches(pre.inputs?.guard, profile.guard)
    && referenceMatches(pre.inputs?.registry, profile.registry) && referenceMatches(pre.inputs?.started, profile.started)
    && referenceMatches(pre.inputs?.build, profile.build) && referenceMatches(pre.inputs?.observation, profile.observation)
    && referenceMatches(pre.inputs?.failure, profile.failure), 'pre_boot_chain_mismatch')
  requireValue(pre.checks?.activeExecution === null && pre.checks.registryRevision === profile.registry.revision
    && pre.effects?.guardChanged === false && pre.effects.registryChanged === false && pre.effects.recoveryApplied === false
    && pre.effects.historicalCleanupCertified === false && pre.effects.oldExecutionMayReplay === false, 'pre_boot_readonly_scope_invalid')
  const provider = profile.preBootProgramSnapshot
  requireValue(provider && provider.sha256 === pre.inputs?.recoveryProgram?.sha256
    && pre.inputs.recoveryProgram.path === 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs'
    && profile.programBindings?.some(b => referenceMatches(b, provider)), 'pre_boot_provider_snapshot_missing')
  readBound(provider)
  requireValue(digest(pre.host?.MachineIdentitySha256) && pre.host.BootProvider === 'Microsoft-Windows-Kernel-General'
    && pre.host.BootEventId === 12 && Number.isSafeInteger(pre.host.BootEventRecordId)
    && Math.abs(time(pre.host.OsBootUtc) - time(pre.host.BootEventUtc)) <= 1000
    && time(pre.host.ObservedUtc) <= time(pre.recordedAtUtc), 'pre_boot_host_observation_invalid')
  // Preserve the actual prior observation time and kernel cycle; no backdating
  // or replacement of the fresh current-host query used by evaluateRecovery.
  return { guardIdentity: pre.caseGuardIdentity, guard: pre.inputs.guard, registry: pre.inputs.registry,
    activeExecution: pre.checks.activeExecution, host: pre.host }
}

export function verifyHistoricalInputs(root, profile) {
  if (profile.schema === 'ai-painter-owned-worker-reboot-recovery-profile-v3') return verifyTrainingKernelInputs(root, profile)
  if (profile.schema === 'ai-painter-owned-worker-reboot-recovery-profile-v2') return verifyCpuTimeoutInputs(root, profile, true)
  if (profile.schema === 'ai-painter-owned-worker-reboot-recovery-profile-v1' && profile.failureCase === 'cpu_timeout_observation_only_v1') return verifyCpuTimeoutInputs(root, profile, false)
  // Check declared roles before a stale source digest can obscure a missing
  // required verifier. Historical file content is still rehashed below.
  if (profile.programBindings !== undefined) {
    requireValue(Array.isArray(profile.programBindings) && profile.programBindings.length <= 16, 'program_bindings_invalid')
    for (const binding of profile.programBindings) requireValue(digest(binding.sha256), 'program_sha256_required')
    for (const required of ['docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md', 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs', 'scripts/run-ai-painter-owned-worker-reboot-recovery.mjs', 'src/server/ai-painter-current-execution-registry.mjs']) {
      requireValue(profile.programBindings.some(b => b.path === required), 'required_program_not_bound')
    }
  }
  const loaded = {}
  for (const key of ['guardSnapshot', 'started', 'build', 'observation', 'failure', 'preBoot']) {
    const binding = profile[key]
    requireValue(binding && digest(binding.sha256), `missing_${key}_binding`)
    const bytes = readFile(scopedFile(root, binding.path), binding.sha256)
    loaded[key] = { bytes, value: JSON.parse(bytes) }
  }
  const g = loaded.guardSnapshot.value
  const started = loaded.started.value
  const build = loaded.build.value
  const observation = loaded.observation.value
  const failure = loaded.failure.value
  const readBound = binding => {
    requireValue(binding && digest(binding.sha256), 'historical_binding_invalid')
    return readFile(scopedFile(root, binding.path), binding.sha256)
  }
  const pre = normalizePreBootObservation(loaded.preBoot.value, profile, g, readBound)
  requireValue(sha256(loaded.guardSnapshot.bytes) === profile.guard.sha256 && g.identity === profile.guardIdentity, 'historical_guard_identity_mismatch')
  const { ownerPid, commandBinding, ...startedGuard } = started
  requireValue(same(startedGuard, g) && Number.isInteger(ownerPid) && ownerPid > 0, 'started_guard_mismatch')
  requireValue(commandBinding === observation.bindingBase64 && observation.ownerPid === ownerPid, 'native_binding_mismatch')
  const binding = JSON.parse(Buffer.from(commandBinding, 'base64').toString('utf8'))
  requireValue(same(binding.guard, g) && binding.guardSha256 === profile.guard.sha256 && same(binding.nativeBuild, build), 'native_chain_mismatch')
  const startedFile = scopedFile(root, historicalProjectPath(root, g.startedEvidence))
  requireValue(path.resolve(binding.scope) === root && fs.realpathSync(startedFile) === fs.realpathSync(scopedFile(root, profile.started.path)), 'native_scope_mismatch')
  requireValue(observation.authority === 'observation_only_no_release_authority' && observation.assignedBeforeResume === true, 'observation_authority_invalid')
  verifyHistoricalFailure(failure, profile, g, readBound)
  requireValue(pre.guardIdentity === g.identity && pre.guard.sha256 === profile.guard.sha256 && pre.registry.sha256 === profile.registry.sha256 && pre.activeExecution === null, 'pre_boot_chain_mismatch')
  requireValue(time(pre.host.OsBootUtc) <= time(pre.host.ObservedUtc) && time(g.recordedAtUtc) < time(pre.host.ObservedUtc), 'pre_boot_time_order_invalid')
  requireValue(same(g.nativeOwnerSource, build.source), 'native_source_mismatch')
  for (const [file, expected] of [[build.snapshot, build.source.sha256], [build.binary, build.binarySha256]]) {
    const relative = historicalProjectPath(root, file)
    readFile(scopedFile(root, relative), expected)
  }
  readFile(scopedFile(root, historicalProjectPath(root, build.source.path)), build.source.sha256)
  readFile(scopedFile(root, profile.helperSnapshot.path), g.helperSha256)
  requireValue(profile.helperSnapshot.sha256 === g.helperSha256, 'helper_binding_mismatch')
  verifyExecutable(g.executable, g.executableSha256)
  requireValue(Array.isArray(profile.programBindings) && profile.programBindings.length <= 16, 'program_bindings_invalid')
  for (const binding of profile.programBindings) {
    requireValue(digest(binding.sha256), 'program_sha256_required')
    readFile(scopedFile(root, binding.path), binding.sha256)
  }
  for (const required of ['docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md', 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs', 'scripts/run-ai-painter-owned-worker-reboot-recovery.mjs', 'src/server/ai-painter-current-execution-registry.mjs']) {
    requireValue(profile.programBindings.some(b => b.path === required), 'required_program_not_bound')
  }
  return { guard: g, guardBytes: loaded.guardSnapshot.bytes, started, observation, preBoot: pre, inputs: profile }
}

// V2 is a narrowly versioned historical failure reader, not cleanup proof.
// All current host/registry checks and the quarantine transaction stay shared.
function verifyCpuTimeoutInputs(root, profile, missing) {
  requireValue(missing ? profile.failureCase === 'cpu_timeout_missing_native_observation_v1' && profile.observation === null
    : profile.failureCase === 'cpu_timeout_observation_only_v1' && profile.observation && profile.missingObservationPath === null, 'missing_observation_case_invalid')
  const readBound = binding => {
    requireValue(binding && digest(binding.sha256), 'historical_binding_invalid')
    return readFile(scopedFile(root, binding.path), binding.sha256)
  }
  requireValue(Array.isArray(profile.programBindings) && profile.programBindings.length <= 16, 'program_bindings_invalid')
  for (const required of ['docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md', 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs', 'scripts/run-ai-painter-owned-worker-reboot-recovery.mjs', 'src/server/ai-painter-current-execution-registry.mjs']) {
    requireValue(profile.programBindings.some(b => b.path === required), 'required_program_not_bound')
  }
  for (const binding of profile.programBindings) readBound(binding)
  const norm = profile.programBindings.find(b => b.path === 'docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md')
  if (missing) requireValue(readBound(norm).toString('utf8').includes('AI-PAINTER-REVIEW-STORAGE-1.19'), 'missing_observation_rule_not_bound')
  const loaded = {}
  for (const key of ['guardSnapshot', 'started', 'build', 'failure', 'receipt', 'request', 'consumed', 'preBoot']) {
    requireValue(profile[key], `missing_${key}_binding`)
    const bytes = readBound(profile[key]); loaded[key] = { bytes, value: JSON.parse(bytes) }
  }
  const guard = loaded.guardSnapshot.value, started = loaded.started.value, build = loaded.build.value
  const failure = loaded.failure.value, receipt = loaded.receipt.value, request = loaded.request.value, consumed = loaded.consumed.value
  requireValue(profile.guard.path === GUARD && profile.registry.path === REGISTRY && digest(profile.registry.sha256)
    && sha256(loaded.guardSnapshot.bytes) === profile.guard.sha256 && guard.identity === profile.guardIdentity, 'historical_guard_identity_mismatch')
  const { ownerPid, commandBinding, ...startedGuard } = started
  requireValue(same(startedGuard, guard) && Number.isInteger(ownerPid) && ownerPid > 0, 'started_guard_mismatch')
  requireValue(typeof commandBinding === 'string' && Buffer.from(commandBinding, 'base64').toString('base64') === commandBinding, 'native_binding_mismatch')
  const command = JSON.parse(Buffer.from(commandBinding, 'base64').toString('utf8'))
  requireValue(same(command.guard, guard) && command.guardSha256 === profile.guard.sha256
    && same(command.nativeBuild, build) && path.resolve(command.scope) === root, 'native_chain_mismatch')
  requireValue(historicalProjectPath(root, guard.startedEvidence) === profile.started.path, 'native_scope_mismatch')
  requireValue(same(guard.nativeOwnerSource, build.source), 'native_source_mismatch')
  for (const [file, expected] of [[build.snapshot, build.source.sha256], [build.binary, build.binarySha256]]) readFile(scopedFile(root, historicalProjectPath(root, file)), expected)
  requireValue(path.dirname(build.snapshot) === path.dirname(build.binary), 'native_build_directory_mismatch')
  requireValue(profile.helperSnapshot?.sha256 === guard.helperSha256, 'helper_binding_mismatch'); readBound(profile.helperSnapshot)
  verifyExecutable(guard.executable, guard.executableSha256)

  const output = '.runtime/ai-painter/ecology-decode1-weight-quality-executions/' + request.runId
  requireValue(request.schema === 'ecology-decode1-weight-quality-cpu-request-v1'
    && /^[a-z0-9][a-z0-9-]{7,127}$/.test(request.runId) && typeof request.packageId === 'string'
    && profile.request.path === output + '/cpu-request.json' && request.outputRoot === output + '/cpu-entry'
    && profile.consumed.path === output + '/cpu-entry/consumed.json'
    && consumed.attempt === 1 && consumed.retries === 0 && referenceMatches(consumed.request, profile.request), 'failure_consumed_request_mismatch')
  requireValue(request.programBindings?.nativeOwnerSource?.sha256 === build.source.sha256
    && request.programBindings?.nativeRunner?.sha256 === guard.helperSha256, 'failure_request_source_mismatch')
  requireValue(profile.receipt.path === output + '/owned-cpu-' + guard.identity + '/release-receipt.json'
    && profile.failure.path.startsWith(output + '/native-failure-' + guard.identity + '-') && profile.failure.path.endsWith('.json'), 'failure_artifact_path_mismatch')
  requireValue(failure.schema === 'ecology-decode1-quality-native-failure-v1' && failure.status === 'failed_closed'
    && failure.executionState === 'failed_closed' && failure.phase === 'cpu' && failure.stage === 'preparation'
    && failure.callIdentity === guard.identity && failure.runId === request.runId && failure.packageId === request.packageId
    && typeof request.configuration?.capabilityVersion === 'string' && failure.capabilityVersion === request.configuration.capabilityVersion
    && failure.automaticRetries === 0 && failure.privateCpuFixture === false, 'failure_scope_invalid')
  for (const flag of ['cleanupQualificationGranted', 'guardReleaseGranted', 'normalWriteQualificationGranted']) requireValue(failure[flag] === false, 'failure_qualification_claimed')
  requireValue(receipt.schema === 'detail-weight-live-native-owner-receipt-v1' && receipt.phase === 'cpu'
    && receipt.stopReason === 'wall_timeout' && receipt.proof === null && receipt.ownerClosed === false
    && receipt.processCleanupConfirmed === false && receipt.cleanupConfirmed === false
    && receipt.ownerIdentity?.pid === ownerPid && receipt.ownerIdentity.identitySource === 'retained_child_handle'
    && receipt.guard?.identity === guard.identity && receipt.guard.state === 'retained'
    && historicalProjectPath(root, receipt.guard.path) === GUARD && same(receipt.nativeBuild, build), 'failure_receipt_mismatch')
  requireValue(failure.primaryError?.reason === 'wall_timeout'
    || failure.primaryError?.code === 'EPIPE' && failure.primaryError.reason === 'native_io_failure' && receipt.protocolError === 'Error: write EPIPE', 'failure_reason_not_supported')
  requireValue(failure.streamObservation?.closureVersion === null && failure.streamObservation?.stdoutClosed === null
    && failure.streamObservation?.stderrClosed === null && failure.streamObservation?.transportCompleted === null, 'failure_stream_proof_conflict')
  const expected = historicalProjectPath(root, path.join(path.dirname(build.binary), 'cleanup-observation.json'))
  let observation = null
  if (missing) {
    requireValue(profile.missingObservationPath === expected, 'missing_observation_path_mismatch')
    const parent = scopedFile(root, historicalProjectPath(root, build.binary))
    const directory = path.dirname(parent), beforeDirectory = fs.lstatSync(directory, { bigint: true })
    requireValue(beforeDirectory.isDirectory() && !beforeDirectory.isSymbolicLink(), 'native_build_directory_mismatch')
    try { fs.lstatSync(path.join(directory, 'cleanup-observation.json')); throw new Error('native_observation_exists') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const afterDirectory = fs.lstatSync(directory, { bigint: true })
    requireValue(afterDirectory.isDirectory() && !afterDirectory.isSymbolicLink()
      && afterDirectory.dev === beforeDirectory.dev && afterDirectory.ino === beforeDirectory.ino, 'native_build_directory_changed')
  } else {
    requireValue(profile.observation.path === expected, 'native_observation_path_mismatch')
    observation = JSON.parse(readBound(profile.observation))
    requireValue(observation.authority === 'observation_only_no_release_authority' && observation.assignedBeforeResume === true
      && observation.ownerPid === ownerPid && observation.bindingBase64 === commandBinding
      && Number.isInteger(observation.rootPid) && observation.rootPid > 0, 'observation_authority_invalid')
  }

  const pre = loaded.preBoot.value
  requireValue(pre.schema === (missing ? 'ai-painter-missing-native-observation-preboot-v1' : 'ai-painter-cpu-timeout-preboot-v1') && pre.guardIdentity === guard.identity
    && pre.nativeObservationMissing === missing && pre.missingObservationPath === (missing ? expected : null)
    && pre.cleanupAuthority === false && pre.recoveryExecuted === false, 'pre_boot_chain_mismatch')
  for (const key of ['guard', 'registry', 'started', 'build', 'failure', 'receipt', 'request', 'consumed', 'helperSnapshot']) requireValue(referenceMatches(pre.inputs?.[key], profile[key]), 'pre_boot_chain_mismatch')
  if (!missing) requireValue(referenceMatches(pre.inputs.observation, profile.observation), 'pre_boot_chain_mismatch')
  requireValue(pre.inputs.registry.revision === profile.registry.revision, 'pre_boot_chain_mismatch')
  requireValue(digest(pre.host?.MachineIdentitySha256) && pre.host.BootProvider === 'Microsoft-Windows-Kernel-General'
    && pre.host.BootEventId === 12 && Number.isSafeInteger(pre.host.BootEventRecordId)
    && Math.abs(time(pre.host.OsBootUtc) - time(pre.host.BootEventUtc)) <= 1000
    && time(guard.recordedAtUtc) < time(failure.recordedAtUtc) && time(failure.recordedAtUtc) < time(pre.host.ObservedUtc)
    && time(pre.host.ObservedUtc) <= time(pre.recordedAtUtc), 'pre_boot_host_observation_invalid')
  return { guard, guardBytes: loaded.guardSnapshot.bytes, started, observation, preBoot: { host: pre.host }, inputs: profile, nativeObservationMissing: missing }
}

export function evaluateRecovery({ historical, registry, host, currentGuardSha256, now = Date.now(), auditPid = process.pid }) {
  const errors = []
  const check = (condition, code) => { if (!condition) errors.push(code) }
  try {
    const { guard, started, observation, preBoot: pre, inputs } = historical
    const boot = time(host.OsBootUtc)
    const event = time(host.BootEventUtc)
    const observed = time(host.ObservedUtc)
    check(digest(host.MachineIdentitySha256) && host.MachineIdentitySha256 === pre.host.MachineIdentitySha256, 'REC-BOOT-001:host_identity_mismatch')
    check(host.BootProvider === 'Microsoft-Windows-Kernel-General' && host.BootEventId === 12 && Number.isSafeInteger(host.BootEventRecordId) && host.BootEventRecordId > pre.host.BootEventRecordId, 'REC-BOOT-001:boot_event_not_new')
    check(Math.abs(boot - event) <= 1000 && boot > time(pre.host.ObservedUtc) && boot > time(guard.recordedAtUtc) && boot > time(pre.host.OsBootUtc), 'REC-BOOT-001:new_kernel_boot_not_proven')
    check(observed >= boot && Math.abs(now - observed) <= 30000, 'REC-BOOT-001:host_query_not_fresh')
    check(registry.ok === true && registry.registrySha256 === inputs.registry.sha256 && registry.registry?.registryRevision === inputs.registry.revision && registry.registry?.activeExecution === null, 'REC-BOOT-003:registry_conflict_or_unverified')
    check(currentGuardSha256 === inputs.guard.sha256, 'REC-BOOT-002:current_guard_mismatch')
    check(host.ProcessQueryComplete === true && Array.isArray(host.Processes) && host.Processes.length <= 8192, 'REC-BOOT-003:process_query_incomplete')
    const oldPids = new Set([guard.runnerPid, started.ownerPid, observation?.rootPid].filter(pid => Number.isInteger(pid) && pid > 0))
    const seen = new Set()
    for (const p of host.Processes ?? []) {
      check(Number.isInteger(p.Pid) && p.Pid >= 0 && !seen.has(p.Pid), 'REC-BOOT-003:process_identity_invalid')
      seen.add(p.Pid)
      if (p.Pid === auditPid) continue
      const executableName = String(p.Name ?? '').toLowerCase()
      const candidate = /^(node|python|pythonw|owner)\.exe$/.test(executableName) || oldPids.has(p.Pid)
      if (!candidate) continue
      const complete = p.ExecutablePath && p.CommandLine && p.CreationUtc
      check(Boolean(complete), 'REC-BOOT-003:candidate_identity_incomplete')
      if (!complete) continue
      const created = time(p.CreationUtc)
      check(created >= boot - 1000 && created <= observed + 1000, 'REC-BOOT-003:process_creation_conflict')
      const command = `${p.ExecutablePath} ${p.CommandLine}`.toLowerCase()
      const related = command.includes(guard.identity) || command.includes('owned-worker-guards') || /(?:ai-painter|m-c4-01).*(?:training|cpu-acceptance|owner\.exe|capture)/.test(command)
      check(!related, 'REC-BOOT-003:conflicting_worker_present')
    }
  } catch (error) { errors.push(`evidence_invalid:${error.message}`) }
  return { status: errors.length ? 'blocked' : 'eligible_for_quarantine', errors: [...new Set(errors)], historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false }
}

export function queryNativeHost() {
  requireValue(process.platform === 'win32', 'windows_native_query_required')
  const script = String.raw`$ErrorActionPreference='Stop'
$os=Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
$event=Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-General';Id=12} -MaxEvents 1 -ErrorAction Stop
$machine=(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid
$hash=[Security.Cryptography.SHA256]::Create()
try {$machineHash=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($machine)))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
$processes=@(Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object { [pscustomobject]@{Pid=[int]$_.ProcessId;Name=$_.Name;ExecutablePath=$_.ExecutablePath;CommandLine=$_.CommandLine;CreationUtc=if($_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{$null}} })
[pscustomobject]@{MachineIdentitySha256=$machineHash;BootProvider=$event.ProviderName;BootEventId=$event.Id;BootEventRecordId=[long]$event.RecordId;BootEventUtc=$event.TimeCreated.ToUniversalTime().ToString('o');OsBootUtc=$os.LastBootUpTime.ToUniversalTime().ToString('o');ObservedUtc=[DateTime]::UtcNow.ToString('o');ProcessQueryComplete=$true;Processes=$processes}|ConvertTo-Json -Depth 5 -Compress`
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000, maxBuffer: MAX_FILE, encoding: 'utf8' })
  requireValue(!result.error && result.status === 0, 'native_host_query_failed')
  return JSON.parse(result.stdout.trim().replace(/^\uFEFF/, ''))
}

export async function auditBoundRecovery(root, bound) {
  const historical = verifyHistoricalInputs(root, bound.profile)
  const host = queryNativeHost()
  const registry = await readCurrentExecutionRegistry(root)
  const active = path.join(root, GUARD)
  const currentGuardSha256 = fs.existsSync(active) ? sha256(readFile(active)) : null
  const decision = evaluateRecovery({ historical, registry, host, currentGuardSha256 })
  if (bound.profile.schema === 'ai-painter-owned-worker-reboot-recovery-profile-v3') {
    requireValue(registry.ok && registry.registry?.activeExecution === null, 'interruption_terminal_not_registered')
    requireValue(registry.currentTaskTerminal?.schemaVersion === 'ai-painter-training-system-interruption-terminal-v1'
      && registry.currentTaskTerminal.profileSha256 === bound.profileSha256
      && referenceMatches(registry.currentTaskTerminal.originalRegistry, bound.profile.registry)
      && registry.currentTaskTerminal.status === 'training_system_interrupted', 'interruption_terminal_mismatch')
    const adjusted = { ...registry, registrySha256: bound.profile.registry.sha256,
      registry: { ...registry.registry, registryRevision: bound.profile.registry.revision } }
    Object.assign(decision, evaluateRecovery({ historical, registry: adjusted, host, currentGuardSha256 }))
    requireValue(time(host.OsBootUtc) > time(historical.progress.updatedAtUtc), 'interruption_boot_before_progress')
  }
  return { ...decision, schema: 'ai-painter-owned-worker-reboot-recovery-audit-v1', caseId: bound.profile.caseId, recordedAtUtc: new Date().toISOString(), profileSha256: bound.profileSha256, nativeObservationMissing: historical.nativeObservationMissing === true, failure: bound.profile.failure, receipt: bound.profile.receipt ?? null, host, registry: { ok: registry.ok, errorCode: registry.errorCode ?? null, sha256: registry.registrySha256, revision: registry.registry?.registryRevision ?? null, activeExecution: registry.registry?.activeExecution ?? null }, guardSha256: currentGuardSha256 }
}

// Original source bytes may be embedded in a hash-bound immutable ledger after an
// approved repair. This reader is used only for historical interruption evidence.
export function readInterruptionBinding(root, profile, binding) {
  requireValue(binding && digest(binding.sha256), 'interruption_binding_invalid')
  const saved = (profile.byteLedgers ?? []).find(item => referenceMatches(item.original, binding))
  if (!saved) return readFile(scopedFile(root, binding.path), binding.sha256)
  const ledger = JSON.parse(readFile(scopedFile(root, saved.ledger.path), saved.ledger.sha256))
  const entries = Array.isArray(ledger) ? ledger : ledger.sources
  requireValue(Array.isArray(entries), 'interruption_byte_ledger_invalid')
  const candidates = entries.filter(item => item.path === binding.path && item.sha256 === binding.sha256)
  requireValue(candidates.length === 1 && typeof candidates[0].utf8 === 'string', 'interruption_original_bytes_missing')
  const bytes = Buffer.from(candidates[0].utf8, 'utf8')
  requireValue(sha256(bytes) === binding.sha256, 'interruption_original_bytes_mismatch')
  return bytes
}

function requireAbsent(root, relative) {
  const parent = fs.realpathSync(path.dirname(path.resolve(root, relative)))
  requireValue(parent === fs.realpathSync(path.resolve(root, path.dirname(relative))), 'interruption_parent_changed')
  try { fs.lstatSync(path.join(parent, path.basename(relative))); throw new Error('interruption_original_terminal_or_observation_present') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

export function verifyTrainingKernelInputs(root, profile) {
  requireValue(profile.failureCase === 'training_kernel_interruption_v1', 'interruption_case_invalid')
  requireValue(Array.isArray(profile.byteLedgers) && profile.byteLedgers.length <= 16, 'interruption_ledgers_invalid')
  const seen = new Set()
  for (const item of profile.byteLedgers) {
    requireValue(item.original && digest(item.original.sha256) && !seen.has(item.original.path), 'interruption_ledger_duplicate')
    seen.add(item.original.path)
    readInterruptionBinding(root, profile, item.original)
  }
  requireValue(Array.isArray(profile.programBindings) && profile.programBindings.length <= 16, 'program_bindings_invalid')
  for (const required of ['docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md', 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs', 'scripts/run-ai-painter-owned-worker-reboot-recovery.mjs', 'src/server/ai-painter-current-execution-registry.mjs']) {
    requireValue(profile.programBindings.some(b => b.path === required), 'required_program_not_bound')
  }
  for (const binding of profile.programBindings) readFile(scopedFile(root, binding.path), binding.sha256)
  const rule = profile.programBindings.find(b => b.path === 'docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md')
  requireValue(readFile(scopedFile(root, rule.path), rule.sha256).toString('utf8').includes('training_kernel_interruption_v1'), 'interruption_rule_not_bound')
  const cache = new Map()
  let evidenceBytes = 0
  const read = binding => {
    const key = `${binding?.path}:${binding?.sha256}`
    if (!cache.has(key)) {
      const bytes = readInterruptionBinding(root, profile, binding)
      evidenceBytes += bytes.length
      requireValue(evidenceBytes <= 16 * 1024 * 1024, 'interruption_input_budget_exceeded')
      cache.set(key, bytes)
    }
    return cache.get(key)
  }
  const value = binding => JSON.parse(read(binding))
  const guardBytes = read(profile.guard), guard = JSON.parse(guardBytes)
  const registry = value(profile.registry), started = value(profile.started), build = value(profile.build)
  const plan = value(profile.plan), pkg = value(profile.executionPackage), progress = value(profile.progress)
  requireValue(plan.schema === 'ecology-decode1-weight-quality-plan-v1'
    && pkg.schemaVersion === 'ai-painter-autonomous-closed-loop-package-v1', 'interruption_original_schema_invalid')
  requireValue(profile.guard.path === GUARD && profile.registry.path === REGISTRY
    && profile.registry.revision === registry.registryRevision && guard.identity === profile.guardIdentity, 'interruption_original_identity_invalid')
  const active = registry.activeExecution
  requireValue(active && registry.executionState === 'executing' && active.executionState === 'executing'
    && active.processId === guard.runnerPid && registry.runId === plan.runId && registry.packageId === plan.packageId
    && registry.capabilityVersion === plan.capabilityVersion && pkg.packageIdentity === plan.packageId
    && pkg.capabilityVersion === plan.capabilityVersion, 'interruption_run_package_mismatch')
  requireValue(referenceMatches(active.lock, profile.executionLock), 'interruption_lock_binding_mismatch')
  const lock = value(profile.executionLock)
  for (const key of ['runId', 'packageId', 'capabilityVersion', 'processId', 'processStartIdentity']) {
    requireValue(lock[key] === active[key], 'interruption_execution_lock_mismatch')
  }
  requireValue(profile.heartbeat.path === active.heartbeat.path && active.heartbeat.ttlSeconds === 120, 'interruption_heartbeat_path_mismatch')
  const heartbeatBytes = read(profile.heartbeat)
  requireValue(heartbeatBytes.length > 0 && heartbeatBytes.length <= 65536, 'interruption_heartbeat_size_invalid')
  if (!heartbeatBytes.every(byte => byte === 0)) {
    const heartbeat = JSON.parse(heartbeatBytes)
    requireValue(heartbeat.schemaVersion === 'ai-painter-current-active-execution-heartbeat-v1'
      && heartbeat.executionState === 'executing' && heartbeat.ttlSeconds === active.heartbeat.ttlSeconds, 'interruption_heartbeat_invalid')
    for (const key of ['runId', 'packageId', 'capabilityVersion', 'processId', 'processStartIdentity']) requireValue(heartbeat[key] === active[key], 'interruption_heartbeat_identity_mismatch')
    requireValue(Date.now() - time(heartbeat.heartbeatAtUtc) > active.heartbeat.ttlSeconds * 1000, 'interruption_heartbeat_not_expired')
  }
  requireValue(progress.runId === plan.runId && progress.packageId === plan.packageId && progress.capabilityVersion === plan.capabilityVersion
    && progress.executionState === 'executing' && progress.selectedCheckpoint === null
    && Number.isSafeInteger(progress.optimizerStepsGenerator) && progress.optimizerStepsGenerator > 0 && progress.optimizerStepsGenerator <= 576
    && Number.isSafeInteger(progress.optimizerStepsDiscriminator) && progress.optimizerStepsDiscriminator > 0 && progress.optimizerStepsDiscriminator <= 576, 'interruption_progress_mismatch')
  const output = '.runtime/ai-painter/ecology-decode1-weight-quality-executions/' + plan.runId
  requireValue(plan.outputRoot === output && profile.plan.path === output + '/quality-plan.json'
    && profile.progress.path === output + '/progress.json' && profile.executionLock.path === output + '/execution-lock.json', 'interruption_output_scope_invalid')
  requireValue(pkg.inputEvidence.some(item => referenceMatches(item, profile.plan)), 'interruption_package_plan_mismatch')
  for (const key of ['trainingConsumed', 'executionConsumed']) {
    const consumed = value(profile[key])
    requireValue(profile[key].path === output + (key === 'trainingConsumed' ? '/training-consumed.json' : '/execution-consumed.json')
      && consumed.attempt === 1 && consumed.automaticRetries === 0 && referenceMatches(consumed.executionPackage, profile.executionPackage), 'interruption_consumption_mismatch')
  }
  requireValue(Object.keys(active.programLineage).length === Object.keys(pkg.programLineage).length
    && Object.entries(active.programLineage).every(([role, binding]) => binding.sha256 === pkg.programLineage[role]
      && referenceMatches(binding, plan.programBindings[role])), 'interruption_lineage_mismatch')
  for (const bindings of [plan.programBindings, active.programLineage]) {
    requireValue(bindings && Object.keys(bindings).length > 0 && Object.keys(bindings).length <= 256, 'interruption_lineage_limit_invalid')
    for (const binding of Object.values(bindings)) read(binding)
  }
  const { ownerPid, commandBinding, ...startedGuard } = started
  requireValue(same(startedGuard, guard) && Number.isInteger(ownerPid) && ownerPid > 0, 'started_guard_mismatch')
  const command = JSON.parse(Buffer.from(commandBinding, 'base64').toString('utf8'))
  requireValue(same(command.guard, guard) && command.guardSha256 === profile.guard.sha256
    && same(command.nativeBuild, build) && path.resolve(command.scope) === path.resolve(root), 'native_chain_mismatch')
  requireValue(historicalProjectPath(root, guard.startedEvidence) === profile.started.path
    && same(guard.nativeOwnerSource, build.source), 'native_scope_mismatch')
  for (const [file, expected] of [[build.snapshot, build.source.sha256], [build.binary, build.binarySha256]]) readFile(scopedFile(root, historicalProjectPath(root, file)), expected)
  requireValue(profile.helperSnapshot.sha256 === guard.helperSha256, 'helper_binding_mismatch'); read(profile.helperSnapshot)
  verifyExecutable(guard.executable, guard.executableSha256)
  requireValue(profile.missingObservationPath === historicalProjectPath(root, path.join(path.dirname(build.binary), 'cleanup-observation.json')), 'missing_observation_path_mismatch')
  requireAbsent(root, profile.missingObservationPath)
  for (const name of ['worker-terminal.json', 'finalization.json']) requireAbsent(root, output + '/' + name)
  const preBoot = value(profile.preBoot)
  requireValue(preBoot.host && digest(preBoot.host.MachineIdentitySha256)
    && preBoot.host.BootProvider === 'Microsoft-Windows-Kernel-General' && preBoot.host.BootEventId === 12
    && Math.abs(time(preBoot.host.OsBootUtc) - time(preBoot.host.BootEventUtc)) <= 1000
    && time(preBoot.host.ObservedUtc) >= time(preBoot.host.OsBootUtc)
    && time(preBoot.host.ObservedUtc) < time(guard.recordedAtUtc)
    && time(progress.updatedAtUtc) > time(guard.recordedAtUtc), 'interruption_prior_host_invalid')
  return { guard, guardBytes, started, observation: null, preBoot, progress, registry, plan, inputs: profile, nativeObservationMissing: true,
    readProgramBinding: binding => ({ path: binding.path, sha256: binding.sha256, bytes: read(binding) }) }
}

export function verifyKernelInterruptionHost(historical, host, auditPid = process.pid) {
  const inputs = historical.inputs
  const registry = { ok: true, registrySha256: inputs.registry.sha256, registry: { registryRevision: inputs.registry.revision, activeExecution: null } }
  const result = evaluateRecovery({ historical, registry, host, currentGuardSha256: inputs.guard.sha256, auditPid })
  requireValue(result.status === 'eligible_for_quarantine', result.errors.join(';') || 'interruption_host_blocked')
  requireValue(time(host.OsBootUtc) > time(historical.progress.updatedAtUtc), 'interruption_boot_before_progress')
  return result
}

export function verifyLiveInterruptionGuard(root, profile) {
  readFile(scopedFile(root, GUARD), profile.guard.sha256)
}

export async function registerTrainingKernelInterruption(root, bound) {
  const historical = verifyTrainingKernelInputs(root, bound.profile)
  const host = queryNativeHost()
  verifyKernelInterruptionHost(historical, host)
  const base = path.join(root, '.runtime/ai-painter/owned-worker-guards', `reboot-recovery-${bound.profile.caseId}`)
  // Registry records live outside the quarantine transaction's private archive.
  const records = base + '-registration'
  fs.mkdirSync(records, { recursive: true })
  requireValue(!fs.lstatSync(records).isSymbolicLink(), 'interruption_record_directory_invalid')
  const reportPath = historicalProjectPath(root, path.join(records, 'report.json'))
  const terminalPath = historicalProjectPath(root, path.join(records, 'terminal.json'))
  const capsulePath = historicalProjectPath(root, path.join(records, 'capsule.json'))
  const identities = { capabilityVersion: historical.registry.capabilityVersion, packageId: historical.registry.packageId, runId: historical.registry.runId }
  if (!fs.existsSync(path.join(records, 'report.json'))) {
    writeExclusive(path.join(records, 'report.json'), { schemaVersion: 'ai-painter-training-system-interruption-report-v1',
      recordedAtUtc: new Date().toISOString(), ...identities, profileSha256: bound.profileSha256,
      originalRegistry: bound.profile.registry, heartbeat: bound.profile.heartbeat, host,
      lastDurableProgress: historical.progress, modelRootCauseEstablished: false,
      historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false })
  }
  const reportBytes = readFile(path.join(records, 'report.json'))
  requireValue(JSON.parse(reportBytes).profileSha256 === bound.profileSha256, 'interruption_report_conflict')
  if (!fs.existsSync(path.join(records, 'terminal.json'))) {
    writeExclusive(path.join(records, 'terminal.json'), { schemaVersion: 'ai-painter-training-system-interruption-terminal-v1',
      recordedAtUtc: new Date().toISOString(), ...identities, executionState: 'failed_closed', status: 'training_system_interrupted',
      profileSha256: bound.profileSha256, originalRegistry: bound.profile.registry,
      recoveryReport: { path: reportPath, sha256: sha256(reportBytes) }, lastDurableProgress: historical.progress,
      selectedCheckpoint: null, historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false })
  }
  const terminalBytes = readFile(path.join(records, 'terminal.json'))
  requireValue(JSON.parse(terminalBytes).profileSha256 === bound.profileSha256, 'interruption_terminal_conflict')
  if (!fs.existsSync(path.join(records, 'capsule.json'))) {
    writeExclusive(path.join(records, 'capsule.json'), { schemaVersion: 'ai-painter-local-task-capsule-v1', integrity: { status: 'verified' },
      evidence: [{ path: reportPath, sha256: sha256(reportBytes), kind: 'system_interruption_report', sha256Verified: true },
        { path: terminalPath, sha256: sha256(terminalBytes), kind: 'system_interruption_terminal', sha256Verified: true }] })
  }
  const current = await readCurrentExecutionRegistry(root)
  if (current.ok && current.currentTaskTerminal?.profileSha256 === bound.profileSha256) return current
  readFile(path.join(root, GUARD), bound.profile.guard.sha256)
  const claimPath = path.join(root, '.runtime/ai-painter/current-execution-registry/writer.claim.json')
  if (fs.existsSync(claimPath)) {
    const claim = JSON.parse(readFile(claimPath))
    requireValue(/^[a-zA-Z0-9_-]+$/.test(claim.transactionId), 'interruption_writer_transaction_invalid')
    const txn = JSON.parse(readFile(path.join(root, '.runtime/ai-painter/current-execution-registry/transactions', claim.transactionId, 'transaction.pending.json')))
    const staged = JSON.parse(readFile(scopedFile(root, txn.currentStaged.path), txn.currentStaged.sha256))
    requireValue(txn.previousCurrentSha256 === bound.profile.registry.sha256 && staged.terminalEvidence.path === terminalPath
      && staged.terminalEvidence.sha256 === sha256(terminalBytes) && staged.runId === identities.runId
      && staged.activeExecution === null && staged.executionState === 'failed_closed'
      && time(host.OsBootUtc) > time(claim.claimedAtUtc), 'interruption_pending_writer_conflict')
    return recoverPreparedCurrentExecutionRegistryAdvance({ projectRoot: root, transactionId: claim.transactionId })
  }
  readFile(path.join(root, REGISTRY), bound.profile.registry.sha256)
  return recoverExpiredActiveExecutionToFailedClosed({ projectRoot: root, ...identities,
    taskCapsulePath: capsulePath, terminalEvidencePath: terminalPath,
    expectedPreviousRegistryRevision: bound.profile.registry.revision, expectedPreviousRegistrySha256: bound.profile.registry.sha256,
    kernelInterruptionProfile: { path: bound.profilePath, sha256: bound.profileSha256 } })
}

function writeExclusive(file, value) {
  const bytes = jsonBytes(value)
  requireValue(bytes.length <= MAX_FILE, 'output_budget_exceeded')
  const fd = fs.openSync(file, 'wx')
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  return sha256(bytes)
}

function compareExchangeClaim(file, expected, bytes) {
  requireValue(process.platform === 'win32', 'windows_exclusive_claim_exchange_required')
  // FileShare.None serializes the exact-byte compare and replacement, even across contenders.
  const script = String.raw`$ErrorActionPreference='Stop'
$file=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:AP_REC_FILE))
$next=[Convert]::FromBase64String($env:AP_REC_NEXT)
$stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try {
  $hash=[Security.Cryptography.SHA256]::Create()
  try {$actual=([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-','').ToLowerInvariant()} finally {$hash.Dispose()}
  if($actual -ne $env:AP_REC_EXPECTED){throw 'claim_changed_before_exchange'}
  $stream.Position=0; $stream.SetLength(0); $stream.Write($next,0,$next.Length); $stream.Flush($true)
} finally {$stream.Dispose()}`
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 10000, maxBuffer: 65536, encoding: 'utf8', env: { ...process.env, AP_REC_FILE: Buffer.from(file).toString('base64'), AP_REC_NEXT: bytes.toString('base64'), AP_REC_EXPECTED: expected } })
  requireValue(!result.error && result.status === 0, 'exclusive_claim_exchange_failed')
}

function admissibleAudit(audit, bound, missingGuardAllowed = false) {
  return audit.profileSha256 === bound.profileSha256 && (audit.status === 'eligible_for_quarantine' && audit.guardSha256 === bound.profile.guard.sha256 || missingGuardAllowed && audit.status === 'blocked' && audit.guardSha256 === null && audit.errors?.length === 1 && audit.errors[0] === 'REC-BOOT-002:current_guard_mismatch')
}

async function acquireRecoveryClaim(file, record, bound, verify, retirementRoot, missingGuardAllowed) {
  const bytes = jsonBytes(record)
  try { const fd = fs.openSync(file, 'wx'); try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }; return bytes }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  const oldBytes = readFile(file)
  let old
  try { old = JSON.parse(oldBytes) } catch { throw new Error('unknown_recovery_claim_retained') }
  requireValue(old.recoveryCaseId === bound.profile.caseId && old.profileSha256 === bound.profileSha256 && old.guardSha256 === bound.profile.guard.sha256 && old.schemaVersion === record.schemaVersion && typeof old.token === 'string', 'unknown_recovery_claim_retained')
  const audit = await verify()
  requireValue(admissibleAudit(audit, bound, missingGuardAllowed), 'recovery_claim_audit_blocked')
  requireValue(audit.host.MachineIdentitySha256 === old.machineIdentitySha256 && time(audit.host.OsBootUtc) > time(old.claimedAtUtc) && time(audit.host.OsBootUtc) > time(old.kernelBootUtc), 'recovery_claim_requires_new_kernel_boot')
  writeExclusive(path.join(retirementRoot, `retired-claim-${randomUUID()}.json`), { schema: 'ai-painter-recovery-claim-retirement-v1', previousBytesBase64: oldBytes.toString('base64'), previousSha256: sha256(oldBytes), nativeAudit: audit, historicalCleanupCertified: false })
  compareExchangeClaim(file, sha256(oldBytes), bytes)
  return bytes
}

// Used only with the fresh native verifier by the CLI; injectable verification is for isolated tests.
export async function quarantineRecovery(root, bound, verify, checkpoint = () => {}) {
  const base = fs.realpathSync(path.join(root, '.runtime/ai-painter/owned-worker-guards'))
  const source = path.join(base, 'active.json')
  const transaction = path.join(base, `reboot-recovery-${bound.profile.caseId}`)
  const lease = path.join(base, 'reboot-recovery.claim.json')
  const writerLease = path.join(root, '.runtime/ai-painter/current-execution-registry/writer.claim.json')
  const missingGuardAllowed = fs.existsSync(path.join(transaction, 'intent.json')) && !fs.existsSync(source)
  // Completed transactions require only immutable readback, not a new eligibility grant.
  const completed = fs.existsSync(path.join(transaction, 'result.json'))
  const preliminary = completed ? {} : await verify()
  requireValue(completed || admissibleAudit(preliminary, bound, missingGuardAllowed), 'quarantine_precheck_blocked')
  const common = { recoveryCaseId: bound.profile.caseId, profileSha256: bound.profileSha256, guardSha256: bound.profile.guard.sha256, token: randomUUID(), processId: process.pid, claimedAtUtc: new Date().toISOString(), machineIdentitySha256: preliminary.host?.MachineIdentitySha256, kernelBootUtc: preliminary.host?.OsBootUtc }
  const leaseBytes = await acquireRecoveryClaim(lease, { ...common, schemaVersion: 'ai-painter-reboot-recovery-lease-v1' }, bound, verify, base, missingGuardAllowed)
  let writerBytes = null
  try {
    if (!completed) {
      const self = preliminary.host?.Processes?.find(p => p.Pid === process.pid)
      requireValue(self?.CreationUtc, 'recovery_process_identity_missing')
      writerBytes = await acquireRecoveryClaim(writerLease, { ...common, schemaVersion: 'ai-painter-current-execution-registry-writer-claim-v1', transactionId: `current-execution-registry-reboot-recovery-${randomUUID()}`, processStartIdentity: `${process.pid}:${self.CreationUtc}` }, bound, verify, base, missingGuardAllowed)
      checkpoint('claims_acquired')
    }
    if (fs.existsSync(transaction)) requireValue(fs.lstatSync(transaction).isDirectory() && !fs.lstatSync(transaction).isSymbolicLink(), 'transaction_path_invalid')
    else fs.mkdirSync(transaction)
    const target = path.join(transaction, 'guard.json')
    const intentFile = path.join(transaction, 'intent.json')
    const resultFile = path.join(transaction, 'result.json')
    let intent
    let recoveredSameTransaction = false
    if (fs.existsSync(intentFile)) {
      intent = JSON.parse(readFile(intentFile))
      requireValue(intent.schema === 'ai-painter-reboot-recovery-intent-v1' && intent.caseId === bound.profile.caseId && intent.profileSha256 === bound.profileSha256 && intent.guardSha256 === bound.profile.guard.sha256, 'transaction_identity_mismatch')
      const audit = JSON.parse(readFile(path.join(transaction, 'audit.json'), intent.auditSha256))
      requireValue(audit.status === 'eligible_for_quarantine' && audit.profileSha256 === bound.profileSha256 && audit.guardSha256 === bound.profile.guard.sha256, 'transaction_audit_invalid')
      recoveredSameTransaction = true
      if (fs.existsSync(resultFile)) {
        const result = JSON.parse(readFile(resultFile))
        requireValue(result.status === 'quarantined_not_cleanup_certified' && result.intentSha256 === sha256(readFile(intentFile)) && result.profileSha256 === bound.profileSha256 && result.guardSha256 === bound.profile.guard.sha256 && result.historicalCleanupCertified === false && result.oldExecutionMayReplay === false && result.trainingQualificationGranted === false, 'transaction_result_invalid')
        readFile(target, bound.profile.guard.sha256)
        // A completed readback does not release or alter any subsequently created guard.
        return { ...result, completedReadbackOnly: true }
      }
    } else {
      requireValue(fs.readdirSync(transaction).length === 0, 'archive_conflict')
      const audit = await verify()
      requireValue(admissibleAudit(audit, bound), 'quarantine_precheck_blocked')
      const auditSha256 = writeExclusive(path.join(transaction, 'audit.json'), audit)
      intent = { schema: 'ai-painter-reboot-recovery-intent-v1', caseId: bound.profile.caseId, transactionId: randomUUID(), recordedAtUtc: new Date().toISOString(), profileSha256: bound.profileSha256, guardSha256: bound.profile.guard.sha256, auditSha256 }
      writeExclusive(intentFile, intent)
      checkpoint('intent_saved')
    }
    const hasSource = fs.existsSync(source)
    const hasTarget = fs.existsSync(target)
    requireValue(!(hasSource && hasTarget) && (hasSource || hasTarget), 'guard_locations_conflict')
    if (hasSource) {
      readFile(source, bound.profile.guard.sha256)
      const finalAudit = await verify()
      requireValue(admissibleAudit(finalAudit, bound), 'quarantine_recheck_blocked')
      readFile(source, bound.profile.guard.sha256)
      requireValue(!fs.existsSync(target), 'archive_conflict')
      // The exclusively created transaction directory is private to this lease.
      fs.renameSync(source, target)
      checkpoint('guard_moved')
    } else {
      readFile(target, bound.profile.guard.sha256)
      const resumed = await verify()
      requireValue(admissibleAudit(resumed, bound, true), 'interrupted_recheck_blocked')
    }
    readFile(target, bound.profile.guard.sha256)
    requireValue(!fs.existsSync(source), 'new_guard_conflict')
    const result = { schema: 'ai-painter-owned-worker-reboot-recovery-result-v1', caseId: intent.caseId, transactionId: intent.transactionId, recordedAtUtc: new Date().toISOString(), status: 'quarantined_not_cleanup_certified', profileSha256: bound.profileSha256, guardSha256: bound.profile.guard.sha256, archivePath: historicalProjectPath(root, target), intentSha256: sha256(readFile(intentFile)), recoveredSameTransaction, nativeObservationMissing: ['ai-painter-owned-worker-reboot-recovery-profile-v2', 'ai-painter-owned-worker-reboot-recovery-profile-v3'].includes(bound.profile.schema), failure: bound.profile.failure ?? null, receipt: bound.profile.receipt ?? null, historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false }
    writeExclusive(resultFile, result)
    return result
  } finally {
    // PID absence alone never seizes a lease. Hard crashes retain both claims until a proven later kernel boot.
    if (writerBytes && fs.existsSync(writerLease) && fs.readFileSync(writerLease).equals(writerBytes)) fs.unlinkSync(writerLease)
    if (fs.existsSync(lease) && fs.readFileSync(lease).equals(leaseBytes)) fs.unlinkSync(lease)
  }
}

export function saveRecoveryAudit(root, relative, audit) {
  const absolute = path.resolve(root, relative)
  const base = fs.realpathSync(path.join(root, '.runtime/ai-painter'))
  const parent = fs.realpathSync(path.dirname(absolute))
  const rel = path.relative(base, parent)
  requireValue(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'audit_output_outside_runtime')
  return writeExclusive(path.join(parent, path.basename(absolute)), audit)
}
