import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readCurrentExecutionRegistry } from '../../src/server/ai-painter-current-execution-registry.mjs'

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

export function loadRecoveryProfile(root, relative, expectedSha) {
  requireValue(digest(expectedSha), 'profile_sha256_required')
  const file = scopedFile(root, relative)
  const bytes = readFile(file, expectedSha)
  const profile = JSON.parse(bytes)
  requireValue(profile.schema === 'ai-painter-owned-worker-reboot-recovery-profile-v1', 'profile_schema_invalid')
  requireValue(/^[a-z0-9-]{1,64}$/.test(profile.caseId), 'case_id_invalid')
  requireValue(profile.guard.path === GUARD && profile.registry.path === REGISTRY, 'profile_target_invalid')
  return { profile, profileSha256: expectedSha, profilePath: relative }
}

export function verifyHistoricalInputs(root, profile) {
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
  const pre = loaded.preBoot.value
  requireValue(sha256(loaded.guardSnapshot.bytes) === profile.guard.sha256 && g.identity === profile.guardIdentity, 'historical_guard_identity_mismatch')
  const { ownerPid, commandBinding, ...startedGuard } = started
  requireValue(same(startedGuard, g) && Number.isInteger(ownerPid) && ownerPid > 0, 'started_guard_mismatch')
  requireValue(commandBinding === observation.bindingBase64 && observation.ownerPid === ownerPid, 'native_binding_mismatch')
  const binding = JSON.parse(Buffer.from(commandBinding, 'base64').toString('utf8'))
  requireValue(same(binding.guard, g) && binding.guardSha256 === profile.guard.sha256 && same(binding.nativeBuild, build), 'native_chain_mismatch')
  requireValue(path.resolve(binding.scope) === root && path.resolve(g.startedEvidence) === scopedFile(root, profile.started.path), 'native_scope_mismatch')
  requireValue(observation.authority === 'observation_only_no_release_authority' && observation.assignedBeforeResume === true, 'observation_authority_invalid')
  requireValue(failure.status === 'failed_closed_post_spawn_receipt_budget_blocked' && failure.controllerObservationOnly === true && failure.liveCleanupCertified === false, 'failure_evidence_invalid')
  requireValue(failure.currentGuardIdentity === g.identity && failure.currentGuard.sha256 === profile.guard.sha256 && failure.started.sha256 === profile.started.sha256 && failure.nativeBuild.sha256 === profile.build.sha256 && failure.nativeObservation.sha256 === profile.observation.sha256, 'failure_chain_mismatch')
  requireValue(pre.guardIdentity === g.identity && pre.guard.sha256 === profile.guard.sha256 && pre.registry.sha256 === profile.registry.sha256 && pre.activeExecution === null, 'pre_boot_chain_mismatch')
  requireValue(time(pre.host.OsBootUtc) < time(g.recordedAtUtc) && time(g.recordedAtUtc) < time(pre.host.ObservedUtc), 'pre_boot_time_order_invalid')
  requireValue(same(g.nativeOwnerSource, build.source), 'native_source_mismatch')
  for (const [file, expected] of [[build.snapshot, build.source.sha256], [build.binary, build.binarySha256]]) {
    const relative = path.relative(root, file)
    readFile(scopedFile(root, relative), expected)
  }
  readFile(scopedFile(root, path.relative(root, build.source.path)), build.source.sha256)
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
    const oldPids = new Set([guard.runnerPid, started.ownerPid, observation.rootPid])
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
  return { ...decision, schema: 'ai-painter-owned-worker-reboot-recovery-audit-v1', caseId: bound.profile.caseId, recordedAtUtc: new Date().toISOString(), profileSha256: bound.profileSha256, host, registry: { ok: registry.ok, errorCode: registry.errorCode ?? null, sha256: registry.registrySha256, revision: registry.registry?.registryRevision ?? null, activeExecution: registry.registry?.activeExecution ?? null }, guardSha256: currentGuardSha256 }
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
    const result = { schema: 'ai-painter-owned-worker-reboot-recovery-result-v1', caseId: intent.caseId, transactionId: intent.transactionId, recordedAtUtc: new Date().toISOString(), status: 'quarantined_not_cleanup_certified', profileSha256: bound.profileSha256, guardSha256: bound.profile.guard.sha256, archivePath: path.relative(root, target).replaceAll('\\', '/'), intentSha256: sha256(readFile(intentFile)), recoveredSameTransaction, historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false }
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
