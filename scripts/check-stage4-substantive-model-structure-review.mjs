import assert from "node:assert/strict"
import fs from "node:fs"
import {
  DECISIONS,
  adjudicateSubstantiveModelStructure,
} from "./lib/ai-painter-stage4-substantive-model-structure-review.mjs"

const modelSource = fs.readFileSync("ml/ai-painter/src/ai_painter/complete_world/model.py", "utf8")
const config = JSON.parse(fs.readFileSync(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/active-config.json", "utf8"))

function fixture() {
  return {
    modelSource,
    config: structuredClone(config),
    currentAdjudication: {
      status: "conflict_aware_training_paradigm_active_but_semantically_insufficient",
      selectedCause: "A",
      evidence: { conflictAggregationActiveAcrossAllEpochs: true, terminalResidualClasses: ["footprints", "tree", "rock"] },
    },
    autoencoderDecision: {
      selectedDecision: "frozen_autoencoder_semantic_retention_sufficient",
      passedClassAuditCount: 256,
      affectedSampleCount: 0,
    },
    multisampleGpuReport: {
      capacityEvidence: {
        uniqueConditionTensorCount: 56,
        uniqueConditionRepresentationCount: 56,
        uniqueFinalRgbCount: 56,
        exactConditionRepresentationCollisionCount: 0,
        exactFinalRgbCollisionCount: 0,
      },
    },
    multisampleAnalysis: { conditionReachability: { sampleClassAuditCount: 224, allFiniteNonZeroAndOwnChannelReached: true } },
    multisampleDecision: { capacityGapConfirmed: false, gradientInterferenceConfirmed: true },
    controlledEvidence: {
      conditionFusionOnlyComparison: false,
      denoiserCapacityOnlyComparison: false,
      independentOutputBottleneckComparison: false,
      sharedInitializationAndTrainingSchedule: false,
    },
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => {
  const input = fixture()
  mutate(input)
  assert.throws(() => adjudicateSubstantiveModelStructure(input), pattern)
  negatives.push(name)
}

positive("selects_D_without_controlled_structure_comparison", () => assert.equal(adjudicateSubstantiveModelStructure(fixture()).selectedDecisionId, DECISIONS.D))
positive("finds_five_condition_fusion_scales", () => assert.deepEqual(adjudicateSubstantiveModelStructure(fixture()).provenFacts.conditionFusionScales, ["level0", "level1", "middle", "up1", "up0"]))
positive("records_shared_output_without_claiming_bottleneck", () => {
  const result = adjudicateSubstantiveModelStructure(fixture())
  assert.equal(result.provenFacts.sharedTwelveChannelOutputPresent, true)
  assert.equal(result.alternatives.B.status, "not_confirmed")
})
positive("does_not_generate_architecture_contract_for_D", () => assert.equal(adjudicateSubstantiveModelStructure(fixture()).inactiveArchitectureContractGenerated, false))
positive("requests_bounded_controlled_discrimination", () => assert.equal(adjudicateSubstantiveModelStructure(fixture()).ownerEvidenceRequest.action, "authorize_bounded_controlled_model_structure_discrimination_design"))

negative("rejects_condition_channel_count_change", (v) => { v.config.conditionChannels = 22 }, /condition_channel_count_changed/)
negative("rejects_condition_order_change", (v) => { v.config.conditionChannelOrder.reverse() }, /condition_channel_order_changed/)
negative("rejects_base_capacity_change", (v) => { v.config.denoiserBaseChannels = 128 }, /denoiser_base_channels_changed/)
negative("rejects_latent_channel_change", (v) => { v.config.latentChannels = 16 }, /latent_channels_changed/)
negative("rejects_missing_level0_fusion", (v) => { v.modelSource = v.modelSource.replace("self.fuse0(torch.cat((self.latent_stem(noisy_latent), condition0), dim=1)", "removed") }, /level0_fusion/)
negative("rejects_missing_level1_fusion", (v) => { v.modelSource = v.modelSource.replace("self.fuse1(torch.cat((self.latent_down1(level0), condition1), dim=1)", "removed") }, /level1_fusion/)
negative("rejects_missing_middle_fusion", (v) => { v.modelSource = v.modelSource.replace("middle = self.fuse2(torch.cat((self.latent_down2(level1), condition2), dim=1))", "removed") }, /middle_fusion/)
negative("rejects_missing_up1_reinjection", (v) => { v.modelSource = v.modelSource.replace("decoded_up1 = decoded_up1 + self.typed_condition_adapter_up1(typed_up1)", "removed") }, /decoder_up1_reinjection/)
negative("rejects_missing_up0_reinjection", (v) => { v.modelSource = v.modelSource.replace("decoded_up0 = decoded_up0 + self.typed_condition_adapter_up0(typed_up0)", "removed") }, /decoder_up0_reinjection/)
negative("rejects_missing_typed_sum", (v) => { v.modelSource = v.modelSource.replace("predicted_velocity = base_velocity + torch.stack(", "removed") }, /typed_sum/)
negative("rejects_changed_current_adjudication", (v) => { v.currentAdjudication.selectedCause = "C" }, /current_stage0_adjudication_changed/)
negative("rejects_autoencoder_gap_rewrite", (v) => { v.autoencoderDecision.selectedDecision = "frozen_autoencoder_semantic_retention_gap_confirmed" }, /autoencoder_retention_decision_changed/)
negative("rejects_capacity_collision_invention", (v) => { v.multisampleGpuReport.capacityEvidence.exactConditionRepresentationCollisionCount = 1 }, /condition_representation_collision_invented/)
negative("rejects_missing_analysis_condition_reachability", (v) => { delete v.multisampleAnalysis.conditionReachability }, /condition_reachability_missing_from_analysis/)
negative("rejects_condition_reachability_in_gpu_role", (v) => { v.multisampleGpuReport.conditionReachability = v.multisampleAnalysis.conditionReachability }, /condition_reachability_wrongly_bound_to_gpu_report/)
negative("rejects_cross_report_condition_reachability_injection", (v) => { v.multisampleGpuReport.conditionReachability = v.multisampleAnalysis.conditionReachability; delete v.multisampleAnalysis.conditionReachability }, /condition_reachability_wrongly_bound_to_gpu_report/)
negative("rejects_missing_gpu_capacity_role", (v) => { delete v.multisampleGpuReport.capacityEvidence }, /Cannot read properties/)
negative("rejects_invented_fusion_control", (v) => { v.controlledEvidence.conditionFusionOnlyComparison = true }, /controlled_structure_evidence_identity_invalid/)
negative("rejects_invented_capacity_control", (v) => { v.controlledEvidence.denoiserCapacityOnlyComparison = true }, /controlled_structure_evidence_identity_invalid/)
negative("rejects_invented_output_control", (v) => { v.controlledEvidence.independentOutputBottleneckComparison = true }, /controlled_structure_evidence_identity_invalid/)
negative("rejects_invented_shared_schedule", (v) => { v.controlledEvidence.sharedInitializationAndTrainingSchedule = true }, /controlled_structure_evidence_identity_invalid/)

console.log(JSON.stringify({
  schemaVersion: "stage4-substantive-model-structure-review-cpu-report-v1",
  status: "passed",
  selectedDecision: "D",
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))
