import assert from "node:assert/strict"

export const CAPACITY_ARM = "capacity_only_base_width_64_to_existing_level1_128"
export const OWNER_ROUTE_OPTIONS = Object.freeze([
  "pause_stage4_model_construction_at_60_percent",
  "authorize_bounded_new_model_family_design_only",
  "authorize_business_scope_or_generation_paradigm_review_only",
  "evidence_insufficient_for_project_level_route_decision",
])

export function validateCapacityRouteExitEvidence({ reviewTerminal, machineReview, cpuReport, ownerRequest, stage0Terminal, stage0Manifest }) {
  assert.equal(reviewTerminal.status, "capacity_best_checkpoint_epoch37_machine_review_failed_closed")
  assert.equal(reviewTerminal.passed, false)
  assert.deepEqual(reviewTerminal.issueCodes, [
    "condition_terrain_path_ground_required_boundary_contact_missing",
    "condition_object_tree_reference_semantic_mismatch",
    "condition_object_vegetation_reference_semantic_mismatch",
  ])
  assert.equal(machineReview.epoch, 37)
  assert.equal(machineReview.sourcePreview.sha256, "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f")
  assert.equal(machineReview.reproducedPreview.sha256, machineReview.sourcePreview.sha256)
  assert.equal(machineReview.professionalAesthetic.passed, true)
  assert.equal(machineReview.conditionAlignment.channelAudits.find((row) => row.channelId === "terrain_water")?.passed, true)
  const objects = new Map(machineReview.conditionAlignment.objectSemanticAudits.map((row) => [row.channelId, row]))
  assert.equal(objects.get("object_footprints")?.passed, true)
  assert.equal(objects.get("object_rock")?.passed, true)
  assert.equal(objects.get("object_tree")?.passed, false)
  assert.equal(objects.get("object_tree")?.referenceResponse?.maskedLumaCorrelation, 0.0479)
  assert.equal(objects.get("object_vegetation")?.passed, false)
  assert.equal(objects.get("object_vegetation")?.referenceResponse?.maskedLumaCorrelation, 0.0309)
  assert.equal(objects.get("object_tree")?.referenceThresholds?.minimumMaskedLumaCorrelation, 0.08)
  assert.equal(objects.get("object_vegetation")?.referenceThresholds?.minimumMaskedLumaCorrelation, 0.08)
  assert.equal(cpuReport.status, "stage4_capacity_best_checkpoint_preview_review_cpu_passed")
  assert.equal(cpuReport.checkpointWeightsRead, false)
  assert.equal(cpuReport.gpuStarted, false)
  assert.equal(cpuReport.trainingStarted, false)
  assert.equal(ownerRequest.requestedAction, "capacity_route_exit_and_project_level_model_route_decision")
  assert.equal(stage0Terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(stage0Terminal.manifest.sha256, "cfe010355d83f73cc3e92fff362f0c4979c1b2682f91fa89b026dbb548a138c9")
  assert.equal(stage0Terminal.machineReview.passCount, 0)
  assert.equal(stage0Terminal.machineReview.failCount, 6)
  assert.equal(stage0Manifest.trainingTokenAccounting.runTotals.epochCount, 40)
  assert.equal(stage0Manifest.trainingTokenAccounting.runTotals.optimizerSteps, 5760)
  assert.equal(stage0Manifest.bestEpoch, 37)
  return { objects }
}

export function validateProjectRouteDecisionRequest(request) {
  assert.equal(request.status, "owner_project_level_route_decision_required")
  assert.equal(request.exitedCandidate, CAPACITY_ARM)
  assert.deepEqual(request.options, OWNER_ROUTE_OPTIONS)
  assert.equal(request.selectedOption, null)
  assert.equal(request.fixedTotalProgress.percent, 60)
  assert.equal(request.stage1Started, false)
  assert.equal(request.stage2Started, false)
  assert.equal(request.automaticExpansionAllowed, false)
  return true
}
