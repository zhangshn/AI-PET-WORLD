import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"


const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const implementationRoot = path.join(
  root,
  ".runtime/ai-painter/owner-action-requests/",
  "owner-authorized-stage4-full-rollout-per-class-luminance-lineage-fix-and-smoke-20260816-113300000",
)
const implementationAuthorization = path.join(implementationRoot, "implementation-authorization.json")
const implementationConsumption = path.join(implementationRoot, "implementation-consumption.json")
const sourceConfig = path.join(
  root,
  ".runtime/ai-painter/stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-implementations/",
  "20260816-102705477/inactive-config.json",
)
const sourceSupport = path.join(
  root,
  ".runtime/ai-painter/stage4-full-rollout-per-class-final-visible-luminance-structure-cpu-implementations/",
  "20260816-102705477/training-objective-support-contract.json",
)
const sourceEvidence = {
  "stage4.finalVisibleRgb.gpuQualificationTerminal": path.join(
    root,
    ".runtime/ai-painter/stage4-full-rollout-per-class-final-visible-luminance-structure-readonly-gpu-qualifications/",
    "20260816-105500000/execution/phase-terminal.json",
  ),
  "stage4.finalVisibleRgb.gpuDiagnosticReport": path.join(
    root,
    ".runtime/ai-painter/stage4-full-rollout-per-class-final-visible-luminance-structure-readonly-gpu-qualifications/",
    "20260816-105500000/execution/gpu-qualification-report.json",
  ),
  "stage4.finalVisibleRgb.cudaTelemetry": path.join(
    root,
    ".runtime/ai-painter/stage4-full-rollout-per-class-final-visible-luminance-structure-readonly-gpu-qualifications/",
    "20260816-105500000/execution/cuda-telemetry.json",
  ),
  "stage4.finalVisibleRgb.cpuAuthorizationReport": path.join(
    root,
    ".runtime/ai-painter/stage4-full-rollout-per-class-final-visible-luminance-structure-readonly-gpu-qualifications/",
    "20260816-105400000/cpu-authorization-report.json",
  ),
}
const expectedHashes = {
  [sourceConfig]: "ac55695ae0cc69e1971fc8aae9286149b672534685c34707793e19dd5019e81a",
  [sourceSupport]: "c4dd2c38b220baa7729675e446b597794672a85e27859d082ff6882bfcf370c3",
  [sourceEvidence["stage4.finalVisibleRgb.gpuQualificationTerminal"]]: "aa93e514b17194e7e5df6c44cd966ad7bdb41930c8598dc25a60dbcddaf90987",
  [sourceEvidence["stage4.finalVisibleRgb.gpuDiagnosticReport"]]: "72e060bef009c36a504386d77c9df2ca0b2f0e5b8fb1f430bd2ff563913dc189",
  [sourceEvidence["stage4.finalVisibleRgb.cudaTelemetry"]]: "e92c583632ecff29aadef8409ea56e89327e8249d323efbf939ff6b66c240e3f",
  [sourceEvidence["stage4.finalVisibleRgb.cpuAuthorizationReport"]]: "24ce5cce866a55328907c8fbe8af5239eb3340686ba1b02b3743a91d071efa90",
  [implementationAuthorization]: "1d76d23b7c7e1b8a522a8e8f9bcacf0b2e068e4cdaf4fc9e04927c93568031fb",
}
const output = path.join(
  root,
  ".runtime/ai-painter/stage4-full-rollout-per-class-luminance-smoke-entry-integrations",
  runId,
)
if (fs.existsSync(output)) throw new Error("smoke entry output already exists")

const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const relative = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: relative(file), sha256: hash(file) })
const writeExclusive = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" })
}
for (const [file, expected] of Object.entries(expectedHashes)) {
  if (!fs.existsSync(file) || hash(file) !== expected) throw new Error(`bound source changed: ${relative(file)}`)
}
const authorization = read(implementationAuthorization)
const consumption = read(implementationConsumption)
if (
  authorization.status !== "resolved_owner_authorized_not_consumed"
  || consumption.authorizationSha256 !== hash(implementationAuthorization)
  || consumption.oneTimeConsumption !== true
) throw new Error("implementation authorization lineage invalid")

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
  for (const gate of Object.keys(contract.activationGate)) contract.activationGate[gate] = false
}
training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
training.stage4FailureDiagnostics.trainingConfigApplied = false
training.stage4FailureDiagnostics.checkpointFileReadAuthorized = false
training.stage4FailureDiagnostics.gpuUseAuthorized = false
training.stage4FailureDiagnostics.trainingAuthorized = false
training.ownerTrainingAuthorization = {
  authorizationId: authorization.requestId,
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: relative(implementationAuthorization),
  authorizationSha256: hash(implementationAuthorization),
  executionConsumptionPath: relative(implementationConsumption),
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
const objective = training.stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation
if (
  objective?.contractId !== "stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_v1"
  || objective.status !== "cpu_support_verified_inactive"
  || Object.values(objective.activationGate ?? {}).some(Boolean)
) throw new Error("new full-rollout per-class objective is not inactive")
const registryFields = training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry
if (
  Object.hasOwn(registryFields, "fixedEpochs")
  || registryFields.exactFieldCount !== registryFields.exactFields.length
  || new Set(registryFields.exactFields).size !== registryFields.exactFields.length
) throw new Error("inactive diagnostic registry invalid")

const inactivePath = path.join(output, "inactive-smoke-config.json")
const supportPath = path.join(output, "training-objective-support-contract.json")
writeExclusive(inactivePath, config)
writeExclusive(supportPath, {
  schemaVersion: "stage4-full-rollout-per-class-luminance-smoke-entry-support-v1",
  status: "cpu_support_verified_inactive_smoke_entry",
  trainingObjectiveContractId: objective.contractId,
  sourceSupportContract: bind(sourceSupport),
  readonlyGpuQualificationTerminal: bind(sourceEvidence["stage4.finalVisibleRgb.gpuQualificationTerminal"]),
  readonlyGpuDiagnostic: bind(sourceEvidence["stage4.finalVisibleRgb.gpuDiagnosticReport"]),
  readonlyCpuReport: bind(sourceEvidence["stage4.finalVisibleRgb.cpuAuthorizationReport"]),
  diagnosticManifestFields: registryFields.exactFields,
  fixedIdentity: {
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation",
    seed: 20263722,
    topology: "west",
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: [1, 5, 10, 20, 30],
  },
  checkpointReadAuthorized: false,
  gpuUseAuthorized: false,
  trainingAuthorized: false,
})

const canonicalRoot = path.join(output, "canonical")
fs.mkdirSync(canonicalRoot, { recursive: true })
const roles = {}
const sources = {
  ...sourceEvidence,
  "stage4.finalVisibleRgb.inactiveConfig": inactivePath,
  "stage4.finalVisibleRgb.trainingObjectiveSupportContract": supportPath,
}
for (const [role, source] of Object.entries(sources)) {
  const identity = hash(source)
  const target = path.join(canonicalRoot, `${role}-${identity}.json`)
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL)
  roles[role] = {
    disposition: "active_reusable_success_evidence",
    canonicalPath: relative(target),
    sha256: identity,
    sourceHistoricalPath: relative(source),
    successTerminal: bind(sourceEvidence["stage4.finalVisibleRgb.gpuQualificationTerminal"]),
  }
}
const registryPath = path.join(output, "registry.json")
writeExclusive(registryPath, {
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
const terminalPath = path.join(output, "registration-terminal.json")
writeExclusive(terminalPath, {
  schemaVersion: "stage4-full-rollout-per-class-luminance-smoke-entry-registration-terminal-v1",
  status: "stage4_full_rollout_per_class_luminance_smoke_entry_inputs_registered_cpu_only",
  runId,
  inactiveConfig: bind(inactivePath),
  supportContract: bind(supportPath),
  executionEvidenceRegistry: bind(registryPath),
  gpuStarted: false,
  checkpointRead: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
})
console.log(JSON.stringify({
  status: read(terminalPath).status,
  inactiveConfig: bind(inactivePath),
  supportContract: bind(supportPath),
  executionEvidenceRegistry: bind(registryPath),
  terminal: bind(terminalPath),
}, null, 2))
