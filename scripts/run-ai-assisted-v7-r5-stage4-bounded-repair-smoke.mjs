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
const TRAINER_SHA256 = "f9a6b6d6a7c7a4b5e5f98178ad5b2ec1696a33354fbf294b56d5ff1e90ee7ccc"
const RUNNER_PATH = "scripts/run-ai-assisted-v7-r5-stage4-bounded-repair-smoke.mjs"
const CPU_CHECKER_PATH = "ml/ai-painter/scripts/check_ai_assisted_v7_r5_stage4_bounded_repair_smoke_authorization_cpu.py"
const REQUEST_ID = "owner-action-request-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "1c497e6802da24bd6e16e3b981b7ff5438639047d04f3d9afa677bb33937efed"
const IMPLEMENTATION_CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/implementation-authorization-consumption.json`
const IMPLEMENTATION_CONSUMPTION_SHA256 = "7ed86af0f3fb94ef3585c83cb5511fbd72273da94fbb69bb594ab6f683f5ab7f"
const EXECUTION_CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/gpu-execution-authorization-consumption.json`
const COMMAND_REF = "owner-authorized-v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-new-execution-20260806"
const SCOPE = "fix_only_two_diagnostic_success_status_bindings_sync_related_hashes_then_one_cpu_gate_preflights_and_one_30_epoch_bounded_gpu_smoke"
const PREVIOUS_FAILURE_TERMINAL_PATH = ".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations/ai-assisted-v7-r5-stage4-bounded-repair-smoke-2026-08-05T15-36-34-038Z-finalization/phase-terminal.json"
const PREVIOUS_FAILURE_TERMINAL_SHA256 = "c9804cd03a5ca706a0230a695a440c57adfe0d6d125e3a3495db1e109eb3cbc7"
const INACTIVE_CONFIG_PATH = ".runtime/ai-painter/v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-runs/ai-assisted-v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-2026-08-05T14-10-00-000Z/inactive-config.json"
const INACTIVE_CONFIG_SHA256 = "6bcc1a6f49b4e9fd5a7ac1eca5f25783445894097b22cf349e15b365cad07332"
const SELECTION_PATH = ".runtime/ai-painter/v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-runs/ai-assisted-v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-2026-08-05T14-10-00-000Z/selection-contract.json"
const SELECTION_SHA256 = "6b4b6c9e23836b2d483625594b254f725c1e0ebc799c54f20507210a9db8e228"
const SUPPORT_CONTRACT_PATH = "data/ai-painter/system-governance/v7-r5-stage4-diagnostic-evidence-bounded-repair-trainer-support-contract.json"
const SUPPORT_CONTRACT_SHA256 = "8b0bbd53283af7faff236797d51d418170e520da63522c2e91d07331432ac1b4"
const BOUNDED_CPU_REPORT_PATH = ".runtime/ai-painter/v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-runs/ai-assisted-v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-2026-08-05T14-10-00-000Z/cpu-positive-negative-regression.json"
const BOUNDED_CPU_REPORT_SHA256 = "975332317a237b7da5ad96c131d6420c5a9d8033790fcb113976e96544a7e05c"
const BOUNDED_TERMINAL_PATH = ".runtime/ai-painter/v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-runs/ai-assisted-v7-r5-stage4-diagnostic-evidence-bounded-repair-cpu-2026-08-05T14-10-00-000Z/phase-terminal.json"
const BOUNDED_TERMINAL_SHA256 = "7d602540466eb08a44985357508bd9f9fbcb981935dd031a3d1a2acafd3c6643"
const CPU_REPORT_PATH = ".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-diagnostic-status-binding-fix-authorization-cpu-regressions/20260806-001500000/report.json"
const DATASET_MANIFEST_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const DATASET_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const SOURCE_INDEX_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
const SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
const DIAGNOSTIC_REPORT_PATH = ".runtime/ai-painter/v7-r5-stage4-readonly-diagnostic-object-metric-prefix-final-gpu-smokes/ai-assisted-v7-r5-stage4-readonly-diagnostic-object-metric-prefix-final-gpu-smoke-2026-08-05T13-27-00-000Z/diagnostic-report.json"
const DIAGNOSTIC_REPORT_SHA256 = "67a288142eca980200a60ab998359323dda3aa5dc4b5f5381b92eccecc56ffda"
const DIAGNOSTIC_TERMINAL_PATH = path.join(path.dirname(DIAGNOSTIC_REPORT_PATH), "phase-terminal.json")
const DIAGNOSTIC_TERMINAL_SHA256 = "6f4f6e83935295efbf46e018c4f407a75c5dad022bddd48116c3fc68ece5291e"
const STAGE0_MANIFEST_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z-stage-0/manifest.json"
const STAGE0_MANIFEST_SHA256 = "2dfcfd016734ef7d88e33d6f75b23b9d043df7d075b280827b304e1c89ede5ef"
const STAGE0_CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/ai-assisted-v7-r5-stage4-full-training-2026-08-05T10-21-08-137Z-stage-0/complete-world-ai-assisted-conditional-denoiser.pt"
const STAGE0_CHECKPOINT_SHA256 = "17c1d4e34e8e738bc042c0f99dad27afcc3bfd9337e3e220bc0e172c6e634453"
const AUTOENCODER_CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const AUTOENCODER_CHECKPOINT_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const EXPECTED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const EXPECTED_CONDITION_LABEL = "v7-complete-map-194"
const EXPECTED_SPLIT = "validation"
const EXPECTED_IMAGE_SHA256 = "13caf53dce064afdd0bc1318f4c5b5bb9b3c63631679d84ccd3ed3ab992688be"
const EXPECTED_CONDITION_PACK_SHA256 = "2db536def8a3b7d3049b7cae673942edd77aa1151f432dc5774f2b3a33579ca9"
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const REQUIRED_PREVIEW_EPOCHS = [1, 5, 10, 20, 30]
const EPOCH_COUNT = 30
const EVALUATION_INTERVAL = 5
const SEED = 20263722
const PREFLIGHT_STATUS = "owner_authorized_v7_r5_stage4_bounded_repair_smoke_preflight_only"
const ACTIVE_STATUS = "owner_authorized_v7_r5_stage4_bounded_repair_single_sample_gpu_smoke"
const OBJECT_PREFIXES = ["ObjectFootprints", "ObjectTree", "ObjectRock", "ObjectVegetation"]
const DIAGNOSTIC_METRICS = [
  ...OBJECT_PREFIXES.flatMap((prefix) => [
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
const MODEL_ROOT = resolve(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4-bounded-repair-smoke")
const FINALIZATION_ROOT = resolve(".runtime/ai-painter/v7-r5-stage4-bounded-repair-smoke-finalizations")
const ATTEMPT_REGISTRATION_PATH = path.join(MODEL_ROOT, "execution-registrations", `${REQUEST_ID}.json`)
const LOCK_PATH = path.join(MODEL_ROOT, ".stage4-bounded-repair-smoke.lock")
const startedAt = new Date().toISOString()
const suffix = startedAt.replace(/[:.]/g, "-")
const runId = `ai-assisted-v7-r5-stage4-bounded-repair-smoke-${suffix}`
const runDir = path.join(MODEL_ROOT, runId)
const derivedConfigPath = path.join(MODEL_ROOT, "derived-configs", `${runId}.json`)
const preflightReportPath = path.join(MODEL_ROOT, "preflights", `${runId}.json`)
const finalizationPath = path.join(FINALIZATION_ROOT, `${runId}-finalization`, "finalization-report.json")
const terminalPath = path.join(FINALIZATION_ROOT, `${runId}-finalization`, "phase-terminal.json")

let executionConsumption = null
let childResult = null
let manifest = null

await main()

async function main() {
  if (fs.existsSync(ATTEMPT_REGISTRATION_PATH)) {
    console.error("stage4_bounded_repair_smoke_already_registered_no_retry")
    process.exitCode = 1
    return
  }
  fs.mkdirSync(path.dirname(ATTEMPT_REGISTRATION_PATH), { recursive: true })
  writeImmutableJson(ATTEMPT_REGISTRATION_PATH, {
    schemaVersion: "stage4-bounded-repair-smoke-attempt-registration-v1",
    status: "registered_before_preflights_gpu_execution_not_consumed",
    requestId: REQUEST_ID,
    runId,
    registeredAtUtc: startedAt,
    registeredAtAsiaShanghai: formatShanghai(startedAt),
    automaticRetryAuthorized: false,
  })
  try {
    const context = loadContext()
    const hardware = hardwareSnapshot()
    const disk = diskBudgetSnapshot()
    const staticIssues = validateStaticPreflight(context, hardware, disk)
    const pythonPreflight = staticIssues.length === 0 ? runPythonPreflight(context.preflightConfig) : null
    const issues = [...staticIssues]
    if (pythonPreflight && pythonPreflight.status !== 0) issues.push("python_preflight_failed")
    const preflight = {
      schemaVersion: "stage4-bounded-repair-smoke-preflight-v1",
      status: issues.length === 0 ? "all_preflights_passed_gpu_execution_not_consumed" : "preflight_failed_closed",
      runId,
      createdAtUtc: new Date().toISOString(),
      createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256: AUTHORIZATION_SHA256,
      implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION_PATH,
      implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
      cpuReportPath: CPU_REPORT_PATH,
      cpuReportSha256: fs.existsSync(resolve(CPU_REPORT_PATH)) ? sha256File(CPU_REPORT_PATH) : null,
      trainerPath: TRAINER,
      trainerSha256: sha256File(TRAINER),
      runnerPath: RUNNER_PATH,
      runnerSha256: sha256File(RUNNER_PATH),
      inactiveConfigPath: INACTIVE_CONFIG_PATH,
      inactiveConfigSha256: INACTIVE_CONFIG_SHA256,
      sampleId: EXPECTED_SAMPLE_ID,
      sampleSplit: EXPECTED_SPLIT,
      resolution: { width: 256, height: 192 },
      epochCount: EPOCH_COUNT,
      requiredPreviewEpochs: REQUIRED_PREVIEW_EPOCHS,
      pythonPreflight: pythonPreflight ? { exitCode: pythonPreflight.status, stdout: pythonPreflight.stdout, stderr: pythonPreflight.stderr } : null,
      cudaResource: hardware,
      diskBudget: disk,
      blockers: [...new Set(issues)],
      executionBoundary: boundaries(false, false, false, false, false),
    }
    writeImmutableJson(preflightReportPath, preflight)
    if (issues.length > 0) {
      closeRun("stage4_bounded_repair_smoke_preflight_failed_closed", issues, { preflight })
      process.exitCode = 1
      return
    }

    executionConsumption = consumeGpuExecution(preflight)
    if (!fileHashMatches(STAGE0_CHECKPOINT_PATH, STAGE0_CHECKPOINT_SHA256)) throw new Error("bound_stage0_checkpoint_missing_or_changed_after_consumption")
    if (!fileHashMatches(AUTOENCODER_CHECKPOINT_PATH, AUTOENCODER_CHECKPOINT_SHA256)) throw new Error("bound_autoencoder_checkpoint_missing_or_changed_after_consumption")
    if (!fileHashMatches(context.sample.imagePath, EXPECTED_IMAGE_SHA256)) throw new Error("bound_sample_image_missing_or_changed_after_consumption")
    if (!fileHashMatches(context.sample.conditionPackPath, EXPECTED_CONDITION_PACK_SHA256)) throw new Error("bound_condition_pack_missing_or_changed_after_consumption")
    const activeConfig = activateConfig(context.inactiveConfig, context, executionConsumption, false)
    writeImmutableJson(derivedConfigPath, activeConfig)
    const releaseLock = acquireLock()
    try {
      childResult = await runTrainer()
      if (childResult.exitCode !== 0) throw new Error("stage4_bounded_repair_smoke_python_training_failed")
      const manifestPath = path.join(runDir, "manifest.json")
      manifest = readJson(manifestPath)
      const manifestIssues = validateManifest(manifest, context)
      if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
      const diagnosticEvidence = collectDiagnosticEvidence(manifest)
      const review = await reviewPreviews(context.sample)
      const blockers = []
      if (review.previewCount !== 5 || review.previewFailCount > 0) blockers.push("fixed_preview_machine_review_failed")
      if (diagnosticEvidence.metricCount !== 17 || diagnosticEvidence.epochs.length !== 5) blockers.push("diagnostic_metric_evidence_incomplete")
      const status = blockers.length === 0
        ? "stage4_bounded_repair_single_sample_gpu_smoke_passed_stopped"
        : "stage4_bounded_repair_single_sample_gpu_smoke_failed_stopped"
      closeRun(status, blockers, { review, diagnosticEvidence })
      if (blockers.length > 0) process.exitCode = 1
    } finally {
      releaseLock()
    }
  } catch (error) {
    const blockers = String(error?.message ?? error).split(",").filter(Boolean)
    closeRun("stage4_bounded_repair_single_sample_gpu_smoke_execution_failed_stopped", blockers)
    console.error(JSON.stringify({ status: "failed", blockers }, null, 2))
    process.exitCode = 1
  }
}

function loadContext() {
  const authorization = readJson(AUTHORIZATION_PATH)
  const implementation = readJson(IMPLEMENTATION_CONSUMPTION_PATH)
  const previousFailureTerminal = readJson(PREVIOUS_FAILURE_TERMINAL_PATH)
  const inactiveConfig = readJson(INACTIVE_CONFIG_PATH)
  const selection = readJson(SELECTION_PATH)
  const support = readJson(SUPPORT_CONTRACT_PATH)
  const boundedCpu = readJson(BOUNDED_CPU_REPORT_PATH)
  const boundedTerminal = readJson(BOUNDED_TERMINAL_PATH)
  const cpuReport = readJson(CPU_REPORT_PATH)
  const datasetManifest = readJson(DATASET_MANIFEST_PATH)
  const sourceIndex = readJson(SOURCE_INDEX_PATH)
  const diagnostic = readJson(DIAGNOSTIC_REPORT_PATH)
  const diagnosticTerminal = readJson(DIAGNOSTIC_TERMINAL_PATH)
  const stage0Manifest = readJson(STAGE0_MANIFEST_PATH)
  const selectedRows = (sourceIndex?.samples ?? []).filter(isV7CapacityRow)
  const sample = selectedRows.find((row) => row.sampleId === EXPECTED_SAMPLE_ID)
  const preflightConfig = activateConfig(inactiveConfig, { sample }, null, true)
  return { authorization, implementation, previousFailureTerminal, inactiveConfig, selection, support, boundedCpu, boundedTerminal, cpuReport, datasetManifest, sourceIndex, diagnostic, diagnosticTerminal, stage0Manifest, selectedRows, sample, preflightConfig }
}

function validateStaticPreflight(context, hardware, disk) {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  for (const [file, hash, code] of [
    [AUTHORIZATION_PATH, AUTHORIZATION_SHA256, "authorization"],
    [IMPLEMENTATION_CONSUMPTION_PATH, IMPLEMENTATION_CONSUMPTION_SHA256, "implementation_consumption"],
    [PREVIOUS_FAILURE_TERMINAL_PATH, PREVIOUS_FAILURE_TERMINAL_SHA256, "previous_failure_terminal"],
    [INACTIVE_CONFIG_PATH, INACTIVE_CONFIG_SHA256, "inactive_config"],
    [SELECTION_PATH, SELECTION_SHA256, "selection"],
    [SUPPORT_CONTRACT_PATH, SUPPORT_CONTRACT_SHA256, "support_contract"],
    [BOUNDED_CPU_REPORT_PATH, BOUNDED_CPU_REPORT_SHA256, "bounded_cpu_report"],
    [BOUNDED_TERMINAL_PATH, BOUNDED_TERMINAL_SHA256, "bounded_terminal"],
    [DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256, "dataset_manifest"],
    [SOURCE_INDEX_PATH, SOURCE_INDEX_SHA256, "source_index"],
    [DIAGNOSTIC_REPORT_PATH, DIAGNOSTIC_REPORT_SHA256, "diagnostic_report"],
    [DIAGNOSTIC_TERMINAL_PATH, DIAGNOSTIC_TERMINAL_SHA256, "diagnostic_terminal"],
    [STAGE0_MANIFEST_PATH, STAGE0_MANIFEST_SHA256, "stage0_manifest"],
    [TRAINER, TRAINER_SHA256, "trainer"],
  ]) check(fileHashMatches(file, hash), `${code}_missing_or_changed`)
  check(context.authorization?.status === "resolved_owner_authorized", "authorization_not_resolved")
  check(context.authorization?.ownerDecision?.commandRef === COMMAND_REF && context.authorization?.ownerDecision?.scope === SCOPE, "authorization_identity_invalid")
  check(context.implementation?.status === "consumed_before_seed_fix_authorization_binding_and_new_cpu_gate_writes", "implementation_not_consumed")
  check(context.previousFailureTerminal?.status === "stage4_bounded_repair_smoke_preflight_failed_closed", "previous_failure_terminal_status_invalid")
  check(context.authorization?.previousFailedExecution?.failureTerminalPath === PREVIOUS_FAILURE_TERMINAL_PATH && context.authorization?.previousFailedExecution?.failureTerminalSha256 === PREVIOUS_FAILURE_TERMINAL_SHA256 && context.authorization?.previousFailedExecution?.closedNoRetry === true, "previous_failure_authorization_binding_invalid")
  check(context.inactiveConfig?.status === "r5_stage4_diagnostic_evidence_bounded_repair_candidate_inactive", "inactive_config_status_invalid")
  check(context.selection?.status === "selected_inactive_not_authorized", "selection_status_invalid")
  check(context.support?.status === "cpu_verified_bounded_repair_support_not_active", "support_status_invalid")
  check(context.boundedCpu?.status === "passed_cpu_only_bounded_repair_not_active", "bounded_cpu_not_passed")
  check(context.boundedTerminal?.status === "r5_stage4_bounded_repair_selected_compiled_cpu_verified_not_active", "bounded_terminal_not_closed")
  check(context.cpuReport?.status === "passed_cpu_only_stage4_bounded_repair_smoke_authorization_gate_gpu_not_started", "smoke_cpu_gate_not_passed")
  check(context.cpuReport?.inputs?.trainerSha256 === TRAINER_SHA256, "smoke_cpu_trainer_identity_invalid")
  check(context.cpuReport?.inputs?.runnerSha256 === sha256File(RUNNER_PATH), "smoke_cpu_runner_identity_invalid")
  check(context.diagnostic?.status === "read_only_single_sample_gpu_diagnostic_completed_weights_unchanged", "diagnostic_report_status_invalid")
  check(context.diagnosticTerminal?.status === "r5_stage4_readonly_single_sample_gpu_diagnostic_completed_closed", "diagnostic_terminal_status_invalid")
  check(context.stage0Manifest?.checkpointPath === STAGE0_CHECKPOINT_PATH && context.stage0Manifest?.checkpointSha256 === STAGE0_CHECKPOINT_SHA256, "stage0_manifest_checkpoint_binding_invalid")
  check(context.stage0Manifest?.autoencoderCheckpointPath === AUTOENCODER_CHECKPOINT_PATH && context.stage0Manifest?.autoencoderCheckpointSha256 === AUTOENCODER_CHECKPOINT_SHA256, "stage0_manifest_autoencoder_binding_invalid")
  check(context.sample?.conditionLabel === EXPECTED_CONDITION_LABEL && context.sample?.split === EXPECTED_SPLIT, "sample_identity_invalid")
  check(context.sample?.imageSha256 === EXPECTED_IMAGE_SHA256, "sample_image_binding_invalid")
  check(context.selectedRows.length === 64 && sameJson(countSplits(context.selectedRows), EXPECTED_SPLITS), "dataset_64_split_binding_invalid")
  check(fs.existsSync(resolve(STAGE0_CHECKPOINT_PATH)) && fs.statSync(resolve(STAGE0_CHECKPOINT_PATH)).isFile(), "stage0_checkpoint_file_missing")
  check(fs.existsSync(resolve(AUTOENCODER_CHECKPOINT_PATH)) && fs.statSync(resolve(AUTOENCODER_CHECKPOINT_PATH)).isFile(), "autoencoder_checkpoint_file_missing")
  check(fs.existsSync(PYTHON), "python_runtime_missing")
  check(!fs.existsSync(resolve(EXECUTION_CONSUMPTION_PATH)), "gpu_execution_already_consumed")
  check(!fs.existsSync(runDir), "run_directory_already_exists")
  issues.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  check(disk.passed, "disk_budget_insufficient")
  return [...new Set(issues)]
}

function activateConfig(inactiveConfig, context, consumption, preflightOnly) {
  const config = structuredClone(inactiveConfig)
  const sample = context?.sample
  const status = preflightOnly ? PREFLIGHT_STATUS : ACTIVE_STATUS
  config.status = preflightOnly ? "stage4_bounded_repair_smoke_preflight_only" : "stage4_bounded_repair_smoke_active_single_execution"
  config.architectureVersion = "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage4-diagnostic-evidence-bounded-smoke"
  const training = config.training
  training.seed = SEED
  training.trainingAuthorizationStatus = status
  training.authorizedOverfitSampleId = EXPECTED_SAMPLE_ID
  training.authorizedOverfitConditionLabel = EXPECTED_CONDITION_LABEL
  training.authorizedOverfitSampleSplit = EXPECTED_SPLIT
  training.authorizedInitialization = "project_stage4_failed_stage0_checkpoint_continuation_nonformal_smoke"
  training.fixedEpochPreviewPolicy.smoke = [...REQUIRED_PREVIEW_EPOCHS]
  training.stage4FullTrainingContract.status = preflightOnly ? "bounded_repair_smoke_preflight_only" : "bounded_repair_smoke_active_stage0_only"
  training.r5Stage4BoundedRepairCheckpointContinuation = {
    sourceManifestPath: STAGE0_MANIFEST_PATH,
    sourceManifestSha256: STAGE0_MANIFEST_SHA256,
    sourceCheckpointPath: STAGE0_CHECKPOINT_PATH,
    sourceCheckpointSha256: STAGE0_CHECKPOINT_SHA256,
    sourceArchitectureVersion: "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage4-coverage-convergence-full-training",
    loadingAuthorizedNow: !preflightOnly,
    stage1OrStage2InitializationAuthorized: false,
  }
  training.r5Stage4BoundedRepairSmokeContract = {
    status: preflightOnly ? "preflight_only" : "active_single_execution",
    stageIndex: 0,
    resolution: { width: 256, height: 192 },
    epochCount: EPOCH_COUNT,
    evaluationInterval: EVALUATION_INTERVAL,
    requiredPreviewEpochs: [...REQUIRED_PREVIEW_EPOCHS],
    requiredDiagnosticMetricCount: 17,
    sampleId: EXPECTED_SAMPLE_ID,
    conditionLabel: EXPECTED_CONDITION_LABEL,
    sampleSplit: EXPECTED_SPLIT,
    nonFormalValidationSampleOverfit: true,
    checkpointPromotionEligible: false,
    automaticRetryAuthorized: false,
    stage1Authorized: false,
    stage2Authorized: false,
  }
  training.stage4FailureDiagnostics = {
    enabled: true,
    status: preflightOnly ? "diagnostic_support_candidate_not_active" : "diagnostic_support_active_bounded_smoke",
    objectSemanticDiagnostics: {
      channels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
      measurements: ["independent_loss", "gradient_contribution", "decoded_response"],
      gradientTarget: "predicted_rgb_only",
      changesTrainingWeightsNow: false,
    },
    routeLateRegressionDiagnostics: {
      conditionChannel: "terrain_path_ground",
      measurements: ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"],
      requiredBoundarySidesSource: "authorizedBoundaryTopology.requiredBoundarySides",
      preserveExistingPathLossWeights: true,
      spatialGridSize: 4,
    },
    reviewThresholdsModified: false,
    failedPreviewPixelsUsedAsTrainingTargets: false,
    executionValuesSelected: false,
    trainingConfigApplied: false,
    checkpointFileReadAuthorized: !preflightOnly,
    gpuUseAuthorized: !preflightOnly,
    trainingAuthorized: !preflightOnly,
  }
  training.ownerTrainingAuthorization = {
    authorizationId: REQUEST_ID,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION_PATH,
    implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
    executionConsumptionPath: consumption?.path ?? null,
    executionConsumptionSha256: consumption?.sha256 ?? null,
    sourceConfigPath: INACTIVE_CONFIG_PATH,
    sourceConfigSha256: INACTIVE_CONFIG_SHA256,
    selectionContractPath: SELECTION_PATH,
    selectionContractSha256: SELECTION_SHA256,
    trainerSupportContractPath: SUPPORT_CONTRACT_PATH,
    trainerSupportContractSha256: SUPPORT_CONTRACT_SHA256,
    boundedRepairCpuReportPath: BOUNDED_CPU_REPORT_PATH,
    boundedRepairCpuReportSha256: BOUNDED_CPU_REPORT_SHA256,
    boundedRepairTerminalPath: BOUNDED_TERMINAL_PATH,
    boundedRepairTerminalSha256: BOUNDED_TERMINAL_SHA256,
    stage0ManifestPath: STAGE0_MANIFEST_PATH,
    stage0ManifestSha256: STAGE0_MANIFEST_SHA256,
    autoencoderCheckpointPath: AUTOENCODER_CHECKPOINT_PATH,
    autoencoderCheckpointSha256: AUTOENCODER_CHECKPOINT_SHA256,
    datasetManifestPath: DATASET_MANIFEST_PATH,
    datasetManifestSha256: DATASET_MANIFEST_SHA256,
    sourceIndexPath: SOURCE_INDEX_PATH,
    sourceIndexSha256: SOURCE_INDEX_SHA256,
    status,
    checkpointLoadingAuthorized: !preflightOnly,
    optimizerCreationAuthorized: !preflightOnly,
    modelWeightMutationAuthorized: !preflightOnly,
    gpuTrainingAuthorizedNow: !preflightOnly,
    singleSampleGpuOverfitSmokeAuthorized: !preflightOnly,
    fullTrainingAuthorized: false,
    automaticRetryAuthorized: false,
    strictRevalidationAuthorized: false,
    validationAuthorized: false,
    formalInferenceAuthorized: false,
    checkpointPromotionAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  }
  if (sample) {
    training.r5Stage4BoundedRepairSmokeContract.imagePath = sample.imagePath
    training.r5Stage4BoundedRepairSmokeContract.conditionPackPath = sample.conditionPackPath
  }
  return config
}

function runPythonPreflight(config) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-pet-stage4-bounded-smoke-preflight-"))
  const configPath = path.join(temporaryRoot, "config.json")
  try {
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    return spawnSync(PYTHON, [TRAINER,
      "--config", configPath,
      "--dataset-package", resolve(DATASET_MANIFEST_PATH),
      "--autoencoder-checkpoint", resolve(AUTOENCODER_CHECKPOINT_PATH),
      "--initial-denoiser-checkpoint", resolve(STAGE0_CHECKPOINT_PATH),
      "--output-dir", path.join(temporaryRoot, "unused"),
      "--resolution-stage", "0",
      "--single-sample-overfit-smoke",
      "--overfit-sample-id", EXPECTED_SAMPLE_ID,
      "--overfit-epochs", String(EPOCH_COUNT),
      "--overfit-evaluation-interval", String(EVALUATION_INTERVAL),
      "--preflight-only",
    ], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: pythonEnv(), windowsHide: true })
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

function consumeGpuExecution(preflight) {
  const record = {
    schemaVersion: "stage4-bounded-repair-smoke-gpu-execution-consumption-v1",
    status: "consumed_after_all_preflights_before_checkpoint_read_and_gpu_smoke",
    requestId: REQUEST_ID,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION_PATH,
    implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
    commandRef: COMMAND_REF,
    scope: SCOPE,
    consumedAtUtc: new Date().toISOString(),
    consumedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    runId,
    allowedExecutionCount: 1,
    allPreflightsPassed: true,
    preflightReportPath: projectPath(preflightReportPath),
    preflightReportSha256: sha256File(preflightReportPath),
    cpuReportPath: CPU_REPORT_PATH,
    cpuReportSha256: sha256File(CPU_REPORT_PATH),
    trainerSha256: TRAINER_SHA256,
    runnerSha256: sha256File(RUNNER_PATH),
    inactiveConfigSha256: INACTIVE_CONFIG_SHA256,
    checkpointFileReadPerformedAtConsumption: false,
    checkpointLoadedAtConsumption: false,
    optimizerCreatedAtConsumption: false,
    gpuStartedAtConsumption: false,
    automaticRetryAuthorized: false,
    fullTrainingAuthorized: false,
    stage1Authorized: false,
    stage2Authorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    checkpointFormalPromotionAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  }
  writeImmutableJson(EXECUTION_CONSUMPTION_PATH, record)
  return { ...record, path: EXECUTION_CONSUMPTION_PATH, sha256: sha256File(EXECUTION_CONSUMPTION_PATH) }
}

function runTrainer() {
  const args = [TRAINER,
    "--config", derivedConfigPath,
    "--dataset-package", resolve(DATASET_MANIFEST_PATH),
    "--autoencoder-checkpoint", resolve(AUTOENCODER_CHECKPOINT_PATH),
    "--initial-denoiser-checkpoint", resolve(STAGE0_CHECKPOINT_PATH),
    "--output-dir", runDir,
    "--resolution-stage", "0",
    "--single-sample-overfit-smoke",
    "--overfit-sample-id", EXPECTED_SAMPLE_ID,
    "--overfit-epochs", String(EPOCH_COUNT),
    "--overfit-evaluation-interval", String(EVALUATION_INTERVAL),
  ]
  return new Promise((complete) => {
    const child = spawn(PYTHON, args, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8") })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); process.stderr.write(chunk) })
    const timer = setInterval(() => {
      const progress = readJson(path.join(runDir, "progress.json"))
      const gpu = hardwareSnapshot().gpu
      console.log(JSON.stringify({ kind: "stage4_bounded_repair_smoke_heartbeat", runId, epoch: progress?.currentEpoch?.epoch ?? progress?.latestMetric?.epoch ?? null, status: progress?.status ?? "starting", gpuUtilizationPercent: gpu.utilizationPercent, gpuMemoryUsedMiB: gpu.memoryUsedMiB, recordedAtUtc: new Date().toISOString() }))
    }, 20000)
    child.on("error", (error) => { stderr += error.stack || error.message })
    child.on("close", (exitCode, signal) => {
      clearInterval(timer)
      complete({ exitCode, signal, stdout, stderr })
    })
  })
}

function validateManifest(value, context) {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(value?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "manifest_status_invalid")
  check(value?.architectureVersion === "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage4-diagnostic-evidence-bounded-smoke", "manifest_architecture_invalid")
  check(value?.datasetPackageId === context.datasetManifest?.packageId, "manifest_dataset_invalid")
  check(value?.actualLoadedConditionalSampleCount === 64 && value?.actualLoadedV7CapacityCount === 64, "manifest_capacity_invalid")
  check(sameJson(value?.actualLoadedSplitCounts, EXPECTED_SPLITS), "manifest_splits_invalid")
  check(sameJson(value?.resolutionStage, { width: 256, height: 192 }), "manifest_resolution_invalid")
  check(value?.singleSampleOverfitSmoke?.sampleId === EXPECTED_SAMPLE_ID && value?.singleSampleOverfitSmoke?.selectedSplit === EXPECTED_SPLIT, "manifest_sample_invalid")
  check(value?.parentDenoiserCheckpointPath === STAGE0_CHECKPOINT_PATH && value?.parentDenoiserCheckpointSha256 === STAGE0_CHECKPOINT_SHA256, "manifest_parent_invalid")
  check(value?.metrics?.at(-1)?.epoch === 30, "manifest_epoch_invalid")
  check(value?.formalInferenceEligible === false && value?.denoiserTrained === false, "manifest_formal_boundary_invalid")
  check(value?.modelStateHashEvidence?.weightsChanged === true, "manifest_model_state_hash_invalid")
  check(typeof value?.modelStateHashEvidence?.initialDenoiserStateSha256 === "string" && value.modelStateHashEvidence.initialDenoiserStateSha256.length === 64, "manifest_initial_state_hash_missing")
  check(typeof value?.modelStateHashEvidence?.finalDenoiserStateSha256 === "string" && value.modelStateHashEvidence.finalDenoiserStateSha256.length === 64, "manifest_final_state_hash_missing")
  check(fileHashMatches(value?.checkpointPath, value?.checkpointSha256), "smoke_checkpoint_hash_invalid")
  return issues
}

function collectDiagnosticEvidence(value) {
  const rows = REQUIRED_PREVIEW_EPOCHS.map((epoch) => value.metrics.find((row) => row.epoch === epoch)).filter(Boolean)
  const epochs = rows.map((row) => ({
    epoch: row.epoch,
    metrics: Object.fromEntries(DIAGNOSTIC_METRICS.map((name) => [name, row[`train${upperCamel(name)}`]])),
  }))
  const allPresent = epochs.every((row) => DIAGNOSTIC_METRICS.every((name) => Number.isFinite(row.metrics[name])))
  return {
    schemaVersion: "stage4-bounded-repair-smoke-diagnostic-evidence-v1",
    metricNames: DIAGNOSTIC_METRICS,
    metricCount: allPresent ? DIAGNOSTIC_METRICS.length : 0,
    epochs,
    allMetricsPresent: allPresent,
  }
}

async function reviewPreviews(sample) {
  const previewRoot = path.join(runDir, "fixed-epoch-previews")
  const files = fs.existsSync(previewRoot) ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort() : []
  const epochs = files.map((file) => Number(file.match(/^epoch-(\d+)/)?.[1] ?? 0))
  if (!sameJson(epochs, REQUIRED_PREVIEW_EPOCHS)) throw new Error("fixed_preview_identity_invalid")
  const reviews = []
  for (const file of files) {
    const epoch = Number(file.match(/^epoch-(\d+)/)?.[1] ?? 0)
    if (!file.includes(EXPECTED_CONDITION_LABEL)) throw new Error("preview_condition_identity_invalid")
    const previewPath = path.join(previewRoot, file)
    const normalizedPath = path.join(runDir, "fixed-preview-review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({ sourcePath: previewPath, finalAssetPath: normalizedPath, workRoot: resolve(".runtime/ai-painter/r5s4-bounded-smoke-review-work"), workId: sha256Text(runId).slice(0, 16), epoch })
    const conditionPack = readJson(sample.conditionPackPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({ record: { recordId: `${runId}-${file}`, conditionBinding: { conditionPackPath: sample.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: sample.classification }, imagePath: normalized.shortOutputPath, referenceImagePath: sample.imagePath }),
    ])
    reviews.push({
      epoch,
      previewPath: projectPath(previewPath),
      previewSha256: normalized.sourceSha256,
      normalizedPath: projectPath(normalizedPath),
      normalizedSha256: normalized.normalizedSha256,
      windowsSafeShortPathIo: true,
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  const report = {
    schemaVersion: "stage4-bounded-repair-smoke-fixed-preview-reviews-v1",
    status: reviews.every((row) => row.passed) ? "machine_reviews_passed" : "machine_reviews_failed_closed",
    runId,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    requiredPreviewEpochs: REQUIRED_PREVIEW_EPOCHS,
    reviewThresholdsChanged: false,
    formalCandidate: false,
    reviews,
    previewCount: reviews.length,
    previewPassCount: reviews.filter((row) => row.passed).length,
    previewFailCount: reviews.filter((row) => !row.passed).length,
  }
  const reviewPath = path.join(runDir, "fixed-preview-reviews.json")
  writeImmutableJson(reviewPath, report)
  return { ...report, reviewPath: projectPath(reviewPath), reviewSha256: sha256File(reviewPath) }
}

function closeRun(status, blockers, extra = {}) {
  if (fs.existsSync(finalizationPath)) return readJson(finalizationPath)
  const checkpointPath = manifest?.checkpointPath ?? null
  const checkpointSha256 = manifest?.checkpointSha256 ?? null
  const report = {
    schemaVersion: "stage4-bounded-repair-single-sample-gpu-smoke-finalization-v1",
    status,
    runId,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION_PATH,
    implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
    executionConsumptionPath: executionConsumption?.path ?? null,
    executionConsumptionSha256: executionConsumption?.sha256 ?? null,
    preflightReportPath: fs.existsSync(preflightReportPath) ? projectPath(preflightReportPath) : null,
    preflightReportSha256: fs.existsSync(preflightReportPath) ? sha256File(preflightReportPath) : null,
    derivedConfigPath: fs.existsSync(derivedConfigPath) ? projectPath(derivedConfigPath) : null,
    derivedConfigSha256: fs.existsSync(derivedConfigPath) ? sha256File(derivedConfigPath) : null,
    manifestPath: manifest ? projectPath(path.join(runDir, "manifest.json")) : null,
    manifestSha256: manifest ? sha256File(path.join(runDir, "manifest.json")) : null,
    checkpointPath,
    checkpointSha256,
    modelStateHashEvidence: manifest?.modelStateHashEvidence ?? null,
    trainingTokenAccounting: manifest?.trainingTokenAccounting ?? null,
    child: childResult ? { exitCode: childResult.exitCode, signal: childResult.signal, stdoutTail: childResult.stdout.slice(-12000), stderrTail: childResult.stderr.slice(-12000) } : null,
    blockers,
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ...boundaries(Boolean(executionConsumption), Boolean(manifest), Boolean(manifest), Boolean(manifest), Boolean(checkpointPath)),
    ...extra,
  }
  writeImmutableJson(finalizationPath, report)
  const reportWithIdentity = { ...report, reportPath: projectPath(finalizationPath), reportSha256: sha256File(finalizationPath) }
  writeImmutableJson(terminalPath, {
    schemaVersion: "stage4-bounded-repair-single-sample-gpu-smoke-terminal-v1",
    status,
    runId,
    recordedAtUtc: report.createdAtUtc,
    recordedAtAsiaShanghai: report.createdAtAsiaShanghai,
    finalizationReportPath: reportWithIdentity.reportPath,
    finalizationReportSha256: reportWithIdentity.reportSha256,
    checkpointPath,
    checkpointSha256,
    blockers,
    stage4Complete: false,
    stage1Started: false,
    stage2Started: false,
    stage5Started: false,
    automaticRetryStarted: false,
    formalInferenceStarted: false,
    checkpointFormallyPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  console.log(JSON.stringify({ ...reportWithIdentity, terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
  return reportWithIdentity
}

function acquireLock() {
  fs.mkdirSync(MODEL_ROOT, { recursive: true })
  const handle = fs.openSync(LOCK_PATH, "wx")
  fs.writeFileSync(handle, `${JSON.stringify({ schemaVersion: "stage4-bounded-repair-smoke-lock-v1", pid: process.pid, runId, createdAtUtc: new Date().toISOString() }, null, 2)}\n`)
  fs.closeSync(handle)
  return () => {
    if (!fs.existsSync(LOCK_PATH)) return
    const lock = readJson(LOCK_PATH)
    if (lock?.pid === process.pid && lock?.runId === runId) fs.unlinkSync(LOCK_PATH)
  }
}

function diskBudgetSnapshot() {
  const requiredFreeBytes = 2 * 1024 ** 3
  const stat = fs.statfsSync(ROOT)
  const freeBytes = Number(stat.bavail) * Number(stat.bsize)
  return { requiredFreeBytes, freeBytes, passed: freeBytes >= requiredFreeBytes }
}

function hardwareSnapshot() {
  const gpu = spawnSync("nvidia-smi", ["--query-gpu=index,name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const processes = spawnSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const rows = processes.status === 0 ? processes.stdout.split(/\r?\n/).filter(Boolean) : []
  const values = gpu.status === 0 ? gpu.stdout.trim().split(",").map((value) => value.trim()) : []
  return { recordedAtUtc: new Date().toISOString(), cpu: { model: os.cpus()[0]?.model ?? null, logicalProcessors: os.cpus().length }, memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() }, gpu: { available: gpu.status === 0, deviceIndex: Number(values[0] ?? -1), name: values[1] ?? null, driverVersion: values[2] ?? null, memoryTotalMiB: Number(values[3] ?? 0), memoryUsedMiB: Number(values[4] ?? 0), utilizationPercent: Number(values[5] ?? 0), temperatureC: Number(values[6] ?? 0), pythonComputeProcessCount: rows.filter((row) => /python/i.test(row)).length, computeProcesses: rows } }
}

function boundaries(consumed, checkpointLoaded, optimizerCreated, weightsModified, checkpointWritten) {
  return { gpuExecutionAuthorizationConsumed: consumed, checkpointFileRead: checkpointLoaded, checkpointLoaded, optimizerCreated, backwardExecuted: optimizerCreated, modelWeightsModified: weightsModified, gpuTrainingStarted: optimizerCreated, smokeCheckpointWritten: checkpointWritten, automaticRetryStarted: false, stage4FullTrainingStarted: false, stage1Started: false, stage2Started: false, strictRevalidationStarted: false, formalInferenceStarted: false, checkpointFormallyPromoted: false, runtimeFrameStarted: false, worldEntryStarted: false }
}

function isV7CapacityRow(row) { return row?.categoryId === "complete-maps" && row?.trainingRoles?.includes("conditional_denoiser") && row?.formalConditionalTrainingEligible === true && row?.conditionBound === true && row?.v7CapacityContributionRegistered === true && row?.ownerReviewStatus === "owner_approved" && row?.machineReviewStatus === "passed" && row?.aiAssistedColdStartEligible === true && row?.independentTrainingEligible === false }
function countSplits(rows) { return Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])) }
function upperCamel(value) { return value ? value[0].toUpperCase() + value.slice(1) : value }
function readJson(value) { try { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) } catch { return null } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function sha256Text(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return Boolean(value && expected && fs.existsSync(absolute) && sha256File(absolute) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: resolve("ml/ai-painter/src") } }
function writeImmutableJson(value, body) { const absolute = resolve(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); const handle = fs.openSync(absolute, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
