import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-success-continuation-path-compatibility-correction-20260815-163200000"
const SCOPE = "one_cpu_only_windows_path_compatible_continuation_recorder_implementation_and_fresh_contract_materialization"
const AUTH_SHA = "16e583061ad83def0feadd5b3d101da36f508afedd92dfa4b9c4f4f5bc160dea"
const CONSUMPTION_SHA = "f7c5d093d9d74db457e54a1708be14ea05e707740ac5b95ecb614bfc44b268fb"
const SOURCE_RUN_ID = "20260815-163000000-phase0"
const OUTPUT = path.join(ROOT, ".runtime", "ai-painter", "stage4-object-reference-multiscale-phase0-success-continuation-path-corrections", "20260815-163200000")
const RUNNER = path.join(ROOT, "scripts", "run-ai-assisted-v8-r5-stage4-smoke.mjs")
const CHECKER = path.join(ROOT, "ml", "ai-painter", "scripts", "check_ai_assisted_v9_r5_stage4_cpu.py")
const TRAINER = path.join(ROOT, "ml", "ai-painter", "scripts", "train_ai_assisted_conditional_denoiser.py")
const MODEL = path.join(ROOT, "ml", "ai-painter", "src", "ai_painter", "complete_world", "model.py")
const SOURCE_CONFIG = path.join(ROOT, ".runtime", "ai-painter", "stage4-semantic-mixture-formal-training", "20260815-072500000-stage0", "active-config.json")
const INACTIVE_FRAGMENT = path.join(ROOT, ".runtime", "ai-painter", "stage4-object-reference-multiscale-luminance-structure-supervision-cpu-implementations", "20260815-141934048", "inactive-config-fragment.json")
const DATASET = path.join(ROOT, "data", "world-samples", "ai-assisted-cold-start-dataset-packages", "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z", "manifest.json")
const AUTOENCODER = path.join(ROOT, ".runtime", "ai-painter", "project-owned-complete-world-model-ai-assisted-v2", "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z", "complete-world-ai-assisted-autoencoder.pt")
const NEXT_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-30-epoch-smoke-entry-implementation-20260815-164000000"

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.ok(value)
  assert.equal(path.isAbsolute(value), false)
  const absolute = path.resolve(ROOT, value)
  assert.ok(absolute.startsWith(`${ROOT}${path.sep}`))
  return absolute
}
const relative = (value) => path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const clone = (value) => structuredClone(value)
const rejects = (callback) => {
  try { callback(); return false } catch { return true }
}
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

function validateAuthorization(authorization, consumption) {
  assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-reference-multiscale-phase0-success-continuation-path-compatibility-correction-v1")
  assert.equal(authorization.status, "owner_authorized_unconsumed")
  assert.equal(authorization.requestId, REQUEST_ID)
  assert.equal(authorization.commandRef, REQUEST_ID)
  assert.equal(authorization.scope, SCOPE)
  assert.deepEqual(authorization.authorizedTargetPaths, ["scripts/record-stage4-object-reference-multiscale-phase0-success-continuation.mjs"])
  assert.equal(authorization.execution.maximumExecutions, 1)
  assert.equal(authorization.execution.consumeBeforeFirstWrite, true)
  assert.equal(consumption.status, "stage4_object_reference_multiscale_phase0_success_continuation_path_compatibility_correction_authorization_atomically_consumed")
  assert.equal(consumption.authorizationSha256, AUTH_SHA)
  assert.equal(consumption.requestId, REQUEST_ID)
  assert.equal(consumption.commandRef, REQUEST_ID)
  assert.equal(consumption.scope, SCOPE)
  assert.equal(consumption.oneTimeConsumption, true)
  for (const key of ["gpuUsed", "cudaInitialized", "autogradExecuted", "diagnosticCheckpointRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted", "automaticRetryStarted"]) assert.equal(consumption[key], false, `${key}_opened`)
  return true
}

const authorizationPath = projectFile(arg("--authorization"))
const consumptionPath = projectFile(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
validateAuthorization(authorization, consumption)
for (const [name, binding] of Object.entries(authorization.bindings)) assert.equal(sha(projectFile(binding.path)), binding.sha256, `${name}_changed`)
assert.equal(fs.existsSync(OUTPUT), false, "output_already_exists")

const failed = read(projectFile(authorization.bindings.failureReport.path))
const phase0Terminal = read(projectFile(authorization.bindings.phase0Terminal.path))
const phase0Finalization = read(projectFile(authorization.bindings.phase0Finalization.path))
const updatePath = projectFile(phase0Finalization.updateReport.path)
assert.equal(sha(updatePath), phase0Finalization.updateReport.sha256)
const update = read(updatePath)
const runnerSource = fs.readFileSync(RUNNER, "utf8")
const trainerSource = fs.readFileSync(TRAINER, "utf8")

const positive = {
  authorizationAndConsumptionValid: validateAuthorization(authorization, consumption),
  priorFailureCodeExact: failed.failureCode === "windows_powershell_path_getrelativepath_unavailable",
  phase0TerminalPassed: phase0Terminal.status === "stage4_object_reference_multiscale_phase0_passed_closed",
  phase0FinalizationPassed: phase0Finalization.status === "stage4_object_reference_multiscale_phase0_passed_closed",
  optimizerStepCountExactlyOne: update.optimizerStepCount === 1,
  backwardCallCountExactlyOne: update.backwardCallCount === 1,
  replayOptimizerStepCountZero: update.replayOptimizerStepCount === 0,
  parameterGradientsCleared: update.parameterGradientsCleared === true,
  diagnosticMetricCountExactly48: Object.keys(update.diagnosticManifest.values).length === 48,
  gradientGroupNamesExact: JSON.stringify(Object.keys(update.requiredGradientGroups)) === JSON.stringify(["footprints", "tree", "rock", "vegetation", "combined"]),
  trainerContainsCurrentMultiscaleContract: trainerSource.includes("stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"),
  smokeRunnerMissingCurrentMultiscaleActivation: !runnerSource.includes("const objectReferenceMultiscale = training.stage4ObjectReferenceMultiscaleLuminanceStructureSupervision"),
  nodePathRelativeWindowsCompatible: relative(authorizationPath).startsWith(".runtime/ai-painter/"),
  diagnosticCheckpointNotRead: true,
  noGpuOrTrainingOpened: true,
}
const mutations = {
  rejectWrongRequestId: (value) => { value.authorization.requestId = "wrong" },
  rejectWrongCommandRef: (value) => { value.authorization.commandRef = "wrong" },
  rejectWrongScope: (value) => { value.authorization.scope = "wrong" },
  rejectReusableConsumption: (value) => { value.consumption.oneTimeConsumption = false },
  rejectGpuOpened: (value) => { value.consumption.gpuUsed = true },
  rejectCheckpointRead: (value) => { value.consumption.diagnosticCheckpointRead = true },
  rejectTraining: (value) => { value.consumption.trainingStarted = true },
  rejectSmoke: (value) => { value.consumption.smokeStarted = true },
}
const negative = Object.fromEntries(Object.entries(mutations).map(([name, mutate]) => {
  const candidate = { authorization: clone(authorization), consumption: clone(consumption) }
  mutate(candidate)
  return [name, rejects(() => validateAuthorization(candidate.authorization, candidate.consumption))]
}))
const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([name]) => name)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([name]) => name)
assert.deepEqual(failedPositiveKeys, [])
assert.deepEqual(failedNegativeKeys, [])

fs.mkdirSync(OUTPUT, { recursive: true })
const files = {
  cpu: path.join(OUTPUT, "cpu-contract-report.json"),
  report: path.join(OUTPUT, "continuation-implementation-report.json"),
  contract: path.join(OUTPUT, "inactive-30-epoch-smoke-contract.json"),
  owner: path.join(OUTPUT, "owner-action-request.json"),
  terminal: path.join(OUTPUT, "phase-terminal.json"),
  capsule: path.join(OUTPUT, "local-task-capsule.json"),
}
const now = new Date().toISOString()
const shanghai = formatShanghai(now)
writeExclusive(files.cpu, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-success-continuation-path-correction-cpu-report-v1",
  status: "stage4_object_reference_multiscale_phase0_success_continuation_path_correction_cpu_passed",
  positive, negative,
  positivePassed: Object.values(positive).filter(Boolean).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter(Boolean).length,
  negativeTotal: Object.keys(negative).length,
  failedPositiveKeys, failedNegativeKeys,
  gpuUsedNow: false, cudaInitializedNow: false, autogradExecutedNow: false,
  diagnosticCheckpointReadNow: false, modelLoadedNow: false, optimizerCreatedNow: false,
  backwardExecutedNow: false, trainingStartedNow: false, smokeStartedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-success-continuation-path-correction-report-v1",
  status: "stage4_object_reference_multiscale_phase0_success_continuation_cpu_succeeded_closed",
  authorization: bind(authorizationPath), consumption: bind(consumptionPath), cpuContractReport: bind(files.cpu),
  sourceRunId: SOURCE_RUN_ID,
  phase0Evidence: { terminal: authorization.bindings.phase0Terminal, finalization: authorization.bindings.phase0Finalization, updateReport: bind(updatePath) },
  findings: {
    phase0QualificationAccepted: true,
    trainerSupportsCurrentMultiscaleContract: true,
    formalSmokeRunnerActivatesCurrentMultiscaleContract: false,
    boundedCpuSmokeEntryImplementationRequired: true,
    diagnosticCheckpointPromotable: false,
  },
  recorder: bind(new URL(import.meta.url).pathname.startsWith("/") && process.platform === "win32" ? new URL(import.meta.url).pathname.slice(1) : new URL(import.meta.url).pathname),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  gpuUsedNow: false, diagnosticCheckpointReadNow: false, trainingStartedNow: false, smokeStartedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.contract, {
  schemaVersion: "stage4-object-reference-multiscale-independent-30-epoch-smoke-inactive-contract-v1",
  status: "inactive_owner_cpu_smoke_entry_implementation_required",
  sourceRunId: SOURCE_RUN_ID,
  architecture: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: "typed_object_multiscale_luminance_structure_correlation_supervision_v1",
  taskIdentity: {
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation", seed: 20263722,
    resolution: { width: 256, height: 192 }, epochCount: 30,
    previewEpochs: [1, 5, 10, 20, 30], requiredBoundarySides: ["west"],
    objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    pyramidScales: [1, 0.5, 0.25],
    initialization: "project_random_fact_conditioned_semantic_mixture",
    oldDenoiserCheckpointReadAuthorized: false,
    diagnosticCheckpointReadAuthorized: false,
  },
  requiredIntegration: {
    activateCurrentMultiscaleContractInSmokeRunner: true,
    rejectFailedSingleScaleContractReuse: true,
    preserveExact48DiagnosticRegistry: true,
    preserveExistingReviewThresholds: true,
    freezeTrainerModelDataAndSourceConfig: true,
    cpuPositiveNegativeContractRegressionRequired: true,
  },
  bindings: { phase0Terminal: authorization.bindings.phase0Terminal, phase0Finalization: authorization.bindings.phase0Finalization, phase0UpdateReport: bind(updatePath), continuationReport: bind(files.report) },
  gpuAuthorizedNow: false, trainingAuthorizedNow: false, smokeAuthorizedNow: false, automaticRetryAuthorizedNow: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const proposedAuthorization = {
  schemaVersion: "ai-painter-owner-stage4-object-reference-multiscale-30-epoch-smoke-entry-implementation-v1",
  status: "owner_authorized_unconsumed",
  requestId: NEXT_REQUEST_ID,
  commandRef: NEXT_REQUEST_ID,
  scope: "one_cpu_only_object_reference_multiscale_30_epoch_smoke_entry_implementation_and_contract_regression",
  bindings: {
    continuationAuthorization: bind(authorizationPath), continuationConsumption: bind(consumptionPath),
    continuationReport: bind(files.report), inactiveSmokeContract: bind(files.contract),
    phase0Terminal: authorization.bindings.phase0Terminal, phase0Finalization: authorization.bindings.phase0Finalization,
    phase0UpdateReport: bind(updatePath), sourceConfig: bind(SOURCE_CONFIG), inactiveConfigFragment: bind(INACTIVE_FRAGMENT),
    datasetManifest: bind(DATASET), projectAutoencoderCheckpoint: { ...bind(AUTOENCODER), weightsReadNow: false },
    smokeRunner: bind(RUNNER), cpuChecker: bind(CHECKER), trainerFrozen: bind(TRAINER), modelFrozen: bind(MODEL),
  },
  authorizedTargetPaths: [
    "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
    "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py",
    "scripts/record-stage4-object-reference-multiscale-smoke-entry-implementation.mjs",
  ],
  authorizedActions: {
    integrateInactiveMultiscaleSmokeContract: true,
    activateOnlyCurrentMultiscaleContractInMemory: true,
    rejectFailedSingleScaleReuse: true,
    pythonAndNodeSyntaxChecks: true,
    cpuPositiveNegativeContractRegression: true,
    inactiveGpuSmokeAuthorizationRequest: true,
    implementationReportTerminalCapsuleLedgerAndSqlite: true,
  },
  forbiddenActions: [
    "gpu", "cuda", "autograd", "checkpoint_read_or_load", "model_load", "optimizer", "backward",
    "weight_modification", "training", "validation", "smoke", "automatic_retry", "stage0", "stage1", "stage2",
    "trainer_modification", "model_modification", "data_modification", "source_config_modification", "review_threshold_modification",
  ],
  execution: {
    consumptionPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/consumption.json`,
    outputDirectory: ".runtime/ai-painter/stage4-object-reference-multiscale-smoke-entry-implementations/20260815-164000000",
    maximumExecutions: 1,
    consumeBeforeFirstWrite: true,
  },
  failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true },
}
writeExclusive(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "implement_object_reference_multiscale_30_epoch_smoke_entry_cpu_only",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/authorization.json`,
  reason: "Trainer supports the current multiscale contract but the formal Smoke Runner does not yet activate it",
  proposedAuthorization,
  automaticApproval: false,
  gpuExecutedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-success-continuation-terminal-v1",
  status: "stage4_object_reference_multiscale_phase0_success_continued_cpu_closed",
  sourceRunId: SOURCE_RUN_ID,
  continuationReport: bind(files.report), inactiveSmokeContract: bind(files.contract), ownerActionRequest: bind(files.owner),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_bounded_multiscale_30_epoch_smoke_entry_implementation_or_exit",
  gpuUsedNow: false, trainingStartedNow: false, smokeStartedNow: false, automaticRetryStartedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})
writeExclusive(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "stage4_object_reference_multiscale_phase0_success_continued_cpu_closed",
  module: "AI Painter R5",
  currentStage: "Object-reference multiscale Phase0 passed; independent 30 Epoch Smoke entry inactive",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal), ownerActionRequest: bind(files.owner),
  latestBlocker: "formal_smoke_runner_does_not_activate_current_multiscale_contract",
  nextLegalAction: "owner_authorize_bounded_multiscale_30_epoch_smoke_entry_implementation_or_exit",
  gpuUsedNow: false, trainingStartedNow: false, smokeStartedNow: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: shanghai,
})

const recorderPath = new URL(import.meta.url).pathname.startsWith("/") && process.platform === "win32" ? new URL(import.meta.url).pathname.slice(1) : new URL(import.meta.url).pathname
for (const file of [authorizationPath, consumptionPath, recorderPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-phase0-success-continuation-path-correction-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_phase0_success_continuation_path_compatibility_correction",
  runId: REQUEST_ID,
  kind: "cpu_only_continuation_path_correction",
  status: "success",
  title: "Object-reference multiscale Phase0 continuation path compatibility corrected",
  titleZh: "四对象参考对齐多尺度Phase 0续结Windows路径兼容修正完成",
  detailZh: `CPU正向${Object.values(positive).filter(Boolean).length}/${Object.keys(positive).length}、反向${Object.values(negative).filter(Boolean).length}/${Object.keys(negative).length}；未启动GPU、训练或Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  cpuContractReport: bind(files.cpu), continuationReport: bind(files.report), inactiveSmokeContract: bind(files.contract),
  ownerActionRequest: bind(files.owner), terminal: bind(files.terminal), capsule: bind(files.capsule),
}, null, 2))
