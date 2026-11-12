// Recovery transactions remain here; immutable input and host checks are shared with the registry.
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import { readCurrentExecutionRegistry, recoverExpiredActiveExecutionToFailedClosed, recoverPreparedCurrentExecutionRegistryAdvance } from '../../src/server/ai-painter-current-execution-registry.mjs'
import {GUARD, MAX_FILE, REGISTRY, evaluateRecovery, historicalProjectPath, isKernelInterruptionProfile, jsonBytes, kernelInterruptionTerminalIdentity, queryNativeHost, readFile, referenceMatches, requireValue, scopedFile, sha256, time, verifyHistoricalInputs, verifyKernelInterruptionHost} from './ai-painter-owned-worker-recovery-input.mjs'
export {sha256, historicalProjectPath, loadRecoveryProfile, verifyHistoricalFailure, normalizePreBootObservation, verifyHistoricalInputs, evaluateRecovery, queryNativeHost, readInterruptionBinding, isKernelInterruptionProfile, kernelInterruptionTerminalIdentity, verifyQualificationKernelInputs, verifyTrainingKernelInputs, verifyKernelInterruptionHost, verifyLiveInterruptionGuard} from './ai-painter-owned-worker-recovery-input.mjs'

export async function auditBoundRecovery(root, bound) {
  const historical = verifyHistoricalInputs(root, bound.profile)
  const host = queryNativeHost()
  const registry = await readCurrentExecutionRegistry(root)
  const active = path.join(root, GUARD)
  const currentGuardSha256 = fs.existsSync(active) ? sha256(readFile(active)) : null
  const decision = evaluateRecovery({ historical, registry, host, currentGuardSha256 })
  if (isKernelInterruptionProfile(bound.profile)) {
    requireValue(registry.ok && registry.registry?.activeExecution === null, 'interruption_terminal_not_registered')
    const identity = kernelInterruptionTerminalIdentity(bound.profile)
    requireValue(registry.currentTaskTerminal?.schemaVersion === identity.schemaVersion
      && registry.currentTaskTerminal.profileSha256 === bound.profileSha256
      && referenceMatches(registry.currentTaskTerminal.originalRegistry, bound.profile.registry)
      && registry.currentTaskTerminal.status === identity.status, 'interruption_terminal_mismatch')
    const adjusted = { ...registry, registrySha256: bound.profile.registry.sha256,
      registry: { ...registry.registry, registryRevision: bound.profile.registry.revision } }
    Object.assign(decision, evaluateRecovery({ historical, registry: adjusted, host, currentGuardSha256 }))
    requireValue(time(host.OsBootUtc) > time(historical.lastEvidenceAtUtc), 'interruption_boot_before_progress')
  }
  return { ...decision, schema: 'ai-painter-owned-worker-reboot-recovery-audit-v1', caseId: bound.profile.caseId, recordedAtUtc: new Date().toISOString(), profileSha256: bound.profileSha256, nativeObservationMissing: historical.nativeObservationMissing === true, failure: bound.profile.failure, receipt: bound.profile.receipt ?? null, host, registry: { ok: registry.ok, errorCode: registry.errorCode ?? null, sha256: registry.registrySha256, revision: registry.registry?.registryRevision ?? null, activeExecution: registry.registry?.activeExecution ?? null }, guardSha256: currentGuardSha256 }
}

export async function registerTrainingKernelInterruption(root, bound) {
  const historical = verifyHistoricalInputs(root, bound.profile)
  requireValue(isKernelInterruptionProfile(bound.profile), 'interruption_profile_invalid')
  const terminalIdentity = kernelInterruptionTerminalIdentity(bound.profile)
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
    writeExclusive(path.join(records, 'report.json'), { schemaVersion: terminalIdentity.schemaVersion.replace('terminal', 'report'),
      recordedAtUtc: new Date().toISOString(), ...identities, profileSha256: bound.profileSha256,
      originalRegistry: bound.profile.registry, heartbeat: bound.profile.heartbeat, host,
      phase: historical.phase, lastEvidenceAtUtc: historical.lastEvidenceAtUtc, lastDurableProgress: historical.progress, modelRootCauseEstablished: false,
      originalExitCauseEstablished: false,
      historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false })
  }
  const reportBytes = readFile(path.join(records, 'report.json'))
  requireValue(JSON.parse(reportBytes).profileSha256 === bound.profileSha256, 'interruption_report_conflict')
  if (!fs.existsSync(path.join(records, 'terminal.json'))) {
    writeExclusive(path.join(records, 'terminal.json'), { ...terminalIdentity,
      recordedAtUtc: new Date().toISOString(), ...identities, executionState: 'failed_closed',
      profileSha256: bound.profileSha256, originalRegistry: bound.profile.registry,
      recoveryReport: { path: reportPath, sha256: sha256(reportBytes) }, lastDurableProgress: historical.progress,
      phase: historical.phase, selectedCheckpoint: null, originalExitCauseEstablished: false, historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false })
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
    const result = { schema: 'ai-painter-owned-worker-reboot-recovery-result-v1', caseId: intent.caseId, transactionId: intent.transactionId, recordedAtUtc: new Date().toISOString(), status: 'quarantined_not_cleanup_certified', profileSha256: bound.profileSha256, guardSha256: bound.profile.guard.sha256, archivePath: historicalProjectPath(root, target), intentSha256: sha256(readFile(intentFile)), recoveredSameTransaction, nativeObservationMissing: bound.profile.schema === 'ai-painter-owned-worker-reboot-recovery-profile-v2' || isKernelInterruptionProfile(bound.profile), failure: bound.profile.failure ?? null, receipt: bound.profile.receipt ?? null, historicalCleanupCertified: false, oldExecutionMayReplay: false, trainingQualificationGranted: false }
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
