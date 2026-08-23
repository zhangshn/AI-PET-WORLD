import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const EVIDENCE = Object.freeze({
  ownerSelectedRouteTerminal: { path: ".runtime/ai-painter/stage4-capacity-route-exit-project-route-decisions/20260823-141357146/phase-terminal.json", sha256: "088a6015119059b75c88a28ae8b3411dfc6198ede5ca2612a9d23d890dca7eac" },
  capacityRouteExit: { path: ".runtime/ai-painter/stage4-capacity-route-exit-project-route-decisions/20260823-141357146/capacity-route-exit.json", sha256: "b3633968a92557a14f419dda0f600b096cbe53d13403bc0ec4aad8ca5db252b9" },
  projectProblemReport: { path: ".runtime/ai-painter/stage4-capacity-route-exit-project-route-decisions/20260823-141357146/project-level-problem-report.json", sha256: "f91b9a91aa347637acd0528998d01d532435926b5b427046b549214a2f1fac43" },
  projectOwnerRequest: { path: ".runtime/ai-painter/stage4-capacity-route-exit-project-route-decisions/20260823-141357146/owner-route-decision-request.json", sha256: "9a7370a638d418a27cfab7931dda75bdb6745ed350be97404c1ab01bb2feead9" },
  projectCpuReport: { path: ".runtime/ai-painter/stage4-capacity-route-exit-project-route-decisions/20260823-141357146/cpu-report.json", sha256: "7eabbc3bf3d74dba77ef0112d348549b873751e1e297ea6e7e9c3d5d3506839e" },
  businessSpec: { path: "docs/BUSINESS_SPEC.md", sha256: "12e96f54851ff2557f5ea64e03c1663c30232f3f32f059e0aefa5a3c710dd0db" },
  formalSpec: { path: "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", sha256: "8fde748d02d42d304e9725c28f9d492778e3cffed5c3db5f9993bb5aa6a8a58f" },
  worldContract: { path: "data/ai-painter/system-governance/complete-map-world-training-and-dynamic-readiness-contract-v2.json", sha256: "013f5a2f930bcc43d85f29d8166db4a06deaf337fa38fd5b87f5f3d46f11d0e4" },
  original64Terminal: { path: ".runtime/ai-painter/stage4-original-64-contract-correction-audits/20260822-122347271/phase-terminal.json", sha256: "347a66bc0dc379f8d2531cb4cc9f34fd131adf810e45ec98675039fc31861cc1" },
  autoencoderTerminal: { path: ".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/phase-terminal.json", sha256: "a943a7eca3f19e4c3e2f1c3aca32f8fa4a225aa0cf175b77bf8e390f2a43c449" },
  gradientTerminal: { path: ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/phase-terminal.json", sha256: "f4ec93aaf924a8e8bc21483c09a14fedfd52e05436ec7f0014d9334b6f843e4e" },
  baselineTerminal: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/finalization/phase-terminal.json", sha256: "7aec4fdcc865875c6715caa47094ac561f1ad2b5a2eaff594156c305a3f463cb" },
  crossArmTerminal: { path: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/phase-terminal.json", sha256: "010771f7555e29043aee5dda7b142c820ef7d2a1ff0d55ea2a4bdea928cd4391" },
  crossArmReport: { path: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/cross-arm-comparison-report.json", sha256: "9ce5de9674a55f40da17b2fe791d6d90482f51f732c7638e69c1a267f6d6a7e7" },
  conditionFusionTerminal: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/finalization/phase-terminal.json", sha256: "e3457170d3f2879ab89fb376518d4590c3f40ee7d27d8c3fa2e30171b2c7fef4" },
  capacityTerminal: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/finalization/phase-terminal.json", sha256: "b8c92f5244b632e42724b72ca0ddd7208257669c3cd6206f3bfc83569237fd78" },
  capacityBestReview: { path: ".runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/20260823-140119808/machine-review.json", sha256: "db0682431b4cf52c60206080b3e67339df173424c6f1ae0bbe2436886915e1ee" },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
for (const [name, evidence] of Object.entries(EVIDENCE)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.pt$/iu.test(evidence.path), false, `${name}_checkpoint_read_forbidden`) }
const requestId = `owner-authorized-stage4-generation-paradigm-review-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
const programs = { runner: file("scripts/run-stage4-generation-paradigm-review.mjs"), checker: file("scripts/check-stage4-generation-paradigm-review.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-generation-paradigm-review.mjs") }
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, { schemaVersion: "ai-painter-owner-stage4-generation-paradigm-review-v1", status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId, scope: "one_cpu_readonly_business_scope_and_complete_map_generation_paradigm_review_only", selectedOwnerRoute: "authorize_business_scope_or_generation_paradigm_review_only", allowedActions: ["verify_bound_business_architecture_and_route_evidence", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_authorization", "write_problem_audit_unique_decision_and_inactive_contract_or_owner_request", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"], deniedActions: ["generate_model_name", "implement_model", "add_loss", "choose_free_parameter", "change_data", "change_review_thresholds", "read_or_load_checkpoint_weights", "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "formal_inference", "runtime_frame", "enter_world"], sourceEvidence: EVIDENCE, programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), outputNamespace: `.runtime/ai-painter/stage4-generation-paradigm-reviews/${runId}`, oneTimeConsumption: true, checkpointWeightsReadAuthorized: false, gpuAuthorized: false, trainingAuthorized: false })
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))
