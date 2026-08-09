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

export async function runV8Stage4Smoke(argv = process.argv.slice(2)) {
  const authorizationPath = argument(argv, "--gpu-authorization")
  const preflightOnly = argv.includes("--preflight-only")
  const cpuContractOnly = argv.includes("--cpu-contract-only")
  const v9Mode = argv.includes("--v9-object-alignment")
  if (!authorizationPath) throw new Error("v8_smoke_gpu_authorization_argument_required")
  const authorization = readJsonRequired(authorizationPath)
  const context = validateAuthorization(authorizationPath, authorization, { v9Mode, cpuContractOnly })
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

function validateAuthorization(authorizationPath, authorization, options = {}) {
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
  if (inactiveConfig.training?.trainingAuthorizationStatus !== "v8_stage4_shared_readout_training_loss_supported_inactive") throw new Error("v8_smoke_inactive_config_status_invalid")
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
  if (inactiveConfig.training?.trainingAuthorizationStatus !== "v9_stage4_object_semantic_decoder_alignment_cpu_supported_inactive") throw new Error("v9_smoke_inactive_config_status_invalid")
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
  if (context.mode === "v9") {
    config.architectureVersion = "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke"
    training.trainingAuthorizationStatus = "owner_authorized_v9_stage4_single_sample_gpu_smoke"
    training.v9Stage4SingleSampleSmokeContract.status = "active_owner_authorized_single_execution"
    training.ownerTrainingAuthorization = {
      authorizationId: V9_REQUEST_ID,
      authorizationPath: context.authorizationPath,
      authorizationSha256: context.authorizationSha256,
      executionConsumptionPath: consumption.path,
      executionConsumptionSha256: consumption.sha256,
      status: "owner_authorized_v9_stage4_single_sample_gpu_smoke",
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
  training.trainingAuthorizationStatus = "owner_authorized_v8_stage4_single_sample_gpu_smoke"
  training.v8Stage4SingleSampleSmokeContract.status = "active_owner_authorized_single_execution"
  training.ownerTrainingAuthorization = {
    authorizationId: "owner-authorized-v8-stage4-training-loss-and-30-epoch-smoke-20260808",
    authorizationPath: context.authorization.ownerDecision.sourceOwnerAuthorizationPath,
    authorizationSha256: context.authorization.ownerDecision.sourceOwnerAuthorizationSha256,
    executionConsumptionPath: consumption.path,
    executionConsumptionSha256: consumption.sha256,
    status: "owner_authorized_v8_stage4_single_sample_gpu_smoke",
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
  check(manifest.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "manifest_status_invalid")
  check(manifest.architectureVersion === (context.mode === "v9"
    ? "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke"
    : "all-validation-multiseed-semantic-rollout-unet-v8-stage4-decoded-alignment-smoke"), "manifest_architecture_invalid")
  check(manifest.denoiserLossVersion === (context.mode === "v9"
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
  return issues
}

function collectDiagnosticEvidence(manifest) {
  const rows = PREVIEW_EPOCHS.map((epoch) => manifest.metrics.find((row) => row.epoch === epoch)).filter(Boolean)
  if (manifest.architectureVersion === "all-validation-multiseed-semantic-rollout-unet-v9-stage4-object-semantic-decoded-alignment-smoke") {
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
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: `${resolve("ml/ai-painter/src")};${resolve("ml/ai-painter/scripts")}` } }
function writeImmutableJson(value, body) { const absolute = resolve(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); const handle = fs.openSync(absolute, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
