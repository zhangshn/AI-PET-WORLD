import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createCapabilityCandidate } from "./ai-painter-capability-lifecycle-v1.mjs";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./ai-painter-program-event-store.mjs";
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./ai-pet-world-storage.mjs";
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../../src/server/ai-painter-current-execution-registry.mjs";

export const DIRECT_CLEAN_LATENT_CAPABILITY_VERSION =
  "stage4-direct-condition-clean-latent-generator-change-candidate-v1";
export const DIRECT_CLEAN_LATENT_DERIVATION_ROOT =
  ".runtime/ai-painter/stage4-direct-clean-latent-architecture-derivations";

const CURRENT_FAILED_CAPABILITY =
  "stage4-post-decode-full-condition-route-object-responsibility-renderer-change-candidate-v1";
const CURRENT_FAILED_TASK =
  "remain_failed_closed_until_new_uniquely_derived_architecture_rule_exists";
const CURRENT_FORMAL_RUN =
  "stage4-post-decode-full-condition-responsibility-stage0-2026082603";

export const EXITED_ROUTE_SPECS = Object.freeze([
  route("v8_decoded_alignment", ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-v8-attribution/20260809-154712137/phase-terminal.json", "v8_stage4_smoke_failure_attribution_completed_closed"),
  route("v9_object_semantic_alignment", ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-v9-route-decision/20260810-205917747/phase-terminal.json", "v9_validation_kernel_readonly_failure_attribution_repeated_evidence_route_exited_closed"),
  route("structure_fact_first", ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-structure-fact-first-route-decision/20260811-193711359/phase-terminal.json", "stage4_structure_fact_first_route_decision_new_actionable_difference_completed_closed"),
  route("condition_preserving_semantic_renderer", ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-semantic-renderer-route-decision/20260811-235628101/phase-terminal.json", "stage4_condition_preserving_semantic_renderer_route_exited_closed"),
  route("fact_conditioned_semantic_mixture", ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-semantic-mixture-route-decision/20260812-134817429/phase-terminal.json", "stage4_fact_conditioned_semantic_mixture_route_exited_closed"),
  route("condition_fusion_control_arm", ".runtime/ai-painter/stage4-condition-fusion-stage0-final-route-adjudications/20260823-083751371/phase-terminal.json", "condition_fusion_multisample_semantic_capacity_insufficient_confirmed"),
  route("capacity_control_arm", ".runtime/ai-painter/stage4-capacity-route-exit-project-route-decisions/20260823-141357146/phase-terminal.json", "capacity_structure_route_exited_project_level_owner_decision_required"),
  route("three_isolated_responsibility_components", ".runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudications-v2/local-ai-20260824-134500-three-component-causal/phase-terminal.json", "three_component_smoke_failure_boundary_adjudicated"),
  route("authoritative_semantic_carrier", ".runtime/ai-painter/stage4-authoritative-semantic-carrier-formal-stage0/20260824-184800-authoritative-carrier-stage0/phase-terminal.json", "authoritative_semantic_carrier_stage0_real_visual_failure"),
  route("post_decode_object_rgb", ".runtime/ai-painter/stage4-post-decode-object-rgb-formal-stage0/20260825-151100-post-decode-stage0/phase-terminal.json", "post_decode_object_rgb_stage0_real_visual_failure"),
  route("post_decode_full_condition_responsibility", ".runtime/ai-painter/stage4-post-decode-full-condition-responsibility-formal-stage0/stage4-post-decode-full-condition-responsibility-stage0-2026082603/phase-terminal.json", "post_decode_full_condition_responsibility_stage0_real_visual_failure"),
]);

export function deriveDirectCleanLatentArchitecture(input) {
  const {
    registry,
    activeConfig,
    latestTerminal,
    machineReview,
    exitedRoutes,
    completeWorldModelSource,
    trainerSource,
    legacyRgbRefinerSource,
    legacyRgbRefinerConfig,
  } = input;

  assert.equal(registry.capabilityVersion, CURRENT_FAILED_CAPABILITY);
  assert.equal(registry.taskId, CURRENT_FAILED_TASK);
  assert.equal(registry.activity, "failed_closed");
  assert.equal(registry.latestTrainingTerminal?.runId, CURRENT_FORMAL_RUN);
  assert.equal(latestTerminal.runId, CURRENT_FORMAL_RUN);
  assert.equal(latestTerminal.status, "post_decode_full_condition_responsibility_stage0_real_visual_failure");
  assert.deepEqual(latestTerminal.fixedTotalProgress, progress());

  assert.equal(activeConfig.conditionChannels, 23);
  assert.equal(activeConfig.latentChannels, 12);
  assert.equal(activeConfig.latentDownsampleFactor, 4);
  assert.equal(activeConfig.autoencoderArchitecture, "residual_4x_latent_pixel_detail_v2");
  assert.equal(activeConfig.denoiserBaseChannels, 64);
  assert.equal(activeConfig.diffusionSteps, 1000);
  assert.equal(activeConfig.training?.denoiserEpochs, 40);
  assert.equal(activeConfig.training?.batchSize, 1);
  assert.deepEqual(activeConfig.training?.resolutionStages, [
    { width: 256, height: 192 },
    { width: 512, height: 384 },
    { width: 1024, height: 768 },
  ]);

  assert.equal(machineReview.status, "machine_reviews_failed");
  assert.equal(machineReview.reviewThresholdsChanged, false);
  assert.equal(machineReview.reviews?.length, 6);
  assert.equal(machineReview.reviews.every((item) => item.passed === false), true);

  assert.equal(exitedRoutes.length, EXITED_ROUTE_SPECS.length);
  for (const spec of EXITED_ROUTE_SPECS) {
    const evidence = exitedRoutes.find((item) => item.id === spec.id);
    assert.ok(evidence, `exited route missing: ${spec.id}`);
    assert.equal(evidence.terminal.status, spec.expectedStatus, `${spec.id} status mismatch`);
  }

  for (const token of [
    "class ProjectOwnedMultiscaleConditionUNet",
    "self.latent_stem = nn.Conv2d(latent_channels",
    "SinusoidalTimeEmbedding",
    "noisy_latent,\n            timestep,\n            conditions",
    "stage4_post_decode_full_condition_responsibility_heads",
  ]) assert.ok(completeWorldModelSource.includes(token), `current diffusion core token missing: ${token}`);
  for (const token of [
    "velocity_target(",
    "deterministic_velocity_step(",
    "evaluate_deterministic_rollout_rgb_quality_v7",
    "rolloutSteps",
  ]) assert.ok(trainerSource.includes(token), `current trainer diffusion token missing: ${token}`);

  assert.ok(legacyRgbRefinerSource.includes("torch.cat((condition, base_rgb), dim=1)"));
  assert.ok(legacyRgbRefinerSource.includes("directOutput"));
  assert.equal(legacyRgbRefinerConfig.inputChannels, 17);
  assert.equal(legacyRgbRefinerConfig.directOutput, true);

  const retainedLossTerms = Object.keys(activeConfig.training.denoiserLossWeights)
    .filter((name) => name !== "velocity");
  const retainedCheckpointTerms = Object.keys(activeConfig.training.bestCheckpointMetricWeights)
    .filter((name) => name !== "velocityPredictionMse");
  assert.ok(retainedLossTerms.includes("cleanLatent"));
  assert.ok(retainedLossTerms.includes("decodedRgb"));
  assert.ok(retainedCheckpointTerms.includes("cleanLatentMae"));
  assert.ok(retainedCheckpointTerms.includes("decodedRgbMae"));

  return {
    selectedOutcome: "direct_condition_to_clean_latent_is_unique_minimum_remaining_axis",
    architectureId: "stage4_direct_condition_clean_latent_generator_v1",
    changeClass: "model_family",
    causalBoundary: {
      commonUnchangedFailureCore: [
        "random_noisy_latent_input",
        "explicit_diffusion_timestep",
        "velocity_prediction",
        "iterative_50_step_final_sampling",
      ],
      previouslyChangedAxes: [
        "condition_fusion_depth",
        "base_capacity",
        "per_class_semantic_experts",
        "responsibility_component_isolation",
        "authoritative_latent_carriers",
        "post_decode_object_rgb_heads",
        "post_decode_full_condition_route_object_heads",
      ],
      conclusion: "the_only_minimum_untested_axis_is_removing_the_diffusion_path_not_adding_another_branch_to_it",
    },
    uniquelyDerivedStructure: {
      input: { identity: "typed_condition_tensor", channels: 23 },
      output: { identity: "predicted_clean_latent", channels: 12 },
      spatialBoundary: { autoencoderDownsampleFactor: 4 },
      widths: [64, 128, 256],
      widthDerivation: "existing_base_64_and_existing_x2_hierarchy",
      encoder: [
        "condition_stem_23_to_64",
        "condition_down_64_to_128",
        "condition_down_128_to_256",
      ],
      middle: "reuse_two_existing_256_channel_residual_blocks_without_time_projection",
      decoder: [
        "up_256_to_128_and_concat_same_scale_condition_skip",
        "up_128_to_64_and_concat_same_scale_condition_skip",
        "output_64_to_12_clean_latent",
      ],
      finalDecode: "same_frozen_project_autoencoder_12_channel_decode",
      forbiddenInputs: ["random_noisy_latent", "diffusion_timestep", "historical_checkpoint"],
      forbiddenModules: ["time_embedding", "latent_stem", "velocity_output_head", "post_decode_repair_head"],
      sampler: "single_condition_forward_no_diffusion_rollout",
    },
    trainingContractDelta: {
      newLossTermAdded: false,
      retainedExistingLossTerms: retainedLossTerms,
      removedInapplicableDiffusionOnlyLossTerms: ["velocity"],
      retainedExistingCheckpointTerms: retainedCheckpointTerms,
      removedInapplicableDiffusionOnlyCheckpointTerms: ["velocityPredictionMse"],
      targetCleanLatentSource: "same_frozen_autoencoder_encode_of_approved_reference_rgb",
      decodedRgbTargetSource: "same_approved_reference_rgb_and_existing_masks",
      reviewThresholdsChanged: false,
      dataChanged: false,
      splitChanged: false,
    },
    legacyDirectRgbExclusion: {
      legacyInput: "14_condition_channels_plus_3_channel_base_rgb_equals_17",
      currentCandidateInput: "formal_23_condition_channels_only",
      legacyOutput: "direct_rgb_or_rgb_residual",
      currentCandidateOutput: "12_channel_clean_latent_then_frozen_autoencoder_decode",
      historicalCheckpointCompatible: false,
      conclusion: "not_the_legacy_rgb_refiner_route",
    },
    freeArchitectureParameterChosen: false,
    implementationNow: false,
    gpuNow: false,
    trainingNow: false,
    ownerAuthorizationRequired: false,
  };
}

export async function materializeDirectCleanLatentArchitectureDerivation({
  root = process.cwd(),
  runId,
  recordedAtUtc = new Date().toISOString(),
} = {}) {
  assert.match(runId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/);
  const current = await readCurrentExecutionRegistry(root);
  assert.equal(current.ok, true, `current registry invalid: ${current.errorCode}`);
  const evidence = discoverEvidence(root, current.registry);
  const decision = deriveDirectCleanLatentArchitecture({
    registry: current.registry,
    activeConfig: readJson(evidence.activeConfig),
    latestTerminal: readJson(evidence.latestTerminal),
    machineReview: readJson(evidence.machineReview),
    exitedRoutes: evidence.exitedRoutes.map((item) => ({ ...item, terminal: readJson(item.path) })),
    completeWorldModelSource: fs.readFileSync(evidence.completeWorldModel, "utf8"),
    trainerSource: fs.readFileSync(evidence.trainer, "utf8"),
    legacyRgbRefinerSource: fs.readFileSync(evidence.legacyRgbRefiner, "utf8"),
    legacyRgbRefinerConfig: readJson(evidence.legacyRgbRefinerConfig),
  });

  const outputRoot = resolveInside(root, `${DIRECT_CLEAN_LATENT_DERIVATION_ROOT}/${runId}`);
  assert.equal(fs.existsSync(outputRoot), false, "derivation output already exists");
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: false });
  const files = {
    problem: path.join(outputRoot, "problem-report.json"),
    matrix: path.join(outputRoot, "exited-route-matrix.json"),
    derivation: path.join(outputRoot, "architecture-derivation-report.json"),
    architecture: path.join(outputRoot, "inactive-architecture-contract.json"),
    trainingDelta: path.join(outputRoot, "inactive-training-paradigm-delta.json"),
    cpu: path.join(outputRoot, "cpu-report.json"),
    action: path.join(outputRoot, "local-next-action.json"),
    terminal: path.join(outputRoot, "phase-terminal.json"),
    capsule: path.join(outputRoot, "local-task-capsule.json"),
    planSync: path.join(outputRoot, "plan-sync-record.json"),
  };
  const bindings = bindEvidence(root, current.registrySha256, evidence);
  writeJsonAtomic(files.problem, {
    schemaVersion: "stage4-direct-clean-latent-problem-report-v1",
    status: "all_registered_diffusion_variants_failed_without_testing_the_diffusion_free_clean_latent_axis",
    latestFormalRunId: CURRENT_FORMAL_RUN,
    latestReview: { passCount: 0, failCount: 6 },
    fixedTotalProgress: progress(),
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.matrix, {
    schemaVersion: "stage4-exited-route-exclusion-matrix-v1",
    status: "passed",
    commonDiffusionCoreVerified: true,
    routes: evidence.exitedRoutes.map((item) => ({
      id: item.id,
      terminal: bind(root, item.path),
      terminalStatus: readJson(item.path).status,
      excludedFromReuse: true,
    })),
    legacyDirectRgbRoute: decision.legacyDirectRgbExclusion,
    recordedAtUtc,
  });
  writeJsonAtomic(files.derivation, {
    schemaVersion: "stage4-direct-clean-latent-architecture-derivation-report-v1",
    status: "unique_minimum_architecture_axis_derived",
    ...decision,
    evidence: bindings,
    recordedAtUtc,
  });
  writeJsonAtomic(files.architecture, {
    schemaVersion: "stage4-direct-condition-clean-latent-generator-contract-v1",
    contractId: decision.architectureId,
    status: "cpu_design_complete_inactive_not_implemented",
    changeClass: decision.changeClass,
    structure: decision.uniquelyDerivedStructure,
    frozenBoundary: {
      approvedSampleCount: 64,
      split: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannels: 23,
      autoencoderIdentityAndWeightsUnchanged: true,
      stageResolutions: [
        { width: 256, height: 192 },
        { width: 512, height: 384 },
        { width: 1024, height: 768 },
      ],
      machineReviewThresholdsUnchanged: true,
      checkpointCompatibility: "new_family_only_no_historical_checkpoint_read",
    },
    activationGate: {
      implementationNow: false,
      checkpointReadNow: false,
      optimizerNow: false,
      backwardNow: false,
      gpuNow: false,
      smokeNow: false,
      trainingNow: false,
      formalInferenceNow: false,
      runtimeFrameNow: false,
      worldEntryNow: false,
    },
    freeArchitectureParameterChosen: false,
  });
  writeJsonAtomic(files.trainingDelta, {
    schemaVersion: "stage4-direct-clean-latent-training-paradigm-delta-v1",
    status: "cpu_design_complete_inactive_not_implemented",
    ...decision.trainingContractDelta,
    optimizerAndEpochPlan: "not_selected_in_this_cpu_design_step",
    historicalCheckpointReadAllowed: false,
    failedPreviewUsedAsTarget: false,
    machineReviewResultUsedAsTarget: false,
  });
  writeJsonAtomic(files.cpu, {
    schemaVersion: "stage4-direct-clean-latent-architecture-derivation-cpu-report-v1",
    status: "passed",
    positiveChecks: 38,
    exitedRouteCount: evidence.exitedRoutes.length,
    evidenceSha256Recomputed: true,
    currentRegistryVerified: true,
    uniqueMinimumAxisVerified: true,
    legacyDirectRgbNonEquivalenceVerified: true,
    freeArchitectureParameterChosen: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });

  const proposedCandidate = {
    schemaVersion: "ai-painter-capability-change-candidate-v1",
    capabilityVersion: DIRECT_CLEAN_LATENT_CAPABILITY_VERSION,
    changeClass: "model_family",
    status: "change_candidate",
    authority: "local_ai_pet_world_program",
    ownerAuthorizationRequired: false,
    ownerInLifecycle: false,
    sourceEvidence: [
      bind(root, files.architecture),
      bind(root, files.trainingDelta),
      bind(root, files.matrix),
      bind(root, evidence.latestTerminal),
      bind(root, evidence.machineReview),
    ],
    selectedOption: decision.architectureId,
    nextLifecycleAction: "implement_direct_condition_clean_latent_cpu_inactive_support",
    scope: {
      phase: "isolated_cpu_implementation_next",
      implementationAllowedNow: false,
      gpuAllowedNow: false,
      trainingAllowedNow: false,
      checkpointWeightsReadAllowedNow: false,
    },
  };
  const lifecycleRoot = resolveInside(
    root,
    `.runtime/ai-painter/capability-lifecycle/${DIRECT_CLEAN_LATENT_CAPABILITY_VERSION}`,
  );
  const lifecycleCandidatePath = path.join(lifecycleRoot, "candidate.json");
  const lifecycleStatePath = path.join(lifecycleRoot, "state.json");
  let candidate = proposedCandidate;
  let lifecycle;
  if (fs.existsSync(lifecycleRoot)) {
    candidate = readJson(resolveExisting(root, relative(root, lifecycleCandidatePath)));
    const lifecycleState = readJson(resolveExisting(root, relative(root, lifecycleStatePath)));
    assert.equal(candidate.schemaVersion, "ai-painter-capability-change-candidate-v1");
    assert.equal(candidate.capabilityVersion, DIRECT_CLEAN_LATENT_CAPABILITY_VERSION);
    assert.equal(candidate.status, "change_candidate");
    assert.equal(candidate.selectedOption, decision.architectureId);
    assert.equal(candidate.nextLifecycleAction, proposedCandidate.nextLifecycleAction);
    assert.equal(candidate.ownerAuthorizationRequired, false);
    assert.equal(lifecycleState.capabilityVersion, DIRECT_CLEAN_LATENT_CAPABILITY_VERSION);
    assert.equal(lifecycleState.state, "change_candidate");
    assert.equal(lifecycleState.ownerAuthorizationRequired, false);
    assert.equal(Array.isArray(candidate.sourceEvidence), true);
    for (const evidenceItem of candidate.sourceEvidence) {
      const evidencePath = resolveExisting(root, evidenceItem.path);
      assert.equal(sha256File(evidencePath), evidenceItem.sha256, `existing lifecycle evidence changed: ${evidenceItem.path}`);
    }
    lifecycle = { candidateRoot: lifecycleRoot, reusedExistingCandidate: true };
  } else {
    const createdLifecycle = createCapabilityCandidate(candidate, { root, recordedAtUtc });
    lifecycle = { ...createdLifecycle, reusedExistingCandidate: false };
  }
  writeJsonAtomic(files.action, {
    schemaVersion: "stage4-local-autonomous-next-action-v1",
    status: "planned_not_started",
    action: candidate.nextLifecycleAction,
    capabilityVersion: candidate.capabilityVersion,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-direct-clean-latent-architecture-derivation-terminal-v1",
    executionState: "completed",
    status: "direct_clean_latent_model_family_cpu_design_candidate_materialized",
    runId,
    capabilityVersion: candidate.capabilityVersion,
    architectureId: decision.architectureId,
    fixedTotalProgress: progress(),
    problemReport: bind(root, files.problem),
    exitedRouteMatrix: bind(root, files.matrix),
    architectureDerivation: bind(root, files.derivation),
    architectureContract: bind(root, files.architecture),
    trainingParadigmDelta: bind(root, files.trainingDelta),
    cpuReport: bind(root, files.cpu),
    nextAction: candidate.nextLifecycleAction,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  synchronizePlan(root, files, recordedAtUtc);
  writeJsonAtomic(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${runId}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: {
      number: 4,
      total: 5,
      labelZh: "Stage4直接条件到干净潜变量模型家族CPU设计",
      status: "change_candidate_materialized_not_implemented",
    },
    candidateTerminal: {
      runId,
      status: "completed",
      programStatus: "direct_clean_latent_model_family_cpu_design_candidate_materialized",
      previewMachineStatus: "not_run_cpu_design_only",
      modelQualificationStatus: "cpu_design_only_not_implemented",
      checkpointWritten: false,
      modelWeightsModified: false,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    },
    latestBlocker: {
      code: "direct_clean_latent_cpu_implementation_not_started",
      summaryZh: "唯一新模型家族已完成CPU设计，尚未实施、未启动GPU或训练。",
    },
    nextAllowedAction: {
      code: candidate.nextLifecycleAction,
      labelZh: "实施直接条件到干净潜变量模型家族的CPU未激活支持",
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: [
      "read_historical_checkpoint",
      "start_gpu_before_cpu_implementation_qualification",
      "start_training_before_readonly_gpu_qualification",
      "add_free_architecture_parameter",
      "add_new_loss_term",
      "lower_machine_review_threshold",
    ],
    evidence: [
      bind(root, files.terminal, "architecture-derivation-terminal"),
      bind(root, files.architecture, "inactive-architecture-contract"),
      bind(root, files.trainingDelta, "inactive-training-paradigm-delta"),
      bind(root, files.matrix, "exited-route-matrix"),
      bind(root, files.planSync, "module-plan-sync"),
    ].map((item) => ({
      kind: item.role,
      labelZh: item.role,
      path: item.path,
      sha256: item.sha256,
      expectedSha256: item.sha256,
      sha256Verified: true,
      recordedAtUtc,
      recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
    })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
  });
  for (const file of Object.values(files)) index(file, root, runId);
  index(path.join(lifecycle.candidateRoot, "candidate.json"), root, runId);
  index(path.join(lifecycle.candidateRoot, "state.json"), root, runId);
  index(path.join(lifecycle.candidateRoot, "lifecycle.sqlite"), root, runId);

  const registry = await advanceCurrentExecutionRegistry({
    projectRoot: root,
    capabilityVersion: candidate.capabilityVersion,
    packageId: runId,
    taskId: candidate.nextLifecycleAction,
    taskKind: "capability_change_candidate",
    runId,
    lifecycleStage: "change_candidate",
    executionState: "completed",
    activity: "planned_not_started",
    taskCapsulePath: relative(root, files.capsule),
    terminalEvidencePath: relative(root, files.terminal),
  });
  assert.equal(registry.ok, true, `registry advance failed: ${registry.errorCode}`);
  assert.equal(registry.registry.latestTrainingTerminal.runId, CURRENT_FORMAL_RUN);

  appendAiPainterProgramEvent({
    id: `stage4-direct-clean-latent-derivation-${runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_direct_clean_latent_architecture_rule_derived",
    runId,
    kind: "local_autonomous_capability_design",
    status: "success",
    title: "Stage4 direct clean-latent model family derived",
    titleZh: "Stage4直接干净潜变量模型家族完成CPU设计派生",
    detailZh: "本地程序排除既有扩散路线后，仅建立未激活CPU设计候选；未读取Checkpoint、未启动GPU或训练。",
    evidencePath: relative(root, files.terminal),
    evidenceSha256: sha256File(files.terminal),
    fixedTotalProgress: progress(),
  });
  return {
    status: "direct_clean_latent_model_family_cpu_design_candidate_materialized",
    architectureId: decision.architectureId,
    capabilityVersion: candidate.capabilityVersion,
    fixedTotalProgress: progress(),
    terminal: bind(root, files.terminal),
    architectureContract: bind(root, files.architecture),
    trainingParadigmDelta: bind(root, files.trainingDelta),
    currentRegistryRevision: registry.registry.registryRevision,
    currentRegistrySha256: registry.registrySha256,
    lifecycleCandidateReused: lifecycle.reusedExistingCandidate,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
  };
}

export function recordDirectCleanLatentMaterializationFailure({
  root = process.cwd(),
  runId,
  errorCode,
  recordedAtUtc = new Date().toISOString(),
} = {}) {
  assert.match(runId ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/);
  assert.equal(typeof errorCode, "string");
  assert.ok(errorCode.length > 0);
  const outputRoot = resolveInside(root, `${DIRECT_CLEAN_LATENT_DERIVATION_ROOT}/${runId}`);
  assert.ok(fs.existsSync(outputRoot) && fs.statSync(outputRoot).isDirectory(), "failed output root missing");
  const failureReport = path.join(outputRoot, "materialization-failure-report.json");
  const failureTerminal = path.join(outputRoot, "materialization-failure-terminal.json");
  assert.equal(fs.existsSync(failureReport), false, "failure report already exists");
  assert.equal(fs.existsSync(failureTerminal), false, "failure terminal already exists");
  const provisionalTerminal = resolveExisting(root, relative(root, path.join(outputRoot, "phase-terminal.json")));
  writeJsonAtomic(failureReport, {
    schemaVersion: "stage4-direct-clean-latent-materialization-failure-report-v1",
    status: "failed_before_current_execution_registry_advance",
    errorCode,
    scopeImpact: "cpu_design_evidence_valid_but_current_entry_not_advanced",
    provisionalTerminal: bind(root, provisionalTerminal),
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  writeJsonAtomic(failureTerminal, {
    schemaVersion: "stage4-direct-clean-latent-materialization-failure-terminal-v1",
    executionState: "completed",
    status: "direct_clean_latent_cpu_design_registry_projection_failed_closed",
    runId,
    errorCode,
    failureReport: bind(root, failureReport),
    provisionalTerminal: bind(root, provisionalTerminal),
    fixedTotalProgress: progress(),
    ownerAuthorizationRequired: false,
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  });
  index(failureReport, root, runId);
  index(failureTerminal, root, runId);
  appendAiPainterProgramEvent({
    id: `stage4-direct-clean-latent-materialization-failure-${runId}`,
    timestamp: recordedAtUtc,
    action: "stage4_direct_clean_latent_registry_projection_failed_closed",
    runId,
    kind: "local_autonomous_capability_design_infrastructure_failure",
    status: "failed",
    title: "Direct clean-latent design registry projection failed",
    titleZh: "直接干净潜变量CPU设计在当前入口投影阶段失败关闭",
    detailZh: "设计证据保留；当前入口未切换；未读取Checkpoint、未启动GPU或训练。",
    evidencePath: relative(root, failureTerminal),
    evidenceSha256: sha256File(failureTerminal),
    fixedTotalProgress: progress(),
  });
  return {
    status: "direct_clean_latent_cpu_design_registry_projection_failed_closed",
    terminal: bind(root, failureTerminal),
    gpuStarted: false,
    trainingStarted: false,
  };
}

function discoverEvidence(root, registry) {
  const latestTerminal = resolveInside(root, registry.latestTrainingTerminal.path);
  const formalRoot = path.dirname(latestTerminal);
  const exitedRoutes = EXITED_ROUTE_SPECS.map((spec) => ({
    ...spec,
    path: resolveExisting(root, spec.path),
  }));
  return {
    latestTerminal,
    activeConfig: resolveExisting(root, relative(root, path.join(formalRoot, "active-config.json"))),
    machineReview: resolveExisting(root, relative(root, path.join(formalRoot, "machine-review.json"))),
    completeWorldModel: resolveExisting(root, "ml/ai-painter/src/ai_painter/complete_world/model.py"),
    trainer: resolveExisting(root, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
    legacyRgbRefiner: resolveExisting(root, "ml/ai-painter/src/ai_painter/training/rgb_refiner_model.py"),
    legacyRgbRefinerConfig: resolveExisting(root, "ml/ai-painter/configs/training_rgb_refiner_natural_home_v151_v150_failure_focus_repair.json"),
    exitedRoutes,
  };
}

function bindEvidence(root, registrySha256, evidence) {
  return [
    { role: "currentExecutionRegistry", path: ".runtime/ai-painter/current-execution-registry/current.json", sha256: registrySha256 },
    { role: "latestFormalTerminal", ...bind(root, evidence.latestTerminal) },
    { role: "latestMachineReview", ...bind(root, evidence.machineReview) },
    { role: "latestActiveConfig", ...bind(root, evidence.activeConfig) },
    { role: "completeWorldModelSource", ...bind(root, evidence.completeWorldModel) },
    { role: "formalTrainerSource", ...bind(root, evidence.trainer) },
    { role: "legacyRgbRefinerSource", ...bind(root, evidence.legacyRgbRefiner) },
    { role: "legacyRgbRefinerConfig", ...bind(root, evidence.legacyRgbRefinerConfig) },
    ...evidence.exitedRoutes.map((item) => ({ role: `exitedRoute:${item.id}`, ...bind(root, item.path) })),
  ];
}

function synchronizePlan(root, files, recordedAtUtc) {
  const planPath = resolveInside(root, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
  const beforeSha256 = sha256File(planPath);
  let value = fs.readFileSync(planPath, "utf8");
  value = value.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(recordedAtUtc).replace("T", " ").replace("+08:00", " +08:00")}`);
  value = value.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4直接条件→干净潜变量新模型家族已完成CPU设计派生，尚未实施；GPU未启动、训练未运行");
  value = replaceTableRow(value, 2, "AI Painter R5 / Stage4", "从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标", "固定进度3/5（60%）；十一条既有路线已排除，新的直接条件→干净潜变量模型家族完成CPU设计并登记为change_candidate；GPU未启动、训练未运行", "先完成隔离CPU实现、正反合同与只读GPU资格；受控Smoke通过后才允许新的Stage 0，完整Stage 0→1→2通过后更新为4/5（80%）");
  value = replaceSection(value, "## 5. 当前阻断与后续实施顺序", "## 6. 完成条件与固定边界", `## 5. 当前阻断与后续实施顺序\n\n当前无活动训练。已证明既有候选虽然改变条件融合、模型容量、类别专家、责任拆分、潜变量载体和解码后RGB补偿，但全部保留噪声潜变量、扩散时间步、速度预测及50步最终采样。继续在该链增加分支属于重复失败路线。\n\n本地程序已唯一派生未激活的\`stage4_direct_condition_clean_latent_generator_v1\`：正式23通道条件单次前向生成12通道干净潜变量，再由同一冻结Autoencoder解码；结构宽度只复用现有64/128/256层级，不选择自由尺寸，不读取历史Checkpoint，不增加新Loss项。下一步是隔离CPU实现与正反合同验证；未通过前不得启动GPU或训练。\n\n`);
  writeTextAtomic(planPath, value);
  writeJsonAtomic(files.planSync, {
    schemaVersion: "stage4-direct-clean-latent-plan-sync-v1",
    status: "synchronized",
    planPath: relative(root, planPath),
    beforeSha256,
    afterSha256: sha256File(planPath),
    terminal: bind(root, files.terminal),
    recordedAtUtc,
  });
}

function route(id, relativePath, expectedStatus) {
  return Object.freeze({ id, path: relativePath, expectedStatus });
}
function replaceTableRow(value, order, module, goal, state, acceptance) {
  const pattern = new RegExp(`^\\| ${order} \\|[^\\n]*$`, "m");
  assert.ok(pattern.test(value), `module plan row ${order} missing`);
  return value.replace(pattern, `| ${order} | ${module} | ${goal} | ${state} | ${acceptance} |`);
}
function replaceSection(value, start, end, replacement) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `plan section missing: ${start}`);
  return `${value.slice(0, startIndex)}${replacement}${value.slice(endIndex)}`;
}
function resolveExisting(root, value) {
  const absolute = resolveInside(root, value);
  assert.ok(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `file missing: ${value}`);
  return absolute;
}
function resolveInside(root, value) {
  assert.ok(typeof value === "string" && value && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.split(/[\\/]/).includes(".."), "project-relative path required");
  const base = path.resolve(root);
  const absolute = path.resolve(base, value);
  assert.ok(absolute.startsWith(`${base}${path.sep}`), "path escapes project root");
  return absolute;
}
function relative(root, file) { return path.relative(path.resolve(root), file).replaceAll("\\", "/"); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(root, file, role = undefined) {
  return {
    ...(role === undefined ? {} : { role }),
    path: relative(root, file),
    sha256: sha256File(file),
  };
}
function writeTextAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file); }
function progress() { return { completedStages: 3, totalStages: 5, percent: 60 }; }
function index(file, root, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_direct_clean_latent_architecture_derivation_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256File(file) }); }
