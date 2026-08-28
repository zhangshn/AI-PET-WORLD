import assert from "node:assert/strict";

export const POST_DECODE_OBJECT_RGB_ARCHITECTURE_ID =
  "stage4_post_decode_authoritative_object_rgb_compositor_v1";

export const POST_DECODE_OBJECT_RGB_IDENTITY_ORDER = Object.freeze([
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
]);

export const POST_DECODE_OBJECT_RGB_INACTIVE_GATES = Object.freeze([
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

export function buildPostDecodeObjectRgbInactiveConfig(base) {
  assert.equal(
    base.conditionChannels,
    23,
    "source condition channel count mismatch",
  );
  assert.equal(base.latentChannels, 12, "source latent channel count mismatch");
  assert.equal(
    base.latentDownsampleFactor,
    4,
    "source Autoencoder factor mismatch",
  );
  assert.equal(
    base.autoencoderArchitecture,
    "residual_4x_latent_pixel_detail_v2",
    "source Autoencoder architecture mismatch",
  );
  assert.equal(base.denoiserBaseChannels, 64, "source base width mismatch");
  assert.equal(
    base.conditionChannelOrder.length,
    23,
    "source channel order mismatch",
  );
  assert.deepEqual(
    POST_DECODE_OBJECT_RGB_IDENTITY_ORDER.filter(
      (identity) => !base.conditionChannelTypes.discrete.includes(identity),
    ),
    [],
    "object compositor identities must remain discrete source channels",
  );
  const config = {
    schemaVersion:
      "stage4-post-decode-authoritative-object-rgb-compositor-inactive-config-v1",
    status: "cpu_supported_inactive",
    modelId: "ai-painter-stage4-post-decode-object-rgb-compositor-candidate",
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
    denoiserArchitecture: POST_DECODE_OBJECT_RGB_ARCHITECTURE_ID,
    postDecodeObjectRgbIdentityOrder: [
      ...POST_DECODE_OBJECT_RGB_IDENTITY_ORDER,
    ],
    postDecodeObjectRgbInputIdentity: "decoded_rgb_plus_same_class_mask",
    postDecodeObjectRgbMerge: "authoritative_mask_normalized_rgb_compositor_v1",
    predictionTarget: base.predictionTarget,
    activationGates: Object.fromEntries(
      POST_DECODE_OBJECT_RGB_INACTIVE_GATES.map((field) => [field, false]),
    ),
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
  };
  validatePostDecodeObjectRgbInactiveConfig(config);
  return config;
}

export function validatePostDecodeObjectRgbInactiveConfig(config) {
  assert.equal(
    config.schemaVersion,
    "stage4-post-decode-authoritative-object-rgb-compositor-inactive-config-v1",
  );
  assert.equal(config.status, "cpu_supported_inactive");
  assert.equal(
    config.denoiserArchitecture,
    POST_DECODE_OBJECT_RGB_ARCHITECTURE_ID,
  );
  assert.equal(config.conditionChannels, 23);
  assert.equal(config.latentChannels, 12);
  assert.equal(config.denoiserBaseChannels, 64);
  assert.equal(config.latentDownsampleFactor, 4);
  assert.deepEqual(
    config.postDecodeObjectRgbIdentityOrder,
    POST_DECODE_OBJECT_RGB_IDENTITY_ORDER,
  );
  assert.equal(
    config.postDecodeObjectRgbInputIdentity,
    "decoded_rgb_plus_same_class_mask",
  );
  assert.equal(
    config.postDecodeObjectRgbMerge,
    "authoritative_mask_normalized_rgb_compositor_v1",
  );
  assert.deepEqual(
    Object.keys(config.activationGates),
    POST_DECODE_OBJECT_RGB_INACTIVE_GATES,
  );
  for (const field of POST_DECODE_OBJECT_RGB_INACTIVE_GATES) {
    assert.equal(
      config.activationGates[field],
      false,
      `${field} must be false`,
    );
  }
  for (const field of [
    "stage4ControlledStructureArm",
    "stage4ResponsibilityComponentRole",
    "training",
    "loss",
    "optimizer",
    "checkpointPath",
  ]) {
    assert.equal(
      Object.hasOwn(config, field),
      false,
      `inactive config contains forbidden field ${field}`,
    );
  }
  assert.equal(config.ownerAuthorizationRequired, false);
  assert.equal(config.ownerResponseRequired, false);
  return true;
}
