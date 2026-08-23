import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_substantive_structure_review_evidence",
  "inspect_formal_structure_dimension_derivation_evidence",
  "design_baseline_fusion_only_and_capacity_only_control_arms",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_design_authorization",
  "write_design_experiment_isolation_qualification_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "implement_model", "modify_model", "modify_loss", "modify_data", "add_same_type_loss",
  "select_free_hyperparameters", "select_unbound_structure_dimensions", "read_or_load_checkpoint_weights",
  "create_optimizer", "execute_backward", "modify_model_weights", "start_gpu", "start_smoke",
  "start_stage0", "start_stage1", "start_stage2", "start_training", "reuse_failed_checkpoint",
  "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target",
])
const EVIDENCE = Object.freeze({
  structureReviewTerminal: { path: ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-173038556/phase-terminal.json", sha256: "1dc2420c707c63aa1146f4bd22a29fcea46654a721f4d1f0d0c89d62e777d61e" },
  structureReviewReport: { path: ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-173038556/model-structure-review-report.json", sha256: "529455043f6d063ae13516c403c18cd804b0f79367e9b1d563830a3878eea334" },
  structureReviewAdjudication: { path: ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-173038556/adjudication.json", sha256: "1ffefdf170489f549a3243b3443e9766fce52bbfedf8f84ff5464c458415f19b" },
  structureReviewOwnerRequest: { path: ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-173038556/owner-evidence-request.json", sha256: "1ffca1734d78659e028180891070af9bc222e3bb82041c0eb61fe92b5aa07386" },
  structureReviewCpuReport: { path: ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-173038556/cpu-report.json", sha256: "c9bb4a9adf7d2cb55bdba6e33505a51ac60f1c330aa435e032a0ad280b6028fe" },
  activeConfig: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/active-config.json", sha256: "badf0c1cf4059423d9cdbca05773a43edd6a36f2e7efa117e986bae6ceb7bd13" },
  modelSource: { path: "ml/ai-painter/src/ai_painter/complete_world/model.py", sha256: "8b97ddb2b8ad044c526aa969e963589288d4439ac1a06198ee1024138d631dd3" },
})

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return target
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-bounded-controlled-model-structure-discrimination-design-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: file("scripts/run-stage4-bounded-controlled-model-structure-discrimination-design.mjs"),
  checker: file("scripts/check-stage4-bounded-controlled-model-structure-discrimination-design.mjs"),
  designLibrary: file("scripts/lib/ai-painter-stage4-bounded-controlled-model-structure-discrimination-design.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-bounded-controlled-model-structure-discrimination-design-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_readonly_bounded_controlled_model_structure_discrimination_design",
  allowedActions: ACTIONS,
  deniedActions: DENIALS,
  sourceEvidence: EVIDENCE,
  formalDerivationEvidence: { conditionFusionOnly: null, capacityOnly: null },
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/${runId}`,
  automaticRetryAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  modelModificationAuthorized: false,
  architectureImplementationAuthorized: false,
  freeParameterSelectionAuthorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))

