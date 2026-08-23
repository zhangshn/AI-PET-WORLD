import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { designBoundedControlledModelStructureDiscrimination, DESIGN_STATUS } from "./lib/ai-painter-stage4-bounded-controlled-model-structure-discrimination-design.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_substantive_structure_review_evidence",
  "inspect_formal_structure_dimension_derivation_evidence",
  "design_baseline_fusion_only_and_capacity_only_control_arms",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_design_authorization",
  "write_design_experiment_isolation_qualification_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "implement_model", "modify_model", "modify_loss", "modify_data", "add_same_type_loss",
  "select_free_hyperparameters", "select_unbound_structure_dimensions", "read_or_load_checkpoint_weights",
  "create_optimizer", "execute_backward", "modify_model_weights", "start_gpu", "start_smoke",
  "start_stage0", "start_stage1", "start_stage2", "start_training", "reuse_failed_checkpoint",
  "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target",
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
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-bounded-controlled-model-structure-discrimination-design-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_bounded_controlled_model_structure_discrimination_design")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(same(authorization.deniedActions, DENIALS), true, "denied_actions_not_exact")
assert.deepEqual(authorization.formalDerivationEvidence, { conditionFusionOnly: null, capacityOnly: null }, "unbound_formal_derivation_injected")
for (const permission of ["checkpointWeightsReadAuthorized", "gpuAuthorized", "trainingAuthorized", "modelModificationAuthorized", "architectureImplementationAuthorized", "freeParameterSelectionAuthorized"]) assert.equal(authorization[permission], false, `${permission}_must_be_false`)
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.oneTimeConsumption, true)
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
  assert.equal(/\.pt$/i.test(evidence.path), false, `${name}_checkpoint_evidence_forbidden`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-bounded-controlled-model-structure-discrimination-design.mjs"),
  checker: projectFile("scripts/check-stage4-bounded-controlled-model-structure-discrimination-design.mjs"),
  designLibrary: projectFile("scripts/lib/ai-painter-stage4-bounded-controlled-model-structure-discrimination-design.mjs"),
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

const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-bounded-controlled-model-structure-discrimination-design-consumption-v1",
  status: "cpu_readonly_design_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorizationPath: authorizationArg,
  authorizationSha256,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const descriptor = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(descriptor, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }

const evidence = authorization.sourceEvidence
const terminal = readJson(projectFile(evidence.structureReviewTerminal.path))
const review = readJson(projectFile(evidence.structureReviewReport.path))
const adjudication = readJson(projectFile(evidence.structureReviewAdjudication.path))
const ownerRequest = readJson(projectFile(evidence.structureReviewOwnerRequest.path))
const priorCpuReport = readJson(projectFile(evidence.structureReviewCpuReport.path))
const config = readJson(projectFile(evidence.activeConfig.path))
const modelSource = fs.readFileSync(projectFile(evidence.modelSource.path), "utf8")
assert.equal(config.denoiserArchitecture, review.currentArchitecture.architecture, "active_config_architecture_mismatch")
assert.equal(config.conditionChannels, 23)
assert.equal(config.denoiserBaseChannels, 64)
assert.equal(config.latentChannels, 12)
assert.equal(config.latentDownsampleFactor, 4)
assert.match(modelSource, /self\.condition_stem/)
assert.match(modelSource, /self\.condition_down1/)
assert.match(modelSource, /self\.condition_down2/)
assert.match(modelSource, /self\.typed_condition_adapter_up1/)
assert.match(modelSource, /self\.typed_condition_adapter_up0/)
assert.match(modelSource, /self\.semantic_mixture_experts/)
assert.equal(adjudication.structure.denoiserBaseChannels, config.denoiserBaseChannels)
assert.equal(adjudication.structure.latentChannels, config.latentChannels)

const design = designBoundedControlledModelStructureDiscrimination({
  terminal,
  review,
  adjudication,
  ownerRequest,
  cpuReport: priorCpuReport,
  formalDerivations: authorization.formalDerivationEvidence,
})
assert.equal(design.status, DESIGN_STATUS.DERIVATION_GAP)
assert.equal(design.materializedThreeArmContract, false)
assert.equal(design.executable, false)

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "design-report.json"),
  experiment: path.join(output, "controlled-experiment-contract.json"),
  isolation: path.join(output, "evidence-isolation-contract.json"),
  qualification: path.join(output, "future-qualification-order.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), sourceEvidence: evidence, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, modelImplemented: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, {
  schemaVersion: "stage4-bounded-controlled-model-structure-discrimination-design-report-v1",
  status: "cpu_readonly_design_completed_failed_closed",
  businessQuestion: "Can baseline, fusion-only and capacity-only controls be materialized without choosing any free structural value?",
  discoveredProblem: "The baseline is fully bound, but neither control delta is uniquely specified by an immutable formal contract.",
  proposedProblem: "Any immediate layer, channel or capacity choice would be a new architecture choice rather than a derived control.",
  analysis: design.analysis,
  resolution: "Preserve an inactive non-executable three-arm skeleton and request formal unique derivation rules before implementation.",
  sourceEvidence: evidence,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.experiment, {
  schemaVersion: "stage4-bounded-three-arm-controlled-experiment-contract-v1",
  status: "inactive_not_executable_dimension_derivation_gap",
  executable: false,
  materialized: false,
  baseline: design.arms.baseline,
  conditionFusionOnly: design.arms.conditionFusionOnly,
  capacityOnly: design.arms.capacityOnly,
  frozenIdentities: design.frozenIdentities,
  freeParameterCount: 0,
  activationAuthorized: false,
  implementationAuthorized: false,
  trainingAuthorized: false,
})
writeJsonAtomic(files.isolation, { schemaVersion: "stage4-controlled-model-structure-evidence-isolation-contract-v1", ...design.evidenceIsolationContract, activeNow: false })
writeJsonAtomic(files.qualification, { schemaVersion: "stage4-controlled-model-structure-future-qualification-order-v1", status: "inactive_order_defined", steps: design.futureQualificationOrder, gpuAuthorizedNow: false, trainingAuthorizedNow: false })
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-formal-unique-structure-derivation-owner-action-request-v1",
  status: "owner_decision_required",
  action: design.ownerAction.action,
  problem: "The project binds 23 condition channels, 64 base channels and 12 latent channels, but does not uniquely define a fusion-only structural delta, whether the capacity control changes internal capacity or output bottleneck, or the resulting dimensions.",
  requiredEvidence: design.ownerAction.requiredEvidence,
  prohibited: ["infer_128_from_convention", "infer_dimensions_from_dataset_size", "change_loss", "change_data", "start_gpu", "train"],
  automaticApproval: false,
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBeforeSha256 = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三臂结构判别设计已CPU失败关闭：基线已完整绑定，但条件融合对照与容量/输出瓶颈对照均缺少唯一正式派生规则，未自由选择结构数值、未实施模型或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = "- Stage4有界三臂模型结构判别设计已完成CPU只读审查：当前基线的23条件通道、64基础通道、12潜变量通道和五尺度融合均已绑定；但正式合同没有唯一规定条件融合对照应改变哪一条结构，也没有唯一规定容量对照应改变内部容量还是输出瓶颈及其尺寸。程序已生成不可执行的三臂骨架、证据隔离合同和未来资格顺序，并按禁止自由参数要求失败关闭。下一步必须先由Owner正式绑定两条唯一结构派生规则，之后才允许CPU未激活实施。\n"
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, planText)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-bounded-controlled-model-structure-discrimination-design-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: planBeforeSha256, afterSha256: shaFile(planPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-bounded-controlled-model-structure-discrimination-design-terminal-v1",
  status: "stage4_bounded_controlled_model_structure_discrimination_design_failed_closed_dimension_derivation_gap",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  designReport: bind(files.report),
  controlledExperimentContract: bind(files.experiment),
  evidenceIsolationContract: bind(files.isolation),
  futureQualificationOrder: bind(files.qualification),
  ownerActionRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  planSync: bind(files.planSync),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  modelImplemented: false,
  nextLegalAction: "owner_authorization_for_formal_unique_structure_derivation_rules",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 bounded controlled model structure discrimination design",
  terminal: bind(files.terminal),
  latestDecision: DESIGN_STATUS.DERIVATION_GAP,
  nextLegalAction: "formal_unique_structure_derivation_rules_owner_decision",
  forbiddenActions: DENIALS,
  recordedAtUtc: now,
})
for (const target of Object.values(files)) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_bounded_controlled_model_structure_discrimination_design", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-bounded-controlled-model-structure-discrimination-design-${authorization.runId}`,
  timestamp: now,
  action: "stage4_bounded_controlled_model_structure_discrimination_design",
  runId: authorization.runId,
  kind: "cpu_readonly_design",
  status: "success",
  title: "Stage4 controlled structure design failed closed on missing derivation rules",
  titleZh: "Stage4三臂结构判别设计因缺少唯一派生规则而安全关闭",
  detailZh: "基线已完整绑定；融合对照和容量对照均没有正式唯一结构变化公式。程序没有自由选择通道或层数，已保存不可执行骨架、隔离合同和Owner动作请求。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: readJson(files.terminal).status,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  terminal: bind(files.terminal),
  designReport: bind(files.report),
  controlledExperimentContract: bind(files.experiment),
  evidenceIsolationContract: bind(files.isolation),
  futureQualificationOrder: bind(files.qualification),
  ownerActionRequest: bind(files.owner),
  cpuReport: bind(files.cpu),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
}, null, 2))

