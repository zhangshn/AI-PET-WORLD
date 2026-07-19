import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai as formatProgramEventShanghai,
  projectPath as programEventProjectPath,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const CONFIG = path.join(ROOT, "ml", "ai-painter", "config", "complete-world-ai-assisted-cold-start-v4.json")
const AUTOENCODER_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-model-ai-assisted-v2")
const MODEL_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-conditional-denoiser-v4")
const modelConfig = readJson(CONFIG)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = datasetPointer?.manifestPath ? readJson(datasetPointer.manifestPath) : null
const timestamp = new Date().toISOString()
const smokeTest = process.argv.includes("--smoke-test")
const resolutionStage = readResolutionStage(process.argv.slice(2))
const runId = `ai-assisted-conditional-denoiser-v4-${smokeTest ? "smoke" : `stage-${resolutionStage}`}-${timestamp.replace(/[:.]/g, "-")}`
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
  && manifest?.conditionBoundSampleCount === datasetManifest?.currentConditionPairCount
  && manifest?.thirdPartyWeightsLoaded === false
  && manifest?.thirdPartyGeneratedTrainingOutputUsed === true
  && manifest?.aiGenerationDependencyDeclared === true
  && manifest?.programValidated === true
  && manifest?.denoiserTrained === !smokeTest
  && manifest?.predictionTarget === "velocity_v1"
  && manifest?.latentNormalization?.version === "per_channel_train_split_v1"
  && manifest?.latentNormalization?.mean?.length === modelConfig?.latentChannels
  && manifest?.latentNormalization?.standardDeviation?.length === modelConfig?.latentChannels
  && manifest?.bestCheckpointMetric === "fixed_grid_composite_condition_quality_score_v4"
  && manifest?.denoiserLossVersion === "velocity_clean_gradient_condition_reconstruction_v4"
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
  manifestPath: projectPath(manifestPath),
  algorithmEvidencePath: projectPath(algorithmEvidencePath),
  algorithmEvidenceSha256: sha256File(algorithmEvidencePath),
  algorithmEvidence,
}
writeJson(manifestPath, pointer)
writeJson(path.join(MODEL_ROOT, smokeTest ? "latest-program-check.json" : "latest.json"), pointer)
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
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ai-assisted-conditional-denoiser-v4-stage-"))
    .map((entry) => readJson(path.join(MODEL_ROOT, entry.name, "manifest.json")))
    .filter((manifest) => manifest
      && manifest.status === "conditional_denoiser_training_completed_pending_validation"
      && manifest.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
      && manifest.modelId === modelConfig?.modelId
      && manifest.architectureVersion === modelConfig?.architectureVersion
      && manifest.datasetPackageId === datasetManifest?.packageId
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
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function fileHashMatches(filePath, expected) {
  if (!filePath || !expected) return false
  const absolute = path.resolve(ROOT, filePath)
  return fs.existsSync(absolute) && crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex") === expected
}
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }
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
