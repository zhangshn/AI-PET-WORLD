import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateSubstantiveModelStructure } from "./lib/ai-painter-stage4-substantive-model-structure-review.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_stage0_autoencoder_multisample_and_source_evidence",
  "structurally_trace_23_channel_condition_to_final_rgb_path",
  "compare_condition_fusion_capacity_and_shared_output_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_structure_review_authorization",
  "write_structure_report_decision_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "read_or_load_checkpoint_weights", "modify_model", "modify_loss", "modify_data",
  "select_free_hyperparameters", "add_same_type_loss", "start_gpu", "start_smoke",
  "start_stage0", "start_stage1", "start_stage2", "start_training", "rerun_exited_candidate",
  "reuse_failed_checkpoint", "lower_review_thresholds", "use_failed_preview_as_training_target",
  "use_review_result_as_training_target", "implement_architecture_in_this_review",
])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return target
}
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const writeTextAtomic = (target, content) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const descriptor = fs.openSync(temp, "wx")
  try { fs.writeFileSync(descriptor, content, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
  fs.renameSync(temp, target)
}

const authorizationArg = arg("--authorization")
const authorizationSha256 = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-substantive-model-structure-review-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_stage4_substantive_model_structure_review")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(DENIALS.every((entry) => authorization.deniedActions.includes(entry)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(authorization.modelModificationAuthorized, false)
assert.equal(authorization.architectureImplementationAuthorized, false)
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
  assert.equal(/\.pt$/i.test(evidence.path), false, `${name}_checkpoint_evidence_forbidden`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-substantive-model-structure-review.mjs"),
  checker: projectFile("scripts/check-stage4-substantive-model-structure-review.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-substantive-model-structure-review.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
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
  schemaVersion: "stage4-substantive-model-structure-review-consumption-v1",
  status: "cpu_readonly_structure_review_authorization_atomically_consumed",
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
try { fs.writeFileSync(descriptor, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }

const evidence = authorization.sourceEvidence
const currentTerminal = readJson(projectFile(evidence.currentTerminal.path))
const currentDecision = readJson(projectFile(evidence.currentDecision.path))
const autoencoderTerminal = readJson(projectFile(evidence.autoencoderTerminal.path))
const autoencoderDecision = readJson(projectFile(evidence.autoencoderDecision.path))
const multisampleTerminal = readJson(projectFile(evidence.multisampleTerminal.path))
const multisampleGpuReport = readJson(projectFile(evidence.multisampleGpuReport.path))
const multisampleAnalysis = readJson(projectFile(evidence.multisampleAnalysis.path))
const multisampleDecision = readJson(projectFile(evidence.multisampleDecision.path))
const config = readJson(projectFile(evidence.activeConfig.path))
const modelSource = fs.readFileSync(projectFile(evidence.modelSource.path), "utf8")
const trainerSource = fs.readFileSync(projectFile(evidence.trainerSource.path), "utf8")
assert.equal(currentTerminal.status, "stage4_conflict_aware_stage0_residual_semantic_adjudication_succeeded_closed")
assert.equal(currentTerminal.fixedTotalProgress.percent, 60)
assert.equal(autoencoderTerminal.autoencoderStateUnchanged, true)
assert.equal(autoencoderTerminal.denoiserCheckpointRead, false)
assert.equal(multisampleTerminal.trainingStarted, false)
assert.equal(evidence.multisampleGpuReport.role, "capacity_and_exact_representation_collision_evidence")
assert.equal(evidence.multisampleAnalysis.role, "condition_reachability_evidence")
assert.notEqual(evidence.multisampleGpuReport.path, evidence.multisampleAnalysis.path, "multisample_evidence_roles_share_path")
assert.notEqual(evidence.multisampleGpuReport.sha256, evidence.multisampleAnalysis.sha256, "multisample_evidence_roles_share_hash")
assert.equal(multisampleAnalysis.status, "cpu_gpu_readonly_analysis_completed")
assert.match(trainerSource, /composite_denoiser_losses_fact_conditioned_semantic_mixture_stage4/)
assert.match(trainerSource, /stage4ConflictAwareExistingGradientAggregation/)

const decision = adjudicateSubstantiveModelStructure({
  modelSource,
  config,
  currentAdjudication: currentDecision,
  autoencoderDecision,
  multisampleGpuReport,
  multisampleAnalysis,
  multisampleDecision,
  controlledEvidence: {
    conditionFusionOnlyComparison: false,
    denoiserCapacityOnlyComparison: false,
    independentOutputBottleneckComparison: false,
    sharedInitializationAndTrainingSchedule: false,
  },
})
assert.equal(decision.selectedDecision, "D")

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "model-structure-review-report.json"),
  decision: path.join(output, "adjudication.json"),
  owner: path.join(output, "owner-evidence-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, {
  ...cpuReport,
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  sourceEvidence: evidence,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-substantive-model-structure-review-report-v1",
  status: "cpu_readonly_substantive_model_structure_review_completed",
  businessQuestion: "Can existing immutable evidence uniquely attribute the residual Stage 0 failure to condition fusion, Denoiser capacity/output bottleneck, or both?",
  currentArchitecture: decision.structure,
  evidenceChain: {
    original64AndSplitRetained: true,
    autoencoderSemanticRetention: "sufficient_across_64_and_256_sample_class_pairs",
    conditionRepresentation: {
      uniqueInputCount: 56,
      uniqueRepresentationCount: 56,
      uniqueFinalRgbCount: 56,
      exactRepresentationCollisions: 0,
      exactFinalRgbCollisions: 0,
      ownChannelReachability: true,
    },
    conflictAwareStage0: {
      epochs: 40,
      optimizerSteps: 5760,
      residualClasses: ["footprints", "tree", "rock"],
      trainingParadigmExited: true,
    },
  },
  controlledComparisonCoverage: {
    conditionFusionOnly: false,
    denoiserCapacityOnly: false,
    outputBottleneckOnly: false,
    identicalInitializationAndSchedule: false,
  },
  selectedDecision: decision.selectedDecisionId,
  alternatives: decision.alternatives,
  sourceEvidence: evidence,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, { ...decision, reviewReport: bind(files.report), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-controlled-model-structure-discrimination-owner-evidence-request-v1",
  status: "owner_authorization_required",
  selectedDecision: decision.selectedDecisionId,
  problem: "Existing paths prove that conditions reach the output and remain distinguishable, but no controlled run changes only condition fusion or only Denoiser capacity. Selecting a new architecture now would be an unsupported design choice.",
  requestedNextScope: "one_cpu_readonly_bounded_controlled_model_structure_discrimination_design",
  requiredControls: [
    "one_condition_fusion_only_control_contract",
    "one_denoiser_capacity_only_control_contract",
    "same_original_64_and_48_8_4_4_split",
    "same_23_channel_order_and_frozen_autoencoder",
    "same_loss_values_weights_initialization_and_training_schedule",
    "all_dimensions_uniquely_derived_or_fail_closed",
  ],
  prohibitedActions: ["implement_model", "select_free_hyperparameters", "read_checkpoint_weights", "start_gpu", "train", "rerun_exited_stage0", "add_same_type_loss"],
  automaticApproval: false,
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBeforeSha256 = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(
  /^状态：.*$/m,
  "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4冲突感知训练范式已退出，实质模型结构CPU审查确认现有证据尚不能唯一区分条件融合缺陷与Denoiser容量/输出瓶颈，下一业务门为有界受控模型结构判别设计",
)
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4实质模型结构CPU只读审查已完成：当前23通道在level0、level1、middle、up1、up0五个尺度进入主干，每个类型专家还直接读取全部条件及自身通道，未发现条件未接入；56份train/validation条件表示和最终RGB均无精确碰撞，冻结Autoencoder已通过64份、256个样本—类别语义保留审计。当前所有类型贡献最终汇入同一12通道潜变量输出，但没有只改变融合、只改变容量或只改变输出瓶颈且保持训练条件一致的受控证据，因此唯一裁决D：尚不能严谨选择新结构，不生成架构合同。下一步只允许设计有界受控结构判别合同，不得自由调参、实现模型或训练。\n"
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, planText)
writeJsonAtomic(files.planSync, {
  schemaVersion: "stage4-substantive-model-structure-review-plan-sync-v1",
  status: "unique_plan_synchronized",
  planPath: relative(planPath),
  beforeSha256: planBeforeSha256,
  afterSha256: shaFile(planPath),
  selectedDecision: "D",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-substantive-model-structure-review-terminal-v1",
  status: "stage4_substantive_model_structure_review_evidence_insufficient_closed",
  selectedDecision: "D",
  selectedDecisionId: decision.selectedDecisionId,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  architectureContractGenerated: false,
  reviewReport: bind(files.report),
  adjudication: bind(files.decision),
  ownerEvidenceRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  planSync: bind(files.planSync),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  nextLegalAction: "owner_authorization_for_cpu_readonly_bounded_controlled_model_structure_discrimination_design",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 substantive model structure review",
  terminal: bind(files.terminal),
  latestDecision: decision.selectedDecisionId,
  nextLegalAction: "cpu_readonly_bounded_controlled_model_structure_discrimination_design",
  forbiddenActions: DENIALS,
  recordedAtUtc: now,
})
for (const target of Object.values(files)) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_substantive_model_structure_review", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-substantive-model-structure-review-${authorization.runId}`,
  timestamp: now,
  action: "stage4_substantive_model_structure_review",
  runId: authorization.runId,
  kind: "cpu_readonly_structure_review",
  status: "success",
  title: "Stage4 structure cause remains unisolated",
  titleZh: "Stage4模型结构根因尚不能被现有证据唯一定位",
  detailZh: "23通道已在五个尺度及类型专家中进入主干，表示无精确碰撞，Autoencoder语义保留充分；缺少只改融合或只改容量的受控证据，唯一裁决D，不生成新架构。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  selectedDecision: "D",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  structureReviewReport: bind(files.report),
  adjudication: bind(files.decision),
  ownerEvidenceRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
}, null, 2))
