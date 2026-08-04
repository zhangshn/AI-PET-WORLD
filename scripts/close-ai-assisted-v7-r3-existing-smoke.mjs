import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { evaluateTailStability, readR3SmokeManifestMetrics } from "./lib/ai-assisted-v7-r3-candidate.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r3-offline-closure-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "b9a5c800a46575cae488c2ebbd7c37cb7154816b1cae3a29ac5dcc5222ce065a"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "61ab49ec544602656c91ffd3042957cd5fc45913d5b68ca3bd429d5bc9c59cfd"
const COMMAND_REF = "owner-authorized-v7-r3-existing-smoke-offline-closure-20260804"
const SCOPE = "v7_r3_existing_smoke_metric_mapping_preview_review_tail_gate_and_terminal_closure_only"
const CANDIDATE_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r3-candidate-overlay.json"
const CANDIDATE_SHA256 = "6c013e05a36c85646b18fde12b5573049be8ea1703c47899f54956d468a2a501"
const R2_PATH = "data/ai-painter/system-governance/v7-bounded-repair-r2-training-overlay.json"
const R2_SHA256 = "888393b34fe24e588c83be7e9981f08739f2c6b85228584af57135d5889d7a6d"
const SOURCE_RUN_ID = "ai-assisted-v7-repair-r3-random-init-single-sample-overfit-smoke-2026-08-04T05-57-12-288Z"
const SOURCE_RUN_DIR = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r3/${SOURCE_RUN_ID}`
const SOURCE_MANIFEST_PATH = `${SOURCE_RUN_DIR}/manifest.json`
const SOURCE_MANIFEST_SHA256 = "a1e6f6120a9f4fa2a25592d2fb9962fb1783254366bad72f6767b21caec56735"
const SOURCE_CHECKPOINT_PATH = `${SOURCE_RUN_DIR}/complete-world-ai-assisted-conditional-denoiser.pt`
const SOURCE_CHECKPOINT_SHA256 = "01886bec3b72346b520d3f5918ad2d6d03e83e0a135cf20b34f4bddf7e8cf97e"
const SOURCE_FAILURE_PATH = ".runtime/ai-painter/v7-bounded-repair-r3-overfit-smoke-finalizations/ai-assisted-v7-r3-random-init-overfit-smoke-finalization-2026-08-04T05-57-12-288Z/finalization-report.json"
const SOURCE_FAILURE_SHA256 = "b79227797d0e240d0a4c7ed20c3acd3e71261c6de1df861ababaf3153d782d5a"
const SOURCE_SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const SOURCE_CONDITION_LABEL = "v7-complete-map-146"
const CLOSURE_ROOT = ".runtime/ai-painter/v7-bounded-repair-r3-offline-closures"
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const closureId = `ai-assisted-v7-r3-existing-smoke-offline-closure-${suffix}`
const closureDir = path.resolve(ROOT, CLOSURE_ROOT, closureId)
const startRegistrationPath = path.resolve(ROOT, CLOSURE_ROOT, "registrations", `${REQUEST_ID}.json`)

const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const candidate = readJson(CANDIDATE_PATH)
const sourceManifest = readJson(SOURCE_MANIFEST_PATH)
const sourceFailure = readJson(SOURCE_FAILURE_PATH)
const datasetManifest = readJson(sourceManifest?.datasetManifestPath)
const sourceIndex = readJson(sourceManifest?.sourceIndexPath)
const sourceRow = sourceIndex?.samples?.find((row) => row.sampleId === SOURCE_SAMPLE_ID)
const sourceHashesBefore = captureSourceHashes()

const blockers = validatePreflight()
if (blockers.length > 0) {
  console.error(JSON.stringify({ status: "r3_existing_smoke_offline_closure_preflight_failed", blockers }, null, 2))
  process.exit(1)
}

writeImmutableJson(startRegistrationPath, {
  schemaVersion: "ai-assisted-v7-r3-offline-closure-start-v1",
  closureId,
  requestId: REQUEST_ID,
  status: "offline_closure_registered_before_derived_evidence_write",
  registeredAtUtc: now,
  registeredAtAsiaShanghai: formatShanghai(now),
  sourceRunId: SOURCE_RUN_ID,
  sourceManifestPath: SOURCE_MANIFEST_PATH,
  sourceManifestSha256: SOURCE_MANIFEST_SHA256,
  sourceCheckpointPath: SOURCE_CHECKPOINT_PATH,
  sourceCheckpointSha256: SOURCE_CHECKPOINT_SHA256,
  trainingStarted: false,
  previewRegenerationStarted: false,
})
appendEvent("r3_existing_smoke_offline_closure_started", "running", "existing immutable previews only; training=false")

try {
  const reviews = await reviewExistingPreviews()
  const tailStability = evaluateTailStability(reviews, candidate.patch.training.smokeStabilityGate)
  const evaluatedMetrics = sourceManifest.metrics.filter((row) => Number.isFinite(row.validationCheckpointSelectionScore))
  const firstMetric = evaluatedMetrics.at(0) ?? {}
  const finalMetric = evaluatedMetrics.at(-1) ?? {}
  const mappedMetrics = readR3SmokeManifestMetrics(finalMetric)
  const qualityImproved = Number.isFinite(firstMetric.validationCheckpointSelectionScore)
    && Number.isFinite(finalMetric.validationCheckpointSelectionScore)
    && finalMetric.validationCheckpointSelectionScore < firstMetric.validationCheckpointSelectionScore
  const allPreviewHardGatePassed = reviews.length > 0 && reviews.every((review) => review.passed)
  const blockers = []
  if (mappedMetrics.missing.length > 0) blockers.push(...mappedMetrics.missing.map((field) => `r3_smoke_metric_missing_${field}`))
  if (!qualityImproved) blockers.push("single_sample_overfit_validation_score_did_not_improve")
  if (!allPreviewHardGatePassed) blockers.push("stage_0_preview_machine_hard_gate_failed")
  if (!tailStability.passed) blockers.push("r3_tail_three_consecutive_machine_passes_missing")
  const sourceHashesAfter = captureSourceHashes()
  if (!sameJson(sourceHashesAfter, sourceHashesBefore)) blockers.push("r3_offline_closure_source_evidence_changed")
  const status = blockers.length === 0
    ? "r3_existing_smoke_offline_closure_passed_stopped"
    : "r3_existing_smoke_offline_closure_failed_stopped"
  const reviewRecord = writeReviewRecord(reviews, tailStability)
  const report = writeFinalReport({
    status,
    blockers,
    reviews,
    reviewRecord,
    tailStability,
    mappedMetrics,
    firstMetric,
    finalMetric,
    qualityImproved,
    allPreviewHardGatePassed,
    sourceHashesBefore,
    sourceHashesAfter,
  })
  appendEvent(
    blockers.length === 0 ? "r3_existing_smoke_offline_closure_completed" : "r3_existing_smoke_offline_closure_failed",
    blockers.length === 0 ? "success" : "failed",
    `${status}; pass=${reviews.filter((row) => row.passed).length}; fail=${reviews.filter((row) => !row.passed).length}; training=false`,
    report.reportPath,
  )
  console.log(JSON.stringify(report, null, 2))
  if (blockers.length > 0) process.exitCode = 1
} catch (error) {
  const report = writeFailureReport(error)
  appendEvent("r3_existing_smoke_offline_closure_execution_failed", "failed", report.blockers.join(","), report.reportPath)
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
}

async function reviewExistingPreviews() {
  const previewRoot = path.resolve(ROOT, SOURCE_RUN_DIR, "fixed-epoch-previews")
  const files = fs.readdirSync(previewRoot).filter((name) => name.endsWith(".png")).sort()
  const reviews = []
  const conditionPack = readJson(sourceRow.conditionPackPath)
  for (const fileName of files) {
    const previewPath = path.join(previewRoot, fileName)
    const epoch = Number(fileName.match(/^epoch-(\d+)/)?.[1] ?? 0)
    const normalizedPath = path.join(closureDir, "review-assets", `e${String(epoch).padStart(3, "0")}.png`)
    fs.mkdirSync(path.dirname(normalizedPath), { recursive: true })
    await sharp(previewPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalizedPath),
      auditAiAssistedConditionAlignment({
        record: {
          recordId: `${SOURCE_RUN_ID}-${path.parse(fileName).name}`,
          conditionBinding: {
            conditionPackPath: sourceRow.conditionPackPath,
            worldId: conditionPack.worldId,
            tick: conditionPack.tick,
          },
          classification: sourceRow.classification,
        },
        imagePath: normalizedPath,
        referenceImagePath: sourceRow.imagePath,
      }),
    ])
    reviews.push({
      epoch,
      sourcePreviewPath: projectPath(previewPath),
      sourcePreviewSha256: sha256File(previewPath),
      normalizedReviewImagePath: projectPath(normalizedPath),
      normalizedReviewImageSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  return reviews
}

function validatePreflight() {
  const issues = []
  check(fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r3_offline_closure_authorization_hash_invalid")
  check(fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r3_offline_closure_consumption_hash_invalid")
  check(authorization?.status === "resolved_owner_authorized", "r3_offline_closure_authorization_not_resolved")
  check(authorization?.ownerDecision?.commandRef === COMMAND_REF, "r3_offline_closure_command_invalid")
  check(authorization?.ownerDecision?.scope === SCOPE, "r3_offline_closure_scope_invalid")
  check(consumption?.status === "consumed_before_authorized_write", "r3_offline_closure_not_consumed")
  check(consumption?.commandRef === COMMAND_REF && consumption?.scope === SCOPE, "r3_offline_closure_consumption_identity_invalid")
  for (const key of ["metricFieldMappingFixAuthorized", "existingCheckpointOfflineClosureAuthorized", "existingFixedPreviewMachineReviewAuthorized", "tailStabilityGateAuthorized", "terminalClosureStorageAuthorized"]) {
    check(authorization?.resolution?.[key] === true, `r3_offline_closure_${key}_missing`)
  }
  for (const key of ["trainingAuthorized", "fullTrainingAuthorized", "strictRevalidationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized", "runtimeFrameAuthorized", "worldEntryAuthorized"]) {
    check(authorization?.resolution?.[key] === false, `r3_offline_closure_boundary_${key}_invalid`)
  }
  check(fileHashMatches(CANDIDATE_PATH, CANDIDATE_SHA256), "r3_offline_closure_candidate_hash_invalid")
  check(fileHashMatches(R2_PATH, R2_SHA256), "r3_offline_closure_r2_hash_invalid")
  check(fileHashMatches(SOURCE_MANIFEST_PATH, SOURCE_MANIFEST_SHA256), "r3_offline_closure_manifest_hash_invalid")
  check(fileHashMatches(SOURCE_CHECKPOINT_PATH, SOURCE_CHECKPOINT_SHA256), "r3_offline_closure_checkpoint_hash_invalid")
  check(fileHashMatches(SOURCE_FAILURE_PATH, SOURCE_FAILURE_SHA256), "r3_offline_closure_failure_hash_invalid")
  check(sourceFailure?.status === "r3_random_init_single_sample_overfit_smoke_execution_failed_stopped", "r3_offline_closure_source_failure_status_invalid")
  check(sourceFailure?.runId === SOURCE_RUN_ID, "r3_offline_closure_source_run_identity_invalid")
  check(sourceManifest?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r3_offline_closure_manifest_status_invalid")
  check(sourceManifest?.singleSampleOverfitSmoke?.sampleId === SOURCE_SAMPLE_ID, "r3_offline_closure_sample_invalid")
  check(sourceManifest?.parentDenoiserCheckpointPath == null && sourceManifest?.parentDenoiserCheckpointSha256 == null, "r3_offline_closure_random_init_boundary_invalid")
  check(sourceManifest?.metrics?.at(-1)?.epoch === 120, "r3_offline_closure_epoch_count_invalid")
  check(fileHashMatches(sourceManifest?.datasetManifestPath, sourceManifest?.datasetManifestSha256), "r3_offline_closure_dataset_manifest_invalid")
  check(fileHashMatches(sourceManifest?.sourceIndexPath, sourceManifest?.sourceIndexSha256), "r3_offline_closure_source_index_invalid")
  check(datasetManifest?.packageId === sourceManifest?.datasetPackageId, "r3_offline_closure_dataset_identity_invalid")
  check(sourceRow?.conditionLabel === SOURCE_CONDITION_LABEL, "r3_offline_closure_condition_identity_invalid")
  check(sameJson(candidate?.patch?.training?.smokeStabilityGate?.tailEpochs, [100, 110, 120]), "r3_offline_closure_tail_epochs_invalid")
  check(candidate?.patch?.training?.smokeStabilityGate?.preserveReviewThresholds === true, "r3_offline_closure_review_threshold_boundary_invalid")
  const previewRoot = path.resolve(ROOT, SOURCE_RUN_DIR, "fixed-epoch-previews")
  const previewEpochs = fs.existsSync(previewRoot)
    ? fs.readdirSync(previewRoot).map((name) => Number(name.match(/^epoch-(\d+).*\.png$/)?.[1] ?? 0)).filter(Boolean)
    : []
  for (const epoch of [100, 110, 120]) check(previewEpochs.includes(epoch), `r3_offline_closure_tail_preview_${epoch}_missing`)
  check(!fs.existsSync(startRegistrationPath), "r3_offline_closure_authorization_already_started")
  return issues
  function check(condition, code) { if (!condition) issues.push(code) }
}

function writeReviewRecord(reviews, tailStability) {
  const reviewPath = path.join(closureDir, "fixed-preview-hard-gate-review.json")
  const record = {
    schemaVersion: "ai-assisted-v7-r3-existing-smoke-offline-preview-review-v1",
    closureId,
    sourceRunId: SOURCE_RUN_ID,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    status: reviews.length > 0 && reviews.every((row) => row.passed) && tailStability.passed ? "passed" : "failed",
    reviewCount: reviews.length,
    passCount: reviews.filter((row) => row.passed).length,
    failCount: reviews.filter((row) => !row.passed).length,
    tailStabilityGate: tailStability,
    reviewThresholdPolicy: "unchanged_existing_machine_review_contract",
    sourcePreviewsRegenerated: false,
    trainingStarted: false,
    reviews,
  }
  writeImmutableJson(reviewPath, record)
  return { path: projectPath(reviewPath), sha256: sha256File(reviewPath), status: record.status }
}

function writeFinalReport(input) {
  const reportPath = path.join(closureDir, "closure-report.json")
  const report = {
    schemaVersion: "ai-assisted-v7-r3-existing-smoke-offline-closure-v1",
    closureId,
    status: input.status,
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    sourceRunId: SOURCE_RUN_ID,
    sourceManifestPath: SOURCE_MANIFEST_PATH,
    sourceManifestSha256: SOURCE_MANIFEST_SHA256,
    sourceCheckpointPath: SOURCE_CHECKPOINT_PATH,
    sourceCheckpointSha256: SOURCE_CHECKPOINT_SHA256,
    sourceFailedFinalizationPath: SOURCE_FAILURE_PATH,
    sourceFailedFinalizationSha256: SOURCE_FAILURE_SHA256,
    previewReviewPath: input.reviewRecord.path,
    previewReviewSha256: input.reviewRecord.sha256,
    previewReviewStatus: input.reviewRecord.status,
    previewCount: input.reviews.length,
    previewPassCount: input.reviews.filter((row) => row.passed).length,
    previewFailCount: input.reviews.filter((row) => !row.passed).length,
    firstValidationCheckpointSelectionScore: input.firstMetric.validationCheckpointSelectionScore ?? null,
    finalValidationCheckpointSelectionScore: input.finalMetric.validationCheckpointSelectionScore ?? null,
    qualityImproved: input.qualityImproved,
    mappedFinalMetrics: input.mappedMetrics.values,
    missingMappedMetrics: input.mappedMetrics.missing,
    allPreviewHardGatePassed: input.allPreviewHardGatePassed,
    tailStability: input.tailStability,
    blockers: input.blockers,
    sourceHashesBefore: input.sourceHashesBefore,
    sourceHashesAfter: input.sourceHashesAfter,
    sourceEvidenceUnchanged: sameJson(input.sourceHashesBefore, input.sourceHashesAfter),
    offlineClosureOnly: true,
    trainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    checkpointPromoted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
    automaticStorage: true,
  }
  writeImmutableJson(reportPath, report)
  const result = { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
  writeImmutableJson(path.join(closureDir, "offline-closure-terminal-registration.json"), {
    schemaVersion: "ai-assisted-v7-r3-offline-closure-terminal-registration-v1",
    closureId,
    status: result.status,
    registeredAtUtc: result.createdAtUtc,
    registeredAtAsiaShanghai: result.createdAtAsiaShanghai,
    sourceRunId: SOURCE_RUN_ID,
    reportPath: result.reportPath,
    reportSha256: result.reportSha256,
    previewReviewPath: result.previewReviewPath,
    previewReviewSha256: result.previewReviewSha256,
    blockers: result.blockers,
    trainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
  })
  writeJsonAtomic(path.resolve(ROOT, CLOSURE_ROOT, "latest.json"), result)
  return result
}

function writeFailureReport(error) {
  const reportPath = path.join(closureDir, "closure-report.json")
  const blockers = [String(error?.message ?? error)]
  const report = {
    schemaVersion: "ai-assisted-v7-r3-existing-smoke-offline-closure-v1",
    closureId,
    status: "r3_existing_smoke_offline_closure_execution_failed_stopped",
    createdAtUtc: new Date().toISOString(),
    createdAtAsiaShanghai: formatShanghai(new Date().toISOString()),
    authorizationPath: AUTHORIZATION_PATH,
    authorizationSha256: AUTHORIZATION_SHA256,
    authorizationConsumptionPath: CONSUMPTION_PATH,
    authorizationConsumptionSha256: CONSUMPTION_SHA256,
    sourceRunId: SOURCE_RUN_ID,
    blockers,
    offlineClosureOnly: true,
    trainingStarted: false,
    fullTrainingStarted: false,
    strictRevalidationStarted: false,
    formalInferenceStarted: false,
    runtimeFrameStarted: false,
    worldEntryStarted: false,
  }
  writeImmutableJson(reportPath, report)
  const result = { ...report, reportPath: projectPath(reportPath), reportSha256: sha256File(reportPath) }
  writeJsonAtomic(path.resolve(ROOT, CLOSURE_ROOT, "latest.json"), result)
  return result
}

function captureSourceHashes() {
  return {
    candidate: sha256File(CANDIDATE_PATH),
    r2: sha256File(R2_PATH),
    manifest: sha256File(SOURCE_MANIFEST_PATH),
    checkpoint: sha256File(SOURCE_CHECKPOINT_PATH),
    failedFinalization: sha256File(SOURCE_FAILURE_PATH),
  }
}

function appendEvent(kind, status, detail, evidencePath = null) {
  appendAiPainterProgramEvent({
    action: "close_ai_assisted_v7_r3_existing_smoke_offline",
    runId: closureId,
    kind,
    status,
    title: kind.replaceAll("_", " "),
    titleZh: `V7 R3既有Smoke离线闭环：${kind}`,
    detail,
    detailZh: detail,
    script: "scripts/close-ai-assisted-v7-r3-existing-smoke.mjs",
    currentStep: kind,
    evidencePath,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}

function readJson(value) {
  const resolved = resolvePath(value)
  return resolved && fs.existsSync(resolved) ? JSON.parse(fs.readFileSync(resolved, "utf8")) : null
}
function resolvePath(value) { return value ? (path.isAbsolute(value) ? value : path.resolve(ROOT, value)) : null }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex") }
function fileHashMatches(value, expected) { const resolved = resolvePath(value); return Boolean(resolved && fs.existsSync(resolved) && sha256File(resolved) === expected) }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right) }
function writeImmutableJson(value, body) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  const handle = fs.openSync(value, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}
function writeJsonAtomic(value, body) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  const temporary = `${value}.${process.pid}.tmp`
  const handle = fs.openSync(temporary, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
  fs.renameSync(temporary, value)
}
