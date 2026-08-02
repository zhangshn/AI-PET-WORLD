import crypto from "node:crypto";

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;
const RESAMPLE_COUNT = 9;

export function buildCompleteMapSemanticTopologySignature(
  blueprint,
  { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = {},
) {
  const geometry = blueprint?.geometry ?? blueprint ?? {};
  const route = buildLineSignature(
    geometry.pathCenterline ?? [],
    width,
    height,
  );
  const water = buildWaterSignature(geometry, width, height);
  const ecology = buildEcologySignature(geometry, width, height);
  const contractedEntrySide = inferContractedEntrySide(
    geometry.entranceBounds,
    width,
    height,
  );
  const routeWaterRelationSequence = buildRouteWaterRelationSequence(
    geometry.pathCenterline ?? [],
    geometry.waterCenterline ?? [],
    width,
    height,
  );
  const routePayload = {
    contractedEntrySide,
    routeTopologyFamily: geometry.routeTopology ?? "missing",
    boundaryContactSequence: route.boundaryContactSequence,
    spanAxisClass: route.spanAxisClass,
    originBandClass: route.originBandClass,
    majorTurnSequence: route.majorTurnSequence,
    majorBendCountClass: route.majorBendCountClass,
    turningDirectionPattern: route.turningDirectionPattern,
    normalizedShapeMotif: route.mirrorInvariantShapeMotif,
    routeWaterRelationSequence,
  };
  const waterPayload = {
    present: water.present,
    boundaryInletOutletPattern: water.boundaryInletOutletPattern,
    mainChannelCount: water.mainChannelCount,
    networkConnectionMode: water.networkConnectionMode,
    divergenceCount: water.divergenceCount,
    rejoinCount: water.rejoinCount,
    divergenceRejoinOrder: water.divergenceRejoinOrder,
    branchSideSequence: water.branchSideSequence,
    islandCountAndShapeClass: water.islandCountAndShapeClass,
    tributaryConfluenceCount: water.tributaryConfluenceCount,
    distributaryCount: water.distributaryCount,
    backwaterCountAndLongitudinalClass:
      water.backwaterCountAndLongitudinalClass,
    dominantAxis: water.mainLine.spanAxisClass,
    majorBendSequence: water.mainLine.majorTurnSequence,
    shorelineEnclosurePattern: water.shorelineEnclosurePattern,
    normalizedMainShapeMotif: water.mainLine.mirrorInvariantShapeMotif,
    visualTrainingMotif: {
      boundaryInletOutletPattern: water.boundaryInletOutletPattern,
      dominantAxis: water.mainLine.spanAxisClass,
      majorBendSequence: water.mainLine.majorTurnSequence,
      majorBendCountClass: water.mainLine.majorBendCountClass,
      branchCountClass: String(Math.min(3, water.branchCount)),
      branchSideSequence: water.branchSideSequence,
      singleSideBranchOrNearLoop:
        water.branchCount === 1 &&
        new Set(water.branchSideSequence).size === 1,
    },
  };
  const completePayload = {
    route: routePayload,
    waterAndShoreline: waterPayload,
    routeWaterRelationship: routeWaterRelationSequence,
    ecologicalZoneAdjacency: ecology.ecologicalZoneAdjacency,
    dominantOpenClosedSpaceArrangement:
      ecology.dominantOpenClosedSpaceArrangement,
    majorObjectClusterArrangement: ecology.majorObjectClusterArrangement,
  };
  return {
    schemaVersion: "complete-map-semantic-topology-signature-v1",
    route: routePayload,
    waterAndShoreline: waterPayload,
    ecology,
    identities: {
      routeSemanticIdentity: canonicalSha256(routePayload),
      waterSemanticIdentity: canonicalSha256(waterPayload),
      completeSkeletonSemanticIdentity: canonicalSha256(completePayload),
      routeMotifIdentity: canonicalSha256({
        routeTopologyFamily: routePayload.routeTopologyFamily,
        spanAxisClass: routePayload.spanAxisClass,
        originBandClass: routePayload.originBandClass,
        majorTurnSequence: routePayload.majorTurnSequence,
        majorBendCountClass: routePayload.majorBendCountClass,
        normalizedShapeMotif: routePayload.normalizedShapeMotif,
      }),
      waterNetworkTypeIdentity: canonicalSha256({
        present: waterPayload.present,
        networkConnectionMode: waterPayload.networkConnectionMode,
        divergenceCount: waterPayload.divergenceCount,
        rejoinCount: waterPayload.rejoinCount,
        divergenceRejoinOrder: waterPayload.divergenceRejoinOrder,
        tributaryConfluenceCount: waterPayload.tributaryConfluenceCount,
        distributaryCount: waterPayload.distributaryCount,
      }),
      waterVisualTrainingMotifIdentity: canonicalSha256(
        waterPayload.visualTrainingMotif,
      ),
    },
  };
}

function buildWaterSignature(geometry, width, height) {
  const main = geometry.waterCenterline ?? [];
  const branches = (geometry.waterBranchCenterlines ?? []).filter(
    (entry) => Array.isArray(entry) && entry.length >= 2,
  );
  const profile = geometry.internalHydrologyProfile ?? {};
  const mode = main.length < 2
    ? "absent"
    : profile.internalNetworkConnectionMode ??
      inferWaterMode(main, branches, width, height);
  const divergenceCount = mode === "main_channel_anabranch"
    ? branches.length
    : 0;
  const rejoinCount = mode === "main_channel_anabranch"
    ? branches.length
    : 0;
  const tributaryConfluenceCount =
    mode === "interior_headwater_tributary_to_main_channel"
      ? Math.max(1, branches.length)
      : 0;
  const distributaryCount = mode.includes("distributary")
    ? Math.max(1, branches.length)
    : 0;
  const branchSideSequence = branches.map((branch) =>
    relativeBranchSide(main, branch),
  );
  const backwaterCount = Number(
    profile.backwaterBasinCount ?? 0,
  );
  const backwaterLongitudinal = (
    profile.backwaterBasinLongitudinalFractions ?? []
  ).map(ordinalBand);
  return {
    present: main.length >= 2,
    mainChannelCount: main.length >= 2 ? 1 : 0,
    networkConnectionMode: mode,
    divergenceCount,
    rejoinCount,
    divergenceRejoinOrder:
      mode === "main_channel_anabranch"
        ? "diverge_then_rejoin"
        : mode === "interior_headwater_tributary_to_main_channel"
          ? "headwater_then_confluence"
          : mode.includes("distributary")
            ? "diverge_without_rejoin"
            : main.length >= 2
              ? "single_channel"
              : "absent",
    branchSideSequence,
    branchCount: branches.length,
    islandCountAndShapeClass:
      mode === "main_channel_anabranch"
        ? `${Math.max(1, branches.length)}:${classifyIslandShape(profile)}`
        : "0:none",
    tributaryConfluenceCount,
    distributaryCount,
    backwaterCountAndLongitudinalClass:
      `${backwaterCount}:${backwaterLongitudinal.join("-") || "none"}`,
    shorelineEnclosurePattern:
      mode === "main_channel_anabranch"
        ? "branch_enclosed_island"
        : mode === "interior_headwater_tributary_to_main_channel"
          ? "open_confluence"
          : main.length >= 2
            ? "open_single_corridor"
            : "absent",
    boundaryInletOutletPattern: buildLineSignature(
      main,
      width,
      height,
    ).boundaryContactSequence,
    mainLine: buildLineSignature(main, width, height),
  };
}

function buildLineSignature(points, width, height) {
  if (!Array.isArray(points) || points.length < 2) {
    return {
      present: false,
      boundaryContactSequence: "absent",
      spanAxisClass: "absent",
      originBandClass: "absent",
      majorTurnSequence: "absent",
      majorBendCountClass: "0",
      turningDirectionPattern: "absent",
      mirrorInvariantShapeMotif: "absent",
    };
  }
  const normalized = points.map((point) => ({
    x: clamp(point.x / width, 0, 1),
    y: clamp(point.y / height, 0, 1),
  }));
  const sampled = resamplePolyline(normalized, RESAMPLE_COUNT);
  const headings = [];
  for (let index = 1; index < sampled.length; index += 1) {
    headings.push(
      Math.atan2(
        sampled[index].y - sampled[index - 1].y,
        sampled[index].x - sampled[index - 1].x,
      ),
    );
  }
  const turnTokens = [];
  for (let index = 1; index < headings.length; index += 1) {
    const difference = normalizeAngle(headings[index] - headings[index - 1]);
    const degrees = Math.abs((difference * 180) / Math.PI);
    if (degrees < 16) continue;
    turnTokens.push(`${difference < 0 ? "R" : "L"}${degrees >= 48 ? "2" : "1"}`);
  }
  const compressedTurns = compressTokens(turnTokens);
  const dx = Math.abs(sampled.at(-1).x - sampled[0].x);
  const dy = Math.abs(sampled.at(-1).y - sampled[0].y);
  const spanAxisClass = dy > dx * 1.25
    ? "longitudinal"
    : dx > dy * 1.25
      ? "transverse"
      : "diagonal_or_mixed";
  return {
    present: true,
    boundaryContactSequence: boundaryContacts(normalized),
    spanAxisClass,
    originBandClass: pointBand(normalized[0]),
    majorTurnSequence: compressedTurns.join("-") || "straight_or_soft",
    majorBendCountClass: String(Math.min(4, compressedTurns.length)),
    turningDirectionPattern:
      compressedTurns.map((entry) => entry[0]).join("") || "none",
    mirrorInvariantShapeMotif: mirrorInvariantShapeMotif(sampled),
  };
}

function buildRouteWaterRelationSequence(route, water, width, height) {
  if (route.length < 2 || water.length < 2) return "not_applicable";
  const routeSamples = resamplePolyline(
    route.map((p) => ({ x: p.x / width, y: p.y / height })),
    6,
  );
  const waterSamples = resamplePolyline(
    water.map((p) => ({ x: p.x / width, y: p.y / height })),
    6,
  );
  return routeSamples.map((point, index) => {
    const difference = point.x - waterSamples[index].x;
    return difference < -0.1
      ? "L"
      : difference > 0.1
        ? "R"
        : "O";
  }).join("");
}

function buildEcologySignature(geometry, width, height) {
  const zones = geometry.ecologicalZones ?? [];
  const zoneCentroids = zones
    .map((zone) => polygonCentroid(zone.polygon ?? [], width, height))
    .filter(Boolean);
  const adjacency = [];
  for (let left = 0; left < zoneCentroids.length; left += 1) {
    const distances = [];
    for (let right = 0; right < zoneCentroids.length; right += 1) {
      if (left === right) continue;
      distances.push({
        index: right,
        distance: distance(zoneCentroids[left], zoneCentroids[right]),
      });
    }
    distances.sort((a, b) => a.distance - b.distance);
    adjacency.push(`${left}>${distances[0]?.index ?? "none"}`);
  }
  const architecture = geometry.compositionArchitecture ?? {};
  const meadow = polygonCentroid(
    architecture.openMeadowPolygon ?? [],
    width,
    height,
  );
  const clusters = (architecture.objectPlacementZones ?? [])
    .map((zone) => polygonCentroid(zone.polygon ?? [], width, height))
    .filter(Boolean)
    .map(pointBand)
    .sort();
  return {
    ecologicalZoneAdjacency: adjacency.join("|") || "none",
    dominantOpenClosedSpaceArrangement: meadow
      ? pointBand(meadow)
      : "none",
    majorObjectClusterArrangement: clusters.join("-") || "none",
  };
}

function mirrorInvariantShapeMotif(points) {
  const variants = [
    points,
    points.map((p) => ({ x: 1 - p.x, y: p.y })),
    points.map((p) => ({ x: p.x, y: 1 - p.y })),
    points.map((p) => ({ x: 1 - p.x, y: 1 - p.y })),
  ];
  return variants
    .map((variant) => normalizedShapeCode(variant))
    .sort()[0];
}

function normalizedShapeCode(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);
  return points.map((point) => {
    const x = Math.round(((point.x - minX) / spanX) * 4);
    const y = Math.round(((point.y - minY) / spanY) * 4);
    return `${x}${y}`;
  }).join(".");
}

function resamplePolyline(points, count) {
  if (points.length === 0) return [];
  if (points.length === 1) return Array(count).fill(points[0]);
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(
      cumulative.at(-1) + distance(points[index - 1], points[index]),
    );
  }
  const total = cumulative.at(-1);
  return Array.from({ length: count }, (_, index) => {
    const target = (total * index) / (count - 1);
    let right = cumulative.findIndex((value) => value >= target);
    if (right <= 0) return points[0];
    if (right < 0) return points.at(-1);
    const left = right - 1;
    const span = Math.max(1e-9, cumulative[right] - cumulative[left]);
    const t = (target - cumulative[left]) / span;
    return {
      x: points[left].x + (points[right].x - points[left].x) * t,
      y: points[left].y + (points[right].y - points[left].y) * t,
    };
  });
}

function boundaryContacts(points) {
  const contacts = [];
  for (const point of [points[0], points.at(-1)]) {
    const distances = [
      [point.x, "west"],
      [1 - point.x, "east"],
      [point.y, "north"],
      [1 - point.y, "south"],
    ].sort((a, b) => a[0] - b[0]);
    contacts.push(distances[0][0] <= 0.035 ? distances[0][1] : "interior");
  }
  return contacts.join("_to_");
}

function inferContractedEntrySide(bounds, width, height) {
  if (!bounds) return "missing";
  const center = {
    x: (bounds.x + bounds.width / 2) / width,
    y: (bounds.y + bounds.height / 2) / height,
  };
  return [
    [center.x, "west"],
    [1 - center.x, "east"],
    [center.y, "north"],
    [1 - center.y, "south"],
  ].sort((a, b) => a[0] - b[0])[0][1];
}

function pointBand(point) {
  const x = point.x < 1 / 3 ? "W" : point.x > 2 / 3 ? "E" : "C";
  const y = point.y < 1 / 3 ? "N" : point.y > 2 / 3 ? "S" : "C";
  return `${y}${x}`;
}

function ordinalBand(value) {
  return value < 1 / 3 ? "upper" : value > 2 / 3 ? "lower" : "middle";
}

function classifyIslandShape(profile) {
  const divergence = Number(profile.divergenceFraction ?? 0.25);
  const rejoin = Number(profile.rejoinFraction ?? 0.75);
  const span = rejoin - divergence;
  const offset = Number(profile.lateralOffsetFraction ?? 0.15);
  if (span >= 0.58) return "long_lens";
  if (offset >= 0.23) return "broad_lens";
  return "compact_lens";
}

function inferWaterMode(main, branches) {
  if (main.length < 2) return "absent";
  if (branches.length === 0) return "single_main_channel";
  return "unclassified_branched_network";
}

function relativeBranchSide(main, branch) {
  const mainMean = main.reduce((sum, point) => sum + point.x, 0) / main.length;
  const branchMean = branch.reduce((sum, point) => sum + point.x, 0) / branch.length;
  return branchMean < mainMean ? "west" : "east";
}

function polygonCentroid(polygon, width, height) {
  if (!Array.isArray(polygon) || polygon.length < 3) return null;
  return {
    x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length / width,
    y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length / height,
  };
}

function compressTokens(tokens) {
  const result = [];
  for (const token of tokens) {
    if (result.at(-1)?.[0] === token[0]) {
      if (token[1] === "2") result[result.length - 1] = token;
    } else {
      result.push(token);
    }
  }
  return result;
}

function normalizeAngle(value) {
  let result = value;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function canonicalSha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortObject(value)))
    .digest("hex");
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObject(value[key])]),
  );
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
