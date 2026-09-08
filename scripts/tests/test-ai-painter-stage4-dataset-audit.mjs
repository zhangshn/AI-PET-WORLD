import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { createReader, explicitFile, validateMembership, semanticDuplicateGroups,
  imageFingerprint, compareImages, evaluationExposure, sha256, SPLIT_COUNTS,
  foundationExposure, semanticHistoryMatches, historicalMatchContext,
  auditHistoricalGeometry,
} from "../lib/ai-painter-stage4-dataset-audit.mjs";
import { extractHistoricalGeometry, compareHistoricalGeometry, readHistoricalGeometry }
  from "../lib/ai-painter-stage4-historical-geometry.mjs";
import { buildCompleteMapSemanticTopologySignature } from "../lib/complete-map-semantic-topology-signature.mjs";

function temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-audit-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function fixture() {
  const rows = Object.entries(SPLIT_COUNTS).flatMap(([split, count]) => Array.from({ length: count }, (_, i) => ({
    sampleId: `${split}-${i}`, split, conditionPack: { path: `packs/${split}-${i}.json` },
  })));
  return { manifest: { schemaVersion: "ai-painter-stage4-v2-independent-split-package-v1",
    sampleCount: 64, splitCounts: { ...SPLIT_COUNTS } }, source: { sampleCount: 64, samples: rows },
  memberships: Object.fromEntries(Object.keys(SPLIT_COUNTS).map((split) => [split, {
    split, sampleIds: rows.filter((row) => row.split === split).map((row) => row.sampleId),
  }])) };
}

test("four splits must exactly reproduce ordered source membership", () => {
  const f = fixture();
  validateMembership(f.manifest, f.source, f.memberships);
  f.memberships.train.sampleIds.reverse();
  assert.throws(() => validateMembership(f.manifest, f.source, f.memberships), /membership/);
});
test("same count cannot hide validation-to-train relabelling", () => {
  const f = fixture();
  [f.source.samples[0].split, f.source.samples[48].split] = ["validation", "train"];
  assert.throws(() => validateMembership(f.manifest, f.source, f.memberships), /membership/);
});
test("duplicate sample IDs fail before image audit", () => {
  const f = fixture(); f.source.samples[1].sampleId = f.source.samples[0].sampleId;
  assert.throws(() => validateMembership(f.manifest, f.source, f.memberships), /duplicate/);
});
test("snapshot hashing rejects changed bytes and malformed bindings", (t) => {
  const root = temp(t); fs.writeFileSync(path.join(root, "input.json"), "{}");
  const reader = createReader(root);
  reader.bound({ path: "input.json", sha256: sha256(Buffer.from("{}")) });
  assert.throws(() => reader.bound({ path: "input.json" }), /SHA binding/);
  fs.writeFileSync(path.join(root, "input.json"), "[]");
  assert.throws(() => reader.verifyStable(), /SHA mismatch/);
});
test("paths cannot select latest, traversal, drive paths or normalized escapes", (t) => {
  const root = temp(t);
  for (const logical of ["../x", "data/../x", "F:/x", "C:\\x", "/x", "a//b", "latest.json", "a/./x"]) {
    assert.throws(() => explicitFile(root, logical), /invalid explicit/);
  }
});
test("declared runtime junction is permitted, nested escape rejected", (t) => {
  const root = temp(t), runtime = temp(t), outside = temp(t);
  fs.symlinkSync(runtime, path.join(root, ".runtime"), process.platform === "win32" ? "junction" : "dir");
  fs.writeFileSync(path.join(runtime, "ok.json"), "{}");
  assert.equal(fs.readFileSync(explicitFile(root, ".runtime/ok.json"), "utf8"), "{}");
  fs.symlinkSync(outside, path.join(runtime, "escape"), process.platform === "win32" ? "junction" : "dir");
  fs.writeFileSync(path.join(outside, "bad.json"), "{}");
  assert.throws(() => explicitFile(root, ".runtime/escape/bad.json"), /escapes/);
});
function signature(id, wet = false) {
  return { identities: { routeSemanticIdentity: `route-${id}`, completeSkeletonSemanticIdentity: `skeleton-${id}` },
    waterAndShoreline: { present: wet, networkConnectionMode: "single_channel" } };
}
test("multiple dry maps are not duplicate water networks", () => {
  assert.deepEqual(semanticDuplicateGroups([
    { sampleId: "a", split: "train", signature: signature(1) },
    { sampleId: "b", split: "validation", signature: signature(2) },
  ]), []);
});
test("same water network mode is detected across splits", () => {
  const groups = semanticDuplicateGroups([
    { sampleId: "a", split: "train", signature: signature(1, true) },
    { sampleId: "b", split: "challenge", signature: signature(2, true) },
  ]);
  assert.equal(groups.length, 1); assert.equal(groups[0].kind, "waterNetworkMode"); assert.equal(groups[0].crossSplit, true);
});
test("same-split structural duplicates still count as capacity defects", () => {
  const groups = semanticDuplicateGroups([
    { sampleId: "a", split: "train", signature: signature(1) },
    { sampleId: "b", split: "train", signature: signature(1) },
  ]);
  assert.equal(groups.length, 2); assert.equal(groups[0].crossSplit, false);
});
test("native RGB fingerprint detects mirrors and re-encoding, not just file SHA", async () => {
  const pixels = Buffer.from(Array.from({ length: 12 * 9 * 3 }, (_, i) => (i * i + i * 31) % 256));
  const png = await sharp(pixels, { raw: { width: 12, height: 9, channels: 3 } }).png().toBuffer();
  const mirror = await sharp(png).flop().png({ compressionLevel: 1 }).toBuffer();
  assert.notEqual(sha256(png), sha256(mirror));
  const match = compareImages(await imageFingerprint(png), await imageFingerprint(mirror));
  assert.ok(match.exactTransforms.includes("horizontal_mirror"));
  assert.equal(match.rgbThumbnailMae, 0);
});
test("thumbnail similarity never becomes an exact native pixel match", async () => {
  const a = await sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
  const b = await sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 1, g: 1, b: 1 } } }).png().toBuffer();
  const result = compareImages(await imageFingerprint(a), await imageFingerprint(b));
  assert.equal(result.exactTransforms.length, 0); assert.equal(result.rgbThumbnailMae, 1);
});
test("challenge reservation is not measured exposure or proof of being unseen", () => {
  const rows = fixture().source.samples;
  const row = rows[48];
  const result = evaluationExposure([
    { sampleId: row.sampleId, split: row.split, conditionPackPath: row.conditionPack.path, decodedRgbMae: 0.1 },
    { split: "challenge", sampleCount: 4, metricsReadDuringTraining: false },
  ], rows);
  assert.equal(result.observed.length, 1); assert.equal(result.reservations.length, 1);
  assert.equal(result.observed[0].optimizerUpdateProven, false);
  assert.equal(result.reservationIsProofOfNeverObserved, false);
});
test("a valid-looking sample ID with wrong condition binding is rejected", () => {
  const rows = fixture().source.samples;
  assert.throws(() => evaluationExposure([{ sampleId: rows[0].sampleId, split: "train",
    conditionPackPath: "another-pack.json", decodedRgbMae: 0.1 }], rows), /binding conflict/);
});

function foundationFixture(t) {
  const root = temp(t);
  function put(name, value) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), data);
    return { path: name, sha256: sha256(data) };
  }
  const image = put("data/rgb.bin", Buffer.from("fixture RGB, no model weights"));
  const source = put("data/source.json", { samples: [{ sampleId: "historical", split: "train",
    imagePath: image.path, imageSha256: image.sha256 }] });
  const dataset = put("data/manifest.json", { packageId: "fixture-dataset", sourceIndexPath: source.path });
  const parent = put("parent/weights.pt", Buffer.from("raw checkpoint fixture only"));
  const child = put("child/weights.pt", Buffer.from("child raw checkpoint fixture only"));
  const common = { datasetPackageId: "fixture-dataset", datasetManifestPath: dataset.path,
    datasetManifestSha256: dataset.sha256, trainingStage: "autoencoder_warmup_only" };
  put("parent/manifest.json", { ...common, checkpointPath: parent.path, checkpointSha256: parent.sha256,
    initialization: "random_initialization_only", parentCheckpointPath: null });
  const childManifest = put("child/manifest.json", { ...common, checkpointPath: child.path,
    checkpointSha256: child.sha256, initialization: "project_checkpoint_resume",
    parentCheckpointPath: parent.path, parentCheckpointSha256: parent.sha256 });
  return { root, put, image, child, childManifest,
    contract: { checkpoint: child, sourceManifest: childManifest } };
}
test("foundation ancestry follows explicit parent weights and records historical binding gaps", (t) => {
  const f = foundationFixture(t);
  const report = foundationExposure(createReader(f.root), f.contract, [
    { sampleId: "current-holdout", split: "challenge", image: f.image },
  ]);
  assert.equal(report.chain.length, 2);
  assert.equal(report.exactIdentityOverlaps.length, 2);
  assert.equal(report.exactIdentityOverlaps[0].currentSplit, "challenge");
  assert.ok(report.gaps.some((g) => g.code === "historical_source_index_not_hash_bound"));
  assert.ok(report.gaps.some((g) => g.code === "ancestor_manifest_not_hash_bound_by_child"));
  assert.equal(report.unseenHoldoutQualified, false);
});
test("altered parent checkpoint is rejected without deserializing it", (t) => {
  const f = foundationFixture(t); f.put("parent/weights.pt", Buffer.from("tampered"));
  assert.throws(() => foundationExposure(createReader(f.root), f.contract, []), /SHA mismatch/);
});
test("foundation parent cycles fail closed", (t) => {
  const f = foundationFixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.root, f.childManifest.path)));
  manifest.parentCheckpointPath = f.child.path; manifest.parentCheckpointSha256 = f.child.sha256;
  f.contract.sourceManifest = f.put(f.childManifest.path, manifest);
  assert.throws(() => foundationExposure(createReader(f.root), f.contract, []), /cycle/);
});
test("historical semantic equality is distinct from image identity", () => {
  assert.deepEqual(semanticHistoryMatches(signature(1), signature(1)),
    ["routeSemanticIdentity", "completeSkeletonSemanticIdentity"]);
  assert.deepEqual(semanticHistoryMatches(signature(1), signature(2)), []);
  assert.throws(() => semanticHistoryMatches({ identities: {} }, { identities: {} }), /identity missing/);
});
test("same-condition retry is distinguished from a historical composition rejection", () => {
  const conditionBinding = { taskPackagePath: "task.json", conditionPackPath: "pack.json" };
  const current = { conditionBinding, createdAtUtc: "2026-08-02T00:00:00Z" };
  const old = { conditionBinding, createdAtUtc: "2026-08-01T00:00:00Z", recordId: "old",
    originalImage: { sha256: "a".repeat(64) }, reviews: { machineReviewPath: "review.json" } };
  const review = { recordId: "old", imageSha256: "a".repeat(64), status: "machine_rejected",
    issues: [{ code: "condition_terrain_path_ground_coverage_mismatch" }] };
  let result = historicalMatchContext(current, old, review);
  assert.equal(result.interpretation, "same_condition_rgb_retry_not_automatically_a_capacity_duplicate");
  assert.equal(result.currentSampleQualifiedByThisContext, false);
  assert.equal(result.historicalPrecedesCurrent, true);
  review.issues = [{ code: "complete_map_composition_diversity_failed" }];
  result = historicalMatchContext(current, old, review);
  assert.equal(result.interpretation, "historical_composition_rejection_requires_fresh_novelty_evidence");
  review.imageSha256 = "b".repeat(64);
  assert.throws(() => historicalMatchContext(current, old, review), /review binding mismatch/);
});

function polygonBlueprint(version = 1) {
  const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  return { schemaVersion: `ai-assisted-training-world-fact-blueprint-v${version}`, taskId: "task-a", worldId: "world-a",
    canvas: { width: 1024, height: 768, frameScope: "complete_runtime_frame" }, geometry: {
      hasWater: true, terrainRegions: [
        { sourceId: "grass", kind: "grass", polygon: rect(0, 0, 1024, 768) },
        { sourceId: "water", kind: "water", polygon: rect(720, 0, 90, 768) },
        { sourceId: "shore", kind: "shoreline", polygon: rect(700, 0, 130, 768) },
        { sourceId: "route", kind: "path_ground", polygon: rect(180, 0, 50, 768) },
      ], walkableRegions: [{ sourceId: "walk", polygon: rect(180, 0, 50, 768) }],
      collisionRegions: [{ sourceId: "water", polygon: rect(720, 0, 90, 768) }],
      objectFootprints: [{ objectId: "tree-1", kind: "tree", blocksMovement: true,
        footprint: { x: 400, y: 200, width: 50, height: 60 } }],
      entranceBounds: { x: 180, y: 0, width: 50, height: 30 }, focalBounds: null,
    } };
}
function centeredBlueprint() {
  const b = polygonBlueprint(2);
  Object.assign(b.geometry, { pathCenterline: [{ x: 205, y: 0 }, { x: 205, y: 768 }],
    waterCenterline: [{ x: 765, y: 0 }, { x: 765, y: 768 }], routeTopology: "single_path",
    ecologicalZones: [{ zoneId: "description", kind: "forest", role: "regional_landscape_primary_zone" },
      { zoneId: "spatial", kind: "forest", role: "cluster", polygon: [{ x: 300, y: 100 }, { x: 550, y: 110 }, { x: 520, y: 300 }] }] });
  return b;
}
test("legacy v1 and v2 polygons are audited without inventing route or water centerlines", () => {
  for (const version of [1, 2]) {
    const b = polygonBlueprint(version), before = JSON.stringify(b), result = extractHistoricalGeometry(b);
    assert.equal(result.representation, "declared_polygons_only");
    assert.equal(result.signature, null);
    assert.equal(result.hasWater, true);
    assert.ok(result.variants[0].waterPolygons);
    assert.deepEqual(result.missingTopologyFields, ["pathCenterline", "waterCenterline", "ecologicalZones"]);
    assert.equal(result.trainingQualified, false);
    assert.equal(result.fullSemanticUniquenessQualified, false);
    assert.equal(JSON.stringify(b), before);
  }
});
test("real mixed descriptive/spatial ecology Schema keeps existing topology signature bytes", () => {
  const b = centeredBlueprint(), result = extractHistoricalGeometry(b);
  assert.equal(result.representation, "centerline_and_declared_polygons");
  assert.deepEqual(result.signature, buildCompleteMapSemanticTopologySignature(b, b.canvas));
  assert.equal(result.ecologicalZonesWithoutGeometry, 1);
  assert.equal(result.fullSemanticUniquenessQualified, false);
  delete b.geometry.ecologicalZones[1].polygon;
  assert.equal(extractHistoricalGeometry(b).ecologicalZonesWithoutGeometry, 2);
});
test("renaming records, reordering polygons, starting vertex and winding cannot hide same geometry", () => {
  const a = polygonBlueprint(), b = structuredClone(a);
  for (const r of b.geometry.terrainRegions) {
    r.sourceId += "-renamed";
    r.polygon = [...r.polygon.slice(1), r.polygon[0]].reverse();
    r.polygon.push({ ...r.polygon[0] });
  }
  b.geometry.terrainRegions.reverse(); b.geometry.objectFootprints[0].objectId = "another-id";
  const matches = compareHistoricalGeometry(extractHistoricalGeometry(a), extractHistoricalGeometry(b));
  assert.ok(matches.find((m) => m.transform === "identity").roles.includes("completeDeclaredLayout"));
});
test("exact horizontal mirror is detected with semantic roles retained", () => {
  const a = polygonBlueprint(), b = structuredClone(a), g = b.geometry;
  for (const key of ["terrainRegions", "walkableRegions", "collisionRegions"])
    for (const r of g[key]) for (const p of r.polygon) p.x = 1024 - p.x;
  for (const box of [g.entranceBounds, ...g.objectFootprints.map((r) => r.footprint)]) box.x = 1024 - box.x - box.width;
  const matches = compareHistoricalGeometry(extractHistoricalGeometry(a), extractHistoricalGeometry(b));
  assert.ok(matches.find((m) => m.transform === "horizontal_mirror").roles.includes("completeDeclaredLayout"));
  assert.ok(!matches.find((m) => m.transform === "identity")?.roles.includes("completeDeclaredLayout"));
});
test("same polygon coordinates cannot hide water versus route relabelling", () => {
  const a = polygonBlueprint(), b = structuredClone(a);
  b.geometry.terrainRegions.find((r) => r.kind === "water").kind = "path_ground";
  b.geometry.hasWater = false;
  const matches = compareHistoricalGeometry(extractHistoricalGeometry(a), extractHistoricalGeometry(b));
  assert.ok(matches.every((m) => !m.roles.includes("waterPolygons") && !m.roles.includes("completeDeclaredLayout")));
});
test("genuinely dry empty water sets do not create duplicate-water matches", () => {
  const b = polygonBlueprint(); b.geometry.hasWater = false;
  b.geometry.terrainRegions = b.geometry.terrainRegions.filter((r) => !["water", "shoreline"].includes(r.kind));
  const a = extractHistoricalGeometry(b);
  assert.equal(a.variants[0].waterPolygons, null);
  assert.ok(compareHistoricalGeometry(a, a).every((m) => !m.roles.includes("waterPolygons")));
});
test("unknown Schema, unknown kinds, missing evidence and water contradictions fail explicitly", () => {
  for (const mutate of [
    (b) => b.schemaVersion = "invented-v3", (b) => delete b.geometry,
    (b) => delete b.geometry.hasWater, (b) => b.geometry.hasWater = false,
    (b) => b.geometry.terrainRegions[0].kind = "imaginary_surface",
    (b) => b.geometry.objectFootprints[0].kind = "animal",
    (b) => delete b.geometry.focalBounds,
  ]) {
    const b = polygonBlueprint(); mutate(b);
    assert.throws(() => extractHistoricalGeometry(b), (e) => /^historical_geometry_/.test(e.code));
  }
});
test("invalid numeric points, malformed polygons and invalid footprint dimensions never become hashes", () => {
  for (const mutate of [
    (b) => b.geometry.terrainRegions[0].polygon[0].x = "0",
    (b) => b.geometry.terrainRegions[0].polygon[0].y = NaN,
    (b) => b.geometry.terrainRegions[0].polygon = [],
    (b) => b.geometry.terrainRegions[0].polygon = null,
    (b) => b.geometry.terrainRegions[0].polygon = [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }],
    (b) => b.geometry.objectFootprints[0].footprint.width = -2,
    (b) => b.geometry.objectFootprints[0].footprint.height = Infinity,
    (b) => b.canvas.width = 0,
  ]) {
    const b = polygonBlueprint(); mutate(b);
    assert.throws(() => extractHistoricalGeometry(b), /historical_geometry_invalid/);
  }
});
test("invalid declared topology does not silently fall back to a passing polygon-only signature", () => {
  for (const mutate of [
    (b) => b.geometry.pathCenterline = [], (b) => b.geometry.waterCenterline[0].x = "765",
    (b) => b.geometry.ecologicalZones[1].polygon = null,
    (b) => b.geometry.waterBranchCenterlines = [[]],
    (b) => b.geometry.internalHydrologyProfile = { internalNetworkConnectionMode: 3 },
    (b) => b.geometry.compositionArchitecture = { objectPlacementZones: [{ polygon: [] }] },
  ]) {
    const b = centeredBlueprint(); mutate(b);
    assert.throws(() => extractHistoricalGeometry(b), /historical_geometry_invalid/);
  }
});
test("missing optional legacy boundary passages remain unknown, not zero", () => {
  const b = polygonBlueprint();
  assert.equal(extractHistoricalGeometry(b).counts.boundaryPassages, null);
  b.geometry.boundaryPassages = [];
  assert.equal(extractHistoricalGeometry(b).counts.boundaryPassages, 0);
  b.geometry.boundaryPassages = [{ edge: "top", routeIndex: 0, bounds: { x: 180, y: 0, width: 50, height: 30 } }];
  assert.equal(extractHistoricalGeometry(b).counts.boundaryPassages, 1);
  b.geometry.boundaryPassages[0].routeIndex = "0";
  assert.throws(() => extractHistoricalGeometry(b), /historical_geometry_invalid/);
});
function geometryReaderFixture() {
  const values = { "task.json": { taskId: "task-a", worldId: "world-a", sourceBindings: { trainingBlueprintPath: "blueprint.json" } },
    "blueprint.json": polygonBlueprint() };
  return { values, reader: { json(p) { assert.ok(Object.hasOwn(values, p), `unexpected read: ${p}`); return values[p]; } },
    record: { recordId: "record-a", conditionBinding: { taskId: "task-a", taskPackagePath: "task.json" } } };
}
test("record-task-blueprint world and task bindings are mandatory", () => {
  const f = geometryReaderFixture();
  assert.equal(readHistoricalGeometry(f.reader, f.record).recordId, "record-a");
  f.values["blueprint.json"].worldId = "another-world";
  assert.throws(() => readHistoricalGeometry(f.reader, f.record), /identity_conflict/);
  f.values["blueprint.json"].worldId = "world-a";
  f.record.conditionBinding.taskId = "another-task";
  assert.throws(() => readHistoricalGeometry(f.reader, f.record), /identity_conflict/);
});
test("audit coverage separates polygon-supported records from topology and missing-reference gaps", () => {
  const f = geometryReaderFixture();
  const selected = [{ sampleId: "a", split: "train", recordId: "record-a" }];
  const result = auditHistoricalGeometry({ reader: f.reader, selected,
    history: [f.record, { recordId: "missing-task" }] });
  assert.equal(result.summary.declaredGeometryChecked, 1);
  assert.equal(result.summary.geometryEvidenceGaps, 1);
  assert.equal(result.summary.polygonOnlyRecords, 1);
  assert.equal(result.summary.centerlineSignatureRecords, 0);
  assert.equal(result.gaps[0].code, "historical_structured_task_missing");
  assert.equal(result.topologyGaps[0].polygonAuditAvailable, true);
  assert.equal(result.qualification.fullSemanticUniquenessQualified, false);
  assert.equal(result.summary.geometryPairComparisons, 0); // self excluded
});
test("missing blueprint reference is not rescued by guesses or unrelated geometry files", () => {
  const f = geometryReaderFixture(); delete f.values["task.json"].sourceBindings.trainingBlueprintPath;
  assert.throws(() => readHistoricalGeometry(f.reader, f.record), /historical_blueprint_reference_missing/);
});
test("audit rejects duplicate inventory/selection and selected unreadable geometry", () => {
  const f = geometryReaderFixture(), row = { sampleId: "a", split: "train", recordId: "record-a" };
  assert.throws(() => auditHistoricalGeometry({ reader: f.reader, history: [f.record, f.record], selected: [row] }), /inventory invalid/);
  assert.throws(() => auditHistoricalGeometry({ reader: f.reader, history: [f.record], selected: [row, row] }), /selection invalid/);
  assert.throws(() => auditHistoricalGeometry({ reader: f.reader, history: [f.record], selected: [{ ...row, recordId: "missing" }] }), /selected geometry unavailable/);
});
test("geometry equality does not collapse distinct object placement or grant training qualification", () => {
  const a = polygonBlueprint(), b = structuredClone(a); b.geometry.objectFootprints[0].footprint.x += 1;
  const left = extractHistoricalGeometry(a), right = extractHistoricalGeometry(b);
  const direct = compareHistoricalGeometry(left, right).find((m) => m.transform === "identity");
  assert.ok(direct.roles.includes("terrainLayout"));
  assert.ok(!direct.roles.includes("objectLayout") && !direct.roles.includes("completeDeclaredLayout"));
  assert.equal(left.trainingQualified, false); assert.equal(right.trainingQualified, false);
});
test("vertical mirror and rotation preserve exact polygon facts without creating world facts", () => {
  for (const transform of ["vertical_mirror", "rotate_180"]) {
    const a = polygonBlueprint(), b = structuredClone(a), g = b.geometry;
    for (const key of ["terrainRegions", "walkableRegions", "collisionRegions"]) for (const r of g[key]) for (const p of r.polygon) {
      p.y = 768 - p.y; if (transform === "rotate_180") p.x = 1024 - p.x;
    }
    for (const box of [g.entranceBounds, ...g.objectFootprints.map((r) => r.footprint)]) {
      box.y = 768 - box.y - box.height;
      if (transform === "rotate_180") box.x = 1024 - box.x - box.width;
    }
    assert.ok(compareHistoricalGeometry(extractHistoricalGeometry(a), extractHistoricalGeometry(b))
      .find((m) => m.transform === transform).roles.includes("completeDeclaredLayout"));
  }
});
test("a dry world cannot carry a malformed one-point water centerline", () => {
  const b = centeredBlueprint(); b.geometry.hasWater = false;
  b.geometry.terrainRegions = b.geometry.terrainRegions.filter((r) => !["water", "shoreline"].includes(r.kind));
  b.geometry.waterCenterline = [{ x: 765, y: 0 }];
  assert.throws(() => extractHistoricalGeometry(b), /historical_geometry_conflict/);
});
test("geometry replay CLI rejects mixed or missing bindings before reading data", () => {
  for (const args of [
    ["--geometry-baseline", "missing.json"],
    ["--baseline-sha256", "a".repeat(64)],
    ["--geometry-baseline", "missing.json", "--baseline-sha256", "a".repeat(64), "--manifest", "dataset.json"],
  ]) {
    const r = spawnSync(process.execPath, ["scripts/audit-ai-painter-stage4-split-release.mjs", ...args],
      { encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.equal(r.status, 1); assert.match(r.stderr, /Geometry replay requires only/);
  }
});

function directSpatialTaskFixture() {
  const b = polygonBlueprint();
  const task = { schemaVersion: "runtime-frame-generation-task-v1", taskId: "task-direct", worldId: "world-direct", tick: 1,
    outputSize: b.canvas, sourceBindings: { runtimeFramePath: "must-not-read/latest-runtime-frame.json" },
    spatialLayers: { terrainRegions: b.geometry.terrainRegions,
      walkableRegions: b.geometry.walkableRegions.map((r) => ({ ...r, kind: "walkable_area" })),
      collisionRegions: b.geometry.collisionRegions.map((r) => ({ ...r, kind: "blocked_area" })),
      objectFootprints: [...b.geometry.objectFootprints, { objectId: "flowers", kind: "flower_patch", blocksMovement: false,
        footprint: { x: 280, y: 300, width: 20, height: 10 } }], interactionRegions: [], stateRegions: ["world:world-direct"] },
    // These labels/references must not manufacture geometry or training rights.
    mapGrammar: { requiredParts: [{ partId: "entrance", sourceFactId: "entry-area" }], routeGraph: { nodes: ["entry-area"] } },
    inferenceGate: { canRunCompleteVisualInference: true }, ecologyState: { primaryBiome: "forest" } };
  const record = { recordId: "record-direct", conditionBinding: { taskId: task.taskId, worldId: task.worldId, tick: task.tick,
    taskPackagePath: "direct-task.json", formalConditionalTrainingEligible: false },
    worldBinding: { worldId: task.worldId, tick: task.tick, taskPackageId: task.taskId, taskPackagePath: "direct-task.json" } };
  const reads = [];
  function sign() {
    delete task.taskSha256;
    task.taskSha256 = sha256(Buffer.from(JSON.stringify(task)));
    record.conditionBinding.taskSha256 = task.taskSha256;
  }
  sign();
  return { task, record, sign, reads, reader: { json(p) {
    reads.push(p); assert.equal(p, "direct-task.json", `unbound extra read: ${p}`); return task;
  } } };
}

test("bound runtime-frame v1 spatialLayers are read without a fabricated blueprint or topology", () => {
  const f = directSpatialTaskFixture(), before = JSON.stringify([f.task, f.record]);
  const result = readHistoricalGeometry(f.reader, f.record);
  assert.equal(result.sourceRepresentation, "runtime_frame_task_spatial_layers");
  assert.equal(result.sourceSchema, "runtime-frame-generation-task-v1");
  assert.equal(result.blueprintPath, null);
  assert.equal(result.sourceBinding.contentSha256, f.record.conditionBinding.taskSha256);
  assert.equal(result.sourceBinding.hashScheme, "json_stringify_omit_taskSha256_v1");
  assert.equal(result.signature, null); assert.equal(result.hasWater, null);
  assert.deepEqual(result.missingTopology, ["entranceBounds", "focalBounds", "hasWater", "pathCenterline", "waterCenterline",
    "routeTopology", "ecologicalZones", "boundaryPassages"]);
  assert.deepEqual(result.missingTopologyFields, result.missingTopology);
  assert.equal(result.ecologicalZonesWithoutGeometry, null);
  assert.equal(result.counts.objectFootprints, 2); assert.equal(result.counts.boundaryPassages, null);
  assert.ok(result.variants.every((v) => v.completeDeclaredLayout === null && v.declaredSpatialLayersLayout));
  assert.ok(result.variants[0].waterPolygons); // Declared polygon, not a water-network qualification.
  assert.equal(JSON.stringify([f.task, f.record]), before);
  assert.deepEqual(f.reads, ["direct-task.json"]);
});

test("direct spatialLayers reject wrong Schema even when the content hash is valid", () => {
  const f = directSpatialTaskFixture(); f.task.schemaVersion = "invented-task-v2"; f.sign();
  assert.throws(() => readHistoricalGeometry(f.reader, f.record), /historical_geometry_schema_unsupported/);
});

test("direct task requires the record-bound recomputed content hash, not a hash-shaped string or file SHA", () => {
  for (const mutate of [
    (f) => delete f.record.conditionBinding.taskSha256,
    (f) => f.record.conditionBinding.taskSha256 = "invalid",
    (f) => f.record.conditionBinding.taskSha256 = "a".repeat(64),
    (f) => f.task.taskSha256 = f.record.conditionBinding.taskSha256 = "a".repeat(64),
    (f) => delete f.task.taskSha256,
    (f) => f.task.spatialLayers.objectFootprints[0].footprint.x++,
    (f) => f.record.conditionBinding.taskSha256 = sha256(Buffer.from(JSON.stringify(f.task, null, 2))),
  ]) {
    const f = directSpatialTaskFixture(); mutate(f);
    assert.throws(() => readHistoricalGeometry(f.reader, f.record), /historical_geometry_content_hash_mismatch/);
  }
});

test("direct task-world-tick and duplicate worldBinding conflicts fail with otherwise valid content hashes", () => {
  for (const mutate of [
    (f) => f.record.conditionBinding.taskId = "another-task",
    (f) => f.record.conditionBinding.worldId = "another-world",
    (f) => delete f.record.conditionBinding.worldId,
    (f) => f.record.conditionBinding.tick = "1",
    (f) => delete f.record.conditionBinding.tick,
    (f) => f.record.worldBinding.worldId = "another-world",
    (f) => f.record.worldBinding.tick = 2,
    (f) => f.record.worldBinding.taskPackageId = "another-task",
    (f) => f.record.worldBinding.taskPackagePath = "another-task.json",
    (f) => f.record.conditionBinding.worldProfileId = "unbound-profile",
    (f) => f.task.taskId = "",
    (f) => f.task.worldId = "",
    (f) => f.task.tick = -1,
  ]) {
    const f = directSpatialTaskFixture(); mutate(f); f.sign();
    assert.throws(() => readHistoricalGeometry(f.reader, f.record), /historical_geometry_identity_conflict/);
  }
});

test("direct spatialLayers reject missing layers, unsupported kinds, and nonempty unadapted interactions", () => {
  for (const mutate of [
    (f) => delete f.task.spatialLayers,
    (f) => delete f.task.spatialLayers.walkableRegions,
    (f) => f.task.spatialLayers.terrainRegions = [],
    (f) => f.task.spatialLayers.terrainRegions[0].kind = "invented",
    (f) => f.task.spatialLayers.walkableRegions[0].kind = "water",
    (f) => f.task.spatialLayers.collisionRegions[0].kind = "walkable_area",
    (f) => f.task.spatialLayers.objectFootprints[0].kind = "animal",
    (f) => f.task.spatialLayers.objectFootprints[0].blocksMovement = "true",
    (f) => f.task.spatialLayers.interactionRegions = [{ kind: "unknown_geometry" }],
    (f) => f.task.spatialLayers.stateRegions = [{ inventedPolygon: [] }],
    (f) => f.task.spatialLayers.inventedGeometry = [],
  ]) {
    const f = directSpatialTaskFixture(); mutate(f); f.sign();
    assert.throws(() => readHistoricalGeometry(f.reader, f.record), (e) => /^historical_geometry_/.test(e.code));
  }
});

test("direct spatialLayers reject invalid numeric geometry even with a recomputed matching task hash", () => {
  for (const mutate of [
    (f) => f.task.spatialLayers.terrainRegions[0].polygon[0].x = "0",
    (f) => f.task.spatialLayers.terrainRegions[0].polygon[0].y = NaN,
    (f) => f.task.spatialLayers.walkableRegions[0].polygon[0].x = Infinity,
    (f) => f.task.spatialLayers.collisionRegions[0].polygon = [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }],
    (f) => f.task.spatialLayers.objectFootprints[0].footprint.width = 0,
    (f) => f.task.spatialLayers.objectFootprints[0].footprint.height = -1,
    (f) => f.task.spatialLayers.objectFootprints[0].footprint = { x: 1e308, y: 0, width: 1e308, height: 10 },
    (f) => f.task.outputSize.width = "1024",
    (f) => f.task.outputSize.height = 0,
    (f) => f.task.outputSize.width = 16_777_216,
    (f) => f.task.outputSize.frameScope = "partial_frame",
  ]) {
    const f = directSpatialTaskFixture(); mutate(f); f.sign();
    assert.throws(() => readHistoricalGeometry(f.reader, f.record), /historical_geometry_invalid/);
  }
});

test("direct geometry never grants conditional training or full uniqueness eligibility", () => {
  for (const eligible of [false, true]) {
    const f = directSpatialTaskFixture(); f.record.conditionBinding.formalConditionalTrainingEligible = eligible;
    const result = readHistoricalGeometry(f.reader, f.record);
    assert.equal(result.trainingQualified, false); assert.equal(result.fullSemanticUniquenessQualified, false);
    const audit = auditHistoricalGeometry({ reader: f.reader, history: [f.record, { recordId: "missing" }],
      selected: [{ sampleId: "selected", recordId: f.record.recordId, split: "train" }] });
    assert.equal(audit.summary.declaredGeometryChecked, 1); assert.equal(audit.summary.geometryEvidenceGaps, 1);
    assert.equal(audit.summary.centerlineSignatureRecords, 0); assert.equal(audit.summary.polygonOnlyRecords, 1);
    assert.equal(audit.topologyGaps[0].blueprintPath, null);
    assert.equal(audit.qualification.trainingAllowed, false);
    assert.equal(audit.qualification.fullSemanticUniquenessQualified, false);
  }
});

test("direct spatial fingerprints retain actual object/walkable changes without claiming complete layout equality", () => {
  const f = directSpatialTaskFixture(), first = readHistoricalGeometry(f.reader, f.record);
  f.task.spatialLayers.walkableRegions[0].polygon[0].x++; f.sign();
  const second = readHistoricalGeometry(f.reader, f.record);
  assert.notEqual(first.variants[0].declaredSpatialLayersLayout, second.variants[0].declaredSpatialLayersLayout);
  f.task.spatialLayers.objectFootprints[0].footprint.x++; f.sign();
  const third = readHistoricalGeometry(f.reader, f.record);
  assert.notEqual(second.variants[0].objectLayout, third.variants[0].objectLayout);
  for (const r of [first, second, third]) assert.ok(compareHistoricalGeometry(first, r)
    .every((m) => !m.roles.includes("completeDeclaredLayout")));
  const blueprint = polygonBlueprint(); blueprint.geometry.objectFootprints[0].kind = "flower_patch";
  assert.throws(() => extractHistoricalGeometry(blueprint), /historical_geometry_schema_unsupported/);
});

test("direct content identity works with byte receipts and performs no new referenced-file reads", (t) => {
  const root = temp(t), f = directSpatialTaskFixture();
  const bytes = Buffer.from(JSON.stringify(f.task, null, 2));
  fs.writeFileSync(path.join(root, "direct-task.json"), bytes);
  const reader = createReader(root), result = readHistoricalGeometry(reader, f.record);
  assert.notEqual(sha256(bytes), result.sourceBinding.contentSha256);
  assert.deepEqual(reader.receipts(), [{ path: "direct-task.json", sha256: sha256(bytes), bytes: bytes.length }]);
  reader.verifyStable();
  f.task.spatialLayers.terrainRegions[0].polygon[0].x++;
  fs.writeFileSync(path.join(root, "direct-task.json"), JSON.stringify(f.task, null, 2));
  assert.throws(() => readHistoricalGeometry(createReader(root), f.record), /content_hash_mismatch/);
});

test("v1/v2 polygon and centerline output bytes retain pre-direct-adapter golden hashes", () => {
  for (const [blueprint, expected] of [
    [polygonBlueprint(1), "3a0f86a4725d28e0ad6a7fc643df6d530616251b96cc9166a40d3d16ffb39f3f"],
    [polygonBlueprint(2), "a09296d5e003b6d3ea016d24c1e518954da051627ce9d413f6fe1fbd22ec1437"],
    [centeredBlueprint(), "8105f394842f435011905a0a750bfeec6f2f895eb41434e7e5534303f3ade091"],
  ]) assert.equal(sha256(Buffer.from(JSON.stringify(extractHistoricalGeometry(blueprint)))), expected);
});
