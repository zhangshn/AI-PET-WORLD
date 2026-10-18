import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { sha256, evaluateRecovery, quarantineRecovery, loadRecoveryProfile, verifyHistoricalInputs } from '../lib/ai-painter-owned-worker-reboot-recovery-v1.mjs'

const results = []
const test = async (name, action) => {
  try { await action(); results.push({ name, passed: true }) }
  catch (error) { results.push({ name, passed: false, error: error.message }); process.exitCode = 1 }
}
const hash = 'a'.repeat(64)
const profileSha = 'b'.repeat(64)
const machine = 'c'.repeat(64)
const oldBoot = '2026-10-01T00:00:00.000Z'
const oldStart = '2026-10-01T01:00:00.000Z'
const prior = '2026-10-01T02:00:00.000Z'
const newBoot = '2026-10-02T00:00:00.000Z'
const now = Date.parse('2026-10-02T01:00:00.000Z')
function fixture() {
  return {
    now, auditPid: 555,
    historical: { guard: { identity: 'test-guard', runnerPid: 10, recordedAtUtc: oldStart }, started: { ownerPid: 11 }, observation: { rootPid: 12 }, preBoot: { host: { MachineIdentitySha256: machine, BootEventRecordId: 100, OsBootUtc: oldBoot, ObservedUtc: prior } }, inputs: { guard: { sha256: hash }, registry: { sha256: hash, revision: 7 } } },
    registry: { ok: true, registrySha256: hash, registry: { registryRevision: 7, activeExecution: null } },
    currentGuardSha256: hash,
    host: { MachineIdentitySha256: machine, BootProvider: 'Microsoft-Windows-Kernel-General', BootEventId: 12, BootEventRecordId: 101, BootEventUtc: newBoot, OsBootUtc: newBoot, ObservedUtc: new Date(now).toISOString(), ProcessQueryComplete: true, Processes: [] },
  }
}
await test('new full kernel boot is eligible, never cleanup or training qualified', () => {
  const result = evaluateRecovery(fixture())
  assert.equal(result.status, 'eligible_for_quarantine')
  for (const field of ['historicalCleanupCertified', 'oldExecutionMayReplay', 'trainingQualificationGranted']) assert.equal(result[field], false)
})
const rejectCases = [
  ['same kernel despite vanished PIDs', f => { f.host.OsBootUtc = oldBoot; f.host.BootEventUtc = oldBoot; f.host.BootEventRecordId = 100 }],
  ['fast-startup event with old kernel boot', f => { f.host.OsBootUtc = oldBoot }],
  ['other machine', f => { f.host.MachineIdentitySha256 = 'd'.repeat(64) }],
  ['wrong event provider', f => { f.host.BootProvider = 'other' }],
  ['wrong event id', f => { f.host.BootEventId = 6005 }],
  ['old event sequence', f => { f.host.BootEventRecordId = 100 }],
  ['conflicting boot time', f => { f.host.BootEventUtc = '2026-10-02T00:00:03Z' }],
  ['missing time', f => { delete f.host.OsBootUtc }],
  ['stale host query', f => { f.now += 31000 }],
  ['registry not formally verified', f => { f.registry.ok = false }],
  ['registry changed', f => { f.registry.registrySha256 = profileSha }],
  ['revision changed', f => { f.registry.registry.registryRevision = 8 }],
  ['active registered execution', f => { f.registry.registry.activeExecution = { runId: 'other' } }],
  ['guard bytes changed', f => { f.currentGuardSha256 = profileSha }],
  ['process query incomplete', f => { f.host.ProcessQueryComplete = false }],
  ['worker process incomplete identity', f => { f.host.Processes = [{ Pid: 13, Name: 'python.exe' }] }],
  ['live model worker', f => { f.host.Processes = [{ Pid: 13, Name: 'python.exe', ExecutablePath: 'C:/python.exe', CommandLine: 'python ai-painter-training.py', CreationUtc: newBoot }] }],
  ['old PID with old creation time', f => { f.host.Processes = [{ Pid: 10, Name: 'node.exe', ExecutablePath: 'C:/node.exe', CommandLine: 'node next', CreationUtc: oldStart }] }],
  ['duplicate PID', f => { f.host.Processes = [{ Pid: 1, Name: 'x' }, { Pid: 1, Name: 'x' }] }],
]
for (const [name, change] of rejectCases) await test(name, () => { const f = fixture(); change(f); assert.equal(evaluateRecovery(f).status, 'blocked') })
await test('new unrelated process reusing old PID does not imply old process survival', () => {
  const f = fixture()
  f.host.Processes = [{ Pid: 10, Name: 'node.exe', ExecutablePath: 'C:/node.exe', CommandLine: 'node next dev', CreationUtc: newBoot }]
  assert.equal(evaluateRecovery(f).status, 'eligible_for_quarantine')
})

const testParent = path.resolve('.runtime/ai-painter/owned-worker-reboot-recovery-t-q4-57/tests')
fs.mkdirSync(testParent, { recursive: true })
function transactionFixture() {
  const root = fs.mkdtempSync(path.join(testParent, 'isolated-'))
  const base = path.join(root, '.runtime/ai-painter/owned-worker-guards')
  fs.mkdirSync(base, { recursive: true })
  fs.mkdirSync(path.join(root, '.runtime/ai-painter/current-execution-registry'), { recursive: true })
  const bytes = Buffer.from('{"identity":"isolated-guard"}\n')
  const guardHash = sha256(bytes)
  fs.writeFileSync(path.join(base, 'active.json'), bytes, { flag: 'wx' })
  const bound = { profileSha256: profileSha, profile: { caseId: 'isolated', guard: { sha256: guardHash } } }
  const host = { MachineIdentitySha256: machine, OsBootUtc: newBoot, Processes: [{ Pid: process.pid, CreationUtc: new Date().toISOString() }] }
  const audit = async () => ({ status: 'eligible_for_quarantine', profileSha256: profileSha, guardSha256: guardHash, errors: [], host, historicalCleanupCertified: false })
  const movedAudit = async () => ({ status: 'blocked', profileSha256: profileSha, guardSha256: null, errors: ['REC-BOOT-002:current_guard_mismatch'], host })
  return { root, base, bytes, bound, audit, movedAudit, target: path.join(base, 'reboot-recovery-isolated/guard.json') }
}
await test('exact original bytes quarantined, completed readback does not rerun verifier', async () => {
  const f = transactionFixture()
  const result = await quarantineRecovery(f.root, f.bound, f.audit)
  assert.equal(result.status, 'quarantined_not_cleanup_certified')
  assert.equal(fs.existsSync(path.join(f.base, 'active.json')), false)
  assert.ok(fs.readFileSync(f.target).equals(f.bytes))
  const again = await quarantineRecovery(f.root, f.bound, () => { throw new Error('must_not_execute') })
  assert.equal(again.completedReadbackOnly, true)
  assert.equal(again.transactionId, result.transactionId)
})
await test('failed native precheck preserves source', async () => {
  const f = transactionFixture()
  await assert.rejects(quarantineRecovery(f.root, f.bound, async () => ({ status: 'blocked' })), /quarantine_precheck_blocked/)
  assert.ok(fs.readFileSync(path.join(f.base, 'active.json')).equals(f.bytes))
})
await test('existing unknown lease never seized', async () => {
  const f = transactionFixture()
  const lease = path.join(f.base, 'reboot-recovery.claim.json')
  fs.writeFileSync(lease, 'unknown-owner', { flag: 'wx' })
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit), /unknown_recovery_claim_retained/)
  assert.equal(fs.readFileSync(lease, 'utf8'), 'unknown-owner')
})
await test('archive conflict never overwritten', async () => {
  const f = transactionFixture()
  fs.mkdirSync(path.dirname(f.target))
  fs.writeFileSync(f.target, 'other')
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit), /archive_conflict/)
  assert.equal(fs.readFileSync(f.target, 'utf8'), 'other')
})
await test('interruption after intent resumes same immutable transaction', async () => {
  const f = transactionFixture()
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit, state => { if (state === 'intent_saved') throw new Error('test_interrupt') }), /test_interrupt/)
  const intent = fs.readFileSync(path.join(path.dirname(f.target), 'intent.json'))
  const resumed = await quarantineRecovery(f.root, f.bound, f.audit)
  assert.equal(resumed.recoveredSameTransaction, true)
  assert.ok(fs.readFileSync(path.join(path.dirname(f.target), 'intent.json')).equals(intent))
})
await test('interruption after move resumes result without moving again', async () => {
  const f = transactionFixture()
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit, state => { if (state === 'guard_moved') throw new Error('test_interrupt') }), /test_interrupt/)
  const resumed = await quarantineRecovery(f.root, f.bound, f.movedAudit)
  assert.equal(resumed.recoveredSameTransaction, true)
  assert.ok(fs.readFileSync(f.target).equals(f.bytes))
})
await test('new guard after interrupted move is preserved', async () => {
  const f = transactionFixture()
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit, state => { if (state === 'guard_moved') throw new Error('test_interrupt') }))
  fs.writeFileSync(path.join(f.base, 'active.json'), 'new-guard', { flag: 'wx' })
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit), /guard_locations_conflict/)
  assert.equal(fs.readFileSync(path.join(f.base, 'active.json'), 'utf8'), 'new-guard')
})
await test('changed archive after interrupted move rejected', async () => {
  const f = transactionFixture()
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit, state => { if (state === 'guard_moved') throw new Error('test_interrupt') }))
  fs.writeFileSync(f.target, 'changed archive')
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.movedAudit), /bound_sha256_mismatch/)
})
await test('registry/boot conflict on final recheck preserves source', async () => {
  const f = transactionFixture()
  let calls = 0
  await assert.rejects(quarantineRecovery(f.root, f.bound, async () => ++calls <= 2 ? f.audit() : { status: 'blocked' }), /quarantine_recheck_blocked/)
  assert.ok(fs.readFileSync(path.join(f.base, 'active.json')).equals(f.bytes))
})
await test('wrong profile digest refused before historical access', () => {
  const f = transactionFixture()
  const profileFile = path.join(f.root, 'profile.json')
  fs.writeFileSync(profileFile, '{}')
  assert.throws(() => loadRecoveryProfile(f.root, 'profile.json', hash), /bound_sha256_mismatch/)
})
await test('historical input cannot omit a bound original artifact', () => {
  const f = transactionFixture()
  assert.throws(() => verifyHistoricalInputs(f.root, {}), /missing_guardSnapshot_binding/)
})
await test('other registry writer reservation blocks disposition and is preserved', async () => {
  const f = transactionFixture()
  const claim = path.join(f.root, '.runtime/ai-painter/current-execution-registry/writer.claim.json')
  fs.writeFileSync(claim, '{"otherWriter":true}', { flag: 'wx' })
  await assert.rejects(quarantineRecovery(f.root, f.bound, f.audit), /unknown_recovery_claim_retained/)
  assert.equal(fs.readFileSync(claim, 'utf8'), '{"otherWriter":true}')
  assert.ok(fs.readFileSync(path.join(f.base, 'active.json')).equals(f.bytes))
})
await test('both reservations held before intent and released only by own call', async () => {
  const f = transactionFixture()
  await quarantineRecovery(f.root, f.bound, f.audit, state => {
    if (state === 'intent_saved') {
      assert.ok(fs.existsSync(path.join(f.base, 'reboot-recovery.claim.json')))
      assert.ok(fs.existsSync(path.join(f.root, '.runtime/ai-painter/current-execution-registry/writer.claim.json')))
      assert.ok(fs.existsSync(path.join(f.base, 'active.json')))
    }
  })
  assert.equal(fs.existsSync(path.join(f.base, 'reboot-recovery.claim.json')), false)
  assert.equal(fs.existsSync(path.join(f.root, '.runtime/ai-painter/current-execution-registry/writer.claim.json')), false)
})
for (const point of ['intent_saved', 'guard_moved']) await test(`hard process kill at ${point}: same kernel blocked; synthetic next kernel resumes same transaction`, async () => {
  const f = transactionFixture()
  const child = spawnSync(process.execPath, [path.resolve('.runtime/ai-painter/owned-worker-reboot-recovery-t-q4-57/controller/hard-crash-fixture.mjs'), f.root, point, path.resolve('scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs')], { windowsHide: true, timeout: 15000, maxBuffer: 65536, encoding: 'utf8' })
  assert.notEqual(child.status, 0)
  const lease = path.join(f.base, 'reboot-recovery.claim.json')
  const writer = path.join(f.root, '.runtime/ai-painter/current-execution-registry/writer.claim.json')
  const leaseBytes = fs.readFileSync(lease)
  const writerBytes = fs.readFileSync(writer)
  const intent = fs.readFileSync(path.join(path.dirname(f.target), 'intent.json'))
  const verifier = point === 'intent_saved' ? f.audit : f.movedAudit
  await assert.rejects(quarantineRecovery(f.root, f.bound, verifier), /recovery_claim_requires_new_kernel_boot/)
  assert.ok(fs.readFileSync(lease).equals(leaseBytes))
  assert.ok(fs.readFileSync(writer).equals(writerBytes))
  const nextFixtureBoot = new Date(Date.parse(JSON.parse(leaseBytes).claimedAtUtc) + 60000).toISOString()
  const futureVerifier = async () => { const audit = await verifier(); audit.host.OsBootUtc = nextFixtureBoot; return audit }
  const result = await quarantineRecovery(f.root, f.bound, futureVerifier)
  assert.equal(result.recoveredSameTransaction, true)
  assert.ok(fs.readFileSync(path.join(path.dirname(f.target), 'intent.json')).equals(intent))
  assert.ok(fs.readFileSync(f.target).equals(f.bytes))
  assert.equal(fs.existsSync(writer), false)
  assert.equal(fs.existsSync(lease), false)
  assert.equal(result.trainingQualificationGranted, false)
})
const realProfilePath = path.resolve('.runtime/ai-painter/owned-worker-reboot-recovery-t-q4-57/controller/profile.json')
if (fs.existsSync(realProfilePath)) {
  const original = JSON.parse(fs.readFileSync(realProfilePath))
  const negatives = [
    ['original started digest mismatch', p => { p.started.sha256 = hash }, /bound_sha256_mismatch/],
    ['original guard identity mismatch', p => { p.guardIdentity = 'other' }, /historical_guard_identity_mismatch/],
    ['required recovery library omitted', p => { p.programBindings = p.programBindings.filter(b => !b.path.endsWith('reboot-recovery-v1.mjs')) }, /required_program_not_bound/],
    ['required program digest absent', p => { delete p.programBindings[0].sha256 }, /program_sha256_required/],
  ]
  for (const [name, change, error] of negatives) await test(name, () => {
    const candidate = structuredClone(original)
    change(candidate)
    assert.throws(() => verifyHistoricalInputs(process.cwd(), candidate), error)
  })
}
function qualificationTimeoutFixture() {
  const root = fs.mkdtempSync(path.join(testParent, 'qualification-'))
  const put = (logical, value) => {
    const raw = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))
    const file = path.join(root, logical); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, raw)
    return { path: logical, sha256: sha256(raw) }
  }
  const call = 'c3916799-2942-4912-8d29-e51494ca939d', suffix = 'fee1eb77-57eb-4078-9223-cab74f9bd326'
  const runId = 'final-rgb-base-quality-v1-' + suffix, packageId = 'final-rgb-base-quality-v1-package-' + suffix
  const output = '.runtime/ai-painter/final-rgb-base-weight-quality-executions/' + runId
  const base = '.runtime/ai-painter/owned-worker-guards/private-native', native = base + '/' + call + '-native'
  const capabilityVersion = 'stage4_mvp256_dry_final_rgb_base_weight_quality24_v1'
  const source = put('scripts/windows/private-owner.cs', Buffer.from('// private immutable native source; never compiled'))
  const snapshot = put(native + '/owner.cs', fs.readFileSync(path.join(root, source.path)))
  const binary = put(native + '/owner.exe', Buffer.from('private native binary fixture; never executed'))
  const executable = put('fixture/python.exe', Buffer.from('private interpreter fixture; never executed'))
  const helperSnapshot = put('fixture/helper.snapshot', Buffer.from('// immutable old helper fixture'))
  const qualifier = put('ml/ai-painter/scripts/qualify_stage4_object_support_structure_quality_gpu_v1.py', Buffer.from('# private qualifier; never imported'))
  const nativeRunner = { path: 'scripts/lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs', sha256: helperSnapshot.sha256 }
  const plan = put(output + '/quality-plan.json', { schema: 'object-support-structure-quality-plan-v1', capabilityVersion, runId, packageId, outputRoot: output,
    runtimeIdentity: { python: { absolutePath: path.join(root, executable.path), sha256: executable.sha256 } },
    programBindings: { gpuQualifier: qualifier, nativeRunner } })
  const executionPackage = put('.runtime/ai-painter/autonomous-closed-loop-packages/' + packageId + '/package.json', {
    schemaVersion: 'ai-painter-autonomous-closed-loop-package-v1', capabilityVersion, packageIdentity: packageId, outputRoot: output,
    inputEvidence: [plan], programLineage: { gpuQualifier: qualifier.sha256, nativeRunner: helperSnapshot.sha256 } })
  const guard = { identity: call, runnerPid: 10, recordedAtUtc: oldStart, executable: path.join(root, executable.path),
    executableSha256: executable.sha256, helperSha256: helperSnapshot.sha256,
    nativeOwnerSource: { path: path.join(root, source.path), sha256: source.sha256 },
    commandSha256: sha256(Buffer.from(JSON.stringify(['-B', fs.realpathSync(path.join(root, qualifier.path)), '--package', executionPackage.path, '--sha256', executionPackage.sha256]))),
    startedEvidence: path.join(root, base, call + '-started.json') }
  const guardSnapshot = put('fixture/guard.snapshot', guard)
  put('.runtime/ai-painter/owned-worker-guards/active.json', guard)
  const build = { source: guard.nativeOwnerSource, snapshot: path.join(root, snapshot.path), binary: path.join(root, binary.path), binarySha256: binary.sha256 }
  const buildBinding = put(native + '/build.json', build)
  const commandBinding = Buffer.from(JSON.stringify({ guard, guardSha256: guardSnapshot.sha256, scope: root, nativeBuild: build })).toString('base64')
  const started = put(base + '/' + call + '-started.json', { ...guard, ownerPid: 11, commandBinding })
  const observationValue = { schemaVersion: 'ai-painter-owned-job-observation-v1', authority: 'observation_only_no_release_authority',
    ownerPid: 11, rootPid: 12, rootCreationDateUtc: '2026-10-01T01:00:00.100Z', bindingBase64: commandBinding,
    assignedBeforeResume: true, activeProcessesAfterCleanup: 0, totalProcesses: 3, rootExitCode: 1,
    observedAtUtc: '2026-10-01T01:09:59.000Z', stopReasonBase64: Buffer.from('wall_timeout').toString('base64'),
    cleanupErrorBase64: '', transportErrorBase64: Buffer.from(';;').toString('base64'), streamClosureVersion: 'bounded-stream-capture-v2',
    stdoutClosed: true, stderrClosed: true, transportCompleted: true, streamCaptureErrorBase64: '', streamTransportErrorBase64: '', stdoutBytes: 0, stderrBytes: 0 }
  const observation = put(native + '/cleanup-observation.json', observationValue)
  const proof = { assignedBeforeResume: true, killOnJobClose: true, ownerPid: 11, rootPid: 12,
    rootCreationDateUtc: observationValue.rootCreationDateUtc, bindingBase64: commandBinding,
    activeProcessesAfterCleanup: 0, totalProcesses: 3, exitCode: 1, stopReason: 'wall_timeout', cleanupError: null, observationError: null,
    streamClosureVersion: 'bounded-stream-capture-v2', stdoutClosed: true, stderrClosed: true, transportCompleted: true,
    streamCaptureError: null, streamTransportError: null, stdoutBytes: 0, stderrBytes: 0 }
  const receipt = put(output + '/owned-qualification-' + call + '/release-receipt.json', {
    schema: 'detail-weight-live-native-owner-receipt-v1', phase: 'qualification', budget: { timeoutMs: 600000 }, elapsedMs: 599098,
    ownerClosed: true, proof, protocolError: 'Error: write EPIPE', stopReason: 'wall_timeout',
    processCleanupConfirmed: false, cleanupConfirmed: false, ownerIdentity: { pid: 11, identitySource: 'retained_child_handle' },
    guard: { identity: call, state: 'retained', path: path.join(root, '.runtime/ai-painter/owned-worker-guards/active.json'), nativeEvidenceRoot: base },
    nativeBuild: build, streamBytes: { stdout: 0, stderr: 0 }, outputAccountingRoots: [output, base] })
  const failure = put(output + '/native-failure-' + call + '-12d1ac4a-2f6a-4cc0-aa2c-733706f49ad8.json', {
    schema: 'object-support-structure-quality-native-failure-v1', status: 'failed_closed', executionState: 'failed_closed',
    capabilityVersion, runId, packageId, phase: 'qualification', stage: 'qualification', callIdentity: call, recordedAtUtc: '2026-10-01T01:10:00.000Z',
    primaryError: { type: 'Error', code: null, reason: 'wall_timeout', messageRecorded: true, untrustedMessageSuppressed: false, rawStackRecorded: false },
    streamObservation: { closureVersion: 'bounded-stream-capture-v2', stdoutClosed: true, stderrClosed: true, transportCompleted: true,
      captureErrorPresent: null, transportErrorPresent: null, streamBytes: 0 },
    cleanupQualificationGranted: false, guardReleaseGranted: false, normalWriteQualificationGranted: false, automaticRetries: 0, privateCpuFixture: false })
  const registry = { ...put('.runtime/ai-painter/current-execution-registry/current.json', { registryRevision: 7, activeExecution: null }), revision: 7 }
  const required = ['docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md', 'scripts/lib/ai-painter-owned-worker-reboot-recovery-v1.mjs',
    'scripts/run-ai-painter-owned-worker-reboot-recovery.mjs', 'src/server/ai-painter-current-execution-registry.mjs']
  const profile = { schema: 'ai-painter-owned-worker-reboot-recovery-profile-v1', caseId: 'private-qualification-timeout',
    guard: { path: '.runtime/ai-painter/owned-worker-guards/active.json', sha256: guardSnapshot.sha256 }, guardIdentity: call,
    guardSnapshot, started, build: buildBinding, observation, helperSnapshot, plan, executionPackage, receipt, failure, registry,
    programBindings: required.map(file => put(file, Buffer.from('// private bound program role ' + file))) }
  const pre = { guardIdentity: call, guard: profile.guard, registry, activeExecution: null,
    host: { MachineIdentitySha256: machine, BootEventRecordId: 100, OsBootUtc: oldBoot, ObservedUtc: prior } }
  profile.preBoot = put('fixture/preboot.json', pre)
  const update = (key, mutate) => {
    const binding = profile[key], value = JSON.parse(fs.readFileSync(path.join(root, binding.path)))
    mutate(value); profile[key] = put(binding.path, value)
  }
  return { root, profile, put, update, qualifier, snapshot, binary, helperSnapshot, pre }
}
await test('actual qualification failure format verifies complete private bound bytes without cleanup authority', () => {
  const f = qualificationTimeoutFixture(), b = f.put('fixture/profile.json', f.profile)
  const historical = verifyHistoricalInputs(f.root, loadRecoveryProfile(f.root, b.path, b.sha256).profile)
  assert.equal(historical.observation.rootPid, 12); assert.equal(historical.nativeObservationMissing, undefined)
  const args = fixture(); args.historical = historical; args.currentGuardSha256 = f.profile.guard.sha256
  args.registry.registrySha256 = f.profile.registry.sha256
  const result = evaluateRecovery(args); assert.equal(result.status, 'eligible_for_quarantine')
  assert.equal(result.historicalCleanupCertified, false); assert.equal(result.oldExecutionMayReplay, false); assert.equal(result.trainingQualificationGranted, false)
  args.host.OsBootUtc = oldBoot; args.host.BootEventUtc = oldBoot; args.host.BootEventRecordId = 100
  assert.equal(evaluateRecovery(args).status, 'blocked', 'vanished PIDs and stored proof cannot replace new kernel evidence')
})
const qualificationRejections = [
  ['failure wrong SHA', f => { f.profile.failure.sha256 = hash }],
  ['receipt wrong SHA', f => { f.profile.receipt.sha256 = hash }],
  ['observation wrong SHA', f => { f.profile.observation.sha256 = hash }],
  ['plan wrong SHA', f => { f.profile.plan.sha256 = hash }],
  ['package wrong SHA', f => { f.profile.executionPackage.sha256 = hash }],
  ['guard wrong SHA', f => { f.profile.guard.sha256 = hash }],
  ['Run mismatch', f => f.update('failure', v => { v.runId = v.runId.replace('fee1', 'abcd') })],
  ['package mismatch', f => f.update('failure', v => { v.packageId += '-other' })],
  ['CPU phase', f => f.update('failure', v => { v.phase = 'cpu' })],
  ['training stage', f => f.update('failure', v => { v.stage = 'training' })],
  ['other capability', f => f.update('failure', v => { v.capabilityVersion = 'other' })],
  ['call mismatch', f => f.update('failure', v => { v.callIdentity = 'other' })],
  ['non-timeout error', f => f.update('failure', v => { v.primaryError.reason = 'runtime_exception' })],
  ['retry claimed', f => f.update('failure', v => { v.automaticRetries = 1 })],
  ['private CPU fixture', f => f.update('failure', v => { v.privateCpuFixture = true })],
  ...['cleanupQualificationGranted', 'guardReleaseGranted', 'normalWriteQualificationGranted'].map(flag => [flag + ' claimed', f => f.update('failure', v => { v[flag] = true })]),
  ['receipt cleanup claimed', f => f.update('receipt', v => { v.cleanupConfirmed = true })],
  ['receipt process cleanup claimed', f => f.update('receipt', v => { v.processCleanupConfirmed = true })],
  ['receipt guard released', f => f.update('receipt', v => { v.guard.state = 'released_after_live_empty_job' })],
  ['receipt wrong guard', f => f.update('receipt', v => { v.guard.identity = 'other' })],
  ['receipt wrong namespace', f => f.update('receipt', v => { v.guard.nativeEvidenceRoot += '-other' })],
  ['receipt wrong owner', f => f.update('receipt', v => { v.ownerIdentity.pid++ })],
  ['receipt wrong phase', f => f.update('receipt', v => { v.phase = 'training' })],
  ['receipt wrong stop', f => f.update('receipt', v => { v.stopReason = 'other' })],
  ['receipt protocol error omitted', f => f.update('receipt', v => { v.protocolError = null })],
  ['missing proof cannot use V2', f => f.update('receipt', v => { v.proof = null })],
  ['proof wrong owner', f => f.update('receipt', v => { v.proof.ownerPid++ })],
  ['proof wrong command', f => f.update('receipt', v => { v.proof.bindingBase64 = 'other' })],
  ['proof active Job', f => f.update('receipt', v => { v.proof.activeProcessesAfterCleanup = 1 })],
  ['proof wrong root', f => f.update('receipt', v => { v.proof.rootPid++ })],
  ['receipt incomplete stream', f => f.update('receipt', v => { v.proof.stdoutClosed = false })],
  ['receipt changed stream count', f => f.update('receipt', v => { v.streamBytes.stdout++ })],
  ['failure changed stream count', f => f.update('failure', v => { v.streamObservation.streamBytes++ })],
  ['observation wrong owner', f => f.update('observation', v => { v.ownerPid++ })],
  ['observation wrong authority', f => f.update('observation', v => { v.authority = 'cleanup' })],
  ['observation wrong root', f => f.update('observation', v => { v.rootPid++ })],
  ['observation timeout mismatch', f => f.update('observation', v => { v.stopReasonBase64 = '' })],
  ['observation removed', f => { fs.unlinkSync(path.join(f.root, f.profile.observation.path)) }],
  ['started owner mismatch', f => f.update('started', v => { v.ownerPid++ })],
  ['build mismatch', f => f.update('build', v => { v.binarySha256 = hash })],
  ['plan Run mismatch', f => f.update('plan', v => { v.runId += '-other' })],
  ['package identity mismatch', f => f.update('executionPackage', v => { v.packageIdentity += '-other' })],
  ['package plan binding mismatch', f => f.update('executionPackage', v => { v.inputEvidence[0].sha256 = hash })],
  ['package original command changed', f => f.update('executionPackage', v => { v.extra = 'rehashing does not update guard command' })],
  ['actual qualifier bytes changed', f => fs.appendFileSync(path.join(f.root, f.qualifier.path), '# changed')],
  ['actual native snapshot changed', f => fs.appendFileSync(path.join(f.root, f.snapshot.path), '// changed')],
  ['actual native binary changed', f => fs.appendFileSync(path.join(f.root, f.binary.path), 'changed')],
  ['actual old helper changed', f => fs.appendFileSync(path.join(f.root, f.helperSnapshot.path), '// changed')],
  ['failure after preboot observation', f => f.update('failure', v => { v.recordedAtUtc = newBoot })],
  ['V2 missing-observation branch rejects GPU', f => { f.profile.schema = 'ai-painter-owned-worker-reboot-recovery-profile-v2'; f.profile.failureCase = 'cpu_timeout_missing_native_observation_v1'; f.profile.observation = null }],
  ['V1 CPU timeout branch rejects GPU', f => { f.profile.failureCase = 'cpu_timeout_observation_only_v1' }],
  ['V3 training branch rejects GPU', f => { f.profile.schema = 'ai-painter-owned-worker-reboot-recovery-profile-v3'; f.profile.failureCase = 'training_kernel_interruption_v1' }],
]
for (const [name, mutate] of qualificationRejections) await test('qualification evidence rejects ' + name, () => {
  const f = qualificationTimeoutFixture(); mutate(f)
  assert.throws(() => verifyHistoricalInputs(f.root, f.profile))
})

const report = { schema: 'ai-painter-reboot-recovery-isolated-tests-v1', recordedAtUtc: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, productionGuardTouched: false, gpuInvocations: 0 }
const output = path.join(testParent, `report-${Date.now()}.json`)
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, report: path.relative(process.cwd(), output), failures: results.filter(r => !r.passed) }))
