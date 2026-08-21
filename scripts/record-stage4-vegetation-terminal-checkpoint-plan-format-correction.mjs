import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RUN_ID = "20260821-045342704"
const terminal = path.resolve(ROOT, `.runtime/ai-painter/stage4-vegetation-terminal-checkpoint-identity-adjudications/${RUN_ID}/phase-terminal.json`)
const plan = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const record = path.resolve(ROOT, `.runtime/ai-painter/stage4-vegetation-terminal-checkpoint-identity-adjudications/${RUN_ID}/plan-sync-format-correction.json`)
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const writeTextAtomic = (target, content) => {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  const fd = fs.openSync(temp, "wx")
  try { fs.writeFileSync(fd, content, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  fs.renameSync(temp, target)
}

assert.equal(shaFile(terminal), "e6ce08fede563c1a5ccb831cd25cde2953ceea1160fa1ec71b1a4cd38295d9bc", "bound_terminal_changed")
assert.equal(fs.existsSync(record), false, "format_correction_already_recorded")
let text = fs.readFileSync(plan, "utf8")
assert.equal(text.includes("更新时间：2026-08-21 04:59:51+08:00 \n"), true, "format_correction_anchor_missing")
text = text.replace("更新时间：2026-08-21 04:59:51+08:00 \n", "更新时间：2026-08-21 04:59:51 +08:00\n")
writeTextAtomic(plan, text)
const now = new Date().toISOString()
writeJsonAtomic(record, {
  schemaVersion: "ai-painter-plan-sync-format-correction-v1",
  status: "plan_sync_format_correction_completed",
  runId: RUN_ID,
  changeScope: "timestamp_spacing_and_trailing_whitespace_only",
  terminal: { path: relative(terminal), sha256: shaFile(terminal) },
  plan: { path: relative(plan), sha256: shaFile(plan) },
  businessStateChanged: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
for (const file of [plan, record]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: RUN_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-vegetation-terminal-plan-format-correction-${RUN_ID}`,
  timestamp: now,
  action: "stage4_vegetation_terminal_plan_sync_format_correction",
  runId: RUN_ID,
  kind: "governance_record_correction",
  status: "success",
  title: "Stage4 vegetation adjudication plan format normalized",
  titleZh: "Stage4植被裁决计划表格式已规范化",
  detailZh: "仅修正更新时间格式和行尾空格，业务状态、裁决和固定进度均未变化。",
  evidencePath: relative(record),
  evidenceSha256: shaFile(record),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "plan_sync_format_correction_completed", record: { path: relative(record), sha256: shaFile(record) }, plan: { path: relative(plan), sha256: shaFile(plan) } }, null, 2))
