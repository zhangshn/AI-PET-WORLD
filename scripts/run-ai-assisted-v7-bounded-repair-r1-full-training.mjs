import crypto from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { evaluateV7TrainingGpuResourceGate } from "./lib/ai-assisted-v7-training-resource-gate.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const OVERLAY_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r1-training-overlay.json"
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-repair-r1-full-training-resolution-20260802/request.json"
const AUTHORIZATION_SHA256 = "0c57c344ddf02b09bd4d3e9cea27a9677be64c3289ad7448ec7b9bd937935285"
const AUTHORIZATION_ID = "owner-action-request-v7-repair-r1-full-training-resolution-20260802"
const AUTHORIZATION_STATUS = "owner_authorized_v7_repair_r1_full_training"
const AUTHORIZATION_COMMAND = "owner-authorized-v7-repair-r1-full-stage0-stage1-stage2-training-20260802"
const AUTHORIZATION_SCOPE = "v7_repair_r1_full_stage0_stage1_stage2_training_only"
const AUTHORIZATION_CONSUMPTION_PATH = path.join(path.dirname(path.resolve(ROOT, AUTHORIZATION_PATH)), "full-training-authorization-consumption.json")
const EXPECTED_SPLITS = { train: 48, validation: 8, challenge: 4, regression: 4 }
const EXPECTED_STAGES = [{ width: 256, height: 192 }, { width: 512, height: 384 }, { width: 1024, height: 768 }]
const MODEL_ROOT = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-conditional-denoiser-v7-repair-r1")
const FINALIZATION_ROOT = path.join(ROOT, ".runtime", "ai-painter", "v7-bounded-repair-r1-full-training-finalizations")
const PREVIEW_ASSET_ROOT = path.join(ROOT, ".runtime", "ai-painter", "v7-r1-preview-review-assets")
const LOCK_PATH = path.join(MODEL_ROOT, ".full-training.lock")
const preflightOnly = process.argv.includes("--preflight-only")
const createdAtUtc = new Date().toISOString()
const suffix = createdAtUtc.replace(/[:.]/g, "-")
const chainId = `ai-assisted-v7-repair-r1-full-training-${suffix}`
const derivedConfigPath = path.join(MODEL_ROOT, "derived-configs", `${chainId}.json`)

const overlay = readJson(OVERLAY_PATH)
const baseConfig = readJson(overlay?.baseConfigPath)
const authorization = readJson(AUTHORIZATION_PATH)
const smokePointer = readJson(`${projectPath(MODEL_ROOT)}/latest-program-check.json`)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = readJson(datasetPointer?.manifestPath)
const sourceIndex = readJson(datasetManifest?.sourceIndexPath)
const autoencoder = readJson(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/latest.json")
const selectedRows = (sourceIndex?.samples ?? []).filter(isV7CapacityRow)
const selectedSplits = countSplits(selectedRows)
const derivedConfig = deepMerge(deepMerge(baseConfig, overlay?.patch), {
  status: "owner_authorized_v7_repair_r1_full_training",
  training: {
    trainingAuthorizationStatus: AUTHORIZATION_STATUS,
    ownerTrainingAuthorization: {
      authorizationId: AUTHORIZATION_ID,
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256: AUTHORIZATION_SHA256,
      status: AUTHORIZATION_STATUS,
      gpuTrainingAuthorizedNow: true,
      fullTrainingAuthorized: true,
      formalInferenceAuthorized: false,
    },
  },
})
let currentChild = null
let currentStage = null
const stageResults = []
const hardwareBefore = hardwareSnapshot()
const blockers = validatePreflight(hardwareBefore)

if (blockers.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    status: "blocked_read_only_preflight",
    blockers,
    authorizationConsumed: false,
    projectFilesWritten: false,
  }, null, 2))
  process.exit(1)
}

const pythonPreflight = runReadOnlyPythonPreflight()
if (pythonPreflight.status !== 0) {
  console.error(JSON.stringify({
    ok: false,
    status: "blocked_read_only_python_preflight",
    blocker: "python_training_contract_preflight_failed",
    stderr: pythonPreflight.stderr || null,
    stdout: pythonPreflight.stdout || null,
    authorizationConsumed: false,
    projectFilesWritten: false,
  }, null, 2))
  process.exit(1)
}

if (preflightOnly) {
  console.log(JSON.stringify({
    ok: true,
    status: "read_only_preflight_passed",
    authorizationConsumed: false,
    projectFilesWritten: false,
    selectedRowCount: selectedRows.length,
    selectedSplits,
    pythonPreflight: parseJsonOutput(pythonPreflight.stdout),
  }, null, 2))
  process.exit(0)
}

const authorizationConsumption = consumeFullTrainingAuthorization()
appendEvent("training_preflight_started", "running", "V7 repair R1 full-training preflight started", `authorizationConsumption=${authorizationConsumption.path}; rows=${selectedRows.length}; split=${JSON.stringify(selectedSplits)}`)
writeJson(derivedConfigPath, {
  ...derivedConfig,
  training: {
    ...derivedConfig.training,
    ownerTrainingAuthorization: {
      ...derivedConfig.training.ownerTrainingAuthorization,
      consumptionPath: authorizationConsumption.path,
      consumptionSha256: authorizationConsumption.sha256,
    },
  },
})
fs.mkdirSync(MODEL_ROOT, { recursive: true })
let releaseFullTrainingLock
try {
  releaseFullTrainingLock = acquireFullTrainingLock()
} catch {
  const report = writeFinalReport("blocked_concurrent_training_lock", ["v7_repair_r1_full_training_lock_active"], hardwareBefore, hardwareSnapshot())
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}

try {
  appendEvent("training_run_started", "running", "V7 repair R1 full Stage 0 to Stage 2 training started", "Stage 0 starts from project random initialization; Stage 1 and Stage 2 require exact parent hashes.", projectPath(derivedConfigPath))
  let parent = null
  for (let stageIndex = 0; stageIndex < EXPECTED_STAGES.length; stageIndex += 1) {
    currentStage = stageIndex
    const stageRunId = `ai-assisted-v7-repair-r1-stage-${stageIndex}-${suffix}`
    const outputDir = path.join(MODEL_ROOT, stageRunId)
    appendEvent("training_stage_started", "running", `V7 repair R1 Stage ${stageIndex} started`, `resolution=${EXPECTED_STAGES[stageIndex].width}x${EXPECTED_STAGES[stageIndex].height}; parent=${parent?.checkpointSha256 ?? "none"}`)
    const args = [TRAINER,
      "--config", derivedConfigPath,
      "--dataset-package", resolvePath(datasetPointer.manifestPath),
      "--autoencoder-checkpoint", resolvePath(autoencoder.checkpointPath),
      "--output-dir", outputDir,
      "--resolution-stage", String(stageIndex),
    ]
    if (parent) args.push("--initial-denoiser-checkpoint", resolvePath(parent.checkpointPath))
    const processResult = await runPythonStage(args, outputDir, stageIndex)
    if (processResult.exitCode !== 0) throw new Error(`stage_${stageIndex}_python_training_failed`)
    const manifestPath = path.join(outputDir, "manifest.json")
    const manifest = readJson(manifestPath)
    const issues = validateStageManifest(manifest, stageIndex, parent)
    if (issues.length > 0) throw new Error(issues.join(","))
    const previewReview = await reviewStagePreviews(outputDir, stageIndex)
    const stageResult = {
      stageIndex,
      runId: stageRunId,
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
    indexTree(outputDir, stageRunId)
    if (previewReview.previewFailCount > 0 || previewReview.previewPassCount !== previewReview.previewCount) {
      appendEvent(
        "training_stage_preview_gate_failed",
        "failed",
        `V7 repair Stage ${stageIndex} preview hard gate failed`,
        `previews=${previewReview.previewCount}; pass=${previewReview.previewPassCount}; fail=${previewReview.previewFailCount}; next stage not started`,
        previewReview.reviewPath,
      )
      throw new Error(`stage_${stageIndex}_preview_machine_gate_failed`)
    }
    appendEvent("training_stage_completed", "success", `V7 repair R1 Stage ${stageIndex} completed`, `checkpoint=${manifest.checkpointSha256}; bestEpoch=${manifest.bestEpoch}; previews=${previewReview.previewCount}; previewPass=${previewReview.previewPassCount}; previewFail=${previewReview.previewFailCount}`, stageResult.manifestPath)
    parent = manifest
  }
  currentStage = null
  const finalReport = writeFinalReport("full_stage0_stage1_stage2_training_completed_pending_strict_revalidation", [], hardwareBefore, hardwareSnapshot())
  const nextRequest = writeRevalidationOwnerRequest(finalReport)
  const latest = {
    schemaVersion: "ai-assisted-v7-repair-r1-full-training-latest-v1",
    status: finalReport.status,
    chainId,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    derivedConfigPath: projectPath(derivedConfigPath),
    derivedConfigSha256: sha256File(derivedConfigPath),
    stageResults,
    finalCheckpointPath: stageResults.at(-1).checkpointPath,
    finalCheckpointSha256: stageResults.at(-1).checkpointSha256,
    reportPath: finalReport.reportPath,
    reportSha256: finalReport.reportSha256,
    nextOwnerRequestPath: nextRequest.requestPath,
    nextOwnerRequestSha256: nextRequest.requestSha256,
    revalidationAuthorized: false,
    formalInferenceEligible: false,
    canEnterWorld: false,
  }
  writeJson(path.join(MODEL_ROOT, "latest-full-training.json"), latest)
  appendEvent("training_run_completed", "success", "V7 repair R1 full Stage 0 to Stage 2 training completed and stopped", `finalCheckpoint=${latest.finalCheckpointSha256}; revalidationStarted=false`, finalReport.reportPath)
  console.log(JSON.stringify({ ...latest, nextOwnerRequest: nextRequest }, null, 2))
} catch (error) {
  const reasons = String(error?.message ?? error).split(",").filter(Boolean)
  const report = writeFinalReport("full_training_failed_stopped", reasons, hardwareBefore, hardwareSnapshot())
  appendEvent("training_run_failed", "failed", "V7 repair R1 full training failed and stopped", `stage=${currentStage}; ${reasons.join(",")}`, report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
} finally {
  releaseFullTrainingLock?.()
}

function acquireFullTrainingLock() {
  const lockRecord = {
    schemaVersion: "ai-assisted-v7-full-training-lock-v1",
    pid: process.pid,
    chainId,
    authorizationId: AUTHORIZATION_ID,
    authorizationSha256: AUTHORIZATION_SHA256,
    createdAtUtc,
  }
  const create = (extra = {}) => {
    const handle = fs.openSync(LOCK_PATH, "wx")
    fs.writeFileSync(handle, `${JSON.stringify({ ...lockRecord, ...extra }, null, 2)}\n`)
    fs.closeSync(handle)
  }
  try {
    create()
  } catch (error) {
    if (error?.code !== "EEXIST") throw error
    let existing = null
    try { existing = readJson(LOCK_PATH) } catch { existing = null }
    if (processIsAlive(Number(existing?.pid))) throw error
    const preserved = `${LOCK_PATH}.stale-${new Date().toISOString().replace(/[:.]/g, "-")}`
    fs.renameSync(LOCK_PATH, preserved)
    create({ replacedStaleLock: projectPath(preserved) })
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (!fs.existsSync(LOCK_PATH)) return
    let current = null
    try { current = readJson(LOCK_PATH) } catch { return }
    if (Number(current?.pid) === process.pid && current?.chainId === chainId) fs.rmSync(LOCK_PATH)
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

function consumeFullTrainingAuthorization() {
  let handle
  try {
    handle = fs.openSync(AUTHORIZATION_CONSUMPTION_PATH, "wx")
    const record = {
      schemaVersion: "ai-assisted-v7-repair-r1-full-training-authorization-consumption-v1",
      status: "consumed_before_any_training_write",
      consumedAtUtc: new Date().toISOString(),
      pid: process.pid,
      chainId,
      ownerCommandRef: AUTHORIZATION_COMMAND,
      authorizationScope: AUTHORIZATION_SCOPE,
      authorizationPath: AUTHORIZATION_PATH,
      authorizationSha256: AUTHORIZATION_SHA256,
      requiredStages: [0, 1, 2],
      incompleteRunRequiresNewOwnerAuthorization: true,
    }
    fs.writeFileSync(handle, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    fs.closeSync(handle)
    handle = undefined
    return {
      ...record,
      path: projectPath(AUTHORIZATION_CONSUMPTION_PATH),
      sha256: sha256File(AUTHORIZATION_CONSUMPTION_PATH),
    }
  } catch (error) {
    if (error?.code === "EEXIST") {
      console.error(JSON.stringify({
        ok: false,
        status: "full_training_authorization_already_consumed",
        blocker: "v7_repair_r1_full_training_authorization_already_consumed_or_incomplete",
        authorizationConsumed: true,
        projectFilesWritten: false,
      }, null, 2))
      process.exit(1)
    }
    throw error
  } finally {
    if (handle !== undefined) fs.closeSync(handle)
  }
}

function validatePreflight(hardware) {
  const issues = []
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "full_training_authorization_hash_invalid")
  check(authorization?.requestId === AUTHORIZATION_ID && authorization?.status === "resolved_owner_authorized", "full_training_authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === AUTHORIZATION_COMMAND, "full_training_authorization_command_invalid")
  check(authorization?.ownerDecision?.scope === AUTHORIZATION_SCOPE, "full_training_authorization_scope_invalid")
  check(authorization?.resolution?.fullTrainingAuthorized === true, "full_training_not_authorized")
  check(sameJson(authorization?.resolution?.requiredStagesAuthorized, [0, 1, 2]), "authorized_stage_set_invalid")
  for (const key of ["revalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) check(authorization?.resolution?.[key] === false, `unauthorized_downstream_${key}`)
  check(smokePointer?.status === "stage0_smoke_program_passed_stopped", "repair_smoke_program_not_completed")
  check(smokePointer?.previewMachinePassed === false, "corrected_smoke_preview_review_missing")
  check(fileHashMatches(overlay?.baseConfigPath, overlay?.baseConfigSha256), "base_config_hash_invalid")
  check(fileHashMatches(overlay?.authorizationPath, overlay?.authorizationSha256), "bounded_repair_authorization_hash_invalid")
  check(fileHashMatches(overlay?.diagnosticReportPath, overlay?.diagnosticReportSha256), "bounded_diagnostic_hash_invalid")
  check(datasetManifest?.v7CapacityContributionCount === 64 && selectedRows.length === 64, "v7_capacity_rows_invalid")
  check(sameJson(selectedSplits, EXPECTED_SPLITS), "v7_split_invalid")
  check(new Set(selectedRows.map((row) => row.recordId)).size === 64, "v7_record_identity_duplicate")
  check(new Set(selectedRows.map((row) => row.v7CapacitySlotId)).size === 64, "v7_slot_identity_duplicate")
  check(derivedConfig?.conditionChannels === 23 && derivedConfig?.conditionChannelOrder?.length === 23, "condition_contract_invalid")
  check(derivedConfig?.training?.denoiserEpochs === 40, "epoch_contract_invalid")
  check(fileHashMatches(autoencoder?.checkpointPath, autoencoder?.checkpointSha256), "autoencoder_checkpoint_invalid")
  check(fs.existsSync(PYTHON) && fs.existsSync(TRAINER), "local_training_runtime_missing")
  const previous = readJson(path.join(MODEL_ROOT, "latest-full-training.json"))
  check(previous?.authorizationSha256 !== AUTHORIZATION_SHA256 || previous?.status !== "full_stage0_stage1_stage2_training_completed_pending_strict_revalidation", "authorized_full_training_already_completed")
  if (!preflightOnly) {
    issues.push(...evaluateV7TrainingGpuResourceGate(hardware.gpu))
  }
  return issues
  function check(condition, code) { if (!condition) issues.push(code) }
}

function runReadOnlyPythonPreflight() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-pet-v7-python-preflight-"))
  const temporaryConfigPath = path.join(temporaryRoot, "derived-config.json")
  const unusedOutputPath = path.join(temporaryRoot, "unused-output")
  try {
    fs.writeFileSync(temporaryConfigPath, `${JSON.stringify(derivedConfig, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
    return spawnSync(PYTHON, [TRAINER,
      "--config", temporaryConfigPath,
      "--dataset-package", resolvePath(datasetPointer.manifestPath),
      "--autoencoder-checkpoint", resolvePath(autoencoder.checkpointPath),
      "--output-dir", unusedOutputPath,
      "--resolution-stage", "0",
      "--preflight-only",
    ], { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: pythonEnv() })
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

function parseJsonOutput(value) {
  try {
    return JSON.parse(String(value ?? "").trim())
  } catch {
    return { status: "python_preflight_output_not_json", raw: String(value ?? "").trim() }
  }
}

function validateStageManifest(manifest, stageIndex, parent) {
  const issues = []
  check(manifest?.status === "conditional_denoiser_training_completed_pending_validation", `stage_${stageIndex}_status_invalid`)
  check(manifest?.architectureVersion === derivedConfig.architectureVersion, `stage_${stageIndex}_architecture_invalid`)
  check(manifest?.datasetPackageId === datasetManifest.packageId, `stage_${stageIndex}_dataset_invalid`)
  check(manifest?.actualLoadedConditionalSampleCount === 64 && manifest?.actualLoadedV7CapacityCount === 64, `stage_${stageIndex}_capacity_invalid`)
  check(sameJson(manifest?.actualLoadedSplitCounts, EXPECTED_SPLITS), `stage_${stageIndex}_split_invalid`)
  check(sameJson(manifest?.resolutionStage, EXPECTED_STAGES[stageIndex]), `stage_${stageIndex}_resolution_invalid`)
  check(stageIndex === 0 ? manifest?.parentDenoiserCheckpointSha256 == null : manifest?.parentDenoiserCheckpointSha256 === parent?.checkpointSha256, `stage_${stageIndex}_parent_invalid`)
  check(manifest?.denoiserTrained === true && manifest?.formalInferenceEligible === false, `stage_${stageIndex}_formal_boundary_invalid`)
  check(manifest?.denoiserLossVersion === derivedConfig.training.denoiserLossVersion, `stage_${stageIndex}_loss_contract_invalid`)
  check(manifest?.bestCheckpointMetric === derivedConfig.training.bestCheckpointMetric, `stage_${stageIndex}_checkpoint_metric_invalid`)
  check(manifest?.trainingTokenAccounting?.schemaVersion === "ai-assisted-local-training-token-accounting-v1", `stage_${stageIndex}_token_accounting_missing`)
  check(fileHashMatches(manifest?.checkpointPath, manifest?.checkpointSha256), `stage_${stageIndex}_checkpoint_hash_invalid`)
  return issues
  function check(condition, code) { if (!condition) issues.push(code) }
}

async function reviewStagePreviews(outputDir, stageIndex) {
  const previewRoot = path.join(outputDir, "fixed-epoch-previews")
  const files = fs.existsSync(previewRoot) ? fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort() : []
  if (files.length !== 6) throw new Error(`stage_${stageIndex}_fixed_preview_count_invalid_${files.length}`)
  const reviews = []
  for (const file of files) {
    const previewPath = path.join(previewRoot, file)
    const normalizedPath = path.join(PREVIEW_ASSET_ROOT, `${sha256File(previewPath).slice(0, 16)}-1024x768-nearest.png`)
    fs.mkdirSync(path.dirname(normalizedPath), { recursive: true })
    if (!fs.existsSync(normalizedPath)) await sharp(previewPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPath)
    const row = selectedRows.find((item) => file.includes(item.conditionLabel))
    if (!row) throw new Error(`stage_${stageIndex}_preview_condition_identity_missing`)
    const conditionPack = readJson(row.conditionPackPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalizedPath),
      auditAiAssistedConditionAlignment({
        record: { recordId: `${chainId}-stage-${stageIndex}-${file}`, conditionBinding: { conditionPackPath: row.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: row.classification },
        imagePath: normalizedPath,
        referenceImagePath: row.imagePath,
      }),
    ])
    reviews.push({
      previewPath: projectPath(previewPath), previewSha256: sha256File(previewPath), normalizedPath: projectPath(normalizedPath), normalizedSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  const report = {
    schemaVersion: "ai-assisted-v7-repair-r1-stage-fixed-preview-reviews-v1",
    status: "machine_reviews_completed",
    createdAtUtc: new Date().toISOString(),
    chainId,
    stageIndex,
    reviewThresholdsChanged: false,
    formalCandidate: false,
    reviews,
    previewCount: reviews.length,
    previewPassCount: reviews.filter((item) => item.passed).length,
    previewFailCount: reviews.filter((item) => !item.passed).length,
    automaticStorage: true,
  }
  const reviewPath = path.join(outputDir, "fixed-preview-reviews.json")
  writeJson(reviewPath, report)
  return { ...report, reviewPath: projectPath(reviewPath), reviewSha256: sha256File(reviewPath) }
}

function runPythonStage(args, outputDir, stageIndex) {
  return new Promise((resolve) => {
    const child = spawn(PYTHON, args, { cwd: ROOT, env: pythonEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    currentChild = child
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8") })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); process.stderr.write(chunk) })
    const timer = setInterval(() => {
      const progress = readJson(path.join(outputDir, "progress.json"))
      const gpu = hardwareSnapshot().gpu
      console.log(JSON.stringify({ kind: "training_heartbeat", chainId, stageIndex, epoch: progress?.currentEpoch?.epoch ?? progress?.latestMetric?.epoch ?? null, status: progress?.status ?? "starting", gpuUtilizationPercent: gpu.utilizationPercent, gpuMemoryUsedMiB: gpu.memoryUsedMiB, timestampUtc: new Date().toISOString() }))
    }, 20000)
    child.on("error", (error) => { stderr += error.stack || error.message })
    child.on("close", (exitCode, signal) => {
      clearInterval(timer)
      currentChild = null
      resolve({ exitCode, signal, stdout, stderr })
    })
  })
}

function writeFinalReport(status, blockers, before, after, extra = {}) {
  const reportId = `${chainId}-finalization`
  const reportPath = path.join(FINALIZATION_ROOT, reportId, "finalization-report.json")
  const totals = stageResults.reduce((sum, item) => sum + Number(item.trainingTokenAccounting?.runTotals?.latentSpatialTokens ?? 0), 0)
  const report = {
    schemaVersion: "ai-assisted-v7-repair-r1-full-training-finalization-v1",
    reportId,
    status,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    chainId,
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    datasetPackageId: datasetManifest?.packageId ?? null,
    actualLoadedV7CapacityCount: selectedRows.length,
    actualLoadedSplitCounts: selectedSplits,
    derivedConfigPath: fs.existsSync(derivedConfigPath) ? projectPath(derivedConfigPath) : null,
    derivedConfigSha256: fs.existsSync(derivedConfigPath) ? sha256File(derivedConfigPath) : null,
    stageResults,
    completedStageCount: stageResults.length,
    currentStageAtFailure: currentStage,
    localLatentSpatialTokenTotal: totals,
    externalApiTokens: 0,
    hardware: { before, after },
    blockers,
    pythonPreflight: extra.pythonPreflight ? { exitCode: extra.pythonPreflight.status, stdout: extra.pythonPreflight.stdout, stderr: extra.pythonPreflight.stderr } : null,
    activeChildPidAtFinalization: currentChild?.pid ?? null,
    revalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    nextClosedLoopNode: status.startsWith("full_stage0") ? "owner_authorization_for_strict_challenge_revalidation" : (status.startsWith("preflight_passed") ? "run_full_stage0_stage1_stage2_training" : "repair_or_resource_blocker_resolution"),
    automaticStorage: true,
  }
  writeJson(reportPath, report)
  writeJson(path.join(FINALIZATION_ROOT, "latest.json"), { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) })
  indexTree(path.dirname(reportPath), reportId)
  return { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
}

function writeRevalidationOwnerRequest(finalReport) {
  const requestId = `owner-action-request-v7-repair-r1-strict-revalidation-${suffix.toLowerCase()}`
  const requestPath = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", requestId, "request.json")
  const request = {
    schemaVersion: "ai-painter-owner-action-request-v1",
    requestId,
    subsystem: "ai_painter_v7_repair_r1_strict_revalidation",
    status: "waiting_owner_authorization",
    recordedAtUtc: new Date().toISOString(),
    recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    generatedBy: "local_ai_pet_world_program",
    systemOfRecord: "local_immutable_files_plus_sqlite_index",
    taskIdentity: { modelId: derivedConfig.modelId, architectureVersion: derivedConfig.architectureVersion, datasetPackageId: datasetManifest.packageId, trainingChainId: chainId, stage2CheckpointPath: stageResults.at(-1).checkpointPath, stage2CheckpointSha256: stageResults.at(-1).checkpointSha256, trainingFinalizationPath: finalReport.reportPath, trainingFinalizationSha256: finalReport.reportSha256 },
    ownerVisibleConclusionZh: "V7修复R1完整Stage 0→1→2训练已完成并停止，尚未执行严格challenge复验。",
    localSystemFindingZh: "训练完成不等于模型通过；必须由项目所有者单独授权后，才能对4条challenge记录执行多种子完整推理和机器审核。",
    blockingReasonCode: "waiting_owner_authorization_v7_repair_r1_strict_revalidation",
    minimumRequestedActionZh: "请项目所有者决定是否授权严格challenge多种子训练后复验；该授权仍不包含正式模型晋升、正式推理、RuntimeFrame或进入世界。",
    invariants: ["challenge_split_never_used_for_training_metrics", "fixed_multiseed_full_rollout", "review_thresholds_unchanged", "unique_condition_seed_trajectory"],
    forbiddenActions: ["formal_model_promotion", "formal_image_generation", "runtime_frame", "world_entry"],
    resolution: { revalidationAuthorized: false, formalInferenceAuthorized: false, runtimeFrameAuthorized: false, worldEntryAuthorized: false },
    automaticStorage: true,
  }
  writeJson(requestPath, request)
  return { requestId, requestPath: projectPath(requestPath), requestSha256: sha256File(requestPath) }
}

function appendEvent(kind, status, title, detail, evidencePath = null) {
  appendAiPainterProgramEvent({ action: "run_ai_assisted_v7_repair_r1_full_training", runId: chainId, kind, status, title, titleZh: title, detail, detailZh: detail, script: "scripts/run-ai-assisted-v7-bounded-repair-r1-full-training.mjs", currentStep: currentStage == null ? "v7_repair_r1_full_training" : `v7_repair_r1_stage_${currentStage}`, evidencePath, finalGameMapSuccess: false, canEnterWorld: false })
}

function hardwareSnapshot() {
  const gpu = spawnSync("nvidia-smi", ["--query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const processes = spawnSync("nvidia-smi", ["--query-compute-apps=pid,process_name", "--format=csv,noheader,nounits"], { encoding: "utf8", windowsHide: true })
  const rows = processes.status === 0 ? processes.stdout.split(/\r?\n/).filter(Boolean) : []
  const values = gpu.status === 0 ? gpu.stdout.trim().split(",").map((value) => value.trim()) : []
  return { recordedAtUtc: new Date().toISOString(), cpu: { model: os.cpus()[0]?.model ?? null, logicalProcessors: os.cpus().length }, memory: { totalBytes: os.totalmem(), freeBytes: os.freemem() }, gpu: { available: gpu.status === 0, name: values[0] ?? null, driverVersion: values[1] ?? null, memoryTotalMiB: Number(values[2] ?? 0), memoryUsedMiB: Number(values[3] ?? 0), utilizationPercent: Number(values[4] ?? 0), temperatureC: Number(values[5] ?? 0), pythonComputeProcessCount: rows.filter((row) => /python/i.test(row)).length, computeProcesses: rows } }
}

function isV7CapacityRow(row) { return row?.categoryId === "complete-maps" && row?.trainingRoles?.includes("conditional_denoiser") && row?.formalConditionalTrainingEligible === true && row?.conditionBound === true && row?.v7CapacityContributionRegistered === true && row?.ownerReviewStatus === "owner_approved" && row?.machineReviewStatus === "passed" && row?.aiAssistedColdStartEligible === true && row?.independentTrainingEligible === false }
function countSplits(rows) { return Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, rows.filter((row) => row.split === split).length])) }
function deepMerge(base, patch) { if (Array.isArray(patch)) return structuredClone(patch); if (!patch || typeof patch !== "object") return patch === undefined ? structuredClone(base) : patch; const result = base && typeof base === "object" && !Array.isArray(base) ? structuredClone(base) : {}; for (const [key, value] of Object.entries(patch)) result[key] = deepMerge(result[key], value); return result }
function readJson(value) { try { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) } catch { return null } }
function writeJson(value, body) { const absolute = resolvePath(value); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, `${JSON.stringify(body, null, 2)}\n`); indexFile(absolute, chainId) }
function indexTree(value, runId) { const absolute = resolvePath(value); if (!fs.existsSync(absolute)) return; for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) { const child = path.join(absolute, entry.name); if (entry.isDirectory()) indexTree(child, runId); else if (entry.isFile()) indexFile(child, runId) } }
function indexFile(value, runId) { const absolute = resolvePath(value); const info = fs.statSync(absolute); indexArtifact({ logicalPath: projectPath(absolute), physicalUri: fs.realpathSync(absolute), storageLayer: "hot", runId, byteSize: info.size, modifiedAtUtc: info.mtime.toISOString(), sha256: sha256File(absolute) }) }
function resolvePath(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolvePath(value)).replace(/\\/g, "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(resolvePath(value)) && sha256File(value) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function pythonEnv() { return { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src") } }
