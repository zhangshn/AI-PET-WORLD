import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REQUIRED_SOURCE_ROLES = new Set([
  "terrain_elevation_measurement",
  "land_cover_and_human_footprint_screening",
  "regional_climate_and_monsoon_context",
  "soil_property_context",
  "engineered_feature_removal_evidence",
]);
const BOUNDARY_SIDES = ["north", "east", "south", "west"];
export const THAILAND_MVP_SUPPORTED_LANDSCAPE_TYPES = [
  "seasonal-evergreen-semi-evergreen-forest",
  "dry-dipterocarp-woodland",
  "bamboo-grove",
  "tropical-forest-glade",
  "grassland-forest-transition",
  "wet-season-drainage-hollow",
  "forested-low-mountain",
];

export function deriveThailandMvpLandscapeFromWindowFacts({
  assignment,
}) {
  const metrics =
    assignment.measurementMetrics ?? assignment.metrics;
  assert(metrics, "measurement metrics are required for landscape derivation");
  const cover = metrics.reconstructedLandCoverRatio ?? {};
  const relativeElevation = Number(metrics.relativeElevation ?? 0);
  const relativeRelief = Number(metrics.relativeRelief ?? 0);
  const meanSlope = Number(metrics.normalizedSlope?.mean ?? 0);
  const treeCover = Number(cover.treeCover ?? 0);
  const grassland = Number(cover.grassland ?? 0);
  const monsoonSeason = assignment.monsoonSeason;
  let regionalLandscapeType;
  let derivationRule;

  if (grassland >= 0.15) {
    regionalLandscapeType = "grassland-forest-transition";
    derivationRule = "measured_grass_share_at_least_0_15";
  } else if (grassland >= 0.03 && treeCover >= 0.5) {
    regionalLandscapeType = "tropical-forest-glade";
    derivationRule =
      "measured_grass_share_at_least_0_03_inside_tree_mosaic";
  } else if (
    relativeElevation >= 0.68 ||
    relativeRelief >= 0.36
  ) {
    regionalLandscapeType = "forested-low-mountain";
    derivationRule =
      "measured_relative_elevation_or_relief_high";
  } else if (
    relativeElevation <= 0.32 &&
    relativeRelief <= 0.22 &&
    ["wet_season", "dry_to_wet_transition"].includes(
      monsoonSeason,
    )
  ) {
    regionalLandscapeType = "wet-season-drainage-hollow";
    derivationRule =
      "measured_low_relief_drainage_position_in_wet_phase";
  } else if (
    treeCover >= 0.85 &&
    relativeElevation >= 0.35 &&
    relativeElevation <= 0.62 &&
    meanSlope >= 0.12 &&
    meanSlope <= 0.2
  ) {
    regionalLandscapeType = "bamboo-grove";
    derivationRule =
      "regionally_supported_bamboo_on_compatible_measured_forest_slope";
  } else if (
    relativeElevation <= 0.45 &&
    meanSlope <= 0.18
  ) {
    regionalLandscapeType = "dry-dipterocarp-woodland";
    derivationRule =
      "regionally_supported_dry_dipterocarp_on_lower_gentler_window";
  } else {
    regionalLandscapeType =
      "seasonal-evergreen-semi-evergreen-forest";
    derivationRule =
      "regionally_supported_dry_evergreen_default_for_measured_tree_mosaic";
  }

  assert(
    THAILAND_MVP_SUPPORTED_LANDSCAPE_TYPES.includes(
      regionalLandscapeType,
    ),
    "derived landscape is outside the owner-approved Thailand MVP subset",
  );
  return {
    regionalLandscapeType,
    regionalLandscapeTypeStatus:
      "derived_from_current_window_world_facts_and_ecology",
    landscapeDerivation: {
      schemaVersion:
        "thailand-mvp-window-landscape-derivation-v1",
      ruleId: derivationRule,
      quotaAssignmentUsed: false,
      currentWindowFactsUsed: true,
      regionalEcologyFactsUsed: true,
      supportedTypeSubset:
        THAILAND_MVP_SUPPORTED_LANDSCAPE_TYPES,
      factualReferenceId:
        "sakaerat-wang-nam-khiao-mvp-reference-v1",
      measuredEvidence: {
        relativeElevation,
        relativeRelief,
        meanSlope,
        treeCover,
        grassland,
        monsoonSeason,
      },
      exactRealWorldGeometryCarriedForward: false,
      historicalRgbRead: false,
    },
  };
}

export function buildRealEarthRegionSourcePackage({
  root,
  assignment,
  regionContractPath,
  sourceRegistryPath,
  factualReferencePath,
  worldProfilePath,
  seasonSnapshotPath,
  measurementWindowPlanPath,
}) {
  const regionContract = readJson(root, regionContractPath);
  const sourceRegistry = readJson(root, sourceRegistryPath);
  const factualReference = readJson(root, factualReferencePath);
  const worldProfile = readJson(root, worldProfilePath);
  const seasonSnapshot = readJson(root, seasonSnapshotPath);
  const sourceById = new Map(
    (sourceRegistry.sources ?? []).map((entry) => [
      entry.sourceId,
      entry,
    ]),
  );
  const inputs = (regionContract.inputs ?? []).map((input) => {
    const source = sourceById.get(input.sourceId);
    assert(source, `region source is absent from registry: ${input.sourceId}`);
    assert(
      input.role === source.role,
      `region source role mismatch: ${input.sourceId}`,
    );
    verifySourceObject(root, source);
    return {
      sourceId: source.sourceId,
      role: source.role,
      provider: source.provider,
      product: source.product,
      license: source.license,
      attribution: source.attribution ?? null,
      sourceUrl: source.sourceUrl,
      documentationUrl: source.documentationUrl ?? null,
      acquisitionStatus: source.acquisitionStatus,
      acquiredAtUtc:
        source.acquiredAtUtc ??
        source.cacheAcquiredAtUtc ??
        source.remoteObject?.checkedAtUtc ??
        null,
      rawObjects: sourceObjects(source),
      visualTrainingTargetEligible:
        source.visualTrainingTargetEligible === true,
    };
  });
  const presentRoles = new Set(inputs.map((entry) => entry.role));
  for (const role of REQUIRED_SOURCE_ROLES) {
    assert(presentRoles.has(role), `required region source role missing: ${role}`);
  }
  assert(
    inputs.every(
      (entry) => entry.visualTrainingTargetEligible === false,
    ),
    "real-Earth source object cannot become an RGB training target",
  );
  assertBoundsInside(
    assignment.measurementBounds,
    regionContract.observationArea?.bounds,
  );

  const packagePayload = {
    schemaVersion: "real-earth-region-source-package-v1",
    packageId:
      "real-earth-region-source-package-thailand-sakaerat-wang-nam-khiao-mvp-v1",
    status: "mvp_region_source_package_ready_for_condition_compilation",
    identity: {
      realEarthRegionId: "earth:thailand:sakaerat-wang-nam-khiao:mvp-v1",
      countryOrTerritory: "Thailand",
      namedArea: "Sakaerat / Wang Nam Khiao",
      mvpOnly: true,
      spatialBounds: structuredClone(assignment.measurementBounds),
      observationEnvelope: structuredClone(
        regionContract.observationArea?.bounds,
      ),
      coordinateReference: "EPSG:4326",
      observationPeriod:
        seasonSnapshot.environment?.season ?? assignment.monsoonSeason,
    },
    scope: {
      longTermProductScope: "real_earth_multi_region_autonomous_world",
      currentMvpRegionScope:
        "thailand_sakaerat_wang_nam_khiao_only",
      reusableOutsideThailand: false,
      automaticOtherCountryAcquisitionAllowed: false,
    },
    sourceLayers: {
      elevationAndTerrain: sourceIdsForRole(
        inputs,
        "terrain_elevation_measurement",
      ),
      landCover: sourceIdsForRole(
        inputs,
        "land_cover_and_human_footprint_screening",
      ),
      climateAndSeason: sourceIdsForRole(
        inputs,
        "regional_climate_and_monsoon_context",
      ),
      soilAndMoisture: sourceIdsForRole(
        inputs,
        "soil_property_context",
      ),
      hydrology: [
        ...sourceIdsForRole(inputs, "soil_property_context"),
        ...(sourceRegistry.sources ?? [])
          .filter(
            (entry) =>
              entry.role ===
              "aggregate_natural_waterway_morphology_reference",
          )
          .map((entry) => entry.sourceId),
      ],
      ecologyAndSpecies: [
        factualReference.referenceId,
        worldProfile.worldProfileId,
      ],
      regionalConnectivity:
        "derived_per_region_instance_from_current_world_facts",
    },
    sourceProvenance: {
      sourceRegistryPath,
      sourceRegistrySha256: sha256File(root, sourceRegistryPath),
      regionContractPath,
      regionContractSha256: sha256File(root, regionContractPath),
      factualReferencePath,
      factualReferenceSha256: sha256File(root, factualReferencePath),
      worldProfilePath,
      worldProfileSha256: sha256File(root, worldProfilePath),
      seasonSnapshotPath,
      seasonSnapshotSha256: sha256File(root, seasonSnapshotPath),
      measurementWindowPlanPath,
      measurementWindowPlanSha256: sha256File(
        root,
        measurementWindowPlanPath,
      ),
      sources: inputs,
    },
    derivation: {
      humanDevelopmentClassification:
        regionContract.humanRemovalRules,
      removalOrNaturalization:
        regionContract.naturalizationPipeline,
      measurementAggregation:
        "bounded_window_aggregate_facts_without_exact_measurement_geometry",
      anonymousGameCoordinateNormalization:
        "new_per_region_game_coordinates_without_real_navigation_geometry",
      exactRealWorldGeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
      historicalRgbRead: false,
    },
    output: {
      derivedNaturalWorldFactsRequired: true,
      independentRegionalConnectivityRequired: true,
      worldDirectorRequired: true,
      completeMap23ChannelsRequired: true,
      imageGenerationAuthorized: false,
      gpuTrainingAuthorized: false,
    },
  };
  return {
    ...packagePayload,
    packageSha256: canonicalSha256(packagePayload),
  };
}

export function buildIndependentTrainingRegionConnectivity({
  slotId,
  assignment,
  worldProfileId,
  sourcePackage,
  width,
  height,
  hasWater,
  anonymousCompositionArchitectureRevision = null,
}) {
  assert(
    /^v7-capacity-slot-\d{3}$/.test(slotId ?? ""),
    "independent connectivity requires a V7 capacity slot",
  );
  assert(
    sourcePackage?.schemaVersion ===
      "real-earth-region-source-package-v1" &&
      sourcePackage.scope?.currentMvpRegionScope ===
        "thailand_sakaerat_wang_nam_khiao_only" &&
      sourcePackage.scope?.reusableOutsideThailand === false,
    "independent connectivity requires the current Thailand MVP source package",
  );
  const digest = assignment.fingerprints?.direct;
  assert(
    /^[a-f0-9]{64}$/.test(digest ?? ""),
    "independent connectivity requires a measurement fingerprint",
  );
  const bytes = digestBytes(digest, 12);
  assert(
    anonymousCompositionArchitectureRevision === null ||
      (typeof anonymousCompositionArchitectureRevision === "string" &&
        anonymousCompositionArchitectureRevision.length > 0),
    "anonymous connectivity revision must be null or a non-empty string",
  );
  const instanceDigest = anonymousCompositionArchitectureRevision
    ? canonicalSha256({
        schemaVersion: "anonymous-regional-connectivity-revision-v1",
        sourceMeasurementFingerprint: digest,
        anonymousCompositionArchitectureRevision,
      })
    : digest;
  const instanceBytes = digestBytes(instanceDigest, 12);
  const flowingWaterConnectivityRevisions = new Set([
    "owner-authorized-thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-v5-20260801",
    "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801",
  ]);
  const semanticTopologyRevision =
    "owner-authorized-thailand-rebuild64-semantic-topology-diversity-v4-20260801";
  const waterProjectionDigest =
    flowingWaterConnectivityRevisions.has(
      anonymousCompositionArchitectureRevision,
    )
      ? canonicalSha256({
          schemaVersion: "anonymous-regional-connectivity-revision-v1",
          sourceMeasurementFingerprint: digest,
          anonymousCompositionArchitectureRevision:
            semanticTopologyRevision,
        })
      : instanceDigest;
  const waterPlanBytes =
    anonymousCompositionArchitectureRevision ===
    "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-v3-20260731"
      ? bytes
      : digestBytes(waterProjectionDigest, 12);
  const pathSide = assignment.requiredEntranceDirection ??
    BOUNDARY_SIDES[bytes[0] % BOUNDARY_SIDES.length];
  assert(
    BOUNDARY_SIDES.includes(pathSide),
    `registered entrance direction is invalid: ${pathSide}`,
  );
  const pathFraction = round(0.16 + (bytes[1] / 255) * 0.68, 6);
  const pathPosition = boundaryPoint(
    pathSide,
    pathFraction,
    width,
    height,
  );
  const regionId = `training-world:thailand-mvp:${slotId}`;
  const neighborRegionId =
    `training-world:thailand-mvp:adjacent-${pathSide}-${instanceDigest.slice(0, 8)}`;
  const blueprintId =
    `thailand-mvp-${slotId}-independent-region-connectivity-${instanceDigest.slice(0, 12)}`;
  const pathPortId = `${regionId}:port:path-${pathSide}`;
  const pairedPathPortId =
    `${neighborRegionId}:port:path-${oppositeSide(pathSide)}`;
  const interiorEntryDepthContract = {
    version:
      "complete-map-boundary-port-to-interior-depth-v1",
    minimumNormalizedDepth: 0.4,
    maximumNormalizedDepth: 0.72,
    minimumTangentialFraction: 0.2,
    maximumTangentialFraction: 0.8,
    completeMapRouteSpanThreshold: 0.35,
    reviewThresholdChanged: false,
  };
  const entryPoint = anonymousCompositionArchitectureRevision
    ? buildMeasurementDrivenCompositionEntryPoint({
        assignment,
        pathSide,
        bytes: instanceBytes,
        width,
        height,
        contract: interiorEntryDepthContract,
      })
    : buildInteriorEntryPoint({
        pathSide,
        depthByte: instanceBytes[2],
        tangentialByte: instanceBytes[3],
        width,
        height,
        contract: interiorEntryDepthContract,
      });
  const flowingWaterProjectionUpgrade =
    hasWater &&
    flowingWaterConnectivityRevisions.has(
      anonymousCompositionArchitectureRevision,
    );
  const startProjectionShift = flowingWaterProjectionUpgrade
    ? 0.22 +
      clamp(Number(assignment.metrics.relativeRelief ?? 0), 0, 1) *
        0.04
    : 0;
  const endProjectionShift = flowingWaterProjectionUpgrade
    ? -(0.22 +
      clamp(
        Number(assignment.metrics.normalizedSlope?.mean ?? 0),
        0,
        1,
      ) * 0.04)
    : 0;
  const waterStart = {
    x: Math.round(width * clamp(
      0.12 + (waterPlanBytes[4] / 255) * 0.3 +
        startProjectionShift,
      0.08,
      0.92,
    )),
    y: 0,
  };
  const waterEnd = {
    x: Math.round(width * clamp(
      0.58 + (waterPlanBytes[5] / 255) * 0.3 +
        endProjectionShift,
      0.08,
      0.92,
    )),
    y: height,
  };
  const upstreamWaterRegionId =
    `${regionId}:adjacent-north-${digest.slice(0, 8)}`;
  const downstreamWaterRegionId =
    `${regionId}:adjacent-south-${digest.slice(0, 8)}`;
  const upstreamWaterPortId =
    `${regionId}:port:water-north-inlet`;
  const downstreamWaterPortId =
    `${regionId}:port:water-south-outlet`;
  const pairedUpstreamWaterPortId =
    `${upstreamWaterRegionId}:port:water-south-outlet`;
  const pairedDownstreamWaterPortId =
    `${downstreamWaterRegionId}:port:water-north-inlet`;
  const waterPlan = hasWater
    ? {
        mode: waterModeForLandscape(
          assignment.regionalLandscapeType,
        ),
        start: waterStart,
        end: waterEnd,
        startHalfWidth: 34 + (waterPlanBytes[6] % 17),
        endHalfWidth: 34 + (waterPlanBytes[7] % 17),
        externalWaterPorts: [
          {
            edgePortId: upstreamWaterPortId,
            boundarySide: "north",
            boundaryPosition: waterStart,
            flowRole: "upstream_inlet",
          },
          {
            edgePortId: downstreamWaterPortId,
            boundarySide: "south",
            boundaryPosition: waterEnd,
            flowRole: "downstream_outlet",
          },
        ],
        lateralBoundaryContinuationRequired: false,
        boundaryWaterDirectionInvented: false,
        projectionDerivation: flowingWaterProjectionUpgrade
          ? "measurement_relief_and_slope_driven_opposed_bank_inlet_outlet_projection_v2"
          : "measurement_fingerprint_projection",
      }
    : null;
  const waterEdgePorts = hasWater
    ? [
        {
          edgePortId: upstreamWaterPortId,
          regionId,
          kind: "water",
          boundarySide: "north",
          boundaryPosition: waterStart,
          role: "upstream_water_inlet",
          flowRole: "inlet",
          connectsToRegionId: upstreamWaterRegionId,
          connectsToEdgePortId: pairedUpstreamWaterPortId,
        },
        {
          edgePortId: pairedUpstreamWaterPortId,
          regionId: upstreamWaterRegionId,
          kind: "water",
          boundarySide: "south",
          boundaryPosition: null,
          role: "paired_neighbor_water_stub",
          flowRole: "outlet",
          connectsToRegionId: regionId,
          connectsToEdgePortId: upstreamWaterPortId,
        },
        {
          edgePortId: downstreamWaterPortId,
          regionId,
          kind: "water",
          boundarySide: "south",
          boundaryPosition: waterEnd,
          role: "downstream_water_outlet",
          flowRole: "outlet",
          connectsToRegionId: downstreamWaterRegionId,
          connectsToEdgePortId: pairedDownstreamWaterPortId,
        },
        {
          edgePortId: pairedDownstreamWaterPortId,
          regionId: downstreamWaterRegionId,
          kind: "water",
          boundarySide: "north",
          boundaryPosition: null,
          role: "paired_neighbor_water_stub",
          flowRole: "inlet",
          connectsToRegionId: regionId,
          connectsToEdgePortId: downstreamWaterPortId,
        },
      ]
    : [];
  const payload = {
    schemaVersion: "regional-connectivity-instance-v1",
    blueprintId,
    status: "independent_training_region_connectivity_ready",
    connectivityContractId: "natural-home-large-world-connectivity-v1",
    worldProfileId,
    realEarthRegionId: sourcePackage.identity.realEarthRegionId,
    realEarthRegionSourcePackageId: sourcePackage.packageId,
    currentRegion: {
      regionId,
      neighborRegionIds: [
        neighborRegionId,
        ...(hasWater
          ? [upstreamWaterRegionId, downstreamWaterRegionId]
          : []),
      ],
    },
    edgePorts: [
      {
        edgePortId: pathPortId,
        regionId,
        kind: "path",
        boundarySide: pathSide,
        boundaryPosition: pathPosition,
        role: "natural_passage_connection",
        connectsToRegionId: neighborRegionId,
        connectsToEdgePortId: pairedPathPortId,
      },
      {
        edgePortId: pairedPathPortId,
        regionId: neighborRegionId,
        kind: "path",
        boundarySide: oppositeSide(pathSide),
        boundaryPosition: null,
        role: "paired_neighbor_stub",
        connectsToRegionId: regionId,
        connectsToEdgePortId: pathPortId,
      },
      ...waterEdgePorts,
    ],
    pathGraph: {
      pathGraphId: `${blueprintId}:path-graph`,
      nodes: ["entry_point", pathPortId],
      edges: [
        {
          source: "entry_point",
          target: pathPortId,
          coordinates: [entryPoint, pathPosition],
        },
      ],
    },
    hydrologyGraph: {
      hydrologyGraphId: `${blueprintId}:hydrology-graph`,
      mode: waterPlan?.mode ?? "no_major_visible_water",
      externalWaterPortIds: waterPlan
        ? [upstreamWaterPortId, downstreamWaterPortId]
        : [],
      upstreamPortId: waterPlan ? upstreamWaterPortId : null,
      downstreamPortId: waterPlan ? downstreamWaterPortId : null,
      flowAxis: waterPlan ? "north_to_south" : null,
      directedEdges: waterPlan
        ? [
            {
              source: upstreamWaterPortId,
              target: downstreamWaterPortId,
            },
          ]
        : [],
      worldFactWaterRequired: hasWater,
    },
    walkableGraph: {
      walkableGraphId: `${blueprintId}:walkable-graph`,
      nodes: ["entry_point", pathPortId],
      connected: true,
    },
    anonymousTrainingCoordinateProjection: {
      schemaVersion:
        "measurement-driven-independent-region-coordinate-projection-v2",
      projectionSha256: canonicalSha256({
        digest,
        ...(anonymousCompositionArchitectureRevision
          ? { anonymousCompositionArchitectureRevision }
          : {}),
        pathSide,
        pathFraction,
        entryPoint,
        interiorEntryDepthContract,
        waterPlan,
      }),
      sourceMeasurementFingerprint: digest,
      ...(anonymousCompositionArchitectureRevision
        ? { anonymousCompositionArchitectureRevision }
        : {}),
      ...(anonymousCompositionArchitectureRevision
        ? {
            compositionEntryDerivation: {
              method:
                "aggregate_grass_tree_drainage_relief_to_anonymous_ecotone_passage_anchor_v2",
              regionalLandscapeType:
                assignment.regionalLandscapeType,
              grasslandRatio:
                assignment.metrics.reconstructedLandCoverRatio
                  .grassland,
              treeCoverRatio:
                assignment.metrics.reconstructedLandCoverRatio
                  .treeCover,
              drainageLikelihoodRatio:
                assignment.metrics.drainageLikelihoodRatio,
              relativeRelief: assignment.metrics.relativeRelief,
              exactMeasurementGeometryCarriedForward: false,
              historicalLayoutRead: false,
            },
          }
        : {}),
      pathPlan: {
        boundarySide: pathSide,
        boundaryFraction: pathFraction,
        boundaryPosition: pathPosition,
        interiorEntryPoint: entryPoint,
        interiorEntryDepthContract,
      },
      waterPlan,
      baseConcreteRegionBlueprintRead: false,
      region0001ConcreteInstanceRead: false,
      fixedNorthSouthEastWaterPortsUsed: false,
      fixedSouthPathPortUsed: false,
      historicalGeometryRead: false,
      historicalRgbRead: false,
      mirrorOrRotationTransformApplied: false,
    },
    identityBoundary: {
      concreteRegionInstanceReuseAllowed: false,
      region0001InstanceInherited: false,
      currentRegionWorldGraphConnected: true,
      exactRealWorldGeometryCarriedForward: false,
      historicalRgbRead: false,
    },
  };
  return {
    ...payload,
    connectivityInstanceSha256: canonicalSha256(payload),
  };
}

function buildMeasurementDrivenCompositionEntryPoint({
  assignment,
  pathSide,
  bytes,
  width,
  height,
  contract,
}) {
  const cover = assignment.metrics.reconstructedLandCoverRatio;
  const grassland = clamp(Number(cover.grassland ?? 0), 0, 1);
  const treeCover = clamp(Number(cover.treeCover ?? 0), 0, 1);
  const drainage = clamp(
    Number(assignment.metrics.drainageLikelihoodRatio ?? 0),
    0,
    1,
  );
  const relief = clamp(
    Number(assignment.metrics.relativeRelief ?? 0),
    0,
    1,
  );
  const depth = clamp(
    0.56 + drainage * 0.1 + grassland * 0.09 -
      relief * 0.08 + (bytes[2] / 255 - 0.5) * 0.06,
    contract.minimumNormalizedDepth,
    contract.maximumNormalizedDepth,
  );
  const tangential = clamp(
    0.72 + treeCover * 0.08 - grassland * 0.06 +
      (bytes[3] / 255 - 0.5) * 0.08,
    contract.minimumTangentialFraction,
    contract.maximumTangentialFraction,
  );
  const depthByte = Math.round(
    ((depth - contract.minimumNormalizedDepth) /
      (contract.maximumNormalizedDepth -
        contract.minimumNormalizedDepth)) * 255,
  );
  const tangentialByte = Math.round(
    ((tangential - contract.minimumTangentialFraction) /
      (contract.maximumTangentialFraction -
        contract.minimumTangentialFraction)) * 255,
  );
  return buildInteriorEntryPoint({
    pathSide,
    depthByte,
    tangentialByte,
    width,
    height,
    contract,
  });
}

function buildInteriorEntryPoint({
  pathSide,
  depthByte,
  tangentialByte,
  width,
  height,
  contract,
}) {
  const depth =
    contract.minimumNormalizedDepth +
    (depthByte / 255) *
      (contract.maximumNormalizedDepth -
        contract.minimumNormalizedDepth);
  const tangential =
    contract.minimumTangentialFraction +
    (tangentialByte / 255) *
      (contract.maximumTangentialFraction -
        contract.minimumTangentialFraction);
  if (pathSide === "west") {
    return {
      x: Math.round(width * depth),
      y: Math.round(height * tangential),
    };
  }
  if (pathSide === "east") {
    return {
      x: Math.round(width * (1 - depth)),
      y: Math.round(height * tangential),
    };
  }
  if (pathSide === "north") {
    return {
      x: Math.round(width * tangential),
      y: Math.round(height * depth),
    };
  }
  return {
    x: Math.round(width * tangential),
    y: Math.round(height * (1 - depth)),
  };
}

export function buildCompleteMapStructuralIdentities({
  connectivity,
  geometry,
}) {
  const themePayload = {
    connectivity: {
      blueprintId: connectivity.blueprintId,
      currentRegionId: connectivity.currentRegion?.regionId,
      neighborCount:
        connectivity.currentRegion?.neighborRegionIds?.length ?? 0,
      currentPorts: (connectivity.edgePorts ?? [])
        .filter(
          (entry) =>
            entry.regionId === connectivity.currentRegion?.regionId,
        )
        .map((entry) => ({
          kind: entry.kind,
          boundarySide: entry.boundarySide,
          role: entry.role,
        })),
      hydrologyMode: connectivity.hydrologyGraph?.mode ?? null,
    },
    routeTopology: geometry.routeTopology,
    hasWater: geometry.hasWater,
    terrainKinds: [
      ...new Set(
        (geometry.terrainRegions ?? []).map((entry) => entry.kind),
      ),
    ].sort(),
    ecologicalZoneKinds: (geometry.ecologicalZones ?? [])
      .map((entry) => entry.kind)
      .sort(),
    naturalBoundaryCount:
      geometry.naturalBoundaryPolygons?.length ?? 0,
  };
  const detailPayload = {
    pathCenterline: quantizePoints(geometry.pathCenterline),
    waterCenterline: quantizePoints(geometry.waterCenterline),
    branchCenterlines: (geometry.branchCenterlines ?? []).map(
      quantizePoints,
    ),
    terrainRegions: (geometry.terrainRegions ?? []).map((entry) => ({
      kind: entry.kind,
      polygon: quantizePoints(entry.polygon),
    })),
    objectFootprints: (geometry.objectFootprints ?? []).map(
      (entry) => ({
        kind: entry.kind,
        bounds: entry.bounds,
        polygon: quantizePoints(entry.polygon),
      }),
    ),
  };
  return {
    schemaVersion: "complete-map-structural-identities-v1",
    themeArchitectureIdentity: canonicalSha256(themePayload),
    instanceDetailIdentity: canonicalSha256(detailPayload),
    themeArchitecturePayloadSha256: canonicalSha256(themePayload),
    instanceDetailPayloadSha256: canonicalSha256(detailPayload),
    comparisonRequiredAgainstAllHistory: true,
    directMirrorVerticalMirrorAndRotate180Required: true,
  };
}

function waterModeForLandscape(type) {
  if (/swamp|marsh/.test(type)) return "internal_wetland_network";
  if (/pond/.test(type)) return "internal_pond_and_short_creek";
  if (/river|floodplain|riparian|stream|creek/.test(type)) {
    return "internal_measurement_derived_flow_network";
  }
  return "internal_world_fact_water";
}

function boundaryPoint(side, fraction, width, height) {
  if (side === "north") return { x: Math.round(width * fraction), y: 0 };
  if (side === "south") {
    return { x: Math.round(width * fraction), y: height };
  }
  if (side === "west") return { x: 0, y: Math.round(height * fraction) };
  return { x: width, y: Math.round(height * fraction) };
}

function oppositeSide(side) {
  return {
    north: "south",
    east: "west",
    south: "north",
    west: "east",
  }[side];
}

function sourceIdsForRole(inputs, role) {
  return inputs
    .filter((entry) => entry.role === role)
    .map((entry) => entry.sourceId);
}

function sourceObjects(source) {
  const objects = [];
  if (source.cachePath) {
    objects.push({
      path: source.cachePath,
      sha256: source.cacheSha256,
      byteSize: source.cacheByteSize,
    });
  }
  if (source.rawResponsePath) {
    objects.push({
      path: source.rawResponsePath,
      sha256: source.rawResponseSha256,
    });
  }
  for (const property of source.acquiredProperties ?? []) {
    objects.push({
      path: property.sourcePath,
      sha256: property.sourceSha256,
      propertyId: property.propertyId,
    });
  }
  return objects;
}

function verifySourceObject(root, source) {
  for (const object of sourceObjects(source)) {
    assert(
      typeof object.path === "string" &&
        fs.existsSync(resolve(root, object.path)),
      `region source object missing: ${source.sourceId}`,
    );
    assert(
      /^[a-f0-9]{64}$/.test(object.sha256 ?? "") &&
        sha256File(root, object.path) === object.sha256,
      `region source object hash mismatch: ${source.sourceId}`,
    );
  }
}

function assertBoundsInside(inner, outer) {
  assert(
    inner &&
      outer &&
      inner.west >= outer.west &&
      inner.east <= outer.east &&
      inner.south >= outer.south &&
      inner.north <= outer.north,
    "measurement bounds are outside the approved Thailand MVP package",
  );
}

function quantizePoints(points) {
  return (points ?? []).map((point) => ({
    x: Math.round(Number(point.x)),
    y: Math.round(Number(point.y)),
  }));
}

function digestBytes(value, count) {
  return Array.from({ length: count }, (_, index) =>
    Number.parseInt(value.slice(index * 2, index * 2 + 2), 16),
  );
}

function canonicalSha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortKeys(value)))
    .digest("hex");
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])]),
  );
}

function sha256File(root, filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(resolve(root, filePath)))
    .digest("hex");
}

function readJson(root, filePath) {
  return JSON.parse(fs.readFileSync(resolve(root, filePath), "utf8"));
}

function resolve(root, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function round(value, places) {
  return Number(value.toFixed(places));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
