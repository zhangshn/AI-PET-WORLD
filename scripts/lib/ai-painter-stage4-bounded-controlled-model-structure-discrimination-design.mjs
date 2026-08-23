import assert from "node:assert/strict"

export const DESIGN_STATUS = Object.freeze({
  READY: "bounded_three_arm_structure_discrimination_design_ready_inactive",
  DERIVATION_GAP: "bounded_three_arm_structure_discrimination_design_failed_closed_dimension_derivation_gap",
})

const REQUIRED_CONDITION_ORDER = Object.freeze([
  "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
  "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "walkable",
  "collision", "object_footprints", "object_tree", "object_rock", "object_vegetation",
  "focal_area", "object_instance", "coordinate_x", "coordinate_y", "signed_distance_path",
  "signed_distance_water", "signed_distance_shoreline", "signed_distance_object_ground",
  "signed_distance_boundary", "moisture_proximity",
])

const FROZEN_IDENTITIES = Object.freeze([
  "original_64_approved_records",
  "48_8_4_4_split",
  "23_channel_order",
  "frozen_project_autoencoder",
  "loss_values_and_weights",
  "initialization_seed_20263722",
  "formal_resolution_stages",
  "formal_training_schedule",
  "checkpoint_format",
  "machine_review_thresholds",
])

const FUTURE_QUALIFICATION_ORDER = Object.freeze([
  "owner_supplies_formal_unique_derivation_evidence",
  "cpu_inactive_contract_and_negative_regression_per_arm",
  "cpu_cross_arm_identity_isolation_audit",
  "readonly_gpu_condition_and_gradient_causal_qualification_per_arm",
  "owner_authorized_controlled_smoke_only_after_all_readonly_qualifications",
  "owner_authorized_controlled_stage0_only_after_smoke_qualification",
])

function exactObjectKeys(value, expected, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label}_object_required`)
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}_fields_not_exact`)
}

function validateBoundReview(input) {
  assert.equal(input.terminal.status, "stage4_substantive_model_structure_review_evidence_insufficient_closed", "bound_terminal_status_changed")
  assert.equal(input.terminal.selectedDecision, "D", "bound_terminal_decision_changed")
  assert.equal(input.terminal.fixedTotalProgress?.percent, 60, "fixed_progress_changed")
  assert.equal(input.review.status, "cpu_readonly_substantive_model_structure_review_completed", "bound_review_status_changed")
  assert.equal(input.review.selectedDecision, "evidence_insufficient_for_substantive_architecture_decision", "bound_review_decision_changed")
  assert.equal(input.adjudication.selectedDecision, "D", "bound_adjudication_decision_changed")
  assert.equal(input.adjudication.inactiveArchitectureContractGenerated, false, "historical_architecture_contract_invented")
  assert.equal(input.ownerRequest.requestedNextScope, "one_cpu_readonly_bounded_controlled_model_structure_discrimination_design", "owner_scope_changed")
  assert.deepEqual(input.ownerRequest.requiredControls, [
    "one_condition_fusion_only_control_contract",
    "one_denoiser_capacity_only_control_contract",
    "same_original_64_and_48_8_4_4_split",
    "same_23_channel_order_and_frozen_autoencoder",
    "same_loss_values_weights_initialization_and_training_schedule",
    "all_dimensions_uniquely_derived_or_fail_closed",
  ], "owner_required_controls_changed")
  assert.equal(input.cpuReport.status, "passed", "bound_cpu_report_not_passed")
}

function validateBaseline(structure) {
  assert.equal(structure.architecture, "stage4_fact_conditioned_semantic_mixture_decoder_v1", "baseline_architecture_changed")
  assert.equal(structure.conditionChannelCount, 23, "baseline_condition_count_changed")
  assert.deepEqual(structure.conditionChannelOrder, REQUIRED_CONDITION_ORDER, "baseline_condition_order_changed")
  assert.equal(structure.denoiserBaseChannels, 64, "baseline_base_channels_changed")
  assert.equal(structure.latentChannels, 12, "baseline_latent_channels_changed")
  assert.equal(structure.latentDownsampleFactor, 4, "baseline_downsample_changed")
  assert.deepEqual(structure.injectionTopology.encoderOrCoreScales, ["level0", "level1", "middle"], "baseline_core_fusion_changed")
  assert.deepEqual(structure.injectionTopology.decoderScales, ["up1", "up0"], "baseline_decoder_fusion_changed")
  assert.equal(structure.injectionTopology.typedExpertsReadAllConditionsAndOwnSource, true, "baseline_typed_condition_path_changed")
  assert.equal(structure.injectionTopology.finalSharedOutput, "single_12_channel_predicted_velocity_then_frozen_autoencoder_decode", "baseline_output_changed")
}

function validateFormalDerivation(value, axis) {
  if (value === null) return null
  exactObjectKeys(value, ["status", "axis", "sourceContractPath", "sourceContractSha256", "uniqueStructuralDelta", "derivedDimensions", "freeParameterCount"], `${axis}_derivation`)
  assert.equal(value.status, "formal_owner_authorized_unique_derivation", `${axis}_derivation_status_invalid`)
  assert.equal(value.axis, axis, `${axis}_derivation_axis_invalid`)
  assert.match(value.sourceContractPath, /\.json$/i, `${axis}_derivation_source_contract_required`)
  assert.match(value.sourceContractSha256, /^[a-f0-9]{64}$/, `${axis}_derivation_sha256_invalid`)
  assert.equal(value.freeParameterCount, 0, `${axis}_free_parameter_forbidden`)
  assert.equal(Array.isArray(value.uniqueStructuralDelta), true, `${axis}_unique_delta_required`)
  assert.equal(value.uniqueStructuralDelta.length, 1, `${axis}_exactly_one_structural_delta_required`)
  assert.ok(value.derivedDimensions && typeof value.derivedDimensions === "object", `${axis}_derived_dimensions_required`)
  assert.equal(Object.keys(value.derivedDimensions).length > 0, true, `${axis}_derived_dimensions_empty`)
  return structuredClone(value)
}

export function designBoundedControlledModelStructureDiscrimination(input) {
  exactObjectKeys(input, ["terminal", "review", "adjudication", "ownerRequest", "cpuReport", "formalDerivations"], "design_input")
  validateBoundReview(input)
  const baselineStructure = input.review.currentArchitecture
  validateBaseline(baselineStructure)
  exactObjectKeys(input.formalDerivations, ["conditionFusionOnly", "capacityOnly"], "formal_derivations")

  const fusion = validateFormalDerivation(input.formalDerivations.conditionFusionOnly, "condition_fusion_only")
  const capacity = validateFormalDerivation(input.formalDerivations.capacityOnly, "capacity_only")
  const ready = fusion !== null && capacity !== null

  const arms = {
    baseline: {
      status: "bound_current_structure_inactive_control_baseline",
      structure: structuredClone(baselineStructure),
      changedAxes: [],
    },
    conditionFusionOnly: fusion ? {
      status: "inactive_control_materialized_from_formal_unique_derivation",
      changedAxes: ["condition_fusion"],
      derivation: fusion,
      forbiddenChanges: ["denoiser_capacity", "latent_output_channels", "loss", "data", "initialization", "schedule"],
    } : {
      status: "inactive_not_executable_missing_formal_unique_derivation",
      changedAxes: ["condition_fusion"],
      unresolved: ["unique_fusion_topology_delta", "all_resulting_channel_dimensions"],
      forbiddenChanges: ["denoiser_capacity", "latent_output_channels", "loss", "data", "initialization", "schedule"],
    },
    capacityOnly: capacity ? {
      status: "inactive_control_materialized_from_formal_unique_derivation",
      changedAxes: ["denoiser_capacity_or_output_bottleneck"],
      derivation: capacity,
      forbiddenChanges: ["condition_fusion_topology", "loss", "data", "initialization", "schedule"],
    } : {
      status: "inactive_not_executable_missing_formal_unique_derivation",
      changedAxes: ["denoiser_capacity_or_output_bottleneck"],
      unresolved: ["choose_internal_capacity_or_output_bottleneck_axis", "unique_capacity_delta", "all_resulting_channel_dimensions"],
      forbiddenChanges: ["condition_fusion_topology", "loss", "data", "initialization", "schedule"],
    },
  }

  return {
    schemaVersion: "stage4-bounded-controlled-model-structure-discrimination-design-v1",
    status: ready ? DESIGN_STATUS.READY : DESIGN_STATUS.DERIVATION_GAP,
    executable: false,
    materializedThreeArmContract: ready,
    problem: "Existing evidence cannot distinguish condition-fusion structure from Denoiser capacity/output bottleneck without isolated controls.",
    analysis: {
      baselineDimensionsBound: { conditionChannels: 23, denoiserBaseChannels: 64, latentChannels: 12, latentDownsampleFactor: 4 },
      existingFusionScales: ["level0", "level1", "middle", "up1", "up0", "typed_experts"],
      fusionDerivationRulePresent: fusion !== null,
      capacityDerivationRulePresent: capacity !== null,
      capacityAxisUnambiguous: capacity !== null,
      freeParameterSelectionAllowed: false,
      conclusion: ready
        ? "Both isolated structural deltas are formally and uniquely derived; the contract remains inactive pending later authorization."
        : "The current contracts bind baseline dimensions but do not uniquely define either the fusion-only delta or the capacity/output-bottleneck delta. Materializing values would be free architecture selection, so the design fails closed.",
    },
    frozenIdentities: [...FROZEN_IDENTITIES],
    arms,
    evidenceIsolationContract: {
      status: "inactive_cpu_defined",
      independentRunIdPerArm: true,
      independentAuthorizationConsumptionPerArm: true,
      outputNamespaceReuseForbidden: true,
      checkpointCrossArmUseForbidden: true,
      sameDataSplitConditionsAutoencoderLossInitializationScheduleAndThresholds: true,
      onlyDeclaredStructuralAxisMayDiffer: true,
    },
    futureQualificationOrder: [...FUTURE_QUALIFICATION_ORDER],
    ownerAction: ready ? {
      action: "authorize_cpu_inactive_implementation_of_three_arm_control_contracts",
      automaticApproval: false,
    } : {
      action: "provide_formal_unique_structure_derivation_rules",
      requiredEvidence: [
        "one_formal_condition_fusion_only_delta_with_all_dimensions_uniquely_derived",
        "one_formal_choice_between_internal_capacity_and_output_bottleneck",
        "one_formal_capacity_only_delta_with_all_dimensions_uniquely_derived",
      ],
      prohibitedOwnerSubstitution: "No numeric choice may be inferred from model counts, dataset size or common architecture conventions.",
      automaticApproval: false,
    },
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    modelImplemented: false,
  }
}

