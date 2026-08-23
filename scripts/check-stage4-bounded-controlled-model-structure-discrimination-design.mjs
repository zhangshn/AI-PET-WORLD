import assert from "node:assert/strict"
import fs from "node:fs"
import {
  DESIGN_STATUS,
  designBoundedControlledModelStructureDiscrimination,
} from "./lib/ai-painter-stage4-bounded-controlled-model-structure-discrimination-design.mjs"

const RUN = ".runtime/ai-painter/stage4-substantive-model-structure-reviews/20260822-173038556"
const read = (name) => JSON.parse(fs.readFileSync(`${RUN}/${name}`, "utf8"))

function fixture() {
  return {
    terminal: read("phase-terminal.json"),
    review: read("model-structure-review-report.json"),
    adjudication: read("adjudication.json"),
    ownerRequest: read("owner-evidence-request.json"),
    cpuReport: read("cpu-report.json"),
    formalDerivations: { conditionFusionOnly: null, capacityOnly: null },
  }
}

const formal = (axis) => ({
  status: "formal_owner_authorized_unique_derivation",
  axis,
  sourceContractPath: `.runtime/ai-painter/formal-structure-derivations/${axis}.json`,
  sourceContractSha256: "a".repeat(64),
  uniqueStructuralDelta: [`${axis}_single_delta`],
  derivedDimensions: { exampleDimension: 1 },
  freeParameterCount: 0,
})

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => {
  const value = fixture()
  mutate(value)
  assert.throws(() => designBoundedControlledModelStructureDiscrimination(value), pattern)
  negatives.push(name)
}

positive("fails_closed_when_formal_derivations_are_absent", () => {
  const result = designBoundedControlledModelStructureDiscrimination(fixture())
  assert.equal(result.status, DESIGN_STATUS.DERIVATION_GAP)
  assert.equal(result.materializedThreeArmContract, false)
  assert.equal(result.executable, false)
})
positive("preserves_exact_baseline", () => {
  const result = designBoundedControlledModelStructureDiscrimination(fixture())
  assert.equal(result.arms.baseline.structure.denoiserBaseChannels, 64)
  assert.equal(result.arms.baseline.structure.latentChannels, 12)
  assert.equal(result.arms.baseline.structure.conditionChannelCount, 23)
})
positive("records_two_unresolved_isolated_control_arms", () => {
  const result = designBoundedControlledModelStructureDiscrimination(fixture())
  assert.equal(result.arms.conditionFusionOnly.status, "inactive_not_executable_missing_formal_unique_derivation")
  assert.equal(result.arms.capacityOnly.status, "inactive_not_executable_missing_formal_unique_derivation")
})
positive("defines_evidence_isolation_and_future_order", () => {
  const result = designBoundedControlledModelStructureDiscrimination(fixture())
  assert.equal(result.evidenceIsolationContract.checkpointCrossArmUseForbidden, true)
  assert.equal(result.futureQualificationOrder[0], "owner_supplies_formal_unique_derivation_evidence")
})
positive("materializes_only_when_both_formal_derivations_exist", () => {
  const value = fixture()
  value.formalDerivations.conditionFusionOnly = formal("condition_fusion_only")
  value.formalDerivations.capacityOnly = formal("capacity_only")
  const result = designBoundedControlledModelStructureDiscrimination(value)
  assert.equal(result.status, DESIGN_STATUS.READY)
  assert.equal(result.materializedThreeArmContract, true)
  assert.equal(result.executable, false)
})

negative("rejects_changed_terminal_hash_role_content", (v) => { v.terminal.selectedDecision = "A" }, /bound_terminal_decision_changed/)
negative("rejects_progress_change", (v) => { v.terminal.fixedTotalProgress.percent = 80 }, /fixed_progress_changed/)
negative("rejects_review_decision_change", (v) => { v.review.selectedDecision = "current_condition_fusion_structure_gap_confirmed" }, /bound_review_decision_changed/)
negative("rejects_invented_historical_architecture_contract", (v) => { v.adjudication.inactiveArchitectureContractGenerated = true }, /historical_architecture_contract_invented/)
negative("rejects_owner_scope_change", (v) => { v.ownerRequest.requestedNextScope = "train" }, /owner_scope_changed/)
negative("rejects_owner_required_controls_change", (v) => { v.ownerRequest.requiredControls.pop() }, /owner_required_controls_changed/)
negative("rejects_failed_bound_cpu_report", (v) => { v.cpuReport.status = "failed" }, /bound_cpu_report_not_passed/)
negative("rejects_condition_count_change", (v) => { v.review.currentArchitecture.conditionChannelCount = 24 }, /baseline_condition_count_changed/)
negative("rejects_condition_order_change", (v) => { v.review.currentArchitecture.conditionChannelOrder.reverse() }, /baseline_condition_order_changed/)
negative("rejects_base_capacity_change", (v) => { v.review.currentArchitecture.denoiserBaseChannels = 128 }, /baseline_base_channels_changed/)
negative("rejects_latent_output_change", (v) => { v.review.currentArchitecture.latentChannels = 16 }, /baseline_latent_channels_changed/)
negative("rejects_fusion_topology_change", (v) => { v.review.currentArchitecture.injectionTopology.decoderScales = ["up0"] }, /baseline_decoder_fusion_changed/)
negative("rejects_partial_derivation_fields", (v) => { v.formalDerivations.conditionFusionOnly = { status: "formal_owner_authorized_unique_derivation" } }, /condition_fusion_only_derivation_fields_not_exact/)
negative("rejects_free_fusion_parameter", (v) => { v.formalDerivations.conditionFusionOnly = formal("condition_fusion_only"); v.formalDerivations.conditionFusionOnly.freeParameterCount = 1 }, /condition_fusion_only_free_parameter_forbidden/)
negative("rejects_free_capacity_parameter", (v) => { v.formalDerivations.capacityOnly = formal("capacity_only"); v.formalDerivations.capacityOnly.freeParameterCount = 1 }, /capacity_only_free_parameter_forbidden/)
negative("rejects_swapped_fusion_axis", (v) => { v.formalDerivations.conditionFusionOnly = formal("capacity_only") }, /condition_fusion_only_derivation_axis_invalid/)
negative("rejects_swapped_capacity_axis", (v) => { v.formalDerivations.capacityOnly = formal("condition_fusion_only") }, /capacity_only_derivation_axis_invalid/)
negative("rejects_multiple_fusion_deltas", (v) => { v.formalDerivations.conditionFusionOnly = formal("condition_fusion_only"); v.formalDerivations.conditionFusionOnly.uniqueStructuralDelta.push("second") }, /condition_fusion_only_exactly_one_structural_delta_required/)
negative("rejects_multiple_capacity_deltas", (v) => { v.formalDerivations.capacityOnly = formal("capacity_only"); v.formalDerivations.capacityOnly.uniqueStructuralDelta.push("second") }, /capacity_only_exactly_one_structural_delta_required/)
negative("rejects_invalid_derivation_hash", (v) => { v.formalDerivations.capacityOnly = formal("capacity_only"); v.formalDerivations.capacityOnly.sourceContractSha256 = "free" }, /capacity_only_derivation_sha256_invalid/)
negative("rejects_extra_input_field", (v) => { v.freeHyperparameter = 128 }, /design_input_fields_not_exact/)

console.log(JSON.stringify({
  schemaVersion: "stage4-bounded-controlled-model-structure-discrimination-design-cpu-report-v1",
  status: "passed",
  selectedOutcome: DESIGN_STATUS.DERIVATION_GAP,
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  modelImplemented: false,
}, null, 2))

