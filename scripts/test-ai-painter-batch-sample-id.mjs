import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const sampleIdSource = await readFile(
  new URL("../src/app/api/ai-painter/dataset/dataset-sample-id.ts", import.meta.url),
  "utf8"
)

assert.match(sampleIdSource, /randomUUID/u, "自动样本 ID 必须包含随机短码")
assert.match(sampleIdSource, /fileName/u, "自动样本 ID 必须使用原始文件名")
assert.match(sampleIdSource, /MAX_SAMPLE_ID_LENGTH = 64/u, "自动样本 ID 必须遵守 64 字符上限")
assert.match(sampleIdSource, /replace\(\/\[\^a-z0-9\]\+\/gu, "-"\)/u, "自动样本 ID 必须清理非法字符")

const importer = await readFile(
  new URL("../ml/ai-painter/src/ai_painter/dataset/importer.py", import.meta.url),
  "utf8"
)

assert.match(importer, /"status": "rejected"/u, "旧incoming导入必须固定进入拒绝状态")
assert.match(importer, /"trainingEligible": False/u, "旧incoming导入不得进入正式训练")

console.log("AI Painter dataset sample identity checks passed: 6 assertions; retired upload route is not required.")
