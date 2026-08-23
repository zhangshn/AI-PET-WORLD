import assert from "node:assert/strict"

export const DECISION_A = "current_model_multisample_capacity_gap_confirmed"
export const DECISION_B = "current_training_gradient_interference_gap_confirmed"
export const DECISION_C = "current_model_capacity_and_gradient_interference_joint_gap_confirmed"
export const DECISION_D = "evidence_insufficient_for_model_training_boundary_decision"

export function adjudicateMultisampleCapacityGradientInterference(report) {
  assert.equal(report.status, "current_model_multisample_capacity_gradient_interference_gpu_diagnostic_completed")
  assert.deepEqual(report.population, { train: 48, validation: 8 })
  assert.deepEqual(report.classIdentityOrder, ["footprints", "tree", "rock", "vegetation"])
  assert.equal(report.sourceOrderPreserved, true)
  assert.equal(report.conditionChannelCount, 23)
  assert.equal(report.sampleDiagnostics.length, 56)
  assert.equal(new Set(report.sampleDiagnostics.map((row) => row.sampleId)).size, 56)
  assert.equal(report.sampleDiagnostics.every((row) => row.classDiagnostics.length === 4), true)
  assert.equal(report.sampleDiagnostics.every((row) => row.conditionRepresentationFinite && row.finalRgbFinite), true)
  assert.equal(report.sampleDiagnostics.flatMap((row) => row.classDiagnostics).every((row) => row.gradientFinite && row.sharedFinalPathGradientNonZero && row.ownConditionChannelReachesFinalPath), true)
  assert.equal(report.stateHashes.denoiserUnchanged, true)
  assert.equal(report.stateHashes.autoencoderUnchanged, true)
  assert.equal(report.safety.optimizerCreated, false)
  assert.equal(report.safety.backwardExecuted, false)
  assert.equal(report.safety.modelWeightsModified, false)
  assert.equal(report.safety.trainingStarted, false)
  assert.equal(report.safety.denoiserCheckpointRead, false)

  const capacityGap = report.capacityEvidence.exactConditionRepresentationCollisionCount > 0 || report.capacityEvidence.exactFinalRgbCollisionCount > 0
  const interference = report.interferenceEvidence.train.negativePairCount > 0
    && report.interferenceEvidence.validation.negativePairCount > 0
    && report.interferenceEvidence.train.crossClassNegativePairCount > 0
    && report.interferenceEvidence.validation.crossClassNegativePairCount > 0
  const selectedDecision = capacityGap && interference ? DECISION_C : capacityGap ? DECISION_A : interference ? DECISION_B : DECISION_D
  return {
    schemaVersion: "stage4-current-model-multisample-capacity-gradient-interference-adjudication-v1",
    status: selectedDecision,
    selectedDecision,
    capacityGapConfirmed: capacityGap,
    gradientInterferenceConfirmed: interference,
    reason: capacityGap && interference
      ? "Exact multi-sample representation collision and recurrent negative shared-final-path gradient interactions are both present."
      : capacityGap
        ? "Distinct approved conditions or targets collapse to an exact current-model representation or final-RGB identity."
        : interference
          ? "Negative shared-final-path gradient interactions recur in both train and validation populations, including cross-class interactions."
          : "The read-only diagnostic proves condition reachability and finite gradients but does not isolate an exact capacity collision or recurrent train-and-validation gradient interference boundary.",
  }
}
