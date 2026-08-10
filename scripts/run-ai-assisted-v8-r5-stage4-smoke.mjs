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
  if (!authorizationPath) throw new Error("v8_smoke_gpu_authorization_argument_required")
  const authorization = readJsonRequired(authorizationPath)
  const context = validateAuthorization(authorizationPath, authorization, { v9Mode, continuousPreviewMode, validationKernelSmokeMode, cpuContractOnly, authorizationSha256 })
  if (cpuContractOnly) {
    console.log(JSON.stringify({ status: `${context.mode}_stage4_smoke_authorization_contract_valid_cpu_only`, gpuStarted: false }, null, 2))
    return 0
  }
  const preflight = runPreflights(context)
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
    const diagnostics = collectDiagnosticEvidence(manifest)
    const review = await reviewPreviews(context)
    const blockers = []
    if (diagnostics.metricCount !== 17 || diagnostics.epochs.length !== 5) blockers.push("diagnostic_metric_evidence_incomplete")
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
  const python = spawnSync(PYTHON, [
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
    "v9-kernel": "v9_stage4_validation_kernel_smoke",
    "v9-preview": "v9_stage4_unified_preview_smoke",
    v9: "v9_stage4_smoke",
    v8: "v8_stage4_smoke",
  }[context.mode])
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
  check(manifest.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "manifest_status_invalid")
  check(manifest.architectureVersion === (context.mode === "v9-kernel"
    ? "all-validation-multiseed-semantic-rollout-unet-v9-stage4-validation-kernel-smoke"
    : context.mode === "v9-preview"
    ? "all-validation-multiseed-semantic-rollout-unet-v9-stage4-unified-preview-pipeline-smoke"
    : context.mode === "v9"
      ? "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke"
    : "all-validation-multiseed-semantic-rollout-unet-v8-stage4-decoded-alignment-smoke"), "manifest_architecture_invalid")
  check(manifest.denoiserLossVersion === (v9Like
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
  if (context.mode === "v9-preview" || context.mode === "v9-kernel") {
    const preview = manifest.stage4UnifiedTrainingPreviewSampling
    check(preview?.status === "checkpoint_bound_preview_reproduced_exactly", "unified_preview_status_invalid")
    check(preview?.denoiserStateIdentityMatches === true, "unified_preview_state_identity_invalid")
    check(preview?.previewSha256Matches === true, "unified_preview_sha_identity_invalid")
    check(preview?.machineReviewThresholdsChanged === false, "unified_preview_threshold_policy_invalid")
    if (context.mode === "v9-kernel") {
      const fixedRows = PREVIEW_EPOCHS.map((epoch) => manifest.metrics?.find((row) => row.epoch === epoch))
      check(fixedRows.every((row) => row?.validationPreviewReproductionArtifact?.status === "fixed_epoch_preview_reproduced_exactly"), "fixed_epoch_preview_reproduction_missing")
      check(fixedRows.every((row) => ["modelStateSha256Matches", "conditionTensorSha256Matches", "rgbTensorSha256Matches", "pngByteSha256Matches"].every((key) => row.validationPreviewReproductionArtifact?.[key] === true)), "fixed_epoch_preview_reproduction_identity_mismatch")
    }
  }
  return issues
}

function collectDiagnosticEvidence(manifest) {
  const rows = PREVIEW_EPOCHS.map((epoch) => manifest.metrics.find((row) => row.epoch === epoch)).filter(Boolean)
  if (["all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke", "all-validation-multiseed-semantic-rollout-unet-v9-stage4-unified-preview-pipeline-smoke", "all-validation-multiseed-semantic-rollout-unet-v9-stage4-validation-kernel-smoke"].includes(manifest.architectureVersion)) {
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
    const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath: previewPath, finalAssetPath: normalizedPath, workRoot: resolve(`.runtime/ai-painter/${context.mode}-r5-stage4-smoke-review-work`), workId: sha256Text(path.basename(context.outputDir)).slice(0, 16), epoch })
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

if (process.argv.includes("--stage4-validation-kernel-phase0") || process.argv.includes("--stage4-validation-kernel-model-smoke")) {
  process.exit(await runV8Stage4Smoke(process.argv.slice(2)))
}
