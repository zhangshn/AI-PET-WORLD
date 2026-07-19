import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  buildFoundationalCompleteMapVisualStandard,
  validateFoundationalCompleteMapVisualStandard,
} from "./lib/foundational-complete-map-visual-standard.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = ".runtime/ai-painter/foundational-complete-map-visual-standards"
const index = readJson("data/world-samples/original-image-library/natural-home-v1/index.json")
const timestamp = new Date().toISOString()
const standard = await buildFoundationalCompleteMapVisualStandard(index)
standard.createdAtUtc = timestamp
standard.createdAtAsiaShanghai = formatShanghai(timestamp)
standard.updatedAtUtc = timestamp
const validation = validateFoundationalCompleteMapVisualStandard(standard)
if (!validation.passed) throw new Error(`foundational complete-map visual standard invalid: ${validation.issues.join(",")}`)

const standardPath = path.join(ROOT, OUTPUT_ROOT, standard.standardId, "visual-standard.json")
let reused = false
if (fs.existsSync(standardPath)) {
  const existing = readJson(standardPath)
  if (existing.inputSha256 !== standard.inputSha256) throw new Error(`immutable visual standard identity collision: ${standard.standardId}`)
  reused = true
} else {
  writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId: standard.standardId,
    fileName: "visual-standard.json",
    record: standard,
    latest: {
      standardId: standard.standardId,
      standardPath: projectPath(standardPath),
      inputSha256: standard.inputSha256,
    },
  })
}
if (reused) {
  writeJsonAtomic(path.join(ROOT, OUTPUT_ROOT, "latest.json"), {
    schemaVersion: `${standard.schemaVersion}-latest-pointer`,
    runId: standard.standardId,
    standardId: standard.standardId,
    status: standard.status,
    updatedAtUtc: timestamp,
    runPath: projectPath(standardPath),
    standardPath: projectPath(standardPath),
    inputSha256: standard.inputSha256,
  })
}

const bytes = fs.readFileSync(standardPath)
appendAiPainterProgramEvent({
  action: reused ? "reuse_foundational_complete_map_visual_standard" : "build_foundational_complete_map_visual_standard",
  runId: standard.standardId,
  kind: reused ? "visual_standard_reused" : "visual_standard_built",
  status: "success",
  title: reused ? "Existing foundational complete-map visual standard reused" : "Foundational complete-map visual standard built",
  titleZh: reused ? "程序复用未变化的基础完整地图视觉标准" : "程序已从22张基础完整图构建完整地图视觉标准",
  detail: `sources=${standard.sourceRecordCount}; historicalRgbReferences=0; inputSha256=${standard.inputSha256}`,
  detailZh: `基础完整图=${standard.sourceRecordCount}张；历史RGB引用=0；输入哈希=${standard.inputSha256}`,
  script: "scripts/build-foundational-complete-map-visual-standard.mjs",
  currentStep: "foundational_complete_map_visual_standard",
  archiveId: standard.standardId,
  evidencePath: projectPath(standardPath),
})

console.log(JSON.stringify({
  status: standard.status,
  standardId: standard.standardId,
  standardPath: projectPath(standardPath),
  standardSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  sourceRecordCount: standard.sourceRecordCount,
  historicalCompleteMapRgbReferenceCount: 0,
  reused,
}, null, 2))

function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
