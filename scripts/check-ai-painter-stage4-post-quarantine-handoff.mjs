import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { auditStage4Stage0To80ContinuationPlan } from "./check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"

const ROOT = process.cwd()
const runId = process.argv[2]
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "run_id_required")
const packageId = "owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594"
const sourcePlan = read(".runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/20260823-105352744/execution-plan.json")
const quarantineTerminal = ".runtime/ai-painter/stage4-stale-formal-lock-quarantines/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/phase-terminal.json"
const quarantinedLock = ".runtime/ai-painter/stage4-stale-formal-lock-quarantines/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/stale-formal-stage.lock.json"
const originalLock = sourcePlan.hostExecution.staleFormalLockRecovery.lock.path
assert.equal(fs.existsSync(projectFile(originalLock)), false, "original_lock_must_be_absent_after_quarantine")

function basePlan() {
  const plan = structuredClone(sourcePlan)
  plan.hostExecution.launcher = bind("scripts/run-ai-painter-stage4-stage0-to-80-background.mjs")
  plan.hostExecution.staleFormalLockRecovery.repairer = bind("scripts/repair-ai-painter-stage4-stale-formal-lock.mjs")
  plan.hostExecution.staleFormalLockRecovery.cpuReport = bind(".runtime/ai-painter/stage4-stale-formal-lock-cpu-regressions/20260823-105011746/cpu-report.json")
  plan.hostExecution.staleFormalLockRecovery.implementationTerminal = bind(".runtime/ai-painter/stage4-stale-formal-lock-parent-namespace-repairs/20260823-105300664/phase-terminal.json")
  plan.hostExecution.staleFormalLockRecovery.supportContract = bind(".runtime/ai-painter/stage4-stale-formal-lock-parent-namespace-repairs/20260823-105300664/implementation-support-contract.json")
  return plan
}

const originalMode = basePlan()
originalMode.hostExecution.staleFormalLockRecovery.sourceState = "original_lock_pending_quarantine"
const currentPackagePostQuarantine = auditStage4Stage0To80ContinuationPlan(originalMode, { root: ROOT, packageId })

const priorMode = basePlan()
priorMode.hostExecution.staleFormalLockRecovery.sourceState = "prior_quarantine_verified"
priorMode.hostExecution.staleFormalLockRecovery.priorQuarantineTerminal = bind(quarantineTerminal)
priorMode.hostExecution.staleFormalLockRecovery.priorQuarantinedLock = bind(quarantinedLock)
const freshPackagePreflight = auditStage4Stage0To80ContinuationPlan(priorMode, { root: ROOT })

const negatives = {
  original_mode_without_package_id_rejected: reject(originalMode, null, () => {}),
  original_mode_wrong_package_id_rejected: reject(originalMode, "owner-authorized-wrong-package-id", () => {}),
  unknown_source_state_rejected: reject(priorMode, null, (plan) => { plan.hostExecution.staleFormalLockRecovery.sourceState = "unknown" }),
  missing_prior_terminal_rejected: reject(priorMode, null, (plan) => { delete plan.hostExecution.staleFormalLockRecovery.priorQuarantineTerminal }),
  missing_prior_lock_rejected: reject(priorMode, null, (plan) => { delete plan.hostExecution.staleFormalLockRecovery.priorQuarantinedLock }),
  forged_prior_terminal_hash_rejected: reject(priorMode, null, (plan) => { plan.hostExecution.staleFormalLockRecovery.priorQuarantineTerminal.sha256 = "0".repeat(64) }),
  forged_prior_lock_hash_rejected: reject(priorMode, null, (plan) => { plan.hostExecution.staleFormalLockRecovery.priorQuarantinedLock.sha256 = "0".repeat(64) }),
  prior_path_injection_rejected: reject(priorMode, null, (plan) => { plan.hostExecution.staleFormalLockRecovery.priorQuarantinedLock.path = "../outside" }),
}
assert.equal(Object.values(negatives).every(Boolean), true)
const outputRoot = projectFile(`.runtime/ai-painter/stage4-post-quarantine-handoff-cpu-regressions/${runId}`)
assert.equal(fs.existsSync(outputRoot), false, "output_exists")
fs.mkdirSync(outputRoot, { recursive: true })
const report = {
  schemaVersion: "ai-painter-stage4-post-quarantine-handoff-cpu-report-v1",
  status: "passed_stage4_post_quarantine_coordinator_handoff_cpu_regression",
  runId,
  positivePassed: 2,
  positiveTotal: 2,
  currentPackagePostQuarantineAuditPassed: currentPackagePostQuarantine.status === "stage4_stage0_to_80_continuation_plan_audit_passed",
  freshPackagePriorQuarantinePreflightPassed: freshPackagePreflight.status === "stage4_stage0_to_80_continuation_plan_audit_passed",
  negative: negatives,
  negativePassed: Object.values(negatives).filter(Boolean).length,
  negativeTotal: Object.keys(negatives).length,
  coordinatorAuthorizationConsumed: false,
  stageAuthorizationsConsumed: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
}
fs.writeFileSync(path.join(outputRoot, "cpu-report.json"), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
console.log(JSON.stringify(report, null, 2))

function reject(plan, candidatePackageId, mutate) { const value = structuredClone(plan); mutate(value); try { auditStage4Stage0To80ContinuationPlan(value, { root: ROOT, packageId: candidatePackageId }); return false } catch { return true } }
function projectFile(value) { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
function read(value) { return JSON.parse(fs.readFileSync(projectFile(value), "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(projectFile(value))).digest("hex") }
function bind(value) { return { path: value, sha256: sha(value) } }
