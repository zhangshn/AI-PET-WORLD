import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-gpu-qualification-continuation-20260815-211500000"
const SCOPE = "one_cpu_only_continuation_and_formal_index_of_completed_early_convergence_gpu_qualification"
const AUTH_SHA = "fb2ccea257166dbd070d29304c019ffbc69a38ba4472915d5fb69298274579c6"
const CONSUMPTION_SHA = "3afe8150fe62df2d49627e10ca9c5e5e017241ce75a11bff70d0ea793b844b95"
const CHECKER = "scripts/check-stage4-object-reference-multiscale-early-convergence-readonly-gpu-qualification-finalization.mjs"
const FINALIZER = "scripts/finalize-stage4-object-reference-multiscale-early-convergence-readonly-gpu-qualification.mjs"
const OUTPUT = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-gpu-qualification-continuations/20260815-211500000"
const SMOKE_ENTRY_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-30-epoch-smoke-entry-integration-20260815-213000000"
const SMOKE_ENTRY_AUTH = `.runtime/ai-painter/owner-action-requests/${SMOKE_ENTRY_REQUEST_ID}/authorization.json`
const SMOKE_ENTRY_OUTPUT = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-smoke-entry-integrations/20260815-213000000"
const SMOKE_RUNNER = "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs"
const SMOKE_RECORDER = "scripts/record-stage4-object-reference-multiscale-smoke-entry-implementation.mjs"
const FUTURE_CHECKER = "scripts/check-stage4-object-reference-multiscale-early-convergence-smoke-entry-integration.mjs"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const IMPLEMENTATION_ROOT = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-stabilization-cpu-implementations/20260815-183000000"

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (value) => {
  assert.equal(typeof value, "string", "path_argument_missing")
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationPath = resolveProject(arg("--authorization"))
const consumptionPath = resolveProject(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA, "authorization_sha256_changed")
assert.equal(sha(consumptionPath), CONSUMPTION_SHA, "consumption_sha256_changed")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.execution.outputDirectory, OUTPUT)
assert.equal(authorization.execution.futureSmokeEntryRequestId, SMOKE_ENTRY_REQUEST_ID)
assert.equal(authorization.execution.futureSmokeEntryOutputDirectory, SMOKE_ENTRY_OUTPUT)
assert.equal(
  consumption.status,
  "early_convergence_gpu_qualification_cpu_continuation_authorization_atomically_consumed",
)
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.oneTimeConsumption, true)
for (const [name, binding] of Object.entries(authorization.bindings)) {
  const file = resolveProject(binding.path)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}
assert.equal(fs.existsSync(resolveProject(SMOKE_ENTRY_AUTH)), false, "future_smoke_entry_authorization_created_without_owner")
assert.equal(fs.existsSync(resolveProject(SMOKE_ENTRY_OUTPUT)), false, "future_smoke_entry_output_created_without_owner")

const checkerPath = resolveProject(CHECKER)
const finalizerPath = resolveProject(FINALIZER)
const node = process.execPath
for (const target of [checkerPath, finalizerPath]) {
  const syntax = spawnSync(node, ["--check", target], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
  })
  assert.equal(syntax.status, 0, `syntax_failed:${relative(target)}:${syntax.stderr}`)
}
const regression = spawnSync(node, [
  checkerPath,
  "--authorization", relative(authorizationPath),
  "--consumption", relative(consumptionPath),
], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
})
assert.equal(regression.status, 0, `cpu_contract_failed:${regression.stderr}`)
const cpu = JSON.parse(regression.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

const implementationFiles = {
  implementationReport: resolveProject(`${IMPLEMENTATION_ROOT}/implementation-report.json`),
  inactiveSupportContract: resolveProject(`${IMPLEMENTATION_ROOT}/inactive-support-contract.json`),
  inactiveConfig: resolveProject(`${IMPLEMENTATION_ROOT}/inactive-config.json`),
  implementationCpuReport: resolveProject(`${IMPLEMENTATION_ROOT}/cpu-contract-regression.json`),
}
for (const file of Object.values(implementationFiles)) assert.equal(fs.existsSync(file), true, `implementation_source_missing:${relative(file)}`)
for (const file of [SMOKE_RUNNER, SMOKE_RECORDER, TRAINER]) assert.equal(fs.existsSync(resolveProject(file)), true, `smoke_source_missing:${file}`)

const output = resolveProject(OUTPUT)
assert.equal(fs.existsSync(output), false, "continuation_output_exists")
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-contract-report.json"),
  report: path.join(output, "continuation-report.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
writeJsonAtomic(files.cpu, {
  ...cpu,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  checker: bind(checkerPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-gpu-qualification-continuation-report-v1",
  status: "early_convergence_gpu_qualification_evidence_verified_and_formally_indexed",
  sourceRunId: "20260815-210000000",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceEvidence: authorization.bindings,
  cpuContractReport: bind(files.cpu),
  checker: bind(checkerPath),
  finalizer: bind(finalizerPath),
  qualification: {
    status: "passed",
    trainingObjectiveContractId: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1",
    objectChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    pyramidScales: [1, 0.5, 0.25],
    replayLaneCount: 2,
    diagnosticManifestMetricCount: 48,
    fourIndependentGradientsFiniteAndNonzero: true,
    fourMatchingExpertGradientsFiniteAndNonzero: true,
    combinedObjectGradientFiniteAndNonzero: true,
    lane1GradientFiniteAndNonzero: true,
    lane2GradientFiniteAndNonzero: true,
    combinedTwoLaneGradientFiniteAndNonzero: true,
    replayPassesAdded: 0,
    denoiserStateUnchanged: true,
    autoencoderStateUnchanged: true,
    parameterGradFieldsAbsent: true,
  },
  smokeEntryFinding: {
    directGpuSmokeAuthorizationReady: false,
    reason: "current_smoke_eligibility_contract_has_no_early_convergence_two_lane_readonly_qualification_branch",
    requiredNextStep: "bounded_cpu_smoke_entry_lineage_integration_and_contract_regression",
  },
  currentExecution: {
    gpuUsed: false,
    cudaInitialized: false,
    autogradExecuted: false,
    checkpointRead: false,
    modelLoaded: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
  },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-gpu-qualification-continuation-terminal-v1",
  status: "early_convergence_gpu_qualification_formally_finalized_closed",
  sourceRunId: "20260815-210000000",
  continuationReport: bind(files.report),
  cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_review_and_authorize_bounded_cpu_30_epoch_smoke_entry_lineage_integration_or_exit",
  gpuUsedNow: false,
  cudaInitializedNow: false,
  autogradExecutedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
  validationStartedNow: false,
  smokeStartedNow: false,
  automaticRetryStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const proposedSmokeEntryAuthorization = {
  schemaVersion: "ai-painter-owner-stage4-object-reference-multiscale-early-convergence-30-epoch-smoke-entry-integration-v1",
  status: "owner_authorized_unconsumed",
  requestId: SMOKE_ENTRY_REQUEST_ID,
  commandRef: SMOKE_ENTRY_REQUEST_ID,
  scope: "one_cpu_bounded_30_epoch_smoke_entry_lineage_integration_for_early_convergence_two_lane_candidate",
  bindings: {
    gpuAuthorization: authorization.bindings.gpuAuthorization,
    gpuConsumption: authorization.bindings.gpuConsumption,
    gpuTerminal: authorization.bindings.gpuTerminal,
    diagnosticReport: authorization.bindings.diagnosticReport,
    cudaTelemetry: authorization.bindings.cudaTelemetry,
    continuationReport: bind(files.report),
    continuationTerminal: bind(files.terminal),
    implementationReport: bind(implementationFiles.implementationReport),
    inactiveSupportContract: bind(implementationFiles.inactiveSupportContract),
    inactiveConfig: bind(implementationFiles.inactiveConfig),
    implementationCpuReport: bind(implementationFiles.implementationCpuReport),
    currentSmokeRunner: bind(resolveProject(SMOKE_RUNNER)),
    currentSmokeRecorder: bind(resolveProject(SMOKE_RECORDER)),
    currentTrainer: bind(resolveProject(TRAINER)),
  },
  authorizedTargetPaths: [SMOKE_RUNNER, SMOKE_RECORDER, FUTURE_CHECKER],
  permittedActions: [
    "add_one_early_convergence_two_lane_qualification_lineage_branch_to_existing_smoke_entry",
    "preserve_all_existing_smoke_qualification_branches",
    "compile_one_inactive_30_epoch_smoke_contract_for_fixed_validation_sample194_seed20263722_resolution256x192_west_topology",
    "run_node_and_python_syntax_checks",
    "run_cpu_positive_negative_contract_and_cpu_contract_only_smoke_preflight",
    "write_implementation_report_inactive_gpu_smoke_contract_terminal_capsule_and_next_gpu_smoke_owner_request",
    "synchronize_event_ledger_and_sqlite_index",
  ],
  forbiddenActions: [
    "gpu", "cuda_initialization", "autograd", "checkpoint_read_or_load", "model_load",
    "optimizer", "backward", "weight_modification", "training", "validation", "smoke",
    "automatic_retry", "stage0", "stage1", "stage2", "formal_inference",
    "checkpoint_promotion", "runtime_frame", "world_entry", "model_change",
    "trainer_change", "loss_change", "data_change", "source_config_change", "review_threshold_change",
  ],
  execution: {
    consumptionPath: `.runtime/ai-painter/owner-action-requests/${SMOKE_ENTRY_REQUEST_ID}/consumption.json`,
    outputDirectory: SMOKE_ENTRY_OUTPUT,
    futureGpuSmokeRequestId: "owner-authorized-stage4-object-reference-multiscale-early-convergence-30-epoch-model-smoke-20260815-220000000",
    consumeBeforeFirstCodeOrEvidenceWrite: true,
  },
  failurePolicy: {
    stopImmediately: true,
    automaticRetry: false,
    preserveEvidence: true,
    noGpuEscalation: true,
  },
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_review_and_authorize_bounded_cpu_30_epoch_smoke_entry_lineage_integration_or_exit",
  requestedAuthorizationPath: SMOKE_ENTRY_AUTH,
  proposedAuthorization: proposedSmokeEntryAuthorization,
  boundContinuationReport: bind(files.report),
  boundTerminal: bind(files.terminal),
  gpuExecutedNow: false,
  smokeExecutedNow: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Two-lane early-convergence readonly GPU qualification formally finalized; 30 Epoch Smoke entry integration not authorized",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "immutable_owner_30_epoch_smoke_entry_lineage_integration_authorization_not_created_or_consumed",
  nextLegalAction: "owner_review_and_authorize_bounded_cpu_30_epoch_smoke_entry_lineage_integration_or_exit",
  forbiddenActions: authorization.forbiddenActions,
  evidence: {
    gpuTerminal: authorization.bindings.gpuTerminal,
    diagnosticReport: authorization.bindings.diagnosticReport,
    cudaTelemetry: authorization.bindings.cudaTelemetry,
    continuationReport: bind(files.report),
    cpuContractReport: bind(files.cpu),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
  validationStartedNow: false,
  smokeStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const indexedFiles = [
  authorizationPath,
  consumptionPath,
  checkerPath,
  finalizerPath,
  ...Object.values(authorization.bindings).map((binding) => resolveProject(binding.path)),
  ...Object.values(files),
]
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
  id: `stage4-object-reference-multiscale-early-convergence-gpu-qualification-continuation-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_early_convergence_gpu_qualification_cpu_continuation",
  runId: REQUEST_ID,
  kind: "cpu_continuation",
  status: "success",
  title: "Two-lane early-convergence GPU qualification formally finalized",
  titleZh: "双通道早期收敛 GPU 梯度资格已完成 CPU 续结与正式索引",
  detailZh: `不可变 GPU 证据通过 CPU 只读核验；正向 ${cpu.positivePassed}/${cpu.positiveTotal}，反向 ${cpu.negativePassed}/${cpu.negativeTotal}。本次未启动 GPU、CUDA、autograd、Checkpoint、模型、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
for (const file of Object.values(files)) fs.chmodSync(file, 0o444)
closeStorageCatalog()
console.log(JSON.stringify({
  status: read(files.terminal).status,
  cpuContractReport: bind(files.cpu),
  continuationReport: bind(files.report),
  terminal: bind(files.terminal),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
