import assert from "node:assert/strict"

export const STAGED_SUCCESSOR_REVIEW_DECISIONS = Object.freeze({
  PAUSE: "no_unique_successor_structure_derivable_project_pause",
})

export const FIXED_40_LATE_EPOCHS = Object.freeze([10, 20, 30, 40])
export const FIXED_40_FAILURE_COUNTS = Object.freeze([7, 5, 1, 2])
export const FIXED_40_TERMINAL_ISSUES = Object.freeze([
  "condition_terrain_path_ground_required_boundary_contact_missing",
  "condition_object_rock_reference_semantic_mismatch",
])
export const FORMAL_STAGED_RESPONSIBILITIES = Object.freeze([
  "authoritative_world_structure_binding",
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
])

const RETIRED_THREE_COMPONENT_DECISION =
  "three_component_responsibility_or_existing_supervision_semantically_insufficient"
const FORMAL_INTERFACE_SCHEMA =
  "stage4-staged-complete-map-phase-interface-contract-v1"
const CURRENT_CAPABILITY =
  "stage4-native-route-counterfactual-compositor-fixed-40-qualification-successor-v1"
const CURRENT_SOURCE_RUN =
  "stage4-route-counterfactual-compositor-fixed-40-epoch-20260828013231-01"
const CURRENT_TASK = "retire_fixed40_successor_and_escalate_generation_paradigm"
const RETIRED_COMPONENT_FAMILY_DECISION =
  "three_responsibility_isolated_trainable_components_required"

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function assertFixed40Evidence(evidence) {
  assert.equal(
    evidence?.terminalStatus,
    "route_counterfactual_compositor_fixed_40_epoch_qualification_real_visual_failure",
    "fixed40_terminal_identity_mismatch",
  )
  assert.deepEqual(evidence.epochs, FIXED_40_LATE_EPOCHS)
  assert.deepEqual(evidence.failureCounts, FIXED_40_FAILURE_COUNTS)
  assert.equal(
    evidence.noTerminalRegression,
    false,
    "fixed40_terminal_regression_fact_must_be_preserved",
  )
  assert.deepEqual(
    evidence.epoch40IssueCodes,
    FIXED_40_TERMINAL_ISSUES,
    "fixed40_epoch40_route_and_rock_identity_mismatch",
  )
  assert.equal(evidence.lifecycleState, "rejected")
}

function assertRetiredThreeComponentEvidence(evidence) {
  assert.equal(evidence?.selectedCause, "A")
  assert.equal(evidence.selectedDecision, RETIRED_THREE_COMPONENT_DECISION)
  assert.equal(
    evidence.candidateRouteExited,
    true,
    "retired_three_component_route_must_remain_exited",
  )
  assert.equal(evidence.lifecycleState, "rejected")
}

function assertFormalStagedInterface(contract) {
  assert.equal(contract?.schemaVersion, FORMAL_INTERFACE_SCHEMA)
  assert.equal(contract.status, "cpu_supported_inactive")
  assert.equal(contract.taxonomy?.namespacesAreDistinct, true)
  assert.deepEqual(
    contract.taxonomy?.generationResponsibilityPhases,
    FORMAL_STAGED_RESPONSIBILITIES,
  )
  assert.deepEqual(
    contract.phases?.map(({ id }) => id),
    FORMAL_STAGED_RESPONSIBILITIES,
  )
  assert.deepEqual(contract.phases.map(({ index }) => index), [0, 1, 2, 3])
  assert.equal(contract.commonExecutionIdentity?.conditionChannelCount, 23)
  assert.equal(contract.commonExecutionIdentity?.exactAcrossAllPhases, true)
}

function assertCurrentRegistryEvidence(registry) {
  assert.equal(registry?.schemaVersion, "ai-painter-current-execution-registry-v1")
  assert.equal(registry.registryRevision, 38)
  assert.equal(registry.eventSequence, 38)
  assert.equal(registry.capabilityVersion, CURRENT_CAPABILITY)
  assert.equal(registry.runId, CURRENT_SOURCE_RUN)
  assert.equal(registry.taskId, CURRENT_TASK)
  assert.equal(registry.lifecycleStage, "rejected")
  assert.equal(registry.executionState, "package_materialized")
  assert.equal(registry.activity, "planned_not_started")
  assert.equal(registry.activeExecution, null)
  assert.equal(
    Object.hasOwn(registry, "successorStructureCandidate"),
    false,
    "current_registry_must_not_claim_an_unverified_successor",
  )
  assert.equal(
    Object.hasOwn(registry, "successorStructureContract"),
    false,
    "current_registry_must_not_claim_an_unverified_successor_contract",
  )
}

function assertPriorComponentFamilyEvidence(decision, contract, parameterAudit) {
  assert.equal(decision?.selectedDecision, RETIRED_COMPONENT_FAMILY_DECISION)
  assert.deepEqual(Object.keys(decision.alternativesRejected).sort(), [
    "bounded_shared_substrate_with_phase_isolated_outputs_supported",
    "evidence_insufficient_for_component_family_design",
    "resource_validation_required_before_component_family_selection",
  ])
  assert.match(
    decision.alternativesRejected
      .bounded_shared_substrate_with_phase_isolated_outputs_supported,
    /gradient-interference/u,
    "shared_substrate_rejection_evidence_missing",
  )
  assert.equal(contract?.selectedDecision, RETIRED_COMPONENT_FAMILY_DECISION)
  assert.equal(contract.designBoundary?.sharedTrainableSubstrateAllowed, false)
  assert.deepEqual(contract.components?.map(({ roleId }) => roleId),
    FORMAL_STAGED_RESPONSIBILITIES.slice(1))
  for (const component of contract.components) {
    assert.equal(component.parameterNamespaceIsolated, true)
    assert.equal(component.sharedTrainableParametersAllowed, false)
    assert.equal(component.structureDerivation?.topology,
      "existing_two_down_two_up_multiscale_contract")
    assert.equal(component.structureDerivation?.newLayerCountChosen, false)
    assert.equal(component.structureDerivation?.freeDimensionChosen, false)
    assert.equal(component.lossBoundary?.newLossAllowed, false)
    assert.equal(component.lossBoundary?.lossWeightChangeAllowed, false)
  }
  assert.equal(parameterAudit?.freeModelNameChosen, false)
  assert.equal(parameterAudit.freeWidthChosen, false)
  assert.equal(parameterAudit.freeLayerCountChosen, false)
  assert.equal(parameterAudit.freeLossChosen, false)
  assert.equal(parameterAudit.freeLossWeightChosen, false)
  assert.equal(parameterAudit.freeHyperparameterChosen, false)
  assert.deepEqual(parameterAudit.sources?.map(({ field }) => field), [
    "conditionChannels",
    "latentChannels",
    "autoencoderDownsampleFactor",
    "baseWidth",
    "widthHierarchy",
    "timeEmbeddingWidth",
    "trainingResolutions",
    "latentResolutions",
    "finalRgbChannels",
    "objectClassCount",
  ])
}

export function deriveStagedSuccessorStructureCandidateAudit(input) {
  assertFixed40Evidence(input?.fixed40Evidence)
  assertRetiredThreeComponentEvidence(input.retiredThreeComponentEvidence)
  assertFormalStagedInterface(input.formalStagedInterface)
  assertCurrentRegistryEvidence(input.currentRegistryEvidence)
  assertPriorComponentFamilyEvidence(
    input.componentFamilyDecision,
    input.componentFamilyContract,
    input.parameterSourceAudit,
  )

  const parameterSources = Object.fromEntries(
    input.parameterSourceAudit.sources.map(({ field, value, source }) => [
      field,
      { value: clone(value), source },
    ]),
  )
  const components = input.componentFamilyContract.components
  const isolatedSignature = {
    trainablePartition: components.map(({ roleId }) => roleId),
    topology: [...new Set(components.map(({ structureDerivation }) =>
      structureDerivation.topology))],
    interPhaseCarrierSchema: components.map((component) => ({
      roleId: component.roleId,
      inputArtifact: component.inputArtifact,
      outputArtifact: component.outputArtifact,
    })),
    widthHierarchy: clone(parameterSources.widthHierarchy.value),
    latentChannels: parameterSources.latentChannels.value,
  }
  const axisDerivationMatrix = [
    {
      axis: "phaseGraph",
      status: "derived_unique",
      value: clone(input.formalStagedInterface.taxonomy.generationResponsibilityPhases),
      source: "formalStagedInterface.taxonomy.generationResponsibilityPhases",
    },
    {
      axis: "trainablePartitionAndParameterOwnership",
      status: "retired_value_only",
      value: clone(isolatedSignature.trainablePartition),
      source: "componentFamilyContract.components[*].parameterNamespaceIsolated",
    },
    {
      axis: "interPhaseCarrierSchema",
      status: "retired_value_only",
      value: clone(isolatedSignature.interPhaseCarrierSchema),
      source: "componentFamilyContract.components[*].inputArtifact/outputArtifact",
    },
    {
      axis: "backboneTopologyPerTrainablePhase",
      status: "retired_value_only",
      value: clone(isolatedSignature.topology),
      source: "componentFamilyContract.components[*].structureDerivation.topology",
    },
    {
      axis: "widthHierarchy",
      status: "derived_unique_but_bound_to_retired_topology",
      value: clone(parameterSources.widthHierarchy.value),
      source: `parameterSourceAudit:${parameterSources.widthHierarchy.source}`,
    },
    {
      axis: "conditionInjectionPerPhase",
      status: "unresolved_no_trusted_derivation",
      value: null,
      source: null,
    },
    {
      axis: "finalRgbSemanticPreservationMechanism",
      status: "unresolved_no_trusted_derivation",
      value: null,
      source: null,
    },
  ]
  const retiredSignatureIndex = [
    {
      identity: "three_responsibility_isolated_trainable_components",
      state: "retired_real_visual_failure",
      signature: isolatedSignature,
      evidenceDecision: input.retiredThreeComponentEvidence.selectedDecision,
    },
    {
      identity: "bounded_shared_substrate_with_phase_isolated_outputs",
      state: "forbidden_by_prior_evidence",
      evidenceDecision:
        input.componentFamilyDecision.alternativesRejected
          .bounded_shared_substrate_with_phase_isolated_outputs_supported,
    },
    {
      identity: CURRENT_CAPABILITY,
      state: "retired_real_visual_failure",
      evidenceDecision: input.fixed40Evidence.terminalStatus,
    },
  ]
  const unresolvedAxes = axisDerivationMatrix
    .filter(({ status }) => status === "unresolved_no_trusted_derivation")
    .map(({ axis }) => axis)
  const viableCandidateSignatures = retiredSignatureIndex
    .filter(({ state }) => state === "eligible")
  assert.equal(viableCandidateSignatures.length, 0)
  assert.ok(unresolvedAxes.length > 0)

  return {
    axisDerivationMatrix,
    retiredSignatureIndex,
    candidateEnumeration: {
      derivationStatus: "no_derivable_candidate",
      viableCandidateCount: viableCandidateSignatures.length,
      unresolvedAxes,
      freeArchitectureChoiceRequiredToContinue: true,
    },
  }
}

export function adjudicateStagedSuccessorStructureUniqueDerivationReview(input) {
  deriveStagedSuccessorStructureCandidateAudit(input)

  // This v1 review is deliberately evidence-closed.  It may only report that
  // the current immutable registry does not bind a uniquely derived successor.
  // A future successor must arrive as new independently verified evidence and
  // be reviewed by a new contract version; caller-authored uniqueness claims
  // are never accepted here.
  return STAGED_SUCCESSOR_REVIEW_DECISIONS.PAUSE
}

export function buildStagedSuccessorReviewFixtures() {
  const currentEvidence = {
    fixed40Evidence: {
      terminalStatus:
        "route_counterfactual_compositor_fixed_40_epoch_qualification_real_visual_failure",
      epochs: [...FIXED_40_LATE_EPOCHS],
      failureCounts: [...FIXED_40_FAILURE_COUNTS],
      noTerminalRegression: false,
      epoch40IssueCodes: [...FIXED_40_TERMINAL_ISSUES],
      lifecycleState: "rejected",
    },
    retiredThreeComponentEvidence: {
      selectedCause: "A",
      selectedDecision: RETIRED_THREE_COMPONENT_DECISION,
      candidateRouteExited: true,
      lifecycleState: "rejected",
    },
    formalStagedInterface: {
      schemaVersion: FORMAL_INTERFACE_SCHEMA,
      status: "cpu_supported_inactive",
      taxonomy: {
        generationResponsibilityPhases: [...FORMAL_STAGED_RESPONSIBILITIES],
        namespacesAreDistinct: true,
      },
      commonExecutionIdentity: {
        conditionChannelCount: 23,
        exactAcrossAllPhases: true,
      },
      phases: FORMAL_STAGED_RESPONSIBILITIES.map((id, index) => ({ index, id })),
    },
    currentRegistryEvidence: {
      schemaVersion: "ai-painter-current-execution-registry-v1",
      registryRevision: 38,
      eventSequence: 38,
      capabilityVersion: CURRENT_CAPABILITY,
      runId: CURRENT_SOURCE_RUN,
      taskId: CURRENT_TASK,
      lifecycleStage: "rejected",
      executionState: "package_materialized",
      activity: "planned_not_started",
      activeExecution: null,
    },
    componentFamilyDecision: {
      selectedDecision: RETIRED_COMPONENT_FAMILY_DECISION,
      alternativesRejected: {
        bounded_shared_substrate_with_phase_isolated_outputs_supported:
          "shared substrate repeats proven gradient-interference risk",
        resource_validation_required_before_component_family_selection:
          "selection already determined",
        evidence_insufficient_for_component_family_design:
          "evidence was sufficient",
      },
    },
    componentFamilyContract: {
      selectedDecision: RETIRED_COMPONENT_FAMILY_DECISION,
      designBoundary: { sharedTrainableSubstrateAllowed: false },
      components: FORMAL_STAGED_RESPONSIBILITIES.slice(1).map((roleId, index) => ({
        roleId,
        parameterNamespaceIsolated: true,
        sharedTrainableParametersAllowed: false,
        inputArtifact: index === 0
          ? "immutable_full_frame_structure_identity"
          : index === 1
            ? "full_frame_spatial_realization_identity"
            : "full_frame_object_semantic_realization_identity",
        outputArtifact: index === 0
          ? "full_frame_spatial_realization_identity"
          : index === 1
            ? "full_frame_object_semantic_realization_identity"
            : "native_complete_map_latent_and_rgb_identity",
        structureDerivation: {
          topology: "existing_two_down_two_up_multiscale_contract",
          newLayerCountChosen: false,
          freeDimensionChosen: false,
        },
        lossBoundary: { newLossAllowed: false, lossWeightChangeAllowed: false },
      })),
    },
    parameterSourceAudit: {
      freeModelNameChosen: false,
      freeWidthChosen: false,
      freeLayerCountChosen: false,
      freeLossChosen: false,
      freeLossWeightChosen: false,
      freeHyperparameterChosen: false,
      sources: [
        ["conditionChannels", 23],
        ["latentChannels", 12],
        ["autoencoderDownsampleFactor", 4],
        ["baseWidth", 64],
        ["widthHierarchy", [64, 128, 256]],
        ["timeEmbeddingWidth", 256],
        ["trainingResolutions", [{ id: "stage0", width: 256, height: 192 }]],
        ["latentResolutions", [{ id: "stage0", latentWidth: 64, latentHeight: 48 }]],
        ["finalRgbChannels", 3],
        ["objectClassCount", 4],
      ].map(([field, value]) => ({ field, value, source: `fixture_${field}` })),
    },
  }

  return {
    currentEvidence: clone(currentEvidence),
  }
}
