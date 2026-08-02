import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import zlib from "node:zlib"
import sharp from "sharp"
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
const SOURCE_REGISTRY_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "source-registry",
  "earth-geospatial-source-registry-v1.json",
)
const REGION_ROOT = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  CONTRACT_ID,
)
const REGION_CONTRACT_PATH = path.join(REGION_ROOT, "region-contract.json")
const OBSERVATION_EXTENT_PATH = path.join(REGION_ROOT, "observation-extent.json")
const RUNTIME_ROOT = ".runtime/ai-painter/earth-geospatial-naturalization-runs"
const CACHE_ROOT = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-source-cache",
)
const OUTPUT_WIDTH = 1024
const OUTPUT_HEIGHT = 768
const OFFICIAL_STUDY_AREA_HECTARES = 7808
const OFFICIAL_AREA_SOURCE = "https://whc.unesco.org/document/127655"
const NATURAL_CLASSES = new Set([10, 20, 30, 60, 80, 90, 95, 100])
const HUMAN_CLASSES = new Set([40, 50])
const EXPANDED_SLOT_123_SCOPE = process.argv.includes(
  "--expanded-slot-123-scope",
)
const BEYOND_NINE_BY_NINE_SLOT_123_SCOPE = process.argv.includes(
  "--beyond-nine-by-nine-slot-123-scope",
)
const OWNER_TAKEOVER_AUTHORIZATION_PATH =
  ".runtime/ai-painter/ai-assisted-v7-owner-takeover-authorizations/latest.json"
const EXPANDED_SCOPE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-expanded-real-measurement-window-scope-20260728"
const BEYOND_NINE_BY_NINE_AUTHORIZATION_PATH =
  ".runtime/ai-painter/earth-geospatial-v7-slot-123-scope-expansion-authorizations/latest.json"
const BEYOND_NINE_BY_NINE_AUTHORIZATION_ID =
  "owner-authorized-slot-123-thai-measurement-scope-beyond-9x9-no-rgb-20260729"

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `earth-geospatial-naturalization-${createdAtUtc.replace(/[:.]/g, "-")}`
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId)
const rawRoot = path.join(runRoot, "raw")
const normalizedRoot = path.join(runRoot, "normalized")
const humanRemovalRoot = path.join(runRoot, "human-removal")

const sourceRegistry = readJson(SOURCE_REGISTRY_PATH)
const regionContract = readJson(REGION_CONTRACT_PATH)
const center = regionContract.referenceCoordinate
const demSource = requireSource(sourceRegistry, "terrain_elevation_measurement")
const landCoverSource = requireSource(
  sourceRegistry,
  "land_cover_and_human_footprint_screening",
)

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_measurement_window_started",
  title: "真实地理测量窗口编译已启动",
  titleEn: "Earth geospatial measurement-window compilation started",
  summary:
    "程序开始采集并裁取Sakaerat官方范围对应的高程和土地覆盖窗口；本轮不生成RGB、不启动GPU训练。",
  summaryEn:
    "The program started acquiring and clipping elevation and land-cover measurements for the official Sakaerat study area. This run generates no RGB and starts no GPU training.",
  command: "npm run build:earth-geospatial-measurement-window",
  runId,
})

try {
  assert(
    !(EXPANDED_SLOT_123_SCOPE && BEYOND_NINE_BY_NINE_SLOT_123_SCOPE),
    "measurement scope flags are mutually exclusive",
  )
  if (EXPANDED_SLOT_123_SCOPE) {
    const authorization = readJson(OWNER_TAKEOVER_AUTHORIZATION_PATH)
    assert(
      authorization.windowScopeAuthorizationId ===
        EXPANDED_SCOPE_AUTHORIZATION_ID &&
        authorization.scope?.expandRealMeasurementWindowScopeForSlot123 ===
          true &&
        authorization.currentExecutionBoundary?.gpuTrainingStarted === false,
      "expanded slot-123 measurement scope is not owner-authorized",
    )
  }
  if (BEYOND_NINE_BY_NINE_SLOT_123_SCOPE) {
    const authorizationPointer = readJson(
      BEYOND_NINE_BY_NINE_AUTHORIZATION_PATH,
    )
    const authorization = readJson(authorizationPointer.runPath)
    assert(
      authorizationPointer.authorizationId ===
        BEYOND_NINE_BY_NINE_AUTHORIZATION_ID &&
      authorization.authorizationId ===
        BEYOND_NINE_BY_NINE_AUTHORIZATION_ID &&
        authorization.scope?.sameFormalThailandDataSourceOnly === true &&
        authorization.scope?.minimumNextOuterRingOnly === true &&
        authorization.scope?.conditionOnlyNoRgb === true &&
        authorization.scope?.worldConnectivityContractUnchanged === true &&
        authorization.scope?.reviewThresholdsUnchanged === true &&
        authorization.outputBoundary?.imageGenerationAuthorized === false &&
        authorization.outputBoundary?.gpuTrainingAuthorized === false,
      "beyond-9x9 slot-123 measurement scope is not owner-authorized",
    )
  }
  const observationExtent = buildObservationExtent(center)
  writeJsonAtomic(OBSERVATION_EXTENT_PATH, observationExtent)
  indexFile(OBSERVATION_EXTENT_PATH, runId)

  const demPath = path.join(CACHE_ROOT, demSource.sourceId, "source.tif")
  const landCoverPath = path.join(
    CACHE_ROOT,
    landCoverSource.sourceId,
    "source.tif",
  )
  const [demDownload, landCoverDownload] = await Promise.all([
    downloadCachedSource(demSource, demPath),
    downloadCachedSource(landCoverSource, landCoverPath),
  ])

  const demWindow = await readRasterWindow({
    filePath: demPath,
    sourceBounds: { west: 101, south: 14, east: 102, north: 15 },
    observationExtent,
    kernel: sharp.kernel.cubic,
    depth: "float",
  })
  const landCoverWindow = await readRasterWindow({
    filePath: landCoverPath,
    sourceBounds: { west: 99, south: 12, east: 102, north: 15 },
    observationExtent,
    kernel: sharp.kernel.nearest,
    depth: "uchar",
  })

  const demValues = firstFloatChannel(demWindow.data, demWindow.info.channels)
  const landCoverValues = decodeWorldCoverClasses(
    landCoverWindow.data,
    landCoverWindow.info.channels,
  )
  const humanRemoval = naturalizeHumanLandCover(landCoverValues)

  const demOutputPath = path.join(normalizedRoot, "elevation-f32-le.bin.gz")
  const landCoverOutputPath = path.join(
    normalizedRoot,
    "land-cover-u8.bin.gz",
  )
  const naturalizedOutputPath = path.join(
    humanRemovalRoot,
    "naturalized-land-cover-u8.bin.gz",
  )
  const humanMaskOutputPath = path.join(
    humanRemovalRoot,
    "human-removal-mask-u8.bin.gz",
  )
  writeGzipAtomic(demOutputPath, Buffer.from(demValues.buffer))
  writeGzipAtomic(landCoverOutputPath, Buffer.from(landCoverValues.buffer))
  writeGzipAtomic(
    naturalizedOutputPath,
    Buffer.from(humanRemoval.naturalized.buffer),
  )
  writeGzipAtomic(
    humanMaskOutputPath,
    Buffer.from(humanRemoval.removalMask.buffer),
  )

  const sourceAcquisitions = [
    buildSourceAcquisition(demSource, demDownload, demPath),
    buildSourceAcquisition(
      landCoverSource,
      landCoverDownload,
      landCoverPath,
    ),
  ]
  const measurementManifest = {
    schemaVersion: "earth-geospatial-measurement-window-manifest-v1",
    runId,
    status: "measurement_window_compiled",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    observationExtent,
    canvasNormalization: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      runtimeMetresPerPixelDefined: false,
      statement:
        "The Earth observation extent is normalized to game coordinates. This does not define runtime metres per pixel.",
    },
    sourceAcquisitions,
    rasterWindows: {
      elevation: {
        sourceId: demSource.sourceId,
        sourceMetadata: demWindow.metadata,
        sourcePixelWindow: demWindow.sourcePixelWindow,
        outputPath: projectPath(demOutputPath),
        outputSha256: sha256File(demOutputPath),
        statistics: floatStatistics(demValues),
      },
      landCover: {
        sourceId: landCoverSource.sourceId,
        sourceMetadata: landCoverWindow.metadata,
        sourcePixelWindow: landCoverWindow.sourcePixelWindow,
        outputPath: projectPath(landCoverOutputPath),
        outputSha256: sha256File(landCoverOutputPath),
        classHistogram: classHistogram(landCoverValues),
      },
    },
    humanRemoval: {
      observedHumanClasses: [40, 50],
      removedPixelCount: humanRemoval.removedPixelCount,
      removedRatio:
        humanRemoval.removedPixelCount / (OUTPUT_WIDTH * OUTPUT_HEIGHT),
      naturalizedLandCoverPath: projectPath(naturalizedOutputPath),
      naturalizedLandCoverSha256: sha256File(naturalizedOutputPath),
      removalMaskPath: projectPath(humanMaskOutputPath),
      removalMaskSha256: sha256File(humanMaskOutputPath),
      naturalizedClassHistogram: classHistogram(humanRemoval.naturalized),
      engineeredLinearFeaturesCovered: false,
      statement:
        "WorldCover removes observed cropland and built-up classes. Separate engineered linear-feature evidence is still required before derived WorldFacts are eligible.",
    },
    outputBoundary: {
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      rgbCreated: false,
      derivedWorldFactsCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    remainingBlockers: [
      "engineered_linear_feature_removal_evidence_missing",
      "soil_measurement_not_acquired",
      "natural_hydrology_derivation_missing",
      "derived_world_facts_missing",
      "complete_map_23_channels_missing",
    ],
  }

  for (const filePath of [
    demPath,
    landCoverPath,
    demOutputPath,
    landCoverOutputPath,
    naturalizedOutputPath,
    humanMaskOutputPath,
  ]) {
    indexFile(filePath, runId)
  }
  updateSourceRegistryAcquisitions(sourceAcquisitions)
  updateRegionContract(observationExtent, measurementManifest.remainingBlockers)

  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "measurement-window-manifest.json",
    record: measurementManifest,
    latest: {
      contractId: CONTRACT_ID,
      observationExtentPath: projectPath(OBSERVATION_EXTENT_PATH),
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  })

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_measurement_window_completed",
    title: "真实地理测量窗口编译已完成",
    titleEn: "Earth geospatial measurement-window compilation completed",
    summary:
      "程序已自动保存高程、土地覆盖、人类开发移除掩码和自然化覆盖结果；尚未生成世界事实、RGB或启动训练。",
    summaryEn:
      "The program automatically stored elevation, land cover, the human-removal mask, and naturalized land cover. It did not create WorldFacts, RGB, or training.",
    command: "npm run build:earth-geospatial-measurement-window",
    runId,
    evidencePath: runPath,
  })

  console.log(
    JSON.stringify(
      {
        runId,
        status: measurementManifest.status,
        observationExtent: observationExtent.bounds,
        dem: measurementManifest.rasterWindows.elevation.statistics,
        removedPixelCount: humanRemoval.removedPixelCount,
        remainingBlockers: measurementManifest.remainingBlockers,
        imageGenerationStarted: false,
        gpuTrainingStarted: false,
      },
      null,
      2,
    ),
  )
} catch (error) {
  const failedAtUtc = new Date().toISOString()
  const failure = {
    schemaVersion: "earth-geospatial-measurement-window-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    errorCode: "earth_geospatial_measurement_window_failed",
    error: error instanceof Error ? error.message : String(error),
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  }
  fs.mkdirSync(runRoot, { recursive: true })
  const failurePath = path.join(runRoot, "failure.json")
  writeJsonAtomic(failurePath, failure)
  indexFile(failurePath, runId)
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: "earth_geospatial_measurement_window_failed",
    title: "真实地理测量窗口编译失败",
    titleEn: "Earth geospatial measurement-window compilation failed",
    summary: failure.error,
    summaryEn: failure.error,
    command: "npm run build:earth-geospatial-measurement-window",
    runId,
    evidencePath: projectPath(failurePath),
  })
  throw error
}

function buildObservationExtent(referenceCoordinate) {
  const areaSquareKilometres = OFFICIAL_STUDY_AREA_HECTARES / 100
  const baseWidthKilometres = Math.sqrt((areaSquareKilometres * 4) / 3)
  const baseHeightKilometres = Math.sqrt((areaSquareKilometres * 3) / 4)
  const scopeGridSize = BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
    ? 11
    : EXPANDED_SLOT_123_SCOPE
      ? 9
      : 7
  const expansionFactor = scopeGridSize / 7
  const widthKilometres = baseWidthKilometres * expansionFactor
  const heightKilometres = baseHeightKilometres * expansionFactor
  const latitudeRadians = (referenceCoordinate.latitude * Math.PI) / 180
  const latitudeDegrees = heightKilometres / 111.32
  const longitudeDegrees =
    widthKilometres / (111.32 * Math.cos(latitudeRadians))
  return {
    schemaVersion: "earth-observation-extent-v1",
    extentId: BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
      ? "sakaerat-wang-nam-khiao-owner-authorized-eleven-by-eleven-observation-envelope-v3"
      : EXPANDED_SLOT_123_SCOPE
        ? "sakaerat-wang-nam-khiao-owner-authorized-nine-by-nine-observation-envelope-v2"
        : "sakaerat-official-7808ha-four-three-observation-envelope-v1",
    status:
      EXPANDED_SLOT_123_SCOPE || BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
        ? "owner_authorized_adjacent_measurement_scope_compiled"
        : "compiled_from_official_area_and_reference_coordinate",
    updatedAtUtc: createdAtUtc,
    updatedAtAsiaShanghai: createdAtAsiaShanghai,
    source: {
      areaHectares: OFFICIAL_STUDY_AREA_HECTARES,
      areaSourceUrl: OFFICIAL_AREA_SOURCE,
      referenceCoordinate,
      expandedScopeAuthorizationId: BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
        ? BEYOND_NINE_BY_NINE_AUTHORIZATION_ID
        : EXPANDED_SLOT_123_SCOPE
          ? EXPANDED_SCOPE_AUTHORIZATION_ID
          : null,
    },
    derivation: {
      aspectRatio: "4:3",
      areaSquareKilometres: areaSquareKilometres * expansionFactor ** 2,
      baseOfficialAreaSquareKilometres: areaSquareKilometres,
      widthKilometres,
      heightKilometres,
      expansionFactor,
      scopeGridSize,
      method:
        BEYOND_NINE_BY_NINE_SLOT_123_SCOPE
          ? "The minimum next one-cell measurement ring is added around the prior nine-by-nine envelope, preserving the original seven-by-seven cell scale. The resulting eleven-by-eleven envelope remains inside the same cached Thailand DEM and WorldCover source objects, is authorized only for slot-123 no-RGB condition screening, and does not claim an exact reserve boundary."
          : EXPANDED_SLOT_123_SCOPE
            ? "A one-cell measurement ring is added around the prior seven-by-seven envelope, preserving the original cell scale. The expanded nine-by-nine envelope is owner-authorized for adjacent Wang Nam Khiao measurement evidence and does not claim an exact reserve boundary."
            : "A 4:3 observation envelope is derived from the official 7,808 ha study-area figure and the approved Sakaerat reference coordinate.",
      exactReserveBoundaryClaimed: false,
      runtimeMetresPerPixelDefined: false,
    },
    bounds: {
      west: referenceCoordinate.longitude - longitudeDegrees / 2,
      south: referenceCoordinate.latitude - latitudeDegrees / 2,
      east: referenceCoordinate.longitude + longitudeDegrees / 2,
      north: referenceCoordinate.latitude + latitudeDegrees / 2,
    },
  }
}

async function downloadCachedSource(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const expectedBytes = Number(source.remoteObject?.contentLength ?? 0)
  if (fs.existsSync(destination)) {
    const stats = fs.statSync(destination)
    if (!expectedBytes || stats.size === expectedBytes) {
      return {
        status: "reused_verified_cache",
        byteSize: stats.size,
        sha256: sha256File(destination),
      }
    }
  }

  const response = await fetch(source.sourceUrl)
  if (!response.ok || !response.body) {
    throw new Error(
      `source download failed: ${source.sourceId} HTTP ${response.status}`,
    )
  }
  const temp = `${destination}.${process.pid}.${Date.now()}.part`
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp))
  const stats = fs.statSync(temp)
  if (expectedBytes && stats.size !== expectedBytes) {
    fs.rmSync(temp, { force: true })
    throw new Error(
      `source byte-size mismatch: ${source.sourceId} expected=${expectedBytes} actual=${stats.size}`,
    )
  }
  fs.renameSync(temp, destination)
  return {
    status: "downloaded_and_hashed",
    byteSize: stats.size,
    sha256: sha256File(destination),
  }
}

async function readRasterWindow({
  filePath,
  sourceBounds,
  observationExtent,
  kernel,
  depth,
}) {
  const metadata = await sharp(filePath, {
    limitInputPixels: false,
    sequentialRead: true,
  }).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`raster dimensions missing: ${filePath}`)
  }
  const bounds = observationExtent.bounds
  if (
    bounds.west < sourceBounds.west ||
    bounds.east > sourceBounds.east ||
    bounds.south < sourceBounds.south ||
    bounds.north > sourceBounds.north
  ) {
    throw new Error(`observation extent exceeds source tile: ${filePath}`)
  }
  const left = Math.floor(
    ((bounds.west - sourceBounds.west) /
      (sourceBounds.east - sourceBounds.west)) *
      metadata.width,
  )
  const right = Math.ceil(
    ((bounds.east - sourceBounds.west) /
      (sourceBounds.east - sourceBounds.west)) *
      metadata.width,
  )
  const top = Math.floor(
    ((sourceBounds.north - bounds.north) /
      (sourceBounds.north - sourceBounds.south)) *
      metadata.height,
  )
  const bottom = Math.ceil(
    ((sourceBounds.north - bounds.south) /
      (sourceBounds.north - sourceBounds.south)) *
      metadata.height,
  )
  const sourcePixelWindow = {
    left: clamp(left, 0, metadata.width - 1),
    top: clamp(top, 0, metadata.height - 1),
    width: clamp(right - left, 1, metadata.width - left),
    height: clamp(bottom - top, 1, metadata.height - top),
  }
  const { data, info } = await sharp(filePath, {
    limitInputPixels: false,
    sequentialRead: true,
  })
    .extract(sourcePixelWindow)
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, {
      kernel,
      fit: "fill",
    })
    .raw({ depth })
    .toBuffer({ resolveWithObject: true })
  return {
    data,
    info,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      depth: metadata.depth,
      channels: metadata.channels,
    },
    sourcePixelWindow,
  }
}

function naturalizeHumanLandCover(values) {
  const total = values.length
  const naturalized = new Uint8Array(values)
  const removalMask = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  let removedPixelCount = 0

  for (let index = 0; index < total; index += 1) {
    const value = values[index]
    if (HUMAN_CLASSES.has(value)) {
      removalMask[index] = 1
      naturalized[index] = 0
      removedPixelCount += 1
    } else if (NATURAL_CLASSES.has(value)) {
      queue[tail] = index
      tail += 1
    }
  }
  if (tail === 0) throw new Error("no natural land-cover seed pixels found")

  while (head < tail) {
    const index = queue[head]
    head += 1
    const row = Math.floor(index / OUTPUT_WIDTH)
    const column = index - row * OUTPUT_WIDTH
    const value = naturalized[index]
    if (row > 0) fill(index - OUTPUT_WIDTH, value)
    if (row + 1 < OUTPUT_HEIGHT) fill(index + OUTPUT_WIDTH, value)
    if (column > 0) fill(index - 1, value)
    if (column + 1 < OUTPUT_WIDTH) fill(index + 1, value)
  }

  return { naturalized, removalMask, removedPixelCount }

  function fill(index, value) {
    if (naturalized[index] !== 0) return
    naturalized[index] = value
    queue[tail] = index
    tail += 1
  }
}

function firstFloatChannel(buffer, channels) {
  const source = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )
  const values = new Float32Array(OUTPUT_WIDTH * OUTPUT_HEIGHT)
  for (let index = 0; index < values.length; index += 1) {
    values[index] = source[index * channels]
  }
  return values
}

function decodeWorldCoverClasses(buffer, channels) {
  if (channels === 1) return new Uint8Array(buffer)
  const palette = new Map([
    ["0,100,0", 10],
    ["255,187,34", 20],
    ["255,255,76", 30],
    ["240,150,255", 40],
    ["250,0,0", 50],
    ["180,180,180", 60],
    ["240,240,240", 70],
    ["0,100,200", 80],
    ["0,150,160", 90],
    ["0,207,117", 95],
    ["250,230,160", 100],
  ])
  const values = new Uint8Array(OUTPUT_WIDTH * OUTPUT_HEIGHT)
  const unknown = new Map()
  for (let index = 0; index < values.length; index += 1) {
    const offset = index * channels
    const key = `${buffer[offset]},${buffer[offset + 1]},${buffer[offset + 2]}`
    const value = palette.get(key)
    if (value === undefined) {
      unknown.set(key, (unknown.get(key) ?? 0) + 1)
      continue
    }
    values[index] = value
  }
  if (unknown.size > 0) {
    const examples = [...unknown.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
    throw new Error(
      `unknown WorldCover palette colors: ${JSON.stringify(examples)}`,
    )
  }
  return values
}

function floatStatistics(values) {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  let sum = 0
  let count = 0
  for (const value of values) {
    if (!Number.isFinite(value) || value < -1000 || value > 10000) continue
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
    sum += value
    count += 1
  }
  return {
    minimum,
    maximum,
    mean: count ? sum / count : null,
    validPixelCount: count,
  }
}

function classHistogram(values) {
  const histogram = {}
  for (const value of values) {
    histogram[value] = (histogram[value] ?? 0) + 1
  }
  return histogram
}

function buildSourceAcquisition(source, download, filePath) {
  return {
    sourceId: source.sourceId,
    sourceUrl: source.sourceUrl,
    status: download.status,
    cachePath: projectPath(filePath),
    byteSize: download.byteSize,
    sha256: download.sha256,
    acquiredAtUtc: createdAtUtc,
    acquiredAtAsiaShanghai: createdAtAsiaShanghai,
  }
}

function updateSourceRegistryAcquisitions(acquisitions) {
  const updated = readJson(SOURCE_REGISTRY_PATH)
  const acquisitionBySource = new Map(
    acquisitions.map((acquisition) => [acquisition.sourceId, acquisition]),
  )
  updated.updatedAtUtc = createdAtUtc
  updated.updatedAtAsiaShanghai = createdAtAsiaShanghai
  updated.sources = updated.sources.map((source) => {
    const acquisition = acquisitionBySource.get(source.sourceId)
    if (!acquisition) return source
    return {
      ...source,
      acquisitionStatus: "acquired_window_source_cached_and_hashed",
      cachePath: acquisition.cachePath,
      cacheByteSize: acquisition.byteSize,
      cacheSha256: acquisition.sha256,
      cacheAcquiredAtUtc: acquisition.acquiredAtUtc,
    }
  })
  writeJsonAtomic(SOURCE_REGISTRY_PATH, updated)
  indexFile(SOURCE_REGISTRY_PATH, runId)
}

function updateRegionContract(observationExtent, remainingBlockers) {
  const updated = readJson(REGION_CONTRACT_PATH)
  updated.updatedAtUtc = createdAtUtc
  updated.updatedAtAsiaShanghai = createdAtAsiaShanghai
  updated.status =
    "measurement_window_compiled_human_land_cover_naturalized_world_facts_pending"
  updated.observationArea = {
    status: "compiled",
    extentId: observationExtent.extentId,
    extentPath: projectPath(OBSERVATION_EXTENT_PATH),
    bounds: observationExtent.bounds,
    runtimeMetresPerPixelDefined: false,
    exactRealWorldGeometryDisplayAllowed: false,
  }
  updated.blockers = remainingBlockers
  writeJsonAtomic(REGION_CONTRACT_PATH, updated)
  indexFile(REGION_CONTRACT_PATH, runId)
}

function writeGzipAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, zlib.gzipSync(value, { level: 9 }))
  fs.renameSync(temp, filePath)
}

function indexFile(filePath, artifactRunId) {
  const stats = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: artifactRunId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(filePath),
  })
}

function requireSource(registry, role) {
  const source = registry.sources.find((item) => item.role === role)
  if (!source) throw new Error(`source role missing: ${role}`)
  return source
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256")
  const descriptor = fs.openSync(filePath, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let bytesRead = 0
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead))
    } while (bytesRead > 0)
  } finally {
    fs.closeSync(descriptor)
  }
  return hash.digest("hex")
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
