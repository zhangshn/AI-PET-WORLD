import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
const epochCompleteSelectorMode = process.argv.includes("--epoch-complete-selector")
const epochCompleteReferenceFeatureSharedReplayMode = process.argv.includes("--epoch-complete-reference-feature-shared-replay")
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")

const resolve = (value) => {
  const normalized = String(value).replaceAll("\\", "/")
  if (normalized === ".runtime" || normalized.startsWith(".runtime/")) {
    const suffix = normalized === ".runtime" ? "" : normalized.slice(9)
    return path.join("D:/AI-PET-WORLD-DATA/hot/runtime", suffix)
  }
  return path.resolve(root, value)
}
const projectPath = (value) => {
  const absolute = path.resolve(value)
  const hot = path.resolve("D:/AI-PET-WORLD-DATA/hot/runtime")
  const relativeHot = path.relative(hot, absolute)
  if (relativeHot === "" || (!relativeHot.startsWith("..") && !path.isAbsolute(relativeHot))) {
    return relativeHot ? `.runtime/${relativeHot.replaceAll("\\", "/")}` : ".runtime"
  }
  return path.relative(root, absolute).replaceAll("\\", "/")
}
const hash = (value) => createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(resolve(value), "utf8"))
const bind = (value) => ({ path: projectPath(resolve(value)), sha256: hash(value) })
const writeExclusive = (value, data) => {
  const target = resolve(value)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

const sourceConfig = epochCompleteReferenceFeatureSharedReplayMode
  ? ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/inactive-config.json"
  : epochCompleteSelectorMode
  ? ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/inactive-config.json"
  : ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-implementations/20260821-051855146/inactive-config.json"
const sourceSupport = epochCompleteReferenceFeatureSharedReplayMode
  ? ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/20260822-072101387/training-objective-support-contract.json"
  : epochCompleteSelectorMode
  ? ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/training-objective-support-contract.json"
  : ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-implementations/20260821-051855146/training-objective-support-contract.json"
const implementationAuthorization = epochCompleteReferenceFeatureSharedReplayMode
  ? ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-20260822-072101387/implementation-authorization.json"
  : epochCompleteSelectorMode
  ? ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-20260821-092701121/implementation-authorization.json"
  : ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-20260821-051855146/implementation-authorization.json"
const implementationConsumption = epochCompleteReferenceFeatureSharedReplayMode
  ? ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-20260822-072101387/implementation-consumption.json"
  : epochCompleteSelectorMode
  ? ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-20260821-092701121/implementation-consumption.json"
  : ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-structure-cpu-20260821-051855146/implementation-consumption.json"
const evidence = epochCompleteReferenceFeatureSharedReplayMode ? {
  "stage4.finalVisibleRgb.gpuQualificationTerminal": ".runtime/ai-painter/stage4-reference-feature-shared-replay-readonly-gpu-qualifications/20260822-082601227/phase-terminal.json",
  "stage4.finalVisibleRgb.gpuDiagnosticReport": ".runtime/ai-painter/stage4-reference-feature-shared-replay-readonly-gpu-qualifications/20260822-082601227/gpu-qualification-report.json",
  "stage4.finalVisibleRgb.cudaTelemetry": ".runtime/ai-painter/stage4-reference-feature-shared-replay-readonly-gpu-qualifications/20260822-082601227/cuda-telemetry.json",
  "stage4.finalVisibleRgb.cpuAuthorizationReport": ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-reference-feature-shared-replay-readonly-gpu-20260822-082601227/cpu-entry-report.json",
} : epochCompleteSelectorMode ? {
  "stage4.finalVisibleRgb.gpuQualificationTerminal": ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-qualifications/20260821-101400431/phase-terminal.json",
  "stage4.finalVisibleRgb.gpuDiagnosticReport": ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-qualifications/20260821-101400431/gpu-qualification-report.json",
  "stage4.finalVisibleRgb.cudaTelemetry": ".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-qualifications/20260821-101400431/cuda-telemetry.json",
  "stage4.finalVisibleRgb.cpuAuthorizationReport": ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-epoch-complete-per-class-worst-luminance-readonly-gpu-20260821-101400431/cpu-entry-report.json",
} : {
  "stage4.finalVisibleRgb.gpuQualificationTerminal": ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-readonly-gpu-qualifications/20260821-054300000/phase-terminal.json",
  "stage4.finalVisibleRgb.gpuDiagnosticReport": ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-readonly-gpu-qualifications/20260821-054300000/gpu-qualification-report.json",
  "stage4.finalVisibleRgb.cudaTelemetry": ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-readonly-gpu-qualifications/20260821-054300000/cuda-telemetry.json",
  "stage4.finalVisibleRgb.cpuAuthorizationReport": ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-gpu-entry-cpu-checks/20260821-054209749/cpu-report.json",
}
const expected = new Map(epochCompleteReferenceFeatureSharedReplayMode ? [
  [sourceConfig, "323a3a14bf0269bda101b8e7719fc9bc5d68ebde9e5b2dd7977f3789f2942976"],
  [sourceSupport, "69dc31cca4cddc04d1e695c3d48a5af8e2443dbb6ce1cc0085c5dd2b536c7c47"],
  [implementationAuthorization, "e022f4339324ae3a3f64e5548072f42fb2ce6d754d38d73351cf8079eaf62f0a"],
  [implementationConsumption, "89910f60d0a219e418f15a048a47cf48a0549c3284fcde1171d097d044b5246c"],
  [evidence["stage4.finalVisibleRgb.gpuQualificationTerminal"], "b6d93104f3aa8a2c3d70ed7fb1fff647a6d3a2207c4e6fc59aeb844db853a614"],
  [evidence["stage4.finalVisibleRgb.gpuDiagnosticReport"], "87af3d7a692aa89dc372648263d8f28b6d50720993ca96a1af7d835fb5361e2f"],
  [evidence["stage4.finalVisibleRgb.cudaTelemetry"], "fe32a8c9e27165d2efe841c18f805c47e672c4e090d3356969a4ab5c971990ba"],
  [evidence["stage4.finalVisibleRgb.cpuAuthorizationReport"], "3910636b6847097f01e9a43d979b4e4a57f39f471f11611d7ad7e16ee447ef4b"],
] : epochCompleteSelectorMode ? [
  [sourceConfig, "2945c28e537f417437a3164c32625967882b3c06774a7407d60499c7b3aaf53a"],
  [sourceSupport, "d0618b9679431951208b2ba4427d3f2c8d118524c2e6f682130f936ac5c74c85"],
  [implementationAuthorization, "91cfb1b6ee64d314461a201d8f398d5213f368ae6a08fc7e9a4327a44ed6456f"],
  [implementationConsumption, "0e43811d82f6fca40a7208ea209a57e3fe366d776089d0e8d4a074e8786fe3b1"],
  [evidence["stage4.finalVisibleRgb.gpuQualificationTerminal"], "9cee5b3adbda028b672cfcb87ab5b5ce38addbb524b266fffa3769776fd5c9a6"],
  [evidence["stage4.finalVisibleRgb.gpuDiagnosticReport"], "6ab3392c6309a8cbe69cfbb61c0e02ece30e6d97d110b90db03f0690606bf652"],
  [evidence["stage4.finalVisibleRgb.cudaTelemetry"], "5cda8e185d9bedbead0f9a4a5c31550cb66f4d488769128cbadb542ea4f783c6"],
  [evidence["stage4.finalVisibleRgb.cpuAuthorizationReport"], "a4e60e2cfc8374d3673ebc9612308dddf7269eccafa3539c8f880c1d2b47d430"],
] : [
  [sourceConfig, "886ed53287c1d384d13d94c0aa3fbe224eb5228febe65f36580bec8012373ad4"],
  [sourceSupport, "8d1d8e1e635f542ed4a2bb3d741acdf5aca91dd3fdd195860b65f37e7cec23aa"],
  [implementationAuthorization, "1040a6bd3402c8e184710391d72cbfb739bd10808a28e058625349b99ff8d3c4"],
  [implementationConsumption, "4effd0f53db14f6ed519d105a03f0143278c26554654110dae88275754213ea6"],
  [evidence["stage4.finalVisibleRgb.gpuQualificationTerminal"], "694fca7ce21cdf5936ccd6ead878fbbf9bf2df381542ee374acc5eb09aa9ac11"],
  [evidence["stage4.finalVisibleRgb.gpuDiagnosticReport"], "b0ee905c371a7ce09ed906b7dd48a47463e5ddc5e2a6ef626d81de3ea6a8aa37"],
  [evidence["stage4.finalVisibleRgb.cudaTelemetry"], "ffe3b41133a878551b4b9898681fa9e2caaad7732a623f7fa6af745879a9ba4e"],
  [evidence["stage4.finalVisibleRgb.cpuAuthorizationReport"], "9e7ed5522b86d680b6767d431526025dd479f3979a86b8c855effdb946ca6929"],
])
for (const [file, expectedHash] of expected) {
  if (!fs.existsSync(resolve(file)) || hash(file) !== expectedHash) throw new Error(`bound source changed: ${file}`)
}
const implementation = read(implementationAuthorization)
const consumption = read(implementationConsumption)
if (implementation.status !== "resolved_owner_authorized_not_consumed" || consumption.authorizationSha256 !== hash(implementationAuthorization) || consumption.oneTimeConsumption !== true) {
  throw new Error("implementation lineage invalid")
}

const output = epochCompleteReferenceFeatureSharedReplayMode
  ? `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-smoke-entry-integrations/${runId}`
  : epochCompleteSelectorMode
  ? `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-selection-smoke-entry-integrations/${runId}`
  : `.runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-smoke-entry-integrations/${runId}`
if (fs.existsSync(resolve(output))) throw new Error("smoke entry output already exists")
const config = structuredClone(read(sourceConfig))
const training = config.training
training.trainingAuthorizationStatus = "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
training.denoiserEpochs = 30
delete training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs
delete training.factConditionedSemanticMixtureStage4FullTrainingContract
delete training.factConditionedSemanticMixtureStage4SingleSampleSmokeContract
delete training.factConditionedSemanticMixtureStage4SmokeExecution
delete training.stage4UnifiedTrainingPreviewSamplingContract
for (const [name, contract] of Object.entries(training)) {
  if (!contract || typeof contract !== "object" || !contract.activationGate) continue
  contract.status = name === "stage4FactConditionedSemanticMixture" ? "cpu_support_verified_not_active" : "cpu_support_verified_inactive"
  if (name === "stage4FactConditionedSemanticMixture") contract.enabled = false
  for (const gate of Object.keys(contract.activationGate)) contract.activationGate[gate] = false
}
training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
training.stage4FailureDiagnostics.trainingConfigApplied = false
training.stage4FailureDiagnostics.checkpointFileReadAuthorized = false
training.stage4FailureDiagnostics.gpuUseAuthorized = false
training.stage4FailureDiagnostics.trainingAuthorized = false
training.ownerTrainingAuthorization = {
  authorizationId: implementation.requestId,
  requestId: implementation.requestId,
  commandRef: implementation.commandRef,
  scope: implementation.scope,
  authorizationPath: implementationAuthorization,
  authorizationSha256: hash(implementationAuthorization),
  executionConsumptionPath: implementationConsumption,
  executionConsumptionSha256: hash(implementationConsumption),
  executionState: "consumed",
  status: "not_authorized_cpu_support_only",
  checkpointLoadingAuthorized: false,
  optimizerCreationAuthorized: false,
  backwardExecutionAuthorized: false,
  modelWeightMutationAuthorized: false,
  gpuTrainingAuthorizedNow: false,
  singleSampleGpuOverfitSmokeAuthorized: false,
  fullTrainingAuthorized: false,
  stage1Authorized: false,
  stage2Authorized: false,
  strictRevalidationAuthorized: false,
  validationAuthorized: false,
  formalInferenceAuthorized: false,
  checkpointPromotionAuthorized: false,
  runtimeFrameAuthorized: false,
  worldEntryAuthorized: false,
  automaticRetryAuthorized: false,
}
const objective = epochCompleteReferenceFeatureSharedReplayMode
  ? training.stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay
  : epochCompleteSelectorMode
  ? training.stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity
  : training.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation
const objectiveId = epochCompleteReferenceFeatureSharedReplayMode
  ? "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1"
  : epochCompleteSelectorMode
  ? "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1"
  : "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1"
if (objective?.contractId !== objectiveId || objective.status !== "cpu_support_verified_inactive" || Object.values(objective.activationGate ?? {}).some(Boolean)) {
  throw new Error("new objective is not exactly inactive")
}
const inactiveConfig = `${output}/inactive-smoke-config.json`
writeExclusive(inactiveConfig, config)

const canonicalRoot = `${output}/canonical`
const roles = {}
for (const [role, source] of Object.entries({
  ...evidence,
  "stage4.finalVisibleRgb.inactiveConfig": inactiveConfig,
  "stage4.finalVisibleRgb.trainingObjectiveSupportContract": sourceSupport,
})) {
  const target = `${canonicalRoot}/${role}-${hash(source)}.json`
  fs.mkdirSync(path.dirname(resolve(target)), { recursive: true })
  fs.copyFileSync(resolve(source), resolve(target), fs.constants.COPYFILE_EXCL)
  roles[role] = {
    disposition: "active_reusable_success_evidence",
    canonicalPath: target,
    sha256: hash(target),
    sourceHistoricalPath: source,
    successTerminal: bind(evidence["stage4.finalVisibleRgb.gpuQualificationTerminal"]),
  }
}
const registry = `${output}/registry.json`
writeExclusive(registry, {
  schemaVersion: "ai-painter-stage4-execution-evidence-eligibility-registry-v1",
  registryId: runId,
  status: "stage4_execution_evidence_eligibility_registered",
  recordedAtUtc: new Date().toISOString(),
  authorization: bind(implementationAuthorization),
  policy: {
    executionRequiresCanonicalPath: true,
    sha256AloneNeverSelectsEvidence: true,
    siblingPathInferenceForbidden: true,
    failedExitedPartialSupersededExecutionUseAllowed: false,
    historicalAnalysisReadAllowed: true,
    ambiguousResolutionFailsClosed: true,
    unknownTerminalStatusFailsClosed: true,
  },
  roles,
  historical: [],
})
const terminal = `${output}/registration-terminal.json`
writeExclusive(terminal, {
  schemaVersion: epochCompleteReferenceFeatureSharedReplayMode
    ? "stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-smoke-entry-registration-terminal-v1"
    : epochCompleteSelectorMode
    ? "stage4-epoch-complete-per-class-worst-luminance-selection-smoke-entry-registration-terminal-v1"
    : "stage4-per-class-worst-sample-final-visible-luminance-structure-smoke-entry-registration-terminal-v1",
  status: epochCompleteReferenceFeatureSharedReplayMode
    ? "stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_smoke_entry_inputs_registered_cpu_only"
    : epochCompleteSelectorMode
    ? "stage4_epoch_complete_per_class_worst_luminance_selection_smoke_entry_inputs_registered_cpu_only"
    : "stage4_per_class_worst_sample_final_visible_luminance_structure_smoke_entry_inputs_registered_cpu_only",
  runId,
  inactiveConfig: bind(inactiveConfig),
  supportContract: bind(sourceSupport),
  executionEvidenceRegistry: bind(registry),
  gpuStarted: false,
  checkpointRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
})
console.log(JSON.stringify({ status: read(terminal).status, inactiveConfig: bind(inactiveConfig), registry: bind(registry), terminal: bind(terminal) }, null, 2))
