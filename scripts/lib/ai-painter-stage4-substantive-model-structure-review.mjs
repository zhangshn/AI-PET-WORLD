import assert from "node:assert/strict"

export const DECISIONS = Object.freeze({
  A: "current_condition_fusion_structure_gap_confirmed",
  B: "current_denoiser_capacity_or_output_bottleneck_gap_confirmed",
  C: "condition_fusion_and_model_capacity_joint_gap_confirmed",
  D: "evidence_insufficient_for_substantive_architecture_decision",
})

const REQUIRED_CONDITION_ORDER = Object.freeze([
  "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
  "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "walkable",
  "collision", "object_footprints", "object_tree", "object_rock", "object_vegetation",
  "focal_area", "object_instance", "coordinate_x", "coordinate_y", "signed_distance_path",
  "signed_distance_water", "signed_distance_shoreline", "signed_distance_object_ground",
  "signed_distance_boundary", "moisture_proximity",
])

function locateOrdered(source, labels) {
  let cursor = -1
  const locations = {}
  for (const [label, token] of labels) {
    const index = source.indexOf(token, cursor + 1)
    assert.notEqual(index, -1, `model_structure_token_missing:${label}`)
    assert.equal(index > cursor, true, `model_structure_order_invalid:${label}`)
    locations[label] = index
    cursor = index
  }
  return locations
}

export function inspectCurrentConditionToRgbStructure(modelSource, config) {
  assert.equal(config.denoiserArchitecture, "stage4_fact_conditioned_semantic_mixture_decoder_v1", "denoiser_architecture_changed")
  assert.equal(config.conditionChannels, 23, "condition_channel_count_changed")
  assert.deepEqual(config.conditionChannelOrder, REQUIRED_CONDITION_ORDER, "condition_channel_order_changed")
  assert.equal(new Set(config.conditionChannelOrder).size, 23, "condition_channel_order_not_unique")
  assert.equal(config.denoiserBaseChannels, 64, "denoiser_base_channels_changed")
  assert.equal(config.latentChannels, 12, "latent_channels_changed")
  assert.equal(config.latentDownsampleFactor, 4, "latent_downsample_factor_changed")

  const forward = locateOrdered(modelSource, [
    ["typed_resize_to_latent", "resized_conditions = resize_typed_conditions(conditions, noisy_latent.shape[-2:])"],
    ["condition_level0", "condition0 = self.condition_stem(resized_conditions)"],
    ["level0_fusion", "self.fuse0(torch.cat((self.latent_stem(noisy_latent), condition0), dim=1)"],
    ["condition_level1", "condition1 = self.condition_down1(condition0)"],
    ["level1_fusion", "self.fuse1(torch.cat((self.latent_down1(level0), condition1), dim=1)"],
    ["condition_middle", "condition2 = self.condition_down2(condition1)"],
    ["middle_fusion", "middle = self.fuse2(torch.cat((self.latent_down2(level1), condition2), dim=1))"],
    ["decoder_up1_reinjection", "decoded_up1 = decoded_up1 + self.typed_condition_adapter_up1(typed_up1)"],
    ["decoder_up0_reinjection", "decoded_up0 = decoded_up0 + self.typed_condition_adapter_up0(typed_up0)"],
    ["base_output", "base_velocity = self.output(up0)"],
    ["expert_direct_condition", "typed_mixture_conditions[:, source_index:source_index + 1]"],
    ["expert_contribution", "contribution = self.semantic_mixture_experts[name](expert_input)"],
    ["expert_participation", "participation = self.semantic_mixture_participation[name](expert_input)"],
    ["typed_sum", "predicted_velocity = base_velocity + torch.stack("],
    ["typed_sum_end", "semantic_mixture_gated_contributions,"],
  ])
  assert.match(modelSource, /"typedIdentityCollapsedBeforeOutput": False/)
  assert.match(modelSource, /nn\.Conv2d\(channels, latent_channels, 3, padding=1\)/)
  assert.match(modelSource, /for name in semantic_mixture_types/)
  return {
    architecture: config.denoiserArchitecture,
    conditionChannelCount: config.conditionChannels,
    conditionChannelOrder: [...config.conditionChannelOrder],
    denoiserBaseChannels: config.denoiserBaseChannels,
    latentChannels: config.latentChannels,
    latentDownsampleFactor: config.latentDownsampleFactor,
    injectionTopology: {
      encoderOrCoreScales: ["level0", "level1", "middle"],
      decoderScales: ["up1", "up0"],
      typedExpertsReadAllConditionsAndOwnSource: true,
      typedIdentityPreservedUntilFinalAdditiveComposition: true,
      finalSharedOutput: "single_12_channel_predicted_velocity_then_frozen_autoencoder_decode",
    },
    structuralLocations: forward,
  }
}

export function adjudicateSubstantiveModelStructure(input) {
  const {
    modelSource, config, currentAdjudication, autoencoderDecision,
    multisampleGpuReport, multisampleAnalysis, multisampleDecision, controlledEvidence,
  } = input
  const structure = inspectCurrentConditionToRgbStructure(modelSource, config)
  assert.equal(currentAdjudication.selectedCause, "A", "current_stage0_adjudication_changed")
  assert.equal(currentAdjudication.status, "conflict_aware_training_paradigm_active_but_semantically_insufficient")
  assert.equal(currentAdjudication.evidence.conflictAggregationActiveAcrossAllEpochs, true)
  assert.deepEqual(currentAdjudication.evidence.terminalResidualClasses, ["footprints", "tree", "rock"])
  assert.equal(autoencoderDecision.selectedDecision, "frozen_autoencoder_semantic_retention_sufficient", "autoencoder_retention_decision_changed")
  assert.equal(autoencoderDecision.passedClassAuditCount, 256)
  assert.equal(autoencoderDecision.affectedSampleCount, 0)
  assert.equal(multisampleDecision.capacityGapConfirmed, false, "historical_capacity_decision_changed")
  assert.equal(multisampleDecision.gradientInterferenceConfirmed, true, "historical_interference_decision_changed")
  assert.equal(multisampleGpuReport.capacityEvidence.uniqueConditionTensorCount, 56)
  assert.equal(multisampleGpuReport.capacityEvidence.uniqueConditionRepresentationCount, 56)
  assert.equal(multisampleGpuReport.capacityEvidence.uniqueFinalRgbCount, 56)
  assert.equal(multisampleGpuReport.capacityEvidence.exactConditionRepresentationCollisionCount, 0, "condition_representation_collision_invented")
  assert.equal(multisampleGpuReport.capacityEvidence.exactFinalRgbCollisionCount, 0, "final_rgb_collision_invented")
  assert.equal(Object.hasOwn(multisampleGpuReport, "conditionReachability"), false, "condition_reachability_wrongly_bound_to_gpu_report")
  assert.equal(multisampleAnalysis.conditionReachability?.allFiniteNonZeroAndOwnChannelReached, true, "condition_reachability_missing_from_analysis")
  assert.deepEqual(controlledEvidence, {
    conditionFusionOnlyComparison: false,
    denoiserCapacityOnlyComparison: false,
    independentOutputBottleneckComparison: false,
    sharedInitializationAndTrainingSchedule: false,
  }, "controlled_structure_evidence_identity_invalid")

  return {
    schemaVersion: "stage4-substantive-model-structure-review-adjudication-v1",
    status: DECISIONS.D,
    selectedDecision: "D",
    selectedDecisionId: DECISIONS.D,
    businessConclusion: "The current model has deep, repeated and class-aware condition paths, and no exact representation collapse is proven. The shared 12-channel output is observable, but the frozen Autoencoder has already retained all approved semantics. Without a controlled structure-only comparison, neither fusion insufficiency nor capacity insufficiency is uniquely established.",
    structure,
    provenFacts: {
      original64Retained: true,
      conditionFusionPathPresent: true,
      conditionFusionScales: ["level0", "level1", "middle", "up1", "up0"],
      typedExpertsReachFinalVelocity: true,
      sharedTwelveChannelOutputPresent: true,
      frozenAutoencoderRetentionSufficient: true,
      exactConditionRepresentationCollapseAbsent: true,
      exactFinalRgbCollisionAbsent: true,
      conflictAwareTrainingCompletedButResidualFailureRemains: true,
    },
    alternatives: {
      A: { status: "not_confirmed", reason: "Conditions are present at three core scales, two decoder scales and every typed expert; no fusion-only controlled comparison proves that changing this topology fixes the residual classes." },
      B: { status: "not_confirmed", reason: "The current 64-channel Denoiser and 12-channel output have no controlled capacity-only comparison; the same 12-channel frozen Autoencoder retains all 256 sample-class semantic audits." },
      C: { status: "not_confirmed", reason: "A joint gap cannot be asserted when neither structural axis has been isolated." },
    },
    ownerEvidenceRequest: {
      action: "authorize_bounded_controlled_model_structure_discrimination_design",
      purpose: "Define one condition-fusion-only control and one capacity-only control with identical data, objectives, initialization and schedule before any implementation or training is authorized.",
      mustRemainFrozen: ["original_64", "48_8_4_4_split", "23_channel_order", "frozen_autoencoder", "loss_values_and_weights", "review_thresholds"],
      prohibited: ["free_hyperparameters", "same_type_loss_expansion", "failed_checkpoint_reuse", "gpu_or_training_in_this_review"],
    },
    inactiveArchitectureContractGenerated: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
  }
}
