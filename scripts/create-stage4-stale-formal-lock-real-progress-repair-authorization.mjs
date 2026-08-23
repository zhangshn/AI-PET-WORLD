import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = argument("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")

const bindings = Object.freeze({
  signedPackage: [".runtime/ai-painter/owner-action-requests/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823021809789/package.json", "328a0bb6ce543122715f041d32d72a0c35b1e9aa3231ca5ea8f2ab2b7b082da1"],
  executionPlan: [".runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/20260823-111500000/execution-plan.json", "70a585e6f529f0a25ab94be09968f5e1f0da8ca5448229e099134df1a8cd9e6e"],
  staleLock: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/.formal-stage.lock", "d8c2a7143fa753afe3d94bdfd2d53dd3d9e5889c276f841ca52a61c44eac68e0"],
  interruptionTerminal: [".runtime/ai-painter/stage4-host-session-training-interruptions/20260823-095700000/phase-terminal.json", "7b7da7cbb454904aa53032531126b1c0eda695d8cef7e3e65bf88a0812d64630"],
  oldProgress: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-083751371-capacity-stage0/training-output/progress.json", "0e4d71c17a9ed8d2fee3cb002aff50a6fdb06c22a9987559a788c4eb27a065ae"],
  staleLockRepairerBefore: ["scripts/repair-ai-painter-stage4-stale-formal-lock.mjs", "1b29777891ac4e9f6cee819cbc2a3139d8b7e60b65014ec5e5cca4c9b64e2e72"],
})

for (const [name, [relative, expectedSha256]] of Object.entries(bindings)) {
  const file = projectFile(relative)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), expectedSha256, `${name}_sha256_mismatch`)
}

const packageValue = read(projectFile(bindings.signedPackage[0]))
assert.equal(packageValue.status, "owner_signed_not_started", "signed_package_status_invalid")
assert.equal(packageValue.planSha256, bindings.executionPlan[1], "signed_package_plan_mismatch")
const packageId = packageValue.packageId
assert.equal(fs.existsSync(projectFile(`.runtime/ai-painter/stage4-stage0-to-80-continuation-executions/${packageId}`)), false, "continuation_execution_root_exists")
assert.equal(fs.existsSync(projectFile(`.runtime/ai-painter/stage4-stale-formal-lock-quarantines/${packageId}`)), false, "stale_lock_quarantine_exists")
for (const role of ["coordinator", "stage0", "stage1", "stage2"]) {
  const request = read(projectFile(`.runtime/ai-painter/owner-action-requests/${packageId}/${role}/request.json`))
  assert.equal(request.status, "authorized", `${role}_authorization_status_invalid`)
  assert.equal(fs.existsSync(projectFile(`.runtime/project-owner-write-authorization-consumptions/${request.authorizationId}`)), false, `${role}_authorization_consumed`)
}
const progress = read(projectFile(bindings.oldProgress[0]))
assert.equal(progress.runId, undefined, "real_progress_unexpected_top_level_run_id")
assert.equal(progress.taskIdentity?.runId, undefined, "real_progress_unexpected_task_run_id")
assert.equal(progress.liveProgress?.runId, undefined, "real_progress_unexpected_live_run_id")

const requestId = `owner-authorized-stage4-stale-formal-lock-real-progress-repair-${runId}`
const requestRoot = projectFile(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(requestRoot), false, "authorization_namespace_exists")
fs.mkdirSync(requestRoot, { recursive: true })
const authorizationPath = path.join(requestRoot, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-stale-formal-lock-real-progress-repair-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "cpu_only_fix_real_progress_run_identity_and_preconsumption_failure_record_then_compile_fresh_background_continuation_plan",
  boundEvidence: Object.fromEntries(Object.entries(bindings).map(([name, [relative]]) => [name, bind(projectFile(relative))])),
  stalePackageIdentity: { packageId, reusableAfterProgramChange: false, authorizationsConsumed: false },
  allowedFiles: [
    "scripts/repair-ai-painter-stage4-stale-formal-lock.mjs",
    "scripts/check-ai-painter-stage4-stale-formal-lock-repair.mjs",
    "scripts/run-ai-painter-stage4-stage0-to-80-background.mjs",
    "scripts/check-ai-painter-stage4-background-preconsumption-failure-recording.mjs",
    "scripts/create-stage4-background-host-recovery-continuation-authorization.mjs",
    "scripts/compile-stage4-background-host-recovery-continuation-plan.mjs",
    "scripts/run-stage4-stale-formal-lock-real-progress-repair.mjs"
  ],
  allowedActions: ["record_preconsumption_failure", "implement_real_progress_path_run_id_derivation", "implement_preconsumption_failure_recording", "run_cpu_positive_negative_regression", "close_unconsumed_stale_package", "compile_fresh_unsigned_capacity_stage0_stage1_stage2_background_plan", "synchronize_local_task_capsule_event_ledger_sqlite_and_unique_plan_reference"],
  deniedActions: ["move_or_delete_real_stale_lock", "consume_coordinator_authorization", "consume_stage_authorization", "read_checkpoint_weights", "start_gpu", "create_optimizer", "execute_backward", "start_training", "read_owner_private_key", "sign_package"],
  outputNamespace: `.runtime/ai-painter/stage4-stale-formal-lock-real-progress-repairs/${runId}`,
  oneTimeConsumption: true,
  gpuAuthorized: false,
  trainingAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: project(path.join(requestRoot, "consumption.json")) }, null, 2))

function argument(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
function projectFile(value) { assert.equal(path.isAbsolute(value), false, "project_relative_path_required"); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, "project_boundary_required"); return result }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: project(value), sha256: sha(value) } }
