import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE = Object.freeze({
  priorImplementationFailureTerminal: { path: ".runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/20260823-135123928/phase-terminal.json", sha256: "f6d8db477bf95eef0311ced279a9e766093ffff8ee42109a94ce63f6cbef523b" },
  priorImplementationFailureReport: { path: ".runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/20260823-135123928/failure-report.json", sha256: "f47496f8eda6fa352a86b64e07ecf166bf8673679e65fb0abeffa74bebc9e05f" },
  priorConsumedAuthorization: { path: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-capacity-best-checkpoint-preview-review-20260823-135123928/consumption.json", sha256: "b7c1d9cb259d015c683f480a091ec28a08beec1e14145ea6e704d42fc50f50c3" },
  identityTerminal: { path: ".runtime/ai-painter/stage4-capacity-stage0-checkpoint-visual-identity-adjudications/20260823-134316278/phase-terminal.json", sha256: "0458f064465095ae0185d2a3cbaa8ec6109ca85d061e127330862a4869fa06ef" },
  identityDecision: { path: ".runtime/ai-painter/stage4-capacity-stage0-checkpoint-visual-identity-adjudications/20260823-134316278/adjudication.json", sha256: "a9ce2afb72a476784a84ae7177c2aa56662714962bf894e242d752133ea57303" },
  identityCpuReport: { path: ".runtime/ai-painter/stage4-capacity-stage0-checkpoint-visual-identity-adjudications/20260823-134316278/cpu-report.json", sha256: "50f6e705263b2ee45ab5f09532aa88ace5e444253555e07ac6d3d6965e7aef90" },
  ownerRequest: { path: ".runtime/ai-painter/stage4-capacity-stage0-checkpoint-visual-identity-adjudications/20260823-134316278/owner-action-request.json", sha256: "6aed47c9a204f59cc0c6ebce10d88180cd93fa4a47509d6008528614cd5576af" },
  manifest: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/manifest.json", sha256: "cfe010355d83f73cc3e92fff362f0c4979c1b2682f91fa89b026dbb548a138c9" },
  priorReview: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/fixed-preview-reviews.json", sha256: "1fbc6f2ae48938381f7d3803443f0bcef7c5d82a98f79a0fbf5e63fa50932003" },
  sourcePreview: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/checkpoint-bound-preview-source/epoch-037-v7-complete-map-194-seed-20266722.png", sha256: "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f" },
  reproducedPreview: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/training-output/checkpoint-bound-preview-reproduction/epoch-037-v7-complete-map-194-seed-20266722.png", sha256: "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f" },
  datasetManifest: { path: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json", sha256: "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa" },
  sourceIndex: { path: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json", sha256: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251" },
  referenceRgb: { path: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/images/complete-maps/ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6.png", sha256: "13caf53dce064afdd0bc1318f4c5b5bb9b3c63631679d84ccd3ed3ab992688be" },
  conditionPack: { path: ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-08-01T15-47-45-117Z/complete-map-condition-task/compiled-conditions/condition-pack.json", sha256: "2db536def8a3b7d3049b7cae673942edd77aa1151f432dc5774f2b3a33579ca9" },
})
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
for (const [name, evidence] of Object.entries(SOURCE)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`); assert.equal(/\.pt$/iu.test(evidence.path), false, `${name}_checkpoint_read_forbidden`) }
const requestId = `owner-authorized-stage4-capacity-best-checkpoint-preview-review-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
const programs = {
  runner: file("scripts/run-stage4-capacity-best-checkpoint-preview-review.mjs"), checker: file("scripts/check-stage4-capacity-best-checkpoint-preview-review.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-capacity-best-checkpoint-preview-review.mjs"),
  normalizer: file("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"), alignmentAuditor: file("scripts/lib/ai-assisted-condition-alignment.mjs"), aestheticAuditor: file("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-capacity-best-checkpoint-preview-review-v1", status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId,
  scope: "one_cpu_machine_review_of_existing_immutable_epoch37_checkpoint_bound_preview_only",
  allowedActions: ["verify_bound_epoch37_preview_identity", "execute_cpu_positive_negative_regression", "atomically_consume_one_cpu_review_authorization", "create_windows_safe_normalized_review_copy", "execute_existing_aesthetic_and_condition_alignment_audits", "record_review_and_bounded_next_request", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"],
  deniedActions: ["read_or_load_checkpoint_weights", "regenerate_source_preview", "overwrite_source_preview", "start_gpu", "create_optimizer", "execute_backward", "modify_model_weights", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "change_model", "change_loss", "change_data", "change_review_thresholds", "automatic_retry"],
  sourceEvidence: SOURCE, programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), outputNamespace: `.runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/${runId}`,
  oneTimeConsumption: true, checkpointWeightsReadAuthorized: false, gpuAuthorized: false, trainingAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))
