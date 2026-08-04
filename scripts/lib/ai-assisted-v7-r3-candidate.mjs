import crypto from "node:crypto"

export const R3_CANDIDATE_VERSION = "v7_bounded_repair_r3_candidate"
export const R3_TAIL_EPOCHS = Object.freeze([100, 110, 120])
export const R3_SMOKE_MANIFEST_METRIC_FIELDS = Object.freeze({
  objectTreeRgbMae: "trainObjectTreeRgbMae",
  objectRockRgbMae: "trainObjectRockRgbMae",
  objectVegetationRgbMae: "trainObjectVegetationRgbMae",
  pathInteriorRgbMae: "trainPathInteriorRgbMae",
  pathForbiddenBoundaryRgbMae: "trainPathForbiddenBoundaryRgbMae",
})

export function compileR3CandidateOverlay({ r2Overlay, failureLearningReport, sourceEvidence }) {
  assert(r2Overlay?.patch?.training?.boundedRepairVersion === "v7_bounded_repair_r2", "r3_candidate_base_is_not_r2")
  assert(failureLearningReport?.repairContract?.configurationPatchProposal?.status === "proposal_only_not_applied", "r3_candidate_proposal_state_invalid")
  assert(failureLearningReport?.closure?.configurationPatchApplied === false, "r3_candidate_source_was_already_applied")

  const r2Training = structuredClone(r2Overlay.patch.training)
  const smokeEpochs = [...new Set([
    ...(r2Training.fixedEpochPreviewPolicy?.smoke ?? []),
    60,
    ...R3_TAIL_EPOCHS,
  ])].sort((left, right) => left - right)
  const objectWeights = {
    object_footprints: 1.0,
    object_tree: 1.0,
    object_rock: 1.25,
    object_vegetation: 1.0,
  }
  const training = {
    ...r2Training,
    boundedRepairVersion: R3_CANDIDATE_VERSION,
    repairContractId: "local-ai-v7-r3-object-channel-path-topology-tail-stability-candidate-20260804",
    trainingAuthorizationStatus: "not_authorized_candidate_only",
    denoiserLossVersion: "velocity_decoded_rgb_object_channel_path_topology_short_trajectory_v7_repair_r3_candidate",
    bestCheckpointMetric: "all_validation_multiseed_object_channel_path_topology_score_v7_repair_r3_candidate",
    semanticRgbConditionChannels: Object.keys(objectWeights),
    objectSemanticChannelWeights: objectWeights,
    denoiserLossWeights: {
      ...r2Training.denoiserLossWeights,
      objectSemanticRgb: 1.0,
      pathInteriorRgb: 1.5,
      pathForbiddenBoundaryRgb: 1.75,
    },
    bestCheckpointMetricWeights: {
      ...r2Training.bestCheckpointMetricWeights,
      objectFootprintsRgbMae: 0.25,
      objectTreeRgbMae: 0.25,
      objectRockRgbMae: 0.375,
      objectVegetationRgbMae: 0.25,
      objectSemanticRgbMae: 1.0,
      pathInteriorRgbMae: 1.5,
      pathForbiddenBoundaryRgbMae: 1.75,
    },
    rolloutCheckpointMetricWeights: {
      ...r2Training.rolloutCheckpointMetricWeights,
      rolloutObjectSemanticRgbMae: 1.0,
      rolloutPathInteriorRgbMae: 1.5,
      rolloutPathForbiddenBoundaryRgbMae: 1.75,
    },
    fixedEpochPreviewPolicy: {
      ...r2Training.fixedEpochPreviewPolicy,
      smoke: smokeEpochs,
    },
    smokeStabilityGate: {
      requiredConsecutiveTailPasses: 3,
      tailEpochs: [...R3_TAIL_EPOCHS],
      requireAllMachineReviewsPassed: true,
      preserveReviewThresholds: true,
      thresholdSource: "unchanged_existing_machine_review_contract",
    },
    diagnosticLossBreakdown: {
      enabled: true,
      channels: ["terrain_path_ground", ...Object.keys(objectWeights)],
      recordPerOptimizerStep: true,
      persistedMetricNames: [
        "objectFootprintsRgbMae",
        "objectTreeRgbMae",
        "objectRockRgbMae",
        "objectVegetationRgbMae",
        "objectSemanticRgbMae",
        "pathInteriorRgbMae",
        "pathForbiddenBoundaryRgbMae",
      ],
    },
    ownerTrainingAuthorization: {
      authorizationId: null,
      status: "not_authorized_candidate_only",
      gpuTrainingAuthorizedNow: false,
      singleSampleGpuOverfitSmokeAuthorized: false,
      fullTrainingAuthorized: false,
      strictRevalidationAuthorized: false,
      formalInferenceAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
    },
  }

  return {
    schemaVersion: "ai-assisted-v7-bounded-repair-r3-candidate-overlay-v1",
    status: "isolated_candidate_cpu_preflight_required_training_not_authorized",
    generatedBy: "local_ai_failure_learning_r3_candidate_compiler",
    baseConfigPath: r2Overlay.baseConfigPath,
    baseConfigSha256: r2Overlay.baseConfigSha256,
    sourceR2Overlay: sourceEvidence.r2Overlay,
    sourceFailureLearningReport: sourceEvidence.failureLearningReport,
    reviewThresholdPolicy: "preserved_unchanged",
    patch: {
      architectureVersion: "all-validation-multiseed-semantic-rollout-unet-v7-repair-r3-candidate",
      status: "isolated_r3_candidate_not_active",
      training,
    },
    promotionBoundary: {
      formalConfigActive: false,
      modelWeightsModified: false,
      gpuTrainingAuthorized: false,
      validationAuthorized: false,
      formalInferenceAuthorized: false,
      runtimeFrameAuthorized: false,
      worldEntryAuthorized: false,
      nextIndependentAuthorization: "single_sample_gpu_overfit_smoke_for_r3_candidate",
    },
  }
}

export function evaluateTailStability(reviews, gate) {
  const required = Number(gate?.requiredConsecutiveTailPasses ?? 0)
  const tailEpochs = (gate?.tailEpochs ?? []).map(Number)
  const rowsByEpoch = new Map((reviews ?? []).map((row) => [Number(row.epoch), row]))
  const evaluated = tailEpochs.map((epoch) => {
    const row = rowsByEpoch.get(epoch)
    return {
      epoch,
      recorded: Boolean(row),
      passed: row?.passed === true && Array.isArray(row?.issueCodes) && row.issueCodes.length === 0,
      issueCodes: Array.isArray(row?.issueCodes) ? [...row.issueCodes] : [],
    }
  })
  const consecutiveTailPasses = trailingPassCount(evaluated)
  const passed = required === 3
    && tailEpochs.length === required
    && evaluated.every((row) => row.recorded && row.passed)
  return {
    status: passed ? "tail_stability_gate_passed" : "tail_stability_gate_failed_closed",
    passed,
    requiredConsecutiveTailPasses: required,
    consecutiveTailPasses,
    evaluated,
  }
}

export function readR3SmokeManifestMetrics(metricRow) {
  const values = {}
  const missing = []
  for (const [contractField, manifestField] of Object.entries(R3_SMOKE_MANIFEST_METRIC_FIELDS)) {
    const value = metricRow?.[manifestField]
    values[contractField] = Number.isFinite(value) ? value : null
    if (!Number.isFinite(value)) missing.push(contractField)
  }
  return { values, missing }
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function trailingPassCount(rows) {
  let count = 0
  for (let index = rows.length - 1; index >= 0 && rows[index].passed; index -= 1) count += 1
  return count
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
