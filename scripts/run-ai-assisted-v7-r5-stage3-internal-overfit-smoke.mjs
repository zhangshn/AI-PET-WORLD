import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = resolve("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const TRAINER_SHA256 = "f41597ec380c068fc9ea9d87dcea56f214bc6a3bc4bff5ddb6875f90ae19b7eb"
const REQUEST_ID = "owner-action-request-v7-r5-stage3-condition-evidence-serialization-fix-retry-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "df0de715098933533468668776573cfa88abc17ec0716e4883e005baf7782708"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "10873531ed7e9804b9cdc76fde78f7ecc4faf764a4626b277d70373a3f1aea6a"
const COMMAND_REF = "owner-authorized-v7-r5-stage3-condition-evidence-serialization-fix-and-one-checkpoint-smoke-retry-20260804"
const SCOPE = "r5_stage3_condition_evidence_non_scalar_image_tensor_serialization_fix_cpu_regression_and_one_same_checkpoint_gpu_smoke_retry_only"
const AUTHORIZATION_STATUS = "owner_authorized_v7_r5_single_sample_overfit_smoke"
const SOURCE_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/stage3-internal-isolated-configs/ai-assisted-v7-r5-stage3-internal-isolated-config-2026-08-04T11-48-19-629Z/isolated-config.json"
const SOURCE_CONFIG_SHA256 = "400e44d68b5c6500619bdac4a28ff20151457451dd93bfd9672c41f87d6ca363"
const SELECTION_CONTRACT_PATH = "data/ai-painter/system-governance/v7-r5-stage3-internal-isolated-config-selection-contract.json"
const SELECTION_CONTRACT_SHA256 = "0df8084664460711a641365bed0e6435893f7aa8e8343fad3c9702e2eb3b6de3"
const DATASET_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const PARENT_CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/ai-assisted-v7-repair-r5-checkpoint-continuation-single-sample-overfit-smoke-2026-08-04T10-07-52-619Z/complete-world-ai-assisted-conditional-denoiser.pt"
const PARENT_CHECKPOINT_SHA256 = "21198424af06d140c780540c345809841afc4fb2e19cd0c52419f62b58f5da42"
const PARENT_MANIFEST_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/ai-assisted-v7-repair-r5-checkpoint-continuation-single-sample-overfit-smoke-2026-08-04T10-07-52-619Z/manifest.json"
const PARENT_MANIFEST_SHA256 = "37fab710dab997d0ea390ffa9f8dcf337f21011ac37c7f40698c8a49d836686d"
const PREVIOUS_FAILURE_REPORT_PATH = ".runtime/ai-painter/v7-r5-stage3-internal-overfit-smoke-finalizations/ai-assisted-v7-r5-stage3-overfit-smoke-finalization-2026-08-04T12-45-05-150Z/finalization-report.json"
const PREVIOUS_FAILURE_REPORT_SHA256 = "c1059a13463bc0b42cf19705093ee84a18c3aa3e234a6602b7befac7315d4269"
const EXPECTED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const EXPECTED_CONDITION_LABEL = "v7-complete-map-146"
const EXPECTED_SEED = 20260722
const OVERFIT_EPOCHS = 30
const EVALUATION_INTERVAL = 10
const REQUIRED_PREVIEW_EPOCHS = [1, 10, 20, 30]
const REQUIRED_TAIL_EPOCHS = [10, 20, 30]
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const MODEL_ROOT = resolve(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-internal")
const FINALIZATION_ROOT = resolve(".runtime/ai-painter/v7-r5-stage3-internal-overfit-smoke-finalizations")
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const runId = `ai-assisted-v7-r5-stage3-internal-checkpoint-continuation-overfit-smoke-${suffix}`
const runDir = path.join(MODEL_ROOT, runId)
const derivedConfigPath = path.join(MODEL_ROOT, "derived-configs", `${runId}.json`)
const registrationPath = path.join(MODEL_ROOT, "run-registrations", `${REQUEST_ID}.json`)
const lockPath = path.join(MODEL_ROOT, ".r5-stage3-single-sample-overfit-smoke.lock")

const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const sourceConfig = readJson(SOURCE_CONFIG_PATH)
const selectionContract = readJson(SELECTION_CONTRACT_PATH)
const parentManifest = readJson(PARENT_MANIFEST_PATH)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = readJson(datasetPointer.manifestPath)
const sourceIndex = readJson(datasetManifest.sourceIndexPath)
const autoencoderPointer = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const selectedRows = sourceIndex.samples.filter(isV7CapacityRow)
const splitCounts = countSplits(selectedRows)
const overfitRow = selectedRows.find((row) => row.sampleId === EXPECTED_SAMPLE_ID && row.conditionLabel === EXPECTED_CONDITION_LABEL && row.split === "train")
const derivedConfig = deepMerge(sourceConfig, {
  status: AUTHORIZATION_STATUS,
  training: {
    trainingAuthorizationStatus: AUTHORIZATION_STATUS,
    authorizedOverfitSampleId: EXPECTED_SAMPLE_ID,
    authorizedInitialization: "project_r5_single_sample_checkpoint_continuation",
    r5Stage3CheckpointContinuation: {
      loadingAuthorizedNow: true,
      sourceArchitectureVersion: parentManifest.architectureVersion,
    },
    ownerTrainingAuthorization: {
      authorizationId: REQUEST_ID,
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256: AUTHORIZATION_SHA256,
      authorizationConsumptionPath: CONSUMPTION_PATH,
      authorizationConsumptionSha256: CONSUMPTION_SHA256,
      sourceConfigPath: SOURCE_CONFIG_PATH,
      sourceConfigSha256: SOURCE_CONFIG_SHA256,
      selectionContractPath: SELECTION_CONTRACT_PATH,
      selectionContractSha256: SELECTION_CONTRACT_SHA256,
      status: AUTHORIZATION_STATUS,
      checkpointLoadingAuthorized: true,
      optimizerCreationAuthorized: true,
      modelWeightMutationAuthorized: true,
      gpuTrainingAuthorizedNow: true,
      singleSampleGpuOverfitSmokeAuthorized: true,
      automaticRetryAuthorized: false,
      fullTrainingAuthorized: false,
      strictRevalidationAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      checkpointPromotionAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
  },
})

const blockers = validatePreflight()
if (blockers.length > 0) finishBlocked("r5_stage3_smoke_preflight_blocked", blockers)
fs.mkdirSync(path.dirname(derivedConfigPath), { recursive: true })
writeImmutableJson(derivedConfigPath, derivedConfig)
appendEvent("r5_stage3_smoke_python_preflight_started", "running", "Python只读预检开始；Checkpoint尚未加载；GPU尚未启动")
const pythonPreflight = runTrainer(["--preflight-only"])
if (pythonPreflight.status !== 0) finishBlocked("r5_stage3_smoke_python_preflight_failed", ["r5_stage3_python_preflight_failed"], pythonPreflight)
appendEvent("r5_stage3_smoke_python_preflight_completed", "success", "Python预检通过；Checkpoint尚未加载；GPU尚未启动")

const gpuBefore = gpuSnapshot()
if (!gpuBefore.available || gpuBefore.utilizationPercent > 10 || gpuBefore.memoryUsedMiB > 3000) {
  finishBlocked("r5_stage3_smoke_gpu_blocked", [
    !gpuBefore.available ? "gpu_telemetry_unavailable" : null,
    gpuBefore.utilizationPercent > 10 ? "gpu_compute_busy" : null,
    gpuBefore.memoryUsedMiB > 3000 ? "gpu_memory_busy" : null,
  ].filter(Boolean), pythonPreflight, { gpuBefore })
}
if (fs.existsSync(registrationPath)) finishBlocked("r5_stage3_smoke_already_consumed", ["authorized_gpu_smoke_already_started"], pythonPreflight, { gpuBefore })
fs.mkdirSync(MODEL_ROOT, { recursive: true })
let lockHandle
try {
  lockHandle = fs.openSync(lockPath, "wx")
} catch {
  finishBlocked("r5_stage3_smoke_lock_blocked", ["r5_stage3_smoke_lock_active"], pythonPreflight, { gpuBefore })
}

let child = null
let manifest = null
try {
  writeImmutableJson(registrationPath, {
    schemaVersion: "ai-assisted-v7-r5-stage3-smoke-run-start-registration-v1",
    status: "registered_before_checkpoint_load_and_gpu_training_start",
    runId,
    requestId: REQUEST_ID,
    registeredAtUtc: new Date().toISOString(),
    registeredAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    modelId: derivedConfig.modelId,
    datasetPackageId: datasetManifest.packageId,
    selectedSampleId: EXPECTED_SAMPLE_ID,
    selectedConditionLabel: EXPECTED_CONDITION_LABEL,
    initialization: "project_r5_single_sample_checkpoint_continuation",
    seed: EXPECTED_SEED,
    parentCheckpointPath: PARENT_CHECKPOINT_PATH,
    parentCheckpointSha256: PARENT_CHECKPOINT_SHA256,
    resolutionStage: { index: 0, width: 256, height: 192 },
    epochCount: OVERFIT_EPOCHS,
    evaluationInterval: EVALUATION_INTERVAL,
    requiredPreviewEpochs: REQUIRED_PREVIEW_EPOCHS,
    requiredTailEpochs: REQUIRED_TAIL_EPOCHS,
    derivedConfigPath: projectPath(derivedConfigPath),
    derivedConfigSha256: sha256File(derivedConfigPath),
    automaticRetryAuthorized: false,
    fullTrainingAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  })
  appendEvent("r5_stage3_single_sample_gpu_smoke_started", "running", `样本=${EXPECTED_SAMPLE_ID}；Epoch=${OVERFIT_EPOCHS}；重放=2；Checkpoint=${PARENT_CHECKPOINT_SHA256.slice(0, 12)}`)
  child = runTrainer([])
  if (child.status !== 0) throw new Error("r5_stage3_python_single_sample_overfit_smoke_failed")
  manifest = readJson(path.join(runDir, "manifest.json"))
  const manifestIssues = validateManifest(manifest)
  if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
  const reviews = await reviewPreviews()
  const tailStability = evaluateTailStability(reviews)
  const allPreviewHardGatePassed = reviews.length === 4 && reviews.every((review) => review.passed)
  const runBlockers = []
  if (!allPreviewHardGatePassed) runBlockers.push("stage_0_preview_machine_hard_gate_failed")
  if (!tailStability.passed) runBlockers.push("r5_stage3_tail_three_consecutive_passes_missing")
  const status = runBlockers.length === 0
    ? "r5_stage3_checkpoint_continuation_single_sample_overfit_smoke_passed_stopped"
    : "r5_stage3_checkpoint_continuation_single_sample_overfit_smoke_failed_stopped"
  const report = writeReport(status, runBlockers, manifest, reviews, child, { gpuBefore, gpuAfter: gpuSnapshot(), allPreviewHardGatePassed, tailStability, finalMetrics: manifest.metrics?.at(-1) ?? {} })
  writeTerminalRegistration(report)
  appendEvent(runBlockers.length === 0 ? "r5_stage3_smoke_completed" : "r5_stage3_smoke_failed", runBlockers.length === 0 ? "success" : "failed", `${status}；自动重试=false；完整训练=false`, report.reportPath)
  console.log(JSON.stringify(report, null, 2))
  if (runBlockers.length > 0) process.exitCode = 1
} catch (error) {
  const runBlockers = String(error?.message ?? error).split(",").filter(Boolean)
  const report = writeReport("r5_stage3_checkpoint_continuation_single_sample_overfit_smoke_execution_failed_stopped", runBlockers, manifest, [], child, { gpuBefore, gpuAfter: gpuSnapshot() })
  writeTerminalRegistration(report)
  appendEvent("r5_stage3_smoke_execution_failed", "failed", runBlockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
} finally {
  if (lockHandle !== undefined) fs.closeSync(lockHandle)
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath)
}

function validatePreflight() {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "authorization_hash_invalid")
  check(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "consumption_hash_invalid")
  check(fileHashMatches(TRAINER, TRAINER_SHA256), "trainer_hash_invalid")
  check(fileHashMatches(SOURCE_CONFIG_PATH, SOURCE_CONFIG_SHA256), "source_config_hash_invalid")
  check(fileHashMatches(SELECTION_CONTRACT_PATH, SELECTION_CONTRACT_SHA256), "selection_contract_hash_invalid")
  check(fileHashMatches(PARENT_CHECKPOINT_PATH, PARENT_CHECKPOINT_SHA256), "parent_checkpoint_hash_invalid")
  check(fileHashMatches(PARENT_MANIFEST_PATH, PARENT_MANIFEST_SHA256), "parent_manifest_hash_invalid")
  check(fileHashMatches(PREVIOUS_FAILURE_REPORT_PATH, PREVIOUS_FAILURE_REPORT_SHA256), "previous_failure_report_invalid")
  check(authorization?.status === "resolved_owner_authorized", "authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "authorization_identity_invalid")
  check(consumption?.status === "consumed_before_authorized_write" && consumption?.authorizationSha256 === AUTHORIZATION_SHA256, "authorization_not_consumed")
  check(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE, "consumption_identity_invalid")
  check(consumption?.allowedExecutionCount === 1, "retry_execution_count_invalid")
  for (const key of ["conditionEvidenceSerializationFixAuthorized", "knownPredictedRgbTensorExclusionAuthorized", "unknownNonScalarTensorFailureClosureRequired", "cpuPositiveRegressionAuthorized", "cpuNegativeRegressionAuthorized", "trainerAuthorizationGateRebindingAuthorized", "runnerAuthorizationGateRebindingAuthorized", "sameCheckpointReadAndLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "oneGpuSmokeRetryAuthorized", "fixedEpochPreviewGenerationAuthorized", "machinePreviewReviewAuthorized", "checkpointAndTokenEvidenceStorageAuthorized", "automaticTerminalStorageAuthorized"]) check(authorization?.resolution?.[key] === true, `${key}_missing`)
  for (const key of ["automaticAdditionalRetryAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) check(authorization?.resolution?.[key] === false, `boundary_${key}_invalid`)
  check(selectionContract?.status === "r5_stage3_isolated_config_compiled_not_active_checkpoint_not_read_or_loaded_training_not_authorized", "selection_contract_status_invalid")
  check(sourceConfig?.status === "isolated_r5_stage3_internal_candidate_not_active", "source_config_not_isolated")
  check(sourceConfig?.training?.boundedRepairVersion === "v7_bounded_repair_r5_candidate", "source_config_version_invalid")
  check(sourceConfig?.training?.r5Stage3CheckpointContinuation?.sourceCheckpointPath === PARENT_CHECKPOINT_PATH, "parent_checkpoint_path_binding_invalid")
  check(sourceConfig?.training?.r5Stage3CheckpointContinuation?.sourceCheckpointSha256 === PARENT_CHECKPOINT_SHA256, "parent_checkpoint_hash_binding_invalid")
  check(sourceConfig?.training?.r5Stage3CheckpointContinuation?.loadingAuthorizedNow === false, "source_checkpoint_loading_active")
  check(sourceConfig?.training?.pathHardExampleReplay?.passesPerEpoch === 2, "replay_count_invalid")
  check(sourceConfig?.training?.denoiserEpochs === OVERFIT_EPOCHS, "epoch_contract_invalid")
  check(sameJson(sourceConfig?.training?.smokeStabilityGate?.tailEpochs, REQUIRED_TAIL_EPOCHS), "tail_epoch_contract_invalid")
  check(parentManifest?.checkpointSha256 === PARENT_CHECKPOINT_SHA256 && parentManifest?.trainingStage === "conditional_denoiser_single_sample_overfit_smoke", "parent_manifest_identity_invalid")
  check(selectedRows.length === 64 && sameJson(splitCounts, EXPECTED_SPLITS), "dataset_64_split_contract_invalid")
  check(Boolean(overfitRow), "overfit_sample_missing")
  check(datasetManifest.packageId === authorization?.taskIdentity?.datasetPackageId, "dataset_package_identity_invalid")
  check(authorization?.taskIdentity?.sampleId === EXPECTED_SAMPLE_ID && authorization?.taskIdentity?.conditionLabel === EXPECTED_CONDITION_LABEL, "authorized_sample_identity_invalid")
  check(authorization?.taskIdentity?.seed === EXPECTED_SEED && authorization?.taskIdentity?.epochCount === OVERFIT_EPOCHS && authorization?.taskIdentity?.evaluationInterval === EVALUATION_INTERVAL, "authorized_smoke_parameters_invalid")
  check(sameJson(authorization?.taskIdentity?.requiredPreviewEpochs, REQUIRED_PREVIEW_EPOCHS) && sameJson(authorization?.taskIdentity?.requiredTailEpochs, REQUIRED_TAIL_EPOCHS), "authorized_preview_gate_invalid")
  check(authorization?.taskIdentity?.failureReportPath === PREVIOUS_FAILURE_REPORT_PATH && authorization?.taskIdentity?.failureReportSha256 === PREVIOUS_FAILURE_REPORT_SHA256, "authorized_retry_parent_failure_invalid")
  check(authorization?.taskIdentity?.parentCheckpointPath === PARENT_CHECKPOINT_PATH && authorization?.taskIdentity?.parentCheckpointSha256 === PARENT_CHECKPOINT_SHA256, "authorized_parent_checkpoint_invalid")
  check(fileHashMatches(datasetPointer.manifestPath, DATASET_MANIFEST_SHA256), "dataset_manifest_hash_invalid")
  check(fileHashMatches(autoencoderPointer.checkpointPath, autoencoderPointer.checkpointSha256), "autoencoder_checkpoint_invalid")
  check(fs.existsSync(PYTHON) && fs.existsSync(resolve(TRAINER)), "training_runtime_missing")
  return issues
}

function runTrainer(extra) {
  return spawnSync(PYTHON, [
    resolve(TRAINER),
    "--config", derivedConfigPath,
    "--dataset-package", resolve(datasetPointer.manifestPath),
    "--autoencoder-checkpoint", resolve(autoencoderPointer.checkpointPath),
    "--initial-denoiser-checkpoint", resolve(PARENT_CHECKPOINT_PATH),
    "--output-dir", runDir,
    "--resolution-stage", "0",
    "--single-sample-overfit-smoke",
    "--overfit-sample-id", EXPECTED_SAMPLE_ID,
    "--overfit-epochs", String(OVERFIT_EPOCHS),
    "--overfit-evaluation-interval", String(EVALUATION_INTERVAL),
    ...extra,
  ], { cwd: ROOT, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: resolve("ml/ai-painter/src") }, windowsHide: true })
}

function validateManifest(value) {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(value?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "manifest_status_invalid")
  check(value?.trainingStage === "conditional_denoiser_single_sample_overfit_smoke", "training_stage_invalid")
  check(value?.singleSampleOverfitSmoke?.sampleId === EXPECTED_SAMPLE_ID, "sample_identity_invalid")
  check(value?.singleSampleOverfitSmoke?.nonFormal === true, "nonformal_boundary_invalid")
  check(value?.actualLoadedConditionalSampleCount === 64 && value?.actualLoadedV7CapacityCount === 64, "capacity_invalid")
  check(sameJson(value?.actualLoadedSplitCounts, EXPECTED_SPLITS), "split_invalid")
  check(value?.denoiserTrained === false && value?.formalInferenceEligible === false, "promotion_boundary_invalid")
  check(value?.parentDenoiserCheckpointPath === PARENT_CHECKPOINT_PATH, "manifest_parent_path_invalid")
  check(value?.parentDenoiserCheckpointSha256 === PARENT_CHECKPOINT_SHA256, "manifest_parent_hash_invalid")
  check(value?.architectureVersion === derivedConfig.architectureVersion, "manifest_architecture_invalid")
  check(value?.metrics?.at(-1)?.epoch === OVERFIT_EPOCHS, "epoch_count_invalid")
  check(value?.metrics?.at(-1)?.trainPathHardExampleReplayPasses === 2, "manifest_replay_count_invalid")
  check(fileHashMatches(value?.checkpointPath, value?.checkpointSha256), "output_checkpoint_hash_invalid")
  return issues
}

async function reviewPreviews() {
  const previewRoot = path.join(runDir, "fixed-epoch-previews")
  const files = fs.existsSync(previewRoot) ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort() : []
  const reviews = []
  const conditionPack = readJson(overfitRow.conditionPackPath)
  for (const fileName of files) {
    const previewPath = path.join(previewRoot, fileName)
    const epoch = Number(fileName.match(/^epoch-(\d+)/)?.[1] ?? 0)
    const shortInputPath = resolve(`.runtime/ai-painter/r5-stage3-review-inputs/${runId.slice(-24)}/e${String(epoch).padStart(3, "0")}.png`)
    const normalizedPath = path.join(runDir, "fixed-preview-review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    fs.mkdirSync(path.dirname(shortInputPath), { recursive: true })
    fs.mkdirSync(path.dirname(normalizedPath), { recursive: true })
    fs.copyFileSync(previewPath, shortInputPath, fs.constants.COPYFILE_EXCL)
    if (sha256File(shortInputPath) !== sha256File(previewPath)) throw new Error(`review_copy_hash_mismatch_epoch_${epoch}`)
    await sharp(shortInputPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalizedPath),
      auditAiAssistedConditionAlignment({
        record: { recordId: `${runId}-${path.parse(fileName).name}`, conditionBinding: { conditionPackPath: overfitRow.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: overfitRow.classification },
        imagePath: normalizedPath,
        referenceImagePath: overfitRow.imagePath,
      }),
    ])
    reviews.push({
      epoch,
      recordedAtUtc: new Date().toISOString(),
      recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
      previewPath: projectPath(previewPath),
      previewSha256: sha256File(previewPath),
      normalizedReviewImagePath: projectPath(normalizedPath),
      normalizedReviewImageSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  const report = {
    schemaVersion: "ai-assisted-v7-r5-stage3-preview-hard-gate-review-v1",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    status: reviews.length === 4 && reviews.every((review) => review.passed) && evaluateTailStability(reviews).passed ? "passed" : "failed",
    stage: 0,
    reviewCount: reviews.length,
    passCount: reviews.filter((review) => review.passed).length,
    failCount: reviews.filter((review) => !review.passed).length,
    tailStabilityGate: evaluateTailStability(reviews),
    reviewThresholdPolicy: "unchanged_existing_machine_review_contract",
    reviews,
    nextStageStarted: false,
  }
  writeImmutableJson(path.join(runDir, "fixed-preview-hard-gate-review.json"), report)
  return reviews
}

function evaluateTailStability(reviews) {
  const byEpoch = new Map(reviews.map((row) => [row.epoch, row]))
  const evaluated = REQUIRED_TAIL_EPOCHS.map((epoch) => {
    const row = byEpoch.get(epoch)
    const issueCodes = row?.issueCodes ?? []
    return { epoch, recorded: Boolean(row), passed: Boolean(row?.passed && issueCodes.length === 0), pathIssueFree: !issueCodes.some((code) => code.includes("terrain_path_ground")), objectIssueFree: !issueCodes.some((code) => code.startsWith("condition_object_")), issueCodes }
  })
  const passed = evaluated.length === 3 && evaluated.every((row) => row.recorded && row.passed && row.pathIssueFree && row.objectIssueFree)
  return { status: passed ? "r5_stage3_tail_stability_gate_passed" : "r5_stage3_tail_stability_gate_failed_closed", passed, requiredConsecutiveTailPasses: 3, evaluated }
}

function writeReport(status, blockers, currentManifest, reviews, processResult, metrics = {}) {
  const reportId = `ai-assisted-v7-r5-stage3-overfit-smoke-finalization-${suffix}`
  const reportPath = path.join(FINALIZATION_ROOT, reportId, "finalization-report.json")
  const reviewPath = path.join(runDir, "fixed-preview-hard-gate-review.json")
  const report = {
    schemaVersion: "ai-assisted-v7-r5-stage3-overfit-smoke-finalization-v1",
    reportId,
    status,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    runId,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    sourceConfigPath: SOURCE_CONFIG_PATH,
    sourceConfigSha256: SOURCE_CONFIG_SHA256,
    derivedConfigPath: fs.existsSync(derivedConfigPath) ? projectPath(derivedConfigPath) : null,
    derivedConfigSha256: fs.existsSync(derivedConfigPath) ? sha256File(derivedConfigPath) : null,
    initialization: "project_r5_single_sample_checkpoint_continuation",
    seed: EXPECTED_SEED,
    parentCheckpointPath: PARENT_CHECKPOINT_PATH,
    parentCheckpointSha256: PARENT_CHECKPOINT_SHA256,
    selectedSampleId: EXPECTED_SAMPLE_ID,
    selectedConditionLabel: EXPECTED_CONDITION_LABEL,
    epochCount: OVERFIT_EPOCHS,
    evaluationInterval: EVALUATION_INTERVAL,
    requiredTailEpochs: REQUIRED_TAIL_EPOCHS,
    manifestPath: currentManifest ? projectPath(path.join(runDir, "manifest.json")) : null,
    manifestSha256: currentManifest ? sha256File(path.join(runDir, "manifest.json")) : null,
    checkpointPath: currentManifest?.checkpointPath ?? null,
    checkpointSha256: currentManifest?.checkpointSha256 ?? null,
    tokenAccounting: currentManifest?.localTrainingTokenAccounting ?? currentManifest?.trainingTokenAccounting ?? null,
    previewReviewPath: fs.existsSync(reviewPath) ? projectPath(reviewPath) : null,
    previewReviewSha256: fs.existsSync(reviewPath) ? sha256File(reviewPath) : null,
    previewReviewStatus: fs.existsSync(reviewPath) ? readJson(reviewPath).status : "not_created_due_to_prior_failure",
    previewCount: reviews.length,
    previewPassCount: reviews.filter((review) => review.passed).length,
    previewFailCount: reviews.filter((review) => !review.passed).length,
    metrics,
    blockers,
    process: processResult ? { exitCode: processResult.status, signal: processResult.signal, stdoutTail: String(processResult.stdout ?? "").slice(-32000), stderrTail: String(processResult.stderr ?? "").slice(-32000) } : null,
    checkpointLoaded: fs.existsSync(registrationPath),
    gpuSmokeStarted: fs.existsSync(registrationPath),
    automaticRetryStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticStorage: true,
  }
  writeImmutableJson(reportPath, report)
  return { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
}

function writeTerminalRegistration(report) {
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true })
  const terminalPath = path.join(runDir, "run-terminal-registration.json")
  if (fs.existsSync(terminalPath)) return
  writeImmutableJson(terminalPath, {
    schemaVersion: "ai-assisted-v7-r5-stage3-smoke-run-terminal-registration-v1",
    runId,
    status: report.status,
    registeredAtUtc: report.createdAtUtc,
    registeredAtAsiaShanghai: report.createdAtAsiaShanghai,
    manifestPath: report.manifestPath,
    manifestSha256: report.manifestSha256,
    checkpointPath: report.checkpointPath,
    checkpointSha256: report.checkpointSha256,
    previewReviewPath: report.previewReviewPath,
    previewReviewSha256: report.previewReviewSha256,
    previewReviewStatus: report.previewReviewStatus,
    finalizationReportPath: report.reportPath,
    finalizationReportSha256: report.reportSha256,
    blockers: report.blockers,
    automaticRetryStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
  })
}

function finishBlocked(status, blockers, child = null, metrics = {}) {
  const report = writeReport(status, blockers, null, [], child, metrics)
  appendEvent("r5_stage3_smoke_blocked", "blocked", blockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}
function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({ action: "run_ai_assisted_v7_r5_stage3_internal_overfit_smoke", runId, kind, status, title: kind.replaceAll("_", " "), titleZh: `V7 R5第3阶段单样本Smoke：${kind}`, detail, detailZh: detail, script: "scripts/run-ai-assisted-v7-r5-stage3-internal-overfit-smoke.mjs", currentStep: kind, evidencePath, finalGameMapSuccess: false, canEnterWorld: false })
}
function isV7CapacityRow(row) { return row.categoryId === "complete-maps" && row.v7CapacityContributionRegistered === true && row.ownerReviewStatus === "owner_approved" && row.machineReviewStatus === "passed" && row.formalConditionalTrainingEligible === true && row.conditionBound === true }
function countSplits(rows) { return Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])) }
function deepMerge(base, patch) { if (Array.isArray(patch)) return [...patch]; if (!patch || typeof patch !== "object") return patch; const result = { ...(base ?? {}) }; for (const [key, value] of Object.entries(patch)) result[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(result[key], value) : value; return result }
function readJson(value) { const absolute = resolve(value); return fs.existsSync(absolute) ? JSON.parse(fs.readFileSync(absolute, "utf8")) : null }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return Boolean(fs.existsSync(absolute) && sha256File(absolute) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function gpuSnapshot() { const child = spawnSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"], { cwd: ROOT, encoding: "utf8", windowsHide: true }); if (child.status !== 0) return { available: false, stderr: child.stderr }; const [name, utilization, memoryUsed, memoryTotal, temperature] = child.stdout.trim().split(",").map((value) => value.trim()); return { available: true, name, utilizationPercent: Number(utilization), memoryUsedMiB: Number(memoryUsed), memoryTotalMiB: Number(memoryTotal), temperatureCelsius: Number(temperature) } }
