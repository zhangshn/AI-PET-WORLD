import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const ARCHITECTURE_ID = "stage4_post_decode_full_condition_route_object_responsibility_renderer_v1";
export const MODE_ID = "post_decode_full_condition_responsibility_stage4_smoke";
export const AUTHORIZATION_STATUS = "local_ai_post_decode_full_condition_responsibility_controlled_smoke_active";
export const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6";
export const SEED = 20263722;
export const PREVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30]);
export const RESPONSIBILITY_ORDER = Object.freeze([
  "terrain_path_ground", "object_footprints", "object_tree", "object_rock", "object_vegetation",
]);
export const EXECUTION_ACTIONS = Object.freeze([
  "create_optimizer", "execute_backward", "inspect_autoencoder_identity",
  "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights",
  "select_bound_sample", "write_smoke_checkpoint",
]);
export const FROZEN_SOURCE_RELATIVE = ".runtime/ai-painter/stage4-controlled-structure-controlled-smokes/20260823-051400001-condition_fusion_only_final_direct_residual_23_64_12/active-config.json";
export const FROZEN_SOURCE_SHA256 = "fceb5a2f655fb909a3b207b1340e963846773d0d5707ee52e41c1a49bd832065";

export function compileControlledSmokeContract({ capabilityVersion, gpuTerminalBinding, recordedAtUtc }) {
  assert.match(capabilityVersion, /^[a-z0-9][a-z0-9-]{7,127}$/u);
  verifyBindingShape(gpuTerminalBinding);
  return {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-controlled-smoke-contract-v1",
    status: "compiled_not_started",
    capabilityVersion,
    architectureId: ARCHITECTURE_ID,
    modeId: MODE_ID,
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: SEED,
    requiredBoundarySides: ["west"],
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: [...PREVIEW_EPOCHS],
    initialization: "fixed_project_random_post_decode_full_condition_responsibility",
    responsibilityIdentityOrder: [...RESPONSIBILITY_ORDER],
    automaticClosure: {
      previewByteReproduction: true,
      machineReview: true,
      lateStabilityQualification: true,
      finalization: true,
      currentExecutionRegistry: true,
      eventLedgerAndSqlite: true,
    },
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    sourceEvidence: { readonlyGpuTerminal: gpuTerminalBinding },
    recordedAtUtc,
  };
}

export function validateControlledSmokeContract(contract, { capabilityVersion, gpuTerminalSha256 }) {
  assert.equal(contract.schemaVersion, "stage4-post-decode-full-condition-responsibility-controlled-smoke-contract-v1");
  assert.equal(contract.status, "compiled_not_started");
  assert.equal(contract.capabilityVersion, capabilityVersion);
  assert.equal(contract.architectureId, ARCHITECTURE_ID);
  assert.equal(contract.modeId, MODE_ID);
  assert.equal(contract.sampleId, SAMPLE_ID);
  assert.equal(contract.sampleSplit, "validation");
  assert.equal(contract.seed, SEED);
  assert.deepEqual(contract.requiredBoundarySides, ["west"]);
  assert.deepEqual(contract.resolution, { width: 256, height: 192 });
  assert.equal(contract.epochCount, 30);
  assert.deepEqual(contract.previewEpochs, PREVIEW_EPOCHS);
  assert.deepEqual(contract.responsibilityIdentityOrder, RESPONSIBILITY_ORDER);
  assert.equal(contract.automaticRetryAllowed, false);
  assert.equal(contract.ownerAuthorizationRequired, false);
  assert.equal(contract.ownerResponseRequired, false);
  assert.equal(contract.sourceEvidence.readonlyGpuTerminal.sha256, gpuTerminalSha256);
  return true;
}

export function buildActiveConfig({ frozenSource, capabilityVersion, attemptId, ticketBinding, consumptionBinding }) {
  const config = structuredClone(frozenSource);
  delete config.stage4ControlledStructureArm;
  delete config.stage4ResponsibilityComponentRole;
  config.modelId = "ai-painter-stage4-post-decode-full-condition-responsibility-controlled-smoke";
  config.architectureVersion = "post-decode-full-condition-responsibility-controlled-smoke-v1";
  config.status = "active_local_ai_controlled_smoke";
  config.capabilityCandidateOnly = true;
  config.denoiserArchitecture = ARCHITECTURE_ID;
  config.denoiserBaseChannels = 64;
  config.postDecodeResponsibilityIdentityOrder = [...RESPONSIBILITY_ORDER];
  config.postDecodeResponsibilityInputIdentity = "decoded_rgb_3_plus_complete_typed_conditions_23";
  config.postDecodeResponsibilityInputChannels = 26;
  config.postDecodeResponsibilityBranchWidth = 64;
  config.postDecodeResponsibilityOutputChannels = 3;
  config.postDecodeResponsibilityMerge = "authoritative_mask_normalized_full_condition_responsibility_rgb_v1";
  config.activationGates = {
    configurationActiveNow: true,
    gpuNow: true,
    optimizerNow: true,
    backwardNow: true,
    weightModificationNow: true,
    smokeNow: true,
    trainingNow: true,
    formalInferenceNow: false,
    runtimeFrameNow: false,
    worldEntryNow: false,
  };
  config.ownerAuthorizationRequired = false;
  config.ownerResponseRequired = false;
  const training = config.training;
  delete training.ownerTrainingAuthorization;
  delete training.stage4AuthoritativeSemanticCarrierSmokeContract;
  delete training.stage4AuthoritativeSemanticCarrierFormalStageContract;
  delete training.stage4PostDecodeObjectRgbSmokeContract;
  delete training.stage4PostDecodeObjectRgbFormalStageContract;
  training.trainingAuthorizationStatus = AUTHORIZATION_STATUS;
  training.seed = SEED;
  training.authorizedOverfitSampleId = SAMPLE_ID;
  training.authorizedInitialization = "fixed_project_random_post_decode_full_condition_responsibility";
  training.localAiCapabilityTicket = {
    ticketId: `local-ai-${capabilityVersion}-${attemptId}`,
    ticketPath: ticketBinding.path,
    ticketSha256: ticketBinding.sha256,
    consumptionPath: consumptionBinding.path,
    consumptionSha256: consumptionBinding.sha256,
    executionState: "consumed",
    status: AUTHORIZATION_STATUS,
    executionActions: [...EXECUTION_ACTIONS],
  };
  training.stage4PostDecodeFullConditionResponsibilitySmokeContract = {
    status: "active_local_ai_internal_capability",
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: SEED,
    requiredBoundarySides: ["west"],
    epochCount: 30,
    previewEpochs: [...PREVIEW_EPOCHS],
    resolution: { width: 256, height: 192 },
    initialization: "fixed_project_random_post_decode_full_condition_responsibility",
    automaticMachineReview: true,
    automaticLateStabilityQualification: true,
    automaticRetryAllowed: false,
  };
  training.stage4PostDecodeFullConditionResponsibilityFrozenTrainingContract = {
    sourceConfigPath: FROZEN_SOURCE_RELATIVE,
    sourceConfigSha256: FROZEN_SOURCE_SHA256,
  };
  if (training.stage4UnifiedTrainingPreviewSamplingContract) {
    training.stage4UnifiedTrainingPreviewSamplingContract.status = "active_local_ai_internal_capability";
  }
  return config;
}

export function validateActiveConfig(config) {
  assert.equal(config.denoiserArchitecture, ARCHITECTURE_ID);
  assert.equal(config.denoiserBaseChannels, 64);
  assert.equal(config.conditionChannels, 23);
  assert.equal(config.latentChannels, 12);
  assert.deepEqual(config.postDecodeResponsibilityIdentityOrder, RESPONSIBILITY_ORDER);
  assert.equal(config.postDecodeResponsibilityInputChannels, 26);
  assert.equal(config.postDecodeResponsibilityBranchWidth, 64);
  assert.equal(config.postDecodeResponsibilityOutputChannels, 3);
  assert.equal(config.training.trainingAuthorizationStatus, AUTHORIZATION_STATUS);
  assert.equal(config.training.authorizedOverfitSampleId, SAMPLE_ID);
  assert.equal(config.training.seed, SEED);
  assert.equal(config.training.batchSize, 1);
  assert.equal(config.training.stage4PostDecodeFullConditionResponsibilitySmokeContract.epochCount, 30);
  assert.deepEqual(config.training.stage4PostDecodeFullConditionResponsibilitySmokeContract.previewEpochs, PREVIEW_EPOCHS);
  assert.equal(config.activationGates.smokeNow, true);
  assert.equal(config.activationGates.trainingNow, true);
  assert.equal(config.activationGates.formalInferenceNow, false);
  assert.equal(config.activationGates.runtimeFrameNow, false);
  assert.equal(config.activationGates.worldEntryNow, false);
  assert.equal("ownerTrainingAuthorization" in config.training, false);
  return true;
}

export function qualifyLateStability(review) {
  const late = [10, 20, 30].map((epoch) => {
    const row = review.reviews.find((item) => item.epoch === epoch);
    return { epoch, failures: row?.issueCodes.length ?? Number.POSITIVE_INFINITY, passed: row?.passed === true };
  });
  const counts = late.map((row) => row.failures);
  const sustainedZero = counts.every((value) => value === 0);
  const decreaseThenZero = counts[2] === 0 && counts[1] === 0 && counts[0] > 0;
  const qualified = Boolean(late[1].passed && late[2].passed && (sustainedZero || decreaseThenZero));
  return {
    schemaVersion: "stage4-post-decode-full-condition-responsibility-late-stability-qualification-v1",
    status: qualified ? "qualified" : "not_qualified",
    qualified,
    route: sustainedZero ? "sustained_zero_from_first_late_epoch" : decreaseThenZero ? "strict_decrease_then_stable_zero" : null,
    lateTimeline: late,
    terminalRegression: !late[2].passed,
    thresholdChanged: false,
    recordedAtUtc: new Date().toISOString(),
  };
}

export function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
export function resolveInside(root, relativePath) {
  assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !relativePath.split(/[\\/]/u).includes(".."));
  const absolute = path.resolve(root, relativePath);
  assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`));
  return absolute;
}
function verifyBindingShape(binding) { assert.ok(binding && typeof binding.path === "string"); assert.match(binding.sha256, /^[a-f0-9]{64}$/u); }
