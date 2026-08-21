import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RUN_ID = "20260821-092701121"
const OUTPUT = path.join(ROOT, ".runtime", "ai-painter", "stage4-epoch-complete-per-class-worst-luminance-cpu-implementations", RUN_ID)
const TERMINAL = path.join(OUTPUT, "phase-terminal.json")
const SUPPORT = path.join(OUTPUT, "training-objective-support-contract.json")
const PLAN = path.join(ROOT, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md")
const RECORD = path.join(OUTPUT, "plan-sync-completion-record.json")
const CONTRACT_ID = "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1"

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const rel = (file) => path.relative(ROOT, file).replaceAll("\\", "/")
const bind = (file) => ({ path: rel(file), sha256: sha(file) })
const writeTextAtomic = (target, value) => {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporary, value, "utf8")
  fs.renameSync(temporary, target)
}

assert.equal(sha(TERMINAL), "8f6eb4e98e2fa14464c7f0bd4518d3bb67179a16d953b70ce0216dcf020e869d")
assert.equal(sha(SUPPORT), "d0618b9679431951208b2ba4427d3f2c8d118524c2e6f682130f936ac5c74c85")
assert.equal(fs.existsSync(RECORD), false, "plan_sync_completion_record_exists")
let plan = fs.readFileSync(PLAN, "utf8")
const stale = `-> 当前下一步：仅可建设${CONTRACT_ID}的CPU未激活支持与正反回归；不得复用失败Checkpoint、自动重跑或进入Stage 1`
const current = `-> 当前下一步：仅可执行${CONTRACT_ID}的独立只读GPU资格；不得复用失败Checkpoint、自动重跑或进入Stage 1`
assert.equal(plan.includes(stale), true, "stale_next_step_not_found")
plan = plan.replace(stale, current)
writeTextAtomic(PLAN, plan)
const now = new Date().toISOString()
writeJsonAtomic(RECORD, {
  schemaVersion: "ai-painter-plan-sync-completion-record-v1",
  status: "unique_plan_next_step_synchronized",
  contractId: CONTRACT_ID,
  terminal: bind(TERMINAL),
  supportContract: bind(SUPPORT),
  plan: bind(PLAN),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: `owner_authorize_readonly_gpu_qualification_for_${CONTRACT_ID}`,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
for (const file of [PLAN, RECORD]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file),
    storageLayer: "hot", runId: RUN_ID, byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-epoch-complete-per-class-worst-luminance-plan-sync-${RUN_ID}`,
  timestamp: now,
  action: "stage4_epoch_complete_per_class_worst_luminance_plan_sync",
  runId: RUN_ID,
  kind: "plan_sync",
  status: "success",
  title: "Stage4 epoch-complete selector next step synchronized",
  titleZh: "Stage4完整Epoch选择器下一步已同步",
  detailZh: "唯一计划表已从CPU建设更新为独立只读GPU资格；正式进度仍为3/5（60%）。",
  evidencePath: rel(RECORD),
  evidenceSha256: sha(RECORD),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "unique_plan_next_step_synchronized", record: bind(RECORD), plan: bind(PLAN) }, null, 2))
