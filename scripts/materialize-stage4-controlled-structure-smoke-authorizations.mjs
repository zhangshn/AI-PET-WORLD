import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const root = process.cwd()
const integrationRunId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(integrationRunId ?? "")) throw new Error("integration runId is required")
const argument = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const hotRoot = path.resolve("D:/AI-PET-WORLD-DATA/hot/runtime")
const resolvePath = (value) => {
  const normalized = String(value).replaceAll("\\", "/")
  return normalized === ".runtime" || normalized.startsWith(".runtime/")
    ? path.join(hotRoot, normalized === ".runtime" ? "" : normalized.slice(9))
    : path.resolve(root, value)
}
const projectPath = (value) => {
  const absolute = path.resolve(value)
  const relativeHot = path.relative(hotRoot, absolute)
  if (relativeHot === "" || (!relativeHot.startsWith("..") && !path.isAbsolute(relativeHot))) {
    return relativeHot ? `.runtime/${relativeHot.replaceAll("\\", "/")}` : ".runtime"
  }
  return path.relative(root, absolute).replaceAll("\\", "/")
}
const hash = (value) => createHash("sha256").update(fs.readFileSync(resolvePath(value))).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(resolvePath(value), "utf8"))
const bind = (value) => ({ path: projectPath(resolvePath(value)), sha256: hash(value) })
const write = (value, data) => {
  const target = resolvePath(value)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

const integration = `.runtime/ai-painter/stage4-controlled-structure-smoke-entry-integrations/${integrationRunId}`
const implementationAuthorization = `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-smoke-entry-${integrationRunId}/implementation-authorization.json`
const implementationConsumption = `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-smoke-entry-${integrationRunId}/implementation-consumption.json`
const compilationRoot = argument("--compilation-root")
if (!/^\.runtime\/ai-painter\/stage4-controlled-structure-smoke-contract-compilations\/[0-9]{8}-[0-9]{9}$/.test(compilationRoot ?? "")) throw new Error("fresh compilation root is required")
const crossArm = `${compilationRoot}/cross-arm-result-adjudication-contract.json`
const supportRoot = ".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/20260823-025010362"
const code = {
  authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
  executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py",
  modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
  cpuChecker: "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py",
  model: "ml/ai-painter/src/ai_painter/complete_world/model.py",
}
const commonBindings = {
  contractCompilationTerminal: bind(`${compilationRoot}/phase-terminal.json`),
  crossArmAdjudicationContract: bind(crossArm),
  implementationAuthorization: bind(implementationAuthorization),
  implementationConsumption: bind(implementationConsumption),
  readonlyCpuReport: bind(`${supportRoot}/cpu-report.json`),
  architectureSupportContract: bind(`${supportRoot}/model-structure-support-contract.json`),
  datasetManifest: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"),
  datasetSourceIndex: bind("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  projectAutoencoderCheckpoint: bind(".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"),
  conditionAlignmentAuditor: bind("scripts/lib/ai-assisted-condition-alignment.mjs"),
  professionalAestheticAuditor: bind("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
  windowsSafePreviewNormalizer: bind("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
  gpuResourceGate: bind("scripts/lib/ai-assisted-v7-training-resource-gate.mjs"),
}
const arms = [
  {
    arm: "condition_fusion_only_final_direct_residual_23_64_12",
    contract: `${compilationRoot}/condition-fusion-only-30-epoch-smoke-contract.json`,
    config: `${integration}/inactive-fusion-smoke-config.json`,
    source: `${supportRoot}/inactive-configs/condition-fusion-only-final-direct-residual-23-64-12.inactive-config.json`,
    cpu: `${integration}/fusion-cpu-report.json`,
    gpuRoot: ".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/20260823-030123742-condition_fusion_only_final_direct_residual_23_64_12",
  },
  {
    arm: "capacity_only_base_width_64_to_existing_level1_128",
    contract: `${compilationRoot}/capacity-only-30-epoch-smoke-contract.json`,
    config: `${integration}/inactive-capacity-smoke-config.json`,
    source: `${supportRoot}/inactive-configs/capacity-only-base-width-64-to-existing-level1-128.inactive-config.json`,
    cpu: `${integration}/capacity-cpu-report.json`,
    gpuRoot: ".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/20260823-030123743-capacity_only_base_width_64_to_existing_level1_128",
  },
]
const results = []
for (const item of arms) {
  const cpu = read(item.cpu)
  if (
    cpu.status !== "stage4_controlled_structure_smoke_entry_cpu_regression_passed"
    || cpu.positivePassed !== cpu.positiveTotal || cpu.negativePassed !== cpu.negativeTotal
  ) throw new Error(`CPU gate incomplete:${item.arm}`)
  const compiled = read(item.contract)
  item.runId = compiled.futureAuthorizationTemplate?.reservedRunId
  if (compiled.arm !== item.arm || !/^[0-9]{8}-[0-9]{9}$/.test(item.runId ?? "")) throw new Error(`compiled arm identity changed:${item.arm}`)
  const requestId = `owner-authorized-stage4-controlled-structure-smoke-${item.arm}-${item.runId}`
  const ownerRoot = `.runtime/ai-painter/owner-action-requests/${requestId}-materialization-${integrationRunId}`
  const attestation = `${ownerRoot}/implementation-attestation.json`
  const authorization = `${ownerRoot}/gpu-execution-authorization.json`
  write(attestation, {
    schemaVersion: "stage4-controlled-structure-smoke-entry-implementation-attestation-v1",
    status: "stage4_controlled_structure_smoke_entry_implementation_cpu_verified",
    requestId,
    arm: item.arm,
    cpuReportPath: item.cpu,
    cpuReportSha256: hash(item.cpu),
    runnerSha256: hash(code.runner), trainerSha256: hash(code.trainer),
    cpuCheckerSha256: hash(code.cpuChecker), modeRegistrySha256: hash(code.modeRegistry),
    modelFactorySha256: hash(code.model),
    modelFactoryMatchesFrozenIdentity: hash(code.model) === "6af8503ed89c49a470fc64767287a66e3c46c877587f0c14f1b7847ad116aeb5",
    gpuStarted: false, checkpointRead: false, optimizerCreated: false,
    backwardExecuted: false, trainingStarted: false,
  })
  const config = read(item.config)
  const output = compiled.futureEvidenceNamespace.outputDirectory
  const actions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"].sort()
  const denied = ["automatic_retry", "create_runtime_frame", "enter_world", "load_parent_denoiser", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "write_diagnostic_checkpoint"].sort()
  write(authorization, {
    schemaVersion: "owner-authorized-stage4-controlled-structure-independent-smoke-v1",
    status: "resolved_owner_authorized_not_consumed",
    requestId, commandRef: requestId,
    scope: `one_30_epoch_controlled_smoke_for_${item.arm}`,
    runId: item.runId, arm: item.arm,
    executionActions: actions, explicitlyDeniedActions: denied,
    taskIdentity: {
      modeId: "fact_conditioned_semantic_mixture_stage4_smoke",
      architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
      stage4ControlledStructureArm: item.arm,
      sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
      sampleSplit: "validation", seed: 20263722, requiredBoundarySides: ["west"],
      resolution: { width: 256, height: 192 }, epochCount: 30,
      previewEpochs: [1, 5, 10, 20, 30], datasetSplit: { train: 48, validation: 8, challenge: 4, regression: 4 },
      initialization: "project_random_fact_conditioned_semantic_mixture",
      oldDenoiserCheckpointReadAuthorized: false, crossArmCheckpointReadAuthorized: false,
      diagnosticManifestFields: config.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.exactFields,
    },
    bindings: {
      ...commonBindings,
      compiledSmokeContract: bind(item.contract),
      readonlyGpuTerminal: bind(`${item.gpuRoot}/phase-terminal.json`),
      readonlyGpuDiagnostic: bind(`${item.gpuRoot}/gpu-report.json`),
      cudaTelemetry: bind(`${item.gpuRoot}/cuda-telemetry.json`),
      conditionGradientEvidence: bind(`${item.gpuRoot}/condition-gradient-evidence.json`),
      inactiveConfig: bind(item.config), sourceInactiveConfig: bind(item.source),
      cpuReport: bind(item.cpu), implementationAttestation: bind(attestation),
    },
    codeBindings: Object.fromEntries(Object.entries(code).map(([name, file]) => [name, bind(file)])),
    execution: {
      consumptionPath: `${output}/gpu-consumption.json`, activeConfigPath: `${output}/active-config.json`,
      trainingOutputDirectory: `${output}/training-output`, finalizationDirectory: `${output}/finalization`,
      preflightReportPath: `${output}/preflight-report.json`,
    },
    oneTimeConsumption: true,
    failurePolicy: { stopImmediatelyOnInfrastructureOrIdentityFailure: true, continueToSecondArmAfterNaturalVisualFailure: true, automaticRetry: false, preserveEvidence: true },
  })
  results.push({ arm: item.arm, runId: item.runId, authorization: bind(authorization), attestation: bind(attestation), output })
}
write(`${integration}/materialization-terminal.json`, {
  schemaVersion: "stage4-controlled-structure-two-smoke-authorization-materialization-v1",
  status: "stage4_controlled_structure_two_independent_smoke_authorizations_materialized_unconsumed",
  integrationRunId, arms: results, gpuStarted: false, trainingStarted: false,
  recordedAtUtc: new Date().toISOString(),
})
console.log(JSON.stringify({ status: "stage4_controlled_structure_two_independent_smoke_authorizations_materialized_unconsumed", arms: results, terminal: bind(`${integration}/materialization-terminal.json`) }, null, 2))
