import assert from "node:assert/strict"

export const CONTRACT_ID = "stage4_controlled_structure_unique_derivation_rules_v1"
export const CONTRACT_STATUS = "cpu_verified_inactive_materializable"

const CONDITION_ORDER = Object.freeze([
  "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
  "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "walkable",
  "collision", "object_footprints", "object_tree", "object_rock", "object_vegetation",
  "focal_area", "object_instance", "coordinate_x", "coordinate_y", "signed_distance_path",
  "signed_distance_water", "signed_distance_shoreline", "signed_distance_object_ground",
  "signed_distance_boundary", "moisture_proximity",
])

const FROZEN = Object.freeze({
  approvedRecordCount: 64,
  split: { train: 48, validation: 8, challenge: 4, regression: 4 },
  conditionChannelCount: 23,
  conditionChannelOrder: CONDITION_ORDER,
  autoencoder: "frozen_project_autoencoder",
  lossValuesAndWeights: "unchanged",
  seed: 20263722,
  resolutionStages: ["256x192", "512x384", "1024x768"],
  trainingSchedule: "unchanged_formal_schedule",
  checkpointFormat: "unchanged",
  machineReviewThresholds: "unchanged",
})

const exactKeys = (value, keys, label) => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label}_object_required`)
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label}_fields_not_exact`)
}

function validateBoundEvidence(input) {
  assert.equal(input.terminal.status, "stage4_bounded_controlled_model_structure_discrimination_design_failed_closed_dimension_derivation_gap", "bound_terminal_status_changed")
  assert.equal(input.terminal.fixedTotalProgress?.percent, 60, "fixed_progress_changed")
  assert.equal(input.designReport.status, "cpu_readonly_design_completed_failed_closed", "bound_design_report_status_changed")
  assert.equal(input.experiment.status, "inactive_not_executable_dimension_derivation_gap", "bound_experiment_status_changed")
  assert.equal(input.experiment.executable, false, "historical_experiment_execution_invented")
  assert.equal(input.isolation.status, "inactive_cpu_defined", "bound_isolation_status_changed")
  assert.equal(input.qualification.status, "inactive_order_defined", "bound_qualification_status_changed")
  assert.equal(input.ownerRequest.action, "provide_formal_unique_structure_derivation_rules", "bound_owner_action_changed")
  assert.equal(input.cpuReport.status, "passed", "bound_cpu_report_not_passed")
}

function validateOwnerRules(rules) {
  exactKeys(rules, ["conditionFusionOnly", "capacityOnly", "forbiddenChanges"], "owner_rules")
  exactKeys(rules.conditionFusionOnly, [
    "changedAxis", "branchCount", "resizeFunction", "inputChannels", "hiddenChannels",
    "outputChannels", "operators", "mergePoint", "existingInjectionPathsUnchanged",
    "baseChannelsUnchanged", "latentOutputChannelsUnchanged", "freeParameterCount",
  ], "condition_fusion_rule")
  assert.equal(rules.conditionFusionOnly.changedAxis, "condition_fusion_only")
  assert.equal(rules.conditionFusionOnly.branchCount, 1, "fusion_branch_count_changed")
  assert.equal(rules.conditionFusionOnly.resizeFunction, "resize_typed_conditions", "fusion_resize_function_changed")
  assert.equal(rules.conditionFusionOnly.inputChannels, 23, "fusion_input_channels_changed")
  assert.equal(rules.conditionFusionOnly.hiddenChannels, 64, "fusion_hidden_channels_changed")
  assert.equal(rules.conditionFusionOnly.outputChannels, 12, "fusion_output_channels_changed")
  assert.deepEqual(rules.conditionFusionOnly.operators, [
    { type: "conv2d", inChannels: 23, outChannels: 64, kernelSize: 3, padding: 1, bias: true },
    { type: "silu" },
    { type: "conv2d", inChannels: 64, outChannels: 12, kernelSize: 3, padding: 1, bias: true },
  ], "fusion_operators_changed")
  assert.equal(rules.conditionFusionOnly.mergePoint, "predicted_velocity_final_additive_composition", "fusion_merge_point_changed")
  assert.equal(rules.conditionFusionOnly.existingInjectionPathsUnchanged, true, "existing_fusion_path_change_forbidden")
  assert.equal(rules.conditionFusionOnly.baseChannelsUnchanged, true, "fusion_arm_capacity_change_forbidden")
  assert.equal(rules.conditionFusionOnly.latentOutputChannelsUnchanged, true, "fusion_arm_output_change_forbidden")
  assert.equal(rules.conditionFusionOnly.freeParameterCount, 0, "fusion_free_parameter_forbidden")

  exactKeys(rules.capacityOnly, [
    "changedAxis", "baseChannelsBefore", "baseChannelsAfter", "derivation",
    "derivedHierarchy", "timeEmbeddingChannels", "conditionFusionTopologyUnchanged",
    "latentOutputChannels", "layerCountUnchanged", "freeParameterCount",
  ], "capacity_rule")
  assert.equal(rules.capacityOnly.changedAxis, "denoiser_internal_capacity_only")
  assert.equal(rules.capacityOnly.baseChannelsBefore, 64, "capacity_baseline_changed")
  assert.equal(rules.capacityOnly.baseChannelsAfter, 128, "capacity_target_changed")
  assert.equal(rules.capacityOnly.derivation, "existing_level1_width_equals_current_base_channels_times_2", "capacity_derivation_changed")
  assert.deepEqual(rules.capacityOnly.derivedHierarchy, [128, 256, 512], "capacity_hierarchy_changed")
  assert.equal(rules.capacityOnly.timeEmbeddingChannels, 512, "capacity_time_embedding_changed")
  assert.equal(rules.capacityOnly.conditionFusionTopologyUnchanged, true, "capacity_arm_fusion_change_forbidden")
  assert.equal(rules.capacityOnly.latentOutputChannels, 12, "capacity_arm_output_change_forbidden")
  assert.equal(rules.capacityOnly.layerCountUnchanged, true, "capacity_arm_layer_change_forbidden")
  assert.equal(rules.capacityOnly.freeParameterCount, 0, "capacity_free_parameter_forbidden")
  assert.deepEqual(rules.forbiddenChanges, [
    "loss", "data", "split", "condition_order", "autoencoder", "initialization_seed",
    "resolution_stages", "training_schedule", "checkpoint_format", "machine_review_thresholds",
    "historical_checkpoint_injection", "simultaneous_control_axis_change", "extra_layer",
    "free_channel_dimension",
  ], "forbidden_changes_not_exact")
}

function validateBaseline(baseline) {
  assert.equal(baseline.architecture, "stage4_fact_conditioned_semantic_mixture_decoder_v1", "baseline_architecture_changed")
  assert.equal(baseline.conditionChannelCount, 23, "baseline_condition_count_changed")
  assert.deepEqual(baseline.conditionChannelOrder, CONDITION_ORDER, "baseline_condition_order_changed")
  assert.equal(baseline.denoiserBaseChannels, 64, "baseline_base_channels_changed")
  assert.equal(baseline.latentChannels, 12, "baseline_latent_channels_changed")
  assert.equal(baseline.latentDownsampleFactor, 4, "baseline_downsample_changed")
}

export function buildControlledStructureUniqueDerivationContract(input) {
  exactKeys(input, ["terminal", "designReport", "experiment", "isolation", "qualification", "ownerRequest", "cpuReport", "baseline", "ownerRules"], "contract_input")
  validateBoundEvidence(input)
  validateBaseline(input.baseline)
  validateOwnerRules(input.ownerRules)

  const fusionParameterTensors = [
    { name: "final_condition_residual.0.weight", shape: [64, 23, 3, 3], parameterCount: 64 * 23 * 3 * 3 },
    { name: "final_condition_residual.0.bias", shape: [64], parameterCount: 64 },
    { name: "final_condition_residual.2.weight", shape: [12, 64, 3, 3], parameterCount: 12 * 64 * 3 * 3 },
    { name: "final_condition_residual.2.bias", shape: [12], parameterCount: 12 },
  ]
  const fusionAddedParameterCount = fusionParameterTensors.reduce((sum, entry) => sum + entry.parameterCount, 0)
  assert.equal(fusionAddedParameterCount, 20236)

  const baseline = {
    armId: "baseline_current_formal_structure",
    status: CONTRACT_STATUS,
    architectureSource: input.baseline.architecture,
    structure: structuredClone(input.baseline),
    changedAxes: [],
    parameterDifference: { status: "exactly_zero", added: 0, removed: 0, reshapedExistingTensors: 0 },
  }
  const conditionFusionOnly = {
    armId: "condition_fusion_only_final_direct_residual_23_64_12",
    status: CONTRACT_STATUS,
    changedAxes: ["condition_fusion"],
    unchangedAxes: ["denoiser_base_width", "latent_output_width", "main_trunk_depth", "existing_condition_injection", "loss", "data", "schedule"],
    structureDelta: {
      addedModules: 1,
      moduleName: "final_condition_residual",
      resizeFunction: "resize_typed_conditions",
      operators: structuredClone(input.ownerRules.conditionFusionOnly.operators),
      mergeExpression: "predicted_velocity = predicted_velocity + final_condition_residual(resize_typed_conditions(conditions, predicted_velocity.shape[-2:]))",
      mergeCount: 1,
    },
    parameterDifference: {
      scope: "new_final_condition_residual_branch_only",
      tensors: fusionParameterTensors,
      exactAddedParameterCount: fusionAddedParameterCount,
      existingParameterShapesChanged: false,
    },
  }
  const capacityOnly = {
    armId: "capacity_only_base_width_64_to_existing_level1_128",
    status: CONTRACT_STATUS,
    changedAxes: ["denoiser_internal_capacity"],
    unchangedAxes: ["condition_fusion_topology", "latent_output_width", "main_trunk_depth", "loss", "data", "schedule"],
    structureDelta: {
      configField: "denoiserBaseChannels",
      before: 64,
      after: 128,
      derivation: "64*2=128_existing_level1_width",
      derivedWidthHierarchy: [128, 256, 512],
      derivedTimeEmbeddingChannels: 512,
      layerCountDelta: 0,
      latentOutputChannels: 12,
    },
    parameterDifference: {
      scope: "existing_base_width_derived_tensors_only",
      newModuleNamesAllowed: false,
      removedModuleNamesAllowed: false,
      exactTensorShapeAuditRequiredBeforeActivation: true,
      freeDimensionsAllowed: false,
    },
  }

  return {
    schemaVersion: "stage4-controlled-structure-unique-derivation-rules-v1",
    contractId: CONTRACT_ID,
    status: CONTRACT_STATUS,
    executableNow: false,
    materializable: true,
    activationAuthorized: false,
    implementationAuthorized: false,
    trainingAuthorized: false,
    baseline,
    conditionFusionOnly,
    capacityOnly,
    frozenIdentities: structuredClone(FROZEN),
    structuralDifferenceAudit: {
      baselineChangedAxes: [],
      fusionChangedAxes: ["condition_fusion"],
      capacityChangedAxes: ["denoiser_internal_capacity"],
      crossAxisChangesAllowed: false,
      lossDifferenceAllowed: false,
      dataDifferenceAllowed: false,
      historicalCheckpointAllowed: false,
      freeParameterCount: 0,
    },
    evidenceIsolationContract: {
      inheritedContractStatus: input.isolation.status,
      independentRunIdPerArm: true,
      independentAuthorizationConsumptionPerArm: true,
      independentOutputNamespacePerArm: true,
      checkpointCrossArmUseForbidden: true,
      sameDataSplitConditionsAutoencoderLossInitializationScheduleAndThresholds: true,
      onlyDeclaredStructuralAxisMayDiffer: true,
    },
    futureQualificationOrder: [
      "cpu_inactive_implementation_and_exact_parameter_shape_audit",
      "cpu_cross_arm_structural_isolation_regression",
      "readonly_gpu_condition_and_gradient_causal_qualification_per_arm",
      "owner_authorized_controlled_smoke_per_qualified_arm",
      "cpu_readonly_cross_arm_result_adjudication",
      "owner_authorized_selected_arm_stage0_only_after_adjudication",
    ],
    nextAction: "owner_authorization_for_cpu_inactive_three_arm_model_support",
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    modelSourceModified: false,
  }
}

