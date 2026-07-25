import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

class MinHeap {
  items = []

  get length() {
    return this.items.length
  }

  push(value) {
    this.items.push(value)
    let index = this.items.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.items[parent].elevation <= value.elevation) break
      this.items[index] = this.items[parent]
      index = parent
    }
    this.items[index] = value
  }

  pop() {
    const first = this.items[0]
    const last = this.items.pop()
    if (this.items.length === 0) return first
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.items.length) break
      let child = left
      if (
        right < this.items.length &&
        this.items[right].elevation < this.items[left].elevation
      ) {
        child = right
      }
      if (this.items[child].elevation >= last.elevation) break
      this.items[index] = this.items[child]
      index = child
    }
    this.items[index] = last
    return first
  }
}

const ROOT = process.cwd()
const CONTRACT_ID = "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1"
const REGION_ROOT = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  CONTRACT_ID,
)
const REGION_CONTRACT_PATH = path.join(REGION_ROOT, "region-contract.json")
const SOURCE_REGISTRY_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "source-registry",
  "earth-geospatial-source-registry-v1.json",
)
const MEASUREMENT_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-naturalization-runs",
  "latest.json",
)
const RUNTIME_ROOT = ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs"
const PYTHON = path.join(
  ROOT,
  "ml",
  "ai-painter",
  ".venv",
  "Scripts",
  "python.exe",
)
const TIFF_READER = path.join(
  ROOT,
  "ml",
  "ai-painter",
  "scripts",
  "read_numeric_geotiff.py",
)
const SOURCE_WIDTH = 1024
const SOURCE_HEIGHT = 768
const HYDROLOGY_WIDTH = 256
const HYDROLOGY_HEIGHT = 192

const SOIL_PROPERTIES = [
  {
    id: "clay",
    coverageId: "clay_0-5cm_Q0.5",
    conversionFactor: 10,
    conventionalUnit: "g/100g_percent",
  },
  {
    id: "sand",
    coverageId: "sand_0-5cm_Q0.5",
    conversionFactor: 10,
    conventionalUnit: "g/100g_percent",
  },
  {
    id: "phh2o",
    coverageId: "phh2o_0-5cm_Q0.5",
    conversionFactor: 10,
    conventionalUnit: "pH",
  },
  {
    id: "wv0010",
    coverageId: "wv0010_0-5cm_Q0.5",
    conversionFactor: 10,
    conventionalUnit: "volumetric_water_percent",
  },
]

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId = `earth-geospatial-soil-hydrology-${createdAtUtc.replace(/[:.]/g, "-")}`
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId)
const rawRoot = path.join(runRoot, "raw-soilgrids")
const normalizedRoot = path.join(runRoot, "normalized-soil")
const hydrologyRoot = path.join(runRoot, "natural-hydrology")

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_soil_hydrology_started",
  title: "真实地理土壤与自然水文测量已启动",
  titleEn: "Earth soil and natural-hydrology measurement started",
  summary:
    "程序开始采集 SoilGrids 数值测量并从已保存 DEM 推导自然水文证据；本轮不生成 RGB、不创建世界事实、不启动 GPU 训练。",
  summaryEn:
    "The program started acquiring numeric SoilGrids measurements and deriving natural-hydrology evidence from the stored DEM. This run creates no RGB or WorldFacts and starts no GPU training.",
  command: "npm run build:earth-geospatial-soil-hydrology",
  runId,
})

try {
  const sourceRegistry = readJson(SOURCE_REGISTRY_PATH)
  const soilSource = requireSource(sourceRegistry, "soil_property_context")
  const measurementLatest = readJson(MEASUREMENT_LATEST_PATH)
  const measurementManifest = readJson(
    path.join(ROOT, measurementLatest.runPath),
  )
  const bounds = measurementManifest.observationExtent.bounds

  const soilMeasurements = []
  for (const property of SOIL_PROPERTIES) {
    const sourceUrl = buildSoilGridsWcsUrl(property, bounds)
    const tiffPath = path.join(rawRoot, `${property.id}-0-5cm-q50.tif`)
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      throw new Error(
        `SoilGrids WCS failed for ${property.id}: ${response.status}`,
      )
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!String(response.headers.get("content-type")).includes("tiff")) {
      throw new Error(
        `SoilGrids WCS returned non-TIFF for ${property.id}: ${bytes
          .subarray(0, 200)
          .toString("utf8")}`,
      )
    }
    writeImmutableBytes(tiffPath, bytes)
    const numeric = readNumericGeoTiff(tiffPath)
    const values = Int16Array.from(numeric.values)
    const outputPath = path.join(
      normalizedRoot,
      `${property.id}-0-5cm-q50-i16-le.bin.gz`,
    )
    writeGzipAtomic(outputPath, Buffer.from(values.buffer))
    indexFile(tiffPath, runId)
    indexFile(outputPath, runId)
    soilMeasurements.push({
      propertyId: property.id,
      coverageId: property.coverageId,
      sourceUrl,
      sourcePath: projectPath(tiffPath),
      sourceSha256: sha256File(tiffPath),
      sourceByteSize: bytes.length,
      width: numeric.width,
      height: numeric.height,
      numericMode: numeric.mode,
      noDataValue: numeric.noDataValue,
      noDataCount: numeric.noDataCount,
      validValueCount: numeric.validValueCount,
      rawUnitStatistics: {
        minimum: numeric.minimum,
        maximum: numeric.maximum,
        mean: numeric.mean,
      },
      conversionFactor: property.conversionFactor,
      conventionalUnit: property.conventionalUnit,
      conventionalStatistics: {
        minimum: numeric.minimum / property.conversionFactor,
        maximum: numeric.maximum / property.conversionFactor,
        mean: numeric.mean / property.conversionFactor,
      },
      outputPath: projectPath(outputPath),
      outputSha256: sha256File(outputPath),
    })
  }

  const elevationPath = path.join(
    ROOT,
    measurementManifest.rasterWindows.elevation.outputPath,
  )
  const elevation = readGzipFloat32(elevationPath)
  assert(
    elevation.length === SOURCE_WIDTH * SOURCE_HEIGHT,
    "stored elevation dimensions do not match the measurement contract",
  )
  const analysisElevation = downsampleAverage(
    elevation,
    SOURCE_WIDTH,
    SOURCE_HEIGHT,
    HYDROLOGY_WIDTH,
    HYDROLOGY_HEIGHT,
  )
  const hydrology = deriveNaturalHydrology(
    analysisElevation,
    HYDROLOGY_WIDTH,
    HYDROLOGY_HEIGHT,
  )
  const elevationAnalysisPath = path.join(
    hydrologyRoot,
    "analysis-elevation-f32-le.bin.gz",
  )
  const filledElevationPath = path.join(
    hydrologyRoot,
    "priority-flood-filled-elevation-f32-le.bin.gz",
  )
  const slopePath = path.join(
    hydrologyRoot,
    "slope-normalized-f32-le.bin.gz",
  )
  const accumulationPath = path.join(
    hydrologyRoot,
    "flow-accumulation-u32-le.bin.gz",
  )
  const drainagePath = path.join(
    hydrologyRoot,
    "natural-drainage-likelihood-u8.bin.gz",
  )
  writeGzipAtomic(
    elevationAnalysisPath,
    Buffer.from(analysisElevation.buffer),
  )
  writeGzipAtomic(
    filledElevationPath,
    Buffer.from(hydrology.filledElevation.buffer),
  )
  writeGzipAtomic(slopePath, Buffer.from(hydrology.slope.buffer))
  writeGzipAtomic(
    accumulationPath,
    Buffer.from(hydrology.accumulation.buffer),
  )
  writeGzipAtomic(
    drainagePath,
    Buffer.from(hydrology.drainageLikelihood.buffer),
  )
  for (const filePath of [
    elevationAnalysisPath,
    filledElevationPath,
    slopePath,
    accumulationPath,
    drainagePath,
  ]) {
    indexFile(filePath, runId)
  }

  const remainingBlockers = [
    "engineered_linear_feature_removal_evidence_missing",
    "derived_world_facts_missing",
    "complete_map_23_channels_missing",
  ]
  const manifest = {
    schemaVersion: "earth-geospatial-soil-hydrology-manifest-v1",
    runId,
    status: "soil_measurement_and_provisional_natural_hydrology_compiled",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    parentMeasurementRunId: measurementManifest.runId,
    parentMeasurementManifestPath: measurementLatest.runPath,
    observationExtent: measurementManifest.observationExtent,
    soil: {
      sourceId: soilSource.sourceId,
      provider: soilSource.provider,
      product: soilSource.product,
      license: soilSource.license,
      attribution: soilSource.attribution,
      documentationUrl: soilSource.documentationUrl,
      service: "SoilGrids WCS 2.0.1",
      depthInterval: "0-5cm",
      quantile: "Q0.5",
      measurements: soilMeasurements,
      visualTrainingTargetEligible: false,
    },
    naturalHydrology: {
      status: "provisional_dem_derived_pending_engineered_linear_removal",
      method:
        "The stored elevation window is averaged to a 256x192 analysis grid, depression-filled with Priority-Flood, routed with D8 receivers, and accumulated in reverse flood order.",
      analysisGrid: {
        width: HYDROLOGY_WIDTH,
        height: HYDROLOGY_HEIGHT,
        runtimeMetresPerPixelDefined: false,
      },
      elevationPath: projectPath(elevationAnalysisPath),
      elevationSha256: sha256File(elevationAnalysisPath),
      filledElevationPath: projectPath(filledElevationPath),
      filledElevationSha256: sha256File(filledElevationPath),
      slopePath: projectPath(slopePath),
      slopeSha256: sha256File(slopePath),
      accumulationPath: projectPath(accumulationPath),
      accumulationSha256: sha256File(accumulationPath),
      drainageLikelihoodPath: projectPath(drainagePath),
      drainageLikelihoodSha256: sha256File(drainagePath),
      statistics: hydrology.statistics,
      finalWorldFactEligible: false,
      reason:
        "Engineered linear-feature removal evidence is still missing; hydrology remains provisional measurement evidence.",
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
    remainingBlockers,
  }

  updateSourceRegistry(soilSource.sourceId, soilMeasurements)
  updateRegionContract(runId, remainingBlockers)
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "soil-hydrology-manifest.json",
    record: manifest,
    latest: {
      contractId: CONTRACT_ID,
      parentMeasurementRunId: measurementManifest.runId,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  })

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_soil_hydrology_completed",
    title: "真实地理土壤与自然水文测量已完成",
    titleEn: "Earth soil and natural-hydrology measurement completed",
    summary:
      "程序已自动保存四类 SoilGrids 数值测量及 DEM 派生水文证据；道路移除证据仍缺失，因此没有创建世界事实、RGB或训练资格。",
    summaryEn:
      "The program automatically stored four numeric SoilGrids measurements and DEM-derived hydrology evidence. Engineered-road removal evidence remains missing, so no WorldFacts, RGB, or training eligibility was created.",
    command: "npm run build:earth-geospatial-soil-hydrology",
    runId,
    evidencePath: runPath,
  })

  console.log(
    JSON.stringify(
      {
        runId,
        status: manifest.status,
        soilMeasurements: soilMeasurements.map((item) => ({
          propertyId: item.propertyId,
          dimensions: `${item.width}x${item.height}`,
          conventionalStatistics: item.conventionalStatistics,
        })),
        hydrology: hydrology.statistics,
        remainingBlockers,
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
    schemaVersion: "earth-geospatial-soil-hydrology-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    errorCode: "earth_geospatial_soil_hydrology_failed",
    error: error instanceof Error ? error.message : String(error),
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    derivedWorldFactsCreated: false,
  }
  const failurePath = path.join(runRoot, "failure.json")
  writeJsonAtomic(failurePath, failure)
  indexFile(failurePath, runId)
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: "earth_geospatial_soil_hydrology_failed",
    title: "真实地理土壤与自然水文测量失败",
    titleEn: "Earth soil and natural-hydrology measurement failed",
    summary: failure.error,
    summaryEn: failure.error,
    command: "npm run build:earth-geospatial-soil-hydrology",
    runId,
    evidencePath: projectPath(failurePath),
  })
  throw error
}

function buildSoilGridsWcsUrl(property, bounds) {
  const url = new URL("https://maps.isric.org/mapserv")
  url.searchParams.set("map", `/map/${property.id}.map`)
  url.searchParams.set("SERVICE", "WCS")
  url.searchParams.set("VERSION", "2.0.1")
  url.searchParams.set("REQUEST", "GetCoverage")
  url.searchParams.set("COVERAGEID", property.coverageId)
  url.searchParams.set("FORMAT", "GEOTIFF_INT16")
  url.searchParams.append("SUBSET", `x(${bounds.west},${bounds.east})`)
  url.searchParams.append("SUBSET", `y(${bounds.south},${bounds.north})`)
  url.searchParams.set(
    "SUBSETTINGCRS",
    "http://www.opengis.net/def/crs/EPSG/0/4326",
  )
  url.searchParams.set(
    "OUTPUTCRS",
    "http://www.opengis.net/def/crs/EPSG/0/4326",
  )
  return url.toString()
}

function readNumericGeoTiff(filePath) {
  assert(fs.existsSync(PYTHON), "project Python environment is missing")
  assert(fs.existsSync(TIFF_READER), "numeric GeoTIFF reader is missing")
  const output = execFileSync(PYTHON, [TIFF_READER, filePath], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  })
  return JSON.parse(output)
}

function readGzipFloat32(filePath) {
  const bytes = zlib.gunzipSync(fs.readFileSync(filePath))
  const copy = Buffer.from(bytes)
  return new Float32Array(
    copy.buffer,
    copy.byteOffset,
    copy.byteLength / Float32Array.BYTES_PER_ELEMENT,
  )
}

function downsampleAverage(
  source,
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
) {
  const result = new Float32Array(targetWidth * targetHeight)
  const scaleX = sourceWidth / targetWidth
  const scaleY = sourceHeight / targetHeight
  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor(y * scaleY)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY))
    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor(x * scaleX)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX))
      let sum = 0
      let count = 0
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const value = source[sy * sourceWidth + sx]
          if (!Number.isFinite(value)) continue
          sum += value
          count += 1
        }
      }
      result[y * targetWidth + x] = count ? sum / count : 0
    }
  }
  return result
}

function deriveNaturalHydrology(elevation, width, height) {
  const size = width * height
  const filledElevation = new Float32Array(elevation)
  const visited = new Uint8Array(size)
  const parent = new Int32Array(size)
  parent.fill(-1)
  const floodOrder = new Int32Array(size)
  let orderLength = 0
  const heap = new MinHeap()

  for (let x = 0; x < width; x += 1) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 1; y + 1 < height; y += 1) {
    seed(y * width)
    seed(y * width + width - 1)
  }

  while (heap.length > 0) {
    const current = heap.pop()
    floodOrder[orderLength] = current.index
    orderLength += 1
    forEachNeighbor(current.index, width, height, (neighbor) => {
      if (visited[neighbor]) return
      visited[neighbor] = 1
      parent[neighbor] = current.index
      filledElevation[neighbor] = Math.max(
        elevation[neighbor],
        filledElevation[current.index],
      )
      heap.push({
        index: neighbor,
        elevation: filledElevation[neighbor],
      })
    })
  }

  assert(orderLength === size, "priority-flood did not visit the full grid")
  const receiver = new Int32Array(size)
  receiver.fill(-1)
  const slope = new Float32Array(size)
  for (let index = 0; index < size; index += 1) {
    let best = parent[index]
    let bestDrop =
      best >= 0 ? filledElevation[index] - filledElevation[best] : 0
    forEachNeighbor(index, width, height, (neighbor) => {
      const drop = filledElevation[index] - filledElevation[neighbor]
      if (drop > bestDrop + 1e-6) {
        best = neighbor
        bestDrop = drop
      }
    })
    receiver[index] = best
    slope[index] = Math.max(0, bestDrop)
  }

  const accumulation = new Uint32Array(size)
  accumulation.fill(1)
  for (let order = orderLength - 1; order >= 0; order -= 1) {
    const index = floodOrder[order]
    const next = receiver[index]
    if (next >= 0 && next !== index) {
      accumulation[next] = Math.min(
        0xffffffff,
        accumulation[next] + accumulation[index],
      )
    }
  }

  let maximumSlope = 0
  let maximumAccumulation = 0
  for (let index = 0; index < size; index += 1) {
    maximumSlope = Math.max(maximumSlope, slope[index])
    maximumAccumulation = Math.max(maximumAccumulation, accumulation[index])
  }
  if (maximumSlope > 0) {
    for (let index = 0; index < size; index += 1) {
      slope[index] /= maximumSlope
    }
  }

  const drainageLikelihood = new Uint8Array(size)
  const logMaximum = Math.log1p(maximumAccumulation)
  let drainagePixelCount = 0
  for (let index = 0; index < size; index += 1) {
    const normalized = logMaximum
      ? Math.log1p(accumulation[index]) / logMaximum
      : 0
    const value = Math.round(255 * normalized * (1 - 0.35 * slope[index]))
    drainageLikelihood[index] = Math.max(0, Math.min(255, value))
    if (value >= 180) drainagePixelCount += 1
  }

  return {
    filledElevation,
    slope,
    accumulation,
    drainageLikelihood,
    statistics: {
      minimumElevation: minimum(filledElevation),
      maximumElevation: maximum(filledElevation),
      maximumRawSlopeDrop: maximumSlope,
      maximumFlowAccumulation: maximumAccumulation,
      drainageLikelihoodThreshold: 180,
      drainagePixelCount,
      drainagePixelRatio: drainagePixelCount / size,
      boundaryOutletCount: countBoundaryOutlets(receiver, width, height),
    },
  }

  function seed(index) {
    if (visited[index]) return
    visited[index] = 1
    heap.push({ index, elevation: filledElevation[index] })
  }
}

function forEachNeighbor(index, width, height, callback) {
  const y = Math.floor(index / width)
  const x = index - y * width
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      callback(ny * width + nx)
    }
  }
}

function countBoundaryOutlets(receiver, width, height) {
  let count = 0
  for (let index = 0; index < receiver.length; index += 1) {
    if (receiver[index] >= 0) continue
    const y = Math.floor(index / width)
    const x = index - y * width
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      count += 1
    }
  }
  return count
}

function updateSourceRegistry(sourceId, measurements) {
  const registry = readJson(SOURCE_REGISTRY_PATH)
  registry.updatedAtUtc = createdAtUtc
  registry.updatedAtAsiaShanghai = createdAtAsiaShanghai
  registry.sources = registry.sources.map((source) =>
    source.sourceId === sourceId
      ? {
          ...source,
          acquisitionStatus: "wcs_measurement_window_acquired_and_hashed",
          acquiredAtUtc: createdAtUtc,
          acquiredProperties: measurements.map((item) => ({
            propertyId: item.propertyId,
            coverageId: item.coverageId,
            sourcePath: item.sourcePath,
            sourceSha256: item.sourceSha256,
          })),
        }
      : source,
  )
  writeJsonAtomic(SOURCE_REGISTRY_PATH, registry)
  indexFile(SOURCE_REGISTRY_PATH, runId)
}

function updateRegionContract(evidenceRunId, remainingBlockers) {
  const contract = readJson(REGION_CONTRACT_PATH)
  const sourceRegistry = readJson(SOURCE_REGISTRY_PATH)
  const sourceById = new Map(
    sourceRegistry.sources.map((source) => [source.sourceId, source]),
  )
  contract.updatedAtUtc = createdAtUtc
  contract.updatedAtAsiaShanghai = createdAtAsiaShanghai
  contract.status =
    "soil_and_provisional_hydrology_compiled_engineered_linear_removal_pending"
  contract.inputs = contract.inputs.map((input) => ({
    ...input,
    acquisitionStatus:
      sourceById.get(input.sourceId)?.acquisitionStatus ??
      input.acquisitionStatus,
  }))
  contract.measurementEvidence = {
    soilHydrologyRunId: evidenceRunId,
    latestPath: `${RUNTIME_ROOT}/latest.json`,
    naturalHydrologyFinalWorldFactEligible: false,
  }
  contract.blockers = remainingBlockers
  writeJsonAtomic(REGION_CONTRACT_PATH, contract)
  indexFile(REGION_CONTRACT_PATH, runId)
}

function writeImmutableBytes(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath)
    if (!existing.equals(bytes)) {
      throw new Error(`immutable source differs: ${projectPath(filePath)}`)
    }
    return
  }
  fs.writeFileSync(filePath, bytes)
}

function writeGzipAtomic(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, zlib.gzipSync(bytes, { level: 9 }))
  fs.renameSync(temporaryPath, filePath)
}

function indexFile(filePath, artifactRunId) {
  const stats = fs.statSync(filePath)
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: filePath.includes(`${path.sep}.runtime${path.sep}`)
      ? "hot"
      : "project",
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
  hash.update(fs.readFileSync(filePath))
  return hash.digest("hex")
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function minimum(values) {
  let result = Number.POSITIVE_INFINITY
  for (const value of values) result = Math.min(result, value)
  return result
}

function maximum(values) {
  let result = Number.NEGATIVE_INFINITY
  for (const value of values) result = Math.max(result, value)
  return result
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
