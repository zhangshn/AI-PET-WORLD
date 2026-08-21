import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateReferenceFeatureReplayStage0Failure } from "./lib/ai-painter-stage4-reference-feature-replay-stage0-causal-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const CURRENT_SOURCE_RUN_ID = "20260820-214000000"
const REQUIRED_ACTIONS = Object.freeze([
  "establish_cpu_readonly_stage0_four_object_reference_semantic_adjudication",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_analysis_authorization",
  "write_analysis_decision_inactive_contract_or_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const FORBIDDEN_ACTIONS = Object.freeze([
  "read_or_load_checkpoint_weights", "modify_model", "modify_loss", "select_free_hyperparameters",
  "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds",
  "use_failed_preview_as_training_target", "use_review_result_as_training_target",
  "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion",
  "runtime_frame", "world_entry",
])
const EXPECTED_SOURCES = Object.freeze({
  activeConfig: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${CURRENT_SOURCE_RUN_ID}/active-config.json`,
    sha256: "236551ba3cfcdaca37a1792207eab4980a1f24337a4b6eeb49bbeb37112667a7",
  },
  stage0Terminal: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${CURRENT_SOURCE_RUN_ID}/finalization/phase-terminal.json`,
    sha256: "7e6b7ad00ed0375e235a75016e0cbc21fc489e303a511521a7b8872726e305ab",
  },
  stage0Manifest: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${CURRENT_SOURCE_RUN_ID}/training-output/manifest.json`,
    sha256: "5b6ac81b729f987b1efe4f47c0b27791e1f55b66962df84addab2094f7caf9c2",
  },
  stage0MachineReview: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${CURRENT_SOURCE_RUN_ID}/training-output/fixed-preview-reviews.json`,
    sha256: "74c2e29afaa6744146a594caf40c321302d2d00ee2e77ec0932181f6fb94d111",
  },
  failedCheckpointIdentityOnly: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${CURRENT_SOURCE_RUN_ID}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`,
    sha256: "5996b2f0655740a5e72d860498531e466ab6a530ddc4ca857b545c620a4a2fc2",
    checkpointWeightsRead: false,
  },
})

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const shaFile = (value) => {
  const hash = crypto.createHash("sha256")
  const fd = fs.openSync(value, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let count
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count))
  } finally { fs.closeSync(fd) }
  return hash.digest("hex")
}
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
}
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (target, content) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const fd = fs.openSync(temp, "wx")
  try { fs.writeFileSync(fd, content, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temp, target)
}

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-reference-feature-replay-stage0-causal-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_current_stage0_four_object_reference_semantic_causal_adjudication")
assert.equal(same(authorization.allowedActions, REQUIRED_ACTIONS), true, "allowed_actions_not_exact")
assert.equal(FORBIDDEN_ACTIONS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.sourceRunId, CURRENT_SOURCE_RUN_ID)
assert.equal(same(authorization.sourceEvidence, EXPECTED_SOURCES), true, "source_evidence_not_exact_current_run")

for (const [name, evidence] of Object.entries(EXPECTED_SOURCES)) {
  assert.equal(evidence.path.includes(CURRENT_SOURCE_RUN_ID), true, `${name}_historical_run_rejected`)
  if (name === "failedCheckpointIdentityOnly") {
    assert.equal(fs.existsSync(projectFile(evidence.path)), true, "failed_checkpoint_identity_path_missing")
    continue
  }
  const file = projectFile(evidence.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(shaFile(file), evidence.sha256, `${name}_sha256_mismatch`)
}

const programFiles = {
  runner: projectFile("scripts/run-stage4-reference-feature-replay-stage0-causal-adjudication.mjs"),
  checker: projectFile("scripts/check-stage4-reference-feature-replay-stage0-causal-adjudication.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-reference-feature-replay-stage0-causal-adjudication.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programFiles).map(([name, file]) => [name, bind(file)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "formal_output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-reference-feature-replay-stage0-causal-analysis-consumption-v1",
  status: "cpu_readonly_analysis_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  authorizationPath: authorizationArg,
  authorizationSha256: authorizationSha,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
const consumptionFd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(consumptionFd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(consumptionFd) } finally { fs.closeSync(consumptionFd) }

const cpu = spawnSync(process.execPath, [programFiles.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)

const activeConfigPath = projectFile(EXPECTED_SOURCES.activeConfig.path)
const terminalPath = projectFile(EXPECTED_SOURCES.stage0Terminal.path)
const manifestPath = projectFile(EXPECTED_SOURCES.stage0Manifest.path)
const reviewPath = projectFile(EXPECTED_SOURCES.stage0MachineReview.path)
const decision = adjudicateReferenceFeatureReplayStage0Failure({
  activeConfig: readJson(activeConfigPath),
  terminal: readJson(terminalPath),
  manifest: readJson(manifestPath),
  review: readJson(reviewPath),
  failedCheckpointIdentity: {
    path: EXPECTED_SOURCES.failedCheckpointIdentityOnly.path,
    sha256: EXPECTED_SOURCES.failedCheckpointIdentityOnly.sha256,
  },
  directClassGradientConflictEvidence: false,
})
assert.equal(decision.selectedCause, "A")

fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "causal-analysis-report.json"),
  decision: path.join(output, "adjudication.json"),
  contract: path.join(output, "inactive-repair-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
const sourceEvidence = structuredClone(EXPECTED_SOURCES)
writeJsonAtomic(files.cpu, {
  ...cpuReport,
  sourceRunId: CURRENT_SOURCE_RUN_ID,
  sourceEvidence,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  programLineage: authorization.programLineage,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-reference-feature-replay-stage0-causal-analysis-report-v1",
  status: "reference_feature_replay_active_but_insufficient_for_multisample_visible_semantics",
  businessFinding: "The reference-feature objective and bound worst-sample-class replay were active and improved throughout Stage 0, but all six reviewed previews failed and all four object classes still mismatched the approved reference semantics at Epoch 40.",
  decision,
  sourceEvidence,
  cpuReport: bind(files.cpu),
  checkpointWeightsRead: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, {
  schemaVersion: "stage4-reference-feature-replay-stage0-causal-decision-v1",
  status: decision.status,
  selectedCause: decision.selectedCause,
  alternatives: decision.alternatives,
  nextContractId: decision.nextContractId,
  report: bind(files.report),
  automaticRetryAllowed: false,
  stage1EntryPermitted: false,
  stage2EntryPermitted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-per-class-worst-sample-reference-feature-structure-obligation-contract-v1",
  status: "bounded_inactive_not_authorized_for_implementation_or_execution",
  contractId: decision.nextContractId,
  purpose: "Preserve one worst approved training sample obligation for each object class instead of allowing a single global sample-class maximum to represent all four object classes.",
  legalSources: {
    referenceRgb: "original_owner_approved_reference_rgb",
    conditionPack: "original_compiled_23_channel_condition_pack",
    masks: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
    features: "frozen_project_autoencoder_existing_spatial_stages",
  },
  objective: {
    perSampleClassTensorSource: "stage4_per_class_final_visible_reference_feature_structure_obligation_losses.perSampleClassTensors",
    perClassSelection: "maximum_over_train_samples_within_each_bound_object_class",
    crossClassAggregation: "sum_four_per_class_maxima_using_existing_derived_class_weights",
    rolloutWeight: "reuse_training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation.sourceContract.rolloutWeight",
    checkpointQualification: "same_four_per_class_worst_sample_obligations_on_validation_without_training_target_use",
    additionalOptimizerSteps: 0,
    freeNumericWeightsSelected: false,
  },
  invariants: {
    modelArchitectureChanged: false,
    existingLossWeightsChanged: false,
    datasetOrSplitChanged: false,
    checkpointFormatChanged: false,
    reviewThresholdsChanged: false,
    failedPreviewPixelsUsedAsTargets: false,
    machineReviewResultsUsedAsTargets: false,
  },
  acceptanceRoute: {
    cpu: [
      "four_classes_each_retain_an_independent_worst_train_sample_identity",
      "each_class_obligation_enters_total_loss_and_checkpoint_qualification",
      "finite_nonzero_gradient_inside_bound_class_mask",
      "zero_gradient_outside_bound_class_mask",
      "historical_run_and_checkpoint_rejection",
      "legacy_mode_compatibility",
    ],
    readonlyGpuRequiredBeforeSmoke: true,
    newOwnerAuthorizationRequiredForImplementation: true,
  },
  sourceDecision: bind(files.decision),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: `implement_cpu_inactive_support_for_${decision.nextContractId}`,
  boundDecision: bind(files.decision),
  boundContract: bind(files.contract),
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-reference-feature-replay-stage0-causal-terminal-v1",
  status: "stage0_reference_feature_replay_cause_A_confirmed_closed",
  sourceRunId: CURRENT_SOURCE_RUN_ID,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  selectedCause: "A",
  stage0FailedClosed: true,
  stage1Started: false,
  stage2Started: false,
  nextLegalAction: `owner_authorize_cpu_inactive_support_for_${decision.nextContractId}`,
  report: bind(files.report),
  decision: bind(files.decision),
  inactiveContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  automaticRetryStarted: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 Stage 0 reference-feature replay visual generalization failure causally adjudicated",
  latestTerminal: bind(files.terminal),
  latestBlocker: "per_class_reference_feature_obligations_improve_but_four_object_visible_semantics_remain_failed",
  nextLegalAction: `owner_authorize_cpu_inactive_support_for_${decision.nextContractId}`,
  forbiddenActions: FORBIDDEN_ACTIONS,
  evidence: {
    ...sourceEvidence,
    cpuReport: bind(files.cpu),
    report: bind(files.report),
    decision: bind(files.decision),
    inactiveContract: bind(files.contract),
    ownerActionRequest: bind(files.owner),
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
const bulletAnchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(bulletAnchor), true, "plan_status_anchor_missing")
const newBullet = `- 本次最新Stage 0的独立CPU只读因果裁决已经完成：逐类参考特征结构义务与epoch最差样本—类别专项回放均在正式训练中激活，六个审核点的训练、验证、回放和Checkpoint指标持续改善，但四类对象参考语义始终未通过；唯一裁决为A，即现有回放已生效但仍不足以约束多样本最终可见语义。已形成未激活的逐类别最差样本参考特征结构义务合同；不得重跑相同Stage 0，下一步只能在独立Owner授权下建设该CPU未激活支持。\n`
assert.equal(plan.includes(newBullet.trim()), false, "plan_already_contains_current_adjudication")
plan = plan.replace(bulletAnchor, `${newBullet}\n${bulletAnchor}`)
const routeOld = "-> 下一步只能先对本次Stage 0的四类对象泛化失败做独立CPU只读因果裁决，形成唯一有界修复合同或Owner项目级选择；不得重跑相同Stage 0"
const routeNew = "-> 本次Stage 0四类对象泛化失败的独立CPU只读因果裁决（已完成；唯一裁决A：参考特征回放已激活但不足以约束多样本最终可见语义）\n-> 下一步仅可独立授权建设stage4_per_class_worst_sample_reference_feature_structure_obligation_v1的CPU未激活支持；不得重跑相同Stage 0"
assert.equal(plan.includes(routeOld), true, "plan_route_anchor_missing")
plan = plan.replace(routeOld, routeNew)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, {
  schemaVersion: "ai-painter-plan-sync-record-v1",
  status: "unique_plan_synchronized",
  plan: bind(planPath),
  terminal: bind(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId: authorization.runId,
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: shaFile(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-reference-feature-replay-stage0-causal-${authorization.runId}`,
  timestamp: now,
  action: "stage4_reference_feature_replay_stage0_causal_adjudication",
  runId: authorization.runId,
  kind: "cpu_readonly_adjudication",
  status: "success",
  title: "Stage4 Stage 0 reference-feature replay cause A confirmed",
  titleZh: "Stage4 Stage 0参考特征回放失败已裁决为现有目标约束不足",
  detailZh: "参考特征义务和最差样本—类别回放均已激活并持续改善，但六个审核点全部失败且Epoch 40四类对象参考语义仍不一致；唯一裁决为A。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  selectedCause: decision.selectedCause,
  terminal: bind(files.terminal),
  report: bind(files.report),
  decision: bind(files.decision),
  inactiveContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
}, null, 2))
