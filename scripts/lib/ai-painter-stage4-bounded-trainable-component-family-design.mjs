import assert from "node:assert/strict"

export const FAMILY_DECISIONS = Object.freeze({
  A: "three_responsibility_isolated_trainable_components_required",
  B: "bounded_shared_substrate_with_phase_isolated_outputs_supported",
  C: "resource_validation_required_before_component_family_selection",
  D: "evidence_insufficient_for_component_family_design",
})

export const AUTHORITY_PHASE = "authoritative_world_structure_binding"
export const TRAINABLE_RESPONSIBILITIES = Object.freeze([
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
])
export const CONDITION_CHANNEL_COUNT = 23
export const LATENT_CHANNEL_COUNT = 12
export const AUTOENCODER_DOWNSAMPLE_FACTOR = 4
export const EXISTING_BASE_WIDTH = 64
export const EXISTING_WIDTH_HIERARCHY = Object.freeze([64, 128, 256])
export const EXISTING_TIME_EMBEDDING_WIDTH = 256
export const RESOLUTION_STAGES = Object.freeze([
  Object.freeze({ id: "stage0", width: 256, height: 192, latentWidth: 64, latentHeight: 48 }),
  Object.freeze({ id: "stage1", width: 512, height: 384, latentWidth: 128, latentHeight: 96 }),
  Object.freeze({ id: "stage2", width: 1024, height: 768, latentWidth: 256, latentHeight: 192 }),
])

export const INACTIVE_GATES = Object.freeze({
  checkpointRead: false, gpu: false, optimizer: false, backward: false,
  weightModification: false, smoke: false, training: false, stage0: false,
  stage1: false, stage2: false, formalInference: false,
  checkpointPromotion: false, runtimeFrame: false, enterWorld: false,
})

export function adjudicateComponentFamily(input) {
  assert.equal(input.architectureDecision.selectedDecision, "bounded_new_trainable_component_family_design_required")
  assert.equal(input.architectureContract.status, "cpu_supported_inactive")
  assert.equal(input.architectureContract.phases[0].id, AUTHORITY_PHASE)
  assert.equal(input.architectureContract.phases[0].trainableComponentGap, false)
  assert.deepEqual(input.architectureContract.phases.slice(1).map(({ id }) => id), TRAINABLE_RESPONSIBILITIES)
  assert.deepEqual(input.architectureContract.phases.slice(1).map(({ trainableComponentGap }) => trainableComponentGap), [true, true, true])
  assert.equal(input.architectureContract.frozenProjectBoundary.conditionChannelCount, CONDITION_CHANNEL_COUNT)
  assert.equal(input.architectureContract.frozenProjectBoundary.autoencoderFrozen, true)
  assert.deepEqual(input.architectureContract.frozenTrainingResolutionStages, RESOLUTION_STAGES.map(({ id, width, height }) => ({ id, width, height })))

  assert.equal(input.gradientInterferenceTerminal.selectedDecision, "current_training_gradient_interference_gap_confirmed")
  for (const [name, terminal] of Object.entries(input.sharedStage0Terminals)) {
    assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed", `${name}_status_mismatch`)
    assert.equal(terminal.stage, 0, `${name}_stage_mismatch`)
    assert.equal(terminal.machineReview.passCount, 0, `${name}_pass_count_mismatch`)
    assert.equal(terminal.machineReview.failCount, 6, `${name}_fail_count_mismatch`)
  }
  assert.equal(input.autoencoderTerminal.selectedDecision, "frozen_autoencoder_semantic_retention_sufficient")
  return {
    selectedDecision: FAMILY_DECISIONS.A,
    decisionCode: "A",
    rationale: [
      "The authority-binding phase already has reusable non-trainable adapters and must remain outside model training.",
      "The three downstream responsibilities each have a formally proven trainable execution-unit gap and require independent output identities and phase terminals.",
      "The existing shared Denoiser substrate has a formally confirmed multi-sample gradient-interference gap; conflict-aware training, final-condition fusion, and doubled-capacity Stage 0 variants all completed but failed all six fixed reviews.",
      "A new shared trainable substrate therefore lacks positive execution evidence, while responsibility-isolated parameter namespaces directly enforce the required evidence and failure boundaries.",
      "The frozen Autoencoder may remain a shared immutable decode boundary because its semantic retention was separately qualified as sufficient.",
    ],
  }
}

const roleLosses = Object.freeze({
  terrain_route_hydrology_spatial_realization: ["existing_terrain_route_hydrology_spatial_losses_only"],
  per_class_object_semantic_realization: ["existing_per_class_object_semantic_and_reference_losses_only"],
  global_visual_harmonization_and_native_complete_rgb_decode: ["existing_global_rgb_rollout_and_visual_harmonization_losses_only"],
})

export function buildComponentFamilyContract(sourceBindings, decision) {
  assert.equal(decision.selectedDecision, FAMILY_DECISIONS.A)
  const component = (index, roleId, inputArtifact, outputArtifact) => ({
    index,
    roleId,
    status: "cpu_supported_inactive",
    isModelName: false,
    parameterNamespaceIsolated: true,
    sharedTrainableParametersAllowed: false,
    predecessorRoleId: index === 0 ? AUTHORITY_PHASE : TRAINABLE_RESPONSIBILITIES[index - 1],
    inputArtifact,
    outputArtifact,
    tensorInterface: {
      conditionChannels: CONDITION_CHANNEL_COUNT,
      latentChannels: LATENT_CHANNEL_COUNT,
      autoencoderDownsampleFactor: AUTOENCODER_DOWNSAMPLE_FACTOR,
      resolutionStages: RESOLUTION_STAGES.map((stage) => ({ ...stage })),
      preservesBatchAndSpatialIdentity: true,
    },
    structureDerivation: {
      topology: "existing_two_down_two_up_multiscale_contract",
      baseWidth: EXISTING_BASE_WIDTH,
      widthHierarchy: [...EXISTING_WIDTH_HIERARCHY],
      timeEmbeddingWidth: EXISTING_TIME_EMBEDDING_WIDTH,
      outputLatentChannels: LATENT_CHANNEL_COUNT,
      newLayerCountChosen: false,
      freeDimensionChosen: false,
    },
    lossBoundary: {
      permittedExistingLossIdentities: [...roleLosses[roleId]],
      newLossAllowed: false,
      lossWeightChangeAllowed: false,
    },
    phaseTerminalRequired: true,
    outputSha256Required: true,
    samePackageImmediatePredecessorOnly: true,
    activationGate: { ...INACTIVE_GATES },
  })
  return {
    schemaVersion: "stage4-bounded-isolated-trainable-component-family-contract-v1",
    status: "cpu_supported_inactive",
    selectedDecision: decision.selectedDecision,
    sourceBindings,
    authorityBinding: {
      roleId: AUTHORITY_PHASE,
      trainable: false,
      reusableExistingAdaptersOnly: true,
      worldFactsRemainAuthoritative: true,
      visualFactManifestRemainAuthoritative: true,
      conditionPackageRemainAuthoritative: true,
    },
    components: [
      component(0, TRAINABLE_RESPONSIBILITIES[0], "immutable_full_frame_structure_identity", "full_frame_spatial_realization_identity"),
      component(1, TRAINABLE_RESPONSIBILITIES[1], "full_frame_spatial_realization_identity", "full_frame_object_semantic_realization_identity"),
      component(2, TRAINABLE_RESPONSIBILITIES[2], "full_frame_object_semantic_realization_identity", "native_complete_map_latent_and_rgb_identity"),
    ],
    sharedImmutableBoundaries: {
      approvedDataCount: 64,
      split: { train: 48, validation: 8, challenge: 4, regression: 4 },
      conditionChannelCount: CONDITION_CHANNEL_COUNT,
      conditionChannelOrderChanged: false,
      autoencoderFrozen: true,
      autoencoderDownsampleFactor: AUTOENCODER_DOWNSAMPLE_FACTOR,
      latentChannels: LATENT_CHANNEL_COUNT,
      checkpointFormatChanged: false,
      reviewThresholdsChanged: false,
      existingLossValuesAndWeightsChanged: false,
    },
    finalOutputBoundary: {
      stage2OnlyFormalCandidate: true,
      width: 1024,
      height: 768,
      channels: 3,
      nativeCompleteFrame: true,
      outputCandidateCount: 1,
      tileAllowed: false,
      patchAllowed: false,
      spriteAllowed: false,
      localAssemblyAllowed: false,
      lowResolutionUpscaleAllowed: false,
      ruleProgramRenderingAllowed: false,
    },
    designBoundary: {
      formalModelNameDefined: false,
      implementationAuthorized: false,
      resourceQualificationAuthorized: false,
      freeHyperparametersAllowed: false,
      sharedTrainableSubstrateAllowed: false,
    },
    activationGate: { ...INACTIVE_GATES },
  }
}

export function buildParameterSourceAudit() {
  return {
    schemaVersion: "stage4-bounded-component-family-parameter-source-audit-v1",
    status: "passed",
    sources: [
      { field: "conditionChannels", value: 23, source: "formal_complete_world_condition_channel_order" },
      { field: "latentChannels", value: 12, source: "current_formal_frozen_autoencoder_contract" },
      { field: "autoencoderDownsampleFactor", value: 4, source: "residual_4x_latent_pixel_detail_v2" },
      { field: "baseWidth", value: 64, source: "current_formal_denoiser_base_width" },
      { field: "widthHierarchy", value: [64, 128, 256], source: "existing_two_down_level_x2_relationship" },
      { field: "timeEmbeddingWidth", value: 256, source: "existing_base_width_times_4_relationship" },
      { field: "trainingResolutions", value: RESOLUTION_STAGES.map(({ id, width, height }) => ({ id, width, height })), source: "formal_stage0_stage1_stage2_resolution_contract" },
      { field: "latentResolutions", value: RESOLUTION_STAGES.map(({ id, latentWidth, latentHeight }) => ({ id, latentWidth, latentHeight })), source: "training_resolution_divided_by_frozen_autoencoder_factor_4" },
      { field: "finalRgbChannels", value: 3, source: "frozen_autoencoder_rgb_decode_contract" },
      { field: "objectClassCount", value: 4, source: "approved_footprints_tree_rock_vegetation_mask_contract" },
    ],
    freeModelNameChosen: false,
    freeWidthChosen: false,
    freeLayerCountChosen: false,
    freeLossChosen: false,
    freeLossWeightChosen: false,
    freeHyperparameterChosen: false,
  }
}

export function buildEvidenceIsolationContract() {
  return {
    schemaVersion: "stage4-isolated-component-family-evidence-contract-v1",
    status: "cpu_supported_inactive",
    roleOrder: [...TRAINABLE_RESPONSIBILITIES],
    parameterNamespacesIndependent: true,
    optimizerStatesIndependent: true,
    checkpointIdentitiesIndependent: true,
    phaseTerminalIdentitiesIndependent: true,
    outputArtifactIdentitiesIndependent: true,
    samePackageImmediatePredecessorOnly: true,
    commonWorldConditionIdentityExact: true,
    crossRoleCheckpointForbidden: true,
    historicalCheckpointForbidden: true,
    failedOutputForbidden: true,
    outputDirectoryReuseForbidden: true,
    frozenAutoencoderMayBeSharedReadOnly: true,
    sharedTrainableParametersAllowed: false,
  }
}

export function buildFutureQualificationSequence() {
  return {
    schemaVersion: "stage4-isolated-component-family-future-qualification-sequence-v1",
    status: "unexecuted_owner_authorization_required_per_boundary",
    order: [
      "cpu_inactive_implementation_and_positive_negative_regression",
      "independent_readonly_gpu_gradient_and_state_qualification_per_component",
      "same_package_three_component_controlled_smoke_at_stage0_resolution",
      "stage0_formal_training_only_after_smoke_qualification",
    ],
    automaticExecutionAuthorized: false,
    gpuAuthorized: false,
    smokeAuthorized: false,
    trainingAuthorized: false,
    stage1Authorized: false,
    stage2Authorized: false,
  }
}

function assertFalseGate(gate, label) {
  assert.deepEqual(Object.keys(gate), Object.keys(INACTIVE_GATES), `${label}_field_set_changed`)
  for (const [name, value] of Object.entries(gate)) assert.equal(value, false, `${label}_${name}_must_be_false`)
}

export function validateComponentFamilyContract(contract) {
  assert.equal(contract.schemaVersion, "stage4-bounded-isolated-trainable-component-family-contract-v1")
  assert.equal(contract.status, "cpu_supported_inactive")
  assert.equal(contract.selectedDecision, FAMILY_DECISIONS.A)
  assert.equal(contract.authorityBinding.roleId, AUTHORITY_PHASE)
  assert.equal(contract.authorityBinding.trainable, false)
  assert.equal(contract.authorityBinding.worldFactsRemainAuthoritative, true)
  assert.deepEqual(contract.components.map(({ roleId }) => roleId), TRAINABLE_RESPONSIBILITIES)
  assert.deepEqual(contract.components.map(({ index }) => index), [0, 1, 2])
  for (const [index, component] of contract.components.entries()) {
    assert.equal(component.status, "cpu_supported_inactive")
    assert.equal(component.isModelName, false)
    assert.equal(component.parameterNamespaceIsolated, true)
    assert.equal(component.sharedTrainableParametersAllowed, false)
    assert.equal(component.predecessorRoleId, index === 0 ? AUTHORITY_PHASE : TRAINABLE_RESPONSIBILITIES[index - 1])
    assert.equal(component.tensorInterface.conditionChannels, CONDITION_CHANNEL_COUNT)
    assert.equal(component.tensorInterface.latentChannels, LATENT_CHANNEL_COUNT)
    assert.equal(component.tensorInterface.autoencoderDownsampleFactor, AUTOENCODER_DOWNSAMPLE_FACTOR)
    assert.deepEqual(component.tensorInterface.resolutionStages, RESOLUTION_STAGES)
    assert.equal(component.structureDerivation.baseWidth, EXISTING_BASE_WIDTH)
    assert.deepEqual(component.structureDerivation.widthHierarchy, EXISTING_WIDTH_HIERARCHY)
    assert.equal(component.structureDerivation.timeEmbeddingWidth, EXISTING_TIME_EMBEDDING_WIDTH)
    assert.equal(component.structureDerivation.newLayerCountChosen, false)
    assert.equal(component.structureDerivation.freeDimensionChosen, false)
    assert.deepEqual(component.lossBoundary.permittedExistingLossIdentities, roleLosses[component.roleId])
    assert.equal(component.lossBoundary.newLossAllowed, false)
    assert.equal(component.lossBoundary.lossWeightChangeAllowed, false)
    assert.equal(component.phaseTerminalRequired, true)
    assert.equal(component.outputSha256Required, true)
    assert.equal(component.samePackageImmediatePredecessorOnly, true)
    assertFalseGate(component.activationGate, `component_${index}_gate`)
  }
  assert.equal(contract.sharedImmutableBoundaries.approvedDataCount, 64)
  assert.deepEqual(contract.sharedImmutableBoundaries.split, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(contract.sharedImmutableBoundaries.conditionChannelCount, CONDITION_CHANNEL_COUNT)
  assert.equal(contract.sharedImmutableBoundaries.autoencoderFrozen, true)
  assert.equal(contract.sharedImmutableBoundaries.latentChannels, LATENT_CHANNEL_COUNT)
  assert.equal(contract.sharedImmutableBoundaries.existingLossValuesAndWeightsChanged, false)
  assert.deepEqual(contract.finalOutputBoundary, { stage2OnlyFormalCandidate: true, width: 1024, height: 768, channels: 3, nativeCompleteFrame: true, outputCandidateCount: 1, tileAllowed: false, patchAllowed: false, spriteAllowed: false, localAssemblyAllowed: false, lowResolutionUpscaleAllowed: false, ruleProgramRenderingAllowed: false })
  assert.equal(contract.designBoundary.formalModelNameDefined, false)
  assert.equal(contract.designBoundary.implementationAuthorized, false)
  assert.equal(contract.designBoundary.resourceQualificationAuthorized, false)
  assert.equal(contract.designBoundary.freeHyperparametersAllowed, false)
  assert.equal(contract.designBoundary.sharedTrainableSubstrateAllowed, false)
  assertFalseGate(contract.activationGate, "family_gate")
  return true
}

export function validateParameterSourceAudit(audit) {
  assert.equal(audit.status, "passed")
  assert.deepEqual(audit.sources.map(({ field }) => field), ["conditionChannels", "latentChannels", "autoencoderDownsampleFactor", "baseWidth", "widthHierarchy", "timeEmbeddingWidth", "trainingResolutions", "latentResolutions", "finalRgbChannels", "objectClassCount"])
  assert.equal(Object.entries(audit).filter(([key]) => key.startsWith("free")).every(([, value]) => value === false), true)
  return true
}

export function validateEvidenceIsolationContract(contract) {
  assert.deepEqual(contract.roleOrder, TRAINABLE_RESPONSIBILITIES)
  for (const [key, value] of Object.entries(contract)) if (!["schemaVersion", "status", "roleOrder"].includes(key)) assert.equal(value, key === "sharedTrainableParametersAllowed" ? false : true, `${key}_invalid`)
  return true
}

