import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_stage0_autoencoder_multisample_and_source_evidence",
  "structurally_trace_23_channel_condition_to_final_rgb_path",
  "compare_condition_fusion_capacity_and_shared_output_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_structure_review_authorization",
  "write_structure_report_decision_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "read_or_load_checkpoint_weights", "modify_model", "modify_loss", "modify_data",
  "select_free_hyperparameters", "add_same_type_loss", "start_gpu", "start_smoke",
  "start_stage0", "start_stage1", "start_stage2", "start_training", "rerun_exited_candidate",
  "reuse_failed_checkpoint", "lower_review_thresholds", "use_failed_preview_as_training_target",
  "use_review_result_as_training_target", "implement_architecture_in_this_review",
])
const EVIDENCE = Object.freeze({
  priorFailureTerminal: { path: ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-172647827/phase-terminal.json", sha256: "5d89ab37c012b1b6703828dee48f9172fa183420d6cbdf76ad3dd784e91bfd95" },
  priorFailureReport: { path: ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-172647827/failure-report.json", sha256: "6f082bfdf02aff8c836626f9a305064360bf6d3a8164f66fa25cbe71ffaac0b6" },
  priorConsumption: { path: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-substantive-model-structure-review-20260822-172647827/consumption.json", sha256: "4332c59faa7641869e25c1f9030ab5283296fb95d3e26860ac574145d854f734" },
  currentTerminal: { path: ".runtime/ai-painter/stage4-conflict-aware-stage0-residual-semantic-adjudications/20260822-171514271/phase-terminal.json", sha256: "58c7fba120c18c5bc66b0778f7554cf23bbfdebcd0a6eb282714ffaaa4670592" },
  currentAnalysis: { path: ".runtime/ai-painter/stage4-conflict-aware-stage0-residual-semantic-adjudications/20260822-171514271/causal-analysis-report.json", sha256: "60c5af4019dddfc5dbbe1bca4af809c3d142299a989a2fec4a029a525580d3f7" },
  currentDecision: { path: ".runtime/ai-painter/stage4-conflict-aware-stage0-residual-semantic-adjudications/20260822-171514271/adjudication.json", sha256: "939e0411c1d5372f7542860226cb73c3d2ec092e4ff072350b33c87f3845e18b" },
  trainingParadigmExit: { path: ".runtime/ai-painter/stage4-conflict-aware-stage0-residual-semantic-adjudications/20260822-171514271/training-paradigm-exit-proposal.json", sha256: "f77878b2036241a8a20f286e530fb755739dab5c494df89b2cdc6c52c37dbf1a" },
  structureReviewRequest: { path: ".runtime/ai-painter/stage4-conflict-aware-stage0-residual-semantic-adjudications/20260822-171514271/model-structure-review-request.json", sha256: "d552520feb5580c020c19cfa9ce2ecb02d666538df857196f4b77afbb5e5a779" },
  priorCpuReport: { path: ".runtime/ai-painter/stage4-conflict-aware-stage0-residual-semantic-adjudications/20260822-171514271/cpu-report.json", sha256: "0b27b03b49a6c061cfa6f8882581461ceaf04a0f05e3e4ef59cb6befae270226" },
  activeConfig: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/active-config.json", sha256: "badf0c1cf4059423d9cdbca05773a43edd6a36f2e7efa117e986bae6ceb7bd13" },
  autoencoderTerminal: { path: ".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/phase-terminal.json", sha256: "a943a7eca3f19e4c3e2f1c3aca32f8fa4a225aa0cf175b77bf8e390f2a43c449" },
  autoencoderDecision: { path: ".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/adjudication.json", sha256: "2fa6bcad4f7a219e768faac8b5019966c97a8cf34ba89521803ada77aa6b3d6a" },
  multisampleTerminal: { path: ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/phase-terminal.json", sha256: "f4ec93aaf924a8e8bc21483c09a14fedfd52e05436ec7f0014d9334b6f843e4e" },
  multisampleGpuReport: { role: "capacity_and_exact_representation_collision_evidence", path: ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/gpu-report.json", sha256: "040f8a721bc8b54d2237787ecb714a8ec9fc35cb5eda4d7fab8c4ba69b421e62" },
  multisampleAnalysis: { role: "condition_reachability_evidence", path: ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/multisample-capacity-gradient-interference-analysis.json", sha256: "f37e0f5637f03ea45ca87474efdc09755893e27502cf5a9c5d56d27a7edfacc9" },
  multisampleDecision: { path: ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/adjudication.json", sha256: "adbd2e1e1113c497630d4de091f6af787ab365e4ac7dfcb582dbea038a51fb10" },
  modelSource: { path: "ml/ai-painter/src/ai_painter/complete_world/model.py", sha256: "8b97ddb2b8ad044c526aa969e963589288d4439ac1a06198ee1024138d631dd3" },
  trainerSource: { path: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py", sha256: "1c64bb7798cfcab5ba7d9aba1b4926a4477cba4eb560ae6cf55bf4a584941e6c" },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => {
  assert.equal(path.isAbsolute(value), false, "absolute_path_rejected")
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_path_required")
  return target
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-substantive-model-structure-review-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: file("scripts/run-stage4-substantive-model-structure-review.mjs"),
  checker: file("scripts/check-stage4-substantive-model-structure-review.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-substantive-model-structure-review.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-substantive-model-structure-review-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_readonly_stage4_substantive_model_structure_review",
  allowedActions: ACTIONS,
  deniedActions: DENIALS,
  sourceEvidence: EVIDENCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-substantive-model-structure-reviews/${runId}`,
  automaticRetryAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  modelModificationAuthorized: false,
  architectureImplementationAuthorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))
