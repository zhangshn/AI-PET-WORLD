import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const LIBRARY_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const EARTH_ROOT = path.join(LIBRARY_ROOT, "earth-parameter-snapshots", "mainland-southeast-asia-reference-v1")
const EARTH_MANIFEST_PATH = path.join(EARTH_ROOT, "manifest.json")
const RAW_CLIMATE_PATH = path.join(EARTH_ROOT, "nasa-power-climatology-2001-2020.json")
const COVERAGE_PATH = path.join(LIBRARY_ROOT, "coverage-blueprint.json")
const WORLD_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const OWNER_AUTHORIZATION_REF = "project-owner-authorization-2026-07-22-seasonal-transition-environment-snapshots"

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const earthManifest = readJson(EARTH_MANIFEST_PATH)
const rawClimate = readJson(RAW_CLIMATE_PATH)
const coverage = readJson(COVERAGE_PATH)

assert(earthManifest.snapshotId === "mainland-southeast-asia-reference-v1", "Earth snapshot identity mismatch")
assert(earthManifest.worldProfileId === WORLD_PROFILE_ID, "Earth snapshot world profile mismatch")
assert(sha256(fs.readFileSync(RAW_CLIMATE_PATH)) === earthManifest.source.rawResponseSha256, "Earth raw response hash mismatch")

const definitions = [
  {
    snapshotId: "mainland-southeast-asia-tropical-monsoon-provisional-wet-to-dry-transition-v1",
    fileName: "provisional-visual-snapshot-wet-to-dry-transition-v1.json",
    season: "wet_to_dry_transition",
    monsoonPhase: "receding_monsoon_transition",
    sourceMonths: ["OCT", "NOV"],
    weather: "decreasing_rainfall_with_intervals_of_clear_weather",
    lighting: "warm_humid_to_drier_transition_daylight",
    groundMoisture: "moist_to_moderate",
    visibility: "clear_humid_air_to_light_seasonal_haze",
    wind: "light_to_moderate",
    visualIntent: [
      "show_a_complete_mainland_southeast_asian_wet_to_dry_transition_game_map",
      "show_receding_surface_moisture_without_turning_the_world_into_desert_or_late_dry_season",
      "preserve_defined_routes_water_bodies_ecological_zones_natural_boundaries_and_world_connections",
      "keep_pixel_style_camera_scale_grounding_and_game_readability_identical_to_the_locked_visual_standard",
    ],
  },
  {
    snapshotId: "mainland-southeast-asia-tropical-monsoon-provisional-dry-to-wet-transition-v1",
    fileName: "provisional-visual-snapshot-dry-to-wet-transition-v1.json",
    season: "dry_to_wet_transition",
    monsoonPhase: "pre_monsoon_rainfall_return_transition",
    sourceMonths: ["APR", "MAY"],
    weather: "intermittent_pre_monsoon_rain_with_clearing_intervals",
    lighting: "warm_pre_monsoon_diffuse_daylight",
    groundMoisture: "dry_to_moist",
    visibility: "humidity_building_with_light_storm_haze",
    wind: "light_to_moderate",
    visualIntent: [
      "show_a_complete_mainland_southeast_asian_dry_to_wet_transition_game_map",
      "show_returning_soil_moisture_and_vegetation_response_without_uniform_wet_season_saturation",
      "preserve_defined_routes_water_bodies_ecological_zones_natural_boundaries_and_world_connections",
      "keep_pixel_style_camera_scale_grounding_and_game_readability_identical_to_the_locked_visual_standard",
    ],
  },
]

const written = definitions.map((definition) => {
  const climateSummary = summarizeClimate(definition.sourceMonths)
  const outputPath = path.join(LIBRARY_ROOT, definition.fileName)
  const snapshot = {
    schemaVersion: "natural-home-visual-snapshot-v1",
    snapshotId: definition.snapshotId,
    status: "provisional_owner_authorized_profile_seasonal_transition",
    isFinal: false,
    createdAtUtc,
    createdAtAsiaShanghai,
    worldProfileId: WORLD_PROFILE_ID,
    biomeType: "tropical_monsoon_lowland_foothill_natural_home",
    regionBasis: "mainland_southeast_asia_tropical_monsoon_lowland_foothill",
    earthParameterSnapshotId: earthManifest.snapshotId,
    earthParameterSnapshotPath: projectPath(EARTH_MANIFEST_PATH),
    earthParameterRawResponsePath: projectPath(RAW_CLIMATE_PATH),
    earthParameterRawResponseSha256: earthManifest.source.rawResponseSha256,
    derivation: {
      method: "arithmetic_mean_of_locked_monthly_nasa_power_climatology_for_owner_authorized_transition_month_pair",
      sourceMonths: definition.sourceMonths,
      sourceClimatologyRange: earthManifest.source.climatologyRange,
      sourceTimeStandard: earthManifest.source.timeStandard,
      climateSummary,
      factsOnly: true,
      externalImagesUsed: false,
    },
    environment: {
      season: definition.season,
      monsoonPhase: definition.monsoonPhase,
      localTime: "10:00:00",
      timeZone: "Asia/Bangkok",
      weather: definition.weather,
      lighting: definition.lighting,
      groundMoisture: definition.groundMoisture,
      standingWaterOutsideDefinedWaterBodies: false,
      visibility: definition.visibility,
      wind: definition.wind,
    },
    visualStyle: lockedVisualStyle(),
    visualIntent: definition.visualIntent,
    usage: {
      originalImageCoverageBaseline: true,
      completeMapValidationBaseline: true,
      permanentWorldDefault: false,
      finalProductStandard: false,
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
    },
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    replacementRule: "This seasonal transition snapshot is additive. Existing records keep their original snapshotId and must not be relabeled or overwritten.",
    ownerDecision: "The project owner authorized deriving both monsoon transition environment snapshots from the locked NASA POWER 2001-2020 monthly climatology before V7 data-task construction.",
  }
  writeJson(outputPath, snapshot)
  return {
    snapshotId: definition.snapshotId,
    path: projectPath(outputPath),
    season: definition.season,
    environmentState: definition.monsoonPhase,
    isDefault: false,
    sha256: sha256(fs.readFileSync(outputPath)),
  }
})

const existingBySeason = new Map((coverage.availableVisualSnapshots ?? []).map((entry) => [entry.season, entry]))
for (const entry of written) existingBySeason.set(entry.season, omitHash(entry))
const seasonOrder = ["wet_season", "wet_to_dry_transition", "dry_season", "dry_to_wet_transition"]
coverage.availableVisualSnapshots = seasonOrder.map((season) => existingBySeason.get(season)).filter(Boolean)
coverage.updatedAt = createdAtAsiaShanghai
coverage.seasonalTransitionSnapshotAuthorizationRef = OWNER_AUTHORIZATION_REF
writeJson(COVERAGE_PATH, coverage)

const output = {
  status: "seasonal_transition_environment_snapshots_ready",
  createdAtUtc,
  createdAtAsiaShanghai,
  ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
  earthParameterSnapshotId: earthManifest.snapshotId,
  rawResponseSha256: earthManifest.source.rawResponseSha256,
  snapshots: written,
  availableSeasonCount: coverage.availableVisualSnapshots.length,
  imageGenerationStarted: false,
  gpuTrainingStarted: false,
  automaticStorage: true,
}
console.log(JSON.stringify(output, null, 2))

function summarizeClimate(months) {
  const parameters = rawClimate.properties?.parameter
  assert(parameters, "NASA POWER parameter block missing")
  return {
    meanDailyPrecipitationMmPerDay: mean(months.map((month) => parameters.PRECTOTCORR[month])),
    meanRelativeHumidityPercent: mean(months.map((month) => parameters.RH2M[month])),
    meanTemperatureC: mean(months.map((month) => parameters.T2M[month])),
    meanWindSpeedMps: mean(months.map((month) => parameters.WS2M[month])),
  }
}

function mean(values) {
  assert(values.every(Number.isFinite), "climate month value missing")
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

function lockedVisualStyle() {
  return {
    styleId: "natural-home-2d-high-resolution-pixel-style-v1",
    medium: "2d_high_resolution_pixel_style",
    nativeWidth: 1024,
    nativeHeight: 768,
    displayScale: 1,
    displayWidth: 1024,
    displayHeight: 768,
    displayInterpolation: "native_responsive_display",
    antiAliasingAllowed: "controlled_only_when_consistent_with_pixel_style",
    mechanicalTileCompositionAllowed: false,
    completeMapRequired: true,
    lowResolutionUpscaleAllowed: false,
    ordinaryDigitalIllustrationAllowed: false,
  }
}

function omitHash(entry) {
  const { sha256: _sha256, ...rest } = entry
  return rest
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function projectPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/")
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function formatShanghai(iso) {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso)).replace(" ", "T")
  return `${formatted}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
