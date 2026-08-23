import assert from "node:assert/strict"
import { CAPACITY_ARM, OWNER_ROUTE_OPTIONS, validateCapacityRouteExitEvidence, validateProjectRouteDecisionRequest } from "./lib/ai-painter-stage4-capacity-route-exit-project-route-decision.mjs"

const evidence = () => ({
  reviewTerminal: { status: "capacity_best_checkpoint_epoch37_machine_review_failed_closed", passed: false, issueCodes: ["condition_terrain_path_ground_required_boundary_contact_missing", "condition_object_tree_reference_semantic_mismatch", "condition_object_vegetation_reference_semantic_mismatch"] },
  machineReview: { epoch: 37, sourcePreview: { sha256: "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f" }, reproducedPreview: { sha256: "bd9590ee477e2775f089d69cc64fda3e292c18d7f1958b796ff0f19a2dbec15f" }, professionalAesthetic: { passed: true }, conditionAlignment: { channelAudits: [{ channelId: "terrain_water", passed: true }], objectSemanticAudits: [
    { channelId: "object_footprints", passed: true }, { channelId: "object_rock", passed: true },
    { channelId: "object_tree", passed: false, referenceResponse: { maskedLumaCorrelation: 0.0479 }, referenceThresholds: { minimumMaskedLumaCorrelation: 0.08 } },
    { channelId: "object_vegetation", passed: false, referenceResponse: { maskedLumaCorrelation: 0.0309 }, referenceThresholds: { minimumMaskedLumaCorrelation: 0.08 } },
  ] } },
  cpuReport: { status: "stage4_capacity_best_checkpoint_preview_review_cpu_passed", checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false },
  ownerRequest: { requestedAction: "capacity_route_exit_and_project_level_model_route_decision" },
  stage0Terminal: { status: "semantic_mixture_stage4_formal_stage_failed_closed", manifest: { sha256: "cfe010355d83f73cc3e92fff362f0c4979c1b2682f91fa89b026dbb548a138c9" }, machineReview: { passCount: 0, failCount: 6 } },
  stage0Manifest: { bestEpoch: 37, trainingTokenAccounting: { runTotals: { epochCount: 40, optimizerSteps: 5760 } } },
})
const request = () => ({ status: "owner_project_level_route_decision_required", exitedCandidate: CAPACITY_ARM, options: [...OWNER_ROUTE_OPTIONS], selectedOption: null, fixedTotalProgress: { percent: 60 }, stage1Started: false, stage2Started: false, automaticExpansionAllowed: false })
const positives = [], negatives = []
validateCapacityRouteExitEvidence(evidence()); positives.push("accepts_exact_bound_failure_facts")
validateProjectRouteDecisionRequest(request()); positives.push("accepts_exact_four_option_owner_request")
for (const [name, mutate, pattern] of [
  ["rejects_preview_pass_substitution", (v) => { v.reviewTerminal.passed = true }, /true !== false/],
  ["rejects_epoch_change", (v) => { v.machineReview.epoch = 36 }, /36 !== 37/],
  ["rejects_source_identity_change", (v) => { v.machineReview.sourcePreview.sha256 = "0".repeat(64) }, /actual.*expected|Expected values/],
  ["rejects_tree_metric_change", (v) => { v.machineReview.conditionAlignment.objectSemanticAudits[2].referenceResponse.maskedLumaCorrelation = 0.08 }, /0.08 !== 0.0479/],
  ["rejects_vegetation_metric_change", (v) => { v.machineReview.conditionAlignment.objectSemanticAudits[3].referenceResponse.maskedLumaCorrelation = 0.08 }, /0.08 !== 0.0309/],
  ["rejects_threshold_change", (v) => { v.machineReview.conditionAlignment.objectSemanticAudits[2].referenceThresholds.minimumMaskedLumaCorrelation = 0.07 }, /0.07 !== 0.08/],
  ["rejects_checkpoint_read", (v) => { v.cpuReport.checkpointWeightsRead = true }, /true !== false/],
  ["rejects_gpu_action", (v) => { v.cpuReport.gpuStarted = true }, /true !== false/],
  ["rejects_training_action", (v) => { v.cpuReport.trainingStarted = true }, /true !== false/],
  ["rejects_incomplete_stage0", (v) => { v.stage0Manifest.trainingTokenAccounting.runTotals.optimizerSteps = 5759 }, /5759 !== 5760/],
]) { const value = evidence(); mutate(value); assert.throws(() => validateCapacityRouteExitEvidence(value), pattern); negatives.push(name) }
for (const [name, mutate] of [
  ["rejects_missing_owner_option", (v) => { v.options.pop() }],
  ["rejects_reordered_owner_options", (v) => { v.options.reverse() }],
  ["rejects_extra_owner_option", (v) => { v.options.push("free_expansion") }],
  ["rejects_preselected_owner_option", (v) => { v.selectedOption = v.options[0] }],
  ["rejects_capacity_route_not_exited", (v) => { v.exitedCandidate = "active" }],
  ["rejects_stage1_started", (v) => { v.stage1Started = true }],
  ["rejects_automatic_expansion", (v) => { v.automaticExpansionAllowed = true }],
]) { const value = request(); mutate(value); assert.throws(() => validateProjectRouteDecisionRequest(value)); negatives.push(name) }
console.log(JSON.stringify({ schemaVersion: "stage4-capacity-route-exit-project-route-decision-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives, executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, modelImplemented: false } }, null, 2))
