import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  buildStyleFingerprintModel,
  extractStyleFeatures,
} from "./ai-assisted-style-fingerprint.mjs"

const ROOT = process.cwd()

export const FOUNDATIONAL_STANDARD_SCHEMA = "foundational-complete-map-visual-standard-v2"
export const FOUNDATIONAL_STANDARD_STATUS = "foundational_complete_map_visual_standard_ready"
export const FOUNDATIONAL_RECORD_COUNT = 22
export const FOUNDATIONAL_WORLD_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"

export async function buildFoundationalCompleteMapVisualStandard(index) {
  const decisions = []
  const records = []

  for (const summary of index.records ?? []) {
    if (summary.categoryId !== "complete-maps") continue
    const sequence = foundationalSequence(summary.recordId)
    if (sequence == null) continue
    const recordPath = resolveProjectPath(summary.recordPath)
    const record = readJson(recordPath)
    const reasons = foundationalRejectionReasons(record, sequence)
    decisions.push({
      recordId: record.recordId,
      sequence,
      included: reasons.length === 0,
      reasons,
      recordPath: projectPath(recordPath),
    })
    if (reasons.length === 0) records.push({ record, recordPath, sequence })
  }

  records.sort((left, right) => left.sequence - right.sequence)
  decisions.sort((left, right) => left.sequence - right.sequence)
  assert(records.length === FOUNDATIONAL_RECORD_COUNT, `expected ${FOUNDATIONAL_RECORD_COUNT} approved foundational complete maps, received ${records.length}`)
  assert(records.every((entry, index) => entry.sequence === index + 1), "foundational complete-map sequence must be exactly 001 through 022")

  const styleSamples = []
  const compositionSamples = []
  const sourceEvidence = []
  for (const { record, recordPath, sequence } of records) {
    const imagePath = path.resolve(path.dirname(recordPath), record.originalImage.path)
    assertPathInsideProject(imagePath)
    assert(fs.existsSync(imagePath), `foundational image missing: ${record.recordId}`)
    const imageSha256 = sha256(fs.readFileSync(imagePath))
    assert(imageSha256 === record.originalImage.sha256, `foundational image hash mismatch: ${record.recordId}`)
    const metadata = await sharp(imagePath, { failOn: "error" }).metadata()
    assert(metadata.width === 1024 && metadata.height === 768, `foundational image must be 1024x768: ${record.recordId}`)

    const styleFeatures = await extractStyleFeatures(imagePath)
    styleSamples.push({ recordId: record.recordId, features: styleFeatures })
    compositionSamples.push(await extractAggregateCompositionFeatures(imagePath))

    const ownerReviewPath = resolveProjectPath(record.reviews.ownerReviewPath)
    assert(fs.existsSync(ownerReviewPath), `owner review missing: ${record.recordId}`)
    sourceEvidence.push({
      sequence,
      recordId: record.recordId,
      title: record.title,
      recordPath: projectPath(recordPath),
      recordSha256: sha256(fs.readFileSync(recordPath)),
      imageSha256,
      ownerReviewStatus: record.reviews.ownerReviewStatus,
      ownerReviewPath: projectPath(ownerReviewPath),
      ownerReviewSha256: sha256(fs.readFileSync(ownerReviewPath)),
      regionalLandscapeType: record.classification.regionalLandscapeType,
      knowledgeRole: record.classification.knowledgeRole,
    })
  }

  const styleModel = buildStyleFingerprintModel(styleSamples, [])
  const visualStyleStatistics = aggregateStyleModel(styleModel)
  const compositionStatistics = aggregateNamedVectors(compositionSamples)
  const landscapeCoverage = countValues(sourceEvidence.map((entry) => entry.regionalLandscapeType))
  const inputIdentity = {
    schemaVersion: FOUNDATIONAL_STANDARD_SCHEMA,
    worldProfileId: FOUNDATIONAL_WORLD_PROFILE_ID,
    sourceRecords: sourceEvidence.map((entry) => ({
      recordId: entry.recordId,
      recordSha256: entry.recordSha256,
      imageSha256: entry.imageSha256,
      ownerReviewSha256: entry.ownerReviewSha256,
    })),
  }
  const inputSha256 = sha256(Buffer.from(stableJson(inputIdentity)))

  return {
    schemaVersion: FOUNDATIONAL_STANDARD_SCHEMA,
    standardId: `foundational-complete-map-visual-standard-${inputSha256.slice(0, 16)}`,
    status: FOUNDATIONAL_STANDARD_STATUS,
    worldProfileId: FOUNDATIONAL_WORLD_PROFILE_ID,
    sourcePolicy: "owner_approved_foundational_complete_maps_001_through_022_aggregate_only_v2_no_preset_site_bias",
    inputSha256,
    sourceRecordCount: sourceEvidence.length,
    sourceEvidence,
    selectionAudit: {
      expectedSequence: "001-022",
      expectedCount: FOUNDATIONAL_RECORD_COUNT,
      decisions,
      allSourcesOwnerApproved: sourceEvidence.every((entry) => entry.ownerReviewStatus === "owner_approved"),
      allSourceImagesUnique: new Set(sourceEvidence.map((entry) => entry.imageSha256)).size === sourceEvidence.length,
    },
    visualStyleStatistics,
    compositionStatistics,
    landscapeCoverage,
    textualContract: buildTextualContract(),
    generatorProfile: buildGeneratorProfile({
      inputSha256,
      visualStyleStatistics,
      compositionStatistics,
      landscapeCoverage,
    }),
    historicalCompleteMapRgbReferencesAllowed: false,
    historicalCompleteMapRgbReferenceCount: 0,
    directSourceImagePathsExposedToGenerator: false,
    automaticStorage: true,
    ownerReviewStillRequiredForEveryGeneratedImage: true,
  }
}

export function validateFoundationalCompleteMapVisualStandard(standard) {
  const issues = []
  if (standard?.schemaVersion !== FOUNDATIONAL_STANDARD_SCHEMA) issues.push("foundational_standard_schema_mismatch")
  if (standard?.status !== FOUNDATIONAL_STANDARD_STATUS) issues.push("foundational_standard_not_ready")
  if (standard?.worldProfileId !== FOUNDATIONAL_WORLD_PROFILE_ID) issues.push("foundational_standard_world_profile_mismatch")
  if (standard?.sourceRecordCount !== FOUNDATIONAL_RECORD_COUNT) issues.push("foundational_standard_source_count_mismatch")
  if ((standard?.sourceEvidence ?? []).length !== FOUNDATIONAL_RECORD_COUNT) issues.push("foundational_standard_source_evidence_incomplete")
  if (!standard?.selectionAudit?.allSourcesOwnerApproved) issues.push("foundational_standard_contains_unapproved_source")
  if (!standard?.selectionAudit?.allSourceImagesUnique) issues.push("foundational_standard_contains_duplicate_source_image")
  if (standard?.historicalCompleteMapRgbReferencesAllowed !== false) issues.push("historical_complete_map_rgb_reference_not_forbidden")
  if (standard?.historicalCompleteMapRgbReferenceCount !== 0) issues.push("historical_complete_map_rgb_reference_count_nonzero")
  if (standard?.directSourceImagePathsExposedToGenerator !== false) issues.push("source_image_path_exposed_to_generator")
  if (!standard?.generatorProfile || hasImagePath(standard.generatorProfile)) issues.push("generator_profile_contains_historical_image_path")
  if (standard?.generatorProfile?.completeMapScope !== "complete_natural_home_region_not_local_scene") issues.push("generator_profile_complete_map_scope_missing")
  if (standard?.generatorProfile?.visualLanguage?.nativeWidth !== 1024 || standard?.generatorProfile?.visualLanguage?.nativeHeight !== 768) issues.push("generator_profile_native_resolution_mismatch")
  if (standard?.generatorProfile?.siteSelectionPolicy !== "initial_natural_world_no_preset_home_site") issues.push("generator_profile_site_selection_policy_invalid")
  if (standard?.compositionStatistics?.metrics?.centerQuietCoverage) issues.push("generator_profile_contains_center_quiet_bias")
  return { passed: issues.length === 0, issues }
}

function foundationalRejectionReasons(record, sequence) {
  const reasons = []
  if (sequence < 1 || sequence > FOUNDATIONAL_RECORD_COUNT) reasons.push("outside_foundational_sequence_001_022")
  if (record.categoryId !== "complete-maps") reasons.push("category_is_not_complete_maps")
  if (record.classification?.mapScope !== "complete-natural-home-map") reasons.push("map_scope_is_not_complete_natural_home_map")
  if (record.worldBinding?.worldProfileId !== FOUNDATIONAL_WORLD_PROFILE_ID) reasons.push("world_profile_mismatch")
  if (record.reviews?.ownerReviewStatus !== "owner_approved") reasons.push("owner_review_not_approved")
  if (record.status !== "ai_assisted_cold_start_eligible") reasons.push("record_not_cold_start_eligible")
  if (record.originalImage?.width !== 1024 || record.originalImage?.height !== 768) reasons.push("record_dimensions_not_1024x768")
  return reasons
}

function foundationalSequence(recordId) {
  const match = recordId?.match(/^ai-cold-start-map-(\d{3})-/)
  return match ? Number(match[1]) : null
}

async function extractAggregateCompositionFeatures(imagePath) {
  const { data, info } = await sharp(imagePath, { failOn: "error" })
    .removeAlpha()
    .resize(64, 48, { fit: "fill", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const counts = {
    waterCoverage: 0,
    vegetationCoverage: 0,
    earthCoverage: 0,
    darkBoundaryCoverage: 0,
    edgeDenseCoverage: 0,
  }
  const total = info.width * info.height
  let edgePixels = 0
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels
      const red = data[offset]
      const green = data[offset + 1]
      const blue = data[offset + 2]
      const maximum = Math.max(red, green, blue)
      const minimum = Math.min(red, green, blue)
      const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum
      const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255
      if (blue > red * 1.08 && blue > green * 1.02 && saturation > 0.2) counts.waterCoverage += 1
      if (green > red * 1.06 && green > blue * 1.05 && saturation > 0.18) counts.vegetationCoverage += 1
      if (red > blue * 1.18 && red >= green * 0.88 && green > blue * 1.05 && saturation > 0.12) counts.earthCoverage += 1
      const edge = x < 8 || x >= info.width - 8 || y < 6 || y >= info.height - 6
      if (edge) {
        edgePixels += 1
        if (luminance < 0.37 || (green > red * 1.08 && saturation > 0.2)) counts.edgeDenseCoverage += 1
        if (luminance < 0.3) counts.darkBoundaryCoverage += 1
      }
    }
  }
  return {
    featureVersion: "foundational-complete-map-composition-aggregate-feature-v2",
    featureNames: Object.keys(counts),
    vector: [
      counts.waterCoverage / total,
      counts.vegetationCoverage / total,
      counts.earthCoverage / total,
      counts.darkBoundaryCoverage / Math.max(1, edgePixels),
      counts.edgeDenseCoverage / Math.max(1, edgePixels),
    ].map((value) => round(value, 8)),
  }
}

function aggregateStyleModel(model) {
  return {
    featureVersion: model.featureVersion,
    featureNames: model.featureNames,
    aggregateMean: model.normalization.mean,
    aggregateScale: model.normalization.scale,
    approvedEnvelopeRadius: model.calibration.approvedEnvelopeRadius,
    calculationMethod: "owner_approved_foundational_images_aggregate_feature_statistics_v1",
  }
}

function aggregateNamedVectors(samples) {
  assert(samples.length > 0, "composition samples are required")
  const names = samples[0].featureNames
  const summary = {}
  names.forEach((name, index) => {
    const values = samples.map((sample) => sample.vector[index]).sort((left, right) => left - right)
    summary[name] = {
      mean: round(average(values), 8),
      q10: round(quantile(values, 0.1), 8),
      q50: round(quantile(values, 0.5), 8),
      q90: round(quantile(values, 0.9), 8),
      minimum: round(values[0], 8),
      maximum: round(values.at(-1), 8),
    }
  })
  return {
    featureVersion: samples[0].featureVersion,
    sourceCount: samples.length,
    aggregateOnly: true,
    sourceSpatialMasksPersisted: false,
    metrics: summary,
  }
}

function buildTextualContract() {
  return {
    completeMapScope: "One native 1024x768 frame must show the whole connected natural-home region, never a magnified local ecological scene.",
    cameraAndScale: "Use one distant elevated top-down slight three-quarter 2D game camera with stable world scale and object proportions.",
    compositionHierarchy: "The whole frame must read as entrance or exit relation, continuous natural passage organization, multiple recognizable spatial or ecological zones, natural boundary and large-world connectivity.",
    routeAndSiteAutonomy: "Routes must express only current world facts and large-world passage. Initial natural maps must not reserve a home site, activity center, building plot, construction clearing or route-convergence platform.",
    ecologicalZones: "Use multiple legible spaces and ecological zones governed by the current world facts; do not enlarge one river, road, pond, clearing or material patch to fill the canvas.",
    waterVariation: "Water appears only when current world facts require it; mainland Southeast Asia does not imply a water-dominated composition.",
    objectScaleAndDensity: "Trees, rocks and vegetation keep stable game scale, grounded footprints, readable clustering and playable negative space.",
    pixelLanguage: "Professional native 1024x768 high-resolution pure pixel art with crisp deliberate clusters, coherent outlines, grounding and occlusion.",
    colorAndLighting: "Use one coherent natural-light system and restrained tropical monsoon palette while allowing season and environment facts to change local color and density.",
    gameplayReadability: "Terrain, routes, boundaries, natural spaces, walkability and collision causes remain readable as a game map.",
    diversity: "Visual language stays unified while water, route, zone and ecology composition must be newly derived from the current facts and 23 channels.",
    forbidden: [
      "local_scene_not_complete_map",
      "historical_complete_map_rgb_reference",
      "historical_composition_copy",
      "single_feature_full_canvas",
      "tile_collage_or_repeated_stamp",
      "program_drawn_final_rgb",
      "preset_home_site_or_construction_clearing",
    ],
  }
}

function buildGeneratorProfile({ inputSha256, visualStyleStatistics, compositionStatistics, landscapeCoverage }) {
  return {
    schemaVersion: "foundational-complete-map-generator-profile-v2",
    inputSha256,
    completeMapScope: "complete_natural_home_region_not_local_scene",
    siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
    historicalCompleteMapRgbReferenceCount: 0,
    directHistoricalImageReferencesForbidden: true,
    visualLanguage: {
      nativeWidth: 1024,
      nativeHeight: 768,
      aspect: "4:3",
      camera: "distant_top_down_slight_three_quarter_2d",
      style: "professional_high_resolution_pure_pixel_game_map",
      styleFeatureVersion: visualStyleStatistics.featureVersion,
      styleFeatureNames: visualStyleStatistics.featureNames,
      aggregateMean: visualStyleStatistics.aggregateMean,
      aggregateScale: visualStyleStatistics.aggregateScale,
      approvedEnvelopeRadius: visualStyleStatistics.approvedEnvelopeRadius,
    },
    compositionEnvelope: compositionStatistics,
    landscapeCoverage,
    requiredWholeMapEvidence: [
      "boundary_entrance_or_exit_relation",
      "continuous_natural_passage",
      "multiple_recognizable_spatial_or_ecological_zones",
      "natural_boundary",
      "large_world_connectivity_semantics",
    ],
    waterPolicy: "current_world_facts_only",
    compositionDiversityRequired: true,
  }
}

function countValues(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function hasImagePath(value) {
  if (Array.isArray(value)) return value.some(hasImagePath)
  if (!value || typeof value !== "object") return false
  return Object.entries(value).some(([key, child]) => /imagePath|referenceImage|sourceImage/i.test(key) || hasImagePath(child))
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assertPathInsideProject(resolved)
  return resolved
}

function assertPathInsideProject(resolved) {
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${resolved}`)
}

function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function average(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) }
function quantile(sorted, ratio) { const index = (sorted.length - 1) * ratio; const lower = Math.floor(index); const upper = Math.ceil(index); return sorted[lower] * (upper - index) + sorted[upper] * (index - lower) }
function round(value, precision = 6) { const factor = 10 ** precision; return Math.round(value * factor) / factor }
function assert(condition, message) { if (!condition) throw new Error(message) }
