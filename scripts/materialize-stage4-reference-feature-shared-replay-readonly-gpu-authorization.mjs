import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const i = process.argv.indexOf("--run-id")
const runId = i >= 0 ? process.argv[i + 1] : null
assert.match(runId ?? "", /^\d{8}-\d{9}$/)
const requestId = `owner-authorized-stage4-reference-feature-shared-replay-readonly-gpu-${runId}`
const root = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", requestId)
const authorizationPath = path.join(root, "gpu-authorization.json")
const outputNamespace = `.runtime/ai-painter/stage4-reference-feature-shared-replay-readonly-gpu-qualifications/${runId}`
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
  cpuTerminal: bind(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/phase-terminal.json", "aa4a9e1a76b14cf299b91a078c7ecd0daaebc83564b3a797243232a640ed31da"),
  cpuReport: bind(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/cpu-report.json", "d09a3eeb262ab8a6b1ce34acf28bc65328d9950f6510f99c44965c8665efd4fa"),
  configurationAudit: bind(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/configuration-audit.json", "74d01165c2244a198bafe4b350093edad51563cd4c78cd428a8a26d626e0f798"),
  inactiveConfig: bind(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/inactive-config.json", "323a3a14bf0269bda101b8e7719fc9bc5d68ebde9e5b2dd7977f3789f2942976"),
  supportContract: bind(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/training-objective-support-contract.json", "69dc31cca4cddc04d1e695c3d48a5af8e2443dbb6ce1cc0085c5dd2b536c7c47"),
  ownerActionRequest: bind(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/owner-action-request.json", "cdf1552911f432c657f7d83774e4c66a5a4a8c888b255fd51e3da5513f27e093"),
  implementationAuthorization: bind(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-20260822-072101387/implementation-authorization.json", "e022f4339324ae3a3f64e5548072f42fb2ce6d754d38d73351cf8079eaf62f0a"),
  implementationConsumption: bind(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-20260822-072101387/implementation-consumption.json", "89910f60d0a219e418f15a048a47cf48a0549c3284fcde1171d097d044b5246c"),
  trainer: bind("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  runner: bind("ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification.py", "f781ec45caf978c9b4ddf44db4d456856c7bc78ee5884a3db942232aa3b77f7b"),
  cpuChecker: bind("ml/ai-painter/scripts/check_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_entry_cpu.py", "7f4ae0a84c49f0e02a88337a89c0dcf130cfe8278b8a084dc27c3b7e1a42c528"),
  datasetManifest: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"),
  sourceIndex: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  projectAutoencoderCheckpoint: bind(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt", "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"),
}
const executionIdentityUnificationEvidence = {
  terminal: bind(".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-unification-cpu-implementations/20260822-082203202/phase-terminal.json", "c1fef7fe122aaecc33a778056ae632a5d0a6ebf40ff24b774a6531b74b23151b"),
  cpuReport: bind(".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-unification-cpu-implementations/20260822-082203202/cpu-report.json", "e8fd6cd2edc81740f21cd081cfd4c4f3d1c17a802494d8e8102f2515c15c3996"),
  supportContract: bind(".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-unification-cpu-implementations/20260822-082203202/cpu-support-contract.json", "87a895bda58305f77149973788bb998d4efb1c11e49f1353ef721f9fafadec9a"),
  ownerActionRequest: bind(".runtime/ai-painter/stage4-reference-feature-scan-rerun-identity-unification-cpu-implementations/20260822-082203202/owner-action-request.json", "f6b5edb3b965b31d65111997d839b61b470a363ed9db0f33e31ce8ec9f271971"),
}
const identityTerminal = JSON.parse(fs.readFileSync(path.resolve(ROOT, executionIdentityUnificationEvidence.terminal.path), "utf8"))
const identityCpuReport = JSON.parse(fs.readFileSync(path.resolve(ROOT, executionIdentityUnificationEvidence.cpuReport.path), "utf8"))
const identitySupportContract = JSON.parse(fs.readFileSync(path.resolve(ROOT, executionIdentityUnificationEvidence.supportContract.path), "utf8"))
const identityOwnerActionRequest = JSON.parse(fs.readFileSync(path.resolve(ROOT, executionIdentityUnificationEvidence.ownerActionRequest.path), "utf8"))
assert.equal(identityTerminal.status, "stage4_reference_feature_scan_rerun_execution_identity_unification_cpu_succeeded_closed")
assert.match(identityCpuReport.status, /passed/)
assert.equal(identitySupportContract.status, "cpu_support_verified_inactive")
assert.equal(identitySupportContract.contractId, "stage4_reference_feature_scan_rerun_execution_identity_unification_v1")
assert.equal(identityOwnerActionRequest.status, "not_authorized_not_consumed")
fs.mkdirSync(root, { recursive: false })
const value = {
  schemaVersion: "ai-painter-stage4-reference-feature-shared-replay-readonly-gpu-authorization-v1",
  status: "owner_authorized_pending_execution", requestId, commandRef: requestId, runId,
  scope: "one_stage4_reference_feature_shared_replay_readonly_gpu_qualification_only",
  contractId: "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1",
  allowedActions: [
    "read_bound_cpu_qualification_evidence", "inspect_python_cuda_and_disk_resources",
    "read_project_autoencoder_checkpoint", "initialize_fixed_random_denoiser",
    "read_all_48_train_and_8_validation_records", "execute_cuda_50_step_readonly_rollouts",
    "execute_torch_autograd_grad_for_four_selected_sample_classes",
    "verify_shared_two_replay_schedule", "write_readonly_gpu_qualification_evidence_and_local_records",
  ],
  deniedActions: ["read_old_denoiser_checkpoint", "read_failed_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights", "write_checkpoint", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "checkpoint_promotion", "formal_inference", "runtime_frame", "world_entry"],
  taskIdentity: { contractId: "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1", seed: 20263722, imageSize: { width: 256, height: 192 }, rolloutSteps: 50, gradientTailSteps: 5, topology: "west", trainPopulation: "all_48_train_records_in_source_index_order", validationPopulation: "all_8_validation_records_all_existing_rollout_seeds", requiredClasses: ["footprints", "tree", "rock", "vegetation"], objectiveOrder: ["luminance", "reference_feature_structure"], existingReplayPasses: 2 },
  bindings, executionIdentityUnificationEvidence, outputNamespace,
  preflightReportPath: `${path.relative(ROOT, root).replaceAll("\\", "/")}/preflight-report.json`,
  cpuEntryReportPath: `${path.relative(ROOT, root).replaceAll("\\", "/")}/cpu-entry-report.json`,
  checkpointReadAuthorized: true, oldDenoiserCheckpointReadAuthorized: false,
  optimizerCreationAuthorized: false, backwardExecutionAuthorized: false,
  modelWeightModificationAuthorized: false, gpuAuthorized: true, trainingAuthorized: false,
  oneTimeConsumptionRequired: true, automaticRetryAuthorized: false,
  consumptionState: { consumed: false, consumptionPath: null }, createdAtUtc: new Date().toISOString(),
}
const fd = fs.openSync(authorizationPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
console.log(JSON.stringify({ status: value.status, authorization: { path: path.relative(ROOT, authorizationPath).replaceAll("\\", "/"), sha256: sha(authorizationPath) }, outputNamespace, preflightReportPath: value.preflightReportPath, cpuEntryReportPath: value.cpuEntryReportPath }, null, 2))
