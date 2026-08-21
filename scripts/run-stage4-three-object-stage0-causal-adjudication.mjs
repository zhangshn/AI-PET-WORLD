import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateThreeObjectStage0Failure, SOURCE_RUN_ID } from "./lib/ai-painter-stage4-three-object-stage0-causal-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUIRED_ACTIONS = Object.freeze([
  "verify_current_stage0_three_object_failure_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_adjudication_authorization",
  "write_analysis_decision_inactive_contract_or_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const REQUIRED_DENIALS = Object.freeze([
  "read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss",
  "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0",
  "lower_review_thresholds", "use_failed_preview_as_training_target",
  "use_review_result_as_training_target", "reuse_historical_stage0", "reuse_old_run_id",
  "reuse_old_authorization", "reuse_old_checkpoint", "start_stage1", "start_stage2",
  "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry",
])

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
}
const shaFile = (value) => {
  const hash = crypto.createHash("sha256")
  const fd = fs.openSync(value, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try { let count; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count)) }
  finally { fs.closeSync(fd) }
  return hash.digest("hex")
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
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-three-object-stage0-causal-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.sourceRunId, SOURCE_RUN_ID)
assert.equal(authorization.scope, "one_cpu_readonly_current_stage0_footprints_tree_rock_reference_semantic_causal_adjudication")
assert.equal(same(authorization.allowedActions, REQUIRED_ACTIONS), true, "allowed_actions_not_exact")
assert.equal(REQUIRED_DENIALS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(authorization.oneTimeConsumption, true)

const expectedRoot = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/`
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  assert.equal(evidence.path.replaceAll("\\", "/").startsWith(expectedRoot), true, `${name}_historical_run_rejected`)
  const file = projectFile(evidence.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") assert.equal(shaFile(file), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-three-object-stage0-causal-adjudication.mjs"),
  checker: projectFile("scripts/check-stage4-three-object-stage0-causal-adjudication.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-three-object-stage0-causal-adjudication.mjs"),
  inspectedTrainer: projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, file]) => [name, bind(file)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-three-object-stage0-causal-adjudication-consumption-v1",
  status: "cpu_readonly_adjudication_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: authorizationArg,
  authorizationSha256: authorizationSha,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
const consumptionFd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(consumptionFd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(consumptionFd) }
finally { fs.closeSync(consumptionFd) }

const activeConfig = readJson(projectFile(authorization.sourceEvidence.activeConfig.path))
const manifest = readJson(projectFile(authorization.sourceEvidence.stage0Manifest.path))
const trainerText = fs.readFileSync(programs.inspectedTrainer, "utf8")
const loopIndex = trainerText.indexOf("for batch_index, batch in enumerate(loader):")
const selectorIndex = trainerText.indexOf("stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_from_tensor(", loopIndex)
const nextEpochBoundary = trainerText.indexOf("def ", selectorIndex)
const metricKeys = new Set(Object.keys(manifest.metrics?.[0] ?? {}))
const implementationInspection = {
  trainingBatchSize: Number(activeConfig.training?.batchSize),
  selectionContractPopulation: activeConfig.training?.stage4PerClassWorstSampleFinalVisibleLuminanceStructureObligation?.selection?.trainingPopulation,
  selectionInvokedInsidePrimaryBatchLoop: loopIndex >= 0 && selectorIndex > loopIndex && (nextEpochBoundary < 0 || selectorIndex < nextEpochBoundary),
  selectionReceivesOnlyCurrentBatchSampleIds: trainerText.slice(selectorIndex, selectorIndex + 700).includes('batch["sampleId"]'),
  epochWideTrainingSelectionAccumulatorPresent: trainerText.includes("stage4PerClassWorstSampleFinalVisibleLuminanceEpochAccumulator"),
  validationPerClassMaximumPresent: trainerText.includes("max(worst_sample_class_luminance_per_class_values[identity])"),
  validationSelectionIdentityPersisted: [...metricKeys].some((key) => /PerClassWorstSample.*(SampleId|SeedIndex|SelectionIdentity)/.test(key))
    || JSON.stringify(manifest).includes("perClassWorstSampleFinalVisibleLuminanceSelections"),
  trainer: bind(programs.inspectedTrainer),
}
const decision = adjudicateThreeObjectStage0Failure({
  activeConfig,
  terminal: readJson(projectFile(authorization.sourceEvidence.stage0Terminal.path)),
  manifest,
  review: readJson(projectFile(authorization.sourceEvidence.stage0MachineReview.path)),
  failedCheckpointIdentity: {
    path: authorization.sourceEvidence.failedCheckpointIdentityOnly.path,
    sha256: authorization.sourceEvidence.failedCheckpointIdentityOnly.sha256,
  },
  implementationInspection,
  directClassGradientConflictEvidence: false,
})
assert.equal(decision.selectedCause, "B")

fs.mkdirSync(path.dirname(output), { recursive: true })
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
const sourceEvidence = authorization.sourceEvidence
writeJsonAtomic(files.cpu, { ...cpuReport, sourceRunId: SOURCE_RUN_ID, sourceEvidence, implementationInspection, authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-three-object-stage0-causal-analysis-report-v1",
  status: "per_class_worst_sample_selection_loss_and_checkpoint_identity_defect_confirmed",
  businessFinding: "The Stage 0 engineering chain completed, and road, water and vegetation pass at Epoch 40. Footprints, tree and rock still respond locally but do not match the approved reference semantics.",
  causalFinding: "The current Loss contract claims one worst train sample per class over all 48 records. With batchSize=1, the selector is called inside each primary batch and receives only that sampleId, so it cannot implement the claimed population-wide selector. Validation computes per-class maxima but does not persist the selected sample/seed/class identities.",
  decision,
  sourceEvidence,
  cpuReport: bind(files.cpu),
  checkpointWeightsRead: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, { schemaVersion: "stage4-three-object-stage0-causal-decision-v1", status: decision.status, selectedCause: "B", alternatives: decision.alternatives, evidence: decision.evidence, report: bind(files.report), boundedRepairContractGenerated: true, stage1EntryPermitted: false, stage2EntryPermitted: false, automaticRetryAllowed: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-epoch-complete-per-class-worst-sample-final-visible-luminance-selection-and-checkpoint-identity-contract-v1",
  status: "bounded_inactive_not_authorized_for_execution",
  contractId: decision.nextContractId,
  purpose: "Make the existing formally claimed per-class worst-sample luminance obligation match the complete train and validation populations without adding a model, free weight, threshold or dataset.",
  invariants: {
    modelArchitectureChanged: false,
    existingLossWeightsChanged: false,
    datasetOrSplitChanged: false,
    batchSizeChanged: false,
    optimizerStepBudgetChanged: false,
    checkpointFormatChanged: false,
    machineReviewThresholdsChanged: false,
  },
  trainingSelection: {
    population: "all_48_train_split_records_in_one_completed_epoch",
    classes: ["footprints", "tree", "rock", "vegetation"],
    sourceTensor: "existing_weighted_per_sample_class_final_visible_luminance_structure_tensor",
    scoreCollection: "detach_score_and_identity_only_during_current_epoch",
    selection: "one_maximum_per_class_with_lexicographic_sample_id_tie_break",
    differentiableApplication: "recompute_selected_sample_class_from_the_same_approved_reference_rgb_condition_pack_mask_and_existing_50_step_rollout_in_the_existing_epoch_replay_budget",
    classSchedule: "derive_from_existing_formal_class_order_and_existing_two_replay_passes_without_new_numeric_choice",
    firstEpochBehavior: "collect_current_epoch_identity_only_and_use_existing_non_replay_supervision_until_a_complete_prior_epoch_exists",
    replacesIneffectiveBatchLocalMaximum: true,
    additionalLossWeight: false,
    additionalOptimizerSteps: 0,
  },
  checkpointQualification: {
    population: "all_8_validation_records_all_existing_rollout_seeds",
    selection: "one_maximum_per_class_with_sample_id_then_seed_index_tie_break",
    requiredPersistedFields: ["classIdentity", "sampleId", "seedIndex", "rawScore", "weightedScore"],
    exactAggregation: "sum_four_existing_derived_weighted_class_maxima_times_existing_rollout_weight",
    mustEqualReportedCheckpointObligation: true,
    entersExistingValidationCheckpointSelectionScore: true,
  },
  legalSources: ["original_owner_approved_reference_rgb", "original_object_semantic_masks", "formal_23_channel_condition_pack", "existing_50_step_final_decoded_rgb"],
  forbiddenSources: ["failed_preview_pixels", "machine_review_thresholds", "machine_review_results", "failed_checkpoint_weights"],
  freeHyperparametersSelected: false,
  executionAuthorized: false,
  boundDecision: bind(files.decision),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-v1", status: "not_authorized_not_consumed", requestedAction: "implement_cpu_inactive_support_for_stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1", businessReason: "The current active implementation does not execute or persist the population-wide selector identity promised by its formal contract.", boundDecision: bind(files.decision), boundInactiveContract: bind(files.contract), automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-three-object-stage0-causal-terminal-v1", status: "stage0_three_object_per_class_selection_identity_defect_adjudicated_closed", sourceRunId: SOURCE_RUN_ID, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, selectedCause: "B", stage0FailedClosed: true, stage1Started: false, stage2Started: false, nextLegalAction: "owner_authorize_cpu_inactive_support_for_stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1", report: bind(files.report), decision: bind(files.decision), inactiveRepairContract: bind(files.contract), ownerActionRequest: bind(files.owner), automaticRetryStarted: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 Stage 0 footprints/tree/rock reference semantic failure causally adjudicated", latestTerminal: bind(files.terminal), latestBlocker: "per_class_worst_sample_training_and_checkpoint_selection_identity_contract_not_realized", nextLegalAction: "owner_authorize_cpu_inactive_support_for_stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1", forbiddenActions: REQUIRED_DENIALS, evidence: { sourceEvidence, cpuReport: bind(files.cpu), report: bind(files.report), decision: bind(files.decision), inactiveRepairContract: bind(files.contract), ownerActionRequest: bind(files.owner) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；当前逐类别最差样本最终可见亮度结构候选的全新Stage 0已完成40 Epoch和5760次优化，Epoch 40道路、水体和vegetation通过，仅footprints、tree、rock参考语义不一致。独立CPU只读裁决已确认唯一原因B：正式合同要求在48条train内逐类选择最差样本，但batchSize=1的实现只在当前batch内选择；validation虽计算逐类最大值但未保存被选sample/seed/class身份。当前仅可建设有界CPU未激活接线修复，Stage 1/2未启动")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = "- 当前Stage 0 footprints、tree、rock最终参考语义泛化失败的独立CPU只读裁决已经完成：三类逐类最差亮度结构与参考特征目标均激活并下降，但正式合同声明的48条train逐类最差选择在batchSize=1下实际只看当前单样本；validation只保存逐类最大数值，没有保存被选sampleId、seedIndex和class身份。唯一裁决为B，已形成未激活的epoch完整逐类最差选择与Checkpoint身份合同；不得复用失败Checkpoint、自动重跑或进入Stage 1。\n"
assert.equal(plan.includes(bullet.trim()), false, "plan_already_contains_adjudication")
plan = plan.replace(anchor, `${bullet}\n${anchor}`)
plan = plan.replace(
  "4. `stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1`已完成CPU支持、独立只读GPU资格、全新30 Epoch Smoke、独立后期稳定资格及全新Stage 0；Stage 0工程证据完整但机器审核0/6通过，Epoch 40仍有footprints、tree、rock参考语义不一致，因此真实视觉失败关闭，Stage 1/2未启动；",
  "4. `stage4_per_class_worst_sample_final_visible_luminance_structure_obligation_v1`已完成CPU支持、独立只读GPU资格、全新30 Epoch Smoke、独立后期稳定资格及全新Stage 0；Stage 0工程证据完整但机器审核0/6通过，Epoch 40仍有footprints、tree、rock参考语义不一致。独立CPU裁决已确认训练端48条逐类最差选择退化为batchSize=1的当前样本选择，且validation选择身份未落盘；当前仅可建设有界CPU未激活接线修复，Stage 1/2未启动；",
)
const oldRoute = "-> 当前下一步：仅可对本次Stage 0执行独立CPU只读视觉泛化因果裁决；不得复用失败Checkpoint、自动重跑或进入Stage 1"
const newRoute = "-> CPU只读footprints/tree/rock最终参考语义泛化因果裁决（已完成；唯一裁决B：48条train逐类最差选择实际退化为batchSize=1当前样本选择，validation选择身份未落盘）\n-> 当前下一步：仅可建设stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1的CPU未激活支持与正反回归；不得复用失败Checkpoint、自动重跑或进入Stage 1"
assert.equal(plan.includes(oldRoute), true, "plan_route_anchor_missing")
plan = plan.replace(oldRoute, newRoute)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(file) })
}
appendAiPainterProgramEvent({ id: `stage4-three-object-stage0-adjudication-${authorization.runId}`, timestamp: now, action: "stage4_three_object_stage0_reference_semantic_causal_adjudication", runId: authorization.runId, kind: "cpu_readonly_adjudication", status: "success", title: "Stage4 Stage 0 three-object selector identity defect confirmed", titleZh: "Stage4 Stage 0三类对象失败已裁决为逐类最差选择接线与身份缺陷", detailZh: "合同要求48条train内逐类选择最差样本，但batchSize=1实现只在当前batch内选择；validation虽计算逐类最大值，却未保存被选sample/seed/class身份。", evidencePath: relative(files.terminal), evidenceSha256: shaFile(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })

console.log(JSON.stringify({ status: readJson(files.terminal).status, selectedCause: "B", terminal: bind(files.terminal), report: bind(files.report), decision: bind(files.decision), inactiveRepairContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
