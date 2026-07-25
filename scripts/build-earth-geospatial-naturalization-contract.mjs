import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const CONTRACT_ID = "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1"
const SOURCE_REGISTRY_ID = "earth-geospatial-source-registry-v1"
const OWNER_AUTHORIZATION_REF = "owner-approved-real-geography-naturalization-route-20260724"
const DATA_ROOT = path.join(ROOT, "data", "world-samples", "earth-geospatial")
const SOURCE_REGISTRY_PATH = path.join(DATA_ROOT, "source-registry", `${SOURCE_REGISTRY_ID}.json`)
const REGION_ROOT = path.join(DATA_ROOT, "regions", CONTRACT_ID)
const REGION_CONTRACT_PATH = path.join(REGION_ROOT, "region-contract.json")
const NASA_POWER_RAW_PATH = path.join(REGION_ROOT, "sources", "nasa-power-climatology.json")
const RUNTIME_ROOT = ".runtime/ai-painter/earth-geospatial-naturalization-preflights"

const reference = readJson(
  path.join(
    ROOT,
    "data",
    "world-samples",
    "original-image-library",
    "natural-home-v1",
    "sakaerat-wang-nam-khiao-mvp-reference-v1.json",
  ),
)
const coordinate = reference.placeIdentity.referenceCoordinate
const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `earth-geospatial-naturalization-preflight-${createdAtUtc.replace(/[:.]/g, "-")}`

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_naturalization_preflight_started",
  title: "真实地理自然化数据预检已启动",
  titleEn: "Earth geospatial naturalization preflight started",
  summary: "程序开始核验地形、土地覆盖、气候和土壤来源；本轮不生成图片、不训练模型。",
  summaryEn: "The program started verifying terrain, land-cover, climate, and soil sources. This run generates no RGB and trains no model.",
  command: "npm run build:earth-geospatial-naturalization-contract",
  runId,
})

try {
  const urls = buildSourceUrls(coordinate)
  const [demHead, worldCoverHead, climateResponse, soilGridsHead] = await Promise.all([
    fetchHead(urls.copernicusDem),
    fetchHead(urls.worldCover),
    fetchJson(urls.nasaPower),
    fetchHead(urls.soilGridsDocumentation),
  ])

  const climateBytes = Buffer.from(`${JSON.stringify(climateResponse.body, null, 2)}\n`)
  writeImmutableFile(NASA_POWER_RAW_PATH, climateBytes)

  const sources = [
    {
      sourceId: "copernicus-dem-glo30-2021-n14e101",
      role: "terrain_elevation_measurement",
      provider: "Copernicus Programme / European Union / ESA",
      product: "Copernicus DEM GLO-30 Public 2021",
      sourceUrl: urls.copernicusDem,
      documentationUrl: "https://registry.opendata.aws/copernicus-dem/",
      resolution: "30_metre_class",
      license: "Copernicus WorldDEM-30 free licence for the general public",
      attribution:
        "Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.",
      acquisitionStatus: "remote_object_verified_not_downloaded",
      remoteObject: demHead,
      visualTrainingTargetEligible: false,
    },
    {
      sourceId: "esa-worldcover-2021-v200-n12e099",
      role: "land_cover_and_human_footprint_screening",
      provider: "European Space Agency",
      product: "ESA WorldCover 2021 v200",
      sourceUrl: urls.worldCover,
      documentationUrl: "https://esa-worldcover.org/en/data-access",
      resolution: "10_metres",
      license: "CC-BY-4.0",
      attribution: "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium.",
      acquisitionStatus: "remote_object_verified_not_downloaded",
      remoteObject: worldCoverHead,
      naturalizationClasses: {
        retainAsNaturalEvidence: [10, 20, 30, 60, 80, 90],
        removeOrReconstruct: [40, 50],
        excludedByCurrentMvpProfile: [95, 100],
      },
      visualTrainingTargetEligible: false,
    },
    {
      sourceId: "nasa-power-climatology-sakaerat-point-v1",
      role: "regional_climate_and_monsoon_context",
      provider: "NASA POWER",
      product: "Climatology point API",
      sourceUrl: urls.nasaPower,
      documentationUrl: "https://power.larc.nasa.gov/docs/services/api/",
      resolution: "regional_climate_context_not_terrain_geometry",
      license: "NASA publicly available data; project attribution required",
      attribution: "NASA POWER Project, NASA Langley Research Center",
      acquisitionStatus: "acquired_and_hashed",
      rawResponsePath: projectPath(NASA_POWER_RAW_PATH),
      rawResponseSha256: sha256(climateBytes),
      responseStatus: climateResponse.status,
      visualTrainingTargetEligible: false,
    },
    {
      sourceId: "isric-soilgrids-v2-0",
      role: "soil_property_context",
      provider: "ISRIC - World Soil Information",
      product: "SoilGrids 2.0",
      sourceUrl: "https://soilgrids.org/",
      documentationUrl: urls.soilGridsDocumentation,
      resolution: "250_metres",
      license: "CC-BY-4.0",
      attribution: "SoilGrids, ISRIC - World Soil Information",
      acquisitionStatus: "documentation_verified_data_not_acquired",
      remoteObject: soilGridsHead,
      visualTrainingTargetEligible: false,
    },
  ]

  const sourceRegistry = {
    schemaVersion: "earth-geospatial-source-registry-v1",
    sourceRegistryId: SOURCE_REGISTRY_ID,
    status: "active_preflight_verified",
    updatedAtUtc: createdAtUtc,
    updatedAtAsiaShanghai: createdAtAsiaShanghai,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    policy: {
      measurementsMayDeriveWorldFacts: true,
      externalRgbMayBecomeTrainingTarget: false,
      externalMapTilesMayBecomeVisualReference: false,
      externalPlaceNamesMayBecomeGameIdentity: false,
      exactRealWorldNavigationReplicationAllowed: false,
      sourceVersionLicenseAcquisitionTimeAndHashRequired: true,
    },
    sources,
  }
  writeJsonAtomic(SOURCE_REGISTRY_PATH, sourceRegistry)
  indexFile(SOURCE_REGISTRY_PATH, runId)
  indexFile(NASA_POWER_RAW_PATH, runId)

  const regionContract = {
    schemaVersion: "earth-geospatial-naturalization-region-contract-v1",
    contractId: CONTRACT_ID,
    status: "source_preflight_ready_derived_world_facts_pending",
    updatedAtUtc: createdAtUtc,
    updatedAtAsiaShanghai: createdAtAsiaShanghai,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    worldProfileId: reference.parentWorldProfileId,
    referenceId: reference.referenceId,
    referenceCoordinate: coordinate,
    observationArea: {
      status: "extent_not_yet_bound_to_game_world_scale",
      rule: "The Earth observation window must be selected from licensed measurements and normalized into game coordinates. Raster resolution must not be treated as game metres-per-pixel.",
      exactRealWorldGeometryDisplayAllowed: false,
    },
    inputs: sources.map((source) => ({
      sourceId: source.sourceId,
      role: source.role,
      acquisitionStatus: source.acquisitionStatus,
    })),
    naturalizationPipeline: [
      "verify_source_identity_version_license_and_hash",
      "acquire_elevation_land_cover_climate_and_soil_measurements",
      "screen_out_built_up_and_cropland_classes",
      "reject_or_reconstruct_artificial_linear_and_parcel_geometry",
      "derive_natural_relief_drainage_soil_moisture_and_ecological_zones",
      "normalize_derived_facts_into_game_world_coordinates",
      "build_world_facts_and_world_director_output",
      "compile_complete_map_level_23_channels",
      "run_complete_map_scope_and_novelty_gates",
    ],
    humanRemovalRules: {
      remove: [
        "buildings",
        "settlements",
        "urban_surface",
        "engineered_roads",
        "cropland_geometry",
        "parcel_boundaries",
        "artificial_reservoir_geometry",
      ],
      preserve: [
        "terrain_relief",
        "natural_drainage_tendency",
        "natural_waterbody_evidence",
        "soil_and_moisture_context",
        "natural_ecosystem_evidence",
      ],
      reconstructionRule:
        "Removed human land must be reconstructed from adjacent natural terrain, drainage, soil, and ecosystem facts before any WorldFact or 23-channel output is eligible.",
    },
    outputBoundary: {
      rawMeasurementIsWorldFact: false,
      derivedNaturalFactRequiresAudit: true,
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    blockers: [
      "geotiff_window_reader_not_implemented",
      "observation_extent_not_compiled",
      "human_removal_and_natural_reconstruction_not_executed",
      "derived_world_facts_missing",
      "complete_map_23_channels_missing",
    ],
  }
  writeJsonAtomic(REGION_CONTRACT_PATH, regionContract)
  indexFile(REGION_CONTRACT_PATH, runId)

  const report = {
    schemaVersion: "earth-geospatial-naturalization-preflight-report-v1",
    runId,
    status: "source_preflight_passed",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    sourceRegistryId: SOURCE_REGISTRY_ID,
    sourceRegistryPath: projectPath(SOURCE_REGISTRY_PATH),
    regionContractPath: projectPath(REGION_CONTRACT_PATH),
    verifiedSourceCount: sources.length,
    acquiredRawSourceCount: 1,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    derivedWorldFactsCreated: false,
    nextRequiredStep: "implement_geotiff_window_reader_and_compile_observation_extent",
  }
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "preflight-report.json",
    record: report,
    latest: {
      contractId: CONTRACT_ID,
      sourceRegistryPath: projectPath(SOURCE_REGISTRY_PATH),
      regionContractPath: projectPath(REGION_CONTRACT_PATH),
    },
  })

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_naturalization_preflight_completed",
    title: "真实地理自然化数据预检已完成",
    titleEn: "Earth geospatial naturalization preflight completed",
    summary: "四类来源已登记并核验；NASA气候原始响应已自动保存。没有生成图片或启动训练。",
    summaryEn: "Four source classes were registered and verified, and the raw NASA climate response was stored automatically. No RGB was generated and no training started.",
    command: "npm run build:earth-geospatial-naturalization-contract",
    runId,
    evidencePath: runPath,
  })
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  const failedAtUtc = new Date().toISOString()
  const failure = {
    schemaVersion: "earth-geospatial-naturalization-preflight-failure-v1",
    runId,
    status: "failed",
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    errorCode: "earth_geospatial_naturalization_preflight_failed",
    message: error instanceof Error ? error.message : String(error),
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  }
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "failure.json",
    record: failure,
  })
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: "earth_geospatial_naturalization_preflight_failed",
    title: "真实地理自然化数据预检失败",
    titleEn: "Earth geospatial naturalization preflight failed",
    summary: failure.message,
    summaryEn: failure.message,
    command: "npm run build:earth-geospatial-naturalization-contract",
    runId,
    evidencePath: runPath,
  })
  throw error
}

function buildSourceUrls({ latitude, longitude }) {
  const demLat = `${latitude >= 0 ? "N" : "S"}${String(Math.floor(Math.abs(latitude))).padStart(2, "0")}_00`
  const demLon = `${longitude >= 0 ? "E" : "W"}${String(Math.floor(Math.abs(longitude))).padStart(3, "0")}_00`
  const worldCoverLat = Math.floor(latitude / 3) * 3
  const worldCoverLon = Math.floor(longitude / 3) * 3
  const worldCoverTile = `${worldCoverLat >= 0 ? "N" : "S"}${String(Math.abs(worldCoverLat)).padStart(2, "0")}${worldCoverLon >= 0 ? "E" : "W"}${String(Math.abs(worldCoverLon)).padStart(3, "0")}`
  const nasaPower = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point")
  nasaPower.searchParams.set("parameters", "PRECTOTCORR,T2M,RH2M,WS2M")
  nasaPower.searchParams.set("community", "AG")
  nasaPower.searchParams.set("longitude", String(longitude))
  nasaPower.searchParams.set("latitude", String(latitude))
  nasaPower.searchParams.set("format", "JSON")
  return {
    copernicusDem: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_${demLat}_${demLon}_DEM/Copernicus_DSM_COG_10_${demLat}_${demLon}_DEM.tif`,
    worldCover: `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${worldCoverTile}_Map.tif`,
    nasaPower: nasaPower.toString(),
    soilGridsDocumentation: "https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html",
  }
}

async function fetchHead(url) {
  const response = await fetch(url, { method: "HEAD" })
  if (!response.ok) throw new Error(`source HEAD failed (${response.status}): ${url}`)
  return {
    status: response.status,
    contentLength: numberOrNull(response.headers.get("content-length")),
    contentType: response.headers.get("content-type"),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    checkedAtUtc: new Date().toISOString(),
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`source GET failed (${response.status}): ${url}`)
  return { status: response.status, body: await response.json() }
}

function writeImmutableFile(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath)
    if (!existing.equals(bytes)) throw new Error(`immutable source response differs: ${projectPath(filePath)}`)
    return
  }
  fs.writeFileSync(filePath, bytes)
}

function indexFile(filePath, runId) {
  const info = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: filePath.includes(`${path.sep}.runtime${path.sep}`) ? "hot" : "project",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
  })
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function numberOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
