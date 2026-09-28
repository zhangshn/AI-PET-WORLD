import assert from "node:assert/strict"
import test from "node:test"
import { audit, decideNumericAuditStatus, validateMaterializationHeader } from
  "../run-ai-painter-stage4-mvp-v21-dry-independent-audit.mjs"

const fixture = () => ({
  schemaVersion: "ai-painter-stage4-mvp-object-residual-v21-dry-review-materialization-v1",
  status: "dry_review_materialized_pending_independent_audit",
  capabilityVersion: "stage4_mvp_native_rgb_object_residual_v21_support_trial",
  runId: "mvp-v21-dry-stage0-123c625425ce959dbc0a8d5065bf158ecf97c164b07aaa4e",
  candidateCount: 1, device: "cuda", precision: "bfloat16",
  weightsUnmodifiedVerified: true, visualQualityGranted: false,
  stage4ProgressIncreaseGranted: false, selectedEpoch: 24,
  waterAndShorelinePositiveCapability: "unverified_not_passed",
  selectedRank: [.3, -1, -24],
  selectionAudit: { selectedRank: [.3, -1, -24],
    epochSummaries: Array.from({ length: 24 }, (_, i) => ({
      path: `synthetic/epoch-${i + 1}.json`, sha256: "1".repeat(64),
    })) },
  candidate: { sampleId: "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2",
    split: "validation", sampleIndex: 0,
    artifactIdentity: { inferenceMode: "bound_v21_bfloat16_generator_only_to_complete_rgb" } },
  objectResidualEvidence: {
    scope: {
      object_footprints: { source: "authoritative_condition_mask", radius: 0 },
      object_tree: { source: "bound_instance_role_coverage", radius: 8 },
      object_rock: { source: "bound_instance_role_coverage", radius: 4 },
      object_vegetation: { source: "bound_instance_role_coverage", radius: 6 },
      typedCoreOverride: true, crossClassRingOverlap: "excluded",
      outsideBoundObjectCoverage: "zero_residual",
    },
    meaning: "bound_support_and_rgb_contribution_diagnostic_not_visual_qualification",
    roles: Object.fromEntries(["object_footprints", "object_tree", "object_rock", "object_vegetation"]
      .map(role => [role, { corePixels: 1, visibleSupportPixels: 1,
        residualAbsoluteSum: 0, outsideSupportAbsoluteSum: 0,
        applicability: "diagnostic_only" }])),
  },
})

test("V21 independent audit accepts only its pending metadata boundary", () => {
  validateMaterializationHeader(fixture())
})

test("foreign, incomplete, or falsely qualified materialization fails before evidence reads", () => {
  for (const change of [
    x => { x.schemaVersion = "v17" },
    x => { x.status = "failed_closed" },
    x => { x.capabilityVersion = "stage4_mvp_native_rgb_structured_object_v17" },
    x => { x.runId = "foreign" },
    x => { x.device = "cpu" },
    x => { x.precision = "float32" },
    x => { x.weightsUnmodifiedVerified = false },
    x => { x.visualQualityGranted = true },
    x => { x.waterAndShorelinePositiveCapability = "passed" },
    x => { x.candidate.sampleId = "slot-190" },
    x => { x.candidate.split = "challenge" },
    x => { x.candidate.artifactIdentity.inferenceMode = "bound_v17_bfloat16_generator_only_to_complete_rgb" },
    x => { x.selectedEpoch = 7 },
    x => { x.selectionAudit.epochSummaries.pop() },
    x => { x.selectedRank = [1, 0, -24] },
    x => { x.objectResidualEvidence.roles.object_tree.outsideSupportAbsoluteSum = 1 },
    x => { x.objectResidualEvidence.roles.object_rock.visibleSupportPixels = 0 },
    x => { x.objectResidualEvidence.scope.typedCoreOverride = false },
  ]) {
    const value = fixture(); change(value)
    assert.throws(() => validateMaterializationHeader(value))
  }
})

test("audit output cannot escape its immutable materialization directory", async () => {
  await assert.rejects(() => audit({ reportBinding: {
    path: "synthetic/dry-review/report.json", sha256: "1".repeat(64),
  }, outputPath: "synthetic/other/independent-audit.json" }))
})

test("any failed or absent current numeric verdict fails closed", () => {
  const pass = { passed: true }, fail = { passed: false }
  assert.equal(decideNumericAuditStatus(pass, pass, pass),
    "dry_single_world_numeric_audit_passed_visual_approval_pending")
  for (const verdicts of [[fail, pass, pass], [pass, fail, pass],
    [pass, pass, fail]])
    assert.equal(decideNumericAuditStatus(...verdicts),
      "dry_single_world_visual_slice_failed_closed")
  assert.throws(() => decideNumericAuditStatus(pass, {}, pass))
})
