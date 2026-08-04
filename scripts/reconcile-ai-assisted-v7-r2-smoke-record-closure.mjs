import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r2-smoke-record-reconciliation-20260803/request.json"
const REQUEST_SHA256 = "88c8d4f64fcc15d3be7194b6693ed77af6655b9e2ad90eaa9e235a170b8be6cf"
const CONSUMPTION_PATH = ".runtime/ai-painter/owner-action-requests/owner-action-request-v7-r2-smoke-record-reconciliation-20260803/record-closure-repair-consumption.json"
const CONSUMPTION_SHA256 = "d1d7aba581ac8b3d788dda410920ded08be40c0327e3d57f2a295bb26cf94d0b"
const COMMAND_REF = "owner-authorized-v7-r2-smoke-record-closure-repair-20260803"
const SCOPE = "v7_r2_smoke_record_closure_repair_existing_7_previews_only"
const RUN_ID = "ai-assisted-v7-repair-r2-single-sample-overfit-smoke-2026-08-03T10-13-27-757Z"
const RUN_DIR = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-conditional-denoiser-v7-repair-r2", RUN_ID)
const MANIFEST_PATH = path.join(RUN_DIR, "manifest.json")
const PREVIEW_REVIEW_PATH = path.join(RUN_DIR, "fixed-preview-hard-gate-review.json")
const TERMINAL_REGISTRATION_PATH = path.join(RUN_DIR, "run-terminal-registration.json")
const FINALIZATION_ROOT = path.join(ROOT, ".runtime", "ai-painter", "v7-bounded-repair-r2-overfit-smoke-finalizations")
const REPORT_ID = "ai-assisted-v7-r2-overfit-smoke-finalization-reconciled-20260803"
const REPORT_PATH = path.join(FINALIZATION_ROOT, REPORT_ID, "finalization-report.json")

const authorization = readJson(REQUEST_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const manifest = readJson(MANIFEST_PATH)
validateAuthorization()
validateExistingRun()

let reportResult
try {
  const sourceIndex = readJson(manifest.sourceIndexPath)
  const overfitRow = sourceIndex.samples.find((row) => row.sampleId === manifest.singleSampleOverfitSmoke?.sampleId)
  assert(overfitRow, "r2_smoke_selected_sample_not_found_in_source_index")
  const conditionPack = readJson(overfitRow.conditionPackPath)
  const previews = listPreviews()
  assert(previews.length === 7, `r2_smoke_preview_count_invalid:${previews.length}`)
  const reviews = []
  for (const preview of previews) {
    const normalizedPath = path.join(RUN_DIR, "fixed-preview-review-assets", `e${String(preview.epoch).padStart(3, "0")}.png`)
    assert(normalizedPath.length < 240, `r2_smoke_normalized_review_path_too_long:${normalizedPath.length}`)
    fs.mkdirSync(path.dirname(normalizedPath), { recursive: true })
    await sharp(preview.absolutePath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalizedPath),
      auditAiAssistedConditionAlignment({
        record: {
          recordId: `${RUN_ID}-epoch-${String(preview.epoch).padStart(3, "0")}`,
          conditionBinding: {
            conditionPackPath: overfitRow.conditionPackPath,
            worldId: conditionPack.worldId,
            tick: conditionPack.tick,
          },
          classification: overfitRow.classification,
        },
        imagePath: normalizedPath,
        referenceImagePath: overfitRow.imagePath,
      }),
    ])
    reviews.push({
      epoch: preview.epoch,
      recordedAtUtc: metricForEpoch(preview.epoch)?.recordedAtUtc ?? null,
      recordedAtAsiaShanghai: metricForEpoch(preview.epoch)?.recordedAtAsiaShanghai ?? null,
      previewPath: projectPath(preview.absolutePath),
      previewSha256: sha256File(preview.absolutePath),
      normalizedReviewImagePath: projectPath(normalizedPath),
      normalizedReviewImageSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  const reviewNow = new Date().toISOString()
  const reviewRecord = {
    schemaVersion: "ai-assisted-v7-r2-stage-preview-hard-gate-review-v1",
    runId: RUN_ID,
    createdAtUtc: reviewNow,
    createdAtAsiaShanghai: formatShanghai(reviewNow),
    status: reviews.every((review) => review.passed) ? "passed" : "failed",
    stage: 0,
    resolution: { width: 256, height: 192 },
    reviewAssetContract: "short_epoch_identity_under_existing_run_v1",
    sourcePreviewCount: reviews.length,
    passedPreviewCount: reviews.filter((review) => review.passed).length,
    failedPreviewCount: reviews.filter((review) => !review.passed).length,
    nextStageStarted: false,
    reviews,
    automaticStorage: true,
  }
  writeImmutableJson(PREVIEW_REVIEW_PATH, reviewRecord)
  appendEvent("r2_smoke_existing_preview_review_reconciled", reviewRecord.status === "passed" ? "success" : "failed", `reviewed=${reviews.length}; passed=${reviewRecord.passedPreviewCount}; failed=${reviewRecord.failedPreviewCount}`, projectPath(PREVIEW_REVIEW_PATH))

  const evaluated = manifest.metrics.filter((row) => Number.isFinite(row.validationCheckpointSelectionScore))
  const firstScore = evaluated.at(0)?.validationCheckpointSelectionScore ?? null
  const finalScore = evaluated.at(-1)?.validationCheckpointSelectionScore ?? null
  const qualityImproved = Number.isFinite(firstScore) && Number.isFinite(finalScore) && finalScore < firstScore
  const previewHardGatePassed = reviewRecord.status === "passed"
  const blockers = []
  if (!qualityImproved) blockers.push("single_sample_overfit_validation_score_did_not_improve")
  if (!previewHardGatePassed) blockers.push("stage_0_preview_machine_hard_gate_failed")
  const status = blockers.length === 0 ? "r2_single_sample_overfit_smoke_passed_stopped" : "r2_single_sample_overfit_smoke_failed_stopped"
  reportResult = writeFinalization({ status, blockers, reviews, metrics: { firstValidationCheckpointSelectionScore: firstScore, finalValidationCheckpointSelectionScore: finalScore, qualityImproved, previewHardGatePassed } })
  writeTerminalRegistration(reportResult)
  appendEvent("r2_smoke_record_closure_reconciled", blockers.length === 0 ? "success" : "failed", `${status}; existing previews only; no retraining`, reportResult.reportPath)
  console.log(JSON.stringify(reportResult, null, 2))
  if (blockers.length > 0) process.exitCode = 1
} catch (error) {
  const blockers = [String(error?.message ?? error)]
  reportResult = writeFinalization({ status: "r2_smoke_record_closure_reconciliation_failed_stopped", blockers, reviews: [], metrics: {} })
  writeTerminalRegistration(reportResult)
  appendEvent("r2_smoke_record_closure_reconciliation_failed", "failed", blockers.join(","), reportResult.reportPath)
  console.error(JSON.stringify(reportResult, null, 2))
  process.exitCode = 1
}

function validateAuthorization() {
  assert(fileHashMatches(REQUEST_PATH, REQUEST_SHA256), "record_closure_authorization_hash_invalid")
  assert(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "record_closure_consumption_hash_invalid")
  assert(authorization?.status === "resolved_owner_authorized", "record_closure_authorization_not_resolved")
  assert(authorization?.ownerDecision?.commandRef === COMMAND_REF, "record_closure_command_ref_invalid")
  assert(authorization?.ownerDecision?.scope === SCOPE, "record_closure_scope_invalid")
  assert(consumption?.status === "consumed_before_authorized_write", "record_closure_authorization_not_consumed")
  assert(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE, "record_closure_consumption_identity_invalid")
  for (const key of ["retrainingAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    assert(authorization?.resolution?.[key] === false, `record_closure_forbidden_boundary_invalid:${key}`)
  }
}

function validateExistingRun() {
  assert(manifest?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r2_smoke_manifest_status_invalid")
  assert(manifest?.singleSampleOverfitSmoke?.enabled === true && manifest?.singleSampleOverfitSmoke?.nonFormal === true, "r2_smoke_nonformal_identity_invalid")
  assert(manifest?.formalInferenceEligible === false && manifest?.denoiserTrained === false, "r2_smoke_promotion_boundary_invalid")
  assert(fileHashMatches(manifest.checkpointPath, manifest.checkpointSha256), "r2_smoke_checkpoint_hash_invalid")
  assert(!fs.existsSync(PREVIEW_REVIEW_PATH), "r2_smoke_preview_review_already_exists")
  assert(!fs.existsSync(TERMINAL_REGISTRATION_PATH), "r2_smoke_terminal_registration_already_exists")
  assert(!fs.existsSync(REPORT_PATH), "r2_smoke_reconciled_finalization_already_exists")
}

function listPreviews() {
  const root = path.join(RUN_DIR, "fixed-epoch-previews")
  return fs.readdirSync(root)
    .filter((name) => /^epoch-\d+.*\.png$/i.test(name))
    .map((name) => ({ name, epoch: Number(name.match(/^epoch-(\d+)/i)?.[1]), absolutePath: path.join(root, name) }))
    .sort((left, right) => left.epoch - right.epoch)
}

function metricForEpoch(epoch) { return manifest.metrics.find((row) => row.epoch === epoch) ?? null }

function writeFinalization({ status, blockers, reviews, metrics }) {
  const now = new Date().toISOString()
  const previewReviewExists = fs.existsSync(PREVIEW_REVIEW_PATH)
  const report = {
    schemaVersion: "ai-assisted-v7-r2-overfit-smoke-finalization-v1",
    reportId: REPORT_ID,
    runId: RUN_ID,
    status,
    createdAtUtc: now,
    createdAtAsiaShanghai: formatShanghai(now),
    reconciliationMode: "existing_saved_previews_only_no_retraining",
    authorizationPath: REQUEST_PATH,
    authorizationSha256: REQUEST_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    manifestPath: projectPath(MANIFEST_PATH),
    manifestSha256: sha256File(MANIFEST_PATH),
    checkpointPath: manifest.checkpointPath,
    checkpointSha256: manifest.checkpointSha256,
    timestepCoverage: manifest.timestepCoverage,
    previewReviewPath: previewReviewExists ? projectPath(PREVIEW_REVIEW_PATH) : null,
    previewReviewSha256: previewReviewExists ? sha256File(PREVIEW_REVIEW_PATH) : null,
    previewReviewStatus: previewReviewExists ? readJson(PREVIEW_REVIEW_PATH).status : "not_created_due_to_reconciliation_failure",
    previewCount: reviews.length,
    previewPassCount: reviews.filter((review) => review.passed).length,
    previewFailCount: reviews.filter((review) => !review.passed).length,
    metrics,
    blockers,
    gpuSmokeStarted: true,
    gpuSmokeCompleted: true,
    retrainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticStorage: true,
  }
  writeImmutableJson(REPORT_PATH, report)
  const result = { ...report, reportPath: projectPath(REPORT_PATH), reportSha256: sha256File(REPORT_PATH) }
  writeJsonAtomic(path.join(FINALIZATION_ROOT, "latest.json"), result)
  return result
}

function writeTerminalRegistration(report) {
  const record = {
    schemaVersion: "ai-assisted-v7-r2-smoke-run-terminal-registration-v1",
    runId: RUN_ID,
    status: report.status,
    registeredAtUtc: report.createdAtUtc,
    registeredAtAsiaShanghai: report.createdAtAsiaShanghai,
    manifestPath: report.manifestPath,
    manifestSha256: report.manifestSha256,
    checkpointPath: report.checkpointPath,
    checkpointSha256: report.checkpointSha256,
    previewReviewPath: report.previewReviewPath,
    previewReviewSha256: report.previewReviewSha256,
    previewReviewStatus: report.previewReviewStatus,
    finalizationReportPath: report.reportPath,
    finalizationReportSha256: report.reportSha256,
    blockers: report.blockers,
    retrainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticStorage: true,
  }
  writeImmutableJson(TERMINAL_REGISTRATION_PATH, record)
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "reconcile_ai_assisted_v7_r2_smoke_record_closure",
    runId: RUN_ID,
    kind,
    status,
    title: "V7 R2 Smoke automatic record closure reconciliation",
    titleZh: "V7 R2 Smoke自动记录闭环对账",
    detail,
    detailZh: detail,
    script: "scripts/reconcile-ai-assisted-v7-r2-smoke-record-closure.mjs",
    currentStep: kind,
    evidencePath,
    nextAction: "owner_review_machine_gate_result_before_any_new_training",
    nextActionZh: "项目所有者查看机器审核结果后，再独立决定是否授权新的有界修复或训练。",
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}

function readJson(value) { const resolved = resolvePath(value); return resolved && fs.existsSync(resolved) ? JSON.parse(fs.readFileSync(resolved, "utf8")) : null }
function resolvePath(value) { return value ? (path.isAbsolute(value) ? value : path.resolve(ROOT, value)) : null }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex") }
function fileHashMatches(value, expected) { const resolved = resolvePath(value); return Boolean(resolved && fs.existsSync(resolved) && sha256File(resolved) === expected) }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8") } finally { fs.closeSync(handle) } }
function writeJsonAtomic(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const temporary = `${value}.${process.pid}.tmp`; fs.writeFileSync(temporary, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.renameSync(temporary, value) }
function assert(condition, message) { if (!condition) throw new Error(message) }
