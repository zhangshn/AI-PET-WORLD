const NATURAL_WATERWAY_CLASSES = new Set(["river", "stream"])
export const NATURAL_WATER_CENTERLINE_POINT_COUNT = 121

export function buildAnonymousWaterNaturalnessProfile({
  rawOsm,
  source,
  createdAtUtc,
  createdAtAsiaShanghai,
}) {
  const sourceWays = (rawOsm.elements ?? []).filter(
    (element) =>
      element.type === "way" &&
      NATURAL_WATERWAY_CLASSES.has(element.tags?.waterway) &&
      Array.isArray(element.geometry) &&
      element.geometry.length >= 4,
  )
  assert(
    sourceWays.length >= 8,
    "public waterway evidence is insufficient for an aggregate naturalness profile",
  )
  const metrics = sourceWays
    .map((way) => measurePublicWaterGeometry(way.geometry))
    .filter((entry) => entry.totalLengthMetres >= 100)
  assert(
    metrics.length >= 8,
    "public waterway evidence has insufficient measurable natural waterways",
  )

  const sinuosity = metrics.map((entry) => entry.sinuosity)
  const meanTurnDegrees = metrics.map((entry) => entry.meanTurnDegrees)
  const maximumTurnDegrees = metrics.map((entry) => entry.maximumTurnDegrees)
  const sourceClassCounts = {}
  for (const way of sourceWays) {
    const waterwayClass = way.tags.waterway
    sourceClassCounts[waterwayClass] =
      (sourceClassCounts[waterwayClass] ?? 0) + 1
  }
  const sinuosityQ25 = quantile(sinuosity, 0.25)
  const sinuosityQ50 = quantile(sinuosity, 0.5)
  const sinuosityQ75 = quantile(sinuosity, 0.75)
  return {
    schemaVersion: "anonymous-water-naturalness-reference-profile-v1",
    profileId:
      source.profileId ??
      "sakaerat-wang-nam-khiao-anonymous-water-naturalness-v1",
    status: "aggregate_public_water_naturalness_profile_ready",
    createdAtUtc,
    createdAtAsiaShanghai,
    source: {
      ...source,
      allowedUse:
        "aggregate_non_spatial_watercourse_morphology_reference_for_anonymous_game_coordinate_generation",
      exactGeometryCopied: false,
      coordinatesPersistedInProfile: false,
      osmElementIdsPersistedInProfile: false,
      perFeatureMetricsPersistedInProfile: false,
    },
    selection: {
      eligibleWaterwayClasses: [...NATURAL_WATERWAY_CLASSES],
      sourceWayCount: sourceWays.length,
      measurableWayCount: metrics.length,
      sourceClassCounts,
      minimumSourceWayCount: 8,
    },
    aggregateStatistics: {
      sinuosity: quantileRecord(sinuosity),
      meanTurnDegrees: quantileRecord(meanTurnDegrees),
      maximumTurnDegrees: quantileRecord(maximumTurnDegrees),
    },
    anonymousGenerationEnvelope: {
      minimumSinuosity: round(Math.max(1.08, sinuosityQ25 - 0.02), 6),
      targetSinuosity: round(clamp(sinuosityQ50, 1.16, 1.45), 6),
      maximumSinuosity: round(Math.min(1.8, sinuosityQ75 + 0.2), 6),
      minimumCenterlinePointCount: 49,
      maximumCenterlineSegmentPixels: 24,
      maximumInteriorTurnDegrees: round(
        Math.min(18, Math.max(10, quantile(maximumTurnDegrees, 0.25))),
        6,
      ),
      minimumCumulativeTurnDegrees: 50,
      curveConstruction:
        "multi_frequency_anonymous_water_anchors_plus_catmull_rom_resampling_v1",
      widthConstruction:
        "slowly_varying_anonymous_water_and_shoreline_half_width_profile_v1",
    },
    identityBoundary: {
      aggregateStatisticsOnly: true,
      exactRealWorldGeometryCarriedForward: false,
      exactOsmGeometryCarriedForward: false,
      sourcePixelCoordinatesCarriedForward: false,
      finalGameCoordinatesRemainAnonymous: true,
    },
  }
}

export function buildNaturalAnonymousWaterCenterline({
  start,
  end,
  random,
  width,
  height,
  profile,
  interiorBias = { x: 0, y: 0 },
  broadRiverMode = false,
  broadRiverControlFractions = null,
  preferredSinuosity = null,
  corridorHalfWidths = null,
}) {
  assert(
    profile?.status === "aggregate_public_water_naturalness_profile_ready",
    "anonymous water naturalness reference profile is missing",
  )
  const envelope = profile.anonymousGenerationEnvelope
  const dx = end.x - start.x
  const dy = end.y - start.y
  const directLength = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / directLength
  const ny = dx / directLength
  const anchorCount = 13
  const primaryPhase = random() * Math.PI * 2
  const secondaryPhase = random() * Math.PI * 2
  const primaryCycles = broadRiverMode
    ? 0.55 + random() * 0.3
    : 1 + random() * 0.42
  const secondaryCycles = broadRiverMode
    ? 1.25 + random() * 0.5
    : 2.2 + random() * 0.9
  const basePrimaryAmplitude = broadRiverMode
    ? 90 + random() * 55
    : 54 + random() * 38
  const baseSecondaryAmplitude = broadRiverMode
    ? 8 + random() * 14
    : 12 + random() * 18
  const candidates = []
  const addCandidate = (points) => {
    const audit = auditAnonymousWaterNaturalness(points, profile)
    const corridorAudit = corridorHalfWidths
      ? auditAnonymousWaterCorridorShape(points, corridorHalfWidths)
      : null
    candidates.push({ points, audit, corridorAudit })
  }
  if (broadRiverMode) {
    const effectiveControlFractions =
      broadRiverControlFractions ?? [0.26, 0.3, 0.34, 0.38, 0.42]
    assert(
      Array.isArray(effectiveControlFractions) &&
        effectiveControlFractions.length >= 3 &&
        effectiveControlFractions.every(
          (value) =>
            Number.isFinite(value) && value >= 0.08 && value <= 0.6,
        ),
      "broad river control fractions are invalid",
    )
    const controlY = height * (0.46 + random() * 0.08)
    const controlFractionJitter = (random() - 0.5) * 0.018
    const variationPhase = random() * Math.PI * 2
    const variationCycles = 1.05 + random() * 0.3
    const variationAmplitude = 4 + random() * 5
    for (const controlFraction of effectiveControlFractions) {
      addCandidate(
        broadRiverBezierCenterline({
          start,
          end,
          control: {
            x: width * (controlFraction + controlFractionJitter),
            y: controlY,
          },
          variationPhase,
          variationCycles,
          variationAmplitude,
          width,
          height,
        }),
      )
    }
  } else {
    for (const amplitudeScale of [
      0.7,
      0.85,
      1,
      1.15,
      1.3,
      1.5,
      1.7,
      1.9,
      2,
      2.05,
      2.1,
      2.15,
      2.4,
    ]) {
      const anchors = []
      for (let index = 0; index < anchorCount; index += 1) {
        const t = index / (anchorCount - 1)
        const edgeFactor = Math.sin(Math.PI * t) ** 2
        const interiorFactor = Math.sin(Math.PI * t) ** 2
        const primary =
          Math.sin(primaryPhase + t * Math.PI * 2 * primaryCycles) *
          basePrimaryAmplitude
        const secondary =
          Math.sin(
            secondaryPhase + t * Math.PI * 2 * secondaryCycles,
          ) * baseSecondaryAmplitude
        const offset =
          (primary + secondary) * edgeFactor * amplitudeScale
        anchors.push({
          x: clamp(
            start.x +
              dx * t +
              interiorBias.x * interiorFactor +
              nx * offset,
            0,
            width,
          ),
          y: clamp(
            start.y +
              dy * t +
              interiorBias.y * interiorFactor +
              ny * offset,
            0,
            height,
          ),
        })
      }
      anchors[0] = { ...start }
      anchors[anchors.length - 1] = { ...end }
      addCandidate(catmullRomResample(anchors, 10, width, height))
    }
  }
  const passing = candidates.filter(
    (entry) =>
      entry.audit.passed &&
      (!entry.corridorAudit || entry.corridorAudit.passed),
  )
  assert(
    passing.length > 0,
    `anonymous water generator could not satisfy the public-data naturalness envelope: ${JSON.stringify(
      candidates.map((entry) => ({
        centerlineAudit: entry.audit,
        corridorAudit: entry.corridorAudit,
      })),
    )}`,
  )
  passing.sort(
    (left, right) =>
      Math.abs(
        left.audit.sinuosity -
          (preferredSinuosity ?? envelope.targetSinuosity),
      ) -
      Math.abs(
        right.audit.sinuosity -
          (preferredSinuosity ?? envelope.targetSinuosity),
      ),
  )
  const selected = passing[0]
  selected.audit.selectionTargetSinuosity = round(
    preferredSinuosity ?? envelope.targetSinuosity,
    6,
  )
  selected.audit.broadRiverMode = broadRiverMode
  selected.audit.broadRiverControlFractions = broadRiverMode
    ? structuredClone(
        broadRiverControlFractions ?? [
          0.26,
          0.3,
          0.34,
          0.38,
          0.42,
        ],
      )
    : null
  return selected
}

export function buildNaturalWaterHalfWidths(
  pointCount,
  random,
  {
    startHalfWidth = 48,
    endHalfWidth = 62,
  } = {},
) {
  assert(pointCount >= 2, "water width profile requires at least two points")
  const phaseA = random() * Math.PI * 2
  const phaseB = random() * Math.PI * 2
  const widths = Array.from({ length: pointCount }, (_, index) => {
    const t = index / (pointCount - 1)
    const downstreamWidening =
      startHalfWidth + t * (endHalfWidth - startHalfWidth)
    const variationEnvelope = Math.sin(Math.PI * t) ** 2
    const width =
      downstreamWidening +
      (Math.sin(phaseA + t * Math.PI * 1.7) * 5 +
        Math.sin(phaseB + t * Math.PI * 4.2) * 2) *
        variationEnvelope
    return Math.round(
      clamp(
        width,
        Math.max(1, Math.min(startHalfWidth, endHalfWidth) - 9),
        Math.max(startHalfWidth, endHalfWidth) + 9,
      ),
    )
  })
  widths[0] = Math.round(startHalfWidth)
  widths[widths.length - 1] = Math.round(endHalfWidth)
  return widths
}

export function auditAnonymousWaterNaturalness(points, profile) {
  const envelope = profile.anonymousGenerationEnvelope
  const segmentLengths = []
  const interiorTurns = []
  let totalLength = 0
  for (let index = 1; index < points.length; index += 1) {
    const length = distance(points[index - 1], points[index])
    segmentLengths.push(length)
    totalLength += length
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    interiorTurns.push(
      turnDegrees(points[index - 1], points[index], points[index + 1]),
    )
  }
  const chordLength = distance(points[0], points.at(-1))
  const sinuosity = totalLength / Math.max(1, chordLength)
  const maximumSegmentPixels = Math.max(0, ...segmentLengths)
  const maximumInteriorTurnDegrees = Math.max(0, ...interiorTurns)
  const cumulativeTurnDegrees = interiorTurns.reduce(
    (total, value) => total + value,
    0,
  )
  const failures = []
  check(
    points.length >= envelope.minimumCenterlinePointCount,
    failures,
    "water_centerline_point_density_insufficient",
  )
  check(
    maximumSegmentPixels <= envelope.maximumCenterlineSegmentPixels,
    failures,
    "water_centerline_segment_too_long",
  )
  check(
    sinuosity >= envelope.minimumSinuosity,
    failures,
    "water_sinuosity_below_public_reference_envelope",
  )
  check(
    sinuosity <= envelope.maximumSinuosity,
    failures,
    "water_sinuosity_above_public_reference_envelope",
  )
  check(
    maximumInteriorTurnDegrees <= envelope.maximumInteriorTurnDegrees,
    failures,
    "water_interior_turn_too_rigid",
  )
  check(
    cumulativeTurnDegrees >= envelope.minimumCumulativeTurnDegrees,
    failures,
    "water_cumulative_curvature_insufficient",
  )
  return {
    schemaVersion: "anonymous-water-naturalness-audit-v1",
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
  }
}

export function auditAnonymousWaterCorridorShape(points, halfWidths) {
  assert(
    points.length >= 3 && points.length === halfWidths.length,
    "water corridor shape audit inputs are invalid",
  )
  let minimumBendRadiusPixels = Number.POSITIVE_INFINITY
  let minimumBendRadiusToHalfWidthRatio = Number.POSITIVE_INFINITY
  let minimumBendRadiusPointIndex = null
  let minimumBendRadiusHalfWidthPixels = null
  let downstreamBacktrackCount = 0
  let maximumHalfWidthStepPixels = 0
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].y + 1e-6 < points[index - 1].y) {
      downstreamBacktrackCount += 1
    }
    maximumHalfWidthStepPixels = Math.max(
      maximumHalfWidthStepPixels,
      Math.abs(halfWidths[index] - halfWidths[index - 1]),
    )
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const a = distance(previous, current)
    const b = distance(current, next)
    const c = distance(previous, next)
    const doubledArea = Math.abs(
      (current.x - previous.x) * (next.y - previous.y) -
        (current.y - previous.y) * (next.x - previous.x),
    )
    if (doubledArea <= 1e-6) continue
    const radius = (a * b * c) / (2 * doubledArea)
    const radiusToHalfWidthRatio =
      radius / Math.max(1, halfWidths[index])
    if (
      radiusToHalfWidthRatio <
      minimumBendRadiusToHalfWidthRatio
    ) {
      minimumBendRadiusPixels = radius
      minimumBendRadiusToHalfWidthRatio =
        radiusToHalfWidthRatio
      minimumBendRadiusPointIndex = index
      minimumBendRadiusHalfWidthPixels =
        halfWidths[index]
    }
  }
  const failures = []
  check(
    downstreamBacktrackCount === 0,
    failures,
    "water_downstream_axis_backtracks",
  )
  check(
    minimumBendRadiusToHalfWidthRatio >= 1.15,
    failures,
    "water_inner_bank_bend_radius_too_tight",
  )
  check(
    maximumHalfWidthStepPixels <= 4,
    failures,
    "water_width_step_too_abrupt",
  )
  return {
    schemaVersion: "anonymous-water-corridor-shape-audit-v1",
    status: failures.length === 0 ? "passed" : "failed",
    passed: failures.length === 0,
    failures,
    downstreamBacktrackCount,
    minimumBendRadiusPixels: round(minimumBendRadiusPixels, 6),
    minimumBendRadiusPointIndex,
    minimumBendRadiusHalfWidthPixels,
    minimumBendRadiusToHalfWidthRatio: round(
      minimumBendRadiusToHalfWidthRatio,
      6,
    ),
    maximumHalfWidthStepPixels: round(maximumHalfWidthStepPixels, 6),
    minimumRequiredBendRadiusToHalfWidthRatio: 1.15,
  }
}

function measurePublicWaterGeometry(geometry) {
  const latitudeMean =
    geometry.reduce((total, point) => total + point.lat, 0) / geometry.length
  const latitudeScale = 110_540
  const longitudeScale =
    111_320 * Math.cos((latitudeMean * Math.PI) / 180)
  const points = geometry.map((point) => ({
    x: point.lon * longitudeScale,
    y: point.lat * latitudeScale,
  }))
  let totalLengthMetres = 0
  const turns = []
  for (let index = 1; index < points.length; index += 1) {
    totalLengthMetres += distance(points[index - 1], points[index])
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const previousLength = distance(points[index - 1], points[index])
    const nextLength = distance(points[index], points[index + 1])
    if (previousLength >= 2 && nextLength >= 2) {
      turns.push(turnDegrees(points[index - 1], points[index], points[index + 1]))
    }
  }
  const chordLengthMetres = distance(points[0], points.at(-1))
  return {
    totalLengthMetres,
    sinuosity: totalLengthMetres / Math.max(1, chordLengthMetres),
    meanTurnDegrees:
      turns.reduce((total, value) => total + value, 0) /
      Math.max(1, turns.length),
    maximumTurnDegrees: Math.max(0, ...turns),
  }
}

function broadRiverBezierCenterline({
  start,
  end,
  control,
  variationPhase,
  variationCycles,
  variationAmplitude,
  width,
  height,
}) {
  const points = []
  for (
    let index = 0;
    index < NATURAL_WATER_CENTERLINE_POINT_COUNT;
    index += 1
  ) {
    const t =
      index / (NATURAL_WATER_CENTERLINE_POINT_COUNT - 1)
    const inverse = 1 - t
    const base = {
      x:
        inverse * inverse * start.x +
        2 * inverse * t * control.x +
        t * t * end.x,
      y:
        inverse * inverse * start.y +
        2 * inverse * t * control.y +
        t * t * end.y,
    }
    const tangent = {
      x:
        2 * inverse * (control.x - start.x) +
        2 * t * (end.x - control.x),
      y:
        2 * inverse * (control.y - start.y) +
        2 * t * (end.y - control.y),
    }
    const tangentLength = Math.max(
      1,
      Math.hypot(tangent.x, tangent.y),
    )
    const envelope = Math.sin(Math.PI * t) ** 2
    const offset =
      Math.sin(
        variationPhase + t * Math.PI * 2 * variationCycles,
      ) *
      variationAmplitude *
      envelope
    points.push({
      x: round(
        clamp(base.x + (-tangent.y / tangentLength) * offset, 0, width),
        6,
      ),
      y: round(
        clamp(base.y + (tangent.x / tangentLength) * offset, 0, height),
        6,
      ),
    })
  }
  points[0] = { ...start }
  points[points.length - 1] = { ...end }
  return points
}

function catmullRomResample(anchors, samplesPerSegment, width, height) {
  const points = []
  for (let segment = 0; segment < anchors.length - 1; segment += 1) {
    const p0 = anchors[Math.max(0, segment - 1)]
    const p1 = anchors[segment]
    const p2 = anchors[segment + 1]
    const p3 = anchors[Math.min(anchors.length - 1, segment + 2)]
    for (let sample = 0; sample < samplesPerSegment; sample += 1) {
      const t = sample / samplesPerSegment
      const point = catmullRomPoint(p0, p1, p2, p3, t)
      pushUniquePoint(points, {
        x: round(clamp(point.x, 0, width), 6),
        y: round(clamp(point.y, 0, height), 6),
      })
    }
  }
  pushUniquePoint(points, {
    x: round(anchors.at(-1).x, 6),
    y: round(anchors.at(-1).y, 6),
  })
  return points
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
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
  }
}

function pushUniquePoint(points, point) {
  const previous = points.at(-1)
  if (!previous || previous.x !== point.x || previous.y !== point.y) {
    points.push(point)
  }
}

function quantileRecord(values) {
  return {
    q25: round(quantile(values, 0.25), 6),
    q50: round(quantile(values, 0.5), 6),
    q75: round(quantile(values, 0.75), 6),
  }
}

function turnDegrees(previous, current, next) {
  const ax = current.x - previous.x
  const ay = current.y - previous.y
  const bx = next.x - current.x
  const by = next.y - current.y
  const aLength = Math.hypot(ax, ay)
  const bLength = Math.hypot(bx, by)
  if (aLength === 0 || bLength === 0) return 0
  const cosine = clamp(
    (ax * bx + ay * by) / (aLength * bLength),
    -1,
    1,
  )
  return (Math.acos(cosine) * 180) / Math.PI
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function quantile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * ratio),
  )
  return sorted[index]
}

function check(condition, failures, code) {
  if (!condition) failures.push(code)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function round(value, digits) {
  return Number(value.toFixed(digits))
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}
