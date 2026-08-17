import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const integrationRunId = process.argv[2]
const smokeRunId = process.argv[3]
if (!/^[0-9]{8}-[0-9]{9}$/.test(integrationRunId ?? "") || !/^[0-9]{8}-[0-9]{9}$/.test(smokeRunId ?? "")) {
  throw new Error("integrationRunId and smokeRunId are required")
}
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

const integration = `.runtime/ai-painter/stage4-worst-sample-class-reference-luminance-smoke-entry-integrations/${integrationRunId}`
const inactiveConfig = `${integration}/inactive-smoke-config.json`
const registryPath = `${integration}/registry.json`
const cpuReport = `${integration}/cpu-report.json`
const implementationRoot = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-worst-sample-class-smoke-lineage-correction-20260817-032755201"
const implementationAuthorization = `${implementationRoot}/authorization.json`
const implementationConsumption = `${implementationRoot}/implementation-consumption.json`
for (const file of [inactiveConfig, registryPath, cpuReport, implementationAuthorization, implementationConsumption]) {
  if (!fs.existsSync(resolveProject(file))) throw new Error(`bound source missing: ${file}`)
}
const cpu = read(cpuReport)
if (
  cpu.status !== "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed"
  || cpu.positivePassed !== cpu.positiveTotal
  || cpu.negativePassed !== cpu.negativeTotal
) throw new Error("CPU regression is not a complete pass")
const implementation = read(implementationAuthorization)
const implementationConsumed = read(implementationConsumption)
if (
  implementation.status !== "resolved_owner_authorized_not_consumed"
  || implementationConsumed.authorizationSha256 !== hash(implementationAuthorization)
  || implementationConsumed.oneTimeConsumption !== true
) throw new Error("implementation lineage invalid")

const registry = read(registryPath)
const role = (name) => {
  const value = registry.roles?.[name]
  if (registry.status !== "stage4_execution_evidence_eligibility_registered" || value?.disposition !== "active_reusable_success_evidence") {
    throw new Error(`canonical role is not eligible: ${name}`)
  }
  return bind(value.canonicalPath)
}
const requestId = `owner-authorized-stage4-worst-sample-class-reference-luminance-30-epoch-model-smoke-${smokeRunId}`
const authorizationRoot = `.runtime/ai-painter/owner-action-requests/${requestId}`
const attestationPath = `${authorizationRoot}/implementation-attestation.json`
const authorizationPath = `${authorizationRoot}/gpu-execution-authorization.json`
const code = {
  authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
  executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py",
  modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
  cpuChecker: "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py",
  model: "ml/ai-painter/src/ai_painter/complete_world/model.py",
  inactiveConfigCompiler: "ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py",
}
writeExclusive(attestationPath, {
  schemaVersion: "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-implementation-attestation-v1",
  status: "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified",
  requestId,
  cpuReportPath: projectPath(resolveProject(cpuReport)),
  cpuReportSha256: hash(cpuReport),
  runnerSha256: hash(code.runner),
  trainerSha256: hash(code.trainer),
  cpuCheckerSha256: hash(code.cpuChecker),
  modeRegistrySha256: hash(code.modeRegistry),
  gpuStarted: false,
  trainingStarted: false,
})

const config = read(inactiveConfig)
const diagnosticFields = config.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.exactFields
const datasetManifest = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const datasetSourceIndex = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
const autoencoder = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
const executionRoot = `.runtime/ai-painter/stage4-worst-sample-class-reference-luminance-smokes/${smokeRunId}`
const executionActions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"]
const explicitlyDeniedActions = ["automatic_retry", "create_runtime_frame", "enter_world", "load_parent_denoiser", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "write_diagnostic_checkpoint"]
writeExclusive(authorizationPath, {
  schemaVersion: "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1",
  requestId,
  commandRef: requestId,
  scope: "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only",
  status: "resolved_owner_authorized_not_consumed",
  executionActions,
  explicitlyDeniedActions,
  taskIdentity: {
    modeId: "fact_conditioned_semantic_mixture_stage4_smoke",
    architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
    trainingObjectiveContractId: "stage4_full_rollout_worst_sample_class_reference_luminance_obligation_v1",
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation",
    seed: 20263722,
    requiredBoundarySides: ["west"],
    resolution: { width: 256, height: 192 },
    epochCount: 30,
    previewEpochs: [1, 5, 10, 20, 30],
    datasetSplit: { train: 48, validation: 8, challenge: 4, regression: 4 },
    initialization: "project_random_fact_conditioned_semantic_mixture",
    oldDenoiserCheckpointReadAuthorized: false,
    diagnosticCheckpointReadAuthorized: false,
    evidenceEligibilityContractId: "stage4_execution_evidence_eligibility_v1",
    objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    pyramidScales: [1, 0.5, 0.25],
    diagnosticManifestFields: diagnosticFields,
  },
  bindings: {
    implementationAuthorization: bind(implementationAuthorization),
    implementationConsumption: bind(implementationConsumption),
    readonlyGpuTerminal: role("stage4.finalVisibleRgb.gpuQualificationTerminal"),
    readonlyGpuDiagnostic: role("stage4.finalVisibleRgb.gpuDiagnosticReport"),
    cudaTelemetry: role("stage4.finalVisibleRgb.cudaTelemetry"),
    readonlyCpuReport: role("stage4.finalVisibleRgb.cpuAuthorizationReport"),
    inactiveConfig: role("stage4.finalVisibleRgb.inactiveConfig"),
    architectureSupportContract: role("stage4.finalVisibleRgb.trainingObjectiveSupportContract"),
    datasetManifest: bind(datasetManifest),
    datasetSourceIndex: bind(datasetSourceIndex),
    projectAutoencoderCheckpoint: bind(autoencoder),
    conditionAlignmentAuditor: bind("scripts/lib/ai-assisted-condition-alignment.mjs"),
    professionalAestheticAuditor: bind("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
    windowsSafePreviewNormalizer: bind("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
    gpuResourceGate: bind("scripts/lib/ai-assisted-v7-training-resource-gate.mjs"),
    cpuReport: bind(cpuReport),
    implementationAttestation: bind(attestationPath),
    executionEvidenceRegistry: bind(registryPath),
  },
  codeBindings: Object.fromEntries(Object.entries(code).map(([name, file]) => [name, bind(file)])),
  execution: {
    consumptionPath: `${executionRoot}/gpu-consumption.json`,
    activeConfigPath: `${executionRoot}/active-config.json`,
    trainingOutputDirectory: `${executionRoot}/training-output`,
    finalizationDirectory: `${executionRoot}/finalization`,
    preflightReportPath: `${executionRoot}/preflight-report.json`,
  },
  oneTimeConsumptionRequired: true,
  failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true },
})
console.log(JSON.stringify({ status: "stage4_worst_sample_class_reference_luminance_smoke_authorization_materialized_unconsumed", authorization: bind(authorizationPath), attestation: bind(attestationPath) }, null, 2))
