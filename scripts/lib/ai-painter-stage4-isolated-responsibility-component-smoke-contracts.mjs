import assert from "node:assert/strict"

export const RESPONSIBILITY_ORDER = [
  "terrain_route_hydrology_spatial_realization",
  "per_class_object_semantic_realization",
  "global_visual_harmonization_and_native_complete_rgb_decode",
]

export const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
export const PREVIEW_EPOCHS = [1, 5, 10, 20, 30]

const ROLE_FILE_NAMES = {
  terrain_route_hydrology_spatial_realization: "terrain-route-hydrology-spatial-realization",
  per_class_object_semantic_realization: "per-class-object-semantic-realization",
  global_visual_harmonization_and_native_complete_rgb_decode: "global-visual-harmonization-native-complete-rgb-decode",
}

function assertRoleConfig(config, roleId, supportContract) {
  assert.equal(config.status, "cpu_supported_inactive", `${roleId}_config_not_inactive`)
  assert.equal(config.stage4ResponsibilityComponentRole, roleId, `${roleId}_config_role_mismatch`)
  const component = config.training?.stage4IsolatedResponsibilityComponent
  assert(component, `${roleId}_component_contract_missing`)
  assert.equal(component.roleId, roleId, `${roleId}_component_role_mismatch`)
  assert.deepEqual(component.roleOrder, RESPONSIBILITY_ORDER, `${roleId}_role_order_mismatch`)
  assert.equal(component.parameterNamespaceIsolated, true, `${roleId}_parameter_namespace_not_isolated`)
  assert.equal(component.sharedTrainableParametersAllowed, false, `${roleId}_shared_parameters_allowed`)
  assert.equal(component.samePackageImmediatePredecessorOnly, true, `${roleId}_predecessor_not_same_package_only`)
  assert.equal(component.crossRunEvidenceAllowed, false, `${roleId}_cross_run_allowed`)
  for (const value of Object.values(component.activationGate)) assert.equal(value, false, `${roleId}_activation_gate_not_false`)
  assert.equal(supportContract.inactiveConfigs[roleId].sha256.length, 64, `${roleId}_support_binding_invalid`)
}

export function compileControlledThreeComponentStage0SmokeContract({
  compilationRunId,
  sourceConfigs,
  sourceConfigBindings,
  supportContract,
  supportContractBinding,
  qualificationSuccessTerminal,
  qualificationBindings,
  frozen,
}) {
  assert.match(compilationRunId, /^\d{8}-\d{9}$/, "compilation_run_id_invalid")
  assert.deepEqual(supportContract.roleOrder, RESPONSIBILITY_ORDER, "support_role_order_mismatch")
  assert.equal(supportContract.status, "cpu_supported_inactive", "support_contract_not_inactive")
  assert.equal(qualificationSuccessTerminal.status, "stage4_three_isolated_responsibility_component_readonly_gpu_qualification_succeeded", "qualification_terminal_not_success")
  assert.deepEqual(qualificationSuccessTerminal.executionOrder, RESPONSIBILITY_ORDER, "qualification_order_mismatch")
  assert.equal(qualificationSuccessTerminal.parameterNamespacesPairwiseDistinct, true, "qualification_namespaces_not_distinct")
  assert.equal(qualificationSuccessTerminal.samePackagePredecessorLineageVerified, true, "qualification_predecessor_lineage_not_verified")

  const packageId = `stage4-controlled-three-component-stage0-smoke-${compilationRunId}`
  const components = RESPONSIBILITY_ORDER.map((roleId, roleIndex) => {
    const config = sourceConfigs[roleId]
    assertRoleConfig(config, roleId, supportContract)
    const reservedRunId = `${compilationRunId}-${String(roleIndex + 1).padStart(2, "0")}`
    const outputDirectory = `.runtime/ai-painter/stage4-controlled-three-component-stage0-smokes/${packageId}/${roleIndex + 1}-${ROLE_FILE_NAMES[roleId]}`
    const requestId = `owner-authorized-${packageId}-${roleId}`
    const predecessorRoleId = roleIndex === 0 ? "authoritative_world_structure_binding" : RESPONSIBILITY_ORDER[roleIndex - 1]
    return {
      roleId,
      roleIndex,
      parameterNamespace: config.training.stage4IsolatedResponsibilityComponent.parameterNamespace,
      sourceConfig: sourceConfigBindings[roleId],
      readonlyGpuQualification: qualificationBindings[roleId],
      predecessor: {
        roleId: predecessorRoleId,
        sameSmokePackageRequired: true,
        immediatePredecessorSuccessTerminalRequired: roleIndex > 0,
        immediatePredecessorOutputIdentityRequired: roleIndex > 0,
        crossRunEvidenceAccepted: false,
        historicalOutputAccepted: false,
      },
      fixedExecutionIdentity: {
        sampleId: SAMPLE_ID,
        sampleSplit: "validation",
        seed: 20263722,
        topology: "west",
        resolution: { width: 256, height: 192 },
        epochCount: 30,
        previewEpochs: [...PREVIEW_EPOCHS],
        autoencoderFrozen: true,
        denoiserInitialization: "same_fixed_random_initialization_per_component",
      },
      futureAuthorizationTemplate: {
        schemaVersion: "owner-authorized-stage4-controlled-three-component-stage0-smoke-role-v1",
        status: "unsigned_unexecuted_not_authorized_not_consumed",
        packageId,
        requestId,
        commandRef: requestId,
        reservedRunId,
        scope: `one_30_epoch_stage0_smoke_for_${roleId}`,
        oneTimeConsumption: true,
        ownerSignatureRequired: true,
        gpuAuthorized: false,
        checkpointWeightsReadAuthorized: false,
        optimizerAuthorized: false,
        backwardAuthorized: false,
        modelWeightModificationAuthorized: false,
        checkpointWriteAuthorized: false,
        smokeAuthorized: false,
        trainingAuthorized: false,
        stage0Authorized: false,
      },
      futureEvidenceNamespace: {
        outputDirectory,
        parameterIdentity: `${outputDirectory}/parameter-namespace-identity.json`,
        predecessorConsumption: `${outputDirectory}/predecessor-consumption.json`,
        checkpointIdentity: `${outputDirectory}/checkpoints/non-promotable-smoke-checkpoint.pt`,
        outputIdentity: `${outputDirectory}/output-identity.json`,
        manifest: `${outputDirectory}/manifest.json`,
        finalization: `${outputDirectory}/finalization/finalization.json`,
        phaseTerminal: `${outputDirectory}/phase-terminal.json`,
      },
      responsibilityBoundary: {
        terrainRouteHydrologyOnly: roleIndex === 0,
        approvedFourObjectSemanticClassesOnly: roleIndex === 1,
        globalVisualAndNativeRgbDecodeOnly: roleIndex === 2,
        approvedObjectMasksModificationAllowed: false,
        nativeCompleteRgbOutputAllowed: roleIndex === 2,
      },
    }
  })

  return {
    schemaVersion: "stage4-controlled-three-component-stage0-smoke-contract-v1",
    status: "compiled_unsigned_unexecuted_not_authorized",
    packageId,
    responsibilityOrder: [...RESPONSIBILITY_ORDER],
    sourceSupportContract: supportContractBinding,
    readonlyGpuQualificationSuccess: qualificationBindings.combined,
    fixedExecutionIdentity: components[0].fixedExecutionIdentity,
    components,
    executionPolicy: {
      strictSequentialExecution: true,
      stopOnAnyComponentFailure: true,
      unstartedAuthorizationsRemainUnconsumed: true,
      samePackageImmediatePredecessorOnly: true,
      automaticRetryAllowed: false,
      historicalRunAccepted: false,
      historicalDenoiserAccepted: false,
      failedCheckpointAccepted: false,
      crossComponentArtifactAccepted: false,
      outputDirectoryReuseAllowed: false,
    },
    frozen,
    finalOutputBoundary: {
      producerRoleId: RESPONSIBILITY_ORDER[2],
      stage2FormalCapability: { width: 1024, height: 768, channels: 3 },
      nativeCompleteFrameRequired: true,
      tileAllowed: false,
      patchAllowed: false,
      spriteAllowed: false,
      localAssemblyAllowed: false,
      lowResolutionUpscaleAllowed: false,
      ruleProgramRenderingAllowed: false,
    },
    currentCompilationSafety: {
      signed: false,
      gpuAuthorizationCreatedOrConsumed: false,
      checkpointWeightsRead: false,
      optimizerCreated: false,
      backwardExecuted: false,
      modelWeightsModified: false,
      gpuStarted: false,
      smokeStarted: false,
      stage0Started: false,
      stage1Started: false,
      stage2Started: false,
      trainingStarted: false,
    },
  }
}

export function validateControlledThreeComponentStage0SmokeContract(contract, expected) {
  assert.equal(contract.schemaVersion, "stage4-controlled-three-component-stage0-smoke-contract-v1")
  assert.equal(contract.status, "compiled_unsigned_unexecuted_not_authorized")
  assert.deepEqual(contract.responsibilityOrder, RESPONSIBILITY_ORDER)
  assert.equal(contract.sourceSupportContract.sha256, expected.supportContractSha256)
  assert.equal(contract.readonlyGpuQualificationSuccess.sha256, expected.combinedTerminalSha256)
  assert.deepEqual(contract.fixedExecutionIdentity, {
    sampleId: SAMPLE_ID,
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: PREVIEW_EPOCHS,
    autoencoderFrozen: true,
    denoiserInitialization: "same_fixed_random_initialization_per_component",
  })
  assert.equal(contract.components.length, 3)
  const runIds = new Set()
  const outputDirectories = new Set()
  const parameterNamespaces = new Set()
  for (const [index, roleId] of RESPONSIBILITY_ORDER.entries()) {
    const component = contract.components[index]
    assert.equal(component.roleId, roleId)
    assert.equal(component.roleIndex, index)
    assert.equal(component.sourceConfig.sha256, expected.configSha256s[roleId])
    assert.equal(component.readonlyGpuQualification.terminal.sha256, expected.qualificationSha256s[roleId].terminal)
    assert.equal(component.readonlyGpuQualification.report.sha256, expected.qualificationSha256s[roleId].report)
    assert.equal(component.readonlyGpuQualification.cudaTelemetry.sha256, expected.qualificationSha256s[roleId].cudaTelemetry)
    assert.equal(component.predecessor.roleId, index === 0 ? "authoritative_world_structure_binding" : RESPONSIBILITY_ORDER[index - 1])
    assert.equal(component.predecessor.sameSmokePackageRequired, true)
    assert.equal(component.predecessor.crossRunEvidenceAccepted, false)
    assert.equal(component.predecessor.historicalOutputAccepted, false)
    assert.equal(component.futureAuthorizationTemplate.status, "unsigned_unexecuted_not_authorized_not_consumed")
    for (const key of ["gpuAuthorized", "checkpointWeightsReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "modelWeightModificationAuthorized", "checkpointWriteAuthorized", "smokeAuthorized", "trainingAuthorized", "stage0Authorized"]) assert.equal(component.futureAuthorizationTemplate[key], false)
    assert.equal(runIds.has(component.futureAuthorizationTemplate.reservedRunId), false)
    assert.equal(outputDirectories.has(component.futureEvidenceNamespace.outputDirectory), false)
    assert.equal(parameterNamespaces.has(component.parameterNamespace), false)
    runIds.add(component.futureAuthorizationTemplate.reservedRunId)
    outputDirectories.add(component.futureEvidenceNamespace.outputDirectory)
    parameterNamespaces.add(component.parameterNamespace)
  }
  assert.equal(contract.finalOutputBoundary.producerRoleId, RESPONSIBILITY_ORDER[2])
  assert.deepEqual(contract.finalOutputBoundary.stage2FormalCapability, { width: 1024, height: 768, channels: 3 })
  for (const key of ["tileAllowed", "patchAllowed", "spriteAllowed", "localAssemblyAllowed", "lowResolutionUpscaleAllowed", "ruleProgramRenderingAllowed"]) assert.equal(contract.finalOutputBoundary[key], false)
  for (const value of Object.values(contract.currentCompilationSafety)) assert.equal(value, false)
}
