import assert from "node:assert/strict";
import { test } from "node:test";
import { projectMeasuredSingleChannel, auditProjectedWaterBoundary, bindProjectedWaterConnectivity, finalizeMeasuredGeometryConnectivity, auditMeasuredGeometrySpatial,
  projectMeasuredNeighborChannelPair, auditProjectedNeighborWaterSeam, auditJointWaterAgainstUpstreamGeometry, rebindJointWaterCompleteGeometry,
  bindMeasuredNeighborConnectivity, auditMeasuredPathSeam, resolveMeasuredNeighborPathPair } from "../lib/measurement-derived-hydrology-projection.mjs";
import { canonicalSha256 } from "../lib/real-earth-region-governance.mjs";
import { buildVariableWidthCorridorPolygons, replacementPathOriginWithinContract, describeMeasuredWaterDerivation } from "../build-earth-geospatial-complete-map-conditions.mjs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { rasterizePolygons, rasterizeFootprints, fillBounds } from "../lib/current-world-condition-raster.mjs";
import { auditBoundHistoricalRgbWater, fingerprintHistoricalRgbWater } from "../lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs";
import sharp from "sharp";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFrozenCompilerFixture, readFrozenHydrologyFixture } from "./helpers/stage4-frozen-condition-compiler.mjs";

function fixture(side = "east") {
  const opposites = { east: "west", west: "east", north: "south", south: "north" };
  const point = { x: 2, y: 1.5 };
  return { candidateId: "synthetic-source", sourceGraph: { schemaVersion: "measured-window-hydrology-support-graph-v1",
    gaps: [], nodes: [{ nodeId: "a", sourcePoint: { x: 0.5, y: 1.5 }, upstreamExcludedCellCount: 0 },
      { nodeId: "b", sourcePoint: { x: 1.5, y: 1.5 }, upstreamExcludedCellCount: 0 },
      { nodeId: "p", sourcePoint: point, upstreamExcludedCellCount: 0 }],
    edges: [{ source: "a", target: "b" }, { source: "b", target: "p" }],
    ports: [{ nodeId: "p", role: "outlet", boundarySides: [side], cornerAmbiguous: false }] },
    neighborPairing: { gaps: [], pairs: [{ sourceCandidateId: "synthetic-source", neighborCandidateId: "synthetic-neighbor",
      sourcePortId: "p", sourceSide: side, neighborSide: opposites[side], sourceRole: "outlet", neighborRole: "inlet",
      sourceIntersection: point, neighborIntersection: point }] },
    naturalnessProfileBinding: { path: "synthetic/profile.json", sha256: "a".repeat(64) },
    naturalnessProfile: { status: "aggregate_public_water_naturalness_profile_ready", anonymousGenerationEnvelope: {
      minimumSinuosity: 1.223141, targetSinuosity: 1.45, maximumSinuosity: 1.8,
      minimumCenterlinePointCount: 49, maximumCenterlineSegmentPixels: 24,
      maximumInteriorTurnDegrees: 18, minimumCumulativeTurnDegrees: 50 } } };
}
for (const side of ["east", "west", "north", "south"]) test(`single supported outlet projects toward ${side}`, () => {
  const input = fixture(side), before = JSON.stringify(input);
  const result = projectMeasuredSingleChannel(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.nodes.length, 3); assert.equal(result.edges.length, 2);
  assert.equal(result.nodes[1].boundarySide, side);
  assert.deepEqual(result.edges[0].sourceNodeChain, ["a", "b", "p"]);
  assert(result.audit.naturalness.passed && result.audit.corridor.passed);
  assert.equal(result.audit.projectedBranchCount, 0);
  assert.equal(result.outputBoundary.worldFactsQualified, false);
  assert.equal(result.outputBoundary.sourceCoordinatesUsedAsGamePositions, false);
  assert.equal(result.outputBoundary.trainingAllowed, false);
  assert.equal(result.audit.shorelineBoundaryContactsVerified, true);
  assert.deepEqual(result.nodes[1].waterBoundarySpan, result.nodes[2].waterBoundarySpan);
  assert.deepEqual(result.nodes[1].shorelineBoundarySpan, result.nodes[2].shorelineBoundarySpan);
  assert.deepEqual(projectMeasuredSingleChannel(input), result);
});
for (const [name, mutate] of [
  ["masked upstream", i => i.sourceGraph.nodes[0].upstreamExcludedCellCount = 1],
  ["unresolved graph", i => i.sourceGraph.gaps.push({ code: "gap" })],
  ["extra external inlet", i => i.sourceGraph.ports.push({ nodeId: "a", role: "inlet" })],
  ["disconnected node", i => i.sourceGraph.nodes.push({ nodeId: "c", upstreamExcludedCellCount: 0 })],
  ["branching graph", i => i.sourceGraph.edges.push({ source: "a", target: "p" })],
  ["unpaired neighbor", i => i.neighborPairing.pairs = []],
  ["wrong neighbor direction", i => i.neighborPairing.pairs[0].neighborRole = "outlet"],
  ["false neighbor position", i => i.neighborPairing.pairs[0].neighborIntersection = { x: 1, y: 2 }],
  ["ambiguous corner", i => i.sourceGraph.ports[0].cornerAmbiguous = true],
]) test(`projection rejects ${name} without substituting another water template`, () => {
  const input = fixture(); mutate(input); assert.throws(() => projectMeasuredSingleChannel(input));
});
test("surface checks reject missing, extra, zero-area and escaped boundary geometry", () => {
  const canvas = { width: 100, height: 100 };
  const valid = [[{ x: 80, y: 40 }, { x: 100, y: 40 }, { x: 100, y: 60 }, { x: 80, y: 60 }]];
  assert.deepEqual(auditProjectedWaterBoundary(valid, canvas, "east").boundarySpan, { start: 40, end: 60 });
  assert.throws(() => auditProjectedWaterBoundary(valid, canvas, "west"));
  assert.throws(() => auditProjectedWaterBoundary([[{ x: 40, y: 40 }, { x: 50, y: 40 }, { x: 50, y: 50 }]], canvas, "east"));
  assert.throws(() => auditProjectedWaterBoundary([[{ x: 100, y: 40 }, { x: 100, y: 50 }, { x: 100, y: 60 }]], canvas, "east"));
  const escaped = structuredClone(valid); escaped[0][1].x = 101;
  assert.throws(() => auditProjectedWaterBoundary(escaped, canvas, "east"));
});
test("binding replaces fabricated water ports without granting pending path connectivity", () => {
  const regionId = `training-world:thailand-mvp:replacement-${"b".repeat(64)}`;
  const prior = { currentRegion: { regionId, neighborRegionIds: ["old-north", "old-south", "path-neighbor"] },
    edgePorts: [{ kind: "water", regionId, connectsToRegionId: "old-north" },
      { kind: "water", regionId: "old-south", connectsToRegionId: regionId },
      { kind: "path", regionId, connectsToRegionId: "path-neighbor", boundarySide: "east", boundaryPosition: { x: 1024, y: 408 } }], walkableGraph: { connected: true },
    anonymousTrainingCoordinateProjection: { pathPlan: { boundarySide: "east" }, waterPlan: { start: { x: 0, y: 0 } }, projectionSha256: "old" },
    identityBoundary: { currentRegionWorldGraphConnected: true } };
  const snapshot = JSON.stringify(prior), projection = projectMeasuredSingleChannel(fixture());
  const result = bindProjectedWaterConnectivity(prior, projection);
  assert.equal(JSON.stringify(prior), snapshot);
  assert.equal(result.edgePorts.filter(p => p.kind === "water").length, 2);
  assert(result.edgePorts.filter(p => p.kind === "water").every(p => p.boundaryPosition !== null));
  assert(!JSON.stringify(result).includes("old-north")); assert(!JSON.stringify(result).includes("old-south"));
  assert.equal(result.hydrologyGraph.upstreamPortId, null);
  assert.equal(result.hydrologyGraph.externalWaterPortIds.length, 1);
  assert.equal(result.identityBoundary.currentRegionWorldGraphConnected, false);
  assert.equal(result.walkableGraph.connected, false);
  const movedPath = result.edgePorts.find(p => p.kind === "path");
  const span = projection.nodes[1].shorelineBoundarySpan;
  assert(movedPath.boundaryPosition.y + 42 <= span.start || movedPath.boundaryPosition.y - 42 >= span.end);
  assert.equal(result.anonymousTrainingCoordinateProjection.pathPlan.jointWaterAvoidance.unpublishedProposalOnly, true);
  const corrupt = structuredClone(projection); corrupt.nodes[1].position.y++;
  assert.throws(() => bindProjectedWaterConnectivity(prior, corrupt), /identity mismatch/);
});
test("extracted shared corridor construction is identical to the repository baseline", () => {
  const old = readFrozenHydrologyFixture(fileURLToPath(new URL("../../", import.meta.url)), "corridor").toString("utf8");
  const start = old.indexOf("function buildVariableWidthCorridorPolygons("), end = old.indexOf("function irregularEllipsePolygon(", start);
  assert(start >= 0 && end > start, "baseline geometry functions missing");
  const legacy = vm.runInNewContext(`(function(){ const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const assert=(ok,m)=>{if(!ok)throw Error(m)}; ${old.slice(start,end)}; return buildVariableWidthCorridorPolygons; })()`);
  const points = Array.from({ length: 121 }, (_, i) => ({ x: 400 + i * 5, y: 300 + Math.sin(i / 10) * 60 }));
  const widths = points.map((_, i) => 34 + i % 3);
  assert.equal(JSON.stringify(buildVariableWidthCorridorPolygons(points, widths, 1024, 768)),
    JSON.stringify(legacy(points, widths, 1024, 768)));
});

const depthContract = { version: "complete-map-boundary-port-to-interior-depth-v1", minimumNormalizedDepth: 0.4,
  maximumNormalizedDepth: 0.72, minimumTangentialFraction: 0.2, maximumTangentialFraction: 0.8,
  completeMapRouteSpanThreshold: 0.35, reviewThresholdChanged: false };
for (const side of ["east", "west", "north", "south"]) test(`resolved path respects all existing ${side} origin bounds`, () => {
  const canvas = { width: 1000, height: 800 };
  const point = (depth, tangent) => ({ east: { x: (1 - depth) * 1000, y: tangent * 800 },
    west: { x: depth * 1000, y: tangent * 800 }, north: { x: tangent * 1000, y: depth * 800 },
    south: { x: tangent * 1000, y: (1 - depth) * 800 } })[side];
  assert(replacementPathOriginWithinContract(point(0.6, 0.5), side, canvas, depthContract));
  for (const [depth, tangent] of [[0.39, 0.5], [0.73, 0.5], [0.6, 0.19], [0.6, 0.81]])
    assert.equal(replacementPathOriginWithinContract(point(depth, tangent), side, canvas, depthContract), false);
  assert.equal(replacementPathOriginWithinContract(point(0.6, 0.5), side, canvas, { ...depthContract, reviewThresholdChanged: true }), false);
});

function geometryBindingFixture() {
  const regionId = `training-world:thailand-mvp:replacement-${"b".repeat(64)}`, portId = `${regionId}:path-east`;
  const prior = { currentRegion: { regionId, neighborRegionIds: ["path-neighbor"] },
    edgePorts: [{ edgePortId: portId, kind: "path", regionId, connectsToRegionId: "path-neighbor",
      boundarySide: "east", boundaryPosition: { x: 1024, y: 408 } }], walkableGraph: { connected: true },
    pathGraph: { nodes: ["entry_point", portId], edges: [{ source: "entry_point", target: portId,
      coordinates: [{ x: 382, y: 614 }, { x: 1024, y: 408 }] }] },
    anonymousTrainingCoordinateProjection: { pathPlan: { boundarySide: "east", interiorEntryPoint: { x: 382, y: 614 },
      interiorEntryDepthContract: depthContract }, projectionSha256: "old" }, identityBoundary: { currentRegionWorldGraphConnected: true } };
  const connectivity = bindProjectedWaterConnectivity(prior, projectMeasuredSingleChannel(fixture()));
  const end = connectivity.edgePorts.find(p => p.kind === "path").boundaryPosition;
  const proposal = { schemaVersion: "ai-painter-replacement-geometry-proposal-v1", status: "complete_geometry_proposed_not_pre_rgb_qualified", regionId,
    geometry: { pathCenterline: [{ x: 350, y: 600 }, { x: 600, y: 550 }, structuredClone(end)],
      worldFrameContract: { frameCoverage: { width: 1024, height: 768 } } },
    outputBoundary: Object.fromEntries(["conditionPackCreated", "imageGenerationStarted", "rgbCreated", "gpuTrainingStarted",
      "trainingAllowed", "runtimeFrameEligible", "canEnterWorld"].map(k => [k, false])) };
  return { connectivity, proposal };
}
test("final connectivity records actual path without mutating input or granting neighbor qualification", () => {
  const { connectivity, proposal } = geometryBindingFixture(), before = JSON.stringify({ connectivity, proposal });
  const result = finalizeMeasuredGeometryConnectivity(connectivity, proposal);
  assert.equal(JSON.stringify({ connectivity, proposal }), before);
  assert.deepEqual(result.connectivity.pathGraph.edges[0].coordinates, proposal.geometry.pathCenterline);
  assert.deepEqual(result.connectivity.anonymousTrainingCoordinateProjection.pathPlan.interiorEntryPoint, proposal.geometry.pathCenterline[0]);
  assert.deepEqual(result.proposal.geometry.connectivityCoordinateProjection, result.connectivity.anonymousTrainingCoordinateProjection);
  const { connectivityInstanceSha256, ...payload } = result.connectivity;
  assert.equal(createHash("sha256").update(JSON.stringify(payload)).digest("hex"), connectivityInstanceSha256);
  assert.equal(result.proposal.geometry.connectivityEvidence.resolvedConnectivitySha256, connectivityInstanceSha256);
  assert.equal(result.connectivity.geometryResolution.inputConnectivitySha256, connectivity.connectivityInstanceSha256);
  assert.equal(result.connectivity.walkableGraph.connected, false);
  assert.equal(result.connectivity.geometryResolution.neighborPathGeometryVerified, false);
  assert.deepEqual(result.proposal.outputBoundary, proposal.outputBoundary);
});
for (const [name, mutate] of [
  ["modified connectivity", f => f.connectivity.pathGraph.edges[0].coordinates[0].x++],
  ["wrong region", f => f.proposal.regionId += "-wrong"],
  ["wrong endpoint", f => f.proposal.geometry.pathCenterline.at(-1).x--],
  ["out of contract origin", f => f.proposal.geometry.pathCenterline[0] = { x: 133, y: 620 }],
  ["nonfinite point", f => f.proposal.geometry.pathCenterline[1].x = NaN],
  ["false qualification", f => f.proposal.outputBoundary.trainingAllowed = true],
]) test(`path finalization fails closed for ${name}`, () => {
  const input = geometryBindingFixture(); mutate(input);
  assert.throws(() => finalizeMeasuredGeometryConnectivity(input.connectivity, input.proposal));
});

test("shared native polygon and footprint raster bytes equal the existing compiler", () => {
  const source = readFrozenCompilerFixture(fileURLToPath(new URL("../../", import.meta.url))).toString("utf8");
  const start = source.indexOf("function rasterizePolygons("), end = source.indexOf("function coordinateChannel(", start);
  assert(start >= 0 && end > start);
  const old = vm.runInNewContext(`(function(){const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    ${source.slice(start, end)}; return {rasterizePolygons,rasterizeFootprints,fillBounds};})()`, { Buffer });
  for (let i = 0; i < 24; i++) {
    const polygons = [{ polygon: [{ x: i - 12, y: i / 3 }, { x: 25.5 + i, y: 16.5 }, { x: 9.5, y: 49 - i }] }];
    const footprints = [{ footprint: { x: i - 6.5, y: i / 3, width: 14.75, height: 12.25 } }];
    assert.deepEqual(rasterizePolygons(polygons, 32, 32), old.rasterizePolygons(polygons, 32, 32));
    assert.deepEqual(rasterizeFootprints(footprints, 32, 32), old.rasterizeFootprints(footprints, 32, 32));
    const actual = Buffer.alloc(1024), expected = Buffer.alloc(1024);
    fillBounds(actual, footprints[0].footprint, 32, 32, 73);
    old.fillBounds(expected, footprints[0].footprint, 32, 32, 73);
    assert.deepEqual(actual, expected);
  }
});

function spatialFixture() {
  const { connectivity, proposal } = geometryBindingFixture(), water = projectMeasuredSingleChannel(fixture());
  const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  const end = connectivity.edgePorts.find(p => p.kind === "path").boundaryPosition;
  const pathPolygon = rect(350, end.y - 9, 674, 18), boundary = rect(0, 0, 40, 768);
  Object.assign(proposal.geometry, { hasWater: true, pathCenterline: [{ x: 350, y: end.y }, structuredClone(end)],
    waterCenterline: structuredClone(water.edges[0].centerline), entranceBounds: { x: 972, y: end.y - 42, width: 52, height: 84 }, focalBounds: null,
    terrainRegions: [{ kind: "grass", polygon: rect(0, 0, 1024, 768) }, { kind: "path_ground", polygon: pathPolygon },
      { kind: "natural_boundary", polygon: boundary }, ...water.waterPolygons.map(polygon => ({ kind: "water", polygon })),
      ...water.shorelinePolygons.map(polygon => ({ kind: "shoreline", polygon }))],
    walkableRegions: [{ polygon: pathPolygon }], collisionRegions: [{ polygon: boundary }],
    objectFootprints: [{ kind: "tree", blocksMovement: true, footprint: { x: 4, y: 20, width: 10, height: 10 } }],
    routeWaterAvoidanceAudit: { evaluatedAttemptCount: 3, passingCandidateCount: 1, rejectedCandidateCount: 2 } });
  return { ...finalizeMeasuredGeometryConnectivity(connectivity, proposal), water };
}
test("native spatial audit verifies raster connectivity while retaining all qualification boundaries", () => {
  const { connectivity, proposal, water } = spatialFixture();
  const result = auditMeasuredGeometrySpatial(proposal, connectivity, water);
  assert.deepEqual(result.issues, []);
  assert.equal(result.layers.water.componentCount, 1);
  assert.equal(result.overlaps.pathWater, 0); assert.equal(result.overlaps.pathCollision, 0);
  assert.equal(result.outputBoundary.preRgbPassed, false); assert.equal(result.outputBoundary.trainingAllowed, false);
});
for (const [name, mutate, code] of [
  ["path collision", g => g.collisionRegions.push(structuredClone(g.walkableRegions[0])), "route_overlaps_collision"],
  ["missing walkability", g => g.walkableRegions = [], "route_not_fully_walkable"],
  ["missing objects", g => g.objectFootprints = [], "object_density_not_readable"],
  ["false attempt accounting", g => g.routeWaterAvoidanceAudit.rejectedCandidateCount++, "route_attempt_accounting_inconsistent"],
]) test(`native spatial audit rejects ${name}`, () => {
  const { connectivity, proposal, water } = spatialFixture(); mutate(proposal.geometry);
  const result = auditMeasuredGeometrySpatial(proposal, connectivity, water);
  assert(result.issues.includes(code)); assert.equal(result.localSpatialPassed, false);
});

async function rgbWaterFixture() {
  const width = 256, height = 192, mask = Buffer.alloc(width * height), rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const wet = x >= 70 && x < 120 && y >= 20 && y < 170, i = y * width + x;
    mask[i] = wet ? 255 : 0; rgb.set(wet ? [43, 112, 156] : [102, 155, 72], i * 3);
  }
  return { mask, width, height, historicalRgbBytes: await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer() };
}
test("byte-bound historical water replay retains existing thresholds and detects normalized reuse", async () => {
  const input = await rgbWaterFixture(), result = await auditBoundHistoricalRgbWater(input);
  assert(result.matched);
  const old = readFrozenHydrologyFixture(fileURLToPath(new URL("../../", import.meta.url)), "novelty").toString("utf8");
  const start = old.indexOf("const THRESHOLDS ="), end = old.indexOf("const COMPOSITE_SKELETON_COLOR_CODES", start);
  assert(start >= 0 && end > start);
  const thresholds = vm.runInNewContext(`${old.slice(start, end)}; THRESHOLDS`);
  assert.equal(JSON.stringify(result.thresholds), JSON.stringify(Object.fromEntries(Object.entries(thresholds).filter(([k]) => k.startsWith("crossModal")))));
  assert.equal(result.preRgbPassed, false); assert.equal(result.allHistoryNoveltyQualified, false);
  const moved = Buffer.alloc(input.mask.length);
  for (let y = 20; y < 170; y++) for (let x = 150; x < 200; x++) moved[y * input.width + x] = 255;
  const translated = await auditBoundHistoricalRgbWater({ ...input, mask: moved });
  assert(translated.matched, "translation must not hide normalized repeated shape");
  assert.equal(translated.trainingAllowed, false);
});
test("historical water replay uses current bytes without stale path cache", async () => {
  const input = await rgbWaterFixture(); assert((await auditBoundHistoricalRgbWater(input)).matched);
  const bytes = await sharp({ create: { width: 256, height: 192, channels: 3, background: { r: 102, g: 155, b: 72 } } }).png().toBuffer();
  const result = await auditBoundHistoricalRgbWater({ ...input, historicalRgbBytes: bytes });
  assert.equal(result.historicalWaterProxy.pixelCount, 0); assert.equal(result.matched, false);
  assert(result.limitations.includes("color_proxy_not_authoritative_water_annotation"));
});
test("historical water replay rejects corrupt bytes and invalid masks", async () => {
  const input = await rgbWaterFixture();
  await assert.rejects(auditBoundHistoricalRgbWater({ ...input, historicalRgbBytes: Buffer.from("broken") }));
  await assert.rejects(auditBoundHistoricalRgbWater({ ...input, mask: Buffer.alloc(1) }));
  const bad = Buffer.from(input.mask); bad[0] = 71;
  await assert.rejects(auditBoundHistoricalRgbWater({ ...input, mask: bad }));
  await assert.rejects(auditBoundHistoricalRgbWater({ ...input, width: 1025 }));
});

function temporaryRgbFile(t) {
  const parent = fs.realpathSync(os.tmpdir()), directory = fs.mkdtempSync(path.join(parent, "ai-painter-rgb-binding-test-"));
  t.after(() => {
    const target = fs.realpathSync(directory);
    assert.equal(path.dirname(target), parent);
    assert(path.basename(target).startsWith("ai-painter-rgb-binding-test-"));
    fs.rmSync(target, { recursive: true, force: true });
  });
  return path.join(directory, "synthetic.png");
}

function pairedFixture() {
  const original = fixture(), window = { left: 2, top: 0, width: 2, height: 2 };
  Object.assign(original.neighborPairing.pairs[0], { neighborSourceWindow: window,
    sourceCell: 1, receiverCell: 2, neighborSourceCell: 1, neighborReceiverCell: 2 });
  const input = { ...original, upstreamProjection: projectMeasuredSingleChannel(original),
    neighborGraph: { schemaVersion: "measured-window-hydrology-support-graph-v1", sourceWindow: structuredClone(window),
      gaps: [], nodes: ["in", "cell", "out"].map(nodeId => ({ nodeId, upstreamExcludedCellCount: 0 })),
      edges: [{ source: "in", target: "cell" }, { source: "cell", target: "out" }],
      ports: [{ nodeId: "in", role: "inlet", boundarySides: ["west"], cornerAmbiguous: false,
        point: { x: 2, y: 1.5 }, sourceCell: 1, receiverCell: 2 },
      { nodeId: "out", role: "outlet", boundarySides: ["north"], cornerAmbiguous: false,
        point: { x: 3, y: 0 }, sourceCell: 2, receiverCell: 3 }] },
    nextPairing: { gaps: [], pairs: [
      { sourcePortId: "in", sourceCandidateId: "synthetic-neighbor", neighborCandidateId: "synthetic-source",
        sourceSide: "west", neighborSide: "east", sourceRole: "inlet", neighborRole: "outlet",
        sourceCell: 1, receiverCell: 2, neighborSourceCell: 1, neighborReceiverCell: 2,
        sourceIntersection: { x: 2, y: 1.5 }, neighborIntersection: { x: 2, y: 1.5 } },
      { sourcePortId: "out", sourceCandidateId: "synthetic-neighbor", neighborCandidateId: "next-neighbor",
        sourceSide: "north", neighborSide: "south", sourceRole: "outlet", neighborRole: "inlet",
        sourceCell: 2, receiverCell: 3, neighborSourceCell: 2, neighborReceiverCell: 3,
        sourceIntersection: { x: 3, y: 0 }, neighborIntersection: { x: 3, y: 0 } }] } };
  return input;
}

test("measured neighbor uses a shared surface with continuous native water and shore, without granting region qualification", () => {
  const input = pairedFixture(), before = JSON.stringify(input), result = projectMeasuredNeighborChannelPair(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(projectMeasuredNeighborChannelPair(input), result, "joint geometry must replay deterministically");
  assert.deepEqual(result.neighborNodeChain, ["in", "cell", "out"]);
  assert(result.audit.naturalness.passed && result.audit.corridor.passed && result.audit.joinCorridor.passed);
  assert.equal(result.audit.evaluatedAttemptCount, 175);
  assert.equal(result.audit.centerlinePassingCount, result.audit.attempts.filter(a => a.accepted).length);
  assert.deepEqual(auditProjectedNeighborWaterSeam(result.upstream, result.neighbor), result.audit.seam);
  for (const layer of Object.values(result.audit.seam.layers)) {
    assert(layer.sharedEdgePixelPairs > 0); assert.equal(layer.combinedNativeComponentCount, 1);
  }
  assert.equal(result.outputBoundary.previousCompleteGeometryMustBeReaudited, true);
  for (const key of ["trainingAllowed", "fullNeighborGeometryCreated", "sourceContextSplitQualified", "worldFactsQualified",
    "rgbCreated", "conditionPackCreated", "regionGraphPublished", "datasetModified"])
    assert.equal(result.outputBoundary[key], false);
});

for (const [name, mutate] of [
  ["upstream payload change", i => i.upstreamProjection.waterPolygons[0][0].x++],
  ["wrong measured neighbor window", i => i.neighborGraph.sourceWindow.left++],
  ["excluded upstream", i => i.neighborGraph.nodes[1].upstreamExcludedCellCount = 1],
  ["unsupported outlet direction", i => i.neighborGraph.ports[1].boundarySides = ["south"]],
  ["unpaired downstream", i => i.nextPairing.pairs.pop()],
  ["wrong measured receiver", i => i.nextPairing.pairs[0].receiverCell++],
  ["wrong upstream return", i => i.nextPairing.pairs[0].neighborCandidateId = "unrelated"],
  ["wrong source intersection", i => i.nextPairing.pairs[0].sourceIntersection.y++],
  ["branch", i => i.neighborGraph.edges.push({ source: "in", target: "out" })],
  ["detached cycle", i => { i.neighborGraph.nodes.push({ nodeId: "other", upstreamExcludedCellCount: 0 });
    i.neighborGraph.edges.push({ source: "other", target: "other" }); }],
  ["source graph gap", i => i.neighborGraph.gaps.push({ code: "missing-source" })],
]) test(`paired projection fails closed for ${name}`, () => {
  const input = pairedFixture(); mutate(input); assert.throws(() => projectMeasuredNeighborChannelPair(input));
});

function seamFixture() {
  const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  const left = [rect(10, 30, 54, 12)], right = [rect(0, 30, 38, 12), rect(26, 0, 12, 36)];
  return { upstream: { canvas: { width: 64, height: 64 }, waterPolygons: left, shorelinePolygons: structuredClone(left) },
    neighbor: { canvas: { width: 64, height: 64 }, waterPolygons: right, shorelinePolygons: structuredClone(right) } };
}

let completeJointTemplate;
function completeJointFixture() {
  if (completeJointTemplate) return structuredClone(completeJointTemplate);
  const input = pairedFixture(), joint = projectMeasuredNeighborChannelPair(input), f = spatialFixture();
  const upstreamProjection = input.upstreamProjection, p = f.proposal, g = p.geometry;
  const connectivity = bindProjectedWaterConnectivity(f.connectivity, upstreamProjection);
  const end = connectivity.edgePorts.find(p => p.kind === "path" && p.regionId === f.proposal.regionId).boundaryPosition;
  const rect = [{ x: 350, y: end.y - 9 }, { x: 1024, y: end.y - 9 }, { x: 1024, y: end.y + 9 }, { x: 350, y: end.y + 9 }];
  g.waterCenterline = structuredClone(upstreamProjection.edges[0].centerline);
  g.waterHalfWidths = structuredClone(upstreamProjection.edges[0].halfWidths);
  g.terrainRegions = [...g.terrainRegions.filter(r => !["water", "shoreline", "path_ground"].includes(r.kind)),
    ...upstreamProjection.waterPolygons.map(polygon => ({ kind: "water", polygon })),
    ...upstreamProjection.shorelinePolygons.map(polygon => ({ kind: "shoreline", polygon })), { kind: "path_ground", polygon: rect }];
  g.walkableRegions = [{ polygon: rect }]; g.pathCenterline = [{ x: 350, y: end.y }, structuredClone(end)];
  g.entranceBounds = { x: 972, y: end.y - 42, width: 52, height: 84 };
  g.geometryDerivation = { methodId: "old-layout-method", coarseHydrologyMainChannelFamily: "old-layout-water-family",
    macroTopologySource: "old-layout-source", historicalRgbRead: false, seedFingerprint: "a".repeat(64) };
  p.worldId = "synthetic-world"; p.worldFacts = { worldId: p.worldId, regionId: p.regionId,
    worldFactSetId: "synthetic-world-facts", status: "unpublished_measurement_derived_world_facts_proposal" };
  completeJointTemplate = { ...finalizeMeasuredGeometryConnectivity(connectivity, p), upstreamProjection, joint,
    programBindings: [{ path: "synthetic/program.mjs", sha256: "a".repeat(64) }], createdAtUtc: "2026-09-07T00:00:00.000Z" };
  return structuredClone(completeJointTemplate);
}

let neighborConnectivityTemplate;
function neighborConnectivityFixture() {
  if (neighborConnectivityTemplate) return structuredClone(neighborConnectivityTemplate);
  const f = completeJointFixture(), upstream = rebindJointWaterCompleteGeometry(f);
  const c = structuredClone(f.connectivity), regionId = upstream.waterProjection.neighborId;
  c.currentRegion.regionId = regionId;
  c.edgePorts = [{ kind: "path", regionId, boundarySide: "west", edgePortId: `${regionId}:path-west` }];
  c.pathGraph.nodes = [c.pathGraph.edges[0].source, `${regionId}:path-west`];
  c.pathGraph.edges[0].target = `${regionId}:path-west`;
  c.anonymousTrainingCoordinateProjection.pathPlan.boundarySide = "west";
  delete c.connectivityInstanceSha256; c.connectivityInstanceSha256 = canonicalSha256(c);
  neighborConnectivityTemplate = { connectivity: c, upstream, joint: f.joint };
  return structuredClone(neighborConnectivityTemplate);
}

let pathPairTemplate;
function pathPairFixture() {
  if (pathPairTemplate) return structuredClone(pathPairTemplate);
  const f = neighborConnectivityFixture(), prepared = bindMeasuredNeighborConnectivity(f), p = spatialFixture().proposal;
  const g = p.geometry, regionId = prepared.connectivity.currentRegion.regionId;
  p.regionId = regionId; p.worldId = f.upstream.proposal.worldId;
  p.worldFacts = { regionId, worldId: p.worldId, worldFactSetId: "synthetic-neighbor-facts" };
  const end = prepared.connectivity.anonymousTrainingCoordinateProjection.pathPlan.boundaryPosition;
  g.pathCenterline = [{ x: 420, y: end.y }, structuredClone(end)];
  const poly = [{ x: 420, y: end.y - 20 }, { x: 0, y: end.y - 20 }, { x: 0, y: end.y + 20 }, { x: 420, y: end.y + 20 }];
  const boundary = [{ x: 984, y: 0 }, { x: 1024, y: 0 }, { x: 1024, y: 768 }, { x: 984, y: 768 }];
  g.terrainRegions = [...g.terrainRegions.filter(r => !["water", "shoreline", "path_ground", "natural_boundary"].includes(r.kind)),
    ...prepared.waterProjection.waterPolygons.map(polygon => ({ kind: "water", polygon })),
    ...prepared.waterProjection.shorelinePolygons.map(polygon => ({ kind: "shoreline", polygon })),
    { kind: "path_ground", polygon: poly }, { kind: "natural_boundary", polygon: boundary }];
  g.walkableRegions = [{ polygon: poly }]; g.collisionRegions = [{ polygon: boundary }];
  g.waterCenterline = structuredClone(prepared.waterProjection.edges[0].centerline);
  g.entranceBounds = { x: 0, y: end.y - 42, width: 52, height: 84 };
  g.geometryDerivation = describeMeasuredWaterDerivation({ base: {}, projection: prepared.waterProjection });
  const neighbor = { ...finalizeMeasuredGeometryConnectivity(prepared.connectivity, p), waterProjection: prepared.waterProjection };
  pathPairTemplate = { upstream: f.upstream, neighbor,
    programBindings: [{ path: "synthetic/path-pair.mjs", sha256: "e".repeat(64) }], createdAtUtc: "2026-09-07T00:00:00.000Z" };
  return structuredClone(pathPairTemplate);
}

let resolvedPathPairTemplate;
test("actual path pair repairs existing caps, binds both real regions and retains explicit blocked downstream", () => {
  const f = pathPairFixture(), before = JSON.stringify(f);
  assert.throws(() => auditMeasuredPathSeam(f.upstream, f.neighbor));
  const r = resolveMeasuredNeighborPathPair(f); resolvedPathPairTemplate = structuredClone(r);
  assert.equal(JSON.stringify(f), before); assert(r.audit.passed && r.audit.sharedEdgePixelPairs > 0);
  assert.equal(r.audit.combinedPathComponentCount, 1);
  for (const [v, old] of [[r.upstream, f.upstream], [r.neighbor, f.neighbor]]) {
    assert.deepEqual(v.proposal.geometry.pathCenterline, old.proposal.geometry.pathCenterline);
    assert.deepEqual(v.waterProjection, old.waterProjection);
    assert.deepEqual(v.proposal.geometry.objectFootprints, old.proposal.geometry.objectFootprints);
    assert.deepEqual(v.proposal.geometry.collisionRegions, old.proposal.geometry.collisionRegions);
    assert.equal(v.proposal.geometry.routeWaterAvoidanceAudit.evaluatedAttemptCount, 1);
    assert.equal(v.connectivity.identityBoundary.currentRegionWorldGraphConnected, false);
    assert.equal(v.proposal.outputBoundary.trainingAllowed, false);
  }
  assert(r.neighbor.connectivity.edgePorts.some(p => p.state === "blocked_pending_actual_neighbor_geometry"));
  assert(!r.upstream.connectivity.edgePorts.some(p => p.role === "paired_neighbor_stub"));
  assert.equal(r.outputBoundary.countsAsAdditionalSample, false);
});

for (const [name, mutate] of [
  ["different world", f => f.neighbor.proposal.worldId = "another-world"],
  ["wrong joint surface", f => f.neighbor.waterProjection.jointProjectionSha256 = "f".repeat(64)],
  ["missing program binding", f => f.programBindings = []],
  ["unsupported ribbon representation", f => f.upstream.proposal.geometry.pathCenterline.push({ x: 1024, y: 0 })],
]) test(`path repair rejects ${name}`, () => {
  const f = pathPairFixture(); mutate(f); assert.throws(() => resolveMeasuredNeighborPathPair(f));
});

for (const [name, mutate] of [
  ["remaining stub", r => r.upstream.connectivity.edgePorts.find(p => p.kind === "path" && p.regionId === r.upstream.proposal.regionId).connectsToRegionId = "stub"],
  ["false width", r => r.neighbor.connectivity.edgePorts.find(p => p.kind === "path" && p.regionId === r.neighbor.proposal.regionId).width++],
  ["stale WorldFacts", r => r.upstream.proposal.worldFacts.pathPairRevisionBinding.pathPairRevisionIdentity = "f".repeat(64)],
  ["missing native walkability", r => r.neighbor.proposal.geometry.walkableRegions = []],
  ["changed pair identity", r => r.upstream.proposal.pathPairRevision.identityPayload.halfWidth++],
]) test(`path seam audit rejects ${name}`, () => {
  resolvedPathPairTemplate ??= resolveMeasuredNeighborPathPair(pathPairFixture());
  const r = structuredClone(resolvedPathPairTemplate); mutate(r); assert.throws(() => auditMeasuredPathSeam(r.upstream, r.neighbor));
});

test("actual neighbor binds measured west-in/north-out water and the existing path endpoint without creating split membership", () => {
  const f = neighborConnectivityFixture(), before = JSON.stringify(f), r = bindMeasuredNeighborConnectivity(f);
  assert.equal(JSON.stringify(f), before);
  assert.equal(r.waterProjection.candidateId, f.joint.neighborCandidateId);
  assert.equal(r.waterProjection.schemaVersion, "measured-joint-through-channel-projection-proposal-v1");
  assert.deepEqual(r.waterProjection.waterPolygons, f.joint.neighbor.waterPolygons);
  assert.deepEqual(r.waterProjection.shorelinePolygons, f.joint.neighbor.shorelinePolygons);
  const c = r.connectivity, regionId = c.currentRegion.regionId;
  const ports = c.edgePorts.filter(p => p.kind === "water" && p.regionId === regionId);
  assert.deepEqual(ports.map(p => [p.boundarySide, p.flowRole]), [["west", "inlet"], ["north", "outlet"]]);
  assert.equal(c.hydrologyGraph.mode, "measured_external_inlet_to_external_outlet");
  assert.equal(c.anonymousTrainingCoordinateProjection.pathPlan.boundaryPosition.y,
    f.upstream.proposal.geometry.pathCenterline.at(-1).y);
  assert(c.edgePorts.some(p => p.state === "blocked_pending_actual_neighbor_geometry"));
  assert.equal(c.realEarthRegionSourcePackageId, null, "upstream window source package must not impersonate neighbor");
  assert.equal(c.walkableGraph.connected, false);
  assert.equal(c.identityBoundary.currentRegionWorldGraphConnected, false);
  assert.equal(r.waterProjection.outputBoundary.countsAsAdditionalSample, false);
  assert.equal(r.waterProjection.outputBoundary.trainingAllowed, false);
  assert.equal(describeMeasuredWaterDerivation({ base: {}, projection: r.waterProjection }).activeWaterGeometry.sourceGraphIdentity,
    f.joint.neighborGraphIdentity);
});

for (const [name, mutate] of [
  ["changed joint bytes", f => f.joint.neighbor.centerline[1].x++],
  ["wrong upstream version", f => f.upstream.waterProjection.jointProjectionSha256 = "f".repeat(64)],
  ["neighbor input hash corruption", f => f.connectivity.connectivityInstanceSha256 = "f".repeat(64)],
  ["wrong neighbor identity", f => { f.connectivity.currentRegion.regionId = "unrelated";
    delete f.connectivity.connectivityInstanceSha256; f.connectivity.connectivityInstanceSha256 = canonicalSha256(f.connectivity); }],
  ["wrong path side", f => { f.connectivity.edgePorts[0].boundarySide = "south";
    delete f.connectivity.connectivityInstanceSha256; f.connectivity.connectivityInstanceSha256 = canonicalSha256(f.connectivity); }],
  ["missing upstream walkability", f => f.upstream.proposal.geometry.walkableRegions = []],
]) test(`neighbor connectivity rejects ${name}`, () => {
  const f = neighborConnectivityFixture(); mutate(f); assert.throws(() => bindMeasuredNeighborConnectivity(f));
});

test("complete geometry rebind preserves one logical map, replaces active water identity and rechecks only the retained route", () => {
  const input = completeJointFixture(), before = JSON.stringify(input), r = rebindJointWaterCompleteGeometry(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(rebindJointWaterCompleteGeometry(input), r);
  assert.equal(r.proposal.worldId, input.proposal.worldId); assert.equal(r.proposal.regionId, input.proposal.regionId);
  assert.notEqual(r.proposal.worldFacts.worldFactSetId, input.proposal.worldFacts.worldFactSetId);
  assert.equal(r.revision.countsAsAdditionalSample, false);
  assert.deepEqual(r.proposal.geometry.pathCenterline, input.proposal.geometry.pathCenterline);
  assert.deepEqual(r.proposal.geometry.objectFootprints, input.proposal.geometry.objectFootprints);
  assert.deepEqual(r.proposal.geometry.collisionRegions, input.proposal.geometry.collisionRegions);
  assert.deepEqual(r.proposal.geometry.terrainRegions.filter(x => !["water", "shoreline"].includes(x.kind)),
    input.proposal.geometry.terrainRegions.filter(x => !["water", "shoreline"].includes(x.kind)));
  assert.equal(r.proposal.structuralIdentities.themeArchitectureIdentity, input.proposal.structuralIdentities.themeArchitectureIdentity);
  assert.notEqual(r.proposal.structuralIdentities.instanceDetailIdentity, input.proposal.structuralIdentities.instanceDetailIdentity);
  assert.equal(r.proposal.geometry.routeWaterAvoidanceAudit.evaluatedAttemptCount, 1);
  assert.equal(r.proposal.geometry.geometryDerivation.coarseHydrologyMainChannelFamily, undefined);
  assert.equal(r.proposal.geometry.geometryDerivation.baseLayoutProvenance.coarseHydrologyMainChannelFamily, "old-layout-water-family");
  assert.equal(r.proposal.geometry.geometryDerivation.activeWaterGeometry.projectionSha256, r.waterProjection.projectionSha256);
  assert(r.nativeSpatialAudit.localSpatialPassed); assert.equal(r.outputBoundary.trainingAllowed, false);
});

test("measured water lineage is explicit while the legacy path stays byte-for-byte unchanged", () => {
  const base = { methodId: "legacy", internalHydrologyFamily: "old-family", coarseHydrologyMainChannelProfileSha256: "b".repeat(64), historicalRgbRead: false };
  assert.equal(describeMeasuredWaterDerivation({ base, projection: null }), base);
  const projection = projectMeasuredSingleChannel(fixture()), result = describeMeasuredWaterDerivation({ base, projection });
  assert.equal(result.internalHydrologyFamily, undefined);
  assert.equal(result.baseLayoutProvenance.internalHydrologyFamily, "old-family");
  assert.equal(result.activeWaterGeometry.projectionSha256, projection.projectionSha256);
  assert.equal(base.internalHydrologyFamily, "old-family");
  projection.waterPolygons[0][0].x++;
  assert.throws(() => describeMeasuredWaterDerivation({ base, projection }), /identity mismatch/);
});

for (const [name, mutate] of [
  ["missing program binding", f => f.programBindings = []],
  ["duplicate program binding", f => f.programBindings.push(structuredClone(f.programBindings[0]))],
  ["invalid time", f => f.createdAtUtc = "not-a-time"],
  ["world mismatch", f => f.proposal.worldFacts.worldId = "another-world"],
  ["already revised base", f => f.proposal.geometryRevisionIdentity = "a".repeat(64)],
  ["tampered joint geometry", f => f.joint.upstream.waterPolygons[0][0].x++],
]) test(`complete rebind rejects ${name}`, () => {
  const f = completeJointFixture(); mutate(f); assert.throws(() => rebindJointWaterCompleteGeometry(f));
});

let reboundTemplate;
for (const [name, mutate] of [
  ["mismatched revision", r => r.proposal.geometryRevisionIdentity = "b".repeat(64)],
  ["altered revision payload", r => r.proposal.geometryRevision.identityPayload.baseProposalSha256 = "b".repeat(64)],
  ["stale WorldFacts binding", r => r.proposal.worldFacts.geometryRevisionBinding.waterProjectionSha256 = "b".repeat(64)],
  ["stale active water metadata", r => r.proposal.geometry.geometryDerivation.activeWaterGeometry.projectionSha256 = "b".repeat(64)],
  ["stale water polygon digest", r => r.proposal.geometry.geometryDerivation.activeWaterGeometry.waterPolygonsSha256 = "b".repeat(64)],
  ["stale main channel binding", r => r.proposal.geometry.mainChannelSelection.projectionSha256 = "b".repeat(64)],
  ["stale route binding", r => r.proposal.geometry.routeWaterAvoidanceAudit.waterProjectionSha256 = "b".repeat(64)],
  ["historical search counts", r => Object.assign(r.proposal.geometry.routeWaterAvoidanceAudit,
    { evaluatedAttemptCount: 156, passingCandidateCount: 101, rejectedCandidateCount: 55 })],
  ["stale structural identity", r => r.proposal.structuralIdentities.instanceDetailIdentity = "b".repeat(64)],
]) test(`rebound native audit rejects ${name} even though water/path pixels are unchanged`, () => {
  reboundTemplate ??= rebindJointWaterCompleteGeometry(completeJointFixture());
  const r = structuredClone(reboundTemplate); mutate(r);
  assert.throws(() => auditMeasuredGeometrySpatial(r.proposal, r.connectivity, r.waterProjection));
});
test("native seam is recomputed from actual water polygons rather than declared port spans", () => {
  const input = seamFixture(); assert(auditProjectedNeighborWaterSeam(input.upstream, input.neighbor).passed);
  input.neighbor.waterBoundarySpan = [30, 42];
  for (const p of input.neighbor.waterPolygons[0]) if (p.y === 42) p.y--;
  assert.throws(() => auditProjectedNeighborWaterSeam(input.upstream, input.neighbor), /intervals differ/);
});

test("joint surface impact rechecks actual upstream path, preserving frame contract metadata and detecting new overlap", () => {
  const input = pairedFixture(), joint = projectMeasuredNeighborChannelPair(input), { proposal } = spatialFixture();
  const upstream = input.upstreamProjection, g = proposal.geometry;
  g.worldFrameContract.frameCoverage.everyPixelMustResolveToInWorldSurfaceOrInWorldObject = true;
  g.waterCenterline = structuredClone(upstream.edges[0].centerline);
  const path = [{ x: 350, y: 100 }, { x: 1024, y: 100 }, { x: 1024, y: 118 }, { x: 350, y: 118 }];
  g.terrainRegions = [...g.terrainRegions.filter(r => !["water", "shoreline", "path_ground"].includes(r.kind)),
    ...upstream.waterPolygons.map(polygon => ({ kind: "water", polygon })),
    ...upstream.shorelinePolygons.map(polygon => ({ kind: "shoreline", polygon })), { kind: "path_ground", polygon: path }];
  g.walkableRegions = [{ polygon: path }]; g.pathCenterline = [{ x: 350, y: 109 }, { x: 1024, y: 109 }];
  const before = JSON.stringify(proposal), result = auditJointWaterAgainstUpstreamGeometry(proposal, joint, upstream);
  assert.equal(JSON.stringify(proposal), before);
  assert(result.passed); assert(result.changedWaterPixels > 0); assert.equal(result.outputBoundary.trainingAllowed, false);
  g.terrainRegions.push(...joint.upstream.waterPolygons.map(polygon => ({ kind: "path_ground", polygon })));
  const failed = auditJointWaterAgainstUpstreamGeometry(proposal, joint, upstream);
  assert.equal(failed.passed, false); assert(failed.issues.includes("route_overlaps_joint_water"));
  const changed = structuredClone(joint); changed.neighbor.centerline[1].x++;
  assert.throws(() => auditJointWaterAgainstUpstreamGeometry(proposal, changed, upstream), /joint projection identity mismatch/);
  proposal.outputBoundary.trainingAllowed = true;
  assert.throws(() => auditJointWaterAgainstUpstreamGeometry(proposal, joint, upstream));
});
for (const [name, mutate] of [
  ["canvas mismatch", i => i.neighbor.canvas.height++],
  ["extra boundary", i => i.neighbor.waterPolygons[0][1].x = 64],
  ["undeclared native edge without exact vector contact", i => {
    i.upstream.waterPolygons[0][0].x = 0.1; i.upstream.waterPolygons[0][3].x = 0.1; }],
  ["detached puddle", i => i.neighbor.waterPolygons.push([{ x: 50, y: 50 }, { x: 54, y: 50 }, { x: 54, y: 54 }, { x: 50, y: 54 }])],
  ["shoreline not covering water", i => i.neighbor.shorelinePolygons[1][2].x = 30],
  ["zero area", i => i.upstream.waterPolygons.push([{ x: 5, y: 5 }, { x: 6, y: 6 }, { x: 7, y: 7 }])],
  ["nonfinite coordinate", i => i.neighbor.waterPolygons[0][0].x = NaN],
  ["missing north continuation", i => i.neighbor.waterPolygons.pop()],
]) test(`native seam rejects ${name}`, () => {
  const input = seamFixture(); mutate(input); assert.throws(() => auditProjectedNeighborWaterSeam(input.upstream, input.neighbor));
});

test("file-backed historical RGB rechecks bytes and records reads even with a cached fingerprint", async t => {
  const file = temporaryRgbFile(t), { historicalRgbBytes: bytes } = await rgbWaterFixture(), receipts = [];
  const hash = createHash("sha256").update(bytes).digest("hex");
  fs.writeFileSync(file, bytes, { flag: "wx" });
  const first = await fingerprintHistoricalRgbWater(file, hash, r => receipts.push(r));
  const second = await fingerprintHistoricalRgbWater(file, hash, r => receipts.push(r));
  assert(first.pixelCount > 0); assert.deepEqual(first, second);
  assert.equal(receipts.length, 2);
  assert(receipts.every(r => r.sha256MatchesRecord && r.sha256 === hash && r.expectedSha256 === hash && r.byteLength === bytes.length));
});

test("same-path RGB replacement rejects the old binding and cannot reuse its cached water shape", async t => {
  const file = temporaryRgbFile(t), { historicalRgbBytes: bytes } = await rgbWaterFixture();
  const digest = b => createHash("sha256").update(b).digest("hex"), reads = [];
  fs.writeFileSync(file, bytes, { flag: "wx" });
  assert((await fingerprintHistoricalRgbWater(file, digest(bytes))).pixelCount > 0);
  const dry = await sharp({ create: { width: 256, height: 192, channels: 3,
    background: { r: 102, g: 155, b: 72 } } }).png().toBuffer();
  fs.writeFileSync(file, dry);
  await assert.rejects(fingerprintHistoricalRgbWater(file, digest(bytes), r => reads.push(r)), /SHA binding mismatch/);
  assert.equal(reads.length, 1); assert.equal(reads[0].sha256MatchesRecord, false); assert.equal(reads[0].sha256, digest(dry));
  assert.equal((await fingerprintHistoricalRgbWater(file, digest(dry))).pixelCount, 0);
  await assert.rejects(fingerprintHistoricalRgbWater(file, undefined), /SHA binding missing/);
  fs.writeFileSync(file, "broken");
  await assert.rejects(fingerprintHistoricalRgbWater(file, digest(Buffer.from("broken"))));
});
