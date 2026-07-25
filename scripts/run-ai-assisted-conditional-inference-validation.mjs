import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { appendAiPainterProgramEvent, projectPath as ledgerProjectPath } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const SAMPLER = path.join(ROOT, "ml", "ai-painter", "scripts", "infer_ai_assisted_conditional_validation.py")
const MACHINE_REVIEWER = path.join(ROOT, "scripts", "review-ai-assisted-conditional-inference-validation.mjs")
const RUNNER = path.join(ROOT, "scripts", "run-ai-assisted-conditional-inference-validation.mjs")
const MODEL_SOURCE = path.join(ROOT, "ml", "ai-painter", "src", "ai_painter", "complete_world", "model.py")
const DIFFUSION_SOURCE = path.join(ROOT, "ml", "ai-painter", "src", "ai_painter", "complete_world", "diffusion.py")
const PROFESSIONAL_AESTHETIC_SOURCE = path.join(ROOT, "scripts", "lib", "ai-assisted-professional-aesthetic.mjs")
const args = parseArgs(process.argv.slice(2))
const MODEL_VERSION = args.modelVersion
const IS_ENGINEERING_26 = MODEL_VERSION === "v7-engineering-26"
const CONFIG_PATH = `ml/ai-painter/config/complete-world-ai-assisted-cold-start-${MODEL_VERSION}.json`
const CHECKPOINT_POINTER = IS_ENGINEERING_26
  ? ".runtime/ai-painter/project-owned-complete-world-v7-engineering-pretraining/latest.json"
  : `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-${MODEL_VERSION}/latest.json`
const DATASET_POINTER = IS_ENGINEERING_26
  ? "data/world-samples/ai-assisted-v7-engineering-pretraining-datasets/latest.json"
  : "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"
const OUTPUT_ROOT = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  IS_ENGINEERING_26 ? "ai-assisted-v7-engineering-inference-validation" : "ai-assisted-conditional-inference-validation",
)
const FAILURE_ROOT = path.join(OUTPUT_ROOT, "failures")
const timestamp = new Date().toISOString()
const runId = `ai-assisted-conditional-inference-validation-${MODEL_VERSION}-${timestamp.replace(/[:.]/g, "-")}`
const runDir = path.join(OUTPUT_ROOT, runId)
const outputImage = path.join(runDir, "validation.png")
const modelReportPath = path.join(runDir, "model-report.json")
const manifestPath = path.join(runDir, "manifest.json")
const processEvidence = []
const config = readJson(CONFIG_PATH)
const checkpoint = readJson(CHECKPOINT_POINTER)
const datasetPointer = readJson(DATASET_POINTER)
const datasetManifestPath = checkpoint?.datasetManifestPath ?? datasetPointer?.manifestPath ?? null
const sourceIndexPath = checkpoint?.sourceIndexPath ?? null
const datasetManifest = datasetManifestPath ? readJson(datasetManifestPath) : null
const sourceIndex = sourceIndexPath ? readJson(sourceIndexPath) : null
const eligibleSplits = new Set(["validation", "challenge", "regression"])
const matchingSamples = (sourceIndex?.samples ?? []).filter((sample) =>
  sample.conditionLabel === args.conditionLabel
  && eligibleSplits.has(sample.split)
  && sample.conditionBound === true
  && sample.currentConditionIdentityMatches === true
  && sample.formalConditionalTrainingEligible === true)
const sample = matchingSamples.length === 1 ? matchingSamples[0] : null
const conditionPack = sample?.conditionPackPath ? readJson(sample.conditionPackPath) : null
const taskPackage = conditionPack?.sourceBindings?.taskPackagePath ? readJson(conditionPack.sourceBindings.taskPackagePath) : null
const seed = args.seed ?? Number.parseInt(sha256(Buffer.from(`${args.conditionLabel}:${args.ownerCommandRef}:ai-assisted-validation-v1`)).slice(0, 8), 16)
const algorithmEvidence = buildAlgorithmEvidence(config)
const algorithmEvidenceSha256 = sha256(Buffer.from(JSON.stringify(algorithmEvidence)))
const blockers = []

if (!args.conditionLabel) blockers.push("validation_condition_label_missing")
if (!args.ownerCommandRef || args.ownerCommandRef.length < 8) blockers.push("specific_owner_single_image_command_missing")
if (blockers.length > 0) blockOrFail("blocked", blockers, null)
if (!config || config.ownership !== "project_owned_architecture_ai_assisted_cold_start_weights") blockers.push("ai_assisted_model_config_invalid")
if (!checkpoint) blockers.push("ai_assisted_conditional_checkpoint_missing")
if (checkpoint && checkpoint.schemaVersion !== config?.requiredCheckpointProvenance) blockers.push("ai_assisted_checkpoint_provenance_invalid")
if (checkpoint && checkpoint.status !== "conditional_denoiser_training_completed_pending_validation") blockers.push("ai_assisted_checkpoint_training_not_completed")
if (checkpoint && checkpoint.denoiserTrained !== true) blockers.push("ai_assisted_denoiser_not_trained")
if (checkpoint && checkpoint.predictionTarget !== "velocity_v1") blockers.push("ai_assisted_checkpoint_prediction_target_invalid")
if (checkpoint && checkpoint.bestCheckpointMetric !== config?.training?.bestCheckpointMetric) blockers.push("ai_assisted_checkpoint_selection_metric_invalid")
if (checkpoint && checkpoint.denoiserLossVersion !== config?.training?.denoiserLossVersion) blockers.push("ai_assisted_checkpoint_loss_contract_invalid")
if (checkpoint && checkpoint.conditionResizeContract !== "discrete_nearest_continuous_bilinear_v1") blockers.push("ai_assisted_checkpoint_condition_resize_invalid")
if (checkpoint && checkpoint.latentNormalization?.version !== "per_channel_train_split_v1") blockers.push("ai_assisted_checkpoint_latent_normalization_invalid")
if (checkpoint && checkpoint.formalInferenceEligible !== false) blockers.push("ai_assisted_checkpoint_validation_boundary_invalid")
if (checkpoint && IS_ENGINEERING_26 && (checkpoint.resolutionStage?.width !== 256 || checkpoint.resolutionStage?.height !== 192)) blockers.push("engineering_stage_0_checkpoint_resolution_invalid")
if (checkpoint && !IS_ENGINEERING_26 && (checkpoint.resolutionStage?.width !== 1024 || checkpoint.resolutionStage?.height !== 768)) blockers.push("native_resolution_checkpoint_missing")
if (checkpoint && checkpoint.thirdPartyWeightsLoaded !== false) blockers.push("third_party_weight_status_invalid")
if (checkpoint && (checkpoint.thirdPartyGeneratedTrainingOutputUsed !== true || checkpoint.aiGenerationDependencyDeclared !== true)) blockers.push("ai_training_data_dependency_not_declared")
if (checkpoint?.checkpointPath && !fileHashMatches(checkpoint.checkpointPath, checkpoint.checkpointSha256)) blockers.push("checkpoint_file_or_hash_invalid")
if (!datasetManifest || datasetManifest.canTrainConditionalDenoiser !== true) blockers.push("conditional_dataset_not_ready")
if (!datasetManifestPath || !fileHashMatches(datasetManifestPath, checkpoint?.datasetManifestSha256)) blockers.push("conditional_dataset_manifest_invalid")
if (datasetManifest?.packageId !== checkpoint?.datasetPackageId) blockers.push("conditional_dataset_checkpoint_identity_mismatch")
if (!sourceIndex || !sourceIndexPath || !fileHashMatches(sourceIndexPath, checkpoint?.sourceIndexSha256)) blockers.push("conditional_source_index_invalid")
if (matchingSamples.length !== 1) blockers.push(matchingSamples.length === 0 ? "unseen_validation_condition_not_found" : "validation_condition_identity_ambiguous")
if (!conditionPack || conditionPack.channels?.length !== 23 || !canonicalJsonHashMatches(conditionPack, "conditionPackSha256")) blockers.push("validation_condition_pack_invalid")
if (conditionPack && !conditionChannelFilesValid(conditionPack, config?.conditionChannelOrder)) blockers.push("validation_condition_channel_evidence_invalid")
if (!completeMapScopeValid(conditionPack, taskPackage, sample)) blockers.push("validation_condition_not_complete_map_scope")
if (!fs.existsSync(PYTHON)) blockers.push("local_python_runtime_missing")
if (!fs.existsSync(SAMPLER)) blockers.push("ai_assisted_validation_sampler_missing")
if (!fs.existsSync(MACHINE_REVIEWER)) blockers.push("ai_assisted_validation_machine_reviewer_missing")

if (blockers.length > 0) blockOrFail("blocked", blockers, null)

fs.mkdirSync(runDir, { recursive: false })
const inferenceStartedAtMs = Date.now()
const startedEvidence = writeProcessEvidence(1, "inference-started", {
  status: "inference_started",
  currentStep: "model_inference",
  seed,
  sourceSplit: sample.split,
  conditionPackPath: sample.conditionPackPath,
  conditionPackSha256: conditionPack.conditionPackSha256,
  checkpointPath: checkpoint.checkpointPath,
  checkpointSha256: checkpoint.checkpointSha256,
})
processEvidence.push(startedEvidence)
appendAiPainterProgramEvent({
  action: "run_ai_assisted_conditional_inference_validation",
  runId,
  kind: "inference_started",
  status: "running",
  title: "AI-assisted held-out validation inference started",
  titleZh: "AI 辅助未见结构验证推理已开始",
  detail: `condition=${args.conditionLabel} / split=${sample.split} / seed=${seed}`,
  detailZh: `条件=${args.conditionLabel} / 数据分区=${sample.split} / 随机种子=${seed}`,
  script: "scripts/run-ai-assisted-conditional-inference-validation.mjs",
  currentStep: "model_inference",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: ledgerProjectPath(resolvePath(startedEvidence.path)),
  nextAction: "generate_fresh_validation_image_then_run_machine_review",
  nextActionZh: "生成本轮全新验证图后执行机器审核",
})
const child = spawnSync(PYTHON, [
  SAMPLER,
  "--config", resolvePath(CONFIG_PATH),
  "--checkpoint", resolvePath(checkpoint.checkpointPath),
  "--condition-pack", resolvePath(sample.conditionPackPath),
  "--output-image", outputImage,
  "--report", modelReportPath,
  "--seed", String(seed),
  ...(IS_ENGINEERING_26 ? ["--allow-progressive-checkpoint-nonformal"] : []),
], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 40 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
})
if (child.status !== 0) blockOrFail("failed", ["ai_assisted_validation_sampler_failed"], child)

const modelReport = readJson(modelReportPath)
const imageBytes = fs.readFileSync(outputImage)
const metadata = await sharp(imageBytes, { failOn: "error" }).metadata()
const imageSha256 = sha256(imageBytes)
if (metadata.width !== 1024 || metadata.height !== 768 || metadata.channels !== 3) blockOrFail("failed", ["validation_image_contract_failed"], null)
if (modelReport?.outputImageSha256 !== imageSha256) blockOrFail("failed", ["validation_image_hash_mismatch"], null)
const generatedAt = new Date().toISOString()
const generatedEvidence = writeProcessEvidence(2, "validation-image-generated", {
  status: "validation_image_generated_pending_machine_review",
  currentStep: "machine_review",
  generatedAtUtc: generatedAt,
  generatedAtAsiaShanghai: formatShanghai(generatedAt),
  generationDurationMs: Date.now() - inferenceStartedAtMs,
  processExitCode: child.status,
  processSignal: child.signal,
  processStdout: child.stdout ?? "",
  processStderr: child.stderr ?? "",
  outputImagePath: projectPath(outputImage),
  outputImageSha256: imageSha256,
  outputSize: { width: metadata.width, height: metadata.height, channels: metadata.channels },
  modelReportPath: projectPath(modelReportPath),
  modelReportSha256: sha256(fs.readFileSync(modelReportPath)),
})
processEvidence.push(generatedEvidence)
appendAiPainterProgramEvent({
  action: "run_ai_assisted_conditional_inference_validation",
  runId,
  kind: "validation_image_generated",
  status: "success",
  title: "Validation image generation step completed; not a final game-map success",
  titleZh: "验证图生成步骤已完成；不代表正式游戏地图成功",
  detail: `fresh image=${projectPath(outputImage)} / sha256=${imageSha256}`,
  detailZh: `本轮新图=${projectPath(outputImage)} / 哈希=${imageSha256}`,
  script: "scripts/run-ai-assisted-conditional-inference-validation.mjs",
  currentStep: "machine_review",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: ledgerProjectPath(resolvePath(generatedEvidence.path)),
  nextAction: "run_validation_machine_review",
  nextActionZh: "执行验证专用机器审核",
})

const manifest = {
  schemaVersion: "ai-assisted-complete-world-inference-validation-manifest-v1",
  status: "validation_image_generated_pending_machine_review",
  runId,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  ownerCommandRef: args.ownerCommandRef,
  conditionLabel: args.conditionLabel,
  sampleId: sample.sampleId,
  sourceSplit: sample.split,
  datasetPackageId: datasetManifest.packageId,
  datasetManifestPath,
  datasetManifestSha256: checkpoint.datasetManifestSha256,
  sourceIndexPath,
  sourceIndexSha256: checkpoint.sourceIndexSha256,
  conditionPackId: conditionPack.conditionPackId,
  conditionPackPath: sample.conditionPackPath,
  conditionPackSha256: conditionPack.conditionPackSha256,
  taskPackagePath: conditionPack.sourceBindings.taskPackagePath,
  taskPackageSha256: conditionPack.taskSha256,
  modelId: config.modelId,
  modelCheckpointPath: checkpoint.checkpointPath,
  modelCheckpointSha256: checkpoint.checkpointSha256,
  ownership: "project_owned_architecture_ai_assisted_cold_start_weights",
  trainingLane: "ai_assisted_cold_start",
  upstreamModelIds: [],
  thirdPartyWeightsLoaded: false,
  thirdPartyGeneratedTrainingOutputUsed: true,
  aiGenerationDependencyDeclared: true,
  seed,
  outputSource: "fresh_local_ai_assisted_checkpoint_validation",
  validationLane: IS_ENGINEERING_26 ? "nonformal_engineering_held_out" : "formal_resolution_checkpoint_held_out",
  checkpointNativeResolution: checkpoint.resolutionStage,
  checkpointNativeResolutionMatchesOutput: checkpoint.resolutionStage?.width === metadata.width && checkpoint.resolutionStage?.height === metadata.height,
  progressiveCheckpointNonformalValidation: IS_ENGINEERING_26,
  reusedExistingImage: false,
  targetImageUsed: false,
  programDrawnRgbUsed: false,
  outputImagePath: projectPath(outputImage),
  outputImageSha256: imageSha256,
  outputSize: { width: metadata.width, height: metadata.height },
  modelReportPath: projectPath(modelReportPath),
  modelReportSha256: sha256(fs.readFileSync(modelReportPath)),
  algorithmEvidence,
  algorithmEvidenceSha256,
  processEvidence,
  consumedCompiledChannelIds: conditionPack.channels.map((channel) => channel.id),
  conditionChannels: conditionPack.channels.map((channel) => ({ id: channel.id, path: channel.path, sha256: channel.sha256 })),
  formalCandidate: false,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  requiresMachineReview: true,
  requiresOwnerReview: true,
  automaticStorage: true,
}
writeJson(manifestPath, manifest)
const reviewChild = spawnSync(process.execPath, [MACHINE_REVIEWER, "--manifest", manifestPath], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 40 * 1024 * 1024,
})
if (reviewChild.status !== 0) blockOrFail("failed", ["ai_assisted_validation_machine_review_failed_to_execute"], reviewChild, true, manifest)
const machineReviewPath = path.join(runDir, "machine-review.json")
const machineReview = readJson(machineReviewPath)
if (!machineReview || machineReview.imageSha256 !== imageSha256) blockOrFail("failed", ["ai_assisted_validation_machine_review_evidence_invalid"], reviewChild, true, manifest)
const reviewedAt = new Date().toISOString()
const reviewEvidence = writeProcessEvidence(3, "machine-review-completed", {
  status: machineReview.passed ? "machine_passed_waiting_owner_review" : "machine_rejected",
  currentStep: machineReview.passed ? "waiting_owner_review" : "failure_backwrite",
  reviewedAtUtc: reviewedAt,
  reviewedAtAsiaShanghai: formatShanghai(reviewedAt),
  totalDurationMs: Date.now() - inferenceStartedAtMs,
  processExitCode: reviewChild.status,
  processSignal: reviewChild.signal,
  processStdout: reviewChild.stdout ?? "",
  processStderr: reviewChild.stderr ?? "",
  machineReviewPath: projectPath(machineReviewPath),
  machineReviewSha256: sha256(fs.readFileSync(machineReviewPath)),
  machineReviewPassed: machineReview.passed,
  machineReviewIssueCodes: machineReview.issues.map((issue) => issue.code),
})
processEvidence.push(reviewEvidence)
appendAiPainterProgramEvent({
  action: "run_ai_assisted_conditional_inference_validation",
  runId,
  kind: "machine_review_process_completed",
  status: "info",
  title: machineReview.passed ? "Validation machine review completed and awaits owner review" : "Validation machine review completed with rejection",
  titleZh: machineReview.passed ? "验证机器审核已完成，等待项目所有者审核" : "验证机器审核已完成并判定拒绝",
  detail: machineReview.passed ? "Machine gates passed; formal game-map success remains false." : `issueCodes=${machineReview.issues.map((issue) => issue.code).join(",")}`,
  detailZh: machineReview.passed ? "机器门禁通过；正式游戏地图成功仍为否。" : `失败码=${machineReview.issues.map((issue) => issue.code).join(",")}`,
  script: "scripts/run-ai-assisted-conditional-inference-validation.mjs",
  currentStep: machineReview.passed ? "waiting_owner_review" : "failure_backwrite",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: ledgerProjectPath(resolvePath(reviewEvidence.path)),
  nextAction: machineReview.passed ? "wait_for_owner_review" : "feed_machine_review_failure_into_next_training_round",
  nextActionZh: machineReview.passed ? "等待项目所有者审核" : "将机器审核失败写入下一轮训练",
})
const completedManifest = {
  ...manifest,
  status: machineReview.passed ? "machine_passed_waiting_owner_review" : "machine_rejected",
  machineReviewStatus: machineReview.status,
  machineReviewPath: projectPath(machineReviewPath),
  machineReviewSha256: sha256(fs.readFileSync(machineReviewPath)),
  machineReviewIssueCodes: machineReview.issues.map((issue) => issue.code),
  processEvidence,
}
writeJson(manifestPath, completedManifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), { ...completedManifest, manifestPath: projectPath(manifestPath) })
indexArtifactTree(runDir, runId)
console.log(JSON.stringify({ status: completedManifest.status, runId, conditionLabel: args.conditionLabel, sourceSplit: sample.split, outputImagePath: completedManifest.outputImagePath, manifestPath: projectPath(manifestPath), machineReviewPath: completedManifest.machineReviewPath, machineReviewIssueCodes: completedManifest.machineReviewIssueCodes, formalInferenceEligible: false }, null, 2))

function blockOrFail(status, reasons, child, candidateGenerated = false, generatedManifest = null) {
  const record = {
    schemaVersion: "ai-assisted-complete-world-inference-validation-run-record-v1",
    status,
    runId,
    timestampUtc: timestamp,
    timestampAsiaShanghai: formatShanghai(timestamp),
    ownerCommandRef: args.ownerCommandRef ?? null,
    conditionLabel: args.conditionLabel ?? null,
    blockers: reasons,
    exitCode: child?.status ?? null,
    signal: child?.signal ?? null,
    stdout: child?.stdout ?? "",
    stderr: child?.stderr ?? "",
    candidateGenerated,
    outputImagePath: generatedManifest?.outputImagePath ?? null,
    outputImageSha256: generatedManifest?.outputImageSha256 ?? null,
    manifestPath: generatedManifest ? projectPath(manifestPath) : null,
    algorithmEvidence,
    algorithmEvidenceSha256,
    processEvidence,
    automaticStorage: true,
  }
  const recordPath = path.join(FAILURE_ROOT, `${runId}.json`)
  writeJson(recordPath, record)
  writeJson(path.join(FAILURE_ROOT, "latest.json"), { ...record, recordPath: projectPath(recordPath) })
  if (fs.existsSync(runDir)) indexArtifactTree(runDir, runId)
  appendAiPainterProgramEvent({
    action: "run_ai_assisted_conditional_inference_validation",
    runId,
    kind: status === "blocked" ? "blocked" : "step_failed",
    status,
    title: status === "blocked" ? "AI-assisted validation inference blocked before completion" : "AI-assisted validation inference failed",
    titleZh: status === "blocked" ? "AI 辅助验证推理在完成前被阻断" : "AI 辅助验证推理失败",
    detail: reasons.join(","),
    detailZh: `失败码=${reasons.join(",")}`,
    script: "scripts/run-ai-assisted-conditional-inference-validation.mjs",
    currentStep: candidateGenerated ? "machine_review" : "model_inference",
    error: reasons.join(","),
    errorZh: reasons.join(","),
    finalGameMapSuccess: false,
    canEnterWorld: false,
    archiveId: runId,
    evidencePath: ledgerProjectPath(recordPath),
    nextAction: "inspect_saved_failure_evidence_before_retry",
    nextActionZh: "先检查已保存的失败证据，再决定是否重试",
  })
  console.error(JSON.stringify(record, null, 2))
  process.exit(1)
}

function parseArgs(values) {
  const read = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : null }
  const seedValue = read("--seed")
  const seed = seedValue === null ? null : Number(seedValue)
  if (seedValue !== null && (!Number.isInteger(seed) || seed < 0)) throw new Error("--seed must be a non-negative integer")
  const requestedVersion = read("--model-version") ?? (values.includes("--v6") ? "v6" : (values.includes("--v5") ? "v5" : "v4"))
  if (!new Set(["v4", "v5", "v6", "v7-engineering-26"]).has(requestedVersion)) throw new Error("--model-version must be v4, v5, v6, or v7-engineering-26")
  return { conditionLabel: read("--condition-label"), ownerCommandRef: read("--owner-command-ref"), seed, modelVersion: requestedVersion }
}

function readJson(value) { try { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) } catch { return null } }
function resolvePath(value) { const resolved = path.resolve(ROOT, value); if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes root: ${value}`); return resolved }
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
  indexWrittenArtifact(filePath, runId)
}
function indexArtifactTree(rootPath, artifactRunId) {
  if (!fs.existsSync(rootPath)) return
  const entries = fs.readdirSync(rootPath, { withFileTypes: true })
  for (const entry of entries) {
    const childPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) indexArtifactTree(childPath, artifactRunId)
    else if (entry.isFile()) indexWrittenArtifact(childPath, artifactRunId)
  }
}
function indexWrittenArtifact(filePath, artifactRunId) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: artifactRunId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256(fs.readFileSync(filePath)),
  })
}
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function fileEvidence(value) {
  const absolute = resolvePath(value)
  return {
    path: projectPath(absolute),
    exists: fs.existsSync(absolute),
    sha256: fs.existsSync(absolute) ? sha256(fs.readFileSync(absolute)) : null,
  }
}
function buildAlgorithmEvidence(modelConfig) {
  return {
    schemaVersion: "ai-assisted-inference-algorithm-evidence-v1",
    recordedAtUtc: timestamp,
    recordedAtAsiaShanghai: formatShanghai(timestamp),
    sources: {
      configuration: fileEvidence(CONFIG_PATH),
      model: fileEvidence(MODEL_SOURCE),
      diffusion: fileEvidence(DIFFUSION_SOURCE),
      sampler: fileEvidence(SAMPLER),
      runner: fileEvidence(RUNNER),
      reviewer: fileEvidence(MACHINE_REVIEWER),
      professionalAesthetic: fileEvidence(PROFESSIONAL_AESTHETIC_SOURCE),
    },
    contract: {
      modelId: modelConfig?.modelId ?? null,
      architectureVersion: modelConfig?.architectureVersion ?? null,
      denoiserArchitecture: modelConfig?.denoiserArchitecture ?? null,
      autoencoderArchitecture: modelConfig?.autoencoderArchitecture ?? null,
      predictionTarget: modelConfig?.predictionTarget ?? null,
      denoiserLossVersion: modelConfig?.training?.denoiserLossVersion ?? null,
      bestCheckpointMetric: modelConfig?.training?.bestCheckpointMetric ?? null,
      conditionResizeContract: modelConfig?.conditionResizeContract ?? null,
      conditionChannels: modelConfig?.conditionChannels ?? null,
      latentChannels: modelConfig?.latentChannels ?? null,
      latentDownsampleFactor: modelConfig?.latentDownsampleFactor ?? null,
      diffusionSteps: modelConfig?.diffusion?.timesteps ?? null,
      inferenceSteps: modelConfig?.inference?.steps ?? null,
      nativeImageSize: modelConfig?.imageSize ?? null,
    },
  }
}
function writeProcessEvidence(sequence, stage, details) {
  const evidenceTimestamp = new Date().toISOString()
  const record = {
    schemaVersion: "ai-assisted-inference-process-evidence-v1",
    runId,
    sequence,
    stage,
    timestampUtc: evidenceTimestamp,
    timestampAsiaShanghai: formatShanghai(evidenceTimestamp),
    ownerCommandRef: args.ownerCommandRef ?? null,
    conditionLabel: args.conditionLabel ?? null,
    algorithmEvidence,
    algorithmEvidenceSha256,
    ...details,
    formalCandidate: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
    automaticStorage: true,
  }
  const evidencePath = path.join(runDir, "process-events", `${String(sequence).padStart(3, "0")}-${stage}.json`)
  writeJson(evidencePath, record)
  return { stage, path: projectPath(evidencePath), sha256: sha256(fs.readFileSync(evidencePath)) }
}
function fileHashMatches(filePath, expected) { if (!filePath || !expected) return false; const absolute = resolvePath(filePath); return fs.existsSync(absolute) && sha256(fs.readFileSync(absolute)) === expected }
function canonicalJsonHashMatches(value, hashField) {
  if (!value || typeof value[hashField] !== "string") return false
  const canonical = { ...value }
  const expected = canonical[hashField]
  delete canonical[hashField]
  return sha256(Buffer.from(JSON.stringify(canonical))) === expected
}
function conditionChannelFilesValid(pack, channelOrder) {
  if (!Array.isArray(channelOrder) || !Array.isArray(pack?.channels)) return false
  if (pack.channels.length !== channelOrder.length) return false
  if (pack.channels.some((channel, index) => channel?.id !== channelOrder[index])) return false
  return pack.channels.every((channel) => fileHashMatches(channel?.path, channel?.sha256))
}
function completeMapScopeValid(pack, task, selectedSample) {
  const mustShow = new Set(pack?.categoricalConditions?.sceneIntent?.mustShow ?? [])
  return selectedSample?.conditionGenerationContractVersion === "complete-map-scope-world-facts-v2"
    && pack?.canvas?.width === 1024
    && pack?.canvas?.height === 768
    && pack?.canvas?.frameScope === "complete_runtime_frame"
    && pack?.categoricalConditions?.sceneIntent?.sceneType === "training_complete_natural_home_map"
    && ["entrance", "main_path", "natural_boundary"].every((value) => mustShow.has(value))
    && !mustShow.has("home_center")
    && task?.schemaVersion === "runtime-frame-generation-task-v1"
    && task?.generationContractVersion === "complete-map-scope-world-facts-v2"
    && task?.conditionLabel === selectedSample?.conditionLabel
    && task?.singleMapScope?.activeGoal === "single_complete_map_visual"
    && task?.outputSize?.frameScope === "complete_runtime_frame"
    && task?.taskSha256 === pack?.taskSha256
    && canonicalJsonHashMatches(task, "taskSha256")
}
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
