import assert from "node:assert/strict"
import {
  RESPONSIBILITY_ORDER,
  compileControlledThreeComponentStage0SmokeContract,
  validateControlledThreeComponentStage0SmokeContract,
} from "./lib/ai-painter-stage4-isolated-responsibility-component-smoke-contracts.mjs"

const bind = (seed) => ({ path: `.runtime/${seed}.json`, sha256: seed.padEnd(64, "0").slice(0, 64) })
const support = {
  status: "cpu_supported_inactive",
  roleOrder: [...RESPONSIBILITY_ORDER],
  inactiveConfigs: Object.fromEntries(RESPONSIBILITY_ORDER.map((role) => [role, bind(`${role}-config`)])),
}
const config = (role, index) => ({
  status: "cpu_supported_inactive",
  stage4ResponsibilityComponentRole: role,
  training: {
    stage4IsolatedResponsibilityComponent: {
      roleId: role,
      roleOrder: [...RESPONSIBILITY_ORDER],
      parameterNamespace: `stage4_responsibility_components.${role}`,
      parameterNamespaceIsolated: true,
      sharedTrainableParametersAllowed: false,
      samePackageImmediatePredecessorOnly: true,
      crossRunEvidenceAllowed: false,
      activationGate: Object.fromEntries(["configurationActiveNow", "gpuUseNow", "optimizerCreationNow", "backwardExecutionNow", "modelParameterUpdateNow", "smokeNow", "trainingNow", "stage0Now"].map((key) => [key, false])),
      roleIndex: index,
    },
  },
})
const sourceConfigs = Object.fromEntries(RESPONSIBILITY_ORDER.map((role, index) => [role, config(role, index)]))
const sourceConfigBindings = Object.fromEntries(RESPONSIBILITY_ORDER.map((role) => [role, support.inactiveConfigs[role]]))
const qualificationSha256s = Object.fromEntries(RESPONSIBILITY_ORDER.map((role, index) => [role, {
  terminal: bind(`terminal-${index}`).sha256,
  report: bind(`report-${index}`).sha256,
  cudaTelemetry: bind(`cuda-${index}`).sha256,
}]))
const qualificationBindings = Object.fromEntries(RESPONSIBILITY_ORDER.map((role, index) => [role, {
  terminal: bind(`terminal-${index}`), report: bind(`report-${index}`), cudaTelemetry: bind(`cuda-${index}`),
}]))
qualificationBindings.combined = bind("combined-terminal")
const qualificationSuccessTerminal = {
  status: "stage4_three_isolated_responsibility_component_readonly_gpu_qualification_succeeded",
  executionOrder: [...RESPONSIBILITY_ORDER],
  parameterNamespacesPairwiseDistinct: true,
  samePackagePredecessorLineageVerified: true,
}
const frozen = {
  approvedDatasetCount: 64,
  split: { train: 48, validation: 8, challenge: 4, regression: 4 },
  conditionChannelCount: 23,
  autoencoderFrozen: true,
  existingLossValuesAndWeightsChanged: false,
  checkpointFormatChanged: false,
  machineReviewThresholdChanged: false,
}
const expected = {
  supportContractSha256: bind("support").sha256,
  combinedTerminalSha256: qualificationBindings.combined.sha256,
  configSha256s: Object.fromEntries(RESPONSIBILITY_ORDER.map((role) => [role, sourceConfigBindings[role].sha256])),
  qualificationSha256s,
}
const compile = (overrides = {}) => compileControlledThreeComponentStage0SmokeContract({
  compilationRunId: "20260824-023500000",
  sourceConfigs,
  sourceConfigBindings,
  supportContract: support,
  supportContractBinding: bind("support"),
  qualificationSuccessTerminal,
  qualificationBindings,
  frozen,
  ...overrides,
})

const positive = []
const negative = []
const pos = (name, value) => positive.push({ name, passed: Boolean(value) })
const reject = (name, callback) => {
  let passed = false
  try { callback() } catch { passed = true }
  negative.push({ name, passed })
}

const contract = compile()
validateControlledThreeComponentStage0SmokeContract(contract, expected)
pos("single_unsigned_unexecuted_contract", contract.status === "compiled_unsigned_unexecuted_not_authorized")
pos("exact_responsibility_order", JSON.stringify(contract.responsibilityOrder) === JSON.stringify(RESPONSIBILITY_ORDER))
pos("three_isolated_future_authorizations", new Set(contract.components.map((item) => item.futureAuthorizationTemplate.requestId)).size === 3)
pos("three_isolated_run_ids", new Set(contract.components.map((item) => item.futureAuthorizationTemplate.reservedRunId)).size === 3)
pos("three_isolated_output_directories", new Set(contract.components.map((item) => item.futureEvidenceNamespace.outputDirectory)).size === 3)
pos("three_isolated_parameter_namespaces", new Set(contract.components.map((item) => item.parameterNamespace)).size === 3)
pos("three_isolated_checkpoint_identities", new Set(contract.components.map((item) => item.futureEvidenceNamespace.checkpointIdentity)).size === 3)
pos("same_package_predecessor_chain", contract.components.every((item) => item.predecessor.sameSmokePackageRequired))
pos("fixed_sample_194_validation", contract.fixedExecutionIdentity.sampleId.includes("slot-194") && contract.fixedExecutionIdentity.sampleSplit === "validation")
pos("fixed_seed_resolution_epochs", contract.fixedExecutionIdentity.seed === 20263722 && contract.fixedExecutionIdentity.resolution.width === 256 && contract.fixedExecutionIdentity.epochCount === 30)
pos("all_future_permissions_false", contract.components.every((item) => !item.futureAuthorizationTemplate.gpuAuthorized && !item.futureAuthorizationTemplate.trainingAuthorized))
pos("stop_on_failure", contract.executionPolicy.stopOnAnyComponentFailure && contract.executionPolicy.unstartedAuthorizationsRemainUnconsumed)
pos("final_role_only_decodes_rgb", contract.components.filter((item) => item.responsibilityBoundary.nativeCompleteRgbOutputAllowed).map((item) => item.roleId).join() === RESPONSIBILITY_ORDER[2])
pos("native_complete_rgb_boundary", contract.finalOutputBoundary.nativeCompleteFrameRequired && contract.finalOutputBoundary.stage2FormalCapability.width === 1024)
pos("no_tile_patch_sprite_or_upscale", !contract.finalOutputBoundary.tileAllowed && !contract.finalOutputBoundary.patchAllowed && !contract.finalOutputBoundary.spriteAllowed && !contract.finalOutputBoundary.lowResolutionUpscaleAllowed)
pos("frozen_data_and_channels", contract.frozen.approvedDatasetCount === 64 && contract.frozen.split.train === 48 && contract.frozen.conditionChannelCount === 23)
pos("compilation_safety_closed", Object.values(contract.currentCompilationSafety).every((value) => value === false))

reject("invalid_run_id_rejected", () => compile({ compilationRunId: "old" }))
reject("role_omission_rejected", () => compile({ supportContract: { ...support, roleOrder: RESPONSIBILITY_ORDER.slice(0, 2) } }))
reject("role_reorder_rejected", () => compile({ supportContract: { ...support, roleOrder: [...RESPONSIBILITY_ORDER].reverse() } }))
reject("qualification_not_success_rejected", () => compile({ qualificationSuccessTerminal: { ...qualificationSuccessTerminal, status: "failed" } }))
reject("qualification_order_swap_rejected", () => compile({ qualificationSuccessTerminal: { ...qualificationSuccessTerminal, executionOrder: [...RESPONSIBILITY_ORDER].reverse() } }))
reject("qualification_namespace_failure_rejected", () => compile({ qualificationSuccessTerminal: { ...qualificationSuccessTerminal, parameterNamespacesPairwiseDistinct: false } }))
reject("qualification_predecessor_failure_rejected", () => compile({ qualificationSuccessTerminal: { ...qualificationSuccessTerminal, samePackagePredecessorLineageVerified: false } }))
reject("active_config_rejected", () => compile({ sourceConfigs: { ...sourceConfigs, [RESPONSIBILITY_ORDER[0]]: { ...sourceConfigs[RESPONSIBILITY_ORDER[0]], status: "active" } } }))
reject("config_role_swap_rejected", () => compile({ sourceConfigs: { ...sourceConfigs, [RESPONSIBILITY_ORDER[0]]: { ...sourceConfigs[RESPONSIBILITY_ORDER[0]], stage4ResponsibilityComponentRole: RESPONSIBILITY_ORDER[1] } } }))
reject("shared_parameters_rejected", () => { const bad = structuredClone(sourceConfigs); bad[RESPONSIBILITY_ORDER[1]].training.stage4IsolatedResponsibilityComponent.sharedTrainableParametersAllowed = true; compile({ sourceConfigs: bad }) })
reject("activation_gate_rejected", () => { const bad = structuredClone(sourceConfigs); bad[RESPONSIBILITY_ORDER[2]].training.stage4IsolatedResponsibilityComponent.activationGate.gpuUseNow = true; compile({ sourceConfigs: bad }) })
reject("cross_run_predecessor_rejected", () => { const bad = structuredClone(contract); bad.components[1].predecessor.crossRunEvidenceAccepted = true; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("historical_output_rejected", () => { const bad = structuredClone(contract); bad.components[2].predecessor.historicalOutputAccepted = true; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("duplicate_run_id_rejected", () => { const bad = structuredClone(contract); bad.components[1].futureAuthorizationTemplate.reservedRunId = bad.components[0].futureAuthorizationTemplate.reservedRunId; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("duplicate_output_directory_rejected", () => { const bad = structuredClone(contract); bad.components[2].futureEvidenceNamespace.outputDirectory = bad.components[1].futureEvidenceNamespace.outputDirectory; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("gpu_authorization_injection_rejected", () => { const bad = structuredClone(contract); bad.components[0].futureAuthorizationTemplate.gpuAuthorized = true; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("smoke_authorization_injection_rejected", () => { const bad = structuredClone(contract); bad.components[0].futureAuthorizationTemplate.smokeAuthorized = true; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("tile_output_rejected", () => { const bad = structuredClone(contract); bad.finalOutputBoundary.tileAllowed = true; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("low_resolution_upscale_rejected", () => { const bad = structuredClone(contract); bad.finalOutputBoundary.lowResolutionUpscaleAllowed = true; validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("component_config_hash_replacement_rejected", () => { const bad = structuredClone(contract); bad.components[0].sourceConfig.sha256 = "0".repeat(64); validateControlledThreeComponentStage0SmokeContract(bad, expected) })
reject("qualification_hash_replacement_rejected", () => { const bad = structuredClone(contract); bad.components[0].readonlyGpuQualification.report.sha256 = "0".repeat(64); validateControlledThreeComponentStage0SmokeContract(bad, expected) })

const report = {
  schemaVersion: "stage4-controlled-three-component-stage0-smoke-contract-compilation-cpu-report-v1",
  status: [...positive, ...negative].every((row) => row.passed) ? "passed" : "failed",
  positive: { passed: positive.filter((row) => row.passed).length, total: positive.length, cases: positive },
  negative: { passed: negative.filter((row) => row.passed).length, total: negative.length, cases: negative },
  safety: { checkpointRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, smokeStarted: false, trainingStarted: false },
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = report.status === "passed" ? 0 : 1
