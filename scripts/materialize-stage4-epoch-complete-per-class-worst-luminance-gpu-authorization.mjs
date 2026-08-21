import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const index = process.argv.indexOf("--run-id")
const runId = index >= 0 ? process.argv[index + 1] : null
assert.match(runId ?? "", /^\d{8}-\d{9}$/)
const requestId = `owner-authorized-stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-${runId}`
const root = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", requestId)
const authorizationPath = path.join(root, "gpu-authorization.json")
const outputNamespace = `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-qualifications/${runId}`
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const bind = (relative, expected = null) => {
  const file = path.resolve(ROOT, relative)
  assert.equal(fs.existsSync(file), true, `binding_missing:${relative}`)
  const actual = sha(file)
  if (expected) assert.equal(actual, expected, `binding_sha_mismatch:${relative}`)
  return { path: relative.replaceAll("\\", "/"), sha256: actual }
}
assert.equal(fs.existsSync(root), false, "authorization_namespace_exists")
assert.equal(fs.existsSync(path.resolve(ROOT, outputNamespace)), false, "output_namespace_exists")
const bindings = {
  cpuTerminal: bind(
    ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/phase-terminal.json",
    "8f6eb4e98e2fa14464c7f0bd4518d3bb67179a16d953b70ce0216dcf020e869d",
  ),
  cpuReport: bind(
    ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/cpu-report.json",
    "2f3ab0987bfdc91cc52b4764620b5489618df0579c36f7717833f676dde95e1f",
  ),
  inactiveConfig: bind(
    ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/inactive-config.json",
    "2945c28e537f417437a3164c32625967882b3c06774a7407d60499c7b3aaf53a",
  ),
  supportContract: bind(
    ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/training-objective-support-contract.json",
    "d0618b9679431951208b2ba4427d3f2c8d118524c2e6f682130f936ac5c74c85",
  ),
  ownerActionRequest: bind(
    ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/owner-action-request.json",
    "8fea87fc63e65d6345cf5375eeb40acd2d54c668603723ac428c6d5143d72bd3",
  ),
  implementationAuthorization: bind(
    ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-20260821-092701121/implementation-authorization.json",
    "91cfb1b6ee64d314461a201d8f398d5213f368ae6a08fc7e9a4327a44ed6456f",
  ),
  implementationConsumption: bind(
    ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-20260821-092701121/implementation-consumption.json",
    "0e43811d82f6fca40a7208ea209a57e3fe366d776089d0e8d4a074e8786fe3b1",
  ),
  trainer: bind("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  runner: bind("ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification.py"),
  cpuChecker: bind("ml/ai-painter/scripts/check_stage4_epoch_complete_per_class_worst_luminance_gpu_entry_cpu.py"),
  datasetManifest: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"),
  sourceIndex: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  projectAutoencoderCheckpoint: bind(
    ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt",
    "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
  ),
}
fs.mkdirSync(root, { recursive: false })
const value = {
  schemaVersion: "ai-painter-stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-authorization-v1",
  status: "owner_authorized_pending_execution",
  requestId, commandRef: requestId, runId,
  scope: "one_stage4_epoch_complete_per_class_worst_luminance_readonly_gpu_qualification_only",
  contractId: "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1",
  allowedActions: [
    "read_bound_cpu_qualification_evidence",
    "inspect_python_cuda_and_disk_resources",
    "read_project_autoencoder_checkpoint",
    "initialize_fixed_random_denoiser",
    "read_all_48_train_and_8_validation_records",
    "execute_cuda_50_step_readonly_rollouts",
    "execute_torch_autograd_grad_for_four_selected_sample_classes",
    "write_readonly_gpu_qualification_evidence_and_local_records",
  ],
  deniedActions: [
    "read_old_denoiser_checkpoint", "read_failed_checkpoint", "create_optimizer",
    "execute_backward", "modify_model_weights", "write_checkpoint", "start_smoke",
    "start_stage0", "start_stage1", "start_stage2", "start_training",
    "checkpoint_promotion", "formal_inference", "runtime_frame", "world_entry",
  ],
  taskIdentity: {
    contractId: "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1",
    seed: 20263722,
    imageSize: { width: 256, height: 192 },
    rolloutSteps: 50,
    gradientTailSteps: 5,
    topology: "west",
    trainPopulation: "all_48_train_records_in_source_index_order",
    validationPopulation: "all_8_validation_records_all_existing_rollout_seeds",
    requiredClasses: ["footprints", "tree", "rock", "vegetation"],
  },
  bindings,
  outputNamespace,
  preflightReportPath: `${path.relative(ROOT, root).replaceAll("\\", "/")}/preflight-report.json`,
  cpuEntryReportPath: `${path.relative(ROOT, root).replaceAll("\\", "/")}/cpu-entry-report.json`,
  checkpointReadAuthorized: true,
  oldDenoiserCheckpointReadAuthorized: false,
  optimizerCreationAuthorized: false,
  backwardExecutionAuthorized: false,
  modelWeightModificationAuthorized: false,
  gpuAuthorized: true,
  trainingAuthorized: false,
  oneTimeConsumptionRequired: true,
  automaticRetryAuthorized: false,
  consumptionState: { consumed: false, consumptionPath: null },
  createdAtUtc: new Date().toISOString(),
}
const descriptor = fs.openSync(authorizationPath, "wx")
try { fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(descriptor) }
finally { fs.closeSync(descriptor) }
console.log(JSON.stringify({
  status: value.status,
  authorization: { path: path.relative(ROOT, authorizationPath).replaceAll("\\", "/"), sha256: sha(authorizationPath) },
  outputNamespace,
  preflightReportPath: value.preflightReportPath,
  cpuEntryReportPath: value.cpuEntryReportPath,
}, null, 2))
