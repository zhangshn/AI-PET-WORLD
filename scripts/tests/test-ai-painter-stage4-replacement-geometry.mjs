import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { assertReplacementCandidate, assertHistoricalTaskBinding, extractReplacementDeclaredGeometry,
  compareReplacementDeclaredGeometry, assertBoundHydrologyReplay } from "../prepare-ai-painter-stage4-replacement-geometry.mjs";
import { sha256 } from "../lib/ai-painter-stage4-dataset-audit.mjs";
import { buildIndependentTrainingRegionConnectivity } from "../lib/real-earth-region-governance.mjs";

const report = () => ({ schemaVersion: "ai-painter-stage4-replacement-window-prereview-v1",
  status: "source_screened_structural_preflight_required", qualification: { trainingAllowed: false, preRgbPassed: false },
  candidateProfiles: [{ candidateId: "measured-candidate" }] });

for (const extra of ["--review-neighbor-geometry", "--rebind-joint-water", "--measured-water"])
  test(`source boundary CLI rejects mixed execution ${extra} before opening inputs or writing artifacts`, () => {
    const r = spawnSync(process.execPath, ["scripts/prepare-ai-painter-stage4-replacement-geometry.mjs",
      "--review-source-boundary", extra, "--report", "must-not-be-opened.json", "--report-sha256", "a".repeat(64), "--write"],
    { encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.equal(r.status, 1); assert.match(r.stderr, /source boundary review requires one explicit completed pair report/);
    assert(!r.stderr.includes("ENOENT"));
  });
test("source replay checks the bound envelope's graph, arrays and required pairing separately", () => {
  const sourceGraph = { schemaVersion: "synthetic-graph", nodes: [{ nodeId: "one" }] }, evidence = { rasterSha256: "a".repeat(64) };
  const stored = { sourceGraph, evidence, neighborPairing: { pairs: [] } };
  assertBoundHydrologyReplay(stored, sourceGraph, evidence);
  assert.throws(() => assertBoundHydrologyReplay(sourceGraph, sourceGraph, evidence), /envelope is incomplete/);
  assert.throws(() => assertBoundHydrologyReplay(stored, { ...sourceGraph, nodes: [] }, evidence), /source graph no longer reproduces/);
  assert.throws(() => assertBoundHydrologyReplay(stored, sourceGraph, { rasterSha256: "b".repeat(64) }), /array replay differs/);
});
test("prereview selects a full measured identity without conferring permission", () => {
  const value = report(); assert.equal(assertReplacementCandidate(value, "measured-candidate"), value.candidateProfiles[0]);
});
for (const [name, change] of [
  ["wrong report", r => r.schemaVersion = "other"], ["claimed RGB grant", r => r.qualification.preRgbPassed = true],
  ["claimed training grant", r => r.qualification.trainingAllowed = true],
  ["duplicate candidate", r => r.candidateProfiles.push({ candidateId: "measured-candidate" })],
  ["missing candidate", r => r.candidateProfiles = []],
]) test(`rejects ${name}`, () => { const value = report(); change(value); assert.throws(() => assertReplacementCandidate(value, "measured-candidate")); });

function connectivityInput() {
  return { slotId: "v7-capacity-slot-194", assignment: { fingerprints: { direct: "b".repeat(64) },
    regionalLandscapeType: "wet-season-drainage-hollow", metrics: { relativeRelief: 0.2, relativeElevation: 0.2,
      normalizedSlope: { mean: 0.1 }, drainageLikelihoodRatio: 1,
      reconstructedLandCoverRatio: { treeCover: 1, grassland: 0 } } }, worldProfileId: "synthetic-test-profile",
    sourcePackage: { schemaVersion: "real-earth-region-source-package-v1", packageId: "synthetic-test-source",
      identity: { realEarthRegionId: "synthetic-test-region" },
      scope: { currentMvpRegionScope: "thailand_sakaerat_wang_nam_khiao_only", reusableOutsideThailand: false } },
    width: 1024, height: 768, hasWater: true, anonymousCompositionArchitectureRevision: "measurement-derived-complete-world-proposal-v1" };
}
test("replacement region and paired ports use a new content-bound identity", () => {
  const region = `training-world:thailand-mvp:replacement-${"a".repeat(64)}`;
  const output = buildIndependentTrainingRegionConnectivity({ ...connectivityInput(), regionIdentity: region });
  assert.equal(output.currentRegion.regionId, region);
  assert(output.edgePorts.some(p => p.regionId === region));
  for (const port of output.edgePorts.filter(p => p.regionId === region)) {
    const other = output.edgePorts.find(p => p.edgePortId === port.connectsToEdgePortId);
    assert(other); assert.equal(other.connectsToRegionId, region);
  }
  assert(!JSON.stringify(output).includes('"regionId":"training-world:thailand-mvp:v7-capacity-slot-194"'));
});
test("ambiguous replacement region identity is rejected", () => {
  assert.throws(() => buildIndependentTrainingRegionConnectivity({ ...connectivityInput(), regionIdentity: "194" }), /content-bound/);
});

test("raw task bytes and canonical task payload are distinct verified identities", () => {
  const payload = { schemaVersion: "synthetic-test-task", taskId: "one" };
  const binding = { taskSha256: sha256(JSON.stringify(payload)) };
  const bytes = Buffer.from(JSON.stringify({ ...payload, ...binding }, null, 2) + "\n");
  const run = { taskSha256: sha256(bytes) };
  assert.notEqual(run.taskSha256, binding.taskSha256);
  assert.equal(assertHistoricalTaskBinding(bytes, run, binding).taskId, "one");
  assert.throws(() => assertHistoricalTaskBinding(bytes, binding, binding), /raw file identity/);
  const tampered = Buffer.from(bytes.toString().replace('"one"', '"two"'));
  assert.throws(() => assertHistoricalTaskBinding(tampered, { taskSha256: sha256(tampered) }, binding), /canonical payload/);
});

function proposalFixture() {
  const rect = [{ x: 0, y: 0 }, { x: 1024, y: 0 }, { x: 1024, y: 768 }, { x: 0, y: 768 }];
  return { schemaVersion: "ai-painter-replacement-geometry-proposal-v1",
    status: "complete_geometry_proposed_not_pre_rgb_qualified", worldId: "synthetic-world", regionId: "synthetic-region",
    worldFacts: { worldId: "synthetic-world", regionId: "synthetic-region" },
    outputBoundary: { conditionPackCreated: false, imageGenerationStarted: false, rgbCreated: false,
      gpuTrainingStarted: false, trainingAllowed: false, runtimeFrameEligible: false, canEnterWorld: false },
    geometry: { worldFrameContract: { frameCoverage: { width: 1024, height: 768 } }, hasWater: false,
      terrainRegions: [{ kind: "grass", polygon: rect }], walkableRegions: [{ polygon: rect }],
      collisionRegions: [], objectFootprints: [], entranceBounds: { x: 0, y: 0, width: 20, height: 20 }, focalBounds: null,
      pathCenterline: [{ x: 0, y: 0 }, { x: 100, y: 100 }], waterCenterline: [], ecologicalZones: [] } };
}
test("proposal geometry projection keeps input bytes and never grants qualification", () => {
  const proposal = proposalFixture(), before = JSON.stringify(proposal);
  const geometry = extractReplacementDeclaredGeometry(proposal);
  assert.equal(JSON.stringify(proposal), before);
  assert.equal(geometry.sourceSchema, proposal.schemaVersion);
  assert.equal(geometry.trainingQualified, false);
  assert.equal(geometry.variants.length, 4);
  assert(geometry.signature);
});
for (const [name, alter] of [
  ["wrong schema", p => p.schemaVersion = "other"],
  ["training grant", p => p.outputBoundary.trainingAllowed = true],
  ["missing dimensions", p => delete p.geometry.worldFrameContract],
  ["changed dimensions", p => p.geometry.worldFrameContract.frameCoverage.width = 512],
  ["identity conflict", p => p.worldFacts.regionId = "other"],
]) test(`proposal comparison rejects ${name}`, () => {
  const p = proposalFixture(); alter(p); assert.throws(() => extractReplacementDeclaredGeometry(p));
});
test("polygon-only history remains comparable without fabricating its missing topology", () => {
  const p = proposalFixture(), current = extractReplacementDeclaredGeometry(p);
  delete p.geometry.pathCenterline;
  const historical = extractReplacementDeclaredGeometry(p);
  const result = compareReplacementDeclaredGeometry(current, historical);
  assert(result.declaredPolygonMatches.length > 0);
  assert.equal(result.semanticComparable, false);
  assert.deepEqual(result.semanticMatches, []);
  assert.equal(result.allHistoryPassed, false);
  assert.equal(result.trainingAllowed, false);
});
test("an exact candidate pair is detected without claiming near-duplicate coverage", () => {
  const geometry = extractReplacementDeclaredGeometry(proposalFixture());
  const result = compareReplacementDeclaredGeometry(geometry, geometry);
  assert(result.semanticMatches.includes("completeSkeletonSemanticIdentity"));
  assert(result.declaredPolygonMatches.some(m => m.roles.includes("completeDeclaredLayout")));
  assert.equal(result.nearDuplicateQualified, false);
});
