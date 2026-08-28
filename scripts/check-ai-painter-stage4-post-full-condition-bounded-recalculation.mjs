import assert from "node:assert/strict";
import {
  FULL_CONDITION_CAPABILITY_VERSION,
  adjudicatePostFullConditionBoundedCandidate,
} from "./lib/ai-painter-stage4-post-full-condition-bounded-recalculation-v1.mjs";

const objectFailures = [
  "condition_object_footprints_reference_semantic_mismatch",
  "condition_object_tree_reference_semantic_mismatch",
  "condition_object_rock_reference_semantic_mismatch",
  "condition_object_vegetation_reference_semantic_mismatch",
];
const fixture = {
  registry: {
    capabilityVersion: FULL_CONDITION_CAPABILITY_VERSION,
    taskId: "reject_current_model_family_and_return_to_bounded_candidate_planning",
    activity: "planned_not_started",
    latestTrainingTerminal: {
      runId: "formal-full-condition-stage0",
      status: "post_decode_full_condition_responsibility_stage0_real_visual_failure",
    },
  },
  lifecycleCandidate: {
    capabilityVersion: FULL_CONDITION_CAPABILITY_VERSION,
    changeClass: "model_family",
    selectedOption:
      "post_decode_full_condition_route_and_object_responsibility_renderer",
    ownerAuthorizationRequired: false,
  },
  lifecycleState: {
    capabilityVersion: FULL_CONDITION_CAPABILITY_VERSION,
    state: "rejected",
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
  },
  lifecycleRejectedEvidence: { targetState: "rejected", status: "failed" },
  boundedCandidate: {
    status: "cpu_inactive_candidate_planned_not_implemented",
    selectedCandidate: {
      candidateKind:
        "post_decode_full_condition_route_and_object_responsibility_renderer",
      responsibilityIdentityOrder: [
        "terrain_path_ground",
        "object_footprints",
        "object_tree",
        "object_rock",
        "object_vegetation",
      ],
      perResponsibilityInput: {
        decodedRgbChannels: 3,
        typedConditionChannels: 23,
        totalChannels: 26,
      },
      existingDerivedWidth: 64,
      perResponsibilityOutputChannels: 3,
    },
    freeArchitectureParameterChosen: false,
    lossChanged: false,
    dataChanged: false,
    thresholdChanged: false,
  },
  stage0Terminal: {
    schemaVersion:
      "stage4-post-decode-full-condition-responsibility-stage0-terminal-v1",
    executionState: "completed",
    status: "post_decode_full_condition_responsibility_stage0_real_visual_failure",
    capabilityVersion: FULL_CONDITION_CAPABILITY_VERSION,
    runId: "formal-full-condition-stage0",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  },
  failureDecision: {
    status: "unique_decision_formed",
    classification:
      "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed",
    currentCandidateRejected: true,
    automaticRetryStarted: false,
    nextAction: "reject_current_model_family_and_return_to_bounded_candidate_planning",
  },
  classificationCorrection: {
    status: "append_only_classification_identity_corrected",
    recordedClassification:
      "authoritative_semantic_carrier_multisample_semantic_capacity_insufficient_confirmed",
    correctedClassification:
      "post_decode_full_condition_responsibility_multisample_semantic_capacity_insufficient_confirmed",
    semanticReviewResultChanged: false,
    machineReviewThresholdsChanged: false,
  },
  machineReview: {
    status: "machine_reviews_failed",
    reviewThresholdsChanged: false,
    previewCount: 6,
    previewPassCount: 0,
    previewFailCount: 6,
    reviews: [1, 5, 10, 20, 30, 40].map((epoch) => ({
      epoch,
      passed: false,
      issueCodes: [...objectFailures],
      professionalAesthetic: { passed: true },
    })),
  },
};

const result = adjudicatePostFullConditionBoundedCandidate(fixture);
assert.equal(result.status, "failed_closed_candidate_space_exhausted");
assert.equal(
  result.selectedOutcome,
  "no_unique_bounded_candidate_registered_after_full_condition_failure",
);
assert.equal(result.ownerAuthorizationRequired, false);
assert.equal(result.gpuAllowed, false);
assert.equal(result.trainingAllowed, false);

const mutations = [
  ["registry task changed", (value) => (value.registry.taskId = "old_smoke")],
  ["lifecycle not rejected", (value) => (value.lifecycleState.state = "qualified")],
  ["candidate changed", (value) => (value.boundedCandidate.selectedCandidate.candidateKind = "free_candidate")],
  ["condition channels changed", (value) => (value.boundedCandidate.selectedCandidate.perResponsibilityInput.typedConditionChannels = 22)],
  ["free parameter injected", (value) => (value.boundedCandidate.freeArchitectureParameterChosen = true)],
  ["review pass injected", (value) => (value.machineReview.previewPassCount = 1)],
  ["review omitted", (value) => value.machineReview.reviews.pop()],
  ["object failure omitted", (value) => value.machineReview.reviews[0].issueCodes.pop()],
  ["threshold changed", (value) => (value.machineReview.reviewThresholdsChanged = true)],
  ["retry started", (value) => (value.failureDecision.automaticRetryStarted = true)],
  ["classification correction missing", (value) => (value.classificationCorrection.status = "missing")],
];
for (const [name, mutate] of mutations) {
  const value = structuredClone(fixture);
  mutate(value);
  assert.throws(
    () => adjudicatePostFullConditionBoundedCandidate(value),
    undefined,
    name,
  );
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      positiveChecks: 6,
      negativeChecks: mutations.length,
      selectedOutcome: result.selectedOutcome,
      gpuStarted: false,
      trainingStarted: false,
    },
    null,
    2,
  ),
);
