import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-integrated-preflight-lineage-isolation-correction-20260815-192800000"
const SCOPE = "one_cpu_bounded_early_convergence_integrated_preflight_lineage_isolation_correction"
const OUTPUT_NAMESPACE = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-integrated-preflight-lineage-isolation-corrections/20260815-192800000"
const FUTURE_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualification-20260815-193500000"
const FUTURE_SCOPE = "one_fixed_sample194_two_lane_early_convergence_readonly_gpu_gradient_qualification_only"
const FUTURE_SCHEMA = "ai-painter-owner-stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualification-v1"
const OLD_GPU_AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualification-20260815-191500000/authorization.json"
const OLD_GPU_CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualification-20260815-191500000/gpu-execution-consumption.json"
const OLD_GPU_OUTPUT = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualifications/20260815-191500000"
const TARGETS = [
  "ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py",
  "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_gradient_diagnostic_cpu.py",
  "scripts/record-stage4-object-reference-multiscale-early-convergence-integrated-preflight-lineage-isolation-correction.mjs",
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
assert.equal(sha(authorizationPath), authorizationSha256)
assert.equal(sha(consumptionPath), consumptionSha256)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.outputNamespace, OUTPUT_NAMESPACE)
assert.deepEqual(authorization.authorizedTargetPaths, TARGETS)
assert.equal(consumption.status, "cpu_only_integrated_preflight_lineage_isolation_correction_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, authorizationSha256)
for (const field of [
  "gpuUsed", "cudaInitialized", "autogradExecuted", "checkpointFileRead",
  "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted",
  "validationStarted", "smokeStarted", "stage0Started", "stage1Started", "stage2Started",
]) assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
for (const [name, binding] of Object.entries(authorization.requiredBindings)) {
  if (["runner", "cpuChecker"].includes(name)) continue
  assert.equal(sha(resolveProject(binding.path)), binding.sha256, `${name}_changed`)
}
assert.equal(fs.existsSync(resolveProject(OLD_GPU_CONSUMPTION)), false, "old_gpu_authorization_consumed")
assert.equal(fs.existsSync(resolveProject(OLD_GPU_OUTPUT)), false, "old_gpu_evidence_exists")

const output = resolveProject(OUTPUT_NAMESPACE)
assert.equal(fs.existsSync(output), false, "output_namespace_exists")
const python = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const syntax = spawnSync(python, [
  "-B", "-c",
  "import ast,pathlib,sys; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in sys.argv[1:]]",
  TARGETS[0], TARGETS[1],
], { cwd: ROOT, encoding: "utf8" })
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)
const nodeSyntax = spawnSync(process.execPath, ["--check", TARGETS[2]], { cwd: ROOT, encoding: "utf8" })
assert.equal(nodeSyntax.status, 0, `node_syntax_failed:${nodeSyntax.stderr}`)
const check = spawnSync(python, [
  "-B", TARGETS[1],
  "--early-convergence-integrated-preflight-correction-contract",
  "--implementation-authorization", authorizationArg,
  "--implementation-consumption", consumptionArg,
], { cwd: ROOT, encoding: "utf8" })
assert.equal(check.status, 0, `cpu_contract_failed:${check.stderr}`)
const cpu = JSON.parse(check.stdout)
assert.equal(cpu.status, "passed_stage4_early_convergence_integrated_preflight_lineage_isolation_cpu_contract")
assert.equal(cpu.positivePassed, cpu.positiveTotal)
assert.equal(cpu.negativePassed, cpu.negativeTotal)

const files = {
  cpu: path.join(output, "cpu-report.json"),
  retirement: path.join(output, "unconsumed-gpu-authorization-retirement.json"),
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
  ...cpu,
  syntaxCheckedFiles: TARGETS,
  authorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.retirement, {
  schemaVersion: "stage4-unconsumed-gpu-authorization-retirement-v1",
  status: "unconsumed_gpu_authorization_retired_after_integrated_preflight_contract_failure",
  authorization: bind(resolveProject(OLD_GPU_AUTH)),
  gpuConsumptionPath: OLD_GPU_CONSUMPTION,
  gpuConsumptionExists: false,
  gpuEvidenceRoot: OLD_GPU_OUTPUT,
  gpuEvidenceRootExists: false,
  reusable: false,
  automaticRetryAuthorized: false,
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.attestation, {
  schemaVersion: "stage4-early-convergence-integrated-preflight-lineage-isolation-implementation-attestation-v1",
  status: "stage4_object_reference_multiscale_early_convergence_gpu_diagnostic_implementation_cpu_verified",
  requestId: FUTURE_REQUEST_ID,
  runnerSha256: codeBindings.runner.sha256,
  cpuCheckerSha256: codeBindings.cpuChecker.sha256,
  cpuReportSha256: sha(files.cpu),
  correctionAuthorization: bind(authorizationPath),
  correctionConsumption: bind(consumptionPath),
  retiredGpuAuthorization: bind(files.retirement),
  futureGpuExecutionAuthorized: false,
  gpuUsed: false,
  cudaInitialized: false,
  autogradExecuted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-early-convergence-integrated-preflight-lineage-isolation-implementation-report-v1",
  status: "stage4_early_convergence_integrated_preflight_lineage_isolation_corrected_cpu_only",
  correctionAuthorization: bind(authorizationPath),
  correctionConsumption: bind(consumptionPath),
  codeBindings,
  cpuReport: bind(files.cpu),
  implementationAttestation: bind(files.attestation),
  retiredGpuAuthorization: bind(files.retirement),
  finding: {
    rootCause: "integrated_preflight_called_closed_smoke_execution_lineage_validation",
    correction: "early_convergence_preflight_uses_bounded_readonly_diagnostic_config_validation",
    otherObjectVisibleModesPreserved: true,
    controlFlowReachedCudaAvailabilityGateUnderCpuRejectStub: true,
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

const oldGpuAuthorization = read(resolveProject(OLD_GPU_AUTH))
const executionRoot = ".runtime/ai-painter/stage4-object-reference-multiscale-early-convergence-readonly-gpu-gradient-qualifications/20260815-193500000"
const implementation = {
  cpuReportPath: relative(files.cpu),
  implementationAttestationPath: relative(files.attestation),
  pythonPreflightPath: `${executionRoot}/python-preflight.json`,
  resourcePreflightPath: `${executionRoot}/resource-preflight.json`,
}
const execution = {
  outputDirectory: `${executionRoot}/gpu-execution`,
  gpuConsumptionPath: `.runtime/ai-painter/owner-action-requests/${FUTURE_REQUEST_ID}/gpu-execution-consumption.json`,
}
const futureBindings = {
  implementationReport: oldGpuAuthorization.bindings.implementationReport,
  inactiveSupportContract: oldGpuAuthorization.bindings.inactiveSupportContract,
  inactiveConfig: oldGpuAuthorization.bindings.inactiveConfig,
  cpuReport: oldGpuAuthorization.bindings.cpuReport,
  trainer: oldGpuAuthorization.bindings.trainer,
  datasetManifest: oldGpuAuthorization.bindings.datasetManifest,
  datasetSourceIndex: oldGpuAuthorization.bindings.datasetSourceIndex,
  projectAutoencoderCheckpoint: oldGpuAuthorization.bindings.projectAutoencoderCheckpoint,
  implementationAuthorization: bind(authorizationPath),
  implementationConsumption: bind(consumptionPath),
  runner: codeBindings.runner,
  cpuChecker: codeBindings.cpuChecker,
  entryImplementationReport: bind(files.attestation),
}
const proposedAuthorization = {
  schemaVersion: FUTURE_SCHEMA,
  status: "owner_authorized_unconsumed",
  requestId: FUTURE_REQUEST_ID,
  commandRef: FUTURE_REQUEST_ID,
  scope: FUTURE_SCOPE,
  taskIdentity: oldGpuAuthorization.taskIdentity,
  executionActions: oldGpuAuthorization.executionActions,
  failurePolicy: oldGpuAuthorization.failurePolicy,
  implementation,
  execution,
  bindings: futureBindings,
}
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-early-convergence-readonly-gpu-execution-inactive-contract-v2",
  status: "inactive_owner_gpu_authorization_required",
  proposedAuthorization,
  correctionReport: bind(files.report),
  retiredGpuAuthorization: bind(files.retirement),
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
  proposedAuthorization,
  boundCorrectionReport: bind(files.report),
  boundCpuReport: bind(files.cpu),
  boundRetirementRecord: bind(files.retirement),
  fixedTotalProgress: progress,
  nextLegalAction: "owner_approve_new_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
const combination = spawnSync(python, [
  "-B", "-c",
  "import json,pathlib,sys; sys.path.insert(0,'ml/ai-painter/scripts'); import run_ai_assisted_v9_r5_stage4_gradient_diagnostic as r; a=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))['proposedAuthorization']; r.validate_authorization_document(a, True); a['_authorizationSha256']='0'*64; r.validate_implementation_attestation(pathlib.Path(a['implementation']['implementationAttestationPath']), a); print('passed')",
  relative(files.owner),
], { cwd: ROOT, encoding: "utf8" })
assert.equal(combination.status, 0, `full_proposed_authorization_combination_failed:${combination.stderr}`)
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-early-convergence-integrated-preflight-lineage-isolation-terminal-v1",
  status: "stage4_early_convergence_integrated_preflight_lineage_isolation_correction_succeeded_closed",
  fixedTotalProgress: progress,
  implementationReport: bind(files.report),
  implementationAttestation: bind(files.attestation),
  cpuReport: bind(files.cpu),
  retiredGpuAuthorization: bind(files.retirement),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  fullProposedAuthorizationCombinationRegression: "passed",
  nextLegalAction: "owner_review_and_approve_new_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
  gpuUsed: false, cudaInitialized: false, autogradExecuted: false,
  trainingStarted: false, validationStarted: false, smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "stage4_early_convergence_integrated_preflight_lineage_isolation_correction_succeeded_closed",
  module: "AI Painter R5",
  currentStage: "Two-lane readonly GPU integrated preflight corrected; new execution inactive",
  fixedTotalProgress: progress,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  cpuReport: bind(files.cpu),
  retiredGpuAuthorization: bind(files.retirement),
  inactiveGpuExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  latestBlocker: "new_readonly_gpu_execution_authorization_not_present",
  nextLegalAction: "owner_review_and_approve_new_fixed_sample194_two_lane_readonly_gpu_gradient_qualification_or_exit",
  gpuUsedNow: false, trainingStartedNow: false, smokeStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: nowShanghai,
})

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file),
    storageLayer: "hot", runId: REQUEST_ID, artifactType: "record",
    byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-early-convergence-integrated-preflight-correction-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_early_convergence_integrated_preflight_lineage_isolation_correction",
  runId: REQUEST_ID,
  kind: "cpu_only_bounded_contract_correction",
  status: "success",
  title: "Stage4 early-convergence integrated preflight lineage isolation corrected",
  titleZh: "Stage4 早期收敛集成预检血缘隔离修正完成",
  detailZh: `CPU 正向 ${cpu.positivePassed}/${cpu.positiveTotal}、反向 ${cpu.negativePassed}/${cpu.negativeTotal}；旧 GPU 授权未消费退役，未执行 GPU、CUDA、autograd、训练、验证或 Smoke。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: progress,
})
closeStorageCatalog()
console.log(JSON.stringify({
  status: read(files.terminal).status,
  terminal: bind(files.terminal),
  implementationReport: bind(files.report),
  cpuReport: bind(files.cpu),
  retiredGpuAuthorization: bind(files.retirement),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
  positive: `${cpu.positivePassed}/${cpu.positiveTotal}`,
  negative: `${cpu.negativePassed}/${cpu.negativeTotal}`,
  fullCombinationRegression: "passed",
}, null, 2))
