import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  buildStage4EvidenceEligibilityRegistry,
  materializeStage4EvidenceRegistry,
} from "./lib/ai-painter-stage4-evidence-eligibility.mjs"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-current-candidate-inactive-bound-owner-preflight-20260816-032403029"
const SCOPE = "cpu_only_inactive_registry_fix_preflight_and_unsigned_five_step_plan"
const AUTH_SHA = "8fd09228f91ec38704d18160db8d461e1a8cb6b63514908fd0fa6045c5028745"
const CONSUMPTION_SHA = "428fe14fdd909ee4311323e1d75520abb2869b3884c50a8191e8c61431659d20"
const OUTPUT = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-smoke-entry-integrations/20260816-032403029"
const REGISTRY_ID = "20260816-032403029"
const REGISTRY_PATH = `.runtime/ai-painter/stage4-execution-evidence-eligibility/${REGISTRY_ID}/registry.json`
const RUNNER = "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"
const RECORDER = "scripts/record-stage4-object-reference-multiscale-smoke-entry-implementation.mjs"
const CHECKER = "scripts/check-stage4-object-reference-multiscale-early-convergence-smoke-entry-integration.mjs"
const CPU_CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const MODEL = "ml/ai-painter/src/ai_painter/complete_world/model.py"
const MODE_REGISTRY = "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"
const POLICY = "ml/ai-painter/scripts/ai_painter_authorization_policy.py"
const GRANT = "ml/ai-painter/scripts/ai_painter_execution_grant.py"
const COMPILER = "ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py"
const AUDITORS = {
  conditionAlignmentAuditor: "scripts/lib/ai-assisted-condition-alignment.mjs",
  professionalAestheticAuditor: "scripts/lib/ai-assisted-professional-aesthetic.mjs",
  windowsSafePreviewNormalizer: "scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs",
  gpuResourceGate: "scripts/lib/ai-assisted-v7-training-resource-gate.mjs",
}
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
const CONTRACT_ID = "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1"
const CHANNELS = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
const PYRAMID = [1, 0.5, 0.25]
const ACTIONS = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"]
const DENIED = ["automatic_retry", "create_runtime_frame", "enter_world", "load_parent_denoiser", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "write_diagnostic_checkpoint"]

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.equal(typeof value, "string", "project_path_missing")
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const absolute = path.resolve(ROOT, value)
  assert.ok(absolute.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return absolute
}
const relative = (value) => path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const clone = (value) => structuredClone(value)
const writeExclusive = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  assert.equal(fs.existsSync(file), false, `immutable_file_exists:${relative(file)}`)
  const handle = fs.openSync(file, "wx")
  try {
    fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8")
    fs.fsyncSync(handle)
  } finally {
    fs.closeSync(handle)
  }
}
const reusable = (role, source, successTerminal) => ({ role, source: bind(source), successTerminal, registrationChain: [] })
const positiveNorm = (value) => Number.isFinite(value) && value > 0

const authorizationPath = projectFile(arg("--authorization"))
const consumptionPath = projectFile(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA, "authorization_sha256_changed")
assert.equal(sha(consumptionPath), CONSUMPTION_SHA, "consumption_sha256_changed")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.execution.smokeEntryOutputDirectory, OUTPUT)
assert.equal(authorization.execution.consumeBeforeFirstCodeOrEvidenceWrite, true)
assert.equal(consumption.status, "stage4_current_candidate_inactive_registry_and_plan_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of [
  "gpuUsed", "cudaInitialized", "autogradUsed", "checkpointReadOrLoaded", "modelLoaded",
  "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted",
  "automaticRetryStarted", "stage0OrStage1OrStage2Started",
]) assert.equal(consumption[key], false, `${key}_opened_in_consumption`)

for (const [name, binding] of Object.entries(authorization.bindings)) {
  const file = projectFile(binding.path)
  if (name === "smokeEntryIntegrationBefore") {
    assert.notEqual(sha(file), binding.sha256, `${name}_was_not_implemented`)
  } else {
    assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
  }
}
assert.equal(sha(projectFile(TRAINER)), authorization.bindings.currentTrainer.sha256, "trainer_changed")

const gpuAuthorization = read(projectFile(authorization.bindings.gpuAuthorization.path))
const terminal = read(projectFile(authorization.bindings.gpuTerminal.path))
const diagnostic = read(projectFile(authorization.bindings.diagnosticReport.path))
const telemetry = read(projectFile(authorization.bindings.cudaTelemetry.path))
const continuationReport = read(projectFile(authorization.bindings.continuationReport.path))
const continuationCpuPath = projectFile(continuationReport.cpuContractReport.path)
assert.equal(sha(continuationCpuPath), continuationReport.cpuContractReport.sha256, "continuation_cpu_report_changed")
const continuationCpu = read(continuationCpuPath)
const sourceConfig = read(projectFile(authorization.bindings.inactiveConfig.path))
const FORMAL_INACTIVE_GATE_FIELDS = Object.freeze({
  stage4FullRolloutFinalVisibleConsistency: Object.freeze(
    Object.keys(sourceConfig.training.stage4FullRolloutFinalVisibleConsistency.activationGate).sort(),
  ),
  stage4EpochWorstSampleClassReplay: Object.freeze(
    Object.keys(sourceConfig.training.stage4EpochWorstSampleClassReplay.activationGate).sort(),
  ),
})

function validateQualification(candidate) {
  const t = candidate.terminal
  const d = candidate.diagnostic
  const c = candidate.cpu
  const q = d.gradientEvidence?.twoLaneEarlyConvergenceStabilization ?? {}
  const four = d.gradientEvidence?.fourObjectVisibleStructure ?? {}
  const early = candidate.config.training?.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization ?? {}
  return (
    t.status === "stage4_two_lane_early_convergence_gpu_qualification_passed_closed"
    && t.reportSha256 === authorization.bindings.diagnosticReport.sha256
    && t.cudaTelemetrySha256 === authorization.bindings.cudaTelemetry.sha256
    && t.blockers?.length === 0
    && t.optimizerCreated === false
    && t.backwardMethodExecuted === false
    && t.modelWeightsModified === false
    && t.checkpointWritten === false
    && t.trainingStarted === false
    && t.automaticRetryStarted === false
    && d.status === "passed_readonly_stage4_two_lane_early_convergence_gpu_gradient_qualification"
    && d.identity?.trainingObjectiveContractId === CONTRACT_ID
    && d.identity?.replayLaneCount === 2
    && d.diagnosticManifest?.fieldCount === 48
    && d.diagnosticManifest?.fields?.length === 48
    && Object.keys(d.diagnosticManifest?.values ?? {}).length === 48
    && ["footprints", "tree", "rock", "vegetation"].every((name) => (
      four[name]?.finiteAndStrictlyNonzero === true
      && positiveNorm(four[name]?.denoiserGradientNorm)
      && positiveNorm(four[name]?.matchingSemanticMixtureExpertGradientNorm)
    ))
    && four.combined?.finiteAndStrictlyNonzero === true
    && positiveNorm(four.combined?.denoiserGradientNorm)
    && q.contractStatusDuringQualification === "cpu_support_verified_inactive"
    && positiveNorm(q.lane1DenoiserGradientNorm)
    && positiveNorm(q.lane2DenoiserGradientNorm)
    && positiveNorm(q.combinedTwoLaneDenoiserGradientNorm)
    && q.replayPassesAdded === 0
    && q.optimizerCreated === false
    && q.backwardMethodExecuted === false
    && d.integrity?.denoiserStateSha256Before === d.integrity?.denoiserStateSha256After
    && d.integrity?.autoencoderStateSha256Before === d.integrity?.autoencoderStateSha256After
    && d.oldDenoiserCheckpointRead === false
    && d.optimizerCreated === false
    && d.backwardMethodExecuted === false
    && d.modelWeightsModified === false
    && d.checkpointWritten === false
    && d.trainingStarted === false
    && candidate.telemetry.status === "collected_after_readonly_forward_and_autograd_grad"
    && candidate.telemetry.deviceIndex === 0
    && c.status === "early_convergence_gpu_qualification_finalization_cpu_contract_passed"
    && c.positivePassed === c.positiveTotal
    && c.negativePassed === c.negativeTotal
    && early.enabled === true
    && early.status === "cpu_support_verified_inactive"
    && early.contractId === CONTRACT_ID
    && early.replayBudget?.addsReplayPasses === false
    && early.replayBudget?.addsOptimizerSteps === false
  )
}

const source = { terminal, diagnostic, telemetry, cpu: continuationCpu, config: sourceConfig }
const inactiveGateProbe = clone(sourceConfig)
inactiveGateProbe.training.trainingAuthorizationStatus = "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
delete inactiveGateProbe.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs
inactiveGateProbe.training.ownerTrainingAuthorization = buildInactiveOwnerAuthorization()
for (const name of ["stage4FullRolloutFinalVisibleConsistency", "stage4EpochWorstSampleClassReplay"]) {
  closeInactiveTrainingContract(inactiveGateProbe.training, name, "cpu_support_verified_inactive")
}
const positive = {
  immutableQualificationValid: validateQualification(source),
  exactObjective: diagnostic.identity.trainingObjectiveContractId === CONTRACT_ID,
  exactSample194: diagnostic.identity.sampleId === SAMPLE_ID,
  exactSeed: diagnostic.identity.seed === 20263722,
  exactResolution: diagnostic.identity.resolution?.width === 256 && diagnostic.identity.resolution?.height === 192,
  exactWestTopology: JSON.stringify(diagnostic.identity.requiredBoundarySides) === JSON.stringify(["west"]),
  exactFourObjects: JSON.stringify(diagnostic.identity.objectSemanticChannels) === JSON.stringify(CHANNELS),
  exactPyramid: JSON.stringify(diagnostic.identity.pyramidScales) === JSON.stringify(PYRAMID),
  exact48Metrics: diagnostic.diagnosticManifest.fieldCount === 48,
  exactTwoLanes: diagnostic.identity.replayLaneCount === 2,
  replayBudgetPreserved: sourceConfig.training.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization.replayBudget.addsReplayPasses === false,
  noOptimizerAdded: sourceConfig.training.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization.replayBudget.addsOptimizerSteps === false,
  denoiserUnchanged: diagnostic.integrity.denoiserStateSha256Before === diagnostic.integrity.denoiserStateSha256After,
  autoencoderUnchanged: diagnostic.integrity.autoencoderStateSha256Before === diagnostic.integrity.autoencoderStateSha256After,
  noFailedDenoiserRead: diagnostic.oldDenoiserCheckpointRead === false,
  continuationCpuPassed: continuationCpu.positivePassed === continuationCpu.positiveTotal && continuationCpu.negativePassed === continuationCpu.negativeTotal,
  fullRolloutInactiveGateClosed: inactiveContractIsClosed(inactiveGateProbe.training.stage4FullRolloutFinalVisibleConsistency, "cpu_support_verified_inactive", FORMAL_INACTIVE_GATE_FIELDS.stage4FullRolloutFinalVisibleConsistency),
  epochWorstReplayInactiveGateClosed: inactiveContractIsClosed(inactiveGateProbe.training.stage4EpochWorstSampleClassReplay, "cpu_support_verified_inactive", FORMAL_INACTIVE_GATE_FIELDS.stage4EpochWorstSampleClassReplay),
  inactiveDiagnosticRegistryExact: inactiveDiagnosticRegistryIsValid(inactiveGateProbe),
  activeDiagnosticRegistryExact: activeDiagnosticRegistryIsValid(withActiveSmokeDiagnosticRegistry(inactiveGateProbe)),
  inactiveOwnerAuthorizationClosed: inactiveOwnerAuthorizationIsClosed(inactiveGateProbe),
}
const mutations = {
  rejectWrongTerminal: (x) => { x.terminal.status = "wrong" },
  rejectWrongReportHash: (x) => { x.terminal.reportSha256 = "0".repeat(64) },
  rejectWrongObjective: (x) => { x.diagnostic.identity.trainingObjectiveContractId = "wrong" },
  rejectWrongLaneCount: (x) => { x.diagnostic.identity.replayLaneCount = 1 },
  rejectWrongMetricCount: (x) => { x.diagnostic.diagnosticManifest.fieldCount = 47 },
  rejectZeroObjectGradient: (x) => { x.diagnostic.gradientEvidence.fourObjectVisibleStructure.tree.denoiserGradientNorm = 0 },
  rejectZeroExpertGradient: (x) => { x.diagnostic.gradientEvidence.fourObjectVisibleStructure.rock.matchingSemanticMixtureExpertGradientNorm = 0 },
  rejectZeroLane1Gradient: (x) => { x.diagnostic.gradientEvidence.twoLaneEarlyConvergenceStabilization.lane1DenoiserGradientNorm = 0 },
  rejectZeroLane2Gradient: (x) => { x.diagnostic.gradientEvidence.twoLaneEarlyConvergenceStabilization.lane2DenoiserGradientNorm = 0 },
  rejectReplayPassAddition: (x) => { x.diagnostic.gradientEvidence.twoLaneEarlyConvergenceStabilization.replayPassesAdded = 1 },
  rejectDenoiserMutation: (x) => { x.diagnostic.integrity.denoiserStateSha256After = "0".repeat(64) },
  rejectOptimizer: (x) => { x.diagnostic.optimizerCreated = true },
  rejectBackward: (x) => { x.diagnostic.backwardMethodExecuted = true },
  rejectTraining: (x) => { x.diagnostic.trainingStarted = true },
  rejectCpuFailure: (x) => { x.cpu.positivePassed -= 1 },
  rejectInactiveContractChange: (x) => { x.config.training.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization.contractId = "wrong" },
  rejectExtraReplayBudget: (x) => { x.config.training.stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization.replayBudget.addsReplayPasses = true },
}
const negative = Object.fromEntries(Object.entries(mutations).map(([name, mutation]) => {
  const candidate = clone(source)
  mutation(candidate)
  return [name, validateQualification(candidate) === false]
}))
for (const [name, mutate] of Object.entries({
  rejectFullRolloutPartialActivation: (config) => { config.training.stage4FullRolloutFinalVisibleConsistency.activationGate.trainingNow = true },
  rejectEpochWorstReplayPartialActivation: (config) => { config.training.stage4EpochWorstSampleClassReplay.activationGate.smokeNow = true },
  rejectFullRolloutWrongInactiveStatus: (config) => { config.training.stage4FullRolloutFinalVisibleConsistency.status = "training_loss_active_owner_authorized" },
  rejectEpochWorstReplayUnknownGate: (config) => { config.training.stage4EpochWorstSampleClassReplay.activationGate.unknownNow = false },
  rejectFullRolloutMissingGate: (config) => { delete config.training.stage4FullRolloutFinalVisibleConsistency.activationGate.trainingNow },
  rejectEpochWorstReplayReplacementGate: (config) => {
    delete config.training.stage4EpochWorstSampleClassReplay.activationGate.smokeNow
    config.training.stage4EpochWorstSampleClassReplay.activationGate.replacementNow = false
  },
  rejectInactiveSmokeFixedEpochs: (config) => { config.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs = [1, 5, 10, 20, 30] },
  rejectActiveSmokeMissingFixedEpochs: (config) => { delete config.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs },
  rejectActiveSmokeWrongFixedEpochs: (config) => { config.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs = [1, 5, 10, 30] },
  rejectInactiveReducedOwnerAuthorization: (config) => { config.training.ownerTrainingAuthorization = { authorizationId: REQUEST_ID, status: "not_authorized_cpu_support_only" } },
})) {
  const candidate = clone(inactiveGateProbe)
  const activeRegistryCase = name.startsWith("rejectActiveSmoke")
  const target = activeRegistryCase ? withActiveSmokeDiagnosticRegistry(candidate) : candidate
  mutate(target)
  negative[name] = activeRegistryCase
    ? !activeDiagnosticRegistryIsValid(target)
    : !(inactiveSmokeGatesAreClosed(target) && inactiveDiagnosticRegistryIsValid(target) && inactiveOwnerAuthorizationIsClosed(target))
}
const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([name]) => name)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([name]) => name)
const pureReport = {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-smoke-entry-integration-cpu-contract-v1",
  status: failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0
    ? "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed"
    : "early_convergence_smoke_entry_integration_cpu_contract_failed_closed",
  positive,
  negative,
  positivePassed: Object.values(positive).filter(Boolean).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter(Boolean).length,
  negativeTotal: Object.keys(negative).length,
  failedPositiveKeys,
  failedNegativeKeys,
  gpuUsedNow: false,
  cudaInitializedNow: false,
  autogradExecutedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  optimizerCreatedNow: false,
  backwardExecutedNow: false,
  trainingStartedNow: false,
  validationStartedNow: false,
  smokeStartedNow: false,
}

if (!process.argv.includes("--record")) {
  console.log(JSON.stringify(pureReport, null, 2))
  process.exitCode = failedPositiveKeys.length === 0 && failedNegativeKeys.length === 0 ? 0 : 1
} else {
  assert.equal(failedPositiveKeys.length, 0, `positive_contract_failed:${failedPositiveKeys.join(",")}`)
  assert.equal(failedNegativeKeys.length, 0, `negative_contract_failed:${failedNegativeKeys.join(",")}`)
  const output = projectFile(OUTPUT)
  const registryPath = projectFile(REGISTRY_PATH)
  const futureAuthorizationPath = projectFile(`.runtime/ai-painter/owner-action-requests/${authorization.execution.futureGpuSmokeRequestId}/authorization.json`)
  assert.equal(fs.existsSync(output), false, "integration_output_exists")
  assert.equal(fs.existsSync(registryPath), false, "registry_exists")
  assert.equal(fs.existsSync(futureAuthorizationPath), false, "future_gpu_smoke_authorization_exists")
  fs.mkdirSync(output, { recursive: true })
  const files = {
    cpu: path.join(output, "cpu-contract-report.json"),
    inactive: path.join(output, "inactive-smoke-config.json"),
    support: path.join(output, "training-objective-support-contract.json"),
    registration: path.join(output, "registration-terminal.json"),
    attestation: path.join(output, "implementation-attestation.json"),
    fixture: path.join(output, "proposed-gpu-smoke-authorization-cpu-fixture.json"),
    preflight: path.join(output, "cpu-contract-only-preflight-report.json"),
    report: path.join(output, "implementation-report.json"),
    inactiveGpu: path.join(output, "inactive-gpu-smoke-contract.json"),
    owner: path.join(output, "owner-action-request.json"),
    terminal: path.join(output, "phase-terminal.json"),
    capsule: path.join(output, "local-task-capsule.json"),
  }
  const now = new Date().toISOString()
  const shanghai = formatShanghai(now)
  writeExclusive(files.cpu, { ...pureReport, recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })

  const inactiveConfig = clone(sourceConfig)
  const training = inactiveConfig.training
  training.trainingAuthorizationStatus = "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
  delete training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs
  training.denoiserEpochs = 30
  delete training.factConditionedSemanticMixtureStage4FullTrainingContract
  delete training.factConditionedSemanticMixtureStage4SingleSampleSmokeContract
  delete training.factConditionedSemanticMixtureStage4SmokeExecution
  delete training.stage4UnifiedTrainingPreviewSamplingContract
  training.ownerTrainingAuthorization = buildInactiveOwnerAuthorization()
  for (const contractName of [
    "stage4FactConditionedSemanticMixture",
    "stage4FullRolloutFinalVisibleConsistency",
    "stage4EpochWorstSampleClassReplay",
    "stage4ObjectReferenceMultiscaleLuminanceStructureSupervision",
    "stage4ObjectReferenceMultiscaleEarlyConvergenceStabilization",
  ]) {
    const contract = training[contractName]
    if (!contract) continue
    const inactiveStatus = contractName === "stage4FactConditionedSemanticMixture"
      ? "cpu_support_verified_not_active"
      : "cpu_support_verified_inactive"
    closeInactiveTrainingContract(training, contractName, inactiveStatus)
    if (contractName === "stage4FactConditionedSemanticMixture") contract.enabled = false
  }
  assert.equal(inactiveSmokeGatesAreClosed(inactiveConfig), true, "inactive_smoke_nested_activation_gate_not_closed")
  assert.equal(inactiveDiagnosticRegistryIsValid(inactiveConfig), true, "inactive_smoke_diagnostic_registry_not_exact")
  assert.equal(inactiveOwnerAuthorizationIsClosed(inactiveConfig), true, "inactive_smoke_owner_authorization_not_closed")
  training.stage4FailureDiagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
  training.stage4FailureDiagnostics.trainingConfigApplied = false
  training.stage4FailureDiagnostics.checkpointFileReadAuthorized = false
  training.stage4FailureDiagnostics.gpuUseAuthorized = false
  training.stage4FailureDiagnostics.trainingAuthorized = false
  writeExclusive(files.inactive, inactiveConfig)
  writeExclusive(files.support, {
    schemaVersion: "ai-painter-stage4-object-reference-multiscale-early-convergence-smoke-integration-support-v1",
    status: "early_convergence_two_lane_smoke_integration_inputs_registered_cpu_only",
    architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
    trainingObjectiveContractId: CONTRACT_ID,
    sampleId: SAMPLE_ID,
    seed: 20263722,
    resolution: { width: 256, height: 192 },
    requiredBoundarySides: ["west"],
    objectSemanticChannels: CHANNELS,
    pyramidScales: PYRAMID,
    replayLaneCount: 2,
    diagnosticManifestFields: diagnostic.diagnosticManifest.fields,
    diagnosticCheckpointReadAuthorized: false,
    oldDenoiserCheckpointReadAuthorized: false,
    gpuAuthorized: false,
    trainingAuthorized: false,
    validationAuthorized: false,
    smokeAuthorized: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })
  writeExclusive(files.registration, {
    schemaVersion: "ai-painter-stage4-object-reference-multiscale-early-convergence-smoke-entry-registration-terminal-v1",
    status: "early_convergence_smoke_entry_inputs_registered_cpu_succeeded_closed",
    authorization: bind(authorizationPath),
    consumption: bind(consumptionPath),
    sources: {
      gpuTerminal: bind(projectFile(authorization.bindings.gpuTerminal.path)),
      diagnosticReport: bind(projectFile(authorization.bindings.diagnosticReport.path)),
      cudaTelemetry: bind(projectFile(authorization.bindings.cudaTelemetry.path)),
      continuationCpuReport: bind(continuationCpuPath),
      inactiveConfig: bind(files.inactive),
      trainingObjectiveSupportContract: bind(files.support),
    },
    gpuStarted: false,
    cudaInitialized: false,
    checkpointRead: false,
    modelLoaded: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })
  const registrationBinding = bind(files.registration)
  const registry = buildStage4EvidenceEligibilityRegistry({
    root: ROOT,
    registryId: REGISTRY_ID,
    authorization: bind(authorizationPath),
    reusableEvidence: [
      reusable("stage4.finalVisibleRgb.gpuQualificationTerminal", projectFile(authorization.bindings.gpuTerminal.path), registrationBinding),
      reusable("stage4.finalVisibleRgb.gpuDiagnosticReport", projectFile(authorization.bindings.diagnosticReport.path), registrationBinding),
      reusable("stage4.finalVisibleRgb.cudaTelemetry", projectFile(authorization.bindings.cudaTelemetry.path), registrationBinding),
      reusable("stage4.finalVisibleRgb.cpuAuthorizationReport", continuationCpuPath, registrationBinding),
      reusable("stage4.finalVisibleRgb.inactiveConfig", files.inactive, registrationBinding),
      reusable("stage4.finalVisibleRgb.trainingObjectiveSupportContract", files.support, registrationBinding),
    ],
    historicalEvidence: [],
    recordedAtUtc: now,
  })
  const registryBinding = materializeStage4EvidenceRegistry({ root: ROOT, registry, registryPath: REGISTRY_PATH })
  const registryValue = read(registryPath)
  const role = (name) => ({ path: registryValue.roles[name].canonicalPath, sha256: registryValue.roles[name].sha256 })

  const runnerPath = projectFile(RUNNER)
  const recorderPath = projectFile(RECORDER)
  const checkerPath = projectFile(CHECKER)
  writeExclusive(files.attestation, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-smoke-entry-integration-attestation-v1",
    status: "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified",
    authorizationSha256: AUTH_SHA,
    consumptionSha256: CONSUMPTION_SHA,
    cpuReportSha256: sha(files.cpu),
    runnerSha256: sha(runnerPath),
    recorderSha256: sha(recorderPath),
    integrationCheckerSha256: sha(checkerPath),
    trainerSha256: sha(projectFile(TRAINER)),
    cpuCheckerSha256: sha(projectFile(CPU_CHECKER)),
    modeRegistrySha256: sha(projectFile(MODE_REGISTRY)),
    modelChanged: false,
    trainerChanged: false,
    lossChanged: false,
    dataChanged: false,
    sourceConfigChanged: false,
    reviewThresholdsChanged: false,
    gpuUsedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })

  const futureRequestId = authorization.execution.futureGpuSmokeRequestId
  const executionId = futureRequestId.match(/([0-9]{8}-[0-9]{9})$/)?.[1]
  assert.ok(executionId, "future_gpu_smoke_execution_id_invalid")
  const proposedAuthorization = {
    schemaVersion: "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1",
    requestId: futureRequestId,
    commandRef: futureRequestId,
    scope: "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only",
    status: "resolved_owner_authorized_not_consumed",
    executionActions: ACTIONS,
    explicitlyDeniedActions: DENIED,
    taskIdentity: {
      modeId: "fact_conditioned_semantic_mixture_stage4_smoke",
      architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
      trainingObjectiveContractId: CONTRACT_ID,
      sampleId: SAMPLE_ID,
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
      objectSemanticChannels: CHANNELS,
      pyramidScales: PYRAMID,
      replayLaneCount: 2,
      diagnosticManifestFields: diagnostic.diagnosticManifest.fields,
    },
    bindings: {
      implementationAuthorization: bind(authorizationPath),
      implementationConsumption: bind(consumptionPath),
      readonlyGpuTerminal: role("stage4.finalVisibleRgb.gpuQualificationTerminal"),
      readonlyGpuDiagnostic: role("stage4.finalVisibleRgb.gpuDiagnosticReport"),
      cudaTelemetry: role("stage4.finalVisibleRgb.cudaTelemetry"),
      readonlyCpuReport: role("stage4.finalVisibleRgb.cpuAuthorizationReport"),
      inactiveConfig: role("stage4.finalVisibleRgb.inactiveConfig"),
      architectureSupportContract: role("stage4.finalVisibleRgb.trainingObjectiveSupportContract"),
      datasetManifest: gpuAuthorization.bindings.datasetManifest,
      datasetSourceIndex: gpuAuthorization.bindings.datasetSourceIndex,
      projectAutoencoderCheckpoint: gpuAuthorization.bindings.projectAutoencoderCheckpoint,
      conditionAlignmentAuditor: bind(projectFile(AUDITORS.conditionAlignmentAuditor)),
      professionalAestheticAuditor: bind(projectFile(AUDITORS.professionalAestheticAuditor)),
      windowsSafePreviewNormalizer: bind(projectFile(AUDITORS.windowsSafePreviewNormalizer)),
      gpuResourceGate: bind(projectFile(AUDITORS.gpuResourceGate)),
      cpuReport: bind(files.cpu),
      implementationAttestation: bind(files.attestation),
      executionEvidenceRegistry: registryBinding,
    },
    codeBindings: {
      authorizationPolicy: bind(projectFile(POLICY)),
      executionGrant: bind(projectFile(GRANT)),
      modeRegistry: bind(projectFile(MODE_REGISTRY)),
      trainer: bind(projectFile(TRAINER)),
      runner: bind(runnerPath),
      cpuChecker: bind(projectFile(CPU_CHECKER)),
      model: bind(projectFile(MODEL)),
      inactiveConfigCompiler: bind(projectFile(COMPILER)),
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
  writeExclusive(files.fixture, proposedAuthorization)

  const environment = { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1" }
  const syntaxResults = []
  for (const target of [runnerPath, recorderPath, checkerPath]) {
    const result = spawnSync(process.execPath, ["--check", target], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
    syntaxResults.push({ path: relative(target), exitCode: result.status, stderr: result.stderr })
    assert.equal(result.status, 0, `node_syntax_failed:${relative(target)}:${result.stderr}`)
  }
  for (const target of [TRAINER, CPU_CHECKER]) {
    const result = spawnSync(
      projectFile("ml/ai-painter/.venv/Scripts/python.exe"),
      ["-B", "-c", "import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))", projectFile(target)],
      { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true },
    )
    syntaxResults.push({ path: target, exitCode: result.status, stderr: result.stderr })
    assert.equal(result.status, 0, `python_syntax_failed:${target}:${result.stderr}`)
  }
  const runCpuContract = (fixturePath) => spawnSync(process.execPath, [
    runnerPath,
    "--stage4-fact-conditioned-semantic-mixture-model-smoke",
    "--gpu-authorization", relative(fixturePath),
    "--gpu-authorization-sha256", sha(fixturePath),
    "--cpu-contract-only",
  ], { cwd: ROOT, encoding: "utf8", env: environment, windowsHide: true })
  const forward = runCpuContract(files.fixture)
  assert.equal(forward.status, 0, `cpu_contract_only_forward_failed:${forward.stderr || forward.stdout}`)
  const negativeDirectory = path.join(output, "negative-fixtures")
  fs.mkdirSync(negativeDirectory, { recursive: true })
  const runnerNegative = {}
  const futureMutations = {
    rejectWrongObjective: (x) => { x.taskIdentity.trainingObjectiveContractId = "wrong" },
    rejectWrongReplayLaneCount: (x) => { x.taskIdentity.replayLaneCount = 1 },
    rejectNoncanonicalTerminalPath: (x) => { x.bindings.readonlyGpuTerminal.path = authorization.bindings.gpuTerminal.path },
    rejectUnknownRequestIdentity: (x) => { x.requestId = "owner-authorized-stage4-unknown-30-epoch-model-smoke-20260815-220000000"; x.commandRef = x.requestId },
  }
  for (const [name, mutation] of Object.entries(futureMutations)) {
    const candidate = clone(proposedAuthorization)
    mutation(candidate)
    const fixture = path.join(negativeDirectory, `${name}.json`)
    writeExclusive(fixture, candidate)
    const result = runCpuContract(fixture)
    runnerNegative[name] = { rejected: result.status !== 0, exitCode: result.status, stderr: result.stderr.trim() }
    assert.notEqual(result.status, 0, `negative_cpu_contract_not_rejected:${name}`)
  }
  writeExclusive(files.preflight, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-smoke-entry-cpu-preflight-v1",
    status: "early_convergence_smoke_entry_cpu_contract_only_preflight_passed",
    syntaxResults,
    forward: { passed: true, exitCode: forward.status, stdout: forward.stdout, stderr: forward.stderr },
    negative: runnerNegative,
    gpuUsed: false,
    cudaInitialized: false,
    checkpointRead: false,
    modelLoaded: false,
    optimizerCreated: false,
    autogradExecuted: false,
    backwardExecuted: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })
  writeExclusive(files.report, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-smoke-entry-integration-report-v1",
    status: "early_convergence_30_epoch_smoke_entry_integration_cpu_succeeded_closed",
    authorization: bind(authorizationPath),
    consumption: bind(consumptionPath),
    sourceQualification: {
      gpuTerminal: authorization.bindings.gpuTerminal,
      diagnosticReport: authorization.bindings.diagnosticReport,
      cudaTelemetry: authorization.bindings.cudaTelemetry,
      continuationCpuReport: bind(continuationCpuPath),
    },
    inactiveConfig: bind(files.inactive),
    trainingObjectiveSupportContract: bind(files.support),
    registrationTerminal: bind(files.registration),
    executionEvidenceRegistry: registryBinding,
    cpuContractReport: bind(files.cpu),
    implementationAttestation: bind(files.attestation),
    cpuContractOnlyPreflight: bind(files.preflight),
    proposedGpuSmokeAuthorizationFixture: bind(files.fixture),
    sourceChanges: {
      runner: bind(runnerPath),
      recorder: bind(recorderPath),
      checker: bind(checkerPath),
      trainerFrozen: true,
      modelFrozen: true,
      lossFrozen: true,
      dataFrozen: true,
      sourceConfigFrozen: true,
      reviewThresholdsFrozen: true,
    },
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    gpuUsedNow: false,
    cudaInitializedNow: false,
    checkpointReadNow: false,
    modelLoadedNow: false,
    trainingStartedNow: false,
    validationStartedNow: false,
    smokeStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })
  writeExclusive(files.inactiveGpu, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-30-epoch-gpu-smoke-inactive-contract-v1",
    status: "inactive_owner_gpu_smoke_authorization_required",
    proposedAuthorization,
    implementationReport: bind(files.report),
    authorizedNow: false,
    consumedNow: false,
    gpuUsedNow: false,
    trainingStartedNow: false,
    validationStartedNow: false,
    smokeStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })
  writeExclusive(files.owner, {
    schemaVersion: "ai-painter-owner-action-request-preview-v1",
    status: "not_authorized_not_consumed",
    requestedAction: "execute_one_independent_early_convergence_two_lane_30_epoch_semantic_mixture_gpu_smoke",
    requestedAuthorizationPath: relative(futureAuthorizationPath),
    proposedAuthorization,
    boundImplementationReport: bind(files.report),
    boundInactiveGpuContract: bind(files.inactiveGpu),
    automaticApproval: false,
    gpuExecutedNow: false,
    smokeExecutedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })
  writeExclusive(files.terminal, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-smoke-entry-integration-terminal-v1",
    status: "early_convergence_30_epoch_smoke_entry_integration_cpu_succeeded_closed",
    implementationReport: bind(files.report),
    inactiveGpuSmokeContract: bind(files.inactiveGpu),
    ownerActionRequest: bind(files.owner),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: "owner_authorize_exact_proposed_early_convergence_30_epoch_gpu_smoke_or_exit",
    gpuUsedNow: false,
    cudaInitializedNow: false,
    checkpointReadNow: false,
    modelLoadedNow: false,
    trainingStartedNow: false,
    validationStartedNow: false,
    smokeStartedNow: false,
    automaticRetryStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })
  writeExclusive(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    status: "early_convergence_30_epoch_smoke_entry_integration_cpu_succeeded_closed",
    module: "AI Painter R5",
    currentStage: "Two-lane early-convergence 30 Epoch GPU Smoke entry ready but inactive",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    terminal: bind(files.terminal),
    ownerActionRequest: bind(files.owner),
    latestBlocker: "immutable_owner_gpu_smoke_authorization_not_created_or_consumed",
    nextLegalAction: "owner_authorize_exact_proposed_early_convergence_30_epoch_gpu_smoke_or_exit",
    gpuUsedNow: false,
    trainingStartedNow: false,
    validationStartedNow: false,
    smokeStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: shanghai,
  })

  const indexedFiles = [authorizationPath, consumptionPath, runnerPath, recorderPath, checkerPath, registryPath, ...Object.values(files)]
  for (const file of indexedFiles) {
    const stat = fs.statSync(file)
    indexArtifact({
      logicalPath: logicalProjectPath(file),
      physicalUri: fs.realpathSync(file),
      storageLayer: "hot",
      runId: REQUEST_ID,
      byteSize: stat.size,
      modifiedAtUtc: stat.mtime.toISOString(),
      sha256: sha(file),
    })
  }
  appendAiPainterProgramEvent({
    id: `stage4-object-reference-multiscale-early-convergence-smoke-entry-integration-${REQUEST_ID}`,
    timestamp: now,
    action: "stage4_object_reference_multiscale_early_convergence_smoke_entry_cpu_integration",
    runId: REQUEST_ID,
    kind: "cpu_only_smoke_entry_integration",
    status: "success",
    title: "Early-convergence two-lane 30 Epoch Smoke entry integrated CPU-only",
    titleZh: "双通道早期收敛 30 Epoch Smoke 入口已完成 CPU 有界集成",
    detailZh: `CPU 正向 ${pureReport.positivePassed}/${pureReport.positiveTotal}、反向 ${pureReport.negativePassed}/${pureReport.negativeTotal}，Smoke cpu-contract-only 正向通过且 4 个负向均拒绝；未启动 GPU、CUDA、模型、Checkpoint、训练、验证或 Smoke。`,
    evidencePath: relative(files.terminal),
    evidenceSha256: sha(files.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  for (const file of [registryPath, ...Object.values(files)]) fs.chmodSync(file, 0o444)
  closeStorageCatalog()
  console.log(JSON.stringify({
    status: read(files.terminal).status,
    cpuContractReport: bind(files.cpu),
    cpuContractOnlyPreflight: bind(files.preflight),
    implementationReport: bind(files.report),
    inactiveGpuSmokeContract: bind(files.inactiveGpu),
    ownerActionRequest: bind(files.owner),
    terminal: bind(files.terminal),
    capsule: bind(files.capsule),
  }, null, 2))
}

function closeInactiveTrainingContract(training, name, inactiveStatus) {
  const contract = training[name]
  if (!contract) return
  contract.status = inactiveStatus
  for (const key of Object.keys(contract.activationGate ?? {})) contract.activationGate[key] = false
}

function inactiveContractIsClosed(contract, inactiveStatus, expectedGateNames) {
  if (!contract || contract.status !== inactiveStatus || !contract.activationGate) return false
  const gateNames = Object.keys(contract.activationGate).sort()
  return gateNames.length > 0
    && JSON.stringify(gateNames) === JSON.stringify(expectedGateNames)
    && gateNames.every((key) => contract.activationGate[key] === false)
}

function inactiveSmokeGatesAreClosed(config) {
  const training = config.training ?? {}
  return training.trainingAuthorizationStatus === "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
    && inactiveContractIsClosed(training.stage4FullRolloutFinalVisibleConsistency, "cpu_support_verified_inactive", FORMAL_INACTIVE_GATE_FIELDS.stage4FullRolloutFinalVisibleConsistency)
    && inactiveContractIsClosed(training.stage4EpochWorstSampleClassReplay, "cpu_support_verified_inactive", FORMAL_INACTIVE_GATE_FIELDS.stage4EpochWorstSampleClassReplay)
}

function inactiveDiagnosticRegistryIsValid(config) {
  const registry = config.training?.stage4FactConditionedSemanticMixture?.diagnosticManifestRegistry
  if (!registry) return false
  const expectedKeys = ["configurationProvenance", "exactFieldCount", "exactFields", "registrationDecisionBindings", "rejectUnknownFields"].sort()
  return JSON.stringify(Object.keys(registry).sort()) === JSON.stringify(expectedKeys)
    && registry.exactFieldCount === diagnostic.diagnosticManifest.fields.length
    && JSON.stringify(registry.exactFields) === JSON.stringify(diagnostic.diagnosticManifest.fields)
    && registry.rejectUnknownFields === true
}

function withActiveSmokeDiagnosticRegistry(config) {
  const value = clone(config)
  value.training.stage4FactConditionedSemanticMixture.diagnosticManifestRegistry.fixedEpochs = [1, 5, 10, 20, 30]
  return value
}

function activeDiagnosticRegistryIsValid(config) {
  const registry = config.training?.stage4FactConditionedSemanticMixture?.diagnosticManifestRegistry
  if (!registry) return false
  const expectedKeys = ["configurationProvenance", "exactFieldCount", "exactFields", "fixedEpochs", "registrationDecisionBindings", "rejectUnknownFields"].sort()
  return JSON.stringify(Object.keys(registry).sort()) === JSON.stringify(expectedKeys)
    && JSON.stringify(registry.fixedEpochs) === JSON.stringify([1, 5, 10, 20, 30])
    && registry.exactFieldCount === diagnostic.diagnosticManifest.fields.length
    && JSON.stringify(registry.exactFields) === JSON.stringify(diagnostic.diagnosticManifest.fields)
    && registry.rejectUnknownFields === true
}

function inactiveOwnerAuthorizationIsClosed(config) {
  const owner = config.training?.ownerTrainingAuthorization
  const expectedFlags = [
    "checkpointLoadingAuthorized", "optimizerCreationAuthorized", "backwardExecutionAuthorized",
    "modelWeightMutationAuthorized", "gpuTrainingAuthorizedNow", "singleSampleGpuOverfitSmokeAuthorized",
    "fullTrainingAuthorized", "stage1Authorized", "stage2Authorized", "strictRevalidationAuthorized",
    "validationAuthorized", "formalInferenceAuthorized", "checkpointPromotionAuthorized",
    "runtimeFrameAuthorized", "worldEntryAuthorized", "automaticRetryAuthorized",
  ]
  return owner?.authorizationId === REQUEST_ID
    && owner?.requestId === REQUEST_ID
    && owner?.commandRef === REQUEST_ID
    && owner?.scope === SCOPE
    && owner?.authorizationPath === relative(authorizationPath)
    && owner?.authorizationSha256 === AUTH_SHA
    && owner?.executionConsumptionPath === relative(consumptionPath)
    && owner?.executionConsumptionSha256 === CONSUMPTION_SHA
    && owner?.executionState === "consumed"
    && owner?.status === "not_authorized_cpu_support_only"
    && expectedFlags.every((key) => owner[key] === false)
}

function buildInactiveOwnerAuthorization() {
  return {
    authorizationId: REQUEST_ID,
    requestId: REQUEST_ID,
    commandRef: REQUEST_ID,
    scope: SCOPE,
    authorizationPath: relative(authorizationPath),
    authorizationSha256: AUTH_SHA,
    executionConsumptionPath: relative(consumptionPath),
    executionConsumptionSha256: CONSUMPTION_SHA,
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
}
