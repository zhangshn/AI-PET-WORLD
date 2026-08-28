import assert from "node:assert/strict";

export const ARCHITECTURE_ID = "stage4_authoritative_visual_semantic_carrier_decoder_v1";
export const CARRIER_IDENTITY_ORDER = Object.freeze([
  "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
  "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass",
  "object_footprints", "object_tree", "object_rock", "object_vegetation",
]);
export const INACTIVE_GATE_FIELDS = Object.freeze([
  "configurationActiveNow", "gpuNow", "optimizerNow", "backwardNow",
  "weightModificationNow", "smokeNow", "trainingNow", "formalInferenceNow",
  "runtimeFrameNow", "worldEntryNow",
]);

export function buildAuthoritativeSemanticCarrierInactiveConfig(base) {
  assert.equal(base.conditionChannels, 23, "source condition channel count mismatch");
  assert.equal(base.latentChannels, 12, "source latent channel count mismatch");
  assert.equal(base.latentDownsampleFactor, 4, "source Autoencoder spatial factor mismatch");
  assert.equal(base.autoencoderArchitecture, "residual_4x_latent_pixel_detail_v2", "source Autoencoder architecture mismatch");
  assert.equal(base.denoiserBaseChannels, 64, "source base width mismatch");
  assert.equal(base.conditionChannelOrder.length, 23, "source channel order mismatch");
  assert.deepEqual(CARRIER_IDENTITY_ORDER.filter((id) => !base.conditionChannelTypes.discrete.includes(id)), [], "carrier identity must be a discrete source channel");
  const config = {
    schemaVersion: "stage4-authoritative-visual-semantic-carrier-inactive-config-v1",
    status: "cpu_supported_inactive",
    modelId: "ai-painter-stage4-authoritative-visual-semantic-carrier-candidate",
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
    denoiserArchitecture: ARCHITECTURE_ID,
    authoritativeSemanticCarrierIdentityOrder: [...CARRIER_IDENTITY_ORDER],
    predictionTarget: base.predictionTarget,
    activationGates: Object.fromEntries(INACTIVE_GATE_FIELDS.map((field) => [field, false])),
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
  };
  validateAuthoritativeSemanticCarrierInactiveConfig(config);
  return config;
}

export function validateAuthoritativeSemanticCarrierInactiveConfig(config) {
  assert.equal(config.schemaVersion, "stage4-authoritative-visual-semantic-carrier-inactive-config-v1");
  assert.equal(config.status, "cpu_supported_inactive");
  assert.equal(config.denoiserArchitecture, ARCHITECTURE_ID);
  assert.equal(config.conditionChannels, 23);
  assert.equal(config.latentChannels, 12);
  assert.equal(config.denoiserBaseChannels, 64);
  assert.equal(config.latentDownsampleFactor, 4);
  assert.deepEqual(config.authoritativeSemanticCarrierIdentityOrder, CARRIER_IDENTITY_ORDER);
  assert.deepEqual(Object.keys(config.activationGates), INACTIVE_GATE_FIELDS);
  for (const field of INACTIVE_GATE_FIELDS) assert.equal(config.activationGates[field], false, `${field} must be false`);
  for (const field of ["stage4ControlledStructureArm", "stage4ResponsibilityComponentRole", "training", "loss", "optimizer", "checkpointPath"]) assert.equal(Object.hasOwn(config, field), false, `inactive config contains forbidden field ${field}`);
  assert.equal(config.ownerAuthorizationRequired, false);
  assert.equal(config.ownerResponseRequired, false);
  return true;
}

