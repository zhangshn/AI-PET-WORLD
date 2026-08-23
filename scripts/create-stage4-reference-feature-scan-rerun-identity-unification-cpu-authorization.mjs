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
const requestId = `owner-authorized-stage4-reference-feature-scan-rerun-identity-unification-cpu-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
const evidence = {
  adjudicationTerminal: { path: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/20260822-081519953/phase-terminal.json", sha256: "0e2baf1339aa71ac59258ee640053b1fccc8dbf0bbe9c65d01623201d5a4886f" },
  analysisReport: { path: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/20260822-081519953/analysis-report.json", sha256: "4adf87f821d84dcee387d4b34619d1ad7c8caff1227ade5838c3f3462e1cf15d" },
  decision: { path: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/20260822-081519953/decision.json", sha256: "1f9730030790197ebee90bfb1f4426d3026ca58ee51bf385ebd0c06908366727" },
  inactiveContract: { path: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/20260822-081519953/inactive-execution-identity-unification-contract.json", sha256: "d12e8c663423bd2e7eb86c7104cd9dd781f9db168b5a1e431a55ea184cdc186a" },
  adjudicationCpuReport: { path: ".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-adjudications/20260822-081519953/cpu-report.json", sha256: "48bd562b8add97a3a74aece79ebce145e57955ef4db5329b74d9ebaa569a3cab" },
}
for (const [name, item] of Object.entries(evidence)) { const target = file(item.path); assert.equal(fs.existsSync(target) && fs.statSync(target).isFile(), true, `${name}_missing`); assert.equal(sha(target), item.sha256, `${name}_sha256_mismatch`) }
const programs = {
  implementationRunner: file("scripts/run-stage4-reference-feature-scan-rerun-identity-unification-cpu-implementation.mjs"),
  gpuRunner: file("ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification.py"),
  cpuChecker: file("ml/ai-painter/scripts/check_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_entry_cpu.py"),
  trainer: file("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  rolloutBase: file("ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification.py"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-reference-feature-scan-rerun-identity-unification-cpu-v1",
  status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId,
  scope: "one_cpu_only_reference_feature_scan_rerun_execution_identity_unification_implementation_and_regression",
  contractId: "stage4_reference_feature_scan_rerun_execution_identity_unification_v1",
  allowedActions: ["verify_bound_adjudication_evidence", "modify_only_existing_readonly_gpu_runner_and_cpu_checker", "execute_python_syntax_and_cpu_positive_negative_regression", "atomically_consume_one_cpu_implementation_authorization", "write_cpu_support_contract_owner_request_terminal_and_local_records"],
  deniedActions: ["relax_dtype_derived_tolerance", "add_training_steps", "add_loss_weight", "select_free_parameters", "modify_model", "modify_loss", "modify_data", "modify_checkpoint", "modify_review_thresholds", "start_gpu", "read_checkpoint", "create_optimizer", "execute_backward", "modify_weights", "start_training", "reuse_old_authorization", "reuse_old_run_id", "reuse_output_directory"],
  sourceEvidence: evidence,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-unification-cpu-implementations/${runId}`,
  checkpointReadAuthorized: false, gpuAuthorized: false, optimizerCreationAuthorized: false, backwardAuthorized: false, modelWeightModificationAuthorized: false, trainingAuthorized: false, automaticRetryAuthorized: false, oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))

