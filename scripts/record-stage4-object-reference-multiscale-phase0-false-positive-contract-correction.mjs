import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-false-positive-contract-correction-20260815-160000000"
const SCOPE = "one_cpu_only_phase0_false_positive_adjudication_and_entry_contract_correction"
const AUTH_SHA = "bd6dfa1a6b5c828132347652ba739602dc30b2e83ad2cbfc4b3d0a0aa33f1966"
const CONSUMPTION_SHA = "6e257b37c92d46bc95b5a416883db5bbbb0c60c7f05bf70b97f6d861409163c2"
const SOURCE_RUN_ID = "20260815-154500000-phase0"
const FUTURE_GPU_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-20260815-163000000"
const FUTURE_GPU_SCOPE = "one_corrected_object_reference_multiscale_phase0_gpu_single_update_and_dual_process_reproduction_only"
const OUTPUT = path.join(ROOT, ".runtime", "ai-painter", "stage4-object-reference-multiscale-phase0-false-positive-contract-corrections", "20260815-160000000")
const CHECKER = path.join(ROOT, "scripts", "check-stage4-object-reference-multiscale-phase0-execution-entry.mjs")
const RUNNER = path.join(ROOT, "scripts", "run-stage4-object-reference-multiscale-phase0.mjs")
const PYTHON_ENTRY = path.join(ROOT, "ml", "ai-painter", "scripts", "run_stage4_object_visible_structure_phase0.py")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const PYTHON_CHECKER = path.join(ROOT, "ml", "ai-painter", "scripts", "check_stage4_object_reference_multiscale_phase0_cpu.py")
const NODE_CHECKER = CHECKER
const IMPLEMENTATION_ROOT = path.join(ROOT, ".runtime", "ai-painter", "stage4-object-reference-multiscale-phase0-execution-entry-implementations", "20260815-153000000")
const IMPLEMENTATION_AUTHORIZATION = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-object-reference-multiscale-phase0-execution-entry-implementation-20260815-153000000", "authorization.json")
const IMPLEMENTATION_CONSUMPTION = path.join(path.dirname(IMPLEMENTATION_AUTHORIZATION), "consumption.json")
const GPU_ACTIONS = Object.freeze({
  projectAutoencoderCheckpointReadAndLoadFrozen: true,
  fixedRandomDenoiserInitialization: true,
  singleSample194ValidationRead: true,
  exactlyOneOptimizerCreation: true,
  exactlyOneBackwardAndOptimizerStep: true,
  boundedDenoiserWeightModification: true,
  nonPromotableDiagnosticCheckpointWrite: true,
  diagnosticCheckpointReloadInTwoFreshProcesses: true,
  modelConditionRgbAndPngByteIdentityComparison: true,
  exactFortyEightDiagnosticManifestVerification: true,
  fourObjectMultiscaleAndMatchingExpertGradientVerification: true,
  preStepAutogradGradVerification: true,
  exactBackwardCallCountOne: true,
  replayOptimizerStepCountZero: true,
  parameterGradientsClearedBeforeFinalization: true,
  failedDenoiserCheckpointReadOrLoad: false,
  moreThanOneOptimizerStep: false,
  modelSmoke: false,
  formalStage0Training: false,
  stage1OrStage2: false,
  validation: false,
  formalInference: false,
  checkpointPromotion: false,
  runtimeFrame: false,
  worldEntry: false,
  reviewThresholdChange: false,
  automaticRetry: false,
})
const TASK_IDENTITY = Object.freeze({
  architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: "typed_object_multiscale_luminance_structure_correlation_supervision_v1",
  sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
  sampleSplit: "validation",
  seed: 20263722,
  timestep: 999,
  resolution: { width: 256, height: 192 },
  requiredBoundarySides: ["west"],
  objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
  pyramidScales: [1, 0.5, 0.25],
  diagnosticManifestMetricCount: 48,
  denoiserInitialization: "fixed_random_seed_20263722",
  autoencoderState: "bound_project_checkpoint_loaded_and_frozen",
})
const REQUIRED_BINDINGS = [
  "correctionAuthorization", "correctionConsumption", "correctionReport",
  "correctionAttestation", "correctionTerminal", "implementationAuthorization",
  "implementationConsumption", "implementationReport", "implementationAttestation",
  "implementationTerminal", "inactivePhase0ExecutionContract", "phase0DesignReport",
  "gpuQualificationTerminal", "diagnosticReport", "sourceConfig", "inactiveConfigFragment",
  "datasetManifest", "projectAutoencoderCheckpoint", "trainer", "phase0PythonEntry", "phase0Runner",
]

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.ok(value); assert.equal(path.isAbsolute(value), false); const result = path.resolve(ROOT, value); assert.ok(result.startsWith(`${ROOT}${path.sep}`)); return result }
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const writeExclusive = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); assert.equal(fs.existsSync(file), false, `immutable_file_exists:${relative(file)}`); const handle = fs.openSync(file, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }

const authorizationPath = projectFile(arg("--authorization"))
const consumptionPath = projectFile(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.sourceRunId, SOURCE_RUN_ID)
assert.equal(authorization.ownerDecision.classification, "program_and_evidence_contract_false_positive")
assert.equal(authorization.ownerDecision.smokeEntryAccepted, false)
assert.equal(authorization.bindings.diagnosticCheckpointIdentity.weightsReadAuthorized, false)
assert.equal(consumption.status, "stage4_object_reference_multiscale_phase0_false_positive_contract_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.oneTimeConsumption, true)
for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "diagnosticCheckpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "weightModified", "trainingStarted", "validationStarted", "smokeStarted", "automaticRetryStarted"]) assert.equal(consumption[key], false)
assert.equal(fs.existsSync(OUTPUT), false, "correction_output_exists")

const environment = { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONDONTWRITEBYTECODE: "1" }
const cpuResult = spawnSync(process.execPath, [
  CHECKER,
  "--correction-contract",
  "--correction-authorization", relative(authorizationPath),
  "--correction-consumption", relative(consumptionPath),
], { cwd: ROOT, encoding: "utf8", env: environment })
assert.equal(cpuResult.status, 0, `cpu_contract_failed:${cpuResult.stderr}`)
const cpu = JSON.parse(cpuResult.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

fs.mkdirSync(OUTPUT, { recursive: true })
const files = {
  cpu: path.join(OUTPUT, "cpu-contract-report.json"),
  adjudication: path.join(OUTPUT, "false-positive-adjudication-report.json"),
  report: path.join(OUTPUT, "correction-implementation-report.json"),
  attestation: path.join(OUTPUT, "correction-attestation.json"),
  inactive: path.join(OUTPUT, "inactive-corrected-gpu-phase0-contract.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  owner: path.join(OUTPUT, "owner-action-request.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
}
const now = new Date().toISOString()
const shanghai = formatShanghai(now)
writeExclusive(files.cpu, { ...cpu, authorization: bind(authorizationPath), consumption: bind(consumptionPath), checker: bind(CHECKER), recordedAtUtc: now, recordedAtAsiaShanghai: shanghai })
writeExclusive(files.adjudication, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-false-positive-adjudication-v1",
  status: "stage4_object_reference_multiscale_phase0_false_positive_adjudicated_closed",
  sourceRunId: SOURCE_RUN_ID,
  ownerDecision: authorization.ownerDecision,
  evidence: {
    gpuAuthorization: authorization.bindings.gpuAuthorization,
    gpuConsumption: authorization.bindings.gpuConsumption,
    falsePositiveTerminal: authorization.bindings.falsePositiveTerminal,
    falsePositiveFinalization: authorization.bindings.falsePositiveFinalization,
    updateReport: authorization.bindings.updateReport,
    diagnosticCheckpointIdentity: authorization.bindings.diagnosticCheckpointIdentity,
  },
  findings: {
    underlyingUpdateReportedOptimizerStepCount: null,
    underlyingUpdateReportedGradientGroups: {},
    effectiveConfigEpochWorstReplayPassesPerObservedPrimaryBatch: 2,
    upperFinalizationHardCodedOptimizerSteps: 1,
    exactFortyEightMetricsVerifiedByFalsePositiveRun: false,
    fourObjectAndMatchingExpertGradientGroupsVerifiedByFalsePositiveRun: false,
    smokeEntryEligible: false,
    diagnosticCheckpointPromotable: false,
    diagnosticCheckpointReusableForCorrection: false,
  },
  classification: "program_and_evidence_contract_false_positive_not_model_failure",
  immutablePriorSuccessEvidencePreserved: true,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-false-positive-contract-correction-implementation-v1",
  status: "stage4_object_reference_multiscale_phase0_false_positive_contract_corrected_cpu_verified",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  adjudication: bind(files.adjudication),
  cpuContractReport: bind(files.cpu),
  correctedTargets: {
    trainer: bind(TRAINER),
    pythonEntry: bind(PYTHON_ENTRY),
    phase0Runner: bind(RUNNER),
    pythonChecker: bind(PYTHON_CHECKER),
    nodeChecker: bind(NODE_CHECKER),
    recorder: bind(new URL(import.meta.url).pathname.startsWith("/") && process.platform === "win32" ? new URL(import.meta.url).pathname.slice(1) : new URL(import.meta.url).pathname),
  },
  correctedGates: {
    primaryOptimizerStepCountFromOptimizerStateExactlyOne: true,
    epochWorstAndPathReplayOptimizerStepsExactlyZero: true,
    backwardCallCountExactlyOne: true,
    exactFortyEightFiniteNonnegativeMetricsRequired: true,
    fourObjectIndependentGradientsFiniteStrictlyNonzero: true,
    fourMatchingExpertGradientsFiniteStrictlyNonzero: true,
    combinedGradientFiniteStrictlyNonzero: true,
    parameterGradientsClearedBeforeFinalization: true,
    upperRunnerHardCodedSuccessRemoved: true,
  },
  gpuUsedNow: false,
  cudaInitializedNow: false,
  autogradExecutedNow: false,
  diagnosticCheckpointReadNow: false,
  modelLoadedNow: false,
  optimizerCreatedNow: false,
  backwardExecutedNow: false,
  trainingStartedNow: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.attestation, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-false-positive-contract-correction-attestation-v1",
  status: "stage4_object_reference_multiscale_phase0_false_positive_contract_corrected_cpu_verified",
  correctionAuthorizationSha256: AUTH_SHA,
  correctionConsumptionSha256: CONSUMPTION_SHA,
  correctionReportPath: relative(files.report),
  correctionReportSha256: sha(files.report),
  runnerPath: relative(RUNNER), runnerSha256: sha(RUNNER),
  pythonEntryPath: relative(PYTHON_ENTRY), pythonEntrySha256: sha(PYTHON_ENTRY),
  trainerPath: relative(TRAINER), trainerSha256: sha(TRAINER),
  pythonCheckerPath: relative(PYTHON_CHECKER), pythonCheckerSha256: sha(PYTHON_CHECKER),
  nodeCheckerPath: relative(NODE_CHECKER), nodeCheckerSha256: sha(NODE_CHECKER),
  gpuUsedNow: false, cudaInitializedNow: false, autogradExecutedNow: false,
  diagnosticCheckpointReadNow: false, modelLoadedNow: false, optimizerCreatedNow: false,
  backwardExecutedNow: false, trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.inactive, {
  schemaVersion: "stage4-object-reference-multiscale-corrected-phase0-gpu-execution-inactive-contract-v2",
  status: "inactive_owner_corrected_gpu_phase0_authorization_required",
  requestId: FUTURE_GPU_REQUEST_ID,
  scope: FUTURE_GPU_SCOPE,
  taskIdentity: TASK_IDENTITY,
  executionActions: GPU_ACTIONS,
  requiredBindingNames: REQUIRED_BINDINGS,
  maximumExecutions: 1,
  consumeBeforeFirstEvidenceWrite: true,
  gpuAuthorizedNow: false,
  cudaAuthorizedNow: false,
  autogradAuthorizedNow: false,
  phase0ExecutionAuthorizedNow: false,
  smokeAuthorizedNow: false,
  formalStage0AuthorizedNow: false,
  automaticRetryAuthorizedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-false-positive-contract-correction-terminal-v1",
  status: "stage4_object_reference_multiscale_phase0_false_positive_adjudicated_and_contract_corrected_cpu_closed",
  sourceRunId: SOURCE_RUN_ID,
  adjudicationReport: bind(files.adjudication),
  correctionReport: bind(files.report),
  correctionAttestation: bind(files.attestation),
  cpuContractReport: bind(files.cpu),
  inactiveCorrectedGpuContract: bind(files.inactive),
  priorSuccessTerminalAcceptedForSmoke: false,
  diagnosticCheckpointPromotable: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_one_fresh_corrected_object_reference_multiscale_gpu_phase0_or_exit",
  gpuUsedNow: false, cudaInitializedNow: false, autogradExecutedNow: false,
  diagnosticCheckpointReadNow: false, modelLoadedNow: false, trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})

const priorGpuAuthorization = read(projectFile(authorization.bindings.gpuAuthorization.path))
const proposedBindings = {
  correctionAuthorization: bind(authorizationPath),
  correctionConsumption: bind(consumptionPath),
  correctionReport: bind(files.report),
  correctionAttestation: bind(files.attestation),
  correctionTerminal: bind(files.terminal),
  implementationAuthorization: bind(IMPLEMENTATION_AUTHORIZATION),
  implementationConsumption: bind(IMPLEMENTATION_CONSUMPTION),
  implementationReport: bind(path.join(IMPLEMENTATION_ROOT, "implementation-report.json")),
  implementationAttestation: bind(path.join(IMPLEMENTATION_ROOT, "implementation-attestation.json")),
  implementationTerminal: bind(path.join(IMPLEMENTATION_ROOT, "phase-terminal.json")),
  inactivePhase0ExecutionContract: priorGpuAuthorization.bindings.inactivePhase0ExecutionContract,
  phase0DesignReport: priorGpuAuthorization.bindings.phase0DesignReport,
  gpuQualificationTerminal: priorGpuAuthorization.bindings.gpuQualificationTerminal,
  diagnosticReport: priorGpuAuthorization.bindings.diagnosticReport,
  sourceConfig: priorGpuAuthorization.bindings.sourceConfig,
  inactiveConfigFragment: priorGpuAuthorization.bindings.inactiveConfigFragment,
  datasetManifest: priorGpuAuthorization.bindings.datasetManifest,
  projectAutoencoderCheckpoint: priorGpuAuthorization.bindings.projectAutoencoderCheckpoint,
  trainer: bind(TRAINER),
  phase0PythonEntry: bind(PYTHON_ENTRY),
  phase0Runner: bind(RUNNER),
}
assert.deepEqual(Object.keys(proposedBindings), REQUIRED_BINDINGS)
const executionId = FUTURE_GPU_REQUEST_ID.slice("owner-authorized-stage4-object-reference-multiscale-phase0-gpu-execution-".length)
const proposedAuthorization = {
  schemaVersion: "ai-painter-owner-stage4-object-reference-multiscale-phase0-gpu-execution-v2",
  status: "owner_authorized_unconsumed",
  requestId: FUTURE_GPU_REQUEST_ID,
  commandRef: FUTURE_GPU_REQUEST_ID,
  scope: FUTURE_GPU_SCOPE,
  taskIdentity: TASK_IDENTITY,
  executionActions: GPU_ACTIONS,
  bindings: proposedBindings,
  execution: {
    consumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_GPU_REQUEST_ID}/consumption.json`,
    outputDirectory: `.runtime/ai-painter/stage4-object-reference-multiscale-phase0-executions/${executionId}`,
    runId: `${executionId}-phase0`,
    maximumExecutions: 1,
    consumeBeforeFirstEvidenceWrite: true,
  },
  failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noSmokeOrTrainingEscalation: true },
}
writeExclusive(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_authorize_one_fresh_corrected_object_reference_multiscale_gpu_phase0_or_exit",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_GPU_REQUEST_ID}/authorization.json`,
  proposedAuthorization,
  boundCorrectionTerminal: bind(files.terminal),
  boundCorrectionReport: bind(files.report),
  boundCorrectionAttestation: bind(files.attestation),
  automaticApproval: false,
  gpuExecutedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Object-reference multiscale Phase0 false positive adjudicated; corrected GPU Phase0 inactive",
  candidateTerminal: bind(files.terminal),
  rejectedPriorTerminal: authorization.bindings.falsePositiveTerminal,
  latestBlocker: "immutable_owner_authorization_for_fresh_corrected_gpu_phase0_not_created_or_consumed",
  nextLegalAction: "owner_authorize_one_fresh_corrected_object_reference_multiscale_gpu_phase0_or_exit",
  forbiddenActions: authorization.forbiddenActions,
  evidence: { adjudicationReport: bind(files.adjudication), correctionReport: bind(files.report), correctionAttestation: bind(files.attestation), cpuContractReport: bind(files.cpu), inactiveGpuContract: bind(files.inactive), ownerActionRequest: bind(files.owner) },
  gpuUsedNow: false, cudaInitializedNow: false, diagnosticCheckpointReadNow: false,
  modelLoadedNow: false, trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})

const indexed = [authorizationPath, consumptionPath, RUNNER, PYTHON_ENTRY, TRAINER, PYTHON_CHECKER, NODE_CHECKER, new URL(import.meta.url).pathname.startsWith("/") && process.platform === "win32" ? new URL(import.meta.url).pathname.slice(1) : new URL(import.meta.url).pathname, ...Object.values(files)]
for (const file of [...new Set(indexed)]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-phase0-false-positive-${SOURCE_RUN_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_phase0_false_positive_adjudication",
  runId: SOURCE_RUN_ID,
  kind: "cpu_only_false_positive_adjudication",
  status: "failed",
  title: "Object-reference multiscale Phase0 prior success rejected",
  titleZh: "四对象参考对齐多尺度Phase 0旧成功终态已裁决为误判",
  detailZh: "底层optimizerStepCount为空、梯度组为空且配置包含额外replay，旧成功终态不得进入Smoke。",
  evidencePath: relative(files.adjudication),
  evidenceSha256: sha(files.adjudication),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-phase0-contract-correction-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_phase0_false_positive_contract_correction",
  runId: REQUEST_ID,
  kind: "cpu_only_contract_correction",
  status: "success",
  title: "Object-reference multiscale Phase0 false-positive contract corrected",
  titleZh: "四对象参考对齐多尺度Phase 0误判合同CPU修正完成",
  detailZh: `CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}；未启动GPU/CUDA/autograd，未读取诊断Checkpoint。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: read(files.terminal).status, cpuContractReport: bind(files.cpu), adjudicationReport: bind(files.adjudication), correctionReport: bind(files.report), correctionAttestation: bind(files.attestation), inactiveGpuContract: bind(files.inactive), terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
