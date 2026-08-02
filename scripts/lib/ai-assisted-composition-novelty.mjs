import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const INDEX_PATH = path.join(LIBRARY_ROOT, "index.json")
const THRESHOLDS = {
  exactOrNearDuplicateMaximumDHashDistance: 4,
  exactOrNearDuplicateMaximumThumbnailDifference: 4,
  rejectedCompositionMaximumBlurredThumbnailDifference: 4,
  macroCompositionMaximumBlurredThumbnailDifference: 6,
  rejectedCompositionMinimumWaterLayoutIntersection: 0.65,
  rejectedCompositionMinimumRouteLayoutIntersection: 0.45,
  macroCompositionMinimumWaterLayoutIntersection: 0.7,
  macroCompositionMinimumRouteLayoutIntersection: 0.55,
  macroCompositionMinimumNormalizedWaterShapeIntersection: 0.45,
}
const IMAGE_FINGERPRINT_CACHE = new Map()

export async function auditAiAssistedCompositionNovelty({ record, imagePath }) {
  const index = readJson(INDEX_PATH)
  const candidate = await fingerprint(imagePath)
  const candidateCreatedAtMs = timestampMs(record.createdAtUtc)
  const comparisons = []
  let skippedRecordCount = 0
  let chronologyExcludedRecordCount = 0
  let chronologyEligibleRecordCount = 0
  const skippedHistoricalRecords = []

  for (const historicalRecord of index.records ?? []) {
    if (historicalRecord.categoryId !== "complete-maps" || historicalRecord.recordId === record.recordId) continue
    const historicalCreatedAtMs = timestampMs(historicalRecord.createdAtUtc)
    if (
      candidateCreatedAtMs !== null &&
      historicalCreatedAtMs !== null &&
      historicalCreatedAtMs > candidateCreatedAtMs
    ) {
      chronologyExcludedRecordCount += 1
      continue
    }
    chronologyEligibleRecordCount += 1
    const historicalImagePath = resolveRecordImagePath(historicalRecord)
    if (!historicalImagePath || !fs.existsSync(historicalImagePath)) {
      skippedRecordCount += 1
      skippedHistoricalRecords.push({
        recordId: historicalRecord.recordId,
        reason: historicalImagePath
          ? "historical_image_missing"
          : "historical_image_path_missing",
      })
      continue
    }
    try {
      const historical = await fingerprint(historicalImagePath)
      const ownerReview = readOwnerReview(historicalRecord)
      const recordedOwnerReviewReasonCodes = ownerReview?.reasonCodes ?? []
      const effectiveOwnerReviewReasonCodes =
        effectiveOwnerRejectionReasonCodes(ownerReview)
      const comparison = {
        recordId: historicalRecord.recordId,
        imagePath: projectPath(historicalImagePath),
        imageSha256: historical.sha256,
        ownerReviewDecision: ownerReview?.decision ?? null,
        ownerReviewReasonCodes: effectiveOwnerReviewReasonCodes,
        ownerReviewRecordedReasonCodes:
          recordedOwnerReviewReasonCodes,
        ownerReviewReasonCodesInferred:
          effectiveOwnerReviewReasonCodes.length !==
          recordedOwnerReviewReasonCodes.length,
        dHashDistance: hammingDistance(candidate.dHash, historical.dHash),
        thumbnailDifference: thumbnailDifference(candidate.thumbnail, historical.thumbnail),
        blurredThumbnailDifference: thumbnailDifference(candidate.blurredThumbnail, historical.blurredThumbnail),
        waterLayoutIntersection: maskIntersectionOverUnion(candidate.waterMask, historical.waterMask),
        normalizedWaterShapeIntersection: maskIntersectionOverUnion(
          candidate.normalizedWaterMask,
          historical.normalizedWaterMask,
        ),
        routeLayoutIntersection: maskIntersectionOverUnion(candidate.routeMask, historical.routeMask),
      }
      comparison.exactHashDuplicate = candidate.sha256 === historical.sha256
      comparison.nearExactDuplicate = comparison.dHashDistance <= THRESHOLDS.exactOrNearDuplicateMaximumDHashDistance
        && comparison.thumbnailDifference <= THRESHOLDS.exactOrNearDuplicateMaximumThumbnailDifference
      comparison.matchesMacroCompositionPattern =
        comparison.blurredThumbnailDifference <=
          THRESHOLDS.macroCompositionMaximumBlurredThumbnailDifference &&
        (comparison.waterLayoutIntersection >=
          THRESHOLDS.macroCompositionMinimumWaterLayoutIntersection ||
          comparison.normalizedWaterShapeIntersection >=
            THRESHOLDS.macroCompositionMinimumNormalizedWaterShapeIntersection ||
          comparison.routeLayoutIntersection >=
          THRESHOLDS.macroCompositionMinimumRouteLayoutIntersection)
      comparison.matchesRejectedCompositionPattern = ownerReview?.decision === "owner_rejected"
        && effectiveOwnerReviewReasonCodes.includes("composition_duplicate")
        && (
          comparison.matchesMacroCompositionPattern ||
          (
            comparison.blurredThumbnailDifference <=
              THRESHOLDS.rejectedCompositionMaximumBlurredThumbnailDifference &&
            (comparison.waterLayoutIntersection >=
              THRESHOLDS.rejectedCompositionMinimumWaterLayoutIntersection ||
              comparison.routeLayoutIntersection >=
              THRESHOLDS.rejectedCompositionMinimumRouteLayoutIntersection)
          )
        )
      comparison.matchesApprovedCompositionPattern = ownerReview?.decision === "owner_approved"
        && (
          comparison.matchesMacroCompositionPattern ||
          (
            comparison.blurredThumbnailDifference <=
              THRESHOLDS.rejectedCompositionMaximumBlurredThumbnailDifference &&
            (comparison.waterLayoutIntersection >=
              THRESHOLDS.rejectedCompositionMinimumWaterLayoutIntersection ||
              comparison.routeLayoutIntersection >=
              THRESHOLDS.rejectedCompositionMinimumRouteLayoutIntersection)
          )
        )
      comparisons.push(comparison)
    } catch (error) {
      skippedRecordCount += 1
      skippedHistoricalRecords.push({
        recordId: historicalRecord.recordId,
        reason: "historical_image_unreadable",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  comparisons.sort((left, right) =>
    left.thumbnailDifference - right.thumbnailDifference
    || left.dHashDistance - right.dHashDistance)
  const exactMatches = comparisons.filter((entry) => entry.exactHashDuplicate || entry.nearExactDuplicate)
  const rejectedCompositionMatches = comparisons.filter((entry) => entry.matchesRejectedCompositionPattern)
  const approvedCompositionMatches = comparisons.filter((entry) => entry.matchesApprovedCompositionPattern)
  const issues = []
  if (skippedRecordCount > 0) {
    issues.push(issue(
      "historical_complete_map_comparison_incomplete",
      `All chronology-eligible historical complete-map images must be compared; ${skippedRecordCount} record(s) were missing or unreadable.`,
      `所有时间顺序有效的历史完整地图都必须参与比较；有 ${skippedRecordCount} 条记录缺失或无法读取。`,
    ))
  }
  if (exactMatches.length > 0) {
    issues.push(issue(
      "historical_complete_map_exact_or_near_duplicate",
      `Candidate duplicates historical complete-map composition: ${exactMatches.map((entry) => entry.recordId).join(", ")}.`,
      `候选图与历史完整地图相同或近似重复：${exactMatches.map((entry) => entry.recordId).join("、")}。`,
    ))
  }
  if (rejectedCompositionMatches.length > 0) {
    issues.push(issue(
      "historical_rejected_composition_duplicate",
      `Candidate matches an owner-rejected composition pattern: ${rejectedCompositionMatches.map((entry) => entry.recordId).join(", ")}.`,
      `候选图命中项目所有者已拒绝的重复构图模式：${rejectedCompositionMatches.map((entry) => entry.recordId).join("、")}。`,
    ))
  }
  if (approvedCompositionMatches.length > 0) {
    issues.push(issue(
      "complete_map_composition_diversity_failed",
      `Candidate reuses an approved complete-map composition template: ${approvedCompositionMatches.map((entry) => entry.recordId).join(", ")}.`,
      `候选图复用了已通过完整地图的构图模板：${approvedCompositionMatches.map((entry) => entry.recordId).join("、")}。`,
    ))
  }

  return {
    schemaVersion: "ai-assisted-composition-novelty-audit-v1",
    status: issues.length === 0 ? "composition_novelty_passed" : "composition_novelty_failed",
    passed: issues.length === 0,
    candidateRecordId: record.recordId,
    candidateImagePath: projectPath(imagePath),
    candidateImageSha256: candidate.sha256,
    method: "chronology_bounded_sha256_plus_64x48_grayscale_and_blurred_structure_plus_position_invariant_normalized_water_shape_plus_macro_water_route_layout_plus_9x8_difference_hash_v6",
    thresholds: THRESHOLDS,
    historicalCompleteMapImagesCompared: comparisons.length,
    comparisonScope:
      "all_chronology_eligible_historical_complete_map_images",
    chronologyEligibleRecordCount,
    chronologyExcludedRecordCount,
    skippedRecordCount,
    skippedHistoricalRecords,
    nearestComparisons: comparisons.slice(0, 8),
    exactMatches,
    rejectedCompositionMatches,
    approvedCompositionMatches,
    issues,
  }
}

async function fingerprint(imagePath) {
  const cacheKey = path.resolve(imagePath)
  if (IMAGE_FINGERPRINT_CACHE.has(cacheKey)) {
    return IMAGE_FINGERPRINT_CACHE.get(cacheKey)
  }
  const fingerprintPromise = computeFingerprint(cacheKey)
  IMAGE_FINGERPRINT_CACHE.set(cacheKey, fingerprintPromise)
  return fingerprintPromise
}

async function computeFingerprint(imagePath) {
  const bytes = fs.readFileSync(imagePath)
  const thumbnail = await sharp(bytes, { failOn: "error" })
    .greyscale()
    .resize(64, 48, { fit: "fill", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer()
  const blurredThumbnail = await sharp(bytes, { failOn: "error" })
    .greyscale()
    .resize(64, 48, { fit: "fill" })
    .blur(6)
    .raw()
    .toBuffer()
  const structuralRgb = await sharp(bytes, { failOn: "error" })
    .removeAlpha()
    .resize(64, 48, { fit: "fill" })
    .blur(4)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const hashPixels = await sharp(bytes, { failOn: "error" })
    .greyscale()
    .resize(9, 8, { fit: "fill", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer()
  const dHash = []
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const offset = row * 9 + column
      dHash.push(hashPixels[offset] > hashPixels[offset + 1] ? 1 : 0)
    }
  }
  return {
    sha256: sha256(bytes),
    thumbnail,
    blurredThumbnail,
    dHash,
    waterMask: buildMask(structuralRgb, classifyWater),
    normalizedWaterMask: normalizeMaskShape(
      buildMask(structuralRgb, classifyWater),
      structuralRgb.info.width,
      structuralRgb.info.height,
      32,
      32,
    ),
    routeMask: buildMask(structuralRgb, classifyRoute),
  }
}

function thumbnailDifference(left, right) {
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference += Math.abs(left[index] - right[index])
  return Number((difference / left.length).toFixed(6))
}

function hammingDistance(left, right) {
  let distance = 0
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) distance += 1
  return distance
}

function buildMask(image, classify) {
  const mask = []
  for (let offset = 0; offset < image.data.length; offset += image.info.channels) {
    mask.push(classify(image.data[offset], image.data[offset + 1], image.data[offset + 2]) ? 1 : 0)
  }
  return mask
}

function maskIntersectionOverUnion(left, right) {
  let intersection = 0
  let union = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] || right[index]) union += 1
    if (left[index] && right[index]) intersection += 1
  }
  return Number((intersection / Math.max(1, union)).toFixed(6))
}

function normalizeMaskShape(mask, width, height, targetWidth, targetHeight) {
  let minimumX = width
  let maximumX = -1
  let minimumY = height
  let maximumY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      minimumX = Math.min(minimumX, x)
      maximumX = Math.max(maximumX, x)
      minimumY = Math.min(minimumY, y)
      maximumY = Math.max(maximumY, y)
    }
  }
  if (maximumX < minimumX || maximumY < minimumY) {
    return new Array(targetWidth * targetHeight).fill(0)
  }
  const normalized = []
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.round(
      minimumY +
        (y * (maximumY - minimumY)) /
          Math.max(1, targetHeight - 1),
    )
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.round(
        minimumX +
          (x * (maximumX - minimumX)) /
            Math.max(1, targetWidth - 1),
      )
      normalized.push(mask[sourceY * width + sourceX] ? 1 : 0)
    }
  }
  return normalized
}

function classifyWater(red, green, blue) {
  return blue > red * 1.12 && green > red * 1.08 && blue > green * 0.72 && blue >= 55
}

function classifyRoute(red, green, blue) {
  return red > green * 1.03 && green > blue * 1.12 && red > 80 && red < 230 && green > 55 && green < 190 && blue < 135
}

function readOwnerReview(record) {
  const reviewPath = record.reviews?.ownerReviewPath
  if (!reviewPath) return null
  const resolved = resolveProjectPath(reviewPath)
  return fs.existsSync(resolved) ? readJson(resolved) : null
}

function effectiveOwnerRejectionReasonCodes(review) {
  const reasonCodes = new Set(
    Array.isArray(review?.reasonCodes) ? review.reasonCodes : [],
  )
  if (
    review?.decision === "owner_rejected" &&
    [...reasonCodes].some(ownerReasonCodeDescribesCompositionDuplicate)
  ) {
    reasonCodes.add("composition_duplicate")
  }
  if (
    review?.decision === "owner_rejected" &&
    ownerCommentDescribesCompositionDuplicate(review)
  ) {
    reasonCodes.add("composition_duplicate")
  }
  return [...reasonCodes]
}

function ownerReasonCodeDescribesCompositionDuplicate(value) {
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized === "composition_duplicate" ||
    (
      /(duplicate|duplicated|reused|shared|same)/.test(normalized) &&
      /(composition|macro_structure|structure|framework|skeleton|layout|topology)/.test(normalized)
    )
  )
}

function ownerCommentDescribesCompositionDuplicate(review) {
  const normalized = [
    review?.comment,
    review?.notes,
    review?.nextTrainingTarget,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase()
  const duplicateSignal =
    /(重复|雷同|相同|一样|重新画|duplicate|duplicated|reus(?:e|ed|ing))/.test(normalized)
  const compositionSignal =
    /(构图|主体|框架|结构|布局|地图|河道|道路|composition|framework|template|layout|map|river|route)/.test(normalized)
  return duplicateSignal && compositionSignal
}

function resolveRecordImagePath(record) {
  if (!record.relativeDirectory || !record.originalImage?.path) return null
  return resolveProjectPath(path.join(record.relativeDirectory, record.originalImage.path))
}

function issue(code, message, messageZh) {
  return {
    code,
    message,
    messageZh,
    affectedRegion: "full_map_composition",
    nextTrainingTarget: "advance_to_next_unattempted_condition_without_historical_complete_map_image_references",
  }
}

function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function timestampMs(value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project: ${value}`)
  return resolved
}
