import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const EVIDENCE = Object.freeze({
  interruptionTerminal: [".runtime/ai-painter/stage4-host-session-training-interruptions/20260823-095700000/phase-terminal.json", "7b7da7cbb454904aa53032531126b1c0eda695d8cef7e3e65bf88a0812d64630"],
  oldProgress: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-083751371-capacity-stage0/training-output/progress.json", "0e4d71c17a9ed8d2fee3cb002aff50a6fdb06c22a9987559a788c4eb27a065ae"],
  backgroundCpuReport: [".runtime/ai-painter/stage4-background-continuation-cpu-regressions/20260823-110000000/cpu-report.json", "fd867d36c9a455071f6ea47666aaa5d9ec8ff355490fac02a1cac1933bfc7ee8"],
  priorCapacityPlan: [".runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/20260823-105352744/execution-plan.json", "b009f29a90126e16329fa497587933e0dd9e29109f9302ff9ad0dd4627e2dc37"],
  capacityRouteTerminal: [".runtime/ai-painter/stage4-condition-fusion-stage0-final-route-adjudications/20260823-083751371/phase-terminal.json", null],
  staleLockCpuReport: [".runtime/ai-painter/stage4-stale-formal-lock-cpu-regressions/20260823-105011746/cpu-report.json", "c069ef952db9a27cc4214972f4e9bb30214fb0203f4bce9b97becc977eaef638"],
  preconsumptionFailureCpuReport: [".runtime/ai-painter/stage4-background-preconsumption-failure-cpu-regressions/20260823-103000002/cpu-report.json", "16bff737157830500999097d5ccf8796ade81abd56ef7611ebb896b9692c7e4a"],
  preconsumptionFailureTerminal: [".runtime/ai-painter/stage4-background-continuation-jobs/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/phase-terminal.json", "dd603e41353d07da6ad5a1e34abfebcdd474b07974003f41d68b34b4bbc31344"],
  realProgressRepairTerminal: [".runtime/ai-painter/stage4-post-quarantine-handoff-repairs/20260823-110654432/phase-terminal.json", "a88a93b8c3ee6ca215c1f66dbc7213f19f2648e142cab3708e766a13f3cab560"],
  realProgressRepairSupport: [".runtime/ai-painter/stage4-post-quarantine-handoff-repairs/20260823-110654432/implementation-support-contract.json", "f8fff726ef200ba34e658926ad6091e2530042e21da0c125821ecd8da080a83e"],
  priorQuarantineTerminal: [".runtime/ai-painter/stage4-stale-formal-lock-quarantines/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/phase-terminal.json", "516e87493dbe2ebff8b379e1b1b0d0cf81f03e304687cfd43c04c999f83a0e2d"],
  priorQuarantinedLock: [".runtime/ai-painter/stage4-stale-formal-lock-quarantines/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823025542594/stale-formal-stage.lock.json", "d8c2a7143fa753afe3d94bdfd2d53dd3d9e5889c276f841ca52a61c44eac68e0"],
  staleLockStage0Terminal: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-103000000-capacity-stage0/finalization/phase-terminal.json", "2e750e22e02a2b1542efb1c455d4295dd5a365ad631424a33bcb52ecd7e00861"],
  staleLockFailureAdjudication: [".runtime/ai-painter/stage4-stale-formal-lock-failures/20260823-111000000/phase-terminal.json", null],
})
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
for (const [name, [relative, expected]] of Object.entries(EVIDENCE)) {
  const target = projectFile(relative)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (expected) assert.equal(sha(target), expected, `${name}_sha256_mismatch`)
}
const requestId = `owner-authorized-stage4-background-host-recovery-continuation-${runId}`
const root = projectFile(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(root), false, "authorization_namespace_exists")
fs.mkdirSync(root, { recursive: true })
const programs = {
  compiler: "scripts/compile-stage4-background-host-recovery-continuation-plan.mjs",
  planChecker: "scripts/check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs",
  packageCore: "src/server/project-owner-stage4-continuation-package-core.mjs",
  backgroundLauncher: "scripts/run-ai-painter-stage4-stage0-to-80-background.mjs",
  backgroundWorker: "scripts/run-ai-painter-stage4-stage0-to-80-background-worker.mjs",
  backgroundStarter: "scripts/windows/start-ai-painter-stage4-background-process.ps1",
  staleLockRepairer: "scripts/repair-ai-painter-stage4-stale-formal-lock.mjs",
  preconsumptionFailureCpuChecker: "scripts/check-ai-painter-stage4-background-preconsumption-failure-recording.mjs",
  postQuarantineHandoffCpuChecker: "scripts/check-ai-painter-stage4-post-quarantine-handoff.mjs",
  packageCore: "src/server/project-owner-stage4-continuation-package-core.mjs",
}
const authorizationPath = path.join(root, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-background-host-recovery-continuation-compilation-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "cpu_only_record_host_interruption_and_compile_fresh_host_isolated_capacity_stage0_to_stage2_plan",
  allowedActions: ["verify_host_interruption_evidence", "verify_background_disconnect_regression", "verify_real_progress_run_identity_repair", "verify_preconsumption_failure_recording", "materialize_fresh_resolved_implementation_lineage", "compile_fresh_capacity_stage0_stage1_stage2_plan", "write_one_offline_signing_command", "synchronize_local_task_capsule_event_ledger_and_sqlite"],
  deniedActions: ["read_owner_private_key", "sign_package", "reuse_old_package", "reuse_old_authorization", "reuse_old_run_id", "reuse_old_output", "read_checkpoint_weights", "reuse_partial_weights", "start_gpu", "start_training", "create_optimizer", "execute_backward", "automatic_retry"],
  sourceEvidence: Object.fromEntries(Object.entries(EVIDENCE).map(([name, [relative]]) => [name, bind(projectFile(relative))])),
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, relative]) => [name, bind(projectFile(relative))])),
  outputNamespace: `.runtime/ai-painter/stage4-background-host-recovery-continuation-compilations/${runId}`,
  planNamespace: `.runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/${runId}`,
  lineageNamespace: `.runtime/ai-painter/stage4-continuation-resolved-lineage-materializations/${runId}`,
  oneTimeConsumption: true,
  gpuAuthorized: false,
  trainingAuthorized: false,
  ownerPrivateKeyReadAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: project(path.join(root, "consumption.json")) }, null, 2))

function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
function projectFile(value) { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
function project(value) { return path.relative(ROOT, value).replaceAll("\\", "/") }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: project(value), sha256: sha(value) } }
