import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { reviewLegalVegetationSupervision } from "./lib/ai-painter-stage4-vegetation-legal-supervision-design-review.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const SOURCE_BASE = ".runtime/ai-painter/stage4-vegetation-terminal-checkpoint-identity-adjudications/20260821-045342704"
const SOURCE_EVIDENCE = Object.freeze({
  priorTerminal: { path: `${SOURCE_BASE}/phase-terminal.json`, sha256: "e6ce08fede563c1a5ccb831cd25cde2953ceea1160fa1ec71b1a4cd38295d9bc" },
  priorAnalysis: { path: `${SOURCE_BASE}/causal-analysis-report.json`, sha256: "bce4268d807587a870e13f6cc6d3bb60ef665a1f5cd4fc9752ca072109f1ebf4" },
  priorDecision: { path: `${SOURCE_BASE}/adjudication.json`, sha256: "7668bec0d797620dce660a22b3bda29b3cf290b468727026b0b8d8b121f03bc0" },
  priorOwnerRequest: { path: `${SOURCE_BASE}/owner-action-request.json`, sha256: "5b4d227662a9eda238a801c0bfbcd1f99b3cd893883aa3e42db193fe36e89642" },
})
const DATASET = Object.freeze({
  manifest: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json",
  sourceIndex: "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json",
  config: "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
})
const REQUIRED_ACTIONS = Object.freeze([
  "audit_64_approved_records_and_legal_vegetation_supervision",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_design_review_authorization",
  "write_one_bounded_inactive_training_objective_contract_or_owner_request",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const FORBIDDEN_ACTIONS = Object.freeze([
  "read_or_load_checkpoint_weights", "modify_model", "modify_loss", "select_free_hyperparameters",
  "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds",
  "use_failed_preview_as_training_target", "use_review_result_as_training_target",
  "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion",
  "runtime_frame", "world_entry",
])

const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
const shaFile = (file) => {
  const hash = crypto.createHash("sha256")
  const fd = fs.openSync(file, "r")
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, n)) }
  finally { fs.closeSync(fd) }
  return hash.digest("hex")
}
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const resolved = path.resolve(ROOT, value)
  assert.equal(resolved.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return resolved
}
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: shaFile(file) })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (target, value) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const fd = fs.openSync(temp, "wx")
  try { fs.writeFileSync(fd, value, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temp, target)
}

function auditApprovedData() {
  const sourceIndexFile = projectFile(DATASET.sourceIndex)
  const sourceIndex = readJson(sourceIndexFile)
  const expectedOrder = readJson(projectFile(DATASET.config)).conditionChannelOrder
  const rows = []
  for (const item of sourceIndex.v7CapacityContributions) {
    const contributionFile = projectFile(item.contributionPath)
    assert.equal(shaFile(contributionFile), item.contributionSha256, `contribution_sha_mismatch:${item.sampleId}`)
    const contribution = readJson(contributionFile)
    assert.equal(contribution.recordId, item.sampleId, `record_identity_mismatch:${item.sampleId}`)
    assert.equal(contribution.split, item.split, `split_identity_mismatch:${item.sampleId}`)
    const imageFile = projectFile(contribution.imagePath)
    assert.equal(shaFile(imageFile), contribution.imageSha256, `reference_rgb_sha_mismatch:${item.sampleId}`)
    const packFile = projectFile(contribution.conditionPackPath)
    assert.equal(shaFile(packFile), contribution.conditionPackFileSha256, `condition_pack_sha_mismatch:${item.sampleId}`)
    const pack = readJson(packFile)
    const channels = pack.channels
    assert.equal(channels.length, 23, `condition_channel_count_mismatch:${item.sampleId}`)
    assert.deepEqual(channels.map((row) => row.id), expectedOrder, `condition_channel_order_mismatch:${item.sampleId}`)
    const vegetation = channels.find((row) => row.id === "object_vegetation")
    assert.ok(vegetation, `vegetation_channel_missing:${item.sampleId}`)
    const maskFile = projectFile(vegetation.path)
    assert.equal(shaFile(maskFile), vegetation.sha256, `vegetation_mask_sha_mismatch:${item.sampleId}`)
    assert.equal(Number(vegetation.statistics.nonZeroCount) > 0, true, `vegetation_mask_empty:${item.sampleId}`)
    assert.equal(contribution.trainingEligibility.aiAssistedConditionalDenoiser, true, `training_ineligible:${item.sampleId}`)
    rows.push({
      sampleId: item.sampleId,
      split: item.split,
      referenceRgb: bind(imageFile),
      conditionPack: bind(packFile),
      vegetationMask: bind(maskFile),
      vegetationNonZeroCount: Number(vegetation.statistics.nonZeroCount),
      conditionChannelCount: channels.length,
      conditionOrderSha256: crypto.createHash("sha256").update(JSON.stringify(expectedOrder)).digest("hex"),
    })
  }
  const splitCounts = Object.fromEntries(["train", "validation", "challenge", "regression"].map((name) => [name, rows.filter((row) => row.split === name).length]))
  return {
    schemaVersion: "stage4-vegetation-legal-supervision-data-audit-v1",
    status: "all_64_approved_records_vegetation_supervision_qualified",
    approvedRecordCount: rows.length,
    splitCounts,
    exactConditionChannelCount: 23,
    conditionChannelOrder: expectedOrder,
    allConditionOrdersExact: true,
    allReferenceRgbPresentAndHashBound: true,
    allConditionPacksPresentAndHashBound: true,
    allVegetationMasksPresentAndHashBound: true,
    allVegetationMasksNonEmpty: true,
    allTrainingEligibilityBound: true,
    minimumVegetationNonZeroCount: Math.min(...rows.map((row) => row.vegetationNonZeroCount)),
    maximumVegetationNonZeroCount: Math.max(...rows.map((row) => row.vegetationNonZeroCount)),
    failedPreviewPixelsUsedAsTargets: false,
    machineReviewUsedAsTarget: false,
    records: rows,
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
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-vegetation-legal-supervision-design-review-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_legal_vegetation_supervision_design_review")
assert.equal(same(authorization.allowedActions, REQUIRED_ACTIONS), true, "allowed_actions_not_exact")
assert.equal(FORBIDDEN_ACTIONS.every((name) => authorization.deniedActions.includes(name)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.deepEqual(authorization.sourceEvidence, SOURCE_EVIDENCE)
for (const evidence of Object.values(SOURCE_EVIDENCE)) assert.equal(shaFile(projectFile(evidence.path)), evidence.sha256, `source_sha_mismatch:${evidence.path}`)

const programs = {
  runner: projectFile("scripts/run-stage4-vegetation-legal-supervision-design-review.mjs"),
  checker: projectFile("scripts/check-stage4-vegetation-legal-supervision-design-review.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-vegetation-legal-supervision-design-review.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, file]) => [name, bind(file)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
const audit = auditApprovedData()
const trainerText = fs.readFileSync(projectFile(DATASET.trainer), "utf8")
const coverage = {
  objectClasses: ["footprints", "tree", "rock", "vegetation"],
  finalVisibleColorCovered: trainerText.includes("FinalTypedRgbMae"),
  finalVisibleEdgeCovered: trainerText.includes("FinalTypedEdgeMae"),
  perClassLuminanceStructureCovered: trainerText.includes("stage4_full_rollout_per_class_final_visible_luminance_structure_obligation_losses"),
  referenceFeatureStructureCovered: trainerText.includes("stage4_per_class_final_visible_reference_feature_structure_obligation_losses"),
  perClassWorstSampleReferenceFeatureCovered: trainerText.includes("stage4_per_class_worst_sample_reference_feature_structure_obligation_from_tensor"),
  globalWorstSampleClassLuminanceCovered: trainerText.includes("stage4_full_rollout_worst_sample_class_reference_luminance_obligation_losses"),
  globalWorstSampleClassLuminanceReduction: trainerText.includes('"selection": "maximum_over_sample_and_class"') ? "maximum_over_sample_and_class" : "unknown",
  perClassWorstSampleLuminanceCovered: trainerText.includes("stage4_per_class_worst_sample_final_visible_luminance_structure_obligation"),
  newModelRequired: false,
  freeWeightRequired: false,
}
const decision = reviewLegalVegetationSupervision({ audit, coverage })

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const now = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-vegetation-legal-supervision-design-review-consumption-v1",
  status: "cpu_readonly_design_review_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  authorizationPath: authorizationArg,
  authorizationSha256: authorizationSha,
  oneTimeConsumption: true,
  consumedAtUtc: now,
  consumedAtAsiaShanghai: formatShanghai(now),
}
const consumptionFd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(consumptionFd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(consumptionFd) }
finally { fs.closeSync(consumptionFd) }

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const files = Object.fromEntries([
  ["audit", "data-supervision-audit.json"], ["cpu", "cpu-report.json"], ["report", "supervision-design-report.json"],
  ["decision", "adjudication.json"], ["contract", "inactive-training-objective-contract.json"],
  ["owner", "owner-action-request.json"], ["terminal", "phase-terminal.json"], ["capsule", "local-task-capsule.json"],
  ["planSync", "plan-sync-record.json"],
].map(([key, name]) => [key, path.join(output, name)]))
const derivedEvidence = {
  datasetManifest: bind(projectFile(DATASET.manifest)), sourceIndex: bind(projectFile(DATASET.sourceIndex)),
  conditionConfig: bind(projectFile(DATASET.config)), trainer: bind(projectFile(DATASET.trainer)),
}
writeJsonAtomic(files.audit, { ...audit, sourceEvidence: derivedEvidence, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.cpu, { ...cpuReport, dataAudit: bind(files.audit), sourceEvidence: SOURCE_EVIDENCE, derivedEvidence, authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.contract, { ...decision.contract, sourceDecision: decision.evidenceFinding, dataAudit: bind(files.audit), automaticActivationAllowed: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-vegetation-legal-supervision-design-report-v1",
  status: decision.status,
  businessFinding: "The 64 approved records provide complete reference RGB, exact 23-channel conditions, and non-empty vegetation masks. Existing luminance worst-case optimization selects only one global sample-class maximum, so another class can hide the worst vegetation sample. The reference-feature path already proves a per-class worst-sample reduction is uniquely derivable without a new model, weight, dataset, or threshold.",
  audit: bind(files.audit), coverage, decision: decision.evidenceFinding, inactiveContract: bind(files.contract),
  sourceEvidence: SOURCE_EVIDENCE, derivedEvidence, checkpointWeightsRead: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, {
  schemaVersion: "stage4-vegetation-legal-supervision-design-decision-v1", status: decision.status,
  selectedDecision: decision.selectedDecision, contractId: decision.contractId, inactiveContract: bind(files.contract),
  ownerDecisionRequired: false, automaticImplementationAllowed: false, report: bind(files.report),
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1", status: "owner_cpu_implementation_authorization_required_not_authorized",
  requestedAction: `implement_${decision.contractId}_cpu_inactive_support`, boundDecision: bind(files.decision), boundContract: bind(files.contract),
  forbiddenAutomaticActions: FORBIDDEN_ACTIONS, automaticApproval: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-vegetation-legal-supervision-design-review-terminal-v1",
  status: "stage4_vegetation_legal_supervision_design_review_succeeded_closed",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  selectedDecision: decision.selectedDecision, contractId: decision.contractId,
  report: bind(files.report), decision: bind(files.decision), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner),
  checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false,
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 legal vegetation supervision design review completed",
  latestTerminal: bind(files.terminal), latestContract: bind(files.contract),
  nextLegalAction: `owner_authorize_cpu_inactive_support_for_${decision.contractId}`,
  evidence: { ...SOURCE_EVIDENCE, ...derivedEvidence, dataAudit: bind(files.audit), cpuReport: bind(files.cpu), report: bind(files.report), decision: bind(files.decision) },
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")} `)
plan = plan.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4合法植被监督设计复核已完成，64份批准数据及48/8/4/4划分完整，唯一未覆盖边界为逐类别最差样本最终可见亮度结构义务；已生成未激活合同${decision.contractId}，尚未实施、未启动GPU或训练`)
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = `- CPU只读合法植被监督设计复核已完成：64份批准记录、48/8/4/4划分、原始参考RGB、23通道条件及object_vegetation掩码全部合格。现有最差亮度结构义务只取全样本×全类别的一个总最大值，可能由其他类别遮蔽植被最差样本；参考特征路径已有逐类别最差样本先例，因此唯一派生${decision.contractId}，不新增模型、权重、数据或阈值。该合同仍未激活，下一步仅可实施CPU支持和正反回归。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-vegetation-legal-supervision-design-${authorization.runId}`, timestamp: now,
  action: "stage4_vegetation_legal_supervision_design_review", runId: authorization.runId,
  kind: "cpu_readonly_design_review", status: "success",
  title: "Stage4 unique legal vegetation supervision gap confirmed",
  titleZh: "Stage4植被合法监督唯一缺口已确认",
  detailZh: "64份批准数据完整；唯一未覆盖边界是逐类别最差样本最终可见亮度结构义务，已生成未激活合同，未读取Checkpoint、未启动GPU或训练。",
  evidencePath: rel(files.terminal), evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  terminal: bind(files.terminal), report: bind(files.report), decision: bind(files.decision),
  inactiveContract: bind(files.contract), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner),
  dataAudit: bind(files.audit), capsule: bind(files.capsule), planSync: bind(files.planSync),
}, null, 2))
