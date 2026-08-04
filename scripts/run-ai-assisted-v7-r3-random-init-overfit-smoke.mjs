import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { evaluateTailStability, readR3SmokeManifestMetrics } from "./lib/ai-assisted-v7-r3-candidate.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r3-candidate-overlay.json"
const CANDIDATE_SHA256 = "6c013e05a36c85646b18fde12b5573049be8ea1703c47899f54956d468a2a501"
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r3-run-registration-fix-retry-20260804/request.json"
const AUTHORIZATION_SHA256 = "5aa799eeb314e2ac6352603233712ae595ddec81707fb71c5b2bdd0f03bee83b"
const CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r3-run-registration-fix-retry-20260804/authorization-consumption.json"
const CONSUMPTION_SHA256 = "e4fa80e91dbc9897a49a3100b6f9629b61a20e723a74cbc20042388d4fccc3c2"
const COMMAND_REF = "owner-authorized-v7-r3-run-registration-fix-one-random-init-smoke-retry-20260804"
const SCOPE = "v7_r3_run_registration_directory_fix_and_one_random_init_smoke_retry_only"
const AUTHORIZATION_STATUS = "owner_authorized_v7_r3_single_sample_overfit_smoke"
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const OVERFIT_EPOCHS = 120
const EVALUATION_INTERVAL = 10
const EXPECTED_SEED = 20260722
const MODEL_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-conditional-denoiser-v7-repair-r3")
const FINALIZATION_ROOT = path.join(ROOT, ".runtime", "ai-painter", "v7-bounded-repair-r3-overfit-smoke-finalizations")
const preflightOnly = process.argv.includes("--preflight-only")
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const runId = `ai-assisted-v7-repair-r3-${preflightOnly ? "preflight" : "random-init-single-sample-overfit-smoke"}-${suffix}`
const runDir = path.join(MODEL_ROOT, runId)
const runStartRegistrationPath = path.join(MODEL_ROOT, "run-registrations", `${runId}-start.json`)
const derivedConfigPath = path.join(MODEL_ROOT, "derived-configs", `${runId}.json`)
const lockPath = path.join(MODEL_ROOT, ".random-init-single-sample-overfit-smoke.lock")

const candidate = readJson(CANDIDATE_PATH)
const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = readJson(datasetPointer.manifestPath)
const sourceIndex = readJson(datasetManifest.sourceIndexPath)
const autoencoderPointer = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const baseConfig = readJson(candidate.baseConfigPath)
const selectedRows = sourceIndex.samples.filter(isV7CapacityRow)
const splitCounts = countSplits(selectedRows)
const overfitRow = selectedRows.find((row) => row.split === "train" && row.conditionLabel === "v7-complete-map-146")
const authorizedPatch = {
  training: {
    trainingAuthorizationStatus: AUTHORIZATION_STATUS,
    authorizedOverfitSampleId: overfitRow?.sampleId ?? null,
    authorizedInitialization: "project_random_multiscale_denoiser",
    ownerTrainingAuthorization: {
      authorizationId: authorization.requestId,
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256: AUTHORIZATION_SHA256,
      authorizationConsumptionPath: CONSUMPTION_PATH,
      authorizationConsumptionSha256: CONSUMPTION_SHA256,
      status: AUTHORIZATION_STATUS,
      singleSampleGpuOverfitSmokeAuthorized: true,
      fullTrainingAuthorized: false,
      strictRevalidationAuthorized: false,
      formalInferenceAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
  },
}
const derivedConfig = deepMerge(deepMerge(baseConfig, candidate.patch), authorizedPatch)

const blockers = validatePreflight()
if (blockers.length > 0) finishBlocked(blockers)
fs.mkdirSync(path.dirname(derivedConfigPath), { recursive: true })
writeJson(derivedConfigPath, derivedConfig)
appendEvent("r3_random_init_overfit_smoke_preflight_started", "running", `preflightOnly=${preflightOnly}; seed=${EXPECTED_SEED}`)
const pythonPreflight = runTrainer(["--preflight-only"])
if (pythonPreflight.status !== 0) finishBlocked(["r3_python_preflight_failed"], pythonPreflight)
if (preflightOnly) {
  const report = writeReport("r3_random_init_preflight_passed_gpu_not_started", [], null, [], pythonPreflight)
  appendEvent("r3_random_init_overfit_smoke_preflight_completed", "success", "R3 Python preflight passed; GPU not started", report.reportPath)
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

const gpu = gpuSnapshot()
if (!gpu.available || gpu.utilizationPercent > 10 || gpu.memoryUsedMiB > 3000) {
  finishBlocked([
    !gpu.available ? "r3_gpu_telemetry_unavailable" : null,
    gpu.utilizationPercent > 10 ? "r3_gpu_compute_busy" : null,
    gpu.memoryUsedMiB > 3000 ? "r3_gpu_memory_busy" : null,
  ].filter(Boolean))
}

fs.mkdirSync(MODEL_ROOT, { recursive: true })
let lockHandle
try {
  lockHandle = fs.openSync(lockPath, "wx")
} catch {
  finishBlocked(["r3_random_init_single_sample_overfit_smoke_lock_active"])
}

let child = null
let manifest = null
try {
  const previous = readJson(path.join(FINALIZATION_ROOT, "latest.json"))
  if (previous?.authorizationSha256 === AUTHORIZATION_SHA256 && previous?.gpuSmokeStarted === true) {
    throw new Error("authorized_r3_random_init_gpu_smoke_already_started")
  }
  writeImmutableJson(runStartRegistrationPath, {
    schemaVersion: "ai-assisted-v7-r3-smoke-run-start-registration-v1",
    runId,
    status: "registered_before_training_start",
    registeredAtUtc: new Date().toISOString(),
    registeredAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    modelId: derivedConfig.modelId,
    datasetPackageId: datasetManifest.packageId,
    selectedSampleId: overfitRow.sampleId,
    selectedConditionLabel: overfitRow.conditionLabel,
    initialization: "project_random_multiscale_denoiser",
    seed: EXPECTED_SEED,
    parentCheckpointPath: null,
    resolutionStage: { width: 256, height: 192 },
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    fullTrainingAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    automaticStorage: true,
  })
  appendEvent("r3_random_init_single_sample_overfit_smoke_started", "running", `sample=${overfitRow.sampleId}; epochs=${OVERFIT_EPOCHS}; seed=${EXPECTED_SEED}; parentCheckpoint=none`)
  child = runTrainer([])
  if (child.status !== 0) throw new Error("r3_python_single_sample_overfit_smoke_failed")
  manifest = readJson(path.join(runDir, "manifest.json"))
  const manifestIssues = validateManifest(manifest)
  if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
  const reviews = await reviewPreviews()
  const tailStability = evaluateTailStability(reviews, derivedConfig.training.smokeStabilityGate)
  const evaluatedMetrics = manifest.metrics.filter((row) => row.validationCheckpointSelectionScore != null)
  const firstScore = evaluatedMetrics.at(0)?.validationCheckpointSelectionScore ?? null
  const finalScore = evaluatedMetrics.at(-1)?.validationCheckpointSelectionScore ?? null
  const qualityImproved = Number.isFinite(firstScore) && Number.isFinite(finalScore) && finalScore < firstScore
  const allPreviewHardGatePassed = reviews.length > 0 && reviews.every((review) => review.passed)
  const failureCodes = []
  if (!qualityImproved) failureCodes.push("single_sample_overfit_validation_score_did_not_improve")
  if (!allPreviewHardGatePassed) failureCodes.push("stage_0_preview_machine_hard_gate_failed")
  if (!tailStability.passed) failureCodes.push("r3_tail_three_consecutive_machine_passes_missing")
  const status = failureCodes.length === 0
    ? "r3_random_init_single_sample_overfit_smoke_passed_stopped"
    : "r3_random_init_single_sample_overfit_smoke_failed_stopped"
  const report = writeReport(status, failureCodes, manifest, reviews, child, {
    firstValidationCheckpointSelectionScore: firstScore,
    finalValidationCheckpointSelectionScore: finalScore,
    qualityImproved,
    allPreviewHardGatePassed,
    tailStability,
  })
  writeTerminalRegistration(report)
  appendEvent(
    failureCodes.length === 0 ? "r3_random_init_single_sample_overfit_smoke_completed" : "r3_random_init_single_sample_overfit_smoke_failed",
    failureCodes.length === 0 ? "success" : "failed",
    `${status}; full training not started`,
    report.reportPath,
  )
  console.log(JSON.stringify(report, null, 2))
  if (failureCodes.length > 0) process.exitCode = 1
} catch (error) {
  const reasons = String(error?.message ?? error).split(",").filter(Boolean)
  const report = writeReport("r3_random_init_single_sample_overfit_smoke_execution_failed_stopped", reasons, manifest, [], child)
  writeTerminalRegistration(report)
  appendEvent("r3_random_init_single_sample_overfit_smoke_execution_failed", "failed", reasons.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
} finally {
  if (lockHandle !== undefined) fs.closeSync(lockHandle)
  if (fs.existsSync(lockPath)) fs.rmSync(lockPath)
}

function validatePreflight() {
  const issues = []
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r3_authorization_hash_invalid")
  check(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r3_authorization_consumption_hash_invalid")
  check(fileHashMatches(CANDIDATE_PATH, CANDIDATE_SHA256), "r3_candidate_hash_invalid")
  check(authorization?.status === "resolved_owner_authorized", "r3_authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === COMMAND_REF, "r3_authorization_command_invalid")
  check(authorization?.ownerDecision?.scope === SCOPE, "r3_authorization_scope_invalid")
  check(consumption?.status === "consumed_before_authorized_write", "r3_authorization_not_consumed_before_write")
  check(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE, "r3_consumption_identity_invalid")
  check(authorization?.resolution?.singleSampleGpuOverfitSmokeRetryAuthorized === true, "r3_gpu_smoke_retry_not_authorized")
  check(authorization?.resolution?.runRegistrationDirectoryFixAuthorized === true, "r3_run_registration_fix_not_authorized")
  check(authorization?.resolution?.parentCheckpointLoadingAuthorized === false, "r3_parent_checkpoint_boundary_invalid")
  for (const key of ["fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    check(authorization?.resolution?.[key] === false, `r3_boundary_${key}_invalid`)
  }
  check(fileHashMatches(candidate.baseConfigPath, candidate.baseConfigSha256), "r3_base_config_hash_invalid")
  check(candidate.patch?.training?.boundedRepairVersion === "v7_bounded_repair_r3_candidate", "r3_candidate_version_invalid")
  check(candidate.patch?.training?.smokeStabilityGate?.requiredConsecutiveTailPasses === 3, "r3_tail_gate_contract_invalid")
  check(sameJson(candidate.patch?.training?.smokeStabilityGate?.tailEpochs, [100, 110, 120]), "r3_tail_epochs_invalid")
  check(selectedRows.length === 64 && sameJson(splitCounts, EXPECTED_SPLITS), "r3_dataset_64_split_contract_invalid")
  check(Boolean(overfitRow), "r3_overfit_sample_missing")
  check(derivedConfig.training.seed === EXPECTED_SEED, "r3_random_seed_mismatch")
  check(derivedConfig.training.authorizedInitialization === "project_random_multiscale_denoiser", "r3_random_initialization_contract_missing")
  check(fs.existsSync(PYTHON) && fs.existsSync(TRAINER), "r3_training_runtime_missing")
  check(fileHashMatches(autoencoderPointer.checkpointPath, autoencoderPointer.checkpointSha256), "r3_autoencoder_checkpoint_invalid")
  return issues
  function check(condition, code) { if (!condition) issues.push(code) }
}

function runTrainer(extra) {
  return spawnSync(PYTHON, [
    TRAINER,
    "--config", derivedConfigPath,
    "--dataset-package", path.resolve(ROOT, datasetPointer.manifestPath),
    "--autoencoder-checkpoint", path.resolve(ROOT, autoencoderPointer.checkpointPath),
    "--output-dir", runDir,
    "--resolution-stage", "0",
    "--single-sample-overfit-smoke",
    "--overfit-sample-id", overfitRow.sampleId,
    "--overfit-epochs", String(OVERFIT_EPOCHS),
    "--overfit-evaluation-interval", String(EVALUATION_INTERVAL),
    ...extra,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
  })
}

function validateManifest(value) {
  const issues = []
  check(value?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r3_smoke_manifest_status_invalid")
  check(value?.trainingStage === "conditional_denoiser_single_sample_overfit_smoke", "r3_smoke_training_stage_invalid")
  check(value?.singleSampleOverfitSmoke?.sampleId === overfitRow.sampleId, "r3_smoke_sample_identity_invalid")
  check(value?.singleSampleOverfitSmoke?.nonFormal === true, "r3_smoke_nonformal_boundary_invalid")
  check(value?.actualLoadedConditionalSampleCount === 64 && value?.actualLoadedV7CapacityCount === 64, "r3_smoke_capacity_invalid")
  check(sameJson(value?.actualLoadedSplitCounts, EXPECTED_SPLITS), "r3_smoke_split_invalid")
  check(value?.denoiserTrained === false && value?.formalInferenceEligible === false, "r3_smoke_promotion_boundary_invalid")
  check(value?.parentDenoiserCheckpointPath == null && value?.parentDenoiserCheckpointSha256 == null, "r3_smoke_random_initialization_invalid")
  check(value?.metrics?.at(-1)?.epoch === OVERFIT_EPOCHS, "r3_smoke_epoch_count_invalid")
  const finalMetric = value?.metrics?.at(-1) ?? {}
  const mappedMetrics = readR3SmokeManifestMetrics(finalMetric)
  for (const key of mappedMetrics.missing) check(false, `r3_smoke_metric_missing_${key}`)
  check(fileHashMatches(value?.checkpointPath, value?.checkpointSha256), "r3_smoke_checkpoint_hash_invalid")
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
  const gate = evaluateTailStability(reviews, derivedConfig.training.smokeStabilityGate)
  writeJson(path.join(runDir, "fixed-preview-hard-gate-review.json"), {
    schemaVersion: "ai-assisted-v7-r3-stage-preview-hard-gate-review-v1",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    status: reviews.length > 0 && reviews.every((review) => review.passed) && gate.passed ? "passed" : "failed",
    stage: 0,
    reviewCount: reviews.length,
    passCount: reviews.filter((review) => review.passed).length,
    failCount: reviews.filter((review) => !review.passed).length,
    tailStabilityGate: gate,
    reviewThresholdPolicy: "unchanged_existing_machine_review_contract",
    reviews,
    nextStageStarted: false,
  })
  return reviews
}

function writeReport(status, blockers, currentManifest, reviews, processResult, metrics = {}) {
  const reportId = `ai-assisted-v7-r3-random-init-overfit-smoke-finalization-${suffix}`
  const reportPath = path.join(FINALIZATION_ROOT, reportId, "finalization-report.json")
  const previewReviewAbsolutePath = path.join(runDir, "fixed-preview-hard-gate-review.json")
  const previewReviewExists = fs.existsSync(previewReviewAbsolutePath)
  const report = {
    schemaVersion: "ai-assisted-v7-r3-random-init-overfit-smoke-finalization-v1",
    reportId,
    status,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    runId,
    preflightOnly,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    candidatePath: CANDIDATE_PATH,
    candidateSha256: CANDIDATE_SHA256,
    initialization: "project_random_multiscale_denoiser",
    seed: EXPECTED_SEED,
    parentCheckpointPath: null,
    selectedSampleId: overfitRow?.sampleId ?? null,
    selectedConditionLabel: overfitRow?.conditionLabel ?? null,
    epochCount: OVERFIT_EPOCHS,
    evaluationInterval: EVALUATION_INTERVAL,
    manifestPath: currentManifest ? projectPath(path.join(runDir, "manifest.json")) : null,
    manifestSha256: currentManifest ? sha256File(path.join(runDir, "manifest.json")) : null,
    checkpointPath: currentManifest?.checkpointPath ?? null,
    checkpointSha256: currentManifest?.checkpointSha256 ?? null,
    previewReviewPath: previewReviewExists ? projectPath(previewReviewAbsolutePath) : null,
    previewReviewSha256: previewReviewExists ? sha256File(previewReviewAbsolutePath) : null,
    previewReviewStatus: previewReviewExists ? readJson(previewReviewAbsolutePath)?.status : "not_created_due_to_prior_failure",
    previewCount: reviews.length,
    previewPassCount: reviews.filter((review) => review.passed).length,
    previewFailCount: reviews.filter((review) => !review.passed).length,
    metrics,
    blockers,
    process: processResult ? { exitCode: processResult.status, signal: processResult.signal, stdout: processResult.stdout, stderr: processResult.stderr } : null,
    gpuSmokeStarted: !preflightOnly,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
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
    schemaVersion: "ai-assisted-v7-r3-smoke-run-terminal-registration-v1",
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
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticStorage: true,
  })
}

function finishBlocked(blockers, child = null) {
  const report = writeReport("r3_random_init_overfit_smoke_blocked", blockers, null, [], child)
  appendEvent("r3_random_init_overfit_smoke_blocked", "blocked", blockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_ai_assisted_v7_r3_random_init_overfit_smoke",
    runId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `V7 R3随机初始化单样本Smoke：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/run-ai-assisted-v7-r3-random-init-overfit-smoke.mjs",
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
  for (const [key, value] of Object.entries(patch)) result[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(result[key], value) : value
  return result
}
function readJson(value) { const resolved = resolvePath(value); return resolved && fs.existsSync(resolved) ? JSON.parse(fs.readFileSync(resolved, "utf8")) : null }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`, "utf8") }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8") } finally { fs.closeSync(handle) } }
function resolvePath(value) { return value ? (path.isAbsolute(value) ? value : path.resolve(ROOT, value)) : null }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex") }
function fileHashMatches(value, expected) { const resolved = resolvePath(value); return Boolean(resolved && fs.existsSync(resolved) && sha256File(resolved) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function gpuSnapshot() {
  const child = spawnSync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"], { cwd: ROOT, encoding: "utf8", windowsHide: true })
  if (child.status !== 0) return { available: false, stderr: child.stderr }
  const [name, utilization, memoryUsed, memoryTotal, temperature] = child.stdout.trim().split(",").map((value) => value.trim())
  return { available: true, name, utilizationPercent: Number(utilization), memoryUsedMiB: Number(memoryUsed), memoryTotalMiB: Number(memoryTotal), temperatureCelsius: Number(temperature) }
}
