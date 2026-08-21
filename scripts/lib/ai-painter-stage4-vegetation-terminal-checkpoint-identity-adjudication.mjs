import assert from "node:assert/strict"

export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const VEGETATION_ISSUE = "condition_object_vegetation_reference_semantic_mismatch"
export const SOURCE_RUN_ID = "20260821-024000000"

const ACTIVE = "training_loss_active_owner_authorized"
const finite = (value, label) => {
  assert.equal(Number.isFinite(Number(value)), true, `${label}_must_be_finite`)
  return Number(value)
}
const exactEpochs = (rows, label) => {
  assert.deepEqual(rows.map((row) => Number(row.epoch)), REVIEW_EPOCHS, `${label}_epoch_timeline_invalid`)
}
const title = (value) => `${value[0].toUpperCase()}${value.slice(1)}`

function activeTrainingEvidence(activeConfig) {
  const training = activeConfig?.training ?? {}
  const required = [
    "stage4VegetationFinalVisibleSemanticRepair",
    "stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation",
    "stage4PerClassFinalVisibleReferenceFeatureStructureObligation",
    "stage4EpochWorstSampleClassReferenceFeatureStructureReplay",
    "stage4PerClassWorstSampleReferenceFeatureStructureObligation",
  ]
  for (const key of required) {
    const contract = training[key]
    assert.ok(contract, `${key}_missing`)
    assert.equal(contract.enabled, true, `${key}_not_enabled`)
    assert.equal(contract.status, ACTIVE, `${key}_status_invalid`)
    assert.equal(contract.activationGate?.trainingNow, true, `${key}_training_gate_inactive`)
    assert.equal(contract.activationGate?.stage4FullTrainingNow, true, `${key}_stage4_gate_inactive`)
    assert.equal(contract.activationGate?.smokeNow, false, `${key}_smoke_residue_present`)
  }
  assert.equal(
    training.stage4VegetationFinalVisibleSemanticRepair.legalSupervision?.reference,
    "original_owner_approved_reference_rgb",
    "vegetation_reference_source_invalid",
  )
  assert.equal(
    training.stage4VegetationFinalVisibleSemanticRepair.legalSupervision?.maskChannel,
    "object_vegetation",
    "vegetation_mask_source_invalid",
  )
  assert.equal(
    training.stage4VegetationFinalVisibleSemanticRepair.legalSupervision?.failedPreviewPixelsUsedAsTargets,
    false,
    "failed_preview_target_forbidden",
  )
  assert.equal(
    training.stage4VegetationFinalVisibleSemanticRepair.legalSupervision?.machineReviewResultsUsedAsTargets,
    false,
    "machine_review_target_forbidden",
  )
  return required
}

function metricTimeline(manifest) {
  const rows = REVIEW_EPOCHS.map((epoch) => {
    const row = manifest.metrics.find((item) => Number(item.epoch) === epoch)
    assert.ok(row, `metric_epoch_${epoch}_missing`)
    return {
      epoch,
      checkpointSelectionScore: finite(row.validationCheckpointSelectionScore, `epoch_${epoch}_checkpoint_score`),
      fixedVegetationRgbMae: finite(row.validationFixedGridStage4SemanticMixtureVegetationFinalTypedRgbMae, `epoch_${epoch}_vegetation_rgb`),
      fixedVegetationEdgeMae: finite(row.validationFixedGridStage4SemanticMixtureVegetationFinalTypedEdgeMae, `epoch_${epoch}_vegetation_edge`),
      fixedVegetationMultiscaleLuminanceLoss: finite(row.validationFixedGridStage4SemanticMixtureVegetationFinalTypedMultiscaleLuminanceStructureLoss, `epoch_${epoch}_vegetation_fixed_luma`),
      rolloutVegetationLuminanceLoss: finite(row.validationRolloutVegetationFinalVisibleMultiscaleLuminanceStructureLoss, `epoch_${epoch}_vegetation_rollout_luma`),
      rolloutVegetationReferenceFeatureLoss: finite(row.validationRolloutVegetationFinalVisibleReferenceFeatureStructureLoss, `epoch_${epoch}_vegetation_rollout_feature`),
      worstSampleVegetationReferenceFeatureLoss: finite(row.trainStage4PerClassWorstSampleVegetationReferenceFeatureStructureLoss, `epoch_${epoch}_vegetation_worst_feature`),
      replayReferenceFeatureWeightedLoss: finite(row.trainStage4EpochWorstSampleClassReplayReferenceFeatureStructureWeightedLoss, `epoch_${epoch}_replay_feature`),
      replayClassIndex: finite(row.trainStage4EpochWorstSampleClassReplayClassIndex, `epoch_${epoch}_replay_class`),
      routeRequiredBoundaryContact: finite(row.validationFixedGridStage4DiagnosticRouteRequiredBoundaryContactMinimum, `epoch_${epoch}_route_boundary`),
      westBoundaryNonRegressionPassed: row.stage4CheckpointRouteWestBoundaryNonRegressionPassed,
      bestCheckpointUpdated: row.bestCheckpointUpdated,
    }
  })
  exactEpochs(rows, "metric")
  for (const row of rows) {
    assert.equal(row.rolloutVegetationLuminanceLoss > 0, true, `epoch_${row.epoch}_vegetation_rollout_luma_inactive`)
    assert.equal(row.rolloutVegetationReferenceFeatureLoss > 0, true, `epoch_${row.epoch}_vegetation_rollout_feature_inactive`)
    assert.equal(row.worstSampleVegetationReferenceFeatureLoss > 0, true, `epoch_${row.epoch}_vegetation_worst_feature_inactive`)
    assert.equal(row.replayReferenceFeatureWeightedLoss > 0, true, `epoch_${row.epoch}_vegetation_replay_inactive`)
  }
  assert.equal(rows.at(-1).fixedVegetationRgbMae < rows[0].fixedVegetationRgbMae, true, "vegetation_rgb_did_not_improve")
  assert.equal(rows.at(-1).fixedVegetationEdgeMae < rows[0].fixedVegetationEdgeMae, true, "vegetation_edge_did_not_improve")
  assert.equal(rows.at(-1).rolloutVegetationLuminanceLoss < rows[0].rolloutVegetationLuminanceLoss, true, "vegetation_rollout_luminance_did_not_improve")
  assert.equal(rows.at(-1).rolloutVegetationReferenceFeatureLoss < rows[0].rolloutVegetationReferenceFeatureLoss, true, "vegetation_rollout_feature_did_not_improve")
  assert.equal(rows.at(-1).worstSampleVegetationReferenceFeatureLoss < rows[0].worstSampleVegetationReferenceFeatureLoss, true, "vegetation_worst_feature_did_not_improve")
  return rows
}

function reviewTimeline(review) {
  assert.equal(review.reviewThresholdsChanged, false, "review_thresholds_changed")
  assert.equal(review.previewCount, 6, "review_count_invalid")
  assert.equal(review.previewPassCount, 0, "unexpected_review_pass")
  assert.equal(review.previewFailCount, 6, "review_fail_count_invalid")
  exactEpochs(review.reviews, "review")
  const rows = review.reviews.map((item) => {
    const audits = item.conditionAlignment?.objectSemanticAudits ?? []
    const vegetation = audits.find((audit) => audit.channelId === "object_vegetation")
    assert.ok(vegetation, `epoch_${item.epoch}_vegetation_audit_missing`)
    const response = vegetation.referenceResponse ?? {}
    const thresholds = vegetation.referenceThresholds ?? {}
    return {
      epoch: Number(item.epoch),
      passed: item.passed,
      issueCodes: [...item.issueCodes],
      vegetation: {
        passed: vegetation.passed,
        localResponsePassed: vegetation.localResponsePassed,
        maskedRgbMae: finite(response.maskedRgbMae, `epoch_${item.epoch}_review_rgb`),
        maskedEdgeMae: finite(response.maskedEdgeMae, `epoch_${item.epoch}_review_edge`),
        maskedLumaCorrelation: finite(response.maskedLumaCorrelation, `epoch_${item.epoch}_review_luma`),
        minimumMaskedLumaCorrelation: finite(thresholds.minimumMaskedLumaCorrelation, `epoch_${item.epoch}_review_luma_threshold`),
      },
    }
  })
  assert.equal(rows.at(-1).passed, false, "epoch40_unexpected_pass")
  assert.deepEqual(rows.at(-1).issueCodes, [VEGETATION_ISSUE], "epoch40_issue_identity_invalid")
  assert.equal(rows.at(-1).vegetation.passed, false, "epoch40_vegetation_unexpected_pass")
  assert.equal(rows.at(-1).vegetation.localResponsePassed, true, "epoch40_vegetation_local_response_missing")
  assert.equal(rows.at(-1).vegetation.maskedLumaCorrelation, 0.0626, "epoch40_vegetation_luma_identity_invalid")
  assert.equal(rows.at(-1).vegetation.minimumMaskedLumaCorrelation, 0.08, "epoch40_vegetation_threshold_identity_invalid")
  assert.equal(rows.at(-1).vegetation.maskedLumaCorrelation < rows.at(-1).vegetation.minimumMaskedLumaCorrelation, true, "epoch40_vegetation_luma_not_below_threshold")
  assert.equal(rows.at(-1).vegetation.maskedLumaCorrelation > rows[0].vegetation.maskedLumaCorrelation, true, "vegetation_review_luma_did_not_improve")
  const epoch40Audits = review.reviews.at(-1).conditionAlignment.objectSemanticAudits
  for (const channel of ["object_footprints", "object_tree", "object_rock"]) {
    assert.equal(epoch40Audits.find((audit) => audit.channelId === channel)?.passed, true, `epoch40_${channel}_not_passed`)
  }
  const pathAudit = review.reviews.at(-1).conditionAlignment.channelAudits.find((audit) => audit.channelId === "terrain_path_ground")
  assert.equal(pathAudit?.passed, true, "epoch40_path_not_passed")
  assert.equal(pathAudit?.boundaryContactAudit?.passed, true, "epoch40_path_boundary_not_passed")
  assert.equal(rows.at(-1).issueCodes.some((code) => code.includes("water")), false, "epoch40_water_not_passed")
  return rows
}

export function adjudicateVegetationTerminalCheckpointIdentityFailure(input) {
  const { activeConfig, terminal, manifest, review, failedCheckpointIdentity } = input
  assert.equal(terminal.runId, SOURCE_RUN_ID, "current_run_identity_required")
  assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed", "terminal_status_invalid")
  assert.equal(terminal.stage, 0, "stage0_required")
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 }, "fixed_progress_identity_invalid")
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 }, "dataset_split_changed")
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true, "model_weights_did_not_change")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.previewSha256Matches, true, "preview_reproduction_mismatch")
  assert.equal(manifest.stage4UnifiedTrainingPreviewSampling?.denoiserStateIdentityMatches, true, "preview_model_identity_mismatch")
  assert.equal(manifest.checkpointPath, failedCheckpointIdentity.path, "failed_checkpoint_path_identity_mismatch")
  assert.equal(manifest.checkpointSha256, failedCheckpointIdentity.sha256, "failed_checkpoint_sha_identity_mismatch")

  const activeContracts = activeTrainingEvidence(activeConfig)
  const metrics = metricTimeline(manifest)
  const reviews = reviewTimeline(review)
  assert.equal(Number(manifest.bestEpoch), 33, "best_epoch_identity_invalid")
  const epoch33 = manifest.metrics.find((row) => Number(row.epoch) === 33)
  assert.equal(epoch33?.bestCheckpointUpdated, true, "epoch33_best_checkpoint_identity_missing")
  const later = manifest.metrics.filter((row) => Number(row.epoch) >= 34 && Number(row.epoch) <= 40)
  assert.equal(later.length, 7, "epoch34_40_metric_timeline_incomplete")
  assert.equal(later.every((row) => row.stage4CheckpointRouteWestBoundaryNonRegressionPassed === false), true, "epoch34_40_west_gate_identity_changed")
  assert.equal(later.every((row) => row.bestCheckpointUpdated === false), true, "epoch34_40_checkpoint_identity_changed")
  assert.equal(Number(later.at(-1).validationCheckpointSelectionScore) < Number(epoch33.validationCheckpointSelectionScore), true, "epoch40_checkpoint_score_not_improved_vs_epoch33")
  assert.equal(Number(later.at(-1).validationFixedGridStage4DiagnosticRouteRequiredBoundaryContactMinimum) < Number(epoch33.validationFixedGridStage4DiagnosticRouteRequiredBoundaryContactMinimum), true, "epoch40_relative_west_regression_not_present")

  return {
    schemaVersion: "stage4-vegetation-terminal-checkpoint-identity-adjudication-v1",
    status: "stage0_vegetation_supervision_active_but_terminal_visible_semantics_insufficient",
    selectedCause: "A",
    activeContracts,
    metricTimeline: metrics,
    reviewTimeline: reviews,
    checkpointIdentityFinding: {
      bestEpoch: 33,
      laterEpochsRejectedByRelativeWestNonRegressionGate: later.map((row) => Number(row.epoch)),
      epoch33CheckpointScore: Number(epoch33.validationCheckpointSelectionScore),
      epoch40CheckpointScore: Number(later.at(-1).validationCheckpointSelectionScore),
      epoch33RelativeWestValue: Number(epoch33.validationFixedGridStage4DiagnosticRouteRequiredBoundaryContactMinimum),
      epoch40RelativeWestValue: Number(later.at(-1).validationFixedGridStage4DiagnosticRouteRequiredBoundaryContactMinimum),
      epoch40AbsoluteMachinePathAuditPassed: true,
      interpretation: "distinct_contract_semantics_not_a_confirmed_wiring_defect",
      explanation: "Checkpoint selection enforces strict non-regression relative to the previously selected validation boundary-contact value, while the Epoch 40 machine review applies an absolute pass contract to the fixed preview. The two facts can coexist and do not explain the remaining vegetation-only failure.",
    },
    alternatives: {
      A: { status: "confirmed", reason: "all legal vegetation objectives were active and improved, but terminal visible vegetation luminance correlation remained below the frozen requirement" },
      B: { status: "not_confirmed", reason: "relative checkpoint non-regression and absolute fixed-preview acceptance are intentionally different scopes and neither caused the vegetation-only Epoch 40 rejection" },
      C: { status: "not_selected", reason: "only A is causally supported; the checkpoint identity distinction is secondary evidence, not a joint root cause" },
      D: { status: "not_selected", reason: "the immutable metric, review, activation, reproduction, and checkpoint-selection evidence is complete" },
    },
    ownerDecisionRequired: true,
    boundedRepairContractGenerated: false,
    reasonNoRepairContractGenerated: "The current evidence proves insufficiency but does not uniquely derive a new legal supervision expression without an Owner project-level data or supervision choice.",
  }
}
