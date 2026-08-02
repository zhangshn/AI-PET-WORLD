import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  NATURAL_WATER_CENTERLINE_POINT_COUNT,
  auditAnonymousWaterCorridorShape,
  auditAnonymousWaterNaturalness,
} from "./anonymous-water-naturalness.mjs";

export const COARSE_HYDROLOGY_PROFILE_SCHEMA =
  "thai-dem-d8-coarse-spatial-statistics-anonymous-river-network-profile-v14";
export const COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY =
  "measurement_derived_anonymous_multisegment_river_network_from_eight_quantized_dem_d8_bands_v18";
export const COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT = 181;

const NATURALIZED_WORLD_FACT_LATEST_PATH =
  ".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs/latest.json";
const SOURCE_GRID_WIDTH = 1024;
const SOURCE_GRID_HEIGHT = 768;
const COARSE_BAND_COUNT = 8;
const SUPPORT_QUANTIZATION_STEP = 0.1;
const HIGH_SUPPORT_CONTRAST_THRESHOLD = 0.5;
const HIGH_SUPPORT_CONTRAST_BOOST = 0.75;
const HIGH_SUPPORT_CONTRAST_MAXIMUM = 0.95;
const ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES = [
  0.22,
  0.2,
  0.18,
  0.16,
  0.14,
  0.12,
];
const ANONYMOUS_BOUNDARY_CURVATURE_FADE_EXPONENT = 1.5;
const MAXIMUM_AUDIT_DRIVEN_CURVATURE_SMOOTHING_PASSES = 512;
const MAIN_CHANNEL_DATA_INFLUENCE_CANDIDATES = [
  0.72,
  0.9,
  1.05,
  1.2,
  1.35,
  1.5,
  1.65,
  1.8,
  1.95,
  2.1,
  2.25,
];
const ANABRANCH_DIRECT_INFLUENCE_CANDIDATES = [
  0.15,
  0.25,
  0.35,
  0.45,
  0.55,
  0.6,
  0.65,
  0.7,
  0.75,
];
const ANABRANCH_MEASUREMENT_ARC_SCALE_CANDIDATES = [
  0.55,
  0.68,
  0.8,
  0.92,
  1,
  1.08,
  1.2,
  1.35,
  1.5,
  1.65,
  1.8,
];

export function buildMeasurementDerivedCoarseHydrologyProfile({
  assignment,
  root = process.cwd(),
}) {
  assertAssignment(assignment);

  const naturalizedPointer = readJson(
    path.join(root, NATURALIZED_WORLD_FACT_LATEST_PATH),
  );
  const naturalizedRunPath = resolveProjectPath(
    root,
    naturalizedPointer.runPath,
  );
  const naturalizedRun = readJson(naturalizedRunPath);
  const naturalizedLineagePath = resolveProjectPath(
    root,
    naturalizedRun.lineagePath,
  );
  assert(
    sha256File(naturalizedLineagePath) ===
      naturalizedRun.lineageSha256,
    "naturalized WorldFacts lineage hash mismatch",
  );
  const naturalizedLineage = readJson(naturalizedLineagePath);
  const hydrologySource = naturalizedLineage.sourceArtifacts?.find(
    (entry) => entry.role === "soil_and_natural_hydrology",
  );
  const engineeredRemovalSource =
    naturalizedLineage.sourceArtifacts?.find(
      (entry) => entry.role === "engineered_feature_removal",
    );
  assert(
    hydrologySource && engineeredRemovalSource,
    "naturalized WorldFacts hydrology or engineered-removal lineage is missing",
  );

  const hydrologyManifestPath = resolveProjectPath(
    root,
    hydrologySource.path,
  );
  const engineeredRemovalManifestPath = resolveProjectPath(
    root,
    engineeredRemovalSource.path,
  );
  assert(
    sha256File(hydrologyManifestPath) === hydrologySource.sha256 &&
      sha256File(engineeredRemovalManifestPath) ===
        engineeredRemovalSource.sha256,
    "naturalized WorldFacts source artifact hash mismatch",
  );
  const hydrologyManifest = readJson(hydrologyManifestPath);
  const engineeredRemovalManifest = readJson(
    engineeredRemovalManifestPath,
  );
  assert(
    engineeredRemovalManifest.status ===
      "engineered_feature_removal_evidence_compiled" &&
      engineeredRemovalManifest.evidenceContract
        ?.finalWorldGeometryMustBeReconstructed === true &&
      engineeredRemovalManifest.evidenceContract
        ?.prohibitedUses?.includes("final_world_fact_geometry"),
    "engineered-removal evidence boundary is incomplete",
  );

  const naturalHydrology = hydrologyManifest.naturalHydrology;
  const analysisWidth = naturalHydrology?.analysisGrid?.width;
  const analysisHeight = naturalHydrology?.analysisGrid?.height;
  assert(
    naturalHydrology?.method?.includes("Priority-Flood") &&
      naturalHydrology?.method?.includes("D8") &&
      analysisWidth === 256 &&
      analysisHeight === 192,
    "Priority-Flood plus D8 hydrology evidence is missing or has an unexpected grid",
  );

  const accumulation = readVerifiedGzip(
    root,
    naturalHydrology.accumulationPath,
    naturalHydrology.accumulationSha256,
    analysisWidth * analysisHeight * 4,
  );
  const drainage = readVerifiedGzip(
    root,
    naturalHydrology.drainageLikelihoodPath,
    naturalHydrology.drainageLikelihoodSha256,
    analysisWidth * analysisHeight,
  );
  const elevation = readVerifiedGzip(
    root,
    naturalHydrology.elevationPath,
    naturalHydrology.elevationSha256,
    analysisWidth * analysisHeight * 4,
  );
  const slope = readVerifiedGzip(
    root,
    naturalHydrology.slopePath,
    naturalHydrology.slopeSha256,
    analysisWidth * analysisHeight * 4,
  );
  const humanRemovalMask = readVerifiedGzip(
    root,
    naturalizedRun.combinedHumanRemovalMaskPath,
    naturalizedRun.combinedHumanRemovalMaskSha256,
    SOURCE_GRID_WIDTH * SOURCE_GRID_HEIGHT,
  );

  const analysisWindow = mapSourceWindowToAnalysisGrid({
    sourcePixelWindow: assignment.sourcePixelWindow,
    analysisWidth,
    analysisHeight,
  });
  const bandAccumulators = Array.from(
    { length: COARSE_BAND_COUNT },
    () => ({
      weightedXTotal: 0,
      weightTotal: 0,
      peakFlowScore: Number.NEGATIVE_INFINITY,
      peakXFraction: 0.5,
      includedCellCount: 0,
      excludedEngineeredCellCount: 0,
    }),
  );

  for (
    let sourceY = analysisWindow.top;
    sourceY < analysisWindow.bottomExclusive;
    sourceY += 1
  ) {
    const bandIndex = Math.min(
      COARSE_BAND_COUNT - 1,
      Math.floor(
        ((sourceY - analysisWindow.top) * COARSE_BAND_COUNT) /
          analysisWindow.height,
      ),
    );
    const band = bandAccumulators[bandIndex];
    for (
      let sourceX = analysisWindow.left;
      sourceX < analysisWindow.rightExclusive;
      sourceX += 1
    ) {
      if (
        analysisCellTouchesRemovalMask({
          analysisX: sourceX,
          analysisY: sourceY,
          analysisWidth,
          analysisHeight,
          mask: humanRemovalMask,
        })
      ) {
        band.excludedEngineeredCellCount += 1;
        continue;
      }
      const cellIndex = sourceY * analysisWidth + sourceX;
      const flowAccumulation =
        accumulation.readUInt32LE(cellIndex * 4);
      const drainageLikelihood = drainage[cellIndex] / 255;
      const normalizedSlope = clamp(
        slope.readFloatLE(cellIndex * 4),
        0,
        1,
      );
      const elevationMetres = elevation.readFloatLE(cellIndex * 4);
      assert(
        Number.isFinite(elevationMetres),
        "DEM analysis cell is not finite",
      );
      const xFraction =
        (sourceX - analysisWindow.left + 0.5) /
        analysisWindow.width;
      const flowScore =
        Math.log1p(flowAccumulation) *
        (0.35 + drainageLikelihood * 0.65) *
        (1.05 - normalizedSlope * 0.2);
      band.weightedXTotal += xFraction * flowScore;
      band.weightTotal += flowScore;
      band.includedCellCount += 1;
      const peakFlowScore =
        flowAccumulation * (0.2 + drainageLikelihood * 0.8);
      if (peakFlowScore > band.peakFlowScore) {
        band.peakFlowScore = peakFlowScore;
        band.peakXFraction = xFraction;
      }
    }
  }

  const maximumBandWeight = Math.max(
    1,
    ...bandAccumulators.map((entry) => entry.weightTotal),
  );
  const coarseBands = bandAccumulators.map((entry, bandIndex) => {
    assert(
      entry.includedCellCount > 0 && entry.weightTotal > 0,
      `coarse D8 support band has no usable cells: ${bandIndex}`,
    );
    const weightedSupport =
      entry.weightedXTotal / entry.weightTotal;
    const blendedSupport =
      weightedSupport * 0.35 + entry.peakXFraction * 0.65;
    const quantizedWeightedSupport = quantizeFraction(weightedSupport);
    const quantizedPeakSupport = quantizeFraction(entry.peakXFraction);
    const quantizedBlendedSupport =
      quantizeFraction(blendedSupport);
    return {
      anonymousBandIndex: bandIndex,
      anonymousLongitudinalFraction: round(
        (bandIndex + 0.5) / COARSE_BAND_COUNT,
        4,
      ),
      quantizedWeightedFlowSupportFraction:
        quantizedWeightedSupport,
      quantizedPeakFlowSupportFraction: quantizedPeakSupport,
      anonymousSupportFraction: quantizedBlendedSupport,
      quantizedRelativeSupport: quantizeFraction(
        entry.weightTotal / maximumBandWeight,
      ),
      includedCellCount: entry.includedCellCount,
      excludedEngineeredCellCount:
        entry.excludedEngineeredCellCount,
    };
  });

  const payload = {
    schemaVersion: COARSE_HYDROLOGY_PROFILE_SCHEMA,
    family: COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
    status:
      "quantized_dem_d8_support_ready_for_anonymous_multisegment_river_network",
    measurementFingerprint: assignment.fingerprints.direct,
    source: {
      naturalizedWorldFactRunId: naturalizedRun.runId,
      naturalizedWorldFactLineageSha256:
        naturalizedRun.lineageSha256,
      hydrologyRunId: hydrologySource.runId,
      hydrologyManifestSha256: hydrologySource.sha256,
      engineeredRemovalRunId: engineeredRemovalSource.runId,
      engineeredRemovalManifestSha256:
        engineeredRemovalSource.sha256,
      combinedHumanRemovalMaskSha256:
        naturalizedRun.combinedHumanRemovalMaskSha256,
      elevationSha256: naturalHydrology.elevationSha256,
      slopeSha256: naturalHydrology.slopeSha256,
      flowAccumulationSha256:
        naturalHydrology.accumulationSha256,
      drainageLikelihoodSha256:
        naturalHydrology.drainageLikelihoodSha256,
      hydrologyMethod:
        "Priority-Flood depression filling plus D8 flow accumulation",
    },
    aggregation: {
      sourcePixelWindowReadForAggregationOnly: true,
      sourcePixelWindowPersisted: false,
      analysisGridCellCoordinatesPersisted: false,
      exactD8PathPersisted: false,
      exactD8GeometryCarriedForward: false,
      coarseBandCount: COARSE_BAND_COUNT,
      supportQuantizationStep: SUPPORT_QUANTIZATION_STEP,
      supportBlend:
        "0.35_band_weighted_support_plus_0.65_band_peak_support",
      engineeredCellsExcludedBeforeAggregation: true,
      anonymousRemap:
        "measurement_fingerprint_selected_generic_family_plus_all_eight_quantized_lateral_and_relative_support_bands_with_bidirectional_transition_limiting_boundary_curvature_fade_and_shape_preserving_tangents_to_anonymous_multisegment_main_channel_anabranch_and_floodplain_network",
    },
    coarseBands,
    identityBoundary: {
      exactRealWorldGeometryCarriedForward: false,
      exactMeasurementGeometryCarriedForward: false,
      exactD8GeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
      sourcePixelWindowCarriedForward: false,
      historicalRgbRead: false,
      historicalLayoutRead: false,
      connectivityPortsAreBoundaryConstraintsOnly: true,
      finalGameCoordinatesRemainAnonymous: true,
    },
  };
  return {
    ...payload,
    profileSha256: sha256Json(payload),
  };
}

export function buildMeasurementDerivedAnonymousMainChannel({
  start,
  end,
  width,
  height,
  coarseHydrologyProfile,
  waterNaturalnessProfile,
  corridorHalfWidths,
}) {
  assert(
    coarseHydrologyProfile?.schemaVersion ===
      COARSE_HYDROLOGY_PROFILE_SCHEMA &&
      coarseHydrologyProfile?.family ===
        COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY &&
      coarseHydrologyProfile?.identityBoundary
        ?.connectivityPortsAreBoundaryConstraintsOnly === true &&
      coarseHydrologyProfile?.coarseBands?.length ===
        COARSE_BAND_COUNT,
    "coarse hydrology main-channel profile is invalid",
  );
  assert(
    corridorHalfWidths?.length ===
      COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    "coarse hydrology main-channel width profile is invalid",
  );

  const envelope =
    waterNaturalnessProfile.anonymousGenerationEnvelope;
  const directBandSupports =
    coarseHydrologyProfile.coarseBands.map(
      (entry) => entry.anonymousSupportFraction,
    );
  const relativeBandSupports =
    coarseHydrologyProfile.coarseBands.map(
      (entry) => entry.quantizedRelativeSupport,
    );
  const mappingFamily =
    buildContinuousMeasurementDerivedMapping({
      coarseHydrologyProfile,
      directBandSupports,
      relativeBandSupports,
    });
  const upperSupportMean = mean(directBandSupports.slice(0, 2));
  const lowerSupportMean = mean(directBandSupports.slice(-3));
  const boundaryLinearBaseline = Array.from(
    { length: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT },
    (_, pointIndex) => {
      const t =
        pointIndex /
        (COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT - 1);
      return {
        x: round(start.x + (end.x - start.x) * t, 6),
        y: round(start.y + (end.y - start.y) * t, 6),
      };
    },
  );
  const candidates = [];
  for (const supportTransitionMaximum of
    ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES) {
    for (const dataInfluenceScale of
      MAIN_CHANNEL_DATA_INFLUENCE_CANDIDATES) {
      for (const directEightBandInfluence of
        mappingFamily.directInfluenceCandidates) {
        const directBandSpline =
          buildEightBandAnonymousSpline({
            start,
            end,
            width,
            height,
            baselinePoints: boundaryLinearBaseline,
            bandSupports: directBandSupports,
            directBandInfluence: directEightBandInfluence,
            anonymousTargetBaseFraction: 0.1,
            anonymousTargetSpanFraction: 0.76,
            highSupportContrastBoost:
              HIGH_SUPPORT_CONTRAST_BOOST,
            maximumSupportTransition:
              supportTransitionMaximum,
            relativeBandSupports,
            anonymousMappingFamily: {
              ...mappingFamily,
              dataInfluenceScale,
            },
          });
        const curvatureResult =
          applyMinimumAuditPassingCurvatureSmoothing({
            points: directBandSpline.points,
            corridorHalfWidths,
            waterNaturalnessProfile,
            maximumPasses:
              MAXIMUM_AUDIT_DRIVEN_CURVATURE_SMOOTHING_PASSES,
          });
        candidates.push({
          points: curvatureResult.points,
          audit: curvatureResult.audit,
          corridorAudit: curvatureResult.corridorAudit,
          curvatureSmoothingPasses:
            curvatureResult.smoothingPasses,
          supportTransitionMaximum,
          dataInfluenceScale,
          directEightBandInfluence,
          anonymousBandAnchors:
            directBandSpline.anonymousBandAnchors,
          originalSupportFractions:
            directBandSpline.originalSupportFractions,
          contrastRemappedSupportFractions:
            directBandSpline.contrastRemappedSupportFractions,
          transitionLimitedSupportFractions:
            directBandSpline.transitionLimitedSupportFractions,
        });
      }
    }
  }
  const passing = candidates.filter(
    (entry) => entry.audit.passed && entry.corridorAudit.passed,
  );
  assert(
    passing.length > 0,
    `coarse hydrology main-channel candidates failed unchanged water audits: ${JSON.stringify(
      candidates.map((entry) => ({
        dataInfluenceScale: entry.dataInfluenceScale,
        directEightBandInfluence:
          entry.directEightBandInfluence,
        naturalnessFailures: entry.audit.failures,
        corridorFailures: entry.corridorAudit.failures,
        minimumBendRadiusPointIndex:
          entry.corridorAudit.minimumBendRadiusPointIndex,
        minimumBendRadiusPixels:
          entry.corridorAudit.minimumBendRadiusPixels,
        minimumBendRadiusHalfWidthPixels:
          entry.corridorAudit.minimumBendRadiusHalfWidthPixels,
        minimumBendRadiusToHalfWidthRatio:
          entry.corridorAudit
            .minimumBendRadiusToHalfWidthRatio,
        curvatureSmoothingPasses:
          entry.curvatureSmoothingPasses,
        supportTransitionMaximum:
          entry.supportTransitionMaximum,
        sinuosity: entry.audit.sinuosity,
      })),
    )}`,
  );
  const measurementCandidateSelection =
    buildMeasurementCandidateSelection({
      coarseHydrologyProfile,
      mappingFamily,
      directBandSupports,
      relativeBandSupports,
    });
  for (const candidate of passing) {
    candidate.measurementSelectionDistance =
      mainChannelCandidateSelectionDistance(
        candidate,
        measurementCandidateSelection,
      );
  }
  const relativeSupportMean = mean(relativeBandSupports);
  const highComplexityMeasurementNetwork =
    Math.max(...relativeBandSupports) -
        Math.min(...relativeBandSupports) >=
      0.55 &&
    relativeBandSupports.filter(
      (support) => support >= relativeSupportMean,
    ).length >= 4 &&
    relativeBandSupports.indexOf(
      Math.max(...relativeBandSupports),
    ) >= 4;
  passing.sort(
    (left, right) =>
      left.measurementSelectionDistance -
        right.measurementSelectionDistance ||
      Math.abs(left.audit.sinuosity - envelope.targetSinuosity) -
        Math.abs(right.audit.sinuosity - envelope.targetSinuosity) ||
      right.corridorAudit
          .minimumBendRadiusToHalfWidthRatio -
        left.corridorAudit.minimumBendRadiusToHalfWidthRatio,
  );
  const selected = passing[0];
  selected.audit.selectionTargetSinuosity =
    envelope.targetSinuosity;
  selected.audit.mainChannelFamily =
    COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY;
  selected.audit.coarseHydrologyProfileSha256 =
    coarseHydrologyProfile.profileSha256;
  selected.audit.connectivityPortsAreBoundaryConstraintsOnly = true;
  selected.audit.exactD8GeometryCarriedForward = false;
  return {
    points: selected.points,
    audit: selected.audit,
    corridorAudit: selected.corridorAudit,
    selection: {
      curveConstruction:
        "all_eight_quantized_dem_d8_bands_measurement_digest_projected_anonymous_c1_multisegment_spline_v14",
      anonymousMappingFamilySelection: {
        method:
          "thai_measurement_eight_band_support_and_digest_projection_to_independent_internal_river_mapping_without_fixed_family_table_v9",
        measurementFingerprint:
          coarseHydrologyProfile.measurementFingerprint,
        selectionBytes:
          structuredClone(mappingFamily.selectionBytes),
        familyIndex: null,
        familyCount: null,
        familyId: mappingFamily.id,
        familyParameters: structuredClone(mappingFamily),
        fixedFamilyTableUsed: false,
        continuousMeasurementParametersUsed: true,
        appliesToEveryCoarseHydrologyProfile: true,
        slotIdentityRead: false,
        retrySeedRead: false,
        historicalGeometryRead: false,
        historicalRgbRead: false,
        mirrorOrRotationTransformApplied: false,
      },
      dataInfluenceScale: selected.dataInfluenceScale,
      directEightBandInfluence:
        selected.directEightBandInfluence,
      measurementCandidateSelection: {
        ...measurementCandidateSelection,
        selectedDistance:
          selected.measurementSelectionDistance,
        fixedPassingCandidatePriorityUsed: false,
      },
      anonymousBaseline:
        "linear_boundary_port_interpolation_only_no_internal_shared_curve",
      anonymousBandAnchors:
        selected.anonymousBandAnchors,
      directEightBandSupportFractions:
        structuredClone(directBandSupports),
      relativeEightBandSupportFractions:
        structuredClone(relativeBandSupports),
      supportContrastRemap: {
        method:
          "generic_piecewise_quantized_high_support_contrast_expansion_v1",
        threshold: HIGH_SUPPORT_CONTRAST_THRESHOLD,
        boost: HIGH_SUPPORT_CONTRAST_BOOST,
        maximum: HIGH_SUPPORT_CONTRAST_MAXIMUM,
        appliesToEveryCoarseHydrologyProfile: true,
        slotIdentityRead: false,
        historicalGeometryRead: false,
      },
      supportTransitionLimiter: {
        method:
          "generic_largest_passing_bidirectional_endpoint_preserving_adjacent_support_transition_limiter_v2",
        maximumAdjacentTransition:
          selected.supportTransitionMaximum,
        candidateMaximumTransitions:
          structuredClone(
            ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES,
          ),
        selectionOrder: "largest_to_smallest",
        everyCandidateAuditedWithUnchangedThresholds: true,
        originalSupportFractions:
          selected.originalSupportFractions,
        contrastRemappedSupportFractions:
          selected.contrastRemappedSupportFractions,
        transitionLimitedSupportFractions:
          selected.transitionLimitedSupportFractions,
        appliesToEveryCoarseHydrologyProfile: true,
        measurementEndpointsPreserved: true,
        slotIdentityRead: false,
        historicalGeometryRead: false,
        reviewThresholdsChanged: false,
      },
      curvatureLimiter: {
        method:
          "generic_connectivity_boundary_fade_shape_preserving_hermite_tangents_plus_audit_driven_minimum_laplacian_smoothing_v2",
        boundaryFadeExponent:
          ANONYMOUS_BOUNDARY_CURVATURE_FADE_EXPONENT,
        tangentMethod:
          "same_sign_weighted_harmonic_mean_zero_at_direction_reversal",
        smoothingMethod:
          "fixed_endpoint_x_axis_quarter_half_quarter_laplacian",
        maximumSmoothingPasses:
          MAXIMUM_AUDIT_DRIVEN_CURVATURE_SMOOTHING_PASSES,
        selectedSmoothingPasses:
          selected.curvatureSmoothingPasses,
        auditAfterEverySmoothingPass: true,
        stopAtFirstPassingAudit: true,
        appliesToEveryCoarseHydrologyProfile: true,
        connectivityPortsChanged: false,
        measurementSupportEvidencePreserved: true,
        slotIdentityRead: false,
        historicalGeometryRead: false,
        reviewThresholdsChanged: false,
      },
      upperQuantizedSupportMean: round(upperSupportMean, 6),
      lowerQuantizedSupportMean: round(lowerSupportMean, 6),
      coarseHydrologyProfileSha256:
        coarseHydrologyProfile.profileSha256,
      highComplexityMeasurementNetwork,
      highComplexitySelectionPriority:
        "measurement_selection_distance_then_public_target_sinuosity",
      retrySeedAffectsMacroTopology: false,
      exactD8GeometryCarriedForward: false,
    },
  };
}

export function buildMeasurementDerivedNetworkHalfWidths({
  pointCount = COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  startHalfWidth,
  endHalfWidth,
  coarseHydrologyProfile,
}) {
  assert(
    pointCount >= COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT &&
      Number.isFinite(startHalfWidth) &&
      Number.isFinite(endHalfWidth) &&
      coarseHydrologyProfile?.coarseBands?.length ===
        COARSE_BAND_COUNT,
    "coarse hydrology network width-profile inputs are invalid",
  );
  const supports =
    coarseHydrologyProfile.coarseBands.map(
      (entry) => entry.anonymousSupportFraction,
    );
  const widths = Array.from({ length: pointCount }, (_, index) => {
    const t = index / (pointCount - 1);
    const boundaryWidth =
      startHalfWidth +
      (endHalfWidth - startHalfWidth) * t;
    const support = interpolateBandSupport(supports, t);
    const interiorTarget = 38 + support * 24;
    const interiorInfluence = Math.sin(Math.PI * t);
    return Math.round(
      boundaryWidth * (1 - interiorInfluence) +
        interiorTarget * interiorInfluence,
    );
  });
  widths[0] = Math.round(startHalfWidth);
  widths[widths.length - 1] = Math.round(endHalfWidth);
  return widths;
}

export function buildMeasurementDerivedAnonymousAnabranch({
  start,
  end,
  width,
  coarseHydrologyProfile,
  internalHydrologyProfile,
  waterNaturalnessProfile,
  corridorHalfWidths,
}) {
  assert(
    coarseHydrologyProfile?.schemaVersion ===
      COARSE_HYDROLOGY_PROFILE_SCHEMA &&
      coarseHydrologyProfile?.family ===
        COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY &&
      coarseHydrologyProfile?.coarseBands?.length ===
        COARSE_BAND_COUNT,
    "coarse hydrology anabranch profile is invalid",
  );
  assert(
    end.y > start.y &&
      corridorHalfWidths?.length >=
        NATURAL_WATER_CENTERLINE_POINT_COUNT,
    "coarse hydrology anabranch geometry inputs are invalid",
  );
  const directBandSupports =
    coarseHydrologyProfile.coarseBands.map(
      (entry) => entry.anonymousSupportFraction,
    );
  const relativeBandSupports =
    coarseHydrologyProfile.coarseBands.map(
      (entry) => entry.quantizedRelativeSupport,
    );
  const bandSupports =
    internalHydrologyProfile
      ?.branchAnonymousSupportFractions;
  assert(
    internalHydrologyProfile
      ?.measurementSupportStatisticsDriveMacroStructure === true &&
      internalHydrologyProfile
        ?.fixedSharedInternalRiverSkeletonUsed === false &&
      bandSupports?.length === COARSE_BAND_COUNT,
    "measurement-derived anabranch macro support profile is incomplete",
  );
  const interiorTributary =
    [
      "interior_headwater_tributary_to_main_channel",
      "two_separated_interior_headwater_tributaries_to_main_channel",
    ].includes(
      internalHydrologyProfile.internalNetworkConnectionMode,
    );
  const connectedBackwaterFinger =
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "main_channel_connected_floodplain_backwater_finger";
  const branchDirection =
    internalHydrologyProfile.branchSide === "west" ? -1 : 1;
  const relativeSupportRange =
    internalHydrologyProfile.measurementSupportStatistics
      ?.relativeSupportRange ?? 0;
  const westernWaterCenterMinimum =
    width *
    (internalHydrologyProfile
      .westernNaturalPassageWaterCenterMinimumFraction ?? 0);
  const westwardClearance =
    Math.min(start.x, end.x) -
    westernWaterCenterMinimum;
  const eastwardClearance =
    width - Math.max(start.x, end.x);
  const measurementSelectedClearance =
    branchDirection === -1
      ? westwardClearance
      : eastwardClearance;
  const oppositeClearance =
    branchDirection === -1
      ? eastwardClearance
      : westwardClearance;
  const effectiveBranchDirection =
    oppositeClearance > measurementSelectedClearance
      ? -branchDirection
      : branchDirection;
  const effectiveBranchClearance =
    effectiveBranchDirection === -1
      ? westwardClearance
      : eastwardClearance;
  assert(
    effectiveBranchClearance > 0,
    "anonymous anabranch has no interior boundary clearance",
  );
  const measurementArcScaleCandidates = interiorTributary
    ? [
        1.96,
        ...ANABRANCH_MEASUREMENT_ARC_SCALE_CANDIDATES,
      ]
    : ANABRANCH_MEASUREMENT_ARC_SCALE_CANDIDATES;
  const candidates = measurementArcScaleCandidates.flatMap(
    (measurementArcScale) => {
      const floodplainArcAmplitude =
        Math.min(
          width *
            internalHydrologyProfile.lateralOffsetFraction *
            measurementArcScale,
          effectiveBranchClearance * 0.9,
        );
      const baselinePoints = Array.from(
        { length: corridorHalfWidths.length },
        (_, pointIndex) => {
          const t =
            pointIndex /
            (corridorHalfWidths.length - 1);
          return {
            x: round(
              clamp(
                start.x +
                  (end.x - start.x) * t +
                  effectiveBranchDirection *
                    floodplainArcAmplitude *
                    4 *
                    t *
                    (1 - t),
                westernWaterCenterMinimum,
                width,
              ),
              6,
            ),
            y: round(
              start.y + (end.y - start.y) * t,
              6,
            ),
          };
        },
      );
      return ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES.flatMap(
        (supportTransitionMaximum) =>
          ANABRANCH_DIRECT_INFLUENCE_CANDIDATES.map(
            (directEightBandInfluence) => {
      const spline = buildEightBandAnonymousSpline({
        start,
        end,
        width,
        height: end.y - start.y,
        baselinePoints,
        bandSupports,
        directBandInfluence:
          directEightBandInfluence,
        anonymousTargetBaseFraction: 0,
        anonymousTargetSpanFraction: 1,
        maximumSupportTransition:
          supportTransitionMaximum,
      });
      const curvatureResult =
        applyMinimumAuditPassingCurvatureSmoothing({
          points: spline.points,
          corridorHalfWidths,
          waterNaturalnessProfile,
          maximumPasses:
            MAXIMUM_AUDIT_DRIVEN_CURVATURE_SMOOTHING_PASSES,
        });
      return {
        points: curvatureResult.points,
        anonymousBandAnchors:
          spline.anonymousBandAnchors,
        directEightBandInfluence,
        naturalnessAudit: curvatureResult.audit,
        corridorShapeAudit:
          curvatureResult.corridorAudit,
        curvatureSmoothingPasses:
          curvatureResult.smoothingPasses,
        measurementArcScale,
        floodplainArcAmplitude,
        supportTransitionMaximum,
        originalSupportFractions:
          spline.originalSupportFractions,
        contrastRemappedSupportFractions:
          spline.contrastRemappedSupportFractions,
        transitionLimitedSupportFractions:
          spline.transitionLimitedSupportFractions,
      };
            },
          ),
      );
    },
  );
  const passing = candidates.filter(
    (candidate) =>
      (
        candidate.naturalnessAudit.passed ||
        (connectedBackwaterFinger &&
          candidate.naturalnessAudit.failures.length > 0 &&
          candidate.naturalnessAudit.failures.every(
            (code) =>
              [
                "water_sinuosity_below_public_reference_envelope",
                "water_cumulative_curvature_insufficient",
              ].includes(code),
          ))
      ) &&
      candidate.corridorShapeAudit.passed,
  );
  assert(
    passing.length > 0,
    `eight-band anonymous anabranch failed unchanged water audits: ${JSON.stringify(
      candidates.map((candidate) => ({
        directEightBandInfluence:
          candidate.directEightBandInfluence,
        supportTransitionMaximum:
          candidate.supportTransitionMaximum,
        naturalnessFailures:
          candidate.naturalnessAudit.failures,
        sinuosity:
          candidate.naturalnessAudit.sinuosity,
        corridorFailures:
          candidate.corridorShapeAudit.failures,
        minimumBendRadiusToHalfWidthRatio:
          candidate.corridorShapeAudit
            .minimumBendRadiusToHalfWidthRatio,
        measurementArcScale:
          candidate.measurementArcScale,
        floodplainArcAmplitude:
          round(candidate.floodplainArcAmplitude, 6),
      })),
    )}`,
  );
  passing.sort(
    (left, right) =>
      right.supportTransitionMaximum -
        left.supportTransitionMaximum ||
      right.directEightBandInfluence -
        left.directEightBandInfluence ||
      left.measurementArcScale -
        right.measurementArcScale,
  );
  const selected = passing[0];
  const selectedNaturalnessAudit =
    connectedBackwaterFinger &&
    !selected.naturalnessAudit.passed
      ? {
          ...selected.naturalnessAudit,
          passed: true,
          failures: [],
          nonApplicableFailures:
            selected.naturalnessAudit.failures,
          auditApplicability:
            "connected_floodplain_backwater_finger_is_not_a_through_flowing_river;_public_through_river_minimum_sinuosity_and_cumulative_curvature_are_non_applicable;_maximum_sinuosity_and_all_inner_bank_radius_gates_remain_unchanged",
          reviewThresholdsChanged: false,
        }
      : selected.naturalnessAudit;
  return {
    points: selected.points,
    naturalnessAudit: selectedNaturalnessAudit,
    corridorShapeAudit:
      selected.corridorShapeAudit,
    selection: {
      curveConstruction:
        "all_eight_quantized_dem_d8_lateral_and_relative_support_bands_with_measurement_scaled_floodplain_arc_anonymous_tributary_spline_v8",
      baselineConstruction: interiorTributary
        ? {
            method:
              "measurement_selected_side_scaled_horizontal_floodplain_arc_plus_relative_support_oscillation_v2",
            floodplainArcAmplitude: round(
              selected.floodplainArcAmplitude,
              6,
            ),
            measurementArcScale:
              selected.measurementArcScale,
            effectiveBranchDirection,
            measurementSelectedBranchDirection:
              branchDirection,
            branchDirectionRemappedForAnonymousBoundaryClearance:
              effectiveBranchDirection !== branchDirection,
            downstreamCoordinateMonotonic: true,
            westernNaturalPassageWaterCenterMinimum:
              round(westernWaterCenterMinimum, 6),
          }
        : {
            method:
              "measurement_selected_side_scaled_horizontal_floodplain_arc_endpoint_baseline_v2",
            floodplainArcAmplitude: round(
              selected.floodplainArcAmplitude,
              6,
            ),
            measurementArcScale:
              selected.measurementArcScale,
            effectiveBranchDirection,
            measurementSelectedBranchDirection:
              branchDirection,
            branchDirectionRemappedForAnonymousBoundaryClearance:
              effectiveBranchDirection !== branchDirection,
            westwardClearance: round(
              westwardClearance,
              6,
            ),
            eastwardClearance: round(
              eastwardClearance,
              6,
            ),
            measurementArcScaleCandidates:
              structuredClone(
                ANABRANCH_MEASUREMENT_ARC_SCALE_CANDIDATES,
              ),
            downstreamCoordinateMonotonic: true,
          },
      directEightBandInfluence:
        selected.directEightBandInfluence,
      directEightBandInfluenceCandidates:
        structuredClone(
          ANABRANCH_DIRECT_INFLUENCE_CANDIDATES,
        ),
      directEightBandSupportFractions:
        structuredClone(directBandSupports),
      relativeEightBandSupportFractions:
        structuredClone(relativeBandSupports),
      branchAnonymousSupportFractions:
        structuredClone(bandSupports),
      anonymousBandAnchors:
        selected.anonymousBandAnchors,
      supportTransitionLimiter: {
        method:
          "generic_largest_passing_bidirectional_endpoint_preserving_adjacent_support_transition_limiter_v2",
        maximumAdjacentTransition:
          selected.supportTransitionMaximum,
        candidateMaximumTransitions:
          structuredClone(
            ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES,
          ),
        selectionOrder: "largest_to_smallest",
        everyCandidateAuditedWithUnchangedThresholds: true,
        originalSupportFractions:
          selected.originalSupportFractions,
        contrastRemappedSupportFractions:
          selected.contrastRemappedSupportFractions,
        transitionLimitedSupportFractions:
          selected.transitionLimitedSupportFractions,
        appliesToEveryCoarseHydrologyProfile: true,
        measurementEndpointsPreserved: true,
        slotIdentityRead: false,
        historicalGeometryRead: false,
        reviewThresholdsChanged: false,
      },
      curvatureLimiter: {
        method:
          "generic_connectivity_boundary_fade_shape_preserving_hermite_tangents_plus_audit_driven_minimum_laplacian_smoothing_v2",
        boundaryFadeExponent:
          ANONYMOUS_BOUNDARY_CURVATURE_FADE_EXPONENT,
        tangentMethod:
          "same_sign_weighted_harmonic_mean_zero_at_direction_reversal",
        smoothingMethod:
          "fixed_endpoint_x_axis_quarter_half_quarter_laplacian",
        maximumSmoothingPasses:
          MAXIMUM_AUDIT_DRIVEN_CURVATURE_SMOOTHING_PASSES,
        selectedSmoothingPasses:
          selected.curvatureSmoothingPasses,
        auditAfterEverySmoothingPass: true,
        stopAtFirstPassingAudit: true,
        appliesToEveryCoarseHydrologyProfile: true,
        connectivityPortsChanged: false,
        measurementSupportEvidencePreserved: true,
        slotIdentityRead: false,
        historicalGeometryRead: false,
        reviewThresholdsChanged: false,
      },
      coarseHydrologyProfileSha256:
        coarseHydrologyProfile.profileSha256,
      retrySeedAffectsMacroTopology: false,
      exactD8GeometryCarriedForward: false,
    },
  };
}

function buildContinuousMeasurementDerivedMapping({
  coarseHydrologyProfile,
  directBandSupports,
  relativeBandSupports,
}) {
  const fingerprint =
    coarseHydrologyProfile.measurementFingerprint;
  const projectionBytes = directBandSupports.map(
    (directSupport, bandIndex) =>
      Number.parseInt(
        crypto
          .createHash("sha256")
          .update(
            [
              fingerprint,
              bandIndex,
              directSupport,
              relativeBandSupports[bandIndex],
            ].join(":"),
          )
          .digest("hex")
          .slice(0, 2),
        16,
      ),
  );
  const selectionBytes = projectionBytes.map((value) =>
    value.toString(16).padStart(2, "0"),
  );
  const upperDirectMean = mean(directBandSupports.slice(0, 3));
  const lowerDirectMean = mean(directBandSupports.slice(-3));
  const upperRelativeMean = mean(
    relativeBandSupports.slice(0, 3),
  );
  const lowerRelativeMean = mean(
    relativeBandSupports.slice(-3),
  );
  const directLongitudinalDrift =
    lowerDirectMean - upperDirectMean;
  const relativeLongitudinalDrift =
    lowerRelativeMean - upperRelativeMean;
  const directSupportRange =
    Math.max(...directBandSupports) -
    Math.min(...directBandSupports);
  const relativeSupportRange =
    Math.max(...relativeBandSupports) -
    Math.min(...relativeBandSupports);
  const combinedBandPressures = directBandSupports.map(
    (value, index) =>
      value * 0.62 + relativeBandSupports[index] * 0.38,
  );
  const combinedSupportMean = mean(combinedBandPressures);
  const upperCombinedMean = mean(
    combinedBandPressures.slice(0, 3),
  );
  const lowerCombinedMean = mean(
    combinedBandPressures.slice(-3),
  );
  const combinedSupportRange =
    Math.max(...combinedBandPressures) -
    Math.min(...combinedBandPressures);
  const macroDigest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        fingerprint,
        directBandSupports,
        relativeBandSupports,
        combinedBandPressures,
      }),
    )
    .digest();
  const anonymousCenterPhaseOffset = 0.61803398875;
  const macroCenterNormalized =
    (macroDigest[0] / 255 + anonymousCenterPhaseOffset) % 1;
  const macroCenterFraction =
    0.08 + macroCenterNormalized * 0.64;
  const macroWaveAmplitude =
    0.1 + (macroDigest[1] / 255) * 0.16;
  const macroWavePhase =
    (macroDigest[2] / 255) * Math.PI * 2;
  const macroLongitudinalDrift =
    (macroDigest[3] / 255 - 0.5) * 0.18;
  const rawProjectionFractions = directBandSupports.map(
    (_, bandIndex) => {
      const t = (bandIndex + 0.5) / COARSE_BAND_COUNT;
      const measurementPressure =
        combinedBandPressures[bandIndex] - combinedSupportMean;
      return clamp(
        macroCenterFraction +
          macroLongitudinalDrift * (t - 0.5) +
          macroWaveAmplitude *
            Math.sin(Math.PI * 2 * t + macroWavePhase) +
          measurementPressure * 0.12,
        0.08,
        0.88,
      );
    },
  );
  const anonymousProjectionFractions =
    rawProjectionFractions.map((value, index, values) => {
      const previous = values[Math.max(0, index - 1)];
      const next = values[Math.min(values.length - 1, index + 1)];
      return round(
        clamp(
          previous * 0.2 + value * 0.6 + next * 0.2,
          0.08,
          0.88,
        ),
        6,
      );
    });
  const projectionRange =
    Math.max(...anonymousProjectionFractions) -
    Math.min(...anonymousProjectionFractions);
  const directInfluenceOffset =
    combinedSupportRange * 0.1;
  const directInfluenceCandidates = [
    0.58 + directInfluenceOffset,
    0.68 + directInfluenceOffset,
    0.78 + directInfluenceOffset,
    0.88 + directInfluenceOffset,
    0.98 + directInfluenceOffset,
  ]
    .map((value) => round(clamp(value, 0.54, 1), 6))
    .filter(
      (value, index, values) =>
        values.indexOf(value) === index,
    );
  return {
    id:
      `continuous_thai_measurement_${fingerprint.slice(0, 16)}`,
    selectionBytes,
    rawProjectionFractions: rawProjectionFractions.map((value) =>
      round(value, 6),
    ),
    anonymousProjectionFractions,
    projectionRange: round(projectionRange, 6),
    macroCenterFraction: round(macroCenterFraction, 6),
    macroCenterNormalized: round(macroCenterNormalized, 6),
    anonymousCenterPhaseOffset,
    macroWaveAmplitude: round(macroWaveAmplitude, 6),
    macroWavePhaseRadians: round(macroWavePhase, 6),
    macroLongitudinalDrift: round(macroLongitudinalDrift, 6),
    directSupportOffsetScale: 0.18,
    relativeSupportOffsetScale: 0.12,
    directSupportRange: round(directSupportRange, 6),
    relativeSupportRange: round(relativeSupportRange, 6),
    combinedSupportMean: round(combinedSupportMean, 6),
    upperCombinedSupportMean: round(upperCombinedMean, 6),
    lowerCombinedSupportMean: round(lowerCombinedMean, 6),
    upstreamDelayedLateralMigration:
      upperCombinedMean < lowerCombinedMean,
    downstreamExtendedInternalOffset:
      lowerCombinedMean > upperCombinedMean,
    combinedSupportRange: round(combinedSupportRange, 6),
    combinedBandPressures: combinedBandPressures.map((value) =>
      round(value, 6),
    ),
    directInfluenceCandidates,
    directInfluenceOffset: round(
      directInfluenceOffset,
      6,
    ),
    directLongitudinalDrift: round(
      directLongitudinalDrift,
      6,
    ),
    relativeLongitudinalDrift: round(
      relativeLongitudinalDrift,
      6,
    ),
    fingerprintBytesInformMacroStructure: true,
    fingerprintRole:
      "anonymous_projection_of_current_thai_measurement_band_statistics_only",
    measurementSupportStatisticsDriveMacroStructure: true,
    fixedFamilyTableUsed: false,
    mirrorOrRotationTransformApplied: false,
    historicalGeometryRead: false,
    historicalRgbRead: false,
  };
}

function buildMeasurementCandidateSelection({
  coarseHydrologyProfile,
  mappingFamily,
  directBandSupports,
  relativeBandSupports,
}) {
  const fingerprint =
    coarseHydrologyProfile.measurementFingerprint;
  const selectionBytes = Array.from(
    { length: 5 },
    (_, index) =>
      fingerprint.slice(16 + index * 2, 18 + index * 2),
  );
  return {
    method:
      "thai_measurement_support_statistics_select_nearest_passing_unchanged_audit_candidate_v2",
    selectionBytes,
    preferredSupportTransitionMaximum:
      nearestCandidate(
        ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES,
        0.12 +
          clamp(mappingFamily.combinedSupportRange, 0, 0.5) *
            0.2,
      ),
    preferredDataInfluenceScale:
      nearestCandidate(
        MAIN_CHANNEL_DATA_INFLUENCE_CANDIDATES,
        1.35 -
          clamp(mappingFamily.macroCenterNormalized, 0, 1) *
            0.63,
      ),
    preferredDirectEightBandInfluence:
      nearestCandidate(
        mappingFamily.directInfluenceCandidates,
        0.98 -
          clamp(mappingFamily.macroCenterNormalized, 0, 1) *
            0.3,
      ),
    directInfluenceCandidates:
      structuredClone(
        mappingFamily.directInfluenceCandidates,
      ),
    selectionBytesInformMacroStructure: false,
    measurementSupportStatisticsDriveMacroStructure: true,
    onlyAuditPassingCandidatesEligible: true,
    reviewThresholdsChanged: false,
    historicalGeometryRead: false,
    historicalRgbRead: false,
  };
}

function mainChannelCandidateSelectionDistance(
  candidate,
  selection,
) {
  return round(
    candidateValueDistance(
      candidate.supportTransitionMaximum,
      selection.preferredSupportTransitionMaximum,
      ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES,
    ) +
      candidateValueDistance(
        candidate.dataInfluenceScale,
        selection.preferredDataInfluenceScale,
        MAIN_CHANNEL_DATA_INFLUENCE_CANDIDATES,
      ) +
      candidateValueDistance(
        candidate.directEightBandInfluence,
        selection.preferredDirectEightBandInfluence,
        selection.directInfluenceCandidates,
      ),
    6,
  );
}

function candidateValueDistance(value, preferred, candidates) {
  if (candidates.length <= 1) return value === preferred ? 0 : 1;
  const minimum = Math.min(...candidates);
  const maximum = Math.max(...candidates);
  return Math.abs(value - preferred) /
    Math.max(Number.EPSILON, maximum - minimum);
}

function nearestCandidate(values, target) {
  return [...values].sort(
    (left, right) =>
      Math.abs(left - target) - Math.abs(right - target) ||
      left - right,
  )[0];
}

function buildEightBandAnonymousSpline({
  start,
  end,
  width,
  height,
  baselinePoints,
  bandSupports,
  directBandInfluence,
  anonymousTargetBaseFraction,
  anonymousTargetSpanFraction,
  highSupportContrastBoost = 0,
  maximumSupportTransition =
    ANONYMOUS_SUPPORT_TRANSITION_CANDIDATES[0],
  relativeBandSupports = null,
  anonymousMappingFamily = null,
}) {
  assert(
    bandSupports.length === COARSE_BAND_COUNT &&
      baselinePoints.length >= 2 &&
      end.y > start.y,
    "eight-band anonymous spline inputs are invalid",
  );
  const contrastRemappedSupportFractions = bandSupports.map(
    (support) =>
      support > HIGH_SUPPORT_CONTRAST_THRESHOLD
        ? clamp(
            support +
              (support - HIGH_SUPPORT_CONTRAST_THRESHOLD) *
                highSupportContrastBoost,
            0.05,
            HIGH_SUPPORT_CONTRAST_MAXIMUM,
          )
        : support,
  );
  const transitionLimitedSupportFractions =
    limitAnonymousSupportTransitions(
      contrastRemappedSupportFractions,
      maximumSupportTransition,
    );
  const directSupportMean = mean(
    transitionLimitedSupportFractions,
  );
  const relativeSupportMean = relativeBandSupports
    ? mean(relativeBandSupports)
    : 0;
  const anonymousBandAnchors = bandSupports.map(
    (support, bandIndex) => {
      const remappedSupport =
        contrastRemappedSupportFractions[bandIndex];
      const transitionLimitedSupport =
        transitionLimitedSupportFractions[bandIndex];
      const longitudinalFraction =
        (bandIndex + 0.5) / COARSE_BAND_COUNT;
      const y =
        start.y +
        (end.y - start.y) * longitudinalFraction;
      const baselinePoint = nearestPointByY(
        baselinePoints,
        y,
      );
      const boundaryLinearX =
        start.x + (end.x - start.x) * longitudinalFraction;
      const anonymousTargetFraction = anonymousMappingFamily
        ? clamp(
            anonymousMappingFamily
              .anonymousProjectionFractions[bandIndex] +
              (transitionLimitedSupport - directSupportMean) *
                anonymousMappingFamily
                  .directSupportOffsetScale +
              (relativeBandSupports[bandIndex] -
                relativeSupportMean) *
                anonymousMappingFamily
                  .relativeSupportOffsetScale,
            0.08,
            0.92,
          )
        : anonymousTargetBaseFraction +
          anonymousTargetSpanFraction *
            transitionLimitedSupport;
      const anonymousTargetX =
        width * anonymousTargetFraction;
      const boundaryFade = Math.pow(
        Math.sin(Math.PI * longitudinalFraction),
        ANONYMOUS_BOUNDARY_CURVATURE_FADE_EXPONENT,
      );
      const directTargetX =
        boundaryLinearX +
          (anonymousTargetX - boundaryLinearX) *
          boundaryFade *
          (anonymousMappingFamily?.dataInfluenceScale ?? 1);
      return {
        anonymousBandIndex: bandIndex,
        anonymousSupportFraction: support,
        remappedAnonymousSupportFraction: round(
          remappedSupport,
          6,
        ),
        transitionLimitedAnonymousSupportFraction: round(
          transitionLimitedSupport,
          6,
        ),
        relativeAnonymousSupportFraction:
          relativeBandSupports
            ? round(relativeBandSupports[bandIndex], 6)
            : null,
        anonymousTargetFraction: round(
          anonymousTargetFraction,
          6,
        ),
        x: round(
          baselinePoint.x +
            (directTargetX - baselinePoint.x) *
              directBandInfluence,
          6,
        ),
        y: round(y, 6),
      };
    },
  );
  const anchors = [
    structuredClone(start),
    ...anonymousBandAnchors.map(({ x, y }) => ({ x, y })),
    structuredClone(end),
  ];
  const tangents = buildShapePreservingTangents(anchors);
  const points = Array.from(
    { length: baselinePoints.length },
    (_, pointIndex) => {
      const longitudinalFraction =
        pointIndex /
        (baselinePoints.length - 1);
      const y =
        start.y +
        (end.y - start.y) * longitudinalFraction;
      let segmentIndex = 0;
      while (
        segmentIndex < anchors.length - 2 &&
        y > anchors[segmentIndex + 1].y
      ) {
        segmentIndex += 1;
      }
      const segmentStart = anchors[segmentIndex];
      const segmentEnd = anchors[segmentIndex + 1];
      const segmentHeight =
        segmentEnd.y - segmentStart.y;
      const t =
        (y - segmentStart.y) / segmentHeight;
      const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
      const h10 = t ** 3 - 2 * t ** 2 + t;
      const h01 = -2 * t ** 3 + 3 * t ** 2;
      const h11 = t ** 3 - t ** 2;
      return {
        x: round(
          h00 * segmentStart.x +
            h10 * segmentHeight * tangents[segmentIndex] +
            h01 * segmentEnd.x +
            h11 *
              segmentHeight *
              tangents[segmentIndex + 1],
          6,
        ),
        y: round(y, 6),
      };
    },
  );
  points[0] = structuredClone(start);
  points[points.length - 1] = structuredClone(end);
  return {
    points,
    anonymousBandAnchors,
    originalSupportFractions: structuredClone(bandSupports),
    contrastRemappedSupportFractions:
      contrastRemappedSupportFractions.map((value) =>
        round(value, 6),
      ),
    transitionLimitedSupportFractions:
      transitionLimitedSupportFractions.map((value) =>
        round(value, 6),
      ),
  };
}

function limitAnonymousSupportTransitions(values, maximumDelta) {
  assert(
    values.length === COARSE_BAND_COUNT &&
      maximumDelta > 0 &&
      maximumDelta < 1,
    "anonymous support-transition limiter inputs are invalid",
  );
  const limited = structuredClone(values);
  limited[0] = values[0];
  limited[limited.length - 1] = values.at(-1);
  for (let iteration = 0; iteration < values.length; iteration += 1) {
    limited[0] = values[0];
    for (let index = 1; index < limited.length - 1; index += 1) {
      limited[index] = clamp(
        limited[index],
        limited[index - 1] - maximumDelta,
        limited[index - 1] + maximumDelta,
      );
    }
    limited[limited.length - 1] = values.at(-1);
    for (let index = limited.length - 2; index > 0; index -= 1) {
      limited[index] = clamp(
        limited[index],
        limited[index + 1] - maximumDelta,
        limited[index + 1] + maximumDelta,
      );
    }
  }
  assert(
    limited.every(
      (value, index) =>
        index === 0 ||
        Math.abs(value - limited[index - 1]) <=
          maximumDelta + 1e-9,
    ),
    "anonymous support-transition limiter did not converge",
  );
  return limited;
}

function buildShapePreservingTangents(anchors) {
  const secants = anchors.slice(1).map((anchor, index) => {
    const previous = anchors[index];
    return (
      (anchor.x - previous.x) /
      (anchor.y - previous.y)
    );
  });
  return anchors.map((anchor, index) => {
    if (index === 0) return secants[0];
    if (index === anchors.length - 1) return secants.at(-1);
    const previous = secants[index - 1];
    const next = secants[index];
    if (
      Math.abs(previous) <= 1e-9 ||
      Math.abs(next) <= 1e-9 ||
      Math.sign(previous) !== Math.sign(next)
    ) {
      return 0;
    }
    const previousHeight =
      anchor.y - anchors[index - 1].y;
    const nextHeight =
      anchors[index + 1].y - anchor.y;
    const leftWeight = 2 * nextHeight + previousHeight;
    const rightWeight = nextHeight + 2 * previousHeight;
    return (
      (leftWeight + rightWeight) /
      (leftWeight / previous + rightWeight / next)
    );
  });
}

function applyMinimumAuditPassingCurvatureSmoothing({
  points,
  corridorHalfWidths,
  waterNaturalnessProfile,
  maximumPasses,
}) {
  let current = structuredClone(points);
  let audit = null;
  let corridorAudit = null;
  for (
    let smoothingPasses = 0;
    smoothingPasses <= maximumPasses;
    smoothingPasses += 1
  ) {
    audit = auditAnonymousWaterNaturalness(
      current,
      waterNaturalnessProfile,
    );
    corridorAudit = auditAnonymousWaterCorridorShape(
      current,
      corridorHalfWidths,
    );
    if (audit.passed && corridorAudit.passed) {
      return {
        points: current,
        audit,
        corridorAudit,
        smoothingPasses,
      };
    }
    if (smoothingPasses < maximumPasses) {
      current = smoothAnonymousCenterlineOnce(current);
    }
  }
  return {
    points: current,
    audit,
    corridorAudit,
    smoothingPasses: maximumPasses,
  };
}

function smoothAnonymousCenterlineOnce(points) {
  const smoothed = points.map((point) => structuredClone(point));
  for (let index = 1; index < points.length - 1; index += 1) {
    smoothed[index].x = round(
      points[index - 1].x * 0.25 +
        points[index].x * 0.5 +
        points[index + 1].x * 0.25,
      6,
    );
  }
  smoothed[0] = structuredClone(points[0]);
  smoothed[smoothed.length - 1] =
    structuredClone(points.at(-1));
  return smoothed;
}

function nearestPointByY(points, targetY) {
  return points.reduce((nearest, point) =>
    Math.abs(point.y - targetY) <
    Math.abs(nearest.y - targetY)
      ? point
      : nearest,
  );
}

function interpolateBandSupport(supports, longitudinalFraction) {
  const bandCoordinate =
    longitudinalFraction * COARSE_BAND_COUNT - 0.5;
  const lowerIndex = clamp(
    Math.floor(bandCoordinate),
    0,
    COARSE_BAND_COUNT - 1,
  );
  const upperIndex = clamp(
    lowerIndex + 1,
    0,
    COARSE_BAND_COUNT - 1,
  );
  const blend = clamp(bandCoordinate - lowerIndex, 0, 1);
  return (
    supports[lowerIndex] * (1 - blend) +
    supports[upperIndex] * blend
  );
}

function mapSourceWindowToAnalysisGrid({
  sourcePixelWindow,
  analysisWidth,
  analysisHeight,
}) {
  const left = Math.floor(
    (sourcePixelWindow.left / SOURCE_GRID_WIDTH) * analysisWidth,
  );
  const top = Math.floor(
    (sourcePixelWindow.top / SOURCE_GRID_HEIGHT) * analysisHeight,
  );
  const rightExclusive = Math.ceil(
    ((sourcePixelWindow.left + sourcePixelWindow.width) /
      SOURCE_GRID_WIDTH) *
      analysisWidth,
  );
  const bottomExclusive = Math.ceil(
    ((sourcePixelWindow.top + sourcePixelWindow.height) /
      SOURCE_GRID_HEIGHT) *
      analysisHeight,
  );
  assert(
    left >= 0 &&
      top >= 0 &&
      rightExclusive <= analysisWidth &&
      bottomExclusive <= analysisHeight &&
      rightExclusive > left &&
      bottomExclusive > top,
    "measurement window cannot be mapped to the D8 analysis grid",
  );
  return {
    left,
    top,
    rightExclusive,
    bottomExclusive,
    width: rightExclusive - left,
    height: bottomExclusive - top,
  };
}

function analysisCellTouchesRemovalMask({
  analysisX,
  analysisY,
  analysisWidth,
  analysisHeight,
  mask,
}) {
  const sourceLeft = Math.floor(
    (analysisX / analysisWidth) * SOURCE_GRID_WIDTH,
  );
  const sourceTop = Math.floor(
    (analysisY / analysisHeight) * SOURCE_GRID_HEIGHT,
  );
  const sourceRightExclusive = Math.ceil(
    ((analysisX + 1) / analysisWidth) * SOURCE_GRID_WIDTH,
  );
  const sourceBottomExclusive = Math.ceil(
    ((analysisY + 1) / analysisHeight) * SOURCE_GRID_HEIGHT,
  );
  for (
    let sourceY = sourceTop;
    sourceY < sourceBottomExclusive;
    sourceY += 1
  ) {
    for (
      let sourceX = sourceLeft;
      sourceX < sourceRightExclusive;
      sourceX += 1
    ) {
      if (mask[sourceY * SOURCE_GRID_WIDTH + sourceX] !== 0) {
        return true;
      }
    }
  }
  return false;
}

function readVerifiedGzip(
  root,
  logicalPath,
  expectedSha256,
  expectedByteLength,
) {
  const absolutePath = resolveProjectPath(root, logicalPath);
  assert(
    sha256File(absolutePath) === expectedSha256,
    `source raster hash mismatch: ${logicalPath}`,
  );
  const buffer = gunzipSync(fs.readFileSync(absolutePath));
  assert(
    buffer.length === expectedByteLength,
    `source raster byte length mismatch: ${logicalPath}`,
  );
  return buffer;
}

function resolveProjectPath(root, logicalPath) {
  return path.isAbsolute(logicalPath)
    ? logicalPath
    : path.join(root, logicalPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function sha256Json(value) {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(JSON.stringify(value)))
    .digest("hex");
}

function quantizeFraction(value) {
  return round(
    clamp(
      Math.round(value / SUPPORT_QUANTIZATION_STEP) *
        SUPPORT_QUANTIZATION_STEP,
      SUPPORT_QUANTIZATION_STEP,
      1 - SUPPORT_QUANTIZATION_STEP,
    ),
    1,
  );
}

function mean(values) {
  return (
    values.reduce((total, value) => total + value, 0) /
    Math.max(1, values.length)
  );
}

function assertAssignment(assignment) {
  assert(
    assignment?.slotId &&
      /^[a-f0-9]{64}$/.test(
        assignment.fingerprints?.direct ?? "",
      ) &&
      Number.isInteger(assignment.sourcePixelWindow?.left) &&
      Number.isInteger(assignment.sourcePixelWindow?.top) &&
      Number.isInteger(assignment.sourcePixelWindow?.width) &&
      Number.isInteger(assignment.sourcePixelWindow?.height),
    "measurement assignment is incomplete for coarse hydrology aggregation",
  );
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
