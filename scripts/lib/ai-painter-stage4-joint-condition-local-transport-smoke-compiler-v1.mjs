import assert from "node:assert/strict"
import path from "node:path"

import {
  CAPABILITY_VERSION,
  EXPECTED_TRAINER_STATUS,
  FIXED_PREVIEW_EPOCHS,
  FIXED_SAMPLE_ID,
  validateJointConditionLocalTransportSmokeExecutionPlan,
} from "./ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"

export { CAPABILITY_VERSION }

export const COMPILED_CONTRACT_SCHEMA =
  "stage4-joint-condition-local-transport-controlled-smoke-contract-v1"
export const COMPILATION_ROOT =
  ".runtime/ai-painter/stage4-joint-condition-local-transport-smoke-contract-compilations"
export const CONTROLLED_SMOKE_ROOT =
  ".runtime/ai-painter/stage4-joint-condition-local-transport-controlled-smokes"
export const SMOKE_WORK_ROOT =
  ".runtime/ai-painter/stage4-joint-condition-local-transport-smoke-work"
export const TRAINER_ARCHITECTURE_VERSION = "joint-condition-local-transport-denoiser-v1"
export const FROZEN_AUTOENCODER_SHA256 =
  "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba"

export const REQUIRED_CONTRACT_SOURCE_ROLES = Object.freeze([
  "current-execution-registry",
  "readonly-gpu-terminal",
  "readonly-gpu-report",
  "readonly-active-config",
  "readonly-gpu-diagnostic",
  "readonly-gradient-evidence",
  "readonly-cuda-telemetry",
  "readonly-model-state-hashes",
  "readonly-native-rgb-resource-boundary",
  "cpu-support-terminal",
  "formal-objective-contract",
  "dataset-manifest",
  "source-index",
  "first-train-condition-pack",
  "first-train-reference-rgb",
  "fixed-validation-condition-pack",
  "fixed-validation-reference-rgb",
  "frozen-autoencoder",
  "model-factory",
  "mode-registry",
  "authorization-policy",
  "joint-transport-contract",
  "trainer",
  "activation-materializer",
  "resource-preflight",
  "closed-loop-core",
  "closed-loop-package-materializer",
  "joint-smoke-adapter",
  "joint-smoke-package-materializer",
  "joint-smoke-compiler-library",
  "joint-smoke-compiler",
  "joint-smoke-compiler-checker",
  "professional-aesthetic-program",
  "condition-alignment-program",
  "preview-normalization-program",
  "late-stability-program",
])

const CONDITION_CHANNEL_ORDER = Object.freeze([
  "terrain_grass", "terrain_water", "terrain_path_ground", "terrain_shoreline",
  "terrain_natural_boundary", "terrain_mud_patch", "terrain_tall_grass", "walkable",
  "collision", "object_footprints", "object_tree", "object_rock", "object_vegetation",
  "focal_area", "object_instance", "coordinate_x", "coordinate_y", "signed_distance_path",
  "signed_distance_water", "signed_distance_shoreline", "signed_distance_object_ground",
  "signed_distance_boundary", "moisture_proximity",
])

export function buildJointConditionLocalTransportControlledSmokeContract({
  compilationRunId,
  runId,
  sourceEvidence,
}) {
  validateCompilationRunId(compilationRunId)
  validateSmokeRunId(runId)
  assert.notEqual(compilationRunId, runId)
  const outputDirectory = `${CONTROLLED_SMOKE_ROOT}/${runId}`
  const contract = {
    schemaVersion: COMPILED_CONTRACT_SCHEMA,
    status: "compiled_not_started",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION,
    architectureId: CAPABILITY_VERSION,
    trainerArchitectureVersion: TRAINER_ARCHITECTURE_VERSION,
    compilationRunId,
    executionIdentity: {
      kind: "controlled_single_validation_sample_model_smoke",
      runId,
      sampleId: FIXED_SAMPLE_ID,
      sampleSplit: "validation",
      seed: 20263722,
      topology: "west",
      resolutionStage: 0,
      resolution: { width: 256, height: 192 },
      latentResolution: { width: 64, height: 48 },
      epochCount: 30,
      previewEpochs: [...FIXED_PREVIEW_EPOCHS],
      initialization: "fixed_random_denoiser_initialization_without_checkpoint",
      autoencoderFrozen: true,
    },
    modelBoundary: {
      conditionChannels: 23,
      conditionChannelOrder: [...CONDITION_CHANNEL_ORDER],
      conditionResizeContract: "discrete_nearest_continuous_bilinear_v1",
      latentChannels: 12,
      latentDownsampleFactor: 4,
      widths: [64, 128, 256],
      timeEmbeddingChannels: 256,
      transportSiteCount: 12,
      transportParameterTensorCount: 24,
      transportParameterCount: 22464,
      existingConditionFusionPreserved: true,
      existingDiffusionObjectivePreserved: true,
      newLossTermAdded: false,
      freeArchitectureParameterChosen: false,
      objectiveReviewAlignmentClaimed: false,
    },
    frozenBoundaries: {
      approvedSampleCount: 64,
      splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannelOrderFrozen: true,
      autoencoderIdentityFrozen: true,
      lossValuesAndWeightsUnchanged: true,
      checkpointFormatUnchanged: true,
      machineReviewThresholdsUnchanged: true,
      failedPreviewPixelsUsedAsTrainingTarget: false,
      machineReviewResultsUsedAsTrainingTarget: false,
    },
    closedLoop: [
      "cpu_contract_and_config_preflight",
      "cuda_and_disk_resource_preflight",
      "internal_capability_ticket_atomic_consumption",
      "controlled_training",
      "training_evidence_validation",
      "fixed_preview_byte_reproduction",
      "automatic_machine_review",
      "late_stability_adjudication",
      "manifest_and_finalization",
      "terminal_recording",
    ],
    internalCapability: {
      issueAuthority: "local_ai_pet_world_program",
      singleUse: true,
      persistedReplayProtection: true,
      cannotExpandContract: true,
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      issueOnlyAfterAllPreflightChecksPass: true,
    },
    futureEvidenceNamespace: evidenceNamespace(outputDirectory),
    outputOwnership: {
      preflightCreatesRootAndPreflightOnly: true,
      preflightMustNotCreateTrainingOutput: true,
      trainerCreatesTrainingOutputExactlyOnce: true,
      trainingOutputMustBeAbsentBeforeTrainerStart: true,
      originalTrainerArtifactsAreImmutable: true,
    },
    evidenceIsolation: {
      outputDirectoryMustNotExistBeforeExecution: true,
      historicalDenoiserAccepted: false,
      historicalCheckpointAccepted: false,
      failedCheckpointAccepted: false,
      historicalRunAccepted: false,
      historicalOutputDirectoryAccepted: false,
      partialTrainingArtifactAccepted: false,
      crossCapabilityArtifactAccepted: false,
      sourceEvidenceHashesRecomputedBeforeExecution: true,
    },
    recoveryBoundary: {
      completedTrainingRecoveryWithoutRetrainingAllowed: true,
      readOnlyInfrastructureRecoveryMaximum: 1,
      trainingRestartAllowed: false,
      automaticSecondTrainingRunAllowed: false,
    },
    nextActionMapping: {
      qualified: "run_joint_condition_local_transport_smoke_late_stability_qualification",
      realVisualFailure: "close_joint_condition_local_transport_smoke_as_real_visual_failure",
      infrastructureFailure: "record_joint_condition_local_transport_smoke_infrastructure_failure",
      stage0AutomaticStartInsideSmokePackage: false,
    },
    prohibited: [
      "automatic_training_retry",
      "historical_or_failed_checkpoint_read",
      "reuse_exited_spatial_affine_candidate_identity",
      "cross_run_or_cross_capability_artifact_reuse",
      "free_hyperparameter_search",
      "loss_data_or_threshold_change",
      "stage0_stage1_stage2_inside_smoke_package",
      "formal_inference_checkpoint_promotion_runtime_frame_or_world_entry",
    ],
    sourceEvidence: normalizeSourceEvidence(sourceEvidence),
  }
  validateJointConditionLocalTransportControlledSmokeContract(contract)
  return contract
}

export function validateJointConditionLocalTransportControlledSmokeContract(value, {
  projectRoot = process.cwd(), requireFiles = false, sha256File = null,
} = {}) {
  assert.equal(value?.schemaVersion, COMPILED_CONTRACT_SCHEMA)
  assert.equal(value.status, "compiled_not_started")
  assert.equal(value.authority, "local_ai_pet_world_program")
  assert.equal(value.capabilityVersion, CAPABILITY_VERSION)
  assert.equal(value.architectureId, CAPABILITY_VERSION)
  assert.equal(value.trainerArchitectureVersion, TRAINER_ARCHITECTURE_VERSION)
  validateCompilationRunId(value.compilationRunId)
  validateSmokeRunId(value.executionIdentity?.runId)
  assert.deepEqual(value.executionIdentity, {
    kind: "controlled_single_validation_sample_model_smoke",
    runId: value.executionIdentity.runId,
    sampleId: FIXED_SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolutionStage: 0,
    resolution: { width: 256, height: 192 },
    latentResolution: { width: 64, height: 48 },
    epochCount: 30,
    previewEpochs: [...FIXED_PREVIEW_EPOCHS],
    initialization: "fixed_random_denoiser_initialization_without_checkpoint",
    autoencoderFrozen: true,
  })
  assert.equal(value.modelBoundary.conditionChannels, 23)
  assert.deepEqual(value.modelBoundary.conditionChannelOrder, CONDITION_CHANNEL_ORDER)
  assert.equal(value.modelBoundary.conditionResizeContract, "discrete_nearest_continuous_bilinear_v1")
  assert.equal(value.modelBoundary.latentChannels, 12)
  assert.equal(value.modelBoundary.latentDownsampleFactor, 4)
  assert.deepEqual(value.modelBoundary.widths, [64, 128, 256])
  assert.equal(value.modelBoundary.timeEmbeddingChannels, 256)
  assert.equal(value.modelBoundary.transportSiteCount, 12)
  assert.equal(value.modelBoundary.transportParameterTensorCount, 24)
  assert.equal(value.modelBoundary.transportParameterCount, 22464)
  for (const key of ["existingConditionFusionPreserved", "existingDiffusionObjectivePreserved"]) {
    assert.equal(value.modelBoundary[key], true)
  }
  for (const key of ["newLossTermAdded", "freeArchitectureParameterChosen", "objectiveReviewAlignmentClaimed"]) {
    assert.equal(value.modelBoundary[key], false)
  }
  assert.equal(value.frozenBoundaries.approvedSampleCount, 64)
  assert.deepEqual(value.frozenBoundaries.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  for (const key of ["autoencoderIdentityFrozen", "lossValuesAndWeightsUnchanged", "checkpointFormatUnchanged", "machineReviewThresholdsUnchanged"]) {
    assert.equal(value.frozenBoundaries[key], true)
  }
  assert.equal(value.internalCapability.issueAuthority, "local_ai_pet_world_program")
  assert.equal(value.internalCapability.singleUse, true)
  assert.equal(value.internalCapability.persistedReplayProtection, true)
  assert.equal(value.internalCapability.cannotExpandContract, true)
  assert.equal(value.internalCapability.ownerAuthorizationRequired, false)
  assert.equal(value.internalCapability.ownerResponseRequired, false)
  const expectedRoot = `${CONTROLLED_SMOKE_ROOT}/${value.executionIdentity.runId}`
  assert.deepEqual(value.futureEvidenceNamespace, evidenceNamespace(expectedRoot))
  for (const key of ["preflightCreatesRootAndPreflightOnly", "preflightMustNotCreateTrainingOutput", "trainerCreatesTrainingOutputExactlyOnce", "trainingOutputMustBeAbsentBeforeTrainerStart"]) {
    assert.equal(value.outputOwnership[key], true)
  }
  assert.equal(value.evidenceIsolation.outputDirectoryMustNotExistBeforeExecution, true)
  for (const key of ["historicalDenoiserAccepted", "historicalCheckpointAccepted", "failedCheckpointAccepted", "historicalRunAccepted", "historicalOutputDirectoryAccepted", "partialTrainingArtifactAccepted", "crossCapabilityArtifactAccepted"]) {
    assert.equal(value.evidenceIsolation[key], false)
  }
  assert.equal(value.recoveryBoundary.trainingRestartAllowed, false)
  assert.equal(value.recoveryBoundary.automaticSecondTrainingRunAllowed, false)
  assert.equal(value.nextActionMapping.stage0AutomaticStartInsideSmokePackage, false)
  for (const required of ["automatic_training_retry", "historical_or_failed_checkpoint_read", "reuse_exited_spatial_affine_candidate_identity"]) {
    assert.ok(value.prohibited.includes(required), `missing prohibition: ${required}`)
  }
  const roles = new Set()
  assert.ok(Array.isArray(value.sourceEvidence))
  for (const binding of value.sourceEvidence) {
    assert.match(binding.role ?? "", /^[a-z][a-z0-9-]{2,79}$/u)
    assert.equal(roles.has(binding.role), false, `duplicate source evidence role: ${binding.role}`)
    roles.add(binding.role)
    validateProjectRelativePath(binding.path, `sourceEvidence.${binding.role}.path`)
    assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u)
    if (requireFiles) {
      assert.equal(typeof sha256File, "function", "sha256File is required for file verification")
      assert.equal(sha256File(path.resolve(projectRoot, binding.path)), binding.sha256, `source evidence changed: ${binding.role}`)
    }
  }
  for (const role of REQUIRED_CONTRACT_SOURCE_ROLES) {
    assert.equal(roles.has(role), true, `missing source evidence role: ${role}`)
  }
  return structuredClone(value)
}

export function buildJointConditionLocalTransportSmokeExecutionPlan({
  packageIdentity,
  runId,
  executionPlanPath,
  compiledContractBinding,
  datasetPackageId,
  evidenceBindings,
  programs,
}) {
  validateSmokeRunId(runId)
  validateProjectRelativePath(executionPlanPath, "executionPlanPath")
  const outputRoot = `${CONTROLLED_SMOKE_ROOT}/${runId}`
  const workRoot = `${SMOKE_WORK_ROOT}/${runId}`
  const preflightConfig = `${workRoot}/preflight-config.json`
  const commonTrainerArguments = [
    "--dataset-package", evidenceBindings.datasetManifest.path,
    "--autoencoder-checkpoint", evidenceBindings.frozenAutoencoder.path,
    "--output-dir", "${TRAINING_OUTPUT}",
    "--resolution-stage", "0",
    "--overfit-sample-id", FIXED_SAMPLE_ID,
    "--overfit-epochs", "30",
    "--overfit-evaluation-interval", "5",
    "--stage4-joint-condition-local-transport-smoke",
    "--stage4-joint-condition-local-transport-smoke-contract", compiledContractBinding.path,
  ]
  const materializerCommon = [
    "--run-id", "${RUN_ID}",
    "--output-namespace", outputRoot,
    "--compiled-contract", compiledContractBinding.path,
    "--compiled-contract-sha256", compiledContractBinding.sha256,
  ]
  const plan = {
    schemaVersion: "ai-painter-stage4-joint-condition-local-transport-smoke-execution-plan-v1",
    status: "compiled_not_started",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION,
    architectureId: CAPABILITY_VERSION,
    packageIdentity,
    runId,
    outputRoot,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    maxInfrastructureRecoveryAttempts: 1,
    trainingRestartAllowed: false,
    automaticSecondTrainingRunAllowed: false,
    stage0AutomaticStart: false,
    fixedTrainingIdentity: {
      sampleId: FIXED_SAMPLE_ID,
      sampleSplit: "validation",
      seed: 20263722,
      topology: "west",
      resolutionStage: 0,
      resolution: { width: 256, height: 192 },
      epochCount: 30,
      previewEpochs: [...FIXED_PREVIEW_EPOCHS],
      initialization: "fixed_random_denoiser_initialization_without_checkpoint",
      autoencoderFrozen: true,
    },
    commands: {
      preflight: [
        command("cpu-contract", "node", programs.compilerChecker, ["--plan", executionPlanPath, "--mode", "preflight"]),
        command("active-config-audit", "python", programs.activationMaterializer, [
          "--operation", "template", ...materializerCommon, "--output", preflightConfig,
        ]),
        command("trainer-readonly-preflight", "python", programs.trainer, [
          "--config", preflightConfig, ...commonTrainerArguments, "--preflight-only",
        ]),
        command("cuda-resource", "python", programs.resourcePreflight, [
          "cuda-resource", "--candidate-identity", CAPABILITY_VERSION,
        ]),
        command("disk-capacity", "python", programs.resourcePreflight, [
          "disk-capacity", "--candidate-identity", CAPABILITY_VERSION,
        ]),
      ],
      activation: command("materialize-active-config", "python", programs.activationMaterializer, [
        "--operation", "consume", ...materializerCommon,
        "--dataset-package-id", datasetPackageId,
        "--output", "${OUTPUT_ROOT}/active-config.json",
      ]),
      trainer: command("controlled-smoke-trainer", "python", programs.trainer, [
        "--config", "${OUTPUT_ROOT}/active-config.json", ...commonTrainerArguments,
      ]),
    },
    evidenceBindings: structuredClone(evidenceBindings),
    artifacts: {
      activeConfig: "active-config.json",
      preflightReport: "preflight-report.json",
      trainingOutput: "training-output",
      trainerManifest: "training-output/manifest.json",
      trainerProgress: "training-output/progress.json",
      resourceTelemetry: "training-output/resource-telemetry.json",
      machineReviewTimeline: "machine-review-timeline.json",
      lateStabilityQualification: "late-stability-qualification.json",
      manifest: "manifest.json",
      finalization: "finalization/finalization.json",
    },
    reviewWorkRoot: workRoot,
    expectedTrainerManifestStatus: EXPECTED_TRAINER_STATUS,
  }
  validateJointConditionLocalTransportSmokeExecutionPlan(plan, { requireFiles: false })
  return plan
}

export function validateCompilationRunId(value) {
  assert.match(value ?? "", /^stage4-joint-condition-local-transport-smoke-contract-[0-9]{8}-[0-9]{9}-[a-f0-9]{8}$/u)
  return value
}

export function validateSmokeRunId(value) {
  assert.match(value ?? "", /^[0-9]{8}-[0-9]{9}-joint-condition-local-transport-smoke$/u)
  return value
}

function evidenceNamespace(root) {
  return {
    outputDirectory: root,
    activeConfig: `${root}/active-config.json`,
    internalTicket: `${root}/internal-ticket.json`,
    ticketConsumption: `${root}/internal-ticket-consumption.json`,
    preflightReport: `${root}/preflight-report.json`,
    trainingOutput: `${root}/training-output`,
    progress: `${root}/training-output/progress.json`,
    resourceTelemetry: `${root}/training-output/resource-telemetry.json`,
    fixedPreviews: `${root}/training-output/fixed-epoch-previews`,
    machineReviewTimeline: `${root}/machine-review-timeline.json`,
    lateStabilityQualification: `${root}/late-stability-qualification.json`,
    manifest: `${root}/manifest.json`,
    finalization: `${root}/finalization/finalization.json`,
    phaseTerminal: `${root}/phase-terminal.json`,
  }
}

function normalizeSourceEvidence(value) {
  assert.ok(Array.isArray(value), "sourceEvidence must be an array")
  return value.map((binding) => ({
    role: binding.role,
    path: binding.path.replaceAll("\\", "/"),
    sha256: binding.sha256,
  })).sort((left, right) => left.role.localeCompare(right.role))
}

function command(id, runtime, program, argumentsList) {
  return { id, runtime, program: structuredClone(program), arguments: argumentsList, expectedExitCode: 0 }
}

function validateProjectRelativePath(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`)
  assert.ok(value.length > 0 && !path.isAbsolute(value) && !/^[A-Za-z]:[\\/]/u.test(value), `${label} must be project-relative`)
  assert.ok(!value.includes("\\") && !value.split("/").includes(".."), `${label} must be normalized`)
}
