import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { verifyHistoricalFailure, normalizePreBootObservation, historicalProjectPath, evaluateRecovery, verifyHistoricalInputs, loadRecoveryProfile } from '../lib/ai-painter-owned-worker-reboot-recovery-v1.mjs'

const hash = 'a'.repeat(64), digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const reference = name => ({ path: name, sha256: hash })
function fixture() {
  const files = new Map()
  const put = (file, value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    files.set(file, bytes); return { path: file, sha256: digest(bytes) }
  }
  const read = binding => {
    assert.ok(files.has(binding.path), 'private fixture import only')
    const raw = files.get(binding.path); assert.equal(digest(raw), binding.sha256); return raw
  }
  const profile = { guard: reference('.runtime/ai-painter/owned-worker-guards/active.json'),
    registry: { ...reference('.runtime/ai-painter/current-execution-registry/current.json'), revision: 409 },
    started: reference('fixture-started.json'), build: reference('fixture-build.json'), observation: reference('fixture-observation.json'),
    failure: reference('fixture-failure.json'), programBindings: [] }
  const guard = { identity: 'fixture-guard', runnerPid: 10, recordedAtUtc: '2026-10-11T01:00:00.000Z' }
  const runId = 'fixture-recovery-run', output = '.runtime/ai-painter/ecology-decode1-weight-quality-executions/' + runId
  const request = put(output + '/cpu-request.json', { schema: 'ecology-decode1-weight-quality-cpu-request-v1', runId,
    packageId: 'fixture-package', outputRoot: output + '/cpu-entry' })
  const consumed = put(output + '/cpu-entry/consumed.json', { attempt: 1, retries: 0, request })
  const nativeErrorEvidence = put(profile.observation.path + '.error', Buffer.from('System.Exception: stream close unconfirmed\r\n   fixture stack\r\n'))
  const failure = { schema: 'controller-ns003-pretraining-failure-handoff-v1', status: 'failed_closed_owned_cpu_receipt_unavailable_guard_retained',
    recovery: { identity: guard.identity, guard: profile.guard, retained: true, guardRemoved: false, liveCleanupConfirmed: false, storedObservationUsedAsReleaseAuthority: false },
    registry: { binding: profile.registry, revision: 409, activeExecution: null },
    results: { trainingStarted: false, gpuQualificationExecuted: false, realOptimizerUpdates: 0 },
    independentComponents: { fullOwnedCpuAdmissionGranted: false },
    attempt: { commandMode: 'prepare-only', attempts: 1, automaticRetries: 0, cpuReportPresent: false, cpuAcceptancePresent: false,
      runId, packageId: 'fixture-package', request, consumed },
    failure: { observation: profile.observation, observationHasReleaseAuthority: false, nativeError: 'stream close unconfirmed', nativeErrorEvidence } }
  profile.preBootProgramSnapshot = put('fixture-provider.mjs', Buffer.from('// private historical provider snapshot'))
  profile.programBindings.push(profile.preBootProgramSnapshot)
  const pre = { schema: 'controller-current-guard-recovery-readonly-review-v1', recordedAtUtc: '2026-10-12T02:01:00.000Z', caseGuardIdentity: guard.identity,
    inputs: { guard: profile.guard, registry: profile.registry, started: profile.started, build: profile.build, observation: profile.observation,
      failure: profile.failure, recoveryProgram: { path: 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs', sha256: profile.preBootProgramSnapshot.sha256 } },
    checks: { activeExecution: null, registryRevision: 409 },
    effects: { guardChanged: false, registryChanged: false, recoveryApplied: false, historicalCleanupCertified: false, oldExecutionMayReplay: false },
    host: { MachineIdentitySha256: 'b'.repeat(64), BootProvider: 'Microsoft-Windows-Kernel-General', BootEventId: 12,
      BootEventRecordId: 10, OsBootUtc: '2026-10-12T01:00:00.000Z', BootEventUtc: '2026-10-12T01:00:00.500Z', ObservedUtc: '2026-10-12T02:00:00.000Z' } }
  return { profile, guard, failure, pre, files, read, put }
}

test('actual stream-close failure format requires original request, consumption and native error evidence, never qualification', () => {
  const f = fixture(); verifyHistoricalFailure(f.failure, f.profile, f.guard, f.read)
})
for (const [name, change] of [
  ['unknown failure schema', f => { f.failure.schema = 'unknown' }],
  ['wrong guard identity', f => { f.failure.recovery.identity = 'other' }],
  ['different observation bytes', f => { f.failure.failure.observation = { ...f.profile.observation, sha256: '0'.repeat(64) } }],
  ['claim of live cleanup', f => { f.failure.recovery.liveCleanupConfirmed = true }],
  ['claim of observation authority', f => { f.failure.recovery.storedObservationUsedAsReleaseAuthority = true }],
  ['claim of CPU acceptance', f => { f.failure.independentComponents.fullOwnedCpuAdmissionGranted = true }],
  ['claimed training', f => { f.failure.results.trainingStarted = true }],
  ['claimed updates', f => { f.failure.results.realOptimizerUpdates = 1 }],
  ['changed registry', f => { f.failure.registry = { ...f.failure.registry, revision: 410 } }],
  ['wrong request run', f => { const r = JSON.parse(f.read(f.failure.attempt.request)); r.runId = 'other-run'; f.failure.attempt.request = f.put(f.failure.attempt.request.path, r) }],
  ['wrong consumed request', f => { f.failure.attempt.consumed = f.put(f.failure.attempt.consumed.path, { attempt: 1, retries: 0, request: reference('other-request') }) }],
  ['wrong native error', f => { f.failure.failure.nativeErrorEvidence = f.put(f.failure.failure.nativeErrorEvidence.path, Buffer.from('System.Exception: other failure')) }],
  ['missing byte evidence', f => { f.files.delete(f.failure.failure.nativeErrorEvidence.path) }],
]) test(`new failure adapter rejects ${name}`, () => {
  const f = fixture(); change(f); assert.throws(() => verifyHistoricalFailure(f.failure, f.profile, f.guard, f.read))
})

test('legacy failure identity checks remain and unknown formats do not obtain the legacy exception', () => {
  const f = fixture(), legacy = { status: 'failed_closed_post_spawn_receipt_budget_blocked', controllerObservationOnly: true,
    liveCleanupCertified: false, currentGuardIdentity: f.guard.identity, currentGuard: f.profile.guard,
    started: f.profile.started, nativeBuild: f.profile.build, nativeObservation: f.profile.observation }
  verifyHistoricalFailure(legacy, f.profile, f.guard, f.read)
  assert.throws(() => verifyHistoricalFailure({ ...legacy, status: 'completed' }, f.profile, f.guard, f.read))
  assert.throws(() => verifyHistoricalFailure({ ...legacy, liveCleanupCertified: true }, f.profile, f.guard, f.read))
})

test('prior read-only host observation retains its actual later kernel time; only an even newer fresh query can qualify', () => {
  const f = fixture(), preBoot = normalizePreBootObservation(f.pre, f.profile, f.guard, f.read)
  assert.equal(preBoot.host, f.pre.host)
  assert.ok(Date.parse(preBoot.host.OsBootUtc) > Date.parse(f.guard.recordedAtUtc))
  const now = Date.parse('2026-10-13T02:00:00.000Z')
  const args = { historical: { guard: f.guard, started: { ownerPid: 11 }, observation: { rootPid: 12 }, preBoot, inputs: f.profile },
    currentGuardSha256: hash, registry: { ok: true, registrySha256: hash, registry: { registryRevision: 409, activeExecution: null } }, now, auditPid: 55,
    host: { ...f.pre.host, BootEventRecordId: 11, OsBootUtc: '2026-10-13T01:00:00.000Z', BootEventUtc: '2026-10-13T01:00:00.500Z',
      ObservedUtc: new Date(now).toISOString(), ProcessQueryComplete: true, Processes: [] } }
  const result = evaluateRecovery(args)
  assert.equal(result.status, 'eligible_for_quarantine')
  assert.equal(result.historicalCleanupCertified, false)
  assert.equal(result.trainingQualificationGranted, false)
  assert.equal(evaluateRecovery({ ...args, host: { ...args.host, ...f.pre.host } }).status, 'blocked')
})
for (const [name, change] of [
  ['wrong guard', f => { f.pre.caseGuardIdentity = 'other' }],
  ['wrong started bytes', f => { f.pre.inputs.started = reference('other-started') }],
  ['changed registry reference', f => { f.pre.inputs.registry = { ...f.pre.inputs.registry, sha256: '0'.repeat(64) } }],
  ['claimed activity', f => { f.pre.checks.activeExecution = { runId: 'other' } }],
  ['claimed cleanup', f => { f.pre.effects.historicalCleanupCertified = true }],
  ['missing original provider snapshot', f => { delete f.profile.preBootProgramSnapshot }],
  ['provider byte mismatch', f => { f.files.set(f.profile.preBootProgramSnapshot.path, Buffer.from('changed')) }],
  ['wrong kernel provider', f => { f.pre.host.BootProvider = 'other' }],
  ['wrong kernel event', f => { f.pre.host.BootEventId = 6005 }],
  ['inconsistent previous boot times', f => { f.pre.host.BootEventUtc = '2026-10-12T01:00:03.000Z' }],
  ['backdated record', f => { f.pre.recordedAtUtc = '2026-10-12T01:01:00.000Z' }],
]) test(`prior observation adapter rejects ${name}`, () => {
  const f = fixture(); change(f); assert.throws(() => normalizePreBootObservation(f.pre, f.profile, f.guard, f.read))
})

test('historical path accepts only project paths or its configured physical runtime, not other roots', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-path-private-'))
  fs.mkdirSync(path.join(root, '.runtime'))
  t.after(() => { assert.ok(path.basename(root).startsWith('recovery-path-private-')); fs.rmSync(root, { recursive: true, force: true }) })
  assert.equal(historicalProjectPath(root, path.join(root, 'scripts', 'owner.cs')), 'scripts/owner.cs')
  assert.equal(historicalProjectPath(root, path.join(fs.realpathSync(path.join(root, '.runtime')), 'owner.exe')), '.runtime/owner.exe')
  assert.throws(() => historicalProjectPath(root, path.resolve(root, '..', 'outside.exe')), /outside_runtime/)
  assert.throws(() => historicalProjectPath(root, '../outside.exe'), /absolute_path_required/)
})

test('existing configured runtime junction maps a physical artifact without expanding its boundary', () => {
  const root = process.cwd(), runtime = fs.realpathSync(path.join(root, '.runtime'))
  const file = path.join(runtime, 'ai-painter', 'private-path-only-fixture.bin')
  assert.equal(historicalProjectPath(root, file), '.runtime/ai-painter/private-path-only-fixture.bin')
  assert.throws(() => historicalProjectPath(root, path.resolve(runtime, '..', 'outside.bin')), /outside_runtime/)
})

// Real private files and rehashed bindings, with synthetic host facts only.
// No Windows Job, production registry, recovery disposition or GPU is used.
function missingObservationFixture() {
  const parent = path.resolve('.runtime/ai-painter/controller-parallel-20261011/controller-27-next-20261013/recovery-missing-observation-20261013/tests')
  fs.mkdirSync(parent, { recursive: true }); const root = fs.mkdtempSync(path.join(parent, 'isolated-'))
  const put = (logical, value) => {
    const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), { recursive: true })
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    fs.writeFileSync(file, bytes); return { path: logical, sha256: digest(bytes) }
  }
  const base = '.runtime/ai-painter/owned-worker-guards/fixture-native', native = base + '/fixture-guard-native'
  const source = put(native + '/owner.cs', Buffer.from('// immutable OLD source, not current implementation'))
  const binary = put(native + '/owner.exe', Buffer.from('private build bytes; never executed'))
  const executable = put('fixture/python.exe', Buffer.from('private executable bytes; never executed'))
  const helperSnapshot = put('fixture/helper.snapshot', Buffer.from('// immutable old helper'))
  const guard = { identity: 'fixture-guard', runnerPid: 10, recordedAtUtc: '2026-10-01T01:00:00.000Z',
    executable: path.join(root, executable.path), executableSha256: executable.sha256,
    helperSha256: helperSnapshot.sha256, nativeOwnerSource: { path: path.join(root, 'scripts/windows/old-owner.cs'), sha256: source.sha256 },
    commandSha256: hash, startedEvidence: path.join(root, base, 'fixture-guard-started.json') }
  const guardSnapshot = put('fixture/guard.snapshot', guard)
  const build = { source: guard.nativeOwnerSource, snapshot: path.join(root, source.path), binary: path.join(root, binary.path), binarySha256: binary.sha256 }
  const buildBinding = put(native + '/build.json', build)
  const commandBinding = Buffer.from(JSON.stringify({ guard, guardSha256: guardSnapshot.sha256, nativeBuild: build, scope: root })).toString('base64')
  const started = put(base + '/fixture-guard-started.json', { ...guard, ownerPid: 11, commandBinding })
  const runId = 'fixture-timeout-run', packageId = 'fixture-timeout-package', output = '.runtime/ai-painter/ecology-decode1-weight-quality-executions/' + runId
  const request = put(output + '/cpu-request.json', { schema: 'ecology-decode1-weight-quality-cpu-request-v1', runId, packageId,
    configuration: { schema: 'ecology-decode1-weight-quality-configuration-v1', capabilityVersion: 'fixture-cpu-only' }, outputRoot: output + '/cpu-entry',
    programBindings: { nativeOwnerSource: source, nativeRunner: helperSnapshot } })
  const consumed = put(output + '/cpu-entry/consumed.json', { attempt: 1, retries: 0, request })
  const failureValue = { schema: 'ecology-decode1-quality-native-failure-v1', status: 'failed_closed', executionState: 'failed_closed',
    phase: 'cpu', stage: 'preparation', callIdentity: guard.identity, runId, packageId, capabilityVersion: 'fixture-cpu-only',
    recordedAtUtc: '2026-10-01T01:04:00.000Z', automaticRetries: 0, privateCpuFixture: false,
    cleanupQualificationGranted: false, guardReleaseGranted: false, normalWriteQualificationGranted: false,
    primaryError: { code: 'EPIPE', reason: 'native_io_failure' },
    streamObservation: { closureVersion: null, stdoutClosed: null, stderrClosed: null, transportCompleted: null } }
  const failure = put(output + '/native-failure-' + guard.identity + '-fixture.json', failureValue)
  const receiptValue = { schema: 'detail-weight-live-native-owner-receipt-v1', phase: 'cpu', stopReason: 'wall_timeout', proof: null,
    protocolError: 'Error: write EPIPE', ownerClosed: false, processCleanupConfirmed: false, cleanupConfirmed: false,
    ownerIdentity: { pid: 11, identitySource: 'retained_child_handle' },
    guard: { identity: guard.identity, state: 'retained', path: path.join(root, '.runtime/ai-painter/owned-worker-guards/active.json') }, nativeBuild: build }
  const receipt = put(output + '/owned-cpu-' + guard.identity + '/release-receipt.json', receiptValue)
  const registry = { ...put('.runtime/ai-painter/current-execution-registry/current.json', { registryRevision: 7, activeExecution: null }), revision: 7 }
  const required = ['docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md', 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs',
    'scripts/run-ai-painter-owned-worker-reboot-recovery.mjs', 'src/server/ai-painter-current-execution-registry.mjs']
  const profile = { schema: 'ai-painter-owned-worker-reboot-recovery-profile-v2', caseId: 'fixture-timeout', failureCase: 'cpu_timeout_missing_native_observation_v1',
    guard: { path: '.runtime/ai-painter/owned-worker-guards/active.json', sha256: guardSnapshot.sha256 }, guardIdentity: guard.identity,
    guardSnapshot, started, build: buildBinding, helperSnapshot, observation: null, missingObservationPath: native + '/cleanup-observation.json',
    request, consumed, failure, receipt, registry, programBindings: required.map(file => put(file, fs.readFileSync(file))) }
  const pre = { schema: 'ai-painter-missing-native-observation-preboot-v1', guardIdentity: guard.identity, nativeObservationMissing: true,
    missingObservationPath: profile.missingObservationPath, cleanupAuthority: false, recoveryExecuted: false,
    recordedAtUtc: '2026-10-01T02:00:01.000Z', inputs: {},
    host: { MachineIdentitySha256: 'b'.repeat(64), BootProvider: 'Microsoft-Windows-Kernel-General', BootEventId: 12, BootEventRecordId: 10,
      OsBootUtc: '2026-10-01T00:00:00.000Z', BootEventUtc: '2026-10-01T00:00:00.500Z', ObservedUtc: '2026-10-01T02:00:00.000Z' } }
  const refresh = () => {
    for (const key of ['guard', 'registry', 'started', 'build', 'failure', 'receipt', 'request', 'consumed', 'helperSnapshot']) pre.inputs[key] = profile[key]
    profile.preBoot = put('fixture/preboot.json', pre)
  }
  refresh()
  const update = (key, mutate) => { const value = JSON.parse(fs.readFileSync(path.join(root, profile[key].path))); mutate(value); profile[key] = put(profile[key].path, value); refresh() }
  return { root, profile, guard, pre, build, binary, source, put, refresh, update, observationFile: path.join(root, profile.missingObservationPath) }
}
test('V2 real file verification accepts only exact missing observation; old source is verified from immutable build snapshot', () => {
  const f = missingObservationFixture(), binding = f.put('fixture/profile.json', f.profile)
  const bound = loadRecoveryProfile(f.root, binding.path, binding.sha256), historical = verifyHistoricalInputs(f.root, bound.profile)
  assert.equal(historical.observation, null); assert.equal(historical.nativeObservationMissing, true)
  const now = Date.parse('2026-10-02T01:00:00Z')
  const args = { historical, registry: { ok: true, registrySha256: f.profile.registry.sha256, registry: { registryRevision: 7, activeExecution: null } },
    currentGuardSha256: f.profile.guard.sha256, auditPid: 55, now,
    host: { ...f.pre.host, OsBootUtc: '2026-10-02T00:00:00Z', BootEventUtc: '2026-10-02T00:00:00.500Z', BootEventRecordId: 11,
      ObservedUtc: new Date(now).toISOString(), ProcessQueryComplete: true, Processes: [] } }
  const result = evaluateRecovery(args); assert.equal(result.status, 'eligible_for_quarantine')
  for (const key of ['historicalCleanupCertified', 'oldExecutionMayReplay', 'trainingQualificationGranted']) assert.equal(result[key], false)
  assert.equal(evaluateRecovery({ ...args, host: { ...args.host, ...f.pre.host } }).status, 'blocked')
})
for (const [name, mutate] of [
  ['existing observation cannot be hidden', f => { f.put(f.profile.missingObservationPath, {}) }],
  ['wrong expected observation path', f => { f.profile.missingObservationPath = 'fixture/other.json' }],
  ['wrong guard hash', f => { f.profile.guard.sha256 = hash }],
  ['wrong owner identity', f => { f.update('receipt', r => { r.ownerIdentity.pid = 12 }) }],
  ['wrong run', f => { f.update('failure', r => { r.runId = 'other-run' }) }],
  ['wrong package', f => { f.update('failure', r => { r.packageId = 'other-package' }) }],
  ['wrong nested capability', f => { f.update('request', r => { r.configuration.capabilityVersion = 'other-capability' }) }],
  ['flat capability does not replace missing configuration', f => { f.update('request', r => { r.capabilityVersion = 'fixture-cpu-only'; delete r.configuration }) }],
  ['GPU failure', f => { f.update('failure', r => { r.phase = 'gpu' }) }],
  ['training failure', f => { f.update('failure', r => { r.stage = 'training' }) }],
  ['claimed cleanup', f => { f.update('failure', r => { r.cleanupQualificationGranted = true }) }],
  ['claimed normal write', f => { f.update('failure', r => { r.normalWriteQualificationGranted = true }) }],
  ['claimed guard release', f => { f.update('failure', r => { r.guardReleaseGranted = true }) }],
  ['live proof present', f => { f.update('receipt', r => { r.proof = {} }) }],
  ['unknown stop', f => { f.update('receipt', r => { r.stopReason = 'unknown' }) }],
  ['retry claimed', f => { f.update('consumed', r => { r.retries = 1 }) }],
  ['missing request bytes', f => { fs.unlinkSync(path.join(f.root, f.profile.request.path)) }],
  ['changed build snapshot', f => { fs.appendFileSync(path.join(f.root, f.source.path), 'changed') }],
  ['changed build binary', f => { fs.appendFileSync(path.join(f.root, f.binary.path), 'changed') }],
  ['missing helper bytes', f => { fs.unlinkSync(path.join(f.root, f.profile.helperSnapshot.path)) }],
  ['wrong preboot binding', f => { f.pre.inputs.receipt = { ...f.profile.receipt, sha256: hash }; f.profile.preBoot = f.put(f.profile.preBoot.path, f.pre) }],
  ['preboot before failure', f => { f.pre.host.ObservedUtc = '2026-10-01T01:01:00Z'; f.profile.preBoot = f.put(f.profile.preBoot.path, f.pre) }],
  ['unknown versioned case', f => { f.profile.failureCase = 'arbitrary_failure' }],
  ['V1 does not inherit missing exception', f => { f.profile.schema = 'ai-painter-owned-worker-reboot-recovery-profile-v1' }],
]) test(`V2 missing-observation branch rejects ${name}`, () => {
  const f = missingObservationFixture(); mutate(f); assert.throws(() => verifyHistoricalInputs(f.root, f.profile))
})
for (const code of ['EACCES', 'EIO']) test(`V2 simulated observation ${code} is not absence`, () => {
  const f = missingObservationFixture(), original = fs.lstatSync
  fs.lstatSync = (file, options) => { if (path.resolve(file) === f.observationFile) throw Object.assign(Error('isolated I/O failure'), { code }); return original(file, options) }
  try { assert.throws(() => verifyHistoricalInputs(f.root, f.profile), error => error.code === code) } finally { fs.lstatSync = original }
})
test('V2 real dangling file link is existing observation, not missing evidence', t => {
  const f = missingObservationFixture()
  try { fs.symlinkSync(path.join(f.root, 'never-created'), f.observationFile, 'file') }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Windows file-symlink privilege unavailable; no real link proof'); return } throw error }
  assert.throws(() => verifyHistoricalInputs(f.root, f.profile), /native_observation_exists/)
})
function observedTimeoutFixture() {
  const f = missingObservationFixture(), started = JSON.parse(fs.readFileSync(path.join(f.root, f.profile.started.path)))
  f.profile.schema = 'ai-painter-owned-worker-reboot-recovery-profile-v1'
  f.profile.failureCase = 'cpu_timeout_observation_only_v1'
  f.profile.observation = f.put(f.profile.missingObservationPath, { schemaVersion: 'ai-painter-owned-job-observation-v1',
    authority: 'observation_only_no_release_authority', assignedBeforeResume: true, ownerPid: started.ownerPid,
    bindingBase64: started.commandBinding, rootPid: 12, activeProcessesAfterCleanup: 0 })
  f.profile.missingObservationPath = null
  f.pre.schema = 'ai-painter-cpu-timeout-preboot-v1'; f.pre.nativeObservationMissing = false; f.pre.missingObservationPath = null
  f.pre.inputs.observation = f.profile.observation; f.refresh(); return f
}
test('V1 actual CPU-timeout format requires existing original observation and still grants no historical cleanup', () => {
  const f = observedTimeoutFixture(), result = verifyHistoricalInputs(f.root, f.profile)
  assert.equal(result.nativeObservationMissing, false); assert.equal(result.observation.rootPid, 12)
  assert.equal(result.inputs.schema, 'ai-painter-owned-worker-reboot-recovery-profile-v1')
})
for (const [name, mutate] of [
  ['missing original observation', f => { fs.unlinkSync(path.join(f.root, f.profile.observation.path)) }],
  ['wrong original owner', f => { f.update('observation', o => { o.ownerPid = 13 }) }],
  ['wrong original command', f => { f.update('observation', o => { o.bindingBase64 = 'other' }) }],
  ['unknown original root', f => { f.update('observation', o => { delete o.rootPid }) }],
  ['claimed release authority', f => { f.update('observation', o => { o.authority = 'release_allowed' }) }],
  ['wrong original observation path', f => { f.profile.observation = f.put('fixture/other-observation.json', {}) }],
  ['current failure cannot impersonate missing branch', f => { f.profile.schema = 'ai-painter-owned-worker-reboot-recovery-profile-v2' }],
]) test(`V1 CPU-timeout adapter rejects ${name}`, () => {
  const f = observedTimeoutFixture(); mutate(f); assert.throws(() => verifyHistoricalInputs(f.root, f.profile))
})
