import { boundsOverlap, boundsTouchesPolygon, expandBounds, pointInPolygon, randomInt } from "./natural-world-geometry.mjs";

// Calculates composition and object placement from the generator's explicit
// context. No source loading, WorldFacts persistence or release operations.
export function createNaturalWorldComposition({
  width: WIDTH, height: HEIGHT, naturalSources,
  V7_SLOT_COMPOSITION_REVISION,
  THAILAND_REBUILD64_FULL_WORLD_DYNAMIC_READINESS_REVISION,
  canonicalSha256, currentPathBoundaryConnection,
  irregularEllipsePolygon, landscapeTypeToEcosystem, assert,
}) {
  const calculations = [canonicalSha256, currentPathBoundaryConnection,
    irregularEllipsePolygon, landscapeTypeToEcosystem, assert];
  if (!(Number.isFinite(WIDTH) && WIDTH > 0 && Number.isFinite(HEIGHT) && HEIGHT > 0 &&
    calculations.every(value => typeof value === "function"))) {
    throw new Error("natural composition requires canvas and calculation dependencies");
  }
  return {
    buildMeasurementDrivenGrasslandForestCompositionArchitecture,
    buildMeasurementDrivenIndependentCompositionArchitecture,
    applyFullWorldDynamicReadinessToComposition,
    buildFullWorldDynamicReadinessContract,
    buildSlotEcologicalZones,
    placeObjects,
    placeObjectsByCompositionArchitecture,
    objectCountFromFacts,
  };

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
    ...(naturalSources ? { scope: "natural_world_runtime_v1", staticRgbRole: "no_rgb_generated_candidate_structure_only" }
      : { appliesToAllThailandRebuild64Slots: true, staticRgbRole: "local_model_positive_target_and_future_game_world_visual_baseline" }),
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
      pathBoundaryPosition: structuredClone(naturalSources ? pathConnection.point : pathConnection.boundaryPosition),
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
      ...(naturalSources ? { freshGenerationRequired: true, trainingSampleMembership: false } : { compareAll64ThemeArchitectureAndInstanceDetail: true }),
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
  const treeRatio = Number(histogram["10"] ?? 0) / (naturalSources ? Object.values(histogram).reduce((sum, n) => sum + Number(n), 0) : WIDTH * HEIGHT);
  return Math.max(34, Math.min(52, Math.round(34 + treeRatio * 18)));
}
}
