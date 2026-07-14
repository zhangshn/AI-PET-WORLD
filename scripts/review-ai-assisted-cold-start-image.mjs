import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

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
const issues = []
addIssue(info.width !== 1024 || info.height !== 768, "cold_start_formal_resolution_invalid", "Image must be 1024x768.")
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

const timestamp = new Date().toISOString()
const passed = issues.length === 0
const review = {
  schemaVersion: "ai-assisted-cold-start-machine-review-v1",
  reviewId: `ai-cold-start-machine-review-${recordId}-${timestamp.replace(/[:.]/g, "-")}`,
  recordId,
  status: passed ? "machine_contract_passed_waiting_owner_visual_review" : "machine_rejected",
  passed,
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
  issues,
  ownerVisualReviewRequired: true,
  aiAssistedColdStartEligible: false,
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
  reviews: {
    ...record.reviews,
    machineReviewStatus: review.status,
    machineReviewPath: projectPath(reviewPath),
    ownerReviewStatus: "pending_review",
  },
  updatedAtUtc: timestamp,
  updatedAtAsiaShanghai: formatShanghai(timestamp),
}
writeJsonAtomic(recordPath, updatedRecord)
updateIndex(updatedRecord)
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

function addIssue(condition, code, message) { if (condition) issues.push({ code, message }) }
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
