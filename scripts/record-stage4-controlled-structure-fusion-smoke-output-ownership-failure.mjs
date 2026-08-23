import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const runId = "20260823-032730362"
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-structure-controlled-smokes/${runId}-condition_fusion_only_final_direct_residual_23_64_12`)
const terminal = path.join(output, "finalization", "phase-terminal.json")
const finalization = path.join(output, "finalization", "finalization-report.json")
const consumption = path.join(output, "gpu-consumption.json")
const preflight = path.join(output, "preflight-report.json")
const activeConfig = path.join(output, "active-config.json")
const capacityOutput = path.resolve(ROOT, ".runtime/ai-painter/stage4-controlled-structure-controlled-smokes/20260823-032730363-capacity_only_base_width_64_to_existing_level1_128")
const capacityAuthorization = path.resolve(ROOT, ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-smoke-capacity_only_base_width_64_to_existing_level1_128-20260823-032730363-materialization-20260823-035021429/gpu-execution-authorization.json")
for (const target of [terminal, finalization, consumption, preflight, activeConfig, capacityAuthorization]) assert.equal(fs.existsSync(target), true)
assert.equal(fs.existsSync(capacityOutput), false)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const now = new Date().toISOString()
const files = {
  analysis: path.join(output, "output-ownership-failure-analysis.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.analysis, {
  schemaVersion: "stage4-controlled-structure-fusion-smoke-output-ownership-failure-analysis-v1",
  status: "stage4_controlled_structure_fusion_smoke_failed_before_training_output_directory_creation",
  errorCode: "preflight_and_trainer_output_directory_identity_collision",
  cause: "formal_preflight_created_the_compiled_smoke_root_then_trainer_required_that_same_training_output_directory_to_be_absent",
  fusionTerminal: bind(terminal), finalization: bind(finalization), consumption: bind(consumption),
  preflight: bind(preflight), activeConfig: bind(activeConfig),
  checkpointRead: false, optimizerCreated: false, backwardExecuted: false,
  modelWeightsModified: false, previewWritten: false, trainingStarted: false,
  fusionAuthorizationReusable: false, fusionRunIdReusable: false, fusionOutputReusable: false,
  capacityAuthorization: bind(capacityAuthorization), capacityAuthorizationConsumed: false,
  capacityOutputCreated: false,
  requiredRepair: "separate_outer_preflight_evidence_namespace_from_trainer_training_output_child_directory_then_use_new_fusion_authorization_run_id_and_output",
  recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 controlled structure experiment stopped at condition-fusion Smoke output ownership gate before training",
  latestTerminal: bind(terminal), failureAnalysis: bind(files.analysis),
  nextLegalAction: "authorize_bounded_output_namespace_separation_then_recompile_two_fresh_independent_smoke_authorizations",
  capacityArmNotStarted: true, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now),
})
const planPath = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4受控结构实验已通过双臂CPU与只读GPU资格，条件融合臂正式Smoke因预检根目录与Trainer训练输出目录身份冲突在训练前失败关闭；容量臂授权未消费、未启动；需有界分离输出命名空间后使用全新授权继续")
const temporary = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temporary, plan, "utf8")
fs.renameSync(temporary, planPath)
writeJsonAtomic(files.planSync, {
  schemaVersion: "stage4-controlled-structure-fusion-smoke-output-ownership-failure-plan-sync-v1",
  status: "unique_plan_synchronized_failure_closed", planPath: relative(planPath),
  beforeSha256: before, afterSha256: sha(planPath), terminal: bind(terminal),
  failureAnalysis: bind(files.analysis), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
for (const target of [terminal, finalization, consumption, preflight, activeConfig, capacityAuthorization, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId, artifactType: "stage4_controlled_structure_fusion_smoke_output_ownership_failure", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-controlled-structure-fusion-smoke-output-ownership-failure-${runId}`,
  timestamp: now, action: "stage4_controlled_structure_fusion_smoke", runId,
  kind: "gpu_smoke_infrastructure_failure", status: "failed",
  title: "Stage4 controlled fusion Smoke stopped before training",
  titleZh: "Stage4受控条件融合Smoke在训练前因输出目录身份冲突失败关闭",
  detailZh: "预检通过并消费融合臂授权后，Trainer因正式训练输出目录已由外层预检创建而拒绝启动；未创建优化器、未反向传播、未修改权重。容量臂授权未消费。",
  evidencePath: relative(files.analysis), evidenceSha256: sha(files.analysis),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({
  status: "stage4_controlled_structure_fusion_smoke_output_ownership_failed_closed",
  terminal: bind(terminal), failureAnalysis: bind(files.analysis), capsule: bind(files.capsule),
  planSync: bind(files.planSync), capacityAuthorizationConsumed: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
}, null, 2))
