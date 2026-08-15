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
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-qualification-finalization-20260815-034500000"
const SCOPE = "one_cpu_only_finalization_and_formal_index_of_completed_four_object_gpu_qualification"
const AUTH_SHA = "c15bcad3cafb8a7e822e0be2f5d08afe27cba464bdb6457052fd4822da93b6f6"
const CONSUMPTION_SHA = "3cc98e65fc85b2fe45f2bcb273d00cd91fa9d98953dc065f164b5b13c4df8d7e"
const CHECKER = "scripts/check-stage4-object-visible-structure-readonly-gpu-qualification-finalization.mjs"
const FINALIZER = "scripts/finalize-stage4-object-visible-structure-readonly-gpu-qualification.mjs"
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-readonly-gpu-gradient-qualification-finalizations/20260815-034500000"
const PHASE0_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-design-20260815-035000000"
const PHASE0_AUTH = `.runtime/ai-painter/owner-action-requests/${PHASE0_REQUEST_ID}/authorization.json`
const PHASE0_OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-designs/20260815-035000000"

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
assert.equal(sha(authorizationPath), AUTH_SHA)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA)
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(authorization.execution.outputDirectory, OUTPUT)
assert.equal(authorization.execution.futurePhase0RequestId, PHASE0_REQUEST_ID)
assert.equal(consumption.status, "gpu_qualification_cpu_finalization_authorization_atomically_consumed")
assert.equal(consumption.oneTimeConsumption, true)
for (const [name, binding] of Object.entries(authorization.bindings)) {
  const file = resolveProject(binding.path)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}
assert.equal(fs.existsSync(resolveProject(PHASE0_AUTH)), false, "phase0_authorization_created_without_owner")
assert.equal(fs.existsSync(resolveProject(PHASE0_OUTPUT)), false, "phase0_output_created_without_owner")

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

const output = resolveProject(OUTPUT)
assert.equal(fs.existsSync(output), false, "finalization_output_exists")
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-contract-report.json"),
  report: path.join(output, "finalization-report.json"),
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
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-qualification-finalization-report-v1",
  status: "four_object_visible_structure_gpu_qualification_evidence_verified_and_index_ready",
  sourceRunId: "20260815-025000000",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceEvidence: authorization.bindings,
  cpuContractReport: bind(files.cpu),
  checker: bind(checkerPath),
  finalizer: bind(finalizerPath),
  qualification: {
    status: "passed",
    objectChannels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    diagnosticManifestMetricCount: 32,
    denoiserStateUnchanged: true,
    autoencoderStateUnchanged: true,
    parameterGradFieldsAbsent: true,
  },
  currentExecution: {
    gpuUsed: false,
    cudaInitialized: false,
    checkpointRead: false,
    modelLoaded: false,
    trainingStarted: false,
  },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-qualification-finalization-terminal-v1",
  status: "four_object_visible_structure_gpu_qualification_formally_finalized_closed",
  sourceRunId: "20260815-025000000",
  finalizationReport: bind(files.report),
  cpuContractReport: bind(files.cpu),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_create_bound_cpu_only_phase0_design_authorization_or_exit",
  gpuUsedNow: false,
  checkpointReadNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const proposedPhase0Authorization = {
  schemaVersion: "ai-painter-owner-stage4-object-visible-structure-phase0-design-v1",
  status: "owner_authorized_unconsumed",
  requestId: PHASE0_REQUEST_ID,
  commandRef: PHASE0_REQUEST_ID,
  scope: "one_cpu_only_phase0_design_and_inactive_execution_contract_for_four_object_visible_structure_candidate",
  bindings: {
    gpuAuthorization: authorization.bindings.gpuAuthorization,
    gpuConsumption: authorization.bindings.gpuConsumption,
    gpuTerminal: authorization.bindings.gpuTerminal,
    diagnosticReport: authorization.bindings.diagnosticReport,
    finalizationReport: bind(files.report),
    finalizationTerminal: bind(files.terminal),
  },
  permittedActions: [
    "design_one_bounded_phase0_contract_for_current_four_object_candidate",
    "define_fixed_sample_seed_resolution_and_reproducibility_gates",
    "define_cpu_positive_negative_contract_regressions",
    "write_inactive_phase0_contract_design_report_terminal_capsule_and_execution_owner_request",
    "synchronize_event_ledger_and_sqlite_index",
  ],
  forbiddenActions: [
    "gpu", "cuda", "autograd", "checkpoint_read_or_load", "model_load",
    "optimizer", "backward", "weight_modification", "training", "validation",
    "smoke", "automatic_retry", "stage1", "stage2", "formal_inference",
    "checkpoint_promotion", "runtime_frame", "world_entry", "review_threshold_change",
  ],
  execution: {
    consumptionPath: `.runtime/ai-painter/owner-action-requests/${PHASE0_REQUEST_ID}/consumption.json`,
    outputDirectory: PHASE0_OUTPUT,
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
  requestedAction: "owner_create_bound_cpu_only_phase0_design_authorization_or_exit",
  requestedAuthorizationPath: PHASE0_AUTH,
  proposedAuthorization: proposedPhase0Authorization,
  boundFinalizationReport: bind(files.report),
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
  currentStage: "Four-object visible-structure readonly GPU qualification formally finalized; Phase0 not authorized",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "immutable_owner_phase0_design_authorization_not_created_or_consumed",
  nextLegalAction: "owner_create_bound_cpu_only_phase0_design_authorization_or_exit",
  forbiddenActions: authorization.forbiddenActions,
  evidence: {
    gpuTerminal: authorization.bindings.gpuTerminal,
    diagnosticReport: authorization.bindings.diagnosticReport,
    finalizationReport: bind(files.report),
    cpuContractReport: bind(files.cpu),
    ownerActionRequest: bind(files.owner),
  },
  gpuUsedNow: false,
  checkpointReadNow: false,
  trainingStartedNow: false,
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
  id: `stage4-object-visible-structure-gpu-qualification-finalization-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_gpu_qualification_cpu_finalization",
  runId: REQUEST_ID,
  kind: "cpu_finalization",
  status: "success",
  title: "Four-object visible-structure GPU qualification formally finalized",
  titleZh: "四对象可见结构GPU资格已完成正式CPU续结",
  detailZh: `GPU来源证据通过只读核验；CPU正向${cpu.positivePassed}/${cpu.positiveTotal}、反向${cpu.negativePassed}/${cpu.negativeTotal}。本次未启动GPU、未读取Checkpoint、未加载模型或训练。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: read(files.terminal).status,
  cpuContractReport: bind(files.cpu),
  finalizationReport: bind(files.report),
  terminal: bind(files.terminal),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
}, null, 2))
