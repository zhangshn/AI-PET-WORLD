import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RUN_ID = "20260823-135123928"
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-capacity-best-checkpoint-preview-reviews/${RUN_ID}`)
const terminal = path.join(output, "phase-terminal.json")
const failure = path.join(output, "failure-report.json")
const plan = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const capsule = path.join(output, "local-task-capsule.json")
const sync = path.join(output, "plan-sync-record.json")
const expected = {
  terminal: "f6d8db477bf95eef0311ced279a9e766093ffff8ee42109a94ce63f6cbef523b",
  failure: "f47496f8eda6fa352a86b64e07ecf166bf8673679e65fb0abeffa74bebc9e05f",
}

assert.equal(sha(terminal), expected.terminal, "failure_terminal_identity_changed")
assert.equal(sha(failure), expected.failure, "failure_report_identity_changed")
assert.equal(fs.existsSync(capsule), false, "local_task_capsule_exists")
assert.equal(fs.existsSync(sync), false, "plan_sync_record_exists")

const now = new Date().toISOString()
writeJsonAtomic(capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  status: "failed_closed",
  runId: RUN_ID,
  task: "audit_immutable_epoch37_capacity_best_checkpoint_preview",
  outcomeZh: "审核包装器在正式画面结论生成前将辅助focal_area误分类为四类正式参考语义对象；源预览未修改，未读取Checkpoint，未启动GPU或训练。",
  evidence: { terminal: bind(terminal), failureReport: bind(failure) },
  nextLegalAction: "owner_authorize_fresh_cpu_review_with_repaired_formal_object_filter",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(sync, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  runId: RUN_ID,
  uniqueModulePlan: bind(plan),
  terminal: bind(terminal),
  nextLegalAction: "owner_authorize_fresh_cpu_review_with_repaired_formal_object_filter",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
})
for (const file of [capsule, sync, plan]) index(file)
appendAiPainterProgramEvent({
  id: `stage4-capacity-best-checkpoint-preview-review-governance-synchronized-${RUN_ID}`,
  timestamp: now,
  action: "stage4_capacity_best_checkpoint_preview_review_governance_sync",
  runId: RUN_ID,
  kind: "failed_review_governance_closure",
  status: "completed",
  title: "Capacity best-checkpoint review failure governance synchronized",
  titleZh: "容量结构最佳Checkpoint审核入口失败治理已同步",
  detailZh: "唯一计划表和任务胶囊已登记包装器失败；固定进度保持60%，下一步只允许全新一次性CPU审核授权。",
  evidencePath: project(sync),
  evidenceSha256: sha(sync),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "governance_synchronized", capsule: bind(capsule), planSync: bind(sync), uniqueModulePlan: bind(plan) }, null, 2))

function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function project(file) { return path.relative(ROOT, path.resolve(ROOT, file)).replaceAll("\\", "/") }
function bind(file) { const absolute = path.resolve(ROOT, file); return { path: project(absolute), sha256: sha(absolute) } }
function index(file) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: RUN_ID, artifactType: "stage4_capacity_best_checkpoint_preview_review_failure_governance", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
