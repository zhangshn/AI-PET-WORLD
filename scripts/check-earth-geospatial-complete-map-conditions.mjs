import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { catalogPath } from "./lib/ai-pet-world-storage.mjs";
import { auditAnonymousRouteNaturalness } from "./lib/anonymous-route-naturalness.mjs";
import {
  auditAnonymousWaterCorridorShape,
  auditAnonymousWaterNaturalness,
} from "./lib/anonymous-water-naturalness.mjs";
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
  MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs";
import {
  COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
  buildMeasurementDerivedCoarseHydrologyProfile,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import {
  buildIndependentTrainingRegionConnectivity,
  buildRealEarthRegionSourcePackage,
} from "./lib/real-earth-region-governance.mjs";

const ROOT = process.cwd();
const SCRIPT_PATH =
  "scripts/check-earth-geospatial-complete-map-conditions.mjs";
const CHECKER_SHA256_BEFORE_SLOT_RUN_SELECTION_REPAIR =
  "9e64a1acc0b0da8f6a1d76b483eb8395b70cafbcec1042536dadb0149423b530";
const RUN_SELECTION_REPAIR_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-condition-check-run-selection-repairs";
const V7_SLOT_ID = valueFor("--v7-slot-id");
const ALLOWED_COMPOSITION_ARCHITECTURE_REVISIONS =
  /^v7-capacity-slot-(14[6-9]|1[5-9][0-9]|20[0-9])$/.test(
    V7_SLOT_ID ?? "",
  )
    ? [
        "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-v3-20260731",
        "owner-authorized-thailand-rebuild64-semantic-topology-diversity-v4-20260801",
        "owner-authorized-thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-v5-20260801",
        "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801",
      ]
    : [];
const AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID =
  "project-owner-authorized-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-repair-20260728";
const SLOT_123_PREFLIGHT_REVISION_PATTERN =
  /^owner-directed-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-micro-candidate-\d+-20260728$/;
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
if (V7_SLOT_ID) {
  assert(
    /^v7-capacity-slot-(10[8-9]|1[1-9][0-9]|20[0-9])$/.test(V7_SLOT_ID),
    `V7 slot is outside the supported 108-209 condition-check range: ${V7_SLOT_ID}`,
  );
}
const CONTRACT_ID =
  "sakaerat-wang-nam-khiao-earth-geospatial-naturalization-v1";
const SOURCE_REGISTRY_PATH =
  "data/world-samples/earth-geospatial/source-registry/earth-geospatial-source-registry-v1.json";
const FACTUAL_REFERENCE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json";
const WORLD_PROFILE_PATH =
  "data/world-samples/original-image-library/natural-home-v1/mainland-southeast-asia-tropical-monsoon-profile-v1.json";
const LATEST_PATH = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  V7_SLOT_ID
    ? "earth-geospatial-v7-mvp-slot-condition-runs"
    : "earth-geospatial-complete-map-condition-runs",
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

const globalLatest = readJson(LATEST_PATH);
const runSelection = selectConditionRun(globalLatest, V7_SLOT_ID);
const latest = runSelection.pointer;
const manifest = readJson(path.join(ROOT, latest.runPath));
const EXPECTED_COMPOSITION_ARCHITECTURE_REVISION =
  ALLOWED_COMPOSITION_ARCHITECTURE_REVISIONS.includes(
    manifest.anonymousCompositionArchitectureRevision ?? null,
  )
    ? manifest.anonymousCompositionArchitectureRevision
    : null;
const regionContract = V7_SLOT_ID ? null : readJson(REGION_CONTRACT_PATH);
const blueprint = readJson(path.join(ROOT, manifest.blueprintPath));
const director = readJson(path.join(ROOT, manifest.directorPath));
const visualFacts = readJson(
  path.join(ROOT, manifest.visualFactManifestPath),
);
const task = readJson(path.join(ROOT, manifest.taskPath));
const conditionManifest = readJson(
  path.join(ROOT, manifest.conditionManifestPath),
);
const conditionPack = readJson(path.join(ROOT, manifest.conditionPackPath));
const scopeAudit = readJson(path.join(ROOT, manifest.scopeAuditPath));
const lineage = readJson(path.join(ROOT, manifest.lineagePath));
const realEarthRegionSourcePackage =
  manifest.realEarthRegionSourcePackagePath
    ? readJson(
        path.join(ROOT, manifest.realEarthRegionSourcePackagePath),
      )
    : null;
const regionalConnectivityInstance =
  manifest.connectivityBlueprintPath
    ? readJson(path.join(ROOT, manifest.connectivityBlueprintPath))
    : null;
const routeNaturalnessProfile =
  V7_SLOT_ID && manifest.routeNaturalnessProfilePath
    ? readJson(path.join(ROOT, manifest.routeNaturalnessProfilePath))
    : null;
const waterNaturalnessProfile =
  V7_SLOT_ID && manifest.waterNaturalnessProfilePath
    ? readJson(path.join(ROOT, manifest.waterNaturalnessProfilePath))
    : null;

assert(
  manifest.schemaVersion ===
    "earth-reference-complete-map-condition-run-v1",
  "manifest schema mismatch",
);
assert(
  manifest.status ===
    "complete_map_conditions_ready_rgb_authorization_required",
  "condition run is incomplete",
);
assert(
  manifest.contractId === CONTRACT_ID &&
    (!regionContract || regionContract.contractId === CONTRACT_ID),
  "contract identity mismatch",
);
if (V7_SLOT_ID) {
  assert(
    manifest.v7SlotId === V7_SLOT_ID &&
      latest.v7SlotId === V7_SLOT_ID &&
      typeof manifest.ownerAuthorizationRef === "string",
    "V7 slot or bounded authorization identity mismatch",
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
    authorization?.authorizationId === manifest.ownerAuthorizationRef &&
      authorization.conditionPackagePreparationAuthorized === true &&
      authorization.imageGenerationAuthorized === false &&
      authorization.gpuTrainingAuthorized === false &&
      authorization.runtimeFrameAuthorized === false &&
      authorization.worldEntryAuthorized === false,
    "V7 bounded authorization boundary mismatch",
  );
  const planLatest = readJson(
    path.join(
      ROOT,
      ".runtime",
      "ai-painter",
      "earth-geospatial-v7-mvp-window-plans",
      "latest.json",
    ),
  );
  const plan = readJson(path.join(ROOT, planLatest.runPath));
  const rawAssignment = (plan.assignments ?? []).find(
    (entry) => entry.slotId === V7_SLOT_ID,
  );
  const sequenceRegistry = readJson(path.join(
    ROOT,
    "data",
    "ai-painter",
    "system-governance",
    "thailand-rebuild64-sequence-registry-v1.json",
  ));
  const sequenceEntry = sequenceRegistry.entries?.find(
    (entry) => entry.legacyCapacitySlotId === V7_SLOT_ID,
  );
  const assignment = rawAssignment
    ? {
        ...normalizeV7WindowAssignment(rawAssignment),
        requiredEntranceDirection: sequenceEntry?.entranceDirection,
      }
    : null;
  assert(assignment, "V7 slot assignment is absent from the window plan");
  assert(
    ["north", "east", "south", "west"].includes(
      assignment.requiredEntranceDirection,
    ),
    "V7 slot registered entrance direction is missing",
  );
  assert(
    manifest.split === assignment.split &&
      manifest.regionalLandscapeType ===
        assignment.regionalLandscapeType &&
      manifest.monsoonSeason === assignment.monsoonSeason &&
      lineage.v7SlotBinding?.candidateId === assignment.candidateId &&
      lineage.v7SlotBinding?.measurementFingerprint ===
        assignment.fingerprints.direct &&
      lineage.v7SlotBinding?.measurementWindowPlanSha256 ===
        sha256File(path.join(ROOT, planLatest.runPath)),
    "V7 slot assignment or measurement-plan lineage mismatch",
  );
  const expectedRegionSourcePackage =
    buildRealEarthRegionSourcePackage({
      root: ROOT,
      assignment,
      regionContractPath: projectPath(REGION_CONTRACT_PATH),
      sourceRegistryPath: SOURCE_REGISTRY_PATH,
      factualReferencePath: FACTUAL_REFERENCE_PATH,
      worldProfilePath: WORLD_PROFILE_PATH,
      seasonSnapshotPath: task.sourceBindings.seasonSnapshotPath,
      measurementWindowPlanPath: planLatest.runPath,
    });
  const expectedConnectivityInstance =
    buildIndependentTrainingRegionConnectivity({
      slotId: V7_SLOT_ID,
      assignment,
      worldProfileId:
        "mainland-southeast-asia-tropical-monsoon-natural-home-v1",
      sourcePackage: expectedRegionSourcePackage,
      width: 1024,
      height: 768,
      hasWater: blueprint.geometry.hasWater,
      anonymousCompositionArchitectureRevision:
        manifest.anonymousCompositionArchitectureRevision ?? null,
    });
  assert(
    realEarthRegionSourcePackage?.packageSha256 ===
      expectedRegionSourcePackage.packageSha256 &&
      manifest.realEarthRegionSourcePackageSha256 ===
        expectedRegionSourcePackage.packageSha256 &&
      blueprint.realEarthRegionSourcePackageId ===
        expectedRegionSourcePackage.packageId &&
      blueprint.realEarthRegionId ===
        expectedRegionSourcePackage.identity.realEarthRegionId &&
      realEarthRegionSourcePackage.scope?.reusableOutsideThailand ===
        false &&
      realEarthRegionSourcePackage.scope
        ?.automaticOtherCountryAcquisitionAllowed === false &&
      realEarthRegionSourcePackage.derivation
        ?.historicalRgbRead === false,
    "V7 real-Earth region source package mismatch",
  );
  assert(
    regionalConnectivityInstance?.connectivityInstanceSha256 ===
      expectedConnectivityInstance.connectivityInstanceSha256 &&
      manifest.connectivityBlueprintSha256 ===
        expectedConnectivityInstance.connectivityInstanceSha256 &&
      blueprint.connectivityBlueprintId ===
        expectedConnectivityInstance.blueprintId &&
      blueprint.regionId ===
        expectedConnectivityInstance.currentRegion.regionId &&
      regionalConnectivityInstance.identityBoundary
        ?.region0001InstanceInherited === false &&
      regionalConnectivityInstance
        .anonymousTrainingCoordinateProjection
        ?.region0001ConcreteInstanceRead === false &&
      regionalConnectivityInstance
        .anonymousTrainingCoordinateProjection
        ?.fixedNorthSouthEastWaterPortsUsed === false &&
      regionalConnectivityInstance
        .anonymousTrainingCoordinateProjection
        ?.fixedSouthPathPortUsed === false &&
      regionalConnectivityInstance.currentRegion?.neighborRegionIds
        ?.length >= 1 &&
      regionalConnectivityInstance.walkableGraph?.connected === true,
    "V7 independent regional connectivity instance mismatch",
  );
  assert(
    /^[a-f0-9]{64}$/.test(
      blueprint.structuralIdentities
        ?.themeArchitectureIdentity ?? "",
    ) &&
      /^[a-f0-9]{64}$/.test(
        blueprint.structuralIdentities
          ?.instanceDetailIdentity ?? "",
      ) &&
      JSON.stringify(blueprint.structuralIdentities) ===
        JSON.stringify(manifest.structuralIdentities) &&
      JSON.stringify(blueprint.structuralIdentities) ===
        JSON.stringify(lineage.structuralIdentities),
    "V7 theme architecture or instance detail identity is missing",
  );
  assertHash(manifest.worldFactsPath, manifest.worldFactsSha256);
  const slotWorldFacts = readJson(path.join(ROOT, manifest.worldFactsPath));
  assert(
    slotWorldFacts.v7SlotBinding?.slotId === V7_SLOT_ID &&
      slotWorldFacts.v7SlotBinding?.exactMeasurementGeometryCarriedForward ===
        false &&
      slotWorldFacts.v7SlotBinding
        ?.sourcePixelWindowCarriedIntoGameGeometry === false &&
      slotWorldFacts.identityBoundary
        ?.exactRealWorldGeometryCarriedForward === false &&
      slotWorldFacts.identityBoundary
        ?.exactMeasurementWindowGeometryCarriedForward === false &&
      slotWorldFacts.outputBoundary?.rgbCreated === false &&
      slotWorldFacts.outputBoundary?.gpuTrainingAuthorized === false,
    "V7 slot WorldFacts crossed the real-geometry, RGB, or GPU boundary",
  );
  const expectedSeedRevision =
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
        ? manifest.anonymousGameCoordinateSeedRevision
      : AUTHORIZED_WATER_SEED_REVISION_SLOTS.has(V7_SLOT_ID)
        ? `owner-directed-${V7_SLOT_ID}-seed-revision-1-20260727`
        : null;
  assert(
    (manifest.anonymousGameCoordinateSeedRevision ?? null) ===
      expectedSeedRevision &&
      (slotWorldFacts.v7SlotBinding?.anonymousGameCoordinateSeedRevision ??
        null) === expectedSeedRevision &&
      (lineage.v7SlotBinding?.anonymousGameCoordinateSeedRevision ?? null) ===
        expectedSeedRevision,
    "V7 anonymous game-coordinate seed revision evidence mismatch",
  );
  assert(
    (manifest.anonymousCompositionArchitectureRevision ?? null) ===
        EXPECTED_COMPOSITION_ARCHITECTURE_REVISION &&
      (slotWorldFacts.v7SlotBinding
        ?.anonymousCompositionArchitectureRevision ?? null) ===
        EXPECTED_COMPOSITION_ARCHITECTURE_REVISION &&
      (lineage.v7SlotBinding?.anonymousCompositionArchitectureRevision ??
        null) === EXPECTED_COMPOSITION_ARCHITECTURE_REVISION &&
      (blueprint.v7SlotBinding
        ?.anonymousCompositionArchitectureRevision ?? null) ===
        EXPECTED_COMPOSITION_ARCHITECTURE_REVISION &&
      (blueprint.geometry?.geometryDerivation
        ?.compositionArchitectureRevision ?? null) ===
        EXPECTED_COMPOSITION_ARCHITECTURE_REVISION &&
      (regionalConnectivityInstance
        ?.anonymousTrainingCoordinateProjection
        ?.anonymousCompositionArchitectureRevision ?? null) ===
        EXPECTED_COMPOSITION_ARCHITECTURE_REVISION,
    "V7 composition architecture revision evidence mismatch",
  );
  if (V7_SLOT_ID === "v7-capacity-slot-123") {
    if (expectedSeedRevision) {
      assert(
        SLOT_123_PREFLIGHT_REVISION_PATTERN.test(
          expectedSeedRevision,
        ) &&
          manifest
            .anonymousGameCoordinateSeedPreflightAuthorizationId ===
            AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID &&
          slotWorldFacts.v7SlotBinding
            ?.anonymousGameCoordinateSeedPreflightAuthorizationId ===
            AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID &&
          lineage.v7SlotBinding
            ?.anonymousGameCoordinateSeedPreflightAuthorizationId ===
            AUTHORIZED_SLOT_123_SEED_PREFLIGHT_ID,
        "slot-123 bounded seed preflight authorization evidence mismatch",
      );
    } else {
      assert(
        (manifest
          .anonymousGameCoordinateSeedPreflightAuthorizationId ??
          null) === null &&
          (slotWorldFacts.v7SlotBinding
            ?.anonymousGameCoordinateSeedPreflightAuthorizationId ??
            null) === null &&
          (lineage.v7SlotBinding
            ?.anonymousGameCoordinateSeedPreflightAuthorizationId ??
            null) === null,
        "slot-123 no-seed-retry evidence must not claim seed preflight authorization",
      );
    }
  }
  assert(
    [
      "aggregate_natural_facts_to_seeded_anonymous_game_coordinate_geometry_v2",
      "aggregate_natural_facts_to_seeded_anonymous_game_coordinate_geometry_v3",
      "aggregate_natural_facts_to_seeded_anonymous_game_coordinate_geometry_v4",
      MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
    ].includes(blueprint.geometry.geometryDerivation?.methodId) &&
      /^(aggregate_fact_seeded|measurement_fact)_anonymous_layout_[1-4]$/.test(
        blueprint.geometry.geometryDerivation?.layoutVariant ?? "",
      ) &&
      /^[a-f0-9]{64}$/.test(
        blueprint.geometry.geometryDerivation
          ?.aggregateLayoutProfileSha256 ?? "",
      ),
    "V7 aggregate-fact anonymous layout evidence mismatch",
  );
  if (V7_SLOT_ID === "v7-capacity-slot-123") {
    const expectedCoarseHydrologyProfile =
      buildMeasurementDerivedCoarseHydrologyProfile({
        assignment,
        root: ROOT,
      });
    const expectedMeasurementProfile =
      buildMeasurementDrivenAnonymousLayoutProfile({
        assignment,
        hasWater: blueprint.geometry.hasWater,
        coarseHydrologyProfile:
          expectedCoarseHydrologyProfile,
      });
    assert(
      blueprint.geometry.geometryDerivation?.methodId ===
        MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID &&
        blueprint.geometry.geometryDerivation?.routeTopologyFamily ===
          MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY &&
        blueprint.geometry.geometryDerivation
          ?.routeWaterAvoidanceMethod ===
          "measurement_fact_driven_independent_full_free_space_candidate_passage_v8" &&
        blueprint.geometry.geometryDerivation
          ?.routeWaterAvoidancePassed === true &&
        blueprint.geometry.geometryDerivation
          ?.seedPreflightAuthorizationId ===
          (manifest
            .anonymousGameCoordinateSeedPreflightAuthorizationId ??
            null) &&
        blueprint.geometry.geometryDerivation
          ?.measurementTopologyFingerprint ===
          expectedMeasurementProfile.topologySelection
            .measurementTopologyFingerprint &&
        blueprint.geometry.geometryDerivation
          ?.macroTopologySource ===
          "measurement_window_aggregate_facts_plus_all_eight_quantized_thai_dem_d8_to_independent_internal_hydrology_without_fixed_boundary_water_ports" &&
        blueprint.geometry.geometryDerivation
          ?.retrySeedAffectsMacroTopology === false &&
        blueprint.geometry.geometryDerivation?.layoutSelectionByte ===
          expectedMeasurementProfile.topologySelection
            .layoutSelectionByte &&
        blueprint.geometry.geometryDerivation?.routeTopologySelectionByte ===
          expectedMeasurementProfile.topologySelection
            .routeTopologySelectionByte &&
        blueprint.geometry.geometryDerivation
          ?.routeMacroProfileSha256 ===
          expectedMeasurementProfile.waterAvoidingRoutePlan
            ?.routeMacroProfile?.profileSha256 &&
        blueprint.geometry.geometryDerivation
          ?.waterControlProfileSelectionByte ===
          expectedMeasurementProfile.topologySelection
            .waterControlProfileSelectionByte &&
        blueprint.geometry.geometryDerivation?.waterControlProfileIndex ===
          expectedMeasurementProfile.waterControlProfileIndex &&
        blueprint.geometry.geometryDerivation
          ?.internalHydrologyFamily ===
          MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY &&
        blueprint.geometry.geometryDerivation
          ?.internalHydrologyProfileSha256 ===
          expectedMeasurementProfile.internalHydrologyProfile
            .profileSha256 &&
        blueprint.geometry.geometryDerivation
          ?.coarseHydrologyMainChannelFamily ===
          COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY &&
        blueprint.geometry.geometryDerivation
          ?.coarseHydrologyMainChannelProfileSha256 ===
          expectedCoarseHydrologyProfile.profileSha256 &&
        blueprint.geometry.geometryDerivation
          ?.exactD8GeometryCarriedForward === false &&
        blueprint.geometry.geometryDerivation
          ?.internalHydrologySelectionByte ===
          expectedMeasurementProfile.topologySelection
            .internalHydrologySelectionByte &&
        blueprint.geometry.geometryDerivation
          ?.floodplainBasinSelectionByte ===
          expectedMeasurementProfile.topologySelection
            .floodplainBasinSelectionByte &&
        blueprint.geometry.geometryDerivation?.layoutVariant ===
          expectedMeasurementProfile.layoutVariant &&
        blueprint.geometry.routeTopology ===
          expectedMeasurementProfile.routeTopology &&
        JSON.stringify(blueprint.geometry.internalHydrologyProfile) ===
          JSON.stringify(
            expectedMeasurementProfile.internalHydrologyProfile,
          ) &&
        JSON.stringify(
          blueprint.geometry.coarseHydrologyMainChannelProfile,
        ) === JSON.stringify(expectedCoarseHydrologyProfile) &&
        manifest.coarseHydrologyMainChannelProfile?.profileSha256 ===
          expectedCoarseHydrologyProfile.profileSha256 &&
        manifest.mainChannelSelection
          ?.coarseHydrologyProfileSha256 ===
          expectedCoarseHydrologyProfile.profileSha256 &&
        manifest.mainChannelSelection
          ?.exactD8GeometryCarriedForward === false,
      "slot-123 measurement-driven anonymous topology evidence mismatch",
    );
  }
  assertHash(
    manifest.routeNaturalnessProfilePath,
    manifest.routeNaturalnessProfileSha256,
  );
  assert(
    routeNaturalnessProfile?.status ===
      "aggregate_public_route_naturalness_profile_ready" &&
      routeNaturalnessProfile.source?.provider ===
        "OpenStreetMap contributors" &&
      routeNaturalnessProfile.source?.license ===
        "Open Database License (ODbL) 1.0" &&
      routeNaturalnessProfile.source?.exactGeometryCopied === false &&
      routeNaturalnessProfile.source?.coordinatesPersistedInProfile ===
        false &&
      routeNaturalnessProfile.identityBoundary
        ?.exactOsmGeometryCarriedForward === false &&
      routeNaturalnessProfile.identityBoundary
        ?.finalGameCoordinatesRemainAnonymous === true,
    "V7 route naturalness profile crossed the public-source geometry boundary",
  );
  assertHash(
    routeNaturalnessProfile.source.rawResponsePath,
    routeNaturalnessProfile.source.rawResponseSha256,
  );
  const recomputedNaturalnessAudit = auditAnonymousRouteNaturalness(
    blueprint.geometry.pathCenterline,
    routeNaturalnessProfile,
  );
  assert(
    recomputedNaturalnessAudit.passed === true &&
      manifest.routeNaturalnessAudit?.passed === true &&
      blueprint.geometry.routeNaturalnessAudit?.passed === true &&
      recomputedNaturalnessAudit.sinuosity ===
        manifest.routeNaturalnessAudit.sinuosity &&
      recomputedNaturalnessAudit.maximumSegmentPixels ===
        manifest.routeNaturalnessAudit.maximumSegmentPixels &&
      recomputedNaturalnessAudit.maximumInteriorTurnDegrees ===
        manifest.routeNaturalnessAudit.maximumInteriorTurnDegrees &&
      blueprint.geometry.routeNaturalnessReference?.profileSha256 ===
        manifest.routeNaturalnessProfileSha256 &&
      lineage.routeNaturalnessReference?.profileSha256 ===
        manifest.routeNaturalnessProfileSha256,
    "V7 anonymous route naturalness audit did not pass",
  );
  if (V7_SLOT_ID === "v7-capacity-slot-123") {
    assert(
      manifest.routeWaterAvoidanceAudit?.passed === true &&
        manifest.routeWaterAvoidanceAudit
          ?.pathWaterOverlap === false &&
        manifest.routeWaterAvoidanceAudit
          ?.currentRegionPathPortPreserved === true &&
        manifest.routeWaterAvoidanceAudit
          ?.exactRealWorldGeometryUsed === false &&
        manifest.routeWaterAvoidanceAudit
          ?.exactD8GeometryUsed === false &&
        blueprint.geometry.routeWaterAvoidanceAudit?.passed ===
          true &&
        blueprint.geometry.routeWaterAvoidanceAudit
          ?.pathWaterOverlap === false &&
        blueprint.geometry.routeWaterAvoidanceAudit
          ?.waterGeometrySource ===
          "current_anonymous_dem_d8_driven_water_polygons",
      "slot-123 anonymous route water-avoidance audit did not pass",
    );
  }
  if (manifest.waterNaturalnessProfilePath) {
    assertHash(
      manifest.waterNaturalnessProfilePath,
      manifest.waterNaturalnessProfileSha256,
    );
    assert(
      waterNaturalnessProfile?.status ===
        "aggregate_public_water_naturalness_profile_ready" &&
        waterNaturalnessProfile.source?.provider ===
          "OpenStreetMap contributors" &&
        waterNaturalnessProfile.source?.license ===
          "Open Database License (ODbL) 1.0" &&
        waterNaturalnessProfile.source?.exactGeometryCopied === false &&
        waterNaturalnessProfile.source?.coordinatesPersistedInProfile ===
          false &&
        waterNaturalnessProfile.source?.osmElementIdsPersistedInProfile ===
          false &&
        waterNaturalnessProfile.source?.perFeatureMetricsPersistedInProfile ===
          false &&
        !Object.hasOwn(
          waterNaturalnessProfile.source,
          "regionalAggregateBounds",
        ) &&
        !Object.hasOwn(
          waterNaturalnessProfile.source,
          "observationBounds",
        ) &&
        waterNaturalnessProfile.identityBoundary
          ?.exactOsmGeometryCarriedForward === false &&
        waterNaturalnessProfile.identityBoundary
          ?.finalGameCoordinatesRemainAnonymous === true,
      "V7 water naturalness profile crossed the aggregate-only public-source boundary",
    );
    assertHash(
      waterNaturalnessProfile.source.acquisitionProfilePath,
      waterNaturalnessProfile.source.acquisitionProfileSha256,
    );
    assertHash(
      waterNaturalnessProfile.source.rawResponsePath,
      waterNaturalnessProfile.source.rawResponseSha256,
    );
    const recomputedWaterAudit = auditAnonymousWaterNaturalness(
      blueprint.geometry.waterCenterline,
      waterNaturalnessProfile,
    );
    const waterTerrains = blueprint.geometry.terrainRegions.filter(
      (entry) => entry.kind === "water",
    );
    const routeTerrain = blueprint.geometry.terrainRegions.find(
      (entry) => entry.kind === "path_ground",
    );
    const routeEnd = blueprint.geometry.pathCenterline.at(-1);
    const waterStart = blueprint.geometry.waterCenterline[0];
    const waterEnd = blueprint.geometry.waterCenterline.at(-1);
    const waterHalfWidths = blueprint.geometry.waterHalfWidths ?? [];
    const recomputedCorridorShapeAudit =
      auditAnonymousWaterCorridorShape(
        blueprint.geometry.waterCenterline,
        waterHalfWidths,
      );
    const waterBranchCenterlines =
      blueprint.geometry.waterBranchCenterlines ?? [];
    const waterBranchHalfWidths =
      blueprint.geometry.waterBranchHalfWidths ?? [];
    const recomputedBranchNaturalnessAudits =
      waterBranchCenterlines.map((points) =>
        auditAnonymousWaterNaturalness(
          points,
          waterNaturalnessProfile,
        ),
      );
    const recomputedBranchCorridorAudits =
      waterBranchCenterlines.map((points, index) =>
        auditAnonymousWaterCorridorShape(
          points,
          waterBranchHalfWidths[index] ?? [],
        ),
      );
    assert(
      recomputedWaterAudit.passed === true &&
        manifest.waterNaturalnessAudit?.passed === true &&
        blueprint.geometry.waterNaturalnessAudit?.passed === true &&
        recomputedWaterAudit.sinuosity ===
          manifest.waterNaturalnessAudit.sinuosity &&
        recomputedWaterAudit.maximumSegmentPixels ===
          manifest.waterNaturalnessAudit.maximumSegmentPixels &&
        recomputedWaterAudit.maximumInteriorTurnDegrees ===
          manifest.waterNaturalnessAudit.maximumInteriorTurnDegrees &&
        blueprint.geometry.waterNaturalnessReference?.profileSha256 ===
          manifest.waterNaturalnessProfileSha256 &&
        lineage.waterNaturalnessReference?.profileSha256 ===
          manifest.waterNaturalnessProfileSha256,
      "V7 anonymous water naturalness audit did not pass",
    );
    assert(
      recomputedCorridorShapeAudit.passed === true &&
        manifest.waterCorridorShapeAudit?.passed === true &&
        blueprint.geometry.waterCorridorShapeAudit?.passed === true &&
        recomputedCorridorShapeAudit
          .minimumBendRadiusToHalfWidthRatio ===
          manifest.waterCorridorShapeAudit
            .minimumBendRadiusToHalfWidthRatio &&
        recomputedCorridorShapeAudit.downstreamBacktrackCount === 0,
      "V7 water corridor bend-radius audit did not pass",
    );
    if (V7_SLOT_ID === "v7-capacity-slot-123") {
      const expectedCoarseHydrologyProfile =
        buildMeasurementDerivedCoarseHydrologyProfile({
          assignment,
          root: ROOT,
        });
      const expectedMeasurementProfile =
        buildMeasurementDrivenAnonymousLayoutProfile({
          assignment,
          hasWater: true,
          coarseHydrologyProfile:
            expectedCoarseHydrologyProfile,
        });
      assert(
        waterBranchCenterlines.length === 1 &&
          waterBranchHalfWidths.length === 1 &&
          waterBranchCenterlines[0].length ===
            waterBranchHalfWidths[0].length &&
          recomputedBranchNaturalnessAudits.every(
            (entry) => entry.passed,
          ) &&
          recomputedBranchCorridorAudits.every(
            (entry) => entry.passed,
          ) &&
          blueprint.geometry.internalHydrologyProfile
            ?.family ===
            MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY &&
          blueprint.geometry.internalHydrologyProfile
            ?.profileSha256 ===
            expectedMeasurementProfile.internalHydrologyProfile
              .profileSha256 &&
          blueprint.geometry.internalHydrologyProfile
            ?.singleBroadCenterlineIsOnlyInternalHydrology ===
            false &&
          blueprint.geometry.internalHydrologyProfile
            ?.eightBandNetworkRequired === true &&
          blueprint.geometry.internalHydrologyProfile
            ?.allEightCoarseBandsConsumed === true &&
          blueprint.geometry.internalHydrologyProfile
            ?.backwaterBasinCount ===
            expectedMeasurementProfile.internalHydrologyProfile
              .backwaterBasinCount &&
          blueprint.geometry.internalHydrologyProfile
            ?.backwaterBasinLongitudinalFractions?.length ===
            blueprint.geometry.internalHydrologyProfile
              ?.backwaterBasinCount &&
          blueprint.geometry.internalHydrologyProfile
            ?.backwaterSupportBandIndices?.length ===
            blueprint.geometry.internalHydrologyProfile
              ?.backwaterBasinCount &&
          blueprint.geometry.internalHydrologyProfile
            ?.branchAnonymousSupportFractions?.length === 8 &&
          blueprint.geometry.internalHydrologyProfile
            ?.measurementSupportStatistics
            ?.directBandSupports?.length === 8 &&
          blueprint.geometry.internalHydrologyProfile
            ?.measurementSupportStatistics
            ?.relativeBandSupports?.length === 8 &&
          blueprint.geometry.internalHydrologyProfile
            ?.measurementSupportStatisticsDriveMacroStructure ===
            true &&
          blueprint.geometry.internalHydrologyProfile
            ?.fixedSharedInternalRiverSkeletonUsed === false &&
          blueprint.geometry.internalHydrologyAudit?.passed ===
            true &&
          blueprint.geometry.internalHydrologyAudit
            ?.branchCount === 1 &&
          blueprint.geometry.internalHydrologyAudit
            ?.connectivityPortsUsedAsBoundaryConstraintsOnly ===
            true &&
          blueprint.geometry.internalHydrologyAudit
            ?.retrySeedAffectsMacroTopology === false &&
          blueprint.geometry.internalHydrologyAudit
            ?.allEightCoarseBandsConsumed === true &&
          blueprint.geometry.internalHydrologyAudit
            ?.eightBandAnabranchSelection
            ?.directEightBandSupportFractions?.length === 8 &&
          blueprint.geometry.internalHydrologyAudit
            ?.eightBandAnabranchSelection
            ?.anonymousBandAnchors?.length === 8 &&
          manifest.internalHydrologyProfile?.profileSha256 ===
            expectedMeasurementProfile.internalHydrologyProfile
              .profileSha256 &&
          manifest.internalHydrologyAudit?.passed === true &&
          blueprint.geometry.coarseHydrologyMainChannelProfile
            ?.family ===
            COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY &&
          blueprint.geometry.coarseHydrologyMainChannelProfile
            ?.profileSha256 ===
            expectedCoarseHydrologyProfile.profileSha256 &&
          blueprint.geometry.coarseHydrologyMainChannelProfile
            ?.identityBoundary
            ?.connectivityPortsAreBoundaryConstraintsOnly ===
            true &&
          blueprint.geometry.coarseHydrologyMainChannelProfile
            ?.identityBoundary?.exactD8GeometryCarriedForward ===
            false &&
          blueprint.geometry.mainChannelSelection
            ?.coarseHydrologyProfileSha256 ===
            expectedCoarseHydrologyProfile.profileSha256 &&
          blueprint.geometry.mainChannelSelection
            ?.retrySeedAffectsMacroTopology === false &&
          blueprint.geometry.mainChannelSelection
            ?.exactD8GeometryCarriedForward === false &&
          blueprint.geometry.mainChannelSelection
            ?.directEightBandSupportFractions?.length === 8 &&
          blueprint.geometry.mainChannelSelection
            ?.anonymousBandAnchors?.length === 8,
        "slot-123 measurement-derived internal hydrology audit did not pass",
      );
    }
    const independentWaterPlan =
      regionalConnectivityInstance
        ?.anonymousTrainingCoordinateProjection?.waterPlan;
    const independentPathPlan =
      regionalConnectivityInstance
        ?.anonymousTrainingCoordinateProjection?.pathPlan;
    assert(
      independentWaterPlan &&
        waterStart?.x === independentWaterPlan.start.x &&
        waterStart?.y === independentWaterPlan.start.y &&
        waterEnd?.x === independentWaterPlan.end.x &&
        waterEnd?.y === independentWaterPlan.end.y &&
        routeEnd?.x === independentPathPlan.boundaryPosition.x &&
        routeEnd?.y === independentPathPlan.boundaryPosition.y &&
        independentWaterPlan.externalWaterPorts.length === 2 &&
        independentWaterPlan.externalWaterPorts.some(
          (port) => port.boundarySide === "north" &&
            port.flowRole === "upstream_inlet",
        ) &&
        independentWaterPlan.externalWaterPorts.some(
          (port) => port.boundarySide === "south" &&
            port.flowRole === "downstream_outlet",
        ) &&
        independentWaterPlan
          .lateralBoundaryContinuationRequired === false,
      "V7 route or water centerline does not bind the independent current-region plan",
    );
    assert(
      waterHalfWidths.length ===
        blueprint.geometry.waterCenterline.length &&
        waterHalfWidths[0] ===
          Math.round(
            independentWaterPlan.startHalfWidth *
              (blueprint.geometry.internalHydrologyProfile
                ?.internalNetworkConnectionMode ===
              "two_separated_interior_headwater_tributaries_to_main_channel"
                ? 0.58
                : 1),
          ) &&
        waterHalfWidths.at(-1) ===
          Math.round(
            independentWaterPlan.endHalfWidth *
              (blueprint.geometry.internalHydrologyProfile
                ?.internalNetworkConnectionMode ===
              "two_separated_interior_headwater_tributaries_to_main_channel"
                ? 0.58
                : 1),
          ) &&
        new Set(waterHalfWidths).size >= 4,
      "V7 water width profile does not preserve the current-region internal hydrology widths",
    );
    assert(
      waterTerrains.length >=
          blueprint.geometry.waterCenterline.length &&
        waterTerrains.some((entry) =>
          polygonTouchesCanvasEdge(entry.polygon, "top"),
        ) &&
        waterTerrains.some((entry) =>
          polygonTouchesCanvasEdge(entry.polygon, "bottom"),
        ) &&
        ["right", "left"].every(
          (edge) => !waterTerrains.some((entry) =>
            polygonTouchesCanvasEdge(entry.polygon, edge),
          ),
        ) &&
        waterTerrains.every(
          (entry) =>
            !polygonHasSelfIntersection(entry.polygon) &&
            !polygonsOverlap(routeTerrain.polygon, entry.polygon),
        ),
      "V7 internal water geometry touches an invented boundary, self-intersects, or intersects the route",
    );
  }
}
for (const [filePath, expectedHash] of [
  [
    manifest.realEarthRegionSourcePackagePath,
    manifest.realEarthRegionSourcePackageArtifactSha256,
  ],
  [
    manifest.connectivityBlueprintPath,
    manifest.connectivityBlueprintArtifactSha256,
  ],
  [manifest.blueprintPath, manifest.blueprintSha256],
  [manifest.directorPath, manifest.directorSha256],
  [manifest.visualFactManifestPath, manifest.visualFactManifestSha256],
  [manifest.taskPath, manifest.taskSha256],
  [manifest.taskManifestPath, manifest.taskManifestSha256],
  [manifest.conditionManifestPath, manifest.conditionManifestSha256],
  [manifest.conditionPackPath, manifest.conditionPackSha256],
  [manifest.scopeAuditPath, manifest.scopeAuditSha256],
  [manifest.lineagePath, manifest.lineageSha256],
]) {
  assertHash(filePath, expectedHash);
}

assert(
  blueprint.canvas.width === 1024 &&
    blueprint.canvas.height === 768 &&
    blueprint.canvas.frameScope === "complete_runtime_frame" &&
    blueprint.completeMapScopeRequired === true,
  "blueprint is not a native complete-map contract",
);
if (/^v7-capacity-slot-(14[6-9]|1[5-9][0-9]|20[0-9])$/.test(V7_SLOT_ID ?? "")) {
  const worldFrameContract = blueprint.worldFrameContract;
  assert(
    worldFrameContract?.contractVersion ===
        "complete-rectangular-world-and-future-dynamic-readiness-v2" &&
      worldFrameContract.appliesToAllThailandRebuild64Slots === true &&
      worldFrameContract.frameCoverage
        ?.everyPixelMustResolveToInWorldSurfaceOrInWorldObject === true &&
      worldFrameContract.frameCoverage
        ?.continuousWorldSurfaceMustFillRectangleEdgeToEdge === true &&
      worldFrameContract.frameCoverage?.externalBackdropAllowed === false &&
      worldFrameContract.frameCoverage?.solidColorMatteAllowed === false &&
      worldFrameContract.frameCoverage?.floatingMapOrIslandCutoutAllowed ===
        false &&
      worldFrameContract.boundaryConnectivity
        ?.routeMustVisiblyTouchContractSide === true &&
      worldFrameContract.boundaryConnectivity
        ?.horizontalOrVerticalMirrorAllowed === false &&
      worldFrameContract.semanticDecomposition
        ?.authoritativeConditionChannelCount === 23 &&
      worldFrameContract.semanticDecomposition
        ?.futureRuntimeMotionReserved === true &&
      task.worldFrameContract?.contractVersion ===
        worldFrameContract.contractVersion &&
      task.dynamicReadiness?.everyPixelWorldAddressable === true &&
      task.dynamicReadiness?.backgroundVoidAllowed === false,
    "Thailand rebuild64 full-world or future-dynamic readiness contract mismatch",
  );
}
assert(
  blueprint.sourceRgbRead === false &&
    blueprint.sourceImageGeometryRead === false &&
    blueprint.sourceBlueprintReuse === false &&
    blueprint.sourceTransformReuse === false,
  "blueprint reused forbidden image or layout evidence",
);
assert(
  blueprint.geometry.focalBounds == null &&
    blueprint.semanticRules.siteSelectionPolicy ===
      "initial_natural_world_no_preset_home_site",
  "preset home-site semantics were detected",
);
assert(
  director.autonomyContract.presetHomeSite === false &&
    director.autonomyContract.presetActivityCenter === false &&
    director.autonomyContract.constructionClearing === false &&
    director.autonomyContract.focalAreaActive === false,
  "World Director autonomy contract mismatch",
);
assert(
  !JSON.stringify({ blueprint, director, task }).includes("home_center"),
  "stale home_center semantics entered the new condition package",
);
assert(
  task.drawingProcess.sourceImageGeometryRead === false &&
    task.drawingProcess.realMapGeometryRead === false,
  "task reads forbidden source geometry",
);
assert(
  conditionManifest.channelCount === 23 &&
    conditionPack.channels.length === 23 &&
    new Set(conditionPack.channels.map((entry) => entry.id)).size === 23,
  "condition package does not contain exactly 23 unique channels",
);
assert(
  scopeAudit.status === "complete_map_scope_passed" &&
    scopeAudit.passed === true &&
    scopeAudit.generatedImageCreated === false &&
    scopeAudit.computeStarted === false,
  "complete-map scope audit did not pass",
);
assert(
  manifest.completeMapScopePassed === true &&
    manifest.focalAreaNonZeroCount === 0,
  "complete-map or focal-area result mismatch",
);
assert(
  lineage.normalizationAlgorithm.copiesRealMapGeometry === false &&
    lineage.normalizationAlgorithm.copiesOsmGeometry === false &&
    lineage.normalizationAlgorithm.readsHistoricalRgb === false &&
    lineage.normalizationAlgorithm.usesHistoricalLayout === false &&
    lineage.normalizationAlgorithm.createsNewGameCoordinateGeometry === true,
  "condition lineage crossed the source-geometry boundary",
);
if (V7_SLOT_ID) {
  assert(
    lineage.v7SlotBinding?.exactMeasurementGeometryCarriedForward === false &&
      lineage.v7SlotBinding?.sourcePixelWindowCarriedIntoGameGeometry ===
        false &&
      blueprint.v7SlotBinding?.exactRealWorldGeometryCarriedForward === false &&
      blueprint.v7SlotBinding?.sourcePixelWindowCarriedIntoGameGeometry ===
        false &&
      blueprint.geometry?.geometryDerivation
        ?.mirrorOrRotationTemplateUsed === false &&
      blueprint.geometry?.geometryDerivation?.historicalRgbRead === false &&
      blueprint.geometry?.geometryDerivation?.historicalLayoutRead === false &&
      blueprint.geometry?.geometryDerivation
        ?.exactD8GeometryCarriedForward === false,
    "V7 slot reused measurement geometry, historical RGB, or a transformed template",
  );
  const noveltyAudit = blueprint.geometry?.geometryNoveltyAudit;
  assert(
    noveltyAudit?.status === "passed" &&
      noveltyAudit.exactTransformDuplicateFound === false &&
      noveltyAudit.mirrorOrRotationTemplateUsed === false &&
      noveltyAudit.sharedRouteSkeletonDetected === false &&
      noveltyAudit.comparedSlotCount >= 1 &&
      (!EXPECTED_COMPOSITION_ARCHITECTURE_REVISION ||
        (noveltyAudit.comparedUniqueSlotCount >= 64 &&
          noveltyAudit.requiredCapacitySlotIds?.length === 64 &&
          noveltyAudit.missingRequiredCapacitySlotIds?.length === 0 &&
          noveltyAudit.sameCapacityIdentityComparedAsIndependentMap ===
            true &&
          noveltyAudit.sameSlotSupersededConditionsCompared === true &&
          noveltyAudit.mostSimilarCompleteFramework
            ?.maximumCompleteFrameworkSimilarity <
            noveltyAudit.maximumAllowedCompleteFrameworkSimilarity)) &&
      (!noveltyAudit.mostSimilarPreviousSlot ||
        noveltyAudit.mostSimilarPreviousSlot
          .maximumRouteOccupancySimilarity <
          noveltyAudit.maximumAllowedRouteOccupancySimilarity),
    "V7 cross-slot geometry novelty audit did not pass",
  );
}
assert(
  manifest.outputBoundary.imageGenerationStarted === false &&
    manifest.outputBoundary.gpuTrainingStarted === false &&
    manifest.outputBoundary.rgbCreated === false &&
    manifest.outputBoundary.formalCandidateEligible === false &&
    manifest.outputBoundary.runtimeFrameEligible === false &&
    manifest.outputBoundary.canEnterWorld === false,
  "output boundary was violated",
);
assert(
  manifest.remainingBlockers.length === 0 &&
    manifest.nextRequiredAuthorization ===
      "owner_authorization_required_before_any_rgb_generation",
  "next authorization boundary is invalid",
);
if (regionContract && !V7_SLOT_ID) {
  assert(
    regionContract.status ===
      "complete_map_conditions_ready_rgb_authorization_required" &&
      regionContract.blockers.length === 0 &&
      regionContract.outputBoundary.completeMap23ChannelsCreated === true &&
      regionContract.outputBoundary.imageGenerationAuthorized === false,
    "region contract was not advanced correctly",
  );
}

const focalChannel = conditionPack.channels.find(
  (entry) => entry.id === "focal_area",
);
assert(focalChannel, "focal_area channel missing");
const focal = await sharp(path.join(ROOT, focalChannel.path))
  .greyscale()
  .raw()
  .toBuffer();
assert(countNonZero(focal) === 0, "focal_area channel is not all-zero");

for (const channel of conditionPack.channels) {
  assertHash(channel.path, channel.sha256);
}

const database = new DatabaseSync(catalogPath, { readOnly: true });
const indexedArtifactRows = database
  .prepare("SELECT logical_path FROM artifacts WHERE run_id = ?")
  .all(manifest.runId);
const indexedEvents = database
  .prepare("SELECT COUNT(*) AS count FROM program_events WHERE run_id = ?")
  .get(manifest.runId).count;
database.close();
const indexedArtifactPaths = new Set(
  indexedArtifactRows.map((entry) => entry.logical_path),
);
const requiredIndexedPaths = [
  latest.runPath,
  ...(V7_SLOT_ID ? [manifest.worldFactsPath] : []),
  manifest.blueprintPath,
  manifest.directorPath,
  manifest.visualFactManifestPath,
  manifest.taskPath,
  manifest.taskManifestPath,
  manifest.conditionManifestPath,
  manifest.conditionPackPath,
  manifest.scopeAuditPath,
  manifest.lineagePath,
  ...(V7_SLOT_ID ? [manifest.routeNaturalnessProfilePath] : []),
  ...(manifest.waterNaturalnessProfilePath
    ? [manifest.waterNaturalnessProfilePath]
    : []),
  ...conditionPack.channels.map((entry) => entry.path),
];
for (const requiredPath of requiredIndexedPaths) {
  assert(
    indexedArtifactPaths.has(requiredPath),
    `SQLite artifact index is missing: ${requiredPath}`,
  );
}
assert(indexedEvents >= 2, "SQLite event index is incomplete");

const runSelectionRepairEvidence = runSelection.recovered
  ? persistRunSelectionRepairEvidence(runSelection, manifest)
  : null;

console.log(
  JSON.stringify(
    {
      status: "earth_geospatial_complete_map_conditions_passed",
      runId: manifest.runId,
      manifestPath: projectPath(path.join(ROOT, latest.runPath)),
      conditionId: manifest.conditionId,
      v7SlotId: manifest.v7SlotId ?? null,
      split: manifest.split ?? null,
      regionalLandscapeType: manifest.regionalLandscapeType ?? null,
      monsoonSeason: manifest.monsoonSeason ?? null,
      anonymousGameCoordinateSeedRevision:
        manifest.anonymousGameCoordinateSeedRevision ?? null,
      channelCount: manifest.channelCount,
      completeMapScopePassed: manifest.completeMapScopePassed,
      focalAreaNonZeroCount: countNonZero(focal),
      exactRealWorldGeometryCarriedForward:
        manifest.exactRealWorldGeometryCarriedForward,
      historicalRgbRead: manifest.historicalRgbRead,
      indexedArtifacts: indexedArtifactPaths.size,
      requiredIndexedArtifacts: requiredIndexedPaths.length,
      indexedEvents,
      globalLatestRunId: globalLatest.runId,
      globalLatestV7SlotId: globalLatest.v7SlotId ?? null,
      slotSpecificRunSelectionRecovered: runSelection.recovered,
      runSelectionRepairEvidencePath:
        runSelectionRepairEvidence?.runPath ?? null,
      remainingBlockers: manifest.remainingBlockers,
      nextRequiredAuthorization: manifest.nextRequiredAuthorization,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function countNonZero(values) {
  let count = 0;
  for (const value of values) {
    if (value !== 0) count += 1;
  }
  return count;
}

function assertHash(relativePath, expectedHash) {
  const absolutePath = path.join(ROOT, relativePath);
  assert(fs.existsSync(absolutePath), `artifact missing: ${relativePath}`);
  assert(
    sha256File(absolutePath) === expectedHash,
    `artifact hash mismatch: ${relativePath}`,
  );
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
        ((b.x - a.x) * (point.y - a.y)) /
          (b.y - a.y || 1) +
          a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function lineSegmentsIntersect(a, b, c, d) {
  const orientation = (p, q, r) =>
    Math.sign(
      (q.y - p.y) * (r.x - q.x) -
        (q.x - p.x) * (r.y - q.y),
    );
  return (
    orientation(a, b, c) !== orientation(a, b, d) &&
    orientation(c, d, a) !== orientation(c, d, b)
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
      if (
        lineSegmentsIntersect(
          leftStart,
          leftEnd,
          right[rightIndex],
          right[(rightIndex + 1) % right.length],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function polygonHasSelfIntersection(polygon) {
  for (let first = 0; first < polygon.length; first += 1) {
    const firstNext = (first + 1) % polygon.length;
    for (let second = first + 1; second < polygon.length; second += 1) {
      const secondNext = (second + 1) % polygon.length;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first
      ) {
        continue;
      }
      if (
        lineSegmentsIntersect(
          polygon[first],
          polygon[firstNext],
          polygon[second],
          polygon[secondNext],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function polygonTouchesCanvasEdge(polygon, edge) {
  if (edge === "top") return polygon.some((point) => point.y === 0);
  if (edge === "right") return polygon.some((point) => point.x === 1024);
  if (edge === "bottom") return polygon.some((point) => point.y === 768);
  if (edge === "left") return polygon.some((point) => point.x === 0);
  return false;
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonSafe(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function selectConditionRun(pointer, v7SlotId) {
  if (!v7SlotId || pointer.v7SlotId === v7SlotId) {
    return {
      pointer,
      recovered: false,
      globalLatestRunId: pointer.runId,
      globalLatestV7SlotId: pointer.v7SlotId ?? null,
    };
  }

  const runRoot = path.dirname(LATEST_PATH);
  const candidates = fs
    .readdirSync(runRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      path.join(runRoot, entry.name, "complete-map-condition-run.json"),
    )
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({
      filePath,
      manifest: readJsonSafe(filePath),
    }))
    .filter(
      (entry) =>
        entry.manifest?.v7SlotId === v7SlotId &&
        entry.manifest?.status ===
          "complete_map_conditions_ready_rgb_authorization_required",
    )
    .sort(
      (left, right) =>
        Date.parse(right.manifest.createdAtUtc) -
        Date.parse(left.manifest.createdAtUtc),
    );

  assert(
    candidates.length > 0,
    `No complete immutable V7 condition run found for ${v7SlotId}`,
  );
  const selected = candidates[0];
  return {
    pointer: {
      schemaVersion:
        "earth-reference-complete-map-condition-run-v1-slot-resolved-pointer",
      runId: selected.manifest.runId,
      status: selected.manifest.status,
      updatedAtUtc: selected.manifest.createdAtUtc,
      runPath: projectPath(selected.filePath),
      contractId: selected.manifest.contractId,
      conditionId: selected.manifest.conditionId,
      v7SlotId: selected.manifest.v7SlotId,
      split: selected.manifest.split,
      channelCount: selected.manifest.channelCount,
      completeMapScopePassed: selected.manifest.completeMapScopePassed,
      imageGenerationStarted:
        selected.manifest.outputBoundary?.imageGenerationStarted ?? false,
      gpuTrainingStarted:
        selected.manifest.outputBoundary?.gpuTrainingStarted ?? false,
    },
    recovered: true,
    globalLatestRunId: pointer.runId,
    globalLatestV7SlotId: pointer.v7SlotId ?? null,
  };
}

function persistRunSelectionRepairEvidence(selection, selectedManifest) {
  const checkerSha256After = sha256File(path.join(ROOT, SCRIPT_PATH));
  const latestEvidencePointer = readJsonSafe(
    path.join(ROOT, RUN_SELECTION_REPAIR_ROOT, "latest.json"),
  );
  if (
    latestEvidencePointer?.requestedV7SlotId === V7_SLOT_ID &&
    latestEvidencePointer?.resolvedRunId === selectedManifest.runId &&
    latestEvidencePointer?.checkerSha256After === checkerSha256After
  ) {
    return {
      runPath: latestEvidencePointer.runPath,
      reused: true,
    };
  }

  const timestamp = new Date().toISOString();
  const runId =
    `earth-geospatial-v7-slot-condition-check-run-selection-repair-` +
    `${V7_SLOT_ID}-${timestamp.replace(/[:.]/g, "-")}`;
  const report = {
    schemaVersion:
      "earth-geospatial-v7-slot-condition-check-run-selection-repair-v1",
    runId,
    status: "completed",
    createdAtUtc: timestamp,
    createdAtAsiaShanghai: formatShanghai(timestamp),
    ownerCommandRef:
      "project-owner-authorized-v7-slot-condition-check-run-selection-repair-20260727",
    requestedV7SlotId: V7_SLOT_ID,
    observedFailure: {
      command:
        `npm run check:earth-geospatial-v7-mvp-slot-condition -- ` +
        `--v7-slot-id ${V7_SLOT_ID}`,
      errorMessage: "V7 slot or bounded authorization identity mismatch",
      cause:
        "The checker loaded the global latest pointer instead of the requested slot's immutable run.",
      causeZh:
        "检查器读取了全局 latest 指针，而不是所请求槽位的不可变运行清单。",
    },
    globalLatestPointerPath: projectPath(LATEST_PATH),
    globalLatestRunId: selection.globalLatestRunId,
    globalLatestV7SlotId: selection.globalLatestV7SlotId,
    globalLatestModified: false,
    resolvedRunId: selectedManifest.runId,
    resolvedRunPath: selection.pointer.runPath,
    resolvedConditionId: selectedManifest.conditionId,
    resolvedV7SlotId: selectedManifest.v7SlotId,
    checkerPath: SCRIPT_PATH,
    checkerSha256Before:
      CHECKER_SHA256_BEFORE_SLOT_RUN_SELECTION_REPAIR,
    checkerSha256After,
    repairScope:
      "Resolve the newest complete immutable run for the explicitly requested V7 slot when the global latest pointer belongs to another slot.",
    repairScopeZh:
      "当全局 latest 指针属于其他槽位时，仅为明确请求的 V7 槽位解析最新完整不可变运行。",
    argumentParserChanged: false,
    worldFactsChanged: false,
    conditionGeometryChanged: false,
    channelContractChanged: false,
    promptChanged: false,
    reviewThresholdChanged: false,
    imageGenerated: false,
    gpuTrainingStarted: false,
    runtimeStarted: false,
    worldPageChanged: false,
    automaticStorage: true,
  };
  const written = writeImmutableProgramRun({
    root: RUN_SELECTION_REPAIR_ROOT,
    runId,
    fileName: "repair-report.json",
    record: report,
    latest: {
      requestedV7SlotId: V7_SLOT_ID,
      resolvedRunId: selectedManifest.runId,
      checkerSha256After,
    },
  });
  appendAiPainterProgramEvent({
    action: "repair_v7_slot_condition_check_run_selection",
    runId,
    kind: "prior_check_failure_recorded",
    status: "failed",
    title: "V7 slot condition check prior run-selection failure recorded",
    titleZh: "V7 槽位条件检查此前运行选择失败已记录",
    detail: report.observedFailure.errorMessage,
    detailZh:
      "此前检查因读取了其他槽位的全局 latest 指针而失败，错误证据现已由程序保存。",
    script: SCRIPT_PATH,
    currentStep: "v7_slot_condition_check_prior_failure_recorded",
    errorCode: "v7_slot_or_bounded_authorization_identity_mismatch",
    evidencePath: written.runPath,
    evidence: [written.runPath, selection.pointer.runPath],
  });
  appendAiPainterProgramEvent({
    action: "repair_v7_slot_condition_check_run_selection",
    runId,
    kind: "repair_completed",
    status: "success",
    title: "V7 slot condition check run selection repaired",
    titleZh: "V7 槽位条件检查运行选择已修复",
    detail:
      "The checker resolved the requested slot's newest complete immutable run without modifying the global latest pointer.",
    detailZh:
      "检查器已解析所请求槽位的最新完整不可变运行，未修改全局 latest 指针。",
    script: SCRIPT_PATH,
    currentStep: "v7_slot_condition_check_run_selection_repaired",
    evidencePath: written.runPath,
    evidence: [written.runPath, selection.pointer.runPath],
  });
  return {
    runPath: written.runPath,
    reused: false,
  };
}

function valueFor(flag) {
  const inline = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
