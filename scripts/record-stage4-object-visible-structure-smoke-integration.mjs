import assert from "node:assert/strict"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS,
  compilePhase0DerivedConfig,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-execution.mjs"
import {
  buildStage4EvidenceEligibilityRegistry,
  materializeStage4EvidenceRegistry,
} from "./lib/ai-painter-stage4-evidence-eligibility.mjs"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-smoke-integration-20260815-061900000"
const AUTHORIZATION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/authorization.json`
const AUTHORIZATION_SHA256 = "221b1a42515e6489bd621510adff450ce9d2ba8ba4b57f934815d613bef30716"
const CONSUMPTION_PATH = `.runtime/ai-painter/owner-action-requests/${REQUEST_ID}/consumption.json`
const CONSUMPTION_SHA256 = "42b58f103d488a7ab43e1c29d655a19bd96ca89af398808d37ed09db6b6cd679"
const OUTPUT_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-smoke-integrations/20260815-061900000"
const REGISTRY_ID = "20260815-062000000"
const REGISTRY_PATH = `.runtime/ai-painter/stage4-execution-evidence-eligibility/${REGISTRY_ID}/registry.json`
const PYTHON = "ml/ai-painter/.venv/Scripts/python.exe"
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py"
const RUNNER = "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const MODEL = "ml/ai-painter/src/ai_painter/complete_world/model.py"
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260814-154900000-stage0/active-config.json"
const INACTIVE_FRAGMENT = ".runtime/ai-painter/stage4-object-visible-structure-supervision/20260815-002000000/inactive-config-fragment.json"
const PHASE0_TERMINAL = ".runtime/ai-painter/stage4-object-visible-structure-phase0-executions/20260815-093000000/finalization/phase-terminal.json"
const PHASE0_FINALIZATION = ".runtime/ai-painter/stage4-object-visible-structure-phase0-executions/20260815-093000000/finalization/finalization-report.json"
const PHASE0_UPDATE = ".runtime/ai-painter/stage4-object-visible-structure-phase0-executions/20260815-093000000/update/phase0-update-report.json"
const PHASE0_CPU_REPORT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-nested-mode-validator-context-corrections/20260815-090000000/cpu-contract-report.json"
const DATASET_MANIFEST = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const DATASET_SOURCE_INDEX = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
const AUTOENCODER = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"

const authorization = readVerifiedJson(AUTHORIZATION_PATH, AUTHORIZATION_SHA256)
const consumption = readVerifiedJson(CONSUMPTION_PATH, CONSUMPTION_SHA256)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(consumption.status, "stage4_object_visible_structure_smoke_integration_implementation_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
assert.equal(consumption.oneTimeConsumption, true)
assert.equal(fs.existsSync(resolve(OUTPUT_ROOT)), false, "smoke integration output already exists")
assert.equal(fs.existsSync(resolve(REGISTRY_PATH)), false, "smoke integration registry already exists")
verifyAuthorizationBindings(authorization)
assert.equal(sha256File(TRAINER), authorization.bindings.trainerFrozen.sha256)
assert.equal(sha256File(MODEL), authorization.bindings.modelFrozen.sha256)

fs.mkdirSync(resolve(OUTPUT_ROOT), { recursive: true })
appendAiPainterProgramEvent({
  action: "record_stage4_object_visible_structure_smoke_integration",
  runId: "20260815-061900000",
  kind: "stage4_object_visible_structure_smoke_integration_started",
  status: "running",
  title: "Stage 4 object visible-structure Smoke integration started",
  titleZh: "Stage 4 四对象可见结构 Smoke 衔接已开始",
  detail: "CPU-only inactive configuration, evidence registration, and positive/negative contract regression",
  detailZh: "仅执行 CPU 未激活配置、证据注册和正反合同回归",
  script: projectPath(import.meta.filename),
  currentStep: "build_inactive_smoke_config",
  evidencePath: AUTHORIZATION_PATH,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const inactiveConfigPath = `${OUTPUT_ROOT}/inactive-smoke-config.json`
const supportContractPath = `${OUTPUT_ROOT}/training-objective-support-contract.json`
const registrationTerminalPath = `${OUTPUT_ROOT}/registration-terminal.json`
const cpuReportPath = `${OUTPUT_ROOT}/cpu-report.json`
const implementationAttestationPath = `${OUTPUT_ROOT}/implementation-attestation.json`
const reportPath = `${OUTPUT_ROOT}/implementation-report.json`
const terminalPath = `${OUTPUT_ROOT}/phase-terminal.json`
const capsulePath = `${OUTPUT_ROOT}/local-task-capsule.json`
const ownerRequestPath = `${OUTPUT_ROOT}/owner-action-request.json`

const inactiveConfig = buildInactiveSmokeConfig(
  readVerifiedJson(SOURCE_CONFIG, authorization.bindings.sourceConfig.sha256),
  readVerifiedJson(INACTIVE_FRAGMENT, authorization.bindings.inactiveObjectFragment.sha256),
)
writeImmutableJson(inactiveConfigPath, inactiveConfig)

const supportContract = {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-integration-support-v1",
  status: "stage4_object_visible_structure_smoke_integration_inputs_registered_cpu_only",
  recordedAtUtc: new Date().toISOString(),
  architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: "stage4_four_typed_object_visible_structure_supervision_v1",
  diagnosticManifestFields: [...OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS],
  phase0Terminal: binding(PHASE0_TERMINAL),
  phase0Finalization: binding(PHASE0_FINALIZATION),
  phase0Update: binding(PHASE0_UPDATE),
  diagnosticCheckpointReadAuthorized: false,
  oldOrFailedDenoiserCheckpointReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  smokeAuthorized: false,
}
writeImmutableJson(supportContractPath, supportContract)

const registrationTerminal = {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-input-registration-terminal-v1",
  status: "stage4_object_visible_structure_smoke_input_registration_succeeded_closed",
  recordedAtUtc: new Date().toISOString(),
  authorization: binding(AUTHORIZATION_PATH),
  phase0Terminal: binding(PHASE0_TERMINAL),
  phase0Finalization: binding(PHASE0_FINALIZATION),
  phase0Update: binding(PHASE0_UPDATE),
  phase0CpuReport: binding(PHASE0_CPU_REPORT),
  inactiveConfig: binding(inactiveConfigPath),
  supportContract: binding(supportContractPath),
  gpuStarted: false,
  trainingStarted: false,
}
writeImmutableJson(registrationTerminalPath, registrationTerminal)

const phase0TerminalBinding = binding(PHASE0_TERMINAL)
const registrationTerminalBinding = binding(registrationTerminalPath)
const registry = buildStage4EvidenceEligibilityRegistry({
  root: ROOT,
  registryId: REGISTRY_ID,
  authorization: binding(AUTHORIZATION_PATH),
  reusableEvidence: [
    reusable("stage4.finalVisibleRgb.gpuQualificationTerminal", PHASE0_TERMINAL, phase0TerminalBinding),
    reusable("stage4.finalVisibleRgb.gpuDiagnosticReport", PHASE0_FINALIZATION, phase0TerminalBinding),
    reusable("stage4.finalVisibleRgb.cudaTelemetry", PHASE0_UPDATE, phase0TerminalBinding, [binding(PHASE0_FINALIZATION)]),
    reusable("stage4.finalVisibleRgb.cpuAuthorizationReport", PHASE0_CPU_REPORT, registrationTerminalBinding),
    reusable("stage4.finalVisibleRgb.inactiveConfig", inactiveConfigPath, registrationTerminalBinding),
    reusable("stage4.finalVisibleRgb.trainingObjectiveSupportContract", supportContractPath, registrationTerminalBinding),
  ],
  historicalEvidence: [],
})
const registryBinding = materializeStage4EvidenceRegistry({ root: ROOT, registry, registryPath: REGISTRY_PATH })

const cpu = spawnSync(resolve(PYTHON), [
  resolve(CHECKER),
  "--fact-conditioned-semantic-mixture-stage4-smoke-contract",
  "--report", resolve(cpuReportPath),
  "--implementation-attestation", resolve(implementationAttestationPath),
  "--implementation-authorization", resolve(AUTHORIZATION_PATH),
  "--implementation-consumption", resolve(CONSUMPTION_PATH),
], { cwd: ROOT, encoding: "utf8", windowsHide: true })
if (cpu.status !== 0) {
  writeImmutableJson(terminalPath, {
    schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-integration-terminal-v1",
    status: "stage4_object_visible_structure_smoke_integration_cpu_failed_closed",
    recordedAtUtc: new Date().toISOString(),
    authorization: binding(AUTHORIZATION_PATH),
    consumption: binding(CONSUMPTION_PATH),
    cpu: { exitCode: cpu.status, stdout: cpu.stdout, stderr: cpu.stderr },
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    gpuStarted: false,
    trainingStarted: false,
    automaticRetryStarted: false,
  })
  process.stderr.write(cpu.stderr || cpu.stdout)
  process.exit(cpu.status ?? 1)
}

const cpuReport = readJson(cpuReportPath)
const implementationAttestation = readJson(implementationAttestationPath)
assert.equal(cpuReport.status, "fact_conditioned_semantic_mixture_stage4_smoke_cpu_regression_passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)
assert.equal(implementationAttestation.status, "fact_conditioned_semantic_mixture_stage4_smoke_implementation_cpu_verified")
assert.equal(implementationAttestation.runnerSha256, sha256File(RUNNER))
assert.equal(implementationAttestation.cpuCheckerSha256, sha256File(CHECKER))
assert.equal(implementationAttestation.trainerSha256, sha256File(TRAINER))

const implementationReport = {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-integration-implementation-report-v1",
  status: "stage4_object_visible_structure_smoke_integration_cpu_contract_passed",
  recordedAtUtc: new Date().toISOString(),
  authorization: binding(AUTHORIZATION_PATH),
  consumption: binding(CONSUMPTION_PATH),
  inactiveConfig: binding(inactiveConfigPath),
  supportContract: binding(supportContractPath),
  registrationTerminal: binding(registrationTerminalPath),
  executionEvidenceRegistry: registryBinding,
  cpuReport: binding(cpuReportPath),
  implementationAttestation: binding(implementationAttestationPath),
  phase0Evidence: {
    terminal: binding(PHASE0_TERMINAL),
    finalization: binding(PHASE0_FINALIZATION),
    update: binding(PHASE0_UPDATE),
    cpuReport: binding(PHASE0_CPU_REPORT),
  },
  code: { runner: binding(RUNNER), cpuChecker: binding(CHECKER), trainer: binding(TRAINER), model: binding(MODEL) },
  frozen: { trainer: true, model: true, sourceConfig: true, reviewThresholds: true },
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
}
writeImmutableJson(reportPath, implementationReport)

const proposedAuthorization = buildProposedSmokeAuthorization({
  registryBinding,
  cpuReportPath,
  implementationAttestationPath,
})
const ownerRequest = {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "awaiting_owner_authorization_not_active",
  requestId: proposedAuthorization.requestId,
  commandRef: proposedAuthorization.commandRef,
  requestedAction: "execute_one_independent_object_visible_structure_30_epoch_semantic_mixture_gpu_smoke",
  reason: "successful object visible-structure Phase 0 and CPU Smoke integration contract are bound",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  proposedAuthorization,
  generatedBy: "local_ai_painter_governance_program",
  externalEmployeeDecisionAuthority: false,
}
writeImmutableJson(ownerRequestPath, ownerRequest)

const terminal = {
  schemaVersion: "ai-painter-stage4-object-visible-structure-smoke-integration-terminal-v1",
  status: "stage4_object_visible_structure_smoke_integration_cpu_succeeded_closed",
  recordedAtUtc: new Date().toISOString(),
  implementationReport: binding(reportPath),
  ownerActionRequest: binding(ownerRequestPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "materialize_and_execute_exact_proposed_independent_30_epoch_smoke_authorization",
  gpuStarted: false,
  trainingStarted: false,
  automaticRetryStarted: false,
}
writeImmutableJson(terminalPath, terminal)
writeImmutableJson(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: terminal.status,
  recordedAtUtc: terminal.recordedAtUtc,
  currentModule: "stage4_object_visible_structure_supervision",
  currentStep: "independent_30_epoch_smoke_ready_not_started",
  fixedTotalProgress: terminal.fixedTotalProgress,
  terminal: binding(terminalPath),
  ownerActionRequest: binding(ownerRequestPath),
  nextLegalAction: terminal.nextLegalAction,
  gpuStarted: false,
  trainingStarted: false,
})

appendAiPainterProgramEvent({
  action: "record_stage4_object_visible_structure_smoke_integration",
  runId: "20260815-061900000",
  kind: "stage4_object_visible_structure_smoke_integration_completed",
  status: "success",
  title: "Stage 4 object visible-structure Smoke integration completed",
  titleZh: "Stage 4 四对象可见结构 Smoke 衔接已完成",
  detail: `CPU ${cpuReport.positivePassed}/${cpuReport.positiveTotal} positive and ${cpuReport.negativePassed}/${cpuReport.negativeTotal} negative contracts passed`,
  detailZh: `CPU 正向 ${cpuReport.positivePassed}/${cpuReport.positiveTotal}、反向 ${cpuReport.negativePassed}/${cpuReport.negativeTotal} 合同通过`,
  script: projectPath(import.meta.filename),
  currentStep: "independent_30_epoch_smoke_ready_not_started",
  evidencePath: terminalPath,
  nextAction: terminal.nextLegalAction,
  nextActionZh: "依据未激活 Owner 请求生成并执行一次独立 30 Epoch Smoke",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  status: terminal.status,
  cpu: { positive: `${cpuReport.positivePassed}/${cpuReport.positiveTotal}`, negative: `${cpuReport.negativePassed}/${cpuReport.negativeTotal}` },
  terminal: binding(terminalPath),
  ownerActionRequest: binding(ownerRequestPath),
  registry: registryBinding,
}, null, 2))

function buildInactiveSmokeConfig(source, fragment) {
  const config = compilePhase0DerivedConfig(source, fragment)
  const training = config.training
  config.architectureVersion = "fact-conditioned-semantic-mixture-object-visible-structure-cpu"
  training.trainingAuthorizationStatus = "stage4_fact_conditioned_semantic_mixture_decoder_cpu_supported_inactive"
  training.denoiserEpochs = 30
  delete training.factConditionedSemanticMixtureStage4FullTrainingContract
  delete training.factConditionedSemanticMixtureStage4SingleSampleSmokeContract
  delete training.factConditionedSemanticMixtureStage4SmokeExecution
  delete training.stage4UnifiedTrainingPreviewSamplingContract
  const implementation = training.stage4FactConditionedSemanticMixture.ownerImplementationAuthorization
  training.ownerTrainingAuthorization = {
    authorizationId: "owner-authorized-stage4-fact-conditioned-semantic-mixture-decoder-cpu-support-20260812-003946363",
    authorizationPath: implementation.authorizationPath,
    authorizationSha256: implementation.authorizationSha256,
    implementationConsumptionPath: implementation.implementationConsumptionPath,
    implementationConsumptionSha256: implementation.implementationConsumptionSha256,
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
  const mixture = training.stage4FactConditionedSemanticMixture
  mixture.enabled = false
  mixture.status = "cpu_support_verified_not_active"
  for (const key of Object.keys(mixture.activationGate)) mixture.activationGate[key] = false
  for (const key of [
    "stage4PerClassFinalVisibleRgbObligation",
    "stage4VegetationFinalVisibleSemanticRepair",
    "stage4DistributionAwareVisibleSpatialSemanticObligation",
    "stage4FullRolloutFinalVisibleConsistency",
    "stage4EpochWorstSampleClassReplay",
    "stage4ObjectVisibleStructureSupervision",
  ]) {
    const contract = training[key]
    if (!contract) continue
    contract.status = "cpu_support_verified_inactive"
    for (const gate of Object.keys(contract.activationGate ?? {})) contract.activationGate[gate] = false
  }
  delete training.stage4VegetationLuminanceSpatialStructureSupervision
  const diagnostics = training.stage4FailureDiagnostics
  diagnostics.status = "fact_conditioned_semantic_mixture_diagnostic_manifest_supported_inactive"
  diagnostics.trainingConfigApplied = false
  diagnostics.checkpointFileReadAuthorized = false
  diagnostics.gpuUseAuthorized = false
  diagnostics.trainingAuthorized = false
  return config
}

function buildProposedSmokeAuthorization({ registryBinding, cpuReportPath, implementationAttestationPath }) {
  const registryValue = readJson(REGISTRY_PATH)
  const role = (name) => ({ path: registryValue.roles[name].canonicalPath, sha256: registryValue.roles[name].sha256 })
  const requestId = "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260815-063000000"
  const executionActions = ["create_optimizer", "execute_backward", "inspect_autoencoder_identity", "inspect_checkpoint_identity", "load_autoencoder", "mutate_model_weights", "select_bound_sample", "write_smoke_checkpoint"]
  const denied = ["automatic_retry", "create_runtime_frame", "enter_world", "load_parent_denoiser", "promote_checkpoint", "run_formal_inference", "run_stage0", "run_stage1", "run_stage2", "run_strict_revalidation", "write_diagnostic_checkpoint"]
  const support = {
    implementationAuthorization: binding(AUTHORIZATION_PATH),
    implementationConsumption: binding(CONSUMPTION_PATH),
    readonlyGpuTerminal: role("stage4.finalVisibleRgb.gpuQualificationTerminal"),
    readonlyGpuDiagnostic: role("stage4.finalVisibleRgb.gpuDiagnosticReport"),
    cudaTelemetry: role("stage4.finalVisibleRgb.cudaTelemetry"),
    readonlyCpuReport: role("stage4.finalVisibleRgb.cpuAuthorizationReport"),
    inactiveConfig: role("stage4.finalVisibleRgb.inactiveConfig"),
    architectureSupportContract: role("stage4.finalVisibleRgb.trainingObjectiveSupportContract"),
    datasetManifest: binding(DATASET_MANIFEST),
    datasetSourceIndex: binding(DATASET_SOURCE_INDEX),
    projectAutoencoderCheckpoint: binding(AUTOENCODER),
    conditionAlignmentAuditor: binding("scripts/lib/ai-assisted-condition-alignment.mjs"),
    professionalAestheticAuditor: binding("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
    windowsSafePreviewNormalizer: binding("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
    gpuResourceGate: binding("scripts/lib/ai-assisted-v7-training-resource-gate.mjs"),
    cpuReport: binding(cpuReportPath),
    implementationAttestation: binding(implementationAttestationPath),
    executionEvidenceRegistry: registryBinding,
  }
  return {
    schemaVersion: "ai-painter-stage4-fact-conditioned-semantic-mixture-smoke-execution-authorization-v1",
    requestId,
    commandRef: requestId,
    scope: "one_stage4_fact_conditioned_semantic_mixture_sample194_30_epoch_model_smoke_only",
    status: "resolved_owner_authorized_not_consumed",
    executionActions,
    explicitlyDeniedActions: denied,
    taskIdentity: {
      modeId: "fact_conditioned_semantic_mixture_stage4_smoke",
      architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
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
      diagnosticManifestFields: [...OBJECT_VISIBLE_STRUCTURE_DIAGNOSTIC_FIELDS],
    },
    bindings: support,
    codeBindings: {
      authorizationPolicy: binding("ml/ai-painter/scripts/ai_painter_authorization_policy.py"),
      executionGrant: binding("ml/ai-painter/scripts/ai_painter_execution_grant.py"),
      modeRegistry: binding("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
      trainer: binding(TRAINER),
      runner: binding(RUNNER),
      cpuChecker: binding(CHECKER),
      model: binding(MODEL),
      inactiveConfigCompiler: binding("ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py"),
    },
    execution: {
      consumptionPath: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-063000000/execution-consumption.json`,
      activeConfigPath: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-063000000/active-config.json`,
      trainingOutputDirectory: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-063000000/training-output`,
      finalizationDirectory: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-063000000/finalization`,
      preflightReportPath: `.runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260815-063000000/preflight-report.json`,
    },
    oneTimeConsumptionRequired: true,
    failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true },
  }
}

function reusable(role, sourcePath, successTerminal, registrationChain = []) {
  return { role, source: binding(sourcePath), successTerminal, registrationChain }
}
function verifyAuthorizationBindings(value) {
  for (const [name, item] of Object.entries(value.bindings ?? {})) {
    if (["runnerBefore", "cpuCheckerBefore"].includes(name)) continue
    assert.equal(sha256File(item.path), item.sha256, `authorization binding changed: ${name}`)
  }
}
function resolve(value) { return path.resolve(ROOT, value) }
function projectPath(value) { return path.relative(ROOT, resolve(value)).replaceAll("\\", "/") }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex") }
function readJson(value) { return JSON.parse(fs.readFileSync(resolve(value), "utf8")) }
function readVerifiedJson(value, expected) { assert.equal(sha256File(value), expected, `SHA-256 changed: ${value}`); return readJson(value) }
function binding(value) { return { path: projectPath(value), sha256: sha256File(value) } }
function writeImmutableJson(value, body) {
  const absolute = resolve(value)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const handle = fs.openSync(absolute, "wx")
  try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) }
}
