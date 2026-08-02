import crypto from "node:crypto";

export const MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID =
  "aggregate_natural_facts_plus_eight_band_quantized_dem_d8_to_independent_anonymous_water_and_full_free_space_route_geometry_v44";
export const MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY =
  "measurement_fact_driven_independent_full_free_space_route_structures_v10";
export const MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY =
  "measurement_fact_driven_anonymous_eight_band_floodplain_river_network_v26";

const WATER_ROUTE_TOPOLOGIES = [
  "seeded_interior_to_current_region_port_passage",
  "upper_interior_to_current_region_port_passage",
  "lower_interior_to_current_region_port_passage",
  "transverse_interior_to_current_region_port_passage",
];
const NON_WATER_ROUTE_TOPOLOGIES = [
  "seeded_interior_to_current_region_port_passage",
  "upper_interior_to_current_region_port_passage",
  "lower_interior_to_current_region_port_passage",
  "transverse_interior_to_current_region_port_passage",
];
const WATER_CONTROL_PROFILES = [
  [0.08, 0.12, 0.16, 0.2],
  [0.18, 0.24, 0.3, 0.36],
  [0.32, 0.38, 0.44, 0.5],
  [0.46, 0.5, 0.54, 0.58],
];
const ROUTE_START_PROFILES = [
  { xMinimum: 90, xMaximum: 180, yMinimum: 70, yMaximum: 180 },
  { xMinimum: 180, xMaximum: 290, yMinimum: 100, yMaximum: 220 },
  { xMinimum: 260, xMaximum: 380, yMinimum: 130, yMaximum: 250 },
  { xMinimum: 100, xMaximum: 210, yMinimum: 80, yMaximum: 190 },
];

export function buildMeasurementDrivenAnonymousLayoutProfile({
  assignment,
  hasWater,
  coarseHydrologyProfile = null,
  routeSearchExpansionRevision = null,
}) {
  assertAssignment(assignment);
  if (coarseHydrologyProfile) {
    if (
      coarseHydrologyProfile.measurementFingerprint !==
        assignment.fingerprints.direct ||
      coarseHydrologyProfile.identityBoundary
        ?.exactD8GeometryCarriedForward !== false ||
      coarseHydrologyProfile.identityBoundary
        ?.connectivityPortsAreBoundaryConstraintsOnly !== true ||
      coarseHydrologyProfile.identityBoundary
        ?.finalGameCoordinatesRemainAnonymous !== true ||
      !/^[a-f0-9]{64}$/.test(
        coarseHydrologyProfile.profileSha256 ?? "",
      )
    ) {
      throw new Error(
        "coarse hydrology profile crossed the anonymous geometry boundary",
      );
    }
  }
  const aggregateFactBinding = {
    measurementFingerprint: assignment.fingerprints.direct,
    regionalLandscapeType: assignment.regionalLandscapeType,
    monsoonSeason: assignment.monsoonSeason,
    meanElevationMetres: assignment.metrics.elevationMetres.mean,
    relativeElevation: assignment.metrics.relativeElevation,
    relativeRelief: assignment.metrics.relativeRelief,
    normalizedSlopeMean: assignment.metrics.normalizedSlope.mean,
    drainageLikelihoodRatio:
      assignment.metrics.drainageLikelihoodRatio,
    reconstructedLandCoverRatio: {
      treeCover:
        assignment.metrics.reconstructedLandCoverRatio.treeCover,
      shrubland:
        assignment.metrics.reconstructedLandCoverRatio.shrubland,
      grassland:
        assignment.metrics.reconstructedLandCoverRatio.grassland,
      bareOrSparse:
        assignment.metrics.reconstructedLandCoverRatio.bareOrSparse,
    },
  };
  const measurementTopologyFingerprint = sha256(
    JSON.stringify(aggregateFactBinding),
  );
  const layoutSelectionByte =
    measurementTopologyFingerprint.slice(0, 2);
  const waterControlProfileSelectionByte =
    measurementTopologyFingerprint.slice(2, 4);
  const routeTopologySelectionByte =
    measurementTopologyFingerprint.slice(8, 10);
  const internalHydrologySelectionByte =
    measurementTopologyFingerprint.slice(10, 12);
  const floodplainBasinSelectionByte =
    measurementTopologyFingerprint.slice(12, 14);
  const layoutIndex =
    Number.parseInt(layoutSelectionByte, 16) %
    ROUTE_START_PROFILES.length;
  const waterControlProfileIndex =
    Number.parseInt(waterControlProfileSelectionByte, 16) %
    WATER_CONTROL_PROFILES.length;
  const routeTopologyIndex =
    Number.parseInt(routeTopologySelectionByte, 16) %
    (hasWater
      ? WATER_ROUTE_TOPOLOGIES.length
      : NON_WATER_ROUTE_TOPOLOGIES.length);
  const routeTopology = (
    hasWater
      ? WATER_ROUTE_TOPOLOGIES
      : NON_WATER_ROUTE_TOPOLOGIES
  )[routeTopologyIndex];
  const internalHydrologyProfile = hasWater
    ? buildInternalHydrologyProfile({
        aggregateFactBinding,
        measurementTopologyFingerprint,
        internalHydrologySelectionByte,
        floodplainBasinSelectionByte,
        coarseHydrologyProfile,
      })
    : null;
  const waterAvoidingRoutePlan = coarseHydrologyProfile
    ? buildCoarseHydrologyRoutePlan(
        coarseHydrologyProfile,
        routeTopology,
        aggregateFactBinding,
        routeSearchExpansionRevision,
      )
    : null;
  const payload = {
    schemaVersion:
      "aggregate-natural-facts-measurement-driven-anonymous-layout-profile-v32",
    layoutIndex,
    layoutVariant:
      `measurement_fact_anonymous_layout_${layoutIndex + 1}`,
    waterControlProfileIndex,
    waterControlFractions:
      WATER_CONTROL_PROFILES[waterControlProfileIndex],
    routeStartBounds: ROUTE_START_PROFILES[layoutIndex],
    routeTopologyIndex,
    routeTopology,
    waterAvoidingRoutePlan,
    internalHydrologyProfile,
    coarseHydrologyMainChannelProfile:
      coarseHydrologyProfile
        ? structuredClone(coarseHydrologyProfile)
        : null,
    topologySelection: {
      method:
        coarseHydrologyProfile
          ? "measurement_window_aggregate_facts_plus_all_eight_quantized_dem_d8_to_independent_main_channel_lateral_continuation_tributary_backwater_and_full_canvas_route_network_v15"
          : "measurement_window_fingerprint_plus_aggregate_natural_facts_digest_bytes_v1",
      measurementTopologyFingerprint,
      layoutSelectionByte,
      waterControlProfileSelectionByte,
      routeTopologySelectionByte,
      internalHydrologySelectionByte,
      floodplainBasinSelectionByte,
      retrySeedAffectsMacroTopology: false,
      retrySeedScope:
        "micro_curve_width_object_and_boundary_variation_only",
      coarseHydrologyAffectsMainChannel:
        Boolean(coarseHydrologyProfile),
      coarseHydrologyAffectsAnabranchAndFloodplain:
        Boolean(coarseHydrologyProfile),
    },
    aggregateFactBinding,
    identityBoundary: {
      exactMeasurementGeometryCarriedForward: false,
      sourcePixelWindowCarriedForward: false,
      exactD8GeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
      historicalRgbRead: false,
      historicalLayoutRead: false,
      slotSpecificBranchUsed: false,
      finalGameCoordinatesRemainAnonymous: true,
    },
  };
  return {
    ...payload,
    profileSha256: sha256(JSON.stringify(payload)),
  };
}

function buildCoarseHydrologyRoutePlan(
  coarseHydrologyProfile,
  routeTopology,
  aggregateFactBinding,
  routeSearchExpansionRevision,
) {
  const bands = coarseHydrologyProfile.coarseBands;
  const maximumSupport = Math.max(
    ...bands.map((entry) => entry.anonymousSupportFraction),
  );
  const maximumSupportBandIndex = bands.findIndex(
    (entry) => entry.anonymousSupportFraction === maximumSupport,
  );
  const uncappedFirstRouteBandIndex = Math.min(
    bands.length - 2,
    maximumSupportBandIndex + 1,
  );
  const maximumCompleteMapStartBandIndex = Math.floor(
    bands.length * 0.5,
  );
  const upperCompleteMapPassageBands = bands.slice(
    0,
    maximumCompleteMapStartBandIndex,
  );
  const upperPassagePressures =
    upperCompleteMapPassageBands.map((entry) =>
      round(
        clamp(entry.anonymousSupportFraction, 0, 1) * 0.62 +
          clamp(entry.quantizedRelativeSupport, 0, 1) * 0.38,
        6,
      ),
    );
  const minimumUpperPassagePressure = Math.min(
    ...upperPassagePressures,
  );
  const minimumUpperPassagePressureBandIndex =
    upperPassagePressures.findIndex(
      (value) => value === minimumUpperPassagePressure,
    );
  const lowerTransverse =
    routeTopology ===
    "transverse_interior_to_current_region_port_passage";
  const westBoundaryDiagonal = false;
  const firstRouteBandIndex = lowerTransverse
    ? bands.length - 1
    : minimumUpperPassagePressureBandIndex;
  const startYFraction = lowerTransverse
    ? 0.9
    : (firstRouteBandIndex + 0.5) / bands.length;
  const routeMacroProfile =
    buildMeasurementDrivenRouteMacroProfile({
      bands,
      aggregateFactBinding,
      firstRouteBandIndex,
      routeTopology,
    });
  const routeOriginDigest = sha256(
    JSON.stringify({
      measurementFingerprint:
        aggregateFactBinding.measurementFingerprint,
      routeTopology,
      bandPressures: routeMacroProfile.bandPressures,
      aggregateFactInputs:
        routeMacroProfile.aggregateFactInputs,
    }),
  );
  const routeOriginSelectionByte =
    routeOriginDigest.slice(0, 2);
  const expandedRouteSearch =
    [
      "owner-authorized-thailand-rebuild64-semantic-topology-diversity-v4-20260801",
      "owner-authorized-thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-v5-20260801",
      "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801",
    ].includes(routeSearchExpansionRevision);
  const lateralVariantCount = expandedRouteSearch ? 2 : 1;
  const candidateOriginFractions = Array.from(
    { length: bands.length * 2 * lateralVariantCount },
    (_, index) => {
      const bandIndex =
        Math.floor(index / lateralVariantCount) % bands.length;
      const verticalTier = Math.floor(
        index / (bands.length * lateralVariantCount),
      );
      const lateralVariant = index % lateralVariantCount;
      const candidateDigest = sha256(
        JSON.stringify({
          routeOriginDigest,
          bandIndex,
          verticalTier,
          ...(expandedRouteSearch ? { lateralVariant } : {}),
          pressure: routeMacroProfile.bandPressures[bandIndex],
          directSupport:
            bands[bandIndex].anonymousSupportFraction,
          relativeSupport:
            bands[bandIndex].quantizedRelativeSupport,
        }),
      );
      const xByte = Number.parseInt(
        candidateDigest.slice(0, 2),
        16,
      );
      const yByte = Number.parseInt(
        candidateDigest.slice(2, 4),
        16,
      );
      const bandCenter = (bandIndex + 0.5) / bands.length;
      const tierBase =
        verticalTier === 0
          ? 0.08 + bandCenter * 0.48
          : 0.42 + bandCenter * 0.48;
      return {
        x: round(0.08 + (xByte / 255) * 0.84, 6),
        y: round(
          clamp(tierBase + (yByte / 255 - 0.5) * 0.08, 0.08, 0.92),
          6,
        ),
      };
    },
  );
  const preferredOriginIndex =
    Number.parseInt(routeOriginSelectionByte, 16) %
    candidateOriginFractions.length;
  return {
    schemaVersion:
      expandedRouteSearch
        ? "measurement-driven-full-free-space-route-plan-v10"
        : "measurement-driven-full-free-space-route-plan-v8",
    method:
      expandedRouteSearch
        ? "measurement_selected_anonymous_origin_candidates_plus_connectivity_boundary_projected_candidates_then_full_canvas_water_collision_rejection"
        : "measurement_selected_anonymous_origin_candidates_then_full_canvas_water_collision_rejection",
    routeTopology,
    completeMapSpanMode: lowerTransverse
      ? "lower_transverse_horizontal_span"
      : westBoundaryDiagonal
        ? "west_interior_to_south_diagonal_span"
        : "interior_to_south_longitudinal_span",
    sourceBandCount: bands.length,
    maximumSupportFraction: maximumSupport,
    maximumSupportBandIndex,
    uncappedFirstRouteBandIndex,
    maximumCompleteMapStartBandIndex,
    upperPassagePressures,
    minimumUpperPassagePressure,
    minimumUpperPassagePressureBandIndex,
    passageOriginSelectionMethod:
      lowerTransverse
        ? "measurement_selected_lower_transverse_boundary_class"
        : "minimum_combined_lateral_and_relative_hydrologic_pressure_in_upper_complete_map_half",
    completeMapMinimumLongitudinalSpanRatio: lowerTransverse
      ? null
      : 0.5,
    completeMapMinimumHorizontalSpanRatio: lowerTransverse
      ? 0.35
      : westBoundaryDiagonal
        ? 0.09
        : null,
    firstRouteBandIndex,
    startYFraction: round(startYFraction, 6),
    routeOriginSelectionByte,
    preferredOriginIndex,
    routeOriginDerivation:
      expandedRouteSearch
        ? "thai_measurement_eight_band_statistics_to_two_tier_two_lateral_variant_anonymous_full_canvas_origin_fractions"
        : "thai_measurement_eight_band_statistics_to_two_tier_anonymous_full_canvas_origin_fractions",
    candidateOriginFractions,
    candidateOriginCount: candidateOriginFractions.length,
    boundaryProjectedCandidateExpansionRequired: expandedRouteSearch,
    boundaryProjectedCandidateDerivation: expandedRouteSearch
      ? "project_each_measurement_selected_origin_depth_into_the_current_connectivity_bank_half_while_preserving_its_measurement_selected_tangential_fraction"
      : null,
    completeMapMinimumChordRatio: 0.28,
    candidateAttemptsPerOrigin: expandedRouteSearch ? 12 : 6,
    routeSearchExpansionRevision:
      routeSearchExpansionRevision ?? null,
    routeMacroProfile,
    sourcePixelCoordinatesRead: false,
    exactD8GeometryCarriedForward: false,
    historicalGeometryRead: false,
    fixedSharedSkeletonUsed: false,
    connectivityPortsAreBoundaryConstraintsOnly: true,
    retrySeedAffectsMacroTopology: false,
  };
}

function buildMeasurementDrivenRouteMacroProfile({
  bands,
  aggregateFactBinding,
  firstRouteBandIndex,
  routeTopology,
}) {
  const relief = clamp(
    aggregateFactBinding.relativeRelief,
    0,
    1,
  );
  const slope = clamp(
    aggregateFactBinding.normalizedSlopeMean,
    0,
    0.25,
  );
  const drainage = clamp(
    aggregateFactBinding.drainageLikelihoodRatio,
    0,
    1,
  );
  const bandPressures = bands.map((entry) =>
    round(
      clamp(entry.anonymousSupportFraction, 0, 1) * 0.62 +
        clamp(entry.quantizedRelativeSupport, 0, 1) * 0.38,
      6,
    ),
  );
  const meanBandPressure =
    bandPressures.reduce((total, value) => total + value, 0) /
    bandPressures.length;
  const bandPressureRange =
    Math.max(...bandPressures) - Math.min(...bandPressures);
  const profile = {
    schemaVersion:
      "measurement-driven-independent-anonymous-route-macro-profile-v2",
    method:
      "all_eight_quantized_dem_d8_support_bands_plus_aggregate_relief_slope_and_drainage_to_ranked_full_free_space_origins_v2",
    routeTopology,
    sourceBandCount: bands.length,
    firstRouteBandIndex,
    bandPressures,
    meanBandPressure: round(meanBandPressure, 6),
    bandPressureRange: round(bandPressureRange, 6),
    aggregateFactInputs: {
      relativeRelief: round(relief, 6),
      normalizedSlopeMean: round(slope, 6),
      drainageLikelihoodRatio: round(drainage, 6),
    },
    connectivityPortsAreBoundaryConstraintsOnly: true,
    currentRegionPathPortChanged: false,
    slotIdentityRead: false,
    retrySeedRead: false,
    historicalGeometryRead: false,
    historicalRgbRead: false,
    fixedSharedSkeletonUsed: false,
    exactMeasurementGeometryCarriedForward: false,
    exactD8GeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
  };
  return {
    ...profile,
    profileSha256: sha256(JSON.stringify(profile)),
  };
}

function buildInternalHydrologyProfile({
  aggregateFactBinding,
  measurementTopologyFingerprint,
  internalHydrologySelectionByte,
  floodplainBasinSelectionByte,
  coarseHydrologyProfile,
}) {
  const hydrologyByte = Number.parseInt(
    internalHydrologySelectionByte,
    16,
  );
  const basinByte = Number.parseInt(
    floodplainBasinSelectionByte,
    16,
  );
  const slope = clamp(
    aggregateFactBinding.normalizedSlopeMean,
    0,
    0.5,
  );
  const relief = clamp(
    aggregateFactBinding.relativeRelief,
    0,
    1,
  );
  const drainage = clamp(
    aggregateFactBinding.drainageLikelihoodRatio,
    0,
    1,
  );
  const eightBandNetworkRequired = Boolean(
    coarseHydrologyProfile,
  );
  const coarseBands =
    coarseHydrologyProfile?.coarseBands ?? [];
  const directBandSupports = coarseBands.map(
    (entry) => entry.anonymousSupportFraction,
  );
  const relativeBandSupports = coarseBands.map(
    (entry) => entry.quantizedRelativeSupport,
  );
  const directSupportMean = eightBandNetworkRequired
    ? mean(directBandSupports)
    : null;
  const upperDirectSupportMean = eightBandNetworkRequired
    ? mean(directBandSupports.slice(0, 4))
    : null;
  const lowerDirectSupportMean = eightBandNetworkRequired
    ? mean(directBandSupports.slice(4, 8))
    : null;
  const relativeSupportMean = eightBandNetworkRequired
    ? mean(relativeBandSupports)
    : null;
  const relativeSupportMinimum = eightBandNetworkRequired
    ? Math.min(...relativeBandSupports)
    : null;
  const relativeSupportMaximum = eightBandNetworkRequired
    ? Math.max(...relativeBandSupports)
    : null;
  const relativeSupportRange = eightBandNetworkRequired
    ? relativeSupportMaximum - relativeSupportMinimum
    : null;
  const branchSide = eightBandNetworkRequired
    ? lowerDirectSupportMean >= upperDirectSupportMean
      ? "east"
      : "west"
    : hydrologyByte % 2 === 1
      ? "west"
      : "east";
  const activeRelativeBands = eightBandNetworkRequired
    ? coarseBands.filter(
        (entry) =>
          entry.quantizedRelativeSupport >=
          relativeSupportMean,
      )
    : [];
  const strongestRelativeBandIndexValue =
    eightBandNetworkRequired
      ? relativeBandSupports.indexOf(
          Math.max(...relativeBandSupports),
        )
      : -1;
  const strongestDirectBandIndexValue =
    eightBandNetworkRequired
      ? directBandSupports.indexOf(Math.max(...directBandSupports))
      : -1;
  const strongestRelativeBandForSpan =
    eightBandNetworkRequired
      ? coarseBands[strongestRelativeBandIndexValue]
      : null;
  const strongestRelativeBand = eightBandNetworkRequired
    ? [...coarseBands].sort(
        (left, right) =>
          right.quantizedRelativeSupport -
            left.quantizedRelativeSupport ||
          right.anonymousSupportFraction -
            left.anonymousSupportFraction ||
          left.anonymousBandIndex -
            right.anonymousBandIndex,
      )[0]
    : null;
  const firstActiveBand = activeRelativeBands[0] ?? null;
  const measurementSelectedUpstreamBandIndex =
    eightBandNetworkRequired
      ? Math.min(
          strongestDirectBandIndexValue,
          strongestRelativeBandIndexValue,
        )
      : -1;
  const measurementSelectedDownstreamBandIndex =
    eightBandNetworkRequired
      ? Math.max(
          strongestDirectBandIndexValue,
          strongestRelativeBandIndexValue,
        )
      : -1;
  const divergenceFraction = eightBandNetworkRequired
    ? round(
        clamp(
          coarseBands[
            Math.min(
              measurementSelectedUpstreamBandIndex,
              4,
            )
          ]?.anonymousLongitudinalFraction ??
            activeRelativeBands[0]?.anonymousLongitudinalFraction ??
            0.1875,
          0.1,
          0.58,
        ),
        6,
      )
    : round(
        0.15 +
          slope * 0.12 +
          (hydrologyByte % 3) * 0.01,
        6,
      );
  const rejoinFraction = eightBandNetworkRequired
    ? round(
        clamp(
          Math.max(
            coarseBands[
              Math.min(
                measurementSelectedDownstreamBandIndex + 1,
                coarseBands.length - 1,
              )
            ]?.anonymousLongitudinalFraction ??
              strongestRelativeBandForSpan?.anonymousLongitudinalFraction ??
              0.8125,
            divergenceFraction + 0.24,
          ),
          divergenceFraction + 0.24,
          0.94,
        ),
        6,
      )
    : round(
        0.49 +
          relief * 0.1 +
          (basinByte % 3) * 0.01,
        6,
      );
  const lateralOffsetFraction = eightBandNetworkRequired
    ? round(
        clamp(
          0.12 +
            Math.abs(0.5 - directSupportMean) * 0.18 +
            relativeSupportRange * 0.13,
          0.12,
          0.3,
        ),
        6,
      )
    : round(
        0.1 +
          (1 - aggregateFactBinding.relativeElevation) * 0.045 +
          (hydrologyByte % 5) * 0.006,
        6,
      );
  const branchWidthScale = eightBandNetworkRequired
    ? round(
        clamp(
          0.25 +
            drainage * 0.05 +
            relativeSupportMean * 0.04,
          0.28,
          0.38,
        ),
        6,
      )
    : round(
        0.34 +
          drainage * 0.07 +
          (basinByte % 4) * 0.012,
        6,
      );
  const preferredSinuosity = round(
    1.34 + slope * 0.28 + (hydrologyByte % 4) * 0.025,
    6,
  );
  const backwaterBasinRadiusXFraction =
    eightBandNetworkRequired
      ? round(
          clamp(
            0.045 +
              relativeSupportRange * 0.07 +
              drainage * 0.01,
            0.045,
            0.115,
          ),
          6,
        )
      : round(
          0.075 +
            drainage * 0.018 +
            (basinByte % 3) * 0.006,
          6,
        );
  const backwaterBasinRadiusYFraction =
    eightBandNetworkRequired
      ? round(
          clamp(
            0.025 +
              relief * 0.03 +
              relativeSupportMean * 0.02,
            0.025,
            0.05,
          ),
          6,
        )
      : round(
          0.038 +
            relief * 0.025 +
            (hydrologyByte % 3) * 0.004,
          6,
        );
  const branchDirection = branchSide === "west" ? -1 : 1;
  const westernNaturalPassageWaterCenterMinimumFraction =
    eightBandNetworkRequired && branchSide === "west"
      ? round(
          clamp(
            firstActiveBand?.anonymousSupportFraction ??
              directSupportMean,
            0.22,
            0.42,
          ),
          6,
        )
      : null;
  const branchSupportMinimum =
    westernNaturalPassageWaterCenterMinimumFraction ?? 0.02;
  const branchSupportMaximum =
    branchSide === "east" ? 0.78 : 0.98;
  const branchAnonymousSupportFractions =
    eightBandNetworkRequired
      ? directBandSupports.map((support, index) =>
          round(
            clamp(
              support +
                branchDirection *
                  lateralOffsetFraction *
                  (0.72 +
                    (1 - relativeBandSupports[index]) * 0.28),
              branchSupportMinimum,
              branchSupportMaximum,
            ),
            6,
          ),
        )
      : null;
  const relativeSupportAboveMeanCount = eightBandNetworkRequired
    ? relativeBandSupports.filter(
        (support) => support >= relativeSupportMean,
      ).length
    : 0;
  const internalNetworkConnectionMode =
    eightBandNetworkRequired &&
    strongestRelativeBandIndexValue >= 4 &&
    relativeSupportAboveMeanCount >= 4 &&
    relativeSupportRange >= 0.55
      ? "two_separated_interior_headwater_tributaries_to_main_channel"
      : eightBandNetworkRequired && strongestRelativeBandIndexValue >= 4
        ? "interior_headwater_tributary_to_main_channel"
      : eightBandNetworkRequired && relativeSupportAboveMeanCount >= 4
        ? "main_channel_connected_floodplain_backwater_finger"
        : "main_channel_anabranch";
  const backwaterFloodplainSide = branchSide;
  const backwaterCenterOffsetRadiusScale =
    eightBandNetworkRequired ? 0.65 : 0;
  const tributaryHeadwaterXFraction =
    eightBandNetworkRequired
      ? round(
          branchSide === "west"
            ? clamp(
                0.06 +
                  directBandSupports[
                    measurementSelectedUpstreamBandIndex
                  ] * 0.16,
                0.08,
                0.24,
              )
            : clamp(
                0.94 -
                  directBandSupports[
                    measurementSelectedUpstreamBandIndex
                  ] * 0.16,
                0.76,
                0.92,
              ),
          6,
        )
      : null;
  const secondaryTributaryHeadwaterXFraction =
    internalNetworkConnectionMode ===
    "two_separated_interior_headwater_tributaries_to_main_channel"
      ? round(1 - tributaryHeadwaterXFraction, 6)
      : null;
  const backwaterSupportBands = eightBandNetworkRequired
    ? coarseBands
        .filter(
          (entry, index) =>
            index > 0 &&
            index < coarseBands.length - 1 &&
            entry.anonymousLongitudinalFraction > divergenceFraction &&
            entry.anonymousLongitudinalFraction < rejoinFraction &&
            entry.quantizedRelativeSupport >= relativeSupportMean,
        )
        .sort(
          (left, right) =>
            right.quantizedRelativeSupport -
              left.quantizedRelativeSupport ||
            right.anonymousSupportFraction -
              left.anonymousSupportFraction ||
            left.anonymousBandIndex - right.anonymousBandIndex,
        )
        .reduce((selected, entry) => {
          if (
            selected.length < 2 &&
            selected.every(
              (existing) =>
                Math.abs(
                  existing.anonymousBandIndex -
                    entry.anonymousBandIndex,
                ) >= 2,
            )
          ) {
            selected.push(entry);
          }
          return selected;
        }, [])
    : [];
  const backwaterBasinLongitudinalFractions =
    eightBandNetworkRequired
      ? backwaterSupportBands
          .map((entry) =>
            round(
              clamp(
                (entry.anonymousLongitudinalFraction -
                  divergenceFraction) /
                  (rejoinFraction - divergenceFraction),
                0.16,
                0.84,
              ),
              6,
            ),
          )
          .sort((left, right) => left - right)
      : null;
  const profile = {
    schemaVersion:
      "measurement-derived-anonymous-internal-hydrology-profile-v24",
    family: MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
    structure:
      eightBandNetworkRequired
        ? internalNetworkConnectionMode ===
          "two_separated_interior_headwater_tributaries_to_main_channel"
          ? "eight_band_multisegment_main_channel_with_two_measurement_supported_separated_interior_headwater_tributaries_and_connected_backwaters"
          : internalNetworkConnectionMode ===
          "interior_headwater_tributary_to_main_channel"
          ? "eight_band_multisegment_main_channel_with_measurement_selected_interior_headwater_tributary_and_connected_backwaters"
          : internalNetworkConnectionMode ===
              "main_channel_connected_floodplain_backwater_finger"
            ? "eight_band_multisegment_main_channel_with_measurement_selected_connected_floodplain_backwater_finger"
            : "eight_band_multisegment_main_channel_with_measurement_selected_anabranch_and_connected_backwaters"
        : "main_channel_with_asymmetric_floodplain_anabranch_and_connected_backwater",
    derivation:
      eightBandNetworkRequired
        ? "all_eight_quantized_dem_d8_lateral_and_relative_support_bands_drive_internal_network_connection_mode_upstream_and_downstream_span_strong_side_separated_headwater_or_multi_arm_connected_floodplain_fingers_offset_width_and_ranked_nonadjacent_backwater_placement_v16"
        : "measurement_window_fingerprint_plus_aggregate_relief_slope_drainage_and_land_cover_monotonic_naturalness_bounded_v4",
    branchCurveConstruction:
      eightBandNetworkRequired
        ? "all_eight_quantized_dem_d8_lateral_and_relative_support_bands_with_measurement_selected_side_scaled_floodplain_arc_anonymous_c1_multisegment_spline_v4"
        : "measurement_parameterized_monotonic_cubic_bezier_asymmetric_offset_candidate_selection_v2",
    measurementTopologyFingerprint,
    selectionBytes: {
      internalHydrologySelectionByte,
      floodplainBasinSelectionByte,
    },
    branchSide,
    branchSideDerivation: eightBandNetworkRequired
      ? "upper_vs_lower_four_band_direct_support_gradient"
      : "measurement_topology_fingerprint_parity",
    divergenceFraction,
    rejoinFraction,
    lateralOffsetFraction,
    branchWidthScale,
    preferredSinuosity,
    backwaterBasinCount: eightBandNetworkRequired
      ? backwaterBasinLongitudinalFractions.length
      : drainage >= 0.5
        ? 1
        : 0,
    backwaterBasinRadiusXFraction,
    backwaterBasinRadiusYFraction,
    backwaterBasinLongitudinalFractions,
    backwaterSupportBandIndices:
      backwaterSupportBands.map(
        (entry) => entry.anonymousBandIndex,
      ),
    connectedFloodplainFingerArmCount:
      internalNetworkConnectionMode ===
      "main_channel_connected_floodplain_backwater_finger"
        ? 1 + backwaterSupportBands.length
        : 0,
    measurementSupportStatistics: eightBandNetworkRequired
      ? {
          directBandSupports,
          relativeBandSupports,
          directSupportMean: round(directSupportMean, 6),
          upperDirectSupportMean: round(
            upperDirectSupportMean,
            6,
          ),
          lowerDirectSupportMean: round(
            lowerDirectSupportMean,
            6,
          ),
          relativeSupportMean: round(relativeSupportMean, 6),
          relativeSupportMinimum,
          relativeSupportMaximum,
          relativeSupportRange: round(relativeSupportRange, 6),
          relativeSupportAboveMeanCount,
          activeRelativeBandIndices: activeRelativeBands.map(
            (entry) => entry.anonymousBandIndex,
          ),
          strongestRelativeBandIndex:
            strongestRelativeBand.anonymousBandIndex,
          strongestDirectBandIndex:
            coarseBands[strongestDirectBandIndexValue]
              .anonymousBandIndex,
          measurementSelectedUpstreamBandIndex,
          measurementSelectedDownstreamBandIndex,
        }
      : null,
    branchAnonymousSupportFractions,
    internalNetworkConnectionMode,
    tributaryHeadwaterXFraction,
    secondaryTributaryHeadwaterXFraction,
    westernNaturalPassageWaterCenterMinimumFraction,
    backwaterFloodplainSide,
    backwaterCenterOffsetRadiusScale,
    eightBandNetworkRequired,
    coarseHydrologyProfileSha256:
      coarseHydrologyProfile?.profileSha256 ?? null,
    allEightCoarseBandsConsumed:
      eightBandNetworkRequired,
    connectivityPortsAreBoundaryConstraintsOnly: true,
    westernNaturalPassagePreserved: true,
    singleBroadCenterlineIsOnlyInternalHydrology: false,
    retrySeedAffectsMacroTopology: false,
    fingerprintBytesInformMacroStructure:
      !eightBandNetworkRequired,
    measurementSupportStatisticsDriveMacroStructure:
      eightBandNetworkRequired,
    fixedSharedInternalRiverSkeletonUsed: false,
    exactMeasurementGeometryCarriedForward: false,
    exactOsmGeometryCarriedForward: false,
  };
  return {
    ...profile,
    profileSha256: sha256(JSON.stringify(profile)),
  };
}

function assertAssignment(assignment) {
  if (
    !assignment ||
    !/^[a-f0-9]{64}$/.test(
      assignment.fingerprints?.direct ?? "",
    ) ||
    !Number.isFinite(assignment.metrics?.elevationMetres?.mean) ||
    !Number.isFinite(assignment.metrics?.relativeElevation) ||
    !Number.isFinite(assignment.metrics?.relativeRelief) ||
    !Number.isFinite(assignment.metrics?.normalizedSlope?.mean) ||
    !Number.isFinite(
      assignment.metrics?.drainageLikelihoodRatio,
    )
  ) {
    throw new Error(
      "measurement-driven anonymous topology assignment is incomplete",
    );
  }
  for (const key of [
    "treeCover",
    "shrubland",
    "grassland",
    "bareOrSparse",
  ]) {
    if (
      !Number.isFinite(
        assignment.metrics.reconstructedLandCoverRatio?.[key],
      )
    ) {
      throw new Error(
        `measurement-driven land-cover ratio is missing: ${key}`,
      );
    }
  }
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(value))
    .digest("hex");
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function mean(values) {
  return (
    values.reduce((total, value) => total + value, 0) /
    values.length
  );
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
