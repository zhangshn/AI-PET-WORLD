import assert from "node:assert/strict";
import { test } from "node:test";
import { auditAnonymousWaterCorridorShape } from "../lib/anonymous-water-naturalness.mjs";

const points = Array.from({ length: 101 }, (_, i) => ({ x: 10 * Math.sin(i / 100 * Math.PI * 2), y: i * 5 }));
const halfWidths = points.map(() => 4);
const rotate = (p, n) => n === 0 ? { ...p } : n === 1 ? { x: p.y, y: -p.x }
  : n === 2 ? { x: -p.x, y: -p.y } : { x: -p.y, y: p.x };
test("explicit flow direction preserves corridor decisions in all four orientations", () => {
  const baseline = auditAnonymousWaterCorridorShape(points, halfWidths);
  assert.equal(baseline.passed, true);
  for (let n = 0; n < 4; n++) {
    const result = auditAnonymousWaterCorridorShape(points.map(p => rotate(p, n)), halfWidths,
      { downstreamDirection: rotate({ x: 0, y: 1 }, n) });
    assert.equal(result.schemaVersion, "anonymous-water-corridor-shape-audit-v2");
    assert.equal(result.passed, true); assert.deepEqual(result.failures, baseline.failures);
    assert.equal(result.minimumRequiredBendRadiusToHalfWidthRatio, 1.15);
    assert.equal(result.minimumBendRadiusToHalfWidthRatio, baseline.minimumBendRadiusToHalfWidthRatio);
    assert.equal(result.downstreamBacktrackCount, 0);
  }
});
test("reversed flow is rejected rather than changing the acceptance threshold", () => {
  const result = auditAnonymousWaterCorridorShape(points, halfWidths, { downstreamDirection: { x: 0, y: -1 } });
  assert.equal(result.downstreamBacktrackCount, 100); assert.equal(result.passed, false);
  assert(result.failures.includes("water_downstream_axis_backtracks"));
});
test("legacy default output remains the same as explicit south except versioned direction fields", () => {
  const legacy = auditAnonymousWaterCorridorShape(points, halfWidths);
  const { downstreamDirection, schemaVersion, ...explicit } = auditAnonymousWaterCorridorShape(points, halfWidths,
    { downstreamDirection: { x: 0, y: 3 } });
  const { schemaVersion: legacySchema, ...old } = legacy;
  assert.equal(legacySchema, "anonymous-water-corridor-shape-audit-v1");
  assert.deepEqual(explicit, old); assert.deepEqual(downstreamDirection, { x: 0, y: 1 });
});
test("invalid directions, points and widths cannot silently pass", () => {
  for (const direction of [{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 1, y: Infinity }])
    assert.throws(() => auditAnonymousWaterCorridorShape(points, halfWidths, { downstreamDirection: direction }));
  const corrupt = structuredClone(points); corrupt[1].x = NaN;
  assert.throws(() => auditAnonymousWaterCorridorShape(corrupt, halfWidths));
  assert.throws(() => auditAnonymousWaterCorridorShape(points, halfWidths.map(() => 0)));
});
test("width discontinuity still fails for an east-flowing corridor", () => {
  const widths = [...halfWidths]; widths[50] += 5;
  const result = auditAnonymousWaterCorridorShape(points.map(p => rotate(p, 1)), widths,
    { downstreamDirection: { x: 1, y: 0 } });
  assert(result.failures.includes("water_width_step_too_abrupt"));
});
