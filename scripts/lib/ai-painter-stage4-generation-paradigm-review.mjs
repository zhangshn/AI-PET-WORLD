import assert from "node:assert/strict"

export const DECISIONS = Object.freeze({
  A: "one_shot_complete_map_generation_remains_executable_new_model_family_design_required",
  B: "staged_complete_map_generation_paradigm_required",
  C: "owner_business_scope_choice_required",
  D: "evidence_insufficient_for_generation_paradigm_decision",
})

export const STAGED_PHASES = Object.freeze([
  "authoritative_world_structure_binding",
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
])

export function reviewGenerationParadigm(input) {
  const { businessSpecText, formalSpecText, worldContract, original64Terminal, autoencoderTerminal, gradientTerminal, baselineTerminal, crossArmTerminal, crossArmReport, conditionFusionTerminal, capacityTerminal, capacityBestReview, routeExitTerminal } = input
  assert.match(businessSpecText, /WorldFacts、VisualFactManifest及23通道条件|WorldFacts.*23 通道/su, "business_goal_identity_missing")
  assert.match(formalSpecText, /模型体系可以由多个自研模块组成，但只有一条正式完整世界训练与推理主线/u, "multi_module_single_line_contract_missing")
  assert.match(formalSpecText, /原生输出为 `1024×768`，不得由低分辨率、局部图、tile 或 sprite 放大或拼接获得/u, "native_full_frame_contract_missing")
  assert.match(formalSpecText, /训练可以按 `256×192 -> 512×384 -> 1024×768` 渐进执行/u, "progressive_training_contract_missing")
  assert.equal(worldContract.worldAndDynamicReadiness.conditionChannelCount, 23)
  assert.equal(worldContract.worldAndDynamicReadiness.rgbCannotReplaceStructuredWorldFacts, true)
  assert.equal(worldContract.fullWorldFrame.worldMustFillRectangularFrameEdgeToEdge, true)
  assert.equal(original64Terminal.original64ContractSatisfied, true)
  assert.equal(original64Terminal.dataDefectProven, false)
  assert.equal(autoencoderTerminal.selectedDecision, "frozen_autoencoder_semantic_retention_sufficient")
  assert.equal(gradientTerminal.selectedDecision, "current_training_gradient_interference_gap_confirmed")
  for (const terminal of [baselineTerminal, conditionFusionTerminal, capacityTerminal]) {
    assert.equal(terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
    assert.equal(terminal.stage, 0)
    assert.equal(terminal.machineReview.passCount, 0)
    assert.equal(terminal.machineReview.failCount, 6)
  }
  assert.equal(crossArmTerminal.outcome, "condition_fusion_only_priority")
  assert.equal(crossArmReport.facts.bothSmokesNaturallyCompleted, true)
  assert.equal(crossArmReport.facts.bothLateStabilityQualified, true)
  assert.equal(crossArmReport.facts.bothTerminalEpoch30Passed, true)
  assert.equal(crossArmReport.facts.trainingPeakGpuTelemetryPersistedForBothArms, true)
  assert.equal(crossArmReport.fusion.resourceTelemetry.present, true)
  assert.equal(crossArmReport.capacity.resourceTelemetry.present, true)
  assert.equal(capacityBestReview.passed, false)
  assert.deepEqual(capacityBestReview.issueCodes, ["condition_terrain_path_ground_required_boundary_contact_missing", "condition_object_tree_reference_semantic_mismatch", "condition_object_vegetation_reference_semantic_mismatch"])
  assert.equal(routeExitTerminal.status, "capacity_structure_route_exited_project_level_owner_decision_required")
  const peakBytes = [conditionFusionTerminal.resourceTelemetry?.peakGpuMemoryBytes ?? null, capacityTerminal.resourceTelemetry?.peakGpuMemoryBytes ?? null]
  assert.equal(peakBytes.every((value) => Number.isInteger(value) && value > 0), true, "stage0_resource_telemetry_missing")
  return {
    selectedDecision: DECISIONS.B,
    decisionCode: "B",
    rationale: [
      "The approved data contract is satisfied and no data defect is proven.",
      "The frozen Autoencoder retains the required object semantics.",
      "Single-sample controlled Smokes converge, while baseline, condition-fusion, and capacity Stage 0 runs each fail all six fixed multi-sample reviews.",
      "The formal specification explicitly permits multiple self-developed modules inside one formal complete-world line while preserving one native 1024x768 complete-map output.",
      "The four staged responsibilities are uniquely derived from existing WorldFacts/condition binding, terrain-route-hydrology, object semantics, and final RGB obligations; they do not add world facts or change final acceptance.",
    ],
    stagedPhases: [...STAGED_PHASES],
    resourceConclusion: "bounded_cpu_design_and_sequential_low_resolution_qualification_supported_native_1024_training_not_yet_proven",
    businessGoalChanged: false,
    finalNativeCompleteFrameRequired: true,
    tileOrPatchAssemblyAllowed: false,
    newModelImplemented: false,
    trainingAuthorized: false,
  }
}

export function validateStagedParadigmContract(contract) {
  assert.equal(contract.status, "cpu_supported_inactive")
  assert.deepEqual(contract.phases.map((phase) => phase.id), STAGED_PHASES)
  assert.equal(contract.businessInvariants.businessGoalChanged, false)
  assert.equal(contract.businessInvariants.worldFactsRemainAuthoritative, true)
  assert.equal(contract.businessInvariants.conditionChannelCount, 23)
  assert.equal(contract.businessInvariants.finalOutput.width, 1024)
  assert.equal(contract.businessInvariants.finalOutput.height, 768)
  assert.equal(contract.businessInvariants.finalOutput.nativeCompleteFrame, true)
  assert.equal(contract.businessInvariants.tilePatchOrSpriteAssemblyAllowed, false)
  assert.equal(contract.activationGate.cpuSupportOnly, true)
  assert.equal(Object.values(contract.activationGate).filter((value) => value === true).length, 1)
  assert.equal(contract.freeParametersAllowed, false)
  return true
}
