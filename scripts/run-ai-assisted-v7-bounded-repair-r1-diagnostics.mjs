import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/v7-bounded-repair-r1-diagnostics"
const AUTHORIZATION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-bounded-repair-r1-resolution-20260802/request.json"
const CONTRACT_POINTER = ".runtime/ai-painter/v7-validation-failure-repair-contracts/latest.json"
const CHECKPOINT_POINTER = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7/latest.json"
const PYTHON = path.resolve(ROOT, "ml/ai-painter/.venv/Scripts/python.exe")
const ROUNDTRIP_SCRIPT = path.resolve(ROOT, "ml/ai-painter/scripts/diagnose_ai_assisted_v7_autoencoder_roundtrip.py")
const INFERENCE_RUNNER = path.resolve(ROOT, "scripts/run-ai-assisted-conditional-inference-validation.mjs")
const CONDITION_SWAP_SEED = 2026080201

const authorization = readJson(path.resolve(ROOT, AUTHORIZATION_PATH))
const contractPointer = readJson(path.resolve(ROOT, CONTRACT_POINTER))
const contract = readJson(path.resolve(ROOT, contractPointer.runPath))
const checkpoint = readJson(path.resolve(ROOT, CHECKPOINT_POINTER))
assert(authorization.status === "resolved_owner_authorized", "bounded repair R1 owner authorization is missing")
assert(authorization.ownerDecision?.commandRef === "owner-authorized-v7-bounded-repair-r1-diagnostics-implementation-single-stage0-smoke-20260802", "bounded repair R1 owner command identity mismatch")
assert(authorization.resolution?.boundedDiagnosticsAuthorized === true, "bounded diagnostics are not authorized")
assert(authorization.resolution?.fullTrainingAuthorized === false, "diagnostic authorization improperly opens full training")
assert(contract.contractId === authorization.taskIdentity?.repairContractId, "diagnostic contract identity mismatch")
assert(checkpoint.checkpointSha256 === authorization.taskIdentity?.failedCheckpointSha256, "diagnostic checkpoint identity mismatch")

const existing = readExistingDiagnostics()
if (existing) {
  console.log(JSON.stringify({ ok: true, status: "existing_bounded_diagnostics_reused", ...existing }, null, 2))
  process.exit(0)
}

const sourceIndex = readJson(path.resolve(ROOT, checkpoint.sourceIndexPath))
const challengeRows = sourceIndex.samples.filter((row) => row.split === "challenge" && row.v7CapacityContributionRegistered === true)
assert(challengeRows.length === 4, "bounded diagnostics require four challenge rows")
const createdAtUtc = new Date().toISOString()
const diagnosticId = `ai-assisted-v7-bounded-repair-r1-diagnostic-${createdAtUtc.replace(/[:.]/g, "-")}`
const runDir = path.resolve(ROOT, OUTPUT_ROOT, diagnosticId)
fs.mkdirSync(path.dirname(runDir), { recursive: true })
fs.mkdirSync(runDir, { recursive: false })
appendAiPainterProgramEvent({
  action: "run_ai_assisted_v7_bounded_repair_r1_diagnostics",
  runId: diagnosticId,
  kind: "bounded_diagnostics_started",
  status: "running",
  title: "V7 bounded repair R1 diagnostics started",
  titleZh: "V7有界修复R1诊断已开始",
  detail: "challenge autoencoder roundtrip + fixed-seed condition swap",
  detailZh: "四张challenge目标Autoencoder往返＋同种子条件互换",
  script: "scripts/run-ai-assisted-v7-bounded-repair-r1-diagnostics.mjs",
  currentStep: "autoencoder_roundtrip",
  evidencePath: projectPath(AUTHORIZATION_PATH),
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const roundtripReportPath = path.join(runDir, "autoencoder-roundtrip-report.json")
const roundtripImagesDir = path.join(runDir, "autoencoder-roundtrip-images")
const roundtrip = spawnSync(PYTHON, [
  ROUNDTRIP_SCRIPT,
  "--config", path.resolve(ROOT, "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"),
  "--checkpoint", path.resolve(ROOT, checkpoint.checkpointPath),
  "--source-index", path.resolve(ROOT, checkpoint.sourceIndexPath),
  "--output-dir", roundtripImagesDir,
  "--report", roundtripReportPath,
], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 80 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.resolve(ROOT, "ml/ai-painter/src") },
})
if (roundtrip.status !== 0) failDiagnostic("v7_autoencoder_roundtrip_diagnostic_failed", roundtrip)
const roundtripReport = readJson(roundtripReportPath)

const conditionSwapRuns = []
for (const row of challengeRows) {
  const child = spawnSync(process.execPath, [
    INFERENCE_RUNNER,
    "--model-version", "v7",
    "--condition-label", row.conditionLabel,
    "--seed", String(CONDITION_SWAP_SEED),
    "--owner-command-ref", authorization.ownerDecision.commandRef,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  })
  if (child.status !== 0) failDiagnostic(`v7_condition_swap_inference_failed_${row.conditionLabel}`, child)
  const latest = readJson(path.resolve(ROOT, ".runtime/ai-painter/ai-assisted-conditional-inference-validation/latest.json"))
  assert(latest.conditionLabel === row.conditionLabel && latest.seed === CONDITION_SWAP_SEED, "condition swap latest identity mismatch")
  assert(latest.ownerCommandRef === authorization.ownerDecision.commandRef, "condition swap authorization identity mismatch")
  conditionSwapRuns.push({
    recordId: row.recordId,
    conditionLabel: row.conditionLabel,
    seed: CONDITION_SWAP_SEED,
    runId: latest.runId,
    status: latest.status,
    manifestPath: latest.manifestPath,
    outputImagePath: latest.outputImagePath,
    outputImageSha256: latest.outputImageSha256,
    machineReviewPath: latest.machineReviewPath,
    machineReviewSha256: latest.machineReviewSha256,
    issueCodes: latest.machineReviewIssueCodes,
  })
}

const generatedFeatures = await Promise.all(conditionSwapRuns.map(async (row) => ({
  recordId: row.recordId,
  pixels: await structuralPixels(path.resolve(ROOT, row.outputImagePath)),
})))
const targetFeatures = await Promise.all(challengeRows.map(async (row) => ({
  recordId: row.recordId,
  pixels: await structuralPixels(path.resolve(ROOT, row.imagePath)),
})))
const generatedCrossConditionDifference = average(pairwiseDifferences(generatedFeatures))
const sourceTargetCrossConditionDifference = average(pairwiseDifferences(targetFeatures))
const conditionResponseRatio = round(generatedCrossConditionDifference / sourceTargetCrossConditionDifference)
const issueCounts = countValues(conditionSwapRuns.flatMap((row) => row.issueCodes ?? []))
const diagnosis = {
  autoencoderPrimaryBottleneck: roundtripReport.diagnosis.autoencoderPrimaryBottleneck,
  denoiserFullTrajectoryPrimaryFailure: !roundtripReport.diagnosis.autoencoderPrimaryBottleneck,
  conditionResponseStatus: conditionResponseRatio < 0.5
    ? "severe_condition_response_collapse"
    : conditionResponseRatio < 0.8
      ? "condition_response_present_but_structurally_insufficient"
      : "condition_response_requires_semantic_gate_review",
  professionalGateFailureCount: conditionSwapRuns.filter((row) => (row.issueCodes ?? []).some((code) => code.startsWith("professional_"))).length,
  pathSemanticFailureCount: conditionSwapRuns.filter((row) => (row.issueCodes ?? []).some((code) => code.startsWith("condition_terrain_path_ground_"))).length,
  repairTargets: [
    "add_region_contrast_and_spatial_grid_losses_to_trainable_composite",
    "add_path_boundary_and_path_background_contrast_training_signal",
    "include_fixed_full_rollout_professional_and_semantic_metrics_in_checkpoint_gate",
    "save_fixed_epoch_previews_with_machine_reviews",
    "start_repair_lineage_from_new_random_stage0_not_failed_checkpoint",
  ],
}
const report = {
  schemaVersion: "ai-assisted-v7-bounded-repair-r1-diagnostic-report-v1",
  diagnosticId,
  status: "bounded_diagnostics_completed_repair_implementation_required",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  generatedBy: "local_ai_pet_world_program",
  authorization: {
    path: AUTHORIZATION_PATH,
    sha256: sha256File(path.resolve(ROOT, AUTHORIZATION_PATH)),
    commandRef: authorization.ownerDecision.commandRef,
  },
  repairContract: {
    path: contractPointer.runPath,
    sha256: sha256File(path.resolve(ROOT, contractPointer.runPath)),
  },
  checkpoint: {
    path: checkpoint.checkpointPath,
    sha256: checkpoint.checkpointSha256,
    disposition: "failed_validation_evidence_only",
  },
  autoencoderRoundtrip: {
    reportPath: projectPath(roundtripReportPath),
    reportSha256: sha256File(roundtripReportPath),
    meanMetrics: roundtripReport.meanMetrics,
    diagnosis: roundtripReport.diagnosis,
    rows: roundtripReport.rows,
  },
  fixedSeedConditionSwap: {
    seed: CONDITION_SWAP_SEED,
    trajectoryCount: conditionSwapRuns.length,
    generatedCrossConditionDifference,
    sourceTargetCrossConditionDifference,
    conditionResponseRatio,
    issueCounts,
    runs: conditionSwapRuns,
  },
  diagnosis,
  tokenAccounting: {
    conditionSwapDenoiserSampleForwardPasses: conditionSwapRuns.length * 50,
    conditionSwapLatentSpatialTokens: conditionSwapRuns.length * 50 * 256 * 192,
    externalApiTokens: 0,
  },
  weightsModified: false,
  newTrainingStarted: false,
  fullTrainingAuthorized: false,
  revalidationAuthorized: false,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  nextClosedLoopNode: "implement_bounded_v7_repair_r1",
  automaticStorage: true,
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: diagnosticId,
  fileName: "diagnostic-report.json",
  record: report,
  latest: {
    authorizationSha256: report.authorization.sha256,
    checkpointSha256: checkpoint.checkpointSha256,
    nextClosedLoopNode: report.nextClosedLoopNode,
    formalInferenceEligible: false,
  },
})
appendAiPainterProgramEvent({
  action: "run_ai_assisted_v7_bounded_repair_r1_diagnostics",
  runId: diagnosticId,
  kind: "bounded_diagnostics_completed",
  status: "success",
  title: "V7 bounded repair R1 diagnostics completed",
  titleZh: "V7有界修复R1诊断已完成",
  detail: `autoencoderPrimary=${diagnosis.autoencoderPrimaryBottleneck}; conditionResponseRatio=${conditionResponseRatio}`,
  detailZh: `Autoencoder是否主瓶颈=${diagnosis.autoencoderPrimaryBottleneck}；条件结构响应比=${conditionResponseRatio}`,
  script: "scripts/run-ai-assisted-v7-bounded-repair-r1-diagnostics.mjs",
  currentStep: "bounded_repair_implementation",
  evidencePath: stored.runPath,
  nextAction: "implement_bounded_v7_repair_r1",
  nextActionZh: "按诊断结果实施有界训练目标、checkpoint门禁和固定预览修复。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
console.log(JSON.stringify({
  ok: true,
  status: report.status,
  diagnosticId,
  reportPath: stored.runPath,
  reportSha256: sha256File(path.resolve(ROOT, stored.runPath)),
  autoencoderRoundtrip: report.autoencoderRoundtrip.meanMetrics,
  fixedSeedConditionSwap: report.fixedSeedConditionSwap,
  diagnosis,
}, null, 2))

function failDiagnostic(code, child) {
  const failurePath = path.join(runDir, "failure.json")
  const failure = {
    schemaVersion: "ai-assisted-v7-bounded-repair-r1-diagnostic-failure-v1",
    diagnosticId,
    status: "bounded_diagnostics_failed",
    code,
    exitCode: child?.status ?? null,
    stdout: child?.stdout ?? "",
    stderr: child?.stderr ?? "",
    weightsModified: false,
    trainingStarted: false,
    formalInferenceEligible: false,
    automaticStorage: true,
  }
  fs.writeFileSync(failurePath, `${JSON.stringify(failure, null, 2)}\n`)
  appendAiPainterProgramEvent({
    action: "run_ai_assisted_v7_bounded_repair_r1_diagnostics",
    runId: diagnosticId,
    kind: "bounded_diagnostics_failed",
    status: "failed",
    title: "V7 bounded repair R1 diagnostics failed",
    titleZh: "V7有界修复R1诊断失败",
    detail: code,
    detailZh: code,
    script: "scripts/run-ai-assisted-v7-bounded-repair-r1-diagnostics.mjs",
    currentStep: "return_to_repair_contract",
    evidencePath: projectPath(failurePath),
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
  console.error(JSON.stringify(failure, null, 2))
  process.exit(1)
}
function readExistingDiagnostics() {
  const pointerPath = path.resolve(ROOT, OUTPUT_ROOT, "latest.json")
  if (!fs.existsSync(pointerPath)) return null
  const pointer = readJson(pointerPath)
  const authorizationSha256 = sha256File(path.resolve(ROOT, AUTHORIZATION_PATH))
  if (pointer.authorizationSha256 !== authorizationSha256 || pointer.checkpointSha256 !== checkpoint.checkpointSha256) return null
  if (!pointer.runPath || !fs.existsSync(path.resolve(ROOT, pointer.runPath))) return null
  return { diagnosticId: pointer.runId, reportPath: pointer.runPath, reportSha256: sha256File(path.resolve(ROOT, pointer.runPath)) }
}
async function structuralPixels(imagePath) {
  return sharp(imagePath, { failOn: "error" }).removeAlpha().resize(64, 48, { fit: "fill" }).blur(4).raw().toBuffer()
}
function pairwiseDifferences(rows) {
  const values = []
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) values.push(meanAbsoluteDifference(rows[left].pixels, rows[right].pixels))
  }
  return values
}
function meanAbsoluteDifference(left, right) {
  let total = 0
  for (let index = 0; index < left.length; index += 1) total += Math.abs(left[index] - right[index])
  return round(total / left.length)
}
function countValues(values) { return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length])) }
function average(values) { return round(values.reduce((sum, value) => sum + value, 0) / values.length) }
function round(value) { return Number(value.toFixed(6)) }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
