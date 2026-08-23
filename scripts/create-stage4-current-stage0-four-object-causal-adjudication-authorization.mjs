import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "20260822-094629682"
const SOURCE_ROOT = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}`
const ACTIONS = Object.freeze([
  "verify_current_stage0_four_object_failure_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_adjudication_authorization",
  "write_problem_analysis_decision_route_exit_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss",
  "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0",
  "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target",
  "reuse_historical_stage0", "reuse_old_run_id", "reuse_old_authorization", "reuse_old_checkpoint",
  "auto_generate_new_model", "auto_generate_new_training_objective", "start_stage1", "start_stage2",
  "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry",
])
const EVIDENCE = Object.freeze({
  stage0Terminal: { path: `${SOURCE_ROOT}/finalization/phase-terminal.json`, sha256: "f41ddd3fde6beaedfa9cecc0b9f54e24b31dfd2942b8e1ef0f4417a9dced59dd" },
  stage0Manifest: { path: `${SOURCE_ROOT}/training-output/manifest.json`, sha256: "b1a99d22c21a3f8090195854074e42fa429a8571cb6f0459acab5fad3ac7121c" },
  stage0MachineReview: { path: `${SOURCE_ROOT}/training-output/fixed-preview-reviews.json`, sha256: "4f2129821642527defe9d5ab65a44034204963d2952d988277c27801959e4187" },
  stage0Telemetry: { path: `${SOURCE_ROOT}/training-output/stage4-step-telemetry.json`, sha256: "2ad1f63faf4bafb53d6e8ab79d0d080fe46a46fd8768bf3fdf425911ac163ce8" },
  activeConfig: { path: `${SOURCE_ROOT}/active-config.json`, sha256: "22a8455d0ad2115d2157c9c90f2c71a5f64ced8bd1a967d502484bae7fe60d75" },
  sourceIndex: { path: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json", sha256: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251" },
  failedCheckpointIdentityOnly: { path: `${SOURCE_ROOT}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "3281cb733e11b4163b137b438c9510c95a5963122b083b98cc483d107a7bb20a", checkpointWeightsReadAuthorized: false },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, "absolute_path_rejected"); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, "project_path_required"); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-current-stage0-four-object-causal-adjudication-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: file("scripts/run-stage4-current-stage0-four-object-causal-adjudication.mjs"),
  checker: file("scripts/check-stage4-current-stage0-four-object-causal-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-current-stage0-four-object-causal-adjudication.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-current-stage0-four-object-causal-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  sourceRunId: SOURCE_RUN_ID,
  scope: "one_cpu_readonly_current_stage0_four_object_reference_semantic_causal_adjudication",
  allowedActions: ACTIONS,
  deniedActions: DENIALS,
  sourceEvidence: EVIDENCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/${runId}`,
  automaticRetryAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  stage1Authorized: false,
  stage2Authorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))
