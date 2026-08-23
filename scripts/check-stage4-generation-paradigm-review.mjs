import assert from "node:assert/strict"
import { DECISIONS, STAGED_PHASES, reviewGenerationParadigm, validateStagedParadigmContract } from "./lib/ai-painter-stage4-generation-paradigm-review.mjs"

const terminal = (resource = true) => ({ status: "semantic_mixture_stage4_formal_stage_failed_closed", stage: 0, machineReview: { passCount: 0, failCount: 6 }, resourceTelemetry: resource ? { peakGpuMemoryBytes: 4_000_000_000 } : null })
const input = () => ({
  businessSpecText: "根据WorldFacts、VisualFactManifest及23通道条件生成可审核完整地图",
  formalSpecText: "原生输出为 `1024×768`，不得由低分辨率、局部图、tile 或 sprite 放大或拼接获得。模型体系可以由多个自研模块组成，但只有一条正式完整世界训练与推理主线。训练可以按 `256×192 -> 512×384 -> 1024×768` 渐进执行。",
  worldContract: { worldAndDynamicReadiness: { conditionChannelCount: 23, rgbCannotReplaceStructuredWorldFacts: true }, fullWorldFrame: { worldMustFillRectangularFrameEdgeToEdge: true } },
  original64Terminal: { original64ContractSatisfied: true, dataDefectProven: false }, autoencoderTerminal: { selectedDecision: "frozen_autoencoder_semantic_retention_sufficient" }, gradientTerminal: { selectedDecision: "current_training_gradient_interference_gap_confirmed" }, baselineTerminal: terminal(), conditionFusionTerminal: terminal(), capacityTerminal: terminal(),
  crossArmTerminal: { outcome: "condition_fusion_only_priority" }, crossArmReport: { facts: { bothSmokesNaturallyCompleted: true, bothLateStabilityQualified: true, bothTerminalEpoch30Passed: true, trainingPeakGpuTelemetryPersistedForBothArms: true }, fusion: { resourceTelemetry: { present: true } }, capacity: { resourceTelemetry: { present: true } } },
  capacityBestReview: { passed: false, issueCodes: ["condition_terrain_path_ground_required_boundary_contact_missing", "condition_object_tree_reference_semantic_mismatch", "condition_object_vegetation_reference_semantic_mismatch"] }, routeExitTerminal: { status: "capacity_structure_route_exited_project_level_owner_decision_required" },
})
const contract = () => ({ status: "cpu_supported_inactive", phases: STAGED_PHASES.map((id) => ({ id })), businessInvariants: { businessGoalChanged: false, worldFactsRemainAuthoritative: true, conditionChannelCount: 23, finalOutput: { width: 1024, height: 768, nativeCompleteFrame: true }, tilePatchOrSpriteAssemblyAllowed: false }, activationGate: { cpuSupportOnly: true, gpu: false, training: false, inference: false, runtimeFrame: false, world: false }, freeParametersAllowed: false })
const positives = [], negatives = []
assert.equal(reviewGenerationParadigm(input()).selectedDecision, DECISIONS.B); positives.push("selects_staged_paradigm_from_exact_evidence")
validateStagedParadigmContract(contract()); positives.push("accepts_exact_inactive_staged_contract")
for (const [name, mutate] of [
  ["rejects_business_goal_change", (v) => { v.businessSpecText = "image only" }],
  ["rejects_multi_module_contract_missing", (v) => { v.formalSpecText = v.formalSpecText.replace("模型体系可以由多个自研模块组成，但只有一条正式完整世界训练与推理主线。", "") }],
  ["rejects_native_frame_contract_missing", (v) => { v.formalSpecText = v.formalSpecText.replace("原生输出为 `1024×768`，不得由低分辨率、局部图、tile 或 sprite 放大或拼接获得。", "") }],
  ["rejects_condition_count_change", (v) => { v.worldContract.worldAndDynamicReadiness.conditionChannelCount = 24 }],
  ["rejects_rgb_replacing_worldfacts", (v) => { v.worldContract.worldAndDynamicReadiness.rgbCannotReplaceStructuredWorldFacts = false }],
  ["rejects_data_defect_injection", (v) => { v.original64Terminal.dataDefectProven = true }],
  ["rejects_autoencoder_gap_substitution", (v) => { v.autoencoderTerminal.selectedDecision = "gap" }],
  ["rejects_baseline_success_substitution", (v) => { v.baselineTerminal.machineReview.passCount = 6 }],
  ["rejects_condition_fusion_success_substitution", (v) => { v.conditionFusionTerminal.status = "success" }],
  ["rejects_capacity_success_substitution", (v) => { v.capacityTerminal.machineReview.failCount = 0 }],
  ["rejects_smoke_noncompletion", (v) => { v.crossArmReport.facts.bothSmokesNaturallyCompleted = false }],
  ["rejects_resource_evidence_missing", (v) => { v.capacityTerminal.resourceTelemetry = null }],
  ["rejects_route_not_exited", (v) => { v.routeExitTerminal.status = "active" }],
]) { const value = input(); mutate(value); assert.throws(() => reviewGenerationParadigm(value)); negatives.push(name) }
for (const [name, mutate] of [
  ["rejects_phase_omission", (v) => { v.phases.pop() }],
  ["rejects_phase_reorder", (v) => { v.phases.reverse() }],
  ["rejects_non_native_output", (v) => { v.businessInvariants.finalOutput.width = 512 }],
  ["rejects_tile_assembly", (v) => { v.businessInvariants.tilePatchOrSpriteAssemblyAllowed = true }],
  ["rejects_training_activation", (v) => { v.activationGate.training = true }],
  ["rejects_free_parameters", (v) => { v.freeParametersAllowed = true }],
]) { const value = contract(); mutate(value); assert.throws(() => validateStagedParadigmContract(value)); negatives.push(name) }
console.log(JSON.stringify({ schemaVersion: "stage4-generation-paradigm-review-cpu-report-v1", status: "passed", positivePassed: positives.length, positiveTotal: positives.length, negativePassed: negatives.length, negativeTotal: negatives.length, positives, negatives, executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, modelImplemented: false, businessGoalChanged: false } }, null, 2))
