import crypto from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import { evaluateV7TrainingGpuResourceGate } from "./lib/ai-assisted-v7-training-resource-gate.mjs"
import { formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { validateStage4ExecutionEvidenceBinding } from "./lib/ai-painter-stage4-evidence-eligibility.mjs"

const ROOT = process.cwd()
const PYTHON = resolve("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const STAGE_CONTROL_POLICY = "ml/ai-painter/scripts/ai_painter_authorization_policy.py"
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const CONDITION_LABEL = "v7-complete-map-194"
const PREVIEW_EPOCHS = [1, 5, 10, 20, 30]
const SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const DIAGNOSTIC_METRICS = [
  ...["ObjectFootprints", "ObjectTree", "ObjectRock", "ObjectVegetation"].flatMap((prefix) => [
    `stage4Diagnostic${prefix}IndependentLoss`,
    `stage4Diagnostic${prefix}GradientContribution`,
    `stage4Diagnostic${prefix}DecodedResponsePrototypeMae`,
  ]),
  "stage4DiagnosticObjectGradientAvailable",
  "stage4DiagnosticRouteActivationMassRatio",
  "stage4DiagnosticRouteSpatialDistributionL1",
  "stage4DiagnosticRouteCentroidDrift",
  "stage4DiagnosticRouteRequiredBoundaryContactMinimum",
]
const SEMANTIC_RENDERER_DIAGNOSTIC_METRICS = [
  "stage4SemanticRendererFootprintsIndependentLoss",
  "stage4SemanticRendererTreeIndependentLoss",
  "stage4SemanticRendererRockIndependentLoss",
  "stage4SemanticRendererVegetationIndependentLoss",
  "stage4SemanticRendererRouteBoundaryIndependentLoss",
  "stage4SemanticRendererFusionResponseMae",
  "stage4SemanticRendererPrimaryPathAvailable",
]
function semanticMixtureDiagnosticMetricsFromConfig(config) {
  const registry = config?.training?.stage4FactConditionedSemanticMixture?.diagnosticManifestRegistry ?? {}
  const fields = registry.exactFields
  const provenance = registry.configurationProvenance?.reusedDiscreteConditionWeight
  const vegetationRepair = config?.training?.stage4VegetationFinalVisibleSemanticRepair
  const vegetationLuminance = config?.training?.stage4VegetationLuminanceSpatialStructureSupervision
  const objectVisibleStructure = config?.training?.stage4ObjectVisibleStructureSupervision
  const objectReferenceMultiscale = config?.training?.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision
  const expectedCount = objectReferenceMultiscale?.enabled === true
    ? 48
    : objectVisibleStructure?.enabled === true
    ? 32
    : vegetationLuminance?.enabled === true
    ? 29
    : (vegetationRepair?.enabled === true ? 28 : 27)
  if (
    registry.exactFieldCount !== expectedCount
    || !Array.isArray(fields)
    || fields.length !== expectedCount
    || new Set(fields).size !== expectedCount
    || fields.some((field) => typeof field !== "string" || !field.startsWith("stage4SemanticMixture"))
    || fields.includes("stage4SemanticMixtureReusedDiscreteConditionWeight")
    || registry.rejectUnknownFields !== true
    || provenance?.source !== "training.denoiserLossWeights.discreteConditionOutputBinding"
    || provenance?.epochDiagnosticField !== false
    || provenance?.value !== config?.training?.denoiserLossWeights?.discreteConditionOutputBinding
    || (vegetationRepair?.enabled === true
      && !fields.includes("stage4SemanticMixtureVegetationFinalTypedEdgeMae"))
    || (vegetationLuminance?.enabled === true
      && !fields.includes("stage4SemanticMixtureVegetationFinalTypedLuminanceCorrelationLoss"))
    || (objectVisibleStructure?.enabled === true
      && !["Footprints", "Tree", "Rock", "Vegetation"].every((identity) =>
        fields.includes(`stage4SemanticMixture${identity}FinalTypedLuminanceCorrelationLoss`)))
    || (objectReferenceMultiscale?.enabled === true
      && !["Footprints", "Tree", "Rock", "Vegetation"].every((identity) =>
        [
          "NativeLuminanceCorrelationLoss",
          "HalfLuminanceCorrelationLoss",
          "QuarterLuminanceCorrelationLoss",
          "CrossScaleStructureConsistencyLoss",
          "MultiscaleLuminanceStructureLoss",
        ].every((suffix) => fields.includes(`stage4SemanticMixture${identity}FinalTyped${suffix}`))))
  ) throw new Error("semantic_mixture_diagnostic_registry_invalid")
  return fields
}
const V9_REQUEST_ID = "owner-authorized-v9-stage4-sample194-30-epoch-gpu-smoke-20260809"
const V9_SCOPE = "extend_v9_stage4_smoke_support_cpu_regress_preflight_then_one_sample194_30_epoch_gpu_smoke_only"
const V9_CPU_CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py"
const CONTINUOUS_REQUEST_ID = "owner-authorized-stage4-continuous-closure-20260809"
const CONTINUOUS_SCOPE = "continuous_stage4_business_closure_or_route_exit_with_bounded_implementation_repairs"
const CONTINUOUS_AUTHORIZATION_PATH = "data/ai-painter/system-governance/owner-authorized-stage4-continuous-closure-20260809.json"
const CONTINUOUS_AUTHORIZATION_SHA256 = "fcc1ca399339b249d4dc2d12212af999a50720751a841143c6626c54bf12e1a4"
const CONTINUOUS_ROOT = ".runtime/ai-painter/stage4-continuous-closures/20260809-184740761"
const VALIDATION_KERNEL_REQUEST_ID = "owner-authorized-stage4-validation-kernel-through-stage5-20260810"
const VALIDATION_KERNEL_SCOPE = "stage4_validation_kernel_then_single_smoke_full_training_and_stage5_strict_revalidation"
const VALIDATION_KERNEL_AUTHORIZATION_PATH = "data/ai-painter/system-governance/owner-authorized-stage4-validation-kernel-through-stage5-20260810.json"
const VALIDATION_KERNEL_AUTHORIZATION_SHA256 = "73776d1fb0db6e5e0b0e5de8df12a5727238e08969943e5ab25173d64182c229"
const VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-validation-kernel-through-stage5-20260810/implementation-consumption.json"
const VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_SHA256 = "cb140b5552a92eddb99d634503bc1e1e1583f3dbe3b7597e7632e4a3723b10b1"
const VALIDATION_KERNEL_ROOT = ".runtime/ai-painter/stage4-validation-kernel-closures/20260810-023613404"
const SOURCE_V9_AUTHORIZATION_PATH = "data/ai-painter/system-governance/owner-authorized-v9-stage4-sample194-30-epoch-gpu-smoke-20260809.json"
const SOURCE_V9_AUTHORIZATION_SHA256 = "e77183c6c0f6f94e0db75a5dc94f3c66f376e86c598f8164175a8551b7142e1e"
const DYNAMIC_VALIDATION_KERNEL_ACTIONS = Object.freeze({
  stage4SmokeRunnerAuthorizationEntryModification: true,
  cpuCheckerModification: true,
  cpuPositiveNegativeRegression: true,
  realNodeStartupPreflight: true,
  pythonPreflight: true,
  cudaResourcePreflight: true,
  diskBudgetPreflight: true,
  atomicGpuAuthorizationConsumption: true,
  projectAutoencoderReadAndLoadFrozen: true,
  v9FixedRandomInitialization: true,
  optimizerCreation: true,
  backwardExecution: true,
  boundedModelWeightMutation: true,
  singleThirtyEpochV9Smoke: true,
  fiveBoundPreviewWrites: true,
  seventeenDiagnosticMetricWrites: true,
  machineReview: true,
  smokeCheckpointWrite: true,
  stage4FullTraining: false,
  stage1OrStage2: false,
  stage5StrictRevalidation: false,
  formalInference: false,
  checkpointPromotion: false,
  ownerFormalVisualAcceptance: false,
  runtimeFrame: false,
  worldEntry: false,
  worldRuntime: false,
  automaticRetry: false,
  machineReviewThresholdReduction: false,
  failedPreviewPixelsAsTrainingTarget: false,
  freeHyperparameterSearch: false,
})
const DYNAMIC_VALIDATION_KERNEL_IMPLEMENTATION_ACTIONS = Object.freeze({
  runnerDynamicAuthorizationContractSeparation: true,
  cpuCheckerLogicalRuntimeFixturePathFix: true,
})
const DYNAMIC_VALIDATION_KERNEL_EXECUTION_ACTIONS = Object.freeze({
  cpuPositiveNegativeAuthorizationGate: true,
  realNodeStartupPreflight: true,
  pythonPreflight: true,
  cudaResourcePreflight: true,
  diskBudgetPreflight: true,
  atomicGpuAuthorizationConsumption: true,
  projectAutoencoderReadAndLoadFrozen: true,
  v9FixedRandomInitialization: true,
  optimizerCreation: true,
  backwardExecution: true,
  boundedModelWeightMutation: true,
  singleThirtyEpochV9Smoke: true,
  fiveBoundPreviewWrites: true,
  seventeenDiagnosticMetricWrites: true,
  machineReview: true,
  smokeCheckpointWrite: true,
  stage4FullTraining: false,
  stage1OrStage2: false,
  stage5StrictRevalidation: false,
  formalInference: false,
  checkpointPromotion: false,
  ownerFormalVisualAcceptance: false,
  runtimeFrame: false,
  worldEntry: false,
  worldRuntime: false,
  automaticRetry: false,
  machineReviewThresholdReduction: false,
  failedPreviewPixelsAsTrainingTarget: false,
  freeHyperparameterSearch: false,
})
const DUAL_IDENTITY_GPU_AUTHORIZATION_SCHEMA = "ai-painter-stage4-v9-gpu-execution-authorization-v2"
const DUAL_IDENTITY_IMPLEMENTATION_AUTHORIZATION_SCHEMA = "ai-painter-owner-implementation-authorization-v1"
const DUAL_IDENTITY_IMPLEMENTATION_ATTESTATION_STATUS = "stage4_dual_identity_implementation_code_attested_cpu_pending"
const DUAL_IDENTITY_GPU_SCOPE = "stage4_v9_single_sample_model_smoke_execution_only"

export async function runV8Stage4Smoke(argv = process.argv.slice(2)) {
  if (argv.includes("--finalize-existing-semantic-mixture-smoke")) {
    return runExistingSemanticMixtureSmokeFinalization(argv)
  }
  if (argv.includes("--stage4-condition-preserving-semantic-renderer-readonly-diagnostic")) {
    return runConditionPreservingSemanticRendererReadonlyDiagnostic(argv)
  }
  if (argv.includes("--stage4-structure-fact-first-phase0-c-only-continuation")) {
    return runStructureFactFirstPhase0COnlyContinuation(argv)
  }
  if (argv.includes("--stage4-structure-fact-first-phase0-bc-continuation")) {
    return runStructureFactFirstPhase0BCContinuation(argv)
  }
  if (argv.includes("--stage4-structure-fact-first-phase0")) {
    return runStructureFactFirstPhase0(argv)
  }
  if (argv.includes("--stage4-validation-kernel-phase0")) {
    return runStage4ValidationKernelPhase0(argv)
  }
  const authorizationPath = argument(argv, "--gpu-authorization")
  const authorizationSha256 = argument(argv, "--gpu-authorization-sha256")
  const preflightOnly = argv.includes("--preflight-only")
  const cpuContractOnly = argv.includes("--cpu-contract-only")
  const v9Mode = argv.includes("--v9-object-alignment")
  const continuousPreviewMode = argv.includes("--stage4-continuous-preview-contract")
  const validationKernelSmokeMode = argv.includes("--stage4-validation-kernel-model-smoke")
  const structureFactFirstSmokeMode = argv.includes("--stage4-structure-fact-first-model-smoke")
  const semanticRendererSmokeMode = argv.includes("--stage4-condition-preserving-semantic-renderer-model-smoke")
  const semanticMixtureSmokeMode = argv.includes("--stage4-fact-conditioned-semantic-mixture-model-smoke")
  if (structureFactFirstSmokeMode && preflightOnly) {
    const preflightAuthorizationPath = argument(argv, "--preflight-authorization")
    const preflightAuthorizationSha256 = argument(argv, "--preflight-authorization-sha256")
    if (!preflightAuthorizationPath || authorizationPath) throw new Error("structure_fact_first_smoke_preflight_requires_separate_readonly_authorization")
    const preflightAuthorization = readJsonRequired(preflightAuthorizationPath)
    const preflightContext = validateStructureFactFirstSmokePreflightAuthorization(
      preflightAuthorizationPath,
      preflightAuthorization,
      preflightAuthorizationSha256,
    )
    return runStructureFactFirstSmokePreflight(preflightContext)
  }
  if (!authorizationPath) throw new Error("v8_smoke_gpu_authorization_argument_required")
  const authorization = readJsonRequired(authorizationPath)
  const context = validateAuthorization(authorizationPath, authorization, { v9Mode, continuousPreviewMode, validationKernelSmokeMode, structureFactFirstSmokeMode, semanticRendererSmokeMode, semanticMixtureSmokeMode, cpuContractOnly, authorizationSha256 })
  if (cpuContractOnly) {
    console.log(JSON.stringify({ status: `${context.mode}_stage4_smoke_authorization_contract_valid_cpu_only`, gpuStarted: false }, null, 2))
    return 0
  }
  const preflight = runPreflights(context)
  if (context.mode === "semantic-renderer" || context.mode === "semantic-mixture") {
    writeImmutableJson(context.preflightReportPath, preflight)
  }
  if (preflightOnly) {
    console.log(JSON.stringify(preflight, null, 2))
    return preflight.blockers.length === 0 ? 0 : 1
  }
  if (preflight.blockers.length > 0) {
    closeFailure(context, `${context.mode}_stage4_smoke_preflight_failed_closed`, preflight.blockers, { preflight })
    return 1
  }
  const consumption = consumeGpuAuthorization(context, preflight)
  try {
    if (!fileHashMatches(context.autoencoderPath, context.autoencoderSha256)) {
      throw new Error("bound_autoencoder_checkpoint_missing_or_changed_after_consumption")
    }
    const activeConfig = activateConfig(context, consumption)
    writeImmutableJson(context.activeConfigPath, activeConfig)
    const result = await runTrainer(context)
    if (result.exitCode !== 0) throw new Error(`${context.mode}_smoke_trainer_failed:${result.exitCode}`)
    const manifestPath = path.join(context.outputDir, "manifest.json")
    const manifest = readJsonRequired(manifestPath)
    const manifestIssues = validateManifest(context, manifest)
    if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
    const diagnostics = collectDiagnosticEvidence(context, manifest)
    const review = await reviewPreviews(context)
    const blockers = []
    const expectedDiagnosticCount = context.mode === "semantic-renderer"
      ? 7
      : context.mode === "semantic-mixture"
        ? context.semanticMixtureDiagnosticMetrics.length
        : 17
    if (diagnostics.metricCount !== expectedDiagnosticCount || diagnostics.epochs.length !== 5) blockers.push("diagnostic_metric_evidence_incomplete")
    if (review.previewCount !== 5) blockers.push("fixed_preview_machine_review_incomplete")
    if (review.previewFailCount > 0) blockers.push("fixed_preview_machine_review_failed")
    const status = blockers.length === 0
      ? `${context.mode}_stage4_single_sample_30_epoch_gpu_smoke_passed_closed`
      : `${context.mode}_stage4_single_sample_30_epoch_gpu_smoke_failed_closed`
    closeFinal(context, status, blockers, { preflight, consumption, manifest, diagnostics, review, trainer: result })
    return blockers.length === 0 ? 0 : 1
  } catch (error) {
    closeFailure(context, `${context.mode}_stage4_single_sample_30_epoch_gpu_smoke_execution_failed_closed`, [String(error?.message ?? error)], { preflight, consumption, stack: error?.stack })
    return 1
  }
}

export function validateExistingSemanticMixtureSmokeFinalizationAuthorization(
  authorizationPath,
  authorization,
  authorizationSha256,
) {
  const normalizedAuthorizationPath = assertProjectBoundPath(
    authorizationPath,
    "existing_semantic_mixture_finalization_authorization",
  )
  if (!fileHashMatches(normalizedAuthorizationPath, authorizationSha256)) {
    throw new Error("existing_semantic_mixture_finalization_authorization_hash_invalid")
  }
  if (
    authorization.schemaVersion !== "ai-painter-owner-implementation-authorization-v1"
    || authorization.status !== "owner_authorized_unconsumed"
    || authorization.requestId !== authorization.commandRef
    || authorization.scope !== "continue_one_completed_stage4_semantic_mixture_smoke_from_bound_evidence_to_machine_review_and_finalization_only"
  ) throw new Error("existing_semantic_mixture_finalization_identity_invalid")
  const requiredActions = [
    "extend_existing_stage4_runner_with_readonly_existing_smoke_finalization_entry",
    "add_cpu_positive_negative_contract_regression",
    "run_existing_machine_review_on_five_bound_previews",
    "write_machine_review_finalization_terminal_task_capsule_event_ledger_and_sqlite",
  ]
  if (!sameJson(authorization.implementationActions, requiredActions)) {
    throw new Error("existing_semantic_mixture_finalization_actions_invalid")
  }
  const forbidden = new Set(authorization.explicitlyDeniedActions ?? [])
  for (const action of ["trainer_start", "optimizer_creation", "backward_execution", "model_weight_mutation", "checkpoint_write_or_mutation", "smoke_rerun", "machine_review_threshold_change", "failed_preview_pixels_as_training_target", "stage4_full_training_before_smoke_pass"]) {
    if (!forbidden.has(action)) throw new Error(`existing_semantic_mixture_finalization_denial_missing:${action}`)
  }
  const source = authorization.sourceEvidence ?? {}
  for (const key of ["smokeAuthorization", "executionConsumption", "activeConfig", "preflightReport", "manifest", "progress", "stepTelemetry", "smokeCheckpoint"]) {
    const binding = source[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(assertProjectBoundPath(binding.path, `existing_semantic_mixture_${key}`), binding.sha256)) {
      throw new Error(`existing_semantic_mixture_source_binding_invalid:${key}`)
    }
  }
  if (source.smokeCheckpoint.readWeightsAuthorized !== false || source.smokeCheckpoint.promotable !== false) {
    throw new Error("existing_semantic_mixture_checkpoint_boundary_invalid")
  }
  const consumptionPath = assertProjectBoundPath(
    authorization.output?.implementationConsumptionPath,
    "existing_semantic_mixture_implementation_consumption",
  )
  const consumption = readJsonRequired(consumptionPath)
  if (
    consumption.status !== "implementation_authorization_atomically_consumed"
    || consumption.requestId !== authorization.requestId
    || consumption.commandRef !== authorization.commandRef
    || consumption.scope !== authorization.scope
    || consumption.authorizationPath !== normalizedAuthorizationPath
    || consumption.authorizationSha256 !== authorizationSha256
    || consumption.oneTimeConsumption !== true
    || !sameJson(consumption.implementationActions, authorization.implementationActions)
    || !sameJson(consumption.explicitlyDeniedActions, authorization.explicitlyDeniedActions)
  ) throw new Error("existing_semantic_mixture_implementation_consumption_invalid")
  const activeConfig = readJsonRequired(source.activeConfig.path)
  const manifest = readJsonRequired(source.manifest.path)
  const progress = readJsonRequired(source.progress.path)
  const originalAuthorization = readJsonRequired(source.smokeAuthorization.path)
  const originalConsumption = readJsonRequired(source.executionConsumption.path)
  const outputDir = path.dirname(resolve(source.manifest.path))
  const finalizationDir = resolve(assertProjectBoundPath(authorization.output?.finalizationDirectory, "existing_semantic_mixture_finalization"))
  const reviewPath = path.join(outputDir, "fixed-preview-reviews.json")
  if (fs.existsSync(finalizationDir) || fs.existsSync(reviewPath)) throw new Error("existing_semantic_mixture_finalization_output_already_exists")
  if (
    manifest.status !== "conditional_denoiser_single_sample_overfit_smoke_completed"
    || progress.status !== "completed"
    || progress.currentEpoch !== 30
    || progress.liveProgress?.optimizerStep !== 90
    || progress.liveProgress?.percentage !== 100
    || originalConsumption.modelSmokeOrdinal !== 1
    || originalConsumption.maximumModelSmokeExecutions !== 1
    || originalConsumption.oneTimeConsumption !== true
  ) throw new Error("existing_semantic_mixture_training_completion_evidence_invalid")
  if (
    manifest.checkpointPath !== source.smokeCheckpoint.path
    || manifest.checkpointSha256 !== source.smokeCheckpoint.sha256
    || manifest.modelStateHashEvidence?.weightsChanged !== true
  ) throw new Error("existing_semantic_mixture_checkpoint_identity_invalid")
  const smokeContract = activeConfig.training?.factConditionedSemanticMixtureStage4SingleSampleSmokeContract
  if (
    smokeContract?.sampleId !== SAMPLE_ID
    || smokeContract.sampleSplit !== "validation"
    || smokeContract.seed !== 20263722
    || !sameJson(smokeContract.requiredBoundarySides, ["west"])
    || smokeContract.epochCount !== 30
    || !sameJson(smokeContract.previewEpochs, PREVIEW_EPOCHS)
  ) throw new Error("existing_semantic_mixture_fixed_task_identity_invalid")
  const datasetPath = originalAuthorization.bindings?.datasetManifest?.path
  const sourceIndexPath = originalAuthorization.bindings?.datasetSourceIndex?.path
  if (!sourceIndexPath || !fileHashMatches(sourceIndexPath, originalAuthorization.bindings.datasetSourceIndex.sha256)) {
    throw new Error("existing_semantic_mixture_dataset_source_index_invalid")
  }
  const rows = (readJsonRequired(sourceIndexPath).samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || sample.split !== "validation" || sample.imagePath !== smokeContract.imagePath || sample.conditionPackPath !== smokeContract.conditionPackPath) {
    throw new Error("existing_semantic_mixture_sample_identity_invalid")
  }
  if (!sameJson(countSplits(rows), SPLITS)) throw new Error("existing_semantic_mixture_dataset_split_invalid")
  for (const epoch of PREVIEW_EPOCHS) {
    const row = manifest.metrics?.find((item) => item.epoch === epoch)
    const first = row?.validationPreviewArtifact
    const repeated = row?.validationPreviewReproductionArtifact?.repeatedPreview
    if (
      row?.validationPreviewReproductionArtifact?.status !== "fixed_epoch_preview_reproduced_exactly"
      || !first?.previewPath
      || !repeated?.previewPath
      || !fileHashMatches(first.previewPath, first.previewSha256)
      || !fileHashMatches(repeated.previewPath, repeated.previewSha256)
      || first.previewSha256 !== repeated.previewSha256
      || first.rgbTensorSha256 !== repeated.rgbTensorSha256
      || first.conditionTensorSha256 !== repeated.conditionTensorSha256
      || first.denoiserStateSha256 !== repeated.denoiserStateSha256
    ) throw new Error(`existing_semantic_mixture_preview_reproduction_invalid:${epoch}`)
  }
  return {
    mode: "semantic-mixture",
    requestId: authorization.requestId,
    scope: authorization.scope,
    authorization,
    authorizationPath: normalizedAuthorizationPath,
    authorizationSha256,
    inactiveConfig: activeConfig,
    sample,
    outputDir,
    finalizationDir,
    autoencoderSha256: manifest.autoencoderCheckpointSha256,
    semanticMixtureDiagnosticMetrics: semanticMixtureDiagnosticMetricsFromConfig(activeConfig),
    manifest,
    progress,
    originalConsumption,
    preflight: readJsonRequired(source.preflightReport.path),
    continuationConsumption: { ...consumption, path: consumptionPath, sha256: sha256File(consumptionPath) },
  }
}

async function runExistingSemanticMixtureSmokeFinalization(argv) {
  const authorizationPath = argument(argv, "--implementation-authorization")
  const authorizationSha256 = argument(argv, "--implementation-authorization-sha256")
  const cpuContractOnly = argv.includes("--cpu-contract-only")
  if (!authorizationPath || !authorizationSha256) throw new Error("existing_semantic_mixture_finalization_authorization_required")
  const authorization = readJsonRequired(authorizationPath)
  const context = validateExistingSemanticMixtureSmokeFinalizationAuthorization(authorizationPath, authorization, authorizationSha256)
  if (cpuContractOnly) {
    console.log(JSON.stringify({ status: "existing_semantic_mixture_smoke_finalization_contract_valid_cpu_only", trainerStarted: false, gpuStarted: false, checkpointWeightsRead: false }, null, 2))
    return 0
  }
  try {
    const manifestIssues = validateManifest(context, context.manifest)
    if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
    const diagnostics = collectDiagnosticEvidence(context, context.manifest)
    const review = await reviewPreviews(context)
    const blockers = []
    if (diagnostics.metricCount !== context.semanticMixtureDiagnosticMetrics.length || diagnostics.epochs.length !== 5) blockers.push("diagnostic_metric_evidence_incomplete")
    if (review.previewCount !== 5) blockers.push("fixed_preview_machine_review_incomplete")
    if (review.previewFailCount > 0) blockers.push("fixed_preview_machine_review_failed")
    const status = blockers.length === 0
      ? "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_passed_closed"
      : "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed"
    closeFinal(context, status, blockers, {
      preflight: context.preflight,
      consumption: context.originalConsumption,
      manifest: context.manifest,
      diagnostics,
      review,
      continuation: context.continuationConsumption,
    })
    return blockers.length === 0 ? 0 : 1
  } catch (error) {
    closeFailure(context, "semantic-mixture_stage4_existing_smoke_finalization_failed_closed", [String(error?.message ?? error)], { stack: error?.stack, continuation: context.continuationConsumption })
    return 1
  }
}

const SEMANTIC_RENDERER_DIAGNOSTIC_SCHEMA = "ai-painter-owner-stage4-semantic-renderer-readonly-gpu-diagnostic-authorization-v1"
const SEMANTIC_RENDERER_DIAGNOSTIC_SCOPE = "one_stage4_condition_preserving_semantic_renderer_sample194_readonly_gpu_forward_autograd_diagnostic_only"
const SEMANTIC_RENDERER_DIAGNOSTIC_ARCHITECTURE = "stage4_condition_preserving_semantic_renderer_v1"
const SEMANTIC_RENDERER_DIAGNOSTIC_ACTIONS = Object.freeze({
  cpuPositiveNegativeAuthorizationGate: true,
  pythonPreflight: true,
  cudaResourcePreflight: true,
  diskBudgetPreflight: true,
  atomicGpuAuthorizationConsumption: true,
  projectAutoencoderReadAndLoadFrozen: true,
  semanticRendererFixedRandomInitialization: true,
  cudaForward: true,
  torchAutogradGrad: true,
  sevenDiagnosticManifestExport: true,
  cudaTelemetryWrite: true,
  diagnosticReportWrite: true,
  modelStateHashVerification: true,
  optimizerCreation: false,
  backwardExecution: false,
  modelWeightModification: false,
  checkpointWrite: false,
  smoke: false,
  training: false,
  stage4FullTraining: false,
  stage1OrStage2: false,
  stage5StrictRevalidation: false,
  formalInference: false,
  checkpointPromotion: false,
  runtimeFrame: false,
  worldEntry: false,
  automaticRetry: false,
})

async function runConditionPreservingSemanticRendererReadonlyDiagnostic(argv) {
  const authorizationPath = argument(argv, "--gpu-authorization")
  const authorizationSha256 = argument(argv, "--gpu-authorization-sha256")
  if (!authorizationPath || !authorizationSha256) throw new Error("semantic_renderer_diagnostic_authorization_arguments_required")
  const context = validateSemanticRendererDiagnosticAuthorization(authorizationPath, authorizationSha256)
  if (argv.includes("--cpu-contract-only")) {
    console.log(JSON.stringify({
      status: "semantic_renderer_readonly_gpu_diagnostic_authorization_contract_valid_cpu_only",
      requestId: context.authorization.requestId,
      gpuStarted: false,
      checkpointRead: false,
    }, null, 2))
    return 0
  }
  const preflight = runSemanticRendererDiagnosticPreflight(context)
  if (preflight.blockers.length > 0) {
    closeSemanticRendererDiagnosticFailure(context, "semantic_renderer_readonly_gpu_diagnostic_preflight_failed_closed", preflight.blockers, { preflight })
    return 1
  }
  if (argv.includes("--preflight-only")) {
    console.log(JSON.stringify(preflight, null, 2))
    return 0
  }
  const consumption = consumeSemanticRendererDiagnosticAuthorization(context, preflight)
  const executionIdentityPath = path.join(context.evidenceRoot, "gpu-execution-identity.json")
  writeImmutableJson(executionIdentityPath, {
    schemaVersion: "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-execution-identity-v1",
    status: "semantic_renderer_readonly_gpu_diagnostic_execution_active_not_completed",
    requestId: context.authorization.requestId,
    commandRef: context.authorization.commandRef,
    scope: context.authorization.scope,
    authorizationPath: context.authorizationPath,
    authorizationSha256: context.authorizationSha256,
    consumptionPath: consumption.path,
    consumptionSha256: consumption.sha256,
    inactiveConfig: context.authorization.bindings.inactiveConfig,
    projectAutoencoderCheckpoint: context.authorization.bindings.projectAutoencoderCheckpoint,
    runnerSha256: sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"),
    cpuCheckerSha256: sha256File(V9_CPU_CHECKER),
    fixedTaskIdentity: context.authorization.fixedTaskIdentity,
  })
  const result = spawnSync(PYTHON, [
    resolve(V9_CPU_CHECKER),
    "--semantic-renderer-gpu-diagnostic-execute",
    "--execution-authorization", resolve(context.authorizationPath),
    "--execution-authorization-sha256", context.authorizationSha256,
    "--execution-consumption", resolve(consumption.path),
    "--execution-identity", resolve(executionIdentityPath),
    "--gpu-output", resolve(context.outputDirectory),
  ], {
    cwd: ROOT,
    env: pythonEnv(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 900000,
    maxBuffer: 32 * 1024 * 1024,
  })
  writeImmutableJson(path.join(context.evidenceRoot, "gpu-child-process-report.json"), {
    schemaVersion: "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-child-process-v1",
    status: result.status === 0 ? "child_process_completed" : "child_process_failed_closed",
    recordedAtUtc: new Date().toISOString(),
    exitCode: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  })
  if (result.status !== 0) {
    closeSemanticRendererDiagnosticFailure(context, "semantic_renderer_readonly_gpu_diagnostic_execution_failed_closed", ["gpu_diagnostic_child_process_failed"], { consumption, exitCode: result.status })
    return 1
  }
  const terminal = readJsonRequired(path.join(context.outputDirectory, "phase-terminal.json"))
  if (terminal.status !== "stage4_condition_preserving_semantic_renderer_readonly_gpu_diagnostic_passed_closed") {
    closeSemanticRendererDiagnosticFailure(context, "semantic_renderer_readonly_gpu_diagnostic_evidence_invalid_closed", ["gpu_diagnostic_terminal_invalid"], { consumption, terminal })
    return 1
  }
  console.log(result.stdout)
  return 0
}

function validateSemanticRendererDiagnosticAuthorization(value, expectedSha256) {
  const authorizationPath = assertProjectBoundPath(value, "semantic_renderer_diagnostic_authorization")
  if (sha256File(authorizationPath) !== expectedSha256.toLowerCase()) throw new Error("semantic_renderer_diagnostic_authorization_sha256_invalid")
  const authorization = readJsonRequired(authorizationPath)
  if (
    authorization.schemaVersion !== SEMANTIC_RENDERER_DIAGNOSTIC_SCHEMA
    || authorization.status !== "resolved_owner_authorized_not_consumed"
    || authorization.commandRef !== authorization.requestId
    || authorization.scope !== SEMANTIC_RENDERER_DIAGNOSTIC_SCOPE
    || !/^owner-authorized-stage4-semantic-renderer-readonly-gpu-diagnostic-[0-9-]+$/.test(authorization.requestId ?? "")
  ) throw new Error("semantic_renderer_diagnostic_owner_identity_invalid")
  if (!sameExactObject(authorization.executionActions, SEMANTIC_RENDERER_DIAGNOSTIC_ACTIONS)) throw new Error("semantic_renderer_diagnostic_action_set_invalid")
  const fixed = authorization.fixedTaskIdentity ?? {}
  if (
    fixed.architecture !== SEMANTIC_RENDERER_DIAGNOSTIC_ARCHITECTURE
    || fixed.sampleId !== SAMPLE_ID
    || fixed.sampleSplit !== "validation"
    || fixed.seed !== 20263722
    || fixed.timestep !== 999
    || !sameJson(fixed.resolution, { width: 256, height: 192 })
    || !sameJson(fixed.requiredBoundarySides, ["west"])
    || fixed.denoiserInitialization !== "fixed_random_initialization_only"
  ) throw new Error("semantic_renderer_diagnostic_fixed_identity_invalid")
  const requiredBindings = [
    "cpuTerminal", "cpuReport", "inactiveConfig", "architectureSupportContract", "ownerActionRequest",
    "localTaskCapsule", "implementationAuthorization", "implementationConsumption", "implementationAttestation",
    "projectAutoencoderCheckpoint", "datasetManifest",
  ]
  if (!sameJson(Object.keys(authorization.bindings ?? {}).sort(), requiredBindings.sort())) throw new Error("semantic_renderer_diagnostic_binding_set_invalid")
  for (const [name, binding] of Object.entries(authorization.bindings)) {
    const boundPath = assertProjectBoundPath(binding?.path, `semantic_renderer_diagnostic_${name}`)
    if (!binding?.sha256 || !fileHashMatches(boundPath, binding.sha256)) throw new Error(`semantic_renderer_diagnostic_binding_invalid:${name}`)
  }
  const frozen = authorization.frozenImplementation ?? {}
  const frozenFiles = {
    modelSha256: "ml/ai-painter/src/ai_painter/complete_world/model.py",
    trainerSha256: TRAINER,
    modeRegistrySha256: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
    authorizationPolicySha256: STAGE_CONTROL_POLICY,
    executionGrantSha256: "ml/ai-painter/scripts/ai_painter_execution_grant.py",
    inactiveConfigCompilerSha256: "ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py",
  }
  for (const [key, file] of Object.entries(frozenFiles)) if (frozen[key] !== sha256File(file)) throw new Error(`semantic_renderer_diagnostic_frozen_hash_changed:${key}`)
  if (authorization.implementation?.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs") || authorization.implementation?.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)) throw new Error("semantic_renderer_diagnostic_current_implementation_hash_invalid")
  const execution = authorization.execution ?? {}
  const preflightRoot = assertProjectBoundPath(execution.preflightRoot, "semantic_renderer_diagnostic_preflight_root")
  const evidenceRoot = assertProjectBoundPath(execution.evidenceRoot, "semantic_renderer_diagnostic_evidence_root")
  const outputDirectory = assertProjectBoundPath(execution.outputDirectory, "semantic_renderer_diagnostic_output_directory")
  const consumptionPath = assertProjectBoundPath(execution.gpuConsumptionPath, "semantic_renderer_diagnostic_consumption")
  if (fs.existsSync(resolve(outputDirectory)) || fs.existsSync(resolve(consumptionPath))) throw new Error("semantic_renderer_diagnostic_execution_already_started_or_consumed")
  return { authorizationPath, authorizationSha256: expectedSha256.toLowerCase(), authorization, preflightRoot, evidenceRoot, outputDirectory, consumptionPath }
}

function runSemanticRendererDiagnosticPreflight(context) {
  if (fs.existsSync(resolve(context.preflightRoot))) throw new Error("semantic_renderer_diagnostic_preflight_root_already_exists")
  fs.mkdirSync(resolve(context.preflightRoot), { recursive: true })
  const reportPath = path.join(context.preflightRoot, "preflight-report.json")
  const result = spawnSync(PYTHON, [
    resolve(V9_CPU_CHECKER),
    "--semantic-renderer-gpu-diagnostic-preflight",
    "--execution-authorization", resolve(context.authorizationPath),
    "--execution-authorization-sha256", context.authorizationSha256,
    "--preflight-report", resolve(reportPath),
  ], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 180000, maxBuffer: 16 * 1024 * 1024 })
  const blockers = []
  if (result.status !== 0) blockers.push("python_cuda_or_disk_preflight_failed")
  const report = readJson(reportPath)
  if (report?.status !== "semantic_renderer_readonly_gpu_diagnostic_all_preflights_passed_gpu_not_consumed") blockers.push("semantic_renderer_preflight_evidence_invalid")
  return { status: blockers.length === 0 ? "semantic_renderer_readonly_gpu_diagnostic_all_preflights_passed_gpu_not_consumed" : "semantic_renderer_readonly_gpu_diagnostic_preflight_failed_closed", blockers, reportPath: projectPath(reportPath), reportSha256: fs.existsSync(resolve(reportPath)) ? sha256File(reportPath) : null, exitCode: result.status, stdout: result.stdout, stderr: result.stderr }
}

function consumeSemanticRendererDiagnosticAuthorization(context, preflight) {
  const value = {
    schemaVersion: "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-consumption-v1",
    status: "semantic_renderer_readonly_gpu_diagnostic_authorization_atomically_consumed",
    requestId: context.authorization.requestId,
    commandRef: context.authorization.commandRef,
    scope: context.authorization.scope,
    authorizationPath: context.authorizationPath,
    authorizationSha256: context.authorizationSha256,
    preflightReportPath: preflight.reportPath,
    preflightReportSha256: preflight.reportSha256,
    consumedAtUtc: new Date().toISOString(),
    oneTimeConsumption: true,
  }
  writeImmutableJson(context.consumptionPath, value)
  return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
}

function closeSemanticRendererDiagnosticFailure(context, status, blockers, details) {
  if (!fs.existsSync(resolve(context.evidenceRoot))) fs.mkdirSync(resolve(context.evidenceRoot), { recursive: true })
  const reportPath = path.join(context.evidenceRoot, "finalization-report.json")
  const terminalPath = path.join(context.evidenceRoot, "phase-terminal.json")
  if (!fs.existsSync(resolve(reportPath))) writeImmutableJson(reportPath, { schemaVersion: "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-finalization-v1", status, recordedAtUtc: new Date().toISOString(), blockers, details, automaticRetryStarted: false })
  if (!fs.existsSync(resolve(terminalPath))) writeImmutableJson(terminalPath, { schemaVersion: "ai-painter-stage4-semantic-renderer-readonly-gpu-diagnostic-terminal-v1", status, recordedAtUtc: new Date().toISOString(), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, blockers, finalizationPath: projectPath(reportPath), finalizationSha256: sha256File(reportPath), automaticRetryStarted: false, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, checkpointWritten: false, trainingStarted: false })
  console.error(JSON.stringify({ status, blockers, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
}

const STRUCTURE_PHASE0_STATUS = "owner_authorized_stage4_structure_fact_first_phase0_engineering"
const STRUCTURE_PHASE0_ARCHITECTURE = "stage4_structure_fact_first_dual_stage_generator_v1"
const STRUCTURE_SMOKE_MODE_ID = "structure_fact_first_stage4_smoke"
const SEMANTIC_RENDERER_SMOKE_MODE_ID = "condition_preserving_semantic_renderer_stage4_smoke"
const SEMANTIC_RENDERER_SMOKE_ARCHITECTURE = "stage4_condition_preserving_semantic_renderer_v1"
const SEMANTIC_RENDERER_SMOKE_SCOPE = "one_stage4_condition_preserving_semantic_renderer_sample194_30_epoch_model_smoke_only"
const SEMANTIC_RENDERER_SMOKE_SCHEMA = "ai-painter-stage4-condition-preserving-semantic-renderer-smoke-execution-authorization-v1"
const SEMANTIC_MIXTURE_SMOKE_MODE_ID = "fact_conditioned_semantic_mixture_stage4_smoke"
const SEMANTIC_MIXTURE_SMOKE_ARCHITECTURE = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
const SEMANTIC_MIXTURE_SMOKE_SCOPE = "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only"
const SEMANTIC_MIXTURE_SMOKE_SCHEMA = "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1"
const STRUCTURE_SMOKE_ACTIONS = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"].sort()
const STRUCTURE_SMOKE_PREFLIGHT_ACTIONS = ["inspect_autoencoder_identity", "inspect_checkpoint_identity", "select_bound_sample"].sort()
const STRUCTURE_PHASE0_READONLY_ACTIONS = ["inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "select_bound_sample"].sort()
const STRUCTURE_PHASE0_C_ONLY_ACTIONS = [...STRUCTURE_PHASE0_READONLY_ACTIONS]
const STRUCTURE_PHASE0_UPDATE_ACTIONS = [
  ...STRUCTURE_PHASE0_READONLY_ACTIONS,
  "create_optimizer", "execute_backward", "mutate_model_weights", "write_diagnostic_checkpoint",
].sort()
const ALL_EXECUTION_ACTIONS = [
  "select_bound_sample", "inspect_autoencoder_identity", "load_autoencoder", "inspect_checkpoint_identity",
  "load_parent_denoiser", "create_optimizer", "execute_backward", "mutate_model_weights",
  "write_diagnostic_checkpoint", "write_smoke_checkpoint", "run_stage0", "run_stage1", "run_stage2",
  "run_strict_revalidation", "run_formal_inference", "promote_checkpoint", "create_runtime_frame",
  "enter_world", "automatic_retry",
].sort()

async function runStructureFactFirstPhase0(argv) {
  const implementationAuthorizationPath = argument(argv, "--implementation-authorization")
  const implementationConsumptionPath = argument(argv, "--implementation-consumption")
  const phase0AAuthorizationPath = argument(argv, "--phase0-a-authorization")
  const phase0BCAuthorizationPath = argument(argv, "--phase0-bc-authorization")
  const phase0AOnly = argv.includes("--phase0-a-only")
  const cpuReportPath = argument(argv, "--cpu-report")
  const implementationAttestationPath = argument(argv, "--implementation-attestation")
  const requiredIdentities = { implementationAuthorizationPath, implementationConsumptionPath, phase0AAuthorizationPath }
  if (!phase0AOnly) requiredIdentities.phase0BCAuthorizationPath = phase0BCAuthorizationPath
  for (const [label, value] of Object.entries(requiredIdentities)) {
    if (!value) throw new Error(`structure_phase0_${label}_required`)
  }
  const implementationAuthorization = readJsonRequired(implementationAuthorizationPath)
  const implementationConsumption = readJsonRequired(implementationConsumptionPath)
  if (
    implementationAuthorization.status !== "resolved_owner_authorized_not_consumed"
    || implementationConsumption.authorizationSha256 !== sha256File(implementationAuthorizationPath)
    || implementationConsumption.oneTimeConsumption !== true
  ) throw new Error("structure_phase0_implementation_lineage_invalid")
  const phase0A = validateStructurePhase0Authorization(phase0AAuthorizationPath, "causal_readonly", STRUCTURE_PHASE0_READONLY_ACTIONS, implementationAuthorizationPath, implementationConsumptionPath)
  const phase0BC = phase0AOnly
    ? null
    : validateStructurePhase0Authorization(phase0BCAuthorizationPath, "update_and_reproduction", STRUCTURE_PHASE0_UPDATE_ACTIONS, implementationAuthorizationPath, implementationConsumptionPath)
  if (argv.includes("--cpu-contract-only")) {
    console.log(JSON.stringify({ status: "structure_fact_first_phase0_runner_contract_valid_cpu_only", executionScope: phase0AOnly ? "phase0_a_only" : "phase0_a_then_bc", gpuStarted: false, checkpointRead: false, optimizerCreated: false }, null, 2))
    return 0
  }
  if (!cpuReportPath || !implementationAttestationPath) throw new Error("structure_phase0_cpu_evidence_required")
  const cpuReport = readJsonRequired(cpuReportPath)
  const attestation = readJsonRequired(implementationAttestationPath)
  if (
    cpuReport.status !== "structure_fact_first_phase0_cpu_regression_passed"
    || attestation.status !== "structure_fact_first_phase0_implementation_cpu_verified"
    || attestation.cpuReportSha256 !== sha256File(cpuReportPath)
    || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
    || attestation.trainerSha256 !== sha256File(TRAINER)
    || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
  ) throw new Error("structure_phase0_cpu_evidence_invalid")

  const executionRoot = resolve(phase0A.execution.outputRoot)
  const preflightRoot = resolve(phase0A.execution.preflightRoot)
  if (fs.existsSync(executionRoot)) throw new Error("structure_phase0_execution_root_already_exists")
  fs.mkdirSync(preflightRoot, { recursive: false })
  const preflightConfigPath = path.join(preflightRoot, "phase0-a-preflight-config.json")
  writeImmutableJson(preflightConfigPath, buildStructurePhase0Config(phase0A, null, "causal_readonly", true))
  const python = runStructurePhase0PythonPreflight(phase0A, preflightConfigPath)
  const hardware = hardwareSnapshot()
  const disk = diskBudgetSnapshot()
  const blockers = []
  if (python.exitCode !== 0) blockers.push("python_preflight_failed")
  blockers.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  if (!disk.passed) blockers.push("disk_budget_insufficient")
  const preflightReportPath = path.join(preflightRoot, "preflight-report.json")
  writeImmutableJson(preflightReportPath, { schemaVersion: "ai-painter-structure-fact-first-phase0-preflight-v1", status: blockers.length === 0 ? "all_preflights_passed_execution_not_consumed" : "preflights_failed_closed_execution_not_consumed", recordedAtUtc: new Date().toISOString(), cpuReport: { path: projectPath(cpuReportPath), sha256: sha256File(cpuReportPath) }, python, hardware, disk, blockers, phase0AConsumed: false, phase0BCConsumed: false })
  if (blockers.length > 0) throw new Error(`structure_phase0_preflight_failed:${blockers.join(",")}`)

  const runId = `structure-phase0-${timestampId()}`
  const phase0AConsumption = consumeStructurePhase0Authorization(phase0A, phase0AAuthorizationPath, runId, "causal_readonly", preflightReportPath)
  fs.mkdirSync(executionRoot, { recursive: false })
  const phase0ARoot = path.join(executionRoot, "phase0-a")
  fs.mkdirSync(phase0ARoot, { recursive: false })
  const phase0AConfigPath = path.join(phase0ARoot, "active-config.json")
  writeImmutableJson(phase0AConfigPath, buildStructurePhase0Config(phase0A, phase0AConsumption, "causal_readonly", false))
  const phase0AIdentityPath = path.join(phase0ARoot, "execution-identity.json")
  writeImmutableJson(phase0AIdentityPath, buildStructurePhase0Identity(phase0A, phase0AAuthorizationPath, phase0AConsumption, phase0AConfigPath, runId, "causal_readonly"))
  const phase0AOutput = path.join(phase0ARoot, "output")
  const phase0AResult = await runStructurePhase0Trainer(phase0A, phase0AConfigPath, phase0AIdentityPath, phase0AOutput, ["--stage4-structure-fact-first-phase0-causal"])
  const phase0AProcessEvidence = persistStructurePhase0ChildProcessEvidence(phase0ARoot, phase0AResult)
  if (phase0AResult.exitCode !== 0) throw new Error(`structure_phase0_a_failed:${phase0AResult.exitCode}:${phase0AProcessEvidence.reportPath}`)
  const phase0AReportPath = path.join(phase0AOutput, "phase0-a-causal-report.json")
  const phase0AReport = readJsonRequired(phase0AReportPath)
  if (phase0AReport.status !== "structure_fact_first_phase0_a_causal_and_topology_qualification_passed_closed" || phase0AReport.modelStateUnchanged !== true) throw new Error("structure_phase0_a_evidence_invalid")
  if (phase0AOnly) {
    console.log(JSON.stringify({ status: "stage4_structure_fact_first_phase0_a_readonly_qualification_passed_closed", runId, phase0AReportPath: projectPath(phase0AReportPath), phase0AReportSha256: sha256File(phase0AReportPath), processEvidence: phase0AProcessEvidence, phase0BCStarted: false, phase0BCConsumed: false }, null, 2))
    return 0
  }

  return executeStructurePhase0BC({
    phase0BC,
    phase0BCAuthorizationPath,
    executionRoot,
    runId,
    phase0AEvidence: {
      mode: "same_run",
      reportPath: projectPath(phase0AReportPath),
      reportSha256: sha256File(phase0AReportPath),
      consumption: phase0AConsumption,
    },
  })
}

async function runStructureFactFirstPhase0COnlyContinuation(argv) {
  const implementationAuthorizationPath = argument(argv, "--implementation-authorization")
  const implementationConsumptionPath = argument(argv, "--implementation-consumption")
  const phase0CAuthorizationPath = argument(argv, "--phase0-c-authorization")
  const cpuReportPath = argument(argv, "--cpu-report")
  const implementationAttestationPath = argument(argv, "--implementation-attestation")
  for (const [label, value] of Object.entries({ implementationAuthorizationPath, implementationConsumptionPath, phase0CAuthorizationPath })) {
    if (!value) throw new Error(`structure_phase0_c_only_${label}_required`)
  }
  const implementationAuthorization = readJsonRequired(implementationAuthorizationPath)
  const implementationConsumption = readJsonRequired(implementationConsumptionPath)
  if (
    implementationAuthorization.status !== "resolved_owner_authorized_not_consumed"
    || implementationConsumption.authorizationSha256 !== sha256File(implementationAuthorizationPath)
    || implementationConsumption.oneTimeConsumption !== true
  ) throw new Error("structure_phase0_c_only_implementation_lineage_invalid")
  const phase0C = validateStructurePhase0Authorization(
    phase0CAuthorizationPath,
    "causal_readonly",
    STRUCTURE_PHASE0_C_ONLY_ACTIONS,
    implementationAuthorizationPath,
    implementationConsumptionPath,
  )
  if (
    phase0C.phase0Operation !== "checkpoint_reproduction_only"
    || !sameJson(phase0C.authorizedPhase0Steps, ["causal_readonly"])
  ) throw new Error("structure_phase0_c_only_operation_identity_invalid")
  const sourceLineage = validateStructurePhase0COnlyPrerequisites(phase0C)
  if (fs.existsSync(resolve(phase0C.execution.consumptionPath))) {
    throw new Error("structure_phase0_c_only_execution_authorization_already_consumed")
  }
  if (argv.includes("--cpu-contract-only")) {
    console.log(JSON.stringify({
      status: "structure_fact_first_phase0_c_only_contract_valid_cpu_only",
      phase0Operation: phase0C.phase0Operation,
      phase0ARerun: false,
      phase0BRerun: false,
      checkpointRead: false,
      optimizerCreated: false,
      backwardExecuted: false,
      gpuStarted: false,
    }, null, 2))
    return 0
  }
  if (!cpuReportPath || !implementationAttestationPath) throw new Error("structure_phase0_c_only_cpu_evidence_required")
  const cpuReport = readJsonRequired(cpuReportPath)
  const attestation = readJsonRequired(implementationAttestationPath)
  if (
    cpuReport.status !== "structure_fact_first_phase0_canonical_condition_identity_cpu_regression_passed"
    || attestation.status !== "structure_fact_first_phase0_canonical_condition_identity_implementation_cpu_verified"
    || attestation.cpuReportSha256 !== sha256File(cpuReportPath)
    || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
    || attestation.trainerSha256 !== sha256File(TRAINER)
    || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
  ) throw new Error("structure_phase0_c_only_cpu_evidence_invalid")

  const executionRoot = resolve(phase0C.execution.outputRoot)
  const preflightRoot = resolve(phase0C.execution.preflightRoot)
  if (fs.existsSync(executionRoot)) throw new Error("structure_phase0_c_only_execution_root_already_exists")
  if (fs.existsSync(preflightRoot)) throw new Error("structure_phase0_c_only_preflight_root_already_exists")
  fs.mkdirSync(preflightRoot, { recursive: false })
  const preflightConfigPath = path.join(preflightRoot, "phase0-c-only-preflight-config.json")
  writeImmutableJson(preflightConfigPath, buildStructurePhase0Config(phase0C, null, "causal_readonly", true, phase0C.phase0Operation))
  const python = runStructurePhase0COnlyPythonPreflight(phase0C, preflightConfigPath)
  const hardware = hardwareSnapshot()
  const disk = diskBudgetSnapshot()
  const blockers = []
  if (python.exitCode !== 0) blockers.push("python_preflight_failed")
  blockers.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  if (!disk.passed) blockers.push("disk_budget_insufficient")
  const preflightReportPath = path.join(preflightRoot, "preflight-report.json")
  writeImmutableJson(preflightReportPath, {
    schemaVersion: "ai-painter-structure-fact-first-phase0-c-only-preflight-v1",
    status: blockers.length === 0 ? "all_preflights_passed_execution_not_consumed" : "preflights_failed_closed_execution_not_consumed",
    recordedAtUtc: new Date().toISOString(),
    cpuReport: { path: projectPath(cpuReportPath), sha256: sha256File(cpuReportPath) },
    python,
    hardware,
    disk,
    blockers,
    phase0ARerun: false,
    phase0BRerun: false,
    phase0CConsumed: false,
  })
  if (blockers.length > 0) throw new Error(`structure_phase0_c_only_preflight_failed:${blockers.join(",")}`)
  const runId = `structure-phase0-c-only-${timestampId()}`
  fs.mkdirSync(executionRoot, { recursive: false })
  return executeStructurePhase0COnly({ phase0C, phase0CAuthorizationPath, executionRoot, runId, prerequisitePath: preflightReportPath, sourceLineage })
}

function validateStructurePhase0COnlyPrerequisites(authorization) {
  const rootCauseTerminal = readJsonRequired(authorization.bindings.rootCauseTerminal.path)
  const rootCauseAnalysis = readJsonRequired(authorization.bindings.rootCauseAnalysis.path)
  const repairContract = readJsonRequired(authorization.bindings.inactiveRepairContract.path)
  const priorFailureTerminal = readJsonRequired(authorization.bindings.previousPhase0BcFailureTerminal.path)
  const updateReport = readJsonRequired(authorization.bindings.singleStepUpdateReport.path)
  const updateIdentityBinding = authorization.bindings.sourceUpdateIdentity
  const sourceAuthorizationBinding = authorization.bindings.sourceExecutionAuthorization
  const sourceConsumptionBinding = authorization.bindings.sourceExecutionConsumption
  for (const [label, binding] of Object.entries({ updateIdentityBinding, sourceAuthorizationBinding, sourceConsumptionBinding })) {
    if (!binding || !fileHashMatches(resolve(binding.path), binding.sha256)) {
      throw new Error(`structure_phase0_c_only_${label}_invalid`)
    }
  }
  const updateIdentity = readJsonRequired(updateIdentityBinding.path)
  const sourceAuthorization = readJsonRequired(sourceAuthorizationBinding.path)
  const sourceConsumption = readJsonRequired(sourceConsumptionBinding.path)
  if (
    rootCauseTerminal.status !== "stage4_structure_fact_first_phase0_condition_identity_root_cause_confirmed_closed"
    || rootCauseTerminal.verdict !== "same_condition_hash_contract_representation_mismatch"
    || rootCauseAnalysis.verdict?.requiredChoice !== "same_condition_hash_contract_representation_mismatch"
    || repairContract.contractId !== "stage4_structure_fact_first_phase0_canonical_condition_identity_v1"
    || repairContract.status !== "bounded_repair_contract_inactive_not_authorized"
  ) throw new Error("structure_phase0_c_only_root_cause_binding_invalid")
  if (
    priorFailureTerminal.status !== "stage4_structure_fact_first_phase0_bc_checkpoint_reproduction_failed_closed"
    || updateReport.status !== "phase0_single_cuda_optimizer_step_passed_closed"
    || updateReport.optimizerStepCount !== 1
    || updateReport.weightsChanged !== true
    || updateReport.autoencoderWeightsChanged !== false
    || updateReport.conditionTensorSha256 !== "dbc65181f60013c1f3cd05e6c7334e8fe4a96e2dd6252f60c47bd79017692847"
    || updateReport.checkpointSha256 !== authorization.bindings.diagnosticCheckpoint.sha256
    || projectPath(updateReport.checkpointPath) !== authorization.bindings.diagnosticCheckpoint.path
  ) throw new Error("structure_phase0_c_only_prior_phase0_b_binding_invalid")
  const sourceRunId = updateReport.runId
  const fixed = {
    architecture: authorization.taskIdentity.architecture,
    sampleId: authorization.taskIdentity.sampleId,
    sampleSplit: authorization.taskIdentity.sampleSplit,
    seed: authorization.taskIdentity.seed,
    timestep: authorization.taskIdentity.timestep,
    requiredBoundarySides: authorization.taskIdentity.requiredBoundarySides,
    datasetSplit: authorization.taskIdentity.datasetSplit,
    phase0Resolution: authorization.taskIdentity.resolution,
  }
  if (
    typeof sourceRunId !== "string"
    || sourceRunId.length === 0
    || updateIdentity.schemaVersion !== "ai-painter-stage4-structure-fact-first-phase0-execution-identity-v1"
    || updateIdentity.status !== "phase0_execution_identity_active_not_completed"
    || updateIdentity.phase0Step !== "single_step_update"
    || updateIdentity.runId !== sourceRunId
    || !sameJson(updateIdentity.fixedTaskIdentity, fixed)
    || projectPath(updateIdentity.authorizationPath) !== sourceAuthorizationBinding.path
    || updateIdentity.authorizationSha256 !== sourceAuthorizationBinding.sha256
    || projectPath(updateIdentity.phase0ConsumptionPath) !== sourceConsumptionBinding.path
    || updateIdentity.phase0ConsumptionSha256 !== sourceConsumptionBinding.sha256
    || sourceAuthorization.schemaVersion !== "ai-painter-stage4-structure-fact-first-phase0-execution-authorization-v1"
    || sourceAuthorization.status !== "resolved_owner_authorized_not_consumed"
    || sourceAuthorization.requestId !== updateIdentity.requestId
    || sourceAuthorization.commandRef !== updateIdentity.commandRef
    || sourceAuthorization.scope !== updateIdentity.scope
    || !sourceAuthorization.authorizedPhase0Steps?.includes("single_step_update")
    || !sameJson(sourceAuthorization.taskIdentity, authorization.taskIdentity)
    || sourceConsumption.schemaVersion !== "ai-painter-stage4-structure-fact-first-phase0-execution-consumption-v1"
    || sourceConsumption.status !== "structure_fact_first_phase0_execution_authorization_atomically_consumed"
    || sourceConsumption.requestId !== sourceAuthorization.requestId
    || sourceConsumption.commandRef !== sourceAuthorization.commandRef
    || sourceConsumption.scope !== sourceAuthorization.scope
    || sourceConsumption.runId !== sourceRunId
    || projectPath(sourceConsumption.authorizationPath) !== sourceAuthorizationBinding.path
    || sourceConsumption.authorizationSha256 !== sourceAuthorizationBinding.sha256
    || sourceConsumption.oneTimeConsumption !== true
    || !sourceConsumption.authorizedPhase0Steps?.includes("single_step_update")
  ) throw new Error("structure_phase0_c_only_checkpoint_source_lineage_invalid")
  return {
    runId: sourceRunId,
    updateReportPath: authorization.bindings.singleStepUpdateReport.path,
    updateReportSha256: authorization.bindings.singleStepUpdateReport.sha256,
    updateIdentityPath: updateIdentityBinding.path,
    updateIdentitySha256: updateIdentityBinding.sha256,
    executionAuthorizationPath: sourceAuthorizationBinding.path,
    executionAuthorizationSha256: sourceAuthorizationBinding.sha256,
    executionConsumptionPath: sourceConsumptionBinding.path,
    executionConsumptionSha256: sourceConsumptionBinding.sha256,
  }
}

async function executeStructurePhase0COnly({ phase0C, phase0CAuthorizationPath, executionRoot, runId, prerequisitePath, sourceLineage }) {
  const consumption = consumeStructurePhase0Authorization(
    phase0C,
    phase0CAuthorizationPath,
    runId,
    "causal_readonly",
    prerequisitePath,
    phase0C.phase0Operation,
  )
  const checkpointPath = resolve(phase0C.bindings.diagnosticCheckpoint.path)
  if (!fileHashMatches(checkpointPath, phase0C.bindings.diagnosticCheckpoint.sha256)) {
    throw new Error("structure_phase0_c_only_diagnostic_checkpoint_identity_changed")
  }
  const reproductionReports = []
  for (const label of ["a", "b"]) {
    const configPath = path.join(executionRoot, `reproduction-${label}-config.json`)
    writeImmutableJson(configPath, buildStructurePhase0Config(phase0C, consumption, "causal_readonly", false, phase0C.phase0Operation))
    const identityPath = path.join(executionRoot, `reproduction-${label}-identity.json`)
    const identity = buildStructurePhase0Identity(phase0C, phase0CAuthorizationPath, consumption, configPath, runId, "causal_readonly", phase0C.phase0Operation)
    identity.diagnosticCheckpointPath = projectPath(checkpointPath)
    identity.diagnosticCheckpointSha256 = sha256File(checkpointPath)
    identity.diagnosticCheckpointSource = sourceLineage
    identity.reproductionLabel = label.toUpperCase()
    writeImmutableJson(identityPath, identity)
    const output = path.join(executionRoot, `reproduction-${label}`)
    const result = await runStructurePhase0Trainer(phase0C, configPath, identityPath, output, ["--stage4-structure-fact-first-phase0-c-reproduce", "--phase0-diagnostic-checkpoint", checkpointPath])
    const processEvidence = persistStructurePhase0ChildProcessEvidence(output, result)
    if (result.exitCode !== 0) throw new Error(`structure_phase0_c_only_reproduction_${label}_failed:${result.exitCode}:${processEvidence.reportPath}`)
    const reportPath = path.join(output, "phase0-reproduction-report.json")
    reproductionReports.push({ path: projectPath(reportPath), sha256: sha256File(reportPath), value: readJsonRequired(reportPath), processEvidence })
  }
  const [left, right] = reproductionReports.map((row) => row.value)
  const equality = {
    modelStateSha256: left.modelStateSha256 === right.modelStateSha256,
    conditionTensorSha256: left.previewArtifact?.conditionTensorSha256 === right.previewArtifact?.conditionTensorSha256,
    rgbTensorSha256: left.previewArtifact?.rgbTensorSha256 === right.previewArtifact?.rgbTensorSha256,
    pngByteSha256: left.previewArtifact?.previewSha256 === right.previewArtifact?.previewSha256,
  }
  if (Object.values(equality).some((value) => value !== true)) throw new Error(`structure_phase0_c_only_reproduction_mismatch:${JSON.stringify(equality)}`)
  if (left.previewArtifact?.conditionTensorSha256 !== "dbc65181f60013c1f3cd05e6c7334e8fe4a96e2dd6252f60c47bd79017692847") {
    throw new Error("structure_phase0_c_only_canonical_condition_identity_changed")
  }
  const finalizationRoot = path.join(executionRoot, "finalization")
  fs.mkdirSync(finalizationRoot, { recursive: false })
  const reportPath = path.join(finalizationRoot, "finalization-report.json")
  const terminalPath = path.join(finalizationRoot, "phase-terminal.json")
  writeImmutableJson(reportPath, {
    schemaVersion: "ai-painter-stage4-structure-fact-first-phase0-c-only-finalization-v1",
    status: "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed",
    recordedAtUtc: new Date().toISOString(),
    runId,
    priorPhase0AReused: true,
    priorPhase0BSingleUpdateReused: true,
    phase0ARerun: false,
    phase0BRerun: false,
    diagnosticCheckpoint: { path: projectPath(checkpointPath), sha256: sha256File(checkpointPath), promotable: false, fullTrainingInitializationEligible: false },
    reproductions: reproductionReports.map(({ path, sha256, processEvidence }) => ({ path, sha256, processEvidence })),
    equality,
    canonicalConditionTensorSha256: left.previewArtifact.conditionTensorSha256,
    consumption,
    smokeStarted: false,
    trainingStarted: false,
  })
  writeImmutableJson(terminalPath, {
    schemaVersion: "ai-painter-stage4-structure-fact-first-phase0-terminal-v1",
    status: "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed",
    recordedAtUtc: new Date().toISOString(),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    finalizationPath: projectPath(reportPath),
    finalizationSha256: sha256File(reportPath),
    nextAction: "owner_may_authorize_one_structure_fact_first_30_epoch_model_smoke",
    checkpointPromotable: false,
    fullTrainingInitializationEligible: false,
    phase0ARerun: false,
    phase0BRerun: false,
    automaticRetryStarted: false,
  })
  console.log(JSON.stringify({ status: "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed", terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath), equality }, null, 2))
  return 0
}

async function runStructureFactFirstPhase0BCContinuation(argv) {
  const implementationAuthorizationPath = argument(argv, "--implementation-authorization")
  const implementationConsumptionPath = argument(argv, "--implementation-consumption")
  const phase0BCAuthorizationPath = argument(argv, "--phase0-bc-authorization")
  const phase0ATerminalPath = argument(argv, "--phase0-a-terminal")
  const phase0AFinalizationPath = argument(argv, "--phase0-a-finalization")
  const phase0AReportPath = argument(argv, "--phase0-a-report")
  const phase0APreflightPath = argument(argv, "--phase0-a-preflight")
  const phase0AConsumptionPath = argument(argv, "--phase0-a-consumption")
  const cpuReportPath = argument(argv, "--cpu-report")
  const implementationAttestationPath = argument(argv, "--implementation-attestation")
  const required = {
    implementationAuthorizationPath,
    implementationConsumptionPath,
    phase0BCAuthorizationPath,
    phase0ATerminalPath,
    phase0AFinalizationPath,
    phase0AReportPath,
    phase0APreflightPath,
    phase0AConsumptionPath,
  }
  for (const [label, value] of Object.entries(required)) {
    if (!value) throw new Error(`structure_phase0_bc_continuation_${label}_required`)
  }
  if (argument(argv, "--phase0-a-authorization") || argv.includes("--phase0-a-only")) {
    throw new Error("structure_phase0_bc_continuation_phase0_a_reuse_rejected")
  }
  const implementationAuthorization = readJsonRequired(implementationAuthorizationPath)
  const implementationConsumption = readJsonRequired(implementationConsumptionPath)
  if (
    implementationAuthorization.status !== "resolved_owner_authorized_not_consumed"
    || implementationConsumption.authorizationSha256 !== sha256File(implementationAuthorizationPath)
    || implementationConsumption.oneTimeConsumption !== true
  ) throw new Error("structure_phase0_bc_continuation_implementation_lineage_invalid")
  const phase0BC = validateStructurePhase0Authorization(
    phase0BCAuthorizationPath,
    "update_and_reproduction",
    STRUCTURE_PHASE0_UPDATE_ACTIONS,
    implementationAuthorizationPath,
    implementationConsumptionPath,
  )
  const phase0AEvidence = validateCompletedStructurePhase0A({
    authorization: phase0BC,
    terminalPath: phase0ATerminalPath,
    finalizationPath: phase0AFinalizationPath,
    reportPath: phase0AReportPath,
    preflightPath: phase0APreflightPath,
    consumptionPath: phase0AConsumptionPath,
  })
  if (fs.existsSync(resolve(phase0BC.execution.consumptionPath))) {
    throw new Error("structure_phase0_bc_continuation_execution_authorization_already_consumed")
  }
  if (argv.includes("--cpu-contract-only")) {
    console.log(JSON.stringify({
      status: "structure_fact_first_phase0_bc_continuation_contract_valid_cpu_only",
      executionScope: "successful_phase0_a_to_phase0_bc_only",
      boundPhase0ARunId: phase0AEvidence.runId,
      phase0ARerun: false,
      phase0AAuthorizationReused: false,
      gpuStarted: false,
      checkpointRead: false,
      optimizerCreated: false,
    }, null, 2))
    return 0
  }
  if (!cpuReportPath || !implementationAttestationPath) throw new Error("structure_phase0_bc_continuation_cpu_evidence_required")
  const cpuReport = readJsonRequired(cpuReportPath)
  const attestation = readJsonRequired(implementationAttestationPath)
  if (
    cpuReport.status !== "structure_fact_first_phase0_bc_continuation_cpu_regression_passed"
    || attestation.status !== "structure_fact_first_phase0_bc_continuation_implementation_cpu_verified"
    || attestation.cpuReportSha256 !== sha256File(cpuReportPath)
    || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
    || attestation.trainerSha256 !== sha256File(TRAINER)
    || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
  ) throw new Error("structure_phase0_bc_continuation_cpu_evidence_invalid")

  const executionRoot = resolve(phase0BC.execution.outputRoot)
  const preflightRoot = resolve(phase0BC.execution.preflightRoot)
  if (fs.existsSync(executionRoot)) throw new Error("structure_phase0_bc_continuation_execution_root_already_exists")
  if (fs.existsSync(preflightRoot)) throw new Error("structure_phase0_bc_continuation_preflight_root_already_exists")
  fs.mkdirSync(preflightRoot, { recursive: false })
  const preflightConfigPath = path.join(preflightRoot, "phase0-bc-preflight-config.json")
  writeImmutableJson(preflightConfigPath, buildStructurePhase0Config(phase0BC, null, "single_step_update", true))
  const python = runStructurePhase0BCPythonPreflight(phase0BC, preflightConfigPath)
  const hardware = hardwareSnapshot()
  const disk = diskBudgetSnapshot()
  const blockers = []
  if (python.exitCode !== 0) blockers.push("python_preflight_failed")
  blockers.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  if (!disk.passed) blockers.push("disk_budget_insufficient")
  const preflightReportPath = path.join(preflightRoot, "preflight-report.json")
  writeImmutableJson(preflightReportPath, {
    schemaVersion: "ai-painter-structure-fact-first-phase0-bc-continuation-preflight-v1",
    status: blockers.length === 0 ? "all_preflights_passed_execution_not_consumed" : "preflights_failed_closed_execution_not_consumed",
    recordedAtUtc: new Date().toISOString(),
    cpuReport: { path: projectPath(cpuReportPath), sha256: sha256File(cpuReportPath) },
    phase0AEvidence,
    python,
    hardware,
    disk,
    blockers,
    phase0ARerun: false,
    phase0AAuthorizationReused: false,
    phase0BCConsumed: false,
  })
  if (blockers.length > 0) throw new Error(`structure_phase0_bc_continuation_preflight_failed:${blockers.join(",")}`)
  const runId = `structure-phase0-bc-${timestampId()}`
  fs.mkdirSync(executionRoot, { recursive: false })
  return executeStructurePhase0BC({ phase0BC, phase0BCAuthorizationPath, executionRoot, runId, phase0AEvidence, prerequisitePath: preflightReportPath })
}

function validateCompletedStructurePhase0A({ authorization, terminalPath, finalizationPath, reportPath, preflightPath, consumptionPath }) {
  const expectedBindings = {
    phase0ASuccessTerminal: terminalPath,
    phase0AFinalization: finalizationPath,
    phase0AReport: reportPath,
    phase0APreflight: preflightPath,
    phase0AConsumption: consumptionPath,
  }
  for (const [key, value] of Object.entries(expectedBindings)) {
    const bound = authorization.bindings?.[key]
    if (!bound || projectPath(value) !== bound.path || sha256File(value) !== bound.sha256) {
      throw new Error(`structure_phase0_bc_continuation_phase0_a_binding_invalid:${key}`)
    }
  }
  const terminal = readJsonRequired(terminalPath)
  const finalization = readJsonRequired(finalizationPath)
  const report = readJsonRequired(reportPath)
  const preflight = readJsonRequired(preflightPath)
  const consumption = readJsonRequired(consumptionPath)
  if (
    terminal.status !== "stage4_structure_fact_first_phase0_a_readonly_qualification_passed_closed"
    || terminal.phase0ACompleted !== true
    || terminal.phase0BCStarted !== false
    || terminal.phase0BCAuthorizationConsumed !== false
    || terminal.modelStateUnchanged !== true
    || terminal.optimizerCreated !== false
    || terminal.backwardExecuted !== false
    || terminal.checkpointWritten !== false
  ) throw new Error("structure_phase0_bc_continuation_phase0_a_terminal_not_successful")
  if (
    finalization.status !== "stage4_structure_fact_first_phase0_a_readonly_qualification_passed_closed"
    || finalization.phase0A?.reportSha256 !== sha256File(reportPath)
    || finalization.cpuAndResourceQualification?.preflightReport?.sha256 !== sha256File(preflightPath)
    || finalization.authorization?.consumptionSha256 !== sha256File(consumptionPath)
    || finalization.authorization?.atomicallyConsumed !== true
    || finalization.phase0BC?.authorizationCreated !== false
    || finalization.phase0BC?.authorizationConsumed !== false
    || finalization.phase0BC?.started !== false
  ) throw new Error("structure_phase0_bc_continuation_phase0_a_finalization_invalid")
  if (
    report.status !== "structure_fact_first_phase0_a_causal_and_topology_qualification_passed_closed"
    || report.modelStateUnchanged !== true
    || report.optimizerCreated !== false
    || report.backwardMethodExecuted !== false
    || report.checkpointWritten !== false
  ) throw new Error("structure_phase0_bc_continuation_phase0_a_report_invalid")
  if (
    preflight.status !== "all_preflights_passed_execution_not_consumed"
    || consumption.status !== "structure_fact_first_phase0_execution_authorization_atomically_consumed"
    || consumption.executionPart !== "causal_readonly"
    || consumption.oneTimeConsumption !== true
  ) throw new Error("structure_phase0_bc_continuation_phase0_a_lineage_invalid")
  return {
    mode: "bound_successful_prior_run",
    runId: finalization.runId,
    terminalPath: projectPath(terminalPath),
    terminalSha256: sha256File(terminalPath),
    finalizationPath: projectPath(finalizationPath),
    finalizationSha256: sha256File(finalizationPath),
    reportPath: projectPath(reportPath),
    reportSha256: sha256File(reportPath),
    preflightPath: projectPath(preflightPath),
    preflightSha256: sha256File(preflightPath),
    consumptionPath: projectPath(consumptionPath),
    consumptionSha256: sha256File(consumptionPath),
    phase0ARerun: false,
    phase0AAuthorizationReused: false,
  }
}

async function executeStructurePhase0BC({ phase0BC, phase0BCAuthorizationPath, executionRoot, runId, phase0AEvidence, prerequisitePath = null }) {
  const prerequisite = prerequisitePath ?? resolve(phase0AEvidence.reportPath)
  const phase0BCConsumption = consumeStructurePhase0Authorization(phase0BC, phase0BCAuthorizationPath, runId, "update_and_reproduction", prerequisite)
  const phase0BCRoot = path.join(executionRoot, "phase0-bc")
  fs.mkdirSync(phase0BCRoot, { recursive: false })
  const updateConfigPath = path.join(phase0BCRoot, "update-config.json")
  writeImmutableJson(updateConfigPath, buildStructurePhase0Config(phase0BC, phase0BCConsumption, "single_step_update", false))
  const updateIdentityPath = path.join(phase0BCRoot, "update-identity.json")
  writeImmutableJson(updateIdentityPath, buildStructurePhase0Identity(phase0BC, phase0BCAuthorizationPath, phase0BCConsumption, updateConfigPath, runId, "single_step_update"))
  const updateOutput = path.join(phase0BCRoot, "update")
  const updateResult = await runStructurePhase0Trainer(phase0BC, updateConfigPath, updateIdentityPath, updateOutput, ["--stage4-validation-kernel-phase0-update"])
  const updateProcessEvidence = persistStructurePhase0ChildProcessEvidence(updateOutput, updateResult)
  if (updateResult.exitCode !== 0) throw new Error(`structure_phase0_b_update_failed:${updateResult.exitCode}:${updateProcessEvidence.reportPath}`)
  const updateReportPath = path.join(updateOutput, "phase0-update-report.json")
  const updateReport = readJsonRequired(updateReportPath)
  if (updateReport.status !== "phase0_single_cuda_optimizer_step_passed_closed" || updateReport.optimizerStepCount !== 1 || updateReport.weightsChanged !== true || updateReport.autoencoderWeightsChanged !== false) throw new Error("structure_phase0_b_evidence_invalid")
  const checkpointPath = resolve(updateReport.checkpointPath)
  if (!fileHashMatches(checkpointPath, updateReport.checkpointSha256)) throw new Error("structure_phase0_checkpoint_invalid")

  const reproductionReports = []
  for (const label of ["a", "b"]) {
    const reproductionConfigPath = path.join(phase0BCRoot, `reproduction-${label}-config.json`)
    writeImmutableJson(reproductionConfigPath, buildStructurePhase0Config(phase0BC, phase0BCConsumption, "checkpoint_reproduction", false))
    const reproductionIdentityPath = path.join(phase0BCRoot, `reproduction-${label}-identity.json`)
    const identity = buildStructurePhase0Identity(phase0BC, phase0BCAuthorizationPath, phase0BCConsumption, reproductionConfigPath, runId, "checkpoint_reproduction")
    identity.diagnosticCheckpointPath = projectPath(checkpointPath)
    identity.diagnosticCheckpointSha256 = sha256File(checkpointPath)
    identity.reproductionLabel = label.toUpperCase()
    writeImmutableJson(reproductionIdentityPath, identity)
    const reproductionOutput = path.join(phase0BCRoot, `reproduction-${label}`)
    const result = await runStructurePhase0Trainer(phase0BC, reproductionConfigPath, reproductionIdentityPath, reproductionOutput, ["--stage4-validation-kernel-phase0-reproduce", "--phase0-diagnostic-checkpoint", checkpointPath])
    const processEvidence = persistStructurePhase0ChildProcessEvidence(reproductionOutput, result)
    if (result.exitCode !== 0) throw new Error(`structure_phase0_c_reproduction_${label}_failed:${result.exitCode}:${processEvidence.reportPath}`)
    const reportPath = path.join(reproductionOutput, "phase0-reproduction-report.json")
    reproductionReports.push({ path: projectPath(reportPath), sha256: sha256File(reportPath), value: readJsonRequired(reportPath), processEvidence })
  }
  const [left, right] = reproductionReports.map((row) => row.value)
  const equality = {
    modelStateSha256: left.modelStateSha256 === right.modelStateSha256,
    conditionTensorSha256: left.previewArtifact?.conditionTensorSha256 === right.previewArtifact?.conditionTensorSha256,
    rgbTensorSha256: left.previewArtifact?.rgbTensorSha256 === right.previewArtifact?.rgbTensorSha256,
    pngByteSha256: left.previewArtifact?.previewSha256 === right.previewArtifact?.previewSha256,
  }
  if (Object.values(equality).some((value) => value !== true)) throw new Error(`structure_phase0_c_reproduction_mismatch:${JSON.stringify(equality)}`)
  const finalizationRoot = path.join(executionRoot, "finalization")
  fs.mkdirSync(finalizationRoot, { recursive: false })
  const reportPath = path.join(finalizationRoot, "finalization-report.json")
  const terminalPath = path.join(finalizationRoot, "phase-terminal.json")
  writeImmutableJson(reportPath, {
    schemaVersion: "ai-painter-stage4-structure-fact-first-phase0-finalization-v1",
    status: "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed",
    recordedAtUtc: new Date().toISOString(),
    runId,
    phase0A: phase0AEvidence,
    phase0BC: {
      updateReportPath: projectPath(updateReportPath),
      updateReportSha256: sha256File(updateReportPath),
      updateProcessEvidence,
      checkpoint: { path: projectPath(checkpointPath), sha256: sha256File(checkpointPath), promotable: false, fullTrainingInitializationEligible: false },
      reproductions: reproductionReports.map(({ path, sha256, processEvidence }) => ({ path, sha256, processEvidence })),
      consumption: phase0BCConsumption,
    },
    equality,
    phase0ARerun: false,
    smokeStarted: false,
    visualQualityPromotionPerformed: false,
  })
  writeImmutableJson(terminalPath, { schemaVersion: "ai-painter-stage4-structure-fact-first-phase0-terminal-v1", status: "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed", recordedAtUtc: new Date().toISOString(), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, finalizationPath: projectPath(reportPath), finalizationSha256: sha256File(reportPath), nextAction: "owner_may_authorize_one_structure_fact_first_30_epoch_model_smoke", checkpointPromotable: false, fullTrainingInitializationEligible: false, phase0ARerun: false, automaticRetryStarted: false })
  console.log(JSON.stringify({ status: "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed", terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath), equality }, null, 2))
  return 0
}

function validateStructurePhase0Authorization(value, expectedPart, expectedActions, implementationAuthorizationPath, implementationConsumptionPath) {
  const authorization = readJsonRequired(value)
  const actions = [...(authorization.executionActions ?? [])].sort()
  const denied = [...(authorization.explicitlyDeniedActions ?? [])].sort()
  const expectedDenied = ALL_EXECUTION_ACTIONS.filter((item) => !expectedActions.includes(item)).sort()
  if (
    authorization.schemaVersion !== "ai-painter-stage4-structure-fact-first-phase0-execution-authorization-v1"
    || authorization.status !== "resolved_owner_authorized_not_consumed"
    || authorization.executionPart !== expectedPart
    || !sameJson(actions, expectedActions)
    || !sameJson(denied, expectedDenied)
    || actions.some((item) => denied.includes(item))
    || authorization.taskIdentity?.architecture !== STRUCTURE_PHASE0_ARCHITECTURE
    || authorization.taskIdentity?.sampleId !== SAMPLE_ID
    || authorization.taskIdentity?.sampleSplit !== "validation"
    || authorization.taskIdentity?.seed !== 20263722
    || authorization.taskIdentity?.timestep !== 999
    || !sameJson(authorization.taskIdentity?.requiredBoundarySides, ["west"])
    || authorization.bindings?.implementationAuthorization?.sha256 !== sha256File(implementationAuthorizationPath)
    || authorization.bindings?.implementationConsumption?.sha256 !== sha256File(implementationConsumptionPath)
  ) throw new Error(`structure_phase0_${expectedPart}_authorization_invalid`)
  for (const binding of Object.values(authorization.bindings ?? {})) {
    if (!fileHashMatches(binding.path, binding.sha256)) throw new Error(`structure_phase0_${expectedPart}_binding_changed`)
  }
  for (const [key, currentPath] of Object.entries({ authorizationPolicy: STAGE_CONTROL_POLICY, executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py", modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py", trainer: TRAINER, runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs", cpuChecker: V9_CPU_CHECKER, model: "ml/ai-painter/src/ai_painter/complete_world/model.py" })) {
    if (authorization.codeBindings?.[key]?.path !== currentPath || !fileHashMatches(currentPath, authorization.codeBindings?.[key]?.sha256)) throw new Error(`structure_phase0_code_binding_changed:${key}`)
  }
  authorization._path = projectPath(value)
  authorization._sha256 = sha256File(value)
  return authorization
}

function buildStructurePhase0Config(authorization, consumption, phase0Step, preflight, phase0Operation = null) {
  const config = structuredClone(readJsonRequired(authorization.bindings.sourceInactiveConfig.path))
  config.training.trainingAuthorizationStatus = STRUCTURE_PHASE0_STATUS
  config.training.structureFactFirstPhase0Contract = { sampleId: SAMPLE_ID, sampleSplit: "validation", conditionPackPath: ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-194-2026-08-01T15-47-45-117Z/complete-map-condition-task/compiled-conditions/condition-pack.json", seed: 20263722, timestep: 999, resolution: { width: 256, height: 192 }, requiredBoundarySides: ["west"], executionType: "phase0_engineering", smokeAuthorized: false, fullTrainingAuthorized: false }
  config.training.ownerTrainingAuthorization = {
    authorizationId: authorization.requestId,
    requestId: authorization.requestId,
    commandRef: authorization.commandRef,
    scope: authorization.scope,
    authorizationPath: authorization._path,
    authorizationSha256: authorization._sha256,
    executionConsumptionPath: preflight ? null : consumption.path,
    executionConsumptionSha256: preflight ? null : consumption.sha256,
    implementationAuthorizationPath: authorization.bindings.implementationAuthorization.path,
    implementationAuthorizationSha256: authorization.bindings.implementationAuthorization.sha256,
    implementationConsumptionPath: authorization.bindings.implementationConsumption.path,
    implementationConsumptionSha256: authorization.bindings.implementationConsumption.sha256,
    executionActions: [...authorization.executionActions],
    explicitlyDeniedActions: [...authorization.explicitlyDeniedActions],
    phase0Step,
    executionState: preflight ? "preflight_unconsumed" : "consumed",
    status: STRUCTURE_PHASE0_STATUS,
    checkpointLoadingAuthorized: phase0Step === "checkpoint_reproduction" || phase0Operation === "checkpoint_reproduction_only",
    optimizerCreationAuthorized: phase0Step === "single_step_update",
    backwardExecutionAuthorized: phase0Step === "single_step_update",
    modelWeightMutationAuthorized: phase0Step === "single_step_update",
    gpuTrainingAuthorizedNow: !preflight,
    singleSampleGpuOverfitSmokeAuthorized: false,
    fullTrainingAuthorized: false,
    stage1Authorized: false,
    stage2Authorized: false,
    strictRevalidationAuthorized: false,
    validationAuthorized: true,
    formalInferenceAuthorized: false,
    checkpointPromotionAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    automaticRetryAuthorized: false,
  }
  return config
}

function consumeStructurePhase0Authorization(authorization, authorizationPath, runId, executionPart, prerequisitePath, phase0Operation = null) {
  const consumptionPath = resolve(authorization.execution.consumptionPath)
  const value = { schemaVersion: "ai-painter-stage4-structure-fact-first-phase0-execution-consumption-v1", status: "structure_fact_first_phase0_execution_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, executionPart, authorizedPhase0Steps: authorization.authorizedPhase0Steps, phase0Operation, runId, authorizationPath: projectPath(authorizationPath), authorizationSha256: sha256File(authorizationPath), prerequisitePath: projectPath(prerequisitePath), prerequisiteSha256: sha256File(prerequisitePath), consumedAtUtc: new Date().toISOString(), oneTimeConsumption: true }
  writeImmutableJson(consumptionPath, value)
  return { ...value, path: projectPath(consumptionPath), sha256: sha256File(consumptionPath) }
}

function buildStructurePhase0Identity(authorization, authorizationPath, consumption, configPath, runId, phase0Step, phase0Operation = null) {
  return { schemaVersion: "ai-painter-stage4-structure-fact-first-phase0-execution-identity-v1", status: "phase0_execution_identity_active_not_completed", runId, phase0Step, phase0Operation, requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: projectPath(authorizationPath), authorizationSha256: sha256File(authorizationPath), phase0ConsumptionPath: consumption.path, phase0ConsumptionSha256: consumption.sha256, implementationAuthorizationPath: authorization.bindings.implementationAuthorization.path, implementationAuthorizationSha256: authorization.bindings.implementationAuthorization.sha256, implementationConsumptionPath: authorization.bindings.implementationConsumption.path, implementationConsumptionSha256: authorization.bindings.implementationConsumption.sha256, sourceConfigPath: projectPath(configPath), sourceConfigSha256: sha256File(configPath), datasetManifestPath: authorization.bindings.datasetManifest.path, datasetManifestSha256: authorization.bindings.datasetManifest.sha256, autoencoderCheckpointPath: authorization.bindings.projectAutoencoderCheckpoint.path, autoencoderCheckpointSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256, trainerPath: TRAINER, trainerSha256: sha256File(TRAINER), runnerPath: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs", runnerSha256: sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"), cpuCheckerPath: V9_CPU_CHECKER, cpuCheckerSha256: sha256File(V9_CPU_CHECKER), fixedTaskIdentity: { architecture: STRUCTURE_PHASE0_ARCHITECTURE, sampleId: SAMPLE_ID, sampleSplit: "validation", seed: 20263722, timestep: 999, requiredBoundarySides: ["west"], datasetSplit: SPLITS, phase0Resolution: { width: 256, height: 192 } } }
}

function runStructurePhase0PythonPreflight(authorization, configPath) {
  const result = spawnSync(PYTHON, [TRAINER, "--config", configPath, "--dataset-package", resolve(authorization.bindings.datasetManifest.path), "--autoencoder-checkpoint", resolve(authorization.bindings.projectAutoencoderCheckpoint.path), "--output-dir", resolve(`${authorization.execution.preflightRoot}/trainer-output-must-not-exist`), "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "1", "--overfit-evaluation-interval", "1", "--stage4-structure-fact-first-phase0-causal", "--stage-control-dry-run", "--preflight-only"], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 180000 })
  return { exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr }
}

function runStructurePhase0BCPythonPreflight(authorization, configPath) {
  const result = spawnSync(PYTHON, [TRAINER, "--config", configPath, "--dataset-package", resolve(authorization.bindings.datasetManifest.path), "--autoencoder-checkpoint", resolve(authorization.bindings.projectAutoencoderCheckpoint.path), "--output-dir", resolve(`${authorization.execution.preflightRoot}/trainer-output-must-not-exist`), "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "1", "--overfit-evaluation-interval", "1", "--stage4-validation-kernel-phase0-update", "--stage-control-dry-run", "--preflight-only"], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 180000 })
  return { exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr }
}

function runStructurePhase0COnlyPythonPreflight(authorization, configPath) {
  const checkpointPath = resolve(authorization.bindings.diagnosticCheckpoint.path)
  const result = spawnSync(PYTHON, [TRAINER, "--config", configPath, "--dataset-package", resolve(authorization.bindings.datasetManifest.path), "--autoencoder-checkpoint", resolve(authorization.bindings.projectAutoencoderCheckpoint.path), "--output-dir", resolve(`${authorization.execution.preflightRoot}/trainer-output-must-not-exist`), "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "1", "--overfit-evaluation-interval", "1", "--stage4-structure-fact-first-phase0-c-reproduce", "--phase0-diagnostic-checkpoint", checkpointPath, "--stage-control-dry-run", "--preflight-only"], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 180000 })
  return { exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr }
}

function runStructurePhase0Trainer(authorization, configPath, identityPath, outputDir, extraArgs) {
  return new Promise((complete) => {
    const args = [TRAINER, "--config", configPath, "--dataset-package", resolve(authorization.bindings.datasetManifest.path), "--autoencoder-checkpoint", resolve(authorization.bindings.projectAutoencoderCheckpoint.path), "--output-dir", outputDir, "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "1", "--overfit-evaluation-interval", "1", "--phase0-execution-identity", identityPath, ...extraArgs]
    const child = spawn(PYTHON, args, { cwd: ROOT, env: { ...pythonEnv(), CUBLAS_WORKSPACE_CONFIG: ":4096:8" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""; let stderr = ""
    child.stdout.on("data", (value) => { stdout += value.toString() })
    child.stderr.on("data", (value) => { stderr += value.toString() })
    child.on("close", (exitCode, signal) => complete({ exitCode, signal, stdout, stderr }))
  })
}

function persistStructurePhase0ChildProcessEvidence(phaseRoot, result) {
  const evidenceRoot = path.join(phaseRoot, "trainer-process-evidence")
  fs.mkdirSync(evidenceRoot, { recursive: false })
  const stdoutPath = path.join(evidenceRoot, "stdout.txt")
  const stderrPath = path.join(evidenceRoot, "stderr.txt")
  writeImmutableText(stdoutPath, result.stdout ?? "")
  writeImmutableText(stderrPath, result.stderr ?? "")
  const reportPath = path.join(evidenceRoot, "process-report.json")
  writeImmutableJson(reportPath, {
    schemaVersion: "ai-painter-stage4-structure-fact-first-phase0-child-process-evidence-v1",
    status: result.exitCode === 0 ? "phase0_child_process_completed" : "phase0_child_process_failed_closed",
    recordedAtUtc: new Date().toISOString(),
    exitCode: result.exitCode,
    signal: result.signal,
    stdout: { path: projectPath(stdoutPath), sha256: sha256File(stdoutPath) },
    stderr: { path: projectPath(stderrPath), sha256: sha256File(stderrPath) },
  })
  return { reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath), stdoutPath: projectPath(stdoutPath), stdoutSha256: sha256File(stdoutPath), stderrPath: projectPath(stderrPath), stderrSha256: sha256File(stderrPath) }
}

async function runStage4ValidationKernelPhase0(argv) {
  const authorizationPath = argument(argv, "--gpu-authorization") ?? VALIDATION_KERNEL_AUTHORIZATION_PATH
  if (projectPath(authorizationPath) !== VALIDATION_KERNEL_AUTHORIZATION_PATH || sha256File(authorizationPath) !== VALIDATION_KERNEL_AUTHORIZATION_SHA256) throw new Error("validation_kernel_authorization_identity_invalid")
  if (!fileHashMatches(VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_PATH, VALIDATION_KERNEL_IMPLEMENTATION_CONSUMPTION_SHA256)) throw new Error("validation_kernel_implementation_consumption_changed")
  const authorization = readJsonRequired(authorizationPath)
  if (authorization.requestId !== VALIDATION_KERNEL_REQUEST_ID || authorization.status !== "resolved_owner_authorized" || authorization.ownerDecision?.commandRef !== VALIDATION_KERNEL_REQUEST_ID || authorization.ownerDecision?.scope !== VALIDATION_KERNEL_SCOPE) throw new Error("validation_kernel_command_identity_invalid")
  const identity = authorization.fixedTaskIdentity ?? {}
  if (identity.architecture !== "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" || identity.sampleId !== SAMPLE_ID || identity.sampleSplit !== "validation" || identity.seed !== 20263722 || !sameJson(identity.requiredBoundarySides, ["west"]) || !sameJson(identity.datasetSplit, SPLITS) || !sameJson(identity.phase0Resolution, { width: 256, height: 192 })) throw new Error("validation_kernel_fixed_task_identity_invalid")
  for (const [key, expected] of Object.entries({ formalInference: false, checkpointFormalPromotion: false, ownerFormalVisualAcceptance: false, runtimeFrame: false, worldEntry: false, worldRuntime: false })) {
    if (authorization.authorizedActions?.[key] !== expected) throw new Error(`validation_kernel_forbidden_action_open:${key}`)
  }
  for (const key of ["phase0ProjectAutoencoderReadAndLoadFrozen", "phase0V9FixedRandomInitialization", "phase0OptimizerCreation", "phase0BackwardAndSingleOptimizerStep", "phase0BoundedWeightModification", "phase0DiagnosticCheckpointWriteAndReload", "phase0DoublePreviewReproduction"]) {
    if (authorization.authorizedActions?.[key] !== true) throw new Error(`validation_kernel_authorized_action_closed:${key}`)
  }
  for (const binding of Object.values(authorization.bindings ?? {})) {
    if (!fileHashMatches(binding.path, binding.sha256) && ![authorization.bindings.baselineTrainer, authorization.bindings.baselineCpuChecker, authorization.bindings.baselineSmokeRunner].includes(binding)) throw new Error("validation_kernel_source_binding_changed")
  }
  const sourceAuthorization = readJsonRequired(SOURCE_V9_AUTHORIZATION_PATH)
  if (sha256File(SOURCE_V9_AUTHORIZATION_PATH) !== SOURCE_V9_AUTHORIZATION_SHA256) throw new Error("validation_kernel_source_v9_authorization_changed")
  for (const key of ["v9InactiveConfig", "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor", "windowsSafePreviewNormalizer", "gpuResourceGate"]) {
    const binding = sourceAuthorization.bindings?.[key]
    if (!binding || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`validation_kernel_source_v9_binding_changed:${key}`)
  }
  const attestationPath = `${VALIDATION_KERNEL_ROOT}/implementation-attestation.json`
  const cpuContractOnly = argv.includes("--cpu-contract-only")
  if (cpuContractOnly) {
    console.log(JSON.stringify({ status: "stage4_validation_kernel_phase0_authorization_contract_valid_cpu_only", gpuStarted: false, checkpointRead: false, optimizerCreated: false }, null, 2))
    return 0
  }
  const attestation = readJsonRequired(attestationPath)
  if (attestation.status !== "stage4_validation_kernel_phase0_implementation_cpu_verified" || attestation.authorizationSha256 !== VALIDATION_KERNEL_AUTHORIZATION_SHA256 || attestation.trainerSha256 !== sha256File(TRAINER) || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs") || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)) throw new Error("validation_kernel_implementation_attestation_invalid")

  const context = {
    authorization,
    authorizationPath: VALIDATION_KERNEL_AUTHORIZATION_PATH,
    authorizationSha256: VALIDATION_KERNEL_AUTHORIZATION_SHA256,
    implementationAttestationPath: projectPath(attestationPath),
    implementationAttestationSha256: sha256File(attestationPath),
    inactiveConfigPath: sourceAuthorization.bindings.v9InactiveConfig.path,
    datasetPath: sourceAuthorization.bindings.datasetManifest.path,
    sourceIndexPath: sourceAuthorization.bindings.datasetSourceIndex.path,
    autoencoderPath: sourceAuthorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: sourceAuthorization.bindings.projectAutoencoderCheckpoint.sha256,
  }
  const sourceIndex = readJsonRequired(context.sourceIndexPath)
  const rows = (sourceIndex.samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation" || !sameJson(countSplits(rows), SPLITS)) throw new Error("validation_kernel_dataset_identity_invalid")
  context.sample = sample

  const preflight = runValidationKernelPreflights(context)
  if (argv.includes("--preflight-only")) {
    console.log(JSON.stringify(preflight, null, 2))
    return preflight.blockers.length === 0 ? 0 : 1
  }
  if (preflight.blockers.length > 0) {
    writeValidationKernelPreflightFailure(preflight)
    return 1
  }
  const consumptionRoot = resolve(authorization.output.phase0ConsumptionRoot)
  fs.mkdirSync(consumptionRoot, { recursive: true })
  const previousConsumptions = fs.readdirSync(consumptionRoot).filter((name) => name.endsWith("-consumption.json"))
  const ordinal = previousConsumptions.length + 1
  if (ordinal > Number(authorization.executionPolicy.maximumPhase0GpuQualificationExecutions)) throw new Error("validation_kernel_phase0_gpu_execution_budget_exhausted")
  const runId = `phase0-${timestampId()}-r${ordinal}`
  const runRoot = resolve(`${VALIDATION_KERNEL_ROOT}/phase0/${runId}`)
  const consumptionPath = path.join(consumptionRoot, `${runId}-consumption.json`)
  const consumptionValue = {
    schemaVersion: "ai-painter-stage4-validation-kernel-phase0-gpu-consumption-v1",
    status: "stage4_validation_kernel_phase0_gpu_authorization_atomically_consumed",
    requestId: VALIDATION_KERNEL_REQUEST_ID,
    commandRef: VALIDATION_KERNEL_REQUEST_ID,
    scope: VALIDATION_KERNEL_SCOPE,
    runId,
    phase0GpuExecutionOrdinal: ordinal,
    maximumPhase0GpuQualificationExecutions: authorization.executionPolicy.maximumPhase0GpuQualificationExecutions,
    authorizationPath: VALIDATION_KERNEL_AUTHORIZATION_PATH,
    authorizationSha256: VALIDATION_KERNEL_AUTHORIZATION_SHA256,
    implementationAttestationPath: projectPath(attestationPath),
    implementationAttestationSha256: sha256File(attestationPath),
    preflightStatus: preflight.status,
    consumedAtUtc: new Date().toISOString(),
    oneTimeConsumption: true,
    modelSmokeQuotaConsumed: false,
    formalInferenceAuthorized: false,
    checkpointPromotionAuthorized: false,
  }
  writeImmutableJson(consumptionPath, consumptionValue)
  const consumption = { ...consumptionValue, path: projectPath(consumptionPath), sha256: sha256File(consumptionPath) }
  fs.mkdirSync(runRoot, { recursive: false })
  const baseIdentity = {
    schemaVersion: "ai-painter-stage4-validation-kernel-phase0-execution-identity-v1",
    status: "phase0_execution_identity_active_not_completed",
    runId,
    authorizationPath: VALIDATION_KERNEL_AUTHORIZATION_PATH,
    authorizationSha256: VALIDATION_KERNEL_AUTHORIZATION_SHA256,
    phase0ConsumptionPath: consumption.path,
    phase0ConsumptionSha256: consumption.sha256,
    implementationAttestationPath: projectPath(attestationPath),
    implementationAttestationSha256: sha256File(attestationPath),
    sourceInactiveConfigPath: context.inactiveConfigPath,
    sourceInactiveConfigSha256: sha256File(context.inactiveConfigPath),
    datasetManifestPath: context.datasetPath,
    datasetManifestSha256: sha256File(context.datasetPath),
    datasetSourceIndexPath: context.sourceIndexPath,
    datasetSourceIndexSha256: sha256File(context.sourceIndexPath),
    autoencoderCheckpointPath: context.autoencoderPath,
    autoencoderCheckpointSha256: context.autoencoderSha256,
    trainerPath: TRAINER,
    trainerSha256: sha256File(TRAINER),
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    requiredBoundarySides: ["west"],
  }
  const updateIdentityPath = path.join(runRoot, "phase0-update-execution-identity.json")
  writeImmutableJson(updateIdentityPath, { ...baseIdentity, executionPart: "single_optimizer_step" })
  const updateDir = path.join(runRoot, "update")
  try {
    const update = await runValidationKernelTrainerPart(context, ["--stage4-validation-kernel-phase0-update", "--phase0-execution-identity", updateIdentityPath], updateDir)
    if (update.exitCode !== 0) throw new Error(`validation_kernel_phase0_update_failed:${update.exitCode}`)
    const updateReportPath = path.join(updateDir, "phase0-update-report.json")
    const updateReport = readJsonRequired(updateReportPath)
    if (updateReport.status !== "phase0_single_cuda_optimizer_step_passed_closed" || updateReport.weightsChanged !== true || updateReport.gradientFinite !== true || updateReport.gradientNonzero !== true) throw new Error("validation_kernel_phase0_update_evidence_invalid")
    const checkpointPath = resolve(updateReport.checkpointPath)
    if (!fileHashMatches(checkpointPath, updateReport.checkpointSha256)) throw new Error("validation_kernel_phase0_checkpoint_missing_or_changed")
    const reproduceIdentity = { ...baseIdentity, executionPart: "fresh_process_checkpoint_preview_reproduction", diagnosticCheckpointPath: updateReport.checkpointPath, diagnosticCheckpointSha256: updateReport.checkpointSha256 }
    const reproductionRows = []
    for (const label of ["a", "b"]) {
      const identityPath = path.join(runRoot, `phase0-reproduce-${label}-execution-identity.json`)
      writeImmutableJson(identityPath, { ...reproduceIdentity, reproductionLabel: label.toUpperCase() })
      const outputDir = path.join(runRoot, `reproduce-${label}`)
      const result = await runValidationKernelTrainerPart(context, ["--stage4-validation-kernel-phase0-reproduce", "--phase0-execution-identity", identityPath, "--phase0-diagnostic-checkpoint", checkpointPath], outputDir)
      if (result.exitCode !== 0) throw new Error(`validation_kernel_phase0_reproduction_${label}_failed:${result.exitCode}`)
      const reportPath = path.join(outputDir, "phase0-reproduction-report.json")
      const report = readJsonRequired(reportPath)
      reproductionRows.push({ label: label.toUpperCase(), reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath), report })
    }
    const [left, right] = reproductionRows.map((row) => row.report)
    const equality = {
      modelStateSha256Matches: left.modelStateSha256 === right.modelStateSha256,
      conditionTensorSha256Matches: left.previewArtifact?.conditionTensorSha256 === right.previewArtifact?.conditionTensorSha256,
      rgbTensorSha256Matches: left.previewArtifact?.rgbTensorSha256 === right.previewArtifact?.rgbTensorSha256,
      pngByteSha256Matches: left.previewArtifact?.previewSha256 === right.previewArtifact?.previewSha256,
      latentNormalizationSha256Matches: left.previewArtifact?.latentNormalizationSha256 === right.previewArtifact?.latentNormalizationSha256,
    }
    if (Object.values(equality).some((value) => value !== true)) throw new Error(`validation_kernel_phase0_reproduction_mismatch:${JSON.stringify(equality)}`)
    const finalizationDir = path.join(runRoot, "finalization")
    fs.mkdirSync(finalizationDir, { recursive: false })
    const reportPath = path.join(finalizationDir, "finalization-report.json")
    const terminalPath = path.join(finalizationDir, "phase-terminal.json")
    writeImmutableJson(reportPath, { schemaVersion: "ai-painter-stage4-validation-kernel-phase0-finalization-v1", status: "stage4_validation_kernel_phase0_passed_closed", recordedAtUtc: new Date().toISOString(), runId, consumption, preflight, updateReport: { path: projectPath(updateReportPath), sha256: sha256File(updateReportPath) }, diagnosticCheckpoint: { path: updateReport.checkpointPath, sha256: updateReport.checkpointSha256, promotable: false, fullTrainingInitializationEligible: false }, reproductions: reproductionRows.map(({ label, reportPath, reportSha256 }) => ({ label, reportPath, reportSha256 })), equality, modelSmokeQuotaConsumed: false })
    writeImmutableJson(terminalPath, { schemaVersion: "ai-painter-stage4-validation-kernel-phase0-terminal-v1", status: "stage4_validation_kernel_phase0_passed_closed", recordedAtUtc: new Date().toISOString(), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, runId, finalizationPath: projectPath(reportPath), finalizationSha256: sha256File(reportPath), nextAction: "execute_single_v9_30_epoch_model_smoke_under_independent_consumption", diagnosticCheckpointPromotable: false, diagnosticCheckpointFullTrainingInitializationEligible: false, automaticRetryStarted: false })
    console.log(JSON.stringify({ status: "stage4_validation_kernel_phase0_passed_closed", terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath), equality }, null, 2))
    return 0
  } catch (error) {
    const finalizationDir = path.join(runRoot, "finalization")
    if (!fs.existsSync(finalizationDir)) fs.mkdirSync(finalizationDir, { recursive: false })
    const reportPath = path.join(finalizationDir, "finalization-report.json")
    const terminalPath = path.join(finalizationDir, "phase-terminal.json")
    if (!fs.existsSync(reportPath)) writeImmutableJson(reportPath, { schemaVersion: "ai-painter-stage4-validation-kernel-phase0-finalization-v1", status: "stage4_validation_kernel_phase0_failed_closed", recordedAtUtc: new Date().toISOString(), runId, consumption, preflight, failureMessage: String(error?.message ?? error), stack: error?.stack, modelSmokeQuotaConsumed: false })
    if (!fs.existsSync(terminalPath)) writeImmutableJson(terminalPath, { schemaVersion: "ai-painter-stage4-validation-kernel-phase0-terminal-v1", status: "stage4_validation_kernel_phase0_failed_closed", recordedAtUtc: new Date().toISOString(), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, runId, finalizationPath: projectPath(reportPath), finalizationSha256: sha256File(reportPath), failureMessage: String(error?.message ?? error), modelSmokeStarted: false, automaticRetryStarted: false })
    console.error(JSON.stringify({ status: "stage4_validation_kernel_phase0_failed_closed", terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath), failureMessage: String(error?.message ?? error) }, null, 2))
    return 1
  }
}

function runValidationKernelPreflights(context) {
  const hardware = hardwareSnapshot()
  const disk = diskBudgetSnapshot()
  const blockers = [...evaluateV7TrainingGpuResourceGate(hardware.gpu)]
  if (!disk.passed) blockers.push("disk_budget_insufficient")
  const python = spawnSync(PYTHON, [TRAINER, "--config", resolve(context.inactiveConfigPath), "--dataset-package", resolve(context.datasetPath), "--autoencoder-checkpoint", resolve(context.autoencoderPath), "--output-dir", resolve(`${VALIDATION_KERNEL_ROOT}/preflight-output-must-not-be-created`), "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "30", "--overfit-evaluation-interval", "5", "--preflight-only"], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 180000 })
  if (python.status !== 0) blockers.push("python_preflight_failed")
  return { schemaVersion: "ai-painter-stage4-validation-kernel-phase0-preflight-v1", status: blockers.length === 0 ? "phase0_preflights_passed_gpu_execution_not_consumed" : "phase0_preflights_failed_closed_gpu_execution_not_consumed", recordedAtUtc: new Date().toISOString(), hardware, disk, python: { exitCode: python.status, signal: python.signal, stdout: python.stdout, stderr: python.stderr }, blockers: [...new Set(blockers)], checkpointRead: false, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, phase0ExecutionConsumed: false }
}

function writeValidationKernelPreflightFailure(preflight) {
  const root = resolve(`${VALIDATION_KERNEL_ROOT}/preflight-failures/${timestampId()}`)
  fs.mkdirSync(root, { recursive: true })
  const reportPath = path.join(root, "preflight-report.json")
  const terminalPath = path.join(root, "phase-terminal.json")
  writeImmutableJson(reportPath, preflight)
  writeImmutableJson(terminalPath, { schemaVersion: "ai-painter-stage4-validation-kernel-preflight-terminal-v1", status: "stage4_validation_kernel_preflight_failed_closed", recordedAtUtc: new Date().toISOString(), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath), blockers: preflight.blockers, phase0ExecutionConsumed: false })
}

function runValidationKernelTrainerPart(context, extraArgs, outputDir) {
  return new Promise((complete) => {
    const args = [TRAINER, "--config", resolve(context.inactiveConfigPath), "--dataset-package", resolve(context.datasetPath), "--autoencoder-checkpoint", resolve(context.autoencoderPath), "--output-dir", outputDir, "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "1", "--overfit-evaluation-interval", "1", ...extraArgs]
    const child = spawn(PYTHON, args, { cwd: ROOT, env: { ...pythonEnv(), CUBLAS_WORKSPACE_CONFIG: ":4096:8" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); process.stdout.write(chunk) })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); process.stderr.write(chunk) })
    child.on("error", (error) => { stderr += error.stack || error.message })
    child.on("close", (exitCode, signal) => complete({ exitCode, signal, stdout, stderr }))
  })
}

function timestampId() {
  const now = new Date()
  const pad = (value, width = 2) => String(value).padStart(width, "0")
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}${pad(now.getUTCMilliseconds(), 3)}`
}

function validateAuthorization(authorizationPath, authorization, options = {}) {
  if (options.semanticMixtureSmokeMode) return validateSemanticMixtureSmokeAuthorization(authorizationPath, authorization, options)
  if (options.semanticRendererSmokeMode) return validateSemanticRendererSmokeAuthorization(authorizationPath, authorization, options)
  if (options.structureFactFirstSmokeMode) return validateStructureFactFirstSmokeAuthorization(authorizationPath, authorization, options)
  if (options.validationKernelSmokeMode) return validateValidationKernelSmokeAuthorization(authorizationPath, authorization, options)
  if (options.continuousPreviewMode) return validateContinuousPreviewAuthorization(authorizationPath, authorization, options)
  if (options.v9Mode) return validateV9Authorization(authorizationPath, authorization, options)
  if (authorization.schemaVersion !== "ai-painter-r5-stage4-v8-smoke-gpu-execution-authorization-v1") throw new Error("v8_smoke_authorization_schema_invalid")
  if (authorization.status !== "owner_authorized_gpu_smoke_not_consumed") throw new Error("v8_smoke_authorization_status_invalid")
  if (authorization.ownerDecision?.commandRef !== "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808") throw new Error("v8_smoke_command_ref_invalid")
  const identity = authorization.taskIdentity ?? {}
  if (identity.sampleId !== SAMPLE_ID || identity.sampleSplit !== "validation" || identity.seed !== 20263722) throw new Error("v8_smoke_sample_or_seed_identity_invalid")
  if (!sameJson(identity.requiredBoundarySides, ["west"]) || !sameJson(identity.previewEpochs, PREVIEW_EPOCHS) || identity.epochCount !== 30) throw new Error("v8_smoke_topology_or_epoch_identity_invalid")
  if (!sameJson(identity.requiredSplitCounts, SPLITS) || identity.datasetSelectionContract !== "registered_v7_capacity_contribution_v1") throw new Error("v8_smoke_dataset_identity_invalid")
  const actions = authorization.authorizedActions ?? {}
  for (const key of ["gpuUseAuthorized", "autoencoderCheckpointReadAuthorized", "optimizerCreationAuthorized", "backwardExecutionAuthorized", "boundedWeightMutationAuthorized", "smokeCheckpointWriteAuthorized", "machineReviewAuthorized"]) {
    if (actions[key] !== true) throw new Error(`v8_smoke_authorized_action_closed:${key}`)
  }
  for (const key of ["oldDenoiserCheckpointReadAuthorized", "stage4FullTrainingAuthorized", "stage1OrStage2Authorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized"]) {
    if (actions[key] !== false) throw new Error(`v8_smoke_forbidden_action_open:${key}`)
  }
  for (const [key, binding] of Object.entries(authorization.bindings ?? {})) {
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`v8_smoke_binding_missing_or_changed:${key}`)
  }
  const cpuReport = readJsonRequired(authorization.bindings.cpuReport.path)
  const cpuTerminal = readJsonRequired(authorization.bindings.cpuTerminal.path)
  if (cpuReport.status !== "passed_cpu_only_v8_training_loss_smoke_not_active" || cpuTerminal.status !== "v8_stage4_training_loss_smoke_cpu_passed_closed") throw new Error("v8_smoke_cpu_prerequisite_invalid")
  if (!sameJson(cpuReport.evidence?.actualSplitCounts, SPLITS) || !sameJson(cpuReport.evidence?.sample194Occurrences, ["validation"])) throw new Error("v8_smoke_cpu_dataset_evidence_invalid")
  const diagnosticTerminal = readJsonRequired(authorization.bindings.gradientDiagnosticTerminal.path)
  if (diagnosticTerminal.status !== "v8_gradient_diagnostic_passed_closed") throw new Error("v8_smoke_gradient_diagnostic_prerequisite_invalid")
  const inactiveConfig = readJsonRequired(authorization.bindings.inactiveConfig.path)
  if (inactiveConfig.training?.trainingAuthorizationStatus !== resolveStageControlMode("v8_stage4_inactive").authorizationStatus) throw new Error("v8_smoke_inactive_config_status_invalid")
  const sourceIndex = readJsonRequired(authorization.bindings.sourceIndex.path)
  const rows = (sourceIndex.samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation") throw new Error("v8_smoke_fixed_sample_not_unique")
  if (!sameJson(countSplits(rows), SPLITS)) throw new Error("v8_smoke_actual_dataset_splits_invalid")
  const outputDir = resolve(authorization.outputPaths.outputDirectory)
  const finalizationDir = resolve(authorization.outputPaths.finalizationDirectory)
  const activeConfigPath = resolve(authorization.outputPaths.activeConfig)
  const consumptionPath = resolve(authorization.consumptionPath)
  if ([outputDir, finalizationDir, activeConfigPath, consumptionPath].some((value) => fs.existsSync(value))) throw new Error("v8_smoke_output_or_consumption_already_exists")
  return {
    mode: "v8",
    authorization,
    authorizationPath: projectPath(authorizationPath),
    authorizationSha256: sha256File(authorizationPath),
    inactiveConfig,
    inactiveConfigPath: authorization.bindings.inactiveConfig.path,
    sample,
    outputDir,
    finalizationDir,
    activeConfigPath,
    consumptionPath,
    autoencoderPath: authorization.bindings.autoencoderCheckpoint.path,
    autoencoderSha256: authorization.bindings.autoencoderCheckpoint.sha256,
    datasetPath: authorization.bindings.datasetManifest.path,
  }
}

function validateSemanticMixtureSmokeAuthorization(authorizationPath, authorization, { cpuContractOnly = false, authorizationSha256 } = {}) {
  const normalizedPath = assertProjectBoundPath(authorizationPath, "semantic_mixture_smoke_authorization")
  if (!authorizationSha256 || sha256File(authorizationPath) !== authorizationSha256.toLowerCase()) throw new Error("semantic_mixture_smoke_authorization_sha256_invalid")
  const denied = ALL_EXECUTION_ACTIONS.filter((value) => !STRUCTURE_SMOKE_ACTIONS.includes(value)).sort()
  if (
    authorization.schemaVersion !== SEMANTIC_MIXTURE_SMOKE_SCHEMA
    || authorization.status !== "resolved_owner_authorized_not_consumed"
    || !authorization.requestId
    || authorization.commandRef !== authorization.requestId
    || authorization.scope !== SEMANTIC_MIXTURE_SMOKE_SCOPE
    || !(
      /^owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-[0-9-]+$/.test(authorization.requestId)
      || /^owner-authorized-stage4-object-reference-multiscale-early-convergence-30-epoch-model-smoke-[0-9-]+$/.test(authorization.requestId)
    )
    || !sameJson([...(authorization.executionActions ?? [])].sort(), STRUCTURE_SMOKE_ACTIONS)
    || !sameJson([...(authorization.explicitlyDeniedActions ?? [])].sort(), denied)
  ) throw new Error("semantic_mixture_smoke_authorization_identity_invalid")
  const identity = authorization.taskIdentity ?? {}
  if (
    identity.modeId !== SEMANTIC_MIXTURE_SMOKE_MODE_ID
    || identity.architecture !== SEMANTIC_MIXTURE_SMOKE_ARCHITECTURE
    || identity.sampleId !== SAMPLE_ID
    || identity.sampleSplit !== "validation"
    || identity.seed !== 20263722
    || !sameJson(identity.requiredBoundarySides, ["west"])
    || !sameJson(identity.resolution, { width: 256, height: 192 })
    || identity.epochCount !== 30
    || !sameJson(identity.previewEpochs, PREVIEW_EPOCHS)
    || !sameJson(identity.datasetSplit, SPLITS)
    || identity.initialization !== "project_random_fact_conditioned_semantic_mixture"
    || identity.oldDenoiserCheckpointReadAuthorized !== false
    || identity.diagnosticCheckpointReadAuthorized !== false
  ) throw new Error("semantic_mixture_smoke_fixed_identity_invalid")
  const mode = resolveStageControlMode(SEMANTIC_MIXTURE_SMOKE_MODE_ID)
  if (
    mode.authorizationStatus !== "owner_authorized_stage4_fact_conditioned_semantic_mixture_single_sample_gpu_smoke"
    || mode.executionKind !== "single_sample_smoke"
    || mode.architecture !== SEMANTIC_MIXTURE_SMOKE_ARCHITECTURE
  ) throw new Error("semantic_mixture_smoke_mode_registry_invalid")
  const baseBindings = [
    "implementationAuthorization", "implementationConsumption",
    "readonlyGpuTerminal", "readonlyGpuDiagnostic", "cudaTelemetry", "readonlyCpuReport",
    "inactiveConfig", "architectureSupportContract", "datasetManifest", "datasetSourceIndex",
    "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor",
    "windowsSafePreviewNormalizer", "gpuResourceGate",
  ]
  if (authorization.taskIdentity?.evidenceEligibilityContractId !== "stage4_execution_evidence_eligibility_v1") {
    throw new Error("semantic_mixture_smoke_execution_evidence_eligibility_required")
  }
  if (!authorization.bindings?.executionEvidenceRegistry) throw new Error("semantic_mixture_smoke_execution_evidence_registry_missing")
  const registry = authorization.bindings.executionEvidenceRegistry
  const roleBindings = {
    "stage4.finalVisibleRgb.gpuQualificationTerminal": authorization.bindings.readonlyGpuTerminal,
    "stage4.finalVisibleRgb.gpuDiagnosticReport": authorization.bindings.readonlyGpuDiagnostic,
    "stage4.finalVisibleRgb.cudaTelemetry": authorization.bindings.cudaTelemetry,
    "stage4.finalVisibleRgb.cpuAuthorizationReport": authorization.bindings.readonlyCpuReport,
    "stage4.finalVisibleRgb.inactiveConfig": authorization.bindings.inactiveConfig,
    "stage4.finalVisibleRgb.trainingObjectiveSupportContract": authorization.bindings.architectureSupportContract,
  }
  for (const [role, binding] of Object.entries(roleBindings)) {
    validateStage4ExecutionEvidenceBinding({
      root: ROOT,
      registryPath: registry.path,
      registrySha256: registry.sha256,
      role,
      binding,
    })
  }
  // CPU contract fixtures and real execution authorizations intentionally share
  // the exact final binding shape.  cpuContractOnly controls execution, not the
  // immutable evidence identity that is being validated.
  const requiredBindings = [
    ...baseBindings,
    "cpuReport",
    "implementationAttestation",
    "executionEvidenceRegistry",
  ]
  if (!sameJson(Object.keys(authorization.bindings ?? {}).sort(), requiredBindings.sort())) throw new Error("semantic_mixture_smoke_binding_set_invalid")
  for (const key of requiredBindings) {
    const binding = authorization.bindings[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`semantic_mixture_smoke_binding_missing_or_changed:${key}`)
    assertProjectBoundPath(binding.path, `semantic_mixture_smoke_binding:${key}`)
  }
  const codePaths = {
    authorizationPolicy: STAGE_CONTROL_POLICY,
    executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py",
    modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
    trainer: TRAINER,
    runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
    cpuChecker: V9_CPU_CHECKER,
    model: "ml/ai-painter/src/ai_painter/complete_world/model.py",
    inactiveConfigCompiler: "ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py",
  }
  if (!sameJson(Object.keys(authorization.codeBindings ?? {}).sort(), Object.keys(codePaths).sort())) throw new Error("semantic_mixture_smoke_code_binding_set_invalid")
  for (const [key, currentPath] of Object.entries(codePaths)) {
    if (authorization.codeBindings[key]?.path !== currentPath || !fileHashMatches(currentPath, authorization.codeBindings[key]?.sha256)) throw new Error(`semantic_mixture_smoke_code_binding_changed:${key}`)
  }
  const implementationAuthorization = readJsonRequired(authorization.bindings.implementationAuthorization.path)
  const implementationConsumption = readJsonRequired(authorization.bindings.implementationConsumption.path)
  const terminal = readJsonRequired(authorization.bindings.readonlyGpuTerminal.path)
  const diagnostic = readJsonRequired(authorization.bindings.readonlyGpuDiagnostic.path)
  const cudaTelemetry = readJsonRequired(authorization.bindings.cudaTelemetry.path)
  const readonlyCpu = readJsonRequired(authorization.bindings.readonlyCpuReport.path)
  const inactiveConfig = readJsonRequired(authorization.bindings.inactiveConfig.path)
  const semanticMixtureDiagnosticMetrics = semanticMixtureDiagnosticMetricsFromConfig(inactiveConfig)
  if (!sameJson(identity.diagnosticManifestFields, semanticMixtureDiagnosticMetrics)) {
    throw new Error("semantic_mixture_smoke_diagnostic_registry_identity_invalid")
  }
  const legacySemanticMixtureQualification = (
    terminal.status === "fact_conditioned_semantic_mixture_gradient_diagnostic_passed_closed"
    && diagnostic.status === "passed_readonly_fact_conditioned_semantic_mixture_gpu_causal_and_gradient_diagnostic"
    && readonlyCpu.status === "passed_fact_conditioned_semantic_mixture_readonly_gpu_diagnostic_cpu_authorization_regression"
  )
  const finalVisibleRgbQualification = (
    terminal.status === "stage4_per_class_final_visible_rgb_gpu_qualification_passed_closed"
    && diagnostic.status === "passed_readonly_stage4_per_class_final_visible_rgb_gpu_gradient_qualification"
    && readonlyCpu.status === "passed_stage4_final_visible_rgb_readonly_gpu_diagnostic_cpu_authorization_regression"
  )
  const vegetationRepairQualification = (
    terminal.status === "stage4_vegetation_final_visible_gpu_qualification_passed_closed"
    && diagnostic.status === "passed_readonly_stage4_vegetation_final_visible_gpu_gradient_qualification"
    && readonlyCpu.status === "passed_stage4_vegetation_final_visible_readonly_gpu_diagnostic_cpu_authorization_regression"
  )
  const vegetationLuminanceQualification = (
    terminal.status === "stage4_per_class_final_visible_rgb_gpu_qualification_passed_closed"
    && diagnostic.status === "passed_readonly_stage4_per_class_final_visible_rgb_gpu_gradient_qualification"
    && readonlyCpu.status === "passed_stage4_vegetation_luminance_spatial_readonly_gpu_diagnostic_cpu_authorization_regression"
    && diagnostic.identity?.trainingObjectiveContractId === "stage4_vegetation_luminance_spatial_structure_supervision_v1"
    && diagnostic.gradientEvidence?.vegetationLuminanceSpatialStructure?.reachesFinalDenoiserRgbPath === true
    && diagnostic.gradientEvidence?.vegetationLuminanceSpatialStructure?.reachesFrozenAutoencoderDecodedRgb === true
  )
  const fullRolloutQualification = (
    terminal.status === "stage4_full_rollout_readonly_gpu_qualification_succeeded_closed"
    && diagnostic.status === "passed_readonly_full_50_step_rollout_gradient_qualification"
    && readonlyCpu.status === "passed_stage4_full_rollout_final_visible_consistency_cpu"
    && inactiveConfig.training?.stage4FullRolloutFinalVisibleConsistency?.contractId
      === "stage4_full_rollout_final_visible_consistency_v1"
    && inactiveConfig.training?.stage4FullRolloutFinalVisibleConsistency?.rolloutSteps === 50
    && inactiveConfig.training?.stage4FullRolloutFinalVisibleConsistency?.gradientTailSteps === 5
  )
  const epochWorstReplayQualification = (
    terminal.status === "stage4_epoch_worst_readonly_gpu_qualification_succeeded_closed"
    && diagnostic.status === "passed_stage4_epoch_worst_readonly_gpu_qualification"
    && readonlyCpu.status === "passed_stage4_epoch_worst_sample_class_replay_cpu"
    && inactiveConfig.training?.stage4EpochWorstSampleClassReplay?.contractId
      === "stage4_epoch_global_worst_sample_class_final_visible_replay_v1"
    && inactiveConfig.training?.stage4EpochWorstSampleClassReplay?.replay
      ?.passesSource === "training.pathHardExampleReplay.passesPerEpoch"
  )
  const objectVisibleStructureQualification = (
    terminal.status === "stage4_object_visible_structure_phase0_passed_closed"
    && terminal.diagnosticCheckpointPromotable === false
    && terminal.smokeStarted === false
    && terminal.formalTrainingStarted === false
    && diagnostic.status === "stage4_object_visible_structure_phase0_passed_closed"
    && diagnostic.optimizerSteps === 1
    && diagnostic.smokeQuotaConsumed === false
    && Object.values(diagnostic.equality ?? {}).every((value) => value === true)
    && cudaTelemetry.status === "phase0_single_cuda_optimizer_step_passed_closed"
    && cudaTelemetry.weightsChanged === true
    && cudaTelemetry.autoencoderWeightsChanged === false
    && cudaTelemetry.fullTrainingInitializationEligible === false
    && readonlyCpu.status === "stage4_object_visible_structure_phase0_derived_diagnostic_registry_correction_cpu_contract_passed"
    && readonlyCpu.positivePassed === readonlyCpu.positiveTotal
    && readonlyCpu.negativePassed === readonlyCpu.negativeTotal
    && inactiveConfig.training?.stage4ObjectVisibleStructureSupervision?.contractId
      === "stage4_four_typed_object_visible_structure_supervision_v1"
    && inactiveConfig.training?.stage4ObjectVisibleStructureSupervision?.status
      === "cpu_support_verified_inactive"
  )
  const objectReferenceMultiscaleQualification = (
    terminal.status === "stage4_object_reference_multiscale_phase0_passed_closed"
    && terminal.diagnosticCheckpointPromotable === false
    && terminal.smokeStarted === false
    && terminal.formalTrainingStarted === false
    && diagnostic.status === "stage4_object_reference_multiscale_phase0_passed_closed"
    && diagnostic.optimizerSteps === 1
    && diagnostic.backwardCalls === 1
    && diagnostic.replayOptimizerSteps === 0
    && diagnostic.diagnosticManifestMetricCount === 48
    && diagnostic.requiredGradientGroupCount === 5
    && diagnostic.smokeQuotaConsumed === false
    && Object.values(diagnostic.equality ?? {}).every((value) => value === true)
    && cudaTelemetry.status === "phase0_single_cuda_optimizer_step_passed_closed"
    && cudaTelemetry.optimizerStepCount === 1
    && cudaTelemetry.backwardCallCount === 1
    && cudaTelemetry.replayOptimizerStepCount === 0
    && cudaTelemetry.parameterGradientsCleared === true
    && cudaTelemetry.weightsChanged === true
    && cudaTelemetry.autoencoderWeightsChanged === false
    && cudaTelemetry.diagnosticManifest?.fieldCount === 48
    && sameJson(Object.keys(cudaTelemetry.requiredGradientGroups ?? {}), ["footprints", "tree", "rock", "vegetation", "combined"])
    && readonlyCpu.status === "stage4_object_reference_multiscale_phase0_success_continuation_path_correction_cpu_passed"
    && readonlyCpu.positivePassed === readonlyCpu.positiveTotal
    && readonlyCpu.negativePassed === readonlyCpu.negativeTotal
    && identity.trainingObjectiveContractId === "typed_object_multiscale_luminance_structure_correlation_supervision_v1"
    && sameJson(identity.objectSemanticChannels, ["object_footprints", "object_tree", "object_rock", "object_vegetation"])
    && sameJson(identity.pyramidScales, [1, 0.5, 0.25])
    && inactiveConfig.training?.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision?.contractId
      === "typed_object_multiscale_luminance_structure_correlation_supervision_v1"
    && inactiveConfig.training?.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision?.status
      === "cpu_support_verified_inactive"
    && inactiveConfig.training?.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision?.noveltyBoundary
      ?.failedSingleScaleContractReuseAllowed === false
    && inactiveConfig.training?.stage4ObjectVisibleStructureSupervision === undefined
  )
  const objectReferenceMultiscaleEarlyConvergenceQualification = (
    terminal.status === "stage4_two_lane_early_convergence_gpu_qualification_passed_closed"
    && terminal.optimizerCreated === false
    && terminal.backwardMethodExecuted === false
    && terminal.modelWeightsModified === false
    && terminal.checkpointWritten === false
    && terminal.trainingStarted === false
    && terminal.automaticRetryStarted === false
    && diagnostic.status === "passed_readonly_stage4_two_lane_early_convergence_gpu_gradient_qualification"
    && diagnostic.identity?.trainingObjectiveContractId === "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
    && diagnostic.identity?.replayLaneCount === 2
    && diagnostic.diagnosticManifest?.fieldCount === 48
    && diagnostic.gradientEvidence?.fourObjectVisibleStructure?.combined?.finiteAndStrictlyNonzero === true
    && diagnostic.gradientEvidence?.twoLaneEarlyConvergenceStabilization?.lane1DenoiserGradientNorm > 0
    && diagnostic.gradientEvidence?.twoLaneEarlyConvergenceStabilization?.lane2DenoiserGradientNorm > 0
    && diagnostic.gradientEvidence?.twoLaneEarlyConvergenceStabilization?.combinedTwoLaneDenoiserGradientNorm > 0
    && diagnostic.gradientEvidence?.twoLaneEarlyConvergenceStabilization?.replayPassesAdded === 0
    && diagnostic.optimizerCreated === false
    && diagnostic.backwardMethodExecuted === false
    && diagnostic.modelWeightsModified === false
    && diagnostic.checkpointWritten === false
    && diagnostic.trainingStarted === false
    && cudaTelemetry.status === "collected_after_readonly_forward_and_autograd_grad"
    && readonlyCpu.status === "early_convergence_gpu_qualification_finalization_cpu_contract_passed"
    && readonlyCpu.positivePassed === readonlyCpu.positiveTotal
    && readonlyCpu.negativePassed === readonlyCpu.negativeTotal
    && identity.trainingObjectiveContractId === "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
    && sameJson(identity.objectSemanticChannels, ["object_footprints", "object_tree", "object_rock", "object_vegetation"])
    && sameJson(identity.pyramidScales, [1, 0.5, 0.25])
    && identity.replayLaneCount === 2
    && inactiveConfig.training?.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization?.contractId
      === "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
    && inactiveConfig.training?.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization?.status
      === "cpu_support_verified_inactive"
    && inactiveConfig.training?.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization?.replayBudget
      ?.addsReplayPasses === false
    && inactiveConfig.training?.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization?.replayBudget
      ?.addsOptimizerSteps === false
  )
  if (
    !["resolved_owner_authorized_not_consumed", "owner_authorized_unconsumed"].includes(implementationAuthorization.status)
    || implementationConsumption.authorizationSha256 !== authorization.bindings.implementationAuthorization.sha256
    || implementationConsumption.oneTimeConsumption !== true
    || (!legacySemanticMixtureQualification && !finalVisibleRgbQualification && !vegetationRepairQualification && !vegetationLuminanceQualification && !fullRolloutQualification && !epochWorstReplayQualification && !objectVisibleStructureQualification && !objectReferenceMultiscaleQualification && !objectReferenceMultiscaleEarlyConvergenceQualification)
    || readonlyCpu.positivePassed !== readonlyCpu.positiveTotal
    || readonlyCpu.negativePassed !== readonlyCpu.negativeTotal
    || inactiveConfig.denoiserArchitecture !== SEMANTIC_MIXTURE_SMOKE_ARCHITECTURE
    || inactiveConfig.training?.trainingAuthorizationStatus !== "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
  ) throw new Error("semantic_mixture_smoke_prerequisite_invalid")
  if (!cpuContractOnly) {
    const cpuReport = readJsonRequired(authorization.bindings.cpuReport.path)
    const attestation = readJsonRequired(authorization.bindings.implementationAttestation.path)
    if (
      cpuReport.status !== "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed"
      || attestation.status !== "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified"
      || attestation.cpuReportSha256 !== authorization.bindings.cpuReport.sha256
      || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
      || attestation.trainerSha256 !== sha256File(TRAINER)
      || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
      || attestation.modeRegistrySha256 !== sha256File("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
    ) throw new Error("semantic_mixture_smoke_cpu_evidence_invalid")
  }
  const rows = (readJsonRequired(authorization.bindings.datasetSourceIndex.path).samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  const sampleBinding = inactiveConfig.training?.factConditionedSemanticMixtureSampleBinding ?? {}
  if (
    !sample
    || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1
    || sample.split !== "validation"
    || !sameJson(countSplits(rows), SPLITS)
    || sampleBinding.sampleId !== SAMPLE_ID
    || sampleBinding.sampleSplit !== "validation"
    || sampleBinding.imagePath !== sample.imagePath
    || sampleBinding.conditionPackPath !== sample.conditionPackPath
    || !sameJson(sampleBinding.requiredBoundarySides, ["west"])
  ) throw new Error("semantic_mixture_smoke_dataset_or_sample_identity_invalid")
  const execution = authorization.execution ?? {}
  if (!sameJson(Object.keys(execution).sort(), ["consumptionPath", "activeConfigPath", "trainingOutputDirectory", "finalizationDirectory", "preflightReportPath"].sort())) throw new Error("semantic_mixture_smoke_output_contract_invalid")
  const consumptionPath = resolve(assertProjectBoundPath(execution.consumptionPath, "semantic_mixture_smoke_consumption"))
  const outputDir = resolve(assertProjectBoundPath(execution.trainingOutputDirectory, "semantic_mixture_smoke_training_output"))
  const finalizationDir = resolve(assertProjectBoundPath(execution.finalizationDirectory, "semantic_mixture_smoke_finalization"))
  const activeConfigPath = resolve(assertProjectBoundPath(execution.activeConfigPath, "semantic_mixture_smoke_active_config"))
  const preflightReportPath = resolve(assertProjectBoundPath(execution.preflightReportPath, "semantic_mixture_smoke_preflight_report"))
  if (fs.existsSync(consumptionPath)) throw new Error("semantic_mixture_smoke_authorization_already_consumed")
  if (!cpuContractOnly && [outputDir, finalizationDir, activeConfigPath, preflightReportPath].some((value) => fs.existsSync(value))) throw new Error("semantic_mixture_smoke_output_already_exists")
  return {
    mode: "semantic-mixture", requestId: authorization.requestId, scope: authorization.scope,
    authorization, authorizationPath: normalizedPath, authorizationSha256: authorizationSha256.toLowerCase(),
    implementationAttestationPath: authorization.bindings.implementationAttestation?.path ?? null,
    implementationAttestationSha256: authorization.bindings.implementationAttestation?.sha256 ?? null,
    inactiveConfig, inactiveConfigPath: authorization.bindings.inactiveConfig.path,
    semanticMixtureDiagnosticMetrics, sample,
    outputDir, finalizationDir, activeConfigPath, consumptionPath, preflightReportPath,
    autoencoderPath: authorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256,
    datasetPath: authorization.bindings.datasetManifest.path,
  }
}

function validateSemanticRendererSmokeAuthorization(authorizationPath, authorization, { cpuContractOnly = false, authorizationSha256 } = {}) {
  const normalizedPath = assertProjectBoundPath(authorizationPath, "semantic_renderer_smoke_authorization")
  if (!authorizationSha256 || sha256File(authorizationPath) !== authorizationSha256.toLowerCase()) throw new Error("semantic_renderer_smoke_authorization_sha256_invalid")
  const denied = ALL_EXECUTION_ACTIONS.filter((value) => !STRUCTURE_SMOKE_ACTIONS.includes(value)).sort()
  if (
    authorization.schemaVersion !== SEMANTIC_RENDERER_SMOKE_SCHEMA
    || authorization.status !== "resolved_owner_authorized_not_consumed"
    || !authorization.requestId
    || authorization.commandRef !== authorization.requestId
    || authorization.scope !== SEMANTIC_RENDERER_SMOKE_SCOPE
    || !/^owner-authorized-stage4-semantic-renderer-30-epoch-model-smoke-[0-9-]+$/.test(authorization.requestId)
    || !sameJson([...(authorization.executionActions ?? [])].sort(), STRUCTURE_SMOKE_ACTIONS)
    || !sameJson([...(authorization.explicitlyDeniedActions ?? [])].sort(), denied)
  ) throw new Error("semantic_renderer_smoke_authorization_identity_invalid")
  const identity = authorization.taskIdentity ?? {}
  if (
    identity.modeId !== SEMANTIC_RENDERER_SMOKE_MODE_ID
    || identity.architecture !== SEMANTIC_RENDERER_SMOKE_ARCHITECTURE
    || identity.sampleId !== SAMPLE_ID
    || identity.sampleSplit !== "validation"
    || identity.seed !== 20263722
    || !sameJson(identity.requiredBoundarySides, ["west"])
    || !sameJson(identity.resolution, { width: 256, height: 192 })
    || identity.epochCount !== 30
    || !sameJson(identity.previewEpochs, PREVIEW_EPOCHS)
    || !sameJson(identity.datasetSplit, SPLITS)
    || identity.initialization !== "project_random_condition_preserving_semantic_renderer"
    || identity.oldDenoiserCheckpointReadAuthorized !== false
    || !sameJson(identity.diagnosticManifestFields, SEMANTIC_RENDERER_DIAGNOSTIC_METRICS)
  ) throw new Error("semantic_renderer_smoke_fixed_identity_invalid")
  const mode = resolveStageControlMode(SEMANTIC_RENDERER_SMOKE_MODE_ID)
  if (
    mode.authorizationStatus !== "owner_authorized_stage4_condition_preserving_semantic_renderer_single_sample_gpu_smoke"
    || mode.executionKind !== "single_sample_smoke"
    || mode.architecture !== SEMANTIC_RENDERER_SMOKE_ARCHITECTURE
  ) throw new Error("semantic_renderer_smoke_mode_registry_invalid")
  const baseBindings = [
    "implementationAuthorization", "implementationConsumption",
    "readonlyGpuTerminal", "readonlyGpuDiagnostic", "cudaTelemetry", "readonlyCpuReport",
    "inactiveConfig", "architectureSupportContract", "datasetManifest", "datasetSourceIndex",
    "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor",
    "windowsSafePreviewNormalizer", "gpuResourceGate",
  ]
  const requiredBindings = cpuContractOnly ? baseBindings : [...baseBindings, "cpuReport", "implementationAttestation"]
  if (!sameJson(Object.keys(authorization.bindings ?? {}).sort(), requiredBindings.sort())) throw new Error("semantic_renderer_smoke_binding_set_invalid")
  for (const key of requiredBindings) {
    const binding = authorization.bindings[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`semantic_renderer_smoke_binding_missing_or_changed:${key}`)
    assertProjectBoundPath(binding.path, `semantic_renderer_smoke_binding:${key}`)
  }
  const codePaths = {
    authorizationPolicy: STAGE_CONTROL_POLICY,
    executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py",
    modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
    trainer: TRAINER,
    runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
    cpuChecker: V9_CPU_CHECKER,
    model: "ml/ai-painter/src/ai_painter/complete_world/model.py",
    inactiveConfigCompiler: "ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py",
  }
  if (!sameJson(Object.keys(authorization.codeBindings ?? {}).sort(), Object.keys(codePaths).sort())) throw new Error("semantic_renderer_smoke_code_binding_set_invalid")
  for (const [key, currentPath] of Object.entries(codePaths)) {
    if (authorization.codeBindings[key]?.path !== currentPath || !fileHashMatches(currentPath, authorization.codeBindings[key]?.sha256)) throw new Error(`semantic_renderer_smoke_code_binding_changed:${key}`)
  }
  const implementationAuthorization = readJsonRequired(authorization.bindings.implementationAuthorization.path)
  const implementationConsumption = readJsonRequired(authorization.bindings.implementationConsumption.path)
  const terminal = readJsonRequired(authorization.bindings.readonlyGpuTerminal.path)
  const diagnostic = readJsonRequired(authorization.bindings.readonlyGpuDiagnostic.path)
  const readonlyCpu = readJsonRequired(authorization.bindings.readonlyCpuReport.path)
  const inactiveConfig = readJsonRequired(authorization.bindings.inactiveConfig.path)
  if (
    implementationAuthorization.status !== "resolved_owner_authorized_not_consumed"
    || implementationConsumption.authorizationSha256 !== authorization.bindings.implementationAuthorization.sha256
    || implementationConsumption.oneTimeConsumption !== true
    || terminal.status !== "stage4_condition_preserving_semantic_renderer_readonly_gpu_diagnostic_passed_closed"
    || diagnostic.status !== "passed_readonly_semantic_renderer_gpu_forward_and_gradient_routing_weights_unchanged"
    || readonlyCpu.status !== "passed_cpu_only_gpu_not_started"
    || readonlyCpu.positivePassed !== readonlyCpu.positiveTotal
    || readonlyCpu.negativePassed !== readonlyCpu.negativeTotal
    || inactiveConfig.denoiserArchitecture !== SEMANTIC_RENDERER_SMOKE_ARCHITECTURE
    || inactiveConfig.training?.trainingAuthorizationStatus !== "stage4_condition_preserving_semantic_renderer_cpu_supported_inactive"
  ) throw new Error("semantic_renderer_smoke_prerequisite_invalid")
  if (!cpuContractOnly) {
    const cpuReport = readJsonRequired(authorization.bindings.cpuReport.path)
    const attestation = readJsonRequired(authorization.bindings.implementationAttestation.path)
    if (
      cpuReport.status !== "condition_preserving_semantic_renderer_stage4_smoke_cpu_regression_passed"
      || attestation.status !== "condition_preserving_semantic_renderer_stage4_smoke_implementation_cpu_verified"
      || attestation.cpuReportSha256 !== authorization.bindings.cpuReport.sha256
      || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
      || attestation.trainerSha256 !== sha256File(TRAINER)
      || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
      || attestation.modeRegistrySha256 !== sha256File("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")
    ) throw new Error("semantic_renderer_smoke_cpu_evidence_invalid")
  }
  const rows = (readJsonRequired(authorization.bindings.datasetSourceIndex.path).samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  const sampleBinding = inactiveConfig.training?.conditionPreservingSemanticRendererSampleBinding ?? {}
  if (
    !sample
    || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1
    || sample.split !== "validation"
    || !sameJson(countSplits(rows), SPLITS)
    || sampleBinding.sampleId !== SAMPLE_ID
    || sampleBinding.sampleSplit !== "validation"
    || sampleBinding.imagePath !== sample.imagePath
    || sampleBinding.conditionPackPath !== sample.conditionPackPath
    || !sameJson(sampleBinding.requiredBoundarySides, ["west"])
  ) throw new Error("semantic_renderer_smoke_dataset_or_sample_identity_invalid")
  const execution = authorization.execution ?? {}
  if (!sameJson(Object.keys(execution).sort(), ["consumptionPath", "activeConfigPath", "trainingOutputDirectory", "finalizationDirectory", "preflightReportPath"].sort())) throw new Error("semantic_renderer_smoke_output_contract_invalid")
  const consumptionPath = resolve(assertProjectBoundPath(execution.consumptionPath, "semantic_renderer_smoke_consumption"))
  const outputDir = resolve(assertProjectBoundPath(execution.trainingOutputDirectory, "semantic_renderer_smoke_training_output"))
  const finalizationDir = resolve(assertProjectBoundPath(execution.finalizationDirectory, "semantic_renderer_smoke_finalization"))
  const activeConfigPath = resolve(assertProjectBoundPath(execution.activeConfigPath, "semantic_renderer_smoke_active_config"))
  const preflightReportPath = resolve(assertProjectBoundPath(execution.preflightReportPath, "semantic_renderer_smoke_preflight_report"))
  if (fs.existsSync(consumptionPath)) throw new Error("semantic_renderer_smoke_authorization_already_consumed")
  if (!cpuContractOnly && [outputDir, finalizationDir, activeConfigPath, preflightReportPath].some((value) => fs.existsSync(value))) throw new Error("semantic_renderer_smoke_output_already_exists")
  return {
    mode: "semantic-renderer", requestId: authorization.requestId, scope: authorization.scope,
    authorization, authorizationPath: normalizedPath, authorizationSha256: authorizationSha256.toLowerCase(),
    implementationAttestationPath: authorization.bindings.implementationAttestation?.path ?? null,
    implementationAttestationSha256: authorization.bindings.implementationAttestation?.sha256 ?? null,
    inactiveConfig, inactiveConfigPath: authorization.bindings.inactiveConfig.path, sample,
    outputDir, finalizationDir, activeConfigPath, consumptionPath, preflightReportPath,
    autoencoderPath: authorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256,
    datasetPath: authorization.bindings.datasetManifest.path,
  }
}


function validateStructureFactFirstSmokeAuthorization(authorizationPath, authorization, { cpuContractOnly = false, authorizationSha256 } = {}) {
  const normalizedPath = assertProjectBoundPath(authorizationPath, "structure_fact_first_smoke_authorization")
  if (!authorizationSha256 || sha256File(authorizationPath) !== authorizationSha256.toLowerCase()) throw new Error("structure_fact_first_smoke_authorization_sha256_invalid")
  const denied = ALL_EXECUTION_ACTIONS.filter((value) => !STRUCTURE_SMOKE_ACTIONS.includes(value)).sort()
  if (
    authorization.schemaVersion !== "ai-painter-stage4-structure-fact-first-smoke-execution-authorization-v1"
    || authorization.status !== "resolved_owner_authorized_not_consumed"
    || !authorization.requestId
    || authorization.commandRef !== authorization.requestId
    || !authorization.scope
    || !sameJson([...(authorization.executionActions ?? [])].sort(), STRUCTURE_SMOKE_ACTIONS)
    || !sameJson([...(authorization.explicitlyDeniedActions ?? [])].sort(), denied)
  ) throw new Error("structure_fact_first_smoke_authorization_identity_invalid")
  const identity = authorization.taskIdentity ?? {}
  if (
    identity.modeId !== STRUCTURE_SMOKE_MODE_ID
    || identity.architecture !== STRUCTURE_PHASE0_ARCHITECTURE
    || identity.sampleId !== SAMPLE_ID
    || identity.sampleSplit !== "validation"
    || identity.seed !== 20263722
    || identity.timestep !== 999
    || !sameJson(identity.requiredBoundarySides, ["west"])
    || !sameJson(identity.resolution, { width: 256, height: 192 })
    || identity.epochCount !== 30
    || !sameJson(identity.previewEpochs, PREVIEW_EPOCHS)
    || !sameJson(identity.datasetSplit, SPLITS)
    || identity.initialization !== "project_random_structure_fact_first_denoiser"
    || identity.phase0DiagnosticCheckpointUsedAsInitialization !== false
  ) throw new Error("structure_fact_first_smoke_fixed_identity_invalid")
  const mode = resolveStageControlMode(STRUCTURE_SMOKE_MODE_ID)
  if (mode.authorizationStatus !== "owner_authorized_stage4_structure_fact_first_single_sample_gpu_smoke" || mode.executionKind !== "single_sample_smoke" || mode.architecture !== STRUCTURE_PHASE0_ARCHITECTURE) throw new Error("structure_fact_first_smoke_mode_registry_invalid")
  const baseBindings = [
    "implementationAuthorization", "implementationConsumption", "phase0SuccessTerminal",
    "phase0Finalization", "phase0CpuReport", "inactiveConfig", "architectureSupportContract",
    "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint",
    "conditionAlignmentAuditor", "professionalAestheticAuditor", "windowsSafePreviewNormalizer", "gpuResourceGate",
    "successfulPreflightReport",
  ]
  const requiredBindings = cpuContractOnly ? baseBindings : [...baseBindings, "cpuReport", "implementationAttestation"]
  if (Object.keys(authorization.bindings ?? {}).some((key) => ![...baseBindings, "cpuReport", "implementationAttestation"].includes(key))) throw new Error("structure_fact_first_smoke_unknown_binding")
  for (const key of requiredBindings) {
    const binding = authorization.bindings?.[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`structure_fact_first_smoke_binding_missing_or_changed:${key}`)
    assertProjectBoundPath(binding.path, `structure_fact_first_smoke_binding:${key}`)
  }
  for (const [key, currentPath] of Object.entries({ authorizationPolicy: STAGE_CONTROL_POLICY, executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py", modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py", trainer: TRAINER, runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs", cpuChecker: V9_CPU_CHECKER, model: "ml/ai-painter/src/ai_painter/complete_world/model.py" })) {
    if (authorization.codeBindings?.[key]?.path !== currentPath || !fileHashMatches(currentPath, authorization.codeBindings?.[key]?.sha256)) throw new Error(`structure_fact_first_smoke_code_binding_changed:${key}`)
  }
  const implementationAuthorization = readJsonRequired(authorization.bindings.implementationAuthorization.path)
  const implementationConsumption = readJsonRequired(authorization.bindings.implementationConsumption.path)
  const phase0Terminal = readJsonRequired(authorization.bindings.phase0SuccessTerminal.path)
  const phase0Finalization = readJsonRequired(authorization.bindings.phase0Finalization.path)
  const phase0Cpu = readJsonRequired(authorization.bindings.phase0CpuReport.path)
  if (
    implementationAuthorization.status !== "resolved_owner_authorized_not_consumed"
    || implementationConsumption.authorizationSha256 !== authorization.bindings.implementationAuthorization.sha256
    || implementationConsumption.oneTimeConsumption !== true
    || phase0Terminal.status !== "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed"
    || phase0Finalization.status !== "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed"
    || Object.values(phase0Finalization.equality ?? {}).some((value) => value !== true)
    || phase0Cpu.status !== "structure_fact_first_phase0_canonical_condition_identity_cpu_regression_passed"
  ) throw new Error("structure_fact_first_smoke_prerequisite_invalid")
  const inactiveConfig = readJsonRequired(authorization.bindings.inactiveConfig.path)
  if (inactiveConfig.denoiserArchitecture !== STRUCTURE_PHASE0_ARCHITECTURE || inactiveConfig.training?.trainingAuthorizationStatus !== "stage4_structure_fact_first_dual_stage_cpu_supported_inactive") throw new Error("structure_fact_first_smoke_inactive_config_invalid")
  if (!cpuContractOnly) {
    const cpuReport = readJsonRequired(authorization.bindings.cpuReport.path)
    const attestation = readJsonRequired(authorization.bindings.implementationAttestation.path)
    if (
      cpuReport.status !== "structure_fact_first_stage4_smoke_cpu_regression_passed"
      || attestation.status !== "structure_fact_first_stage4_smoke_implementation_cpu_verified"
      || attestation.cpuReportSha256 !== authorization.bindings.cpuReport.sha256
      || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
      || attestation.trainerSha256 !== sha256File(TRAINER)
      || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
    ) throw new Error("structure_fact_first_smoke_cpu_evidence_invalid")
  }
  const successfulPreflight = readJsonRequired(authorization.bindings.successfulPreflightReport.path)
  if (
    successfulPreflight.status !== "structure_fact_first_stage4_smoke_readonly_preflight_passed"
    || successfulPreflight.gpuStarted !== false
    || successfulPreflight.checkpointRead !== false
    || successfulPreflight.optimizerCreated !== false
    || successfulPreflight.trainingStarted !== false
  ) throw new Error("structure_fact_first_smoke_successful_preflight_binding_invalid")
  const rows = (readJsonRequired(authorization.bindings.datasetSourceIndex.path).samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation" || !sameJson(countSplits(rows), SPLITS)) throw new Error("structure_fact_first_smoke_dataset_identity_invalid")
  const qualification = inactiveConfig.training?.stage4StructureFactFirstQualificationContract ?? {}
  if (
    qualification.sampleId !== SAMPLE_ID
    || qualification.sampleSplit !== "validation"
    || qualification.imagePath !== sample.imagePath
    || qualification.conditionPackPath !== sample.conditionPackPath
    || !sameJson(qualification.requiredBoundarySides, ["west"])
  ) throw new Error("structure_fact_first_smoke_shared_sample_identity_invalid")
  const consumptionPath = resolve(assertProjectBoundPath(authorization.execution?.consumptionPath, "structure_fact_first_smoke_consumption"))
  const outputDir = resolve(assertProjectBoundPath(authorization.execution?.trainingOutputDirectory, "structure_fact_first_smoke_training_output"))
  const finalizationDir = resolve(assertProjectBoundPath(authorization.execution?.finalizationDirectory, "structure_fact_first_smoke_finalization"))
  const activeConfigPath = resolve(assertProjectBoundPath(authorization.execution?.activeConfigPath, "structure_fact_first_smoke_active_config"))
  if (fs.existsSync(consumptionPath)) throw new Error("structure_fact_first_smoke_authorization_already_consumed")
  if (!cpuContractOnly && [outputDir, finalizationDir, activeConfigPath].some((value) => fs.existsSync(value))) throw new Error("structure_fact_first_smoke_output_already_exists")
  return { mode: "structure-fact-first", requestId: authorization.requestId, scope: authorization.scope, authorization, authorizationPath: normalizedPath, authorizationSha256: authorizationSha256.toLowerCase(), implementationAttestationPath: authorization.bindings.implementationAttestation?.path ?? null, implementationAttestationSha256: authorization.bindings.implementationAttestation?.sha256 ?? null, phase0TerminalPath: authorization.bindings.phase0SuccessTerminal.path, phase0TerminalSha256: authorization.bindings.phase0SuccessTerminal.sha256, successfulPreflight, successfulPreflightPath: authorization.bindings.successfulPreflightReport.path, successfulPreflightSha256: authorization.bindings.successfulPreflightReport.sha256, inactiveConfig, inactiveConfigPath: authorization.bindings.inactiveConfig.path, sample, outputDir, finalizationDir, activeConfigPath, consumptionPath, autoencoderPath: authorization.bindings.projectAutoencoderCheckpoint.path, autoencoderSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256, datasetPath: authorization.bindings.datasetManifest.path }
}

function validateStructureFactFirstSmokePreflightAuthorization(authorizationPath, authorization, authorizationSha256) {
  const normalizedPath = assertProjectBoundPath(authorizationPath, "structure_fact_first_smoke_preflight_authorization")
  if (!authorizationSha256 || sha256File(authorizationPath) !== authorizationSha256.toLowerCase()) throw new Error("structure_fact_first_smoke_preflight_authorization_sha256_invalid")
  const denied = ALL_EXECUTION_ACTIONS.filter((value) => !STRUCTURE_SMOKE_PREFLIGHT_ACTIONS.includes(value)).sort()
  if (
    authorization.schemaVersion !== "ai-painter-stage4-structure-fact-first-smoke-preflight-authorization-v1"
    || authorization.status !== "resolved_owner_authorized_not_consumed"
    || authorization.preflightOnly !== true
    || !authorization.requestId
    || authorization.commandRef !== authorization.requestId
    || !authorization.scope
    || !sameJson([...(authorization.executionActions ?? [])].sort(), STRUCTURE_SMOKE_PREFLIGHT_ACTIONS)
    || !sameJson([...(authorization.explicitlyDeniedActions ?? [])].sort(), denied)
    || Object.hasOwn(authorization, "executionConsumptionPath")
    || Object.hasOwn(authorization, "executionConsumptionSha256")
  ) throw new Error("structure_fact_first_smoke_preflight_authorization_identity_invalid")
  const identity = authorization.taskIdentity ?? {}
  if (
    identity.modeId !== STRUCTURE_SMOKE_MODE_ID
    || identity.architecture !== STRUCTURE_PHASE0_ARCHITECTURE
    || identity.sampleId !== SAMPLE_ID
    || identity.sampleSplit !== "validation"
    || identity.seed !== 20263722
    || identity.timestep !== 999
    || identity.preflightOnly !== true
    || !sameJson(identity.requiredBoundarySides, ["west"])
    || !sameJson(identity.resolution, { width: 256, height: 192 })
    || identity.epochCount !== 30
    || !sameJson(identity.previewEpochs, PREVIEW_EPOCHS)
    || !sameJson(identity.datasetSplit, SPLITS)
  ) throw new Error("structure_fact_first_smoke_preflight_fixed_identity_invalid")
  const requiredBindings = [
    "implementationAuthorization", "implementationConsumption", "implementationAttestation",
    "phase0SuccessTerminal", "phase0Finalization", "phase0CpuReport", "inactiveConfig",
    "architectureSupportContract", "datasetManifest", "datasetSourceIndex",
    "projectAutoencoderCheckpoint",
  ]
  if (!sameJson(Object.keys(authorization.bindings ?? {}).sort(), [...requiredBindings].sort())) throw new Error("structure_fact_first_smoke_preflight_binding_set_invalid")
  for (const key of requiredBindings) {
    const binding = authorization.bindings[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`structure_fact_first_smoke_preflight_binding_missing_or_changed:${key}`)
    assertProjectBoundPath(binding.path, `structure_fact_first_smoke_preflight_binding:${key}`)
  }
  for (const [key, currentPath] of Object.entries({ authorizationPolicy: STAGE_CONTROL_POLICY, executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py", modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py", trainer: TRAINER, runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs", cpuChecker: V9_CPU_CHECKER, model: "ml/ai-painter/src/ai_painter/complete_world/model.py" })) {
    if (authorization.codeBindings?.[key]?.path !== currentPath || !fileHashMatches(currentPath, authorization.codeBindings?.[key]?.sha256)) throw new Error(`structure_fact_first_smoke_preflight_code_binding_changed:${key}`)
  }
  const implementationAuthorization = readJsonRequired(authorization.bindings.implementationAuthorization.path)
  const implementationConsumption = readJsonRequired(authorization.bindings.implementationConsumption.path)
  const attestation = readJsonRequired(authorization.bindings.implementationAttestation.path)
  const phase0Terminal = readJsonRequired(authorization.bindings.phase0SuccessTerminal.path)
  if (
    implementationAuthorization.status !== "resolved_owner_authorized_not_consumed"
    || implementationConsumption.authorizationSha256 !== authorization.bindings.implementationAuthorization.sha256
    || implementationConsumption.oneTimeConsumption !== true
    || attestation.status !== "structure_fact_first_stage4_smoke_implementation_cpu_verified"
    || attestation.trainerSha256 !== sha256File(TRAINER)
    || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
    || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
    || phase0Terminal.status !== "stage4_structure_fact_first_phase0_engineering_qualification_passed_closed"
  ) throw new Error("structure_fact_first_smoke_preflight_prerequisite_invalid")
  const inactiveConfig = readJsonRequired(authorization.bindings.inactiveConfig.path)
  const rows = (readJsonRequired(authorization.bindings.datasetSourceIndex.path).samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation" || !sameJson(countSplits(rows), SPLITS)) throw new Error("structure_fact_first_smoke_preflight_dataset_identity_invalid")
  const execution = authorization.execution ?? {}
  if (!sameJson(Object.keys(execution).sort(), ["preflightConfigPath", "preflightOutputDirectory", "preflightReportPath"].sort())) throw new Error("structure_fact_first_smoke_preflight_output_contract_invalid")
  const preflightConfigPath = resolve(assertProjectBoundPath(execution.preflightConfigPath, "structure_fact_first_smoke_preflight_config"))
  const preflightOutputDir = resolve(assertProjectBoundPath(execution.preflightOutputDirectory, "structure_fact_first_smoke_preflight_output"))
  const preflightReportPath = resolve(assertProjectBoundPath(execution.preflightReportPath, "structure_fact_first_smoke_preflight_report"))
  if ([preflightConfigPath, preflightOutputDir, preflightReportPath].some((value) => fs.existsSync(value))) throw new Error("structure_fact_first_smoke_preflight_output_already_exists")
  return {
    mode: "structure-fact-first-preflight", requestId: authorization.requestId, scope: authorization.scope,
    authorization, authorizationPath: normalizedPath, authorizationSha256: authorizationSha256.toLowerCase(),
    inactiveConfig, inactiveConfigPath: authorization.bindings.inactiveConfig.path, sample,
    preflightConfigPath, preflightOutputDir, preflightReportPath,
    autoencoderPath: authorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256,
    datasetPath: authorization.bindings.datasetManifest.path,
    implementationAttestationPath: authorization.bindings.implementationAttestation.path,
    implementationAttestationSha256: authorization.bindings.implementationAttestation.sha256,
    phase0TerminalPath: authorization.bindings.phase0SuccessTerminal.path,
    phase0TerminalSha256: authorization.bindings.phase0SuccessTerminal.sha256,
  }
}

function buildStructureFactFirstSmokePreflightConfig(context) {
  const config = structuredClone(context.inactiveConfig)
  const training = config.training
  const mode = resolveStageControlMode(STRUCTURE_SMOKE_MODE_ID)
  config.architectureVersion = "all-validation-multiseed-semantic-rollout-structure-fact-first-dual-stage-smoke-preflight"
  training.trainingAuthorizationStatus = mode.authorizationStatus
  training.structureFactFirstStage4SingleSampleSmokeContract = {
    status: "preflight_owner_authorized_readonly", sampleId: SAMPLE_ID, sampleSplit: "validation",
    imagePath: context.sample.imagePath, conditionPackPath: context.sample.conditionPackPath,
    seed: 20263722, requiredBoundarySides: ["west"], epochCount: 30,
    previewEpochs: PREVIEW_EPOCHS, resolution: { width: 256, height: 192 },
    oldDenoiserCheckpointCompatible: false, oldDenoiserCheckpointReadAuthorized: false,
    initialization: "project_random_structure_fact_first_denoiser",
    phase0DiagnosticCheckpointUsedAsInitialization: false,
  }
  training.ownerTrainingAuthorization = {
    authorizationId: context.requestId, requestId: context.requestId,
    commandRef: context.authorization.commandRef, scope: context.scope,
    authorizationPath: context.authorizationPath, authorizationSha256: context.authorizationSha256,
    implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
    implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
    implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
    implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
    executionActions: [...context.authorization.executionActions],
    explicitlyDeniedActions: [...context.authorization.explicitlyDeniedActions],
    executionState: "preflight_unconsumed", preflightOnly: true, status: mode.authorizationStatus,
    checkpointLoadingAuthorized: false, optimizerCreationAuthorized: false,
    backwardExecutionAuthorized: false, modelWeightMutationAuthorized: false,
    gpuTrainingAuthorizedNow: false, singleSampleGpuOverfitSmokeAuthorized: false,
    fullTrainingAuthorized: false, stage1Authorized: false, stage2Authorized: false,
    strictRevalidationAuthorized: false, validationAuthorized: false,
    formalInferenceAuthorized: false, checkpointPromotionAuthorized: false,
    runtimeFrameAuthorized: false, worldEntryAuthorized: false, automaticRetryAuthorized: false,
  }
  const contract = training.stage4StructureFactFirstDualStage
  contract.enabled = true
  contract.status = "preflight_owner_authorized_readonly"
  contract.trainingLossImplementationStatus = "implemented_preflight_readonly"
  contract.previewReproductionIdentity.status = "preflight_owner_authorized_readonly"
  contract.previewReproductionIdentity.configurationActiveNow = true
  for (const key of Object.keys(contract.activationGate)) contract.activationGate[key] = key === "configurationActiveNow"
  training.stage4UnifiedTrainingPreviewSamplingContract = {
    schemaVersion: "stage4-unified-training-preview-sampling-contract-v1", enabled: true,
    status: "preflight_owner_authorized_readonly",
    samplingFunction: "evaluate_deterministic_rollout_rgb_quality_v7",
    modelStateBinding: "sha256_sorted_tensor_bytes_v1", seedBinding: "training_seed_plus_3000",
    normalizationBinding: "checkpoint_latent_normalization",
    decodeBinding: "frozen_project_autoencoder_decode_clamp_0_1",
    checkpointPreviewIdentityGate: "byte_exact_best_epoch_reproduction",
    deterministicAlgorithmsRequired: true, cublasWorkspaceConfig: ":4096:8",
    failedPreviewPixelsUsedAsTrainingTargets: false, machineReviewThresholdsUsedAsTrainingTargets: false,
  }
  training.structureFactFirstStage4SmokeExecution = {
    sourceInactiveConfigPath: context.inactiveConfigPath,
    sourceInactiveConfigSha256: sha256File(context.inactiveConfigPath),
    ownerAuthorizationPath: context.authorizationPath,
    ownerAuthorizationSha256: context.authorizationSha256,
    implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
    implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
    implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
    implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
    implementationAttestationPath: context.implementationAttestationPath,
    implementationAttestationSha256: context.implementationAttestationSha256,
    phase0TerminalPath: context.phase0TerminalPath,
    phase0TerminalSha256: context.phase0TerminalSha256,
    preflightOnly: true,
  }
  return config
}

function runStructureFactFirstSmokePreflight(context) {
  writeImmutableJson(context.preflightConfigPath, buildStructureFactFirstSmokePreflightConfig(context))
  const hardware = hardwareSnapshot()
  const disk = diskBudgetSnapshot()
  const blockers = [...evaluateV7TrainingGpuResourceGate(hardware.gpu)]
  if (!disk.passed) blockers.push("disk_budget_insufficient")
  const python = spawnSync(PYTHON, [
    TRAINER, "--config", context.preflightConfigPath, "--dataset-package", resolve(context.datasetPath),
    "--autoencoder-checkpoint", resolve(context.autoencoderPath), "--output-dir", context.preflightOutputDir,
    "--resolution-stage", "0", "--single-sample-overfit-smoke", "--overfit-sample-id", SAMPLE_ID,
    "--overfit-epochs", "30", "--overfit-evaluation-interval", "5", "--stage-control-dry-run", "--preflight-only",
  ], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 240000 })
  if (python.status !== 0) blockers.push("python_preflight_failed")
  if (fs.existsSync(context.preflightOutputDir)) blockers.push("preflight_created_training_output")
  const report = {
    schemaVersion: "ai-painter-stage4-structure-fact-first-smoke-readonly-preflight-v1",
    status: blockers.length === 0 ? "structure_fact_first_stage4_smoke_readonly_preflight_passed" : "structure_fact_first_stage4_smoke_readonly_preflight_failed_closed",
    recordedAtUtc: new Date().toISOString(), requestId: context.requestId,
    authorizationPath: context.authorizationPath, authorizationSha256: context.authorizationSha256,
    preflightConfigPath: projectPath(context.preflightConfigPath), preflightConfigSha256: sha256File(context.preflightConfigPath),
    hardware, disk, python: { exitCode: python.status, signal: python.signal, stdout: python.stdout, stderr: python.stderr },
    blockers: [...new Set(blockers)], gpuStarted: false, checkpointRead: false,
    optimizerCreated: false, backwardExecuted: false, modelWeightsChanged: false,
    checkpointWritten: false, trainingStarted: false,
  }
  writeImmutableJson(context.preflightReportPath, report)
  console.log(JSON.stringify({ ...report, preflightReportPath: projectPath(context.preflightReportPath), preflightReportSha256: sha256File(context.preflightReportPath) }, null, 2))
  return blockers.length === 0 ? 0 : 1
}

function validateValidationKernelSmokeAuthorization(authorizationPath, authorization, { cpuContractOnly = false, authorizationSha256 } = {}) {
  if (authorization.requestId !== VALIDATION_KERNEL_REQUEST_ID) {
    return validateDynamicValidationKernelSmokeAuthorization(authorizationPath, authorization, {
      cpuContractOnly,
      authorizationSha256,
    })
  }
  if (projectPath(authorizationPath) !== VALIDATION_KERNEL_AUTHORIZATION_PATH || sha256File(authorizationPath) !== VALIDATION_KERNEL_AUTHORIZATION_SHA256) throw new Error("validation_kernel_smoke_authorization_identity_invalid")
  if (authorization.requestId !== VALIDATION_KERNEL_REQUEST_ID || authorization.status !== "resolved_owner_authorized" || authorization.ownerDecision?.commandRef !== VALIDATION_KERNEL_REQUEST_ID || authorization.ownerDecision?.scope !== VALIDATION_KERNEL_SCOPE) throw new Error("validation_kernel_smoke_command_identity_invalid")
  const identity = authorization.fixedTaskIdentity ?? {}
  if (identity.sampleId !== SAMPLE_ID || identity.sampleSplit !== "validation" || identity.seed !== 20263722 || !sameJson(identity.requiredBoundarySides, ["west"]) || identity.smokeEpochs !== 30 || !sameJson(identity.smokePreviewEpochs, PREVIEW_EPOCHS) || !sameJson(identity.datasetSplit, SPLITS)) throw new Error("validation_kernel_smoke_fixed_identity_invalid")
  if (authorization.authorizedActions?.singleThirtyEpochV9Smoke !== true || authorization.authorizedActions?.smokeOptimizerBackwardWeightAndCheckpointWrite !== true) throw new Error("validation_kernel_smoke_authorized_actions_closed")
  for (const key of ["formalInference", "checkpointFormalPromotion", "ownerFormalVisualAcceptance", "runtimeFrame", "worldEntry", "worldRuntime"]) if (authorization.authorizedActions?.[key] !== false) throw new Error(`validation_kernel_smoke_forbidden_action_open:${key}`)
  const sourceAuthorization = readJsonRequired(SOURCE_V9_AUTHORIZATION_PATH)
  if (sha256File(SOURCE_V9_AUTHORIZATION_PATH) !== SOURCE_V9_AUTHORIZATION_SHA256) throw new Error("validation_kernel_smoke_source_v9_authorization_changed")
  for (const key of ["v9InactiveConfig", "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor", "windowsSafePreviewNormalizer", "gpuResourceGate"]) {
    const binding = sourceAuthorization.bindings?.[key]
    if (!binding || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`validation_kernel_smoke_source_binding_changed:${key}`)
  }
  const phase0Terminal = findSuccessfulValidationKernelPhase0Terminal()
  const attestationPath = `${VALIDATION_KERNEL_ROOT}/model-smoke-implementation-attestation.json`
  if (!cpuContractOnly) {
    const attestation = readJsonRequired(attestationPath)
    if (attestation.status !== "stage4_validation_kernel_model_smoke_implementation_cpu_verified" || attestation.authorizationSha256 !== VALIDATION_KERNEL_AUTHORIZATION_SHA256 || attestation.phase0TerminalSha256 !== phase0Terminal.sha256 || attestation.trainerSha256 !== sha256File(TRAINER) || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs") || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)) throw new Error("validation_kernel_smoke_implementation_attestation_invalid")
  }
  const sourceIndex = readJsonRequired(sourceAuthorization.bindings.datasetSourceIndex.path)
  const rows = (sourceIndex.samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation" || !sameJson(countSplits(rows), SPLITS)) throw new Error("validation_kernel_smoke_dataset_identity_invalid")
  const runId = "model-smoke-20260810-validated-kernel"
  const runRoot = `${VALIDATION_KERNEL_ROOT}/model-smoke/${runId}`
  const outputDir = resolve(`${runRoot}/training`)
  const finalizationDir = resolve(`${runRoot}/finalization`)
  const activeConfigPath = resolve(`${runRoot}/active-config.json`)
  const consumptionPath = resolve(authorization.output.smokeConsumptionPath)
  if (!cpuContractOnly && [outputDir, finalizationDir, activeConfigPath, consumptionPath].some((value) => fs.existsSync(value))) throw new Error("validation_kernel_smoke_output_or_consumption_already_exists")
  return { mode: "v9-kernel", requestId: VALIDATION_KERNEL_REQUEST_ID, scope: VALIDATION_KERNEL_SCOPE, authorization, authorizationPath: projectPath(authorizationPath), authorizationSha256: sha256File(authorizationPath), implementationAttestationPath: projectPath(attestationPath), implementationAttestationSha256: cpuContractOnly ? null : sha256File(attestationPath), phase0TerminalPath: phase0Terminal.path, phase0TerminalSha256: phase0Terminal.sha256, inactiveConfig: readJsonRequired(sourceAuthorization.bindings.v9InactiveConfig.path), inactiveConfigPath: sourceAuthorization.bindings.v9InactiveConfig.path, sample, outputDir, finalizationDir, activeConfigPath, consumptionPath, autoencoderPath: sourceAuthorization.bindings.projectAutoencoderCheckpoint.path, autoencoderSha256: sourceAuthorization.bindings.projectAutoencoderCheckpoint.sha256, datasetPath: sourceAuthorization.bindings.datasetManifest.path }
}

function validateDynamicValidationKernelSmokeAuthorization(authorizationPath, authorization, { cpuContractOnly = false, authorizationSha256 } = {}) {
  const normalizedAuthorizationPath = assertProjectBoundPath(authorizationPath, "dynamic_validation_kernel_authorization")
  if (!authorizationSha256 || !/^[a-f0-9]{64}$/i.test(authorizationSha256) || sha256File(authorizationPath) !== authorizationSha256.toLowerCase()) throw new Error("dynamic_validation_kernel_authorization_sha256_invalid")
  if (authorization.schemaVersion === DUAL_IDENTITY_GPU_AUTHORIZATION_SCHEMA) {
    return validateDualIdentityGpuExecutionAuthorization(normalizedAuthorizationPath, authorization, {
      cpuContractOnly,
      authorizationSha256: authorizationSha256.toLowerCase(),
    })
  }
  if (authorization.schemaVersion !== "ai-painter-owner-action-request-v1" || authorization.status !== "resolved_owner_authorized") throw new Error("dynamic_validation_kernel_authorization_schema_or_status_invalid")
  const requestId = authorization.requestId
  const scope = authorization.ownerDecision?.scope
  if (!requestId || authorization.ownerDecision?.commandRef !== requestId || !scope) throw new Error("dynamic_validation_kernel_command_identity_invalid")
  const splitActionContract = authorization.implementationActions !== undefined || authorization.executionActions !== undefined
  if (splitActionContract) {
    if (authorization.implementationActions && authorization.executionActions && Object.keys(authorization.implementationActions).some((key) => Object.hasOwn(authorization.executionActions, key))) throw new Error("dynamic_validation_kernel_implementation_execution_action_overlap")
    if (!sameExactObject(authorization.implementationActions, DYNAMIC_VALIDATION_KERNEL_IMPLEMENTATION_ACTIONS)) throw new Error("dynamic_validation_kernel_exact_implementation_action_contract_invalid")
    if (!sameExactObject(authorization.executionActions, DYNAMIC_VALIDATION_KERNEL_EXECUTION_ACTIONS)) throw new Error("dynamic_validation_kernel_exact_execution_action_contract_invalid")
  } else if (!sameExactObject(authorization.authorizedActions, DYNAMIC_VALIDATION_KERNEL_ACTIONS)) {
    throw new Error("dynamic_validation_kernel_exact_action_contract_invalid")
  }
  if (authorization.executionPolicy?.maximumGpuSmokeExecutions !== 1 || authorization.executionPolicy?.allCpuAndResourcePreflightsMustPassBeforeGpuConsumption !== true || authorization.executionPolicy?.failureStopsImmediately !== true || authorization.executionPolicy?.automaticRetryAuthorized !== false) throw new Error("dynamic_validation_kernel_execution_policy_invalid")
  const identity = authorization.fixedTaskIdentity ?? {}
  if (identity.modeId !== "v9_stage4_validation_kernel_smoke" || identity.architecture !== "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" || identity.sampleId !== SAMPLE_ID || identity.sampleSplit !== "validation" || identity.seed !== 20263722 || !sameJson(identity.requiredBoundarySides, ["west"]) || !sameJson(identity.resolution, { width: 256, height: 192 }) || identity.smokeEpochs !== 30 || !sameJson(identity.smokePreviewEpochs, PREVIEW_EPOCHS) || identity.datasetCapacity !== 64 || !sameJson(identity.datasetSplit, SPLITS)) throw new Error("dynamic_validation_kernel_fixed_identity_invalid")
  const mode = resolveStageControlMode(identity.modeId)
  if (mode.authorizationStatus !== "owner_authorized_v9_stage4_validation_kernel_single_sample_gpu_smoke" || mode.executionKind !== "single_sample_smoke" || mode.architecture !== identity.architecture) throw new Error("dynamic_validation_kernel_mode_registry_resolution_invalid")
  const authorizedConsumptionPath = resolve(assertProjectBoundPath(authorization.output?.smokeConsumptionPath, "dynamic_validation_kernel_gpu_consumption"))
  if (fs.existsSync(authorizedConsumptionPath)) throw new Error("dynamic_validation_kernel_gpu_authorization_already_consumed")

  const requiredBindings = [
    "previousFailureTerminal", splitActionContract ? "previousCpuRegressionReport" : "previousCpuAuthorizationGateReport", "trainerFrozen",
    "authorizationPolicyFrozen", "executionGrantFrozen", "modeRegistryFrozen",
    "phase0SuccessTerminal", "v9InactiveConfig", "datasetManifest", "datasetSourceIndex",
    "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor",
    "windowsSafePreviewNormalizer", "gpuResourceGate",
  ]
  for (const key of requiredBindings) {
    const binding = authorization.bindings?.[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`dynamic_validation_kernel_binding_missing_or_changed:${key}`)
    assertProjectBoundPath(binding.path, `dynamic_validation_kernel_binding:${key}`)
  }
  const previousReport = readJsonRequired(authorization.bindings[splitActionContract ? "previousCpuRegressionReport" : "previousCpuAuthorizationGateReport"].path)
  if (splitActionContract) {
    const previousTerminal = readJsonRequired(authorization.bindings.previousFailureTerminal.path)
    if (previousReport.status !== "stage4_dynamic_owner_binding_model_smoke_cpu_regression_failed_closed" || previousTerminal.status !== "stage4_dynamic_owner_binding_model_smoke_cpu_gate_failed_closed") throw new Error("dynamic_validation_kernel_previous_cpu_regression_binding_invalid")
  } else if (previousReport.status !== "failed_closed_before_python_cuda_disk_or_gpu_preflights" || previousReport.runnerInvocation?.runnerSha256 !== authorization.bindings?.smokeRunnerBeforeFix?.sha256) {
    throw new Error("dynamic_validation_kernel_previous_failure_binding_invalid")
  }
  const phase0Terminal = readJsonRequired(authorization.bindings.phase0SuccessTerminal.path)
  if (phase0Terminal.status !== "stage4_validation_kernel_phase0_passed_closed") throw new Error("dynamic_validation_kernel_phase0_terminal_invalid")
  const implementationConsumptionPath = assertProjectBoundPath(authorization.output?.implementationConsumptionPath, "dynamic_validation_kernel_implementation_consumption")
  const implementationConsumption = readJsonRequired(implementationConsumptionPath)
  if (implementationConsumption.oneTimeConsumption !== true || implementationConsumption.authorizationSha256 !== authorizationSha256.toLowerCase() || implementationConsumption.commandRef !== requestId || implementationConsumption.scope !== scope) throw new Error("dynamic_validation_kernel_implementation_consumption_invalid")

  const sourceIndex = readJsonRequired(authorization.bindings.datasetSourceIndex.path)
  const rows = (sourceIndex.samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation" || !sameJson(countSplits(rows), SPLITS)) throw new Error("dynamic_validation_kernel_dataset_identity_invalid")
  const outputDir = resolve(assertProjectBoundPath(authorization.output?.trainingOutputDirectory, "dynamic_validation_kernel_training_output"))
  const finalizationDir = resolve(assertProjectBoundPath(authorization.output?.finalizationDirectory, "dynamic_validation_kernel_finalization"))
  const activeConfigPath = resolve(assertProjectBoundPath(authorization.output?.activeConfigPath, "dynamic_validation_kernel_active_config"))
  const consumptionPath = authorizedConsumptionPath
  if (!cpuContractOnly && [outputDir, finalizationDir, activeConfigPath].some((value) => fs.existsSync(value))) throw new Error("dynamic_validation_kernel_output_already_exists")
  const attestationPath = assertProjectBoundPath(authorization.output?.implementationAttestationPath, "dynamic_validation_kernel_implementation_attestation")
  if (!cpuContractOnly) {
    const attestation = readJsonRequired(attestationPath)
    if (attestation.status !== "stage4_validation_kernel_model_smoke_implementation_cpu_verified" || attestation.authorizationSha256 !== authorizationSha256.toLowerCase() || attestation.phase0TerminalSha256 !== authorization.bindings.phase0SuccessTerminal.sha256 || attestation.trainerSha256 !== sha256File(TRAINER) || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs") || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)) throw new Error("dynamic_validation_kernel_implementation_attestation_invalid")
  }
  return {
    mode: "v9-kernel", requestId, scope, authorization,
    authorizationPath: normalizedAuthorizationPath,
    authorizationSha256: authorizationSha256.toLowerCase(),
    implementationAttestationPath: projectPath(attestationPath),
    implementationAttestationSha256: cpuContractOnly ? null : sha256File(attestationPath),
    phase0TerminalPath: authorization.bindings.phase0SuccessTerminal.path,
    phase0TerminalSha256: authorization.bindings.phase0SuccessTerminal.sha256,
    inactiveConfig: readJsonRequired(authorization.bindings.v9InactiveConfig.path),
    inactiveConfigPath: authorization.bindings.v9InactiveConfig.path,
    sample, outputDir, finalizationDir, activeConfigPath, consumptionPath,
    autoencoderPath: authorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256,
    datasetPath: authorization.bindings.datasetManifest.path,
  }
}

function validateDualIdentityGpuExecutionAuthorization(normalizedAuthorizationPath, authorization, { cpuContractOnly, authorizationSha256 }) {
  if (authorization.status !== "owner_authorized_gpu_execution_not_consumed") throw new Error("dual_identity_gpu_authorization_status_invalid")
  const requestId = authorization.requestId
  const scope = authorization.ownerDecision?.scope
  if (!/^owner-authorized-stage4-v9-model-smoke-gpu-execution-[a-z0-9-]+$/.test(requestId ?? "") || authorization.ownerDecision?.commandRef !== requestId || scope !== DUAL_IDENTITY_GPU_SCOPE || path.basename(path.dirname(resolve(normalizedAuthorizationPath))) !== requestId || path.basename(normalizedAuthorizationPath) !== "gpu-execution-authorization.json") throw new Error("dual_identity_gpu_command_identity_invalid")
  if (Object.hasOwn(authorization, "implementationActions") || Object.hasOwn(authorization, "authorizedActions")) throw new Error("dual_identity_gpu_implementation_permission_injection")
  if (!sameExactObject(authorization.executionActions, DYNAMIC_VALIDATION_KERNEL_EXECUTION_ACTIONS)) throw new Error("dual_identity_gpu_exact_execution_action_contract_invalid")
  if (authorization.executionPolicy?.maximumGpuSmokeExecutions !== 1 || authorization.executionPolicy?.allCpuAndResourcePreflightsMustPassBeforeGpuConsumption !== true || authorization.executionPolicy?.failureStopsImmediately !== true || authorization.executionPolicy?.automaticRetryAuthorized !== false) throw new Error("dual_identity_gpu_execution_policy_invalid")
  const identity = authorization.fixedTaskIdentity ?? {}
  if (identity.modeId !== "v9_stage4_validation_kernel_smoke" || identity.architecture !== "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment" || identity.sampleId !== SAMPLE_ID || identity.sampleSplit !== "validation" || identity.seed !== 20263722 || !sameJson(identity.requiredBoundarySides, ["west"]) || !sameJson(identity.resolution, { width: 256, height: 192 }) || identity.smokeEpochs !== 30 || !sameJson(identity.smokePreviewEpochs, PREVIEW_EPOCHS) || identity.datasetCapacity !== 64 || !sameJson(identity.datasetSplit, SPLITS)) throw new Error("dual_identity_gpu_fixed_task_identity_invalid")
  const mode = resolveStageControlMode(identity.modeId)
  if (mode.authorizationStatus !== "owner_authorized_v9_stage4_validation_kernel_single_sample_gpu_smoke" || mode.executionKind !== "single_sample_smoke" || mode.architecture !== identity.architecture) throw new Error("dual_identity_gpu_mode_registry_resolution_invalid")

  const implementation = authorization.implementationIdentity ?? {}
  const expectedImplementationKeys = ["authorizationPath", "authorizationSha256", "consumptionPath", "consumptionSha256", "attestationPath", "attestationSha256"]
  if (!sameJson(Object.keys(implementation).sort(), expectedImplementationKeys.sort())) throw new Error("dual_identity_gpu_implementation_identity_fields_invalid")
  for (const [label, pathKey, hashKey] of [
    ["authorization", "authorizationPath", "authorizationSha256"],
    ["consumption", "consumptionPath", "consumptionSha256"],
    ["attestation", "attestationPath", "attestationSha256"],
  ]) {
    assertProjectBoundPath(implementation[pathKey], `dual_identity_gpu_implementation_${label}`)
    if (!fileHashMatches(implementation[pathKey], implementation[hashKey])) throw new Error(`dual_identity_gpu_implementation_${label}_missing_or_changed`)
  }
  const implementationAuthorization = readJsonRequired(implementation.authorizationPath)
  const implementationConsumption = readJsonRequired(implementation.consumptionPath)
  const implementationAttestation = readJsonRequired(implementation.attestationPath)
  if (implementationAuthorization.schemaVersion !== DUAL_IDENTITY_IMPLEMENTATION_AUTHORIZATION_SCHEMA || implementationAuthorization.status !== "owner_authorized_implementation_not_consumed") throw new Error("dual_identity_gpu_implementation_authorization_invalid")
  if (implementationConsumption.status !== "stage4_dual_identity_lineage_implementation_authorization_atomically_consumed" || implementationConsumption.oneTimeConsumption !== true || implementationConsumption.authorizationSha256 !== implementation.authorizationSha256 || implementationConsumption.requestId !== implementationAuthorization.requestId || implementationConsumption.commandRef !== implementationAuthorization.requestId || implementationConsumption.scope !== implementationAuthorization.ownerDecision?.scope) throw new Error("dual_identity_gpu_implementation_consumption_invalid")
  if (implementationAttestation.status !== DUAL_IDENTITY_IMPLEMENTATION_ATTESTATION_STATUS || implementationAttestation.implementationAuthorizationSha256 !== implementation.authorizationSha256 || implementationAttestation.implementationConsumptionSha256 !== implementation.consumptionSha256 || implementationAttestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs") || implementationAttestation.trainerSha256 !== sha256File(TRAINER) || implementationAttestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)) throw new Error("dual_identity_gpu_implementation_attestation_invalid")

  const requiredBindings = [
    "previousSmokeFailureTerminal", "previousSmokeFinalization", "previousGpuConsumption",
    "phase0SuccessTerminal", "v9InactiveConfig", "datasetManifest", "datasetSourceIndex",
    "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor",
    "windowsSafePreviewNormalizer", "gpuResourceGate",
  ]
  if (!authorization.cpuContractFixture) requiredBindings.push("cpuReport", "supportContract", "cpuTerminal")
  if (authorization.cpuContractFixture === true && !cpuContractOnly) throw new Error("dual_identity_gpu_cpu_contract_fixture_cannot_execute")
  for (const key of requiredBindings) {
    const binding = authorization.bindings?.[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`dual_identity_gpu_binding_missing_or_changed:${key}`)
    assertProjectBoundPath(binding.path, `dual_identity_gpu_binding:${key}`)
  }
  if (!authorization.cpuContractFixture) {
    const cpuReport = readJsonRequired(authorization.bindings.cpuReport.path)
    const cpuTerminal = readJsonRequired(authorization.bindings.cpuTerminal.path)
    if (cpuReport.status !== "stage4_dual_identity_model_smoke_cpu_regression_passed" || cpuTerminal.status !== "stage4_dual_identity_model_smoke_cpu_gate_passed_closed") throw new Error("dual_identity_gpu_cpu_gate_binding_invalid")
  }
  const phase0Terminal = readJsonRequired(authorization.bindings.phase0SuccessTerminal.path)
  if (phase0Terminal.status !== "stage4_validation_kernel_phase0_passed_closed") throw new Error("dual_identity_gpu_phase0_terminal_invalid")
  const sourceIndex = readJsonRequired(authorization.bindings.datasetSourceIndex.path)
  const rows = (sourceIndex.samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation" || !sameJson(countSplits(rows), SPLITS)) throw new Error("dual_identity_gpu_dataset_identity_invalid")

  const consumptionPath = resolve(assertProjectBoundPath(authorization.output?.smokeConsumptionPath, "dual_identity_gpu_consumption"))
  if (fs.existsSync(consumptionPath)) throw new Error("dual_identity_gpu_authorization_already_consumed")
  const outputDir = resolve(assertProjectBoundPath(authorization.output?.trainingOutputDirectory, "dual_identity_gpu_training_output"))
  const finalizationDir = resolve(assertProjectBoundPath(authorization.output?.finalizationDirectory, "dual_identity_gpu_finalization"))
  const activeConfigPath = resolve(assertProjectBoundPath(authorization.output?.activeConfigPath, "dual_identity_gpu_active_config"))
  if (!cpuContractOnly && [outputDir, finalizationDir, activeConfigPath].some((value) => fs.existsSync(value))) throw new Error("dual_identity_gpu_output_already_exists")
  return {
    mode: "v9-kernel", requestId, scope, authorization,
    authorizationPath: normalizedAuthorizationPath,
    authorizationSha256,
    implementationAttestationPath: implementation.attestationPath,
    implementationAttestationSha256: implementation.attestationSha256,
    phase0TerminalPath: authorization.bindings.phase0SuccessTerminal.path,
    phase0TerminalSha256: authorization.bindings.phase0SuccessTerminal.sha256,
    inactiveConfig: readJsonRequired(authorization.bindings.v9InactiveConfig.path),
    inactiveConfigPath: authorization.bindings.v9InactiveConfig.path,
    sample, outputDir, finalizationDir, activeConfigPath, consumptionPath,
    autoencoderPath: authorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256,
    datasetPath: authorization.bindings.datasetManifest.path,
  }
}

function findSuccessfulValidationKernelPhase0Terminal() {
  const root = resolve(`${VALIDATION_KERNEL_ROOT}/phase0`)
  if (!fs.existsSync(root)) throw new Error("validation_kernel_phase0_root_missing")
  const terminals = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name, "finalization", "phase-terminal.json")).filter((value) => fs.existsSync(value)).map((value) => ({ path: projectPath(value), sha256: sha256File(value), value: readJsonRequired(value) })).filter((row) => row.value.status === "stage4_validation_kernel_phase0_passed_closed")
  if (terminals.length !== 1) throw new Error("validation_kernel_unique_successful_phase0_terminal_invalid")
  return terminals[0]
}

function validateContinuousPreviewAuthorization(authorizationPath, authorization, { cpuContractOnly = false } = {}) {
  if (projectPath(authorizationPath) !== CONTINUOUS_AUTHORIZATION_PATH) throw new Error("continuous_preview_authorization_path_invalid")
  if (sha256File(authorizationPath) !== CONTINUOUS_AUTHORIZATION_SHA256) throw new Error("continuous_preview_authorization_sha256_invalid")
  if (authorization.schemaVersion !== "ai-painter-owner-action-request-v1" || authorization.status !== "resolved_owner_authorized") throw new Error("continuous_preview_authorization_schema_or_status_invalid")
  if (authorization.requestId !== CONTINUOUS_REQUEST_ID || authorization.ownerDecision?.commandRef !== CONTINUOUS_REQUEST_ID || authorization.ownerDecision?.scope !== CONTINUOUS_SCOPE) throw new Error("continuous_preview_command_identity_invalid")
  const identity = authorization.fixedTaskIdentity ?? {}
  if (identity.sampleId !== SAMPLE_ID || identity.sampleSplit !== "validation" || identity.seed !== 20263722) throw new Error("continuous_preview_sample_or_seed_identity_invalid")
  if (!sameJson(identity.requiredBoundarySides, ["west"]) || !sameJson(identity.smokePreviewEpochs, PREVIEW_EPOCHS) || identity.smokeEpochs !== 30) throw new Error("continuous_preview_topology_or_schedule_invalid")
  if (!sameJson(identity.resolution, { width: 256, height: 192 })) throw new Error("continuous_preview_resolution_invalid")
  const actions = authorization.authorizedActions ?? {}
  for (const key of ["projectAutoencoderCheckpointReadAndLoad", "boundedSmokeOptimizerCreation", "boundedSmokeBackwardExecution", "boundedSmokeWeightModification", "boundedSmokeCheckpointWrite", "singleThirtyEpochGpuSmoke", "machineReview", "evidenceAndTerminalWrite"]) {
    if (actions[key] !== true) throw new Error(`continuous_preview_authorized_action_closed:${key}`)
  }
  for (const key of ["stage5StrictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame", "worldEntry", "machineReviewThresholdReduction", "failedPreviewPixelsAsTrainingTarget", "freeHyperparameterSearch"]) {
    if (actions[key] !== false) throw new Error(`continuous_preview_forbidden_action_open:${key}`)
  }
  if (authorization.continuousExecutionPolicy?.maximumGpuSmokeExecutions !== 1) throw new Error("continuous_preview_gpu_smoke_budget_invalid")
  const decisionBinding = authorization.bindings?.causalGpuDiagnosticReport
  if (!decisionBinding?.path || !fileHashMatches(decisionBinding.path, decisionBinding.sha256)) throw new Error("continuous_preview_gpu_diagnostic_binding_invalid")
  const decisionPath = ".runtime/ai-painter/stage4-causal-boundary-diagnostics/20260809-182939654/causal-boundary-decision.json"
  if (!fileHashMatches(decisionPath, "b086954df85568ade5d0dbfde58289af6899e01ce538196b0c8b5ae0bef40b9d")) throw new Error("continuous_preview_fault_decision_binding_invalid")
  if (readJsonRequired(decisionPath).faultLayer !== "training_preview_pipeline_layer") throw new Error("continuous_preview_fault_layer_invalid")

  const previousAuthorizationPath = "data/ai-painter/system-governance/owner-authorized-v9-stage4-sample194-30-epoch-gpu-smoke-20260809.json"
  if (!fileHashMatches(previousAuthorizationPath, "e77183c6c0f6f94e0db75a5dc94f3c66f376e86c598f8164175a8551b7142e1e")) throw new Error("continuous_preview_source_v9_authorization_changed")
  const previousAuthorization = readJsonRequired(previousAuthorizationPath)
  for (const key of ["v9InactiveConfig", "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint", "conditionAlignmentAuditor", "professionalAestheticAuditor", "windowsSafePreviewNormalizer", "gpuResourceGate"]) {
    const binding = previousAuthorization.bindings?.[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`continuous_preview_source_binding_changed:${key}`)
  }
  const inactiveConfigPath = `${CONTINUOUS_ROOT}/unified-preview-contract/inactive-config.json`
  const inactiveConfig = readJsonRequired(inactiveConfigPath)
  if (inactiveConfig.training?.trainingAuthorizationStatus !== resolveStageControlMode("v9_stage4_inactive").authorizationStatus) throw new Error("continuous_preview_inactive_config_status_invalid")
  const previewContract = inactiveConfig.training?.stage4UnifiedTrainingPreviewSamplingContract
  if (previewContract?.enabled !== false || previewContract?.status !== "compiled_inactive_not_authorized" || previewContract?.checkpointPreviewIdentityGate !== "byte_exact_best_epoch_reproduction") throw new Error("continuous_preview_inactive_contract_invalid")
  const sourceIndex = readJsonRequired(previousAuthorization.bindings.datasetSourceIndex.path)
  const rows = (sourceIndex.samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation" || !sameJson(countSplits(rows), SPLITS)) throw new Error("continuous_preview_dataset_identity_invalid")

  const outputDir = resolve(`${CONTINUOUS_ROOT}/unified-preview-smoke`)
  const finalizationDir = resolve(`${CONTINUOUS_ROOT}/unified-preview-smoke-finalization`)
  const activeConfigPath = resolve(`${CONTINUOUS_ROOT}/unified-preview-contract/active-smoke-config.json`)
  const consumptionPath = resolve(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-continuous-closure-20260809/unified-preview-smoke-gpu-consumption.json")
  if ([outputDir, finalizationDir, activeConfigPath, consumptionPath].some((value) => fs.existsSync(value))) throw new Error("continuous_preview_output_or_consumption_already_exists")
  const implementationAttestationPath = resolve(`${CONTINUOUS_ROOT}/unified-preview-contract/implementation-attestation.json`)
  if (!cpuContractOnly) {
    const attestation = readJsonRequired(implementationAttestationPath)
    if (
      attestation.status !== "stage4_unified_preview_pipeline_implementation_cpu_verified"
      || attestation.authorizationSha256 !== CONTINUOUS_AUTHORIZATION_SHA256
      || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
      || attestation.trainerSha256 !== sha256File(TRAINER)
    ) throw new Error("continuous_preview_implementation_attestation_invalid")
  }
  return {
    mode: "v9-preview",
    authorization,
    authorizationPath: projectPath(authorizationPath),
    authorizationSha256: sha256File(authorizationPath),
    implementationAttestationPath: projectPath(implementationAttestationPath),
    implementationAttestationSha256: cpuContractOnly ? null : sha256File(implementationAttestationPath),
    inactiveConfig,
    inactiveConfigPath,
    sample,
    outputDir,
    finalizationDir,
    activeConfigPath,
    consumptionPath,
    autoencoderPath: previousAuthorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: previousAuthorization.bindings.projectAutoencoderCheckpoint.sha256,
    datasetPath: previousAuthorization.bindings.datasetManifest.path,
  }
}

function validateV9Authorization(authorizationPath, authorization, { cpuContractOnly = false } = {}) {
  if (projectPath(authorizationPath) !== "data/ai-painter/system-governance/owner-authorized-v9-stage4-sample194-30-epoch-gpu-smoke-20260809.json") throw new Error("v9_smoke_authorization_path_invalid")
  if (sha256File(authorizationPath) !== "e77183c6c0f6f94e0db75a5dc94f3c66f376e86c598f8164175a8551b7142e1e") throw new Error("v9_smoke_authorization_sha256_invalid")
  if (authorization.schemaVersion !== "ai-painter-owner-action-request-v1" || authorization.status !== "resolved_owner_authorized") throw new Error("v9_smoke_authorization_schema_or_status_invalid")
  if (authorization.requestId !== V9_REQUEST_ID || authorization.ownerDecision?.commandRef !== V9_REQUEST_ID || authorization.ownerDecision?.scope !== V9_SCOPE) throw new Error("v9_smoke_command_identity_invalid")
  const identity = authorization.taskIdentity ?? {}
  if (identity.architectureId !== "multiscale_condition_unet_v9_stage4_object_semantic_decoded_alignment") throw new Error("v9_smoke_architecture_identity_invalid")
  if (identity.sampleId !== SAMPLE_ID || identity.sampleSplit !== "validation" || identity.conditionLabel !== CONDITION_LABEL || identity.seed !== 20263722) throw new Error("v9_smoke_sample_or_seed_identity_invalid")
  if (!sameJson(identity.requiredBoundarySides, ["west"]) || !sameJson(identity.previewEpochs, PREVIEW_EPOCHS) || identity.epochCount !== 30 || identity.evaluationInterval !== 5) throw new Error("v9_smoke_topology_or_schedule_invalid")
  if (!sameJson(identity.resolution, { width: 256, height: 192 }) || !sameJson(identity.requiredSplitCounts, SPLITS) || identity.datasetSelectionContract !== "registered_v7_capacity_contribution_v1") throw new Error("v9_smoke_resolution_or_dataset_identity_invalid")
  if (identity.diagnosticManifestMetricCount !== 17 || identity.denoiserInitialization !== "fixed_random_v9_seed_20263722" || identity.autoencoderState !== "bound_project_checkpoint_loaded_and_frozen") throw new Error("v9_smoke_model_or_diagnostic_identity_invalid")
  const actions = authorization.authorizedActions ?? {}
  for (const key of [
    "stage4SmokeRunnerV9Extension", "trainerV9SmokeAuthorizationGateExtension",
    "v9SmokeCpuCheckerExtension", "cpuPositiveNegativeAuthorizationRegression",
    "legacyV7V8CompatibilityRegression", "pythonPreflight", "cudaResourcePreflight",
    "diskBudgetPreflight", "projectAutoencoderCheckpointReadAndLoad",
    "v9FixedRandomInitialization", "optimizerCreation", "backwardMethodExecution",
    "boundedModelWeightModification", "singleSampleThirtyEpochTraining",
    "fivePreviewWrite", "exact17DiagnosticManifestWrite", "machineReview",
    "smokeCheckpointWrite", "modelStateHashEvidenceWrite", "terminalEvidenceWrite",
    "uniquePlanUpdate",
  ]) if (actions[key] !== true) throw new Error(`v9_smoke_authorized_action_closed:${key}`)
  for (const key of [
    "oldV7OrV8DenoiserCheckpointReadOrLoad", "hyperparameterSelection",
    "machineReviewThresholdModification", "stage4FullTraining", "stage1OrStage2",
    "strictRevalidation", "formalInference", "checkpointPromotion", "runtimeFrame",
    "worldEntry", "automaticRetry",
  ]) if (actions[key] !== false) throw new Error(`v9_smoke_forbidden_action_open:${key}`)
  if (!sameJson(authorization.failurePolicy, { stopImmediately: true, automaticRetry: false, preserveEvidence: true, laterStageMustNotStart: true })) throw new Error("v9_smoke_failure_policy_invalid")

  const baselineHashes = {
    smokeRunnerBeforeExtension: "cbea5dd82cfc86b777f698919215218b614c344fb6e24c2bfe057a7f2c59521f",
    v9CpuCheckerBeforeExtension: "b1311cfcd20ceb4e38ac9214ce84af34be8952eac61458004b2a00c13f1a9103",
    trainerBeforeExtension: "94c2862a9b91ddf5c2f865943bf64a7269fd7822dd6a7767a90961e164d5f7a8",
  }
  for (const [key, expected] of Object.entries(baselineHashes)) {
    if (authorization.bindings?.[key]?.sha256 !== expected) throw new Error(`v9_smoke_baseline_binding_invalid:${key}`)
  }
  for (const key of [
    "v9GradientDiagnosticTerminal", "v9GradientDiagnosticReport", "v9CudaTelemetry",
    "v9InactiveConfig", "modelFrozen", "datasetManifest", "datasetSourceIndex",
    "projectAutoencoderCheckpoint", "conditionAlignmentAuditor",
    "professionalAestheticAuditor", "windowsSafePreviewNormalizer", "gpuResourceGate",
  ]) {
    const binding = authorization.bindings?.[key]
    if (!binding?.path || !binding?.sha256 || !fileHashMatches(binding.path, binding.sha256)) throw new Error(`v9_smoke_binding_missing_or_changed:${key}`)
  }
  const diagnosticTerminal = readJsonRequired(authorization.bindings.v9GradientDiagnosticTerminal.path)
  const diagnosticReport = readJsonRequired(authorization.bindings.v9GradientDiagnosticReport.path)
  if (diagnosticTerminal.status !== "v9_gradient_diagnostic_passed_closed" || diagnosticReport.status !== "passed_readonly_v9_gpu_forward_and_gradient_routing_weights_unchanged") throw new Error("v9_smoke_gradient_diagnostic_prerequisite_invalid")
  const inactiveConfig = readJsonRequired(authorization.bindings.v9InactiveConfig.path)
  if (inactiveConfig.training?.trainingAuthorizationStatus !== resolveStageControlMode("v9_stage4_inactive").authorizationStatus) throw new Error("v9_smoke_inactive_config_status_invalid")
  if (inactiveConfig.denoiserArchitecture !== identity.architectureId || inactiveConfig.training?.v9Stage4SingleSampleSmokeContract?.sampleSplit !== "validation") throw new Error("v9_smoke_inactive_config_identity_invalid")
  const sourceIndex = readJsonRequired(authorization.bindings.datasetSourceIndex.path)
  const rows = (sourceIndex.samples ?? []).filter(isCapacityRow)
  const sample = rows.find((row) => row.sampleId === SAMPLE_ID)
  if (!sample || rows.filter((row) => row.sampleId === SAMPLE_ID).length !== 1 || sample.split !== "validation") throw new Error("v9_smoke_fixed_sample_not_unique_validation")
  if (!sameJson(countSplits(rows), SPLITS)) throw new Error("v9_smoke_actual_dataset_splits_invalid")

  const attestationPath = resolve(authorization.implementation.implementationAttestationPath)
  const cpuReportPath = resolve(authorization.implementation.cpuReportPath)
  if (!fs.existsSync(attestationPath) || !fs.existsSync(cpuReportPath)) throw new Error("v9_smoke_implementation_attestation_or_cpu_report_missing")
  const attestation = readJsonRequired(attestationPath)
  const cpuReport = readJsonRequired(cpuReportPath)
  if (
    attestation.status !== "v9_stage4_smoke_implementation_cpu_verified"
    || attestation.authorizationSha256 !== sha256File(authorizationPath)
    || attestation.runnerSha256 !== sha256File("scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
    || attestation.trainerSha256 !== sha256File(TRAINER)
    || attestation.cpuCheckerSha256 !== sha256File(V9_CPU_CHECKER)
    || attestation.cpuReportSha256 !== sha256File(cpuReportPath)
    || cpuReport.status !== "passed_v9_stage4_smoke_cpu_authorization_regression"
    || !sameJson(cpuReport.failedPositiveKeys, [])
    || !sameJson(cpuReport.failedNegativeKeys, [])
  ) throw new Error("v9_smoke_implementation_attestation_invalid")
  if (!cpuContractOnly) {
    const cpuTerminal = readJsonRequired(authorization.implementation.cpuTerminalPath)
    if (cpuTerminal.status !== "v9_stage4_smoke_cpu_gate_passed_closed" || cpuTerminal.reportSha256 !== sha256File(cpuReportPath)) throw new Error("v9_smoke_cpu_terminal_invalid")
  }
  const outputDir = resolve(authorization.execution.outputDirectory)
  const finalizationDir = resolve(authorization.execution.finalizationDirectory)
  const activeConfigPath = resolve(authorization.execution.activeConfigPath)
  const consumptionPath = resolve(authorization.execution.gpuConsumptionPath)
  if ([outputDir, finalizationDir, activeConfigPath, consumptionPath].some((value) => fs.existsSync(value))) throw new Error("v9_smoke_output_or_consumption_already_exists")
  return {
    mode: "v9",
    authorization,
    authorizationPath: projectPath(authorizationPath),
    authorizationSha256: sha256File(authorizationPath),
    implementationAttestationPath: projectPath(attestationPath),
    implementationAttestationSha256: sha256File(attestationPath),
    inactiveConfig,
    inactiveConfigPath: authorization.bindings.v9InactiveConfig.path,
    sample,
    outputDir,
    finalizationDir,
    activeConfigPath,
    consumptionPath,
    autoencoderPath: authorization.bindings.projectAutoencoderCheckpoint.path,
    autoencoderSha256: authorization.bindings.projectAutoencoderCheckpoint.sha256,
    datasetPath: authorization.bindings.datasetManifest.path,
  }
}

function runPreflights(context) {
  const hardware = hardwareSnapshot()
  const disk = diskBudgetSnapshot()
  const blockers = []
  blockers.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  if (!disk.passed) blockers.push("disk_budget_insufficient")
  const python = context.mode === "structure-fact-first"
    ? { status: 0, signal: null, stdout: JSON.stringify(context.successfulPreflight), stderr: "", reusedBoundReadOnlyPreflight: true }
    : spawnSync(PYTHON, [
    TRAINER,
    "--config", resolve(context.inactiveConfigPath),
    "--dataset-package", resolve(context.datasetPath),
    "--autoencoder-checkpoint", resolve(context.autoencoderPath),
    "--output-dir", resolve(context.outputDir),
    "--resolution-stage", "0",
    "--single-sample-overfit-smoke",
    "--overfit-sample-id", SAMPLE_ID,
    "--overfit-epochs", "30",
    "--overfit-evaluation-interval", "5",
    "--preflight-only",
  ], { cwd: ROOT, env: pythonEnv(), encoding: "utf8", windowsHide: true, timeout: 120000 })
  if (python.status !== 0) blockers.push("python_preflight_failed")
  return {
    schemaVersion: `ai-painter-r5-stage4-${context.mode}-smoke-preflight-v1`,
    status: blockers.length === 0 ? "passed_gpu_not_started_not_consumed" : "failed_closed_gpu_not_started_not_consumed",
    recordedAtUtc: new Date().toISOString(),
    hardware,
    disk,
    python: { exitCode: python.status, signal: python.signal, stdout: python.stdout, stderr: python.stderr },
    blockers: [...new Set(blockers)],
    gpuStarted: false,
    checkpointRead: false,
    optimizerCreated: false,
    trainingStarted: false,
  }
}

function consumeGpuAuthorization(context, preflight) {
  if (context.mode === "semantic-mixture") {
    const value = {
      schemaVersion: "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-consumption-v1",
      status: "fact_conditioned_semantic_mixture_stage4_smoke_authorization_atomically_consumed",
      requestId: context.requestId,
      commandRef: context.authorization.commandRef,
      scope: context.scope,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
      preflightReportPath: projectPath(context.preflightReportPath),
      preflightReportSha256: sha256File(context.preflightReportPath),
      preflightStatus: preflight.status,
      consumedAtUtc: new Date().toISOString(),
      oneTimeConsumption: true,
      modelSmokeOrdinal: 1,
      maximumModelSmokeExecutions: 1,
      oldDenoiserCheckpointReadOrLoadAuthorized: false,
      diagnosticCheckpointReadOrLoadAuthorized: false,
      stage4FullTrainingStarted: false,
      automaticRetryAuthorized: false,
    }
    writeImmutableJson(context.consumptionPath, value)
    return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
  }
  if (context.mode === "semantic-renderer") {
    const value = {
      schemaVersion: "ai-painter-stage4-condition-preserving-semantic-renderer-smoke-execution-consumption-v1",
      status: "condition_preserving_semantic_renderer_stage4_smoke_authorization_atomically_consumed",
      requestId: context.requestId,
      commandRef: context.authorization.commandRef,
      scope: context.scope,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
      preflightReportPath: projectPath(context.preflightReportPath),
      preflightReportSha256: sha256File(context.preflightReportPath),
      preflightStatus: preflight.status,
      consumedAtUtc: new Date().toISOString(),
      oneTimeConsumption: true,
      modelSmokeOrdinal: 1,
      maximumModelSmokeExecutions: 1,
      stage4FullTrainingStarted: false,
      automaticRetryAuthorized: false,
    }
    writeImmutableJson(context.consumptionPath, value)
    return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
  }
  if (context.mode === "structure-fact-first") {
    const value = {
      schemaVersion: "ai-painter-stage4-structure-fact-first-smoke-execution-consumption-v1",
      status: "structure_fact_first_stage4_smoke_authorization_atomically_consumed",
      requestId: context.requestId,
      commandRef: context.authorization.commandRef,
      scope: context.scope,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      preflightStatus: preflight.status,
      consumedAtUtc: new Date().toISOString(),
      oneTimeConsumption: true,
      modelSmokeOrdinal: 1,
      maximumModelSmokeExecutions: 1,
      stage4FullTrainingStarted: false,
      automaticRetryAuthorized: false,
    }
    writeImmutableJson(context.consumptionPath, value)
    return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
  }
  if (context.mode === "v9-kernel") {
    const value = { schemaVersion: "ai-painter-stage4-validation-kernel-model-smoke-gpu-consumption-v1", status: "stage4_validation_kernel_model_smoke_gpu_authorization_atomically_consumed", requestId: context.requestId, commandRef: context.requestId, scope: context.scope, authorizationPath: context.authorizationPath, authorizationSha256: context.authorizationSha256, phase0TerminalPath: context.phase0TerminalPath, phase0TerminalSha256: context.phase0TerminalSha256, implementationAttestationPath: context.implementationAttestationPath, implementationAttestationSha256: context.implementationAttestationSha256, preflightStatus: preflight.status, consumedAtUtc: new Date().toISOString(), oneTimeConsumption: true, modelSmokeOrdinal: 1, maximumModelSmokeExecutions: 1, stage4FullTrainingStarted: false, automaticRetryAuthorized: false }
    writeImmutableJson(context.consumptionPath, value)
    return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
  }
  if (context.mode === "v9-preview") {
    const value = {
      schemaVersion: "ai-painter-r5-stage4-unified-preview-smoke-gpu-consumption-v1",
      status: "stage4_unified_preview_smoke_gpu_authorization_atomically_consumed",
      requestId: CONTINUOUS_REQUEST_ID,
      commandRef: CONTINUOUS_REQUEST_ID,
      scope: CONTINUOUS_SCOPE,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
      preflightStatus: preflight.status,
      consumedAtUtc: new Date().toISOString(),
      oneTimeConsumption: true,
      gpuSmokeOrdinal: 1,
      maximumGpuSmokeExecutions: 1,
      stage4FullTrainingStarted: false,
    }
    writeImmutableJson(context.consumptionPath, value)
    return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
  }
  if (context.mode === "v9") {
    const value = {
      schemaVersion: "ai-painter-r5-stage4-v9-smoke-gpu-consumption-v1",
      status: "v9_stage4_smoke_gpu_authorization_atomically_consumed",
      requestId: V9_REQUEST_ID,
      commandRef: V9_REQUEST_ID,
      scope: V9_SCOPE,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
      preflightStatus: preflight.status,
      consumedAtUtc: new Date().toISOString(),
      oneTimeConsumption: true,
      oldDenoiserCheckpointReadAuthorized: false,
      stage4FullTrainingAuthorized: false,
      automaticRetryAuthorized: false,
    }
    writeImmutableJson(context.consumptionPath, value)
    return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
  }
  const value = {
    schemaVersion: "ai-painter-r5-stage4-v8-smoke-gpu-consumption-v1",
    status: "gpu_smoke_authorization_atomically_consumed",
    authorizationPath: context.authorization.ownerDecision.sourceOwnerAuthorizationPath,
    authorizationSha256: context.authorization.ownerDecision.sourceOwnerAuthorizationSha256,
    gpuExecutionAuthorizationPath: context.authorizationPath,
    gpuExecutionAuthorizationSha256: context.authorizationSha256,
    preflightStatus: preflight.status,
    consumedAtUtc: new Date().toISOString(),
  }
  writeImmutableJson(context.consumptionPath, value)
  return { ...value, path: projectPath(context.consumptionPath), sha256: sha256File(context.consumptionPath) }
}

function activateConfig(context, consumption) {
  const config = structuredClone(context.inactiveConfig)
  const training = config.training
  const mode = resolveStageControlMode({
    "semantic-mixture": SEMANTIC_MIXTURE_SMOKE_MODE_ID,
    "semantic-renderer": SEMANTIC_RENDERER_SMOKE_MODE_ID,
    "structure-fact-first": STRUCTURE_SMOKE_MODE_ID,
    "v9-kernel": "v9_stage4_validation_kernel_smoke",
    "v9-preview": "v9_stage4_unified_preview_smoke",
    v9: "v9_stage4_smoke",
    v8: "v8_stage4_smoke",
  }[context.mode])
  if (context.mode === "semantic-mixture") {
    config.architectureVersion = "all-validation-multiseed-semantic-rollout-fact-conditioned-semantic-mixture-smoke"
    training.trainingAuthorizationStatus = mode.authorizationStatus
    training.factConditionedSemanticMixtureStage4SingleSampleSmokeContract = {
      status: "active_owner_authorized_single_execution",
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      imagePath: context.sample.imagePath,
      conditionPackPath: context.sample.conditionPackPath,
      seed: 20263722,
      requiredBoundarySides: ["west"],
      epochCount: 30,
      previewEpochs: PREVIEW_EPOCHS,
      resolution: { width: 256, height: 192 },
      oldDenoiserCheckpointCompatible: false,
      oldDenoiserCheckpointReadAuthorized: false,
      diagnosticCheckpointReadAuthorized: false,
      initialization: "project_random_fact_conditioned_semantic_mixture",
    }
    training.ownerTrainingAuthorization = {
      authorizationId: context.requestId,
      requestId: context.requestId,
      commandRef: context.authorization.commandRef,
      scope: context.scope,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      executionConsumptionPath: consumption.path,
      executionConsumptionSha256: consumption.sha256,
      implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
      implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
      implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
      implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
      executionActions: [...context.authorization.executionActions],
      explicitlyDeniedActions: [...context.authorization.explicitlyDeniedActions],
      executionState: "consumed",
      status: mode.authorizationStatus,
      checkpointLoadingAuthorized: true,
      optimizerCreationAuthorized: true,
      backwardExecutionAuthorized: true,
      modelWeightMutationAuthorized: true,
      gpuTrainingAuthorizedNow: true,
      singleSampleGpuOverfitSmokeAuthorized: true,
      fullTrainingAuthorized: false,
      stage1Authorized: false,
      stage2Authorized: false,
      strictRevalidationAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      checkpointPromotionAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
      automaticRetryAuthorized: false,
    }
    const contract = training.stage4FactConditionedSemanticMixture
    contract.enabled = true
    contract.status = "training_loss_active_owner_authorized"
    contract.diagnosticManifestRegistry.fixedEpochs = PREVIEW_EPOCHS
    for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "smoke30EpochNow"]) contract.activationGate[key] = true
    const fullRollout = training.stage4FullRolloutFinalVisibleConsistency
    if (fullRollout?.enabled === true) {
      fullRollout.status = "training_loss_active_owner_authorized"
      for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "smokeNow"]) {
        fullRollout.activationGate[key] = true
      }
    }
    const epochWorstReplay = training.stage4EpochWorstSampleClassReplay
    if (epochWorstReplay?.enabled === true) {
      epochWorstReplay.status = "training_loss_active_owner_authorized"
      for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "smokeNow"]) {
        epochWorstReplay.activationGate[key] = true
      }
    }
    const objectVisibleStructure = training.stage4ObjectVisibleStructureSupervision
    if (objectVisibleStructure?.enabled === true) {
      objectVisibleStructure.status = "training_loss_active_owner_authorized"
      for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "smokeNow"]) {
        objectVisibleStructure.activationGate[key] = true
      }
    }
    const objectReferenceMultiscale = training.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision
    if (objectReferenceMultiscale?.enabled === true) {
      if (
        objectReferenceMultiscale.contractId !== "typed_object_multiscale_luminance_structure_correlation_supervision_v1"
        || objectReferenceMultiscale.noveltyBoundary?.failedSingleScaleContractReuseAllowed !== false
        || training.stage4ObjectVisibleStructureSupervision !== undefined
      ) throw new Error("object_reference_multiscale_smoke_contract_identity_invalid")
      objectReferenceMultiscale.status = "training_loss_active_owner_authorized"
      for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "smokeNow"]) {
        objectReferenceMultiscale.activationGate[key] = true
      }
    }
    const objectReferenceMultiscaleEarlyConvergence = training.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization
    if (objectReferenceMultiscaleEarlyConvergence?.enabled === true) {
      if (
        objectReferenceMultiscaleEarlyConvergence.contractId !== "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
        || objectReferenceMultiscaleEarlyConvergence.replayBudget?.addsReplayPasses !== false
        || objectReferenceMultiscaleEarlyConvergence.replayBudget?.addsOptimizerSteps !== false
      ) throw new Error("object_reference_multiscale_early_convergence_smoke_contract_identity_invalid")
      objectReferenceMultiscaleEarlyConvergence.status = "training_loss_active_owner_authorized"
      for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "smokeNow"]) {
        objectReferenceMultiscaleEarlyConvergence.activationGate[key] = true
      }
    }
    training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_active_smoke"
    training.stage4FailureDiagnostics.trainingConfigApplied = true
    training.stage4FailureDiagnostics.checkpointFileReadAuthorized = true
    training.stage4FailureDiagnostics.gpuUseAuthorized = true
    training.stage4FailureDiagnostics.trainingAuthorized = true
    training.stage4UnifiedTrainingPreviewSamplingContract = {
      schemaVersion: "stage4-unified-training-preview-sampling-contract-v1",
      enabled: true,
      status: "active_owner_authorized_single_execution",
      samplingFunction: "evaluate_deterministic_rollout_rgb_quality_v7",
      modelStateBinding: "sha256_sorted_tensor_bytes_v1",
      seedBinding: "training_seed_plus_3000",
      normalizationBinding: "checkpoint_latent_normalization",
      decodeBinding: "frozen_project_autoencoder_decode_clamp_0_1",
      checkpointPreviewIdentityGate: "byte_exact_best_epoch_reproduction",
      deterministicAlgorithmsRequired: true,
      cublasWorkspaceConfig: ":4096:8",
      failedPreviewPixelsUsedAsTrainingTargets: false,
      machineReviewThresholdsUsedAsTrainingTargets: false,
    }
    training.factConditionedSemanticMixtureStage4SmokeExecution = {
      sourceInactiveConfigPath: context.inactiveConfigPath,
      sourceInactiveConfigSha256: sha256File(context.inactiveConfigPath),
      ownerAuthorizationPath: context.authorizationPath,
      ownerAuthorizationSha256: context.authorizationSha256,
      gpuConsumptionPath: consumption.path,
      gpuConsumptionSha256: consumption.sha256,
      implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
      implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
      implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
      implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
      readonlyGpuTerminalPath: context.authorization.bindings.readonlyGpuTerminal.path,
      readonlyGpuTerminalSha256: context.authorization.bindings.readonlyGpuTerminal.sha256,
      readonlyGpuDiagnosticPath: context.authorization.bindings.readonlyGpuDiagnostic.path,
      readonlyGpuDiagnosticSha256: context.authorization.bindings.readonlyGpuDiagnostic.sha256,
      cudaTelemetryPath: context.authorization.bindings.cudaTelemetry.path,
      cudaTelemetrySha256: context.authorization.bindings.cudaTelemetry.sha256,
      readonlyCpuReportPath: context.authorization.bindings.readonlyCpuReport.path,
      readonlyCpuReportSha256: context.authorization.bindings.readonlyCpuReport.sha256,
    }
    return config
  }
  if (context.mode === "semantic-renderer") {
    config.architectureVersion = "all-validation-multiseed-semantic-rollout-condition-preserving-semantic-renderer-smoke"
    training.trainingAuthorizationStatus = mode.authorizationStatus
    training.conditionPreservingSemanticRendererStage4SingleSampleSmokeContract = {
      status: "active_owner_authorized_single_execution",
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      imagePath: context.sample.imagePath,
      conditionPackPath: context.sample.conditionPackPath,
      seed: 20263722,
      requiredBoundarySides: ["west"],
      epochCount: 30,
      previewEpochs: PREVIEW_EPOCHS,
      resolution: { width: 256, height: 192 },
      oldDenoiserCheckpointCompatible: false,
      oldDenoiserCheckpointReadAuthorized: false,
      initialization: "project_random_condition_preserving_semantic_renderer",
    }
    training.ownerTrainingAuthorization = {
      authorizationId: context.requestId,
      requestId: context.requestId,
      commandRef: context.authorization.commandRef,
      scope: context.scope,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      executionConsumptionPath: consumption.path,
      executionConsumptionSha256: consumption.sha256,
      implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
      implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
      implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
      implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
      executionActions: [...context.authorization.executionActions],
      explicitlyDeniedActions: [...context.authorization.explicitlyDeniedActions],
      executionState: "consumed",
      status: mode.authorizationStatus,
      checkpointLoadingAuthorized: true,
      optimizerCreationAuthorized: true,
      backwardExecutionAuthorized: true,
      modelWeightMutationAuthorized: true,
      gpuTrainingAuthorizedNow: true,
      singleSampleGpuOverfitSmokeAuthorized: true,
      fullTrainingAuthorized: false,
      stage1Authorized: false,
      stage2Authorized: false,
      strictRevalidationAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      checkpointPromotionAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
      automaticRetryAuthorized: false,
    }
    const contract = training.stage4ConditionPreservingSemanticRenderer
    contract.enabled = true
    contract.status = "training_loss_active_owner_authorized"
    for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "smoke30EpochNow"]) contract.activationGate[key] = true
    training.stage4FailureDiagnostics.trainingConfigApplied = true
    training.stage4FailureDiagnostics.checkpointFileReadAuthorized = true
    training.stage4FailureDiagnostics.gpuUseAuthorized = true
    training.stage4FailureDiagnostics.trainingAuthorized = true
    training.stage4UnifiedTrainingPreviewSamplingContract = {
      schemaVersion: "stage4-unified-training-preview-sampling-contract-v1",
      enabled: true,
      status: "active_owner_authorized_single_execution",
      samplingFunction: "evaluate_deterministic_rollout_rgb_quality_v7",
      modelStateBinding: "sha256_sorted_tensor_bytes_v1",
      seedBinding: "training_seed_plus_3000",
      normalizationBinding: "checkpoint_latent_normalization",
      decodeBinding: "frozen_project_autoencoder_decode_clamp_0_1",
      checkpointPreviewIdentityGate: "byte_exact_best_epoch_reproduction",
      deterministicAlgorithmsRequired: true,
      cublasWorkspaceConfig: ":4096:8",
      failedPreviewPixelsUsedAsTrainingTargets: false,
      machineReviewThresholdsUsedAsTrainingTargets: false,
    }
    training.conditionPreservingSemanticRendererStage4SmokeExecution = {
      sourceInactiveConfigPath: context.inactiveConfigPath,
      sourceInactiveConfigSha256: sha256File(context.inactiveConfigPath),
      ownerAuthorizationPath: context.authorizationPath,
      ownerAuthorizationSha256: context.authorizationSha256,
      gpuConsumptionPath: consumption.path,
      gpuConsumptionSha256: consumption.sha256,
      implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
      implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
      implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
      implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
      readonlyGpuTerminalPath: context.authorization.bindings.readonlyGpuTerminal.path,
      readonlyGpuTerminalSha256: context.authorization.bindings.readonlyGpuTerminal.sha256,
      readonlyGpuDiagnosticPath: context.authorization.bindings.readonlyGpuDiagnostic.path,
      readonlyGpuDiagnosticSha256: context.authorization.bindings.readonlyGpuDiagnostic.sha256,
      cudaTelemetryPath: context.authorization.bindings.cudaTelemetry.path,
      cudaTelemetrySha256: context.authorization.bindings.cudaTelemetry.sha256,
      readonlyCpuReportPath: context.authorization.bindings.readonlyCpuReport.path,
      readonlyCpuReportSha256: context.authorization.bindings.readonlyCpuReport.sha256,
    }
    return config
  }
  if (context.mode === "structure-fact-first") {
    config.architectureVersion = "all-validation-multiseed-semantic-rollout-structure-fact-first-dual-stage-smoke"
    training.trainingAuthorizationStatus = mode.authorizationStatus
    training.structureFactFirstStage4SingleSampleSmokeContract = {
      status: "active_owner_authorized_single_execution",
      sampleId: SAMPLE_ID,
      sampleSplit: "validation",
      imagePath: context.sample.imagePath,
      conditionPackPath: context.sample.conditionPackPath,
      seed: 20263722,
      requiredBoundarySides: ["west"],
      epochCount: 30,
      previewEpochs: PREVIEW_EPOCHS,
      resolution: { width: 256, height: 192 },
      oldDenoiserCheckpointCompatible: false,
      oldDenoiserCheckpointReadAuthorized: false,
      initialization: "project_random_structure_fact_first_denoiser",
      phase0DiagnosticCheckpointUsedAsInitialization: false,
    }
    training.ownerTrainingAuthorization = {
      authorizationId: context.requestId,
      requestId: context.requestId,
      commandRef: context.authorization.commandRef,
      scope: context.scope,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      executionConsumptionPath: consumption.path,
      executionConsumptionSha256: consumption.sha256,
      implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
      implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
      implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
      implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
      executionActions: [...context.authorization.executionActions],
      explicitlyDeniedActions: [...context.authorization.explicitlyDeniedActions],
      executionState: "consumed",
      status: mode.authorizationStatus,
      checkpointLoadingAuthorized: true,
      optimizerCreationAuthorized: true,
      backwardExecutionAuthorized: true,
      modelWeightMutationAuthorized: true,
      gpuTrainingAuthorizedNow: true,
      singleSampleGpuOverfitSmokeAuthorized: true,
      fullTrainingAuthorized: false,
      stage1Authorized: false,
      stage2Authorized: false,
      strictRevalidationAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      checkpointPromotionAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
      automaticRetryAuthorized: false,
    }
    const contract = training.stage4StructureFactFirstDualStage
    contract.enabled = true
    contract.status = "training_loss_active_owner_authorized"
    contract.trainingLossImplementationStatus = "implemented_active_owner_authorized"
    contract.previewReproductionIdentity.status = "active_owner_authorized_single_execution"
    contract.previewReproductionIdentity.configurationActiveNow = true
    for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "checkpointWriteNow"]) contract.activationGate[key] = true
    training.stage4UnifiedTrainingPreviewSamplingContract = {
      schemaVersion: "stage4-unified-training-preview-sampling-contract-v1",
      enabled: true,
      status: "active_owner_authorized_single_execution",
      samplingFunction: "evaluate_deterministic_rollout_rgb_quality_v7",
      modelStateBinding: "sha256_sorted_tensor_bytes_v1",
      seedBinding: "training_seed_plus_3000",
      normalizationBinding: "checkpoint_latent_normalization",
      decodeBinding: "frozen_project_autoencoder_decode_clamp_0_1",
      checkpointPreviewIdentityGate: "byte_exact_best_epoch_reproduction",
      deterministicAlgorithmsRequired: true,
      cublasWorkspaceConfig: ":4096:8",
      failedPreviewPixelsUsedAsTrainingTargets: false,
      machineReviewThresholdsUsedAsTrainingTargets: false,
    }
    training.structureFactFirstStage4SmokeExecution = {
      sourceInactiveConfigPath: context.inactiveConfigPath,
      sourceInactiveConfigSha256: sha256File(context.inactiveConfigPath),
      ownerAuthorizationPath: context.authorizationPath,
      ownerAuthorizationSha256: context.authorizationSha256,
      gpuConsumptionPath: consumption.path,
      gpuConsumptionSha256: consumption.sha256,
      implementationAuthorizationPath: context.authorization.bindings.implementationAuthorization.path,
      implementationAuthorizationSha256: context.authorization.bindings.implementationAuthorization.sha256,
      implementationConsumptionPath: context.authorization.bindings.implementationConsumption.path,
      implementationConsumptionSha256: context.authorization.bindings.implementationConsumption.sha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
      phase0TerminalPath: context.phase0TerminalPath,
      phase0TerminalSha256: context.phase0TerminalSha256,
    }
    return config
  }
  if (context.mode === "v9-kernel") {
    config.architectureVersion = "all-validation-multiseed-semantic-rollout-unet-v9-stage4-validation-kernel-smoke"
    training.trainingAuthorizationStatus = mode.authorizationStatus
    training.v9Stage4SingleSampleSmokeContract.status = "active_owner_authorized_single_execution"
    training.ownerTrainingAuthorization = { authorizationId: context.requestId, authorizationPath: context.authorizationPath, authorizationSha256: context.authorizationSha256, executionConsumptionPath: consumption.path, executionConsumptionSha256: consumption.sha256, status: mode.authorizationStatus, checkpointLoadingAuthorized: true, optimizerCreationAuthorized: true, backwardExecutionAuthorized: true, modelWeightMutationAuthorized: true, gpuTrainingAuthorizedNow: true, singleSampleGpuOverfitSmokeAuthorized: true, fullTrainingAuthorized: false, stage1Authorized: false, stage2Authorized: false, strictRevalidationAuthorized: false, validationAuthorized: false, formalInferenceAuthorized: false, checkpointPromotionAuthorized: false, runtimeFrameAuthorized: false, worldEntryAuthorized: false, automaticRetryAuthorized: false }
    const modelContract = training.stage4ObjectSemanticDecoderAlignment
    modelContract.enabled = true
    modelContract.status = "training_loss_active_owner_authorized"
    modelContract.trainingLossImplementationStatus = "implemented_active_owner_authorized"
    for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "checkpointWriteNow"]) modelContract.activationGate[key] = true
    training.stage4UnifiedTrainingPreviewSamplingContract = { schemaVersion: "stage4-unified-training-preview-sampling-contract-v1", enabled: true, status: "active_owner_authorized_single_execution", samplingFunction: "evaluate_deterministic_rollout_rgb_quality_v7", modelStateBinding: "sha256_sorted_tensor_bytes_v1", seedBinding: "training_seed_plus_3000", normalizationBinding: "checkpoint_latent_normalization", decodeBinding: "frozen_project_autoencoder_decode_clamp_0_1", checkpointPreviewIdentityGate: "byte_exact_best_epoch_reproduction", deterministicAlgorithmsRequired: true, cublasWorkspaceConfig: ":4096:8", failedPreviewPixelsUsedAsTrainingTargets: false, machineReviewThresholdsUsedAsTrainingTargets: false }
    training.v9Stage4SmokeExecution = { sourceInactiveConfigPath: context.inactiveConfigPath, sourceInactiveConfigSha256: sha256File(context.inactiveConfigPath), ownerAuthorizationPath: context.authorizationPath, ownerAuthorizationSha256: context.authorizationSha256, gpuConsumptionPath: consumption.path, gpuConsumptionSha256: consumption.sha256, implementationAttestationPath: context.implementationAttestationPath, implementationAttestationSha256: context.implementationAttestationSha256, phase0TerminalPath: context.phase0TerminalPath, phase0TerminalSha256: context.phase0TerminalSha256 }
    return config
  }
  if (context.mode === "v9-preview") {
    config.architectureVersion = "all-validation-multiseed-semantic-rollout-unet-v9-stage4-unified-preview-pipeline-smoke"
    training.trainingAuthorizationStatus = mode.authorizationStatus
    training.v9Stage4SingleSampleSmokeContract.status = "active_owner_authorized_single_execution"
    training.ownerTrainingAuthorization = {
      authorizationId: CONTINUOUS_REQUEST_ID,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      executionConsumptionPath: consumption.path,
      executionConsumptionSha256: consumption.sha256,
      status: mode.authorizationStatus,
      checkpointLoadingAuthorized: true,
      optimizerCreationAuthorized: true,
      backwardExecutionAuthorized: true,
      modelWeightMutationAuthorized: true,
      gpuTrainingAuthorizedNow: true,
      singleSampleGpuOverfitSmokeAuthorized: true,
      fullTrainingAuthorized: false,
      stage1Authorized: false,
      stage2Authorized: false,
      strictRevalidationAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      checkpointPromotionAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
      automaticRetryAuthorized: false,
    }
    const modelContract = training.stage4ObjectSemanticDecoderAlignment
    modelContract.enabled = true
    modelContract.status = "training_loss_active_owner_authorized"
    modelContract.trainingLossImplementationStatus = "implemented_active_owner_authorized"
    for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "checkpointWriteNow"]) modelContract.activationGate[key] = true
    training.stage4UnifiedTrainingPreviewSamplingContract = {
      ...training.stage4UnifiedTrainingPreviewSamplingContract,
      enabled: true,
      status: "active_owner_authorized_single_execution",
    }
    training.v9Stage4SmokeExecution = {
      sourceInactiveConfigPath: context.inactiveConfigPath,
      sourceInactiveConfigSha256: sha256File(context.inactiveConfigPath),
      ownerAuthorizationPath: context.authorizationPath,
      ownerAuthorizationSha256: context.authorizationSha256,
      gpuConsumptionPath: consumption.path,
      gpuConsumptionSha256: consumption.sha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
    }
    return config
  }
  if (context.mode === "v9") {
    config.architectureVersion = "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke"
    training.trainingAuthorizationStatus = mode.authorizationStatus
    training.v9Stage4SingleSampleSmokeContract.status = "active_owner_authorized_single_execution"
    training.ownerTrainingAuthorization = {
      authorizationId: V9_REQUEST_ID,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      executionConsumptionPath: consumption.path,
      executionConsumptionSha256: consumption.sha256,
      status: mode.authorizationStatus,
      checkpointLoadingAuthorized: true,
      optimizerCreationAuthorized: true,
      backwardExecutionAuthorized: true,
      modelWeightMutationAuthorized: true,
      gpuTrainingAuthorizedNow: true,
      singleSampleGpuOverfitSmokeAuthorized: true,
      fullTrainingAuthorized: false,
      stage1Authorized: false,
      stage2Authorized: false,
      strictRevalidationAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      checkpointPromotionAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
      automaticRetryAuthorized: false,
    }
    const contract = training.stage4ObjectSemanticDecoderAlignment
    contract.enabled = true
    contract.status = "training_loss_active_owner_authorized"
    contract.trainingLossImplementationStatus = "implemented_active_owner_authorized"
    for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "checkpointWriteNow"]) contract.activationGate[key] = true
    training.v9Stage4SmokeExecution = {
      sourceInactiveConfigPath: context.authorization.bindings.v9InactiveConfig.path,
      sourceInactiveConfigSha256: context.authorization.bindings.v9InactiveConfig.sha256,
      ownerAuthorizationPath: context.authorizationPath,
      ownerAuthorizationSha256: context.authorizationSha256,
      gpuConsumptionPath: consumption.path,
      gpuConsumptionSha256: consumption.sha256,
      implementationAttestationPath: context.implementationAttestationPath,
      implementationAttestationSha256: context.implementationAttestationSha256,
    }
    return config
  }
  training.trainingAuthorizationStatus = mode.authorizationStatus
  training.v8Stage4SingleSampleSmokeContract.status = "active_owner_authorized_single_execution"
  training.ownerTrainingAuthorization = {
    authorizationId: "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808",
    authorizationPath: context.authorization.ownerDecision.sourceOwnerAuthorizationPath,
    authorizationSha256: context.authorization.ownerDecision.sourceOwnerAuthorizationSha256,
    executionConsumptionPath: consumption.path,
    executionConsumptionSha256: consumption.sha256,
    status: mode.authorizationStatus,
    checkpointLoadingAuthorized: true,
    optimizerCreationAuthorized: true,
    modelWeightMutationAuthorized: true,
    gpuTrainingAuthorizedNow: true,
    singleSampleGpuOverfitSmokeAuthorized: true,
    fullTrainingAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    checkpointPromotionAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    automaticRetryAuthorized: false,
  }
  const contract = training.stage4DecodedDomainAlignment
  contract.enabled = true
  contract.status = "training_loss_active_owner_authorized"
  contract.trainingLossImplementationStatus = "implemented_active_owner_authorized"
  for (const key of ["configurationActiveNow", "autoencoderCheckpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "checkpointWriteNow"]) contract.activationGate[key] = true
  return config
}

function runTrainer(context) {
  return new Promise((complete) => {
    const args = [
      TRAINER,
      "--config", context.activeConfigPath,
      "--dataset-package", resolve(context.datasetPath),
      "--autoencoder-checkpoint", resolve(context.autoencoderPath),
      "--output-dir", context.outputDir,
      "--resolution-stage", "0",
      "--single-sample-overfit-smoke",
      "--overfit-sample-id", SAMPLE_ID,
      "--overfit-epochs", "30",
      "--overfit-evaluation-interval", "5",
    ]
    const child = spawn(PYTHON, args, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); process.stdout.write(chunk) })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); process.stderr.write(chunk) })
    const timer = setInterval(() => {
      const progress = readJson(path.join(context.outputDir, "progress.json"))
      const gpu = hardwareSnapshot().gpu
      console.log(JSON.stringify({ kind: `${context.mode}_stage4_smoke_heartbeat`, epoch: progress?.currentEpoch ?? progress?.liveProgress?.epoch ?? null, gpuMemoryUsedMiB: gpu.memoryUsedMiB, gpuUtilizationPercent: gpu.utilizationPercent, recordedAtUtc: new Date().toISOString() }))
    }, 20000)
    child.on("error", (error) => { stderr += error.stack || error.message })
    child.on("close", (exitCode, signal) => { clearInterval(timer); complete({ exitCode, signal, stdout, stderr }) })
  })
}

function validateManifest(context, manifest) {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  const v9Like = context.mode === "v9" || context.mode === "v9-preview" || context.mode === "v9-kernel"
  const structureLike = context.mode === "structure-fact-first"
  const semanticRendererLike = context.mode === "semantic-renderer"
  const semanticMixtureLike = context.mode === "semantic-mixture"
  check(manifest.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "manifest_status_invalid")
  check(manifest.architectureVersion === (semanticMixtureLike
    ? "all-validation-multiseed-semantic-rollout-fact-conditioned-semantic-mixture-smoke"
    : semanticRendererLike
    ? "all-validation-multiseed-semantic-rollout-condition-preserving-semantic-renderer-smoke"
    : structureLike
    ? "all-validation-multiseed-semantic-rollout-structure-fact-first-dual-stage-smoke"
    : context.mode === "v9-kernel"
    ? "all-validation-multiseed-semantic-rollout-unet-v9-stage4-validation-kernel-smoke"
    : context.mode === "v9-preview"
    ? "all-validation-multiseed-semantic-rollout-unet-v9-stage4-unified-preview-pipeline-smoke"
    : context.mode === "v9"
      ? "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke"
    : "all-validation-multiseed-semantic-rollout-unet-v8-stage4-decoded-alignment-smoke"), "manifest_architecture_invalid")
  check(manifest.denoiserLossVersion === (semanticMixtureLike
    ? context.inactiveConfig?.training?.denoiserLossVersion
    : semanticRendererLike
    ? "velocity_decoded_rgb_condition_preserving_learned_semantic_renderer_stage4"
    : structureLike
    ? "velocity_structure_fact_layout_condition_preserving_rgb_v1"
    : v9Like
    ? "velocity_decoded_rgb_independent_object_semantic_topology_alignment_v9_stage4"
    : "velocity_decoded_rgb_shared_semantic_topology_alignment_v8_stage4"), "manifest_loss_version_invalid")
  check(manifest.actualLoadedConditionalSampleCount === 64 && manifest.actualLoadedV7CapacityCount === 64, "manifest_capacity_invalid")
  check(sameJson(manifest.actualLoadedSplitCounts, SPLITS), "manifest_split_invalid")
  check(manifest.singleSampleOverfitSmoke?.sampleId === SAMPLE_ID && manifest.singleSampleOverfitSmoke?.selectedSplit === "validation", "manifest_sample_invalid")
  check(manifest.parentDenoiserCheckpointPath === null && manifest.parentDenoiserCheckpointSha256 === null, "manifest_old_denoiser_lineage_opened")
  check(manifest.metrics?.at(-1)?.epoch === 30, "manifest_epoch_invalid")
  check(manifest.modelStateHashEvidence?.weightsChanged === true, "manifest_weights_not_changed")
  check(manifest.formalInferenceEligible === false && manifest.denoiserTrained === false, "manifest_formal_boundary_invalid")
  check(fileHashMatches(manifest.checkpointPath, manifest.checkpointSha256), "smoke_checkpoint_missing_or_changed")
  check(manifest.autoencoderCheckpointSha256 === context.autoencoderSha256, "manifest_autoencoder_identity_invalid")
  if (context.mode === "v9-preview" || context.mode === "v9-kernel" || structureLike || semanticRendererLike || semanticMixtureLike) {
    const preview = manifest.stage4UnifiedTrainingPreviewSampling
    check(preview?.status === "checkpoint_bound_preview_reproduced_exactly", "unified_preview_status_invalid")
    check(preview?.denoiserStateIdentityMatches === true, "unified_preview_state_identity_invalid")
    check(preview?.previewSha256Matches === true, "unified_preview_sha_identity_invalid")
    check(preview?.machineReviewThresholdsChanged === false, "unified_preview_threshold_policy_invalid")
    if (context.mode === "v9-kernel" || structureLike || semanticRendererLike || semanticMixtureLike) {
      const fixedRows = PREVIEW_EPOCHS.map((epoch) => manifest.metrics?.find((row) => row.epoch === epoch))
      check(fixedRows.every((row) => row?.validationPreviewReproductionArtifact?.status === "fixed_epoch_preview_reproduced_exactly"), "fixed_epoch_preview_reproduction_missing")
      check(fixedRows.every((row) => ["modelStateSha256Matches", "conditionTensorSha256Matches", "rgbTensorSha256Matches", "pngByteSha256Matches"].every((key) => row.validationPreviewReproductionArtifact?.[key] === true)), "fixed_epoch_preview_reproduction_identity_mismatch")
    }
  }
  return issues
}

function collectDiagnosticEvidence(context, manifest) {
  const rows = PREVIEW_EPOCHS.map((epoch) => manifest.metrics.find((row) => row.epoch === epoch)).filter(Boolean)
  if (manifest.architectureVersion === "all-validation-multiseed-semantic-rollout-fact-conditioned-semantic-mixture-smoke") {
    const metricNames = context.semanticMixtureDiagnosticMetrics
    if (!Array.isArray(metricNames) || ![27, 28, 29, 32, 48].includes(metricNames.length)) throw new Error("semantic_mixture_diagnostic_registry_context_missing")
    const epochs = rows.map((row) => ({
      epoch: row.epoch,
      metrics: Object.fromEntries(metricNames.map((name) => [name, row[name]])),
    }))
    const allPresent = epochs.every((row) => metricNames.every((name) => Number.isFinite(row.metrics[name])))
    return { schemaVersion: "stage4-fact-conditioned-semantic-mixture-smoke-diagnostic-evidence-v1", metricNames, metricCount: allPresent ? metricNames.length : 0, epochs, allMetricsPresent: allPresent }
  }
  if (manifest.architectureVersion === "all-validation-multiseed-semantic-rollout-condition-preserving-semantic-renderer-smoke") {
    const epochs = rows.map((row) => ({
      epoch: row.epoch,
      metrics: Object.fromEntries(SEMANTIC_RENDERER_DIAGNOSTIC_METRICS.map((name) => [name, row[name]])),
    }))
    const allPresent = epochs.every((row) => SEMANTIC_RENDERER_DIAGNOSTIC_METRICS.every((name) => Number.isFinite(row.metrics[name])))
    return { schemaVersion: "stage4-condition-preserving-semantic-renderer-smoke-diagnostic-evidence-v1", metricNames: SEMANTIC_RENDERER_DIAGNOSTIC_METRICS, metricCount: allPresent ? 7 : 0, epochs, allMetricsPresent: allPresent }
  }
  if (["all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke", "all-validation-multiseed-semantic-rollout-unet-v9-stage4-unified-preview-pipeline-smoke", "all-validation-multiseed-semantic-rollout-unet-v9-stage4-validation-kernel-smoke", "all-validation-multiseed-semantic-rollout-structure-fact-first-dual-stage-smoke"].includes(manifest.architectureVersion)) {
    const epochs = rows.map((row) => ({
      epoch: row.epoch,
      metrics: Object.fromEntries(DIAGNOSTIC_METRICS.map((name) => [name, row[name]])),
      independentObjectReadoutBce: row.trainStage4V9IndependentObjectSemanticReadoutBce,
      routeTopologyReadoutBce: row.trainStage4V9PreservedRouteTopologyReadoutBce,
    }))
    const allPresent = epochs.every((row) => DIAGNOSTIC_METRICS.every((name) => Number.isFinite(row.metrics[name])))
    return { schemaVersion: "v9-stage4-smoke-diagnostic-evidence-v1", metricNames: DIAGNOSTIC_METRICS, metricCount: allPresent ? 17 : 0, epochs, allMetricsPresent: allPresent }
  }
  const epochs = rows.map((row) => ({
    epoch: row.epoch,
    metrics: Object.fromEntries(DIAGNOSTIC_METRICS.map((name) => [name, row[`train${upperCamel(name)}`]])),
    sharedReadoutBce: row.trainStage4DecodedAlignmentSharedReadoutBce,
  }))
  const allPresent = epochs.every((row) => DIAGNOSTIC_METRICS.every((name) => Number.isFinite(row.metrics[name])) && Number.isFinite(row.sharedReadoutBce))
  return { schemaVersion: "v8-stage4-smoke-diagnostic-evidence-v1", metricNames: DIAGNOSTIC_METRICS, metricCount: allPresent ? 17 : 0, epochs, allMetricsPresent: allPresent }
}

async function reviewPreviews(context) {
  const previewRoot = path.join(context.outputDir, "fixed-epoch-previews")
  const files = fs.existsSync(previewRoot) ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort() : []
  const epochs = files.map((file) => Number(file.match(/^epoch-(\d+)/)?.[1] ?? 0))
  if (!sameJson(epochs, PREVIEW_EPOCHS)) throw new Error("fixed_preview_identity_invalid")
  const conditionPack = readJsonRequired(context.sample.conditionPackPath)
  const reviews = []
  for (const file of files) {
    const epoch = Number(file.match(/^epoch-(\d+)/)?.[1] ?? 0)
    if (!file.includes(CONDITION_LABEL)) throw new Error("preview_condition_identity_invalid")
    const previewPath = path.join(previewRoot, file)
    const normalizedPath = path.join(context.outputDir, "fixed-preview-review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath: previewPath, finalAssetPath: normalizedPath, workRoot: resolve(`.runtime/ai-painter/${context.mode}-r5-stage4-smoke-review-work`), workId: sha256Text(projectPath(context.outputDir)).slice(0, 16), epoch })
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({ record: { recordId: `${context.mode}-smoke-${epoch}`, conditionBinding: { conditionPackPath: context.sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: context.sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: context.sample.imagePath }),
    ])
    reviews.push({ epoch, previewPath: projectPath(previewPath), previewSha256: normalized.sourceSha256, normalizedPath: projectPath(normalizedPath), normalizedSha256: normalized.normalizedSha256, windowsSafeShortPathIo: true, passed: aesthetic.passed && alignment.passed, issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code), professionalAesthetic: aesthetic, conditionAlignment: alignment })
  }
  const report = { schemaVersion: `${context.mode}-stage4-smoke-fixed-preview-reviews-v1`, status: reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed_closed", createdAtUtc: new Date().toISOString(), createdAtAsiaShanghai: formatShanghai(new Date().toISOString()), requiredPreviewEpochs: PREVIEW_EPOCHS, reviewThresholdsChanged: false, formalCandidate: false, reviews, previewCount: reviews.length, previewPassCount: reviews.filter((row) => row.passed).length, previewFailCount: reviews.filter((row) => !row.passed).length }
  const reviewPath = path.join(context.outputDir, "fixed-preview-reviews.json")
  writeImmutableJson(reviewPath, report)
  return { ...report, reviewPath: projectPath(reviewPath), reviewSha256: sha256File(reviewPath) }
}

function closeFinal(context, status, blockers, details) {
  if (fs.existsSync(context.finalizationDir)) throw new Error("v8_smoke_finalization_already_exists")
  fs.mkdirSync(context.finalizationDir, { recursive: true })
  const reportPath = path.join(context.finalizationDir, "finalization-report.json")
  const terminalPath = path.join(context.finalizationDir, "phase-terminal.json")
  const report = { schemaVersion: `${context.mode}-stage4-single-sample-smoke-finalization-v1`, status, recordedAtUtc: new Date().toISOString(), recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()), blockers, outputDirectory: projectPath(context.outputDir), manifestPath: projectPath(path.join(context.outputDir, "manifest.json")), manifestSha256: sha256File(path.join(context.outputDir, "manifest.json")), checkpointPath: details.manifest.checkpointPath, checkpointSha256: details.manifest.checkpointSha256, modelStateHashEvidence: details.manifest.modelStateHashEvidence, diagnostics: details.diagnostics, machineReview: details.review, preflight: details.preflight, executionConsumption: details.consumption, automaticRetryStarted: false, stage4FullTrainingStarted: false, strictRevalidationStarted: false }
  writeImmutableJson(reportPath, report)
  const terminal = { schemaVersion: `${context.mode}-stage4-single-sample-smoke-terminal-v1`, status, recordedAtUtc: new Date().toISOString(), recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, blockers, finalizationPath: projectPath(reportPath), finalizationSha256: sha256File(reportPath), nextAction: status === `${context.mode}_stage4_single_sample_30_epoch_gpu_smoke_passed_closed` ? "separately_authorize_stage4_stage0_stage1_stage2_full_training" : null, automaticRetryStarted: false, stage4FullTrainingStarted: false, strictRevalidationStarted: false }
  writeImmutableJson(terminalPath, terminal)
  console.log(JSON.stringify({ ...terminal, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
}

function closeFailure(context, status, blockers, details) {
  if (fs.existsSync(context.finalizationDir)) throw new Error("v8_smoke_finalization_already_exists")
  fs.mkdirSync(context.finalizationDir, { recursive: true })
  const reportPath = path.join(context.finalizationDir, "finalization-report.json")
  const terminalPath = path.join(context.finalizationDir, "phase-terminal.json")
  writeImmutableJson(reportPath, { schemaVersion: `${context.mode}-stage4-single-sample-smoke-finalization-v1`, status, recordedAtUtc: new Date().toISOString(), blockers, details, automaticRetryStarted: false })
  writeImmutableJson(terminalPath, { schemaVersion: `${context.mode}-stage4-single-sample-smoke-terminal-v1`, status, recordedAtUtc: new Date().toISOString(), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, blockers, finalizationPath: projectPath(reportPath), finalizationSha256: sha256File(reportPath), automaticRetryStarted: false, stage4FullTrainingStarted: false, strictRevalidationStarted: false })
  console.error(JSON.stringify({ status, blockers, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
}

function hardwareSnapshot() {
  const gpu = spawnSync("nvidia-smi", ["--query-gpu=index,name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const processes = spawnSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const rows = processes.status === 0 ? processes.stdout.split(/\r?\n/).filter(Boolean) : []
  const values = gpu.status === 0 ? gpu.stdout.trim().split(",").map((value) => value.trim()) : []
  return { recordedAtUtc: new Date().toISOString(), cpu: { model: os.cpus()[0]?.model ?? null, logicalProcessors: os.cpus().length }, memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() }, gpu: { available: gpu.status === 0, deviceIndex: Number(values[0] ?? -1), name: values[1] ?? null, driverVersion: values[2] ?? null, memoryTotalMiB: Number(values[3] ?? 0), memoryUsedMiB: Number(values[4] ?? 0), utilizationPercent: Number(values[5] ?? 0), temperatureC: Number(values[6] ?? 0), pythonComputeProcessCount: rows.filter((row) => /python/i.test(row)).length, computeProcesses: rows } }
}

function diskBudgetSnapshot() { const requiredFreeBytes = 4 * 1024 ** 3; const stat = fs.statfsSync(ROOT); const freeBytes = Number(stat.bavail) * Number(stat.bsize); return { requiredFreeBytes, freeBytes, passed: freeBytes >= requiredFreeBytes } }
function isCapacityRow(row) { return row?.categoryId === "complete-maps" && row?.trainingRoles?.includes("conditional_denoiser") && row?.formalConditionalTrainingEligible === true && row?.conditionBound === true && row?.v7CapacityContributionRegistered === true && row?.ownerReviewStatus === "owner_approved" && row?.machineReviewStatus === "passed" && row?.aiAssistedColdStartEligible === true && row?.independentTrainingEligible === false }
function countSplits(rows) { return Object.fromEntries(Object.keys(SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])) }
function argument(argv, name) { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : null }
function upperCamel(value) { return value ? value[0].toUpperCase() + value.slice(1) : value }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function readJson(value) { try { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) } catch { return null } }
function readJsonRequired(value) { const result = readJson(value); if (!result) throw new Error(`json_missing_or_invalid:${projectPath(value)}`); return result }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function sha256Text(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return Boolean(value && expected && fs.existsSync(absolute) && sha256File(absolute) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function sameExactObject(left, right) { return Boolean(left && right && sameJson(Object.fromEntries(Object.entries(left).sort(([a], [b]) => a.localeCompare(b))), Object.fromEntries(Object.entries(right).sort(([a], [b]) => a.localeCompare(b))))) }
function assertProjectBoundPath(value, label) { if (typeof value !== "string" || value.length === 0) throw new Error(`${label}_path_missing`); const absolute = resolve(value); const relative = path.relative(ROOT, absolute); if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`${label}_path_outside_project`); return relative.replaceAll("\\", "/") }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${resolve("ml/ai-painter/src")};${resolve("ml/ai-painter/scripts")}` } }
function resolveStageControlMode(modeId) {
  if (!modeId) throw new Error("stage_control_mode_id_missing")
  const result = spawnSync(PYTHON, [resolve(STAGE_CONTROL_POLICY), "--mode-id", modeId], {
    cwd: ROOT,
    env: pythonEnv(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
  })
  if (result.status !== 0) throw new Error(`stage_control_policy_failed:${modeId}:${result.stderr || result.stdout}`)
  const decision = JSON.parse(result.stdout)
  if (decision.modeId !== modeId || !decision.authorizationStatus || !String(decision.adapterBinding).endsWith("_adapter")) throw new Error(`stage_control_mode_resolution_invalid:${modeId}`)
  return decision
}
function writeImmutableJson(value, body) { const absolute = resolve(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); const handle = fs.openSync(absolute, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function writeImmutableText(value, body) { const absolute = resolve(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); const handle = fs.openSync(absolute, "wx"); try { fs.writeFileSync(handle, body, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }

if (
  process.argv.includes("--finalize-existing-semantic-mixture-smoke")
  || process.argv.includes("--stage4-condition-preserving-semantic-renderer-readonly-diagnostic")
  || process.argv.includes("--stage4-condition-preserving-semantic-renderer-model-smoke")
  || process.argv.includes("--stage4-fact-conditioned-semantic-mixture-model-smoke")
  || process.argv.includes("--stage4-structure-fact-first-phase0-c-only-continuation")
  || process.argv.includes("--stage4-structure-fact-first-phase0-bc-continuation")
  || process.argv.includes("--stage4-structure-fact-first-phase0")
  || process.argv.includes("--stage4-validation-kernel-phase0")
  || process.argv.includes("--stage4-validation-kernel-model-smoke")
  || process.argv.includes("--stage4-structure-fact-first-model-smoke")
) {
  process.exit(await runV8Stage4Smoke(process.argv.slice(2)))
}
