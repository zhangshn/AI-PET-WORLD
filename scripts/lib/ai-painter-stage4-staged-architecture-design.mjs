import assert from "node:assert/strict"

export const STAGED_ARCHITECTURE_DECISIONS = Object.freeze({
  A: "existing_components_support_staged_architecture_without_new_trainable_family",
  B: "bounded_new_trainable_component_family_design_required",
  C: "staged_architecture_resource_boundary_requires_validation",
  D: "evidence_insufficient_for_staged_architecture_design",
})

export const STAGED_ARCHITECTURE_PHASES = Object.freeze([
  "authoritative_world_structure_binding",
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
])

export const STAGED_COMMON_IDENTITY = Object.freeze([
  "packageId", "runId", "sampleId", "worldId", "regionId", "tick", "factHash",
  "visualFactManifestPath", "visualFactManifestSha256", "conditionPackPath", "conditionPackSha256",
])

export const ALL_INACTIVE_GATES = Object.freeze({
  checkpointRead: false,
  gpu: false,
  optimizer: false,
  backward: false,
  weightModification: false,
  smoke: false,
  training: false,
  stage0: false,
  stage1: false,
  stage2: false,
  formalInference: false,
  checkpointPromotion: false,
  runtimeFrame: false,
  enterWorld: false,
})

export function adjudicateStagedArchitecture(input) {
  assert.deepEqual(input.interfaceContract.phases.map(({ id }) => id), STAGED_ARCHITECTURE_PHASES)
  assert.deepEqual(input.lineageContract.identityFields, STAGED_COMMON_IDENTITY)
  assert.equal(input.inactiveConfig.status, "cpu_supported_inactive")
  assert.equal(input.inactiveConfig.conditionChannelCount, 23)
  assert.equal(input.configurationAudit.worldFactsModificationAllowed, false)
  assert.equal(input.configurationAudit.approvedObjectMaskModificationAllowed, false)
  assert.deepEqual(input.configurationAudit.finalOutput, { width: 1024, height: 768, nativeCompleteFrame: true, candidateCount: 1 })

  assert.match(input.gatewayText, /buildWorldVisualFactManifest/u, "world_fact_manifest_builder_not_reachable")
  assert.match(input.gatewayText, /buildWorldVisualGenerationCondition/u, "generation_condition_builder_not_reachable")
  assert.match(input.gatewayText, /generateWorldVisualCandidateFromInternalModel/u, "internal_candidate_generator_not_reachable")
  assert.match(input.conditionBuilderText, /preserveWorldFacts:\s*true/u, "worldfacts_preservation_not_present")
  assert.match(input.conditionBuilderText, /forbidProgrammaticFinalFrame:\s*true/u, "programmatic_frame_forbidden_flag_missing")
  assert.match(input.factManifestBuilderText, /worldId:\s*saveRecord\.worldId/u, "world_id_binding_missing")
  assert.match(input.factManifestBuilderText, /tick:\s*saveRecord\.tick/u, "tick_binding_missing")
  assert.doesNotMatch(input.factManifestBuilderText, /factHash\s*:/u, "unexpected_fact_hash_implementation_claim")
  assert.doesNotMatch(input.conditionBuilderText, /conditionPackSha256\s*:/u, "unexpected_condition_pack_hash_implementation_claim")

  assert.match(input.modelText, /stage4_structure_fact_first_dual_stage_generator_v1/u, "historic_structure_fact_component_missing")
  assert.match(input.modelText, /stage4_condition_preserving_semantic_renderer_v1/u, "historic_semantic_renderer_component_missing")
  assert.match(input.modelText, /stage4_fact_conditioned_semantic_mixture_decoder_v1/u, "current_one_shot_denoiser_missing")
  assert.match(input.modelText, /class ProjectOwnedCompleteWorldSystem/u, "complete_world_system_missing")
  assert.match(input.modelText, /self\.autoencoder\s*=\s*ProjectOwnedAutoencoder/u, "autoencoder_boundary_missing")
  assert.match(input.modelText, /self\.denoiser\s*=\s*ProjectOwnedMultiscaleConditionUNet/u, "single_denoiser_boundary_missing")
  for (const phaseId of STAGED_ARCHITECTURE_PHASES) assert.equal(input.modelText.includes(phaseId), false, `staged_phase_already_implemented:${phaseId}`)

  assert.match(input.internalCandidateGeneratorText, /\.resize\(FORMAL_FRAME_WIDTH,\s*FORMAL_FRAME_HEIGHT/u, "runtime_source_resize_not_proven")
  assert.match(input.internalCandidateGeneratorText, /kernel:\s*"nearest"/u, "runtime_nearest_resize_identity_missing")
  assert.match(input.internalCandidateGeneratorText, /const FORMAL_FRAME_WIDTH = 1024/u, "formal_width_missing")
  assert.match(input.internalCandidateGeneratorText, /const FORMAL_FRAME_HEIGHT = 768/u, "formal_height_missing")

  assert.equal(input.structureFactRouteTerminal.candidateRouteStatus, "stage4_structure_fact_first_dual_stage_generator_v1_failed_closed")
  assert.equal(input.semanticRendererRouteTerminal.status, "stage4_condition_preserving_semantic_renderer_route_exited_closed")
  assert.equal(input.semanticRendererRouteTerminal.candidateRouteExited, true)
  assert.match(input.uniquePlanText, /历史V8、V9、结构事实优先、条件保持语义渲染器、事实条件语义混合解码器及首次正式Stage 0视觉失败均保留为只读历史证据，不得作为新执行父Checkpoint或直接运行来源/u, "historic_route_isolation_missing")

  return {
    selectedDecision: STAGED_ARCHITECTURE_DECISIONS.B,
    decisionCode: "B",
    provenFacts: {
      authoritativeBindingAdaptersExist: true,
      authoritativeBindingIdentityEnvelopeComplete: false,
      independentSpatialRealizationExecutionUnitExists: false,
      independentObjectSemanticExecutionUnitExists: false,
      independentNativeFinalRgbExecutionUnitExists: false,
      priorStructureFactRouteFailedClosed: true,
      priorSemanticRendererRouteExited: true,
      currentRuntimeCandidateUsesSourceResize: true,
      existingOneShotModelCanBeReusedAsExecutionSource: false,
    },
    rationale: [
      "Existing WorldFacts, VisualFactManifest, and WorldGenerationCondition builders are reusable as read-only authority adapters, but they do not yet bind the full immutable identity envelope required by the staged contract.",
      "Existing terrain planning is descriptive, while the historic structure-fact and semantic-renderer branches are internal outputs of retired one-shot Denoiser routes rather than independently consumable phase terminals.",
      "The current complete-world system exposes one Autoencoder plus one Denoiser execution boundary and does not implement the four formal staged phase identities.",
      "The current runtime image candidate path resizes a selected source image to 1024x768, which cannot satisfy the new native-complete-frame and no-upscale boundary.",
      "Therefore existing components can be retained as adapters and evidence sources, but a separately authorized bounded trainable component-family design is required before any implementation or resource qualification.",
    ],
  }
}

export function buildInactiveStagedArchitectureContract(sourceBindings, decision) {
  assert.equal(decision.selectedDecision, STAGED_ARCHITECTURE_DECISIONS.B)
  const phase = (index, id, body) => ({
    index,
    id,
    status: "cpu_supported_inactive",
    commonIdentity: [...STAGED_COMMON_IDENTITY],
    predecessorPhaseId: index === 0 ? null : STAGED_ARCHITECTURE_PHASES[index - 1],
    samePackageImmediatePredecessorOnly: index > 0,
    activationGate: { ...ALL_INACTIVE_GATES },
    ...body,
  })
  return {
    schemaVersion: "stage4-staged-complete-map-inactive-architecture-contract-v1",
    status: "cpu_supported_inactive",
    selectedDecision: decision.selectedDecision,
    sourceBindings,
    businessGoal: "Generate one auditable native complete map from authoritative WorldFacts, VisualFactManifest, and the versioned 23-channel condition package.",
    phases: [
      phase(0, STAGED_ARCHITECTURE_PHASES[0], {
        inputs: ["WorldFacts", "VisualFactManifest", "versioned_23_channel_condition_package"],
        outputs: ["immutable_full_frame_structure_identity"],
        reusableExistingComponents: ["buildWorldVisualFactManifest", "auditWorldVisualFactManifest", "buildWorldVisualGenerationCondition"],
        componentRole: "read_only_authority_adapter",
        trainableComponentGap: false,
        requiredBoundaryGap: ["regionId", "factHash", "manifest_path_sha256", "condition_pack_path_sha256", "independent_success_terminal"],
        failClosedOn: ["worldfacts_mutation", "identity_field_missing", "manifest_hash_mismatch", "condition_pack_hash_mismatch"],
      }),
      phase(1, STAGED_ARCHITECTURE_PHASES[1], {
        inputs: ["immutable_full_frame_structure_identity", "terrain_route_hydrology_condition_channels"],
        outputs: ["full_frame_spatial_realization_identity"],
        reusableExistingComponents: ["buildWorldVisualTerrainPlan", "resize_stage4_structure_fact_layout", "approved_23_channel_condition_loader"],
        componentRole: "read_only_plan_and_tensor_utility_only",
        trainableComponentGap: true,
        requiredBoundaryGap: ["independent_trainable_spatial_realization", "full_frame_spatial_artifact", "independent_success_terminal"],
        failClosedOn: ["worldfacts_mutation", "topology_identity_change", "historic_structure_fact_route_reuse", "cross_run_predecessor"],
      }),
      phase(2, STAGED_ARCHITECTURE_PHASES[2], {
        inputs: ["full_frame_spatial_realization_identity", "approved_object_masks", "object_condition_channels"],
        outputs: ["full_frame_object_semantic_realization_identity"],
        reusableExistingComponents: ["approved_object_mask_loader", "historic_object_semantic_readouts_as_read_only_evidence"],
        componentRole: "read_only_mask_and_diagnostic_source_only",
        trainableComponentGap: true,
        requiredBoundaryGap: ["independent_trainable_object_semantic_realization", "mask_preserving_full_frame_artifact", "independent_success_terminal"],
        failClosedOn: ["approved_mask_change", "cross_class_source", "historic_semantic_renderer_route_reuse", "cross_run_predecessor"],
      }),
      phase(3, STAGED_ARCHITECTURE_PHASES[3], {
        inputs: ["full_frame_object_semantic_realization_identity", "inherited_full_frame_spatial_identity", "approved_visual_style_contract", "frozen_autoencoder_boundary"],
        outputs: ["native_1024x768_complete_map_rgb_candidate"],
        reusableExistingComponents: ["ProjectOwnedAutoencoder_decode_boundary", "formal_machine_review", "approved_frame_gate"],
        componentRole: "frozen_decode_and_review_boundary_only",
        trainableComponentGap: true,
        requiredBoundaryGap: ["independent_trainable_global_harmonization", "native_1024x768_generation_without_upscale", "independent_success_terminal"],
        failClosedOn: ["tile", "patch", "sprite", "local_image_assembly", "low_resolution_upscale", "rule_program_rendering", "cross_run_predecessor"],
      }),
    ],
    frozenTrainingResolutionStages: [
      { id: "stage0", width: 256, height: 192 },
      { id: "stage1", width: 512, height: 384 },
      { id: "stage2", width: 1024, height: 768 },
    ],
    componentFamilyDesignBoundary: {
      modelNamesDefined: false,
      structureDimensionsDefined: false,
      freeParametersAllowed: false,
      implementationAuthorized: false,
      resourceQualificationAuthorized: false,
      minimumRequiredResponsibilities: [
        STAGED_ARCHITECTURE_PHASES[1],
        STAGED_ARCHITECTURE_PHASES[2],
        STAGED_ARCHITECTURE_PHASES[3],
      ],
      futureDesignMustDeriveStructureFromExistingContracts: true,
    },
    frozenProjectBoundary: {
      approvedDataCount: 64,
      split: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannelCount: 23,
      autoencoderFrozen: true,
      lossChanged: false,
      reviewThresholdsChanged: false,
      checkpointFormatChanged: false,
    },
    activationGate: { ...ALL_INACTIVE_GATES },
  }
}

function assertFalseGate(gate, label) {
  assert.deepEqual(Object.keys(gate), Object.keys(ALL_INACTIVE_GATES), `${label}_field_set_changed`)
  for (const [key, value] of Object.entries(gate)) assert.equal(value, false, `${label}_${key}_must_be_false`)
}

export function validateInactiveStagedArchitectureContract(contract) {
  assert.equal(contract.schemaVersion, "stage4-staged-complete-map-inactive-architecture-contract-v1")
  assert.equal(contract.status, "cpu_supported_inactive")
  assert.equal(contract.selectedDecision, STAGED_ARCHITECTURE_DECISIONS.B)
  assert.deepEqual(contract.phases.map(({ id }) => id), STAGED_ARCHITECTURE_PHASES)
  assert.deepEqual(contract.phases.map(({ index }) => index), [0, 1, 2, 3])
  for (const [index, phase] of contract.phases.entries()) {
    assert.equal(phase.status, "cpu_supported_inactive")
    assert.deepEqual(phase.commonIdentity, STAGED_COMMON_IDENTITY)
    assert.equal(phase.predecessorPhaseId, index === 0 ? null : STAGED_ARCHITECTURE_PHASES[index - 1])
    assert.equal(phase.samePackageImmediatePredecessorOnly, index > 0)
    assertFalseGate(phase.activationGate, `phase_${index}_gate`)
  }
  assert.equal(contract.phases[0].trainableComponentGap, false)
  assert.deepEqual(contract.phases.slice(1).map(({ trainableComponentGap }) => trainableComponentGap), [true, true, true])
  assert.equal(contract.phases[0].failClosedOn.includes("worldfacts_mutation"), true)
  assert.equal(contract.phases[1].failClosedOn.includes("historic_structure_fact_route_reuse"), true)
  assert.equal(contract.phases[2].failClosedOn.includes("approved_mask_change"), true)
  assert.deepEqual(contract.phases[3].failClosedOn.slice(0, 6), ["tile", "patch", "sprite", "local_image_assembly", "low_resolution_upscale", "rule_program_rendering"])
  assert.deepEqual(contract.frozenTrainingResolutionStages, [
    { id: "stage0", width: 256, height: 192 },
    { id: "stage1", width: 512, height: 384 },
    { id: "stage2", width: 1024, height: 768 },
  ])
  assert.deepEqual(contract.componentFamilyDesignBoundary.minimumRequiredResponsibilities, STAGED_ARCHITECTURE_PHASES.slice(1))
  assert.equal(contract.componentFamilyDesignBoundary.modelNamesDefined, false)
  assert.equal(contract.componentFamilyDesignBoundary.structureDimensionsDefined, false)
  assert.equal(contract.componentFamilyDesignBoundary.freeParametersAllowed, false)
  assert.equal(contract.componentFamilyDesignBoundary.implementationAuthorized, false)
  assert.equal(contract.componentFamilyDesignBoundary.resourceQualificationAuthorized, false)
  assert.equal(contract.frozenProjectBoundary.approvedDataCount, 64)
  assert.deepEqual(contract.frozenProjectBoundary.split, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(contract.frozenProjectBoundary.conditionChannelCount, 23)
  assert.equal(contract.frozenProjectBoundary.autoencoderFrozen, true)
  assert.equal(contract.frozenProjectBoundary.lossChanged, false)
  assert.equal(contract.frozenProjectBoundary.reviewThresholdsChanged, false)
  assert.equal(contract.frozenProjectBoundary.checkpointFormatChanged, false)
  assertFalseGate(contract.activationGate, "contract_gate")
  return true
}

