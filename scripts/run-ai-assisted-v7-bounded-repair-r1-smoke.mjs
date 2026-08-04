import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath as eventProjectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const OVERLAY_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r1-training-overlay.json"
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r1-resolution-20260802/request.json"
const AUTHORIZATION_SHA256 = "62cd42d18dad88f142643c7a5b5df82d8ae4a1925646e0aa856c9af65b6199fa"
const AUTHORIZATION_COMMAND = "owner-authorized-v7-bounded-repair-r1-diagnostics-implementation-single-stage0-smoke-20260802"
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const MODEL_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-conditional-denoiser-v7-repair-r1")
const FINALIZATION_ROOT = path.join(ROOT, ".runtime", "ai-painter", "v7-bounded-repair-r1-smoke-finalizations")
const preflightOnly = process.argv.includes("--preflight-only")
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const runId = `ai-assisted-v7-bounded-repair-r1-${preflightOnly ? "preflight" : "stage-0-smoke"}-${suffix}`
const runDir = path.join(MODEL_ROOT, runId)
const derivedConfigPath = path.join(MODEL_ROOT, "derived-configs", `${runId}.json`)
const lockPath = path.join(MODEL_ROOT, ".single-smoke.lock")

const overlay = readJson(OVERLAY_PATH)
const authorization = readJson(AUTHORIZATION_PATH)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = readJson(datasetPointer?.manifestPath)
const sourceIndex = readJson(datasetManifest?.sourceIndexPath)
const autoencoderPointer = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const baseConfig = readJson(overlay?.baseConfigPath)
const diagnostic = readJson(overlay?.diagnosticReportPath)
const contractPath = authorization?.taskIdentity?.repairContractPath
const contract = readJson(contractPath)
const derivedConfig = deepMerge(baseConfig, overlay?.patch)
const selectedRows = (sourceIndex?.samples ?? []).filter(isV7CapacityRow)
const selectedSplits = countSplits(selectedRows)
let child = null
let manifest = null
let hardwareBefore = null
let hardwareAfter = null
const blockers = validatePreflight()

appendEvent("training_preflight_started", "running", "V7 bounded repair R1 preflight started", `preflightOnly=${preflightOnly}; selectedRows=${selectedRows.length}; split=${JSON.stringify(selectedSplits)}`)

if (blockers.length > 0) {
  const report = writeTerminalReport("blocked", blockers, null, null)
  appendEvent("training_run_blocked", "blocked", "V7 bounded repair R1 was blocked before GPU execution", blockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}

if (preflightOnly) {
  writeJson(derivedConfigPath, derivedConfig)
  child = spawnSync(PYTHON, [
    TRAINER,
    "--config", derivedConfigPath,
    "--dataset-package", path.resolve(ROOT, datasetPointer.manifestPath),
    "--autoencoder-checkpoint", path.resolve(ROOT, autoencoderPointer.checkpointPath),
    "--output-dir", runDir,
    "--resolution-stage", "0",
    "--smoke-test",
    "--preflight-only",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
  })
  if (child.status !== 0) {
    const report = writeTerminalReport("blocked", ["python_training_contract_preflight_failed"], null, null)
    appendEvent("training_run_blocked", "blocked", "V7 bounded repair R1 Python preflight failed", child.stderr || "unknown Python preflight error", report.reportPath)
    console.error(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  const report = writeTerminalReport("preflight_passed_gpu_not_started", [], null, null)
  appendEvent("training_preflight_completed", "success", "V7 bounded repair R1 preflight passed", "GPU was not started; one Stage 0 Smoke remains authorized.", report.reportPath)
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

fs.mkdirSync(MODEL_ROOT, { recursive: true })
let lockHandle
try {
  lockHandle = fs.openSync(lockPath, "wx")
} catch {
  const report = writeTerminalReport("blocked", ["v7_bounded_repair_r1_smoke_lock_is_active"], null, null)
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}

try {
  writeJson(derivedConfigPath, derivedConfig)
  hardwareBefore = hardwareSnapshot()
  appendEvent("training_run_started", "running", "V7 bounded repair R1 single Stage 0 Smoke started", "New random Stage 0 lineage; one epoch and one train batch; no parent checkpoint.", projectPath(derivedConfigPath))
  const args = [
    TRAINER,
    "--config", derivedConfigPath,
    "--dataset-package", path.resolve(ROOT, datasetPointer.manifestPath),
    "--autoencoder-checkpoint", path.resolve(ROOT, autoencoderPointer.checkpointPath),
    "--output-dir", runDir,
    "--resolution-stage", "0",
    "--smoke-test",
  ]
  child = spawnSync(PYTHON, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") },
  })
  hardwareAfter = hardwareSnapshot()
  if (child.status !== 0) throw new Error("v7_bounded_repair_r1_python_smoke_failed")
  manifest = readJson(path.join(runDir, "manifest.json"))
  const manifestIssues = validateSmokeManifest(manifest)
  if (manifestIssues.length > 0) throw new Error(manifestIssues.join(","))

  const previewPath = findSinglePreview()
  const normalizedPreviewPath = path.join(ROOT, ".runtime", "ai-painter", "v7-r1-preview-review-assets", `${sha256File(previewPath).slice(0, 16)}-1024x768-nearest.png`)
  fs.mkdirSync(path.dirname(normalizedPreviewPath), { recursive: true })
  await sharp(previewPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPreviewPath)
  const aesthetic = await auditAiAssistedProfessionalAesthetic(normalizedPreviewPath)
  const previewRow = selectedRows.find((row) => path.basename(previewPath).includes(row.conditionLabel))
  if (!previewRow) throw new Error("fixed_epoch_preview_condition_identity_missing")
  const conditionPack = readJson(previewRow.conditionPackPath)
  const alignment = await auditAiAssistedConditionAlignment({
    record: {
      recordId: `${runId}-fixed-preview`,
      conditionBinding: { conditionPackPath: previewRow.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick },
      classification: previewRow.classification,
    },
    imagePath: normalizedPreviewPath,
  })
  const previewMachinePassed = aesthetic.passed && alignment.passed
  const previewReview = {
    schemaVersion: "ai-assisted-v7-bounded-repair-r1-stage-preview-review-v1",
    status: previewMachinePassed ? "machine_review_completed_passed" : "machine_review_completed_failed_quality_diagnostic",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    runId,
    stage: 0,
    epoch: 1,
    previewPath: projectPath(previewPath),
    previewSha256: sha256File(previewPath),
    normalizedReviewImagePath: projectPath(normalizedPreviewPath),
    normalizedReviewImageSha256: sha256File(normalizedPreviewPath),
    reviewResolution: { width: 1024, height: 768 },
    resizeKernel: "nearest",
    formalCandidate: false,
    thresholdPolicy: "unchanged_owner_calibrated_professional_aesthetic_envelope",
    professionalAesthetic: aesthetic,
    conditionAlignment: alignment,
    interpretation: "Smoke verifies the repaired program path. Preview quality is evidence only and cannot promote a model.",
    automaticStorage: true,
  }
  const previewReviewPath = path.join(runDir, "fixed-preview-review.json")
  writeJson(previewReviewPath, previewReview)

  const outcome = writeTerminalReport("stage0_smoke_program_passed_stopped", [], manifest, {
    before: hardwareBefore,
    after: hardwareAfter,
    previewReviewPath: projectPath(previewReviewPath),
    previewReviewSha256: sha256File(previewReviewPath),
    previewMachinePassed,
  })
  writeJson(path.join(MODEL_ROOT, "latest-program-check.json"), {
    schemaVersion: "ai-assisted-v7-bounded-repair-r1-latest-smoke-v1",
    status: outcome.status,
    runId,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    overlayPath: OVERLAY_PATH,
    overlaySha256: sha256File(OVERLAY_PATH),
    manifestPath: projectPath(path.join(runDir, "manifest.json")),
    manifestSha256: sha256File(path.join(runDir, "manifest.json")),
    reportPath: outcome.reportPath,
    reportSha256: outcome.reportSha256,
    previewReviewPath: projectPath(previewReviewPath),
    previewReviewSha256: sha256File(previewReviewPath),
    fullTrainingAuthorized: false,
    formalInferenceEligible: false,
    canEnterWorld: false,
  })
  const ownerRequest = writeNextOwnerRequest(outcome, previewReview)
  indexTree(runDir)
  appendEvent("training_run_completed", "success", "V7 bounded repair R1 single Stage 0 Smoke completed and stopped", `previewMachinePassed=${previewMachinePassed}; fullTrainingStarted=false; nextOwnerRequest=${ownerRequest.requestId}`, outcome.reportPath)
  console.log(JSON.stringify({ ...outcome, previewReview, nextOwnerRequest: ownerRequest }, null, 2))
} catch (error) {
  hardwareAfter ??= hardwareSnapshot()
  const reasons = String(error?.message ?? error).split(",").filter(Boolean)
  const outcome = writeTerminalReport("stage0_smoke_failed_return_to_phase_d", reasons, manifest, { before: hardwareBefore, after: hardwareAfter })
  indexTree(runDir)
  appendEvent("training_run_failed", "failed", "V7 bounded repair R1 single Stage 0 Smoke failed", reasons.join(","), outcome.reportPath)
  console.error(JSON.stringify(outcome, null, 2))
  process.exitCode = 1
} finally {
  if (lockHandle !== undefined) fs.closeSync(lockHandle)
  if (fs.existsSync(lockPath)) fs.rmSync(lockPath)
}

function validatePreflight() {
  const issues = []
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "bounded_repair_authorization_hash_invalid")
  check(authorization?.status === "resolved_owner_authorized", "bounded_repair_authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === AUTHORIZATION_COMMAND, "bounded_repair_authorization_command_invalid")
  check(authorization?.resolution?.boundedDiagnosticsAuthorized === true, "bounded_diagnostics_not_authorized")
  check(authorization?.resolution?.repairImplementationAuthorized === true, "repair_implementation_not_authorized")
  check(authorization?.resolution?.singleStage0SmokeAuthorized === true, "single_stage0_smoke_not_authorized")
  for (const key of ["fullTrainingAuthorized", "revalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    check(authorization?.resolution?.[key] === false, `authorization_boundary_${key}_invalid`)
  }
  check(fileHashMatches(overlay?.baseConfigPath, overlay?.baseConfigSha256), "base_config_hash_invalid")
  check(fileHashMatches(overlay?.authorizationPath, overlay?.authorizationSha256), "overlay_authorization_hash_invalid")
  check(fileHashMatches(overlay?.diagnosticReportPath, overlay?.diagnosticReportSha256), "diagnostic_report_hash_invalid")
  check(fileHashMatches(contractPath, authorization?.taskIdentity?.repairContractSha256), "repair_contract_hash_invalid")
  check(contract?.phaseESmokeGate?.trainingScope === "one_new_stage0_smoke_only", "repair_contract_smoke_scope_invalid")
  check(diagnostic?.status === "bounded_diagnostics_completed_repair_implementation_required", "bounded_diagnostics_not_completed")
  check(datasetManifest?.v7CapacityContributionCount === 64, "dataset_capacity_count_invalid")
  check(datasetManifest?.canTrainConditionalDenoiser === true, "dataset_conditional_gate_closed")
  check(datasetManifest?.formalInferenceEligible === false, "dataset_formal_inference_boundary_invalid")
  check(selectedRows.length === 64, "actual_v7_loaded_row_count_invalid")
  check(sameJson(selectedSplits, EXPECTED_SPLITS), "actual_v7_loaded_split_invalid")
  check(new Set(selectedRows.map((row) => row.recordId)).size === 64, "actual_v7_record_id_duplicate")
  check(new Set(selectedRows.map((row) => row.v7CapacitySlotId)).size === 64, "actual_v7_capacity_slot_duplicate")
  check(derivedConfig?.training?.boundedRepairVersion === "v7_bounded_repair_r1", "derived_repair_version_invalid")
  check(derivedConfig?.architectureVersion === "all-validation-multiseed-semantic-rollout-unet-v7-repair-r1", "derived_architecture_version_invalid")
  check(derivedConfig?.conditionChannels === 23, "condition_channel_count_invalid")
  check(Array.isArray(derivedConfig?.conditionChannelOrder) && derivedConfig.conditionChannelOrder.length === 23, "condition_channel_order_invalid")
  check(autoencoderPointer?.checkpointPath && fileHashMatches(autoencoderPointer.checkpointPath, autoencoderPointer.checkpointSha256), "approved_autoencoder_checkpoint_invalid")
  check(fs.existsSync(PYTHON), "local_python_runtime_missing")
  check(fs.existsSync(TRAINER), "training_program_missing")
  if (!preflightOnly) {
    const previous = readJson(path.join(MODEL_ROOT, "latest-program-check.json"))
    check(!(previous?.status === "stage0_smoke_program_passed_stopped" && previous?.authorizationSha256 === AUTHORIZATION_SHA256 && previous?.overlaySha256 === sha256File(OVERLAY_PATH)), "authorized_single_smoke_already_completed")
  }
  return issues

  function check(condition, code) { if (!condition) issues.push(code) }
}

function validateSmokeManifest(value) {
  const issues = []
  check(value?.status === "conditional_denoiser_program_smoke_test_passed", "smoke_manifest_status_invalid")
  check(value?.modelId === derivedConfig.modelId, "smoke_model_identity_invalid")
  check(value?.architectureVersion === derivedConfig.architectureVersion, "smoke_architecture_identity_invalid")
  check(value?.datasetPackageId === datasetManifest.packageId, "smoke_dataset_identity_invalid")
  check(value?.actualLoadedConditionalSampleCount === 64 && value?.actualLoadedV7CapacityCount === 64, "smoke_actual_capacity_invalid")
  check(sameJson(value?.actualLoadedSplitCounts, EXPECTED_SPLITS), "smoke_actual_split_invalid")
  check(value?.conditionChannels === 23, "smoke_condition_channel_count_invalid")
  check(value?.resolutionStage?.width === 256 && value?.resolutionStage?.height === 192, "smoke_resolution_stage_invalid")
  check(value?.parentDenoiserCheckpointPath == null && value?.parentDenoiserCheckpointSha256 == null, "smoke_old_checkpoint_was_used_as_parent")
  check(value?.denoiserTrained === false && value?.formalInferenceEligible === false, "smoke_formal_boundary_invalid")
  check(value?.trainingStage === "conditional_denoiser_smoke_test", "smoke_training_stage_invalid")
  check(value?.bestEpoch === 1, "smoke_epoch_count_invalid")
  check(value?.denoiserLossVersion === derivedConfig.training.denoiserLossVersion, "smoke_loss_contract_invalid")
  check(value?.bestCheckpointMetric === derivedConfig.training.bestCheckpointMetric, "smoke_checkpoint_metric_invalid")
  check(fileHashMatches(value?.checkpointPath, value?.checkpointSha256), "smoke_checkpoint_hash_invalid")
  check(value?.trainingTokenAccounting?.schemaVersion === "ai-assisted-local-training-token-accounting-v1", "smoke_token_accounting_missing")
  return issues
  function check(condition, code) { if (!condition) issues.push(code) }
}

function findSinglePreview() {
  const previewRoot = path.join(runDir, "fixed-epoch-previews")
  const previews = fs.existsSync(previewRoot) ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")) : []
  if (previews.length !== 1) throw new Error(`fixed_epoch_preview_count_invalid_${previews.length}`)
  return path.join(previewRoot, previews[0])
}

function writeTerminalReport(status, blockers, currentManifest, extra) {
  const reportId = `ai-assisted-v7-bounded-repair-r1-smoke-finalization-${suffix}`
  const reportDir = path.join(FINALIZATION_ROOT, reportId)
  const reportPath = path.join(reportDir, "finalization-report.json")
  const report = {
    schemaVersion: "ai-assisted-v7-bounded-repair-r1-smoke-finalization-v1",
    reportId,
    status,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    runId,
    preflightOnly,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    overlayPath: OVERLAY_PATH,
    overlaySha256: fs.existsSync(resolvePath(OVERLAY_PATH)) ? sha256File(OVERLAY_PATH) : null,
    repairContractPath: contractPath ?? null,
    repairContractSha256: contractPath && fs.existsSync(resolvePath(contractPath)) ? sha256File(contractPath) : null,
    diagnosticReportPath: overlay?.diagnosticReportPath ?? null,
    diagnosticReportSha256: overlay?.diagnosticReportSha256 ?? null,
    datasetPackageId: datasetManifest?.packageId ?? null,
    actualLoadedV7CapacityCount: selectedRows.length,
    actualLoadedSplitCounts: selectedSplits,
    derivedConfigPath: fs.existsSync(derivedConfigPath) ? projectPath(derivedConfigPath) : null,
    derivedConfigSha256: fs.existsSync(derivedConfigPath) ? sha256File(derivedConfigPath) : null,
    manifestPath: currentManifest ? projectPath(path.join(runDir, "manifest.json")) : null,
    checkpointPath: currentManifest?.checkpointPath ?? null,
    checkpointSha256: currentManifest?.checkpointSha256 ?? null,
    trainingTokenAccounting: currentManifest?.trainingTokenAccounting ?? null,
    hardware: extra?.before || extra?.after ? { before: extra?.before ?? null, after: extra?.after ?? null } : null,
    fixedPreviewReviewPath: extra?.previewReviewPath ?? null,
    fixedPreviewReviewSha256: extra?.previewReviewSha256 ?? null,
    fixedPreviewMachinePassed: extra?.previewMachinePassed ?? null,
    blockers,
    process: child ? { exitCode: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr } : null,
    fullTrainingStarted: false,
    revalidationStarted: false,
    formalCandidateCreated: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    nextClosedLoopNode: status === "stage0_smoke_program_passed_stopped" ? "owner_authorization_for_full_stage0_stage1_stage2_training" : (preflightOnly ? "run_one_new_stage0_smoke" : "phase_d_repair_design"),
    automaticStorage: true,
  }
  writeJson(reportPath, report)
  writeJson(path.join(FINALIZATION_ROOT, "latest.json"), { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) })
  indexTree(reportDir)
  return { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
}

function writeNextOwnerRequest(outcome, previewReview) {
  const requestId = `owner-action-request-v7-repair-r1-full-training-${suffix.toLowerCase()}`
  const requestPath = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", requestId, "request.json")
  const request = {
    schemaVersion: "ai-painter-owner-action-request-v1",
    requestId,
    subsystem: "ai_painter_v7_bounded_repair_r1",
    status: "waiting_owner_authorization",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_pet_world_program",
    systemOfRecord: "local_immutable_files_plus_sqlite_index",
    taskIdentity: {
      modelId: derivedConfig.modelId,
      architectureVersion: derivedConfig.architectureVersion,
      datasetPackageId: datasetManifest.packageId,
      smokeRunId: runId,
      smokeFinalizationPath: outcome.reportPath,
      smokeFinalizationSha256: outcome.reportSha256,
      previewMachinePassed: previewReview.status === "machine_review_completed_passed",
    },
    ownerVisibleConclusionZh: "V7 修复版一次 Stage 0 Smoke 已完成并自动停止；尚未启动完整训练。",
    localSystemFindingZh: "程序、64 条数据绑定、48/8/4/4 切分、新随机 Stage 0 血统、固定预览、机器审查、Token 与硬件记录均已形成证据。Smoke 预览质量仅作诊断，不构成正式模型通过。",
    blockingReasonCode: "waiting_owner_authorization_v7_repair_r1_full_training",
    minimumRequestedActionZh: "如需继续，请项目所有者单独决定是否授权 V7 修复版完整 Stage 0→1→2 训练；该决定不自动包含严格复验、正式推理、RuntimeFrame 或进入世界。",
    invariants: ["dataset_64_split_48_8_4_4", "condition_channels_23", "old_failed_checkpoint_never_resumed", "review_thresholds_unchanged"],
    forbiddenActions: ["strict_challenge_revalidation", "formal_model_promotion", "formal_image_generation", "runtime_frame", "world_entry"],
    resolution: {
      fullTrainingAuthorized: false,
      revalidationAuthorized: false,
      formalInferenceAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
    automaticStorage: true,
  }
  writeJson(requestPath, request)
  indexTree(path.dirname(requestPath))
  appendEvent("owner_action_request_recorded", "blocked", "V7 repair R1 full training requires a separate owner decision", request.blockingReasonCode, projectPath(requestPath))
  return { ...request, requestPath: projectPath(requestPath), requestSha256: sha256File(requestPath) }
}

function appendEvent(kind, status, title, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "run_ai_assisted_v7_bounded_repair_r1_smoke",
    runId,
    kind,
    status,
    title,
    titleZh: title,
    detail,
    detailZh: detail,
    script: "scripts/run-ai-assisted-v7-bounded-repair-r1-smoke.mjs",
    currentStep: "v7_bounded_repair_r1_stage0_smoke",
    finalGameMapSuccess: false,
    canEnterWorld: false,
    evidencePath: evidencePath ? eventProjectPath(evidencePath) : null,
  })
}

function hardwareSnapshot() {
  const gpu = spawnSync("nvidia-smi", ["--query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8" })
  return {
    recordedAtUtc: new Date().toISOString(),
    cpu: { model: os.cpus()[0]?.model ?? null, logicalProcessors: os.cpus().length, loadAverage: os.loadavg() },
    memory: { totalBytes: os.totalmem(), freeBytes: os.freemem(), usedBytes: os.totalmem() - os.freemem() },
    gpu: gpu.status === 0 ? parseGpu(gpu.stdout.trim()) : { available: false, error: gpu.stderr || gpu.error?.message || "nvidia-smi failed" },
  }
}

function parseGpu(line) {
  const [name, driverVersion, memoryTotalMiB, memoryUsedMiB, utilizationPercent, temperatureC] = line.split(",").map((value) => value.trim())
  return { available: true, name, driverVersion, memoryTotalMiB: Number(memoryTotalMiB), memoryUsedMiB: Number(memoryUsedMiB), utilizationPercent: Number(utilizationPercent), temperatureC: Number(temperatureC) }
}

function isV7CapacityRow(row) {
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
  return Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length]))
}

function deepMerge(base, patch) {
  if (Array.isArray(patch)) return structuredClone(patch)
  if (!patch || typeof patch !== "object") return patch === undefined ? structuredClone(base) : patch
  const result = base && typeof base === "object" && !Array.isArray(base) ? structuredClone(base) : {}
  for (const [key, value] of Object.entries(patch)) result[key] = deepMerge(result[key], value)
  return result
}

function readJson(value) {
  try { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) } catch { return null }
}
function writeJson(valuePath, value) {
  const absolute = resolvePath(valuePath)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`)
  indexFile(absolute)
}
function indexTree(rootPath) {
  if (!rootPath || !fs.existsSync(rootPath)) return
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const child = path.join(rootPath, entry.name)
    if (entry.isDirectory()) indexTree(child)
    else if (entry.isFile()) indexFile(child)
  }
}
function indexFile(filePath) {
  const absolute = resolvePath(filePath)
  const info = fs.statSync(absolute)
  indexArtifact({ logicalPath: projectPath(absolute), physicalUri: fs.realpathSync(absolute), storageLayer: "hot", runId, byteSize: info.size, modifiedAtUtc: info.mtime.toISOString(), sha256: sha256File(absolute) })
}
function resolvePath(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolvePath(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(resolvePath(value)) && sha256File(value) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
