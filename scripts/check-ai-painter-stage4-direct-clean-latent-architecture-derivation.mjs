import assert from "node:assert/strict";
import {
  EXITED_ROUTE_SPECS,
  deriveDirectCleanLatentArchitecture,
} from "./lib/ai-painter-stage4-direct-clean-latent-architecture-derivation-v1.mjs";

const fixture = {
  registry: {
    capabilityVersion: "stage4-post-decode-full-condition-route-object-responsibility-renderer-change-candidate-v1",
    taskId: "remain_failed_closed_until_new_uniquely_derived_architecture_rule_exists",
    activity: "failed_closed",
    latestTrainingTerminal: {
      runId: "stage4-post-decode-full-condition-responsibility-stage0-2026082603",
    },
  },
  activeConfig: {
    conditionChannels: 23,
    latentChannels: 12,
    latentDownsampleFactor: 4,
    autoencoderArchitecture: "residual_4x_latent_pixel_detail_v2",
    denoiserBaseChannels: 64,
    diffusionSteps: 1000,
    training: {
      denoiserEpochs: 40,
      batchSize: 1,
      resolutionStages: [
        { width: 256, height: 192 },
        { width: 512, height: 384 },
        { width: 1024, height: 768 },
      ],
      denoiserLossWeights: {
        velocity: 1,
        cleanLatent: 1,
        decodedRgb: 1,
        objectSemanticRgb: 1,
      },
      bestCheckpointMetricWeights: {
        velocityPredictionMse: 1,
        cleanLatentMae: 1,
        decodedRgbMae: 1,
        objectSemanticRgbMae: 1,
      },
    },
  },
  latestTerminal: {
    runId: "stage4-post-decode-full-condition-responsibility-stage0-2026082603",
    status: "post_decode_full_condition_responsibility_stage0_real_visual_failure",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  },
  machineReview: {
    status: "machine_reviews_failed",
    reviewThresholdsChanged: false,
    reviews: [1, 5, 10, 20, 30, 40].map((epoch) => ({ epoch, passed: false })),
  },
  exitedRoutes: EXITED_ROUTE_SPECS.map((spec) => ({
    id: spec.id,
    terminal: { status: spec.expectedStatus },
  })),
  completeWorldModelSource: [
    "class ProjectOwnedMultiscaleConditionUNet",
    "self.latent_stem = nn.Conv2d(latent_channels",
    "SinusoidalTimeEmbedding",
    "noisy_latent,\n            timestep,\n            conditions",
    "stage4_post_decode_full_condition_responsibility_heads",
  ].join("\n"),
  trainerSource: [
    "velocity_target(",
    "deterministic_velocity_step(",
    "evaluate_deterministic_rollout_rgb_quality_v7",
    "rolloutSteps",
  ].join("\n"),
  legacyRgbRefinerSource: [
    "torch.cat((condition, base_rgb), dim=1)",
    "directOutput",
  ].join("\n"),
  legacyRgbRefinerConfig: { inputChannels: 17, directOutput: true },
};

const result = deriveDirectCleanLatentArchitecture(fixture);
assert.equal(result.selectedOutcome, "direct_condition_to_clean_latent_is_unique_minimum_remaining_axis");
assert.equal(result.architectureId, "stage4_direct_condition_clean_latent_generator_v1");
assert.deepEqual(result.uniquelyDerivedStructure.widths, [64, 128, 256]);
assert.equal(result.uniquelyDerivedStructure.input.channels, 23);
assert.equal(result.uniquelyDerivedStructure.output.channels, 12);
assert.equal(result.uniquelyDerivedStructure.sampler, "single_condition_forward_no_diffusion_rollout");
assert.equal(result.trainingContractDelta.newLossTermAdded, false);
assert.deepEqual(result.trainingContractDelta.removedInapplicableDiffusionOnlyLossTerms, ["velocity"]);
assert.equal(result.legacyDirectRgbExclusion.historicalCheckpointCompatible, false);
assert.equal(result.freeArchitectureParameterChosen, false);

const mutations = [
  ["wrong current task", (value) => (value.registry.taskId = "old_smoke")],
  ["active route not failed closed", (value) => (value.registry.activity = "running")],
  ["wrong latest run", (value) => (value.latestTerminal.runId = "historical-run")],
  ["condition count changed", (value) => (value.activeConfig.conditionChannels = 22)],
  ["latent count changed", (value) => (value.activeConfig.latentChannels = 8)],
  ["autoencoder factor changed", (value) => (value.activeConfig.latentDownsampleFactor = 8)],
  ["base width changed", (value) => (value.activeConfig.denoiserBaseChannels = 96)],
  ["review omitted", (value) => value.machineReview.reviews.pop()],
  ["review pass injected", (value) => (value.machineReview.reviews[0].passed = true)],
  ["threshold change injected", (value) => (value.machineReview.reviewThresholdsChanged = true)],
  ["exited route omitted", (value) => value.exitedRoutes.pop()],
  ["exited route status changed", (value) => (value.exitedRoutes[0].terminal.status = "qualified")],
  ["diffusion model token missing", (value) => (value.completeWorldModelSource = value.completeWorldModelSource.replace("SinusoidalTimeEmbedding", ""))],
  ["rollout trainer token missing", (value) => (value.trainerSource = value.trainerSource.replace("rolloutSteps", ""))],
  ["legacy direct RGB identity missing", (value) => (value.legacyRgbRefinerConfig.directOutput = false)],
  ["clean latent supervision missing", (value) => delete value.activeConfig.training.denoiserLossWeights.cleanLatent],
  ["decoded RGB supervision missing", (value) => delete value.activeConfig.training.bestCheckpointMetricWeights.decodedRgbMae],
];

for (const [name, mutate] of mutations) {
  const value = structuredClone(fixture);
  mutate(value);
  assert.throws(() => deriveDirectCleanLatentArchitecture(value), undefined, name);
}

console.log(JSON.stringify({
  status: "passed",
  positiveChecks: 10,
  negativeChecks: mutations.length,
  architectureId: result.architectureId,
  freeArchitectureParameterChosen: result.freeArchitectureParameterChosen,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2));
