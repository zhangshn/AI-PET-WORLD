import assert from "node:assert/strict"
import {
  adjudicateStagedArchitecture,
  buildInactiveStagedArchitectureContract,
  STAGED_ARCHITECTURE_DECISIONS,
  STAGED_ARCHITECTURE_PHASES,
  STAGED_COMMON_IDENTITY,
  validateInactiveStagedArchitectureContract,
} from "./lib/ai-painter-stage4-staged-architecture-design.mjs"

const clone = (value) => JSON.parse(JSON.stringify(value))
const baseInput = () => ({
  interfaceContract: { phases: STAGED_ARCHITECTURE_PHASES.map((id) => ({ id })) },
  lineageContract: { identityFields: [...STAGED_COMMON_IDENTITY] },
  inactiveConfig: { status: "cpu_supported_inactive", conditionChannelCount: 23 },
  configurationAudit: { worldFactsModificationAllowed: false, approvedObjectMaskModificationAllowed: false, finalOutput: { width: 1024, height: 768, nativeCompleteFrame: true, candidateCount: 1 } },
  gatewayText: "buildWorldVisualFactManifest buildWorldVisualGenerationCondition generateWorldVisualCandidateFromInternalModel",
  conditionBuilderText: "preserveWorldFacts: true, forbidProgrammaticFinalFrame: true",
  factManifestBuilderText: "worldId: saveRecord.worldId, tick: saveRecord.tick",
  modelText: "stage4_structure_fact_first_dual_stage_generator_v1 stage4_condition_preserving_semantic_renderer_v1 stage4_fact_conditioned_semantic_mixture_decoder_v1 class ProjectOwnedCompleteWorldSystem self.autoencoder = ProjectOwnedAutoencoder self.denoiser = ProjectOwnedMultiscaleConditionUNet",
  internalCandidateGeneratorText: "const FORMAL_FRAME_WIDTH = 1024; const FORMAL_FRAME_HEIGHT = 768; .resize(FORMAL_FRAME_WIDTH, FORMAL_FRAME_HEIGHT, { kernel: \"nearest\" })",
  structureFactRouteTerminal: { candidateRouteStatus: "stage4_structure_fact_first_dual_stage_generator_v1_failed_closed" },
  semanticRendererRouteTerminal: { status: "stage4_condition_preserving_semantic_renderer_route_exited_closed", candidateRouteExited: true },
  uniquePlanText: "历史V8、V9、结构事实优先、条件保持语义渲染器、事实条件语义混合解码器及首次正式Stage 0视觉失败均保留为只读历史证据，不得作为新执行父Checkpoint或直接运行来源。",
})
const positives = []
const negatives = []
const result = adjudicateStagedArchitecture(baseInput())
assert.equal(result.selectedDecision, STAGED_ARCHITECTURE_DECISIONS.B); positives.push("selects_bounded_new_trainable_component_family_design_from_structural_evidence")
const contract = buildInactiveStagedArchitectureContract({ interfaceContract: { path: "x", sha256: "a".repeat(64) } }, result)
validateInactiveStagedArchitectureContract(contract); positives.push("accepts_exact_four_phase_inactive_architecture_contract")
assert.deepEqual(contract.phases.slice(1).map(({ trainableComponentGap }) => trainableComponentGap), [true, true, true]); positives.push("keeps_authority_adapters_and_bounds_three_trainable_responsibility_gaps")

for (const [name, mutate] of [
  ["rejects_phase_omission", (v) => v.interfaceContract.phases.pop()],
  ["rejects_phase_reorder", (v) => v.interfaceContract.phases.reverse()],
  ["rejects_identity_field_omission", (v) => v.lineageContract.identityFields.pop()],
  ["rejects_active_source_config", (v) => { v.inactiveConfig.status = "active" }],
  ["rejects_condition_channel_change", (v) => { v.inactiveConfig.conditionChannelCount = 24 }],
  ["rejects_worldfacts_mutation_permission", (v) => { v.configurationAudit.worldFactsModificationAllowed = true }],
  ["rejects_object_mask_mutation_permission", (v) => { v.configurationAudit.approvedObjectMaskModificationAllowed = true }],
  ["rejects_non_native_final_output", (v) => { v.configurationAudit.finalOutput.width = 512 }],
  ["rejects_missing_fact_manifest_builder", (v) => { v.gatewayText = v.gatewayText.replace("buildWorldVisualFactManifest", "") }],
  ["rejects_missing_condition_builder", (v) => { v.gatewayText = v.gatewayText.replace("buildWorldVisualGenerationCondition", "") }],
  ["rejects_missing_worldfacts_preservation", (v) => { v.conditionBuilderText = v.conditionBuilderText.replace("preserveWorldFacts: true", "") }],
  ["rejects_false_claim_fact_hash_already_bound", (v) => { v.factManifestBuilderText += " factHash: value" }],
  ["rejects_false_claim_condition_hash_already_bound", (v) => { v.conditionBuilderText += " conditionPackSha256: value" }],
  ["rejects_historic_structure_component_missing", (v) => { v.modelText = v.modelText.replace("stage4_structure_fact_first_dual_stage_generator_v1", "") }],
  ["rejects_historic_semantic_component_missing", (v) => { v.modelText = v.modelText.replace("stage4_condition_preserving_semantic_renderer_v1", "") }],
  ["rejects_current_one_shot_component_missing", (v) => { v.modelText = v.modelText.replace("stage4_fact_conditioned_semantic_mixture_decoder_v1", "") }],
  ["rejects_staged_phase_implementation_claim", (v) => { v.modelText += ` ${STAGED_ARCHITECTURE_PHASES[1]}` }],
  ["rejects_runtime_resize_evidence_missing", (v) => { v.internalCandidateGeneratorText = v.internalCandidateGeneratorText.replace(".resize(FORMAL_FRAME_WIDTH, FORMAL_FRAME_HEIGHT", ".native(" ) }],
  ["rejects_nearest_resize_identity_missing", (v) => { v.internalCandidateGeneratorText = v.internalCandidateGeneratorText.replace("kernel: \"nearest\"", "") }],
  ["rejects_structure_fact_route_not_closed", (v) => { v.structureFactRouteTerminal.candidateRouteStatus = "active" }],
  ["rejects_semantic_renderer_not_exited", (v) => { v.semanticRendererRouteTerminal.candidateRouteExited = false }],
  ["rejects_historic_route_isolation_missing", (v) => { v.uniquePlanText = "active routes" }],
]) {
  const value = baseInput(); mutate(value); assert.throws(() => adjudicateStagedArchitecture(value), name); negatives.push(name)
}

for (const [name, mutate] of [
  ["rejects_contract_phase_omission", (v) => v.phases.pop()],
  ["rejects_contract_phase_reorder", (v) => v.phases.reverse()],
  ["rejects_cross_phase_predecessor", (v) => { v.phases[2].predecessorPhaseId = v.phases[0].id }],
  ["rejects_worldfacts_boundary_removal", (v) => { v.phases[0].failClosedOn = [] }],
  ["rejects_historic_structure_route_reuse", (v) => { v.phases[1].failClosedOn = v.phases[1].failClosedOn.filter((x) => x !== "historic_structure_fact_route_reuse") }],
  ["rejects_mask_change_boundary_removal", (v) => { v.phases[2].failClosedOn = [] }],
  ["rejects_upscale_permission", (v) => { v.phases[3].failClosedOn = v.phases[3].failClosedOn.filter((x) => x !== "low_resolution_upscale") }],
  ["rejects_free_model_name", (v) => { v.componentFamilyDesignBoundary.modelNamesDefined = true }],
  ["rejects_free_structure_dimensions", (v) => { v.componentFamilyDesignBoundary.structureDimensionsDefined = true }],
  ["rejects_implementation_authority", (v) => { v.componentFamilyDesignBoundary.implementationAuthorized = true }],
  ["rejects_gpu_authority", (v) => { v.activationGate.gpu = true }],
  ["rejects_training_authority", (v) => { v.phases[3].activationGate.training = true }],
  ["rejects_dataset_change", (v) => { v.frozenProjectBoundary.approvedDataCount = 65 }],
  ["rejects_split_change", (v) => { v.frozenProjectBoundary.split.train = 47 }],
  ["rejects_review_threshold_change", (v) => { v.frozenProjectBoundary.reviewThresholdsChanged = true }],
]) {
  const value = clone(contract); mutate(value); assert.throws(() => validateInactiveStagedArchitectureContract(value), name); negatives.push(name)
}

console.log(JSON.stringify({
  schemaVersion: "stage4-staged-architecture-design-cpu-report-v1",
  status: "passed",
  positivePassed: positives.length,
  positiveTotal: positives.length,
  negativePassed: negatives.length,
  negativeTotal: negatives.length,
  positives,
  negatives,
  executionBoundary: { checkpointWeightsRead: false, modelModified: false, lossModified: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, smokeStarted: false, trainingStarted: false },
}, null, 2))

