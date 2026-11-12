import { clamp, mulberry32, buildVariableWidthCorridorPolygons } from "./natural-world-geometry.mjs";
import { NATURAL_WATER_CENTERLINE_POINT_COUNT, auditAnonymousWaterCorridorShape, auditAnonymousWaterNaturalness, buildNaturalWaterHalfWidths } from "./anonymous-water-naturalness.mjs";
import { COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT, buildMeasurementDerivedAnonymousAnabranch } from "./measurement-derived-coarse-hydrology.mjs";

// Canvas and the existing seeded basin shape calculator are supplied by the
// world generator. This module only calculates geometry; it does not read or
// publish WorldFacts, source packages, training data or runtime state.
export function createNaturalWorldHydrology({ width: WIDTH, height: HEIGHT, irregularEllipsePolygon }) {
  if (!(Number.isFinite(WIDTH) && WIDTH > 0 && Number.isFinite(HEIGHT) && HEIGHT > 0 && typeof irregularEllipsePolygon === "function")) {
    throw new Error("natural hydrology canvas and basin geometry are required");
  }
  return { buildMeasurementDerivedInternalHydrology, buildMeasurementDerivedMonotonicAnabranch };

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
}

function assert(condition, message) { if (!condition) throw new Error(message); }
