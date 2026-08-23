import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = process.argv[process.argv.indexOf("--run-id") + 1]
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "fresh_run_id_required")
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const sources = {
  priorTerminal: absolute(".runtime/ai-painter/stage4-project-level-data-supervision-resource-redesigns/20260822-121132301/phase-terminal.json"),
  priorAudit: absolute(".runtime/ai-painter/stage4-project-level-data-supervision-resource-redesigns/20260822-121132301/data-supervision-resource-audit.json"),
  priorDecision: absolute(".runtime/ai-painter/stage4-project-level-data-supervision-resource-redesigns/20260822-121132301/adjudication.json"),
  originalCapacityPlan: absolute(".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/ai-assisted-v7-data-capacity-plan-2026-07-31T12-04-47-874Z/capacity-plan.json"),
  originalCapacityGapAndSlotPlan: absolute(".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/ai-assisted-v7-data-capacity-plan-2026-07-31T12-04-47-874Z/capacity-gap-list.json"),
  originalWindowPlan: absolute(".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/earth-geospatial-v7-mvp-window-plan-rebuild64-2026-07-31T12-04-47-874Z/window-plan.json"),
  finalSourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
}
const expected = {
  priorTerminal: "0ab38bd002c98738d9a22c25da89406296a45bfa42425ce79fc762562b5ff922",
  priorAudit: "6a00b86b86babe0f78903e8f7e55dbc38891360152d65441b4683abdf43a3fb9",
  priorDecision: "ac219d91c97f05e884b542618584b5632b838222614d05eb90b119b0ce4c2fc4",
  originalCapacityPlan: "f61a20417b62e6d79345696414df9a97260b0835e0d4a171cbc28b531454137f",
  originalCapacityGapAndSlotPlan: "459a365e82d95966c60f709bf2e8976348b696492de233b36456a4a3f1d1311d",
  originalWindowPlan: "b2959106dfa944d6faac6225245586a69d785da04b619899ba3ed5e9907526ae",
  finalSourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
}
for (const [name, value] of Object.entries(sources)) {
  assert.equal(fs.existsSync(value), true, `${name}_missing`)
  assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`)
}

const programs = {
  runner: absolute("scripts/run-stage4-original-64-contract-correction-audit.mjs"),
  checker: absolute("scripts/check-stage4-original-64-contract-correction-audit.mjs"),
  decisionLibrary: absolute("scripts/lib/ai-painter-stage4-original-64-contract-correction-audit.mjs"),
}
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true, `program_missing:${relative(value)}`)
const requestId = `owner-authorized-stage4-original-64-contract-correction-audit-${runId}`
const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`)
const outputNamespace = `.runtime/ai-painter/stage4-original-64-contract-correction-audits/${runId}`
assert.equal(fs.existsSync(authorizationPath), false, "authorization_already_exists")
assert.equal(fs.existsSync(absolute(outputNamespace)), false, "output_namespace_already_exists")

const authorization = {
  schemaVersion: "owner-authorized-stage4-original-64-contract-correction-audit-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_readonly_original_64_contract_sufficiency_and_prior_decision_correction_audit",
  allowedActions: [
    "verify_bound_prior_and_original_capacity_evidence",
    "compare_all_64_planned_slots_to_final_records",
    "audit_original_contract_stage4_sufficiency_scope",
    "execute_cpu_positive_negative_contract_regression",
    "atomically_consume_one_cpu_readonly_correction_authorization",
    "write_correction_audit_decision_owner_request_and_terminal",
    "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
  ],
  deniedActions: ["modify_or_add_data", "modify_model", "modify_loss", "modify_review_thresholds", "read_or_load_checkpoint_weights", "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "reuse_failed_checkpoint", "use_failed_preview_as_training_target", "use_review_result_as_training_target"],
  sourceEvidence: Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, bind(value)])),
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])),
  outputNamespace,
  oneTimeConsumption: true,
  dataModificationAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
}
writeJsonAtomic(authorizationPath, authorization)
console.log(JSON.stringify({ status: "authorization_materialized", authorization: bind(authorizationPath), outputNamespace }, null, 2))
