import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, "absolute_path_rejected"); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, "project_path_required"); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-reference-feature-scan-rerun-identity-adjudication-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")

const evidence = {
  priorAdjudicationFailureTerminal: { path: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/20260822-081109912/phase-terminal.json", sha256: "eb60741077bef7d80914c5a5733ff053e141dbbfd62f4a6f8497f87639367e58" },
  priorAdjudicationFailureReport: { path: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/20260822-081109912/execution-failure-report.json", sha256: "a44786f031a73c875a38409054d15bb1ae23281ed4b0cf381bcbd0536cd60c94" },
  priorAdjudicationConsumption: { path: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-reference-feature-scan-rerun-identity-adjudication-20260822-081109912/consumption.json", sha256: "04a69a175dd719f6f5ab094be0e65bb4a27eb15aaba06053315deb7fbda5607b" },
  failureTerminal: { path: ".runtime/ai-painter/stage4-reference-feature-shared-replay-readonly-gpu-qualifications/20260822-075250689/phase-terminal.json", sha256: "a8191ccb7de0e0fc1063d5682ea9c66320a984d81b56258b2d22d2fb988ce72e" },
  failureAnalysis: { path: ".runtime/ai-painter/stage4-reference-feature-shared-replay-readonly-gpu-qualifications/20260822-075250689/derived-bound-failure-analysis.json", sha256: "cbab42f5725a2595b4154f24c0fc2e8c2e0db6f2952788ee508245424ac242f4" },
  gpuConsumption: { path: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-reference-feature-shared-replay-readonly-gpu-20260822-075250689/gpu-consumption.json", sha256: "72ccd9280b9da2a4eaf1ca9812fc8cf521152f83c2e0446d2635ec81f154273c" },
  gpuRunner: { path: "ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification.py", sha256: "c74a088d7954695ef4791d6946cb7c2d08f8f86ac2019ab3e1c73618a7c21b5d" },
  gpuCpuChecker: { path: "ml/ai-painter/scripts/check_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_entry_cpu.py", sha256: "0c2ac3df3a726c673b2737bad3b523860e20d877136f2d0a094533b33e092ef3" },
}
for (const [name, item] of Object.entries(evidence)) { const target = file(item.path); assert.equal(fs.existsSync(target) && fs.statSync(target).isFile(), true, `${name}_missing`); assert.equal(sha(target), item.sha256, `${name}_sha256_mismatch`) }

const programs = {
  runner: file("scripts/run-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"),
  checker: file("scripts/check-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-reference-feature-scan-rerun-identity-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId,
  scope: "one_cpu_readonly_scan_vs_differentiable_rerun_execution_identity_causal_adjudication",
  allowedActions: ["verify_bound_failure_evidence", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_authorization", "write_analysis_decision_inactive_contract_and_terminal", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"],
  deniedActions: ["reuse_old_authorization", "reuse_old_run_id", "reuse_gpu_consumption", "reuse_partial_scan_results", "reuse_output_directory", "relax_dtype_derived_tolerance", "start_gpu", "read_old_checkpoint", "create_optimizer", "execute_backward", "modify_weights", "start_training", "automatic_gpu_retry"],
  sourceEvidence: evidence,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/${runId}`,
  checkpointWeightsReadAuthorized: false, gpuAuthorized: false, optimizerCreationAuthorized: false,
  backwardAuthorized: false, modelWeightModificationAuthorized: false, trainingAuthorized: false,
  automaticRetryAuthorized: false, oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))
