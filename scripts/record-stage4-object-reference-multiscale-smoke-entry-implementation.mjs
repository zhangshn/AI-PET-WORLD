import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { buildStage4EvidenceEligibilityRegistry, materializeStage4EvidenceRegistry } from "./lib/ai-painter-stage4-evidence-eligibility.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const EARLY_CONVERGENCE_INTEGRATION_REQUEST_ID =
  "owner-authorized-stage4-object-reference-multiscale-early-convergence-30-epoch-smoke-entry-integration-20260815-213000000"
const earlyAuthorizationIndex = process.argv.indexOf("--authorization")
if (earlyAuthorizationIndex >= 0) {
  const earlyAuthorizationPath = process.argv[earlyAuthorizationIndex + 1]
  const earlyAuthorizationAbsolute = path.resolve(process.cwd(), earlyAuthorizationPath ?? "")
  if (fs.existsSync(earlyAuthorizationAbsolute)) {
    const earlyAuthorization = JSON.parse(fs.readFileSync(earlyAuthorizationAbsolute, "utf8"))
    if (earlyAuthorization.requestId === EARLY_CONVERGENCE_INTEGRATION_REQUEST_ID) {
      const checker = path.resolve(
        process.cwd(),
        "scripts/check-stage4-object-reference-multiscale-early-convergence-smoke-entry-integration.mjs",
      )
      const child = spawnSync(process.execPath, [checker, ...process.argv.slice(2), "--record"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1" },
        windowsHide: true,
      })
      if (child.stdout) process.stdout.write(child.stdout)
      if (child.stderr) process.stderr.write(child.stderr)
      process.exit(child.status ?? 1)
    }
  }
}

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-smoke-trainer-qualification-lineage-correction-20260815-181500000"
const SCOPE = "one_cpu_only_trainer_object_reference_multiscale_smoke_qualification_lineage_correction"
const AUTH_SHA = "39946ef93aaee6fbd9e2514aa57c96d7f89549df4a9092dfd8d83a445daa7845"
const CONSUMPTION_SHA = "541948b2915919c2cee3b772873138f0c15eeb1041d6e341b590812a30e559e7"
const OUTPUT = path.join(ROOT, ".runtime", "ai-painter", "stage4-object-reference-multiscale-smoke-trainer-qualification-lineage-corrections", "20260815-181500000")
const REGISTRY_ID = "20260815-181600000"
const REGISTRY_PATH = path.join(ROOT, ".runtime", "ai-painter", "stage4-execution-evidence-eligibility", REGISTRY_ID, "registry.json")
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const RUNNER = path.join(ROOT, "scripts", "run-ai-assisted-v8-r5-stage4-smoke.mjs")
const CHECKER = path.join(ROOT, "ml", "ai-painter", "scripts", "check_ai_assisted_v9_r5_stage4_cpu.py")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const MODEL = path.join(ROOT, "ml", "ai-painter", "src", "ai_painter", "complete_world", "model.py")
const MODE_REGISTRY = path.join(ROOT, "ml", "ai-painter", "scripts", "ai_painter_stage_mode_registry.py")
const POLICY = path.join(ROOT, "ml", "ai-painter", "scripts", "ai_painter_authorization_policy.py")
const GRANT = path.join(ROOT, "ml", "ai-painter", "scripts", "ai_painter_execution_grant.py")
const COMPILER = path.join(ROOT, "ml", "ai-painter", "scripts", "compile_ai_assisted_v9_r5_stage4_inactive_config.py")
const SOURCE_INDEX = path.join(ROOT, "data", "world-samples", "ai-assisted-cold-start-dataset-packages", "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z", "source-index.json")
const AUDITORS = {
  conditionAlignmentAuditor: path.join(ROOT, "scripts", "lib", "ai-assisted-condition-alignment.mjs"),
  professionalAestheticAuditor: path.join(ROOT, "scripts", "lib", "ai-assisted-professional-aesthetic.mjs"),
  windowsSafePreviewNormalizer: path.join(ROOT, "scripts", "lib", "ai-assisted-v7-r5-stage3-preview-review.mjs"),
  gpuResourceGate: path.join(ROOT, "scripts", "lib", "ai-assisted-v7-training-resource-gate.mjs"),
}
const FUTURE_REQUEST_ID = "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260815-190000000"
const CONTRACT_ID = "typed_object_multiscale_luminance_structure_correlation_supervision_v1"
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const ACTIONS = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"]
const DENIED = ["automatic_retry", "create_runtime_frame", "enter_world", "load_parent_denoiser", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "write_diagnostic_checkpoint"]

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.ok(value); assert.equal(path.isAbsolute(value), false); const absolute = path.resolve(ROOT, value); assert.ok(absolute.startsWith(`${ROOT}${path.sep}`)); return absolute }
const relative = (value) => path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const writeExclusive = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); assert.equal(fs.existsSync(file), false, `immutable_file_exists:${relative(file)}`); const handle = fs.openSync(file, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
const reusable = (role, source, successTerminal, registrationChain = []) => ({ role, source: bind(source), successTerminal, registrationChain })

const authorizationPath = projectFile(arg("--authorization"))
const consumptionPath = projectFile(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(consumption.status, "stage4_object_reference_multiscale_smoke_trainer_qualification_lineage_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted", "automaticRetryStarted"]) assert.equal(consumption[key], false)
for (const [name, binding] of Object.entries(authorization.bindings)) {
  if (["recorderPreimage", "cpuCheckerPreimage", "trainerPreimage"].includes(name)) assert.notEqual(sha(projectFile(binding.path)), binding.sha256, `${name}_not_corrected`)
  else assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_changed`)
}
assert.equal(fs.existsSync(OUTPUT), false, "output_exists")
assert.equal(fs.existsSync(REGISTRY_PATH), false, "registry_exists")

const implementationAuthorizationPath = projectFile(authorization.bindings.implementationAuthorization.path)
const implementationConsumptionPath = projectFile(authorization.bindings.implementationConsumption.path)
const implementationAuthorization = read(implementationAuthorizationPath)
assert.equal(implementationAuthorization.requestId, "owner-authorized-stage4-object-reference-multiscale-30-epoch-smoke-entry-implementation-20260815-164000000")
const phase0TerminalPath = projectFile(implementationAuthorization.bindings.phase0Terminal.path)
const phase0FinalizationPath = projectFile(implementationAuthorization.bindings.phase0Finalization.path)
const phase0UpdatePath = projectFile(implementationAuthorization.bindings.phase0UpdateReport.path)
const continuationReport = read(projectFile(implementationAuthorization.bindings.continuationReport.path))
const continuationCpuPath = projectFile(continuationReport.cpuContractReport.path)
assert.equal(sha(continuationCpuPath), continuationReport.cpuContractReport.sha256)
const phase0Terminal = read(phase0TerminalPath)
const phase0Finalization = read(phase0FinalizationPath)
const phase0Update = read(phase0UpdatePath)
assert.equal(phase0Terminal.status, "stage4_object_reference_multiscale_phase0_passed_closed")
assert.equal(phase0Finalization.status, "stage4_object_reference_multiscale_phase0_passed_closed")
assert.equal(phase0Update.optimizerStepCount, 1)
assert.equal(phase0Update.backwardCallCount, 1)
assert.equal(phase0Update.replayOptimizerStepCount, 0)
assert.equal(phase0Update.parameterGradientsCleared, true)
assert.equal(phase0Update.diagnosticManifest.fieldCount, 48)

fs.mkdirSync(OUTPUT, { recursive: true })
const files = {
  inactive: path.join(OUTPUT, "inactive-smoke-config.json"),
  support: path.join(OUTPUT, "training-objective-support-contract.json"),
  registration: path.join(OUTPUT, "registration-terminal.json"),
  cpu: path.join(OUTPUT, "cpu-contract-report.json"),
  attestation: path.join(OUTPUT, "implementation-attestation.json"),
  fixture: path.join(OUTPUT, "cpu-contract-smoke-authorization-fixture.json"),
  finalFixture: path.join(OUTPUT, "final-proposed-authorization-cpu-fixture.json"),
  report: path.join(OUTPUT, "implementation-report.json"),
  inactiveGpu: path.join(OUTPUT, "inactive-gpu-smoke-contract.json"),
  owner: path.join(OUTPUT, "owner-action-request.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
  retiredGpu: path.join(OUTPUT, "retired-consumed-failed-gpu-authorization.json"),
  trainerPreflight: path.join(OUTPUT, "trainer-preflight-only-report.json"),
}
const now = new Date().toISOString()
const shanghai = formatShanghai(now)

function compileInactiveConfig() {
  const config = structuredClone(read(projectFile(implementationAuthorization.bindings.sourceConfig.path)))
  const fragment = read(projectFile(implementationAuthorization.bindings.inactiveConfigFragment.path))
  const training = config.training
  for (const key of fragment.trainingPatch.remove) delete training[key]
  Object.assign(training, structuredClone(fragment.trainingPatch.add))
  config.architectureVersion = "fact-conditioned-semantic-mixture-object-reference-multiscale-cpu"
  config.denoiserArchitecture = "stage4_fact_conditioned_semantic_mixture_decoder_v1"
  training.trainingAuthorizationStatus = "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
  training.denoiserEpochs = 30
  delete training.factConditionedSemanticMixtureStage4FullTrainingContract
  delete training.factConditionedSemanticMixtureStage4SingleSampleSmokeContract
  delete training.factConditionedSemanticMixtureStage4SmokeExecution
  delete training.stage4UnifiedTrainingPreviewSamplingContract
  training.ownerTrainingAuthorization = {
    authorizationId: REQUEST_ID, status: "not_authorized_cpu_support_only",
    checkpointLoadingAuthorized: false, optimizerCreationAuthorized: false, backwardExecutionAuthorized: false,
    modelWeightMutationAuthorized: false, gpuTrainingAuthorizedNow: false, singleSampleGpuOverfitSmokeAuthorized: false,
    fullTrainingAuthorized: false, stage1Authorized: false, stage2Authorized: false, strictRevalidationAuthorized: false,
    validationAuthorized: false, formalInferenceAuthorized: false, checkpointPromotionAuthorized: false,
    runtimeFrameAuthorized: false, worldEntryAuthorized: false, automaticRetryAuthorized: false,
  }
  const mixture = training.stage4FactConditionedSemanticMixture
  mixture.enabled = false
  mixture.status = "cpu_support_verified_not_active"
  mixture.diagnosticManifestRegistry.exactFields = [...phase0Update.diagnosticManifest.fields]
  mixture.diagnosticManifestRegistry.exactFieldCount = 48
  for (const key of Object.keys(mixture.activationGate)) mixture.activationGate[key] = false
  for (const [name, contract] of Object.entries(training)) {
    if (!name.startsWith("stage4") || !contract || typeof contract !== "object" || !contract.activationGate) continue
    if (name === "stage4FactConditionedSemanticMixture") continue
    contract.status = "cpu_support_verified_inactive"
    for (const key of Object.keys(contract.activationGate)) contract.activationGate[key] = false
  }
  const current = training.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision
  assert.equal(current.contractId, CONTRACT_ID)
  assert.deepEqual(current.pyramidScales, [1, 0.5, 0.25])
  assert.equal(current.noveltyBoundary.failedSingleScaleContractReuseAllowed, false)
  assert.equal(training.stage4ObjectVisibleStructureSupervision, undefined)
  training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
  training.stage4FailureDiagnostics.trainingConfigApplied = false
  training.stage4FailureDiagnostics.checkpointFileReadAuthorized = false
  training.stage4FailureDiagnostics.gpuUseAuthorized = false
  training.stage4FailureDiagnostics.trainingAuthorized = false
  return config
}

writeExclusive(files.retiredGpu, {
  schemaVersion: "stage4-object-reference-multiscale-retired-consumed-failed-gpu-authorization-v1",
  status: "gpu_authorization_retired_consumed_after_trainer_lineage_failure",
  authorization: authorization.bindings.consumedGpuAuthorization,
  consumption: authorization.bindings.gpuConsumption,
  successfulPreflightReport: authorization.bindings.successfulPreflightReport,
  failedFinalization: authorization.bindings.failedFinalization,
  failedTerminal: authorization.bindings.failedTerminal,
  failedActiveConfig: authorization.bindings.failedActiveConfig,
  executionConsumptionExists: true,
  authorizationConsumed: true,
  reusable: false,
  gpuStarted: false,
  epoch: 0,
  step: 0,
  checkpointRead: false,
  modelLoaded: false,
  optimizerCreated: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.inactive, compileInactiveConfig())
writeExclusive(files.support, {
  schemaVersion: "ai-painter-stage4-object-reference-multiscale-smoke-integration-support-v1",
  status: "stage4_object_reference_multiscale_smoke_integration_inputs_registered_cpu_only",
  architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: CONTRACT_ID,
  diagnosticManifestFields: [...phase0Update.diagnosticManifest.fields],
  phase0Terminal: bind(phase0TerminalPath), phase0Finalization: bind(phase0FinalizationPath), phase0Update: bind(phase0UpdatePath),
  diagnosticCheckpointReadAuthorized: false, oldDenoiserCheckpointReadAuthorized: false,
  gpuAuthorized: false, trainingAuthorized: false, smokeAuthorized: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.registration, {
  schemaVersion: "ai-painter-stage4-object-reference-multiscale-smoke-input-registration-terminal-v1",
  status: "stage4_object_reference_multiscale_smoke_input_registration_succeeded_closed",
  authorization: bind(authorizationPath), phase0Terminal: bind(phase0TerminalPath), phase0Finalization: bind(phase0FinalizationPath),
  phase0Update: bind(phase0UpdatePath), continuationCpuReport: bind(continuationCpuPath),
  inactiveConfig: bind(files.inactive), supportContract: bind(files.support),
  gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
const phaseTerminalBinding = bind(phase0TerminalPath)
const registrationBinding = bind(files.registration)
const continuationBinding = bind(projectFile(implementationAuthorization.bindings.continuationReport.path))
const registry = buildStage4EvidenceEligibilityRegistry({
  root: ROOT, registryId: REGISTRY_ID, authorization: bind(authorizationPath),
  reusableEvidence: [
    reusable("stage4.finalVisibleRgb.gpuQualificationTerminal", phase0TerminalPath, phaseTerminalBinding),
    reusable("stage4.finalVisibleRgb.gpuDiagnosticReport", phase0FinalizationPath, phaseTerminalBinding),
    reusable("stage4.finalVisibleRgb.cudaTelemetry", phase0UpdatePath, phaseTerminalBinding, [bind(phase0FinalizationPath)]),
    reusable("stage4.finalVisibleRgb.cpuAuthorizationReport", continuationCpuPath, continuationBinding),
    reusable("stage4.finalVisibleRgb.inactiveConfig", files.inactive, registrationBinding),
    reusable("stage4.finalVisibleRgb.trainingObjectiveSupportContract", files.support, registrationBinding),
  ], historicalEvidence: [],
})
const registryBinding = materializeStage4EvidenceRegistry({ root: ROOT, registry, registryPath: relative(REGISTRY_PATH) })
const registryValue = read(REGISTRY_PATH)
const role = (name) => ({ path: registryValue.roles[name].canonicalPath, sha256: registryValue.roles[name].sha256 })
const fixtureRoot = path.join(OUTPUT, "cpu-fixture-inputs")
fs.mkdirSync(fixtureRoot, { recursive: true })
const placeholderCpu = path.join(fixtureRoot, "cpu-report-placeholder.json")
const placeholderAttestation = path.join(fixtureRoot, "implementation-attestation-placeholder.json")
writeExclusive(placeholderCpu, { status: "cpu_contract_fixture_only" })
writeExclusive(placeholderAttestation, { status: "implementation_attestation_fixture_only" })

function buildSmokeAuthorization(cpuReportPath, attestationPath) {
  const executionId = FUTURE_REQUEST_ID.slice("owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-".length)
  return {
    schemaVersion: "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1",
    requestId: FUTURE_REQUEST_ID, commandRef: FUTURE_REQUEST_ID,
    scope: "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only",
    status: "resolved_owner_authorized_not_consumed",
    executionActions: [...ACTIONS], explicitlyDeniedActions: [...DENIED],
    taskIdentity: {
      modeId: "fact_conditioned_semantic_mixture_stage4_smoke",
      architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
      trainingObjectiveContractId: CONTRACT_ID,
      sampleId: SAMPLE_ID, sampleSplit: "validation", seed: 20263722,
      requiredBoundarySides: ["west"], resolution: { width: 256, height: 192 },
      epochCount: 30, previewEpochs: [1, 5, 10, 20, 30],
      datasetSplit: { train: 48, validation: 8, challenge: 4, regression: 4 },
      initialization: "project_random_fact_conditioned_semantic_mixture",
      oldDenoiserCheckpointReadAuthorized: false, diagnosticCheckpointReadAuthorized: false,
      evidenceEligibilityContractId: "stage4_execution_evidence_eligibility_v1",
      objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
      pyramidScales: [1, 0.5, 0.25], diagnosticManifestFields: [...phase0Update.diagnosticManifest.fields],
    },
    bindings: {
      implementationAuthorization: bind(implementationAuthorizationPath), implementationConsumption: bind(implementationConsumptionPath),
      readonlyGpuTerminal: role("stage4.finalVisibleRgb.gpuQualificationTerminal"),
      readonlyGpuDiagnostic: role("stage4.finalVisibleRgb.gpuDiagnosticReport"),
      cudaTelemetry: role("stage4.finalVisibleRgb.cudaTelemetry"),
      readonlyCpuReport: role("stage4.finalVisibleRgb.cpuAuthorizationReport"),
      inactiveConfig: role("stage4.finalVisibleRgb.inactiveConfig"),
      architectureSupportContract: role("stage4.finalVisibleRgb.trainingObjectiveSupportContract"),
      datasetManifest: implementationAuthorization.bindings.datasetManifest, datasetSourceIndex: bind(SOURCE_INDEX),
      projectAutoencoderCheckpoint: implementationAuthorization.bindings.projectAutoencoderCheckpoint,
      conditionAlignmentAuditor: bind(AUDITORS.conditionAlignmentAuditor), professionalAestheticAuditor: bind(AUDITORS.professionalAestheticAuditor),
      windowsSafePreviewNormalizer: bind(AUDITORS.windowsSafePreviewNormalizer), gpuResourceGate: bind(AUDITORS.gpuResourceGate),
      cpuReport: bind(cpuReportPath), implementationAttestation: bind(attestationPath), executionEvidenceRegistry: registryBinding,
    },
    codeBindings: {
      authorizationPolicy: bind(POLICY), executionGrant: bind(GRANT), modeRegistry: bind(MODE_REGISTRY),
      trainer: bind(TRAINER), runner: bind(RUNNER), cpuChecker: bind(CHECKER), model: bind(MODEL), inactiveConfigCompiler: bind(COMPILER),
    },
    execution: {
      consumptionPath: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/${executionId}/execution-consumption.json`,
      activeConfigPath: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/${executionId}/active-config.json`,
      trainingOutputDirectory: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/${executionId}/training-output`,
      finalizationDirectory: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/${executionId}/finalization`,
      preflightReportPath: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/${executionId}/preflight-report.json`,
    },
    oneTimeConsumptionRequired: true,
    failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true },
  }
}

writeExclusive(files.fixture, buildSmokeAuthorization(placeholderCpu, placeholderAttestation))
const environment = { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1" }
const cpu = spawnSync(PYTHON, [
  "-B", CHECKER, "--object-reference-multiscale-smoke-entry-contract",
  "--report", files.cpu, "--implementation-attestation", files.attestation,
  "--smoke-authorization", files.fixture, "--authorization-sha256", sha(files.fixture),
  "--inactive-config", files.inactive,
  "--failed-active-config", projectFile(authorization.bindings.failedActiveConfig.path),
  "--failed-gpu-authorization", projectFile(authorization.bindings.consumedGpuAuthorization.path),
  "--failed-gpu-consumption", projectFile(authorization.bindings.gpuConsumption.path),
  "--implementation-authorization", implementationAuthorizationPath, "--implementation-consumption", implementationConsumptionPath,
], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr || cpu.stdout}`)
const cpuReport = read(files.cpu)
const attestation = read(files.attestation)
assert.equal(cpuReport.status, "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)
assert.equal(attestation.status, "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified")
const trainerPreflightOutput = path.join(OUTPUT, "trainer-preflight-output")
const trainerPreflight = spawnSync(PYTHON, [
  "-B", TRAINER,
  "--config", files.inactive,
  "--dataset-package", projectFile(implementationAuthorization.bindings.datasetManifest.path),
  "--autoencoder-checkpoint", projectFile(implementationAuthorization.bindings.projectAutoencoderCheckpoint.path),
  "--output-dir", trainerPreflightOutput,
  "--resolution-stage", "0",
  "--single-sample-overfit-smoke",
  "--overfit-sample-id", SAMPLE_ID,
  "--overfit-epochs", "30",
  "--overfit-evaluation-interval", "5",
  "--preflight-only",
], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
writeExclusive(files.trainerPreflight, {
  schemaVersion: "stage4-object-reference-multiscale-smoke-trainer-preflight-only-report-v1",
  status: trainerPreflight.status === 0 ? "trainer_preflight_only_passed_cpu_closed" : "trainer_preflight_only_failed_closed",
  exitCode: trainerPreflight.status,
  signal: trainerPreflight.signal,
  stdout: trainerPreflight.stdout,
  stderr: trainerPreflight.stderr,
  baseSemanticMixtureStatus: read(files.inactive).training.stage4FactConditionedSemanticMixture.status,
  gpuStarted: false,
  cudaInitialized: false,
  checkpointRead: false,
  modelLoaded: false,
  optimizerCreated: false,
  autogradExecuted: false,
  backwardExecuted: false,
  trainingStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
assert.equal(trainerPreflight.status, 0, `trainer_preflight_only_failed:${trainerPreflight.stderr || trainerPreflight.stdout}`)
const proposedAuthorization = buildSmokeAuthorization(files.cpu, files.attestation)
writeExclusive(files.finalFixture, proposedAuthorization)
const finalContract = spawnSync(process.execPath, [
  RUNNER, "--stage4-fact-conditioned-semantic-mixture-model-smoke",
  "--gpu-authorization", relative(files.finalFixture), "--gpu-authorization-sha256", sha(files.finalFixture), "--cpu-contract-only",
], { cwd: ROOT, encoding: "utf8", env: environment })
assert.equal(finalContract.status, 0, `final_proposed_contract_failed:${finalContract.stderr || finalContract.stdout}`)

writeExclusive(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-smoke-trainer-qualification-lineage-correction-report-v1",
  status: "stage4_object_reference_multiscale_smoke_trainer_qualification_lineage_correction_succeeded_closed",
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  retiredConsumedFailedGpuAuthorization: bind(files.retiredGpu),
  inactiveConfig: bind(files.inactive), supportContract: bind(files.support), registrationTerminal: bind(files.registration),
  executionEvidenceRegistry: registryBinding, cpuContractReport: bind(files.cpu), implementationAttestation: bind(files.attestation),
  trainerPreflightOnlyReport: bind(files.trainerPreflight),
  finalProposedAuthorizationCpuFixture: bind(files.finalFixture),
  frozen: { trainer: true, model: true, data: true, sourceConfig: true, reviewThresholds: true },
  gpuUsedNow: false, checkpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false, smokeStartedNow: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.inactiveGpu, {
  schemaVersion: "stage4-object-reference-multiscale-30-epoch-gpu-smoke-inactive-contract-v1",
  status: "inactive_owner_gpu_smoke_authorization_required",
  proposedAuthorization,
  authorizedNow: false, consumedNow: false, gpuUsedNow: false, smokeStartedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "execute_one_independent_object_reference_multiscale_30_epoch_semantic_mixture_gpu_smoke",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/authorization.json`,
  proposedAuthorization,
  boundImplementationReport: bind(files.report), boundInactiveGpuContract: bind(files.inactiveGpu),
  automaticApproval: false, gpuExecutedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-smoke-trainer-qualification-lineage-correction-terminal-v1",
  status: "stage4_object_reference_multiscale_smoke_trainer_qualification_lineage_correction_succeeded_closed",
  implementationReport: bind(files.report), inactiveGpuSmokeContract: bind(files.inactiveGpu), ownerActionRequest: bind(files.owner),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_exact_proposed_object_reference_multiscale_30_epoch_gpu_smoke_or_exit",
  gpuUsedNow: false, trainingStartedNow: false, smokeStartedNow: false, automaticRetryStartedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "stage4_object_reference_multiscale_smoke_trainer_qualification_lineage_correction_succeeded_closed",
  module: "AI Painter R5", currentStage: "Object-reference multiscale independent 30 Epoch GPU Smoke ready but inactive",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal), ownerActionRequest: bind(files.owner),
  latestBlocker: "immutable_owner_gpu_smoke_authorization_not_created_or_consumed",
  nextLegalAction: "owner_authorize_exact_proposed_object_reference_multiscale_30_epoch_gpu_smoke_or_exit",
  gpuUsedNow: false, trainingStartedNow: false, smokeStartedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const recorderPath = new URL(import.meta.url).pathname.startsWith("/") && process.platform === "win32" ? new URL(import.meta.url).pathname.slice(1) : new URL(import.meta.url).pathname
for (const file of [authorizationPath, consumptionPath, recorderPath, REGISTRY_PATH, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-smoke-trainer-qualification-lineage-correction-${REQUEST_ID}`,
  timestamp: now, action: "stage4_object_reference_multiscale_smoke_trainer_qualification_lineage_correction", runId: REQUEST_ID,
  kind: "cpu_only_trainer_smoke_qualification_lineage_correction", status: "success",
  title: "Object-reference multiscale Smoke Trainer qualification lineage corrected CPU-only",
  titleZh: "四对象参考对齐多尺度 Smoke Trainer 资格血缘 CPU 修正完成",
  detailZh: `CPU正向${cpuReport.positivePassed}/${cpuReport.positiveTotal}、反向${cpuReport.negativePassed}/${cpuReport.negativeTotal}，失败Active Config的Trainer preflight-only已通过；未启动GPU、训练或Smoke。`,
  evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status, cpuContractReport: bind(files.cpu), implementationReport: bind(files.report),
  inactiveGpuSmokeContract: bind(files.inactiveGpu), ownerActionRequest: bind(files.owner), terminal: bind(files.terminal), capsule: bind(files.capsule),
}, null, 2))
