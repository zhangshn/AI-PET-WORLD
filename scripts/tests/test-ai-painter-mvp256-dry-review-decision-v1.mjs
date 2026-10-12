import assert from "node:assert/strict"
import test from "node:test"

import { decideMvp256DryReview } from
  "../lib/ai-painter-mvp256-dry-review-decision-v1.mjs"

const roles = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
const good = () => ({
  scope: { sampleId: "slot-189", worldFactHasWater: false,
    conditionWaterPixelCount: 0, conditionShorelinePixelCount: 0 },
  candidate: { sampleId: "slot-189", split: "validation", resolution: [256, 192] },
  detail: { passed: true, issueCodes: [] },
  aesthetic: { passed: true, issues: [] },
  alignment: { passed: true, issues: [],
    channelAudits: [{ channelId: "terrain_water", absenceExpected: true,
      expectedNonZeroRatio: 0, passed: true }],
    objectSemanticAudits: roles.map(channelId => ({ channelId, passed: true })) },
  responsibilityRoleCount: 7,
})

test("passing numeric checks remain visual and Stage4 pending", () => {
  const result = decideMvp256DryReview(good())
  assert.equal(result.status, "dry_single_world_numeric_passed_visual_approval_pending")
  assert.equal(result.visualApprovalGranted, false)
  assert.equal(result.formalStage4QualificationGranted, false)
  assert.equal(result.runtimePublicationGranted, false)
})

test("semantic issue fails closed without changing other gates", () => {
  const input = good()
  input.alignment.passed = false
  input.alignment.objectSemanticAudits[2].passed = false
  input.alignment.issues = [{ code: "condition_object_rock_reference_semantic_mismatch" }]
  const result = decideMvp256DryReview(input)
  assert.equal(result.status, "dry_single_world_review_failed_closed")
  assert.deepEqual(result.issueCodes, ["condition_object_rock_reference_semantic_mismatch"])
})

test("water, missing roles, identity drift and inconsistent auditors cannot pass", () => {
  for (const mutate of [
    x => { x.scope.worldFactHasWater = true },
    x => { x.scope.conditionWaterPixelCount = 1 },
    x => { x.candidate.sampleId = "other" },
    x => { x.candidate.resolution = [1024, 768] },
    x => { x.responsibilityRoleCount = 6 },
    x => { x.alignment.channelAudits[0].absenceExpected = false },
    x => { x.alignment.objectSemanticAudits.pop() },
    x => { x.alignment.passed = false },
    x => { x.alignment.issues.push({ code: "unaccounted_issue" }) },
  ]) {
    const input = good()
    mutate(input)
    assert.throws(() => decideMvp256DryReview(input))
  }
})
