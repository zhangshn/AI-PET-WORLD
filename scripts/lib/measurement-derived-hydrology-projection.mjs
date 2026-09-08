import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NATURAL_WATER_CENTERLINE_POINT_COUNT, buildNaturalWaterHalfWidths, auditAnonymousWaterNaturalness,
  buildNaturalAnonymousWaterCenterline, auditAnonymousWaterCorridorShape } from "./anonymous-water-naturalness.mjs";
import { buildVariableWidthCorridorPolygons, replacementPathOriginWithinContract, describeMeasuredWaterDerivation } from "../build-earth-geospatial-complete-map-conditions.mjs";
import { buildCompleteMapStructuralIdentities, canonicalSha256 } from "./real-earth-region-governance.mjs";
import { rasterizePolygons, rasterizeFootprints } from "./current-world-condition-raster.mjs";
import { extractHistoricalGeometry } from "./ai-painter-stage4-historical-geometry.mjs";

const hash = v => createHash("sha256").update(JSON.stringify(v)).digest("hex");

// The source chain and neighbor chain remain distinct measured networks. This
// implementation supports only the observed east -> west -> north topology;
// other networks fail closed instead of being coerced into that topology.
export function projectMeasuredNeighborChannelPair({ upstreamProjection, sourceGraph, neighborPairing,
  neighborGraph, nextPairing, naturalnessProfile, naturalnessProfileBinding }) {
  const { width, height } = upstreamProjection.canvas;
  assert(width === 1024 && height === 768, "paired projection requires the native canvas");
  assert.deepEqual(upstreamProjection, projectMeasuredSingleChannel({ sourceGraph, neighborPairing,
    candidateId: upstreamProjection.candidateId, naturalnessProfile, naturalnessProfileBinding, width, height }),
    "upstream projection does not reproduce from its measured inputs");
  const upstreamPair = neighborPairing.pairs[0], neighborId = upstreamPair.neighborCandidateId;
  assert.equal(upstreamPair.sourceSide, "east", "unsupported paired projection orientation");
  assert.deepEqual(neighborGraph.sourceWindow, upstreamPair.neighborSourceWindow, "neighbor source window differs");
  assert.equal(neighborGraph.schemaVersion, "measured-window-hydrology-support-graph-v1");
  assert.equal(neighborGraph.gaps.length, 0, "neighbor graph has unresolved gaps");
  assert(neighborGraph.nodes.length >= 3 && neighborGraph.nodes.every(n => n.upstreamExcludedCellCount === 0),
    "neighbor graph intersects upstream exclusions");
  assert(neighborGraph.ports.length === 2 && neighborGraph.ports.every(p => !p.cornerAmbiguous && p.boundarySides.length === 1),
    "neighbor requires two unambiguous external ports");
  const inlet = neighborGraph.ports.find(p => p.role === "inlet"), outlet = neighborGraph.ports.find(p => p.role === "outlet");
  assert(inlet?.boundarySides[0] === "west" && outlet?.boundarySides[0] === "north", "unsupported neighbor topology");
  assert.equal(nextPairing.gaps.length, 0, "neighbor pairing has unresolved gaps");
  assert.equal(nextPairing.pairs.length, 2, "neighbor needs both measured port pairs");
  for (const port of neighborGraph.ports) {
    const pairs = nextPairing.pairs.filter(p => p.sourcePortId === port.nodeId);
    assert.equal(pairs.length, 1, "neighbor port pairing is not unique");
    const p = pairs[0], side = port.boundarySides[0];
    assert(p.sourceCandidateId === neighborId && p.neighborCandidateId !== neighborId &&
      p.sourceSide === side && p.neighborSide === ({ west: "east", north: "south" })[side] &&
      p.sourceRole === port.role && p.neighborRole === (port.role === "inlet" ? "outlet" : "inlet"),
      "neighbor pair identity or direction differs");
    assert.deepEqual(p.sourceIntersection, port.point, "neighbor pair does not describe the measured port");
    assert.deepEqual(p.sourceIntersection, p.neighborIntersection, "neighbor pair intersection differs");
    assert.equal(p.sourceCell, port.sourceCell); assert.equal(p.receiverCell, port.receiverCell);
  }
  const reverse = nextPairing.pairs.find(p => p.sourcePortId === inlet.nodeId);
  assert.equal(reverse.neighborCandidateId, upstreamProjection.candidateId, "neighbor does not return to upstream region");
  assert.deepEqual(reverse.sourceIntersection, upstreamPair.sourceIntersection);
  assert.equal(inlet.sourceCell, upstreamPair.neighborSourceCell);
  assert.equal(inlet.receiverCell, upstreamPair.neighborReceiverCell);
  assert.equal(reverse.neighborSourceCell, upstreamPair.sourceCell);
  assert.equal(reverse.neighborReceiverCell, upstreamPair.receiverCell);
  const ids = new Set(neighborGraph.nodes.map(n => n.nodeId));
  assert.equal(ids.size, neighborGraph.nodes.length, "duplicate neighbor node");
  const incoming = new Map([...ids].map(id => [id, []])), outgoing = new Map([...ids].map(id => [id, []]));
  for (const edge of neighborGraph.edges) {
    assert(ids.has(edge.source) && ids.has(edge.target), "neighbor edge references missing node");
    incoming.get(edge.target).push(edge.source); outgoing.get(edge.source).push(edge.target);
  }
  assert([...incoming.values(), ...outgoing.values()].every(a => a.length <= 1), "neighbor is not a single channel");
  const chain = [], seen = new Set(); let cursor = inlet.nodeId;
  while (cursor !== undefined) {
    assert(!seen.has(cursor), "neighbor channel cycle"); seen.add(cursor); chain.push(cursor); cursor = outgoing.get(cursor)?.[0];
  }
  assert(chain.length === ids.size && chain.at(-1) === outlet.nodeId && incoming.get(inlet.nodeId)?.length === 0,
    "neighbor has a disconnected or incorrectly directed channel");

  const identity = hash({ algorithm: "measured_east_west_north_joint_corridor_proposal_v1",
    upstreamProjection: upstreamProjection.projectionSha256, neighborGraph, nextPairing, naturalnessProfileBinding });
  let state = parseInt(identity.slice(0, 8), 16);
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const upstream = upstreamProjection.edges[0], end = { x: width / 2, y: 0 };
  const start = { x: 0, y: upstream.centerline.at(-1).y };
  const last = upstream.centerline.at(-1), previous = upstream.centerline.at(-2);
  const length = Math.hypot(last.x - previous.x, last.y - previous.y);
  const tangent = { x: (last.x - previous.x) / length, y: (last.y - previous.y) / length };
  assert(tangent.x > 0 && Number.isFinite(tangent.y), "upstream channel has invalid exit tangent");
  const halfWidths = buildNaturalWaterHalfWidths(NATURAL_WATER_CENTERLINE_POINT_COUNT, random,
    { startHalfWidth: upstream.halfWidths.at(-1), endHalfWidth: upstream.halfWidths.at(-1) });
  const direction = { x: end.x - start.x, y: end.y - start.y }, attempts = [], passing = [];
  // These are bounded anonymous game-space design controls, not source
  // coordinates or acceptance thresholds. All candidates use unchanged audits.
  for (const handle of [100, 150, 200, 250, 300, 350, 400])
    for (const xFraction of [0.5, 0.6, 0.7, 0.8, 0.9]) for (const yFraction of [0.25, 0.375, 0.5, 0.625, 0.75]) {
      const a = { x: start.x + tangent.x * handle, y: start.y + tangent.y * handle };
      const b = { x: width * xFraction, y: height * yFraction };
      const points = Array.from({ length: NATURAL_WATER_CENTERLINE_POINT_COUNT }, (_, i) => {
        const t = i / (NATURAL_WATER_CENTERLINE_POINT_COUNT - 1), u = 1 - t;
        return { x: u ** 3 * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x,
          y: u ** 3 * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y };
      });
      const naturalness = auditAnonymousWaterNaturalness(points, naturalnessProfile);
      const corridor = auditAnonymousWaterCorridorShape(points, halfWidths, { downstreamDirection: direction });
      const join = [previous, last, { x: width + points[1].x, y: points[1].y }];
      const joinTurnDegrees = auditAnonymousWaterNaturalness(join, naturalnessProfile).maximumInteriorTurnDegrees;
      const joinCorridor = auditAnonymousWaterCorridorShape(join,
        [upstream.halfWidths.at(-2), upstream.halfWidths.at(-1), halfWidths[1]], { downstreamDirection: tangent });
      const interior = points.slice(1, -1).every(p => p.x > 0 && p.x < width && p.y > 0 && p.y < height);
      const accepted = naturalness.passed && corridor.passed && joinCorridor.passed && interior &&
        joinTurnDegrees <= naturalnessProfile.anonymousGenerationEnvelope.maximumInteriorTurnDegrees;
      attempts.push({ handle, xFraction, yFraction, accepted, naturalnessFailures: naturalness.failures,
        corridorFailures: corridor.failures, joinCorridorFailures: joinCorridor.failures, interior, joinTurnDegrees });
      if (accepted) passing.push({ points, naturalness, corridor, joinCorridor, joinTurnDegrees, handle, xFraction, yFraction });
    }
  passing.sort((a, b) => Math.abs(a.naturalness.sinuosity - naturalnessProfile.anonymousGenerationEnvelope.targetSinuosity) -
    Math.abs(b.naturalness.sinuosity - naturalnessProfile.anonymousGenerationEnvelope.targetSinuosity));
  assert(passing.length > 0, "neighbor continuation fails unchanged naturalness/corridor requirements");
  let selected;
  for (const candidate of passing) {
    const points = [...upstream.centerline, ...candidate.points.slice(1).map(p => ({ x: width + p.x, y: p.y }))];
    const widths = [...upstream.halfWidths, ...halfWidths.slice(1)];
    const polygons = buildVariableWidthCorridorPolygons(points, widths, width * 2, height);
    const shore = buildVariableWidthCorridorPolygons(points, widths.map(w => w + 14), width * 2, height);
    const split = values => ({ left: clipAtSharedEdge(values, width, false), right: clipAtSharedEdge(values, width, true) });
    const water = split(polygons), shoreline = split(shore);
    const left = { canvas: { width, height }, waterPolygons: water.left, shorelinePolygons: shoreline.left };
    const right = { canvas: { width, height }, waterPolygons: water.right, shorelinePolygons: shoreline.right };
    try { selected = { ...candidate, left, right, seam: auditProjectedNeighborWaterSeam(left, right) }; break; }
    catch (error) { candidate.geometryFailure = error.message; }
  }
  assert(selected, "joint water surface fails actual paired boundary geometry");
  const payload = { schemaVersion: "measured-neighbor-joint-water-proposal-v1",
    status: "paired_water_geometry_verified_complete_regions_pending", inputIdentity: identity,
    upstreamProjectionSha256: upstreamProjection.projectionSha256, naturalnessProfileBinding,
    sourceGraphIdentity: hash(sourceGraph), neighborGraphIdentity: hash(neighborGraph), nextPairingIdentity: hash(nextPairing),
    sourceCandidateId: upstreamProjection.candidateId, neighborCandidateId: neighborId,
    downstreamCandidateId: nextPairing.pairs.find(p => p.sourcePortId === outlet.nodeId).neighborCandidateId,
    sourceNodeChain: upstream.sourceNodeChain, neighborNodeChain: chain,
    upstream: { ...selected.left, centerline: upstream.centerline, halfWidths: upstream.halfWidths },
    neighbor: { ...selected.right, centerline: selected.points, halfWidths },
    audit: { naturalness: selected.naturalness, corridor: selected.corridor, joinCorridor: selected.joinCorridor,
      joinTurnDegrees: selected.joinTurnDegrees, seam: selected.seam,
      attempts, evaluatedAttemptCount: attempts.length, centerlinePassingCount: passing.length,
      selectedControls: { handle: selected.handle, xFraction: selected.xFraction, yFraction: selected.yFraction },
      geometryRejectedControls: passing.filter(p => p.geometryFailure).map(p => ({ handle: p.handle,
        xFraction: p.xFraction, yFraction: p.yFraction, error: p.geometryFailure })) },
    outputBoundary: { upstreamUnpublishedSurfaceChanged: true, previousCompleteGeometryMustBeReaudited: true,
      sourceCoordinatesUsedAsGamePositions: false, sourceContextSplitQualified: false, fullNeighborGeometryCreated: false,
      downstreamNeighborGeometryVerified: false, worldFactsQualified: false, regionGraphPublished: false,
      conditionPackCreated: false, rgbCreated: false, datasetModified: false, trainingAllowed: false } };
  return { ...payload, projectionSha256: hash(payload) };
}

// Clip a shared polygon, rather than independently clamping its vertices in
// each tile. Both sides retain the identical geometric intersection on the seam.
function clipAtSharedEdge(polygons, boundary, right) {
  return polygons.map(polygon => {
    const output = [], inside = p => right ? p.x >= boundary : p.x <= boundary;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      if (inside(a)) output.push(a);
      if (inside(a) !== inside(b)) output.push({ x: boundary, y: a.y + (b.y - a.y) * (boundary - a.x) / (b.x - a.x) });
    }
    return output.map(p => ({ x: p.x - (right ? boundary : 0), y: p.y }));
  }).filter(p => p.length >= 3 && Math.abs(p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length]; return sum + a.x * b.y - b.x * a.y;
  }, 0)) > 1e-9);
}

function boundaryIntervals(polygons, canvas, allowedSides, maximumPolygonVertices = 64) {
  assert(Array.isArray(polygons) && polygons.length > 0 && polygons.length <= 1024, "invalid paired surface polygon count");
  const intervals = { west: [], east: [], north: [], south: [] };
  const onSide = (p, side) => ({ west: p.x === 0, east: p.x === canvas.width, north: p.y === 0, south: p.y === canvas.height })[side];
  for (const polygon of polygons) {
    assert(polygon.length >= 3 && polygon.length <= maximumPolygonVertices && polygon.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= canvas.width && p.y >= 0 && p.y <= canvas.height), "invalid paired surface polygon");
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length]; area += a.x * b.y - b.x * a.y;
      for (const side of Object.keys(intervals)) {
        assert(allowedSides.includes(side) || !onSide(a, side), `paired surface touches uncontracted boundary:${side}`);
        if (onSide(a, side) && onSide(b, side)) {
          const values = [a[side === "west" || side === "east" ? "y" : "x"], b[side === "west" || side === "east" ? "y" : "x"]].sort((x, y) => x - y);
          if (values[1] > values[0]) intervals[side].push(values);
        }
      }
    }
    assert(Math.abs(area) > 1e-9, "paired surface has zero area");
  }
  for (const side of Object.keys(intervals)) {
    const merged = [];
    for (const entry of intervals[side].sort((a, b) => a[0] - b[0])) {
      if (merged.length && entry[0] <= merged.at(-1)[1] + 1e-7) merged.at(-1)[1] = Math.max(merged.at(-1)[1], entry[1]);
      else merged.push([...entry]);
    }
    intervals[side] = merged;
    assert(!allowedSides.includes(side) || merged.length === 1, `paired surface missing or discontinuous boundary:${side}`);
  }
  return intervals;
}

export function auditProjectedNeighborWaterSeam(upstream, neighbor) {
  assert.deepEqual(upstream.canvas, neighbor.canvas, "paired native canvases differ");
  const { width, height } = upstream.canvas;
  assert(Number.isInteger(width) && Number.isInteger(height) && width >= 32 && height >= 32 && width <= 1024 && height <= 768,
    "invalid paired native dimensions");
  const layers = {}, masks = {};
  for (const [name, key] of [["water", "waterPolygons"], ["shoreline", "shorelinePolygons"]]) {
    const a = boundaryIntervals(upstream[key], upstream.canvas, ["east"]);
    const b = boundaryIntervals(neighbor[key], neighbor.canvas, ["west", "north"]);
    assert(a.east[0].every((v, i) => Math.abs(v - b.west[0][i]) <= 1e-7), `${name} paired boundary intervals differ`);
    const left = rasterizePolygons(upstream[key].map(polygon => ({ polygon })), width, height);
    const right = rasterizePolygons(neighbor[key].map(polygon => ({ polygon })), width, height);
    const leftStats = nativeMaskStats(left, width, height), rightStats = nativeMaskStats(right, width, height);
    assert(leftStats.componentCount === 1 && rightStats.componentCount === 1, `${name} surface has disconnected native components`);
    for (const [stats, allowed] of [[leftStats, ["east"]], [rightStats, ["west", "north"]]])
      for (const [side, count] of Object.entries(stats.edges)) assert(allowed.includes(side) ? count > 0 : count === 0,
        `${name} native boundary differs:${side}`);
    let sharedEdgePixelPairs = 0, neighboringColumnDifferences = 0;
    for (let y = 0; y < height; y++) {
      const x = left[y * width + width - 1] > 0, z = right[y * width] > 0;
      sharedEdgePixelPairs += Number(x && z); neighboringColumnDifferences += Number(x !== z);
    }
    assert(sharedEdgePixelPairs > 0, `${name} lacks a four-connected native seam`);
    // Adjacent pixel centers lie one pixel apart: sloped banks may legitimately
    // produce different edge-column counts. The geometric seam must be equal.
    masks[name] = { left, right };
    layers[name] = { geometricBoundaryInterval: a.east[0], downstreamBoundaryInterval: b.north[0],
      left: leftStats, right: rightStats, sharedEdgePixelPairs, neighboringColumnDifferences,
      combinedNativeComponentCount: 1, leftRasterSha256: hashBytes(left), rightRasterSha256: hashBytes(right) };
  }
  for (const side of ["left", "right"]) assert(masks.water[side].every((v, i) => !v || masks.shoreline[side][i]),
    "shoreline corridor does not contain the native water surface");
  return { schemaVersion: "paired-water-native-seam-audit-v1", passed: true, layers,
    componentConnectivity: 4, samplingRule: "existing_condition_compiler_pixel_center_even_odd_v1",
    limitation: "local_water_pair_only_not_complete_neighbor_or_world_hydrology_qualification",
    worldGraphConnected: false, trainingAllowed: false };
}

const hashBytes = bytes => createHash("sha256").update(bytes).digest("hex");

export function auditJointWaterAgainstUpstreamGeometry(proposal, joint, upstreamProjection) {
  const { projectionSha256, ...payload } = joint;
  assert.equal(hash(payload), projectionSha256, "joint projection identity mismatch");
  assert.equal(joint.schemaVersion, "measured-neighbor-joint-water-proposal-v1");
  assert.equal(joint.upstreamProjectionSha256, upstreamProjection.projectionSha256, "joint upstream binding differs");
  assert.equal(hash(Object.fromEntries(Object.entries(upstreamProjection).filter(([k]) => k !== "projectionSha256"))),
    upstreamProjection.projectionSha256, "upstream projection identity mismatch");
  assert.equal(proposal.schemaVersion, "ai-painter-replacement-geometry-proposal-v1");
  assert.equal(proposal.status, "complete_geometry_proposed_not_pre_rgb_qualified");
  for (const key of ["conditionPackCreated", "imageGenerationStarted", "rgbCreated", "gpuTrainingStarted",
    "trainingAllowed", "runtimeFrameEligible", "canEnterWorld"]) assert.equal(proposal.outputBoundary?.[key], false);
  const g = proposal.geometry, canvas = g.worldFrameContract.frameCoverage;
  assert.deepEqual({ width: canvas.width, height: canvas.height }, joint.upstream.canvas, "upstream native canvas differs");
  assert(canvas.width === 1024 && canvas.height === 768, "joint upstream audit requires native dimensions");
  extractHistoricalGeometry({ schemaVersion: "ai-assisted-training-world-fact-blueprint-v2", canvas, geometry: g });
  assert.deepEqual(g.waterCenterline, upstreamProjection.edges[0].centerline);
  assert.deepEqual(g.terrainRegions.filter(r => r.kind === "water").map(r => r.polygon), upstreamProjection.waterPolygons);
  assert.deepEqual(g.terrainRegions.filter(r => r.kind === "shoreline").map(r => r.polygon), upstreamProjection.shorelinePolygons);
  assert.deepEqual(auditProjectedNeighborWaterSeam(joint.upstream, joint.neighbor), joint.audit.seam);
  const { width, height } = canvas, raster = polygons => rasterizePolygons(polygons.map(polygon => ({ polygon })), width, height);
  const before = raster(upstreamProjection.waterPolygons), water = raster(joint.upstream.waterPolygons);
  const shore = raster(joint.upstream.shorelinePolygons), path = rasterizePolygons(g.terrainRegions.filter(r => r.kind === "path_ground"), width, height);
  const collision = rasterizePolygons(g.collisionRegions, width, height), walkable = rasterizePolygons(g.walkableRegions, width, height);
  const blockingObjects = rasterizeFootprints(g.objectFootprints.filter(o => o.blocksMovement), width, height);
  const overlap = (a, b) => a.reduce((n, v, i) => n + Number(v > 0 && b[i] > 0), 0);
  const pathStats = nativeMaskStats(path, width, height);
  const overlaps = { pathWater: overlap(path, water), pathShorelineCorridor: overlap(path, shore),
    pathCollision: overlap(path, collision), pathBlockingObjects: overlap(path, blockingObjects), pathWalkable: overlap(path, walkable) };
  const issues = [];
  if (overlaps.pathWater) issues.push("route_overlaps_joint_water");
  if (overlaps.pathCollision || overlaps.pathBlockingObjects) issues.push("route_overlaps_blocking_geometry");
  if (pathStats.componentCount !== 1 || pathStats.pixels === 0) issues.push("route_not_single_connected_component");
  if (overlaps.pathWalkable !== pathStats.pixels) issues.push("route_not_fully_walkable");
  // Shoreline overlap is recorded, not turned into a new acceptance threshold.
  return { schemaVersion: "joint-water-upstream-spatial-impact-audit-v1", passed: issues.length === 0, issues,
    pathStats, overlaps, changedWaterPixels: water.reduce((n, v, i) => n + Number(v !== before[i]), 0),
    waterRasterSha256: hashBytes(water), shorelineRasterSha256: hashBytes(shore),
    reusedPathRasterSha256: hashBytes(path), geometryMutated: false,
    outputBoundary: { completeGeometryRebound: false, fullNeighborGeometryCreated: false, allHistoryNoveltyQualified: false,
      formalConditionPackCreated: false, worldFactsQualified: false, trainingAllowed: false } };
}

function nativeMaskStats(mask, width, height) {
  let pixels = 0, minX = width, minY = height, maxX = -1, maxY = -1, componentCount = 0;
  const edges = { north: 0, east: 0, south: 0, west: 0 }, seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    pixels++; const x = i % width, y = Math.floor(i / width);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (x === 0) edges.west++; if (x === width - 1) edges.east++;
    if (y === 0) edges.north++; if (y === height - 1) edges.south++;
    if (seen[i]) continue;
    componentCount++; let head = 0, tail = 1; queue[0] = i; seen[i] = 1;
    while (head < tail) {
      const j = queue[head++], xx = j % width;
      for (const k of [xx ? j - 1 : -1, xx < width - 1 ? j + 1 : -1, j >= width ? j - width : -1, j + width < mask.length ? j + width : -1]) {
        if (k >= 0 && mask[k] && !seen[k]) { seen[k] = 1; queue[tail++] = k; }
      }
    }
  }
  return { pixels, ratio: pixels / mask.length, componentCount, edges,
    maximumNormalizedSpan: pixels ? Math.max((maxX - minX + 1) / width, (maxY - minY + 1) / height) : 0 };
}

export function auditProjectedWaterBoundary(polygons, canvas, outletSide) {
  assert(Array.isArray(polygons) && polygons.length > 0 && ["north", "south", "east", "west"].includes(outletSide),
    "missing projected water surface or outlet side");
  assert(Number.isFinite(canvas.width) && Number.isFinite(canvas.height) && canvas.width > 0 && canvas.height > 0,
    "invalid surface canvas");
  const contacts = { north: [], south: [], west: [], east: [] };
  for (const polygon of polygons) {
    assert(Array.isArray(polygon) && polygon.length >= 3, "invalid water surface polygon");
    let twiceArea = 0;
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      assert(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= canvas.width &&
        p.y >= 0 && p.y <= canvas.height, "water surface escapes its canvas");
      twiceArea += p.x * q.y - q.x * p.y;
      if (p.x === 0) contacts.west.push(p.y);
      if (p.x === canvas.width) contacts.east.push(p.y);
      if (p.y === 0) contacts.north.push(p.x);
      if (p.y === canvas.height) contacts.south.push(p.x);
    }
    assert(Number.isFinite(twiceArea) && Math.abs(twiceArea) > 0, "water surface polygon has zero area");
  }
  for (const [side, points] of Object.entries(contacts))
    assert(side === outletSide || points.length === 0, `water surface touches uncontracted boundary:${side}`);
  const values = contacts[outletSide];
  assert(values.length >= 2, "water surface does not reach the outlet boundary");
  const start = Math.min(...values), end = Math.max(...values);
  assert(end > start, "water surface has no positive boundary span");
  return { passed: true, outletSide, boundarySpan: { start, end },
    polygonCount: polygons.length, onlyContractedBoundaryTouched: true };
}

// A deliberately scoped, unpublished projection: one measured supported chain
// with an internal onset and one external outlet. Unsupported networks are not
// converted to this shape. It creates neither a path connection nor WorldFacts.
export function projectMeasuredSingleChannel({ sourceGraph, neighborPairing, candidateId,
  naturalnessProfile, naturalnessProfileBinding, width = 1024, height = 768 }) {
  assert(sourceGraph.schemaVersion === "measured-window-hydrology-support-graph-v1", "unsupported source graph");
  assert.equal(sourceGraph.gaps.length, 0, "source hydrology graph has unresolved gaps");
  assert(sourceGraph.nodes.length > 1 && sourceGraph.nodes.every(n => n.upstreamExcludedCellCount === 0),
    "source hydrology intersects upstream exclusion mask");
  assert(sourceGraph.ports.length === 1 && sourceGraph.ports[0].role === "outlet" &&
    !sourceGraph.ports[0].cornerAmbiguous, "projection supports only a single outlet without external inlets");
  assert(Number.isInteger(width) && Number.isInteger(height) && width >= 256 && height >= 192 &&
    width <= 1024 && height <= 768, "invalid projection dimensions");
  const ids = new Set(sourceGraph.nodes.map(n => n.nodeId));
  assert.equal(ids.size, sourceGraph.nodes.length, "duplicate source node");
  const incoming = new Map([...ids].map(id => [id, []])), outgoing = new Map([...ids].map(id => [id, []]));
  for (const edge of sourceGraph.edges) {
    assert(ids.has(edge.source) && ids.has(edge.target), "source edge references missing node");
    incoming.get(edge.target).push(edge.source); outgoing.get(edge.source).push(edge.target);
  }
  assert([...incoming.values(), ...outgoing.values()].every(a => a.length <= 1), "source graph is not a single channel");
  const roots = [...ids].filter(id => incoming.get(id).length === 0);
  assert.equal(roots.length, 1, "source graph has multiple or missing onsets");
  const chain = [], visited = new Set(); let node = roots[0];
  while (node !== undefined) {
    assert(!visited.has(node), "source graph cycle"); visited.add(node); chain.push(node); node = outgoing.get(node)[0];
  }
  assert.equal(chain.length, ids.size, "source graph contains a disconnected component");
  const sourcePort = sourceGraph.ports[0];
  assert(chain.at(-1) === sourcePort.nodeId && !sourceGraph.ports.some(p => p.nodeId === chain[0]),
    "source onset/outlet relationship is invalid");
  assert.equal(neighborPairing.gaps.length, 0, "source neighbor pairing has unresolved gaps");
  assert.equal(neighborPairing.pairs.length, 1, "source outlet needs exactly one measured neighbor");
  const pair = neighborPairing.pairs[0];
  const opposite = { east: "west", west: "east", north: "south", south: "north" };
  const side = sourcePort.boundarySides[0];
  assert(pair.sourceCandidateId === candidateId && pair.neighborCandidateId !== candidateId &&
    pair.sourcePortId === sourcePort.nodeId && pair.sourceSide === side && pair.neighborSide === opposite[side] &&
    pair.sourceRole === "outlet" && pair.neighborRole === "inlet", "source neighbor roles are inconsistent");
  assert.deepEqual(pair.sourceIntersection, pair.neighborIntersection, "source neighbor intersections differ");
  assert(naturalnessProfileBinding && typeof naturalnessProfileBinding.path === "string" &&
    /^[a-f0-9]{64}$/.test(naturalnessProfileBinding.sha256), "naturalness profile binding required");
  const sourceIdentity = hash({ candidateId, sourceGraph, neighborPairing, naturalnessProfileBinding,
    algorithm: "single_supported_chain_flow_relative_anonymous_projection_v1", width, height });
  let randomState = parseInt(sourceIdentity.slice(0, 8), 16);
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296; };
  const directions = { east: { x: 1, y: 0 }, west: { x: -1, y: 0 }, north: { x: 0, y: -1 }, south: { x: 0, y: 1 } };
  const direction = directions[side]; assert(direction, "invalid source outlet side");
  // Only topology and boundary side carry through. The design length and
  // boundary midpoint are game units, not a transform of source coordinates.
  const end = { x: side === "east" ? width : side === "west" ? 0 : width / 2,
    y: side === "south" ? height : side === "north" ? 0 : height / 2 };
  const chordLength = (direction.x ? width : height) * 0.55;
  const start = { x: end.x - direction.x * chordLength, y: end.y - direction.y * chordLength };
  const gameDesignParameters = { boundaryFraction: 0.5, normalizedChordLength: 0.55,
    startHalfWidth: 34, endHalfWidth: 42, widthUnit: "game_pixels_not_measured_channel_width" };
  const halfWidths = buildNaturalWaterHalfWidths(NATURAL_WATER_CENTERLINE_POINT_COUNT, random, gameDesignParameters);
  const curve = buildNaturalAnonymousWaterCenterline({ start, end, random, width, height, profile: naturalnessProfile,
    corridorHalfWidths: halfWidths, downstreamDirection: direction, broadRiverMode: true, flowRelativeControls: true });
  const corridorAudit = auditAnonymousWaterCorridorShape(curve.points, halfWidths, { downstreamDirection: direction });
  assert(curve.audit.passed && corridorAudit.passed, "projected channel failed unchanged shape requirements");
  assert(curve.points.slice(0, -1).every(p => p.x > 0 && p.x < width && p.y > 0 && p.y < height),
    "projected centerline touches an uncontracted boundary");
  const waterPolygons = buildVariableWidthCorridorPolygons(curve.points, halfWidths, width, height);
  const shorelinePolygons = buildVariableWidthCorridorPolygons(curve.points, halfWidths.map(w => w + 14), width, height);
  const waterBoundary = auditProjectedWaterBoundary(waterPolygons, { width, height }, side);
  const shorelineBoundary = auditProjectedWaterBoundary(shorelinePolygons, { width, height }, side);
  assert(shorelineBoundary.boundarySpan.start <= waterBoundary.boundarySpan.start &&
    shorelineBoundary.boundarySpan.end >= waterBoundary.boundarySpan.end, "shoreline does not cover the water boundary");
  const regionId = `training-hydrology-proposal:${sourceIdentity}:${candidateId}`;
  const neighborId = `training-hydrology-proposal:${sourceIdentity}:${pair.neighborCandidateId}`;
  const outletId = `${regionId}:outlet`, inletId = `${neighborId}:inlet`, onsetId = `${regionId}:internal-onset`;
  const neighborPosition = { x: side === "east" ? 0 : side === "west" ? width : end.x,
    y: side === "south" ? 0 : side === "north" ? height : end.y };
  const payload = { schemaVersion: "measured-single-channel-game-projection-proposal-v2",
    status: "unpublished_hydrology_projection_no_region_or_condition_qualification", candidateId,
    sourceIdentity, naturalnessProfileBinding, sourceGraphIdentity: hash(sourceGraph), sourcePairingIdentity: hash(neighborPairing),
    canvas: { width, height }, gameDesignParameters, regionId, neighborId,
    nodes: [{ nodeId: onsetId, kind: "internal_supported_channel_onset", position: start },
      { nodeId: outletId, kind: "outlet", boundarySide: side, position: end,
        waterBoundarySpan: waterBoundary.boundarySpan, shorelineBoundarySpan: shorelineBoundary.boundarySpan },
      { nodeId: inletId, kind: "neighbor_inlet", boundarySide: opposite[side], position: neighborPosition,
        waterBoundarySpan: waterBoundary.boundarySpan, shorelineBoundarySpan: shorelineBoundary.boundarySpan }],
    edges: [{ source: onsetId, target: outletId, sourceNodeChain: chain, centerline: curve.points, halfWidths },
      { source: outletId, target: inletId, kind: "paired_boundary", sourcePair: pair.sourcePortId }],
    waterPolygons, shorelinePolygons,
    audit: { sourceChainNodeCount: chain.length, sourceBranchCount: 0, projectedBranchCount: 0,
      naturalness: curve.audit, corridor: corridorAudit, centerlineBoundaryContactsVerified: true,
      waterBoundary, shorelineBoundary, shorelineBoundaryContactsVerified: true, pathConnectivityEstablished: false },
    outputBoundary: { exactRealWorldGeometryCarriedForward: false, sourceCoordinatesUsedAsGamePositions: false,
      worldFactsQualified: false, regionGraphPublished: false, conditionPackCreated: false,
      rgbCreated: false, trainingAllowed: false, canEnterWorld: false } };
  return { ...payload, projectionSha256: hash(payload) };
}

export function bindProjectedWaterConnectivity(connectivity, projection) {
  const { projectionSha256, ...payload } = projection;
  assert.equal(hash(payload), projectionSha256, "water projection identity mismatch");
  assert(projection.schemaVersion === "measured-single-channel-game-projection-proposal-v2" &&
    projection.outputBoundary.worldFactsQualified === false && projection.outputBoundary.trainingAllowed === false,
    "water projection is not an unpublished candidate");
  const result = structuredClone(connectivity), regionId = result.currentRegion.regionId;
  assert(/^training-world:thailand-mvp:replacement-[a-f0-9]{64}$/.test(regionId), "measured connectivity requires isolated region identity");
  const neighborId = projection.neighborId, outletId = `${regionId}:water-outlet`, inletId = `${neighborId}:water-inlet`;
  const outlet = projection.nodes.find(n => n.kind === "outlet"), inlet = projection.nodes.find(n => n.kind === "neighbor_inlet");
  assert(outlet && inlet, "projected outlet pair missing");
  result.schemaVersion = "regional-connectivity-proposal-v2";
  result.status = "unpublished_measured_hydrology_local_and_neighbor_path_pending";
  // Retain the existing path proposal, but do not retain its claimed world
  // connectivity or any fabricated north/south water ports.
  result.edgePorts = result.edgePorts.filter(p => p.kind !== "water");
  result.edgePorts.push({ edgePortId: outletId, regionId, kind: "water", boundarySide: outlet.boundarySide,
    boundaryPosition: outlet.position, waterBoundarySpan: outlet.waterBoundarySpan,
    shorelineBoundarySpan: outlet.shorelineBoundarySpan, flowRole: "outlet", role: "measured_water_projection_outlet",
    connectsToRegionId: neighborId, connectsToEdgePortId: inletId },
  { edgePortId: inletId, regionId: neighborId, kind: "water", boundarySide: inlet.boundarySide,
    boundaryPosition: inlet.position, waterBoundarySpan: inlet.waterBoundarySpan,
    shorelineBoundarySpan: inlet.shorelineBoundarySpan, flowRole: "inlet", role: "measured_neighbor_water_projection_inlet",
    connectsToRegionId: regionId, connectsToEdgePortId: outletId });
  result.currentRegion.neighborRegionIds = [...new Set(result.edgePorts.filter(p => p.regionId === regionId).map(p => p.connectsToRegionId))];
  result.hydrologyGraph = { hydrologyGraphId: `${regionId}:measured-hydrology-proposal`,
    mode: "internal_supported_channel_to_measured_outlet", externalWaterPortIds: [outletId],
    upstreamPortId: null, downstreamPortId: outletId, internalOnsetId: `${regionId}:internal-water-onset`,
    flowAxis: projection.audit.corridor.downstreamDirection, sourceGraphIdentity: projection.sourceGraphIdentity,
    projectionSha256, directedEdges: [{ source: `${regionId}:internal-water-onset`, target: outletId },
      { source: outletId, target: inletId }], worldFactWaterRequired: true, worldFactsQualified: false };
  result.walkableGraph = { ...result.walkableGraph, connected: false, verificationStatus: "path_connectivity_not_yet_verified" };
  const plan = result.anonymousTrainingCoordinateProjection;
  const pathPorts = result.edgePorts.filter(p => p.kind === "path" && p.regionId === regionId);
  assert.equal(pathPorts.length, 1, "projection requires one existing path boundary proposal");
  const pathPort = pathPorts[0];
  if (pathPort.boundarySide === outlet.boundarySide) {
    // Both plans are still unpublished. Jointly place the path entrance in a
    // dry interval on its existing side instead of attempting routes to an
    // endpoint inside the water. 42 is the existing 84-pixel entrance half-span.
    const extent = ["east", "west"].includes(outlet.boundarySide) ? projection.canvas.height : projection.canvas.width;
    const halfEntrance = 42, span = outlet.shorelineBoundarySpan;
    const free = [[halfEntrance, span.start - halfEntrance], [span.end + halfEntrance, extent - halfEntrance]]
      .filter(([a, b]) => b > a).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]) || a[0] - b[0]);
    assert(free.length > 0, "no dry boundary interval for existing path entrance");
    const position = Math.round((free[0][0] + free[0][1]) / 2);
    const oldPosition = structuredClone(pathPort.boundaryPosition);
    const point = { ...outlet.position, ...(["east", "west"].includes(outlet.boundarySide) ? { y: position } : { x: position }) };
    pathPort.boundaryPosition = point;
    plan.pathPlan = { ...plan.pathPlan, boundaryPosition: point, boundaryFraction: position / extent,
      jointWaterAvoidance: { method: "largest_dry_interval_on_existing_boundary_side_v1", previousPosition: oldPosition,
        entranceHalfSpanPixels: halfEntrance, waterAndShorelineExcludedSpan: span, selectedFreeInterval: free[0],
        worldFactsChanged: false, unpublishedProposalOnly: true } };
    for (const edge of result.pathGraph?.edges ?? []) if (edge.target === pathPort.edgePortId && edge.coordinates?.length)
      edge.coordinates[edge.coordinates.length - 1] = structuredClone(point);
  }
  plan.schemaVersion = "measured-hydrology-and-pending-path-coordinate-projection-v1";
  plan.waterPlan = { schemaVersion: "measured-single-channel-water-plan-v1", mode: result.hydrologyGraph.mode,
    projectionSha256, start: projection.nodes.find(n => n.kind === "internal_supported_channel_onset").position,
    end: outlet.position, externalWaterPorts: [{ edgePortId: outletId, boundarySide: outlet.boundarySide,
      boundaryPosition: outlet.position, flowRole: "downstream_outlet" }], boundaryWaterDirectionInvented: false };
  plan.fixedNorthSouthEastWaterPortsUsed = false;
  delete plan.projectionSha256;
  plan.projectionSha256 = hash(plan);
  result.identityBoundary.currentRegionWorldGraphConnected = false;
  delete result.connectivityInstanceSha256;
  result.connectivityInstanceSha256 = hash(result);
  return result;
}

// Prepare only the actual measured west-in/north-out neighbor. This is context
// for one unpublished replacement, not a second capacity or split assignment.
export function bindMeasuredNeighborConnectivity({ connectivity: input, upstream, joint }) {
  assert(auditMeasuredGeometrySpatial(upstream.proposal, upstream.connectivity, upstream.waterProjection).localSpatialPassed,
    "upstream complete geometry fails native audit");
  const { projectionSha256: jointSha, ...jointPayload } = joint;
  assert.equal(hash(jointPayload), jointSha, "joint projection identity mismatch");
  assert.equal(joint.schemaVersion, "measured-neighbor-joint-water-proposal-v1");
  assert.equal(upstream.waterProjection.jointProjectionSha256, jointSha, "upstream is not bound to this joint surface");
  assert.deepEqual(upstream.waterProjection.waterPolygons, joint.upstream.waterPolygons);
  assert.deepEqual(upstream.waterProjection.shorelinePolygons, joint.upstream.shorelinePolygons);
  const seam = auditProjectedNeighborWaterSeam(joint.upstream, joint.neighbor);
  const { connectivityInstanceSha256, ...inputPayload } = input;
  assert.equal(canonicalSha256(inputPayload), connectivityInstanceSha256, "neighbor input connectivity hash differs");
  const regionId = upstream.waterProjection.neighborId;
  assert.equal(input.currentRegion.regionId, regionId, "neighbor region identity differs");
  const upstreamRegionId = upstream.proposal.regionId, canvas = joint.neighbor.canvas;
  const upstreamPath = upstream.connectivity.edgePorts.filter(p => p.kind === "path" && p.regionId === upstreamRegionId);
  assert(upstreamPath.length === 1 && upstreamPath[0].boundarySide === "east", "neighbor requires actual east path proposal");
  const pathPort = input.edgePorts.find(p => p.kind === "path" && p.regionId === regionId);
  assert(pathPort?.boundarySide === "west", "neighbor path must face actual upstream region");
  const pathPosition = { x: 0, y: upstreamPath[0].boundaryPosition.y };
  const shore = seam.layers.shoreline.geometricBoundaryInterval;
  assert(pathPosition.y >= 42 && pathPosition.y <= canvas.height - 42 &&
    (pathPosition.y + 42 < shore[0] || pathPosition.y - 42 > shore[1]), "paired path entrance intersects shoreline");
  const upstreamWater = upstream.connectivity.edgePorts.find(p => p.kind === "water" && p.regionId === upstreamRegionId);
  assert(upstreamWater?.connectsToRegionId === regionId && upstreamWater.boundarySide === "east", "upstream water neighbor differs");
  const inletId = upstreamWater.connectsToEdgePortId, outletId = `${regionId}:water-outlet`;
  const downstreamId = `training-hydrology-proposal:${joint.nextPairingIdentity}:${joint.downstreamCandidateId}`;
  const downstreamPortId = `${downstreamId}:water-inlet`;
  const span = values => ({ start: values[0], end: values[1] });
  const localPorts = [
    { edgePortId: inletId, regionId, kind: "water", boundarySide: "west", boundaryPosition: structuredClone(joint.neighbor.centerline[0]),
      flowRole: "inlet", waterBoundarySpan: span(seam.layers.water.geometricBoundaryInterval),
      shorelineBoundarySpan: span(shore), connectsToRegionId: upstreamRegionId, connectsToEdgePortId: upstreamWater.edgePortId },
    { edgePortId: outletId, regionId, kind: "water", boundarySide: "north", boundaryPosition: structuredClone(joint.neighbor.centerline.at(-1)),
      flowRole: "outlet", waterBoundarySpan: span(seam.layers.water.downstreamBoundaryInterval),
      shorelineBoundarySpan: span(seam.layers.shoreline.downstreamBoundaryInterval),
      connectsToRegionId: downstreamId, connectsToEdgePortId: downstreamPortId, state: "blocked_pending_actual_neighbor_geometry" },
  ];
  const projection = { schemaVersion: "measured-joint-through-channel-projection-proposal-v1",
    status: "unpublished_neighbor_context_not_a_training_sample", candidateId: joint.neighborCandidateId, regionId,
    canvas, sourceGraphIdentity: joint.neighborGraphIdentity, sourcePairingIdentity: joint.nextPairingIdentity,
    jointProjectionSha256: jointSha, naturalnessProfileBinding: joint.naturalnessProfileBinding,
    sourceNodeChain: joint.neighborNodeChain, nodes: localPorts,
    edges: [{ source: inletId, target: outletId, centerline: joint.neighbor.centerline,
      halfWidths: joint.neighbor.halfWidths, sourceNodeChain: joint.neighborNodeChain }],
    waterPolygons: joint.neighbor.waterPolygons, shorelinePolygons: joint.neighbor.shorelinePolygons,
    audit: { naturalness: joint.audit.naturalness, corridor: joint.audit.corridor, nativeSeam: seam },
    outputBoundary: { worldFactsQualified: false, trainingAllowed: false, countsAsAdditionalSample: false,
      sourceContextSplitQualified: false, downstreamNeighborGeometryVerified: false } };
  projection.projectionSha256 = hash(projection);
  const c = structuredClone(input), plan = c.anonymousTrainingCoordinateProjection;
  const pairedPath = { ...structuredClone(upstreamPath[0]), connectsToRegionId: regionId, connectsToEdgePortId: pathPort.edgePortId };
  c.edgePorts = [{ ...structuredClone(pathPort), boundaryPosition: pathPosition,
    connectsToRegionId: upstreamRegionId, connectsToEdgePortId: pairedPath.edgePortId }, pairedPath,
    ...localPorts, structuredClone(upstreamWater), { edgePortId: downstreamPortId, regionId: downstreamId, kind: "water",
      boundarySide: "south", boundaryPosition: { x: localPorts[1].boundaryPosition.x, y: canvas.height }, flowRole: "inlet",
      waterBoundarySpan: structuredClone(localPorts[1].waterBoundarySpan), shorelineBoundarySpan: structuredClone(localPorts[1].shorelineBoundarySpan),
      connectsToRegionId: regionId, connectsToEdgePortId: outletId, state: "blocked_pending_actual_neighbor_geometry" }];
  c.schemaVersion = "regional-connectivity-proposal-v2";
  c.status = "unpublished_measured_neighbor_complete_geometry_pending";
  c.currentRegion.neighborRegionIds = [upstreamRegionId, downstreamId];
  // The inherited package covers the upstream window, not this neighbor. Keep
  // its regional reference identity only; the caller binds this window's facts.
  c.realEarthRegionSourcePackageId = null;
  c.sourceContext = { candidateId: joint.neighborCandidateId, role: "neighbor_geometry_context_not_capacity_sample",
    sourceGraphIdentity: joint.neighborGraphIdentity, jointProjectionSha256: jointSha };
  c.hydrologyGraph = { hydrologyGraphId: `${regionId}:measured-hydrology-proposal`,
    mode: "measured_external_inlet_to_external_outlet", externalWaterPortIds: [inletId, outletId],
    upstreamPortId: inletId, downstreamPortId: outletId, sourceGraphIdentity: projection.sourceGraphIdentity,
    projectionSha256: projection.projectionSha256, worldFactWaterRequired: true, worldFactsQualified: false,
    directedEdges: [{ source: upstreamWater.edgePortId, target: inletId }, { source: inletId, target: outletId },
      { source: outletId, target: downstreamPortId, state: "blocked_pending_actual_neighbor_geometry" }] };
  plan.pathPlan = { ...plan.pathPlan, boundaryPosition: pathPosition, boundaryFraction: pathPosition.y / canvas.height,
    pairedCurrentGeometry: { upstreamRegionId, upstreamGeometryRevisionIdentity: upstream.proposal.geometryRevisionIdentity,
      upstreamPathPortId: pairedPath.edgePortId, upstreamConnectivitySha256: upstream.connectivity.connectivityInstanceSha256,
      upstreamStubReplacementPending: true } };
  c.pathGraph.edges[0].coordinates[c.pathGraph.edges[0].coordinates.length - 1] = structuredClone(pathPosition);
  plan.waterPlan = { schemaVersion: "measured-through-channel-water-plan-v1", mode: c.hydrologyGraph.mode,
    projectionSha256: projection.projectionSha256, start: localPorts[0].boundaryPosition, end: localPorts[1].boundaryPosition,
    externalWaterPorts: localPorts.map(p => ({ edgePortId: p.edgePortId, boundarySide: p.boundarySide,
      boundaryPosition: p.boundaryPosition, flowRole: p.flowRole === "inlet" ? "upstream_inlet" : "downstream_outlet" })),
    boundaryWaterDirectionInvented: false };
  delete plan.projectionSha256; plan.projectionSha256 = hash(plan);
  c.walkableGraph.connected = false; c.identityBoundary.currentRegionWorldGraphConnected = false;
  delete c.connectivityInstanceSha256; c.connectivityInstanceSha256 = hash(c);
  return { connectivity: c, waterProjection: structuredClone(projection) };
}

export function auditMeasuredPathSeam(upstream, neighbor) {
  assert.equal(upstream.proposal.worldId, neighbor.proposal.worldId, "path pair belongs to different worlds");
  const a = upstream.proposal.geometry, b = neighbor.proposal.geometry;
  const width = a.worldFrameContract.frameCoverage.width, height = a.worldFrameContract.frameCoverage.height;
  assert(width === 1024 && height === 768 && b.worldFrameContract.frameCoverage.width === width &&
    b.worldFrameContract.frameCoverage.height === height, "path pair native canvases differ");
  const layers = [a, b].map(g => g.terrainRegions.filter(r => r.kind === "path_ground"));
  const spans = layers.map((rs, i) => boundaryIntervals(rs.map(r => r.polygon), { width, height }, [i ? "west" : "east"], 2048)[i ? "west" : "east"][0]);
  assert.deepEqual(spans[0], spans[1], "path paired geometric widths differ");
  const masks = layers.map(rs => rasterizePolygons(rs, width, height));
  const stats = masks.map(m => nativeMaskStats(m, width, height));
  assert(stats.every(s => s.componentCount === 1), "path pair has disconnected native regions");
  let sharedEdgePixelPairs = 0;
  for (let y = 0; y < height; y++) sharedEdgePixelPairs += Number(masks[0][y * width + width - 1] > 0 && masks[1][y * width] > 0);
  assert(sharedEdgePixelPairs > 0, "path pair has no native four-connected seam");
  const ports = [upstream, neighbor].map(v => v.connectivity.edgePorts.filter(p => p.kind === "path" && p.regionId === v.proposal.regionId));
  assert(ports.every(p => p.length === 1), "path pair requires one local port per region");
  const [x, y] = ports.map(p => p[0]);
  assert(x.boundarySide === "east" && y.boundarySide === "west" &&
    x.boundaryPosition.x === width && y.boundaryPosition.x === 0 && x.boundaryPosition.y === y.boundaryPosition.y,
    "path boundary points do not pair");
  assert(x.connectsToRegionId === y.regionId && y.connectsToRegionId === x.regionId &&
    x.connectsToEdgePortId === y.edgePortId && y.connectsToEdgePortId === x.edgePortId, "path pair retains a stub or nonreciprocal identity");
  for (const port of [x, y]) {
    assert.equal(port.width, spans[0][1] - spans[0][0], "declared path width differs from actual geometry");
    assert.deepEqual(port.pathBoundarySpan, { start: spans[0][0], end: spans[0][1] });
    assert.equal(port.direction, "bidirectional");
  }
  for (const v of [upstream, neighbor])
    assert(auditMeasuredGeometrySpatial(v.proposal, v.connectivity, v.waterProjection).localSpatialPassed,
      "paired complete geometry fails native spatial audit");
  return { schemaVersion: "measured-path-native-seam-audit-v1", passed: true, geometricBoundaryInterval: spans[0],
    sharedEdgePixelPairs, combinedPathComponentCount: 1, componentConnectivity: 4,
    nativePathHashes: masks.map(hashBytes), reciprocalPortIdentitiesVerified: true,
    scope: "two_region_path_geometry_only_not_elevation_or_global_connectivity_qualification", worldGraphConnected: false, trainingAllowed: false };
}

// Correct only the two existing ribbon end-cap vertices at each paired edge.
// The common width is the smaller supported end-cap half-span, not a relaxed
// review threshold. Centerlines, source facts, water and objects are unchanged.
export function resolveMeasuredNeighborPathPair({ upstream: inputUpstream, neighbor: inputNeighbor, programBindings, createdAtUtc }) {
  assert(programBindings?.length > 0 && programBindings.length <= 32 && new Set(programBindings.map(b => b.path)).size === programBindings.length &&
    programBindings.every(b => typeof b.path === "string" && /^[a-f0-9]{64}$/.test(b.sha256)), "path pair program bindings required");
  assert(new Date(createdAtUtc).toISOString() === createdAtUtc, "path pair UTC timestamp required");
  assert.equal(inputNeighbor.waterProjection.schemaVersion, "measured-joint-through-channel-projection-proposal-v1");
  assert.equal(inputUpstream.waterProjection.jointProjectionSha256, inputNeighbor.waterProjection.jointProjectionSha256);
  assert.equal(inputNeighbor.proposal.regionId, inputUpstream.waterProjection.neighborId);
  assert.equal(inputUpstream.proposal.worldId, inputNeighbor.proposal.worldId);
  for (const v of [inputUpstream, inputNeighbor]) {
    assert(!v.proposal.pathPairRevisionIdentity, "already rebound path pair requires a separate revision policy");
    assert(auditMeasuredGeometrySpatial(v.proposal, v.connectivity, v.waterProjection).localSpatialPassed);
  }
  const originals = [inputUpstream, inputNeighbor], caps = originals.map((v, i) => {
    const g = v.proposal.geometry, paths = g.terrainRegions.filter(r => r.kind === "path_ground"), n = g.pathCenterline.length;
    assert(paths.length === 1 && paths[0].polygon.length === n * 2, "unsupported path ribbon representation");
    const polygon = paths[0].polygon, endpoint = g.pathCenterline.at(-1), vertices = [polygon[n - 1], polygon[n]];
    assert(endpoint.x === (i ? 0 : 1024), "path does not end on its paired boundary");
    const bounds = g.entranceBounds;
    assert(bounds && vertices.every(p => p.x >= bounds.x && p.x <= bounds.x + bounds.width &&
      p.y >= bounds.y && p.y <= bounds.y + bounds.height), "path cap escapes its existing entrance");
    assert(vertices[0].y !== vertices[1].y && (vertices[0].y - endpoint.y) * (vertices[1].y - endpoint.y) < 0,
      "path end cap does not straddle the existing centerline");
    return { polygon, count: n, endpoint, halfWidth: Math.min(...vertices.map(p => Math.abs(p.y - endpoint.y))) };
  });
  assert.equal(caps[0].endpoint.y, caps[1].endpoint.y, "path endpoints are not aligned");
  const halfWidth = Math.min(...caps.map(c => c.halfWidth));
  assert(Number.isFinite(halfWidth) && halfWidth > 0, "no shared positive path width");
  const identityPayload = { schemaVersion: "measured-path-pair-revision-input-v1",
    upstreamProposalSha256: hash(inputUpstream.proposal), neighborProposalSha256: hash(inputNeighbor.proposal),
    upstreamConnectivitySha256: inputUpstream.connectivity.connectivityInstanceSha256,
    neighborConnectivitySha256: inputNeighbor.connectivity.connectivityInstanceSha256,
    jointWaterProjectionSha256: inputNeighbor.waterProjection.jointProjectionSha256, halfWidth, programBindings };
  const revisionId = hash(identityPayload), results = originals.map(v => ({ proposal: structuredClone(v.proposal),
    connectivity: structuredClone(v.connectivity), waterProjection: structuredClone(v.waterProjection) }));
  const localPorts = results.map(v => v.connectivity.edgePorts.find(p => p.kind === "path" && p.regionId === v.proposal.regionId));
  assert(localPorts.every(Boolean));
  for (let i = 0; i < 2; i++) {
    const port = localPorts[i], other = localPorts[1 - i];
    port.connectsToRegionId = other.regionId; port.connectsToEdgePortId = other.edgePortId;
    port.direction = "bidirectional"; port.width = halfWidth * 2;
    port.pathBoundarySpan = { start: caps[i].endpoint.y - halfWidth, end: caps[i].endpoint.y + halfWidth };
    port.state = "unpublished_local_spatial_pair"; port.pathPairRevisionIdentity = revisionId;
  }
  const changes = [];
  for (let i = 0; i < 2; i++) {
    const v = results[i], c = v.connectivity, p = v.proposal, g = p.geometry, cap = caps[i];
    const polygon = structuredClone(cap.polygon);
    for (const j of [cap.count - 1, cap.count]) polygon[j] = { x: cap.endpoint.x,
      y: cap.endpoint.y + Math.sign(polygon[j].y - cap.endpoint.y) * halfWidth };
    const before = hash(cap.polygon); let replacedWalkable = 0;
    for (const r of g.terrainRegions.filter(r => r.kind === "path_ground")) r.polygon = structuredClone(polygon);
    for (const r of g.walkableRegions) if (hash(r.polygon) === before) { r.polygon = structuredClone(polygon); replacedWalkable++; }
    assert(replacedWalkable === 1, "actual walkable path polygon binding missing or ambiguous");
    const priorMask = rasterizePolygons([{ polygon: cap.polygon }], 1024, 768), nextMask = rasterizePolygons([{ polygon }], 1024, 768);
    const changedPixels = priorMask.reduce((n, b, j) => n + Number(b !== nextMask[j]), 0);
    changes.push({ regionId: p.regionId, changedPathPixels: changedPixels, priorPolygonSha256: before,
      currentPolygonSha256: hash(polygon), modifiedVertexIndices: [cap.count - 1, cap.count], pathCenterlineChanged: false });
    c.edgePorts = [...c.edgePorts.filter(port => port.kind !== "path"), structuredClone(localPorts[i]), structuredClone(localPorts[1 - i])];
    for (const port of c.edgePorts.filter(port => port.kind === "water" && port.regionId === p.regionId)) {
      const other = c.edgePorts.find(v => v.edgePortId === port.connectsToEdgePortId);
      if (other?.state === "blocked_pending_actual_neighbor_geometry") port.state = other.state;
    }
    c.currentRegion.neighborRegionIds = [...new Set(c.edgePorts.filter(port => port.regionId === p.regionId).map(port => port.connectsToRegionId))];
    const plan = c.anonymousTrainingCoordinateProjection;
    plan.pathPlan.pairedCurrentGeometry = { pathPairRevisionIdentity: revisionId, pairedRegionId: results[1 - i].proposal.regionId,
      pairedPathPortId: localPorts[1 - i].edgePortId, upstreamStubReplacementPending: false };
    delete plan.projectionSha256; plan.projectionSha256 = hash(plan);
    c.pathPairRevisionIdentity = revisionId;
    c.geometryResolution = { ...c.geometryResolution, pathPairRevisionIdentity: revisionId, neighborPathGeometryVerified: true, worldGraphConnected: false };
    c.status = "unpublished_local_path_pair_downstream_and_qualification_pending";
    delete c.connectivityInstanceSha256; c.connectivityInstanceSha256 = hash(c);
    p.createdAtUtc = createdAtUtc; p.createdAtAsiaShanghai = new Date(createdAtUtc).toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }) + " +08:00";
    p.pathPairRevisionIdentity = revisionId; p.pathPairRevision = { identityPayload };
    p.worldFacts.pathPairRevisionBinding = { pathPairRevisionIdentity: revisionId, sourceMeasurementsChanged: false, worldFactsQualified: false };
    p.worldFacts.worldFactSetId = `world-facts-path-pair-${revisionId}:${i}`;
    p.worldFacts.createdAtUtc = p.createdAtUtc; p.worldFacts.createdAtAsiaShanghai = p.createdAtAsiaShanghai;
    g.connectivityCoordinateProjection = structuredClone(plan);
    g.connectivityEvidence = { ...g.connectivityEvidence, resolvedConnectivitySha256: c.connectivityInstanceSha256,
      neighborPathGeometryVerified: true, pathPairRevisionIdentity: revisionId, worldGraphConnected: false };
    g.geometryDerivation.pathPairRevisionIdentity = revisionId;
    g.geometryDerivation.pathEndCapRevision = changes[i];
    const priorRouteAudit = g.routeWaterAvoidanceAudit;
    g.routeWaterAvoidanceAudit = { schemaVersion: i ? "paired_end_cap_native_route_audit_v1" : "joint_surface_preserved_route_audit_v1",
      status: "passed", passed: true, evaluatedAttemptCount: 1, passingCandidateCount: 1, rejectedCandidateCount: 0,
      evaluationScope: "existing_centerline_with_rebound_end_cap_rechecked_no_origin_search_replayed",
      priorSearchAuditSha256: hash(priorRouteAudit), waterProjectionSha256: v.waterProjection.projectionSha256,
      pathFootprintChanged: changedPixels > 0, pathCenterlineChanged: false,
      currentPathPolygonSha256: hash(polygon), pathPairRevisionIdentity: revisionId };
    p.structuralIdentities = buildCompleteMapStructuralIdentities({ connectivity: c, geometry: g });
  }
  const audit = auditMeasuredPathSeam(results[0], results[1]);
  return { schemaVersion: "measured-neighbor-complete-path-pair-revision-v1", pathPairRevisionIdentity: revisionId, identityPayload,
    upstream: results[0], neighbor: results[1], changes, audit,
    outputBoundary: { originalEvidenceModified: false, worldGraphConnected: false, worldFactsQualified: false,
      downstreamNeighborGeometryVerified: false, countsAsAdditionalSample: false, trainingAllowed: false } };
}

// Finalize an unpublished output from the actual solver, not its input chord.
// The initial proposal remains separately traceable; neighboring path geometry
// is still absent and must not become a successful world-connectivity claim.
export function finalizeMeasuredGeometryConnectivity(inputConnectivity, inputProposal) {
  const { connectivityInstanceSha256, ...payload } = inputConnectivity;
  assert.equal(hash(payload), connectivityInstanceSha256, "input connectivity identity mismatch");
  assert.equal(inputConnectivity.schemaVersion, "regional-connectivity-proposal-v2");
  assert.equal(inputProposal.schemaVersion, "ai-painter-replacement-geometry-proposal-v1");
  assert.equal(inputProposal.status, "complete_geometry_proposed_not_pre_rgb_qualified");
  for (const key of ["conditionPackCreated", "imageGenerationStarted", "rgbCreated", "gpuTrainingStarted",
    "trainingAllowed", "runtimeFrameEligible", "canEnterWorld"]) assert.equal(inputProposal.outputBoundary?.[key], false);
  assert.equal(inputProposal.regionId, inputConnectivity.currentRegion.regionId, "geometry region mismatch");
  const connectivity = structuredClone(inputConnectivity), proposal = structuredClone(inputProposal), geometry = proposal.geometry;
  const canvas = geometry.worldFrameContract.frameCoverage, points = geometry.pathCenterline;
  assert(Array.isArray(points) && points.length >= 2 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= 0 && p.y >= 0 && p.x <= canvas.width && p.y <= canvas.height), "invalid final path geometry");
  const ports = connectivity.edgePorts.filter(p => p.kind === "path" && p.regionId === proposal.regionId);
  assert.equal(ports.length, 1, "final geometry requires one path port");
  const port = ports[0], plan = connectivity.anonymousTrainingCoordinateProjection;
  assert.deepEqual(points.at(-1), port.boundaryPosition, "final path endpoint differs from port");
  assert(replacementPathOriginWithinContract(points[0], port.boundarySide, canvas, plan.pathPlan.interiorEntryDepthContract),
    "final path origin violates existing depth contract");
  assert.equal(connectivity.pathGraph.edges.length, 1, "unexpected extra path edges");
  const edge = connectivity.pathGraph.edges[0];
  assert(edge.target === port.edgePortId && connectivity.pathGraph.nodes.includes(edge.source), "path graph endpoint mismatch");
  const initialPathPlanSha256 = hash(plan.pathPlan);
  edge.coordinates = structuredClone(points);
  plan.pathPlan.interiorEntryPoint = structuredClone(points[0]);
  plan.pathPlan.resolvedGeometryBinding = { method: "actual_water_avoiding_path_centerline_v1", initialPathPlanSha256,
    pathCenterlineSha256: hash(points), pointCount: points.length, existingDepthContractVerified: true };
  delete plan.projectionSha256;
  plan.projectionSha256 = hash(plan);
  connectivity.geometryResolution = { inputConnectivitySha256: connectivityInstanceSha256,
    localPathCoordinateIdentityVerified: true, neighborPathGeometryVerified: false, worldGraphConnected: false };
  connectivity.walkableGraph.connected = false;
  connectivity.identityBoundary.currentRegionWorldGraphConnected = false;
  delete connectivity.connectivityInstanceSha256;
  connectivity.connectivityInstanceSha256 = hash(connectivity);
  geometry.connectivityCoordinateProjection = structuredClone(plan);
  geometry.connectivityEvidence = { ...geometry.connectivityEvidence,
    resolvedConnectivitySha256: connectivity.connectivityInstanceSha256,
    localPathCoordinateIdentityVerified: true, neighborPathGeometryVerified: false, worldGraphConnected: false };
  proposal.structuralIdentities = buildCompleteMapStructuralIdentities({ connectivity, geometry });
  return { connectivity, proposal };
}

// Same logical map/region, new immutable geometry revision. It is never an
// additional capacity sample, and retained source identities are not new grants.
export function rebindJointWaterCompleteGeometry({ proposal: inputProposal, connectivity: inputConnectivity,
  upstreamProjection, joint, programBindings, createdAtUtc }) {
  assert(Array.isArray(programBindings) && programBindings.length > 0 && programBindings.length <= 32 &&
    new Set(programBindings.map(b => b.path)).size === programBindings.length &&
    programBindings.every(b => typeof b.path === "string" && /^[a-f0-9]{64}$/.test(b.sha256)), "revision program bindings required");
  assert(typeof createdAtUtc === "string" && new Date(createdAtUtc).toISOString() === createdAtUtc, "revision UTC timestamp required");
  assert(inputProposal.worldId === inputProposal.worldFacts?.worldId && inputProposal.regionId === inputProposal.worldFacts?.regionId,
    "base proposal WorldFacts identity differs");
  assert.equal(inputProposal.worldFacts.status, "unpublished_measurement_derived_world_facts_proposal");
  assert.equal(inputProposal.geometryRevisionIdentity, undefined, "joint rebind requires an explicit unrevised base");
  const baselineSpatial = auditMeasuredGeometrySpatial(inputProposal, inputConnectivity, upstreamProjection);
  assert(baselineSpatial.localSpatialPassed, "base complete geometry fails spatial checks");
  const impact = auditJointWaterAgainstUpstreamGeometry(inputProposal, joint, upstreamProjection);
  assert(impact.passed, "joint water conflicts with preserved complete geometry");
  const identityPayload = { algorithm: "same_region_joint_water_complete_geometry_revision_v1",
    baseProposalSha256: hash(inputProposal), baseConnectivitySha256: inputConnectivity.connectivityInstanceSha256,
    baseWaterProjectionSha256: upstreamProjection.projectionSha256, jointProjectionSha256: joint.projectionSha256,
    programBindings: structuredClone(programBindings).sort((a, b) => a.path.localeCompare(b.path)) };
  const identity = hash(identityPayload), revision = { geometryRevisionIdentity: identity, identityPayload,
    retainedLogicalWorldId: inputProposal.worldId, retainedLogicalRegionId: inputProposal.regionId,
    countsAsAdditionalSample: false, priorWorldFactSetId: inputProposal.worldFacts.worldFactSetId,
    createdAtUtc, previousEvidenceMayGrantCurrentQualification: false };
  const projection = structuredClone(upstreamProjection);
  delete projection.projectionSha256;
  projection.schemaVersion = "measured-joint-upstream-water-projection-proposal-v1";
  projection.geometryRevisionIdentity = identity;
  projection.baseProjectionSha256 = upstreamProjection.projectionSha256;
  projection.jointProjectionSha256 = joint.projectionSha256;
  projection.waterPolygons = structuredClone(joint.upstream.waterPolygons);
  projection.shorelinePolygons = structuredClone(joint.upstream.shorelinePolygons);
  projection.audit.waterBoundary = auditProjectedWaterBoundary(projection.waterPolygons, projection.canvas, "east");
  projection.audit.shorelineBoundary = auditProjectedWaterBoundary(projection.shorelinePolygons, projection.canvas, "east");
  const waterSpan = projection.audit.waterBoundary.boundarySpan, shoreSpan = projection.audit.shorelineBoundary.boundarySpan;
  for (const node of projection.nodes.filter(n => ["outlet", "neighbor_inlet"].includes(n.kind))) {
    node.waterBoundarySpan = structuredClone(waterSpan); node.shorelineBoundarySpan = structuredClone(shoreSpan);
  }
  projection.audit.jointSeam = { jointProjectionSha256: joint.projectionSha256, audit: joint.audit.seam };
  projection.outputBoundary = { ...projection.outputBoundary, fullNeighborGeometryCreated: false,
    downstreamNeighborGeometryVerified: false, countsAsAdditionalSample: false };
  projection.projectionSha256 = hash(projection);

  const proposal = structuredClone(inputProposal), connectivity = structuredClone(inputConnectivity), g = proposal.geometry;
  proposal.createdAtUtc = createdAtUtc;
  proposal.createdAtAsiaShanghai = new Date(createdAtUtc).toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }) + " +08:00";
  proposal.geometryRevisionIdentity = identity; proposal.geometryRevision = revision;
  proposal.worldFacts.createdAtUtc = proposal.createdAtUtc;
  proposal.worldFacts.createdAtAsiaShanghai = proposal.createdAtAsiaShanghai;
  proposal.worldFacts.worldFactSetId = `world-facts-geometry-revision-${identity}`;
  proposal.worldFacts.geometryRevisionBinding = { geometryRevisionIdentity: identity,
    baseProposalSha256: identityPayload.baseProposalSha256, priorWorldFactSetId: revision.priorWorldFactSetId,
    jointProjectionSha256: joint.projectionSha256, waterProjectionSha256: projection.projectionSha256,
    sourceMeasurementsChanged: false, worldFactsQualified: false };
  for (const [kind, polygons] of [["water", projection.waterPolygons], ["shoreline", projection.shorelinePolygons]]) {
    const first = g.terrainRegions.findIndex(r => r.kind === kind); assert(first >= 0, `base ${kind} layer missing`);
    const retained = g.terrainRegions.filter(r => r.kind !== kind);
    const insertion = g.terrainRegions.slice(0, first).filter(r => r.kind !== kind).length;
    retained.splice(insertion, 0, ...polygons.map((polygon, i) => ({ kind, polygon: structuredClone(polygon),
      sourceId: `geometry-revision-${identity}:${kind}:${i + 1}` })));
    g.terrainRegions = retained;
  }
  const ports = connectivity.edgePorts.filter(p => p.kind === "water");
  assert(ports.length === 2 && ports.some(p => p.regionId === proposal.regionId && p.flowRole === "outlet" && p.boundarySide === "east") &&
    ports.some(p => p.regionId === projection.neighborId && p.flowRole === "inlet" && p.boundarySide === "west"), "base water port pair differs");
  for (const p of ports) {
    const other = ports.find(n => n.edgePortId === p.connectsToEdgePortId);
    assert(other?.connectsToEdgePortId === p.edgePortId && other?.regionId === p.connectsToRegionId, "base water pair is not reciprocal");
    p.waterBoundarySpan = structuredClone(waterSpan); p.shorelineBoundarySpan = structuredClone(shoreSpan);
    p.geometryRevisionIdentity = identity;
  }
  connectivity.geometryRevisionIdentity = identity;
  connectivity.status = "unpublished_joint_water_complete_geometry_neighbor_regions_pending";
  connectivity.hydrologyGraph.projectionSha256 = projection.projectionSha256;
  connectivity.hydrologyGraph.jointProjectionSha256 = joint.projectionSha256;
  connectivity.hydrologyGraph.localWaterPairVerified = true;
  const plan = connectivity.anonymousTrainingCoordinateProjection;
  plan.waterPlan.projectionSha256 = projection.projectionSha256;
  plan.waterPlan.jointProjectionSha256 = joint.projectionSha256;
  plan.pathPlan.resolvedGeometryBinding = { method: "preserved_path_revalidated_against_joint_surface_v1",
    previousPathPlanSha256: hash(inputConnectivity.anonymousTrainingCoordinateProjection.pathPlan),
    pathCenterlineSha256: hash(g.pathCenterline), pointCount: g.pathCenterline.length, existingDepthContractVerified: true };
  plan.pathPlan.jointWaterAvoidance = { method: "preserved_path_native_mask_revalidation_v1",
    waterAndShorelineExcludedSpan: structuredClone(shoreSpan), pathWaterOverlapPixels: impact.overlaps.pathWater,
    pathShorelineOverlapPixels: impact.overlaps.pathShorelineCorridor, pathMoved: false, unpublishedProposalOnly: true };
  delete plan.projectionSha256; plan.projectionSha256 = hash(plan);
  connectivity.geometryResolution = { inputConnectivitySha256: inputConnectivity.connectivityInstanceSha256,
    geometryRevisionIdentity: identity, localPathCoordinateIdentityVerified: true, localWaterPairVerified: true,
    neighborPathGeometryVerified: false, worldGraphConnected: false };
  connectivity.walkableGraph.connected = false; connectivity.identityBoundary.currentRegionWorldGraphConnected = false;
  delete connectivity.connectivityInstanceSha256; connectivity.connectivityInstanceSha256 = hash(connectivity);
  g.connectivityCoordinateProjection = structuredClone(plan);
  g.connectivityEvidence = { ...g.connectivityEvidence, resolvedConnectivitySha256: connectivity.connectivityInstanceSha256,
    jointProjectionSha256: joint.projectionSha256, localWaterPairVerified: true, worldGraphConnected: false, neighborPathGeometryVerified: false };
  g.mainChannelSelection = { projectionSha256: projection.projectionSha256, jointProjectionSha256: joint.projectionSha256 };
  g.lateralContinuationAudit = { scope: "verified_local_water_pair_not_full_neighbor_geometry",
    passed: true, jointProjectionSha256: joint.projectionSha256, nativeSeamAudit: joint.audit.seam,
    fullNeighborGeometryCreated: false, worldGraphConnected: false };
  g.routeWaterAvoidanceAudit = { schemaVersion: "joint_surface_preserved_route_audit_v1", status: "passed", passed: true,
    evaluatedAttemptCount: 1, passingCandidateCount: 1, rejectedCandidateCount: 0,
    evaluationScope: "only_the_preserved_route_was_rechecked_no_origin_search_replayed",
    priorSearchAuditSha256: hash(inputProposal.geometry.routeWaterAvoidanceAudit),
    waterProjectionSha256: projection.projectionSha256, jointProjectionSha256: joint.projectionSha256,
    pathWaterOverlap: false, pathWaterOverlapPixels: impact.overlaps.pathWater,
    pathShorelineOverlapPixels: impact.overlaps.pathShorelineCorridor, pathMoved: false, fullCanvasCandidateSearch: false };
  g.geometryDerivation = describeMeasuredWaterDerivation({ base: inputProposal.geometry.geometryDerivation, projection });
  g.geometryDerivation.geometryRevisionIdentity = identity;
  g.geometryDerivation.baseCompleteGeometrySha256 = identityPayload.baseProposalSha256;
  g.geometryDerivation.routeWaterAvoidanceMethod = "preserved_path_native_mask_revalidation_v1";
  g.geometryDerivation.routeWaterAvoidancePassed = true;
  proposal.structuralIdentities = buildCompleteMapStructuralIdentities({ connectivity, geometry: g });
  const spatial = auditMeasuredGeometrySpatial(proposal, connectivity, projection);
  assert(spatial.localSpatialPassed, "rebound complete geometry failed current native spatial audit");
  return { schemaVersion: "measured-joint-water-complete-geometry-revision-v1", revision,
    proposal, connectivity, waterProjection: projection, upstreamImpact: impact, nativeSpatialAudit: spatial,
    outputBoundary: { sameLogicalMapRevision: true, countsAsAdditionalSample: false, originalEvidenceModified: false,
      conditionPackCreated: false, rgbCreated: false, trainingAllowed: false, worldFactsQualified: false,
      fullNeighborGeometryCreated: false, currentRegistryModified: false } };
}

export function auditMeasuredGeometrySpatial(proposal, connectivity, waterProjection) {
  assert.equal(proposal.schemaVersion, "ai-painter-replacement-geometry-proposal-v1");
  assert.equal(proposal.status, "complete_geometry_proposed_not_pre_rgb_qualified");
  for (const key of ["conditionPackCreated", "imageGenerationStarted", "rgbCreated", "gpuTrainingStarted",
    "trainingAllowed", "runtimeFrameEligible", "canEnterWorld"]) assert.equal(proposal.outputBoundary?.[key], false);
  const { connectivityInstanceSha256, ...connectivityPayload } = connectivity;
  const { projectionSha256, ...waterPayload } = waterProjection;
  assert.equal(hash(connectivityPayload), connectivityInstanceSha256, "resolved connectivity hash mismatch");
  assert.equal(hash(waterPayload), projectionSha256, "water projection hash mismatch");
  assert.equal(connectivity.hydrologyGraph.projectionSha256, projectionSha256);
  assert.equal(proposal.regionId, connectivity.currentRegion.regionId);
  const g = proposal.geometry, canvas = g.worldFrameContract.frameCoverage;
  assert(canvas.width === 1024 && canvas.height === 768, "spatial audit requires native canvas");
  extractHistoricalGeometry({ schemaVersion: "ai-assisted-training-world-fact-blueprint-v2", canvas, geometry: g });
  assert.deepEqual(g.pathCenterline, connectivity.pathGraph.edges[0].coordinates, "path graph does not describe actual path");
  assert.deepEqual(g.connectivityCoordinateProjection, connectivity.anonymousTrainingCoordinateProjection);
  assert.equal(g.connectivityEvidence.resolvedConnectivitySha256, connectivityInstanceSha256);
  assert.deepEqual(g.waterCenterline, waterProjection.edges[0].centerline);
  assert.deepEqual(g.terrainRegions.filter(r => r.kind === "water").map(r => r.polygon), waterProjection.waterPolygons);
  assert.deepEqual(g.terrainRegions.filter(r => r.kind === "shoreline").map(r => r.polygon), waterProjection.shorelinePolygons);
  if (proposal.pathPairRevisionIdentity !== undefined || connectivity.pathPairRevisionIdentity !== undefined) {
    const pairId = proposal.pathPairRevisionIdentity;
    assert.equal(hash(proposal.pathPairRevision.identityPayload), pairId, "path pair revision identity differs");
    assert.equal(connectivity.pathPairRevisionIdentity, pairId, "connectivity path pair revision differs");
    assert.equal(proposal.worldFacts?.pathPairRevisionBinding?.pathPairRevisionIdentity, pairId, "WorldFacts path pair revision differs");
    assert.equal(g.geometryDerivation.pathPairRevisionIdentity, pairId, "geometry path pair revision differs");
    assert.equal(g.routeWaterAvoidanceAudit.pathPairRevisionIdentity, pairId, "route audit path pair revision differs");
    assert.deepEqual(proposal.structuralIdentities, buildCompleteMapStructuralIdentities({ connectivity, geometry: g }),
      "path pair structural identities differ");
  }
  const revisionId = proposal.geometryRevisionIdentity ?? connectivity.geometryRevisionIdentity ?? waterProjection.geometryRevisionIdentity;
  if (revisionId !== undefined) {
    assert.equal(proposal.geometryRevisionIdentity, revisionId, "proposal geometry revision differs");
    assert.equal(connectivity.geometryRevisionIdentity, revisionId, "connectivity geometry revision differs");
    assert.equal(waterProjection.geometryRevisionIdentity, revisionId, "water geometry revision differs");
    assert.equal(hash(proposal.geometryRevision.identityPayload), revisionId, "geometry revision identity does not reproduce");
    assert.equal(proposal.worldFacts?.worldId, proposal.worldId, "revised WorldFacts world differs");
    assert.equal(proposal.worldFacts?.regionId, proposal.regionId, "revised WorldFacts region differs");
    assert.equal(proposal.worldFacts.geometryRevisionBinding?.geometryRevisionIdentity, revisionId, "WorldFacts geometry revision differs");
    assert.equal(proposal.worldFacts.geometryRevisionBinding.waterProjectionSha256, projectionSha256, "WorldFacts water projection differs");
    assert.equal(g.geometryDerivation.geometryRevisionIdentity, revisionId, "derivation geometry revision differs");
    assert.equal(g.geometryDerivation.activeWaterGeometry?.projectionSha256, projectionSha256, "active water derivation differs");
    assert.equal(g.geometryDerivation.activeWaterGeometry.waterPolygonsSha256, hash(waterProjection.waterPolygons), "active water surface differs");
    assert.equal(g.geometryDerivation.activeWaterGeometry.shorelinePolygonsSha256, hash(waterProjection.shorelinePolygons), "active shoreline differs");
    assert.equal(g.mainChannelSelection?.projectionSha256, projectionSha256, "main channel projection differs");
    assert.equal(g.routeWaterAvoidanceAudit.waterProjectionSha256, projectionSha256, "route audit water version differs");
    assert.equal(g.routeWaterAvoidanceAudit.schemaVersion, "joint_surface_preserved_route_audit_v1", "revised route audit schema differs");
    assert(g.routeWaterAvoidanceAudit.evaluatedAttemptCount === 1 && g.routeWaterAvoidanceAudit.passingCandidateCount === 1 &&
      g.routeWaterAvoidanceAudit.rejectedCandidateCount === 0, "historical search counts reused as current route checks");
    for (const port of connectivity.edgePorts.filter(p => p.kind === "water")) {
      assert.equal(port.geometryRevisionIdentity, revisionId, "water port geometry revision differs");
      assert.deepEqual(port.waterBoundarySpan, waterProjection.audit.waterBoundary.boundarySpan, "water port span differs");
      assert.deepEqual(port.shorelineBoundarySpan, waterProjection.audit.shorelineBoundary.boundarySpan, "shoreline port span differs");
    }
    assert.deepEqual(proposal.structuralIdentities, buildCompleteMapStructuralIdentities({ connectivity, geometry: g }),
      "revised structural identities differ");
  }
  const { width, height } = canvas, masks = {};
  for (const kind of ["path_ground", "water", "shoreline", "natural_boundary"])
    masks[kind] = rasterizePolygons(g.terrainRegions.filter(r => r.kind === kind), width, height);
  masks.collision = rasterizePolygons(g.collisionRegions, width, height);
  masks.walkable = rasterizePolygons(g.walkableRegions, width, height);
  masks.objects = rasterizeFootprints(g.objectFootprints, width, height);
  const overlap = (a, b) => a.reduce((n, v, i) => n + (v > 0 && b[i] > 0 ? 1 : 0), 0);
  const layers = Object.fromEntries(Object.entries(masks).map(([key, mask]) => [key, nativeMaskStats(mask, width, height)]));
  const overlaps = { pathWater: overlap(masks.path_ground, masks.water), pathCollision: overlap(masks.path_ground, masks.collision),
    pathObjects: overlap(masks.path_ground, masks.objects), pathWalkable: overlap(masks.path_ground, masks.walkable) };
  const issues = [], require = (ok, code) => { if (!ok) issues.push(code); };
  require(overlaps.pathWater === 0, "route_overlaps_water"); require(overlaps.pathCollision === 0, "route_overlaps_collision");
  require(overlaps.pathWalkable === layers.path_ground.pixels, "route_not_fully_walkable");
  require(layers.path_ground.componentCount === 1, "route_not_single_connected_component");
  require(layers.water.componentCount === 1, "single_channel_water_not_connected");
  require(layers.path_ground.maximumNormalizedSpan >= 0.35, "route_span_too_local");
  require(layers.walkable.ratio >= 0.015, "walkable_space_insufficient");
  require(layers.objects.ratio > 0 && layers.objects.ratio < 0.35, "object_density_not_readable");
  require(layers.collision.ratio > 0 && layers.collision.ratio < 0.75, "collision_scope_invalid");
  require(Object.values(layers.natural_boundary.edges).filter(v => v > 0).length >= 2, "natural_boundary_not_frame_scale");
  for (const [kind, layer] of [["water", "water"], ["path", "path_ground"]]) {
    const ports = connectivity.edgePorts.filter(p => p.kind === kind && p.regionId === proposal.regionId);
    const through = kind === "water" && waterProjection.schemaVersion === "measured-joint-through-channel-projection-proposal-v1";
    require(ports.length === (through ? 2 : 1), `${kind}_unexpected_port_count`);
    if (through) {
      require(connectivity.hydrologyGraph.mode === "measured_external_inlet_to_external_outlet", "through_channel_mode_differs");
      require(ports.some(p => p.boundarySide === "west" && p.flowRole === "inlet") &&
        ports.some(p => p.boundarySide === "north" && p.flowRole === "outlet"), "through_channel_directions_differ");
      require(waterProjection.sourceNodeChain?.length >= 3, "through_channel_source_chain_missing");
      for (const key of ["waterPolygons", "shorelinePolygons"]) {
        const spans = boundaryIntervals(waterProjection[key], waterProjection.canvas, ["west", "north"]);
        for (const port of ports) require(spans[port.boundarySide][0].every((v, i) =>
          v === port[key === "waterPolygons" ? "waterBoundarySpan" : "shorelineBoundarySpan"][i ? "end" : "start"]),
        "through_channel_port_span_differs");
      }
    }
    const sides = new Set(ports.map(p => p.boundarySide));
    for (const [side, count] of Object.entries(layers[layer].edges)) require(sides.has(side) ? count > 0 : count === 0, `${kind}_boundary_mismatch_${side}`);
    for (const port of ports) {
      const p = port.boundaryPosition, x = Math.min(width - 1, Math.floor(p.x)), y = Math.min(height - 1, Math.floor(p.y));
      require(x >= 0 && y >= 0 && masks[layer][y * width + x] > 0, `${kind}_port_pixel_not_occupied`);
    }
  }
  const routeAudit = g.routeWaterAvoidanceAudit;
  require(routeAudit?.evaluatedAttemptCount === routeAudit?.passingCandidateCount + routeAudit?.rejectedCandidateCount,
    "route_attempt_accounting_inconsistent");
  return { schemaVersion: "measured-geometry-native-spatial-audit-v1", status: issues.length ? "local_spatial_failed_closed" : "local_spatial_checks_passed_not_qualified",
    localSpatialPassed: issues.length === 0, issues, layers, overlaps,
    samplingRule: "existing_condition_compiler_pixel_center_even_odd_v1", componentConnectivity: 4,
    outputBoundary: { formalConditionPackCreated: false, preRgbPassed: false, worldFactsQualified: false,
      neighborPathGeometryVerified: false, regionGraphPublished: false, trainingAllowed: false } };
}
