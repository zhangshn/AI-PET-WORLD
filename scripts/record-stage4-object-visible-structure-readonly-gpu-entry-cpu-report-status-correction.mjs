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
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-entry-cpu-contract-correction-20260815-024000000"
const SCOPE = "one_bounded_cpu_only_object_visible_structure_gpu_entry_contract_correction"
const AUTH_SHA = "ac6ad668c949b28e38c70e9c5b3f05de3c53388231ee5397884b9cea0f3e08b9"
const CONSUMPTION_SHA = "31373dc8bd3695ab47ce28da2f6708028e0a29adebbbe496e881bdef370c9ce3"
const RUNNER = "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py"
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py"
const RECORDER = "scripts/record-stage4-object-visible-structure-readonly-gpu-entry-cpu-report-status-correction.mjs"
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-entry-cpu-contract-corrections/20260815-024000000"
const CPU_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-supervision/20260815-002000000"
const DATASET_ROOT = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z"
const RETIRED_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-015000000"
const RETIRED_AUTH = `.runtime/ai-painter/owner-action-requests/${RETIRED_REQUEST_ID}/gpu-execution-authorization.json`
const RETIRED_AUTH_SHA = "8e558d3d9d4e7dc1cd2a9bcde2c528dfd423f0672fbd584fdb5c0239f3b655d9"
const RETIRED_CONSUMPTION = `.runtime/ai-painter/owner-action-requests/${RETIRED_REQUEST_ID}/gpu-execution-consumption.json`
const FUTURE_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-025000000"
const FUTURE_SCOPE = "one_stage4_four_object_visible_structure_readonly_gpu_gradient_qualification_only"
const FUTURE_SCHEMA = "ai-painter-owner-stage4-object-visible-structure-readonly-gpu-gradient-qualification-v1"
const FUTURE_AUTH = `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-authorization.json`
const FUTURE_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-qualifications/20260815-025000000"
const CPU_STATUS = "passed_stage4_object_visible_structure_readonly_gpu_entry_implementation_cpu_contract"
const AUTOENCODER_BINDING = {
  path: ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt",
  sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
}

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
assert.equal(authorization.schemaVersion, "ai-painter-owner-stage4-object-visible-structure-gpu-entry-cpu-contract-correction-v1")
assert.equal(authorization.status, "owner_authorized_unconsumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.execution.outputDirectory, OUTPUT)
assert.equal(authorization.execution.consumeBeforeFirstWrite, true)
assert.equal(authorization.execution.currentGpuAuthorizationMustRemainUnconsumed, true)
assert.equal(consumption.status, "cpu_contract_correction_authorization_atomically_consumed")
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.authorizationSha256, AUTH_SHA)
assert.equal(consumption.oneTimeConsumption, true)
for (const field of [
  "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointRead", "modelLoaded",
  "trainingStarted", "validationStarted", "smokeStarted",
]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}
assert.deepEqual(authorization.bindings.currentGpuAuthorization, {
  path: RETIRED_AUTH,
  sha256: RETIRED_AUTH_SHA,
})
assert.deepEqual(authorization.bindings.runner, {
  path: RUNNER,
  sha256: "b2efbe32997ccce2746d754d8480d9811520f2f67025f7eb8269587eed5730a4",
})
assert.deepEqual(authorization.bindings.cpuChecker, {
  path: CHECKER,
  sha256: "a2f0570a10375e3c435d2e43e46a11a30e6f65c48424c61d08f3350622582c0e",
})
assert.deepEqual(authorization.bindings.recorder, {
  path: RECORDER,
  sha256: "9b27f9e715dd0a43f0b2bcdd3587f0c498ca292b849a161d672d60d116083392",
})
const retiredAuthorizationPath = resolveProject(RETIRED_AUTH)
assert.equal(sha(retiredAuthorizationPath), RETIRED_AUTH_SHA)
assert.equal(fs.existsSync(resolveProject(RETIRED_CONSUMPTION)), false, "retired_gpu_authorization_consumed")
assert.equal(fs.existsSync(resolveProject(FUTURE_AUTH)), false, "future_gpu_authorization_created_without_owner")
assert.equal(fs.existsSync(resolveProject(FUTURE_ROOT)), false, "future_gpu_output_namespace_exists")

const retiredAuthorization = read(retiredAuthorizationPath)
for (const name of ["model", "trainer", "datasetManifest", "datasetSourceIndex", "projectAutoencoderCheckpoint"]) {
  const binding = retiredAuthorization.bindings[name]
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_frozen_binding_changed`)
}

const runnerPath = resolveProject(RUNNER)
const checkerPath = resolveProject(CHECKER)
const recorderPath = resolveProject(RECORDER)
const runnerSource = fs.readFileSync(runnerPath, "utf8")
assert.equal(runnerSource.includes("qualification-20260815-025000000"), true)
assert.equal(runnerSource.includes("build_object_visible_structure_preflight_reports"), true)
assert.equal(runnerSource.includes("object_visible_structure_preflight_must_be_integrated_with_atomic_consumption"), true)
const consumeSource = runnerSource.split("def consume_and_run(", 2)[1].split("def run_gpu(", 1)[0]
const consumptionWrite = consumeSource.indexOf("write_json_exclusive(consumption_path, consumption)")
assert.ok(consumptionWrite >= 0)
assert.ok(consumptionWrite < consumeSource.indexOf("write_json_exclusive(python_path, python_report)"))
assert.ok(consumptionWrite < consumeSource.indexOf("write_json_exclusive(resource_path, resource_report)"))
assert.ok(consumptionWrite < consumeSource.indexOf("return run_gpu("))

const python = resolveProject("ml/ai-painter/.venv/Scripts/python.exe")
const safeEnvironment = {
  ...process.env,
  CUDA_VISIBLE_DEVICES: "",
  PYTHONDONTWRITEBYTECODE: "1",
}
const syntaxCode = [
  "import ast",
  "from pathlib import Path",
  `paths=[Path(${JSON.stringify(RUNNER)}),Path(${JSON.stringify(CHECKER)})]`,
  "[ast.parse(p.read_text(encoding='utf-8'),filename=str(p)) for p in paths]",
  "print('syntax_ok')",
].join(";")
const syntax = spawnSync(python, ["-c", syntaxCode], {
  cwd: ROOT,
  encoding: "utf8",
  env: safeEnvironment,
})
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const regression = spawnSync(python, [
  checkerPath,
  "--object-visible-structure-implementation-contract",
  "--implementation-authorization", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/authorization.json",
  "--implementation-consumption", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/implementation-consumption.json",
], {
  cwd: ROOT,
  encoding: "utf8",
  env: safeEnvironment,
})
assert.equal(regression.status, 0, `cpu_regression_failed:${regression.stderr}`)
const cpu = JSON.parse(regression.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(cpu.positivePassed, 26)
assert.equal(cpu.negativePassed, 22)

const output = resolveProject(OUTPUT)
assert.equal(fs.existsSync(output), false, "correction_output_exists")
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-report.json"),
  attestation: path.join(output, "implementation-attestation.json"),
  retirement: path.join(output, "retired-unconsumed-gpu-authorization.json"),
  proposed: path.join(output, "proposed-gpu-authorization-contract.json"),
  combination: path.join(output, "proposed-authorization-attestation-combination-report.json"),
  report: path.join(output, "contract-correction-report.json"),
  contract: path.join(output, "inactive-gpu-execution-contract.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
writeJsonAtomic(files.cpu, {
  ...cpu,
  authorization: bind(authorizationPath),
  correctionConsumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.retirement, {
  schemaVersion: "stage4-object-visible-structure-gpu-authorization-unconsumed-retirement-v1",
  status: "retired_unconsumed_due_cpu_entry_contract_failure_and_runner_rebinding",
  authorization: bind(retiredAuthorizationPath),
  expectedConsumptionPath: RETIRED_CONSUMPTION,
  consumptionExists: false,
  originalFailure: authorization.observedFailure,
  reusable: false,
  gpuUsed: false,
  checkpointRead: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-cpu-contract-corrected-implementation-attestation-v1",
  status: "stage4_object_visible_structure_gpu_diagnostic_implementation_cpu_verified",
  correctionRequestId: REQUEST_ID,
  correctionAuthorization: bind(authorizationPath),
  correctionConsumption: bind(consumptionPath),
  runnerPath: RUNNER,
  runnerSha256: sha(runnerPath),
  cpuCheckerPath: CHECKER,
  cpuCheckerSha256: sha(checkerPath),
  recorderPath: RECORDER,
  recorderSha256: sha(recorderPath),
  cpuReportPath: relative(files.cpu),
  cpuReportSha256: sha(files.cpu),
  cpuReportStatus: CPU_STATUS,
  retiredAuthorization: bind(files.retirement),
  futureRequestId: FUTURE_REQUEST_ID,
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  modelLoaded: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const futureBindings = {
  cpuTerminal: bind(resolveProject(`${CPU_ROOT}/phase-terminal.json`)),
  cpuReport: bind(resolveProject(`${CPU_ROOT}/cpu-report.json`)),
  inactiveSupportContract: bind(resolveProject(`${CPU_ROOT}/inactive-support-contract.json`)),
  inactiveConfigFragment: bind(resolveProject(`${CPU_ROOT}/inactive-config-fragment.json`)),
  sourceConfig: bind(resolveProject(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260814-154900000-stage0/active-config.json")),
  model: bind(resolveProject("ml/ai-painter/src/ai_painter/complete_world/model.py")),
  trainer: bind(resolveProject("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")),
  compiler: bind(resolveProject("ml/ai-painter/scripts/compile_stage4_object_visible_structure_supervision_config.py")),
  objectCpuChecker: bind(resolveProject("ml/ai-painter/scripts/check_stage4_object_visible_structure_supervision_cpu.py")),
  modeRegistry: bind(resolveProject("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
  datasetManifest: bind(resolveProject(`${DATASET_ROOT}/manifest.json`)),
  datasetSourceIndex: bind(resolveProject(`${DATASET_ROOT}/source-index.json`)),
  projectAutoencoderCheckpoint: AUTOENCODER_BINDING,
  implementationAuthorization: bind(resolveProject(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/authorization.json")),
  implementationConsumption: bind(resolveProject(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/implementation-consumption.json")),
  runner: bind(runnerPath),
  cpuChecker: bind(checkerPath),
  entryImplementationReport: bind(files.attestation),
}
const proposedAuthorization = {
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
    objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
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
  failurePolicy: {
    stopImmediately: true,
    automaticRetry: false,
    preserveEvidence: true,
    noTrainingEscalation: true,
  },
  implementation: {
    cpuReportPath: relative(files.cpu),
    implementationAttestationPath: relative(files.attestation),
    pythonPreflightPath: `${FUTURE_ROOT}/python-preflight.json`,
    resourcePreflightPath: `${FUTURE_ROOT}/resource-preflight.json`,
  },
  execution: {
    outputDirectory: `${FUTURE_ROOT}/gpu-execution`,
    gpuConsumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-consumption.json`,
  },
  bindings: futureBindings,
}
writeJsonAtomic(files.proposed, {
  schemaVersion: "stage4-object-visible-structure-proposed-gpu-authorization-contract-v2",
  status: "cpu_contract_candidate_not_owner_authorized",
  executionOrdering: "in_memory_preflight_then_atomic_consumption_then_evidence_writes_then_gpu",
  proposedAuthorization,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const combinationCode = [
  "import json,sys",
  "from pathlib import Path",
  "sys.path.insert(0,'ml/ai-painter/scripts')",
  "import run_ai_assisted_v9_r5_stage4_gradient_diagnostic as r",
  "import train_ai_assisted_conditional_denoiser as t",
  `a=json.loads(Path(${JSON.stringify(relative(files.proposed))}).read_text(encoding='utf-8'))['proposedAuthorization']`,
  "r.validate_authorization_document(a,False)",
  "c=r.load_object_visible_structure_config(a)",
  "t.validate_training_inputs(c,r.read_json(r.resolve(r.DATASET_PATH)))",
  "assert len(t.fact_conditioned_semantic_mixture_diagnostic_fields(c))==32",
  "a['_diagnosticMode']='object_visible_structure'",
  "a['_authorizationSha256']='0'*64",
  "att=r.validate_implementation_attestation(Path(a['implementation']['implementationAttestationPath']),a)",
  "print(json.dumps({'authorizationDocumentValid':True,'realBoundConfigValid':True,'metricCount':32,'implementationAttestationValid':True,'attestationStatus':att['status'],'gpuUsed':False,'checkpointFileRead':False}))",
].join(";")
const combination = spawnSync(python, ["-c", combinationCode], {
  cwd: ROOT,
  encoding: "utf8",
  env: safeEnvironment,
})
const combinationPassed = combination.status === 0
writeJsonAtomic(files.combination, {
  schemaVersion: "stage4-object-visible-structure-proposed-authorization-attestation-combination-report-v2",
  status: combinationPassed
    ? "proposed_authorization_attestation_and_real_config_cpu_passed"
    : "proposed_authorization_attestation_and_real_config_failed_closed",
  stdout: combination.stdout.trim(),
  stderr: combination.stderr.trim(),
  proposedAuthorizationContract: bind(files.proposed),
  implementationAttestation: bind(files.attestation),
  gpuUsed: false,
  checkpointFileRead: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
assert.equal(combinationPassed, true, `combination_regression_failed:${combination.stderr}`)

writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-cpu-contract-correction-report-v1",
  status: "cpu_entry_activation_and_consumption_order_corrected_verified_inactive",
  runId: "20260814-154900000-stage0",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  runner: bind(runnerPath),
  cpuChecker: bind(checkerPath),
  recorder: bind(recorderPath),
  cpuReport: bind(files.cpu),
  implementationAttestation: bind(files.attestation),
  combinationReport: bind(files.combination),
  retiredGpuAuthorization: bind(files.retirement),
  correction: {
    inMemoryActivation: "formal_stage0_identity_plus_active_four_object_contract_plus_exact_32_metrics",
    firstWriteOrdering: "atomic_consumption_before_python_resource_and_gpu_evidence_writes",
    sourceConfigModified: false,
    historicalModesModified: false,
  },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  gpuUsed: false,
  cudaInitialized: false,
  checkpointFileRead: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-cpu-contract-corrected-inactive-execution-contract-v1",
  status: "full_cpu_real_config_combination_verified_inactive_owner_gpu_authorization_required",
  correctionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  combinationReport: bind(files.combination),
  retiredGpuAuthorization: bind(files.retirement),
  futureAuthorizationIdentity: {
    path: FUTURE_AUTH,
    requestId: FUTURE_REQUEST_ID,
    commandRef: FUTURE_REQUEST_ID,
    scope: FUTURE_SCOPE,
  },
  gpuAuthorizedNow: false,
  trainingAuthorized: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-cpu-contract-correction-terminal-v1",
  status: "cpu_entry_contract_correction_and_real_config_combination_succeeded_closed",
  runId: "20260814-154900000-stage0",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  correctionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  combinationReport: bind(files.combination),
  inactiveGpuExecutionContract: bind(files.contract),
  retiredGpuAuthorization: bind(files.retirement),
  nextLegalAction: "owner_create_new_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  modelLoaded: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_create_new_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  requestedAuthorizationPath: FUTURE_AUTH,
  proposedAuthorization,
  boundCorrectionReport: bind(files.report),
  boundImplementationAttestation: bind(files.attestation),
  boundCombinationReport: bind(files.combination),
  boundTerminal: bind(files.terminal),
  retiredGpuAuthorization: bind(files.retirement),
  gpuExecutedNow: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 four-object GPU entry CPU activation and consumption ordering corrected; GPU inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "new_immutable_owner_gpu_qualification_authorization_not_created_or_consumed",
  nextLegalAction: "owner_create_new_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  forbiddenActions: Object.keys(authorization.forbiddenActions),
  evidence: {
    correctionReport: bind(files.report),
    implementationAttestation: bind(files.attestation),
    combinationReport: bind(files.combination),
    retiredGpuAuthorization: bind(files.retirement),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsed: false,
  checkpointFileRead: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [
  authorizationPath, consumptionPath, runnerPath, checkerPath, recorderPath,
  ...Object.values(files),
]) {
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
  id: `stage4-object-visible-structure-entry-cpu-contract-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_gpu_entry_cpu_contract_correction",
  runId: REQUEST_ID,
  kind: "cpu_contract_correction",
  status: "success",
  title: "Stage4 GPU entry activation and consumption ordering corrected",
  titleZh: "Stage4 GPU 入口激活与授权消费顺序修正完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；真实绑定配置与拟议授权组合通过，旧 GPU 授权未消费退役，未启动 GPU、Checkpoint 或训练。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  terminal: bind(files.terminal),
  correctionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  combinationReport: bind(files.combination),
  retiredGpuAuthorization: bind(files.retirement),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
