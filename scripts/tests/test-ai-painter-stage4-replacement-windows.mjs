import assert from "node:assert/strict";
import { test } from "node:test";
import { screenReplacementWindows, windowsOverlap, auditReplacementNeighborContext,
  auditConsumedSourceWindowIsolation } from "../audit-ai-painter-stage4-replacement-windows.mjs";

const bounds = (west, east) => ({ west, east, south: 0, north: 1 });
function fixture() {
  return { sampleId: "validation-new-source-needed", rows: [
    { sampleId: "validation-new-source-needed", split: "validation", regionalLandscapeType: "wet-season-drainage-hollow",
      monsoonSeason: "wet_season", grouping: { sourceWindow: bounds(0, 1) } },
    { sampleId: "current-train", split: "train", grouping: { sourceWindow: bounds(1, 2) } },
  ], candidates: [{ candidateId: "candidate-new-window", measurementBounds: bounds(2, 3),
    sourcePixelWindow: { left: 0, top: 0, width: 93, height: 70 }, fingerprints: { direct: "a".repeat(64) },
    metrics: { elevationMetres: { mean: 300 }, relativeElevation: 0.25, relativeRelief: 0.20,
      normalizedSlope: { mean: 0.10 }, drainageLikelihoodRatio: 1, humanRemovalRatio: 0,
      reconstructedLandCoverRatio: { treeCover: 1, shrubland: 0, grassland: 0, bareOrSparse: 0 } } }] };
}

test("derived ecology and non-overlap allow structural preflight only; input remains unchanged", () => {
  const input = fixture(), original = structuredClone(input);
  const result = screenReplacementWindows(input);
  assert.equal(result[0].eligibleForStructuralPreflight, true);
  assert.equal(Object.hasOwn(result[0], "trainingAllowed"), false);
  assert.deepEqual(input, original);
});

test("current dataset wins over any historical plan or mutable slot label", () => {
  const input = fixture();
  input.candidates[0].measurementBounds = bounds(1, 2);
  input.plan = { assignments: [] };
  input.rows[1].capacitySlotId = "misleading-label";
  const [result] = screenReplacementWindows(input);
  assert.equal(result.eligibleForStructuralPreflight, false);
  assert.deepEqual(result.currentReleaseOverlaps, [{ sampleId: "current-train", split: "train" }]);
});

test("the replaced sample's own source window remains excluded", () => {
  const input = fixture(); input.candidates[0].measurementBounds = bounds(0, 1);
  assert.equal(screenReplacementWindows(input)[0].eligibleForStructuralPreflight, false);
});

test("renaming ecology cannot override factual derivation", () => {
  const input = fixture();
  input.candidates[0].regionalLandscapeType = "wet-season-drainage-hollow";
  input.candidates[0].metrics.relativeRelief = 0.30;
  const [result] = screenReplacementWindows(input);
  assert.equal(result.derivedLandscapeType, "dry-dipterocarp-woodland");
  assert.deepEqual(result.failures, ["measurement_derived_ecology_mismatch"]);
});

test("borders may touch but tiny actual overlaps are not rounded away", () => {
  assert.equal(windowsOverlap(bounds(0, 1), bounds(1, 2)), false);
  assert.equal(windowsOverlap(bounds(0, 1), bounds(1 - 1e-12, 2)), true);
});

for (const [name, mutate, pattern] of [
  ["duplicate pool identity", f => f.candidates.push(structuredClone(f.candidates[0])), /duplicate/],
  ["missing facts", f => delete f.candidates[0].metrics.relativeElevation, /metrics missing/],
  ["NaN facts", f => f.candidates[0].metrics.relativeRelief = NaN, /metrics missing/],
  ["invalid pixel bounds", f => f.candidates[0].sourcePixelWindow.left = -1, /pixel window invalid/],
  ["absent current source window", f => delete f.rows[1].grouping, /bounds missing/],
  ["train target", f => f.rows[0].split = "train", /validation sample/],
  ["other ecology", f => f.rows[0].regionalLandscapeType = "bamboo-grove", /only wet-season/],
  ["unknown sample", f => f.sampleId = "194", /validation sample/],
]) test(`fail closed: ${name}`, () => {
  const input = fixture(); mutate(input); assert.throws(() => screenReplacementWindows(input), pattern);
});

function contextFixture() {
  const input = fixture();
  input.candidateId = input.candidates[0].candidateId;
  input.candidates.push({ candidateId: "measured-neighbor", measurementBounds: bounds(1, 2),
    sourcePixelWindow: { left: 93, top: 0, width: 93, height: 70 } });
  input.neighborPairing = { pairs: [{ sourceCandidateId: input.candidateId, neighborCandidateId: "measured-neighbor",
    neighborSourceWindow: structuredClone(input.candidates[1].sourcePixelWindow) }], gaps: [] };
  return input;
}

function consumedFixture() {
  const f = contextFixture();
  f.uses = [{ candidateId: f.candidateId, purpose: "primary_region_geometry", inputSha256: "a".repeat(64) },
    { candidateId: "measured-neighbor", purpose: "neighbor_joint_geometry", inputSha256: "b".repeat(64) }];
  return f;
}
test("consumed neighbor facts block a cross-split window claim without asserting optimizer leakage", () => {
  const f = consumedFixture(), before = structuredClone(f), r = auditConsumedSourceWindowIsolation(f);
  assert.deepEqual(f, before); assert.equal(r.status, "blocked_cross_split_consumed_source_window");
  assert.equal(r.conflicts.length, 1); assert.equal(r.conflicts[0].sampleId, "current-train");
  assert.equal(r.sourceWindowIsolationPassed, false); assert.equal(r.optimizerExposureEstablished, false);
  assert.equal(r.trainingAllowed, false); assert.equal(r.holdoutQualified, false);
});
test("mere neighbor discovery is not silently counted as generator consumption", () => {
  const f = consumedFixture(); f.uses.pop();
  const r = auditConsumedSourceWindowIsolation(f);
  assert.equal(r.conflicts.length, 0); assert.equal(r.sourceWindowIsolationPassed, true); assert.equal(r.trainingAllowed, false);
});
test("same-split shared facts still do not grant complete holdout or novelty qualification", () => {
  const f = consumedFixture(); f.rows[1].split = "validation";
  const r = auditConsumedSourceWindowIsolation(f);
  assert.equal(r.sourceWindowIsolationPassed, true); assert.equal(r.windows[1].overlaps.length, 1);
  assert.equal(r.holdoutQualified, false);
});
for (const [name, mutate] of [
  ["unbound use", f => delete f.uses[0].inputSha256],
  ["unknown candidate", f => f.uses[0].candidateId = "absent"],
  ["unknown purpose", f => f.uses[1].purpose = "read_only_discovery"],
  ["duplicate use", f => f.uses.push(structuredClone(f.uses[0]))],
  ["empty uses", f => f.uses = []],
  ["missing grouping", f => delete f.rows[1].grouping],
  ["invalid split", f => f.rows[1].split = "arbitrary"],
]) test(`consumed source audit rejects ${name}`, () => {
  const f = consumedFixture(); mutate(f); assert.throws(() => auditConsumedSourceWindowIsolation(f));
});

test("neighbor source overlap is explicit without claiming sample or optimizer leakage", () => {
  const input = contextFixture(), before = structuredClone(input), result = auditReplacementNeighborContext(input);
  assert.equal(result.crossSplitContextObserved, true);
  assert.deepEqual(result.windows[0].currentReleaseOverlaps, []);
  assert.deepEqual(result.windows[1].currentReleaseOverlaps,
    [{ sampleId: "current-train", split: "train", differsFromTargetSplit: true }]);
  assert(Object.values(result.qualification).every(value => value === false));
  assert.deepEqual(input, before);
});
test("same-split neighbors and shared borders do not imply an independent holdout pass", () => {
  const input = contextFixture(); input.rows[1].split = "validation";
  const same = auditReplacementNeighborContext(input);
  assert.equal(same.crossSplitContextObserved, false); assert.equal(same.qualification.holdoutQualified, false);
  input.candidates[1].measurementBounds = bounds(3, 4);
  assert.deepEqual(auditReplacementNeighborContext(input).windows[1].currentReleaseOverlaps, []);
});
test("multiple ports to the same neighbor are not counted as multiple source regions", () => {
  const input = contextFixture(); input.neighborPairing.pairs.push(structuredClone(input.neighborPairing.pairs[0]));
  assert.equal(auditReplacementNeighborContext(input).windows.length, 2);
});
for (const [name, mutate, pattern] of [
  ["missing neighbor", f => f.neighborPairing.pairs[0].neighborCandidateId = "absent", /identity mismatch/],
  ["forged neighbor bounds", f => f.neighborPairing.pairs[0].neighborSourceWindow.left++, /window mismatch/],
  ["wrong source identity", f => f.neighborPairing.pairs[0].sourceCandidateId = "other", /identity mismatch/],
  ["missing source bounds", f => delete f.rows[1].grouping, /bounds missing/],
  ["invalid split", f => f.rows[1].split = "not-a-split", /membership/],
  ["duplicate candidate", f => f.candidates.push(structuredClone(f.candidates[1])), /candidate pool/],
]) test(`source context rejects ${name}`, () => {
  const input = contextFixture(); mutate(input); assert.throws(() => auditReplacementNeighborContext(input), pattern);
});
