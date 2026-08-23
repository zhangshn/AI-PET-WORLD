import assert from "node:assert/strict"
import fs from "node:fs"
import { buildControlledStructureUniqueDerivationContract, CONTRACT_STATUS } from "./lib/ai-painter-stage4-controlled-structure-unique-derivation-rules.mjs"

const RUN = ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223"
const read = (name) => JSON.parse(fs.readFileSync(`${RUN}/${name}`, "utf8"))

function rules() {
  return {
    conditionFusionOnly: {
      changedAxis: "condition_fusion_only",
      branchCount: 1,
      resizeFunction: "resize_typed_conditions",
      inputChannels: 23,
      hiddenChannels: 64,
      outputChannels: 12,
      operators: [
        { type: "conv2d", inChannels: 23, outChannels: 64, kernelSize: 3, padding: 1, bias: true },
        { type: "silu" },
        { type: "conv2d", inChannels: 64, outChannels: 12, kernelSize: 3, padding: 1, bias: true },
      ],
      mergePoint: "predicted_velocity_final_additive_composition",
      existingInjectionPathsUnchanged: true,
      baseChannelsUnchanged: true,
      latentOutputChannelsUnchanged: true,
      freeParameterCount: 0,
    },
    capacityOnly: {
      changedAxis: "denoiser_internal_capacity_only",
      baseChannelsBefore: 64,
      baseChannelsAfter: 128,
      derivation: "existing_level1_width_equals_current_base_channels_times_2",
      derivedHierarchy: [128, 256, 512],
      timeEmbeddingChannels: 512,
      conditionFusionTopologyUnchanged: true,
      latentOutputChannels: 12,
      layerCountUnchanged: true,
      freeParameterCount: 0,
    },
    forbiddenChanges: [
      "loss", "data", "split", "condition_order", "autoencoder", "initialization_seed",
      "resolution_stages", "training_schedule", "checkpoint_format", "machine_review_thresholds",
      "historical_checkpoint_injection", "simultaneous_control_axis_change", "extra_layer",
      "free_channel_dimension",
    ],
  }
}

function fixture() {
  const experiment = read("controlled-experiment-contract.json")
  return {
    terminal: read("phase-terminal.json"),
    designReport: read("design-report.json"),
    experiment,
    isolation: read("evidence-isolation-contract.json"),
    qualification: read("future-qualification-order.json"),
    ownerRequest: read("owner-action-request.json"),
    cpuReport: read("cpu-report.json"),
    baseline: structuredClone(experiment.baseline.structure),
    ownerRules: rules(),
  }
}

const positives = []
const negatives = []
const positive = (name, fn) => { fn(); positives.push(name) }
const negative = (name, mutate, pattern) => {
  const value = fixture()
  mutate(value)
  assert.throws(() => buildControlledStructureUniqueDerivationContract(value), pattern)
  negatives.push(name)
}

positive("materializes_inactive_three_arm_contract", () => {
  const result = buildControlledStructureUniqueDerivationContract(fixture())
  assert.equal(result.status, CONTRACT_STATUS)
  assert.equal(result.materializable, true)
  assert.equal(result.executableNow, false)
})
positive("baseline_has_zero_difference", () => assert.equal(buildControlledStructureUniqueDerivationContract(fixture()).baseline.parameterDifference.added, 0))
positive("fusion_only_uses_exact_23_64_12_branch", () => {
  const arm = buildControlledStructureUniqueDerivationContract(fixture()).conditionFusionOnly
  assert.deepEqual(arm.changedAxes, ["condition_fusion"])
  assert.equal(arm.parameterDifference.exactAddedParameterCount, 20236)
  assert.equal(arm.structureDelta.operators.length, 3)
})
positive("capacity_only_uses_existing_level1_width", () => {
  const arm = buildControlledStructureUniqueDerivationContract(fixture()).capacityOnly
  assert.deepEqual(arm.changedAxes, ["denoiser_internal_capacity"])
  assert.deepEqual(arm.structureDelta.derivedWidthHierarchy, [128, 256, 512])
  assert.equal(arm.structureDelta.latentOutputChannels, 12)
})
positive("all_execution_gates_remain_inactive", () => {
  const result = buildControlledStructureUniqueDerivationContract(fixture())
  assert.equal(result.activationAuthorized, false)
  assert.equal(result.implementationAuthorized, false)
  assert.equal(result.trainingAuthorized, false)
})

negative("rejects_bound_terminal_change", (v) => { v.terminal.status = "passed" }, /bound_terminal_status_changed/)
negative("rejects_progress_change", (v) => { v.terminal.fixedTotalProgress.percent = 80 }, /fixed_progress_changed/)
negative("rejects_historical_experiment_activation", (v) => { v.experiment.executable = true }, /historical_experiment_execution_invented/)
negative("rejects_baseline_condition_change", (v) => { v.baseline.conditionChannelCount = 24 }, /baseline_condition_count_changed/)
negative("rejects_baseline_order_change", (v) => { v.baseline.conditionChannelOrder.reverse() }, /baseline_condition_order_changed/)
negative("rejects_baseline_width_change", (v) => { v.baseline.denoiserBaseChannels = 128 }, /baseline_base_channels_changed/)
negative("rejects_baseline_output_change", (v) => { v.baseline.latentChannels = 16 }, /baseline_latent_channels_changed/)
negative("rejects_extra_fusion_branch", (v) => { v.ownerRules.conditionFusionOnly.branchCount = 2 }, /fusion_branch_count_changed/)
negative("rejects_free_fusion_hidden_width", (v) => { v.ownerRules.conditionFusionOnly.hiddenChannels = 128 }, /fusion_hidden_channels_changed/)
negative("rejects_fusion_output_change", (v) => { v.ownerRules.conditionFusionOnly.outputChannels = 23 }, /fusion_output_channels_changed/)
negative("rejects_extra_fusion_layer", (v) => { v.ownerRules.conditionFusionOnly.operators.splice(2, 0, { type: "silu" }) }, /fusion_operators_changed/)
negative("rejects_fusion_kernel_change", (v) => { v.ownerRules.conditionFusionOnly.operators[0].kernelSize = 1 }, /fusion_operators_changed/)
negative("rejects_fusion_capacity_change", (v) => { v.ownerRules.conditionFusionOnly.baseChannelsUnchanged = false }, /fusion_arm_capacity_change_forbidden/)
negative("rejects_capacity_target_change", (v) => { v.ownerRules.capacityOnly.baseChannelsAfter = 256 }, /capacity_target_changed/)
negative("rejects_capacity_derivation_change", (v) => { v.ownerRules.capacityOnly.derivation = "free_choice" }, /capacity_derivation_changed/)
negative("rejects_capacity_hierarchy_change", (v) => { v.ownerRules.capacityOnly.derivedHierarchy = [128, 128, 128] }, /capacity_hierarchy_changed/)
negative("rejects_capacity_fusion_change", (v) => { v.ownerRules.capacityOnly.conditionFusionTopologyUnchanged = false }, /capacity_arm_fusion_change_forbidden/)
negative("rejects_capacity_output_change", (v) => { v.ownerRules.capacityOnly.latentOutputChannels = 24 }, /capacity_arm_output_change_forbidden/)
negative("rejects_capacity_extra_layer", (v) => { v.ownerRules.capacityOnly.layerCountUnchanged = false }, /capacity_arm_layer_change_forbidden/)
negative("rejects_loss_change_permission", (v) => { v.ownerRules.forbiddenChanges = v.ownerRules.forbiddenChanges.filter((x) => x !== "loss") }, /forbidden_changes_not_exact/)
negative("rejects_historical_checkpoint_permission", (v) => { v.ownerRules.forbiddenChanges = v.ownerRules.forbiddenChanges.filter((x) => x !== "historical_checkpoint_injection") }, /forbidden_changes_not_exact/)
negative("rejects_extra_contract_input", (v) => { v.historicalCheckpoint = "old.pt" }, /contract_input_fields_not_exact/)

console.log(JSON.stringify({
  schemaVersion: "stage4-controlled-structure-unique-derivation-rules-cpu-report-v1",
  status: "passed",
  contractStatus: CONTRACT_STATUS,
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  modelSourceModified: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
}, null, 2))

