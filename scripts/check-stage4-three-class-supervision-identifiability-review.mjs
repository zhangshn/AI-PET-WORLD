import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { EXPECTED_SPLITS, NEXT_CONTRACT_ID, TARGET_CLASSES, reviewThreeClassSupervisionIdentifiability } from "./lib/ai-painter-stage4-three-class-supervision-identifiability-review.mjs"

const RUNNER = "scripts/run-stage4-three-class-supervision-identifiability-review.mjs"
const validSource = `
        if epoch_complete_selection is not None:
            selected_sample_id = epoch_complete_selection["sampleId"]
            selected_loss = (
                stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(
                    selected_rollout,
                    epoch_complete_selection["classIdentity"],
                    config,
                )
            )
            selected_loss.backward()
            record_stage4_step(
                step_telemetry_path,
                "epoch_complete_per_class_selected_luminance_replay",
            )
            continue
        replay_image = epoch_worst["image"].to(device)
`
const inspectSource = (source) => spawnSync(process.execPath, [RUNNER, "--cpu-source-locator-text-base64", Buffer.from(source).toString("base64")], { cwd: process.cwd(), encoding: "utf8" })
const expectSourceFailure = (name, source, pattern, negatives) => {
  const result = inspectSource(source)
  assert.notEqual(result.status, 0, `${name}_unexpected_pass`)
  assert.match(result.stderr, pattern)
  negatives.push(name)
}

const fixture = () => ({
  audit: {
    approvedRecordCount: 64,
    splitCounts: { ...EXPECTED_SPLITS },
    conditionChannelCount: 23,
    allConditionOrdersExact: true,
    allReferenceRgbHashBound: true,
    allConditionPacksHashBound: true,
    maskClasses: [...TARGET_CLASSES],
    allTargetMasksHashBound: true,
    allTargetMasksNonEmpty: true,
    allTrainingEligibilityBound: true,
    failedPreviewPixelsUsedAsTargets: false,
    machineReviewThresholdsOrResultsUsedAsTargets: false,
  },
  coverage: {
    batchSize: 1,
    finalVisibleRgbCovered: true,
    multiscaleLuminanceStructureCovered: true,
    referenceFeatureStructureCovered: true,
    frozenAutoencoderFeatureSourceCovered: true,
    completeEpochPerClassLuminanceSelectionCovered: true,
    completeEpochPerClassLuminanceReplayActive: true,
    referenceFeaturePerClassWorstPopulation: "observed_current_train_split_samples",
    referenceFeaturePerClassWorstCalledWithCurrentBatchIds: true,
    completeEpochPerClassReferenceFeatureSelectionCovered: false,
    completeEpochLuminanceBypassesLegacyReferenceFeatureReplay: true,
    validationReferenceFeatureSelectedIdentityPersisted: false,
    existingReplayPasses: 2,
    existingDerivedWeightsAvailable: true,
    newModelRequired: false,
    freeWeightRequired: false,
  },
})
const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => { const value = structuredClone(fixture()); mutate(value); assert.throws(() => reviewThreeClassSupervisionIdentifiability(value), pattern); negatives.push(name) }

positive("finds_unique_complete_epoch_reference_feature_gap", () => assert.equal(reviewThreeClassSupervisionIdentifiability(fixture()).contractId, NEXT_CONTRACT_ID))
positive("reuses_existing_two_replay_passes", () => assert.equal(reviewThreeClassSupervisionIdentifiability(fixture()).contract.sharedReplay.addsOptimizerSteps, false))
positive("derives_without_free_weight", () => assert.equal(reviewThreeClassSupervisionIdentifiability(fixture()).contract.invariants.freeHyperparameterSelected, false))
positive("remains_cpu_inactive", () => assert.equal(reviewThreeClassSupervisionIdentifiability(fixture()).contract.activationGate.training, false))
positive("structurally_locates_branch_call_continue_and_next_sibling", () => {
  const result = inspectSource(validSource)
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.status, "reference_feature_replay_bypass_structurally_proven")
  assert.equal(report.branchLine < report.selectedLuminanceCallLine, true)
  assert.equal(report.selectedLuminanceCallLine < report.terminatingContinueLine, true)
  assert.equal(report.terminatingContinueLine < report.nextSiblingLine, true)
})

negative("rejects_record_count_change", (v) => { v.audit.approvedRecordCount = 63 }, /record_count/)
negative("rejects_split_change", (v) => { v.audit.splitCounts.train = 47 }, /split_counts/)
negative("rejects_channel_count_change", (v) => { v.audit.conditionChannelCount = 22 }, /channel_count/)
negative("rejects_channel_order_change", (v) => { v.audit.allConditionOrdersExact = false }, /channel_order/)
negative("rejects_missing_reference_rgb", (v) => { v.audit.allReferenceRgbHashBound = false }, /reference_rgb/)
negative("rejects_missing_condition_pack", (v) => { v.audit.allConditionPacksHashBound = false }, /condition_pack/)
negative("rejects_target_class_order_change", (v) => { v.audit.maskClasses.reverse() }, /target_class_order/)
negative("rejects_missing_mask", (v) => { v.audit.allTargetMasksHashBound = false }, /mask_binding/)
negative("rejects_empty_mask", (v) => { v.audit.allTargetMasksNonEmpty = false }, /mask_empty/)
negative("rejects_failed_preview_target", (v) => { v.audit.failedPreviewPixelsUsedAsTargets = true }, /failed_preview/)
negative("rejects_review_target", (v) => { v.audit.machineReviewThresholdsOrResultsUsedAsTargets = true }, /machine_review/)
negative("rejects_missing_rgb_coverage", (v) => { v.coverage.finalVisibleRgbCovered = false }, /final_visible_rgb/)
negative("rejects_missing_luminance_coverage", (v) => { v.coverage.multiscaleLuminanceStructureCovered = false }, /luminance_structure/)
negative("rejects_missing_feature_coverage", (v) => { v.coverage.referenceFeatureStructureCovered = false }, /reference_feature_structure/)
negative("rejects_missing_frozen_feature_source", (v) => { v.coverage.frozenAutoencoderFeatureSourceCovered = false }, /frozen_autoencoder/)
negative("rejects_missing_complete_epoch_luminance", (v) => { v.coverage.completeEpochPerClassLuminanceSelectionCovered = false }, /complete_epoch_luminance/)
negative("rejects_non_batch_reference_population", (v) => { v.coverage.referenceFeaturePerClassWorstPopulation = "all_48" }, /reference_feature_population/)
negative("rejects_unproven_batch_identity", (v) => { v.coverage.referenceFeaturePerClassWorstCalledWithCurrentBatchIds = false }, /batch_identity/)
negative("rejects_already_covered_gap", (v) => { v.coverage.completeEpochPerClassReferenceFeatureSelectionCovered = true }, /already_covered/)
negative("rejects_unproven_bypass", (v) => { v.coverage.completeEpochLuminanceBypassesLegacyReferenceFeatureReplay = false }, /bypass/)
negative("rejects_persisted_identity_claim", (v) => { v.coverage.validationReferenceFeatureSelectedIdentityPersisted = true }, /identity_gap/)
negative("rejects_replay_budget_change", (v) => { v.coverage.existingReplayPasses = 3 }, /replay_budget/)
negative("rejects_new_model", (v) => { v.coverage.newModelRequired = true }, /new_model/)
negative("rejects_free_weight", (v) => { v.coverage.freeWeightRequired = true }, /free_weight/)
expectSourceFailure("rejects_missing_continue", validSource.replace("            continue\n", ""), /continue_identity_invalid/, negatives)
expectSourceFailure("rejects_call_after_continue", validSource.replace("            continue\n", "            continue\n            stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(\n                selected_rollout, identity, config,\n            )\n").replace("                stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(\n", "                other_loss(\n"), /selected_luminance_call_identity_invalid|branch_order_invalid/, negatives)
expectSourceFailure("rejects_cross_branch_call", validSource.replace("                stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(\n", "                other_loss(\n") + "\nstage4_epoch_complete_selected_luminance_replay_loss_from_tensor(\n", /selected_luminance_call_identity_invalid/, negatives)
expectSourceFailure("rejects_commented_fake_call", validSource.replace("                stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(\n", "                # stage4_epoch_complete_selected_luminance_replay_loss_from_tensor(\n"), /selected_luminance_call_identity_invalid/, negatives)
expectSourceFailure("rejects_historical_branch_without_current_call", validSource.replace("stage4_epoch_complete_selected_luminance_replay_loss_from_tensor", "stage4_epoch_worst_sample_class_replay_supervision"), /selected_luminance_call_identity_invalid/, negatives)
expectSourceFailure("rejects_unknown_duplicate_branch", `${validSource}\n${validSource}`, /branch_identity_invalid/, negatives)
expectSourceFailure("rejects_wrong_next_sibling", validSource.replace('replay_image = epoch_worst["image"].to(device)', "unknown_sibling = True"), /next_sibling_identity_invalid/, negatives)

console.log(JSON.stringify({ schemaVersion: "stage4-three-class-supervision-identifiability-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives }, null, 2))
