import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import sharp from "sharp";
import { replayConclusion } from "../review-ai-painter-stage4-composition-replacements.mjs";

test("RGB success never grants semantic or training qualification", () => {
  const result = replayConclusion({ passed: true, skippedRecordCount: 0 },
    { passed: false, skippedRecordCount: 0, issues: [{ code: "old_failure" }] }, ["old_failure"]);
  assert.equal(result.currentRgbProxyPassed, true);
  assert.equal(result.historicalRejectionStillDetected, true);
  assert.equal(result.semanticUniquenessQualified, false);
  assert.equal(result.trainingAllowed, false);
});
test("unreadable reference or lost negative control cannot count as successful replay", () => {
  assert.equal(replayConclusion({ passed: true, skippedRecordCount: 1 },
    { passed: true, skippedRecordCount: 0, issues: [] }, ["old_failure"]).currentRgbProxyPassed, false);
  assert.equal(replayConclusion({ passed: true, skippedRecordCount: 0 },
    { passed: false, skippedRecordCount: 0, issues: [{ code: "unrelated" }] }, ["old_failure"])
    .historicalRejectionStillDetected, false);
});

test("historical composition gate cannot be waived by review status or absent Owner labels", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-composition-regression-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const library = path.join(root, "data/world-samples/original-image-library/natural-home-v1");
  fs.mkdirSync(library, { recursive: true });
  // Synthetic non-training fixtures isolate the existing threshold decision.
  const a = await sharp({ create: { width: 64, height: 48, channels: 3,
    background: { r: 140, g: 110, b: 70 } } }).png().toBuffer();
  const b = await sharp({ create: { width: 64, height: 48, channels: 3,
    background: { r: 145, g: 115, b: 75 } } }).png().toBuffer();
  fs.writeFileSync(path.join(root, "candidate.png"), a);
  fs.mkdirSync(path.join(root, "history"));
  fs.writeFileSync(path.join(root, "history/old.png"), b);
  fs.writeFileSync(path.join(root, "history/machine.json"), JSON.stringify({
    status: "machine_rejected", passed: false, issues: [{ code: "complete_map_composition_diversity_failed" }],
  }));
  fs.writeFileSync(path.join(root, "history/owner.json"), JSON.stringify({ decision: "owner_approved" }));
  fs.writeFileSync(path.join(root, "history/rejected.json"), JSON.stringify({
    decision: "owner_rejected", reasonCodes: ["composition_duplicate"],
  }));
  fs.writeFileSync(path.join(root, "history/other-rejection.json"), JSON.stringify({
    decision: "owner_rejected", reasonCodes: ["road_out_of_bounds"],
  }));
  fs.writeFileSync(path.join(root, "history/malformed.json"), "{");
  fs.writeFileSync(path.join(root, "history/distinct.png"), await sharp({ create: {
    width: 64, height: 48, channels: 3, background: { r: 20, g: 170, b: 30 },
  } }).png().toBuffer());
  const moduleUrl = new URL("../lib/ai-assisted-composition-novelty.mjs", import.meta.url).href;
  const script = `import {auditAiAssistedCompositionNovelty as audit} from ${JSON.stringify(moduleUrl)};
    const r=await audit({record:{recordId:'candidate',createdAtUtc:'2026-01-02T00:00:00Z'},imagePath:'candidate.png'});
    console.log(JSON.stringify(r));`;
  const scenarios = [
    { name: "no_owner_label", reviews: {} },
    { name: "machine_rejected_only", reviews: { machineReviewPath: "history/machine.json" } },
    { name: "pending", status: "pending", reviews: {} },
    { name: "machine_approved", status: "machine_approved", reviews: {} },
    { name: "owner_approved", reviews: { ownerReviewPath: "history/owner.json" } },
    { name: "owner_composition_rejected", reviews: { ownerReviewPath: "history/rejected.json" }, legacyRejection: true },
    { name: "owner_other_rejection", reviews: { ownerReviewPath: "history/other-rejection.json" } },
    { name: "missing_owner_review_file", reviews: { ownerReviewPath: "history/missing.json" } },
    { name: "missing_machine_review_file", reviews: { machineReviewPath: "history/missing.json" } },
  ];
  function run(scenario) {
    fs.writeFileSync(path.join(library, "index.json"), JSON.stringify({ records: [{
      recordId: scenario.recordId ?? "historical", categoryId: "complete-maps", status: scenario.status ?? "rejected",
      relativeDirectory: "history", originalImage: { path: scenario.image ?? "old.png" }, reviews: scenario.reviews,
      createdAtUtc: scenario.createdAtUtc ?? "2026-01-01T00:00:00Z",
    }] }));
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  for (const scenario of scenarios) {
    await t.test(scenario.name, () => {
      const value = run(scenario);
      assert.equal(value.nearestComparisons[0].matchesMacroCompositionPattern, true);
      assert.equal(value.nearestComparisons[0].nearExactDuplicate, false);
      assert.equal(value.passed, false);
      assert.equal(value.skippedRecordCount, 0);
      assert.equal(value.historicalCompleteMapImagesCompared, 1);
      assert.deepEqual(value.historicalCompositionMatches.map((r) => r.recordId), ["historical"]);
      assert.ok(value.issues.some((r) => r.code === "complete_map_composition_diversity_failed"));
      assert.equal(value.issues.some((r) => r.code === "historical_rejected_composition_duplicate"), !!scenario.legacyRejection);
      assert.match(value.method, /review_status_independent_v7$/);
      assert.deepEqual(value.thresholds, {
        exactOrNearDuplicateMaximumDHashDistance: 4,
        exactOrNearDuplicateMaximumThumbnailDifference: 4,
        rejectedCompositionMaximumBlurredThumbnailDifference: 4,
        macroCompositionMaximumBlurredThumbnailDifference: 6,
        rejectedCompositionMinimumWaterLayoutIntersection: 0.65,
        rejectedCompositionMinimumRouteLayoutIntersection: 0.45,
        macroCompositionMinimumWaterLayoutIntersection: 0.7,
        macroCompositionMinimumRouteLayoutIntersection: 0.55,
        macroCompositionMinimumNormalizedWaterShapeIntersection: 0.45,
      });
    });
  }
  await t.test("distinct image passes even when historical image was rejected", () => {
    const value = run({ image: "distinct.png", reviews: { ownerReviewPath: "history/rejected.json" } });
    assert.equal(value.passed, true);
    assert.equal(value.historicalCompleteMapImagesCompared, 1);
    assert.deepEqual(value.historicalCompositionMatches, []);
  });
  await t.test("unreadable review or missing image fails closed", () => {
    for (const scenario of [{ reviews: { ownerReviewPath: "history/malformed.json" } }, { image: "missing.png" }]) {
      const value = run(scenario);
      assert.equal(value.passed, false);
      assert.equal(value.skippedRecordCount, 1);
      assert.ok(value.issues.some((r) => r.code === "historical_complete_map_comparison_incomplete"));
    }
  });
  await t.test("chronology cutoff and self-record exclusion stay unchanged", () => {
    for (const scenario of [{ createdAtUtc: "2026-01-03T00:00:00Z" }, { recordId: "candidate" }]) {
      const value = run(scenario);
      assert.equal(value.passed, true);
      assert.equal(value.historicalCompleteMapImagesCompared, 0);
      assert.equal(value.chronologyExcludedRecordCount, scenario.createdAtUtc ? 1 : 0);
    }
  });
});
