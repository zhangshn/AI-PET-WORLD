import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/)
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const fusionRoot = absolute(".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/20260823-030123742-condition_fusion_only_final_direct_residual_23_64_12")
const capacityRoot = absolute(".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/20260823-030123743-capacity_only_base_width_64_to_existing_level1_128")
const cpuReport = absolute(".runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualifications/20260823-030123742-cpu/cpu-report.json")
const fusionTerminal = path.join(fusionRoot, "phase-terminal.json")
const capacityTerminal = path.join(capacityRoot, "phase-terminal.json")
const fusionReport = path.join(fusionRoot, "gpu-report.json")
const capacityReport = path.join(capacityRoot, "gpu-report.json")
for (const target of [cpuReport, fusionTerminal, capacityTerminal, fusionReport, capacityReport]) assert.equal(fs.existsSync(target), true)
assert.equal(JSON.parse(fs.readFileSync(cpuReport, "utf8")).status, "passed")
assert.equal(JSON.parse(fs.readFileSync(fusionTerminal, "utf8")).status, "controlled_structure_arm_readonly_gpu_qualification_succeeded")
assert.equal(JSON.parse(fs.readFileSync(capacityTerminal, "utf8")).status, "controlled_structure_arm_readonly_gpu_qualification_succeeded")
for (const reportPath of [fusionReport, capacityReport]) {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
  assert.equal(report.status, "controlled_structure_arm_readonly_gpu_qualification_succeeded")
  assert.equal(report.safety.optimizerCreated, false)
  assert.equal(report.safety.backwardExecuted, false)
  assert.equal(report.safety.modelWeightsModified, false)
  assert.equal(report.safety.trainingStarted, false)
  assert.equal(report.stateHashes.denoiserUnchanged, true)
  assert.equal(report.stateHashes.autoencoderUnchanged, true)
}
const output = absolute(`.runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualification-successes/${runId}`)
assert.equal(fs.existsSync(output), false)
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const files = {
  terminal: path.join(output, "phase-terminal.json"),
  fusionOwner: path.join(output, "condition-fusion-smoke-owner-action-request.json"),
  capacityOwner: path.join(output, "capacity-smoke-owner-action-request.json"),
  combinedOwner: path.join(output, "controlled-smoke-compilation-owner-action-request.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.fusionOwner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "waiting_owner_authorization",
  requestedAction: "compile_condition_fusion_only_independent_30_epoch_controlled_smoke_and_cross_arm_adjudication_contract",
  arm: "condition_fusion_only_final_direct_residual_23_64_12",
  gpuQualificationTerminal: bind(fusionTerminal),
  gpuQualificationReport: bind(fusionReport),
  automaticSmokeStartAuthorized: false,
  recordedAtUtc: now,
})
writeJsonAtomic(files.capacityOwner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "waiting_owner_authorization",
  requestedAction: "compile_capacity_only_independent_30_epoch_controlled_smoke_and_cross_arm_adjudication_contract",
  arm: "capacity_only_base_width_64_to_existing_level1_128",
  gpuQualificationTerminal: bind(capacityTerminal),
  gpuQualificationReport: bind(capacityReport),
  automaticSmokeStartAuthorized: false,
  recordedAtUtc: now,
})
writeJsonAtomic(files.combinedOwner, {
  schemaVersion: "ai-painter-owner-action-request-v1",
  status: "waiting_owner_authorization",
  requestedAction: "compile_two_isolated_30_epoch_controlled_smoke_contracts_and_cross_arm_result_adjudication_without_starting_smoke",
  executionOrder: ["condition_fusion_only_final_direct_residual_23_64_12", "capacity_only_base_width_64_to_existing_level1_128"],
  evidenceIsolationRequired: true,
  automaticSmokeStartAuthorized: false,
  boundTerminals: { fusion: bind(fusionTerminal), capacity: bind(capacityTerminal) },
  recordedAtUtc: now,
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-controlled-structure-two-arm-readonly-gpu-qualification-terminal-v1",
  status: "stage4_controlled_structure_two_arm_readonly_gpu_qualification_succeeded",
  cpuAuthorizationReport: bind(cpuReport),
  fusion: { terminal: bind(fusionTerminal), report: bind(fusionReport) },
  capacity: { terminal: bind(capacityTerminal), report: bind(capacityReport) },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  safety: { optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, checkpointWritten: false, smokeStarted: false, trainingStarted: false },
  nextLegalAction: "compile_two_independent_30_epoch_controlled_smoke_contracts_and_cross_arm_adjudication_only",
  ownerActionRequest: bind(files.combinedOwner),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 controlled structure two-arm readonly GPU qualification passed",
  latestTerminal: bind(files.terminal),
  nextLegalAction: "compile_two_independent_30_epoch_controlled_smoke_contracts_and_cross_arm_adjudication_only",
  smokeStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
})
const planPath = absolute("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三臂受控结构的CPU支持及两个新结构臂独立只读GPU资格均已通过；尚未编译或启动受控Smoke，未训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true)
const bullet = "- Stage4两个新结构臂的独立只读GPU资格均已通过：条件融合臂证明同一23通道经唯一23→64→12分支到达最终12通道速度输出，四个新增张量梯度有限非零且仅执行一次残差合并；容量臂保持模块名称和条件融合位置不变，严格派生128→256→512宽度，条件到最终输出梯度有限非零。两臂Denoiser与冻结Autoencoder前后状态不变，未创建优化器、未执行.backward()、未写Checkpoint、未启动Smoke或训练。下一步只允许编译两份相互隔离的30 Epoch受控Smoke合同及跨臂结果裁决，不得自动启动Smoke。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, {
  schemaVersion: "stage4-controlled-structure-two-arm-gpu-success-plan-sync-v1",
  status: "unique_plan_synchronized",
  planPath: relative(planPath),
  beforeSha256: before,
  afterSha256: sha(planPath),
  terminal: bind(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
for (const target of [cpuReport, fusionTerminal, capacityTerminal, fusionReport, capacityReport, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId, artifactType: "stage4_controlled_structure_two_arm_readonly_gpu_qualification", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-controlled-structure-two-arm-gpu-success-${runId}`,
  timestamp: now,
  action: "stage4_controlled_structure_two_arm_readonly_gpu_qualification",
  runId,
  kind: "readonly_gpu_qualification",
  status: "success",
  title: "Stage4 controlled structure two-arm readonly GPU qualification passed",
  titleZh: "Stage4两个受控结构臂只读GPU资格通过",
  detailZh: "条件融合臂与容量臂均通过条件到达、梯度、结构身份和状态冻结验证；未启动Smoke或训练。",
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: JSON.parse(fs.readFileSync(files.terminal, "utf8")).status, terminal: bind(files.terminal), fusionOwnerActionRequest: bind(files.fusionOwner), capacityOwnerActionRequest: bind(files.capacityOwner), combinedOwnerActionRequest: bind(files.combinedOwner), capsule: bind(files.capsule), planSync: bind(files.planSync), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2))
