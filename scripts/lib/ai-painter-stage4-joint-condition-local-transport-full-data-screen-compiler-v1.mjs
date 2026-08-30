import assert from "node:assert/strict"
import path from "node:path"

import {
  CAPABILITY_VERSION,
  EXPECTED_TRAINER_STATUS,
  FIXED_SAMPLE_ID,
  LATE_EPOCHS,
  PLAN_SCHEMA_VERSION,
  PREVIEW_EPOCHS,
  validateJointConditionLocalTransportFullDataScreenExecutionPlan,
} from "./ai-painter-stage4-joint-condition-local-transport-full-data-screen-adapters-v1.mjs"

export { CAPABILITY_VERSION }

export const COMPILED_CONTRACT_SCHEMA = "stage4-joint-condition-local-transport-24-epoch-full-data-screen-execution-contract-v1"
export const COMPILATION_ROOT = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-contract-compilations"
export const SCREEN_ROOT = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens"
export const REVIEW_WORK_ROOT = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-review-work"
export const SCREEN_WORK_ROOT = ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-work"

export function buildJointConditionLocalTransportFullDataScreenContract({ compilationRunId, runId, sourceEvidence }) {
  assert.match(compilationRunId ?? "", /^stage4-joint-full-data-screen-compilation-[0-9]{17}$/u)
  assert.match(runId ?? "", /^[0-9]{8}-[0-9]{6,9}-joint-condition-local-transport-full-data-screen$/u)
  const evidence = normalizeEvidence(sourceEvidence)
  const inactive = evidence.find((row) => row.role === "inactive-full-data-screen-contract")
  assert.ok(inactive, "inactive screen contract evidence is required")
  const outputRoot = `${SCREEN_ROOT}/${runId}`
  return {
    schemaVersion: COMPILED_CONTRACT_SCHEMA,
    status: "compiled_not_started",
    authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION,
    architectureId: CAPABILITY_VERSION,
    compilationRunId,
    executionIdentity: {
      kind: "joint_condition_local_transport_24_epoch_full_data_screen",
      runId, seed: 20263722, resolutionStage: 0,
      resolution: { width: 256, height: 192 }, latentResolution: { width: 64, height: 48 },
      epochCount: 24, trainSampleCountPerEpoch: 48, optimizerStepsPerEpoch: 48,
      optimizerStepCount: 1152, previewEpochs: [...PREVIEW_EPOCHS], lateEpochs: [...LATE_EPOCHS],
      diffusionStepCount: 1000, requiredUniqueTrainingTimestepCount: 1000,
      inferenceTimestepCount: 50, requiredExactInferenceOverlapCount: 50,
      reviewSampleId: FIXED_SAMPLE_ID, reviewSampleSplit: "validation",
      initialization: "fixed_random_denoiser_initialization_without_checkpoint", autoencoderFrozen: true,
    },
    outputNamespace: {
      outputRoot, trainingOutput: `${outputRoot}/training-output`,
      reviewRoot: `${outputRoot}/machine-review-assets`,
      autonomousExecutionRoot: ".runtime/ai-painter/autonomous-closed-loop-executions",
    },
    frozenBoundary: {
      approvedSampleCount: 64, splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannels: 23, latentChannels: 12, widths: [64, 128, 256], timeEmbeddingChannels: 256,
      transportSiteCount: 12, transportParameterTensorCount: 24, transportParameterCount: 22464,
      lossValuesAndWeightsChanged: false, machineReviewThresholdsChanged: false,
      sourceSmokeCheckpointReadAllowed: false, historicalCheckpointReadAllowed: false,
      checkpointPromotionAllowed: false, stage0InitializationAllowed: false,
    },
    closedLoop: ["preflight", "execute", "validate", "review", "adjudicate", "finalize"],
    recovery: { maxInfrastructureRecoveryAttempts: 1, completedTrainingRecoveryWithoutRetraining: true, trainingRestartAllowed: false, automaticSecondTrainingRunAllowed: false },
    runtimeProjection: { activeStateSource: "autonomous_execution_state_and_progress", terminalRegistryAdvanceOnly: true, eventLedgerAndSqliteRequired: true, ownerWaitStateAllowed: false },
    sourceEvidence: evidence,
    activation: { gpuStarted: false, trainingStarted: false, contractOnly: true, ownerAuthorizationRequired: false, ownerResponseRequired: false },
  }
}

export function validateJointConditionLocalTransportFullDataScreenContract(value, { projectRoot = process.cwd(), requireFiles = false, sha256File = null } = {}) {
  assert.equal(value?.schemaVersion, COMPILED_CONTRACT_SCHEMA)
  assert.equal(value.status, "compiled_not_started")
  assert.equal(value.authority, "local_ai_pet_world_program")
  assert.equal(value.capabilityVersion, CAPABILITY_VERSION)
  assert.deepEqual(value.executionIdentity.previewEpochs, PREVIEW_EPOCHS)
  assert.deepEqual(value.executionIdentity.lateEpochs, LATE_EPOCHS)
  assert.equal(value.executionIdentity.optimizerStepCount, 1152)
  assert.equal(value.executionIdentity.diffusionStepCount, 1000)
  assert.equal(value.executionIdentity.requiredUniqueTrainingTimestepCount, 1000)
  assert.equal(value.executionIdentity.inferenceTimestepCount, 50)
  assert.equal(value.executionIdentity.requiredExactInferenceOverlapCount, 50)
  assert.equal(value.outputNamespace.outputRoot, `${SCREEN_ROOT}/${value.executionIdentity.runId}`)
  assert.equal(value.frozenBoundary.sourceSmokeCheckpointReadAllowed, false)
  assert.equal(value.frozenBoundary.historicalCheckpointReadAllowed, false)
  assert.equal(value.frozenBoundary.checkpointPromotionAllowed, false)
  assert.deepEqual(value.closedLoop, ["preflight", "execute", "validate", "review", "adjudicate", "finalize"])
  assert.equal(value.activation.gpuStarted, false)
  assert.equal(value.activation.trainingStarted, false)
  assert.equal(value.activation.ownerAuthorizationRequired, false)
  assert.equal(value.recovery.trainingRestartAllowed, false)
  assert.ok(value.sourceEvidence.some((row) => row.role === "inactive-full-data-screen-contract"))
  if (requireFiles) for (const binding of value.sourceEvidence) assert.equal(sha256File(path.resolve(projectRoot, binding.path)), binding.sha256, `source changed: ${binding.path}`)
  const serialized = JSON.stringify(value)
  for (const token of ["stage4_full_backbone_spatial_affine_conditioned_denoiser_v1", "stage4-spatial-affine-full-data-screens", "owner-action-request", "waiting_owner"]) assert.ok(!serialized.includes(token), `forbidden token: ${token}`)
  return structuredClone(value)
}

export function buildJointConditionLocalTransportFullDataScreenExecutionPlan({ contractBinding, contract, packageIdentity, executionPlanPath, datasetPackageId, programBindings, evidenceBindings }) {
  validateJointConditionLocalTransportFullDataScreenContract(contract)
  const runId = contract.executionIdentity.runId
  const outputRoot = contract.outputNamespace.outputRoot
  const trainer = programBindings.trainer
  const activation = programBindings.activation
  const checker = programBindings.compilerChecker
  const resources = programBindings.resourcePreflight
  const inactive = evidenceBindings.inactiveFullDataScreenContract
  const preflightConfig = `${SCREEN_WORK_ROOT}/${runId}/preflight-config.json`
  const commonTrainerArguments = ["--config", preflightConfig, "--dataset-package", evidenceBindings.datasetManifest.path, "--autoencoder-checkpoint", evidenceBindings.frozenAutoencoder.path, "--output-dir", "${TRAINING_OUTPUT}", "--resolution-stage", "0", "--stage4-joint-condition-local-transport-full-data-screen", "--stage4-joint-condition-local-transport-full-data-screen-contract", inactive.path]
  const plan = {
    schemaVersion: PLAN_SCHEMA_VERSION, status: "compiled_not_started", authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION, architectureId: CAPABILITY_VERSION, packageIdentity, runId, outputRoot,
    ownerAuthorizationRequired: false, ownerResponseRequired: false, maxInfrastructureRecoveryAttempts: 1,
    trainingRestartAllowed: false, automaticSecondTrainingRunAllowed: false, stage0AutomaticStart: false,
    trainingIdentity: {
      seed: 20263722, resolutionStage: 0, resolution: { width: 256, height: 192 }, epochCount: 24,
      trainSampleCountPerEpoch: 48, optimizerStepsPerEpoch: 48, optimizerStepCount: 1152,
      diffusionStepCount: 1000, requiredUniqueTrainingTimestepCount: 1000,
      inferenceTimestepCount: 50, requiredExactInferenceOverlapCount: 50,
      previewEpochs: [...PREVIEW_EPOCHS], lateEpochs: [...LATE_EPOCHS], reviewSampleId: FIXED_SAMPLE_ID,
      reviewSampleSplit: "validation", initialization: "fixed_random_denoiser_initialization_without_checkpoint", autoencoderFrozen: true,
    },
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    commands: {
      preflight: [
        nodeCommand("cpu-contract", checker, ["--plan", executionPlanPath, "--mode", "preflight"]),
        command("active-config-audit", activation, ["--operation", "template", "--run-id", "${RUN_ID}", "--output-namespace", outputRoot, "--inactive-contract", inactive.path, "--inactive-contract-sha256", inactive.sha256, "--output", preflightConfig]),
        command("trainer-readonly-preflight", trainer, [...commonTrainerArguments, "--preflight-only"]),
        command("cuda-resource", resources, ["cuda-resource", "--candidate-identity", CAPABILITY_VERSION]),
        command("disk-capacity", resources, ["disk-capacity", "--candidate-identity", CAPABILITY_VERSION]),
      ],
      activation: command("materialize-active-config", activation, ["--operation", "consume", "--run-id", "${RUN_ID}", "--output-namespace", outputRoot, "--inactive-contract", inactive.path, "--inactive-contract-sha256", inactive.sha256, "--dataset-package-id", datasetPackageId, "--output", "${OUTPUT_ROOT}/active-config.json"]),
      trainer: command("joint-full-data-screen-trainer", trainer, [...commonTrainerArguments.slice(0, 1), "${OUTPUT_ROOT}/active-config.json", ...commonTrainerArguments.slice(2)]),
    },
    evidenceBindings: { compiledScreenContract: contractBinding, ...evidenceBindings },
    artifacts: { activeConfig: "active-config.json", preflightReport: "preflight-report.json", trainingOutput: "training-output", trainerManifest: "training-output/manifest.json", trainerProgress: "training-output/progress.json", resourceTelemetry: "training-output/resource-telemetry.json", machineReviewTimeline: "machine-review-timeline.json", lateStabilityQualification: "late-stability-qualification.json", manifest: "manifest.json", finalization: "finalization/finalization.json" },
    reviewWorkRoot: `${REVIEW_WORK_ROOT}/${runId}`,
    expectedTrainerManifestStatus: EXPECTED_TRAINER_STATUS,
  }
  return plan
}

function normalizeEvidence(value) {
  assert.ok(Array.isArray(value) && value.length > 0)
  const rows = value.map((row) => { assert.match(row.role ?? "", /^[a-z0-9-]+$/u); assert.ok(typeof row.path === "string" && !path.isAbsolute(row.path) && !row.path.includes("..")); assert.match(row.sha256 ?? "", /^[a-f0-9]{64}$/u); return { role: row.role, path: row.path.replaceAll("\\", "/"), sha256: row.sha256 } })
  assert.equal(new Set(rows.map((row) => row.role)).size, rows.length)
  return rows.sort((a, b) => a.role.localeCompare(b.role))
}
function command(id, program, argumentsList) { return { id, runtime: "python", program, arguments: argumentsList, expectedExitCode: 0 } }
function nodeCommand(id, program, argumentsList) { return { id, runtime: "node", program, arguments: argumentsList, expectedExitCode: 0 } }
