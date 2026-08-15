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
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-20260815-190500000"
const AUTH_SCHEMA = "owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-v1"
const SCOPE = "one_cpu_only_bounded_early_convergence_readonly_gpu_entry_implementation"
const OUTPUT_NAMESPACE = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementations/20260815-190500000"
const FUTURE_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualification-20260815-191500000"
const FUTURE_SCOPE = "one_fixed_sample194_two_lane_early_convergence_readonly_gpu_gradient_qualification_only"
const FUTURE_SCHEMA = "ai-painter-owner-stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualification-v1"
const TARGETS = [
  "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
  "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
  "scripts/record-stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation.mjs",
]
const ACTIONS = [
  "modify_only_existing_stage4_gradient_diagnostic_runner_cpu_checker_and_one_bounded_recorder",
  "add_inactive_two_lane_readonly_gpu_qualification_mode",
  "execute_python_node_syntax_checks_and_cpu_positive_negative_contract_regression",
  "form_implementation_report_inactive_gpu_execution_contract_owner_request_terminal_capsule_ledger_and_sqlite_index",
]

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const result = path.resolve(ROOT, value)
  assert.ok(result.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return result
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
const consumptionSha256 = arg("--consumption-sha256")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg && consumptionSha256, "authorization_arguments_required")
const authorizationPath = resolveProject(authorizationArg)
const consumptionPath = resolveProject(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
assert.equal(sha(consumptionPath), consumptionSha256, "consumption_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, AUTH_SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.outputNamespace, OUTPUT_NAMESPACE)
assert.deepEqual(authorization.authorizedTargetPaths, TARGETS)
assert.deepEqual(authorization.allowedActions, ACTIONS)
assert.equal(authorization.oneTimeConsumptionRequired, true)
for (const [name, binding] of Object.entries(authorization.requiredBindings)) {
  if (["currentGradientRunner", "currentGradientCpuChecker"].includes(name)) continue
  const source = resolveProject(binding.path)
  assert.equal(fs.existsSync(source), true, `${name}_missing`)
  assert.equal(sha(source), binding.sha256, `${name}_changed`)
}
assert.deepEqual(authorization.targetPreimageBindings.runner, authorization.requiredBindings.currentGradientRunner)
assert.deepEqual(authorization.targetPreimageBindings.cpuChecker, authorization.requiredBindings.currentGradientCpuChecker)
assert.equal(authorization.targetPreimageBindings.recorder.mustNotExistBeforeFirstWrite, true)
for (const field of [
  "futureGpuExecutionAuthorized", "cudaInitializationAuthorized", "autogradExecutionAuthorized",
  "checkpointFileReadAuthorized", "modelLoadAuthorized", "optimizerCreationAuthorized",
  "backwardExecutionAuthorized", "trainingAuthorized", "validationAuthorized",
  "smokeAuthorized", "automaticRetryAuthorized", "stage0Authorized", "stage1Or2Authorized",
]) assert.equal(authorization[field], false, `${field}_opened`)
assert.equal(
  consumption.status,
  "cpu_only_early_convergence_readonly_gpu_entry_implementation_authorization_atomically_consumed",
)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
assert.equal(consumption.scope, SCOPE)
assert.equal(consumption.authorizationSha256, authorizationSha256)
assert.deepEqual(consumption.authorizedTargetPaths, TARGETS)
assert.equal(consumption.oneTimeConsumption, true)
for (const field of [
  "checkpointFileRead", "modelLoaded", "optimizerCreated", "autogradExecuted",
  "backwardExecuted", "modelWeightsMutated", "gpuUsed", "cudaInitialized",
  "trainingStarted", "validationStarted", "smokeStarted", "stage0Started",
  "stage1Started", "stage2Started",
]) assert.equal(consumption[field], false, `${field}_opened_in_consumption`)

const output = resolveProject(OUTPUT_NAMESPACE)
if (process.argv.includes("--finalize-post-verification-correction")) {
  assert.equal(fs.existsSync(output), true, "initial_implementation_output_missing")
  const finalFiles = {
    cpu: path.join(output, "cpu-report-complete.json"),
    attestation: path.join(output, "implementation-attestation-complete.json"),
    report: path.join(output, "implementation-report-complete.json"),
    contract: path.join(output, "inactive-gpu-execution-contract-complete.json"),
    owner: path.join(output, "owner-action-request-complete.json"),
    terminal: path.join(output, "phase-terminal-complete.json"),
    capsule: path.join(output, "local-task-capsule-complete.json"),
  }
  assert.equal(Object.values(finalFiles).some((file) => fs.existsSync(file)), false, "final_evidence_already_exists")
  const projectPython = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
  const syntax = spawnSync(projectPython, [
    "-B", "-c",
    "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
    TARGETS[0], TARGETS[1],
  ], { cwd: ROOT, encoding: "utf8" })
  assert.equal(syntax.status, 0, `final_python_syntax_failed:${syntax.stderr}`)
  const nodeSyntax = spawnSync(process.execPath, ["--check", TARGETS[2]], { cwd: ROOT, encoding: "utf8" })
  assert.equal(nodeSyntax.status, 0, `final_node_syntax_failed:${nodeSyntax.stderr}`)
  const check = spawnSync(projectPython, [
    "-B", TARGETS[1], "--early-convergence-implementation-contract",
    "--implementation-authorization", authorizationArg,
    "--implementation-consumption", consumptionArg,
  ], { cwd: ROOT, encoding: "utf8" })
  assert.equal(check.status, 0, `final_cpu_contract_failed:${check.stderr}`)
  const cpu = JSON.parse(check.stdout)
  assert.equal(cpu.positivePassed, cpu.positiveTotal)
  assert.equal(cpu.negativePassed, cpu.negativeTotal)
  const now = new Date().toISOString()
  const nowShanghai = formatShanghai(now)
  const progress = { completedStages: 3, totalStages: 5, percent: 60 }
  const codeBindings = {
    runner: bind(resolveProject(TARGETS[0])),
    cpuChecker: bind(resolveProject(TARGETS[1])),
    recorder: bind(resolveProject(TARGETS[2])),
  }
  writeJsonAtomic(finalFiles.cpu, {
    ...cpu,
    status: "passed_stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_cpu_contract",
    postVerificationCorrection: "diagnostic_mode_isolated_from_closed_smoke_execution_lineage",
    syntaxCheckedFiles: TARGETS,
    authorization: bind(authorizationPath),
    implementationConsumption: bind(consumptionPath),
    recordedAtUtc: now,
    recordedAtAsiaShanghai: nowShanghai,
  })
  writeJsonAtomic(finalFiles.attestation, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-attestation-v1",
    status: "stage4_object_reference_multiscale_early_convergence_gpu_diagnostic_implementation_cpu_verified",
    requestId: FUTURE_REQUEST_ID,
    runnerSha256: codeBindings.runner.sha256,
    cpuCheckerSha256: codeBindings.cpuChecker.sha256,
    cpuReportSha256: sha(finalFiles.cpu),
    implementationAuthorization: bind(authorizationPath),
    implementationConsumption: bind(consumptionPath),
    supersedesPrematureAttestation: bind(path.join(output, "implementation-attestation.json")),
    futureGpuExecutionAuthorized: false,
    gpuUsed: false,
    cudaInitialized: false,
    autogradExecuted: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: nowShanghai,
  })
  const priorGpuAuthorizationPath = resolveProject(
    ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-reference-multiscale-readonly-gpu-gradient-qualification-20260815-144500000/authorization.json",
  )
  const priorGpuAuthorization = read(priorGpuAuthorizationPath)
  const futureBindings = {
    implementationReport: authorization.requiredBindings.implementationReport,
    inactiveSupportContract: authorization.requiredBindings.inactiveSupportContract,
    inactiveConfig: authorization.requiredBindings.inactiveConfig,
    cpuReport: authorization.requiredBindings.cpuReport,
    trainer: authorization.requiredBindings.trainer,
    datasetManifest: priorGpuAuthorization.bindings.datasetManifest,
    datasetSourceIndex: priorGpuAuthorization.bindings.datasetSourceIndex,
    projectAutoencoderCheckpoint: {
      ...priorGpuAuthorization.bindings.projectAutoencoderCheckpoint,
      weightsReadNow: false,
      identityInheritedFrom: bind(priorGpuAuthorizationPath),
    },
    implementationAuthorization: bind(authorizationPath),
    implementationConsumption: bind(consumptionPath),
    runner: codeBindings.runner,
    cpuChecker: codeBindings.cpuChecker,
    entryImplementationReport: bind(finalFiles.attestation),
  }
  const executionRoot = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualifications/20260815-191500000"
  const taskIdentity = {
    architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
    trainingObjectiveContractId: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1",
    sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
    sampleSplit: "validation",
    seed: 20263722,
    timestep: 999,
    resolution: { width: 256, height: 192 },
    requiredBoundarySides: ["west"],
    objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    pyramidScales: [1, 0.5, 0.25],
    replayLaneCount: 2,
    diagnosticManifestMetricCount: 48,
    denoiserInitialization: "fixed_random_seed_20263722",
    autoencoderState: "bound_project_checkpoint_loaded_and_frozen",
  }
  const executionActions = {
    projectAutoencoderCheckpointReadAndLoadFrozen: true,
    fixedRandomDenoiserInitialization: true,
    singleSample194ValidationRead: true,
    singleReadonlyCudaForward: true,
    torchAutogradGradInspection: true,
    lane1SelectedGlobalWorstClassGradientVerification: true,
    lane2JointFourObjectReferenceMultiscaleGradientVerification: true,
    combinedTwoLaneGradientVerification: true,
    matchingSemanticMixtureExpertRouteVerification: true,
    exactFortyEightDiagnosticManifestExport: true,
    preAndPostModelStateSha256IdentityComparison: true,
    cudaTelemetryWrite: true,
    diagnosticReportWrite: true,
    terminalEvidenceWrite: true,
    failedDenoiserCheckpointReadOrLoad: false,
    optimizerCreation: false,
    backwardMethodExecution: false,
    modelWeightModification: false,
    checkpointWrite: false,
    training: false,
    validation: false,
    smoke: false,
    automaticRetry: false,
    stage0OrStage1OrStage2: false,
    formalInference: false,
    checkpointPromotion: false,
    runtimeFrame: false,
    worldEntry: false,
  }
  const implementation = {
    cpuReportPath: relative(finalFiles.cpu),
    implementationAttestationPath: relative(finalFiles.attestation),
    pythonPreflightPath: `${executionRoot}/python-preflight.json`,
    resourcePreflightPath: `${executionRoot}/resource-preflight.json`,
  }
  const execution = {
    outputDirectory: `${executionRoot}/gpu-execution`,
    gpuConsumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-consumption.json`,
  }
  const failurePolicy = {
    stopImmediately: true, automaticRetry: false,
    preserveEvidence: true, noTrainingEscalation: true,
  }
  writeJsonAtomic(finalFiles.report, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-report-v2",
    status: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implemented_inactive_final",
    authorization: bind(authorizationPath),
    implementationConsumption: bind(consumptionPath),
    supersedesPrematureReport: bind(path.join(output, "implementation-report.json")),
    correction: "readonly_diagnostic_config_validation_isolated_from_closed_smoke_execution_lineage",
    codeBindings,
    cpuReport: bind(finalFiles.cpu),
    implementationAttestation: bind(finalFiles.attestation),
    executionBoundary: {
      checkpointFileRead: false, modelLoaded: false, optimizerCreated: false,
      autogradExecuted: false, backwardExecuted: false, gpuUsed: false,
      cudaInitialized: false, trainingStarted: false, validationStarted: false,
      smokeStarted: false, stage0Started: false, stage1Started: false, stage2Started: false,
    },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: nowShanghai,
  })
  writeJsonAtomic(finalFiles.contract, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-execution-inactive-contract-v2",
    status: "inactive_owner_gpu_authorization_required",
    futureRequestId: FUTURE_REQUEST_ID,
    futureCommandRef: FUTURE_REQUEST_ID,
    futureScope: FUTURE_SCOPE,
    futureAuthorizationSchema: FUTURE_SCHEMA,
    taskIdentity,
    executionActions,
    implementation,
    execution,
    requiredBindings: futureBindings,
    failurePolicy,
    supersedesPrematureContract: bind(path.join(output, "inactive-gpu-execution-contract.json")),
    gpuExecutionAuthorizedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: nowShanghai,
  })
  writeJsonAtomic(finalFiles.owner, {
    schemaVersion: "stage4-owner-action-request-v1",
    status: "awaiting_owner_review_not_authorized",
    requestId: `request-${FUTURE_REQUEST_ID}`,
    commandRef: FUTURE_REQUEST_ID,
    requestType: "fixed_sample194_two_lane_readonly_gpu_gradient_qualification",
    proposedAuthorization: {
      schemaVersion: FUTURE_SCHEMA,
      status: "owner_authorized_unconsumed",
      requestId: FUTURE_REQUEST_ID,
      commandRef: FUTURE_REQUEST_ID,
      scope: FUTURE_SCOPE,
      taskIdentity,
      executionActions,
      failurePolicy,
      implementation,
      execution,
      bindings: futureBindings,
    },
    supersedesPrematureOwnerRequest: bind(path.join(output, "owner-action-request.json")),
    fixedTotalProgress: progress,
    nextLegalAction: "owner_approve_one_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
    recordedAtUtc: now,
    recordedAtAsiaShanghai: nowShanghai,
  })
  const combination = spawnSync(projectPython, [
    "-B", "-c",
    "import json,pathlib,sys; sys.path.insert(0,'ml/ai-painter/scripts'); import run_ai_assisted_v9_r5_stage4_gradient_diagnostic as r; a=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))['proposedAuthorization']; r.validate_authorization_document(a, True); a['_authorizationSha256']='0'*64; r.validate_implementation_attestation(pathlib.Path(a['implementation']['implementationAttestationPath']), a); print('passed')",
    relative(finalFiles.owner),
  ], { cwd: ROOT, encoding: "utf8" })
  assert.equal(combination.status, 0, `full_proposed_authorization_combination_failed:${combination.stderr}`)
  writeJsonAtomic(finalFiles.terminal, {
    schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-terminal-v2",
    status: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_succeeded_closed_final",
    fixedTotalProgress: progress,
    supersedesPrematureTerminal: bind(path.join(output, "phase-terminal.json")),
    implementationReport: bind(finalFiles.report),
    implementationAttestation: bind(finalFiles.attestation),
    cpuReport: bind(finalFiles.cpu),
    inactiveGpuExecutionContract: bind(finalFiles.contract),
    ownerActionRequest: bind(finalFiles.owner),
    fullProposedAuthorizationImplementationCombinationRegression: "passed",
    nextLegalAction: "owner_review_and_approve_one_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
    gpuUsed: false, cudaInitialized: false, autogradExecuted: false,
    trainingStarted: false, validationStarted: false, smokeStarted: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: nowShanghai,
  })
  writeJsonAtomic(finalFiles.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    status: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_succeeded_closed_final",
    module: "AI Painter R5",
    currentStage: "Two-lane readonly GPU qualification entry implemented, corrected, and inactive",
    fixedTotalProgress: progress,
    terminal: bind(finalFiles.terminal),
    implementationReport: bind(finalFiles.report),
    implementationAttestation: bind(finalFiles.attestation),
    cpuReport: bind(finalFiles.cpu),
    inactiveGpuExecutionContract: bind(finalFiles.contract),
    ownerActionRequest: bind(finalFiles.owner),
    latestBlocker: "separate_readonly_gpu_execution_authorization_not_present",
    nextLegalAction: "owner_review_and_approve_one_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
    gpuUsedNow: false, trainingStartedNow: false, smokeStartedNow: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: nowShanghai,
  })
  for (const file of Object.values(finalFiles)) {
    const stat = fs.statSync(file)
    indexArtifact({
      logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file),
      storageLayer: "hot", runId: REQUEST_ID, artifactType: "record",
      byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file),
    })
  }
  appendAiPainterProgramEvent({
    id: `stage4-object-reference-multiscale-early-convergence-gpu-entry-final-${REQUEST_ID}`,
    timestamp: now,
    action: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_finalization",
    runId: REQUEST_ID,
    kind: "cpu_only_post_verification_contract_correction",
    status: "success",
    title: "Stage4 two-lane readonly GPU entry final combination regression passed",
    titleZh: "Stage4 双通道只读 GPU 入口最终组合回归通过",
    detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；已隔离关闭的 Smoke 血缘，未执行 GPU、CUDA、autograd、训练、验证或 Smoke。`,
    evidencePath: relative(finalFiles.terminal),
    evidenceSha256: sha(finalFiles.terminal),
    fixedTotalProgress: progress,
  })
  closeStorageCatalog()
  console.log(JSON.stringify({
    status: read(finalFiles.terminal).status,
    terminal: bind(finalFiles.terminal),
    implementationReport: bind(finalFiles.report),
    implementationAttestation: bind(finalFiles.attestation),
    cpuReport: bind(finalFiles.cpu),
    inactiveGpuExecutionContract: bind(finalFiles.contract),
    ownerActionRequest: bind(finalFiles.owner),
    capsule: bind(finalFiles.capsule),
    positive: `${cpu.positivePassed}/${cpu.positiveTotal}`,
    negative: `${cpu.negativePassed}/${cpu.negativeTotal}`,
    fullCombinationRegression: "passed",
  }, null, 2))
  process.exit(0)
}
assert.equal(fs.existsSync(output), false, "output_namespace_exists")
const projectPython = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
assert.equal(fs.existsSync(projectPython), true, "project_python_missing")
const syntax = spawnSync(projectPython, [
  "-B", "-c",
  "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
  TARGETS[0], TARGETS[1],
], { cwd: ROOT, encoding: "utf8" })
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const nodeSyntax = spawnSync(process.execPath, ["--check", TARGETS[2]], { cwd: ROOT, encoding: "utf8" })
assert.equal(nodeSyntax.status, 0, `node_syntax_failed:${nodeSyntax.stderr}`)
const check = spawnSync(projectPython, [
  "-B", TARGETS[1],
  "--early-convergence-implementation-contract",
  "--implementation-authorization", authorizationArg,
  "--implementation-consumption", consumptionArg,
], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_contract_failed:${check.stderr}`)
const rawCpu = JSON.parse(check.stdout)
assert.equal(rawCpu.status, "passed_stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_cpu_contract")
assert.equal(rawCpu.positivePassed, rawCpu.positiveTotal)
assert.equal(rawCpu.negativePassed, rawCpu.negativeTotal)
for (const field of [
  "checkpointFileRead", "modelLoaded", "optimizerCreated", "autogradExecuted",
  "backwardMethodExecuted", "gpuUsed", "cudaInitialized", "trainingStarted",
  "validationStarted", "smokeStarted",
]) assert.equal(rawCpu[field], false, `${field}_opened_in_cpu_report`)

const files = {
  cpu: path.join(output, "cpu-report.json"),
  attestation: path.join(output, "implementation-attestation.json"),
  report: path.join(output, "implementation-report.json"),
  contract: path.join(output, "inactive-gpu-execution-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
const nowShanghai = formatShanghai(now)
const progress = { completedStages: 3, totalStages: 5, percent: 60 }
const codeBindings = {
  runner: bind(resolveProject(TARGETS[0])),
  cpuChecker: bind(resolveProject(TARGETS[1])),
  recorder: bind(resolveProject(TARGETS[2])),
}
writeJsonAtomic(files.cpu, {
  ...rawCpu,
  syntaxCheckedFiles: TARGETS,
  authorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-attestation-v1",
  status: "stage4_object_reference_multiscale_early_convergence_gpu_diagnostic_implementation_cpu_verified",
  requestId: FUTURE_REQUEST_ID,
  runnerSha256: codeBindings.runner.sha256,
  cpuCheckerSha256: codeBindings.cpuChecker.sha256,
  cpuReportSha256: sha(files.cpu),
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  futureGpuExecutionAuthorized: false,
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-report-v1",
  status: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implemented_inactive",
  authorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  sourceEvidence: authorization.requiredBindings,
  codeBindings,
  cpuReport: bind(files.cpu),
  implementationAttestation: bind(files.attestation),
  implementationFinding: {
    candidateContractId: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1",
    lane1: "selected_existing_global_worst_sample_class_gradient",
    lane2: "joint_four_object_reference_multiscale_gradient",
    combinedTwoLaneGradient: true,
    exactDiagnosticMetricCount: 48,
    sourceConfigurationRemainsInactiveAndImmutable: true,
    optimizerOrBackwardRequired: false,
    currentGpuExecutionAuthorized: false,
  },
  executionBoundary: {
    checkpointFileRead: false, modelLoaded: false, optimizerCreated: false,
    autogradExecuted: false, backwardExecuted: false, gpuUsed: false,
    cudaInitialized: false, trainingStarted: false, validationStarted: false,
    smokeStarted: false, stage0Started: false, stage1Started: false, stage2Started: false,
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})

const priorGpuAuthorizationPath = resolveProject(
  ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-reference-multiscale-readonly-gpu-gradient-qualification-20260815-144500000/authorization.json",
)
const priorGpuAuthorization = read(priorGpuAuthorizationPath)
const executionRoot = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualifications/20260815-191500000"
const futureBindings = {
  implementationReport: authorization.requiredBindings.implementationReport,
  inactiveSupportContract: authorization.requiredBindings.inactiveSupportContract,
  inactiveConfig: authorization.requiredBindings.inactiveConfig,
  cpuReport: authorization.requiredBindings.cpuReport,
  trainer: authorization.requiredBindings.trainer,
  datasetManifest: priorGpuAuthorization.bindings.datasetManifest,
  datasetSourceIndex: priorGpuAuthorization.bindings.datasetSourceIndex,
  projectAutoencoderCheckpoint: {
    ...priorGpuAuthorization.bindings.projectAutoencoderCheckpoint,
    weightsReadNow: false,
    identityInheritedFrom: bind(priorGpuAuthorizationPath),
  },
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  runner: codeBindings.runner,
  cpuChecker: codeBindings.cpuChecker,
  entryImplementationReport: bind(files.attestation),
}
const taskIdentity = {
  architectureId: "stage4_fact_conditioned_semantic_mixture_decoder_v1",
  trainingObjectiveContractId: "stage4_object_reference_multiscale_two_lane_early_convergence_stabilization_v1",
  sampleId: "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6",
  sampleSplit: "validation",
  seed: 20263722,
  timestep: 999,
  resolution: { width: 256, height: 192 },
  requiredBoundarySides: ["west"],
  objectSemanticChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
  pyramidScales: [1, 0.5, 0.25],
  replayLaneCount: 2,
  diagnosticManifestMetricCount: 48,
  denoiserInitialization: "fixed_random_seed_20263722",
  autoencoderState: "bound_project_checkpoint_loaded_and_frozen",
}
const executionActions = {
  projectAutoencoderCheckpointReadAndLoadFrozen: true,
  fixedRandomDenoiserInitialization: true,
  singleSample194ValidationRead: true,
  singleReadonlyCudaForward: true,
  torchAutogradGradInspection: true,
  lane1SelectedGlobalWorstClassGradientVerification: true,
  lane2JointFourObjectReferenceMultiscaleGradientVerification: true,
  combinedTwoLaneGradientVerification: true,
  matchingSemanticMixtureExpertRouteVerification: true,
  exactFortyEightDiagnosticManifestExport: true,
  preAndPostModelStateSha256IdentityComparison: true,
  cudaTelemetryWrite: true,
  diagnosticReportWrite: true,
  terminalEvidenceWrite: true,
  failedDenoiserCheckpointReadOrLoad: false,
  optimizerCreation: false,
  backwardMethodExecution: false,
  modelWeightModification: false,
  checkpointWrite: false,
  training: false,
  validation: false,
  smoke: false,
  automaticRetry: false,
  stage0OrStage1OrStage2: false,
  formalInference: false,
  checkpointPromotion: false,
  runtimeFrame: false,
  worldEntry: false,
}
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-execution-inactive-contract-v1",
  status: "inactive_owner_gpu_authorization_required",
  futureRequestId: FUTURE_REQUEST_ID,
  futureCommandRef: FUTURE_REQUEST_ID,
  futureScope: FUTURE_SCOPE,
  futureAuthorizationSchema: FUTURE_SCHEMA,
  taskIdentity,
  executionActions,
  implementation: {
    cpuReportPath: relative(files.cpu),
    implementationAttestationPath: relative(files.attestation),
    pythonPreflightPath: `${executionRoot}/python-preflight.json`,
    resourcePreflightPath: `${executionRoot}/resource-preflight.json`,
  },
  execution: {
    outputDirectory: `${executionRoot}/gpu-execution`,
    gpuConsumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-consumption.json`,
  },
  requiredBindings: futureBindings,
  failurePolicy: {
    stopImmediately: true, automaticRetry: false,
    preserveEvidence: true, noTrainingEscalation: true,
  },
  gpuExecutionAuthorizedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-owner-action-request-v1",
  status: "awaiting_owner_review_not_authorized",
  requestId: `request-${FUTURE_REQUEST_ID}`,
  commandRef: FUTURE_REQUEST_ID,
  requestType: "fixed_sample194_two_lane_readonly_gpu_gradient_qualification",
  proposedAuthorization: {
    schemaVersion: FUTURE_SCHEMA,
    status: "owner_authorized_unconsumed",
    requestId: FUTURE_REQUEST_ID,
    commandRef: FUTURE_REQUEST_ID,
    scope: FUTURE_SCOPE,
    taskIdentity,
    executionActions,
    failurePolicy: {
      stopImmediately: true, automaticRetry: false,
      preserveEvidence: true, noTrainingEscalation: true,
    },
    implementation: read(files.contract).implementation,
    execution: read(files.contract).execution,
    bindings: futureBindings,
  },
  fixedTotalProgress: progress,
  nextLegalAction: "owner_approve_one_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-early-convergence-readonly-gpu-entry-implementation-terminal-v1",
  status: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_succeeded_closed",
  fixedTotalProgress: progress,
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  cpuReport: bind(files.cpu),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  nextLegalAction: "owner_review_and_approve_one_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation_succeeded_closed",
  module: "AI Painter R5",
  currentStage: "Two-lane early-convergence readonly GPU qualification entry implemented and inactive",
  fixedTotalProgress: progress,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  cpuReport: bind(files.cpu),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  latestBlocker: "separate_readonly_gpu_execution_authorization_not_present",
  nextLegalAction: "owner_review_and_approve_one_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
  gpuUsedNow: false,
  trainingStartedNow: false,
  smokeStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: REQUEST_ID,
    artifactType: "record",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-early-convergence-gpu-entry-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_early_convergence_readonly_gpu_entry_implementation",
  runId: REQUEST_ID,
  kind: "cpu_only_bounded_implementation_and_contract_regression",
  status: "success",
  title: "Stage4 two-lane readonly GPU qualification entry implemented",
  titleZh: "Stage4 双通道只读 GPU 资格入口实施完成",
  detailZh: `CPU 正向 ${rawCpu.positivePassed}/${rawCpu.positiveTotal}、反向 ${rawCpu.negativePassed}/${rawCpu.negativeTotal}；未执行 GPU、CUDA、autograd、模型加载、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: progress,
})
closeStorageCatalog()
console.log(JSON.stringify({
  status: read(files.terminal).status,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  cpuReport: bind(files.cpu),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
  positive: `${rawCpu.positivePassed}/${rawCpu.positiveTotal}`,
  negative: `${rawCpu.negativePassed}/${rawCpu.negativeTotal}`,
}, null, 2))
