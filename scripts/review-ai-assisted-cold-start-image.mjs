import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { appendAiPainterProgramEvent, projectPath as ledgerProjectPath } from "./lib/ai-painter-program-event-store.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"
import { auditImageAgainstLatestStyleFingerprint } from "./lib/ai-assisted-style-fingerprint.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditAiAssistedCompositionNovelty } from "./lib/ai-assisted-composition-novelty.mjs"
import { auditCompleteMapWorldFrameIntegrity } from "./lib/complete-map-world-frame-integrity.mjs"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const COVERAGE_BLUEPRINT_PATH = path.join(LIBRARY_ROOT, "coverage-blueprint.json")
const recordId = argumentValue("--record-id")
const categoryId = argumentValue("--category-id") ?? "complete-maps"
assert(recordId && /^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId), "usage: npm run review:ai-assisted-cold-start-image -- --record-id <id> [--category-id <category>]")
const recordPath = findRecordPath(categoryId, recordId)
assert(fs.existsSync(recordPath), "AI cold-start original image record is missing")
const record = readJson(recordPath)
assert(record.categoryId === categoryId, "record category mismatch")
assert(record.aiAssistedColdStart?.policyVersion === "owner-authorized-ai-assisted-cold-start-v1", "record is not in the authorized AI cold-start lane")
const coverageBlueprint = readJson(COVERAGE_BLUEPRINT_PATH)
const completeMapMetricContractActive = categoryId === "complete-maps"
const regionalLandscape = categoryId === "complete-maps"
  ? coverageBlueprint.regionalLandscapeTypes.find((item) => item.typeId === record.classification?.regionalLandscapeType)
  : null
if (categoryId === "complete-maps") assert(regionalLandscape, "record regional landscape type is not defined by the coverage blueprint")
const visualSnapshotPath = path.resolve(ROOT, record.worldBinding?.snapshotPath ?? "")
assert(isWithin(LIBRARY_ROOT, visualSnapshotPath), "record visual snapshot is outside the original image library")
assert(fs.existsSync(visualSnapshotPath), "record visual snapshot is missing")
const visualSnapshot = readJson(visualSnapshotPath)
assert(visualSnapshot.snapshotId === record.worldBinding?.snapshotId, "record visual snapshotId mismatch")
const monsoonSeason = record.classification?.monsoonSeason ?? visualSnapshot.environment?.season ?? null
assert(!record.classification?.monsoonSeason || record.classification.monsoonSeason === visualSnapshot.environment?.season, "record classification season does not match visual snapshot")
const wetSeasonMetricContractActive = completeMapMetricContractActive && monsoonSeason === "wet_season"
const drySeasonMetricContractActive = completeMapMetricContractActive && monsoonSeason === "dry_season"
const visibleFreshwaterRequired = regionalLandscape?.requiredFeatures.some((feature) => /(river|water|pond|creek|stream|marsh|swamp)/.test(feature)) ?? false
const minimumWaterSignalRatio = visibleFreshwaterRequired
  ? minimumWaterSignalRatioFor(regionalLandscape?.typeId)
  : null
const imagePath = path.resolve(path.dirname(recordPath), record.originalImage.path)
assert(fs.existsSync(imagePath), "stored image is missing")
const bytes = fs.readFileSync(imagePath)
assert(sha256(bytes) === record.originalImage.sha256, "stored image hash mismatch")
const { data, info } = await sharp(bytes, { failOn: "error" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const metrics = computeMetrics(data, info.width, info.height, info.channels)
const sourceResolutionAudit = await auditNativeGeneratedSource(record)
const issues = []
addIssue(info.width !== 1024 || info.height !== 768, "cold_start_formal_resolution_invalid", "Image must be 1024x768.")
for (const sourceIssue of sourceResolutionAudit.issues) addIssue(true, sourceIssue.code, sourceIssue.message)
addIssue(metrics.luminanceStdDev < 18, "cold_start_image_too_flat", "Image luminance variation is too low.")
addIssue(metrics.edgeDensity < 0.035, "cold_start_detail_density_too_low", "Image lacks enough structural detail for a complete map.")
addIssue(metrics.edgeDensity > 0.42, "cold_start_detail_density_too_noisy", "Image is excessively noisy for map readability.")
addIssue(wetSeasonMetricContractActive && metrics.greenDominantRatio < 0.18, "cold_start_wet_season_vegetation_signal_too_low", "Wet-season tropical vegetation signal is too low for a complete-map candidate.")
addIssue(drySeasonMetricContractActive && metrics.drySeasonCanopySignalRatio < 0.08, "cold_start_dry_season_canopy_signal_too_low", "Dry-season woodland canopy signal is too low.")
addIssue(drySeasonMetricContractActive && metrics.drySeasonGrassSignalRatio < 0.12, "cold_start_dry_season_grass_signal_too_low", "Dry-season grass and litter signal is too low.")
addIssue(drySeasonMetricContractActive && metrics.brightBareGroundRatio > 0.35, "cold_start_dry_season_desert_risk_too_high", "Bright bare ground dominates the dry-season candidate and risks a non-regional desert identity.")
addIssue(completeMapMetricContractActive && visibleFreshwaterRequired && metrics.waterSignalRatio < minimumWaterSignalRatio, "cold_start_water_signal_too_low", "Freshwater signal is too low for this regional landscape type.")
addIssue(record.worldBinding?.worldProfileId !== "mainland-southeast-asia-tropical-monsoon-natural-home-v1", "cold_start_world_profile_mismatch", "Record is not bound to the current tropical monsoon profile.")
addIssue(record.source?.thirdPartyGenerativeModelUsed !== true, "cold_start_generation_source_not_declared", "AI generation source is not declared.")
addIssue(record.aiAssistedColdStart?.independentTrainingEligible !== false, "cold_start_independent_claim_invalid", "AI cold-start data must not claim independent eligibility.")
const styleFingerprintAudit = await auditImageAgainstLatestStyleFingerprint(imagePath)
issues.push(...styleFingerprintAudit.issues)
const compositionNoveltyAudit = await auditAiAssistedCompositionNovelty({ record, imagePath })
issues.push(...compositionNoveltyAudit.issues)
const worldFrameIntegrityAudit = completeMapMetricContractActive
  ? await auditCompleteMapWorldFrameIntegrity({ record, imagePath })
  : null
if (worldFrameIntegrityAudit) issues.push(...worldFrameIntegrityAudit.issues)
const semanticConditionAudit = record.conditionBinding?.conditionPackPath
  ? await auditAiAssistedConditionAlignment({ record, imagePath })
  : null
if (semanticConditionAudit) issues.push(...semanticConditionAudit.issues)

const timestamp = new Date().toISOString()
const passed = issues.length === 0
const persistedOwnerReview = readPersistedOwnerReview(record)
const ownerAlreadyRejected = persistedOwnerReview?.decision === "owner_rejected"
const ownerAlreadyApproved = persistedOwnerReview?.decision === "owner_approved"
const effectiveOwnerReviewStatus = !passed
  ? "not_reached_machine_failed"
  : ownerAlreadyRejected
    ? "owner_rejected"
    : ownerAlreadyApproved
    ? "owner_approved"
    : "pending_review"
const review = {
  schemaVersion: "ai-assisted-cold-start-machine-review-v1",
  reviewId: `ai-cold-start-machine-review-${recordId}-${timestamp.replace(/[:.]/g, "-")}`,
  recordId,
  status: passed ? "machine_contract_passed_waiting_owner_visual_review" : "machine_rejected",
  passed,
  reviewerVersion: "ai-assisted-cold-start-machine-review-v9-water-connectivity-and-position-invariant-topology",
  title: passed ? "AI-assisted cold-start machine contract review passed" : "AI-assisted cold-start machine contract review failed",
  titleZh: passed ? "AI 辅助冷启动机器契约审核通过" : "AI 辅助冷启动机器契约审核失败",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  imagePath: projectPath(imagePath),
  imageSha256: record.originalImage.sha256,
  categoryReview: {
    categoryId,
    regionalLandscapeType: regionalLandscape?.typeId ?? null,
    monsoonSeason,
    environmentState: record.classification?.environmentState ?? visualSnapshot.environment?.monsoonPhase ?? null,
    visualSnapshotId: visualSnapshot.snapshotId,
    requiredFeatures: regionalLandscape?.requiredFeatures ?? [],
    metricContract: drySeasonMetricContractActive
      ? "complete_map_dry_season_metric_contract_v1"
      : wetSeasonMetricContractActive
        ? "complete_map_wet_season_metric_contract_v1"
        : completeMapMetricContractActive
          ? "complete_map_season_transition_generic_contract_v1"
          : "generic_image_integrity_plus_category_owner_review",
    metricThresholds: {
      minimumGreenDominantRatio: wetSeasonMetricContractActive ? 0.18 : null,
      minimumDrySeasonCanopySignalRatio: drySeasonMetricContractActive ? 0.08 : null,
      minimumDrySeasonGrassSignalRatio: drySeasonMetricContractActive ? 0.12 : null,
      maximumBrightBareGroundRatio: drySeasonMetricContractActive ? 0.35 : null,
    },
    visibleFreshwaterRequired,
    minimumWaterSignalRatio,
  },
  metrics,
  sourceResolutionAudit,
  styleFingerprintAudit,
  compositionNoveltyAudit,
  worldFrameIntegrityAudit,
  semanticConditionAudit,
  issues,
  affectedRegions: Array.from(new Set(issues.map((issue) => issue.affectedRegion))),
  nextTrainingTargets: Array.from(new Set(issues.map((issue) => issue.nextTrainingTarget))),
  ownerVisualReviewRequired: true,
  aiAssistedColdStartEligible: ownerAlreadyApproved && passed
    ? record.aiAssistedColdStartEligible === true
    : false,
  independentTrainingEligible: false,
  automaticStorage: true,
}
const reviewsRoot = path.join(path.dirname(recordPath), "reviews")
const reviewPath = path.join(reviewsRoot, "machine-review.json")
const reviewHistoryRoot = path.join(reviewsRoot, "machine")
if (fs.existsSync(reviewPath)) {
  const previousReview = readJson(reviewPath)
  if (previousReview.reviewId) {
    const previousHistoryPath = path.join(reviewHistoryRoot, `${previousReview.reviewId}.json`)
    if (!fs.existsSync(previousHistoryPath)) writeJsonAtomic(previousHistoryPath, previousReview)
  }
}
writeJsonAtomic(path.join(reviewHistoryRoot, `${review.reviewId}.json`), review)
writeJson(reviewPath, review)
const updatedRecord = {
  ...record,
  status: !passed
    ? "rejected"
    : ownerAlreadyRejected
      ? "rejected"
      : ownerAlreadyApproved
        ? record.status
        : "ai_assisted_cold_start_intake",
  blockReasons: passed && !ownerAlreadyRejected
    ? (record.blockReasons ?? []).filter((reason) => reason !== "machine_visual_review_rejected")
    : Array.from(new Set([...(record.blockReasons ?? []), "machine_visual_review_rejected"])),
  reviews: {
    ...record.reviews,
    machineReviewStatus: review.status,
    machineReviewPath: projectPath(reviewPath),
    ownerReviewStatus: effectiveOwnerReviewStatus,
  },
  conditionBinding: record.conditionBinding
    ? {
        ...record.conditionBinding,
        status: passed && semanticConditionAudit?.passed && ownerAlreadyApproved
          ? record.v7CapacityContribution?.status === "registered"
            ? "formal_conditional_training_eligible_owner_approved_v7_capacity_registered"
            : "formal_conditional_training_eligible_owner_approved"
          : passed && semanticConditionAudit?.passed
            ? "machine_semantic_alignment_passed_waiting_owner_review"
          : semanticConditionAudit?.passed
            ? "machine_visual_contract_failed"
            : "machine_semantic_alignment_failed",
        formalConditionalTrainingEligible: ownerAlreadyApproved && passed && semanticConditionAudit?.passed === true,
      }
    : record.conditionBinding,
  trainingEligibility: !passed
    ? "machine_rejected"
    : ownerAlreadyRejected
      ? "owner_rejected"
      : ownerAlreadyApproved
        ? record.trainingEligibility
        : "ai_assisted_cold_start_pending_review",
  aiAssistedColdStartEligible: ownerAlreadyApproved && passed,
  independentTrainingEligible: false,
  v7CapacityContribution:
    !passed && record.v7CapacityContribution?.status === "registered"
      ? {
          ...record.v7CapacityContribution,
          status: "withdrawn_machine_rejected",
          withdrawnAtUtc: timestamp,
          withdrawnAtAsiaShanghai: formatShanghai(timestamp),
          withdrawalReasonCodes: issues.map((issue) => issue.code),
          withdrawalMachineReviewId: review.reviewId,
        }
      : record.v7CapacityContribution,
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: formatShanghai(timestamp),
}
writeJsonAtomic(recordPath, updatedRecord)
updateIndex(updatedRecord)
appendJsonLine(path.join(LIBRARY_ROOT, "events.jsonl"), {
  schemaVersion: "original-image-library-event-v1",
  action: "ai_assisted_cold_start_machine_review_recorded",
  recordId,
  categoryId,
  status: review.status,
  passed,
  failureCodes: issues.map((issue) => issue.code),
  reviewPath: projectPath(reviewPath),
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: review.createdAtAsiaShanghai,
})
const ledgerEvent = appendAiPainterProgramEvent({
  action: "review_ai_assisted_cold_start_image",
  runId: review.reviewId,
  kind: passed ? "review_completed" : "step_failed",
  status: passed ? "info" : "failed",
  title: review.title,
  titleZh: review.titleZh,
  detail: passed
    ? "Machine contract passed; owner review and training gates remain pending."
    : `failureCodes=${issues.map((issue) => issue.code).join(",")}`,
  detailZh: passed
    ? "机器契约通过；项目所有者审核和训练门禁仍保持等待。"
    : `失败码=${issues.map((issue) => issue.code).join(",")}`,
  script: "scripts/review-ai-assisted-cold-start-image.mjs",
  currentStep: passed ? "waiting_owner_review" : "failure_backwrite",
  error: passed ? null : "ai_assisted_cold_start_machine_review_failed",
  errorZh: passed ? null : "AI 辅助冷启动候选图机器审核失败",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: recordId,
  evidencePath: ledgerProjectPath(reviewPath),
  nextAction: passed
    ? "wait_for_owner_review"
    : compositionNoveltyAudit.passed
      ? "repair_generation_constraints"
      : "advance_to_next_unattempted_condition_without_historical_complete_map_image_references",
  nextActionZh: passed
    ? "等待项目所有者审核"
    : compositionNoveltyAudit.passed
      ? "修复生成约束"
      : "不重试当前条件，移除历史完整地图图像参考并推进下一未生成条件",
})
if (!passed) {
  refreshGameMapAutoVisualJudgeLearning({
    trigger: "ai_assisted_cold_start_machine_review_failed",
    triggerEventId: ledgerEvent.id,
  })
}
console[passed ? "log" : "error"](JSON.stringify(review, null, 2))
process.exit(passed ? 0 : 1)

function computeMetrics(data, width, height, channels) {
  let sum = 0
  let sumSquares = 0
  let green = 0
  let blue = 0
  let water = 0
  let drySeasonCanopy = 0
  let drySeasonGrass = 0
  let brightBareGround = 0
  let edgeCount = 0
  let edgeComparisons = 0
  const luminance = new Uint8Array(width * height)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * channels
    const red = data[offset]
    const greenValue = data[offset + 1]
    const blueValue = data[offset + 2]
    const value = Math.round(red * 0.2126 + greenValue * 0.7152 + blueValue * 0.0722)
    luminance[pixel] = value
    sum += value
    sumSquares += value * value
    if (greenValue > red * 1.08 && greenValue > blueValue * 1.08) green += 1
    if (blueValue > red * 1.1 && blueValue > greenValue * 1.05) blue += 1
    if (blueValue > red * 1.12 && greenValue > red * 1.08 && blueValue > greenValue * 0.72 && blueValue >= 55) water += 1
    if (value < 105 && greenValue > blueValue * 1.12 && greenValue > red * 0.58) drySeasonCanopy += 1
    if (red >= 75 && red <= 205 && greenValue >= 55 && greenValue <= 180 && blueValue < greenValue * 0.82 && red / Math.max(1, greenValue) >= 0.92 && red / Math.max(1, greenValue) <= 1.75) drySeasonGrass += 1
    if (red > 175 && greenValue > 145 && blueValue > 105 && Math.max(red, greenValue, blueValue) - Math.min(red, greenValue, blueValue) < 70) brightBareGround += 1
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (x + 1 < width) { edgeComparisons += 1; if (Math.abs(luminance[index] - luminance[index + 1]) >= 24) edgeCount += 1 }
      if (y + 1 < height) { edgeComparisons += 1; if (Math.abs(luminance[index] - luminance[index + width]) >= 24) edgeCount += 1 }
    }
  }
  const count = width * height
  const mean = sum / count
  return {
    luminanceMean: round(mean),
    luminanceStdDev: round(Math.sqrt(sumSquares / count - mean * mean)),
    edgeDensity: round(edgeCount / edgeComparisons),
    greenDominantRatio: round(green / count),
    blueDominantRatio: round(blue / count),
    waterSignalRatio: round(water / count),
    drySeasonCanopySignalRatio: round(drySeasonCanopy / count),
    drySeasonGrassSignalRatio: round(drySeasonGrass / count),
    brightBareGroundRatio: round(brightBareGround / count),
  }
}

async function auditNativeGeneratedSource(value) {
  const approvedDerivativePolicy = "owner-approved-high-resolution-four-three-derivative-v1"
  const audit = {
    passed: false,
    requiredReviewSize: { width: 1024, height: 768 },
    acceptedSourceContract: "native_1024x768_or_no_smaller_exact_four_three_source",
    rawSize: null,
    reviewSize: null,
    sourceRoute: null,
    derivativePolicyVersion: null,
    transformation: null,
    rawGeneratedImagePath: value.source?.rawGeneratedImagePath ?? null,
    normalizationManifestPath: value.source?.normalizationManifestPath ?? null,
    issues: [],
  }
  const add = (code, message) => audit.issues.push({ code, message })
  try {
    const manifestPath = path.resolve(ROOT, value.source?.normalizationManifestPath ?? "")
    if (!value.source?.normalizationManifestPath || !isWithin(ROOT, manifestPath) || !fs.existsSync(manifestPath)) {
      add("cold_start_source_evidence_missing", "Generated source normalization evidence is missing.")
      return audit
    }
    const manifest = readJson(manifestPath)
    audit.transformation = manifest.transformation ?? null
    audit.derivativePolicyVersion = manifest.derivativePolicyVersion ?? null
    const rawPath = path.resolve(ROOT, manifest.rawGeneratedImagePath ?? "")
    if (!manifest.rawGeneratedImagePath || !isWithin(ROOT, rawPath) || !fs.existsSync(rawPath)) {
      add("cold_start_source_evidence_missing", "Raw generated source image is missing.")
      return audit
    }
    const rawBytes = fs.readFileSync(rawPath)
    const rawHash = sha256(rawBytes)
    const rawMetadata = await sharp(rawBytes, { failOn: "error" }).metadata()
    audit.rawSize = { width: rawMetadata.width ?? null, height: rawMetadata.height ?? null }
    const reviewPath = path.resolve(ROOT, manifest.normalizedImagePath ?? "")
    if (!manifest.normalizedImagePath || !isWithin(ROOT, reviewPath) || !fs.existsSync(reviewPath)) {
      add("cold_start_training_derivative_missing", "Stored 1024x768 training derivative is missing.")
      return audit
    }
    const reviewBytes = fs.readFileSync(reviewPath)
    const reviewHash = sha256(reviewBytes)
    const reviewMetadata = await sharp(reviewBytes, { failOn: "error" }).metadata()
    audit.reviewSize = { width: reviewMetadata.width ?? null, height: reviewMetadata.height ?? null }
    const rawWidth = rawMetadata.width ?? 0
    const rawHeight = rawMetadata.height ?? 0
    const sourceIsNative = rawWidth === 1024 && rawHeight === 768
    const sourceIsEligibleHighResolutionFourThree = rawWidth >= 1024
      && rawHeight >= 768
      && rawWidth * 3 === rawHeight * 4
    audit.sourceRoute = sourceIsNative
      ? "generator_native_1024x768"
      : "generator_native_high_resolution_four_three_with_audited_training_derivative"
    if (rawHash !== manifest.rawGeneratedImageSha256 || rawHash !== value.source?.rawGeneratedImageSha256) {
      add("cold_start_source_hash_mismatch", "Raw generated source hash does not match the stored evidence.")
    }
    if (rawWidth < 1024 || rawHeight < 768) {
      add("cold_start_source_resolution_too_small", `Raw generated source must be no smaller than 1024x768; received ${rawWidth}x${rawHeight}.`)
    }
    if (rawWidth * 3 !== rawHeight * 4) {
      add("cold_start_source_aspect_ratio_invalid", `Raw generated source must use an exact 4:3 aspect ratio; received ${rawWidth}x${rawHeight}.`)
    }
    if (reviewMetadata.width !== 1024 || reviewMetadata.height !== 768) {
      add("cold_start_training_derivative_resolution_invalid", `Stored training derivative must be 1024x768; received ${reviewMetadata.width}x${reviewMetadata.height}.`)
    }
    if (reviewHash !== manifest.normalizedImageSha256 || reviewHash !== value.originalImage?.sha256) {
      add("cold_start_training_derivative_hash_mismatch", "Stored training derivative hash does not match the normalization manifest and original-image record.")
    }
    if (manifest.derivativePolicyVersion !== approvedDerivativePolicy) {
      add("cold_start_derivative_policy_invalid", `Cold-start derivative policy is missing or invalid: ${manifest.derivativePolicyVersion ?? "missing"}.`)
    }
    if (manifest.sourceCrop !== null || manifest.resampling?.crop === true) {
      add("cold_start_source_crop_forbidden", "Cold-start training derivatives must not crop the generated source.")
    }
    if (manifest.resampling?.upscale === true) {
      add("cold_start_source_upscale_forbidden", "Cold-start training derivatives must not upscale the generated source.")
    }
    if (manifest.programDrawnRgbUsed !== false || manifest.formalCandidate !== false || manifest.directWorldDisplayAllowed !== false || manifest.runtimeFrameEligible !== false) {
      add("cold_start_derivative_role_invalid", "Cold-start derivative role isolation is missing or invalid.")
    }
    if (sourceIsNative) {
      if (manifest.transformation !== "none_native_1024x768" || rawHash !== reviewHash) {
        add("cold_start_source_transformation_forbidden", "Native 1024x768 sources must remain byte-identical to the stored review image.")
      }
    } else if (sourceIsEligibleHighResolutionFourThree) {
      if (manifest.transformation !== "nearest_neighbor_downsample_exact_four_three_to_1024x768"
        || manifest.resampling?.kernel !== "nearest"
        || manifest.resampling?.fit !== "fill_exact_four_three_no_crop") {
        add("cold_start_training_derivative_contract_invalid", "High-resolution 4:3 sources require the approved nearest-neighbor, no-crop 1024x768 derivative contract.")
      }
    }
  } catch (error) {
    add("cold_start_source_evidence_invalid", error instanceof Error ? error.message : String(error))
  }
  audit.passed = audit.issues.length === 0
  return audit
}

function updateIndex(record) {
  const indexPath = path.join(LIBRARY_ROOT, "index.json")
  const index = readJson(indexPath)
  const records = index.records.map((item) => item.recordId === record.recordId ? {
    ...item,
    status: record.status,
    reviews: record.reviews,
    updatedAtUtc: record.updatedAtUtc,
    updatedAtAsiaShanghai: record.updatedAtAsiaShanghai,
  } : item)
  writeJsonAtomic(indexPath, { ...index, updatedAt: record.updatedAtUtc, records })
}

function addIssue(condition, code, message) {
  if (!condition) return
  issues.push({
    code,
    message,
    messageZh: issueMessageZh(code),
    affectedRegion: inferAffectedRegion(code),
    nextTrainingTarget: inferNextTrainingTarget(code),
  })
}
function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function minimumWaterSignalRatioFor(regionalLandscapeType) {
  return regionalLandscapeType === "tropical-mountain-stream" ? 0.02 : 0.03
}
function findRecordPath(targetCategoryId, targetRecordId) {
  if (targetCategoryId === "complete-maps") return path.join(LIBRARY_ROOT, targetCategoryId, targetRecordId, "record.json")
  const categoryRoot = path.join(LIBRARY_ROOT, targetCategoryId)
  assert(fs.existsSync(categoryRoot), `original image category directory is missing: ${targetCategoryId}`)
  const matches = []
  collectRecordMatches(categoryRoot, targetRecordId, matches)
  assert(matches.length === 1, `expected one record for ${targetCategoryId}/${targetRecordId}, found ${matches.length}`)
  return matches[0]
}
function readPersistedOwnerReview(value) {
  const reviewValue = value.reviews?.ownerReviewPath
  if (!reviewValue) return null
  const reviewPath = path.resolve(ROOT, reviewValue)
  if (!fs.existsSync(reviewPath)) return null
  return readJson(reviewPath)
}
function collectRecordMatches(directory, targetRecordId, matches) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    const child = path.join(directory, entry.name)
    if (entry.name === targetRecordId && fs.existsSync(path.join(child, "record.json"))) matches.push(path.join(child, "record.json"))
    else collectRecordMatches(child, targetRecordId, matches)
  }
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`) }
function writeJsonAtomic(value, body) { const temp = `${value}.${process.pid}.tmp`; writeJson(temp, body); fs.renameSync(temp, value) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function isWithin(parent, child) { const root = path.resolve(parent); const target = path.resolve(child); return target === root || target.startsWith(`${root}${path.sep}`) }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function round(value) { return Math.round(value * 10000) / 10000 }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
function appendJsonLine(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.appendFileSync(value, `${JSON.stringify(body)}\n`, "utf8") }
function issueMessageZh(code) {
  const messages = {
    cold_start_formal_resolution_invalid: "图片不是原生 1024×768 正式画布。",
    cold_start_source_evidence_missing: "AI 生成原始文件或尺寸证据缺失。",
    cold_start_source_hash_mismatch: "AI 生成原始文件 hash 与存储证据不一致。",
    cold_start_source_native_resolution_invalid: "AI 生成原始文件不符合旧版原生 1024×768 契约。",
    cold_start_source_resolution_too_small: "AI 生成原始文件小于 1024×768。",
    cold_start_source_aspect_ratio_invalid: "AI 生成原始文件不是精确 4:3 画幅。",
    cold_start_source_transformation_forbidden: "AI 生成原始文件被裁切或缩放，不符合原生画布契约。",
    cold_start_training_derivative_missing: "1024×768 冷启动训练派生图缺失。",
    cold_start_training_derivative_resolution_invalid: "冷启动训练派生图不是 1024×768。",
    cold_start_training_derivative_hash_mismatch: "训练派生图 hash 与清单或原图库记录不一致。",
    cold_start_derivative_policy_invalid: "冷启动派生图政策版本缺失或不正确。",
    cold_start_source_crop_forbidden: "冷启动派生图发生了禁止的裁切。",
    cold_start_source_upscale_forbidden: "冷启动派生图发生了禁止的放大。",
    cold_start_derivative_role_invalid: "冷启动派生图没有与正式候选、Runtime 和世界展示隔离。",
    cold_start_training_derivative_contract_invalid: "高分辨率 4:3 原图没有按批准的最近邻无裁切契约生成训练派生图。",
    cold_start_source_evidence_invalid: "AI 生成原始文件证据无法解析。",
    cold_start_image_too_flat: "图片明暗变化不足，画面过于平坦。",
    cold_start_detail_density_too_low: "完整地图结构细节密度不足。",
    cold_start_detail_density_too_noisy: "画面噪声和细节密度过高，影响地图可读性。",
    cold_start_wet_season_vegetation_signal_too_low: "雨季热带植被信号不足。",
    cold_start_dry_season_canopy_signal_too_low: "旱季林冠信号不足。",
    cold_start_dry_season_grass_signal_too_low: "旱季草地和枯落物信号不足。",
    cold_start_dry_season_desert_risk_too_high: "明亮裸地占比过高，存在错误荒漠身份风险。",
    cold_start_water_signal_too_low: "该区域类型要求可见淡水，但水体信号不足。",
    cold_start_world_profile_mismatch: "图片没有绑定当前东南亚热带季风世界档案。",
    cold_start_generation_source_not_declared: "AI 生成来源没有如实声明。",
    cold_start_independent_claim_invalid: "AI 冷启动数据错误声明为独立训练数据。",
  }
  return messages[code] ?? code
}
function inferAffectedRegion(code) {
  if (/water/.test(code)) return "water_and_shoreline"
  if (/vegetation|canopy|grass/.test(code)) return "vegetation_and_ground"
  if (/source|resolution|detail|flat|noisy/.test(code)) return "complete_frame"
  return "record_contract"
}
function inferNextTrainingTarget(code) {
  if (/water/.test(code)) return "repair_freshwater_visibility_and_hydrology_readability"
  if (/vegetation|canopy|grass/.test(code)) return "repair_regional_vegetation_and_season_identity"
  if (/source|resolution|detail|flat|noisy/.test(code)) return "repair_native_pixel_detail_and_complete_map_readability"
  return "repair_source_and_world_binding_contract"
}
