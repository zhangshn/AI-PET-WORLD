import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  AUTHORIZATION_SHA256,
  CONSUMPTION_SHA256,
  FORBIDDEN_ACTIONS,
  REQUEST_ID,
} from "./lib/ai-painter-stage4-object-visible-structure-phase0-design.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const AUTH = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-design-20260815-035000000/authorization.json"
const CONSUMPTION = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-object-visible-structure-phase0-design-20260815-035000000/consumption.json"
const OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-designs/20260815-035000000"
const NEXT_REQUEST_ID = "owner-authorized-stage4-object-visible-structure-phase0-design-output-parent-correction-20260815-041500000"
const NEXT_OUTPUT = ".runtime/ai-painter/stage4-object-visible-structure-phase0-designs/20260815-041500000"
const resolveProject = (value) => path.resolve(ROOT, value)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const authorizationPath = resolveProject(AUTH)
const consumptionPath = resolveProject(CONSUMPTION)
assert.equal(sha(authorizationPath), AUTHORIZATION_SHA256)
assert.equal(sha(consumptionPath), CONSUMPTION_SHA256)
const authorization = JSON.parse(fs.readFileSync(authorizationPath, "utf8"))
const consumption = JSON.parse(fs.readFileSync(consumptionPath, "utf8"))
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(consumption.status, "stage4_object_visible_structure_phase0_design_authorization_atomically_consumed")

const output = resolveProject(OUTPUT)
assert.equal(fs.existsSync(output), false, "unexpected_partial_output_exists")
fs.mkdirSync(output, { recursive: true })
const files = {
  failure: path.join(output, "failure-report.json"),
  terminal: path.join(output, "phase-terminal.json"),
  owner: path.join(output, "owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const runner = resolveProject("scripts/design-stage4-object-visible-structure-phase0.mjs")
const checker = resolveProject("scripts/check-stage4-object-visible-structure-phase0-design.mjs")
const library = resolveProject("scripts/lib/ai-painter-stage4-object-visible-structure-phase0-design.mjs")
const recorder = resolveProject("scripts/record-stage4-object-visible-structure-phase0-design-output-parent-failure.mjs")
const now = new Date().toISOString()
const shanghai = formatShanghai(now)
writeJsonAtomic(files.failure, {
  schemaVersion: "stage4-object-visible-structure-phase0-design-failure-report-v1",
  status: "phase0_design_output_namespace_creation_failed_closed",
  failureClassification: "output_registration_program_error",
  failureCode: "output_parent_missing_non_recursive_mkdir",
  failedStep: "create_phase0_design_output_namespace",
  failedCommand: "node scripts/design-stage4-object-visible-structure-phase0.mjs --authorization <bound> --consumption <bound>",
  exactError: "ENOENT: no such file or directory, mkdir 'F:\\ai-pet-world\\.runtime\\ai-painter\\stage4-object-visible-structure-phase0-designs\\20260815-035000000'",
  rootCause: "the runner called fs.mkdirSync(output, { recursive: false }) before the stage4-object-visible-structure-phase0-designs parent existed",
  impact: {
    designReportWritten: false,
    inactiveExecutionContractWritten: false,
    successTerminalWritten: false,
    cpuContractHadPassedBeforeFailure: true,
    cpuPositive: { passed: 17, total: 17 },
    cpuNegative: { passed: 23, total: 23 },
    candidateOrModelVerdictChanged: false,
    fixedProgressChanged: false,
  },
  currentExecution: {
    gpuUsed: false,
    cudaInitialized: false,
    autogradExecuted: false,
    checkpointReadOrWritten: false,
    modelLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightModified: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
    automaticRetryStarted: false,
  },
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  failedRunner: bind(runner),
  checker: bind(checker),
  library: bind(library),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-phase0-design-terminal-v1",
  status: "stage4_object_visible_structure_phase0_design_output_registration_failed_closed",
  failureReport: bind(files.failure),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_one_cpu_only_phase0_design_output_parent_correction_and_fresh_execution_or_exit",
  gpuUsedNow: false,
  checkpointReadOrWrittenNow: false,
  trainingStartedNow: false,
  automaticRetryStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
const proposedAuthorization = {
  schemaVersion: "ai-painter-owner-stage4-object-visible-structure-phase0-design-output-parent-correction-v1",
  status: "owner_authorized_unconsumed",
  requestId: NEXT_REQUEST_ID,
  commandRef: NEXT_REQUEST_ID,
  scope: "one_cpu_only_output_parent_creation_correction_and_fresh_phase0_design_execution",
  bindings: {
    priorAuthorization: bind(authorizationPath),
    priorConsumption: bind(consumptionPath),
    failureReport: bind(files.failure),
    failureTerminal: bind(files.terminal),
    failedRunner: bind(runner),
    checker: bind(checker),
    library: bind(library),
  },
  permittedActions: [
    "change_only_phase0_design_runner_output_parent_creation_to_recursive_bounded_creation",
    "execute_node_syntax_and_existing_cpu_positive_negative_contract_regressions",
    "execute_one_fresh_cpu_only_phase0_design_in_new_output_namespace",
    "write_design_report_inactive_contract_terminal_capsule_and_next_owner_request",
    "synchronize_event_ledger_and_sqlite_index",
  ],
  forbiddenActions: [...FORBIDDEN_ACTIONS],
  execution: {
    consumptionPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/consumption.json`,
    outputDirectory: NEXT_OUTPUT,
    consumeBeforeFirstWrite: true,
  },
  failurePolicy: { stopImmediately: true, automaticRetry: false, preserveEvidence: true, noGpuEscalation: true },
}
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_authorize_one_cpu_only_phase0_design_output_parent_correction_and_fresh_execution_or_exit",
  requestedAuthorizationPath: `.runtime/ai-painter/owner-action-requests/${NEXT_REQUEST_ID}/authorization.json`,
  proposedAuthorization,
  boundFailureReport: bind(files.failure),
  boundFailureTerminal: bind(files.terminal),
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Four-object visible-structure Phase0 design output registration failed closed",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "phase0_design_output_parent_creation_requires_new_owner_authorized_correction",
  nextLegalAction: "owner_authorize_one_cpu_only_phase0_design_output_parent_correction_and_fresh_execution_or_exit",
  forbiddenActions: [...FORBIDDEN_ACTIONS],
  evidence: { failureReport: bind(files.failure), ownerActionRequest: bind(files.owner) },
  gpuUsedNow: false,
  checkpointReadOrWrittenNow: false,
  trainingStartedNow: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: shanghai,
})

for (const file of [authorizationPath, consumptionPath, runner, checker, library, recorder, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-phase0-design-failure-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_phase0_design",
  runId: REQUEST_ID,
  kind: "cpu_only_phase0_design",
  status: "failed",
  title: "Four-object visible-structure Phase0 design output registration failed closed",
  titleZh: "四对象可见结构Phase0设计输出注册失败关闭",
  detailZh: "CPU合同已通过，但输出父目录不存在且记录器使用非递归创建，正式设计未生成；未自动重试，未启动GPU或训练。",
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: JSON.parse(fs.readFileSync(files.terminal, "utf8")).status, failureReport: bind(files.failure), terminal: bind(files.terminal), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
