import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze(["audit_64_approved_records_and_three_class_legal_supervision", "audit_existing_training_objective_coverage_and_unique_gap", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_design_review_authorization", "write_one_bounded_inactive_training_objective_contract_or_owner_request", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"])
const DENIALS = Object.freeze(["read_or_load_checkpoint_weights", "modify_model", "modify_loss", "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_threshold_or_result_as_training_target", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"])
const SOURCE = ".runtime/ai-painter/stage4-epoch-complete-stage0-reference-semantic-causal-adjudications/20260822-070146913"
const EVIDENCE = Object.freeze({
  priorLocatorFailureTerminal: { path: ".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071014293/phase-terminal.json", sha256: "8bb6ab53f9c42f9260167b167546c5f2b16511bbbaf0524781c44bf3e75d40f5" },
  priorLocatorFailureReport: { path: ".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071014293/failure-report.json", sha256: "a7a682d59b17bd8e14c2cfc315a8652d7b3455496380e1e32449c9f6273c4c50" },
  priorLocatorFailurePlanSync: { path: ".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071014293/plan-sync-record.json", sha256: "c5cc7f9682d183a55597a95eca49c47bb402298e77bf713aa1b878e3b3271d71" },
  priorTerminal: { path: `${SOURCE}/phase-terminal.json`, sha256: "9ac3aa155a9124d5de1b52c36f4e69838fbf33e430df433ad72378b5be3719cc" },
  priorAnalysis: { path: `${SOURCE}/causal-analysis-report.json`, sha256: "346982685bb4d31a46cf99362a0565dc344db5c474de767c92b8fdc79c352456" },
  priorDecision: { path: `${SOURCE}/adjudication.json`, sha256: "aede9ec0dac84135d5b565626730168c4033b49b61f3257eba536d6d78df5d41" },
  priorInactiveContract: { path: `${SOURCE}/inactive-repair-contract.json`, sha256: "d1ebbb66bd301c852562e24e7cc2500ae67a0e6c07506f2d18cf5ce56fedf397" },
  priorCpuReport: { path: `${SOURCE}/cpu-report.json`, sha256: "cf7c52068cd52967a460a18eabde45bd724b0a914176547ff31771dd0ccb1499" },
  datasetManifest: { path: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json", sha256: "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa" },
  sourceIndex: { path: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json", sha256: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251" },
  formalConfig: { path: "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json", sha256: "b501b1b882961a193f581cc5885ea58ab8fa5df700343be2307e9a6b14ceebeb" },
  inspectedTrainer: { path: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py", sha256: "0e2ce5f4c4c9f063349f9f40c1aa6f55b588570bad579a24179fca6f26a2079c" },
  activeStage0Config: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-044700000/active-config.json", sha256: "b2d6c2f2e1571198ad05beeceba3f44dc8963f011fd133474b2eaaacd480fcfa" },
  stage0Manifest: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-044700000/training-output/manifest.json", sha256: "0152b1a8cd58e181fdfd5697ec8cebc71510c9a066412831ca1d68122abd0dfe" },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false, "absolute_path_rejected"); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_path_required"); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-three-class-supervision-identifiability-review-${runId}`
const directory = projectFile(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EVIDENCE)) { const target = projectFile(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`) }
const programs = { runner: projectFile("scripts/run-stage4-three-class-supervision-identifiability-review.mjs"), checker: projectFile("scripts/check-stage4-three-class-supervision-identifiability-review.mjs"), decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-three-class-supervision-identifiability-review.mjs") }
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, { schemaVersion: "owner-authorized-stage4-three-class-supervision-identifiability-review-v1", status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId, scope: "one_cpu_readonly_three_class_final_visible_reference_semantic_supervision_identifiability_review", allowedActions: ACTIONS, deniedActions: DENIALS, sourceEvidence: EVIDENCE, programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), outputNamespace: `.runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/${runId}`, checkpointWeightsReadAuthorized: false, gpuAuthorized: false, trainingAuthorized: false, oneTimeConsumption: true })
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))
