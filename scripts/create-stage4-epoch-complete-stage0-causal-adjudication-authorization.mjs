import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "20260822-044700000"
const SOURCE_ROOT = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}`
const ACTIONS = Object.freeze([
  "verify_current_stage0_epoch_complete_failure_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_adjudication_authorization",
  "write_analysis_decision_inactive_contract_or_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss",
  "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0",
  "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target",
  "reuse_historical_stage0", "reuse_old_run_id", "reuse_old_authorization", "reuse_old_checkpoint",
  "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion",
  "runtime_frame", "world_entry",
])
const EVIDENCE = Object.freeze({
  stage0Terminal: { path: `${SOURCE_ROOT}/finalization/phase-terminal.json`, sha256: "061b75d1b0f6c31eff024628335ff1e202022aff0dc016e911d5992a66f03423" },
  stage0Manifest: { path: `${SOURCE_ROOT}/training-output/manifest.json`, sha256: "0152b1a8cd58e181fdfd5697ec8cebc71510c9a066412831ca1d68122abd0dfe" },
  stage0MachineReview: { path: `${SOURCE_ROOT}/training-output/fixed-preview-reviews.json`, sha256: "c504cccdfed4baaf8f53d029f64461c5855744dd4f0bdc04bd4a9f599826ee91" },
  stage0Telemetry: { path: `${SOURCE_ROOT}/training-output/stage4-step-telemetry.json`, sha256: "acc177c7e92287c40882ce02fff2c1b0188c725ab58e343e82d8cd4bbf352ec3" },
  activeConfig: { path: `${SOURCE_ROOT}/active-config.json`, sha256: "b2d6c2f2e1571198ad05beeceba3f44dc8963f011fd133474b2eaaacd480fcfa" },
  sourceIndex: { path: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json", sha256: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251" },
  failedCheckpointIdentityOnly: { path: `${SOURCE_ROOT}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`, sha256: "f8b9bc139d832faf2ac40aa64c871886ab0ebcb0a9a7d2e86ce9d563deaaae47", checkpointWeightsReadAuthorized: false },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, "absolute_path_rejected"); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, "project_path_required"); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-epoch-complete-stage0-causal-adjudication-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: file("scripts/run-stage4-epoch-complete-stage0-causal-adjudication.mjs"),
  checker: file("scripts/check-stage4-epoch-complete-stage0-causal-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-epoch-complete-stage0-causal-adjudication.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-epoch-complete-stage0-causal-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  sourceRunId: SOURCE_RUN_ID,
  scope: "one_cpu_readonly_current_stage0_footprints_tree_vegetation_reference_semantic_causal_adjudication",
  allowedActions: ACTIONS,
  deniedActions: DENIALS,
  sourceEvidence: EVIDENCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-epoch-complete-stage0-reference-semantic-causal-adjudications/${runId}`,
  automaticRetryAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  stage1Authorized: false,
  stage2Authorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))
