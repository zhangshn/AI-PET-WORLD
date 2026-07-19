import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const APPROVED_DERIVATIVE_POLICY = "owner-approved-high-resolution-four-three-derivative-v1"
const failures = []
const intakeSource = readText("scripts/intake-ai-assisted-cold-start-image.mjs")
const finalizerSource = readText("scripts/finalize-ai-assisted-conditional-rgb-generation.mjs")
const reviewerSource = readText("scripts/review-ai-assisted-cold-start-image.mjs")
const reviewerVersion = reviewerSource.match(/reviewerVersion:\s*"([^"]+)"/)?.[1] ?? null

check(intakeSource.includes(APPROVED_DERIVATIVE_POLICY), "approved high-resolution 4:3 derivative policy is missing from intake")
check(intakeSource.includes("sourceMetadata.width * 3 === sourceMetadata.height * 4"), "exact 4:3 source gate is missing from intake")
check(intakeSource.includes("sourceMetadata.width >= TRAINING_WIDTH"), "minimum 1024x768 source gate is missing from intake")
check(intakeSource.includes("sharp.kernel.nearest"), "nearest-neighbor derivative generation is missing")
check(intakeSource.includes("fit: \"fill\""), "exact 4:3 no-crop derivative resize is missing")
check(intakeSource.includes("sourceCrop: null"), "no-crop evidence is missing")
check(intakeSource.includes("runtimeFrameEligible: false"), "cold-start derivative Runtime isolation is missing")
check(finalizerSource.includes("generated_rejected_source_contract"), "finalizer source-contract failure persistence is missing")
check(finalizerSource.includes("cold_start_source_aspect_ratio_invalid"), "finalizer aspect-ratio failure code is missing")
check(finalizerSource.includes("cold_start_source_resolution_too_small"), "finalizer minimum-resolution failure code is missing")
check(Boolean(reviewerVersion?.startsWith("ai-assisted-cold-start-machine-review-v")), "machine reviewer version contract is missing")
check(reviewerSource.includes(APPROVED_DERIVATIVE_POLICY), "machine reviewer does not verify the approved derivative policy")

const pointer = readJson(".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/latest.json")
check(pointer, "conditional RGB latest pointer is missing")
const request = pointer?.requestPath ? readJson(pointer.requestPath) : null
check(request, "conditional RGB request is missing")

if (!request?.originalImageRecordPath) {
  check(
    ["ready_for_openai_assisted_generation", "generation_failed_retryable", "generated_rejected_source_contract"].includes(request?.status),
    `request without original-image record has invalid status: ${request?.status ?? "missing"}`,
  )
  checkString(request?.createdAtUtc, "request UTC timestamp is missing")
  checkString(request?.createdAtAsiaShanghai, "request Asia/Shanghai timestamp is missing")
  checkFile(request?.promptEvidencePath, "request prompt evidence is missing")
  finish({
    requestId: request?.requestId ?? null,
    requestStatus: request?.status ?? null,
    recordId: null,
    sourceContractValid: null,
    pendingGeneration: request?.status === "ready_for_openai_assisted_generation",
  })
}

const record = readJson(request.originalImageRecordPath)
check(record, "conditional RGB original-image record is missing")
let sourceContractValid = false
let sourceRoute = null

if (record) {
  check(record.automaticStorage === true, "original-image record was not program-saved")
  checkString(record.createdAtUtc, "original-image UTC timestamp is missing")
  checkString(record.createdAtAsiaShanghai, "original-image Asia/Shanghai timestamp is missing")
  check(record.independentTrainingEligible === false, "AI-assisted record must not enter independent training")
  const imagePath = path.resolve(path.dirname(resolvePath(request.originalImageRecordPath)), record.originalImage?.path ?? "")
  checkFile(imagePath, "stored 1024x768 training/review image is missing")
  if (fileExists(imagePath)) check(sha256(fs.readFileSync(imagePath)) === record.originalImage.sha256, "stored training/review image hash mismatch")

  const libraryEvents = readJsonLines("data/world-samples/original-image-library/natural-home-v1/events.jsonl")
  check(libraryEvents.some((event) => event.recordId === record.recordId && event.action === "original_image_intaked"), "original-image intake event is missing")
  check(libraryEvents.some((event) => event.recordId === record.recordId && event.action === "ai_assisted_cold_start_machine_review_recorded"), "machine-review library event is missing")

  checkFile(record.reviews?.machineReviewPath, "machine review evidence is missing")
  const machineReview = readJson(record.reviews?.machineReviewPath)
  check(machineReview?.automaticStorage === true, "machine review was not program-saved")
  checkString(machineReview?.createdAtUtc, "machine review timestamp is missing")
  check(machineReview?.reviewerVersion === reviewerVersion, "stored machine review does not use the active reviewer version")

  const manifest = readJson(record.source?.normalizationManifestPath)
  check(manifest, "generated-source normalization manifest is missing")
  const rawImagePath = manifest?.rawGeneratedImagePath
  const derivativePath = manifest?.normalizedImagePath
  checkFile(rawImagePath, "raw generated source image is missing")
  checkFile(derivativePath, "1024x768 training derivative is missing")
  if (fileExists(rawImagePath) && fileExists(derivativePath)) {
    const rawBytes = fs.readFileSync(resolvePath(rawImagePath))
    const derivativeBytes = fs.readFileSync(resolvePath(derivativePath))
    const rawMetadata = await sharp(rawBytes, { failOn: "error" }).metadata()
    const derivativeMetadata = await sharp(derivativeBytes, { failOn: "error" }).metadata()
    const nativeSource = rawMetadata.width === 1024 && rawMetadata.height === 768
    const highResolutionFourThreeSource = (rawMetadata.width ?? 0) >= 1024
      && (rawMetadata.height ?? 0) >= 768
      && (rawMetadata.width ?? 0) * 3 === (rawMetadata.height ?? 0) * 4
    const derivativeHashValid = sha256(derivativeBytes) === manifest?.normalizedImageSha256
      && sha256(derivativeBytes) === record.originalImage?.sha256
    const commonContractValid = manifest?.derivativePolicyVersion === APPROVED_DERIVATIVE_POLICY
      && derivativeMetadata.width === 1024
      && derivativeMetadata.height === 768
      && derivativeHashValid
      && manifest?.sourceCrop === null
      && manifest?.programDrawnRgbUsed === false
      && manifest?.formalCandidate === false
      && manifest?.directWorldDisplayAllowed === false
      && manifest?.runtimeFrameEligible === false
    const nativeContractValid = nativeSource
      && manifest?.transformation === "none_native_1024x768"
      && sha256(rawBytes) === sha256(derivativeBytes)
    const derivativeContractValid = !nativeSource
      && highResolutionFourThreeSource
      && manifest?.transformation === "nearest_neighbor_downsample_exact_four_three_to_1024x768"
      && manifest?.resampling?.kernel === "nearest"
      && manifest?.resampling?.fit === "fill_exact_four_three_no_crop"
      && manifest?.resampling?.crop === false
      && manifest?.resampling?.upscale === false
    sourceRoute = nativeSource ? "generator_native_1024x768" : "high_resolution_four_three_with_training_derivative"
    sourceContractValid = commonContractValid && (nativeContractValid || derivativeContractValid)
    if (record.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review") {
      check(sourceContractValid, "machine-passed record does not satisfy the approved source/derivative contract")
    }
  }

  const ledgerEvents = readJsonLines(".runtime/ai-painter/training-process-ledger/events.jsonl")
  check(ledgerEvents.some((event) => event.archiveId === record.recordId && event.action === "review_ai_assisted_cold_start_image"), "machine review unified-ledger event is missing")
  if (record.reviews?.ownerReviewStatus === "owner_rejected") {
    checkFile(record.reviews?.ownerReviewPath, "owner rejection evidence is missing")
    const ownerReview = readJson(record.reviews?.ownerReviewPath)
    check(ownerReview?.automaticStorage === true, "owner review was not program-saved")
    check(Array.isArray(ownerReview?.reasonCodes) && ownerReview.reasonCodes.length > 0, "owner rejection failure codes are missing")
    checkString(ownerReview?.nextTrainingTarget, "owner rejection next training target is missing")
    check(ledgerEvents.some((event) => event.archiveId === record.recordId && event.action === "review_ai_assisted_cold_start_owner" && event.status === "failed"), "owner rejection unified-ledger event is missing")
  }
  if (record.reviews?.ownerReviewStatus === "owner_approved") {
    check(request.status === "generated_intaked_machine_passed_owner_approved", "owner-approved request status was not synchronized")
    check(request.ownerReviewPath === record.reviews.ownerReviewPath, "owner-approved request review path was not synchronized")
  }
}

finish({
  requestId: request.requestId,
  requestStatus: request.status,
  recordId: record?.recordId ?? null,
  machineReviewStatus: record?.reviews?.machineReviewStatus ?? null,
  ownerReviewStatus: record?.reviews?.ownerReviewStatus ?? null,
  trainingEligibility: record?.trainingEligibility ?? null,
  sourceRoute,
  sourceContractValid,
  pendingGeneration: false,
})

function finish(details) {
  const result = {
    ok: failures.length === 0,
    status: failures.length === 0
      ? "ai_assisted_conditional_rgb_automation_check_passed"
      : "ai_assisted_conditional_rgb_automation_check_failed",
    ...details,
    failures,
  }
  console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
  process.exit(failures.length === 0 ? 0 : 1)
}
function readText(value) { return fs.readFileSync(resolvePath(value), "utf8") }
function readJson(value) { try { return JSON.parse(fs.readFileSync(resolvePath(value), "utf8")) } catch { return null } }
function readJsonLines(value) { try { return fs.readFileSync(resolvePath(value), "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) } catch { return [] } }
function resolvePath(value) { return value ? (path.isAbsolute(value) ? value : path.resolve(ROOT, value)) : null }
function fileExists(value) { const resolved = resolvePath(value); return Boolean(resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) }
function checkFile(value, message) { check(fileExists(value), message) }
function checkString(value, message) { check(typeof value === "string" && value.length > 0, message) }
function check(condition, message) { if (!condition) failures.push(message) }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
