import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import sharp from "sharp"
import { OBJECT_CLASSES, adjudicateProjectLevelRedesign } from "./lib/ai-painter-stage4-project-level-data-supervision-resource-redesign.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_route_exit_and_owner_selection",
  "audit_64_approved_data_supervision_and_resource_evidence",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_project_level_redesign_authorization",
  "write_one_of_four_project_level_decisions_and_bounded_contract_or_owner_request",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const REQUIRED_DENIALS = Object.freeze(["read_or_load_checkpoint_weights", "generate_model_name", "add_same_kind_loss", "select_free_hyperparameters", "start_gpu", "start_training", "start_smoke", "rerun_stage0", "start_stage0", "start_stage1", "start_stage2", "use_failed_preview_as_training_target", "use_machine_review_threshold_or_result_as_training_target"])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
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

async function readMask(channel) {
  const file = projectFile(channel.path)
  assert.equal(shaFile(file), channel.sha256, `mask_sha_mismatch:${channel.id}`)
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  return { file, data, width: info.width, height: info.height, nonZeroCount: data.reduce((count, value) => count + (value > 0 ? 1 : 0), 0) }
}

async function auditApprovedData(sourceIndexEvidence) {
  const sourceIndexPath = projectFile(sourceIndexEvidence.path)
  assert.equal(shaFile(sourceIndexPath), sourceIndexEvidence.sha256, "source_index_sha256_mismatch")
  const sourceIndex = readJson(sourceIndexPath)
  assert.equal(sourceIndex.v7CapacityContributions.length, 64, "source_index_record_count_mismatch")
  const records = []
  let expectedOrder = null
  let allTypedMasksWithinFootprints = true
  for (const item of sourceIndex.v7CapacityContributions) {
    const contributionPath = projectFile(item.contributionPath)
    assert.equal(shaFile(contributionPath), item.contributionSha256, `contribution_sha_mismatch:${item.sampleId}`)
    const contribution = readJson(contributionPath)
    assert.equal(contribution.recordId, item.sampleId, `record_id_mismatch:${item.sampleId}`)
    assert.equal(contribution.split, item.split, `split_mismatch:${item.sampleId}`)
    const referenceRgbPath = projectFile(contribution.imagePath)
    assert.equal(shaFile(referenceRgbPath), contribution.imageSha256, `reference_rgb_sha_mismatch:${item.sampleId}`)
    const rgbMetadata = await sharp(referenceRgbPath).metadata()
    const conditionPackPath = projectFile(contribution.conditionPackPath)
    assert.equal(shaFile(conditionPackPath), contribution.conditionPackFileSha256, `condition_pack_sha_mismatch:${item.sampleId}`)
    const conditionPack = readJson(conditionPackPath)
    const order = conditionPack.channels.map((channel) => channel.id)
    if (expectedOrder === null) expectedOrder = order
    assert.deepEqual(order, expectedOrder, `condition_order_mismatch:${item.sampleId}`)
    assert.equal(order.length, 23, `condition_count_mismatch:${item.sampleId}`)
    assert.equal(rgbMetadata.width, conditionPack.canvas.width, `reference_width_mismatch:${item.sampleId}`)
    assert.equal(rgbMetadata.height, conditionPack.canvas.height, `reference_height_mismatch:${item.sampleId}`)
    const masks = {}
    for (const name of OBJECT_CLASSES) {
      const channel = conditionPack.channels.find((value) => value.id === `object_${name}`)
      assert.ok(channel, `object_mask_missing:${item.sampleId}:${name}`)
      masks[name] = await readMask(channel)
      assert.equal(masks[name].width, rgbMetadata.width, `mask_width_mismatch:${item.sampleId}:${name}`)
      assert.equal(masks[name].height, rgbMetadata.height, `mask_height_mismatch:${item.sampleId}:${name}`)
      assert.equal(masks[name].nonZeroCount, Number(channel.statistics.nonZeroCount), `mask_statistics_mismatch:${item.sampleId}:${name}`)
      assert.equal(masks[name].nonZeroCount > 0, true, `object_mask_empty:${item.sampleId}:${name}`)
    }
    for (const name of ["tree", "rock", "vegetation"]) {
      for (let index = 0; index < masks[name].data.length; index += 1) {
        if (masks[name].data[index] > 0 && masks.footprints.data[index] === 0) { allTypedMasksWithinFootprints = false; break }
      }
    }
    const water = conditionPack.channels.find((value) => value.id === "terrain_water")
    const scenarioSignature = `${contribution.regionalLandscapeType}|${contribution.monsoonSeason}|${Number(water.statistics.nonZeroCount) > 0 ? "water" : "no_water"}`
    const conditionFingerprint = crypto.createHash("sha256").update(conditionPack.channels.map((channel) => `${channel.id}:${channel.sha256}`).join("|")).digest("hex")
    records.push({
      sampleId: item.sampleId,
      split: item.split,
      regionalLandscapeType: contribution.regionalLandscapeType,
      monsoonSeason: contribution.monsoonSeason,
      scenarioSignature,
      referenceRgb: bind(referenceRgbPath),
      conditionPack: bind(conditionPackPath),
      conditionFingerprint,
      canvas: { width: rgbMetadata.width, height: rgbMetadata.height },
      objectMaskNonZeroCount: Object.fromEntries(OBJECT_CLASSES.map((name) => [name, masks[name].nonZeroCount])),
    })
  }
  const splitCounts = Object.fromEntries(["train", "validation", "challenge", "regression"].map((name) => [name, records.filter((row) => row.split === name).length]))
  const trainScenarios = new Set(records.filter((row) => row.split === "train").map((row) => row.scenarioSignature))
  const validation = records.filter((row) => row.split === "validation")
  const validationScenariosWithoutTrainCounterpart = [...new Set(validation.filter((row) => !trainScenarios.has(row.scenarioSignature)).map((row) => row.scenarioSignature))].sort()
  const sample194 = records.find((row) => row.sampleId.includes("slot-194-"))
  assert.ok(sample194, "sample194_missing")
  const sameScenario = records.filter((row) => row.scenarioSignature === sample194.scenarioSignature)
  const exactConditionCounts = new Map()
  for (const row of records) exactConditionCounts.set(row.conditionFingerprint, (exactConditionCounts.get(row.conditionFingerprint) ?? 0) + 1)
  const exactConditionReplicateCount = [...exactConditionCounts.values()].filter((count) => count > 1).length
  return {
    schemaVersion: "stage4-project-level-data-supervision-resource-audit-v1",
    status: "data_supervision_redesign_gap_confirmed",
    sourceIndex: bind(sourceIndexPath),
    approvedRecordCount: records.length,
    splitCounts,
    objectClasses: OBJECT_CLASSES,
    conditionChannelCount: expectedOrder.length,
    conditionChannelOrder: expectedOrder,
    allReferenceRgbHashBound: true,
    allConditionPacksHashBound: true,
    allConditionOrdersExact: true,
    allObjectMasksHashBound: true,
    allObjectMasksNonEmpty: true,
    allSpatialDimensionsAligned: true,
    allTypedMasksWithinFootprints,
    uniqueReferenceRgbCount: new Set(records.map((row) => row.referenceRgb.sha256)).size,
    uniqueConditionPackCount: new Set(records.map((row) => row.conditionPack.sha256)).size,
    exactConditionReplicateCount,
    trainScenarioCount: trainScenarios.size,
    validationScenarioCount: new Set(validation.map((row) => row.scenarioSignature)).size,
    validationScenariosWithoutTrainCounterpart,
    validationRecordsWithoutTrainCounterpart: validation.filter((row) => !trainScenarios.has(row.scenarioSignature)).map((row) => row.sampleId),
    sample194: {
      sampleId: sample194.sampleId,
      split: sample194.split,
      scenarioSignature: sample194.scenarioSignature,
      isOnlyValidationWaterScenario: validation.filter((row) => row.scenarioSignature.endsWith("|water")).length === 1,
      totalMatchingBusinessScenarioRecords: sameScenario.length,
      matchingTrainRecords: sameScenario.filter((row) => row.split === "train").length,
      representsAllValidationBusinessScenarios: new Set(validation.map((row) => row.scenarioSignature)).size === 1,
    },
    classSupportRangeBySplit: Object.fromEntries(OBJECT_CLASSES.map((name) => [name, Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => {
      const values = records.filter((row) => row.split === split).map((row) => row.objectMaskNonZeroCount[name])
      return [split, { minimum: Math.min(...values), maximum: Math.max(...values) }]
    }))])),
    failedPreviewPixelsUsedAsTargets: false,
    machineReviewThresholdsOrResultsUsedAsTargets: false,
    records,
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
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-project-level-data-supervision-resource-redesign-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.ownerSelection, "authorize_project_level_data_supervision_resource_redesign")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_stage4_project_level_data_supervision_resource_redesign")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(REQUIRED_DENIALS.every((value) => authorization.deniedActions.includes(value)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-project-level-data-supervision-resource-redesign.mjs"),
  checker: projectFile("scripts/check-stage4-project-level-data-supervision-resource-redesign.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-project-level-data-supervision-resource-redesign.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-project-level-data-supervision-resource-redesign-consumption-v1",
  status: "cpu_readonly_project_level_redesign_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorization: bind(authorizationPath),
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })

const audit = await auditApprovedData(authorization.sourceEvidence.sourceIndex)
const causal = readJson(projectFile(authorization.sourceEvidence.causalAnalysis.path))
const routeExit = readJson(projectFile(authorization.sourceEvidence.routeExitProposal.path))
const executionEvidence = {
  allRegisteredObjectivesActive: causal.evidence.contractsActive && causal.evidence.completeEpochSelectionAndSharedReplayCorrect && causal.evidence.validationCheckpointIdentityCorrect,
  allRegisteredObjectivesImproved: Object.values(causal.evidence.optimizationTrends).every(Boolean),
  directWiringDefectEvidence: causal.evidence.directWiringDefectEvidence,
  terminalFourObjectFailure: same(causal.evidence.terminalFailedClasses, OBJECT_CLASSES),
  frozenAutoencoderFeaturesQualifiedAsBusinessSemanticLabels: false,
  stage0Resolution: "256x192",
  formalMapResolution: "1024x768",
  stage1OrStage2EvidenceAvailable: false,
}
const decision = adjudicateProjectLevelRedesign({ sourceDecision: routeExit, audit, executionEvidence })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  problem: path.join(output, "project-level-problem-report.json"),
  audit: path.join(output, "data-supervision-resource-audit.json"),
  decision: path.join(output, "adjudication.json"),
  contract: path.join(output, "inactive-data-supervision-build-contract.json"),
  ownerMaterials: path.join(output, "owner-material-action-list.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), sourceEvidence: authorization.sourceEvidence, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.problem, {
  schemaVersion: "stage4-project-level-data-supervision-resource-problem-report-v1",
  status: "project_level_data_supervision_problem_confirmed",
  businessGoal: "Generate an auditable complete game map from WorldFacts, VisualFactManifest and the formal 23-channel condition pack.",
  problem: "The current 64-record product is internally valid, but it does not provide sufficient scenario coverage, repeated condition-to-appearance identifiability or a qualified business-semantic feature authority to validate multi-sample complete-map object semantics.",
  immutableStage0Finding: causal.evidence,
  prohibitedInterpretations: ["corrupt_source_files", "missing_loss_activation", "permission_to_rerun_current_stage0", "permission_to_add_another_model_or_same_kind_loss"],
  sourceEvidence: authorization.sourceEvidence,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.audit, { ...audit, executionEvidence, findings: decision.findings, sourceCausalAnalysis: authorization.sourceEvidence.causalAnalysis, checkpointWeightsRead: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.decision, {
  schemaVersion: "stage4-project-level-data-supervision-resource-adjudication-v1",
  status: "data_supervision_redesign_required",
  selectedDecision: decision.selectedDecision,
  rejectedDecisions: decision.rejectedDecisions,
  problemReport: bind(files.problem),
  audit: bind(files.audit),
  currentCandidateRemainsExited: true,
  modelConstructionPaused: true,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.contract, { ...decision.buildContract, boundDecision: bind(files.decision), sourceEvidence: authorization.sourceEvidence, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.ownerMaterials, {
  schemaVersion: "stage4-project-level-owner-material-action-list-v1",
  status: "owner_materials_required_not_authorized_not_consumed",
  requestedActions: decision.buildContract.ownerMaterialActions,
  acceptanceGates: decision.buildContract.acceptanceGates,
  boundContract: bind(files.contract),
  noAutomaticDataGeneration: true,
  noAutomaticTrainingAuthorization: true,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-project-level-data-supervision-resource-redesign-terminal-v1",
  status: "stage4_data_supervision_redesign_required_closed",
  selectedDecision: decision.selectedDecision,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentCandidateRemainsExited: true,
  nextLegalAction: "owner_authorize_bounded_stage4_data_supervision_product_construction",
  problemReport: bind(files.problem),
  audit: bind(files.audit),
  decision: bind(files.decision),
  inactiveBuildContract: bind(files.contract),
  ownerMaterialActionList: bind(files.ownerMaterials),
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
  currentStage: "Stage4 project-level data and supervision redesign required",
  latestTerminal: bind(files.terminal),
  latestFinding: "current_64_record_product_cannot_validate_multi_sample_object_semantics",
  nextLegalAction: "owner_authorize_bounded_stage4_data_supervision_product_construction",
  forbiddenActions: authorization.deniedActions,
  evidence: { cpuReport: bind(files.cpu), problemReport: bind(files.problem), audit: bind(files.audit), decision: bind(files.decision), inactiveBuildContract: bind(files.contract), ownerMaterialActionList: bind(files.ownerMaterials) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = shaFile(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；当前Stage4模型候选已退出，项目级CPU只读审计唯一裁决为data_supervision_redesign_required。现有64份数据文件和掩码完整，但训练/验证场景覆盖、同条件外观可辨识性、固定样本194代表性及冻结Autoencoder业务语义资格不足；Stage4模型建设暂停，等待有界数据与监督产品建设")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = `- Stage4项目级数据、监督与资源重设计已完成CPU只读审计：64份批准记录、23通道、参考RGB和四类对象掩码均完整且空间对齐，但8个validation业务场景中存在train未覆盖组合；固定样本194仅代表全库2条记录的稀有有水场景且只有1条train对照；冻结Autoencoder特征目标虽改善但未取得业务语义标签资格。唯一裁决为\`data_supervision_redesign_required\`，当前模型候选继续退出并暂停模型建设，下一步只允许按未激活合同建设版本化数据与监督产品。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), planSha256Before: planBefore, terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_project_level_data_supervision_resource_redesign", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-project-level-data-supervision-resource-redesign-${authorization.runId}`,
  timestamp: now,
  action: "stage4_project_level_data_supervision_resource_redesign",
  runId: authorization.runId,
  kind: "cpu_readonly_project_level_redesign",
  status: "success",
  title: "Stage4 data and supervision product redesign required",
  titleZh: "Stage4项目级数据与监督产品重设计已确认",
  detailZh: "64份数据本体完整，但场景覆盖、同条件外观可辨识性、样本194代表性和冻结特征业务语义资格不足；当前候选保持退出，模型建设暂停。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  selectedDecision: decision.selectedDecision,
  terminal: bind(files.terminal),
  problemReport: bind(files.problem),
  audit: bind(files.audit),
  decision: bind(files.decision),
  inactiveBuildContract: bind(files.contract),
  ownerMaterialActionList: bind(files.ownerMaterials),
  cpuReport: bind(files.cpu),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
}, null, 2))
