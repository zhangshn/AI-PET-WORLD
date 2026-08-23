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
  correctionTerminal: absolute(".runtime/ai-painter/stage4-original-64-contract-correction-audits/20260822-122347271/phase-terminal.json"),
  correctionReport: absolute(".runtime/ai-painter/stage4-original-64-contract-correction-audits/20260822-122347271/correction-report.json"),
  originalCapacityAudit: absolute(".runtime/ai-painter/stage4-original-64-contract-correction-audits/20260822-122347271/original-64-capacity-contract-audit.json"),
  original64Audit: absolute(".runtime/ai-painter/stage4-original-64-contract-correction-audits/20260822-122347271/original-64-realization-audit.json"),
  sufficiencyAudit: absolute(".runtime/ai-painter/stage4-original-64-contract-correction-audits/20260822-122347271/original-64-stage4-sufficiency-scope-audit.json"),
  correctionDecision: absolute(".runtime/ai-painter/stage4-original-64-contract-correction-audits/20260822-122347271/adjudication.json"),
  v8Terminal: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-v8-attribution/20260809-154712137/phase-terminal.json"),
  v8Analysis: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-v8-attribution/20260809-154712137/analysis-report.json"),
  v9Terminal: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-v9-route-decision/20260810-205917747/phase-terminal.json"),
  v9Analysis: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-v9-route-decision/20260810-205917747/failure-attribution-report.json"),
  structureTerminal: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-structure-fact-first-route-decision/20260811-193711359/phase-terminal.json"),
  structureAnalysis: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-structure-fact-first-route-decision/20260811-193711359/failure-analysis.json"),
  rendererTerminal: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-semantic-renderer-route-decision/20260811-235628101/phase-terminal.json"),
  rendererAnalysis: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-semantic-renderer-route-decision/20260811-235628101/failure-analysis.json"),
  mixtureTerminal: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-semantic-mixture-route-decision/20260812-134817429/phase-terminal.json"),
  mixtureAnalysis: absolute(".runtime/ai-painter/local-ai-failure-learning-r5-stage4-semantic-mixture-route-decision/20260812-134817429/failure-analysis.json"),
  smokeQualificationTerminal: absolute(".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/phase-terminal.json"),
  smokeQualificationReport: absolute(".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260822-093621387/timeline-qualification-report.json"),
  stage0Terminal: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/finalization/phase-terminal.json"),
  stage0Manifest: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/training-output/manifest.json"),
  stage0Review: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/training-output/fixed-preview-reviews.json"),
  stage0Telemetry: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/training-output/stage4-step-telemetry.json"),
  activeConfig: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/active-config.json"),
  currentCausalTerminal: absolute(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/phase-terminal.json"),
  currentCausalReport: absolute(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/causal-analysis-report.json"),
  currentCausalDecision: absolute(".runtime/ai-painter/stage4-current-stage0-four-object-causal-adjudications/20260822-115724307/adjudication.json"),
  modelSource: absolute("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  trainerSource: absolute("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
}
const expected = {
  correctionTerminal: "347a66bc0dc379f8d2531cb4cc9f34fd131adf810e45ec98675039fc31861cc1",
  correctionReport: "aad693a5bd75559ca36471bc78e67bf15cedacf9cf3fb4692ed7ab71d31bdcf1",
  originalCapacityAudit: "176e7854f80103870ea0f055a2fa0a43cd1b259a67f60453bca84c61c010b384",
  original64Audit: "6545cb6db1d459493e306513fbd703dfd7c921f6ad475bd0e03616e42dacd8e3",
  sufficiencyAudit: "9cab3e977bc67f855f3852214f05704f4221d8c32d48aa076cf4dc8ecdf7d70d",
  correctionDecision: "cfb4359e11eb51a1905cc4158592688526e373e92fea1ebfa4107e2ba81b0dbb",
  v8Terminal: "25adba11edf9ae3c89e34cd2f421256bcdbd404b8e18ffb4b789515943542679",
  v8Analysis: "d84f8d03c9e14b9df0211c0d5be57106121ea76be103e37cf035c1cc20cb1041",
  v9Terminal: "a8a879295200e42f83be5d82fe7a7d670829cd4b7189381ecdc527310f25523d",
  v9Analysis: "be2cb3a971be46586dcf3972fa492a2ae7330279183dd0e34907785f6ed60440",
  structureTerminal: "30adadb0b9fcef58939ca177cbf850e171e17b3fba9f11285fdb3d6966317b2b",
  structureAnalysis: "ec7931e5f88dc74bdddbad3052af1a15cf1da651c42eece14c884e2f90a55cac",
  rendererTerminal: "84c699be8da896cfdb481ec7f169148fa5aba9a26b72202f2b13af0f3f3d930d",
  rendererAnalysis: "44578d43ece71ec11641a454a5313b768dbe052f063be1d1e98c6054d293e33c",
  mixtureTerminal: "f33a601e2a6688496d1337cbacd8ad161985d40c3e1d241e67be3e14acae4352",
  mixtureAnalysis: "05f48d6a8952f3d533bf3342c3793bcc7042523eb77619e1e6c63d6ffb6acbeb",
  smokeQualificationTerminal: "1cbc3f470448de2cce0dcee55a023a6c0289ac20a22fa389bbfea9acc335fead",
  smokeQualificationReport: "26293e6c78673180c106840efc4c139478d451b4fe54be081825eead5cfe8e63",
  stage0Terminal: "f41ddd3fde6beaedfa9cecc0b9f54e24b31dfd2942b8e1ef0f4417a9dced59dd",
  stage0Manifest: "b1a99d22c21a3f8090195854074e42fa429a8571cb6f0459acab5fad3ac7121c",
  stage0Review: "4f2129821642527defe9d5ab65a44034204963d2952d988277c27801959e4187",
  stage0Telemetry: "2ad1f63faf4bafb53d6e8ab79d0d080fe46a46fd8768bf3fdf425911ac163ce8",
  activeConfig: "22a8455d0ad2115d2157c9c90f2c71a5f64ced8bd1a967d502484bae7fe60d75",
  currentCausalTerminal: "3d0f90b09861b2e3c8768ce197ca07a5407d1891853a368174d8b14c1c5a1b4b",
  currentCausalReport: "b4a3da36d9bc0b7cef60e4f7612b900fbf5166da1f43f08cda38507e07b3cdfd",
  currentCausalDecision: "e1038dfa0c467a9aac118bda04c820b4fde0e86e4f19eeb7c7c5e5ec52ac9500",
  modelSource: "8b97ddb2b8ad044c526aa969e963589288d4439ac1a06198ee1024138d631dd3",
  trainerSource: "0cf1c393c306e13573b7c5a92fbde8e9317eebc7e6a53d2f365557622c958288",
}
for (const [name, value] of Object.entries(sources)) {
  assert.equal(fs.existsSync(value), true, `${name}_missing`)
  assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`)
}

const programs = {
  runner: absolute("scripts/run-stage4-model-training-paradigm-root-convergence.mjs"),
  checker: absolute("scripts/check-stage4-model-training-paradigm-root-convergence.mjs"),
  decisionLibrary: absolute("scripts/lib/ai-painter-stage4-model-training-paradigm-root-convergence.mjs"),
}
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true, `program_missing:${relative(value)}`)
const requestId = `owner-authorized-stage4-model-training-paradigm-root-convergence-${runId}`
const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`)
const outputNamespace = `.runtime/ai-painter/stage4-model-training-paradigm-root-convergences/${runId}`
assert.equal(fs.existsSync(authorizationPath), false, "authorization_already_exists")
assert.equal(fs.existsSync(absolute(outputNamespace)), false, "output_namespace_already_exists")

const authorization = {
  schemaVersion: "owner-authorized-stage4-model-training-paradigm-root-convergence-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_readonly_stage4_model_architecture_and_training_paradigm_root_convergence",
  ownerSelection: "retain_original_64_and_authorize_new_model_or_training_paradigm_design",
  allowedActions: ["verify_bound_evidence", "compare_exited_stage4_candidates", "audit_condition_to_final_rgb_model_capacity_autoencoder_and_rollout_chain", "compare_single_sample_smoke_to_multisample_stage0", "audit_resource_and_resolution_evidence", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_authorization", "write_analysis_decision_contract_or_owner_request_and_terminal", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"],
  deniedActions: ["modify_data", "add_same_kind_loss", "select_free_hyperparameters", "read_or_load_checkpoint_weights", "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "modify_review_thresholds"],
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
