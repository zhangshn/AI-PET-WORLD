import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = process.argv[process.argv.indexOf("--run-id") + 1]
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "fresh_run_id_required")

const projectPath = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: projectPath(value), sha256: sha(value) })
const target = (...parts) => path.resolve(ROOT, ...parts)

const requestId = `owner-authorized-stage4-project-level-data-supervision-resource-redesign-${runId}`
const outputNamespace = `.runtime/ai-painter/stage4-project-level-data-supervision-resource-redesigns/${runId}`
const authorizationPath = target(".runtime", "ai-painter", "owner-action-requests", requestId, "authorization.json")
assert.equal(fs.existsSync(authorizationPath), false, "authorization_already_exists")
assert.equal(fs.existsSync(target(outputNamespace)), false, "output_namespace_already_exists")

const sources = {
  sourceTerminal: target(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/phase-terminal.json"),
  causalAnalysis: target(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/causal-analysis-report.json"),
  sourceDecision: target(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/adjudication.json"),
  routeExitProposal: target(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/route-exit-proposal.json"),
  ownerDecisionRequest: target(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/owner-decision-request.json"),
  sourceIndex: target("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
}
for (const value of Object.values(sources)) assert.equal(fs.existsSync(value), true, `source_missing:${projectPath(value)}`)

const expected = {
  sourceTerminal: "3d0f90b09861b2e3c8768ce197ca07a5407d1891853a368174d8b14c1c5a1b4b",
  causalAnalysis: "b4a3da36d9bc0b7cef60e4f7612b900fbf5166da1f43f08cda38507e07b3cdfd",
  sourceDecision: "e1038dfa0c467a9aac118bda04c820b4fde0e86e4f19eeb7c7c5e5ec52ac9500",
  routeExitProposal: "b4c8aa3d090afa674f24c3202b539e772a7729424e578f4e29f081bf3d069cda",
  ownerDecisionRequest: "927d5b3abc4ddbbc4f30a6990251acdeee90d471ef3c2e5e8b7a25ebb51feb42",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
}
for (const [name, value] of Object.entries(sources)) assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`)

const programs = {
  runner: target("scripts/run-stage4-project-level-data-supervision-resource-redesign.mjs"),
  checker: target("scripts/check-stage4-project-level-data-supervision-resource-redesign.mjs"),
  decisionLibrary: target("scripts/lib/ai-painter-stage4-project-level-data-supervision-resource-redesign.mjs"),
}
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true, `program_missing:${projectPath(value)}`)

const authorization = {
  schemaVersion: "owner-authorized-stage4-project-level-data-supervision-resource-redesign-v1",
  status: "resolved_owner_authorized_not_consumed",
  ownerSelection: "authorize_project_level_data_supervision_resource_redesign",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_readonly_stage4_project_level_data_supervision_resource_redesign",
  allowedActions: [
    "verify_bound_route_exit_and_owner_selection",
    "audit_64_approved_data_supervision_and_resource_evidence",
    "execute_cpu_positive_negative_contract_regression",
    "atomically_consume_one_cpu_readonly_project_level_redesign_authorization",
    "write_one_of_four_project_level_decisions_and_bounded_contract_or_owner_request",
    "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
  ],
  deniedActions: [
    "read_or_load_checkpoint_weights", "modify_model", "modify_loss", "add_same_kind_loss", "generate_model_name",
    "select_free_hyperparameters", "start_gpu", "start_training", "start_smoke", "rerun_stage0", "start_stage0",
    "start_stage1", "start_stage2", "lower_review_thresholds", "use_failed_preview_as_training_target",
    "use_machine_review_threshold_or_result_as_training_target", "reuse_failed_checkpoint", "formal_inference",
    "checkpoint_promotion", "runtime_frame", "world_entry",
  ],
  sourceEvidence: Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, bind(value)])),
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])),
  outputNamespace,
  oneTimeConsumption: true,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  automaticRetryAuthorized: false,
}
writeJsonAtomic(authorizationPath, authorization)
console.log(JSON.stringify({ status: "authorization_materialized", authorization: bind(authorizationPath), outputNamespace }, null, 2))
