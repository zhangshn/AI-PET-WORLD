import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "fresh_run_id_required")
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const sources = {
  cpuTerminal: absolute(".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/phase-terminal.json"),
  cpuReport: absolute(".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/cpu-report.json"),
  configurationAudit: absolute(".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/configuration-audit.json"),
  inactiveConfig: absolute(".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/inactive-config.json"),
  supportContract: absolute(".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/training-paradigm-support-contract.json"),
  modelConfig: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/active-config.json"),
  sourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  modelSource: absolute("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  datasetSource: absolute("ml/ai-painter/src/ai_painter/complete_world/dataset.py"),
}
const expected = {
  cpuTerminal: "8f1f2e153d84542e37c835a2e4d3735068a24d2d3c5886eda800d1d61d09eb97",
  cpuReport: "4df14fc804eb12a413a3582ee4c89e2601a0d1ca8a846d4775a47c1f1d191c5d",
  configurationAudit: "f0e537c97672f1370e6be8c4f11ffbac7a169642ffd21f74721250bda65de66e",
  inactiveConfig: "f9c7dbc10f31f728034e30722ca13e85d9b6d13e8377fe38a0d661582322c644",
  supportContract: "69248e28e3d906bbac671503cfe4a65abce59d4386c9b7ed5cb040d59b9aac67",
  modelConfig: "22a8455d0ad2115d2157c9c90f2c71a5f64ced8bd1a967d502484bae7fe60d75",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
}
for (const [name, value] of Object.entries(sources)) {
  assert.equal(fs.existsSync(value), true, `${name}_missing`)
  if (expected[name]) assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`)
}
const programs = {
  runner: absolute("scripts/run-stage4-conflict-aware-gradient-aggregation-gpu-qualification.mjs"),
  checker: absolute("ml/ai-painter/scripts/check_stage4_conflict_aware_existing_gradient_aggregation_gpu_entry_cpu.py"),
  gpuRunner: absolute("ml/ai-painter/scripts/run_stage4_conflict_aware_existing_gradient_aggregation_gpu_qualification.py"),
  trainer: absolute("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
}
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true, `program_missing:${relative(value)}`)
const requestId = `owner-authorized-stage4-conflict-aware-gradient-aggregation-readonly-gpu-${runId}`
const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`)
const consumptionPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/gpu-consumption.json`)
const outputDirectory = `.runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-gpu-qualifications/${runId}`
assert.equal(fs.existsSync(authorizationPath), false)
assert.equal(fs.existsSync(consumptionPath), false)
assert.equal(fs.existsSync(absolute(outputDirectory)), false)
const checkpointPath = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
assert.equal(fs.existsSync(absolute(checkpointPath)), true)
const authorization = {
  schemaVersion: "owner-authorized-stage4-conflict-aware-existing-gradient-aggregation-readonly-gpu-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_readonly_gpu_stage4_conflict_aware_existing_gradient_aggregation_qualification",
  allowedActions: [
    "verify_bound_cpu_evidence",
    "execute_cpu_positive_negative_authorization_gate",
    "execute_python_cuda_disk_preflight",
    "atomically_consume_one_readonly_gpu_authorization",
    "read_and_freeze_project_autoencoder_checkpoint",
    "initialize_fixed_random_denoiser",
    "read_all_48_train_and_8_validation_records",
    "execute_cuda_forward_and_torch_autograd_grad",
    "verify_strict_negative_projection_and_nonnegative_identity",
    "write_gpu_qualification_and_governance_evidence",
  ],
  deniedActions: [
    "read_old_or_failed_denoiser_checkpoint",
    "create_optimizer",
    "execute_backward",
    "modify_weights",
    "write_checkpoint",
    "start_smoke",
    "start_stage0_stage1_stage2_or_other_training",
    "select_free_tolerance_or_parameter",
    "change_loss_data_checkpoint_or_review_thresholds",
  ],
  bindings: {
    ...Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, bind(value)])),
    projectAutoencoderCheckpoint: { path: checkpointPath, sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" },
  },
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])),
  taskIdentity: {
    contractId: "stage4_conflict_aware_existing_gradient_aggregation_v1",
    population: { train: 48, validation: 8 },
    conditionChannelCount: 23,
    classIdentityOrder: ["footprints", "tree", "rock", "vegetation"],
    seed: 20263722,
    imageSize: { width: 256, height: 192 },
    rolloutSteps: 50,
    gradientTailSteps: 5,
    topology: "west",
    gradientParameterBoundary: "current_denoiser_shared_final_output_path",
  },
  execution: { outputDirectory, consumptionPath: relative(consumptionPath) },
  oneTimeConsumption: true,
  gpuAuthorized: true,
  checkpointWeightsReadAuthorized: true,
  denoiserCheckpointReadAuthorized: false,
  optimizerAuthorized: false,
  backwardAuthorized: false,
  trainingAuthorized: false,
}
writeJsonAtomic(authorizationPath, authorization)
console.log(JSON.stringify({ status: "authorization_materialized", authorization: bind(authorizationPath), consumptionPath: relative(consumptionPath), outputDirectory }, null, 2))
