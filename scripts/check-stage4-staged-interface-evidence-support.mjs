import assert from "node:assert/strict"
import {
  buildEvidenceLineageContract,
  buildInactiveConfig,
  buildPhaseInterfaceContract,
  validateEvidenceLineageContract,
  validateInactiveConfig,
  validatePhaseInterfaceContract,
} from "./lib/ai-painter-stage4-staged-interface-evidence-support.mjs"

const binding = Object.freeze({ path: ".runtime/ai-painter/source-contract.json", sha256: "a".repeat(64) })
const clone = (value) => JSON.parse(JSON.stringify(value))
const interfaceContract = () => buildPhaseInterfaceContract(binding)
const lineageContract = () => buildEvidenceLineageContract(binding)
const inactiveConfig = () => buildInactiveConfig(binding)
const positives = []
const negatives = []

validatePhaseInterfaceContract(interfaceContract()); positives.push("accepts_exact_four_phase_interface_contract")
validateEvidenceLineageContract(lineageContract()); positives.push("accepts_exact_same_package_predecessor_lineage_contract")
validateInactiveConfig(inactiveConfig()); positives.push("accepts_fully_inactive_config_and_distinct_training_resolution_taxonomy")

for (const [name, factory, mutate, validate] of [
  ["rejects_phase_omission", interfaceContract, (v) => v.phases.pop(), validatePhaseInterfaceContract],
  ["rejects_phase_duplicate", interfaceContract, (v) => { v.phases[2] = clone(v.phases[1]) }, validatePhaseInterfaceContract],
  ["rejects_phase_reorder", interfaceContract, (v) => v.phases.reverse(), validatePhaseInterfaceContract],
  ["rejects_predecessor_replacement", interfaceContract, (v) => { v.phases[2].predecessorPhaseId = v.phases[0].id }, validatePhaseInterfaceContract],
  ["rejects_worldfacts_creation", interfaceContract, (v) => { v.phaseObligations.authoritative_world_structure_binding.mayCreateWorldFacts = true }, validatePhaseInterfaceContract],
  ["rejects_worldfacts_modification", interfaceContract, (v) => { v.phaseObligations.terrain_route_hydrology_spatial_realization.mayModifyWorldFacts = true }, validatePhaseInterfaceContract],
  ["rejects_object_mask_modification", interfaceContract, (v) => { v.phaseObligations.per_class_object_semantic_realization.mayModifyApprovedObjectMasks = true }, validatePhaseInterfaceContract],
  ["rejects_object_class_omission", interfaceContract, (v) => v.phaseObligations.per_class_object_semantic_realization.objectClasses.pop(), validatePhaseInterfaceContract],
  ["rejects_non_native_final_width", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.outputWidth = 512 }, validatePhaseInterfaceContract],
  ["rejects_multiple_final_candidates", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.outputCandidateCount = 4 }, validatePhaseInterfaceContract],
  ["rejects_tile_output", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.tileAllowed = true }, validatePhaseInterfaceContract],
  ["rejects_patch_output", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.patchAllowed = true }, validatePhaseInterfaceContract],
  ["rejects_sprite_output", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.spriteAllowed = true }, validatePhaseInterfaceContract],
  ["rejects_local_image_assembly", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.localImageAssemblyAllowed = true }, validatePhaseInterfaceContract],
  ["rejects_low_resolution_upscale", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.lowResolutionUpscaleAllowed = true }, validatePhaseInterfaceContract],
  ["rejects_rule_program_rendering", interfaceContract, (v) => { v.phaseObligations.global_visual_harmonization_and_native_complete_rgb_decode.ruleProgramRenderingAllowed = true }, validatePhaseInterfaceContract],
  ["rejects_generation_training_taxonomy_confusion", interfaceContract, (v) => { v.taxonomy.trainingResolutionStages[0].id = v.phases[0].id }, validatePhaseInterfaceContract],
  ["rejects_phase_gpu_activation", interfaceContract, (v) => { v.phases[1].activationGate.gpu = true }, validatePhaseInterfaceContract],
  ["rejects_free_parameter", interfaceContract, (v) => { v.freeParametersAllowed = true }, validatePhaseInterfaceContract],
  ["rejects_cross_package_evidence", lineageContract, (v) => { v.rejectionPolicy.crossPackage = false }, validateEvidenceLineageContract],
  ["rejects_cross_run_evidence", lineageContract, (v) => { v.rejectionPolicy.crossRun = false }, validateEvidenceLineageContract],
  ["rejects_cross_sample_evidence", lineageContract, (v) => { v.rejectionPolicy.crossSample = false }, validateEvidenceLineageContract],
  ["rejects_condition_pack_replacement", lineageContract, (v) => { v.rejectionPolicy.conditionPackReplacement = false }, validateEvidenceLineageContract],
  ["rejects_visual_manifest_replacement", lineageContract, (v) => { v.rejectionPolicy.visualFactManifestReplacement = false }, validateEvidenceLineageContract],
  ["rejects_historical_failed_terminal", lineageContract, (v) => { v.rejectionPolicy.historicalFailedTerminal = false }, validateEvidenceLineageContract],
  ["rejects_wrong_success_status", lineageContract, (v) => { v.terminalSuccessStatus = "success" }, validateEvidenceLineageContract],
  ["rejects_inactive_output_creation", lineageContract, (v) => { v.inactiveSupportCreatesPhaseOutput = true }, validateEvidenceLineageContract],
  ["rejects_training_gate", inactiveConfig, (v) => { v.activationGate.training = true }, validateInactiveConfig],
  ["rejects_optimizer_gate", inactiveConfig, (v) => { v.ownerTrainingAuthorization.permissions.optimizer = true }, validateInactiveConfig],
  ["rejects_unknown_gate", inactiveConfig, (v) => { v.activationGate.unknown = false }, validateInactiveConfig],
  ["rejects_training_stage_as_generation_phase", inactiveConfig, (v) => { v.generationResponsibilityPhases[0].id = "stage0" }, validateInactiveConfig],
  ["rejects_data_channel_change", inactiveConfig, (v) => { v.conditionChannelCount = 24 }, validateInactiveConfig],
]) {
  const value = factory(); mutate(value); assert.throws(() => validate(value), name); negatives.push(name)
}

console.log(JSON.stringify({
  schemaVersion: "stage4-staged-interface-evidence-support-cpu-report-v1",
  status: "passed",
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  executionBoundary: {
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    smokeStarted: false,
    trainingStarted: false,
  },
}, null, 2))

