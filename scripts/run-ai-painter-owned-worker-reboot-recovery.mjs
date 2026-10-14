import path from 'node:path'
import { loadRecoveryProfile, auditBoundRecovery, quarantineRecovery, saveRecoveryAudit, registerTrainingKernelInterruption, verifyTrainingKernelInputs, verifyKernelInterruptionHost, queryNativeHost } from './lib/ai-painter-owned-worker-reboot-recovery-v1.mjs'

const args = process.argv.slice(2)
const get = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const allowed = new Set(['--profile', '--sha256', '--audit-output', '--apply'])
for (let i = 0; i < args.length; i++) {
  if (!allowed.has(args[i])) throw new Error('unsupported_argument')
  if (args[i] !== '--apply') i++
}
const root = path.resolve(process.cwd())
try {
  const bound = loadRecoveryProfile(root, get('--profile'), get('--sha256'))
  if (bound.profile.schema === 'ai-painter-owned-worker-reboot-recovery-profile-v3') {
    if (args.includes('--apply')) await registerTrainingKernelInterruption(root, bound)
    else {
      const historical = verifyTrainingKernelInputs(root, bound.profile), host = queryNativeHost()
      verifyKernelInterruptionHost(historical, host)
      console.log(JSON.stringify({ caseId: bound.profile.caseId, status: 'historical_inputs_and_native_host_verified_registration_pending', historicalCleanupCertified: false, trainingQualificationGranted: false }))
      process.exit(0)
    }
  }
  const result = args.includes('--apply')
    ? await quarantineRecovery(root, bound, () => auditBoundRecovery(root, bound))
    : await auditBoundRecovery(root, bound)
  if (get('--audit-output')) saveRecoveryAudit(root, get('--audit-output'), result)
  // Process command lines remain in bounded local evidence, not the chat/console summary.
  console.log(JSON.stringify({ caseId: result.caseId, status: result.status, errors: result.errors ?? [], historicalCleanupCertified: false, trainingQualificationGranted: false }))
  if (result.status === 'blocked') process.exitCode = 2
} catch (error) {
  console.error(JSON.stringify({ status: 'blocked', error: error.message, historicalCleanupCertified: false, trainingQualificationGranted: false }))
  process.exitCode = 2
}
