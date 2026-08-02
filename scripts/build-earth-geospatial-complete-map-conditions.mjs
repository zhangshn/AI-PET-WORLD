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
import {
  buildAnonymousRouteNaturalnessProfile,
  buildNaturalAnonymousCenterline,
  buildNaturalRouteHalfWidths,
} from "./lib/anonymous-route-naturalness.mjs";
import {
  NATURAL_WATER_CENTERLINE_POINT_COUNT,
  auditAnonymousWaterCorridorShape,
  auditAnonymousWaterNaturalness,
  buildNaturalAnonymousWaterCenterline,
  buildNaturalWaterHalfWidths,
} from "./lib/anonymous-water-naturalness.mjs";
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
  MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";
import {
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
  buildMeasurementDerivedAnonymousAnabranch,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import {
  buildCompleteMapStructuralIdentities,
  buildIndependentTrainingRegionConnectivity,
  buildRealEarthRegionSourcePackage,
} from "./lib/real-earth-region-governance.mjs";

const ROOT = process.cwd();
const V7_SLOT_ID = valueFor("--v7-slot-id");
const V7_SLOT_CONTEXT = V7_SLOT_ID
  ? loadV7SlotContext(V7_SLOT_ID)
  : null;
assert(
  V7_SLOT_CONTEXT,
  "legacy fixed shared complete-map geometry was removed; a measurement-backed --v7-slot-id is required",
);
const V7_SLOT_COARSE_HYDROLOGY_PROFILE =
  V7_SLOT_CONTEXT &&
  landscapeRequiresVisibleWater(
    V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
  )
    ? buildMeasurementDerivedCoarseHydrologyProfile({
        assignment: V7_SLOT_CONTEXT.assignment,
        root: ROOT,
      })
    : null;
const AUTHORIZED_WATER_SEED_REVISION_SLOTS = new Set([
  "v7-capacity-slot-122",
  "v7-capacity-slot-123",
  "v7-capacity-slot-124",
  "v7-capacity-slot-125",
  "v7-capacity-slot-126",
  "v7-capacity-slot-127",
  "v7-capacity-slot-128",
  "v7-capacity-slot-129",
  "v7-capacity-slot-130",
  "v7-capacity-slot-131",
  "v7-capacity-slot-140",
  "v7-capacity-slot-141",
  "v7-capacity-slot-142",
  "v7-capacity-slot-143",
]);
const EXPECTED_V7_SLOT_SEED_REVISION =
  V7_SLOT_ID === "v7-capacity-slot-122"
    ? "owner-directed-v7-capacity-slot-122-water-naturalness-revision-8-20260727"
  : V7_SLOT_ID === "v7-capacity-slot-119"
    ? "owner-directed-v7-capacity-slot-119-route-naturalness-revision-1-20260727"
  : V7_SLOT_ID === "v7-capacity-slot-201"
    ? "owner-directed-v7-capacity-slot-201-full-world-route-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-169"
    ? "owner-directed-v7-capacity-slot-169-full-world-framework-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-205"
    ? "owner-directed-v7-capacity-slot-205-full-world-framework-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-185"
    ? "owner-directed-v7-capacity-slot-185-construction-grammar-novelty-revision-1-20260731"
  : V7_SLOT_ID === "v7-capacity-slot-190"
    ? "owner-directed-v7-capacity-slot-190-cross-modal-rgb-collapse-prevention-revision-6-20260802"
  : V7_SLOT_ID === "v7-capacity-slot-194"
    ? "owner-directed-v7-capacity-slot-194-cross-modal-rgb-collapse-prevention-revision-3-20260801"
    : V7_SLOT_ID === "v7-capacity-slot-123"
      ? null
    : V7_SLOT_ID && AUTHORIZED_WATER_SEED_REVISION_SLOTS.has(V7_SLOT_ID)
      ? `owner-directed-${V7_SLOT_ID}-seed-revision-1-20260727`
      : null;
const V7_SLOT_SEED_REVISION = valueFor("--v7-slot-seed-revision");
const V7_SLOT_COMPOSITION_REVISION = valueFor(
  "--v7-slot-composition-revision",
);
const THAILAND_REBUILD64_FULL_WORLD_DYNAMIC_READINESS_REVISION =
  "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-v3-20260731";
const THAILAND_REBUILD64_SEMANTIC_TOPOLOGY_REVISION =
  "owner-authorized-thailand-rebuild64-semantic-topology-diversity-v4-20260801";
const THAILAND_REBUILD64_FLOWING_WATER_CONNECTIVITY_REVISION =
  "owner-authorized-thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-v5-20260801";
const THAILAND_REBUILD64_CROSS_MODAL_RGB_COLLAPSE_PREVENTION_REVISION =
  "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801";
const EXPECTED_V7_SLOT_COMPOSITION_REVISIONS =
  /^v7-capacity-slot-(14[6-9]|1[5-9][0-9]|20[0-9])$/.test(
    V7_SLOT_ID ?? "",
  )
    ? [
        THAILAND_REBUILD64_FULL_WORLD_DYNAMIC_READINESS_REVISION,
        THAILAND_REBUILD64_SEMANTIC_TOPOLOGY_REVISION,
        THAILAND_REBUILD64_FLOWING_WATER_CONNECTIVITY_REVISION,
        THAILAND_REBUILD64_CROSS_MODAL_RGB_COLLAPSE_PREVENTION_REVISION,
      ]
    : [];
const V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID = valueFor(
  "--v7-slot-seed-preflight-authorization-id",
);
const AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID =
  "project-owner-authorized-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-repair-20260728";
const SLOT_123_PREFLIGHT_REVISION_PATTERN =
  /^owner-directed-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-micro-candidate-\d+-20260728$/;
const authorizedSlot123SeedPreflightCandidate =
  V7_SLOT_ID === "v7-capacity-slot-123" &&
  V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ===
    AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID &&
  SLOT_123_PREFLIGHT_REVISION_PATTERN.test(
    V7_SLOT_SEED_REVISION ?? "",
  );
const authorizedSlot194SemanticTopologyRevision =
  V7_SLOT_ID === "v7-capacity-slot-194" &&
  V7_SLOT_SEED_REVISION ===
    "owner-directed-v7-capacity-slot-194-semantic-topology-diversity-revision-2-20260801" &&
  fs.existsSync(
    path.resolve(
      ROOT,
      ".runtime/ai-painter/owner-action-requests/owner-authorized-thailand-rebuild64-semantic-topology-diversity-upgrade-20260801/request.json",
    ),
  );
if (V7_SLOT_SEED_REVISION) {
  assert(
    V7_SLOT_SEED_REVISION === EXPECTED_V7_SLOT_SEED_REVISION ||
      authorizedSlot123SeedPreflightCandidate ||
      authorizedSlot194SemanticTopologyRevision,
    "V7 slot seed revision is not authorized for this slot",
  );
}
if (V7_SLOT_COMPOSITION_REVISION) {
  assert(
    EXPECTED_V7_SLOT_COMPOSITION_REVISIONS.includes(
      V7_SLOT_COMPOSITION_REVISION,
    ),
    "V7 slot composition revision is not authorized for this slot",
  );
}
if (V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID) {
  assert(
    authorizedSlot123SeedPreflightCandidate,
    "V7 slot seed preflight authorization is invalid",
  );
}
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1";
const OWNER_AUTHORIZATION_REF =
  V7_SLOT_CONTEXT?.authorizationId ??
  "owner-approved-real-geography-naturalization-route-20260724";
const WORLD_PROFILE_ID =
  "mainland-southeast-asia-tropical-monsoon-natural-home-v1";
const CONNECTIVITY_BLUEPRINT_ID =
  "mainland-southeast-asia-earth-reference-natural-home-region-0001-v1";
const WIDTH = 1024;
const HEIGHT = 768;
const RUNTIME_ROOT =
  V7_SLOT_CONTEXT?.runtimeRoot ??
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
const SOURCE_REGISTRY_PATH =
  "data/world-samples/earth-geospatial/source-registry/earth-geospatial-source-registry-v1.json";
const DICTIONARY_PATH =
  "data/world-visual-data-dictionary/mvp-natural-home-v0.3.json";
const WORLD_PROFILE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json";
const FACTUAL_REFERENCE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json";
const ENGINEERED_REMOVAL_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-engineered-removal-runs",
  "latest.json",
);
const WATER_NATURALNESS_LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-water-naturalness-profile-runs",
  "latest.json",
);

const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId = V7_SLOT_CONTEXT
  ? `earth-geospatial-v7-slot-condition-${V7_SLOT_ID}-${createdAtUtc.replace(
      /[:.]/g,
      "-",
    )}`
  : `earth-geospatial-complete-map-conditions-${createdAtUtc.replace(
      /[:.]/g,
      "-",
    )}`;
const runRoot = path.join(ROOT, RUNTIME_ROOT, runId);
const taskRoot = path.join(runRoot, "complete-map-condition-task");
const commandName = V7_SLOT_CONTEXT
  ? [
      "npm run build:earth-geospatial-v7-mvp-slot-condition --",
      `--v7-slot-id=${V7_SLOT_ID}`,
      ...(V7_SLOT_SEED_REVISION
        ? [`--v7-slot-seed-revision=${V7_SLOT_SEED_REVISION}`]
        : []),
      ...(V7_SLOT_COMPOSITION_REVISION
        ? [
            `--v7-slot-composition-revision=${V7_SLOT_COMPOSITION_REVISION}`,
          ]
        : []),
      ...(V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID
        ? [
            `--v7-slot-seed-preflight-authorization-id=${V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID}`,
          ]
        : []),
    ].join(" ")
  : "npm run build:earth-geospatial-complete-map-conditions";

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
  command: commandName,
  runId,
});

try {
  const worldFactLatest = readJson(WORLD_FACT_LATEST_PATH);
  const worldFactRun = readJson(path.join(ROOT, worldFactLatest.runPath));
  const worldFacts = readJson(path.join(ROOT, worldFactRun.worldFactsPath));
  const regionContract = readJson(REGION_CONTRACT_PATH);
  const runtimeConnectivityBlueprint = V7_SLOT_CONTEXT
    ? null
    : readJson(path.join(ROOT, CONNECTIVITY_BLUEPRINT_PATH));

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
  if (runtimeConnectivityBlueprint) {
    assert(
      runtimeConnectivityBlueprint.blueprintId ===
        CONNECTIVITY_BLUEPRINT_ID,
      "connectivity blueprint mismatch",
    );
    assert(
      runtimeConnectivityBlueprint.worldProfileId === WORLD_PROFILE_ID,
      "connectivity world profile mismatch",
    );
  }

  const realEarthRegionSourcePackage = buildRealEarthRegionSourcePackage({
    root: ROOT,
    assignment: V7_SLOT_CONTEXT.assignment,
    regionContractPath: projectPath(REGION_CONTRACT_PATH),
    sourceRegistryPath: SOURCE_REGISTRY_PATH,
    factualReferencePath: FACTUAL_REFERENCE_PATH,
    worldProfilePath: WORLD_PROFILE_PATH,
    seasonSnapshotPath: V7_SLOT_CONTEXT.snapshotPath,
    measurementWindowPlanPath: V7_SLOT_CONTEXT.planPath,
  });
  const realEarthRegionSourcePackagePath = path.join(
    taskRoot,
    "real-earth-region-source-package.json",
  );
  writeJsonAtomic(
    realEarthRegionSourcePackagePath,
    realEarthRegionSourcePackage,
  );
  const realEarthRegionSourcePackageArtifactSha256 = sha256File(
    realEarthRegionSourcePackagePath,
  );

  const effectiveConnectivityBlueprint =
    buildIndependentTrainingRegionConnectivity({
      slotId: V7_SLOT_ID,
      assignment: V7_SLOT_CONTEXT.assignment,
      worldProfileId: WORLD_PROFILE_ID,
      sourcePackage: realEarthRegionSourcePackage,
      width: WIDTH,
      height: HEIGHT,
      hasWater: landscapeRequiresVisibleWater(
        V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
      ),
      anonymousCompositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION,
    });
  const effectiveConnectivityBlueprintPath = path.join(
    taskRoot,
    "regional-connectivity-instance.json",
  );
  writeJsonAtomic(
    effectiveConnectivityBlueprintPath,
    effectiveConnectivityBlueprint,
  );
  const effectiveConnectivityBlueprintArtifactSha256 = sha256File(
    effectiveConnectivityBlueprintPath,
  );

  const parentWorldFactsSha256 = sha256File(
    path.join(ROOT, worldFactRun.worldFactsPath),
  );
  const seedHex = sha256(
    Buffer.from(
      [
        parentWorldFactsSha256,
        realEarthRegionSourcePackage.packageSha256,
        effectiveConnectivityBlueprint.connectivityInstanceSha256,
        V7_SLOT_CONTEXT?.assignment?.fingerprints?.direct ?? "base-condition",
        V7_SLOT_ID ?? "base-condition",
        V7_SLOT_SEED_REVISION ?? "initial-seed-revision",
        V7_SLOT_COMPOSITION_REVISION ??
          "initial-composition-architecture",
        V7_SLOT_COARSE_HYDROLOGY_PROFILE
          ? COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY
          : "no-coarse-hydrology-profile",
        "deidentified-complete-map-game-coordinate-normalization-v2",
      ].join(":"),
    ),
  );
  const random = mulberry32(Number.parseInt(seedHex.slice(0, 8), 16));
  const conditionId = V7_SLOT_CONTEXT
    ? `earth-reference-v7-${V7_SLOT_ID}-${seedHex.slice(0, 12)}`
    : `earth-reference-naturalized-complete-map-${seedHex.slice(0, 12)}`;
  const worldId = `training-world:${conditionId}`;
  const taskId = `world-visual-task-${conditionId}-${createdAtUtc.replace(
    /[:.]/g,
    "-",
  )}`;
  const directorRunId = `world-director-${conditionId}-${createdAtUtc.replace(
    /[:.]/g,
    "-",
  )}`;
  const effectiveWorldFacts = V7_SLOT_CONTEXT
    ? buildV7SlotWorldFacts({
        conditionId,
        seedHex,
        parentWorldFacts: worldFacts,
        parentWorldFactRun: worldFactRun,
        parentWorldFactsSha256,
        slotContext: V7_SLOT_CONTEXT,
      })
    : worldFacts;
  const slotWorldFactsPath = V7_SLOT_CONTEXT
    ? path.join(taskRoot, "slot-world-facts.json")
    : path.join(ROOT, worldFactRun.worldFactsPath);
  if (V7_SLOT_CONTEXT) {
    writeJsonAtomic(slotWorldFactsPath, effectiveWorldFacts);
  }
  const effectiveWorldFactRun = V7_SLOT_CONTEXT
    ? {
        runId,
        worldFactsPath: projectPath(slotWorldFactsPath),
      }
    : worldFactRun;
  const worldFactsSha256 = sha256File(slotWorldFactsPath);
  const routeNaturalnessProfile = V7_SLOT_CONTEXT
    ? loadAnonymousRouteNaturalnessProfile()
    : null;
  const routeNaturalnessProfilePath = V7_SLOT_CONTEXT
    ? path.join(taskRoot, "route-naturalness-reference-profile.json")
    : null;
  if (routeNaturalnessProfilePath) {
    writeJsonAtomic(routeNaturalnessProfilePath, routeNaturalnessProfile);
  }
  const waterNaturalnessProfile =
    V7_SLOT_CONTEXT &&
    landscapeRequiresVisibleWater(
      V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
    )
      ? loadAnonymousWaterNaturalnessProfile()
      : null;
  const waterNaturalnessProfilePath = waterNaturalnessProfile
    ? path.join(taskRoot, "water-naturalness-reference-profile.json")
    : null;
  if (waterNaturalnessProfilePath) {
    writeJsonAtomic(waterNaturalnessProfilePath, waterNaturalnessProfile);
  }

  const geometry = buildV7SlotGameGeometry({
    conditionId,
    random,
    seedHex,
    worldFacts: effectiveWorldFacts,
    connectivityBlueprint: effectiveConnectivityBlueprint,
    slotContext: V7_SLOT_CONTEXT,
    routeNaturalnessProfile,
    waterNaturalnessProfile,
  });
  if (V7_SLOT_CONTEXT) {
    geometry.connectivityCoordinateProjection =
      structuredClone(
        effectiveConnectivityBlueprint
          .anonymousTrainingCoordinateProjection,
      );
    geometry.routeNaturalnessReference = {
      profileId: routeNaturalnessProfile.profileId,
      profilePath: projectPath(routeNaturalnessProfilePath),
      profileSha256: sha256File(routeNaturalnessProfilePath),
      aggregateStatisticsOnly: true,
      exactOsmGeometryCarriedForward: false,
    };
    if (waterNaturalnessProfile) {
      geometry.waterNaturalnessReference = {
        profileId: waterNaturalnessProfile.profileId,
        profilePath: projectPath(waterNaturalnessProfilePath),
        profileSha256: sha256File(waterNaturalnessProfilePath),
        aggregateStatisticsOnly: true,
        exactOsmGeometryCarriedForward: false,
      };
    }
    geometry.geometryNoveltyAudit = auditV7SlotGeometryNovelty({
      geometry,
      slotContext: V7_SLOT_CONTEXT,
    });
  }
  const structuralIdentities = buildCompleteMapStructuralIdentities({
    connectivity: effectiveConnectivityBlueprint,
    geometry,
  });
  const sourceFactIds = buildSourceFactIds(conditionId, geometry);
  const blueprint = buildBlueprint({
    conditionId,
    worldId,
    taskId,
    seedHex,
    worldFacts: effectiveWorldFacts,
    worldFactRun: effectiveWorldFactRun,
    geometry,
    connectivityBlueprint: effectiveConnectivityBlueprint,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    realEarthRegionSourcePackage,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    structuralIdentities,
  });
  applyV7SlotBlueprintContext(blueprint, V7_SLOT_CONTEXT);
  blueprint.blueprintSha256 = canonicalSha256(blueprint);
  const blueprintPath = path.join(taskRoot, "world-fact-blueprint.json");
  writeJsonAtomic(blueprintPath, blueprint);

  const director = buildDirector({
    conditionId,
    worldId,
    taskId,
    directorRunId,
    sourceFactIds,
    worldFacts: effectiveWorldFacts,
    geometry,
  });
  applyV7SlotDirectorContext(director, V7_SLOT_CONTEXT, geometry);
  director.directorSha256 = canonicalSha256(director);
  const directorPath = path.join(taskRoot, "director-output.json");
  writeJsonAtomic(directorPath, director);

  const visualFacts = buildVisualFactManifest({
    conditionId,
    worldId,
    taskId,
    sourceFactIds,
    worldFacts: effectiveWorldFacts,
    geometry,
  });
  applyV7SlotVisualFactContext(visualFacts, V7_SLOT_CONTEXT);
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
    worldFacts: effectiveWorldFacts,
    worldFactRun: effectiveWorldFactRun,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    realEarthRegionSourcePackage,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
  });
  applyV7SlotTaskContext(task, V7_SLOT_CONTEXT);
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
    sourceMode: V7_SLOT_CONTEXT
      ? "bounded_real_measurement_window_plus_independent_region_source_and_connectivity"
      : "naturalized_earth_facts_plus_locked_connectivity",
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    realEarthRegionSourcePackageArtifactSha256,
    connectivityBlueprintId:
      effectiveConnectivityBlueprint.blueprintId,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    connectivityBlueprintSha256:
      effectiveConnectivityBlueprint.connectivityInstanceSha256,
    connectivityBlueprintArtifactSha256:
      effectiveConnectivityBlueprintArtifactSha256,
    structuralIdentities,
    v7SlotId: V7_SLOT_ID,
    split: V7_SLOT_CONTEXT?.assignment?.split ?? "unassigned_pre_rgb",
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
    connectivityBlueprint: effectiveConnectivityBlueprint,
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
    sourceWorldFactRunId: effectiveWorldFactRun.runId,
    sourceWorldFactsPath: effectiveWorldFactRun.worldFactsPath,
    sourceWorldFactsSha256: worldFactsSha256,
    parentWorldFactRunId: V7_SLOT_CONTEXT ? worldFactRun.runId : null,
    parentWorldFactsPath: V7_SLOT_CONTEXT
      ? worldFactRun.worldFactsPath
      : null,
    parentWorldFactsSha256: V7_SLOT_CONTEXT
      ? parentWorldFactsSha256
      : null,
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    realEarthRegionSourcePackageArtifactSha256,
    connectivityBlueprintId:
      effectiveConnectivityBlueprint.blueprintId,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    connectivityBlueprintSha256:
      effectiveConnectivityBlueprint.connectivityInstanceSha256,
    connectivityBlueprintArtifactSha256:
      effectiveConnectivityBlueprintArtifactSha256,
    concreteRegion0001InstanceRead: false,
    structuralIdentities,
    normalizationAlgorithm: {
      id: "deidentified-complete-map-game-coordinate-normalization-v2",
      deterministicSeedSha256: seedHex,
      seedRevision: V7_SLOT_SEED_REVISION ?? null,
      compositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION ?? null,
      seedPreflightAuthorizationId:
        V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
      consumesAggregateMeasuredFactsOnly: true,
      copiesRealMapGeometry: false,
      copiesOsmGeometry: false,
      readsHistoricalRgb: false,
      usesHistoricalLayout: false,
      createsNewGameCoordinateGeometry: true,
    },
    routeNaturalnessReference: V7_SLOT_CONTEXT
      ? {
          profileId: routeNaturalnessProfile.profileId,
          profilePath: projectPath(routeNaturalnessProfilePath),
          profileSha256: sha256File(routeNaturalnessProfilePath),
          publicSourceProvider:
            routeNaturalnessProfile.source.provider,
          publicSourceLicense:
            routeNaturalnessProfile.source.license,
          aggregateStatisticsOnly: true,
          exactOsmGeometryCarriedForward: false,
          coordinatesPersistedInProfile: false,
        }
      : null,
    waterNaturalnessReference: waterNaturalnessProfile
      ? {
          profileId: waterNaturalnessProfile.profileId,
          profilePath: projectPath(waterNaturalnessProfilePath),
          profileSha256: sha256File(waterNaturalnessProfilePath),
          publicSourceProvider:
            waterNaturalnessProfile.source.provider,
          publicSourceLicense:
            waterNaturalnessProfile.source.license,
          aggregateStatisticsOnly: true,
          exactOsmGeometryCarriedForward: false,
          coordinatesPersistedInProfile: false,
          osmElementIdsPersistedInProfile: false,
        }
      : null,
    v7SlotBinding: V7_SLOT_CONTEXT
      ? {
          slotId: V7_SLOT_ID,
          split: V7_SLOT_CONTEXT.assignment.split,
          regionalLandscapeType:
            V7_SLOT_CONTEXT.assignment.regionalLandscapeType,
          monsoonSeason: V7_SLOT_CONTEXT.assignment.monsoonSeason,
          measurementWindowPlanRunId: V7_SLOT_CONTEXT.planRunId,
          measurementWindowPlanPath: V7_SLOT_CONTEXT.planPath,
          measurementWindowPlanSha256: V7_SLOT_CONTEXT.planSha256,
          candidateId: V7_SLOT_CONTEXT.assignment.candidateId,
          measurementFingerprint:
            V7_SLOT_CONTEXT.assignment.fingerprints.direct,
          anonymousGameCoordinateSeedRevision:
            V7_SLOT_SEED_REVISION ?? null,
          anonymousCompositionArchitectureRevision:
            V7_SLOT_COMPOSITION_REVISION ?? null,
          anonymousGameCoordinateSeedPreflightAuthorizationId:
            V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
          exactMeasurementGeometryCarriedForward: false,
          sourcePixelWindowCarriedIntoGameGeometry: false,
        }
      : null,
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
    worldFactRunId: effectiveWorldFactRun.runId,
    worldFactsPath: effectiveWorldFactRun.worldFactsPath,
    worldFactsSha256,
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath: projectPath(
      realEarthRegionSourcePackagePath,
    ),
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    realEarthRegionSourcePackageArtifactSha256,
    connectivityBlueprintId:
      effectiveConnectivityBlueprint.blueprintId,
    connectivityBlueprintPath: projectPath(
      effectiveConnectivityBlueprintPath,
    ),
    connectivityBlueprintSha256:
      effectiveConnectivityBlueprint.connectivityInstanceSha256,
    connectivityBlueprintArtifactSha256:
      effectiveConnectivityBlueprintArtifactSha256,
    structuralIdentities,
    v7SlotId: V7_SLOT_ID,
    split: V7_SLOT_CONTEXT?.assignment?.split ?? null,
    regionalLandscapeType:
      V7_SLOT_CONTEXT?.assignment?.regionalLandscapeType ?? null,
    monsoonSeason: V7_SLOT_CONTEXT?.assignment?.monsoonSeason ?? null,
    anonymousGameCoordinateSeedRevision:
      V7_SLOT_SEED_REVISION ?? null,
    anonymousCompositionArchitectureRevision:
      V7_SLOT_COMPOSITION_REVISION ?? null,
    anonymousGameCoordinateSeedPreflightAuthorizationId:
      V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
    routeNaturalnessProfilePath: V7_SLOT_CONTEXT
      ? projectPath(routeNaturalnessProfilePath)
      : null,
    routeNaturalnessProfileSha256: V7_SLOT_CONTEXT
      ? sha256File(routeNaturalnessProfilePath)
      : null,
    routeNaturalnessAudit:
      geometry.routeNaturalnessAudit ?? null,
    routeWaterAvoidanceAudit:
      geometry.routeWaterAvoidanceAudit ?? null,
    waterNaturalnessProfilePath: waterNaturalnessProfilePath
      ? projectPath(waterNaturalnessProfilePath)
      : null,
    waterNaturalnessProfileSha256: waterNaturalnessProfilePath
      ? sha256File(waterNaturalnessProfilePath)
      : null,
    waterNaturalnessAudit:
      geometry.waterNaturalnessAudit ?? null,
    waterCorridorShapeAudit:
      geometry.waterCorridorShapeAudit ?? null,
    internalHydrologyProfile:
      geometry.internalHydrologyProfile ?? null,
    internalHydrologyAudit:
      geometry.internalHydrologyAudit ?? null,
    lateralContinuationAudit:
      geometry.lateralContinuationAudit ?? null,
    coarseHydrologyMainChannelProfile:
      geometry.coarseHydrologyMainChannelProfile ?? null,
    mainChannelSelection:
      geometry.mainChannelSelection ?? null,
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

  if (!V7_SLOT_CONTEXT) {
    updateRegionContract(runManifest);
  }
  const { runPath } = writeImmutableProgramRun({
    root: RUNTIME_ROOT,
    runId,
    fileName: "complete-map-condition-run.json",
    record: runManifest,
    latest: {
      contractId: CONTRACT_ID,
      conditionId,
      v7SlotId: V7_SLOT_ID,
      split: V7_SLOT_CONTEXT?.assignment?.split ?? null,
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
    command: commandName,
    runId,
    evidencePath: runPath,
  });

  console.log(
    JSON.stringify(
      {
        runId,
        status: runManifest.status,
        conditionId,
        v7SlotId: V7_SLOT_ID,
        split: V7_SLOT_CONTEXT?.assignment?.split ?? null,
        regionalLandscapeType:
          V7_SLOT_CONTEXT?.assignment?.regionalLandscapeType ?? null,
        monsoonSeason: V7_SLOT_CONTEXT?.assignment?.monsoonSeason ?? null,
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
    v7SlotId: V7_SLOT_ID,
    anonymousGameCoordinateSeedRevision:
      V7_SLOT_SEED_REVISION ?? null,
    anonymousCompositionArchitectureRevision:
      V7_SLOT_COMPOSITION_REVISION ?? null,
    anonymousGameCoordinateSeedPreflightAuthorizationId:
      V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
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
    command: commandName,
    runId,
    evidencePath: projectPath(failurePath),
  });
  throw error;
}

function buildV7SlotWorldFacts({
  conditionId,
  seedHex,
  parentWorldFacts,
  parentWorldFactRun,
  parentWorldFactsSha256,
  slotContext,
}) {
  const assignment = slotContext.assignment;
  const metrics = assignment.metrics;
  const totalPixels = WIDTH * HEIGHT;
  const treeRatio = Number(
    metrics.reconstructedLandCoverRatio?.treeCover ?? 0,
  );
  const shrubRatio = Number(
    metrics.reconstructedLandCoverRatio?.shrubland ?? 0,
  );
  const grassRatio = Number(
    metrics.reconstructedLandCoverRatio?.grassland ?? 0,
  );
  const bareRatio = Number(
    metrics.reconstructedLandCoverRatio?.bareOrSparse ?? 0,
  );
  const meanElevation = Number(metrics.elevationMetres?.mean ?? 0);
  const reliefClass =
    meanElevation < 350
      ? "lowland"
      : meanElevation < 520
        ? "river_valley_to_foothill"
        : meanElevation < 700
          ? "foothill"
          : "low_mountain";
  const targetSystem = landscapeTypeToEcosystem(
    assignment.regionalLandscapeType,
  );

  return {
    ...structuredClone(parentWorldFacts),
    schemaVersion: "earth-reference-v7-slot-world-facts-v1",
    worldFactSetId: `world-facts-${conditionId}`,
    status: "v7_slot_world_facts_compiled_conditions_pending",
    createdAtUtc,
    createdAtAsiaShanghai,
    ownerAuthorizationRef: slotContext.authorizationId,
    parentWorldFacts: {
      runId: parentWorldFactRun.runId,
      path: parentWorldFactRun.worldFactsPath,
      sha256: parentWorldFactsSha256,
    },
    v7SlotBinding: {
      slotId: V7_SLOT_ID,
      split: assignment.split,
      regionalLandscapeType: assignment.regionalLandscapeType,
      monsoonSeason: assignment.monsoonSeason,
      requiredEntranceDirection:
        assignment.requiredEntranceDirection,
      coverageRole: assignment.coverageRole,
      measurementWindowPlanRunId: slotContext.planRunId,
      measurementWindowPlanPath: slotContext.planPath,
      measurementWindowPlanSha256: slotContext.planSha256,
      candidateId: assignment.candidateId,
      measurementBounds: assignment.measurementBounds,
      sourcePixelWindow: assignment.sourcePixelWindow,
      measurementFingerprint: assignment.fingerprints.direct,
      anonymousGameCoordinateSeedRevision:
        V7_SLOT_SEED_REVISION ?? null,
      anonymousCompositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION ?? null,
      anonymousGameCoordinateSeedPreflightAuthorizationId:
        V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
      transformCanonicalFingerprint:
        assignment.fingerprints.transformCanonical,
      exactMeasurementGeometryCarriedForward: false,
      sourcePixelWindowCarriedIntoGameGeometry: false,
      targetEcologyIsDirectlyClaimedByWindowSelection: false,
      additionalEvidenceRequirements:
        assignment.additionalEvidenceRequirements,
    },
    measuredNaturalFacts: {
      ...structuredClone(parentWorldFacts.measuredNaturalFacts),
      relief: {
        minimumMetres: metrics.elevationMetres.minimum,
        maximumMetres: metrics.elevationMetres.maximum,
        meanMetres: metrics.elevationMetres.mean,
        relativeElevation: metrics.relativeElevation,
        relativeRelief: metrics.relativeRelief,
        normalizedSlope: metrics.normalizedSlope,
        derivedClass: reliefClass,
        derivation:
          "aggregate_measurement_window_statistics_without_real_geometry_copy",
      },
      drainage: {
        likelihoodRatio: metrics.drainageLikelihoodRatio,
        role:
          "aggregate_support_only_not_a_mandatory_visible_water_geometry",
      },
      landCoverAfterHumanRemoval: {
        classHistogram: {
          "10": Math.round(totalPixels * treeRatio),
          "20": Math.round(totalPixels * shrubRatio),
          "30": Math.round(totalPixels * grassRatio),
          "60": Math.round(totalPixels * bareRatio),
        },
        classRatio: {
          treeCover: treeRatio,
          shrubland: shrubRatio,
          grassland: grassRatio,
          bareOrSparse: bareRatio,
        },
        humanRemovalRatio: metrics.humanRemovalRatio,
        exactRasterCarriedForward: false,
      },
    },
    ecologyFacts: {
      ...structuredClone(parentWorldFacts.ecologyFacts),
      targetRegionalLandscapeType: assignment.regionalLandscapeType,
      supportedNaturalSystems: [
        targetSystem,
        ...new Set(
          slotContext.factualReference.earthFacts?.ecosystems ?? [],
        ),
      ].filter(Boolean),
      evidence: {
        regionalProfileId: slotContext.worldProfile.worldProfileId,
        regionalProfilePath: WORLD_PROFILE_PATH,
        factualReferenceId: slotContext.factualReference.referenceId,
        factualReferencePath: FACTUAL_REFERENCE_PATH,
        seasonSnapshotId: slotContext.snapshot.snapshotId,
        seasonSnapshotPath: slotContext.snapshotPath,
        externalImagesUsed: false,
      },
    },
    environmentContext: structuredClone(slotContext.snapshot.environment),
    identityBoundary: {
      ...structuredClone(parentWorldFacts.identityBoundary),
      exactRealWorldGeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
      exactMeasurementWindowGeometryCarriedForward: false,
      finalGameCoordinateGeometryCreated: true,
      deterministicAnonymousGeometrySeedSha256: seedHex,
    },
    autonomyFacts: {
      ...structuredClone(parentWorldFacts.autonomyFacts),
      presetHomeSite: false,
      presetActivityCenter: false,
      presetConstructionClearing: false,
      focalAreaActive: false,
    },
    outputBoundary: {
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
      rgbCreated: false,
      formalCandidateEligible: false,
      runtimeFrameEligible: false,
      canEnterWorld: false,
    },
  };
}

function loadAnonymousRouteNaturalnessProfile() {
  const latest = readJson(ENGINEERED_REMOVAL_LATEST_PATH);
  const manifestPath = path.join(ROOT, latest.runPath);
  const manifest = readJson(manifestPath);
  assert(
    manifest.status === "engineered_feature_removal_evidence_compiled",
    "engineered-removal evidence is not ready for route naturalness aggregation",
  );
  assert(
    manifest.source?.provider === "OpenStreetMap contributors" &&
      manifest.source?.license === "Open Database License (ODbL) 1.0",
    "public route source identity or license is invalid",
  );
  const rawResponsePath = path.join(ROOT, manifest.source.rawResponsePath);
  assert(
    sha256File(rawResponsePath) === manifest.source.rawResponseSha256,
    "public route source hash mismatch",
  );
  const rawOsm = readJson(rawResponsePath);
  const profile = buildAnonymousRouteNaturalnessProfile({
    rawOsm,
    createdAtUtc,
    createdAtAsiaShanghai,
    source: {
      profileId:
        "sakaerat-wang-nam-khiao-anonymous-route-naturalness-v1",
      sourceId: manifest.source.sourceId,
      provider: manifest.source.provider,
      product: manifest.source.product,
      license: manifest.source.license,
      licenseUrl: manifest.source.licenseUrl,
      attribution: manifest.source.attribution,
      acquiredAtUtc: manifest.source.acquiredAtUtc,
      acquiredAtAsiaShanghai: manifest.source.acquiredAtAsiaShanghai,
      rawResponsePath: manifest.source.rawResponsePath,
      rawResponseSha256: manifest.source.rawResponseSha256,
      engineeredRemovalManifestPath: latest.runPath,
      engineeredRemovalManifestSha256: sha256File(manifestPath),
      ownerAuthorizationRefs: [
        manifest.ownerAuthorizationRef,
        "project-owner-command-2026-07-27-slot-119-rejected-route-too-rigid",
        "project-owner-authorization-2026-07-27-slot-119-anonymous-route-naturalness-repair",
      ],
    },
  });
  profile.profileSha256 = canonicalSha256(profile);
  return profile;
}

function loadAnonymousWaterNaturalnessProfile() {
  const latest = readJson(WATER_NATURALNESS_LATEST_PATH);
  const manifestPath = path.join(ROOT, latest.runPath);
  const manifest = readJson(manifestPath);
  assert(
    manifest.status ===
      "aggregate_public_water_naturalness_profile_ready",
    "public water naturalness profile run is not ready",
  );
  assert(
    manifest.source?.provider === "OpenStreetMap contributors" &&
      manifest.source?.license === "Open Database License (ODbL) 1.0",
    "public water source identity or license is invalid",
  );
  assert(
    sha256File(path.join(ROOT, manifest.profilePath)) ===
      manifest.profileSha256 &&
      latest.profilePath === manifest.profilePath &&
      latest.profileSha256 === manifest.profileSha256,
    "public water naturalness profile hash mismatch",
  );
  assert(
    sha256File(path.join(ROOT, manifest.rawResponsePath)) ===
      manifest.rawResponseSha256,
    "public water source response hash mismatch",
  );
  const profile = readJson(path.join(ROOT, manifest.profilePath));
  assert(
    profile.status ===
      "aggregate_public_water_naturalness_profile_ready" &&
      profile.selection?.measurableWayCount >=
        profile.selection?.minimumSourceWayCount &&
      profile.source?.exactGeometryCopied === false &&
      profile.source?.coordinatesPersistedInProfile === false &&
      profile.source?.osmElementIdsPersistedInProfile === false &&
      profile.source?.perFeatureMetricsPersistedInProfile === false &&
      profile.identityBoundary?.exactOsmGeometryCarriedForward === false &&
      profile.identityBoundary?.finalGameCoordinatesRemainAnonymous === true,
    "public water profile crossed the aggregate-only identity boundary",
  );
  const conditionReferenceProfile = structuredClone(profile);
  delete conditionReferenceProfile.profileSha256;
  delete conditionReferenceProfile.source.regionalAggregateBounds;
  delete conditionReferenceProfile.source.observationBounds;
  conditionReferenceProfile.source.acquisitionProfilePath =
    manifest.profilePath;
  conditionReferenceProfile.source.acquisitionProfileSha256 =
    manifest.profileSha256;
  conditionReferenceProfile.source.coordinatesPersistedInProfile = false;
  return conditionReferenceProfile;
}

function buildV7SlotGameGeometry({
  conditionId,
  random,
  seedHex,
  worldFacts,
  connectivityBlueprint,
  slotContext,
  routeNaturalnessProfile,
  waterNaturalnessProfile,
}) {
  const assignment = slotContext.assignment;
  const hasWater = landscapeRequiresVisibleWater(
    assignment.regionalLandscapeType,
  );
  const layoutProfile =
    buildMeasurementDrivenAnonymousLayoutProfile({
      assignment,
      hasWater,
      coarseHydrologyProfile:
        V7_SLOT_COARSE_HYDROLOGY_PROFILE,
      routeSearchExpansionRevision:
        [
          THAILAND_REBUILD64_SEMANTIC_TOPOLOGY_REVISION,
          THAILAND_REBUILD64_FLOWING_WATER_CONNECTIVITY_REVISION,
          THAILAND_REBUILD64_CROSS_MODAL_RGB_COLLAPSE_PREVENTION_REVISION,
        ].includes(V7_SLOT_COMPOSITION_REVISION)
          ? V7_SLOT_COMPOSITION_REVISION
          : null,
    });
  const topology = layoutProfile.routeTopology;
  let waterGeometry = null;
  let route = null;
  let pathPolygon = null;
  if (
    hasWater &&
    layoutProfile.coarseHydrologyMainChannelProfile
  ) {
    waterGeometry = buildAnonymousWaterGeometry({
      random,
      routePolygon: null,
      waterNaturalnessProfile,
      connectivityBlueprint,
      broadRiverControlFractions:
        layoutProfile.waterControlFractions,
      internalHydrologyProfile:
        layoutProfile.internalHydrologyProfile,
      coarseHydrologyProfile:
        layoutProfile.coarseHydrologyMainChannelProfile,
    });
    route = buildAnonymousRouteAvoidingWater({
      topology,
      random,
      routeNaturalnessProfile,
      layoutProfile,
      waterPolygons: waterGeometry.waterPolygons,
      connectivityBlueprint,
    });
    pathPolygon = route.pathPolygon;
  } else {
    route = buildAnonymousRoute(
      topology,
      random,
      routeNaturalnessProfile,
      layoutProfile,
      connectivityBlueprint,
    );
    pathPolygon = ribbonPolygonVariable(
      route.points,
      buildNaturalRouteHalfWidths(route.points.length, random),
      WIDTH,
      HEIGHT,
    );
  }
  const pathCenterline = route.points;
  const entranceBounds = route.entranceBounds;
  const baseCompositionArchitecture = V7_SLOT_COMPOSITION_REVISION
    ? V7_SLOT_ID === "v7-capacity-slot-198"
      ? buildMeasurementDrivenGrasslandForestCompositionArchitecture({
          assignment,
          random,
        })
      : buildMeasurementDrivenIndependentCompositionArchitecture({
          assignment,
          random,
        })
    : null;
  const compositionArchitecture = baseCompositionArchitecture
    ? applyFullWorldDynamicReadinessToComposition({
        architecture: baseCompositionArchitecture,
        assignment,
        connectivityBlueprint,
      })
    : null;
  const waterBoundaryEdges = waterGeometry?.usedEdges ?? [];
  const usedBoundaryEdges = [
    ...new Set([...route.usedEdges, ...waterBoundaryEdges]),
  ];
  const naturalBoundaryCandidates = compositionArchitecture
    ? buildMosaicNaturalBoundaries(usedBoundaryEdges, random)
    : buildAnonymousNaturalBoundaries(usedBoundaryEdges, random);
  const naturalBoundaryPolygons = compositionArchitecture
    ? naturalBoundaryCandidates.filter(
        (polygon) => !polygonsOverlap(pathPolygon, polygon),
      )
    : naturalBoundaryCandidates;
  assert(
    naturalBoundaryPolygons.length > 0,
    "measurement-driven composition has no route-safe natural boundary polygon",
  );
  const tallGrassRegions = compositionArchitecture?.tallGrassRegions ?? [
    irregularEllipsePolygon(
      randomInt(210, 390, random),
      randomInt(150, 310, random),
      randomInt(92, 142, random),
      randomInt(46, 78, random),
      18,
      random,
    ),
    irregularEllipsePolygon(
      randomInt(570, 790, random),
      randomInt(420, 610, random),
      randomInt(104, 158, random),
      randomInt(52, 86, random),
      18,
      random,
    ),
    irregularEllipsePolygon(
      randomInt(360, 650, random),
      randomInt(300, 500, random),
      randomInt(72, 118, random),
      randomInt(38, 68, random),
      16,
      random,
    ),
  ];
  const mudRegions = compositionArchitecture?.mudRegions ?? [
    irregularEllipsePolygon(
      randomInt(180, 820, random),
      randomInt(150, 620, random),
      randomInt(46, 74, random),
      randomInt(22, 38, random),
      16,
      random,
    ),
  ];
  if (hasWater && !waterGeometry) {
    waterGeometry = buildAnonymousWaterGeometry({
          random,
          routePolygon: pathPolygon,
          waterNaturalnessProfile,
          connectivityBlueprint,
          broadRiverControlFractions:
            layoutProfile.waterControlFractions,
          internalHydrologyProfile:
            layoutProfile.internalHydrologyProfile,
          coarseHydrologyProfile:
            layoutProfile.coarseHydrologyMainChannelProfile,
        });
  }
  const baseGrass = rectanglePolygon(0, 0, WIDTH, HEIGHT);
  const terrainRegions = [
    terrain(`${conditionId}-grass`, "grass", baseGrass),
    ...(waterGeometry
      ? [
          ...waterGeometry.waterPolygons.map((polygon, index) =>
            terrain(
              `${conditionId}-water-${index + 1}`,
              "water",
              polygon,
            ),
          ),
          ...waterGeometry.shorelinePolygons.map((polygon, index) =>
            terrain(
              `${conditionId}-shoreline-${index + 1}`,
              "shoreline",
              polygon,
            ),
          ),
        ]
      : []),
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
    ...(waterGeometry
      ? waterGeometry.waterPolygons.map((polygon, index) => ({
          sourceId: `${conditionId}-water-collision-${index + 1}`,
          polygon,
        }))
      : []),
    ...naturalBoundaryPolygons.map((polygon, index) => ({
      sourceId: `${conditionId}-boundary-collision-${index + 1}`,
      polygon,
    })),
  ];
  const forbiddenMasks = [
    pathPolygon,
    ...naturalBoundaryPolygons,
    ...(waterGeometry ? waterGeometry.waterPolygons : []),
  ];
  const objectFootprints = compositionArchitecture
    ? placeObjectsByCompositionArchitecture({
        conditionId,
        random,
        forbiddenMasks,
        targetCount: objectCountFromFacts(worldFacts),
        architecture: compositionArchitecture,
      })
    : placeObjects({
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

  const currentPorts = (connectivityBlueprint.edgePorts ?? []).filter(
    (entry) => entry.regionId === connectivityBlueprint.currentRegion.regionId,
  );
  const pathPortIds = currentPorts
    .filter((entry) => entry.kind === "path")
    .map((entry) => entry.edgePortId);
  return {
    hasWater,
    entranceBounds,
    focalBounds: null,
    terrainRegions,
    walkableRegions,
    collisionRegions,
    objectFootprints,
    pathCenterline,
    waterCenterline: waterGeometry?.centerline ?? [],
    waterHalfWidths: waterGeometry?.waterHalfWidths ?? [],
    waterBranchCenterlines:
      waterGeometry?.branchCenterlines ?? [],
    waterBranchHalfWidths:
      waterGeometry?.branchHalfWidths ?? [],
    waterConnectivityPorts:
      waterGeometry?.connectivityPorts ?? null,
    routeTopology: topology,
    routeNaturalnessAudit: route.naturalnessAudit,
    routeWaterAvoidanceAudit:
      route.waterAvoidanceAudit ?? null,
    waterNaturalnessAudit:
      waterGeometry?.naturalnessAudit ?? null,
    waterCorridorShapeAudit:
      waterGeometry?.corridorShapeAudit ?? null,
    internalHydrologyProfile:
      waterGeometry?.internalHydrologyProfile ?? null,
    internalHydrologyAudit:
      waterGeometry?.internalHydrologyAudit ?? null,
    lateralContinuationAudit:
      waterGeometry?.lateralContinuationAudit ?? null,
    coarseHydrologyMainChannelProfile:
      waterGeometry?.coarseHydrologyProfile ?? null,
    mainChannelSelection:
      waterGeometry?.mainChannelSelection ?? null,
    ecologicalZones: buildSlotEcologicalZones({
      conditionId,
      assignment,
      hasWater,
      compositionArchitecture,
    }),
    compositionArchitecture,
    worldFrameContract: buildFullWorldDynamicReadinessContract({
      assignment,
      connectivityBlueprint,
    }),
    connectivityEvidence: {
      routeTopology: topology,
      pathPortIds,
      largeWorldConnectionSemantics:
        "current_region_path_graph_binding_without_real_geometry_copy",
      waterRequiredByCurrentWorldFacts: hasWater,
    },
    geometryDerivation: {
      methodId: MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
      seedFingerprint: seedHex,
      seedRevision: V7_SLOT_SEED_REVISION ?? null,
      compositionArchitectureRevision:
        V7_SLOT_COMPOSITION_REVISION ?? null,
      seedPreflightAuthorizationId:
        V7_SLOT_SEED_PREFLIGHT_AUTHORIZATION_ID ?? null,
      measurementSupportFingerprint: assignment.fingerprints.direct,
      measurementTopologyFingerprint:
        layoutProfile.topologySelection
          .measurementTopologyFingerprint,
      aggregateLayoutProfileSha256: layoutProfile.profileSha256,
      exactRealWorldGeometryCarriedForward: false,
      exactMeasurementWindowGeometryCarriedForward: false,
      sourcePixelWindowCarriedForward: false,
      historicalRgbRead: false,
      historicalLayoutRead: false,
      mirrorOrRotationTemplateUsed: false,
      layoutVariant: layoutProfile.layoutVariant,
      routeTopologyFamily:
        MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
      routeWaterAvoidanceMethod:
        route.waterAvoidanceAudit
          ? "measurement_fact_driven_independent_full_free_space_candidate_passage_v8"
          : null,
      routeWaterAvoidancePassed:
        route.waterAvoidanceAudit?.passed ?? null,
      macroTopologySource:
        layoutProfile.coarseHydrologyMainChannelProfile
          ? "measurement_window_aggregate_facts_plus_all_eight_quantized_thai_dem_d8_to_independent_internal_hydrology_without_fixed_boundary_water_ports"
          : "measurement_window_fingerprint_plus_aggregate_natural_facts",
      retrySeedAffectsMacroTopology: false,
      retrySeedScope:
        layoutProfile.topologySelection.retrySeedScope,
      layoutSelectionByte:
        layoutProfile.topologySelection.layoutSelectionByte,
      routeTopologySelectionByte:
        layoutProfile.topologySelection.routeTopologySelectionByte,
      routeMacroProfileSha256:
        layoutProfile.waterAvoidingRoutePlan?.routeMacroProfile
          ?.profileSha256 ?? null,
      waterControlProfileSelectionByte:
        layoutProfile.topologySelection
          .waterControlProfileSelectionByte,
      waterControlProfileIndex:
        layoutProfile.waterControlProfileIndex,
      internalHydrologyFamily:
        layoutProfile.internalHydrologyProfile?.family ?? null,
      internalHydrologyProfileSha256:
        layoutProfile.internalHydrologyProfile?.profileSha256 ?? null,
      coarseHydrologyMainChannelFamily:
        layoutProfile.coarseHydrologyMainChannelProfile?.family ??
        null,
      coarseHydrologyMainChannelProfileSha256:
        layoutProfile.coarseHydrologyMainChannelProfile
          ?.profileSha256 ?? null,
      coarseHydrologyMainChannelSource:
        layoutProfile.coarseHydrologyMainChannelProfile
          ? structuredClone(
              layoutProfile.coarseHydrologyMainChannelProfile
                .source,
            )
          : null,
      exactD8GeometryCarriedForward: false,
      internalHydrologySelectionByte:
        layoutProfile.topologySelection
          .internalHydrologySelectionByte,
      floodplainBasinSelectionByte:
        layoutProfile.topologySelection
          .floodplainBasinSelectionByte,
    },
  };
}

function auditV7SlotGeometryNovelty({ geometry, slotContext }) {
  const directFingerprint = sha256(
    Buffer.from(JSON.stringify(geometrySkeletonPayload(geometry))),
  );
  const transformedPayloads = buildTransformedSkeletonPayloads(geometry);
  const transformCanonicalFingerprint = sha256(
    Buffer.from([...transformedPayloads].sort()[0]),
  );
  const routeOccupancy = routeOccupancyCells(geometry.pathCenterline);
  const compositionOccupancy = compositionOccupancyCells(geometry);
  const compositionCanonicalFingerprint = canonicalTaggedOccupancyFingerprint([
    ...routeOccupancy.map((cell) => `route:${cell}`),
    ...compositionOccupancy,
  ]);
  const previousComparisons = [];
  let supersededSameSlotConditionRunCount = 0;
  const runtimeRoot = path.join(ROOT, slotContext.runtimeRoot);
  if (fs.existsSync(runtimeRoot)) {
    for (const entry of fs.readdirSync(runtimeRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(
        runtimeRoot,
        entry.name,
        "complete-map-condition-run.json",
      );
      if (!fs.existsSync(manifestPath)) continue;
      const previousManifest = readJson(manifestPath);
      if (!previousManifest.v7SlotId) continue;
      if (
        previousManifest.v7SlotId === V7_SLOT_ID &&
        !geometry.geometryDerivation?.compositionArchitectureRevision
      ) {
        supersededSameSlotConditionRunCount += 1;
        continue;
      }
      if (previousManifest.v7SlotId === V7_SLOT_ID) {
        supersededSameSlotConditionRunCount += 1;
      }
      const previousBlueprint = readJson(
        path.join(ROOT, previousManifest.blueprintPath),
      );
      const previousGeometry = previousBlueprint.geometry;
      const previousCanonical =
        previousGeometry.geometryNoveltyAudit
          ?.transformCanonicalFingerprint ??
        sha256(
          Buffer.from(
            [...buildTransformedSkeletonPayloads(previousGeometry)].sort()[0],
          ),
        );
      const previousOccupancy =
        previousGeometry.geometryNoveltyAudit?.routeOccupancy ??
        routeOccupancyCells(previousGeometry.pathCenterline);
      const previousCompositionOccupancy =
        previousGeometry.geometryNoveltyAudit?.compositionOccupancy ??
        compositionOccupancyCells(previousGeometry);
      const routeSimilarity =
        maximumTransformedOccupancySimilarity(
          routeOccupancy,
          previousOccupancy,
        );
      const compositionSimilarity =
        maximumTransformedTaggedOccupancySimilarity(
          compositionOccupancy,
          previousCompositionOccupancy,
        );
      previousComparisons.push({
        slotId: previousManifest.v7SlotId,
        conditionId: previousManifest.conditionId,
        comparisonClass:
          previousManifest.v7SlotId === V7_SLOT_ID
            ? "superseded_same_slot_condition"
            : "other_capacity_slot",
        transformCanonicalFingerprint: previousCanonical,
        compositionCanonicalFingerprint:
          previousGeometry.geometryNoveltyAudit
            ?.compositionCanonicalFingerprint ??
          canonicalTaggedOccupancyFingerprint([
            ...previousOccupancy.map((cell) => `route:${cell}`),
            ...previousCompositionOccupancy,
          ]),
        maximumRouteOccupancySimilarity: routeSimilarity,
        maximumCompositionOccupancySimilarity:
          compositionSimilarity,
        maximumCompleteFrameworkSimilarity: Number(
          (routeSimilarity * 0.35 +
            compositionSimilarity * 0.65).toFixed(6),
        ),
      });
    }
  }
  const exactTransformDuplicate = previousComparisons.find(
    (entry) =>
      entry.transformCanonicalFingerprint ===
      transformCanonicalFingerprint,
  );
  const mostSimilar = [...previousComparisons].sort(
    (left, right) =>
      right.maximumRouteOccupancySimilarity -
      left.maximumRouteOccupancySimilarity,
  )[0] ?? null;
  const mostSimilarFramework = [...previousComparisons].sort(
    (left, right) =>
      right.maximumCompleteFrameworkSimilarity -
      left.maximumCompleteFrameworkSimilarity,
  )[0] ?? null;
  const comparedUniqueSlotIds = [
    ...new Set(previousComparisons.map((entry) => entry.slotId)),
  ].sort();
  const requiredCapacitySlotIds = geometry.geometryDerivation
    ?.compositionArchitectureRevision
    ? Array.from(
        { length: 64 },
        (_, index) => `v7-capacity-slot-${146 + index}`,
      )
    : [];
  const missingRequiredCapacitySlotIds = requiredCapacitySlotIds.filter(
    (slotId) => !comparedUniqueSlotIds.includes(slotId),
  );
  const maximumAllowedRouteOccupancySimilarity = 0.92;
  const maximumAllowedCompleteFrameworkSimilarity = 0.68;
  assert(
    !exactTransformDuplicate,
    `V7 slot geometry is an exact mirror/rotation duplicate of ${exactTransformDuplicate?.slotId}`,
  );
  assert(
    !mostSimilarFramework ||
      mostSimilarFramework.maximumCompleteFrameworkSimilarity <
        maximumAllowedCompleteFrameworkSimilarity,
    `V7 slot complete composition framework is too similar to ${mostSimilarFramework?.slotId}: ${mostSimilarFramework?.maximumCompleteFrameworkSimilarity}`,
  );
  assert(
    !mostSimilar ||
      mostSimilar.maximumRouteOccupancySimilarity <
        maximumAllowedRouteOccupancySimilarity,
    `V7 slot route skeleton is too similar to ${mostSimilar?.slotId}: ${mostSimilar?.maximumRouteOccupancySimilarity}`,
  );
  assert(
    missingRequiredCapacitySlotIds.length === 0,
    `V7 slot complete-framework audit did not compare all 64 capacity identities: ${missingRequiredCapacitySlotIds.join(", ")}`,
  );
  return {
    schemaVersion: "v7-slot-game-geometry-novelty-audit-v1",
    status: "passed",
    directFingerprint,
    transformCanonicalFingerprint,
    routeOccupancy,
    compositionOccupancy,
    compositionCanonicalFingerprint,
    comparedSlotCount: previousComparisons.length,
    comparedUniqueSlotCount: comparedUniqueSlotIds.length,
    comparedUniqueSlotIds,
    requiredCapacitySlotIds,
    missingRequiredCapacitySlotIds,
    supersededSameSlotConditionRunCount,
    sameCapacityIdentityComparedAsIndependentMap:
      Boolean(geometry.geometryDerivation?.compositionArchitectureRevision),
    maximumAllowedRouteOccupancySimilarity,
    maximumAllowedCompleteFrameworkSimilarity,
    mostSimilarPreviousSlot: mostSimilar,
    mostSimilarCompleteFramework: mostSimilarFramework,
    sameSlotSupersededConditionsCompared:
      Boolean(geometry.geometryDerivation?.compositionArchitectureRevision),
    exactTransformDuplicateFound: false,
    mirrorOrRotationTemplateUsed: false,
    sharedRouteSkeletonDetected: false,
  };
}

function geometrySkeletonPayload(geometry) {
  return {
    routeTopology: geometry.routeTopology,
    pathCenterline: normalizePoints(geometry.pathCenterline),
    waterCenterline: normalizePoints(geometry.waterCenterline ?? []),
    waterBranchCenterlines: (
      geometry.waterBranchCenterlines ?? []
    ).map((points) => normalizePoints(points)),
    compositionOccupancy: compositionOccupancyCells(geometry),
  };
}

function compositionOccupancyCells(geometry) {
  const cells = new Set();
  for (const region of geometry.terrainRegions ?? []) {
    if (
      ![
        "natural_boundary",
        "tall_grass",
        "mud_patch",
        "water",
        "shoreline",
      ].includes(region.kind)
    ) {
      continue;
    }
    for (const cell of polygonOccupancyCells(region.polygon)) {
      cells.add(`terrain_${region.kind}:${cell}`);
    }
  }
  for (const zone of geometry.ecologicalZones ?? []) {
    if (!Array.isArray(zone.polygon)) continue;
    for (const cell of polygonOccupancyCells(zone.polygon)) {
      cells.add(`ecology_${zone.kind}:${cell}`);
    }
  }
  for (const object of geometry.objectFootprints ?? []) {
    const x = object.footprint.x + object.footprint.width / 2;
    const y = object.footprint.y + object.footprint.height / 2;
    const column = clamp(Math.floor((x / WIDTH) * 16), 0, 15);
    const row = clamp(Math.floor((y / HEIGHT) * 12), 0, 11);
    cells.add(`object_${object.kind}:${column},${row}`);
  }
  return [...cells].sort();
}

function polygonOccupancyCells(polygon) {
  const cells = [];
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      const point = {
        x: ((column + 0.5) / 16) * WIDTH,
        y: ((row + 0.5) / 12) * HEIGHT,
      };
      if (pointInPolygon(point, polygon)) {
        cells.push(`${column},${row}`);
      }
    }
  }
  return cells;
}

function canonicalTaggedOccupancyFingerprint(taggedCells) {
  const canonicalForms = normalizedPointTransforms().map((transform) =>
    [...new Set(taggedCells.map((entry) => {
      const separator = entry.lastIndexOf(":");
      const tag = entry.slice(0, separator);
      const [column, row] = entry.slice(separator + 1).split(",").map(Number);
      const point = {
        x: (column + 0.5) / 16,
        y: (row + 0.5) / 12,
      };
      const value = transform(point);
      return `${tag}:${clamp(Math.floor(value.x * 16), 0, 15)},${clamp(Math.floor(value.y * 12), 0, 11)}`;
    }))].sort().join("|"),
  );
  return sha256(Buffer.from(canonicalForms.sort()[0] ?? ""));
}

function maximumTransformedTaggedOccupancySimilarity(current, previous) {
  const previousSet = new Set(previous);
  let maximum = 0;
  for (const transform of normalizedPointTransforms()) {
    const transformed = new Set(current.map((entry) => {
      const separator = entry.lastIndexOf(":");
      const tag = entry.slice(0, separator);
      const [column, row] = entry.slice(separator + 1).split(",").map(Number);
      const value = transform({
        x: (column + 0.5) / 16,
        y: (row + 0.5) / 12,
      });
      return `${tag}:${clamp(Math.floor(value.x * 16), 0, 15)},${clamp(Math.floor(value.y * 12), 0, 11)}`;
    }));
    const union = new Set([...transformed, ...previousSet]);
    let intersection = 0;
    for (const cell of transformed) {
      if (previousSet.has(cell)) intersection += 1;
    }
    maximum = Math.max(
      maximum,
      union.size === 0 ? 1 : intersection / union.size,
    );
  }
  return Number(maximum.toFixed(6));
}

function buildTransformedSkeletonPayloads(geometry) {
  const route = normalizePoints(geometry.pathCenterline);
  const water = normalizePoints(geometry.waterCenterline ?? []);
  const waterBranches = (
    geometry.waterBranchCenterlines ?? []
  ).map((points) => normalizePoints(points));
  const payloads = [];
  for (const transform of normalizedPointTransforms()) {
    const transformedRoute = route.map(transform);
    const transformedWater = water.map(transform);
    const transformedWaterBranches = waterBranches.map((points) =>
      points.map(transform),
    );
    for (const reverseRoute of [false, true]) {
      for (const reverseWater of [false, true]) {
        payloads.push(
          JSON.stringify({
            pathCenterline: reverseRoute
              ? [...transformedRoute].reverse()
              : transformedRoute,
            waterCenterline: reverseWater
              ? [...transformedWater].reverse()
              : transformedWater,
            waterBranchCenterlines: transformedWaterBranches.map(
              (points) =>
                reverseWater ? [...points].reverse() : points,
            ),
          }),
        );
      }
    }
  }
  return payloads;
}

function normalizePoints(points) {
  return (points ?? []).map((point) => ({
    x: Number((point.x / WIDTH).toFixed(4)),
    y: Number((point.y / HEIGHT).toFixed(4)),
  }));
}

function normalizedPointTransforms() {
  return [
    ({ x, y }) => ({ x, y }),
    ({ x, y }) => ({ x: 1 - x, y }),
    ({ x, y }) => ({ x, y: 1 - y }),
    ({ x, y }) => ({ x: 1 - x, y: 1 - y }),
    ({ x, y }) => ({ x: y, y: x }),
    ({ x, y }) => ({ x: 1 - y, y: x }),
    ({ x, y }) => ({ x: y, y: 1 - x }),
    ({ x, y }) => ({ x: 1 - y, y: 1 - x }),
  ];
}

function routeOccupancyCells(points) {
  const cells = new Set();
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 12),
    );
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const column = clamp(Math.floor((x / WIDTH) * 16), 0, 15);
      const row = clamp(Math.floor((y / HEIGHT) * 12), 0, 11);
      cells.add(`${column},${row}`);
    }
  }
  return [...cells].sort();
}

function maximumTransformedOccupancySimilarity(current, previous) {
  const currentPoints = current.map((cell) => {
    const [column, row] = cell.split(",").map(Number);
    return { x: (column + 0.5) / 16, y: (row + 0.5) / 12 };
  });
  const previousSet = new Set(previous);
  let maximum = 0;
  for (const transform of normalizedPointTransforms()) {
    const transformed = new Set(
      currentPoints.map((point) => {
        const value = transform(point);
        const column = clamp(Math.floor(value.x * 16), 0, 15);
        const row = clamp(Math.floor(value.y * 12), 0, 11);
        return `${column},${row}`;
      }),
    );
    const union = new Set([...transformed, ...previousSet]);
    let intersection = 0;
    for (const cell of transformed) {
      if (previousSet.has(cell)) intersection += 1;
    }
    maximum = Math.max(
      maximum,
      union.size === 0 ? 1 : intersection / union.size,
    );
  }
  return Number(maximum.toFixed(6));
}

function currentPathBoundaryConnection(connectivityBlueprint) {
  const currentRegionId =
    connectivityBlueprint.currentRegion.regionId;
  const pathPort = (
    connectivityBlueprint.edgePorts ?? []
  ).find(
    (entry) =>
      entry.regionId === currentRegionId &&
      entry.kind === "path" &&
      entry.boundaryPosition,
  );
  assert(pathPort, "current regional path connectivity port is missing");
  return {
    edgePortId: pathPort.edgePortId,
    boundarySide: pathPort.boundarySide,
    point: {
      x: pathPort.boundaryPosition.x,
      y: pathPort.boundaryPosition.y,
    },
  };
}

function currentPathInteriorEntryPoint(connectivityBlueprint) {
  const pathPlan =
    connectivityBlueprint.anonymousTrainingCoordinateProjection
      ?.pathPlan;
  const point = pathPlan?.interiorEntryPoint;
  const contract = pathPlan?.interiorEntryDepthContract;
  assert(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      contract?.version ===
        "complete-map-boundary-port-to-interior-depth-v1" &&
      contract.completeMapRouteSpanThreshold === 0.35 &&
      contract.reviewThresholdChanged === false,
    "current regional path interior-entry depth contract is missing",
  );
  const side = pathPlan.boundarySide;
  const normalizedDepth =
    side === "west"
      ? point.x / WIDTH
      : side === "east"
        ? (WIDTH - point.x) / WIDTH
        : side === "north"
          ? point.y / HEIGHT
          : (HEIGHT - point.y) / HEIGHT;
  assert(
    normalizedDepth >= contract.minimumNormalizedDepth &&
      normalizedDepth >
        contract.completeMapRouteSpanThreshold,
    "current regional path interior entry is too shallow for a complete map",
  );
  return {
    x: point.x,
    y: point.y,
  };
}

function boundarySideToCanvasEdge(boundarySide) {
  const edge = {
    north: "top",
    east: "right",
    south: "bottom",
    west: "left",
  }[boundarySide];
  assert(
    edge,
    `unsupported connectivity boundary side: ${boundarySide}`,
  );
  return edge;
}

function entranceBoundsForBoundaryConnection(connection) {
  const point = connection.point;
  if (connection.boundarySide === "west") {
    return {
      x: 0,
      y: clamp(point.y - 42, 0, HEIGHT - 84),
      width: 52,
      height: 84,
    };
  }
  if (connection.boundarySide === "east") {
    return {
      x: WIDTH - 52,
      y: clamp(point.y - 42, 0, HEIGHT - 84),
      width: 52,
      height: 84,
    };
  }
  if (connection.boundarySide === "north") {
    return {
      x: clamp(point.x - 42, 0, WIDTH - 84),
      y: 0,
      width: 84,
      height: 52,
    };
  }
  return {
    x: clamp(point.x - 42, 0, WIDTH - 84),
    y: HEIGHT - 52,
    width: 84,
    height: 52,
  };
}

function pointStaysWithinRouteBoundaryEnvelope({
  point,
  connection,
  margin,
  approachHalfWidth,
}) {
  const inside =
    point.x >= margin &&
    point.x <= WIDTH - margin &&
    point.y >= margin &&
    point.y <= HEIGHT - margin;
  if (inside) return true;
  if (
    connection.boundarySide === "west" ||
    connection.boundarySide === "east"
  ) {
    const touchesConnectedSide =
      connection.boundarySide === "west"
        ? point.x < margin
        : point.x > WIDTH - margin;
    return (
      touchesConnectedSide &&
      point.y >= margin &&
      point.y <= HEIGHT - margin &&
      Math.abs(point.y - connection.point.y) <= approachHalfWidth
    );
  }
  const touchesConnectedSide =
    connection.boundarySide === "north"
      ? point.y < margin
      : point.y > HEIGHT - margin;
  return (
    touchesConnectedSide &&
    point.x >= margin &&
    point.x <= WIDTH - margin &&
    Math.abs(point.x - connection.point.x) <= approachHalfWidth
  );
}

function buildAnonymousRoute(
  topology,
  random,
  routeNaturalnessProfile,
  layoutProfile,
  connectivityBlueprint,
) {
  const pathConnection =
    currentPathBoundaryConnection(connectivityBlueprint);
  const pathBoundaryPosition = pathConnection.point;
  const pathBoundaryEdge = boundarySideToCanvasEdge(
    pathConnection.boundarySide,
  );
  const pathInteriorEntryPoint =
    currentPathInteriorEntryPoint(connectivityBlueprint);
  const controls = {
    left_to_right_meandering_passage: {
      start: { x: 0, y: randomInt(470, 610, random) },
      end: { x: WIDTH, y: randomInt(150, 290, random) },
      usedEdges: ["left", "right"],
    },
    top_to_bottom_broken_curve_passage: {
      start: { x: randomInt(180, 360, random), y: 0 },
      end: { x: randomInt(650, 850, random), y: HEIGHT },
      usedEdges: ["top", "bottom"],
    },
    left_to_bottom_diagonal_passage: {
      start: { x: 0, y: randomInt(170, 340, random) },
      end: { x: randomInt(620, 850, random), y: HEIGHT },
      usedEdges: ["left", "bottom"],
    },
    right_to_bottom_diagonal_passage: {
      start: { x: WIDTH, y: randomInt(150, 330, random) },
      end: { x: randomInt(170, 420, random), y: HEIGHT },
      usedEdges: ["right", "bottom"],
    },
    upper_bank_transverse_passage: {
      start: { x: 0, y: randomInt(120, 230, random) },
      end: { x: WIDTH, y: randomInt(140, 270, random) },
      usedEdges: ["left", "right"],
    },
    seeded_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
    upper_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
    lower_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
    transverse_interior_to_current_region_port_passage: {
      start: structuredClone(pathInteriorEntryPoint),
      end: pathBoundaryPosition,
      usedEdges: [pathBoundaryEdge],
    },
  };
  const selected = controls[topology];
  assert(
    routeNaturalnessProfile?.status ===
      "aggregate_public_route_naturalness_profile_ready",
    "anonymous route naturalness reference profile is missing",
  );
  const naturalRoute = buildNaturalAnonymousCenterline({
    start: selected.start,
    end: selected.end,
    random,
    width: WIDTH,
    height: HEIGHT,
    profile: routeNaturalnessProfile,
    safeBounds: null,
  });
  const start = selected.start;
  const connectedPoint =
    start.x === 0 ||
    start.x === WIDTH ||
    start.y === 0 ||
    start.y === HEIGHT
      ? start
      : selected.end;
  const entranceBounds =
    connectedPoint.x === 0
      ? {
          x: 0,
          y: clamp(connectedPoint.y - 42, 0, HEIGHT - 84),
          width: 52,
          height: 84,
        }
      : connectedPoint.x === WIDTH
        ? {
            x: WIDTH - 52,
            y: clamp(connectedPoint.y - 42, 0, HEIGHT - 84),
            width: 52,
            height: 84,
          }
        : connectedPoint.y === HEIGHT
          ? {
              x: clamp(connectedPoint.x - 42, 0, WIDTH - 84),
              y: HEIGHT - 52,
              width: 84,
              height: 52,
            }
          : {
              x: clamp(connectedPoint.x - 42, 0, WIDTH - 84),
              y: 0,
              width: 84,
              height: 52,
            };
  return {
    points: naturalRoute.points,
    naturalnessAudit: naturalRoute.audit,
    entranceBounds,
    usedEdges: selected.usedEdges,
  };
}

function buildAnonymousRouteAvoidingWater({
  topology,
  random,
  routeNaturalnessProfile,
  layoutProfile,
  waterPolygons,
  connectivityBlueprint,
}) {
  assert(
    [
      "seeded_interior_to_current_region_port_passage",
      "upper_interior_to_current_region_port_passage",
      "lower_interior_to_current_region_port_passage",
      "transverse_interior_to_current_region_port_passage",
    ].includes(topology) &&
      Array.isArray(waterPolygons) &&
      waterPolygons.length > 0,
    "water-avoiding route construction inputs are invalid",
  );
  const routePlan = layoutProfile.waterAvoidingRoutePlan;
  assert(
    [
      "measurement-driven-full-free-space-route-plan-v8",
      "measurement-driven-full-free-space-route-plan-v9",
      "measurement-driven-full-free-space-route-plan-v10",
    ].includes(routePlan.schemaVersion) &&
      routePlan.routeTopology === topology &&
      [
        "measurement_selected_anonymous_origin_candidates_then_full_canvas_water_collision_rejection",
        "measurement_selected_anonymous_origin_candidates_plus_connectivity_boundary_projected_candidates_then_full_canvas_water_collision_rejection",
      ].includes(routePlan.method) &&
      routePlan.exactD8GeometryCarriedForward === false &&
      routePlan.sourcePixelCoordinatesRead === false &&
      routePlan.historicalGeometryRead === false &&
      routePlan.fixedSharedSkeletonUsed === false &&
      routePlan.connectivityPortsAreBoundaryConstraintsOnly === true &&
      Array.isArray(routePlan.candidateOriginFractions) &&
      routePlan.candidateOriginFractions.length >= 8 &&
      Number.isInteger(routePlan.preferredOriginIndex) &&
      routePlan.preferredOriginIndex >= 0 &&
      routePlan.preferredOriginIndex <
        routePlan.candidateOriginFractions.length &&
      routePlan.candidateOriginFractions.every(
        (entry) =>
          Number.isFinite(entry.x) &&
          Number.isFinite(entry.y) &&
          entry.x > 0 &&
          entry.x < 1 &&
          entry.y > 0 &&
          entry.y < 1,
      ) &&
      routePlan.candidateAttemptsPerOrigin >= 4 &&
      routePlan.routeMacroProfile?.sourceBandCount === 8 &&
      routePlan.routeMacroProfile
        ?.connectivityPortsAreBoundaryConstraintsOnly === true &&
      routePlan.routeMacroProfile?.slotIdentityRead === false &&
      routePlan.routeMacroProfile?.retrySeedRead === false &&
      routePlan.routeMacroProfile?.historicalGeometryRead === false &&
      routePlan.routeMacroProfile?.fixedSharedSkeletonUsed === false,
    "measurement-driven full-free-space route plan is invalid",
  );
  const pathConnection =
    currentPathBoundaryConnection(connectivityBlueprint);
  const end = pathConnection.point;
  const boundaryProjectedOrigins =
    routePlan.boundaryProjectedCandidateExpansionRequired === true
      ? routePlan.candidateOriginFractions.map((origin) => {
          if (pathConnection.boundarySide === "west") {
            return { x: 0.12 + origin.x * 0.38, y: origin.y };
          }
          if (pathConnection.boundarySide === "east") {
            return { x: 0.88 - origin.x * 0.38, y: origin.y };
          }
          if (pathConnection.boundarySide === "north") {
            return { x: origin.x, y: 0.12 + origin.y * 0.38 };
          }
          return { x: origin.x, y: 0.88 - origin.y * 0.38 };
        })
      : [];
  const effectiveOrigins = [
    ...routePlan.candidateOriginFractions.map((origin) => ({
      ...origin,
      source: "measurement_selected_full_canvas",
    })),
    ...boundaryProjectedOrigins.map((origin) => ({
      ...origin,
      source: "connectivity_boundary_projected",
    })),
  ];
  const candidates = [];
  const failures = [];
  let evaluatedAttemptCount = 0;
  for (
    let originIndex = 0;
    originIndex < effectiveOrigins.length;
    originIndex += 1
  ) {
    const origin = effectiveOrigins[originIndex];
    const start = {
      x: Math.round(WIDTH * origin.x),
      y: Math.round(HEIGHT * origin.y),
    };
    for (
      let originAttempt = 1;
      originAttempt <= routePlan.candidateAttemptsPerOrigin;
      originAttempt += 1
    ) {
      evaluatedAttemptCount += 1;
      let naturalRoute = null;
      try {
        naturalRoute = buildNaturalAnonymousCenterline({
          start,
          end,
          random,
          width: WIDTH,
          height: HEIGHT,
          profile: routeNaturalnessProfile,
        });
      } catch (error) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_naturalness_envelope_failed",
          message: String(error?.message ?? error).slice(
            0,
            500,
          ),
        });
        continue;
      }
      const halfWidths = buildNaturalRouteHalfWidths(
        naturalRoute.points.length,
        random,
      );
      const interiorBoundaryMargin =
        Math.max(...halfWidths) + 66;
      const connectedBoundaryApproachHalfWidth = Math.max(
        42,
        interiorBoundaryMargin,
      );
      const staysInsideUnconnectedBoundaries =
        naturalRoute.points
          .slice(0, -1)
          .every(
            (point) =>
              pointStaysWithinRouteBoundaryEnvelope({
                point,
                connection: pathConnection,
                margin: interiorBoundaryMargin,
                approachHalfWidth:
                  connectedBoundaryApproachHalfWidth,
              }),
          );
      if (!staysInsideUnconnectedBoundaries) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_touches_uncontracted_map_boundary",
        });
        continue;
      }
      const pathPolygon = ribbonPolygonVariable(
        naturalRoute.points,
        halfWidths,
        WIDTH,
        HEIGHT,
      );
      const overlapsWater = waterPolygons.some(
        (waterPolygon) =>
          polygonsOverlap(pathPolygon, waterPolygon),
      );
      if (overlapsWater) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_water_geometry_conflict",
        });
        continue;
      }
      const chordRatio =
        Math.hypot(start.x - end.x, start.y - end.y) /
        Math.hypot(WIDTH, HEIGHT);
      if (chordRatio < routePlan.completeMapMinimumChordRatio) {
        failures.push({
          originIndex,
          originAttempt,
          code: "route_complete_map_span_insufficient",
          chordRatio: Number(chordRatio.toFixed(6)),
        });
        continue;
      }
      candidates.push({
        originIndex,
        originSource: origin.source,
        originAttempt,
        start,
        points: naturalRoute.points,
        naturalnessAudit: naturalRoute.audit,
        halfWidths,
        pathPolygon,
        chordRatio,
        measurementOriginDistance: Math.min(
          Math.abs(
            originIndex - routePlan.preferredOriginIndex,
          ),
          routePlan.candidateOriginFractions.length -
            Math.abs(
              originIndex - routePlan.preferredOriginIndex,
            ),
        ),
      });
    }
  }
  assert(
    candidates.length > 0,
    `water-avoiding anonymous route could not satisfy the existing gates: ${JSON.stringify(
      {
        routeOriginSelectionByte:
          routePlan.routeOriginSelectionByte,
        candidateOriginFractions:
          routePlan.candidateOriginFractions,
        failures,
      },
    )}`,
  );
  const targetSinuosity =
    routeNaturalnessProfile.anonymousGenerationEnvelope
      .targetSinuosity;
  candidates.sort(
    (left, right) =>
      right.chordRatio - left.chordRatio ||
      left.measurementOriginDistance -
        right.measurementOriginDistance ||
      Math.abs(
        left.naturalnessAudit.sinuosity - targetSinuosity,
      ) -
        Math.abs(
          right.naturalnessAudit.sinuosity -
            targetSinuosity,
        ) ||
      left.originIndex - right.originIndex ||
      left.originAttempt - right.originAttempt,
  );
  const selected = candidates[0];
  return {
    points: selected.points,
    naturalnessAudit: selected.naturalnessAudit,
    pathPolygon: selected.pathPolygon,
    entranceBounds: entranceBoundsForBoundaryConnection(
      pathConnection,
    ),
    usedEdges: [
      boundarySideToCanvasEdge(pathConnection.boundarySide),
    ],
    waterAvoidanceAudit: {
      schemaVersion:
        "anonymous-route-water-avoidance-audit-v6",
      status: "passed",
      passed: true,
      topology,
      selectedOriginIndex: selected.originIndex,
      selectedOrigin: selected.start,
      selectedOriginSource: selected.originSource,
      selectedOriginAttempt: selected.originAttempt,
      selectedOriginMeasurementDistance:
        selected.measurementOriginDistance,
      evaluatedAttemptCount,
      baseCandidateOriginCount:
        routePlan.candidateOriginFractions.length,
      boundaryProjectedCandidateOriginCount:
        boundaryProjectedOrigins.length,
      effectiveCandidateOriginCount: effectiveOrigins.length,
      passingCandidateCount: candidates.length,
      rejectedCandidateCount: failures.length,
      fullCanvasCandidateSearch: true,
      sideEnvelopeFollowed: false,
      measurementDrivenRoutePlan:
        structuredClone(routePlan),
      completeMapChordRatio: Number(
        selected.chordRatio.toFixed(6),
      ),
      pathWaterOverlap: false,
      currentRegionPathPortPreserved: true,
      pathBoundarySide: pathConnection.boundarySide,
      waterGeometrySource:
        "current_anonymous_dem_d8_driven_water_polygons",
      exactRealWorldGeometryUsed: false,
      exactD8GeometryUsed: false,
      retrySeedAffectsMacroTopology: false,
    },
  };
}

function buildAnonymousNaturalBoundaries(usedEdges, random) {
  const availableEdges = ["top", "right", "bottom", "left"].filter(
    (edge) => !usedEdges.includes(edge),
  );
  return availableEdges.map((edge, index) => {
    const thickness = randomInt(38, 62, random);
    if (edge === "top") {
      return [
        { x: 0, y: 0 },
        { x: WIDTH, y: 0 },
        { x: WIDTH, y: thickness + randomInt(-8, 8, random) },
        { x: Math.round(WIDTH * 0.66), y: thickness + randomInt(-10, 10, random) },
        { x: Math.round(WIDTH * 0.34), y: thickness + randomInt(-10, 10, random) },
        { x: 0, y: thickness + randomInt(-8, 8, random) },
      ];
    }
    if (edge === "bottom") {
      return [
        { x: 0, y: HEIGHT },
        { x: WIDTH, y: HEIGHT },
        { x: WIDTH, y: HEIGHT - thickness + randomInt(-8, 8, random) },
        { x: Math.round(WIDTH * 0.62), y: HEIGHT - thickness + randomInt(-10, 10, random) },
        { x: Math.round(WIDTH * 0.28), y: HEIGHT - thickness + randomInt(-10, 10, random) },
        { x: 0, y: HEIGHT - thickness + randomInt(-8, 8, random) },
      ];
    }
    if (edge === "left") {
      return rectanglePolygon(0, 0, thickness, HEIGHT);
    }
    return rectanglePolygon(WIDTH - thickness, 0, thickness, HEIGHT);
  });
}

function buildMosaicNaturalBoundaries(usedEdges, random) {
  const availableEdges = ["top", "right", "bottom", "left"].filter(
    (edge) => !usedEdges.includes(edge),
  );
  return availableEdges.map((edge) => {
    const jitter = () => randomInt(-10, 10, random);
    if (edge === "left") {
      return [
        { x: 0, y: 0 },
        { x: 0, y: HEIGHT },
        { x: 92 + jitter(), y: HEIGHT },
        { x: 66 + jitter(), y: 620 },
        { x: 118 + jitter(), y: 470 },
        { x: 72 + jitter(), y: 300 },
        { x: 132 + jitter(), y: 145 },
        { x: 104 + jitter(), y: 0 },
      ];
    }
    if (edge === "right") {
      return [
        { x: WIDTH, y: 0 },
        { x: WIDTH, y: HEIGHT },
        { x: 884 + jitter(), y: HEIGHT },
        { x: 906 + jitter(), y: 610 },
        { x: 858 + jitter(), y: 455 },
        { x: 914 + jitter(), y: 285 },
        { x: 870 + jitter(), y: 120 },
        { x: 898 + jitter(), y: 0 },
      ];
    }
    if (edge === "bottom") {
      return [
        { x: 0, y: HEIGHT },
        { x: WIDTH, y: HEIGHT },
        { x: WIDTH, y: 682 + jitter() },
        { x: 835, y: 646 + jitter() },
        { x: 650, y: 696 + jitter() },
        { x: 470, y: 660 + jitter() },
        { x: 285, y: 704 + jitter() },
        { x: 120, y: 664 + jitter() },
        { x: 0, y: 688 + jitter() },
      ];
    }
    return [
      { x: 0, y: 0 },
      { x: WIDTH, y: 0 },
      { x: WIDTH, y: 86 + jitter() },
      { x: 800, y: 116 + jitter() },
      { x: 620, y: 72 + jitter() },
      { x: 430, y: 126 + jitter() },
      { x: 220, y: 78 + jitter() },
      { x: 0, y: 102 + jitter() },
    ];
  });
}

function buildAnonymousWaterGeometry({
  random,
  routePolygon,
  waterNaturalnessProfile,
  connectivityBlueprint,
  broadRiverControlFractions = null,
  internalHydrologyProfile = null,
  coarseHydrologyProfile = null,
}) {
  const waterPlan =
    connectivityBlueprint.anonymousTrainingCoordinateProjection
      ?.waterPlan;
  const usedEdges = waterPlan?.externalWaterPorts?.map(
    (port) => port.boundarySide,
  ) ?? [];
  assert(
    waterPlan &&
      Array.isArray(waterPlan.externalWaterPorts) &&
      waterPlan.externalWaterPorts.length === 2 &&
      waterPlan.externalWaterPorts.some(
        (port) => port.boundarySide === "north" &&
          port.flowRole === "upstream_inlet",
      ) &&
      waterPlan.externalWaterPorts.some(
        (port) => port.boundarySide === "south" &&
          port.flowRole === "downstream_outlet",
      ) &&
      waterPlan.lateralBoundaryContinuationRequired === false &&
      waterPlan.boundaryWaterDirectionInvented === false,
    "current regional water plan is missing its contracted upstream inlet or downstream outlet",
  );
  assert(
    internalHydrologyProfile?.family ===
      MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY &&
      internalHydrologyProfile
        .connectivityPortsAreBoundaryConstraintsOnly === true &&
      internalHydrologyProfile
        .singleBroadCenterlineIsOnlyInternalHydrology === false,
    "measurement-derived anonymous internal hydrology profile is missing",
  );
  if (coarseHydrologyProfile) {
    assert(
      coarseHydrologyProfile.family ===
        COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY &&
        coarseHydrologyProfile.identityBoundary
          ?.connectivityPortsAreBoundaryConstraintsOnly === true &&
        coarseHydrologyProfile.identityBoundary
          ?.exactD8GeometryCarriedForward === false,
      "coarse hydrology main-channel profile crossed the anonymous geometry boundary",
    );
  }
  const rawWaterHalfWidths = coarseHydrologyProfile
    ? buildMeasurementDerivedNetworkHalfWidths({
        pointCount:
          COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
        startHalfWidth: waterPlan.startHalfWidth,
        endHalfWidth: waterPlan.endHalfWidth,
        coarseHydrologyProfile,
      })
    : buildNaturalWaterHalfWidths(
        NATURAL_WATER_CENTERLINE_POINT_COUNT,
        random,
        {
          startHalfWidth: waterPlan.startHalfWidth,
          endHalfWidth: waterPlan.endHalfWidth,
        },
      );
  const waterHalfWidths =
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "two_separated_interior_headwater_tributaries_to_main_channel"
      ? rawWaterHalfWidths.map((value) =>
          Math.max(12, Math.round(value * 0.58)),
        )
      : rawWaterHalfWidths;
  const naturalWater = coarseHydrologyProfile
    ? buildMeasurementDerivedAnonymousMainChannel({
        start: structuredClone(waterPlan.start),
        end: structuredClone(waterPlan.end),
        width: WIDTH,
        height: HEIGHT,
        coarseHydrologyProfile,
        waterNaturalnessProfile,
        corridorHalfWidths: waterHalfWidths,
      })
    : buildNaturalAnonymousWaterCenterline({
        start: structuredClone(waterPlan.start),
        end: structuredClone(waterPlan.end),
        random,
        width: WIDTH,
        height: HEIGHT,
        profile: waterNaturalnessProfile,
        interiorBias: {
          x:
            internalHydrologyProfile.branchSide === "west"
              ? -72
              : 72,
          y: 0,
        },
        broadRiverMode: true,
        broadRiverControlFractions,
        preferredSinuosity:
          waterNaturalnessProfile.anonymousGenerationEnvelope
            .minimumSinuosity + 0.08,
        corridorHalfWidths: waterHalfWidths,
      });
  const centerline = naturalWater.points;
  const primaryWaterPolygons = buildVariableWidthCorridorPolygons(
    centerline,
    waterHalfWidths,
    WIDTH,
    HEIGHT,
  );
  const internalHydrology =
    buildMeasurementDerivedInternalHydrology({
      centerline,
      waterHalfWidths,
      waterNaturalnessProfile,
      internalHydrologyProfile,
      coarseHydrologyProfile,
    });
  const waterPolygons = [
    ...primaryWaterPolygons,
    ...internalHydrology.waterPolygons,
  ];
  const corridorShapeAudit = auditAnonymousWaterCorridorShape(
    centerline,
    waterHalfWidths,
  );
  assert(
    corridorShapeAudit.passed,
    `anonymous water corridor shape is invalid: ${JSON.stringify(
      corridorShapeAudit,
    )}`,
  );
  if (routePolygon) {
    assert(
      !waterPolygons.some((polygon) =>
        polygonsOverlap(routePolygon, polygon),
      ),
      "anonymous water geometry conflicts with the route; a new slot seed is required",
    );
  }
  assert(
    pointsEqual(centerline[0], waterPlan.start) &&
      pointsEqual(centerline.at(-1), waterPlan.end),
    "anonymous water centerline does not bind the current internal water plan",
  );
  const shorelinePolygons = [
    ...buildVariableWidthCorridorPolygons(
      centerline,
      waterHalfWidths.map((value) => value + 14),
      WIDTH,
      HEIGHT,
    ),
    ...internalHydrology.shorelinePolygons,
  ];
  return {
    centerline,
    waterHalfWidths,
    branchCenterlines: internalHydrology.branchCenterlines,
    branchHalfWidths: internalHydrology.branchHalfWidths,
    waterPolygons,
    shorelinePolygons,
    naturalnessAudit: naturalWater.audit,
    corridorShapeAudit,
    internalHydrologyProfile,
    internalHydrologyAudit: internalHydrology.audit,
    lateralContinuationAudit: null,
    coarseHydrologyProfile,
    mainChannelSelection: naturalWater.selection ?? null,
    usedEdges,
    connectivityPorts: {
      externalWaterPortIds: waterPlan.externalWaterPorts.map(
        (port) => port.edgePortId,
      ),
      upstreamPortId: waterPlan.externalWaterPorts.find(
        (port) => port.flowRole === "upstream_inlet",
      )?.edgePortId ?? null,
      downstreamPortId: waterPlan.externalWaterPorts.find(
        (port) => port.flowRole === "downstream_outlet",
      )?.edgePortId ?? null,
      boundarySides: usedEdges,
      boundaryWaterDirectionInvented: false,
    },
  };
}

function buildMeasurementDerivedInternalHydrology({
  centerline,
  waterHalfWidths,
  waterNaturalnessProfile,
  internalHydrologyProfile,
  coarseHydrologyProfile,
}) {
  const finalIndex = centerline.length - 1;
  const divergenceIndex = clamp(
    Math.round(
      finalIndex * internalHydrologyProfile.divergenceFraction,
    ),
    1,
    finalIndex - 2,
  );
  const rejoinIndex = clamp(
    Math.round(
      finalIndex * internalHydrologyProfile.rejoinFraction,
    ),
    divergenceIndex + 2,
    finalIndex - 1,
  );
  const branchRandom = mulberry32(
    Number.parseInt(
      internalHydrologyProfile.measurementTopologyFingerprint.slice(
        0,
        8,
      ),
      16,
    ),
  );
  const branchStartHalfWidth = Math.max(
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "two_separated_interior_headwater_tributaries_to_main_channel"
      ? 13
      : 22,
    Math.round(
      waterHalfWidths[divergenceIndex] *
        internalHydrologyProfile.branchWidthScale,
    ),
  );
  const branchEndHalfWidth = Math.max(
    branchStartHalfWidth,
    Math.round(
      waterHalfWidths[rejoinIndex] *
        internalHydrologyProfile.branchWidthScale,
    ),
  );
  const branchHalfWidths = buildNaturalWaterHalfWidths(
    coarseHydrologyProfile
      ? COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT
      : NATURAL_WATER_CENTERLINE_POINT_COUNT,
    branchRandom,
    {
      startHalfWidth: branchStartHalfWidth,
      endHalfWidth: branchEndHalfWidth,
    },
  );
  const branchDirection =
    internalHydrologyProfile.branchSide === "west" ? -1 : 1;
  const branchStart =
    [
      "interior_headwater_tributary_to_main_channel",
      "two_separated_interior_headwater_tributaries_to_main_channel",
    ].includes(
      internalHydrologyProfile.internalNetworkConnectionMode,
    )
      ? {
          x:
            WIDTH *
            internalHydrologyProfile
              .tributaryHeadwaterXFraction,
          y: centerline[divergenceIndex].y,
        }
      : structuredClone(centerline[divergenceIndex]);
  const branchEnd =
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "main_channel_connected_floodplain_backwater_finger"
      ? {
          x:
            WIDTH *
            (centerline[rejoinIndex].x < WIDTH / 2
              ? 0.86
              : 0.14),
          y: Math.min(
            HEIGHT - 1,
            centerline[divergenceIndex].y +
              HEIGHT *
                clamp(
                  0.3 +
                    (internalHydrologyProfile
                      .measurementSupportStatistics
                      ?.relativeSupportRange ?? 0) *
                      0.2,
                  0.3,
                  0.42,
                ),
          ),
        }
      : structuredClone(centerline[rejoinIndex]);
  const branch = coarseHydrologyProfile
    ? buildMeasurementDerivedAnonymousAnabranch({
        start: branchStart,
        end: branchEnd,
        width: WIDTH,
        coarseHydrologyProfile,
        internalHydrologyProfile,
        waterNaturalnessProfile,
        corridorHalfWidths: branchHalfWidths,
      })
    : buildMeasurementDerivedMonotonicAnabranch({
        start: structuredClone(
          centerline[divergenceIndex],
        ),
        end: structuredClone(centerline[rejoinIndex]),
        branchDirection,
        lateralOffsetPixels:
          WIDTH *
          internalHydrologyProfile.lateralOffsetFraction,
        pointCount:
          NATURAL_WATER_CENTERLINE_POINT_COUNT,
        waterNaturalnessProfile,
        preferredSinuosity:
          internalHydrologyProfile.preferredSinuosity,
        branchHalfWidths,
      });
  const branchCenterline = branch.points;
  const branchWaterPolygons = buildVariableWidthCorridorPolygons(
    branchCenterline,
    branchHalfWidths,
    WIDTH,
    HEIGHT,
  );
  const branchShorelinePolygons =
    buildVariableWidthCorridorPolygons(
      branchCenterline,
      branchHalfWidths.map((value) => value + 10),
      WIDTH,
      HEIGHT,
    );
  const connectedFingerCenterlines = [];
  const connectedFingerHalfWidthProfiles = [];
  const connectedFingerWaterPolygons = [];
  const connectedFingerShorelinePolygons = [];
  if (
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "two_separated_interior_headwater_tributaries_to_main_channel"
  ) {
    const directSupports =
      internalHydrologyProfile.measurementSupportStatistics
        ?.directBandSupports ?? [];
    const relativeSupports =
      internalHydrologyProfile.measurementSupportStatistics
        ?.relativeBandSupports ?? [];
    const secondaryBandIndex = relativeSupports
      .map((support, index) => ({ support, index }))
      .filter(({ index }) => index >= 4 && index <= 6)
      .sort((left, right) =>
        right.support - left.support || left.index - right.index,
      )[0]?.index ?? 5;
    const secondaryJoinIndex = clamp(
      Math.round(
        ((secondaryBandIndex + 0.5) / 8) * finalIndex,
      ),
      rejoinIndex + 2,
      finalIndex - 2,
    );
    const secondaryStartIndex = clamp(
      Math.round(finalIndex * 0.34),
      divergenceIndex + 2,
      secondaryJoinIndex - 2,
    );
    const secondaryStartHalfWidth = Math.max(
      12,
      Math.round(
        waterHalfWidths[secondaryJoinIndex] *
          internalHydrologyProfile.branchWidthScale *
          (0.64 + (directSupports[secondaryBandIndex] ?? 0.5) * 0.18),
      ),
    );
    const secondaryHalfWidths = buildNaturalWaterHalfWidths(
      COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
      branchRandom,
      {
        startHalfWidth: secondaryStartHalfWidth,
        endHalfWidth: Math.max(14, secondaryStartHalfWidth - 3),
      },
    );
    const secondaryStart = {
      x:
        WIDTH *
        internalHydrologyProfile
          .secondaryTributaryHeadwaterXFraction,
      y: centerline[secondaryStartIndex].y,
    };
    const secondaryEnd = structuredClone(
      centerline[secondaryJoinIndex],
    );
    const secondaryBranch =
      buildMeasurementDerivedAnonymousAnabranch({
        start: secondaryStart,
        end: secondaryEnd,
        width: WIDTH,
        coarseHydrologyProfile,
        internalHydrologyProfile: {
          ...internalHydrologyProfile,
          branchSide:
            internalHydrologyProfile.branchSide === "west"
              ? "east"
              : "west",
        },
        waterNaturalnessProfile,
        corridorHalfWidths: secondaryHalfWidths,
      });
    assert(
      secondaryBranch.naturalnessAudit.passed &&
        secondaryBranch.corridorShapeAudit.passed,
      "measurement-derived secondary headwater tributary audit failed",
    );
    connectedFingerCenterlines.push(secondaryBranch.points);
    connectedFingerHalfWidthProfiles.push(secondaryHalfWidths);
    connectedFingerWaterPolygons.push(
      ...buildVariableWidthCorridorPolygons(
        secondaryBranch.points,
        secondaryHalfWidths,
        WIDTH,
        HEIGHT,
      ),
    );
    connectedFingerShorelinePolygons.push(
      ...buildVariableWidthCorridorPolygons(
        secondaryBranch.points,
        secondaryHalfWidths.map((value) => value + 10),
        WIDTH,
        HEIGHT,
      ),
    );
  }
  if (
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "main_channel_connected_floodplain_backwater_finger"
  ) {
    const supportBandIndices =
      internalHydrologyProfile.backwaterSupportBandIndices ?? [];
    const directSupports =
      internalHydrologyProfile.measurementSupportStatistics
        ?.directBandSupports ?? [];
    const relativeSupports =
      internalHydrologyProfile.measurementSupportStatistics
        ?.relativeBandSupports ?? [];
    const relativeMean =
      internalHydrologyProfile.measurementSupportStatistics
        ?.relativeSupportMean ?? 0.5;
    for (
      let armIndex = 0;
      armIndex < supportBandIndices.length;
      armIndex += 1
    ) {
      const bandIndex = supportBandIndices[armIndex];
      const startIndex = clamp(
        Math.round(
          ((bandIndex + 0.5) / directSupports.length) * finalIndex,
        ),
        1,
        finalIndex - 2,
      );
      const startPoint = centerline[startIndex];
      const armSide =
        internalHydrologyProfile.branchSide === "west" ? -1 : 1;
      const armEnd = {
        x: WIDTH * (armSide < 0 ? 0.14 : 0.86),
        y: clamp(
          startPoint.y +
            HEIGHT *
              (relativeSupports[bandIndex] - relativeMean) *
              0.22,
          72,
          HEIGHT - 72,
        ),
      };
      const armStartHalfWidth = Math.max(
        14,
        Math.round(
          waterHalfWidths[startIndex] *
            internalHydrologyProfile.branchWidthScale *
            (0.58 + directSupports[bandIndex] * 0.16),
        ),
      );
      const armHalfWidths = buildNaturalWaterHalfWidths(
        COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
        branchRandom,
        {
          startHalfWidth: armStartHalfWidth,
          endHalfWidth: Math.max(12, armStartHalfWidth - 2),
        },
      );
      const arm = buildMeasurementDerivedAnonymousAnabranch({
        start: structuredClone(startPoint),
        end: armEnd,
        width: WIDTH,
        coarseHydrologyProfile,
        internalHydrologyProfile,
        waterNaturalnessProfile,
        corridorHalfWidths: armHalfWidths,
      });
      assert(
        arm.naturalnessAudit.passed &&
          arm.corridorShapeAudit.passed,
        "measurement-derived connected floodplain finger arm audit failed",
      );
      connectedFingerCenterlines.push(arm.points);
      connectedFingerHalfWidthProfiles.push(armHalfWidths);
      connectedFingerWaterPolygons.push(
        ...buildVariableWidthCorridorPolygons(
          arm.points,
          armHalfWidths,
          WIDTH,
          HEIGHT,
        ),
      );
      connectedFingerShorelinePolygons.push(
        ...buildVariableWidthCorridorPolygons(
          arm.points,
          armHalfWidths.map((value) => value + 10),
          WIDTH,
          HEIGHT,
        ),
      );
    }
  }
  const backwaterWaterPolygons = [];
  const backwaterShorelinePolygons = [];
  for (
    let basinIndex = 0;
    basinIndex <
    internalHydrologyProfile.backwaterBasinCount;
    basinIndex += 1
  ) {
    const centerIndex = clamp(
      Math.round(
        (branchCenterline.length - 1) *
          internalHydrologyProfile
            .backwaterBasinLongitudinalFractions[basinIndex],
      ),
      1,
      branchCenterline.length - 2,
    );
    const branchCenter = branchCenterline[centerIndex];
    const radiusX =
      WIDTH *
      internalHydrologyProfile.backwaterBasinRadiusXFraction *
      (internalHydrologyProfile.internalNetworkConnectionMode ===
      "two_separated_interior_headwater_tributaries_to_main_channel"
        ? 0.48
        : 1);
    const radiusY =
      HEIGHT *
      internalHydrologyProfile.backwaterBasinRadiusYFraction *
      (internalHydrologyProfile.internalNetworkConnectionMode ===
      "two_separated_interior_headwater_tributaries_to_main_channel"
        ? 0.48
        : 1);
    const backwaterDirection =
      internalHydrologyProfile.backwaterFloodplainSide === "west"
        ? -1
        : 1;
    const center = {
      x: clamp(
        branchCenter.x +
          backwaterDirection *
            radiusX *
            internalHydrologyProfile
              .backwaterCenterOffsetRadiusScale,
        0,
        WIDTH,
      ),
      y: branchCenter.y,
    };
    backwaterWaterPolygons.push(
      irregularEllipsePolygon(
        center.x,
        center.y,
        radiusX,
        radiusY,
        24,
        branchRandom,
      ),
    );
    backwaterShorelinePolygons.push(
      irregularEllipsePolygon(
        center.x,
        center.y,
        radiusX + 12,
        radiusY + 10,
        24,
        branchRandom,
      ),
    );
  }
  assert(
    branch.naturalnessAudit.passed &&
      branch.corridorShapeAudit.passed &&
      branchCenterline.length === branchHalfWidths.length,
    "measurement-derived anonymous floodplain anabranch audit failed",
  );
  return {
    branchCenterlines: [
      branchCenterline,
      ...connectedFingerCenterlines,
    ],
    branchHalfWidths: [
      branchHalfWidths,
      ...connectedFingerHalfWidthProfiles,
    ],
    waterPolygons: [
      ...branchWaterPolygons,
      ...connectedFingerWaterPolygons,
      ...backwaterWaterPolygons,
    ],
    shorelinePolygons: [
      ...branchShorelinePolygons,
      ...connectedFingerShorelinePolygons,
      ...backwaterShorelinePolygons,
    ],
    audit: {
      schemaVersion:
        "measurement-derived-anonymous-internal-hydrology-audit-v6",
      status: "passed",
      connectedFloodplainFingerArmCount:
        1 + connectedFingerCenterlines.length,
      passed: true,
      family: internalHydrologyProfile.family,
      measurementTopologyFingerprint:
        internalHydrologyProfile.measurementTopologyFingerprint,
      profileSha256: internalHydrologyProfile.profileSha256,
      branchCount:
        internalHydrologyProfile.internalNetworkConnectionMode ===
        "two_separated_interior_headwater_tributaries_to_main_channel"
          ? 2
          : 1,
      measurementSupportedSecondaryHeadwaterTributaryCount:
        internalHydrologyProfile.internalNetworkConnectionMode ===
        "two_separated_interior_headwater_tributaries_to_main_channel"
          ? 1
          : 0,
      backwaterBasinCount:
        internalHydrologyProfile.backwaterBasinCount,
      backwaterBasinLongitudinalFractions:
        structuredClone(
          internalHydrologyProfile
            .backwaterBasinLongitudinalFractions,
        ),
      backwaterFloodplainSide:
        internalHydrologyProfile.backwaterFloodplainSide,
      backwaterCenterOffsetRadiusScale:
        internalHydrologyProfile
          .backwaterCenterOffsetRadiusScale,
      divergenceIndex,
      rejoinIndex,
      branchCurveConstruction:
        internalHydrologyProfile.branchCurveConstruction,
      internalNetworkConnectionMode:
        internalHydrologyProfile
          .internalNetworkConnectionMode,
      tributaryHeadwaterXFraction:
        internalHydrologyProfile
          .tributaryHeadwaterXFraction,
      selectedLateralOffsetScales:
        branch.selectedLateralOffsetScales ?? null,
      eightBandAnabranchSelection:
        branch.selection ?? null,
      allEightCoarseBandsConsumed:
        coarseHydrologyProfile
          ? branch.selection
              ?.directEightBandSupportFractions?.length === 8
          : false,
      coarseHydrologyProfileSha256:
        coarseHydrologyProfile?.profileSha256 ?? null,
      branchNaturalnessAudit: branch.naturalnessAudit,
      branchCorridorShapeAudit: branch.corridorShapeAudit,
      connectivityPortsUsedAsBoundaryConstraintsOnly: true,
      retrySeedAffectsMacroTopology: false,
      exactMeasurementGeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
    },
  };
}

function buildMeasurementDerivedMonotonicAnabranch({
  start,
  end,
  branchDirection,
  lateralOffsetPixels,
  pointCount,
  waterNaturalnessProfile,
  preferredSinuosity,
  branchHalfWidths,
}) {
  assert(
    end.y > start.y &&
      [-1, 1].includes(branchDirection) &&
      pointCount >= 49 &&
      branchHalfWidths.length === pointCount,
    "measurement-derived monotonic anabranch inputs are invalid",
  );
  const candidates = [
    { firstControl: 0.55, secondControl: 0.55 },
    { firstControl: 0.68, secondControl: 0.68 },
    { firstControl: 0.8, secondControl: 0.8 },
    { firstControl: 0.92, secondControl: 0.92 },
    { firstControl: 1, secondControl: 1 },
    { firstControl: 1.08, secondControl: 1.08 },
    { firstControl: 1.5, secondControl: 0.8 },
    { firstControl: 1.5, secondControl: 1 },
    { firstControl: 1.8, secondControl: 0.6 },
    { firstControl: 1.8, secondControl: 0.8 },
  ].map((lateralOffsetScales) => {
    const firstControlOffset =
      branchDirection *
      lateralOffsetPixels *
      lateralOffsetScales.firstControl;
    const secondControlOffset =
      branchDirection *
      lateralOffsetPixels *
      lateralOffsetScales.secondControl;
    const control1 = {
      x: clamp(
        start.x +
          (end.x - start.x) * 0.3 +
          firstControlOffset,
        0,
        WIDTH,
      ),
      y: start.y + (end.y - start.y) * 0.3,
    };
    const control2 = {
      x: clamp(
        start.x +
          (end.x - start.x) * 0.7 +
          secondControlOffset,
        0,
        WIDTH,
      ),
      y: start.y + (end.y - start.y) * 0.7,
    };
    const points = Array.from(
      { length: pointCount },
      (_, index) => {
        const t = index / (pointCount - 1);
        const oneMinusT = 1 - t;
        return {
          x: Number(
            clamp(
              oneMinusT ** 3 * start.x +
                3 * oneMinusT ** 2 * t * control1.x +
                3 * oneMinusT * t ** 2 * control2.x +
                t ** 3 * end.x,
              0,
              WIDTH,
            ).toFixed(6),
          ),
          y: Number(
            clamp(
              oneMinusT ** 3 * start.y +
                3 * oneMinusT ** 2 * t * control1.y +
                3 * oneMinusT * t ** 2 * control2.y +
                t ** 3 * end.y,
              0,
              HEIGHT,
            ).toFixed(6),
          ),
        };
      },
    );
    points[0] = structuredClone(start);
    points[points.length - 1] = structuredClone(end);
    const downstreamBacktrackCount = points
      .slice(1)
      .filter(
        (point, index) => point.y < points[index].y,
      ).length;
    const naturalnessAudit = auditAnonymousWaterNaturalness(
      points,
      waterNaturalnessProfile,
    );
    const corridorShapeAudit =
      auditAnonymousWaterCorridorShape(
        points,
        branchHalfWidths,
      );
    return {
      points,
      naturalnessAudit,
      corridorShapeAudit,
      downstreamBacktrackCount,
      selectedLateralOffsetScales:
        structuredClone(lateralOffsetScales),
    };
  });
  const passing = candidates.filter(
    (candidate) =>
      candidate.downstreamBacktrackCount === 0 &&
      candidate.naturalnessAudit.passed &&
      candidate.corridorShapeAudit.passed,
  );
  assert(
    passing.length > 0,
    `measurement-derived monotonic anabranch could not satisfy the existing naturalness envelope: ${JSON.stringify(
      candidates.map((candidate) => ({
        selectedLateralOffsetScales:
          candidate.selectedLateralOffsetScales,
        downstreamBacktrackCount:
          candidate.downstreamBacktrackCount,
        naturalnessAudit: candidate.naturalnessAudit,
        corridorShapeAudit: candidate.corridorShapeAudit,
      })),
    )}`,
  );
  passing.sort(
    (left, right) =>
      Math.abs(
        left.naturalnessAudit.sinuosity -
          preferredSinuosity,
      ) -
      Math.abs(
        right.naturalnessAudit.sinuosity -
          preferredSinuosity,
      ),
  );
  return passing[0];
}

function buildMeasurementDrivenGrasslandForestCompositionArchitecture({
  assignment,
  random,
}) {
  assert(
    assignment.regionalLandscapeType ===
      "grassland-forest-transition" &&
      assignment.monsoonSeason === "wet_season",
    "the authorized composition architecture requires a wet-season grassland-forest transition measurement package",
  );
  const cover = assignment.metrics.reconstructedLandCoverRatio;
  const openMeadowPolygon = [
    { x: 188, y: 210 },
    { x: 410, y: 154 },
    { x: 596, y: 226 },
    { x: 706, y: 382 },
    { x: 612, y: 562 },
    { x: 402, y: 640 },
    { x: 196, y: 548 },
    { x: 126, y: 366 },
  ];
  const eastForestMass = [
    { x: 604, y: 82 },
    { x: 886, y: 62 },
    { x: 944, y: 210 },
    { x: 878, y: 360 },
    { x: 930, y: 540 },
    { x: 820, y: 682 },
    { x: 638, y: 628 },
    { x: 570, y: 492 },
    { x: 646, y: 344 },
    { x: 558, y: 202 },
  ];
  const southwestWoodland = [
    { x: 76, y: 414 },
    { x: 238, y: 356 },
    { x: 404, y: 438 },
    { x: 478, y: 586 },
    { x: 338, y: 704 },
    { x: 126, y: 678 },
  ];
  const northwestRecoveryBelt = [
    { x: 82, y: 72 },
    { x: 514, y: 66 },
    { x: 554, y: 176 },
    { x: 438, y: 286 },
    { x: 250, y: 250 },
    { x: 96, y: 304 },
  ];
  const drainageGrassSwale = [
    { x: 152, y: 486 },
    { x: 270, y: 438 },
    { x: 414, y: 456 },
    { x: 556, y: 510 },
    { x: 724, y: 492 },
    { x: 824, y: 534 },
    { x: 760, y: 594 },
    { x: 594, y: 576 },
    { x: 430, y: 530 },
    { x: 276, y: 522 },
  ];
  const bambooTransitionBelt = [
    { x: 108, y: 264 },
    { x: 238, y: 218 },
    { x: 382, y: 246 },
    { x: 492, y: 326 },
    { x: 420, y: 390 },
    { x: 268, y: 354 },
    { x: 140, y: 382 },
  ];
  const mudRegions = [
    [
      { x: 238, y: 486 },
      { x: 354, y: 468 },
      { x: 438, y: 490 },
      { x: 406, y: 520 },
      { x: 286, y: 516 },
    ],
    [
      { x: 594, y: 530 },
      { x: 710, y: 516 },
      { x: 770, y: 546 },
      { x: 694, y: 574 },
      { x: 610, y: 560 },
    ],
  ];
  const payload = {
    schemaVersion:
      "measurement-driven-complete-map-composition-architecture-v1",
    revision: V7_SLOT_COMPOSITION_REVISION,
    architectureType:
      "asymmetric_low_relief_wet_grassland_forest_mosaic_with_intermittent_drainage_swale",
    measurementBinding: {
      grasslandRatio: cover.grassland,
      treeCoverRatio: cover.treeCover,
      bareOrSparseRatio: cover.bareOrSparse,
      drainageLikelihoodRatio:
        assignment.metrics.drainageLikelihoodRatio,
      relativeRelief: assignment.metrics.relativeRelief,
      normalizedSlopeMean:
        assignment.metrics.normalizedSlope.mean,
      exactMeasurementGeometryCarriedForward: false,
    },
    openMeadowPolygon,
    tallGrassRegions: [drainageGrassSwale, bambooTransitionBelt],
    mudRegions,
    objectPlacementZones: [
      {
        zoneId: "east-dense-evergreen-mixed-forest",
        polygon: eastForestMass,
        targetShare: 0.4,
        kinds: ["tree", "tree", "tree", "shrub"],
        ecologyRole: "dry_evergreen_and_mixed_deciduous_forest_mass",
      },
      {
        zoneId: "southwest-open-dipterocarp-woodland",
        polygon: southwestWoodland,
        targetShare: 0.23,
        kinds: ["tree", "tree", "rock", "grass_detail"],
        ecologyRole: "dry_dipterocarp_open_woodland",
      },
      {
        zoneId: "northwest-bamboo-recovery-belt",
        polygon: northwestRecoveryBelt,
        targetShare: 0.2,
        kinds: ["tree", "shrub", "shrub", "grass_detail"],
        ecologyRole: "bamboo_reforestation_and_natural_transition",
      },
      {
        zoneId: "meadow-ecotone-detail",
        polygon: openMeadowPolygon,
        targetShare: 0.17,
        kinds: ["shrub", "grass_detail", "grass_detail", "rock"],
        ecologyRole: "wet_season_grassland_forest_ecotone",
      },
    ],
    ecologicalZones: [
      {
        kind: "wet_season_open_grassland_basin",
        role: "measured_grassland_primary_open_space",
        polygon: openMeadowPolygon,
      },
      {
        kind: "dry_evergreen_and_mixed_deciduous_forest_mass",
        role: "asymmetric_dense_forest_anchor",
        polygon: eastForestMass,
      },
      {
        kind: "dry_dipterocarp_open_woodland",
        role: "sparse_woodland_counterweight",
        polygon: southwestWoodland,
      },
      {
        kind: "bamboo_reforestation_natural_transition_belt",
        role: "layered_forest_grass_transition",
        polygon: northwestRecoveryBelt,
      },
      {
        kind: "intermittent_drainage_grass_swale_no_visible_water",
        role: "wet_season_drainage_readability_without_surface_water",
        polygon: drainageGrassSwale,
      },
    ],
    placementJitterEvidence: {
      consumedAnonymousRandomValue: Number(random().toFixed(8)),
      historicalLayoutRead: false,
      historicalRgbRead: false,
    },
  };
  return {
    ...payload,
    architectureSha256: canonicalSha256(payload),
  };
}

function buildMeasurementDrivenIndependentCompositionArchitecture({
  assignment,
  random,
}) {
  const cover = assignment.metrics.reconstructedLandCoverRatio;
  const landscapeType = assignment.regionalLandscapeType;
  const season = assignment.monsoonSeason;
  const landscapeKinds = compositionObjectKindsForLandscape(landscapeType);
  const anchorBands = [
    { minimumX: 118, maximumX: 408, minimumY: 92, maximumY: 306 },
    { minimumX: 562, maximumX: 892, minimumY: 86, maximumY: 318 },
    { minimumX: 116, maximumX: 430, minimumY: 430, maximumY: 674 },
    { minimumX: 574, maximumX: 900, minimumY: 424, maximumY: 680 },
  ];
  const rotationOffset = randomInt(0, anchorBands.length - 1, random);
  const zones = anchorBands.map((_, index) => {
    const band = anchorBands[(index + rotationOffset) % anchorBands.length];
    const centerX = randomInt(band.minimumX, band.maximumX, random);
    const centerY = randomInt(band.minimumY, band.maximumY, random);
    const radiusX = randomInt(142, 246, random);
    const radiusY = randomInt(104, 184, random);
    const vertexCount = randomInt(7, 13, random);
    return {
      zoneId: `measurement-cluster-${String(index + 1).padStart(2, "0")}`,
      polygon: irregularEllipsePolygon(
        centerX,
        centerY,
        radiusX,
        radiusY,
        vertexCount,
        random,
      ),
      targetShare: 0,
      kinds: landscapeKinds[index % landscapeKinds.length],
      ecologyRole: `${landscapeType.replaceAll("-", "_")}_${season}_cluster_${index + 1}`,
    };
  });
  const rawShares = zones.map(() => 0.7 + random() * 0.65);
  const shareTotal = rawShares.reduce((total, value) => total + value, 0);
  let assignedShare = 0;
  for (let index = 0; index < zones.length; index += 1) {
    zones[index].targetShare = index === zones.length - 1
      ? Number((1 - assignedShare).toFixed(6))
      : Number((rawShares[index] / shareTotal).toFixed(6));
    assignedShare += zones[index].targetShare;
  }
  const swaleCenterX = randomInt(270, 760, random);
  const swaleCenterY = randomInt(220, 570, random);
  const seasonalFloorRegions = [
    irregularEllipsePolygon(
      swaleCenterX,
      swaleCenterY,
      randomInt(118, 238, random),
      randomInt(42, 94, random),
      randomInt(8, 14, random),
      random,
    ),
    irregularEllipsePolygon(
      randomInt(180, 844, random),
      randomInt(140, 640, random),
      randomInt(78, 172, random),
      randomInt(48, 112, random),
      randomInt(7, 12, random),
      random,
    ),
  ];
  const exposedSoilRegions = [
    irregularEllipsePolygon(
      randomInt(170, 854, random),
      randomInt(120, 648, random),
      randomInt(38, 92, random),
      randomInt(20, 58, random),
      randomInt(6, 10, random),
      random,
    ),
  ];
  if (season === "dry_season" || season === "wet_to_dry_transition") {
    exposedSoilRegions.push(
      irregularEllipsePolygon(
        randomInt(150, 874, random),
        randomInt(120, 648, random),
        randomInt(34, 86, random),
        randomInt(18, 52, random),
        randomInt(6, 10, random),
        random,
      ),
    );
  }
  const payload = {
    schemaVersion:
      "measurement-driven-complete-map-composition-architecture-v1",
    revision: V7_SLOT_COMPOSITION_REVISION,
    architectureType:
      `independent_${landscapeType.replaceAll("-", "_")}_${season}_measurement_mosaic`,
    measurementBinding: {
      measurementWindowId: assignment.measurementWindowId,
      measurementFingerprint: assignment.fingerprints.direct,
      grasslandRatio: cover.grassland,
      treeCoverRatio: cover.treeCover,
      bareOrSparseRatio: cover.bareOrSparse,
      drainageLikelihoodRatio: assignment.metrics.drainageLikelihoodRatio,
      relativeRelief: assignment.metrics.relativeRelief,
      normalizedSlopeMean: assignment.metrics.normalizedSlope.mean,
      exactMeasurementGeometryCarriedForward: false,
    },
    openMeadowPolygon: zones[rotationOffset % zones.length].polygon,
    tallGrassRegions: seasonalFloorRegions,
    mudRegions: exposedSoilRegions,
    objectPlacementZones: zones,
    ecologicalZones: zones.map((zone, index) => ({
      kind: `${landscapeType.replaceAll("-", "_")}_${season}_mosaic_${index + 1}`,
      role: zone.ecologyRole,
      polygon: structuredClone(zone.polygon),
    })),
    placementJitterEvidence: {
      consumedAnonymousRandomValue: Number(random().toFixed(8)),
      historicalLayoutRead: false,
      historicalRgbRead: false,
      mirrorOrRotationTemplateUsed: false,
    },
  };
  return {
    ...payload,
    architectureSha256: canonicalSha256(payload),
  };
}

function applyFullWorldDynamicReadinessToComposition({
  architecture,
  assignment,
  connectivityBlueprint,
}) {
  const { architectureSha256: _previousArchitectureSha256, ...base } =
    architecture;
  const payload = {
    ...base,
    revision: THAILAND_REBUILD64_FULL_WORLD_DYNAMIC_READINESS_REVISION,
    worldFrameContract: buildFullWorldDynamicReadinessContract({
      assignment,
      connectivityBlueprint,
    }),
  };
  return {
    ...payload,
    architectureSha256: canonicalSha256(payload),
  };
}

function buildFullWorldDynamicReadinessContract({
  assignment,
  connectivityBlueprint,
}) {
  const pathConnection = currentPathBoundaryConnection(connectivityBlueprint);
  return {
    contractVersion:
      "complete-rectangular-world-and-future-dynamic-readiness-v2",
    appliesToAllThailandRebuild64Slots: true,
    staticRgbRole:
      "local_model_positive_target_and_future_game_world_visual_baseline",
    frameCoverage: {
      width: WIDTH,
      height: HEIGHT,
      everyPixelMustResolveToInWorldSurfaceOrInWorldObject: true,
      continuousWorldSurfaceMustFillRectangleEdgeToEdge: true,
      alphaOrTransparentVoidAllowed: false,
      externalBackdropAllowed: false,
      solidColorMatteAllowed: false,
      floatingMapOrIslandCutoutAllowed: false,
      decorativePolygonMapEdgeAllowed: false,
      naturalBoundaryMeaning:
        "dense_in_world_edge_ecology_or_collision_inside_the_rectangular_world_never_outside_void",
    },
    boundaryConnectivity: {
      pathBoundarySide: pathConnection.boundarySide,
      pathBoundaryPosition: structuredClone(pathConnection.boundaryPosition),
      routeMustVisiblyTouchContractSide: true,
      horizontalOrVerticalMirrorAllowed: false,
      uncontractedVisualEntranceAllowed: false,
      continuityMeaning:
        "the_edge_contact_is_a_region_graph_connection_not_a_decorative_road_end",
    },
    semanticDecomposition: {
      authoritativeConditionChannelCount: 23,
      source: "worldfacts_plus_23_channels_plus_object_footprints",
      terrainSurfaceCoverageRequired: true,
      walkableCollisionAndObjectIdentityRequired: true,
      futureRuntimeMotionReserved: true,
      bakedBackdropOrBakedMapCutoutForbidden: true,
      currentMilestoneRemainsStatic: true,
    },
    uniqueness: {
      compareAll64ThemeArchitectureAndInstanceDetail: true,
      compareRouteHydrologyEcologicalPartitionsBoundaryAndObjectClusters: true,
      copyMirrorRotateOrSharedMacroTemplateAllowed: false,
    },
    landscapeType: assignment.regionalLandscapeType,
    monsoonSeason: assignment.monsoonSeason,
  };
}

function compositionObjectKindsForLandscape(landscapeType) {
  const profiles = {
    "bamboo-grove": [
      ["shrub", "shrub", "tree", "grass_detail"],
      ["tree", "shrub", "grass_detail", "grass_detail"],
      ["shrub", "tree", "rock", "grass_detail"],
      ["tree", "shrub", "shrub", "rock"],
    ],
    "dry-dipterocarp-woodland": [
      ["tree", "rock", "grass_detail", "grass_detail"],
      ["tree", "tree", "rock", "shrub"],
      ["rock", "grass_detail", "shrub", "tree"],
      ["tree", "grass_detail", "grass_detail", "rock"],
    ],
    "grassland-forest-transition": [
      ["grass_detail", "grass_detail", "shrub", "rock"],
      ["tree", "tree", "shrub", "grass_detail"],
      ["tree", "grass_detail", "rock", "shrub"],
      ["shrub", "grass_detail", "grass_detail", "tree"],
    ],
    "wet-season-drainage-hollow": [
      ["grass_detail", "shrub", "grass_detail", "rock"],
      ["tree", "shrub", "grass_detail", "grass_detail"],
      ["shrub", "tree", "rock", "grass_detail"],
      ["grass_detail", "shrub", "tree", "rock"],
    ],
  };
  return profiles[landscapeType] ?? [
    ["tree", "tree", "shrub", "grass_detail"],
    ["tree", "rock", "shrub", "grass_detail"],
    ["tree", "tree", "rock", "grass_detail"],
    ["shrub", "tree", "grass_detail", "rock"],
  ];
}

function buildSlotEcologicalZones({
  conditionId,
  assignment,
  hasWater,
  compositionArchitecture = null,
}) {
  const targetSystem = landscapeTypeToEcosystem(
    assignment.regionalLandscapeType,
  );
  return [
    {
      zoneId: `${conditionId}-primary-ecology`,
      kind: targetSystem,
      role: "regional_landscape_primary_zone",
    },
    {
      zoneId: `${conditionId}-layered-natural-boundary`,
      kind: "layered_tropical_forest_boundary",
      role: "complete_map_natural_boundary",
    },
    {
      zoneId: `${conditionId}-seasonal-transition-floor`,
      kind: `${assignment.monsoonSeason}_forest_floor`,
      role: "seasonal_moisture_readability",
    },
    {
      zoneId: `${conditionId}-relief-transition`,
      kind: "measured_lowland_foothill_relief_transition",
      role: "terrain_depth_and_multi_zone_readability",
    },
    ...(compositionArchitecture?.ecologicalZones ?? []).map(
      (zone, index) => ({
        zoneId: `${conditionId}-composition-zone-${String(index + 1).padStart(2, "0")}`,
        ...structuredClone(zone),
      }),
    ),
    ...(hasWater
      ? [
          {
            zoneId: `${conditionId}-defined-hydrology`,
            kind: "world_fact_defined_freshwater_system",
            role: "complete_map_hydrology_zone",
          },
        ]
      : []),
  ];
}

function landscapeRequiresVisibleWater(type) {
  return /riparian|river|floodplain|swamp|marsh|pond|creek|stream|drainage|riverbank/.test(
    type,
  );
}

function landscapeTypeToEcosystem(type) {
  const mapping = {
    "seasonal-evergreen-semi-evergreen-forest":
      "seasonal_evergreen_or_semi_evergreen_forest",
    "lowland-evergreen-tropical-forest":
      "lowland_tropical_evergreen_forest",
    "moist-deciduous-teak-forest": "moist_deciduous_forest",
    "dry-dipterocarp-woodland":
      "dry_dipterocarp_forest_or_woodland",
    "bamboo-grove": "bamboo_grove",
    "riparian-tropical-forest": "riparian_forest",
    "monsoon-grassland": "monsoon_grassland",
    "river-floodplain": "river_floodplain",
    "freshwater-swamp": "freshwater_swamp",
    "reed-marsh": "reed_marsh",
    "limestone-foothill": "limestone_foothill",
    "forested-low-mountain": "forested_low_mountain",
  };
  return mapping[type] ?? type.replaceAll("-", "_");
}

function applyV7SlotBlueprintContext(blueprint, slotContext) {
  if (!slotContext) return;
  const assignment = slotContext.assignment;
  blueprint.status = "v7_slot_complete_map_world_facts_ready_rgb_missing";
  blueprint.split = assignment.split;
  blueprint.sourceMode =
    "bounded_real_measurement_window_plus_independent_region_source_and_connectivity";
  blueprint.landscapeType = assignment.regionalLandscapeType;
  blueprint.environmentContext = {
    contractVersion: "world-visual-environment-context-v1",
    ...structuredClone(slotContext.snapshot.environment),
    habitatMoistureClass: slotContext.snapshot.environment.groundMoisture,
    sourceSnapshotId: slotContext.snapshot.snapshotId,
    sourceSnapshotPath: slotContext.snapshotPath,
    sourceRecordClassificationUsed: true,
  };
  blueprint.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: assignment.split,
    coverageRole: assignment.coverageRole,
    measurementWindowPlanRunId: slotContext.planRunId,
    measurementWindowPlanPath: slotContext.planPath,
    candidateId: assignment.candidateId,
    directFingerprint: assignment.fingerprints.direct,
    anonymousCompositionArchitectureRevision:
      V7_SLOT_COMPOSITION_REVISION ?? null,
    exactRealWorldGeometryCarriedForward: false,
    sourcePixelWindowCarriedIntoGameGeometry: false,
  };
  blueprint.semanticRules.waterPolicy = blueprint.geometry.hasWater
    ? "visible_water_required_by_current_landscape_world_facts"
    : "no_major_visible_water_required_by_current_landscape_world_facts";
}

function applyV7SlotDirectorContext(director, slotContext, geometry) {
  if (!slotContext) return;
  const assignment = slotContext.assignment;
  const environment = slotContext.snapshot.environment;
  const requiredStructure = [
    "entrance",
    "main_path",
    "natural_boundary",
    "multiple_ecological_zones",
    ...(geometry.hasWater ? ["defined_world_fact_water_system"] : []),
  ];
  director.sceneIntent.mainStory =
    `A complete de-identified ${assignment.regionalLandscapeType} natural region for the ${assignment.monsoonSeason} season, derived from aggregate measurements, the approved regional ecology profile, and new anonymous game coordinates.`;
  director.sceneIntent.mustShow = requiredStructure;
  director.compositionPlan.readOrder = requiredStructure;
  director.compositionPlan.layoutIntent =
    `${geometry.routeTopology}_with_multiple_ecological_zones_without_preset_site`;
  director.terrainPlan.terrainKinds = [
    ...new Set(geometry.terrainRegions.map((entry) => entry.kind)),
  ];
  director.terrainPlan.terrainTransitions = [
    "grass_to_path",
    "object_to_ground",
    ...(geometry.hasWater
      ? ["grass_to_water", "shoreline_to_water"]
      : []),
  ];
  director.terrainPlan.waterEdgeRules = geometry.hasWater
    ? ["continuous_natural_shoreline", "world_fact_water_readability"]
    : [];
  director.materialRecipePlan.requiredMaterials = [
    "seasonal_tropical_ground",
    "dirt_path",
    "stone",
    "vegetation_detail",
    ...(geometry.hasWater ? ["freshwater", "shoreline_soil"] : []),
  ];
  director.singleMapEcologyPlan = {
    landscapeType: assignment.regionalLandscapeType,
    moisture: environment.groundMoisture,
    vegetationDensity: "regional_profile_with_readable_passage",
    snapshotId: slotContext.snapshot.snapshotId,
    season: assignment.monsoonSeason,
    environmentState: environment.environmentState ?? environment.monsoonPhase,
    groundMoisture: environment.groundMoisture,
    requiredFeatures: geometry.ecologicalZones.map((entry) => entry.zoneId),
    optionalFeatures: [],
  };
  director.singleMapMaterialPlan = {
    palette: "mainland_southeast_asia_tropical_monsoon_natural_home",
    season: assignment.monsoonSeason,
    environmentState: environment.environmentState ?? environment.monsoonPhase,
    weather: environment.weather,
    lighting: environment.lighting,
    groundMoisture: environment.groundMoisture,
  };
  director.compositionRecipePlan.readOrder = requiredStructure;
  director.singleMapCompositionPlan.routeIntent = geometry.routeTopology;
  director.generationTaskDraft.requiredParts = requiredStructure;
  director.fixPlanInput.source =
    "bounded_real_measurement_window_regional_profile_and_season_snapshot";
  director.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: assignment.split,
    measurementWindowPlanRunId: slotContext.planRunId,
    candidateId: assignment.candidateId,
  };
}

function applyV7SlotVisualFactContext(visualFacts, slotContext) {
  if (!slotContext) return;
  visualFacts.status = "v7_slot_complete_map_visual_facts_passed";
  visualFacts.worldSignals.biomeType =
    slotContext.assignment.regionalLandscapeType;
  visualFacts.worldSignals.moistureLevel =
    slotContext.snapshot.environment.groundMoisture;
  visualFacts.worldSignals.vegetationDensity =
    "regional_profile_with_readable_passage";
  visualFacts.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: slotContext.assignment.split,
    candidateId: slotContext.assignment.candidateId,
  };
}

function applyV7SlotTaskContext(task, slotContext) {
  if (!slotContext) return;
  const assignment = slotContext.assignment;
  task.status = "v7_slot_complete_map_task_ready_rgb_authorization_required";
  task.sourceBindings.sourceMode =
    "bounded_real_measurement_window_plus_independent_region_source_and_connectivity";
  task.sourceBindings.measurementWindowPlanPath = slotContext.planPath;
  task.sourceBindings.measurementWindowPlanSha256 = slotContext.planSha256;
  task.sourceBindings.seasonSnapshotPath = slotContext.snapshotPath;
  task.sourceBindings.seasonSnapshotSha256 = sha256File(
    path.join(ROOT, slotContext.snapshotPath),
  );
  task.sourceBindings.regionalProfilePath = WORLD_PROFILE_PATH;
  task.sourceBindings.regionalProfileSha256 = sha256File(
    path.join(ROOT, WORLD_PROFILE_PATH),
  );
  task.sourceBindings.factualReferenceSha256 = sha256File(
    path.join(ROOT, FACTUAL_REFERENCE_PATH),
  );
  task.drawingProcess.spatialBlockoutSource =
    "new_anonymous_game_coordinate_geometry_from_bounded_measurement_aggregates";
  task.v7SlotBinding = {
    slotId: V7_SLOT_ID,
    split: assignment.split,
    regionalLandscapeType: assignment.regionalLandscapeType,
    monsoonSeason: assignment.monsoonSeason,
    candidateId: assignment.candidateId,
    measurementFingerprint: assignment.fingerprints.direct,
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
  connectivityBlueprint,
  connectivityBlueprintPath,
  realEarthRegionSourcePackage,
  realEarthRegionSourcePackagePath,
  structuralIdentities,
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
    worldFrameContract: geometry.worldFrameContract,
    sourceMode:
      "bounded_real_measurement_window_plus_independent_region_source_and_connectivity",
    taskId,
    worldId,
    tick: 0,
    worldProfileId: WORLD_PROFILE_ID,
    earthParameterSnapshotId: worldFacts.worldFactSetId,
    earthParameterSnapshotPath: worldFactRun.worldFactsPath,
    factualReferenceId: "sakaerat-wang-nam-khiao-mvp-reference-v1",
    factualReferencePath: FACTUAL_REFERENCE_PATH,
    connectivityContractId: "natural-home-large-world-connectivity-v1",
    connectivityBlueprintId: connectivityBlueprint.blueprintId,
    connectivityBlueprintPath,
    regionId: connectivityBlueprint.currentRegion.regionId,
    realEarthRegionId:
      realEarthRegionSourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId:
      realEarthRegionSourcePackage.packageId,
    realEarthRegionSourcePackagePath,
    realEarthRegionSourcePackageSha256:
      realEarthRegionSourcePackage.packageSha256,
    structuralIdentities,
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
      waterFlow: geometry.hasWater
        ? "current_world_fact_internal_hydrology_without_invented_boundary_direction"
        : "no_major_visible_water_required_by_current_world_facts",
      routeIntent:
        `${connectivityBlueprint.anonymousTrainingCoordinateProjection.pathPlan.boundarySide}_boundary_natural_passage_without_preset_home_site_or_convergence_platform`,
      siteSelectionPolicy: "initial_natural_world_no_preset_home_site",
      focalAreaPolicy: "inactive_all_zero_compatibility_channel",
      camera: "top_down_slight_three_quarter_2d",
      style: "native_1024x768_high_resolution_pixel_game_map",
      geometryOrigin:
        "new_deidentified_game_coordinates_from_current_region_source_package_and_independent_connectivity_instance",
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
        "region_0001_concrete_connectivity_instance_reuse",
        "cross_region_source_fact_reuse",
        "theme_architecture_reuse",
        "instance_detail_reuse",
        "external_background",
        "solid_color_matte",
        "floating_map_or_island_cutout",
        "decorative_polygon_map_edge",
        "route_boundary_side_mismatch",
        "baked_non_world_pixels",
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
      dynamicReadinessSource:
        "worldfacts_23_channels_walkable_collision_and_object_footprints",
      bakedBackdropForbidden: true,
      everyPixelMustRemainWorldAddressable: true,
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
        "external_background",
        "solid_color_matte",
        "floating_map_or_island_cutout",
        "decorative_polygon_map_edge",
        "route_boundary_side_mismatch",
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
        sourceType: "current_region_independent_connectivity_instance",
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
  connectivityBlueprintPath,
  realEarthRegionSourcePackage,
  realEarthRegionSourcePackagePath,
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
      sourceMode:
        "bounded_real_measurement_window_plus_independent_region_source_and_connectivity",
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
      connectivityBlueprintPath,
      realEarthRegionId:
        realEarthRegionSourcePackage.identity.realEarthRegionId,
      realEarthRegionSourcePackageId:
        realEarthRegionSourcePackage.packageId,
      realEarthRegionSourcePackagePath,
      realEarthRegionSourcePackageSha256:
        realEarthRegionSourcePackage.packageSha256,
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
      frameCoverage:
        "continuous_in_world_surface_fills_the_1024x768_rectangle_edge_to_edge",
      externalBackdrop: "forbidden",
    },
    worldFrameContract: geometry.worldFrameContract,
    dynamicReadiness: {
      currentOutput: "static_rgb_world_baseline",
      futureRuntimeMotionReserved: true,
      semanticSource:
        "worldfacts_23_channels_walkable_collision_and_object_footprints",
      everyPixelWorldAddressable: true,
      backgroundVoidAllowed: false,
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
      "external_background",
      "solid_color_matte",
      "floating_map_or_island_cutout",
      "decorative_polygon_map_edge",
      "route_boundary_side_mismatch",
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

function placeObjectsByCompositionArchitecture({
  conditionId,
  random,
  forbiddenMasks,
  targetCount,
  architecture,
}) {
  const objects = [];
  const zones = architecture.objectPlacementZones;
  const allocatedCounts = [];
  let allocated = 0;
  for (let index = 0; index < zones.length; index += 1) {
    const count = index === zones.length - 1
      ? targetCount - allocated
      : Math.max(1, Math.round(targetCount * zones[index].targetShare));
    allocatedCounts.push(count);
    allocated += count;
  }
  assert(
    allocatedCounts.reduce((total, value) => total + value, 0) ===
      targetCount,
    "composition object allocation does not match measured target count",
  );
  for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex += 1) {
    const zone = zones[zoneIndex];
    const target = allocatedCounts[zoneIndex];
    const bounds = polygonBoundingBox(zone.polygon);
    let placed = 0;
    let attempts = 0;
    while (placed < target && attempts < target * 360) {
      attempts += 1;
      const kind = zone.kinds[Math.floor(random() * zone.kinds.length)];
      const width = kind === "tree"
        ? randomInt(20, 36, random)
        : randomInt(10, 24, random);
      const height = kind === "tree"
        ? randomInt(20, 34, random)
        : randomInt(8, 22, random);
      const footprint = {
        x: randomInt(
          Math.max(12, Math.ceil(bounds.minimumX)),
          Math.min(WIDTH - width - 12, Math.floor(bounds.maximumX - width)),
          random,
        ),
        y: randomInt(
          Math.max(12, Math.ceil(bounds.minimumY)),
          Math.min(HEIGHT - height - 12, Math.floor(bounds.maximumY - height)),
          random,
        ),
        width,
        height,
      };
      const center = {
        x: footprint.x + footprint.width / 2,
        y: footprint.y + footprint.height / 2,
      };
      if (!pointInPolygon(center, zone.polygon)) continue;
      if (
        forbiddenMasks.some((polygon) =>
          boundsTouchesPolygon(footprint, polygon),
        )
      ) {
        continue;
      }
      if (
        objects.some((entry) =>
          boundsOverlap(expandBounds(footprint, 10), entry.footprint),
        )
      ) {
        continue;
      }
      objects.push({
        objectId: `${conditionId}:object:${String(objects.length + 1).padStart(3, "0")}`,
        kind,
        footprint,
        blocksMovement: ["tree", "rock"].includes(kind),
        source:
          "measurement_driven_composition_architecture_object_cluster",
        compositionZoneId: zone.zoneId,
        ecologyRole: zone.ecologyRole,
      });
      placed += 1;
    }
    let compactFallbackAttempts = 0;
    while (placed < target && compactFallbackAttempts < target * 720) {
      compactFallbackAttempts += 1;
      const fallbackKind = zone.kinds.includes("grass_detail")
        ? "grass_detail"
        : zone.kinds.find((kind) => !["tree", "rock"].includes(kind)) ??
          zone.kinds[0];
      const width = ["tree", "rock"].includes(fallbackKind)
        ? randomInt(16, 24, random)
        : randomInt(7, 14, random);
      const height = ["tree", "rock"].includes(fallbackKind)
        ? randomInt(16, 24, random)
        : randomInt(6, 13, random);
      const footprint = {
        x: randomInt(
          Math.max(8, Math.ceil(bounds.minimumX)),
          Math.min(WIDTH - width - 8, Math.floor(bounds.maximumX - width)),
          random,
        ),
        y: randomInt(
          Math.max(8, Math.ceil(bounds.minimumY)),
          Math.min(HEIGHT - height - 8, Math.floor(bounds.maximumY - height)),
          random,
        ),
        width,
        height,
      };
      const center = {
        x: footprint.x + footprint.width / 2,
        y: footprint.y + footprint.height / 2,
      };
      if (!pointInPolygon(center, zone.polygon)) continue;
      if (
        forbiddenMasks.some((polygon) =>
          boundsTouchesPolygon(footprint, polygon),
        )
      ) {
        continue;
      }
      if (
        objects.some((entry) =>
          boundsOverlap(expandBounds(footprint, 4), entry.footprint),
        )
      ) {
        continue;
      }
      objects.push({
        objectId: `${conditionId}:object:${String(objects.length + 1).padStart(3, "0")}`,
        kind: fallbackKind,
        footprint,
        blocksMovement: ["tree", "rock"].includes(fallbackKind),
        source:
          "measurement_driven_composition_architecture_compact_zone_fallback",
        compositionZoneId: zone.zoneId,
        ecologyRole: zone.ecologyRole,
      });
      placed += 1;
    }
    assert(
      placed === target,
      `unable to place composition-zone objects for ${zone.zoneId}: ${placed}/${target}`,
    );
  }
  return objects;
}

function polygonBoundingBox(polygon) {
  return {
    minimumX: Math.min(...polygon.map((point) => point.x)),
    maximumX: Math.max(...polygon.map((point) => point.x)),
    minimumY: Math.min(...polygon.map((point) => point.y)),
    maximumY: Math.max(...polygon.map((point) => point.y)),
  };
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

function buildVariableWidthCorridorPolygons(
  points,
  halfWidths,
  width,
  height,
) {
  assert(
    points.length >= 2 && halfWidths.length === points.length,
    "variable-width corridor inputs are invalid",
  );
  const polygons = points.map((point, index) =>
    circlePolygon(
      point,
      halfWidths[index],
      20,
      width,
      height,
    ),
  );
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const startWidth = halfWidths[index];
    const endWidth = halfWidths[index + 1];
    const corridorPolygon = convexHull([
      {
        x: clamp(Math.round(start.x + nx * startWidth), 0, width),
        y: clamp(Math.round(start.y + ny * startWidth), 0, height),
      },
      {
        x: clamp(Math.round(end.x + nx * endWidth), 0, width),
        y: clamp(Math.round(end.y + ny * endWidth), 0, height),
      },
      {
        x: clamp(Math.round(end.x - nx * endWidth), 0, width),
        y: clamp(Math.round(end.y - ny * endWidth), 0, height),
      },
      {
        x: clamp(Math.round(start.x - nx * startWidth), 0, width),
        y: clamp(Math.round(start.y - ny * startWidth), 0, height),
      },
    ]);
    if (corridorPolygon.length >= 3) {
      polygons.push(corridorPolygon);
    }
  }
  return polygons;
}

function circlePolygon(center, radius, sides, width, height) {
  return convexHull(
    Array.from({ length: sides }, (_, index) => {
      const angle = (Math.PI * 2 * index) / sides;
      return {
        x: clamp(
          Math.round(center.x + Math.cos(angle) * radius),
          0,
          width,
        ),
        y: clamp(
          Math.round(center.y + Math.sin(angle) * radius),
          0,
          height,
        ),
      };
    }),
  );
}

function convexHull(points) {
  const unique = [
    ...new Map(
      points.map((point) => [`${point.x},${point.y}`, point]),
    ).values(),
  ].sort((left, right) => left.x - right.x || left.y - right.y);
  if (unique.length <= 2) return unique;
  const cross = (origin, left, right) =>
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x);
  const lower = [];
  for (const point of unique) {
    while (
      lower.length >= 2 &&
      cross(lower.at(-2), lower.at(-1), point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper = [];
  for (const point of [...unique].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper.at(-2), upper.at(-1), point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
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

function pointsEqual(left, right, tolerance = 1e-6) {
  return (
    Math.abs(left.x - right.x) <= tolerance &&
    Math.abs(left.y - right.y) <= tolerance
  );
}

function polygonsOverlap(left, right) {
  if (
    left.some((point) => pointInPolygon(point, right)) ||
    right.some((point) => pointInPolygon(point, left))
  ) {
    return true;
  }
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex];
    const leftEnd = left[(leftIndex + 1) % left.length];
    for (
      let rightIndex = 0;
      rightIndex < right.length;
      rightIndex += 1
    ) {
      const rightStart = right[rightIndex];
      const rightEnd = right[(rightIndex + 1) % right.length];
      if (
        lineSegmentsIntersect(
          leftStart,
          leftEnd,
          rightStart,
          rightEnd,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function minimumPolygonXAtY(polygons, targetY) {
  let minimumX = Number.POSITIVE_INFINITY;
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if (start.y === end.y) {
        if (targetY === start.y) {
          minimumX = Math.min(
            minimumX,
            start.x,
            end.x,
          );
        }
        continue;
      }
      const minimumY = Math.min(start.y, end.y);
      const maximumY = Math.max(start.y, end.y);
      if (targetY < minimumY || targetY > maximumY) continue;
      const t =
        (targetY - start.y) / (end.y - start.y);
      const x = start.x + (end.x - start.x) * t;
      minimumX = Math.min(minimumX, x);
    }
  }
  assert(
    Number.isFinite(minimumX),
    `anonymous water has no horizontal occupancy at y=${targetY}`,
  );
  return minimumX;
}

function polygonTouchesCanvasEdge(polygon, edge) {
  if (edge === "top") return polygon.some((point) => point.y === 0);
  if (edge === "right") {
    return polygon.some((point) => point.x === WIDTH);
  }
  if (edge === "bottom") {
    return polygon.some((point) => point.y === HEIGHT);
  }
  if (edge === "left") return polygon.some((point) => point.x === 0);
  return false;
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

function valueFor(flag) {
  const inline = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function loadV7SlotContext(slotId) {
  const slotNumber = Number(
    /^v7-capacity-slot-(\d{3})$/.exec(slotId)?.[1],
  );
  assert(
    Number.isInteger(slotNumber) &&
      slotNumber >= 146 &&
      slotNumber <= 209,
    `V7 slot is outside the authorized 146-209 rebuild range: ${slotId}`,
  );
  const config = readJson(
    path.join(
      ROOT,
      "ml",
      "ai-painter",
      "config",
      "complete-world-ai-assisted-cold-start-v7.json",
    ),
  );
  const authorization =
    config.training?.dataCapacityDecision?.boundedDataBuildAuthorization;
  assert(
    authorization?.authorizationId ===
      "owner-authorized-isolate-legacy40-and-rebuild-thailand-mvp64-20260729",
    "V7 bounded data-build authorization identity mismatch",
  );
  assert(
    authorization.status === "authorized_data_preparation_only" &&
      authorization.conditionPackagePreparationAuthorized === true &&
      authorization.imageGenerationAuthorized === false &&
      authorization.gpuTrainingAuthorized === false &&
      authorization.runtimeFrameAuthorized === false &&
      authorization.worldEntryAuthorized === false,
    "V7 bounded authorization does not permit this no-RGB condition build",
  );

  const latest = readJson(
    path.join(
      ROOT,
      ".runtime",
      "ai-painter",
      "earth-geospatial-v7-mvp-window-plans",
      "latest.json",
    ),
  );
  const plan = readJson(path.join(ROOT, latest.runPath));
  const rawAssignment = (plan.assignments ?? []).find(
    (entry) => entry.slotId === slotId,
  );
  const sequenceRegistry = readJson(path.join(
    ROOT,
    "data",
    "ai-painter",
    "system-governance",
    "thailand-rebuild64-sequence-registry-v1.json",
  ));
  const sequenceEntry = sequenceRegistry.entries?.find(
    (entry) => entry.legacyCapacitySlotId === slotId,
  );
  const assignment = rawAssignment
    ? {
        ...normalizeV7WindowAssignment(rawAssignment),
        requiredEntranceDirection: sequenceEntry?.entranceDirection,
      }
    : null;
  assert(assignment, `V7 slot assignment is missing: ${slotId}`);
  assert(
    ["north", "east", "south", "west"].includes(
      assignment.requiredEntranceDirection,
    ),
    `V7 slot registered entrance direction is missing: ${slotId}`,
  );
  assert(
    assignment.regionalLandscapeTypeStatus ===
      "derived_from_current_window_world_facts_and_ecology" &&
      typeof assignment.regionalLandscapeType === "string",
    `V7 slot world-fact ecology derivation is incomplete: ${slotId}`,
  );
  assert(
    assignment.imageGenerationAuthorized === false &&
      assignment.gpuTrainingAuthorized === false,
    "V7 slot assignment crossed the RGB or GPU gate",
  );

  const snapshotPaths = {
    wet_season:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-v2.json",
    wet_to_dry_transition:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-wet-to-dry-transition-v1.json",
    dry_season:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-late-dry-season-v1.json",
    dry_to_wet_transition:
      "data/world-samples/original-image-library/natural-home-v1/provisional-visual-snapshot-dry-to-wet-transition-v1.json",
  };
  const snapshotPath = snapshotPaths[assignment.monsoonSeason];
  assert(snapshotPath, `season snapshot is missing: ${assignment.monsoonSeason}`);
  const snapshot = readJson(path.join(ROOT, snapshotPath));
  assert(
    snapshot.environment?.season === assignment.monsoonSeason,
    "season snapshot identity mismatch",
  );

  const worldProfile = readJson(
    path.join(
      ROOT,
      "data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json",
    ),
  );
  const factualReference = readJson(
    path.join(
      ROOT,
      "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json",
    ),
  );
  assert(
    worldProfile.worldProfileId ===
      "mainland-southeast-asia-tropical-monsoon-natural-home-v1" &&
      factualReference.parentWorldProfileId === worldProfile.worldProfileId,
    "regional profile or factual-reference identity mismatch",
  );
  assert(
    worldProfile.ecosystemFramework?.included?.length > 0 &&
      factualReference.mvpVisualBoundary?.completeMapRequirement,
    "regional ecology evidence is incomplete",
  );

  return {
    authorizationId: authorization.authorizationId,
    runtimeRoot:
      ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs",
    planRunId: plan.runId,
    planPath: latest.runPath,
    planSha256: sha256File(path.join(ROOT, latest.runPath)),
    assignment,
    snapshotPath,
    snapshot,
    worldProfile,
    factualReference,
  };
}

function normalizeV7WindowAssignment(assignment) {
  return {
    ...assignment,
    candidateId:
      assignment.candidateId ?? assignment.measurementWindowId,
    metrics:
      assignment.metrics ?? assignment.measurementMetrics,
    fingerprints:
      assignment.fingerprints ?? assignment.measurementFingerprints,
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
