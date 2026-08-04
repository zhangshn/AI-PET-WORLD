import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-action-request-v7-r5-single-sample-gpu-smoke-20260804"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/request.json`
const AUTHORIZATION_SHA256 = "0cf2ee01c351aa33f33ae08c6cf57243dce4d59368ec3fa9fd026c821fa8d713"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization-consumption.json`
const CONSUMPTION_SHA256 = "1c008d84fb6b977a29b48d139e992c8b832bfbad4954b3fbcc96ff2d19255938"
const COMMAND_REF = "owner-authorized-one-v7-r5-single-sample-gpu-overfit-smoke-20260804"
const SCOPE = "one_v7_r5_checkpoint_continuation_single_sample_gpu_overfit_smoke_with_fixed_preview_machine_review_and_terminal_only"
const RUN_ID = "ai-assisted-v7-repair-r5-checkpoint-continuation-single-sample-overfit-smoke-2026-08-04T10-07-52-619Z"
const RUN_DIR = resolve(`.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/${RUN_ID}`)
const FAILED_REPORT_PATH = ".runtime/ai-painter/v7-bounded-repair-r5-overfit-smoke-finalizations/ai-assisted-v7-r5-checkpoint-continuation-overfit-smoke-finalization-2026-08-04T10-07-52-619Z/finalization-report.json"
const FAILED_REPORT_SHA256 = "baa16c4b9adc24b5f09db1eacd4ba0c67a93154ae3d65848f2411d10e680b104"
const MANIFEST_PATH = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/${RUN_ID}/manifest.json`
const MANIFEST_SHA256 = "37fab710dab997d0ea390ffa9f8dcf337f21011ac37c7f40698c8a49d836686d"
const CHECKPOINT_PATH = `.runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7-repair-r5/${RUN_ID}/complete-world-ai-assisted-conditional-denoiser.pt`
const CHECKPOINT_SHA256 = "21198424af06d140c780540c345809841afc4fb2e19cd0c52419f62b58f5da42"
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-146-forested-low-mountain-v3"
const REQUIRED_TAIL_EPOCHS = [10, 20, 30]
const PREVIEWS = [
  [1, "epoch-001-v7-complete-map-146-seed-20263722.png", "2ea3c9a54be76a67c45713aee516b520f2b3229e37fc665e6127cce610dea3cb"],
  [10, "epoch-010-v7-complete-map-146-seed-20263722.png", "1e090ae2ac030d960a41035ae281009fa37a650cccbe381f4c47404cd6e173c5"],
  [20, "epoch-020-v7-complete-map-146-seed-20263722.png", "1ef731dc62e71255b123863693dbed004a7c65c4fa531673493a15c2e1052caa"],
  [30, "epoch-030-v7-complete-map-146-seed-20263722.png", "dbba94f21dc98d5207c32e284c34e6a08640fe333760c52806e077fdfa2a29f8"],
]
const now = new Date().toISOString()
const suffix = now.replace(/[:.]/g, "-")
const shortRoot = resolve(`.runtime/ai-painter/r5-review-assets/${suffix}`)
const reviewPath = path.join(RUN_DIR, "fixed-preview-hard-gate-review.json")
const terminalPath = path.join(RUN_DIR, "run-review-terminal-registration.json")
const closureRoot = resolve(`.runtime/ai-painter/v7-bounded-repair-r5-overfit-smoke-review-closures/r5-review-closure-${suffix}`)
const closurePath = path.join(closureRoot, "closure-report.json")

const authorization = readJson(AUTHORIZATION_PATH)
const consumption = readJson(CONSUMPTION_PATH)
const failedReport = readJson(FAILED_REPORT_PATH)
const manifest = readJson(MANIFEST_PATH)
const datasetPointer = readJson("data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json")
const datasetManifest = readJson(datasetPointer.manifestPath)
const sourceIndex = readJson(datasetManifest.sourceIndexPath)
const overfitRow = sourceIndex.samples.find((row) => row.sampleId === SAMPLE_ID && row.split === "train")

validateInputs()
appendEvent("r5_existing_smoke_machine_review_closure_started", "running", "existing previews only; training=false; checkpointLoad=false")
const reviews = await reviewPreviews()
const tailStabilityGate = evaluateTailStability(reviews)
const allPreviewHardGatePassed = reviews.length === PREVIEWS.length && reviews.every((row) => row.passed)
const blockers = []
if (!allPreviewHardGatePassed) blockers.push("stage_0_preview_machine_hard_gate_failed")
if (!tailStabilityGate.passed) blockers.push("r5_tail_three_consecutive_zero_recurrence_passes_missing")
const reviewReport = {
  schemaVersion: "ai-assisted-v7-r5-stage-preview-hard-gate-review-v1",
  createdAtUtc: now,
  createdAtAsiaShanghai: formatShanghai(now),
  status: blockers.length === 0 ? "passed" : "failed",
  stage: 0,
  runId: RUN_ID,
  reviewCount: reviews.length,
  passCount: reviews.filter((row) => row.passed).length,
  failCount: reviews.filter((row) => !row.passed).length,
  tailStabilityGate,
  reviewThresholdPolicy: "unchanged_existing_machine_review_contract",
  longPathCompatibilityRepair: {
    applied: true,
    reason: "windows_libvips_legacy_max_path_input_failure",
    originalsModified: false,
    shortPathCopiesHashMatched: reviews.every((row) => row.previewSha256 === row.shortPathReviewInputSha256),
  },
  reviews,
  nextStageStarted: false,
}
writeImmutableJson(reviewPath, reviewReport)
const closure = {
  schemaVersion: "ai-assisted-v7-r5-existing-smoke-review-closure-v1",
  status: blockers.length === 0 ? "r5_existing_smoke_review_passed_stopped" : "r5_existing_smoke_review_failed_stopped",
  createdAtUtc: now,
  createdAtAsiaShanghai: formatShanghai(now),
  runId: RUN_ID,
  authorizationPath: AUTHORIZATION_PATH,
  authorizationSha256: AUTHORIZATION_SHA256,
  authorizationConsumptionPath: CONSUMPTION_PATH,
  authorizationConsumptionSha256: CONSUMPTION_SHA256,
  priorFailedReportPath: FAILED_REPORT_PATH,
  priorFailedReportSha256: FAILED_REPORT_SHA256,
  priorFailurePreserved: true,
  priorFailureReason: failedReport.blockers,
  manifestPath: MANIFEST_PATH,
  manifestSha256: MANIFEST_SHA256,
  checkpointPath: CHECKPOINT_PATH,
  checkpointSha256: CHECKPOINT_SHA256,
  checkpointDeserializedByClosure: false,
  gpuTrainingStartedByClosure: false,
  reviewPath: projectPath(reviewPath),
  reviewSha256: sha256File(reviewPath),
  reviewStatus: reviewReport.status,
  previewCount: reviews.length,
  previewPassCount: reviewReport.passCount,
  previewFailCount: reviewReport.failCount,
  tailStabilityGate,
  blockers,
  automaticRetryStarted: false,
  fullTrainingStarted: false,
  strictRevalidationStarted: false,
  formalInferenceStarted: false,
  checkpointPromoted: false,
  runtimeFrameStarted: false,
  worldEntryStarted: false,
  nextIndependentAuthorization: blockers.length === 0 ? "v7_stage_0_1_2_full_training_only" : "bounded_r5_failure_learning_only",
}
writeImmutableJson(closurePath, closure)
writeImmutableJson(terminalPath, {
  schemaVersion: "ai-assisted-v7-r5-smoke-review-terminal-registration-v1",
  runId: RUN_ID,
  status: closure.status,
  registeredAtUtc: now,
  registeredAtAsiaShanghai: formatShanghai(now),
  priorTerminalPreserved: true,
  closureReportPath: projectPath(closurePath),
  closureReportSha256: sha256File(closurePath),
  reviewPath: projectPath(reviewPath),
  reviewSha256: sha256File(reviewPath),
  blockers,
  gpuTrainingStartedByClosure: false,
  fullTrainingStarted: false,
  strictRevalidationStarted: false,
  formalInferenceStarted: false,
  runtimeFrameStarted: false,
  worldEntryStarted: false,
})
const result = { ...closure, closureReportPath: projectPath(closurePath), closureReportSha256: sha256File(closurePath), terminalPath: projectPath(terminalPath), terminalSha256: sha256File(terminalPath) }
writeJson(resolve(".runtime/ai-painter/v7-bounded-repair-r5-overfit-smoke-review-closures/latest.json"), result)
appendEvent(blockers.length === 0 ? "r5_existing_smoke_machine_review_closure_completed" : "r5_existing_smoke_machine_review_closure_failed", blockers.length === 0 ? "success" : "failed", `${closure.status}; training=false; retry=false`, result.closureReportPath)
console.log(JSON.stringify(result, null, 2))
if (blockers.length > 0) process.exitCode = 1

function validateInputs() {
  const checks = [
    [fileHashMatches(AUTHORIZATION_PATH, AUTHORIZATION_SHA256), "r5_closure_authorization_hash_invalid"],
    [fileHashMatches(CONSUMPTION_PATH, CONSUMPTION_SHA256), "r5_closure_consumption_hash_invalid"],
    [authorization?.status === "resolved_owner_authorized", "r5_closure_authorization_not_resolved"],
    [authorization?.ownerDecision?.commandRef === COMMAND_REF && authorization?.ownerDecision?.scope === SCOPE, "r5_closure_authorization_identity_invalid"],
    [consumption?.status === "consumed_before_authorized_write", "r5_closure_authorization_not_consumed"],
    [fileHashMatches(FAILED_REPORT_PATH, FAILED_REPORT_SHA256), "r5_closure_failed_report_changed"],
    [failedReport?.status === "r5_checkpoint_continuation_single_sample_overfit_smoke_execution_failed_stopped", "r5_closure_prior_status_invalid"],
    [failedReport?.blockers?.length === 1 && failedReport.blockers[0].startsWith("Input file is missing:"), "r5_closure_prior_failure_not_long_path_only"],
    [fileHashMatches(MANIFEST_PATH, MANIFEST_SHA256), "r5_closure_manifest_changed"],
    [fileHashMatches(CHECKPOINT_PATH, CHECKPOINT_SHA256), "r5_closure_checkpoint_changed"],
    [manifest?.status === "conditional_denoiser_single_sample_overfit_smoke_completed", "r5_closure_training_not_completed"],
    [manifest?.metrics?.at(-1)?.epoch === 30, "r5_closure_epoch_count_invalid"],
    [manifest?.parentDenoiserCheckpointSha256 === authorization?.taskIdentity?.parentCheckpointSha256, "r5_closure_parent_checkpoint_invalid"],
    [Boolean(overfitRow), "r5_closure_overfit_sample_missing"],
    [!fs.existsSync(reviewPath) && !fs.existsSync(terminalPath) && !fs.existsSync(closurePath), "r5_closure_output_already_exists"],
  ]
  for (const [ok, code] of checks) if (!ok) throw new Error(code)
  for (const [, name, sha] of PREVIEWS) {
    const previewPath = path.join(RUN_DIR, "fixed-epoch-previews", name)
    if (!fileHashMatches(previewPath, sha)) throw new Error(`r5_closure_preview_identity_invalid:${name}`)
  }
}

async function reviewPreviews() {
  const conditionPack = readJson(overfitRow.conditionPackPath)
  const rows = []
  for (const [epoch, name, expectedSha] of PREVIEWS) {
    const originalPath = path.join(RUN_DIR, "fixed-epoch-previews", name)
    const shortInputPath = path.join(shortRoot, `e${String(epoch).padStart(3, "0")}-input.png`)
    const normalizedPath = path.join(shortRoot, `e${String(epoch).padStart(3, "0")}-normalized.png`)
    fs.mkdirSync(shortRoot, { recursive: true })
    fs.copyFileSync(originalPath, shortInputPath, fs.constants.COPYFILE_EXCL)
    if (sha256File(shortInputPath) !== expectedSha) throw new Error(`r5_closure_short_copy_hash_mismatch:${epoch}`)
    await sharp(shortInputPath).removeAlpha().resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest }).png().toFile(normalizedPath)
    const [aesthetic, alignment] = await Promise.all([
      auditAiAssistedProfessionalAesthetic(normalizedPath),
      auditAiAssistedConditionAlignment({ record: { recordId: `${RUN_ID}-epoch-${epoch}`, conditionBinding: { conditionPackPath: overfitRow.conditionPackPath, worldId: conditionPack.worldId, tick: conditionPack.tick }, classification: overfitRow.classification }, imagePath: normalizedPath, referenceImagePath: overfitRow.imagePath }),
    ])
    rows.push({
      epoch,
      recordedAtUtc: new Date().toISOString(),
      recordedAtAsiaShanghai: formatShanghai(new Date().toISOString()),
      previewPath: projectPath(originalPath),
      previewSha256: expectedSha,
      shortPathReviewInputPath: projectPath(shortInputPath),
      shortPathReviewInputSha256: sha256File(shortInputPath),
      normalizedReviewImagePath: projectPath(normalizedPath),
      normalizedReviewImageSha256: sha256File(normalizedPath),
      passed: aesthetic.passed && alignment.passed,
      issueCodes: [...aesthetic.issues, ...alignment.issues].map((issue) => issue.code),
      professionalAesthetic: aesthetic,
      conditionAlignment: alignment,
    })
  }
  return rows
}

function evaluateTailStability(reviews) {
  const byEpoch = new Map(reviews.map((row) => [row.epoch, row]))
  const evaluated = REQUIRED_TAIL_EPOCHS.map((epoch) => {
    const row = byEpoch.get(epoch)
    const issueCodes = row?.issueCodes ?? []
    return { epoch, recorded: Boolean(row), passed: Boolean(row?.passed && issueCodes.length === 0), pathIssueFree: !issueCodes.some((code) => code.includes("terrain_path_ground")), objectIssueFree: !issueCodes.some((code) => code.startsWith("condition_object_")), issueCodes }
  })
  const passed = evaluated.every((row) => row.recorded && row.passed && row.pathIssueFree && row.objectIssueFree)
  return { status: passed ? "r5_tail_stability_gate_passed" : "r5_tail_stability_gate_failed_closed", passed, requiredConsecutiveTailPasses: 3, evaluated }
}
function appendEvent(kind, status, detail, evidencePath = null) { appendAiPainterProgramEvent({ action: "close_ai_assisted_v7_r5_existing_smoke_review", runId: RUN_ID, kind, status, title: kind.replaceAll("_", " "), titleZh: `V7 R5既有Smoke审核闭环：${kind}`, detail, detailZh: detail, script: "scripts/close-ai-assisted-v7-r5-existing-smoke-review.mjs", currentStep: kind, evidencePath, finalGameMapSuccess: false, canEnterWorld: false }) }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`, "utf8") }
function writeImmutableJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function resolve(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function fileHashMatches(value, expected) { const absolute = resolve(value); return fs.existsSync(absolute) && sha256File(absolute) === expected }
