import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const ROOT = process.cwd();
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1";
const SOURCE_ID = "openstreetmap-overpass-engineered-feature-removal-v1";
const OWNER_AUTHORIZATION_REF =
  "owner-approved-osm-overpass-engineered-removal-20260725";
const REGION_ROOT = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  CONTRACT_ID,
);
const REGION_CONTRACT_PATH = path.join(REGION_ROOT, "region-contract.json");
const SOURCE_REGISTRY_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "source-registry",
  "earth-geospatial-source-registry-v1.json",
);
const RUNTIME_ROOT =
  ".runtime/ai-painter/earth-geospatial-engineered-removal-runs";
const WIDTH = 1024;
const HEIGHT = 768;
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const CATEGORIES = [
  "roads",
  "railways",
  "buildings",
  "engineered_water",
  "human_landuse",
  "other_engineered",
];

const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId = `earth-geospatial-engineered-removal-${createdAtUtc.replace(
  /[:.]/g,
  "-",
)}`;
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId);
const rawRoot = path.join(runRoot, "raw-osm");
const maskRoot = path.join(runRoot, "removal-masks");
const attempts = [];

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_engineered_removal_started",
  title: "Earth engineered-feature removal evidence started",
  titleZh: "真实地理人工设施删除证据构建已启动",
  titleEn: "Earth engineered-feature removal evidence started",
  summary:
    "程序开始通过 OSM/Overpass 获取道路、建筑、铁路、工程水道和人工用地的数值几何证据。本轮不生成 RGB、不建立世界事实、不启动 GPU 训练。",
  summaryEn:
    "The program started acquiring numeric OSM/Overpass geometry evidence for roads, buildings, railways, engineered waterways, and human land use. This run creates no RGB or WorldFacts and starts no GPU training.",
  command: "npm run build:earth-geospatial-engineered-removal",
  runId,
});

try {
  const regionContract = readJson(REGION_CONTRACT_PATH);
  const bounds = regionContract.observationArea?.bounds;
  assert(bounds, "compiled observation bounds are missing");
  const query = buildOverpassQuery(bounds);
  const queryPath = path.join(rawRoot, "overpass-query.ql");
  writeImmutableBytes(queryPath, Buffer.from(`${query}\n`, "utf8"));
  indexFile(queryPath, runId);

  const responseRecord = await acquireOverpass(query);
  const rawResponsePath = path.join(rawRoot, "overpass-response.json");
  writeImmutableBytes(rawResponsePath, responseRecord.bytes);
  indexFile(rawResponsePath, runId);

  const response = JSON.parse(responseRecord.bytes.toString("utf8"));
  assert(Array.isArray(response.elements), "Overpass response has no elements");
  const rasterized = rasterizeElements(response.elements, bounds);
  const maskRecords = [];
  for (const category of [...CATEGORIES, "all_engineered"]) {
    const filePath = path.join(
      maskRoot,
      `${category.replaceAll("_", "-")}-u8.bin.gz`,
    );
    writeGzipAtomic(filePath, Buffer.from(rasterized.masks[category].buffer));
    indexFile(filePath, runId);
    maskRecords.push({
      category,
      path: projectPath(filePath),
      sha256: sha256File(filePath),
      byteSize: fs.statSync(filePath).size,
      width: WIDTH,
      height: HEIGHT,
      nonZeroPixelCount: countNonZero(rasterized.masks[category]),
      exactSourceGeometryOnly: true,
      bufferApplied: false,
    });
  }

  const inventoryPath = path.join(runRoot, "feature-inventory.json");
  const inventory = {
    schemaVersion: "earth-geospatial-engineered-feature-inventory-v1",
    runId,
    sourceId: SOURCE_ID,
    featureCount: rasterized.features.length,
    categoryCounts: rasterized.categoryCounts,
    skippedElementCount: rasterized.skippedElementCount,
    geometryCoordinatesStoredHere: false,
    geometryCoordinatesStoredOnlyInRawResponse: true,
    features: rasterized.features,
  };
  writeJsonAtomic(inventoryPath, inventory);
  indexFile(inventoryPath, runId);

  const attemptsPath = path.join(runRoot, "request-attempts.json");
  writeJsonAtomic(attemptsPath, {
    schemaVersion: "earth-geospatial-overpass-request-attempts-v1",
    runId,
    querySha256: sha256Text(query),
    attempts,
  });
  indexFile(attemptsPath, runId);

  const remainingBlockers = [
    "derived_world_facts_missing",
    "complete_map_23_channels_missing",
  ];
  const manifest = {
    schemaVersion: "earth-geospatial-engineered-removal-manifest-v1",
    runId,
    status: "engineered_feature_removal_evidence_compiled",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    observationExtent: {
      bounds,
      rasterGrid: {
        width: WIDTH,
        height: HEIGHT,
        runtimeMetresPerPixelDefined: false,
        purpose: "measurement_evidence_rasterization_only",
      },
    },
    source: {
      sourceId: SOURCE_ID,
      provider: "OpenStreetMap contributors",
      product: "OpenStreetMap database queried through Overpass API",
      endpoint: responseRecord.endpoint,
      documentationUrl:
        "https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL",
      license: "Open Database License (ODbL) 1.0",
      licenseUrl: "https://www.openstreetmap.org/copyright/en",
      attribution: "© OpenStreetMap contributors",
      queryPath: projectPath(queryPath),
      querySha256: sha256File(queryPath),
      rawResponsePath: projectPath(rawResponsePath),
      rawResponseSha256: sha256File(rawResponsePath),
      rawResponseByteSize: responseRecord.bytes.length,
      acquiredAtUtc: responseRecord.acquiredAtUtc,
      acquiredAtAsiaShanghai: formatShanghai(responseRecord.acquiredAtUtc),
    },
    evidenceContract: {
      use: "Human infrastructure exclusion and removal evidence before natural terrain reconstruction.",
      prohibitedUses: [
        "rgb_training_target",
        "visual_reference",
        "formal_candidate",
        "runtime_frame",
        "exact_real_world_navigation_geometry",
        "final_world_fact_geometry",
      ],
      exactSourceGeometryOnly: true,
      bufferApplied: false,
      finalWorldGeometryMustBeReconstructed: true,
      externalRgbCreated: false,
    },
    inventory: {
      path: projectPath(inventoryPath),
      sha256: sha256File(inventoryPath),
      featureCount: inventory.featureCount,
      categoryCounts: inventory.categoryCounts,
      skippedElementCount: inventory.skippedElementCount,
    },
    masks: maskRecords,
    attemptsPath: projectPath(attemptsPath),
    attemptsSha256: sha256File(attemptsPath),
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
  };

  updateSourceRegistry(manifest);
  updateRegionContract(manifest, remainingBlockers);
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "engineered-removal-manifest.json",
    record: manifest,
    latest: {
      contractId: CONTRACT_ID,
      sourceId: SOURCE_ID,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_engineered_removal_completed",
    title: "Earth engineered-feature removal evidence completed",
    titleZh: "真实地理人工设施删除证据构建已完成",
    titleEn: "Earth engineered-feature removal evidence completed",
    summary:
      "程序已自动保存 OSM/Overpass 查询、原始响应、许可归属、请求尝试、要素清单、分类删除掩码、双时区时间和哈希。没有生成 RGB、世界事实或训练资格。",
    summaryEn:
      "The program automatically stored the OSM/Overpass query, raw response, licence attribution, request attempts, feature inventory, classified removal masks, dual-timezone timestamps, and hashes. No RGB, WorldFacts, or training eligibility was created.",
    command: "npm run build:earth-geospatial-engineered-removal",
    runId,
    evidencePath: runPath,
  });

  console.log(
    JSON.stringify(
      {
        runId,
        status: manifest.status,
        endpoint: responseRecord.endpoint,
        featureCount: inventory.featureCount,
        categoryCounts: inventory.categoryCounts,
        masks: maskRecords.map((item) => ({
          category: item.category,
          nonZeroPixelCount: item.nonZeroPixelCount,
        })),
        remainingBlockers,
        imageGenerationStarted: false,
        gpuTrainingStarted: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const failedAtUtc = new Date().toISOString();
  const failure = {
    schemaVersion: "earth-geospatial-engineered-removal-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    errorCode: "earth_geospatial_engineered_removal_failed",
    error: error instanceof Error ? error.message : String(error),
    attempts,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    rgbCreated: false,
    derivedWorldFactsCreated: false,
  };
  const failurePath = path.join(runRoot, "failure.json");
  writeJsonAtomic(failurePath, failure);
  indexFile(failurePath, runId);
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: "earth_geospatial_engineered_removal_failed",
    title: "Earth engineered-feature removal evidence failed",
    titleZh: "真实地理人工设施删除证据构建失败",
    titleEn: "Earth engineered-feature removal evidence failed",
    summary: failure.error,
    summaryEn: failure.error,
    command: "npm run build:earth-geospatial-engineered-removal",
    runId,
    evidencePath: projectPath(failurePath),
  });
  throw error;
}

function buildOverpassQuery(bounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:120];
(
  nwr["highway"](${bbox});
  nwr["railway"](${bbox});
  nwr["building"](${bbox});
  nwr["waterway"~"^(canal|ditch|drain)$"](${bbox});
  nwr["man_made"~"^(pipeline|embankment|cutline|pier|breakwater|wastewater_plant|water_works)$"](${bbox});
  nwr["power"~"^(line|minor_line|substation|plant)$"](${bbox});
  nwr["landuse"~"^(residential|commercial|industrial|retail|construction|quarry|landfill|farmland|farmyard|orchard|plant_nursery|greenhouse_horticulture)$"](${bbox});
);
out tags geom;`;
}

async function acquireOverpass(query) {
  for (const endpoint of ENDPOINTS) {
    const startedAtUtc = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent":
            "AI-PET-WORLD/earth-naturalization (engineered removal evidence)",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const finishedAtUtc = new Date().toISOString();
      const attempt = {
        endpoint,
        startedAtUtc,
        finishedAtUtc,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        byteSize: bytes.length,
        responseSha256: sha256Bytes(bytes),
      };
      attempts.push(attempt);
      if (!response.ok) {
        persistFailedAttempt(attempts.length, bytes);
        continue;
      }
      const parsed = JSON.parse(bytes.toString("utf8"));
      if (!Array.isArray(parsed.elements)) {
        persistFailedAttempt(attempts.length, bytes);
        continue;
      }
      return {
        endpoint,
        acquiredAtUtc: finishedAtUtc,
        bytes,
      };
    } catch (error) {
      attempts.push({
        endpoint,
        startedAtUtc,
        finishedAtUtc: new Date().toISOString(),
        status: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("all approved Overpass endpoints failed");
}

function persistFailedAttempt(attemptNumber, bytes) {
  const filePath = path.join(
    rawRoot,
    `failed-attempt-${String(attemptNumber).padStart(2, "0")}.response`,
  );
  writeImmutableBytes(filePath, bytes);
  indexFile(filePath, runId);
}

function rasterizeElements(elements, bounds) {
  const masks = Object.fromEntries(
    [...CATEGORIES, "all_engineered"].map((category) => [
      category,
      new Uint8Array(WIDTH * HEIGHT),
    ]),
  );
  const categoryCounts = Object.fromEntries(
    CATEGORIES.map((category) => [category, 0]),
  );
  const features = [];
  let skippedElementCount = 0;

  for (const element of elements) {
    const category = classifyElement(element.tags ?? {});
    if (!category) {
      skippedElementCount += 1;
      continue;
    }
    const geometries = extractGeometries(element);
    if (geometries.length === 0) {
      skippedElementCount += 1;
      continue;
    }
    let geometryPointCount = 0;
    for (const geometry of geometries) {
      geometryPointCount += geometry.length;
      rasterizeGeometry(
        masks[category],
        geometry,
        bounds,
        shouldFillGeometry(category, element.tags ?? {}, geometry),
      );
    }
    categoryCounts[category] += 1;
    features.push({
      osmType: element.type,
      osmId: String(element.id),
      category,
      geometryPartCount: geometries.length,
      geometryPointCount,
      tags: evidenceTags(element.tags ?? {}),
    });
  }

  for (const category of CATEGORIES) {
    const mask = masks[category];
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index]) masks.all_engineered[index] = 255;
    }
  }
  return { masks, categoryCounts, features, skippedElementCount };
}

function classifyElement(tags) {
  if (tags.building) return "buildings";
  if (tags.railway) return "railways";
  if (tags.highway) return "roads";
  if (["canal", "ditch", "drain"].includes(tags.waterway)) {
    return "engineered_water";
  }
  if (tags.landuse) return "human_landuse";
  if (tags.man_made || tags.power) return "other_engineered";
  return null;
}

function extractGeometries(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return [[{ lat: element.lat, lon: element.lon }]];
  }
  if (Array.isArray(element.geometry)) {
    return splitGeometry(element.geometry);
  }
  if (Array.isArray(element.members)) {
    return element.members.flatMap((member) =>
      Array.isArray(member.geometry) ? splitGeometry(member.geometry) : [],
    );
  }
  return [];
}

function splitGeometry(geometry) {
  const parts = [];
  let current = [];
  for (const point of geometry) {
    if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) {
      if (current.length) parts.push(current);
      current = [];
      continue;
    }
    current.push({ lat: point.lat, lon: point.lon });
  }
  if (current.length) parts.push(current);
  return parts;
}

function shouldFillGeometry(category, tags, geometry) {
  if (category === "buildings" || category === "human_landuse") return true;
  if (
    category === "other_engineered" &&
    (tags.area === "yes" ||
      ["substation", "plant"].includes(tags.power) ||
      ["wastewater_plant", "water_works"].includes(tags.man_made))
  ) {
    return true;
  }
  if (tags.area === "yes") return true;
  if (tags.area === "no" || geometry.length < 4) return false;
  const first = geometry[0];
  const last = geometry.at(-1);
  return first.lat === last.lat && first.lon === last.lon;
}

function rasterizeGeometry(mask, geometry, bounds, fill) {
  const points = geometry.map((point) => projectPoint(point, bounds));
  if (points.length === 1) {
    setPixel(mask, points[0].x, points[0].y);
    return;
  }
  for (let index = 1; index < points.length; index += 1) {
    drawLine(mask, points[index - 1], points[index]);
  }
  if (fill && points.length >= 3) fillPolygon(mask, points);
}

function projectPoint(point, bounds) {
  const x = Math.round(
    ((point.lon - bounds.west) / (bounds.east - bounds.west)) * (WIDTH - 1),
  );
  const y = Math.round(
    ((bounds.north - point.lat) / (bounds.north - bounds.south)) * (HEIGHT - 1),
  );
  return {
    x: Math.max(0, Math.min(WIDTH - 1, x)),
    y: Math.max(0, Math.min(HEIGHT - 1, y)),
  };
}

function drawLine(mask, start, end) {
  let x0 = start.x;
  let y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(mask, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y0 += sy;
    }
  }
}

function fillPolygon(mask, points) {
  const minimumY = Math.max(0, Math.min(...points.map((point) => point.y)));
  const maximumY = Math.min(
    HEIGHT - 1,
    Math.max(...points.map((point) => point.y)),
  );
  for (let y = minimumY; y <= maximumY; y += 1) {
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const first = points[index];
      const second = points[(index + 1) % points.length];
      if (first.y > y === second.y > y || first.y === second.y) continue;
      const x =
        first.x + ((y - first.y) * (second.x - first.x)) / (second.y - first.y);
      intersections.push(Math.round(x));
    }
    intersections.sort((left, right) => left - right);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const start = Math.max(0, intersections[index]);
      const end = Math.min(WIDTH - 1, intersections[index + 1]);
      for (let x = start; x <= end; x += 1) setPixel(mask, x, y);
    }
  }
}

function setPixel(mask, x, y) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  mask[y * WIDTH + x] = 255;
}

function evidenceTags(tags) {
  const allowed = [
    "highway",
    "railway",
    "building",
    "waterway",
    "man_made",
    "power",
    "landuse",
    "area",
    "bridge",
    "tunnel",
    "surface",
    "width",
    "lanes",
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => tags[key] !== undefined)
      .map((key) => [key, String(tags[key])]),
  );
}

function updateSourceRegistry(manifest) {
  const registry = readJson(SOURCE_REGISTRY_PATH);
  registry.updatedAtUtc = createdAtUtc;
  registry.updatedAtAsiaShanghai = createdAtAsiaShanghai;
  registry.status = "active_sources_acquired_and_hashed";
  const source = {
    sourceId: SOURCE_ID,
    role: "engineered_feature_removal_evidence",
    provider: manifest.source.provider,
    product: manifest.source.product,
    sourceUrl: manifest.source.endpoint,
    documentationUrl: manifest.source.documentationUrl,
    license: manifest.source.license,
    licenseUrl: manifest.source.licenseUrl,
    attribution: manifest.source.attribution,
    acquisitionStatus: "overpass_query_acquired_rasterized_and_hashed",
    acquiredAtUtc: manifest.source.acquiredAtUtc,
    queryPath: manifest.source.queryPath,
    querySha256: manifest.source.querySha256,
    rawResponsePath: manifest.source.rawResponsePath,
    rawResponseSha256: manifest.source.rawResponseSha256,
    exactRealWorldGeometryDisplayAllowed: false,
    visualTrainingTargetEligible: false,
    finalWorldFactGeometryEligible: false,
    permittedUse: "engineered_feature_exclusion_and_removal_evidence_only",
  };
  registry.sources = registry.sources.filter(
    (item) => item.sourceId !== SOURCE_ID,
  );
  registry.sources.push(source);
  writeJsonAtomic(SOURCE_REGISTRY_PATH, registry);
  indexFile(SOURCE_REGISTRY_PATH, runId);
}

function updateRegionContract(manifest, remainingBlockers) {
  const contract = readJson(REGION_CONTRACT_PATH);
  contract.updatedAtUtc = createdAtUtc;
  contract.updatedAtAsiaShanghai = createdAtAsiaShanghai;
  contract.status =
    "engineered_feature_removal_evidence_compiled_world_facts_pending";
  const input = {
    sourceId: SOURCE_ID,
    role: "engineered_feature_removal_evidence",
    acquisitionStatus: "overpass_query_acquired_rasterized_and_hashed",
  };
  contract.inputs = contract.inputs.filter(
    (item) => item.sourceId !== SOURCE_ID,
  );
  contract.inputs.push(input);
  contract.humanRemovalRules.evidence = {
    sourceId: SOURCE_ID,
    exactSourceGeometryOnly: true,
    bufferApplied: false,
    classifiedRemovalMaskCount: manifest.masks.length,
    allEngineeredMaskPath: manifest.masks.find(
      (item) => item.category === "all_engineered",
    )?.path,
    finalWorldGeometryMustBeReconstructed: true,
  };
  contract.measurementEvidence = {
    ...(contract.measurementEvidence ?? {}),
    engineeredRemovalRunId: runId,
    engineeredRemovalLatestPath: `${RUNTIME_ROOT}/latest.json`,
    engineeredRemovalEvidenceCompiled: true,
  };
  contract.blockers = remainingBlockers;
  writeJsonAtomic(REGION_CONTRACT_PATH, contract);
  indexFile(REGION_CONTRACT_PATH, runId);
}

function writeImmutableBytes(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath);
    if (!existing.equals(bytes)) {
      throw new Error(`immutable source differs: ${projectPath(filePath)}`);
    }
    return;
  }
  fs.writeFileSync(filePath, bytes);
}

function writeGzipAtomic(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, zlib.gzipSync(bytes, { level: 9 }));
  fs.renameSync(temporaryPath, filePath);
}

function indexFile(filePath, artifactRunId) {
  const stats = fs.statSync(filePath);
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
  });
}

function countNonZero(values) {
  let count = 0;
  for (const value of values) if (value) count += 1;
  return count;
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function sha256Text(value) {
  return sha256Bytes(Buffer.from(value, "utf8"));
}

function sha256Bytes(bytes) {
  const hash = crypto.createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
