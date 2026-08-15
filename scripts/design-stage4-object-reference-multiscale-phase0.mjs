import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  AUTHORIZATION_SHA256,
  CONSUMPTION_SHA256,
  FIXED_IDENTITY,
  buildInactivePhase0Design,
  validateAuthorizationAndConsumption,
  validatePhase0DesignSource,
} from "./lib/ai-painter-stage4-object-reference-multiscale-phase0-design.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-design-20260815-151200000"
const OUTPUT = ".runtime/ai-painter/stage4-object-reference-multiscale-phase0-designs/20260815-151200000"
const NEXT_REQUEST_ID = "owner-authorized-stage4-object-reference-multiscale-phase0-execution-entry-implementation-20260815-153000000"
const NEXT_OUTPUT = ".runtime/ai-painter/stage4-object-reference-multiscale-phase0-execution-entry-implementations/20260815-153000000"
const RUNNER = "scripts/design-stage4-object-reference-multiscale-phase0.mjs"
const CHECKER = "scripts/check-stage4-object-reference-multiscale-phase0-design.mjs"
const LIBRARY = "scripts/lib/ai-painter-stage4-object-reference-multiscale-phase0-design.mjs"

const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.equal(typeof value, "string", "path_argument_missing")
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })

const authorizationPath = projectFile(arg("--authorization"))
const consumptionPath = projectFile(arg("--consumption"))
assert.equal(shaFile(authorizationPath), AUTHORIZATION_SHA256, "authorization_sha256_mismatch")
assert.equal(shaFile(consumptionPath), CONSUMPTION_SHA256, "consumption_sha256_mismatch")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
validateAuthorizationAndConsumption({ authorization, consumption })
assert.equal(authorization.execution.outputDirectory, OUTPUT)
assert.equal(relative(consumptionPath), authorization.execution.consumptionPath)
for (const [name, binding] of Object.entries(authorization.bindings)) {
  assert.equal(shaFile(projectFile(binding.path)), binding.sha256, `${name}_binding_changed`)
}
assert.equal(fs.existsSync(projectFile(OUTPUT)), false, "phase0_design_output_already_exists")
assert.equal(
  fs.existsSync(projectFile(`.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/authorization.json`)),
  false,
  "next_authorization_created_without_owner",
)
assert.equal(fs.existsSync(projectFile(NEXT_OUTPUT)), false, "next_output_created_without_owner")

const source = {
  gpuTerminal: read(projectFile(authorization.bindings.gpuTerminal.path)),
  diagnosticReport: read(projectFile(authorization.bindings.diagnosticReport.path)),
  finalizationReport: read(projectFile(authorization.bindings.finalizationReport.path)),
  finalizationTerminal: read(projectFile(authorization.bindings.finalizationTerminal.path)),
}
validatePhase0DesignSource(source)
const design = buildInactivePhase0Design(source)

const runnerPath = projectFile(RUNNER)
const checkerPath = projectFile(CHECKER)
const libraryPath = projectFile(LIBRARY)
for (const target of [runnerPath, checkerPath, libraryPath]) {
  const syntax = spawnSync(process.execPath, ["--check", target], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
  })
  assert.equal(syntax.status, 0, `syntax_failed:${relative(target)}:${syntax.stderr}`)
}
const regression = spawnSync(process.execPath, [
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

const output = projectFile(OUTPUT)
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-contract-report.json"),
  report: path.join(output, "phase0-design-report.json"),
  contract: path.join(output, "inactive-phase0-execution-contract.json"),
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
  ...design,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceEvidence: authorization.bindings,
  cpuContractReport: bind(files.cpu),
  runner: bind(runnerPath),
  checker: bind(checkerPath),
  library: bind(libraryPath),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-execution-inactive-contract-v1",
  status: "inactive_owner_execution_entry_implementation_authorization_required",
  candidateIdentity: FIXED_IDENTITY,
  purpose: design.purpose,
  executionSequence: design.executionSequence,
  updateGates: design.updateGates,
  reproducibilityGates: design.reproducibilityGates,
  evidenceRequirements: design.evidenceRequirements,
  qualificationBoundary: design.qualificationBoundary,
  requiredBindings: {
    designAuthorization: bind(authorizationPath),
    designConsumption: bind(consumptionPath),
    gpuAuthorization: authorization.bindings.gpuAuthorization,
    gpuConsumption: authorization.bindings.gpuConsumption,
    gpuTerminal: authorization.bindings.gpuTerminal,
    diagnosticReport: authorization.bindings.diagnosticReport,
    finalizationReport: authorization.bindings.finalizationReport,
    finalizationTerminal: authorization.bindings.finalizationTerminal,
    phase0DesignReport: bind(files.report),
    phase0DesignCpuReport: bind(files.cpu),
    phase0DesignRunner: bind(runnerPath),
    phase0DesignChecker: bind(checkerPath),
    phase0DesignLibrary: bind(libraryPath),
  },
  phase0ExecutionAuthorizedNow: false,
  gpuAuthorizedNow: false,
  trainingAuthorizedNow: false,
  smokeAuthorizedNow: false,
  stage0AuthorizedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-reference-multiscale-phase0-design-terminal-v1",
  status: "stage4_object_reference_multiscale_phase0_design_completed_inactive_closed",
  phase0DesignReport: bind(files.report),
  inactivePhase0ExecutionContract: bind(files.contract),
  cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_cpu_only_object_reference_multiscale_phase0_execution_entry_implementation_or_exit",
  gpuUsedNow: false,
  cudaInitializedNow: false,
  autogradExecutedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const implementationSources = {
  phase0PythonRunner: bind(projectFile("ml/ai-painter/scripts/run_stage4_object_visible_structure_phase0.py")),
  diagnosticRunner: bind(projectFile("ml/ai-painter/scripts/run_ai_assisted_v9_r5_stage4_gradient_diagnostic.py")),
  trainer: bind(projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")),
  candidateCompiler: bind(projectFile("ml/ai-painter/scripts/compile_stage4_object_reference_multiscale_luminance_structure_supervision_config.py")),
  modeRegistry: bind(projectFile("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py")),
}
const proposedAuthorization = {
  schemaVersion: "ai-painter-owner-stage4-object-reference-multiscale-phase0-execution-entry-implementation-v1",
  status: "owner_authorized_unconsumed",
  requestId: NEXT_REQUEST_ID,
  commandRef: NEXT_REQUEST_ID,
  scope: "one_cpu_only_implementation_of_inactive_object_reference_multiscale_phase0_execution_entry_and_contract_regression",
  bindings: {
    designAuthorization: bind(authorizationPath),
    designConsumption: bind(consumptionPath),
    gpuTerminal: authorization.bindings.gpuTerminal,
    diagnosticReport: authorization.bindings.diagnosticReport,
    finalizationReport: authorization.bindings.finalizationReport,
    finalizationTerminal: authorization.bindings.finalizationTerminal,
    phase0DesignReport: bind(files.report),
    inactivePhase0ExecutionContract: bind(files.contract),
    phase0DesignTerminal: bind(files.terminal),
    phase0DesignCpuReport: bind(files.cpu),
    phase0DesignRunner: bind(runnerPath),
    phase0DesignChecker: bind(checkerPath),
    phase0DesignLibrary: bind(libraryPath),
    ...implementationSources,
  },
  authorizedTargetPaths: [
    "ml/ai-painter/scripts/run_stage4_object_visible_structure_phase0.py",
    "ml/ai-painter/scripts/check_stage4_object_reference_multiscale_phase0_cpu.py",
    "scripts/run-stage4-object-reference-multiscale-phase0.mjs",
    "scripts/check-stage4-object-reference-multiscale-phase0-execution-entry.mjs",
  ],
  permittedActions: [
    "implement_one_bounded_phase0_execution_entry_for_current_multiscale_candidate",
    "bind_current_inactive_multiscale_config_and_exact_phase0_design_contract",
    "run_python_node_syntax_and_cpu_positive_negative_contract_regression",
    "write_implementation_report_terminal_capsule_and_inactive_gpu_phase0_owner_request",
    "synchronize_event_ledger_and_sqlite_index",
  ],
  forbiddenActions: [
    "gpu", "cuda", "autograd", "checkpoint_read_or_load", "model_load",
    "optimizer", "backward", "weight_modification", "training", "validation",
    "smoke", "automatic_retry", "stage1", "stage2", "formal_inference",
    "checkpoint_promotion", "runtime_frame", "world_entry", "review_threshold_change",
    "trainer_change", "model_change", "loss_change", "data_change", "source_config_change",
  ],
  execution: {
    consumptionPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/consumption.json`,
    outputDirectory: NEXT_OUTPUT,
    consumeBeforeFirstWrite: true,
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
  requestedAction: "owner_authorize_cpu_only_object_reference_multiscale_phase0_execution_entry_implementation_or_exit",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/authorization.json`,
  proposedAuthorization,
  boundDesignReport: bind(files.report),
  boundInactiveContract: bind(files.contract),
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
  currentStage: "Object-reference multiscale Phase0 engineering qualification designed but inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "immutable_owner_phase0_execution_entry_implementation_authorization_not_created_or_consumed",
  nextLegalAction: "owner_authorize_cpu_only_object_reference_multiscale_phase0_execution_entry_implementation_or_exit",
  forbiddenActions: authorization.forbiddenActions,
  evidence: {
    gpuTerminal: authorization.bindings.gpuTerminal,
    diagnosticReport: authorization.bindings.diagnosticReport,
    finalizationTerminal: authorization.bindings.finalizationTerminal,
    phase0DesignReport: bind(files.report),
    inactivePhase0ExecutionContract: bind(files.contract),
    cpuContractReport: bind(files.cpu),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsedNow: false,
  cudaInitializedNow: false,
  checkpointReadNow: false,
  modelLoadedNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const indexedFiles = [
  authorizationPath,
  consumptionPath,
  runnerPath,
  checkerPath,
  libraryPath,
  ...Object.values(authorization.bindings).map((binding) => projectFile(binding.path)),
  ...Object.values(implementationSources).map((binding) => projectFile(binding.path)),
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
    sha256: shaFile(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-object-reference-multiscale-phase0-design-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_reference_multiscale_phase0_design",
  runId: REQUEST_ID,
  kind: "cpu_only_phase0_design",
  status: "success",
  title: "Object-reference multiscale Phase0 engineering qualification designed inactive",
  titleZh: "四对象参考对齐多尺度亮度—结构监督Phase 0工程资格设计完成但未激活",
  detailZh: `CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}；本轮未启动GPU/CUDA/autograd，未读取Checkpoint、未加载模型、未训练。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  cpuContractReport: bind(files.cpu),
  phase0DesignReport: bind(files.report),
  inactivePhase0ExecutionContract: bind(files.contract),
  terminal: bind(files.terminal),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
