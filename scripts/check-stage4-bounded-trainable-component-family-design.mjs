import assert from "node:assert/strict"
import {
  adjudicateComponentFamily,
  buildComponentFamilyContract,
  buildEvidenceIsolationContract,
  buildFutureQualificationSequence,
  buildParameterSourceAudit,
  FAMILY_DECISIONS,
  TRAINABLE_RESPONSIBILITIES,
  validateComponentFamilyContract,
  validateEvidenceIsolationContract,
  validateParameterSourceAudit,
} from "./lib/ai-painter-stage4-bounded-trainable-component-family-design.mjs"

const clone = (value) => JSON.parse(JSON.stringify(value))
const failed = () => ({ status: "semantic_mixture_stage4_formal_stage_failed_closed", stage: 0, machineReview: { passCount: 0, failCount: 6 } })
const input = () => ({
  architectureDecision: { selectedDecision: "bounded_new_trainable_component_family_design_required" },
  architectureContract: { status: "cpu_supported_inactive", phases: [{ id: "authoritative_world_structure_binding", trainableComponentGap: false }, ...TRAINABLE_RESPONSIBILITIES.map((id) => ({ id, trainableComponentGap: true }))], frozenProjectBoundary: { conditionChannelCount: 23, autoencoderFrozen: true }, frozenTrainingResolutionStages: [{ id: "stage0", width: 256, height: 192 }, { id: "stage1", width: 512, height: 384 }, { id: "stage2", width: 1024, height: 768 }] },
  gradientInterferenceTerminal: { selectedDecision: "current_training_gradient_interference_gap_confirmed" },
  sharedStage0Terminals: { conflictAware: failed(), conditionFusion: failed(), capacity: failed() },
  autoencoderTerminal: { selectedDecision: "frozen_autoencoder_semantic_retention_sufficient" },
})
const positives = [], negatives = []
const result = adjudicateComponentFamily(input())
assert.equal(result.selectedDecision, FAMILY_DECISIONS.A); positives.push("selects_three_parameter_isolated_responsibility_components")
const contract = buildComponentFamilyContract({ architectureContract: { path: "x", sha256: "a".repeat(64) } }, result)
validateComponentFamilyContract(contract); positives.push("accepts_uniquely_derived_inactive_component_family_contract")
validateParameterSourceAudit(buildParameterSourceAudit()); positives.push("accepts_parameter_source_audit_without_free_values")
validateEvidenceIsolationContract(buildEvidenceIsolationContract()); positives.push("accepts_independent_parameter_checkpoint_terminal_and_output_evidence")
assert.equal(buildFutureQualificationSequence().automaticExecutionAuthorized, false); positives.push("keeps_future_qualification_sequence_unexecuted")

for (const [name, mutate] of [
  ["rejects_wrong_parent_decision", (v) => { v.architectureDecision.selectedDecision = "A" }],
  ["rejects_authority_phase_training_gap", (v) => { v.architectureContract.phases[0].trainableComponentGap = true }],
  ["rejects_responsibility_omission", (v) => v.architectureContract.phases.pop()],
  ["rejects_responsibility_reorder", (v) => v.architectureContract.phases.reverse()],
  ["rejects_condition_channel_change", (v) => { v.architectureContract.frozenProjectBoundary.conditionChannelCount = 24 }],
  ["rejects_autoencoder_unfreeze", (v) => { v.architectureContract.frozenProjectBoundary.autoencoderFrozen = false }],
  ["rejects_resolution_change", (v) => { v.architectureContract.frozenTrainingResolutionStages[2].width = 512 }],
  ["rejects_gradient_interference_evidence_replacement", (v) => { v.gradientInterferenceTerminal.selectedDecision = "sufficient" }],
  ["rejects_conflict_aware_success_injection", (v) => { v.sharedStage0Terminals.conflictAware.machineReview.passCount = 6 }],
  ["rejects_condition_fusion_status_replacement", (v) => { v.sharedStage0Terminals.conditionFusion.status = "success" }],
  ["rejects_capacity_review_replacement", (v) => { v.sharedStage0Terminals.capacity.machineReview.failCount = 0 }],
  ["rejects_autoencoder_gap_injection", (v) => { v.autoencoderTerminal.selectedDecision = "gap" }],
]) { const value = input(); mutate(value); assert.throws(() => adjudicateComponentFamily(value), name); negatives.push(name) }

for (const [name, mutate, validate] of [
  ["rejects_component_omission", (v) => v.components.pop(), validateComponentFamilyContract],
  ["rejects_component_reorder", (v) => v.components.reverse(), validateComponentFamilyContract],
  ["rejects_shared_trainable_parameters", (v) => { v.components[1].sharedTrainableParametersAllowed = true }, validateComponentFamilyContract],
  ["rejects_cross_phase_predecessor", (v) => { v.components[2].predecessorRoleId = v.authorityBinding.roleId }, validateComponentFamilyContract],
  ["rejects_free_model_name", (v) => { v.designBoundary.formalModelNameDefined = true }, validateComponentFamilyContract],
  ["rejects_free_base_width", (v) => { v.components[0].structureDerivation.baseWidth = 96 }, validateComponentFamilyContract],
  ["rejects_free_width_hierarchy", (v) => { v.components[0].structureDerivation.widthHierarchy = [64, 192, 384] }, validateComponentFamilyContract],
  ["rejects_free_time_width", (v) => { v.components[0].structureDerivation.timeEmbeddingWidth = 320 }, validateComponentFamilyContract],
  ["rejects_latent_channel_change", (v) => { v.components[1].tensorInterface.latentChannels = 16 }, validateComponentFamilyContract],
  ["rejects_new_loss", (v) => { v.components[2].lossBoundary.newLossAllowed = true }, validateComponentFamilyContract],
  ["rejects_loss_weight_change", (v) => { v.components[2].lossBoundary.lossWeightChangeAllowed = true }, validateComponentFamilyContract],
  ["rejects_gpu_activation", (v) => { v.activationGate.gpu = true }, validateComponentFamilyContract],
  ["rejects_training_activation", (v) => { v.components[0].activationGate.training = true }, validateComponentFamilyContract],
  ["rejects_data_change", (v) => { v.sharedImmutableBoundaries.approvedDataCount = 65 }, validateComponentFamilyContract],
  ["rejects_split_change", (v) => { v.sharedImmutableBoundaries.split.train = 47 }, validateComponentFamilyContract],
  ["rejects_autoencoder_change", (v) => { v.sharedImmutableBoundaries.autoencoderFrozen = false }, validateComponentFamilyContract],
  ["rejects_non_native_final_output", (v) => { v.finalOutputBoundary.width = 512 }, validateComponentFamilyContract],
  ["rejects_tile_output", (v) => { v.finalOutputBoundary.tileAllowed = true }, validateComponentFamilyContract],
  ["rejects_low_resolution_upscale", (v) => { v.finalOutputBoundary.lowResolutionUpscaleAllowed = true }, validateComponentFamilyContract],
  ["rejects_free_parameter_audit", (v) => { v.freeWidthChosen = true }, validateParameterSourceAudit],
  ["rejects_cross_role_checkpoint", (v) => { v.crossRoleCheckpointForbidden = false }, validateEvidenceIsolationContract],
  ["rejects_shared_substrate_in_isolation_contract", (v) => { v.sharedTrainableParametersAllowed = true }, validateEvidenceIsolationContract],
]) { const value = name.includes("audit") ? buildParameterSourceAudit() : name.includes("checkpoint") || name.includes("isolation") ? buildEvidenceIsolationContract() : clone(contract); mutate(value); assert.throws(() => validate(value), name); negatives.push(name) }

console.log(JSON.stringify({ schemaVersion: "stage4-bounded-trainable-component-family-design-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives, executionBoundary: { checkpointWeightsRead: false, modelSourceModified: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, smokeStarted: false, trainingStarted: false } }, null, 2))

