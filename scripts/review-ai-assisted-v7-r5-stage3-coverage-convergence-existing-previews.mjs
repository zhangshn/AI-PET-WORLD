import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { reviewAiAssistedV7R5Stage3Previews } from "./lib/ai-assisted-v7-r5-stage3-preview-review.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r5-stage3-coverage-convergence-offline-preview-review-recovery-20260805"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "604838bc2e6a3f6fcfb2f6fce9ea071a3622d6d5f1c24ee0bd720cde5d3e40fa"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "5755b5542aae57d8479fa0d17f2d43142f24e1e2875e69a067622a75b18816ff"
const COMMAND_REF = "owner-authorized-v7-r5-stage3-coverage-convergence-offline-preview-review-recovery-20260805"
const SCOPE = "repair_windows_safe_short_preview_review_io_cpu_regression_then_one_existing_preview_offline_review_and_append_only_terminal_closure"
const SOURCE_RUN_ID = "ai-assisted-v7-r5-stage3-coverage-convergence-checkpoint-continuation-overfit-smoke-2026-08-05T08-37-03-827Z"
const SOURCE_RUN_DIR = resolve(`.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5-stage3-coverage-convergence/${SOURCE_RUN_ID}`)
const SOURCE_MANIFEST_PATH = path.join(SOURCE_RUN_DIR, "manifest.json")
const SOURCE_MANIFEST_SHA256 = "54a23bc67c9604816150f9822fcc6b10f1c75e1f925821e177fccb875fe1e038"
const ORIGINAL_FAILURE_REPORT_PATH = resolve(".runtime/ai-painter/v7-r5-stage3-coverage-convergence-overfit-smoke-finalizations/ai-assisted-v7-r5-stage3-overfit-smoke-finalization-2026-08-05T08-37-03-827Z/finalization-report.json")
const ORIGINAL_FAILURE_REPORT_SHA256 = "67f9bc3a7dc23a032548606ee0b552dfa03277a6004324d21e30c6c0b12e2ea2"
const ORIGINAL_TERMINAL_PATH = path.join(SOURCE_RUN_DIR, "run-terminal-registration.json")
const ORIGINAL_TERMINAL_SHA256 = "e04bfd06fbc4b7c22f2e197b475fc88fbe638ab5b46878ef9184ec95c4a1630c"
const EXPECTED_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const EXPECTED_CONDITION_LABEL = "v7-complete-map-146"
const REQUIRED_PREVIEW_EPOCHS = [1, 10, 20, 30]
const REQUIRED_TAIL_EPOCHS = [10, 20, 30]
const EXPECTED_PREVIEW_SHA256 = new Map([
  [1, "c4077e5fdb21b78a75b887cfb665118f10b6654acbc407ab1155515753bb40f6"],
  [10, "9f1ac7bb8b11a5310c2092d9e318317beed2995efd6a64ef3cc2702f2d5489f8"],
  [20, "a1b899e02c67d98de444a9679c62c0fc7ff2d517e2d5466953e1faaac33b06bc"],
  [30, "17f744e694a5153ba2c9aa9660b3f6d7b5264c917c423d42d9482d6c687473e0"],
])
const RECOVERY_ROOT = resolve(".runtime/ai-painter/v7-r5-stage3-coverage-convergence-preview-review-recoveries")
const REGISTRATION_PATH = path.join(RECOVERY_ROOT, "registrations", `${REQUEST_ID}.json`)
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const recoveryId = `ai-assisted-v7-r5-stage3-offline-preview-review-recovery-${suffix}`
const recoveryDir = path.join(RECOVERY_ROOT, recoveryId)
const reviewReportPath = path.join(recoveryDir, "fixed-preview-hard-gate-review.json")
const finalReportPath = path.join(recoveryDir, "offline-preview-review-recovery-report.json")
const terminalPath = path.join(recoveryDir, "offline-preview-review-recovery-terminal.json")

const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const sourceManifest = readJson(SOURCE_MANIFEST_PATH)
const sourceIndex = readJson(sourceManifest.sourceIndexPath)
const overfitRow = sourceIndex.samples.find((row) => row.sampleId === EXPECTED_SAMPLE_ID && row.conditionLabel === EXPECTED_CONDITION_LABEL && row.split === "train")
const preflightIssues = validatePreflight()

if (fs.existsSync(REGISTRATION_PATH)) {
  console.error("offline_preview_review_recovery_already_consumed")
  process.exit(1)
}

fs.mkdirSync(path.dirname(REGISTRATION_PATH), { recursive: true })
writeImmutableJson(REGISTRATION_PATH, {
  schemaVersion: "ai-assisted-v7-r5-stage3-offline-preview-review-recovery-registration-v1",
  status: preflightIssues.length === 0 ? "registered_after_read_only_preflight" : "registered_preflight_failed_closed",
  requestId: REQUEST_ID,
  recoveryId,
  registeredAtUtc: now,
  registeredAtAsiaShanghai: formatShanghai(now),
  sourceRunId: SOURCE_RUN_ID,
  preflightPassed: preflightIssues.length === 0,
  automaticRetryAuthorized: false,
})

if (preflightIssues.length > 0) {
  closeRecovery("r5_stage3_offline_preview_review_recovery_preflight_failed_closed", preflightIssues)
  process.exit(1)
}

try {
  const { report: reviewReport, reviews } = await reviewAiAssistedV7R5Stage3Previews({
    runId: SOURCE_RUN_ID,
    previewRoot: path.join(SOURCE_RUN_DIR, "fixed-epoch-previews"),
    finalAssetRoot: path.join(recoveryDir, "fixed-preview-review-assets"),
    reportPath: reviewReportPath,
    workRoot: resolve(".runtime/ai-painter/r5s3-review-work"),
    workId: `recover-${sha256Text(recoveryId).slice(0, 16)}`,
    overfitRow,
    requiredPreviewEpochs: REQUIRED_PREVIEW_EPOCHS,
    requiredTailEpochs: REQUIRED_TAIL_EPOCHS,
  })
  const passed = reviewReport.status === "passed"
  const blockers = passed ? [] : [
    ...(reviewReport.reviewCount === REQUIRED_PREVIEW_EPOCHS.length ? [] : ["required_preview_count_invalid"]),
    ...(reviewReport.failCount === 0 ? [] : ["stage_0_preview_machine_hard_gate_failed"]),
    ...(reviewReport.tailStabilityGate.passed ? [] : ["r5_stage3_tail_three_consecutive_passes_missing"]),
  ]
  closeRecovery(
    passed
      ? "r5_stage3_coverage_convergence_gpu_smoke_passed_closed_after_offline_preview_review"
      : "r5_stage3_coverage_convergence_gpu_smoke_failed_closed_after_offline_preview_review",
    blockers,
    { reviewReport, reviews },
  )
  if (!passed) process.exitCode = 1
} catch (error) {
  closeRecovery("r5_stage3_offline_preview_review_recovery_execution_failed_closed", [String(error?.message ?? error)])
  process.exitCode = 1
}

function validatePreflight() {
  const issues = []
  const check = (condition, code) => { if (!condition) issues.push(code) }
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "authorization_hash_invalid")
  check(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "consumption_hash_invalid")
  check(fileHashMatches(SOURCE_MANIFEST_PATH, SOURCE_MANIFEST_SHA256), "source_manifest_hash_invalid")
  check(fileHashMatches(ORIGINAL_FAILURE_REPORT_PATH, ORIGINAL_FAILURE_REPORT_SHA256), "original_failure_report_hash_invalid")
  check(fileHashMatches(ORIGINAL_TERMINAL_PATH, ORIGINAL_TERMINAL_SHA256), "original_terminal_hash_invalid")
  check(authorization?.status === "resolved_owner_authorized", "authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "authorization_identity_invalid")
  check(consumption?.status === "consumed_before_authorized_write" && consumption?.authorizationSha256 === AUTHORIZATION_SHA256, "authorization_not_consumed")
  check(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE && consumption?.allowedExecutionCount === 1, "consumption_identity_invalid")
  for (const key of ["existingMachineReviewerShortPathRepairAuthorized", "legacyStage3CompatibilityRequired", "cpuPositivePathRegressionAuthorized", "cpuNegativePathRegressionAuthorized", "existingPreviewReadAuthorized", "oneOfflineMachinePreviewReviewAuthorized", "appendOnlyReviewReportAuthorized", "appendOnlyRecoveryTerminalAuthorized"]) {
    check(authorization?.resolution?.[key] === true, `${key}_missing`)
  }
  for (const key of ["originalFailureEvidenceOverwriteAuthorized", "checkpointFileReadAuthorized", "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "modelWeightMutationAuthorized", "gpuTrainingAuthorized", "automaticRetryAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    check(authorization?.resolution?.[key] === false, `boundary_${key}_invalid`)
  }
  check(sourceManifest?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "source_manifest_status_invalid")
  check(sourceManifest?.singleSampleOverfitSmoke?.sampleId === EXPECTED_SAMPLE_ID, "source_sample_identity_invalid")
  check(sourceManifest?.singleSampleOverfitSmoke?.conditionLabel === EXPECTED_CONDITION_LABEL, "source_condition_identity_invalid")
  check(Boolean(overfitRow), "source_overfit_row_missing")
  const previewRoot = path.join(SOURCE_RUN_DIR, "fixed-epoch-previews")
  for (const epoch of REQUIRED_PREVIEW_EPOCHS) {
    const matches = fs.existsSync(previewRoot)
      ? fs.readdirSync(previewRoot).filter((name) => name.startsWith(`epoch-${String(epoch).padStart(3, "0")}-`) && name.endsWith(".png"))
      : []
    check(matches.length === 1, `preview_epoch_${epoch}_identity_invalid`)
    if (matches.length === 1) check(fileHashMatches(path.join(previewRoot, matches[0]), EXPECTED_PREVIEW_SHA256.get(epoch)), `preview_epoch_${epoch}_hash_invalid`)
  }
  return issues
}

function closeRecovery(status, blockers, review = null) {
  const originalFailureHashBeforeClosure = sha256File(ORIGINAL_FAILURE_REPORT_PATH)
  const originalTerminalHashBeforeClosure = sha256File(ORIGINAL_TERMINAL_PATH)
  const report = {
    schemaVersion: "ai-assisted-v7-r5-stage3-offline-preview-review-recovery-report-v1",
    status,
    recoveryId,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    sourceRunId: SOURCE_RUN_ID,
    sourceManifestPath: projectPath(SOURCE_MANIFEST_PATH),
    sourceManifestSha256: SOURCE_MANIFEST_SHA256,
    originalFailureReportPath: projectPath(ORIGINAL_FAILURE_REPORT_PATH),
    originalFailureReportSha256: originalFailureHashBeforeClosure,
    originalTerminalPath: projectPath(ORIGINAL_TERMINAL_PATH),
    originalTerminalSha256: originalTerminalHashBeforeClosure,
    originalFailureEvidencePreserved: originalFailureHashBeforeClosure === ORIGINAL_FAILURE_REPORT_SHA256 && originalTerminalHashBeforeClosure === ORIGINAL_TERMINAL_SHA256,
    previewReviewPath: fs.existsSync(reviewReportPath) ? projectPath(reviewReportPath) : null,
    previewReviewSha256: fs.existsSync(reviewReportPath) ? sha256File(reviewReportPath) : null,
    previewReviewStatus: review?.reviewReport?.status ?? "not_created_due_to_recovery_failure",
    previewCount: review?.reviews?.length ?? 0,
    previewPassCount: review?.reviews?.filter((row) => row.passed).length ?? 0,
    previewFailCount: review?.reviews?.filter((row) => !row.passed).length ?? 0,
    tailStabilityGate: review?.reviewReport?.tailStabilityGate ?? null,
    blockers,
    checkpointIdentityReferencedFromManifestOnly: sourceManifest.checkpointSha256 ?? null,
    executionBoundary: {
      checkpointFileRead: false,
      checkpointDeserialized: false,
      checkpointLoaded: false,
      optimizerCreated: false,
      modelWeightsModified: false,
      gpuTrainingStarted: false,
      automaticRetryStarted: false,
      fullTrainingStarted: false,
      strictRevalidationStarted: false,
      formalInferenceStarted: false,
      checkpointPromoted: false,
      runtimeFrameStarted: false,
      worldEntered: false,
    },
    stage3Closed: true,
    nextStageStarted: false,
  }
  writeImmutableJson(finalReportPath, report)
  const terminal = {
    schemaVersion: "ai-assisted-v7-r5-stage3-offline-preview-review-recovery-terminal-v1",
    status,
    recoveryId,
    registeredAtUtc: report.createdAtUtc,
    registeredAtAsiaShanghai: report.createdAtAsiaShanghai,
    recoveryReportPath: projectPath(finalReportPath),
    recoveryReportSha256: sha256File(finalReportPath),
    previewReviewPath: report.previewReviewPath,
    previewReviewSha256: report.previewReviewSha256,
    previewReviewStatus: report.previewReviewStatus,
    originalFailureEvidencePreserved: report.originalFailureEvidencePreserved,
    stage3Closed: true,
    nextStageStarted: false,
    automaticRetryStarted: false,
    executionBoundary: report.executionBoundary,
  }
  writeImmutableJson(terminalPath, terminal)
  console.log(JSON.stringify({ ...report, reportPath: projectPath(finalReportPath), reportSha256: sha256File(finalReportPath), terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }, null, 2))
}

function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function sha256Text(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return fs.existsSync(absolute) && sha256File(absolute) === expected }
function writeImmutableJson(value, body) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  const handle = fs.openSync(value, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}
