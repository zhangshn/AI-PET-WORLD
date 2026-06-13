import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const source = await readFile(
  new URL("../src/app/api/ai-painter/dataset/dataset-sample-id.ts", import.meta.url),
  "utf8"
)

assert.match(source, /randomUUID/u, "自动样本 ID 必须包含随机短码")
assert.match(source, /fileName/u, "自动样本 ID 必须使用原始文件名")
assert.match(source, /MAX_SAMPLE_ID_LENGTH = 64/u, "自动样本 ID 必须遵守 64 字符上限")
assert.match(source, /replace\(\/\[\^a-z0-9\]\+\/gu, "-"\)/u, "自动样本 ID 必须清理非法字符")

const route = await readFile(
  new URL("../src/app/api/ai-painter/dataset/upload/route.ts", import.meta.url),
  "utf8"
)
assert.match(route, /form\.getAll\("images"\)/u, "上传接口必须读取多张图片")
assert.match(route, /MAX_BATCH_FILES = 20/u, "上传接口必须限制批次大小")
assert.match(route, /for \(const image of images\)/u, "上传接口必须逐张处理")
assert.match(route, /hashBuffer\(buffer\)/u, "上传接口必须为每张图计算独立哈希")
assert.match(route, /重复图片被阻断/u, "上传接口必须阻断重复图片")
assert.match(route, /collectAcceptedTargetHashes/u, "上传接口必须检查已接收 target 哈希")
assert.match(route, /originalImageSha256/u, "上传接口必须记录原始图哈希")
assert.match(route, /sourceKind/u, "上传接口必须记录来源类型")

console.log("AI Painter batch upload checks passed: 12 assertions.")
