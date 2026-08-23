import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const integrationRunId = process.argv[2]
const executionRunId = process.argv[3]
const epochCompleteSelectorMode = process.argv.includes("--epoch-complete-selector")
const epochCompleteReferenceFeatureSharedReplayMode = process.argv.includes("--epoch-complete-reference-feature-shared-replay")
if (!/^[0-9]{8}-[0-9]{9}$/.test(integrationRunId ?? "") || !/^[0-9]{8}-[0-9]{9}$/.test(executionRunId ?? "")) throw new Error("integration and execution runIds are required")
const resolve = (value) => {
  const normalized = String(value).replaceAll("\\", "/")
  if (normalized === ".runtime" || normalized.startsWith(".runtime/")) return path.join("D:/AI-PET-WORLD-DATA/hot/runtime", normalized === ".runtime" ? "" : normalized.slice(9))
  return path.resolve(root, value)
}
const projectPath = (value) => {
  const absolute = path.resolve(value)
  const hot = path.resolve("D:/AI-PET-WORLD-DATA/hot/runtime")
  const relativeHot = path.relative(hot, absolute)
  if (relativeHot === "" || (!relativeHot.startsWith("..") && !path.isAbsolute(relativeHot))) return relativeHot ? `.runtime/${relativeHot.replaceAll("\\", "/")}` : ".runtime"
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

const integration = epochCompleteReferenceFeatureSharedReplayMode
  ? `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-smoke-entry-integrations/${integrationRunId}`
  : epochCompleteSelectorMode
  ? `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-selection-smoke-entry-integrations/${integrationRunId}`
  : `.runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-smoke-entry-integrations/${integrationRunId}`
const inactiveConfig = `${integration}/inactive-smoke-config.json`
const registryPath = `${integration}/registry.json`
const cpuReport = `${integration}/cpu-report.json`
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
for (const file of [inactiveConfig, registryPath, cpuReport, implementationAuthorization, implementationConsumption]) if (!fs.existsSync(resolve(file))) throw new Error(`bound source missing: ${file}`)
const cpu = read(cpuReport)
if (cpu.status !== "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed" || cpu.positivePassed !== cpu.positiveTotal || cpu.negativePassed !== cpu.negativeTotal) throw new Error("CPU regression is not a complete pass")
const registry = read(registryPath)
const role = (name) => {
  const entry = registry.roles?.[name]
  if (registry.status !== "stage4_execution_evidence_eligibility_registered" || entry?.disposition !== "active_reusable_success_evidence") throw new Error(`canonical role invalid: ${name}`)
  return bind(entry.canonicalPath)
}
const requestId = epochCompleteReferenceFeatureSharedReplayMode
  ? `owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-30-epoch-model-smoke-${executionRunId}`
  : epochCompleteSelectorMode
  ? `owner-authorized-stage4-epoch-complete-per-class-worst-luminance-selection-30-epoch-model-smoke-${executionRunId}`
  : `owner-authorized-stage4-per-class-worst-sample-final-visible-luminance-structure-30-epoch-model-smoke-${executionRunId}`
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
  cpuReportPath: cpuReport,
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
const executionRoot = epochCompleteReferenceFeatureSharedReplayMode
  ? `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-smokes/${executionRunId}`
  : epochCompleteSelectorMode
  ? `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-selection-smokes/${executionRunId}`
  : `.runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-smokes/${executionRunId}`
writeExclusive(authorizationPath, {
  schemaVersion: "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1",
  requestId,
  commandRef: requestId,
  scope: "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only",
  status: "resolved_owner_authorized_not_consumed",
  executionActions: ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"],
  explicitlyDeniedActions: ["automatic_retry", "create_runtime_frame", "enter_world", "load_parent_denoiser", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "write_diagnostic_checkpoint"],
  taskIdentity: {
    modeId: "fact_conditioned_semantic_mixture_stage4_smoke",
    architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
    trainingObjectiveContractId: epochCompleteReferenceFeatureSharedReplayMode
      ? "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1"
      : epochCompleteSelectorMode
      ? "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1"
      : "stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1",
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
    datasetManifest: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"),
    datasetSourceIndex: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
    projectAutoencoderCheckpoint: bind(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"),
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
console.log(JSON.stringify({
  status: epochCompleteReferenceFeatureSharedReplayMode
    ? "stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_smoke_authorization_materialized_unconsumed"
    : epochCompleteSelectorMode
    ? "stage4_epoch_complete_per_class_worst_luminance_selection_smoke_authorization_materialized_unconsumed"
    : "stage4_per_class_worst_sample_final_visible_luminance_structure_smoke_authorization_materialized_unconsumed",
  authorization: bind(authorizationPath), attestation: bind(attestationPath), executionRoot,
}, null, 2))
