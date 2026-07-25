import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";
import { auditCompleteMapScope } from "./lib/complete-map-scope-gate.mjs";

const ROOT = process.cwd();
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1";
const OWNER_AUTHORIZATION_REF =
  "owner-approved-real-geography-naturalization-route-20260724";
const WORLD_PROFILE_ID =
  "mainland-southeast-asia-tropical-monsoon-natural-home-v1";
const CONNECTIVITY_BLUEPRINT_ID =
  "mainland-southeast-asia-earth-reference-natural-home-region-0001-v1";
const WIDTH = 1024;
const HEIGHT = 768;
const RUNTIME_ROOT =
  ".runtime/ai-painter/earth-geospatial-complete-map-condition-runs";
const WORLD_FACT_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-naturalized-world-fact-runs",
  "latest.json",
);
const REGION_CONTRACT_PATH = path.join(
  ROOT,
  "data",
  "world-samples",
  "earth-geospatial",
  "regions",
  CONTRACT_ID,
  "region-contract.json",
);
const CONNECTIVITY_BLUEPRINT_PATH =
  "data/world-samples/world-connectivity/blueprints/mainland-southeast-asia-tropical-monsoon-natural-home-v1/mainland-southeast-asia-earth-reference-natural-home-region-0001-v1/blueprint.json";
const DICTIONARY_PATH =
  "data/world-visual-data-dictionary/mvp-natural-home-v0.3.json";
const WORLD_PROFILE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json";
const FACTUAL_REFERENCE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json";

const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId = `earth-geospatial-complete-map-conditions-${createdAtUtc.replace(
  /[:.]/g,
  "-",
)}`;
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId);
const taskRoot = path.join(runRoot, "complete-map-condition-task");

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  status: "running",
  type: "earth_geospatial_complete_map_conditions_started",
  title: "Earth-reference complete-map condition compilation started",
  titleZh: "真实地理参照完整地图条件编译已启动",
  titleEn: "Earth-reference complete-map condition compilation started",
  summary:
    "程序开始把自然化世界事实和已审核的大世界连接契约归一化为新的匿名游戏坐标，生成世界导演、完整地图任务和23通道。不得读取历史RGB、复制真实地图几何、生成RGB或启动GPU。",
  summaryEn:
    "The program started normalizing naturalized WorldFacts and the approved large-world connectivity contract into new de-identified game coordinates, a World Director output, a complete-map task, and 23 channels. Historical RGB, real-map geometry copying, RGB generation, and GPU execution are forbidden.",
  command: "npm run build:earth-geospatial-complete-map-conditions",
  runId,
});

try {
  const worldFactLatest = readJson(WORLD_FACT_LATEST_PATH);
  const worldFactRun = readJson(path.join(ROOT, worldFactLatest.runPath));
  const worldFacts = readJson(path.join(ROOT, worldFactRun.worldFactsPath));
  const regionContract = readJson(REGION_CONTRACT_PATH);
  const connectivityBlueprint = readJson(
    path.join(ROOT, CONNECTIVITY_BLUEPRINT_PATH),
  );

  assert(worldFactRun.contractId === CONTRACT_ID, "WorldFacts contract mismatch");
  assert(worldFacts.contractId === CONTRACT_ID, "WorldFacts identity mismatch");
  assert(
    worldFacts.status ===
      "naturalized_world_facts_compiled_conditions_pending",
    "WorldFacts are not ready for condition compilation",
  );
  assert(
    worldFacts.identityBoundary.exactRealWorldGeometryCarriedForward ===
      false &&
      worldFacts.identityBoundary.exactOsmGeometryCarriedForward === false &&
      worldFacts.identityBoundary.finalGameCoordinateGeometryCreated === false,
    "WorldFacts crossed the real-geometry boundary",
  );
  assert(
    worldFacts.autonomyFacts.presetHomeSite === false &&
      worldFacts.autonomyFacts.presetActivityCenter === false &&
      worldFacts.autonomyFacts.presetConstructionClearing === false &&
      worldFacts.autonomyFacts.focalAreaActive === false,
    "WorldFacts violate the initial-world autonomy contract",
  );
  assert(
    connectivityBlueprint.blueprintId === CONNECTIVITY_BLUEPRINT_ID,
    "connectivity blueprint mismatch",
  );
  assert(
    connectivityBlueprint.worldProfileId === WORLD_PROFILE_ID,
    "connectivity world profile mismatch",
  );

  const worldFactsSha256 = sha256File(
    path.join(ROOT, worldFactRun.worldFactsPath),
  );
  const seedHex = sha256(
    Buffer.from(
      [
        worldFactsSha256,
        sha256File(path.join(ROOT, CONNECTIVITY_BLUEPRINT_PATH)),
        "deidentified-complete-map-game-coordinate-normalization-v1",
      ].join(":"),
    ),
  );
  const random = mulberry32(Number.parseInt(seedHex.slice(0, 8), 16));
  const conditionId = `earth-reference-naturalized-complete-map-${seedHex.slice(
    0,
    12,
  )}`;
  const worldId = `training-world:${conditionId}`;
  const taskId = `world-visual-task-${conditionId}-${createdAtUtc.replace(
    /[:.]/g,
    "-",
  )}`;
  const directorRunId = `world-director-${conditionId}-${createdAtUtc.replace(
    /[:.]/g,
    "-",
  )}`;

  const geometry = buildGameGeometry({
    conditionId,
    random,
    worldFacts,
    connectivityBlueprint,
  });
  const sourceFactIds = buildSourceFactIds(conditionId, geometry);
  const blueprint = buildBlueprint({
    conditionId,
    worldId,
    taskId,
    seedHex,
    worldFacts,
    worldFactRun,
    geometry,
  });
  blueprint.blueprintSha256 = canonicalSha256(blueprint);
  const blueprintPath = path.join(taskRoot, "world-fact-blueprint.json");
  writeJsonAtomic(blueprintPath, blueprint);

  const director = buildDirector({
    conditionId,
    worldId,
    taskId,
    directorRunId,
    sourceFactIds,
    worldFacts,
    geometry,
  });
  director.directorSha256 = canonicalSha256(director);
  const directorPath = path.join(taskRoot, "director-output.json");
  writeJsonAtomic(directorPath, director);

  const visualFacts = buildVisualFactManifest({
    conditionId,
    worldId,
    taskId,
    sourceFactIds,
    worldFacts,
    geometry,
  });
  visualFacts.manifestSha256 = canonicalSha256(visualFacts);
  const visualFactPath = path.join(taskRoot, "visual-fact-manifest.json");
  writeJsonAtomic(visualFactPath, visualFacts);

  const task = buildTask({
    conditionId,
    worldId,
    taskId,
    director,
    geometry,
    visualFacts,
    blueprintPath,
    directorPath,
    visualFactPath,
    worldFacts,
    worldFactRun,
  });
  task.taskSha256 = canonicalSha256(task);
  const taskPath = path.join(taskRoot, "task-package.json");
  writeJsonAtomic(taskPath, task);

  const taskManifestPath = path.join(taskRoot, "task-manifest.json");
  const taskManifest = {
    schemaVersion: "world-visual-generation-task-manifest-v1",
    taskId,
    status: task.status,
    inferenceStatus: "rgb_generation_not_started",
    createdAt: createdAtUtc,
    createdAtAsiaShanghai,
    dictionaryVersionId: task.dictionaryVersionId,
    worldId,
    ownerId: task.ownerId,
    tick: task.tick,
    worldProfileId: WORLD_PROFILE_ID,
    generationContractVersion: task.generationContractVersion,
    conditionLabel: conditionId,
    earthParameterSnapshotId: task.earthParameterSnapshotId,
    sourceMode: "naturalized_earth_facts_plus_locked_connectivity",
    taskSha256: task.taskSha256,
    taskPath: projectPath(taskPath),
    manifestPath: projectPath(taskManifestPath),
    directorPath: projectPath(directorPath),
    blueprintPath: projectPath(blueprintPath),
    imageCount: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
    automaticStorage: true,
  };
  writeJsonAtomic(taskManifestPath, taskManifest);

  execFileSync(
    process.execPath,
    [
      path.join(ROOT, "scripts", "compile-current-world-visual-conditions.mjs"),
      "--task-manifest",
      projectPath(taskManifestPath),
    ],
    { cwd: ROOT, stdio: "pipe" },
  );

  const conditionPackPath = path.join(
    taskRoot,
    "compiled-conditions",
    "condition-pack.json",
  );
  const conditionManifestPath = path.join(
    taskRoot,
    "compiled-conditions",
    "manifest.json",
  );
  const conditionPack = readJson(conditionPackPath);
  const conditionManifest = readJson(conditionManifestPath);
  assert(
    conditionManifest.channelCount === 23 &&
      conditionPack.channels?.length === 23,
    "complete-map compiler did not create exactly 23 channels",
  );

  const scopeAudit = await auditCompleteMapScope({
    blueprint,
    directorOutput: director,
    task,
    conditionPack,
    connectivityBlueprint,
  });
  assert(
    scopeAudit.passed === true &&
      scopeAudit.status === "complete_map_scope_passed",
    `complete-map scope audit failed: ${scopeAudit.issues.join(",")}`,
  );
  const scopeAuditPath = path.join(taskRoot, "complete-map-scope-audit.json");
  writeJsonAtomic(scopeAuditPath, scopeAudit);

  const lineage = {
    schemaVersion: "earth-reference-complete-map-condition-lineage-v1",
    runId,
    conditionId,
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    sourceWorldFactRunId: worldFactRun.runId,
    sourceWorldFactsPath: worldFactRun.worldFactsPath,
    sourceWorldFactsSha256: worldFactsSha256,
    connectivityBlueprintId: CONNECTIVITY_BLUEPRINT_ID,
    connectivityBlueprintPath: CONNECTIVITY_BLUEPRINT_PATH,
    connectivityBlueprintSha256: sha256File(
      path.join(ROOT, CONNECTIVITY_BLUEPRINT_PATH),
    ),
    normalizationAlgorithm: {
      id: "deidentified-complete-map-game-coordinate-normalization-v1",
      deterministicSeedSha256: seedHex,
      consumesAggregateMeasuredFactsOnly: true,
      copiesRealMapGeometry: false,
      copiesOsmGeometry: false,
      readsHistoricalRgb: false,
      usesHistoricalLayout: false,
      createsNewGameCoordinateGeometry: true,
    },
    autonomyContract: {
      presetHomeSite: false,
      presetActivityCenter: false,
      presetConstructionClearing: false,
      presetRouteConvergencePlatform: false,
      focalAreaActive: false,
      focalAreaRequiredValue: "all_zero",
    },
    outputBoundary: {
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
  };
  const lineagePath = path.join(taskRoot, "condition-lineage.json");
  writeJsonAtomic(lineagePath, lineage);

  indexRunFiles(runRoot, runId);
  const runManifest = {
    schemaVersion: "earth-reference-complete-map-condition-run-v1",
    runId,
    status: "complete_map_conditions_ready_rgb_authorization_required",
    createdAtUtc,
    createdAtAsiaShanghai,
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    conditionId,
    worldFactRunId: worldFactRun.runId,
    worldFactsPath: worldFactRun.worldFactsPath,
    worldFactsSha256,
    blueprintPath: projectPath(blueprintPath),
    blueprintSha256: sha256File(blueprintPath),
    directorPath: projectPath(directorPath),
    directorSha256: sha256File(directorPath),
    visualFactManifestPath: projectPath(visualFactPath),
    visualFactManifestSha256: sha256File(visualFactPath),
    taskPath: projectPath(taskPath),
    taskSha256: sha256File(taskPath),
    taskManifestPath: projectPath(taskManifestPath),
    taskManifestSha256: sha256File(taskManifestPath),
    conditionManifestPath: projectPath(conditionManifestPath),
    conditionManifestSha256: sha256File(conditionManifestPath),
    conditionPackPath: projectPath(conditionPackPath),
    conditionPackSha256: sha256File(conditionPackPath),
    scopeAuditPath: projectPath(scopeAuditPath),
    scopeAuditSha256: sha256File(scopeAuditPath),
    lineagePath: projectPath(lineagePath),
    lineageSha256: sha256File(lineagePath),
    channelCount: conditionManifest.channelCount,
    completeMapScopePassed: true,
    focalAreaNonZeroCount:
      conditionPack.channels.find((entry) => entry.id === "focal_area")
        ?.statistics?.nonZeroCount ?? -1,
    exactRealWorldGeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
    historicalRgbRead: false,
    historicalLayoutRead: false,
    newGameCoordinateGeometryCreated: true,
    remainingBlockers: [],
    nextRequiredAuthorization:
      "owner_authorization_required_before_any_rgb_generation",
    outputBoundary: {
      worldDirectorOutputCreated: true,
      completeMap23ChannelsCreated: true,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
  };

  updateRegionContract(runManifest);
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "complete-map-condition-run.json",
    record: runManifest,
    latest: {
      contractId: CONTRACT_ID,
      conditionId,
      channelCount: 23,
      completeMapScopePassed: true,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
  });

  appendAiPainterProgramEvent({
    timestamp: new Date().toISOString(),
    status: "success",
    type: "earth_geospatial_complete_map_conditions_completed",
    title: "Earth-reference complete-map conditions passed",
    titleZh: "真实地理参照完整地图条件已通过",
    titleEn: "Earth-reference complete-map conditions passed",
    summary:
      "程序已自动保存自然化世界事实绑定、世界导演、完整地图任务、23通道、范围审核、来源谱系、双时区时间和哈希。focal_area为全零；未读取历史RGB或真实地图几何，未生成RGB，未启动GPU。",
    summaryEn:
      "The program automatically stored the naturalized WorldFacts binding, World Director output, complete-map task, 23 channels, scope audit, source lineage, dual-timezone timestamps, and hashes. focal_area is all-zero; no historical RGB or real-map geometry was read, no RGB was created, and no GPU was started.",
    command: "npm run build:earth-geospatial-complete-map-conditions",
    runId,
    evidencePath: runPath,
  });

  console.log(
    JSON.stringify(
      {
        runId,
        status: runManifest.status,
        conditionId,
        channelCount: runManifest.channelCount,
        completeMapScopePassed: runManifest.completeMapScopePassed,
        focalAreaNonZeroCount: runManifest.focalAreaNonZeroCount,
        remainingBlockers: runManifest.remainingBlockers,
        nextRequiredAuthorization: runManifest.nextRequiredAuthorization,
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
    schemaVersion: "earth-reference-complete-map-condition-failure-v1",
    runId,
    status: "failed",
    createdAtUtc,
    createdAtAsiaShanghai,
    failedAtUtc,
    failedAtAsiaShanghai: formatShanghai(failedAtUtc),
    contractId: CONTRACT_ID,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    errorCode: "earth_geospatial_complete_map_conditions_failed",
    error: error instanceof Error ? error.message : String(error),
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
    type: "earth_geospatial_complete_map_conditions_failed",
    title: "Earth-reference complete-map condition compilation failed",
    titleZh: "真实地理参照完整地图条件编译失败",
    titleEn: "Earth-reference complete-map condition compilation failed",
    summary: failure.error,
    summaryEn: failure.error,
    command: "npm run build:earth-geospatial-complete-map-conditions",
    runId,
    evidencePath: projectPath(failurePath),
  });
  throw error;
}

function buildGameGeometry({
  conditionId,
  random,
  worldFacts,
  connectivityBlueprint,
}) {
  const currentPorts = (connectivityBlueprint.edgePorts ?? []).filter(
    (entry) => entry.regionId === connectivityBlueprint.currentRegion.regionId,
  );
  const northWaterPort = currentPorts.find(
    (entry) =>
      entry.kind === "watercourse" && entry.boundarySide === "north",
  );
  const southWaterPort = currentPorts.find(
    (entry) =>
      entry.kind === "watercourse" && entry.boundarySide === "south",
  );
  const southPathPort = currentPorts.find(
    (entry) => entry.kind === "path" && entry.boundarySide === "south",
  );
  assert(northWaterPort && southWaterPort, "locked water ports are missing");
  assert(southPathPort, "locked south path port is missing");

  const waterCenterline = [
    { x: northWaterPort.boundaryPosition.x, y: 0 },
    { x: jitter(920, 12, random), y: 92 },
    { x: jitter(900, 16, random), y: 188 },
    { x: jitter(926, 14, random), y: 284 },
    { x: jitter(892, 16, random), y: 382 },
    { x: jitter(918, 14, random), y: 478 },
    { x: jitter(890, 16, random), y: 574 },
    { x: jitter(866, 12, random), y: 674 },
    { x: southWaterPort.boundaryPosition.x, y: HEIGHT },
  ];
  const waterHalfWidths = [76, 82, 88, 92, 98, 106, 116, 128, 140];
  const waterPolygon = ribbonPolygonVariable(
    waterCenterline,
    waterHalfWidths,
    WIDTH,
    HEIGHT,
  );
  const shorelinePolygon = ribbonPolygonVariable(
    waterCenterline.map((point) => ({ x: point.x - 15, y: point.y })),
    waterHalfWidths.map((value) => value + 12),
    WIDTH,
    HEIGHT,
  );

  const pathCenterline = [
    { x: southPathPort.boundaryPosition.x, y: HEIGHT },
    { x: jitter(118, 8, random), y: 690 },
    { x: jitter(168, 14, random), y: 602 },
    { x: jitter(146, 12, random), y: 516 },
    { x: jitter(226, 14, random), y: 424 },
    { x: jitter(192, 10, random), y: 340 },
    { x: jitter(278, 12, random), y: 252 },
    { x: jitter(250, 10, random), y: 166 },
    { x: jitter(326, 8, random), y: 82 },
  ];
  const pathPolygon = ribbonPolygon(pathCenterline, 18, WIDTH, HEIGHT);
  const entranceBounds = {
    x: Math.max(0, southPathPort.boundaryPosition.x - 38),
    y: HEIGHT - 44,
    width: 76,
    height: 44,
  };

  const baseGrass = rectanglePolygon(0, 0, WIDTH, HEIGHT);
  const naturalBoundaryPolygons = [
    rectanglePolygon(0, 0, 58, HEIGHT),
    [
      { x: 58, y: 0 },
      { x: 760, y: 0 },
      { x: 744, y: 38 },
      { x: 602, y: 46 },
      { x: 430, y: 34 },
      { x: 286, y: 48 },
      { x: 58, y: 40 },
    ],
    [
      { x: 0, y: HEIGHT - 42 },
      { x: 48, y: HEIGHT - 48 },
      { x: 62, y: HEIGHT },
      { x: 0, y: HEIGHT },
    ],
  ];
  const tallGrassRegions = [
    irregularEllipsePolygon(610, 188, 132, 74, 18, random),
    irregularEllipsePolygon(514, 594, 156, 82, 18, random),
    irregularEllipsePolygon(368, 414, 92, 58, 16, random),
  ];
  const mudRegions = [
    irregularEllipsePolygon(760, 630, 80, 38, 16, random),
    irregularEllipsePolygon(520, 274, 62, 31, 16, random),
  ];

  const terrainRegions = [
    terrain(`${conditionId}-grass`, "grass", baseGrass),
    terrain(`${conditionId}-water`, "water", waterPolygon),
    terrain(`${conditionId}-shoreline`, "shoreline", shorelinePolygon),
    terrain(`${conditionId}-path`, "path_ground", pathPolygon),
    ...naturalBoundaryPolygons.map((polygon, index) =>
      terrain(
        `${conditionId}-natural-boundary-${index + 1}`,
        "natural_boundary",
        polygon,
      ),
    ),
    ...tallGrassRegions.map((polygon, index) =>
      terrain(
        `${conditionId}-tall-grass-${index + 1}`,
        "tall_grass",
        polygon,
      ),
    ),
    ...mudRegions.map((polygon, index) =>
      terrain(`${conditionId}-mud-${index + 1}`, "mud_patch", polygon),
    ),
  ];
  const walkableRegions = [
    { sourceId: `${conditionId}-path-walkable`, polygon: pathPolygon },
  ];
  const collisionRegions = [
    {
      sourceId: `${conditionId}-water-collision`,
      polygon: waterPolygon,
    },
    ...naturalBoundaryPolygons.map((polygon, index) => ({
      sourceId: `${conditionId}-boundary-collision-${index + 1}`,
      polygon,
    })),
  ];

  const forbiddenMasks = [
    pathPolygon,
    waterPolygon,
    ...naturalBoundaryPolygons,
  ];
  const objectFootprints = placeObjects({
    conditionId,
    random,
    forbiddenMasks,
    targetCount: objectCountFromFacts(worldFacts),
  });
  for (const object of objectFootprints) {
    if (object.blocksMovement) {
      collisionRegions.push({
        sourceId: `${object.objectId}-collision`,
        polygon: boundsPolygon(object.footprint),
      });
    }
  }

  return {
    hasWater: true,
    entranceBounds,
    focalBounds: null,
    terrainRegions,
    walkableRegions,
    collisionRegions,
    objectFootprints,
    pathCenterline,
    waterCenterline,
    ecologicalZones: [
      {
        zoneId: `${conditionId}-western-natural-boundary-forest`,
        kind: "tropical_evergreen_forest",
        role: "western_natural_boundary",
      },
      {
        zoneId: `${conditionId}-central-seasonal-forest-mosaic`,
        kind: "seasonal_evergreen_and_semi_evergreen_forest",
        role: "mixed_relief_and_passage",
      },
      {
        zoneId: `${conditionId}-eastern-riparian-corridor`,
        kind: "freshwater_drainage_and_wetland",
        role: "north_to_south_hydrology",
      },
      {
        zoneId: `${conditionId}-low-hill-transition`,
        kind: "low_hill_and_valley_relief",
        role: "terrain_depth",
      },
    ],
    connectivityEvidence: {
      waterFlowAxis: "north_to_south",
      upstreamPortId: northWaterPort.edgePortId,
      downstreamPortId: southWaterPort.edgePortId,
      southPathPortId: southPathPort.edgePortId,
      westBoundaryStatus: "natural_boundary_no_active_path_port",
    },
  };
}

function buildBlueprint({
  conditionId,
  worldId,
  taskId,
  seedHex,
  worldFacts,
  worldFactRun,
  geometry,
}) {
  return {
    schemaVersion: "ai-assisted-training-world-fact-blueprint-v2",
    blueprintId: `training-world-facts-${conditionId}`,
    status: "naturalized_complete_map_world_facts_ready_rgb_missing",
    createdAtUtc,
    createdAtAsiaShanghai,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    generationContractVersion: "complete-map-scope-world-facts-v2",
    conditionLabel: conditionId,
    split: "unassigned_pre_rgb",
    uniqueWorldSeed: seedHex,
    uniqueLayoutVariant: "new_game_coordinate_geometry_from_aggregate_facts",
    sourceBlueprintReuse: false,
    sourceTransformReuse: false,
    sourceRgbRead: false,
    sourceImageGeometryRead: false,
    completeMapScopeRequired: true,
    sourceMode: "naturalized_earth_facts_plus_locked_connectivity",
    taskId,
    worldId,
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    earthParameterSnapshotId: worldFacts.worldFactSetId,
    earthParameterSnapshotPath: worldFactRun.worldFactsPath,
    factualReferenceId: "sakaerat-wang-nam-khiao-mvp-reference-v1",
    factualReferencePath: FACTUAL_REFERENCE_PATH,
    connectivityContractId: "natural-home-large-world-connectivity-v1",
    connectivityBlueprintId: CONNECTIVITY_BLUEPRINT_ID,
    connectivityBlueprintPath: CONNECTIVITY_BLUEPRINT_PATH,
    landscapeType:
      "mainland-southeast-asia-naturalized-lowland-valley-low-hill-mosaic",
    landscapeProfile: {
      referenceRole: worldFacts.identityBoundary.role,
      measuredReliefClass:
        worldFacts.measuredNaturalFacts.relief.derivedClass,
      measuredNaturalSystems: worldFacts.ecologyFacts.supportedNaturalSystems,
      copiedRealMapGeometry: false,
      copiedOsmGeometry: false,
    },
    environmentContext: {
      contractVersion: "world-visual-environment-context-v1",
      season: "wet_season",
      monsoonPhase: "active_monsoon",
      environmentState: "humid_post_rain_daylight",
      weather: "post_rain_clearing",
      lighting: "warm_humid_soft_daylight",
      groundMoisture: "moist",
      visibility: "clear_humid_air",
      wind: "light",
      standingWaterOutsideDefinedWaterBodies: false,
      habitatMoistureClass: "high",
      sourceSnapshotId: worldFacts.worldFactSetId,
      sourceRecordClassificationUsed: true,
    },
    canvas: {
      width: WIDTH,
      height: HEIGHT,
      frameScope: "complete_runtime_frame",
    },
    geometry,
    semanticRules: {
      waterFlow: "north_in_south_out_locked_large_world_connectivity",
      routeIntent:
        "south_boundary_natural_passage_without_preset_home_site_or_convergence_platform",
      siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
      focalAreaPolicy: "inactive_all_zero_compatibility_channel",
      camera: "top_down_slight_three_quarter_2d",
      style: "native_1024x768_high_resolution_pixel_game_map",
      geometryOrigin:
        "new_deidentified_game_coordinates_from_aggregate_measured_facts_and_locked_connectivity",
      forbidden: [
        "building",
        "character",
        "animal",
        "bridge",
        "text",
        "ui",
        "program_drawn_final_art",
        "preset_home_site",
        "activity_center",
        "construction_clearing",
        "route_convergence_platform",
        "mirrored_historical_layout",
        "rotated_historical_layout",
        "copied_real_map_geometry",
        "copied_osm_geometry",
      ],
    },
    outputContract: {
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
    automaticStorage: true,
  };
}

function buildDirector({
  conditionId,
  worldId,
  taskId,
  directorRunId,
  sourceFactIds,
  worldFacts,
  geometry,
}) {
  const ecologicalZoneIds = geometry.ecologicalZones.map(
    (entry) => entry.zoneId,
  );
  return {
    schemaVersion: "world-visual-director-output-v1",
    directorRunId,
    createdAt: createdAtUtc,
    createdAtAsiaShanghai,
    dictionaryVersionId: "mvp-natural-home-v0.3",
    worldId,
    generationContractVersion: "complete-map-scope-world-facts-v2",
    conditionLabel: conditionId,
    tick: 0,
    sourceFactIds,
    singleMapScopePlan: {
      activeGoal: "single_complete_map_visual",
      outputSize: { width: WIDTH, height: HEIGHT },
      localCropAllowed: false,
    },
    sceneIntent: {
      sceneIntentId: `natural-region-${conditionId}`,
      sceneType: "training_complete_natural_region_map",
      mainStory:
        "A complete de-identified mainland Southeast Asia tropical monsoon natural region derived from measured relief, ecology, soil, hydrology, and locked large-world connectivity before RGB creation.",
      primaryFocus: "complete_natural_region",
      mustShow: [
        "entrance",
        "main_path",
        "natural_boundary",
        "multiple_ecological_zones",
        "north_to_south_watercourse",
      ],
      mayShow: ["tree", "rock", "shrub", "grass_detail", "riparian_detail"],
      mustNotShow: [
        "player",
        "butler",
        "building",
        "animal",
        "debug_preview",
        "material_test_board",
        "preset_home_site",
        "activity_center",
        "construction_clearing",
        "route_convergence_platform",
      ],
    },
    compositionPlan: {
      readOrder: [
        "entrance",
        "main_path",
        "natural_boundary",
        "ecological_zones",
        "north_to_south_watercourse",
      ],
      focalHierarchy: [
        "complete_natural_region",
        "large_world_connections",
        "ecological_zones",
        "detail_clusters",
      ],
      layoutIntent:
        "complete_region_with_south_path_connection_north_to_south_water_and_west_natural_boundary_without_preset_site",
      clutterBudget: "controlled_with_irregular_quiet_natural_areas",
      cameraFit: "top_down_complete_map_readability",
    },
    terrainPlan: {
      baseTerrain: "grass",
      terrainKinds: [
        "grass",
        "water",
        "shoreline",
        "path_ground",
        "natural_boundary",
        "mud_patch",
        "tall_grass",
      ],
      terrainTransitions: [
        "grass_to_path",
        "grass_to_water",
        "shoreline_to_water",
        "object_to_ground",
      ],
      pathWearRules: [
        "soft_embedded_edge",
        "continuous_natural_passage",
        "no_center_platform",
      ],
      waterEdgeRules: [
        "continuous_natural_shoreline",
        "north_to_south_flow_readability",
      ],
      forbiddenTerrainArtifacts: [
        "random_noise_field",
        "gray_green_camouflage",
        "pasted_path_band",
        "hard_cut_shoreline",
        "square_center_clearing",
      ],
    },
    assetPlan: {
      allowedKinds: ["tree", "rock", "shrub", "grass_detail"],
      objectCount: geometry.objectFootprints.length,
    },
    motionPlan: {
      currentScope: "static_visual_milestone",
      futureRuntimeMotionReserved: true,
    },
    drawingProcessPlan: {
      structureBeforePixels: true,
      sourceImageGeometryRead: false,
      realMapGeometryRead: false,
      programDrawnFinalArtForbidden: true,
    },
    artDirectionPlan: {
      targetEntryId: "art-direction/professional-game-art-direction",
      playerFacingStandard: "formal_game_map_not_training_preview",
      forbiddenLooks: [
        "noise",
        "collage",
        "sticker",
        "wallpaper",
        "debug_preview",
      ],
      styleUnityTargets: [
        "camera",
        "palette",
        "scale",
        "lighting",
        "material_language",
      ],
    },
    materialRecipePlan: {
      requiredMaterials: [
        "humid_grass",
        "dirt_path",
        "freshwater",
        "shoreline_soil",
        "stone",
        "vegetation_detail",
      ],
    },
    singleMapEcologyPlan: {
      landscapeType:
        "mainland-southeast-asia-tropical-monsoon-lowland-valley-low-hill",
      moisture: "high",
      vegetationDensity: "high_with_readable_passage",
      snapshotId: worldFacts.worldFactSetId,
      season: "wet_season",
      environmentState: "humid_post_rain_daylight",
      groundMoisture: "moist",
      requiredFeatures: ecologicalZoneIds,
      optionalFeatures: [],
    },
    singleMapMaterialPlan: {
      palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
      season: "wet_season",
      environmentState: "humid_post_rain_daylight",
      weather: "post_rain_clearing",
      lighting: "warm_humid_soft_daylight",
      groundMoisture: "moist",
    },
    compositionRecipePlan: {
      readOrder: [
        "entrance",
        "main_path",
        "natural_boundary",
        "ecological_zones",
        "north_to_south_watercourse",
      ],
      focalHierarchy: [
        "complete_natural_region",
        "large_world_connections",
        "ecological_zones",
        "detail_clusters",
      ],
      layoutIntent:
        "new_game_coordinate_complete_region_from_current_world_facts",
      clutterBudget: "controlled_with_irregular_quiet_natural_areas",
      cameraFit: "top_down_complete_map_readability",
    },
    singleMapCompositionPlan: {
      entranceBounds: geometry.entranceBounds,
      routeIntent:
        "south_boundary_natural_passage_without_preset_home_site",
      siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
    },
    renderLayerRecipePlan: {
      orderedLayerRefs: [
        "base_terrain",
        "shoreline",
        "water",
        "path",
        "boundary",
        "footprints",
        "objects",
        "shadows",
        "detail",
        "polish",
      ],
      preserveRules: [
        "route_readability",
        "ecological_zone_readability",
        "object_contact",
        "terrain_transition",
      ],
      forbiddenLayerOutputs: [
        "debug",
        "fallback",
        "placeholder",
        "program_only_final_art",
      ],
    },
    qualityRubricPlan: {
      required: [
        "game_read",
        "map_grammar",
        "style_unity",
        "grounding",
        "polish",
      ],
      ownerReviewRequired: true,
    },
    singleMapAcceptancePlan: {
      passDefinition:
        "one_complete_professional_natural_region_map_visual",
      ownerReviewRequired: true,
    },
    fixPlanInput: {
      previousFailures: [],
      source: "naturalized_earth_reference_world_facts",
    },
    generationTaskDraft: {
      schemaVersion: "runtime-frame-generation-task-v1",
      taskId,
      outputSize: { width: WIDTH, height: HEIGHT },
      requiredParts: [
        "entrance",
        "main_path",
        "natural_boundary",
        "ecological_zones",
        "watercourse",
      ],
    },
    safety: {
      changesRuntimeWorldFacts: false,
      existingRgbBindingForbidden: true,
      formalCandidate: false,
    },
    autonomyContract: {
      siteSelectionPolicy: "runtime_butler_autonomy_only",
      presetHomeSite: false,
      presetActivityCenter: false,
      constructionClearing: false,
      focalAreaActive: false,
    },
    factualReference: {
      referenceId: "sakaerat-wang-nam-khiao-mvp-reference-v1",
      path: FACTUAL_REFERENCE_PATH,
      copiedRealMapGeometry: false,
      copiedOsmGeometry: false,
      externalImageUsed: false,
    },
  };
}

function buildVisualFactManifest({
  conditionId,
  worldId,
  taskId,
  sourceFactIds,
  worldFacts,
  geometry,
}) {
  return {
    schemaVersion: "world-visual-fact-manifest-v1",
    manifestId: `visual-facts-${taskId}`,
    worldId,
    tick: 0,
    dictionaryVersionId: "mvp-natural-home-v0.3",
    createdAt: createdAtUtc,
    createdAtAsiaShanghai,
    passed: true,
    status: "naturalized_complete_map_visual_facts_passed",
    includedFactIds: sourceFactIds,
    excludedFactIds: [],
    visualFacts: [
      {
        factId: `${conditionId}:entrance`,
        semanticType: "entrance",
        sourceType: "naturalized_world_fact_normalization",
        bounds: geometry.entranceBounds,
      },
      {
        factId: `${conditionId}:natural-boundary`,
        semanticType: "natural_boundary",
        sourceType: "locked_large_world_connectivity",
        bounds: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      },
      ...geometry.terrainRegions.map((entry) => ({
        factId: `${conditionId}:terrain:${entry.sourceId}`,
        semanticType: `terrain_${entry.kind}`,
        sourceType: "naturalized_world_fact_normalization",
        polygon: entry.polygon,
      })),
    ],
    forbiddenLeakIds: [],
    counts: {
      includedFacts: sourceFactIds.length,
      excludedFacts: 0,
    },
    worldSignals: {
      biomeType:
        "mainland-southeast-asia-tropical-monsoon-natural-mosaic",
      moistureLevel: "high",
      vegetationDensity: "high_with_readable_passage",
      measuredReliefClass:
        worldFacts.measuredNaturalFacts.relief.derivedClass,
      missingSignals: [],
    },
  };
}

function buildTask({
  conditionId,
  worldId,
  taskId,
  director,
  geometry,
  visualFacts,
  blueprintPath,
  directorPath,
  visualFactPath,
  worldFacts,
  worldFactRun,
}) {
  const task = {
    schemaVersion: "runtime-frame-generation-task-v1",
    taskId,
    status: "naturalized_complete_map_task_ready_rgb_authorization_required",
    generationContractVersion: "complete-map-scope-world-facts-v2",
    dictionaryVersionId: "mvp-natural-home-v0.3",
    worldId,
    ownerId: "project-owner",
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    earthParameterSnapshotId: worldFacts.worldFactSetId,
    outputSize: {
      width: WIDTH,
      height: HEIGHT,
      aspect: "4:3",
      frameScope: "complete_runtime_frame",
    },
    sourceBindings: {
      sourceMode: "naturalized_earth_facts_plus_locked_connectivity",
      trainingBlueprintPath: projectPath(blueprintPath),
      promptEvidencePath: null,
      naturalizedWorldFactsPath: worldFactRun.worldFactsPath,
      naturalizedWorldFactsSha256: sha256File(
        path.join(ROOT, worldFactRun.worldFactsPath),
      ),
      visualFactManifestId: visualFacts.manifestId,
      visualFactManifestPath: projectPath(visualFactPath),
      visualFactManifestSha256: visualFacts.manifestSha256,
      dictionaryPath: DICTIONARY_PATH,
      worldProfilePath: WORLD_PROFILE_PATH,
      earthParameterSnapshotPath: worldFactRun.worldFactsPath,
      connectivityBlueprintPath: CONNECTIVITY_BLUEPRINT_PATH,
      datasetPackagePath: null,
      datasetPackageId: null,
      runtimeFramePath: null,
      runtimeFrameId: null,
      structureId: `training-structure-${conditionId}`,
      factualReferencePath: FACTUAL_REFERENCE_PATH,
      directorOutputPath: projectPath(directorPath),
    },
    singleMapScope: {
      activeGoal: "single_complete_map_visual",
      forbiddenCurrentRequirements: ["player", "building", "animal"],
      allowedCurrentRequirements: [
        "map_structure",
        "terrain",
        "material",
        "ecology",
        "composition",
        "storage",
      ],
    },
    drawingProcess: {
      intentLock: true,
      spatialBlockoutSource:
        "new_game_coordinate_geometry_from_naturalized_world_facts",
      textureBeforeBlockoutForbidden: true,
      sourceImageGeometryRead: false,
      realMapGeometryRead: false,
      reviewPass: { machineReview: true, ownerReview: true },
    },
    inferenceGate: {
      status: "rgb_generation_not_authorized",
      canRunCompleteVisualInference: false,
      reasons: [
        "owner_rgb_authorization_missing",
        "rgb_missing",
        "machine_review_missing",
        "owner_review_missing",
      ],
      authorizationId: OWNER_AUTHORIZATION_REF,
      ownerApprovalAutomatic: false,
      gpuTrainingAuthorized: false,
    },
    bootstrapInferenceGate: {
      status: "historical_third_party_bootstrap_disabled",
      canRunBootstrapInference: false,
      canEnterWorld: false,
      canCountAsPositiveSample: false,
      independentTrainingEligible: false,
      requiresMachineReview: true,
      requiresOwnerReview: true,
    },
    visualStyle: {
      camera: "top_down_slight_three_quarter_2d",
      palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
      lighting: "single_soft_daylight_direction",
      materialDensity: "controlled_multi_scale_detail",
      grounding: "footprint_contact_shadow_and_transition_required",
    },
    forbiddenContent: [
      "player",
      "butler",
      "building",
      "construction",
      "npc",
      "animal",
      "debug_overlay",
      "local_material_test_board",
      "preset_home_site",
      "activity_center",
      "route_convergence_platform",
    ],
    spatialLayers: {
      terrainRegions: geometry.terrainRegions,
      walkableRegions: geometry.walkableRegions,
      collisionRegions: geometry.collisionRegions,
      objectFootprints: geometry.objectFootprints,
    },
    directorPlan: director,
    previousFailures: [],
  };
  return task;
}

function buildSourceFactIds(conditionId, geometry) {
  return [
    `${conditionId}:entrance`,
    `${conditionId}:natural-boundary`,
    ...geometry.terrainRegions.map(
      (entry) => `${conditionId}:terrain:${entry.sourceId}`,
    ),
  ];
}

function placeObjects({ conditionId, random, forbiddenMasks, targetCount }) {
  const objects = [];
  const kinds = ["tree", "tree", "tree", "rock", "shrub", "grass_detail"];
  let attempts = 0;
  while (objects.length < targetCount && attempts < targetCount * 120) {
    attempts += 1;
    const kind = kinds[Math.floor(random() * kinds.length)];
    const width =
      kind === "tree" ? randomInt(18, 34, random) : randomInt(10, 24, random);
    const height =
      kind === "tree" ? randomInt(18, 32, random) : randomInt(8, 22, random);
    const footprint = {
      x: randomInt(76, WIDTH - 190, random),
      y: randomInt(54, HEIGHT - 70, random),
      width,
      height,
    };
    if (
      forbiddenMasks.some((polygon) =>
        boundsTouchesPolygon(footprint, polygon),
      )
    ) {
      continue;
    }
    if (
      objects.some((entry) =>
        boundsOverlap(expandBounds(footprint, 12), entry.footprint),
      )
    ) {
      continue;
    }
    objects.push({
      objectId: `${conditionId}:object:${String(objects.length + 1).padStart(
        3,
        "0",
      )}`,
      kind,
      footprint,
      blocksMovement: ["tree", "rock"].includes(kind),
      source: "naturalized_ecology_density_and_relief_profile",
    });
  }
  assert(
    objects.length === targetCount,
    `unable to place required object footprints: ${objects.length}/${targetCount}`,
  );
  return objects;
}

function objectCountFromFacts(worldFacts) {
  const histogram =
    worldFacts.measuredNaturalFacts.landCoverAfterHumanRemoval.classHistogram;
  const treeRatio = Number(histogram["10"] ?? 0) / (WIDTH * HEIGHT);
  return Math.max(34, Math.min(52, Math.round(34 + treeRatio * 18)));
}

function terrain(sourceId, kind, polygon) {
  return { sourceId, kind, polygon };
}

function ribbonPolygon(points, halfWidth, width, height) {
  return ribbonPolygonVariable(
    points,
    points.map(() => halfWidth),
    width,
    height,
  );
}

function ribbonPolygonVariable(points, halfWidths, width, height) {
  const left = [];
  const right = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const halfWidth = halfWidths[index];
    left.push({
      x: clamp(Math.round(points[index].x + nx * halfWidth), 0, width),
      y: clamp(Math.round(points[index].y + ny * halfWidth), 0, height),
    });
    right.push({
      x: clamp(Math.round(points[index].x - nx * halfWidth), 0, width),
      y: clamp(Math.round(points[index].y - ny * halfWidth), 0, height),
    });
  }
  return [...left, ...right.reverse()];
}

function irregularEllipsePolygon(
  centerX,
  centerY,
  radiusX,
  radiusY,
  steps,
  random,
) {
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    const irregularity = 0.86 + random() * 0.25;
    points.push({
      x: clamp(
        Math.round(centerX + Math.cos(angle) * radiusX * irregularity),
        0,
        WIDTH,
      ),
      y: clamp(
        Math.round(centerY + Math.sin(angle) * radiusY * irregularity),
        0,
        HEIGHT,
      ),
    });
  }
  return points;
}

function rectanglePolygon(x, y, width, height) {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function boundsPolygon(bounds) {
  return rectanglePolygon(bounds.x, bounds.y, bounds.width, bounds.height);
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function boundsTouchesPolygon(bounds, polygon) {
  const rectangle = boundsPolygon(bounds);
  const rectanglePoints = [
    ...rectangle,
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
  ];
  if (rectanglePoints.some((point) => pointInPolygon(point, polygon))) {
    return true;
  }
  if (
    polygon.some(
      (point) =>
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height,
    )
  ) {
    return true;
  }
  for (let rectangleIndex = 0; rectangleIndex < rectangle.length; rectangleIndex += 1) {
    const rectangleStart = rectangle[rectangleIndex];
    const rectangleEnd = rectangle[(rectangleIndex + 1) % rectangle.length];
    for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
      const polygonStart = polygon[polygonIndex];
      const polygonEnd = polygon[(polygonIndex + 1) % polygon.length];
      if (
        lineSegmentsIntersect(
          rectangleStart,
          rectangleEnd,
          polygonStart,
          polygonEnd,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function lineSegmentsIntersect(a, b, c, d) {
  const orientation = (p, q, r) =>
    Math.sign(
      (q.y - p.y) * (r.x - q.x) -
        (q.x - p.x) * (r.y - q.y),
    );
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return first !== second && third !== fourth;
}

function boundsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function expandBounds(bounds, amount) {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  };
}

function jitter(base, amount, random) {
  return Math.round(base + (random() * 2 - 1) * amount);
}

function randomInt(minimum, maximum, random) {
  return Math.floor(minimum + random() * (maximum - minimum + 1));
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function updateRegionContract(manifest) {
  const contract = readJson(REGION_CONTRACT_PATH);
  contract.status =
    "complete_map_conditions_ready_rgb_authorization_required";
  contract.updatedAtUtc = createdAtUtc;
  contract.updatedAtAsiaShanghai = createdAtAsiaShanghai;
  contract.blockers = [];
  contract.measurementEvidence = {
    ...(contract.measurementEvidence ?? {}),
    completeMapConditionRunId: manifest.runId,
    completeMapConditionLatestPath: `${RUNTIME_ROOT}/latest.json`,
    worldDirectorOutputCreated: true,
    completeMap23ChannelsCreated: true,
    completeMapScopePassed: true,
    focalAreaNonZeroCount: manifest.focalAreaNonZeroCount,
    exactRealWorldGeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
  };
  contract.outputBoundary = {
    ...(contract.outputBoundary ?? {}),
    completeMap23ChannelsCreated: true,
    imageGenerationAuthorized: false,
    gpuTrainingAuthorized: false,
    formalCandidateEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  };
  writeJsonAtomic(REGION_CONTRACT_PATH, contract);
}

function indexRunFiles(directory, sourceRunId) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      indexRunFiles(absolutePath, sourceRunId);
    } else if (entry.isFile()) {
      indexFile(absolutePath, sourceRunId);
    }
  }
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

function canonicalSha256(value) {
  return sha256(Buffer.from(JSON.stringify(value)));
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
