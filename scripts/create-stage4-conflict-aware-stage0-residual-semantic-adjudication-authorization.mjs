import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "20260822-145717731"
const SOURCE_ROOT = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}`
const ACTIONS = Object.freeze(["verify_current_stage0_residual_semantic_failure_evidence", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_adjudication_authorization", "write_problem_analysis_decision_exit_request_and_terminal", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"])
const DENIALS = Object.freeze(["read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss", "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target", "reuse_historical_stage0", "reuse_old_run_id", "reuse_old_authorization", "reuse_old_checkpoint", "auto_generate_same_type_loss", "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"])
const EVIDENCE = Object.freeze({
  stage0Terminal: { path: `${SOURCE_ROOT}/finalization/phase-terminal.json`, sha256: "7aec4fdcc865875c6715caa47094ac561f1ad2b5a2eaff594156c305a3f463cb" },
  stage0Manifest: { path: `${SOURCE_ROOT}/training-output/manifest.json`, sha256: "95e0f58d6f459bbc047e58442d18de9928bb4cdd2661fea8cc4fda01f352eb8e" },
  stage0MachineReview: { path: `${SOURCE_ROOT}/training-output/fixed-preview-reviews.json`, sha256: "bc8f56749ab19928f48a9aa63135cef2022e545c05b8b7b84807313da61347a7" },
  stage0Telemetry: { path: `${SOURCE_ROOT}/training-output/stage4-step-telemetry.json`, sha256: "247a4dd75e870dc9b9b6fa54cc252dc43f3b52838998bdc1ca525a3f0daa844b" },
  activeConfig: { path: `${SOURCE_ROOT}/active-config.json`, sha256: "badf0c1cf4059423d9cdbca05773a43edd6a36f2e7efa117e986bae6ceb7bd13" },
  failedCheckpointIdentityOnly: { path: `${SOURCE_ROOT}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "cfd933c1c4e1cd351cf52266aae9233abbad9b76f26d81c58cad566d9498dd4c", checkpointWeightsReadAuthorized: false },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, "absolute_path_rejected"); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, "project_path_required"); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-conflict-aware-stage0-residual-semantic-adjudication-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: file("scripts/run-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"),
  checker: file("scripts/check-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-conflict-aware-stage0-residual-semantic-adjudication.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-conflict-aware-stage0-residual-semantic-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  sourceRunId: SOURCE_RUN_ID,
  scope: "one_cpu_readonly_conflict_aware_stage0_residual_semantic_causal_adjudication",
  allowedActions: ACTIONS,
  deniedActions: DENIALS,
  sourceEvidence: EVIDENCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-conflict-aware-stage0-residual-semantic-adjudications/${runId}`,
  automaticRetryAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  stage1Authorized: false,
  stage2Authorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))
