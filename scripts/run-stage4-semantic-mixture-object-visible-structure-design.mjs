import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { buildBoundedObjectVisibleStructureDesign } from "./lib/ai-painter-stage4-object-visible-structure-design.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const IMPLEMENTATION_SCHEMA = "owner-authorized-stage4-object-visible-structure-design-entry-implementation-v1"
const IMPLEMENTATION_SCOPE = "one_bounded_cpu_readonly_object_visible_structure_supervision_design_entry_implementation_only"
const IMPLEMENTATION_ACTIONS = Object.freeze([
  "implement_current_run_object_visible_structure_supervision_design_entry",
  "modify_only_bounded_design_runner_shared_library_and_checker",
  "bind_formal_adjudication_evidence_paths_and_sha256",
  "execute_node_syntax_and_cpu_positive_negative_contract_regressions",
  "write_inactive_design_execution_contract",
  "write_implementation_report_terminal_capsule_and_next_owner_request",
  "synchronize_implementation_event_ledger_and_sqlite",
])
const FORMAL_SCHEMA = "owner-authorized-stage4-semantic-mixture-object-visible-structure-supervision-design-v1"
const FORMAL_SCOPE = "one_cpu_readonly_object_visible_structure_supervision_design_only"
const FORMAL_ACTIONS = Object.freeze([
  "verify_bound_real_failure_adjudication_and_design_entry_evidence",
  "execute_cpu_positive_negative_design_contract_regression",
  "execute_one_cpu_readonly_object_visible_structure_supervision_design",
  "write_design_inactive_implementation_contract_owner_request_terminal_and_capsule",
  "synchronize_design_event_ledger_and_sqlite",
])
const REQUIRED_DENIALS = Object.freeze([
  "read_or_load_failed_checkpoint_weights",
  "modify_model_trainer_loss_dataset_condition_pack_or_review_thresholds",
  "select_free_hyperparameters",
  "create_optimizer",
  "execute_backward",
  "start_gpu",
  "start_training",
  "start_validation",
  "start_new_smoke",
  "automatic_retry_stage0",
  "start_stage1",
  "start_stage2",
  "checkpoint_promotion",
  "formal_inference",
  "runtime_frame",
  "world_entry",
])

const argument = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const readJsonFile = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const authorizationArg = argument("--authorization")
const authorizationSha256 = argument("--authorization-sha256")
const consumptionArg = argument("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = readJsonFile(authorizationPath)
assert.match(authorization.runId, /^\d{8}-\d{9}-stage0$/, "authorization_run_id_invalid")
const RUN_ID = authorization.runId

if (process.argv.includes("--implementation-finalize")) finalizeImplementation()
else if (process.argv.includes("--formal-design")) executeFormalDesign()
else throw new Error("execution_mode_required")

function validateBindings() {
  for (const [name, binding] of Object.entries(authorization.sourceEvidence ?? {})) {
    assert.equal(typeof binding.path, "string", `${name}_path_missing`)
    assert.match(binding.sha256, /^[a-f0-9]{64}$/, `${name}_sha256_invalid`)
    const file = projectFile(binding.path)
    assert.equal(fs.existsSync(file), true, `${name}_missing`)
    assert.equal(shaFile(file), binding.sha256, `${name}_binding_changed`)
  }
}

function validateAuthorization(schema, scope, actions) {
  assert.equal(authorization.schemaVersion, schema)
  assert.ok(["resolved_owner_authorized_not_consumed", "resolved_owner_authorized"].includes(authorization.status))
  assert.equal(authorization.requestId, authorization.commandRef)
  assert.equal(authorization.scope, scope)
  assert.equal(authorization.runId, RUN_ID)
  assert.equal(same(authorization.allowedActions, actions), true, "allowed_actions_not_exact")
  assert.equal(REQUIRED_DENIALS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
  assert.equal(authorization.trainingAuthorized, false)
  assert.equal(authorization.gpuAuthorized, false)
  assert.equal(authorization.oneTimeConsumptionRequired, true)
  validateBindings()
}

function runCpuContract() {
  const child = spawnSync(process.execPath, [
    path.join(ROOT, "scripts", "check-stage4-object-visible-structure-design.mjs"),
    "--implementation-contract",
    "--authorization", authorizationArg,
    "--authorization-sha256", authorizationSha256,
  ], { cwd: ROOT, encoding: "utf8" })
  assert.equal(child.status, 0, `cpu_contract_failed:${child.stderr}`)
  const report = JSON.parse(child.stdout)
  assert.equal(report.positivePassed, report.positiveTotal)
  assert.equal(report.negativePassed, report.negativeTotal)
  assert.equal(report.executionBoundary.formalDesignExecuted, false)
  return report
}

function codeBindings() {
  return {
    runner: bind(path.join(ROOT, "scripts", "run-stage4-semantic-mixture-object-visible-structure-design.mjs")),
    checker: bind(path.join(ROOT, "scripts", "check-stage4-object-visible-structure-design.mjs")),
    library: bind(path.join(ROOT, "scripts", "lib", "ai-painter-stage4-object-visible-structure-design.mjs")),
  }
}

function indexFiles(files, runId) {
  for (const file of files) {
    const stat = fs.statSync(file)
    indexArtifact({
      logicalPath: logicalProjectPath(file),
      physicalUri: fs.realpathSync(file),
      storageLayer: "hot",
      runId,
      byteSize: stat.size,
      modifiedAtUtc: stat.mtime.toISOString(),
      sha256: shaFile(file),
    })
  }
}

function implementationConsumptionValid() {
  assert.equal(fs.existsSync(consumptionPath), true, "implementation_consumption_missing")
  const record = readJsonFile(consumptionPath)
  assert.equal(record.status, "cpu_readonly_design_entry_implementation_authorization_atomically_consumed")
  assert.equal(record.authorizationSha256, authorizationSha256)
  assert.equal(record.requestId, authorization.requestId)
  assert.equal(record.commandRef, authorization.commandRef)
  assert.equal(record.scope, authorization.scope)
  assert.equal(record.formalDesignExecutionAuthorized, false)
  assert.equal(record.checkpointWeightsRead, false)
  assert.equal(record.gpuUsed, false)
  assert.equal(record.trainingStarted, false)
}

function finalizeImplementation() {
  validateAuthorization(IMPLEMENTATION_SCHEMA, IMPLEMENTATION_SCOPE, IMPLEMENTATION_ACTIONS)
  assert.equal(authorization.formalDesignExecutionAuthorized, false)
  implementationConsumptionValid()
  const output = projectFile(authorization.outputNamespace)
  assert.equal(fs.existsSync(output), false, "implementation_output_namespace_must_not_exist")
  const cpuReport = runCpuContract()
  fs.mkdirSync(output, { recursive: true })
  const now = new Date().toISOString()
  const files = {
    cpu: path.join(output, "cpu-report.json"),
    report: path.join(output, "implementation-report.json"),
    contract: path.join(output, "inactive-formal-design-contract.json"),
    owner: path.join(output, "owner-action-request.json"),
    terminal: path.join(output, "phase-terminal.json"),
    capsule: path.join(output, "local-task-capsule.json"),
  }
  const codes = codeBindings()
  writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.report, {
    schemaVersion: "stage4-object-visible-structure-design-entry-implementation-report-v1",
    status: "bounded_cpu_readonly_design_entry_implemented",
    runId: RUN_ID,
    authorization: bind(authorizationPath),
    consumption: bind(consumptionPath),
    sourceEvidence: authorization.sourceEvidence,
    codeBindings: codes,
    cpuRegression: bind(files.cpu),
    implementationBoundary: {
      formalDesignExecuted: false,
      checkpointWeightsRead: false,
      modelOrTrainerModified: false,
      optimizerCreated: false,
      backwardExecuted: false,
      gpuUsed: false,
      trainingStarted: false,
    },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.contract, {
    schemaVersion: "stage4-object-visible-structure-formal-design-inactive-contract-v1",
    status: "inactive_owner_authorization_required",
    runId: RUN_ID,
    requiredAuthorizationSchema: FORMAL_SCHEMA,
    requiredScope: FORMAL_SCOPE,
    requiredAllowedActions: FORMAL_ACTIONS,
    requiredDeniedActions: REQUIRED_DENIALS,
    sourceEvidence: authorization.sourceEvidence,
    implementationEvidence: { report: bind(files.report), cpuReport: bind(files.cpu), codeBindings: codes },
    outputNamespaceMustBeNewAndAbsent: true,
    oneTimeConsumptionRequired: true,
    formalDesignExecutionAuthorized: false,
    checkpointWeightsReadAuthorized: false,
    gpuAuthorized: false,
    trainingAuthorized: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.owner, {
    schemaVersion: "ai-painter-owner-action-request-preview-v1",
    status: "not_authorized_not_consumed",
    requestedAction: "execute_one_cpu_readonly_object_visible_structure_supervision_design",
    requiredAuthorizationSchema: FORMAL_SCHEMA,
    requiredScope: FORMAL_SCOPE,
    boundImplementationReport: bind(files.report),
    boundInactiveContract: bind(files.contract),
    sourceEvidence: authorization.sourceEvidence,
    automaticApproval: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-object-visible-structure-design-entry-implementation-terminal-v1",
    status: "bounded_object_visible_structure_design_entry_implementation_completed_closed",
    runId: RUN_ID,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: "owner_authorize_one_cpu_readonly_object_visible_structure_supervision_design",
    implementationReport: bind(files.report),
    inactiveContract: bind(files.contract),
    ownerActionRequest: bind(files.owner),
    formalDesignExecuted: false,
    automaticRetryStarted: false,
    stage1Started: false,
    stage2Started: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    module: "AI Painter R5",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    currentStage: "Stage4 Stage 0 object-visible-structure design entry implemented; formal design not authorized",
    candidateTerminal: bind(files.terminal),
    latestBlocker: "formal_object_visible_structure_supervision_design_not_authorized",
    nextLegalAction: "owner_authorize_one_cpu_readonly_object_visible_structure_supervision_design",
    forbiddenActions: REQUIRED_DENIALS,
    evidence: { sourceEvidence: authorization.sourceEvidence, implementationReport: bind(files.report), cpuReport: bind(files.cpu), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner) },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  indexFiles([authorizationPath, consumptionPath, ...Object.values(files)], authorization.requestId)
  appendAiPainterProgramEvent({
    id: `stage4-object-visible-structure-design-entry-${authorization.requestId}`,
    timestamp: now,
    action: "stage4_object_visible_structure_design_entry_implementation",
    runId: authorization.requestId,
    kind: "bounded_cpu_contract_implementation",
    status: "success",
    title: "Stage4 object-visible-structure design entry implemented",
    titleZh: "Stage4 对象可见结构监督设计入口实施完成",
    detailZh: "仅完成 CPU 设计入口与正反合同回归；正式设计、训练、GPU、Checkpoint 权重读取及 Stage 1/2 均未执行。",
    evidencePath: relative(files.terminal),
    evidenceSha256: shaFile(files.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  console.log(JSON.stringify({ status: readJsonFile(files.terminal).status, terminal: bind(files.terminal), implementationReport: bind(files.report), cpuReport: bind(files.cpu), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
}

function createFormalConsumption() {
  assert.equal(fs.existsSync(consumptionPath), false, "formal_authorization_already_consumed")
  fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
  const now = new Date().toISOString()
  const record = {
    schemaVersion: "stage4-object-visible-structure-formal-design-consumption-v1",
    status: "cpu_readonly_formal_design_authorization_atomically_consumed",
    requestId: authorization.requestId,
    commandRef: authorization.commandRef,
    scope: authorization.scope,
    authorizationPath: authorizationArg,
    authorizationSha256,
    checkpointWeightsRead: false,
    gpuUsed: false,
    trainingStarted: false,
    consumedAtUtc: now,
    consumedAtAsiaShanghai: formatShanghai(now),
  }
  const descriptor = fs.openSync(consumptionPath, "wx")
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    fs.fsyncSync(descriptor)
  } finally {
    fs.closeSync(descriptor)
  }
}

function loadSource() {
  return {
    terminal: readJsonFile(projectFile(authorization.sourceEvidence.formalAdjudicationTerminal.path)),
    report: readJsonFile(projectFile(authorization.sourceEvidence.formalAnalysisReport.path)),
    decision: readJsonFile(projectFile(authorization.sourceEvidence.formalDecision.path)),
    recommendation: readJsonFile(projectFile(authorization.sourceEvidence.inactiveRecommendation.path)),
    capsule: readJsonFile(projectFile(authorization.sourceEvidence.formalCapsule.path)),
    failedStage0ActiveConfig: readJsonFile(projectFile(authorization.sourceEvidence.failedStage0ActiveConfig.path)),
    failedPriorDesign: readJsonFile(projectFile(authorization.sourceEvidence.failedPriorDesign.path)),
  }
}

function executeFormalDesign() {
  validateAuthorization(FORMAL_SCHEMA, FORMAL_SCOPE, FORMAL_ACTIONS)
  assert.equal(authorization.formalDesignExecutionAuthorized, true)
  const output = projectFile(authorization.outputNamespace)
  assert.equal(fs.existsSync(output), false, "formal_design_output_namespace_must_not_exist")
  createFormalConsumption()
  const cpuReport = runCpuContract()
  const design = buildBoundedObjectVisibleStructureDesign(loadSource(), RUN_ID)
  fs.mkdirSync(output, { recursive: true })
  const now = new Date().toISOString()
  const files = {
    cpu: path.join(output, "cpu-report.json"),
    design: path.join(output, "object-reference-multiscale-luminance-structure-supervision-design.json"),
    contract: path.join(output, "inactive-candidate-implementation-contract.json"),
    owner: path.join(output, "owner-action-request.json"),
    terminal: path.join(output, "phase-terminal.json"),
    capsule: path.join(output, "local-task-capsule.json"),
  }
  writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.design, { ...design, authorization: bind(authorizationPath), consumption: bind(consumptionPath), sourceEvidence: authorization.sourceEvidence, cpuReport: bind(files.cpu), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.contract, {
    schemaVersion: "stage4-object-visible-structure-candidate-implementation-inactive-contract-v1",
    status: "inactive_owner_decision_and_separate_implementation_authorization_required",
    design: bind(files.design),
    permittedFutureScope: "bounded_cpu_implementation_and_contract_regression_only",
    trainingAuthorized: false,
    gpuAuthorized: false,
    checkpointWeightsReadAuthorized: false,
    automaticApproval: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.owner, {
    schemaVersion: "ai-painter-owner-action-request-preview-v1",
    status: "not_authorized_not_consumed",
    requestedAction: "owner_review_object_visible_structure_supervision_design_and_choose_implementation_or_candidate_exit",
    boundDesign: bind(files.design),
    boundInactiveImplementationContract: bind(files.contract),
    trainingOrGpuRequested: false,
    automaticApproval: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.terminal, {
    schemaVersion: "stage4-object-visible-structure-supervision-design-terminal-v1",
    status: "bounded_object_visible_structure_supervision_design_completed_closed",
    runId: RUN_ID,
    fixedTotalProgress: design.fixedTotalProgress,
    nextLegalAction: design.nextLegalAction,
    design: bind(files.design),
    inactiveImplementationContract: bind(files.contract),
    ownerActionRequest: bind(files.owner),
    implementationExecuted: false,
    trainingStarted: false,
    gpuUsed: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    module: "AI Painter R5",
    fixedTotalProgress: design.fixedTotalProgress,
    currentStage: "Stage4 Stage 0 object-visible-structure supervision design completed inactive",
    candidateTerminal: bind(files.terminal),
    latestBlocker: "owner_review_of_inactive_object_visible_structure_supervision_design_required",
    nextLegalAction: design.nextLegalAction,
    forbiddenActions: REQUIRED_DENIALS,
    evidence: { sourceEvidence: authorization.sourceEvidence, cpuReport: bind(files.cpu), design: bind(files.design), inactiveImplementationContract: bind(files.contract), ownerActionRequest: bind(files.owner) },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  indexFiles([authorizationPath, consumptionPath, ...Object.values(files)], authorization.requestId)
  appendAiPainterProgramEvent({
    id: `stage4-object-visible-structure-design-${authorization.requestId}`,
    timestamp: now,
    action: "stage4_object_visible_structure_supervision_design",
    runId: authorization.requestId,
    kind: "cpu_readonly_design",
    status: "success",
    title: "Stage4 object-visible-structure supervision design completed",
    titleZh: "Stage4 对象可见结构监督设计完成",
    detailZh: "仅形成未激活设计与 Owner 请求；未实施模型或训练器修改，未启动训练、GPU 或 Stage 1/2。",
    evidencePath: relative(files.terminal),
    evidenceSha256: shaFile(files.terminal),
    fixedTotalProgress: design.fixedTotalProgress,
  })
  console.log(JSON.stringify({ status: readJsonFile(files.terminal).status, terminal: bind(files.terminal), design: bind(files.design), inactiveImplementationContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
}
