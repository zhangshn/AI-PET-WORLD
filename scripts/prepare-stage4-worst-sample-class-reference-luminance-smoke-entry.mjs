import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")

const resolveProject = (value) => {
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
const hash = (value) => createHash("sha256").update(fs.readFileSync(resolveProject(value))).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(resolveProject(value), "utf8"))
const bind = (value) => ({ path: projectPath(resolveProject(value)), sha256: hash(value) })
const writeExclusive = (value, data) => {
  const target = resolveProject(value)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

const implementationRoot = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-worst-sample-class-smoke-lineage-correction-20260817-032755201"
const implementationAuthorization = `${implementationRoot}/authorization.json`
const implementationConsumption = `${implementationRoot}/implementation-consumption.json`
const sourceConfig = ".runtime/ai-painter/stage4-full-rollout-worst-sample-class-reference-luminance-cpu-implementations/20260816-184854191/inactive-config.json"
const sourceSupport = ".runtime/ai-painter/stage4-full-rollout-worst-sample-class-reference-luminance-cpu-implementations/20260816-184854191/training-objective-support-contract.json"
const sourceEvidence = {
  "stage4.finalVisibleRgb.gpuQualificationTerminal": ".runtime/ai-painter/stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-qualifications/20260816-191232766/execution/phase-terminal.json",
  "stage4.finalVisibleRgb.gpuDiagnosticReport": ".runtime/ai-painter/stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-qualifications/20260816-191232766/execution/gpu-qualification-report.json",
  "stage4.finalVisibleRgb.cudaTelemetry": ".runtime/ai-painter/stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-qualifications/20260816-191232766/execution/cuda-telemetry.json",
  "stage4.finalVisibleRgb.cpuAuthorizationReport": ".runtime/ai-painter/stage4-full-rollout-worst-sample-class-reference-luminance-readonly-gpu-qualifications/20260816-190812364/cpu-authorization-report.json",
}
const expected = new Map([
  [sourceConfig, "cbfb638d9d0aa8ef3138aeac521656625a25d99b08e3f4729a85c238dbc34118"],
  [sourceSupport, "0d87fb59c3312ba2e508a46db75516e4daae81b7573bdf452bf3d167e77d019c"],
  [sourceEvidence["stage4.finalVisibleRgb.gpuQualificationTerminal"], "2f8f5fbb420ba20ec3498ee3f895dd8c88f4fbca123ab40895c13e593d3d058a"],
  [sourceEvidence["stage4.finalVisibleRgb.gpuDiagnosticReport"], "530c14bae138a2362ee92755854312a3ea8cf87b89a6d079f2427af619dbd248"],
  [sourceEvidence["stage4.finalVisibleRgb.cudaTelemetry"], "7e340151dc244b3a51b41c4ec33826a0078a057d0a9e4fc2817262f35616cac7"],
  [sourceEvidence["stage4.finalVisibleRgb.cpuAuthorizationReport"], "9bbde7bcbe62bd40d818e31a020b568fbf5aa6c610c1e0bb40d39521e8f3ae18"],
  [implementationAuthorization, "df650b1de64e2b56b319ddb3e92e38f9f3bb8885d67d9d2370c0363a4822f97c"],
])
for (const [file, expectedHash] of expected) {
  if (!fs.existsSync(resolveProject(file)) || hash(file) !== expectedHash) throw new Error(`bound source changed: ${file}`)
}
const implementation = read(implementationAuthorization)
const consumption = read(implementationConsumption)
if (
  implementation.status !== "resolved_owner_authorized_not_consumed"
  || consumption.authorizationSha256 !== hash(implementationAuthorization)
  || consumption.oneTimeConsumption !== true
) throw new Error("implementation authorization lineage invalid")

const output = `.runtime/ai-painter/stage4-worst-sample-class-reference-luminance-smoke-entry-integrations/${runId}`
if (fs.existsSync(resolveProject(output))) throw new Error("smoke entry output already exists")
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
  contract.status = name === "stage4FactConditionedSemanticMixture"
    ? "cpu_support_verified_not_active"
    : "cpu_support_verified_inactive"
  if (name === "stage4FactConditionedSemanticMixture") contract.enabled = false
  for (const key of Object.keys(contract.activationGate)) contract.activationGate[key] = false
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
  authorizationPath: projectPath(resolveProject(implementationAuthorization)),
  authorizationSha256: hash(implementationAuthorization),
  executionConsumptionPath: projectPath(resolveProject(implementationConsumption)),
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
const objective = training.stage4FullRolloutWorstSampleClassReferenceLuminanceObligation
if (
  objective?.contractId !== "stage4_full_rollout_worst_sample_class_reference_luminance_obligation_v1"
  || objective.status !== "cpu_support_verified_inactive"
  || Object.values(objective.activationGate ?? {}).some(Boolean)
) throw new Error("worst-sample-class objective is not inactive")
const diagnostics = training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry
if (Object.hasOwn(diagnostics, "fixedEpochs") || diagnostics.exactFieldCount !== diagnostics.exactFields.length) {
  throw new Error("inactive diagnostic registry invalid")
}

const inactivePath = `${output}/inactive-smoke-config.json`
const supportPath = `${output}/training-objective-support-contract.json`
writeExclusive(inactivePath, config)
writeExclusive(supportPath, {
  schemaVersion: "stage4-worst-sample-class-reference-luminance-smoke-entry-support-v1",
  status: "cpu_support_verified_inactive_smoke_entry",
  trainingObjectiveContractId: objective.contractId,
  sourceSupportContract: bind(sourceSupport),
  readonlyGpuQualificationTerminal: bind(sourceEvidence["stage4.finalVisibleRgb.gpuQualificationTerminal"]),
  readonlyGpuDiagnostic: bind(sourceEvidence["stage4.finalVisibleRgb.gpuDiagnosticReport"]),
  readonlyCpuReport: bind(sourceEvidence["stage4.finalVisibleRgb.cpuAuthorizationReport"]),
  diagnosticManifestFields: diagnostics.exactFields,
  fixedIdentity: { sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6", sampleSplit: "validation", seed: 20263722, topology: "west", resolution: { width: 256, height: 192 }, epochCount: 30, previewEpochs: [1, 5, 10, 20, 30] },
  checkpointReadAuthorized: false,
  gpuUseAuthorized: false,
  trainingAuthorized: false,
})
const canonicalRoot = `${output}/canonical`
const sources = { ...sourceEvidence, "stage4.finalVisibleRgb.inactiveConfig": inactivePath, "stage4.finalVisibleRgb.trainingObjectiveSupportContract": supportPath }
const roles = {}
for (const [role, source] of Object.entries(sources)) {
  const identity = hash(source)
  const target = `${canonicalRoot}/${role}-${identity}.json`
  fs.mkdirSync(path.dirname(resolveProject(target)), { recursive: true })
  fs.copyFileSync(resolveProject(source), resolveProject(target), fs.constants.COPYFILE_EXCL)
  roles[role] = { disposition: "active_reusable_success_evidence", canonicalPath: projectPath(resolveProject(target)), sha256: identity, sourceHistoricalPath: projectPath(resolveProject(source)), successTerminal: bind(sourceEvidence["stage4.finalVisibleRgb.gpuQualificationTerminal"]) }
}
const registryPath = `${output}/registry.json`
writeExclusive(registryPath, {
  schemaVersion: "ai-painter-stage4-execution-evidence-eligibility-registry-v1",
  registryId: runId,
  status: "stage4_execution_evidence_eligibility_registered",
  recordedAtUtc: new Date().toISOString(),
  authorization: bind(implementationAuthorization),
  policy: { executionRequiresCanonicalPath: true, sha256AloneNeverSelectsEvidence: true, siblingPathInferenceForbidden: true, failedExitedPartialSupersededExecutionUseAllowed: false, historicalAnalysisReadAllowed: true, ambiguousResolutionFailsClosed: true, unknownTerminalStatusFailsClosed: true },
  roles,
  historical: [],
})
const terminalPath = `${output}/registration-terminal.json`
writeExclusive(terminalPath, { schemaVersion: "stage4-worst-sample-class-reference-luminance-smoke-entry-terminal-v1", status: "stage4_worst_sample_class_reference_luminance_smoke_entry_inputs_registered_cpu_only", runId, inactiveConfig: bind(inactivePath), supportContract: bind(supportPath), executionEvidenceRegistry: bind(registryPath), gpuStarted: false, checkpointRead: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false })
console.log(JSON.stringify({ status: read(terminalPath).status, inactiveConfig: bind(inactivePath), supportContract: bind(supportPath), executionEvidenceRegistry: bind(registryPath), terminal: bind(terminalPath) }, null, 2))
