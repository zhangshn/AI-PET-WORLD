import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-entry-attestation-lineage-correction-20260815-014000000"
const SCOPE = "correct_object_visible_structure_gpu_entry_attestation_lineage_and_issue_new_inactive_owner_request_only"
const AUTH_SHA = "bc1e7683db629fb7af2514c1d89c1ba0fad9f409d7825f16b74ec8813e50642f"
const CONSUMPTION_SHA = "38ca33b0101d65170113a25f4ced67ba00591ae2a9efb3641c7f2192f8cc6fe6"
const RUNNER = "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py"
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py"
const TARGET = "scripts/record-stage4-object-visible-structure-readonly-gpu-entry-attestation-lineage-correction.mjs"
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-entry-attestation-lineage-corrections/20260815-014000000"
const FUTURE_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-015000000"
const FUTURE_SCOPE = "one_stage4_four_object_visible_structure_readonly_gpu_gradient_qualification_only"
const FUTURE_SCHEMA = "ai-painter-owner-stage4-object-visible-structure-readonly-gpu-gradient-qualification-v1"
const FUTURE_AUTH = `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-authorization.json`
const FUTURE_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-qualifications/20260815-015000000"
const ENTRY_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-entry-implementations/20260815-005000000"
const CPU_ROOT = ".runtime/ai-painter/stage4-object-visible-structure-supervision/20260815-002000000"
const SOURCE_CONFIG = ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260814-154900000-stage0/active-config.json"
const DATASET_ROOT = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z"
const AUTOENCODER_BINDING = {
  path: ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt",
  sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
}

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const authorizationPath = resolveProject(arg("--authorization"))
const consumptionPath = resolveProject(arg("--consumption"))
assert.equal(sha(authorizationPath), AUTH_SHA)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.outputNamespace, OUTPUT)
assert.equal(authorization.lineageCorrectionAuthorized, true)
for (const field of ["gpuAuthorized", "autogradAuthorized", "checkpointReadAuthorized", "modelLoadAuthorized", "trainingAuthorized", "validationAuthorized", "smokeAuthorized"]) {
  assert.equal(authorization[field], false, `${field}_opened`)
}
assert.equal(consumption.status, "attestation_lineage_correction_authorization_atomically_consumed")
assert.equal(consumption.oneTimeConsumption, true)
for (const field of ["retiredGpuAuthorizationConsumed", "newGpuAuthorizationCreated", "newGpuAuthorizationConsumed", "gpuUsed", "autogradExecuted", "checkpointFileRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  if (name === "runnerPreimage") {
    assert.deepEqual(binding, { path: RUNNER, sha256: "9ff80a5b5e025f70ac0be756375913b97d0410a4e018b93d0f1755792452aec3" })
    continue
  }
  if (name === "cpuCheckerPreimage") {
    assert.deepEqual(binding, { path: CHECKER, sha256: "fced8bb92924998436054976c315bdc6429a59dff007afc45a836addb8fdf43e" })
    continue
  }
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}
assert.equal(fs.existsSync(resolveProject(FUTURE_AUTH)), false, "new_gpu_authorization_created_without_owner")
assert.equal(fs.existsSync(resolveProject(
  ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-qualification-20260815-010000000/gpu-execution-consumption.json",
)), false, "retired_gpu_authorization_consumed")

const runnerPath = resolveProject(RUNNER)
const checkerPath = resolveProject(CHECKER)
const python = resolveProject("ml/ai-painter/.venv/Scripts/python.exe")
const safeEnvironment = { ...process.env, CUDA_VISIBLE_DEVICES: "" }
const syntax = spawnSync(python, ["-m", "py_compile", runnerPath, checkerPath], { cwd: ROOT, encoding: "utf8", env: safeEnvironment })
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const regression = spawnSync(python, [
  checkerPath,
  "--object-visible-structure-implementation-contract",
  "--implementation-authorization", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/authorization.json",
  "--implementation-consumption", ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/implementation-consumption.json",
], { cwd: ROOT, encoding: "utf8", env: safeEnvironment })
assert.equal(regression.status, 0, `cpu_regression_failed:${regression.stderr}`)
const cpu = JSON.parse(regression.stdout)
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)
assert.equal(cpu.positive.newLineageAttestationPathBound, true)

const output = resolveProject(OUTPUT)
assert.equal(fs.existsSync(output), false, "lineage_output_exists")
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-report.json"),
  attestation: path.join(output, "implementation-attestation.json"),
  report: path.join(output, "lineage-correction-report.json"),
  contract: path.join(output, "inactive-gpu-execution-contract.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
writeJsonAtomic(files.cpu, {
  ...cpu,
  authorization: bind(authorizationPath),
  lineageCorrectionConsumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const oldCpuReport = resolveProject(`${ENTRY_ROOT}/cpu-report.json`)
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-lineage-implementation-attestation-v1",
  status: "stage4_object_visible_structure_gpu_diagnostic_implementation_cpu_verified",
  lineageCorrectionRequestId: REQUEST_ID,
  authorization: bind(authorizationPath),
  lineageCorrectionConsumption: bind(consumptionPath),
  prerequisiteCorrectionTerminal: authorization.sourceEvidence.prerequisiteCorrectionTerminal,
  prerequisiteCorrectionReport: authorization.sourceEvidence.prerequisiteCorrectionReport,
  runnerPath: RUNNER,
  runnerSha256: sha(runnerPath),
  cpuCheckerPath: CHECKER,
  cpuCheckerSha256: sha(checkerPath),
  cpuReportPath: relative(oldCpuReport),
  cpuReportSha256: sha(oldCpuReport),
  futureRequestId: FUTURE_REQUEST_ID,
  futureScope: FUTURE_SCOPE,
  gpuUsed: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  modelLoaded: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-attestation-lineage-correction-report-v1",
  status: "attestation_lineage_corrected_cpu_verified_inactive",
  runId: "20260814-154900000-stage0",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  runner: bind(runnerPath),
  cpuChecker: bind(checkerPath),
  cpuReport: bind(files.cpu),
  implementationAttestation: bind(files.attestation),
  lineageFinding: {
    retiredFutureRequestId: authorization.lineageCorrection.retiredFutureRequestId,
    newFutureRequestId: FUTURE_REQUEST_ID,
    newFutureAuthorizationPath: FUTURE_AUTH,
    existingCpuReportPreserved: bind(oldCpuReport),
    newImplementationAttestation: bind(files.attestation),
    modelDataLossReviewContractsChanged: false,
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
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-lineage-corrected-inactive-execution-contract-v1",
  status: "cpu_verified_inactive_new_owner_gpu_authorization_required",
  implementationAttestation: bind(files.attestation),
  lineageCorrectionReport: bind(files.report),
  futureAuthorizationIdentity: { path: FUTURE_AUTH, schemaVersion: FUTURE_SCHEMA, requestId: FUTURE_REQUEST_ID, commandRef: FUTURE_REQUEST_ID, scope: FUTURE_SCOPE },
  gpuAuthorizedNow: false,
  autogradAuthorizedNow: false,
  checkpointReadAuthorizedNow: false,
  trainingAuthorized: false,
  validationAuthorized: false,
  smokeAuthorized: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-gpu-entry-attestation-lineage-correction-terminal-v1",
  status: "attestation_lineage_correction_succeeded_closed_gpu_inactive",
  runId: "20260814-154900000-stage0",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  lineageCorrectionReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  inactiveGpuExecutionContract: bind(files.contract),
  nextLegalAction: "owner_create_new_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  gpuUsed: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  modelLoaded: false,
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
  projectAutoencoderCheckpoint: AUTOENCODER_BINDING,
  implementationAuthorization: bind(resolveProject(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/authorization.json")),
  implementationConsumption: bind(resolveProject(".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-entry-implementation-20260815-005000000/implementation-consumption.json")),
  runner: bind(runnerPath),
  cpuChecker: bind(checkerPath),
  entryImplementationReport: bind(files.attestation),
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_create_new_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  requestedAuthorizationPath: FUTURE_AUTH,
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
    failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noTrainingEscalation: true },
    implementation: {
      cpuReportPath: `${ENTRY_ROOT}/cpu-report.json`,
      implementationAttestationPath: relative(files.attestation),
      pythonPreflightPath: `${FUTURE_ROOT}/python-preflight.json`,
      resourcePreflightPath: `${FUTURE_ROOT}/resource-preflight.json`,
    },
    execution: {
      outputDirectory: `${FUTURE_ROOT}/gpu-execution`,
      gpuConsumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-consumption.json`,
    },
    bindings: futureBindings,
  },
  boundLineageCorrectionReport: bind(files.report),
  boundImplementationAttestation: bind(files.attestation),
  boundInactiveExecutionContract: bind(files.contract),
  boundTerminal: bind(files.terminal),
  gpuExecutedNow: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 four-object GPU entry attestation lineage corrected; new GPU authorization inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "new_immutable_owner_gpu_qualification_authorization_not_created_or_consumed",
  nextLegalAction: "owner_create_new_bound_immutable_readonly_gpu_qualification_authorization_or_exit",
  forbiddenActions: authorization.deniedActions,
  evidence: { lineageCorrectionReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuReport: bind(files.cpu), inactiveGpuExecutionContract: bind(files.contract), ownerActionRequest: bind(files.owner) },
  gpuUsed: false,
  autogradExecuted: false,
  checkpointFileRead: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [authorizationPath, consumptionPath, runnerPath, checkerPath, resolveProject(TARGET), ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-entry-attestation-lineage-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_gpu_entry_attestation_lineage_correction",
  runId: REQUEST_ID,
  kind: "cpu_contract_correction",
  status: "success",
  title: "Stage4 GPU entry attestation lineage corrected",
  titleZh: "Stage4 GPU 入口实施证明血缘修正完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；新 GPU 授权尚未建立，未启动 GPU、autograd、Checkpoint 读取、模型加载或训练。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: read(files.terminal).status, terminal: bind(files.terminal), lineageCorrectionReport: bind(files.report), implementationAttestation: bind(files.attestation), cpuReport: bind(files.cpu), inactiveGpuExecutionContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
