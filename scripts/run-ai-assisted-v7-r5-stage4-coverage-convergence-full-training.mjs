import crypto from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { normalizePreviewWithWindowsSafeIo } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"
import { evaluateV7TrainingGpuResourceGate } from "./lib/ai-assisted-v7-training-resource-gate.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = resolve("ml/ai-painter/.venv/Scripts/python.exe")
const TRAINER = resolve("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
const TRAINER_SHA256 = "4bcb6061d539aa0f9e5ce85c6b53b0ac5ff83ad49fdc65e1b2efb21a2b29c1f0"
const REQUEST_ID = "owner-action-request-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "2bc4993cf339476d786a5c4a90dc60bb61bd0ade632f366c2414ef60bba5a07c"
const IMPLEMENTATION_CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/implementation-authorization-consumption.json`
const IMPLEMENTATION_CONSUMPTION_SHA256 = "698788ed3a5b5b87f25f92ef2234a5345be9a92b2aebb7ce8c8c20127ae690b4"
const TRAINING_CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/training-execution-authorization-consumption.json`
const COMMAND_REF = "owner-authorized-v7-r5-stage4-contract-boundary-correction-bounded-execution-20260805"
const SCOPE = "split_stage3_smoke_30_epoch_and_stage4_formal_40_epoch_contract_then_one_bounded_stage4_execution_only"
const INACTIVE_CONFIG_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4/configs/ai-assisted-v7-r5-stage4-coverage-convergence-full-training-config-20260805-182000000.json"
const INACTIVE_CONFIG_SHA256 = "c7a893604b55e3e1cb49ed288d7f723212034b13aed3456bf5822eaa175cb352"
const CONFIG_COMPILATION_REPORT_PATH = ".runtime/ai-painter/v7-r5-stage4-full-training-config-compilations/20260805-182000000/report.json"
const CONFIG_COMPILATION_REPORT_SHA256 = "5830a380393611511eb036d5d1b428df068a6f75aae8636d38acc56e8a1892bc"
const CPU_REPORT_PATH = ".runtime/ai-painter/v7-r5-stage4-full-training-authorization-cpu-regressions/20260805-182100000/report.json"
const DATASET_MANIFEST_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const DATASET_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const AUTOENCODER_CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const AUTOENCODER_CHECKPOINT_SHA256 = "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"
const STAGE3_SMOKE_CHECKPOINT_PATH = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-coverage-convergence/ai-assisted-v7-r5-stage3-coverage-convergence-checkpoint-continuation-overfit-smoke-2026-08-05T08-37-03-827Z/complete-world-ai-assisted-conditional-denoiser.pt"
const STAGE3_CLOSURE_REPORT_PATH = ".runtime/ai-painter/v7-r5-stage3-coverage-convergence-preview-review-recoveries/ai-assisted-v7-r5-stage3-offline-preview-review-recovery-2026-08-05T09-08-26-587Z/offline-preview-review-recovery-report.json"
const STAGE3_CLOSURE_REPORT_SHA256 = "052ca39e5b446c67afeee8edead5eb8344ae7e6a7a38c5a228557c412b513e0b"
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const EXPECTED_STAGES = [{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }]
const REQUIRED_PREVIEW_EPOCHS = [1, 5, 10, 20, 30, 40]
const PREFLIGHT_STATUS = "owner_authorized_v7_r5_stage4_full_training_preflight_only"
const ACTIVE_STATUS = "owner_authorized_v7_r5_stage4_full_training"
const MODEL_ROOT = resolve(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage4")
const FINALIZATION_ROOT = resolve(".runtime/ai-painter/v7-r5-stage4-full-training-finalizations")
const ATTEMPT_REGISTRATION_PATH = path.join(MODEL_ROOT, "execution-registrations", `${REQUEST_ID}.json`)
const LOCK_PATH = path.join(MODEL_ROOT, ".r5-stage4-full-training.lock")
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const chainId = `ai-assisted-v7-r5-stage4-full-training-${suffix}`
const chainDir = path.join(MODEL_ROOT, "chains", chainId)
const derivedConfigPath = path.join(chainDir, "active-config.json")
const preflightReportPath = path.join(chainDir, "preflight-report.json")
const terminalPath = path.join(chainDir, "stage4-terminal.json")

let currentStage = null
let currentChild = null
let trainingConsumption = null
const stageResults = []
let hardwareBefore = null

await main()

async function main() {
  if (fs.existsSync(ATTEMPT_REGISTRATION_PATH)) {
    console.error("r5_stage4_execution_already_registered_no_retry")
    process.exitCode = 1
    return
  }
  fs.mkdirSync(path.dirname(ATTEMPT_REGISTRATION_PATH), { recursive: true })
  writeImmutableJson(ATTEMPT_REGISTRATION_PATH, {
    schemaVersion: "ai-assisted-v7-r5-stage4-full-training-attempt-registration-v1",
    status: "registered_before_read_only_preflights_training_scope_not_consumed",
    requestId: REQUEST_ID,
    chainId,
    registeredAtUtc: now,
    registeredAtAsiaShanghai: formatShanghai(now),
    automaticRetryAuthorized: false,
  })
  try {
    const context = loadPreflightContext()
    hardwareBefore = hardwareSnapshot()
    const disk = diskBudgetSnapshot()
    const staticIssues = validateStaticPreflight(context, hardwareBefore, disk)
    const pythonPreflight = staticIssues.length === 0 ? runPythonPreflight(context.preflightConfig) : null
    const pythonIssues = pythonPreflight && pythonPreflight.status !== 0 ? ["python_training_contract_preflight_failed"] : []
    const issues = [...staticIssues, ...pythonIssues]
    const preflightReport = {
      schemaVersion: "ai-assisted-v7-r5-stage4-full-training-preflight-v1",
      status: issues.length === 0 ? "all_stage4_preflights_passed_training_scope_not_consumed" : "stage4_preflight_failed_closed",
      createdAtUtc: new Date().toISOString(),
      createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
      chainId,
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256: AUTHORIZATION_SHA256,
      implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION_PATH,
      implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
      inactiveConfigPath: INACTIVE_CONFIG_PATH,
      inactiveConfigSha256: INACTIVE_CONFIG_SHA256,
      cpuReportPath: CPU_REPORT_PATH,
      cpuReportSha256: context.cpuReport ? sha256File(CPU_REPORT_PATH) : null,
      trainerPath: projectPath(TRAINER),
      trainerSha256: sha256File(TRAINER),
      runnerPath: "scripts/run-ai-assisted-v7-r5-stage4-coverage-convergence-full-training.mjs",
      runnerSha256: sha256File("scripts/run-ai-assisted-v7-r5-stage4-coverage-convergence-full-training.mjs"),
      selectedRecordCount: context.selectedRows.length,
      selectedSplits: context.selectedSplits,
      pythonPreflight: pythonPreflight ? { exitCode: pythonPreflight.status, stdout: pythonPreflight.stdout, stderr: pythonPreflight.stderr } : null,
      hardware: hardwareBefore,
      diskBudget: disk,
      blockers: issues,
      executionBoundary: inactiveBoundary(),
    }
    writeImmutableJson(preflightReportPath, preflightReport)
    if (issues.length > 0) {
      const report = writeFinalization("r5_stage4_preflight_failed_closed", issues, { preflightReport })
      writeTerminal(report)
      process.exitCode = 1
      return
    }
    trainingConsumption = consumeTrainingExecution(preflightReport)
    const activeConfig = activateConfig(context.inactiveConfig, trainingConsumption)
    writeImmutableJson(derivedConfigPath, activeConfig)
    if (!fileHashMatches(AUTOENCODER_CHECKPOINT_PATH, AUTOENCODER_CHECKPOINT_SHA256)) {
      throw new Error("autoencoder_checkpoint_missing_or_changed_after_training_consumption")
    }
    if (JSON.stringify(activeConfig).includes(resolve(STAGE3_SMOKE_CHECKPOINT_PATH))) {
      throw new Error("stage3_smoke_checkpoint_physical_path_leaked_into_active_config")
    }
    const releaseLock = acquireLock()
    try {
      appendEvent("stage4_training_started", "running", "R5 Stage 4 full Stage 0 to Stage 2 training started", `chain=${chainId}; automaticRetry=false`)
      let parent = null
      for (let stageIndex = 0; stageIndex < EXPECTED_STAGES.length; stageIndex += 1) {
        currentStage = stageIndex
        const outputDir = path.join(MODEL_ROOT, `${chainId}-stage-${stageIndex}`)
        appendEvent("stage4_training_stage_started", "running", `R5 Stage 4 Stage ${stageIndex} started`, `resolution=${EXPECTED_STAGES[stageIndex].width}x${EXPECTED_STAGES[stageIndex].height}; parent=${parent?.checkpointSha256 ?? "deterministic_random"}`)
        const args = [TRAINER,
          "--config", derivedConfigPath,
          "--dataset-package", resolve(DATASET_MANIFEST_PATH),
          "--autoencoder-checkpoint", resolve(AUTOENCODER_CHECKPOINT_PATH),
          "--output-dir", outputDir,
          "--resolution-stage", String(stageIndex),
        ]
        if (parent) args.push("--initial-denoiser-checkpoint", resolve(parent.checkpointPath))
        const child = await runPythonStage(args, outputDir, stageIndex)
        if (child.exitCode !== 0) throw new Error(`stage_${stageIndex}_python_training_failed`)
        const manifestPath = path.join(outputDir, "manifest.json")
        const manifest = readJson(manifestPath)
        const manifestIssues = validateStageManifest(manifest, stageIndex, parent, context)
        if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))
        const previewReview = await reviewStagePreviews(outputDir, stageIndex, context.selectedRows)
        const stageResult = {
          stageIndex,
          runId: path.basename(outputDir),
          manifestPath: projectPath(manifestPath),
          manifestSha256: sha256File(manifestPath),
          checkpointPath: manifest.checkpointPath,
          checkpointSha256: manifest.checkpointSha256,
          parentCheckpointPath: manifest.parentDenoiserCheckpointPath,
          parentCheckpointSha256: manifest.parentDenoiserCheckpointSha256,
          bestEpoch: manifest.bestEpoch,
          bestValidationMetric: manifest.bestValidationMetric,
          durationSeconds: manifest.durationSeconds,
          trainingTokenAccounting: manifest.trainingTokenAccounting,
          previewReviewPath: previewReview.reviewPath,
          previewReviewSha256: previewReview.reviewSha256,
          previewCount: previewReview.previewCount,
          previewPassCount: previewReview.previewPassCount,
          previewFailCount: previewReview.previewFailCount,
        }
        stageResults.push(stageResult)
        if (previewReview.previewCount !== REQUIRED_PREVIEW_EPOCHS.length || previewReview.previewFailCount > 0 || previewReview.previewPassCount !== REQUIRED_PREVIEW_EPOCHS.length) {
          throw new Error(`stage_${stageIndex}_preview_machine_gate_failed`)
        }
        appendEvent("stage4_training_stage_completed", "success", `R5 Stage 4 Stage ${stageIndex} completed`, `checkpoint=${manifest.checkpointSha256}; previews=${previewReview.previewPassCount}/${previewReview.previewCount}`, stageResult.manifestPath)
        parent = manifest
      }
      currentStage = null
      const report = writeFinalization("r5_stage4_full_stage0_stage1_stage2_training_completed_pending_stage5_strict_revalidation", [], { preflightReport })
      writeTerminal(report)
      appendEvent("stage4_training_completed", "success", "R5 Stage 4 full training completed and stopped", `finalCheckpoint=${stageResults.at(-1).checkpointSha256}; stage5Started=false`, report.reportPath)
      console.log(JSON.stringify(report, null, 2))
    } finally {
      releaseLock()
    }
  } catch (error) {
    const blockers = String(error?.message ?? error).split(",").filter(Boolean)
    const report = writeFinalization("r5_stage4_full_training_failed_stopped", blockers)
    writeTerminal(report)
    appendEvent("stage4_training_failed", "failed", "R5 Stage 4 full training failed and stopped", `stage=${currentStage}; ${blockers.join(",")}`, report.reportPath)
    console.error(JSON.stringify(report, null, 2))
    process.exitCode = 1
  }
}

function loadPreflightContext() {
  const authorization = readJson(AUTHORIZATION_PATH)
  const implementation = readJson(IMPLEMENTATION_CONSUMPTION_PATH)
  const inactiveConfig = readJson(INACTIVE_CONFIG_PATH)
  const compilationReport = readJson(CONFIG_COMPILATION_REPORT_PATH)
  const cpuReport = readJson(CPU_REPORT_PATH)
  const datasetManifest = readJson(DATASET_MANIFEST_PATH)
  const sourceIndex = readJson(datasetManifest?.sourceIndexPath)
  const selectedRows = (sourceIndex?.samples ?? []).filter(isV7CapacityRow)
  const selectedSplits = countSplits(selectedRows)
  const preflightConfig = activateConfig(inactiveConfig, null, true)
  return { authorization, implementation, inactiveConfig, compilationReport, cpuReport, datasetManifest, sourceIndex, selectedRows, selectedSplits, preflightConfig }
}

function validateStaticPreflight(context, hardware, disk) {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "authorization_hash_invalid")
  check(fileHashMatches(IMPLEMENTATION_CONSUMPTION_PATH, IMPLEMENTATION_CONSUMPTION_SHA256), "implementation_consumption_hash_invalid")
  check(fileHashMatches(INACTIVE_CONFIG_PATH, INACTIVE_CONFIG_SHA256), "inactive_config_hash_invalid")
  check(fileHashMatches(CONFIG_COMPILATION_REPORT_PATH, CONFIG_COMPILATION_REPORT_SHA256), "config_compilation_report_hash_invalid")
  check(fileHashMatches(DATASET_MANIFEST_PATH, DATASET_MANIFEST_SHA256), "dataset_manifest_hash_invalid")
  check(fileHashMatches(STAGE3_CLOSURE_REPORT_PATH, STAGE3_CLOSURE_REPORT_SHA256), "stage3_closure_hash_invalid")
  check(fileHashMatches(TRAINER, TRAINER_SHA256), "trainer_hash_invalid")
  check(context.authorization?.status === "resolved_owner_authorized", "authorization_not_resolved")
  check(context.authorization?.ownerDecision?.commandRef === COMMAND_REF && context.authorization?.ownerDecision?.scope === SCOPE, "authorization_identity_invalid")
  check(context.implementation?.status === "implementation_scope_consumed_before_authorized_writes_training_scope_not_consumed", "implementation_scope_not_consumed")
  check(context.inactiveConfig?.status === "r5_stage4_coverage_convergence_full_training_config_compiled_not_active", "inactive_config_status_invalid")
  check(context.compilationReport?.status === "r5_stage4_full_training_config_compiled_not_active_checkpoint_not_read_gpu_not_started", "config_compilation_status_invalid")
  check(context.cpuReport?.status === "passed_cpu_only_stage4_authorization_and_lineage_gates_checkpoint_not_read_gpu_not_started", "cpu_regression_not_passed")
  check(context.cpuReport?.inputs?.trainerSha256 === TRAINER_SHA256, "cpu_regression_trainer_identity_invalid")
  check(context.cpuReport?.inputs?.runnerSha256 === sha256File("scripts/run-ai-assisted-v7-r5-stage4-coverage-convergence-full-training.mjs"), "cpu_regression_runner_identity_invalid")
  check(context.cpuReport?.inputs?.inactiveConfigSha256 === INACTIVE_CONFIG_SHA256, "cpu_regression_config_identity_invalid")
  check(context.selectedRows.length === 64 && context.datasetManifest?.v7CapacityContributionCount === 64, "dataset_capacity_invalid")
  check(sameJson(context.selectedSplits, EXPECTED_SPLITS), "dataset_split_invalid")
  check(new Set(context.selectedRows.map((row) => row.recordId)).size === 64, "dataset_record_identity_duplicate")
  check(new Set(context.selectedRows.map((row) => row.v7CapacitySlotId)).size === 64, "dataset_slot_identity_duplicate")
  check(context.inactiveConfig?.training?.denoiserEpochs === 40, "epoch_contract_invalid")
  check(sameJson(context.inactiveConfig?.training?.resolutionStages, EXPECTED_STAGES), "resolution_contract_invalid")
  check(sameJson(context.inactiveConfig?.training?.fixedEpochPreviewPolicy?.formalStage, REQUIRED_PREVIEW_EPOCHS), "preview_contract_invalid")
  check(context.inactiveConfig?.training?.r5Stage3CheckpointContinuation?.loadingAuthorizedNow === false, "stage3_smoke_checkpoint_loading_not_closed")
  check(context.inactiveConfig?.training?.authorizedInitialization === "project_random_stage0_then_current_run_progressive_checkpoint_chain", "initialization_contract_invalid")
  check(fs.existsSync(PYTHON) && fs.existsSync(TRAINER), "local_training_runtime_missing")
  issues.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  check(disk.passed, "disk_budget_insufficient")
  check(!fs.existsSync(TRAINING_CONSUMPTION_PATH), "training_execution_authorization_already_consumed")
  return [...new Set(issues)]
}

function activateConfig(inactiveConfig, consumption, preflightOnly = false) {
  const config = structuredClone(inactiveConfig)
  config.status = preflightOnly ? "r5_stage4_full_training_read_only_preflight" : "owner_authorized_r5_stage4_full_training_active"
  config.training.trainingAuthorizationStatus = preflightOnly ? PREFLIGHT_STATUS : ACTIVE_STATUS
  config.training.stage4FullTrainingContract.status = preflightOnly ? "read_only_preflight" : "active_single_execution"
  config.training.ownerTrainingAuthorization = {
    ...config.training.ownerTrainingAuthorization,
    status: preflightOnly ? PREFLIGHT_STATUS : ACTIVE_STATUS,
    trainingExecutionConsumptionPath: consumption?.path ?? null,
    trainingExecutionConsumptionSha256: consumption?.sha256 ?? null,
    checkpointLoadingAuthorized: !preflightOnly,
    optimizerCreationAuthorized: !preflightOnly,
    modelWeightMutationAuthorized: !preflightOnly,
    gpuTrainingAuthorizedNow: !preflightOnly,
    fullTrainingAuthorized: !preflightOnly,
    singleSampleGpuOverfitSmokeAuthorized: false,
    automaticRetryAuthorized: false,
    strictRevalidationAuthorized: false,
    validationAuthorized: false,
    formalInferenceAuthorized: false,
    checkpointPromotionAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  }
  config.training.r5Stage3CheckpointContinuation.loadingAuthorizedNow = false
  return config
}

function runPythonPreflight(config) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-pet-v7-r5-stage4-preflight-"))
  const temporaryConfigPath = path.join(temporaryRoot, "preflight-config.json")
  const unusedOutputPath = path.join(temporaryRoot, "unused-output")
  try {
    fs.writeFileSync(temporaryConfigPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    return spawnSync(PYTHON, [TRAINER,
      "--config", temporaryConfigPath,
      "--dataset-package", resolve(DATASET_MANIFEST_PATH),
      "--autoencoder-checkpoint", resolve(AUTOENCODER_CHECKPOINT_PATH),
      "--output-dir", unusedOutputPath,
      "--resolution-stage", "0",
      "--preflight-only",
    ], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: pythonEnv(), windowsHide: true })
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

function consumeTrainingExecution(preflightReport) {
  const target = resolve(TRAINING_CONSUMPTION_PATH)
  const record = {
    schemaVersion: "project-owner-stage4-training-execution-authorization-consumption-v1",
    status: "training_execution_scope_consumed_after_all_preflights_passed",
    requestId: REQUEST_ID,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION_PATH,
    implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
    commandRef: COMMAND_REF,
    scope: SCOPE,
    consumedAtUtc: new Date().toISOString(),
    consumedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    chainId,
    allowedTrainingExecutionCount: 1,
    allPreflightsPassed: true,
    preflightReportPath: projectPath(preflightReportPath),
    preflightReportSha256: sha256File(preflightReportPath),
    cpuReportPath: CPU_REPORT_PATH,
    cpuReportSha256: sha256File(CPU_REPORT_PATH),
    trainerSha256: TRAINER_SHA256,
    runnerSha256: sha256File("scripts/run-ai-assisted-v7-r5-stage4-coverage-convergence-full-training.mjs"),
    inactiveConfigSha256: INACTIVE_CONFIG_SHA256,
    stageOrder: [0, 1, 2],
    automaticRetryAuthorized: false,
    strictRevalidationAuthorized: false,
    formalInferenceAuthorized: false,
    checkpointFormalPromotionAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  }
  writeImmutableJson(target, record)
  return { ...record, path: TRAINING_CONSUMPTION_PATH, sha256: sha256File(target) }
}

function validateStageManifest(manifest, stageIndex, parent, context) {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(manifest?.status === "conditional_denoiser_training_completed_pending_validation", `stage_${stageIndex}_status_invalid`)
  check(manifest?.architectureVersion === "all-validation-multiseed-semantic-rollout-unet-v7-repair-r5-stage4-coverage-convergence-full-training", `stage_${stageIndex}_architecture_invalid`)
  check(manifest?.datasetPackageId === context.datasetManifest.packageId, `stage_${stageIndex}_dataset_invalid`)
  check(manifest?.actualLoadedConditionalSampleCount === 64 && manifest?.actualLoadedV7CapacityCount === 64, `stage_${stageIndex}_capacity_invalid`)
  check(sameJson(manifest?.actualLoadedSplitCounts, EXPECTED_SPLITS), `stage_${stageIndex}_split_invalid`)
  check(sameJson(manifest?.resolutionStage, EXPECTED_STAGES[stageIndex]), `stage_${stageIndex}_resolution_invalid`)
  check(stageIndex === 0 ? manifest?.parentDenoiserCheckpointSha256 == null : manifest?.parentDenoiserCheckpointSha256 === parent?.checkpointSha256, `stage_${stageIndex}_parent_invalid`)
  check(stageIndex === 0 ? manifest?.initialization === "project_autoencoder_checkpoint_plus_project_random_multiscale_denoiser" : manifest?.initialization === "project_autoencoder_checkpoint_plus_project_denoiser_checkpoint_resume", `stage_${stageIndex}_initialization_invalid`)
  check(manifest?.denoiserTrained === true && manifest?.formalInferenceEligible === false, `stage_${stageIndex}_formal_boundary_invalid`)
  check(manifest?.metrics?.at(-1)?.epoch === 40, `stage_${stageIndex}_epoch_count_invalid`)
  check(manifest?.trainingTokenAccounting?.schemaVersion === "ai-assisted-local-training-token-accounting-v1", `stage_${stageIndex}_token_accounting_missing`)
  check(fileHashMatches(manifest?.checkpointPath, manifest?.checkpointSha256), `stage_${stageIndex}_checkpoint_hash_invalid`)
  return issues
}

async function reviewStagePreviews(outputDir, stageIndex, selectedRows) {
  const previewRoot = path.join(outputDir, "fixed-epoch-previews")
  const files = fs.existsSync(previewRoot) ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort() : []
  const epochs = files.map((file) => Number(file.match(/^epoch-(\d+)/)?.[1] ?? 0))
  if (!sameJson(epochs, REQUIRED_PREVIEW_EPOCHS)) throw new Error(`stage_${stageIndex}_fixed_preview_identity_invalid`)
  const reviews = []
  for (const file of files) {
    const epoch = Number(file.match(/^epoch-(\d+)/)?.[1] ?? 0)
    const previewPath = path.join(previewRoot, file)
    const row = selectedRows.find((item) => file.includes(item.conditionLabel))
    if (!row) throw new Error(`stage_${stageIndex}_preview_condition_identity_missing`)
    const normalizedPath = path.join(outputDir, "fixed-preview-review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    const normalized = await normalizePreviewWithWindowsSafeIo({
      sourcePath: previewPath,
      finalAssetPath: normalizedPath,
      workRoot: resolve(".runtime/ai-painter/r5s4-review-work"),
      workId: `s${stageIndex}-${sha256Text(chainId).slice(0, 16)}`,
      epoch,
    })
    const conditionPack = readJson(row.conditionPackPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalized.shortOutputPath),
      auditAiAssistedConditionAlignment({
        record: { recordId: `${chainId}-stage-${stageIndex}-${file}`, conditionBinding: { conditionPackPath: row.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: row.classification },
        imagePath: normalized.shortOutputPath,
        referenceImagePath: row.imagePath,
      }),
    ])
    reviews.push({
      epoch,
      previewPath: projectPath(previewPath),
      previewSha256: normalized.sourceSha256,
      normalizedPath: projectPath(normalizedPath),
      normalizedSha256: normalized.normalizedSha256,
      windowsSafeShortPathIo: true,
      nativeInputPathLength: normalized.shortInputPath.length,
      nativeOutputPathLength: normalized.shortOutputPath.length,
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  const report = {
    schemaVersion: "ai-assisted-v7-r5-stage4-stage-fixed-preview-reviews-v1",
    status: reviews.every((item) => item.passed) ? "machine_reviews_passed" : "machine_reviews_failed_closed",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    chainId,
    stageIndex,
    requiredPreviewEpochs: REQUIRED_PREVIEW_EPOCHS,
    reviewThresholdsChanged: false,
    formalCandidate: false,
    reviews,
    previewCount: reviews.length,
    previewPassCount: reviews.filter((item) => item.passed).length,
    previewFailCount: reviews.filter((item) => !item.passed).length,
    nextStageStarted: false,
  }
  const reviewPath = path.join(outputDir, "fixed-preview-reviews.json")
  writeImmutableJson(reviewPath, report)
  return { ...report, reviewPath: projectPath(reviewPath), reviewSha256: sha256File(reviewPath) }
}

function runPythonStage(args, outputDir, stageIndex) {
  return new Promise((complete) => {
    const child = spawn(PYTHON, args, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    currentChild = child
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8") })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); process.stderr.write(chunk) })
    const timer = setInterval(() => {
      const progress = readJson(path.join(outputDir, "progress.json"))
      const gpu = hardwareSnapshot().gpu
      console.log(JSON.stringify({ kind: "stage4_training_heartbeat", chainId, stageIndex, epoch: progress?.currentEpoch?.epoch ?? progress?.latestMetric?.epoch ?? null, status: progress?.status ?? "starting", gpuUtilizationPercent: gpu.utilizationPercent, gpuMemoryUsedMiB: gpu.memoryUsedMiB, timestampUtc: new Date().toISOString() }))
    }, 20000)
    child.on("error", (error) => { stderr += error.stack || error.message })
    child.on("close", (exitCode, signal) => {
      clearInterval(timer)
      currentChild = null
      complete({ exitCode, signal, stdout, stderr })
    })
  })
}

function writeFinalization(status, blockers, extra = {}) {
  const reportPath = path.join(FINALIZATION_ROOT, `${chainId}-finalization`, "finalization-report.json")
  if (fs.existsSync(reportPath)) return { ...readJson(reportPath), reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
  const totalTokens = stageResults.reduce((sum, row) => sum + Number(row.trainingTokenAccounting?.runTotals?.latentSpatialTokens ?? 0), 0)
  const report = {
    schemaVersion: "ai-assisted-v7-r5-stage4-full-training-finalization-v1",
    status,
    chainId,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    implementationConsumptionPath: IMPLEMENTATION_CONSUMPTION_PATH,
    implementationConsumptionSha256: IMPLEMENTATION_CONSUMPTION_SHA256,
    trainingConsumptionPath: trainingConsumption?.path ?? null,
    trainingConsumptionSha256: trainingConsumption?.sha256 ?? null,
    preflightReportPath: fs.existsSync(preflightReportPath) ? projectPath(preflightReportPath) : null,
    preflightReportSha256: fs.existsSync(preflightReportPath) ? sha256File(preflightReportPath) : null,
    derivedConfigPath: fs.existsSync(derivedConfigPath) ? projectPath(derivedConfigPath) : null,
    derivedConfigSha256: fs.existsSync(derivedConfigPath) ? sha256File(derivedConfigPath) : null,
    datasetManifestPath: DATASET_MANIFEST_PATH,
    datasetManifestSha256: DATASET_MANIFEST_SHA256,
    stageResults,
    completedStageCount: stageResults.length,
    currentStageAtFailure: currentStage,
    finalCheckpointPath: stageResults.length === 3 ? stageResults.at(-1).checkpointPath : null,
    finalCheckpointSha256: stageResults.length === 3 ? stageResults.at(-1).checkpointSha256 : null,
    localLatentSpatialTokenTotal: totalTokens,
    externalApiTokens: 0,
    hardware: { before: hardwareBefore, after: hardwareSnapshot() },
    blockers,
    stage4Closed: true,
    stage5Started: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointFormallyPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticRetryStarted: false,
    ...extra,
  }
  writeImmutableJson(reportPath, report)
  return { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
}

function writeTerminal(report) {
  if (fs.existsSync(terminalPath)) return
  writeImmutableJson(terminalPath, {
    schemaVersion: "ai-assisted-v7-r5-stage4-full-training-terminal-v1",
    status: report.status,
    chainId,
    registeredAtUtc: report.createdAtUtc,
    registeredAtAsiaShanghai: report.createdAtAsiaShanghai,
    finalizationReportPath: report.reportPath,
    finalizationReportSha256: report.reportSha256,
    completedStageCount: report.completedStageCount,
    finalCheckpointPath: report.finalCheckpointPath,
    finalCheckpointSha256: report.finalCheckpointSha256,
    blockers: report.blockers,
    stage4Closed: true,
    stage5Started: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointFormallyPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticRetryStarted: false,
  })
}

function acquireLock() {
  fs.mkdirSync(MODEL_ROOT, { recursive: true })
  const handle = fs.openSync(LOCK_PATH, "wx")
  fs.writeFileSync(handle, `${JSON.stringify({ schemaVersion: "ai-assisted-v7-r5-stage4-full-training-lock-v1", pid: process.pid, chainId, createdAtUtc: new Date().toISOString() }, null, 2)}\n`)
  fs.closeSync(handle)
  return () => {
    if (!fs.existsSync(LOCK_PATH)) return
    const lock = readJson(LOCK_PATH)
    if (lock?.pid === process.pid && lock?.chainId === chainId) fs.unlinkSync(LOCK_PATH)
  }
}

function diskBudgetSnapshot() {
  const referenceRoot = resolve(".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r1")
  const referenceBytes = fs.existsSync(referenceRoot)
    ? fs.readdirSync(referenceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("ai-assisted-v7-repair-r1-stage-"))
      .reduce((sum, entry) => sum + directoryBytes(path.join(referenceRoot, entry.name)), 0)
    : 0
  const requiredFreeBytes = Math.max(1024 ** 3, referenceBytes * 4)
  const stat = fs.statfsSync(ROOT)
  const freeBytes = Number(stat.bavail) * Number(stat.bsize)
  return { referenceBytes, safetyMultiplier: 4, minimumFloorBytes: 1024 ** 3, requiredFreeBytes, freeBytes, passed: freeBytes >= requiredFreeBytes }
}

function hardwareSnapshot() {
  const gpu = spawnSync("nvidia-smi", ["--query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const processes = spawnSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const rows = processes.status === 0 ? processes.stdout.split(/\r?\n/).filter(Boolean) : []
  const values = gpu.status === 0 ? gpu.stdout.trim().split(",").map((value) => value.trim()) : []
  return { recordedAtUtc: new Date().toISOString(), cpu: { model: os.cpus()[0]?.model ?? null, logicalProcessors: os.cpus().length }, memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() }, gpu: { available: gpu.status === 0, name: values[0] ?? null, driverVersion: values[1] ?? null, memoryTotalMiB: Number(values[2] ?? 0), memoryUsedMiB: Number(values[3] ?? 0), utilizationPercent: Number(values[4] ?? 0), temperatureC: Number(values[5] ?? 0), pythonComputeProcessCount: rows.filter((row) => /python/i.test(row)).length, computeProcesses: rows } }
}

function appendEvent(kind, status, title, detail, evidencePath = null) {
  appendAiPainterProgramEvent({ action: "run_ai_assisted_v7_r5_stage4_full_training", runId: chainId, kind, status, title, titleZh: title, detail, detailZh: detail, script: "scripts/run-ai-assisted-v7-r5-stage4-coverage-convergence-full-training.mjs", currentStep: currentStage == null ? "r5_stage4_full_training" : `r5_stage4_stage_${currentStage}`, evidencePath, finalGameMapSuccess: false, canEnterWorld: false })
}

function inactiveBoundary() { return { stage3SmokeCheckpointFileRead: false, autoencoderCheckpointFileRead: false, checkpointLoaded: false, optimizerCreated: false, modelWeightsModified: false, gpuTrainingStarted: false, automaticRetryStarted: false, strictRevalidationStarted: false, formalInferenceStarted: false, checkpointFormallyPromoted: false, runtimeFrameStarted: false, worldEntered: false } }
function isV7CapacityRow(row) { return row?.categoryId === "complete-maps" && row?.trainingRoles?.includes("conditional_denoiser") && row?.formalConditionalTrainingEligible === true && row?.conditionBound === true && row?.v7CapacityContributionRegistered === true && row?.ownerReviewStatus === "owner_approved" && row?.machineReviewStatus === "passed" && row?.aiAssistedColdStartEligible === true && row?.independentTrainingEligible === false }
function countSplits(rows) { return Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])) }
function directoryBytes(root) { return fs.readdirSync(root, { withFileTypes: true }).reduce((sum, entry) => { const child = path.join(root, entry.name); return sum + (entry.isDirectory() ? directoryBytes(child) : (entry.isFile() ? fs.statSync(child).size : 0)) }, 0) }
function readJson(value) { try { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) } catch { return null } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function sha256Text(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return Boolean(value && expected && fs.existsSync(absolute) && sha256File(absolute) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: resolve("ml/ai-painter/src") } }
function writeImmutableJson(value, body) { const absolute = resolve(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); const handle = fs.openSync(absolute, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
