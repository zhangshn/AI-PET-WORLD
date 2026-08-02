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
import { buildAnonymousWaterNaturalnessProfile } from "./lib/anonymous-water-naturalness.mjs"

const ROOT = process.cwd()
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1"
const SOURCE_ID = "openstreetmap-overpass-natural-waterway-morphology-v1"
const OWNER_AUTHORIZATION_REF =
  "project-owner-authorized-slot-122-water-naturalness-repair-through-rgb-20260727"
const REGION_CONTRACT_PATH =
  `data/world-samples/earth-geospatial/regions/${CONTRACT_ID}/region-contract.json`
const SOURCE_REGISTRY_PATH =
  "data/world-samples/earth-geospatial/source-registry/earth-geospatial-source-registry-v1.json"
const RUNTIME_ROOT =
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs"
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]
const attempts = []
const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const runId =
  `earth-geospatial-water-naturalness-profile-` +
  createdAtUtc.replace(/[:.]/g, "-")
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId)
const rawRoot = path.join(runRoot, "raw-osm")
const command = "node scripts/build-earth-geospatial-water-naturalness-profile.mjs"

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_water_naturalness_profile_started",
  title: "Earth waterway naturalness profile acquisition started",
  titleZh: "真实地理水系自然度统计档案采集已启动",
  titleEn: "Earth waterway naturalness profile acquisition started",
  summary:
    "The program is acquiring OSM river and stream geometry only to derive aggregate non-spatial naturalness statistics for anonymous game-coordinate water generation.",
  summaryZh:
    "程序正在获取 OSM 河流与溪流几何，仅用于派生匿名游戏坐标水体生成所需的非空间聚合自然度统计。",
  command,
  runId,
})

try {
  const regionContract = readJson(REGION_CONTRACT_PATH)
  const observationBounds = regionContract.observationArea?.bounds
  assert(observationBounds, "compiled observation bounds are missing")
  const regionalAggregateBounds = expandBounds(observationBounds, 0.18)
  const query = buildOverpassQuery(regionalAggregateBounds)
  const queryPath = path.join(rawRoot, "overpass-query.ql")
  writeImmutableBytes(queryPath, Buffer.from(`${query}\n`, "utf8"))
  indexFile(queryPath, runId)

  const responseRecord = await acquireOverpass(query)
  const rawResponsePath = path.join(rawRoot, "overpass-response.json")
  writeImmutableBytes(rawResponsePath, responseRecord.bytes)
  indexFile(rawResponsePath, runId)
  const rawOsm = JSON.parse(responseRecord.bytes.toString("utf8"))
  assert(Array.isArray(rawOsm.elements), "Overpass response has no elements")

  const profile = buildAnonymousWaterNaturalnessProfile({
    rawOsm,
    createdAtUtc,
    createdAtAsiaShanghai,
    source: {
      profileId:
        "sakaerat-wang-nam-khiao-anonymous-water-naturalness-v1",
      sourceId: SOURCE_ID,
      provider: "OpenStreetMap contributors",
      product: "OpenStreetMap database queried through Overpass API",
      endpoint: responseRecord.endpoint,
      documentationUrl:
        "https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL",
      license: "Open Database License (ODbL) 1.0",
      licenseUrl: "https://www.openstreetmap.org/copyright/en",
      attribution: "© OpenStreetMap contributors",
      acquiredAtUtc: responseRecord.acquiredAtUtc,
      acquiredAtAsiaShanghai: formatShanghai(responseRecord.acquiredAtUtc),
      queryPath: projectPath(queryPath),
      querySha256: sha256File(queryPath),
      rawResponsePath: projectPath(rawResponsePath),
      rawResponseSha256: sha256File(rawResponsePath),
      regionalAggregateBounds,
      observationBounds,
      exactGeometryDisplayAllowed: false,
      ownerAuthorizationRefs: [
        OWNER_AUTHORIZATION_REF,
        "project-owner-command-2026-07-27-slot-122-river-too-geometric-and-rigid",
      ],
    },
  })
  profile.profileSha256 = canonicalSha256(profile)
  const profilePath = path.join(runRoot, "water-naturalness-profile.json")
  writeJsonAtomic(profilePath, profile)
  indexFile(profilePath, runId)

  const attemptsPath = path.join(runRoot, "request-attempts.json")
  writeJsonAtomic(attemptsPath, {
    schemaVersion: "earth-geospatial-water-overpass-request-attempts-v1",
    runId,
    querySha256: sha256Text(query),
    attempts,
  })
  indexFile(attemptsPath, runId)

  const manifest = {
    schemaVersion: "earth-geospatial-water-naturalness-profile-run-v1",
    runId,
    status: "aggregate_public_water_naturalness_profile_ready",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    sourceId: SOURCE_ID,
    source: profile.source,
    profilePath: projectPath(profilePath),
    profileSha256: sha256File(profilePath),
    sourceWayCount: profile.selection.sourceWayCount,
    measurableWayCount: profile.selection.measurableWayCount,
    queryPath: projectPath(queryPath),
    querySha256: sha256File(queryPath),
    rawResponsePath: projectPath(rawResponsePath),
    rawResponseSha256: sha256File(rawResponsePath),
    attemptsPath: projectPath(attemptsPath),
    attemptsSha256: sha256File(attemptsPath),
    identityBoundary: profile.identityBoundary,
    outputBoundary: {
      imageGenerationStarted: false,
      rgbCreated: false,
      worldFactsChanged: false,
      exactSourceGeometryCarriedIntoGame: false,
      gpuTrainingStarted: false,
      runtimeStarted: false,
      canEnterWorld: false,
    },
    automaticStorage: true,
  }
  updateSourceRegistry(manifest)
  const written = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "water-naturalness-run.json",
    record: manifest,
    latest: {
      sourceId: SOURCE_ID,
      profilePath: manifest.profilePath,
      profileSha256: manifest.profileSha256,
    },
  })
  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_water_naturalness_profile_completed",
    title: "Earth waterway naturalness profile completed",
    titleZh: "真实地理水系自然度统计档案已完成",
    titleEn: "Earth waterway naturalness profile completed",
    summary:
      "The program stored the OSM query, raw response, licence, attempts, hashes, aggregate waterway statistics and an anonymous-generation envelope. No source coordinates entered game geometry.",
    summaryZh:
      "程序已保存 OSM 查询、原始响应、许可、请求尝试、哈希、水系统计与匿名生成包络；来源坐标未进入游戏几何。",
    command,
    runId,
    evidencePath: written.runPath,
  })
  console.log(
    JSON.stringify(
      {
        runId,
        status: manifest.status,
        endpoint: responseRecord.endpoint,
        sourceWayCount: manifest.sourceWayCount,
        measurableWayCount: manifest.measurableWayCount,
        profilePath: manifest.profilePath,
        profileSha256: manifest.profileSha256,
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
    schemaVersion: "earth-geospatial-water-naturalness-profile-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    errorCode: "earth_geospatial_water_naturalness_profile_failed",
    error: error instanceof Error ? error.message : String(error),
    attempts,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
  }
  const failurePath = path.join(runRoot, "failure.json")
  writeJsonAtomic(failurePath, failure)
  indexFile(failurePath, runId)
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: "earth_geospatial_water_naturalness_profile_failed",
    title: "Earth waterway naturalness profile failed",
    titleZh: "真实地理水系自然度统计档案失败",
    titleEn: "Earth waterway naturalness profile failed",
    summary: failure.error,
    summaryZh: failure.error,
    summaryEn: failure.error,
    command,
    runId,
    evidencePath: projectPath(failurePath),
  })
  throw error
}

function buildOverpassQuery(bounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
  return `[out:json][timeout:120];
(
  way["waterway"~"^(river|stream)$"](${bbox});
);
out tags geom;`
}

async function acquireOverpass(query) {
  for (const endpoint of ENDPOINTS) {
    const startedAtUtc = new Date().toISOString()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 180_000)
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent":
            "AI-PET-WORLD/earth-water-naturalness (aggregate evidence)",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })
      const bytes = Buffer.from(await response.arrayBuffer())
      const finishedAtUtc = new Date().toISOString()
      const attempt = {
        endpoint,
        startedAtUtc,
        finishedAtUtc,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        byteSize: bytes.length,
        responseSha256: sha256Bytes(bytes),
      }
      attempts.push(attempt)
      if (!response.ok) {
        persistFailedAttempt(attempts.length, bytes)
        continue
      }
      const parsed = JSON.parse(bytes.toString("utf8"))
      if (!Array.isArray(parsed.elements)) {
        persistFailedAttempt(attempts.length, bytes)
        continue
      }
      return { endpoint, acquiredAtUtc: finishedAtUtc, bytes }
    } catch (error) {
      attempts.push({
        endpoint,
        startedAtUtc,
        finishedAtUtc: new Date().toISOString(),
        status: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error("all approved Overpass endpoints failed")
}

function persistFailedAttempt(attemptNumber, bytes) {
  const filePath = path.join(
    rawRoot,
    `failed-attempt-${String(attemptNumber).padStart(2, "0")}.response`,
  )
  writeImmutableBytes(filePath, bytes)
  indexFile(filePath, runId)
}

function updateSourceRegistry(manifest) {
  const registry = readJson(SOURCE_REGISTRY_PATH)
  registry.updatedAtUtc = createdAtUtc
  registry.updatedAtAsiaShanghai = createdAtAsiaShanghai
  registry.status = "active_sources_acquired_and_hashed"
  const source = {
    sourceId: SOURCE_ID,
    role: "aggregate_natural_waterway_morphology_reference",
    provider: manifest.source.provider,
    product: manifest.source.product,
    sourceUrl: manifest.source.endpoint,
    documentationUrl: manifest.source.documentationUrl,
    license: manifest.source.license,
    licenseUrl: manifest.source.licenseUrl,
    attribution: manifest.source.attribution,
    acquisitionStatus: "overpass_query_acquired_aggregated_and_hashed",
    acquiredAtUtc: manifest.source.acquiredAtUtc,
    queryPath: manifest.queryPath,
    querySha256: manifest.querySha256,
    rawResponsePath: manifest.rawResponsePath,
    rawResponseSha256: manifest.rawResponseSha256,
    profilePath: manifest.profilePath,
    profileSha256: manifest.profileSha256,
    exactRealWorldGeometryDisplayAllowed: false,
    visualTrainingTargetEligible: false,
    finalWorldFactGeometryEligible: false,
    permittedUse:
      "aggregate_non_spatial_watercourse_morphology_reference_for_anonymous_game_coordinate_generation",
  }
  registry.sources = registry.sources.filter(
    (item) => item.sourceId !== SOURCE_ID,
  )
  registry.sources.push(source)
  writeJsonAtomic(resolveProjectPath(SOURCE_REGISTRY_PATH), registry)
  indexFile(resolveProjectPath(SOURCE_REGISTRY_PATH), runId)
}

function expandBounds(bounds, paddingDegrees) {
  return {
    west: bounds.west - paddingDegrees,
    south: bounds.south - paddingDegrees,
    east: bounds.east + paddingDegrees,
    north: bounds.north + paddingDegrees,
  }
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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(relativePath), "utf8"))
}

function resolveProjectPath(relativePath) {
  const resolved = path.resolve(ROOT, relativePath)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project root: ${relativePath}`,
  )
  return resolved
}

function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function sha256Text(value) {
  return sha256Bytes(Buffer.from(value, "utf8"))
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath))
}

function canonicalSha256(value) {
  return sha256Text(JSON.stringify(sortObject(value)))
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortObject(value[key])]),
    )
  }
  return value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
