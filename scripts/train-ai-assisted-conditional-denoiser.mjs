import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai as formatProgramEventShanghai,
  projectPath as programEventProjectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const V7_DATASET_REPAIR_AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-mvp64-training-sample-binding-repair-retrain-resolution-20260802/request.json"
const V7_DATASET_REPAIR_AUTHORIZATION_SHA256 = "3ecebd96908852b3888a7327a40b3cb38b2f0a5a6f9b3b6ddbd2f67aa4db554e"
const engineeringMode = process.argv.includes("--engineering-26")
const useV7 = process.argv.includes("--v7")
const useV6 = process.argv.includes("--v6")
const useV5 = process.argv.includes("--v5")
const selectedModeCount = [engineeringMode, useV7, useV6, useV5].filter(Boolean).length
if (selectedModeCount > 1) throw new Error("only one model-version flag may be used")
const modelVersion = engineeringMode ? "v7-engineering-26" : (useV7 ? "v7" : (useV6 ? "v6" : (useV5 ? "v5" : "v4")))
const CONFIG = path.join(ROOT, "ml", "ai-painter", "config", `complete-world-ai-assisted-cold-start-${modelVersion}.json`)
const AUTOENCODER_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-model-ai-assisted-v2")
const MODEL_ROOT = engineeringMode
  ? path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-v7-engineering-pretraining")
  : path.join(ROOT, ".runtime", "ai-painter", `project-owned-complete-world-conditional-denoiser-${modelVersion}`)
const modelConfig = readJson(CONFIG)
const v7TrainingAuthorization = useV7
  ? readJson(modelConfig?.training?.ownerTrainingAuthorization?.authorizationPath)
  : null
const v7DatasetRepairAuthorization = useV7
  ? readJson(V7_DATASET_REPAIR_AUTHORIZATION_PATH)
  : null
const v7CapacityPointer = useV7
  ? readJson(".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json")
  : null
const v7CapacityPlan = useV7 && v7CapacityPointer?.capacityPlanPath
  ? readJson(v7CapacityPointer.capacityPlanPath)
  : null
const datasetPointer = readJson(engineeringMode
  ? "data/world-samples/ai-assisted-v7-engineering-pretraining-datasets/latest.json"
  : "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = datasetPointer?.manifestPath ? readJson(datasetPointer.manifestPath) : null
const datasetSourceIndex = datasetManifest?.sourceIndexPath ? readJson(datasetManifest.sourceIndexPath) : null
const actualV7LoadedRows = useV7
  ? (datasetSourceIndex?.samples ?? []).filter(isV7RegisteredConditionalRow)
  : []
const actualV7LoadedSplitCounts = countSplits(actualV7LoadedRows)
const timestamp = new Date().toISOString()
const smokeTest = process.argv.includes("--smoke-test")
const preflightOnly = process.argv.includes("--preflight-only")
const resolutionStage = readResolutionStage(process.argv.slice(2))
const runId = `ai-assisted-conditional-denoiser-${modelVersion}-${preflightOnly ? "preflight" : smokeTest ? "smoke" : `stage-${resolutionStage}`}-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(MODEL_ROOT, runId)
const autoencoderCheckpoint = findAutoencoderCheckpoint()
const parentDenoiserCheckpoint = resolutionStage > 0 && !smokeTest
  ? findPreviousDenoiserCheckpoint(resolutionStage)
  : null

const blockers = []
if (!datasetManifest) blockers.push("ai_assisted_dataset_package_missing")
if (datasetManifest?.canTrainConditionalDenoiser !== true) blockers.push("ai_assisted_conditional_denoiser_dataset_not_ready")
if ((datasetManifest?.currentConditionPairCount ?? 0) !== (datasetManifest?.conditionOnlyBlueprintCount ?? -1)) blockers.push("ai_assisted_condition_pairs_incomplete")
if (datasetManifest?.currentConditionUnpairedCount !== 0) blockers.push("ai_assisted_unpaired_conditions_present")
if (datasetManifest?.connectivityCoverage?.thresholdMet !== true) blockers.push("world_connectivity_coverage_missing")
if (datasetManifest?.canStartFormalTraining !== false || datasetManifest?.formalInferenceEligible !== false) blockers.push("ai_assisted_package_formal_boundary_invalid")
if (datasetManifest?.modelConfigId !== (modelConfig?.datasetPackageModelId ?? modelConfig?.modelId)) blockers.push("ai_assisted_dataset_model_config_mismatch")
if (engineeringMode && resolutionStage !== 0) blockers.push("engineering_pretraining_only_allows_resolution_stage_0")
if (engineeringMode && datasetManifest?.sampleCount !== 26) blockers.push("engineering_pretraining_trusted_sample_count_invalid")
if (engineeringMode && datasetManifest?.formalV7CapacityCount !== 26) blockers.push("engineering_pretraining_formal_capacity_boundary_invalid")
if (engineeringMode && datasetManifest?.formalV7RequiredNewCount !== 102) blockers.push("engineering_pretraining_formal_gap_boundary_invalid")
if (engineeringMode && datasetManifest?.trainingGateStatus?.engineeringPretrainingAuthorized !== true) blockers.push("engineering_pretraining_owner_authorization_missing")
if (engineeringMode && datasetManifest?.trainingGateStatus?.formalV7TrainingAuthorized !== false) blockers.push("engineering_pretraining_formal_v7_boundary_invalid")
if (engineeringMode && modelConfig?.training?.trainingMode !== "nonformal_engineering_pretraining") blockers.push("engineering_pretraining_config_mode_invalid")
if (engineeringMode && modelConfig?.training?.formalV7TrainingAuthorized !== false) blockers.push("engineering_pretraining_config_formal_boundary_invalid")
if (useV7 && modelConfig?.training?.ownerTrainingAuthorization?.gpuTrainingAuthorizedNow !== true) blockers.push("v7_gpu_training_owner_activation_missing")
if (useV7 && modelConfig?.training?.ownerTrainingAuthorization?.status !== "owner_authorized_active_mvp64_gpu_training") blockers.push("v7_gpu_training_authorization_status_invalid")
if (useV7 && !fileHashMatches(
  modelConfig?.training?.ownerTrainingAuthorization?.authorizationPath,
  modelConfig?.training?.ownerTrainingAuthorization?.authorizationSha256,
)) blockers.push("v7_gpu_training_authorization_hash_invalid")
if (useV7 && v7TrainingAuthorization?.status !== "resolved_owner_authorized") blockers.push("v7_gpu_training_owner_resolution_missing")
if (useV7 && v7TrainingAuthorization?.ownerDecision?.commandRef !== "owner-approved-v7-mvp64-local-gpu-training-activation-20260802") blockers.push("v7_gpu_training_owner_command_invalid")
if (useV7 && v7TrainingAuthorization?.resolution?.gpuTrainingActivated !== true) blockers.push("v7_gpu_training_activation_not_resolved")
if (useV7 && v7TrainingAuthorization?.resolution?.formalInferenceAuthorized !== false) blockers.push("v7_formal_inference_boundary_invalid")
if (useV7 && !fileHashMatches(V7_DATASET_REPAIR_AUTHORIZATION_PATH, V7_DATASET_REPAIR_AUTHORIZATION_SHA256)) blockers.push("v7_dataset_repair_authorization_hash_invalid")
if (useV7 && v7DatasetRepairAuthorization?.status !== "resolved_owner_authorized") blockers.push("v7_dataset_repair_owner_resolution_missing")
if (useV7 && v7DatasetRepairAuthorization?.ownerDecision?.commandRef !== "owner-approved-v7-mvp64-training-sample-binding-repair-retrain-20260802") blockers.push("v7_dataset_repair_owner_command_invalid")
if (useV7 && v7DatasetRepairAuthorization?.ownerDecision?.scope !== "v7_dataset_binding_repair_cpu_regression_smoke_stage_0_1_2_only") blockers.push("v7_dataset_repair_owner_scope_invalid")
if (useV7 && v7DatasetRepairAuthorization?.resolution?.datasetBindingRepairAuthorized !== true) blockers.push("v7_dataset_binding_repair_not_authorized")
if (useV7 && v7DatasetRepairAuthorization?.resolution?.gpuRetrainingAuthorized !== true) blockers.push("v7_dataset_retraining_not_authorized")
if (useV7 && v7DatasetRepairAuthorization?.resolution?.postTrainingValidationAuthorized !== false) blockers.push("v7_dataset_repair_post_validation_boundary_invalid")
if (useV7 && datasetManifest?.v7CapacityContributionCount !== 64) blockers.push("v7_mvp64_dataset_capacity_invalid")
if (useV7 && actualV7LoadedRows.length !== 64) blockers.push("v7_actual_loaded_capacity_count_invalid")
if (useV7 && !sameJson(actualV7LoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })) blockers.push("v7_actual_loaded_split_invalid")
if (useV7 && new Set(actualV7LoadedRows.map((row) => row.recordId)).size !== 64) blockers.push("v7_actual_loaded_record_identity_duplicate")
if (useV7 && new Set(actualV7LoadedRows.map((row) => row.v7CapacitySlotId)).size !== 64) blockers.push("v7_actual_loaded_slot_identity_duplicate")
if (useV7 && v7TrainingAuthorization?.taskIdentity?.datasetPackageId !== datasetManifest?.packageId) blockers.push("v7_authorized_dataset_identity_mismatch")
if (useV7 && v7TrainingAuthorization?.taskIdentity?.qualifiedCompleteMapCount !== 64) blockers.push("v7_authorized_capacity_count_invalid")
if (useV7 && !sameJson(v7TrainingAuthorization?.taskIdentity?.splitCounts, {
  train: 48,
  validation: 8,
  challenge: 4,
  regression: 4,
})) blockers.push("v7_authorized_split_invalid")
if (useV7 && v7CapacityPlan?.status !== "capacity_complete_waiting_owner_training_authorization") blockers.push("v7_capacity_plan_not_complete")
if (useV7 && v7CapacityPlan?.auditSummary?.currentCompliantRecordCount !== 64) blockers.push("v7_capacity_plan_record_count_invalid")
if (useV7 && !sameJson(v7CapacityPlan?.gapSummary?.completedSplitCounts, {
  train: 48,
  validation: 8,
  challenge: 4,
  regression: 4,
})) blockers.push("v7_capacity_plan_split_invalid")
if (useV7 && !fileHashMatches(v7CapacityPointer?.capacityPlanPath, v7CapacityPointer?.capacityPlanSha256)) blockers.push("v7_capacity_plan_hash_invalid")
if (!autoencoderCheckpoint) blockers.push("approved_ai_assisted_autoencoder_checkpoint_missing")
if (resolutionStage > 0 && !smokeTest && !parentDenoiserCheckpoint) blockers.push("previous_conditional_denoiser_resolution_checkpoint_missing")
if (!fs.existsSync(CONFIG)) blockers.push("ai_assisted_model_config_missing")
if (!fs.existsSync(TRAINER)) blockers.push("conditional_denoiser_training_program_missing")
if (!fs.existsSync(PYTHON)) blockers.push("local_python_runtime_missing")

appendAiPainterProgramEvent({
  action: "run_ai_assisted_conditional_denoiser_training",
  runId,
  kind: "training_run_started",
  status: "running",
  title: "Project-owned AI-assisted conditional denoiser training preflight started",
  titleZh: "项目自有 AI 辅助条件去噪训练预检已启动",
  detail: `architecture=${modelConfig?.architectureVersion ?? "unknown"}; target=${modelConfig?.predictionTarget ?? "unknown"}; resolutionStage=${resolutionStage}; smokeTest=${smokeTest}`,
  detailZh: `架构=${modelConfig?.architectureVersion ?? "未知"}；预测目标=${modelConfig?.predictionTarget ?? "未知"}；分辨率阶段=${resolutionStage}；冒烟测试=${smokeTest}`,
  script: "scripts/train-ai-assisted-conditional-denoiser.mjs",
  currentStep: "ai_assisted_conditional_denoiser_training",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  evidencePath: datasetPointer?.manifestPath ?? programEventProjectPath(CONFIG),
})

if (blockers.length > 0) {
  failOrBlock("blocked", blockers, null)
}

if (preflightOnly) {
  appendAiPainterProgramEvent({
    action: "run_ai_assisted_conditional_denoiser_training",
    runId,
    kind: "training_preflight_completed",
    status: "success",
    title: "V7 Dataset actual-row preflight completed",
    titleZh: "V7 Dataset实际加载行预检已完成",
    detail: `actualLoaded=${actualV7LoadedRows.length}; split=${JSON.stringify(actualV7LoadedSplitCounts)}; gpuStarted=false`,
    detailZh: `实际加载=${actualV7LoadedRows.length}；分割=${JSON.stringify(actualV7LoadedSplitCounts)}；GPU启动=false`,
    script: "scripts/train-ai-assisted-conditional-denoiser.mjs",
    currentStep: "v7_actual_dataset_binding_preflight_passed",
    finalGameMapSuccess: false,
    canEnterWorld: false,
    evidencePath: datasetPointer?.manifestPath ?? programEventProjectPath(CONFIG),
  })
  console.log(JSON.stringify({
    status: "v7_actual_dataset_binding_preflight_passed",
    runId,
    actualLoadedConditionalSampleCount: actualV7LoadedRows.length,
    actualLoadedV7CapacityCount: actualV7LoadedRows.length,
    actualLoadedSplitCounts: actualV7LoadedSplitCounts,
    uniqueRecordIdCount: new Set(actualV7LoadedRows.map((row) => row.recordId)).size,
    uniqueCapacitySlotCount: new Set(actualV7LoadedRows.map((row) => row.v7CapacitySlotId)).size,
    gpuStarted: false,
    formalInferenceEligible: false,
  }, null, 2))
  process.exit(0)
}

const pythonArgs = [
  TRAINER,
  "--config", CONFIG,
  "--dataset-package", path.resolve(ROOT, datasetPointer.manifestPath),
  "--autoencoder-checkpoint", path.resolve(ROOT, autoencoderCheckpoint.checkpointPath),
  "--output-dir", runDir,
  "--resolution-stage", String(resolutionStage),
]
if (smokeTest) pythonArgs.push("--smoke-test")
if (parentDenoiserCheckpoint) pythonArgs.push("--initial-denoiser-checkpoint", path.resolve(ROOT, parentDenoiserCheckpoint.checkpointPath))

const child = spawnSync(PYTHON, pythonArgs, {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 40 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
})

if (child.status !== 0) {
  failOrBlock("failed", ["conditional_denoiser_training_program_failed"], child)
}

const manifestPath = path.join(runDir, "manifest.json")
const manifest = readJson(manifestPath)
const expectedStatus = smokeTest
  ? "conditional_denoiser_program_smoke_test_passed"
  : "conditional_denoiser_training_completed_pending_validation"
const valid = manifest?.schemaVersion === modelConfig?.requiredCheckpointProvenance
  && manifest?.status === expectedStatus
  && manifest?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && manifest?.trainingLane === "ai_assisted_cold_start"
  && manifest?.modelId === modelConfig?.modelId
  && manifest?.architectureVersion === modelConfig?.architectureVersion
  && manifest?.datasetPackageId === datasetManifest?.packageId
  && manifest?.conditionChannels === 23
  && manifest?.conditionBoundSampleCount === (useV7 ? 64 : datasetManifest?.currentConditionPairCount)
  && (!useV7 || manifest?.actualLoadedConditionalSampleCount === 64)
  && (!useV7 || manifest?.actualLoadedV7CapacityCount === 64)
  && (!useV7 || sameJson(manifest?.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 }))
  && manifest?.thirdPartyWeightsLoaded === false
  && manifest?.thirdPartyGeneratedTrainingOutputUsed === true
  && manifest?.aiGenerationDependencyDeclared === true
  && manifest?.programValidated === true
  && manifest?.denoiserTrained === !smokeTest
  && manifest?.predictionTarget === "velocity_v1"
  && manifest?.latentNormalization?.version === "per_channel_train_split_v1"
  && manifest?.latentNormalization?.mean?.length === modelConfig?.latentChannels
  && manifest?.latentNormalization?.standardDeviation?.length === modelConfig?.latentChannels
  && manifest?.bestCheckpointMetric === modelConfig?.training?.bestCheckpointMetric
  && manifest?.denoiserLossVersion === modelConfig?.training?.denoiserLossVersion
  && manifest?.conditionResizeContract === "discrete_nearest_continuous_bilinear_v1"
  && Number.isInteger(manifest?.bestEpoch)
  && manifest?.formalInferenceEligible === false
  && manifest?.connectivityCoverage?.thresholdMet === true
  && fileHashMatches(manifest?.checkpointPath, manifest?.checkpointSha256)
  && fileHashMatches(manifest?.autoencoderCheckpointPath, manifest?.autoencoderCheckpointSha256)
  && fileHashMatches(manifest?.conditionEvidencePath, manifest?.conditionEvidenceSha256)

if (!valid) {
  failOrBlock("failed", ["conditional_denoiser_checkpoint_provenance_failed"], { status: 0, signal: null, stdout: child.stdout, stderr: child.stderr })
}

const algorithmEvidence = buildAlgorithmEvidence()
const algorithmEvidencePath = path.join(runDir, "algorithm-evidence.json")
writeJson(algorithmEvidencePath, algorithmEvidence)
const pointer = {
  ...manifest,
  trainingMode: engineeringMode ? "nonformal_engineering_pretraining" : "progressive_conditional_denoiser_training",
  trainingAuthorizationId: engineeringMode
    ? modelConfig.training.trainingAuthorizationId
    : useV7
      ? modelConfig.training.ownerTrainingAuthorization.authorizationId
      : null,
  formalV7TrainingAuthorized: useV7,
  formalV7CapacityCount: engineeringMode ? 26 : useV7 ? 64 : null,
  formalV7RequiredNewCount: engineeringMode ? 102 : useV7 ? 0 : null,
  rgbGenerated: false,
  manifestPath: projectPath(manifestPath),
  algorithmEvidencePath: projectPath(algorithmEvidencePath),
  algorithmEvidenceSha256: sha256File(algorithmEvidencePath),
  algorithmEvidence,
}
writeJson(manifestPath, pointer)
writeJson(path.join(MODEL_ROOT, smokeTest ? "latest-program-check.json" : "latest.json"), pointer)
indexArtifactTree(runDir, runId)
appendAiPainterProgramEvent({
  action: "run_ai_assisted_conditional_denoiser_training",
  runId,
  kind: "training_run_completed",
  status: "success",
  title: smokeTest
    ? "Project-owned AI-assisted conditional denoiser program smoke test completed"
    : "Project-owned AI-assisted conditional denoiser training stage completed",
  titleZh: smokeTest
    ? "项目自有 AI 辅助条件去噪训练程序冒烟测试已完成"
    : "项目自有 AI 辅助条件去噪训练阶段已完成",
  detail: `resolutionStage=${resolutionStage}; bestEpoch=${manifest.bestEpoch}; bestCheckpointMetric=${manifest.bestCheckpointMetric}; bestValidationMetric=${manifest.bestValidationMetric ?? manifest.bestValidationLoss ?? "unknown"}; formalInferenceEligible=false`,
  detailZh: `分辨率阶段=${resolutionStage}；最佳轮次=${manifest.bestEpoch}；最佳 checkpoint 指标=${manifest.bestCheckpointMetric}；最佳验证值=${manifest.bestValidationMetric ?? manifest.bestValidationLoss ?? "未知"}；正式推理资格=false`,
  script: "scripts/train-ai-assisted-conditional-denoiser.mjs",
  currentStep: "ai_assisted_conditional_denoiser_training",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: projectPath(manifestPath),
})
console.log(JSON.stringify({
  status: manifest.status,
  runId,
  smokeTest,
  resolutionStage,
  checkpointPath: manifest.checkpointPath,
  manifestPath: projectPath(manifestPath),
  conditionBoundSampleCount: manifest.conditionBoundSampleCount,
  actualLoadedConditionalSampleCount: manifest.actualLoadedConditionalSampleCount ?? null,
  actualLoadedV7CapacityCount: manifest.actualLoadedV7CapacityCount ?? null,
  actualLoadedSplitCounts: manifest.actualLoadedSplitCounts ?? null,
  trainingMode: engineeringMode ? "nonformal_engineering_pretraining" : "progressive_conditional_denoiser_training",
  formalV7TrainingAuthorized: useV7,
  rgbGenerated: false,
  formalInferenceEligible: false,
  remainingBlockers: manifest.remainingBlockers,
}, null, 2))

function failOrBlock(status, reasons, child) {
  const record = {
    schemaVersion: "project-owned-ai-assisted-conditional-denoiser-run-record-v1",
    status,
    runId,
    timestampUtc: new Date().toISOString(),
    timestampAsiaShanghai: formatShanghai(new Date().toISOString()),
    smokeTest,
    resolutionStage,
    datasetPackageId: datasetManifest?.packageId ?? null,
    blockers: reasons,
    exitCode: child?.status ?? null,
    signal: child?.signal ?? null,
    stdout: child?.stdout ?? "",
    stderr: child?.stderr ?? "",
    progressPath: fs.existsSync(path.join(runDir, "progress.json")) ? projectPath(path.join(runDir, "progress.json")) : null,
    thirdPartyWeightsLoaded: false,
    thirdPartyGeneratedTrainingOutputUsed: true,
    checkpointCreated: false,
    algorithmEvidence: buildAlgorithmEvidence(),
    automaticStorage: true,
  }
  const recordPath = path.join(MODEL_ROOT, status === "blocked" ? "blocks" : "failures", `${runId}.json`)
  writeJson(recordPath, record)
  writeJson(path.join(path.dirname(recordPath), "latest.json"), { ...record, recordPath: projectPath(recordPath) })
  indexArtifactTree(runDir, runId)
  appendAiPainterProgramEvent({
    action: "run_ai_assisted_conditional_denoiser_training",
    runId,
    kind: status === "blocked" ? "training_run_blocked" : "training_run_failed",
    status,
    title: status === "blocked"
      ? "Project-owned AI-assisted conditional denoiser training was blocked"
      : "Project-owned AI-assisted conditional denoiser training failed",
    titleZh: status === "blocked"
      ? "项目自有 AI 辅助条件去噪训练已阻断"
      : "项目自有 AI 辅助条件去噪训练失败",
    detail: `resolutionStage=${resolutionStage}; blockers=${reasons.join(",")}; exitCode=${child?.status ?? "none"}; signal=${child?.signal ?? "none"}`,
    detailZh: `分辨率阶段=${resolutionStage}；阻断或失败码=${reasons.join(",")}；退出码=${child?.status ?? "无"}；信号=${child?.signal ?? "无"}`,
    script: "scripts/train-ai-assisted-conditional-denoiser.mjs",
    currentStep: "ai_assisted_conditional_denoiser_training",
    error: reasons.join(","),
    errorZh: reasons.join("，"),
    finalGameMapSuccess: false,
    canEnterWorld: false,
    archiveId: runId,
    evidencePath: programEventProjectPath(recordPath),
  })
  console.error(JSON.stringify(record, null, 2))
  process.exit(1)
}

function findAutoencoderCheckpoint() {
  if (!fs.existsSync(AUTOENCODER_ROOT)) return null
  return fs.readdirSync(AUTOENCODER_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ai-assisted-complete-world-training-v2-"))
    .map((entry) => readJson(path.join(AUTOENCODER_ROOT, entry.name, "manifest.json")))
    .filter((manifest) => manifest
      && manifest.status === "autoencoder_warmup_completed_conditioning_blocked"
      && manifest.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
      && manifest.modelId === modelConfig?.autoencoderSourceModelId
      && manifest.architectureVersion === modelConfig?.autoencoderSourceArchitectureVersion
      && manifest.denoiserTrained === false
      && manifest.thirdPartyWeightsLoaded === false
      && manifest.resolutionStage?.width === 1024
      && manifest.resolutionStage?.height === 768
      && fileHashMatches(manifest.checkpointPath, manifest.checkpointSha256))
    .sort((left, right) => String(right.createdAtUtc).localeCompare(String(left.createdAtUtc)))[0] ?? null
}

function findPreviousDenoiserCheckpoint(stageIndex) {
  const expected = modelConfig?.training?.resolutionStages?.[stageIndex - 1]
  if (!expected || !fs.existsSync(MODEL_ROOT)) return null
  return fs.readdirSync(MODEL_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`ai-assisted-conditional-denoiser-${modelVersion}-stage-`))
    .map((entry) => readJson(path.join(MODEL_ROOT, entry.name, "manifest.json")))
    .filter((manifest) => manifest
      && manifest.status === "conditional_denoiser_training_completed_pending_validation"
      && manifest.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
      && manifest.modelId === modelConfig?.modelId
      && manifest.architectureVersion === modelConfig?.architectureVersion
      && manifest.datasetPackageId === datasetManifest?.packageId
      && manifest.actualLoadedConditionalSampleCount === 64
      && manifest.actualLoadedV7CapacityCount === 64
      && sameJson(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
      && manifest.denoiserTrained === true
      && manifest.predictionTarget === "velocity_v1"
      && manifest.latentNormalization?.version === "per_channel_train_split_v1"
      && manifest.resolutionStage?.width === expected.width
      && manifest.resolutionStage?.height === expected.height
      && fileHashMatches(manifest.checkpointPath, manifest.checkpointSha256))
    .sort((left, right) => String(right.createdAtUtc).localeCompare(String(left.createdAtUtc)))[0] ?? null
}

function readResolutionStage(args) {
  const index = args.indexOf("--resolution-stage")
  if (index < 0) return 0
  const value = Number(args[index + 1])
  if (!Number.isInteger(value) || value < 0 || value > 2) throw new Error("--resolution-stage must be 0, 1, or 2")
  return value
}

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) } catch { return null } }
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
  indexWrittenArtifact(filePath, runId)
}
function indexArtifactTree(rootPath, artifactRunId) {
  if (!fs.existsSync(rootPath)) return
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const childPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) indexArtifactTree(childPath, artifactRunId)
    else if (entry.isFile()) indexWrittenArtifact(childPath, artifactRunId)
  }
}
function indexWrittenArtifact(filePath, artifactRunId) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: projectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: artifactRunId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256File(filePath),
  })
}
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function fileHashMatches(filePath, expected) {
  if (!filePath || !expected) return false
  const absolute = path.resolve(ROOT, filePath)
  return fs.existsSync(absolute) && crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex") === expected
}
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function isV7RegisteredConditionalRow(row) {
  return row?.categoryId === "complete-maps"
    && row?.trainingRoles?.includes("conditional_denoiser")
    && row?.formalConditionalTrainingEligible === true
    && row?.conditionBound === true
    && row?.v7CapacityContributionRegistered === true
    && row?.ownerReviewStatus === "owner_approved"
    && row?.machineReviewStatus === "passed"
    && row?.aiAssistedColdStartEligible === true
    && row?.independentTrainingEligible === false
}
function countSplits(rows) {
  return Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => [
    split,
    rows.filter((row) => row.split === split).length,
  ]))
}
function buildAlgorithmEvidence() {
  const sources = [
    CONFIG,
    TRAINER,
    path.join(ROOT, "ml", "ai-painter", "src", "ai_painter", "complete_world", "model.py"),
    path.join(ROOT, "ml", "ai-painter", "src", "ai_painter", "complete_world", "dataset.py"),
    path.join(ROOT, "ml", "ai-painter", "src", "ai_painter", "complete_world", "diffusion.py"),
    path.join(ROOT, "scripts", "train-ai-assisted-conditional-denoiser.mjs"),
  ]
  return {
    schemaVersion: "ai-assisted-conditional-denoiser-algorithm-evidence-v1",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    architectureVersion: modelConfig?.architectureVersion ?? null,
    denoiserLossVersion: modelConfig?.training?.denoiserLossVersion ?? null,
    bestCheckpointMetric: modelConfig?.training?.bestCheckpointMetric ?? null,
    conditionResizeContract: modelConfig?.conditionResizeContract ?? null,
    sourceFiles: sources.map((filePath) => ({ path: projectPath(filePath), sha256: sha256File(filePath) })),
    automaticStorage: true,
  }
}
function formatShanghai(iso) { return formatProgramEventShanghai(iso) }
