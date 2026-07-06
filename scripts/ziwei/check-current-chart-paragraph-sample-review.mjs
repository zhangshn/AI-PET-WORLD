import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText

  module._compile(output, filename)
}

const {
  getAllZiweiCurrentChartParagraphSampleReviewProfiles,
  getZiweiCurrentChartParagraphSampleReviewProfile,
  ZIWEI_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW_PROFILES
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_SECTION_TITLES = [
  "核心问题",
  "命中证据",
  "段落顺序",
  "样例段落",
  "解释规则",
  "隐藏规则",
  "降权规则",
  "来源边界",
  "复核清单",
  "下一步复核"
]

const REQUIRED_LAYERS = ["原盘", "大限", "流年", "流月"]
const REQUIRED_PALACES = ["命宫", "夫妻宫", "财帛宫", "官禄宫", "迁移宫", "疾厄宫"]

function fail(message) {
  console.error(`[check-current-chart-paragraph-sample-review] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertText(id, value, field, minLength = 12) {
  assert(typeof value === "string" && value.length >= minLength, `${id}: ${field} too short`)
}

function assertList(id, value, field, minLength, minEntryLength = 8) {
  assert(Array.isArray(value), `${id}: ${field} must be a list`)
  assert(value.length >= minLength, `${id}: ${field} needs at least ${minLength} item(s)`)
  for (const entry of value) {
    assertText(id, entry, field, minEntryLength)
  }
}

function assertContains(value, marker, id, field) {
  assert(JSON.stringify(value).includes(marker), `${id}: ${field} missing marker ${marker}`)
}

const samples = getAllZiweiCurrentChartParagraphSampleReviewProfiles()
assert(
  samples === ZIWEI_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW_PROFILES,
  "getter must return the exported sample registry"
)
assert(samples.length === 6, `expected 6 samples, got ${samples.length}`)

for (const sample of samples) {
  const id = sample.sampleId
  assert(getZiweiCurrentChartParagraphSampleReviewProfile(id)?.sampleId === id, `${id}: getter mismatch`)
  assertText(id, sample.title, "title", 6)
  assertText(id, sample.targetPalace, "targetPalace", 2)
  assertText(id, sample.topic, "topic", 8)
  assertText(id, sample.coreQuestion, "coreQuestion", 24)
  assertList(id, sample.requiredEvidence, "requiredEvidence", 5)
  assertList(id, sample.paragraphOrder, "paragraphOrder", 5)
  assertText(id, sample.sampleParagraph, "sampleParagraph", 120)
  assertList(id, sample.interpretationRules, "interpretationRules", 4)
  assertList(id, sample.hiddenRules, "hiddenRules", 3)
  assertList(id, sample.downgradeRules, "downgradeRules", 3)
  assertList(id, sample.sourceBoundary, "sourceBoundary", 3)
  assertList(id, sample.reviewChecklist, "reviewChecklist", 5)
  assertText(id, sample.nextReviewAction, "nextReviewAction", 24)
  assert(sample.sections.length === REQUIRED_SECTION_TITLES.length, `${id}: section count mismatch`)

  const sectionTitles = sample.sections.map((section) => section.title)
  assert(
    JSON.stringify(sectionTitles) === JSON.stringify(REQUIRED_SECTION_TITLES),
    `${id}: section titles mismatch`
  )
  for (const section of sample.sections) {
    assertList(id, section.items, `section.${section.title}`, 1)
  }

  assertContains(sample, "当前盘", id, "sample")
  assertContains(sample, "命中证据", id, "sample")
  assertContains(sample, "三方四正", id, "sample")
  assertContains(sample, "四化", id, "sample")
  assertContains(sample, "动态", id, "sample")
  assertContains(sample, "隐藏", id, "sample")
  assertContains(sample, "降", id, "sample")
  assertContains(sample, "资料", id, "sample")
  assertContains(sample, "不复制", id, "sample")
}

const layerSet = new Set(samples.map((sample) => sample.layer))
for (const layer of REQUIRED_LAYERS) {
  assert(layerSet.has(layer), `missing layer ${layer}`)
}

const palaceSet = new Set(samples.map((sample) => sample.targetPalace))
for (const palace of REQUIRED_PALACES) {
  assert(palaceSet.has(palace), `missing palace ${palace}`)
}

assertContains(samples, "原盘命宫", "samples", "samples")
assertContains(samples, "夫妻宫", "samples", "samples")
assertContains(samples, "财帛宫", "samples", "samples")
assertContains(samples, "大限", "samples", "samples")
assertContains(samples, "流年", "samples", "samples")
assertContains(samples, "流月", "samples", "samples")
assertContains(samples, "不做医学诊断", "samples", "samples")
assertContains(samples, "不做人格化", "samples", "samples")

console.log(`[check-current-chart-paragraph-sample-review] ok samples=${samples.length} sections=${samples.length * REQUIRED_SECTION_TITLES.length}`)
