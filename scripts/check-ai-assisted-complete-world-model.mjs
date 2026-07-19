import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v4.json")
const historicalV3Config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v3.json")
const legacyAutoencoderConfig = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v2.json")
const modelSource = readText("ml/ai-painter/src/ai_painter/complete_world/model.py")
const datasetSource = readText("ml/ai-painter/src/ai_painter/complete_world/dataset.py")
const trainerSource = readText("ml/ai-painter/scripts/train_ai_assisted_complete_world.py")
const runnerSource = readText("scripts/train-ai-assisted-complete-world-model.mjs")
const conditionalTrainerSource = readText("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const conditionalRunnerSource = readText("scripts/train-ai-assisted-conditional-denoiser.mjs")
const inferenceValidationSamplerSource = readText("ml/ai-painter/scripts/infer_ai_assisted_conditional_validation.py")
const inferenceValidationRunnerSource = readText("scripts/run-ai-assisted-conditional-inference-validation.mjs")
const inferenceValidationReviewerSource = readText("scripts/review-ai-assisted-conditional-inference-validation.mjs")
const professionalAestheticSource = readText("scripts/lib/ai-assisted-professional-aesthetic.mjs")
const checkpoint = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const conditionalProgramCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v4/latest-program-check.json")
const conditionalTrainingCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v4/latest.json")
const historicalV3TrainingCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v2/latest.json")
const datasetPackageLatest = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetPackageManifest = datasetPackageLatest?.manifestPath ? readJson(datasetPackageLatest.manifestPath) : null
const failures = []
const conditionalStageIndex = config?.training?.resolutionStages?.findIndex((stage) =>
  stage?.width === conditionalTrainingCheckpoint?.resolutionStage?.width
  && stage?.height === conditionalTrainingCheckpoint?.resolutionStage?.height) ?? -1

check(config?.schemaVersion === "project-owned-complete-world-model-config-v1", "AI-assisted model config schema invalid")
check(config?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights", "AI-assisted checkpoint ownership invalid")
check(config?.trainingLane === "ai_assisted_cold_start", "AI-assisted training lane invalid")
check(config?.trainingDataPolicyVersion === "owner-authorized-ai-assisted-cold-start-v1", "AI-assisted data policy invalid")
check(config?.initialization === "random_initialization_only", "AI-assisted model must use random initialization")
check(Array.isArray(config?.upstreamModelIds) && config.upstreamModelIds.length === 0, "AI-assisted model upstream weight list must be empty")
check(config?.thirdPartyWeightsAllowed === false, "AI-assisted model must forbid third-party weights")
check(config?.thirdPartyGeneratedTrainingOutputsAllowed === true, "AI-assisted data dependency must be declared")
check(config?.conditionChannels === 23, "AI-assisted architecture must retain 23 condition channels")
check(config?.imageSize?.width === 1024 && config?.imageSize?.height === 768, "AI-assisted architecture native size invalid")
check(config?.architectureVersion === "typed-condition-composite-objective-multiscale-unet-v4", "AI-assisted V4 architecture version invalid")
check(config?.autoencoderArchitecture === "residual_4x_latent_pixel_detail_v2", "AI-assisted pixel-detail autoencoder missing")
check(config?.autoencoderSourceModelId === legacyAutoencoderConfig?.modelId, "AI-assisted V4 autoencoder source identity invalid")
check(config?.datasetPackageModelId === legacyAutoencoderConfig?.modelId, "AI-assisted V4 dataset package identity invalid")
check(config?.denoiserArchitecture === "multiscale_condition_unet_v4", "AI-assisted V4 multiscale denoiser missing")
check(config?.predictionTarget === "velocity_v1", "AI-assisted V4 velocity target missing")
check(config?.latentNormalization === "per_channel_train_split_v1", "AI-assisted V4 latent normalization missing")
check(config?.conditionResizeContract === "discrete_nearest_continuous_bilinear_v1", "AI-assisted V4 typed condition resize contract missing")
check(config?.conditionChannelTypes?.discrete?.length === 15 && config?.conditionChannelTypes?.continuous?.length === 8, "AI-assisted V4 condition type groups invalid")
check(new Set([...(config?.conditionChannelTypes?.discrete ?? []), ...(config?.conditionChannelTypes?.continuous ?? [])]).size === 23, "AI-assisted V4 typed channels must cover the locked channel set")
check(config?.training?.denoiserLossVersion === "velocity_clean_gradient_condition_reconstruction_v4", "AI-assisted V4 composite denoiser loss missing")
check(config?.training?.bestCheckpointMetric === "fixed_grid_composite_condition_quality_score_v4", "AI-assisted V4 composite checkpoint selection missing")
check(config?.latentDownsampleFactor === 4 && config?.latentChannels === 12, "AI-assisted pixel-detail latent contract invalid")
check(config?.training?.autoencoderLossVersion === "pixel_edge_laplacian_v2", "AI-assisted pixel-detail loss contract invalid")
check(modelSource.includes("ProjectOwnedAutoencoder") && modelSource.includes("ProjectOwnedDenoiser"), "project-owned model components missing")
check(datasetSource.includes("AiAssistedColdStartRgbDataset"), "AI-assisted RGB dataset loader missing")
check(datasetSource.includes("AiAssistedConditionalDenoiserDataset") && datasetSource.includes("formalConditionalTrainingEligible"), "AI-assisted conditional dataset loader missing")
check(trainerSource.includes("autoencoder_warmup_only") && trainerSource.includes("denoiserTrained"), "AI-assisted warmup boundary missing")
check(trainerSource.includes("formalInferenceEligible") && trainerSource.includes("thirdPartyGeneratedTrainingOutputUsed"), "AI-assisted provenance declaration missing")
check(runnerSource.includes("project_owned_architecture_ai_assisted_cold_start_weights"), "AI-assisted runner ownership gate missing")
check(runnerSource.includes("previous_ai_assisted_resolution_checkpoint_missing") && trainerSource.includes("project_checkpoint_resume"), "progressive checkpoint inheritance gate missing")
check(conditionalTrainerSource.includes("ai_assisted_23_channel_conditional_denoiser"), "23-channel conditional denoiser training loop missing")
check(conditionalTrainerSource.includes("torch.randn_like") && conditionalTrainerSource.includes("predict_velocity_with_condition_reconstruction") && conditionalTrainerSource.includes("velocity_target") && conditionalTrainerSource.includes("composite_denoiser_losses"), "V4 composite denoiser training contract missing")
check(conditionalTrainerSource.includes("cleanLatentGradientMae") && conditionalTrainerSource.includes("discreteConditionReconstructionBce") && conditionalTrainerSource.includes("continuousConditionReconstructionMae"), "V4 clean-latent or condition reconstruction metrics missing")
check(conditionalTrainerSource.includes("compute_latent_normalization") && conditionalTrainerSource.includes("fixedValidationTimesteps") && conditionalTrainerSource.includes("compositeConditionQualityScore") && conditionalTrainerSource.includes("best_denoiser_state"), "V4 normalization or composite checkpoint selection missing")
check(modelSource.includes('mode="nearest"') && modelSource.includes('mode="bilinear"') && modelSource.includes("resize_typed_conditions"), "V4 typed condition resizing implementation missing")
check(conditionalTrainerSource.includes("load_autoencoder_checkpoint") && conditionalTrainerSource.includes("requires_grad_(False)"), "approved frozen Autoencoder initialization missing")
check(conditionalTrainerSource.includes("load_denoiser_checkpoint") && conditionalTrainerSource.includes("project_denoiser_checkpoint_resume"), "progressive conditional denoiser checkpoint resume missing")
check(conditionalTrainerSource.includes("condition-evidence.json") && conditionalTrainerSource.includes("automaticStorage"), "conditional denoiser evidence persistence missing")
check(conditionalRunnerSource.includes("canTrainConditionalDenoiser") && conditionalRunnerSource.includes("world_connectivity_coverage_missing"), "conditional denoiser runner gates missing")
check(conditionalRunnerSource.includes('startsWith("ai-assisted-conditional-denoiser-v4-stage-")'), "V4 progressive parent checkpoint lookup missing")
check(conditionalRunnerSource.includes("algorithm-evidence.json") && conditionalRunnerSource.includes("sourceFiles"), "V4 training algorithm evidence persistence missing")
check(inferenceValidationSamplerSource.includes("deterministic_velocity_step") && inferenceValidationSamplerSource.includes("denormalize_latent") && inferenceValidationSamplerSource.includes("condition pack canonical hash is invalid"), "AI-assisted V4 deterministic validation sampler missing")
check(inferenceValidationSamplerSource.includes('checkpoint.get("trainingStage") != "conditional_denoiser_training"')
  && inferenceValidationSamplerSource.includes('checkpoint.get("programValidated") is not True')
  && !inferenceValidationSamplerSource.includes('checkpoint.get("status") != "conditional_denoiser_training_completed_pending_validation"'), "AI-assisted validation sampler checkpoint-state boundary is invalid")
check(inferenceValidationSamplerSource.includes("training_complete_natural_home_map") && inferenceValidationSamplerSource.includes("complete-map composition identities"), "AI-assisted complete-map inference scope gate missing")
check(inferenceValidationRunnerSource.includes("specific_owner_single_image_command_missing"), "specific owner single-image command gate missing")
check(inferenceValidationRunnerSource.includes('new Set(["validation", "challenge", "regression"])'), "held-out validation split gate missing")
check(inferenceValidationRunnerSource.includes("validation_condition_channel_evidence_invalid") && inferenceValidationRunnerSource.includes("validation_condition_not_complete_map_scope"), "validation condition evidence gates missing")
check(inferenceValidationRunnerSource.includes("formalCandidate: false") && inferenceValidationRunnerSource.includes("runtimeFrameEligible: false"), "validation isolation boundary missing")
check(inferenceValidationRunnerSource.includes("MACHINE_REVIEWER") && inferenceValidationRunnerSource.includes("machineReviewSha256"), "validation automatic machine-review persistence missing")
check(inferenceValidationRunnerSource.includes("algorithmEvidenceSha256")
  && inferenceValidationRunnerSource.includes("writeProcessEvidence")
  && inferenceValidationRunnerSource.includes('"inference-started"')
  && inferenceValidationRunnerSource.includes('"validation-image-generated"')
  && inferenceValidationRunnerSource.includes('"machine-review-completed"'), "validation immutable process or algorithm evidence persistence missing")
check(inferenceValidationRunnerSource.includes("appendAiPainterProgramEvent")
  && inferenceValidationRunnerSource.includes('kind: "inference_started"')
  && inferenceValidationRunnerSource.includes('kind: "validation_image_generated"')
  && inferenceValidationRunnerSource.includes('kind: status === "blocked" ? "blocked" : "step_failed"'), "validation program-ledger process/failure events missing")
check(inferenceValidationReviewerSource.includes("auditAiAssistedConditionAlignment") && inferenceValidationReviewerSource.includes("auditImageAgainstLatestStyleFingerprint") && inferenceValidationReviewerSource.includes("auditAiAssistedCompositionNovelty"), "validation VJ-2/style/novelty review composition missing")
check(inferenceValidationReviewerSource.includes("auditAiAssistedProfessionalAesthetic") && professionalAestheticSource.includes("owner_approved_complete_map_multiscale_texture_envelope_v2"), "V4 professional aesthetic noise and hierarchy review missing")
check(inferenceValidationReviewerSource.includes('"VJ-0"') && inferenceValidationReviewerSource.includes('"VJ-1"') && inferenceValidationReviewerSource.includes('"VJ-2"') && inferenceValidationReviewerSource.includes('"Professional Aesthetic"'), "validation machine-review gate chain missing")
check(inferenceValidationReviewerSource.includes("refreshGameMapAutoVisualJudgeLearning") && inferenceValidationReviewerSource.includes("automaticStorage: true"), "validation failure learning or automatic storage missing")
for (const [label, source] of [["model", modelSource], ["trainer", trainerSource], ["runner", runnerSource], ["conditional trainer", conditionalTrainerSource], ["conditional runner", conditionalRunnerSource], ["validation sampler", inferenceValidationSamplerSource], ["validation runner", inferenceValidationRunnerSource], ["validation reviewer", inferenceValidationReviewerSource], ["professional aesthetic", professionalAestheticSource]]) {
  check(!/(from_pretrained|StableDiffusionPipeline|ControlNetModel|diffusers)/.test(source), `${label} imports third-party generation weights`)
}

const checkpointValid = checkpoint?.schemaVersion === config?.autoencoderRequiredCheckpointProvenance
  && checkpoint?.status === "autoencoder_warmup_completed_conditioning_blocked"
  && checkpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && checkpoint?.trainingLane === "ai_assisted_cold_start"
  && checkpoint?.modelId === config?.autoencoderSourceModelId
  && checkpoint?.architectureVersion === config?.autoencoderSourceArchitectureVersion
  && checkpoint?.thirdPartyWeightsLoaded === false
  && checkpoint?.thirdPartyGeneratedTrainingOutputUsed === true
  && checkpoint?.aiGenerationDependencyDeclared === true
  && checkpoint?.denoiserTrained === false
  && checkpoint?.formalInferenceEligible === false
  && typeof checkpoint?.createdAtAsiaShanghai === "string"
  && checkpoint?.splitMetrics?.validation?.sampleCount > 0
  && checkpoint?.splitMetrics?.challenge?.sampleCount > 0
  && checkpoint?.splitMetrics?.regression?.sampleCount > 0
  && Array.isArray(checkpoint?.reconstructionEvidence)
  && checkpoint.reconstructionEvidence.length > 0
  && fileHashMatches(checkpoint?.checkpointPath, checkpoint?.checkpointSha256)
  && checkpoint.reconstructionEvidence.every((evidence) => evidence?.formalCandidate === false
    && fileHashMatches(evidence?.imagePath, evidence?.imageSha256))
  && (!checkpoint?.parentCheckpointPath
    || fileHashMatches(checkpoint.parentCheckpointPath, checkpoint.parentCheckpointSha256))

if (checkpoint && !checkpointValid) check(false, "present AI-assisted checkpoint or evidence hash is invalid")

const conditionalProgramCheckpointValid = !conditionalProgramCheckpoint || (
  conditionalProgramCheckpoint?.schemaVersion === config?.requiredCheckpointProvenance
  && conditionalProgramCheckpoint?.status === "conditional_denoiser_program_smoke_test_passed"
  && conditionalProgramCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && conditionalProgramCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && conditionalProgramCheckpoint?.modelId === config?.modelId
  && conditionalProgramCheckpoint?.architectureVersion === config?.architectureVersion
  && conditionalProgramCheckpoint?.conditionChannels === 23
  && conditionalProgramCheckpoint?.programValidated === true
  && conditionalProgramCheckpoint?.denoiserTrained === false
  && conditionalProgramCheckpoint?.predictionTarget === "velocity_v1"
  && conditionalProgramCheckpoint?.latentNormalization?.version === "per_channel_train_split_v1"
  && conditionalProgramCheckpoint?.formalInferenceEligible === false
  && conditionalProgramCheckpoint?.connectivityCoverage?.thresholdMet === true
  && fileHashMatches(conditionalProgramCheckpoint?.checkpointPath, conditionalProgramCheckpoint?.checkpointSha256)
  && fileHashMatches(conditionalProgramCheckpoint?.conditionEvidencePath, conditionalProgramCheckpoint?.conditionEvidenceSha256)
)
if (!conditionalProgramCheckpointValid) check(false, "conditional denoiser program checkpoint or evidence hash is invalid")

const conditionalTrainingCheckpointValid = !conditionalTrainingCheckpoint || (
  conditionalTrainingCheckpoint?.schemaVersion === config?.requiredCheckpointProvenance
  && conditionalTrainingCheckpoint?.status === "conditional_denoiser_training_completed_pending_validation"
  && conditionalTrainingCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && conditionalTrainingCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && conditionalTrainingCheckpoint?.modelId === config?.modelId
  && conditionalTrainingCheckpoint?.architectureVersion === config?.architectureVersion
  && conditionalTrainingCheckpoint?.conditionChannels === 23
  && conditionalTrainingCheckpoint?.programValidated === true
  && conditionalTrainingCheckpoint?.denoiserTrained === true
  && conditionalTrainingCheckpoint?.predictionTarget === "velocity_v1"
  && conditionalTrainingCheckpoint?.latentNormalization?.version === "per_channel_train_split_v1"
  && conditionalTrainingCheckpoint?.bestCheckpointMetric === "fixed_grid_composite_condition_quality_score_v4"
  && conditionalTrainingCheckpoint?.denoiserLossVersion === "velocity_clean_gradient_condition_reconstruction_v4"
  && conditionalTrainingCheckpoint?.conditionResizeContract === "discrete_nearest_continuous_bilinear_v1"
  && conditionalTrainingCheckpoint?.formalInferenceEligible === false
  && conditionalStageIndex >= 0
  && conditionalTrainingCheckpoint?.connectivityCoverage?.thresholdMet === true
  && fileHashMatches(conditionalTrainingCheckpoint?.checkpointPath, conditionalTrainingCheckpoint?.checkpointSha256)
  && fileHashMatches(conditionalTrainingCheckpoint?.conditionEvidencePath, conditionalTrainingCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(conditionalTrainingCheckpoint?.algorithmEvidencePath, conditionalTrainingCheckpoint?.algorithmEvidenceSha256)
  && (conditionalStageIndex === 0
    ? !conditionalTrainingCheckpoint?.parentDenoiserCheckpointPath && !conditionalTrainingCheckpoint?.parentDenoiserCheckpointSha256
    : fileHashMatches(conditionalTrainingCheckpoint?.parentDenoiserCheckpointPath, conditionalTrainingCheckpoint?.parentDenoiserCheckpointSha256))
)
if (!conditionalTrainingCheckpointValid) check(false, "conditional denoiser training checkpoint or evidence hash is invalid")

const historicalV3Preserved = !historicalV3TrainingCheckpoint || (
  historicalV3TrainingCheckpoint?.schemaVersion === historicalV3Config?.requiredCheckpointProvenance
  && historicalV3TrainingCheckpoint?.modelId === historicalV3Config?.modelId
  && historicalV3TrainingCheckpoint?.architectureVersion === historicalV3Config?.architectureVersion
  && historicalV3TrainingCheckpoint?.bestCheckpointMetric === "fixed_grid_velocity_mse"
  && fileHashMatches(historicalV3TrainingCheckpoint?.checkpointPath, historicalV3TrainingCheckpoint?.checkpointSha256)
)
check(historicalV3Preserved, "historical V3 checkpoint was not preserved intact")

const currentConditionPairsComplete = datasetPackageManifest?.currentConditionPairCount > 0
  && datasetPackageManifest.currentConditionPairCount === datasetPackageManifest.conditionOnlyBlueprintCount
  && datasetPackageManifest.currentConditionUnpairedCount === 0
const trainingGateStatus = datasetPackageManifest?.trainingGateStatus ?? null
const connectivityCoveragePending = trainingGateStatus?.connectivityThresholdApproved === true
  && trainingGateStatus?.connectivityCoverageMet === false
const conditionalDenoiserStatus = conditionalTrainingCheckpointValid && conditionalTrainingCheckpoint
  ? conditionalStageIndex === config.training.resolutionStages.length - 1
    ? "trained_pending_formal_inference_validation"
    : `progressive_training_stage_${conditionalStageIndex}_completed`
  : datasetPackageManifest?.canTrainConditionalDenoiser === true
    ? "ready_for_conditional_denoiser_training_program"
  : connectivityCoveragePending
    ? "blocked_pending_world_connectivity_coverage"
    : currentConditionPairsComplete
      ? "blocked_pending_owner_training_gates"
      : "blocked_pending_23_channel_bindings_and_owner_threshold"

const result = {
  ok: failures.length === 0,
  status: failures.length === 0 ? "ai_assisted_complete_world_model_contract_passed" : "ai_assisted_complete_world_model_contract_failed",
  architectureStatus: config?.status ?? null,
  autoencoderWarmupProgramStatus: "implemented",
  conditionalDenoiserProgramStatus: conditionalProgramCheckpoint ? "smoke_test_passed" : "implemented_not_smoke_tested",
  inferenceValidationProgramStatus: inferenceValidationSamplerSource && inferenceValidationRunnerSource && inferenceValidationReviewerSource
    ? "implemented_waiting_specific_owner_single_image_command"
    : "missing",
  visualReconstructionQualityStatus: checkpointValid ? "evidence_saved_no_visual_pass_claim" : "not_evaluated",
  conditionalDenoiserStatus,
  datasetPackageStatus: datasetPackageManifest?.status ?? null,
  trainingGateStatus,
  connectivityCoverage: datasetPackageManifest?.connectivityCoverage ?? null,
  currentConditionPairCount: datasetPackageManifest?.currentConditionPairCount ?? null,
  currentConditionUnpairedCount: datasetPackageManifest?.currentConditionUnpairedCount ?? null,
  datasetPackageBlockers: datasetPackageManifest?.blockers ?? [],
  checkpointStatus: checkpointValid ? "valid_autoencoder_warmup" : checkpoint ? "present_invalid" : "missing",
  conditionalCheckpointStatus: conditionalTrainingCheckpoint
    ? "trained_pending_validation"
    : conditionalProgramCheckpoint
      ? "program_smoke_test_only"
      : "missing",
  historicalV3Status: historicalV3TrainingCheckpoint ? "preserved_as_failed_validation_history" : "not_present",
  formalInferenceReady: false,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, value), "utf8")) } catch { return null } }
function readText(value) { try { return fs.readFileSync(path.join(ROOT, value), "utf8") } catch { return "" } }
function check(condition, message) { if (!condition) failures.push(message) }
function fileHashMatches(filePath, expected) {
  if (!filePath || !expected) return false
  const absolute = path.resolve(ROOT, filePath)
  if (!fs.existsSync(absolute)) return false
  return crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex") === expected
}
