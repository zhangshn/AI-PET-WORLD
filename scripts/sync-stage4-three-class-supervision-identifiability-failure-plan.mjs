import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RUN_ID = "20260822-071014293"
const OUTPUT = `.runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/${RUN_ID}`
const TERMINAL_SHA = "8bb6ab53f9c42f9260167b167546c5f2b16511bbbaf0524781c44bf3e75d40f5"
const REPORT_SHA = "a7a682d59b17bd8e14c2cfc315a8652d7b3455496380e1e32449c9f6273c4c50"
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const terminal = path.resolve(ROOT, OUTPUT, "phase-terminal.json")
const report = path.resolve(ROOT, OUTPUT, "failure-report.json")
assert.equal(sha(terminal), TERMINAL_SHA, "terminal_sha_mismatch")
assert.equal(sha(report), REPORT_SHA, "report_sha_mismatch")
const plan = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let text = fs.readFileSync(plan, "utf8")
const now = new Date().toISOString()
text = text.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
text = text.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；三类对象合法监督复核的64条文件审计与CPU合同已通过，但正式裁决因源码定位窗口2600字符未覆盖偏移2709处的continue而失败关闭。该失败仅是CPU证据定位器边界错误，授权未消费，未读取Checkpoint、未启动GPU或训练；当前需有界修正定位合同后使用新runId重做只读复核")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(text.includes(anchor), true, "plan_anchor_missing")
const bullet = "- 三类对象监督可辨识性复核本轮失败关闭：64条数据文件审计及CPU正反合同均已通过，但正式源码旁路定位器使用2600字符窗口，未覆盖同一分支偏移2709处的`continue`，因此没有形成正式监督裁决。一次性授权未消费且已关闭；只能修正定位方法并用新runId重新执行CPU只读复核。\n"
if (!text.includes(bullet.trim())) text = text.replace(anchor, `${bullet}\n${anchor}`)
const temp = `${plan}.${process.pid}.${Date.now()}.tmp`
const fd = fs.openSync(temp, "wx")
try { fs.writeFileSync(fd, text, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.renameSync(temp, plan)
const record = path.resolve(ROOT, OUTPUT, "plan-sync-record.json")
assert.equal(fs.existsSync(record), false, "plan_sync_already_exists")
writeJsonAtomic(record, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized_to_cpu_locator_failure", plan: { path: "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md", sha256: sha(plan) }, terminal: { path: `${OUTPUT}/phase-terminal.json`, sha256: TERMINAL_SHA }, failureReport: { path: `${OUTPUT}/failure-report.json`, sha256: REPORT_SHA }, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const target of [plan, record]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: RUN_ID, artifactType: "stage4_three_class_supervision_identifiability_failure_plan_sync", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) }) }
console.log(JSON.stringify({ status: "unique_plan_synchronized_to_cpu_locator_failure", planSha256: sha(plan), planSync: { path: `${OUTPUT}/plan-sync-record.json`, sha256: sha(record) } }, null, 2))
