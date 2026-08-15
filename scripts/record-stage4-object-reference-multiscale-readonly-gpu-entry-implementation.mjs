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
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-readonly-gpu-entry-implementation-20260815-143331000"
const AUTH_SCHEMA = "owner-authorized-stage4-object-reference-multiscale-readonly-gpu-entry-implementation-v1"
const SCOPE = "one_cpu_bounded_multiscale_luminance_structure_readonly_gpu_qualification_entry_implementation_and_contract_regression_only"
const OUTPUT_NAMESPACE = ".runtime/ai-painter/stage4-object-reference-multiscale-readonly-gpu-entry-implementations/20260815-143331000"
const FUTURE_GPU_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-readonly-gpu-gradient-qualification-20260815-144500000"
const TARGETS = [
  "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
  "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
  "scripts/record-stage4-object-reference-multiscale-readonly-gpu-entry-implementation.mjs",
]
const ACTIONS = [
  "add_current_multiscale_luminance_structure_mode_to_existing_stage4_gpu_diagnostic_runner",
  "add_exact_future_owner_gpu_authorization_and_atomic_consumption_contract",
  "add_cpu_positive_negative_authorization_activation_and_execution_boundary_regressions",
  "run_python_and_node_syntax_checks_and_cpu_contract_regressions",
  "write_inactive_gpu_execution_contract_implementation_report_owner_request_terminal_and_capsule",
  "synchronize_implementation_event_ledger_and_sqlite_index",
]

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
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, AUTH_SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.outputNamespace, OUTPUT_NAMESPACE)
assert.equal(same(authorization.authorizedTargetPaths, TARGETS), true)
assert.equal(same(authorization.allowedActions, ACTIONS), true)
for (const field of [
  "futureGpuExecutionAuthorized", "cudaInitializationAuthorized", "autogradExecutionAuthorized",
  "checkpointFileReadAuthorized", "modelLoadAuthorized", "optimizerCreationAuthorized",
  "backwardExecutionAuthorized", "trainingAuthorized", "validationAuthorized",
  "smokeAuthorized", "automaticRetryAuthorized", "stage1Or2Authorized",
  "trainerModificationAuthorized", "modelLossDataConfigThresholdModificationAuthorized",
]) {
  assert.equal(authorization[field], false, `${field}_opened`)
}
assert.deepEqual(authorization.targetPreimageBindings.runner, {
  path: TARGETS[0],
  sha256: "d72ba919421d295353f036baa8915e36113b710c8d2d5ab75a290bb8289db9c4",
})
assert.deepEqual(authorization.targetPreimageBindings.cpuChecker, {
  path: TARGETS[1],
  sha256: "20d6ea534e316304163b16f8eb8bace522a89285f2c479b8795cf960677511f5",
})
assert.equal(authorization.targetPreimageBindings.recorder.mustNotExistBeforeFirstWrite, true)
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  const source = resolveProject(binding.path)
  assert.equal(fs.existsSync(source), true, `${name}_missing`)
  assert.equal(sha(source), binding.sha256, `${name}_changed`)
}
assert.equal(
  consumption.status,
  "multiscale_readonly_gpu_entry_implementation_authorization_atomically_consumed",
)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.outputNamespace, OUTPUT_NAMESPACE)
assert.equal(consumption.authorizationSha256, authorizationSha256)
assert.equal(same(consumption.authorizedTargetPaths, TARGETS), true)
assert.equal(consumption.oneTimeConsumption, true)
for (const field of [
  "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointFileRead", "modelLoaded",
  "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted",
  "smokeStarted", "stage1Or2Started", "trainerModified",
]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}

const output = resolveProject(OUTPUT_NAMESPACE)
assert.equal(fs.existsSync(output), false, "output_namespace_exists")
const files = {
  cpu: path.join(output, "cpu-report.json"),
  attestation: path.join(output, "implementation-attestation.json"),
  report: path.join(output, "implementation-report.json"),
  contract: path.join(output, "inactive-gpu-execution-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const python = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
assert.equal(fs.existsSync(python), true, "project_python_missing")
const syntax = spawnSync(python, [
  "-B", "-c",
  "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
  TARGETS[0], TARGETS[1],
], { cwd: ROOT, encoding: "utf8" })
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const nodeSyntax = spawnSync(process.execPath, ["--check", TARGETS[2]], {
  cwd: ROOT, encoding: "utf8",
})
assert.equal(nodeSyntax.status, 0, `node_syntax_failed:${nodeSyntax.stderr}`)
const check = spawnSync(python, [
  "-B", TARGETS[1],
  "--object-reference-multiscale-implementation-contract",
  "--implementation-authorization", authorizationArg,
  "--implementation-consumption", consumptionArg,
], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_contract_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.status, "passed_stage4_object_reference_multiscale_readonly_gpu_entry_implementation_cpu_contract")
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
for (const field of [
  "checkpointFileRead", "modelLoaded", "optimizerCreated", "autogradExecuted",
  "backwardMethodExecuted", "gpuUsed", "cudaInitialized", "trainingStarted",
  "validationStarted", "smokeStarted",
]) {
  assert.equal(cpu[field], false, `${field}_opened_in_cpu_report`)
}

const now = new Date().toISOString()
const codeBindings = Object.fromEntries(
  TARGETS.map((target) => [path.basename(target), bind(resolveProject(target))]),
)
writeJsonAtomic(files.cpu, {
  ...cpu,
  syntaxCheckedFiles: TARGETS,
  authorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-reference-multiscale-readonly-gpu-entry-implementation-attestation-v1",
  status: "stage4_object_reference_multiscale_gpu_diagnostic_implementation_cpu_verified",
  runnerSha256: sha(resolveProject(TARGETS[0])),
  cpuCheckerSha256: sha(resolveProject(TARGETS[1])),
  cpuReportSha256: sha(files.cpu),
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  futureGpuExecutionAuthorized: false,
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-readonly-gpu-entry-implementation-report-v1",
  status: "stage4_object_reference_multiscale_readonly_gpu_entry_implemented_inactive",
  authorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  sourceEvidence: authorization.sourceEvidence,
  codeBindings,
  cpuReport: bind(files.cpu),
  implementationAttestation: bind(files.attestation),
  implementationFinding: {
    futureAuthorizationSchema: "ai-painter-owner-stage4-object-reference-multiscale-luminance-structure-readonly-gpu-gradient-qualification-v1",
    futureRequestId: FUTURE_GPU_REQUEST_ID,
    contractId: "typed_object_multiscale_luminance_structure_correlation_supervision_v1",
    exactDiagnosticMetricCount: 48,
    exactPyramidScales: [1, 0.5, 0.25],
    fourSeparateAggregateGradientRoutesSpecified: true,
    combinedGradientRouteSpecified: true,
    atomicGpuAuthorizationConsumptionPrecedesEvidenceWrites: true,
    currentGpuExecutionAuthorized: false,
  },
  executionBoundary: {
    gpuUsed: false,
    cudaInitialized: false,
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

const priorGpuAuthorizationPath = resolveProject(
  ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-025000000/gpu-execution-authorization.json",
)
const priorGpuAuthorization = read(priorGpuAuthorizationPath)
const futureBindingInputs = {
  cpuTerminal: authorization.sourceEvidence.cpuTerminal,
  implementationReport: authorization.sourceEvidence.implementationReport,
  cpuReport: authorization.sourceEvidence.cpuReport,
  supportContract: authorization.sourceEvidence.supportContract,
  inactiveConfigFragment: authorization.sourceEvidence.inactiveConfigFragment,
  gpuQualificationRequest: authorization.sourceEvidence.gpuQualificationRequest,
  sourceConfig: read(resolveProject(authorization.sourceEvidence.inactiveConfigFragment.path)).sourceConfig,
  model: priorGpuAuthorization.bindings.model,
  trainer: authorization.sourceEvidence.trainerFrozen,
  compiler: {
    path: "ml/ai-painter/scripts/compile_stage4_object_reference_multiscale_luminance_structure_supervision_config.py",
    sha256: sha(resolveProject("ml/ai-painter/scripts/compile_stage4_object_reference_multiscale_luminance_structure_supervision_config.py")),
  },
  objectCpuChecker: {
    path: "ml/ai-painter/scripts/check_stage4_object_reference_multiscale_luminance_structure_supervision_cpu.py",
    sha256: sha(resolveProject("ml/ai-painter/scripts/check_stage4_object_reference_multiscale_luminance_structure_supervision_cpu.py")),
  },
  modeRegistry: priorGpuAuthorization.bindings.modeRegistry,
  datasetManifest: priorGpuAuthorization.bindings.datasetManifest,
  datasetSourceIndex: priorGpuAuthorization.bindings.datasetSourceIndex,
  projectAutoencoderCheckpoint: {
    ...priorGpuAuthorization.bindings.projectAutoencoderCheckpoint,
    weightsReadNow: false,
    identityInheritedFrom: bind(priorGpuAuthorizationPath),
  },
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  runner: codeBindings[path.basename(TARGETS[0])],
  cpuChecker: codeBindings[path.basename(TARGETS[1])],
  entryImplementationReport: bind(files.attestation),
}
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-reference-multiscale-readonly-gpu-execution-inactive-contract-v1",
  status: "inactive_owner_gpu_authorization_required",
  futureRequestId: FUTURE_GPU_REQUEST_ID,
  futureCommandRef: FUTURE_GPU_REQUEST_ID,
  futureScope: "one_stage4_four_object_reference_multiscale_luminance_structure_readonly_gpu_gradient_qualification_only",
  futureAuthorizationSchema: "ai-painter-owner-stage4-object-reference-multiscale-luminance-structure-readonly-gpu-gradient-qualification-v1",
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  cpuReport: bind(files.cpu),
  requiredBindings: futureBindingInputs,
  executionBoundary: {
    oneFixedValidationSample194: true,
    oneReadonlyCudaForward: true,
    torchAutogradGradOnly: true,
    fourSeparateTypedMultiscaleAggregateRoutes: true,
    oneCombinedTypedMultiscaleRoute: true,
    optimizerCreation: false,
    backwardMethodExecution: false,
    modelWeightModification: false,
    checkpointWrite: false,
    training: false,
    validation: false,
    smoke: false,
    automaticRetry: false,
    stage1OrStage2: false,
  },
  gpuExecutionAuthorizedNow: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_review_and_choose_one_multiscale_readonly_gpu_gradient_qualification_or_candidate_exit",
  requestedFutureRequestId: FUTURE_GPU_REQUEST_ID,
  boundImplementationReport: bind(files.report),
  boundImplementationAttestation: bind(files.attestation),
  boundCpuReport: bind(files.cpu),
  boundInactiveGpuExecutionContract: bind(files.contract),
  gpuAuthorized: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-readonly-gpu-entry-implementation-terminal-v1",
  status: "stage4_object_reference_multiscale_readonly_gpu_entry_implementation_succeeded_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_review_and_choose_one_multiscale_readonly_gpu_gradient_qualification_or_candidate_exit",
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 multiscale readonly GPU qualification entry implemented and inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "separate_owner_gpu_execution_authorization_not_present",
  nextLegalAction: "owner_review_and_choose_one_multiscale_readonly_gpu_gradient_qualification_or_candidate_exit",
  evidence: {
    implementationReport: bind(files.report),
    implementationAttestation: bind(files.attestation),
    cpuReport: bind(files.cpu),
    inactiveGpuExecutionContract: bind(files.contract),
    ownerActionRequest: bind(files.owner),
  },
  forbiddenActions: [
    "gpu_without_separate_owner_authorization", "training", "validation", "smoke",
    "automatic_retry", "stage1_or_stage2",
  ],
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
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
  id: `stage4-object-reference-multiscale-gpu-entry-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_readonly_gpu_entry_implementation",
  runId: REQUEST_ID,
  kind: "cpu_validation",
  status: "success",
  title: "Stage4 multiscale readonly GPU qualification entry implemented",
  titleZh: "Stage4 多尺度只读 GPU 资格入口实施完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；未执行 CUDA、autograd、模型加载、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  cpuReport: bind(files.cpu),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
