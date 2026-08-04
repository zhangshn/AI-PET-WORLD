import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { readR3SmokeManifestMetrics } from "./lib/ai-assisted-v7-r3-candidate.mjs"
import { evaluateR4TailStability } from "./lib/ai-assisted-v7-r4-candidate.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = resolve("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = resolve("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const CANDIDATE_CONTRACT_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r4-isolated-smoke-candidate-contract.json"
const CANDIDATE_CONTRACT_SHA256 = "7e09f07b329c158d0fc5a60c52a77734a85f387b1779bbecb111073e0ffa04a6"
const COMPILED_CONFIG_PATH = ".runtime/ai-painter/local-ai-v7-r4-smoke-configurations/local-ai-v7-r4-smoke-config-2026-08-04T07-27-25-970Z/r4-isolated-single-sample-smoke-config.json"
const COMPILED_CONFIG_SHA256 = "bd57ef3fa80417af0823c6f9c171644548e8dedf181b1716d2be5029967bfff4"
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r4-single-sample-gpu-smoke-20260804/request.json"
const AUTHORIZATION_SHA256 = "02a147ab7c3f47595abcdd6f61456b5d7339914585b86fd5a37b405beff2b782"
const CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r4-single-sample-gpu-smoke-20260804/authorization-consumption.json"
const CONSUMPTION_SHA256 = "62f3a190a04f01e2c75a55eec5c6fc6e70df151a55e217ddef8451a284f2a6de"
const REQUEST_ID = "owner-action-request-v7-r4-single-sample-gpu-smoke-20260804"
const COMMAND_REF = "owner-authorized-one-v7-r4-single-sample-gpu-overfit-smoke-20260804"
const SCOPE = "one_v7_r4_random_init_single_sample_gpu_overfit_smoke_with_preview_review_and_terminal_only"
const AUTHORIZATION_STATUS = "owner_authorized_v7_r4_single_sample_overfit_smoke"
const EXPECTED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const EXPECTED_CONDITION_LABEL = "v7-complete-map-146"
const EXPECTED_SEED = 20260722
const OVERFIT_EPOCHS = 120
const EVALUATION_INTERVAL = 10
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const MODEL_ROOT = resolve(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r4")
const FINALIZATION_ROOT = resolve(".runtime/ai-painter/v7-bounded-repair-r4-overfit-smoke-finalizations")
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const runId = `ai-assisted-v7-repair-r4-random-init-single-sample-overfit-smoke-${suffix}`
const runDir = path.join(MODEL_ROOT, runId)
const derivedConfigPath = path.join(MODEL_ROOT, "derived-configs", `${runId}.json`)
const startRegistrationPath = path.join(MODEL_ROOT, "run-registrations", `${REQUEST_ID}.json`)
const lockPath = path.join(MODEL_ROOT, ".random-init-single-sample-overfit-smoke.lock")

const candidateContract = readJson(CANDIDATE_CONTRACT_PATH)
const sourceConfig = readJson(COMPILED_CONFIG_PATH)
const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = readJson(datasetPointer.manifestPath)
const sourceIndex = readJson(datasetManifest.sourceIndexPath)
const autoencoderPointer = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const selectedRows = sourceIndex.samples.filter(isV7CapacityRow)
const splitCounts = countSplits(selectedRows)
const overfitRow = selectedRows.find((row) => row.sampleId === EXPECTED_SAMPLE_ID && row.conditionLabel === EXPECTED_CONDITION_LABEL && row.split === "train")
const authorizedPatch = {
  training: {
    trainingAuthorizationStatus: AUTHORIZATION_STATUS,
    authorizedOverfitSampleId: EXPECTED_SAMPLE_ID,
    authorizedInitialization: "project_random_multiscale_denoiser",
    r4SmokeCandidateContract: {
      status: "owner_authorized_single_gpu_smoke_execution",
      gpuSmokeAuthorized: true,
    },
    ownerTrainingAuthorization: {
      authorizationId: REQUEST_ID,
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256: AUTHORIZATION_SHA256,
      authorizationConsumptionPath: CONSUMPTION_PATH,
      authorizationConsumptionSha256: CONSUMPTION_SHA256,
      candidateContractPath: CANDIDATE_CONTRACT_PATH,
      candidateContractSha256: CANDIDATE_CONTRACT_SHA256,
      sourceCompiledConfigPath: COMPILED_CONFIG_PATH,
      sourceCompiledConfigSha256: COMPILED_CONFIG_SHA256,
      status: AUTHORIZATION_STATUS,
      gpuTrainingAuthorizedNow: true,
      singleSampleGpuOverfitSmokeAuthorized: true,
      automaticRetryAuthorized: false,
      parentCheckpointLoadingAuthorized: false,
      fullTrainingAuthorized: false,
      strictRevalidationAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      checkpointPromotionAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
  },
}
const derivedConfig = deepMerge(sourceConfig, authorizedPatch)

const preflightBlockers = validatePreflight()
if (preflightBlockers.length > 0) finishBlocked("r4_random_init_overfit_smoke_preflight_blocked", preflightBlockers)
fs.mkdirSync(path.dirname(derivedConfigPath), { recursive: true })
writeImmutableJson(derivedConfigPath, derivedConfig)
appendEvent("r4_random_init_overfit_smoke_preflight_started", "running", `sample=${EXPECTED_SAMPLE_ID}; seed=${EXPECTED_SEED}; training=false`)
const pythonPreflight = runTrainer(["--preflight-only"])
if (pythonPreflight.status !== 0) {
  finishBlocked("r4_random_init_overfit_smoke_python_preflight_failed", ["r4_python_preflight_failed"], pythonPreflight)
}
appendEvent("r4_random_init_overfit_smoke_preflight_completed", "success", "R4 Python preflight passed; GPU not started")

const gpuBefore = gpuSnapshot()
if (!gpuBefore.available || gpuBefore.utilizationPercent > 10 || gpuBefore.memoryUsedMiB > 3000) {
  finishBlocked("r4_random_init_overfit_smoke_gpu_blocked", [
    !gpuBefore.available ? "r4_gpu_telemetry_unavailable" : null,
    gpuBefore.utilizationPercent > 10 ? "r4_gpu_compute_busy" : null,
    gpuBefore.memoryUsedMiB > 3000 ? "r4_gpu_memory_busy" : null,
  ].filter(Boolean), pythonPreflight, { gpuBefore })
}
if (fs.existsSync(startRegistrationPath)) {
  finishBlocked("r4_random_init_overfit_smoke_already_consumed", ["authorized_r4_gpu_smoke_already_started"], pythonPreflight, { gpuBefore })
}
fs.mkdirSync(MODEL_ROOT, { recursive: true })
let lockHandle
try {
  lockHandle = fs.openSync(lockPath, "wx")
} catch {
  finishBlocked("r4_random_init_overfit_smoke_lock_blocked", ["r4_random_init_single_sample_overfit_smoke_lock_active"], pythonPreflight, { gpuBefore })
}

let child = null
let manifest = null
try {
  writeImmutableJson(startRegistrationPath, {
    schemaVersion: "ai-assisted-v7-r4-smoke-run-start-registration-v1",
    runId,
    requestId: REQUEST_ID,
    status: "registered_before_gpu_training_start",
    registeredAtUtc: new Date().toISOString(),
    registeredAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    modelId: derivedConfig.modelId,
    datasetPackageId: datasetManifest.packageId,
    selectedSampleId: EXPECTED_SAMPLE_ID,
    selectedConditionLabel: EXPECTED_CONDITION_LABEL,
    initialization: "project_random_multiscale_denoiser",
    seed: EXPECTED_SEED,
    parentCheckpointPath: null,
    resolutionStage: { index: 0, width: 256, height: 192 },
    epochCount: OVERFIT_EPOCHS,
    evaluationInterval: EVALUATION_INTERVAL,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    sourceCompiledConfigPath: COMPILED_CONFIG_PATH,
    sourceCompiledConfigSha256: COMPILED_CONFIG_SHA256,
    derivedConfigPath: projectPath(derivedConfigPath),
    derivedConfigSha256: sha256File(derivedConfigPath),
    automaticRetryAuthorized: false,
    fullTrainingAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  })
  appendEvent("r4_random_init_single_sample_overfit_smoke_started", "running", `sample=${EXPECTED_SAMPLE_ID}; epochs=${OVERFIT_EPOCHS}; seed=${EXPECTED_SEED}; parentCheckpoint=none`)
  child = runTrainer([])
  if (child.status !== 0) throw new Error("r4_python_single_sample_overfit_smoke_failed")
  manifest = readJson(path.join(runDir, "manifest.json"))
  const manifestIssues = validateManifest(manifest)
  if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
  const reviews = await reviewPreviews()
  const tailStability = evaluateR4TailStability(reviews, derivedConfig.training)
  const evaluatedMetrics = manifest.metrics.filter((row) => row.validationCheckpointSelectionScore != null)
  const firstScore = evaluatedMetrics.at(0)?.validationCheckpointSelectionScore ?? null
  const finalScore = evaluatedMetrics.at(-1)?.validationCheckpointSelectionScore ?? null
  const qualityImproved = Number.isFinite(firstScore) && Number.isFinite(finalScore) && finalScore < firstScore
  const allPreviewHardGatePassed = reviews.length > 0 && reviews.every((review) => review.passed)
  const blockers = []
  if (!qualityImproved) blockers.push("single_sample_overfit_validation_score_did_not_improve")
  if (!allPreviewHardGatePassed) blockers.push("stage_0_preview_machine_hard_gate_failed")
  if (!tailStability.passed) blockers.push("r4_tail_three_consecutive_zero_recurrence_passes_missing")
  const status = blockers.length === 0
    ? "r4_random_init_single_sample_overfit_smoke_passed_stopped"
    : "r4_random_init_single_sample_overfit_smoke_failed_stopped"
  const report = writeReport(status, blockers, manifest, reviews, child, {
    gpuBefore,
    firstValidationCheckpointSelectionScore: firstScore,
    finalValidationCheckpointSelectionScore: finalScore,
    qualityImproved,
    allPreviewHardGatePassed,
    tailStability,
  })
  writeTerminalRegistration(report)
  appendEvent(
    blockers.length === 0 ? "r4_random_init_single_sample_overfit_smoke_completed" : "r4_random_init_single_sample_overfit_smoke_failed",
    blockers.length === 0 ? "success" : "failed",
    `${status}; automatic retry=false; full training=false`,
    report.reportPath,
  )
  console.log(JSON.stringify(report, null, 2))
  if (blockers.length > 0) process.exitCode = 1
} catch (error) {
  const blockers = String(error?.message ?? error).split(",").filter(Boolean)
  const report = writeReport("r4_random_init_single_sample_overfit_smoke_execution_failed_stopped", blockers, manifest, [], child, { gpuBefore })
  writeTerminalRegistration(report)
  appendEvent("r4_random_init_single_sample_overfit_smoke_execution_failed", "failed", blockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
} finally {
  if (lockHandle !== undefined) fs.closeSync(lockHandle)
  if (fs.existsSync(lockPath)) fs.rmSync(lockPath)
}

function validatePreflight() {
  const issues = []
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r4_authorization_hash_invalid")
  check(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r4_consumption_hash_invalid")
  check(fileHashMatches(CANDIDATE_CONTRACT_PATH, CANDIDATE_CONTRACT_SHA256), "r4_candidate_contract_hash_invalid")
  check(fileHashMatches(COMPILED_CONFIG_PATH, COMPILED_CONFIG_SHA256), "r4_compiled_config_hash_invalid")
  check(authorization?.status === "resolved_owner_authorized", "r4_authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "r4_authorization_identity_invalid")
  check(consumption?.status === "consumed_before_authorized_write", "r4_authorization_not_consumed")
  check(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE, "r4_consumption_identity_invalid")
  for (const key of ["singleSampleGpuOverfitSmokeAuthorized", "fixedEpochPreviewGenerationAuthorized", "machinePreviewReviewAuthorized", "checkpointAndTokenEvidenceStorageAuthorized", "automaticTerminalStorageAuthorized"]) {
    check(authorization?.resolution?.[key] === true, `r4_${key}_missing`)
  }
  for (const key of ["automaticRetryAuthorized", "parentCheckpointLoadingAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    check(authorization?.resolution?.[key] === false, `r4_boundary_${key}_invalid`)
  }
  check(candidateContract?.status === "compiled_cpu_verified_isolated_not_active_gpu_smoke_not_authorized", "r4_candidate_contract_status_invalid")
  check(sourceConfig?.training?.boundedRepairVersion === "v7_bounded_repair_r4_candidate", "r4_compiled_config_version_invalid")
  check(sourceConfig?.training?.trainingAuthorizationStatus === "not_authorized_candidate_only", "r4_source_config_not_isolated")
  check(sourceConfig?.training?.denoiserLossWeights?.pathInteriorRgb === 2, "r4_path_interior_weight_invalid")
  check(sourceConfig?.training?.denoiserLossWeights?.pathForbiddenBoundaryRgb === 2, "r4_path_forbidden_weight_invalid")
  check(derivedConfig?.training?.seed === EXPECTED_SEED, "r4_seed_invalid")
  check(derivedConfig?.training?.r4SmokeCandidateContract?.plannedEpochs === OVERFIT_EPOCHS, "r4_epoch_contract_invalid")
  check(derivedConfig?.training?.r4SmokeCandidateContract?.plannedEvaluationInterval === EVALUATION_INTERVAL, "r4_evaluation_interval_invalid")
  check(sameJson(derivedConfig?.training?.r4SmokeCandidateContract?.requiredTailEpochs, [100, 110, 120]), "r4_tail_epoch_contract_invalid")
  check(selectedRows.length === 64 && sameJson(splitCounts, EXPECTED_SPLITS), "r4_dataset_64_split_contract_invalid")
  check(Boolean(overfitRow), "r4_overfit_sample_missing")
  check(datasetManifest.packageId === authorization?.taskIdentity?.datasetPackageId, "r4_dataset_package_identity_invalid")
  check(fileHashMatches(datasetPointer.manifestPath, authorization?.taskIdentity?.datasetManifestSha256), "r4_dataset_manifest_hash_invalid")
  check(fileHashMatches(autoencoderPointer.checkpointPath, autoencoderPointer.checkpointSha256), "r4_autoencoder_checkpoint_invalid")
  check(fs.existsSync(PYTHON) && fs.existsSync(TRAINER), "r4_training_runtime_missing")
  return issues
  function check(condition, code) { if (!condition) issues.push(code) }
}

function runTrainer(extra) {
  return spawnSync(PYTHON, [
    TRAINER,
    "--config", derivedConfigPath,
    "--dataset-package", resolve(datasetPointer.manifestPath),
    "--autoencoder-checkpoint", resolve(autoencoderPointer.checkpointPath),
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
  check(value?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r4_smoke_manifest_status_invalid")
  check(value?.trainingStage === "conditional_denoiser_single_sample_overfit_smoke", "r4_smoke_training_stage_invalid")
  check(value?.singleSampleOverfitSmoke?.sampleId === EXPECTED_SAMPLE_ID, "r4_smoke_sample_identity_invalid")
  check(value?.singleSampleOverfitSmoke?.nonFormal === true, "r4_smoke_nonformal_boundary_invalid")
  check(value?.actualLoadedConditionalSampleCount === 64 && value?.actualLoadedV7CapacityCount === 64, "r4_smoke_capacity_invalid")
  check(sameJson(value?.actualLoadedSplitCounts, EXPECTED_SPLITS), "r4_smoke_split_invalid")
  check(value?.denoiserTrained === false && value?.formalInferenceEligible === false, "r4_smoke_promotion_boundary_invalid")
  check(value?.parentDenoiserCheckpointPath == null && value?.parentDenoiserCheckpointSha256 == null, "r4_smoke_random_initialization_invalid")
  check(value?.metrics?.at(-1)?.epoch === OVERFIT_EPOCHS, "r4_smoke_epoch_count_invalid")
  const mappedMetrics = readR3SmokeManifestMetrics(value?.metrics?.at(-1) ?? {})
  for (const key of mappedMetrics.missing) check(false, `r4_smoke_metric_missing_${key}`)
  check(fileHashMatches(value?.checkpointPath, value?.checkpointSha256), "r4_smoke_checkpoint_hash_invalid")
  return issues
  function check(condition, code) { if (!condition) issues.push(code) }
}

async function reviewPreviews() {
  const previewRoot = path.join(runDir, "fixed-epoch-previews")
  const files = fs.existsSync(previewRoot) ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort() : []
  const reviews = []
  for (const fileName of files) {
    const previewPath = path.join(previewRoot, fileName)
    const epoch = Number(fileName.match(/^epoch-(\d+)/)?.[1] ?? 0)
    const normalizedPath = path.join(runDir, "fixed-preview-review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    fs.mkdirSync(path.dirname(normalizedPath), { recursive: true })
    await sharp(previewPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPath)
    const conditionPack = readJson(overfitRow.conditionPackPath)
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
      normalizedReviewImagePath: projectPath(normalizedPath),
      normalizedReviewImageSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  const tailStabilityGate = evaluateR4TailStability(reviews, derivedConfig.training)
  const report = {
    schemaVersion: "ai-assisted-v7-r4-stage-preview-hard-gate-review-v1",
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

function writeReport(status, blockers, currentManifest, reviews, processResult, metrics = {}) {
  const reportId = `ai-assisted-v7-r4-random-init-overfit-smoke-finalization-${suffix}`
  const reportPath = path.join(FINALIZATION_ROOT, reportId, "finalization-report.json")
  const previewReviewPath = path.join(runDir, "fixed-preview-hard-gate-review.json")
  const previewReviewExists = fs.existsSync(previewReviewPath)
  const report = {
    schemaVersion: "ai-assisted-v7-r4-random-init-overfit-smoke-finalization-v1",
    reportId,
    status,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    runId,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    candidateContractPath: CANDIDATE_CONTRACT_PATH,
    candidateContractSha256: CANDIDATE_CONTRACT_SHA256,
    sourceCompiledConfigPath: COMPILED_CONFIG_PATH,
    sourceCompiledConfigSha256: COMPILED_CONFIG_SHA256,
    derivedConfigPath: fs.existsSync(derivedConfigPath) ? projectPath(derivedConfigPath) : null,
    derivedConfigSha256: fs.existsSync(derivedConfigPath) ? sha256File(derivedConfigPath) : null,
    initialization: "project_random_multiscale_denoiser",
    seed: EXPECTED_SEED,
    parentCheckpointPath: null,
    selectedSampleId: EXPECTED_SAMPLE_ID,
    selectedConditionLabel: EXPECTED_CONDITION_LABEL,
    epochCount: OVERFIT_EPOCHS,
    evaluationInterval: EVALUATION_INTERVAL,
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
    process: processResult ? {
      exitCode: processResult.status,
      signal: processResult.signal,
      stdoutTail: String(processResult.stdout ?? "").slice(-32000),
      stderrTail: String(processResult.stderr ?? "").slice(-32000),
    } : null,
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
  writeImmutableJson(path.join(runDir, "run-terminal-registration.json"), {
    schemaVersion: "ai-assisted-v7-r4-smoke-run-terminal-registration-v1",
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
  appendEvent("r4_random_init_overfit_smoke_blocked", "blocked", blockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_ai_assisted_v7_r4_random_init_overfit_smoke",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `V7 R4随机初始化单样本Smoke：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-ai-assisted-v7-r4-random-init-overfit-smoke.mjs",
    currentStep: kind,
    evidencePath,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}

function isV7CapacityRow(row) {
  return row.categoryId === "complete-maps"
    && row.v7CapacityContributionRegistered === true
    && row.ownerReviewStatus === "owner_approved"
    && row.machineReviewStatus === "passed"
    && row.formalConditionalTrainingEligible === true
    && row.conditionBound === true
}
function countSplits(rows) { return Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])) }
function deepMerge(base, patch) {
  if (Array.isArray(patch)) return [...patch]
  if (!patch || typeof patch !== "object") return patch
  const result = { ...(base ?? {}) }
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(result[key], value) : value
  }
  return result
}
function readJson(value) { const absolute = resolve(value); return fs.existsSync(absolute) ? JSON.parse(fs.readFileSync(absolute, "utf8")) : null }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`, "utf8") }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return Boolean(fs.existsSync(absolute) && sha256File(absolute) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function gpuSnapshot() {
  const child = spawnSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"], { cwd: ROOT, encoding: "utf8", windowsHide: true })
  if (child.status !== 0) return { available: false, stderr: child.stderr }
  const [name, utilization, memoryUsed, memoryTotal, temperature] = child.stdout.trim().split(",").map((value) => value.trim())
  return { available: true, name, utilizationPercent: Number(utilization), memoryUsedMiB: Number(memoryUsed), memoryTotalMiB: Number(memoryTotal), temperatureCelsius: Number(temperature) }
}
