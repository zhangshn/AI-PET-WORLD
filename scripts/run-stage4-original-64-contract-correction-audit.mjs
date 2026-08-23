import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateOriginal64Contract } from "./lib/ai-painter-stage4-original-64-contract-correction-audit.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze(["verify_bound_prior_and_original_capacity_evidence", "compare_all_64_planned_slots_to_final_records", "audit_original_contract_stage4_sufficiency_scope", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_correction_authorization", "write_correction_audit_decision_owner_request_and_terminal", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"])
const REQUIRED_DENIALS = Object.freeze(["modify_or_add_data", "modify_model", "modify_loss", "read_or_load_checkpoint_weights", "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training"])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const result = path.resolve(ROOT, value)
  assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return result
}
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (value, text) => {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  const temp = `${value}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, text, "utf8")
  fs.renameSync(temp, value)
}
const countBy = (rows, key) => Object.fromEntries(["train", "validation", "challenge", "regression"].map((name) => [name, rows.filter((row) => row[key] === name).length]))

function buildPlanAudit(plan, gap) {
  return {
    schemaVersion: "stage4-original-64-plan-audit-v1",
    status: "original_capacity_plan_verified",
    decisionId: plan.decisionId,
    originalStatus: plan.status,
    originalScope: "first_training_capacity_and_split_construction",
    sourceRegion: plan.sourceScope.region,
    requiredCompliantRecordCount: gap.requiredCompliantRecordCount,
    plannedSlotCount: gap.plannedSlots.length,
    plannedSplitCounts: gap.splitCounts,
    firstPlannedSlotId: plan.gapSummary.firstPlannedSlotId,
    lastPlannedSlotId: plan.gapSummary.lastPlannedSlotId,
    themeArchitectureIdentityRequired: plan.gates.themeArchitectureIdentityRequired,
    instanceDetailIdentityRequired: plan.gates.instanceDetailIdentityRequired,
    fullHistoryConditionAndRgbAuditRequired: plan.gates.fullHistoryConditionAndRgbAuditRequired,
    gpuTrainingAuthorized: plan.executionBoundary.gpuTrainingStarted || plan.gates.gpuTrainingAuthorized === true,
    imageGenerationAuthorizedAtPlanTime: plan.gates.batchRgbAuthorized,
  }
}

function buildRealizationAudit(gap, sourceIndex) {
  const plannedBySlot = new Map(gap.plannedSlots.map((slot) => [slot.slotId, slot]))
  assert.equal(plannedBySlot.size, gap.plannedSlots.length, "duplicate_planned_slot")
  const actualRows = []
  for (const item of sourceIndex.v7CapacityContributions) {
    const contributionPath = projectFile(item.contributionPath)
    const contributionSha = shaFile(contributionPath)
    const contribution = readJson(contributionPath)
    const referenceRgbPath = projectFile(contribution.imagePath)
    const conditionPackPath = projectFile(contribution.conditionPackPath)
    const machineReviewPath = projectFile(contribution.machineReviewPath)
    const ownerReviewPath = projectFile(contribution.ownerReviewPath)
    const planned = plannedBySlot.get(item.capacitySlotId)
    actualRows.push({
      capacitySlotId: item.capacitySlotId,
      sampleId: item.sampleId,
      planned: Boolean(planned),
      split: item.split,
      plannedSplit: planned?.split ?? null,
      monsoonSeason: contribution.monsoonSeason,
      plannedMonsoonSeason: planned?.monsoonSeason ?? null,
      regionalLandscapeType: contribution.regionalLandscapeType,
      plannedRegionalLandscapeType: planned?.regionalLandscapeType ?? null,
      contribution: { path: relative(contributionPath), expectedSha256: item.contributionSha256, actualSha256: contributionSha, matches: contributionSha === item.contributionSha256 },
      referenceRgb: { path: relative(referenceRgbPath), expectedSha256: contribution.imageSha256, actualSha256: shaFile(referenceRgbPath), matches: shaFile(referenceRgbPath) === contribution.imageSha256 },
      conditionPack: { path: relative(conditionPackPath), expectedSha256: contribution.conditionPackFileSha256, actualSha256: shaFile(conditionPackPath), matches: shaFile(conditionPackPath) === contribution.conditionPackFileSha256 },
      machineReview: { path: relative(machineReviewPath), expectedSha256: contribution.machineReviewSha256, actualSha256: shaFile(machineReviewPath), matches: shaFile(machineReviewPath) === contribution.machineReviewSha256 },
      ownerReview: { path: relative(ownerReviewPath), expectedSha256: contribution.ownerReviewSha256, actualSha256: shaFile(ownerReviewPath), matches: shaFile(ownerReviewPath) === contribution.ownerReviewSha256 },
    })
  }
  const actualSlotCounts = new Map()
  for (const row of actualRows) actualSlotCounts.set(row.capacitySlotId, (actualSlotCounts.get(row.capacitySlotId) ?? 0) + 1)
  const missing = gap.plannedSlots.filter((slot) => !actualSlotCounts.has(slot.slotId)).map((slot) => slot.slotId)
  const unplanned = actualRows.filter((row) => !row.planned).map((row) => row.capacitySlotId)
  return {
    schemaVersion: "stage4-original-64-realization-audit-v1",
    status: "all_original_64_slots_realized_as_planned",
    actualRecordCount: actualRows.length,
    actualSplitCounts: countBy(actualRows, "split"),
    allPlannedSlotsRealizedExactlyOnce: gap.plannedSlots.every((slot) => actualSlotCounts.get(slot.slotId) === 1),
    allSplitsMatchPlan: actualRows.every((row) => row.split === row.plannedSplit),
    allSeasonsMatchPlan: actualRows.every((row) => row.monsoonSeason === row.plannedMonsoonSeason),
    allLandscapeTypesMatchPlan: actualRows.every((row) => row.regionalLandscapeType === row.plannedRegionalLandscapeType),
    allContributionHashesMatch: actualRows.every((row) => row.contribution.matches),
    allReferenceRgbHashesMatch: actualRows.every((row) => row.referenceRgb.matches),
    allConditionPackHashesMatch: actualRows.every((row) => row.conditionPack.matches),
    allMachineReviewHashesMatch: actualRows.every((row) => row.machineReview.matches),
    allOwnerReviewHashesMatch: actualRows.every((row) => row.ownerReview.matches),
    uniqueReferenceRgbCount: new Set(actualRows.map((row) => row.referenceRgb.actualSha256)).size,
    uniqueConditionPackCount: new Set(actualRows.map((row) => row.conditionPack.actualSha256)).size,
    unplannedSlotCount: unplanned.length,
    unplannedSlots: unplanned,
    missingPlannedSlotCount: missing.length,
    missingPlannedSlots: missing,
    records: actualRows,
  }
}

function buildSufficiencyAudit(plan, gap) {
  const explicitContract = { ...plan.sufficiencyContract, ...gap.sufficiencyContract }
  return {
    schemaVersion: "stage4-original-64-sufficiency-scope-audit-v1",
    status: "original_contract_does_not_define_stage4_sufficiency",
    originalScope: "first_training_capacity_and_split_construction",
    validationScenarioMustExistInTrainRequired: explicitContract.validationScenarioMustExistInTrain === true,
    exactConditionReplicationRequired: explicitContract.exactConditionReplicationRequired === true,
    sample194RepresentsAllValidationRequired: explicitContract.sample194RepresentsAllValidation === true,
    explicitStage4SuccessGuarantee: explicitContract.stage4SuccessGuaranteed === true,
    explicitCompleteMapGeneralizationSufficiencyGuarantee: explicitContract.completeMapGeneralizationSufficiencyGuaranteed === true,
    explicitFieldsFound: Object.keys(explicitContract),
    evidence: {
      decisionIdentity: plan.decisionId,
      planStatus: plan.status,
      plannedPurpose: "first_training_capacity",
      gpuTrainingAuthorizedAtPlanning: plan.gates.gpuTrainingAuthorized === true,
      gpuTrainingStartedAtPlanning: plan.executionBoundary.gpuTrainingStarted,
      trainingStartedAtPlanning: plan.executionBoundary.trainingStarted,
    },
    correctionRules: {
      validationNoveltyIsNotAutomaticallyADataDefect: true,
      exactConditionUniquenessIsNotAutomaticallyADataDefect: true,
      sample194RarityIsNotAutomaticallyADataDefect: true,
    },
  }
}

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-original-64-contract-correction-audit-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_original_64_contract_sufficiency_and_prior_decision_correction_audit")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(REQUIRED_DENIALS.every((value) => authorization.deniedActions.includes(value)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.dataModificationAuthorized, false)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-original-64-contract-correction-audit.mjs"),
  checker: projectFile("scripts/check-stage4-original-64-contract-correction-audit.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-original-64-contract-correction-audit.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = { schemaVersion: "stage4-original-64-contract-correction-consumption-v1", status: "cpu_readonly_correction_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorization: bind(authorizationPath), oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) }
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })

const priorDecision = readJson(projectFile(authorization.sourceEvidence.priorDecision.path))
const plan = readJson(projectFile(authorization.sourceEvidence.originalCapacityPlan.path))
const gap = readJson(projectFile(authorization.sourceEvidence.originalCapacityGapAndSlotPlan.path))
const sourceIndex = readJson(projectFile(authorization.sourceEvidence.finalSourceIndex.path))
const planAudit = buildPlanAudit(plan, gap)
const realizationAudit = buildRealizationAudit(gap, sourceIndex)
const sufficiencyAudit = buildSufficiencyAudit(plan, gap)
const decision = adjudicateOriginal64Contract({ priorRedesignDecision: priorDecision, planAudit, realizationAudit, sufficiencyAudit })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  correction: path.join(output, "correction-report.json"),
  planAudit: path.join(output, "original-64-capacity-contract-audit.json"),
  realizationAudit: path.join(output, "original-64-realization-audit.json"),
  sufficiencyAudit: path.join(output, "original-64-stage4-sufficiency-scope-audit.json"),
  decision: path.join(output, "adjudication.json"),
  owner: path.join(output, "owner-resource-scale-decision-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), sourceEvidence: authorization.sourceEvidence, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.planAudit, { ...planAudit, sourcePlan: authorization.sourceEvidence.originalCapacityPlan, sourceGapAndSlotPlan: authorization.sourceEvidence.originalCapacityGapAndSlotPlan, sourceWindowPlan: authorization.sourceEvidence.originalWindowPlan, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.realizationAudit, { ...realizationAudit, sourceIndex: authorization.sourceEvidence.finalSourceIndex, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.sufficiencyAudit, { ...sufficiencyAudit, originalCapacityPlan: authorization.sourceEvidence.originalCapacityPlan, originalCapacityGapAndSlotPlan: authorization.sourceEvidence.originalCapacityGapAndSlotPlan, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.correction, {
  schemaVersion: "stage4-original-64-contract-prior-adjudication-correction-report-v1",
  status: "prior_data_supervision_redesign_executable_conclusion_superseded",
  correctedError: "The prior audit introduced post-hoc requirements that were not present in the original 64-record capacity contract.",
  invalidDefectInferences: ["validation_business_scenario_without_train_counterpart", "zero_exact_condition_replicates", "sample194_rare_scenario"],
  immutableHistoryPreserved: true,
  priorEvidence: { terminal: authorization.sourceEvidence.priorTerminal, audit: authorization.sourceEvidence.priorAudit, decision: authorization.sourceEvidence.priorDecision },
  replacementDecision: decision.selectedDecision,
  dataDefectProven: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, { ...decision, correctionReport: bind(files.correction), originalCapacityContractAudit: bind(files.planAudit), original64RealizationAudit: bind(files.realizationAudit), sufficiencyScopeAudit: bind(files.sufficiencyAudit), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-original-64-resource-scale-owner-decision-request-v1",
  status: "owner_project_level_resource_scope_decision_required",
  reason: "The approved 64-record product matches its original first-training-capacity contract, but that contract did not guarantee Stage4 visual generalization. No data defect or required new sample count is proven.",
  options: ["retain_original_64_and_authorize_new_model_or_training_paradigm_design", "authorize_bounded_empirical_data_scale_requirement_study", "pause_stage4"],
  prohibitedAutomaticDecision: ["declare_64_insufficient", "choose_new_sample_count", "add_another_same_kind_loss", "rerun_failed_stage0"],
  boundDecision: bind(files.decision),
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-original-64-contract-correction-terminal-v1",
  status: "stage4_original_64_contract_satisfied_sufficiency_undefined_closed",
  selectedDecision: decision.selectedDecision,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  priorDataRedesignConclusionActionable: false,
  original64ContractSatisfied: true,
  dataDefectProven: false,
  ownerDecisionRequired: true,
  correctionReport: bind(files.correction),
  adjudication: bind(files.decision),
  ownerResourceScaleDecisionRequest: bind(files.owner),
  dataModified: false,
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
  currentStage: "Stage4 original 64-record contract satisfied; Stage4 sufficiency was not defined",
  latestTerminal: bind(files.terminal),
  latestFinding: "original_64_contract_satisfied_but_did_not_guarantee_stage4_sufficiency",
  nextLegalAction: "owner_choose_model_route_redesign_data_scale_study_or_pause",
  evidence: { cpuReport: bind(files.cpu), correctionReport: bind(files.correction), planAudit: bind(files.planAudit), realizationAudit: bind(files.realizationAudit), sufficiencyAudit: bind(files.sufficiencyAudit), adjudication: bind(files.decision), ownerRequest: bind(files.owner) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；原始64份容量合同与最终64份数据已逐槽核对一致，未证明数据缺陷。前次data_supervision_redesign_required可执行结论已由新不可变纠正证据取代；原始合同只定义首轮训练容量与48/8/4/4划分，没有定义Stage4成功充分性，等待Owner选择保留64并重设计模型/训练范式、授权有界数据规模研究或暂停Stage4")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = `- 原始64份数据合同纠正审计已完成：64个计划槽位与最终记录的split、季节、景观类型、参考RGB、条件包及审核身份全部一致，未发现数据实现缺陷。前次把validation新组合、条件唯一性和样本194稀有性直接判为数据缺陷属于后置规则，相关可执行结论已被标记为superseded。唯一裁决为\`original_64_contract_did_not_define_stage4_sufficiency\`；不得自动增加数据或重跑Stage 0。\n`
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, planText)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), planSha256Before: planBefore, terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_original_64_contract_correction_audit", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-original-64-contract-correction-${authorization.runId}`,
  timestamp: now,
  action: "stage4_original_64_contract_correction_audit",
  runId: authorization.runId,
  kind: "cpu_readonly_contract_correction",
  status: "success",
  title: "Original 64-record contract satisfied; Stage4 sufficiency undefined",
  titleZh: "原始64份合同已满足，但未定义Stage4充分性",
  detailZh: "64个计划槽位与最终数据逐项一致；前次把validation新组合、条件唯一性和样本194稀有性视为缺陷的可执行结论已被纠正。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({ status: readJson(files.terminal).status, selectedDecision: decision.selectedDecision, terminal: bind(files.terminal), correctionReport: bind(files.correction), originalContractAudit: bind(files.planAudit), realizationAudit: bind(files.realizationAudit), sufficiencyAudit: bind(files.sufficiencyAudit), adjudication: bind(files.decision), ownerRequest: bind(files.owner), cpuReport: bind(files.cpu), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
