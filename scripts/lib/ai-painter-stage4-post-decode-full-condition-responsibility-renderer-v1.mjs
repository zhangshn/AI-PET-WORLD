import assert from "node:assert/strict";

export const POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ARCHITECTURE_ID =
  "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1";

export const POST_DECODE_FULL_CONDITION_RESPONSIBILITY_INACTIVE_STATUS =
  "stage4_post_decode_full_condition_route_object_responsibility_renderer_cpu_supported_inactive";

export const COMPLETE_CONDITION_CHANNEL_ORDER = Object.freeze([
  "terrain_grass",
  "terrain_water",
  "terrain_path_ground",
  "terrain_shoreline",
  "terrain_natural_boundary",
  "terrain_mud_patch",
  "terrain_tall_grass",
  "walkable",
  "collision",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
  "focal_area",
  "object_instance",
  "coordinate_x",
  "coordinate_y",
  "signed_distance_path",
  "signed_distance_water",
  "signed_distance_shoreline",
  "signed_distance_object_ground",
  "signed_distance_boundary",
  "moisture_proximity",
]);

export const POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER = Object.freeze([
  "terrain_path_ground",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
]);

export const POST_DECODE_FULL_CONDITION_RESPONSIBILITY_INACTIVE_GATES =
  Object.freeze([
    "configurationActiveNow",
    "gpuNow",
    "optimizerNow",
    "backwardNow",
    "weightModificationNow",
    "smokeNow",
    "trainingNow",
    "formalInferenceNow",
    "runtimeFrameNow",
    "worldEntryNow",
  ]);

export function buildPostDecodeFullConditionResponsibilityInactiveConfig(base) {
  assert.equal(base.conditionChannels, 23, "condition channel count changed");
  assert.deepEqual(
    base.conditionChannelOrder,
    COMPLETE_CONDITION_CHANNEL_ORDER,
    "condition order changed",
  );
  assert.equal(base.latentChannels, 12, "latent channel count changed");
  assert.equal(base.latentDownsampleFactor, 4, "Autoencoder factor changed");
  assert.equal(
    base.autoencoderArchitecture,
    "residual_4x_latent_pixel_detail_v2",
    "Autoencoder architecture changed",
  );
  assert.equal(base.denoiserBaseChannels, 64, "formal base width changed");
  assert.deepEqual(
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER.filter(
      (identity) => !base.conditionChannelTypes.discrete.includes(identity),
    ),
    [],
    "responsibility masks must be discrete authoritative conditions",
  );
  const config = {
    schemaVersion:
      "stage4-post-decode-full-condition-route-object-responsibility-renderer-inactive-config-v1",
    status: "cpu_supported_inactive",
    modelId:
      "post_decode_full_condition_route_and_object_responsibility_renderer",
    capabilityCandidateOnly: true,
    conditionChannels: 23,
    conditionChannelOrder: [...base.conditionChannelOrder],
    conditionChannelTypes: structuredClone(base.conditionChannelTypes),
    conditionResizeContract: base.conditionResizeContract,
    autoencoderArchitecture: "residual_4x_latent_pixel_detail_v2",
    latentChannels: 12,
    latentDownsampleFactor: 4,
    baseChannels: base.baseChannels,
    denoiserBaseChannels: 64,
    denoiserArchitecture:
      POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ARCHITECTURE_ID,
    postDecodeResponsibilityIdentityOrder: [
      ...POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER,
    ],
    postDecodeResponsibilityInputIdentity:
      "decoded_rgb_3_plus_complete_typed_conditions_23",
    postDecodeResponsibilityInputChannels: 26,
    postDecodeResponsibilityBranchWidth: 64,
    postDecodeResponsibilityOutputChannels: 3,
    postDecodeResponsibilityMerge:
      "authoritative_mask_normalized_full_condition_responsibility_rgb_v1",
    predictionTarget: base.predictionTarget,
    training: {
      trainingAuthorizationStatus:
        POST_DECODE_FULL_CONDITION_RESPONSIBILITY_INACTIVE_STATUS,
    },
    activationGates: Object.fromEntries(
      POST_DECODE_FULL_CONDITION_RESPONSIBILITY_INACTIVE_GATES.map((field) => [
        field,
        false,
      ]),
    ),
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
  };
  validatePostDecodeFullConditionResponsibilityInactiveConfig(config);
  return config;
}

export function validatePostDecodeFullConditionResponsibilityInactiveConfig(
  config,
) {
  assert.equal(
    config.schemaVersion,
    "stage4-post-decode-full-condition-route-object-responsibility-renderer-inactive-config-v1",
  );
  assert.equal(config.status, "cpu_supported_inactive");
  assert.equal(
    config.denoiserArchitecture,
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ARCHITECTURE_ID,
  );
  assert.equal(config.conditionChannels, 23);
  assert.deepEqual(config.conditionChannelOrder, COMPLETE_CONDITION_CHANNEL_ORDER);
  assert.equal(config.latentChannels, 12);
  assert.equal(config.latentDownsampleFactor, 4);
  assert.equal(config.denoiserBaseChannels, 64);
  assert.deepEqual(
    config.postDecodeResponsibilityIdentityOrder,
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_ORDER,
  );
  assert.equal(
    config.postDecodeResponsibilityInputIdentity,
    "decoded_rgb_3_plus_complete_typed_conditions_23",
  );
  assert.equal(config.postDecodeResponsibilityInputChannels, 26);
  assert.equal(config.postDecodeResponsibilityBranchWidth, 64);
  assert.equal(config.postDecodeResponsibilityOutputChannels, 3);
  assert.equal(
    config.postDecodeResponsibilityMerge,
    "authoritative_mask_normalized_full_condition_responsibility_rgb_v1",
  );
  assert.equal(
    config.training?.trainingAuthorizationStatus,
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_INACTIVE_STATUS,
  );
  assert.deepEqual(
    Object.keys(config.activationGates),
    POST_DECODE_FULL_CONDITION_RESPONSIBILITY_INACTIVE_GATES,
  );
  for (const field of POST_DECODE_FULL_CONDITION_RESPONSIBILITY_INACTIVE_GATES) {
    assert.equal(config.activationGates[field], false, `${field} must be false`);
  }
  for (const field of [
    "stage4ControlledStructureArm",
    "stage4ResponsibilityComponentRole",
    "loss",
    "optimizer",
    "checkpointPath",
  ]) {
    assert.equal(Object.hasOwn(config, field), false, `forbidden field ${field}`);
  }
  assert.equal(config.ownerAuthorizationRequired, false);
  assert.equal(config.ownerResponseRequired, false);
  return true;
}
