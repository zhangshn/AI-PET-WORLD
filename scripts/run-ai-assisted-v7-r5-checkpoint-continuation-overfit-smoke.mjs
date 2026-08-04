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
const TRAINER_SHA256 = "707a0d74905a5682df41fe8d0d3b5680d82f5b2820830fe9711021a57ae60840"
const REQUEST_ID = "owner-action-request-v7-r5-single-sample-gpu-smoke-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "0cf2ee01c351aa33f33ae08c6cf57243dce4d59368ec3fa9fd026c821fa8d713"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "1c008d84fb6b977a29b48d139e992c8b832bfbad4954b3fbcc96ff2d19255938"
const COMMAND_REF = "owner-authorized-one-v7-r5-single-sample-gpu-overfit-smoke-20260804"
const SCOPE = "one_v7_r5_checkpoint_continuation_single_sample_gpu_overfit_smoke_with_fixed_preview_machine_review_and_terminal_only"
const AUTHORIZATION_STATUS = "owner_authorized_v7_r5_single_sample_overfit_smoke"
const SOURCE_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/isolated-configs/ai-assisted-v7-r5-isolated-config-2026-08-04T09-31-44-704Z/isolated-config.json"
const SOURCE_CONFIG_SHA256 = "9421b10789ea5590863f789fa3b7933fc806bd8abf32347c900d5d80a3a54089"
const SELECTION_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r5-isolated-config-selection-contract.json"
const SELECTION_CONTRACT_SHA256 = "7d5cda5f3def74635f6b16ce9f647430c9610e0290ac244c9000743f52f5b3b3"
const PARENT_CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z/complete-world-ai-assisted-conditional-denoiser.pt"
const PARENT_CHECKPOINT_SHA256 = "a8cd24d1be1a1128b2cb487ce72a487218bd9b165adddde31f9caba81ca69a32"
const PARENT_MANIFEST_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4/ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-2026-08-04T07-49-43-831Z/manifest.json"
const PARENT_MANIFEST_SHA256 = "621215b5b33ab0c8bf34afa569a72f243b847742b876e576937741a64fe31bd6"
const EXPECTED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const EXPECTED_CONDITION_LABEL = "v7-complete-map-146"
const EXPECTED_SEED = 20260722
const OVERFIT_EPOCHS = 30
const EVALUATION_INTERVAL = 10
const REQUIRED_TAIL_EPOCHS = [10, 20, 30]
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const MODEL_ROOT = resolve(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5")
const FINALIZATION_ROOT = resolve(".runtime/ai-painter/v7-bounded-repair-r5-overfit-smoke-finalizations")
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const runId = `ai-assisted-v7-repair-r5-checkpoint-continuation-single-sample-overfit-smoke-${suffix}`
const runDir = path.join(MODEL_ROOT, runId)
const derivedConfigPath = path.join(MODEL_ROOT, "derived-configs", `${runId}.json`)
const startRegistrationPath = path.join(MODEL_ROOT, "run-registrations", `${REQUEST_ID}.json`)
const lockPath = path.join(MODEL_ROOT, ".r5-single-sample-overfit-smoke.lock")

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
    authorizedInitialization: "project_r4_single_sample_checkpoint_continuation",
    r5CheckpointContinuation: { loadingAuthorizedNow: true },
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
if (blockers.length > 0) finishBlocked("r5_checkpoint_continuation_overfit_smoke_preflight_blocked", blockers)
fs.mkdirSync(path.dirname(derivedConfigPath), { recursive: true })
writeImmutableJson(derivedConfigPath, derivedConfig)
appendEvent("r5_checkpoint_continuation_smoke_preflight_started", "running", `sample=${EXPECTED_SAMPLE_ID}; checkpointLoad=false; GPU=false`)
const pythonPreflight = runTrainer(["--preflight-only"])
if (pythonPreflight.status !== 0) finishBlocked("r5_checkpoint_continuation_overfit_smoke_python_preflight_failed", ["r5_python_preflight_failed"], pythonPreflight)
appendEvent("r5_checkpoint_continuation_smoke_preflight_completed", "success", "Python preflight passed; checkpoint not deserialized; GPU not started")

const gpuBefore = gpuSnapshot()
if (!gpuBefore.available || gpuBefore.utilizationPercent > 10 || gpuBefore.memoryUsedMiB > 3000) {
  finishBlocked("r5_checkpoint_continuation_overfit_smoke_gpu_blocked", [
    !gpuBefore.available ? "r5_gpu_telemetry_unavailable" : null,
    gpuBefore.utilizationPercent > 10 ? "r5_gpu_compute_busy" : null,
    gpuBefore.memoryUsedMiB > 3000 ? "r5_gpu_memory_busy" : null,
  ].filter(Boolean), pythonPreflight, { gpuBefore })
}
if (fs.existsSync(startRegistrationPath)) finishBlocked("r5_checkpoint_continuation_overfit_smoke_already_consumed", ["authorized_r5_gpu_smoke_already_started"], pythonPreflight, { gpuBefore })
fs.mkdirSync(MODEL_ROOT, { recursive: true })
let lockHandle
try {
  lockHandle = fs.openSync(lockPath, "wx")
} catch {
  finishBlocked("r5_checkpoint_continuation_overfit_smoke_lock_blocked", ["r5_single_sample_overfit_smoke_lock_active"], pythonPreflight, { gpuBefore })
}

let child = null
let manifest = null
try {
  writeImmutableJson(startRegistrationPath, {
    schemaVersion: "ai-assisted-v7-r5-smoke-run-start-registration-v1",
    runId,
    requestId: REQUEST_ID,
    status: "registered_before_checkpoint_load_and_gpu_training_start",
    registeredAtUtc: new Date().toISOString(),
    registeredAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    modelId: derivedConfig.modelId,
    datasetPackageId: datasetManifest.packageId,
    selectedSampleId: EXPECTED_SAMPLE_ID,
    selectedConditionLabel: EXPECTED_CONDITION_LABEL,
    initialization: "project_r4_single_sample_checkpoint_continuation",
    seed: EXPECTED_SEED,
    parentCheckpointPath: PARENT_CHECKPOINT_PATH,
    parentCheckpointSha256: PARENT_CHECKPOINT_SHA256,
    resolutionStage: { index: 0, width: 256, height: 192 },
    epochCount: OVERFIT_EPOCHS,
    evaluationInterval: EVALUATION_INTERVAL,
    requiredTailEpochs: REQUIRED_TAIL_EPOCHS,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    derivedConfigPath: projectPath(derivedConfigPath),
    derivedConfigSha256: sha256File(derivedConfigPath),
    automaticRetryAuthorized: false,
    fullTrainingAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  })
  appendEvent("r5_checkpoint_continuation_single_sample_overfit_smoke_started", "running", `sample=${EXPECTED_SAMPLE_ID}; epochs=${OVERFIT_EPOCHS}; parent=${PARENT_CHECKPOINT_SHA256.slice(0, 12)}`)
  child = runTrainer([])
  if (child.status !== 0) throw new Error("r5_python_single_sample_overfit_smoke_failed")
  manifest = readJson(path.join(runDir, "manifest.json"))
  const manifestIssues = validateManifest(manifest)
  if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
  const reviews = await reviewPreviews()
  const tailStability = evaluateTailStability(reviews)
  const allPreviewHardGatePassed = reviews.length > 0 && reviews.every((review) => review.passed)
  const finalMetrics = manifest.metrics?.at(-1) ?? {}
  const runBlockers = []
  if (!allPreviewHardGatePassed) runBlockers.push("stage_0_preview_machine_hard_gate_failed")
  if (!tailStability.passed) runBlockers.push("r5_tail_three_consecutive_zero_recurrence_passes_missing")
  const status = runBlockers.length === 0
    ? "r5_checkpoint_continuation_single_sample_overfit_smoke_passed_stopped"
    : "r5_checkpoint_continuation_single_sample_overfit_smoke_failed_stopped"
  const report = writeReport(status, runBlockers, manifest, reviews, child, { gpuBefore, allPreviewHardGatePassed, tailStability, finalMetrics })
  writeTerminalRegistration(report)
  appendEvent(runBlockers.length === 0 ? "r5_checkpoint_continuation_smoke_completed" : "r5_checkpoint_continuation_smoke_failed", runBlockers.length === 0 ? "success" : "failed", `${status}; automaticRetry=false; fullTraining=false`, report.reportPath)
  console.log(JSON.stringify(report, null, 2))
  if (runBlockers.length > 0) process.exitCode = 1
} catch (error) {
  const runBlockers = String(error?.message ?? error).split(",").filter(Boolean)
  const report = writeReport("r5_checkpoint_continuation_single_sample_overfit_smoke_execution_failed_stopped", runBlockers, manifest, [], child, { gpuBefore })
  writeTerminalRegistration(report)
  appendEvent("r5_checkpoint_continuation_smoke_execution_failed", "failed", runBlockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
} finally {
  if (lockHandle !== undefined) fs.closeSync(lockHandle)
  if (fs.existsSync(lockPath)) fs.rmSync(lockPath)
}

function validatePreflight() {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_authorization_hash_invalid")
  check(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_consumption_hash_invalid")
  check(fileHashMatches(TRAINER, TRAINER_SHA256), "r5_trainer_hash_invalid")
  check(fileHashMatches(SOURCE_CONFIG_PATH, SOURCE_CONFIG_SHA256), "r5_source_config_hash_invalid")
  check(fileHashMatches(SELECTION_CONTRACT_PATH, SELECTION_CONTRACT_SHA256), "r5_selection_contract_hash_invalid")
  check(fileHashMatches(PARENT_CHECKPOINT_PATH, PARENT_CHECKPOINT_SHA256), "r5_parent_checkpoint_hash_invalid")
  check(fileHashMatches(PARENT_MANIFEST_PATH, PARENT_MANIFEST_SHA256), "r5_parent_manifest_hash_invalid")
  check(authorization?.status === "resolved_owner_authorized", "r5_authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "r5_authorization_identity_invalid")
  check(consumption?.status === "consumed_before_authorized_write" && consumption?.authorizationSha256 === AUTHORIZATION_SHA256, "r5_authorization_not_consumed")
  check(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE, "r5_consumption_identity_invalid")
  for (const key of ["r5SmokeGateImplementationAuthorized", "checkpointLoadingAuthorized", "singleSampleGpuOverfitSmokeAuthorized", "fixedEpochPreviewGenerationAuthorized", "machinePreviewReviewAuthorized", "checkpointAndTokenEvidenceStorageAuthorized", "automaticTerminalStorageAuthorized"]) check(authorization?.resolution?.[key] === true, `r5_${key}_missing`)
  for (const key of ["automaticRetryAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) check(authorization?.resolution?.[key] === false, `r5_boundary_${key}_invalid`)
  check(selectionContract?.status === "r5_isolated_config_compiled_not_active_checkpoint_not_loaded_training_not_authorized", "r5_selection_contract_status_invalid")
  check(sourceConfig?.status === "isolated_r5_candidate_not_active", "r5_source_config_not_isolated")
  check(sourceConfig?.training?.boundedRepairVersion === "v7_bounded_repair_r5_candidate", "r5_source_config_version_invalid")
  check(sourceConfig?.training?.r5CheckpointContinuation?.sourceCheckpointPath === PARENT_CHECKPOINT_PATH, "r5_parent_checkpoint_path_binding_invalid")
  check(sourceConfig?.training?.r5CheckpointContinuation?.sourceCheckpointSha256 === PARENT_CHECKPOINT_SHA256, "r5_parent_checkpoint_hash_binding_invalid")
  check(sourceConfig?.training?.r5CheckpointContinuation?.loadingAuthorizedNow === false, "r5_source_config_checkpoint_loading_active")
  check(sourceConfig?.training?.denoiserEpochs === OVERFIT_EPOCHS, "r5_epoch_contract_invalid")
  check(sameJson(sourceConfig?.training?.smokeStabilityGate?.tailEpochs, REQUIRED_TAIL_EPOCHS), "r5_tail_epoch_contract_invalid")
  check(parentManifest?.checkpointSha256 === PARENT_CHECKPOINT_SHA256 && parentManifest?.trainingStage === "conditional_denoiser_single_sample_overfit_smoke", "r5_parent_manifest_identity_invalid")
  check(selectedRows.length === 64 && sameJson(splitCounts, EXPECTED_SPLITS), "r5_dataset_64_split_contract_invalid")
  check(Boolean(overfitRow), "r5_overfit_sample_missing")
  check(datasetManifest.packageId === authorization?.taskIdentity?.datasetPackageId, "r5_dataset_package_identity_invalid")
  check(fileHashMatches(datasetPointer.manifestPath, authorization?.taskIdentity?.datasetManifestSha256), "r5_dataset_manifest_hash_invalid")
  check(fileHashMatches(autoencoderPointer.checkpointPath, autoencoderPointer.checkpointSha256), "r5_autoencoder_checkpoint_invalid")
  check(fs.existsSync(PYTHON) && fs.existsSync(resolve(TRAINER)), "r5_training_runtime_missing")
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
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: resolve("ml/ai-painter/src") },
    windowsHide: true,
  })
}

function validateManifest(value) {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(value?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r5_smoke_manifest_status_invalid")
  check(value?.trainingStage === "conditional_denoiser_single_sample_overfit_smoke", "r5_smoke_training_stage_invalid")
  check(value?.singleSampleOverfitSmoke?.sampleId === EXPECTED_SAMPLE_ID, "r5_smoke_sample_identity_invalid")
  check(value?.singleSampleOverfitSmoke?.nonFormal === true, "r5_smoke_nonformal_boundary_invalid")
  check(value?.actualLoadedConditionalSampleCount === 64 && value?.actualLoadedV7CapacityCount === 64, "r5_smoke_capacity_invalid")
  check(sameJson(value?.actualLoadedSplitCounts, EXPECTED_SPLITS), "r5_smoke_split_invalid")
  check(value?.denoiserTrained === false && value?.formalInferenceEligible === false, "r5_smoke_promotion_boundary_invalid")
  check(value?.parentDenoiserCheckpointPath === PARENT_CHECKPOINT_PATH, "r5_smoke_parent_checkpoint_path_invalid")
  check(value?.parentDenoiserCheckpointSha256 === PARENT_CHECKPOINT_SHA256, "r5_smoke_parent_checkpoint_hash_invalid")
  check(value?.architectureVersion === sourceConfig.architectureVersion, "r5_smoke_architecture_invalid")
  check(value?.metrics?.at(-1)?.epoch === OVERFIT_EPOCHS, "r5_smoke_epoch_count_invalid")
  check(fileHashMatches(value?.checkpointPath, value?.checkpointSha256), "r5_smoke_checkpoint_hash_invalid")
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
    // libvips on Windows can reject an existing image once the absolute input
    // path exceeds the legacy MAX_PATH boundary. Keep the immutable original
    // as evidence and audit an exact-hash short-path copy.
    const shortInputPath = resolve(`.runtime/ai-painter/r5-review-inputs/${runId.slice(-24)}/e${String(epoch).padStart(3, "0")}.png`)
    const normalizedPath = path.join(runDir, "fixed-preview-review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    fs.mkdirSync(path.dirname(shortInputPath), { recursive: true })
    fs.mkdirSync(path.dirname(normalizedPath), { recursive: true })
    fs.copyFileSync(previewPath, shortInputPath, fs.constants.COPYFILE_EXCL)
    if (sha256File(shortInputPath) !== sha256File(previewPath)) throw new Error(`r5_review_short_path_copy_hash_mismatch_epoch_${epoch}`)
    await sharp(shortInputPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalizedPath),
      auditAiAssistedConditionAlignment({
        record: {
          recordId: `${runId}-${path.parse(fileName).name}`,
          conditionBinding: { conditionPackPath: overfitRow.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick },
          classification: overfitRow.classification,
        },
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
      shortPathReviewInputPath: projectPath(shortInputPath),
      shortPathReviewInputSha256: sha256File(shortInputPath),
      normalizedReviewImagePath: projectPath(normalizedPath),
      normalizedReviewImageSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  const tailStabilityGate = evaluateTailStability(reviews)
  const report = {
    schemaVersion: "ai-assisted-v7-r5-stage-preview-hard-gate-review-v1",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    status: reviews.length > 0 && reviews.every((review) => review.passed) && tailStabilityGate.passed ? "passed" : "failed",
    stage: 0,
    reviewCount: reviews.length,
    passCount: reviews.filter((review) => review.passed).length,
    failCount: reviews.filter((review) => !review.passed).length,
    tailStabilityGate,
    reviewThresholdPolicy: "unchanged_existing_machine_review_contract",
    reviews,
    nextStageStarted: false,
  }
  writeJson(path.join(runDir, "fixed-preview-hard-gate-review.json"), report)
  return reviews
}

function evaluateTailStability(reviews) {
  const byEpoch = new Map(reviews.map((row) => [row.epoch, row]))
  const evaluated = REQUIRED_TAIL_EPOCHS.map((epoch) => {
    const row = byEpoch.get(epoch)
    const issueCodes = row?.issueCodes ?? []
    return {
      epoch,
      recorded: Boolean(row),
      passed: Boolean(row?.passed && issueCodes.length === 0),
      pathIssueFree: !issueCodes.some((code) => code.includes("terrain_path_ground")),
      objectIssueFree: !issueCodes.some((code) => code.startsWith("condition_object_")),
      issueCodes,
    }
  })
  const passed = evaluated.length === 3 && evaluated.every((row) => row.recorded && row.passed && row.pathIssueFree && row.objectIssueFree)
  return { status: passed ? "r5_tail_stability_gate_passed" : "r5_tail_stability_gate_failed_closed", passed, requiredConsecutiveTailPasses: 3, evaluated }
}

function writeReport(status, blockers, currentManifest, reviews, processResult, metrics = {}) {
  const reportId = `ai-assisted-v7-r5-checkpoint-continuation-overfit-smoke-finalization-${suffix}`
  const reportPath = path.join(FINALIZATION_ROOT, reportId, "finalization-report.json")
  const previewReviewPath = path.join(runDir, "fixed-preview-hard-gate-review.json")
  const previewReviewExists = fs.existsSync(previewReviewPath)
  const report = {
    schemaVersion: "ai-assisted-v7-r5-checkpoint-continuation-overfit-smoke-finalization-v1",
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
    initialization: "project_r4_single_sample_checkpoint_continuation",
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
    previewReviewPath: previewReviewExists ? projectPath(previewReviewPath) : null,
    previewReviewSha256: previewReviewExists ? sha256File(previewReviewPath) : null,
    previewReviewStatus: previewReviewExists ? readJson(previewReviewPath).status : "not_created_due_to_prior_failure",
    previewCount: reviews.length,
    previewPassCount: reviews.filter((review) => review.passed).length,
    previewFailCount: reviews.filter((review) => !review.passed).length,
    metrics,
    blockers,
    process: processResult ? { exitCode: processResult.status, signal: processResult.signal, stdoutTail: String(processResult.stdout ?? "").slice(-32000), stderrTail: String(processResult.stderr ?? "").slice(-32000) } : null,
    checkpointLoaded: fs.existsSync(startRegistrationPath),
    gpuSmokeStarted: fs.existsSync(startRegistrationPath),
    automaticRetryStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticStorage: true,
  }
  writeJson(reportPath, report)
  const result = { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
  writeJson(path.join(FINALIZATION_ROOT, "latest.json"), result)
  return result
}

function writeTerminalRegistration(report) {
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true })
  const terminalPath = path.join(runDir, "run-terminal-registration.json")
  if (fs.existsSync(terminalPath)) return
  writeImmutableJson(terminalPath, {
    schemaVersion: "ai-assisted-v7-r5-smoke-run-terminal-registration-v1",
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
  appendEvent("r5_checkpoint_continuation_smoke_blocked", "blocked", blockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}
function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({ action: "run_ai_assisted_v7_r5_checkpoint_continuation_overfit_smoke", runId, kind, status, title: kind.replaceAll("_", " "), titleZh: `V7 R5 Checkpoint延续单样本Smoke：${kind}`, detail, detailZh: detail, script: "scripts/run-ai-assisted-v7-r5-checkpoint-continuation-overfit-smoke.mjs", currentStep: kind, evidencePath, finalGameMapSuccess: false, canEnterWorld: false })
}
function isV7CapacityRow(row) { return row.categoryId === "complete-maps" && row.v7CapacityContributionRegistered === true && row.ownerReviewStatus === "owner_approved" && row.machineReviewStatus === "passed" && row.formalConditionalTrainingEligible === true && row.conditionBound === true }
function countSplits(rows) { return Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])) }
function deepMerge(base, patch) { if (Array.isArray(patch)) return [...patch]; if (!patch || typeof patch !== "object") return patch; const result = { ...(base ?? {}) }; for (const [key, value] of Object.entries(patch)) result[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(result[key], value) : value; return result }
function readJson(value) { const absolute = resolve(value); return fs.existsSync(absolute) ? JSON.parse(fs.readFileSync(absolute, "utf8")) : null }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`, "utf8") }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return Boolean(fs.existsSync(absolute) && sha256File(absolute) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function gpuSnapshot() { const child = spawnSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"], { cwd: ROOT, encoding: "utf8", windowsHide: true }); if (child.status !== 0) return { available: false, stderr: child.stderr }; const [name, utilization, memoryUsed, memoryTotal, temperature] = child.stdout.trim().split(",").map((value) => value.trim()); return { available: true, name, utilizationPercent: Number(utilization), memoryUsedMiB: Number(memoryUsed), memoryTotalMiB: Number(memoryTotal), temperatureCelsius: Number(temperature) } }
