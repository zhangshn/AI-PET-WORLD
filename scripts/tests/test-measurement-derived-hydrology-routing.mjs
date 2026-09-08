import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { deriveNaturalHydrology } from "../build-earth-geospatial-soil-hydrology.mjs";
import { validateD8Routing, segmentWindowCrossings, analyzeWindowHydrology, replayBoundHydrology,
  accumulateUpstreamExclusions, deriveWindowHydrologyGraph, pairMeasuredHydrologyPorts, traceMeasuredDownstream,
  replayNaturalLandCover, replayBoundNaturalization, auditMeasuredSourceElevations } from "../lib/measurement-derived-hydrology-routing.mjs";

function routing() {
  return { width: 3, height: 3, receiver: Int32Array.from([1, 2, -1, 4, 5, -1, 7, 8, -1]),
    filledElevation: Float32Array.from([3, 2, 1, 3, 2, 1, 3, 2, 1]),
    accumulation: Uint32Array.from([1, 2, 3, 1, 2, 3, 1, 2, 3]), drainageLikelihood: new Uint8Array(9).fill(255) };
}

test("routing is independently accumulated and conserves all source cells", () => {
  assert.deepEqual(validateD8Routing(routing()), { cellCount: 9, outletCount: 3, outletCellTotal: 9,
    acyclic: true, accumulationIndependentlyRecomputed: true });
});

function elevationFixture() {
  const source = { routing: routing(), sourceGrid: { width: 12, height: 12 }, excludedCells: new Uint8Array(9), threshold: 180 };
  return { ...source, graph: deriveWindowHydrologyGraph({ ...source, sourceWindow: { left: 0, top: 0, width: 8, height: 12 } }) };
}
test("source boundary elevations interpolate the actual D8 edge without claiming surveyed water heights", () => {
  const f = elevationFixture(), before = structuredClone(f), r = auditMeasuredSourceElevations(f);
  assert.deepEqual(f, before); assert(r.sourceGraphComplete && r.retainedEdgesNonIncreasing);
  assert(r.nodes.filter(n => n.method === "linear_boundary_interpolation_between_derived_cells")
    .every(n => n.interpolationFraction === 0.5 && n.elevationMetres === 1.5));
  assert.equal(r.gameHeightFieldCreated, false); assert.equal(r.worldFactsQualified, false); assert.equal(r.trainingAllowed, false);
});
test("flat source edges remain flat rather than inventing a positive water drop", () => {
  const f = elevationFixture(); f.routing.filledElevation.fill(3);
  f.graph = deriveWindowHydrologyGraph({ ...f, sourceWindow: f.graph.sourceWindow });
  const r = auditMeasuredSourceElevations(f);
  assert.equal(r.zeroDropEdges, r.edges.length); assert(r.nodes.every(n => n.elevationMetres === 3));
});
test("source graph gaps remain blocked even when every retained elevation edge is downhill", () => {
  const f = elevationFixture(); f.excludedCells[1] = 1;
  f.graph = deriveWindowHydrologyGraph({ ...f, sourceWindow: f.graph.sourceWindow });
  const r = auditMeasuredSourceElevations(f);
  assert(r.retainedEdgesNonIncreasing); assert.equal(r.sourceGraphComplete, false);
  assert(r.gaps.some(g => g.code === "supported_channel_ends_without_boundary_outlet"));
});
for (const [name, mutate] of [
  ["stale graph elevation", f => f.graph.nodes.find(n => n.filledElevation !== undefined).filledElevation++],
  ["forged source port", f => f.graph.ports[0].point.x++],
  ["uphill routing", f => f.routing.filledElevation[1] = 4],
  ["false no-gap claim", f => f.graph.gaps.push({ code: "invented" })],
]) test(`source elevation audit rejects ${name}`, () => {
  const f = elevationFixture(); mutate(f); assert.throws(() => auditMeasuredSourceElevations(f));
});

test("naturalization replay preserves unexcluded natural water and uses deterministic natural-class ties", () => {
  const raw = Uint8Array.from([10, 40, 80]), mask = Uint8Array.from([0, 255, 0]);
  const result = replayNaturalLandCover(raw, mask, 3, 1);
  assert.deepEqual([...result.values], [10, 10, 80]); assert.deepEqual([...raw], [10, 40, 80]);
  assert.equal(result.reconstructed, 1); assert.equal(result.maximumDistancePixels, 1);
  assert.throws(() => replayNaturalLandCover(raw, new Uint8Array(3), 3, 1), /not excluded/);
  assert.throws(() => replayNaturalLandCover(raw, new Uint8Array(3).fill(255), 3, 1), /no natural source/);
  assert.throws(() => replayNaturalLandCover(raw, Uint8Array.from([0, 128, 0]), 3, 1), /mask values/);
  assert.throws(() => replayNaturalLandCover(raw, mask, 4, 1), /input/);
});

function naturalizationFixture({ badMask = false, badOutput = false, badStatistics = false } = {}) {
  const files = new Map(), hash = b => createHash("sha256").update(b).digest("hex");
  const put = (p, b) => { files.set(p, b); return { path: p, sha256: hash(b) }; };
  const json = (p, v) => put(p, Buffer.from(JSON.stringify(v))), gz = (p, v) => put(p, gzipSync(v));
  const size = 1024 * 768, raw = Buffer.alloc(size, 10), removed = Buffer.alloc(size), combined = Buffer.alloc(size);
  raw[5] = 40; removed[5] = badMask ? 0 : 1; combined[5] = 255;
  const natural = Buffer.alloc(size, 10); if (badOutput) natural[5] = 80;
  const observed = gz("data/observed.gz", raw), coverMask = gz("data/cover-mask.gz", removed);
  const empty = gz("data/empty.gz", Buffer.alloc(size));
  const measurement = json("data/measurement.json", { contractId: "fixture", rasterWindows: { landCover: { outputPath: observed.path, outputSha256: observed.sha256 } },
    humanRemoval: { removalMaskPath: coverMask.path, removalMaskSha256: coverMask.sha256 } });
  const removal = json("data/removal.json", { contractId: "fixture", masks: ["roads", "all_engineered"].map(category => ({ category, width: 1024, height: 768, ...empty })) });
  const lineage = json("data/lineage.json", { sourceArtifacts: [{ role: "measurement_window", ...measurement }, { role: "engineered_feature_removal", ...removal }] });
  const combinedBinding = gz("data/combined.gz", combined), output = gz("data/output.gz", natural);
  const run = json("data/run.json", { contractId: "fixture", lineagePath: lineage.path, lineageSha256: lineage.sha256,
    combinedHumanRemovalMaskPath: combinedBinding.path, combinedHumanRemovalMaskSha256: combinedBinding.sha256,
    reconstructedNaturalLandCoverPath: output.path, reconstructedNaturalLandCoverSha256: output.sha256,
    statistics: { reconstructedPixelCount: badStatistics ? 2 : 1, reconstructionMaximumDistancePixels: 1 } });
  const bytes = (p, expected) => { const b = files.get(p); assert.equal(hash(b), expected); return b; };
  return { naturalizedRunBinding: run, reader: { bytes, bound: b => JSON.parse(bytes(b.path, b.sha256)) } };
}
test("bound naturalization replays raw-class exclusion, mask unions and complete reconstruction", () => {
  const result = replayBoundNaturalization(naturalizationFixture());
  assert.equal(result.evidence.reconstructedPixelCount, 1); assert.equal(result.evidence.pixelCount, 786432);
  assert.equal(result.evidence.landCoverReconstructionReproduced, true);
  assert.equal(result.evidence.hydrologyNaturalizationQualified, false);
});
for (const flag of ["badMask", "badOutput", "badStatistics"]) test(`naturalization rejects correctly hashed inconsistent ${flag}`, () => {
  assert.throws(() => replayBoundNaturalization(naturalizationFixture({ [flag]: true })));
});
for (const [name, mutate, expected] of [
  ["non-neighbor", r => r.receiver[0] = 8, /not a D8 neighbor/],
  ["self loop", r => r.receiver[0] = 0, /invalid routing receiver/],
  ["outside grid", r => r.receiver[0] = 9, /invalid routing receiver/],
  ["interior sink", r => r.receiver[4] = -1, /interior sink/],
  ["uphill", r => r.filledElevation[1] = 4, /uphill/],
  ["non-finite elevation", r => r.filledElevation[0] = NaN, /non-finite/],
  ["wrong accumulation", r => r.accumulation[2] = 2, /accumulation mismatch/],
  ["equal-height cycle", r => { r.filledElevation.fill(1); r.receiver[1] = 0; }, /cycle/],
]) test(`rejects ${name}`, () => { const r = routing(); mutate(r); assert.throws(() => validateD8Routing(r), expected); });

const window = { left: 0, top: 0, width: 10, height: 10 };
test("eastward flow is west inlet/east outlet, not forced north/south", () => {
  assert.deepEqual(segmentWindowCrossings({ x: -2, y: 5 }, { x: 12, y: 5 }, window)
    .map(c => [c.role, c.boundarySides]), [["inlet", ["west"]], ["outlet", ["east"]]]);
});
test("diagonal southwest approach enters west when intersection is west", () => {
  const events = segmentWindowCrossings({ x: -1, y: 10.1 }, { x: 2, y: 8 }, window);
  assert.equal(events.length, 1); assert.deepEqual(events[0].boundarySides, ["west"]);
});
test("exact corner has two sides and is not silently assigned a port", () => {
  const [event] = segmentWindowCrossings({ x: -1, y: -1 }, { x: 2, y: 2 }, window);
  assert.deepEqual(event.boundarySides, ["west", "north"]); assert.equal(event.cornerAmbiguous, true);
});
test("boundary tangency and boundary-aligned flow do not enter the region", () => {
  assert.deepEqual(segmentWindowCrossings({ x: -1, y: 1 }, { x: 1, y: -1 }, window), []);
  assert.deepEqual(segmentWindowCrossings({ x: 0, y: -1 }, { x: 0, y: 11 }, window), []);
});
test("boundary-center event remains explicit; a fully interior segment has none", () => {
  assert.deepEqual(segmentWindowCrossings({ x: 0, y: 5 }, { x: 5, y: 5 }, window)
    .map(e => e.role), ["inlet"]);
  assert.deepEqual(segmentWindowCrossings({ x: 4, y: 5 }, { x: 6, y: 5 }, window), []);
});
test("two outside centers crossing a narrow region still yield two events", () => {
  assert.equal(segmentWindowCrossings({ x: 0, y: 5 }, { x: 4, y: 5 },
    { left: 1, top: 1, width: 1, height: 8 }).length, 2);
});
test("invalid windows and non-finite segments fail", () => {
  assert.throws(() => segmentWindowCrossings({ x: NaN, y: 0 }, { x: 1, y: 1 }, window));
  assert.throws(() => segmentWindowCrossings({ x: 0, y: 0 }, { x: 1, y: 1 }, { ...window, width: 0 }));
});

function analyzeInput() {
  return { routing: routing(), sourceGrid: { width: 3, height: 3 },
    sourceWindow: { left: 1, top: 0, width: 1, height: 3 }, excludedCells: new Uint8Array(9), threshold: 180 };
}

function traceInput() {
  return { ...analyzeInput(), startCell: 3, candidates: [
    { candidateId: "left", sourcePixelWindow: { left: 0, top: 0, width: 1, height: 3 } },
    { candidateId: "right", sourcePixelWindow: { left: 1, top: 0, width: 2, height: 3 } }] };
}
test("downstream diagnostic retains full cell lineage and does not grant region connectivity", () => {
  const input = traceInput(), before = JSON.stringify(input);
  const result = traceMeasuredDownstream(input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(result.cells.map(c => c.cell), [3, 4, 5]);
  assert.deepEqual(result.regionVisits.map(v => v.candidateId), ["left", "right"]);
  assert.equal(result.sourceMaskIsolationAlongTrace, true);
  assert.equal(result.endsAtAnalysisCell, 5); assert.equal(result.worldGraphConnected, false);
});
test("a clean source outlet does not hide later downstream footprint exposure", () => {
  const input = traceInput(); input.excludedCells[4] = 1;
  const result = traceMeasuredDownstream(input);
  assert.equal(result.cells[0].upstreamExcludedCellCount, 0);
  assert.equal(result.firstExposed.cell, 4); assert.equal(result.firstExposed.candidateId, "right");
  assert.equal(result.sourceMaskIsolationAlongTrace, false);
  assert.equal(result.worldFactsQualified, false);
  assert(result.interpretation.includes("not_a_new_zero_exposure_acceptance_policy"));
});
for (const [name, mutate] of [
  ["out-of-range start", i => i.startCell = 9],
  ["missing region", i => i.candidates.pop()],
  ["overlapping regions", i => i.candidates[0].sourcePixelWindow.width = 2],
  ["invalid window", i => i.candidates[0].sourcePixelWindow.width = Infinity],
  ["duplicate IDs", i => i.candidates[1].candidateId = "left"],
]) test(`downstream trace rejects ${name}`, () => { const input = traceInput(); mutate(input); assert.throws(() => traceMeasuredDownstream(input)); });
test("mask excludes supported crossings without hiding diagnostic crossings", () => {
  const input = analyzeInput(); input.excludedCells[4] = 1;
  const result = analyzeWindowHydrology(input);
  assert.equal(result.crossings.length, 6);
  assert.equal(result.crossings.filter(c => c.touchesRemovalMask).length, 2);
  assert.deepEqual(result.supportedBoundaryCounts, { inlets: 2, outlets: 2, ambiguousCorners: 0 });
  assert.equal(result.worldFactsQualified, false); assert.equal(result.anabranchEstablished, false);
});
test("source threshold remains diagnostic and does not create water facts", () => {
  const input = analyzeInput(); input.routing.drainageLikelihood.fill(179);
  const result = analyzeWindowHydrology(input);
  assert.equal(result.crossings.length, 6); assert.equal(result.supportedBoundaryCounts.inlets, 0);
  assert.equal(result.gameGeometryCreated, false);
});
test("invalid bounds, mask length and threshold fail closed", () => {
  for (const change of [i => i.sourceWindow.left = -1, i => i.sourceWindow.width = 10,
    i => i.excludedCells = new Uint8Array(1), i => i.threshold = 256]) {
    const input = analyzeInput(); change(input); assert.throws(() => analyzeWindowHydrology(input));
  }
});

test("upstream mask exposure is found even if the boundary cells are clear", () => {
  const r = routing(), mask = new Uint8Array(9); mask[0] = 1;
  assert.deepEqual([...accumulateUpstreamExclusions(r, mask)], [1, 1, 1, 0, 0, 0, 0, 0, 0]);
  const graph = deriveWindowHydrologyGraph({ ...analyzeInput(), excludedCells: mask });
  assert.equal(graph.sourceMaskIsolationVerified, false);
  assert(graph.gaps.some(g => g.code === "supported_network_upstream_intersects_removal_mask"));
});
function pairedInput() {
  const input = analyzeInput(), graph = deriveWindowHydrologyGraph(input);
  return { graph, routing: input.routing, sourceGrid: input.sourceGrid, candidateId: "center",
    candidates: [{ candidateId: "center", sourcePixelWindow: input.sourceWindow },
      { candidateId: "west", sourcePixelWindow: { left: 0, top: 0, width: 1, height: 3 } },
      { candidateId: "east", sourcePixelWindow: { left: 2, top: 0, width: 1, height: 3 } }] };
}
test("source graph retains measured edges, roots and ports without invented branches", () => {
  const { graph } = pairedInput();
  assert.equal(graph.nodes.length, 9); assert.equal(graph.edges.length, 6);
  assert.equal(graph.roots.length, 3); assert.equal(graph.confluences.length, 0);
  assert.equal(graph.sourceGraphContinuous, true); assert.equal(graph.sourceMaskIsolationVerified, true);
  assert.equal(graph.worldFactsQualified, false);
});
test("source ports pair against actual adjacent windows and reverse flow roles", () => {
  const result = pairMeasuredHydrologyPorts(pairedInput());
  assert.equal(result.pairs.length, 6); assert.equal(result.allSourcePortsPaired, true);
  for (const pair of result.pairs) {
    assert.deepEqual(pair.sourceIntersection, pair.neighborIntersection);
    assert.notEqual(pair.sourceRole, pair.neighborRole);
  }
  assert.equal(result.worldGraphConnected, false); assert.equal(result.pathConnectivityEstablished, false);
});
test("absent and overlapping neighbor candidates cannot become stub connections", () => {
  const absent = pairedInput(); absent.candidates = absent.candidates.filter(c => c.candidateId !== "east");
  assert.equal(pairMeasuredHydrologyPorts(absent).gaps.length, 3);
  const duplicate = pairedInput(); duplicate.candidates.push({ ...duplicate.candidates[2], candidateId: "east2" });
  assert.equal(pairMeasuredHydrologyPorts(duplicate).gaps.length, 3);
});
test("forged source crossing and changed receiver fail replay", () => {
  const input = pairedInput(); input.graph.ports[0].point.y += 0.1;
  assert.throws(() => pairMeasuredHydrologyPorts(input), /does not reproduce/);
  const changed = pairedInput(); changed.graph.ports[0].receiverCell = 8;
  assert.throws(() => pairMeasuredHydrologyPorts(changed), /routing edge/);
});
test("a center on the shared border pairs through consecutive routing edges", () => {
  const r = { width: 4, height: 3, receiver: Int32Array.from([1, 2, 3, -1, 5, 6, 7, -1, 9, 10, 11, -1]),
    filledElevation: Float32Array.from([4, 3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1]),
    accumulation: Uint32Array.from([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]), drainageLikelihood: new Uint8Array(12).fill(255) };
  const sourceGrid = { width: 8, height: 6 }, west = { left: 0, top: 0, width: 5, height: 6 },
    east = { left: 5, top: 0, width: 3, height: 6 };
  const candidates = [{ candidateId: "west", sourcePixelWindow: west }, { candidateId: "east", sourcePixelWindow: east }];
  for (const candidate of candidates) {
    const graph = deriveWindowHydrologyGraph({ routing: r, sourceGrid, sourceWindow: candidate.sourcePixelWindow,
      excludedCells: new Uint8Array(12), threshold: 180 });
    const result = pairMeasuredHydrologyPorts({ candidateId: candidate.candidateId, candidates, graph, routing: r, sourceGrid });
    assert.equal(result.pairs.length, 3); assert.equal(result.gaps.length, 0);
    for (const p of result.pairs) {
      assert.deepEqual(p.sourceIntersection, p.neighborIntersection);
      if (p.sourceRole === "outlet") assert.equal(p.receiverCell, p.neighborSourceCell);
      else assert.equal(p.sourceCell, p.neighborReceiverCell);
    }
  }
});
test("threshold breaks remain gaps instead of synthesized water connections", () => {
  const input = analyzeInput(); input.routing.drainageLikelihood[2] = 0;
  const graph = deriveWindowHydrologyGraph(input);
  assert.equal(graph.sourceGraphContinuous, false);
  assert(graph.gaps.some(g => g.code === "supported_channel_ends_without_boundary_outlet"));
});

test("flat, depressed and deterministic varying DEMs have valid replay routing", () => {
  for (let seed = 0; seed < 16; seed++) {
    const elevation = Float32Array.from({ length: 99 }, (_, i) => seed === 0 ? 1 :
      seed === 1 ? (i === 49 ? -10 : 1) : ((i * 7919 + seed * 131) % 997) / 10);
    const before = new Float32Array(elevation);
    const legacy = deriveNaturalHydrology(elevation, 11, 9);
    const replay = deriveNaturalHydrology(elevation, 11, 9, { includeRouting: true });
    const { receiver, floodOrder, ...unchanged } = replay;
    assert.deepEqual(unchanged, legacy); assert.deepEqual(elevation, before);
    assert.equal(new Set(floodOrder).size, 99);
    assert.equal(validateD8Routing({ ...replay, width: 11, height: 9 }).outletCellTotal, 99);
  }
});
test("numeric derivation rejects malformed data and flags", () => {
  assert.throws(() => deriveNaturalHydrology([1, 2, 3, 4], 2, 2));
  assert.throws(() => deriveNaturalHydrology(new Float32Array(4).fill(Infinity), 2, 2));
  assert.throws(() => deriveNaturalHydrology(new Float32Array(4), 2, 2, { includeRouting: 1 }));
});

function boundSourceFixture({ mutateHydrology = () => {}, corruptArray = false } = {}) {
  const files = new Map(), hash = b => createHash("sha256").update(b).digest("hex");
  const put = (path, bytes) => { files.set(path, bytes); return { path, sha256: hash(bytes) }; };
  const json = (path, value) => put(path, Buffer.from(JSON.stringify(value)));
  const elevation = new Float32Array(256 * 192).fill(1);
  const derived = deriveNaturalHydrology(elevation, 256, 192);
  const h = { method: "Priority-Flood plus D8", analysisGrid: { width: 256, height: 192 }, statistics: derived.statistics };
  for (const [key, array] of Object.entries({ elevation, filledElevation: derived.filledElevation,
    slope: derived.slope, accumulation: derived.accumulation, drainageLikelihood: derived.drainageLikelihood })) {
    const bytes = Buffer.alloc(array.byteLength);
    for (let i = 0; i < array.length; i++) {
      if (array instanceof Float32Array) bytes.writeFloatLE(array[i], i * 4);
      else if (array instanceof Uint32Array) bytes.writeUInt32LE(array[i], i * 4);
      else bytes[i] = array[i];
    }
    if (corruptArray && key === "accumulation") bytes.writeUInt32LE(0, 0);
    const binding = put(`data/${key}.gz`, gzipSync(bytes));
    h[`${key}Path`] = binding.path; h[`${key}Sha256`] = binding.sha256;
  }
  mutateHydrology(h);
  const hydro = json("data/hydro.json", { naturalHydrology: h });
  const removal = json("data/removal.json", { status: "engineered_feature_removal_evidence_compiled",
    evidenceContract: { finalWorldGeometryMustBeReconstructed: true, prohibitedUses: ["final_world_fact_geometry"] } });
  const lineage = json("data/lineage.json", { sourceArtifacts: [
    { ...hydro, role: "soil_and_natural_hydrology" }, { ...removal, role: "engineered_feature_removal" }] });
  const mask = put("data/mask.gz", gzipSync(Buffer.alloc(1024 * 768)));
  const run = json("data/run.json", { lineagePath: lineage.path, lineageSha256: lineage.sha256,
    combinedHumanRemovalMaskPath: mask.path, combinedHumanRemovalMaskSha256: mask.sha256 });
  const bytes = (p, expected) => { assert(files.has(p), "missing bound fixture file");
    const b = files.get(p); assert.equal(hash(b), expected, "fixture hash mismatch"); return b; };
  return { reader: { bytes, bound: b => JSON.parse(bytes(b.path, b.sha256)) }, naturalizedRunBinding: run, files };
}
test("bound replay reproduces four rasters and checks all cells independently", () => {
  const result = replayBoundHydrology(boundSourceFixture());
  assert.equal(Object.keys(result.evidence.reproducedArrayHashes).length, 4);
  assert.equal(result.evidence.validation.outletCellTotal, 49152);
  assert.equal(result.threshold, 180);
});
test("correctly hashed but inconsistent source raster is not accepted", () => {
  assert.throws(() => replayBoundHydrology(boundSourceFixture({ corruptArray: true })), /does not reproduce:accumulation/);
});
test("wrong source bytes, grid and diagnostic threshold fail", () => {
  const fixture = boundSourceFixture(); fixture.files.set("data/mask.gz", Buffer.from("altered"));
  assert.throws(() => replayBoundHydrology(fixture), /hash mismatch/);
  assert.throws(() => replayBoundHydrology(boundSourceFixture({ mutateHydrology: h => h.analysisGrid.width = 255 })), /unsupported/);
  assert.throws(() => replayBoundHydrology(boundSourceFixture({ mutateHydrology: h => h.statistics.drainageLikelihoodThreshold = 179 })), /threshold mismatch/);
});
test("importing source derivation performs no fetch, subprocess or file writes", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-routing-import-test-"));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert(path.basename(root).startsWith("ai-painter-routing-import-test-"));
    fs.rmSync(root, { recursive: true });
  });
  const url = new URL("../build-earth-geospatial-soil-hydrology.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import fs from 'node:fs'; import cp from 'node:child_process'; import {syncBuiltinESMExports} from 'node:module';
    const stop=()=>{throw Error('import attempted an external effect')};
    for(const k of ['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync'])fs[k]=stop;
    for(const k of ['execFileSync','execSync','spawn','spawnSync'])cp[k]=stop;
    globalThis.fetch=stop; syncBuiltinESMExports(); await import(${JSON.stringify(url)});
  `], { cwd: root, encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(fs.readdirSync(root), []);
});
