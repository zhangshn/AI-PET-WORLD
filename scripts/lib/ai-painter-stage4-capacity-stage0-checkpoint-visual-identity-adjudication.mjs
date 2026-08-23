import assert from "node:assert/strict"

export const SOURCE_RUN_ID = "20260823-110753367-capacity-stage0"
export const CAPACITY_ARM = "capacity_only_base_width_64_to_existing_level1_128"
export const REVIEW_EPOCHS = Object.freeze([1, 5, 10, 20, 30, 40])
export const BEST_EPOCH = 37
const OBJECT_CHANNELS = new Set(["object_footprints", "object_tree", "object_rock", "object_vegetation"])

const objectRows = (review) => Object.fromEntries(
  review.conditionAlignment.objectSemanticAudits
    .filter((entry) => OBJECT_CHANNELS.has(entry.channelId))
    .map((entry) => [entry.channelId, {
      passed: entry.passed === true,
      localResponsePassed: entry.localResponsePassed === true,
      maskedRgbMae: entry.referenceResponse.maskedRgbMae,
      maskedEdgeMae: entry.referenceResponse.maskedEdgeMae,
      maskedLumaCorrelation: entry.referenceResponse.maskedLumaCorrelation,
    }]),
)

function validateActiveCapacityConfig(config) {
  const contract = config.training?.stage4ControlledStructureThreeArm
  assert.equal(config.stage4ControlledStructureArm, CAPACITY_ARM, "active_arm_identity_invalid")
  assert.equal(contract?.armId, CAPACITY_ARM, "active_contract_arm_invalid")
  assert.equal(contract?.status, "structure_active_owner_authorized", "active_contract_status_invalid")
  assert.equal(contract?.denoiserBaseChannels, 128, "capacity_width_invalid")
  const gate = contract?.activationGate ?? {}
  for (const key of ["configurationActiveNow", "checkpointReadNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "gpuUseNow", "trainingNow", "stage4FullTrainingNow"]) {
    assert.equal(gate[key], true, `active_gate_${key}_invalid`)
  }
  for (const key of ["smokeNow", "stage1Now", "stage2Now", "formalInferenceNow", "checkpointPromotionNow", "runtimeFrameNow", "worldEntryNow"]) {
    assert.equal(gate[key], false, `inactive_gate_${key}_invalid`)
  }
}

export function validateCapacityStage0IdentityEvidence(input) {
  const { terminal, manifest, review, activeConfig, checkpointPreview, failedCheckpointSha256 } = input
  assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
  assert.equal(terminal.runId, SOURCE_RUN_ID, "source_run_identity_invalid")
  assert.equal(terminal.stage, 0, "source_stage_invalid")
  assert.deepEqual(terminal.fixedTotalProgress, { completedStages: 3, totalStages: 5, percent: 60 })
  assert.deepEqual(terminal.blockers, ["stage_0_visual_review_failed_0_of_6"])
  assert.equal(terminal.machineReview.passCount, 0)
  assert.equal(terminal.machineReview.failCount, 6)
  assert.equal(terminal.checkpoint.sha256, failedCheckpointSha256, "failed_checkpoint_identity_invalid")
  assert.equal(manifest.status, "conditional_denoiser_training_completed_pending_validation")
  assert.equal(manifest.metrics?.length, 40, "forty_epochs_required")
  assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.modelStateHashEvidence?.weightsChanged, true, "model_weights_not_changed")
  assert.equal(manifest.bestEpoch, BEST_EPOCH, "best_epoch_identity_invalid")
  assert.equal(review.previewCount, 6, "preview_count_invalid")
  assert.equal(review.previewPassCount, 0, "preview_pass_count_invalid")
  assert.equal(review.previewFailCount, 6, "preview_fail_count_invalid")
  assert.deepEqual(review.reviews.map((entry) => entry.epoch), REVIEW_EPOCHS, "fixed_review_epoch_identity_invalid")
  assert.equal(review.reviews.some((entry) => entry.epoch === BEST_EPOCH), false, "best_epoch_must_not_be_in_fixed_review_timeline")
  validateActiveCapacityConfig(activeConfig)

  const preview = manifest.stage4UnifiedTrainingPreviewSampling
  assert.equal(preview.status, "checkpoint_bound_preview_reproduced_exactly")
  assert.equal(preview.bestEpoch, BEST_EPOCH)
  assert.equal(preview.sourcePreview.epoch, BEST_EPOCH)
  assert.equal(preview.reproducedPreview.epoch, BEST_EPOCH)
  assert.equal(preview.sourcePreview.previewSha256, checkpointPreview.sha256, "best_preview_source_sha_invalid")
  assert.equal(preview.reproducedPreview.previewSha256, checkpointPreview.sha256, "best_preview_reproduction_sha_invalid")
  assert.equal(preview.previewSha256Matches, true, "best_preview_not_reproduced")
  assert.equal(preview.denoiserStateIdentityMatches, true, "best_preview_model_identity_invalid")
  assert.equal(preview.machineReviewThresholdsChanged, false, "review_threshold_change_detected")

  const epoch30 = review.reviews.find((entry) => entry.epoch === 30)
  const epoch40 = review.reviews.find((entry) => entry.epoch === 40)
  const epoch30Objects = objectRows(epoch30)
  const epoch40Objects = objectRows(epoch40)
  assert.equal(epoch30Objects.object_footprints.passed, true, "epoch30_footprints_fact_invalid")
  assert.equal(epoch30Objects.object_tree.passed, true, "epoch30_tree_fact_invalid")
  assert.equal(epoch30Objects.object_rock.passed, true, "epoch30_rock_fact_invalid")
  assert.equal(epoch30Objects.object_vegetation.passed, false, "epoch30_vegetation_fact_invalid")
  assert.equal(epoch40Objects.object_rock.passed, true, "epoch40_rock_fact_invalid")
  for (const key of ["object_footprints", "object_tree", "object_vegetation"]) assert.equal(epoch40Objects[key].passed, false, `epoch40_${key}_fact_invalid`)
  assert.equal(epoch30.issueCodes.includes("condition_terrain_path_ground_required_boundary_contact_missing"), true, "epoch30_west_boundary_fact_missing")
  assert.equal(epoch40.issueCodes.includes("condition_terrain_path_ground_required_boundary_contact_missing"), true, "epoch40_west_boundary_fact_missing")

  const bestMetric = manifest.metrics.find((entry) => entry.epoch === BEST_EPOCH)
  const terminalMetric = manifest.metrics.find((entry) => entry.epoch === 40)
  assert.equal(bestMetric.bestCheckpointUpdated, true, "best_epoch_not_checkpoint_selected")
  assert.equal(bestMetric.stage4CheckpointRouteWestBoundaryNonRegressionPassed, true, "best_epoch_checkpoint_gate_not_passed")
  assert.equal(terminalMetric.bestCheckpointUpdated, false, "terminal_checkpoint_identity_invalid")
  assert.equal(terminalMetric.stage4CheckpointRouteWestBoundaryNonRegressionPassed, false, "terminal_checkpoint_gate_identity_invalid")
  return { epoch30Objects, epoch40Objects, bestMetric, terminalMetric }
}

export function adjudicateCapacityStage0CheckpointVisualIdentity(input) {
  const facts = validateCapacityStage0IdentityEvidence(input)
  assert.equal(input.directExecutionWiringDefectEvidence, false, "unproven_execution_wiring_defect_injected")
  assert.equal(input.bestEpochMachineReviewExists, false, "best_epoch_review_identity_injected")
  assert.equal(input.capacityInsufficiencyProvenWithoutBestEpochReview, false, "unproven_capacity_exit_injected")
  return {
    schemaVersion: "stage4-capacity-stage0-checkpoint-visual-identity-adjudication-v1",
    status: "best_checkpoint_and_fixed_visual_review_identity_gap_confirmed",
    selectedCause: "B",
    problem: "Stage 0 selected Epoch 37 as its reproducible best Checkpoint identity, but the immutable machine-review timeline covers only Epoch 1/5/10/20/30/40, so the selected model has no formal visual verdict.",
    evidence: {
      epochsCompleted: 40,
      optimizerStepsCompleted: 5760,
      modelWeightsChanged: true,
      fixedReviewPassCount: 0,
      fixedReviewFailCount: 6,
      bestEpoch: BEST_EPOCH,
      bestEpochPreviewReproducedExactly: true,
      bestEpochIncludedInFormalReviewTimeline: false,
      epoch30ThreeObjectsPassed: true,
      epoch40ObjectRegressionPresent: true,
      directExecutionWiringDefectEvidence: false,
      capacityInsufficiencyProvenWithoutBestEpochReview: false,
    },
    alternatives: {
      A: { status: "not_selected", reason: "The capacity arm is active at width 128, completed all epochs and updates, and produced a reproducible selected-model preview." },
      C: { status: "not_selected", reason: "Capacity cannot be finally rejected before the already-selected, immutable Epoch 37 preview receives the same formal visual review." },
      D: { status: "not_selected", reason: "The missing review identity is concrete and bounded; the next evidence action is uniquely determined." },
    },
    resolution: {
      action: "request_one_machine_review_of_existing_immutable_epoch37_preview",
      previewRegenerationAllowed: false,
      checkpointWeightsReadAllowed: false,
      checkpointReuseAllowed: false,
      trainingAllowed: false,
      thresholdChangeAllowed: false,
      stage1AllowedBeforeReview: false,
    },
    facts,
  }
}
