const DEFAULT_NATURAL_ROUTE_CLASSES = new Set([
  "track",
  "path",
  "footway",
  "bridleway",
]);

export function buildAnonymousRouteNaturalnessProfile({
  rawOsm,
  source,
  createdAtUtc,
  createdAtAsiaShanghai,
}) {
  const sourceWays = (rawOsm.elements ?? []).filter(
    (element) =>
      element.type === "way" &&
      DEFAULT_NATURAL_ROUTE_CLASSES.has(element.tags?.highway) &&
      Array.isArray(element.geometry) &&
      element.geometry.length >= 3,
  );
  assert(
    sourceWays.length >= 12,
    "public route evidence is insufficient for an aggregate naturalness profile",
  );

  const metrics = sourceWays
    .map((way) => measurePublicRouteGeometry(way.geometry))
    .filter((entry) => entry.totalLengthMetres >= 30);
  assert(
    metrics.length >= 12,
    "public route evidence has insufficient measurable route geometries",
  );

  const sinuosity = metrics.map((entry) => entry.sinuosity);
  const meanTurnDegrees = metrics.map((entry) => entry.meanTurnDegrees);
  const maximumTurnDegrees = metrics.map(
    (entry) => entry.maximumTurnDegrees,
  );
  const sourceClassCounts = {};
  for (const way of sourceWays) {
    const routeClass = way.tags.highway;
    sourceClassCounts[routeClass] =
      (sourceClassCounts[routeClass] ?? 0) + 1;
  }

  const sinuosityQ25 = quantile(sinuosity, 0.25);
  const sinuosityQ50 = quantile(sinuosity, 0.5);
  const sinuosityQ75 = quantile(sinuosity, 0.75);
  return {
    schemaVersion: "anonymous-route-naturalness-reference-profile-v1",
    profileId:
      source.profileId ??
      "sakaerat-wang-nam-khiao-anonymous-route-naturalness-v1",
    status: "aggregate_public_route_naturalness_profile_ready",
    createdAtUtc,
    createdAtAsiaShanghai,
    source: {
      ...source,
      allowedUse:
        "aggregate_non_spatial_route_morphology_reference_for_anonymous_game_coordinate_generation",
      exactGeometryCopied: false,
      coordinatesPersistedInProfile: false,
      osmElementIdsPersistedInProfile: false,
      perFeatureMetricsPersistedInProfile: false,
    },
    selection: {
      eligibleHighwayClasses: [...DEFAULT_NATURAL_ROUTE_CLASSES],
      sourceWayCount: sourceWays.length,
      measurableWayCount: metrics.length,
      sourceClassCounts,
      minimumSourceWayCount: 12,
    },
    aggregateStatistics: {
      sinuosity: {
        q25: round(sinuosityQ25, 6),
        q50: round(sinuosityQ50, 6),
        q75: round(sinuosityQ75, 6),
      },
      meanTurnDegrees: {
        q25: round(quantile(meanTurnDegrees, 0.25), 6),
        q50: round(quantile(meanTurnDegrees, 0.5), 6),
        q75: round(quantile(meanTurnDegrees, 0.75), 6),
      },
      maximumTurnDegrees: {
        q25: round(quantile(maximumTurnDegrees, 0.25), 6),
        q50: round(quantile(maximumTurnDegrees, 0.5), 6),
        q75: round(quantile(maximumTurnDegrees, 0.75), 6),
      },
    },
    anonymousGenerationEnvelope: {
      minimumSinuosity: round(Math.max(1.05, sinuosityQ25 - 0.02), 6),
      targetSinuosity: round(
        clamp(sinuosityQ50, 1.12, 1.36),
        6,
      ),
      maximumSinuosity: round(Math.min(1.62, sinuosityQ75 + 0.16), 6),
      minimumCenterlinePointCount: 33,
      maximumCenterlineSegmentPixels: 32,
      maximumInteriorTurnDegrees: round(
        Math.min(22, quantile(maximumTurnDegrees, 0.25)),
        6,
      ),
      minimumCumulativeTurnDegrees: 36,
      curveConstruction:
        "multi_frequency_anonymous_anchors_plus_catmull_rom_resampling_v1",
      widthConstruction:
        "slowly_varying_anonymous_route_half_width_profile_v1",
    },
    identityBoundary: {
      aggregateStatisticsOnly: true,
      exactRealWorldGeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
      sourcePixelCoordinatesCarriedForward: false,
      finalGameCoordinatesRemainAnonymous: true,
    },
  };
}

export function buildNaturalAnonymousCenterline({
  start,
  end,
  random,
  width,
  height,
  profile,
  safeBounds = null,
}) {
  const envelope = profile.anonymousGenerationEnvelope;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const directLength = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / directLength;
  const ny = dx / directLength;
  const shortSafeCorridor =
    safeBounds !== null && directLength <= 360;
  const safeCorridorWidth = safeBounds
    ? safeBounds.maximumX - safeBounds.minimumX
    : width;
  const anchorCount = shortSafeCorridor ? 7 : 11;
  const primaryPhase = random() * Math.PI * 2;
  const secondaryPhase = random() * Math.PI * 2;
  const primaryCycles = shortSafeCorridor
    ? 0.7 + random() * 0.35
    : 1.1 + random() * 0.45;
  const secondaryCycles = shortSafeCorridor
    ? 1.55 + random() * 0.55
    : 2.4 + random() * 0.8;
  const basePrimaryAmplitude = shortSafeCorridor
    ? safeCorridorWidth * (0.2 + random() * 0.12)
    : 68 + random() * 34;
  const baseSecondaryAmplitude = shortSafeCorridor
    ? 3 + random() * 5
    : 14 + random() * 18;
  const candidates = [];

  const amplitudeScales = shortSafeCorridor
    ? [0.75, 0.9, 1.05, 1.2, 1.35, 1.5, 1.7, 1.9]
    : [0.9, 1.05, 1.2, 1.35, 1.5, 1.65, 1.8, 2];
  for (const amplitudeScale of amplitudeScales) {
    const anchors = [];
    for (let index = 0; index < anchorCount; index += 1) {
      const t = index / (anchorCount - 1);
      const edgeFactor = Math.sin(Math.PI * t) ** 0.82;
      const primary =
        Math.sin(primaryPhase + t * Math.PI * 2 * primaryCycles) *
        basePrimaryAmplitude;
      const secondary =
        Math.sin(secondaryPhase + t * Math.PI * 2 * secondaryCycles) *
        baseSecondaryAmplitude;
      const offset = (primary + secondary) * edgeFactor * amplitudeScale;
      anchors.push({
        x: clamp(
          start.x + dx * t + nx * offset,
          safeBounds?.minimumX ?? 0,
          safeBounds?.maximumX ?? width,
        ),
        y: clamp(
          start.y + dy * t + ny * offset,
          safeBounds?.minimumY ?? 0,
          safeBounds?.maximumY ?? height,
        ),
      });
    }
    anchors[0] = { ...start };
    anchors[anchors.length - 1] = { ...end };
    const points = shortSafeCorridor
      ? catmullRomResample(
          anchors,
          12,
          width,
          height,
          safeBounds,
          3,
        )
      : sampleSmoothAnonymousOffsetCurve({
          start,
          end,
          nx,
          ny,
          primaryPhase,
          secondaryPhase,
          primaryCycles,
          secondaryCycles,
          basePrimaryAmplitude: Math.min(
            basePrimaryAmplitude,
            directLength * 0.22,
          ),
          baseSecondaryAmplitude: Math.min(
            baseSecondaryAmplitude,
            directLength * 0.055,
          ),
          amplitudeScale,
          width,
          height,
          safeBounds,
          pointCount: 161,
        });
    const audit = auditAnonymousRouteNaturalness(points, profile);
    candidates.push({
      points,
      audit,
      amplitudeScale,
    });
  }

  const passing = candidates.filter((entry) => entry.audit.passed);
  assert(
    passing.length > 0,
    `anonymous route generator could not satisfy the public-data naturalness envelope: ${JSON.stringify(
      candidates.map((entry) => entry.audit),
    )}`,
  );
  passing.sort(
    (left, right) =>
      Math.abs(left.audit.sinuosity - envelope.targetSinuosity) -
      Math.abs(right.audit.sinuosity - envelope.targetSinuosity),
  );
  passing[0].audit.safeBounds = safeBounds
    ? structuredClone(safeBounds)
    : null;
  passing[0].audit.generationConstruction = shortSafeCorridor
    ? "short_safe_corridor_scaled_amplitude_catmull_rom_v1"
    : "continuous_multi_frequency_anonymous_offset_curve_subpixel_sampling_v5";
  passing[0].audit.coordinatePrecisionDecimals = 3;
  passing[0].audit.reviewThresholdsChanged = false;
  passing[0].audit.selectedAmplitudeScale =
    passing[0].amplitudeScale;
  return passing[0];
}

function sampleSmoothAnonymousOffsetCurve({
  start,
  end,
  nx,
  ny,
  primaryPhase,
  secondaryPhase,
  primaryCycles,
  secondaryCycles,
  basePrimaryAmplitude,
  baseSecondaryAmplitude,
  amplitudeScale,
  width,
  height,
  safeBounds,
  pointCount,
}) {
  const points = [];
  for (let index = 0; index < pointCount; index += 1) {
    const t = index / (pointCount - 1);
    const edgeFactor = Math.sin(Math.PI * t) ** 2;
    const primary =
      Math.sin(primaryPhase + t * Math.PI * 2 * primaryCycles) *
      basePrimaryAmplitude;
    const secondary =
      Math.sin(secondaryPhase + t * Math.PI * 2 * secondaryCycles) *
      baseSecondaryAmplitude;
    const offset = (primary + secondary) * edgeFactor * amplitudeScale;
    pushUniquePoint(points, {
      x: Number(
        clamp(
          start.x + (end.x - start.x) * t + nx * offset,
          safeBounds?.minimumX ?? 0,
          safeBounds?.maximumX ?? width,
        ).toFixed(3),
      ),
      y: Number(
        clamp(
          start.y + (end.y - start.y) * t + ny * offset,
          safeBounds?.minimumY ?? 0,
          safeBounds?.maximumY ?? height,
        ).toFixed(3),
      ),
    });
  }
  points[0] = { ...start };
  points[points.length - 1] = { ...end };
  return points;
}

export function buildNaturalRouteHalfWidths(pointCount, random) {
  assert(pointCount >= 2, "route width profile requires at least two points");
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  return Array.from({ length: pointCount }, (_, index) => {
    const t = index / (pointCount - 1);
    const width =
      17.5 +
      Math.sin(phaseA + t * Math.PI * 2.2) * 1.5 +
      Math.sin(phaseB + t * Math.PI * 5.1) * 0.65;
    return Math.round(clamp(width, 15, 20));
  });
}

export function auditAnonymousRouteNaturalness(points, profile) {
  const envelope = profile.anonymousGenerationEnvelope;
  const segmentLengths = [];
  const interiorTurns = [];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = distance(points[index - 1], points[index]);
    segmentLengths.push(length);
    totalLength += length;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    interiorTurns.push(
      turnDegrees(points[index - 1], points[index], points[index + 1]),
    );
  }
  const chordLength = distance(points[0], points[points.length - 1]);
  const sinuosity = totalLength / Math.max(1, chordLength);
  const maximumSegmentPixels = Math.max(0, ...segmentLengths);
  const maximumInteriorTurnDegrees = Math.max(0, ...interiorTurns);
  const cumulativeTurnDegrees = interiorTurns.reduce(
    (total, value) => total + value,
    0,
  );
  const failures = [];
  check(
    points.length >= envelope.minimumCenterlinePointCount,
    failures,
    "route_centerline_point_density_insufficient",
  );
  check(
    maximumSegmentPixels <= envelope.maximumCenterlineSegmentPixels,
    failures,
    "route_centerline_segment_too_long",
  );
  check(
    sinuosity >= envelope.minimumSinuosity,
    failures,
    "route_sinuosity_below_public_reference_envelope",
  );
  check(
    sinuosity <= envelope.maximumSinuosity,
    failures,
    "route_sinuosity_above_public_reference_envelope",
  );
  check(
    maximumInteriorTurnDegrees <= envelope.maximumInteriorTurnDegrees,
    failures,
    "route_interior_turn_too_rigid",
  );
  check(
    cumulativeTurnDegrees >= envelope.minimumCumulativeTurnDegrees,
    failures,
    "route_cumulative_curvature_insufficient",
  );
  return {
    schemaVersion: "anonymous-route-naturalness-audit-v1",
    status: failures.length === 0 ? "passed" : "failed",
    passed: failures.length === 0,
    failures,
    pointCount: points.length,
    totalLengthPixels: round(totalLength, 6),
    chordLengthPixels: round(chordLength, 6),
    sinuosity: round(sinuosity, 6),
    maximumSegmentPixels: round(maximumSegmentPixels, 6),
    maximumInteriorTurnDegrees: round(maximumInteriorTurnDegrees, 6),
    cumulativeTurnDegrees: round(cumulativeTurnDegrees, 6),
    referenceEnvelope: structuredClone(envelope),
    exactSourceGeometryComparedOrCopied: false,
  };
}

function measurePublicRouteGeometry(geometry) {
  const latitudeMean =
    geometry.reduce((total, point) => total + point.lat, 0) /
    geometry.length;
  const latitudeScale = 110_540;
  const longitudeScale =
    111_320 * Math.cos((latitudeMean * Math.PI) / 180);
  const points = geometry.map((point) => ({
    x: point.lon * longitudeScale,
    y: point.lat * latitudeScale,
  }));
  let totalLengthMetres = 0;
  const turns = [];
  for (let index = 1; index < points.length; index += 1) {
    totalLengthMetres += distance(points[index - 1], points[index]);
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const previousLength = distance(points[index - 1], points[index]);
    const nextLength = distance(points[index], points[index + 1]);
    if (previousLength >= 2 && nextLength >= 2) {
      turns.push(
        turnDegrees(points[index - 1], points[index], points[index + 1]),
      );
    }
  }
  const chordLengthMetres = distance(points[0], points[points.length - 1]);
  return {
    totalLengthMetres,
    sinuosity: totalLengthMetres / Math.max(1, chordLengthMetres),
    meanTurnDegrees:
      turns.reduce((total, value) => total + value, 0) /
      Math.max(1, turns.length),
    maximumTurnDegrees: Math.max(0, ...turns),
  };
}

function catmullRomResample(
  anchors,
  samplesPerSegment,
  width,
  height,
  safeBounds = null,
  coordinatePrecision = 0,
) {
  const quantizeCoordinate = (value) => {
    const clamped = clamp(value, 0, Number.MAX_SAFE_INTEGER);
    return coordinatePrecision > 0
      ? Number(clamped.toFixed(coordinatePrecision))
      : Math.round(clamped);
  };
  const points = [];
  for (let segment = 0; segment < anchors.length - 1; segment += 1) {
    const p0 = anchors[Math.max(0, segment - 1)];
    const p1 = anchors[segment];
    const p2 = anchors[segment + 1];
    const p3 = anchors[Math.min(anchors.length - 1, segment + 2)];
    for (let sample = 0; sample < samplesPerSegment; sample += 1) {
      const t = sample / samplesPerSegment;
      const point = catmullRomPoint(p0, p1, p2, p3, t);
      pushUniquePoint(points, {
        x: quantizeCoordinate(
          clamp(
            point.x,
            safeBounds?.minimumX ?? 0,
            safeBounds?.maximumX ?? width,
          ),
        ),
        y: quantizeCoordinate(
          clamp(
            point.y,
            safeBounds?.minimumY ?? 0,
            safeBounds?.maximumY ?? height,
          ),
        ),
      });
    }
  }
  pushUniquePoint(points, {
    x: quantizeCoordinate(anchors.at(-1).x),
    y: quantizeCoordinate(anchors.at(-1).y),
  });
  return points;
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function pushUniquePoint(points, point) {
  const previous = points.at(-1);
  if (!previous || previous.x !== point.x || previous.y !== point.y) {
    points.push(point);
  }
}

function turnDegrees(previous, current, next) {
  const ax = current.x - previous.x;
  const ay = current.y - previous.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (aLength === 0 || bLength === 0) return 0;
  const cosine = clamp(
    (ax * bx + ay * by) / (aLength * bLength),
    -1,
    1,
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function quantile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * ratio),
  );
  return sorted[index];
}

function check(condition, failures, code) {
  if (!condition) failures.push(code);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
