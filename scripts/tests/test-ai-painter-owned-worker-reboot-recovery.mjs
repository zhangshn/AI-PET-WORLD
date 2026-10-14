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
const report = { schema: 'ai-painter-reboot-recovery-isolated-tests-v1', recordedAtUtc: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, productionGuardTouched: false, gpuInvocations: 0 }
const output = path.join(testParent, `report-${Date.now()}.json`)
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, report: path.relative(process.cwd(), output), failures: results.filter(r => !r.passed) }))
