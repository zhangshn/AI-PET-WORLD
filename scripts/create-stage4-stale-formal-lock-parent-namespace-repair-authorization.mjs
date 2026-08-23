import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")

const evidence = {
  failedPackage: bindKnown(".runtime/ai-painter/owner-action-requests/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823024149360/package.json", "1afd24fce91c39d2bfc3fbdd168c8420ce9d97c82697f61989be9dee550d3b86"),
  failedTerminal: bindKnown(".runtime/ai-painter/stage4-background-preconsumption-failures/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823024149360/phase-terminal.json", "5d84272e7df9f83aa1d01dbc357a03531bbddca2575753930a8638f86f600e9a"),
  failureReport: bindKnown(".runtime/ai-painter/stage4-background-preconsumption-failures/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823024149360/failure-report.json", "41e4a56bfd87757a4f7506d6b6534c78412e03f7006512923ddb85ee5b44e83d"),
  staleLock: bindKnown(".runtime/ai-painter/stage4-semantic-mixture-formal-training/.formal-stage.lock", "d8c2a7143fa753afe3d94bdfd2d53dd3d9e5889c276f841ca52a61c44eac68e0"),
  interruptionTerminal: bindKnown(".runtime/ai-painter/stage4-host-session-training-interruptions/20260823-095700000/phase-terminal.json", "7b7da7cbb454904aa53032531126b1c0eda695d8cef7e3e65bf88a0812d64630"),
  oldProgress: bindKnown(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-083751371-capacity-stage0/training-output/progress.json", "0e4d71c17a9ed8d2fee3cb002aff50a6fdb06c22a9987559a788c4eb27a065ae"),
  cpuReport: bindKnown(".runtime/ai-painter/stage4-stale-formal-lock-cpu-regressions/20260823-105011746/cpu-report.json", "c069ef952db9a27cc4214972f4e9bb30214fb0203f4bce9b97becc977eaef638"),
  repairer: bindFile("scripts/repair-ai-painter-stage4-stale-formal-lock.mjs"),
  checker: bindFile("scripts/check-ai-painter-stage4-stale-formal-lock-repair.mjs"),
}
const failed = read(projectFile(evidence.failedTerminal.path))
assert.equal(failed.status, "stage4_background_start_failed_before_authorization_consumption_closed")
assert.equal(failed.packageReusable, false)
assert.equal(failed.authorizationStates.every((value) => value.consumed === false), true)
const cpu = read(projectFile(evidence.cpuReport.path))
assert.equal(cpu.status, "passed_stage4_stale_formal_lock_parent_namespace_and_real_progress_identity_cpu_regression")
assert.equal(cpu.missingFixedParentCreatedPassed, true)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

const requestId = `owner-authorized-stage4-stale-formal-lock-parent-namespace-repair-${runId}`
const root = projectFile(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(root), false, "authorization_namespace_exists")
fs.mkdirSync(root, { recursive: true })
const authorizationPath = path.join(root, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-stale-formal-lock-parent-namespace-repair-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "cpu_only_fix_stale_formal_lock_fixed_parent_namespace_then_compile_fresh_background_continuation_plan",
  boundEvidence: evidence,
  allowedActions: ["implement_recursive_fixed_parent_creation", "run_cpu_positive_negative_regression", "record_failed_package_closed", "compile_fresh_unsigned_capacity_stage0_stage1_stage2_background_plan", "synchronize_local_task_capsule_event_ledger_sqlite_and_unique_plan_reference"],
  deniedActions: ["move_or_delete_real_stale_lock", "reuse_failed_package", "consume_coordinator_authorization", "consume_stage_authorization", "read_checkpoint_weights", "start_gpu", "create_optimizer", "execute_backward", "start_training", "read_owner_private_key", "sign_package"],
  outputNamespace: `.runtime/ai-painter/stage4-stale-formal-lock-parent-namespace-repairs/${runId}`,
  oneTimeConsumption: true,
  gpuAuthorized: false,
  trainingAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bindFile(project(authorizationPath)), consumptionPath: project(path.join(root, "consumption.json")) }, null, 2))

function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
function projectFile(value) { assert.equal(path.isAbsolute(value), false, "project_relative_path_required"); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_boundary_required"); return target }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function bindKnown(value, expected) { const target = projectFile(value); assert.equal(fs.existsSync(target), true, `${value}_missing`); assert.equal(sha(target), expected, `${value}_sha256_mismatch`); return { path: value, sha256: expected } }
function bindFile(value) { const target = projectFile(value); return { path: project(target), sha256: sha(target) } }
