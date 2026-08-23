import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd(); const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }; const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "fresh_run_id_required")
const absolute = (value) => path.resolve(ROOT, value); const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex"); const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const sources = {
  autoencoderAuditTerminal: absolute(".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/phase-terminal.json"),
  autoencoderGpuReport: absolute(".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/gpu-report.json"),
  autoencoderAnalysis: absolute(".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/autoencoder-semantic-retention-analysis.json"),
  autoencoderDecision: absolute(".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/adjudication.json"),
  ownerActionRequest: absolute(".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/owner-action-request-or-boundary-contract.json"),
  sourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  activeConfig: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/active-config.json"),
  modelSource: absolute("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  trainerSource: absolute("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  datasetSource: absolute("ml/ai-painter/src/ai_painter/complete_world/dataset.py"),
}
const expected = { autoencoderAuditTerminal: "a943a7eca3f19e4c3e2f1c3aca32f8fa4a225aa0cf175b77bf8e390f2a43c449", autoencoderGpuReport: "18af6c3fbdfb6117280c4a0705fe1af0e8731bc2d3cf4af49c2bd34fa5d6ce23", autoencoderAnalysis: "eea5771c0613474a17d42a17cfd62fb8c34c287285c867034bbb31a3835a67dd", autoencoderDecision: "2fa6bcad4f7a219e768faac8b5019966c97a8cf34ba89521803ada77aa6b3d6a", ownerActionRequest: "c80298181bb0646a5ce81f939059a727b129b2a8f053e1ce24c647562647fc98", sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251", activeConfig: "22a8455d0ad2115d2157c9c90f2c71a5f64ced8bd1a967d502484bae7fe60d75" }
for (const [name, value] of Object.entries(sources)) { assert.equal(fs.existsSync(value), true, `${name}_missing`); if (expected[name]) assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`) }
const programs = { runner: absolute("scripts/run-stage4-multisample-capacity-gradient-interference.mjs"), checker: absolute("scripts/check-stage4-multisample-capacity-gradient-interference.mjs"), decisionLibrary: absolute("scripts/lib/ai-painter-stage4-multisample-capacity-gradient-interference.mjs"), gpuRunner: absolute("ml/ai-painter/scripts/run_stage4_multisample_capacity_gradient_interference_readonly_diagnostic.py") }
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true, `program_missing:${relative(value)}`)
const requestId = `owner-authorized-stage4-current-model-multisample-capacity-gradient-interference-${runId}`
const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`); const consumptionPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/gpu-consumption.json`); const outputNamespace = `.runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/${runId}`
assert.equal(fs.existsSync(authorizationPath), false); assert.equal(fs.existsSync(consumptionPath), false); assert.equal(fs.existsSync(absolute(outputNamespace)), false)
const checkpointPath = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"; assert.equal(fs.existsSync(absolute(checkpointPath)), true)
const authorization = {
  schemaVersion: "owner-authorized-stage4-current-model-multisample-capacity-gradient-interference-readonly-diagnostic-v1", status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId,
  scope: "one_readonly_gpu_current_model_multisample_capacity_and_gradient_interference_diagnostic",
  allowedActions: ["verify_bound_evidence", "execute_cpu_positive_negative_contract_regression", "execute_python_cuda_disk_preflight", "atomically_consume_one_readonly_gpu_authorization", "read_and_freeze_project_autoencoder_checkpoint", "initialize_fixed_random_denoiser", "read_all_48_train_and_8_validation_records", "execute_cuda_forward_and_torch_autograd_grad", "write_gradient_capacity_decision_and_governance_evidence"],
  deniedActions: ["read_old_or_failed_denoiser_checkpoint", "create_optimizer", "execute_backward", "modify_weights", "write_checkpoint", "start_smoke", "start_training", "select_free_tolerance_or_parameter", "lower_review_thresholds", "use_failed_preview_or_review_as_training_target"],
  bindings: { ...Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, bind(value)])), projectAutoencoderCheckpoint: { path: checkpointPath, sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" } },
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])),
  taskIdentity: { population: { train: 48, validation: 8 }, conditionChannelCount: 23, classIdentityOrder: ["footprints", "tree", "rock", "vegetation"], seed: 20263722, imageSize: { width: 256, height: 192 }, rolloutSteps: 50, gradientTailSteps: 5, topology: "west", gradientParameterBoundary: "current_denoiser_shared_final_output_path", capacityCollisionBoundary: "exact_condition_representation_or_final_rgb_identity_collision_only" },
  execution: { outputDirectory: outputNamespace, consumptionPath: relative(consumptionPath) }, oneTimeConsumption: true, gpuAuthorized: true, checkpointWeightsReadAuthorized: true, denoiserCheckpointReadAuthorized: false, optimizerAuthorized: false, backwardAuthorized: false, trainingAuthorized: false,
}
writeJsonAtomic(authorizationPath, authorization); console.log(JSON.stringify({ status: "authorization_materialized", authorization: bind(authorizationPath), consumptionPath: relative(consumptionPath), outputNamespace }, null, 2))
