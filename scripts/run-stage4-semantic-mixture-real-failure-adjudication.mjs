import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateStage0RealFailure } from "./lib/ai-painter-stage4-stage0-generalization-causal-adjudication.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const IMPLEMENTATION_SCHEMA = "owner-authorized-stage4-semantic-mixture-real-failure-adjudicator-implementation-v1"
const IMPLEMENTATION_SCOPE = "one_bounded_cpu_readonly_stage0_real_failure_adjudicator_implementation_only"
const IMPLEMENTATION_REQUIRED_ACTIONS = Object.freeze([
  "implement_bounded_current_run_cpu_readonly_failure_adjudicator",
  "bind_current_run_evidence_paths_and_sha256",
  "execute_syntax_and_cpu_positive_negative_contract_regression",
  "write_inactive_execution_contract_implementation_report_owner_request_and_terminal",
  "synchronize_implementation_event_ledger_and_sqlite",
])
const FORMAL_SCHEMA = "owner-authorized-stage4-semantic-mixture-real-failure-cpu-readonly-adjudication-v1"
const FORMAL_SCOPE = "one_cpu_readonly_stage0_real_failure_adjudication_only"
const FORMAL_REQUIRED_ACTIONS = Object.freeze([
  "verify_bound_current_stage0_real_failure_evidence_identity",
  "execute_cpu_positive_negative_contract_regression",
  "execute_one_cpu_readonly_stage0_real_failure_adjudication",
  "write_analysis_decision_candidate_recommendation_owner_request_and_terminal",
  "synchronize_local_task_capsule_event_ledger_and_sqlite",
])
const REQUIRED_DENIALS = Object.freeze([
  "read_or_load_checkpoint_weights",
  "modify_model_trainer_loss_data_condition_pack_or_review_thresholds",
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

const argumentValue = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.ok(resolved.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${value}`)
  return resolved
}
const shaFile = (value) => {
  const hash = crypto.createHash("sha256")
  const descriptor = fs.openSync(value, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let count
    while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, count))
    }
  } finally {
    fs.closeSync(descriptor)
  }
  return hash.digest("hex")
}
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const authorizationArg = argumentValue("--authorization")
const authorizationSha256 = argumentValue("--authorization-sha256")
const consumptionArg = argumentValue("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.match(authorization.runId, /^\d{8}-\d{9}-stage0$/, "authorization_run_id_invalid")
const RUN_ID = authorization.runId

if (process.argv.includes("--implementation-finalize")) {
  finalizeImplementation()
} else if (process.argv.includes("--formal-adjudication")) {
  executeFormalAdjudication()
} else {
  throw new Error("execution_mode_required")
}

function validateSharedAuthorization(expectedSchema, expectedScope, expectedActions) {
  assert.equal(authorization.schemaVersion, expectedSchema)
  assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
  assert.equal(authorization.requestId, authorization.commandRef)
  assert.equal(authorization.scope, expectedScope)
  assert.equal(authorization.runId, RUN_ID)
  assert.equal(same(authorization.allowedActions, expectedActions), true, "allowed_actions_not_exact")
  assert.equal(REQUIRED_DENIALS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
  assert.equal(authorization.sourceEvidence?.failedCheckpointIdentityOnly?.weightsReadAuthorized, false)
  assert.equal(authorization.automaticRetryAuthorized, false)
  assert.equal(authorization.oneTimeConsumptionRequired, true)
  const expectedRunRoot = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${RUN_ID}/`
  for (const name of ["stage0Terminal", "stage0Manifest", "stage0MachineReview", "failedCheckpointIdentityOnly"]) {
    assert.equal(
      authorization.sourceEvidence?.[name]?.path?.replaceAll("\\", "/").startsWith(expectedRunRoot),
      true,
      `${name}_run_path_mismatch`,
    )
  }
  for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
    assert.equal(typeof binding.path, "string", `${name}_path_missing`)
    assert.match(binding.sha256, /^[a-f0-9]{64}$/, `${name}_sha256_invalid`)
    const file = projectFile(binding.path)
    assert.equal(fs.existsSync(file), true, `${name}_missing`)
    assert.equal(shaFile(file), binding.sha256, `${name}_sha256_mismatch`)
  }
}

function runCpuContract() {
  const cpu = spawnSync(process.execPath, [
    path.join(ROOT, "scripts", "check-stage4-stage0-generalization-causal-adjudication.mjs"),
    "--real-failure-contract",
    "--authorization",
    authorizationArg,
    "--authorization-sha256",
    authorizationSha256,
  ], { cwd: ROOT, encoding: "utf8" })
  assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
  const report = JSON.parse(cpu.stdout)
  assert.equal(report.positivePassed, report.positiveTotal)
  assert.equal(report.negativePassed, report.negativeTotal)
  assert.equal(report.executionBoundary.formalAdjudicationExecuted, false)
  return report
}

function codeBindings() {
  return {
    runner: bind(path.join(ROOT, "scripts", "run-stage4-semantic-mixture-real-failure-adjudication.mjs")),
    checker: bind(path.join(ROOT, "scripts", "check-stage4-stage0-generalization-causal-adjudication.mjs")),
    library: bind(path.join(ROOT, "scripts", "lib", "ai-painter-stage4-stage0-generalization-causal-adjudication.mjs")),
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

function finalizeImplementation() {
  validateSharedAuthorization(IMPLEMENTATION_SCHEMA, IMPLEMENTATION_SCOPE, IMPLEMENTATION_REQUIRED_ACTIONS)
  assert.equal(authorization.formalAdjudicationExecutionAuthorized, false)
  assert.equal(fs.existsSync(consumptionPath), true, "implementation_consumption_missing")
  const consumption = readJson(consumptionPath)
  assert.equal(consumption.status, "implementation_authorization_atomically_consumed")
  assert.equal(consumption.authorizationSha256, authorizationSha256)
  assert.equal(consumption.requestId, authorization.requestId)
  assert.equal(consumption.commandRef, authorization.commandRef)
  assert.equal(consumption.scope, authorization.scope)
  const output = projectFile(authorization.outputNamespace)
  assert.equal(fs.existsSync(output), false, "implementation_output_namespace_must_not_exist")
  const cpuReport = runCpuContract()
  fs.mkdirSync(output, { recursive: true })
  const now = new Date().toISOString()
  const files = {
    cpu: path.join(output, "cpu-report.json"),
    report: path.join(output, "implementation-report.json"),
    contract: path.join(output, "inactive-formal-adjudication-contract.json"),
    owner: path.join(output, "owner-action-request.json"),
    terminal: path.join(output, "phase-terminal.json"),
    capsule: path.join(output, "local-task-capsule.json"),
  }
  const codes = codeBindings()
  writeJsonAtomic(files.cpu, {
    ...cpuReport,
    sourceEvidence: authorization.sourceEvidence,
    authorization: bind(authorizationPath),
    consumption: bind(consumptionPath),
    codeBindings: codes,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.report, {
    schemaVersion: "ai-painter-stage4-semantic-mixture-real-failure-adjudicator-implementation-report-v1",
    status: "bounded_real_failure_adjudicator_implemented_cpu_contract_passed",
    runId: RUN_ID,
    sourceEvidence: authorization.sourceEvidence,
    authorization: bind(authorizationPath),
    consumption: bind(consumptionPath),
    cpuReport: bind(files.cpu),
    codeBindings: codes,
    boundaries: {
      formalAdjudicationExecuted: false,
      checkpointWeightsRead: false,
      optimizerCreated: false,
      backwardExecuted: false,
      gpuStarted: false,
      trainingStarted: false,
      stage1Started: false,
      stage2Started: false,
    },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.contract, {
    schemaVersion: "stage4-semantic-mixture-real-failure-formal-adjudication-contract-v1",
    status: "bounded_inactive_not_authorized_for_execution",
    runId: RUN_ID,
    futureAuthorizationSchema: FORMAL_SCHEMA,
    futureScope: FORMAL_SCOPE,
    requiredActions: FORMAL_REQUIRED_ACTIONS,
    requiredDeniedActions: REQUIRED_DENIALS,
    sourceEvidence: authorization.sourceEvidence,
    implementationEvidence: {
      report: bind(files.report),
      cpuReport: bind(files.cpu),
      codeBindings: codes,
    },
    outputNamespaceMustBeNewAndAbsent: true,
    oneTimeConsumptionRequired: true,
    formalAdjudicationExecutionAuthorized: false,
    checkpointWeightsReadAuthorized: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.owner, {
    schemaVersion: "ai-painter-owner-action-request-preview-v1",
    status: "not_authorized_not_consumed",
    requestedAction: "execute_one_cpu_readonly_stage0_real_failure_adjudication",
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
    schemaVersion: "ai-painter-stage4-semantic-mixture-real-failure-adjudicator-implementation-terminal-v1",
    status: "bounded_real_failure_adjudicator_implementation_completed_closed",
    runId: RUN_ID,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    nextLegalAction: "owner_authorize_one_cpu_readonly_stage0_real_failure_adjudication",
    implementationReport: bind(files.report),
    inactiveContract: bind(files.contract),
    ownerActionRequest: bind(files.owner),
    formalAdjudicationExecuted: false,
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
    currentStage: "Stage4 Stage 0 new real failure adjudicator implemented; formal adjudication not authorized",
    candidateTerminal: bind(files.terminal),
    latestBlocker: "formal_stage0_real_failure_adjudication_not_authorized",
    nextLegalAction: "owner_authorize_one_cpu_readonly_stage0_real_failure_adjudication",
    forbiddenActions: REQUIRED_DENIALS,
    evidence: {
      sourceEvidence: authorization.sourceEvidence,
      implementationReport: bind(files.report),
      cpuReport: bind(files.cpu),
      inactiveContract: bind(files.contract),
      ownerActionRequest: bind(files.owner),
    },
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  indexFiles([authorizationPath, consumptionPath, ...Object.values(files)], authorization.requestId)
  appendAiPainterProgramEvent({
    id: `stage4-real-failure-adjudicator-implementation-${authorization.requestId}`,
    timestamp: now,
    action: "stage4_semantic_mixture_real_failure_adjudicator_implementation",
    runId: authorization.requestId,
    kind: "bounded_cpu_contract_implementation",
    status: "success",
    title: "Stage4 real-failure adjudicator implementation completed",
    titleZh: "Stage4 新真实失败裁决入口实施完成",
    detailZh: "当前Run证据绑定与CPU正反合同通过；正式裁决未执行，训练、GPU及Stage 1/2均未启动。",
    evidencePath: relative(files.terminal),
    evidenceSha256: shaFile(files.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  })
  console.log(JSON.stringify({
    status: readJson(files.terminal).status,
    terminal: bind(files.terminal),
    implementationReport: bind(files.report),
    cpuReport: bind(files.cpu),
    inactiveContract: bind(files.contract),
    ownerActionRequest: bind(files.owner),
    capsule: bind(files.capsule),
  }, null, 2))
}

function createFormalConsumption() {
  assert.equal(fs.existsSync(consumptionPath), false, "formal_authorization_already_consumed")
  fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
  const consumedAtUtc = new Date().toISOString()
  const record = {
    schemaVersion: "stage4-semantic-mixture-real-failure-formal-adjudication-consumption-v1",
    status: "cpu_readonly_adjudication_authorization_atomically_consumed",
    requestId: authorization.requestId,
    commandRef: authorization.commandRef,
    scope: authorization.scope,
    authorizationPath: authorizationArg,
    authorizationSha256,
    oneTimeConsumption: true,
    consumedAtUtc,
    consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
  }
  const descriptor = fs.openSync(consumptionPath, "wx")
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    fs.fsyncSync(descriptor)
  } finally {
    fs.closeSync(descriptor)
  }
}

function loadFormalInput() {
  const stage0Terminal = readJson(projectFile(authorization.sourceEvidence.stage0Terminal.path))
  const stage0Manifest = readJson(projectFile(authorization.sourceEvidence.stage0Manifest.path))
  const stage0Review = readJson(projectFile(authorization.sourceEvidence.stage0MachineReview.path))
  const previewBindings = stage0Review.reviews.map((row) => {
    const preview = projectFile(row.previewPath)
    const normalized = projectFile(row.normalizedPath)
    const reproduction = projectFile(row.previewPath.replace("fixed-epoch-previews", "fixed-epoch-preview-reproductions"))
    const previewSha256 = shaFile(preview)
    return {
      epoch: row.epoch,
      previewManifestMatch: previewSha256 === row.previewSha256,
      normalizedManifestMatch: shaFile(normalized) === row.normalizedSha256,
      reproductionByteMatch: previewSha256 === shaFile(reproduction),
    }
  })
  return {
    expectedRunId: RUN_ID,
    sourceEvidence: authorization.sourceEvidence,
    stage0Terminal,
    stage0Manifest,
    stage0Review,
    previewBindings,
  }
}

function executeFormalAdjudication() {
  validateSharedAuthorization(FORMAL_SCHEMA, FORMAL_SCOPE, FORMAL_REQUIRED_ACTIONS)
  assert.equal(authorization.formalAdjudicationExecutionAuthorized, true)
  const output = projectFile(authorization.outputNamespace)
  assert.equal(fs.existsSync(output), false, "formal_output_namespace_must_not_exist")
  createFormalConsumption()
  const cpuReport = runCpuContract()
  const decision = adjudicateStage0RealFailure(loadFormalInput())
  assert.equal(decision.classification, "real_model_visual_failure")
  fs.mkdirSync(output, { recursive: true })
  const now = new Date().toISOString()
  const files = {
    cpu: path.join(output, "cpu-report.json"),
    report: path.join(output, "real-failure-analysis-report.json"),
    decision: path.join(output, "adjudication.json"),
    recommendation: path.join(output, "inactive-next-candidate-recommendation.json"),
    owner: path.join(output, "owner-action-request.json"),
    terminal: path.join(output, "phase-terminal.json"),
    capsule: path.join(output, "local-task-capsule.json"),
  }
  writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.report, { schemaVersion: "ai-painter-stage4-semantic-mixture-real-failure-analysis-report-v1", status: "real_model_visual_failure_confirmed", runId: RUN_ID, decision, sourceEvidence: authorization.sourceEvidence, cpuReport: bind(files.cpu), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.decision, { ...decision, report: bind(files.report), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.recommendation, {
    schemaVersion: "stage4-object-visible-structure-supervision-candidate-recommendation-v1",
    status: "bounded_inactive_owner_decision_required",
    recommendation: "design_one_bounded_object_visible_structure_supervision_contract_or_exit_current_candidate",
    evidenceBasis: bind(files.decision),
    invariants: ["preserve_current_review_thresholds", "use_only_existing_approved_reference_rgb_conditions_worldfacts_and_object_masks", "do_not_use_failed_preview_pixels_as_targets", "do_not_load_failed_checkpoint_weights"],
    freeHyperparametersSelected: false,
    executionAuthorized: false,
    recordedAtUtc: now,
    recordedAtAsiaShanghai: formatShanghai(now),
  })
  writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_authorized_not_consumed", requestedAction: "owner_choose_bounded_object_visible_structure_supervision_design_or_candidate_exit", boundDecision: bind(files.decision), boundRecommendation: bind(files.recommendation), automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.terminal, { schemaVersion: "ai-painter-stage4-semantic-mixture-real-failure-adjudication-terminal-v1", status: "stage0_real_model_visual_failure_adjudicated_closed", runId: RUN_ID, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, classification: decision.classification, nextLegalAction: decision.nextLegalAction, report: bind(files.report), decision: bind(files.decision), recommendation: bind(files.recommendation), ownerActionRequest: bind(files.owner), automaticRetryStarted: false, stage1Started: false, stage2Started: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 Stage 0 real model visual failure formally adjudicated", candidateTerminal: bind(files.terminal), latestBlocker: "four_object_visible_structure_semantics_failed_at_epoch_40", nextLegalAction: decision.nextLegalAction, forbiddenActions: REQUIRED_DENIALS, evidence: { sourceEvidence: authorization.sourceEvidence, cpuReport: bind(files.cpu), report: bind(files.report), decision: bind(files.decision), recommendation: bind(files.recommendation), ownerActionRequest: bind(files.owner) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  indexFiles([authorizationPath, consumptionPath, ...Object.values(files)], authorization.requestId)
  appendAiPainterProgramEvent({ id: `stage4-real-failure-adjudication-${authorization.requestId}`, timestamp: now, action: "stage4_semantic_mixture_real_failure_adjudication", runId: authorization.requestId, kind: "cpu_readonly_adjudication", status: "success", title: "Stage4 real model visual failure adjudicated", titleZh: "Stage4 新真实模型视觉失败已正式裁决", detailZh: "证据绑定与审核合同成立；Epoch 40水体和道路通过，但四类对象可见结构语义仍失败。", evidencePath: relative(files.terminal), evidenceSha256: shaFile(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  console.log(JSON.stringify({ status: readJson(files.terminal).status, terminal: bind(files.terminal), report: bind(files.report), decision: bind(files.decision), recommendation: bind(files.recommendation), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
}
