import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "20260821-064100000"
const SOURCE_ROOT = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}`
const REQUIRED_ACTIONS = Object.freeze([
  "verify_current_stage0_three_object_failure_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_adjudication_authorization",
  "write_analysis_decision_inactive_contract_or_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIED_ACTIONS = Object.freeze([
  "read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss",
  "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0",
  "lower_review_thresholds", "use_failed_preview_as_training_target",
  "use_review_result_as_training_target", "reuse_historical_stage0", "reuse_old_run_id",
  "reuse_old_authorization", "reuse_old_checkpoint", "start_stage1", "start_stage2",
  "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry",
])
const EXPECTED = Object.freeze({
  stage0Terminal: { path: `${SOURCE_ROOT}/finalization/phase-terminal.json`, sha256: "8980f5b7fd63c612200c2cb07106709a013fa715f396f821896b0da4d4b337bb" },
  stage0Manifest: { path: `${SOURCE_ROOT}/training-output/manifest.json`, sha256: "a8e2827afcbd86a0e2d2e390f6547bc37180fe0b653bb91c99b720654480c04b" },
  stage0MachineReview: { path: `${SOURCE_ROOT}/training-output/fixed-preview-reviews.json`, sha256: "110b643123db3505ca62cfa1ee972fbbfbb082b525bf2a3c7bcd1612eeadb6b6" },
  failedCheckpointIdentityOnly: { path: `${SOURCE_ROOT}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "b0369cc06411eefa37926cf5ed5c4add4da1e9c199f96b1e18947b9f581c3e5c", checkpointWeightsReadAuthorized: false },
  activeConfig: { path: `${SOURCE_ROOT}/active-config.json`, sha256: "fa5c3d31a3e6a19c5ea94701cf82aba8fd85fb02fc2c4f162a4d04fd4f1618c8" },
})

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
}
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-three-object-stage0-causal-adjudication-${runId}`
const directory = projectFile(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EXPECTED)) {
  const file = projectFile(evidence.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") assert.equal(shaFile(file), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-three-object-stage0-causal-adjudication.mjs"),
  checker: projectFile("scripts/check-stage4-three-object-stage0-causal-adjudication.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-three-object-stage0-causal-adjudication.mjs"),
  inspectedTrainer: projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-three-object-stage0-causal-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  sourceRunId: SOURCE_RUN_ID,
  scope: "one_cpu_readonly_current_stage0_footprints_tree_rock_reference_semantic_causal_adjudication",
  allowedActions: REQUIRED_ACTIONS,
  deniedActions: DENIED_ACTIONS,
  sourceEvidence: EXPECTED,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, file]) => [name, bind(file)])),
  outputNamespace: `.runtime/ai-painter/stage4-stage0-three-object-reference-semantic-causal-adjudications/${runId}`,
  automaticRetryAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  stage1Authorized: false,
  stage2Authorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({
  status: "resolved_owner_authorized_not_consumed",
  authorization: bind(authorizationPath),
  consumptionPath: relative(path.join(directory, "consumption.json")),
}, null, 2))
