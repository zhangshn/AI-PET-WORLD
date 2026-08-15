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
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000"
const AUTHORIZATION_SHA256 = "d230ee00ac584da119129540a07d7517822a7ab5775c5385d94c3a1a8875a615"
const CONSUMPTION_SHA256 = "898b37d2306917964383bb70c127af2ac9511ba2ee1a3177efc2013b82f5c11a"
const SCOPE = "implement_current_four_object_readonly_gpu_gradient_diagnostic_entry_and_cpu_regressions_only"
const AUTH_SCHEMA = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-v1"
const FUTURE_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-010000000"
const FUTURE_SCOPE = "one_stage4_four_object_visible_structure_readonly_gpu_gradient_qualification_only"
const FUTURE_SCHEMA = "ai-painter-owner-stage4-object-visible-structure-readonly-gpu-gradient-qualification-v1"
const TARGETS = [
  "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
  "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
  "scripts/record-stage4-object-visible-structure-readonly-gpu-entry-implementation.mjs",
]
const ACTIONS = [
  "add_one_current_four_object_visible_structure_mode_to_existing_gpu_diagnostic",
  "add_exact_future_owner_authorization_and_consumption_contract",
  "add_cpu_positive_negative_authorization_and_execution_boundary_regressions",
  "run_python_syntax_and_cpu_contract_checks",
  "write_inactive_gpu_execution_contract_implementation_report_owner_request_terminal_and_capsule",
  "synchronize_implementation_event_ledger_and_sqlite",
]
const OBJECTS = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
const IMPLEMENTATION_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-entry-implementations/20260815-005000000"
const FUTURE_AUTHORIZATION = `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-authorization.json`
const FUTURE_EXECUTION_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-qualifications/20260815-010000000"
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260814-154900000-stage0/active-config.json"
const CPU_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-supervision/20260815-002000000"
const DATASET_ROOT = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z"
const AUTOENCODER = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"

const value = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (input) => {
  assert.equal(path.isAbsolute(input), false, `absolute_path_rejected:${input}`)
  const result = path.resolve(ROOT, input)
  assert.ok(result.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${input}`)
  return result
}
const sha = (input) => crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex")
const read = (input) => JSON.parse(fs.readFileSync(input, "utf8"))
const relative = (input) => path.relative(ROOT, input).replaceAll("\\", "/")
const bind = (input) => ({ path: relative(input), sha256: sha(input) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const authorizationArg = value("--authorization")
const authorizationSha256 = value("--authorization-sha256")
const consumptionArg = value("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = resolveProject(authorizationArg)
const consumptionPath = resolveProject(consumptionArg)
assert.equal(authorizationSha256, AUTHORIZATION_SHA256, "authorization_argument_hash_invalid")
assert.equal(sha(authorizationPath), AUTHORIZATION_SHA256, "authorization_hash_changed")
assert.equal(sha(consumptionPath), CONSUMPTION_SHA256, "consumption_hash_changed")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, AUTH_SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(same(authorization.authorizedTargetPaths, TARGETS), true, "authorized_targets_changed")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_changed")
assert.equal(authorization.outputNamespace, IMPLEMENTATION_ROOT)
assert.equal(authorization.implementationAuthorized, true)
for (const field of ["futureGpuExecutionAuthorized", "autogradExecutionAuthorized", "checkpointFileReadAuthorized", "trainingAuthorized", "validationAuthorized", "smokeAuthorized"]) {
  assert.equal(authorization[field], false, `${field}_opened`)
}
assert.equal(consumption.status, "readonly_gpu_gradient_entry_implementation_authorization_atomically_consumed")
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.authorizationSha256, AUTHORIZATION_SHA256)
for (const field of ["gpuUsed", "autogradExecuted", "checkpointFileRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  if (name === "existingGpuDiagnosticRunner") {
    assert.deepEqual(binding, { path: TARGETS[0], sha256: "6d74b4b267c8c3b472d64b9319b8699bf9ae8217e61d69191c38e15d662c62b1" })
    continue
  }
  if (name === "existingCpuChecker") {
    assert.deepEqual(binding, { path: TARGETS[1], sha256: "d63a4307b8ade33a6ce867e5dd1ae6c9ab31b9c8c30c9da92e1aac87737eb294" })
    continue
  }
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}

const output = resolveProject(IMPLEMENTATION_ROOT)
assert.equal(fs.existsSync(output), false, "implementation_output_namespace_exists")
const files = {
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "implementation-report.json"),
  contract: path.join(output, "inactive-gpu-execution-contract.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const python = resolveProject("ml/ai-painter/.venv/Scripts/python.exe")
const runnerPath = resolveProject(TARGETS[0])
const checkerPath = resolveProject(TARGETS[1])
const syntax = spawnSync(python, ["-m", "py_compile", runnerPath, checkerPath], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
})
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const cpuCheck = spawnSync(python, [
  checkerPath,
  "--object-visible-structure-implementation-contract",
  "--implementation-authorization", relative(authorizationPath),
  "--implementation-consumption", relative(consumptionPath),
], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
})
assert.equal(cpuCheck.status, 0, `cpu_contract_failed:${cpuCheck.stderr}`)
const cpu = JSON.parse(cpuCheck.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
for (const field of ["checkpointFileRead", "modelLoaded", "optimizerCreated", "autogradExecuted", "backwardMethodExecuted", "gpuUsed", "trainingStarted", "validationStarted", "smokeStarted"]) {
  assert.equal(cpu[field], false, `${field}_opened_in_cpu_report`)
}

fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
writeJsonAtomic(files.cpu, {
  ...cpu,
  authorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-entry-implementation-report-v1",
  status: "stage4_object_visible_structure_gpu_diagnostic_implementation_cpu_verified",
  runId: "20260814-154900000-stage0",
  implementationRequestId: REQUEST_ID,
  authorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  runner: bind(runnerPath),
  runnerSha256: sha(runnerPath),
  cpuChecker: bind(checkerPath),
  cpuCheckerSha256: sha(checkerPath),
  cpuReport: bind(files.cpu),
  cpuReportSha256: sha(files.cpu),
  futureCommandIdentity: {
    requestId: FUTURE_REQUEST_ID,
    commandRef: FUTURE_REQUEST_ID,
    scope: FUTURE_SCOPE,
    schemaVersion: FUTURE_SCHEMA,
    authorizationPath: FUTURE_AUTHORIZATION,
  },
  implementationFinding: {
    currentSemanticMixtureModeAdded: true,
    exactSampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    exactObjectChannels: OBJECTS,
    separateTypedGradientQueries: 4,
    combinedTypedGradientQueries: 1,
    failedCheckpointWeightsUsed: false,
    actualGpuExecutionPerformed: false,
  },
  executionBoundary: {
    gpuUsed: false,
    autogradExecuted: false,
    checkpointFileRead: false,
    modelLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-gradient-entry-inactive-execution-contract-v1",
  status: "implemented_cpu_verified_inactive_owner_gpu_authorization_required",
  implementationReport: bind(files.report),
  futureAuthorizationIdentity: {
    path: FUTURE_AUTHORIZATION,
    schemaVersion: FUTURE_SCHEMA,
    requestId: FUTURE_REQUEST_ID,
    commandRef: FUTURE_REQUEST_ID,
    scope: FUTURE_SCOPE,
  },
  boundTask: {
    architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
    contractId: "stage4_four_typed_object_visible_structure_supervision_v1",
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation",
    seed: 20263722,
    timestep: 999,
    resolution: { width: 256, height: 192 },
    objectChannels: OBJECTS,
  },
  allowedOnlyAfterFutureAuthorization: [
    "load_frozen_project_autoencoder",
    "initialize_fresh_random_current_semantic_mixture_denoiser",
    "read_one_bound_validation_sample194",
    "one_readonly_cuda_forward",
    "four_separate_torch_autograd_grad_queries",
    "one_combined_torch_autograd_grad_query",
    "write_telemetry_report_terminal_capsule_ledger_and_sqlite",
  ],
  forbidden: [
    "failed_checkpoint_weight_read_or_load",
    "optimizer_creation",
    "backward_method_execution",
    "model_weight_mutation",
    "training",
    "validation",
    "smoke",
    "automatic_retry",
    "stage1_or_stage2",
    "formal_inference",
    "checkpoint_promotion",
    "runtime_frame",
    "world_entry",
  ],
  gpuAuthorizedNow: false,
  autogradAuthorizedNow: false,
  trainingAuthorized: false,
  validationAuthorized: false,
  smokeAuthorized: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-entry-implementation-terminal-v1",
  status: "stage4_object_visible_structure_readonly_gpu_entry_implementation_succeeded_closed",
  runId: "20260814-154900000-stage0",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  implementationReport: bind(files.report),
  cpuReport: bind(files.cpu),
  inactiveGpuExecutionContract: bind(files.contract),
  nextLegalAction: "owner_create_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  gpuUsed: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  modelLoaded: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const futureBindings = {
  cpuTerminal: bind(resolveProject(`${CPU_ROOT}/phase-terminal.json`)),
  cpuReport: bind(resolveProject(`${CPU_ROOT}/cpu-report.json`)),
  inactiveSupportContract: bind(resolveProject(`${CPU_ROOT}/inactive-support-contract.json`)),
  inactiveConfigFragment: bind(resolveProject(`${CPU_ROOT}/inactive-config-fragment.json`)),
  sourceConfig: bind(resolveProject(SOURCE_CONFIG)),
  model: bind(resolveProject("ml/ai-painter/src/ai_painter/complete_world/model.py")),
  trainer: bind(resolveProject("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")),
  compiler: bind(resolveProject("ml/ai-painter/scripts/compile_stage4_object_visible_structure_supervision_config.py")),
  objectCpuChecker: bind(resolveProject("ml/ai-painter/scripts/check_stage4_object_visible_structure_supervision_cpu.py")),
  modeRegistry: bind(resolveProject("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
  datasetManifest: bind(resolveProject(`${DATASET_ROOT}/manifest.json`)),
  datasetSourceIndex: bind(resolveProject(`${DATASET_ROOT}/source-index.json`)),
  projectAutoencoderCheckpoint: bind(resolveProject(AUTOENCODER)),
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  runner: bind(runnerPath),
  cpuChecker: bind(checkerPath),
  entryImplementationReport: bind(files.report),
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_create_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  requestedAuthorizationPath: FUTURE_AUTHORIZATION,
  proposedAuthorization: {
    schemaVersion: FUTURE_SCHEMA,
    status: "owner_authorized_unconsumed",
    requestId: FUTURE_REQUEST_ID,
    commandRef: FUTURE_REQUEST_ID,
    scope: FUTURE_SCOPE,
    taskIdentity: {
      architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
      trainingObjectiveContractId: "stage4_four_typed_object_visible_structure_supervision_v1",
      sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
      sampleSplit: "validation",
      seed: 20263722,
      timestep: 999,
      resolution: { width: 256, height: 192 },
      requiredBoundarySides: ["west"],
      objectSemanticChannels: OBJECTS,
      diagnosticManifestMetricCount: 32,
      denoiserInitialization: "fixed_random_seed_20263722",
      autoencoderState: "bound_project_checkpoint_loaded_and_frozen",
    },
    executionActions: {
      projectAutoencoderCheckpointReadAndLoadFrozen: true,
      fixedRandomDenoiserInitialization: true,
      singleSample194ValidationRead: true,
      singleReadonlyCudaForward: true,
      torchAutogradGradInspection: true,
      fourSeparateTypedVisibleStructureGradientVerification: true,
      matchingSemanticMixtureExpertRouteVerification: true,
      combinedTypedVisibleStructureGradientVerification: true,
      exactThirtyTwoDiagnosticManifestExport: true,
      preAndPostModelStateSha256IdentityComparison: true,
      cudaTelemetryWrite: true,
      diagnosticReportWrite: true,
      terminalEvidenceWrite: true,
      localTaskCapsuleEventLedgerSqliteSync: true,
      failedDenoiserCheckpointReadOrLoad: false,
      optimizerCreation: false,
      backwardMethodExecution: false,
      modelWeightModification: false,
      checkpointWrite: false,
      training: false,
      validation: false,
      smoke: false,
      automaticRetry: false,
      stage1OrStage2: false,
      formalInference: false,
      checkpointPromotion: false,
      runtimeFrame: false,
      worldEntry: false,
    },
    failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noTrainingEscalation: true },
    implementation: {
      cpuReportPath: relative(files.cpu),
      implementationAttestationPath: relative(files.report),
      pythonPreflightPath: `${FUTURE_EXECUTION_ROOT}/python-preflight.json`,
      resourcePreflightPath: `${FUTURE_EXECUTION_ROOT}/resource-preflight.json`,
    },
    execution: {
      outputDirectory: `${FUTURE_EXECUTION_ROOT}/gpu-execution`,
      gpuConsumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-consumption.json`,
    },
    bindings: futureBindings,
  },
  boundImplementationReport: bind(files.report),
  boundCpuReport: bind(files.cpu),
  boundInactiveExecutionContract: bind(files.contract),
  boundImplementationTerminal: bind(files.terminal),
  gpuExecutedNow: false,
  autogradExecutedNow: false,
  trainingRequested: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 four-object readonly GPU gradient entry implemented and CPU verified; GPU inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "immutable_owner_gpu_qualification_authorization_not_created_or_consumed",
  nextLegalAction: "owner_create_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  forbiddenActions: authorization.deniedActions,
  evidence: {
    implementationReport: bind(files.report),
    cpuReport: bind(files.cpu),
    inactiveGpuExecutionContract: bind(files.contract),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsed: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [authorizationPath, consumptionPath, ...TARGETS.map(resolveProject), ...Object.values(files)]) {
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
  id: `stage4-object-visible-structure-readonly-gpu-entry-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_readonly_gpu_entry_implementation",
  runId: REQUEST_ID,
  kind: "cpu_contract_implementation",
  status: "success",
  title: "Stage4 four-object readonly GPU gradient entry implemented",
  titleZh: "Stage4 四对象只读 GPU 梯度入口实施完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；未启动 GPU、autograd、Checkpoint 读取、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  cpuReport: bind(files.cpu),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
