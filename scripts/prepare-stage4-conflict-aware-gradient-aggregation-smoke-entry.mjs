import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")

const hotRoot = path.resolve("D:/AI-PET-WORLD-DATA/hot/runtime")
const resolve = (value) => {
  const normalized = String(value).replaceAll("\\", "/")
  if (normalized === ".runtime" || normalized.startsWith(".runtime/")) {
    return path.join(hotRoot, normalized === ".runtime" ? "" : normalized.slice(9))
  }
  return path.resolve(root, value)
}
const projectPath = (value) => {
  const absolute = path.resolve(value)
  const relativeHot = path.relative(hotRoot, absolute)
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

const sources = {
  inactiveConfig: ".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/inactive-config.json",
  supportContract: ".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-cpu-implementations/20260822-131808064/training-paradigm-support-contract.json",
  implementationAuthorization: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-conflict-aware-gradient-aggregation-cpu-20260822-131808064/authorization.json",
  implementationConsumption: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-conflict-aware-gradient-aggregation-cpu-20260822-131808064/implementation-consumption.json",
  gpuTerminal: ".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-gpu-qualifications/20260822-132912626/phase-terminal.json",
  gpuReport: ".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-gpu-qualifications/20260822-132912626/gpu-report.json",
  cudaTelemetry: ".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-gpu-qualifications/20260822-132912626/cuda-telemetry.json",
  cpuAuthorizationReport: ".runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-gpu-qualifications/20260822-132912626/cpu-report.json",
}
const expected = {
  inactiveConfig: "f9c7dbc10f31f728034e30722ca13e85d9b6d13e8377fe38a0d661582322c644",
  supportContract: "69248e28e3d906bbac671503cfe4a65abce59d4386c9b7ed5cb040d59b9aac67",
  implementationAuthorization: "055153e414513632da1d1ba6d79e4dce0544504e970bb4d535ba5e62593e3f20",
  implementationConsumption: "e26f6af8e2075a6e49ad7472a4179de348dc763bc861265a00cf7c68aefb333c",
  gpuTerminal: "6adfb823fc28bb034a27da2b1971acef0601be4e5fab46d6c5de705f3958c2ac",
  gpuReport: "f0e0f2d44c9e41e7bea8d878933999f414165aaf177049eb7601bab222f0880f",
  cudaTelemetry: "f93329f219dec1b0ede7d989933cbad6c2c30492798a68e558e2367ed2af9a0b",
  cpuAuthorizationReport: "964001285b2b78070086bd13a2dba0d25e5a4080836e55d39d96d31b011cfe10",
}
for (const [name, value] of Object.entries(sources)) {
  if (!fs.existsSync(resolve(value)) || hash(value) !== expected[name]) throw new Error(`bound source changed:${name}`)
}
const originalAuthorization = read(sources.implementationAuthorization)
const originalConsumption = read(sources.implementationConsumption)
if (
  originalAuthorization.status !== "resolved_owner_authorized_not_consumed"
  || originalConsumption.authorization?.sha256 !== expected.implementationAuthorization
  || originalConsumption.oneTimeConsumption !== true
) throw new Error("source implementation lineage invalid")

const output = `.runtime/ai-painter/stage4-conflict-aware-gradient-aggregation-smoke-entry-integrations/${runId}`
if (fs.existsSync(resolve(output))) throw new Error("smoke entry output already exists")
const resolvedAuthorizationPath = `${output}/resolved-implementation-authorization.json`
const resolvedConsumptionPath = `${output}/resolved-implementation-consumption.json`
writeExclusive(resolvedAuthorizationPath, originalAuthorization)
writeExclusive(resolvedConsumptionPath, {
  schemaVersion: "stage4-conflict-aware-gradient-aggregation-resolved-implementation-consumption-v1",
  status: "resolved_implementation_lineage_consumed",
  requestId: originalAuthorization.requestId,
  commandRef: originalAuthorization.commandRef,
  scope: originalAuthorization.scope,
  authorizationSha256: hash(resolvedAuthorizationPath),
  oneTimeConsumption: true,
  sourceAuthorization: bind(sources.implementationAuthorization),
  sourceConsumption: bind(sources.implementationConsumption),
  resolvedAtUtc: new Date().toISOString(),
})

const config = structuredClone(read(sources.inactiveConfig))
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
  contract.status = name === "stage4FactConditionedSemanticMixture"
    ? "cpu_support_verified_not_active"
    : "cpu_support_verified_inactive"
  if (name === "stage4FactConditionedSemanticMixture") contract.enabled = false
  for (const gate of Object.keys(contract.activationGate)) contract.activationGate[gate] = false
}
training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
training.stage4FailureDiagnostics.trainingConfigApplied = false
training.stage4FailureDiagnostics.checkpointFileReadAuthorized = false
training.stage4FailureDiagnostics.gpuUseAuthorized = false
training.stage4FailureDiagnostics.trainingAuthorized = false
training.ownerTrainingAuthorization = {
  authorizationId: originalAuthorization.requestId,
  requestId: originalAuthorization.requestId,
  commandRef: originalAuthorization.commandRef,
  scope: originalAuthorization.scope,
  authorizationPath: resolvedAuthorizationPath,
  authorizationSha256: hash(resolvedAuthorizationPath),
  executionConsumptionPath: resolvedConsumptionPath,
  executionConsumptionSha256: hash(resolvedConsumptionPath),
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
const objective = training.stage4ConflictAwareExistingGradientAggregation
if (
  objective?.contractId !== "stage4_conflict_aware_existing_gradient_aggregation_v1"
  || objective.status !== "cpu_support_verified_inactive"
  || Object.values(objective.activationGate ?? {}).some(Boolean)
) throw new Error("conflict-aware objective is not exactly inactive")
const inactiveConfig = `${output}/inactive-smoke-config.json`
writeExclusive(inactiveConfig, config)

const canonicalRoot = `${output}/canonical`
const roles = {}
const evidence = {
  "stage4.finalVisibleRgb.gpuQualificationTerminal": sources.gpuTerminal,
  "stage4.finalVisibleRgb.gpuDiagnosticReport": sources.gpuReport,
  "stage4.finalVisibleRgb.cudaTelemetry": sources.cudaTelemetry,
  "stage4.finalVisibleRgb.cpuAuthorizationReport": sources.cpuAuthorizationReport,
  "stage4.finalVisibleRgb.inactiveConfig": inactiveConfig,
  "stage4.finalVisibleRgb.trainingObjectiveSupportContract": sources.supportContract,
}
for (const [role, source] of Object.entries(evidence)) {
  const target = `${canonicalRoot}/${role}-${hash(source)}.json`
  fs.mkdirSync(path.dirname(resolve(target)), { recursive: true })
  fs.copyFileSync(resolve(source), resolve(target), fs.constants.COPYFILE_EXCL)
  roles[role] = {
    disposition: "active_reusable_success_evidence",
    canonicalPath: target,
    sha256: hash(target),
    sourceHistoricalPath: source,
    successTerminal: bind(sources.gpuTerminal),
  }
}
const registry = `${output}/registry.json`
writeExclusive(registry, {
  schemaVersion: "ai-painter-stage4-execution-evidence-eligibility-registry-v1",
  registryId: runId,
  status: "stage4_execution_evidence_eligibility_registered",
  recordedAtUtc: new Date().toISOString(),
  authorization: bind(resolvedAuthorizationPath),
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
  schemaVersion: "stage4-conflict-aware-gradient-aggregation-smoke-entry-registration-terminal-v1",
  status: "stage4_conflict_aware_gradient_aggregation_smoke_entry_inputs_registered_cpu_only",
  runId,
  inactiveConfig: bind(inactiveConfig),
  supportContract: bind(sources.supportContract),
  implementationAuthorization: bind(resolvedAuthorizationPath),
  implementationConsumption: bind(resolvedConsumptionPath),
  executionEvidenceRegistry: bind(registry),
  gpuStarted: false,
  checkpointRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
})
console.log(JSON.stringify({
  status: read(terminal).status,
  inactiveConfig: bind(inactiveConfig),
  registry: bind(registry),
  implementationAuthorization: bind(resolvedAuthorizationPath),
  implementationConsumption: bind(resolvedConsumptionPath),
  terminal: bind(terminal),
}, null, 2))
