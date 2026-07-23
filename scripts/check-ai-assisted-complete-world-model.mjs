import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { catalogPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v4.json")
const v5Config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v5.json")
const v6Config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json")
const v7Config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json")
const historicalV3Config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v3.json")
const legacyAutoencoderConfig = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v2.json")
const modelSource = readText("ml/ai-painter/src/ai_painter/complete_world/model.py")
const datasetSource = readText("ml/ai-painter/src/ai_painter/complete_world/dataset.py")
const trainerSource = readText("ml/ai-painter/scripts/train_ai_assisted_complete_world.py")
const runnerSource = readText("scripts/train-ai-assisted-complete-world-model.mjs")
const conditionalTrainerSource = readText("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const conditionalRunnerSource = readText("scripts/train-ai-assisted-conditional-denoiser.mjs")
const conditionalArtifactRepairSource = readText("scripts/repair-ai-assisted-conditional-denoiser-artifact-index.mjs")
const inferenceValidationSamplerSource = readText("ml/ai-painter/scripts/infer_ai_assisted_conditional_validation.py")
const inferenceValidationRunnerSource = readText("scripts/run-ai-assisted-conditional-inference-validation.mjs")
const inferenceValidationReviewerSource = readText("scripts/review-ai-assisted-conditional-inference-validation.mjs")
const professionalAestheticSource = readText("scripts/lib/ai-assisted-professional-aesthetic.mjs")
const checkpoint = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const conditionalProgramCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v4/latest-program-check.json")
const conditionalTrainingCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v4/latest.json")
const historicalV3TrainingCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v2/latest.json")
const inferenceValidation = readJson(".runtime/ai-painter/ai-assisted-conditional-inference-validation/latest.json")
const autoVisualJudgeLearning = readJson(".runtime/ai-painter/auto-visual-judge-learning/latest.json")
const v5RepairPointer = readJson(".runtime/ai-painter/ai-assisted-conditional-v5-repair-checks/latest.json")
const v5RepairReport = v5RepairPointer?.runPath ? readJson(v5RepairPointer.runPath) : null
const v5DiagnosisPointer = readJson(".runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v5/latest.json")
const v5DiagnosisReport = v5DiagnosisPointer?.runPath ? readJson(v5DiagnosisPointer.runPath) : null
const v6RepairPointer = readJson(".runtime/ai-painter/ai-assisted-conditional-v6-repair-checks/latest.json")
const v6RepairReport = v6RepairPointer?.runPath ? readJson(v6RepairPointer.runPath) : null
const v6DiagnosisPointer = readJson(".runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v6/latest.json")
const v6DiagnosisReport = v6DiagnosisPointer?.runPath ? readJson(v6DiagnosisPointer.runPath) : null
const v7RepairPointer = readJson(".runtime/ai-painter/ai-assisted-conditional-v7-repair-checks/latest.json")
const v7RepairReport = v7RepairPointer?.runPath ? readJson(v7RepairPointer.runPath) : null
const v7CapacityPointer = readJson(".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json")
const v7CapacityPlan = v7CapacityPointer?.capacityPlanPath ? readJson(v7CapacityPointer.capacityPlanPath) : null
const v7CoverageMatrix = v7CapacityPointer?.coverageMatrixPath ? readJson(v7CapacityPointer.coverageMatrixPath) : null
const v7GapList = v7CapacityPointer?.gapListPath ? readJson(v7CapacityPointer.gapListPath) : null
const v6ProgramCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v6/latest-program-check.json")
const v6Stage0TrainingCheckpoint = readLatestConditionalStageManifest("v6", 0)
const v6Stage1TrainingCheckpoint = readLatestConditionalStageManifest("v6", 1)
const v6Stage2TrainingCheckpoint = readLatestConditionalStageManifest("v6", 2)
const v5ProgramCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v5/latest-program-check.json")
const v5Stage0TrainingCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v5/ai-assisted-conditional-denoiser-v5-stage-0-2026-07-20T23-58-58-343Z/manifest.json")
const v5Stage1TrainingCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v5/ai-assisted-conditional-denoiser-v5-stage-1-2026-07-21T00-47-30-506Z/manifest.json")
const v5TrainingCheckpoint = readJson(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v5/latest.json")
const v5InferenceValidation = readJson(".runtime/ai-painter/ai-assisted-conditional-inference-validation/ai-assisted-conditional-inference-validation-v5-2026-07-21T08-45-43-210Z/manifest.json")
const storageCatalogRepairPointer = readJson(".runtime/ai-painter/storage-catalog-repairs/latest.json")
const storageCatalogRepairReport = storageCatalogRepairPointer?.runPath ? readJson(storageCatalogRepairPointer.runPath) : null
const v5SmokeRunId = v5ProgramCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v5ProgramCheckpoint.checkpointPath))
  : null
const v5Stage0TrainingRunId = v5Stage0TrainingCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v5Stage0TrainingCheckpoint.checkpointPath))
  : null
const v5Stage1TrainingRunId = v5Stage1TrainingCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v5Stage1TrainingCheckpoint.checkpointPath))
  : null
const v5TrainingRunId = v5TrainingCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v5TrainingCheckpoint.checkpointPath))
  : null
const v6SmokeRunId = v6ProgramCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v6ProgramCheckpoint.checkpointPath))
  : null
const v6Stage0TrainingRunId = v6Stage0TrainingCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v6Stage0TrainingCheckpoint.checkpointPath))
  : null
const v6Stage1TrainingRunId = v6Stage1TrainingCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v6Stage1TrainingCheckpoint.checkpointPath))
  : null
const v6Stage2TrainingRunId = v6Stage2TrainingCheckpoint?.checkpointPath
  ? path.basename(path.dirname(v6Stage2TrainingCheckpoint.checkpointPath))
  : null
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
check(v5Config?.status === "stage_2_progressive_training_completed_single_challenge_validation_machine_rejected", "AI-assisted V5 implementation status invalid")
check(v5Config?.architectureVersion === "output-bound-condition-hierarchy-multiscale-unet-v5", "AI-assisted V5 architecture version invalid")
check(v5Config?.conditionChannels === 23, "AI-assisted V5 must retain 23 condition channels")
check(v5Config?.conditionOutputBinding === "predicted_clean_latent_probe_v1", "AI-assisted V5 output-bound condition contract missing")
check(v5Config?.training?.denoiserLossVersion === "velocity_output_bound_condition_texture_hierarchy_v5", "AI-assisted V5 hierarchy loss contract missing")
check(v5Config?.training?.bestCheckpointMetric === "fixed_grid_output_bound_hierarchy_score_v5", "AI-assisted V5 checkpoint metric missing")
check(v5Config?.training?.timestepSampling === "deterministic_stratified_epoch_rotation_v1", "AI-assisted V5 timestep coverage contract missing")
check(v5Config?.training?.strictHeldOutInferenceSplit === "challenge", "AI-assisted V5 strict held-out split invalid")
check(v6Config?.status === "repair_implemented_cpu_verified_pending_owner_authorized_stage_0_smoke", "AI-assisted V6 implementation status invalid")
check(v6Config?.architectureVersion === "decoded-rgb-sparse-region-rollout-multiscale-unet-v6", "AI-assisted V6 architecture version invalid")
check(v6Config?.conditionChannels === 23, "AI-assisted V6 must retain 23 condition channels")
check(v6Config?.conditionOutputBinding === "predicted_clean_latent_and_decoded_rgb_v1", "AI-assisted V6 decoded RGB binding contract missing")
check(v6Config?.training?.denoiserLossVersion === "velocity_decoded_rgb_sparse_region_rollout_v6", "AI-assisted V6 decoded RGB loss contract missing")
check(v6Config?.training?.bestCheckpointMetric === "fixed_grid_plus_deterministic_rollout_rgb_score_v6", "AI-assisted V6 rollout checkpoint metric missing")
check(v6Config?.training?.strictHeldOutInferenceSplit === "challenge", "AI-assisted V6 strict held-out split invalid")
check(v6Config?.thirdPartyWeightsAllowed === false && Array.isArray(v6Config?.upstreamModelIds) && v6Config.upstreamModelIds.length === 0, "AI-assisted V6 third-party weight boundary invalid")
check(v7Config?.status === "repair_implemented_cpu_verified_data_capacity_approved_training_blocked_pending_dataset", "AI-assisted V7 implementation status invalid")
check(v7Config?.architectureVersion === "all-validation-multiseed-semantic-rollout-unet-v7", "AI-assisted V7 architecture version invalid")
check(v7Config?.conditionChannels === 23, "AI-assisted V7 must retain 23 condition channels")
check(v7Config?.conditionOutputBinding === "predicted_clean_latent_and_decoded_rgb_v1", "AI-assisted V7 decoded RGB binding contract missing")
check(v7Config?.training?.denoiserLossVersion === "velocity_decoded_rgb_sparse_region_rollout_v7", "AI-assisted V7 loss contract missing")
check(v7Config?.training?.bestCheckpointMetric === "all_validation_multiseed_worst_case_semantic_rollout_score_v7", "AI-assisted V7 checkpoint metric missing")
check(v7Config?.training?.checkpointRolloutCoverage === "all_validation_samples" && v7Config?.training?.checkpointRolloutSeedsPerSample >= 2, "AI-assisted V7 rollout coverage contract missing")
check(v7Config?.training?.trainingAuthorizationStatus === "blocked_pending_approved_128_dataset_implementation", "AI-assisted V7 training must remain blocked")
check(v7Config?.training?.dataCapacityDecision?.totalCompleteMaps === 128, "AI-assisted V7 approved data capacity must be 128 complete maps")
check(JSON.stringify(v7Config?.training?.dataCapacityDecision?.splitCounts) === JSON.stringify({ train: 96, validation: 16, challenge: 8, regression: 8 }), "AI-assisted V7 approved split must be 96/16/8/8")
check(v7Config?.training?.dataCapacityDecision?.batchImageGenerationAuthorized === false && v7Config?.training?.dataCapacityDecision?.gpuTrainingAuthorized === false, "AI-assisted V7 data decision must not authorize image generation or GPU training")
check(v7Config?.thirdPartyWeightsAllowed === false && Array.isArray(v7Config?.upstreamModelIds) && v7Config.upstreamModelIds.length === 0, "AI-assisted V7 third-party weight boundary invalid")
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
check(conditionalRunnerSource.includes('startsWith(`ai-assisted-conditional-denoiser-${modelVersion}-stage-`)'), "versioned progressive parent checkpoint lookup missing")
check(conditionalRunnerSource.includes("algorithm-evidence.json") && conditionalRunnerSource.includes("sourceFiles"), "V4 training algorithm evidence persistence missing")
check(conditionalRunnerSource.includes("indexArtifactTree") && conditionalRunnerSource.includes("indexWrittenArtifact"), "conditional denoiser automatic artifact indexing missing")
check(conditionalArtifactRepairSource.includes("trainingRerun: false") && conditionalArtifactRepairSource.includes("gpuUsed: false") && conditionalArtifactRepairSource.includes("indexArtifact"), "conditional denoiser storage catalog repair contract missing")
check(inferenceValidationSamplerSource.includes("deterministic_velocity_step") && inferenceValidationSamplerSource.includes("denormalize_latent") && inferenceValidationSamplerSource.includes("condition pack canonical hash is invalid"), "AI-assisted V4 deterministic validation sampler missing")
check(inferenceValidationSamplerSource.includes('checkpoint.get("trainingStage") != "conditional_denoiser_training"')
  && inferenceValidationSamplerSource.includes('checkpoint.get("programValidated") is not True')
  && !inferenceValidationSamplerSource.includes('checkpoint.get("status") != "conditional_denoiser_training_completed_pending_validation"'), "AI-assisted validation sampler checkpoint-state boundary is invalid")
check(inferenceValidationSamplerSource.includes("training_complete_natural_home_map") && inferenceValidationSamplerSource.includes("complete-map composition identities"), "AI-assisted complete-map inference scope gate missing")
check(inferenceValidationRunnerSource.includes("specific_owner_single_image_command_missing"), "specific owner single-image command gate missing")
check(inferenceValidationRunnerSource.includes('values.includes("--v5")') && inferenceValidationRunnerSource.includes("requiredCheckpointProvenance"), "V5 validation routing or checkpoint provenance gate missing")
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
for (const [label, source] of [["model", modelSource], ["trainer", trainerSource], ["runner", runnerSource], ["conditional trainer", conditionalTrainerSource], ["conditional runner", conditionalRunnerSource], ["conditional artifact repair", conditionalArtifactRepairSource], ["validation sampler", inferenceValidationSamplerSource], ["validation runner", inferenceValidationRunnerSource], ["validation reviewer", inferenceValidationReviewerSource], ["professional aesthetic", professionalAestheticSource]]) {
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

const inferenceValidationStatus = inferenceValidation?.status ?? null
const inferenceValidationCompleted = ["machine_rejected", "machine_passed_waiting_owner_review"].includes(inferenceValidationStatus)
const inferenceValidationModelConfig = inferenceValidation?.modelId === v6Config?.modelId
  ? v6Config
  : inferenceValidation?.modelId === v5Config?.modelId
    ? v5Config
    : config
const inferenceValidationCheckpoint = inferenceValidation?.modelId === v6Config?.modelId
  ? v6Stage2TrainingCheckpoint
  : inferenceValidation?.modelId === v5Config?.modelId
    ? v5TrainingCheckpoint
    : conditionalTrainingCheckpoint
const inferenceValidationRunId = inferenceValidation?.runId ?? null
const inferenceValidationValid = !inferenceValidation || (
  inferenceValidationCompleted
  && inferenceValidation?.schemaVersion === "ai-assisted-complete-world-inference-validation-manifest-v1"
  && inferenceValidation?.modelId === inferenceValidationModelConfig?.modelId
  && inferenceValidation?.conditionChannels?.length === 23
  && inferenceValidation?.modelCheckpointSha256 === inferenceValidationCheckpoint?.checkpointSha256
  && (![v5Config?.modelId, v6Config?.modelId].includes(inferenceValidation?.modelId) || inferenceValidation?.sourceSplit === "challenge")
  && inferenceValidation?.formalInferenceEligible === false
  && inferenceValidation?.formalCandidate === false
  && inferenceValidation?.runtimeFrameEligible === false
  && inferenceValidation?.canEnterWorld === false
  && fileHashMatches(inferenceValidation?.outputImagePath, inferenceValidation?.outputImageSha256)
  && fileHashMatches(inferenceValidation?.machineReviewPath, inferenceValidation?.machineReviewSha256)
  && fileHashMatches(inferenceValidation?.modelReportPath, inferenceValidation?.modelReportSha256)
)
check(inferenceValidationValid, "latest conditional inference validation evidence is invalid")
const inferenceValidationCatalogEvidence = readCatalogRunEvidence(inferenceValidationRunId)
const inferenceValidationCatalogValid = !inferenceValidationCompleted || (
  inferenceValidationCatalogEvidence.artifacts.length === 8
  && inferenceValidationCatalogEvidence.artifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && inferenceValidationCatalogEvidence.events.length === 3
  && inferenceValidationCatalogEvidence.events.some((event) => event.kind === "inference_started" && event.status === "running")
  && inferenceValidationCatalogEvidence.events.some((event) => event.kind === "validation_image_generated" && event.status === "success")
  && inferenceValidationCatalogEvidence.events.some((event) => event.kind === "machine_review_process_completed")
  && inferenceValidationCatalogEvidence.events.every((event) => event.title && event.title_zh)
)
check(inferenceValidationCatalogValid, "latest conditional inference validation SQLite artifacts or bilingual events are invalid")
const v5InferenceValidationCatalogEvidence = readCatalogRunEvidence(v5InferenceValidation?.runId)
const v5InferenceValidationCatalogValid = v5InferenceValidation?.status === "machine_rejected"
  && v5InferenceValidationCatalogEvidence.artifacts.length === 7
  && v5InferenceValidationCatalogEvidence.artifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v5InferenceValidationCatalogEvidence.events.length === 3
  && v5InferenceValidationCatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v5InferenceValidationCatalogValid, "historical V5 challenge validation SQLite evidence is invalid")
const inferenceFailureLearningValid = inferenceValidationStatus !== "machine_rejected" || (
  autoVisualJudgeLearning?.trigger === "ai_assisted_conditional_inference_machine_review_failed"
  && autoVisualJudgeLearning?.evidenceRecords?.latestCompleteMapMachineReviewPath === inferenceValidation?.machineReviewPath
)
check(inferenceFailureLearningValid, "latest rejected validation was not ingested by automatic visual-judge learning")

const v5RepairChecks = v5RepairReport?.result?.checks ?? {}
const v5RepairValid = v5RepairReport?.schemaVersion === "ai-assisted-conditional-v5-repair-cpu-regression-v1"
  && v5RepairReport?.status === "passed"
  && v5RepairReport?.repairVersion === "V5"
  && v5RepairReport?.result?.gpuUsed === false
  && v5RepairReport?.result?.imageGenerated === false
  && Object.keys(v5RepairChecks).length >= 13
  && Object.values(v5RepairChecks).every(Boolean)
  && v5RepairReport?.formalInferenceEligible === false
  && v5RepairReport?.runtimeFrameEligible === false
  && v5RepairReport?.canEnterWorld === false
  && v5RepairPointer?.runId === v5RepairReport?.runId
  && Array.isArray(v5RepairReport?.sourceEvidence)
  && v5RepairReport.sourceEvidence.every((evidence) => historicalSourceEvidenceIsRecorded(evidence))
check(v5RepairValid, "AI-assisted V5 repair CPU evidence is missing or invalid")

const v5DiagnosisValid = v5DiagnosisReport?.schemaVersion === "ai-assisted-conditional-v5-diagnosis-and-v6-repair-v1"
  && v5DiagnosisReport?.status === "diagnosis_completed_v6_repair_implementation_authorized"
  && v5DiagnosisReport?.repairVersion === undefined
  && v5DiagnosisReport?.repairBoundary?.newVersion === "V6"
  && v5DiagnosisReport?.sourceValidation?.runId === v5InferenceValidation?.runId
  && v5DiagnosisReport?.sourceValidation?.imageSha256 === v5InferenceValidation?.outputImageSha256
  && v5DiagnosisReport?.sourceValidation?.checkpointSha256 === v5TrainingCheckpoint?.checkpointSha256
  && Array.isArray(v5DiagnosisReport?.findings)
  && v5DiagnosisReport.findings.length >= 3
  && v5DiagnosisReport?.repairBoundary?.gpuTrainingStarted === false
  && v5DiagnosisReport?.repairBoundary?.imageInferenceStarted === false
  && v5DiagnosisReport?.repairBoundary?.formalInferenceEligible === false
  && v5DiagnosisPointer?.runId === v5DiagnosisReport?.runId
  && v5DiagnosisPointer?.repairVersion === "V6"
check(v5DiagnosisValid, "AI-assisted V5 diagnosis evidence is missing or invalid")

const v6RepairChecks = v6RepairReport?.result?.checks ?? {}
const v6RepairValid = v6RepairReport?.schemaVersion === "ai-assisted-conditional-v6-repair-cpu-regression-v1"
  && v6RepairReport?.status === "passed"
  && v6RepairReport?.repairVersion === "V6"
  && v6RepairReport?.result?.gpuUsed === false
  && v6RepairReport?.result?.imageGenerated === false
  && v6RepairReport?.result?.trainingStarted === false
  && Object.keys(v6RepairChecks).length >= 11
  && Object.values(v6RepairChecks).every(Boolean)
  && v6RepairReport?.formalInferenceEligible === false
  && v6RepairReport?.runtimeFrameEligible === false
  && v6RepairReport?.canEnterWorld === false
  && v6RepairPointer?.runId === v6RepairReport?.runId
  && v6RepairPointer?.repairVersion === "V6"
  && Array.isArray(v6RepairReport?.sourceEvidence)
  && v6RepairReport.sourceEvidence.every((evidence) => historicalSourceEvidenceIsRecorded(evidence))
check(v6RepairValid, "AI-assisted V6 repair CPU evidence is missing or invalid")

const v6DiagnosisValid = v6DiagnosisReport?.schemaVersion === "ai-assisted-conditional-v6-failure-diagnosis-v1"
  && v6DiagnosisReport?.status === "diagnosis_completed_repair_contract_ready_training_blocked"
  && v6DiagnosisReport?.sourceValidation?.runId === "ai-assisted-conditional-inference-validation-v6-2026-07-21T20-39-03-363Z"
  && v6DiagnosisReport?.sourceValidation?.imageSha256 === "6ce37acc6278d5d7bbae6210e8273c634358fc1301936be9d394725fe2cf039e"
  && v6DiagnosisReport?.verifiedFacts?.datasetSplitCounts?.train === 16
  && v6DiagnosisReport?.verifiedFacts?.datasetSplitCounts?.validation === 2
  && v6DiagnosisReport?.verifiedFacts?.checkpointRolloutSampleCount === 1
  && v6DiagnosisReport?.repairBoundary?.nextVersion === "V7"
  && v6DiagnosisReport?.repairBoundary?.nextTrainingBlockedUntilSeparateOwnerDecision === true
  && v6DiagnosisReport?.repairBoundary?.gpuTrainingStarted === false
  && v6DiagnosisReport?.repairBoundary?.imageInferenceStarted === false
  && v6DiagnosisPointer?.runId === v6DiagnosisReport?.runId
check(v6DiagnosisValid, "AI-assisted V6 failure diagnosis evidence is missing or invalid")

const v7RepairChecks = v7RepairReport?.result?.checks ?? {}
const v7DiagnosticWarning = v7RepairReport?.professionalAestheticDiagnosticRegression?.diagnosticWarning
const v7RepairValid = v7RepairReport?.schemaVersion === "ai-assisted-conditional-v7-repair-cpu-regression-v1"
  && v7RepairReport?.status === "passed"
  && v7RepairReport?.repairVersion === "V7"
  && v7RepairReport?.sourceV6DiagnosisPath === v6DiagnosisPointer?.runPath
  && v7RepairReport?.result?.gpuUsed === false
  && v7RepairReport?.result?.imageGenerated === false
  && v7RepairReport?.result?.trainingStarted === false
  && Object.keys(v7RepairChecks).length >= 13
  && Object.values(v7RepairChecks).every(Boolean)
  && v7RepairReport?.result?.rolloutMetrics?.rolloutSampleCount === 2
  && v7RepairReport?.result?.rolloutMetrics?.rolloutSeedCountPerSample === 2
  && v7RepairReport?.result?.rolloutMetrics?.rolloutTrajectoryCount === 4
  && v7RepairReport?.trainingAuthorizationStatus === "blocked_pending_approved_128_dataset_implementation"
  && v7RepairReport?.professionalAestheticDiagnosticRegression?.existingMinimumMultiscaleViolationCountPreserved === 4
  && v7DiagnosticWarning?.code === "professional_single_axis_texture_envelope_exceeded_diagnostic"
  && v7RepairReport?.formalInferenceEligible === false
  && v7RepairReport?.runtimeFrameEligible === false
  && v7RepairReport?.canEnterWorld === false
  && v7RepairPointer?.runId === v7RepairReport?.runId
  && v7RepairPointer?.repairVersion === "V7"
  && Array.isArray(v7RepairReport?.sourceEvidence)
  && v7RepairReport.sourceEvidence.every((evidence) => fileHashMatches(evidence?.path, evidence?.sha256))
check(v7RepairValid, "AI-assisted V7 repair CPU evidence is missing or invalid")

const approvedV7Split = { train: 96, validation: 16, challenge: 8, regression: 8 }
const requiredV7Deficit = { train: 80, validation: 14, challenge: 7, regression: 6 }
const v7CapacityPlanValid = v7CapacityPointer?.schemaVersion === "ai-assisted-v7-data-capacity-plan-latest-v1"
  && v7CapacityPointer?.status === "blocked_pending_approved_128_dataset_implementation"
  && v7CapacityPlan?.schemaVersion === "ai-assisted-v7-data-capacity-plan-v1"
  && v7CapacityPlan?.status === v7CapacityPointer?.status
  && v7CapacityPlan?.runId === v7CapacityPointer?.runId
  && v7CoverageMatrix?.schemaVersion === "ai-assisted-v7-data-capacity-coverage-matrix-v1"
  && v7CoverageMatrix?.runId === v7CapacityPointer?.runId
  && v7GapList?.schemaVersion === "ai-assisted-v7-data-capacity-gap-list-v1"
  && v7GapList?.runId === v7CapacityPointer?.runId
  && fileHashMatches(v7CapacityPointer?.capacityPlanPath, v7CapacityPointer?.capacityPlanSha256)
  && fileHashMatches(v7CapacityPointer?.coverageMatrixPath, v7CapacityPointer?.coverageMatrixSha256)
  && fileHashMatches(v7CapacityPointer?.gapListPath, v7CapacityPointer?.gapListSha256)
  && v7CapacityPlan?.evidenceFiles?.coverageMatrixPath === v7CapacityPointer?.coverageMatrixPath
  && v7CapacityPlan?.evidenceFiles?.coverageMatrixSha256 === v7CapacityPointer?.coverageMatrixSha256
  && v7CapacityPlan?.evidenceFiles?.gapListPath === v7CapacityPointer?.gapListPath
  && v7CapacityPlan?.evidenceFiles?.gapListSha256 === v7CapacityPointer?.gapListSha256
  && v7CapacityPlan?.approvedCapacity?.total === 128
  && sameJson(v7CapacityPlan?.approvedCapacity?.splitCounts, approvedV7Split)
  && v7CapacityPlan?.auditSummary?.auditedSourceRecordCount === 21
  && v7CapacityPlan?.auditSummary?.qualifiedExistingRecordCount === 21
  && v7CapacityPlan?.auditSummary?.failedExistingAuditCount === 0
  && v7CapacityPlan?.auditSummary?.uniqueQualifiedImageCount === 21
  && v7CapacityPlan?.auditSummary?.uniqueQualifiedConditionCount === 21
  && v7CapacityPlan?.gapSummary?.requiredNewRecordCount === 107
  && sameJson(v7CapacityPlan?.gapSummary?.finalSplitCounts, approvedV7Split)
  && v7CoverageMatrix?.totals?.currentQualified === 21
  && v7CoverageMatrix?.totals?.planned === 107
  && v7CoverageMatrix?.totals?.final === 128
  && Array.isArray(v7CoverageMatrix?.rows)
  && v7CoverageMatrix.rows.length === 20
  && v7GapList?.approvedTargetCount === 128
  && v7GapList?.auditedSourceRecordCount === 21
  && v7GapList?.qualifiedExistingRecordCount === 21
  && v7GapList?.failedExistingAuditCount === 0
  && v7GapList?.requiredNewRecordCount === 107
  && sameJson(v7GapList?.splitDeficits, requiredV7Deficit)
  && Array.isArray(v7GapList?.plannedSlots)
  && v7GapList.plannedSlots.length === 107
  && v7GapList.plannedSlots.every((slot) => slot?.mapScope === "complete-natural-home-map"
    && slot?.requiredConditionContract === "complete-map-scope-world-facts-v2"
    && slot?.requiredNativeResolution?.width === 1024
    && slot?.requiredNativeResolution?.height === 768
    && slot?.imageGenerationAuthorized === false
    && slot?.gpuTrainingAuthorized === false
    && slot?.automaticBatchGenerationAllowed === false)
  && v7GapList?.gates?.automaticBatchGenerationAllowed === false
  && v7GapList?.gates?.gpuTrainingAllowed === false
  && v7GapList?.gates?.imageGenerationAllowedByThisPlan === false
  && v7CapacityPlan?.executionBoundary?.imagesGenerated === 0
  && v7CapacityPlan?.executionBoundary?.gpuTrainingStarted === false
  && v7CapacityPlan?.executionBoundary?.trainingStarted === false
  && v7CapacityPlan?.automaticStorage === true
  && v7Config?.training?.dataCapacityDecision?.coverageMatrixLatestPath === ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
  && v7Config?.training?.dataCapacityDecision?.programAuditedQualifiedExistingRecords === 21
  && v7Config?.training?.dataCapacityDecision?.programAuditedRequiredNewRecords === 107
check(v7CapacityPlanValid, "AI-assisted V7 approved capacity plan, hashes, matrix, or gap evidence is missing or invalid")

const v6ProgramCheckpointValid = v6ProgramCheckpoint?.schemaVersion === v6Config?.requiredCheckpointProvenance
  && v6ProgramCheckpoint?.status === "conditional_denoiser_program_smoke_test_passed"
  && v6ProgramCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v6ProgramCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v6ProgramCheckpoint?.modelId === v6Config?.modelId
  && v6ProgramCheckpoint?.architectureVersion === v6Config?.architectureVersion
  && v6ProgramCheckpoint?.conditionChannels === 23
  && v6ProgramCheckpoint?.conditionBoundSampleCount === 21
  && v6ProgramCheckpoint?.resolutionStage?.width === 256
  && v6ProgramCheckpoint?.resolutionStage?.height === 192
  && v6ProgramCheckpoint?.programValidated === true
  && v6ProgramCheckpoint?.denoiserTrained === false
  && v6ProgramCheckpoint?.formalInferenceEligible === false
  && v6ProgramCheckpoint?.thirdPartyWeightsLoaded === false
  && v6ProgramCheckpoint?.connectivityCoverage?.thresholdMet === true
  && v6ProgramCheckpoint?.parentDenoiserCheckpointPath === null
  && v6ProgramCheckpoint?.parentDenoiserCheckpointSha256 === null
  && v6ProgramCheckpoint?.bestCheckpointMetric === v6Config?.training?.bestCheckpointMetric
  && v6ProgramCheckpoint?.denoiserLossVersion === v6Config?.training?.denoiserLossVersion
  && v6ProgramCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining === false
  && v6ProgramCheckpoint?.automaticStorage === true
  && !runDirectoryContainsRgb(v6ProgramCheckpoint?.checkpointPath)
  && fileHashMatches(v6ProgramCheckpoint?.checkpointPath, v6ProgramCheckpoint?.checkpointSha256)
  && fileHashMatches(v6ProgramCheckpoint?.conditionEvidencePath, v6ProgramCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v6ProgramCheckpoint?.algorithmEvidencePath, v6ProgramCheckpoint?.algorithmEvidenceSha256)
check(v6ProgramCheckpointValid, "AI-assisted V6 smoke checkpoint or evidence is missing or invalid")

const v6SmokeCatalogEvidence = readCatalogRunEvidence(v6SmokeRunId)
const v6SmokeImmutableArtifacts = v6SmokeCatalogEvidence.artifacts.filter((artifact) =>
  !String(artifact?.logical_path ?? "").endsWith("/latest-program-check.json"))
const v6SmokeCatalogValid = v6SmokeCatalogEvidence.artifacts.length === 6
  && v6SmokeImmutableArtifacts.length === 5
  && v6SmokeImmutableArtifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v6SmokeCatalogEvidence.events.length === 2
  && v6SmokeCatalogEvidence.events.some((event) => event.kind === "training_run_started" && event.status === "running")
  && v6SmokeCatalogEvidence.events.some((event) => event.kind === "training_run_completed" && event.status === "success")
  && v6SmokeCatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v6SmokeCatalogValid, "AI-assisted V6 smoke SQLite artifacts or bilingual events are missing or invalid")

const v6Stage0TrainingCheckpointValid = v6Stage0TrainingCheckpoint?.schemaVersion === v6Config?.requiredCheckpointProvenance
  && v6Stage0TrainingCheckpoint?.status === "conditional_denoiser_training_completed_pending_validation"
  && v6Stage0TrainingCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v6Stage0TrainingCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v6Stage0TrainingCheckpoint?.modelId === v6Config?.modelId
  && v6Stage0TrainingCheckpoint?.architectureVersion === v6Config?.architectureVersion
  && v6Stage0TrainingCheckpoint?.conditionChannels === 23
  && v6Stage0TrainingCheckpoint?.conditionBoundSampleCount === 21
  && v6Stage0TrainingCheckpoint?.resolutionStage?.width === 256
  && v6Stage0TrainingCheckpoint?.resolutionStage?.height === 192
  && v6Stage0TrainingCheckpoint?.programValidated === true
  && v6Stage0TrainingCheckpoint?.denoiserTrained === true
  && v6Stage0TrainingCheckpoint?.formalInferenceEligible === false
  && v6Stage0TrainingCheckpoint?.thirdPartyWeightsLoaded === false
  && v6Stage0TrainingCheckpoint?.connectivityCoverage?.thresholdMet === true
  && v6Stage0TrainingCheckpoint?.parentDenoiserCheckpointPath === null
  && v6Stage0TrainingCheckpoint?.parentDenoiserCheckpointSha256 === null
  && v6Stage0TrainingCheckpoint?.bestCheckpointMetric === v6Config?.training?.bestCheckpointMetric
  && v6Stage0TrainingCheckpoint?.denoiserLossVersion === v6Config?.training?.denoiserLossVersion
  && Number.isInteger(v6Stage0TrainingCheckpoint?.bestEpoch)
  && v6Stage0TrainingCheckpoint.bestEpoch >= 1
  && v6Stage0TrainingCheckpoint.bestEpoch <= v6Config?.training?.denoiserEpochs
  && Number.isFinite(v6Stage0TrainingCheckpoint?.bestValidationMetric)
  && Array.isArray(v6Stage0TrainingCheckpoint?.metrics)
  && v6Stage0TrainingCheckpoint.metrics.length === v6Config?.training?.denoiserEpochs
  && v6Stage0TrainingCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining === false
  && v6Stage0TrainingCheckpoint?.automaticStorage === true
  && !runDirectoryContainsRgb(v6Stage0TrainingCheckpoint?.checkpointPath)
  && fileHashMatches(v6Stage0TrainingCheckpoint?.checkpointPath, v6Stage0TrainingCheckpoint?.checkpointSha256)
  && fileHashMatches(v6Stage0TrainingCheckpoint?.conditionEvidencePath, v6Stage0TrainingCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v6Stage0TrainingCheckpoint?.algorithmEvidencePath, v6Stage0TrainingCheckpoint?.algorithmEvidenceSha256)
check(v6Stage0TrainingCheckpointValid, "AI-assisted V6 stage 0 training checkpoint or evidence is missing or invalid")

const v6Stage0CatalogEvidence = readCatalogRunEvidence(v6Stage0TrainingRunId)
const v6Stage0ImmutableArtifacts = v6Stage0CatalogEvidence.artifacts.filter((artifact) =>
  !String(artifact?.logical_path ?? "").endsWith("/latest.json"))
const v6Stage0CatalogValid = v6Stage0ImmutableArtifacts.length === 5
  && v6Stage0ImmutableArtifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v6Stage0CatalogEvidence.events.length === 2
  && v6Stage0CatalogEvidence.events.some((event) => event.kind === "training_run_started" && event.status === "running")
  && v6Stage0CatalogEvidence.events.some((event) => event.kind === "training_run_completed" && event.status === "success")
  && v6Stage0CatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v6Stage0CatalogValid, "AI-assisted V6 stage 0 SQLite artifacts or bilingual events are missing or invalid")

const v6Stage1TrainingCheckpointValid = v6Stage1TrainingCheckpoint?.schemaVersion === v6Config?.requiredCheckpointProvenance
  && v6Stage1TrainingCheckpoint?.status === "conditional_denoiser_training_completed_pending_validation"
  && v6Stage1TrainingCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v6Stage1TrainingCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v6Stage1TrainingCheckpoint?.modelId === v6Config?.modelId
  && v6Stage1TrainingCheckpoint?.architectureVersion === v6Config?.architectureVersion
  && v6Stage1TrainingCheckpoint?.conditionChannels === 23
  && v6Stage1TrainingCheckpoint?.conditionBoundSampleCount === 21
  && v6Stage1TrainingCheckpoint?.resolutionStage?.width === 512
  && v6Stage1TrainingCheckpoint?.resolutionStage?.height === 384
  && v6Stage1TrainingCheckpoint?.programValidated === true
  && v6Stage1TrainingCheckpoint?.denoiserTrained === true
  && v6Stage1TrainingCheckpoint?.formalInferenceEligible === false
  && v6Stage1TrainingCheckpoint?.thirdPartyWeightsLoaded === false
  && v6Stage1TrainingCheckpoint?.connectivityCoverage?.thresholdMet === true
  && v6Stage1TrainingCheckpoint?.parentDenoiserCheckpointSha256 === v6Stage0TrainingCheckpoint?.checkpointSha256
  && fileHashMatches(v6Stage1TrainingCheckpoint?.parentDenoiserCheckpointPath, v6Stage1TrainingCheckpoint?.parentDenoiserCheckpointSha256)
  && v6Stage1TrainingCheckpoint?.bestCheckpointMetric === v6Config?.training?.bestCheckpointMetric
  && v6Stage1TrainingCheckpoint?.denoiserLossVersion === v6Config?.training?.denoiserLossVersion
  && Number.isInteger(v6Stage1TrainingCheckpoint?.bestEpoch)
  && v6Stage1TrainingCheckpoint.bestEpoch >= 1
  && v6Stage1TrainingCheckpoint.bestEpoch <= v6Config?.training?.denoiserEpochs
  && Number.isFinite(v6Stage1TrainingCheckpoint?.bestValidationMetric)
  && Array.isArray(v6Stage1TrainingCheckpoint?.metrics)
  && v6Stage1TrainingCheckpoint.metrics.length === v6Config?.training?.denoiserEpochs
  && v6Stage1TrainingCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining === false
  && v6Stage1TrainingCheckpoint?.automaticStorage === true
  && !runDirectoryContainsRgb(v6Stage1TrainingCheckpoint?.checkpointPath)
  && fileHashMatches(v6Stage1TrainingCheckpoint?.checkpointPath, v6Stage1TrainingCheckpoint?.checkpointSha256)
  && fileHashMatches(v6Stage1TrainingCheckpoint?.conditionEvidencePath, v6Stage1TrainingCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v6Stage1TrainingCheckpoint?.algorithmEvidencePath, v6Stage1TrainingCheckpoint?.algorithmEvidenceSha256)
check(v6Stage1TrainingCheckpointValid, "AI-assisted V6 stage 1 training checkpoint or evidence is missing or invalid")

const v6Stage1CatalogEvidence = readCatalogRunEvidence(v6Stage1TrainingRunId)
const v6Stage1ImmutableArtifacts = v6Stage1CatalogEvidence.artifacts.filter((artifact) =>
  !String(artifact?.logical_path ?? "").endsWith("/latest.json"))
const v6Stage1CatalogValid = v6Stage1CatalogEvidence.artifacts.length === 5
  && v6Stage1ImmutableArtifacts.length === 5
  && v6Stage1ImmutableArtifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v6Stage1CatalogEvidence.events.length === 2
  && v6Stage1CatalogEvidence.events.some((event) => event.kind === "training_run_started" && event.status === "running")
  && v6Stage1CatalogEvidence.events.some((event) => event.kind === "training_run_completed" && event.status === "success")
  && v6Stage1CatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v6Stage1CatalogValid, "AI-assisted V6 stage 1 SQLite artifacts or bilingual events are missing or invalid")

const v6Stage2TrainingCheckpointValid = v6Stage2TrainingCheckpoint?.schemaVersion === v6Config?.requiredCheckpointProvenance
  && v6Stage2TrainingCheckpoint?.status === "conditional_denoiser_training_completed_pending_validation"
  && v6Stage2TrainingCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v6Stage2TrainingCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v6Stage2TrainingCheckpoint?.modelId === v6Config?.modelId
  && v6Stage2TrainingCheckpoint?.architectureVersion === v6Config?.architectureVersion
  && v6Stage2TrainingCheckpoint?.conditionChannels === 23
  && v6Stage2TrainingCheckpoint?.conditionBoundSampleCount === 21
  && v6Stage2TrainingCheckpoint?.resolutionStage?.width === 1024
  && v6Stage2TrainingCheckpoint?.resolutionStage?.height === 768
  && v6Stage2TrainingCheckpoint?.programValidated === true
  && v6Stage2TrainingCheckpoint?.denoiserTrained === true
  && v6Stage2TrainingCheckpoint?.formalInferenceEligible === false
  && v6Stage2TrainingCheckpoint?.thirdPartyWeightsLoaded === false
  && v6Stage2TrainingCheckpoint?.connectivityCoverage?.thresholdMet === true
  && v6Stage2TrainingCheckpoint?.parentDenoiserCheckpointSha256 === v6Stage1TrainingCheckpoint?.checkpointSha256
  && fileHashMatches(v6Stage2TrainingCheckpoint?.parentDenoiserCheckpointPath, v6Stage2TrainingCheckpoint?.parentDenoiserCheckpointSha256)
  && v6Stage2TrainingCheckpoint?.bestCheckpointMetric === v6Config?.training?.bestCheckpointMetric
  && v6Stage2TrainingCheckpoint?.denoiserLossVersion === v6Config?.training?.denoiserLossVersion
  && Number.isInteger(v6Stage2TrainingCheckpoint?.bestEpoch)
  && v6Stage2TrainingCheckpoint.bestEpoch >= 1
  && v6Stage2TrainingCheckpoint.bestEpoch <= v6Config?.training?.denoiserEpochs
  && Number.isFinite(v6Stage2TrainingCheckpoint?.bestValidationMetric)
  && Array.isArray(v6Stage2TrainingCheckpoint?.metrics)
  && v6Stage2TrainingCheckpoint.metrics.length === v6Config?.training?.denoiserEpochs
  && v6Stage2TrainingCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining === false
  && v6Stage2TrainingCheckpoint?.automaticStorage === true
  && !runDirectoryContainsRgb(v6Stage2TrainingCheckpoint?.checkpointPath)
  && fileHashMatches(v6Stage2TrainingCheckpoint?.checkpointPath, v6Stage2TrainingCheckpoint?.checkpointSha256)
  && fileHashMatches(v6Stage2TrainingCheckpoint?.conditionEvidencePath, v6Stage2TrainingCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v6Stage2TrainingCheckpoint?.algorithmEvidencePath, v6Stage2TrainingCheckpoint?.algorithmEvidenceSha256)
check(v6Stage2TrainingCheckpointValid, "AI-assisted V6 stage 2 training checkpoint or evidence is missing or invalid")

const v6Stage2CatalogEvidence = readCatalogRunEvidence(v6Stage2TrainingRunId)
const v6Stage2ImmutableArtifacts = v6Stage2CatalogEvidence.artifacts.filter((artifact) =>
  !String(artifact?.logical_path ?? "").endsWith("/latest.json"))
const v6Stage2CatalogValid = v6Stage2CatalogEvidence.artifacts.length === 6
  && v6Stage2ImmutableArtifacts.length === 5
  && v6Stage2ImmutableArtifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v6Stage2CatalogEvidence.events.length === 2
  && v6Stage2CatalogEvidence.events.some((event) => event.kind === "training_run_started" && event.status === "running")
  && v6Stage2CatalogEvidence.events.some((event) => event.kind === "training_run_completed" && event.status === "success")
  && v6Stage2CatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v6Stage2CatalogValid, "AI-assisted V6 stage 2 SQLite artifacts or bilingual events are missing or invalid")

const v5ProgramCheckpointValid = v5ProgramCheckpoint?.schemaVersion === v5Config?.requiredCheckpointProvenance
  && v5ProgramCheckpoint?.status === "conditional_denoiser_program_smoke_test_passed"
  && v5ProgramCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v5ProgramCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v5ProgramCheckpoint?.modelId === v5Config?.modelId
  && v5ProgramCheckpoint?.architectureVersion === v5Config?.architectureVersion
  && v5ProgramCheckpoint?.conditionChannels === 23
  && v5ProgramCheckpoint?.conditionBoundSampleCount === 21
  && v5ProgramCheckpoint?.resolutionStage?.width === 256
  && v5ProgramCheckpoint?.resolutionStage?.height === 192
  && v5ProgramCheckpoint?.programValidated === true
  && v5ProgramCheckpoint?.denoiserTrained === false
  && v5ProgramCheckpoint?.formalInferenceEligible === false
  && v5ProgramCheckpoint?.thirdPartyWeightsLoaded === false
  && v5ProgramCheckpoint?.connectivityCoverage?.thresholdMet === true
  && fileHashMatches(v5ProgramCheckpoint?.checkpointPath, v5ProgramCheckpoint?.checkpointSha256)
  && fileHashMatches(v5ProgramCheckpoint?.conditionEvidencePath, v5ProgramCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v5ProgramCheckpoint?.algorithmEvidencePath, v5ProgramCheckpoint?.algorithmEvidenceSha256)
check(v5ProgramCheckpointValid, "AI-assisted V5 smoke checkpoint or evidence is missing or invalid")

const v5StorageCatalogRepairValid = storageCatalogRepairReport?.schemaVersion === "ai-assisted-conditional-denoiser-storage-catalog-repair-v1"
  && storageCatalogRepairReport?.status === "storage_catalog_artifact_index_repaired"
  && storageCatalogRepairReport?.targetRunId === v5SmokeRunId
  && storageCatalogRepairReport?.artifactCount === 5
  && storageCatalogRepairReport?.checkpointModified === false
  && storageCatalogRepairReport?.trainingRerun === false
  && storageCatalogRepairReport?.gpuUsed === false
  && storageCatalogRepairReport?.imageGenerated === false
  && storageCatalogRepairPointer?.runId === storageCatalogRepairReport?.runId
  && Array.isArray(storageCatalogRepairReport?.artifacts)
  && storageCatalogRepairReport.artifacts.length === 5
  && storageCatalogRepairReport.artifacts.every((artifact) => fileHashMatches(artifact?.logicalPath, artifact?.sha256))
check(v5StorageCatalogRepairValid, "AI-assisted V5 smoke storage catalog evidence is missing or invalid")

const v5Stage0TrainingCheckpointValid = v5Stage0TrainingCheckpoint?.schemaVersion === v5Config?.requiredCheckpointProvenance
  && v5Stage0TrainingCheckpoint?.status === "conditional_denoiser_training_completed_pending_validation"
  && v5Stage0TrainingCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v5Stage0TrainingCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v5Stage0TrainingCheckpoint?.modelId === v5Config?.modelId
  && v5Stage0TrainingCheckpoint?.architectureVersion === v5Config?.architectureVersion
  && v5Stage0TrainingCheckpoint?.conditionChannels === 23
  && v5Stage0TrainingCheckpoint?.conditionBoundSampleCount === 21
  && v5Stage0TrainingCheckpoint?.resolutionStage?.width === 256
  && v5Stage0TrainingCheckpoint?.resolutionStage?.height === 192
  && v5Stage0TrainingCheckpoint?.programValidated === true
  && v5Stage0TrainingCheckpoint?.denoiserTrained === true
  && v5Stage0TrainingCheckpoint?.formalInferenceEligible === false
  && v5Stage0TrainingCheckpoint?.thirdPartyWeightsLoaded === false
  && v5Stage0TrainingCheckpoint?.connectivityCoverage?.thresholdMet === true
  && v5Stage0TrainingCheckpoint?.parentDenoiserCheckpointPath === null
  && v5Stage0TrainingCheckpoint?.parentDenoiserCheckpointSha256 === null
  && v5Stage0TrainingCheckpoint?.bestCheckpointMetric === v5Config?.training?.bestCheckpointMetric
  && v5Stage0TrainingCheckpoint?.denoiserLossVersion === v5Config?.training?.denoiserLossVersion
  && Number.isInteger(v5Stage0TrainingCheckpoint?.bestEpoch)
  && v5Stage0TrainingCheckpoint.bestEpoch >= 1
  && v5Stage0TrainingCheckpoint.bestEpoch <= v5Config?.training?.denoiserEpochs
  && Number.isFinite(v5Stage0TrainingCheckpoint?.bestValidationMetric)
  && Array.isArray(v5Stage0TrainingCheckpoint?.metrics)
  && v5Stage0TrainingCheckpoint.metrics.length === v5Config?.training?.denoiserEpochs
  && v5Stage0TrainingCheckpoint?.automaticStorage === true
  && !runDirectoryContainsRgb(v5Stage0TrainingCheckpoint?.checkpointPath)
  && fileHashMatches(v5Stage0TrainingCheckpoint?.checkpointPath, v5Stage0TrainingCheckpoint?.checkpointSha256)
  && fileHashMatches(v5Stage0TrainingCheckpoint?.conditionEvidencePath, v5Stage0TrainingCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v5Stage0TrainingCheckpoint?.algorithmEvidencePath, v5Stage0TrainingCheckpoint?.algorithmEvidenceSha256)
check(v5Stage0TrainingCheckpointValid, "AI-assisted V5 stage 0 training checkpoint or evidence is missing or invalid")

const v5Stage0TrainingCatalogEvidence = readCatalogRunEvidence(v5Stage0TrainingRunId)
const v5Stage0ImmutableArtifacts = v5Stage0TrainingCatalogEvidence.artifacts.filter((artifact) =>
  !String(artifact?.logical_path ?? "").endsWith("/latest.json"))
const v5Stage0TrainingCatalogValid = v5Stage0TrainingCatalogEvidence.artifacts.length === 5
  && v5Stage0ImmutableArtifacts.length === 5
  && v5Stage0ImmutableArtifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v5Stage0TrainingCatalogEvidence.events.length === 2
  && v5Stage0TrainingCatalogEvidence.events.some((event) => event.kind === "training_run_started" && event.status === "running")
  && v5Stage0TrainingCatalogEvidence.events.some((event) => event.kind === "training_run_completed" && event.status === "success")
  && v5Stage0TrainingCatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v5Stage0TrainingCatalogValid, "AI-assisted V5 stage 0 SQLite artifact or bilingual event evidence is missing or invalid")

const v5Stage1TrainingCheckpointValid = v5Stage1TrainingCheckpoint?.schemaVersion === v5Config?.requiredCheckpointProvenance
  && v5Stage1TrainingCheckpoint?.status === "conditional_denoiser_training_completed_pending_validation"
  && v5Stage1TrainingCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v5Stage1TrainingCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v5Stage1TrainingCheckpoint?.modelId === v5Config?.modelId
  && v5Stage1TrainingCheckpoint?.architectureVersion === v5Config?.architectureVersion
  && v5Stage1TrainingCheckpoint?.conditionChannels === 23
  && v5Stage1TrainingCheckpoint?.conditionBoundSampleCount === 21
  && v5Stage1TrainingCheckpoint?.resolutionStage?.width === 512
  && v5Stage1TrainingCheckpoint?.resolutionStage?.height === 384
  && v5Stage1TrainingCheckpoint?.programValidated === true
  && v5Stage1TrainingCheckpoint?.denoiserTrained === true
  && v5Stage1TrainingCheckpoint?.formalInferenceEligible === false
  && v5Stage1TrainingCheckpoint?.thirdPartyWeightsLoaded === false
  && v5Stage1TrainingCheckpoint?.connectivityCoverage?.thresholdMet === true
  && v5Stage1TrainingCheckpoint?.parentDenoiserCheckpointSha256 === v5Stage0TrainingCheckpoint?.checkpointSha256
  && fileHashMatches(v5Stage1TrainingCheckpoint?.parentDenoiserCheckpointPath, v5Stage1TrainingCheckpoint?.parentDenoiserCheckpointSha256)
  && v5Stage1TrainingCheckpoint?.bestCheckpointMetric === v5Config?.training?.bestCheckpointMetric
  && v5Stage1TrainingCheckpoint?.denoiserLossVersion === v5Config?.training?.denoiserLossVersion
  && Number.isInteger(v5Stage1TrainingCheckpoint?.bestEpoch)
  && v5Stage1TrainingCheckpoint.bestEpoch >= 1
  && v5Stage1TrainingCheckpoint.bestEpoch <= v5Config?.training?.denoiserEpochs
  && Number.isFinite(v5Stage1TrainingCheckpoint?.bestValidationMetric)
  && Array.isArray(v5Stage1TrainingCheckpoint?.metrics)
  && v5Stage1TrainingCheckpoint.metrics.length === v5Config?.training?.denoiserEpochs
  && v5Stage1TrainingCheckpoint?.automaticStorage === true
  && !runDirectoryContainsRgb(v5Stage1TrainingCheckpoint?.checkpointPath)
  && fileHashMatches(v5Stage1TrainingCheckpoint?.checkpointPath, v5Stage1TrainingCheckpoint?.checkpointSha256)
  && fileHashMatches(v5Stage1TrainingCheckpoint?.conditionEvidencePath, v5Stage1TrainingCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v5Stage1TrainingCheckpoint?.algorithmEvidencePath, v5Stage1TrainingCheckpoint?.algorithmEvidenceSha256)
check(v5Stage1TrainingCheckpointValid, "AI-assisted V5 stage 1 training checkpoint or evidence is missing or invalid")

const v5Stage1TrainingCatalogEvidence = readCatalogRunEvidence(v5Stage1TrainingRunId)
const v5Stage1ImmutableArtifacts = v5Stage1TrainingCatalogEvidence.artifacts.filter((artifact) =>
  !String(artifact?.logical_path ?? "").endsWith("/latest.json"))
const v5Stage1TrainingCatalogValid = v5Stage1TrainingCatalogEvidence.artifacts.length === 5
  && v5Stage1ImmutableArtifacts.length === 5
  && v5Stage1ImmutableArtifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v5Stage1TrainingCatalogEvidence.events.length === 2
  && v5Stage1TrainingCatalogEvidence.events.some((event) => event.kind === "training_run_started" && event.status === "running")
  && v5Stage1TrainingCatalogEvidence.events.some((event) => event.kind === "training_run_completed" && event.status === "success")
  && v5Stage1TrainingCatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v5Stage1TrainingCatalogValid, "AI-assisted V5 stage 1 SQLite artifact or bilingual event evidence is missing or invalid")

const v5TrainingCheckpointValid = v5TrainingCheckpoint?.schemaVersion === v5Config?.requiredCheckpointProvenance
  && v5TrainingCheckpoint?.status === "conditional_denoiser_training_completed_pending_validation"
  && v5TrainingCheckpoint?.ownership === "project_owned_architecture_ai_assisted_cold_start_weights"
  && v5TrainingCheckpoint?.trainingLane === "ai_assisted_cold_start"
  && v5TrainingCheckpoint?.modelId === v5Config?.modelId
  && v5TrainingCheckpoint?.architectureVersion === v5Config?.architectureVersion
  && v5TrainingCheckpoint?.conditionChannels === 23
  && v5TrainingCheckpoint?.conditionBoundSampleCount === 21
  && v5TrainingCheckpoint?.resolutionStage?.width === 1024
  && v5TrainingCheckpoint?.resolutionStage?.height === 768
  && v5TrainingCheckpoint?.programValidated === true
  && v5TrainingCheckpoint?.denoiserTrained === true
  && v5TrainingCheckpoint?.formalInferenceEligible === false
  && v5TrainingCheckpoint?.thirdPartyWeightsLoaded === false
  && v5TrainingCheckpoint?.connectivityCoverage?.thresholdMet === true
  && v5TrainingCheckpoint?.parentDenoiserCheckpointSha256 === v5Stage1TrainingCheckpoint?.checkpointSha256
  && fileHashMatches(v5TrainingCheckpoint?.parentDenoiserCheckpointPath, v5TrainingCheckpoint?.parentDenoiserCheckpointSha256)
  && v5TrainingCheckpoint?.bestCheckpointMetric === v5Config?.training?.bestCheckpointMetric
  && v5TrainingCheckpoint?.denoiserLossVersion === v5Config?.training?.denoiserLossVersion
  && Number.isInteger(v5TrainingCheckpoint?.bestEpoch)
  && v5TrainingCheckpoint.bestEpoch >= 1
  && v5TrainingCheckpoint.bestEpoch <= v5Config?.training?.denoiserEpochs
  && Number.isFinite(v5TrainingCheckpoint?.bestValidationMetric)
  && Array.isArray(v5TrainingCheckpoint?.metrics)
  && v5TrainingCheckpoint.metrics.length === v5Config?.training?.denoiserEpochs
  && v5TrainingCheckpoint?.automaticStorage === true
  && !runDirectoryContainsRgb(v5TrainingCheckpoint?.checkpointPath)
  && fileHashMatches(v5TrainingCheckpoint?.checkpointPath, v5TrainingCheckpoint?.checkpointSha256)
  && fileHashMatches(v5TrainingCheckpoint?.conditionEvidencePath, v5TrainingCheckpoint?.conditionEvidenceSha256)
  && fileHashMatches(v5TrainingCheckpoint?.algorithmEvidencePath, v5TrainingCheckpoint?.algorithmEvidenceSha256)
check(v5TrainingCheckpointValid, "AI-assisted V5 stage 2 training checkpoint or evidence is missing or invalid")

const v5TrainingCatalogEvidence = readCatalogRunEvidence(v5TrainingRunId)
const v5TrainingCatalogValid = v5TrainingCatalogEvidence.artifacts.length === 6
  && v5TrainingCatalogEvidence.artifacts.every((artifact) => physicalArtifactHashMatches(artifact))
  && v5TrainingCatalogEvidence.events.length === 2
  && v5TrainingCatalogEvidence.events.some((event) => event.kind === "training_run_started" && event.status === "running")
  && v5TrainingCatalogEvidence.events.some((event) => event.kind === "training_run_completed" && event.status === "success")
  && v5TrainingCatalogEvidence.events.every((event) => event.title && event.title_zh)
check(v5TrainingCatalogValid, "AI-assisted V5 stage 2 SQLite artifact or bilingual event evidence is missing or invalid")

const currentConditionPairsComplete = datasetPackageManifest?.currentConditionPairCount > 0
  && datasetPackageManifest.currentConditionPairCount === datasetPackageManifest.conditionOnlyBlueprintCount
  && datasetPackageManifest.currentConditionUnpairedCount === 0
const trainingGateStatus = datasetPackageManifest?.trainingGateStatus ?? null
const connectivityCoveragePending = trainingGateStatus?.connectivityThresholdApproved === true
  && trainingGateStatus?.connectivityCoverageMet === false
const latestValidationIsV5 = inferenceValidation?.modelId === v5Config?.modelId
const latestValidationIsV6 = inferenceValidation?.modelId === v6Config?.modelId
const conditionalDenoiserStatus = v7RepairValid
  ? "v6_failure_diagnosed_v7_repair_cpu_verified_capacity_128_approved_training_blocked_pending_dataset"
  : v6Stage2TrainingCheckpointValid
  ? latestValidationIsV6 && inferenceValidationStatus === "machine_rejected"
    ? "trained_v6_validation_failed_pending_owner_authorized_diagnosis"
    : latestValidationIsV6 && inferenceValidationStatus === "machine_passed_waiting_owner_review"
      ? "trained_v6_validation_passed_waiting_owner_review"
      : "v6_stage_2_training_completed_pending_owner_authorized_single_challenge_validation"
  : v6Stage1TrainingCheckpointValid
  ? "v6_stage_1_training_completed_pending_owner_authorized_stage_2_progressive_training"
  : v6Stage0TrainingCheckpointValid
    ? "v6_stage_0_training_completed_pending_owner_authorized_stage_1_progressive_training"
  : v6ProgramCheckpointValid
    ? "v6_smoke_passed_untrained_pending_owner_authorized_stage_0_progressive_training"
  : v6RepairValid
    ? "v6_repair_cpu_verified_untrained_pending_owner_authorized_stage_0_smoke"
  : v5TrainingCheckpointValid && latestValidationIsV5
  ? inferenceValidationStatus === "machine_rejected"
    ? "trained_v5_validation_failed"
    : inferenceValidationStatus === "machine_passed_waiting_owner_review"
      ? "trained_v5_validation_passed_waiting_owner_review"
      : "trained_v5_pending_formal_inference_validation"
  : conditionalTrainingCheckpointValid && conditionalTrainingCheckpoint
  ? conditionalStageIndex === config.training.resolutionStages.length - 1
    ? inferenceValidationStatus === "machine_rejected"
      ? "trained_v4_validation_failed"
      : inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? "trained_v4_validation_passed_waiting_owner_review"
        : "trained_pending_formal_inference_validation"
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
  architectureStatus: v7RepairValid
    ? "v7_repair_cpu_verified_capacity_128_approved_untrained_pending_dataset_and_owner_training_authorization"
    : v6Stage2TrainingCheckpointValid
    ? latestValidationIsV6 && inferenceValidationStatus === "machine_rejected"
      ? "v6_single_challenge_validation_machine_rejected_pending_owner_authorized_diagnosis"
      : latestValidationIsV6 && inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? "v6_single_challenge_validation_machine_passed_waiting_owner_review"
        : "v6_stage_2_training_completed_pending_owner_authorized_single_challenge_validation"
    : v6Stage1TrainingCheckpointValid
    ? "v6_stage_1_training_completed_pending_owner_authorized_stage_2_progressive_training"
    : v6Stage0TrainingCheckpointValid
      ? "v6_stage_0_training_completed_pending_owner_authorized_stage_1_progressive_training"
    : v6ProgramCheckpointValid
      ? "v6_smoke_passed_pending_owner_authorized_stage_0_progressive_training"
    : v6RepairValid
      ? "v6_repair_cpu_verified_pending_owner_authorized_stage_0_smoke"
    : v5TrainingCheckpointValid
    ? latestValidationIsV5 && inferenceValidationStatus === "machine_rejected"
      ? "v5_single_challenge_validation_machine_rejected_pending_owner_authorized_diagnosis"
      : latestValidationIsV5 && inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? "v5_single_challenge_validation_machine_passed_waiting_owner_review"
        : "v5_stage_2_progressive_training_completed_pending_owner_authorized_single_image_validation"
    : v5ProgramCheckpointValid
      ? "v5_smoke_passed_pending_owner_authorized_stage_0_progressive_training"
    : v5Config?.status ?? null,
  autoencoderWarmupProgramStatus: "implemented",
  conditionalDenoiserProgramStatus: v7RepairValid
    ? "v7_repair_implemented_cpu_verified_untrained"
    : v6Stage2TrainingCheckpointValid
    ? "v6_stage_2_training_completed"
    : v6Stage1TrainingCheckpointValid
    ? "v6_stage_1_training_completed"
    : v6Stage0TrainingCheckpointValid
      ? "v6_stage_0_training_completed"
    : v6ProgramCheckpointValid
      ? "v6_smoke_test_passed_untrained"
    : v6RepairValid
      ? "v6_repair_implemented_cpu_verified_untrained"
    : v5TrainingCheckpointValid
    ? "v5_stage_2_training_completed"
    : v5ProgramCheckpointValid
      ? "v5_smoke_test_passed"
    : conditionalProgramCheckpoint ? "v4_smoke_test_passed" : "implemented_not_smoke_tested",
  inferenceValidationProgramStatus: inferenceValidationSamplerSource && inferenceValidationRunnerSource && inferenceValidationReviewerSource
    ? inferenceValidationStatus === "machine_rejected"
      ? latestValidationIsV6 ? "implemented_v6_validation_machine_rejected" : latestValidationIsV5 ? "implemented_v5_validation_machine_rejected" : "implemented_v4_validation_machine_rejected"
      : inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? latestValidationIsV6 ? "implemented_v6_validation_machine_passed_waiting_owner_review" : latestValidationIsV5 ? "implemented_v5_validation_machine_passed_waiting_owner_review" : "implemented_v4_validation_machine_passed_waiting_owner_review"
        : "implemented_waiting_specific_owner_single_image_command"
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
  conditionalCheckpointStatus: v7RepairValid
    ? "v6_trained_validation_failed_v7_untrained_and_blocked"
    : v6Stage2TrainingCheckpointValid
    ? latestValidationIsV6 && inferenceValidationStatus === "machine_rejected"
      ? "v6_trained_validation_failed"
      : latestValidationIsV6 && inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? "v6_trained_validation_passed_waiting_owner_review"
        : "v6_stage_2_trained_pending_single_challenge_validation"
    : v6Stage1TrainingCheckpointValid
    ? "v6_stage_1_trained_pending_stage_2"
    : v6Stage0TrainingCheckpointValid
      ? "v6_stage_0_trained_pending_stage_1"
    : v6ProgramCheckpointValid
      ? "v6_program_smoke_test_only_untrained"
    : v6RepairValid
      ? "v5_trained_validation_failed_v6_untrained"
    : latestValidationIsV5 && v5TrainingCheckpoint
    ? inferenceValidationStatus === "machine_rejected"
      ? "v5_trained_validation_failed"
      : inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? "v5_trained_validation_passed_waiting_owner_review"
        : "v5_trained_pending_validation"
    : conditionalTrainingCheckpoint
    ? inferenceValidationStatus === "machine_rejected"
      ? "trained_validation_failed"
      : inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? "trained_validation_passed_waiting_owner_review"
        : "trained_pending_validation"
    : conditionalProgramCheckpoint
      ? "program_smoke_test_only"
      : "missing",
  historicalV3Status: historicalV3TrainingCheckpoint ? "preserved_as_failed_validation_history" : "not_present",
  v5RepairStatus: v6RepairValid
    ? "v5_validation_failure_diagnosed_and_superseded_by_untrained_v6_repair"
    : v5TrainingCheckpointValid
    ? latestValidationIsV5 && inferenceValidationStatus === "machine_rejected"
      ? "single_challenge_validation_machine_rejected_pending_owner_authorized_diagnosis"
      : latestValidationIsV5 && inferenceValidationStatus === "machine_passed_waiting_owner_review"
        ? "single_challenge_validation_machine_passed_waiting_owner_review"
        : "stage_2_training_completed_pending_owner_authorized_single_image_validation"
    : v5ProgramCheckpointValid
      ? "smoke_passed_pending_owner_authorized_stage_0_progressive_training"
    : v5RepairValid ? "cpu_validated_pending_owner_authorized_smoke" : "missing_or_invalid",
  v5DiagnosisStatus: v5DiagnosisValid ? "completed_v6_repair_boundary_recorded" : "missing_or_invalid",
  v5DiagnosisRunId: v5DiagnosisReport?.runId ?? null,
  v6RepairStatus: v6Stage2TrainingCheckpointValid
    ? "cpu_verified_smoke_and_three_stage_progressive_training_completed"
    : v6Stage1TrainingCheckpointValid
    ? "cpu_verified_smoke_stage_0_and_stage_1_training_completed"
    : v6Stage0TrainingCheckpointValid
      ? "cpu_verified_smoke_completed_and_stage_0_training_completed"
    : v6ProgramCheckpointValid
      ? "cpu_verified_and_stage_0_smoke_completed"
    : v6RepairValid
      ? "cpu_verified_pending_owner_authorized_stage_0_smoke"
      : "missing_or_invalid",
  v6RepairRunId: v6RepairReport?.runId ?? null,
  v6RepairGpuTrainingStarted: v6RepairReport?.gpuTrainingStarted ?? null,
  v6RepairImageInferenceStarted: v6RepairReport?.imageInferenceStarted ?? null,
  v6DiagnosisStatus: v6DiagnosisValid ? "completed_v7_repair_boundary_recorded" : "missing_or_invalid",
  v6DiagnosisRunId: v6DiagnosisReport?.runId ?? null,
  v6DiagnosisSourceValidationRunId: v6DiagnosisReport?.sourceValidation?.runId ?? null,
  v7RepairStatus: v7RepairValid ? "cpu_verified_capacity_128_approved_training_blocked_pending_dataset" : "missing_or_invalid",
  v7RepairRunId: v7RepairReport?.runId ?? null,
  v7RepairRolloutSampleCount: v7RepairReport?.result?.rolloutMetrics?.rolloutSampleCount ?? null,
  v7RepairRolloutSeedCountPerSample: v7RepairReport?.result?.rolloutMetrics?.rolloutSeedCountPerSample ?? null,
  v7RepairRolloutTrajectoryCount: v7RepairReport?.result?.rolloutMetrics?.rolloutTrajectoryCount ?? null,
  v7RepairProfessionalAestheticDiagnosticCode: v7DiagnosticWarning?.code ?? null,
  v7TrainingAuthorizationStatus: v7Config?.training?.trainingAuthorizationStatus ?? null,
  v7GpuTrainingStarted: v7RepairReport?.gpuTrainingStarted ?? null,
  v7ImageInferenceStarted: v7RepairReport?.imageInferenceStarted ?? null,
  v7CapacityPlanStatus: v7CapacityPlanValid ? "capacity_128_machine_verified_21_qualified_107_required_training_blocked" : "missing_or_invalid",
  v7CapacityPlanRunId: v7CapacityPointer?.runId ?? null,
  v7CapacityQualifiedExistingRecordCount: v7CapacityPlan?.auditSummary?.qualifiedExistingRecordCount ?? null,
  v7CapacityRequiredNewRecordCount: v7CapacityPlan?.gapSummary?.requiredNewRecordCount ?? null,
  v7CapacityFinalSplitCounts: v7CapacityPlan?.gapSummary?.finalSplitCounts ?? null,
  v7CapacityGpuTrainingStarted: v7CapacityPlan?.executionBoundary?.gpuTrainingStarted ?? null,
  v7CapacityImagesGenerated: v7CapacityPlan?.executionBoundary?.imagesGenerated ?? null,
  v6SmokeStatus: v6Stage2TrainingCheckpointValid
    ? "passed_and_followed_by_stage_0_stage_1_and_stage_2_training"
    : v6Stage1TrainingCheckpointValid
    ? "passed_and_followed_by_stage_0_and_stage_1_training"
    : v6Stage0TrainingCheckpointValid
    ? "passed_and_followed_by_stage_0_training"
    : v6ProgramCheckpointValid
      ? "passed_pending_owner_authorized_stage_0_progressive_training"
      : "missing_or_invalid",
  v6SmokeRunId,
  v6SmokeCheckpointSha256: v6ProgramCheckpoint?.checkpointSha256 ?? null,
  v6SmokeConditionBoundSampleCount: v6ProgramCheckpoint?.conditionBoundSampleCount ?? null,
  v6SmokeChallengeMetricsReadDuringTraining: v6ProgramCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining ?? null,
  v6SmokeArtifactCatalogStatus: v6SmokeCatalogValid ? "five_immutable_artifacts_plus_pointer_and_two_bilingual_events_hash_verified" : "missing_or_invalid",
  v6Stage0TrainingStatus: v6Stage2TrainingCheckpointValid
    ? "completed_and_followed_by_stage_1_and_stage_2_training"
    : v6Stage1TrainingCheckpointValid
    ? "completed_and_followed_by_stage_1_training"
    : v6Stage0TrainingCheckpointValid
      ? "completed_pending_owner_authorized_stage_1_progressive_training"
      : "missing_or_invalid",
  v6Stage0TrainingRunId,
  v6Stage0TrainingCheckpointSha256: v6Stage0TrainingCheckpoint?.checkpointSha256 ?? null,
  v6Stage0TrainingBestEpoch: v6Stage0TrainingCheckpoint?.bestEpoch ?? null,
  v6Stage0TrainingBestValidationMetric: v6Stage0TrainingCheckpoint?.bestValidationMetric ?? null,
  v6Stage0TrainingChallengeMetricsReadDuringTraining: v6Stage0TrainingCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining ?? null,
  v6Stage0TrainingArtifactCatalogStatus: v6Stage0CatalogValid ? "five_immutable_artifacts_and_two_bilingual_events_hash_verified_shared_pointer_advanced" : "missing_or_invalid",
  v6Stage1TrainingStatus: v6Stage2TrainingCheckpointValid
    ? "completed_and_followed_by_stage_2_training"
    : v6Stage1TrainingCheckpointValid
      ? "completed_pending_owner_authorized_stage_2_progressive_training"
      : "missing_or_invalid",
  v6Stage1TrainingRunId,
  v6Stage1TrainingCheckpointSha256: v6Stage1TrainingCheckpoint?.checkpointSha256 ?? null,
  v6Stage1TrainingParentCheckpointSha256: v6Stage1TrainingCheckpoint?.parentDenoiserCheckpointSha256 ?? null,
  v6Stage1TrainingBestEpoch: v6Stage1TrainingCheckpoint?.bestEpoch ?? null,
  v6Stage1TrainingBestValidationMetric: v6Stage1TrainingCheckpoint?.bestValidationMetric ?? null,
  v6Stage1TrainingChallengeMetricsReadDuringTraining: v6Stage1TrainingCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining ?? null,
  v6Stage1TrainingArtifactCatalogStatus: v6Stage1CatalogValid ? "five_immutable_artifacts_and_two_bilingual_events_hash_verified_shared_pointer_advanced" : "missing_or_invalid",
  v6Stage2TrainingStatus: v6Stage2TrainingCheckpointValid
    ? latestValidationIsV6 && inferenceValidationCompleted
      ? "completed_and_followed_by_single_challenge_validation"
      : "completed_pending_owner_authorized_single_challenge_validation"
    : "missing_or_invalid",
  v6Stage2TrainingRunId,
  v6Stage2TrainingCheckpointSha256: v6Stage2TrainingCheckpoint?.checkpointSha256 ?? null,
  v6Stage2TrainingParentCheckpointSha256: v6Stage2TrainingCheckpoint?.parentDenoiserCheckpointSha256 ?? null,
  v6Stage2TrainingBestEpoch: v6Stage2TrainingCheckpoint?.bestEpoch ?? null,
  v6Stage2TrainingBestValidationMetric: v6Stage2TrainingCheckpoint?.bestValidationMetric ?? null,
  v6Stage2TrainingChallengeMetricsReadDuringTraining: v6Stage2TrainingCheckpoint?.splitMetrics?.challenge?.metricsReadDuringTraining ?? null,
  v6Stage2TrainingArtifactCatalogStatus: v6Stage2CatalogValid ? "five_immutable_artifacts_plus_pointer_and_two_bilingual_events_hash_verified" : "missing_or_invalid",
  v5SmokeRunId,
  v5SmokeCheckpointSha256: v5ProgramCheckpoint?.checkpointSha256 ?? null,
  v5SmokeArtifactCatalogStatus: v5StorageCatalogRepairValid ? "five_artifacts_indexed_and_hash_verified" : "missing_or_invalid",
  v5Stage0TrainingRunId,
  v5Stage0TrainingCheckpointSha256: v5Stage0TrainingCheckpoint?.checkpointSha256 ?? null,
  v5Stage0TrainingArtifactCatalogStatus: v5Stage0TrainingCatalogValid ? "five_immutable_artifacts_and_two_bilingual_events_hash_verified" : "missing_or_invalid",
  v5Stage1TrainingRunId,
  v5Stage1TrainingCheckpointSha256: v5Stage1TrainingCheckpoint?.checkpointSha256 ?? null,
  v5Stage1TrainingArtifactCatalogStatus: v5Stage1TrainingCatalogValid ? "five_immutable_artifacts_and_two_bilingual_events_hash_verified" : "missing_or_invalid",
  v5TrainingRunId,
  v5TrainingCheckpointSha256: v5TrainingCheckpoint?.checkpointSha256 ?? null,
  v5TrainingBestEpoch: v5TrainingCheckpoint?.bestEpoch ?? null,
  v5TrainingBestValidationMetric: v5TrainingCheckpoint?.bestValidationMetric ?? null,
  v5TrainingArtifactCatalogStatus: v5TrainingCatalogValid ? "six_artifacts_and_two_bilingual_events_hash_verified" : "missing_or_invalid",
  v5InferenceValidationRunId: v5InferenceValidation?.runId ?? null,
  v5InferenceValidationImageSha256: v5InferenceValidation?.outputImageSha256 ?? null,
  v5InferenceValidationIssueCodes: v5InferenceValidation?.machineReviewIssueCodes ?? [],
  v5InferenceValidationCatalogStatus: v5InferenceValidationCatalogValid ? "seven_immutable_artifacts_and_three_bilingual_events_hash_verified_shared_pointer_advanced" : "missing_or_invalid",
  v6InferenceValidationRunId: latestValidationIsV6 ? inferenceValidationRunId : null,
  v6InferenceValidationImageSha256: latestValidationIsV6 ? inferenceValidation?.outputImageSha256 ?? null : null,
  v6InferenceValidationIssueCodes: latestValidationIsV6 ? inferenceValidation?.machineReviewIssueCodes ?? [] : [],
  v6InferenceValidationCatalogStatus: latestValidationIsV6 && inferenceValidationCatalogValid ? "eight_artifacts_and_three_direct_bilingual_events_hash_verified" : "missing_or_invalid",
  formalInferenceReady: false,
  failures,
}
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)

function readJson(value) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, value), "utf8")) } catch { return null } }
function readText(value) { try { return fs.readFileSync(path.join(ROOT, value), "utf8") } catch { return "" } }
function readLatestConditionalStageManifest(modelVersion, stage) {
  const modelRoot = path.join(ROOT, ".runtime", "ai-painter", `project-owned-complete-world-conditional-denoiser-${modelVersion}`)
  try {
    const prefix = `ai-assisted-conditional-denoiser-${modelVersion}-stage-${stage}-`
    const runNames = fs.readdirSync(modelRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left))
    return runNames.length > 0
      ? JSON.parse(fs.readFileSync(path.join(modelRoot, runNames[0], "manifest.json"), "utf8"))
      : null
  } catch {
    return null
  }
}
function check(condition, message) { if (!condition) failures.push(message) }
function historicalSourceEvidenceIsRecorded(evidence) {
  if (!evidence?.path || !/^[a-f0-9]{64}$/i.test(evidence?.sha256 ?? "")) return false
  return fs.existsSync(path.resolve(ROOT, evidence.path))
}
function fileHashMatches(filePath, expected) {
  if (!filePath || !expected) return false
  const absolute = path.resolve(ROOT, filePath)
  if (!fs.existsSync(absolute)) return false
  return crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex") === expected
}
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function runDirectoryContainsRgb(checkpointPath) {
  if (!checkpointPath) return true
  try {
    const runDir = path.dirname(path.resolve(ROOT, checkpointPath))
    return fs.readdirSync(runDir, { recursive: true }).some((entry) => /\.(png|jpe?g|webp)$/i.test(String(entry)))
  } catch {
    return true
  }
}
function readCatalogRunEvidence(runId) {
  if (!runId || !fs.existsSync(catalogPath)) return { artifacts: [], events: [] }
  try {
    const database = new DatabaseSync(catalogPath, { readOnly: true })
    const artifacts = database.prepare(`
      SELECT logical_path, physical_uri, sha256, byte_size
      FROM artifacts WHERE run_id = ? ORDER BY logical_path
    `).all(runId)
    const events = database.prepare(`
      SELECT kind, status, title, title_zh
      FROM program_events WHERE run_id = ? ORDER BY timestamp_utc
    `).all(runId)
    database.close()
    return { artifacts, events }
  } catch {
    return { artifacts: [], events: [] }
  }
}
function physicalArtifactHashMatches(artifact) {
  if (!artifact?.physical_uri || !artifact?.sha256 || !fs.existsSync(artifact.physical_uri)) return false
  const contents = fs.readFileSync(artifact.physical_uri)
  return contents.byteLength === Number(artifact.byte_size)
    && crypto.createHash("sha256").update(contents).digest("hex") === artifact.sha256
}
