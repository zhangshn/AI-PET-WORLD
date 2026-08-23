import assert from "node:assert/strict"

export const STAGED_COMPLETE_MAP_PHASES = Object.freeze([
  "authoritative_world_structure_binding",
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
])

export const TRAINING_RESOLUTION_STAGES = Object.freeze([
  Object.freeze({ id: "stage0", width: 256, height: 192 }),
  Object.freeze({ id: "stage1", width: 512, height: 384 }),
  Object.freeze({ id: "stage2", width: 1024, height: 768 }),
])

export const COMMON_IDENTITY_FIELDS = Object.freeze([
  "packageId",
  "runId",
  "sampleId",
  "worldId",
  "regionId",
  "tick",
  "factHash",
  "visualFactManifestPath",
  "visualFactManifestSha256",
  "conditionPackPath",
  "conditionPackSha256",
])

export const INACTIVE_ACTION_GATES = Object.freeze({
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

const OUTPUTS = Object.freeze([
  "immutable_full_frame_structure_identity",
  "full_frame_spatial_realization_identity",
  "full_frame_object_semantic_realization_identity",
  "native_1024x768_complete_map_rgb_candidate",
])

const clone = (value) => JSON.parse(JSON.stringify(value))

export function buildPhaseInterfaceContract(sourceContractBinding) {
  return {
    schemaVersion: "stage4-staged-complete-map-phase-interface-contract-v1",
    status: "cpu_supported_inactive",
    sourceContract: clone(sourceContractBinding),
    taxonomy: {
      generationResponsibilityPhases: [...STAGED_COMPLETE_MAP_PHASES],
      trainingResolutionStages: TRAINING_RESOLUTION_STAGES.map((stage) => ({ ...stage })),
      namespacesAreDistinct: true,
    },
    commonExecutionIdentity: {
      requiredFields: [...COMMON_IDENTITY_FIELDS],
      exactAcrossAllPhases: true,
      conditionChannelCount: 23,
    },
    phases: STAGED_COMPLETE_MAP_PHASES.map((id, index) => ({
      index,
      id,
      status: "cpu_supported_inactive",
      predecessorPhaseId: index === 0 ? null : STAGED_COMPLETE_MAP_PHASES[index - 1],
      predecessorSuccessTerminalRequired: index > 0,
      predecessorOutputIdentityRequired: index > 0,
      inheritedIdentityChainRequired: index > 0,
      outputIdentityType: OUTPUTS[index],
      activationGate: { ...INACTIVE_ACTION_GATES },
    })),
    phaseObligations: {
      authoritative_world_structure_binding: {
        mayCreateWorldFacts: false,
        mayModifyWorldFacts: false,
        bindsExistingWorldFactsOnly: true,
      },
      terrain_route_hydrology_spatial_realization: {
        mayCreateWorldFacts: false,
        mayModifyWorldFacts: false,
        preservesTerrainRouteHydrologyTopology: true,
      },
      per_class_object_semantic_realization: {
        mayModifyApprovedObjectMasks: false,
        approvedObjectMasksSha256Required: true,
        objectClasses: ["footprints", "tree", "rock", "vegetation"],
      },
      global_visual_harmonization_and_native_complete_rgb_decode: {
        outputWidth: 1024,
        outputHeight: 768,
        nativeCompleteFrame: true,
        outputCandidateCount: 1,
        tileAllowed: false,
        patchAllowed: false,
        spriteAllowed: false,
        localImageAssemblyAllowed: false,
        lowResolutionUpscaleAllowed: false,
        ruleProgramRenderingAllowed: false,
      },
    },
    freeParametersAllowed: false,
    modelNameDefined: false,
    trainableModelImplemented: false,
  }
}

export function buildEvidenceLineageContract(sourceContractBinding) {
  return {
    schemaVersion: "stage4-staged-complete-map-evidence-lineage-contract-v1",
    status: "cpu_supported_inactive",
    sourceContract: clone(sourceContractBinding),
    identityFields: [...COMMON_IDENTITY_FIELDS],
    exactIdentityInheritanceRequired: true,
    phaseOrder: [...STAGED_COMPLETE_MAP_PHASES],
    terminalSuccessStatus: "staged_complete_map_phase_completed_closed",
    outputIdentityFields: ["artifactPath", "artifactSha256", "terminalPath", "terminalSha256"],
    predecessorMaterialization: STAGED_COMPLETE_MAP_PHASES.map((phaseId, index) => ({
      phaseId,
      predecessorPhaseId: index === 0 ? null : STAGED_COMPLETE_MAP_PHASES[index - 1],
      consumesOnlySamePackageImmediatePredecessorSuccess: index > 0,
      inheritedEarlierEvidenceChainRequired: index > 0,
    })),
    rejectionPolicy: {
      crossPackage: true,
      crossRun: true,
      crossSample: true,
      crossWorld: true,
      crossRegion: true,
      crossTick: true,
      factHashReplacement: true,
      visualFactManifestReplacement: true,
      conditionPackReplacement: true,
      historicalFailedTerminal: true,
      missingPredecessor: true,
      reorderedPhase: true,
      outputReuse: true,
    },
    inactiveSupportCreatesPhaseOutput: false,
  }
}

export function buildInactiveConfig(sourceContractBinding) {
  return {
    schemaVersion: "stage4-staged-complete-map-cpu-inactive-config-v1",
    status: "cpu_supported_inactive",
    sourceContract: clone(sourceContractBinding),
    conditionChannelCount: 23,
    generationResponsibilityPhases: STAGED_COMPLETE_MAP_PHASES.map((id, index) => ({ index, id, status: "cpu_supported_inactive" })),
    trainingResolutionStages: TRAINING_RESOLUTION_STAGES.map((stage) => ({ ...stage, taxonomy: "training_resolution_stage" })),
    generationAndTrainingStageTaxonomiesDistinct: true,
    activationGate: { ...INACTIVE_ACTION_GATES },
    ownerTrainingAuthorization: {
      status: "not_authorized_cpu_support_only",
      permissions: { ...INACTIVE_ACTION_GATES },
    },
    freeParametersAllowed: false,
    modelNameDefined: false,
    trainableModelImplemented: false,
  }
}

function assertExactFalseGate(gate, label) {
  assert.deepEqual(Object.keys(gate), Object.keys(INACTIVE_ACTION_GATES), `${label}_field_set_mismatch`)
  for (const [name, value] of Object.entries(gate)) assert.equal(value, false, `${label}_${name}_must_be_false`)
}

function assertSourceBinding(binding) {
  assert.equal(typeof binding?.path, "string", "source_contract_path_required")
  assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u, "source_contract_sha256_required")
}

export function validatePhaseInterfaceContract(contract) {
  assert.equal(contract.schemaVersion, "stage4-staged-complete-map-phase-interface-contract-v1")
  assert.equal(contract.status, "cpu_supported_inactive")
  assertSourceBinding(contract.sourceContract)
  assert.deepEqual(contract.taxonomy.generationResponsibilityPhases, STAGED_COMPLETE_MAP_PHASES)
  assert.deepEqual(contract.taxonomy.trainingResolutionStages, TRAINING_RESOLUTION_STAGES)
  assert.equal(contract.taxonomy.namespacesAreDistinct, true)
  assert.deepEqual(contract.commonExecutionIdentity.requiredFields, COMMON_IDENTITY_FIELDS)
  assert.equal(contract.commonExecutionIdentity.exactAcrossAllPhases, true)
  assert.equal(contract.commonExecutionIdentity.conditionChannelCount, 23)
  assert.deepEqual(contract.phases.map(({ id }) => id), STAGED_COMPLETE_MAP_PHASES)
  assert.deepEqual(contract.phases.map(({ index }) => index), [0, 1, 2, 3])
  assert.deepEqual(contract.phases.map(({ outputIdentityType }) => outputIdentityType), OUTPUTS)
  for (const [index, phase] of contract.phases.entries()) {
    assert.equal(phase.status, "cpu_supported_inactive")
    assert.equal(phase.predecessorPhaseId, index === 0 ? null : STAGED_COMPLETE_MAP_PHASES[index - 1])
    assert.equal(phase.predecessorSuccessTerminalRequired, index > 0)
    assert.equal(phase.predecessorOutputIdentityRequired, index > 0)
    assert.equal(phase.inheritedIdentityChainRequired, index > 0)
    assertExactFalseGate(phase.activationGate, `phase_${index}_activation_gate`)
  }
  const obligations = contract.phaseObligations
  assert.equal(obligations.authoritative_world_structure_binding.mayCreateWorldFacts, false)
  assert.equal(obligations.authoritative_world_structure_binding.mayModifyWorldFacts, false)
  assert.equal(obligations.terrain_route_hydrology_spatial_realization.mayCreateWorldFacts, false)
  assert.equal(obligations.terrain_route_hydrology_spatial_realization.mayModifyWorldFacts, false)
  assert.equal(obligations.per_class_object_semantic_realization.mayModifyApprovedObjectMasks, false)
  assert.equal(obligations.per_class_object_semantic_realization.approvedObjectMasksSha256Required, true)
  assert.deepEqual(obligations.per_class_object_semantic_realization.objectClasses, ["footprints", "tree", "rock", "vegetation"])
  assert.deepEqual(obligations.global_visual_harmonization_and_native_complete_rgb_decode, {
    outputWidth: 1024,
    outputHeight: 768,
    nativeCompleteFrame: true,
    outputCandidateCount: 1,
    tileAllowed: false,
    patchAllowed: false,
    spriteAllowed: false,
    localImageAssemblyAllowed: false,
    lowResolutionUpscaleAllowed: false,
    ruleProgramRenderingAllowed: false,
  })
  assert.equal(contract.freeParametersAllowed, false)
  assert.equal(contract.modelNameDefined, false)
  assert.equal(contract.trainableModelImplemented, false)
  return true
}

export function validateEvidenceLineageContract(contract) {
  assert.equal(contract.schemaVersion, "stage4-staged-complete-map-evidence-lineage-contract-v1")
  assert.equal(contract.status, "cpu_supported_inactive")
  assertSourceBinding(contract.sourceContract)
  assert.deepEqual(contract.identityFields, COMMON_IDENTITY_FIELDS)
  assert.equal(contract.exactIdentityInheritanceRequired, true)
  assert.deepEqual(contract.phaseOrder, STAGED_COMPLETE_MAP_PHASES)
  assert.equal(contract.terminalSuccessStatus, "staged_complete_map_phase_completed_closed")
  assert.deepEqual(contract.outputIdentityFields, ["artifactPath", "artifactSha256", "terminalPath", "terminalSha256"])
  assert.deepEqual(contract.predecessorMaterialization.map(({ phaseId }) => phaseId), STAGED_COMPLETE_MAP_PHASES)
  for (const [index, item] of contract.predecessorMaterialization.entries()) {
    assert.equal(item.predecessorPhaseId, index === 0 ? null : STAGED_COMPLETE_MAP_PHASES[index - 1])
    assert.equal(item.consumesOnlySamePackageImmediatePredecessorSuccess, index > 0)
    assert.equal(item.inheritedEarlierEvidenceChainRequired, index > 0)
  }
  assert.deepEqual(Object.values(contract.rejectionPolicy), Array(Object.keys(contract.rejectionPolicy).length).fill(true))
  assert.equal(contract.inactiveSupportCreatesPhaseOutput, false)
  return true
}

export function validateInactiveConfig(config) {
  assert.equal(config.schemaVersion, "stage4-staged-complete-map-cpu-inactive-config-v1")
  assert.equal(config.status, "cpu_supported_inactive")
  assertSourceBinding(config.sourceContract)
  assert.equal(config.conditionChannelCount, 23)
  assert.deepEqual(config.generationResponsibilityPhases.map(({ id }) => id), STAGED_COMPLETE_MAP_PHASES)
  assert.deepEqual(config.generationResponsibilityPhases.map(({ index }) => index), [0, 1, 2, 3])
  assert.equal(config.generationResponsibilityPhases.every(({ status }) => status === "cpu_supported_inactive"), true)
  assert.deepEqual(config.trainingResolutionStages, TRAINING_RESOLUTION_STAGES.map((stage) => ({ ...stage, taxonomy: "training_resolution_stage" })))
  assert.equal(config.generationAndTrainingStageTaxonomiesDistinct, true)
  assertExactFalseGate(config.activationGate, "activation_gate")
  assert.equal(config.ownerTrainingAuthorization.status, "not_authorized_cpu_support_only")
  assertExactFalseGate(config.ownerTrainingAuthorization.permissions, "owner_training_permissions")
  assert.equal(config.freeParametersAllowed, false)
  assert.equal(config.modelNameDefined, false)
  assert.equal(config.trainableModelImplemented, false)
  return true
}

