import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const EVIDENCE = Object.freeze({
  reviewTerminal: { path: ".runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/20260823-140119808/phase-terminal.json", sha256: "f6b76bdaa3c10d78b22f452be36d49cb9b845c41854cf4cca809dd9518d8e66b" },
  machineReview: { path: ".runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/20260823-140119808/machine-review.json", sha256: "db0682431b4cf52c60206080b3e67339df173424c6f1ae0bbe2436886915e1ee" },
  cpuReport: { path: ".runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/20260823-140119808/cpu-report.json", sha256: "935e73afd33f38edb8ab9b91acbf9f7378729c70def2301dabc3ae7b971ec478" },
  ownerRequest: { path: ".runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/20260823-140119808/owner-action-request.json", sha256: "5d58e5c157e821662fe728a1074e96744e33ba5aee6716e4e5e48fb9957118e6" },
  stage0Terminal: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/finalization/phase-terminal.json", sha256: "b8c92f5244b632e42724b72ca0ddd7208257669c3cd6206f3bfc83569237fd78" },
  stage0Manifest: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/manifest.json", sha256: "cfe010355d83f73cc3e92fff362f0c4979c1b2682f91fa89b026dbb548a138c9" },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
for (const [name, evidence] of Object.entries(EVIDENCE)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.pt$/iu.test(evidence.path), false) }
const requestId = `owner-authorized-stage4-capacity-route-exit-project-route-decision-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
const programs = { runner: file("scripts/run-stage4-capacity-route-exit-project-route-decision.mjs"), checker: file("scripts/check-stage4-capacity-route-exit-project-route-decision.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-capacity-route-exit-project-route-decision.mjs") }
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, { schemaVersion: "ai-painter-owner-stage4-capacity-route-exit-project-route-decision-v1", status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId, scope: "one_cpu_readonly_capacity_route_exit_and_project_level_owner_route_decision_request_only", allowedActions: ["verify_bound_capacity_stage0_and_epoch37_review", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_authorization", "record_capacity_route_exit", "write_exact_four_option_owner_route_decision_request", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"], deniedActions: ["read_or_load_checkpoint_weights", "start_gpu", "create_optimizer", "execute_backward", "modify_model_weights", "implement_model", "add_loss", "change_data", "change_review_thresholds", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "automatic_expansion", "automatic_retry"], sourceEvidence: EVIDENCE, programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), outputNamespace: `.runtime/ai-painter/stage4-capacity-route-exit-project-route-decisions/${runId}`, oneTimeConsumption: true, checkpointWeightsReadAuthorized: false, gpuAuthorized: false, trainingAuthorized: false })
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))
