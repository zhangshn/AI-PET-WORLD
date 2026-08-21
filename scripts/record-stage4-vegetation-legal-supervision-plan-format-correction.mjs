import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const RUN_ID = "20260821-051308595"
const base = path.resolve(ROOT, `.runtime/ai-painter/stage4-vegetation-legal-supervision-design-reviews/${RUN_ID}`)
const terminal = path.join(base, "phase-terminal.json")
const plan = path.resolve(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const record = path.join(base, "plan-sync-format-correction.json")
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")

assert.equal(shaFile(terminal), "381a6f6d8c7b3d19f499751ad48de94aa890f813026432c8457b59cc90ed2fa4", "bound_terminal_changed")
assert.equal(fs.existsSync(record), false, "format_correction_already_recorded")
const text = fs.readFileSync(plan, "utf8")
assert.equal(/^更新时间：2026-08-21 05:13:49\+08:00$/m.test(text), true, "normalized_timestamp_missing")
const now = new Date().toISOString()
writeJsonAtomic(record, {
  schemaVersion: "ai-painter-plan-sync-format-correction-v1",
  status: "plan_sync_format_correction_completed",
  runId: RUN_ID,
  changeScope: "trailing_whitespace_only",
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
  id: `stage4-vegetation-legal-supervision-plan-format-correction-${RUN_ID}`,
  timestamp: now,
  action: "stage4_vegetation_legal_supervision_plan_sync_format_correction",
  runId: RUN_ID,
  kind: "governance_record_correction",
  status: "success",
  title: "Stage4 vegetation supervision plan formatting normalized",
  titleZh: "Stage4植被监督复核计划表格式已规范化",
  detailZh: "仅移除更新时间行尾空格，业务状态、裁决和固定进度均未变化。",
  evidencePath: relative(record),
  evidenceSha256: shaFile(record),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "plan_sync_format_correction_completed", record: { path: relative(record), sha256: shaFile(record) }, plan: { path: relative(plan), sha256: shaFile(plan) } }, null, 2))
