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

const route = await readFile(
  new URL("../src/app/api/ai-painter/dataset/upload/route.ts", import.meta.url),
  "utf8"
)

assert.match(route, /form\.getAll\("images"\)/u, "上传接口必须读取多张图片")
assert.match(route, /MAX_BATCH_FILES = 20/u, "上传接口必须限制批次大小")
assert.match(route, /for \(const image of images\)/u, "上传接口必须逐张处理")
assert.match(route, /createDatasetSampleId/u, "上传接口必须自动生成独立 sampleId")
assert.match(route, /hashBuffer\(buffer\)/u, "上传接口必须为每张图计算独立哈希")
assert.match(route, /重复图片被阻断/u, "上传接口必须阻断重复图片")
assert.match(route, /collectAcceptedTargetHashes/u, "上传接口必须检查已接收 target 哈希")
assert.match(route, /originalImageSha256/u, "上传接口必须记录原始图哈希")
assert.match(route, /sourceKind/u, "上传接口必须记录来源类型")
assert.match(route, /licenseBasis/u, "上传接口必须记录许可依据")
assert.match(route, /toolName/u, "上传接口必须记录制作工具")
assert.match(route, /reviewer/u, "上传接口必须记录审核人")
assert.match(route, /viewpoint/u, "上传接口必须记录观察视角")
assert.match(route, /componentMaterials/u, "上传接口必须记录部件材质映射")
assert.match(route, /directCopyProhibited/u, "上传接口必须记录禁止直接复制确认")

const importer = await readFile(
  new URL("../ml/ai-painter/src/ai_painter/dataset/importer.py", import.meta.url),
  "utf8"
)

assert.match(importer, /ImageOps\.fit\(image\.convert\("RGB"\), size/u, "scene target 标准化必须保持比例裁剪，不得直接拉伸")
assert.match(importer, /format="PNG"/u, "标准 target 必须保存为 PNG")

console.log("AI Painter batch upload checks passed: 22 assertions.")
