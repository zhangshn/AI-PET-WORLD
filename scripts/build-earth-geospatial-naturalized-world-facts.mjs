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
const OWNER_AUTHORIZATION_REF =
  "owner-approved-real-geography-naturalization-route-20260724";
const WIDTH = 1024;
const HEIGHT = 768;
const PIXEL_COUNT = WIDTH * HEIGHT;
const RUNTIME_ROOT =
  ".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs";
const REGION_CONTRACT_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  CONTRACT_ID,
  "region-contract.json",
);
const MEASUREMENT_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-naturalization-runs",
  "latest.json",
);
const SOIL_HYDROLOGY_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-soil-hydrology-runs",
  "latest.json",
);
const ENGINEERED_REMOVAL_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-engineered-removal-runs",
  "latest.json",
);

const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId = `earth-geospatial-naturalized-world-facts-${createdAtUtc.replace(
  /[:.]/g,
  "-",
)}`;
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId);

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_naturalized_world_facts_started",
  title: "Naturalized Earth-reference WorldFacts compilation started",
  titleZh: "真实地理参照自然化世界事实编译已启动",
  titleEn: "Naturalized Earth-reference WorldFacts compilation started",
  summary:
    "程序开始合并高程、土地覆盖、土壤、自然水文和人工设施移除证据，生成不携带真实导航几何的自然世界事实。本轮不生成RGB、不编译23通道、不启动GPU训练。",
  summaryEn:
    "The program started combining elevation, land cover, soil, natural hydrology, and engineered-feature removal evidence into natural WorldFacts that carry no real navigation geometry. This run creates no RGB or 23-channel package and starts no GPU training.",
  command: "npm run build:earth-geospatial-naturalized-world-facts",
  runId,
});

try {
  const regionContract = readJson(REGION_CONTRACT_PATH);
  const measurementManifest = readLatestManifest(MEASUREMENT_LATEST_PATH);
  const soilHydrologyManifest = readLatestManifest(
    SOIL_HYDROLOGY_LATEST_PATH,
  );
  const engineeredRemovalManifest = readLatestManifest(
    ENGINEERED_REMOVAL_LATEST_PATH,
  );

  assert(
    regionContract.contractId === CONTRACT_ID,
    "region contract identity mismatch",
  );
  assert(
    measurementManifest.contractId === CONTRACT_ID &&
      soilHydrologyManifest.contractId === CONTRACT_ID &&
      engineeredRemovalManifest.contractId === CONTRACT_ID,
    "source run contract identity mismatch",
  );
  assert(
    engineeredRemovalManifest.status ===
      "engineered_feature_removal_evidence_compiled",
    "engineered removal evidence is incomplete",
  );

  const elevationRecord = measurementManifest.rasterWindows?.elevation;
  const landCoverRecord = measurementManifest.rasterWindows?.landCover;
  const worldCoverHumanRemoval = measurementManifest.humanRemoval;
  const engineeredMaskRecord = engineeredRemovalManifest.masks?.find(
    (entry) => entry.category === "all_engineered",
  );
  assert(elevationRecord?.outputPath, "elevation evidence is missing");
  assert(landCoverRecord?.outputPath, "land-cover evidence is missing");
  assert(
    worldCoverHumanRemoval?.naturalizedLandCoverPath &&
      worldCoverHumanRemoval?.removalMaskPath,
    "WorldCover naturalization evidence is missing",
  );
  assert(engineeredMaskRecord?.path, "combined engineered mask is missing");

  verifyHash(elevationRecord.outputPath, elevationRecord.outputSha256);
  verifyHash(
    worldCoverHumanRemoval.naturalizedLandCoverPath,
    worldCoverHumanRemoval.naturalizedLandCoverSha256,
  );
  verifyHash(
    worldCoverHumanRemoval.removalMaskPath,
    worldCoverHumanRemoval.removalMaskSha256,
  );
  verifyHash(engineeredMaskRecord.path, engineeredMaskRecord.sha256);

  const elevation = readFloat32Gzip(elevationRecord.outputPath, PIXEL_COUNT);
  const naturalizedLandCover = readUint8Gzip(
    worldCoverHumanRemoval.naturalizedLandCoverPath,
    PIXEL_COUNT,
  );
  const worldCoverRemovalMask = readUint8Gzip(
    worldCoverHumanRemoval.removalMaskPath,
    PIXEL_COUNT,
  );
  const engineeredMask = readUint8Gzip(
    engineeredMaskRecord.path,
    PIXEL_COUNT,
  );
  const combinedRemovalMask = new Uint8Array(PIXEL_COUNT);
  for (let index = 0; index < PIXEL_COUNT; index += 1) {
    if (worldCoverRemovalMask[index] || engineeredMask[index]) {
      combinedRemovalMask[index] = 255;
    }
  }

  const reconstruction = reconstructNaturalLandCover(
    naturalizedLandCover,
    combinedRemovalMask,
    WIDTH,
    HEIGHT,
  );
  const combinedRemovalMaskPath = path.join(
    runRoot,
    "naturalization-evidence",
    "combined-human-removal-mask-u8.bin.gz",
  );
  const reconstructedLandCoverPath = path.join(
    runRoot,
    "naturalization-evidence",
    "reconstructed-natural-land-cover-u8.bin.gz",
  );
  writeGzipAtomic(combinedRemovalMaskPath, Buffer.from(combinedRemovalMask));
  writeGzipAtomic(
    reconstructedLandCoverPath,
    Buffer.from(reconstruction.values),
  );
  indexFile(combinedRemovalMaskPath, runId);
  indexFile(reconstructedLandCoverPath, runId);

  const elevationStats = describeFloat32(elevation);
  const slopeRecord = soilHydrologyManifest.naturalHydrology;
  verifyHash(slopeRecord.slopePath, slopeRecord.slopeSha256);
  const slope = readFloat32Gzip(
    slopeRecord.slopePath,
    slopeRecord.analysisGrid.width * slopeRecord.analysisGrid.height,
  );
  const slopeStats = describeFloat32(slope);
  const landCoverHistogram = histogram(reconstruction.values);
  const soilFacts = soilHydrologyManifest.soil.measurements.map((entry) => ({
    propertyId: entry.propertyId,
    depthInterval: soilHydrologyManifest.soil.depthInterval,
    quantile: soilHydrologyManifest.soil.quantile,
    conventionalUnit: entry.conventionalUnit,
    statistics: entry.conventionalStatistics,
    sourceSha256: entry.sourceSha256,
    normalizedEvidencePath: entry.outputPath,
    normalizedEvidenceSha256: entry.outputSha256,
  }));

  const worldFacts = {
    schemaVersion: "earth-reference-naturalized-world-facts-v1",
    worldFactSetId: `${CONTRACT_ID}-naturalized-world-facts-v1`,
    status: "naturalized_world_facts_compiled_conditions_pending",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    worldProfileId: regionContract.worldProfileId,
    sourceRunIds: {
      measurement: measurementManifest.runId,
      soilHydrology: soilHydrologyManifest.runId,
      engineeredRemoval: engineeredRemovalManifest.runId,
    },
    identityBoundary: {
      referenceRegion: "Sakaerat / Wang Nam Khiao, Thailand",
      role: "measured ecological and terrain parameter reference",
      exactRealWorldGeometryCarriedForward: false,
      exactRealWorldNavigationGeometryCreated: false,
      exactOsmGeometryCarriedForward: false,
      finalGameCoordinateGeometryCreated: false,
      externalRgbUsed: false,
      historicalGameRgbUsed: false,
    },
    measuredNaturalFacts: {
      observationExtentId: regionContract.observationArea.extentId,
      observationExtentPath: regionContract.observationArea.extentPath,
      canvasMeasurementGrid: {
        width: WIDTH,
        height: HEIGHT,
        runtimeMetresPerPixelDefined: false,
      },
      relief: {
        source: "Copernicus DEM GLO-30",
        elevationMetres: elevationStats,
        normalizedSlope: slopeStats,
        derivedClass: classifyRelief(elevationStats, slopeStats),
      },
      landCoverAfterHumanRemoval: {
        source: "ESA WorldCover 2021 plus OSM exclusion evidence",
        classLegend: {
          10: "tree_cover",
          30: "grassland",
          60: "bare_or_sparse_vegetation",
        },
        classHistogram: landCoverHistogram,
        reconstructedPixelCount: reconstruction.reconstructedPixelCount,
        reconstructionMaximumDistancePixels:
          reconstruction.maximumDistancePixels,
      },
      soil: {
        source: "SoilGrids 2.0",
        measurements: soilFacts,
      },
      naturalHydrology: {
        source: "DEM-derived provisional natural drainage evidence",
        method: slopeRecord.method,
        analysisGrid: slopeRecord.analysisGrid,
        statistics: slopeRecord.statistics,
        finalGeometryStatus:
          "measurement_profile_only_pending_world_director_normalization",
      },
    },
    naturalizationFacts: {
      humanInfluenceAbsentFromGameFacts: true,
      combinedHumanRemovalPixelCount: countNonZero(combinedRemovalMask),
      worldCoverHumanRemovalPixelCount:
        worldCoverHumanRemoval.removedPixelCount,
      engineeredRemovalPixelCount: engineeredMaskRecord.nonZeroPixelCount,
      combinedHumanRemovalMaskPath: projectPath(combinedRemovalMaskPath),
      combinedHumanRemovalMaskSha256: sha256File(combinedRemovalMaskPath),
      reconstructedNaturalLandCoverPath: projectPath(
        reconstructedLandCoverPath,
      ),
      reconstructedNaturalLandCoverSha256: sha256File(
        reconstructedLandCoverPath,
      ),
      reconstructionMethod:
        "Multi-source four-neighbour nearest-natural-class propagation over the union of WorldCover cropland/built-up exclusions and exact OSM engineered-feature evidence.",
      removedSemantics: [
        "building",
        "settlement",
        "urban_surface",
        "engineered_road",
        "railway",
        "engineered_waterway",
        "human_landuse",
        "cropland_geometry",
        "parcel_boundary",
      ],
    },
    ecologyFacts: {
      earthReferenceProfile:
        "mainland_southeast_asia_tropical_monsoon_lowland_valley_and_low_hill",
      supportedNaturalSystems: [
        "tropical_evergreen_forest",
        "seasonal_evergreen_and_semi_evergreen_forest",
        "moist_deciduous_forest",
        "dry_dipterocarp_woodland",
        "natural_grassland_opening",
        "freshwater_drainage_and_wetland_where_supported_by_world_facts",
        "low_hill_and_valley_relief",
      ],
      excludedNaturalSystems: [
        "snow",
        "glacier",
        "alpine_tundra",
        "desert",
        "cold_temperate_conifer_identity",
        "unapproved_coastal_mangrove_identity",
      ],
    },
    autonomyFacts: {
      presetHomeSite: false,
      presetActivityCenter: false,
      presetConstructionClearing: false,
      presetRouteConvergencePlatform: false,
      focalAreaActive: false,
      focalAreaRequiredValue: "all_zero",
      futureSiteSelectionAuthority:
        "runtime_ai_butler_after_legal_world_fact_change_only",
    },
    downstreamContract: {
      nextStage:
        "world_director_normalization_and_complete_map_23_channel_compilation",
      worldDirectorMustCreateNewGameGeometry: true,
      worldDirectorMayCopyRealMapGeometry: false,
      worldDirectorMayCopyOsmGeometry: false,
      completeMapScopeRequired: true,
      localCropAllowed: false,
      rgbGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    sourceEvidence: buildSourceEvidence({
      measurementManifest,
      soilHydrologyManifest,
      engineeredRemovalManifest,
    }),
  };
  const worldFactsPath = path.join(runRoot, "naturalized-world-facts.json");
  writeJsonAtomic(worldFactsPath, worldFacts);
  indexFile(worldFactsPath, runId);

  const lineage = {
    schemaVersion: "earth-reference-naturalized-world-fact-lineage-v1",
    runId,
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    sourceArtifacts: worldFacts.sourceEvidence,
    transformations: [
      {
        order: 1,
        id: "union_human_removal_evidence",
        input:
          "WorldCover cropland/built-up mask plus exact OSM engineered-feature mask",
        output: projectPath(combinedRemovalMaskPath),
      },
      {
        order: 2,
        id: "nearest_natural_class_reconstruction",
        input:
          "naturalized WorldCover classes and combined human-removal mask",
        output: projectPath(reconstructedLandCoverPath),
      },
      {
        order: 3,
        id: "aggregate_measurement_facts_without_source_geometry",
        input:
          "elevation, slope, land-cover, soil, hydrology, and removal evidence",
        output: projectPath(worldFactsPath),
      },
    ],
    exactRealWorldGeometryCarriedForward: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
  };
  const lineagePath = path.join(runRoot, "lineage.json");
  writeJsonAtomic(lineagePath, lineage);
  indexFile(lineagePath, runId);

  const remainingBlockers = ["complete_map_23_channels_missing"];
  const manifest = {
    schemaVersion: "earth-reference-naturalized-world-fact-run-v1",
    runId,
    status: "naturalized_world_facts_compiled_conditions_pending",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    worldFactSetId: worldFacts.worldFactSetId,
    worldFactsPath: projectPath(worldFactsPath),
    worldFactsSha256: sha256File(worldFactsPath),
    lineagePath: projectPath(lineagePath),
    lineageSha256: sha256File(lineagePath),
    combinedHumanRemovalMaskPath: projectPath(combinedRemovalMaskPath),
    combinedHumanRemovalMaskSha256: sha256File(combinedRemovalMaskPath),
    reconstructedNaturalLandCoverPath: projectPath(
      reconstructedLandCoverPath,
    ),
    reconstructedNaturalLandCoverSha256: sha256File(
      reconstructedLandCoverPath,
    ),
    statistics: {
      combinedHumanRemovalPixelCount: countNonZero(combinedRemovalMask),
      reconstructedPixelCount: reconstruction.reconstructedPixelCount,
      reconstructionMaximumDistancePixels:
        reconstruction.maximumDistancePixels,
      elevationMetres: elevationStats,
      normalizedSlope: slopeStats,
      naturalizedLandCoverHistogram: landCoverHistogram,
    },
    outputBoundary: {
      derivedWorldFactsCreated: true,
      finalGameCoordinateGeometryCreated: false,
      worldDirectorOutputCreated: false,
      completeMap23ChannelsCreated: false,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    remainingBlockers,
  };

  updateRegionContract(manifest, remainingBlockers);
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "naturalized-world-fact-run.json",
    record: manifest,
    latest: {
      contractId: CONTRACT_ID,
      worldFactSetId: worldFacts.worldFactSetId,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_naturalized_world_facts_completed",
    title: "Naturalized Earth-reference WorldFacts compilation completed",
    titleZh: "真实地理参照自然化世界事实编译已完成",
    titleEn: "Naturalized Earth-reference WorldFacts compilation completed",
    summary:
      "程序已自动保存自然化世界事实、人工影响合并遮罩、自然土地覆盖重建结果、来源谱系、双时区时间和哈希。真实地图导航几何未进入世界事实；未生成RGB、未启动GPU训练。",
    summaryEn:
      "The program automatically stored naturalized WorldFacts, the combined human-influence mask, reconstructed natural land cover, source lineage, dual-timezone timestamps, and hashes. Real navigation geometry did not enter the WorldFacts; no RGB or GPU training was started.",
    command: "npm run build:earth-geospatial-naturalized-world-facts",
    runId,
    evidencePath: runPath,
  });

  console.log(
    JSON.stringify(
      {
        runId,
        status: manifest.status,
        worldFactsPath: manifest.worldFactsPath,
        combinedHumanRemovalPixelCount:
          manifest.statistics.combinedHumanRemovalPixelCount,
        reconstructedPixelCount: manifest.statistics.reconstructedPixelCount,
        reliefClass: worldFacts.measuredNaturalFacts.relief.derivedClass,
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
    schemaVersion: "earth-reference-naturalized-world-fact-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    errorCode: "earth_geospatial_naturalized_world_facts_failed",
    error: error instanceof Error ? error.message : String(error),
    derivedWorldFactsCreated: false,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    rgbCreated: false,
  };
  const failurePath = path.join(runRoot, "failure.json");
  writeJsonAtomic(failurePath, failure);
  indexFile(failurePath, runId);
  appendAiPainterProgramEvent({
    timestamp: failedAtUtc,
    status: "failed",
    type: "earth_geospatial_naturalized_world_facts_failed",
    title: "Naturalized Earth-reference WorldFacts compilation failed",
    titleZh: "真实地理参照自然化世界事实编译失败",
    titleEn: "Naturalized Earth-reference WorldFacts compilation failed",
    summary: failure.error,
    summaryEn: failure.error,
    command: "npm run build:earth-geospatial-naturalized-world-facts",
    runId,
    evidencePath: projectPath(failurePath),
  });
  throw error;
}

function readLatestManifest(latestPath) {
  const latest = readJson(latestPath);
  assert(latest.runPath, `latest pointer has no runPath: ${projectPath(latestPath)}`);
  return readJson(path.join(ROOT, latest.runPath));
}

function buildSourceEvidence({
  measurementManifest,
  soilHydrologyManifest,
  engineeredRemovalManifest,
}) {
  const records = [
    {
      role: "measurement_window",
      runId: measurementManifest.runId,
      path: readJson(MEASUREMENT_LATEST_PATH).runPath,
    },
    {
      role: "soil_and_natural_hydrology",
      runId: soilHydrologyManifest.runId,
      path: readJson(SOIL_HYDROLOGY_LATEST_PATH).runPath,
    },
    {
      role: "engineered_feature_removal",
      runId: engineeredRemovalManifest.runId,
      path: readJson(ENGINEERED_REMOVAL_LATEST_PATH).runPath,
    },
  ];
  return records.map((entry) => ({
    ...entry,
    sha256: sha256File(path.join(ROOT, entry.path)),
  }));
}

function reconstructNaturalLandCover(values, removalMask, width, height) {
  const output = new Uint8Array(values);
  const distance = new Int32Array(values.length);
  distance.fill(-1);
  const queue = new Int32Array(values.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (!removalMask[index] && values[index] > 0) {
      distance[index] = 0;
      queue[tail++] = index;
    }
  }
  assert(tail > 0, "no natural land-cover source pixels are available");
  let reconstructedPixelCount = 0;
  let maximumDistancePixels = 0;
  const offsets = [-width, 1, width, -1];
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    for (const offset of offsets) {
      const next = index + offset;
      if (next < 0 || next >= values.length || distance[next] >= 0) continue;
      if (offset === 1 && x === width - 1) continue;
      if (offset === -1 && x === 0) continue;
      distance[next] = distance[index] + 1;
      output[next] = output[index];
      queue[tail++] = next;
      if (removalMask[next]) {
        reconstructedPixelCount += 1;
        maximumDistancePixels = Math.max(
          maximumDistancePixels,
          distance[next],
        );
      }
    }
  }
  assert(
    reconstructedPixelCount === countNonZero(removalMask),
    "not every removed pixel was reconstructed",
  );
  return {
    values: output,
    reconstructedPixelCount,
    maximumDistancePixels,
  };
}

function describeFloat32(values) {
  const sorted = new Float32Array(values);
  sorted.sort();
  let sum = 0;
  for (const value of values) sum += value;
  return {
    minimum: sorted[0],
    p10: quantileSorted(sorted, 0.1),
    p25: quantileSorted(sorted, 0.25),
    median: quantileSorted(sorted, 0.5),
    p75: quantileSorted(sorted, 0.75),
    p90: quantileSorted(sorted, 0.9),
    maximum: sorted.at(-1),
    mean: sum / values.length,
    sampleCount: values.length,
  };
}

function quantileSorted(sorted, ratio) {
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function classifyRelief(elevation, slope) {
  const relief = elevation.maximum - elevation.minimum;
  if (relief >= 400 || slope.p90 >= 0.45) {
    return "lowland_valley_to_rugged_low_mountain_transition";
  }
  if (relief >= 180 || slope.p90 >= 0.2) {
    return "lowland_valley_to_low_hill_transition";
  }
  return "lowland_undulating_plain";
}

function histogram(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function readFloat32Gzip(relativePath, expectedCount) {
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, relativePath)));
  assert(
    bytes.length === expectedCount * Float32Array.BYTES_PER_ELEMENT,
    `float32 payload mismatch: ${relativePath}`,
  );
  return new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    expectedCount,
  ).slice();
}

function readUint8Gzip(relativePath, expectedCount) {
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, relativePath)));
  assert(
    bytes.length === expectedCount,
    `uint8 payload mismatch: ${relativePath}`,
  );
  return new Uint8Array(bytes);
}

function writeGzipAtomic(filePath, bytes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, zlib.gzipSync(bytes, { level: 9 }));
  fs.renameSync(tempPath, filePath);
}

function updateRegionContract(manifest, remainingBlockers) {
  const contract = readJson(REGION_CONTRACT_PATH);
  contract.status =
    "naturalized_world_facts_compiled_complete_map_conditions_pending";
  contract.updatedAtUtc = createdAtUtc;
  contract.updatedAtAsiaShanghai = createdAtAsiaShanghai;
  contract.blockers = remainingBlockers;
  contract.measurementEvidence = {
    ...(contract.measurementEvidence ?? {}),
    naturalizedWorldFactRunId: runId,
    naturalizedWorldFactLatestPath: `${RUNTIME_ROOT}/latest.json`,
    naturalizedWorldFactsCompiled: true,
    exactRealWorldGeometryCarriedForward: false,
  };
  contract.outputBoundary = {
    ...(contract.outputBoundary ?? {}),
    rawMeasurementIsWorldFact: false,
    derivedNaturalFactRequiresAudit: false,
    naturalizedWorldFactsCompiled: true,
    completeMap23ChannelsCreated: false,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
    formalCandidateEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  };
  writeJsonAtomic(REGION_CONTRACT_PATH, contract);
}

function verifyHash(relativePath, expectedHash) {
  assert(relativePath && expectedHash, "evidence path or hash is missing");
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `evidence missing: ${relativePath}`);
  assert(
    sha256File(absolutePath) === expectedHash,
    `evidence hash mismatch: ${relativePath}`,
  );
}

function indexFile(filePath, sourceRunId) {
  const stats = fs.statSync(filePath);
  indexArtifact({
    logicalPath: logicalProjectPath(filePath),
    physicalUri: fs.realpathSync(filePath),
    storageLayer: "hot",
    runId: sourceRunId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(filePath),
  });
}

function countNonZero(values) {
  let count = 0;
  for (const value of values) {
    if (value) count += 1;
  }
  return count;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
