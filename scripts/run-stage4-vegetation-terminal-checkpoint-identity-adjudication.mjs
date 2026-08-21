import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateVegetationTerminalCheckpointIdentityFailure } from "./lib/ai-painter-stage4-vegetation-terminal-checkpoint-identity-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "20260821-024000000"
const REQUIRED_ACTIONS = Object.freeze([
  "establish_cpu_readonly_stage0_vegetation_terminal_checkpoint_identity_adjudication",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_analysis_authorization",
  "write_analysis_decision_owner_request_and_terminal",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const FORBIDDEN_ACTIONS = Object.freeze([
  "read_or_load_checkpoint_weights", "modify_model", "modify_loss", "select_free_hyperparameters",
  "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds",
  "use_failed_preview_as_training_target", "use_review_result_as_training_target",
  "reuse_historical_stage0", "reuse_old_run_id", "reuse_old_authorization", "reuse_old_checkpoint",
  "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion",
  "runtime_frame", "world_entry",
])
const EXPECTED_SOURCES = Object.freeze({
  stage0Terminal: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/finalization/phase-terminal.json`,
    sha256: "bb4465b0d2b5510ce3bba50e00c261a95f4d29897098341a0f03ca597e813f4a",
  },
  stage0Manifest: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/manifest.json`,
    sha256: "f3d6eb512c6249f54c24983e25fab571094c587b010ba9827b2ed4a49149e78e",
  },
  stage0MachineReview: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/fixed-preview-reviews.json`,
    sha256: "7331bb5677fb2362ac7b8178f28f5817c7b6351614de4c080e9bdac4ca5fa12f",
  },
  failedCheckpointIdentityOnly: {
    path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/training-output/complete-world-ai-assisted-conditional-denoiser.pt`,
    sha256: "74816ecc3d5204072646406f2d69d9a352797f1861839581111de953fcef6045",
    checkpointWeightsRead: false,
  },
})
const DERIVED_ACTIVE_CONFIG = Object.freeze({
  path: `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/active-config.json`,
  sha256: "ff970f4ba0ecda56b899203067934e4a87cf81422b9c553fa95d40eae30de7d7",
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
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-vegetation-terminal-checkpoint-identity-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_current_stage0_vegetation_terminal_checkpoint_identity_adjudication")
assert.equal(authorization.sourceRunId, SOURCE_RUN_ID)
assert.equal(same(authorization.allowedActions, REQUIRED_ACTIONS), true, "allowed_actions_not_exact")
assert.equal(FORBIDDEN_ACTIONS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(same(authorization.sourceEvidence, EXPECTED_SOURCES), true, "source_evidence_not_exact_current_run")

for (const [name, evidence] of Object.entries(EXPECTED_SOURCES)) {
  assert.equal(evidence.path.includes(SOURCE_RUN_ID), true, `${name}_historical_run_rejected`)
  const file = projectFile(evidence.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") assert.equal(shaFile(file), evidence.sha256, `${name}_sha256_mismatch`)
}
const activeConfigPath = projectFile(DERIVED_ACTIVE_CONFIG.path)
assert.equal(shaFile(activeConfigPath), DERIVED_ACTIVE_CONFIG.sha256, "derived_active_config_sha256_mismatch")

const programFiles = {
  runner: projectFile("scripts/run-stage4-vegetation-terminal-checkpoint-identity-adjudication.mjs"),
  checker: projectFile("scripts/check-stage4-vegetation-terminal-checkpoint-identity-adjudication.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-vegetation-terminal-checkpoint-identity-adjudication.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programFiles).map(([name, file]) => [name, bind(file)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "formal_output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programFiles.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-vegetation-terminal-checkpoint-identity-analysis-consumption-v1",
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

const decision = adjudicateVegetationTerminalCheckpointIdentityFailure({
  activeConfig: readJson(activeConfigPath),
  terminal: readJson(projectFile(EXPECTED_SOURCES.stage0Terminal.path)),
  manifest: readJson(projectFile(EXPECTED_SOURCES.stage0Manifest.path)),
  review: readJson(projectFile(EXPECTED_SOURCES.stage0MachineReview.path)),
  failedCheckpointIdentity: {
    path: EXPECTED_SOURCES.failedCheckpointIdentityOnly.path,
    sha256: EXPECTED_SOURCES.failedCheckpointIdentityOnly.sha256,
  },
})
assert.equal(decision.selectedCause, "A")
assert.equal(decision.ownerDecisionRequired, true)

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "causal-analysis-report.json"),
  decision: path.join(output, "adjudication.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
const sourceEvidence = structuredClone(EXPECTED_SOURCES)
const derivedEvidence = { activeConfig: { ...DERIVED_ACTIVE_CONFIG } }
writeJsonAtomic(files.cpu, {
  ...cpuReport,
  sourceRunId: SOURCE_RUN_ID,
  sourceEvidence,
  derivedEvidence,
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
  schemaVersion: "stage4-vegetation-terminal-checkpoint-identity-causal-analysis-report-v1",
  status: "vegetation_legal_supervision_active_but_terminal_visible_semantics_insufficient",
  businessFinding: "Stage 0 completed all 40 epochs and the legal vegetation objectives improved, but the fixed Epoch 40 preview retained a vegetation-only reference semantic mismatch: masked luminance correlation 0.0626 remained below the unchanged 0.08 requirement.",
  checkpointFinding: "Epochs 34-40 were rejected by the strict relative west-boundary non-regression gate even when the terminal checkpoint score improved; the Epoch 40 fixed preview separately passed the absolute path audit. These are distinct contract scopes and do not causally explain the remaining vegetation-only failure.",
  decision,
  sourceEvidence,
  derivedEvidence,
  cpuReport: bind(files.cpu),
  checkpointWeightsRead: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, {
  schemaVersion: "stage4-vegetation-terminal-checkpoint-identity-causal-decision-v1",
  status: decision.status,
  selectedCause: decision.selectedCause,
  alternatives: decision.alternatives,
  checkpointIdentityFinding: decision.checkpointIdentityFinding,
  ownerDecisionRequired: true,
  boundedRepairContractGenerated: false,
  report: bind(files.report),
  automaticRetryAllowed: false,
  stage1EntryPermitted: false,
  stage2EntryPermitted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "owner_project_level_decision_required_not_authorized",
  requestedDecision: "choose_between_pausing_the_current_candidate_or_authorizing_a_new_cpu_readonly_legal_vegetation_supervision_design_review",
  businessReason: "All currently registered legal vegetation objectives were active and improved, yet the terminal visible vegetation requirement still failed. The immutable evidence does not uniquely derive another legal supervision expression without an Owner data or supervision-scope decision.",
  allowedNextChoices: [
    "pause_current_stage4_candidate_route",
    "authorize_cpu_readonly_legal_vegetation_supervision_design_review_without_model_training",
  ],
  forbiddenAutomaticActions: ["rerun_stage0", "modify_loss", "modify_model", "start_gpu", "start_training", "lower_review_thresholds"],
  boundDecision: bind(files.decision),
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-vegetation-terminal-checkpoint-identity-causal-terminal-v1",
  status: "stage0_vegetation_active_supervision_insufficient_owner_decision_required_closed",
  sourceRunId: SOURCE_RUN_ID,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  selectedCause: "A",
  stage0FailedClosed: true,
  stage1Started: false,
  stage2Started: false,
  nextLegalAction: "owner_choose_pause_or_authorize_cpu_readonly_legal_vegetation_supervision_design_review",
  report: bind(files.report),
  decision: bind(files.decision),
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
  currentStage: "Stage4 Stage 0 vegetation terminal semantic residual causally adjudicated",
  latestTerminal: bind(files.terminal),
  latestBlocker: "legal_vegetation_supervision_active_but_epoch40_visible_luminance_correlation_below_requirement",
  nextLegalAction: "owner_choose_pause_or_authorize_cpu_readonly_legal_vegetation_supervision_design_review",
  forbiddenActions: FORBIDDEN_ACTIONS,
  evidence: { ...sourceEvidence, ...derivedEvidence, cpuReport: bind(files.cpu), report: bind(files.report), decision: bind(files.decision), ownerActionRequest: bind(files.owner) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")} `)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；当前逐类别最差样本参考特征结构候选的全新Stage 0已完成40 Epoch和5760次优化，工程证据完整，但Epoch 40仅剩植被参考语义不一致。独立CPU只读裁决已确认全部合法植被目标均已激活并改善，最终maskedLumaCorrelation仍为0.0626、低于冻结要求0.08；Checkpoint west相对非回退门与终态绝对道路审核属于不同合同口径，不构成该植被失败的根因。当前需要Owner决定暂停路线或授权新的CPU只读合法植被监督设计复核；Stage 1未启动")
const bulletAnchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(bulletAnchor), true, "plan_status_anchor_missing")
const newBullet = "- 当前Stage 0植被终态语义与Checkpoint选择身份的独立CPU只读裁决已经完成：植被颜色、边缘、多尺度亮度、最终参考特征、逐类别最差样本及专项回放均在正式训练中激活并总体改善，但Epoch 40机器审核的植被maskedLumaCorrelation仍为0.0626、低于冻结要求0.08，唯一裁决为A。Epoch 34至40的Checkpoint候选受严格相对west边界非回退门阻断，而Epoch 40固定预览按绝对道路审核通过，两者作用域不同，不是植被失败的接线根因。现有证据不能唯一派生新的合法监督表达，因此只生成Owner项目级决策请求，不自动重跑、调参或进入Stage 1。\n"
assert.equal(plan.includes(newBullet.trim()), false, "plan_already_contains_current_adjudication")
plan = plan.replace(bulletAnchor, `${newBullet}\n${bulletAnchor}`)
plan = plan.replace(
  /3\. `stage4_per_class_worst_sample_reference_feature_structure_obligation_v1`已完成CPU支持、全新只读GPU资格、30 Epoch Smoke、独立后期稳定资格及全新Stage 0；Stage 0工程链完整但机器审核0\/6通过，Epoch 40仅剩植被参考语义不一致，因此真实视觉失败关闭。当前尚缺对该植被终态残差的独立CPU只读因果裁决、一个由合法监督唯一支持的有界修复方向，以及成功的Stage 0、Stage 1和Stage 2；/,
  "3. `stage4_per_class_worst_sample_reference_feature_structure_obligation_v1`已完成CPU支持、全新只读GPU资格、30 Epoch Smoke、独立后期稳定资格及全新Stage 0；Stage 0工程链完整但机器审核0/6通过，Epoch 40仅剩植被参考语义不一致，因此真实视觉失败关闭。植被终态残差的独立CPU只读裁决已完成并确认现有合法监督已激活但仍不足；当前需要Owner决定暂停该路线或授权新的CPU只读合法植被监督设计复核，Stage 1/2均未启动；",
)
const routeOld = "-> 下一步仅可执行CPU只读植被终态参考语义残差因果裁决；不得复用本次Checkpoint、部分权重、授权、runId或输出目录，也不得重跑相同Stage 0"
const routeNew = "-> CPU只读植被终态参考语义残差与Checkpoint选择身份因果裁决（已完成；唯一裁决A：现有合法植被监督已完整激活并改善，但Epoch 40最终可见亮度相关性仍低于冻结要求；Checkpoint相对west门与终态绝对道路审核不是同一合同口径）\n-> 当前仅可由Owner选择暂停候选路线，或独立授权新的CPU只读合法植被监督设计复核；不得自动重跑、调参、启动GPU或进入Stage 1"
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
  id: `stage4-vegetation-terminal-checkpoint-adjudication-${authorization.runId}`,
  timestamp: now,
  action: "stage4_vegetation_terminal_checkpoint_identity_causal_adjudication",
  runId: authorization.runId,
  kind: "cpu_readonly_adjudication",
  status: "success",
  title: "Stage4 Stage 0 vegetation terminal cause A confirmed",
  titleZh: "Stage4 Stage 0植被终态失败已裁决为现有合法监督仍不足",
  detailZh: "全部合法植被目标均已激活并总体改善，但Epoch 40最终可见植被亮度相关性0.0626仍低于冻结要求0.08；Checkpoint相对west门与终态绝对道路审核属于不同合同口径，不构成植被失败根因。",
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
  ownerActionRequest: bind(files.owner),
  capsule: bind(files.capsule),
  planSync: bind(files.planSync),
}, null, 2))
