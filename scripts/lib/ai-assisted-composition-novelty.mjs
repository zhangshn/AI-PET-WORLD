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
  rejectedCompositionMinimumWaterLayoutIntersection: 0.65,
  rejectedCompositionMinimumRouteLayoutIntersection: 0.45,
}

export async function auditAiAssistedCompositionNovelty({ record, imagePath }) {
  const index = readJson(INDEX_PATH)
  const candidate = await fingerprint(imagePath)
  const comparisons = []
  let skippedRecordCount = 0

  for (const historicalRecord of index.records ?? []) {
    if (historicalRecord.categoryId !== "complete-maps" || historicalRecord.recordId === record.recordId) continue
    const historicalImagePath = resolveRecordImagePath(historicalRecord)
    if (!historicalImagePath || !fs.existsSync(historicalImagePath)) {
      skippedRecordCount += 1
      continue
    }
    try {
      const historical = await fingerprint(historicalImagePath)
      const ownerReview = readOwnerReview(historicalRecord)
      const comparison = {
        recordId: historicalRecord.recordId,
        imagePath: projectPath(historicalImagePath),
        imageSha256: historical.sha256,
        ownerReviewDecision: ownerReview?.decision ?? null,
        ownerReviewReasonCodes: ownerReview?.reasonCodes ?? [],
        dHashDistance: hammingDistance(candidate.dHash, historical.dHash),
        thumbnailDifference: thumbnailDifference(candidate.thumbnail, historical.thumbnail),
        blurredThumbnailDifference: thumbnailDifference(candidate.blurredThumbnail, historical.blurredThumbnail),
        waterLayoutIntersection: maskIntersectionOverUnion(candidate.waterMask, historical.waterMask),
        routeLayoutIntersection: maskIntersectionOverUnion(candidate.routeMask, historical.routeMask),
      }
      comparison.exactHashDuplicate = candidate.sha256 === historical.sha256
      comparison.nearExactDuplicate = comparison.dHashDistance <= THRESHOLDS.exactOrNearDuplicateMaximumDHashDistance
        && comparison.thumbnailDifference <= THRESHOLDS.exactOrNearDuplicateMaximumThumbnailDifference
      comparison.matchesRejectedCompositionPattern = ownerReview?.decision === "owner_rejected"
        && (ownerReview.reasonCodes ?? []).includes("composition_duplicate")
        && comparison.blurredThumbnailDifference <= THRESHOLDS.rejectedCompositionMaximumBlurredThumbnailDifference
        && (comparison.waterLayoutIntersection >= THRESHOLDS.rejectedCompositionMinimumWaterLayoutIntersection
          || comparison.routeLayoutIntersection >= THRESHOLDS.rejectedCompositionMinimumRouteLayoutIntersection)
      comparisons.push(comparison)
    } catch {
      skippedRecordCount += 1
    }
  }

  comparisons.sort((left, right) =>
    left.thumbnailDifference - right.thumbnailDifference
    || left.dHashDistance - right.dHashDistance)
  const exactMatches = comparisons.filter((entry) => entry.exactHashDuplicate || entry.nearExactDuplicate)
  const rejectedCompositionMatches = comparisons.filter((entry) => entry.matchesRejectedCompositionPattern)
  const issues = []
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

  return {
    schemaVersion: "ai-assisted-composition-novelty-audit-v1",
    status: issues.length === 0 ? "composition_novelty_passed" : "composition_novelty_failed",
    passed: issues.length === 0,
    candidateRecordId: record.recordId,
    candidateImagePath: projectPath(imagePath),
    candidateImageSha256: candidate.sha256,
    method: "sha256_plus_64x48_grayscale_and_blurred_structure_plus_water_route_layout_plus_9x8_difference_hash_v2",
    thresholds: THRESHOLDS,
    historicalCompleteMapImagesCompared: comparisons.length,
    skippedRecordCount,
    nearestComparisons: comparisons.slice(0, 8),
    exactMatches,
    rejectedCompositionMatches,
    issues,
  }
}

async function fingerprint(imagePath) {
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
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`path escapes project: ${value}`)
  return resolved
}
