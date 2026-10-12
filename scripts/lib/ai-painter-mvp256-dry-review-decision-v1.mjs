// Decision only. Callers must first verify immutable bindings and run the
// existing image auditors; this function does not grant model publication.
import assert from "node:assert/strict"

const OBJECT_ROLES = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]

export function decideMvp256DryReview({ scope, candidate, detail, aesthetic, alignment,
  responsibilityRoleCount }) {
  assert.equal(scope?.worldFactHasWater, false, "dry scope has water")
  assert.equal(scope?.conditionWaterPixelCount, 0, "dry scope water channel is nonempty")
  assert.equal(scope?.conditionShorelinePixelCount, 0, "dry scope shoreline is nonempty")
  assert.equal(candidate?.sampleId, scope.sampleId, "review subject changed")
  assert.equal(candidate?.split, "validation", "subject is not validation")
  assert.deepEqual(candidate?.resolution, [256, 192], "candidate is not native 256x192")
  assert.equal(responsibilityRoleCount, 7, "seven bound responsibility roles required")
  for (const verdict of [detail, aesthetic, alignment])
    assert.equal(typeof verdict?.passed, "boolean", "auditor verdict missing")
  assert.ok(Array.isArray(detail.issueCodes), "detail issue codes missing")
  assert.ok(Array.isArray(aesthetic.issues), "aesthetic issues missing")
  assert.ok(Array.isArray(alignment.issues), "alignment issues missing")
  assert.ok(Array.isArray(alignment.channelAudits), "alignment channel audits missing")
  assert.ok(Array.isArray(alignment.objectSemanticAudits), "object audits missing")
  const water = alignment.channelAudits.filter(row => row.channelId === "terrain_water")
  assert.equal(water.length, 1, "unique water audit required")
  assert.equal(water[0].absenceExpected, true, "water absence was not audited")
  assert.equal(water[0].expectedNonZeroRatio, 0, "water expectation differs")
  const objects = alignment.objectSemanticAudits.filter(row => OBJECT_ROLES.includes(row.channelId))
  assert.deepEqual(objects.map(row => row.channelId).sort(), [...OBJECT_ROLES].sort(),
    "four natural object audits required")
  const issues = [
    ...detail.issueCodes,
    ...aesthetic.issues.map(issue => issue.code),
    ...alignment.issues.map(issue => issue.code),
  ]
  assert.ok(issues.every(code => typeof code === "string" && code), "invalid issue code")
  const passed = detail.passed && aesthetic.passed && alignment.passed
    && water[0].passed === true && objects.every(row => row.passed === true)
  assert.equal(passed, issues.length === 0,
    "audit verdict and issue list disagree; refuse to infer success")
  return {
    status: passed ? "dry_single_world_numeric_passed_visual_approval_pending"
      : "dry_single_world_review_failed_closed",
    issueCodes: [...new Set(issues)],
    detailPassed: detail.passed,
    aestheticPassed: aesthetic.passed,
    alignmentPassed: alignment.passed,
    waterAbsencePassed: water[0].passed,
    objectSemanticsPassed: objects.every(row => row.passed === true),
    positiveWaterAndShorelineCapability: "unverified_not_passed",
    visualApprovalGranted: false,
    formalStage4QualificationGranted: false,
    runtimePublicationGranted: false,
  }
}
