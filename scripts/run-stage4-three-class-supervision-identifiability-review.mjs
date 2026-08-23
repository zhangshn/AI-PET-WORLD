import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { TARGET_CLASSES, reviewThreeClassSupervisionIdentifiability } from "./lib/ai-painter-stage4-three-class-supervision-identifiability-review.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze(["audit_64_approved_records_and_three_class_legal_supervision", "audit_existing_training_objective_coverage_and_unique_gap", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_design_review_authorization", "write_one_bounded_inactive_training_objective_contract_or_owner_request", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"])
const DENIALS = Object.freeze(["read_or_load_checkpoint_weights", "modify_model", "modify_loss", "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_threshold_or_result_as_training_target", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return target }
const shaFile = (value) => { const hash = crypto.createHash("sha256"); const fd = fs.openSync(value, "r"); const buffer = Buffer.allocUnsafe(1024 * 1024); try { let count; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count)) } finally { fs.closeSync(fd) } return hash.digest("hex") }
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (target, content) => { const temp = `${target}.${process.pid}.${Date.now()}.tmp`; const fd = fs.openSync(temp, "wx"); try { fs.writeFileSync(fd, content, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }; fs.renameSync(temp, target) }

function indentation(line) {
  const prefix = line.match(/^[ \t]*/)?.[0] ?? ""
  assert.equal(prefix.includes("\t"), false, "source_tabs_rejected")
  return prefix.length
}

function inspectReferenceFeatureReplayBypassSource(source) {
  const lines = source.split(/\r?\n/)
  const branchText = "if epoch_complete_selection is not None:"
  const callText = "stage4_epoch_complete_selected_luminance_replay_loss_from_tensor("
  const siblingText = 'replay_image = epoch_worst["image"].to(device)'
  const branchIndexes = lines.flatMap((line, index) => line.trim() === branchText ? [index] : [])
  assert.equal(branchIndexes.length, 1, "epoch_complete_branch_identity_invalid")
  const branchIndex = branchIndexes[0]
  const branchIndent = indentation(lines[branchIndex])
  let siblingIndex = -1
  for (let index = branchIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const currentIndent = indentation(lines[index])
    if (currentIndent < branchIndent) break
    if (currentIndent === branchIndent) { siblingIndex = index; break }
  }
  assert.notEqual(siblingIndex, -1, "epoch_complete_next_sibling_missing")
  assert.equal(lines[siblingIndex].trim(), siblingText, "epoch_complete_next_sibling_identity_invalid")
  const branchLines = lines.slice(branchIndex + 1, siblingIndex)
  const callOffsets = branchLines.flatMap((line, index) => line.trim() === callText ? [index] : [])
  const continueOffsets = branchLines.flatMap((line, index) => line.trim() === "continue" ? [index] : [])
  assert.equal(callOffsets.length, 1, "selected_luminance_call_identity_invalid")
  assert.equal(continueOffsets.length, 1, "epoch_complete_continue_identity_invalid")
  const callIndex = branchIndex + 1 + callOffsets[0]
  const continueIndex = branchIndex + 1 + continueOffsets[0]
  assert.equal(branchIndex < callIndex && callIndex < continueIndex && continueIndex < siblingIndex, true, "epoch_complete_branch_order_invalid")
  assert.equal(indentation(lines[callIndex]) > branchIndent, true, "selected_luminance_call_left_branch")
  assert.equal(indentation(lines[continueIndex]), branchIndent + 4, "epoch_complete_continue_indent_invalid")
  const assignmentIndex = (() => {
    for (let index = callIndex - 1; index > branchIndex; index -= 1) {
      if (lines[index].trim()) return index
    }
    return -1
  })()
  assert.notEqual(assignmentIndex, -1, "selected_luminance_assignment_missing")
  assert.equal(lines[assignmentIndex].trim(), "selected_loss = (", "selected_luminance_assignment_identity_invalid")
  assert.equal(indentation(lines[assignmentIndex]), branchIndent + 4, "selected_luminance_assignment_indent_invalid")
  assert.equal(branchLines.some((line) => line.trim().startsWith("#") && line.includes(callText)), false, "commented_call_rejected")
  return {
    status: "reference_feature_replay_bypass_structurally_proven",
    branchLine: branchIndex + 1,
    selectedLuminanceCallLine: callIndex + 1,
    terminatingContinueLine: continueIndex + 1,
    nextSiblingLine: siblingIndex + 1,
    branchIndent,
    branchLineCount: siblingIndex - branchIndex - 1,
  }
}

const sourceLocatorFixture = arg("--cpu-source-locator-text-base64")
if (sourceLocatorFixture) {
  const source = Buffer.from(sourceLocatorFixture, "base64").toString("utf8")
  console.log(JSON.stringify(inspectReferenceFeatureReplayBypassSource(source), null, 2))
  process.exit(0)
}

function auditApprovedData(evidence) {
  const sourceIndex = readJson(projectFile(evidence.sourceIndex.path))
  const formalConfig = readJson(projectFile(evidence.formalConfig.path))
  const expectedOrder = formalConfig.conditionChannelOrder
  const records = []
  for (const item of sourceIndex.v7CapacityContributions) {
    const contributionFile = projectFile(item.contributionPath)
    assert.equal(shaFile(contributionFile), item.contributionSha256, `contribution_sha_mismatch:${item.sampleId}`)
    const contribution = readJson(contributionFile)
    assert.equal(contribution.recordId, item.sampleId, `record_identity_mismatch:${item.sampleId}`)
    assert.equal(contribution.split, item.split, `split_identity_mismatch:${item.sampleId}`)
    const rgb = projectFile(contribution.imagePath)
    assert.equal(shaFile(rgb), contribution.imageSha256, `reference_rgb_sha_mismatch:${item.sampleId}`)
    const packFile = projectFile(contribution.conditionPackPath)
    assert.equal(shaFile(packFile), contribution.conditionPackFileSha256, `condition_pack_sha_mismatch:${item.sampleId}`)
    const pack = readJson(packFile)
    assert.equal(pack.channels.length, 23, `condition_channel_count_mismatch:${item.sampleId}`)
    assert.deepEqual(pack.channels.map((channel) => channel.id), expectedOrder, `condition_order_mismatch:${item.sampleId}`)
    const masks = {}
    for (const name of TARGET_CLASSES) {
      const channel = pack.channels.find((entry) => entry.id === `object_${name}`)
      assert.ok(channel, `${name}_mask_missing:${item.sampleId}`)
      const mask = projectFile(channel.path)
      assert.equal(shaFile(mask), channel.sha256, `${name}_mask_sha_mismatch:${item.sampleId}`)
      assert.equal(Number(channel.statistics.nonZeroCount) > 0, true, `${name}_mask_empty:${item.sampleId}`)
      masks[name] = { ...bind(mask), nonZeroCount: Number(channel.statistics.nonZeroCount) }
    }
    assert.equal(contribution.trainingEligibility.aiAssistedConditionalDenoiser, true, `training_ineligible:${item.sampleId}`)
    records.push({ sampleId: item.sampleId, split: item.split, referenceRgb: bind(rgb), conditionPack: bind(packFile), masks })
  }
  const splitCounts = Object.fromEntries(["train", "validation", "challenge", "regression"].map((name) => [name, records.filter((row) => row.split === name).length]))
  return { schemaVersion: "stage4-three-class-supervision-data-audit-v1", status: "all_64_approved_records_three_class_supervision_qualified", approvedRecordCount: records.length, splitCounts, conditionChannelCount: 23, conditionChannelOrder: expectedOrder, allConditionOrdersExact: true, allReferenceRgbHashBound: true, allConditionPacksHashBound: true, maskClasses: TARGET_CLASSES, allTargetMasksHashBound: true, allTargetMasksNonEmpty: true, minimumNonZeroCountByClass: Object.fromEntries(TARGET_CLASSES.map((name) => [name, Math.min(...records.map((row) => row.masks[name].nonZeroCount))])), maximumNonZeroCountByClass: Object.fromEntries(TARGET_CLASSES.map((name) => [name, Math.max(...records.map((row) => row.masks[name].nonZeroCount))])), allTrainingEligibilityBound: true, failedPreviewPixelsUsedAsTargets: false, machineReviewThresholdsOrResultsUsedAsTargets: false, records }
}

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-three-class-supervision-identifiability-review-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_three_class_final_visible_reference_semantic_supervision_identifiability_review")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(DENIALS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) { const target = projectFile(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`) }
const programs = { runner: projectFile("scripts/run-stage4-three-class-supervision-identifiability-review.mjs"), checker: projectFile("scripts/check-stage4-three-class-supervision-identifiability-review.mjs"), decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-three-class-supervision-identifiability-review.mjs") }
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
const audit = auditApprovedData(authorization.sourceEvidence)
const activeConfig = readJson(projectFile(authorization.sourceEvidence.activeStage0Config.path))
const manifest = readJson(projectFile(authorization.sourceEvidence.stage0Manifest.path))
const trainerText = fs.readFileSync(projectFile(authorization.sourceEvidence.inspectedTrainer.path), "utf8")
const training = activeConfig.training
const referenceContract = training.stage4PerClassWorstSampleReferenceFeatureStructureObligation
const completeLuminance = training.stage4EpochCompletePerClassWorstSampleFinalVisibleLuminanceSelectionAndCheckpointIdentity
const referenceCall = trainerText.indexOf("stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor(", trainerText.indexOf("def train_epoch"))
const referenceCallWindow = trainerText.slice(referenceCall, referenceCall + 500)
const sourceStructureInspection = inspectReferenceFeatureReplayBypassSource(trainerText)
const metricKeys = new Set(Object.keys(manifest.metrics?.[0] ?? {}))
const coverage = {
  batchSize: Number(training.batchSize),
  finalVisibleRgbCovered: training.stage4PerClassFinalVisibleRgbObligation?.status === "training_loss_active_owner_authorized",
  multiscaleLuminanceStructureCovered: training.stage4FullRolloutPerClassFinalVisibleLuminanceStructureObligation?.status === "training_loss_active_owner_authorized",
  referenceFeatureStructureCovered: training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation?.status === "training_loss_active_owner_authorized",
  frozenAutoencoderFeatureSourceCovered: training.stage4PerClassFinalVisibleReferenceFeatureStructureObligation?.featureExtraction?.autoencoderSource === "frozen_project_autoencoder",
  completeEpochPerClassLuminanceSelectionCovered: completeLuminance?.status === "training_loss_active_owner_authorized",
  completeEpochPerClassLuminanceReplayActive: manifest.metrics.every((row) => row.trainStage4EpochWorstSampleClassReplayPasses === 2),
  referenceFeaturePerClassWorstPopulation: referenceContract?.selection?.population,
  referenceFeaturePerClassWorstCalledWithCurrentBatchIds: referenceCallWindow.includes('batch["sampleId"]'),
  completeEpochPerClassReferenceFeatureSelectionCovered: trainerText.includes("stage4_epoch_complete_per_class_reference_feature_selection") || training.stage4EpochCompletePerClassWorstSampleReferenceFeatureStructureSelectionAndSharedReplay?.enabled === true,
  completeEpochLuminanceBypassesLegacyReferenceFeatureReplay: sourceStructureInspection.status === "reference_feature_replay_bypass_structurally_proven",
  validationReferenceFeatureSelectedIdentityPersisted: [...metricKeys].some((key) => /ReferenceFeature.*CheckpointSelections|ReferenceFeature.*SelectionIdentity/.test(key)),
  existingReplayPasses: Number(completeLuminance?.sourceContracts?.replayPassesPerObservedPrimaryBatch),
  existingDerivedWeightsAvailable: same(referenceContract?.sourceContracts?.derivedClassWeights, completeLuminance?.sourceContracts?.derivedClassWeights),
  newModelRequired: false,
  freeWeightRequired: false,
}
const decision = reviewThreeClassSupervisionIdentifiability({ audit, coverage })

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = { schemaVersion: "stage4-three-class-supervision-identifiability-consumption-v1", status: "cpu_readonly_design_review_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256: authorizationSha, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) }
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = { cpu: path.join(output, "cpu-report.json"), dataAudit: path.join(output, "data-supervision-audit.json"), coverage: path.join(output, "supervision-coverage-audit.json"), report: path.join(output, "supervision-design-report.json"), decision: path.join(output, "adjudication.json"), contract: path.join(output, "inactive-training-objective-contract.json"), owner: path.join(output, "owner-action-request.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
writeJsonAtomic(files.cpu, { ...cpuReport, sourceEvidence: authorization.sourceEvidence, authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.dataAudit, audit)
writeJsonAtomic(files.coverage, { schemaVersion: "stage4-three-class-supervision-coverage-audit-v1", status: "unique_complete_epoch_reference_feature_hard_example_gap_confirmed", coverage, sourceStructureInspection, activeConfig: bind(projectFile(authorization.sourceEvidence.activeStage0Config.path)), inspectedTrainer: bind(projectFile(authorization.sourceEvidence.inspectedTrainer.path)), stage0Manifest: bind(projectFile(authorization.sourceEvidence.stage0Manifest.path)), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, { schemaVersion: "stage4-three-class-supervision-identifiability-design-report-v1", status: decision.status, businessFinding: "The 64 approved records contain hash-bound reference RGB, exact 23-channel conditions, and non-empty footprints/tree/vegetation masks. Existing final RGB, luminance, and frozen-Autoencoder feature objectives are legal and active.", uncoveredFinding: "The complete-epoch per-class hard-example path exists only for luminance. Reference-feature per-class worst selection still sees the current batch at batchSize=1, its legacy global replay is bypassed by the active complete-epoch luminance replay, and validation does not persist reference-feature selected identities.", decision, dataAudit: bind(files.dataAudit), coverageAudit: bind(files.coverage), checkpointWeightsRead: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-three-class-supervision-identifiability-decision-v1", status: decision.status, selectedDecision: decision.selectedDecision, contractId: decision.contractId, report: bind(files.report), dataSupervisionQualified: true, boundedInactiveContractGenerated: true, ownerProjectRouteDecisionRequiredNow: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.contract, { ...decision.contract, boundDecision: bind(files.decision), sourceEvidence: authorization.sourceEvidence, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-v1", status: "not_authorized_not_consumed", requestedAction: `implement_cpu_inactive_support_for_${decision.contractId}`, businessReason: "A legal, uniquely derived supervision boundary remains: complete-epoch per-class worst reference-feature selection and identity-preserving shared replay/checkpoint qualification. It reuses existing tensors, weights, replay budget, data and frozen Autoencoder features.", boundDecision: bind(files.decision), boundInactiveContract: bind(files.contract), automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-three-class-supervision-identifiability-terminal-v1", status: "stage4_three_class_unique_legal_supervision_expression_confirmed_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, contractId: decision.contractId, nextLegalAction: `owner_authorize_cpu_inactive_support_for_${decision.contractId}`, report: bind(files.report), decision: bind(files.decision), inactiveTrainingObjectiveContract: bind(files.contract), ownerActionRequest: bind(files.owner), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 three-class legal supervision identifiability review completed", latestTerminal: bind(files.terminal), latestFinding: "complete_epoch_per_class_reference_feature_hard_example_boundary_uncovered", nextLegalAction: `owner_authorize_cpu_inactive_support_for_${decision.contractId}`, forbiddenActions: DENIALS, evidence: { cpuReport: bind(files.cpu), dataAudit: bind(files.dataAudit), coverageAudit: bind(files.coverage), report: bind(files.report), decision: bind(files.decision), inactiveTrainingObjectiveContract: bind(files.contract), ownerActionRequest: bind(files.owner) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage 0失败已确认不是完整Epoch亮度选择接线问题。64份数据监督复核进一步确认一个未覆盖合法边界：逐类参考特征最差选择仍受batchSize=1限制，旧全局参考特征回放在完整Epoch亮度回放启用时被旁路，validation参考特征选择身份未落盘；已生成唯一有界未激活训练目标合同，Stage 1/2未启动")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = `- 64份批准数据的footprints/tree/vegetation监督可辨识性复核已完成：参考RGB、三类原始掩码、23通道条件及冻结Autoencoder特征均完整合法。现有完整Epoch逐类硬样本链只覆盖亮度结构；参考特征逐类最差选择仍在batchSize=1当前样本内，旧参考特征回放又被完整Epoch亮度回放旁路，validation未保存参考特征选中身份。已唯一生成\`${decision.contractId}\`未激活合同；不得直接重跑Stage 0。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_three_class_supervision_identifiability_review", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) }) }
appendAiPainterProgramEvent({ id: `stage4-three-class-supervision-identifiability-${authorization.runId}`, timestamp: now, action: "stage4_three_class_supervision_identifiability_review", runId: authorization.runId, kind: "cpu_readonly_design_review", status: "success", title: "Stage4 unique legal reference-feature hard-example boundary confirmed", titleZh: "Stage4三类对象唯一合法参考特征硬样本边界已确认", detailZh: "64份数据监督完整；完整Epoch硬样本链只覆盖亮度，逐类参考特征完整Epoch选择、共享回放和Checkpoint身份仍未覆盖，已生成唯一未激活合同。", evidencePath: relative(files.terminal), evidenceSha256: shaFile(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: readJson(files.terminal).status, contractId: decision.contractId, terminal: bind(files.terminal), report: bind(files.report), decision: bind(files.decision), inactiveTrainingObjectiveContract: bind(files.contract), dataAudit: bind(files.dataAudit), coverageAudit: bind(files.coverage), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
