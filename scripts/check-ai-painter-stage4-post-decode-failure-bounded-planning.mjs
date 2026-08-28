import {
  adjudicatePostDecodeFailureBoundary,
  RESPONSIBILITY_IDENTITIES,
} from "./lib/ai-painter-stage4-post-decode-failure-bounded-planner-v1.mjs";

const fixture = () => ({
  terminal: {
    status: "stage0_real_visual_failure_adjudicated_closed",
  },
  analysis: {
    classification:
      "post_decode_object_rgb_multisample_semantic_capacity_insufficient_confirmed",
  },
  decision: {
    currentCandidateRejected: true,
    nextAction:
      "reject_current_model_family_and_return_to_bounded_candidate_planning",
  },
  review: {
    previewCount: 6,
    previewPassCount: 0,
    previewFailCount: 6,
    reviewThresholdsChanged: false,
    reviews: [1, 5, 10, 20, 30, 40].map((epoch) => ({
      epoch,
      professionalAesthetic: { passed: true },
      issueCodes: [
        ...(epoch === 20
          ? []
          : ["condition_terrain_path_ground_coverage_mismatch"]),
        "condition_object_footprints_reference_semantic_mismatch",
        "condition_object_tree_reference_semantic_mismatch",
        "condition_object_rock_reference_semantic_mismatch",
        "condition_object_vegetation_reference_semantic_mismatch",
      ],
    })),
  },
  modelSource:
    "stage4_post_decode_object_rgb_heads nn.Conv2d(4, 64, 3, padding=1) torch.cat((decoded_rgb, mask), dim=1)",
});
const reject = (mutate) => {
  const input = structuredClone(fixture());
  mutate(input);
  try {
    adjudicatePostDecodeFailureBoundary(input);
    return false;
  } catch {
    return true;
  }
};
const positive = adjudicatePostDecodeFailureBoundary(fixture());
const checks = [
  [
    "exact_failure_boundary_selected",
    positive.selectedBoundary ===
      "post_decode_object_only_mask_local_head_input_and_responsibility_gap_confirmed",
  ],
  [
    "single_bounded_candidate_selected",
    positive.selectedCandidate.candidateKind ===
      "post_decode_full_condition_route_and_object_responsibility_renderer",
  ],
  [
    "dimensions_derived_from_current_contracts",
    positive.selectedCandidate.perResponsibilityInput.totalChannels === 26 &&
      positive.selectedCandidate.existingDerivedWidth === 64 &&
      positive.selectedCandidate.responsibilityIdentityOrder.join(",") ===
        RESPONSIBILITY_IDENTITIES.join(","),
  ],
  [
    "cpu_implementation_is_worthwhile_but_training_forbidden",
    positive.viability.worthEnteringCpuInactiveImplementation === true &&
      positive.viability.gpuOrTrainingAllowedNow === false,
  ],
  [
    "changed_terminal_rejected",
    reject((input) => {
      input.terminal.status = "running";
    }),
  ],
  [
    "nonpersistent_object_failure_rejected",
    reject((input) => {
      input.review.reviews[2].issueCodes.pop();
    }),
  ],
  [
    "missing_route_failure_rejected",
    reject((input) => {
      for (const item of input.review.reviews) {
        item.issueCodes = item.issueCodes.filter(
          (code) => !code.includes("terrain_path_ground"),
        );
      }
    }),
  ],
  [
    "changed_model_source_boundary_rejected",
    reject((input) => {
      input.modelSource = "different model";
    }),
  ],
];
const results = checks.map(([id, passed]) => ({ id, passed }));
const report = {
  schemaVersion: "stage4-post-decode-failure-bounded-planning-cpu-check-v1",
  status: results.every((item) => item.passed) ? "passed" : "failed_closed",
  results,
  ownerAuthorizationRequired: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.status === "passed" ? 0 : 1);
