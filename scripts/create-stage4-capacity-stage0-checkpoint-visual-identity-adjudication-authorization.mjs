import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE = Object.freeze({
  terminal: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/finalization/phase-terminal.json", sha256: "b8c92f5244b632e42724b72ca0ddd7208257669c3cd6206f3bfc83569237fd78" },
  manifest: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/manifest.json", sha256: "cfe010355d83f73cc3e92fff362f0c4979c1b2682f91fa89b026dbb548a138c9" },
  review: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/fixed-preview-reviews.json", sha256: "1fbc6f2ae48938381f7d3803443f0bcef7c5d82a98f79a0fbf5e63fa50932003" },
  telemetry: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/stage4-step-telemetry.json", sha256: "8126632ebcf096f6a67a2ac81fec39ffab7e6b1f80aa91deaddb5f417a9ab4de" },
  activeConfig: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/active-config.json", sha256: "217254fcf69dcd24fadb3e7bdf2694a52a2439749b9beecdcc41d940aac78354" },
  checkpointPreview: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/checkpoint-bound-preview-source/epoch-037-v7-complete-map-194-seed-20266722.png", sha256: "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f" },
})
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
for (const [name, evidence] of Object.entries(SOURCE)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`) }
const requestId = `owner-authorized-stage4-capacity-stage0-checkpoint-visual-identity-adjudication-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
const programs = {
  runner: file("scripts/run-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"),
  checker: file("scripts/check-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-capacity-stage0-checkpoint-visual-identity-adjudication.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-capacity-stage0-checkpoint-visual-identity-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId,
  scope: "one_cpu_readonly_capacity_stage0_checkpoint_fixed_review_terminal_visual_identity_adjudication",
  allowedActions: ["verify_bound_capacity_stage0_evidence", "execute_cpu_positive_negative_regression", "atomically_consume_one_cpu_readonly_authorization", "record_unique_adjudication_and_one_bounded_owner_action_request", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"],
  deniedActions: ["read_or_load_checkpoint_weights", "start_gpu", "create_optimizer", "execute_backward", "modify_model_weights", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "change_model", "change_loss", "change_data", "change_review_thresholds", "regenerate_preview", "reuse_historical_evidence"],
  sourceEvidence: SOURCE, failedCheckpointSha256: "ae306a0fb364f1015b6cccecd907626160f3de9aef119031f9240508e9bd20bf",
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-capacity-stage0-checkpoint-visual-identity-adjudications/${runId}`,
  oneTimeConsumption: true, checkpointWeightsReadAuthorized: false, gpuAuthorized: false, trainingAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))
