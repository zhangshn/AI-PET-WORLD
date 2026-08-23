import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "run_id_required")
const evidence = {
  failedPackage: known(".runtime/ai-painter/owner-action-requests/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/package.json", "75cb66392b219d4e59167cb36daa4a95c8e8997488ae38b21d79e9d1d715136d"),
  backgroundTerminal: known(".runtime/ai-painter/stage4-background-continuation-jobs/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/phase-terminal.json", "dd603e41353d07da6ad5a1e34abfebcdd474b07974003f41d68b34b4bbc31344"),
  coordinatorStderr: known(".runtime/ai-painter/stage4-background-continuation-jobs/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/coordinator.stderr.log", "1904ba5bcf265c245bf18d220a583ce5f9b1751507533bbfc3ab40aae45af8ba"),
  quarantineTerminal: known(".runtime/ai-painter/stage4-stale-formal-lock-quarantines/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/phase-terminal.json", "516e87493dbe2ebff8b379e1b1b0d0cf81f03e304687cfd43c04c999f83a0e2d"),
  quarantinedLock: known(".runtime/ai-painter/stage4-stale-formal-lock-quarantines/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/stale-formal-stage.lock.json", "d8c2a7143fa753afe3d94bdfd2d53dd3d9e5889c276f841ca52a61c44eac68e0"),
  cpuReport: known(".runtime/ai-painter/stage4-post-quarantine-handoff-cpu-regressions/20260823-110357967/cpu-report.json", "00ed69d31cef17978a03c644e2b762a79cacd0c5b0953299b5b3092d07d5d28a"),
  planChecker: file("scripts/check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"),
  packageCore: file("src/server/project-owner-stage4-continuation-package-core.mjs"),
  backgroundLauncher: file("scripts/run-ai-painter-stage4-stage0-to-80-background.mjs"),
}
const requestId = `owner-authorized-stage4-post-quarantine-handoff-repair-${runId}`
const root = projectFile(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(root), false, "authorization_exists")
fs.mkdirSync(root, { recursive: true })
const authorizationPath = path.join(root, "authorization.json")
writeJsonAtomic(authorizationPath, { schemaVersion: "ai-painter-owner-stage4-post-quarantine-handoff-repair-v1", status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId, scope: "cpu_only_fix_post_quarantine_coordinator_verification_then_compile_fresh_background_plan", boundEvidence: evidence, allowedActions: ["implement_pre_and_post_quarantine_verification", "run_cpu_positive_negative_regression", "record_failed_package_closed", "compile_fresh_unsigned_capacity_stage0_stage1_stage2_background_plan", "synchronize_local_governance"], deniedActions: ["reuse_failed_package", "move_or_restore_quarantined_lock", "consume_training_authorization", "read_checkpoint_weights", "start_gpu", "create_optimizer", "execute_backward", "start_training", "sign_package"], outputNamespace: `.runtime/ai-painter/stage4-post-quarantine-handoff-repairs/${runId}`, oneTimeConsumption: true, gpuAuthorized: false, trainingAuthorized: false })
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: file(project(authorizationPath)), consumptionPath: project(path.join(root, "consumption.json")) }, null, 2))

function arg(name) { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
function projectFile(value) { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function known(value, expected) { const target = projectFile(value); assert.equal(sha(target), expected); return { path: value, sha256: expected } }
function file(value) { const target = projectFile(value); return { path: project(target), sha256: sha(target) } }
